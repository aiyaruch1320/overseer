// Shapes of data/gen/{races,traits,aptitudes,skills,blessings,curses,jobs,fates,origin,wish,synonyms,companions}.json
// written by scripts/codegen/groups/character.ts (code-plan §5.1, row "ตัวละคร"). Each file is a GenFile<T[]> or GenFile<object>
// (see src/core/types.ts). Effects and conditions use the shared grammar; the extra condition kinds below are the ones the
// character documents need and the shared `Condition` cannot say yet (stat thresholds, race, age, class).
import type { Condition, ContinentId, CountryId, Effect, RaceId } from '../types';

export type Rarity = 'C' | 'U' | 'R' | 'E' | 'L';
export type StatKey = 'pow' | 'mag' | 'spd' | 'luk' | 'int' | 'vit';
export type Axis = 'brave' | 'kind' | 'ambition' | 'piety' | 'curious' | 'honest' | 'temper' | 'social';

/** A file and 1-based line in docs/ where a row came from. */
export type Src = string;

/** Character conditions use the shared grammar (src/core/types.ts); the alias stays for the generator. */
export type CharCond = Condition;

/** Cross references found in a free-text cell: events, countries, nodes, ids in backticks. */
export interface Refs {
  events: string[];
  countries: CountryId[];
  nodes: string[];
  ids: string[];
}

// ---------- races.json ----------

export interface RaceGift {
  id: string; // rb_<race>_<tier> · rc_<race>_<tier> (the docs name them without ids)
  name: string;
  tier: Rarity;
  text: string;
}
export interface RaceSkill {
  id: string; // rs_<race>_<n>
  name: string;
  text: string;
}
export interface RacePower {
  name: string;
  text: string;
}
export interface Subline {
  id: string;
  name: string;
  home: string;
  countries: CountryId[];
  note: string;
  /** Only a few sublines have their own lifespan row in world-time.md (mist folk). */
  lifespan?: [number, number];
  worldYearsPerLifeYear?: number;
  adultAge?: number;
  elderAge?: number;
  gap?: number;
}
export interface Race {
  id: RaceId;
  n: number;
  name: string;
  storyPrefix: string; // `hu` in hu.b1
  stats: Record<StatKey, [number, number]>;
  /** Natural lifespan range in world years, rolled once at birth (races/README.md, world-time.md §3). */
  lifespan: [number, number];
  worldYearsPerLifeYear: number;
  adultAge: number; // real age in world years
  elderAge: number;
  generationGap: number | null; // null for those who wake (no children of their own)
  /** soulmachine, mummy, ghoul: wake as human-equivalent 17; one life year = lifespan / 58 world years. */
  wakes: boolean;
  lifeYearDivisor: number; // 75, or 58 for those who wake
  sharePct: number; // 01-origin §2
  gender: { m: number; f: number; n: number; note?: string };
  tags: string[]; // 03-synergy-rules race tags
  newTags: string[]; // tags written in bold: new outside the old code
  axisShift: Partial<Record<Axis, number>>;
  /** 02-race-affinity: a stat bonus rolled at birth (halfling luck +1). */
  birthStat?: Partial<Record<StatKey, number>>;
  traitPlus: string[];
  traitMinus: string[];
  aptPlus: string[];
  aptMinus: string[];
  likes: string[]; // climates
  dislikes: string[];
  blessPlus: string[];
  cursePlus: string[];
  blessClash: string[];
  curseClash: string[];
  jobBonus: string[];
  powers: RacePower[];
  blessings: RaceGift[];
  curses: RaceGift[];
  skills: RaceSkill[];
  sublines: Subline[];
  notes: string[]; // other paragraphs of the race file (DR-01 changes, first install table...)
  fromCode: boolean; // the ★ mark of 02-race-affinity: the old code had this race
  src: Src;
}
export interface RaceTagMeaning {
  tag: string;
  text: string;
}
export interface RaceOverride {
  /** 02-race-affinity §ค: the same blessing or curse works differently for some races. */
  of: string;
  races: RaceId[];
  raceText: string;
  text: string;
  src: Src;
}
export interface SynergyRule {
  id: string; // SR-01
  group: string; // `ก. ธาตุ แสง ความมืด ต่อเผ่า`
  cond: string;
  effect: string;
  why: string;
  attacker?: string[]; // tags, any of
  target?: string[];
  mul?: number;
  effects: Effect[]; // ids and flags the effect grants
  refs: Refs;
  src: Src;
}
export interface RacesFile {
  races: Race[];
  tagMeanings: RaceTagMeaning[];
  overrides: RaceOverride[];
  synergy: SynergyRule[];
  affinityRules: { plusWeight: number; minusWeight: number; ban: number };
}

// ---------- traits.json aptitudes.json skills.json ----------

export interface Trait {
  id: string;
  name: string;
  fx: Effect[]; // axis shifts as stat effects, tags as grants of kind `tag`
  fxRaw: string;
  desc: string;
  conflicts: string[];
  src: 'code' | 'doc';
  at: Src;
}
export interface AptitudeLevel {
  level: 1 | 2 | 3;
  skill: string; // `sword_1`
  name: string;
  effect: string; // play effect from 04-skill-effects (empty for the added 20)
}
export interface Aptitude {
  id: string;
  name: string;
  stat: StatKey;
  tags: string[];
  group: string; // combat · magic · craft (04) or the 12-job-support group
  levels: AptitudeLevel[];
  src: 'code' | 'doc';
  at: Src;
}
export interface Skill {
  id: string; // sword_1 · u_sage · ns_wind_read
  name: string;
  kind: 'apt' | 'unique' | 'new' | 'companion';
  /** Which aptitude tree a leveled skill hangs on (`sword`), or the parent aptitude of a new skill. */
  apt?: string;
  level?: 1 | 2 | 3;
  stat?: StatKey;
  bonus?: number; // +1 +2 +3 of the main stat for aptitude skills
  group: string;
  fx: Effect[]; // unique skills
  fxRaw?: string;
  levels?: string[]; // new skills: text of levels 1..3 (cumulative)
  effect?: string; // play effect text (04) for the level or the unique skill
  learnFrom?: CountryId[];
  learnText?: string;
  desc?: string;
  src: 'code' | 'doc';
  at: Src;
}

// ---------- blessings.json curses.json ----------

export interface Gift {
  id: string;
  name: string;
  tier: Rarity;
  price?: number; // 1..3, only for the ones that came from the old code
  fx: Effect[];
  fxRaw: string;
  desc: string;
  /** Where it comes from / when the draw weight rises (`ได้จาก`, `เหตุการณ์`, `ผูกกับ`, `ศาสนา`). */
  from: string;
  /** All of these. A `text` condition is one the parser could not read; each is listed in data/gen/_unparsed/character.md. */
  fromCond: CharCond[];
  /** Words of the `from` cell that explain and do not gate (kept so nothing is dropped silently). */
  fromNotes: string[];
  refs: Refs;
  world: string; // `ในโลก` (blessings)
  cure: string; // `ทางพ้น` (curses)
  jobsText: string; // `อาชีพที่ได้ง่ายขึ้น` (blessings) · `อาชีพที่ได้ยากขึ้น` (curses), as written
  jobs: string[]; // the job ids among those whose Thai name appears in jobsText
  group: string;
  src: 'code' | 'doc';
  at: Src;
}
export interface TagMeaning {
  tag: string;
  text: string; // empty for old-code tags the docs never explain
  count?: number; // how many old-code rows use it
  src: 'code' | 'doc';
  at: Src;
}

// ---------- jobs.json ----------

export type JobKind = 'common' | 'secret' | 'special';
export interface NodeRef {
  id: string;
  choice?: 'a' | 'b' | 'c';
}
export interface Job {
  id: string;
  name: string;
  kind: JobKind;
  tier?: Rarity; // common jobs only
  group: string; // ช่างฝีมือ · บริการ ... or the table heading
  origin: 'code' | 'new' | 'from-secret' | 'trade' | 'half-blood' | 'special';
  apts: string[];
  mainStat?: StatKey;
  slow: boolean; // slow life
  reqText: string;
  req: CharCond[]; // all of these
  /** Parts of the requirement cell that explain or weigh (`ได้ง่าย` `เด่น` `น้ำหนัก ×2`) and are not a condition. */
  reqNotes: string[];
  banText: string; // secret: extra bans from the world
  /** The job is banned while this holds (`and[...]` is one ban). A "ถ้า A ต้อง B" cell is `and[A, not B]`. */
  ban: CharCond[];
  banNotes: string[];
  opens: string; // story lines opened / what it unlocks
  raceBonus: RaceId[]; // 08 §5: +2 weight
  /** Secret jobs. */
  direct?: NodeRef[]; // nodes where the job is offered when the conditions hold (`hu.a6 ทาง ค`)
  assist?: NodeRef[]; // nodes that multiply the yearly chance ×6
  baseChance?: number; // 0.0075
  /** Events (×2 for secret jobs) and countries named in the row. */
  linked?: Refs;
  /** Special jobs. */
  flag?: string;
  fromStory?: string;
  anchor?: string;
  onLoss?: string;
  does?: string;
  src: Src;
}
export interface JobRules {
  offerCount: number;
  weightFormula: string;
  aptMatchWeight: number;
  raceBonus: number;
  rarityRoot: Record<string, number>;
  yearlyUpgradeChance: number;
  jobChangeChancePerYear: number;
  slowLifeChangeChance: number;
  freedomChangeChance: number;
  secretBaseChance: number;
  secretMaxChance: number;
  secretRetryChance: number;
  secretMultipliers: { id: string; text: string; mul: number | null; when: string }[];
  retire: { cond: string; why: string }[];
  slowLife: { retireAge: number; weightMul: number; hpRecover: number; incomeMul: number };
  institutionAlternatives: { fail: string; alt: string }[];
  anchorLoss: { lost: string; becomes: string }[];
  bodyLimits: { group: string; cond: string; effect: string; mul?: number }[];
  secretTagSources: { tag: string; usedIn: string; from: string; at: string; chance: string }[];
  directPaths: { job: string; nodes: string; why: string }[];
  kinds: { kind: string; how: string; offered: string; godHint: string }[];
}
export interface JobsFile {
  jobs: Job[];
  rules: JobRules;
}

// ---------- fates.json ----------

export interface Fate {
  id: string;
  name: string;
  good: boolean;
  tier: Rarity;
  age: [number, number];
  eligible: string;
  eligibleCond: CharCond[]; // all of these; empty = everyone
  /** Fallback rules and weights written in the eligibility cell (`ถ้าไม่มี ... ใช้ ...` `น้ำหนัก ×2`). */
  eligibleNotes: string[];
  omen: string;
  question: string;
  outcomes: string[];
  links: string[]; // doc paths and ids it is tied to
  refs: Refs;
  src: Src;
}
export interface FatesFile {
  fates: Fate[];
  rules: { n: number; name: string; text: string }[];
  changedFromCode: { code: string; now: string; why: string }[];
  weights: Record<Rarity, number>;
  count: [number, number];
  minGap: number;
  omenLead: number;
}

// ---------- origin.json ----------

export interface Pick<T = string> {
  id: T;
  w: number;
}
export interface Birthplace {
  race: RaceId;
  main: CountryId[];
  mainPct: number;
  diaspora: CountryId[];
  diasporaBigCity: boolean;
  diasporaPct: number;
  outPct: number;
  halfPct: number;
  mainText: string;
  diasporaText: string;
}
export interface HalfPair {
  main: RaceId;
  second: Pick<RaceId>[];
  worldNames: string[];
  despised: string;
  despisedCountries: CountryId[];
}
export interface MeetingPlace {
  pair: [RaceId, RaceId];
  places: Pick<CountryId>[];
  mainOnly: string;
  mainOnlyCountries: CountryId[];
  causes: (Pick & { note: string })[];
  src: Src;
}
export interface MeetCause {
  id: string;
  name: string;
  start: Effect[];
  startText: string;
  hbText: string;
  hbMul: { path: 'a' | 'b' | 'c'; mul: number }[];
}
/** Ids that share one chance (`b_falcon` · `nb_sky_born` (18%)). */
export interface GiftGroup {
  ids: string[];
  chance: number | null;
  cond: string;
}
export interface ContinentGift {
  continent: ContinentId;
  name: string;
  blessings: GiftGroup[];
  curses: GiftGroup[];
}
export interface Institution {
  id: string;
  name: string;
  countries: CountryId[];
  allCountries: boolean; // courts, councils, guilds: every country
  limit: string;
  genderOnly?: 'm' | 'f'; // only when the row names one gender and not the other
  classText: string;
  classes: { min?: number; max?: number }; // the first class range named in the row
  alt: string;
}
export interface BirthSign {
  id: string;
  name: string;
  kind: 'time' | 'sign';
  likes: RaceId[];
  clashes: RaceId[];
  effect: string;
  likesText: string; // as written (`เอลฟ์ จันทรา` names a subline, so `likes` over-reaches)
  clashesText: string;
  fx: Effect[];
}
/** 01-origin §1 steps 1ข 1ค 1ง: births that skip or change the ordinary draw. */
export interface SpecialBirth {
  id: 'summoned' | 'reincarnated' | 'doll' | 'woken';
  race?: RaceId;
  races?: RaceId[];
  chance?: number; // share of the race (summoned: of humans; reincarnated: of humans born in `country`)
  ofHumans?: number; // reincarnated: the same as a share of all humans
  country?: CountryId;
  age?: number; // human-equivalent age at the start
  node?: string; // first story node
  fromYear?: number; // world year the doll programme starts
  skipSteps?: number[];
  text: string;
}
export interface OriginFile {
  steps: { n: string; what: string; rule: string }[];
  specialBirths: SpecialBirth[];
  raceShare: Pick<RaceId>[];
  birthplaces: Birthplace[];
  halfPairs: HalfPair[];
  meetingRules: { n: number; rule: string }[];
  meetingPlaces: MeetingPlace[];
  meetCauses: MeetCause[];
  halfOfHalf: { partner: string; child: string; note: string }[];
  halfBlood: string[]; // bullet rules for half-bloods
  outsideRules: string[];
  outsideStories: { id: string; name: string; meaning: string; effect: string }[];
  continentGifts: ContinentGift[];
  gender: Record<RaceId, { m: number; f: number; n: number; note?: string }>;
  institutions: Institution[];
  birthSigns: BirthSign[];
  birthSignWeights: { time: string[]; sign: Pick[] };
  noHalf: RaceId[];
  halfStat: { coin: number; lifespanWiggle: number; weakTagAlways: boolean; secondTagChance: number };
}

// ---------- wish.json ----------

export interface WishCost {
  what: string;
  raw: string;
  points: number | null;
  parts?: { label: string; points: number }[];
}
export interface WishFile {
  principles: { n: number; text: string }[];
  fixed: { field: string; values: string; replaces: string }[];
  tendency: { field: string; effect: string; max?: number }[];
  story: { ask: string; becomes: string; refs: Refs }[];
  storyNote: string;
  paths: { path: string; when: string; how: string }[];
  budget: { total: number; costs: WishCost[]; overBudget: string; note: string };
  sheet: { part: string; shows: string }[];
  after: string[];
  limits: { traits: number; aptitudes: number; blessings: number; requestChars: number };
  extend: string;
}

// ---------- synonyms.json ----------

export interface SynValue {
  code: string;
  name: string;
  syn: string[];
}
export interface SynField {
  key: string; // race · specialBirth · half · gender · continent ...
  heading: string;
  field: string; // the ช่อง name used in the count table
  part: 'fixed' | 'tendency' | 'story' | '';
  values: SynValue[];
  declaredValues?: number;
  declaredSyn?: number;
}
export interface SynonymsFile {
  fields: SynField[];
  fieldNames: SynValue[]; // 2.19
  totals: { values: number; synonyms: number; declaredValues: number; declaredSynonyms: number };
  negation: { kind: string; words: string[] }[];
  negationResults: { case: string; effect: string }[];
  levelWords: { kind: string; words: string[] }[];
  levelEffects: { field: string; strong: string; weak: string }[];
  randomWords: { scope: string; words: string[] }[];
  fillerWords: { kind: string; words: string[] }[];
  offForm: { topic: string; words: string[]; reason: string }[];
  impossible: { ask: string; words: string[]; nearest: string }[];
  conflicts: { case: string; effect: string }[];
  steps: { n: number; what: string }[];
  outcomes: { result: string; cond: string; next: string }[];
  rules: { n: number; text: string }[];
  minSynonymLength: number;
  knownCharShare: number;
}

// ---------- companions.json ----------

export interface CompanionAbility {
  id: string; // pa_lick_heal
  name: string;
  group: string;
  levels: string[];
  /** `เสริมอาชีพ` as written, and the words of it that are job ids, aptitude ids and race ids. */
  jobsText: string;
  jobs: string[];
  apts: string[];
  races: string[];
  src: Src;
}
export interface CompanionSpecies {
  id: string; // sp_dog
  name: string;
  tier: Rarity;
  category: string;
  home: string;
  homeRefs: Refs;
  lifespan: [number, number] | null;
  abilities: { id: string; level: number }[];
  note: string;
  std: boolean; // false for sp_slime_lover (not in the 102)
  src: Src;
}
export interface CompanionStory {
  id: string; // cs_child_rescue
  name: string;
  group: string; // all · A · S · world
  cond: string;
  condCond: CharCond[];
  condNotes: string[];
  weight: number; // the `โอกาส` column: a relative weight among the stories of the same job group
  species: string[];
  speciesText: string;
  choices: { key: 'a' | 'b' | 'c' | 'd'; text: string }[];
  cutWhen: string;
  refs: Refs;
  src: Src;
}
export interface CompanionRules {
  parts: { thing: string; count: number | null; file: string }[];
  fields: { name: string; meaning: string }[];
  limits: { normal: number; specialist: number; beastking: number };
  yearly: { group: 'S' | 'A' | 'B'; chance: number; earlyChance?: number; cumulative: string; jobs: string[]; jobsText: string }[];
  childEventChance: number;
  raceMultiplier: { races: RaceId[]; mul: number; why: string }[];
  rarityWeights: { tier: Rarity; base: number; S: number; A: number; B: number }[];
  storyBoost: string;
  methods: { how: string; detail: string }[];
  bond: { level: number; effect: string }[];
  bondYears: number;
  bondCaps: { taming: string; cd: number | null; R: number | null; E: number | null; L: number | null }[]; // null: no cap
  lifeRules: string[];
  personalities: { id: string; name: string; effect: string }[];
  upkeep: { size: string; costPerYear: number; note: string }[];
  placeLimits: { cond: string; effect: string }[];
  interactions: { id: string; cond: string; effect: string; refs: Refs }[];
  worldEffects: { event: string; effect: string; refs: Refs }[];
  growth: string;
}
export interface CompanionsFile {
  rules: CompanionRules;
  abilities: CompanionAbility[];
  species: CompanionSpecies[];
  stories: CompanionStory[];
  /** Skills, blessings and curses that 17-companion-support adds live in skills.json, blessings.json, curses.json (ids below). */
  support: { skills: string[]; blessings: string[]; curses: string[] };
  traitsUsed: { use: string[]; clash: string[]; text: string };
}
