// Small readers and writers over `state.world`. The world keeps its bookkeeping in two plain number maps:
//   vars    H T D F P SEA FLOAT tension · Z:<dragon> · F.A F.dragon temperature population.pct lifespan · capDrop:<i> · warUntil hpBlockUntil eraStart<n>
//   chains  first:<id> n:<id> out:<id> open:<id> godopen:<id> delay:<id> w:<id> wuntil:<id> succ:<id> hold:<key> flag:<name> fall:<i> cap:<mark> warflag:<country>
// (proposal for types.ts: real fields for successors and the outcome of an event, see the report).
import type { Ctx } from '../game';
import type { EventId } from '../types';

export const NEVER = -1e9;

export const world = (ctx: Ctx) => ctx.state.world;
export const year = (ctx: Ctx) => ctx.state.clock.worldYear;
export const happened = (ctx: Ctx, id: EventId) => ctx.state.world.happened[id] !== undefined;
export const isClosed = (ctx: Ctx, id: EventId) => ctx.state.world.closed.includes(id);
export const chainOf = (ctx: Ctx, key: string, dflt = 0) => ctx.state.world.chains[key] ?? dflt;
export const varOf = (ctx: Ctx, name: string) => ctx.state.world.vars[name];
export const setVar = (ctx: Ctx, name: string, v: number) => {
  ctx.state.world.vars[name] = v;
};
export const addVar = (ctx: Ctx, name: string, delta: number) => {
  ctx.state.world.vars[name] = (ctx.state.world.vars[name] ?? 0) + delta;
};
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const OUTCOMES = ['a', 'b', 'c'] as const;
/** The outcome an event ended with (`a` `b` `c`), undefined when it has none or has not happened. */
export function outcomeOf(ctx: Ctx, id: EventId): 'a' | 'b' | 'c' | undefined {
  const n = ctx.state.world.chains['out:' + id];
  return n ? OUTCOMES[n - 1] : undefined;
}

/** World years since the event happened, Infinity when it has not. */
export const since = (ctx: Ctx, id: EventId) => {
  const y = ctx.state.world.happened[id];
  return y === undefined ? Infinity : ctx.state.clock.worldYear - y;
};

export function countHappened(ctx: Ctx, prefix: string): number {
  let n = 0;
  for (const k in ctx.state.world.happened) if (k.startsWith(prefix)) n++;
  return n;
}
