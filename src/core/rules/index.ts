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

/**
 * Numbers that conditions compare (`cmp`, `count`) and effects change (`stat`): `gold` `fame` `dfc` `axis.curious`
 * `lineage.open` `travel.continents` ... A system registers a name, or a prefix ending in `.` (`axis.`), with a reader
 * and, when the number can change, a writer. Names may be Thai words the docs use (`ทอง`); register those as aliases.
 */
export interface StatHandler {
  read(ctx: Ctx, name: string): number;
  add?(ctx: Ctx, name: string, delta: number): void;
}
const stats = new Map<string, StatHandler>();

export function onStat(name: string, h: StatHandler): void {
  if (stats.has(name)) throw new Error(`stat ${name} registered twice`);
  stats.set(name, h);
}

function statOf(name: string): StatHandler | undefined {
  const exact = stats.get(name);
  if (exact) return exact;
  for (let i = name.lastIndexOf('.'); i > 0; i = name.lastIndexOf('.', i - 1)) {
    const h = stats.get(name.slice(0, i + 1));
    if (h) return h;
  }
  return undefined;
}

export function readStat(ctx: Ctx, name: string): number | undefined {
  const h = statOf(name);
  if (!h) {
    report(ctx, 'cond', `stat:${name}`);
    return undefined;
  }
  return h.read(ctx, name);
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

export interface TestOpts {
  /**
   * What a `text` leaf (prose the grammar could not read, listed in scripts/codegen/accepted/) counts as.
   * false (default): a choice or node gated by prose stays closed. true: the prose does not gate, which is how the
   * document-level simulators treat world events whose gate is still prose (they fire at their base rate).
   */
  unknown?: boolean;
}

export function test(ctx: Ctx, c: Condition | undefined, opts: TestOpts = {}): boolean {
  if (!c) return true;
  switch (c.k) {
    case 'and':
      return c.of.every((x) => test(ctx, x, opts));
    case 'or':
      return c.of.some((x) => test(ctx, x, opts));
    case 'not':
      // prose under a negation stays unknown: "not unknown" must not flip into a gate
      return c.of.k === 'text' ? (opts.unknown ?? false) : !test(ctx, c.of, opts);
    case 'text':
      return opts.unknown ?? false;
    case 'cmp': {
      const v = readStat(ctx, c.stat);
      if (v === undefined) return false;
      // "ไว้ใจ ≥ 3 จาก 10 เผ่า": the stat handler of a counted stat returns how many pass; compare that count
      if (c.count !== undefined) return v >= c.count;
      switch (c.op) {
        case '>=': return v >= c.value;
        case '>': return v > c.value;
        case '<=': return v <= c.value;
        case '<': return v < c.value;
        case '==': return v === c.value;
      }
      return false;
    }
    case 'count': {
      const v = readStat(ctx, c.what);
      return v !== undefined && v >= c.min;
    }
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
  if (e.k === 'stat') {
    const h = statOf(e.stat);
    if (h?.add) h.add(ctx, e.stat, e.delta);
    else report(ctx, 'effect', `stat:${e.stat}`);
    return;
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
  return { conds: [...conds.keys(), 'and', 'or', 'not', 'text', 'cmp', 'count'].sort(), effects: [...effects.keys(), 'label', 'if', 'only', 'chance', 'pick', 'stat'].sort() };
}

/** Test helper: forget every handler (systems register again when their module is imported fresh). */
export function resetRules(): void {
  stats.clear();
  conds.clear();
  effects.clear();
  missing.clear();
}
