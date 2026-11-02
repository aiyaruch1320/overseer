// Small readers of the data and the world that the acts of the god share: the god tables, countries, neighbours, the character's place.
import { dataOf, type Ctx } from '../../game';
import type { GodData } from '../../data/types-god';
import type { CountryId } from '../../types';
import { DANGEROUS_WAR, NEIGHBOUR_KINDS, STAGES } from './tuning';

export const godOf = (ctx: Ctx): GodData => dataOf<GodData>(ctx, 'god');

interface CountryRow {
  id: CountryId;
  continent: string;
  name: string;
  relations?: { to: CountryId; kind: string }[];
  ui?: { ambient?: string; centre?: string; war?: string };
}

interface Geo {
  rows: Map<CountryId, CountryRow>;
  neighbours: Map<CountryId, Set<CountryId>>;
}

const cache = new WeakMap<object, Geo>();

function geo(ctx: Ctx): Geo | undefined {
  const f = ctx.data.countries;
  if (!f) return undefined;
  let g = cache.get(f);
  if (!g) {
    const rows = new Map<CountryId, CountryRow>();
    for (const c of Object.values(f.items as Record<string, CountryRow>)) rows.set(c.id, c);
    const neighbours = new Map<CountryId, Set<CountryId>>();
    const link = (a: CountryId, b: CountryId) => {
      if (a === b || !rows.has(b)) return;
      if (!neighbours.has(a)) neighbours.set(a, new Set());
      neighbours.get(a)!.add(b);
    };
    for (const c of rows.values())
      for (const r of c.relations ?? []) {
        if (!NEIGHBOUR_KINDS.includes(r.kind) || r.to.slice(0, 2) !== c.id.slice(0, 2)) continue;
        link(c.id, r.to);
        link(r.to, c.id);
      }
    g = { rows, neighbours };
    cache.set(f, g);
  }
  return g;
}

export const continentOf = (country: CountryId): string => country.slice(0, 2);
export const hasCountry = (ctx: Ctx, id: CountryId): boolean => !!geo(ctx)?.rows.has(id);
export const countryName = (ctx: Ctx, id: CountryId): string => geo(ctx)?.rows.get(id)?.name ?? id;

/** Countries on the same continent that the relations call next to this one (liege, ally, foe, contact ...; trade is not a border). */
export function neighboursOf(ctx: Ctx, id: CountryId): CountryId[] {
  return [...(geo(ctx)?.neighbours.get(id) ?? [])].sort();
}

/** Every country of the map, sorted. */
export const allCountries = (ctx: Ctx): CountryId[] => [...(geo(ctx)?.rows.keys() ?? [])].sort();

export function countriesOf(ctx: Ctx, continent: string): CountryId[] {
  const g = geo(ctx);
  return g ? [...g.rows.keys()].filter((c) => continentOf(c) === continent).sort() : [];
}

export const isDesert = (ctx: Ctx, id: CountryId): boolean => {
  const ui = geo(ctx)?.rows.get(id)?.ui;
  return !!ui && (ui.ambient === 'sand' || ui.centre === 'oasis' || ui.centre === 'pyramid');
};

/** Border posture of the country (countries.json `ui.war`: peace watch feud frequent total). */
export const postureOf = (ctx: Ctx, id: CountryId): string => geo(ctx)?.rows.get(id)?.ui?.war ?? 'peace';

export const flagsOf = (ctx: Ctx, id: CountryId): string[] => ctx.state.world.countryFlags[id] ?? [];
export const hasFlag = (ctx: Ctx, id: CountryId, ...flags: string[]): boolean => {
  const have = flagsOf(ctx, id);
  return flags.some((f) => have.includes(f));
};

/** Is the country dangerous (prayer `courage`)? */
export const dangerous = (ctx: Ctx, id: CountryId): boolean => hasFlag(ctx, id, 'war') || DANGEROUS_WAR.includes(postureOf(ctx, id));

export type Stage = 'infant' | 'child' | 'teen' | 'adult' | 'elder';
export const stageOf = (hAge: number): Stage =>
  hAge < STAGES.infant ? 'infant' : hAge < STAGES.child ? 'child' : hAge < STAGES.teen ? 'teen' : hAge < STAGES.adult ? 'adult' : 'elder';

/** The country where the main character lives, if there is a character. */
export const lifeCountry = (ctx: Ctx): CountryId | undefined => {
  const l = ctx.state.life;
  return l && !l.dead ? l.country : undefined;
};

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
