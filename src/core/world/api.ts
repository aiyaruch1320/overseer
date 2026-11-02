// What the god system (and the story, which weighs events) may do to the world. Everything works on `state.world`, so a save carries it.
//   sim-god `godW(id, year)`      → holdEvent / weighEvent     (the weight of an event, for a while)
//   sim-god `godOpen(id, year)`   → openByGod                  (the god's deed stands in for a state condition, this decade)
//   sim-god `mood[i] -= 20`       → addMood
//   sim-god `capDrop[i] += 5`     → strikeCap
//   sim-god `fall(i)`             → fallDragon
import type { Ctx } from '../game';
import type { EventId } from '../types';
import { world, year } from './access';
import { fall, moodCap } from './core';
import { weighEvent, weightOf } from './events';

export { onWorldPhase, clearWorldHooks } from './hooks';
export { weighEvent, weightOf, moodCap };

/** Sets the multiplier of an event's chance until `untilYear` (omit for good). 0.2 to 3 is the range of the docs (world-events.md §0.3). */
export function holdEvent(ctx: Ctx, id: EventId, mul: number, untilYear?: number): void {
  const c = world(ctx).chains;
  c['w:' + id] = mul;
  if (untilYear === undefined) delete c['wuntil:' + id];
  else c['wuntil:' + id] = untilYear;
}

/** The god's deed opens an event whose state condition fails, for this decade only (the event still needs its other conditions). */
export function openByGod(ctx: Ctx, id: EventId): void {
  world(ctx).chains['godopen:' + id] = year(ctx);
}

export const moodOf = (ctx: Ctx, dragon: number): number => world(ctx).dragons[dragon].mood;

/** Moves the mood of one dragon (never above the cap). */
export function addMood(ctx: Ctx, dragon: number, delta: number): void {
  const d = world(ctx).dragons[dragon];
  if (d?.alive) d.mood = Math.min(moodCap(ctx), d.mood + delta);
}

/** Takes `loss` off the highest mood a dragon can reach, for good (a strike on its home). */
export function strikeCap(ctx: Ctx, dragon: number, loss: number): void {
  const v = world(ctx).vars;
  v['capDrop:' + dragon] = (v['capDrop:' + dragon] ?? 0) + loss;
}

/** A dragon falls with no event of its own (the god's hand). Does nothing to a dragon that already fell. */
export function fallDragon(ctx: Ctx, dragon: number): void {
  if (world(ctx).dragons[dragon]?.alive) fall(ctx, dragon, null);
}
