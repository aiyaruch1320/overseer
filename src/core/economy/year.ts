// One life year of money (code: docs/systems/economy/08-implementation.md §3 steps 5 and 7): income − living − tax goes into gold,
// debts run, a bad year becomes the poverty of 04 §5, the class moves (03 §5), and the lines of the 24-economy storylines open.
import { boundBan, setClass } from '../character';
import type { Ctx } from '../game';
import { write } from '../log';
import { apply } from '../rules';
import { openLine } from '../story';
import type { LifeState } from '../types';
import { eco, classNumber, type EcoIndex } from './data';
import { grossIncome, livingCost, placeOf, taxRate, type Place } from './income';
import { extOf, type EconomyExt } from './state';
import {
  CLIMB, DEBT, ECONOMY_FROM_AGE, NOBLE_MAJOR, OPEN_EC, OUTLAW, OUTLAW_JOBS, POOL_DECAY, POVERTY, PV_MAX_W, TRADE_JOBS, WAGE_GROUPS, WORK_JOBS, WORK_LINE_JOBS, YEAR_NOTE,
} from './tuning';
import { syncEvents, writeCountry } from './world';

const live = (ctx: Ctx): LifeState | null => (ctx.state.life && !ctx.state.life.dead ? ctx.state.life : null);

/** Changes gold by whole numbers, never under 0; returns the change that happened. */
export function addGold(life: LifeState, delta: number): number {
  const next = Math.max(0, life.gold + Math.round(delta));
  const done = next - life.gold;
  life.gold = next;
  return done;
}

/**
 * A share of a battle or a war paid to the character (docs/systems/economy/04-income-and-living.md §1 "เงินเดือนประจำ + ส่วนแบ่งศึก"): the combat
 * system names the sum, the economy puts it in the purse, counts it for the year (`economy/year` says how much came as a share) and writes `economy/pay`
 * (level 0). Returns the gold paid (whole).
 */
export function payShare(ctx: Ctx, amount: number, why: string, data: Record<string, string | number | boolean | null> = {}): number {
  const life = live(ctx);
  if (!life || amount <= 0) return 0;
  const ext = extOf(life);
  const paid = addGold(life, amount);
  if (paid <= 0) return 0;
  ext.yr.share += paid;
  ext.yr.shares += 1;
  write(ctx.state, { sys: 'economy', kind: 'pay', id: why, data: { ...data, amount: paid, why }, level: 0 });
  return paid;
}

// ---------- birth ----------

/** The draws of a new life (its cost of living, its house) and the lines that open from the start. */
export function startLife(ctx: Ctx): void {
  const life = live(ctx);
  if (!life || !eco(ctx)) return;
  const ext = extOf(life);
  const rng = ctx.rng('economy.life');
  ext.lifestyle = rng.next();
  ext.racket = 0.1 + 0.15 * rng.next();
  ext.rank = rng.chance(NOBLE_MAJOR) ? 'major' : 'minor';
  ext.landFrac = rng.next();
  ext.mark = life.gold;
  ext.yr = { share: 0, shares: 0, debt0: 0 };
  syncEvents(ctx);
  openLines(ctx, life, ext);
}

// ---------- the year ----------

export interface YearFigures {
  income: number;
  tax: number;
  living: number;
  net: number;
}

/** The money of the coming year without drawing anything: what a preview, a stat reader or a test wants. */
export function expectedYear(ctx: Ctx, life: LifeState): (YearFigures & { place: Place }) | null {
  const E = eco(ctx);
  if (!E) return null;
  const place = placeOf(ctx, E, life.country);
  if (!place) return null;
  const ext = extOf(life);
  const income = grossIncome(ctx, E, life, ext, place);
  const tax = income * taxRate(E, place.regime, classNumber(life.cls), ext);
  const living = livingCost(ctx, E, life, ext, place);
  return { income, tax, living, net: income - tax - living, place };
}

/** Called by the system at the end of every life year (after the age went up). */
export function economyYear(ctx: Ctx): void {
  const life = live(ctx);
  const E = eco(ctx);
  if (!life || !E) return;
  const ext = extOf(life);
  syncEvents(ctx);
  writeCountry(ctx, life.country);
  if (life.hAge <= ECONOMY_FROM_AGE) {
    ext.mark = life.gold;
    openLines(ctx, life, ext);
    return;
  }
  const place = placeOf(ctx, E, life.country);
  if (!place) return;

  // gold that other systems (story rewards, battles, gifts) put in or took out since the last year
  let fareYear = 0;
  let otherYear = 0;
  if (ext.mark !== undefined) {
    // the fares of the travel system left the purse by its own hand (it keeps the sum in `ext.spent`): they are counted under fares, not as a loss to be reckoned again
    const spent = (life.ext.travel as { spent?: number } | undefined)?.spent ?? 0;
    const fare = Math.max(0, spent - (ext.fareSeen ?? 0));
    ext.fareSeen = spent;
    ext.flows.fare = (ext.flows.fare ?? 0) + fare;
    const other = life.gold - ext.mark + fare;
    fareYear = fare;
    otherYear = other;
    if (other > 0) ext.flows.gain += other;
    else ext.flows.loss -= other;
  } else {
    ext.fareSeen = (life.ext.travel as { spent?: number } | undefined)?.spent ?? 0;
  }

  // the year
  const rng = ctx.rng('economy.life');
  const income = grossIncome(ctx, E, life, ext, place, rng);
  const tax = income * taxRate(E, place.regime, classNumber(life.cls), ext);
  const living = livingCost(ctx, E, life, ext, place);
  const net = income - tax - living;
  const total = net + ext.carry;
  let d = Math.round(total);
  ext.carry = total - d;
  if (life.gold + d < 0) {
    d = -life.gold;
    ext.carry = 0;
  }
  addGold(life, d);
  const job = life.job ? E.jobs.get(life.job) : undefined;
  if (job && OUTLAW_JOBS.has(job.id) && rng.chance(OUTLAW.wanted) && !life.curses.includes('c_wanted'))
    apply(ctx, [{ k: 'grant', kind: 'curse', id: 'c_wanted' }], { sys: 'economy', id: 'outlaw', stream: 'economy.life' });
  ext.flows.years += 1;
  ext.flows.income += income;
  ext.flows.tax += tax;
  ext.flows.living += living;
  ext.last = { income, tax, living, net };
  ext.spread *= POOL_DECAY;
  ext.foodMul = 1 + (ext.foodMul - 1) * POOL_DECAY;

  runDebt(ctx, life, ext, net);
  fallOfHouse(ctx, life, ext);
  poverty(ctx, E, life, ext, living);
  moveClass(ctx, E, life, ext, place);
  openLines(ctx, life, ext);
  yearLine(ctx, E, life, ext, { income, tax, living, net }, fareYear, otherYear);
  ext.mark = life.gold;
}

// ---------- the year in one line (M3 review T1) ----------

/** The kind of income a life has this year, for the line: a wage, the land, work with the hands, trade, an outlaw's takings, or none. */
function incomeKind(E: EcoIndex, life: LifeState): 'wage' | 'land' | 'work' | 'trade' | 'outlaw' | 'none' {
  if (classNumber(life.cls) === 5) return 'land';
  const job = life.job ? E.jobs.get(life.job) : undefined;
  if (!job) return 'none';
  if (OUTLAW_JOBS.has(job.id)) return 'outlaw';
  if (job.id === 'merchant' || job.origin === 'trade') return 'trade';
  if (job.kind === 'common' && WAGE_GROUPS.has(E.groupOf(job)) && !WORK_JOBS.has(job.id)) return 'wage';
  return 'work';
}

/**
 * Writes `economy/year` (level 1) for a year in which the money moved enough to tell (tuning YEAR_NOTE). The numbers are what the text system tells:
 * `income` (before tax) with its `kind` and, for a wage, the `salary`; `share` paid for battles; `gain` and `loss` beside the formula (the trade, gifts,
 * what was bought); `fare` of the road; `tax` and `living`; `net` of the year by the formula; the purse `gold` at the end and the `debt` with its change.
 * `why` lists what made the year worth a line (`debt` `gain` `loss` `share` `ledger`).
 */
function yearLine(ctx: Ctx, E: EcoIndex, life: LifeState, ext: EconomyExt, y: { income: number; tax: number; living: number; net: number }, fare: number, other: number): void {
  const debtChange = Math.round(ext.debt - ext.yr.debt0);
  const rest = other - ext.yr.share;
  const gain = Math.max(0, Math.round(rest));
  const loss = Math.max(0, Math.round(-rest));
  const why: string[] = [];
  if (debtChange !== 0 || (ext.debt > 0 && ext.yr.debt0 === 0)) why.push('debt');
  if (gain >= YEAR_NOTE.gain) why.push('gain');
  if (loss >= YEAR_NOTE.loss) why.push('loss');
  if (ext.yr.share >= YEAR_NOTE.share) why.push('share');
  if (life.hAge % YEAR_NOTE.ledger === 0) why.push('ledger');
  if (why.length) {
    const kind = incomeKind(E, life);
    write(ctx.state, {
      sys: 'economy',
      kind: 'year',
      id: String(life.hAge),
      data: {
        kind,
        job: life.job ?? null,
        class: life.cls,
        income: Math.round(y.income),
        salary: kind === 'wage' ? Math.round(y.income) : 0,
        share: ext.yr.share,
        gain,
        loss,
        fare: Math.round(fare),
        tax: Math.round(y.tax),
        living: Math.round(y.living),
        net: Math.round(y.net),
        gold: life.gold,
        debt: Math.round(ext.debt),
        debtChange,
        why: why.join(','),
      },
      level: 1,
    });
  }
  ext.yr = { share: 0, shares: 0, debt0: ext.debt };
}

// ---------- debt (04 §6, the simple form until P5) ----------

function interestOf(E: EcoIndex, n: number): number {
  for (const r of E.data.income.interestByClass) {
    const m = r.classes.match(/(\d)(?:\D+(\d))?/);
    if (!m) continue;
    const lo = Number(m[1]);
    const hi = m[2] ? Number(m[2]) : lo;
    if (n >= lo && n <= hi) return r.rate;
  }
  return 0.12;
}

function runDebt(ctx: Ctx, life: LifeState, ext: EconomyExt, net: number): void {
  if (ext.debt <= 0) return;
  const E = eco(ctx)!;
  const n = classNumber(life.cls);
  ext.debt *= 1 + interestOf(E, n);
  if (life.gold >= ext.debt) {
    addGold(life, -ext.debt);
    ext.debt = 0;
  } else if (net > 0) {
    const pay = Math.min(ext.debt, Math.floor(net * DEBT.repayShare), life.gold);
    addGold(life, -pay);
    ext.debt -= pay;
  }
  const means = life.gold + ext.last.income;
  if (ext.debt <= 0) {
    ext.debt = 0;
    if (life.curses.includes('c_debt')) apply(ctx, [{ k: 'remove', kind: 'curse', id: 'c_debt' }], { sys: 'economy', id: 'debt' });
    return;
  }
  // a debt over twice the means (the purse and a year's income) takes a class (03 §5), the pledge pays it
  if (ext.debt > DEBT.defaultMul * means) {
    ext.debt = 0;
    if (n > 1) fall(ctx, life, ext, 'debt');
    else ext.bondageEntry = true;
    write(ctx.state, { sys: 'economy', kind: 'default', data: { class: life.cls }, level: 2 });
  }
}

// ---------- poverty (04 §5) ----------

function poverty(ctx: Ctx, E: EcoIndex, life: LifeState, ext: EconomyExt, living: number): void {
  const n = classNumber(life.cls);
  // the lowest class has no purse to run dry; the bondage system handles it
  if (n === 1 || living < 1) {
    ext.tight = 0;
    return;
  }
  if (life.gold >= living) {
    ext.tight = 0;
  } else {
    ext.tight += 1;
    const rng = ctx.rng('economy.poor');
    if (rng.chance(POVERTY.tightChance)) tightYear(ctx, E, life, ext, living, rng);
    // 04 §5: stuck in it for more than three years, 30% — rolled once as the fourth year ends, not every year after
    if (ext.tight === POVERTY.curseAfter + 1 && !life.curses.includes('c_poverty') && rng.chance(POVERTY.curseChance))
      apply(ctx, [{ k: 'grant', kind: 'curse', id: 'c_poverty' }], { sys: 'economy', id: 'poverty', stream: 'economy.poor' });
  }
  // a house with almost nothing left for years goes down (03 §5 "หนี้เกินทรัพย์"; assumption: the same measure as the debt rule)
  if (n >= 4 && life.gold < living / 2) ext.ruin += 1;
  else ext.ruin = 0;
  if (ext.ruin >= CLIMB.ruinYears) {
    ext.ruin = 0;
    fall(ctx, life, ext, 'ruin');
  }
}

type Way = 'help' | 'loan' | 'work' | 'sell' | 'bond';
const WAYS: Way[] = ['help', 'loan', 'work', 'sell', 'bond'];

/** A tight year: the character takes one of the five ways of 04 §5, weighted by its nature. */
function tightYear(ctx: Ctx, E: EcoIndex, life: LifeState, ext: EconomyExt, living: number, rng: ReturnType<Ctx['rng']>): void {
  const has = (t: string) => life.traits.includes(t);
  const w = E.data.income.poverty.map((p) => p.weight);
  if (has('humble') || has('family')) w[0] *= 1.5;
  if (has('optimist')) w[1] *= 1.3;
  if (has('reckless') || has('adventurer')) w[2] *= 1.5;
  if (has('greedy')) w[3] *= 1.3;
  if (has('coward')) w[4] *= 1.5;
  if (!life.items.length) w[3] = 0;
  const way = WAYS[rng.weighted(w)] ?? 'help';
  switch (way) {
    case 'help':
      addGold(life, living * (POVERTY.helpShare[0] + (POVERTY.helpShare[1] - POVERTY.helpShare[0]) * rng.next()));
      break;
    case 'loan':
      addGold(life, living);
      ext.debt += living;
      if (!life.curses.includes('c_debt')) apply(ctx, [{ k: 'grant', kind: 'curse', id: 'c_debt' }], { sys: 'economy', id: 'loan', stream: 'economy.poor' });
      break;
    case 'work':
      addGold(life, rng.int(POVERTY.danger.gold[0], POVERTY.danger.gold[1]));
      if (rng.chance(POVERTY.danger.wound)) apply(ctx, [{ k: 'wound' }], { sys: 'economy', id: 'poverty', stream: 'economy.poor' });
      break;
    case 'sell': {
      life.items.pop();
      addGold(life, POVERTY.sellShare * E.data.income.prices[0].byTier.U! * E.data.priceMods.wIndex[(placeOf(ctx, E, life.country)?.w ?? 3) - 1]);
      break;
    }
    case 'bond':
      ext.bondageEntry = true;
      setClass(ctx, life, 1, 'economy.bond');
      break;
  }
  write(ctx.state, { sys: 'economy', kind: 'tight', id: way, data: { way, gold: life.gold, living: Math.round(living), tight: ext.tight }, level: 1 });
}

// ---------- classes (03 §5) ----------

function fall(ctx: Ctx, life: LifeState, ext: EconomyExt, cause: string): void {
  const n = classNumber(life.cls);
  if (n <= 1) return;
  ext.moves.push(`${n}>${n - 1}@${life.hAge}`);
  setClass(ctx, life, n - 1, `economy.${cause}`);
}

function rise(ctx: Ctx, life: LifeState, ext: EconomyExt, to: number, cause: string): void {
  ext.moves.push(`${classNumber(life.cls)}>${to}@${life.hAge}`);
  setClass(ctx, life, to, `economy.${cause}`);
  if (to === 5 && !life.flags.includes('noble')) life.flags.push('noble');
}

/** DR-01 takes the lands of the families that served the dragon at Skyfall (03 §5). */
function fallOfHouse(ctx: Ctx, life: LifeState, ext: EconomyExt): void {
  if (ext.fell.includes('DR-01') || ctx.state.world.happened['DR-01'] === undefined) return;
  if (life.country !== 'AZ-01' && life.home !== 'AZ-01') return;
  if (classNumber(life.cls) < 5) return;
  ext.fell.push('DR-01');
  fall(ctx, life, ext, 'DR-01');
}

function moveClass(ctx: Ctx, E: EcoIndex, life: LifeState, ext: EconomyExt, place: Place): void {
  // B1 to B3 are the class 1 together and do not rise while bound (10-bondage.md §2; the way out of bondage lifts the class itself)
  if (boundBan(life, 'class')) return;
  const n = classNumber(life.cls);
  const rng = ctx.rng('economy.class');
  // years in the same job (the character system keeps the age the job began)
  const since = life.job ? life.hAge - ((life.ext.character as { jobSince?: number } | undefined)?.jobSince ?? life.hAge) : 0;
  const go = () => rng.chance(CLIMB.chance);
  if (n === 1) {
    if (CLIMB.cooperatives.includes(life.country) && rng.chance(CLIMB.coopChance)) rise(ctx, life, ext, 2, 'co-op');
  } else if (n === 2) {
    if (life.gold >= CLIMB.to3.gold && since >= CLIMB.to3.jobYears && go()) rise(ctx, life, ext, 3, 'gold');
  } else if (n === 3) {
    const fame = (life.ext.character as { fame?: number } | undefined)?.fame ?? 0;
    const trade = life.job !== undefined && E.jobs.get(life.job)?.origin === 'trade';
    if ((life.gold >= CLIMB.to4.gold || (fame >= CLIMB.to4.fame && trade && life.gold >= CLIMB.to4.fameGold)) && go()) rise(ctx, life, ext, 4, 'gold');
  } else if (n === 4) {
    // a merchant republic sells the rank (03 §5); the other ways (appointment, election, marriage) belong to the story
    if (place.regime === 'merchant' && life.gold >= CLIMB.to5.gold && go()) {
      addGold(life, -CLIMB.to5.price);
      rise(ctx, life, ext, 5, 'rank');
    }
  }
}

// ---------- the lines of 24-economy.md ----------

function openOnce(ctx: Ctx, ext: EconomyExt, line: string): void {
  if (ext.opened.includes(line)) return;
  ext.opened.push(line);
  openLine(ctx, line);
}

/** `ec` for every life, `pv` in poor lands, `tr` for traders, `wk` for workers (24-economy.md §2 rule 2). `iv` and `nl` open in the story system by class and gold. */
function openLines(ctx: Ctx, life: LifeState, ext: EconomyExt): void {
  const E = eco(ctx)!;
  if (OPEN_EC) openOnce(ctx, ext, 'ec');
  if (!ext.opened.includes('pv')) {
    const p = placeOf(ctx, E, life.home || life.country);
    if (p && p.w <= PV_MAX_W) openOnce(ctx, ext, 'pv');
  }
  const job = life.job ? E.jobs.get(life.job) : undefined;
  if (job && !ext.opened.includes('tr') && (job.origin === 'trade' || TRADE_JOBS.has(job.id) || life.passed['ec.a3'] === 'a')) openOnce(ctx, ext, 'tr');
  if (!job && life.passed['ec.a3'] === 'a') openOnce(ctx, ext, 'tr');
  if (job && !ext.opened.includes('wk') && WORK_LINE_JOBS.has(job.id)) openOnce(ctx, ext, 'wk');
}
