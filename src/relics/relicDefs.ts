import type { RelicDef } from './relicTypes';
import { placePiece, removePiece } from '../engine/fenUtils';
import type { Square } from '../engine/types';

// File / rank helpers for adjacency (Vampiric Edge).
const FILES = 'abcdefgh';
function adjacentSquares(sq: Square): Square[] {
  const f = FILES.indexOf(sq[0]);
  const r = parseInt(sq[1], 10);
  const out: Square[] = [];
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const nf = f + df;
      const nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 1 && nr <= 8) out.push(`${FILES[nf]}${nr}`);
    }
  }
  return out;
}

// The data-driven relic table. Adding a relic is pure data — no engine changes.
export const RELICS: RelicDef[] = [
  // ---- PASSIVES -----------------------------------------------------------
  {
    id: 'tithe',
    name: 'Tithe',
    kind: 'passive',
    rarity: 'common',
    icon: '🪙',
    cost: 40,
    description: 'Gain 5 gold each time you capture an enemy piece.',
    onPlayerMove(ctx, _move, captured) {
      if (captured) {
        ctx.addGold(5);
        ctx.log('Tithe: +5 gold.');
      }
    },
  },
  {
    id: 'reliquary',
    name: 'Reliquary',
    kind: 'passive',
    rarity: 'rare',
    icon: '🔮',
    cost: 80,
    description: 'After each victory, restore 1 charge to every spell you own.',
    // Effect is applied at the run level after a win (see useGameStore), since
    // spell charges persist across battles rather than refilling each fight.
  },
  {
    id: 'bloodlust',
    name: 'Bloodlust',
    kind: 'passive',
    rarity: 'uncommon',
    icon: '🩸',
    cost: 70,
    description: 'Every 3rd piece you capture in a battle grants you an extra move.',
    onPlayerMove(ctx, _move, captured) {
      if (captured && ctx.tick('bloodlust') % 3 === 0) {
        ctx.grantExtraMove();
        ctx.log('Bloodlust: the slaughter fuels you — move again!');
      }
    },
  },
  {
    id: 'momentum',
    name: 'Momentum',
    kind: 'passive',
    rarity: 'uncommon',
    icon: '🌀',
    cost: 65,
    description: 'Every 4th move you make grants an extra move.',
    onPlayerMove(ctx) {
      if (ctx.tick('momentum') % 4 === 0) {
        ctx.grantExtraMove();
        ctx.log('Momentum: you flow into another move!');
      }
    },
  },
  {
    id: 'saboteur',
    name: 'Saboteur',
    kind: 'passive',
    rarity: 'rare',
    icon: '🕷️',
    cost: 85,
    description: 'At the start of each battle, freeze an enemy piece (its queen if it has one).',
    onBattleStart(ctx) {
      const enemies = ctx.enemyPieces().filter((p) => p.type !== 'k');
      if (enemies.length === 0) return;
      const target = enemies.find((p) => p.type === 'q') ?? enemies[0];
      ctx.freeze(target.square);
      ctx.log(`Saboteur: froze the enemy ${target.type.toUpperCase()} on ${target.square}.`);
    },
  },
  {
    id: 'plunder',
    name: 'Plunder',
    kind: 'passive',
    rarity: 'common',
    icon: '💰',
    cost: 45,
    description: 'Gain 15 bonus gold every battle you win.',
    onBattleStart(ctx) {
      // goldEarned is only banked on victory, so this effectively rewards wins.
      ctx.addGold(15);
    },
  },
  {
    id: 'quartz-heart',
    name: 'Quartz Heart',
    kind: 'passive',
    rarity: 'rare',
    icon: '💎',
    cost: 90,
    description: 'Gain +1 maximum heart (and heal 1) when acquired.',
    // Applied at the run level when picked up (see useGameStore.grantOption).
  },
  {
    id: 'vampiric-edge',
    name: 'Vampiric Edge',
    kind: 'passive',
    rarity: 'uncommon',
    icon: '🦇',
    cost: 60,
    description:
      'The first piece you capture each battle also destroys an adjacent enemy pawn.',
    onPlayerMove(ctx, move, captured) {
      if (!captured) return;
      if (!ctx.once('vampiric-edge')) return;
      const enemyPawns = ctx.enemyPieces().filter((p) => p.type === 'p');
      const adj = new Set(adjacentSquares(move.to));
      const victim = enemyPawns.find((p) => adj.has(p.square));
      if (!victim) return;
      const next = removePiece(ctx.fen(), victim.square);
      if (next && ctx.setFen(next)) {
        ctx.log(`Vampiric Edge: drained the pawn on ${victim.square}.`);
      }
    },
  },

  // ---- ACTIVE SPELLS ------------------------------------------------------
  {
    id: 'time-stutter',
    name: 'Time Stutter',
    kind: 'active',
    rarity: 'rare',
    icon: '⏳',
    charges: 2,
    cost: 90,
    requiresTarget: null,
    description: 'Take two moves in a row.',
    activate(ctx) {
      ctx.grantExtraMove();
      ctx.log('Time Stutter: the clock stutters — move again!');
    },
  },
  {
    id: 'frostbite',
    name: 'Frostbite',
    kind: 'active',
    rarity: 'uncommon',
    icon: '❄️',
    charges: 2,
    cost: 65,
    requiresTarget: 'enemyPiece',
    description: 'Freeze an enemy piece — it cannot move on the next enemy turn.',
    activate(ctx, target) {
      if (!target) return;
      ctx.freeze(target);
      ctx.log(`Frostbite: froze the piece on ${target}.`);
    },
  },
  {
    id: 'conscript',
    name: 'Conscript',
    kind: 'active',
    rarity: 'uncommon',
    icon: '🐴',
    charges: 2,
    cost: 70,
    requiresTarget: 'emptyBackRank',
    description: 'Summon a knight on any empty square of your back rank.',
    activate(ctx, target) {
      if (!target) return;
      const next = placePiece(ctx.fen(), target, 'n', 'w');
      if (next && ctx.setFen(next)) {
        ctx.log(`Conscript: a knight answers the call on ${target}.`);
      }
    },
  },
  {
    id: 'battlefield-promotion',
    name: 'Battlefield Promotion',
    kind: 'active',
    rarity: 'rare',
    icon: '⭐',
    charges: 2,
    cost: 95,
    requiresTarget: 'ownPawn',
    description: 'Instantly promote one of your pawns to a queen.',
    activate(ctx, target) {
      if (!target) return;
      const next = placePiece(ctx.fen(), target, 'q', 'w');
      if (next && ctx.setFen(next)) {
        ctx.log(`Battlefield Promotion: a hero rises on ${target}!`);
      }
    },
  },
  {
    id: 'banish',
    name: 'Banish',
    kind: 'active',
    rarity: 'rare',
    icon: '💥',
    charges: 2,
    cost: 110,
    requiresTarget: 'enemyPiece',
    description: 'Remove one enemy piece from the board. (Cannot target the king.)',
    activate(ctx, target) {
      if (!target) return;
      const next = removePiece(ctx.fen(), target);
      if (next && ctx.setFen(next)) {
        ctx.log(`Banish: the piece on ${target} is cast out.`);
      }
    },
  },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(
  RELICS.map((r) => [r.id, r])
);

export function getRelic(id: string): RelicDef {
  const r = RELIC_BY_ID[id];
  if (!r) throw new Error(`unknown relic: ${id}`);
  return r;
}

// Passive relics vs active spells, for reward/shop pools.
export const PASSIVE_RELICS = RELICS.filter((r) => r.kind === 'passive');
export const SPELLS = RELICS.filter((r) => r.kind === 'active');
