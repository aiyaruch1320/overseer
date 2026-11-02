// One whole life from birth to death, as readable text (docs/guide/code-plan.md §8.0 "สรุปทั้งชีวิต").
// Same seed and options give the same text. `npm run life` prints it; tests/tools/life.test.ts runs it twice.
import type { GameData } from '../../src/core/game';
import { calendarYear } from '../../src/core/text';
import type { GameState } from '../../src/core/types';
import { metNpcs, summaryLines, timeline } from './report';
import { createSession, runToDeath, startLife, toolSystems, type SessionOpts } from './session';

export interface LifeRun {
  text: string;
  state: GameState;
  beats: number;
  notes: string[];
}

export function runLifeReport(data: GameData, opts: SessionOpts & { minLevel?: 0 | 1 | 2 | 3 }): LifeRun {
  const s = createSession(data, opts);
  const g = s.game;
  const worldMark = g.state.logN;
  const life = startLife(s);
  const lifeMark = g.state.logN - 1; // the birth entry of the text system is the first of the life
  void lifeMark;
  const beats = runToDeath(g);
  const st = g.state;
  const min = opts.minLevel ?? 1;
  const out: string[] = [];
  out.push(`== ชีวิตหนึ่ง · เมล็ด ${opts.seed}${opts.policy ? ` · นโยบายพระเจ้า ${opts.policy}` : ''} ==`);
  out.push(`ระบบที่ทำงาน: ${toolSystems().systems.map((x) => x.name).join(' ')}`);
  for (const n of s.notes) out.push(`หมายเหตุ: ${n}`);
  out.push(`โลกเดินมาถึง ศ.ม. ${calendarYear(life.birthYear).toLocaleString('en-US')} (${worldMark} รายการบันทึกก่อนเกิด) แล้วตัวละครเกิด`);
  out.push('');
  out.push('-- บันทึก --');
  const born = st.log.filter((e) => e.n >= worldMark);
  out.push(...timeline(s.data, born, min));
  out.push('');
  out.push('-- NPC ที่พบ --');
  const met = metNpcs(s.data, st.log);
  if (!met.length) out.push('(ไม่ได้พบใครที่มีเรื่องเปิดอยู่)');
  for (const m of met) out.push(`  ${m.holder}${m.role ? ` (${m.role})` : ''} ${m.place} · พบเมื่ออายุ ${m.age ?? '?'} ศ.ม. ${m.year.toLocaleString('en-US')}`);
  out.push('');
  out.push('-- สรุป --');
  out.push(...summaryLines(s.data, st, beats));
  return { text: out.join('\n') + '\n', state: st, beats, notes: s.notes };
}
