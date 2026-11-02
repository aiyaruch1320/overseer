// Dreams (docs/systems/god/03-dreams.md §1 to §4, G2): the game offers up to three ways the character can really take, the god sends one,
// the character obeys, misreads, refuses or defies when he reaches the node, and a way that goes against his nature weighs on his heart.
// How a dream reaches the story: a dream is rolled once, the year before its node can fire (`armDreams`), and its weights are written into
// `life.ext.story.entryMods`, the list the story already reads when it weighs the ways of a node, so the story needs no change.
// `dreamWeight(ctx, nodeId, key)` is the same weight for a story that would rather ask: it rolls a dream that has not been rolled yet.
import { extOf as charExt, giveId, idx, takeId } from '../character';
import type { Ctx } from '../game';
import { write } from '../log';
import { test } from '../rules';
import { weigh, type Pull } from '../story/choose';
import { canEnter } from '../story/walk';
import { extOf as storyExt } from '../story/state';
import { indexOf } from '../story/data';
import { isNear } from '../world/events';
import type { Choice, Effect, LifeState } from '../types';
import { addBelief, clamp } from './belief';
import { canPay, isImmune, pay, priceOf, type Cost } from './power';
import { choicesOf, upcomingNodes, type Upcoming } from './story-view';
import { bump, count, godData, gx, inWindow, lifeOf, touch, type Dream, type Key } from './state';
import { BURDEN_QUESTION, DREAM_PENDING_MAX, DREAM_WAIT_YEARS, FIT, IMMORAL_WORDS, REASONS, SOURCE_MUL_DEFAULT, SYMBOLS } from './tuning';

export const dreamsOf = (ctx: Ctx): Dream[] => ctx.state.god.dreams as Dream[];

// ---------- the ways ----------

export interface DreamPath {
  node: string;
  choice: Key;
  label: string;
  line: string;
  /** Sources the way comes from (S1 to S8, 03-dreams.md §1), the first being the one the card shows. */
  sources: string[];
  /** The way's share of the node's weight, and what it means for the character (fit: +1 fits, 0 neither, −1 goes against). */
  share: number;
  fit: number;
  immoral: boolean;
  /** hAge the node fires at the soonest. */
  due: number;
  /** The node is a god window (its row names a hint or a gift): the dream costs ×0.7. */
  window: boolean;
  symbol: string;
}

const NO_PULL: Pull = { choice: [], entry: [], label: [] };

function hashOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const effectKinds = (list: readonly Effect[], out: Set<string> = new Set()): Set<string> => {
  for (const e of list) {
    out.add(e.k);
    if (e.k === 'if' || e.k === 'only' || e.k === 'chance') effectKinds(e.then, out);
    else if (e.k === 'pick') for (const b of e.of) effectKinds(b.effects, out);
  }
  return out;
};

const eventsOf = (list: readonly Effect[], out: string[] = []): string[] => {
  for (const e of list) {
    if (e.k === 'event') out.push(e.id);
    else if (e.k === 'if' || e.k === 'only' || e.k === 'chance') eventsOf(e.then, out);
    else if (e.k === 'pick') for (const b of e.of) eventsOf(b.effects, out);
  }
  return out;
};

const npcsOf = (list: readonly Effect[], out: string[] = []): string[] => {
  for (const e of list) {
    if (e.k === 'npc') out.push(e.id);
    else if (e.k === 'npcPath') out.push(e.npc);
    else if (e.k === 'if' || e.k === 'only' || e.k === 'chance') npcsOf(e.then, out);
    else if (e.k === 'pick') for (const b of e.of) npcsOf(b.effects, out);
  }
  return out;
};

/** The sources of a way, read from what it does (03-dreams.md §1). S1 is every way of a node the character reaches within two years. */
function sourcesOf(ctx: Ctx, u: Upcoming, c: Choice): string[] {
  const out: string[] = [];
  const kinds = effectKinds(c.effects);
  const secretJob = c.effects.some((e) => e.k === 'jobpath' && e.secret) || kinds.has('jobpath');
  if (kinds.has('converge')) out.push('S2');
  if (secretJob) out.push('S4');
  if (kinds.has('place') || kinds.has('jump')) out.push('S5');
  const ev = eventsOf(c.effects);
  if (ev.length && ctx.data['world-events'] && ev.some((id) => safeNear(ctx, id))) out.push('S6');
  if (u.line === 'hr') out.push('S7');
  if (kinds.has('bond') || kinds.has('mood') || kinds.has('template') || ['bn', 'kn', 'bd', 'bo', 'ab'].includes(u.line)) out.push('S8');
  const npcs = npcsOf(c.effects);
  if (npcs.length && npcs.some((id) => npcAlive(ctx, id))) out.push('S3');
  return [...(u.queued ? [] : ['S1']), ...out];
}

function safeNear(ctx: Ctx, id: string): boolean {
  try {
    return isNear(ctx, id);
  } catch {
    return false;
  }
}

function npcAlive(ctx: Ctx, id: string): boolean {
  const slots = ctx.state.npcs.slots as Record<string, { alive?: boolean; status?: string }>;
  const s = slots[id];
  return !!s && (s.alive === true || s.status === 'alive');
}

const fitOf = (share: number): number => (share >= FIT.two ? 2 : share >= FIT.one ? 1 : share <= FIT.against ? -1 : 0);

/**
 * Every way the god could send now: the ways of the nodes the character reaches within two life years that are really open to him
 * (the node's own condition holds, the way's condition holds, a way into a closed convergence is cut: the same rules the story uses).
 * Pure: rolls nothing and changes nothing. Ways of nodes that already hold a dream are left out.
 */
export function pathsNow(ctx: Ctx): DreamPath[] {
  const life = lifeOf(ctx);
  if (!life || !ctx.data.storylines) return [];
  const ex = storyExt(life);
  const taken = new Set(dreamsOf(ctx).map((d) => d.node));
  const out: DreamPath[] = [];
  for (const u of upcomingNodes(ctx, DREAM_WAIT_YEARS)) {
    const n = u.node;
    if (taken.has(n.id)) continue;
    if (n.when && !test(ctx, n.when)) continue;
    const choices = choicesOf(n);
    if (choices.length < 2) continue;
    const cut = (c: Choice) => c.effects.some((e) => e.k === 'converge' && !canEnter(ctx, e.to));
    const w = weigh(ctx, choices, NO_PULL, ex, cut).weights;
    const total = w.reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    choices.forEach((c, i) => {
      if (w[i] <= 0) return;
      const share = w[i] / total;
      out.push({
        node: n.id,
        choice: c.key,
        label: c.label,
        line: u.line,
        sources: sourcesOf(ctx, u, c),
        share,
        fit: fitOf(share),
        immoral: IMMORAL_WORDS.some((x) => c.label.includes(x)),
        due: u.due,
        window: !!n.godWindow,
        symbol: SYMBOLS[hashOf(`${n.id}.${c.key}`) % SYMBOLS.length],
      });
    });
  }
  return out;
}

const RARE = ['S2', 'S4', 'S7', 'S8'];
const MID = ['S3', 'S5'];
const dull = (a: DreamPath, b: DreamPath) => JSON.stringify(effectsOf(a)) === JSON.stringify(effectsOf(b));
const effectsOf = (p: DreamPath): unknown => [p.node, p.choice];

/**
 * The three ways the game offers (03-dreams.md §1 "เลือกสามทาง"): the way the character would most likely take at the next node, a way
 * against his nature from S1 to S6, and a way from a rarer source (S2 S4 S7 S8, else S3 or S5). At most two from one source. Pure.
 */
export function offersNow(ctx: Ctx): DreamPath[] {
  const all = pathsNow(ctx);
  if (!all.length) return [];
  const order = (a: DreamPath, b: DreamPath) => a.due - b.due || a.node.localeCompare(b.node) || a.choice.localeCompare(b.choice);
  all.sort(order);
  const soon = all[0].node;
  const here = all.filter((p) => p.node === soon);
  const first = [...here].sort((a, b) => b.share - a.share || order(a, b))[0];
  const picks: DreamPath[] = [first];
  const head = (p: DreamPath) => p.sources[0] ?? 'S1';
  const sameSource = (p: DreamPath) => picks.filter((q) => head(q) === head(p)).length;
  // the way against his nature: the lowest fit, then the lowest share, from S1 to S6 and not the first way
  const against = all
    .filter((p) => !picks.includes(p) && p.sources.some((s) => ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].includes(s)) && sameSource(p) < 2)
    .sort((a, b) => a.fit - b.fit || a.share - b.share || order(a, b))[0];
  if (against && !dull(first, against)) picks.push(against);
  const rare = (list: string[]) =>
    all
      .filter((p) => !picks.includes(p) && p.sources.some((s) => list.includes(s)) && sameSource(p) < 2 && !picks.some((q) => dull(q, p)))
      .sort((a, b) => b.share - a.share || order(a, b))[0];
  const third = rare(RARE) ?? rare(MID);
  if (third) picks.push(third);
  return picks;
}

// ---------- the chance to obey ----------

export interface Obey {
  /** The real chance, 0.05 to 0.95. */
  p: number;
  level: 'เต็มใจ' | 'ลังเล' | 'ขัดขืน';
  /** One or two reasons, the heaviest parts of the formula (03-dreams.md §3 "เหตุผลที่แสดง"). */
  reasons: string[];
  parts: { base: number; belief: number; fit: number; clarity: number; guard: number };
}

/** The level shown for a chance (03-dreams.md §3 table): 0.70 and above willing, 0.40 to 0.69 hesitant, below 0.40 resisting. */
export function levelOf(ctx: Ctx, p: number): Obey['level'] {
  const l = godData(ctx).dreams.levels;
  return p >= l[0].min ? 'เต็มใจ' : p >= l[1].min ? 'ลังเล' : 'ขัดขืน';
}

/**
 * The chance that the character takes the way he dreamt (03-dreams.md §3):
 * 0.30 + belief ÷ 140 + fit + clarity, kept between 0.05 and 0.95. The fit is +0.15 for two traits, +0.05 for one, −0.20 against his nature,
 * −0.30 against his morals. The clarity is (int − 10) × 0.02, +0.10 for `u_oracle`, +0.20 for `nb_god_whisper`, +0.10 for a repeated way,
 * −0.10 for five years after the god punished him. A character who was willing twice and did not obey is willing a third time (+0.15).
 */
export function obeyChance(ctx: Ctx, w: { node: string; choice: Key; fit: number; immoral: boolean }): Obey {
  const o = godData(ctx).dreams.obey;
  const e = gx(ctx);
  const life = lifeOf(ctx)!;
  const fit = w.immoral ? o.fit.immoral : w.fit >= 2 ? o.fit.twoTraits : w.fit === 1 ? o.fit.oneTrait : w.fit < 0 ? o.fit.against : 0;
  const reasons: [number, string][] = [];
  const belief = life.godFaith / o.beliefDiv;
  const sharp = (life.stats.int - 10) * o.clarity.perInt;
  let clarity = sharp;
  if (life.skills.includes('u_oracle')) (clarity += o.clarity.oracle), reasons.push([o.clarity.oracle, REASONS.oracle]);
  if (life.blessings.includes('nb_god_whisper')) (clarity += o.clarity.whisper), reasons.push([o.clarity.whisper, REASONS.whisper]);
  if (e.history.some((h) => h.node === w.node && h.choice === w.choice && life.hAge - h.age <= o.repeatYears)) (clarity += o.clarity.repeat), reasons.push([o.clarity.repeat, REASONS.repeat]);
  if (e.punishedAge !== null && life.hAge - e.punishedAge < o.punishedYears) (clarity += o.clarity.punished), reasons.push([-o.clarity.punished, REASONS.punished]);
  if (w.immoral) reasons.push([-fit, REASONS.immoral]);
  else if (fit < 0) reasons.push([-fit, REASONS.against]);
  else if (fit > 0) reasons.push([fit, REASONS.fits]);
  if (belief > 0.15) reasons.push([belief, REASONS.beliefHigh]);
  if (belief < -0.15) reasons.push([-belief, REASONS.beliefLow]);
  if (sharp >= 0.04) reasons.push([sharp, REASONS.sharp]);
  if (sharp <= -0.04) reasons.push([-sharp, REASONS.dull]);
  let p = clamp(o.base + belief + fit + clarity, o.clamp[0], o.clamp[1]);
  let guard = 0;
  const g = godData(ctx).dreams.luckGuard;
  if (p >= 0.7 && e.willFails >= g.fails) {
    guard = Math.min(o.clamp[1], p + g.bonus) - p;
    p += guard;
    reasons.push([g.bonus, REASONS.guard]);
  }
  reasons.sort((a, b) => b[0] - a[0]);
  return { p, level: levelOf(ctx, p), reasons: reasons.slice(0, 2).map((r) => r[1]), parts: { base: o.base, belief, fit, clarity, guard } };
}

/** The cards the screen shows for a dream: each offered way with the level of his heart, the reasons, and the price (03-dreams.md §2). Pure. */
export function offerCards(ctx: Ctx) {
  return offersNow(ctx).map((p) => {
    const ob = obeyChance(ctx, p);
    const price = dreamPrice(ctx, p.window || inWindow(ctx));
    return { ...p, level: ob.level, reasons: ob.reasons, price: price.faith ?? 0, free: !!price.free };
  });
}

// ---------- sending ----------

export function dreamPrice(ctx: Ctx, window = inWindow(ctx)) {
  return priceOf(ctx, 'dream', { n: count(ctx, 'l.dream'), second: count(ctx, 'y.dream') >= 1, window })!;
}

/** Why the god cannot send this dream now, or null. Does not roll. */
export function checkDream(ctx: Ctx, args: { node?: unknown; choice?: unknown }): string | null {
  if (!lifeOf(ctx)) return 'ไม่มีตัวละครที่ยังมีชีวิต';
  if (isImmune(ctx)) return 'ผู้ถืออาวุธนี้ไม่รับการแทรกแซง';
  const cap = godData(ctx).caps.dreamPerYear;
  if (count(ctx, 'y.dream') >= cap) return 'ส่งฝันครบเพดานของปีนี้แล้ว';
  if (dreamsOf(ctx).length >= DREAM_PENDING_MAX) return 'มีความฝันค้างอยู่ครบสามเรื่องแล้ว';
  const p = pick(ctx, args);
  if (!p) return 'ทางนี้ไม่อยู่ในสามทางที่เกมเสนอ';
  if (!canPay(ctx, dreamPrice(ctx, p.window || inWindow(ctx)))) return 'แสงศรัทธาไม่พอ';
  return null;
}

function pick(ctx: Ctx, args: { node?: unknown; choice?: unknown }): DreamPath | undefined {
  return offersNow(ctx).find((p) => p.node === args.node && p.choice === args.choice);
}

/** What the confirm screen shows for a dream: the way, the level of his heart and why, the price. Does not roll. */
export function previewDream(ctx: Ctx, args: { node?: unknown; choice?: unknown }): Record<string, unknown> {
  const p = pick(ctx, args)!;
  const ob = obeyChance(ctx, p);
  const price = dreamPrice(ctx, p.window || inWindow(ctx));
  return { node: p.node, choice: p.choice, label: p.label, source: p.sources[0] ?? 'S1', symbol: p.symbol, level: ob.level, reasons: ob.reasons, faith: price.faith ?? 0, free: !!price.free, offers: offersNow(ctx).map((o) => `${o.node}.${o.choice}`) };
}

/** Sends a dream: pays, keeps it for the node, writes the chronicle. */
export function sendDream(ctx: Ctx, args: { node?: unknown; choice?: unknown }): Dream {
  const life = lifeOf(ctx)!;
  const p = pick(ctx, args)!;
  const ob = obeyChance(ctx, p);
  const price = dreamPrice(ctx, p.window || inWindow(ctx));
  const cost: Cost = price;
  pay(ctx, cost, `dream:${p.node}`);
  const e = gx(ctx);
  const d: Dream = {
    id: `d${ctx.state.logN}`,
    age: life.hAge,
    year: ctx.state.clock.worldYear,
    node: p.node,
    choice: p.choice,
    source: p.sources[0] ?? 'S1',
    symbol: p.symbol,
    level: ob.level,
    reasons: ob.reasons,
    fit: p.fit,
    immoral: p.immoral,
    against: [],
    mul: godData(ctx).dreams.sources[0]?.mult ?? SOURCE_MUL_DEFAULT,
    paid: { faith: price.faith ?? 0 },
  };
  dreamsOf(ctx).push(d);
  e.history.push({ age: life.hAge, node: p.node, choice: p.choice });
  bump(ctx, 'l.dream');
  bump(ctx, 'y.dream');
  bump(ctx, `l.dream.level.${ob.level}`);
  touch(ctx);
  record(ctx, 'dream', p.node, `sent:${ob.level}`);
  write(ctx.state, { sys: 'god', kind: 'dream', id: p.node, data: { choice: p.choice, source: d.source, symbol: p.symbol, level: ob.level, paid: price.faith ?? 0 }, level: 2 });
  armDreams(ctx);
  return d;
}

function record(ctx: Ctx, kind: string, id: string, result: string): void {
  const life = ctx.state.life;
  ctx.state.god.chronicle.push({ worldYear: ctx.state.clock.worldYear, ...(life ? { hAge: life.hAge, target: life.id } : {}), kind, id, result });
}

// ---------- the node meets the dream ----------

/**
 * Rolls a dream once, when the character reaches the node (03-dreams.md §4): obeys (belief +3), misreads (+1, a near way ×2),
 * refuses (−2) or, with belief at −30 or below, defies (the way ×0.3). Changes belief and heart; `retro` is true when the node has passed
 * and the story did not ask (the dream then only changes the character, not the weights).
 */
export function resolveDream(ctx: Ctx, d: Dream, retro: boolean): NonNullable<Dream['resolved']> {
  if (d.resolved) return d.resolved;
  const life = lifeOf(ctx)!;
  const e = gx(ctx);
  const o = godData(ctx).dreams;
  const ob = obeyChance(ctx, { node: d.node, choice: d.choice, fit: d.fit, immoral: !!d.immoral });
  const willing = ob.p - ob.parts.guard >= 0.7;
  const rng = ctx.rng('god.dream');
  let outcome: 'obey' | 'misread' | 'refuse' | 'defy';
  if (rng.next() < ob.p) {
    outcome = 'obey';
    addBelief(ctx, godData(ctx).belief.dream.obey, 'dream.obey');
    if (willing) e.willFails = 0;
    if (d.fit < 0) againstHeart(ctx, life);
    else if (o.burden.relief > 0) life.heart = Math.max(0, life.heart - o.burden.relief);
    bump(ctx, 'l.dream.obeyed');
  } else {
    if (willing) e.willFails += 1;
    if (life.godFaith >= 0 && rng.chance(o.misreadShare)) {
      outcome = 'misread';
      addBelief(ctx, godData(ctx).belief.dream.misread, 'dream.misread');
      bump(ctx, 'l.dream.misread');
    } else {
      outcome = life.godFaith <= o.defyBelief ? 'defy' : 'refuse';
      addBelief(ctx, godData(ctx).belief.dream.refuse, 'dream.refuse');
      bump(ctx, `l.dream.${outcome}`);
    }
  }
  const r: NonNullable<Dream['resolved']> = { outcome, level: ob.level, p: Math.round(ob.p * 1000) / 1000, retro };
  if (outcome === 'misread') {
    const ix = indexOf(ctx);
    const others = (ix.nodes.get(d.node)?.choices ?? []).filter((c) => c.key !== d.choice);
    if (others.length) r.alt = others[Math.max(0, rng.weighted(others.map((c) => Math.max(0.01, c.weight))))].key;
  }
  d.resolved = r;
  write(ctx.state, { sys: 'god', kind: 'dream', id: d.node, data: { outcome, level: ob.level, p: r.p, source: d.source }, level: 2 });
  return r;
}

/** The multiplier a rolled dream gives to a way of its node (03-dreams.md §4 table `pathMul`). */
function weightOf(ctx: Ctx, d: Dream, choiceKey: string): number {
  const r = d.resolved!;
  const out = godData(ctx).dreams.outcomes;
  switch (r.outcome) {
    case 'obey':
      return choiceKey === d.choice ? d.mul : 1;
    case 'misread':
      return choiceKey === r.alt ? out.find((x) => x.id === 'misread')?.pathMul ?? 2 : 1;
    case 'defy':
      return choiceKey === d.choice ? out.find((x) => x.id === 'defy')?.pathMul ?? 0.3 : 1;
    default:
      return 1;
  }
}

/**
 * The weight a dream gives to a way of a node, for a story that asks (it multiplies the way's weight by it): 1 when no dream waits at the node,
 * and 1 for a dream whose weights are in `entryMods` already. A dream not rolled yet is rolled by the first call.
 */
export function dreamWeight(ctx: Ctx, nodeId: string, choiceKey: string): number {
  if (!ctx.state.life || ctx.state.life.dead) return 1;
  const d = dreamsOf(ctx).find((x) => x.node === nodeId);
  if (!d || d.applied) return 1;
  resolveDream(ctx, d, false);
  d.via = 'story';
  return weightOf(ctx, d, choiceKey);
}

/** Writes the weights of a rolled dream into the story's list of pulls on the ways of a node. */
function applyWeights(ctx: Ctx, d: Dream): void {
  const life = lifeOf(ctx);
  if (!life || !d.resolved || d.applied) return;
  const ex = storyExt(life);
  for (const key of ['a', 'b', 'c'] as const) {
    const mul = weightOf(ctx, d, key);
    if (mul !== 1) ex.entryMods.push({ to: d.node, choice: key, mul });
  }
  d.applied = true;
}

/**
 * Rolls the dreams whose node can fire in the next story step (the node's own age has come by next year, or it waits in the queue) and puts their
 * weights where the story reads them. Called after the story has played a year, and after a dream is sent.
 */
export function armDreams(ctx: Ctx): void {
  const life = lifeOf(ctx);
  if (!life || !ctx.data.storylines) return;
  const ex = storyExt(life);
  const ix = indexOf(ctx);
  for (const d of dreamsOf(ctx)) {
    if (d.resolved || d.via) continue;
    const n = ix.nodes.get(d.node);
    if (!n) continue;
    const lo = Math.max(0, n.age[0] - (ex.earlier[d.node] ?? 0));
    if (life.pending.includes(d.node) || (ex.fire[d.node] ?? lo) <= life.hAge + 1) {
      resolveDream(ctx, d, false);
      applyWeights(ctx, d);
    }
  }
}

// ---------- burden of the heart ----------

/** A dream against his nature was obeyed: +1 on the heart; at the limit a burden event happens and the heart starts again (03-dreams.md §4). */
function againstHeart(ctx: Ctx, life: LifeState): void {
  const b = godData(ctx).dreams.burden;
  life.heart += b.step;
  if (life.heart < b.at) return;
  life.heart = 0;
  bump(ctx, 'l.burden');
  const rng = ctx.rng('god.dream');
  const x = rng.next();
  let what: string;
  if (x < 1 / 3) {
    // he prays a plain question: −8 at the end of the year unless the god answers (then +12 instead)
    gx(ctx).questions.push({ age: life.hAge });
    what = 'question';
  } else if (x < 2 / 3) {
    // he leaves work or home for a season (the job pause and the travel event wait for the economy and travel systems)
    if (!life.flags.includes('burden_flight')) life.flags.push('burden_flight');
    what = 'flight';
  } else {
    what = changeNature(ctx, life) ? 'nature' : 'question';
    if (what === 'question') gx(ctx).questions.push({ age: life.hAge });
  }
  write(ctx.state, { sys: 'god', kind: 'burden', id: what, data: { age: life.hAge }, level: 2 });
}

/** The trait he was pushed against most is gone and its opposite takes its place (03-dreams.md §4 third event). */
function changeNature(ctx: Ctx, life: LifeState): boolean {
  const ix = idx(ctx);
  const rng = ctx.rng('god.dream');
  const opts = life.traits.filter((t) => (ix.traits.get(t)?.conflicts ?? []).some((c) => ix.traits.has(c)));
  if (!opts.length) return false;
  const gone = opts[rng.int(0, opts.length - 1)];
  const cs = ix.traits.get(gone)!.conflicts.filter((c) => ix.traits.has(c));
  takeId(ctx, life, 'trait', gone);
  const to = cs[rng.int(0, cs.length - 1)];
  giveId(ctx, life, 'trait', to);
  write(ctx.state, { sys: 'god', kind: 'burden', id: 'nature', data: { from: gone, to }, level: 2 });
  return true;
}

/** The god answers a prayer the burden asked (03-dreams.md §4 first event): costs light, the belief rises instead of falling. */
export function questionsOpen(ctx: Ctx): number {
  const life = lifeOf(ctx);
  return life ? gx(ctx).questions.filter((q) => q.age === life.hAge).length : 0;
}

export function answerQuestion(ctx: Ctx): boolean {
  const life = lifeOf(ctx);
  const e = gx(ctx);
  const i = e.questions.findIndex((q) => q.age === life?.hAge);
  const cost: Cost = { faith: BURDEN_QUESTION.cost };
  if (!life || i < 0 || !canPay(ctx, cost)) return false;
  pay(ctx, cost, 'burden.answer');
  e.questions.splice(i, 1);
  addBelief(ctx, BURDEN_QUESTION.answered, 'burden.answered');
  bump(ctx, 'l.decision');
  record(ctx, 'burden', 'question', 'answered');
  return true;
}

// ---------- the year ----------

/**
 * Called once a life year, after the story has played the year: dreams whose node has passed are settled (rolled now when the story did not
 * ask), dreams that waited more than two years fade without a penalty, and questions nobody answered cost the belief.
 */
export function settleDreams(ctx: Ctx): void {
  const life = lifeOf(ctx);
  if (!life) return;
  const e = gx(ctx);
  const list = dreamsOf(ctx);
  const ex = life.ext.story as { skipped?: string[] } | undefined;
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i];
    const passed = life.passed[d.node] !== undefined;
    if (passed) {
      const r = resolveDream(ctx, d, true);
      record(ctx, 'dream', d.node, `${d.level}:${r.outcome}`);
      const st = life.ext.story as { entryMods?: { to: string }[] } | undefined;
      if (st?.entryMods) st.entryMods = st.entryMods.filter((m) => m.to !== d.node);
      list.splice(i, 1);
    } else if (life.hAge - d.age > DREAM_WAIT_YEARS || ex?.skipped?.includes(d.node)) {
      record(ctx, 'dream', d.node, 'faded');
      write(ctx.state, { sys: 'god', kind: 'dream', id: d.node, data: { outcome: 'fade' }, level: 1 });
      list.splice(i, 1);
    }
  }
  for (let i = e.questions.length - 1; i >= 0; i--) {
    if (e.questions[i].age < life.hAge) {
      e.questions.splice(i, 1);
      addBelief(ctx, BURDEN_QUESTION.belief, 'burden.question');
    }
  }
  armDreams(ctx);
}

