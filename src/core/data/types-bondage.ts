// Shape of data/gen/bondage.json (code-plan §5.1 row "พวกพ้อง ครอบครัว ผูกตัว เดินทาง").
// Written by scripts/codegen/groups/bondage.ts from docs/systems/economy/10-bondage.md.
// Owner: the bonds generator (code-plan §12.2). Shared contract types stay in ../types.ts.
import type { Condition, CountryId, Effect, GenFile, NodeId } from '../types';
import type { RawTable } from './types-economy';

/** `B0` free · `B1` debt bond · `B2` contract servant · `B3` legal slave (10-bondage §2). */
export type BondageLevelId = 'B0' | 'B1' | 'B2' | 'B3';
/** Country stance toward bondage: `A` against · `H` banned but quiet · `D` debts and contracts · `L` slavery legal · `M` market. */
export type StanceId = 'A' | 'H' | 'D' | 'L' | 'M';
/** What a stance says about one level: legal, illegal, `hidden` (แอบมี: exists under the table) or `none` (ไม่มี). */
export type Legality = 'legal' | 'illegal' | 'hidden' | 'none';

export interface BondageIntent {
  n: number;
  text: string;
  src: string;
}

export interface BondageLevel {
  id: BondageLevelId;
  n: 0 | 1 | 2 | 3;
  name: string;
  /** The condition cell as written, and what the parser could read of it. */
  arisesRaw: string;
  arises: Condition | null;
  rights: string;
  exits: string[];
  /** B1 to B3 count as social class 1 (the line under the table). */
  classOne: boolean;
  src: string;
}

export interface Stance {
  id: StanceId;
  name: string;
  legal: Record<'B1' | 'B2' | 'B3', Legality>;
  /** The last column as written, its effects (`c_wanted`, `c_infamous` 40% ...) and the flags read from its words. */
  effectRaw: string;
  effects: Effect[];
  freeOnEntry: boolean;
  canBuyContract: boolean;
  canBuyPerson: boolean;
  registry: boolean;
  chaseBack: boolean;
  marketFee: boolean;
  look: boolean;
  src: string;
}

export interface StanceGroup {
  stance: StanceId;
  countries: CountryId[];
  /** Every id the cell names, with the name beside it as written (checked against countries.json by the tests). */
  named: { id: CountryId; name: string }[];
  /** `ซิลวาเนลทั้งหมด (SV-01 ถึง SV-18)`: ids come from the range. */
  range?: [CountryId, CountryId];
  reason: string;
  src: string;
}

export interface Class1Share {
  stance: StanceId;
  b1: number;
  b2: number;
  b3: number;
  rest: number;
  restText: string;
  src: string;
}

export interface BondageRoute {
  way: string;
  causeRaw: string;
  cause: Condition | null;
  /** Levels the way can give (`B2 หรือ B3` is [2, 3]); empty when the cell names none. */
  levels: number[];
  levelsRaw: string;
  nodes: NodeId[];
  /** A weight or chance written in the cell, none in the current docs. */
  note: string;
  src: string;
}

export interface BondageExit {
  way: string;
  condRaw: string;
  cond: Condition | null;
  resultRaw: string;
  effects: Effect[];
  /** The level the exit leads to: 0 for every row of the docs. */
  toLevel: number | null;
  /** "ชนชั้นขึ้นหนึ่งชั้น (ถ้ามีงาน)": the class rises by this many steps, when `classUpIf` holds (kept as the words of the doc). */
  classUp: number;
  classUpIf?: string;
  src: string;
}

export interface BondagePrice {
  level: 'B1' | 'B2' | 'B3';
  /** Gold range of the price cell (B1 is the remaining debt). */
  min: number;
  max: number;
  note: string;
  /** B2: gold per remaining contract year. B3: base price × skill 1 to 6. B1: share of income taken per year. */
  perContractYear?: number;
  basePrice?: number;
  skillRange?: [number, number];
  wageCut?: [number, number];
  src: string;
}

export interface BondageIncome {
  /** The income multipliers of the paragraph under the price table. */
  b1ClassMul: number;
  b23ClassMul: number;
  livingCost: [number, number];
  savingPerYear: [number, number];
  atW: number;
  text: string;
  src: string;
}

export interface BondageRole {
  role: string;
  whenRaw: string;
  when: Condition | null;
  costRaw: string;
  gainRaw: string;
  src: string;
}

/** Numbers the role table of §8 carries, read out of its cells (the grammar of effects.ts does not read "ไว้ใจของประเทศท่าที A ต่อตัวละคร −2"). */
export interface BondageRoles {
  buyer: {
    stances: StanceId[];
    /** Trust the stance-A countries lose toward the character when the buying is exposed. */
    trustLossInA: number;
    /** Chance of `c_infamous` in countries of these stances. */
    infamousChance: number;
    infamousStances: StanceId[];
    /** Extra income of the held person's work, at most. */
    incomeBonusMax: number;
  };
  redeemer: { gratitude: number; allyChance: number; freeInStance: StanceId };
  helper: { wantedCurse: string; trust: number; allyChance: number; viaStance: StanceId };
}

export interface BondageHold {
  /** "ปีที่ 5 มีโอกาส 30% ที่ผู้ถูกผูกตัวหนีหรือถูกช่วย 15% ที่เจ้าของถูกฟ้อง" */
  year: number;
  escapeChance: number;
  suedChance: number;
  /** Trust toward the owner falls this much every two years, not below the floor. */
  ownerTrustPerTwoYears: number;
  ownerTrustFloor: number;
  src: string;
}

export interface BondageData {
  counts: Record<string, number>;
  intent: BondageIntent[];
  levels: BondageLevel[];
  stances: Stance[];
  stanceGroups: StanceGroup[];
  /** Every country id → its stance; countries no row names are `defaultStance`. */
  byCountry: Record<CountryId, StanceId>;
  defaultStance: StanceId;
  class1: Class1Share[];
  routes: BondageRoute[];
  exits: BondageExit[];
  freeLand: { text: string; src: string };
  prices: BondagePrice[];
  income: BondageIncome;
  roles: BondageRole[];
  roleRules: BondageRoles;
  /** Chance the redeemed, freed or helped person becomes a bond candidate (§8): redeem or free 40%, helper 50%. */
  allyChance: { redeemOrFree: number; helper: number };
  /** Gratitude the redeemer gets (+3) and the trust the escapee gives the helper (+4). */
  gratitude: { redeem: number; free: number; helperTrust: number };
  hold: BondageHold;
  /** Every table of the file as read, so a doc change cannot lose a row. */
  raw: RawTable[];
}

export type BondageFile = GenFile<BondageData>;
