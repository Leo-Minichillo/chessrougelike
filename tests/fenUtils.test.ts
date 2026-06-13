import { describe, it, expect } from 'vitest';
import {
  validateFen,
  activeColor,
  withActiveColor,
  placePiece,
  removePiece,
} from '../src/engine/fenUtils';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('validateFen', () => {
  it('accepts the start position', () => {
    expect(validateFen(START).ok).toBe(true);
  });

  it('rejects a board missing a king', () => {
    const noBlackKing = 'rnbq1bnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1';
    expect(validateFen(noBlackKing).ok).toBe(false);
  });

  it('rejects a pawn on the back rank', () => {
    const pawnOnRank8 = 'Pnbqkbnr/1ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQk - 0 1';
    expect(validateFen(pawnOnRank8).ok).toBe(false);
  });
});

describe('active color helpers', () => {
  it('reads and re-stamps side to move', () => {
    expect(activeColor(START)).toBe('w');
    const flipped = withActiveColor(START, 'b');
    expect(activeColor(flipped)).toBe('b');
    // en-passant target is cleared when flipping
    expect(flipped.split(' ')[3]).toBe('-');
  });
});

describe('board mutation', () => {
  it('places a piece and validates', () => {
    const fen = placePiece(START, 'e4', 'q', 'w');
    expect(fen).not.toBeNull();
    expect(validateFen(fen!).ok).toBe(true);
  });

  it('removes a piece and validates', () => {
    const fen = removePiece(START, 'a2');
    expect(fen).not.toBeNull();
    expect(validateFen(fen!).ok).toBe(true);
  });

  it('returns null when a mutation would be illegal (removing a king)', () => {
    const fen = removePiece(START, 'e8');
    expect(fen).toBeNull();
  });
});
