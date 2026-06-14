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

// Every battle is a "White to mate" puzzle. You start ahead and must checkmate a
// defending AI — these are NOT one-move mates. Difficulty escalates by tier:
// lower tiers hand you a crushing material edge, higher tiers a slim one (or a
// crowded board) where you'll want to spend spells (Banish a defender, Conscript
// an attacker, Time Stutter for tempo) to break through. All positions are
// validated in tests (legal, White to move, not terminal, White ahead).
const TIERS: Record<number, Puzzle[]> = {
  1: [
    {
      fen: 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      title: 'Queenslayer',
      flavor: 'They march to war without their queen. Convert the edge into mate.',
    },
    {
      fen: 'r3k3/8/8/8/8/8/4PPPP/R2QK2R w KQ - 0 1',
      title: 'Overrun',
      flavor: 'Queen and two rooks against a lone tower. Hunt the king down.',
    },
  ],
  2: [
    {
      fen: '1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQk - 0 1',
      title: 'The Missing Tower',
      flavor: 'A rook to the good. Now turn material into a mating net.',
    },
    {
      fen: 'rnbqkbn1/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQq - 0 1',
      title: 'Castle Felled',
      flavor: 'Their right flank is undefended. Pour through it.',
    },
  ],
  3: [
    {
      fen: 'r2qkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      title: 'Broken Vanguard',
      flavor: 'Up a bishop and a knight — but the board is full. Find the king.',
    },
    {
      fen: 'rnbqk2r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      title: 'Kingside Collapse',
      flavor: 'Their king has lost its shield. Strike before they regroup.',
    },
  ],
  4: [
    {
      fen: 'r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      title: "A Knight's Edge",
      flavor: 'Only a single piece ahead against a full army. You may need help.',
    },
    {
      fen: 'rn1qkbnr/pppp1ppp/8/8/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
      title: 'Open Lines',
      flavor: 'A bishop up, the centre cracked open. Aim everything at the king.',
    },
  ],
  5: [
    {
      fen: 'r1bqkbnr/pppp1ppp/8/8/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
      title: 'Slim Margin',
      flavor: 'Barely ahead, the board crowded. Without your spells, this is grim.',
    },
    {
      fen: 'rn1qkbnr/pp4pp/8/8/8/8/PP4PP/RNBQKBNR w KQkq - 0 1',
      title: 'The Long Diagonal',
      flavor: 'An open, brutal position. Spend a spell, or be ground down.',
    },
  ],
};

// Elite battles: full boards (so the game runs long) with only a slim, single-
// minor advantage (so they're genuinely hard and reward spending spells). Paired
// with a big Elo bump in eloMapping.
const ELITE: Puzzle[] = [
  {
    fen: 'r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    title: 'The Champion of the Wood',
    flavor: 'A full enemy army, and you only a knight ahead. This will be a long fight.',
  },
  {
    fen: 'rnbqkb1r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    title: 'Warden of the Gate',
    flavor: 'Barely ahead against a complete host. Grind it down — or break it with magic.',
  },
  {
    fen: 'rn1qkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    title: 'The Iron Marshal',
    flavor: 'One bishop to the good, nothing else. Patience and spells win this.',
  },
];

// Boss position (paired with the Necromancer gimmick): you are up a queen, but
// every third turn it revives a fallen piece, so the edge erodes — mate fast.
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

const MAX_TIER = 5;

// Difficulty tier for a node: battles ramp with map depth and act; elites and
// the dedicated puzzle node are harder.
export function tierForNode(node: MapNode, act: number): number {
  const actBump = act - 1;
  let tier: number;
  if (node.type === 'elite') tier = 3 + Math.floor(node.row / 3) + actBump;
  else if (node.type === 'puzzle') tier = 4 + actBump;
  else tier = 1 + Math.floor(node.row / 2) + actBump;
  return Math.max(1, Math.min(MAX_TIER, tier));
}

// Pick a puzzle of the given tier that the player hasn't seen this run; fall
// back to a wider/already-seen pool only if necessary.
function pickPuzzle(tier: number, seed: string, used: Set<string>): Puzzle {
  const rng = rngFromSeed(seed);
  // search the target tier, then expand outward, preferring unused puzzles
  const order: number[] = [tier];
  for (let d = 1; d < MAX_TIER; d++) {
    if (tier - d >= 1) order.push(tier - d);
    if (tier + d <= MAX_TIER) order.push(tier + d);
  }
  for (const t of order) {
    const unused = shuffle(rng, TIERS[t].filter((p) => !used.has(p.fen)));
    if (unused.length > 0) return unused[0];
  }
  // everything seen — just return something from the target tier
  return shuffle(rng, TIERS[Math.max(1, Math.min(MAX_TIER, tier))])[0];
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
    // Pick an unused elite if possible, else any.
    const rng = rngFromSeed(`${seed}:${node.id}:elite`);
    const pool = shuffle(rng, ELITE.filter((p) => !used.has(p.fen)));
    const puzzle = pool[0] ?? shuffle(rng, ELITE)[0];
    return {
      fen: puzzle.fen,
      objective: { type: 'checkmate' },
      title: puzzle.title,
      flavor: puzzle.flavor,
    };
  }
  const tier = tierForNode(node, act);
  const puzzle = pickPuzzle(tier, `${seed}:${node.id}`, used);
  return {
    fen: puzzle.fen,
    objective: { type: 'checkmate' }, // every battle is won by checkmate
    title: puzzle.title,
    flavor: puzzle.flavor,
  };
}

export const ALL_PUZZLES: Puzzle[] = [...Object.values(TIERS).flat(), ...ELITE, BOSS];
