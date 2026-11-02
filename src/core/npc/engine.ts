// The story clock of every NPC slot (docs/lore/npcs/README.md §2.1, succession.md §3, 04-last-era.md §4).
// A slot is a position (the row id); its holder is a person with an age, a lifespan and one story at a time.
//   wait → open (the age clock reaches the holder's adult..elder age, or the row's world event happens)
//   open → done (20% of the lifespan later, or at death): a path a b c is drawn by percent after the cuts
// Holders die of old age; the position then gets a successor (tier 1 and 2 always, tier 3 with 60%).
// Around the clock: newcomers (newcomers.ts), ties between stories (ties.ts), clashes (clash.ts), illness (status.ts).
import { worldYearsPerLifeYear } from '../clock';
import { write } from '../log';
import { apply, test } from '../rules';
import type { Ctx } from '../game';
import type { Rng } from '../rng';
import type { Condition, Effect, GameState, LogLevel } from '../types';
import type { NpcPath, NpcRow, RelationAxis } from '../data/types-npcs';
import { clashAtResolve, clashYear } from './clash';
import { NT_ENDS, lifeOfRow, npcIndex, rowOf, type NpcIndex } from './data';
import { rollNewcomers, stepNewcomers } from './newcomers';
import { fallIll, pathMakesIll, stepSickness } from './status';
import { afterEnd, afterResolve, cutNeeders, stepFollow, type Doer } from './ties';
import { MEET_AGE, MEET_FULL_RATE, OVER_AGE_SHARE, ERA4_FATE, ERA4_LONG_PHASE, ERA4_REROLL_YEARS, MEMORY_LINES, MOVE_RE, NEW_PLAN_MUL, NEW_PLAN_PATH, SUCCESSOR_TWISTS, TIE_BOOST, VANISH_RE, type FateClass } from './tuning';
import { npcState, slotsOf, type NpcSlotX, type PathKey, type Story } from './types';

const u = (rng: Rng, a: number, b: number) => a + rng.next() * (b - a);

// ---------- conditions ----------

/** Evaluates a condition of a path or a cut. Plain `event` atoms are read from the world state here; the rest goes through rules/. */
export function condOK(ctx: Ctx, c: Condition): boolean {
  switch (c.k) {
    case 'and':
      return c.of.every((x) => condOK(ctx, x));
    case 'or':
      return c.of.some((x) => condOK(ctx, x));
    case 'not':
      return !condOK(ctx, c.of);
    case 'event': {
      if (c.outcome || c.phase) return test(ctx, c);
      const w = ctx.state.world;
      let ok = (w.happened[c.id] !== undefined) === c.happened;
      if (c.closed !== undefined) ok = ok && w.closed.includes(c.id) === c.closed;
      return ok;
    }
    default:
      return test(ctx, c);
  }
}

// ---------- holders ----------

export function newStory(openAt: number): Story {
  return { state: 'wait', mode: 'age', openAt, endAt: null, mc: false, cut: [], add: {}, mul: {} };
}

/**
 * Lifespan drawn like sim-npc-fate.mjs: inside the table, but at least a little more than the age the holder already has.
 * A holder older than the table is one of the exceptions of world-time.md §6 (mummies kept by the dust, spirits, sea beasts):
 * he lasts a fraction of one more lifespan, not the few years the plain rule would give.
 */
export function drawSpan(rng: Rng, lo: number, hi: number, age: number): number {
  if (age > hi) return age + hi * (OVER_AGE_SHARE[0] + rng.next() * (OVER_AGE_SHARE[1] - OVER_AGE_SHARE[0]));
  const l = lo + rng.next() * (hi - lo);
  return Math.max(l, age + 1 + rng.next() * 5);
}

/** Years from now until the age clock opens the story (sim-npc-density.mjs holder()). */
export function drawOpenDelay(rng: Rng, adult: number, elder: number, age: number): number {
  return age >= elder ? u(rng, 0, 5) : u(rng, Math.max(0, adult - age), elder - age);
}

function needRow(ctx: Ctx, id: string): NpcRow {
  const r = rowOf(ctx, id);
  if (!r) throw new Error(`no NPC row ${id}`);
  return r;
}

/** Place the first holder of every row (init). */
export function initSlots(ctx: Ctx): void {
  const st = ctx.state;
  const idx = npcIndex(ctx);
  const rng = ctx.rng('npc');
  const now = st.clock.worldYear;
  const slots = slotsOf(st);
  for (const row of idx.file.npcs) {
    const life = lifeOfRow(idx, row);
    const present = rng.chance(row.appearPct / 100) || row.group === 'leader';
    const age = row.age ?? Math.round((life.adult + life.elder) / 2);
    const span = drawSpan(rng, life.lo, life.hi, age);
    const refill = row.succession.tier < 3 || rng.chance(row.succession.refill);
    const delay = drawOpenDelay(rng, life.adult, life.elder, age);
    const story = newStory(now + delay);
    slots[row.id] = {
      holder: row.id,
      alive: present,
      step: 0,
      place: row.country,
      home: row.country,
      rel: {},
      name: row.name,
      gen: 1,
      status: present ? 'alive' : 'absent',
      born: now - age,
      span,
      refill,
      keeper: idx.keepers.has(row.id),
      story,
      evFired: false,
    };
  }
  const nx = npcState(st);
  nx.last = now;
  nx.newcomers = [];
  nx.ntBlock = Math.max(0, Math.floor(now / idx.file.rules.newcomer.everyYears));
  nx.ntEra = String(Math.min(st.world.era, 4));
}

// ---------- log ----------

/** What the main character could hear of an NPC event: same country = news (1), anything else is trace (0). */
export function visible(ctx: Ctx, slot: NpcSlotX): LogLevel {
  const life = ctx.state.life;
  if (!life || life.dead) return 0;
  return slot.place === life.country ? 1 : 0;
}

export function note(ctx: Ctx, slot: NpcSlotX, row: NpcRow, what: string, extra: Record<string, string | number | boolean | null> = {}, level?: LogLevel) {
  const lv = level ?? visible(ctx, slot);
  if (lv === 0 && !npcState(ctx.state).trace && !(ctx.state.life && !ctx.state.life.dead)) return;
  write(ctx.state, {
    sys: 'npc',
    kind: 'npc',
    id: row.id,
    level: lv,
    data: { what, holder: slot.name, gen: slot.gen, role: row.role, place: slot.place ?? row.country, ...extra },
  });
}

/** An age in world years as the human-equivalent life years the player reads (ending-templates slot `age`). */
export function lifeAge(ctx: Ctx, row: NpcRow, worldYears: number): number {
  return Math.max(0, Math.round(worldYears / lifeOfRow(npcIndex(ctx), row).rate));
}

// ---------- paths ----------

interface Cand {
  path: NpcPath;
  w: number;
}

export function candidates(ctx: Ctx, row: NpcRow, slot: NpcSlotX, deathOnly: boolean): Cand[] {
  const s = slot.story;
  const out: Cand[] = [];
  for (const p of row.paths) {
    if (s.cut.includes(p.key)) continue;
    if (p.needsMc && !s.mc) continue;
    if (p.cond && !condOK(ctx, p.cond as Condition)) continue;
    if (row.cuts.some((c) => c.cut === p.key && c.when && condOK(ctx, c.when))) continue;
    if (deathOnly && !p.effects.some((e) => e.k === 'death')) continue;
    const w = Math.max(0, (p.pct + (s.add[p.key] ?? 0)) * (s.mul[p.key] ?? 1));
    if (w > 0) out.push({ path: p, w });
  }
  // README §2.2 2(ค): a boosted path takes TIE_BOOST points, the others give them back in proportion so the total stays
  for (const key of s.boost ?? []) {
    const t = out.find((c) => c.path.key === key);
    if (!t) continue;
    const total = out.reduce((a, c) => a + c.w, 0);
    const rest = total - t.w;
    const add = Math.min(TIE_BOOST, rest);
    if (rest <= 0) continue;
    const f = (rest - add) / rest;
    for (const c of out) c.w = c === t ? c.w + add : c.w * f;
  }
  return out;
}

/** Does the story still have a path that no cut has taken (the follow-up of a tied NPC opens in its place when none is left)? */
export function anyPathLeft(ctx: Ctx, row: NpcRow, slot: NpcSlotX): boolean {
  const s = slot.story;
  return row.paths.some((p) => !s.cut.includes(p.key) && !row.cuts.some((c) => c.cut === p.key && c.when && condOK(ctx, c.when)));
}

/** The share of a draw each path gets, for tests and for the debug page: rest stays fixed, the paths fill the rest of 100%. */
export function pathChances(ctx: Ctx, row: NpcRow, slot: NpcSlotX): Record<PathKey | '-', number> {
  const cand = candidates(ctx, row, slot, false);
  const out: Record<PathKey | '-', number> = { a: 0, b: 0, c: 0, '-': 1 };
  const total = cand.reduce((a, c) => a + c.w, 0);
  if (!total) return out;
  const rest = row.restPct / 100;
  for (const c of cand) out[c.path.key] = (1 - rest) * (c.w / total);
  out['-'] = rest;
  return out;
}

function clampAxis(idx: NpcIndex, axis: RelationAxis, v: number): number {
  const r = idx.file.rules.axes.find((a) => a.axis === axis);
  return r ? Math.max(r.lo, Math.min(r.hi, v)) : v;
}

export function bumpRel(ctx: Ctx, slot: NpcSlotX, axis: RelationAxis, delta: number) {
  const idx = npcIndex(ctx);
  const k = `mc.${axis}`;
  slot.rel[k] = clampAxis(idx, axis, (slot.rel[k] ?? 0) + delta);
}

/** The stories being decided now, so a clash that forces one of their paths in the middle of the draw does not draw it twice. */
const resolving = new Set<string>();
/** Who is behind an end that comes from outside the story (a clash result, a deed): set around the call. */
let pendingDoer: Doer | undefined;

/** Who ends the holder when the path says he dies: the NPC the text names (`ถูก AZ05-1 ...`), the character when he hindered it, else the world. */
function doerOfPath(ctx: Ctx, p: NpcPath, s: Story): Doer {
  if (pendingDoer) return pendingDoer;
  const m = /ถูก\s*([A-Z]{2}\d{2}-\d)/.exec(p.text);
  if (m && slotsOf(ctx.state)[m[1]]) return { kind: 'npc', id: m[1] };
  if (s.mc && p.tags.includes('hinder')) return { kind: 'mc' };
  return { kind: 'event' };
}

function resolve(ctx: Ctx, slot: NpcSlotX, row: NpcRow, byDeath: boolean): void {
  const s = slot.story;
  const rng = ctx.rng('npc.story');
  const year = s.endAt ?? ctx.state.clock.worldYear;
  resolving.add(row.id);
  let chosen: NpcPath | undefined;
  try {
    const draw = (): NpcPath | undefined => {
      if (s.force) return row.paths.find((p) => p.key === s.force);
      const cand = candidates(ctx, row, slot, byDeath);
      return cand.length && (byDeath || !rng.chance(row.restPct / 100)) ? cand[rng.weighted(cand.map((c) => c.w))].path : undefined;
    };
    chosen = draw();
    // combat/07 §2 kind X: the path drawn puts the NPC in the character's way
    if (chosen && s.mc && !byDeath && !s.force && clashAtResolve(ctx, slot, row, chosen.key)) {
      if (slot.status !== 'alive') return; // the clash ended him: the end of the holder closed the story
      chosen = s.force ? row.paths.find((p) => p.key === s.force) : chosen && !s.cut.includes(chosen.key) ? chosen : draw();
    }
  } finally {
    resolving.delete(row.id);
  }
  s.state = 'done';
  s.result = chosen ? chosen.key : '-';
  slot.step = 2;
  slot.path = chosen ? chosen.key : undefined;
  if (!chosen) {
    note(ctx, slot, row, 'end', { path: '-', mc: s.mc, byDeath });
    return;
  }
  const tied = (s.boost?.length ?? 0) > 0 || s.cut.length > 0;
  note(ctx, slot, row, 'end', { path: chosen.key, text: chosen.text, mc: s.mc, pct: chosen.pct, byDeath, ...(tied ? { tied } : {}) });
  applyPath(ctx, slot, row, chosen, year);
  afterResolve(ctx, slot, row, chosen);
}

function applyPath(ctx: Ctx, slot: NpcSlotX, row: NpcRow, p: NpcPath, year: number): void {
  const s = slot.story;
  const idx = npcIndex(ctx);
  const rng = ctx.rng('npc.story');
  // what the path does to the world: only event effects go through the rule layer (a `death` here is the holder's, not the character's)
  const world: Effect[] = p.effects.filter((e) => e.k === 'event' || e.k === 'eventWeight');
  if (world.length) apply(ctx, world, { sys: 'npc', id: row.id, stream: 'npc.story' });
  if (s.mc) {
    for (const a of p.axes) if (!a.toward) bumpRel(ctx, slot, a.axis, a.delta);
    const ally = p.effects.find((e) => e.k === 'pct' && e.text === 'พวกพ้อง');
    if (ally && ally.k === 'pct' && rng.chance(ally.pct / 100)) {
      slot.rel['mc.ally'] = 1;
      note(ctx, slot, row, 'ally', {}, 2);
    }
  }
  const dead = p.effects.find((e) => e.k === 'death');
  if (dead) {
    end(ctx, slot, row, Math.min(year, ctx.state.clock.worldYear), 'dead', dead.k === 'death' && dead.cause ? dead.cause : 'ตาย', { by: doerOfPath(ctx, p, s) });
    return;
  }
  const place = p.effects.find((e) => e.k === 'place');
  // a newcomer's ends are read by hand (data.ts NT_ENDS); the roster rows are read from the words of the path
  const nt = slot.nt ? NT_ENDS[slot.nt.tpl]?.[p.key] : undefined;
  const vanishes = slot.nt ? nt?.[0] === 'gone' : VANISH_RE.test(p.text) && !(place && MOVE_RE.test(p.text));
  if (vanishes) {
    end(ctx, slot, row, Math.min(year, ctx.state.clock.worldYear), 'gone', nt?.[1] ?? 'หายสาบสูญ', { by: doerOfPath(ctx, p, s) });
    return;
  }
  if (place && place.k === 'place' && place.ids.length === 1 && !slot.nt && MOVE_RE.test(p.text) && idx.countries.has(place.ids[0])) {
    const from = slot.place;
    slot.place = place.ids[0];
    note(ctx, slot, row, 'move', { from: from ?? null, to: slot.place }, visible(ctx, slot));
    cutNeeders(ctx, slot, row, true);
  }
  if (pathMakesIll(p.text)) fallIll(ctx, slot, row, year, 'story');
}

// ---------- holder changes ----------

/** The holder dies (`dead`) or vanishes (`gone`); the position gets a successor unless `noSuccessor`. `by`: who is behind it (rule 3 of README §2.2). */
export function end(ctx: Ctx, slot: NpcSlotX, row: NpcRow, year: number, how: 'dead' | 'gone', cause: string, opt: { noSuccessor?: boolean; by?: Doer } = {}): void {
  if (slot.status !== 'alive') return;
  slot.alive = false;
  slot.status = how;
  slot.died = year;
  slot.cause = cause;
  const s = slot.story;
  if (s.state !== 'done') {
    s.state = 'done';
    s.result = s.result ?? '-';
  }
  note(ctx, slot, row, how === 'dead' ? 'die' : 'vanish', { cause, year: Math.round(year), age: lifeAge(ctx, row, year - slot.born) });
  // README §2.2: the paths of tied stories that needed him are cut, and an end that was not old age gives them a follow-up story
  afterEnd(ctx, slot, row, cause === 'ชราภาพ' || cause === 'โรคภัย', opt.by ?? pendingDoer ?? { kind: 'event' });
  if (!opt.noSuccessor) succeed(ctx, slot, row, year);
}

function succeed(ctx: Ctx, slot: NpcSlotX, row: NpcRow, year: number): void {
  if (!slot.refill) return;
  const idx = npcIndex(ctx);
  const rng = ctx.rng('npc');
  const life = lifeOfRow(idx, row);
  const before = slot.status === 'absent' ? '' : slot.name;
  const gen = slot.gen + 1;
  const ally = row.succession.allySuccessor;
  let age = Math.round(u(rng, life.adult, life.elder));
  let name: string;
  if (ally) {
    name = gen === 2 ? ally.name : `${ally.name}ที่ ${gen - 1}`;
    if (gen === 2 && ally.age) age = ally.age;
  } else {
    name = `${row.name}ที่ ${gen}`;
  }
  let twist: string | undefined;
  if (!rng.chance(row.succession.inherit)) twist = SUCCESSOR_TWISTS[rng.int(0, SUCCESSOR_TWISTS.length - 1)];
  if (twist === 'ผู้สืบอ่อนกว่าตำแหน่ง') age = Math.max(Math.round(life.adult), Math.round(age * 0.6));
  const span = drawSpan(rng, life.lo, life.hi, age);
  const story = newStory(year + drawOpenDelay(rng, life.adult, life.elder, age));
  if (twist === 'ผู้สืบมีแผนใหม่') story.mul[NEW_PLAN_PATH] = NEW_PLAN_MUL;
  Object.assign(slot, {
    holder: `${row.id}#${gen}`,
    alive: true,
    status: 'alive',
    gen,
    name,
    born: year - age,
    span,
    died: undefined,
    cause: undefined,
    story,
    twist,
    evGen: undefined,
    step: 0,
    path: undefined,
    rel: {},
    sick: undefined,
    sickEnd: undefined,
    immune: undefined,
    follow: undefined,
    clash: undefined,
    // a successor stays where the position is
    place: slot.home,
  } satisfies Partial<NpcSlotX>);
  note(ctx, slot, row, 'succeed', { from: before || null, age: lifeAge(ctx, row, age), twist: twist ?? null, year: Math.round(year) });
}

// ---------- the clock ----------

export function advanceSlot(ctx: Ctx, slot: NpcSlotX, row: NpcRow, now: number): void {
  for (let guard = 0; guard < 40 && slot.status === 'alive'; guard++) {
    const s = slot.story;
    const tDeath = slot.born + slot.span;
    if (s.state === 'wait' && s.openAt <= now && s.openAt <= tDeath) {
      s.state = 'open';
      s.endAt = Math.min(tDeath, s.openAt + row.clock.window * slot.span);
      slot.step = 1;
      note(ctx, slot, row, 'open', { mode: s.mode, year: Math.round(s.openAt) }, 0);
      continue;
    }
    if (s.state === 'open' && (s.endAt ?? Infinity) <= now) {
      resolve(ctx, slot, row, (s.endAt ?? 0) >= tDeath - 1e-9);
      continue;
    }
    if (tDeath <= now) {
      end(ctx, slot, row, tDeath, 'dead', 'ชราภาพ');
      continue;
    }
    // old age, an illness that ends, a plague; a holder who died is replaced and the new one runs the loop again
    if (stepSickness(ctx, slot, row, now)) continue;
    stepFollow(ctx, slot, row, now);
    break;
  }
}

/**
 * A row whose roster person did not appear (README §1) is a position held by someone without a story. When that holder's time
 * is up the position is filled like any other (succession.md §2: the density of 3.6 stories per country counts the positions).
 */
function relieveAbsent(ctx: Ctx, slot: NpcSlotX, row: NpcRow, now: number): void {
  for (let guard = 0; guard < 20 && slot.status === 'absent'; guard++) {
    const tDeath = slot.born + slot.span;
    if (tDeath > now) return;
    if (!slot.refill) return;
    succeed(ctx, slot, row, tDeath);
  }
}

/** The first of the row's events that happened by `now`: its id and its world year. */
function firstEvent(state: GameState, events: string[], now: number): { id: string; year: number } | undefined {
  let best: { id: string; year: number } | undefined;
  for (const e of events) {
    const y = state.world.happened[e];
    if (y !== undefined && y <= now && (best === undefined || y < best.year)) best = { id: e, year: y };
  }
  return best;
}

function fireEvent(ctx: Ctx, slot: NpcSlotX, row: NpcRow, id: string, y: number): void {
  slot.evFired = true;
  if (slot.status !== 'alive') return;
  slot.evGen = slot.gen;
  const s = slot.story;
  if (s.state === 'wait') {
    s.mode = 'event';
    s.openAt = Math.max(y, slot.born);
  } else if (s.state === 'done') {
    // the holder already told a story of the age clock: the event opens the full one, once per world (README §2.1 item 6)
    const fresh = newStory(y);
    fresh.mode = 'event';
    slot.story = fresh;
    slot.path = undefined;
  } else {
    s.mode = 'event';
  }
  note(ctx, slot, row, 'event', { id, year: y });
}

export function stepWorld(ctx: Ctx): void {
  const st = ctx.state;
  const now = st.clock.worldYear;
  const slots = slotsOf(st);
  for (const id of Object.keys(slots)) {
    const slot = slots[id];
    const row = rowOf(ctx, id);
    if (!row) continue;
    if (slot.status === 'absent') {
      relieveAbsent(ctx, slot, row, now);
      continue;
    }
    if (!slot.evFired && row.clock.open === 'event') {
      const ev = firstEvent(st, row.clock.events, now);
      if (ev) {
        advanceSlot(ctx, slot, row, ev.year);
        fireEvent(ctx, slot, row, ev.id, ev.year);
      }
    }
    advanceSlot(ctx, slot, row, now);
  }
  npcState(st).last = now;
  eraFate(ctx, now);
  stepNewcomers(ctx);
}

// ---------- the last era (04-last-era.md §4) ----------

/** Sub-period of era 4 from the dragons fallen: 4ก DFC 10–11 · 4ข DFC 12–13 (or WR-15 happened) · 4ค DFC 14. */
export function lastEraPhase(state: GameState): '4ก' | '4ข' | '4ค' | null {
  const w = state.world;
  if (w.dfc < 10) return null;
  if (w.dfc >= 14) return '4ค';
  if (w.dfc >= 12 || w.happened['WR-15'] !== undefined) return '4ข';
  if (w.dfc >= 10) return '4ก';
  return null;
}

const PHASE_INDEX = { '4ก': 0, '4ข': 1, '4ค': 2 } as const;
const PHASE_TAG = { '4ก': '4a', '4ข': '4b', '4ค': '4c' } as const;

/** One roll of the table for one holder: returns the outcome. Natural death is not part of it (it is rolled by the age clock first). */
export function fateOutcome(rng: Rng, cls: FateClass, phase: '4ก' | '4ข' | '4ค'): 'stay' | 'moved' | 'dead' | 'gone' {
  const row = ERA4_FATE[cls][PHASE_INDEX[phase]];
  return (['stay', 'moved', 'dead', 'gone'] as const)[rng.weighted(row)];
}

export function fateClass(slot: NpcSlotX, row: NpcRow): FateClass {
  return slot.keeper ? 'keeper' : row.seq === 1 ? 'leader' : 'other';
}

function eraFate(ctx: Ctx, now: number): void {
  const st = ctx.state;
  const nx = npcState(st);
  const phase = lastEraPhase(st);
  if (!phase) return;
  const newPhase = nx.phase !== phase;
  if (newPhase) {
    nx.phase = phase;
    nx.phaseAt = now;
    nx.rollAt = now;
  } else if (now - (nx.phaseAt ?? now) > ERA4_LONG_PHASE && now - (nx.rollAt ?? now) >= ERA4_REROLL_YEARS) {
    nx.rollAt = now;
  } else return;
  const idx = npcIndex(ctx);
  const rng = ctx.rng('npc.fate');
  const slots = slotsOf(st);
  for (const id of Object.keys(slots)) {
    const slot = slots[id];
    if (slot.status !== 'alive') continue;
    const row = needRow(ctx, id);
    const out = fateOutcome(rng, fateClass(slot, row), phase);
    if (out === 'stay') continue;
    if (out === 'moved') {
      const near = (idx.byContinent.get(row.continent) ?? []).filter((c) => c !== slot.place);
      if (near.length) {
        const from = slot.place;
        slot.place = near[rng.int(0, near.length - 1)];
        note(ctx, slot, row, 'move', { from: from ?? null, to: slot.place, cause: 'ยุคปลาย' });
        cutNeeders(ctx, slot, row, true);
      }
      continue;
    }
    end(ctx, slot, row, now, out === 'dead' ? 'dead' : 'gone', out === 'dead' ? 'ยุคปลาย' : 'หายสาบสูญ', { noSuccessor: slot.keeper, by: { kind: 'event' } });
  }
  // succession.md §5: the roll of the fate table is also a roll for the newcomers of the sub-period
  rollNewcomers(ctx, PHASE_TAG[phase]);
}

// ---------- the main character in the zone ----------

/**
 * Once per life year: stories open in the country of the character count as met. A character whose life year crosses many world years
 * (an elf: 4, a vampire: 5) would walk through that many times the stories of a human one, so a story he sees for the first time is met
 * with the chance MEET_FULL_RATE ÷ (world years per life year) (tuning.ts). Clashes of kind T and S roll their yearly chance here too.
 */
export function meetZone(ctx: Ctx): void {
  const st = ctx.state;
  const life = st.life;
  if (!life || life.dead || life.hAge < MEET_AGE) return;
  const slots = slotsOf(st);
  const rate = worldYearsPerLifeYear(life.lifespan, life.race);
  const p = Math.min(1, MEET_FULL_RATE / rate);
  const rng = p < 1 ? ctx.rng('npc.meet') : null;
  for (const id of Object.keys(slots)) {
    const slot = slots[id];
    if (slot.status !== 'alive' || slot.place !== life.country) continue;
    const row = needRow(ctx, id);
    const s = slot.story;
    if (s.state === 'open') {
      if (!s.mc && !s.seen) {
        s.seen = true;
        if (!rng || rng.chance(p)) {
          s.mc = true;
          bumpRel(ctx, slot, 'known', 1);
          note(ctx, slot, row, 'meet', { age: lifeAge(ctx, row, st.clock.worldYear - slot.born) }, 2);
        }
      }
      if (s.mc) s.mcYears = (s.mcYears ?? 0) + 1;
    }
    if (row.clashes.length && slot.status === 'alive') clashYear(ctx, slot, row);
  }
}

/** A story node of the character names this NPC (effect `npc`): the character meets the holder now. Returns false when nobody is there. */
export function meetNamed(ctx: Ctx, id: string): boolean {
  const slot = slotsOf(ctx.state)[id];
  const row = rowOf(ctx, id);
  if (!slot || !row || slot.status !== 'alive') return false;
  const first = !slot.rel['mc.known'];
  if (slot.story.state === 'open') slot.story.mc = true;
  bumpRel(ctx, slot, 'known', 1);
  note(ctx, slot, row, 'meet', { named: true }, 2);
  const life = ctx.state.life;
  if (life && !life.dead && first && row.succession.tier === 1) {
    const line = `พบ${slot.name}${row.role ? ` (${row.role})` : ''}`;
    if (!life.memory.includes(line)) {
      life.memory.push(line);
      while (life.memory.length > MEMORY_LINES) life.memory.shift();
    }
  }
  return true;
}

/**
 * Clash results on an NPC line (effect `npcPath`, combat/07-npc-clashes.md §3.0). `by`: who is behind the result, for the follow-up of
 * the tied stories when the holder dies of it (a result of a clash is the character's doing).
 */
export function adjustPath(ctx: Ctx, id: string, path: PathKey, op: 'force' | 'cut' | 'delay' | 'weight', n: number | undefined, unit: 'add' | 'mul' | 'year' | undefined, by?: Doer): void {
  const slot = slotsOf(ctx.state)[id];
  const row = rowOf(ctx, id);
  if (!slot || !row || slot.status === 'absent') return;
  const s = slot.story;
  if (op === 'cut') {
    if (!s.cut.includes(path)) s.cut.push(path);
  } else if (op === 'weight') {
    if (unit === 'mul') s.mul[path] = (s.mul[path] ?? 1) * (n ?? 1);
    else s.add[path] = (s.add[path] ?? 0) + (n ?? 0);
  } else if (op === 'delay') {
    const years = n ?? 1;
    if (s.state === 'wait') s.openAt += years;
    else if (s.state === 'open' && s.endAt !== null) s.endAt = Math.min(slot.born + slot.span, s.endAt + years);
  } else if (op === 'force') {
    const prev = pendingDoer;
    if (by) pendingDoer = by;
    try {
      if (slot.status === 'alive' && s.state !== 'done') {
        s.force = path;
        if (resolving.has(row.id)) return; // the draw of this very story is under way: it takes the forced path when the clash is over
        if (s.state === 'wait') {
          s.state = 'open';
          slot.step = 1;
        }
        s.endAt = ctx.state.clock.worldYear;
        resolve(ctx, slot, row, false);
      } else {
        // "เกิดโดยปริยาย": the holder is gone or finished, the path still happens around him
        s.force = path;
        const p = row.paths.find((x) => x.key === path);
        s.result = path;
        slot.path = path;
        if (p) {
          note(ctx, slot, row, 'end', { path, text: p.text, mc: s.mc, forced: true });
          const world: Effect[] = p.effects.filter((e) => e.k === 'event' || e.k === 'eventWeight');
          if (world.length) apply(ctx, world, { sys: 'npc', id, stream: 'npc.story' });
        }
      }
    } finally {
      pendingDoer = prev;
    }
  }
}

/** Is the position held by a living person (condition `npc`). */
export function isAlive(ctx: Ctx, id: string): boolean {
  const slot = slotsOf(ctx.state)[id];
  return !!slot && slot.status === 'alive';
}
