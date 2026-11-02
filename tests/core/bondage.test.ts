// The bondage system (docs/systems/economy/10-bondage.md): the stance of each country, the levels B0 to B3, the way in and the way out, the price of
// freedom, the border, the persons the character holds, redeems or helps to flee, and the lines bd bo ab of the story.
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife, runToDeath } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { sortSystems, type Ctx, type GameData, type System } from '../../src/core/game';
import { bondsSystem, extOf as bondsExt, tiesOf } from '../../src/core/bonds';
import {
  afterNode,
  allyFrom,
  bondageIndex,
  bondageSystem,
  buy,
  enter,
  extOf,
  flee,
  free,
  freeLand,
  heldIncomeBonus,
  leave,
  ransomPrice,
  sell,
  stanceOf,
} from '../../src/core/bondage';
import { lifeYear } from '../../src/core/bondage/engine';
import { EXTERNAL_LINES } from '../../src/core/story/tuning';
import type { BondageData } from '../../src/core/data/types-bondage';
import type { LifeState } from '../../src/core/types';

let data: GameData;
let bd: BondageData;
beforeAll(() => {
  data = loadAll();
  bd = data.bondage.items as BondageData;
});

function mk(seed = 1, o: { race?: string; country?: string } = {}) {
  const s = createSession(data, { seed, race: o.race ?? 'hu', country: o.country, startYear: 120 });
  const list = s.game.systems as System[];
  for (const x of [bondsSystem, bondageSystem]) if (!list.some((y) => y.name === x.name)) list.push(x);
  list.splice(0, list.length, ...sortSystems(list));
  const life = startLife(s);
  return { s, g: s.game, ctx: s.game.ctx as Ctx, life, e: extOf(life) };
}

/** A life of class 3 with a purse in a country, free of any bond. */
function at(life: LifeState, country: string, gold = 500) {
  life.country = country;
  life.cls = 'c3';
  life.gold = gold;
  life.hAge = 30;
}

describe('bondage: the stance of each country (§3)', () => {
  it('has five stances and names a stance for all 143 countries; the named ones are the table of §3.1', () => {
    expect(bd.stances.map((s) => s.id).sort()).toEqual(['A', 'D', 'H', 'L', 'M']);
    expect(Object.keys(bd.byCountry)).toHaveLength(143);
    const { ctx } = mk(1);
    for (const c of ['MH-09', 'NB-09', 'NR-05']) expect(stanceOf(ctx, c)).toBe('M');
    for (const c of ['SH-11', 'MH-02']) expect(stanceOf(ctx, c)).toBe('L');
    for (const c of ['SH-01', 'MK-16', 'MK-06', 'AL-08', 'AL-10', 'AL-04', 'SH-02']) expect(stanceOf(ctx, c)).toBe('D');
    for (const c of ['AL-06', 'AL-19', 'AL-07', 'KD-10', 'MK-10', 'NR-10', 'NR-16', 'MH-06', 'MH-07', 'MK-03', 'AL-01', 'AL-11', 'AL-16', 'AL-23', 'SH-09']) expect(stanceOf(ctx, c)).toBe('A');
    for (let i = 1; i <= 18; i++) expect(stanceOf(ctx, `SV-${String(i).padStart(2, '0')}`)).toBe('A');
    expect(stanceOf(ctx, 'AZ-01')).toBe('H');
  });

  it('says what each stance allows and the share of class 1 that is bound (§3 and §4)', () => {
    const legal = Object.fromEntries(bd.stances.map((s) => [s.id, s.legal]));
    expect(legal.A).toEqual({ B1: 'illegal', B2: 'illegal', B3: 'illegal' });
    expect(legal.D).toEqual({ B1: 'legal', B2: 'legal', B3: 'illegal' });
    expect(legal.L).toEqual({ B1: 'legal', B2: 'legal', B3: 'legal' });
    expect(legal.H.B3).toBe('none');
    const share = Object.fromEntries(bd.class1.map((c) => [c.stance, [c.b1, c.b2, c.b3, c.rest]]));
    expect(share.M).toEqual([15, 25, 35, 25]);
    expect(share.D).toEqual([35, 30, 0, 35]);
    expect(share.A).toEqual([0, 0, 0, 100]);
  });
});

describe('bondage: the price of freedom (§7)', () => {
  it('B1 is the debt (20 to 150), B2 is 5 gold a year left of the contract and at least 30, B3 is 60 times the skill (60 to 360), times the price index of the country', () => {
    const { ctx } = mk(2);
    // a country of W 3 has a price index of 1
    const c3 = 'AZ-03';
    const idx = bondageIndex(ctx).priceIndex(3);
    expect(idx).toBe(1);
    expect(ransomPrice(ctx, 1, c3, { debt: 10 })).toBeGreaterThanOrEqual(20);
    expect(ransomPrice(ctx, 1, c3, { debt: 400 })).toBeLessThanOrEqual(150 * 1.5);
    expect(ransomPrice(ctx, 2, c3, { skill: 1, years: 1 })).toBe(30);
    expect(ransomPrice(ctx, 2, c3, { skill: 6, years: 40 })).toBe(150);
    for (let s = 1; s <= 6; s++) expect(ransomPrice(ctx, 3, c3, { skill: s })).toBe(60 * s);
    // a poor land is cheaper (W 1: 0.7), a rich one dearer (W 5: 1.5)
    expect(bondageIndex(ctx).priceIndex(1)).toBe(0.7);
    expect(bondageIndex(ctx).priceIndex(5)).toBe(1.5);
  });
});

describe('bondage: entering and leaving (§5 and §6)', () => {
  it('a bound life is class 1, holds a price and opens the line bd; it may not be bound where the stance forbids it', () => {
    const { ctx, life, g, e } = mk(3);
    at(life, 'MH-09');
    expect(enter(ctx, life, 'เป็นหนี้', 1)).toBe(true);
    expect(e.level).toBe(1);
    expect(life.cls).toBe('c1');
    expect(e.price).toBeGreaterThan(0);
    expect(e.debt).toBeGreaterThanOrEqual(20);
    expect(e.opened).toContain('bd');
    expect((life.ext.story as { external: string[] }).external).toContain('bd');
    const log = g.state.log.filter((x) => x.sys === 'bondage' && x.kind === 'enter');
    expect(log).toHaveLength(1);
    expect(log[0].level).toBe(2);
    expect(enter(ctx, life, 'เป็นหนี้', 1)).toBe(false); // already bound
    // B3 where it is illegal (D) is a contract; where the stance is A nobody is bound: he is carried to a land where it is allowed
    leave(ctx, life, 'released');
    at(life, 'SH-01');
    enter(ctx, life, 'ถูกจับ', 3);
    expect(e.level).toBe(2);
    leave(ctx, life, 'released');
    at(life, 'AL-06');
    expect(stanceOf(ctx, 'AL-06')).toBe('A');
    expect(enter(ctx, life, 'ถูกขาย', 2)).toBe(true);
    expect(['D', 'L', 'M', 'H']).toContain(stanceOf(ctx, life.country));
    expect(stanceOf(ctx, life.country)).not.toBe('A');
    expect(e.country).toBe(life.country);
  });

  it('buying his own freedom lifts the class by one when he has work; every other way out leaves the class', () => {
    const { ctx, life, e } = mk(4);
    at(life, 'MH-09');
    life.job = 'smith';
    enter(ctx, life, 'เป็นหนี้', 2);
    expect(life.cls).toBe('c1');
    leave(ctx, life, 'ransom');
    expect(e.level).toBe(0);
    expect(life.cls).toBe('c2');
    enter(ctx, life, 'ถูกขาย', 2);
    leave(ctx, life, 'term');
    expect(life.cls).toBe('c1');
    expect(leave(ctx, life, 'term')).toBe(false);
    expect(e.history.map((h) => h.how)).toEqual(['เป็นหนี้', 'ransom', 'ถูกขาย', 'term']);
  });

  it('a debt is paid down a year at a time and the bound person is free when it is gone; a contract runs out; a fund of gold buys freedom', () => {
    const { ctx, life, e } = mk(5);
    at(life, 'MH-09');
    enter(ctx, life, 'เป็นหนี้', 1);
    e.debt = 60;
    let years = 0;
    while (e.level === 1 && years < 60) {
      lifeYear(ctx, life);
      years++;
    }
    expect(e.level).toBe(0);
    expect(years).toBeGreaterThan(2);
    expect(years).toBeLessThan(40);
    expect(e.history.at(-1)!.how).toBe('debt');
    enter(ctx, life, 'ขายตัวเอง', 2);
    e.years = 3;
    e.price = 100000;
    for (let i = 0; i < 3 && e.level === 2; i++) lifeYear(ctx, life);
    if (e.level === 2) lifeYear(ctx, life);
    expect(e.level).toBe(0);
    expect(['term', 'released']).toContain(e.history.at(-1)!.how);
    enter(ctx, life, 'ถูกขาย', 3);
    e.price = 200;
    e.fund = 500;
    life.hAge = 30;
    lifeYear(ctx, life);
    expect(e.level).toBe(0);
    expect(life.gold).toBeGreaterThan(500);
  });

  it('saves 2 to 14 gold a year at W 3 toward the ransom, so freedom takes years, inside the adult span (§7)', () => {
    const { ctx, life, e } = mk(6);
    at(life, 'AZ-03');
    enter(ctx, life, 'ถูกขาย', 3);
    e.price = 99999;
    const before = e.fund;
    lifeYear(ctx, life);
    expect(e.fund - before).toBeGreaterThanOrEqual(2);
    expect(e.fund - before).toBeLessThanOrEqual(14);
    expect(bd.income.savingPerYear).toEqual([2, 14]);
  });
});

describe('bondage: the border (§6 "ดินแดนเสรี")', () => {
  it('a bound life that flees to a land of stance A is free at once; a failed try leaves him bound', () => {
    let free_ = 0;
    let caught = 0;
    for (let seed = 10; seed < 70; seed++) {
      const { ctx, life, e } = mk(seed);
      at(life, 'SH-01');
      enter(ctx, life, 'เป็นหนี้', 2);
      const r = flee(ctx, life);
      if (r === 'free') {
        free_++;
        expect(e.level).toBe(0);
        expect(stanceOf(ctx, life.country)).toBe('A');
      } else {
        caught++;
        expect(e.level).toBe(2);
      }
    }
    expect(free_).toBeGreaterThan(20);
    expect(caught).toBeGreaterThan(3);
  });

  it('the free land is the nearest of stance A, on the same continent first', () => {
    const { ctx } = mk(7);
    for (let i = 0; i < 20; i++) {
      const land = freeLand(ctx, 'SH-01')!;
      expect(stanceOf(ctx, land)).toBe('A');
      expect(land.startsWith('SH')).toBe(true);
    }
  });
});

describe('bondage: the buyer, the redeemer and the helper (§8)', () => {
  it('buys only where the stance allows it (D contracts, L M persons), pays the price, and the work of the held adds at most 15%', () => {
    const { ctx, life, e } = mk(8);
    at(life, 'AZ-01');
    expect(buy(ctx, life, false)).toBeUndefined(); // H: not for a buyer
    at(life, 'SH-01');
    const g0 = life.gold;
    const h = buy(ctx, life, false)!;
    expect(h).toBeTruthy();
    expect(h.level).toBe('B2'); // D: contracts, not persons
    expect(life.gold).toBeLessThan(g0);
    expect(e.held).toHaveLength(1);
    expect(heldIncomeBonus(ctx)).toBe(10);
    at(life, 'MH-09');
    buy(ctx, life, false);
    buy(ctx, life, false);
    expect(heldIncomeBonus(ctx)).toBe(15);
    // a thin purse buys a cheaper person or none
    life.gold = 0;
    expect(buy(ctx, life, false)).toBeUndefined();
  });

  it('a person redeemed or freed becomes an ally at 40% and one helped to flee at 50% (§8); the freed owes the one who freed him', () => {
    const { ctx, life, e } = mk(9);
    at(life, 'MH-09');
    expect(bd.allyChance).toEqual({ redeemOrFree: 0.4, helper: 0.5 });
    let a = 0;
    let b = 0;
    const N = 1500;
    for (let i = 0; i < N; i++) {
      if (allyFrom(ctx, life, { name: `x${i}` }, bd.allyChance.redeemOrFree)) a++;
      if (allyFrom(ctx, life, { name: `y${i}` }, bd.allyChance.helper)) b++;
      // keep the book small
      for (const t of tiesOf(bondsExt(life))) if (t.from === 'redeem') t.state = 'faded';
    }
    expect(a / N).toBeGreaterThan(0.36);
    expect(a / N).toBeLessThan(0.44);
    expect(b / N).toBeGreaterThan(0.46);
    expect(b / N).toBeLessThan(0.54);
    expect(e.counts.allies).toBe(a + b);
    const t = tiesOf(bondsExt(life)).find((x) => x.from === 'redeem')!;
    expect(t.b).toBeGreaterThanOrEqual(30);
    expect(t.gratitude).toBe(bd.gratitude.redeem);
  });

  it('frees a held person with gratitude +3, sells him for a gain at the price of the trust, and a bought one never stays an ally while held', () => {
    const { ctx, life, e } = mk(10);
    at(life, 'MH-09');
    const h = buy(ctx, life, false)!;
    const gold = life.gold;
    sell(ctx, life, h);
    expect(h.gone).toBe('sold');
    expect(life.gold).toBeGreaterThan(gold);
    expect(e.counts.sold).toBe(1);
    const h2 = buy(ctx, life, false)!;
    const fav = bondsExt(life).favor;
    free(ctx, life, h2, 'freed', 'x');
    expect(bondsExt(life).favor).toBe(fav + bd.gratitude.free);
    expect(h2.gone).toBe('freed');
  });

  it('a written bound person (Fira in MH-09) is the one the buyer finds there, and is no tie before he is freed', () => {
    const { ctx, life, g, e } = mk(11);
    at(life, 'MH-09');
    const slot = (g.state.npcs.slots as unknown as Record<string, { status: string; gen: number; place?: string; name: string; alive: boolean; born: number; span: number }>)['MH09-7'];
    slot.status = 'alive';
    slot.alive = true;
    slot.gen = 1;
    slot.place = 'MH-09';
    slot.born = g.state.clock.worldYear - (slot.span * 40) / 75;
    const h = buy(ctx, life, false)!;
    expect(h.npc).toBe('MH09-7');
    expect(h.name).toBe(slot.name);
    expect(tiesOf(bondsExt(life)).some((t) => t.npc === 'MH09-7')).toBe(false);
    free(ctx, life, h, 'freed', 'x');
    void e;
  });
});

describe('bondage: the nodes of bd bo ab (27-bondage.md)', () => {
  it('bd.a2 way a sets him to buy his freedom, way b flees, way c is paid for by another', () => {
    const { ctx, life, e } = mk(12);
    at(life, 'SH-01');
    enter(ctx, life, 'เป็นหนี้', 2);
    afterNode(ctx, 'bd.a2', 'a');
    expect(e.ransoming).toBe(true);
    afterNode(ctx, 'bd.a2', 'c');
    expect(e.level).toBe(0);
    expect(e.history.at(-1)!.how).toBe('freed');
    enter(ctx, life, 'ถูกขาย', 2);
    afterNode(ctx, 'bd.a2', 'b');
    expect(e.counts.escapes).toBe(1);
    // the node played by a life that is not bound changes nothing
    leave(ctx, life, 'released');
    afterNode(ctx, 'bd.a2', 'c');
    expect(e.level).toBe(0);
  });

  it('bo.a1 buys (a) or buys to free (c); bo.a3 frees (a), sells (b) or takes across the border (c)', () => {
    const { ctx, life, e } = mk(13);
    at(life, 'MH-09');
    afterNode(ctx, 'bo.a1', 'a');
    expect(e.held.filter((h) => !h.gone)).toHaveLength(1);
    afterNode(ctx, 'bo.a3', 'c');
    expect(e.held[0].gone).toBe('crossed');
    afterNode(ctx, 'bo.a1', 'a');
    afterNode(ctx, 'bo.a3', 'b');
    expect(e.held[1].gone).toBe('sold');
    afterNode(ctx, 'bo.a1', 'c');
    expect(e.held[2].gone).toBe('freed');
    afterNode(ctx, 'bo.a1', 'a');
    afterNode(ctx, 'bo.a2', 'c');
    expect(e.held[3].gone).toBe('fled');
    expect(e.opened).toContain('ab');
  });

  it('ab.a1 hides (a) or pays (b) for a bound person who asks; ab.a2 takes him across or is caught; ab.a3 keeps him as an ally', () => {
    const { ctx, life, e } = mk(14);
    at(life, 'SH-01');
    afterNode(ctx, 'ab.a1', 'a');
    expect(e.helpee).toBeTruthy();
    expect(e.helpee!.hidden).toBe(true);
    afterNode(ctx, 'ab.a2', 'a');
    expect(e.helpee!.freed).toBe(true);
    expect(e.counts.helped).toBe(1);
    afterNode(ctx, 'ab.a3', 'a');
    expect(e.helpee!.allied).toBe(true);
    expect(tiesOf(bondsExt(life)).some((t) => t.from === 'redeem')).toBe(true);
    const gold = life.gold;
    e.helpee = undefined;
    afterNode(ctx, 'ab.a1', 'b');
    expect(life.gold).toBeLessThan(gold);
    expect(e.helpee!.freed).toBe(true);
    e.helpee = undefined;
    afterNode(ctx, 'ab.a1', 'a');
    afterNode(ctx, 'ab.a2', 'c');
    expect(e.helpee).toBeUndefined();
  });

  it('kn.t1 way c: where debts bind (D L M) a keeper may hold the contract of the child nobody took in', () => {
    let bound = 0;
    for (let seed = 20; seed < 60; seed++) {
      const { ctx, life, e } = mk(seed);
      at(life, 'MH-09');
      afterNode(ctx, 'kn.t1', 'c');
      if (e.level === 2) bound++;
      expect(e.level === 0 || e.level === 2).toBe(true);
    }
    expect(bound).toBeGreaterThan(10);
    expect(bound).toBeLessThan(35);
    const { ctx, life, e } = mk(61);
    at(life, 'AZ-01');
    afterNode(ctx, 'kn.t1', 'c');
    expect(e.level).toBe(0);
  });

  it('takes the lines bd bo ab from the story: they open by this system and no longer by the story’s own chance', () => {
    for (const l of ['bd', 'bo', 'ab']) expect(EXTERNAL_LINES.has(l)).toBe(true);
    // a life that is never bound opens none of bd at all
    let opened = 0;
    for (let seed = 70; seed < 82; seed++) {
      const { g, life } = mk(seed);
      runToDeath(g);
      const ex = life.ext.story as { open: Record<string, boolean>; external: string[] };
      if (!extOf(life).opened.includes('bd')) expect(ex.open.bd).not.toBe(true);
      if (ex.open.bd) opened++;
    }
    expect(opened).toBeLessThan(6);
  });
});

describe('bondage: the held person of year five (§8 "ถ้าถือต่อ")', () => {
  it('in the fifth year 30% flee or are helped and 15% see the owner sued; his trust in the owner falls 1 every 2 years, not below −5', () => {
    expect(bd.hold).toMatchObject({ year: 5, escapeChance: 0.3, suedChance: 0.15, ownerTrustPerTwoYears: -1, ownerTrustFloor: -5 });
    let fled = 0;
    let sued = 0;
    const N = 200;
    for (let seed = 100; seed < 100 + N; seed++) {
      const { ctx, life, e } = mk(seed);
      at(life, 'MH-09');
      const h = buy(ctx, life, false);
      if (!h) continue;
      h.since = 20;
      life.hAge = 24;
      for (let i = 0; i < 12; i++) {
        life.hAge++;
        lifeYear(ctx, life);
      }
      // a life that was taken itself (a raid in a land at war) stops counting the years of the held
      if (e.level > 0) continue;
      if (h.gone === 'fled') fled++;
      if (e.counts.sued > 0) sued++;
      expect(h.trust).toBeGreaterThanOrEqual(-5);
      if (!h.gone) expect(h.trust).toBe(-5);
    }
    expect(fled / N).toBeGreaterThan(0.2);
    expect(fled / N).toBeLessThan(0.4);
    expect(sued / N).toBeGreaterThan(0.06);
    expect(sued / N).toBeLessThan(0.22);
  });
});

describe('bondage: the first years of a life', () => {
  it('is born bound by the share of class 1 of the stance: M 25% B2 and 35% B3, D 30% B2 and no B3, none in A', () => {
    const { ctx, life } = mk(1000);
    const count = (country: string, n: number) => {
      const out = { b2: 0, b3: 0, free: 0 };
      for (let seed = 0; seed < n; seed++) {
        life.country = country;
        life.cls = 'c1';
        life.hAge = 0;
        bondageSystem.birth!(ctx);
        const lv = extOf(life).level;
        if (lv === 2) out.b2++;
        else if (lv === 3) out.b3++;
        else out.free++;
      }
      return out;
    };
    const m = count('MH-09', 400);
    expect(m.b2 / 400).toBeGreaterThan(0.18);
    expect(m.b2 / 400).toBeLessThan(0.32);
    expect(m.b3 / 400).toBeGreaterThan(0.28);
    expect(m.b3 / 400).toBeLessThan(0.42);
    const d = count('SH-01', 300);
    expect(d.b3).toBe(0);
    expect(d.b2 / 300).toBeGreaterThan(0.22);
    expect(d.b2 / 300).toBeLessThan(0.38);
    const a = count('AL-06', 100);
    expect(a.b2 + a.b3).toBe(0);
  });
});
