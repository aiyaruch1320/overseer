// The god who destroys too much wakes the other gods (04-miracles.md iron rule 7): the third large destroying miracle in one world opens GD-08 even
// when the faith of the world has not fallen enough, and from the third on each one makes it ×1.5 likelier. A blow on a seal counts two. The movement of
// the god-hunters has its base at the latest ruin. (The sim: `godW` and `godOpen`.)
import type { Ctx } from '../../game';
import { openByGod, weighEvent } from '../../world';
import { godOf } from '../acts/geo';
import { ruinExt } from './state';

/** `n` large destroying miracles happened (1 · a blow on a seal 2) at `country`. */
export function noteBig(ctx: Ctx, n: number, country: string): void {
  const e = ruinExt(ctx.state);
  const lim = godOf(ctx).miracles.limits;
  for (let i = 0; i < n; i++) {
    e.bigDestroy++;
    if (e.bigDestroy >= lim.gd08ThirdBigDestroy) weighEvent(ctx, 'GD-08', { mul: lim.gd08Mul });
  }
  if (e.bigDestroy >= lim.gd08ThirdBigDestroy) e.base = country;
}

/** Each world step: from the third large destruction GD-08 is open for this decade (its other conditions still hold). */
export function gd08Step(ctx: Ctx): void {
  const e = ctx.state.god.ext.ruin as { bigDestroy?: number } | undefined;
  if (e && (e.bigDestroy ?? 0) >= godOf(ctx).miracles.limits.gd08ThirdBigDestroy) openByGod(ctx, 'GD-08');
}
