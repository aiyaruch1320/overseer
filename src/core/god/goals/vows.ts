// The vows of the god (08-goals.md §2): offered at the birth of the character (three, weighted ×3 for those that fit the question, the origin or the
// omen of the life), taken by the player, changed once at the age stop of 15, judged when the character dies.
// Offering draws from its own seed stream `god.vow`, so the same seed and the same lineage offer the same vows (G6b "เสร็จเมื่อ").
import type { Ctx } from '../../game';
import { write } from '../../log';
import type { LifeState } from '../../types';
import { peopleCode, questionOf } from '../../text';
import { godData } from '../state';
import { badFates, factsOf, type Facts } from './facts';
import { lifeGoals, living, metaOf, peekGoals, peekLife } from './state';
import { BORN_FITS, CHANGE_AT, ELDER_AGE, ERA4_FROM, FIT_MUL, HEIR_FORM_NAME, HEIR_FORM_RACES, OFFER, QUESTION_WORDS, SET_ONE_LAST, SIGN_FITS, SPECIAL_FITS, VOW_NUMBERS } from './tuning';
import { unlocked } from './unlocks';
import { charOf } from './facts';

export const NO_VOW = 'GV-20';

export interface VowRow {
  id: string;
  name: string;
  done: string;
  set: number;
  selfJudged: boolean;
}

export const vowRows = (ctx: Ctx): VowRow[] => godData(ctx).goals.vows;
export const vowRow = (ctx: Ctx, id: string): VowRow | undefined => vowRows(ctx).find((v) => v.id === id);

/** The name of a vow for this life (GV-05 speaks of a successor for the races that have no blood line). */
export function vowName(ctx: Ctx, id: string, race?: string): string {
  const row = vowRow(ctx, id);
  if (!row) return id;
  return id === 'GV-05' && race && HEIR_FORM_RACES.includes(race) ? HEIR_FORM_NAME : row.name;
}

// ---------- the judgement: one test for each vow ----------

/** `true` when the vow is kept. The tests read the facts of the life at death (facts.ts); the three the god system judges itself are in the data (`selfJudged`). */
export const JUDGE: Record<string, (f: Facts) => boolean> = {
  'GV-01': (f) => f.natural && f.hAge >= ELDER_AGE,
  'GV-02': (f) => !f.battle && f.curses === 0 && f.belief >= 0,
  'GV-03': (f) => f.where === f.born && f.continents.length > 1,
  'GV-04': (f) => f.continents.length >= VOW_NUMBERS.continents,
  'GV-05': (f) => f.heir,
  'GV-06': (f) => f.love >= VOW_NUMBERS.loverLevel,
  'GV-07': (f) => f.rivalFell,
  'GV-08': (f) => f.forgave,
  'GV-09': (f) => f.secret || f.legend || f.cv >= VOW_NUMBERS.legendCv,
  'GV-10': (f) => !f.secret && f.cv === 0 && f.kind >= VOW_NUMBERS.kind,
  'GV-11': (f) => f.peak >= VOW_NUMBERS.belief,
  'GV-12': (f) => f.interventions <= VOW_NUMBERS.interventions,
  'GV-13': (f) => f.badFate,
  'GV-14': (f) => f.wasBound && f.freed && !f.boundNow,
  'GV-15': (f) => f.dragon,
  'GV-16': (f) => !f.homeLost,
  'GV-17': (f) => f.built,
  'GV-18': (f) => f.keySide,
  'GV-19': (f) => f.belief <= VOW_NUMBERS.hate && f.hAge >= ELDER_AGE,
  'GV-20': () => true,
};

export type VowResult = 'kept' | 'broken' | 'none';

/** The result of a vow for a dead life, from the facts of its life (`factsOf`). */
export function judge(ctx: Ctx, life: LifeState, vow: string | null, f: Facts = factsOf(ctx, life)): VowResult {
  if (!vow || vow === NO_VOW) return 'none';
  const test = JUDGE[vow];
  return test && test(f) ? 'kept' : 'broken';
}

// ---------- what can be offered to this life ----------

/** Why a vow cannot be offered to this life, or null (08-goals.md §2 "ข้อที่เป็นไปไม่ได้กับตัวละครนี้ไม่ขึ้น"). */
export function impossible(ctx: Ctx, life: LifeState, id: string): string | null {
  const t = peekLife(life).track;
  switch (id) {
    case 'GV-13':
      return badFates(ctx, life).length ? null : 'ไม่มีชะตาร้ายให้เปลี่ยน';
    case 'GV-14':
      return t.boundAtBirth || (life.ext.bondage as { level?: number } | undefined)?.level ? null : 'ไม่ได้เป็นผู้ถูกผูกตัว';
    case 'GV-16':
      return (ctx.state.world.countryFlags[life.home] ?? []).some((f) => f === 'god_ruin' || f === 'fallen') ? 'ประเทศเกิดเป็นซากแล้ว' : null;
    case 'GV-18': {
      const w = ctx.state.world;
      const reaches = w.era >= 4 || (w.era === 3 && life.birthYear + life.lifespan >= ERA4_FROM);
      return reaches && !w.ended ? null : 'ชีวิตนี้ไม่ซ้อนยุค 4';
    }
    case 'GV-12':
    case 'GV-20':
    default:
      return null;
  }
}

/** The vows that may be drawn now: the set the lineage has opened, and those the life can do. */
export function pool(ctx: Ctx, life: LifeState): string[] {
  const second = unlocked(ctx).vowSet2;
  return vowRows(ctx)
    .filter((v) => v.id !== NO_VOW && (second || Number(v.id.slice(3)) <= SET_ONE_LAST) && !impossible(ctx, life, v.id))
    .map((v) => v.id);
}

/** The vows that fit the life: its question, how it began, the omen of its birth (08-goals.md §2). Pure. */
export function fits(ctx: Ctx, life: LifeState): Set<string> {
  const out = new Set<string>();
  const c = charOf(life);
  const add = (ids: readonly string[] | undefined) => ids?.forEach((i) => out.add(i));
  if (c) {
    add(SIGN_FITS[c.sign]);
    if (c.special) add(SPECIAL_FITS[c.special]);
    add(BORN_FITS[c.born]);
  }
  // the question of the life is the one the text system tells at birth (it is the question of the people of the race)
  const text = ctx.data.races ? questionOf(ctx.data, peopleCode(ctx, life.race)) : '';
  for (const [word, ids] of QUESTION_WORDS) if (text.includes(word)) add(ids);
  return out;
}

/** Draws `n` vows from `ids`, weighted, without repeating: from the stream `god.vow`. */
function draw(ctx: Ctx, ids: string[], fit: Set<string>, n: number): string[] {
  const rng = ctx.rng('god.vow');
  const left = [...ids];
  const out: string[] = [];
  for (let k = 0; k < n && left.length; k++) {
    const i = rng.weighted(left.map((id) => (fit.has(id) ? FIT_MUL : 1)));
    if (i < 0) break;
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

/** Offers the vows to a newborn life (the `birth` hook). */
export function offer(ctx: Ctx, life: LifeState): string[] {
  const g = lifeGoals(life);
  g.offers = draw(ctx, pool(ctx, life), fits(ctx, life), OFFER);
  g.reoffers = [];
  g.vow = null;
  g.decided = false;
  g.changed = false;
  ctx.state.god.vows = [];
  return g.offers;
}

/** At the age stop of 15 a second set is drawn, for the one change (08-goals.md "เปลี่ยนได้ครั้งเดียวที่จุดหยุดอายุ 15"). Assumption: a new draw, not the old three. */
export function reoffer(ctx: Ctx, life: LifeState): string[] {
  const g = lifeGoals(life);
  if (g.reoffers.length || g.changed) return g.reoffers;
  g.reoffers = draw(ctx, pool(ctx, life), fits(ctx, life), OFFER);
  return g.reoffers;
}

// ---------- the choice of the player ----------

export interface Pick {
  /** 1 to N for a vow of the list on the table, N + 1 (or 0) for no vow. */
  n: number;
}

/** The list the player picks from now, or an empty list when no choice is open. */
export function table(ctx: Ctx, life: LifeState): { ids: string[]; phase: 'first' | 'change' | null } {
  const g = peekLife(life);
  if (life.hAge === CHANGE_AT && !g.changed) return { ids: g.reoffers.length ? g.reoffers : g.offers, phase: 'change' };
  if (!g.decided && life.hAge < CHANGE_AT) return { ids: g.offers, phase: 'first' };
  return { ids: [], phase: null };
}

/** The id the number names; `null` for "no vow"; `undefined` for a number that names nothing. */
export function idOfPick(ids: string[], n: number): string | null | undefined {
  if (n === 0 || n === ids.length + 1) return null;
  return Number.isInteger(n) && n >= 1 && n <= ids.length ? ids[n - 1] : undefined;
}

export function checkPick(ctx: Ctx, args: Record<string, unknown>): string | null {
  const life = living(ctx);
  if (!life) return 'ไม่มีตัวละครที่มีชีวิต';
  const t = table(ctx, life);
  if (!t.phase) return peekLife(life).decided ? `เปลี่ยนคำปฏิญาณได้ครั้งเดียวที่อายุ ${CHANGE_AT} เท่านั้น` : `เลือกคำปฏิญาณได้ตั้งแต่เกิดจนถึงอายุ ${CHANGE_AT}`;
  if (!t.ids.length) return 'ไม่มีคำปฏิญาณให้เลือกในชีวิตนี้';
  const id = idOfPick(t.ids, Number(args.pick));
  if (id === undefined) return `เลือกข้อ 1 ถึง ${t.ids.length} หรือ ${t.ids.length + 1} (ไม่ปฏิญาณ)`;
  return null;
}

export function previewPick(ctx: Ctx, args: Record<string, unknown>): Record<string, unknown> {
  const life = living(ctx)!;
  const g = peekLife(life);
  const t = table(ctx, life);
  const id = idOfPick(t.ids, Number(args.pick));
  const row = id ? vowRow(ctx, id) : undefined;
  const w = peekGoals(ctx.state).meta;
  return {
    phase: t.phase,
    ...(id ? { vow: id, name: vowName(ctx, id, life.race), done: row?.done ?? '', selfJudged: !!row?.selfJudged } : { vow: null, name: 'ไม่ปฏิญาณ' }),
    from: g.vow ? { vow: g.vow, name: vowName(ctx, g.vow, life.race) } : null,
    reward: { kept: godData(ctx).goals.chronicle.vowDone, broken: godData(ctx).goals.chronicle.vowFail },
    once: t.phase === 'change',
    points: w.points,
  };
}

export function runPick(ctx: Ctx, args: Record<string, unknown>, say: (kind: string, id: string, data: Record<string, string | number | boolean | null>) => void): void {
  const life = living(ctx)!;
  const g = lifeGoals(life);
  const t = table(ctx, life);
  const id = idOfPick(t.ids, Number(args.pick)) ?? null;
  const before = g.vow;
  g.vow = id;
  g.decided = true;
  if (t.phase === 'change') g.changed = true;
  ctx.state.god.vows = id ? [id] : [];
  say(t.phase === 'change' ? 'vow.change' : 'vow.take', id ?? NO_VOW, { name: id ? vowName(ctx, id, life.race) : 'ไม่ปฏิญาณ', from: before ? vowName(ctx, before, life.race) : null });
}

/**
 * Writes the line that tells the vows on the table, once, when the first beat or the first act of a policy comes: the name of the character is not in the log when his vows are
 * offered at birth (M4 review M6). A life that comes in grown (an heir of more than 15 years) has no choice open, so nothing is told.
 */
export function tellOffer(ctx: Ctx, life: LifeState): void {
  const g = lifeGoals(life);
  if (g.told) return;
  g.told = true;
  if (!g.offers.length || !table(ctx, life).phase) return;
  write(ctx.state, { sys: 'god', kind: 'vow.offer', id: life.id, data: { ids: g.offers.join(','), names: g.offers.map((i) => vowName(ctx, i, life.race)).join(' · '), n: g.offers.length, name: life.name }, level: 1 });
}

/** The line in the corner of the screen for the whole life: the vow taken, or null (08-goals.md §2 last line). */
export function corner(ctx: Ctx): string | null {
  const life = living(ctx);
  const g = life ? peekLife(life) : undefined;
  return life && g?.vow ? vowName(ctx, g.vow, life.race) : null;
}

/** Vows the lineage has kept at least once (for the collection). */
export const keptEver = (ctx: Ctx): string[] => metaOf(ctx).vowsKept;
