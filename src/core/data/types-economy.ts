// Shape of data/gen/economy.json (code-plan §5.1). Owned by the economy generator.
import type { GenFile } from '../types';

export interface RawTable {
  headings: string[];
  header: string[];
  rows: string[][];
  src: string;
}

type Range = [number, number];

export interface EconomyData {
  counts: Record<string, number>;
  /** 01 §1: central gold trust C. */
  trust: { start: { before: number; after: number }; recoverPerYear: number; bands: { min: number | null; max: number | null; effect: string; priceMul: number; src: string }[]; moneyForms: { form: string; countries: string[]; rule: string }[] };
  goods: { code: string; name: string; base: number | null; examples: string; producers: string[]; src: string }[];
  balance: { exporter: number; enough: number; short: number };
  priceMods: { wIndex: number[]; scarcity: { exporter: number; enough: number; short: number; swing: number }; trustMid: number; trustLow: number };
  routes: { route: string; costPct: number; risk: string; where: string }[];
  eras: { era: number; name: string; trait: string; effect: string; transportPlus: number | null }[];
  worldEvents: { events: string[]; scope: string; w: string; price: string; trust: number | null; src: string }[];
  faucets: { name: string; size: string }[];
  sinks: { name: string; note: string }[];
  blackMarket: { where: string; role: string }[];
  wLevels: { w: number; name: string; priceIndex: number; incomeIndex: number; shops: string; look: string }[];
  /** 02 §1. */
  metrics: { name: string; range: string; meaning: string }[];
  classes: { n: number; name: string; who: string; rights: string }[];
  /** 03 §2: percent of births into each class by wealth W and inequality G. */
  classByWG: { w: number; g: string; pct: number[] }[];
  startGold: { cls: string; range: Range }[];
  startItems: { cls: string; w: number; pct: Record<string, number> }[];
  classJobs: { cls: number; boosted: string[]; closed: string[] }[];
  classMoves: { move: string; cond: string }[];
  regimes: { regime: string; examples: string[]; noble: number; rich: number; bondless: number; climb: string }[];
  raceRules: { case: string; effect: string }[];
  income: {
    base: Record<string, number>;
    wIncomeIndex: number[];
    moneyUse: Record<string, number>;
    classMul: Record<string, number>;
    swing: Range;
    jobCategories: { category: string; mul: number; note: string }[];
    jobSpecial: { jobs: string[]; rule: string }[];
    nobleIncome: { rank: string; income: Range | null; upkeep: number | null; text: string }[];
    living: { cls: string; cost: Range }[];
    tax: { regime: string; text: string; rates: number[] }[];
    poverty: { path: string; weight: number; text: string }[];
    bank: { service: string; rule: string }[];
    interestByClass: { classes: string; rate: number }[];
    moneylender: Range;
    depositRate: number;
    loanCapIncomeMul: number;
    prices: { cat: string; byTier: Record<string, number | null> }[];
    shopTiers: { size: string; maxTier: string; sells: string }[];
    goldAt30: { w: number; p25: number; p50: number; p90: number }[];
  };
  trade: { ways: string[][]; raw: RawTable[] };
  investment: {
    channels: { name: string; minCapital: number; mean: Range; sigma: number; risk: string; cond: string }[];
    region: { w: number; mul: number; sigmaMul: number }[];
    skillMul: { who: string; mul: number }[];
    decisions: { traits: string[]; allocation: string }[];
    bankruptcy: { situation: string; result: string }[];
    overflow: { over: number; mul: number }[];
    propertyTax: number;
    managerFee: number;
    nobleBuy: number;
    portfolios: string[][];
  };
  history: { powers: string[][]; lifelines: string[][]; tensions: string[][]; winners: string[][] };
  implementation: {
    steps: { id: string; name: string; text: string }[];
    loop: string[];
    code: { part: string; where: string; state: string }[];
    patches: { spot: string; task: string }[];
    targets: { metric: string; target: string; how: string }[];
    risks: { risk: string; mitigation: string }[];
    sim: { goldAt30: Record<string, number>; medianBand: Range; bankruptcy: Range; classClimb: number; tradeProfitCap: number; priceYearMax: number; borderGap: Range; inOutRatio: Range };
  };
  raw: RawTable[];
}

export type EconomyFile = GenFile<EconomyData>;
