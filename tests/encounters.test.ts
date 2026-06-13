import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { generateMap, findNode, availableNodes } from '../src/map/mapGen';
import { buildEncounter } from '../src/run/encounters';
import { validateFen } from '../src/engine/fenUtils';
import { chooseMove } from '../src/ai/minimax';
import { eloToEngineConfig } from '../src/ai/eloMapping';
import type { NodeType } from '../src/map/mapTypes';

describe('encounter positions', () => {
  const types: NodeType[] = ['battle', 'elite', 'puzzle', 'boss'];
  for (const type of types) {
    it(`${type} starts from a legal, white-to-move position`, () => {
      const setup = buildEncounter(
        { id: 'x', type, row: 1, col: 0, edges: [], visited: false },
        'seed'
      );
      expect(validateFen(setup.fen).ok).toBe(true);
      const c = new Chess(setup.fen);
      expect(c.turn()).toBe('w');
      expect(c.isGameOver()).toBe(false);
    });
  }
});

describe('map generation', () => {
  it('is reproducible for the same seed', () => {
    const a = JSON.stringify(generateMap('abc'));
    const b = JSON.stringify(generateMap('abc'));
    expect(a).toBe(b);
  });

  it('ends in a single boss node and every node is reachable', () => {
    const map = generateMap('reachable-seed');
    const last = map.rows[map.rows.length - 1];
    expect(last.length).toBe(1);
    expect(last[0].type).toBe('boss');

    // BFS from the virtual start (row 0) and confirm all nodes are reached.
    const seen = new Set<string>();
    let frontier = availableNodes(map, null).map((n) => n.id);
    frontier.forEach((id) => seen.add(id));
    while (frontier.length) {
      const next: string[] = [];
      for (const id of frontier) {
        const node = findNode(map, id)!;
        for (const e of node.edges) {
          if (!seen.has(e)) {
            seen.add(e);
            next.push(e);
          }
        }
      }
      frontier = next;
    }
    const total = map.rows.reduce((s, r) => s + r.length, 0);
    expect(seen.size).toBe(total);
  });
});

describe('minimax engine', () => {
  it('returns a legal move for the side to move', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const move = chooseMove(fen, eloToEngineConfig(2000));
    expect(move).not.toBeNull();
    const c = new Chess(fen);
    const legal = c.moves({ verbose: true }).some((m) => m.from === move!.from && m.to === move!.to);
    expect(legal).toBe(true);
  });

  it('captures a free queen at high strength', () => {
    // White rook on a1 can capture an undefended black queen on a8.
    const fen = 'q3k3/8/8/8/8/8/8/R3K3 w - - 0 1';
    const move = chooseMove(fen, eloToEngineConfig(2600));
    expect(move).toEqual(expect.objectContaining({ from: 'a1', to: 'a8' }));
  });
});
