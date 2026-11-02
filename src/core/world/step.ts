// One world decade, in the order of runWorld in scripts/sim/sim-world.mjs:
// slow variables → moods → (god hook) → dragons fall by mood → a hero → the events → the fog leak → the last era → the endings.
import type { Ctx } from '../game';
import { test } from '../rules';
import type { LastEraEvent } from '../data/types-events';
import { write } from '../log';
import { NEVER, chainOf, clamp, happened, world, year } from './access';
import { applyEvent, candidateId, chanceOf, faithWeight, readVar, weightOf } from './events';
import { capFree, fall, fire, liveDragons, moodAll, moodCap } from './core';
import { runPhase } from './hooks';
import { markOf, tablesOf, type Tables } from './data';
import { TUNING } from './tuning';

export function worldDecade(ctx: Ctx): void {
  const w = world(ctx);
  if (w.ended) return;
  const f0 = w.vars.F;
  drift(ctx);
  moods(ctx);
  runPhase('afterDrift', ctx);
  falls(ctx);
  hero(ctx);
  rollEvents(ctx);
  leak(ctx);
  lastEra(ctx);
  endings(ctx);
  // every country's faith moves with the world's
  const df = (w.vars.F ?? f0) - f0;
  if (df) for (const c of Object.keys(w.countryFaith)) w.countryFaith[c] = clamp(w.countryFaith[c] + df, 0, 100);
}

// ---------- slow variables ----------

function drift(ctx: Ctx): void {
  const t = tablesOf(ctx);
  const w = world(ctx);
  const r = ctx.rng('world');
  for (const v of t.vars) {
    if (v.start === null) continue; // tension between the continents has no drift without the pairs of world-politics.md
    const key = v.code;
    if (v.halts.some((e) => happened(ctx, e))) continue;
    // a change the table calls `แทน` takes the place of the drift (FG-11 D +1.2 · MC-09 P −3)
    const swap = v.changes.filter((c) => c.kind === 'drift' && happened(ctx, c.event)).pop();
    const d = swap ? swap.delta : v.drift;
    if (!d && !v.noise) continue;
    const noise = v.noise ? r.gauss() * v.noise : 0;
    w.vars[key] = clamp((w.vars[key] ?? 0) + d + noise, v.min, v.max);
  }
  for (const z of t.data.disturb) {
    if (z.stopEvents.some((e) => happened(ctx, e))) continue;
    w.vars['Z:' + z.dragon] = clamp((w.vars['Z:' + z.dragon] ?? z.start) + z.drift + r.gauss() * z.noise, 0, 100);
  }
  w.vars.tension = clamp((w.vars.tension ?? 0) + TUNING.tension.drift, 0, 100);
  w.vars['F.A'] = 0; // the five years of channel-A faith after a fall are over
  // thresholds that must hold for several decades in a row
  for (const h of t.holds) {
    const v = readVar(ctx, h.name);
    const ok = v !== undefined && (h.op === '>' ? v > h.n : v < h.n);
    w.chains['hold:' + h.key] = ok ? (w.chains['hold:' + h.key] ?? 0) + 1 : 0;
  }
}

function moods(ctx: Ctx): void {
  const t = tablesOf(ctx);
  const w = world(ctx);
  const r = ctx.rng('world');
  const cap = moodCap(ctx);
  const faith = w.vars.F / TUNING.faithRef;
  w.dragons.forEach((dr, i) => {
    if (!dr.alive) return;
    const move = TUNING.recover * (cap - dr.mood) * faith - t.dragons[i].decay * TUNING.stress;
    dr.mood = Math.min(cap - (w.vars['capDrop:' + i] ?? 0), dr.mood + move + r.gauss() * TUNING.moodNoise);
  });
}

// ---------- dragons ----------

/** The mark of a dragon's fall event: ⭐ for the pillars and four elders, ● for the rest. */
const fallMark = (t: Tables, i: number) => markOf(t, t.dragons[i].fallEvent);

function falls(ctx: Ctx): void {
  const t = tablesOf(ctx);
  const w = world(ctx);
  const r = ctx.rng('world');
  const order = w.dragons.map((_, i) => i).sort((a, b) => w.dragons[a].mood - w.dragons[b].mood);
  for (const i of order) {
    const dr = w.dragons[i];
    if (!dr.alive || dr.mood >= TUNING.fallBelow) continue;
    if (liveDragons(ctx).length === 1) continue; // the last dragon falls only together with the end of the world
    const def = t.dragons[i];
    if (w.era < def.minEra) continue; // the docs gate the falls of the elders by era
    if (dr.mood < TUNING.fallSure || r.next() < Math.min(1, TUNING.fallChance * faithWeight(ctx, def.fallEvent) * weightOf(ctx, def.fallEvent))) fall(ctx, i, fallMark(t, i));
  }
}

/** DR-13: a hero kills a legend dragon, any era; likelier once a dragon has fallen (its bone forges the spear). */
function hero(ctx: Ctx): void {
  const t = tablesOf(ctx);
  const w = world(ctx);
  const r = ctx.rng('world');
  const hc = t.data.rules.hero;
  if (!(r.next() < (w.dfc === 0 ? hc.before : hc.after))) return;
  const live = liveDragons(ctx);
  if (live.length <= 1) return;
  const weights = live.map((i) => 100 - w.dragons[i].mood + TUNING.heroBase);
  let x = r.next() * weights.reduce((a, b) => a + b, 0);
  let k = 0;
  while (x > weights[k]) {
    x -= weights[k];
    k++;
  }
  fire(ctx, 'DR-13', '●');
  fall(ctx, live[k], fallMark(t, live[k]));
}

/** END-09 can open through FG-11 while the fog pillar still lives: no fall, no mourning wave (world-events.md §0.4 rule 10). */
function leak(ctx: Ctx): void {
  const t = tablesOf(ctx);
  const w = world(ctx);
  const r = ctx.rng('world');
  for (const [i, src] of t.leaks) {
    const id = t.dragons[i].fallEvent;
    if (!src.some((s) => happened(ctx, s)) || happened(ctx, id) || !w.dragons[i].alive) continue;
    if (r.next() < t.data.rules.rate['⭐'] * faithWeight(ctx, id) && capFree(ctx, '⭐')) {
      fire(ctx, id, '⭐');
      w.dragons[i].mood -= TUNING.leakMood;
    }
  }
}

// ---------- events ----------

function rollEvents(ctx: Ctx): void {
  const t = tablesOf(ctx);
  const r = ctx.rng('world');
  const cand: { ev: (typeof t.rolled)[number]; p: number; id: string }[] = [];
  for (const ev of t.rolled) {
    const id = candidateId(ctx, ev);
    if (id) cand.push({ ev, p: chanceOf(ctx, ev), id });
  }
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [cand[i], cand[j]] = [cand[j], cand[i]];
  }
  for (const { ev, p, id } of cand) {
    if (r.next() >= p) continue;
    if (!capFree(ctx, ev.mark) || (id !== ev.id && happened(ctx, id))) continue; // two closed events can share one successor
    // an event of an older rank may have been closed between the list and the roll by an event of this very decade
    fire(ctx, id, ev.mark);
    if (id !== ev.id) continue; // a successor has none of the effects below
    if (ev.id === 'WR-15') {
      const x = ctx.rng('world.le').next();
      const lean = t.data.rules.lean;
      const k = x < lean[0].chance ? 0 : x < lean[0].chance + lean[1].chance ? 1 : 2;
      applyEvent(ctx, ev, k as 0 | 1 | 2);
      world(ctx).chains['out:WR-15'] = k + 1;
    } else applyEvent(ctx, ev);
  }
}

// ---------- the last era (branches/04-last-era.md) ----------

function keysOk(le: LastEraEvent, keys: number): boolean {
  if (!le.keysMin) return true;
  // "กุญแจที่รวมได้ ≥ 3 หรือเริ่ม 4ข": the keys are one way in, the start of the phase another
  if (/กุญแจ[^·]*≥\s*\d+\s*หรือ/.test(le.condText)) return true;
  return keys >= le.keysMin;
}

function lastEra(ctx: Ctx): void {
  const w = world(ctx);
  if (w.dfc < 10) return;
  const t = tablesOf(ctx);
  const rl = ctx.rng('world.le');
  const y = year(ctx);
  const ok = (le: LastEraEvent): boolean => {
    if (w.dfc < le.dfc[0] || w.dfc > le.dfc[1]) return false;
    if (le.needs.length && !le.needs.some((n) => happened(ctx, n))) return false;
    if (!keysOk(le, w.lastEraKeys)) return false;
    if (le.cv && !le.cv.every((c) => cvOpen(ctx, c))) return false;
    return le.repeatYears ? y - (w.happened[le.id] ?? NEVER) >= le.repeatYears : !happened(ctx, le.id);
  };
  // who may happen is decided before any of them does: LE-02 cannot follow LE-01 in the same decade
  const open = t.leRolled.filter(ok);
  for (const le of open) {
    if (!(rl.next() < t.data.rules.rate[le.mark])) continue;
    fire(ctx, le.id, undefined, { phase: le.phases.join(' ') });
    feedback(ctx, le, rl);
  }
  if (!happened(ctx, 'LE-11') && happened(ctx, 'WR-15') && w.dfc >= 11) {
    // the decision of the keys is the same scene as the war: same year as WR-15
    fire(ctx, 'LE-11', undefined, { withEvent: 'WR-15' });
    w.happened['LE-11'] = chainOf(ctx, 'first:WR-15');
  }
}

function cvOpen(ctx: Ctx, id: string): boolean {
  const pts = (ctx.data.convergence?.items as { points?: { id: string; open?: Parameters<typeof test>[1] }[] } | undefined)?.points;
  const p = pts?.find((x) => x.id === id);
  return !p?.open || test(ctx, p.open, { unknown: false });
}

/** The state an LE event changes (04-last-era.md §3.1): keys, world faith, moods, the weight of wars, the block on peace. */
function feedback(ctx: Ctx, le: LastEraEvent, rl: ReturnType<Ctx['rng']>): void {
  const w = world(ctx);
  const f = le.feedback;
  const k = f.keys;
  if (k) {
    const max = k.max ?? 9;
    if (k.set !== undefined) w.lastEraKeys = k.set;
    else if (k.alt) w.lastEraKeys = clamp(w.lastEraKeys + (rl.next() < k.alt.chance ? k.alt.delta : (k.delta ?? 0)), 0, max);
    else if (k.delta !== undefined && (k.chance === undefined || rl.next() < k.chance)) w.lastEraKeys = clamp(w.lastEraKeys + k.delta, 0, max);
  }
  if (f.faith) w.vars.F += f.faith;
  if (f.moodAll) moodAll(ctx, f.moodAll);
  if (f.warMul) {
    if ('clear' in f.warMul) {
      w.vars.warUntil = NEVER;
      w.vars.warMul = 1;
    } else {
      w.vars.warUntil = year(ctx) + f.warMul.years;
      w.vars.warMul = f.warMul.mul;
    }
  }
  if (f.hpBlockYears) w.vars.hpBlockUntil = year(ctx) + f.hpBlockYears;
}

// ---------- the endings (world-events.md §13) ----------

function endings(ctx: Ctx): void {
  const t = tablesOf(ctx);
  const w = world(ctx);
  const r = ctx.rng('world');
  const chance = new Map(t.data.rules.endings.map((e) => [e.id, e.chance ?? 0]));
  const lean = w.chains['out:WR-15']; // 1 seal (END-12) · 2 open (END-11) · 3 scatter (END-10)
  const mul = (side: number) => (lean === side ? TUNING.leanMul.match : lean ? TUNING.leanMul.miss : 1);
  const holds = (id: string) => test(ctx, t.byId.get(id)!.cond, { unknown: true });
  let end: string | null = null;
  if (holds('END-12') && r.next() < chance.get('END-12')! * mul(1)) end = 'END-12';
  else if (holds('END-11') && r.next() < chance.get('END-11')! * mul(2)) end = 'END-11';
  else if (holds('END-10')) {
    const last = w.dragons.findIndex((d) => d.alive);
    if (last >= 0) fall(ctx, last, null);
    end = 'END-10';
  }
  if (!end) return;
  fire(ctx, end, '⭐');
  w.ended = { year: year(ctx), id: end };
  w.era = 5;
  // the two countdown scenes of the last era happen ten years before the end
  for (const id of ['LE-10', 'LE-12']) {
    fire(ctx, id);
    w.happened[id] = year(ctx) - 10;
  }
  write(ctx.state, { sys: 'world', kind: 'ending', id: end, level: 3, data: { year: year(ctx), dfc: w.dfc } });
}

