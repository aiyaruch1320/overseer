// Tables the world system derives from data/gen/world-events.json once per loaded file (never stored in the state).
import { dataOf, type Ctx } from '../game';
import type { Condition, EventId } from '../types';
import type { Closure, DragonDef, LastEraEvent, Mark, WorldEvent, WorldEventsData, WorldVar } from '../data/types-events';

export interface FaithMul {
  /** `1 + (mul − 1) × share of the event's home that holds the faith` */
  mul: number;
  /** waits for this event to have happened */
  after?: EventId;
}

/** A variable threshold with a duration, tracked decade by decade (`F < 20 นาน 3 ทศวรรษ`). */
export interface HoldDef {
  key: string;
  name: string;
  op: '<' | '>';
  n: number;
  decades: number;
}

export interface Tables {
  data: WorldEventsData;
  byId: Map<EventId, WorldEvent>;
  /** events the decade roll walks: every event that is not a dragon fall, the mourning wave, the hero, an ending or the start state */
  rolled: WorldEvent[];
  dragonOfFall: Map<EventId, number>;
  dragons: DragonDef[];
  closures: Map<EventId, Closure>;
  faith: Map<EventId, FaithMul[]>;
  vars: WorldVar[];
  holds: HoldDef[];
  /** last-era events the decade roll draws for (the countdown scenes and LE-11 follow other events) */
  leRolled: LastEraEvent[];
  /** events whose happening lets a pillar's fall event open without the pillar falling (END-09 through FG-11) */
  leaks: Map<number, EventId[]>;
  /** The condition tree the roll tests: an unreadable alternative (`text`) next to a readable one is dropped, so prose never widens a gate; prose elsewhere does not gate (test with `unknown: true`). */
  gate: Map<EventId, Condition>;
  /** name and mark of every event the world fires: world, branch and last-era */
  info: Map<EventId, { name: string; mark: Mark }>;
  /** ids a successor index points into: world events, then branch events */
  ids: EventId[];
  idIndex: Map<EventId, number>;
  eraOf(dfc: number): number;
}

const cache = new WeakMap<object, Tables>();

export function tablesOf(ctx: Ctx): Tables {
  const d = dataOf<WorldEventsData>(ctx, 'world-events');
  let t = cache.get(d);
  if (!t) {
    t = build(d);
    cache.set(d, t);
  }
  return t;
}

function atomsOf(c: Condition | undefined, out: Condition[] = []): Condition[] {
  if (!c) return out;
  out.push(c);
  if (c.k === 'and' || c.k === 'or') c.of.forEach((x) => atomsOf(x, out));
  else if (c.k === 'not') atomsOf(c.of, out);
  return out;
}

/** Drops the `text` branches of an `or` that has a readable branch (docs: "A (หรือ …)" means A, the bracket is another road the sim never walks). */
export function narrow(c: Condition): Condition {
  if (c.k === 'and') return { k: 'and', of: c.of.map(narrow) };
  if (c.k === 'not') return { k: 'not', of: narrow(c.of) };
  if (c.k !== 'or') return c;
  const of = c.of.map(narrow);
  const read = of.filter((x) => x.k !== 'text');
  return { k: 'or', of: read.length ? read : of };
}

function build(d: WorldEventsData): Tables {
  const byId = new Map(d.events.map((e) => [e.id, e]));
  const dragonOfFall = new Map(d.dragons.map((x) => [x.fallEvent, x.index]));
  const pct = new Map(d.faiths.map((f) => [f.no, f.pct ?? 0]));
  const countries = Object.keys(d.mainFaiths);
  const faith = new Map<EventId, FaithMul[]>();
  for (const e of d.events) {
    const list: FaithMul[] = [];
    for (const w of e.faith) {
      if (w.when) continue; // a weight with a condition of its own words is not read (world-sim.md §1)
      let share: number;
      if (e.home.world) share = (pct.get(w.faith) ?? 0) > 20 ? 1 : 0;
      else {
        const cs = [...e.home.countries, ...e.home.continents.flatMap((c) => countries.filter((k) => k.startsWith(c + '-')))];
        share = cs.length ? cs.filter((c) => d.mainFaiths[c]?.includes(w.faith)).length / cs.length : 0;
      }
      if (share) list.push({ mul: 1 + (w.mul - 1) * share, ...(w.after ? { after: w.after } : {}) });
    }
    if (list.length) faith.set(e.id, list);
  }
  const holds = new Map<string, HoldDef>();
  for (const e of d.events)
    for (const a of atomsOf(e.cond))
      if (a.k === 'var' && a.decades) holds.set(`${a.name}${a.op}${a.n}`, { key: `${a.name}${a.op}${a.n}`, name: a.name, op: a.op, n: a.n, decades: a.decades });
  // a pillar's fall event may name an event that opens it with no fall (END-09 ← FG-11): not a hero or a morph (they make a dragon fall) and not a path of another event
  const leaks = new Map<number, EventId[]>();
  for (const dr of d.dragons) {
    if (!dr.awakeEvent) continue;
    const fall = byId.get(dr.fallEvent);
    const src: EventId[] = [];
    for (const a of atomsOf(fall?.cond)) {
      if (a.k !== 'event' || a.outcome || !a.happened) continue;
      const o = byId.get(a.id);
      if (!o || o.role || o.effects.some((x) => x.k === 'stat' && x.stat === 'DFC')) continue;
      src.push(a.id);
    }
    if (src.length) leaks.set(dr.index, src);
  }
  const ids = [...d.events.map((e) => e.id), ...d.branch.map((b) => b.id)];
  const eras = d.rules.eras;
  return {
    data: d,
    byId,
    rolled: d.events.filter((e) => !e.role),
    dragonOfFall,
    dragons: d.dragons,
    closures: new Map(d.closures.map((c) => [c.trigger, c])),
    faith,
    vars: d.vars,
    holds: [...holds.values()],
    leRolled: d.lastEra.filter((e) => !e.countdown && !e.withEvent),
    leaks,
    gate: new Map(d.events.flatMap((e) => (e.cond ? [[e.id, narrow(e.cond)] as [EventId, Condition]] : []))),
    info: new Map([...d.events, ...d.branch, ...d.lastEra].map((e) => [e.id, { name: e.name, mark: e.mark }])),
    ids,
    idIndex: new Map(ids.map((x, i) => [x, i])),
    eraOf: (dfc) => {
      const f = eras.find((x) => dfc >= x.dfc[0] && dfc <= x.dfc[1]);
      return Math.min(4, f ? f.era : 4);
    },
  };
}

export const markOf = (t: Tables, id: EventId): Mark => t.byId.get(id)?.mark ?? '○';
