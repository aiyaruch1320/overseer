// Stories of the start screen (code-plan §8.1 rule 5): the empty sheet, a wish typed, the vows on the stones.
import { story } from '../stories';
import { StartScreen } from './StartScreen';

const GROUP = 'เริ่ม';
/** The storybook has no game to start: the button does nothing here. */
const onStart = () => ({ ok: true });

story({ group: GROUP, name: 'ว่าง', at: 0, render: ({ data }) => <StartScreen onStart={onStart} data={data} state={null} initial={{ seed: 5 }} /> });

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
