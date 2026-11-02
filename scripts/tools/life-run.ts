// One whole life from birth to death, as readable text (docs/guide/code-plan.md §8.0 "สรุปทั้งชีวิต").
// Same seed and options give the same text. `npm run life` prints it; tests/tools/life.test.ts runs it twice.
import type { GameData } from '../../src/core/game';
import { runAsync, runSync } from './drive';
import { summarizeDeath, type ToolLlm } from './llm';
import { cardOf } from '../../src/core/ending';
import { calendarYear } from '../../src/core/text';
import { cardLines } from '../../src/core/text/ending';
import type { GameState } from '../../src/core/types';
import { godLines, metNpcs, summaryLines, timeline } from './report';
import { afterBeat, createSession, runToDeath, startLife, toolNotes, toolSystems, type SessionOpts } from './session';

export interface LifeRun {
  text: string;
  state: GameState;
  beats: number;
  notes: string[];
}

/** Stops once, at the death, where the end summary may be asked for before the card is laid out. */
function* lifeSteps(data: GameData, opts: SessionOpts & { minLevel?: 0 | 1 | 2 | 3 }): Generator<GameState, LifeRun> {
  const s = createSession(data, opts);
  const g = s.game;
  const worldMark = g.state.logN;
  const life = startLife(s);
  // the policy of the god acts once at the birth and then after every beat (docs/systems/god/06-implementation.md §4)
  const after = () => void afterBeat(s);
  after();
  const beats = runToDeath(g, undefined, after);
  const st = g.state;
  yield st;
  const min = opts.minLevel ?? 1;
  const out: string[] = [];
  out.push(`== ชีวิตหนึ่ง · เมล็ด ${opts.seed}${opts.policy ? ` · นโยบายพระเจ้า ${opts.policy}` : ''} ==`);
  out.push(`ระบบที่ทำงาน: ${toolSystems().systems.map((x) => x.name).join(' ')}`);
  for (const n of s.notes) out.push(`หมายเหตุ: ${n}`);
  out.push(`โลกเดินมาถึง ศ.ม. ${calendarYear(life.birthYear).toLocaleString('en-US')} แล้วตัวละครเกิด`);
  out.push('');
  out.push('-- บันทึก --');
  out.push(...timeline(s.data, st.log, min, { fromN: worldMark, notes: toolNotes(st) }));
  out.push('');
  out.push('-- NPC ที่พบ --');
  const met = metNpcs(s.data, st.log);
  if (!met.length) out.push('(ไม่ได้พบใครที่มีเรื่องเปิดอยู่)');
  for (const m of met) out.push(`  ${m.holder}${m.role ? ` (${m.role})` : ''}${m.place ? ` ที่${m.place}` : ''} · พบเมื่ออายุ ${m.age ?? '?'} ศ.ม. ${m.year.toLocaleString('en-US')}`);
  out.push('');
  out.push('-- สรุป --');
  out.push(...summaryLines(s.data, st, beats));
  // the card of the ending (docs/systems/experience/03-ending-and-collection.md §1), made by the ending system from the log at the death
  const card = cardOf(st);
  if (card) out.push('', '-- การ์ดตอนจบ --', ...cardLines(card));
  const hand = godLines(s.data, st, opts.policy);
  if (hand.length) out.push('', '-- พระหัตถ์ --', ...hand);
  return { text: out.join('\n') + '\n', state: st, beats, notes: s.notes };
}

export function runLifeReport(data: GameData, opts: SessionOpts & { minLevel?: 0 | 1 | 2 | 3 }): LifeRun {
  return runSync(lifeSteps(data, opts));
}

/** The same life with the end summary asked for at the death (`--llm`): the card holds the LLM text when it answers. */
export function runLifeReportLlm(data: GameData, opts: SessionOpts & { minLevel?: 0 | 1 | 2 | 3 }, t: ToolLlm | undefined): Promise<LifeRun> {
  return runAsync(lifeSteps(data, opts), (st) => summarizeDeath(t, data, st).then(() => undefined));
}
