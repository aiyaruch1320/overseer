// The shared contract of the game core. Owned by the lead session (docs/guide/code-plan.md §12.1):
// agents read these types and propose changes in their report instead of editing this file.
//
// Rules (code-plan §2): the state is plain JSON (no classes, no functions), every random draw goes
// through a named seed stream (§6.2), and screens read only the log (§6.3).

// ---------- ids ----------

/** Country `AZ-01`, continent `AZ`, NPC `AL01-1`, event `DR-01`, story node `hu.t1`, convergence `cv.6`. */
export type CountryId = string;
export type ContinentId = 'AZ' | 'MH' | 'KD' | 'NR' | 'AL' | 'MK' | 'SH' | 'SV' | 'NB';
export type NpcId = string;
export type EventId = string;
export type NodeId = string;
export type RaceId = string;

/** Kinds of ids that an effect can grant or a condition can test (docs/guide/id-glossary.md). */
export type IdKind =
  | 'trait' // nature (`kind` `freedom`)
  | 'aptitude' // `sword_3` style ranks resolve to aptitude + level
  | 'job' // `soldier` `adventurer`
  | 'blessing' // `b_`
  | 'curse' // `c_`
  | 'skill' // `ns_` `nb_` `nc_` `u_` `pa_`
  | 'companion' // `sp_` spirit/animal partner
  | 'story' // `cs_` story flag
  | 'weapon' // `w?_`
  | 'gear' // `ar_` `ac_` `tm_` `cn_` `lt_` `mt_` `ky_`
  | 'material'
  | 'enemy' // combat/03-enemies.md
  | 'tag' // `#fire`
  | 'flag' // world/country flag or key-item flag
  | 'unknown';

// ---------- effect grammar (code-plan §5.2) ----------

/** A condition that gates an effect or multiplies a choice weight. `text` keeps phrases the parser could not read. */
export type Condition =
  | { k: 'event'; id: EventId; happened: boolean }
  | { k: 'has'; kind: IdKind; id: string } // trait, job, blessing, curse, skill, item...
  | { k: 'npc'; id: NpcId; alive: boolean }
  | { k: 'country'; ids: CountryId[] } // born in or living in one of these
  | { k: 'continent'; ids: ContinentId[] }
  | { k: 'era'; min: number; max?: number }
  | { k: 'gender'; value: 'm' | 'f' }
  | { k: 'node'; id: NodeId; choice?: 'a' | 'b' | 'c' } // passed that node (and took that choice)
  | { k: 'and'; of: Condition[] }
  | { k: 'or'; of: Condition[] }
  | { k: 'not'; of: Condition }
  | { k: 'text'; text: string };

export type Effect =
  | { k: 'grant'; kind: IdKind; id: string; chance?: number; level?: number } // `c_frail` 30% · `sword_3`
  | { k: 'remove'; kind: IdKind; id: string }
  | { k: 'stat'; stat: string; delta: number } // ทอง −50 · ความถนัดอาชีพ +1 · ชื่อเสียง +5
  | { k: 'battle'; enemies: string[]; text?: string } // `· ศึก` and enemy ids in the row
  | { k: 'converge'; to: NodeId } // `→ cv.6`
  | { k: 'jump'; to: NodeId; years?: number } // `ข้ามไป hu.a1 เร็วขึ้นสองปี`
  | { k: 'npc'; id: NpcId } // ties the beat to an NPC slot (code-plan §6.1, storylines README §6.8)
  | { k: 'event'; id: EventId; open?: boolean } // opens or references a world/local event
  | { k: 'death'; chance?: number; cause?: string }
  | { k: 'if'; cond: Condition; then: Effect[] }
  | { k: 'label'; text: string }; // human words kept for display

/** `(\`freedom\` ×3)` or `(BIO-01 แล้ว ×3)`: multiply a choice weight when the condition holds. */
export interface WeightMod {
  cond: Condition;
  mul: number;
}

export interface Choice {
  key: 'a' | 'b' | 'c';
  weight: number;
  label: string; // the human text with codes stripped, for screens
  effects: Effect[];
  mods: WeightMod[];
  /** A choice that only exists under a condition (e.g. ผู้ถูกอัญเชิญ). */
  when?: Condition;
}

export type LifeStage = 'b' | 't' | 'a' | 'e' | 'x';

export interface StoryNode {
  id: NodeId;
  line: string; // `hu` `cv` `bn` ...
  stage: LifeStage;
  age: [number, number]; // hAge range; max = 999 for `65+`
  title: string;
  choices: Choice[];
  /** Seventh column: battles, NPCs, world links, god notes. */
  notes: Effect[];
  /** Conditions for the node to fire at all (overlay lines, `ถ้าไม่มีเหตุการณ์ ⭐ ข้ามโหนดนี้`). */
  when?: Condition;
  godWindow?: { what: string; effect: string };
  src: string; // `docs/lore/storylines/01-human.md:43`
}

/** One generated data file (code-plan §5.3). */
export interface GenFile<T> {
  version: string; // hash of the source docs
  sources: string[];
  generatedBy: string;
  items: T;
}

// ---------- seed streams (code-plan §6.2) ----------

/** Named stream states; `world` and `world.le` start where scripts/sim/sim-world.mjs starts so results compare. */
export type RngState = Record<string, number>;

// ---------- clocks (code-plan §2.4, docs/lore/world/world-time.md) ----------

export interface Clock {
  worldYear: number; // ศ.ม.
  /** World years gathered toward the next world decade step. */
  worldAcc: number;
  /** Quarter of the current life year, 0..3 (four beats per life year). */
  quarter: number;
}

// ---------- log (code-plan §6.3) ----------

/** 0 = trace (debug only) · 1 = story log · 2 = worth a card · 3 = calls the player (attention). */
export type LogLevel = 0 | 1 | 2 | 3;

export interface LogEntry {
  n: number; // running number inside the save
  worldYear: number;
  age?: number; // hAge of the main character when there is one
  quarter?: number;
  sys: string; // owning system: `world` `story` `god` ...
  kind: string; // `node` `choice` `event` `death` `battle` ...
  id?: string; // node, event, NPC or item id
  data: Record<string, string | number | boolean | null>;
  level: LogLevel;
}

// ---------- state (code-plan §6.1) ----------

export interface DataVersions {
  [file: string]: string;
}

export interface Settings {
  speed: 'pause' | 'normal' | 'fast';
  attention: 'low' | 'normal' | 'high'; // how often the game calls the player (experience/07-attention.md §4)
  llm: { setup: boolean; director: boolean; epitaph: boolean };
  lang: 'th';
}

export interface DragonState {
  id: string;
  alive: boolean;
  mood: number;
  wounded?: boolean;
}

export interface WorldState {
  era: number; // 1..4 (5 = ended)
  dfc: number; // dragons fallen count
  vars: Record<string, number>; // H T D F and pillar disturbance
  dragons: DragonState[];
  countryFlags: Record<CountryId, string[]>; // `war` `famine` `plague` `golden` `fallen` `god_ruin`
  countryFaith: Record<CountryId, number>;
  happened: Record<EventId, number>; // event → world year it fired
  closed: EventId[];
  chains: Record<string, number>;
  ruins: { id: string; country: CountryId; year: number; healed?: boolean }[];
  names: Record<string, string>; // registry of names the world remembers (llm/03-naming.md)
  lastEraKeys: number;
  ended?: { year: number; id: EventId };
}

export interface NpcSlotState {
  holder: string; // original id or successor id
  alive: boolean;
  path?: 'a' | 'b' | 'c';
  step: number; // story clock position
  place?: CountryId;
  rel: Record<string, number>; // toward the main character and other NPCs
}

export interface NpcState {
  slots: Record<NpcId, NpcSlotState>;
  newcomers: NpcId[];
}

export interface StatBlock {
  pow: number;
  mag: number;
  spd: number;
  luk: number;
  int: number;
  vit: number;
}

export interface LifeState {
  id: string; // life number inside the lineage, `L1`
  name: string;
  race: RaceId;
  blood?: string; // sub-lineage or half-blood pair
  gender: 'm' | 'f';
  birthYear: number; // world year
  lifespan: number; // natural lifespan in world years, hidden from the player
  hAge: number; // human-equivalent age (life years)
  country: CountryId;
  home: CountryId;
  traits: string[];
  aptitudes: Record<string, number>;
  skills: string[];
  blessings: string[];
  curses: string[];
  fate: string[];
  job?: string;
  secretJob?: string;
  cls: string; // social class (economy/03-classes.md)
  gold: number;
  stats: StatBlock;
  items: string[];
  flags: string[]; // story flags `cs_` and key flags
  /** Story walk: node id → choice key taken. */
  passed: Record<NodeId, 'a' | 'b' | 'c' | '-'>;
  pending: NodeId[]; // jumps and convergences queued for the walk
  memory: string[]; // director memory, eight lines (llm/04-story.md)
  godFaith: number; // −100..100
  heart: number; // ภาระใจ
  dead?: { year: number; hAge: number; cause: string; node?: NodeId };
  /** Per-system extras added by later milestones (bonds, bondage, travel, combat), keyed by system. */
  ext: Record<string, unknown>;
}

export interface GodState {
  light: number; // แสงศรัทธา
  dread: number; // ความหวาดกลัว
  counters: Record<string, number>; // per life year and per life
  cooldowns: Record<string, number>;
  chest: unknown | null;
  dreams: unknown[];
  prayers: unknown[];
  chronicle: { worldYear: number; hAge?: number; kind: string; id: string; target?: string; result?: string }[];
  vows: string[];
  ext: Record<string, unknown>;
}

export interface LineageState {
  lives: { id: string; name: string; race: RaceId; born: number; died: number; title?: string }[];
  open: string[]; // unfinished stories handed to heirs
  chronicle: string[];
  collection: string[];
}

export interface GameState {
  schema: 1;
  seed: number;
  data: DataVersions;
  rng: RngState;
  clock: Clock;
  settings: Settings;
  world: WorldState;
  npcs: NpcState;
  life: LifeState | null;
  god: GodState;
  lineage: LineageState;
  log: LogEntry[];
  logN: number;
  /** Answers from the LLM, kept so a replay of the same seed gives the same life (code-plan §2.2). */
  llmAnswers: Record<string, string>;
}

// ---------- commands (code-plan §6.4) ----------

export type GodAction =
  | 'chest.open'
  | 'chest.pick'
  | 'chest.reroll'
  | 'chest.skip'
  | 'dream.send'
  | 'whisper'
  | 'prayer.answer'
  | 'miracle'
  | 'decree'
  | 'conjure'
  | 'vow.pick';

export type Command =
  | { type: 'advance'; beats?: number } // run the clock forward until the next call or for n beats
  | { type: 'god'; action: GodAction; args: Record<string, unknown>; confirm: boolean }
  | { type: 'settings'; patch: Partial<Settings> };

/** What the core answers to a command: a preview for the confirm screen, or the result after it ran. */
export type CommandResult =
  | { ok: true; preview?: Record<string, unknown>; log: LogEntry[] }
  | { ok: false; reason: string };
