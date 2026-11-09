// Stories of the scene player (code-plan §8.1 rule 5): the ten beat kinds, the event card of each display form, a rite, a destination,
// the day of a miracle, and an entry with no script (it falls to the card). Scenes and cards are chosen by the same function the game uses
// (src/app/views/scene.ts) from sample log entries.
import type { ComponentChildren } from 'preact';
import { BEAT_KINDS } from '../core/data/types-scenes';
import type { GameData } from '../core/game';
import type { LogEntry } from '../core/types';
import { mainLookOf } from '../app/views/looks';
import type { FigureOf } from '../scene/figures';
import { cardOfEntry, figuresOf, labelsOf, sceneFor, sceneryOf } from '../app/views/scene';
import type { GameState } from '../core/types';
import { LifeScene } from './LifeScene';
import { BEAT_DEMOS } from '../scene/demo';
import { EventCard } from '../scene/EventCard';
import { ScenePlayer } from '../scene/ScenePlayer';
import { story } from './stories';
import { color, font, size } from './tokens';

const entry = (sys: string, kind: string, id: string, data: LogEntry['data'], n = 1): LogEntry => ({ n, worldYear: 0, sys, kind, id, data, level: 2 });

function Scene({ data, e, state }: { data: GameData; e: LogEntry; state?: GameState }) {
  const v = sceneFor(data, e, state);
  // who is on the stage: the figure of the life, the NPC of the clash, the crowd (src/app/views/scene.ts)
  const figureOf = figuresOf(data, state, v);
  const scenery = sceneryOf(data, state, v);
  const labelOf = labelsOf(data, state, v);
  return (
    <div style={{ padding: size.pad, display: 'flex', flexWrap: 'wrap', gap: size.pad, alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 640px', maxWidth: 960 }}>
        {v.kind === 'script' ? <ScenePlayer key={v.script.id + v.script.seconds} script={v.script} figureOf={figureOf} scenery={scenery} labelOf={labelOf} /> : <div style={{ color: color.textDim, fontFamily: font.body }}>ไม่มีสคริปต์ ใช้การ์ดเหตุการณ์แทน</div>}
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
  render: ({ data, state }) => {
    // the specimens' character is the life's own look (a silhouette stands for nobody): the main character is never the black placeholder
    const look = mainLookOf(data, state);
    const figureOf: FigureOf | undefined = look ? () => ({ kind: 'person', looks: [look] }) : undefined;
    return (
    <div style={{ padding: size.pad }}>
      <div style={{ color: color.textDim, marginBottom: size.pad }}>หนึ่งตัวอย่างต่อหนึ่งชนิดของจังหวะ: {BEAT_KINDS.join(' · ')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: size.pad }}>
        {BEAT_KINDS.map((k) => (
          <figure key={k} style={{ margin: 0 }} data-beat={k}>
            <ScenePlayer script={BEAT_DEMOS[k]} loop controls={false} figureOf={figureOf} />
            {/* the name of the beat under its frame: ten small frames on one place look alike */}
            <figcaption style={{ marginTop: 4, fontFamily: font.body, fontSize: size.text, color: color.text }}>{BEAT_DEMOS[k].title}</figcaption>
          </figure>
        ))}
      </div>
    </div>
    );
  },
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
    render: ({ data, state }) => {
      const e = entry('world', 'event', id, { name, mark: '●' });
      const v = sceneFor(data, e, state);
      return (
        <div style={{ padding: size.pad, display: 'flex', gap: size.pad, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <EventCard card={cardOfEntry(data, e)} width={360} />
          {v.kind === 'script' && (
            <div style={{ flex: '1 1 560px', maxWidth: 800 }}>
              <ScenePlayer script={v.script} figureOf={figuresOf(data, state, v)} scenery={sceneryOf(data, state, v)} labelOf={labelsOf(data, state, v)} />
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
  render: ({ data, state }) => (
    <div style={{ padding: size.pad, display: 'flex', gap: size.pad, flexWrap: 'wrap' }}>
      <EventCard card={cardOfEntry(data, entry('world', 'event', 'XX-99', { name: 'เหตุการณ์ที่ไม่มีในตาราง', mark: '○' }), state)} />
      <EventCard card={cardOfEntry(data, entry('god', 'miracle.omen', 'MR-09', { name: 'แสงศักดิ์สิทธิ์', n: 1, quarters: 3 }), state)} />
      <EventCard card={cardOfEntry(data, entry('story', 'node', 'hu.a3', { title: 'งานแรก', choice: 'a', label: 'รับงาน' }), state)} />
    </div>
  ),
});

// the picture of a card is the place of the event: one event named in four countries (the entry carries `place`), and one with none (the life's own place)
story({
  group: 'การ์ดเหตุการณ์',
  name: 'ภาพการ์ด · เหตุการณ์เดียวในสี่ทวีป',
  render: ({ data, state }) => (
    <div style={{ padding: size.pad, display: 'flex', gap: size.pad, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {['AZ-01', 'KD-01', 'SH-02', 'NR-03', ''].map((place) => (
        <EventCard key={place} card={cardOfEntry(data, entry('world', 'event', 'DR-04', { name: 'ฤดูหนาวเถ้า', mark: '●', ...(place ? { place } : {}) }), state)} width={300} />
      ))}
    </div>
  ),
});

story({
  group: 'ฉาก',
  name: 'พิธีของเผ่า · มนุษย์ ทุ่งราบ ผ่าน',
  render: ({ data, state }) => <Scene data={data} state={state} e={entry('story', 'node', 'hu.t1', { rite: 'hu.t1', title: 'พิธีของถิ่น', variant: 'ทุ่งราบ', result: 'pass', choice: 'a', label: 'ผ่าน' })} />,
});
story({
  group: 'ฉาก',
  name: 'พิธีของเผ่า · เอลฟ์ ไม่ผ่าน',
  race: 'elf',
  render: ({ data, state }) => <Scene data={data} state={state} e={entry('story', 'node', 'el.t1', { rite: 'el.t1', title: 'พิธีผูกราก', variant: 'ไม่ผ่าน', result: 'fail', choice: 'b', label: 'ไม่ผ่าน' })} />,
});
story({
  group: 'ฉาก',
  name: 'ฉากปลายทาง · คนแคระ',
  race: 'dwarf',
  render: ({ data, state }) => <Scene data={data} state={state} e={entry('story', 'node', 'dw.e1', { title: 'ปลายทาง', choice: 'a', label: 'ตายในศึก' })} />,
});
story({
  group: 'ฉาก',
  name: 'ฉากปลายทาง · เผ่าปีก',
  race: 'winged',
  render: ({ data, state }) => <Scene data={data} state={state} e={entry('story', 'node', 'wi.e1', { title: 'ปลายทาง', choice: 'a', label: 'ปลดเกษียณ' })} />,
});
story({
  group: 'ฉาก',
  name: 'วันเกิดเหตุของปาฏิหาริย์ · ดาวตก',
  render: ({ data, state }) => <Scene data={data} state={state} e={entry('god', 'miracle', 'MR-17', { name: 'ดาวตก', target: 'AZ-04', result: 'ok', tier: 'ใหญ่' })} />,
});
story({
  group: 'ฉาก',
  name: 'วันเกิดเหตุของปาฏิหาริย์ · แสงศักดิ์สิทธิ์',
  render: ({ data, state }) => <Scene data={data} state={state} e={entry('god', 'miracle', 'MR-04', { name: 'แสงศักดิ์สิทธิ์', target: 'AZ-04', result: 'ok', tier: 'ใหญ่' })} />,
});
story({
  group: 'ฉาก',
  name: 'ศึกของ NPC · อัซการ์ แพ้',
  render: ({ data, state }) => <Scene data={data} state={state} e={entry('combat', 'clash', 'NF-AZ02-1', { npc: 'AZ02-1', outcome: 'แพ้', kind: 'lose', result: 'แพ้' })} />,
});

// the calm picture between scenes: the main character at three ages of one life each, drawn from the life (an infant, a worker, an elder)
for (const [name, seed, at] of [['ฉากชีวิต · ทารก', 12, 4], ['ฉากชีวิต · วัยทำงาน', 38, 200], ['ฉากชีวิต · ผู้เฒ่า', 17, 250]] as const)
  story({
    group: 'ฉาก',
    name,
    seed,
    at,
    render: ({ data, state }) => (
      <div style={{ height: 640, padding: size.pad }}>
        <LifeScene data={data} state={{ ...state, log: [] }} />
      </div>
    ),
  });

// the rites and endings of the tribes (13-storyline-scenes §2 §3): a stage of each tribe at a still moment, with no life behind it, so the people are plain people of the tribe
const TRIBES: [string, string, number][] = [['hu', 'พิธีของถิ่น', 14], ['el', 'พิธีผูกราก', 5], ['de', 'พิธีเผชิญเงา', 3], ['dw', 'วันทั่งแรก', 5], ['or', 'พิธีกระดูกแรก', 4], ['ha', 'วันให้ของขวัญ', 4], ['na', 'การทดสอบนาคา', 4], ['va', 'คืนแรกแห่งเลือด', 4], ['fa', 'ชื่อจริง', 4], ['wi', 'การบินครั้งแรก', 4], ['gi', 'การสลักชื่อ', 4], ['mu', 'การชั่งหัวใจ', 4]];
story({
  group: 'ฉาก',
  name: 'พิธีของเผ่า · ฉากหลังและของประกอบ 12 เผ่า',
  render: ({ data }) => (
    <div style={{ padding: size.pad, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: size.pad }}>
      {TRIBES.map(([t, name, at]) => {
        const v = sceneFor(data, entry('story', 'node', `${t}.t1`, { rite: `${t}.t1`, title: name, variant: t === 'hu' ? 'ทุ่งราบ' : '', result: '' }), undefined);
        return (
          <figure key={t} style={{ margin: 0 }} data-tribe={t}>
            {v.kind === 'script' ? <ScenePlayer script={v.script} figureOf={figuresOf(data, undefined, v)} scenery={sceneryOf(data, undefined, v)} labelOf={labelsOf(data, undefined, v)} autoplay={false} startAt={at} controls={false} /> : null}
            <figcaption style={{ fontFamily: font.body, fontSize: size.text, color: color.text }}>{t} · {name}</figcaption>
          </figure>
        );
      })}
    </div>
  ),
});
