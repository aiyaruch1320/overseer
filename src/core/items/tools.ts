// Life tools (docs/systems/items/11-item-system.md §6, 17-life-tools.md, 19-prices.md §6): a hoe, a loom, a rod for a character who lives the slow life.
// The yearly yield is the job's base × (1 + the bonus of the tools, at most +50%). Tools wear out by tier (C 15 years, U 25, R 40; E is an heirloom).
import type { Ctx } from '../game';
import { idx } from '../character';
import type { Item, Rarity } from '../data/types-items';
import type { LifeState } from '../types';
import { catalog, RANK } from './data';
import { note } from './log';
import { priceOf } from './price';
import { extOf } from './state';
import { TOOL_BONUS, TOOL_CAP, TOOL_LIFE, TOOL_SLOTS } from './tuning';

/** The bonus a tool gives, read from its effect text (`+6%`), else the bonus of its tier. */
export function bonusOf(i: Item): number {
  const m = /\+(\d+)%/.exec(i.effect ?? '');
  return m ? Number(m[1]) / 100 : TOOL_BONUS[i.tier] ?? 0;
}

/** Aptitudes of the job (a tool of another aptitude does nothing: "จอบไม่ช่วยร้านน้ำชา"). */
function jobApts(ctx: Ctx, life: LifeState): string[] {
  return life.job ? idx(ctx).jobs.get(life.job)?.apts ?? [] : [];
}

/** The tools the character owns that serve the job, the best four. */
export function toolsOf(ctx: Ctx, life: LifeState): Item[] {
  const c = catalog(ctx);
  const apts = jobApts(ctx, life);
  const have = [...new Set(life.items)].map((id) => c.items.get(id)).filter((i): i is Item => !!i && i.cat === 'tool' && !!i.apt && apts.includes(i.apt));
  return have.sort((a, b) => bonusOf(b) - bonusOf(a)).slice(0, TOOL_SLOTS);
}

/** The yield factor the tools add to the job (0..0.5): economy reads it for the yearly income of the slow life. */
export function toolBonus(ctx: Ctx): number {
  const life = ctx.state.life;
  if (!life || life.dead) return 0;
  const sum = toolsOf(ctx, life).reduce((n, i) => n + bonusOf(i), 0);
  return Math.min(TOOL_CAP, sum);
}

/** Years left for a tool: wear counts the years since it came (E never wears). */
export function wornOut(ctx: Ctx, life: LifeState, i: Item): boolean {
  const life1 = TOOL_LIFE[i.tier];
  if (!life1) return false;
  const since = extOf(life).since[i.id];
  return since !== undefined && life.hAge - since >= life1;
}

/** Years the tool pays itself back at the base income of a tier of job (19-prices.md §6). */
export function paybackYears(ctx: Ctx, tier: Rarity, w: number, base?: number): number {
  const pb = catalog(ctx).itemData.prices.toolPayback.find((t) => t.tier === tier);
  if (!pb) return Infinity;
  const idx2 = catalog(ctx).itemData.prices.incomeIndexW[w - 1] ?? 1;
  const price = pb.price * (catalog(ctx).itemData.prices.priceIndexW[w - 1] ?? 1);
  const gain = (base ?? pb.base) * idx2 * pb.bonus;
  return price / gain;
}

/** One life year of wear: tools that outlived their tier are gone (the loss is logged). */
export function wearTools(ctx: Ctx, life: LifeState): void {
  const c = catalog(ctx);
  const ex = extOf(life);
  for (const id of [...new Set(life.items)]) {
    const i = c.items.get(id);
    if (!i || i.cat !== 'tool') continue;
    if (ex.since[id] === undefined) ex.since[id] = life.hAge;
    if (wornOut(ctx, life, i)) {
      life.items = life.items.filter((x) => x !== id);
      delete ex.since[id];
      ex.stats.lost += 1;
      note(ctx, 'wornout', id, { name: i.name, tier: i.tier }, 1);
    }
  }
}

/** The tool the character wants and can pay for: of the job's aptitudes, not owned, the best bonus whose price pays back within the limit. */
export function wantedTool(ctx: Ctx, life: LifeState, maxTier: Rarity, budget: number, w: number, country: string): Item | undefined {
  const c = catalog(ctx);
  const apts = jobApts(ctx, life);
  if (!apts.length) return undefined;
  const have = new Set(life.items);
  let best: Item | undefined;
  let bestGain = 0;
  for (const i of c.itemList) {
    if (i.cat !== 'tool' || !i.apt || !apts.includes(i.apt) || have.has(i.id) || RANK[i.tier] > RANK[maxTier]) continue;
    const price = priceOf(ctx, i.id, { country, w });
    if (price === null || price > budget) continue;
    const bonus = bonusOf(i);
    // a tool that does not beat the four already held adds nothing
    const held = toolsOf(ctx, life);
    if (held.length >= TOOL_SLOTS && bonus <= bonusOf(held[held.length - 1])) continue;
    if (bonus > bestGain) {
      bestGain = bonus;
      best = i;
    }
  }
  return best;
}
