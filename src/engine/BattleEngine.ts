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

// An active spell during this battle, carrying its RUN-LEVEL remaining charges
// (the engine mutates this copy; the store persists it back after the battle).
export interface BattleSpell {
  def: RelicDef;
  charges: number;
}

// BattleEngine is the architectural keystone: it owns the live Chess instance,
// whose-turn / extra-move bookkeeping, the frozen-piece set, relic runtime
// state, and is the ONLY place the board is mutated. It implements BattleCtx so
// relics operate through it. It is a plain mutable class (kept out of the React
// store) — the UI re-renders off `version` + `fen`.
export class BattleEngine implements BattleCtx {
  private chess: Chess;
  readonly objective: Objective;
  readonly passives: RelicDef[]; // always-on relics
  readonly spells: BattleSpell[]; // active spells with run-level charges

  phase: BattlePhase = 'playerInput';
  version = 0; // bump to signal the UI to re-render
  goldEarned = 0;
  fullMovesPlayed = 0;
  logs: string[] = [];

  private extraMoves = 0;
  private frozen = new Set<Square>();
  private flags = new Set<string>();
  // Set when the player engineers a position where they would capture the enemy
  // king (e.g. give check then take an extra move). This is an instant win and
  // sidesteps chess.js rejecting the (technically illegal) king-en-prise FEN.
  kingCaptured = false;
  // The most recent move (either side), for board highlighting.
  lastMove: { from: Square; to: Square } | null = null;
  // The most recently captured AI piece, for the Necromancer boss gimmick.
  lastAiCapturedType: string | null = null;
  aiMoveCounter = 0;

  // Optional boss hook, run after each AI move (e.g. Necromancer resurrect).
  bossHook: ((engine: BattleEngine) => void) | null = null;

  constructor(
    startFen: string,
    objective: Objective,
    passives: RelicDef[],
    spells: BattleSpell[]
  ) {
    this.chess = new Chess(startFen);
    this.objective = objective;
    this.passives = passives;
    // Copy spell charges so mutating them here doesn't touch run state directly.
    this.spells = spells.map((s) => ({ def: s.def, charges: s.charges }));
    for (const r of this.passives) r.onBattleStart?.(this);
    this.refreshResult();
  }

  // ---- BattleCtx implementation -------------------------------------------

  fen(): string {
    return this.chess.fen();
  }

  setFen(fen: string): boolean {
    // King-capture win: a spell left the enemy king in check while it is still
    // our move (e.g. Banish the only defender of a pinned king). chess.js would
    // reject this as illegal, so instead we declare victory and store the
    // position with the AI to move (which renders fine, king shown in check).
    if (this.aiKingInCheck(fen)) {
      this.chess.load(withActiveColor(fen, AI_COLOR));
      this.kingCaptured = true;
      this.log('The enemy king stands exposed — you capture it!');
      return true;
    }
    const v = validateFen(fen);
    if (!v.ok) {
      this.log(`(effect fizzled: ${v.reason})`);
      return false;
    }
    this.chess.load(fen);
    return true;
  }

  // Would the AI king be capturable in this (player-to-move) position? True if
  // the AI king is in check — restamp to the AI side (legal even when in check)
  // and ask chess.js.
  private aiKingInCheck(playerToMoveFen: string): boolean {
    try {
      return new Chess(withActiveColor(playerToMoveFen, AI_COLOR)).inCheck();
    } catch {
      return false;
    }
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

  // Square of the king currently in check (for the board's check highlight),
  // or null if nobody is in check.
  checkedKingSquare(): Square | null {
    if (!this.chess.inCheck()) return null;
    const side = this.chess.turn();
    for (const row of this.chess.board()) {
      for (const sq of row) {
        if (sq && sq.type === 'k' && sq.color === side) return sq.square;
      }
    }
    return null;
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

    this.lastMove = { from: move.from, to: move.to };
    const captured = !!result.captured;
    for (const r of this.passives) r.onPlayerMove?.(this, move, captured);

    this.fullMovesPlayed += 1;

    // Extra-move bookkeeping. chess.js already flipped side-to-move to the AI.
    if (this.extraMoves > 0) {
      this.extraMoves -= 1;
      if (this.chess.inCheck()) {
        // The move gave check and we get to move again — we simply take the
        // king. Instant win (leave the board as-is: AI to move, king in check).
        this.kingCaptured = true;
        this.log('You seize the moment and capture the enemy king!');
      } else {
        // Re-stamp side-to-move back to the player for the bonus move.
        this.chess.load(withActiveColor(this.chess.fen(), PLAYER_COLOR));
        this.log('Time Stutter: take another move!');
      }
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
    } else {
      this.lastMove = { from: move.from, to: move.to };
      if (result.captured) this.lastAiCapturedType = result.captured;
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

  // Cast an owned spell. Returns false (and consumes nothing) if it can't fire.
  // Target-requiring spells are validated by the caller/store.
  activateRelic(defId: string, target?: Square): boolean {
    if (this.phase !== 'playerInput') return false;
    const s = this.spells.find((x) => x.def.id === defId);
    if (!s || s.charges <= 0) return false;
    const before = this.version;
    s.def.activate?.(this, target);
    s.charges -= 1;
    this.refreshResult();
    // Even no-op-looking spells (Time Stutter) count as a state change.
    if (this.version === before) this.version++;
    return true;
  }

  chargesFor(defId: string): number {
    return this.spells.find((x) => x.def.id === defId)?.charges ?? 0;
  }

  // Remaining spell charges, for the store to persist back to run state.
  spellCharges(): { defId: string; charges: number }[] {
    return this.spells.map((s) => ({ defId: s.def.id, charges: s.charges }));
  }

  result(): ObjectiveResult {
    return evaluateObjective(this.objective, {
      fen: this.chess.fen(),
      fullMovesPlayed: this.fullMovesPlayed,
    });
  }

  // Re-evaluate the terminal state without making a move. Called when the AI
  // has no legal move (checkmate / stalemate) so the battle resolves instead of
  // looping on the AI's turn.
  resolveTerminal(): void {
    this.refreshResult();
    this.version++;
  }

  // Recompute phase from the objective result + whose turn it is.
  private refreshResult(): void {
    if (this.kingCaptured) {
      this.phase = 'won';
      return;
    }
    const res = this.result();
    if (res === 'win') {
      this.phase = 'won';
      return;
    }
    if (res === 'loss') {
      this.phase = 'lost';
      return;
    }
    // Safety: if the side to move has no legal moves but the objective didn't
    // already resolve, the game is over (mate/stalemate) — never sit in a
    // thinking state the engine can't escape.
    if (this.chess.isGameOver()) {
      this.phase = this.chess.isCheckmate() && this.chess.turn() === AI_COLOR ? 'won' : 'lost';
      return;
    }
    this.phase = this.chess.turn() === PLAYER_COLOR ? 'playerInput' : 'aiThinking';
  }
}
