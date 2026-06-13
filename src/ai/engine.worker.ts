/// <reference lib="webworker" />
import { chooseMove } from './minimax';
import type { EngineConfig } from './engineConfig';
import type { MoveRequest } from '../engine/types';

// Web Worker entry: keeps the (potentially deep) search off the UI thread so the
// board stays responsive while the AI "thinks". Speaks a tiny request/response
// protocol. A stockfish.wasm worker could be dropped in here with the same
// message shape.

export interface EngineRequest {
  id: number;
  fen: string;
  config: EngineConfig;
}
export interface EngineResponse {
  id: number;
  move: MoveRequest | null;
}

self.onmessage = (e: MessageEvent<EngineRequest>) => {
  const { id, fen, config } = e.data;
  const move = chooseMove(fen, config);
  const res: EngineResponse = { id, move };
  (self as unknown as Worker).postMessage(res);
};
