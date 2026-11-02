// What the bondage system keeps on the life: `life.ext.bondage` (plain JSON), and the lookups of data/gen/bondage.json.
import { dataOf, type Ctx } from '../game';
import type { BondageData, BondagePrice, Stance, StanceId } from '../data/types-bondage';
import type { LifeState } from '../types';

export type Level = 0 | 1 | 2 | 3;

/** A person the character holds (a role of 10-bondage.md §8 "ผู้ซื้อ"): named, with a story of his own. */
export interface Held {
  id: string;
  name: string;
  /** `B2` or `B3`. */
  level: 'B2' | 'B3';
  since: number;
  country: string;
  skill: number;
  price: number;
  /** The person of the roster who stands for him (a written ally), if any. */
  npc?: string;
  /** Trust toward the owner: −1 every two years, not below −5 (§8). */
  trust: number;
  /** Treated well (+10% income) or strained (+5%). */
  good: boolean;
  gone?: 'freed' | 'sold' | 'fled' | 'crossed' | 'helped';
}

export interface BondageExt {
  level: Level;
  route?: string;
  since?: number;
  /** Where the character is held. */
  country?: string;
  /** Who holds him. */
  owner?: string;
  /** Debt left (B1), contract years left (B2). */
  debt?: number;
  years?: number;
  /** Ransom price now. */
  price: number;
  /** Gold saved toward it: no longer kept apart from the purse (M3 review B3), the purse is what pays; always 0, left for the saves that have it. */
  fund: number;
  skill: number;
  /** He decided to buy his freedom (bd.a2 way a). */
  ransoming?: boolean;
  born?: boolean;
  held: Held[];
  /** The bound person who asked the character for help (the `ab` line): his name, the roster position that stands for him, and where his story is. */
  helpee?: { name: string; npc?: string; level: 'B2' | 'B3'; skill: number; freed?: boolean; allied?: boolean; hidden?: boolean };
  history: { age: number; from: number; to: number; how: string }[];
  /** Counts for the tests: the persons freed, helped to flee, bought. */
  counts: { entered: number; exits: number; bought: number; freed: number; helped: number; allies: number; escapes: number; sold: number; sued: number };
  /** Lines opened by this system (`bd` `bo` `ab`). */
  opened: string[];
  /** Years the character has been at each role, for the yearly rolls that fire once. */
  done: string[];
  /** Nodes of bd put in the story's skipped list because they did not suit the state of the life then (line.ts); they come back when it does. */
  parked: string[];
}

export function fresh(): BondageExt {
  return {
    level: 0, price: 0, fund: 0, skill: 1, held: [], history: [], opened: [], done: [], parked: [],
    counts: { entered: 0, exits: 0, bought: 0, freed: 0, helped: 0, allies: 0, escapes: 0, sold: 0, sued: 0 },
  };
}

export function lifeOf(ctx: Ctx): LifeState | null {
  const l = ctx.state.life;
  return l && !l.dead ? l : null;
}

export function extOf(life: LifeState): BondageExt {
  let e = life.ext.bondage as BondageExt | undefined;
  if (!e || typeof e !== 'object') {
    e = fresh();
    life.ext.bondage = e;
  }
  const f = fresh();
  for (const k of Object.keys(f) as (keyof BondageExt)[]) if ((e as unknown as Record<string, unknown>)[k] === undefined) (e as unknown as Record<string, unknown>)[k] = f[k];
  return e;
}

// ---------- the data ----------

interface Index {
  data: BondageData;
  stances: Map<StanceId, Stance>;
  price: Map<string, BondagePrice>;
  /** Price index of a country by its W (economy.json wLevels), 1 when the file is not loaded. */
  priceIndex(w: number): number;
  incomeIndex(w: number): number;
}

const cache = new WeakMap<object, Index>();

export function bondageIndex(ctx: Ctx): Index {
  const file = ctx.data.bondage;
  const hit = file && cache.get(file);
  if (hit) return hit;
  const data = dataOf<BondageData>(ctx, 'bondage');
  const w = ctx.data.economy ? (dataOf<{ wLevels: { w: number; priceIndex: number; incomeIndex: number }[] }>(ctx, 'economy').wLevels) : [];
  const idx: Index = {
    data,
    stances: new Map(data.stances.map((s) => [s.id, s])),
    price: new Map(data.prices.map((p) => [p.level, p])),
    priceIndex: (n) => w.find((x) => x.w === n)?.priceIndex ?? 1,
    incomeIndex: (n) => w.find((x) => x.w === n)?.incomeIndex ?? 1,
  };
  if (file) cache.set(file, idx);
  return idx;
}

/** The stance of a country toward bondage (10-bondage.md §3.1): the named ones, else H. */
export function stanceOf(ctx: Ctx, country: string): StanceId {
  const d = bondageIndex(ctx).data;
  return d.byCountry[country] ?? d.defaultStance;
}
