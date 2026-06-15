import type { EngineConfig } from './engineConfig';
import type { MoveRequest } from '../engine/types';
import type { EngineRequest, EngineResponse } from './engine.worker';
import { chooseMove } from './minimax';
import { StockfishEngine } from './StockfishEngine';

// How long to wait for the worker before falling back to a main-thread search.
// Puzzle positions have few pieces, so the synchronous fallback is fast.
const WORKER_TIMEOUT_MS = 5000;

// Primary engine: vendored Stockfish (real strength scaling via UCI_Elo).
// Fallback: the bundled minimax worker, then a synchronous main-thread search.
// getBestMove ALWAYS resolves so the AI can never "freeze" on its turn.
export class EngineClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, (move: MoveRequest | null) => void>();
  private workerDead = false;

  private stockfish: StockfishEngine | null = null;

  // The strongest engine we have: Stockfish if it loads, else minimax.
  async getBestMove(fen: string, config: EngineConfig): Promise<MoveRequest | null> {
    if (typeof Worker !== 'undefined' && (!this.stockfish || !this.stockfish.broken)) {
      try {
        if (!this.stockfish) this.stockfish = new StockfishEngine();
        const move = await this.stockfish.getBestMove(fen, config);
        if (move) return move;
      } catch {
        // Stockfish unavailable/slow — fall through to the minimax engine.
      }
    }
    return this.minimaxMove(fen, config);
  }

  constructor() {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), {
          type: 'module',
        });
        this.worker.onmessage = (e: MessageEvent<EngineResponse>) => {
          const resolve = this.pending.get(e.data.id);
          if (resolve) {
            this.pending.delete(e.data.id);
            resolve(e.data.move);
          }
        };
        // If the worker errors at any point, mark it dead so every future call
        // goes straight to the synchronous fallback.
        this.worker.onerror = () => {
          this.workerDead = true;
        };
      } catch {
        this.worker = null;
      }
    }
  }

  private async minimaxMove(fen: string, config: EngineConfig): Promise<MoveRequest | null> {
    if (!this.worker || this.workerDead) {
      return chooseMove(fen, config);
    }
    const id = ++this.seq;
    const req: EngineRequest = { id, fen, config };

    return new Promise((resolve) => {
      let settled = false;
      const finish = (move: MoveRequest | null) => {
        if (settled) return;
        settled = true;
        this.pending.delete(id);
        resolve(move);
      };

      this.pending.set(id, finish);

      // Safety net: if the worker doesn't answer in time (failed to load,
      // crashed, or is wedged), compute the move on the main thread so the AI
      // always plays.
      const timer = setTimeout(() => {
        this.workerDead = true;
        finish(chooseMove(fen, config));
      }, WORKER_TIMEOUT_MS);

      // Wrap resolve so the timer is cleared when the worker answers first.
      this.pending.set(id, (move) => {
        clearTimeout(timer);
        finish(move);
      });

      try {
        this.worker!.postMessage(req);
      } catch {
        clearTimeout(timer);
        this.workerDead = true;
        finish(chooseMove(fen, config));
      }
    });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
    this.stockfish?.dispose();
    this.stockfish = null;
  }
}

// Lazily-created shared client.
let shared: EngineClient | null = null;
export function getEngine(): EngineClient {
  if (!shared) shared = new EngineClient();
  return shared;
}
