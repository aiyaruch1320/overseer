// Death of the main character (docs/lore/world/world-time.md §3, god/06-implementation.md §4).
// Natural death comes at the death age (hAge 75 unless a gift moves it); untimely death is an assumption of 0.4% a life year from 15;
// the `death` effect of a story or an event kills at once. The loop (game/) writes the `death` log entry and runs the death hooks.
import type { Ctx } from '../game';
import type { LifeState } from '../types';
import { extOf } from './data';
import { UNTIMELY } from './tuning';

/** Marks the character dead. Returns false when it already is. */
export function die(ctx: Ctx, cause: string, node?: string): boolean {
  const life = ctx.state.life;
  if (!life || life.dead) return false;
  life.dead = { year: ctx.state.clock.worldYear, hAge: life.hAge, cause, ...(node ? { node } : {}) };
  return true;
}

/** The yearly check, called once per life year after the age went up. Returns the cause when the character died. */
export function yearlyDeath(ctx: Ctx, life: LifeState): string | null {
  if (life.dead) return null;
  if (life.hAge >= extOf(life).deathAge) {
    die(ctx, 'old');
    return 'old';
  }
  if (life.hAge >= UNTIMELY.fromAge) {
    const rng = ctx.rng('life.death');
    if (rng.chance(UNTIMELY.perYear)) {
      const cause = UNTIMELY.causes[rng.weighted(UNTIMELY.causes.map((c) => c.w))].id;
      die(ctx, cause);
      return cause;
    }
  }
  return null;
}
