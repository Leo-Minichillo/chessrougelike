import { describe, it, expect } from 'vitest';
import {
  eloToEngineConfig,
  computeEncounterElo,
  nodeEloBonus,
} from '../src/ai/eloMapping';

describe('eloToEngineConfig', () => {
  it('uses skill-level band below the UCI floor', () => {
    const c = eloToEngineConfig(600);
    expect(c.useLimitStrength).toBe(false);
    expect(c.skillLevel).toBeGreaterThanOrEqual(0);
    expect(c.skillLevel).toBeLessThanOrEqual(19);
  });

  it('uses the UCI limiter in the calibrated band', () => {
    const c = eloToEngineConfig(1800);
    expect(c.useLimitStrength).toBe(true);
    expect(c.uciElo).toBe(1800);
    expect(c.skillLevel).toBe(20);
  });

  it('clamps uciElo to 2800 at the top', () => {
    const c = eloToEngineConfig(3000);
    expect(c.uciElo).toBe(2800);
  });

  it('weaker ratings get more randomness and blunders than stronger ones', () => {
    const weak = eloToEngineConfig(500);
    const strong = eloToEngineConfig(2200);
    expect(weak.randomness).toBeGreaterThan(strong.randomness);
    expect(weak.blunderChance).toBeGreaterThan(strong.blunderChance);
    expect(strong.depth).toBeGreaterThanOrEqual(weak.depth);
  });

  it('keeps depth within MVP bounds', () => {
    for (const elo of [200, 800, 1500, 2400, 2800]) {
      const c = eloToEngineConfig(elo);
      expect(c.depth).toBeGreaterThanOrEqual(1);
      expect(c.depth).toBeLessThanOrEqual(4);
    }
  });
});

describe('encounter escalation', () => {
  it('elites and bosses are harder than normal battles', () => {
    expect(nodeEloBonus({ type: 'battle', row: 0 })).toBeLessThan(
      nodeEloBonus({ type: 'elite', row: 0 })
    );
    expect(nodeEloBonus({ type: 'boss', row: 7 })).toBeGreaterThan(
      nodeEloBonus({ type: 'battle', row: 7 })
    );
  });

  it('battles run the AI at roughly twice the player rating', () => {
    const eff = computeEncounterElo({ baseElo: 900, act: 1 }, { type: 'battle', row: 0 });
    expect(eff).toBeGreaterThanOrEqual(900 * 2);
  });

  it('elites are harder than battles, bosses hardest', () => {
    const battle = computeEncounterElo({ baseElo: 1000, act: 1 }, { type: 'battle', row: 3 });
    const elite = computeEncounterElo({ baseElo: 1000, act: 1 }, { type: 'elite', row: 3 });
    const boss = computeEncounterElo({ baseElo: 1000, act: 1 }, { type: 'boss', row: 3 });
    expect(elite).toBeGreaterThan(battle);
    expect(boss).toBeGreaterThan(elite);
  });

  it('ramps battle difficulty with map depth', () => {
    const early = computeEncounterElo({ baseElo: 1000, act: 1 }, { type: 'battle', row: 0 });
    const late = computeEncounterElo({ baseElo: 1000, act: 1 }, { type: 'battle', row: 6 });
    expect(late).toBeGreaterThan(early);
  });

  it('later acts are harder', () => {
    const a1 = computeEncounterElo({ baseElo: 1000, act: 1 }, { type: 'battle', row: 0 });
    const a3 = computeEncounterElo({ baseElo: 1000, act: 3 }, { type: 'battle', row: 0 });
    expect(a3).toBeGreaterThan(a1);
  });
});
