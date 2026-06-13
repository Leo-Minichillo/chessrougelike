import type { MoveRequest, Square } from '../engine/types';

// The mutable context every relic hook receives. The live BattleEngine
// implements this interface — relics NEVER touch the raw Chess object, they go
// through these methods so all rule-bending stays validated and centralized.
export interface BattleCtx {
  // current position
  fen(): string;
  // overwrite the board (validated; returns false + fizzles if illegal)
  setFen(fen: string): boolean;

  // queue an extra player move (Time Stutter)
  grantExtraMove(): void;

  // freeze an enemy piece for the next AI turn (Frostbite)
  freeze(square: Square): void;

  // reward bookkeeping
  addGold(amount: number): void;

  // surface a message in the battle log / toast
  log(message: string): void;

  // info helpers
  enemyPieces(): { square: Square; type: string }[];
  ownPieces(): { square: Square; type: string }[];
  emptyBackRankSquares(): Square[];
  ownPawns(): Square[];

  // once-per-battle latch: returns true the FIRST time a key is seen, then
  // false forever after (used by Vampiric Edge and other single-use passives)
  once(key: string): boolean;

  // grant +n charges to every active spell this battle (Stockpile)
  addChargeToAll(n: number): void;
}

export type RelicKind = 'passive' | 'active' | 'upgrade';
export type RelicRarity = 'common' | 'uncommon' | 'rare';
export type TargetKind =
  | 'enemyPiece'
  | 'ownPiece'
  | 'ownPawn'
  | 'emptyBackRank'
  | null;

export interface RelicDef {
  id: string;
  name: string;
  kind: RelicKind;
  rarity: RelicRarity;
  icon: string;
  description: string;
  // active spells: how many times per battle (also the shop default)
  charges?: number;
  // active spells: what the player must click after activating
  requiresTarget?: TargetKind;
  cost?: number; // shop price in gold

  // --- lifecycle hooks (all optional) ---
  onBattleStart?(ctx: BattleCtx): void;
  onPlayerMove?(ctx: BattleCtx, move: MoveRequest, captured: boolean): void;
  onBeforeAiMove?(ctx: BattleCtx): void;
  // active spell effect; `target` present iff requiresTarget is set
  activate?(ctx: BattleCtx, target?: Square): void;
}
