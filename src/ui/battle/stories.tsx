// Stories of the battle view and the war panel (code-plan §8.1 rule 5): a won fight, a lost one, a draw, a boss, a last stand, a clash with a named
// NPC and the war of a soldier. Each reads a sample life, adds the fight to its log as the core writes it (sample.ts), and draws the model of it.
import { battleModel, warModel, type WarInput } from '../../app/views/battle';
import type { GameData } from '../../core/game';
import type { GameState, LogEntry } from '../../core/types';
import { story } from '../stories';
import { BattleView } from './BattleView';
import { FIGHTS, battleEntry, clashEntry, withEntries, type FightSpec } from './sample';
import { WarPanel } from './WarPanel';

const GROUP = 'ศึก';

/** A sample life with one fight added to its log, and the model of that fight. */
function fight(data: GameData, state: GameState, spec: FightSpec, after: (n: number) => LogEntry[] = () => []) {
  const e = battleEntry(spec, 1);
  const st = withEntries(state, [e]);
  const n = st.log[st.log.length - 1].n;
  const more = after(n);
  const full = more.length ? withEntries(st, more.map((x, i) => ({ ...x, n: n + 1 + i }))) : st;
  const entry = full.log.find((x) => x.n === n)!;
  return battleModel(data, full, entry);
}

const play = (name: string, spec: FightSpec, o: { at?: number; startStep?: number; autoplay?: boolean } = {}) =>
  story({
    group: GROUP,
    name,
    seed: 1,
    at: o.at ?? 60,
    render: ({ data, state }) => <BattleView model={fight(data, state, spec)} autoplay={o.autoplay ?? false} startStep={o.startStep ?? 0} />,
  });

// a story opens at the result so the whole page is there to check; the first one plays from the start
story({ group: GROUP, name: 'ชนะ (เล่นตั้งแต่ต้น)', seed: 1, at: 60, render: ({ data, state }) => <BattleView model={fight(data, state, FIGHTS.won)} autoplay /> });
play('ชนะ ผลหลังศึก', FIGHTS.won, { startStep: 99 });
play('ชนะ ความฝัน ×3 และกระซิบจุดอ่อน', FIGHTS.dreamed, { startStep: 99 });
play('แพ้ แผลเป็นและเดินกะเผลก', FIGHTS.lost, { startStep: 99 });
play('เสมอ', FIGHTS.draw, { startStep: 99 });
play('บอส ลิชโบราณ (กลางศึก)', FIGHTS.boss, { startStep: 4 });
play('บอส ลิชโบราณ ผลหลังศึก', FIGHTS.boss, { startStep: 99 });
play('ศึกสุดท้าย ไม่มีทางหนี', FIGHTS.lastStand, { startStep: 99 });

story({
  group: GROUP,
  name: 'ปะทะผู้มีชื่อ (ดวลกับดยุก)',
  seed: 1,
  at: 60,
  render: ({ data, state }) => <BattleView model={fight(data, state, FIGHTS.clash, (n) => [clashEntry(data, 'NF-AZ02-1', 'win_spare', 'win', 'T', n + 1)])} autoplay={false} startStep={99} />,
});

story({
  group: GROUP,
  name: 'ศึกเมื่อบันทึกไม่เก็บการทอย',
  seed: 1,
  at: 60,
  render: ({ data, state }) => {
    // the entry as the core writes it today: stances, hit points, result; no rolls
    const e = battleEntry(FIGHTS.won, 1);
    const { rolls: _r, max: _m, ...data0 } = e.data;
    void [_r, _m];
    const st = withEntries(state, [{ ...e, data: data0 }]);
    return <BattleView model={battleModel(data, st, st.log[st.log.length - 1])} autoplay={false} startStep={99} />;
  },
});

// ---------- the war of a soldier ----------

function warOf(): WarInput {
  return { id: 'WR-03', country: 'MH-09', rank: 2, points: 3, since: 22, age: 27, battles: 9, held: 5, won: 3, lost: 1, pay: 41, foes: ['npc_knight', 'npc_inquisitor'] };
}

function warLog(): LogEntry[] {
  const mk = (n: number, how: string, grade: string, foe: string, pay: number, rank: string): LogEntry => ({
    n,
    worldYear: 1060 + n,
    age: 26,
    quarter: n % 4,
    sys: 'combat',
    kind: 'war',
    id: 'MH-09',
    level: 1,
    data: { war: 'WR-03', foe, role: 'front', rank, rankN: 2, n, roll: 14, country: 'MH-09', how, grade, first: false, pay, fame: 3, promoted: false },
  });
  return [mk(1, 'held', 'won', 'npc_knight', 8, 'corporal'), mk(2, 'held', 'steady', 'npc_inquisitor', 5, 'corporal'), mk(3, 'lost', '', 'npc_knight', 0, 'corporal'), mk(4, 'held', 'won', 'npc_inquisitor', 8, 'corporal')];
}

story({
  group: GROUP,
  name: 'สงครามของทหาร (แผงสงคราม)',
  seed: 1,
  at: 60,
  render: ({ data, state }) => <WarPanel war={warModel(data, warOf(), withEntries(state, warLog()))} />,
});

story({
  group: GROUP,
  name: 'สงครามของทหาร ยศสูงสุด',
  seed: 1,
  at: 60,
  render: ({ data, state }) => <WarPanel war={warModel(data, { ...warOf(), rank: 4, points: 0, battles: 31, held: 14, won: 13, lost: 4, pay: 380 }, withEntries(state, warLog()))} />,
});

story({ group: GROUP, name: 'ไม่ได้อยู่ในสงคราม', seed: 1, at: 60, render: () => <WarPanel war={null} /> });
