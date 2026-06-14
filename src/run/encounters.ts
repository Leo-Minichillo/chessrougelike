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

// Real, composed "mate in N" puzzles on deliberately sparse / unusual boards
// (these are not positions you'd reach in a normal game). Each is a FORCED mate
// for White against best defence — verified by tests/puzzles.test.ts using the
// mate solver. Normal and puzzle nodes draw from here, with a move limit.
const MATE_PUZZLES: MatePuzzle[] = [
  // ---- mate in 1 ----
  { mateIn: 1, fen: '3k4/3Q4/3K4/8/8/8/8/8 w - - 0 1', title: 'Face to Face', flavor: 'King opposes king. One blow ends it.' },
  { mateIn: 1, fen: 'k7/2K5/8/8/8/8/8/R7 w - - 0 1', title: 'Corner Trap', flavor: 'The enemy king is wedged in the corner. Strike.' },
  { mateIn: 1, fen: '7k/8/7K/8/8/8/8/Q7 w - - 0 1', title: 'The Guillotine', flavor: 'One queen, one move, one fallen king.' },
  { mateIn: 1, fen: '4k3/8/4K3/8/8/8/7Q/8 w - - 0 1', title: 'Opposition', flavor: 'Your king holds the line. Let the queen fall.' },
  { mateIn: 1, fen: '7k/8/6K1/8/8/8/8/R7 w - - 0 1', title: 'Edge of the World', flavor: 'Driven to the rim. Finish the job.' },
  { mateIn: 1, fen: '3k4/8/3K4/8/8/8/8/7R w - - 0 1', title: 'The Long File', flavor: 'A single rook, perfectly placed.' },
  // ---- mate in 2 ----
  { mateIn: 2, fen: 'k7/8/2K5/8/8/8/8/7Q w - - 0 1', title: 'The Net Tightens', flavor: 'Two precise moves and the corner becomes a tomb.' },
  { mateIn: 2, fen: '6k1/8/5K2/8/8/8/8/7Q w - - 0 1', title: 'Two to Fall', flavor: 'Herd the king, then deliver the blow.' },
  { mateIn: 2, fen: 'k7/2K4Q/8/8/8/8/8/8 w - - 0 1', title: 'Royal Pursuit', flavor: 'The queen closes the last escape.' },
  { mateIn: 2, fen: 'k7/8/3K4/8/8/8/8/7Q w - - 0 1', title: 'Closing In', flavor: 'Find the quiet move, then the kill.' },
  { mateIn: 2, fen: 'k7/8/2K5/8/8/8/8/4Q3 w - - 0 1', title: 'The Coffin', flavor: 'Seal every square. Two moves.' },
  { mateIn: 2, fen: '7k/8/5K2/8/8/8/8/Q7 w - - 0 1', title: 'Long Range', flavor: 'The queen rules from afar.' },
  { mateIn: 2, fen: 'k7/8/2K5/8/8/8/8/1R6 w - - 0 1', title: "Rook's Gambit", flavor: 'A lone rook, and a king with nowhere to run.' },
  { mateIn: 2, fen: '6k1/8/5K2/8/8/8/8/7R w - - 0 1', title: "The Ladder's End", flavor: 'Two rungs from checkmate.' },
  { mateIn: 2, fen: 'k7/8/2KQ4/8/8/8/8/8 w - - 0 1', title: 'Smother', flavor: 'King and queen, hand in glove.' },
  // ---- mate in 3 ----
  { mateIn: 3, fen: 'k7/1R6/2K5/8/8/8/8/8 w - - 0 1', title: 'The Long Walk', flavor: 'Pure technique — rook and king drive the quarry to mate.' },
  { mateIn: 3, fen: '7k/6R1/5K2/8/8/8/8/8 w - - 0 1', title: 'Endgame Mastery', flavor: 'Three exact moves. No room for error.' },
];

// Elite battles: full boards (so the game runs long) with only a slim, single-
// minor advantage — hard, drawn-out fights that reward spending spells.
const ELITE: Puzzle[] = [
  { fen: 'r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', title: 'The Champion of the Wood', flavor: 'A full enemy army, and you only a knight ahead. A long fight.' },
  { fen: 'rnbqkb1r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', title: 'Warden of the Gate', flavor: 'Barely ahead against a complete host. Grind it down — or break it with magic.' },
  { fen: 'rn1qkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', title: 'The Iron Marshal', flavor: 'One bishop to the good, nothing else. Patience and spells win this.' },
];

const BOSS: Puzzle = {
  fen: 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  title: 'The Necromancer',
  flavor:
    'Up a queen — but every third turn it drags a fallen soldier back from the grave. Mate it before the dead pile up.',
};

function necromancerHook(engine: BattleEngine): void {
  if (engine.aiMoveCounter % 3 !== 0) return;
  const type = engine.lastAiCapturedType;
  if (!type) return;
  const files = 'abcdefgh';
  for (const f of files) {
    const sq = `${f}8`;
    const occupied = engine
      .enemyPieces()
      .concat(engine.ownPieces())
      .some((p) => p.square === sq);
    if (occupied) continue;
    const next = placePiece(engine.fen(), sq, type as never, AI_COLOR);
    if (next && engine.setFen(next)) {
      engine.log(`The Necromancer resurrects a ${type.toUpperCase()} on ${sq}!`);
      engine.lastAiCapturedType = null;
      return;
    }
  }
}

// How tough a mate to demand at a node: ramps with map depth and act; the
// dedicated puzzle node is always the hardest (mate in 3).
function mateForNode(node: MapNode, act: number): number {
  if (node.type === 'puzzle') return 3;
  return Math.max(1, Math.min(3, 1 + Math.floor(node.row / 3) + (act - 1)));
}

function pickMate(mateIn: number, seed: string, used: Set<string>): MatePuzzle {
  const rng = rngFromSeed(seed);
  // try the requested difficulty, then adjacent ones, preferring unused
  const order = [mateIn, mateIn - 1, mateIn + 1, mateIn - 2, mateIn + 2].filter(
    (n) => n >= 1 && n <= 3
  );
  for (const n of order) {
    const pool = shuffle(rng, MATE_PUZZLES.filter((p) => p.mateIn === n && !used.has(p.fen)));
    if (pool.length) return pool[0];
  }
  return shuffle(rng, MATE_PUZZLES.filter((p) => p.mateIn === mateIn))[0] ?? MATE_PUZZLES[0];
}

export function buildEncounter(
  node: MapNode,
  seed: string,
  used: Set<string> = new Set(),
  act = 1
): EncounterSetup {
  if (node.type === 'boss') {
    return {
      fen: BOSS.fen,
      objective: { type: 'checkmate' },
      title: BOSS.title,
      flavor: BOSS.flavor,
      bossHook: necromancerHook,
    };
  }
  if (node.type === 'elite') {
    const rng = rngFromSeed(`${seed}:${node.id}:elite`);
    const pool = shuffle(rng, ELITE.filter((p) => !used.has(p.fen)));
    const puzzle = pool[0] ?? shuffle(rng, ELITE)[0];
    return { fen: puzzle.fen, objective: { type: 'checkmate' }, title: puzzle.title, flavor: puzzle.flavor };
  }
  // normal battle or puzzle node → a move-limited mate puzzle
  const mateIn = mateForNode(node, act);
  const p = pickMate(mateIn, `${seed}:${node.id}`, used);
  return {
    fen: p.fen,
    objective: { type: 'mateInN', n: p.mateIn },
    title: p.title,
    flavor: p.flavor,
  };
}

// Exposed for tests.
export const ALL_MATE_PUZZLES = MATE_PUZZLES;
export const ALL_PUZZLES: Puzzle[] = [...MATE_PUZZLES, ...ELITE, BOSS];
