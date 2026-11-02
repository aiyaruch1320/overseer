// Shapes of data/gen/npcs.json, countries.json and continents.json (code-plan §5.1 rows "ประเทศ ทวีป" and "NPC").
// Written by scripts/codegen/groups/npcs.ts from docs/lore/npcs, docs/lore/countries, docs/lore/world,
// docs/appearance/{01-continents,countries,npcs} and docs/systems/economy/{02-countries,03-classes}.
// Owner: the npcs data generator (code-plan §12.2). Shared contract types stay in ../types.ts.
import type { Condition, ContinentId, CountryId, Effect, GenFile, NpcId } from '../types';
import type { WorldCond } from './types-events';

// ---------- ids ----------

/** Religion id: the number in docs/lore/religions/README.md, `faith.01` ... `faith.23`. */
export type FaithId = string;
/** People code used by the storyline files: `hu` `el` `de` `dw` `or` `ha` `be` `na` `dk` `va` `fa` `sl` `dm` `me` `wi` `gi` `la` `co` `so` `mu` `gh`. */
export type PeopleId = string;
export type PathKey = 'a' | 'b' | 'c';
/** Era tags of succession.md: `4a` `4b` `4c` are the sub-periods ก ข ค of era 4. */
export type EraTag = '1' | '2' | '3' | '4a' | '4b' | '4c';

// ---------- city and continent UI (docs/appearance/README.md "วิธีอ่านช่อง ค่า UI") ----------

/** The `key=value; ...` UI cell of a country, merged from countries/0X (look), 10 (scale, seat, sacred) and 11 (war, defense, justice, mark). */
export interface CityUi {
  styles: Record<string, number>; // building style → weight
  roofs: string[]; // hex colours; empty when the doc says `default`
  plan: string; // grid organic radial canal
  wall: string; // as written in the continent file; `defense` (below) replaces it when present
  centre: string;
  ambient: string;
  extra: Record<string, number>; // special buildings → count
  scale?: number; // city size 1..5 (10-scale-and-sacred.md)
  seat?: string;
  sacred?: string;
  war?: string;
  defense?: string;
  justice?: string;
  mark: string[];
  /** tree farm lamps graves flora leaf cobble ... kept as written. */
  other: Record<string, string>;
  /** Every key=value pair exactly as the docs wrote it, for keys the code does not know yet. */
  raw: Record<string, string>;
}

export interface ContinentUi {
  palette: string[]; // five hex colours
  forms: string[]; // ทรง
  plan: string[]; // ผัง
  ambient: string[]; // บรรยากาศ
  wall: string[]; // กำแพง
  centre: string[]; // กลางเมือง
  raw: string;
}

// ---------- continents ----------

export interface Bloc {
  name: string;
  members: CountryId[];
  /** `false` for the neutral or outside rows ("เป็นกลาง" "นอกกลุ่ม" "ตัวแปร") that the map does not place together. */
  placed: boolean;
}

export interface Continent {
  id: ContinentId;
  index: number; // 1..9, the order of lore/world/continents.md
  name: string; // อัซการ์
  nickname: string; // ทวีปมังกร
  climate: string;
  countryCount: number;
  rule: string; // กฎประจำทวีป
  gauge: string; // มาตรวัดต่อประเทศ
  countries: CountryId[];
  blocs: Bloc[];
  /** Raw prose of docs/appearance/01-continents.md for the image step (M6). */
  look: { overview: string; ground: string; light: string; sound: string; city: string; people: string; oddity: string };
  ui: ContinentUi;
  /** lore/world/world-map.md §1 */
  map: { position: string; neighbours: { id: ContinentId; via: string }[]; reason: string };
  /** lore/world/world-map.md §4 city theme of the continent */
  cityTheme: { plan: string; buildings: string; features: string };
  src: string;
}

export interface ZoomLevel {
  id: 'world' | 'continent' | 'country' | 'city' | 'inside';
  name: string;
  zoomMin: number | null; // null = open end
  zoomMax: number | null;
  sees: string;
}

export interface WorldMap {
  width: number; // map units, 1600
  height: number; // 900
  /** 1 map unit = 3.84 world units = 0.48 tile */
  unitToWorld: number;
  unitToTile: number;
  zoomLevels: ZoomLevel[];
  /** Pairs of continents joined by land (world-map.md "คอแผ่นดิน"). */
  landLinks: [ContinentId, ContinentId][];
  landmarks: { name: string; at: string; drawnAs: string }[];
}

export interface ContinentsFile {
  continents: Continent[];
  world: WorldMap;
}

// ---------- countries ----------

export type RelationKind =
  | 'ally' // พันธมิตร
  | 'friend' // เพื่อน ใกล้ชิด เห็นใจ ร่วมมือ
  | 'foe' // ศัตรู เกลียด แค้น ตามล่า
  | 'tense' // ตึงเครียด ขัดแย้ง ระแวง คู่แข่ง
  | 'trade' // ค้า ซื้อ ขาย ลูกค้า ให้ทุน แลกเปลี่ยน
  | 'kin' // เครือญาติ
  | 'liege' // เจ้าเหนือหัว: this country rules the target
  | 'vassal' // the target rules this country (ถูกยึดโดย ถูกกักบริเวณโดย)
  | 'contact' // ติดต่อ ทูต สายข่าว
  | 'refugee' // ผู้ลี้ภัย
  | 'neutral' // เป็นกลางต่อ
  | 'secret' // ลับ with no other kind
  | 'other';

export interface Relation {
  to: CountryId;
  kind: RelationKind;
  /** The segment says the tie is hidden (ลับ เงียบ ๆ). */
  secret: boolean;
  /** The phrase of the doc this came from, codes included. */
  text: string;
  /** The other country lists this country too (any kind). */
  reciprocated: boolean;
}

export interface CountryFaith {
  id: FaithId | null; // null for local spirits and cults the religions doc does not list
  name: string; // as the country file wrote it
  channel: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  primary: boolean;
}

export interface CountryEcon {
  wBase: number; // 1..5 before blending with neighbours
  w: number; // 1..5 result
  g: 'ต่ำ' | 'กลาง' | 'สูง' | 'สูงมาก';
  m: 'เต็ม' | 'ผสม' | 'น้อย';
  exports: string[];
  shortages: string[];
  why: string;
}

export interface Country {
  id: CountryId;
  continent: ContinentId;
  index: number; // 1..n inside the continent
  name: string;
  title: string; // ฉายา: อาณาจักรยอดฟ้า
  gov: string; // รัฐ
  races: string; // เผ่า, as written
  religionRaw: string;
  religions: CountryFaith[];
  story: string; // เรื่องราว
  relationsRaw: string;
  relations: Relation[];
  hook: string; // ปมเรื่องหลัก
  bloc: string; // '' when none
  econ: CountryEcon;
  ui: CityUi;
  /** Eight-line prose of docs/appearance/countries/0X for the image step. */
  look: { aerial: string; street: string; materials: string; sound: string; people: string; landmark: string; oddity: string };
  npcs: NpcId[];
  src: string;
}

// ---------- NPC ----------

export type RelationAxis = 'trust' | 'favor' | 'grudge' | 'known'; // ไว้ใจ บุญคุณ แค้น ความรู้จัก
export type PathTag = 'help' | 'join' | 'hinder' | 'leave'; // [ช่วย] [ร่วม] [ขัดขวาง] [ปล่อย]

export interface AxisDelta {
  axis: RelationAxis;
  delta: number;
  /** Set when the axis is toward a people ("ไว้ใจนาคา +3", "ความไว้ใจจากยักษ์ +3"). */
  toward?: string;
}

export interface NpcPath {
  key: PathKey;
  /** Chance as written; the rest (100 − sum) is `NpcRow.restPct`, the story that fades. */
  pct: number;
  /** Doc text of the path without the `ก) 35%` marker, tags kept. */
  text: string;
  tags: PathTag[];
  /** Needs the main character in the zone while the story is open (README §7: tagged paths). */
  needsMc: boolean;
  /** `คืนบุญ`: the NPC repays a favour later. */
  repays: boolean;
  /** `พวกพ้อง 40%`: chance the NPC becomes an ally of the main character when this path ends well. */
  allyChance?: number;
  /** Axis changes toward the main character (`ไว้ใจ +3`). */
  axes: AxisDelta[];
  /** Weight changes on a later choice, event or convergence (`น้ำหนัก +5 ข)`, `DM-01 น้ำหนัก +10`). */
  weights: { target: string; delta: number }[];
  /**
   * When the path happens, read from a "ถ้า …" or "เมื่อ …" clause of its label: the events the clause names (`เมื่อ PO-02`) or, when the clause
   * names none, the event the arrow ends in (`ตายเมื่อคัลดราตื่น → PL-03`). `ถ้า X ตัดก)` is not a condition of this path: it is in `NpcRow.cuts`.
   * An `event` atom may carry `phase: 'near'` (`เมื่อ DR-01 ใกล้`).
   */
  cond: WorldCond | null;
  /**
   * Results read by effects.ts parseCell: events, NPC references, deaths, grants. Event ids after `→` are results, never opening points,
   * except in a path whose label holds `ถ้า` or `เมื่อ`: those events are its `cond` (or its cuts) and are not in `effects`
   * (data review M7: 45 paths; the 51 of the review counted the 6 that hold `เถ้า`, ash).
   */
  effects: Effect[];
  /** World events this path points at (after `→` or in the text). */
  events: string[];
  /** Other NPCs named in the path. */
  npcs: NpcId[];
}

/** Another path cut when a condition holds (`ถ้า DR-01 ตัดก)`). */
export interface PathCut {
  from: PathKey; // the path whose text says it
  cut: PathKey;
  when: Condition | null;
  text: string;
}

export interface NpcRef {
  to: NpcId;
  /** Where the doc mentions the other NPC: the unique/goal column or one of the paths. */
  in: 'unique' | PathKey | 'link';
  /** `successor` when the phrase says the other takes over (ผู้สืบทอด รับตำแหน่ง ขึ้นแทน). */
  rel: 'ref' | 'successor';
}

export interface NpcClockRule {
  /** `event`: the story opens at the first listed world event; `age`: it opens at a random time between adult and elder age (README §2.1). */
  open: 'event' | 'age';
  events: string[];
  /** Share of the holder's lifespan the story stays open. */
  window: number;
}

export interface NpcSuccession {
  /** 1 main ally (has a named successor in bonds/07) · 2 position (leader or event-bound row) · 3 background row (60% refill). */
  tier: 1 | 2 | 3;
  leader: boolean;
  /** The successor takes the original's roles with this chance, otherwise rolls the 3.1 table. */
  inherit: number;
  /** Chance a tier 3 row gets successors at all; 1 for tiers 1 and 2. */
  refill: number;
  allySuccessor?: AllySuccessor;
}

/** A row of docs/systems/bonds/07-successors.md. */
export interface AllySuccessor {
  id: string; // MH09-7S
  of: NpcId;
  name: string;
  peopleText: string;
  age: number | null;
  relationToOriginal: string;
  ties: string;
  hook: string;
}

export interface NpcLook {
  /** Race · age · stage as the appearance file wrote it. */
  raceText: string;
  stage: string; // เด็ก วัยรุ่น ผู้ใหญ่ ผู้เฒ่า ...
  description: string; // raw prose for the image step
  primary: string; // #rrggbb
  secondary: string;
  items: string[];
  itemsRaw: string;
  pose: string;
  uiRaw: string;
}

export interface NpcRow {
  id: NpcId;
  country: CountryId;
  continent: ContinentId;
  /** The last digit of the id: 1 leader · 2 to 4 regular · 5 half-blood · 6 small people added later · 7 bound or involved. */
  seq: number;
  group: 'leader' | 'regular' | 'half' | 'minor' | 'bound';
  name: string;
  /** Free text from the roster: `อาเวียนขาว`. */
  raceText: string;
  peopleId: PeopleId | null;
  halfPeopleId: PeopleId | null;
  ageText: string;
  age: number | null;
  role: string;
  unique: string; // ยูนีคและเป้าหมาย
  appearPct: number;
  paths: NpcPath[];
  restPct: number;
  cuts: PathCut[];
  clock: NpcClockRule;
  succession: NpcSuccession;
  refs: NpcRef[];
  /** `เชื่อม`: NPCs the row is linked to, and the world events named in the same clause. */
  links: NpcId[];
  linkEvents: string[];
  /** `ผูก`: local events (LC-) and world events the row is bound to. */
  binds: string[];
  refBy: NpcId[];
  /** World events named anywhere in the row (opening points and results). */
  events: string[];
  /** Class 1..5 and starting gold (economy/03-classes.md §8). */
  cls: number;
  gold: number;
  /** NF- fights of this NPC (combat/07-npc-clashes.md). */
  clashes: string[];
  look: NpcLook;
  src: string;
}

/** A newcomer template NT-01 ... NT-54 (succession.md §5). */
export interface NpcTemplate {
  id: string; // NT-01
  name: string;
  eras: EraTag[];
  eraText: string;
  /** Free text; backticked `war=feud` style markers are read into `needs`. */
  conditionText: string;
  needs: string[];
  continents: ContinentId[];
  secret: string;
  paths: { key: PathKey; weight: number; label: string; effects: Effect[] }[];
  links: string[]; // events or `ทายาท`
  /** Template for the continent (NT-19 ... NT-54) counts double when the roll picks one (succession.md §5). */
  continentTemplate: boolean;
  src: string;
}

export interface PeopleLife {
  people: string; // as the world-time table writes it
  id: PeopleId | null;
  lifeLo: number;
  lifeHi: number;
  rate: number; // world years per life year
  adult: number;
  elder: number;
  gap: number | null; // generation gap
}

export interface NpcRules {
  /** Share of the lifespan a story stays open (README §2.1 item 2). */
  openWindow: number;
  /** Chance a successor copies the original (succession.md §3). */
  inherit: number;
  /** Chance a tier 3 row gets successors (succession.md §2). */
  tier3Refill: number;
  /** Chance per country per roll that a newcomer arrives, the roll years, and the multiplier for continent templates (succession.md §5). */
  newcomer: { chance: number; everyYears: number; continentWeight: number };
  /** Axes toward the main character and their ranges (README §4). */
  axes: { axis: RelationAxis; label: string; lo: number; hi: number }[];
  /** Median gold of each class at W 3 and the income index by W (03-classes.md §8, 02-countries.md §3). */
  classMedian: Record<string, number>;
  incomeIndex: Record<string, number>;
  /** World year the roster's ages and gold are written for. */
  startYear: number;
  lives: PeopleLife[];
}

export interface NpcsFile {
  npcs: NpcRow[];
  templates: NpcTemplate[];
  rules: NpcRules;
}

export type NpcsGen = GenFile<NpcsFile>;
export type CountriesGen = GenFile<Country[]>;
export type ContinentsGen = GenFile<ContinentsFile>;
