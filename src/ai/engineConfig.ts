// Engine-agnostic difficulty configuration. The bundled minimax AI consumes
// `depth`, `randomness` and `blunderChance`; a future stockfish.wasm adapter
// can consume `useLimitStrength`, `uciElo`, `skillLevel` and `movetimeMs`. Both
// are produced from a single effective-Elo value by eloMapping.ts.

export interface EngineConfig {
  // --- consumed by the bundled minimax engine ---
  depth: number; // search ply (1..4 in the MVP)
  // 0..1 — how strongly to perturb the evaluation, simulating weaker play.
  randomness: number;
  // 0..1 — chance per move to deliberately pick a sub-optimal (blundered) move.
  blunderChance: number;

  // --- consumed by a stockfish.wasm adapter (documented drop-in) ---
  useLimitStrength: boolean;
  uciElo?: number;
  skillLevel?: number;
  movetimeMs: number;

  // For the dev debug panel.
  effectiveElo: number;
}
