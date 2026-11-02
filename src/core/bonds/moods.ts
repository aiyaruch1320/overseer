// Feelings of the character toward his ties (docs/systems/bonds/02-feelings.md): the table of 24 moods by 9 lines, the limits,
// the way a mood fades and what it does to the long-term mind.
import type { Ctx } from '../game';
import { write } from '../log';
import { bondsIndex, moodFloor } from './data';
import { addGrudge } from './people';
import { extOf, isLive, levelOf, tiesOf, type BondsExt, type Tie } from './state';
import { HEAVY_MOODS, MOOD_YEARS, SUBSTITUTE } from './tuning';
import type { LifeState } from '../types';

/** The lowest level of the line for the mood (02 §2), or null when the line never shows it. */
export function floorOf(ctx: Ctx, line: string, mood: string): number | null {
  return moodFloor(ctx, mood, line);
}

/** The moods a line can show at a level, from the table. */
export function moodsOf(ctx: Ctx, line: string, level: number): string[] {
  const ix = bondsIndex(ctx);
  return ix.moods.filter((m) => {
    const f = ix.data.feelings.matrix[m]?.[line];
    return f !== null && f !== undefined && level >= f;
  });
}

/** The mood the line can show for the one asked: itself, or the nearest one the document names (02 §3). */
export function fitMood(ctx: Ctx, line: string, mood: string): string | null {
  for (const m of [mood, ...(SUBSTITUTE[mood] ?? [])]) if (floorOf(ctx, line, m) !== null) return m;
  return null;
}

/**
 * The character shows a mood toward a tie. Returns the mood shown, or null when it is held back: the line cannot show it, the bond is
 * below the level the table asks for, the person already has two moods, or the character already showed two moods toward the line this year
 * (02 §4 rules 2 and 3). A held-back mood is written at level 0 so a test or the debug page can count it.
 */
export function showMood(ctx: Ctx, life: LifeState, t: Tie, mood: string, why: string): string | null {
  const e = extOf(life);
  const lv = levelOf(ctx, t);
  const fit = fitMood(ctx, t.line, mood);
  const block = (reason: string) => {
    e.counts.blocked++;
    write(ctx.state, { sys: 'bonds', kind: 'mood-held', id: t.id, data: { name: t.name, line: t.line, mood, why, reason }, level: 0 });
    return null;
  };
  if (!fit) return block('line');
  const floor = floorOf(ctx, t.line, fit)!;
  if (lv < floor) return block('level');
  t.moods = t.moods.filter((m) => m.until > life.hAge);
  if (e.moodYear.age !== life.hAge) e.moodYear = { age: life.hAge, perLine: {} };
  const limits = bondsIndex(ctx).data.feelings.limits;
  if (t.moods.length >= limits.moodsAtOnce && !t.moods.some((m) => m.mood === fit)) return block('two moods');
  if ((e.moodYear.perLine[t.line] ?? 0) >= limits.perLinePerYear) return block('twice a year');
  e.moodYear.perLine[t.line] = (e.moodYear.perLine[t.line] ?? 0) + 1;
  const years = HEAVY_MOODS.has(fit) ? MOOD_YEARS.heavy : MOOD_YEARS.light;
  const old = t.moods.find((m) => m.mood === fit);
  if (old) old.until = life.hAge + years;
  else t.moods.push({ mood: fit, until: life.hAge + years });
  e.counts.moods++;
  const feelings = bondsIndex(ctx).data.feelings;
  const rule = feelings.heart.find((h) => h.moods.includes(fit));
  if (rule?.bloodFeud && !e.feuds.includes(t.name)) {
    e.feuds.push(t.name);
    addGrudge(ctx, t, 0);
  }
  write(ctx.state, { sys: 'bonds', kind: 'mood', id: t.id, data: { name: t.name, line: t.line, mood: fit, asked: mood, level: lv, why }, level: 1 });
  return fit;
}

/** Once a year: moods fade (02 §4 rule 4) and the ones still held move the long-term mind by the table of 02 §5. */
export function moodYear(ctx: Ctx, life: LifeState, e: BondsExt): void {
  const by = bondsIndex(ctx).data.feelings.heartByMood;
  let sum = 0;
  for (const t of tiesOf(e)) {
    if (!isLive(t) || !t.moods.length) continue;
    t.moods = t.moods.filter((m) => m.until > life.hAge);
    for (const m of t.moods) sum += by[m.mood] ?? 0;
  }
  const toward = e.mind > 0 ? -1 : e.mind < 0 ? 1 : 0;
  e.mind = Math.max(-10, Math.min(10, e.mind + sum + toward));
}
