import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { BattleEngine } from '../src/engine/BattleEngine';
import { getRelic } from '../src/relics/relicDefs';
import { validateFen } from '../src/engine/fenUtils';
import type { Objective } from '../src/engine/objectives';

const NEVER: Objective = { type: 'survive', moves: 999 };
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Build a battle with the given spells (run-level charges) and no passives.
function withSpell(fen: string, id: string, charges = 2) {
  return new BattleEngine(fen, NEVER, [], [{ def: getRelic(id), charges }]);
}
// Build a battle with the given passive relics and no spells.
function withPassive(fen: string, id: string) {
  return new BattleEngine(fen, NEVER, [getRelic(id)], []);
}

describe('Time Stutter (extra move)', () => {
  it('lets the player move twice before the AI', () => {
    const e = withSpell(START, 'time-stutter');
    expect(e.activateRelic('time-stutter')).toBe(true);
    e.applyPlayerMove({ from: 'e2', to: 'e4' });
    // still the player's turn thanks to the extra move
    expect(e.phase).toBe('playerInput');
    e.applyPlayerMove({ from: 'd2', to: 'd4' });
    // now it's the AI's turn
    expect(e.phase).toBe('aiThinking');
    expect(e.chargesFor('time-stutter')).toBe(1);
  });
});

describe('Frostbite (freeze) yields a legal AI position', () => {
  it('removes the frozen enemy piece from the FEN handed to the AI', () => {
    const e = withSpell(START, 'frostbite');
    e.activateRelic('frostbite', 'e7');
    const { fen } = e.prepareAiFen();
    expect(validateFen(fen).ok).toBe(true);
    expect(new Chess(fen).get('e7' as never)).toBeFalsy();
    expect(fen.split(' ')[1]).toBe('b'); // AI to move
  });
});

describe('Class-2 relics produce legal boards', () => {
  it('Conscript summons a knight on an empty back-rank square', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1';
    const e = withSpell(fen, 'conscript');
    e.activateRelic('conscript', 'b1');
    expect(validateFen(e.currentFen).ok).toBe(true);
    expect(new Chess(e.currentFen).get('b1' as never)?.type).toBe('n');
  });

  it('Banish removes an enemy piece', () => {
    const e = withSpell(START, 'banish');
    e.activateRelic('banish', 'e7');
    expect(validateFen(e.currentFen).ok).toBe(true);
    expect(new Chess(e.currentFen).get('e7' as never)).toBeFalsy();
  });

  it('Battlefield Promotion turns a pawn into a queen', () => {
    const e = withSpell(START, 'battlefield-promotion');
    e.activateRelic('battlefield-promotion', 'e2');
    expect(validateFen(e.currentFen).ok).toBe(true);
    expect(new Chess(e.currentFen).get('e2' as never)?.type).toBe('q');
  });
});

describe('king capture is an instant win', () => {
  it('Time Stutter into a check wins immediately', () => {
    // White Q can check the black king; with an extra move we take the king.
    const e = withSpell('7k/8/8/8/8/8/8/Q6K w - - 0 1', 'time-stutter');
    e.activateRelic('time-stutter');
    e.applyPlayerMove({ from: 'a1', to: 'a8' }); // Qa8+ — check, then bonus move
    expect(e.phase).toBe('won');
  });

  it('a spell that exposes the king (Banish a blocker) wins immediately', () => {
    // Removing the a7 pawn opens the a-file: the rook attacks the black king
    // while it is still White's move -> king capture.
    const e = withSpell('k7/p7/8/8/8/8/8/R6K w - - 0 1', 'banish');
    e.activateRelic('banish', 'a7');
    expect(e.phase).toBe('won');
  });
});

describe('Tithe + Vampiric Edge passives', () => {
  it('Tithe grants gold on a capture', () => {
    // white pawn d4 can take black pawn e5
    const fen = 'k7/8/8/4p3/3P4/8/8/K7 w - - 0 1';
    const e = withPassive(fen, 'tithe');
    e.applyPlayerMove({ from: 'd4', to: 'e5' });
    expect(e.goldEarned).toBe(5);
  });

  it('Vampiric Edge drains an adjacent enemy pawn on the first capture', () => {
    const fen = 'k7/8/3p4/4p3/3P4/8/8/K7 w - - 0 1';
    const e = withPassive(fen, 'vampiric-edge');
    e.applyPlayerMove({ from: 'd4', to: 'e5' }); // captures e5; d6 is adjacent
    const enemyPawns = e.enemyPieces().filter((p) => p.type === 'p');
    expect(enemyPawns.length).toBe(0);
    expect(validateFen(e.currentFen).ok).toBe(true);
  });
});
