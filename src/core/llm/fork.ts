// A plain roll with fixed weights (an NPC's follow-up, the burden of the heart) turned into a fork the LLM director can lean (llm/04-story.md §3.2, §3.4).
// `leanWeights` is the sync read at the fork, the same factor `story/choose.ts weigh` gives: the two ways the rule-based layer ranks highest are the ways the point
// offers, and the one the LLM chose weighs ×1.5 more. With no answer it returns the weights as given, so the draw after it is the draw that was before.
import type { Ctx } from '../game';
import { combineMul, directorMul, type DirectorPoint } from './director';

export interface ForkWay {
  key: string;
  text: string;
  /** The base weight of the way as the docs write it; 0 means the way cannot happen now. */
  weight: number;
  /** Breaks a tie of weights when the two ways to offer are chosen: higher first (the rule-based fit to the cause). It never changes a weight. */
  fit?: number;
}

/** The two ways with the most weight, best first. Ties go to the higher `fit`, then to the order given. */
export function offeredWays(ways: readonly ForkWay[]): [ForkWay, ForkWay] | undefined {
  const top = ways
    .map((w, i) => ({ w, i }))
    .filter((x) => x.w.weight > 0)
    .sort((a, b) => b.w.weight - a.w.weight || (b.w.fit ?? 0) - (a.w.fit ?? 0) || a.i - b.i)
    .slice(0, 2);
  return top.length === 2 ? [top[0].w, top[1].w] : undefined;
}

/** The point a fork hands to the director: its id and the two ways it offers; undefined when fewer than two ways can happen. */
export function forkPoint(id: string, ways: readonly ForkWay[]): Pick<DirectorPoint, 'id' | 'ways'> | undefined {
  const two = offeredWays(ways);
  return two && { id, ways: [{ key: two[0].key, text: two[0].text }, { key: two[1].key, text: two[1].text }] };
}

/** The weights of the ways at the fork, in the order given: the base weights, and ×1.5 on the way the LLM director chose when it chose one of the two offered. */
export function leanWeights(ctx: Ctx, id: string, ways: readonly ForkWay[]): number[] {
  const out = ways.map((w) => w.weight);
  const point = forkPoint(id, ways);
  if (!point) return out;
  for (const o of point.ways) {
    const i = ways.findIndex((w) => w.key === o.key);
    const llm = directorMul(ctx, point, o.key);
    if (llm > 1) out[i] = ways[i].weight * combineMul(1, llm);
  }
  return out;
}
