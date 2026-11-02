// P1: the tier of the weapon and armour a life comes of age with (03-classes.md §3). The table (per class and W) is in economy.json
// `startItems`; the items system turns the tier into an item. Kept here because the odds are the economy's.
import type { Ctx } from '../game';
import type { Rng } from '../rng';
import { eco } from './data';

export type GearTier = 'everyday' | 'C' | 'U' | 'R' | 'E';
const TIERS: GearTier[] = ['everyday', 'C', 'U', 'R', 'E'];

/**
 * Draws the tier of a first weapon for a life of class `cls` (1..5) born where W is `w` (1..5). The armour is one tier lower
 * (03 §3: "เกราะตามชนชั้นเดียวกับอาวุธ ต่ำกว่าอาวุธหนึ่งระดับ"): `armourTier`.
 */
export function startGear(ctx: Ctx, rng: Rng, cls: number, w: number): GearTier {
  const E = eco(ctx);
  const rows = E?.data.startItems ?? [];
  // the table lists the five classes in order, each with W 1 to 5
  const names: string[] = [];
  for (const r of rows) if (!names.includes(r.cls)) names.push(r.cls);
  const row = rows.find((r) => r.cls === names[Math.min(5, Math.max(1, cls)) - 1] && r.w === Math.min(5, Math.max(1, w)));
  if (!row) return 'C';
  const i = rng.weighted(TIERS.map((t) => row.pct[t] ?? 0));
  return TIERS[Math.max(0, i)];
}

/** The armour tier that goes with a weapon tier: one lower, never under `everyday`. */
export function armourTier(weapon: GearTier): GearTier {
  return TIERS[Math.max(0, TIERS.indexOf(weapon) - 1)];
}
