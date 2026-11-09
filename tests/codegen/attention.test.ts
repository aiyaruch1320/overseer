import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AttentionFile } from '../../src/core/data/types-attention';
import { readDoc } from '../../scripts/codegen/lib/table';

const A = (JSON.parse(readFileSync('data/gen/attention.json', 'utf8')) as AttentionFile).items;
const sim = readFileSync('scripts/sim/sim-attention.mjs', 'utf8');

describe('attention generator: counts the doc states', () => {
  it('three levels, six principles, twelve triggers, five targets, four sim rows', () => {
    expect(A.levels.map((l) => l.id)).toEqual(['stop', 'card', 'log']);
    expect(A.principles.length).toBe(6);
    expect(A.triggers.length).toBe(12);
    expect(A.targets.length).toBe(5);
    expect(A.simResults.length).toBe(4);
    expect(A.ageStops).toEqual([5, 15, 30, 50, 70]);
  });
  it('the three settings differ as the doc says', () => {
    expect(A.settings.normal).toMatchObject({ stopGap: 180, cardGap: 60, merge: 60, stopWait: 60, windows: true });
    expect(A.settings.low).toMatchObject({ stopGap: 300, cardGap: 120, windows: false, cards: ['prayer', 'crisis', 'majorOmen'] });
    expect(A.settings.high).toMatchObject({ stopGap: 90, cardGap: 30, windows: true });
  });
  it('targets: stops 6-10, cards 12-22, bursts ≤ 10%, silence ≤ 6 min, lost cards ≤ 3', () => {
    expect(A.targets.map((t) => [t.min, t.max])).toEqual([[6, 10], [12, 22], [null, 10], [null, 6], [null, 3]]);
  });
});

describe('attention generator: the values sim-attention.mjs uses agree with the JSON', () => {
  it('RULE', () => {
    const m = sim.match(/const RULE = \{([^}]*)\.\.\.JSON/);
    const rule = new Function(`return ({${m![1]}})`)();
    expect(rule).toEqual({ stopGap: A.rule.stopGap, merge: A.rule.merge, cardGap: A.rule.cardGap, stopWait: A.rule.stopWait });
  });
  it('FEW and MANY settings', () => {
    expect(sim).toContain(`stopGap: ${A.settings.low.stopGap}, cardGap: ${A.settings.low.cardGap}, windows: false, cards: ['prayer', 'crisis', 'majorOmen']`);
    expect(sim).toContain(`stopGap: ${A.settings.high.stopGap}, cardGap: ${A.settings.high.cardGap}`);
  });
  it('trigger rates and deadlines', () => {
    expect(A.rates.window).toBeCloseTo(32 * (123 / 745), 9);
    expect(A.rates.prayer).toBeCloseTo(4 * (0.8 * 0.035 + 0.2 * 0.105), 9);
    expect(A.rates.omen).toBe(3.2);
    expect(A.rates.majorOmen).toBe(0.06);
    expect(A.rates.battle).toBe(3);
    expect(A.rates.crisis).toBe(1.5);
    expect(sim).toContain('omen: 3.2');
    expect(sim).toContain('majorOmen: 0.06');
    expect(sim).toContain('battle: 3,');
    expect(sim).toContain('crisis: 1.5,');
    expect(sim).toContain('const DEADLINE = { prayer: 14 / 4, omen: 2, battle: 2, crisis: 2, majorOmen: 1 }');
    expect(A.deadlines).toEqual({ prayer: 14 / 4, omen: 2, battle: 2, crisis: 2, majorOmen: 1 });
  });
  it('life length and early death', () => {
    expect(sim).toContain('const LIFE_MIN = 35');
    expect(A.lifeMinutes.sim).toBe(35);
    expect(A.lifeMinutes.min).toBeLessThanOrEqual(35);
    expect(A.lifeMinutes.max).toBeGreaterThanOrEqual(35);
    expect(sim).toContain('r() < 0.004');
    expect(A.earlyDeath.perYear).toBe(0.004);
  });
});

describe('attention generator: a row against the doc', () => {
  it('the budget row of the sim table is kept as written', () => {
    const budget = A.simResults.find((r) => r.rule === 'งบการเรียก')!;
    expect(budget.cells[0]).toBe('7 · 8');
    expect(readDoc('docs/systems/experience/07-attention.md')).toContain('| งบการเรียก | 7 · 8 | 14 · 18 | 0.63 |');
  });
});

// ---------- review M0-b fixes: L5 ----------
describe('attention rates say what they count (L5)', () => {
  it('every rate has a unit; only the prayer tick is per life year', () => {
    expect(Object.keys(A.ratePer).sort()).toEqual(Object.keys(A.rates).sort());
    expect(A.ratePer).toEqual({ window: 'life', prayer: 'lifeYear', omen: 'life', majorOmen: 'life', battle: 'life', crisis: 'life' });
  });
  it('per life year × life years is the doc count per life ("ราว 16")', () => {
    expect(A.rates.prayer * A.lifeYears).toBeGreaterThan(14);
    expect(A.rates.prayer * A.lifeYears).toBeLessThan(17);
    expect(sim).toContain('RATE.prayer * 75');
    expect(sim).toContain('4 * (0.8 * 0.035 + 0.2 * 0.105), // per life-year');
  });
  it('the per-life rates are the counts the trigger table states', () => {
    expect(Math.round(A.rates.window)).toBe(5);
    expect([A.rates.omen, A.rates.battle, A.rates.crisis, A.rates.majorOmen]).toEqual([3.2, 3, 1.5, 0.06]);
    expect(readDoc('docs/systems/experience/07-attention.md')).toContain('| คำอธิษฐาน | การ์ด | ราว 16 |');
  });
});
