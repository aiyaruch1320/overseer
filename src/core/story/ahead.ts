// The forks the LLM director may be asked about ahead of time (llm/04-story.md §3.2 to §3.4). `directorAhead` is a pure read of the state: it draws nothing, writes nothing and
// asks nothing, so a game with no LLM plays the same life. `askAhead` is the one async piece: it hands each new point to `requestDirector` and returns when the answers are in;
// the clock never waits for it (the app and the tools call it after a beat).
//
// What the core can name as a key point (the forks it has are the nodes of the story walk; the other forks of §3.2 are plain rolls with fixed weights in the npc and god systems, with no
// fork to hand to `weigh`, so they are not here):
//  - `repeat_meet`: the node (a way among the two the rule-based layer ranks highest, or its notes) names (effect `npc`) a holder the character already knows from two meetings or more, so the coming meeting is the third.
//  - `quiet`: the node is the first one the life plays after a big world event (mark ⭐ or ●) that fell in the last three life years, and the two ways have no fight and no death in them.
//  - `npc_death`, `heart`: not recognised. The follow-up of a dead NPC (npc/ties.ts, 40/35/25) and the burden event of the heart (god/dream.ts, thirds) are single rolls, not nodes; a node that
//    merely names a dead NPC is not "the story that follows the death", and the burden leaves no node behind to point at.
// Left out always (§3.3): a node with a god window or a dream waiting on it (the god's tools act there), the closing nodes of a race line and every way that fights or dies.
import { BEATS_PER_LIFE_YEAR, worldYearsPerLifeYear } from '../clock';
import type { Ctx } from '../game';
import type { StoryNodeX } from '../data/types-storylines';
import type { LlmClient } from '../llm/client';
import { requestDirector, type AskResult, type DirectorPoint } from '../llm/director';
import { keys } from '../llm/record';
import { DIRECTOR } from '../llm/tuning';
import { slotsOf } from '../npc/types';
import { test } from '../rules';
import type { Choice, Effect } from '../types';
import { markOf, tablesOf } from '../world/data';
import { refsOf, topTwo, weigh } from './choose';
import { indexOf } from './data';
import { lifeOf, type StoryExt } from './state';
import { ROLLING_LINES } from './tuning';
import { canEnter, outcomeChoices, playable, pullOf, splitNotes, variantOf } from './walk';

/** A world event this big counts for the quiet time that follows it. */
const BIG_MARKS: ReadonlySet<string> = new Set(['⭐', '●']);
/** "The last three life years" of the table of llm/04-story.md §3.1. */
const BIG_YEARS = 3;
/** The meetings after which the next one is the third (llm/04-story.md §3.4). */
const KNOWN_BEFORE_THIRD = 2;

const ENDS_THE_WAY: ReadonlySet<string> = new Set(['battle', 'death']);

/** Does a list of effects hold one of these kinds, looking inside the wrappers? */
function holds(list: readonly Effect[] | undefined, kinds: ReadonlySet<string>): boolean {
  for (const e of list ?? []) {
    if (kinds.has(e.k)) return true;
    if (e.k === 'if' || e.k === 'only' || e.k === 'chance') {
      if (holds(e.then, kinds)) return true;
    } else if (e.k === 'pick') {
      if (e.of.some((b) => holds(b.effects, kinds))) return true;
    } else if (e.k === 'outcome' && holds(e.effects, kinds)) return true;
  }
  return false;
}

/** The world year the next life year step plays in: the clock run on a copy until its quarter wraps (game/index.ts `beat`). */
function nextYearStep(ctx: Ctx): number {
  const life = ctx.state.life!;
  const { worldYear, worldAcc, quarter } = ctx.state.clock;
  const per = worldYearsPerLifeYear(life.lifespan, life.race) / BEATS_PER_LIFE_YEAR;
  let year = worldYear;
  let acc = worldAcc;
  for (let q = quarter; q < BEATS_PER_LIFE_YEAR; q++) {
    const before = Math.floor(acc);
    acc += per;
    year += Math.floor(acc) - before;
    while (acc >= 10) acc -= 10;
  }
  return year;
}

/** The year of the latest world event of a big mark that fell during this life within the last three life years; undefined when none. */
function bigEventYear(ctx: Ctx): number | undefined {
  const life = ctx.state.life!;
  const span = BIG_YEARS * worldYearsPerLifeYear(life.lifespan, life.race);
  let tables;
  try {
    tables = tablesOf(ctx);
  } catch {
    return undefined;
  }
  let best: number | undefined;
  for (const [id, year] of Object.entries(ctx.state.world.happened)) {
    if (year < life.birthYear || ctx.state.clock.worldYear - year > span || !BIG_MARKS.has(markOf(tables, id))) continue;
    if (best === undefined || year > best) best = year;
  }
  return best;
}

/** The world year of the node the life played last (the log keeps it); undefined when it played none. */
function lastNodeYear(ctx: Ctx): number | undefined {
  const log = ctx.state.log;
  for (let i = log.length - 1; i >= 0; i--) if (log[i].sys === 'story' && log[i].kind === 'node') return log[i].worldYear;
  return undefined;
}

interface Due {
  node: StoryNodeX;
  /** True for a queued convergence: it plays at the next beat, not at the next life year. */
  queued: boolean;
}

/** The nodes that will play within a life year and whose time the game already knows: a drawn age (`fire`) that has come by the next year step, or a convergence waiting in the queue. */
function dueNodes(ctx: Ctx, ex: StoryExt): Due[] {
  const life = lifeOf(ctx)!;
  const ix = indexOf(ctx);
  const out: Due[] = [];
  const lines = [ex.line, ...ix.overlays.filter((l) => ex.open[l] === true && l !== 'xc')];
  for (const line of lines) {
    if (ROLLING_LINES.has(line) && line !== ex.line) continue;
    const n = playable(ex, ix, line).find((m) => life.passed[m.id] === undefined && !ex.skipped.includes(m.id) && m.age[1] >= ex.start);
    if (!n || ex.announced[n.id] || n.converge?.length) continue;
    const fire = ex.fire[n.id];
    // a node whose age is not drawn yet is not known to come: its turn may be a few years off
    if (fire === undefined || fire > life.hAge + 1) continue;
    out.push({ node: n, queued: false });
  }
  for (const id of life.pending) {
    const cv = ix.cv.get(id);
    if (cv && canEnter(ctx, id) && !out.some((d) => d.node.id === id)) out.push({ node: cv, queued: true });
  }
  return out;
}

/** A way names a holder the life has met twice or more (the holder is alive: a dead one is not met again). */
function repeatMeet(lists: readonly (readonly Effect[])[], slots: ReturnType<typeof slotsOf>): boolean {
  for (const list of lists) {
    for (const id of refsOf(list).npcs) {
      const s = slots[id];
      if (s && s.status === 'alive' && (s.rel['mc.known'] ?? 0) >= KNOWN_BEFORE_THIRD) return true;
    }
  }
  return false;
}

/**
 * The key points that come within the next life year: each with the id the fork will have when it is played (`node:worldYear`, choose.ts `forkId`) and the two ways the rule-based layer
 * ranks highest now. The ways are read again at the fork (`directorMul` against `checkPick`), so a guess that went stale costs nothing. Pure: no state, no rng draw.
 */
export function directorAhead(ctx: Ctx): DirectorPoint[] {
  const life = lifeOf(ctx);
  const ex = life?.ext.story as StoryExt | undefined;
  if (!life || !ex?.line || !ctx.data.storylines) return [];
  const ix = indexOf(ctx);
  const dreams = ((ctx.state.god?.dreams ?? []) as { node?: string }[]).map((d) => d.node);
  const slots = slotsOf(ctx.state);
  const big = bigEventYear(ctx);
  const lastNode = big !== undefined ? lastNodeYear(ctx) : undefined;
  const yearStepAt = nextYearStep(ctx);
  const out: DirectorPoint[] = [];
  for (const { node: n, queued } of dueNodes(ctx, ex)) {
    // §3.3: the god's windows and dreams and the end of a line are not for the LLM
    if (n.godWindow || dreams.includes(n.id) || n.stage === 'e') continue;
    if (n.when && !test(ctx, n.when)) continue;
    const [pre] = splitNotes(n.notes);
    const choices: Choice[] = variantOf(ctx, pre) ?? (n.choices.length ? n.choices : outcomeChoices(ix, n)?.choices ?? []);
    if (choices.length < 2) continue;
    const cut = (c: Choice) => c.effects.some((e) => e.k === 'converge' && !canEnter(ctx, e.to));
    const top = topTwo(weigh(ctx, choices, pullOf(ctx, ex, n, pre), ex, cut).weights);
    if (top.length < 2) continue;
    const ways = top.map((x) => choices[x.i]);
    // a fight or a death is not decided by a story layer (§3.3)
    if (ways.some((c) => holds(c.effects, ENDS_THE_WAY))) continue;
    const kind = repeatMeet([...ways.map((c) => c.effects), n.notes], slots) ? 'repeat_meet' : big !== undefined && (lastNode === undefined || big > lastNode) ? 'quiet' : undefined;
    if (!kind) continue;
    const year = queued ? ctx.state.clock.worldYear : yearStepAt;
    out.push({ id: `${n.id}:${year}`, kind, ways: [{ key: ways[0].key, text: ways[0].label }, { key: ways[1].key, text: ways[1].label }] });
  }
  return out;
}

/** How many points of this life were asked (an answer may still be on its way, so the offers alone undercount). */
export function askedCount(ctx: Ctx): number {
  const life = ctx.state.life;
  if (!life) return 0;
  const prefix = keys.asked(life.id, '');
  return Object.keys(ctx.state.llmAnswers).filter((k) => k.startsWith(prefix)).length;
}

/**
 * After a beat: asks the director for each point of `directorAhead` that was not asked yet, up to the cap of the life. Returns the promise of all the asks (the app lets it run, the tools await it);
 * with no client it does nothing at all. A point already asked, offered or decided is skipped without a request.
 */
export function askAhead(ctx: Ctx, client: LlmClient | null | undefined): Promise<AskResult[]> {
  const life = ctx.state.life;
  if (!client || !life || life.dead) return Promise.resolve([]);
  const ans = ctx.state.llmAnswers;
  let room = DIRECTOR.perLife - askedCount(ctx);
  const asks: Promise<AskResult>[] = [];
  for (const p of directorAhead(ctx)) {
    if (room <= 0) break;
    if (ans[keys.asked(life.id, p.id)] !== undefined || ans[keys.offer(life.id, p.id)] !== undefined || ans[keys.decision(life.id, p.id)] !== undefined) continue;
    room--;
    asks.push(requestDirector(ctx, p, client).catch((): AskResult => 'template'));
  }
  return Promise.all(asks);
}
