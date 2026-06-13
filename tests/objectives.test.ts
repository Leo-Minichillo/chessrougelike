import { describe, it, expect } from 'vitest';
import { evaluateObjective, materialBalance } from '../src/engine/objectives';

describe('materialBalance', () => {
  it('is even at the start', () => {
    expect(materialBalance('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(0);
  });
  it('is positive when the player (white) is up material', () => {
    // black is missing its queen
    expect(
      materialBalance('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    ).toBe(9);
  });
});

describe('evaluateObjective', () => {
  it('material objective wins at the threshold', () => {
    const fen = 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(evaluateObjective({ type: 'material', advantage: 4 }, { fen, fullMovesPlayed: 3 })).toBe(
      'win'
    );
    expect(
      evaluateObjective({ type: 'material', advantage: 12 }, { fen, fullMovesPlayed: 3 })
    ).toBe('ongoing');
  });

  it('captureQueen wins when the black queen is gone', () => {
    const fen = 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(evaluateObjective({ type: 'captureQueen' }, { fen, fullMovesPlayed: 1 })).toBe('win');
  });

  it('detects checkmate of the player as a loss', () => {
    // Fool's mate: white is checkmated, white to move
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(evaluateObjective({ type: 'checkmate' }, { fen, fullMovesPlayed: 2 })).toBe('loss');
  });

  it('survive objective succeeds after N moves', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(evaluateObjective({ type: 'survive', moves: 5 }, { fen, fullMovesPlayed: 5 })).toBe(
      'win'
    );
    expect(evaluateObjective({ type: 'survive', moves: 5 }, { fen, fullMovesPlayed: 2 })).toBe(
      'ongoing'
    );
  });
});
