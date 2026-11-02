// The conditions, effects and numbers of the world domain, registered with the shared rules when this module is imported
// (src/core/README.md). Owned here: conditions event era var stance place · effects event replace eventWeight · stats dfc DFC H T D F P tension keys ...
// Not owned: character, story and npc kinds, and the combinators (rules/).
import type { Ctx } from '../game';
import { onCond, onEffect, onStat, type StatHandler } from '../rules';
import { addVar, clamp, countHappened, happened, isClosed, outcomeOf, since, varOf, world, year } from './access';
import { FX_STREAM, fall, liveDragons, moodAll, moodCap, revive, close } from './core';
import { markOf, tablesOf } from './data';
import { actingEvent, isNear, openEvent, readVar, replaceEvent, varsWaived, weighEvent } from './events';
import { placeHolds } from './place';
import { TUNING } from './tuning';
import { write } from '../log';

// ---------- conditions ----------

onCond('event', (ctx, c) => {
  let ok: boolean;
  if (c.closed !== undefined) return isClosed(ctx, c.id) === c.closed;
  if (c.phase === 'near') ok = isNear(ctx, c.id);
  else if (c.phase === 'running') ok = happened(ctx, c.id) && since(ctx, c.id) <= TUNING.running[markOf(tablesOf(ctx), c.id)];
  else ok = happened(ctx, c.id);
  if (ok && c.outcome) ok = outcomeOf(ctx, c.id) === c.outcome;
  return c.happened ? ok : !ok;
});

onCond('era', (ctx, c) => {
  const era = world(ctx).era;
  return era >= c.min && (c.max === undefined || era <= c.max);
});

onCond('var', (ctx, c) => {
  if (varsWaived()) return true;
  const v = readVar(ctx, c.name);
  if (v === undefined) return false;
  const ok = c.op === '>' ? v > c.n : v < c.n;
  if (!c.decades) return ok;
  const held = world(ctx).chains[`hold:${c.name}${c.op}${c.n}`];
  return held === undefined ? ok : held >= c.decades;
});

onCond('stance', (ctx, c) => {
  const country = ctx.state.life?.country;
  const s = country ? tablesOf(ctx).data.stances[country] : undefined;
  return !!s && c.ids.includes(s);
});

onCond('place', (ctx, c) => placeHolds(ctx, c.kinds));

// ---------- effects ----------

onEffect('event', (ctx, e) => {
  if (e.open) openEvent(ctx, e.id);
  if (e.op === 'cut') close(ctx, e.id);
  else if (e.op === 'delay') world(ctx).chains['delay:' + e.id] = year(ctx) + (e.n ?? 0);
  // no `open` and no `op` = a reference only
});

onEffect('replace', (ctx, e) => replaceEvent(ctx, e.from, e.to));

onEffect('eventWeight', (ctx, e) => weighEvent(ctx, e.id, e));

// ---------- numbers ----------

const plain = (key: string, lo = -Infinity, hi = Infinity): StatHandler => ({
  read: (ctx) => varOf(ctx, key) ?? 0,
  add: (ctx, _n, d) => {
    world(ctx).vars[key] = clamp((varOf(ctx, key) ?? 0) + d, lo, hi);
  },
});

for (const code of ['H', 'T', 'D', 'F', 'P']) onStat(code, plain(code)); // the drift step clamps them into 0..100, an event may push past for a decade (HP-07 H −40)
onStat('tension', plain('tension', 0, 100));
for (const code of ['F.A', 'F.dragon', 'temperature', 'lifespan', 'population.pct']) onStat(code, plain(code));
onStat('SEA', plain('SEA', -2, 3));

const keys: StatHandler = {
  read: (ctx) => world(ctx).lastEraKeys,
  add: (ctx, _n, d) => {
    world(ctx).lastEraKeys = clamp(world(ctx).lastEraKeys + d, 0, 9);
  },
};
onStat('keys', keys);
onStat('K', keys);

/** `DFC +1`: the effect does not say which dragon. The event does (a fall event), or the tuning names the pool, or one dragon (FG-10). */
function felled(ctx: Ctx, delta: number): void {
  const w = world(ctx);
  const t = tablesOf(ctx);
  const id = actingEvent();
  for (let n = 0; n < Math.abs(delta); n++) {
    if (delta < 0) {
      revive(ctx);
      continue;
    }
    if (!id || TUNING.dfcIgnore.includes(id)) continue;
    const ev = t.byId.get(id);
    const live = liveDragons(ctx);
    if (live.length <= 1) return; // the last dragon falls only with the ending
    const pool = TUNING.dfcPool[id];
    const target = TUNING.dfcTarget[id];
    if (target !== undefined) {
      if (!w.dragons[target]?.alive) return;
      close(ctx, t.dragons[target].fallEvent); // the pillar sleeps for good: its fall event does not open
      fall(ctx, target, null);
      return;
    }
    let k: number | undefined;
    if (ev?.role === 'fall' && ev.dragon !== undefined) k = ev.dragon;
    else if (pool) {
      const ok = pool.from.filter((i) => w.dragons[i]?.alive && (!pool.needEra || w.era >= t.dragons[i].minEra));
      if (ok.length) k = ok[Math.floor(ctx.rng(FX_STREAM).next() * ok.length)];
    }
    if (k === undefined) {
      write(ctx.state, { sys: 'world', kind: 'unhandled', id: 'DFC:' + id, level: 0 });
      return;
    }
    if (w.dragons[k].alive) fall(ctx, k, markOf(t, t.dragons[k].fallEvent));
  }
}
const dfc: StatHandler = { read: (ctx) => world(ctx).dfc, add: (ctx, _n, d) => felled(ctx, d) };
onStat('dfc', dfc);
onStat('DFC', dfc);

/** `mood.all` (every living dragon) · `mood.cap.all` (a permanent loss of every cap) · `mood.<i>` (one dragon). */
onStat('mood.', {
  read: (ctx, name) => {
    const live = world(ctx).dragons.filter((d) => d.alive);
    const m = /^mood\.(\d+)$/.exec(name);
    if (m) return world(ctx).dragons[Number(m[1])]?.mood ?? 0;
    return live.length ? live.reduce((a, d) => a + d.mood, 0) / live.length : 0;
  },
  add: (ctx, name, d) => {
    const m = /^mood\.(\d+)$/.exec(name);
    if (name === 'mood.all') moodAll(ctx, d);
    else if (name === 'mood.cap.all') liveDragons(ctx).forEach((i) => addVar(ctx, 'capDrop:' + i, -d));
    else if (m) {
      const dr = world(ctx).dragons[Number(m[1])];
      if (dr?.alive) dr.mood = Math.min(moodCap(ctx), dr.mood + d);
    }
  },
});

/** `happened.HP` = how many events of that group have happened (END-12 needs 2 of the peace events). */
onStat('happened.', { read: (ctx, name) => countHappened(ctx, name.slice('happened.'.length) + '-') });

