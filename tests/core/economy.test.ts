// The economy system (docs/systems/economy/, steps P0 to P2): the data, the world events, prices, income, living cost, tax, class moves
// and the rules it registers. The balance of the whole (gold by age and class) is in tests/balance/economy.test.ts.
import { describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { birth, characterSystem } from '../../src/core/character';
import {
  armourTier, eco, economySystem, economyYear, eventEcon, expectedYear, extOf, foodShock, grossIncome, inheritanceTax, livingCost, moneyUse, placeOf, priceOf, regimeOf,
  payShare, SKIPPED, startGear, syncWorld, taxRate, trust, trustMul, wOf,
} from '../../src/core/economy';
import { INCOME_SCALE, RANK_PAY } from '../../src/core/economy/tuning';
import { Game, versions, type Ctx } from '../../src/core/game';
import { registered, apply, test as holds } from '../../src/core/rules';
import { newGame } from '../../src/core/state';
import { storySystem } from '../../src/core/story';
import { extOf as bondageOf } from '../../src/core/bondage';
import { itemsSystem, toolBonus } from '../../src/core/items';
import type { LifeState } from '../../src/core/types';

const data = loadGen();
const src = { sys: 'test' };

function worldOnly(seed = 1, year = 500) {
  const g = new Game(newGame(seed, versions(data)), data, [economySystem]);
  g.init();
  g.state.clock.worldYear = year;
  return g;
}
const happen = (g: Game, id: string, year: number) => {
  g.state.world.happened[id] = year;
};
const E = (ctx: Ctx) => eco(ctx)!;

/** A character born by the character system and moved to where and what the test wants. */
function lifeIn(seed: number, country: string, over: Partial<LifeState> = {}, systems = [characterSystem, economySystem]) {
  const g = new Game(newGame(seed, versions(data)), data, systems);
  g.init();
  g.state.clock.worldYear = 500;
  birth(g.ctx, { race: 'human', second: null, country });
  g.born();
  const life = g.state.life!;
  Object.assign(life, { hAge: 30, ...over });
  return { g, ctx: g.ctx, life };
}

describe('economy data (P0)', () => {
  it('knows the 143 countries with W, G, M and the regime of each', () => {
    const { ctx } = lifeIn(1, 'AL-01');
    const ix = E(ctx);
    expect(ix.list).toHaveLength(143);
    for (const c of ix.list) {
      expect(c.w).toBeGreaterThanOrEqual(1);
      expect(c.w).toBeLessThanOrEqual(5);
      expect(c.g).toBeGreaterThanOrEqual(1);
      expect(['full', 'mixed', 'little']).toContain(c.m);
    }
    const w = [1, 2, 3, 4, 5].map((n) => ix.list.filter((c) => c.w === n).length);
    expect(w).toEqual([9, 29, 54, 35, 16]); // economy/README.md "ตัวเลขสรุป"
  });

  it('puts the countries the document names as examples into their regime, and reads the rest from the government', () => {
    const { ctx } = lifeIn(1, 'AL-01');
    const ix = E(ctx);
    const r = (id: string) => ix.countries.get(id)!.regime;
    expect(r('AL-03')).toBe('monarchy');
    expect(r('AL-02')).toBe('theocracy');
    expect(r('NR-01')).toBe('merchant');
    expect(r('AL-06')).toBe('republic');
    expect(r('AL-08')).toBe('military');
    expect(r('MK-01')).toBe('company');
    expect(r('AL-16')).toBe('tribal');
    expect(r('MH-12')).toBe('stateless');
    expect(regimeOf(ix.data, 'XX-99', 'ราชอาณาจักรที่ไหนสักแห่ง')).toBe('monarchy');
  });

  it('does nothing when the economy data is not loaded', () => {
    const g = new Game(newGame(1), {}, [economySystem]);
    expect(() => {
      g.init();
      g.worldSteps(3);
    }).not.toThrow();
    expect(Object.keys(g.state.world.vars).filter((k) => k.startsWith('eco.'))).toEqual([]);
  });

  it('writes W and the eight prices of every country into world.vars', () => {
    const g = worldOnly();
    syncWorld(g.ctx);
    const v = g.state.world.vars;
    expect(v['eco.w.AL-17']).toBe(5);
    for (const good of ['F', 'M', 'T', 'W', 'S', 'H', 'X', 'E']) expect(v[`eco.p.AL-17.${good}`]).toBeGreaterThan(0);
    expect(v['eco.C']).toBe(60);
  });
});

describe('what the world events do (01-world-economy.md §6)', () => {
  it('reads the cells of the table into W changes, price shocks and C', () => {
    const { ctx } = lifeIn(1, 'AL-01');
    const m = eventEcon(ctx);
    const dr01 = m.get('DR-01')!;
    expect(dr01.c).toBe(-10);
    expect(dr01.w[0]).toMatchObject({ delta: -2, permanent: true, continents: ['AZ'] });
    expect(dr01.prices.find((p) => p.good === 'F')).toMatchObject({ mul: 1.3, years: 3, continents: ['SH'] });
    // "−1 · KD-12 KD-10 −2": the whole continent −1, those two −2
    const dr04 = m.get('DR-04')!;
    expect(dr04.w.map((s) => [s.delta, s.countries ?? s.continents])).toEqual([[-1, ['KD']], [-2, ['KD-12', 'KD-10']]]);
    expect(m.get('HP-02')!.w[0]).toMatchObject({ delta: 1, cap: 4, notLittle: true });
    expect(m.get('WR-14')!.w[0]).toMatchObject({ delta: -1, flag: 'war' });
    expect(m.get('WR-23')!.w[0]).toMatchObject({ delta: -1, minW: 3 });
    expect(m.get('PO-01')!.c).toBe(20);
    // a part that names no country is left out, and counted
    expect(m.get('BIO-04')!.unresolved.length).toBeGreaterThan(0);
    expect(m.size).toBeGreaterThanOrEqual(60);
  });

  it('moves W of the countries an event names, to at most 5 and at least 1', () => {
    const g = worldOnly();
    const ctx = g.ctx;
    expect(wOf(ctx, 'AZ-01')).toBe(5);
    expect(wOf(ctx, 'AZ-02')).toBe(4);
    happen(g, 'DR-01', 500);
    syncWorld(ctx);
    expect(wOf(ctx, 'AZ-01')).toBe(3); // −2 for good
    expect(wOf(ctx, 'AZ-02')).toBe(2);
    expect(wOf(ctx, 'KD-01')).toBe(5); // another continent
    g.state.clock.worldYear = 1700;
    expect(wOf(ctx, 'AZ-01')).toBe(3); // permanent
  });

  it('lets a temporary change fall back one level every five years, and a country named in the cell replace the continent', () => {
    const g = worldOnly();
    const ctx = g.ctx;
    happen(g, 'DR-04', 500);
    syncWorld(ctx);
    expect(wOf(ctx, 'KD-01')).toBe(4); // KD −1
    expect(wOf(ctx, 'KD-10')).toBe(1); // KD-10 −2 (3 → 1), not −3
    g.state.clock.worldYear = 505;
    expect(wOf(ctx, 'KD-01')).toBe(5);
    expect(wOf(ctx, 'KD-10')).toBe(2);
    g.state.clock.worldYear = 510;
    expect(wOf(ctx, 'KD-10')).toBe(3);
  });

  it('keeps a rise under its cap and never lifts a country past 5', () => {
    const g = worldOnly();
    const ctx = g.ctx;
    happen(g, 'HP-02', 500);
    syncWorld(ctx);
    for (const c of E(ctx).list) {
      const w = wOf(ctx, c.id);
      expect(w).toBeLessThanOrEqual(5);
      if (c.w <= 4 && c.m !== 'little') expect(w).toBe(Math.min(4, c.w + 1));
      if (c.m === 'little') expect(w).toBe(c.w);
    }
  });

  it('reaches only the countries at war for a change bound to the war flag', () => {
    const g = worldOnly();
    const ctx = g.ctx;
    g.state.world.countryFlags['AL-08'] = ['war'];
    happen(g, 'WR-14', 500);
    syncWorld(ctx);
    // AL-08 is also an E-hub (+1): the cell names it, so +1 replaces the −1
    expect(wOf(ctx, 'AL-08')).toBe(E(ctx).countries.get('AL-08')!.w + 1 > 5 ? 5 : E(ctx).countries.get('AL-08')!.w + 1);
    g.state.world.countryFlags['AL-15'] = ['war'];
    const g2 = worldOnly(2);
    g2.state.world.countryFlags['AL-15'] = ['war'];
    happen(g2, 'WR-14', 500);
    syncWorld(g2.ctx);
    expect(wOf(g2.ctx, 'AL-15')).toBe(E(g2.ctx).countries.get('AL-15')!.w - 1);
    expect(wOf(g2.ctx, 'AL-17')).toBe(5); // not at war
  });

  it('moves the trust C: events push it, +2 a year brings it back, a WR event holds the recovery', () => {
    const g = worldOnly(1, 100);
    const ctx = g.ctx;
    expect(trust(ctx)).toBe(60);
    g.state.clock.worldYear = 700;
    happen(g, 'PO-01', 660);
    expect(trust(ctx)).toBe(80); // 60 before PO-01, 80 after
    expect(trustMul(ctx)).toBe(1);
    happen(g, 'WR-14', 700);
    expect(trust(ctx)).toBe(40);
    expect(trustMul(ctx)).toBe(E(ctx).data.priceMods.trustMid);
    g.state.clock.worldYear = 710;
    expect(trust(ctx)).toBe(40); // held for ten years
    g.state.clock.worldYear = 720;
    expect(trust(ctx)).toBe(60);
    g.state.clock.worldYear = 800;
    expect(trust(ctx)).toBe(80);
    happen(g, 'PO-08', 800);
    happen(g, 'WR-21', 800);
    happen(g, 'PO-07', 800);
    happen(g, 'DR-01', 800);
    expect(trust(ctx)).toBeLessThan(40); // 80 − 10 − 10 − 15 − 10
    expect(trustMul(ctx)).toBe(E(ctx).data.priceMods.trustLow);
  });

  it('does not let the trust climb past 50 in the last era', () => {
    const g = worldOnly(1, 100);
    g.state.world.era = 4;
    happen(g, 'WR-14', 100);
    expect(trust(g.ctx)).toBe(20);
    g.state.clock.worldYear = 400;
    expect(trust(g.ctx)).toBe(50);
  });
});

describe('prices by country (01 §3)', () => {
  const GOODS = ['F', 'M', 'T', 'W', 'S', 'H', 'X', 'E'] as const;

  it('follows base × index of W × scarcity: the exporter pays less than the importer, the rich more than the poor', () => {
    const g = worldOnly();
    const ctx = g.ctx;
    const ix = E(ctx);
    const pm = ix.data.priceMods;
    const tm = trustMul(ctx);
    for (const c of ix.list) {
      for (const good of GOODS) {
        const status = c.exports.includes(good) ? pm.scarcity.exporter : c.shortages.includes(good) ? pm.scarcity.short : pm.scarcity.enough;
        const swing = status === pm.scarcity.enough ? pm.scarcity.swing / 2 : pm.scarcity.swing;
        const flat = ix.base[good] * pm.wIndex[wOf(ctx, c.id) - 1] * status * tm;
        const p = priceOf(ctx, c.id, good);
        expect(p).toBeGreaterThanOrEqual(flat * (1 - swing) - 1e-9);
        expect(p).toBeLessThanOrEqual(flat * (1 + swing) + 1e-9);
      }
    }
    // food: AL-17 sells it (W 5), MH-05 lacks it (W 3)
    expect(priceOf(ctx, 'AL-17', 'F')).toBeLessThan(priceOf(ctx, 'MH-05', 'F'));
  });

  it('is the same for the same seed, and another seed moves the balance of the year', () => {
    const a = worldOnly(5);
    const b = worldOnly(5);
    const c = worldOnly(6);
    const row = (g: Game) => GOODS.map((x) => priceOf(g.ctx, 'MH-05', x).toFixed(4)).join(' ');
    expect(row(a)).toBe(row(b));
    expect(row(c)).not.toBe(row(a));
  });

  it('does not change by more than ×2 a year with no event (08-implementation.md §6)', () => {
    const g = worldOnly(3, 0);
    let worst = 1;
    const ix = E(g.ctx);
    for (const c of ix.list.slice(0, 40))
      for (const good of GOODS) {
        let last = priceOf(g.ctx, c.id, good);
        for (let y = 10; y <= 600; y += 10) {
          g.state.clock.worldYear = y;
          const p = priceOf(g.ctx, c.id, good);
          worst = Math.max(worst, p / last, last / p);
          last = p;
        }
        g.state.clock.worldYear = 0;
      }
    expect(worst).toBeLessThan(2);
  });

  it('puts the multiplier of an event on the good and lets it fade', () => {
    const g = worldOnly(4);
    const ctx = g.ctx;
    const before = priceOf(ctx, 'MH-05', 'F');
    happen(g, 'DR-08', 500); // food ×1.3 everywhere for a year; its C of −5 stays in the same band
    const at = priceOf(ctx, 'MH-05', 'F');
    expect(at / before).toBeCloseTo(1.3, 5);
    g.state.clock.worldYear = 501;
    expect(priceOf(ctx, 'MH-05', 'F') / before).toBeCloseTo(1, 5);
    // WR-03: food ×2 in MH for ten years, falling back in a straight line
    const h = worldOnly(4);
    const p0 = priceOf(h.ctx, 'MH-05', 'F');
    happen(h, 'WR-03', 500);
    const hit = priceOf(h.ctx, 'MH-05', 'F');
    // food ×2, and MH loses one level of W (3 to 2) which makes every price in it 0.85 of what it was
    const wi = E(h.ctx).data.priceMods.wIndex;
    expect(hit / p0).toBeCloseTo(2 * (wi[1] / wi[2]), 5);
    h.state.clock.worldYear = 505; // half way down, and the W lost one level back
    expect(priceOf(h.ctx, 'MH-05', 'F') / p0).toBeCloseTo(1.5, 5);
    expect(foodShock(h.ctx, 'AL-17')).toBeGreaterThan(1); // WR-03 also raises AL food ×1.3
  });
});

describe('income, living cost and tax (04-income-and-living.md)', () => {
  it('gives a W 3 commoner the base of the job times the scale', () => {
    // NR-03: W 3, money in full use; a smith is tier U (22)
    const { ctx, life } = lifeIn(1, 'NR-03', { job: 'smith', cls: 'c3' });
    const ext = extOf(life);
    const place = placeOf(ctx, E(ctx), 'NR-03')!;
    expect(place.w).toBe(3);
    expect(place.m).toBe('full');
    expect(grossIncome(ctx, E(ctx), life, ext, place)).toBeCloseTo(22 * INCOME_SCALE, 6);
    // the same smith in a rich land pays more, in a poor land less
    const rich = placeOf(ctx, E(ctx), 'KD-01')!;
    const poor = placeOf(ctx, E(ctx), 'SH-12')!;
    expect(grossIncome(ctx, E(ctx), life, ext, rich)).toBeGreaterThan(grossIncome(ctx, E(ctx), life, ext, place));
    expect(grossIncome(ctx, E(ctx), life, ext, poor)).toBeLessThan(grossIncome(ctx, E(ctx), life, ext, place));
  });

  it('scales by class, by the use of money and by the group of the job', () => {
    const { ctx, life } = lifeIn(1, 'NR-03', { job: 'smith', cls: 'c3' });
    const ix = E(ctx);
    const ext = extOf(life);
    const place = placeOf(ctx, ix, 'NR-03')!;
    const at = (cls: string, job: string, p = place) => {
      life.cls = cls;
      life.job = job;
      return grossIncome(ctx, ix, life, ext, p);
    };
    const common = at('c3', 'smith');
    expect(at('c1', 'smith') / common).toBeCloseTo(0.2, 6);
    expect(at('c2', 'smith') / common).toBeCloseTo(0.8, 6);
    expect(at('c4', 'smith') / common).toBeCloseTo(1.5, 6);
    expect(at('c3', 'smith', { ...place, m: 'mixed' }) / common).toBeCloseTo(0.75, 6);
    expect(at('c3', 'smith', { ...place, m: 'little' }) / common).toBeCloseTo(0.5, 6);
    // a mage (tier R, technical ×1.2) against a smith (tier U, craft ×1)
    expect(at('c3', 'mage') / common).toBeCloseTo((36 * 1.2) / 22, 6);
    // the banker has ×1.5 over the service group; a pilgrim gets half
    expect(at('c3', 'banker') / common).toBeCloseTo((36 * 1.5) / 22, 6);
    expect(at('c3', 'pilgrim') / common).toBeCloseTo(0.8 * 0.5, 6); // religion ×0.8, and half the formula
    // secret jobs have no formula
    expect(at('c3', 'godslayer')).toBe(0);
  });

  it('adds the yield of the tools of a slow life, the work of a held person, and takes B1 by the lower class (items, bondage)', () => {
    const { ctx, life } = lifeIn(1, 'NR-03', { job: 'farm_owner', cls: 'c3' }, [characterSystem, economySystem, itemsSystem]);
    const ix = E(ctx);
    const ext = extOf(life);
    const place = placeOf(ctx, ix, 'NR-03')!;
    expect(ix.groupOf(ix.jobs.get('farm_owner')!)).toBe('slow');
    life.items = [];
    const plain = grossIncome(ctx, ix, life, ext, place);
    life.items = ['lt_hoe', 'lt_spade'];
    const bonus = toolBonus(ctx);
    expect(bonus).toBeGreaterThan(0);
    expect(grossIncome(ctx, ix, life, ext, place)).toBeCloseTo(plain * (1 + bonus), 6);
    // a tool of another trade does nothing, and a trade that is not slow takes no tool
    life.job = 'smith';
    life.items = ['lt_hoe'];
    expect(grossIncome(ctx, ix, life, ext, place)).toBeCloseTo(22 * INCOME_SCALE, 6);
    // a held person adds 10% when treated well (at most 15%)
    life.items = [];
    life.job = 'smith';
    const base = grossIncome(ctx, ix, life, ext, place);
    bondageOf(life).held.push({ id: 'H1', name: 'x', since: 20, good: true, trust: 0, price: 50 } as never);
    expect(grossIncome(ctx, ix, life, ext, place)).toBeCloseTo(base * 1.1, 6);
    bondageOf(life).held = [];
    // B1 earns by the lower class (×0.8) whatever the class of the life, B2 and B3 by the class of the bondless (×0.2, class 1)
    life.cls = 'c1';
    bondageOf(life).level = 1;
    expect(grossIncome(ctx, ix, life, ext, place) / base).toBeCloseTo(0.8, 6);
    bondageOf(life).level = 2;
    expect(grossIncome(ctx, ix, life, ext, place) / base).toBeCloseTo(0.2, 6);
  });

  it('does not take the fare of the travel system again: the gold left with it, the year counts it as a fare, not as a loss', () => {
    const { g, life } = lifeIn(2, 'NR-03', { job: 'smith', cls: 'c3', hAge: 25 }, [characterSystem, economySystem]);
    const ext = extOf(life);
    life.ext.travel = { spent: 0 };
    economyYear(g.ctx);
    const loss = ext.flows.loss;
    life.gold = Math.max(life.gold, 100);
    ext.mark = life.gold;
    life.gold -= 40; // a journey: the travel system took 40 and wrote it down
    (life.ext.travel as { spent: number }).spent = 40;
    life.hAge += 1;
    economyYear(g.ctx);
    expect(ext.flows.fare).toBe(40);
    expect(ext.flows.loss).toBeCloseTo(loss, 6);
    expect(ext.fareSeen).toBe(40);
  });

  it('pays a noble from the land, not from a job (04 §2)', () => {
    const { ctx, life } = lifeIn(1, 'NR-03', { job: 'knight', cls: 'c5' });
    const ix = E(ctx);
    const ext = extOf(life);
    const place = placeOf(ctx, ix, 'NR-03')!;
    for (const rank of ['minor', 'major'] as const) {
      ext.rank = rank;
      const lo = rank === 'minor' ? 60 : 100;
      const hi = rank === 'minor' ? 100 : 200;
      ext.landFrac = 0;
      expect(grossIncome(ctx, ix, life, ext, place)).toBeCloseTo(lo * INCOME_SCALE, 6);
      ext.landFrac = 1;
      expect(grossIncome(ctx, ix, life, ext, place)).toBeCloseTo(hi * INCOME_SCALE, 6);
    }
  });

  it('draws the swing of a year from 0.7 to 1.3 and leaves a job with no pay at zero', () => {
    const { ctx, life } = lifeIn(1, 'NR-03', { job: 'smith', cls: 'c3' });
    const ix = E(ctx);
    const ext = extOf(life);
    const place = placeOf(ctx, ix, 'NR-03')!;
    const rng = ctx.rng('economy.test');
    const v = Array.from({ length: 300 }, () => grossIncome(ctx, ix, life, ext, place, rng) / (22 * INCOME_SCALE));
    expect(Math.min(...v)).toBeGreaterThanOrEqual(0.7);
    expect(Math.max(...v)).toBeLessThanOrEqual(1.3);
    expect(Math.max(...v) - Math.min(...v)).toBeGreaterThan(0.4);
  });

  it('charges the cost of living of the class, by the price index of W (04 §3)', () => {
    const { g, ctx, life } = lifeIn(1, 'NR-03', { job: 'smith' });
    happen(g, 'PO-01', 400); // the trust at 80: no price premium
    const ix = E(ctx);
    const ext = extOf(life);
    const place = placeOf(ctx, ix, 'NR-03')!;
    const at = (cls: string, p = place) => {
      life.cls = cls;
      return livingCost(ctx, ix, life, ext, p);
    };
    for (let n = 1; n <= 5; n++) {
      const [lo, hi] = ix.data.income.living[n - 1].cost;
      ext.lifestyle = 0;
      expect(at(`c${n}`)).toBeCloseTo(lo, 6);
      ext.lifestyle = 1;
      expect(at(`c${n}`)).toBeCloseTo(hi, 6);
    }
    ext.lifestyle = 0.5;
    const base = at('c3');
    expect(base).toBeCloseTo(12, 6);
    expect(at('c3', { ...place, w: 5 }) / base).toBeCloseTo(1.5, 6);
    expect(at('c3', { ...place, w: 1 }) / base).toBeCloseTo(0.7, 6);
    expect(at('c3', { ...place, m: 'little' }) / base).toBeCloseTo(0.8, 6);
    life.job = 'beekeeper'; // slow life
    expect(at('c3') / base).toBeCloseTo(0.7, 6);
  });

  it('takes the share of the regime: feudal 20/10/0, theocracy 12 + 5, merchant 8, union 15 with half back, empire 18, company 10, tribes 5, none 0 (04 §4)', () => {
    const { ctx, life } = lifeIn(1, 'NR-03');
    const ix = E(ctx);
    const ext = extOf(life);
    expect([1, 2, 3, 4, 5].map((n) => taxRate(ix, 'monarchy', n, ext))).toEqual([0.2, 0.2, 0.2, 0.1, 0]);
    expect(taxRate(ix, 'theocracy', 3, ext)).toBeCloseTo(0.17, 9);
    expect(taxRate(ix, 'merchant', 3, ext)).toBe(0.08);
    expect(taxRate(ix, 'republic', 3, ext)).toBeCloseTo(0.075, 9);
    expect(taxRate(ix, 'military', 3, ext)).toBe(0.18);
    expect(taxRate(ix, 'company', 3, ext)).toBe(0.1);
    expect(taxRate(ix, 'tribal', 3, ext)).toBe(0.05);
    ext.racket = 0.2;
    expect(taxRate(ix, 'stateless', 3, ext)).toBe(0.2);
  });

  it('lowers the use of money when the trust in the central gold falls (01 §1)', () => {
    const { ctx } = lifeIn(1, 'NR-03');
    const ix = E(ctx);
    const c = (id: string) => ix.countries.get(id)!;
    expect(moneyUse(c('NR-03'), 3, 80)).toBe('full');
    expect(moneyUse(c('NR-03'), 3, 30)).toBe('mixed'); // W 3 and under, C under 40: one step down
    expect(moneyUse(c('AL-17'), 5, 30)).toBe('full'); // the rich lands keep theirs
    expect(moneyUse(c('AL-19'), 2, 55)).toBe('little'); // W 1 to 2 with mixed money, C 40 to 69
  });

  it('adds up one life year into gold, and the same seed gives the same years', () => {
    const run = (seed: number) => {
      const { g, ctx, life } = lifeIn(seed, 'NR-03', { job: 'smith', cls: 'c3', gold: 100 });
      const e = extOf(life);
      const golds: number[] = [];
      for (let i = 0; i < 12; i++) {
        life.hAge = 25 + i;
        economyYear(ctx);
        golds.push(life.gold);
      }
      return { golds, e, g, life };
    };
    const a = run(7);
    const b = run(7);
    expect(a.golds).toEqual(b.golds);
    expect(JSON.stringify(a.g.state.log)).toBe(JSON.stringify(b.g.state.log));
    expect(JSON.stringify(a.life.ext.economy)).toBe(JSON.stringify(b.life.ext.economy));
    // a W 3 smith at 22 × 1.35 against a living cost of 9 to 15 and 7.5% tax: gold grows
    expect(a.golds[a.golds.length - 1]).toBeGreaterThan(100);
    expect(a.e.flows.years).toBe(12);
    expect(a.e.flows.income).toBeGreaterThan(a.e.flows.living);
  });

  it('never pays before 17, and never takes gold under 0', () => {
    const { ctx, life } = lifeIn(1, 'NR-03', { hAge: 14, job: undefined, gold: 5 });
    economyYear(ctx);
    expect(life.gold).toBe(5);
    expect(extOf(life).flows.years).toBe(0);
    life.hAge = 30;
    life.cls = 'c5';
    life.gold = 0;
    extOf(life).incFlat = -1000;
    economyYear(ctx);
    expect(life.gold).toBe(0);
  });

  it('reads the expected year without drawing', () => {
    const { ctx, life, g } = lifeIn(1, 'NR-03', { job: 'smith', cls: 'c3' });
    const mark = JSON.stringify(g.state.rng);
    const y = expectedYear(ctx, life)!;
    expect(JSON.stringify(g.state.rng)).toBe(mark);
    expect(y.net).toBeCloseTo(y.income - y.tax - y.living, 9);
    expect(y.place.w).toBe(3);
  });
});

describe('the year in one line and the shares of a battle (M3 review T1, C2)', () => {
  const yearLines = (g: Game) => g.state.log.filter((e) => e.sys === 'economy' && e.kind === 'year');
  /** A smith of NR-03 whose purse is as the last year left it, so that only what the test does counts as a change. */
  function quiet(age = 31, gold = 200) {
    const m = lifeIn(11, 'NR-03', { job: 'scribe', cls: 'c3', gold });
    m.life.hAge = age;
    extOf(m.life).mark = m.life.gold;
    return m;
  }

  it('writes nothing for a year in which nothing moved but the formula', () => {
    const { g, ctx, life } = quiet();
    economyYear(ctx);
    expect(yearLines(g)).toEqual([]);
    expect(life.gold).toBeGreaterThan(0);
  });

  it('writes the year when a windfall, a loss, a share or a debt moved the money, and says which', () => {
    const win = quiet();
    win.life.gold += 120;
    economyYear(win.ctx);
    expect(yearLines(win.g)).toHaveLength(1);
    expect(yearLines(win.g)[0].data).toMatchObject({ why: 'gain', gain: 120, loss: 0 });

    const lose = quiet();
    lose.life.gold -= 90;
    economyYear(lose.ctx);
    expect(yearLines(lose.g)[0].data).toMatchObject({ why: 'loss', loss: 90, gain: 0 });

    const paid = quiet();
    expect(payShare(paid.ctx, 40, 'war', { war: 'WR-19' })).toBe(40);
    economyYear(paid.ctx);
    expect(yearLines(paid.g)[0].data).toMatchObject({ why: 'share', share: 40, gain: 0 });
    // the share is counted for the year it came in and starts again at zero
    expect(extOf(paid.life).yr.share).toBe(0);

    const debt = quiet(31, 8);
    extOf(debt.life).debt = 30;
    economyYear(debt.ctx);
    const d = yearLines(debt.g)[0].data;
    expect(String(d.why)).toContain('debt');
    expect(Number(d.debt)).toBeGreaterThan(0);
    expect(d.debtChange).not.toBe(0);
  });

  it('writes a ledger line every tenth year whatever happened, with the numbers the text tells: income, wage, tax, living, net, purse, debt', () => {
    const { g, ctx, life } = quiet(40);
    economyYear(ctx);
    const l = yearLines(g);
    expect(l).toHaveLength(1);
    expect(l[0].level).toBe(1);
    expect(l[0].data).toMatchObject({ why: 'ledger', kind: 'wage', job: 'scribe', class: 'c3', gold: life.gold, debt: 0, debtChange: 0, share: 0 });
    const d = l[0].data;
    for (const k of ['income', 'salary', 'gain', 'loss', 'fare', 'tax', 'living', 'net']) expect(typeof d[k], k).toBe('number');
    expect(Math.abs(Number(d.net) - (Number(d.income) - Number(d.tax) - Number(d.living)))).toBeLessThanOrEqual(1);
    expect(d.salary).toBe(d.income);
    for (const v of Object.values(d)) expect(v === null || ['string', 'number', 'boolean'].includes(typeof v)).toBe(true);
  });

  it('pays the share into the purse and writes economy/pay at level 0; a free hand or a dead life pays nothing', () => {
    const { g, ctx, life } = quiet();
    const before = life.gold;
    expect(payShare(ctx, 12.4, 'war', { war: 'WR-03' })).toBe(12);
    expect(life.gold).toBe(before + 12);
    const e = g.state.log.filter((x) => x.sys === 'economy' && x.kind === 'pay');
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ level: 0, id: 'war', data: { amount: 12, why: 'war', war: 'WR-03' } });
    expect(payShare(ctx, 0, 'war')).toBe(0);
    expect(payShare(ctx, -5, 'war')).toBe(0);
    life.dead = { year: 1, hAge: 31, cause: 'old' };
    expect(payShare(ctx, 10, 'war')).toBe(0);
  });

  it('pays a soldier by his rank (the army of the combat system keeps it) and nobody else by it', () => {
    const { ctx, life } = lifeIn(12, 'NR-03', { job: 'soldier', cls: 'c3', gold: 100 });
    const E_ = E(ctx);
    const place = placeOf(ctx, E_, 'NR-03')!;
    const at = (rank: number) => {
      life.ext.combat = { rank };
      return grossIncome(ctx, E_, life, extOf(life), place);
    };
    expect(at(4)).toBeCloseTo(at(0) * RANK_PAY[4], 6);
    expect(at(2)).toBeCloseTo(at(0) * RANK_PAY[2], 6);
    life.job = 'smith';
    expect(at(4)).toBeCloseTo(at(0), 6);
  });

  it('a life in bondage does not rise in class while bound, and the economy moves nobody who is not allowed to (10-bondage.md §2)', () => {
    const { ctx, life } = lifeIn(13, 'AL-19', { job: 'weaver', cls: 'c1', gold: 900, hAge: 40 });
    life.ext.bondage = { level: 2 };
    for (let i = 0; i < 30; i++) {
      life.hAge = 30 + (i % 10);
      economyYear(ctx);
    }
    expect(life.cls).toBe('c1');
    life.ext.bondage = { level: 0 };
    let rose = false;
    for (let i = 0; i < 30 && !rose; i++) {
      life.hAge = 30 + (i % 10);
      economyYear(ctx);
      rose = life.cls !== 'c1';
    }
    expect(rose).toBe(true);
  });
});

describe('poverty, debt and class (04 §5, §6, 03 §5)', () => {
  it('turns a year under the cost of living into a tight year, with a way out the character takes', () => {
    let seen = 0;
    const ways = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const { g, ctx, life } = lifeIn(seed, 'SH-12', { job: undefined, cls: 'c3', gold: 0 });
      for (let i = 0; i < 30; i++) {
        life.hAge = 20 + i;
        life.gold = Math.min(life.gold, 3);
        economyYear(ctx);
      }
      for (const e of g.state.log) if (e.sys === 'economy' && e.kind === 'tight') {
        seen++;
        ways.add(e.id!);
      }
    }
    expect(seen).toBeGreaterThan(10);
    expect(ways.size).toBeGreaterThanOrEqual(3);
  });

  it('puts a loan on the life, and pays it back from what it earns', () => {
    const { ctx, life } = lifeIn(1, 'NR-03', { job: 'mage', cls: 'c3', gold: 0 });
    const e = extOf(life);
    e.debt = 30;
    for (let i = 0; i < 6; i++) {
      life.hAge = 30 + i;
      economyYear(ctx);
    }
    expect(e.debt).toBe(0);
  });

  it('moves a commoner of five steady years and 150 gold up a class, and a house with nothing left down one', () => {
    const { ctx, life } = lifeIn(2, 'NR-03', { job: 'smith', cls: 'c2', gold: 400 });
    (life.ext.character as { jobSince?: number }).jobSince = 20;
    for (let i = 0; i < 20 && life.cls === 'c2'; i++) {
      life.hAge = 30 + i;
      life.gold = Math.max(life.gold, 400);
      economyYear(ctx);
    }
    expect(life.cls).toBe('c3');
    expect(extOf(life).moves[0]).toMatch(/^2>3@/);
    const h = lifeIn(3, 'NR-03', { job: undefined, cls: 'c4', gold: 0 });
    for (let i = 0; i < 12 && h.life.cls === 'c4'; i++) {
      h.life.hAge = 30 + i;
      h.life.gold = 0;
      extOf(h.life).incFlat = -500;
      economyYear(h.ctx);
    }
    expect(h.life.cls).toBe('c3');
    expect(h.g.state.log.some((e) => e.sys === 'character' && e.kind === 'class' && String(e.data.cause).startsWith('economy'))).toBe(true);
  });

  it('lets a merchant republic sell the rank to a rich class 4 (03 §5), and not any other', () => {
    const rich = lifeIn(4, 'NR-01', { job: 'banker', cls: 'c4', gold: 6000 });
    for (let i = 0; i < 12 && rich.life.cls === 'c4'; i++) {
      rich.life.hAge = 40 + i;
      rich.life.gold = Math.max(rich.life.gold, 6000);
      economyYear(rich.ctx);
    }
    expect(rich.life.cls).toBe('c5');
    expect(rich.life.flags).toContain('noble');
    const feudal = lifeIn(4, 'AL-03', { job: 'banker', cls: 'c4', gold: 6000 });
    for (let i = 0; i < 12; i++) {
      feudal.life.hAge = 40 + i;
      feudal.life.gold = 6000;
      economyYear(feudal.ctx);
    }
    expect(feudal.life.cls).toBe('c4');
  });

  it('takes the lands of the dragon-serving families when Skyfall happens (03 §5)', () => {
    const { g, ctx, life } = lifeIn(5, 'AZ-01', { cls: 'c5', gold: 1000, job: undefined });
    happen(g, 'DR-01', 480);
    economyYear(ctx);
    expect(life.cls).toBe('c4');
    economyYear(ctx);
    expect(life.cls).toBe('c4'); // once
  });

  it('lifts a bondless life in the cooperatives (03 §5), not elsewhere', () => {
    let moved = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const { ctx, life } = lifeIn(seed, 'AL-19', { cls: 'c1', gold: 0, job: undefined });
      for (let i = 0; i < 40 && life.cls === 'c1'; i++) {
        life.hAge = 20 + (i % 40);
        economyYear(ctx);
      }
      if (life.cls === 'c2') moved++;
    }
    expect(moved).toBe(8);
    const { ctx, life } = lifeIn(1, 'AL-08', { cls: 'c1', gold: 0, job: undefined });
    for (let i = 0; i < 10; i++) {
      life.hAge = 20 + i;
      economyYear(ctx);
    }
    expect(life.cls).toBe('c1');
  });
});

describe('the rules of the economy', () => {
  it('registers its numbers without taking a name another system owns, and the effects that change them are there', () => {
    expect(SKIPPED).toEqual([]);
    const r = registered();
    for (const k of ['statPct', 'statMul', 'range', 'pct', 'class']) expect(r.effects).toContain(k);
  });

  it('reads and changes the income through the words of the storylines', () => {
    const { ctx, life } = lifeIn(1, 'NR-03', { job: 'smith', cls: 'c3' });
    const read = (stat: string) => holds(ctx, { k: 'cmp', stat, op: '>=', value: 0 }) && expectedYear(ctx, life)!.income;
    const before = expectedYear(ctx, life)!.income;
    apply(ctx, [{ k: 'statMul', stat: 'รายได้', mul: 0.8 }], src);
    expect(expectedYear(ctx, life)!.income).toBeCloseTo(before * 0.8, 6);
    apply(ctx, [{ k: 'statPct', stat: 'รายได้', pct: 25 }], src);
    expect(expectedYear(ctx, life)!.income).toBeCloseTo(before * 0.8 * 1.25, 6);
    apply(ctx, [{ k: 'statMul', stat: 'ค่าแรง', mul: 1.5 }], src);
    expect(expectedYear(ctx, life)!.income).toBeCloseTo(before * 0.8 * 1.25 * 1.5, 6);
    expect(read('รายได้')).toBeGreaterThan(0);
    expect(extOf(life).inc).toBeCloseTo(1.5, 6);
    // a job that pays nothing takes the change as a flat sum
    life.job = 'godslayer';
    life.cls = 'c3';
    extOf(life).inc = 1;
    apply(ctx, [{ k: 'stat', stat: 'รายได้', delta: 12 }], src);
    expect(extOf(life).incFlat).toBe(12);
  });

  it('keeps the factors of trade and investment, with 1 as "as usual"', () => {
    const { ctx, life } = lifeIn(1, 'NR-03', { job: 'merchant' });
    apply(ctx, [{ k: 'statPct', stat: 'ผลกำไร', pct: 10 }, { k: 'statMul', stat: 'ขาย', mul: 1.4 }, { k: 'statMul', stat: 'ส่วนต่างสูงมาก', mul: 2 }], src);
    expect(extOf(life).x['ผลกำไร']).toBeCloseTo(1.1, 9);
    expect(extOf(life).x['ขาย']).toBeCloseTo(1.4, 9);
    expect(extOf(life).x['ส่วนต่างสูงมาก']).toBeCloseTo(2, 9);
    apply(ctx, [{ k: 'range', stat: 'ผลตอบแทน', min: 8, max: 10 }], src);
    expect(extOf(life).x['ผลตอบแทน']).toBeGreaterThanOrEqual(8);
    expect(extOf(life).x['ผลตอบแทน']).toBeLessThanOrEqual(10);
    // the spread of a trade starts at the middle of 20 to 40 and a trip adds to it
    apply(ctx, [{ k: 'range', stat: 'ส่วนต่าง', min: 20, max: 40 }], src);
    expect(holds(ctx, { k: 'cmp', stat: 'ส่วนต่าง', op: '>=', value: 50 })).toBe(true);
    // capital is gold
    life.gold = 250;
    expect(holds(ctx, { k: 'cmp', stat: 'capital', op: '>=', value: 200 })).toBe(true);
    expect(holds(ctx, { k: 'cmp', stat: 'ทุน', op: '>=', value: 300 })).toBe(false);
  });

  it('pays or takes a month of pay in gold (a strike), and moves the price of food by a family\'s bad year', () => {
    const { ctx, life } = lifeIn(1, 'NR-03', { job: 'smith', cls: 'c3', gold: 100 });
    const month = expectedYear(ctx, life)!.income / 12;
    apply(ctx, [{ k: 'statMul', stat: 'เงินเดือน', mul: 0 }], src);
    expect(life.gold).toBe(Math.max(0, Math.round(100 - month)));
    const living = expectedYear(ctx, life)!.living;
    apply(ctx, [{ k: 'statMul', stat: 'ของหมวดอาหารราคา', mul: 2 }], src);
    expect(extOf(life).foodMul).toBeCloseTo(2, 6);
    expect(expectedYear(ctx, life)!.living).toBeGreaterThan(living * 1.3);
  });

  it('reads the W of the land the life lives in, events included (jobs ask "country.W ≥ 3")', () => {
    const { g, ctx } = lifeIn(1, 'AZ-02');
    const ask = { k: 'cmp', stat: 'country.W', op: '>=', value: 3 } as const;
    expect(holds(ctx, ask)).toBe(true); // W 4
    happen(g, 'DR-01', 500);
    expect(holds(ctx, ask)).toBe(false); // −2
    expect(holds(ctx, { k: 'cmp', stat: 'country.G', op: '>=', value: 1 })).toBe(true);
  });
});

describe('the lines of the economy storylines (24-economy.md §2)', () => {
  const external = (life: LifeState) => (life.ext.story as { external: string[] }).external;
  const systems = [characterSystem, economySystem, storySystem];

  it('opens ec for every life when OPEN_EC is on, and pv where W is 2 or less', async () => {
    const { OPEN_EC } = await import('../../src/core/economy/tuning');
    const rich = lifeIn(1, 'AL-17', {}, systems);
    if (OPEN_EC) expect(external(rich.life)).toContain('ec');
    else expect(external(rich.life)).not.toContain('ec');
    expect(external(rich.life)).not.toContain('pv');
    const poor = lifeIn(1, 'SH-12', {}, systems);
    expect(external(poor.life)).toContain('pv');
  });

  it('opens tr for a trader and wk for a worker, once', () => {
    const t = lifeIn(2, 'AL-17', { job: 'caravan_master' }, systems);
    economyYear(t.ctx);
    economyYear(t.ctx);
    expect(external(t.life).filter((l) => l === 'tr')).toHaveLength(1);
    const w = lifeIn(2, 'AL-17', { job: 'miner' }, systems);
    economyYear(w.ctx);
    expect(external(w.life)).toContain('wk');
    expect(external(w.life)).not.toContain('tr');
    const k = lifeIn(2, 'AL-17', { job: 'smith' }, systems);
    economyYear(k.ctx);
    expect(external(k.life)).not.toContain('wk');
    k.life.passed['ec.a3'] = 'a';
    economyYear(k.ctx);
    expect(external(k.life)).toContain('tr');
  });
});

describe('the start (P1) and the heirs', () => {
  it('draws the tier of the first gear by class and W from the table (03 §3)', () => {
    const { ctx } = lifeIn(1, 'AL-17');
    const rng = ctx.rng('economy.test');
    const share = (cls: number, w: number, tier: string, n = 6000) => {
      let k = 0;
      for (let i = 0; i < n; i++) if (startGear(ctx, rng, cls, w) === tier) k++;
      return k / n;
    };
    expect(share(5, 5, 'E')).toBeGreaterThan(0.2);
    expect(share(5, 5, 'E')).toBeLessThan(0.26);
    expect(share(2, 1, 'R')).toBe(0);
    expect(share(1, 3, 'everyday')).toBeGreaterThan(0.65);
    expect(armourTier('E')).toBe('R');
    expect(armourTier('everyday')).toBe('everyday');
  });

  it('works out the inheritance tax of the regime (04 §4)', () => {
    const { ctx } = lifeIn(1, 'AL-17');
    expect(inheritanceTax(ctx, 'AL-03', 1000)).toBe(100);
    expect(inheritanceTax(ctx, 'AL-02', 1000)).toBe(50);
    expect(inheritanceTax(ctx, 'NR-01', 1000)).toBe(75);
    expect(inheritanceTax(ctx, 'NR-01', 400)).toBe(0);
    expect(inheritanceTax(ctx, 'MH-12', 1000)).toBe(0);
  });

  it('keeps the same life for the same seed with the whole core', () => {
    const run = (seed: number) => {
      const { g } = lifeIn(seed, 'AL-17', { hAge: 18 }, [characterSystem, economySystem, storySystem]);
      g.runLife(4 * 120);
      return JSON.stringify([g.state.life, g.state.log, g.state.world.vars]);
    };
    expect(run(9)).toBe(run(9));
  });
});
