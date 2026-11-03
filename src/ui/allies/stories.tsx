// Stories of the allies screens (code-plan §8.1 rule 5): a life with a partner and four children, a lonely life, a crisis that waits, a lineage of three (the
// tree, and the family of a living heir). Each draws a sample made in sample.ts; the state of the storybook is not used. A whisper shows what it asked for.
import { useState } from 'preact/hooks';
import type { GameData } from '../../core/game';
import { story } from '../stories';
import { AlliesScreen } from './AlliesScreen';
import { FamilyTree } from './FamilyTree';
import { crisisLife, familyLife, lineageAlive, lineageOfThree, lonelyLife, type Made } from './sample';

const GROUP = 'พวกพ้องและครอบครัว';

function Shell({ made, data, tab, selected }: { made: Made; data: GameData; tab?: 'circle' | 'tree'; selected?: string }) {
  const [asked, setAsked] = useState<string | null>(null);
  return (
    <div style={{ height: '100vh' }}>
      <AlliesScreen data={data} state={made.state} tab={tab} selected={selected} onWhisper={setAsked} />
      {asked && (
        <div data-testid="whisper" style={{ position: 'fixed', left: 12, bottom: 12, background: '#000c', color: '#e6e0d0', padding: 8, fontSize: 12, zIndex: 99 }}>
          onWhisper {asked}
        </div>
      )}
    </div>
  );
}

story({ group: GROUP, name: 'คู่ชีวิตและลูกสี่คน', render: ({ data }) => <Shell made={familyLife(data)} data={data} /> });
story({ group: GROUP, name: 'ชีวิตที่โดดเดี่ยว', render: ({ data }) => <Shell made={lonelyLife(data)} data={data} /> });
story({ group: GROUP, name: 'วิกฤตของสหายที่รออยู่', render: ({ data }) => <Shell made={crisisLife(data)} data={data} /> });
story({ group: GROUP, name: 'ตระกูล: ครอบครัวในชีวิตนี้', render: ({ data }) => <Shell made={familyLife(data)} data={data} tab="tree" /> });
story({ group: GROUP, name: 'ตระกูล: สามรุ่น', render: ({ data }) => <Shell made={lineageOfThree(data)} data={data} tab="tree" /> });
story({ group: GROUP, name: 'ตระกูล: ทายาทที่ยังมีชีวิต', render: ({ data }) => <Shell made={lineageAlive(data)} data={data} tab="tree" /> });
story({ group: GROUP, name: 'ต้นตระกูลล้วน', render: ({ data }) => <FamilyTree data={data} state={lineageOfThree(data).state} /> });
