import type { EngineConfig } from './engineConfig';
import type { MoveRequest } from '../engine/types';

// Adapter around the vendored Stockfish 11 (asm.js/WASM) UCI engine running as a
// classic Web Worker. It implements the same getBestMove() contract as the
// bundled minimax, so EngineClient can prefer it and fall back if it fails.
//
// Stockfish gives REAL strength scaling: UCI_Elo lets the AI actually play up to
// ~2850, which the minimax (≈depth-3) could never reach.
export class StockfishEngine {
  private worker: Worker;
  private ready = false;
  private readyWaiters: (() => void)[] = [];
  private pending: ((m: MoveRequest | null) => void) | null = null;
  broken = false;

  constructor() {
    // Classic worker (the engine uses importScripts); the .wasm is fetched
    // co-located with this script, so the base path is handled automatically.
    const url = `${import.meta.env.BASE_URL}stockfish/stockfish.js`;
    this.worker = new Worker(url);
    this.worker.onmessage = (e: MessageEvent) => {
      const line: string = typeof e.data === 'string' ? e.data : (e.data && e.data.data) || '';
      this.onLine(line);
    };
    this.worker.onerror = () => {
      this.broken = true;
      this.flushReady();
      if (this.pending) {
        const cb = this.pending;
        this.pending = null;
        cb(null);
      }
    };
    this.send('uci');
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private flushReady() {
    const w = this.readyWaiters;
    this.readyWaiters = [];
    w.forEach((r) => r());
  }

  private onLine(line: string) {
    if (!line) return;
    if (line.includes('uciok')) {
      this.ready = true;
      this.flushReady();
    } else if (line.startsWith('bestmove')) {
      const cb = this.pending;
      this.pending = null;
      cb?.(parseBestmove(line));
    }
  }

  private waitReady(timeoutMs: number): Promise<boolean> {
    if (this.ready) return Promise.resolve(true);
    if (this.broken) return Promise.resolve(false);
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(this.ready), timeoutMs);
      this.readyWaiters.push(() => {
        clearTimeout(t);
        resolve(this.ready);
      });
    });
  }

  // Resolves with the engine's move, or rejects so the caller can fall back.
  async getBestMove(fen: string, config: EngineConfig): Promise<MoveRequest | null> {
    if (this.broken) throw new Error('stockfish unavailable');
    const ok = await this.waitReady(8000);
    if (!ok) {
      this.broken = true;
      throw new Error('stockfish failed to initialise');
    }
    if (this.pending) throw new Error('stockfish busy');

    return new Promise<MoveRequest | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending) {
          this.pending = null;
          this.broken = true;
          reject(new Error('stockfish timed out'));
        }
      }, config.movetimeMs + 5000);

      this.pending = (m) => {
        clearTimeout(timer);
        resolve(m);
      };

      if (config.useLimitStrength && config.uciElo) {
        this.send('setoption name UCI_LimitStrength value true');
        this.send(`setoption name UCI_Elo value ${Math.round(config.uciElo)}`);
      } else {
        this.send('setoption name UCI_LimitStrength value false');
        this.send(`setoption name Skill Level value ${config.skillLevel ?? 20}`);
      }
      this.send('ucinewgame');
      this.send(`position fen ${fen}`);
      this.send(`go movetime ${Math.max(50, Math.round(config.movetimeMs))}`);
    });
  }

  dispose() {
    this.worker.terminate();
  }
}

// "bestmove e7e8q ponder ..." -> { from:'e7', to:'e8', promotion:'q' }
function parseBestmove(line: string): MoveRequest | null {
  const m = line.split(/\s+/)[1];
  if (!m || m === '(none)' || m.length < 4) return null;
  const from = m.slice(0, 2);
  const to = m.slice(2, 4);
  const promotion = m.length > 4 ? (m[4] as MoveRequest['promotion']) : undefined;
  return { from, to, promotion };
}
