// Sets of the characters page for the 21 races (M6 races): the races as adults with their sub-lines, every race at every life stage, one race in
// the poses and with tools. Every look comes from the generated data (data/gen/looks.json, through raceLook of src/art/resolve.ts): the UI values
// and colours of 02-races.md, the sub-lines' differences. `raceLook` here is the data's look with the few things a set may change (a tool, a hat).
import type { GenFile } from '../../core/types';
import type { LooksData } from '../../core/data/types-looks';
import looksFile from '../../../data/gen/looks.json';
import type { PersonLook, Stage } from '../look';
import { raceLook as dataLook } from '../resolve';
import type { Entry, SetDef } from './sets';

const looks = (looksFile as unknown as GenFile<LooksData>).items;

export interface RaceRow { id: string; name: string; scale: number }
/** The 21 races, in the order of the docs. */
export const RACES: RaceRow[] = Object.values(looks.races).map((r) => ({ id: r.id, name: r.name, scale: r.body.scale }));

export interface RaceOpts { stage?: Stage; fem?: boolean; line?: string; tool?: string; hat?: string; feats?: string[]; key?: string }

/** The look of a race at a stage from the data; `tool`, `hat` and `feats` replace what the data gives. The same options give the same figure. */
export function raceLook(row: RaceRow, o: RaceOpts = {}): PersonLook {
  const stage = o.stage ?? 'adult', fem = !!o.fem;
  const seed = o.key ?? `${row.id}${o.line ? ':' + o.line : ''}${fem ? '-f' : ''}`;
  const L = dataLook(looks, row.id, { line: o.line, stage, fem, seed });
  return { ...L, tool: o.tool ?? L.tool, hat: o.hat ?? L.hat, feats: o.feats ?? L.feats, wear: stage === 'elder' ? 0.6 : 0.2 };
}

const STAGES: Stage[] = ['infant', 'child', 'teen', 'adult', 'elder'];
const one = (id: string): RaceRow => RACES.find((r) => r.id === id) ?? RACES[0];

/** Every race with each of its sub-lines (the race itself first), men then women. */
const withLines = (): Entry[] =>
  RACES.flatMap((row) =>
    [undefined, ...looks.races[row.id].lines.map((l) => l.name)].flatMap((line) =>
      [false, true].map((fem) => {
        const id = `${row.id}${line ? ':' + line : ''}${fem ? '-f' : ''}`;
        return { id, label: `${row.name}${line ? ' · ' + line : ''} ${fem ? 'หญิง' : 'ชาย'}`, look: raceLook(row, { line, fem }) };
      }),
    ),
  );

export const SET_DEFS: Record<string, SetDef> = {
  // 'races' is also in sets-npcs.ts; this file is read after it (the files are read in name order), so this one is the one the page shows
  races: { label: 'เผ่า 21 พร้อมสายเลือดย่อย (ผู้ใหญ่ ชายและหญิง)', entries: withLines },
  'races:main': {
    label: 'เผ่า 21 (ผู้ใหญ่ ชายและหญิง)',
    entries: () => RACES.flatMap((row) => [false, true].map((fem) => ({ id: `${row.id}${fem ? '-f' : ''}`, label: `${row.name}${fem ? ' หญิง' : ''}`, look: raceLook(row, { fem }) }))),
  },
  stages: {
    label: 'เผ่า 21 × วัย 5',
    entries: () => RACES.flatMap((row) => STAGES.map((stage) => ({ id: `${row.id}-${stage.slice(0, 3)}`, label: `${row.name} ${stage}`, look: raceLook(row, { stage }) }))),
  },
  'stages-f': {
    label: 'เผ่า 21 × วัย 5 (หญิง)',
    entries: () => RACES.flatMap((row) => STAGES.map((stage) => ({ id: `${row.id}-${stage.slice(0, 3)}`, label: `${row.name} ${stage}`, look: raceLook(row, { stage, fem: true }) }))),
  },
  // the winged people and the fae in the pose that opens the wings (the page can switch it)
  wings: {
    label: 'ปีก ทุกสายของเผ่าปีก และภูตพราย (เปิดปีกตอนโจมตี)',
    pose: 'attack',
    entries: () => ['winged', 'fae'].flatMap((id) => [undefined, ...looks.races[id].lines.map((l) => l.name)].flatMap((line) => [false, true].map((fem) => ({ id: `${id}${line ? ':' + line : ''}${fem ? '-f' : ''}`, label: `${one(id).name}${line ? ' · ' + line : ''}`, look: raceLook(one(id), { line, fem }) })))),
  },
  // what is held in the hand: carried things stay upright in front, the bow draws and looses
  carry: {
    label: 'ของที่ถือ (ถือตรงหน้า ธนูง้างและปล่อย) (เลือกท่าด้านบน)',
    pose: 'attack',
    entries: () => ['book', 'ledger', 'scroll', 'mug', 'bowl', 'flask', 'lantern', 'censer', 'bow'].map((tool) => ({ id: tool, label: tool, look: raceLook(one('human'), { tool }) })),
  },
};

// one race at every stage, and one race with tools and a hat (the page plays the pose chosen on it)
for (const row of RACES) {
  SET_DEFS[`stages:${row.id}`] = {
    label: `${row.name} × วัย 5 (ชายและหญิง)`,
    entries: () => STAGES.flatMap((stage) => [false, true].map((fem) => ({ id: `${stage.slice(0, 3)}${fem ? '-f' : ''}`, label: `${row.name} ${stage}`, look: raceLook(row, { stage, fem }) }))),
  };
  SET_DEFS[`poses:${row.id}`] = {
    label: `${row.name} กับเครื่องมือ (เลือกท่าด้านบน)`,
    pose: 'attack',
    entries: () => [
      ...[['', 'มือเปล่า'], ['spear', 'หอก'], ['sword', 'ดาบ'], ['axe', 'ขวาน'], ['staff', 'ไม้เท้า'], ['bow', 'ธนู'], ['book', 'หนังสือ']].map(([tool, name]) => ({ id: tool || 'bare', label: `${row.name} ${name}`, look: raceLook(row, { tool }) })),
      ...[['', 'มือเปล่า'], ['spear', 'หอก'], ['staff', 'ไม้เท้า']].map(([tool, name]) => ({ id: `${tool || 'bare'}-f`, label: `${row.name} หญิง ${name}`, look: raceLook(row, { fem: true, tool }) })),
      { id: 'hood', label: `${row.name} ฮู้ด`, look: raceLook(row, { hat: 'hood' }) },
    ],
  };
}
