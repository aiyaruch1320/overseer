// Shapes of data/gen/world-events.json and data/gen/local-events.json (code-plan §5.1 rows 2 and 3).
// Written by scripts/codegen/groups/events.ts, read by src/core/world (M1) and the npc system.
// Effects and conditions use the grammar of src/core/types.ts. World numbers are `stat` effects with the
// codes below; weight changes of other events are `stat` effects named `weight:<id>` (proposal: a real
// `weight` effect, see the M0-b events report).
import type { Condition, ContinentId, CountryId, Effect, EventId } from '../types';

/**
 * How the effects of an event row read (code-plan §5.2), in the event files:
 * - `{k:'event', id, open:true}` the row opens the event (verb `เรียก` `บังคับ` `เปิด` `ลูกโซ่` `→` in front)
 * - `{k:'event', id}` with no `open` only refers to it (it is named, made likelier or sooner, or used as a form), it is not opened here
 * - `{k:'pick', of}` "A หรือ B" or "A / B": exactly one branch happens (`label` names the case, `weight` is only set when the docs give one)
 * - `{k:'if', cond, then}` "ถ้า … เกิดแล้ว: …", "… เมื่อถึงยุค 4", "(… หลัง DR-01)": the effects only apply when the condition holds
 * - `{k:'replace', from, to}` "แทน WR-01 ด้วย WR-22"
 * A risk or a closeness (`PL-03 เสี่ยง` `WR-03 ใกล้`) and a refusal (`END-09 ไม่เปิด` `ป้องกัน END-04`) are kept as `label`, never as an event effect.
 */

/**
 * A condition of the event files. It is a `Condition` of src/core/types.ts whose `event` atom may also say which
 * sub-path of the event counts (`WR-04 ก)` → `outcome:'a'`) and how close it is (`ใกล้เกิด` → `phase:'near'`, `กำลังเดิน` → `'running'`).
 * Every WorldCond is a Condition: a reader that ignores the two extra fields still compiles. Proposal for the contract: add both
 * optional fields to `{k:'event'}` in types.ts and drop this type.
 */
export type WorldCond =
  | { k: 'event'; id: EventId; happened: boolean; outcome?: 'a' | 'b' | 'c'; phase?: 'near' | 'running' }
  | { k: 'and'; of: WorldCond[] }
  | { k: 'or'; of: WorldCond[] }
  | { k: 'not'; of: WorldCond }
  | Exclude<Condition, { k: 'event' } | { k: 'and' } | { k: 'or' } | { k: 'not' }>;

/** Importance mark of a world event: ⭐ changes the map · ● big · ○ small. Sets chance per decade and the cap. */
export type Mark = '⭐' | '●' | '○';

/**
 * Codes used as `stat` in the effects of world events:
 * `DFC` fallen dragons · `F` world faith · `F.dragon` dragon faith · `F.A` channel-A faith · `H` Morhaven hunger ·
 * `T` world tree health · `D` fog thickness · `P` Mecharia pollution · `SEA` sea level · `K` keys one side holds ·
 * `mood.all` mood of every living dragon · `mood.cap.all` the cap of every dragon · `tension` pair tension ·
 * `weight:<id>` chance weight of another event.
 */
export type WorldStat = string;

/** A state threshold read from a condition cell: `H > 70`, `T < 50`, `M6 < 40` (mood of dragon 6), `Z:คัลดรา > 70`. */
export interface VarCond {
  v: string;
  op: '<' | '>';
  n: number;
}

/** Where an event lives; religion weights are scaled by the share of its home that holds the faith (world-events §0.2.1). */
export interface Home {
  /** `table` = the §0.2.1 table · `row` = countries the row names · `world` = whole world */
  source: 'table' | 'row' | 'world';
  /** raw words of the table cell (country codes or continent names), empty for the whole world */
  words: string[];
  countries: CountryId[];
  continents: ContinentId[];
  world: boolean;
}

/** One religion weight of an event: `หนุน` (for) or `ต้าน` (against) of a faith number 1..21. */
export interface FaithWeight {
  faith: number;
  kind: 'for' | 'against';
  mul: number;
  /** waits for this event to have happened (`หลัง … (BIO-08)`) */
  after?: EventId;
  /** a condition the sim cannot read (`เมื่อ …`, a sub-group): the weight is kept but marked */
  when?: string;
  /** note in brackets after the number, kept for display */
  note?: string;
  src: string;
}

export interface Outcome {
  key: 'a' | 'b' | 'c';
  label: string;
  text: string;
  effects: Effect[];
  /** events named in this outcome */
  chain: EventId[];
}

/** World economy effect of an event (economy/01-world-economy.md §6). The raw cells stay for the economy generator. */
export interface EconEffect {
  scope: string;
  wealth: string;
  price: string;
  /** change of the central gold confidence C */
  c: number | null;
  src: string;
}

export interface WorldEvent {
  id: EventId;
  name: string;
  /** the bracket after the name (`มังกรปฐมสิ้น`) */
  alias: string;
  mark: Mark;
  group: string; // DR PL WR CT DM MC BIO GD HP PO GI FG END
  condText: string;
  whatText: string;
  effectText: string;
  /** era window the docs give. WR rows take it from their own era column. */
  era: [number, number];
  /** era window the doc-level sim reads (from the condition cell only); present only when it differs from `era` */
  eraSim?: [number, number];
  /** at least one of these events must have happened (ids in the condition cell, not the event itself) */
  needs: EventId[];
  thr: VarCond[];
  /**
   * The whole condition cell as a tree (era, DFC, keys, variable thresholds and events joined with and / or), the one the core reads.
   * `needs` and `thr` stay as the flat view the doc-level sim reads: an `or` of a threshold and an event shows up there as both,
   * which the sim reads as "and". A leaf `{k:'text'}` is prose the parser could not read (it is in _unparsed/events.md). Absent when the cell holds only the era.
   */
  cond?: WorldCond;
  /** Prose of the condition cell kept on purpose out of `cond`: the pair and the fuse of a war (`จักรกล × มังกร · เรือเหาะเก็บศิลาลอย`). */
  condNote?: string;
  /** DFC window from `DFC ≥ n` / `DFC = n` in the condition cell */
  dfc?: [number, number];
  /** keys one side must hold (`กุญแจ 5+ ชิ้น`) */
  keysMin?: number;
  /** peace events that must have happened (END-12) */
  hpMin?: number;
  /** endings: events that must all have happened (the `+` clauses of the condition) */
  needsAll?: EventId[];
  home: Home;
  /** what the sim and the core treat in code: a dragon falling, the mourning wave, the hero, an ending, the start state */
  role?: 'fall' | 'mourn' | 'hero' | 'ending' | 'start';
  /** dragon index (0..14) this event is the fall or the awakening of */
  dragon?: number;
  /** DR-xx, PL-xx, END-xx belong to this dragon in dragons[] */
  effects: Effect[];
  /** every event id named in the permanent-effect or outcome cell */
  chain: EventId[];
  outcomes: Outcome[];
  faith: FaithWeight[];
  /** path flag this event sets (`ฟ้าร่วง` …) */
  flag?: string;
  /** character memory granted to people who lived through it (branches/03 §1) */
  witness: Effect[];
  econ?: EconEffect;
  src: string;
}

/** A successor event of a changed continent (SF AS DW RF WT RL CL DV). */
export interface BranchEvent {
  id: EventId;
  name: string;
  mark: Mark;
  group: string;
  /** the continent change this belongs to */
  continent: string;
  /** event whose happening opens it (`หลัง DR-01`) */
  trigger: EventId | null;
  condText: string;
  whatText: string;
  effectText: string;
  /** closed events this one replaces (`แทน WR-02 และ GI-01`) */
  replaces: EventId[];
  needs: EventId[];
  /** years after the trigger, from `ภายใน 5 ปีหลัง`, `หลัง SF-01 10 ปี` */
  afterYears?: number;
  effects: Effect[];
  chain: EventId[];
  econ?: EconEffect;
  src: string;
}

export interface LastEraPhase {
  id: string; // 4ก 4ข 4ค
  name: string;
  dfc: [number, number];
}

export interface LastEraEvent {
  id: EventId;
  name: string;
  mark: Mark;
  condText: string;
  whatText: string;
  effectText: string;
  phases: string[];
  /** DFC window from the phases */
  dfc: [number, number];
  /** at least one of these LE events must have happened */
  needs: EventId[];
  /** keys one side must hold (`กุญแจที่รวมได้ ≥ 3`) */
  keysMin?: number;
  /** convergence points that must have opened (`cv.2 เคยเปิด`) */
  cv?: string[];
  /** may happen again, this many world years apart (section 2) */
  repeatYears?: number;
  /** needs the countdown to the ending (LE-10, LE-12) */
  countdown?: boolean;
  /** happens in the same year as another event (LE-11 with WR-15) */
  withEvent?: EventId;
  /** state it changes (section 3.1) */
  feedback: LastEraFeedback;
  chain: EventId[];
  src: string;
}

export interface LastEraFeedback {
  /** `K` keys: set to a value, or change by delta with the chance */
  keys?: { set?: number; delta?: number; chance?: number; max?: number; alt?: { delta: number; chance: number } };
  faith?: number;
  moodAll?: number;
  warMul?: { mul: number; years: number } | { clear: true };
  hpBlockYears?: number;
  /** LE-11: chance of each choice of WR-15 and the ending it leads to */
  lean?: { key: 'a' | 'b' | 'c'; label: string; chance: number; ending: EventId }[];
  text: string;
}

export interface DragonDef {
  index: number;
  name: string;
  title: string;
  /** event that is the fall of this dragon: DR-xx or END-xx */
  fallEvent: EventId;
  /** PL-xx awakening, for the nine pillars */
  awakeEvent?: EventId;
  /** earliest era in which it can fall */
  minEra: number;
  initMood: number;
  /** mood lost per decade before the stress factor (dragon-mood.md) */
  decay: number;
  /** index of the closest sibling (the pair whose loss hurts most) */
  pair: number | null;
}

/** A slow world variable (world-events §0.1.1). */
export interface WorldVar {
  code: string; // H T D F P SEA
  name: string;
  start: number | null;
  drift: number;
  noise: number;
  min: number;
  max: number;
  /** events that stop or flip the drift (all events the stop cell names) */
  stopEvents: EventId[];
  /** the ones that end the default drift: a name with no number (`BIO-03 หรือ WT-02 หยุดการลด`) or `… และหยุด`. A change that only adds (`HP-07 −40 ครั้งเดียว`, `DR-11 +10`) or swaps the drift (`แทน`) is not here. */
  halts: EventId[];
  /** one-time changes (`once`) and replacement drifts (`drift`) the stop cell gives; `fall` = each dragon that falls */
  changes: { event: EventId | 'fall'; delta: number; kind: 'once' | 'drift' }[];
  note: string;
  inSim: string;
  src: string;
}

/** Disturbance of a pillar dragon by digging, drilling and blocked lanes (world-events §0.1.1). */
export interface Disturbance {
  dragon: string;
  dragonIndex: number;
  start: number;
  drift: number;
  noise: number;
  /** a threshold of this event is `Z:<dragon>` */
  event: EventId;
  stopEvents: EventId[];
  bumps: { event: EventId; delta: number }[];
  note: string;
}

export interface FlagDef {
  name: string;
  trigger: EventId;
}

/** Events that become impossible when a trigger happens, and the branch events that replace them. */
export interface Closure {
  trigger: EventId;
  close: EventId[];
  /** closed event → the branch event that takes its place (the pairs the doc-level sim holds) */
  replace: { from: EventId; to: EventId }[];
  /** every other `X → Y` of the แทนที่ row: the successor is a world event (`WR-01 → WR-22`), a named thing (`DR-11 → พิธีไว้อาลัยมหาศักดิ์สิทธิ์`) or nobody (`ไม่มีผู้สืบทอด`) */
  swaps: { from: EventId | string; to: EventId | string; text: string }[];
  /** ids the docs list as staying open, to find clashes with `close` */
  keep: EventId[];
}

export interface FaithInfo {
  no: number;
  name: string;
  /** share of the world's believers in percent, null for hidden cults */
  pct: number | null;
}

export interface WorldRules {
  /** chance per decade once an event is open, by mark (§0.2) */
  rate: Record<Mark, number>;
  /** minimum world years between two events of a mark (§0.2) */
  capYears: Record<Mark, number>;
  /** the cap does not count these (dragon falls and what follows) */
  capFree: EventId[];
  /** chance per decade of a hero killing a legend dragon: before and after the first fall (§0.2) */
  hero: { before: number; after: number };
  /** years a convergence point stays open (convergence doc) */
  windowYears: number;
  mourn: { moodMin: number; moodMax: number; moodClosest: number; capLoss: number; faithA: number; faithAYears: number };
  /** world-events §0.4 rule 5: END and MC-12 weight ×3 in era 4 */
  era4Weight: { events: EventId[]; mul: number };
  /** DFC window of each era (story-continents §3.5) */
  eras: { era: number; dfc: [number, number] }[];
  lean: { key: 'a' | 'b' | 'c'; chance: number; ending: EventId }[];
  /** WR-15 chance is multiplied by 1 + (K − from) × per (04-last-era §3.1) */
  keyWeight: { from: number; per: number };
  /** a war of the same pair may open again after this many years (§0.4 rule 3) */
  warRepeatYears: number;
  /** ending conditions in §13, as numbers the engine reads */
  endings: { id: EventId; chance: number | null; text: string }[];
  /** number of world events per mark in the summary table */
  markCounts: Record<Mark, number>;
}

export interface WorldEventsData {
  rules: WorldRules;
  dragons: DragonDef[];
  vars: WorldVar[];
  disturb: Disturbance[];
  flags: FlagDef[];
  closures: Closure[];
  faiths: FaithInfo[];
  /** main faith numbers of every country, from the ศาสนา field of the country files (world-events §0.2.1) */
  mainFaiths: Record<CountryId, number[]>;
  events: WorldEvent[];
  branch: BranchEvent[];
  lastEra: LastEraEvent[];
  phases: LastEraPhase[];
}

// ---------- local events ----------

export interface LocalNpc {
  id: string;
  name: string;
  /** ★ core of the event (event closes if this NPC is gone) · ☆ has a part · '' a role */
  star: '' | '★' | '☆';
}

/** Which world events a local event reads, and when it may open (local-events rule 7). */
export interface LocalRead {
  id: EventId;
  /** `window` = from the omen of the event to a decade after (rule 7) · `after` = once happened · `near` = just before it happens */
  phase: 'window' | 'after' | 'near';
}

export interface LocalChain {
  to: string; // LC-xx
  op: 'mul' | 'close';
  mul?: number;
}

/** One branch of the permanent result: `ถ้า … ` and what follows. */
export interface LocalPath {
  when: string;
  text: string;
  effects: Effect[];
  chain: LocalChain[];
}

export interface LocalEvent {
  id: string; // LC-01 … LC-76 · LC-1xx / LC-2xx generated
  name: string;
  /** template number for generated rows */
  template?: string;
  generated: boolean;
  /** hand-written places or the country of a generated row */
  placeText: string;
  countries: CountryId[];
  dependsText: string;
  reads: LocalRead[];
  /** the dependency cell as a tree: `WR-24 ใกล้เกิด หรือธุลีทิพย์ใกล้ขาด` → or[event WR-24 near, text]. A leaf `text` is in _unparsed/events.md. */
  depends: WorldCond;
  npcs: LocalNpc[];
  whatText: string;
  resultText: string;
  paths: LocalPath[];
  /** effects that hold for every path (text before the first `ถ้า`) */
  effects: Effect[];
  /** world events the result touches (weights, delays, references) */
  touches: EventId[];
  chain: LocalChain[];
  /** `ได้รับผลจาก LC-xx` */
  receives: string[];
  /** chance per decade */
  chance: number;
  src: string;
}

export interface LocalTemplate {
  id: string; // LT-1 … LT-6
  name: string;
  openText: string;
  npcText: string;
  resultText: string;
  /** structured open condition: war level from the country context overlay, justice kinds, … */
  open: { war?: string[]; justice?: string[]; landmarks?: string[]; text: string };
  effects: Effect[];
  src: string;
}

export interface LocalEventsData {
  /** rules of the local layer that the engine reads */
  rules: { once: boolean; minNpcs: number; chance: number };
  templates: LocalTemplate[];
  events: LocalEvent[];
  generated: LocalEvent[];
}
