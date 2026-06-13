import { RELICS } from '../relics/relicDefs';
import type { RelicDef } from '../relics/relicTypes';
import type { OwnedRelic, RunState } from './runState';
import { rngFromSeed, shuffle } from '../util/rng';

// Gold awarded for clearing a node, by type.
export function nodeGoldReward(type: string): number {
  switch (type) {
    case 'elite':
      return 40;
    case 'boss':
      return 100;
    default:
      return 20;
  }
}

function ownedIds(run: RunState): Set<string> {
  return new Set(run.relics.map((r) => r.defId));
}

// Offer up to 3 relics the player doesn't already own.
export function rollRelicReward(run: RunState, nodeId: string): RelicDef[] {
  const owned = ownedIds(run);
  const pool = RELICS.filter((r) => !owned.has(r.id));
  const rng = rngFromSeed(`${run.seed}:reward:${nodeId}`);
  return shuffle(rng, pool).slice(0, 3);
}

// Shop stock: a few unowned relics with prices.
export function rollShop(run: RunState, nodeId: string): RelicDef[] {
  const owned = ownedIds(run);
  const pool = RELICS.filter((r) => !owned.has(r.id));
  const rng = rngFromSeed(`${run.seed}:shop:${nodeId}`);
  return shuffle(rng, pool).slice(0, 4);
}

export const HEAL_COST = 35;

// Convert a RelicDef into the owned form (with its battle charge budget).
export function toOwned(def: RelicDef): OwnedRelic {
  return { defId: def.id, maxCharges: def.kind === 'active' ? def.charges ?? 1 : 0 };
}
