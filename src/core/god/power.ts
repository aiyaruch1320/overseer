// The god's two powers, their income, their prices and the ways they are spent (01-power.md §1 to §4, G0).
// `light` = แสงศรัทธา (faith) from love, `dread` = ความหวาดกลัว from fear; both are held up to 200 and carry over.
// The files of acts/ (whisper, prayer, miracle, decree) use `canPay` `pay` `earn` `priceOf` from here; the prices of one intervention
// are read from data/gen/god.json `prices`, the multipliers of §2 are applied here and nowhere else.
import { write } from '../log';
import type { Ctx } from '../game';
import { holds } from '../character';
import { addBelief } from './belief';
import { bump, count, godData, gx, inWindow, lifeOf, touch } from './state';
import { FREE_ACT_ITEMS, IMMUNE_ITEMS, POWER_CAP, tierIndex } from './tuning';

export interface Cost {
  faith?: number;
  dread?: number;
}

/** What one intervention costs now, with the base and the multiplier so a screen can say why. */
export interface Price extends Cost {
  base: number;
  mul: number;
  notes: string[];
  /** The act is free this time (a weapon of the sage); `pay` uses up the free act of the year. */
  free?: boolean;
}

export type PriceAction = 'bless' | 'curse' | 'skill' | 'item' | 'holyWeapon' | 'cursedWeapon' | 'reroll' | 'dream' | 'whisper' | 'revive' | 'fate' | 'prayerGrant';

export interface PriceOpts {
  /** Rarity of the thing (`C` `U` `R` `E` `L`) for the price tables by tier. */
  tier?: string;
  /** `reroll`: rerolls already made this life year (0 for the first). `dream`: dreams already sent this life. */
  n?: number;
  /** `reroll`: one slot is locked (+5). */
  lock?: boolean;
  /** `dream`: a dream was already sent this life year (14 instead of 10). */
  second?: boolean;
  /** `whisper`: the hint, which decides the cheap or the dear price. */
  hint?: string;
  /** `revive`: which power pays. `fate`: the kind of fate. */
  line?: 'faith' | 'dread';
  kind?: 'good' | 'bad';
  /** `prayerGrant`: the price of the prayer kind (6 to 25). */
  cost?: number;
  /** The act falls in a god window or an age stop; defaults to the window of the current life year. */
  window?: boolean;
}

// ---------- reading ----------

export const lightOf = (ctx: Ctx): number => ctx.state.god.light;
export const dreadOf = (ctx: Ctx): number => ctx.state.god.dread;

/** Does the living character carry a weapon of the sage (free dream or whisper once a year)? */
export function holdsFreeAct(ctx: Ctx): boolean {
  const life = lifeOf(ctx);
  return !!life && FREE_ACT_ITEMS.some((id) => life.items.includes(id));
}

/** Does the living character carry a weapon that no intervention touches (`wj_godslayer_e` `wk_az_3`)? */
export function isImmune(ctx: Ctx): boolean {
  const life = lifeOf(ctx);
  return !!life && IMMUNE_ITEMS.some((id) => life.items.includes(id) || holds(ctx, life, 'weapon', id));
}

// ---------- prices ----------

const round = (x: number) => (x <= 0 ? 0 : Math.max(1, Math.round(x)));

function tableOf(ctx: Ctx, key: string, tier: string): { v: number; pay: 'faith' | 'dread' } | null {
  const row = godData(ctx).prices.byTier.find((r) => r.key === key);
  const v = row?.byTier[tier as 'C'];
  return row && typeof v === 'number' ? { v, pay: row.pay } : null;
}

/**
 * The price of an intervention in the state of now (01-power.md §2): the table price, then the multipliers
 * (belief below −30 makes light cost ×1.5, belief above 60 makes dread cost ×1.2, a window or age stop ×0.7 on gifts, dreams and whispers).
 * Returns null for a thing that is not sold (a legend item, a skill of level L).
 */
export function priceOf(ctx: Ctx, action: PriceAction, opts: PriceOpts = {}): Price | null {
  const g = godData(ctx);
  const life = lifeOf(ctx);
  const belief = life?.godFaith ?? 0;
  const notes: string[] = [];
  let line: 'faith' | 'dread' = 'faith';
  let base = 0;
  let windowed = false;
  switch (action) {
    case 'bless':
    case 'curse':
    case 'skill':
    case 'item':
    case 'holyWeapon':
    case 'cursedWeapon': {
      const t = tableOf(ctx, action, opts.tier ?? 'C');
      if (!t) return null;
      base = t.v;
      line = t.pay;
      windowed = true;
      break;
    }
    case 'reroll': {
      const n = opts.n ?? 0;
      if (n >= g.prices.reroll.length) return null;
      base = g.prices.reroll[n] + (opts.lock ? g.chest.rerollExtraLock : 0);
      break;
    }
    case 'dream': {
      const d = g.prices.dream;
      base = (opts.second ? d.second : d.first) + g.rule.dreamStep * (opts.n ?? 0);
      windowed = true;
      break;
    }
    case 'whisper': {
      const w = g.prices.whisper;
      base = w.dearHints.includes(opts.hint ?? '') ? w.dear : w.cheap;
      windowed = true;
      break;
    }
    case 'revive':
      line = opts.line ?? 'faith';
      base = g.prices.revive[line];
      break;
    case 'fate':
      line = opts.kind === 'bad' ? 'dread' : 'faith';
      base = opts.kind === 'bad' ? g.prices.fate.bad : g.prices.fate.good;
      break;
    case 'prayerGrant':
      base = opts.cost ?? g.prices.prayerGrant[0];
      break;
  }
  let mul = 1;
  const m = g.prices.mods;
  if (line === 'faith' && belief < m.beliefLow.below) {
    mul *= m.beliefLow.faithMul;
    notes.push('belief-low');
  }
  if (line === 'dread' && belief > m.beliefHigh.above) {
    mul *= m.beliefHigh.dreadMul;
    notes.push('belief-high');
  }
  if (windowed && (opts.window ?? inWindow(ctx))) {
    mul *= m.window;
    notes.push('window');
  }
  const price: Price = { base, mul, notes };
  const free = (action === 'dream' || action === 'whisper') && holdsFreeAct(ctx) && count(ctx, 'y.free') === 0;
  if (free) {
    price[line] = 0;
    price.free = true;
    notes.push('free');
  } else price[line] = round(base * mul);
  return price;
}

// ---------- spending ----------

export function canPay(ctx: Ctx, cost: Cost): boolean {
  return (cost.faith ?? 0) <= ctx.state.god.light + 1e-9 && (cost.dread ?? 0) <= ctx.state.god.dread + 1e-9;
}

/**
 * Takes the cost from the powers. Using the other power line inside the same life year costs the character belief
 * (−4 per switch, at most −25 in a life, 01-power.md §2 "สลับสายพลัง"). Throws when the god cannot pay: callers check `canPay` first.
 */
export function pay(ctx: Ctx, cost: Cost, why: string): void {
  if (!canPay(ctx, cost)) throw new Error(`god cannot pay ${JSON.stringify(cost)} for ${why}`);
  const god = ctx.state.god;
  const f = cost.faith ?? 0;
  const d = cost.dread ?? 0;
  if ((cost as Price).free) bump(ctx, 'y.free');
  if (f <= 0 && d <= 0) return;
  god.light -= f;
  god.dread -= d;
  bump(ctx, 'l.spent.faith', f);
  bump(ctx, 'l.spent.dread', d);
  bump(ctx, 'spent.faith', f);
  bump(ctx, 'spent.dread', d);
  touch(ctx);
  const life = lifeOf(ctx);
  if (life && (f > 0) !== (d > 0)) {
    const line = f > 0 ? 'faith' : 'dread';
    const e = gx(ctx);
    const sw = godData(ctx).prices.mods.switchLine;
    if (e.lastLine && e.lastLine.line !== line && e.lastLine.age === life.hAge) {
      const used = count(ctx, 'l.switch');
      const take = Math.min(-sw.belief, -sw.cap - used);
      if (take > 0) {
        bump(ctx, 'l.switch', take);
        addBelief(ctx, -take, 'switch-line');
      }
    }
    e.lastLine = { line, age: life.hAge };
  }
  write(ctx.state, { sys: 'god', kind: 'pay', id: why, data: { faith: f, dread: d, light: Math.round(god.light * 100) / 100, fear: Math.round(god.dread * 100) / 100 }, level: 0 });
}

/** Adds to the powers (up to the cap of 200) and writes the log. Returns what was really added. */
export function earn(ctx: Ctx, gain: Cost, why: string): Cost {
  const god = ctx.state.god;
  const f = Math.min(gain.faith ?? 0, POWER_CAP - god.light);
  const d = Math.min(gain.dread ?? 0, POWER_CAP - god.dread);
  god.light += Math.max(0, f);
  god.dread += Math.max(0, d);
  bump(ctx, 'l.gain.faith', Math.max(0, f));
  bump(ctx, 'l.gain.dread', Math.max(0, d));
  if (f > 0 || d > 0) write(ctx.state, { sys: 'god', kind: 'gain', id: why, data: { faith: Math.round(f * 100) / 100, dread: Math.round(d * 100) / 100 }, level: 0 });
  return { faith: Math.max(0, f), dread: Math.max(0, d) };
}

// ---------- income ----------

export interface Income {
  faith: number;
  dread: number;
  parts: { base: number; channel: number; belief: number; prophet: number; mul: number };
}

const happenedSince = (ctx: Ctx, id: string, year: number): boolean => {
  const y = ctx.state.world.happened[id];
  return y !== undefined && y >= year;
};

/** The income of one life year (01-power.md §1): the base, the faith of the country, the belief of the character, a prophet. */
export function incomeOf(ctx: Ctx): Income {
  const g = godData(ctx).income;
  const life = lifeOf(ctx);
  const belief = life?.godFaith ?? 0;
  const w = ctx.state.world;
  const channel = life ? w.countryFaith[life.country] ?? w.countryFaith[life.home] ?? w.vars.F ?? 0 : 0;
  const prophet = life && (life.job === 'prophet' || life.secretJob === 'prophet') ? g.prophet : 0;
  const parts = {
    base: g.base.faith,
    channel: Math.max(0, Math.min(100, channel)) / g.channelDiv,
    belief: Math.max(0, belief) / g.beliefDiv.faith,
    prophet,
    mul: 1,
  };
  // GD-04 / GD-05 (01-power.md §1 last two rows) count for the life they happened in
  if (life && happenedSince(ctx, 'GD-04', life.birthYear)) parts.mul *= g.gd04;
  if (life && happenedSince(ctx, 'GD-05', life.birthYear) && gx(ctx).answered < g.gd05Until) parts.mul *= g.gd05;
  const faith = (parts.base + parts.channel + parts.belief + parts.prophet) * parts.mul;
  const dread = g.base.dread + Math.max(0, -belief) / g.beliefDiv.dread;
  return { faith, dread, parts };
}

/** Called by the prayer files when a prayer is answered with a grant: counts toward the end of GD-05. */
export function noteAnswered(ctx: Ctx): void {
  gx(ctx).answered += 1;
  touch(ctx);
}

/** Called when the god punishes the character (a curse picked, a petitioner punished): dreams are heard less for five years. */
export function notePunished(ctx: Ctx): void {
  const life = lifeOf(ctx);
  if (life) gx(ctx).punishedAge = life.hAge;
}

/** The start power, given once when the world is made (01-power.md §1 "ค่าเริ่มต้น"). */
export function startPower(ctx: Ctx): void {
  const e = gx(ctx);
  if (e.started) return;
  e.started = true;
  const s = godData(ctx).start;
  ctx.state.god.light = s.faith;
  ctx.state.god.dread = s.dread;
}

/** Tier of a price row as an index, for callers that sort offers by it. */
export const tierRank = tierIndex;
