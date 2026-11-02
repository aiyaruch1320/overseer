// Bondage (docs/systems/economy/10-bondage.md): the levels B0 to B3 of the main character, how he enters and leaves them, the price of freedom,
// the way across the border, and the persons he holds, redeems or helps to flee.
import type { Ctx } from '../game';
import { write } from '../log';
import { apply } from '../rules';
import { openLine, type StoryExt } from '../story';
import type { LifeState } from '../types';
import type { StanceId } from '../data/types-bondage';
import { idx as characterIdx } from '../character/data';
import { setClass } from '../character/life';
import { classNum } from '../character/data';
import { contractWork } from '../character/jobs';
import { addNpcTie, addTie, extOf as bondsExt, startArc } from '../bonds';
import { personName, peopleCode } from '../text';
import { holderPlace, rowOf, slotOf } from '../bonds/npcs';
import { syncLine } from './line';
import { bondageIndex, extOf, stanceOf, type BondageExt, type Held, type Level } from './state';
import { ADULT_AGE } from '../character/tuning';
import { CONTRACT_YEARS, ENTRY, FLEE, HOLD_INCOME, OPEN, OWNER_DIES, RANSOM_AFTER_YEARS, RELEASED, SALE_MARGIN, SKILL, WAGE_B1 } from './tuning';

const levelN = (id: string): Level => Number(id.slice(1)) as Level;

// ---------- countries and prices ----------

function countriesOf(ctx: Ctx, stances: StanceId[], continent?: string): string[] {
  return characterIdx(ctx).countryList.filter((c) => stances.includes(stanceOf(ctx, c.id)) && (!continent || c.continent === continent)).map((c) => c.id);
}

function wOf(ctx: Ctx, country: string): number {
  return characterIdx(ctx).countries.get(country)?.w ?? 3;
}

/** The price to buy a person out (10-bondage.md §7), in gold, with the price index of the country. */
export function ransomPrice(ctx: Ctx, level: 1 | 2 | 3, country: string, opt: { skill?: number; debt?: number; years?: number } = {}): number {
  const ix = bondageIndex(ctx);
  const mul = ix.priceIndex(wOf(ctx, country));
  const p = ix.price.get(`B${level}`);
  if (!p) return 0;
  let base: number;
  if (level === 1) base = Math.max(p.min, Math.min(p.max, opt.debt ?? p.min));
  else if (level === 2) base = Math.max(p.min, Math.min(p.max, (opt.years ?? 6) * (p.perContractYear ?? 5) * (0.8 + 0.07 * (opt.skill ?? 1))));
  else base = (p.basePrice ?? 60) * Math.max(1, Math.min(6, opt.skill ?? 1));
  return Math.round(base * mul);
}

/** The nearest country of stance A (the free land, §6): the same continent first. */
export function freeLand(ctx: Ctx, from: string): string | undefined {
  const rng = ctx.rng('bondage.road');
  const cont = from.slice(0, 2);
  const near = countriesOf(ctx, ['A'], cont);
  const all = near.length ? near : countriesOf(ctx, ['A']);
  return all.length ? rng.pick(all) : undefined;
}

// ---------- the stance of the land ----------

/** The level a land allows (a stance table row): B3 is not found where it is illegal or hidden-none (D H); B1 B2 in all but A. */
function allowed(ctx: Ctx, country: string, level: 1 | 2 | 3): boolean {
  const s = bondageIndex(ctx).stances.get(stanceOf(ctx, country));
  if (!s) return false;
  const k = s.legal[`B${level}`];
  return k === 'legal' || k === 'hidden';
}

// ---------- entering ----------

export interface EnterOpt {
  born?: boolean;
  /** Where he is held; defaults to the country he lives in. */
  country?: string;
  note?: string;
}

/**
 * The character falls into bondage by a route of §5. In a country of stance A nobody can be bound: he is carried over the border to the nearest
 * country where the level is allowed (§5 last paragraph). Returns false when no such place exists.
 */
export function enter(ctx: Ctx, life: LifeState, route: string, level: 1 | 2 | 3, opt: EnterOpt = {}): boolean {
  const e = extOf(life);
  if (e.level > 0) return false;
  const rng = ctx.rng('bondage.enter');
  let country = opt.country ?? life.country;
  let lv: 1 | 2 | 3 = level;
  if (!allowed(ctx, country, lv)) {
    // B3 where it is not found becomes a contract; a land that forbids all is left for the nearest that allows
    if (lv === 3 && allowed(ctx, country, 2)) lv = 2;
    else if (!allowed(ctx, country, lv)) {
      const cont = country.slice(0, 2);
      const pool = [...countriesOf(ctx, ['D', 'L', 'M'], cont), ...countriesOf(ctx, ['D', 'L', 'M'])].filter((c) => allowed(ctx, c, lv));
      if (!pool.length) return false;
      country = pool[0] === undefined ? country : rng.pick(pool.slice(0, Math.max(1, Math.min(6, pool.length))));
    }
  }
  const from = life.country;
  e.level = lv;
  e.route = route;
  e.since = life.hAge;
  e.country = country;
  e.born = !!opt.born;
  e.skill = rng.int(SKILL[0], SKILL[1]);
  e.fund = 0;
  e.ransoming = false;
  e.owner = personName(ctx.rng('bondage.names'), { people: peopleCode(ctx, life.race), gender: rng.chance(0.5) ? 'm' : 'f', continent: country.slice(0, 2) });
  e.classBefore = classNum(life);
  if (lv === 1) {
    e.debt = rng.int(20, 150);
    e.debt0 = e.debt;
  }
  if (lv === 2) e.years = rng.int(CONTRACT_YEARS[0], CONTRACT_YEARS[1]);
  e.price = ransomPrice(ctx, lv, country, { skill: e.skill, debt: e.debt, years: e.years });
  e.counts.entered++;
  e.history.push({ age: life.hAge, from: 0, to: lv, how: route });
  if (country !== from) life.country = country;
  setClass(ctx, life, 1, 'bondage');
  // B2 and B3 do the work of the contract (§6), from twenty, the age of the first work; before that the child has none to change
  if (lv >= 2 && life.hAge >= ADULT_AGE) contractWork(ctx, life);
  if (!e.opened.includes('bd')) {
    e.opened.push('bd');
    openLine(ctx, 'bd');
  }
  syncLine(ctx, life);
  write(ctx.state, { sys: 'bondage', kind: 'enter', id: `B${lv}`, data: { route, level: lv, country, owner: e.owner ?? null, price: e.price, moved: country !== from, stance: stanceOf(ctx, country) }, level: 2 });
  return true;
}

// ---------- leaving ----------

export type ExitWay = 'ransom' | 'freed' | 'released' | 'fled' | 'term' | 'debt' | 'owner';

const EXIT_NAME: Record<ExitWay, string> = { ransom: 'ไถ่ตัวเอง', freed: 'ถูกไถ่', released: 'ถูกปล่อย', fled: 'หนีข้ามแดน', term: 'ครบกำหนด', debt: 'ชำระหนี้ครบ', owner: 'ตายพันธะ' };

/** The lowest class of a free person: B1 to B3 are the class 1 together (§2) and every way out of them is the step 1 to 2 of economy/03-classes.md §5. */
const FREE_CLASS_MIN = 2;

/**
 * The character is free (B0) by any way out of §6, and gets back the class he would have: the one he had before bondage, and not under the step out of
 * class 1 (M3 review R1; the rows of §6 all say "เป็น B0", and the class 1 of bondage is not a class a free man keeps). `paid` is the gold that left the purse
 * for the ransom (M3 review B3), which the log tells with the purse left; a paid-off B1 debt carries the debt that the wages cleared (`paid`, `payBy: 'wage'`).
 */
export function leave(ctx: Ctx, life: LifeState, how: ExitWay, paid = 0): boolean {
  const e = extOf(life);
  if (e.level === 0) return false;
  const from = e.level;
  const debt0 = e.debt0;
  e.level = 0;
  e.history.push({ age: life.hAge, from, to: 0, how });
  e.counts.exits++;
  e.debt = undefined;
  e.debt0 = undefined;
  e.years = undefined;
  e.ransoming = false;
  const wage = how === 'debt' && paid === 0 && !!debt0;
  const now = classNum(life);
  const to = Math.max(e.classBefore ?? 1, FREE_CLASS_MIN);
  if (to > now) setClass(ctx, life, to, 'bondage.exit');
  const steps = Math.max(0, classNum(life) - now);
  e.classBefore = undefined;
  syncLine(ctx, life);
  write(ctx.state, {
    sys: 'bondage', kind: 'exit', id: how,
    data: { way: EXIT_NAME[how], from, classUp: steps === 1, classSteps: steps, paid: wage ? debt0! : paid, payBy: wage ? 'wage' : paid > 0 ? 'purse' : 'none', gold: life.gold, owner: e.owner ?? null, years: life.hAge - (e.since ?? life.hAge) },
    level: 2,
  });
  return true;
}

/** A try to cross the border to the free land (bd.a2 way b): on arrival he is free at once; a land that chases back may take him again. */
export function flee(ctx: Ctx, life: LifeState): 'free' | 'caught' | 'none' {
  const e = extOf(life);
  if (e.level === 0) return 'none';
  const rng = ctx.rng('bondage.road');
  const land = freeLand(ctx, e.country ?? life.country);
  const near = !!land && land.slice(0, 2) === (e.country ?? life.country).slice(0, 2);
  const stance = bondageIndex(ctx).stances.get(stanceOf(ctx, e.country ?? life.country));
  let p = land ? (near ? FLEE.near : FLEE.far) : 0;
  if (stance?.chaseBack) p *= 1 - (1 - FLEE.chaseBack) / 2;
  e.counts.escapes++;
  if (land && rng.chance(p)) {
    life.country = land;
    leave(ctx, life, 'fled');
    write(ctx.state, { sys: 'bondage', kind: 'escape', id: land, data: { ok: true, to: land }, level: 2 });
    return 'free';
  }
  write(ctx.state, { sys: 'bondage', kind: 'escape', id: land ?? '', data: { ok: false, to: land ?? null }, level: 2 });
  return 'caught';
}

// ---------- the allies that freed persons may become (§8) ----------

/** A freed, redeemed or helped person is a candidate for the character's bonds at the written chance (40% redeem or free, 50% help). */
export function allyFrom(ctx: Ctx, life: LifeState, who: { name: string; npc?: string }, pct: number): boolean {
  const rng = ctx.rng('bondage.ally');
  if (!rng.chance(pct)) return false;
  const e = extOf(life);
  const rule = bondageIndex(ctx).data.gratitude;
  let t = who.npc ? addNpcTie(ctx, life, who.npc, 'สหาย', 2, 'redeem') : undefined;
  if (!t) {
    const k = rng.weighted([60, 20, 20]);
    t = addTie(ctx, life, { line: k === 0 ? 'สหาย' : k === 1 ? 'ศิษย์' : 'คู่หู', b: 30, from: 'redeem', name: who.name, race: 'any', gratitude: rule.redeem });
  }
  t.bound = undefined;
  t.b = Math.max(t.b, 30);
  t.gratitude = Math.max(t.gratitude, rule.redeem);
  if (!t.arc) startArc(ctx, life, t);
  e.counts.allies++;
  return true;
}

// ---------- persons the character holds ----------

const BOUND_NPCS = ['MH09-7', 'NR05-7', 'SH01-7', 'MK16-7'];

/** One of the written bound persons who lives in the country and is still bound by the world (a fixed row of the roster). */
function boundNpc(ctx: Ctx, life: LifeState, e: BondageExt, country: string): { id: string; name: string } | undefined {
  if (!ctx.data.npcs) return undefined;
  const be = bondsExt(life);
  for (const id of BOUND_NPCS) {
    if (e.held.some((h) => h.npc === id) || Object.values(be.ties).some((t) => t.npc === id)) continue;
    const slot = slotOf(ctx, id);
    if (!slot || slot.status !== 'alive' || slot.gen > 1) continue;
    if (holderPlace(slot, rowOf(ctx, id)) !== country) continue;
    return { id, name: slot.name };
  }
  return undefined;
}

/** The character buys a person (bo.a1): his price is paid, the buyer's cost is on his name, the person has a story of his own (§8 "ผู้ซื้อ"). */
export function buy(ctx: Ctx, life: LifeState, release: boolean): Held | undefined {
  const e = extOf(life);
  const rng = ctx.rng('bondage.buy');
  const country = life.country;
  const stance = stanceOf(ctx, country);
  if (!['D', 'L', 'M'].includes(stance)) return undefined;
  const level: 2 | 3 = stance === 'D' ? 2 : rng.chance(0.55) ? 3 : 2;
  const skill = rng.int(SKILL[0], SKILL[1]);
  let price = ransomPrice(ctx, level, country, { skill, years: rng.int(CONTRACT_YEARS[0], CONTRACT_YEARS[1]) });
  // what he can pay: a cheaper person when his purse is thin
  if (price > life.gold) {
    const cheaper = ransomPrice(ctx, 2, country, { skill: 1, years: 4 });
    if (cheaper > life.gold) return undefined;
    price = cheaper;
  }
  apply(ctx, [{ k: 'stat', stat: 'gold', delta: -price }], { sys: 'bondage', id: 'buy' });
  const bn = boundNpc(ctx, life, e, country);
  const people = peopleCode(ctx, life.race);
  const h: Held = {
    id: `H${e.counts.bought + 1}`, name: bn?.name ?? personName(ctx.rng('bondage.names'), { people, gender: rng.chance(0.5) ? 'm' : 'f', continent: country.slice(0, 2) }),
    level: level === 3 ? 'B3' : 'B2', since: life.hAge, country, skill, price, npc: bn?.id, trust: 0, good: true,
  };
  e.held.push(h);
  e.counts.bought++;
  // exposure: the free lands trust him less (§8: 30% in the node)
  if (rng.chance(0.3)) apply(ctx, [{ k: 'trust', toward: 'ประเทศท่าที A', delta: -2 }], { sys: 'bondage', id: 'buy' });
  write(ctx.state, { sys: 'bondage', kind: 'buy', id: h.id, data: { name: h.name, level: h.level, price, country, npc: h.npc ?? null }, level: 1 });
  if (release) free(ctx, life, h, 'freed', 'freed');
  return h;
}

/** A held person goes out of the book: freed, sold, crossed, fled. A freed one owes his freedom and may become an ally. */
export function free(ctx: Ctx, life: LifeState, h: Held, how: 'freed' | 'crossed' | 'helped', _why: string): void {
  if (h.gone) return;
  h.gone = how;
  const e = extOf(life);
  const d = bondageIndex(ctx).data;
  e.counts.freed++;
  apply(ctx, [{ k: 'stat', stat: 'บุญคุณ', delta: how === 'crossed' ? 4 : d.gratitude.free }], { sys: 'bondage', id: 'free' });
  allyFrom(ctx, life, h, how === 'crossed' || how === 'helped' ? d.allyChance.helper : d.allyChance.redeemOrFree);
  write(ctx.state, { sys: 'bondage', kind: 'free', id: h.id, data: { name: h.name, how }, level: 1 });
}

/** He sells the person to another buyer (bo.a3 way b): gold from the margin, trust down, and the person is bitter. */
export function sell(ctx: Ctx, life: LifeState, h: Held): void {
  if (h.gone) return;
  h.gone = 'sold';
  const e = extOf(life);
  const rng = ctx.rng('bondage.buy');
  const gain = Math.round(h.price * (1 + rng.next() * (SALE_MARGIN[1] - SALE_MARGIN[0]) + SALE_MARGIN[0]));
  apply(ctx, [{ k: 'stat', stat: 'gold', delta: gain }, { k: 'trust', toward: '', delta: -2 }], { sys: 'bondage', id: 'sell' });
  e.counts.sold++;
  write(ctx.state, { sys: 'bondage', kind: 'sell', id: h.id, data: { name: h.name, gain }, level: 1 });
}

/** The income a held person's work adds (§8): +10% when treated well, +5% when strained, at most +15% in all. */
export function heldIncomeBonus(ctx: Ctx): number {
  const life = ctx.state.life;
  if (!life) return 0;
  const cap = bondageIndex(ctx).data.roleRules.buyer.incomeBonusMax;
  return Math.min(Math.round(cap * 100), extOf(life).held.filter((h) => !h.gone).reduce((n, h) => n + (h.good ? HOLD_INCOME.good : HOLD_INCOME.strained), 0));
}

// ---------- a life year ----------

/**
 * Can the bound character pay his ransom out of the purse now? He sets out to when he decided to (bd.a2 way a); otherwise he does when he has been bound
 * RANSOM_AFTER_YEARS and the gold is enough (10-bondage.md §7 "ไถ่เองเมื่อถูกผูกครบ 4 ปีและทองพอ"), whatever his age and level: the doc has no other rule.
 */
export function canRansom(life: LifeState, e: BondageExt): boolean {
  if (e.level === 0 || e.price <= 0 || life.gold < e.price) return false;
  if (e.ransoming) return true;
  return life.hAge - (e.since ?? life.hAge) >= RANSOM_AFTER_YEARS;
}

/** Once a year: the bound person pays down, the contract runs, the owner may die or let go; the free one may fall into bondage or open a line. */
export function lifeYear(ctx: Ctx, life: LifeState): void {
  const e = extOf(life);
  const rng = ctx.rng('bondage.year');
  syncLine(ctx, life);
  if (e.level > 0) {
    const country = e.country ?? life.country;
    if (e.level === 1) {
      const wage = rng.int(WAGE_B1[0], WAGE_B1[1]) * bondageIndex(ctx).incomeIndex(wOf(ctx, country));
      const cut = bondageIndex(ctx).data.prices[0].wageCut ?? [0.3, 0.6];
      e.debt = Math.max(0, (e.debt ?? 0) - Math.round(wage * (cut[0] + rng.next() * (cut[1] - cut[0]))));
      e.price = ransomPrice(ctx, 1, country, { debt: e.debt });
      if ((e.debt ?? 0) <= 0) return void leave(ctx, life, 'debt');
    } else {
      // what a bound person keeps back in a year is the net of the economy system (income × 0.2, living 0 to 1: 10-bondage.md §7 "2 ถึง 14 ทอง"), it lands in the purse
      if (e.level === 2) {
        e.years = (e.years ?? 1) - 1;
        e.price = ransomPrice(ctx, 2, country, { skill: e.skill, years: e.years });
        if ((e.years ?? 0) <= 0) return void leave(ctx, life, 'term');
      }
      if (e.level === 3 && rng.chance(OWNER_DIES)) return void leave(ctx, life, 'owner');
    }
    if (rng.chance(RELEASED)) return void leave(ctx, life, 'released');
    // he buys his freedom with the gold he holds, the whole price, or not at all (10-bondage.md §6 "ไถ่ตัวเอง: เก็บเงินได้ตามราคาไถ่")
    if (canRansom(life, e)) {
      const price = e.price;
      life.gold -= price;
      return void leave(ctx, life, 'ransom', price);
    }
    return;
  }
  holdYear(ctx, life, e);
  enterYear(ctx, life, e);
  openYear(ctx, life, e);
}

function holdYear(ctx: Ctx, life: LifeState, e: BondageExt): void {
  const rng = ctx.rng('bondage.hold');
  const d = bondageIndex(ctx).data.hold;
  for (const h of e.held) {
    if (h.gone) continue;
    const years = life.hAge - h.since;
    if (years > 0 && years % 2 === 0) h.trust = Math.max(d.ownerTrustFloor, h.trust + d.ownerTrustPerTwoYears);
    if (years === d.year) {
      if (rng.chance(d.escapeChance)) {
        e.counts.escapes++;
        h.gone = 'fled';
        write(ctx.state, { sys: 'bondage', kind: 'escape', id: h.id, data: { ok: true, name: h.name, who: 'held' }, level: 2 });
        if (!e.opened.includes('ab')) {
          e.opened.push('ab');
          openLine(ctx, 'ab');
        }
      } else if (rng.chance(d.suedChance / (1 - d.escapeChance))) {
        e.counts.sued++;
        apply(ctx, [{ k: 'trust', toward: '', delta: -2 }], { sys: 'bondage', id: 'sued' });
        write(ctx.state, { sys: 'bondage', kind: 'sued', id: h.id, data: { name: h.name }, level: 1 });
      }
    }
  }
}

function enterYear(ctx: Ctx, life: LifeState, e: BondageExt): void {
  const rng = ctx.rng('bondage.enter');
  const cls = Number(String(life.cls).replace(/\D/g, '')) || 3;
  const w = wOf(ctx, life.country);
  const s = stanceOf(ctx, life.country);
  const a = life.hAge;
  const inAge = (r: [number, number]) => a >= r[0] && a <= r[1];
  if (s === 'A') return;
  if (inAge(ENTRY.sold.age) && cls <= ENTRY.sold.maxClass && w <= ENTRY.sold.maxW && rng.chance(ENTRY.sold.perYear)) {
    enter(ctx, life, 'ถูกขาย', rng.chance(0.5) ? 2 : 3);
    return;
  }
  if (inAge(ENTRY.debt.age) && cls <= ENTRY.debt.maxClass && life.gold <= ENTRY.debt.maxGold && rng.chance(ENTRY.debt.perYear)) {
    enter(ctx, life, 'เป็นหนี้', 1);
    return;
  }
  if (inAge(ENTRY.captured.age) && ctx.state.world.countryFlags[life.country]?.includes('war') && ['L', 'M', 'D'].includes(s) && rng.chance(ENTRY.captured.perYear * 10)) {
    enter(ctx, life, 'ถูกจับ', 3);
    return;
  }
  if (inAge(ENTRY.selfSale.age) && life.gold <= ENTRY.selfSale.maxGold && cls <= 2 && rng.chance(ENTRY.selfSale.perYear)) {
    enter(ctx, life, 'ขายตัวเอง', 2);
    return;
  }
  if (inAge(ENTRY.court.age) && cls <= 2 && rng.chance(ENTRY.court.perYear)) enter(ctx, life, 'ถูกศาลสั่ง', 2);
}

/** `bo` opens for a character with the means in a land of D L M, `ab` in any land (27-bondage.md §2 rules 3 and 4). */
function openYear(ctx: Ctx, life: LifeState, e: BondageExt): void {
  const rng = ctx.rng('bondage.open');
  const a = life.hAge;
  const cls = Number(String(life.cls).replace(/\D/g, '')) || 3;
  const s = stanceOf(ctx, life.country);
  if (!e.opened.includes('bo') && a >= OPEN.bo.age[0] && a <= OPEN.bo.age[1] && ['D', 'L', 'M'].includes(s) && life.gold >= OPEN.bo.minGold && cls >= OPEN.bo.minClass && rng.chance(OPEN.bo.perYear)) {
    e.opened.push('bo');
    openLine(ctx, 'bo');
  }
  if (!e.opened.includes('ab') && a >= OPEN.ab.age[0] && a <= OPEN.ab.age[1] && rng.chance(OPEN.ab.perYear)) {
    e.opened.push('ab');
    openLine(ctx, 'ab');
  }
}

export { levelN };
