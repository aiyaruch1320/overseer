// What the god system reads of the story (read only): the nodes the character will reach soon, the ids they mention, and the god window rows.
// The story system owns the walk (src/core/story/); this file only looks at `life.passed`, `life.pending` and `life.ext.story`.
import type { Ctx } from '../game';
import type { StoryNodeX } from '../data/types-storylines';
import type { Choice, Condition, Effect } from '../types';
import { indexOf } from '../story/data';
import { extOf as storyExt } from '../story/state';
import { canEnter, outcomeChoices } from '../story/walk';
import { lifeOf, windowNodes } from './state';

export interface Upcoming {
  node: StoryNodeX;
  line: string;
  /** Earliest hAge the node can fire at (the age drawn for it when it is known). */
  due: number;
  /** A convergence queued for a later beat. */
  queued?: boolean;
}

const hasStory = (ctx: Ctx): boolean => !!ctx.data.storylines;

/**
 * The nodes the character reaches within `years` life years: the next node of the main line and of each open overlay line, and the
 * convergences already queued. Nodes whose own condition fails now are left out (they would be skipped).
 */
export function upcomingNodes(ctx: Ctx, years: number): Upcoming[] {
  const life = lifeOf(ctx);
  if (!life || !hasStory(ctx)) return [];
  const ex = storyExt(life);
  if (!ex.line) return [];
  const ix = indexOf(ctx);
  const out: Upcoming[] = [];
  const lines = [ex.line, ...ix.overlays.filter((l) => ex.open[l] === true && l !== 'xc')];
  for (const line of lines) {
    const n = (ix.seq.get(line) ?? []).find((m) => life.passed[m.id] === undefined && !ex.skipped.includes(m.id) && m.age[1] >= ex.start);
    if (!n) continue;
    const lo = Math.max(0, n.age[0] - (ex.earlier[n.id] ?? 0));
    const due = Math.max(ex.fire[n.id] ?? lo, life.hAge, lo);
    if (due > life.hAge + years) continue;
    out.push({ node: n, line, due });
  }
  for (const id of life.pending) {
    const cv = ix.cv.get(id);
    if (cv && canEnter(ctx, id) && !out.some((u) => u.node.id === id)) out.push({ node: cv, line: 'cv', due: life.hAge, queued: true });
  }
  return out;
}

/** Ids a condition mentions (`has` ids, `anyOf` ids, tags without the `#`). */
export function idsOfCond(c: Condition | undefined, out: Set<string> = new Set()): Set<string> {
  if (!c) return out;
  switch (c.k) {
    case 'has':
      out.add(c.id.replace(/^#/, ''));
      break;
    case 'anyOf':
      for (const id of c.ids) out.add(id);
      break;
    case 'and':
    case 'or':
      for (const x of c.of) idsOfCond(x, out);
      break;
    case 'not':
      idsOfCond(c.of, out);
      break;
  }
  return out;
}

export function idsOfEffects(list: readonly Effect[] | undefined, out: Set<string> = new Set()): Set<string> {
  for (const e of list ?? []) {
    if (e.k === 'grant' || e.k === 'remove' || e.k === 'favour') out.add(e.id.replace(/^#/, ''));
    else if (e.k === 'if' || e.k === 'only' || e.k === 'chance') {
      idsOfCond(e.k === 'chance' ? undefined : e.cond, out);
      idsOfEffects(e.then, out);
    } else if (e.k === 'pick') for (const b of e.of) idsOfEffects(b.effects, out);
  }
  return out;
}

const backticks = (text: string): string[] => [...text.matchAll(/`([a-z][a-z0-9_]*)`/g)].map((m) => m[1]);

/** Ids and tags the nodes of the next life year mention: a gift that matches one is likelier in the chest (02-bestow.md §3 "×3"). */
export function upcomingKeys(ctx: Ctx): Set<string> {
  const keys = new Set<string>();
  for (const u of upcomingNodes(ctx, 1)) {
    const n = u.node;
    idsOfCond(n.when, keys);
    for (const c of n.choices) {
      idsOfCond(c.when, keys);
      for (const m of c.mods) idsOfCond(m.cond, keys);
      idsOfEffects(c.effects, keys);
    }
    for (const id of backticks(n.godWindow?.what ?? '')) keys.add(id);
  }
  return keys;
}

/** Ids the god window rows of this life year name (`b_courage`): one slot of the chest is that one for sure (02-bestow.md §3). */
export function windowIds(ctx: Ctx): Set<string> {
  const out = new Set<string>();
  if (!hasStory(ctx)) return out;
  const ix = indexOf(ctx);
  for (const id of windowNodes(ctx)) for (const x of backticks(ix.nodes.get(id)?.godWindow?.what ?? '')) out.add(x);
  return out;
}

/**
 * The ways a node offers a dream: its own, or the outcomes of a rite written as a table of weights (the first meal of a ghoul). A rite that draws
 * a sub-line (pass or fail by chance) offers none. At most three, because a way is named by its key.
 */
export function choicesOf(ctx: Ctx, n: StoryNodeX): Choice[] {
  if (!n.rite) return n.choices;
  const o = outcomeChoices(indexOf(ctx), n);
  return o && o.choices.length <= 3 ? o.choices : [];
}
