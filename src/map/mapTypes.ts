// A Slay-the-Spire-style branching map: a DAG arranged in rows. The player
// starts below row 0 and must reach the single boss node on the last row,
// moving one row at a time along edges.

export type NodeType = 'battle' | 'elite' | 'shop' | 'event' | 'puzzle' | 'boss';

export interface MapNode {
  id: string;
  type: NodeType;
  row: number; // 0 = first row of choices
  col: number; // column slot within its row (for layout)
  edges: string[]; // ids of reachable nodes in the next row
  visited: boolean;
}

export interface MapGraph {
  rows: MapNode[][];
}

export const NODE_LABEL: Record<NodeType, string> = {
  battle: 'Battle',
  elite: 'Elite',
  shop: 'Shop',
  event: 'Event',
  puzzle: 'Puzzle',
  boss: 'BOSS',
};

export const NODE_ICON: Record<NodeType, string> = {
  battle: '⚔️',
  elite: '💀',
  shop: '🛒',
  event: '❓',
  puzzle: '🧩',
  boss: '👑',
};
