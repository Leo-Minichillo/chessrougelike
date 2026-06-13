import type { EngineConfig } from './engineConfig';
import type { MoveRequest } from '../engine/types';
import type { EngineRequest, EngineResponse } from './engine.worker';
import { chooseMove } from './minimax';

// How long to wait for the worker before falling back to a main-thread search.
// Puzzle positions have few pieces, so the synchronous fallback is fast.
const WORKER_TIMEOUT_MS = 5000;

// Promise-based wrapper around the AI worker. A single worker is reused across
// the whole run. The worker is treated as a best-effort accelerator: if it
// fails to load, errors, or is slow to answer, getBestMove ALWAYS resolves by
// computing the move synchronously on the main thread. This guarantees the AI
// can never "freeze" on its turn (the bug where a hung worker stalled play).
export class EngineClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, (move: MoveRequest | null) => void>();
  private workerDead = false;

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

  async getBestMove(fen: string, config: EngineConfig): Promise<MoveRequest | null> {
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
  }
}

// Lazily-created shared client.
let shared: EngineClient | null = null;
export function getEngine(): EngineClient {
  if (!shared) shared = new EngineClient();
  return shared;
}
