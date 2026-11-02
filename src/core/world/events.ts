// Which world events can happen this decade, how likely they are, and what a fired event changes.
import type { Ctx } from '../game';
import { apply, test } from '../rules';
import type { Effect, EventId } from '../types';
import type { WorldEvent } from '../data/types-events';
import { addVar, chainOf, happened, isClosed, varOf, world, year } from './access';
import { FX_STREAM, applyVarChanges, bumpDisturbance, close, moodAll, successorOf } from './core';
import { markOf, tablesOf } from './data';
import { TUNING } from './tuning';

// ---------- the event that is being applied (a `DFC +1` effect does not say which dragon, the event does) ----------

let acting: EventId | null = null;
export const actingEvent = () => acting;

// ---------- state conditions ----------

/** While true, `var` conditions hold: the god's own deeds can stand in for a state condition (god/04-miracles.md rule 7). */
let waiveVars = false;
export const varsWaived = () => waiveVars;

// ---------- chance of an event this decade ----------

export function faithWeight(ctx: Ctx, id: EventId): number {
  let w = 1;
  for (const f of tablesOf(ctx).faith.get(id) ?? []) if (!(f.after && !happened(ctx, f.after))) w *= f.mul;
  return w;
}

/** The multiplier the god, a chain or a story node put on the chance of an event (`eventWeight` effects), 1 when none. */
export function weightOf(ctx: Ctx, id: EventId): number {
  const c = world(ctx).chains;
  const until = c['wuntil:' + id];
  if (until !== undefined && year(ctx) > until) return 1;
  return c['w:' + id] ?? 1;
}

export const isOpened = (ctx: Ctx, id: EventId) => world(ctx).chains['open:' + id] !== undefined;
export const godOpened = (ctx: Ctx, id: EventId) => world(ctx).chains['godopen:' + id] === year(ctx);

/** Does a numeric state condition of the event (the flat `thr` of the data) hold now? */
function thresholdHolds(ctx: Ctx, ev: WorldEvent): boolean {
  return ev.thr.some((t) => {
    const v = readVar(ctx, t.v);
    return v !== undefined && (t.op === '>' ? v > t.n : v < t.n);
  });
}

export function readVar(ctx: Ctx, name: string): number | undefined {
  if (name.length > 1 && name[0] === 'M' && /^M\d+$/.test(name)) return world(ctx).dragons[Number(name.slice(1))]?.mood;
  return varOf(ctx, name);
}

let probing = 0;

/**
 * The id the event would happen as this decade, or undefined: it has happened (a war may come again after `warRepeatYears`), it is closed with
 * no successor, its era or its condition does not hold, it waits for a delay, or it is for the god only. A closed event rolls as its successor.
 */
export function candidateId(ctx: Ctx, ev: WorldEvent): EventId | undefined {
  if (ev.role) return undefined;
  const w = world(ctx);
  const id = isClosed(ctx, ev.id) ? successorOf(ctx, ev.id) : ev.id;
  if (!id) return undefined;
  const y = year(ctx);
  const done = w.happened[id];
  if (done !== undefined && (ev.group !== 'WR' || y - done < tablesOf(ctx).data.rules.warRepeatYears)) return undefined;
  if (w.era < ev.era[0] || w.era > ev.era[1]) return undefined;
  if (ev.group === 'HP' && y < (w.vars.hpBlockUntil ?? 0)) return undefined; // LE-05: the council is split, peace events wait
  if (y < chainOf(ctx, 'delay:' + id, -Infinity)) return undefined;
  const god = godOpened(ctx, ev.id);
  if (TUNING.godOnly.includes(ev.id) && !god) return undefined;
  if (!isOpened(ctx, ev.id) && ev.cond) {
    const before = waiveVars;
    waiveVars = god;
    // a probe from a `phase: near` condition may meet itself through a ring of events: stop at a depth
    const deep = ++probing > 6;
    const ok = !deep && test(ctx, tablesOf(ctx).gate.get(ev.id), { unknown: true });
    probing--;
    waiveVars = before;
    if (!ok) return undefined;
  }
  return id;
}

/** `phase: near` of an event: it could happen on the next roll. */
export function isNear(ctx: Ctx, id: EventId): boolean {
  const ev = tablesOf(ctx).byId.get(id);
  return !!ev && !happened(ctx, id) && candidateId(ctx, ev) !== undefined;
}

/** Chance of the event this decade: the mark's rate, doubled when a numeric state condition holds, times religion, the god's weight, war and keys. */
export function chanceOf(ctx: Ctx, ev: WorldEvent): number {
  const t = tablesOf(ctx);
  const w = world(ctx);
  let boost = 1;
  if (ev.thr.length && (thresholdHolds(ctx, ev) || godOpened(ctx, ev.id))) boost = TUNING.stateBoost;
  boost *= faithWeight(ctx, ev.id) * weightOf(ctx, ev.id);
  if (ev.group === 'WR' && year(ctx) < (w.vars.warUntil ?? 0)) boost *= w.vars.warMul ?? 1; // LE-05
  if (ev.id === 'WR-15') boost *= 1 + (w.lastEraKeys - t.data.rules.keyWeight.from) * t.data.rules.keyWeight.per; // the more keys one side holds, the closer the war
  return t.data.rules.rate[ev.mark] * boost;
}

// ---------- what a fired event changes ----------

function setFlag(ctx: Ctx, id: string, on: boolean) {
  const c = world(ctx).chains;
  if (on) c['flag:' + id] = year(ctx);
  else delete c['flag:' + id];
}

/** Applies effects of the world domain: `grant` and `remove` of a flag mark the world, the rest goes through the shared rules. Chances and picks draw from `world.fx`. */
export function applyWorld(ctx: Ctx, list: readonly Effect[], id: EventId): void {
  const src = { sys: 'world', id, stream: FX_STREAM };
  for (const e of list) {
    switch (e.k) {
      case 'grant':
        if (e.kind === 'flag') {
          if (e.chance === undefined || ctx.rng(FX_STREAM).chance(e.chance)) setFlag(ctx, e.id, true);
        } else apply(ctx, [e], src);
        break;
      case 'remove':
        if (e.kind === 'flag') setFlag(ctx, e.id, false);
        else apply(ctx, [e], src);
        break;
      case 'if':
      case 'only':
        if (test(ctx, e.cond)) applyWorld(ctx, e.then, id);
        break;
      case 'chance':
        if (ctx.rng(FX_STREAM).chance(e.p)) applyWorld(ctx, e.then, id);
        break;
      case 'pick': {
        const i = ctx.rng(FX_STREAM).weighted(e.of.map((b) => b.weight ?? 1));
        if (i >= 0) applyWorld(ctx, e.of[i].effects, id);
        break;
      }
      default:
        apply(ctx, [e], src);
    }
  }
}

/** The effects of an event the world rolled: its own, the outcome it ended with, the changes the variable table gives it, the disturbance it causes. */
export function applyEvent(ctx: Ctx, ev: WorldEvent, outcome?: 0 | 1 | 2): void {
  acting = ev.id;
  try {
    const w = world(ctx);
    if (TUNING.skipEffects.includes(ev.id)) return;
    applyWorld(ctx, ev.effects, ev.id);
    if (ev.outcomes.length) {
      const i = outcome ?? ctx.rng(FX_STREAM).int(0, ev.outcomes.length - 1);
      w.chains['out:' + ev.id] = i + 1;
      applyWorld(ctx, ev.outcomes[i].effects, ev.id);
    }
    applyVarChanges(ctx, ev.id);
    bumpDisturbance(ctx, ev.id);
    const mood = TUNING.moodOfEvent[ev.id];
    if (mood) moodAll(ctx, mood);
    markWar(ctx, ev);
  } finally {
    acting = null;
  }
}

/** A war puts the war flag on the countries its row names for a while (`place` conditions read it). */
function markWar(ctx: Ctx, ev: WorldEvent): void {
  if (ev.group !== 'WR') return;
  const w = world(ctx);
  const t = tablesOf(ctx);
  const cs = [...ev.home.countries, ...ev.home.continents.flatMap((c) => Object.keys(t.data.mainFaiths).filter((k) => k.startsWith(c + '-')))];
  for (const c of cs) {
    const flags = (w.countryFlags[c] ??= []);
    if (!flags.includes('war')) flags.push('war');
    w.chains['warflag:' + c] = year(ctx) + TUNING.warFlagYears;
  }
}

export function expireWarFlags(ctx: Ctx): void {
  const w = world(ctx);
  const y = year(ctx);
  for (const k of Object.keys(w.chains)) {
    if (!k.startsWith('warflag:') || w.chains[k] > y) continue;
    const c = k.slice(8);
    w.countryFlags[c] = (w.countryFlags[c] ?? []).filter((f) => f !== 'war');
    delete w.chains[k];
  }
}

// ---------- effects of the shared grammar the world owns ----------

export function openEvent(ctx: Ctx, id: EventId): void {
  world(ctx).chains['open:' + id] = year(ctx);
}

export function replaceEvent(ctx: Ctx, from: EventId, to: EventId): void {
  const t = tablesOf(ctx);
  close(ctx, from);
  if (t.byId.has(to)) openEvent(ctx, to); // a world event takes the place: it rolls on its own
  else {
    const at = t.idIndex.get(to);
    if (at !== undefined && world(ctx).chains['succ:' + from] === undefined) world(ctx).chains['succ:' + from] = at + 1;
  }
}

export function weighEvent(ctx: Ctx, id: EventId, e: { delta?: number; mul?: number }): void {
  const c = world(ctx).chains;
  let w = c['w:' + id] ?? 1;
  if (e.mul !== undefined) w *= e.mul;
  if (e.delta !== undefined) w *= Math.max(0, 1 + e.delta / 100);
  c['w:' + id] = w;
}

export { addVar, markOf };
