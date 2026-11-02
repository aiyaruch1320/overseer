// The least payer the acts need (the lead joins it with god/power.ts later: canPay · pay · priceOf there take its place).
// Prices come from data/gen/god.json; the multipliers are the table of 01-power.md §2 ("ตัวคูณราคา"); the pools are
// `state.god.light` (แสงศรัทธา) and `state.god.dread` (ความหวาดกลัว), both 0..200.
import type { Ctx } from '../../game';
import { actsOf, lifeCounters, livingOf } from './state';
import { clamp, godOf } from './geo';
import { POWER_CAP } from './tuning';

export type Line = 'faith' | 'dread';
export interface Cost {
  faith?: number;
  dread?: number;
}

/** Is the god in a window of the story or at an age stop (prices ×0.7)? The story/attention side sets `god.ext.window` while it lasts. */
export const windowOn = (ctx: Ctx): boolean => ctx.state.god.ext.window === true;

/** One price after the multipliers: belief below −30 raises the light ×1.5, belief above 60 raises the dread ×1.2, a window takes ×0.7 off (when the act is one that gets it). Rounded up. */
export function scaled(ctx: Ctx, base: number, line: Line, opts: { window?: boolean } = {}): number {
  const m = godOf(ctx).prices.mods;
  const belief = livingOf(ctx)?.godFaith ?? 0;
  let p = base;
  if (line === 'faith' && belief < m.beliefLow.below) p *= m.beliefLow.faithMul;
  if (line === 'dread' && belief > m.beliefHigh.above) p *= m.beliefHigh.dreadMul;
  if (opts.window && windowOn(ctx)) p *= m.window;
  return Math.ceil(p - 1e-9);
}

/** The whole price of an act for the god now. */
export function priceOf(ctx: Ctx, base: Cost, opts: { window?: boolean } = {}): Cost {
  const out: Cost = {};
  if (base.faith) out.faith = scaled(ctx, base.faith, 'faith', opts);
  if (base.dread) out.dread = scaled(ctx, base.dread, 'dread', opts);
  return out;
}

export function canPay(ctx: Ctx, cost: Cost): boolean {
  return ctx.state.god.light >= (cost.faith ?? 0) && ctx.state.god.dread >= (cost.dread ?? 0);
}

/** The reason a price cannot be paid, or null. */
export function whyNot(ctx: Ctx, cost: Cost): string | null {
  if (ctx.state.god.light < (cost.faith ?? 0)) return `แสงศรัทธาไม่พอ (ต้อง ${cost.faith} มี ${Math.floor(ctx.state.god.light)})`;
  if (ctx.state.god.dread < (cost.dread ?? 0)) return `ความหวาดกลัวไม่พอ (ต้อง ${cost.dread} มี ${Math.floor(ctx.state.god.dread)})`;
  return null;
}

/** Changes the belief of the character in the god (−100..100). Does nothing without a living character. */
export function belief(ctx: Ctx, delta: number): void {
  const l = livingOf(ctx);
  if (l) l.godFaith = clamp(l.godFaith + delta, -100, 100);
}

export function gain(ctx: Ctx, line: Line, n: number): void {
  const g = ctx.state.god;
  if (line === 'faith') g.light = clamp(g.light + n, 0, POWER_CAP);
  else g.dread = clamp(g.dread + n, 0, POWER_CAP);
}

/** Takes the price from the pools. Using the other line within the same life year costs belief (−4 a time, at most −25 a life, 01-power.md §2). */
export function pay(ctx: Ctx, cost: Cost): void {
  const g = ctx.state.god;
  g.light = Math.max(0, g.light - (cost.faith ?? 0));
  g.dread = Math.max(0, g.dread - (cost.dread ?? 0));
  const l = livingOf(ctx);
  if (!l) return;
  const line: Line | undefined = cost.faith ? 'faith' : cost.dread ? 'dread' : undefined;
  if (!line) return;
  const a = actsOf(ctx.state);
  const sw = godOf(ctx).prices.mods.switchLine;
  const c = lifeCounters(ctx);
  const maxLoss = -sw.cap; // the doc writes the cap as −25: the most belief a life can lose this way
  if (a.lastLine && a.lastLine.line !== line && a.lastLine.age === l.hAge && c.switchLoss < maxLoss) {
    const loss = Math.min(-sw.belief, maxLoss - c.switchLoss);
    belief(ctx, -loss);
    c.switchLoss += loss;
  }
  a.lastLine = { line, age: l.hAge };
}
