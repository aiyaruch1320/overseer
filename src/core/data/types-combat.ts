// Shapes of data/gen/combat.json enemies.json clashes.json (code-plan §5.1). Owned by the combat generator.
import type { Effect, GenFile } from '../types';

/** Weakness symbols of combat/02-type-matrix.md: ★ very weak · ▲ weak · · normal · ▼ resists · ✕ immune · var depends on the line. */
export type Mark = '★' | '▲' | '·' | '▼' | '✕' | 'var';

export interface MatrixCell {
  mark: Mark;
  note?: string;
}

export interface Stance {
  id: string;
  name: string;
  stat: string;
  tags: string[];
  needs: string;
  src: string;
}

export interface Reaction {
  /** An attack tag of the weakness matrix (`fire` `holy`) · `physical` for all physical tags · `sun` · `#truth` style tags. */
  tag: string;
  name: string;
  mark: Mark;
  /** A parenthesis the table puts after the symbol: `รูน ★ (รหัสปฐม)`. */
  note?: string;
}

/** A weakness the table writes as a sentence (`ทองสาปทำให้เขาลังเล ▲`): not an attack tag, so the roll cannot use it; the story does. */
export interface WeakText {
  text: string;
  /** ▲ weak · ★ very weak when the condition in the sentence holds; none when the table gives no symbol. */
  mark?: Mark;
}

/** A way to talk the enemy down (`เจรจาเมื่อตัวละครสัญญาไม่ใช้สมอสาป ▲`) with its symbol. */
export interface Negotiate {
  text: string;
  mark: Mark;
}

export interface CombatData {
  counts: { stances: number; kinds: number; attackTags: number; sanityRules: number };
  base: { row: string; code: string }[];
  order: { n: number; name: string; what: string }[];
  /** Enemy tiers: wounds and the most beats a fight lasts. */
  tiers: { tier: string; id: string; wounds: [number, number]; maxBeats: number; examples: string }[];
  stances: Stance[];
  /** 01 §4: numbers behind the roll. */
  roll: {
    statDiv: number;
    d20: { critSuccess: number; critFail: number };
    aptBonus: Record<string, number>;
    weak: number;
    veryWeak: number;
    resist: number;
    selfHandicap: number;
    allyPerPerson: number;
    allyCap: number;
    lowHp: { below: number; bonus: number };
    firstBeat: { advantage: number; ambush: number };
    elementMatch: number;
    heroLuck: number;
    dull: number;
    rows: { part: string; value: string; note: string; src: string }[];
  };
  damage: {
    multipliers: { what: string; value: string; nums: number[]; src: string }[];
    wounds: { from: number; to: number; result: string }[];
    dcDamage: number;
  };
  /** 01 §6: weight multipliers behind the stance a character picks. */
  choice: { cond: string; effect: string; src: string }[];
  results: { result: string; cond: string; effect: string }[];
  godInterventions: { when: string; act: string; effect: string }[];
  matrix: {
    symbols: { mark: string; meaning: string; bonus: string }[];
    attackSources: { from: string; tags: string }[];
    /** Physical table: kind → attack tag → cell. */
    physical: Record<string, Record<string, MatrixCell>>;
    element: Record<string, Record<string, MatrixCell>>;
    special: Record<string, Record<string, MatrixCell>>;
    kinds: { id: string; name: string }[];
    traits: { trait: string; effect: string }[];
    playableAsEnemy: { race: string; kind: string; weak: string; resist: string }[];
    sanity: { id: string; cond: string; effect: string }[];
  };
  encounters: {
    base: number;
    luckFactor: number;
    capPerYear: number;
    capPerYearSoldier: number;
    bossPerYear: number;
    tagMults: { monsterWard: number; monsterLure: number; child: number };
    types: { type: string; when: string; feature: string }[];
    worldFlags: { flag: string; mult: number; enemies: string[]; src: string }[];
    jobs: { jobs: string[]; mult: number; effect: string }[];
    raid: { phases: { phase: string; what: string; choices: string }[]; results: { result: string; town: string; npcs: string; hero: string }[] };
    npcClashChance: { cond: string; event: string; chance: string; perYear: number | null }[];
    mass: { role: string; stat: string; dc: number; result: string }[];
  };
  rewards: {
    byTier: { tier: string; material: number; weapon: number; blessing: number; curse: number; skill: number }[];
    material: { kind: string; materials: string; use: string }[];
    weapon: { enemy: string; kind: string; element: string }[];
    gifts: { kind: string; blessings: string[]; curses: string[] }[];
    nonKill: { how: string; reward: string }[];
    titles: { cond: string; title: string }[];
    twoForms: { form: string; win: string; winNoKill: string; lose: string }[];
  };
  dragons: {
    rows: { kind: string; example: string; killable: string; world: string }[];
    wild: { result: string; loot: string }[];
    meet: { type: string; when: string; feature: string; stance: string }[];
    wound: { cond: string; from: string }[];
    result: { result: string; detail: string }[];
    tests: { dragon: string; place: string; test: string; stat: string; badge: string }[];
  };
}

export interface Enemy {
  id: string;
  name: string;
  group: 'code' | 'world' | 'npc_generic' | 'npc_named' | 'boss';
  kinds: string[];
  traits: string[];
  tier: string;
  wounds: number | null;
  dc: number;
  where: string;
  continents: string[];
  countries: string[];
  /** Attack tags that hurt it (★ ▲). Only tags of the weakness matrix; sentences are in `weakText` and `negotiate`. */
  weak: Reaction[];
  /** Attack tags it resists (▼ ✕), also those the table lists in the notes column (`ไฟ ✕`). */
  resist: Reaction[];
  /** Story weaknesses written as sentences. */
  weakText: WeakText[];
  /** Ways to negotiate that carry a symbol. */
  negotiate: Negotiate[];
  attack?: string;
  stances?: string[];
  negotiable?: string;
  note: string;
  opens?: string;
  event?: string;
  src: string;
}

export interface EnemiesData {
  counts: { total: number; code: number; world: number; npcGeneric: number; npcNamed: number; boss: number };
  items: Enemy[];
}

/** `npcPath` with what the contract leaves out: how `n` is read, and "happens by default" (`เกิดโดยปริยาย` `สำเร็จโดยปริยาย`). Proposed for types.ts. */
export type ClashPathEffect = Extract<Effect, { k: 'npcPath' }> & {
  /** weight: `add` is +10 · −5 points, `mul` is ×2 · ×0.5; delay: `year` is the length of the delay in years (a season is 0.25). */
  unit?: 'add' | 'mul' | 'year';
  how?: 'default';
};
/** `น้ำหนัก ×2` on a world event: `eventWeight` with a multiplier instead of points (`delta` is 0). Proposed for types.ts. */
export type ClashEventWeight = Extract<Effect, { k: 'eventWeight' }> & { mul?: number };
export type ClashEffect = Effect | ClashPathEffect | ClashEventWeight;

export interface ClashOutcome {
  outcome: string;
  /** Standard kinds of combat/02 §3: win_kill win_spare talk draw lose flee, when the row names one. */
  kind: string;
  text: string;
  /** Results on the NPC's own lines are `npcPath` (the clash's NPC is the owner); denied effects ("ไม่ทอยบาดแผลถาวร") are not listed. */
  effects: ClashEffect[];
  src: string;
}

export interface Clash {
  id: string; // NF-AZ02-1
  npc: string; // AZ02-1
  name: string;
  continent: string;
  open: { code: string; text: string; chancePerYear: number | null };
  place: string;
  style: string;
  trace: string;
  outcomes: ClashOutcome[];
  src: string;
}

export interface ClashesData {
  counts: { total: number };
  openers: { code: string; name: string; when: string; chance: string }[];
  common: string[];
  standard: { result: string; npcLine: string; axis: string; hero: string }[];
  memory: { key: string; rule: string }[];
  audit: { result: string; clash: string; why: string }[];
  items: Clash[];
}

export type CombatFile = GenFile<CombatData>;
export type EnemiesFile = GenFile<EnemiesData>;
export type ClashesFile = GenFile<ClashesData>;
