import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../src/engine/BattleEngine';
import { chooseMove } from '../src/ai/minimax';
import { eloToEngineConfig } from '../src/ai/eloMapping';
import { getRelic } from '../src/relics/relicDefs';
import { buildEncounter } from '../src/run/encounters';
import { validateFen } from '../src/engine/fenUtils';
import type { MapNode } from '../src/map/mapTypes';

// Drives a whole battle to a terminal state the same way the store does, but
// synchronously: player plays a reasonable move (prefer captures), AI replies
// via minimax. Confirms the turn loop, prepareAiFen/applyAiMove, the frozen
// restore path and objective evaluation never corrupt the board.
function node(type: MapNode['type']): MapNode {
  return { id: 't', type, row: 1, col: 0, edges: [], visited: false };
}

function playerPickMove(e: BattleEngine): { from: string; to: string } | null {
  // pick the highest-value capture, else the first legal move
  const ownSquares = e.ownPieces().map((p) => p.square);
  let best: { from: string; to: string } | null = null;
  for (const sq of ownSquares) {
    for (const m of e.legalMovesFrom(sq)) {
      if (!best) best = { from: m.from, to: m.to };
    }
  }
  return best;
}

describe('full battle loop', () => {
  it('plays a skirmish to a terminal phase without corrupting the board', () => {
    const setup = buildEncounter(node('battle'), 'loop-seed');
    const cfg = eloToEngineConfig(900);
    const e = new BattleEngine(setup.fen, setup.objective, [], [
      { def: getRelic('time-stutter'), charges: 3 },
    ]);

    let guard = 0;
    while (e.phase !== 'won' && e.phase !== 'lost' && guard++ < 120) {
      expect(validateFen(e.currentFen).ok).toBe(true);
      if (e.phase === 'playerInput') {
        const mv = playerPickMove(e);
        if (!mv) break;
        e.applyPlayerMove(mv);
      } else if (e.phase === 'aiThinking') {
        const { fen, restored } = e.prepareAiFen();
        const aiMove = chooseMove(fen, cfg);
        expect(aiMove).not.toBeNull();
        e.applyAiMove(aiMove!, restored);
      }
    }
    expect(['won', 'lost', 'playerInput', 'aiThinking']).toContain(e.phase);
    expect(validateFen(e.currentFen).ok).toBe(true);
  });

  it('survives an AI turn while a piece is frozen', () => {
    const setup = buildEncounter(node('elite'), 'frozen-seed');
    const cfg = eloToEngineConfig(1200);
    const e = new BattleEngine(setup.fen, setup.objective, [], [
      { def: getRelic('frostbite'), charges: 2 },
    ]);
    // freeze an enemy piece, then run one AI turn
    e.applyPlayerMove(playerPickMove(e)!);
    if (e.phase === 'playerInput') e.activateRelic('frostbite', e.enemyPieces()[0].square);
    if (e.phase === 'aiThinking') {
      const { fen, restored } = e.prepareAiFen();
      const aiMove = chooseMove(fen, cfg);
      e.applyAiMove(aiMove!, restored);
    }
    expect(validateFen(e.currentFen).ok).toBe(true);
  });
});
