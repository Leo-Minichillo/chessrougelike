import { create } from 'zustand';
import { Chess } from 'chess.js';
import { BattleEngine, type BattlePhase } from '../engine/BattleEngine';
import { objectiveLabel } from '../engine/objectives';
import { PLAYER_COLOR, type MoveRequest, type Square } from '../engine/types';
import type { RelicDef, TargetKind } from '../relics/relicTypes';
import { getRelic } from '../relics/relicDefs';
import { getEngine } from '../ai/EngineClient';
import { computeEncounterElo, eloToEngineConfig } from '../ai/eloMapping';
import type { EngineConfig } from '../ai/engineConfig';
import { generateMap, findNode } from '../map/mapGen';
import type { MapNode } from '../map/mapTypes';
import {
  createRunState,
  grantSpell,
  MAX_ACTS,
  type RunState,
} from '../run/runState';
import { buildEncounter } from '../run/encounters';
import {
  nodeGoldReward,
  rollReward,
  rollShop,
  HEAL_COST,
  RECHARGE_COST,
  type ShopItem,
  type RewardOption,
} from '../run/rewards';
import { rollEvent, type GameEvent } from '../run/events';

export type GamePhase =
  | 'eloEntry'
  | 'map'
  | 'battle'
  | 'reward'
  | 'shop'
  | 'event'
  | 'gameOver'
  | 'victory';

// Serialized projection of the live engine the UI renders from.
export interface BattleView {
  fen: string;
  phase: BattlePhase;
  objectiveLabel: string;
  materialBalance: number;
  frozen: Square[];
  lastMove: { from: Square; to: Square } | null;
  checkedKing: Square | null;
  logs: string[];
  relics: RelicDef[]; // passive, always-on
  spells: { def: RelicDef; charges: number; usable: boolean }[];
  title: string;
  flavor: string;
  config: EngineConfig;
  nodeType: string;
}

export interface TargetingState {
  relicId: string;
  kind: TargetKind;
  validTargets: Square[];
}

interface ShopState {
  stock: ShopItem[];
}

interface GameStore {
  phase: GamePhase;
  run: RunState | null;

  // battle
  battle: BattleView | null;
  selected: Square | null;
  legalTargets: Square[];
  targeting: TargetingState | null;
  pendingPromotion: { from: Square; to: Square } | null;

  // transient node screens
  rewardOptions: RewardOption[];
  shop: ShopState | null;
  event: GameEvent | null;
  eventResult: string | null;
  toast: string | null;
  actCleared: number | null; // act number just cleared (interstitial)

  // actions
  startRun: (baseElo: number, seed?: string) => void;
  chooseNode: (nodeId: string) => void;
  clickSquare: (sq: Square) => void;
  choosePromotion: (piece: 'q' | 'r' | 'b' | 'n') => void;
  activateRelic: (relicId: string) => void;
  cancelTargeting: () => void;
  claimReward: (option: RewardOption | null) => void;
  buyItem: (item: ShopItem) => void;
  buyHeal: () => void;
  buyRecharge: () => void;
  leaveShop: () => void;
  resolveEvent: (choiceIdx: number) => void;
  leaveEvent: () => void;
  nextAct: () => void;
  abandonRun: () => void;
  loadSaved: () => boolean;
}

// The live engine lives outside React state (it is a mutable class).
let engineRef: BattleEngine | null = null;
let engineConfig: EngineConfig | null = null;
let currentNode: MapNode | null = null;

const SAVE_KEY = 'gambit:run';

function saveRun(run: RunState | null) {
  try {
    if (run) localStorage.setItem(SAVE_KEY, JSON.stringify(run));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

function ownedPassives(run: RunState): RelicDef[] {
  return run.relics.map((r) => getRelic(r.defId));
}
function ownedSpells(run: RunState): { def: RelicDef; charges: number }[] {
  return run.spells.map((s) => ({ def: getRelic(s.defId), charges: s.charges }));
}

// Build the UI projection from the live engine.
function projectBattle(node: MapNode, title: string, flavor: string): BattleView {
  const e = engineRef!;
  return {
    fen: e.currentFen,
    phase: e.phase,
    objectiveLabel: objectiveLabel(e.objective),
    materialBalance: e.materialBalance(),
    frozen: e.frozenSquares(),
    lastMove: e.lastMove,
    checkedKing: e.checkedKingSquare(),
    logs: e.logs.slice(-6),
    relics: e.passives,
    spells: e.spells.map((s) => ({
      def: s.def,
      charges: s.charges,
      usable: s.charges > 0 && e.phase === 'playerInput',
    })),
    title,
    flavor,
    config: engineConfig!,
    nodeType: node.type,
  };
}

export const useGameStore = create<GameStore>((set, get) => {
  // ---- AI turn driver (async) ----
  async function runAiTurn() {
    const e = engineRef;
    if (!e || e.phase !== 'aiThinking') return;
    const { fen, restored } = e.prepareAiFen();
    const move = await getEngine().getBestMove(fen, engineConfig!);
    // The engine state may have changed if the user abandoned; re-check.
    if (engineRef !== e) return;
    if (move) {
      e.applyAiMove(move, restored);
    } else {
      // No legal move means the AI is checkmated or stalemated. Don't apply a
      // dummy move (that would loop forever); just re-evaluate the terminal
      // state so the battle resolves cleanly.
      e.resolveTerminal();
    }
    syncBattle();
    if (e.phase === 'aiThinking') void runAiTurn(); // safety (extra AI move)
  }

  // Push engine state into the store and react to terminal phases.
  function syncBattle() {
    const e = engineRef;
    if (!e || !currentNode) return;
    const view = projectBattle(currentNode, get().battle?.title ?? '', get().battle?.flavor ?? '');
    set({ battle: view });
    if (e.phase === 'won') finishBattle(true);
    else if (e.phase === 'lost') finishBattle(false);
    else if (e.phase === 'aiThinking') void runAiTurn();
  }

  // Write the battle's remaining spell charges back to the run, and apply the
  // Reliquary relic (refill 1 charge per spell on a win).
  function persistSpells(run: RunState, won: boolean) {
    const remaining = engineRef!.spellCharges();
    for (const s of run.spells) {
      const found = remaining.find((r) => r.defId === s.defId);
      if (found) s.charges = found.charges;
    }
    if (won && run.relics.some((r) => r.defId === 'reliquary')) {
      for (const s of run.spells) {
        const max = getRelic(s.defId).charges ?? 1;
        s.charges = Math.min(s.charges + 1, max);
      }
    }
  }

  function finishBattle(won: boolean) {
    const run = get().run;
    const e = engineRef;
    if (!run || !e || !currentNode) return;
    persistSpells(run, won);
    if (won) {
      run.gold += e.goldEarned + nodeGoldReward(currentNode.type);
      const node = findNode(run.map, currentNode.id);
      if (node) node.visited = true;
      run.currentNodeId = currentNode.id;
      if (currentNode.type === 'boss') {
        if (run.act >= MAX_ACTS) {
          run.defeatedBoss = true;
          saveRun(null);
          set({ phase: 'victory', battle: null });
        } else {
          // Cleared the act — show an interstitial, then advance.
          saveRun(run);
          set({ phase: 'reward', actCleared: run.act, battle: null, rewardOptions: rollReward(run, currentNode.id) });
        }
        return;
      }
      saveRun(run);
      const options = rollReward(run, currentNode.id);
      if (options.length > 0) {
        set({ phase: 'reward', rewardOptions: options, battle: null });
      } else {
        set({ phase: 'map', battle: null });
      }
    } else {
      run.lives -= 1;
      if (run.lives <= 0) {
        saveRun(null);
        set({ phase: 'gameOver', battle: null });
      } else {
        // Survive the loss: mark node visited so the run continues.
        const node = findNode(run.map, currentNode.id);
        if (node) node.visited = true;
        run.currentNodeId = currentNode.id;
        saveRun(run);
        set({
          phase: 'map',
          battle: null,
          toast: `Defeat! You lost a heart. ${run.lives} remaining.`,
        });
      }
    }
  }

  function enterBattle(node: MapNode) {
    const run = get().run!;
    const used = new Set(run.usedPuzzles);
    const setup = buildEncounter(node, run.seed, used, run.act);
    if (!run.usedPuzzles.includes(setup.fen)) run.usedPuzzles.push(setup.fen);
    const effElo = computeEncounterElo(run, node);
    engineConfig = eloToEngineConfig(effElo);
    engineRef = new BattleEngine(
      setup.fen,
      setup.objective,
      ownedPassives(run),
      ownedSpells(run)
    );
    engineRef.bossHook = setup.bossHook ?? null;
    currentNode = node;
    saveRun(run);
    set({
      phase: 'battle',
      selected: null,
      legalTargets: [],
      targeting: null,
      pendingPromotion: null,
      battle: projectBattle(node, setup.title, setup.flavor),
    });
    // The starting position is always the player's move.
  }

  return {
    phase: 'eloEntry',
    run: null,
    battle: null,
    selected: null,
    legalTargets: [],
    targeting: null,
    pendingPromotion: null,
    rewardOptions: [],
    shop: null,
    event: null,
    eventResult: null,
    toast: null,
    actCleared: null,

    startRun(baseElo, seed) {
      const realSeed = seed ?? Math.random().toString(36).slice(2, 10);
      const map = generateMap(realSeed);
      const run = createRunState(realSeed, baseElo, map);
      engineRef = null;
      currentNode = null;
      saveRun(run);
      set({ phase: 'map', run, battle: null, toast: null });
    },

    chooseNode(nodeId) {
      const run = get().run;
      if (!run) return;
      const node = findNode(run.map, nodeId);
      if (!node) return;
      set({ toast: null });
      switch (node.type) {
        case 'battle':
        case 'elite':
        case 'puzzle':
        case 'boss':
          enterBattle(node);
          break;
        case 'shop': {
          currentNode = node;
          set({ phase: 'shop', shop: { stock: rollShop(run, node.id) } });
          break;
        }
        case 'event': {
          currentNode = node;
          run.currentNodeId = node.id; // events resolve immediately on the map
          set({ phase: 'event', event: rollEvent(run, node.id), eventResult: null });
          break;
        }
      }
    },

    clickSquare(sq) {
      const st = get();
      const e = engineRef;
      if (!e || st.phase !== 'battle' || e.phase !== 'playerInput') return;

      // Targeting mode: clicking a valid target fires the spell.
      if (st.targeting) {
        if (st.targeting.validTargets.includes(sq)) {
          e.activateRelic(st.targeting.relicId, sq);
          set({ targeting: null, selected: null, legalTargets: [] });
          syncBattle();
        }
        return;
      }

      // Normal move flow.
      if (st.selected) {
        // clicking a legal target -> attempt move (handle promotion)
        if (st.legalTargets.includes(sq)) {
          const isPromo = isPromotionMove(e.currentFen, st.selected, sq);
          if (isPromo) {
            set({ pendingPromotion: { from: st.selected, to: sq } });
            return;
          }
          e.applyPlayerMove({ from: st.selected, to: sq });
          set({ selected: null, legalTargets: [] });
          syncBattle();
          return;
        }
      }
      // (re)select a friendly piece
      const targets = e.legalMovesFrom(sq).map((m) => m.to);
      if (targets.length > 0) {
        set({ selected: sq, legalTargets: targets });
      } else {
        set({ selected: null, legalTargets: [] });
      }
    },

    choosePromotion(piece) {
      const st = get();
      const e = engineRef;
      if (!e || !st.pendingPromotion) return;
      e.applyPlayerMove({ ...st.pendingPromotion, promotion: piece });
      set({ pendingPromotion: null, selected: null, legalTargets: [] });
      syncBattle();
    },

    activateRelic(relicId) {
      const e = engineRef;
      if (!e || e.phase !== 'playerInput') return;
      const def = getRelic(relicId);
      if (def.kind !== 'active' || e.chargesFor(relicId) <= 0) return;
      if (!def.requiresTarget) {
        e.activateRelic(relicId);
        set({ selected: null, legalTargets: [] });
        syncBattle();
        return;
      }
      // Enter targeting mode with the set of valid squares.
      const validTargets = computeTargets(e, def.requiresTarget);
      set({ targeting: { relicId, kind: def.requiresTarget, validTargets }, selected: null, legalTargets: [] });
    },

    cancelTargeting() {
      set({ targeting: null });
    },

    claimReward(option) {
      const run = get().run!;
      if (option) grantOption(run, option);
      const cleared = get().actCleared;
      saveRun(run);
      if (cleared !== null) {
        // Boss reward claimed — roll straight into the next act.
        set({ rewardOptions: [], run: { ...run } });
        get().nextAct();
        return;
      }
      set({ phase: 'map', rewardOptions: [], run: { ...run } });
    },

    buyItem(item) {
      const run = get().run!;
      if (run.gold < item.cost) return;
      run.gold -= item.cost;
      grantOption(run, item);
      const shop = get().shop!;
      saveRun(run);
      set({
        run: { ...run },
        // relics are one-time; spells can be re-bought to stack charges
        shop: {
          stock:
            item.kind === 'relic'
              ? shop.stock.filter((s) => s.def.id !== item.def.id)
              : shop.stock,
        },
      });
    },

    buyHeal() {
      const run = get().run!;
      if (run.gold < HEAL_COST || run.lives >= run.maxLives) return;
      run.gold -= HEAL_COST;
      run.lives += 1;
      saveRun(run);
      set({ run: { ...run } });
    },

    buyRecharge() {
      const run = get().run!;
      if (run.gold < RECHARGE_COST) return;
      let recharged = false;
      for (const s of run.spells) {
        const max = getRelic(s.defId).charges ?? 1;
        if (s.charges < max) { s.charges = Math.min(s.charges + 1, max); recharged = true; }
      }
      if (!recharged) return;
      run.gold -= RECHARGE_COST;
      saveRun(run);
      set({ run: { ...run } });
    },

    nextAct() {
      const run = get().run!;
      run.act += 1;
      run.map = generateMap(`${run.seed}:act${run.act}`);
      run.currentNodeId = null;
      run.usedPuzzles = [];
      engineRef = null;
      currentNode = null;
      saveRun(run);
      set({
        phase: 'map',
        actCleared: null,
        run: { ...run },
        toast: `Act ${run.act} — the dead grow bolder. Difficulty rises.`,
      });
    },

    leaveShop() {
      const run = get().run!;
      if (currentNode) {
        const node = findNode(run.map, currentNode.id);
        if (node) node.visited = true;
        run.currentNodeId = currentNode.id;
      }
      saveRun(run);
      set({ phase: 'map', shop: null, run: { ...run } });
    },

    resolveEvent(choiceIdx) {
      const run = get().run!;
      const ev = get().event!;
      const choice = ev.choices[choiceIdx];
      const { message } = choice.resolve(run);
      saveRun(run);
      set({ eventResult: message, run: { ...run } });
    },

    leaveEvent() {
      const run = get().run!;
      if (currentNode) {
        const node = findNode(run.map, currentNode.id);
        if (node) node.visited = true;
      }
      saveRun(run);
      set({ phase: 'map', event: null, eventResult: null, run: { ...run } });
    },

    abandonRun() {
      engineRef = null;
      currentNode = null;
      saveRun(null);
      set({ phase: 'eloEntry', run: null, battle: null });
    },

    loadSaved() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const run = JSON.parse(raw) as RunState;
        // Reject saves from an incompatible (older) schema.
        if (
          !run ||
          typeof run.baseElo !== 'number' ||
          !Array.isArray(run.spells) ||
          !Array.isArray(run.relics) ||
          !Array.isArray(run.usedPuzzles)
        ) {
          saveRun(null);
          return false;
        }
        set({ phase: 'map', run });
        return true;
      } catch {
        return false;
      }
    },
  };
});

// ---- helpers (pure) --------------------------------------------------------

// Grant a reward/shop option to the run: relics are added once, spells stack
// their charges into the run-level pool.
function grantOption(run: RunState, option: RewardOption): void {
  if (option.kind === 'relic') {
    if (!run.relics.some((r) => r.defId === option.def.id)) {
      run.relics.push({ defId: option.def.id });
    }
  } else {
    grantSpell(run, option.def.id, option.def.charges ?? 1);
  }
}

function isPromotionMove(fen: string, from: Square, to: Square): boolean {
  const c = new Chess(fen);
  const piece = c.get(from as never);
  if (!piece || piece.type !== 'p') return false;
  const rank = to[1];
  return (piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1');
}

function computeTargets(e: BattleEngine, kind: TargetKind): Square[] {
  switch (kind) {
    case 'enemyPiece':
      return e.enemyPieces().filter((p) => p.type !== 'k').map((p) => p.square);
    case 'ownPiece':
      return e.ownPieces().map((p) => p.square);
    case 'ownPawn':
      return e.ownPawns();
    case 'emptyBackRank':
      return e.emptyBackRankSquares();
    default:
      return [];
  }
}

export { PLAYER_COLOR };
export type { MoveRequest };
