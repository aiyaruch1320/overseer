// Sets of the characters page made from data/gen/looks.json: the races with their sub-lines, the NPCs of each appearance file
// (docs/appearance/npcs/*.md), and the ally successors (19-ally-successors.md).
import type { GenFile } from '../../core/types';
import type { LooksData } from '../../core/data/types-looks';
import looksFile from '../../../data/gen/looks.json';
import { npcLook, raceLook, successorLook } from '../resolve';
import type { Entry, SetDef } from './sets';

const looks = (looksFile as unknown as GenFile<LooksData>).items;

const FILE_LABEL: Record<string, string> = {
  '01-azgar': 'อัซการ์ (ทวีปมังกร)', '02-morhaven': 'มอร์เฮเวน (ทวีปปีศาจ)', '03-kaz-durum': 'คาซ-ดูรัม (ทวีปไฟ)', '04-nerea': 'เนเรีย (ทวีปสายน้ำ)',
  '05-aldria-a': 'อัลเดรีย AL-01 ถึง AL-14', '06-aldria-b': 'อัลเดรีย AL-15 ถึง AL-28', '07-mecharia': 'เมคาเรีย (ทวีปจักรกล)',
  '08-saharan': 'ซาฮารัน (ทวีปทราย)', '09-silvanel': 'ซิลวาเนล (ทวีปพงไพร)', '10-nebulia': 'เนบูเลีย (ทวีปหมอก)',
};

const raceEntries = (): Entry[] =>
  Object.values(looks.races).flatMap((r) =>
    [undefined, ...r.lines.map((l) => l.name)].flatMap((line) =>
      [false, true].map((fem) => {
        const id = `${r.id}${line ? ':' + line : ''}${fem ? '-f' : ''}`;
        return { id, label: `${r.name}${line ? ' · ' + line : ''} ${fem ? 'หญิง' : 'ชาย'}`, look: raceLook(looks, r.id, { line, stage: 'adult', fem, seed: id }) };
      }),
    ),
  );

export const SET_DEFS: Record<string, SetDef> = {
  races: { label: 'เผ่า 21 พร้อมสายเลือดย่อย (ผู้ใหญ่ ชายและหญิง)', entries: raceEntries },
  successors: {
    label: 'ผู้สืบของพวกพ้องตัวหลัก 55 คน',
    entries: () => Object.entries(looks.successors).map(([id, r]) => ({ id, label: `${id} ${r.name}`, look: successorLook(looks, id) })),
  },
};

for (const file of [...new Set(Object.values(looks.npcs).map((n) => n.file))]) {
  const ids = Object.keys(looks.npcs).filter((id) => looks.npcs[id].file === file);
  SET_DEFS[`npc:${file}`] = {
    label: `NPC ${FILE_LABEL[file] ?? file} (${ids.length})`,
    entries: () => ids.map((id) => ({ id, label: `${id} ${looks.npcs[id].name}`, look: npcLook(looks, id) })),
  };
}
