import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from './types';

// All rule-bending board mutation funnels through here. chess.js is strict and
// will throw on an illegal position, so every helper that mutates the board
// returns a *validated* result and never leaves the board in a corrupt state.

export interface FenValidation {
  ok: boolean;
  reason?: string;
}

// chess.js v1 validates on construction/load; we add a few roguelike-specific
// invariants on top (exactly one king per side, no pawns on the back ranks).
export function validateFen(fen: string): FenValidation {
  let board;
  try {
    const c = new Chess();
    c.load(fen);
    board = c.board();
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }

  let whiteKings = 0;
  let blackKings = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (!sq) continue;
      if (sq.type === 'k') {
        if (sq.color === 'w') whiteKings++;
        else blackKings++;
      }
      // pawns may never sit on rank 1 or rank 8 (row 0 / row 7)
      if (sq.type === 'p' && (r === 0 || r === 7)) {
        return { ok: false, reason: 'pawn on back rank' };
      }
    }
  }
  if (whiteKings !== 1 || blackKings !== 1) {
    return { ok: false, reason: 'must be exactly one king per side' };
  }
  return { ok: true };
}

// Returns the active-color field of a FEN ('w' | 'b').
export function activeColor(fen: string): Color {
  return fen.split(' ')[1] as Color;
}

// A *strictly* legal starting position: loads, White to move, the game isn't
// over, and NEITHER king is in check. chess.js loads "side-not-to-move in
// check" positions leniently, so we explicitly reject them — those are the
// illegal puzzle starts that broke on king capture.
export function isLegalStart(fen: string): boolean {
  let c: Chess;
  try {
    c = new Chess(fen);
  } catch {
    return false;
  }
  if (c.turn() !== 'w' || c.isGameOver() || c.inCheck()) return false;
  const parts = fen.split(' ');
  parts[1] = 'b';
  parts[3] = '-';
  try {
    return !new Chess(parts.join(' ')).inCheck();
  } catch {
    return false;
  }
}

// Re-stamps the side-to-move in a FEN without otherwise touching the board.
// This is how "extra move" powers keep it the player's turn, and how we hand a
// position to the AI as though it were the AI's move.
export function withActiveColor(fen: string, color: Color): string {
  const parts = fen.split(' ');
  parts[1] = color;
  // When we flip side-to-move artificially, any en-passant target is no longer
  // valid, so clear it to avoid producing an illegal FEN.
  parts[3] = '-';
  return parts.join(' ');
}

// Build a Chess instance from a FEN, mutate it via the callback, and return the
// new FEN — but only if the result validates. On failure returns null so the
// caller can "fizzle" the effect and refund the relic charge.
export function mutateBoard(
  fen: string,
  mutate: (c: Chess) => void
): string | null {
  let working;
  try {
    working = new Chess(fen);
  } catch {
    return null;
  }
  mutate(working);
  const next = working.fen();
  const v = validateFen(next);
  return v.ok ? next : null;
}

// Place a piece on a square (overwriting whatever is there).
export function placePiece(
  fen: string,
  square: Square,
  type: PieceSymbol,
  color: Color
): string | null {
  return mutateBoard(fen, (c) => {
    c.remove(square as never);
    c.put({ type, color }, square as never);
  });
}

// Remove whatever piece sits on a square.
export function removePiece(fen: string, square: Square): string | null {
  return mutateBoard(fen, (c) => {
    c.remove(square as never);
  });
}
