// Typed access to the data the travel system reads: data/gen/travel.json, countries.json, races.json. Indexes are built once per loaded data object.
import type { Ctx } from '../game';
import type { TravelData } from '../data/types-travel';
import type { ContinentId, CountryId } from '../types';
import { geoOf } from '../world/place';

export interface CountryInfo {
  id: CountryId;
  continent: ContinentId;
  name: string;
  /** Size of the settlement, 1 to 5 (the UI scale of the country file); 2 when the file has none. */
  scale: number;
  /** Wealth class W 1 to 5. */
  w: number;
  coast: boolean;
  /** `justice=` of the country file (court, martial, ledger ... extradition between those). */
  justice: string;
  war: string;
  /** Religion ids of the country (`faith.02`), the primary one first. */
  faiths: string[];
  /** Storyline race code of the first race the country file names (`hu`, `el` ...), null for "ทุกเผ่า" or a name nobody knows. */
  first: string | null;
  firstName: string;
  continentOrder: number;
}

interface CountryRaw {
  id: CountryId;
  continent: ContinentId;
  name: string;
  races: string;
  ui: { scale?: number | null; justice?: string; war?: string };
  econ: { w: number };
  religions?: { id: string | null; primary: boolean }[];
}

interface RaceRaw {
  id: string;
  name: string;
  storyPrefix: string;
}

export interface Geo {
  travel: TravelData;
  countries: Map<CountryId, CountryInfo>;
  byContinent: Map<ContinentId, CountryInfo[]>;
  list: CountryInfo[];
  /** Race id → storyline code. */
  code: Map<string, string>;
  /** Storyline code → people name as the documents write it. */
  peopleName: Map<string, string>;
}

/** Words of the country file that stand for a race the name list does not hold. */
const ALIASES: [string, string][] = [
  ['อาเวียน', 'wi'], ['ปีกราตรี', 'wi'], ['เผ่านก', 'wi'], ['ชาวน้ำฟ้า', 'wi'],
  ['ชาวหมอก', 'hu'], ['ชาวพื้น', 'hu'], ['มนุษย์', 'hu'],
  ['ภูต', 'fa'], ['สัตว์', 'be'], ['โอเกอร์', 'or'], ['หุ่น', 'so'],
];

const cache = new WeakMap<object, Geo>();

export function geo(ctx: Ctx): Geo {
  const hit = cache.get(ctx.data);
  if (hit) return hit;
  const travel = ctx.data.travel?.items as TravelData;
  const raws = (ctx.data.countries?.items as CountryRaw[] | undefined) ?? [];
  const racesFile = ctx.data.races?.items as { races?: RaceRaw[] } | RaceRaw[] | undefined;
  const races = (Array.isArray(racesFile) ? racesFile : racesFile?.races) ?? [];
  const code = new Map(races.map((r) => [r.id, r.storyPrefix]));
  const peopleName = new Map(races.map((r) => [r.storyPrefix, r.name]));
  const words: [string, string][] = [...races.map((r) => [r.name, r.storyPrefix] as [string, string]), ...ALIASES];
  const countries = new Map<CountryId, CountryInfo>();
  const byContinent = new Map<ContinentId, CountryInfo[]>();
  let order = 0;
  for (const c of raws) {
    let best = -1;
    let bestLen = 0;
    let first: string | null = null;
    let firstName = '';
    for (const [w, k] of words) {
      const i = c.races.indexOf(w);
      if (i < 0) continue;
      if (best < 0 || i < best || (i === best && w.length > bestLen)) {
        best = i;
        bestLen = w.length;
        first = k;
        firstName = w;
      }
    }
    const info: CountryInfo = {
      id: c.id,
      continent: c.continent,
      name: c.name,
      scale: c.ui?.scale ?? 2,
      w: c.econ?.w ?? 3,
      coast: !!geoOf(ctx, c.id)?.coast,
      justice: c.ui?.justice ?? '',
      war: c.ui?.war ?? '',
      faiths: (c.religions ?? []).filter((r) => r.id).sort((a, b) => Number(b.primary) - Number(a.primary)).map((r) => r.id as string),
      first,
      firstName,
      continentOrder: order++,
    };
    countries.set(c.id, info);
    const list = byContinent.get(c.continent) ?? [];
    list.push(info);
    byContinent.set(c.continent, list);
  }
  const g: Geo = { travel, countries, byContinent, list: [...countries.values()], code, peopleName };
  cache.set(ctx.data, g);
  return g;
}

export const continentOf = (c: CountryId): ContinentId => c.slice(0, 2) as ContinentId;

/** Storyline code of a race id (`human` → `hu`). */
export function raceCode(ctx: Ctx, race: string): string {
  return geo(ctx).code.get(race) ?? race;
}

/** Days and fare drawn inside the range of a route row. */
export function inRange(rng: { int(a: number, b: number): number }, r: [number, number] | null | undefined, dflt: [number, number]): number {
  const x = r ?? dflt;
  return rng.int(x[0], x[1]);
}
