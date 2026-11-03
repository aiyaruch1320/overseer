// Things that happen to the world: an event fires, a continent changes shape (closures), a dragon falls, moods move.
// The order of the random draws on the `world` stream is the order of scripts/sim/sim-world.mjs; anything the docs add
// (effect picks, outcomes) draws from `world.fx`, so the two streams never shift each other.
import type { Ctx } from '../game';
import { write } from '../log';
import type { EventId } from '../types';
import type { Mark } from '../data/types-events';
import { NEVER, addVar, chainOf, happened, world, year } from './access';
import { tablesOf } from './data';
import { TUNING } from './tuning';

export const FX_STREAM = 'world.fx';

// ---------- events ----------

/** The branch event that rolls in place of a closed event, if the closures named one. */
export function successorOf(ctx: Ctx, id: EventId): EventId | undefined {
  const n = world(ctx).chains['succ:' + id];
  return n ? tablesOf(ctx).ids[n - 1] : undefined;
}

/** A continent changed shape or a dragon fell: the events the docs list under `ปิด` and `แทนที่` can no longer happen (world-events.md §0.4 rules 1 and 8, §15). */
export function shut(ctx: Ctx, trigger: EventId): void {
  const t = tablesOf(ctx);
  const c = t.closures.get(trigger);
  if (!c) return;
  const w = world(ctx);
  for (const x of c.close) {
    if (!w.closed.includes(x)) w.closed.push(x);
    const r = c.replace.find((p) => p.from === x);
    const at = r ? t.idIndex.get(r.to) : undefined;
    if (at !== undefined && w.chains['succ:' + x] === undefined) w.chains['succ:' + x] = at + 1;
  }
}

/** Closes one event (an effect `op: cut`, `replace`, a pillar whose dragon fell). */
export function close(ctx: Ctx, id: EventId): void {
  const w = world(ctx);
  if (!w.closed.includes(id)) w.closed.push(id);
}

/** Last year an event of that mark happened: the cap of world-events.md §0.2 counts from it. */
export const capFree = (ctx: Ctx, mark: Mark): boolean => year(ctx) - chainOf(ctx, 'cap:' + mark, NEVER) >= tablesOf(ctx).data.rules.capYears[mark];

/**
 * An event happens: closures take effect, the record is written, and a mark starts the cap clock (`cls`).
 * Dragon falls, DR-13 and the mourning wave are free of the cap but still start it (the sim's `fire`).
 */
export function fire(ctx: Ctx, id: EventId, cls?: Mark, data: Record<string, string | number | boolean | null> = {}): void {
  const t = tablesOf(ctx);
  const w = world(ctx);
  const y = year(ctx);
  shut(ctx, id);
  if (w.happened[id] === undefined) w.chains['first:' + id] = y;
  w.happened[id] = y;
  w.chains['n:' + id] = (w.chains['n:' + id] ?? 0) + 1;
  if (cls) w.chains['cap:' + cls] = y;
  const info = t.info.get(id);
  const ending = t.byId.get(id)?.role === 'ending';
  write(ctx.state, {
    sys: 'world',
    kind: 'event',
    id,
    level: ending ? TUNING.endingLevel : TUNING.level[info?.mark ?? '○'],
    data: { name: info?.name ?? id, mark: info?.mark ?? '○', ...data },
  });
}

// ---------- slow variables ----------

/** `once` changes the var table gives (`HP-07 H −40`, `DR-11 F +10`, `fall F +4`), unless the event's own effects already carry that stat. */
export function applyVarChanges(ctx: Ctx, trigger: EventId | 'fall'): void {
  const t = tablesOf(ctx);
  const own = trigger === 'fall' ? [] : (t.byId.get(trigger)?.effects ?? []);
  for (const v of t.vars) {
    for (const c of v.changes) {
      if (c.event !== trigger || c.kind !== 'once') continue;
      if (own.some((e) => e.k === 'stat' && e.stat === v.code)) continue;
      addVar(ctx, v.code === 'TENSION' ? 'tension' : v.code, c.delta);
    }
  }
}

/** The disturbance of a pillar rises when the event digs, drills or blocks its sea lane (`WR-06 ธาลาสซา +10`). */
export function bumpDisturbance(ctx: Ctx, trigger: EventId): void {
  for (const d of tablesOf(ctx).data.disturb) {
    for (const b of d.bumps) if (b.event === trigger) setZ(ctx, d.dragon, (world(ctx).vars['Z:' + d.dragon] ?? 0) + b.delta);
  }
}

export const setZ = (ctx: Ctx, dragon: string, v: number) => {
  world(ctx).vars['Z:' + dragon] = Math.min(100, v);
};

// ---------- dragons ----------

export const moodCap = (ctx: Ctx) => 100 - tablesOf(ctx).data.rules.mourn.capLoss * world(ctx).dfc;
export const liveDragons = (ctx: Ctx): number[] => world(ctx).dragons.flatMap((d, i) => (d.alive ? [i] : []));

/** Every living dragon's mood moves by `d`, never above the cap (DR-11 +40, the LE events ±1 and ±2). */
export function moodAll(ctx: Ctx, d: number): void {
  const cap = moodCap(ctx);
  for (const dr of world(ctx).dragons) if (dr.alive) dr.mood = Math.min(cap, dr.mood + d);
}

function setEra(ctx: Ctx): void {
  const w = world(ctx);
  const t = tablesOf(ctx);
  const era = t.eraOf(w.dfc);
  if (era !== w.era) {
    w.era = era;
    write(ctx.state, { sys: 'world', kind: 'era', id: `era.${era}`, level: 2, data: { era, dfc: w.dfc } });
  }
  for (let k = 2; k <= era; k++) if (w.vars['eraStart' + k] === undefined) w.vars['eraStart' + k] = year(ctx);
}

/**
 * A dragon falls (killed, spent, spent by the god, turned into a person or put to sleep for good). `via` is the mark of its fall event when the
 * event happens with it; `null` when the dragon falls with no event (the god's hand, the last dragon with the ending), then the closures of its
 * fall event still apply. DFC rises, the era follows, DR-15 happens and the mourning wave moves every living dragon.
 */
export function fall(ctx: Ctx, i: number, via: Mark | null, opts: { fireEvent?: boolean } = {}): void {
  const t = tablesOf(ctx);
  const w = world(ctx);
  const def = t.dragons[i];
  const rules = t.data.rules;
  w.dragons[i].alive = false;
  w.dfc++;
  w.chains['fall:' + i] = year(ctx);
  if (def.awakeEvent) close(ctx, def.awakeEvent); // the dragon was the anchor of its awakening (world-events.md §0.4 rule 8)
  if (!via) shut(ctx, def.fallEvent);
  setEra(ctx);
  const withEvent = !!via && opts.fireEvent !== false && !happened(ctx, def.fallEvent);
  if (withEvent) fire(ctx, def.fallEvent, via!, { dragon: i });
  // the fall itself, for the scene of a dragon's end (appearance/11-world-changes.md §3: fall.<n>) also when no event carries it (the god's hand, the last dragon)
  const home = t.byId.get(def.fallEvent)?.home;
  write(ctx.state, {
    sys: 'world',
    kind: 'dragonFall',
    id: w.dragons[i].id,
    level: 2,
    data: { dragon: i, name: def.name, place: home?.countries[0] ?? home?.continents[0] ?? '', event: withEvent ? def.fallEvent : null },
  });
  fire(ctx, 'DR-15');
  applyVarChanges(ctx, 'fall');
  addVar(ctx, 'F.A', rules.mourn.faithA); // channel-A faith +10 for five years (decays at the next decade)
  // the mourning wave (dragon-mood.md): −3 to −5 by closeness, the closest sibling −8, the cap of every dragon is DFC-based (moodCap)
  const r = ctx.rng('world');
  const m = rules.mourn;
  for (let j = 0; j < w.dragons.length; j++) {
    const dj = w.dragons[j];
    if (!dj.alive) continue;
    let d = m.moodMin + r.next() * (m.moodMax - m.moodMin);
    if (def.pair === j) d = m.moodClosest;
    if (def.pair === null) d += TUNING.loneMournExtra;
    dj.mood -= d;
  }
}

/** HP-08 `DFC −1`: the dragon of the heir comes back. */
export function revive(ctx: Ctx): void {
  const w = world(ctx);
  const dr = w.dragons[TUNING.revive.dragon];
  if (!dr || dr.alive) return;
  dr.alive = true;
  dr.mood = TUNING.revive.mood;
  w.dfc = Math.max(0, w.dfc - 1);
  setEra(ctx);
  delete w.chains['fall:' + TUNING.revive.dragon];
}

