// Balance of the economy (docs/guide/code-plan.md §7 row "economy": "ทองมัธยฐานตาม sim-gold", 08-implementation.md §6): the gold a life holds at
// 20, 30, 45 and 60, against the table that `npm run sim:gold` printed for the old code (RAW_PLAN.md §3.2), on whole lives of the real core:
// the world, character, story, NPC, attention, text and god systems of `allSystems()` with the economy system on top.
// The old sim paid its gold from event rewards (median 219 at 30). The core's story pays little of that, the economy's income, living cost
// and tax make most of it, and the combat, trade and investment systems that add to it (01 §7) are not in the core yet: the bands below are
// wide because of that, and `INCOME_SCALE` in src/core/economy/tuning.ts is the one number to move when they arrive.
// Run: npx vitest run --config vitest.balance.config.ts tests/balance/economy.test.ts   (ECON_LIVES=300 lives by default)
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createSession, startLife } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import type { GameData } from '../../src/core/game';
import { eco, extOf } from '../../src/core/economy';

// the lead adds the economy to the list of systems when the branch is merged; until then the test adds it, once
vi.mock('../../src/core/systems', async (orig) => {
  const m = await orig<typeof import('../../src/core/systems')>();
  const { economySystem } = await import('../../src/core/economy');
  return { ...m, allSystems: () => (m.allSystems().some((s) => s.name === 'economy') ? m.allSystems() : [...m.allSystems(), economySystem]) };
});

const LIVES = Number(process.env.ECON_LIVES ?? 300);
const AGES = [20, 30, 45, 60] as const;

/** RAW_PLAN.md §3.2, the output of `npx tsx scripts/sim/sim-gold.ts 300` on the old code. */
const SIM_GOLD: Record<number, { p25: number; p50: number; p75: number; p90: number }> = {
  20: { p25: 66, p50: 114, p75: 163, p90: 220 },
  30: { p25: 139, p50: 219, p75: 311, p90: 387 },
  45: { p25: 265, p50: 390, p75: 500, p90: 670 },
  60: { p25: 404, p50: 524, p75: 682, p90: 847 },
};

interface Row {
  at: Partial<Record<(typeof AGES)[number], number>>;
  cls: string;
  w: number;
  years: number;
  income: number;
  tax: number;
  living: number;
  gain: number;
  loss: number;
  climbed: boolean;
  fell: boolean;
  defaulted: boolean;
  tight: boolean;
  poverty: boolean;
  dead: number;
}

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

function playLife(seed: number): Row {
  const s = createSession(data, { seed });
  const life0 = startLife(s);
  const g = s.game;
  const cls0 = life0.cls;
  const w = eco(g.ctx)!.countries.get(life0.country)?.w ?? 3;
  const at: Row['at'] = {};
  while (g.state.life && !g.state.life.dead) {
    g.beat();
    const l = g.state.life!;
    for (const a of AGES) if (at[a] === undefined && l.hAge >= a) at[a] = l.gold;
  }
  const l = g.state.life!;
  const e = extOf(l);
  const moves = e.moves.map((m) => m.match(/^(\d)>(\d)/)!);
  return {
    at,
    cls: cls0,
    w,
    years: e.flows.years,
    income: e.flows.income,
    tax: e.flows.tax,
    living: e.flows.living,
    gain: e.flows.gain,
    loss: e.flows.loss,
    climbed: moves.some((m) => Number(m[2]) > Number(m[1])),
    fell: moves.some((m) => Number(m[2]) < Number(m[1])),
    defaulted: g.state.log.some((x) => x.sys === 'economy' && x.kind === 'default'),
    tight: g.state.log.some((x) => x.sys === 'economy' && x.kind === 'tight'),
    poverty: l.curses.includes('c_poverty'),
    dead: l.dead!.hAge,
  };
}

const q = (a: number[], p: number) => {
  const v = [...a].sort((x, y) => x - y);
  return v[Math.floor(p * (v.length - 1))] ?? 0;
};
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe('economy balance', () => {
  it(
    `${LIVES} lives: gold by age and class against sim-gold, income against outgoings, class moves and bankruptcy`,
    () => {
      const rows = Array.from({ length: LIVES }, (_, i) => playLife(i + 1));
      const gold = (age: (typeof AGES)[number], f: (r: Row) => boolean = () => true) => rows.filter((r) => r.at[age] !== undefined && f(r)).map((r) => r.at[age]!);

      const lines: string[] = [`gold held by ${LIVES} lives (sim-gold of RAW_PLAN §3.2 in brackets)`];
      for (const a of AGES) {
        const v = gold(a);
        const t = SIM_GOLD[a];
        lines.push(`  at ${a}  n=${v.length}  p25 ${q(v, 0.25)} (${t.p25})  p50 ${q(v, 0.5)} (${t.p50})  p75 ${q(v, 0.75)} (${t.p75})  p90 ${q(v, 0.9)} (${t.p90})`);
      }
      lines.push('median by class at birth');
      for (let c = 1; c <= 5; c++) lines.push(`  class ${c}  n=${rows.filter((r) => r.cls === `c${c}`).length}  ` + AGES.map((a) => `${a}: ${q(gold(a, (r) => r.cls === `c${c}`), 0.5)}`).join('  '));
      lines.push('median at 30 by W of the country of birth');
      for (let w = 1; w <= 5; w++) lines.push(`  W ${w}  n=${gold(30, (r) => r.w === w).length}  p25 ${q(gold(30, (r) => r.w === w), 0.25)}  p50 ${q(gold(30, (r) => r.w === w), 0.5)}  p90 ${q(gold(30, (r) => r.w === w), 0.9)}`);
      const inflow = sum(rows.map((r) => r.income + r.gain));
      const outflow = sum(rows.map((r) => r.tax + r.living + r.loss));
      const share = (f: (r: Row) => boolean) => rows.filter(f).length / rows.length;
      lines.push(`in/out ${(inflow / outflow).toFixed(2)}  (income ${Math.round(sum(rows.map((r) => r.income)) / LIVES)} + other ${Math.round(sum(rows.map((r) => r.gain)) / LIVES)} in; living ${Math.round(sum(rows.map((r) => r.living)) / LIVES)} tax ${Math.round(sum(rows.map((r) => r.tax)) / LIVES)} other ${Math.round(sum(rows.map((r) => r.loss)) / LIVES)} out, per life)`);
      lines.push(`class: climbed ${(100 * share((r) => r.climbed)).toFixed(1)}%  fell ${(100 * share((r) => r.fell)).toFixed(1)}%  bankrupt ${(100 * share((r) => r.defaulted)).toFixed(1)}%  tight year ${(100 * share((r) => r.tight)).toFixed(1)}%  c_poverty ${(100 * share((r) => r.poverty)).toFixed(1)}%`);
      console.log(lines.join('\n'));

      // the median against sim-gold, age by age: between a third and one and a half times (the combat, trade and investment faucets are still to come)
      for (const a of AGES) {
        const m = q(gold(a), 0.5);
        const t = SIM_GOLD[a].p50;
        expect(m, `median at ${a}`).toBeGreaterThanOrEqual(t * 0.3);
        expect(m, `median at ${a}`).toBeLessThanOrEqual(t * 1.6);
      }
      // gold only grows with age at the median, and the top of the table is further away than the middle (the same shape as the sim)
      const med = AGES.map((a) => q(gold(a), 0.5));
      for (let i = 1; i < med.length; i++) expect(med[i]).toBeGreaterThan(med[i - 1]);
      for (const a of AGES) {
        expect(q(gold(a), 0.25)).toBeLessThan(q(gold(a), 0.5));
        expect(q(gold(a), 0.9)).toBeGreaterThan(q(gold(a), 0.5) * 1.5);
      }

      // classes: a family of the high classes starts with more (03-classes.md §3); the nobles keep it in land, so their gold does not run away later
      const at20 = (f: (r: Row) => boolean) => q(gold(20, f), 0.5);
      expect(at20((r) => r.cls === 'c4' || r.cls === 'c5')).toBeGreaterThan(at20((r) => r.cls === 'c3') * 1.5);
      expect(at20((r) => r.cls === 'c3')).toBeGreaterThan(at20((r) => r.cls === 'c1' || r.cls === 'c2') * 0.8);
      expect(q(gold(30, (r) => r.cls === 'c5'), 0.5)).toBeGreaterThan(q(gold(30, (r) => r.cls === 'c3'), 0.5));

      // countries: a life born rich holds more at 30 (08-implementation.md §6 "ทองมัธยฐานที่อายุ 30 แยก W"), W 1 is too small a group to order
      const byW = [2, 3, 4, 5].map((w) => q(gold(30, (r) => r.w === w), 0.5));
      for (let i = 1; i < byW.length; i++) expect(byW[i], `W ${i + 2} against W ${i + 1}`).toBeGreaterThan(byW[i - 1]);
      expect(byW[3]).toBeGreaterThan(byW[0] * 2);

      // what comes in against what goes out (08 §6 gives 0.8 to 1.2 with every sink; the sinks of items and trade are not in yet)
      expect(inflow / outflow).toBeGreaterThan(0.8);
      expect(inflow / outflow).toBeLessThan(2.4);
      // lives that climb a class (08 §6: 15% of lives), lives that go bankrupt (5 to 10%; the loan and the fall are the simple form of P2)
      expect(share((r) => r.climbed)).toBeGreaterThan(0.05);
      expect(share((r) => r.climbed)).toBeLessThan(0.3);
      expect(share((r) => r.defaulted)).toBeLessThan(0.2);
      expect(share((r) => r.tight)).toBeLessThan(0.7);
    },
    600000,
  );

  it('the same seed gives the same life', () => {
    const a = playLife(17);
    const b = playLife(17);
    expect(b).toEqual(a);
  });
});
