import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EconomyFile } from '../../src/core/data/types-economy';
import type { ItemsFile } from '../../src/core/data/types-items';
import { readDoc } from '../../scripts/codegen/lib/table';

const E = (JSON.parse(readFileSync('data/gen/economy.json', 'utf8')) as EconomyFile).items;
const I = (JSON.parse(readFileSync('data/gen/items.json', 'utf8')) as ItemsFile).items;

describe('economy generator: counts the docs state', () => {
  it('9 goods, 9 routes, 75 world events, 5 classes, 20 class rows, 25 start-item rows, 8 regimes, 9 channels, P0..P7', () => {
    expect(E.goods.length).toBe(9);
    expect(E.routes.length).toBe(9);
    expect(E.worldEvents.length).toBe(75);
    expect(E.classes.length).toBe(5);
    expect(E.classByWG.length).toBe(20);
    expect(E.startItems.length).toBe(25);
    expect(E.regimes.length).toBe(8);
    expect(E.investment.channels.length).toBe(9);
    expect(E.implementation.steps.map((s) => s.id)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']);
    expect(E.wLevels.map((w) => w.w)).toEqual([1, 2, 3, 4, 5]);
  });
  it('class birth rows add up to 100 and cover W 1..5 × four inequality levels', () => {
    for (const r of E.classByWG) expect(r.pct.reduce((a, b) => a + b, 0), `${r.w} ${r.g}`).toBe(100);
    expect(new Set(E.classByWG.map((r) => r.w)).size).toBe(5);
    expect(new Set(E.classByWG.map((r) => r.g))).toEqual(new Set(['ต่ำ', 'กลาง', 'สูง', 'สูงมาก']));
  });
  it('start-item rows add up to 100', () => {
    for (const r of E.startItems) expect(Object.values(r.pct).reduce((a, b) => a + b, 0), `${r.cls} ${r.w}`).toBe(100);
  });
});

describe('economy generator: numbers the docs and sim-gold use', () => {
  it('income base, indexes, class multipliers, living, trust', () => {
    expect(E.income.base).toEqual({ C: 14, U: 22, R: 36, E: 70 });
    expect(E.income.wIncomeIndex).toEqual([0.5, 0.75, 1, 1.4, 1.9]);
    expect(E.priceMods.wIndex).toEqual([0.7, 0.85, 1, 1.2, 1.5]);
    expect(E.income.classMul).toEqual({ bondless: 0.2, low: 0.8, common: 1, rich: 1.5 });
    expect(E.income.swing).toEqual([0.7, 1.3]);
    expect(E.income.living.map((l) => l.cost)).toEqual([[0, 1], [4, 8], [9, 15], [22, 45], [60, 120]]);
    expect(E.trust.start).toEqual({ before: 60, after: 80 });
    expect(E.trust.recoverPerYear).toBe(2);
  });
  it('gold targets for sim-gold: median at 30 per W, band 250 to 350', () => {
    expect(E.implementation.sim.goldAt30).toEqual({ '1': 220, '3': 300, '5': 470 });
    expect(E.implementation.sim.medianBand).toEqual([250, 350]);
    expect(E.income.goldAt30.find((g) => g.w === 3)).toEqual({ w: 3, p25: 31, p50: 89, p90: 414 });
  });
  it('investment: returns, overflow and noble price', () => {
    const ch = E.investment.channels;
    expect(ch.find((c) => c.name === 'เหมือง')).toMatchObject({ minCapital: 300, mean: [0.12, 0.12], sigma: 0.55 });
    expect(E.investment.overflow).toEqual([{ over: 2000, mul: 0.5 }, { over: 6000, mul: 0.25 }]);
    expect(E.investment.nobleBuy).toBe(2500);
  });
  it('base prices agree with the items generator', () => {
    const armor = I.prices.basePrice.find((b) => b.cat === 'armor')!.byTier;
    const mine = E.income.prices.find((p) => p.cat.startsWith('เกราะ'))!.byTier;
    expect(mine.C).toBe(armor.C);
    expect(mine.R).toBe(armor.R);
    expect(E.income.prices.length).toBe(9);
  });
});

describe('economy generator: a row against the docs', () => {
  it('DR-01 world event and the W 3 level', () => {
    const e = E.worldEvents.find((w) => w.events[0] === 'DR-01')!;
    expect(e).toMatchObject({ scope: 'AZ ทั้งทวีป', trust: -10 });
    expect(readDoc('docs/systems/economy/01-world-economy.md')).toContain('| DR-01 ฟ้าถล่ม | AZ ทั้งทวีป |');
    expect(E.wLevels[2]).toMatchObject({ w: 3, name: 'พอเพียง', priceIndex: 1, incomeIndex: 1 });
  });
});

// ---------- review M0-b fixes: M4 ----------
describe('trust bands of C do not overlap (M4)', () => {
  const B = E.trust.bands;
  const hit = (b: (typeof B)[number], c: number) => (b.min === null || c >= b.min) && (b.lt === null || c < b.lt);
  const mul = (c: number) => B.filter((b) => hit(b, c)).reduce((m, b) => m * b.priceMul, 1);
  it('every C from 0 to 100 (halves too) is in exactly one band that does not stack, and in no other unless it stacks', () => {
    for (let c = 0; c <= 100; c += 0.5) {
      expect(B.filter((b) => hit(b, c) && !b.stack).length, `C=${c}`).toBe(1);
      for (const b of B.filter((x) => x.stack)) if (hit(b, c)) expect(c, `C=${c}`).toBeLessThan(15);
    }
  });
  it('"ต่ำกว่า 40" does not take 40, and "40 ถึง 69" ends where "70 ขึ้นไป" starts', () => {
    expect(B.map((b) => [b.min, b.lt, b.max])).toEqual([
      [70, null, null],
      [40, 70, 69],
      [null, 40, null],
      [null, 15, null],
    ]);
    expect(hit(B[2], 40)).toBe(false);
    expect(hit(B[2], 39.9)).toBe(true);
    expect(hit(B[1], 69.5)).toBe(true);
  });
  it('"ต่ำกว่า 15" stacks with "ต่ำกว่า 40": both rows apply and the price multiplier is the one of <40', () => {
    expect(B.map((b) => b.stack)).toEqual([false, false, false, true]);
    expect(mul(14)).toBe(1.25);
    expect(mul(39)).toBe(1.25);
    expect(mul(40)).toBe(1.1);
    expect(mul(70)).toBe(1);
    expect(B[3].effect).toContain('ตลาดมืดกลายเป็นตลาดหลัก');
  });
  it('the price multipliers are the ones the price rule states', () => {
    expect([B[1].priceMul, B[2].priceMul]).toEqual([E.priceMods.trustMid, E.priceMods.trustLow]);
    expect(readDoc('docs/systems/economy/01-world-economy.md')).toContain('×1.1 เมื่อ C 40 ถึง 69 · ×1.25 เมื่อ C ต่ำกว่า 40');
  });
});
