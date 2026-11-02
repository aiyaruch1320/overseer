// Reads data/gen/storylines.json and convergence.json once per loaded data set and indexes them for the walk.
import { dataOf, type Ctx } from '../game';
import type { ConvergenceData, ConvergencePoint, Ending, LineMeta, Link, PairSet, Rite, StoryNodeX, StorylinesData } from '../data/types-storylines';
import type { NodeId } from '../types';

export interface Index {
  nodes: Map<NodeId, StoryNodeX>;
  lines: Map<string, LineMeta>;
  /** Playable nodes of a line in table order (main and overlay nodes, not fallbacks). */
  seq: Map<string, StoryNodeX[]>;
  /** Fallback nodes of a race line (`xx.l1`). */
  fallbacks: Map<string, StoryNodeX[]>;
  cv: Map<NodeId, ConvergencePoint>;
  cv0: StoryNodeX | undefined;
  rites: Map<NodeId, Rite>;
  linksFrom: Map<NodeId, Link[]>;
  endings: Ending[];
  pairSets: PairSet[];
  /** Overlay line ids, in data order. */
  overlays: string[];
  raceLines: Set<string>;
}

const cache = new WeakMap<object, Index>();

export function indexOf(ctx: Ctx): Index {
  const sl = dataOf<StorylinesData>(ctx, 'storylines');
  const hit = cache.get(sl);
  if (hit) return hit;
  const cvd = ctx.data.convergence ? dataOf<ConvergenceData>(ctx, 'convergence') : undefined;
  const nodes = new Map<NodeId, StoryNodeX>();
  const seq = new Map<string, StoryNodeX[]>();
  const fallbacks = new Map<string, StoryNodeX[]>();
  for (const n of sl.nodes) {
    nodes.set(n.id, n);
    const bucket = n.kind === 'fallback' ? fallbacks : seq;
    const list = bucket.get(n.line) ?? [];
    list.push(n);
    bucket.set(n.line, list);
  }
  const cv = new Map<NodeId, ConvergencePoint>();
  for (const p of cvd?.points ?? []) {
    cv.set(p.id, p);
    nodes.set(p.id, p);
  }
  const linksFrom = new Map<NodeId, Link[]>();
  for (const l of sl.links) linksFrom.set(l.from, [...(linksFrom.get(l.from) ?? []), l]);
  const lines = new Map(sl.lines.map((l) => [l.id, l]));
  const raceLines = new Set(sl.lines.filter((l) => sl.rites.some((r) => r.line === l.id)).map((l) => l.id));
  const ix: Index = {
    nodes,
    lines,
    seq,
    fallbacks,
    cv,
    cv0: cvd?.fallback,
    rites: new Map(sl.rites.map((r) => [r.id, r])),
    linksFrom,
    endings: sl.endings,
    pairSets: sl.pairSets,
    overlays: sl.lines.filter((l) => !raceLines.has(l.id)).map((l) => l.id),
    raceLines,
  };
  cache.set(sl, ix);
  return ix;
}
