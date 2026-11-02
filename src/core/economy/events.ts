// What the world events do to the economy (01-world-economy.md §6, data/gen/world-events.json `econ`). The generator keeps the three
// cells of the table as text; this reads them into W changes, price shocks and a change of the trust C.
// A part of a cell that names no country or continent we can find (`ประเทศชายแดน`, `ในเมืองที่ถูกกลืน`) is left out: it is counted in `unresolved`.
import type { Ctx } from '../game';
import { CONTINENTS, type CountryEco, type GoodId } from './data';
import { PRICE_SHOCK_YEARS } from './tuning';

/** A change of W (a segment of the "ผลต่อ W" cell). */
export interface WChange {
  delta: number;
  /** Countries named in the segment: they replace what the continent-wide segments of the same event give them. */
  countries?: string[];
  continents?: string[];
  /** Everything but these. */
  except?: string[];
  /** Filters on the first-era values of the country. */
  minW?: number;
  maxW?: number;
  notLittle?: boolean;
  /** A country flag read when the event is first seen (`war`). */
  flag?: string;
  permanent: boolean;
  /** Full value for this many world years, then gone; undefined = the five-year step of 01 §6. */
  years?: number;
  /** "ไม่เกิน 4": the change does not lift W above this (unless the country began at 5). */
  cap?: number;
}

/** A multiplier of the price of a good (a segment of the "ผลต่อราคา" cell). */
export interface PriceShock {
  good: GoodId;
  mul: number;
  countries?: string[];
  continents?: string[];
  years: number;
  /** Only countries that carry this flag when the event is first seen, and have a first-era W in the band. */
  flag?: string;
  minW?: number;
  maxW?: number;
}

export interface EventEcon {
  id: string;
  /** Change of the trust C ("ผลต่อ C"). */
  c: number;
  w: WChange[];
  prices: PriceShock[];
  /** Segments of the W and price cells we could not place. */
  unresolved: string[];
}

const COUNTRY = /\b(?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}\b/g;
const CONT = /\b(AZ|MH|KD|NR|AL|MK|SH|SV|NB)\b(?!-\d)/g;
/** Words that say "some of the countries" without saying which: a segment with one of these and no code is left out. */
const VAGUE = ['ชายแดน', 'ถูกกลืน', 'ถูกยึด', 'เมืองหลวง', 'ไททัน', 'ประตู', 'ที่หมอก', 'ที่ติดต่อ', 'ผู้ปลูก', 'ผู้ขาย', 'ที่ตก', 'ชายฝั่ง', 'ส่งบรรณาการ', 'ที่ระเบิด', 'ทวีปที่'];
const NUM_WORDS: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10 };

const uniq = <T>(a: T[]) => [...new Set(a)];
const norm = (s: string) => s.replace(/[−–—]/g, '-').replace(/`/g, '');

function years(s: string): number | undefined {
  const d = s.match(/(\d+)\s*ปี/);
  if (d) return Number(d[1]);
  const w = s.match(/(หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)\s*ปี/);
  if (w) return NUM_WORDS[w[1]];
  if (/ทศวรรษ/.test(s)) return 10;
  if (/ฤดู/.test(s)) return 1;
  return undefined;
}

/** Countries and continents a cell names. */
function places(s: string): { countries: string[]; continents: string[] } {
  return { countries: uniq(s.match(COUNTRY) ?? []), continents: uniq([...s.replace(COUNTRY, ' ').matchAll(CONT)].map((m) => m[1])) };
}

function parseW(wealth: string, scope: string, unresolved: string[]): WChange[] {
  const out: WChange[] = [];
  const sc = places(norm(scope));
  const scopeAll = /ทุกทวีป|ทุกประเทศ/.test(scope);
  for (const raw of wealth.split('·')) {
    let s = norm(raw).trim();
    if (!s) continue;
    let except: string[] | undefined;
    const ex = s.match(/ไม่รวม\s*((?:[A-Z]{2}-\d{2}\s*)+)/);
    if (ex) {
      except = ex[1].match(COUNTRY) ?? [];
      s = s.replace(ex[0], ' ');
    }
    const here = places(s);
    const rest = s.replace(COUNTRY, ' ');
    const d = rest.match(/(?:^|[\s(])([+-]\d+)(?!\d)/);
    if (!d || Number(d[1]) === 0) continue;
    const seg: WChange = { delta: Number(d[1]), permanent: /ถาวร/.test(s) };
    const y = years(rest);
    if (y !== undefined && !seg.permanent) seg.years = y;
    const cap = rest.match(/ไม่เกิน\s*(\d)/);
    if (cap) seg.cap = Number(cap[1]);
    if (except) seg.except = except;
    if (here.countries.length) seg.countries = here.countries;
    else {
      if (VAGUE.some((v) => rest.includes(v))) {
        unresolved.push(raw.trim());
        continue;
      }
      if (here.continents.length) seg.continents = here.continents;
      else if (sc.countries.length) seg.countries = sc.countries;
      else if (sc.continents.length) seg.continents = sc.continents;
      else if (!scopeAll) {
        unresolved.push(raw.trim());
        continue;
      }
    }
    const band = rest.match(/W\s*(\d)\s*ถึง\s*(\d)/);
    if (band) {
      seg.minW = Number(band[1]);
      seg.maxW = Number(band[2]);
    }
    const up = rest.match(/W\s*(\d)\s*ขึ้นไป/);
    if (up) seg.minW = Number(up[1]);
    if (/M\s*ผสมหรือเต็ม/.test(rest)) seg.notLittle = true;
    if (/ทำสงคราม|ธง\s*war/.test(rest)) seg.flag = 'war';
    out.push(seg);
  }
  return out;
}

const GOOD_WORDS: [RegExp, GoodId][] = [
  [/อาหาร|ข้าว/, 'F'],
  [/ถ่าน|เหล็กไหล|แร่|อัญมณี/, 'M'],
  [/ผ้า/, 'T'],
  [/ไม้|ของป่า/, 'W'],
  [/ของทะเล|มุก/, 'S'],
  [/ยา/, 'H'],
  [/ของวิเศษ|น้ำเลี้ยง|ศิลาลอย/, 'X'],
  [/จักรกล|อาวุธ|ชิ้นส่วนกลไก/, 'E'],
];

function goodOf(s: string): GoodId | undefined {
  const c = s.match(/\(([FMTWSHXE])\)/);
  if (c) return c[1] as GoodId;
  for (const [re, g] of GOOD_WORDS) if (re.test(s)) return g;
  return undefined;
}

function parsePrices(price: string, scope: string, unresolved: string[]): PriceShock[] {
  const out: PriceShock[] = [];
  const sc = places(norm(scope));
  let last: GoodId | undefined;
  for (const raw of price.split('·')) {
    const s = norm(raw).trim();
    if (!s) continue;
    // transport costs, lamp oil, services and property are not one of the eight goods: P3 (trade) reads them
    if (/ต้นทุน|ศุลกากร|ค่าผ่าน|ภาษีรั่ว|โคม|ที่ดิน|ทหารรับจ้าง|ธนาคาร|ความรู้|บริการ|ของบูชา/.test(s)) continue;
    const mul = s.match(/×\s*(\d+(?:\.\d+)?)/);
    if (!mul) continue;
    const g = goodOf(s) ?? last;
    if (!g) {
      unresolved.push(raw.trim());
      continue;
    }
    last = g;
    const here = places(s);
    const shock: PriceShock = { good: g, mul: Number(mul[1]), years: years(s) ?? PRICE_SHOCK_YEARS };
    if (here.countries.length) shock.countries = here.countries;
    else if (here.continents.length) shock.continents = here.continents;
    else if (sc.countries.length) shock.countries = sc.countries;
    else if (sc.continents.length) shock.continents = sc.continents;
    else if (!/ทุก/.test(scope) && !/ทั่ว/.test(scope)) {
      unresolved.push(raw.trim());
      continue;
    }
    out.push(shock);
  }
  // one good named twice in the same place (BIO-07 "ของทะเล ×1.5 · มุก ×2", PL-03 ore against coal): the stronger one stands, they do not stack
  const best = new Map<string, PriceShock>();
  for (const p of out) {
    const k = `${p.good}|${p.countries ?? ''}|${p.continents ?? ''}`;
    const old = best.get(k);
    if (!old || Math.abs(Math.log(p.mul)) > Math.abs(Math.log(old.mul))) best.set(k, p);
  }
  return [...best.values()];
}

const cache = new WeakMap<object, Map<string, EventEcon>>();

/** The economic effect of every world event that has one, read once per loaded data. */
export function eventEcon(ctx: Ctx): Map<string, EventEcon> {
  const hit = cache.get(ctx.data);
  if (hit) return hit;
  type Row = { id: string; econ?: { scope: string; wealth: string; price: string; c: number } };
  const items = ctx.data['world-events']?.items as { events?: Row[]; branch?: Row[]; lastEra?: Row[] } | undefined;
  const events = [...(items?.events ?? []), ...(items?.branch ?? []), ...(Array.isArray(items?.lastEra) ? items.lastEra : [])];
  const out = new Map<string, EventEcon>();
  for (const e of events) {
    if (!e.econ) continue;
    const unresolved: string[] = [];
    const prices = parsePrices(e.econ.price ?? '', e.econ.scope ?? '', unresolved);
    // "ธง `famine` ประเทศ W 1 ถึง 2 สามปี": the prices of that event hold in the countries the flag marks
    const fl = (e.econ.wealth ?? '').match(/ธง\s*`?(famine|war)`?\s*ประเทศ\s*W\s*(\d)\s*ถึง\s*(\d)\s*(\S*ปี)?/);
    if (fl) {
      const yrs = years(fl[4] ?? '');
      for (const p of prices) Object.assign(p, { flag: fl[1], minW: Number(fl[2]), maxW: Number(fl[3]), years: yrs ?? p.years });
    }
    out.set(e.id, { id: e.id, c: e.econ.c ?? 0, w: parseW(e.econ.wealth ?? '', e.econ.scope ?? '', unresolved), prices, unresolved });
  }
  cache.set(ctx.data, out);
  return out;
}

/** Does this segment name the country (before any flag filter)? */
export function reaches(seg: { countries?: string[]; continents?: string[]; except?: string[] }, c: CountryEco): boolean {
  if (seg.except?.includes(c.id)) return false;
  if (seg.countries) return seg.countries.includes(c.id);
  if (seg.continents) return seg.continents.includes(c.continent);
  return true;
}

export { CONTINENTS };
