// The people of the ties: making a person, the bond and its level, the line, the death of a person and the end of a tie.
import type { Ctx } from '../game';
import { write } from '../log';
import { worldYearsPerLifeYear } from '../clock';
import type { Rng } from '../rng';
import type { Race } from '../data/types-character';
import { dataOf } from '../game';
import { personName, peopleCode, registerName } from '../text';
import { bondsIndex, ceilB, floorB } from './data';
import { mirrorAxes, rowOf, slotOf } from './npcs';
import { extOf, isLive, levelOf, reindex, tiesOf, type BondsExt, type Tie } from './state';
import { AGE_GAP, DEATH_AGE, RAPPORT, SAME_RACE } from './tuning';
import type { LifeState } from '../types';

// ---------- races ----------

function races(ctx: Ctx): Race[] {
  return ctx.data.races ? (dataOf<{ races: Race[] }>(ctx, 'races').races) : [];
}

export function raceRow(ctx: Ctx, id: string): Race | undefined {
  return races(ctx).find((r) => r.id === id || r.storyPrefix === id);
}

/** Race ids of the people who live in a country, from the roster (npcs.json) — the people a child would meet there. */
export function neighbours(ctx: Ctx, country: string): string[] {
  if (!ctx.data.npcs) return [];
  const out = new Set<string>();
  for (const n of (dataOf<{ npcs: { country: string; peopleId: string | null }[] }>(ctx, 'npcs').npcs)) {
    if (n.country !== country || !n.peopleId) continue;
    const r = raceRow(ctx, n.peopleId);
    if (r) out.add(r.id);
  }
  return [...out];
}

// ---------- ids and names ----------

function nextId(e: BondsExt): string {
  return `T${e.next++}`;
}

export function genderFor(rng: Rng, race: Race | undefined): 'm' | 'f' | 'n' {
  const g = race?.gender;
  if (!g) return rng.chance(0.5) ? 'm' : 'f';
  const i = rng.weighted([g.m, g.f, g.n]);
  return (['m', 'f', 'n'] as const)[i < 0 ? 0 : i];
}

// ---------- making a person ----------

export interface Spec {
  line: string;
  /** Level the tie starts at (the low end of it, plus the trust bonus), or `b` for an exact value. */
  level?: number;
  b?: number;
  from: string;
  kin?: string;
  light?: boolean;
  /** hAge difference from the character, or a range to draw it from; defaults to the range of the line. */
  gap?: number | [number, number];
  /** `same` (the character's own people), `any` (neighbours of the country) or a race id. */
  race?: 'same' | 'any' | string;
  gender?: 'm' | 'f' | 'n';
  country?: string;
  name?: string;
  bound?: string;
  gratitude?: number;
  trust?: number;
  known?: number;
  /** Do not write the log line of the new tie. */
  quiet?: boolean;
}

export function addTie(ctx: Ctx, life: LifeState, spec: Spec): Tie {
  const e = extOf(life);
  const rng = ctx.rng('bonds.people');
  const country = spec.country ?? life.country;
  let raceId = life.race;
  if (spec.race && spec.race !== 'same') {
    const nb = spec.race === 'any' ? neighbours(ctx, country) : [spec.race];
    if (spec.race === 'any' && nb.length && !rng.chance(SAME_RACE)) raceId = rng.pick(nb);
    else if (spec.race !== 'any') raceId = spec.race;
  }
  const row = raceRow(ctx, raceId);
  const id = nextId(e);
  const gender = spec.gender ?? genderFor(rng, row);
  const people = peopleCode(ctx, raceId);
  const gap = typeof spec.gap === 'number' ? spec.gap : (() => { const g = spec.gap ?? AGE_GAP[spec.line] ?? [-3, 3]; return rng.int(g[0], g[1]); })();
  const age0 = Math.max(0, life.hAge + gap);
  const span = row ? rng.int(row.lifespan[0], row.lifespan[1]) : 75;
  const perYear = row ? span / row.lifeYearDivisor : 1;
  const dieAge = Math.round(Math.max(Math.min(DEATH_AGE.max, DEATH_AGE.mean + rng.gauss() * DEATH_AGE.sd), DEATH_AGE.min, age0 + 2));
  const rawName = spec.name ?? personName(ctx.rng('bonds.names'), { people, gender, continent: country.slice(0, 2) });
  const name = spec.name ?? registerName(ctx, `bond:${life.id}:${id}`, rawName, () => personName(ctx.rng('bonds.names'), { people, gender, continent: country.slice(0, 2) }));
  const level = spec.level ?? 1;
  const b = spec.b ?? Math.min(ceilB(ctx, level), floorB(ctx, level) + 5 * Math.max(0, spec.trust ?? 0));
  const tie: Tie = {
    id, name, line: spec.line, past: [], b: capB({ bound: spec.bound }, b), gratitude: spec.gratitude ?? 0, grudge: 0, known: spec.known ?? 0, trust: spec.trust ?? 0, acc: 0,
    from: spec.from, light: !!spec.light, kin: spec.kin, race: raceId, gender, country, age0, t0: ctx.state.clock.worldYear, perYear, dieAge,
    opened: life.hAge, last: life.hAge, state: 'alive', moods: [], bound: spec.bound, peak: 0, family: age0 >= 25 && rng.chance(0.3), rapport: rng.chance(RAPPORT),
  };
  tie.peak = tie.b;
  e.ties[id] = tie;
  e.counts.ties++;
  reindex(e);
  if (!spec.quiet) tieLog(ctx, tie);
  return tie;
}

/** A B can be at most 59 (level 3) while another owner holds the person (03 §2). */
export function capB(t: { bound?: string }, b: number): number {
  const v = Math.max(0, Math.min(100, Math.round(b)));
  return t.bound ? Math.min(v, 59) : v;
}

export function tieLog(ctx: Ctx, t: Tie): void {
  write(ctx.state, { sys: 'bonds', kind: 'tie', id: t.id, data: { name: t.name, line: t.line, from: t.from, level: levelOf(ctx, t), b: t.b, race: t.race, npc: t.npc ?? null }, level: t.light ? 0 : 1 });
}

// ---------- age and death of a person ----------

/** hAge of a tie's person now. */
export function hAgeOf(ctx: Ctx, t: Tie): number {
  if (t.npc) {
    const slot = slotOf(ctx, t.npc);
    if (slot) return ((ctx.state.clock.worldYear - slot.born) * 75) / Math.max(1, slot.span);
  }
  return t.age0 + (ctx.state.clock.worldYear - t.t0) / Math.max(0.01, t.perYear);
}

// ---------- the bond ----------

/**
 * Changes B by a delta for a cause (a key of bonds/01 §2.1 or a story node). Writes `bonds/level` when the level moves
 * ("every change of level has a scene that tells why", 04 §4 rule 2). Axes follow: every +10 of B the person is known one more (01 §2.0).
 */
export function changeB(ctx: Ctx, t: Tie, delta: number, why: string): number {
  if (!isLive(t) || delta === 0) return t.b;
  const ix = bondsIndex(ctx);
  const before = ix.levelOf(t.b);
  const b0 = t.b;
  t.b = capB(t, t.b + delta);
  t.peak = Math.max(t.peak, t.b);
  if (t.b > b0) {
    t.acc += t.b - b0;
    while (t.acc >= ix.data.ties.npcAxes.knownPerB) {
      t.acc -= ix.data.ties.npcAxes.knownPerB;
      t.known = Math.min(ix.data.ties.npcAxes.knownMax, t.known + 1);
    }
  }
  const after = ix.levelOf(t.b);
  if (after !== before) {
    write(ctx.state, { sys: 'bonds', kind: 'level', id: t.id, data: { name: t.name, line: t.line, from: before, to: after, why, b: t.b }, level: t.light ? 0 : 1 });
  }
  sync(ctx, t);
  return t.b;
}

export function setB(ctx: Ctx, t: Tie, b: number, why: string): void {
  changeB(ctx, t, b - t.b, why);
}

/** The person's own axes mirrored to the roster slot, if he is one. */
export function sync(ctx: Ctx, t: Tie): void {
  if (!t.npc) return;
  const slot = slotOf(ctx, t.npc);
  if (slot) mirrorAxes(slot, { trust: t.trust, favor: t.gratitude, grudge: t.grudge, known: t.known });
}

export function addGratitude(ctx: Ctx, t: Tie, n: number): void {
  t.gratitude = Math.max(0, Math.min(5, t.gratitude + n));
  sync(ctx, t);
}

export function addGrudge(ctx: Ctx, t: Tie, n: number): void {
  t.grudge = Math.max(0, Math.min(5, t.grudge + n));
  sync(ctx, t);
}

// ---------- the line ----------

export function setLine(ctx: Ctx, t: Tie, line: string, why: string): void {
  if (t.line === line) return;
  t.past.push(t.line);
  const from = t.line;
  t.line = line;
  reindex(extOf(ctx.state.life!));
  write(ctx.state, { sys: 'bonds', kind: 'line', id: t.id, data: { name: t.name, from, to: line, why, level: levelOf(ctx, t) }, level: 1 });
}

// ---------- the end of a tie ----------

export type EndWay = 'death' | 'fade' | 'split' | 'betray' | 'goodEnd';

/** A tie ends (bonds/01 §5). Death keeps the name in the book; the other ways keep it too, but nobody appears from it again. */
export function endTie(ctx: Ctx, t: Tie, way: EndWay, why: string, opt: { cause?: string } = {}): void {
  if (!isLive(t)) return;
  const life = ctx.state.life;
  const e = life ? extOf(life) : undefined;
  const lv = levelOf(ctx, t);
  const ix = bondsIndex(ctx);
  t.state = way === 'death' ? 'dead' : way === 'fade' ? 'faded' : 'ended';
  if (way === 'death') t.died = { age: Math.round(hAgeOf(ctx, t)), year: ctx.state.clock.worldYear, cause: opt.cause ?? 'old' };
  if (e) {
    e.counts.ends++;
    if (way === 'death') e.counts.deaths++;
    e.party = e.party.filter((x) => x !== t.id);
    e.pairs.forEach((p) => {
      if (p.tie === t.id && way === 'death') p.status = 'memorial';
      else if (p.tie === t.id && (way === 'split' || way === 'betray')) p.status = 'single';
    });
    reindex(e);
  }
  const rule = ix.data.ties.endings.find((x) => x.id === way);
  if (way === 'split') t.b = rule?.setB ?? 0;
  if (way === 'betray') {
    t.b = Math.max(0, t.b + (rule?.deltaB ?? ix.data.ties.npcAxes.betrayB));
    addGrudge(ctx, t, ix.data.ties.npcAxes.betrayGrudge);
  }
  write(ctx.state, { sys: 'bonds', kind: 'end', id: t.id, data: { name: t.name, line: t.line, way, why, level: lv, cause: opt.cause ?? null }, level: lv >= 3 && way !== 'fade' ? 1 : 0 });
  if (t.npc) sync(ctx, t);
}

/** Does a tie still have a living person behind it (roster position with the same holder, or a person under his own death age)? */
export function personAlive(ctx: Ctx, t: Tie): boolean {
  if (t.npc) {
    const slot = slotOf(ctx, t.npc);
    return !!slot && slot.status === 'alive' && slot.gen === t.gen;
  }
  return true;
}

export function rowName(ctx: Ctx, id: string): string {
  return rowOf(ctx, id)?.name ?? id;
}

/** Natural years of one of the character's life years in world years, for the character. */
export function lifeYearWorld(life: LifeState): number {
  return worldYearsPerLifeYear(life.lifespan, life.race);
}

export { tiesOf };
