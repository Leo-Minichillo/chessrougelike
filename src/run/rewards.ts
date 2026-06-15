import { PASSIVE_RELICS, SPELLS, getRelic } from '../relics/relicDefs';
import type { RelicDef } from '../relics/relicTypes';
import type { RunState } from './runState';
import { rngFromSeed, shuffle, type Rng } from '../util/rng';

export const HEAL_COST = 35;
export const RECHARGE_COST = 30;

// A reward / shop offer is either a passive relic or a spell (which grants
// charges). Spells you already own simply stack more charges.
export interface RewardOption {
  kind: 'relic' | 'spell';
  def: RelicDef;
}
export interface ShopItem extends RewardOption {
  cost: number;
}

// Gold awarded for clearing a node, by type.
export function nodeGoldReward(type: string): number {
  switch (type) {
    case 'elite':
      return 45;
    case 'boss':
      return 100;
    default:
      return 22;
  }
}

function ownedRelicIds(run: RunState): Set<string> {
  return new Set(run.relics.map((r) => r.defId));
}

// Build a pool of offers: passive relics the player lacks, plus all spells
// (spells can always be offered to top up charges).
function offerPool(run: RunState): RewardOption[] {
  const ownedRelics = ownedRelicIds(run);
  // Don't offer a spell the player already holds as a permanent per-battle boon
  // (buying charges for it would be wasted — it refreshes for free).
  const permanentSpells = new Set(run.spells.filter((s) => s.perBattle).map((s) => s.defId));
  const relics: RewardOption[] = PASSIVE_RELICS.filter((r) => !ownedRelics.has(r.id)).map(
    (def) => ({ kind: 'relic', def })
  );
  const spells: RewardOption[] = SPELLS.filter((d) => !permanentSpells.has(d.id)).map((def) => ({
    kind: 'spell',
    def,
  }));
  return [...relics, ...spells];
}

// Offer up to 3 reward choices after a battle.
export function rollReward(run: RunState, nodeId: string): RewardOption[] {
  const rng = rngFromSeed(`${run.seed}:reward:${nodeId}`);
  return shuffle(rng, offerPool(run)).slice(0, 3);
}

// Shop stock: a few offers with prices.
export function rollShop(run: RunState, nodeId: string): ShopItem[] {
  const rng: Rng = rngFromSeed(`${run.seed}:shop:${nodeId}`);
  return shuffle(rng, offerPool(run))
    .slice(0, 4)
    .map((o) => ({ ...o, cost: o.def.cost ?? 50 }));
}

// The starting boon: 3 choices, each more powerful than a standard item — a
// strong/legendary passive relic, OR a spell you can cast TWICE every battle
// that never depletes. Picked on the boon screen at run start.
const BOON_SPELL_IDS = ['time-stutter', 'banish', 'conscript', 'frostbite'];
const BOON_RELIC_IDS = ['archmage', 'warlord', 'saboteur', 'reliquary'];

export function rollBoons(seed: string): RewardOption[] {
  const rng = rngFromSeed(`${seed}:boons`);
  const spells: RewardOption[] = BOON_SPELL_IDS.map((id) => ({ kind: 'spell', def: getRelic(id) }));
  const relics: RewardOption[] = BOON_RELIC_IDS.map((id) => ({ kind: 'relic', def: getRelic(id) }));
  // offer at least one spell and one relic, plus a third wildcard
  const s = shuffle(rng, spells);
  const r = shuffle(rng, relics);
  return shuffle(rng, [s[0], r[0], rng() < 0.5 ? s[1] : r[1]]);
}
