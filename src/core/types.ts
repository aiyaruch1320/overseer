// The shared contract of the game core. Owned by the lead session (docs/guide/code-plan.md §12.1):
// agents read these types and propose changes in their report instead of editing this file.
//
// Rules (code-plan §2): the state is plain JSON (no classes, no functions), every random draw goes
// through a named seed stream (§6.2), and screens read only the log (§6.3).
import type { LineageX } from './lineage/state';

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
  /** `outcome`: the event ended with that choice (`WR-04 ก)`). `phase`: `near` = about to fire, `running` = in progress. */
  | { k: 'event'; id: EventId; happened: boolean; outcome?: 'a' | 'b' | 'c'; phase?: 'near' | 'running'; closed?: boolean }
  /** trait, job, blessing, curse, skill, item... · `rune ระดับ 3` · an id ending in `*` matches any id with that prefix (`nb_mark_*`). */
  | { k: 'has'; kind: IdKind; id: string; level?: number }
  | { k: 'npc'; id: NpcId; alive: boolean }
  | { k: 'country'; ids: CountryId[] } // born in or living in one of these
  | { k: 'continent'; ids: ContinentId[] }
  | { k: 'era'; min: number; max?: number }
  | { k: 'gender'; value: 'm' | 'f' }
  | { k: 'race'; ids: string[] } // storyline race codes `hu` `gi` ... or race ids
  | { k: 'age'; min?: number; max?: number } // hAge
  | { k: 'class'; min?: number; max?: number } // social class 1..5
  | { k: 'half' } // born with a second race
  | { k: 'parents' } // the life has a living parent: false only for a life ordered an orphan (storylines/README.md §6 rule 10)
  | { k: 'anyOf'; kind: string; ids: string[]; min: number } // "at least 3 of these"
  /** A number the character or the world carries: `trust` `fame` `int` `godFaith` `gold` `country.W` `dfc`; `count` for "≥ 3 จาก 10 เผ่า". */
  | { k: 'cmp'; stat: string; op: '>=' | '>' | '<=' | '<' | '=='; value: number; count?: number; label?: string }
  /** A world variable threshold from an event condition cell: `H > 70` `M6 < 40` (events §0). */
  /** Names: `H` `T` `D` `F` `P` `M0`..`M14` (dragon moods) `Z:<dragon>` `tension`. `decades`: held that long (`F < 20 นาน 3 ทศวรรษ`). */
  | { k: 'var'; name: string; op: '<' | '>'; n: number; decades?: number }
  | { k: 'node'; id: NodeId; choice?: 'a' | 'b' | 'c' } // passed that node (and took that choice)
  | { k: 'stance'; ids: string[] } // country stance toward bondage `D` `L` `M` `A` `H` (economy/10-bondage.md §3.1)
  | { k: 'faith'; ids: string[] } // religion `faith.01`..`faith.23` (docs/lore/religions/README.md)
  | { k: 'sign'; ids: string[] } // birth sign (character/01-origin.md)
  /** Where the character lives: `coast` `river` `city` (large city) · `halfDislike` (a place that shuns the character's half-blood pair) · or a country flag `war` `famine` `plague` `golden` `fallen` `god_ruin`. */
  | { k: 'place'; kinds: string[] }
  /** A bond line at a level: `สายสหายระดับ 3` (bonds/README.md). */
  | { k: 'bond'; line: string; level: number }
  /** A life count: continents visited, battles won ... `travel.continents` ≥ 7. */
  | { k: 'count'; what: string; min: number }
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
  | { k: 'jump'; to: NodeId; years?: number; choice?: 'a' | 'b' | 'c' } // `ข้ามไป hu.a1 เร็วขึ้นสองปี` · `ข้ามไป el.a1 ทาง ก`
  | { k: 'npc'; id: NpcId } // ties the beat to an NPC slot (code-plan §6.1, storylines README §6.8)
  /** No `open` and no `op` = a reference only. `op` cuts, delays (n world years) or otherwise changes an event that has not fired. */
  | { k: 'event'; id: EventId; open?: boolean; op?: 'cut' | 'delay'; n?: number }
  | { k: 'death'; chance?: number; cause?: string }
  | { k: 'if'; cond: Condition; then: Effect[] }
  | { k: 'label'; text: string } // human words kept for display
  /** "A หรือ B": exactly one branch happens; weights are equal when the docs give none. */
  | { k: 'pick'; of: { weight?: number; label?: string; effects: Effect[] }[] }
  /** "แทน A ด้วย B": event B takes the place of A from now on (branches README). */
  | { k: 'replace'; from: EventId; to: EventId | string }
  /** NPC clash results on an NPC line: `เส้น ก) บังคับเกิด` `ถูกตัด` `ช้าลง` `น้ำหนัก +10` (combat/07). */
  /** `unit`: weight `add` (+10) or `mul` (×2); delay in `year`s. `how: 'default'` = "โดยปริยาย". */
  | { k: 'npcPath'; npc: NpcId; path: 'a' | 'b' | 'c'; op: 'force' | 'cut' | 'delay' | 'weight'; n?: number; unit?: 'add' | 'mul' | 'year'; how?: 'default' }
  /** "ได้ง่ายขึ้น": raises the chance of a later grant instead of granting it. */
  | { k: 'favour'; kind: IdKind; id: string; mul?: number }
  | ExtraEffect;

/** Effect kinds the storyline docs added in M0-b (scripts/codegen/lib/effects.ts). */
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
  /** `น้ำหนัก cv.10 ×2` `น้ำหนักฝ่ายปิดใน dw.t2 ×2`: a weight change on another node (a side of it when `label` is set). */
  | { k: 'nodeWeight'; node?: NodeId; label?: string; mul: number }
  /** `ถูกค้น 40% → ศึก`: what follows the arrow happens with this chance. */
  | { k: 'chance'; p: number; text: string; then: Effect[] }
  /** `ความหิว > 70 → ทาง ข ×2`: weight change on a choice of this very node. */
  | { k: 'choiceMod'; choice: 'a' | 'b' | 'c'; cond?: Condition; mul: number }
  /** `บาดแผลถาวร 10%`. */
  | { k: 'wound'; chance?: number; text?: string }
  /** Raises or lowers a relation number: `ไว้ใจเผ่าปีก +3`. `toward` is the Thai object word, empty when none is named. */
  | { k: 'trust'; toward: string; delta: number }
  /** Effects of a notes cell that only apply when the cond holds (`ต้องผ่าน be.a6 ทาง ก`). */
  | { k: 'only'; cond: Condition; then: Effect[] }
  /** Opens a job path: `ทางสู่อาชีพลับ swordsaint (ต้องมี sword_3)`. */
  | { k: 'jobpath'; job: string; secret: boolean; need?: Condition; text?: string }
  /** `WR-17 −30`: moves an event's weight by percentage points. */
  | { k: 'eventWeight'; id: string; delta?: number; mul?: number }
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
  | { k: 'stanceMul'; stance: string; mul: number; cond?: Condition }
  /** `ผ่าน 55 … ไม่ผ่าน 45 …`: one weighted outcome inside a choice (a run of these is a split). */
  | { k: 'outcome'; label: string; weight: number; effects: Effect[] }
  /** `ปลายทาง "ผู้ไม่เคยกลับมาจน" ถ้าทอง ≥ 150`: the row names an ending and when it is earned. */
  | { k: 'ending'; title: string; cond?: Condition }
  /** A different set of choices under a place or event condition (`ถ้าอยู่ SH-10 (…): ก) 35 … ข) 40 … ค) 25 …`). */
  | { k: 'variant'; cond?: Condition; text: string; choices: Choice[] }
  /** A battle the node adds only for some choices or places: `ศึก: npc_inquisitor หัวหน้า (ทาง ข หรือ ค)`. */
  | { k: 'battleFor'; choices: ('a' | 'b' | 'c')[]; enemies: string[]; role?: string }
  /** Weight change on a convergence choice that this row sets up (`ทาง ข ของ cv.4 ได้น้ำหนัก ×2`). `to` empty = the converge of the row. */
  | { k: 'entryMod'; to?: NodeId; choice: 'a' | 'b' | 'c'; cond?: Condition; mul: number }
  /** The node stands in for others, or is skipped: kept as effects of the notes cell. */
  | { k: 'replaces'; nodes: NodeId[]; when?: Condition };

/** `(\`freedom\` ×3)` or `(BIO-01 แล้ว ×3)`: multiply a choice weight when the condition holds. */
export interface WeightMod {
  cond: Condition;
  mul: number;
  /** Additive change: `40 (+20 kind generous)` or `60 (−20 ถ้า BIO-01 เกิดแล้ว)`; `mul` is 1 for a pure addition. */
  add?: number;
}

export interface Choice {
  key: 'a' | 'b' | 'c';
  weight: number;
  label: string; // the human text with codes stripped, for screens
  effects: Effect[];
  mods: WeightMod[];
  /** A choice that only exists under a condition ("ต้อง…", ผู้ถูกอัญเชิญ). */
  when?: Condition;
  /** Convergence weight cells name who is favoured without a number (`ศรัทธาโลก > 70`). */
  favours?: string;
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

/** The kinds of card the attention system raises (experience/07-attention.md §2). `majorOmen` is a ⭐ omen on the character's own continent. */
export type CardKind = 'prayer' | 'omen' | 'battle' | 'crisis' | 'majorOmen';
export const CARD_KINDS: readonly CardKind[] = ['prayer', 'omen', 'battle', 'crisis', 'majorOmen'];

export interface Settings {
  speed: 'pause' | 'normal' | 'fast';
  attention: 'low' | 'normal' | 'high'; // how often the game calls the player (experience/07-attention.md §4)
  /** `master` shuts every LLM point at once; `setup` `director` `epitaph` are the switches of the three points (llm/README.md §3). A save older than `master` has none: that reads as on. */
  llm: { master: boolean; setup: boolean; director: boolean; epitaph: boolean };
  /** A switch for each kind of card (07-attention.md §4): a kind switched off is not called, the log tells it. A save older than this has none: that reads as all on. */
  cards: Record<CardKind, boolean>;
  lang: 'th';
  /** Hints the player has dismissed for good (the first-life strip of the watch screen). A save older than this has none: that reads as not yet seen. */
  hintsSeen?: { firstLife?: boolean };
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

export type SlotStatus = 'absent' | 'alive' | 'dead' | 'gone';

export interface NpcSlotState {
  holder: string; // original id or successor id
  alive: boolean;
  path?: 'a' | 'b' | 'c';
  step: number; // story clock position
  place?: CountryId;
  rel: Record<string, number>; // toward the main character and other NPCs
  /**
   * Facts about the holder that systems besides the NPC system read (bonds, the god's dream, the ending). The NPC system writes them on every slot it makes;
   * optional here so a state made before they were typed (or by a test) still fits. `NpcSlotX` (src/core/npc/types.ts) narrows them to required.
   */
  /** Name of the current holder: the roster name for generation 1, "<name>ที่ N" after. */
  name?: string;
  gen?: number;
  status?: SlotStatus;
  /** World year of birth (negative before the start) and natural lifespan in world years. */
  born?: number;
  span?: number;
  died?: number;
  cause?: string;
  /** Home place of the row, to tell a moved holder. */
  home?: string;
  /** Gravely ill since this world year. */
  sick?: number;
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
  gender: 'm' | 'f' | 'n'; // n = no sex (slimes, some fae)
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
  /** Per-system extras added by later milestones (bonds, bondage, travel, combat), keyed by system. `LifeExt` types the slices other systems read. */
  ext: LifeExt;
}

/** Facts of `life.ext.character` that other systems read (the whole shape is `CharacterExt` in character/data.ts). */
export interface CharacterFacts {
  /** Fame points; the one number every system reads (economy climb, ending card, heir inheritance). */
  fame?: number;
  axes?: Record<string, number>;
  /** hAge of the natural death, hidden from the player. */
  deathAge?: number;
  /** hAge at which the current job began. */
  jobSince?: number;
  special?: string;
  companions?: string[];
  /** Maximum-hp bonus from gifts. */
  hpBonus?: number;
  /** The wish sheet the life was ordered by (19-wish.md); only the ask's family is read outside the character system. */
  wish?: { ask?: { family?: string } };
}

/** Facts of `life.ext.combat` that other systems read (the whole shape is `CombatExt` in combat/state.ts). */
export interface CombatFacts {
  /** Hit points now; `null` until first read (the maximum is then computed). */
  hp?: number | null;
  /** Rank in the army, 0 to 4; the economy reads it for the wage. */
  rank?: number;
  pending?: { prelude?: number }[];
}

/**
 * The slices of `life.ext` that more than one system reads, typed once here. Each system keeps the whole of its own slice where it was (plain JSON, `extOf` helpers);
 * the slices are optional because a slice is made on first use. Any other key stays `unknown`.
 */
export interface LifeExt {
  character?: CharacterFacts;
  combat?: CombatFacts;
  economy?: { debt?: number };
  travel?: { spent?: number };
  items?: { wield?: string };
  fate?: { avoided?: string[] };
  [system: string]: unknown;
}

/** Facts of `life.ext.story`, `.bondage` and `.bonds` that other systems read. These slices are not fields of `LifeExt` (each system's full shape is wider and tests build them by hand): read them through these. */
export interface StoryFacts { cur?: { id?: string }; ended?: string; line?: string; skipTo?: NodeId; open?: Record<string, boolean>; external?: string[] }
export interface BondageFacts { level?: number; held?: { npc?: string; gone?: string }[] }
export interface BondsFacts { crises?: { n: number }[] }
export const storyFacts = (life: LifeState): StoryFacts | undefined => life.ext.story as StoryFacts | undefined;
export const bondageFacts = (life: LifeState): BondageFacts | undefined => life.ext.bondage as BondageFacts | undefined;
export const bondsFacts = (life: LifeState): BondsFacts | undefined => life.ext.bonds as BondsFacts | undefined;

/** The life's fame (0 when the character system has not made its extras yet). */
export const fameOf = (life: LifeState): number => life.ext.character?.fame ?? 0;
/** The life's hit points as saved: `null` while combat has not read them. Combat's `hpOf` is the one that fills it. */
export const savedHp = (life: LifeState): number | null => life.ext.combat?.hp ?? null;

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
  /** The world's own extras (there is no `WorldState.ext`): the slices several systems read are typed in `WorldExt`. */
  ext: WorldExt;
}

/** What `god.ext` holds that crosses systems. Other keys (`god`, `goals`, `acts`, `policy`...) belong to one system and stay `unknown`. */
export interface WorldExt {
  /** The items system's legends and talismans (items/world.ts `ItemsWorld`). */
  items?: unknown;
  /** The god's window is open (set by the god system, read by the acts). */
  window?: boolean;
  conjure?: { freeDream?: boolean };
  ruin?: { protect?: Record<string, number> };
  [system: string]: unknown;
}

export interface LineageState {
  lives: { id: string; name: string; race: RaceId; born: number; died: number; title?: string }[];
  open: string[]; // unfinished stories handed to heirs
  chronicle: string[];
  collection: string[];
  /**
   * What the cross-life systems keep (cards, threads, book, recs, the heir...), typed in src/core/lineage/state.ts and made on first use by `lx(state)`. Plain JSON in the save. It stays one object under
   * `x`: lifting its fields up to this level would change the shape of every save and needs a migration of the saves that hold `x`.
   */
  x?: LineageX;
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
