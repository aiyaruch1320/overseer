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
import { ensureJob, grantJob } from '../../src/core/character';
import { canRansom, lifeYear } from '../../src/core/bondage/engine';
import { setWays } from '../../src/core/bondage/line';
import { readStat } from '../../src/core/rules';
import { chooseEnding, endingCandidates } from '../../src/core/story';
import { BOUND_ENDING } from '../../src/core/story/ending';
import { RANSOM_AFTER_YEARS } from '../../src/core/bondage/tuning';
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

  it('every way out of bondage gives back the class he had before it, and not under the second (M3 review R1; 10-bondage.md §6)', () => {
    const { ctx, life, e } = mk(4);
    at(life, 'MH-09');
    life.job = 'smith';
    const before = life.cls;
    expect(before).not.toBe('c1');
    const ways = ['ransom', 'freed', 'released', 'fled', 'term', 'debt', 'owner'] as const;
    for (const how of ways) {
      enter(ctx, life, 'เป็นหนี้', 2);
      expect(life.cls).toBe('c1');
      expect(leave(ctx, life, how)).toBe(true);
      expect(e.level).toBe(0);
      expect(life.cls, how).toBe(before);
      expect(leave(ctx, life, how)).toBe(false);
    }
    // one born bound (or already of class 1 when he fell) comes out of it to the class above, whichever way
    life.cls = 'c1';
    for (const how of ways) {
      life.cls = 'c1';
      enter(ctx, life, 'เกิดในพันธะ', 3, { born: true });
      leave(ctx, life, how);
      expect(life.cls, how).toBe('c2');
    }
    expect(e.history.filter((h) => h.to === 0).map((h) => h.how)).toEqual([...ways, ...ways]);
  });

  it('the exit of a paid-off B1 debt and of a ransom carry the price paid (M3 review R4)', () => {
    const { ctx, life } = mk(11);
    at(life, 'MH-09');
    enter(ctx, life, 'เป็นหนี้', 1);
    const e = life.ext.bondage as { debt: number; debt0: number };
    e.debt = 55;
    e.debt0 = 55;
    leave(ctx, life, 'debt');
    let x = ctx.state.log.filter((l) => l.sys === 'bondage' && l.kind === 'exit').at(-1)!;
    expect(x.data.paid).toBe(55);
    expect(x.data.payBy).toBe('wage');
    enter(ctx, life, 'ถูกขาย', 2);
    life.gold = 90;
    leave(ctx, life, 'ransom', 46);
    x = ctx.state.log.filter((l) => l.sys === 'bondage' && l.kind === 'exit').at(-1)!;
    expect(x.data.paid).toBe(46);
    expect(x.data.payBy).toBe('purse');
    enter(ctx, life, 'ถูกขาย', 2);
    leave(ctx, life, 'term');
    x = ctx.state.log.filter((l) => l.sys === 'bondage' && l.kind === 'exit').at(-1)!;
    expect(x.data.paid).toBe(0);
  });

  it('a debt is paid down a year at a time and the bound person is free when it is gone; a contract runs out; the gold in the purse buys freedom, the whole price', () => {
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
    life.gold = 500;
    life.hAge = 30;
    e.since = 20;
    lifeYear(ctx, life);
    expect(e.level).toBe(0);
    // the price came out of the purse (M3 review B3), and the exit line tells it
    expect(life.gold).toBe(300);
    const out = ctx.state.log.filter((x) => x.sys === 'bondage' && x.kind === 'exit').at(-1)!;
    expect(out.data).toMatchObject({ paid: 200, gold: 300 });
  });

  it('cannot ransom himself with less gold than the price, whatever he saved: the purse is the only money (B3)', () => {
    const { ctx, life, e } = mk(7);
    at(life, 'MH-09');
    enter(ctx, life, 'ถูกขาย', 3);
    expect(e.level).toBe(3);
    life.hAge = 40;
    e.since = 20;
    e.ransoming = true;
    e.price = 300;
    e.fund = 5000; // an old save: it counts for nothing
    life.gold = 299;
    expect(canRansom(life, e)).toBe(false);
    for (let i = 0; i < 5 && e.level > 0; i++) {
      life.gold = Math.min(life.gold, 299);
      lifeYear(ctx, life);
    }
    // a free ending by luck (an owner who dies, a pardon) leaves the purse as it was; a ransom never does
    if (e.history.at(-1)!.how === 'ransom') throw new Error('ransomed with too little gold');
    life.gold = 300;
    expect(canRansom(life, e)).toBe(e.level > 0);
  });

  it('thinks of buying his freedom only after some years bound, unless he decided to (bd.a2 way a); a free man pays nothing', () => {
    const { ctx, life, e } = mk(8);
    at(life, 'AZ-03', 900);
    enter(ctx, life, 'ถูกขาย', 3);
    life.hAge = 30;
    e.price = 100;
    e.since = 30;
    expect(canRansom(life, e)).toBe(false);
    e.ransoming = true;
    expect(canRansom(life, e)).toBe(true);
    e.ransoming = false;
    e.since = 30 - RANSOM_AFTER_YEARS;
    expect(canRansom(life, e)).toBe(true);
    leave(ctx, life, 'released');
    expect(canRansom(life, e)).toBe(false);
  });

  it('a young bound life with the gold buys himself out after the same years: the doc has no age for it (M3 review R9)', () => {
    const { ctx, life, e } = mk(12);
    at(life, 'MH-09', 900);
    enter(ctx, life, 'ถูกขาย', 2);
    life.hAge = 17;
    e.since = 17 - RANSOM_AFTER_YEARS;
    e.price = 46;
    life.gold = 380;
    expect(canRansom(life, e)).toBe(true);
    life.gold = 45;
    expect(canRansom(life, e)).toBe(false);
  });

  it('at B2 and B3 his work is the contract\'s, of the work that needs no rights; at B1 he keeps his own (M3 review R3)', () => {
    const work = ['servant', 'miner', 'courier', 'woodcutter'];
    for (const level of [2, 3] as const) {
      const { ctx, life } = mk(20 + level);
      at(life, 'MH-09', 50);
      life.hAge = 25;
      life.job = 'smith';
      expect(enter(ctx, life, 'ถูกขาย', level)).toBe(true);
      expect(work).toContain(life.job);
      expect(grantJob(ctx, 'smith', { sys: 'story', id: 'x' }, { force: true })).toBe(false);
      expect(ensureJob(ctx, life)).toBeNull();
      expect(work).toContain(life.job);
    }
    // a child bound before twenty has no work yet; at twenty he is given the contract's, not offered a trade
    const c = mk(30);
    at(c.life, 'MH-09', 0);
    c.life.hAge = 15;
    c.life.job = undefined;
    enter(c.ctx, c.life, 'ถูกขาย', 2);
    expect(c.life.job).toBeUndefined();
    c.life.hAge = 20;
    expect(work).toContain(ensureJob(c.ctx, c.life));
    // B1 is a debtor who works like a free man
    const d = mk(31);
    at(d.life, 'MH-09', 0);
    d.life.hAge = 25;
    d.life.job = 'smith';
    enter(d.ctx, d.life, 'เป็นหนี้', 1);
    expect(d.life.job).toBe('smith');
  });

  it('keeps no separate fund: what a bound person puts by in a year is the net of the economy, in the purse (§7 "2 ถึง 14 ทอง")', () => {
    const { ctx, life, e } = mk(6);
    at(life, 'AZ-03');
    enter(ctx, life, 'ถูกขาย', 3);
    e.price = 99999;
    lifeYear(ctx, life);
    expect(e.fund).toBe(0);
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

  it('the line bd starts at the node of the route: a debt at 25 is not "born in bondage" nor "sold"; a sale at 14 begins at bd.t1', () => {
    const { ctx, life } = mk(15);
    at(life, 'MH-09');
    enter(ctx, life, 'เป็นหนี้', 1);
    const ex = life.ext.story as { skipped: string[] };
    expect(ex.skipped).toEqual(expect.arrayContaining(['bd.b1', 'bd.t1']));
    expect(ex.skipped).not.toContain('bd.a1');
    leave(ctx, life, 'released');
    const m = mk(16);
    at(m.life, 'MH-09');
    enter(m.ctx, m.life, 'ถูกขาย', 3);
    const ex2 = m.life.ext.story as { skipped: string[] };
    expect(ex2.skipped).toContain('bd.b1');
    expect(ex2.skipped).not.toContain('bd.t1');
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
      let taken = false;
      for (let i = 0; i < 12; i++) {
        life.hAge++;
        lifeYear(ctx, life);
        if (e.level > 0) taken = true;
      }
      // a life that was taken itself at any time (a raid in a land at war) stops counting the years of the held while it is held
      if (taken) continue;
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

describe('bondage: the line bd follows the state of the life (M3 review B2)', () => {
  const skipped = (life: LifeState) => (life.ext.story as { skipped: string[] }).skipped;
  const mods = (life: LifeState, node: string) => (life.ext.story as { nodeMods: { node: string; label?: string; mul: number }[] }).nodeMods.filter((m) => m.node === node);

  it('parks "หลังพ้นพันธะ" while he is bound and brings it back when he is free; parks "ทางออก" and "รับใช้" once he is free and brings them back if he is bound again', () => {
    const { ctx, life, e } = mk(61);
    at(life, 'MH-09');
    life.hAge = 25;
    enter(ctx, life, 'ถูกขาย', 3);
    expect(skipped(life)).toContain('bd.a3');
    expect(skipped(life)).toContain('bd.b1'); // not born in bondage
    for (const id of ['bd.t1', 'bd.a1', 'bd.a2', 'bd.e1']) expect(skipped(life), id).not.toContain(id);
    expect(e.parked).toEqual(expect.arrayContaining(['bd.a3', 'bd.b1']));
    leave(ctx, life, 'released');
    expect(skipped(life)).not.toContain('bd.a3');
    for (const id of ['bd.t1', 'bd.a1', 'bd.a2']) expect(skipped(life), id).toContain(id);
    expect(skipped(life)).not.toContain('bd.e1');
    expect(e.parked).not.toContain('bd.a3');
    enter(ctx, life, 'ถูกจับ', 3);
    for (const id of ['bd.a1', 'bd.a2']) expect(skipped(life), id).not.toContain(id);
    expect(skipped(life)).toContain('bd.a3');
    expect(e.parked).toContain('bd.a3');
  });

  it('never parks or brings back a node that was played, nor one the story itself skipped', () => {
    const { ctx, life } = mk(62);
    at(life, 'MH-09');
    life.passed['bd.a1'] = 'a';
    (life.ext.story as { skipped: string[] }).skipped.push('bd.a2');
    enter(ctx, life, 'ถูกขาย', 3);
    leave(ctx, life, 'released');
    expect(skipped(life)).not.toContain('bd.a1');
    enter(ctx, life, 'ถูกจับ', 3);
    leave(ctx, life, 'released');
    expect(skipped(life).filter((x) => x === 'bd.a2')).toHaveLength(1);
    expect(extOf(life).parked).not.toContain('bd.a2');
  });

  it('a route that starts later does not play the nodes before it: a debt is not a sale, a birth in bondage is bd.b1', () => {
    const debt = mk(63);
    at(debt.life, 'MH-09');
    debt.life.hAge = 25;
    enter(debt.ctx, debt.life, 'เป็นหนี้', 1);
    expect(skipped(debt.life)).toEqual(expect.arrayContaining(['bd.b1', 'bd.t1']));
    expect(skipped(debt.life)).not.toContain('bd.a1');
    const born = mk(64);
    at(born.life, 'MH-09');
    born.life.hAge = 0;
    enter(born.ctx, born.life, 'เกิดในพันธะ', 2, { born: true });
    expect(skipped(born.life)).not.toContain('bd.b1');
    expect(skipped(born.life)).not.toContain('bd.t1');
  });

  it('weighs the ways before a node of bd is decided: only a bound life takes "ยังไม่พ้นพันธะ ตายในสัญญา", only a free one "ไถ่ผู้อื่น"', () => {
    const { ctx, life } = mk(65);
    at(life, 'MH-09');
    enter(ctx, life, 'ถูกขาย', 3);
    const node = {} as never;
    setWays(ctx, life, node, 'bd.e1');
    expect(mods(life, 'bd.e1').find((m) => m.label === 'ยังไม่พ้นพันธะ')!.mul).toBeGreaterThan(1);
    expect(mods(life, 'bd.e1').find((m) => m.label === 'ไถ่ผู้อื่น')!.mul).toBe(0);
    leave(ctx, life, 'released');
    setWays(ctx, life, node, 'bd.e1');
    expect(mods(life, 'bd.e1').find((m) => m.label === 'ยังไม่พ้นพันธะ')!.mul).toBe(0);
    expect(mods(life, 'bd.e1').find((m) => m.label === 'ไถ่ผู้อื่น')).toBeUndefined(); // ×1 sets nothing
    expect(mods(life, 'bd.e1')).toHaveLength(1);
    // a mod the story or another system put there stays
    (life.ext.story as { nodeMods: unknown[] }).nodeMods.push({ node: 'bd.e1', label: 'x', mul: 2 });
    setWays(ctx, life, node, 'bd.e1');
    expect(mods(life, 'bd.e1')).toHaveLength(2);
    // bd.b1: the way of a B0 child ("ไม่ผูกสัญญา") is shut for a life that is bound
    const b = mk(66);
    at(b.life, 'MH-09');
    b.life.hAge = 0;
    enter(b.ctx, b.life, 'เกิดในพันธะ', 2, { born: true });
    setWays(b.ctx, b.life, node, 'bd.b1');
    expect(mods(b.life, 'bd.b1').find((m) => m.label === 'ไม่ผูกสัญญา')!.mul).toBe(0);
  });

  it('the node itself is decided by the weights: the story\'s `before` hook sets them and a bound elder is never told he was ransomed', () => {
    const real = bondageIndex(mk(1).ctx);
    expect(real.data.routes.length).toBeGreaterThan(0);
    const { ctx, life } = mk(67);
    at(life, 'MH-09');
    enter(ctx, life, 'ถูกขาย', 3);
    const ix = (ctx.data.storylines.items as { nodes: { id: string; choices: { key: string; label: string }[] }[] }).nodes.find((n) => n.id === 'bd.e1')!;
    for (const c of ix.choices) expect(['a', 'b', 'c']).toContain(c.key);
    for (const m of [['ยังไม่พ้นพันธะ', 'c'], ['ไถ่ผู้อื่น', 'b']]) expect(ix.choices.find((c) => c.label.includes(m[0]))!.key).toBe(m[1]);
  });

  it('answers to the stats a node or a condition may ask: bondage.level, bondage.exits, bondage.years', () => {
    const { ctx, life } = mk(68);
    at(life, 'MH-09');
    life.hAge = 25;
    expect(readStat(ctx, 'bondage.exits')).toBe(0);
    enter(ctx, life, 'ถูกขาย', 3);
    life.hAge = 30;
    expect(readStat(ctx, 'bondage.level')).toBe(3);
    expect(readStat(ctx, 'bondage.years')).toBe(5);
    leave(ctx, life, 'released');
    life.hAge = 40;
    expect(readStat(ctx, 'bondage.level')).toBe(0);
    expect(readStat(ctx, 'bondage.exits')).toBe(1);
    expect(readStat(ctx, 'bondage.years')).toBe(5);
  });
});

describe('bondage: the ending reads the state at death (M3 review B4)', () => {
  const die = (life: LifeState, ctx: Ctx) => {
    life.dead = { year: ctx.state.clock.worldYear, hAge: life.hAge, cause: 'old' };
  };
  const told = (ctx: Ctx) => ctx.state.log.filter((x) => x.sys === 'story' && x.kind === 'ending');

  it('a life that dies in bondage is told the ending of one who was held, and never the plain "survived" one', () => {
    for (let seed = 71; seed < 79; seed++) {
      const { ctx, life } = mk(seed);
      at(life, 'MH-09');
      life.hAge = 60;
      enter(ctx, life, 'ถูกขาย', 3);
      expect(endingCandidates(ctx).map((c) => c.title)).toContain(BOUND_ENDING.title);
      die(life, ctx);
      expect(endingCandidates(ctx).find((c) => c.title === BOUND_ENDING.title)!.weight).toBe(BOUND_ENDING.weight);
      expect(chooseEnding(ctx)).toBe(BOUND_ENDING.title);
      expect(told(ctx)).toHaveLength(1);
      expect(told(ctx)[0].data).toMatchObject({ bound: 3, freed: false, cause: 'old' });
    }
  });

  it('a life that was freed, or never bound, is not told it; the log says what he was at death', () => {
    const { ctx, life } = mk(80);
    at(life, 'MH-09');
    life.hAge = 60;
    enter(ctx, life, 'ถูกขาย', 3);
    leave(ctx, life, 'released');
    die(life, ctx);
    expect(endingCandidates(ctx).map((c) => c.title)).not.toContain(BOUND_ENDING.title);
    chooseEnding(ctx);
    expect(told(ctx)[0]?.data).toMatchObject({ bound: 0, freed: true });
    const never = mk(81);
    at(never.life, 'MH-09');
    die(never.life, never.ctx);
    expect(endingCandidates(never.ctx).map((c) => c.title)).not.toContain(BOUND_ENDING.title);
    chooseEnding(never.ctx);
    expect(told(never.ctx)[0]?.data ?? { bound: 0, freed: false }).toMatchObject({ bound: 0, freed: false });
  });
});
