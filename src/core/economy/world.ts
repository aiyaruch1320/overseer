// The economy of the world (P0 data, P2 prices by country): W of each country with the changes of world events, the trust C of the
// central gold, and prices by country and good (01-world-economy.md §1 to §3, §6). The numbers are kept in `state.world.vars`:
//   eco.C trust · eco.Cy world year it was brought up to · eco.wr year the last WR event stops holding the recovery
//   eco.seen:<event> the event was read · eco.f:<event>:<w|p><n>:<country> a flagged country the event reached
//   eco.w.<country> W now · eco.p.<country>.<good> price now (read-only copies for screens; the functions below compute them)
import type { Ctx } from '../game';
import { eco, GOODS, type CountryEco, type EcoIndex, type GoodId } from './data';
import { eventEcon, reaches, type EventEcon, type PriceShock } from './events';
import { TRUST_ERA4_CAP, TRUST_RECOVER, W_DECAY_YEARS, WR_ACTIVE_YEARS } from './tuning';

const vars = (ctx: Ctx) => ctx.state.world.vars;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const worldYear = (ctx: Ctx) => ctx.state.clock.worldYear;

const flagKey = (id: string, kind: 'w' | 'p', n: number, cid: string) => `eco.f:${id}:${kind}${n}:${cid}`;

function inBand(seg: { minW?: number; maxW?: number; notLittle?: boolean }, c: CountryEco): boolean {
  if (seg.minW !== undefined && c.w < seg.minW) return false;
  if (seg.maxW !== undefined && c.w > seg.maxW) return false;
  if (seg.notLittle && c.m === 'little') return false;
  return true;
}

// ---------- reading the events ----------

/** Reads the events that happened since the last read: the trust C moves, and the countries a flag-bound change reaches are marked. */
export function syncEvents(ctx: Ctx): void {
  const E = eco(ctx);
  if (!E) return;
  const v = vars(ctx);
  const specs = eventEcon(ctx);
  const happened = ctx.state.world.happened;
  const fresh: { id: string; year: number }[] = [];
  for (const id in happened) if (v[`eco.seen:${id}`] === undefined && specs.has(id)) fresh.push({ id, year: happened[id] });
  let C = v['eco.C'] ?? E.data.trust.start.before;
  let t = v['eco.Cy'] ?? 0;
  const now = worldYear(ctx);
  fresh.sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
  for (const f of fresh) {
    const spec = specs.get(f.id)!;
    C = recover(ctx, E, C, t, f.year);
    t = Math.max(t, f.year);
    C = clamp(C + spec.c, 0, 100);
    if (f.id.startsWith('WR-')) v['eco.wr'] = f.year + WR_ACTIVE_YEARS;
    v[`eco.seen:${f.id}`] = 1;
    spec.w.forEach((seg, n) => {
      if (!seg.flag) return;
      for (const c of E.list) if (reaches(seg, c) && inBand(seg, c) && ctx.state.world.countryFlags[c.id]?.includes(seg.flag)) v[flagKey(f.id, 'w', n, c.id)] = 1;
    });
    spec.prices.forEach((p, n) => {
      if (!p.flag) return;
      for (const c of E.list) if (reaches(p, c) && inBand(p, c) && ctx.state.world.countryFlags[c.id]?.includes(p.flag)) v[flagKey(f.id, 'p', n, c.id)] = 1;
    });
  }
  C = recover(ctx, E, C, t, now);
  v['eco.C'] = Math.round(C * 100) / 100;
  v['eco.Cy'] = Math.max(t, now);
}

/**
 * C after the years between t0 and t1 pass: +2 a year unless a WR event holds it, back to where it stood (60 before PO-01, 80 after: 01 §1
 * "ค่าตั้งต้น"); in era 4 and later it does not climb past 50 (01 §5). A C above that level (a good event pushed it) does not fall back.
 */
function recover(ctx: Ctx, E: EcoIndex, C: number, t0: number, t1: number): number {
  if (t1 <= t0) return C;
  const v = vars(ctx);
  const free = t1 - Math.max(t0, v['eco.wr'] ?? -Infinity);
  if (free <= 0) return C;
  let level = v['eco.seen:PO-01'] !== undefined ? E.data.trust.start.after : E.data.trust.start.before;
  if (ctx.state.world.era >= 4) level = Math.min(level, TRUST_ERA4_CAP);
  return C >= level ? C : Math.min(level, C + TRUST_RECOVER * free);
}

/** The trust C of the central gold now, 0..100 (01 §1). */
export function trust(ctx: Ctx): number {
  syncEvents(ctx);
  return vars(ctx)['eco.C'] ?? eco(ctx)?.data.trust.start.before ?? 60;
}

// ---------- the events that count now ----------

interface Active {
  id: string;
  year: number;
  spec: EventEcon;
}

/** The events that happened and have an economic effect, built once per operation (a screen asks for many countries at a time). */
function activeEvents(ctx: Ctx): Active[] {
  const specs = eventEcon(ctx);
  const happened = ctx.state.world.happened;
  const out: Active[] = [];
  for (const id in happened) {
    const spec = specs.get(id);
    if (spec && (spec.w.length || spec.prices.length)) out.push({ id, year: happened[id], spec });
  }
  return out;
}

// ---------- W ----------

function wDelta(ctx: Ctx, a: Active, c: CountryEco): number {
  const v = vars(ctx);
  const age = worldYear(ctx) - a.year;
  let broad = 0;
  let explicit: number | undefined;
  a.spec.w.forEach((seg, n) => {
    if (!reaches(seg, c) || !inBand(seg, c)) return;
    if (seg.flag && v[flagKey(a.id, 'w', n, c.id)] === undefined) return;
    let d = seg.delta;
    if (!seg.permanent) {
      if (seg.years !== undefined) d = age < seg.years ? d : 0;
      else {
        const left = Math.max(0, Math.abs(d) - Math.floor(age / W_DECAY_YEARS));
        d = Math.sign(d) * left;
      }
    }
    if (d > 0 && seg.cap !== undefined && c.wBase < 5) d = Math.min(d, Math.max(0, seg.cap - c.w));
    // a segment that names the country replaces what the continent-wide ones of the same event give it
    if (seg.countries) explicit = d;
    else broad += d;
  });
  return explicit ?? broad;
}

function wWith(ctx: Ctx, c: CountryEco, act: Active[]): number {
  let add = 0;
  for (const a of act) if (a.spec.w.length) add += wDelta(ctx, a, c);
  return clamp(Math.round(c.w + add), 1, 5);
}

/** W of a country now: the first-era value with the changes of the events, kept between 1 and 5 (01 §6). */
export function wOf(ctx: Ctx, countryId: string): number {
  const c = eco(ctx)?.countries.get(countryId);
  return c ? wWith(ctx, c, activeEvents(ctx)) : 3;
}

// ---------- prices ----------

/** Deterministic noise in 0..1 from the seed and a key, so a price needs no stored draw. */
function unit(seed: number, key: string): number {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h = Math.imul(h ^ (h >>> 15), h | 1);
  h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
}

function shockWith(ctx: Ctx, c: CountryEco, good: GoodId, act: Active[]): number {
  const v = vars(ctx);
  const now = worldYear(ctx);
  let mul = 1;
  for (const a of act) {
    a.spec.prices.forEach((p: PriceShock, n) => {
      if (p.good !== good || !reaches(p, c)) return;
      if (p.flag && v[flagKey(a.id, 'p', n, c.id)] === undefined) return;
      const age = now - a.year;
      if (age >= p.years) return;
      mul *= 1 + (p.mul - 1) * (1 - age / p.years);
    });
  }
  return mul;
}

/** The price multiplier the trust C puts on prices in gold (01 §3): ×1.1 for 40 to 69, ×1.25 below 40. */
export function trustMul(ctx: Ctx): number {
  const E = eco(ctx);
  if (!E) return 1;
  const C = trust(ctx);
  return C >= 70 ? 1 : C >= 40 ? E.data.priceMods.trustMid : E.data.priceMods.trustLow;
}

function priceWith(ctx: Ctx, E: EcoIndex, c: CountryEco, good: GoodId, act: Active[], tm: number): number {
  const pm = E.data.priceMods;
  const w = wWith(ctx, c, act);
  const status = c.exports.includes(good) ? pm.scarcity.exporter : c.shortages.includes(good) ? pm.scarcity.short : pm.scarcity.enough;
  // the balance of the year moves a good the country makes or lacks by the full swing, an even one by half of it
  const noise = 1 + pm.scarcity.swing * (unit(ctx.state.seed, `${c.id}.${good}.${Math.floor(worldYear(ctx) / 10)}`) * 2 - 1) * (status === pm.scarcity.enough ? 0.5 : 1);
  return E.base[good] * pm.wIndex[w - 1] * status * noise * shockWith(ctx, c, good, act) * tm;
}

/**
 * Price of one trade unit of a good in a country now (01 §3): base × index of W × scarcity × events × trust. The scarcity is the
 * exporter / enough / short factor of the country's trade, and moves ±swing a decade (the balance of the year).
 */
export function priceOf(ctx: Ctx, countryId: string, good: GoodId): number {
  const E = eco(ctx);
  const c = E?.countries.get(countryId);
  if (!E || !c) return 0;
  return priceWith(ctx, E, c, good, activeEvents(ctx), trustMul(ctx));
}

/** How much the events and the trust move the price of food in a country, 1 when nothing does (the part of the cost of living that follows the market). */
export function foodShock(ctx: Ctx, countryId: string): number {
  const E = eco(ctx);
  const c = E?.countries.get(countryId);
  if (!E || !c) return 1;
  return shockWith(ctx, c, 'F', activeEvents(ctx)) * trustMul(ctx);
}

// ---------- the copy screens read ----------

function write(ctx: Ctx, E: EcoIndex, c: CountryEco, act: Active[], tm: number): void {
  const v = vars(ctx);
  v[`eco.w.${c.id}`] = wWith(ctx, c, act);
  for (const g of GOODS) v[`eco.p.${c.id}.${g}`] = Math.round(priceWith(ctx, E, c, g, act, tm) * 100) / 100;
}

/** Writes W and the eight prices of a country into `world.vars`. */
export function writeCountry(ctx: Ctx, countryId: string): void {
  const E = eco(ctx);
  const c = E?.countries.get(countryId);
  if (E && c) write(ctx, E, c, activeEvents(ctx), trustMul(ctx));
}

/** Reads the new events and rewrites the copy for every country (one world step). */
export function syncWorld(ctx: Ctx): void {
  const E = eco(ctx);
  if (!E) return;
  syncEvents(ctx);
  const act = activeEvents(ctx);
  const tm = trustMul(ctx);
  for (const c of E.list) write(ctx, E, c, act, tm);
}
