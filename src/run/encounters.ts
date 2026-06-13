import type { MapNode } from '../map/mapTypes';
import type { Objective } from '../engine/objectives';
import type { BattleEngine } from '../engine/BattleEngine';
import { placePiece } from '../engine/fenUtils';
import { AI_COLOR } from '../engine/types';
import { rngFromSeed, pick } from '../util/rng';

export interface EncounterSetup {
  fen: string;
  objective: Objective;
  title: string;
  flavor: string;
  bossHook?: (engine: BattleEngine) => void;
}

// Every battle is a "White to mate" puzzle: you start with a decisive edge and
// must checkmate a defending AI. Difficulty escalates by tier (1 = overwhelming
// force, 5 = lean advantage / sharp technique). All positions are validated in
// tests/encounters.test.ts (legal, White to move, not terminal, White winning).
interface Puzzle {
  fen: string;
  title: string;
  flavor: string;
}

const TIERS: Record<number, Puzzle[]> = {
  1: [
    {
      fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
      title: 'The Back Rank',
      flavor: 'Their king is boxed in by its own guard. One rook ends it.',
    },
    {
      fen: '6k1/5ppp/8/8/8/8/5PPP/3QR1K1 w - - 0 1',
      title: 'Overwhelming Force',
      flavor: 'Queen and rook against a lone king. Crush it.',
    },
    {
      fen: '6k1/5ppp/8/8/8/8/5PPP/R5RK w - - 0 1',
      title: 'The Ladder',
      flavor: 'Two towers, marching rank by rank. Drive the king to the edge.',
    },
  ],
  2: [
    {
      fen: '6k1/5p1p/8/8/8/8/5P1P/5QK1 w - - 0 1',
      title: 'Royal Hunt',
      flavor: 'Your queen alone can run the enemy king to ground.',
    },
    {
      fen: '4k3/pp3ppp/8/8/8/8/PP3PPP/3QK3 w - - 0 1',
      title: 'A Crown for the Taking',
      flavor: 'Up a full queen. Find the mating net before they consolidate.',
    },
  ],
  3: [
    {
      fen: '3rk3/3ppp2/8/8/8/8/3PPP2/3QK3 w - - 0 1',
      title: 'Outgun the Guard',
      flavor: 'Queen against rook. Trade the difference into a mate.',
    },
    {
      fen: '3rk3/pp3ppp/8/8/8/8/PP3PPP/3RKR2 w - - 0 1',
      title: 'The Heavy Brigade',
      flavor: 'An extra rook is all the edge a patient attacker needs.',
    },
    {
      fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
      title: 'Rook & Technique',
      flavor: 'Bare king, bare rook. Pure mating technique — no margin for error.',
    },
  ],
  4: [
    {
      fen: '2r1k3/4pp2/8/8/8/8/4PP2/3QK3 w - - 0 1',
      title: 'Razor Margin',
      flavor: 'A queen for a rook, and little else. Precision only.',
    },
    {
      fen: '4k3/1p3p2/8/8/8/8/1P3P2/R3K3 w - - 0 1',
      title: 'Lone Tower',
      flavor: 'One rook, two pawns a side. Shepherd the king to checkmate.',
    },
  ],
};

const BOSS: Puzzle = {
  fen: 'r3k3/pp2pppp/8/8/8/8/PP1QPPPP/4K3 w - - 0 1',
  title: 'The Necromancer',
  flavor:
    'Up a queen for a rook — but every third turn it drags a fallen soldier back from the grave. Mate it before the dead pile up.',
};

function puzzleForTier(tier: number, seed: string): Puzzle {
  // clamp to an available tier, then pick deterministically by seed
  let t = Math.max(1, Math.min(4, tier));
  while (!TIERS[t] || TIERS[t].length === 0) t--;
  return pick(rngFromSeed(seed), TIERS[t]);
}

// The Necromancer boss gimmick: every 3rd AI move, resurrect its most recently
// captured piece on an empty square of its back rank (rank 8).
function necromancerHook(engine: BattleEngine): void {
  if (engine.aiMoveCounter % 3 !== 0) return;
  const type = engine.lastAiCapturedType;
  if (!type) return;
  const files = 'abcdefgh';
  for (const f of files) {
    const sq = `${f}8`;
    const occupied = engine
      .enemyPieces()
      .concat(engine.ownPieces())
      .some((p) => p.square === sq);
    if (occupied) continue;
    const next = placePiece(engine.fen(), sq, type as never, AI_COLOR);
    if (next && engine.setFen(next)) {
      engine.log(`The Necromancer resurrects a ${type.toUpperCase()} on ${sq}!`);
      engine.lastAiCapturedType = null;
      return;
    }
  }
}

// Map a node to a difficulty tier. Battles ramp with map depth; elites and the
// puzzle node are a notch harder; the boss is its own set piece.
function tierForNode(node: MapNode): number {
  if (node.type === 'elite') return Math.min(4, 2 + Math.floor(node.row / 3));
  if (node.type === 'puzzle') return 4;
  return Math.max(1, Math.min(4, 1 + Math.floor(node.row / 2)));
}

export function buildEncounter(node: MapNode, seed: string): EncounterSetup {
  const seedKey = `${seed}:${node.id}`;
  if (node.type === 'boss') {
    return {
      fen: BOSS.fen,
      objective: { type: 'checkmate' },
      title: BOSS.title,
      flavor: BOSS.flavor,
      bossHook: necromancerHook,
    };
  }
  const puzzle = puzzleForTier(tierForNode(node), seedKey);
  return {
    fen: puzzle.fen,
    objective: { type: 'checkmate' }, // every battle is won by checkmate
    title: puzzle.title,
    flavor: puzzle.flavor,
  };
}

// Exposed for tests: every curated position.
export const ALL_PUZZLES: Puzzle[] = [
  ...Object.values(TIERS).flat(),
  BOSS,
];
