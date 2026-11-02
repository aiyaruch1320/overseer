// Typed, indexed access to the economy data (data/gen/economy.json, countries.json, jobs.json). Built once per loaded data object (P0).
import type { Ctx } from '../game';
import type { EconomyData } from '../data/types-economy';
import type { Job } from '../data/types-character';
import { GROUP_OF_HEADING, LEGACY_GROUP, REGIME_DEFAULT, REGIME_WORDS } from './tuning';

export type RegimeId = 'monarchy' | 'theocracy' | 'merchant' | 'republic' | 'military' | 'company' | 'tribal' | 'stateless';
/** The order of `regimes` and `income.tax` in economy.json (01-world: 03-classes.md §6 and 04-income-and-living.md §4 list them alike). */
export const REGIME_ORDER: RegimeId[] = ['monarchy', 'theocracy', 'merchant', 'republic', 'military', 'company', 'tribal', 'stateless'];

export type MoneyUse = 'full' | 'mixed' | 'little';
export const GOODS = ['F', 'M', 'T', 'W', 'S', 'H', 'X', 'E'] as const;
export type GoodId = (typeof GOODS)[number];
export const CONTINENTS = ['AZ', 'MH', 'KD', 'NR', 'AL', 'MK', 'SH', 'SV', 'NB'] as const;

export interface CountryEco {
  id: string;
  continent: string;
  gov: string;
  /** W of the first era after the neighbour blend (02-countries.md §2). */
  w: number;
  wBase: number;
  /** Inequality 1..4 (ต่ำ กลาง สูง สูงมาก). */
  g: number;
  m: MoneyUse;
  exports: GoodId[];
  shortages: GoodId[];
  regime: RegimeId;
}

export interface EcoIndex {
  data: EconomyData;
  countries: Map<string, CountryEco>;
  list: CountryEco[];
  jobs: Map<string, Job>;
  /** Base price of each good (01 §2). */
  base: Record<GoodId, number>;
  /** Weight of each job rarity in the offer at coming of age (jobs.json rules). */
  rarityRoot: Record<string, number>;
  /** Income group of a job id. */
  groupOf(job: Job): string;
}

const G_WORDS = ['ต่ำ', 'กลาง', 'สูง', 'สูงมาก'];
const M_WORDS: Record<string, MoneyUse> = { เต็ม: 'full', ผสม: 'mixed', น้อย: 'little' };
const cache = new WeakMap<object, EcoIndex | null>();

function codes(list: unknown): GoodId[] {
  return ((list as string[] | undefined) ?? []).filter((c): c is GoodId => (GOODS as readonly string[]).includes(c));
}

/** The regime of a country: the examples the document names win, then the words of its government. */
export function regimeOf(data: EconomyData, id: string, gov: string): RegimeId {
  for (let i = 0; i < data.regimes.length; i++) if (data.regimes[i].examples.includes(id)) return REGIME_ORDER[i];
  for (const [r, re] of REGIME_WORDS) if (re.test(gov)) return r;
  return REGIME_DEFAULT;
}

/** The economy index of the data in this game; null when economy.json was not loaded (the system then does nothing). */
export function eco(ctx: Ctx): EcoIndex | null {
  const hit = cache.get(ctx.data);
  if (hit !== undefined) return hit;
  const file = ctx.data.economy?.items as EconomyData | undefined;
  const raw = ctx.data.countries?.items as
    | { id: string; continent: string; gov: string; econ: { w: number; wBase: number; g: string; m: string; exports: string[]; shortages: string[] } }[]
    | undefined;
  if (!file || !raw) {
    cache.set(ctx.data, null);
    return null;
  }
  const countries = new Map<string, CountryEco>();
  const list: CountryEco[] = [];
  for (const c of raw) {
    const row: CountryEco = {
      id: c.id,
      continent: c.continent,
      gov: c.gov ?? '',
      w: c.econ?.w ?? 3,
      wBase: c.econ?.wBase ?? c.econ?.w ?? 3,
      g: Math.max(1, G_WORDS.indexOf(c.econ?.g) + 1),
      m: M_WORDS[c.econ?.m] ?? 'mixed',
      exports: codes(c.econ?.exports),
      shortages: codes(c.econ?.shortages),
      regime: regimeOf(file, c.id, c.gov ?? ''),
    };
    countries.set(c.id, row);
    list.push(row);
  }
  const jobList = (ctx.data.jobs?.items as { jobs?: Job[] } | undefined)?.jobs ?? [];
  const base = Object.fromEntries(GOODS.map((g) => [g, file.goods.find((x) => x.code === g)?.base ?? 10])) as Record<GoodId, number>;
  const built: EcoIndex = {
    data: file,
    countries,
    list,
    jobs: new Map(jobList.map((j) => [j.id, j])),
    base,
    rarityRoot: (ctx.data.jobs?.items as { rules?: { rarityRoot?: Record<string, number> } } | undefined)?.rules?.rarityRoot ?? { C: 10, U: 6.2, R: 3.3, E: 1.6 },
    groupOf(job) {
      const legacy = LEGACY_GROUP[job.id];
      if (legacy) return legacy;
      for (const [heading, g] of GROUP_OF_HEADING) if (job.group.includes(heading)) return g;
      return 'service';
    },
  };
  cache.set(ctx.data, built);
  return built;
}

/** Social class 1..5 from `cls` (`c3` → 3). */
export function classNumber(cls: string): number {
  const n = Number(String(cls).replace(/\D/g, ''));
  return n >= 1 && n <= 5 ? n : 3;
}

/** The key of the class in the income tables: bondless low common rich (class 5 takes the noble rule). */
export const CLASS_KEY = ['bondless', 'low', 'common', 'rich', 'rich'] as const;
