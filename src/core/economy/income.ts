// Income, cost of living and tax of one life year (P2, docs/systems/economy/04-income-and-living.md §1 to §4).
//   income = base of the job × index of W × use of money (M) × class × swing
//   net    = income − living − tax
// All tables are read from data/gen/economy.json; the choices the docs leave open are in tuning.ts.
import { extOf as bondageExt, heldIncomeBonus } from '../bondage';
import type { Ctx } from '../game';
import { toolBonus } from '../items';
import type { Rng } from '../rng';
import type { LifeState } from '../types';
import { eco, REGIME_ORDER, CLASS_KEY, classNumber, type CountryEco, type EcoIndex, type MoneyUse, type RegimeId } from './data';
import type { EconomyExt } from './state';
import {
  COMBAT_IDLE, FIELD_LIVING_MUL, FOOD_SHARE, GROUP_ROWS, HALF_PAY_JOBS, IDLE_INCOME_MUL, INCOME_SCALE, JOB_MUL, MERC_BEST, MERC_JOBS, OUTLAW, OUTLAW_JOBS, SPECIAL_SALARY, WORK_JOBS,
} from './tuning';
import { foodShock, trust, wOf } from './world';

/** The level of bondage of the life now (0 free, 1 to 3), from the bondage system. */
const bonded = (ctx: Ctx, life: LifeState): number => (ctx.state.life === life ? bondageExt(life).level : 0);

const MONEY_DOWN: Record<MoneyUse, MoneyUse> = { full: 'mixed', mixed: 'little', little: 'little' };

/**
 * How much money the country uses now (01 §1): a trust C under 40 takes every country of W 3 or less down one step, 40 to 69 takes the
 * poor ones (W 1 to 2) that use money in the towns only to almost none.
 */
export function moneyUse(c: CountryEco, w: number, C: number): MoneyUse {
  if (C < 40 && w <= 3) return MONEY_DOWN[c.m];
  if (C < 70 && w <= 2 && c.m === 'mixed') return 'little';
  return c.m;
}

export interface Place {
  c: CountryEco;
  w: number;
  m: MoneyUse;
  regime: RegimeId;
}

/** The country the life lives in now: first-era data, W with the events, money use with the trust. */
export function placeOf(ctx: Ctx, E: EcoIndex, countryId: string): Place | null {
  const c = E.countries.get(countryId);
  if (!c) return null;
  const w = wOf(ctx, countryId);
  return { c, w, m: moneyUse(c, w, trust(ctx)), regime: c.regime };
}

const cls = (life: LifeState) => classNumber(life.cls);

const idleCache = new WeakMap<EcoIndex, number[]>();

/**
 * Yearly base of an adult with no job on record, by class: the mean of the common jobs, weighted like the offer at coming of age
 * (08-jobs-overview.md §1: the weight of a rarity is its root; 03-classes.md §4: the jobs a class favours count ×3, the ones it is shut out of ×0).
 * 08-jobs-overview.md has every adult offered a job at 20; the character system gives jobs through the story only, so a life without one
 * works the kind of trade its class and family have (assumption).
 */
export function idleBase(E: EcoIndex, n: number): number {
  let all = idleCache.get(E);
  if (!all) {
    all = [];
    for (let c = 1; c <= 5; c++) {
      const rule = E.data.classJobs.find((r) => r.cls === c);
      let sum = 0;
      let wsum = 0;
      for (const job of E.jobs.values()) {
        if (job.kind !== 'common' || !job.tier || job.tier === 'E') continue;
        const w = (E.rarityRoot[job.tier] ?? 1) * (rule?.closed.includes(job.id) ? 0 : rule?.boosted.includes(job.id) ? 3 : 1);
        const g = E.groupOf(job);
        sum += w * E.data.income.base[job.tier] * (E.data.income.jobCategories[GROUP_ROWS.indexOf(g)]?.mul ?? 1) * (JOB_MUL[job.id] ?? 1);
        wsum += w;
      }
      all.push(wsum ? sum / wsum : E.data.income.base.C);
    }
    idleCache.set(E, all);
  }
  return all[Math.min(5, Math.max(1, n)) - 1];
}

/**
 * Income of one year before tax (04 §1, §2). With `rng` the year's swing and the luck of paid work are drawn; without it the mean is
 * given (what a stat reader or a preview wants).
 */
export function grossIncome(ctx: Ctx, E: EcoIndex, life: LifeState, ext: EconomyExt, p: Place, rng?: Rng): number {
  const D = E.data.income;
  const n = cls(life);
  const wi = D.wIncomeIndex[p.w - 1];
  const mu = D.moneyUse[p.m];
  let income: number;
  if (n === 5) {
    // 04 §2: a noble earns no wage; the land pays (at W 3), a small house 60 to 100, a great one 100 to 200
    const [lo, hi] = D.nobleIncome[ext.rank === 'major' ? 1 : 0].income ?? [60, 100];
    income = (lo + (hi - lo) * ext.landFrac) * wi * mu;
  } else {
    const job = life.job ? E.jobs.get(life.job) : undefined;
    let base: number;
    let swing = rng ? D.swing[0] + (D.swing[1] - D.swing[0]) * rng.next() : (D.swing[0] + D.swing[1]) / 2;
    let free = false;
    if (!job) base = idleBase(E, n) * IDLE_INCOME_MUL;
    else if (job.kind !== 'common') {
      // secret and special jobs have no formula (04 §1 last row); the post that carries a salary names it
      base = SPECIAL_SALARY[job.id] ?? 0;
      free = base > 0;
    } else {
      const g = E.groupOf(job);
      base = D.base[job.tier ?? 'C'] * (D.jobCategories[GROUP_ROWS.indexOf(g)]?.mul ?? 1) * (JOB_MUL[job.id] ?? 1);
      if (HALF_PAY_JOBS.has(job.id)) base *= 0.5;
      if (g === 'combat' && rng) {
        // a year with no paid work: half the pay, none for the jobs that live on commissions (04 §1)
        if (rng.chance(COMBAT_IDLE)) base *= WORK_JOBS.has(job.id) ? 0 : 0.5;
      }
      if (OUTLAW_JOBS.has(job.id)) swing = rng ? OUTLAW.swing[0] + (OUTLAW.swing[1] - OUTLAW.swing[0]) * rng.next() : (OUTLAW.swing[0] + OUTLAW.swing[1]) / 2;
      if (MERC_JOBS.has(job.id) && MERC_BEST.countries.includes(life.country)) base *= MERC_BEST.mul;
    }
    // a man in debt bondage (B1) earns by the lower class, ×0.8, and what he is bound to pay is taken by the bondage system; B2 and B3 are of the
    // lowest class already (×0.2) (10-bondage.md §6)
    const mul = bonded(ctx, life) === 1 ? D.classMul.low : D.classMul[CLASS_KEY[n - 1]];
    income = free ? base : base * mul * wi * mu * swing;
    if (!free && ctx.state.life === life) {
      // the tools of a slow life add to its yield (items `toolBonus`, 0 to 0.5); a held person's work adds to a buyer's income (bondage, at most +15%)
      if (job && (job.slow || E.groupOf(job) === 'slow')) income *= 1 + toolBonus(ctx);
      income *= 1 + heldIncomeBonus(ctx) / 100;
    }
    // 04 §4: under a feudal crown the second class owes two months of labour a year
    if (n === 2 && p.regime === 'monarchy') income *= 10 / 12;
  }
  return Math.max(0, income * INCOME_SCALE * ext.inc + ext.incFlat);
}

/** Share of the income the state takes (04 §4); the second number is a donation that is not tax (theocracy). */
export function taxRate(E: EcoIndex, regime: RegimeId, n: number, ext: EconomyExt): number {
  const r = E.data.income.tax[REGIME_ORDER.indexOf(regime)]?.rates ?? [0];
  switch (regime) {
    case 'monarchy':
      return n <= 3 ? r[0] : n === 4 ? r[1] : r[2];
    case 'theocracy':
      return r[0] + (r[1] ?? 0);
    case 'stateless':
      // no state, a gang takes 10 to 25% as protection
      return ext.racket;
    case 'republic':
      // union services (insurance, lodging) bring half of it back
      return r[0] * 0.5;
    default:
      return r[0];
  }
}

/** Cost of living for one year (04 §3). */
export function livingCost(ctx: Ctx, E: EcoIndex, life: LifeState, ext: EconomyExt, p: Place): number {
  const n = cls(life);
  const [lo, hi] = E.data.income.living[n - 1].cost;
  let cost = lo + (hi - lo) * ext.lifestyle;
  cost *= E.data.priceMods.wIndex[p.w - 1];
  if (p.m === 'little') cost *= 0.8;
  const job = life.job ? E.jobs.get(life.job) : undefined;
  if (job?.slow) cost *= 0.7;
  if (job && WORK_JOBS.has(job.id)) cost *= FIELD_LIVING_MUL;
  // the part of the cost that is food follows the market, the events and the family's own bad years
  cost *= 1 + FOOD_SHARE * (foodShock(ctx, p.c.id) * ext.foodMul - 1);
  return cost;
}

/** Inheritance tax when a life ends and its gold passes to an heir (04 §4): feudal 10%, theocracy 5%, republics 15% of what passes 500, none where there is no state. */
export function inheritanceTax(ctx: Ctx, countryId: string, gold: number): number {
  const E = eco(ctx);
  const c = E?.countries.get(countryId);
  if (!c) return 0;
  switch (c.regime) {
    case 'monarchy':
    case 'military':
      return Math.round(gold * 0.1);
    case 'theocracy':
      return Math.round(gold * 0.05);
    case 'merchant':
    case 'republic':
    case 'company':
      return Math.round(Math.max(0, gold - 500) * 0.15);
    default:
      return 0;
  }
}
