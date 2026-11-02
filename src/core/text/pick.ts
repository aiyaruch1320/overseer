// Choosing words (docs/systems/llm/09-library.md, 06-god-templates.md, 07-ending-templates.md):
// tier 1 (the library, hand-written lines) first, then tier 0 (the templates); a line is not shown twice in one life;
// every `{slot}` must be filled or the line is skipped.
import { dataOf, type Ctx } from '../game';
import type { Country } from '../data/types-npcs';
import type { Template, TemplatesData } from '../data/types-text';
import { CALENDAR_BASE, RACE_GROUP, SEASONS } from './tuning';
import { peopleCode } from './names';

export type SlotValues = Record<string, string | number | undefined>;

/** A library line (one JSON object of data/library/<set>.jsonl): key fields, `img`, `text`, optional `races` and `lands` filters. */
export interface LibLine {
  text: string;
  img?: string;
  races?: string[];
  lands?: string[];
  [key: string]: unknown;
}

export interface TextSpec {
  /** Tier 1: the set (file name without `.jsonl`) and the key fields the line must carry. */
  lib?: { set: string; keys?: Record<string, string> };
  /** Tier 0: a family of a template file, keys and the column (variant) when the family has several. */
  tpl?: { file: 'templates-god' | 'templates-ending'; family: string; keys?: Record<string, string>; col?: string };
  slots?: SlotValues;
}

export interface Picked {
  text: string;
  tier: 0 | 1;
  /** Library `set#index` or template id. */
  id: string;
  /** Every candidate had been shown in this life already. */
  reused: boolean;
}

const SLOT = /\{([^{}]+)\}/g;

/** Fills the slots of a line; null when one is missing, so a line with a hole is never shown. */
export function fill(text: string, values: SlotValues): string | null {
  let miss = false;
  const out = text.replace(SLOT, (_m, k: string) => {
    const v = values[k.trim()];
    if (v === undefined || v === '') {
      miss = true;
      return '';
    }
    return String(v);
  });
  return miss ? null : out;
}

export function slotsOf(text: string): string[] {
  return [...text.matchAll(SLOT)].map((m) => m[1].trim());
}

// ---------- values the game knows about the life ----------

export function countryOf(ctx: Ctx, id: string | undefined): Country | undefined {
  if (!id || !ctx.data.countries) return undefined;
  return dataOf<Country[]>(ctx, 'countries').find((c) => c.id === id);
}

export function placeName(ctx: Ctx, id: string | undefined): string | undefined {
  return countryOf(ctx, id)?.name ?? id;
}

export function continentName(ctx: Ctx, countryId: string | undefined): string | undefined {
  const cid = countryOf(ctx, countryId)?.continent ?? countryId?.slice(0, 2);
  if (!cid || !ctx.data.continents) return cid;
  return dataOf<{ continents: { id: string; name: string }[] }>(ctx, 'continents').continents.find((c) => c.id === cid)?.name;
}

export function raceName(ctx: Ctx, race: string): string {
  if (!ctx.data.races) return race;
  const r = dataOf<{ races: { id: string; storyPrefix: string; name: string }[] }>(ctx, 'races').races.find((x) => x.id === race || x.storyPrefix === race);
  return r ? r.name : race;
}

export function classLabel(ctx: Ctx, cls: string | number): string {
  const n = typeof cls === 'number' ? cls : Number(/\d/.exec(cls)?.[0]);
  if (!n) return String(cls);
  if (ctx.data.economy) {
    const c = dataOf<{ classes?: { n: number; name: string }[] }>(ctx, 'economy').classes?.find((x) => x.n === n);
    if (c) return c.name;
  }
  return `ชั้น ${n}`;
}

export function seasonName(quarter: number): string {
  return SEASONS[((quarter % SEASONS.length) + SEASONS.length) % SEASONS.length];
}

/** ศ.ม. year the player reads for a world year of the state. */
export function calendarYear(worldYear: number): number {
  return CALENDAR_BASE + Math.floor(worldYear);
}

/** The slots the game fills by itself from the state (both the Thai and the English names the two template files use). */
export function baseSlots(ctx: Ctx): SlotValues {
  const st = ctx.state;
  const life = st.life;
  const season = seasonName(st.clock.quarter);
  const year = calendarYear(st.clock.worldYear);
  const v: SlotValues = { ฤดู: season, year };
  if (!life) return v;
  const race = raceName(ctx, life.race);
  const home = placeName(ctx, life.home);
  const here = placeName(ctx, life.country);
  Object.assign(v, {
    ชื่อตัวละคร: life.name,
    name: life.name,
    เผ่า: race,
    race,
    ทวีป: continentName(ctx, life.country),
    ชื่อของที่นี่: here,
    home,
    place: here,
    age: life.hAge,
    class_birth: classLabel(ctx, life.cls),
    job: life.job,
    อาชีพ: life.job,
  });
  return v;
}

// ---------- choosing ----------

function usedOf(ctx: Ctx): string[] {
  const life = ctx.state.life;
  const holder = (life ? life.ext : ctx.state.god.ext) as Record<string, { used?: string[] }>;
  const t = (holder.text ??= {});
  return (t.used ??= []);
}

function libLines(ctx: Ctx, set: string): LibLine[] {
  const f = ctx.data[`library.${set}`];
  return f ? (f.items as LibLine[]) : [];
}

function raceGroupOf(ctx: Ctx): string | undefined {
  const life = ctx.state.life;
  return life ? RACE_GROUP[peopleCode(ctx, life.race)] : undefined;
}

function matches(line: Record<string, unknown>, keys: Record<string, string> | undefined): boolean {
  if (!keys) return true;
  return Object.entries(keys).every(([k, v]) => line[k] === v);
}

function tplCandidates(ctx: Ctx, spec: NonNullable<TextSpec['tpl']>): Template[] {
  if (!ctx.data[spec.file]) return [];
  const all = dataOf<TemplatesData>(ctx, spec.file).templates;
  return all.filter((t) => t.family === spec.family && matches(t.keys, spec.keys) && (!spec.col || t.col === spec.col));
}

/**
 * Picks a line: library first, then templates, never one shown already in this life while a fresh one fits.
 * Draws from the `text` seed stream; the chosen id is remembered in `life.ext.text.used`. Returns null when nothing fills.
 */
export function pickText(ctx: Ctx, spec: TextSpec): Picked | null {
  const values: SlotValues = { ...baseSlots(ctx), ...spec.slots };
  const used = usedOf(ctx);
  const rng = ctx.rng('text');
  const group = raceGroupOf(ctx);
  const land = continentName(ctx, ctx.state.life?.country);

  const tryTier = (cands: { id: string; text: string }[], tier: 0 | 1): Picked | null => {
    const ok: { id: string; text: string }[] = [];
    for (const c of cands) {
      const t = fill(c.text, values);
      if (t !== null) ok.push({ id: c.id, text: t });
    }
    if (!ok.length) return null;
    const fresh = ok.filter((c) => !used.includes(c.id));
    const pool = fresh.length ? fresh : ok;
    const chosen = pool[rng.int(0, pool.length - 1)];
    if (!used.includes(chosen.id)) used.push(chosen.id);
    return { text: chosen.text, tier, id: chosen.id, reused: !fresh.length };
  };

  if (spec.lib) {
    const lines = libLines(ctx, spec.lib.set);
    const cands: { id: string; text: string }[] = [];
    lines.forEach((l, i) => {
      if (!matches(l, spec.lib!.keys)) return;
      if (l.races && (!group || !l.races.includes(group))) return;
      if (l.lands && (!land || !l.lands.includes(land))) return;
      cands.push({ id: `${spec.lib!.set}#${i}`, text: l.text });
    });
    const got = tryTier(cands, 1);
    if (got) return got;
  }
  if (spec.tpl) {
    const got = tryTier(
      tplCandidates(ctx, spec.tpl).map((t) => ({ id: t.id, text: t.text })),
      0,
    );
    if (got) return got;
  }
  return null;
}

/** Slots a template or library line asks for that the values do not hold, for the tests ("no hole left unfilled"). */
export function missingSlots(text: string, values: SlotValues): string[] {
  return slotsOf(text).filter((k) => values[k] === undefined || values[k] === '');
}
