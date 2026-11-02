// What the god system keeps beyond the fields of `GodState` (src/core/types.ts): `god.ext.god` (plain JSON), and the counters.
// Counters live in `god.counters`: `y.<name>` are per life year (cleared at each life year), `l.<name>` per life (cleared at birth),
// the rest cross lives. Other god files (acts/) keep their own keys under `god.ext.acts` and may use the counter helpers.
import { dataOf, type Ctx } from '../game';
import type { GodData } from '../data/types-god';
import type { LifeState } from '../types';
import { AGE_STOPS_DEFAULT } from './tuning';

export type Key = 'a' | 'b' | 'c';

/** A dream the god sent that has not met its node yet (03-dreams.md §4), or one that has and is waiting to be settled. */
export interface Dream {
  id: string;
  /** hAge the dream was sent at, and the world year. */
  age: number;
  year: number;
  node: string;
  choice: Key;
  source: string;
  symbol: string;
  /** The level and the reasons shown with the card when it was sent (03-dreams.md §3). */
  level: string;
  reasons: string[];
  /** The way fits the character (+1), goes against it (−1) or neither (0), and the traits it goes against. */
  fit: number;
  immoral?: boolean;
  against: string[];
  /** Weight multiplier the source gives the way when the dream is obeyed (03-dreams.md §1). */
  mul: number;
  paid: { faith?: number; dread?: number };
  /** Set when the dream met its node (or the node passed): what happened. */
  /** The weights of the rolled dream are in the story's `entryMods` (`via` is `story` when the story asked for them with `dreamWeight`). */
  applied?: boolean;
  via?: 'story';
  resolved?: { outcome: 'obey' | 'misread' | 'refuse' | 'defy'; level: string; p: number; alt?: Key; retro?: boolean };
}

export interface GodExt {
  /** Start power was given. */
  started: boolean;
  /** Life years since the god last did anything (01-power.md §3 last row). */
  quiet: number;
  /** The power line used last and the hAge it was used at (switching lines inside a year costs belief). */
  lastLine: { line: 'faith' | 'dread'; age: number } | null;
  /** The god window of this life year: the nodes the story logged at level 3, and whether an age stop falls in the year. */
  window: { age: number; nodes: string[]; stop: boolean; played: number } | null;
  /** Log number the window scan has read up to. */
  scan: number;
  /** hAge the god last punished the character (a curse picked, a petition punished), for the clarity of dreams. */
  punishedAge: number | null;
  /** Dreams of "willing" level in a row that the character did not obey (03-dreams.md §3 luck guard). */
  willFails: number;
  /** Traits the obeyed dreams went against, with how many times (burden event "นิสัยเปลี่ยน"). */
  crossed: Record<string, number>;
  /** Burden events that asked the god a question and wait for an answer until the year ends. */
  questions: { age: number }[];
  /** Dreams sent in this life, newest last (kept for "ฝันซ้ำ"). */
  history: { age: number; node: string; choice: Key }[];
  /** Prayers answered since GD-05 (01-power.md §1 last row). Acts report them through `noteAnswered`. */
  answered: number;
  /** Belief the next life starts with: 60% of the one that just died (01-power.md §6). */
  heirBelief?: number;
  /** The gifted weapon of this life. */
  weapon?: { id: string; variant: 'holy' | 'cursed' };
}

export function freshExt(): GodExt {
  return { started: false, quiet: 0, lastLine: null, window: null, scan: 0, punishedAge: null, willFails: 0, crossed: {}, questions: [], history: [], answered: 0 };
}

export function gx(ctx: Ctx): GodExt {
  const ext = ctx.state.god.ext;
  let e = ext.god as GodExt | undefined;
  if (!e) {
    e = freshExt();
    ext.god = e;
  }
  return e;
}

export const godData = (ctx: Ctx): GodData => dataOf<GodData>(ctx, 'god');

export const lifeOf = (ctx: Ctx): LifeState | null => {
  const l = ctx.state.life;
  return l && !l.dead ? l : null;
};

// ---------- counters ----------

export const count = (ctx: Ctx, key: string): number => ctx.state.god.counters[key] ?? 0;
export function bump(ctx: Ctx, key: string, n = 1): number {
  const c = ctx.state.god.counters;
  c[key] = (c[key] ?? 0) + n;
  return c[key];
}

export function clearCounters(ctx: Ctx, prefix: 'y.' | 'l.'): void {
  const c = ctx.state.god.counters;
  for (const k of Object.keys(c)) if (k.startsWith(prefix)) delete c[k];
}

// ---------- the god window ----------

export function ageStops(ctx: Ctx): number[] {
  const a = ctx.data.god ? godData(ctx).sim?.assumptions?.ageStops : undefined;
  return a?.length ? a : AGE_STOPS_DEFAULT;
}

/** Is the character in a god window now: a window node played this life year, or an age stop (01-power.md §2 "หน้าต่างพระเจ้าหรือจุดหยุดตามอายุ")? */
export function inWindow(ctx: Ctx): boolean {
  const life = lifeOf(ctx);
  const w = gx(ctx).window;
  return !!life && !!w && w.age === life.hAge && (w.stop || w.nodes.length > 0);
}

/** The window node ids of this life year (empty outside a window). */
export function windowNodes(ctx: Ctx): string[] {
  const life = lifeOf(ctx);
  const w = gx(ctx).window;
  return life && w && w.age === life.hAge ? w.nodes : [];
}

/** The log number where the entries of the living life begin (those written at or after its birth year, at the tail of the log). */
export function birthMark(ctx: Ctx): number {
  const life = ctx.state.life;
  const log = ctx.state.log;
  let n = ctx.state.logN;
  for (let i = log.length - 1; i >= 0 && life && log[i].worldYear >= life.birthYear; i--) n = log[i].n;
  return n;
}

/** Reads the story's log for god-window nodes played since the last scan and sets the window of this year. */
export function scanWindow(ctx: Ctx): void {
  const life = lifeOf(ctx);
  if (!life) return;
  const e = gx(ctx);
  const nodes: string[] = [];
  let played = 0;
  const log = ctx.state.log;
  for (let i = log.length - 1; i >= 0 && log[i].n >= e.scan; i--) {
    const x = log[i];
    if (x.sys !== 'story' || x.kind !== 'node') continue;
    played++;
    if (x.level >= 3 && x.id) nodes.unshift(String(x.id));
  }
  e.scan = ctx.state.logN;
  const stop = ageStops(ctx).includes(life.hAge);
  const prev = e.window;
  const same = prev && prev.age === life.hAge ? prev : null;
  e.window = { age: life.hAge, nodes: [...(same?.nodes ?? []), ...nodes], stop, played: (same?.played ?? 0) + played };
  // the acts files read the window as a plain flag in `god.ext`
  ctx.state.god.ext.window = stop || e.window.nodes.length > 0;
}

/** Marks that the god did something this life year, so the feelings of the character do not fade (01-power.md §3). */
export function touch(ctx: Ctx): void {
  gx(ctx).quiet = 0;
}

/** hAge of the character, 0 when there is none. */
export const ageOf = (ctx: Ctx): number => ctx.state.life?.hAge ?? 0;
