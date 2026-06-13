import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { BattleEngine } from '../src/engine/BattleEngine';
import { getRelic } from '../src/relics/relicDefs';
import { validateFen } from '../src/engine/fenUtils';
import type { Objective } from '../src/engine/objectives';

const NEVER: Objective = { type: 'survive', moves: 999 };
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('Time Stutter (extra move)', () => {
  it('lets the player move twice before the AI', () => {
    const e = new BattleEngine(START, NEVER, [getRelic('time-stutter')]);
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
    const e = new BattleEngine(START, NEVER, [getRelic('frostbite')]);
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
    const e = new BattleEngine(fen, NEVER, [getRelic('conscript')]);
    e.activateRelic('conscript', 'b1');
    expect(validateFen(e.currentFen).ok).toBe(true);
    expect(new Chess(e.currentFen).get('b1' as never)?.type).toBe('n');
  });

  it('Banish removes an enemy piece', () => {
    const e = new BattleEngine(START, NEVER, [getRelic('banish')]);
    e.activateRelic('banish', 'e7');
    expect(validateFen(e.currentFen).ok).toBe(true);
    expect(new Chess(e.currentFen).get('e7' as never)).toBeFalsy();
  });

  it('Battlefield Promotion turns a pawn into a queen', () => {
    const e = new BattleEngine(START, NEVER, [getRelic('battlefield-promotion')]);
    e.activateRelic('battlefield-promotion', 'e2');
    expect(validateFen(e.currentFen).ok).toBe(true);
    expect(new Chess(e.currentFen).get('e2' as never)?.type).toBe('q');
  });
});

describe('Tithe + Vampiric Edge passives', () => {
  it('Tithe grants gold on a capture', () => {
    // white pawn d4 can take black pawn e5
    const fen = 'k7/8/8/4p3/3P4/8/8/K7 w - - 0 1';
    const e = new BattleEngine(fen, NEVER, [getRelic('tithe')]);
    e.applyPlayerMove({ from: 'd4', to: 'e5' });
    expect(e.goldEarned).toBe(5);
  });

  it('Vampiric Edge drains an adjacent enemy pawn on the first capture', () => {
    const fen = 'k7/8/3p4/4p3/3P4/8/8/K7 w - - 0 1';
    const e = new BattleEngine(fen, NEVER, [getRelic('vampiric-edge')]);
    e.applyPlayerMove({ from: 'd4', to: 'e5' }); // captures e5; d6 is adjacent
    const enemyPawns = e.enemyPieces().filter((p) => p.type === 'p');
    expect(enemyPawns.length).toBe(0);
    expect(validateFen(e.currentFen).ok).toBe(true);
  });
});
