// `place` conditions: where the main character lives (state.life.country). Geography comes from the country file (data/gen/countries.json),
// the flags from the world state, the half-blood dislike from the origin file (character/01-origin.md §4).
import type { Ctx } from '../game';
import type { CountryId } from '../types';
import { world } from './access';

interface CountryRow {
  id: CountryId;
  continent: string;
  ui: { ambient?: string; centre?: string; plan?: string; mark?: string[]; scale?: number | null };
}
interface OriginData {
  halfPairs: { main: string; despisedCountries: CountryId[] }[];
}

export const FLAGS = ['war', 'famine', 'plague', 'golden', 'fallen', 'god_ruin'];
const SEA_MARKS = new Set(['pier', 'dockyard', 'pearlfarm']);

export interface Geo {
  coast: boolean;
  river: boolean;
  city: boolean;
}

const cache = new WeakMap<object, Map<CountryId, Geo>>();

/**
 * The country file has no coast or river field, so they are read from what the file draws: gulls, a lighthouse, a pier or a dockyard and the sea
 * continent make a coast; a canal city or a lake at the centre a river; a settlement of scale 4 or 5 is a large city. (Proposal: real fields in the country docs.)
 */
export function geoOf(ctx: Ctx, country: CountryId): Geo | undefined {
  const f = ctx.data.countries;
  if (!f) return undefined;
  let m = cache.get(f);
  if (!m) {
    m = new Map();
    for (const c of Object.values(f.items as Record<string, CountryRow>)) {
      const ui = c.ui ?? {};
      m.set(c.id, {
        coast: ui.ambient === 'gulls' || ui.centre === 'lighthouse' || (ui.mark ?? []).some((x) => SEA_MARKS.has(x)) || c.continent === 'NR',
        river: ui.plan === 'canal' || ui.centre === 'lake',
        city: (ui.scale ?? 0) >= 4,
      });
    }
    cache.set(f, m);
  }
  return m.get(country);
}

function halfDislike(ctx: Ctx): boolean {
  const life = ctx.state.life;
  const o = ctx.data.origin?.items as OriginData | undefined;
  if (!life || !o || !life.blood) return false; // only a character with a second race is a half-blood
  return !!o.halfPairs.find((p) => p.main === life.race)?.despisedCountries.includes(life.country);
}

/** True when any of the kinds holds where the character lives. */
export function placeHolds(ctx: Ctx, kinds: string[]): boolean {
  const life = ctx.state.life;
  if (!life) return false;
  return kinds.some((k) => {
    if (k === 'coast' || k === 'river' || k === 'city') return !!geoOf(ctx, life.country)?.[k];
    if (k === 'halfDislike') return halfDislike(ctx);
    return !!world(ctx).countryFlags[life.country]?.includes(k);
  });
}
