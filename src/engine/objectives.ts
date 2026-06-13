import { Chess } from 'chess.js';
import { PIECE_VALUE, PLAYER_COLOR, AI_COLOR } from './types';
import type { Color } from './types';

// Roguelike win conditions. Evaluated after every half-move to keep battles
// short (~6-20 moves) and beginner-friendly.
export type Objective =
  | { type: 'checkmate' }
  | { type: 'material'; advantage: number } // reach +X material -> win
  | { type: 'captureQueen' } // "Behead the Champion"
  | { type: 'survive'; moves: number } // last N full moves without being mated
  | { type: 'mateInN'; n: number }; // puzzle: deliver mate within N moves

export type ObjectiveResult = 'win' | 'loss' | 'ongoing';

export interface ObjectiveSnapshot {
  fen: string;
  // number of full moves the player has completed this battle
  fullMovesPlayed: number;
}

export function objectiveLabel(obj: Objective): string {
  switch (obj.type) {
    case 'checkmate':
      return 'Checkmate the enemy king';
    case 'material':
      return `Reach a +${obj.advantage} material advantage`;
    case 'captureQueen':
      return 'Behead the Champion — capture the enemy queen';
    case 'survive':
      return `Survive ${obj.moves} moves`;
    case 'mateInN':
      return `Deliver mate in ${obj.n}`;
  }
}

// Material balance from the player's perspective (positive = player ahead).
export function materialBalance(fen: string): number {
  const c = new Chess(fen);
  let bal = 0;
  for (const row of c.board()) {
    for (const sq of row) {
      if (!sq) continue;
      const v = PIECE_VALUE[sq.type];
      bal += sq.color === PLAYER_COLOR ? v : -v;
    }
  }
  return bal;
}

function hasQueen(fen: string, color: Color): boolean {
  const c = new Chess(fen);
  for (const row of c.board()) {
    for (const sq of row) {
      if (sq && sq.type === 'q' && sq.color === color) return true;
    }
  }
  return false;
}

// The single evaluation entry point. Loss is checked first (you can't win by
// being checkmated), then the objective-specific win condition.
export function evaluateObjective(
  obj: Objective,
  snap: ObjectiveSnapshot
): ObjectiveResult {
  const c = new Chess(snap.fen);

  // Universal loss: the player is checkmated.
  if (c.isCheckmate() && c.turn() === PLAYER_COLOR) return 'loss';

  // Stalemate / draw is a loss for the aggressor in this game (you must win).
  if (c.isStalemate() || c.isInsufficientMaterial() || c.isDraw()) {
    // Exception: a "survive" objective treats a draw as success.
    if (obj.type === 'survive') return 'win';
    return 'loss';
  }

  switch (obj.type) {
    case 'checkmate':
      return c.isCheckmate() && c.turn() === AI_COLOR ? 'win' : 'ongoing';
    case 'material':
      return materialBalance(snap.fen) >= obj.advantage ? 'win' : 'ongoing';
    case 'captureQueen':
      return !hasQueen(snap.fen, AI_COLOR) ? 'win' : 'ongoing';
    case 'survive':
      return snap.fullMovesPlayed >= obj.moves ? 'win' : 'ongoing';
    case 'mateInN':
      if (c.isCheckmate() && c.turn() === AI_COLOR) return 'win';
      // Fail the puzzle if you take too long.
      return snap.fullMovesPlayed > obj.n ? 'loss' : 'ongoing';
  }
}
