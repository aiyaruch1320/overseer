// The stories of the map (code-plan §8.1 rule 5): each zoom level, a ruin, a changed continent (all eight forms), the aiming of a miracle and the
// mini-map. Each is drawn from the sample life the storybook runs; the ruin, the omen and the changed lands are put on a copy of the model.
import { useState } from 'preact/hooks';
import { mapModel, withSample, type MapModel } from '../app/views/map';
import type { Country } from '../core/data/types-npcs';
import { color, font, size } from '../ui/tokens';
import { story, type StoryCtx } from '../ui/stories';
import { WorldMap } from './WorldMap';
import type { MapAim, MapFocus, MapPick } from './types';
import { FATES, type FateId } from './tuning';

const Frame = ({ children, note }: { children: preact.ComponentChildren; note?: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: font.body }}>
    {note && <div style={{ padding: `${size.gap}px ${size.pad}px`, color: color.textDim, fontSize: size.small }}>{note}</div>}
    <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
  </div>
);

const countryName = (ctx: StoryCtx, id: string) => (ctx.data.countries.items as Country[]).find((c) => c.id === id)?.name ?? id;

function Level({ ctx, focus, zoom, note }: { ctx: StoryCtx; focus: MapFocus; zoom?: number; note: string }) {
  const [picked, setPicked] = useState<MapPick | null>(null);
  return (
    <Frame note={`${note}${picked ? ` · เลือก ${picked.kind} ${picked.id}` : ''}`}>
      <WorldMap data={ctx.data} state={ctx.state} focus={focus} zoom={zoom} onPick={setPicked} />
    </Frame>
  );
}

function Ruin({ ctx }: { ctx: StoryCtx }) {
  const base = mapModel(ctx.data, ctx.state);
  const m = withSample(base, { ruin: 'AL-04', fallen: 'AL-06' });
  m.ruins = m.ruins.map((r) => (r.country === 'AL-04' ? { ...r, name: countryName(ctx, 'AL-04'), label: `ซาก${countryName(ctx, 'AL-04')}` } : r.country === 'AL-06' ? { ...r, name: countryName(ctx, 'AL-06'), label: countryName(ctx, 'AL-06') } : r));
  return (
    <Frame note="ซากบนแผนที่ (20-god-ui.md §7.4): ประเทศเทาเถ้า หลุมดำขอบแก้วที่เมืองหลวง ชื่อเดิมขีดฆ่าสีเลือดหมู ป้ายรองใต้ชื่อ · AL-04 ซาก · AL-06 ล่มสลาย">
      <WorldMap data={ctx.data} state={ctx.state} model={m} focus={{ kind: 'country', id: 'AL-04' }} zoom={0.9} />
    </Frame>
  );
}

function Changed({ ctx }: { ctx: StoryCtx }) {
  const [fate, setFate] = useState<FateId>('ash');
  const f = FATES.find((x) => x.id === fate)!;
  const m: MapModel = withSample(mapModel(ctx.data, ctx.state), { fate });
  const focus: MapFocus = f.continent === '*' ? { kind: 'continent', id: 'NR' } : { kind: 'continent', id: f.continent };
  return (
    <Frame
      note={
        <span>
          {FATES.map((x) => (
            <button key={x.id} onClick={() => setFate(x.id)} style={{ marginRight: 6, background: x.id === fate ? color.line : 'transparent', color: color.text, border: `1px solid ${color.line}`, borderRadius: 4, cursor: 'pointer', fontFamily: font.body }}>
              {x.name}
            </button>
          ))}
        </span> as never
      }
    >
      <WorldMap key={fate} data={ctx.data} state={ctx.state} model={m} focus={focus} />
    </Frame>
  );
}

function Aiming({ ctx }: { ctx: StoryCtx }) {
  const [line, setLine] = useState<NonNullable<MapAim['line']>>('dread');
  const [kind, setKind] = useState<MapAim['kind']>('country');
  const [hold, setHold] = useState(0);
  const [picked, setPicked] = useState<MapPick | null>(null);
  const m = withSample(mapModel(ctx.data, ctx.state), { omen: { country: 'AL-02', id: 'MR-17', name: 'ดาวตก' } });
  const aim: MapAim = { kind, line, radius: kind === 'country' ? 12 : 20, hold };
  const btn = (on: boolean) => ({ marginRight: 6, background: on ? color.line : 'transparent', color: color.text, border: `1px solid ${color.line}`, borderRadius: 4, cursor: 'pointer', fontFamily: font.body });
  return (
    <Frame
      note={
        <span>
          {(['faith', 'dread', 'fate'] as const).map((l) => <button key={l} style={btn(l === line)} onClick={() => setLine(l)}>{l}</button>)}
          {(['country', 'continent', 'city'] as const).map((k) => <button key={k} style={btn(k === kind)} onClick={() => setKind(k)}>{k}</button>)}
          <button style={btn(false)} onClick={() => setHold(hold >= 1 ? 0 : hold + 0.25)}>hold {hold}</button>
          {picked ? ` · เลือก ${picked.kind} ${picked.id}` : ' · เลื่อนเมาส์เพื่อเล็ง คลิกเพื่อเลือก (วงลางที่ AL-02 คือปาฏิหาริย์ที่รอวัน)'}
        </span> as never
      }
    >
      <WorldMap data={ctx.data} state={ctx.state} model={m} aim={aim} onPick={setPicked} focus={{ kind: 'continent', id: 'AL' }} />
    </Frame>
  );
}

function Mini({ ctx }: { ctx: StoryCtx }) {
  const m = withSample(mapModel(ctx.data, ctx.state), { ruin: 'AL-04', omen: { country: 'KD-01', id: 'MR-06', name: 'ฟ้าผ่า' } });
  const [picked, setPicked] = useState<MapPick | null>(null);
  return (
    <Frame note={`แผนที่เล็กของหน้าเฝ้ามอง (ไม่โหลด Phaser) · ${picked ? `${picked.kind} ${picked.id}` : 'คลิกเพื่อเลือก'}`}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: size.pad, alignItems: 'flex-start' }}>
        <WorldMap data={ctx.data} state={ctx.state} model={m} mini width={320} onPick={setPicked} />
        <WorldMap data={ctx.data} state={ctx.state} mini width={380} />
      </div>
    </Frame>
  );
}

const capital = (ctx: StoryCtx) => {
  const id = ctx.state.life?.country ?? 'AL-01';
  return { country: id, city: `${id}/0` };
};

story({ group: 'แผนที่', name: 'ระดับโลก', render: (ctx) => <Level ctx={ctx} focus={{ kind: 'world' }} note="โลก (ซูม < 0.33): ทวีป ป้ายทวีป ผู้เล่น มังกร" /> });
story({ group: 'แผนที่', name: 'ระดับทวีป', render: (ctx) => <Level ctx={ctx} focus={{ kind: 'continent', id: 'AL' }} zoom={0.5} note="ทวีป (0.33–0.75): ภูมิประเทศเต็ม ป้ายประเทศ เมืองหลวง · ลากเพื่อเลื่อน ล้อเมาส์ซูม ลูกศร/WASD +/-" /> });
story({ group: 'แผนที่', name: 'ระดับประเทศ', render: (ctx) => <Level ctx={ctx} focus={{ kind: 'country', id: capital(ctx).country }} zoom={1.2} note="ประเทศ (0.75–2): ไอคอนและชื่อเมืองทุกแห่ง ธงสงคราม/ทุพภิกขภัย/โรค/ยุคทอง ตัวละครเป็นประกายทอง" /> });
story({ group: 'แผนที่', name: 'ระดับเมือง', render: (ctx) => <Level ctx={ctx} focus={{ kind: 'city', id: capital(ctx).city }} zoom={4} note="เมือง (2–7): ผังเมืองเต็ม ถนน อาคาร กำแพง ทุ่งนา ตามค่า UI ของประเทศ" /> });
story({ group: 'แผนที่', name: 'ในเมือง', render: (ctx) => <Level ctx={ctx} focus={{ kind: 'city', id: capital(ctx).city }} zoom={14} note="ในเมือง (7–48): ผังเมืองความละเอียดสูง" /> });
story({ group: 'แผนที่', name: 'ซาก', render: (ctx) => <Ruin ctx={ctx} /> });
story({ group: 'แผนที่', name: 'ทวีปที่เปลี่ยนรูป 8 แบบ', render: (ctx) => <Changed ctx={ctx} /> });
story({ group: 'แผนที่', name: 'การเล็ง', render: (ctx) => <Aiming ctx={ctx} /> });
story({ group: 'แผนที่', name: 'แผนที่เล็ก', render: (ctx) => <Mini ctx={ctx} /> });
