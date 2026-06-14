import type { MapNode } from '../map/mapTypes';
import type { Objective } from '../engine/objectives';
import type { BattleEngine } from '../engine/BattleEngine';
import { placePiece } from '../engine/fenUtils';
import { AI_COLOR } from '../engine/types';
import { rngFromSeed, shuffle } from '../util/rng';

export interface EncounterSetup {
  fen: string;
  objective: Objective;
  title: string;
  flavor: string;
  bossHook?: (engine: BattleEngine) => void;
}

interface Puzzle {
  fen: string;
  title: string;
  flavor: string;
}
interface MatePuzzle extends Puzzle {
  mateIn: number;
}

// PUZZLE NODES: short, real "mate in N" problems with a move limit. Multi-piece,
// legal positions (the enemy king is NOT already in check). Every one is proven
// to be a forced mate in exactly N by tests/encounters.test.ts.
const MATE_PUZZLES: MatePuzzle[] = [
  { mateIn: 1, fen: '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1', title: 'Back Rank', flavor: 'The king is sealed behind its pawns. One move.' },
  { mateIn: 1, fen: '6k1/5ppp/8/8/8/8/8/4Q1K1 w - - 0 1', title: 'The Executioner', flavor: 'Find the square. End it in one.' },
  { mateIn: 1, fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', title: 'Down the File', flavor: 'A clear lane to the eighth rank.' },
  { mateIn: 1, fen: '6k1/5ppp/8/8/8/8/8/2R3K1 w - - 0 1', title: 'Cold Steel', flavor: 'The rook has only one good square.' },
  { mateIn: 1, fen: '1k6/ppp5/8/8/8/8/8/3R2K1 w - - 0 1', title: 'Queenside Seal', flavor: 'Trapped on the a-file. Strike.' },
  { mateIn: 2, fen: '6k1/5ppp/8/8/8/8/5Q2/5RK1 w - - 0 1', title: 'Quiet Then Loud', flavor: 'A waiting move, then the kill.' },
  { mateIn: 2, fen: '6k1/5ppp/6Q1/8/8/8/8/5RK1 w - - 0 1', title: 'The Pincer', flavor: 'Queen and rook close the trap in two.' },
  { mateIn: 2, fen: '6k1/5ppp/8/7Q/8/8/8/5RK1 w - - 0 1', title: 'From Distance', flavor: 'The queen swoops; the rook finishes.' },
  { mateIn: 2, fen: '6k1/5ppp/5RQ1/8/8/8/8/6K1 w - - 0 1', title: 'Battery', flavor: 'Stacked heavy pieces. Two moves to mate.' },
  { mateIn: 2, fen: '6k1/5ppp/6Q1/8/8/8/5R2/6K1 w - - 0 1', title: 'The Squeeze', flavor: 'Drive the king, then deliver.' },
];

// BATTLE NODES: big, "filled out" positions that need not be realistic chess —
// extra knights, double queens, pieces in odd places. You're ahead but the
// board is crowded and the AI defends hard. Win by checkmate, no move limit.
const BATTLES: Puzzle[] = [
  { fen: 'rnbqkbnr/pppppppp/8/8/8/2QQ4/PPPPPPPP/RNB1KBNR w KQkq - 0 1', title: 'Twin Crowns', flavor: 'Two queens against one. Bury them.' },
  { fen: 'rnbqkbnr/pppppppp/8/8/3QQ3/2NNNN2/PPPPPPPP/R3K2R w KQkq - 0 1', title: 'The Knightmare', flavor: 'A wall of cavalry and twin queens. Break through.' },
  { fen: 'r1bqkb1r/pppppppp/8/8/2NNNN2/3Q1Q2/PPPPPPPP/R3K2R w KQkq - 0 1', title: 'Impossible Army', flavor: 'Four knights, two queens — chess as it was never meant to be.' },
  { fen: '1nbqkbn1/pppppppp/8/8/2BNNB2/2QRRQ2/PPPPPPPP/4K3 w q - 0 1', title: 'The Overwhelming', flavor: 'Every heavy piece you could dream of. Crush the defence.' },
  { fen: 'rnbqkbnr/pp1ppp1p/8/2p3p1/2NNNN2/3QQ3/PPP1PP1P/R3K2R w KQkq - 0 1', title: 'War Without Rules', flavor: 'A sprawling melee. Find the mate in the chaos.' },
];

// ELITE NODES: full-board, slim single-minor edge — long, hard fights.
const ELITE: Puzzle[] = [
  { fen: 'r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', title: 'The Champion of the Wood', flavor: 'A full enemy army, you only a knight ahead. A long fight.' },
  { fen: 'rnbqkb1r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', title: 'Warden of the Gate', flavor: 'Barely ahead against a complete host. Grind it down — or break it with magic.' },
  { fen: 'rn1qkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', title: 'The Iron Marshal', flavor: 'One bishop to the good. Patience and spells win this.' },
];

const BOSS: Puzzle = {
  fen: 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  title: 'The Necromancer',
  flavor: 'Up a queen — but every third turn it drags a fallen soldier back from the grave. Mate it before the dead pile up.',
};

function necromancerHook(engine: BattleEngine): void {
  if (engine.aiMoveCounter % 3 !== 0) return;
  const type = engine.lastAiCapturedType;
  if (!type) return;
  for (const f of 'abcdefgh') {
    const sq = `${f}8`;
    if (engine.enemyPieces().concat(engine.ownPieces()).some((p) => p.square === sq)) continue;
    const next = placePiece(engine.fen(), sq, type as never, AI_COLOR);
    if (next && engine.setFen(next)) {
      engine.log(`The Necromancer resurrects a ${type.toUpperCase()} on ${sq}!`);
      engine.lastAiCapturedType = null;
      return;
    }
  }
}

function pickUnused<T extends Puzzle>(pool: T[], seed: string, used: Set<string>): T {
  const rng = rngFromSeed(seed);
  const fresh = shuffle(rng, pool.filter((p) => !used.has(p.fen)));
  return fresh[0] ?? shuffle(rng, pool)[0];
}

// Puzzle node difficulty: mate-in-1 early, mate-in-2 later / deeper acts.
function mateForNode(node: MapNode, act: number): number {
  return Math.max(1, Math.min(2, 1 + Math.floor(node.row / 3) + (act - 1)));
}

export function buildEncounter(
  node: MapNode,
  seed: string,
  used: Set<string> = new Set(),
  act = 1
): EncounterSetup {
  const key = `${seed}:${node.id}`;
  if (node.type === 'boss') {
    return { fen: BOSS.fen, objective: { type: 'checkmate' }, title: BOSS.title, flavor: BOSS.flavor, bossHook: necromancerHook };
  }
  if (node.type === 'elite') {
    const p = pickUnused(ELITE, key, used);
    return { fen: p.fen, objective: { type: 'checkmate' }, title: p.title, flavor: p.flavor };
  }
  if (node.type === 'puzzle') {
    const want = mateForNode(node, act);
    const pool = MATE_PUZZLES.filter((p) => p.mateIn === want);
    const p = pickUnused(pool.length ? pool : MATE_PUZZLES, key, used);
    return { fen: p.fen, objective: { type: 'mateInN', n: p.mateIn }, title: p.title, flavor: p.flavor };
  }
  // normal battle → crowded checkmate position, no move limit
  const p = pickUnused(BATTLES, key, used);
  return { fen: p.fen, objective: { type: 'checkmate' }, title: p.title, flavor: p.flavor };
}

// Exposed for tests.
export const ALL_MATE_PUZZLES = MATE_PUZZLES;
export const ALL_BATTLE_FENS = [...BATTLES, ...ELITE, BOSS];
export const ALL_PUZZLES: Puzzle[] = [...MATE_PUZZLES, ...BATTLES, ...ELITE, BOSS];
