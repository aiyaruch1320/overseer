// Stories of the start screen (code-plan §8.1 rule 5): the empty sheet, a wish typed, the vows on the stones.
import { story } from '../stories';
import { command } from '../../core/command';
import type { Ctx, GameData } from '../../core/game';
import { reoffer } from '../../core/god/goals';
import type { Command } from '../../core/types';
import { createSession, startLife } from '../../../scripts/tools/session';
import { StartScreen } from './StartScreen';
import { VowChoice } from './VowChoice';

const GROUP = 'เริ่ม';
/** The storybook has no game to start: the button does nothing here. */
const onStart = () => ({ ok: true });

story({ group: GROUP, name: 'ว่าง', at: 0, render: ({ data }) => <StartScreen onStart={onStart} data={data} state={null} initial={{ seed: 5 }} /> });

story({
  group: GROUP,
  name: 'ตั้งค่าการทดสอบ (บันทึกการเล่น · A/B)',
  at: 0,
  render: ({ data }) => (
    <StartScreen
      onStart={onStart}
      data={data}
      state={null}
      initial={{ seed: 5 }}
      record={{ on: true, size: 0, lives: 0, onToggle: () => {}, onExport: () => null, onClear: () => {}, ab: 'alternate', onAb: () => {}, arm: null }}
    />
  ),
});

story({
  group: GROUP,
  name: 'พิมพ์คำขอ',
  at: 0,
  render: ({ data }) => (
    <StartScreen onStart={onStart} data={data} state={null} initial={{ seed: 5, text: 'อยากเป็นแวมไพร์หญิง ไม่เอาคนจน ขี้ขลาดนิดหน่อย ใจบุญ อยากเดินทางไกล เกิดที่ซาฮารัน' }} />
  ),
});

story({
  group: GROUP,
  name: 'ไม่เข้าใจ (หน้าเลือกเอง)',
  at: 0,
  render: ({ data }) => <StartScreen onStart={onStart} data={data} state={null} initial={{ seed: 5, text: 'กกกกก ขขขขข ฟฟฟฟฟ' }} />,
});

story({
  group: GROUP,
  name: 'ข้อเสนอคำปฏิญาณ',
  at: 0,
  render: ({ data }) => <StartScreen onStart={onStart} data={data} state={null} initial={{ seed: 5, text: 'คนแคระ ชาย', vow: 2 }} />,
});

story({
  group: GROUP,
  name: 'แบบเริ่มต้น ผู้ขี่มังกร',
  at: 0,
  render: ({ data }) => <StartScreen onStart={onStart} data={data} state={null} initial={{ seed: 9, mode: 'dragonkin' }} />,
});

// the vows on the table of a living life, as the watch screen mounts them (VowChoice): at birth, and the one change at 15
const games = new Map<number, Ctx>();
const vowGame = (data: GameData, age: number): Ctx => {
  const hit = games.get(age);
  if (hit) return hit;
  const s = createSession(data, { seed: 5 });
  const life = startLife(s);
  if (age >= 15) {
    command(s.game.ctx, { type: 'god', action: 'vow.pick' as Extract<Command, { type: 'god' }>['action'], args: { pick: 1 }, confirm: true });
    life.hAge = 15;
    reoffer(s.game.ctx, life);
  }
  games.set(age, s.game.ctx);
  return s.game.ctx;
};
const noPick = () => ({ ok: true });

story({ group: GROUP, name: 'คำปฏิญาณ ตอนเกิด (VowChoice)', at: 0, render: ({ data }) => <div style={{ maxWidth: 460, margin: 24 }}><VowChoice ctx={vowGame(data, 0)} onPick={noPick} /></div> });
story({ group: GROUP, name: 'คำปฏิญาณ เปลี่ยนได้ที่อายุ 15 (VowChoice)', at: 0, render: ({ data }) => <div style={{ maxWidth: 460, margin: 24 }}><VowChoice ctx={vowGame(data, 15)} onPick={noPick} /></div> });
