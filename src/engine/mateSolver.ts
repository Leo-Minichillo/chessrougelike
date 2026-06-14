import { Chess } from 'chess.js';

// Verifies that the side to move (always White / the player in our puzzles) can
// FORCE checkmate within a given number of full moves against best defence.
// Used by tests to guarantee every shipped puzzle is a sound "mate in N", and
// available at runtime if we ever want hint logic.

// Can the side to move force mate within `plies` half-moves? White is the
// attacker; Black (the defender) plays the move that best avoids/delays mate.
function canMate(chess: Chess, plies: number): boolean {
  if (plies <= 0) return false;
  const attacker = chess.turn() === 'w';
  const moves = chess.moves({ verbose: true });
  if (attacker) {
    for (const m of moves) {
      chess.move(m);
      const ok = chess.isCheckmate() ? true : canMate(chess, plies - 1);
      chess.undo();
      if (ok) return true;
    }
    return false;
  }
  // defender: a mate is only forced if EVERY reply still leads to mate
  if (moves.length === 0) return false; // stalemate is not a mate
  for (const m of moves) {
    chess.move(m);
    const ok = canMate(chess, plies - 1);
    chess.undo();
    if (!ok) return false;
  }
  return true;
}

// True if White (to move) can force mate within `fullMoves` of its own moves.
export function canForceMateIn(fen: string, fullMoves: number): boolean {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return false;
  }
  if (chess.turn() !== 'w' || chess.isGameOver()) return false;
  // White moves on plies 1, 3, 5, …; mate in N full moves = 2N-1 plies.
  return canMate(chess, 2 * fullMoves - 1);
}
