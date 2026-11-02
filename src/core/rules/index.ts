// Evaluates conditions and applies effects of the shared grammar (src/core/types.ts, code-plan §5.2).
// The combinators live here; every system registers the kinds of its own domain from its folder
// (character: has race age class gender cmp grant stat · world: event era var place faith stance · npc: npc · story: node converge jump ...).
// A kind nobody registered is reported once in the log and treated as false (conditions) or skipped (effects),
// so a missing handler shows up in `npm run life` instead of failing silently.
import { write } from '../log';
import type { Ctx } from '../game';
import type { Condition, Effect } from '../types';

export type CondFn<K extends Condition['k']> = (ctx: Ctx, c: Extract<Condition, { k: K }>) => boolean;
export type EffectFn<K extends Effect['k']> = (ctx: Ctx, e: Extract<Effect, { k: K }>, src: EffectSource) => void;

/** Where an effect comes from, for the log and for systems that react to it (a node choice, an event, a god act). */
export interface EffectSource {
  sys: string;
  id?: string;
  /** Name of the seed stream that rolls chances and picks for this source; defaults to `life.<sys>`. */
  stream?: string;
}

const conds = new Map<string, (ctx: Ctx, c: Condition) => boolean>();
const effects = new Map<string, (ctx: Ctx, e: Effect, src: EffectSource) => void>();
const missing = new Set<string>();

export function onCond<K extends Condition['k']>(kind: K, fn: CondFn<K>): void {
  if (conds.has(kind)) throw new Error(`condition kind ${kind} registered twice`);
  conds.set(kind, fn as (ctx: Ctx, c: Condition) => boolean);
}

export function onEffect<K extends Effect['k']>(kind: K, fn: EffectFn<K>): void {
  if (effects.has(kind)) throw new Error(`effect kind ${kind} registered twice`);
  effects.set(kind, fn as (ctx: Ctx, e: Effect, src: EffectSource) => void);
}

function report(ctx: Ctx, what: 'cond' | 'effect', kind: string) {
  const key = `${what}:${kind}`;
  if (missing.has(key)) return;
  missing.add(key);
  write(ctx.state, { sys: 'rules', kind: 'unhandled', id: key, level: 0 });
}

export function test(ctx: Ctx, c: Condition | undefined): boolean {
  if (!c) return true;
  switch (c.k) {
    case 'and':
      return c.of.every((x) => test(ctx, x));
    case 'or':
      return c.of.some((x) => test(ctx, x));
    case 'not':
      return !test(ctx, c.of);
    case 'text':
      // prose the docs could not express; the generators report every one, so treat it as not met
      return false;
  }
  const fn = conds.get(c.k);
  if (!fn) {
    report(ctx, 'cond', c.k);
    return false;
  }
  return fn(ctx, c);
}

export function apply(ctx: Ctx, list: readonly Effect[] | undefined, src: EffectSource): void {
  if (!list) return;
  for (const e of list) applyOne(ctx, e, src);
}

function applyOne(ctx: Ctx, e: Effect, src: EffectSource): void {
  const rng = () => ctx.rng(src.stream ?? `life.${src.sys}`);
  switch (e.k) {
    case 'label':
      return;
    case 'if':
      if (test(ctx, e.cond)) apply(ctx, e.then, src);
      return;
    case 'only':
      if (test(ctx, e.cond)) apply(ctx, e.then, src);
      return;
    case 'chance':
      if (rng().chance(e.p)) apply(ctx, e.then, src);
      return;
    case 'pick': {
      const i = rng().weighted(e.of.map((b) => b.weight ?? 1));
      if (i >= 0) apply(ctx, e.of[i].effects, src);
      return;
    }
  }
  // a chance on a grant is rolled here so every handler sees a decided effect
  if (e.k === 'grant' && e.chance !== undefined && !rng().chance(e.chance)) return;
  const fn = effects.get(e.k);
  if (!fn) {
    report(ctx, 'effect', e.k);
    return;
  }
  fn(ctx, e, src);
}

/** Kinds that have a handler, for tests that check coverage against the data. */
export function registered(): { conds: string[]; effects: string[] } {
  return { conds: [...conds.keys(), 'and', 'or', 'not', 'text'].sort(), effects: [...effects.keys(), 'label', 'if', 'only', 'chance', 'pick'].sort() };
}

/** Test helper: forget every handler (systems register again when their module is imported fresh). */
export function resetRules(): void {
  conds.clear();
  effects.clear();
  missing.clear();
}
