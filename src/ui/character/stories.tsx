// Stories of the character screen (code-plan §8.1 rule 5): a newborn, a grown warrior with gear, a cursed life in bondage, an elder sage, and the
// card for the watch screen's side. Each draws a seeded sample life (sample.ts); the state of the storybook is not used.
import { story } from '../stories';
import { color, size } from '../tokens';
import { CharacterCard } from './CharacterCard';
import { CharacterScreen } from './CharacterScreen';
import { sampleLife } from './sample';

const GROUP = 'ตัวละคร';

story({ group: GROUP, name: 'ทารกแรกเกิด', at: 0, render: ({ data }) => <CharacterScreen data={data} state={sampleLife(data, 'newborn')} /> });
story({ group: GROUP, name: 'นักรบวัยกลางคน มีของครบชุด', at: 0, render: ({ data }) => <CharacterScreen data={data} state={sampleLife(data, 'warrior')} /> });
story({ group: GROUP, name: 'ชีวิตต้องสาปที่ถูกผูกตัว', at: 0, render: ({ data }) => <CharacterScreen data={data} state={sampleLife(data, 'bonded')} /> });
story({ group: GROUP, name: 'ผู้เฒ่าปราชญ์', at: 0, render: ({ data }) => <CharacterScreen data={data} state={sampleLife(data, 'elder')} /> });

story({
  group: GROUP,
  name: 'การ์ดข้างหน้าเฝ้ามอง (สี่ชีวิต)',
  at: 0,
  render: ({ data }) => (
    <div style={{ display: 'flex', gap: size.pad, padding: size.pad, flexWrap: 'wrap', background: color.panel }}>
      {(['newborn', 'warrior', 'bonded', 'elder'] as const).map((k) => (
        <CharacterCard key={k} data={data} state={sampleLife(data, k)} onOpen={() => undefined} />
      ))}
    </div>
  ),
});
