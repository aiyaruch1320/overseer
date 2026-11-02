// Types that only the storyline generator (scripts/codegen/groups/storylines.ts) and the story system need.
// They extend src/core/types.ts without changing it; the extensions are proposed for the shared contract in
// the M0-b storylines report (docs/guide/code-plan.md §12.2 rule 1).
import type { Choice, Condition, Effect, IdKind, NodeId, StoryNode, WeightMod } from '../types';

// ---------- grammar (now in src/core/types.ts; aliases kept for the generator) ----------

export type CmpCondition = Extract<Condition, { k: 'cmp' }>;
export type HasLevelCondition = Extract<Condition, { k: 'has' }>;
export type RaceCondition = Extract<Condition, { k: 'race' }>;
export type ConditionX = Condition;
export type WeightModX = WeightMod;
export type ExtraEffect = Exclude<Effect, { k: 'grant' | 'remove' | 'stat' | 'battle' | 'converge' | 'jump' | 'npc' | 'event' | 'death' | 'if' | 'label' | 'pick' | 'replace' | 'npcPath' | 'favour' }>;
export type EffectX = Effect;
export type ChoiceX = Choice;

// ---------- node ----------

export type NodeKind =
  | 'main' // the 14 nodes of a race line
  | 'fallback' // `xx.l1` replaces a convergence entry node when the convergence is closed (section 4ก)
  | 'overlay' // hb hr ec pv ... mr dp
  | 'convergence'; // cv.N

export interface StoryNodeX extends Omit<StoryNode, 'choices' | 'notes' | 'when'> {
  kind: NodeKind;
  choices: ChoiceX[];
  notes: EffectX[];
  /** Conditions for the node to fire at all (title events, `ถ้าไม่มี … ข้าม`). */
  when?: ConditionX;
  /** Event ids named in the title (storylines README §6 rule 6). */
  titleEvents: string[];
  /** Where the node sits in its file: `4. โหนด`, `4ก. โหนดสำรอง…`, `5.3 eb …`. */
  section: string;
  /** The whole row is a hand-off to a convergence (`→ cv.4`); several when the row says `cv.8 หรือ cv.10`. */
  converge?: NodeId[];
  /** Fallback node: the nodes it stands in for (`ใช้แทน va.a4`). */
  replaces?: NodeId[];
  /** The choice cells say "ดูหัวข้อ 3": the options come from the rite of this node. */
  rite?: string;
  /** Text of the last column kept whole for display and for the director. */
  notesText: string;
}

// ---------- tribal pieces ----------

export interface RiteOutcome {
  /** First column: the outcome (`ผูกได้`) or the sub-line (`ทุ่งราบ`). */
  label: string;
  weight: number | null;
  mods: WeightModX[];
  when?: ConditionX;
  effects: EffectX[];
  text: string;
  /** Four-column rites (human, beast, merfolk): what happens on pass and on fail. */
  pass?: { text: string; effects: EffectX[] };
  fail?: { text: string; effects: EffectX[] };
}

export interface Rite {
  id: NodeId; // `el.t1`
  line: string;
  title: string; // `พิธีผูกราก`
  intro: string;
  header: string[];
  /** outcomes = weighted results; variants = one ceremony per sub-line with pass and fail. */
  form: 'outcomes' | 'variants';
  outcomes: RiteOutcome[];
  src: string;
}

export interface Ending {
  line: string;
  title: string;
  condRaw: string;
  cond?: ConditionX;
  /** Nodes the condition mentions, with the choice if given (`el.a2 ทาง ข`). */
  nodes: { id: NodeId; choice?: 'a' | 'b' | 'c' }[];
  events: string[];
  legend: string;
  src: string;
}

export interface Link {
  from: NodeId;
  to: NodeId[]; // `cv.N` (several for `cv.3 cv.5 cv.12`)
  toRaw: string;
  condRaw: string;
  cond?: ConditionX;
  src: string;
}

export interface LineMeta {
  id: string; // `hu` `sf`
  name: string;
  file: string;
  /** Overlay lines: when the line opens (`เปิดเมื่อ`). */
  openRaw?: string;
  open?: ConditionX;
  nodeIds: NodeId[];
  /** Tribal lines: the paragraph of section 1 (ธีม) without the main question. */
  theme?: string;
  /** Tribal lines: the question of the life, the sentence after `คำถามหลัก:` in section 1 (the whole question, no markup). */
  question?: string;
}

export type MoodEffect = Extract<ExtraEffect, { k: 'mood' }>;

export interface AllyStep {
  n: number;
  title: string;
  level: number;
  text: string;
  moods: MoodEffect[];
  effects: EffectX[];
}

export interface AllyEnding {
  key: 'a' | 'b' | 'c';
  weight: number;
  text: string;
  moods: MoodEffect[];
  effects: EffectX[];
}

export interface AllyArc {
  npc: string; // `MH09-7`
  name: string;
  country: string;
  race: string;
  lines: string[]; // `สหาย` `คู่หู` ...
  origin: string;
  intro: string;
  events: string[]; // `LC-17`
  worldEvents: string[];
  related: string[]; // NPC ids
  steps: AllyStep[];
  endings: AllyEnding[];
  group: 'first10' | 'flagship';
  src: string;
}

// ---------- files ----------

/** Section 2 of a race file: where a life of this race starts and what that changes. */
export interface Origin {
  line: string;
  /** Which table: `จุดกำเนิด` or `จุดกำเนิด (การตื่น)` for the races that wake. */
  table: string;
  kind: string; // `ถิ่นหลัก ชาวทุ่ง`
  placesRaw: string;
  places: string[]; // country ids, ranges expanded
  firstNodeRaw: string; // `hu.b1` · `hu.b1 ทางพิเศษ` · `ข้ามไป hu.t2`
  firstNode?: NodeId;
  /** The start jumps over earlier nodes (`ข้ามไป hu.t2`). */
  skipsTo?: NodeId;
  effects: EffectX[];
  text: string;
  src: string;
}

/** `23-heir.md` table: which node of the race line an heir node stands in for. */
export interface HeirRule {
  node: NodeId;
  nodesRaw: string;
  replaces: NodeId[];
  condRaw: string;
  cond?: ConditionX;
  src: string;
}

/** `22-halfblood.md` section 3: the 16 pair sets, the races they cover (both directions) and where the parents meet. */
export interface PairSet {
  set: string; // `ow`
  name: string;
  pairsRaw: string;
  /** [main race code, second race code] for each direction listed. */
  pairs: [string, string][];
  placesRaw: string;
  places: string[];
  src: string;
}

/** `22-halfblood.md` 5.17 and 6.1. */
export interface HalfbloodNpc {
  npc: string;
  name: string;
  set: string;
  role: string;
  src: string;
}

export interface JobOpener {
  job: string;
  type: string;
  pathRaw: string;
  nodes: { id: NodeId; choice?: 'a' | 'b' | 'c' }[];
  skills: string[];
  src: string;
}

export interface StorylinesData {
  nodes: StoryNodeX[];
  rites: Rite[];
  endings: Ending[];
  links: Link[];
  lines: LineMeta[];
  allyArcs: AllyArc[];
  origins: Origin[];
  heirRules: HeirRule[];
  pairSets: PairSet[];
  halfbloodNpcs: HalfbloodNpc[];
  jobOpeners: JobOpener[];
}

export interface ConvergencePoint extends StoryNodeX {
  name: string;
  openRaw: string;
  open?: ConditionX;
  /** Events named in brackets or after an arrow in the open column: what the point leads to or triggers. */
  openFollows?: string[];
  places: string[]; // `SH-09` ...
  placesRaw: string;
  entries: NodeId[]; // from the overview table
  entriesRaw: string;
  extraEntries: { from: NodeId; choice?: 'a' | 'b' | 'c'; text: string }[];
  intro: string;
  byRace: string; // "ผลตามเผ่า:" paragraph
  battleText: string; // "ศึก:" paragraph
  npcs: string[];
  enemies: string[];
}

export interface ConvergenceData {
  points: ConvergencePoint[];
  /** Section 3: the generic stand-in when a convergence is closed. */
  fallback: StoryNodeX;
  intro: string;
}

export type { IdKind, NodeId };
