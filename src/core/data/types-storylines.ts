// Types that only the storyline generator (scripts/codegen/groups/storylines.ts) and the story system need.
// They extend src/core/types.ts without changing it; the extensions are proposed for the shared contract in
// the M0-b storylines report (docs/guide/code-plan.md §12.2 rule 1).
import type { Choice, Condition, Effect, IdKind, NodeId, StoryNode, WeightMod } from '../types';

// ---------- grammar extensions ----------

/** Comparison of a numeric thing the main character carries: trust toward a race, reputation, intellect, faith, gold. */
export interface CmpCondition {
  k: 'cmp';
  /** `trust` `trust:<who>` `fame` `int` `godFaith` `gold` `class` or the Thai word when it has no key yet. */
  stat: string;
  op: '>=' | '>' | '<=' | '<' | '==';
  value: number;
  /** For "ไว้ใจ ≥ 3 จาก 10 เผ่าขึ้นไป": how many distinct things must pass. */
  count?: number;
  label?: string;
}

/** `rune ระดับ 3`: an id held at a minimum level. */
export interface HasLevelCondition {
  k: 'has';
  kind: IdKind;
  id: string;
  level: number;
}

/** The race of the main character: `ยักษ์` → `gi` (storylines README §3 codes). */
export interface RaceCondition {
  k: 'race';
  ids: string[];
}

export type ConditionX = Condition | CmpCondition | HasLevelCondition | RaceCondition;

/** Additive weight change: `40 (+20 kind generous)` or `60 (−20 ถ้า BIO-01 เกิดแล้ว)`. `mul` is 1 for a pure addition. */
export interface WeightModX extends WeightMod {
  add?: number;
}

export type ExtraEffect =
  /** `{สหาย:คิดถึง@2}` the feeling the character shows toward a bond line (systems/bonds/02-feelings.md). */
  | { k: 'mood'; line: string; mood: string; level: number }
  /** Template codes of the bond system: `FT-03` friend story · `KN-02` kin story · `PR-01` paired item (`to` for `FT-01 ถึง FT-05`). */
  | { k: 'template'; kind: 'FT' | 'KN' | 'PR'; code: string; to?: string; chance?: number }
  /** Opens or raises a bond line toward an NPC: `สายสหายระดับ 2` `เปิดสายคู่หู`. */
  | { k: 'bond'; line: string; level?: number }
  /** Places named in the text (`ไปไวลด์มาร์ก (AL-23)`). */
  | { k: 'place'; ids: string[] }
  /** The director may call an LLM role here (`LLM legend`). */
  | { k: 'llm'; role: string }
  /** A level on a scale the docs write as a letter and a digit: bondage `B2`, travel `L0`. */
  | { k: 'level'; scale: string; values: number[] }
  /** Sets the social class (`ชั้น 2`, `ขึ้นชั้น 5`). */
  | { k: 'class'; value: number }
  /** A quantity with a unit the docs name: `5 ปี` `4 คน` `3 หน่วย`. */
  | { k: 'qty'; n: number; unit: string }
  /** `ความหิว > 70 → ทาง ข ×2`: weight change on a choice of this very node. */
  | { k: 'choiceMod'; choice: 'a' | 'b' | 'c'; cond?: ConditionX; mul: number }
  /** `บาดแผลถาวร 10%`. */
  | { k: 'wound'; chance?: number; text?: string }
  /** Raises or lowers a relation number: `ไว้ใจเผ่าปีก +3`. `toward` is the Thai object word, empty when none is named. */
  | { k: 'trust'; toward: string; delta: number }
  /** Effects of a notes cell that only apply when the cond holds (`ต้องผ่าน be.a6 ทาง ก`). */
  | { k: 'only'; cond: ConditionX; then: EffectX[] }
  /** Opens a job path: `ทางสู่อาชีพลับ swordsaint (ต้องมี sword_3)`. */
  | { k: 'jobpath'; job: string; secret: boolean; need?: ConditionX; text?: string }
  /** `WR-17 −30`: moves an event's weight by percentage points. */
  | { k: 'eventWeight'; id: string; delta: number }
  /** A pointer to another node: `เปิด ml.a1` `ตรงกับ be.b2` `ใช้ใน hb.t2`. rel is the Thai verb. */
  | { k: 'ref'; nodes: NodeId[]; rel: string; choice?: 'a' | 'b' | 'c' }
  /** `ทอย d20 DC 12` `DC 18`. */
  | { k: 'check'; dc: number; die?: string }
  /** A percentage the phrase carries: `ดอก 20%` `ถูกค้น 40%` `ผ่าน 60%`. */
  | { k: 'pct'; text: string; pct: number }
  /** `รายได้ +20%` `ราคา −5%`. */
  | { k: 'statPct'; stat: string; pct: number }
  /** `รายได้ ×0.8` `ค่าแรง ×1.5`. */
  | { k: 'statMul'; stat: string; mul: number }
  /** `ทอง −30 ถึง −150` `ทอง ±5` `เพื่อน 1 ถึง 2 คน`. */
  | { k: 'range'; stat: string; min: number; max: number; unit?: string }
  /** `ท่าทีหลอกล่อ ×2`: weight of a combat stance. */
  | { k: 'stanceMul'; stance: string; mul: number; cond?: ConditionX }
  /** `ผ่าน 55 … ไม่ผ่าน 45 …`: one weighted outcome inside a choice (a run of these is a split). */
  | { k: 'outcome'; label: string; weight: number; effects: EffectX[] }
  /** `ปลายทาง "ผู้ไม่เคยกลับมาจน" ถ้าทอง ≥ 150`: the row names an ending and when it is earned. */
  | { k: 'ending'; title: string; cond?: ConditionX }
  /** A different set of choices under a place or event condition (`ถ้าอยู่ SH-10 (…): ก) 35 … ข) 40 … ค) 25 …`). */
  | { k: 'variant'; cond?: ConditionX; text: string; choices: ChoiceX[] }
  /** A battle the node adds only for some choices or places: `ศึก: npc_inquisitor หัวหน้า (ทาง ข หรือ ค)`. */
  | { k: 'battleFor'; choices: ('a' | 'b' | 'c')[]; enemies: string[]; role?: string }
  /** Weight change on a convergence choice that this row sets up (`ทาง ข ของ cv.4 ได้น้ำหนัก ×2`). `to` empty = the converge of the row. */
  | { k: 'entryMod'; to?: NodeId; choice: 'a' | 'b' | 'c'; cond?: ConditionX; mul: number }
  /** The node stands in for others, or is skipped: kept as effects of the notes cell. */
  | { k: 'replaces'; nodes: NodeId[]; when?: ConditionX };

export type EffectX = Effect | ExtraEffect;

export interface ChoiceX extends Omit<Choice, 'mods' | 'when' | 'effects'> {
  effects: EffectX[];
  mods: WeightModX[];
  /** "ต้อง…": the choice cannot be taken unless this holds. */
  when?: ConditionX;
  /** Convergence weight cells name who is favoured without a number (`ยักษ์ ×2` is a mod; `ศรัทธาโลก > 70` stays here). */
  favours?: string;
}

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

export interface StorylinesData {
  nodes: StoryNodeX[];
  rites: Rite[];
  endings: Ending[];
  links: Link[];
  lines: LineMeta[];
  allyArcs: AllyArc[];
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
