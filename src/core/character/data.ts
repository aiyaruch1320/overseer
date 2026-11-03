// Typed, indexed access to the generated character data (data/gen/{races,traits,aptitudes,skills,blessings,curses,jobs,origin,economy,countries}.json).
// Indexes are built once per loaded data object.
import type { Ctx } from '../game';
import type { Aptitude, Axis, Gift, Job, JobsFile, OriginFile, Race, RacesFile, Skill, StatKey, Trait } from '../data/types-character';
import type { Condition, Effect, LifeState } from '../types';
import type { WishSheet } from './wish';

export const AXES: readonly Axis[] = ['brave', 'kind', 'ambition', 'piety', 'curious', 'honest', 'temper', 'social'];
export const STAT_KEYS: readonly StatKey[] = ['pow', 'mag', 'spd', 'luk', 'int', 'vit'];

/** A blessing or a curse, from blessings.json / curses.json or from a race file (`rb_` `rc_`, text only). */
export interface GiftLike {
  id: string;
  name: string;
  tier: string;
  fx: Effect[];
  fromCond: Condition[];
  from: string;
  group: string;
  curse: boolean;
  /** Set for gifts that belong to one race file. */
  race?: string;
}

/** The slice of a country the character system reads. */
export interface CountryLite {
  id: string;
  continent: string;
  religions: { id: string | null; primary: boolean }[];
  w: number;
  g: string;
  scale: number;
  races: string;
}

export interface EconomyLite {
  classByWG: { w: number; g: string; pct: number[] }[];
  startGold: { cls: string; range: [number, number] }[];
}

export interface Indexes {
  races: Map<string, Race>;
  raceByPrefix: Map<string, string>;
  racesFile?: RacesFile;
  origin?: OriginFile;
  traits: Map<string, Trait>;
  traitList: Trait[];
  aptitudes: Map<string, Aptitude>;
  aptitudeList: Aptitude[];
  skills: Map<string, Skill>;
  uniqueSkills: Skill[];
  gifts: Map<string, GiftLike>;
  blessings: GiftLike[];
  curses: GiftLike[];
  jobs: Map<string, Job>;
  jobList: Job[];
  jobRules?: JobsFile['rules'];
  countries: Map<string, CountryLite>;
  countryList: CountryLite[];
  economy?: EconomyLite;
}

const cache = new WeakMap<object, Indexes>();

function items<T>(ctx: Ctx, name: string): T | undefined {
  return ctx.data[name]?.items as T | undefined;
}

export function idx(ctx: Ctx): Indexes {
  const hit = cache.get(ctx.data);
  if (hit) return hit;
  const racesFile = items<RacesFile>(ctx, 'races');
  const origin = items<OriginFile>(ctx, 'origin');
  const traitList = items<{ traits: Trait[] }>(ctx, 'traits')?.traits ?? [];
  const aptitudeList = items<Aptitude[]>(ctx, 'aptitudes') ?? [];
  const skillList = items<Skill[]>(ctx, 'skills') ?? [];
  const jobsFile = items<JobsFile>(ctx, 'jobs');
  const bl = items<Gift[]>(ctx, 'blessings') ?? [];
  const cu = items<Gift[]>(ctx, 'curses') ?? [];
  const countryRaw =
    items<
      {
        id: string;
        continent: string;
        religions: { id: string | null; primary: boolean }[];
        econ: { w: number; g: string };
        ui?: { scale?: number | null };
        races: string;
      }[]
    >(ctx, 'countries') ?? [];
  const eco = items<{ classByWG: EconomyLite['classByWG']; startGold: EconomyLite['startGold'] }>(ctx, 'economy');

  const races = new Map<string, Race>();
  const raceByPrefix = new Map<string, string>();
  for (const r of racesFile?.races ?? []) {
    races.set(r.id, r);
    raceByPrefix.set(r.storyPrefix, r.id);
  }

  const gifts = new Map<string, GiftLike>();
  const blessings: GiftLike[] = [];
  const curses: GiftLike[] = [];
  const addGift = (g: GiftLike) => {
    gifts.set(g.id, g);
    (g.curse ? curses : blessings).push(g);
  };
  for (const g of bl) addGift({ id: g.id, name: g.name, tier: g.tier, fx: g.fx, fromCond: g.fromCond, from: g.from, group: g.group, curse: false });
  for (const g of cu) addGift({ id: g.id, name: g.name, tier: g.tier, fx: g.fx, fromCond: g.fromCond, from: g.from, group: g.group, curse: true });
  for (const r of racesFile?.races ?? []) {
    for (const g of r.blessings) addGift({ id: g.id, name: g.name, tier: g.tier, fx: [], fromCond: [], from: '', group: 'race', curse: false, race: r.id });
    for (const g of r.curses) addGift({ id: g.id, name: g.name, tier: g.tier, fx: [], fromCond: [], from: '', group: 'race', curse: true, race: r.id });
  }

  const skills = new Map<string, Skill>();
  for (const s of skillList) skills.set(s.id, s);

  const countries = new Map<string, CountryLite>();
  const countryList: CountryLite[] = [];
  for (const c of countryRaw) {
    const lite: CountryLite = {
      id: c.id,
      continent: c.continent,
      religions: c.religions ?? [],
      w: c.econ?.w ?? 3,
      g: c.econ?.g ?? 'กลาง',
      scale: c.ui?.scale ?? 1,
      races: c.races ?? '',
    };
    countries.set(c.id, lite);
    countryList.push(lite);
  }

  const built: Indexes = {
    races,
    raceByPrefix,
    racesFile,
    origin,
    traits: new Map(traitList.map((t) => [t.id, t])),
    traitList,
    aptitudes: new Map(aptitudeList.map((a) => [a.id, a])),
    aptitudeList,
    skills,
    uniqueSkills: skillList.filter((s) => s.kind === 'unique'),
    gifts,
    blessings,
    curses,
    jobs: new Map((jobsFile?.jobs ?? []).map((j) => [j.id, j])),
    jobList: jobsFile?.jobs ?? [],
    jobRules: jobsFile?.rules,
    countries,
    countryList,
    economy: eco ? { classByWG: eco.classByWG, startGold: eco.startGold } : undefined,
  };
  cache.set(ctx.data, built);
  return built;
}

// ---------- the per-character extras (life.ext.character) ----------

export interface CharacterExt {
  /** Second race of a half-blood. */
  second?: string;
  /** How the half-blood's parents met (`trade` `craft` `refugee` ...). */
  meet?: string;
  /** Birth sign `none` `comet` `eclipse` `fullmoon` `storm`, and time of day `dawn` `day` `dusk` `night`. */
  sign: string;
  time: string;
  /** `faith.NN`, or empty for a country with no faith. */
  faith: string;
  /** Born where: the race's main land, a diaspora land, or outside. */
  born: 'main' | 'diaspora' | 'outside';
  /** The born body has no gender (slime, some fae, some soul machines): `life.gender` is then only how they present. */
  neuter: boolean;
  axes: Record<Axis, number>;
  /** Race tags the character has (a half-blood keeps all of the main race, half of the second). */
  raceTags: string[];
  /** Tags granted by effects outside gifts and traits. */
  tags: string[];
  companions: string[];
  /** Level of the `ns_` skills (`ns_mediate` → 2). */
  skillLevels: Record<string, number>;
  /** Trust toward a people or place, the Thai word as the docs write it; `*` = unnamed. */
  trust: Record<string, number>;
  /** Draw-weight multipliers for later random draws, keyed `<kind>:<id>` (id may be a tag). */
  favour: Record<string, number>;
  fame: number;
  wounds: number;
  allyLevel: number;
  /** Maximum-hp bonus from gifts (`hp+n`). */
  hpBonus: number;
  /** hAge of the natural death; the base is 75. */
  deathAge: number;
  /** Special start: `summoned` `reincarnated` `woken`. */
  special?: string;
  /** Story node the life starts at when it differs from the usual first node. */
  firstNode?: string;
  /** Secret jobs the character was offered and refused. */
  refused: string[];
  /** hAge at which the current job began. */
  jobSince?: number;
  /** World year the life began (the life year count of the Game starts at 0 here). */
  startYear: number;
  /**
   * The wish this life was ordered by (19-wish.md §6): the sheet as read (`ask`, the rows, the points) and in `born` what the birth applied and refused with the reason.
   * Kept in the save: a replay uses it and does not read the text again. The ending card and the LLM read it as plain data.
   */
  wish?: WishSheet;
  /** The childhood meeting with the companion species the wish asked for: the age it comes at; set when it came. */
  wishChild?: { age: number; id: string; done?: boolean };
  /** The late parts of the wish (the family of the infant, the story lines) were done. */
  wishLate?: boolean;
}

export function emptyExt(): CharacterExt {
  return {
    sign: 'none',
    time: 'day',
    faith: '',
    born: 'main',
    neuter: false,
    axes: { brave: 0, kind: 0, ambition: 0, piety: 0, curious: 0, honest: 0, temper: 0, social: 0 },
    raceTags: [],
    tags: [],
    companions: [],
    skillLevels: {},
    trust: {},
    favour: {},
    fame: 0,
    wounds: 0,
    allyLevel: 0,
    hpBonus: 0,
    deathAge: 75,
    refused: [],
    startYear: 0,
  };
}

/** The character extras of a life, created on first use. */
export function extOf(life: LifeState): CharacterExt {
  let e = life.ext.character as CharacterExt | undefined;
  if (!e) {
    e = emptyExt();
    life.ext.character = e;
  }
  return e;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Social class number 1..5 from `cls` (`c3` → 3). */
export function classNum(life: LifeState): number {
  const n = Number(String(life.cls).replace(/\D/g, ''));
  return n >= 1 && n <= 5 ? n : 3;
}
export const classId = (n: number) => `c${clamp(Math.round(n), 1, 5)}`;
