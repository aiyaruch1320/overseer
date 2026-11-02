// What the travel system keeps on the life: `life.ext.travel` (plain JSON). Where the character is stays in `life.country`
// (the character system sets it at birth, this system changes it); the place the character lives when not on a trip is `base`.
import type { Ctx } from '../game';
import type { ContinentId, CountryId, LifeState } from '../types';
import { BEATS } from './tuning';

export interface TravelAway {
  cause: string;
  to: CountryId;
  /** Beat index (hAge × 4 + quarter) the stay ends at. */
  until: number;
  settle: boolean;
}

export interface CauseStat {
  /** Life years the cause was open to the character, and the times it fired. */
  years: number;
  hits: number;
  /** Sum of the chances drawn, to compare with the hits. */
  exp: number;
}

export interface TravelExt {
  /** The country the character lives in when not away. */
  base: CountryId;
  born: CountryId;
  /** L0 L1 L2 reached so far (never goes down). */
  level: 0 | 1 | 2;
  /** Countries stood in other than the birth country, and continents stood in (the birth continent included). */
  visited: CountryId[];
  continents: ContinentId[];
  trips: number;
  legs: number;
  days: number;
  spent: number;
  away?: TravelAway;
  /** hAge of the last travel event that no disaster caused (§2: at most one in three years). */
  lastTrip: number;
  /** Overlay lines this system opened. */
  opened: string[];
  /** Disaster flags seen last year, `country:flag`, to know the year one begins. */
  seen: string[];
  stats: Record<string, CauseStat>;
  /** Strangers met on the road (d12 row 3). */
  met: number;
  wantedIn: CountryId[];
  invited: CountryId[];
  smuggled: number;
  spontaneous: boolean;
  pilgrim: boolean;
  /** Legs made in each life year, by hAge, for the cap check. */
  yearLegs: Record<number, number>;
  /** Days on the road per life year, by hAge. */
  yearDays: Record<number, number>;
  /** Quarters added by delays (festival, quarantine, a broken cart) to wait out. */
  delay: number;
}

export function fresh(country: CountryId): TravelExt {
  return {
    base: country, born: country, level: 0, visited: [], continents: [country.slice(0, 2) as ContinentId], trips: 0, legs: 0, days: 0, spent: 0, lastTrip: -99,
    opened: [], seen: [], stats: {}, met: 0, wantedIn: [], invited: [], smuggled: 0, spontaneous: false, pilgrim: false, yearLegs: {}, yearDays: {}, delay: 0,
  };
}

export function lifeOf(ctx: Ctx): LifeState | null {
  const l = ctx.state.life;
  return l && !l.dead ? l : null;
}

/** The extension of a life, created on first use. */
export function extOf(life: LifeState): TravelExt {
  let e = life.ext.travel as TravelExt | undefined;
  if (!e) {
    e = fresh(life.country);
    life.ext.travel = e;
  }
  return e;
}

/** Beat index of the character: life years × 4 + the quarter of the year. */
export const beatOf = (ctx: Ctx, life: LifeState): number => life.hAge * BEATS + ctx.state.clock.quarter;

export function addOnce<T>(list: T[], x: T): boolean {
  if (list.includes(x)) return false;
  list.push(x);
  return true;
}

export function statOf(ex: TravelExt, key: string): CauseStat {
  return (ex.stats[key] ??= { years: 0, hits: 0, exp: 0 });
}
