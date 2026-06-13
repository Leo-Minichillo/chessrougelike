import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Served from https://<user>.github.io/chessrougelike/ in CI; keep local
  // dev/build at the root path.
  base: process.env.GITHUB_PAGES ? '/chessrougelike/' : '/',
  // If you later swap the bundled minimax AI for a multithreaded stockfish.wasm
  // build, uncomment these headers to enable SharedArrayBuffer (cross-origin
  // isolation). The default single-threaded engine does NOT need them.
  // server: {
  //   headers: {
  //     'Cross-Origin-Opener-Policy': 'same-origin',
  //     'Cross-Origin-Embedder-Policy': 'require-corp',
  //   },
  // },
  test: {
    globals: true,
    environment: 'node',
  },
});
