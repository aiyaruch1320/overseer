// Shapes of data/gen/weapons.json items.json materials.json forging.json (code-plan §5.1). Owned by the items generator.
import type { GenFile } from '../types';

/** One ability phrase of an item (`ยาว` `ท่าที X +N` `ไล่ ...`). `text` is always the phrase as written. */
export interface Ability {
  k: 'bonus' | 'reach' | 'parry' | 'twohand' | 'conceal' | 'unbreakable' | 'tool' | 'poison' | 'intimidate' | 'repel' | 'engrave' | 'bound' | 'stance' | 'dull' | 'text';
  text: string;
  /** Aptitude or job a tool serves (`farming`). */
  apt?: string;
  /** Stance and its bonus (`ท่าทีเจรจา +2`). */
  stance?: string;
  n?: number;
  /** Enemy codes or enemy-kind words a repel names. */
  codes?: string[];
  words?: string[];
  /** `bonus`: what it applies to (`ในน้ำ`), and whether n is a percentage as a fraction. */
  subject?: string;
  pct?: boolean;
}

export type Rarity = 'ของใช้' | 'C' | 'U' | 'R' | 'E' | 'L';

export interface WeaponUi {
  raw: string;
  shape?: string;
  len?: number;
  colors: string[];
  material?: string;
  effect?: string;
  pose?: string;
  size?: string;
}

export type WeaponGroup = 'everyday' | 'standard' | 'job' | 'job_secret' | 'job_special' | 'country' | 'continent' | 'forge' | 'legend' | 'material';

export interface Weapon {
  id: string;
  name: string;
  rarity: Rarity;
  power: number;
  /** Type as written (`ดาบ`), and the aptitude it trains (README §2). */
  type: string;
  apt: string;
  tags: string[];
  stats: Record<string, number>;
  abilities: Ability[];
  /** The last column: where it is found, or its origin and story. */
  origin: string;
  group: WeaponGroup;
  /** `wj_<job>_<c|u|r|e>` → job. */
  job?: string;
  /** Standard weapons: which material group can rework them. */
  materialGroup?: 'โลหะ' | 'ไม้' | '';
  /** Forge weapons: the forge key (`gromholm`). */
  forge?: string;
  /** Legend weapons: where it returns when the owner dies. */
  returnTo?: string;
  /** Material variants: base weapon and material ids. */
  from?: { base: string; material: string };
  npcs: string[];
  ui?: WeaponUi;
  src: string;
}

export interface WeaponJobSet {
  job: string;
  group: string;
  tiers: { rarity: Rarity; name: string; type: string }[];
  ui: { raw: string; shapes: string[]; colors: string[]; motif: string };
  src: string;
}

export interface WeaponsData {
  counts: { handWritten: number; variants: number; total: number; byRarity: Record<string, number> };
  /** README §1: weight, power, stat budget per rarity. */
  rarity: { rarity: Rarity; name: string; weight: number | null; power: [number, number]; statBudget: [number, number]; src: string }[];
  /** README §2: weapon group → aptitude and attack tags. */
  types: { type: string; apt: string; tags: string[]; src: string }[];
  /** 01 §3: starting weapon type per aptitude. */
  startTypes: { apt: string; type: string }[];
  abilityWords: { word: string; text: string }[];
  sourcesByRoute: { route: string; rarities: string; note: string }[];
  /** appearance/05 §4 and §5. */
  ui: {
    shapes: { type: string; shape: string; size: string; grip: string; focus: string }[];
    tierFrames: { rarity: string; finish: string; trim: string; glow: string; frame: string }[];
    tagEffects: { order: number; tags: string[]; effect: string; colors: string[] }[];
    wear: { source: string; trace: string }[];
  };
  jobSets: WeaponJobSet[];
  items: Weapon[];
}

export interface Material {
  id: string;
  name: string;
  rarity: Rarity;
  /** `dragon_bone` is in both groups. */
  groups: ('โลหะ' | 'ไม้')[];
  stats: Record<string, number>;
  tags: string[];
  abilities: Ability[];
  /** Weapon types (as written) this material cannot be used with. */
  excludes: string[];
  found: string;
  look?: { main: string; second: string; surface: string; mark: string };
  src: string;
}

export interface BioMaterial {
  id: string;
  name: string;
  rarity: Rarity;
  from: string;
  enemies: string[];
  usedFor: string;
  found: string;
  price: number | null;
  src: string;
}

export interface MaterialsData {
  /** 02 §1: how a material variant is made from a standard weapon. */
  mergeRules: { field: string; rule: string }[];
  /** Power of a variant by material rarity. */
  variantPower: Record<string, number>;
  materials: Material[];
  bio: BioMaterial[];
  worldLinks: string[];
}

export type ItemCat = 'armor' | 'accessory' | 'talisman' | 'folk' | 'consumable' | 'tool' | 'material' | 'key' | 'paired';

export interface Item {
  id: string;
  name: string;
  tier: Rarity;
  cat: ItemCat;
  /** Buy price at a W3 market (index ×1.0); null when not sold. */
  price: number | null;
  tags: string[];
  stats: Record<string, number>;
  abilities: Ability[];
  /** Armor: protection. */
  defense?: number;
  /** Kind column: material of armor, ring/necklace, potion/scroll, ... */
  kind?: string;
  /** Accessory slot. */
  slot?: string;
  /** Talisman: haunting spirit kind. */
  haunt?: string;
  /** Talisman: benefit and cost split at `ราคา:`. */
  boon?: string;
  cost?: string;
  /** Consumable: effect and when it is used. */
  effect?: string;
  useWhen?: string;
  /** Tool: group and the aptitude it serves. */
  group?: string;
  apt?: string;
  /** Material: what drops it and what it makes. */
  dropFrom?: string;
  enemies?: string[];
  usedFor?: string;
  /** Key item: flags it sets. */
  flags?: string[];
  where: string;
  story: string;
  src: string;
}

export interface ItemsData {
  counts: { total: number; byCat: Record<string, number>; priced: number };
  slots: { slot: string; count: string; cat: string }[];
  tiers: { tier: string; defense: [number, number]; statBudget: [number, number] }[];
  autoWear: { formula: string; rules: { key: string; text: string }[] };
  armorMultipliers: { key: string; text: string; nums: number[] }[];
  consumableHabits: { traits: string[]; rule: string }[];
  lifeTools: { rules: { key: string; text: string; nums: number[] }[]; lifetimeYears: Record<string, number>; bonusCap: number };
  sources: { source: string; tiers: string }[];
  prices: {
    basePrice: { cat: string; label: string; byTier: Record<string, number | null> }[];
    weaponBase: Record<string, number | null>;
    formula: { tierMid: Record<string, number>; perStat: number; perTag: number; tagCap: number; clamp: [number, number] };
    priceIndexW: number[];
    incomeIndexW: number[];
    placeMods: { where: string; mult: number | number[]; when: string }[];
    sellBack: { buyer: string; rate: string; note: string }[];
    services: { service: string; price: string; who: string }[];
    sellRates: { shop: number; direct: number; blackMarket: number };
    shopTiers: { size: string; maxTier: string; sells: string }[];
    incomeBase: Record<string, number>;
    toolPayback: { tier: string; base: number; price: number; bonus: number; life: number }[];
    toolCheck: { tier: string; price: string; bonus: string; yearly: string; payback: string }[];
  };
  talisman: {
    stages: { stage: number; name: string; when: string; effect: string }[];
    odds: { tier: string; omen: number; possess: number }[];
    oddsMods: { name: string; mult: number; when: string }[];
    spirits: { kind: string; during: string; wants: string; gives: string; enemies: string[]; exits: string }[];
    possession: { key: string; text: string }[];
    exits: { key: string; letter: string; weight: number; text: string }[];
    exitSpecial: { kind: string; text: string }[];
    two: { case: string; text: string }[];
    heirs: { key: string; text: string }[];
    finds: { place: string; kind: string; example: string }[];
    findChoices: { key: string; weight: number; text: string }[];
    godWindow: { stage: string; act: string; effect: string }[];
    npc: {
      principles: { key: string; text: string }[];
      entries: { source: string; when: string; note: string }[];
      buyers: { id: string; kind: string; npcs: string[]; tiers: string[]; mult: number; weight: number; likes: string[] }[];
      exitWeights: Record<string, Record<string, number>>;
      exitOrder: string[];
      effects: { relation: string; omen: string; possess: string; exit: string }[];
      permanent: { spirit: string; becomes: string; traits: string[] }[];
      cases: { holder: string; talisman: string; spirit: string; story: string }[];
      godWindow: { stage: string; act: string; effect: string }[];
      stageRows: { stage: string; when: string; seen: string }[];
      sim: { start: number; findPerYear: number; countries: number; holderDeathPerYear: number; years: number; runs: number; cap: number; tierCounts: Record<string, number> };
      simResult: { key: string; text: string }[];
    };
  };
  items: Item[];
}

export interface Smith {
  npc: string;
  name: string;
  place: string;
  makes: string[];
  material?: string;
  trial: string;
  trust?: number;
  note: string;
  src: string;
}

export interface ForgingData {
  steps: { step: string; chain: string; what: string }[];
  need: { cause: string; weight: number; result: string }[];
  materialSources: { route: string; gets: string }[];
  smithTiers: { smith: string; maxTier: string; skill: number; where: string }[];
  forges: { key: string; name: string; country: string; renown: string; afterEvent: string; src: string }[];
  forgeRules: { key: string; text: string }[];
  smiths: Smith[];
  rumorSources: { source: string; smiths: string }[];
  trials: { id: string; ask: string; a: string; b: string; c: string }[];
  order: {
    prices: { tier: string; price: number; time: string; who: string }[];
    choices: { key: string; weight: number; text: string }[];
  };
  wait: { cause: string; chance: string; result: string }[];
  roll: {
    skillBonus: { key: string; text: string; nums: number[] }[];
    difficulty: Record<string, number>;
    outcomes: { outcome: string; cond: string; gets: string }[];
    odds: { who: string; fail: number; flawed: number; asOrdered: number; masterpiece: number }[];
    masterpiece: { roll: number; ability: string }[];
    masterpieceUpgradeChance: number;
  };
  godWindow: { step: string; act: string; effect: string }[];
}

export type WeaponsFile = GenFile<WeaponsData>;
export type MaterialsFile = GenFile<MaterialsData>;
export type ItemsFile = GenFile<ItemsData>;
export type ForgingFile = GenFile<ForgingData>;
