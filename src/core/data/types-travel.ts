// Shape of data/gen/travel.json (code-plan §5.1 row "พวกพ้อง ครอบครัว ผูกตัว เดินทาง").
// Written by scripts/codegen/groups/travel.ts from docs/systems/travel/01-travel-rules.md and the opening table of
// docs/lore/storylines/25-journeys.md. Owner: the bonds generator (code-plan §12.2). Shared contract types stay in ../types.ts.
import type { Condition, ContinentId, CountryId, Effect, EventId, GenFile, NodeId } from '../types';
import type { RawTable } from './types-economy';

/** `L0` stays at home · `L1` crosses countries in one continent · `L2` crosses continents. */
export type TravelLevelId = 'L0' | 'L1' | 'L2';

export interface TravelLevel {
  id: TravelLevelId;
  n: 0 | 1 | 2;
  name: string;
  meaning: string;
  examples: string;
  src: string;
}

export interface LevelTarget {
  group: string;
  /** Percent of lives that end at L0, L1, L2. Each row adds up to 100. */
  pct: [number, number, number];
  src: string;
}

export interface JobLegs {
  label: string;
  jobs: string[];
  legsRaw: string;
  /** Legs per life year. */
  legs: [number, number];
  /** One long trip per life ("1 ทริปยาวต่อชีวิต") instead of a yearly rate. */
  perLife: boolean;
  scope: string;
  note: string;
  src: string;
}

export interface LegRule {
  /** Days per world year a travelling job spends on the road, and a person who travels for a cause (§1, rule 2). */
  daysJob: number;
  daysCause: number;
  /** Shortest of three numbers: the job cap, the days that fit, the fares that can be paid. */
  text: string[];
  src: string;
}

export interface TravelCause {
  /** The overlay the cause opens: `sc` `ps` `ml` `ex` `wd` `tr` or `xc` (race table). */
  overlay: string;
  cause: string;
  whenRaw: string;
  when: Condition | null;
  /** Chance per life year when the condition holds (0.03 = 3%). */
  chance: number;
  /** "15% ในปีที่เหตุการณ์เกิด": the chance applies only in a year the world event fired. */
  inEventYear: boolean;
  mods: { cond: Condition; mul: number; raw: string }[];
  /** Nodes the success opens; `any` = one of them ("tr.a1 หรือ ml.a1"). Empty for `xc` (by race). */
  opens: NodeId[];
  opensRaw: string;
  byRace: boolean;
  src: string;
}

export interface CauseRules {
  /** A travel event not caused by a disaster fires at most once per this many years. */
  oncePerYears: number;
  mods: { raw: string; cond: Condition | null; mul: number }[];
  text: string;
  src: string;
}

export interface Overlay {
  id: string;
  name: string;
  openRaw: string;
  open: Condition | null;
  nodeCount: number;
  nodes: NodeId[];
  otherRaw: string;
  /** Chances per year of the causes of §2 that open this overlay (empty for `sf`, which opens by job). */
  causes: number[];
  /** `xc`: "35% ที่เกิดขึ้นเองตอนอายุเทียบ 24 ถึง 36 ถ้าตัวละครอยู่ L0" (the stranger comes to the character). */
  spontaneous?: { chance: number; ageMin: number; ageMax: number; level: TravelLevelId };
  src: string;
}

export interface Party {
  /** The name as the docs write it (`มนุษย์ช่าง` `ภูต` `ทุกเผ่า`). */
  name: string;
  /** Storyline race code (`hu` `el` ...) or null when the name is a sub-lineage the code list does not hold (`กัปปะ`). */
  race: string | null;
  /** A sub-lineage word beside the race (`ช่าง` of `มนุษย์ช่าง`). */
  sub?: string;
  /** Set for a country name (`SH-01`). */
  country?: CountryId;
}

export interface RaceRelation {
  value: number;
  from: Party[];
  to: Party[];
  mutual: boolean;
  except?: Party[];
  /** "ในถิ่นศาสนาแสง (เช่น AL-02)": the relation holds in places of this kind. */
  place?: { text: string; countries: CountryId[] };
  raw: string;
  src: string;
}

export interface Stance32 {
  value: number;
  name: string;
  effectRaw: string;
  enterable: boolean;
  tollMul: number;
  extraChecks: number;
  helpers: 'more' | 'normal' | 'none';
  /** How to get in when `enterable` is false. */
  entry: Condition | null;
  src: string;
}

export interface StanceModifier {
  delta: number;
  raw: string;
  cond: Condition | null;
  src: string;
}

export interface MoralRule {
  condRaw: string;
  cond: Condition | null;
  forbiddenRaw: string;
  forbiddenCountries: CountryId[];
  forbiddenContinents: ContinentId[];
  onEnterRaw: string;
  onEnter: Effect[];
  src: string;
}

export interface BodyLimit {
  text: string;
  races: string[];
}

export interface RaceMove {
  raceRaw: string;
  races: string[];
  sky: string;
  sea: string;
  deep: string;
  desert: string;
  fog: string;
  sun: string;
  canFly: boolean;
  deepWater: boolean;
  src: string;
}

export interface DeepWater {
  countries: CountryId[];
  needTag: string;
  notEnoughTag: string;
  text: string;
  src: string;
}

export interface RouteEventMod {
  events: EventId[];
  wildcard: string[];
  timeMul?: number;
  fareMul?: number;
  closes: boolean;
  text: string;
}

export interface TravelRoute {
  id: string;
  kind: string;
  linesRaw: string;
  daysRaw: string;
  /** Days per leg (world days); null when the cell is a rule rather than a range (the stair queue). */
  days: [number, number] | null;
  fareRaw: string;
  fare: [number, number] | null;
  whoRaw: string;
  eventsRaw: string;
  eventMods: RouteEventMod[];
  /** Keys the route asks for (`ky_stair_ticket` `ky_waterfall_key`). */
  needs: string[];
  /** One of the four sky routes to Azgar (§3.1). */
  sky: boolean;
  src: string;
}

export interface WindStill {
  period: string;
  from: number;
  to: number | null;
  seaTimeMul: number | null;
  seaFareMul: number | null;
  coastTimeMul: number | null;
  airship: string;
  d12: { item: number; mul: number } | null;
  textRaw: string[];
  src: string;
}

export interface Encounter {
  d: number;
  name: string;
  effectRaw: string;
  /** Only the effects that name a thing: curses, nodes, battles with enemy ids. */
  effects: Effect[];
  /** Every number in the prose (gold percent, price multipliers, chances), in reading order. */
  nums: number[];
  src: string;
}

export interface EncounterWeightMod {
  when: string;
  cond: Condition | null;
  items: { d: number; mul: number }[];
  /** `DR-06`: only legs by sea or airship. */
  routes?: string[];
  src: string;
}

export interface TravelTarget {
  metric: string;
  target: string;
  min: string;
  nums: number[];
  src: string;
}

export interface TravelData {
  counts: Record<string, number>;
  levels: TravelLevel[];
  levelTargets: LevelTarget[];
  jobLegs: JobLegs[];
  legRule: LegRule;
  causes: TravelCause[];
  causeRules: CauseRules;
  overlays: Overlay[];
  /** 3.1 the open-route bullets: text and the world events each names. */
  routeRules: { text: string; events: EventId[]; src: string }[];
  stances: Stance32[];
  allRacesStance: [number, number];
  raceRelations: RaceRelation[];
  stanceModifiers: StanceModifier[];
  moral: MoralRule[];
  bodyLimits: BodyLimit[];
  raceMoves: RaceMove[];
  deepWater: DeepWater;
  smuggle: { cost: [number, number]; wantedChance: number; skill: { id: string; level: number }; guides: string[]; text: string; src: string };
  routes: TravelRoute[];
  noSmuggleText: string;
  windStill: { years: number; rows: WindStill[]; src: string };
  encounters: Encounter[];
  encounterRolls: { perLeg: number; crossContinent: number; caravanWithPassengers: number; src: string };
  encounterMods: EncounterWeightMod[];
  targets: { goals: TravelTarget[]; measured: TravelTarget[] };
  raw: RawTable[];
}

export type TravelFile = GenFile<TravelData>;
