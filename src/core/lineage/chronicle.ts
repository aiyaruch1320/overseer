// The chronicle of the family (docs/systems/llm/07-ending-templates.md §8): one entry for each life, a head and two to four lines of the template
// file. `state.lineage.chronicle` holds them as plain lines: the head ("รุ่นที่ 2 · ชื่อ · ศ.ม. a ถึง b") and then its lines.
import type { Ctx } from '../game';
import { calendarYear, placeName, raceName } from '../text/pick';
import { family, pickFrom } from '../ending/words';
import { CAUSE_WORD, LIMIT } from '../ending/tuning';
import type { EndingCard } from '../ending/types';
import type { SlotValues } from '../text/pick';
import { lx, type HeirSpec } from './state';

/** The lines of the chronicle for a life that just died; written to `lineage.chronicle` by the caller. Uses the templates of family `chronicle`. */
export function chronicleLines(ctx: Ctx, card: EndingCard, heir: HeirSpec | null, threadCount: number, thread: string): string[] {
  const x = lx(ctx.state);
  const life = ctx.state.life!;
  const rec = x.recs.find((r) => r.id === life.id);
  const parent = rec?.parent ? ctx.state.lineage.lives.find((l) => l.id === rec.parent)?.name : undefined;
  const moments = card.moments.map((m) => m.line.replace(/^อายุ \d+: /, ''));
  const slots: SlotValues = {
    generation: card.generation,
    name: card.name,
    race: raceName(ctx, card.race),
    place: placeName(ctx, life.country) ?? '',
    age: card.age,
    cause: CAUSE_WORD[card.group],
    dynasty: x.dynasty || card.name,
    year_death: calendarYear(card.diedYear),
    year_birth: calendarYear(card.bornYear),
    parent,
    m1: moments[0],
    m2: moments[1],
    m3: moments[2],
    titles: card.ending ?? undefined,
    title_n: card.ending ? 1 : undefined,
    heir: heir?.name,
    thread: thread || undefined,
    thread_count: threadCount || undefined,
  };
  const out: string[] = [];
  const local = new Set<string>();
  const add = (group: string, key: string, only?: string[]) => {
    const cands = family(ctx, 'chronicle').filter((t) => t.keys['กลุ่ม'] === group && (!only || only.includes(t.keys['แบบ'])));
    const got = pickFrom(ctx, cands, slots, { key: `${card.life}|chron|${key}`, local, max: LIMIT.chronicleLine });
    if (got) out.push(got.text);
    return !!got;
  };
  add('ชีวิต', 'life');
  if (moments.length >= 3) add('เรื่องที่จด', 'moments');
  if (card.generation === 1) add('รุ่นแรก', 'first');
  else if (heir) add('ผู้สืบ', 'heir');
  else add('สายสิ้น', 'end');
  if (card.ending && out.length < 4) add('ฉายา', 'titles');
  if (card.generation === 1 && heir && out.length < 4) add('ผู้สืบ', 'heir');
  return out;
}

/** Writes the head and the lines of a life to the chronicle of the lineage. */
export function writeChronicle(ctx: Ctx, card: EndingCard, lines: string[]): void {
  ctx.state.lineage.chronicle.push(`${card.generation > 0 ? `รุ่นที่ ${card.generation}` : 'คนใหม่ในโลกเดิม'} · ${card.name} · ศ.ม. ${calendarYear(card.bornYear).toLocaleString('en-US')} ถึง ${calendarYear(card.diedYear).toLocaleString('en-US')}`, ...lines);
}
