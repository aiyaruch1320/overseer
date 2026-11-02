// Typed, indexed access to data/gen/bonds.json and the ally arcs of storylines.json, built once per loaded data set.
import { dataOf, type Ctx } from '../game';
import type { BondsData, PairedItem, StoryTemplate, Successor } from '../data/types-bonds';
import type { AllyArc, StorylinesData } from '../data/types-storylines';
import { LINE_ALIASES } from './tuning';

export interface BondsIndex {
  data: BondsData;
  /** Thai line names, in the order of the docs. */
  lines: string[];
  /** The 24 moods. */
  moods: string[];
  templates: Map<string, StoryTemplate>;
  ft: StoryTemplate[];
  kn: StoryTemplate[];
  arcs: Map<string, AllyArc>;
  /** Prototype NPC id → the written successor. */
  successors: Map<string, Successor>;
  pairs: Map<string, PairedItem>;
  pairOfHalf: Map<string, PairedItem>;
  /** Level (1..5) of a value of B. */
  levelOf(b: number): number;
}

const cache = new WeakMap<object, BondsIndex>();

export function bondsIndex(ctx: Ctx): BondsIndex {
  const file = ctx.data.bonds;
  const hit = file && cache.get(file);
  if (hit) return hit;
  const data = dataOf<BondsData>(ctx, 'bonds');
  const sl = ctx.data.storylines ? dataOf<StorylinesData>(ctx, 'storylines') : undefined;
  const templates = new Map<string, StoryTemplate>();
  for (const t of data.arcs.templates) templates.set(t.id, t);
  for (const t of data.family.templates) templates.set(t.id, t);
  const levels = data.ties.levels;
  const idx: BondsIndex = {
    data,
    lines: data.ties.lines.map((l) => l.name),
    moods: data.feelings.feelings.map((f) => f.name),
    templates,
    ft: data.arcs.templates,
    kn: data.family.templates,
    arcs: new Map((sl?.allyArcs ?? []).map((a) => [a.npc, a])),
    successors: new Map(data.successors.list.map((s) => [s.proto, s])),
    pairs: new Map(data.paired.pairs.map((p) => [p.id, p])),
    pairOfHalf: new Map(data.paired.pairs.flatMap((p) => p.halves.map((h) => [h, p] as const))),
    levelOf(b) {
      for (const l of levels) if (b >= l.min && b <= l.max) return l.n;
      return b < 0 ? 1 : 5;
    },
  };
  if (file) cache.set(file, idx);
  return idx;
}

/** A line named in the docs or by a legacy word (`สหาย` `lover` `child`) → the Thai name the data uses; the empty string for a word that is no line. */
export function lineName(ctx: Ctx, word: string): string {
  const w = word.trim();
  const ix = bondsIndex(ctx);
  if (ix.lines.includes(w)) return w;
  return LINE_ALIASES[w.toLowerCase()] ?? '';
}

/** Lowest bond level at which the line can show the mood; null when never (the `-` of the table). */
export function moodFloor(ctx: Ctx, mood: string, line: string): number | null {
  return bondsIndex(ctx).data.feelings.matrix[mood]?.[line] ?? null;
}

/** B at the low end of a level. */
export function floorB(ctx: Ctx, level: number): number {
  return bondsIndex(ctx).data.ties.levels.find((l) => l.n === level)?.min ?? 0;
}

export function ceilB(ctx: Ctx, level: number): number {
  return bondsIndex(ctx).data.ties.levels.find((l) => l.n === level)?.max ?? 100;
}
