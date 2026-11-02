// Shape of data/gen/bonds.json (code-plan §5.1 row "พวกพ้อง ครอบครัว ผูกตัว เดินทาง").
// Written by scripts/codegen/groups/bonds.ts from docs/systems/bonds/*.md. Owner: the bonds generator (code-plan §12.2).
// Shared contract types stay in ../types.ts. Lines are named by their Thai word, as the markers `{สาย:อารมณ์@ระดับ}` and the
// condition `bond` write them; `id` is an ASCII key for the code.
import type { Condition, Effect, GenFile } from '../types';
import type { RawTable } from './types-economy';

/** `สหาย` `คู่หู` `คนรัก` `ครู` `ศิษย์` `ญาติผู้ใหญ่` `ญาติรุ่นเยาว์` `พี่น้อง` `คู่แข่ง`. */
export type LineName = string;

/** A row of a rule table whose cells are prose with numbers: the text and every number in it, in reading order. */
export interface RuleRow {
  key: string;
  text: string;
  nums: number[];
  src: string;
}

// ---------- 01 ties and levels ----------

export interface BondLine {
  id: string;
  name: LineName;
  meaning: string;
  /** Old `Relation` kinds of the code (`friend` `lover` `spouse` `mentor` `rival` `child` `parent`). */
  legacy: string[];
  /** The line has no kind in the old code (คู่หู, พี่น้อง). */
  isNew: boolean;
  mainEffect: string;
  src: string;
}

export interface BondLevel {
  n: number;
  /** B range of the level, both ends included. */
  min: number;
  max: number;
  name: string;
  meaning: string;
  src: string;
}

export interface NpcAxisRules {
  /** B at the start = low end of the starting level + this × trust (when trust is positive). */
  startBPerTrust: number;
  /** A candidate with gratitude ≥ `gratitudeMin` gets `gratitudeAcceptBonus` on the invite roll. */
  gratitudeMin: number;
  gratitudeAcceptBonus: number;
  /** Grudge at this level or more bars the NPC as a candidate. */
  grudgeBars: number;
  /** Every `knownPerB` of B the "known" axis rises by 1, up to `knownMax`. */
  knownPerB: number;
  knownMax: number;
  betrayB: number;
  betrayGrudge: number;
  /** Gratitude after a crisis the character helped through. */
  crisisGratitude: number;
  /** The fixed start B of a redeemed person (03 §1). */
  redeemStartB: number;
  rows: RuleRow[];
}

export interface BChange {
  id: string;
  cause: string;
  /** Change of B (a year when `perYear`). */
  delta: number;
  perYear: boolean;
  /** "ไม่ติดต่อกันนานกว่า 3 ปี": silent for this many years first. */
  silentYears?: number;
  /** `sameCountry` or `otherContinent` for the silence rows. */
  scope?: 'sameCountry' | 'otherContinent';
  /** "ปีละไม่เกินหนึ่งครั้งนับ". */
  maxPerYear?: number;
  /** The line changes too (betrayal: section 4). */
  changesLine: boolean;
  text: string;
  src: string;
}

/** A table cell of section 3 (effects by line and level): the words, and the percents and numbers in them. */
export interface EffectCell {
  text: string;
  pcts: number[];
  nums: number[];
}

export interface LineEffect {
  line: LineName;
  /** `การค้า` or `การศึก` for the two rows of คู่หู. */
  variant?: string;
  lv3: EffectCell;
  lv4: EffectCell;
  lv5: EffectCell;
  src: string;
}

export interface PartyRules {
  maxParty: number;
  /** Total roll bonus of the party, percent, at most. */
  bonusCapPct: number;
  /** Total damage cut of the party, percent, at most. */
  damageCutCapPct: number;
  /** "พวกพ้องอย่างน้อย 3 คน" of the dragon rules: companions at this level or more, this many. */
  legendMinLevel: number;
  legendCount: number;
  text: string;
  src: string;
}

export interface LineTransition {
  from: string;
  fromLines: LineName[];
  to: string;
  toLines: LineName[];
  /** The condition as written, the level it asks for ("ระดับ 3 ขึ้นไป") and the years together ("อย่างน้อยหนึ่งปี"). */
  whenRaw: string;
  minLevel?: number;
  togetherYears?: number;
  /** The target is the lifelong enemy (`nemesis`), which is not a bond. */
  toNemesis: boolean;
  src: string;
}

export interface LineEnding {
  id: 'death' | 'fade' | 'split' | 'betray' | 'goodEnd';
  way: string;
  whenRaw: string;
  effectRaw: string;
  effects: Effect[];
  /** B after the ending, when the row says it ("B ตกเหลือ 0"). */
  setB?: number;
  /** B lost by the ending ("B −30"). */
  deltaB?: number;
  src: string;
}

export interface TiesData {
  lines: BondLine[];
  levels: BondLevel[];
  /** Section 2 text: at most this many lines at level 3 or more, and at levels 1 and 2. */
  caps: { close: number; loose: number; text: string; src: string };
  npcAxes: NpcAxisRules;
  bChanges: BChange[];
  lineEffects: LineEffect[];
  party: PartyRules;
  transitions: LineTransition[];
  /** Section 4 "ห้าม" items. */
  forbidden: { text: string; nums: number[] }[];
  endings: LineEnding[];
  /** An unfinished bond story counts as an open thread for the heir; the heir takes at most this many (heirs/03). */
  heirOpenThreadCap: number;
  tests: RuleRow[];
}

// ---------- 02 feelings ----------

export interface Feeling {
  name: string;
  meaning: string;
  cause: string;
  src: string;
}

export interface FeelingBan {
  moods: string[];
  allowedRaw: string;
  forbiddenRaw: string;
  /** Lines read from the words; empty when the cell names a kind of person ("ผู้อาวุโส") instead of lines. */
  allowed: LineName[];
  forbidden: LineName[];
  /** The substitutes the row names, as written. */
  substituteRaw: string;
  src: string;
}

export interface FeelingsData {
  feelings: Feeling[];
  /** Lowest bond level at which the line can show the mood; null = never (the table's `-`). Keyed mood → line. */
  matrix: Record<string, Record<LineName, number | null>>;
  bans: FeelingBan[];
  rules: RuleRow[];
  /** At most this many moods at once, and shown at most this many times a year toward one line. */
  limits: { moodsAtOnce: number; perLinePerYear: number };
  expression: { way: string; usedFor: string; note: string }[];
  /** Change of the heart value per year the mood lasts (02 §5). `bloodFeud`: the mood opens a blood-feud open thread. */
  heart: { moods: string[]; delta: number; bloodFeud: boolean; text: string }[];
  heartByMood: Record<string, number>;
  tone: { mood: string; line: LineName; text: string; allowed: boolean }[];
  /** The marker form checked by the docs checker (`{สาย:อารมณ์@ระดับ}`). */
  marker: string;
}

// ---------- 03 formation ----------

export interface Candidate {
  id: string;
  source: string;
  ageRaw: string;
  age: [number, number] | null;
  chanceRaw: string;
  /** Chances written in the cell, in reading order (`65% … 70%` → [0.65, 0.7]). */
  chances: number[];
  startLevelRaw: string;
  startLevel: number | null;
  startB?: number;
  lines: LineName[];
  src: string;
}

export interface PairingRules {
  friendMaxAgeGap: number;
  loverMaxAgeGap: number;
  /** A student is younger than the character by this many years or more (or is still at school). */
  studentYoungerBy: number;
  /** A person held by another owner can bond up to this level. */
  heldMaxLevel: number;
  /** A person the character frees starts at this level. */
  freedStartLevel: number;
  rows: RuleRow[];
}

export interface Invite {
  id: string;
  kind: string;
  whenRaw: string;
  /** Lowest level of the other side to say yes; null = the level before the split ("เดิมก่อนแยก"). */
  minLevel: number | null;
  resultRaw: string;
  resultLine?: LineName;
  /** The party limit ("เข้าขบวน (ไม่เกิน 4)"). */
  partyMax?: number;
  src: string;
}

export interface InviteChance {
  /** chance = clamp(base + perB × B + compatibility − burden, min, max), in percent. */
  base: number;
  perB: number;
  min: number;
  max: number;
  formula: string;
  compat: { delta: number; condRaw: string; cond: Condition | null }[];
  burden: { delta: number; condRaw: string; cond: Condition | null }[];
  src: string;
}

export interface Refusal {
  id: 'plain' | 'condition' | 'hurt';
  /** Chance of this refusal (0.5 = 50%). */
  chance: number;
  name: string;
  effectRaw: string;
  deltaB: number;
  moods: string[];
  /** The other side asks a favour first: his story opens as a gate; the invite can be repeated without burden. */
  opensGate: boolean;
  src: string;
}

export interface NpcInvite {
  /** The NPC invites the character when his story is at this stage and B has reached this level. */
  stage: number;
  minLevel: number;
  text: string;
  src: string;
}

export interface AmongBonds {
  minLevel: number;
  chancePerYear: number;
  /** Weights of the line that forms: friend 50, rival 25, lover 25. */
  lineWeights: Record<LineName, number>;
  maxOpenPairs: number;
  /** Years after the bond forms in which the pair story rolls once. */
  storyYears: [number, number];
  /** B of the side not chosen in a rival crisis. */
  sidePenaltyB: number;
  rows: RuleRow[];
  src: string;
}

export interface PairChoice {
  key: 'a' | 'b' | 'c';
  weight: number;
  label: string;
  effects: Effect[];
}

export interface PairStory {
  line: LineName;
  story: string;
  choices: PairChoice[];
  /** Weights when one of the pair has died with no one to blame; the doc gives them per line. */
  deathWeights: [number, number, number];
  /** Choice cut when nobody caused the death (lovers: a). */
  deathCut?: 'a' | 'b' | 'c';
  src: string;
}

export interface OccupationWeight {
  groupRaw: string;
  lines: { line: LineName; mul: number; note?: string }[];
  example: string;
  src: string;
}

export interface FormationData {
  candidates: Candidate[];
  pairing: PairingRules;
  invites: Invite[];
  inviteChance: InviteChance;
  refusals: Refusal[];
  npcInvite: NpcInvite;
  apart: RuleRow[];
  /** News from far bonds: delay in years for another continent, at most one letter a year in the same country. */
  news: { otherContinentDelay: [number, number]; sameCountryPerYear: number; text: string; src: string };
  among: AmongBonds;
  pairStories: PairStory[];
  occupations: OccupationWeight[];
  tests: RuleRow[];
}

// ---------- 04 stories and 05 family ----------

export interface Layer {
  n: number;
  name: string;
  what: string;
  usedFor: string;
  good: string;
  limit: string;
}

export interface StoryStep {
  n: number;
  name: string;
  openLevel: number;
  /** Step 5 opens at level 5 or when the bond ends. */
  orEnd: boolean;
  what: string;
}

export interface Ending {
  key: 'a' | 'b' | 'c';
  weight: number;
  label: string;
  effects: Effect[];
  /** Story lines the ending opens (`เปิดเส้น ab`) and the storyline file a link points to. */
  opensLines: string[];
  opensFile?: string;
  /** Gratitude, gold or B the ending changes, read out of the words (บุญคุณ +2). */
  stats: { stat: string; delta: number }[];
  /** Bond-line templates the text names (`FT-05`). */
  templates: string[];
}

export interface StoryTemplate {
  id: string;
  name: string;
  /** The "สายที่ใช้ได้" cell as written, and the lines read from it (`ทุกสายที่ผูกพัน` = all). */
  linesRaw: string;
  lines: LineName[];
  allLines: boolean;
  fitRaw: string;
  age?: [number, number];
  classRange?: [number, number];
  /** "เมื่อโลกมีสงครามในประเทศ" (FT-11): the template is offered only where the war flag is set. */
  fitCond?: Condition;
  /** The mood markers of the template, in order. */
  moods: { line: LineName; mood: string; level: number }[];
  stage2: string;
  stage3: string;
  stage4: string;
  endings: Ending[];
  src: string;
}

export interface RaceForm {
  template: string;
  racesRaw: string;
  races: string[];
  form: string;
  src: string;
}

export interface ArcsData {
  layers: Layer[];
  steps: StoryStep[];
  /** Nodes of the two overlay lines of 28-allies.md (bn 8 · kn 5). */
  nodes: { bn: string[]; kn: string[] };
  /** A template story that ends with a new role in the world registers the person as a tier-3 NPC (weights of the other two ends, one roll of the heir). */
  endRole: { weights: [number, number, number]; heirRollPct: number; text: string; src: string };
  templates: StoryTemplate[];
  raceForms: RaceForm[];
  quality: RuleRow[];
  flagship: { criteria: RuleRow[]; actual: { criterion: string; target: string; actual: string; nums: number[]; src: string }[] };
}

export interface KinCount {
  /** Chance table: `n` relatives with `pct` percent; `orMore` for "4 ตัวขึ้นไป". */
  dist: { n: number; pct: number; orMore: boolean }[] | null;
  range: [number, number] | null;
}

export interface KinRow {
  relative: string;
  term: LineName;
  countRaw: string;
  count: KinCount;
  startLevelRaw: string;
  /** The level when the person lives with the character / is far or unknown (parents), or one number for the rest. */
  startLevel: number;
  startLevelFar?: number;
  src: string;
}

export interface KinOrigin {
  originRaw: string;
  /** Storyline node ids named in the cell (`sl.b1`). */
  nodes: string[];
  elderRaw: string;
  elderLevel: number | null;
  siblingRaw: string;
  siblingLevel: number | null;
  siblingRange: [number, number] | null;
  src: string;
}

export interface CloseKin {
  ageMin: number;
  ageMax: number;
  count: number;
  countBigHouse: number;
  minClassForTwo: number;
  /** A flag relative (AL17-2, MK12-1) is the close kin with this chance when race and country match. */
  flagChance: number;
  flagNpcs: string[];
  text: string;
  src: string;
}

export interface ChildStage {
  ageRaw: string;
  age: [number, number] | null;
  moods: string[];
  effectRaw: string;
  effects: Effect[];
  src: string;
}

export interface FamilyData {
  kin: KinRow[];
  origins: KinOrigin[];
  closeKin: CloseKin;
  templates: StoryTemplate[];
  children: { startLevel: number; stages: ChildStage[]; adopted: { startLevel: number; plusPerYear: number; text: string }; src: string };
  withSystems: { system: string; text: string }[];
}

// ---------- 06 paired items ----------

export interface PairSource {
  source: string;
  chanceRaw: string;
  chance: number | null;
  tiers: string[];
  example: string;
  templates: string[];
  src: string;
}

export interface PairHalf {
  id: string;
  /** Pair code (`PR-01`) found by the base name of the halves. */
  pair: string;
  name: string;
  tier: string;
  singleRaw: string;
  stats: Record<string, number>;
  src: string;
}

export interface PairedItem {
  id: string;
  halves: [string, string];
  linesRaw: string;
  lines: LineName[];
  races: string[];
  fullRaw: string;
  fullPcts: number[];
  memorialRaw: string;
  story: string;
  /** Story template codes the effect names (`FT-04`). */
  templates: string[];
  src: string;
}

export interface PairedData {
  rules: RuleRow[];
  /** Level of the bond needed for the full effect, the sale penalty on B, same-continent requirement. */
  full: { minLevel: number; sameContinent: boolean; sellPenaltyB: number };
  sources: PairSource[];
  halves: PairHalf[];
  pairs: PairedItem[];
}

// ---------- 07 successors ----------

export interface Successor {
  /** `MH09-7S`. */
  code: string;
  proto: string;
  protoName: string;
  name: string;
  race: string;
  age: number;
  relation: string;
  lines: LineName[];
  hook: string;
  src: string;
}

export interface SuccessorsData {
  rules: RuleRow[];
  /** Rule 5: the successor starts one level lower than the prototype. */
  levelDrop: number;
  /** Rule 4: lovers do not succeed. */
  loverDropped: boolean;
  list: Successor[];
}

export interface BondsData {
  counts: Record<string, number>;
  ties: TiesData;
  feelings: FeelingsData;
  formation: FormationData;
  arcs: ArcsData;
  family: FamilyData;
  paired: PairedData;
  successors: SuccessorsData;
  /** README "ตัวเลขสรุป": the counts the folder says it holds (the tests compare them with what was read). */
  summary: RuleRow[];
  /** Every table of the folder as read, so a doc change cannot lose a row. */
  raw: RawTable[];
}

export type BondsFile = GenFile<BondsData>;
