// Phases the god system (and tests) can hook into, like `p.god(ctx)` of scripts/sim/sim-god.mjs: a function registered here runs inside the
// world decade, at that point of it. Registered at import time, never stored in the state.
import type { Ctx } from '../game';

export type WorldPhase = 'afterDrift';
const hooks: Record<WorldPhase, ((ctx: Ctx) => void)[]> = { afterDrift: [] };

/** `afterDrift`: after the variables and the moods moved, before any dragon can fall this decade (where the sim calls `god`). */
export function onWorldPhase(phase: WorldPhase, fn: (ctx: Ctx) => void): void {
  hooks[phase].push(fn);
}

export function runPhase(phase: WorldPhase, ctx: Ctx): void {
  for (const fn of hooks[phase]) fn(ctx);
}

/** Test helper. */
export function clearWorldHooks(): void {
  hooks.afterDrift.length = 0;
}
