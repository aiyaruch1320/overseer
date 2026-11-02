// The hook for systems that keep something across lives (the goals of the god, src/core/god/goals; docs/systems/god/08-goals.md).
// A system calls `onLifeChange(fn)` once, at import time. The function runs
//  - with `phase: 'end'` when a life has died (after the ending card and the threads are made), and
//  - with `phase: 'begin'` when the next life has been born (after the heir has its inheritance), including the first life (`from` is then undefined).
// `ev.carry` is the one plain-JSON object of the lineage that belongs to the cross-life systems (`state.lineage.x.carry`): they may keep anything in it
// under a key of their own (`carry.goals = {...}`); the lineage saves it with the game and never reads it. Do not keep functions or classes in it.
// The functions themselves are not state: they are registered by the code, so a loaded save works as soon as the module is imported.
import type { Ctx } from '../game';
import type { LifeState } from '../types';
import type { Carried } from './heir';
import { lx, type HeirSpec, type Origin } from './state';

export interface LifeChange {
  phase: 'end' | 'begin';
  /** The life that ended, or the life that began. */
  life: LifeState;
  /** At `begin`: the life that came before (dead), undefined for the first life of the world. */
  from?: LifeState;
  origin: Origin;
  /** The number of the life in the lineage (1 for the first). */
  generation: number;
  /** At `end`: the heir picked for the next life, null when the family has none. At `begin`: the heir that was born (null for a first life or a newcomer). */
  heir: HeirSpec | null;
  /** At `begin`: what was handed to the heir. */
  carried?: Carried;
  /** The object the cross-life systems keep. */
  carry: Record<string, unknown>;
}

export type LifeChangeFn = (ctx: Ctx, ev: LifeChange) => void;

const handlers: LifeChangeFn[] = [];

/** Registers a function for the change of lives; returns a function that takes it out again (for the tests). */
export function onLifeChange(fn: LifeChangeFn): () => void {
  handlers.push(fn);
  return () => {
    const i = handlers.indexOf(fn);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export function emitLifeChange(ctx: Ctx, ev: Omit<LifeChange, 'carry'>): void {
  const carry = lx(ctx.state).carry;
  for (const fn of [...handlers]) fn(ctx, { ...ev, carry });
}
