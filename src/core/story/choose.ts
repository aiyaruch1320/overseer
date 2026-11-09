// Choosing a way at a fork (storylines/README.md §7 "วิธีอ่านตารางโหนด", llm/04-story.md §3.1): the written weight, changed by the
// traits and events in `mods`, by the node's own notes, by earlier nodes (entryMod, nodeWeight) and by the rule-based director.
import type { Ctx } from '../game';
import { combineMul, directorMul, type DirectorPoint } from '../llm/director';
import { test } from '../rules';
import type { Choice, Condition, Effect, NodeId } from '../types';
import { DIRECTOR_CAP, DIRECTOR_TIE, PLACE_SHUT } from './tuning';
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
  return tieKind(c, met) !== null;
}

/** What a way ties back to (llm/04-story.md §3.5): `npc` a person met again, `event` a world event of this life, `thread` a turning point or an earlier way of the life (an open thread settled). The first that matches, in that order. */
export type TieKind = 'npc' | 'event' | 'thread';
export function tieKind(c: Choice, met: ReadonlySet<string>): TieKind | null {
  if (met.size === 0) return null;
  const r = refsOf(c.effects);
  for (const id of r.npcs) if (met.has(id)) return 'npc';
  for (const id of r.events) if (met.has(id)) return 'event';
  for (const id of r.pivots) if (met.has(id)) return 'thread';
  return null;
}

/**
 * The places a way names with the effect `place`, looking inside the wrappers (only the ids of a country, `AL-01`: the other ids of that effect are
 * kinds of place, not a country to go to).
 */
export function placesOf(list: readonly Effect[] | undefined, out: Set<string> = new Set()): Set<string> {
  for (const e of list ?? []) {
    if (e.k === 'place') {
      for (const id of e.ids) if (/^[A-Z]{2}-\d{2}$/.test(id)) out.add(id);
    } else if (e.k === 'if' || e.k === 'only' || e.k === 'chance') placesOf(e.then, out);
    else if (e.k === 'pick') for (const b of e.of) placesOf(b.effects, out);
    else if (e.k === 'outcome') placesOf(e.effects, out);
  }
  return out;
}

/**
 * The travel system sets this gate when it is loaded: can the character get to that country by a normal way now (travel `canGo`)? Without it
 * every place is open and a way that names one is weighed as written.
 */
let placeGate: ((ctx: Ctx, to: string) => boolean) | null = null;
export function setPlaceGate(fn: ((ctx: Ctx, to: string) => boolean) | null): void {
  placeGate = fn;
}

/** A way that moves the character to a country the filters of travel shut does not happen as often (the move would be refused, travel `followStory`). */
function shut(ctx: Ctx, c: Choice): boolean {
  if (!placeGate) return false;
  const life = ctx.state.life;
  for (const to of placesOf(c.effects)) if (life && to !== life.country && !placeGate(ctx, to)) return true;
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
  /** What each way that ties back ties to (null for a way that does not). */
  kinds: (TieKind | null)[];
}

/**
 * The rule-based director is always on (llm/04-story.md §3.1 rules 1 to 2, §3.4 "ไม่มี LLM: ทำงานเหมือนเดิม"): the docs give no switch for it. `Settings.llm.director` is the switch of the
 * LLM layer above it (`directorMul`), and `master` shuts every point; neither touches this. The hook below is for the tests that measure the layer against no director at all.
 */
let ruleDirector = true;
export function setRuleDirector(on: boolean): void {
  ruleDirector = on;
}

/** The id of a fork for the LLM director: the same in the request ahead and at the fork (llm/04-story.md §3.4), `node:year` of the world. */
export const forkId = (ctx: Ctx, node: NodeId): string => `${node}:${ctx.state.clock.worldYear}`;

/**
 * The weight of every way at a fork. `point` is the id of the fork (`forkId`): with it the LLM director's choice for this fork, if the layer was asked and answered, adds its factor
 * to one of the two ways the rule-based director ranks highest (`directorMul`, the two layers together at most ×2.5 by `combineMul`). Without it (previews that must change nothing,
 * such as the dreams of the god) only the rule-based layer weighs. The first read of a point freezes what it used in the save (llm/director.ts), so a replay reads the same.
 */
export function weigh(ctx: Ctx, choices: readonly Choice[], pull: Pull, ex: StoryExt, cut: (c: Choice, i: number) => boolean, point?: string): Weighed {
  const met = metBy(ctx, ex);
  const kinds = choices.map((c) => tieKind(c, met));
  const tie = kinds.map((k) => k !== null);
  // [weight without the director, factor of the rule-based director, factor of the place filter]
  const parts = choices.map((c, i): [number, number, number] => {
    if (cut(c, i)) return [0, 1, 1];
    if (c.when && !test(ctx, c.when)) return [0, 1, 1];
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
    return [w, ruleDirector && tie[i] ? Math.min(DIRECTOR_CAP, DIRECTOR_TIE) : 1, shut(ctx, c) ? PLACE_SHUT : 1];
  });
  const weights = parts.map(([w, rule, gate]) => w * rule * gate);
  // the LLM layer: the two ways the rule-based layer ranks highest are the ways the point offers (ties keep the order of the written ways)
  if (point) {
    const top = topTwo(weights);
    if (top.length === 2) {
      const ways: DirectorPoint['ways'] = [
        { key: choices[top[0].i].key, text: choices[top[0].i].label },
        { key: choices[top[1].i].key, text: choices[top[1].i].label },
      ];
      const found = { id: point, ways };
      for (const { i } of top) {
        const llm = directorMul(ctx, found, choices[i].key);
        if (llm > 1) weights[i] = parts[i][0] * combineMul(parts[i][1], llm) * parts[i][2];
      }
    }
  }
  return { weights, ties: tie, kinds };
}

/** The two ways with the most weight, best first (ties keep the order of the written ways): the ways a point offers. */
export function topTwo(weights: readonly number[]): { w: number; i: number }[] {
  return weights
    .map((w, i) => ({ w, i }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .slice(0, 2);
}

/** Which nodes a `nodeWeight` effect without a label points at: the weight of entering that node among several. */
export function entryWeight(ex: StoryExt, node: NodeId): number {
  let w = 1;
  for (const m of ex.nodeMods) if (m.node === node && !m.label) w *= m.mul;
  return w;
}
