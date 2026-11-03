// Stories of the scene player (code-plan §8.1 rule 5): the ten beat kinds, the event card of each display form, a rite, a destination,
// the day of a miracle, and an entry with no script (it falls to the card). Scenes and cards are chosen by the same function the game uses
// (src/app/views/scene.ts) from sample log entries.
import type { ComponentChildren } from 'preact';
import { BEAT_KINDS } from '../core/data/types-scenes';
import type { GameData } from '../core/game';
import type { LogEntry } from '../core/types';
import { cardOfEntry, sceneFor } from '../app/views/scene';
import { BEAT_DEMOS } from '../scene/demo';
import { EventCard } from '../scene/EventCard';
import { ScenePlayer } from '../scene/ScenePlayer';
import { story } from './stories';
import { color, font, size } from './tokens';

const entry = (sys: string, kind: string, id: string, data: LogEntry['data'], n = 1): LogEntry => ({ n, worldYear: 0, sys, kind, id, data, level: 2 });

function Scene({ data, e }: { data: GameData; e: LogEntry }) {
  const v = sceneFor(data, e);
  return (
    <div style={{ padding: size.pad, display: 'flex', flexWrap: 'wrap', gap: size.pad, alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 640px', maxWidth: 960 }}>
        {v.kind === 'script' ? <ScenePlayer key={v.script.id + v.script.seconds} script={v.script} /> : <div style={{ color: color.textDim, fontFamily: font.body }}>ไม่มีสคริปต์ ใช้การ์ดเหตุการณ์แทน</div>}
      </div>
      <EventCard card={v.card} />
    </div>
  );
}

function Heading({ children }: { children: ComponentChildren }) {
  return <h3 style={{ margin: `${size.pad}px ${size.pad}px 0`, fontFamily: font.title, fontWeight: 400 }}>{children}</h3>;
}

story({
  group: 'ฉาก',
  name: 'จังหวะทั้งสิบชนิด',
  render: () => (
    <div style={{ padding: size.pad }}>
      <div style={{ color: color.textDim, marginBottom: size.pad }}>หนึ่งตัวอย่างต่อหนึ่งชนิดของจังหวะ: {BEAT_KINDS.join(' · ')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: size.pad }}>
        {BEAT_KINDS.map((k) => (
          <ScenePlayer key={k} script={BEAT_DEMOS[k]} loop controls={false} />
        ))}
      </div>
    </div>
  ),
});

// one event of each display form (12-event-visuals "รูปแบบการแสดง 4 แบบ")
const FORMS: [string, string, string][] = [
  ['X ฉากเต็มจอ', 'DR-04', 'ฤดูหนาวเถ้า'],
  ['M ชั้นแผนที่', 'DR-06', 'ลมหยุดหายใจ'],
  ['L ฉากท้องถิ่น', 'DR-03', 'ไข่ใบที่สิบหก'],
  ['C การ์ดและเสียง', 'CT-10', 'ฝูงวาฬฟ้าอพยพ'],
];
for (const [form, id, name] of FORMS) {
  story({
    group: 'การ์ดเหตุการณ์',
    name: `${form} · ${id}`,
    render: ({ data }) => {
      const e = entry('world', 'event', id, { name, mark: '●' });
      const v = sceneFor(data, e);
      return (
        <div style={{ padding: size.pad, display: 'flex', gap: size.pad, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <EventCard card={cardOfEntry(data, e)} width={360} />
          {v.kind === 'script' && (
            <div style={{ flex: '1 1 560px', maxWidth: 800 }}>
              <ScenePlayer script={v.script} />
            </div>
          )}
        </div>
      );
    },
  });
}

story({
  group: 'การ์ดเหตุการณ์',
  name: 'ไม่มีสคริปต์ (รายการอื่น)',
  render: ({ data }) => (
    <div style={{ padding: size.pad, display: 'flex', gap: size.pad, flexWrap: 'wrap' }}>
      <EventCard card={cardOfEntry(data, entry('world', 'event', 'XX-99', { name: 'เหตุการณ์ที่ไม่มีในตาราง', mark: '○' }))} />
      <EventCard card={cardOfEntry(data, entry('god', 'miracle.omen', 'MR-09', { name: 'ลางของปาฏิหาริย์', n: 1 }))} />
      <EventCard card={cardOfEntry(data, entry('story', 'node', 'hu.a3', { title: 'งานแรก', choice: 'a', label: 'รับงาน' }))} />
    </div>
  ),
});

story({
  group: 'ฉาก',
  name: 'พิธีของเผ่า · มนุษย์ ทุ่งราบ ผ่าน',
  render: ({ data }) => <Scene data={data} e={entry('story', 'node', 'hu.t1', { rite: 'hu.t1', title: 'พิธีของถิ่น', variant: 'ทุ่งราบ', result: 'pass', choice: 'a', label: 'ผ่าน' })} />,
});
story({
  group: 'ฉาก',
  name: 'พิธีของเผ่า · เอลฟ์ ไม่ผ่าน',
  render: ({ data }) => <Scene data={data} e={entry('story', 'node', 'el.t1', { rite: 'el.t1', title: 'พิธีผูกราก', variant: 'ไม่ผ่าน', result: 'fail', choice: 'b', label: 'ไม่ผ่าน' })} />,
});
story({
  group: 'ฉาก',
  name: 'ฉากปลายทาง · คนแคระ',
  render: ({ data }) => <Scene data={data} e={entry('story', 'node', 'dw.e1', { title: 'ปลายทาง', choice: 'a', label: 'ตายในศึก' })} />,
});
story({
  group: 'ฉาก',
  name: 'ฉากปลายทาง · เผ่าปีก',
  render: ({ data }) => <Scene data={data} e={entry('story', 'node', 'wi.e1', { title: 'ปลายทาง', choice: 'a', label: 'ปลดเกษียณ' })} />,
});
story({
  group: 'ฉาก',
  name: 'วันเกิดเหตุของปาฏิหาริย์ · ดาวตก',
  render: ({ data }) => <Scene data={data} e={entry('god', 'miracle', 'MR-17', { name: 'ดาวตก', target: 'AZ-04', result: 'ok', tier: 'ใหญ่' })} />,
});
story({
  group: 'ฉาก',
  name: 'ศึกของ NPC · อัซการ์ แพ้',
  render: ({ data }) => <Scene data={data} e={entry('combat', 'clash', 'NF-AZ02-1', { npc: 'AZ02-1', outcome: 'แพ้', kind: 'lose', result: 'แพ้' })} />,
});
