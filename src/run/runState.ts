import type { MapGraph } from '../map/mapTypes';

// Two distinct kinds of upgrades:
//  • Relics (passive): permanent, always-on effects. They never run out.
//  • Spells (active): powerful, deliberately limited. Their charges are a
//    RUN-LEVEL pool that depletes as you cast and does NOT refresh between
//    battles. You refill them via the Reliquary relic, shops, or spell rewards.

// A passive relic the player owns (always in effect).
export interface OwnedRelic {
  defId: string;
}

// An active spell with run-persistent charges. A `perBattle` spell instead
// refreshes to 1 charge at the start of every battle and never depletes — that
// is the "once per battle, doesn't go away" starting boon.
export interface OwnedSpell {
  defId: string;
  charges: number;
  perBattle?: boolean;
}

export interface RunState {
  seed: string;
  baseElo: number;
  gold: number;
  lives: number; // hearts; lose one per battle loss, run ends at 0
  maxLives: number;
  relics: OwnedRelic[];
  spells: OwnedSpell[];
  map: MapGraph;
  currentNodeId: string | null; // null = at the start, choosing row 0
  act: number;
  usedPuzzles: string[]; // FENs already seen this run (avoid repeats)
  defeatedBoss: boolean;
}

export const STARTING_LIVES = 3;
export const STARTING_GOLD = 50;
export const MAX_ACTS = 3;

export function createRunState(
  seed: string,
  baseElo: number,
  map: MapGraph
): RunState {
  return {
    seed,
    baseElo,
    gold: STARTING_GOLD,
    lives: STARTING_LIVES,
    maxLives: STARTING_LIVES,
    // You begin with neither — your first boon is chosen on the boon screen.
    relics: [],
    spells: [],
    map,
    currentNodeId: null,
    act: 1,
    usedPuzzles: [],
    defeatedBoss: false,
  };
}

// Add a spell to the run, stacking charges if already owned. A perBattle spell
// (the starting boon) refreshes each battle instead of depleting.
export function grantSpell(
  run: RunState,
  defId: string,
  charges: number,
  perBattle = false
): void {
  const existing = run.spells.find((s) => s.defId === defId);
  if (existing) {
    existing.charges += charges;
    if (perBattle) existing.perBattle = true;
  } else {
    run.spells.push({ defId, charges, perBattle: perBattle || undefined });
  }
}
