import type { MapGraph } from '../map/mapTypes';

// A relic the player owns. Passives/upgrades have no charges; active spells
// carry a per-battle charge budget (`maxCharges`) refreshed each battle.
export interface OwnedRelic {
  defId: string; // -> RelicDef.id
  maxCharges: number; // 0 for passives
}

export interface RunState {
  seed: string;
  baseElo: number;
  gold: number;
  lives: number; // hearts; lose one per battle loss, run ends at 0
  maxLives: number;
  relics: OwnedRelic[];
  map: MapGraph;
  currentNodeId: string | null; // null = at the start, choosing row 0
  act: number;
  defeatedBoss: boolean;
}

export const STARTING_LIVES = 3;
export const STARTING_GOLD = 50;

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
    relics: [
      // Everyone starts with the signature spell so the fantasy lands turn one.
      { defId: 'time-stutter', maxCharges: 2 },
    ],
    map,
    currentNodeId: null,
    act: 1,
    defeatedBoss: false,
  };
}
