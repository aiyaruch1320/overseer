// The walk (code-plan §7 row "story", storylines/README.md §6 rules 6 to 9, 00-convergence.md §3):
// each life year the nodes whose age has come are played in order, line by line; a node picks a way by weight, applies it through
// the rules, and may queue a convergence (`life.pending`) that is played on a later beat.
import type { Ctx } from '../game';
import { dataOf } from '../game';
import type { Rite, RiteOutcome, StoryNodeX } from '../data/types-storylines';
import { write } from '../log';
import { apply, test, type EffectSource } from '../rules';
import type { Choice, Condition, Effect, LifeState, NodeId } from '../types';
import { entryWeight, refsOf, weigh, type Pull } from './choose';
import { indexOf, type Index } from './data';
import { addOnce, extOf, lifeOf, yearOf, type Key, type StoryExt } from './state';
import { DEADLY_OUTCOMES, DEATH_WAYS, EXTERNAL_LINES, JOURNEY_AT_ONCE, JOURNEY_LINES, LAST_YEAR, LAST_YEAR_EXTRA, LINK_ENTER, MEMORY_LINES, NODES_PER_YEAR, OPEN_COND, OPEN_PRED, OPEN_RATE, OVERLAY_AT_ONCE, PAIR_RATE, RACE_LINE, RITE_PASS, SLIP_YEARS, WAIT_STAGES, type Way } from './tuning';

const KEYS: Key[] = ['a', 'b', 'c'];
const keyOf = (i: number): Key => KEYS[Math.min(i, 2)];

// ---------- setup ----------

/** Storyline code of a race: `human` → `hu`. */
export function lineOfRace(ctx: Ctx, race: string): string {
  const fromData = ctx.data.races ? dataOf<{ races: { id: string; storyPrefix: string }[] }>(ctx, 'races').races.find((r) => r.id === race)?.storyPrefix : undefined;
  return fromData ?? RACE_LINE[race] ?? (indexOf(ctx).raceLines.has(race) ? race : '');
}

/** Called when the character is born: fixes the main line and where the walk starts. */
export function begin(ctx: Ctx): void {
  const life = lifeOf(ctx);
  if (!life) return;
  const ex = extOf(life);
  ex.line = lineOfRace(ctx, life.race);
  ex.start = life.hAge;
  // an origin that starts later in the line (`ข้ามไป hu.t2`): the character system may name it in `life.ext.story.skipTo`
  const skipTo = (life.ext.story as { skipTo?: NodeId } | undefined)?.skipTo;
  if (skipTo) {
    const ix = indexOf(ctx);
    const n = ix.nodes.get(skipTo);
    for (const m of n ? ix.seq.get(n.line) ?? [] : []) {
      if (m.id === skipTo) break;
      addOnce(ex.skipped, m.id);
    }
  }
}

// ---------- the yearly step ----------

/** The nodes whose age has come, at the start of a life year (birth, and after each hAge increase). */
export function yearStep(ctx: Ctx): void {
  const life = lifeOf(ctx);
  if (!life) return;
  const ex = extOf(life);
  if (!ex.line) begin(ctx);
  const ix = indexOf(ctx);
  advance(ctx, ex, ix, ex.line, false);
  for (const line of ix.overlays) {
    if (!lifeOf(ctx)) return;
    advance(ctx, ex, ix, line, false);
  }
  // the end of the life comes after every other line has played its year
  if (lifeOf(ctx)) advance(ctx, ex, ix, ex.line, true);
}

/** Plays one queued convergence per beat (it was queued by a node on an earlier beat). */
export function drain(ctx: Ctx): void {
  const life = lifeOf(ctx);
  if (!life) return;
  const ix = indexOf(ctx);
  const i = life.pending.findIndex((id) => ix.cv.has(id));
  if (i < 0) return;
  // the year is full: the convergence stays queued for a later beat
  if (!room(extOf(life), life)) return;
  const [id] = life.pending.splice(i, 1);
  if (canEnter(ctx, id)) enterCv(ctx, id, undefined);
}

// ---------- the pace of a year ----------

/** Does this life year have room for another node (tuning NODES_PER_YEAR; the last year of the life holds one more, for its closing nodes)? */
function room(ex: StoryExt, life: LifeState): boolean {
  return yearOf(ex, life).nodes < NODES_PER_YEAR + (life.hAge >= lastYearOf(life) ? LAST_YEAR_EXTRA : 0);
}

/** The last life year before the natural death: the hidden death age the character system drew (storylines/README.md §6 rule 9). */
export function lastYearOf(life: LifeState): number {
  const age = (life.ext.character as { deathAge?: number } | undefined)?.deathAge;
  return typeof age === 'number' ? age - 1 : LAST_YEAR;
}

function playable(ex: StoryExt, ix: Index, line: string): StoryNodeX[] {
  const all = ix.seq.get(line) ?? [];
  if (line !== 'xc') return all;
  // one node per race, titled `<race name>: ...` (25-journeys.md §10): the life plays the one about its own race
  const name = ix.lines.get(ex.line)?.name;
  return name ? all.filter((n) => n.title.startsWith(`${name}:`) || n.title.startsWith(`${name} `)) : [];
}

function advance(ctx: Ctx, ex: StoryExt, ix: Index, line: string, closing: boolean): void {
  if (!line) return;
  const seq = playable(ex, ix, line);
  for (let guard = 0; guard < 400; guard++) {
    const life = lifeOf(ctx);
    if (!life) return;
    const n = nextNode(life, ex, seq);
    if (!n) return;
    if (!closing && line === ex.line && n.id === `${ex.line}.e2`) return;
    const span = ageWindow(ex, life, line, n);
    if (life.hAge < span.lo) return;
    if (!decideOpen(ctx, ex, ix, line)) return;
    const when = (ex.fire[n.id] ??= ctx.rng('life.story').int(Math.min(Math.max(span.lo, life.hAge), span.hi), span.hi));
    if (life.hAge < when) return;
    // the year is full: the node waits for the next one, a few years past its table age (or past the year it first came due) at most;
    // the closing nodes of the race line never wait, and a node that would wait past the last year of the life is lost with it
    if (!room(ex, life) && !(line === ex.line && n.stage === 'e')) {
      const due = (ex.due[n.id] ??= life.hAge);
      if (life.hAge >= lastYearOf(life)) return skip(ctx, ex, n.id, 'year');
      if (life.hAge < Math.max(span.hi, due) + SLIP_YEARS) {
        ex.fire[n.id] = life.hAge + 1;
        return;
      }
    }
    fireNode(ctx, ex, ix, n);
  }
}

function nextNode(life: LifeState, ex: StoryExt, seq: StoryNodeX[]): StoryNodeX | undefined {
  for (const n of seq) {
    if (life.passed[n.id] !== undefined || ex.skipped.includes(n.id)) continue;
    if (n.age[1] < ex.start) {
      ex.skipped.push(n.id);
      continue;
    }
    return n;
  }
  return undefined;
}

/**
 * The age window a node may fire in. The closing nodes (stage e) of the race line fire at the latest in the last life year before the
 * natural death even when their table age has not come (storylines/README.md §6 rule 9). The last one (e2) is the end of the life: its ways
 * say the character dies, so it comes in that last year and the other lines have played their elders before it.
 */
function ageWindow(ex: StoryExt, life: LifeState, line: string, n: StoryNodeX): { lo: number; hi: number } {
  const last = lastYearOf(life);
  let lo = Math.max(0, n.age[0] - (ex.earlier[n.id] ?? 0));
  if (line === ex.line && n.stage === 'e') lo = Math.min(lo, last);
  if (n.id === `${ex.line}.e2`) lo = last;
  return { lo, hi: Math.max(lo, Math.min(n.age[1], last)) };
}

// ---------- overlay lines ----------

/**
 * Decides once, when the first node of an overlay line is due, whether the life opens the line. A line that is drawn open waits while
 * the places are full: one journey line at a time (25-journeys.md §2 rule 3), and no more than OVERLAY_AT_ONCE lines opened by chance.
 */
function decideOpen(ctx: Ctx, ex: StoryExt, ix: Index, line: string): boolean {
  if (line === ex.line) return true;
  const known = ex.open[line];
  if (known !== undefined) return known;
  const waiting = ex.queue.includes(line);
  if (!waiting) {
    let ok: boolean;
    if (ex.external.includes(line)) ok = true;
    else if (EXTERNAL_LINES.has(line)) ok = false;
    else {
      const cond: Condition | undefined = ix.lines.get(line)?.open ?? OPEN_COND[line];
      const pred = OPEN_PRED[line];
      const s = ctx.state;
      ok = (!cond || test(ctx, cond)) && (!pred || pred({ lives: s.lineage.lives.length, chronicle: s.god.chronicle.length }));
      const pair = ix.pairSets.find((p) => p.set === line);
      if (ok && pair) ok = pairOpens(ctx, ex, pair.pairs) && (PAIR_RATE >= 1 || ctx.rng('life.story').chance(PAIR_RATE));
      const rate = OPEN_RATE[line];
      if (ok && rate !== undefined) ok = ctx.rng('life.story').chance(rate);
    }
    if (!ok) {
      ex.open[line] = false;
      return false;
    }
  }
  if (full(ctx, ex, ix, line)) {
    if (!waiting) ex.queue.push(line);
    return false;
  }
  ex.queue = ex.queue.filter((l) => l !== line);
  ex.open[line] = true;
  return true;
}

/** An overlay line that is open and has nodes left to walk. */
function live(life: LifeState, ex: StoryExt, ix: Index, line: string): boolean {
  if (ex.open[line] !== true) return false;
  return playable(ex, ix, line).some((n) => life.passed[n.id] === undefined && !ex.skipped.includes(n.id) && n.age[1] >= ex.start);
}

/** Are the places full for this line (one journey line at a time; OVERLAY_AT_ONCE lines opened by chance)? */
function full(ctx: Ctx, ex: StoryExt, ix: Index, line: string): boolean {
  const life = lifeOf(ctx);
  if (!life) return false;
  const others = ix.overlays.filter((l) => l !== line && live(life, ex, ix, l));
  if (JOURNEY_LINES.has(line) && others.filter((l) => JOURNEY_LINES.has(l)).length >= JOURNEY_AT_ONCE) return true;
  const byChance = (l: string) => OPEN_RATE[l] !== undefined && !ex.external.includes(l);
  return byChance(line) && others.filter(byChance).length >= OVERLAY_AT_ONCE;
}

/** A half-blood life opens the pair set of its two races (22-halfblood.md §3): `blood` names the second race or the set. */
function pairOpens(ctx: Ctx, ex: StoryExt, pairs: [string, string][]): boolean {
  const life = lifeOf(ctx);
  if (!life || !life.blood || !test(ctx, { k: 'half' })) return false;
  const tokens = life.blood.split(/[^A-Za-z0-9]+/).filter(Boolean).map((t) => RACE_LINE[t] ?? t);
  return pairs.some(([a, b]) => a === ex.line && tokens.includes(b));
}

/** Opens an overlay line from outside the story system (economy for ec, travel for the journey lines ...). */
export function openLine(ctx: Ctx, line: string): void {
  const life = lifeOf(ctx);
  if (!life) return;
  const ex = extOf(life);
  addOnce(ex.external, line);
  delete ex.open[line];
}

// ---------- firing a node ----------

function skip(ctx: Ctx, ex: StoryExt, id: NodeId, why: string): void {
  addOnce(ex.skipped, id);
  const life = lifeOf(ctx);
  if (life) life.pending = life.pending.filter((p) => p !== id);
  write(ctx.state, { sys: 'story', kind: 'skip', id, data: { why }, level: 0 });
}

function fireNode(ctx: Ctx, ex: StoryExt, ix: Index, n: StoryNodeX): void {
  if (n.when && !test(ctx, n.when)) return skip(ctx, ex, n.id, 'when');
  if (n.converge?.length) return fireRow(ctx, ex, ix, n);
  const key = play(ctx, ex, ix, n, {});
  if (key === undefined) return skip(ctx, ex, n.id, 'no way');
  if (n.line === ex.line && n.stage === 'a' && WAIT_STAGES.includes(n.stage)) retryWaiting(ctx, ex);
}

/** `→ cv.N` rows: the convergence stands in for the race's own choices; when none is open the fallback node stands in. */
function fireRow(ctx: Ctx, ex: StoryExt, ix: Index, row: StoryNodeX): void {
  const life = lifeOf(ctx)!;
  const open = (row.converge ?? []).filter((id) => canEnter(ctx, id) && linkAllows(ctx, ix, row.id, id));
  if (open.length) {
    const to = open[Math.max(0, ctx.rng('life.story').weighted(open.map((id) => entryWeight(ex, id))))];
    apply(ctx, rowNotes(row).pre, { sys: 'story', id: row.id });
    enterCv(ctx, to, row);
    return;
  }
  for (const id of row.converge ?? []) if (life.passed[id] === undefined) addOnce(ex.waiting, id);
  useFallback(ctx, ex, ix, row);
}

/** The notes of a row without its own hand-off (`converge`), split into before and after the convergence's choice. */
function rowNotes(row: StoryNodeX): { pre: Effect[]; post: Effect[] } {
  const [pre, post] = splitNotes(row.notes.filter((e) => e.k !== 'converge'));
  return { pre, post };
}

/** A links row may carry its own condition (`ชาวพื้นหลัง DR-01`): when the row has no link the convergence alone decides. */
function linkAllows(ctx: Ctx, ix: Index, from: NodeId, to: NodeId): boolean {
  const links = (ix.linksFrom.get(from) ?? []).filter((l) => l.to.includes(to));
  return links.length === 0 || links.some((l) => !l.cond || test(ctx, l.cond));
}

function useFallback(ctx: Ctx, ex: StoryExt, ix: Index, row: StoryNodeX): void {
  const usable = (ix.fallbacks.get(row.line) ?? []).filter((f) => !ex.fallbackUsed.includes(f.id) && (!f.when || test(ctx, f.when)));
  const fb = usable.find((f) => f.replaces?.includes(row.id)) ?? usable.find((f) => !f.replaces?.length);
  addOnce(ex.skipped, row.id);
  if (fb) {
    ex.fallbackUsed.push(fb.id);
    play(ctx, ex, ix, fb, { replaces: row.id });
  } else if (ix.cv0) {
    // the generic table of 00-convergence.md §3 stands in; the row is the log entry
    play(ctx, ex, ix, ix.cv0, { standIn: row });
  }
}

function retryWaiting(ctx: Ctx, ex: StoryExt): void {
  const life = lifeOf(ctx);
  if (!life) return;
  for (const id of [...ex.waiting]) {
    if (life.passed[id] !== undefined) ex.waiting = ex.waiting.filter((w) => w !== id);
    else if (canEnter(ctx, id)) {
      ex.waiting = ex.waiting.filter((w) => w !== id);
      // queued, so the year's room decides when it is played (drain)
      if (!life.pending.includes(id)) life.pending.push(id);
    }
  }
}

// ---------- convergences ----------


/** Open now (the world events of its row), not yet passed this life, and the character is on a continent it touches. */
export function canEnter(ctx: Ctx, id: NodeId): boolean {
  const life = lifeOf(ctx);
  const p = indexOf(ctx).cv.get(id);
  if (!life || !p || life.passed[id] !== undefined) return false;
  // "ที่" of 00-convergence.md §1 is where the convergence takes place: the row that hands the life over takes the
  // character there, so the place is not a gate (link rows carry their own place conditions)
  return !p.open || test(ctx, p.open);
}

/** Plays a convergence, as the replacement of a row or as a node of its own. */
function enterCv(ctx: Ctx, id: NodeId, row: StoryNodeX | undefined): void {
  const ix = indexOf(ctx);
  const ex = extOf(lifeOf(ctx)!);
  const p = ix.cv.get(id)!;
  const key = play(ctx, ex, ix, p, { standIn: row });
  if (key === undefined) return;
  ex.entryMods = ex.entryMods.filter((m) => m.to !== id);
  if (row) {
    // what the row says about the convergence's outcome (a battle for one way, a bond ...) follows the choice
    ex.cur = { id: row.id, choice: key };
    apply(ctx, normalize(rowNotes(row).post), { sys: 'story', id: row.id });
    delete ex.cur;
  }
}

// ---------- playing a node ----------

interface PlayOpts {
  /** A row whose place this convergence (or the generic table) takes: the log entry carries the row's id. */
  standIn?: StoryNodeX;
  /** The fallback node stands in for this row. */
  replaces?: NodeId;
}

/** Splits notes into what changes the choice (before it) and what follows from it (after it), keeping `if` wrappers. */
export function splitNotes(list: readonly Effect[]): [Effect[], Effect[]] {
  const pre: Effect[] = [];
  const post: Effect[] = [];
  for (const e of list) {
    if (e.k === 'choiceMod' || e.k === 'variant' || e.k === 'entryMod' || e.k === 'nodeWeight') pre.push(e);
    else if (e.k === 'if' || e.k === 'only') {
      const [a, b] = splitNotes(e.then);
      if (a.length) pre.push({ ...e, then: a });
      if (b.length) post.push({ ...e, then: b });
    } else post.push(e);
  }
  return [pre, post];
}

/** Runs of `outcome` effects are one weighted split: turn each run into a `pick`. */
export function normalize(list: readonly Effect[]): Effect[] {
  const out: Effect[] = [];
  let run: Extract<Effect, { k: 'outcome' }>[] = [];
  const flush = () => {
    if (run.length) out.push({ k: 'pick', of: run.map((o) => ({ weight: o.weight, label: o.label, effects: normalize(o.effects) })) });
    run = [];
  };
  for (const e of list) {
    if (e.k === 'outcome') {
      run.push(e);
      continue;
    }
    flush();
    if (e.k === 'if' || e.k === 'only' || e.k === 'chance') out.push({ ...e, then: normalize(e.then) });
    else if (e.k === 'pick') out.push({ ...e, of: e.of.map((b) => ({ ...b, effects: normalize(b.effects) })) });
    else out.push(e);
  }
  flush();
  return out;
}

/** What the log keeps of a way of a rite so the text system need not parse the label: the sub-line or outcome, how it went, its words. */
interface Meta {
  variant: string;
  result?: 'pass' | 'fail';
  text: string;
}

interface Content {
  choices: Choice[];
  /** Pass and fail effects of the rite's sub-line, applied after the way is chosen (`hu.t1`). */
  after?: { pass: Effect[]; fail: Effect[] };
  /** The rite's description of each way it supplied. */
  meta: Map<Choice, Meta>;
}

function contentOf(ctx: Ctx, ix: Index, n: StoryNodeX, pre: readonly Effect[]): Content {
  let choices = n.choices;
  let after: Content['after'];
  const meta = new Map<Choice, Meta>();
  const rite = n.rite ? ix.rites.get(n.rite) : undefined;
  if (rite?.form === 'outcomes') {
    if (!choices.length) {
      const list = rite.outcomes.filter((o) => o.weight !== null);
      choices = list.map((o, i): Choice => ({ key: keyOf(i), weight: o.weight ?? 0, label: o.label, effects: o.effects, mods: o.mods, when: o.when }));
      choices.forEach((c, i) => meta.set(c, { variant: list[i].label, text: list[i].text }));
    }
  } else if (rite) {
    const v = pickVariant(ctx, rite);
    if (v && choices.length) {
      after = { pass: v.pass?.effects ?? [], fail: v.fail?.effects ?? [] };
      choices.forEach((c) => {
        if (c.key !== 'c') meta.set(c, { variant: v.label, result: c.key === 'a' ? 'pass' : 'fail', text: (c.key === 'a' ? v.pass?.text : v.fail?.text) ?? '' });
      });
    } else if (v) {
      choices = [
        { key: 'a', weight: RITE_PASS * 100, label: `${v.label}: ${v.pass?.text ?? ''}`, effects: [...v.effects, ...(v.pass?.effects ?? [])], mods: [] },
        { key: 'b', weight: (1 - RITE_PASS) * 100, label: `${v.label}: ${v.fail?.text ?? ''}`, effects: [...v.effects, ...(v.fail?.effects ?? [])], mods: [] },
      ];
      meta.set(choices[0], { variant: v.label, result: 'pass', text: v.pass?.text ?? '' });
      meta.set(choices[1], { variant: v.label, result: 'fail', text: v.fail?.text ?? '' });
    }
  }
  // a different set of choices under a place or event condition (`variant`)
  const alt = variantOf(ctx, pre);
  return { choices: alt ?? choices, after, meta };
}

function variantOf(ctx: Ctx, list: readonly Effect[]): Choice[] | undefined {
  for (const e of list) {
    if (e.k === 'variant' && e.cond && test(ctx, e.cond)) return e.choices;
    if ((e.k === 'if' || e.k === 'only') && test(ctx, e.cond)) {
      const v = variantOf(ctx, e.then);
      if (v) return v;
    }
  }
  return undefined;
}

/** The sub-line a variant rite uses: the life's blood names it, otherwise one is drawn. */
function pickVariant(ctx: Ctx, rite: Rite): RiteOutcome | undefined {
  const life = lifeOf(ctx)!;
  const named = rite.outcomes.find((o) => life.blood && (life.blood.includes(o.label) || o.label.includes(life.blood)));
  if (named) return named;
  return rite.outcomes.length ? rite.outcomes[ctx.rng('life.story').int(0, rite.outcomes.length - 1)] : undefined;
}

/** `choiceMod`, `entryMod` and `nodeWeight` that act on the weights of this very node. */
function pullOf(ctx: Ctx, ex: StoryExt, n: StoryNodeX, pre: readonly Effect[]): Pull {
  const pull: Pull = { choice: [], entry: [], label: [] };
  const take = (list: readonly Effect[]) => {
    for (const e of list) {
      if (e.k === 'choiceMod') pull.choice.push({ choice: e.choice, cond: e.cond, mul: e.mul });
      else if ((e.k === 'if' || e.k === 'only') && test(ctx, e.cond)) take(e.then);
    }
  };
  take(pre);
  for (const m of ex.entryMods) if (m.to === n.id) pull.entry.push({ choice: m.choice, cond: m.cond, mul: m.mul });
  for (const m of ex.nodeMods) if (m.node === n.id && m.label) pull.label.push({ label: m.label, mul: m.mul });
  return pull;
}

/**
 * Plays a node: picks a way, applies it, applies the notes, writes the log and the memory, follows the links.
 * Returns the key taken (`-` for a node with no choices), or `undefined` when no way is open (the caller skips the node).
 */
function play(ctx: Ctx, ex: StoryExt, ix: Index, n: StoryNodeX, o: PlayOpts): Key | '-' | undefined {
  const life = lifeOf(ctx)!;
  const src: EffectSource = { sys: 'story', id: n.id };
  const [pre, post] = splitNotes(n.notes);
  apply(ctx, pre, src);
  const { choices, after, meta } = contentOf(ctx, ix, n, pre);

  // a way that leads to a convergence that is not open is cut (storylines/README.md §6 rule 6)
  const cut = (c: Choice) => c.effects.some((e) => e.k === 'converge' && !canEnter(ctx, e.to));
  const w = weigh(ctx, choices, pullOf(ctx, ex, n, pre), ex, cut);

  const rng = ctx.rng('life.story');
  let i = -1;
  const forced = ex.force[n.id];
  if (forced) i = choices.findIndex((c, j) => c.key === forced && w.weights[j] > 0);
  if (i < 0) i = rng.weighted(w.weights);
  if (i < 0 && choices.length > 0) return undefined;

  const ch = i >= 0 ? choices[i] : undefined;
  const key: Key | '-' = ch ? ch.key : '-';
  const label = ch ? ch.label : n.title;
  const callback = i >= 0 && w.ties[i];

  ex.cur = { id: n.id, choice: key };
  if (ch) {
    apply(ctx, normalize(ch.effects), src);
    if (after && key !== 'c') apply(ctx, normalize(key === 'a' ? after.pass : after.fail), src);
  }
  apply(ctx, normalize(post), src);
  delete ex.cur;

  const id = o.standIn?.id ?? n.id;
  life.passed[n.id] = key;
  if (o.standIn) life.passed[o.standIn.id] = key;
  life.pending = life.pending.filter((p) => p !== n.id && p !== id);
  remember(ex, ch, post);
  note(life, `${id} ${key} ${label}`);
  yearOf(ex, life).nodes++;

  // the text system reads the way from here: `label` is the cell of the way; `rite` `variant` `result` `text` say what a rite chose
  const how = ch ? meta.get(ch) : undefined;
  write(ctx.state, {
    sys: 'story',
    kind: 'node',
    id,
    data: {
      choice: key,
      label: label.slice(0, 120),
      title: n.title,
      line: o.standIn?.line ?? n.line,
      ...(o.standIn ? { cv: n.id } : {}),
      ...(o.replaces ? { replaces: o.replaces } : {}),
      ...(n.rite ? { rite: n.rite } : {}),
      ...(how ? { variant: how.variant.slice(0, 60), text: how.text.slice(0, 120), ...(how.result ? { result: how.result } : {}) } : {}),
      ties: w.ties.filter(Boolean).length,
      chance: w.ties.some(Boolean),
      callback,
    },
    level: n.godWindow ? 3 : n.kind === 'convergence' ? 2 : 1,
  });

  // a way that says the character dies, dies (the data has no `death` effect for it)
  const cause = deathOf(ctx, ix, n, key, label);
  if (cause) apply(ctx, [{ k: 'death', cause }], src);

  if (n.kind !== 'convergence' && n.kind !== 'fallback') followLinks(ctx, ex, ix, n);
  return key;
}

/** The cause of death a way brings, when it is one that says the character dies (tuning DEATH_WAYS, DEADLY_OUTCOMES); otherwise undefined. */
function deathOf(ctx: Ctx, ix: Index, n: StoryNodeX, key: Key | '-', label: string): string | undefined {
  if (key === '-') return undefined;
  const pick = (w: Way): string => (typeof w === 'string' ? w : w[Math.max(0, ctx.rng('life.story.death').weighted(w.map((x) => x.w)))].id);
  const listed = DEATH_WAYS[`${n.id}.${key}`];
  if (listed) return pick(listed);
  const rite = DEADLY_OUTCOMES[n.id];
  if (rite && label.startsWith(rite.label)) return pick(rite.cause);
  // the closing node of a race line: every way but the one that goes on to the last era (c) is the end of the life
  if (n.stage === 'e' && n.id.endsWith('.e2') && ix.raceLines.has(n.line) && key !== 'c') return 'old';
  return undefined;
}

/** Who and what the node showed the life: the chosen way and the notes name them. */
function remember(ex: StoryExt, ch: Choice | undefined, post: readonly Effect[]): void {
  const r = refsOf(ch?.effects);
  refsOf(post, r);
  for (const id of r.npcs) addOnce(ex.seen.npcs, id);
  for (const id of r.events) addOnce(ex.seen.events, id);
  // the turning points the life chose; a node already walked is found through `passed` (choose.ts metBy)
  for (const id of r.pivots) if (!id.startsWith('ref:')) addOnce(ex.seen.pivots, id);
}

function note(life: LifeState, line: string): void {
  life.memory.push(line.slice(0, 160));
  while (life.memory.length > MEMORY_LINES) life.memory.shift();
}

/** A node that leads into convergences (`links`): when its condition holds and one is open, the life is taken there on a later beat. */
function followLinks(ctx: Ctx, ex: StoryExt, ix: Index, n: StoryNodeX): void {
  const life = lifeOf(ctx);
  const links = ix.linksFrom.get(n.id);
  if (!life || !links) return;
  const open: NodeId[] = [];
  for (const l of links) {
    if (l.cond && !test(ctx, l.cond)) continue;
    for (const to of l.to) if (canEnter(ctx, to) && !open.includes(to)) open.push(to);
  }
  // an effect of the node (`converge`) may have queued one of them already
  if (!open.length || life.pending.some((p) => open.includes(p))) return;
  const rng = ctx.rng('life.story');
  if (LINK_ENTER < 1 && !rng.chance(LINK_ENTER)) return;
  life.pending.push(open[Math.max(0, rng.weighted(open.map((id) => entryWeight(ex, id))))]);
}

// ---------- used by the effect handlers ----------

/** Queues a convergence (`converge`) when it can be entered now. */
export function queueCv(ctx: Ctx, to: NodeId): void {
  const life = lifeOf(ctx);
  if (!life || life.pending.includes(to) || !canEnter(ctx, to)) return;
  life.pending.push(to);
}

/** `jump`: the nodes between this one and the target do not play; the target may come `years` earlier, with a named way. */
export function jumpTo(ctx: Ctx, from: NodeId | undefined, to: NodeId, years: number | undefined, choice: Key | undefined): void {
  const life = lifeOf(ctx);
  if (!life) return;
  const ix = indexOf(ctx);
  const target = ix.nodes.get(to);
  if (!target) return;
  const ex = extOf(life);
  const seq = ix.seq.get(target.line) ?? [];
  const at = seq.findIndex((m) => m.id === to);
  if (at < 0) return;
  const origin = from ? seq.findIndex((m) => m.id === from) : -1;
  for (let k = origin + 1; k < at; k++) if (life.passed[seq[k].id] === undefined) addOnce(ex.skipped, seq[k].id);
  if (years) ex.earlier[to] = years;
  if (choice) ex.force[to] = choice;
  if (!life.pending.includes(to)) life.pending.push(to);
}
