// The page of the vow (docs/systems/llm/07-ending-templates.md §7, god/08-goals.md §2 "ผลตอนตาย"): a kept vow gets a page, a broken one gets the page of
// "คำปฏิญาณที่ไม่เป็นจริง", and the card gets one line. The goals system judged the vow at the death (`lifeGoals(life).result`); this file only tells the result.
// A vow has its own two lines in the doc (`vow_done` `vow_fail`) when the facts for its slots are at hand; the others use the plain page (`vow_fallback`).
import type { Ctx } from '../game';
import { NO_VOW, lifeGoals, vowName } from '../god/goals';
import { extOf as bondsExt, levelOf, tiesOf } from '../bonds';
import { pickHeir } from '../lineage/heir';
import { calendarYear, continentName, fill, placeName, type SlotValues } from '../text/pick';
import type { LifeState, LogEntry } from '../types';
import { ELDER_AGE, LIMIT } from './tuning';
import type { EndingCard } from './types';
import { family, pickFrom } from './words';
import { isHandAct } from './tuning';
import { lx } from '../lineage/state';

type VowPage = NonNullable<EndingCard['vow']>;

const trimTo = (s: string, n: number) => ([...s].length > n ? [...s].slice(0, n - 1).join('') + '…' : s);

/** The slots of the pages of the vows that can be read from the log and the state at death (the others are left out and the plain page tells). */
function slotsOf(ctx: Ctx, life: LifeState, log: LogEntry[], cause: string, mark: string): SlotValues {
  const deadAge = life.dead?.hAge ?? life.hAge;
  const bonds = life.ext.bonds ? bondsExt(life) : undefined;
  const ties = bonds ? tiesOf(bonds) : [];
  const partner = bonds?.partner ? bonds.ties[bonds.partner] : ties.filter((t) => t.line === 'คนรัก').sort((a, b) => b.peak - a.peak)[0];
  const heir = pickHeir(ctx);
  const moves = log.filter((e) => e.sys === 'travel' && e.kind === 'move');
  const places = [life.home, ...moves.map((m) => String(m.data.to))];
  const lands = [...new Set(places.map((c) => continentName(ctx, c)).filter((x): x is string => !!x))];
  const x = lx(ctx.state);
  const mine = ctx.state.god.chronicle.filter((c) => c.worldYear >= (x.recs.find((r) => r.id === life.id)?.startYear ?? life.birthYear) && c.worldYear <= (life.dead?.year ?? ctx.state.clock.worldYear) && isHandAct(c));
  const kids = ties.filter((t) => t.kin === 'child' || t.kin === 'adopted');
  return {
    name: life.name,
    age: deadAge,
    cause,
    place_death: placeName(ctx, life.country) ?? '',
    home: placeName(ctx, life.home) ?? '',
    year: calendarYear(life.dead?.year ?? ctx.state.clock.worldYear).toLocaleString('en-US'),
    age_over: Math.max(0, deadAge - ELDER_AGE),
    age_short: Math.max(0, ELDER_AGE - deadAge),
    continent_n: lands.length,
    continent_list: lands.join(' '),
    continent_last: lands[lands.length - 1] ?? '',
    continent_short: Math.max(0, 4 - lands.length),
    heir: heir?.name ?? '',
    heir_other: Math.max(0, kids.length - 1),
    child_count: kids.length,
    lover: partner?.name ?? '',
    tie_level: partner ? levelOf(ctx, partner) : '',
    tie_max: partner ? levelOf(ctx, partner) : 0,
    years_together: partner ? Math.max(1, (partner.gone?.age ?? deadAge) - partner.opened) : '',
    intervention_n: mine.length,
    over_n: Math.max(0, mine.length - 5),
    world_impact: mark,
  };
}

/** The page and the line of the vow of a life that died; undefined when the life took no vow. */
export function vowPage(ctx: Ctx, life: LifeState, log: LogEntry[], cause: string, markLabel: string): VowPage | undefined {
  const g = lifeGoals(life).result;
  if (!g?.vow || g.vow === NO_VOW || g.result === 'none') return undefined;
  const name = vowName(ctx, g.vow, life.race);
  const kept = g.result === 'kept';
  const slots = slotsOf(ctx, life, log, cause, markLabel);
  const own = family(ctx, kept ? 'vow_done' : 'vow_fail').find((t) => t.keys['คำปฏิญาณ']?.startsWith(g.vow + ' '));
  let lines: string[] | undefined;
  if (own?.lines && own.lines.length >= 2 && !own.lines.some((l) => l.includes('/'))) {
    const filled = own.lines.map((l) => fill(l, slots));
    if (filled.every((l): l is string => l !== null && l !== '')) lines = filled;
  }
  if (!lines) {
    const pick = pickFrom(
      ctx,
      family(ctx, 'vow_fallback').filter((t) => t.keys['ผล'] === (kept ? 'สำเร็จ' : 'ไม่สำเร็จ')),
      { ...slots, vow: name },
      { key: `${life.id}|vow`, max: 200 },
    );
    lines = (pick?.text ?? `คำปฏิญาณ "${name}" ${kept ? 'เป็นจริง' : 'ไม่เป็นจริง'}`).split('\n');
  }
  return {
    id: g.vow,
    name,
    result: kept ? 'kept' : 'broken',
    head: `${kept ? 'คำปฏิญาณที่เป็นจริง' : 'คำปฏิญาณที่ไม่เป็นจริง'} · ${name}`,
    lines,
    line: trimTo(`ปฏิญาณ: ${name} · ${kept ? 'สำเร็จ' : 'ไม่สำเร็จ'}`, LIMIT.vowLine),
  };
}
