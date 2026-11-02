// The chronicle of the lineage (08-goals.md §4): a value that only goes up, one line of data for each life. What a life earns when it ends:
// a vow kept +3, broken +1 · each title of the life +1 · each convergence passed, a secret job, a legendary weapon, the end of the world inside the life +2 each ·
// the first life of the lineage in a new world +1. The thresholds that open choices are in unlocks.ts.
import type { Ctx } from '../../game';
import type { LifeState } from '../../types';
import { calendarYear, raceName } from '../../text';
import { godData } from '../state';
import { convergences, legendsHeld, lifeLog, type Facts } from './facts';
import { goalsOf, lifeGoals, type ChronicleLine, type Milestones } from './state';
import { vowName, type VowResult } from './vows';

export function milestonesOf(ctx: Ctx, l: LifeState, f: Facts): Milestones {
  return {
    cv: convergences(l).length,
    secret: l.secretJob ? 1 : 0,
    legend: legendsHeld(lifeLog(ctx)),
    ending: lifeGoals(l).track.ended ? 1 : 0,
  };
}

/** What the life earns, in the parts of the table (the sum is the gain). */
export function gainOf(ctx: Ctx, vow: VowResult, titles: number, m: Milestones, firstLife: boolean): { vow: number; titles: number; milestones: number; first: number; total: number } {
  const c = godData(ctx).goals.chronicle;
  const v = vow === 'kept' ? c.vowDone : vow === 'broken' ? c.vowFail : 0;
  const t = titles * c.perTitle;
  const ms = (m.cv + m.secret + m.legend + m.ending) * c.perMilestone;
  const f = firstLife ? c.firstLife : 0;
  return { vow: v, titles: t, milestones: ms, first: f, total: v + t + ms + f };
}

const VOW_WORD: Record<VowResult, string> = { kept: 'สำเร็จ', broken: 'ไม่เป็นจริง', none: 'ไม่ปฏิญาณ' };

/** The plain reading of a line of the chronicle: who, when, the vow, the titles, the gain. */
export function lineText(ctx: Ctx, l: LifeState, vow: string | null, result: VowResult, titles: string[], gain: number, total: number): string {
  const when = `ศ.ม. ${calendarYear(l.birthYear).toLocaleString('en-US')}–${calendarYear(l.dead?.year ?? l.birthYear).toLocaleString('en-US')}`;
  const v = result === 'none' ? VOW_WORD.none : `คำปฏิญาณ “${vowName(ctx, vow ?? '', l.race)}” ${VOW_WORD[result]}`;
  return `${l.name} (${raceName(ctx, l.race)}) ${when} · ${v}${titles.length ? ` · ฉายา ${titles.join(' ')}` : ''} · พงศาวดาร +${gain} รวม ${total}`;
}

/** Writes the line of a dead life into the chronicle and adds its gain. Returns the line and the points before. */
export function record(ctx: Ctx, l: LifeState, vow: string | null, result: VowResult, titles: string[], f: Facts): { line: ChronicleLine; before: number } {
  const w = goalsOf(ctx.state);
  const m = milestonesOf(ctx, l, f);
  const g = gainOf(ctx, result, titles.length, m, w.lives === 0);
  const before = w.meta.points;
  w.meta.points += g.total;
  const line: ChronicleLine = {
    life: l.id,
    name: l.name,
    race: l.race,
    born: l.birthYear,
    died: l.dead?.year ?? l.birthYear,
    hAge: l.dead?.hAge ?? l.hAge,
    cause: l.dead?.cause ?? '',
    vow: vow && vow !== 'GV-20' ? vow : null,
    vowResult: result,
    titles,
    milestones: m,
    gain: g.total,
    total: w.meta.points,
    text: lineText(ctx, l, vow, result, titles, g.total, w.meta.points),
  };
  w.meta.lines.push(line);
  if (result === 'kept' && vow && !w.meta.vowsKept.includes(vow)) w.meta.vowsKept.push(vow);
  for (const t of titles) if (!w.meta.titlesSeen.includes(t)) w.meta.titlesSeen.push(t);
  w.lives += 1;
  return { line, before };
}
