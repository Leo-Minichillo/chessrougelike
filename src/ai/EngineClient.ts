import type { EngineConfig } from './engineConfig';
import type { MoveRequest } from '../engine/types';
import type { EngineRequest, EngineResponse } from './engine.worker';
import { chooseMove } from './minimax';

// Promise-based wrapper around the AI worker. A single worker is reused across
// the whole run. If Workers are unavailable (e.g. unit tests / SSR), it falls
// back to running the search synchronously on the main thread.
export class EngineClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, (move: MoveRequest | null) => void>();

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
      } catch {
        this.worker = null;
      }
    }
  }

  async getBestMove(fen: string, config: EngineConfig): Promise<MoveRequest | null> {
    if (!this.worker) {
      // Synchronous fallback.
      return chooseMove(fen, config);
    }
    const id = ++this.seq;
    const req: EngineRequest = { id, fen, config };
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker!.postMessage(req);
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
