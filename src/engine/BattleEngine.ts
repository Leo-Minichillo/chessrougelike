import { Chess } from 'chess.js';
import {
  AI_COLOR,
  PLAYER_COLOR,
  type MoveRequest,
  type Square,
} from './types';
import {
  validateFen,
  withActiveColor,
  mutateBoard,
} from './fenUtils';
import {
  evaluateObjective,
  materialBalance,
  type Objective,
  type ObjectiveResult,
} from './objectives';
import type { BattleCtx, RelicDef } from '../relics/relicTypes';

export type BattlePhase = 'playerInput' | 'aiThinking' | 'won' | 'lost';

// A relic active during this battle, with its remaining charges.
export interface ActiveRelic {
  def: RelicDef;
  charges: number; // remaining; passives use 0 and are always "on"
}

// BattleEngine is the architectural keystone: it owns the live Chess instance,
// whose-turn / extra-move bookkeeping, the frozen-piece set, relic runtime
// state, and is the ONLY place the board is mutated. It implements BattleCtx so
// relics operate through it. It is a plain mutable class (kept out of the React
// store) — the UI re-renders off `version` + `fen`.
export class BattleEngine implements BattleCtx {
  private chess: Chess;
  readonly objective: Objective;
  readonly relics: ActiveRelic[];

  phase: BattlePhase = 'playerInput';
  version = 0; // bump to signal the UI to re-render
  goldEarned = 0;
  fullMovesPlayed = 0;
  logs: string[] = [];

  private extraMoves = 0;
  private frozen = new Set<Square>();
  private flags = new Set<string>();
  // The most recently captured AI piece, for the Necromancer boss gimmick.
  lastAiCapturedType: string | null = null;
  aiMoveCounter = 0;

  // Optional boss hook, run after each AI move (e.g. Necromancer resurrect).
  bossHook: ((engine: BattleEngine) => void) | null = null;

  constructor(startFen: string, objective: Objective, relics: RelicDef[]) {
    this.chess = new Chess(startFen);
    this.objective = objective;
    this.relics = relics.map((def) => ({
      def,
      charges: def.kind === 'active' ? def.charges ?? 1 : 0,
    }));
    // Run battle-start passives (Stockpile etc.).
    for (const r of this.relics) r.def.onBattleStart?.(this);
    this.refreshResult();
  }

  // ---- BattleCtx implementation -------------------------------------------

  fen(): string {
    return this.chess.fen();
  }

  setFen(fen: string): boolean {
    const v = validateFen(fen);
    if (!v.ok) {
      this.log(`(effect fizzled: ${v.reason})`);
      return false;
    }
    this.chess.load(fen);
    return true;
  }

  grantExtraMove(): void {
    this.extraMoves += 1;
  }

  freeze(square: Square): void {
    this.frozen.add(square);
  }

  addGold(amount: number): void {
    this.goldEarned += amount;
  }

  log(message: string): void {
    this.logs.push(message);
  }

  once(key: string): boolean {
    if (this.flags.has(key)) return false;
    this.flags.add(key);
    return true;
  }

  addChargeToAll(n: number): void {
    for (const r of this.relics) {
      if (r.def.kind === 'active') r.charges += n;
    }
  }

  enemyPieces(): { square: Square; type: string }[] {
    return this.piecesOfColor(AI_COLOR);
  }

  ownPieces(): { square: Square; type: string }[] {
    return this.piecesOfColor(PLAYER_COLOR);
  }

  private piecesOfColor(color: 'w' | 'b') {
    const out: { square: Square; type: string }[] = [];
    for (const row of this.chess.board()) {
      for (const sq of row) {
        if (sq && sq.color === color) out.push({ square: sq.square, type: sq.type });
      }
    }
    return out;
  }

  emptyBackRankSquares(): Square[] {
    // White's back rank is rank 1; board()[7] is that row.
    const out: Square[] = [];
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const row = this.chess.board()[7];
    for (let f = 0; f < 8; f++) {
      if (!row[f]) out.push(`${files[f]}1`);
    }
    return out;
  }

  ownPawns(): Square[] {
    return this.ownPieces().filter((p) => p.type === 'p').map((p) => p.square);
  }

  // ---- battle flow ---------------------------------------------------------

  get currentFen(): string {
    return this.chess.fen();
  }

  // Legal destination squares for a piece, via chess.js (used for highlights).
  legalMovesFrom(square: Square): MoveRequest[] {
    const moves = this.chess.moves({ square: square as never, verbose: true });
    return moves.map((m) => ({
      from: m.from,
      to: m.to,
      promotion: (m.promotion as MoveRequest['promotion']) ?? undefined,
    }));
  }

  isFrozen(square: Square): boolean {
    return this.frozen.has(square);
  }

  frozenSquares(): Square[] {
    return [...this.frozen];
  }

  materialBalance(): number {
    return materialBalance(this.chess.fen());
  }

  // Apply a player (white) move. Returns false if illegal.
  applyPlayerMove(move: MoveRequest): boolean {
    if (this.phase !== 'playerInput') return false;
    let result;
    try {
      result = this.chess.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? 'q',
      });
    } catch {
      return false;
    }
    if (!result) return false;

    const captured = !!result.captured;
    for (const r of this.relics) r.def.onPlayerMove?.(this, move, captured);

    this.fullMovesPlayed += 1;

    // Extra-move bookkeeping: chess.js already flipped side-to-move to black; if
    // the player has a queued extra move, re-stamp it back to white.
    if (this.extraMoves > 0) {
      this.extraMoves -= 1;
      this.chess.load(withActiveColor(this.chess.fen(), PLAYER_COLOR));
      this.log('Time Stutter: take another move!');
    }

    this.refreshResult();
    this.version++;
    return true;
  }

  // Build the FEN handed to the AI: side-to-move = AI, frozen enemy pieces
  // removed so the engine simply never considers moving them. Falls back to the
  // unmodified position if removal would create an illegal board.
  prepareAiFen(): { fen: string; restored: Map<Square, { type: string; color: 'b' }> } {
    let fen = withActiveColor(this.chess.fen(), AI_COLOR);
    const restored = new Map<Square, { type: string; color: 'b' }>();
    for (const sq of this.frozen) {
      const piece = this.chess.get(sq as never);
      if (!piece || piece.color !== AI_COLOR) continue;
      const next = mutateBoard(fen, (c) => c.remove(sq as never));
      if (next) {
        fen = next;
        restored.set(sq, { type: piece.type, color: 'b' });
      }
    }
    return { fen, restored };
  }

  // Apply the AI's chosen move (already computed against prepareAiFen()).
  applyAiMove(
    move: MoveRequest,
    restored: Map<Square, { type: string; color: 'b' }>
  ): void {
    // Run the move against the AI-perspective board so legality matches what the
    // engine searched.
    const aiBoard = new Chess(withActiveColor(this.chess.fen(), AI_COLOR));
    // Remove frozen pieces from this board too so the move is legal here.
    for (const sq of restored.keys()) aiBoard.remove(sq as never);

    let result = null;
    try {
      result = aiBoard.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? 'q',
      });
    } catch {
      result = null;
    }

    let resultFen = aiBoard.fen();
    if (!result) {
      // Engine returned an unusable move; skip the AI turn rather than corrupt.
      this.log('(enemy hesitates)');
    } else if (result.captured) {
      this.lastAiCapturedType = result.captured;
    }

    // Restore frozen pieces onto squares the AI did not move into.
    let rebuilt: string | null = resultFen;
    for (const [sq, piece] of restored) {
      const after = new Chess(rebuilt!);
      if (after.get(sq as never)) {
        this.log('A frozen piece was overrun.');
        continue;
      }
      const next = mutateBoard(rebuilt!, (c) =>
        c.put({ type: piece.type as never, color: 'b' }, sq as never)
      );
      if (next) rebuilt = next;
    }
    // Side-to-move must come back to the player.
    rebuilt = withActiveColor(rebuilt ?? resultFen, PLAYER_COLOR);
    if (validateFen(rebuilt).ok) this.chess.load(rebuilt);

    this.frozen.clear();
    this.aiMoveCounter += 1;
    this.bossHook?.(this);

    this.refreshResult();
    this.version++;
  }

  // Activate an owned active spell. Returns false (and consumes nothing) if it
  // can't fire. Target-requiring spells are validated by the caller/store.
  activateRelic(defId: string, target?: Square): boolean {
    if (this.phase !== 'playerInput') return false;
    const r = this.relics.find((x) => x.def.id === defId);
    if (!r || r.def.kind !== 'active' || r.charges <= 0) return false;
    const before = this.version;
    r.def.activate?.(this, target);
    r.charges -= 1;
    this.refreshResult();
    // Even no-op-looking spells (Time Stutter) count as a state change.
    if (this.version === before) this.version++;
    return true;
  }

  chargesFor(defId: string): number {
    return this.relics.find((x) => x.def.id === defId)?.charges ?? 0;
  }

  result(): ObjectiveResult {
    return evaluateObjective(this.objective, {
      fen: this.chess.fen(),
      fullMovesPlayed: this.fullMovesPlayed,
    });
  }

  // Recompute phase from the objective result + whose turn it is.
  private refreshResult(): void {
    const res = this.result();
    if (res === 'win') {
      this.phase = 'won';
      return;
    }
    if (res === 'loss') {
      this.phase = 'lost';
      return;
    }
    this.phase = this.chess.turn() === PLAYER_COLOR ? 'playerInput' : 'aiThinking';
  }
}
