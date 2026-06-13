// Core shared types for the chess engine layer.
// We re-export the handful of chess.js types we lean on so the rest of the
// codebase imports from one place.

export type Color = 'w' | 'b';
export type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Square = string; // e.g. "e4" — chess.js uses algebraic squares

export interface PieceOnBoard {
  type: PieceSymbol;
  color: Color;
  square: Square;
}

// A move request from the UI/relics. Promotion defaults to queen when omitted.
export interface MoveRequest {
  from: Square;
  to: Square;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

// The player is always white in the MVP; the AI is always black.
export const PLAYER_COLOR: Color = 'w';
export const AI_COLOR: Color = 'b';

// Centipawn-ish material values used for objectives and the fallback AI.
export const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};
