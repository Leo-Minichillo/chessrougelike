import type { EngineConfig } from './engineConfig';
import type { MapNode } from '../map/mapTypes';
import type { RunState } from '../run/runState';

// UCI_Elo on Stockfish's scale plays noticeably stronger than the equivalent
// human rating. We bake in a single tunable offset so post-playtest tuning is a
// one-line change. (Also applied to the minimax mapping for consistency.)
export const ELO_HUMANIZE_OFFSET = -200;

// Engine Elo floor below which Stockfish's UCI_Elo limiter can't reach; below
// this we lean on skill-level + shallow depth instead.
const UCI_ELO_FLOOR = 1320;
const UCI_ELO_CEIL = 3190;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Maps an *effective* Elo (already including node/act bonuses + humanize offset)
// to a concrete engine configuration usable by either AI backend.
export function eloToEngineConfig(effectiveElo: number): EngineConfig {
  const elo = clamp(effectiveElo, 100, UCI_ELO_CEIL);

  // Minimax knobs: depth grows 1 -> 3 across the whole human range (3 is the
  // practical ceiling that keeps moves snappy); weaker ratings get more
  // randomness and a real chance to blunder (hang pieces).
  const depth = Math.round(clamp(1 + (elo - 400) / 700, 1, 3));
  const randomness = clamp(1 - (elo - 400) / 1800, 0, 1);
  const blunderChance = clamp(0.45 - (elo - 400) / 2600, 0, 0.45);

  // Stockfish knobs (used only by the optional wasm adapter).
  const movetimeMs = Math.round(clamp(300 + (elo - 1320) * 0.6, 300, 1000));
  if (elo < UCI_ELO_FLOOR) {
    return {
      depth,
      randomness,
      blunderChance,
      useLimitStrength: false,
      skillLevel: clamp(Math.round((elo - 400) / 46), 0, 19),
      movetimeMs: 300,
      effectiveElo: elo,
    };
  }
  return {
    depth,
    randomness,
    blunderChance,
    useLimitStrength: true,
    uciElo: clamp(elo, UCI_ELO_FLOOR, 2800),
    skillLevel: 20,
    movetimeMs,
    effectiveElo: elo,
  };
}

// How much harder a given node is than the player's baseline.
export function nodeEloBonus(node: Pick<MapNode, 'type' | 'row'>): number {
  switch (node.type) {
    case 'elite':
      // Elites are a real wall: a big jump over surrounding battles.
      return 280 + node.row * 20;
    case 'boss':
      return 250;
    case 'battle':
    default:
      return clamp(node.row * 15, 0, 105);
  }
}

// The headline difficulty function: combine the player's base Elo, the node
// ramp, the act, and the humanize offset into the effective Elo.
export function computeEncounterElo(
  run: Pick<RunState, 'baseElo' | 'act'>,
  node: Pick<MapNode, 'type' | 'row'>
): number {
  const actBonus = (run.act - 1) * 120;
  return run.baseElo + nodeEloBonus(node) + actBonus + ELO_HUMANIZE_OFFSET;
}
