// What the items system keeps for the whole world, across lives: `god.ext.items` (the state has no `world.ext`; `WorldExt` in types.ts names the key). The legendary weapons are one each in the world (08-legendary.md): who holds each, and the ones that broke. The ancient talismans of
// NPC hands live here too (talisman.ts).
import type { Ctx } from '../game';

export type Holder = 'free' | 'broken' | string;

export interface TalismanHold {
  /** Index of the buyer kind in the data (`buyers`). */
  buyer: number;
  /** 0 holds · 1 omen · 2 possession. */
  stage: number;
  /** Quiet after a reconciliation or an acceptance: no more omens. */
  quiet: boolean;
}

export interface TalismanWorld {
  /** Item id → who holds it, or `ruin` (in the ground, waiting to be found). */
  held: Record<string, TalismanHold | 'ruin'>;
  /** Counts since the world began, for the tests and the chronicle. */
  found: number;
  sold: number;
  buried: number;
  accepted: number;
  /** Years run. */
  years: number;
  /** In omen or possession now. */
  active: number;
  made: boolean;
}

export interface ItemsWorld {
  legend: Record<string, Holder>;
  talisman: TalismanWorld;
}

export function worldOf(ctx: Ctx): ItemsWorld {
  const ext = ctx.state.god.ext;
  let w = ext.items as ItemsWorld | undefined;
  if (!w) {
    w = { legend: {}, talisman: { held: {}, found: 0, sold: 0, buried: 0, accepted: 0, years: 0, active: 0, made: false } };
    ext.items = w;
  }
  return w;
}
