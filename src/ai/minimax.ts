import { Chess } from 'chess.js';
import type { EngineConfig } from './engineConfig';
import type { MoveRequest } from '../engine/types';

// A compact, self-contained alpha-beta chess AI. It is the MVP's default
// opponent: deterministic-ish, fast, no network or cross-origin headers. Its
// strength is dialled by EngineConfig (depth + randomness + blunderChance),
// which eloMapping.ts derives from the player's effective Elo. A stockfish.wasm
// adapter can later replace this behind the same EngineClient interface.

const VAL: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-square tables (white's perspective, a8..h1 reading order of board()).
// Encourage central control, knight/bishop development, pawn advance.
// prettier-ignore
const PST_PAWN = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];
// prettier-ignore
const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];
// prettier-ignore
const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];
// prettier-ignore
const PST_KING = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
];

function pst(type: string): number[] | null {
  switch (type) {
    case 'p': return PST_PAWN;
    case 'n': return PST_KNIGHT;
    case 'b': return PST_BISHOP;
    case 'k': return PST_KING;
    default: return null;
  }
}

// Static evaluation from WHITE's perspective (centipawns).
function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) {
    // side to move is mated -> very bad for them
    return chess.turn() === 'w' ? -100000 : 100000;
  }
  if (chess.isDraw() || chess.isStalemate()) return 0;

  let score = 0;
  const board = chess.board(); // [row0=a8..h8][...]
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (!sq) continue;
      const base = VAL[sq.type];
      const table = pst(sq.type);
      const idx = r * 8 + f;
      // White reads the table directly; black mirrors vertically.
      const pos = table ? (sq.color === 'w' ? table[idx] : table[(7 - r) * 8 + f]) : 0;
      score += sq.color === 'w' ? base + pos : -(base + pos);
    }
  }
  return score;
}

// Hard safety budget so the search can never hang the worker, regardless of
// position. ~250k nodes is well under a second and far more than depth-3 needs.
const NODE_BUDGET = 250_000;
let nodesSearched = 0;

function negamax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  colorSign: number
): number {
  if (depth === 0 || chess.isGameOver() || nodesSearched > NODE_BUDGET) {
    return colorSign * evaluate(chess);
  }
  nodesSearched++;
  let best = -Infinity;
  const moves = orderMoves(chess.moves({ verbose: true }));
  for (const m of moves) {
    chess.move(m);
    const score = -negamax(chess, depth - 1, -beta, -alpha, -colorSign);
    chess.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // prune
  }
  return best;
}

// MVV-LVA-ish ordering: search captures (most-valuable-victim first) and
// promotions before quiet moves so alpha-beta prunes far more aggressively.
// This is the single biggest speed win for the search.
interface VMove {
  from: string;
  to: string;
  promotion?: string;
  captured?: string;
}
function orderMoves<T extends VMove>(moves: T[]): T[] {
  return moves
    .map((m) => {
      let score = 0;
      if (m.captured) score += 10 * VAL[m.captured] - VAL_FROM_FLAGS(m);
      if (m.promotion) score += VAL[m.promotion] ?? 0;
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
}
function VAL_FROM_FLAGS(_m: VMove): number {
  // Attacker value is unknown from the verbose move alone without a lookup;
  // a small constant keeps capture-vs-capture ordering stable enough.
  return 1;
}

// Choose a move for the side to move in `fen`, dialled by config.
export function chooseMove(fen: string, config: EngineConfig): MoveRequest | null {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) return null;

  const colorSign = chess.turn() === 'w' ? 1 : -1;
  nodesSearched = 0;

  // Deliberate blunder: occasionally just play a random legal move.
  if (Math.random() < config.blunderChance) {
    const m = legal[Math.floor(Math.random() * legal.length)];
    return { from: m.from, to: m.to, promotion: (m.promotion as MoveRequest['promotion']) ?? undefined };
  }

  const noiseAmp = config.randomness * 120; // centipawns of evaluation noise
  let best = legal[0];
  let bestScore = -Infinity;
  for (const m of orderMoves(legal)) {
    chess.move(m);
    let score = -negamax(chess, config.depth - 1, -Infinity, Infinity, -colorSign);
    chess.undo();
    if (noiseAmp > 0) score += (Math.random() * 2 - 1) * noiseAmp;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return {
    from: best.from,
    to: best.to,
    promotion: (best.promotion as MoveRequest['promotion']) ?? undefined,
  };
}
