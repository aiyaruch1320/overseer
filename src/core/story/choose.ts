// Choosing a way at a fork (storylines/README.md §7 "วิธีอ่านตารางโหนด", llm/04-story.md §3.1): the written weight, changed by the
// traits and events in `mods`, by the node's own notes, by earlier nodes (entryMod, nodeWeight) and by the rule-based director.
import type { Ctx } from '../game';
import { test } from '../rules';
import type { Choice, Condition, Effect, NodeId } from '../types';
import { DIRECTOR_CAP, DIRECTOR_TIE } from './tuning';
import type { Key, StoryExt } from './state';

export interface Refs {
  npcs: Set<string>;
  events: Set<string>;
  /** Turning points a way names: `job:<id>` (a job path opened or a job taken), `bond:<line>`, `ref:<node>` and `ref:<node>.<way>`. */
  pivots: Set<string>;
}

/** Every NPC, event and turning point a list of effects names, looking inside the wrappers. */
export function refsOf(list: readonly Effect[] | undefined, out: Refs = { npcs: new Set(), events: new Set(), pivots: new Set() }): Refs {
  for (const e of list ?? []) {
    switch (e.k) {
      case 'npc':
        out.npcs.add(e.id);
        break;
      case 'event':
        out.events.add(e.id);
        break;
      case 'jobpath':
        out.pivots.add(`job:${e.job}`);
        break;
      case 'grant':
        if (e.kind === 'job') out.pivots.add(`job:${e.id}`);
        break;
      case 'bond':
        out.pivots.add(`bond:${e.line}`);
        break;
      case 'ref':
        for (const id of e.nodes) out.pivots.add(e.choice ? `ref:${id}.${e.choice}` : `ref:${id}`);
        break;
      case 'if':
      case 'only':
      case 'chance':
        refsOf(e.then, out);
        break;
      case 'pick':
        for (const b of e.of) refsOf(b.effects, out);
        break;
      case 'outcome':
        refsOf(e.effects, out);
        break;
    }
  }
  return out;
}

/**
 * The director's memory (llm/04-story.md §3.1 rule 2): ids of people and events this life has met (what the nodes named, and the world
 * events that fired during the life) and the turning points it chose (a job path, a bond line, the ways it took at earlier nodes).
 */
export function metBy(ctx: Ctx, ex: StoryExt): Set<string> {
  const met = new Set<string>([...ex.seen.npcs, ...ex.seen.events, ...ex.seen.pivots]);
  const life = ctx.state.life;
  if (life) {
    for (const [id, year] of Object.entries(ctx.state.world.happened)) if (year >= life.birthYear) met.add(id);
    // a way that points at a node the life already walked (`ref`) ties back to it, to the way taken when the row names one
    for (const [id, key] of Object.entries(life.passed)) {
      met.add(`ref:${id}`);
      if (key !== '-') met.add(`ref:${id}.${key}`);
    }
  }
  return met;
}

/** A choice ties back when it names someone or something the life already met (llm/04-story.md §3.1 first two rows). */
export function ties(c: Choice, met: ReadonlySet<string>): boolean {
  if (met.size === 0) return false;
  const r = refsOf(c.effects);
  for (const id of r.npcs) if (met.has(id)) return true;
  for (const id of r.events) if (met.has(id)) return true;
  for (const id of r.pivots) if (met.has(id)) return true;
  return false;
}

export interface Pull {
  /** `choiceMod` of the node: a choice of this very node. */
  choice: { choice: Key; cond?: Condition; mul: number }[];
  /** `entryMod` for a convergence: set up by an earlier row. */
  entry: { choice: Key; cond?: Condition; mul: number }[];
  /** `nodeWeight` with a label: one side of the node. */
  label: { label: string; mul: number }[];
}

export interface Weighed {
  weights: number[];
  ties: boolean[];
}

export function weigh(ctx: Ctx, choices: readonly Choice[], pull: Pull, ex: StoryExt, cut: (c: Choice, i: number) => boolean): Weighed {
  const director = ctx.state.settings.llm.director;
  const met = metBy(ctx, ex);
  const tie = choices.map((c) => ties(c, met));
  const weights = choices.map((c, i) => {
    if (cut(c, i)) return 0;
    if (c.when && !test(ctx, c.when)) return 0;
    let add = 0;
    let mul = 1;
    for (const m of c.mods) {
      if (!test(ctx, m.cond)) continue;
      add += m.add ?? 0;
      mul *= m.mul;
    }
    let w = Math.max(0, c.weight + add) * mul;
    for (const m of pull.choice) if (m.choice === c.key && test(ctx, m.cond)) w *= m.mul;
    for (const m of pull.entry) if (m.choice === c.key && test(ctx, m.cond)) w *= m.mul;
    for (const m of pull.label) if (c.label.includes(m.label)) w *= m.mul;
    if (director && tie[i]) w *= Math.min(DIRECTOR_CAP, DIRECTOR_TIE);
    return w;
  });
  return { weights, ties: tie };
}

/** Which nodes a `nodeWeight` effect without a label points at: the weight of entering that node among several. */
export function entryWeight(ex: StoryExt, node: NodeId): number {
  let w = 1;
  for (const m of ex.nodeMods) if (m.node === node && !m.label) w *= m.mul;
  return w;
}
