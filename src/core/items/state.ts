// What the items system keeps on the life: `life.ext.items` (plain JSON). The things themselves are `life.items` (the character system gives and
// takes them through the `grant` and `remove` effects); this keeps which of them the character holds in hand and wears, and the wear on them.
import type { LifeState } from '../types';

/** What a smith's work adds to or takes from a weapon (10-forging.md §8). */
export interface WeaponMod {
  name?: string;
  by?: string;
  year?: number;
  unbreakable?: boolean;
  engrave?: boolean;
  parry?: boolean;
  stat?: Record<string, number>;
  stance?: number;
  /** A flaw: an ability lost (`ability`) or a stat down (`stat`). */
  flaw?: string;
  tags?: string[];
}

export interface ForgeState {
  step: 'road' | 'trial' | 'order' | 'wait' | 'save';
  /** The weapon wanted, the smith (NPC id or forge key), the place, the tier ordered. */
  weapon: string;
  smith: string;
  smithName: string;
  place: string;
  tier: string;
  /** Who: village, city, nation, named. */
  kind: 'village' | 'city' | 'nation' | 'named';
  cause: string;
  /** Beat index the step ends at. */
  until: number;
  price: number;
  paid: number;
  trial?: string;
  trust: number;
  material?: string;
  /** Years the beat count started, for the save-up step. */
  since: number;
  /** Delays met. */
  slow: number;
  /** The order path taken. */
  how?: string;
}

export interface ItemsExt {
  /** Count of each id in `life.items` the last time it was looked at, to tell what came and what went. */
  seen: Record<string, number>;
  wield?: string;
  armor?: string;
  acc: string[];
  charm?: string;
  /** Battles fought with each weapon since it was last repaired. */
  uses: Record<string, number>;
  dull: string[];
  /** Fights lost wearing each armour. */
  losses: Record<string, number>;
  /** Weapon → enemy ids it has killed (README §3 "สลักชื่อ"). */
  engraved: Record<string, string[]>;
  mods: Record<string, WeaponMod>;
  /** Charms the character refused (a skeptic with a charm of tier E or more, half the time). */
  refused: string[];
  /** Charms the character took after the same thought (decided once). */
  trusted: string[];
  /** Tool id → hAge it came. */
  since: Record<string, number>;
  /** Jobs whose first weapon was given. */
  given: string[];
  forge?: ForgeState;
  forgeLast: number;
  stats: { bought: number; spent: number; sold: number; forged: number; repaired: number; lost: number };
  /** A weapon of the legend list the character carried when it died, for the heir. */
  heirloom?: string;
}

export function fresh(): ItemsExt {
  return {
    seen: {}, acc: [], uses: {}, dull: [], losses: {}, engraved: {}, mods: {}, refused: [], trusted: [], since: {}, given: [], forgeLast: -99,
    stats: { bought: 0, spent: 0, sold: 0, forged: 0, repaired: 0, lost: 0 },
  };
}

export function extOf(life: LifeState): ItemsExt {
  let e = life.ext.items as ItemsExt | undefined;
  if (!e) {
    e = fresh();
    life.ext.items = e;
  }
  return e;
}

export function addOnce<T>(list: T[], x: T): boolean {
  if (list.includes(x)) return false;
  list.push(x);
  return true;
}

export const count = (list: readonly string[], id: string): number => list.reduce((n, x) => n + (x === id ? 1 : 0), 0);
