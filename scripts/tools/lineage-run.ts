// Several lives in a row in one world, as readable text (docs/guide/code-plan.md §11 row M4: "สามชีวิตต่อกันในโลกเดียว").
// `npm run life -- --seed=N --lives=3`: the first life is born as in `npm run life`; when it dies the lineage bears the next one (the heir of the bond
// book; a newcomer after a gap when the family has none, unless `strict`), and so on. After each life the ending card; at the end the summary of
// the world and the collection. Same seed and options give the same text.
import type { GameData } from '../../src/core/game';
import { cardOf, collectionView } from '../../src/core/ending';
import { nextLife, worldSummary } from '../../src/core/lineage';
import { calendarYear } from '../../src/core/text';
import { cardLines, collectionLines, worldSummaryLines } from '../../src/core/text/ending';
import type { GameState } from '../../src/core/types';
import { godLines, timeline, summaryLines } from './report';
import { afterBeat, createSession, runToDeath, startLife, toolNotes, toolSystems, type SessionOpts } from './session';

export interface LineageRun {
  text: string;
  state: GameState;
  /** Lives that were played to their deaths. */
  lives: number;
  /** Why the lineage stopped before the number asked for, if it did. */
  stopped?: string;
}

const WHY: Record<string, string> = {
  extinct: 'ตระกูลสิ้นสาย: ไม่มีทายาทหรือผู้สืบเรื่อง (เอกสารให้เริ่มโลกใหม่ ไม่ใส่ --strict เพื่อให้คนใหม่เกิดในโลกเดิมต่อ)',
  'world-ended': 'โลกจบแล้ว',
  alive: 'ชีวิตยังไม่จบ',
  'no-life': 'ไม่มีชีวิต',
};

export function runLineageReport(data: GameData, opts: SessionOpts & { lives: number; minLevel?: 0 | 1 | 2 | 3; strict?: boolean }): LineageRun {
  const s = createSession(data, opts);
  const g = s.game;
  const min = opts.minLevel ?? 2;
  const out: string[] = [];
  out.push(`== สายตระกูล · เมล็ด ${opts.seed} · ${opts.lives} ชีวิตในโลกเดียว${opts.policy ? ` · นโยบายพระเจ้า ${opts.policy}` : ''} ==`);
  out.push(`ระบบที่ทำงาน: ${toolSystems().systems.map((x) => x.name).join(' ')}`);
  for (const n of s.notes) out.push(`หมายเหตุ: ${n}`);
  out.push(`โลกเดินมาถึง ศ.ม. ${calendarYear(g.state.clock.worldYear).toLocaleString('en-US')} แล้วตัวละครเกิด`);
  let played = 0;
  let stopped: string | undefined;
  const after = () => void afterBeat(s);
  for (let i = 0; i < opts.lives; i++) {
    const mark = g.state.logN;
    if (i === 0) startLife(s);
    else {
      const r = nextLife(g, { newcomer: !opts.strict });
      if (!r.ok) {
        stopped = WHY[r.reason] ?? r.reason;
        out.push('', `-- สายตระกูลหยุด: ${stopped} --`);
        break;
      }
    }
    after();
    const beats = runToDeath(g, undefined, after);
    played++;
    const st = g.state;
    out.push('', `=== ชีวิตที่ ${i + 1} ===`);
    out.push(...timeline(s.data, st.log, min, { fromN: mark, notes: toolNotes(st) }));
    out.push('', '-- สรุป --', ...summaryLines(s.data, st, beats).slice(0, 1));
    const card = cardOf(st);
    if (card) out.push(...cardLines(card));
    const hand = godLines(s.data, st, opts.policy);
    if (hand.length && opts.policy) out.push('-- พระหัตถ์ --', ...hand);
  }
  const st = g.state;
  out.push('', ...worldSummaryLines(worldSummary(st, s.data)));
  out.push('', ...collectionLines(collectionView(st, s.data)));
  return { text: out.join('\n') + '\n', state: st, lives: played, ...(stopped ? { stopped } : {}) };
}
