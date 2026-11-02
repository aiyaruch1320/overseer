// Prices (docs/systems/items/19-prices.md): price = base of the kind and tier × the piece's own factor × the price index of W × the place factor.
// Weapons use the formula (stat net against the tier's middle, tags), articles carry the price the generator computed at a W3 market.
import type { Ctx } from '../game';
import type { Item, Rarity, Weapon } from '../data/types-items';
import type { CountryId } from '../types';
import { catalog, lookup } from './data';
import { SELL_BLACK, SELL_DIRECT, SELL_SHOP } from './tuning';

const net = (stats: Record<string, number>) => Object.values(stats).reduce((a, b) => a + b, 0);
const hashTags = (tags: readonly string[]) => tags.filter((t) => t.startsWith('#')).length;

/** §2: the piece's factor: (1 + 0.08 × (net stat − the tier's middle)) clamped to 0.75 .. 1.35, then × (1 + 0.05 × tags #, at most 3). */
export function pieceFactor(ctx: Ctx, tier: Rarity, stats: Record<string, number>, tags: readonly string[]): number {
  const f = catalog(ctx).itemData.prices.formula;
  const mid = f.tierMid[tier] ?? 1;
  const a = Math.max(f.clamp[0], Math.min(f.clamp[1], 1 + f.perStat * (net(stats) - mid)));
  return a * (1 + f.perTag * Math.min(hashTags(tags), f.tagCap));
}

/** The price of a weapon at a W3 market, null when it is not sold (everyday articles are picked up, L has no price). */
export function weaponPrice(ctx: Ctx, w: Weapon): number | null {
  const base = catalog(ctx).itemData.prices.weaponBase[w.rarity];
  if (base === undefined || base === null) return null;
  return Math.round(base * pieceFactor(ctx, w.rarity, w.stats, w.tags));
}

export interface Where {
  country?: CountryId;
  /** Wealth class of the country, 1 to 5 (the price index is read from it). */
  w?: number;
  /** Stolen goods and the like: the black market. */
  black?: boolean;
}

/** The place factor of §3: made here ×0.85, the same continent ×1.0, another continent ×1.2. */
function placeFactor(origin: string, where: Where): number {
  const c = where.country;
  if (!c) return 1;
  if (origin.includes(c)) return 0.85;
  const codes = origin.match(/\b[A-Z]{2}-\d{2}\b/g);
  if (!codes) return 1;
  return codes.some((x) => x.startsWith(c.slice(0, 2))) ? 1 : 1.2;
}

/** The price to buy `id` (a weapon, an article or a material), null when it is not sold. */
export function priceOf(ctx: Ctx, id: string, where: Where = {}): number | null {
  const e = lookup(ctx, id);
  if (!e) return null;
  const idx = catalog(ctx).itemData.prices.priceIndexW[Math.max(1, Math.min(5, where.w ?? 3)) - 1] ?? 1;
  let base: number | null;
  let origin = '';
  if (e.kind === 'weapon') {
    base = weaponPrice(ctx, e.w);
    origin = e.w.origin;
  } else if (e.kind === 'item') {
    base = (e.i as Item).price;
    origin = e.i.where;
  } else {
    base = catalog(ctx).materialData.bio.find((b) => b.id === id)?.price ?? null;
  }
  if (base === null) return null;
  const p = base * idx * placeFactor(origin, where) * (where.black ? 1.5 : 1);
  return Math.max(1, Math.round(p));
}

/** What a buyer pays for a piece (§4): a shop 40%, a user 70% (the middle of 60 to 80), the black market 30%. Key items and L pieces have no market. */
export function sellPrice(ctx: Ctx, id: string, how: 'shop' | 'direct' | 'black' = 'shop', where: Where = {}): number {
  const p = priceOf(ctx, id, where);
  if (p === null) return 0;
  const k = how === 'shop' ? SELL_SHOP : how === 'direct' ? SELL_DIRECT : SELL_BLACK;
  return Math.floor(p * k);
}
