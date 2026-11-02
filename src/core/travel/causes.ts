// The causes of a journey (01-travel-rules.md §2): once a life year, for each cause whose condition holds, one roll. A success opens the overlay line
// of 25-journeys.md through the story system and sends the character on a trip. The chances, the age window and the lines come from data/gen/travel.json;
// the conditions that the data keeps as prose are written here.
import type { Ctx } from '../game';
import { classNum, extOf as charExt, holds } from '../character';
import { moveMul } from '../god/acts';
import { write } from '../log';
import { happened } from '../world/access';
import type { LifeState } from '../types';
import { flagsOf } from './access';
import { geo, raceCode, type CountryInfo } from './data';
import { beatOf, statOf, type TravelExt } from './state';
import { go, queueLine } from './trip';
import { ADVENTUROUS_TRAITS, HOLY_PLACES, MIN_AGE, SETTLED_TRAITS, SOLDIER_JOBS, TRIP } from './tuning';
import { pickDestination } from './dest';

type Row = ReturnType<typeof rows>[number];
const rows = (ctx: Ctx) => geo(ctx).travel.causes;

export interface CauseDef {
  /** Key in `ext.stats` and in the log. */
  key: string;
  /** The `cause` text of the data row. */
  row: string;
  /** Is the cause open to this life this year; `mul` is the product of the "(… ×2)" modifiers that hold. */
  eligible(ctx: Ctx, life: LifeState, ex: TravelExt, row: Row): { ok: boolean; mul: number };
  /** A disaster cause is exempt from "one travel event in three years". */
  disaster?: boolean;
  /** `fresh`: the chance applies only in the year the disaster begins (§2 "15% ในปีที่เหตุการณ์เกิด"). */
  fresh?: boolean;
}

/** How many life years of a place's disasters we call "this year's event": the flags and events that make a home unfit to live in. */
const DISASTER_FLAGS = ['war', 'famine', 'plague'];
const DISASTER_EVENTS = ['DR-01', 'FG-02', 'FG-03'];

export function disasters(ctx: Ctx, life: LifeState): string[] {
  const out = flagsOf(ctx, life.country).filter((f) => DISASTER_FLAGS.includes(f)).map((f) => `${life.country}:${f}`);
  for (const e of DISASTER_EVENTS) if (happened(ctx, e)) out.push(`ev:${e}`);
  return out;
}

const modOf = (row: Row, i: number, on: boolean) => (on && row.mods[i] ? row.mods[i].mul : 1);
const piety = (life: LifeState) => charExt(life).axes.piety;
const curious = (life: LifeState) => charExt(life).axes.curious;

/** Debt of the economy system when it keeps one, else the purse below nothing (the purse never goes below 0, so this is usually 0). */
export function debtOf(life: LifeState): number {
  const e = life.ext.economy as { debt?: number } | undefined;
  return e?.debt ?? 0;
}

export const CAUSES: CauseDef[] = [
  {
    key: 'sc',
    row: 'ไปเรียน',
    // age 15 to 24, class 3 or higher or a patron (a patron is a bond the bonds system keeps: not read here)
    eligible: (_c, life, _ex, row) => {
      const n = classNum(life);
      const ok = life.hAge >= 15 && life.hAge <= 24 && n >= 3;
      return { ok, mul: modOf(row, 0, n >= 4) };
    },
  },
  {
    key: 'ps',
    row: 'แสวงบุญ',
    eligible: (ctx, life, _ex, row) => {
      const p = piety(life);
      const place = HOLY_PLACES.some((h) => h !== life.country && h !== life.home);
      void ctx;
      return { ok: p > 40 && place, mul: modOf(row, 0, p > 60) };
    },
  },
  {
    key: 'ml',
    row: 'รับจ้างรบ',
    eligible: (ctx, life, _ex, row) => {
      const war = flagsOf(ctx, life.country).includes('war');
      const soldier = !!life.job && SOLDIER_JOBS.has(life.job);
      const total = geo(ctx).countries.get(life.country)?.war === 'total';
      return { ok: war || soldier, mul: modOf(row, 0, total) };
    },
  },
  {
    key: 'ex',
    row: 'ลี้ภัย',
    disaster: true,
    fresh: true,
    eligible: (ctx, life) => ({ ok: disasters(ctx, life).length > 0, mul: 1 }),
  },
  {
    key: 'exile',
    row: 'เนรเทศหรือหนีโทษ',
    eligible: (ctx, life) => ({ ok: holds(ctx, life, 'curse', 'c_wanted'), mul: 1 }),
  },
  {
    key: 'xc',
    row: 'คำเชิญ',
    eligible: (_ctx, life, _ex) => {
      // a foreign person the character trusts (≥ 3) asks the character over; the people of the character does not count
      const own = geo(_ctx).peopleName.get(raceCode(_ctx, life.race));
      const t = charExt(life).trust;
      const foreign = Object.entries(t).some(([who, v]) => v >= 3 && who !== '*' && who !== own);
      return { ok: foreign && life.race !== 'human', mul: 1 };
    },
  },
  {
    key: 'wd',
    row: 'อยากรู้',
    // the axis `curious` above 40 and no family to look after (dependants are kept by the bonds system: not read here)
    eligible: (_ctx, life) => ({ ok: curious(life) > 40 && !life.traits.includes('family'), mul: 1 }),
  },
  {
    key: 'tr',
    row: 'หนี้หรือสัญญา',
    eligible: (_ctx, life) => ({ ok: debtOf(life) >= 100, mul: 1 }),
  },
];

/** The destinations of a cause: where it sends the character (see dest.ts for the weights). */
function shapeOf(key: string) {
  return TRIP[key] ?? TRIP.wd;
}

function openOf(ctx: Ctx, key: string, rng: ReturnType<Ctx['rng']>): string[] {
  const row = rows(ctx).find((r) => CAUSES.find((c) => c.key === key)?.row === r.cause);
  if (!row) return [];
  if (row.byRace) return ['xc'];
  // "tr.a1 หรือ ml.a1": one of them
  const lines = [...new Set(row.opens.map((n) => n.split('.')[0]))];
  if (lines.length > 1) return [lines[rng.int(0, lines.length - 1)]];
  return lines;
}

/** Rolls the causes of one life year. */
export function rollCauses(ctx: Ctx, life: LifeState, ex: TravelExt, fresh: ReadonlySet<string>): void {
  if (life.hAge < MIN_AGE || ex.away) return;
  const rng = ctx.rng('life.travel');
  const g = geo(ctx);
  const settled = life.traits.some((t) => SETTLED_TRAITS.includes(t));
  const adventurous = life.traits.some((t) => ADVENTUROUS_TRAITS.includes(t));
  const rules = g.travel.causeRules;
  for (const c of CAUSES) {
    const row = rows(ctx).find((r) => r.cause === c.row);
    if (!row) continue;
    const e = c.eligible(ctx, life, ex, row);
    if (!e.ok) continue;
    // "15% ในปีที่เหตุการณ์เกิด": a disaster counts the year it begins (and the year the character comes of age into one that goes on)
    if (c.fresh && ![...fresh].length && life.hAge !== MIN_AGE) continue;
    if (c.fresh && !disasters(ctx, life).length) continue;
    const st = statOf(ex, c.key);
    let p = row.chance * e.mul;
    if (!c.disaster) {
      if (settled) p *= rules.mods.find((m) => m.mul === 0.5 && m.raw.includes('settled'))?.mul ?? 0.5;
      if (adventurous) p *= rules.mods.find((m) => m.raw.includes('adventurous'))?.mul ?? 1.5;
      p *= moveMul(ctx);
    }
    // §2: a travel event that no disaster caused comes at most once in three years
    if (!c.disaster && life.hAge - ex.lastTrip < rules.oncePerYears) continue;
    st.years += 1;
    st.exp += p;
    if (!rng.chance(p)) continue;
    st.hits += 1;
    if (!c.disaster) ex.lastTrip = life.hAge;
    write(ctx.state, { sys: 'travel', kind: 'cause', id: c.key, data: { chance: Math.round(p * 1000) / 1000, age: life.hAge }, level: 1 });
    for (const line of openOf(ctx, c.key, rng)) queueLine(ctx, line, c.key);
    leave(ctx, life, ex, c.key);
  }
}

/** The character goes on the trip a cause sends it on: to a destination the filters leave, for a stay of the cause's length. */
export function leave(ctx: Ctx, life: LifeState, ex: TravelExt, cause: string, forced?: string): boolean {
  const shape = shapeOf(cause);
  const rng = ctx.rng('life.travel');
  const dest = forced ?? pickDestination(ctx, life, cause, rng.chance(shape.near));
  if (!dest) return false;
  const smuggle = cause === 'ex' || cause === 'exile';
  const free = cause === 'ml' || cause === 'ex' || cause === 'exile';
  const r = go(ctx, dest, cause, { free, smuggle });
  if (!r.legs) return false;
  let stay = rng.int(shape.stay[0], shape.stay[1]);
  const here = geo(ctx).countries.get(life.country) as CountryInfo;
  // water folk stay out of the water no longer than half a year (§3.3)
  if ((life.race === 'merfolk' || life.race === 'naga') && here && !here.coast) stay = Math.min(stay, 2);
  ex.away = { cause, to: life.country, until: beatOf(ctx, life) + stay + r.delay, settle: rng.chance(shape.settle) };
  ex.delay = 0;
  return true;
}
