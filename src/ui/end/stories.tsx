// Stories of the ending screens (code-plan §8.1 rule 5): the card of a full life, a family that ended, the choice of the heir, the legend page,
// the collection and the summary of the world. Each draws a sample life run to its death (sample.ts); the state of the storybook is not used.
import { story } from '../stories';
import { EndScreen } from './EndScreen';
import { CollectionScreen, LegendScreen, WorldSummaryScreen } from './Pages';
import { lived } from './sample';

const GROUP = 'จบชีวิต';
const noop = () => ({ ok: true });

story({
  group: GROUP,
  name: 'ฉากความตาย',
  render: ({ data }) => {
    const l = lived(data, { seed: 5, vow: 'kept' });
    return <EndScreen data={data} state={l.state} ctx={l.ctx} start="death" onContinue={noop} />;
  },
});

story({
  group: GROUP,
  name: 'บันทึกชีวิตเต็ม (คำปฏิญาณสำเร็จ)',
  render: ({ data }) => {
    const l = lived(data, { seed: 5, vow: 'kept' });
    return <EndScreen data={data} state={l.state} ctx={l.ctx} start="record" onContinue={noop} />;
  },
});

story({
  group: GROUP,
  name: 'บันทึกชีวิต (คำปฏิญาณไม่สำเร็จ)',
  render: ({ data }) => {
    const l = lived(data, { seed: 5, vow: 'broken' });
    return <EndScreen data={data} state={l.state} ctx={l.ctx} start="record" onContinue={noop} />;
  },
});

story({
  group: GROUP,
  name: 'บันทึกชีวิตที่ถูกสั่ง (ได้บางอย่าง ทำไม่ได้บางอย่าง)',
  render: ({ data }) => {
    const l = lived(data, { seed: 5, wish: 'อยากเป็นดาร์กเอลฟ์ ชาย ขี้ขลาด ผู้กล้า อมตะ รวยมาก ดาบ' });
    return <EndScreen data={data} state={l.state} ctx={l.ctx} start="record" onContinue={noop} />;
  },
});

story({
  group: GROUP,
  name: 'เลือกผู้สืบตระกูล',
  render: ({ data }) => {
    const l = lived(data, { seed: 5 });
    return <EndScreen data={data} state={l.state} ctx={l.ctx} start="heir" onContinue={noop} />;
  },
});

story({
  group: GROUP,
  name: 'ตระกูลสิ้น',
  render: ({ data }) => {
    const l = lived(data, { seed: 1 });
    return <EndScreen data={data} state={l.state} ctx={l.ctx} start="heir" onContinue={noop} />;
  },
});

story({
  group: 'ตำนาน',
  name: 'หน้าตำนาน สามรุ่น',
  render: ({ data }) => <LegendScreen data={data} state={lived(data, { seed: 5, lives: 3, vow: 'kept' }).state} />,
});

story({
  group: 'ของสะสม',
  name: 'หลังสามชีวิต',
  render: ({ data }) => <CollectionScreen data={data} state={lived(data, { seed: 5, lives: 3 }).state} />,
});

story({
  group: 'หน้าสรุปโลก',
  name: 'โลกที่ยังดำเนินอยู่ หลังสองชีวิต',
  render: ({ data }) => <WorldSummaryScreen data={data} state={lived(data, { seed: 5, lives: 2 }).state} />,
});
