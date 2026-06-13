import type { MapNode } from '../map/mapTypes';
import type { Objective } from '../engine/objectives';
import type { BattleEngine } from '../engine/BattleEngine';
import { placePiece } from '../engine/fenUtils';
import { AI_COLOR } from '../engine/types';
import { rngFromSeed, pick, type Rng } from '../util/rng';

export interface EncounterSetup {
  fen: string;
  objective: Objective;
  title: string;
  flavor: string;
  bossHook?: (engine: BattleEngine) => void;
}

// Curated "skirmish" positions. Reduced material keeps battles snappy (~6-20
// moves) and the +material objective means you don't need a clean mate. All
// FENs are validated by tests/encounters.test.ts.
const SKIRMISHES: { fen: string; title: string; flavor: string }[] = [
  {
    fen: 'r3k2r/ppp2ppp/2n2n2/3pp3/3PP3/2N2N2/PPP2PPP/R3K2R w - - 0 1',
    title: 'The Crossroads Melee',
    flavor: 'Two warbands collide where the trade roads meet.',
  },
  {
    fen: '4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1',
    title: 'The Pawn Stampede',
    flavor: 'No champions here — only a wall of footsoldiers racing to promote.',
  },
  {
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w - - 0 1',
    title: 'Open Field Battle',
    flavor: 'A classic clash of fully-mustered armies.',
  },
  {
    fen: 'r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1',
    title: 'The Castle Siege',
    flavor: 'Twin keeps, twin towers. Outmaneuver the rooks.',
  },
];

const ELITE: { fen: string; title: string; flavor: string } = {
  fen: '3qk3/pppppppp/8/8/8/8/PPPPPPPP/3QK3 w - - 0 1',
  title: 'Behead the Champion',
  flavor: 'Their queen rallies the line. Cut her down and the rest will break.',
};

const PUZZLE: { fen: string; title: string; flavor: string } = {
  fen: '4k3/8/4K3/8/8/8/8/4R2Q w - - 0 1',
  title: 'The Hunt',
  flavor: 'A lone king flees across open ground. Run it down — fast.',
};

const BOSS: { fen: string; title: string; flavor: string } = {
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  title: 'The Necromancer',
  flavor:
    'Every third turn it drags a fallen soldier back from the grave. End it before the dead overwhelm you.',
};

// The Necromancer boss gimmick: every 3rd AI move, resurrect its most recently
// captured piece on an empty square of its back rank (rank 8).
function necromancerHook(engine: BattleEngine): void {
  if (engine.aiMoveCounter % 3 !== 0) return;
  const type = engine.lastAiCapturedType;
  if (!type) return;
  // find an empty square on rank 8
  const files = 'abcdefgh';
  for (const f of files) {
    const sq = `${f}8`;
    const occupied = engine.enemyPieces().concat(engine.ownPieces()).some((p) => p.square === sq);
    if (occupied) continue;
    const next = placePiece(engine.fen(), sq, type as never, AI_COLOR);
    if (next && engine.setFen(next)) {
      engine.log(`The Necromancer resurrects a ${type.toUpperCase()} on ${sq}!`);
      engine.lastAiCapturedType = null;
      return;
    }
  }
}

export function buildEncounter(node: MapNode, seed: string): EncounterSetup {
  const rng: Rng = rngFromSeed(`${seed}:${node.id}`);
  switch (node.type) {
    case 'elite':
      return {
        fen: ELITE.fen,
        objective: { type: 'captureQueen' },
        title: ELITE.title,
        flavor: ELITE.flavor,
      };
    case 'puzzle':
      return {
        fen: PUZZLE.fen,
        objective: { type: 'checkmate' },
        title: PUZZLE.title,
        flavor: PUZZLE.flavor,
      };
    case 'boss':
      return {
        fen: BOSS.fen,
        objective: { type: 'checkmate' },
        title: BOSS.title,
        flavor: BOSS.flavor,
        bossHook: necromancerHook,
      };
    case 'battle':
    default: {
      const s = pick(rng, SKIRMISHES);
      return {
        fen: s.fen,
        // Win by mate OR by grinding a +4 material edge — keeps it short.
        objective: { type: 'material', advantage: 4 },
        title: s.title,
        flavor: s.flavor,
      };
    }
  }
}
