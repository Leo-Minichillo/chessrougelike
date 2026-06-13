import type { MapGraph, MapNode, NodeType } from './mapTypes';
import { rngFromSeed, randInt, weightedPick, type Rng } from '../util/rng';

// Generates a Slay-the-Spire-style DAG for one act: ROWS rows, each with a few
// node slots, edges connecting a node to 1-2 nodes in the next row, and a single
// boss as the final row. Seeded for reproducibility.

const ROWS = 7; // rows of choices before the boss row
const MIN_PER_ROW = 2;
const MAX_PER_ROW = 4;

function rollType(rng: Rng, row: number): NodeType {
  // Row 0 is always plain battles to ease the player in.
  if (row === 0) return 'battle';
  // One guaranteed elite around the middle is handled separately.
  return weightedPick<NodeType>(rng, [
    ['battle', 55],
    ['shop', 12],
    ['event', 14],
    ['puzzle', 9],
    ['elite', 10],
  ]);
}

export function generateMap(seed: string): MapGraph {
  const rng = rngFromSeed(seed + ':map');
  const rows: MapNode[][] = [];

  for (let row = 0; row < ROWS; row++) {
    const count = randInt(rng, MIN_PER_ROW, MAX_PER_ROW);
    const nodes: MapNode[] = [];
    for (let col = 0; col < count; col++) {
      nodes.push({
        id: `n${row}_${col}`,
        type: rollType(rng, row),
        row,
        col,
        edges: [],
        visited: false,
      });
    }
    rows.push(nodes);
  }

  // Guarantee at least one elite in the back half.
  const eliteRow = randInt(rng, Math.floor(ROWS / 2), ROWS - 1);
  const eliteNodes = rows[eliteRow];
  eliteNodes[randInt(rng, 0, eliteNodes.length - 1)].type = 'elite';

  // Boss row: single node.
  const boss: MapNode = {
    id: 'boss',
    type: 'boss',
    row: ROWS,
    col: 0,
    edges: [],
    visited: false,
  };
  rows.push([boss]);

  // Wire edges: each node connects to 1-2 adjacent-column nodes next row.
  for (let row = 0; row < ROWS; row++) {
    const next = rows[row + 1];
    for (const node of rows[row]) {
      const fraction = next.length > 1 ? node.col / Math.max(1, rows[row].length - 1) : 0;
      const center = Math.round(fraction * (next.length - 1));
      const targets = new Set<number>();
      targets.add(clampIdx(center, next.length));
      if (rng() < 0.5) targets.add(clampIdx(center + (rng() < 0.5 ? 1 : -1), next.length));
      node.edges = [...targets].map((i) => next[i].id);
    }
  }

  // Ensure every next-row node is reachable (connect orphans to nearest prev).
  for (let row = 1; row <= ROWS; row++) {
    const prev = rows[row - 1];
    for (let i = 0; i < rows[row].length; i++) {
      const id = rows[row][i].id;
      const reachable = prev.some((p) => p.edges.includes(id));
      if (!reachable) {
        const fraction = rows[row].length > 1 ? i / (rows[row].length - 1) : 0;
        const pIdx = clampIdx(Math.round(fraction * (prev.length - 1)), prev.length);
        prev[pIdx].edges.push(id);
      }
    }
  }

  return { rows };
}

function clampIdx(i: number, len: number): number {
  return Math.max(0, Math.min(len - 1, i));
}

// Flatten lookup.
export function findNode(map: MapGraph, id: string): MapNode | null {
  for (const row of map.rows) {
    for (const n of row) if (n.id === id) return n;
  }
  return null;
}

// The nodes the player may move to from their current position.
export function availableNodes(map: MapGraph, currentId: string | null): MapNode[] {
  if (currentId === null) return map.rows[0];
  const cur = findNode(map, currentId);
  if (!cur) return [];
  return cur.edges.map((id) => findNode(map, id)!).filter(Boolean);
}
