// The numbers of the economy in the effect grammar (docs/guide/code-plan.md §5.2): the words the storylines use for money that is not
// `gold` (the character system owns `gold`, `fame`, `class`). The effects `statPct` `statMul` `range` `pct` that change them are the character
// system's too: they read and write through these handlers.
// Numbers: รายได้ ค่าแรง (the income of a year) · ทุน (capital) · ส่วนต่าง (the spread of a trade, percent) · ผลกำไร ขาย ได้กำไร ได้ ส่วนต่างสูงมาก
// (factors of trade and investment, 1 = as usual) · ผลตอบแทน (percent of a year's return) · สินทรัพย์เสี่ยง (assets at risk) ·
// ของหมวดอาหารราคา (the price of food against the usual) · country.W country.G country.M (the land the life is in now).
import type { Ctx } from '../game';
import { onStat, type StatHandler } from '../rules';
import { eco } from './data';
import { expectedYear } from './year';
import { extOf } from './state';
import { BASE_SPREAD } from './tuning';
import { foodShock, wOf } from './world';

let installed = false;
/** Names another system had taken when this one registered: the test checks the list is empty. */
export const SKIPPED: string[] = [];

const life = (ctx: Ctx) => (ctx.state.life && !ctx.state.life.dead ? ctx.state.life : null);

function register(name: string, h: StatHandler): void {
  try {
    onStat(name, h);
  } catch {
    SKIPPED.push(name);
  }
}

/** A number stored in `life.ext.economy.x`, with the value it has when nothing changed it. */
function stored(key: string, dflt: number): StatHandler {
  return {
    read: (ctx) => {
      const l = life(ctx);
      return l ? extOf(l).x[key] ?? dflt : 0;
    },
    add: (ctx, _n, delta) => {
      const l = life(ctx);
      if (!l) return;
      const x = extOf(l).x;
      x[key] = (x[key] ?? dflt) + delta;
    },
  };
}

const income: StatHandler = {
  read: (ctx) => {
    const l = life(ctx);
    const y = l ? expectedYear(ctx, l) : null;
    return y ? Math.round(y.income * 100) / 100 : 0;
  },
  add: (ctx, _n, delta) => {
    const l = life(ctx);
    const y = l ? expectedYear(ctx, l) : null;
    if (!l || !y) return;
    const e = extOf(l);
    // income = what the job pays × the factor + the flat sum: a change moves the factor, or the sum when the job pays nothing
    const pays = (y.income - e.incFlat) / e.inc;
    if (pays > 0.001) e.inc = Math.max(0.1, e.inc + delta / pays);
    else e.incFlat += delta;
  },
};

/** Registers the rules. Called once when the module is imported; a test that resets the registry can call it again. */
export function registerEconomyRules(force = false): void {
  if (installed && !force) return;
  installed = true;

  for (const name of ['รายได้', 'ค่าแรง', 'income', 'wage']) register(name, income);

  const capital: StatHandler = {
    read: (ctx) => life(ctx)?.gold ?? 0,
    add: (ctx, _n, delta) => {
      const l = life(ctx);
      if (l) l.gold = Math.max(0, l.gold + Math.round(delta));
    },
  };
  for (const name of ['capital', 'ทุน']) register(name, capital);

  const spread: StatHandler = {
    read: (ctx) => {
      const l = life(ctx);
      return BASE_SPREAD + (l ? extOf(l).spread : 0);
    },
    add: (ctx, _n, delta) => {
      const l = life(ctx);
      if (l) extOf(l).spread += delta;
    },
  };
  for (const name of ['ส่วนต่าง', 'spread']) register(name, spread);

  // factors of trade and investment: 1 = as usual, so `ผลกำไร +10%` makes 1.1, `ขาย ×1.4` makes 1.4 and `ราคา −5%` (a regular customer's discount) 0.95 (P3 and P5 read them)
  for (const name of ['ส่วนต่างสูงมาก', 'ผลกำไร', 'ขาย', 'ได้กำไร', 'ได้', 'ราคา']) register(name, stored(name, 1));
  // `ผลตอบแทน 8 ถึง 10%`: the return of a year, percent; `สินทรัพย์เสี่ยง`: what is held in risky things; `mine`: the capital held in a mine
  for (const name of ['ผลตอบแทน', 'สินทรัพย์เสี่ยง', 'mine']) register(name, stored(name, 0));

  // `เงินเดือน ×0 หนึ่งเดือน` (a strike): a month's pay; a change is paid or lost once, in gold
  register('เงินเดือน', {
    read: (ctx) => {
      const l = life(ctx);
      const y = l ? expectedYear(ctx, l) : null;
      return y ? Math.round((y.income / 12) * 100) / 100 : 0;
    },
    add: (ctx, _n, delta) => {
      const l = life(ctx);
      if (l) l.gold = Math.max(0, l.gold + Math.round(delta));
    },
  });

  register('ของหมวดอาหารราคา', {
    read: (ctx) => {
      const l = life(ctx);
      return l ? foodShock(ctx, l.country) * extOf(l).foodMul : 1;
    },
    add: (ctx, _n, delta) => {
      const l = life(ctx);
      if (!l) return;
      const e = extOf(l);
      e.foodMul = Math.max(0.1, e.foodMul + delta / foodShock(ctx, l.country));
    },
  });

  // `country.W >= 3` in a job's requirement: W of the country the life lives in now, events included
  register('country.W', { read: (ctx) => (life(ctx) ? wOf(ctx, life(ctx)!.country) : 0) });
  register('country.G', { read: (ctx) => (life(ctx) ? eco(ctx)?.countries.get(life(ctx)!.country)?.g ?? 0 : 0) });
  register('country.M', { read: (ctx) => (life(ctx) ? ({ little: 1, mixed: 2, full: 3 } as const)[eco(ctx)?.countries.get(life(ctx)!.country)?.m ?? 'mixed'] : 0) });
}
