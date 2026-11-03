// Sets of the characters page for the 21 races (M6 races): the races as adults, every race at every life stage, one race in the poses and with tools.
// Each race's UI values (02-races.md ค่า UI: ขนาด หัว ไหล่ หู ท่อนล่าง ท่าเดิน สีผิว สีประจำเผ่า ลักษณะที่วาดเพิ่ม) are written inline for now; the
// looks generated from the docs (data/gen/looks.json) will replace this table. The clothes and hair colours are the ones the race text names.
import { HUMAN_BODY, type Body, type Ears, type Gait, type Lower, type PersonLook, type Stage } from '../look';

import type { Entry, SetDef } from './sets';

export interface RaceRow {
  id: string; name: string;
  scale: number; head: number; shoulders: number; ears: Ears; lower: Lower; gait: Gait;
  skin: string; accent: string; feats: string[];
  /** the look the race text gives: hair colour, eye, the two colours of the clothes, the hair of men and of women, the outfit */
  hair: string; eye: string; main: string; second: string; hairM: string; hairF: string; outfit: string; tool?: string; hat?: string; beard?: string;
}

export const RACES: RaceRow[] = [
  { id: 'human', name: 'มนุษย์', scale: 1, head: 1, shoulders: 1, ears: 'round', lower: 'legs', gait: 'normal', skin: '#e8b48a', accent: '#d9a030', feats: [],
    hair: '#3a2a20', eye: '#1e1a22', main: '#5a6a4a', second: '#6a4a32', hairM: 'short', hairF: 'long', outfit: 'tunic' },
  { id: 'elf', name: 'เอลฟ์', scale: 1.08, head: 0.96, shoulders: 0.86, ears: 'long', lower: 'legs', gait: 'glide', skin: '#f6e0c8', accent: '#3f9a5a', feats: ['leafcrest', 'vines'],
    hair: '#d6c08a', eye: '#3a7a5a', main: '#2f7a4a', second: '#d8c890', hairM: 'long', hairF: 'long', outfit: 'tunic' },
  { id: 'darkelf', name: 'ดาร์กเอลฟ์', scale: 1.04, head: 0.96, shoulders: 0.86, ears: 'long', lower: 'legs', gait: 'glide', skin: '#7a6a8f', accent: '#e0662a', feats: ['webcrown', 'lavaglow', 'slit'],
    hair: '#e8e8f0', eye: '#d28cff', main: '#2a2236', second: '#4a3a6a', hairM: 'long', hairF: 'long', outfit: 'cape' },
  { id: 'dwarf', name: 'คนแคระ', scale: 0.8, head: 1.05, shoulders: 1.28, ears: 'round', lower: 'legs', gait: 'heavy', skin: '#d08a62', accent: '#d9a030', feats: ['runes', 'beadbeard'],
    hair: '#8a4a2a', eye: '#2a1a14', main: '#7a4a2a', second: '#4a3a2a', hairM: 'short', hairF: 'long', outfit: 'armor', tool: 'axe' },
  { id: 'orc', name: 'ออร์ค', scale: 1.12, head: 0.98, shoulders: 1.3, ears: 'pointed', lower: 'legs', gait: 'heavy', skin: '#6f9a4f', accent: '#c8c0a0', feats: ['tusks', 'warpaint', 'scars'],
    hair: '#1a1a1a', eye: '#c8a030', main: '#5a3a1e', second: '#8a2a1a', hairM: 'bald', hairF: 'long', outfit: 'tunic', tool: 'axe' },
  { id: 'halfling', name: 'ฮาล์ฟลิง', scale: 0.74, head: 1.1, shoulders: 1.12, ears: 'pointed', lower: 'legs', gait: 'hop', skin: '#f0c49a', accent: '#8ac84a', feats: ['hairyfeet', 'rosycheeks'],
    hair: '#6a4a2a', eye: '#3a2a20', main: '#6a9a3a', second: '#7a4a2a', hairM: 'short', hairF: 'long', outfit: 'tunic' },
  { id: 'beast', name: 'เผ่าสัตว์', scale: 1.02, head: 1, shoulders: 1.04, ears: 'animal', lower: 'legs', gait: 'normal', skin: '#c98f5a', accent: '#d9a030', feats: ['fur', 'tail:fluffy', 'pawhands', 'beads'],
    hair: '#8a6a4a', eye: '#e0b030', main: '#6a5a3a', second: '#4a3a2a', hairM: 'short', hairF: 'long', outfit: 'tunic' },
  { id: 'naga', name: 'นาคา', scale: 1.04, head: 1, shoulders: 0.95, ears: 'fin', lower: 'serpent', gait: 'glide', skin: '#4f8f7a', accent: '#e8c050', feats: ['scales', 'slit', 'hood', 'goldjewel', 'shedskin'],
    hair: '#1a1a22', eye: '#e0c040', main: '#7a2a4a', second: '#5a1a3a', hairM: 'bald', hairF: 'long', outfit: 'tunic' },
  { id: 'dragonkin', name: 'เผ่ามังกร', scale: 1.1, head: 1, shoulders: 1.12, ears: 'pointed', lower: 'legs', gait: 'heavy', skin: '#b04a3a', accent: '#d9a030', feats: ['horns', 'scales', 'tail:lizard', 'slit'],
    hair: '#2a1a18', eye: '#e0b030', main: '#7a2a1a', second: '#2a2a3a', hairM: 'bald', hairF: 'long', outfit: 'armor' },
  { id: 'vampire', name: 'แวมไพร์', scale: 1.06, head: 0.96, shoulders: 0.9, ears: 'pointed', lower: 'legs', gait: 'glide', skin: '#e8e0e8', accent: '#8a1a2a', feats: ['fangs', 'tallcollar', 'ledger', 'redeyes'],
    hair: '#1a1418', eye: '#c8c0d0', main: '#2a1a3a', second: '#8a1a2a', hairM: 'short', hairF: 'long', outfit: 'cape' },
  { id: 'fae', name: 'ภูตพราย', scale: 0.58, head: 1.2, shoulders: 0.78, ears: 'pointed', lower: 'legs', gait: 'float', skin: '#f0d0f0', accent: '#ffd0f0', feats: ['wings:insect', 'sparkle', 'antenna'],
    hair: '#e8d0f0', eye: '#6a3a8a', main: '#8ac0a0', second: '#d0b0d0', hairM: 'short', hairF: 'long', outfit: 'tunic' },
  { id: 'slime', name: 'สไลม์', scale: 0.82, head: 1, shoulders: 1.2, ears: 'none', lower: 'blob', gait: 'hop', skin: '#5ab0e8', accent: '#ffffff', feats: ['gel', 'swallowed', 'hairless'],
    hair: '#5ab0e8', eye: '#ff00ff', main: '#5ab0e8', second: '#5ab0e8', hairM: 'short', hairF: 'short', outfit: '' },
  { id: 'demonkin', name: 'เผ่าปีศาจ', scale: 1.04, head: 1, shoulders: 1, ears: 'pointed', lower: 'legs', gait: 'normal', skin: '#c06070', accent: '#e0a030', feats: ['horns', 'tail:spade', 'contract', 'fangs'],
    hair: '#2a1a22', eye: '#e0b020', main: '#2a1a2a', second: '#d02a4a', hairM: 'short', hairF: 'long', outfit: 'cape' },
  { id: 'merfolk', name: 'เงือก', scale: 1, head: 1, shoulders: 0.92, ears: 'fin', lower: 'gown', gait: 'glide', skin: '#9ad0d0', accent: '#4ab0c0', feats: ['gills', 'scales', 'pearls', 'finskirt', 'wet'],
    hair: '#4a7a9a', eye: '#7a8a9a', main: '#c0808a', second: '#e8e8f0', hairM: 'short', hairF: 'long', outfit: 'tunic' },
  { id: 'winged', name: 'เผ่าปีก', scale: 1.04, head: 0.98, shoulders: 0.92, ears: 'pointed', lower: 'legs', gait: 'glide', skin: '#f6e0d0', accent: '#ffffff', feats: ['wings:feather', 'sunstrap', 'goldcirclet'],
    hair: '#d8c8a8', eye: '#6aa0d0', main: '#c8d8f0', second: '#d9a030', hairM: 'short', hairF: 'long', outfit: 'tunic' },
  { id: 'giant', name: 'ยักษ์', scale: 1.3, head: 0.92, shoulders: 1.4, ears: 'round', lower: 'legs', gait: 'heavy', skin: '#a09a90', accent: '#6a8a4a', feats: ['stone', 'moss', 'heavybrow'],
    hair: '#5a5a54', eye: '#2a2a2a', main: '#6a5a4a', second: '#7a7a7a', hairM: 'bald', hairF: 'short', outfit: 'tunic' },
  { id: 'lavakin', name: 'เผ่าลาวา', scale: 1.1, head: 1, shoulders: 1.1, ears: 'pointed', lower: 'legs', gait: 'heavy', skin: '#3a2a2a', accent: '#ff6a1a', feats: ['cracks', 'embers', 'flamehair', 'glow-eyes'],
    hair: '#ff8a2a', eye: '#ffc040', main: '#2a1a1a', second: '#b04a1a', hairM: 'bald', hairF: 'bald', outfit: 'tunic' },
  { id: 'construct', name: 'ลูกผสมจักรกล', scale: 1.06, head: 1, shoulders: 1.08, ears: 'round', lower: 'legs', gait: 'normal', skin: '#e8b48a', accent: '#c08a3a', feats: ['plates', 'rivets', 'steam', 'mecheye', 'mecharm'],
    hair: '#4a3a2a', eye: '#2a2a30', main: '#4a3a2a', second: '#3a3a44', hairM: 'short', hairF: 'long', outfit: 'tunic' },
  { id: 'soulmachine', name: 'หุ่นวิญญาณ', scale: 1.08, head: 0.98, shoulders: 1, ears: 'none', lower: 'legs', gait: 'normal', skin: '#c08a3a', accent: '#6ad0ff', feats: ['plates', 'rivets', 'core', 'visor', 'hairless', 'seams', 'steam'],
    hair: '#4a3a2a', eye: '#ffd040', main: '#5a5a64', second: '#3a3a44', hairM: 'short', hairF: 'short', outfit: 'tunic' },
  { id: 'mummy', name: 'มัมมี่', scale: 1.03, head: 0.98, shoulders: 0.96, ears: 'round', lower: 'legs', gait: 'shuffle', skin: '#c8a878', accent: '#e8c050', feats: ['wraps', 'usekh', 'kohl', 'dust', 'glow-eyes'],
    hair: '#2a2218', eye: '#7aff9a', main: '#d8d0b0', second: '#b8a888', hairM: 'bald', hairF: 'bald', outfit: 'tunic' },
  { id: 'ghoul', name: 'กูล', scale: 1, head: 0.98, shoulders: 0.86, ears: 'pointed', lower: 'legs', gait: 'shuffle', skin: '#8a9a8a', accent: '#6a2a2a', feats: ['gaunt', 'claws', 'ribs', 'hunger', 'sunkeneyes'],
    hair: '#2a2a28', eye: '#d0d8b0', main: '#4a4a3a', second: '#3a3a30', hairM: 'short', hairF: 'long', outfit: 'tunic' },
];

const raceOf = (id: string): RaceRow => RACES.find((r) => r.id === id) ?? RACES[0];

/** The look of a race at a stage: the body of the UI values, the colours of the race text. Women differ by build and hair. */
export function raceLook(row: RaceRow, o: { stage?: Stage; fem?: boolean; tool?: string; hat?: string; feats?: string[]; key?: string } = {}): PersonLook {
  const stage = o.stage ?? 'adult', fem = !!o.fem;
  const body: Body = { ...HUMAN_BODY, scale: row.scale, head: row.head, shoulders: row.shoulders, ears: row.ears, lower: row.lower, gait: row.gait };
  return {
    kind: 'person', key: o.key ?? `${row.id}-${stage}-${fem ? 'f' : 'm'}`, race: row.id, stage, fem, body,
    skin: row.skin, hairColor: row.hair, eye: row.eye, accent: row.accent, main: row.main, second: row.second,
    outfit: row.outfit, hair: fem ? row.hairF : row.hairM, hat: o.hat ?? row.hat ?? '', beard: row.beard ?? '', tool: o.tool ?? row.tool ?? '',
    feats: o.feats ?? row.feats, wear: stage === 'elder' ? 0.6 : 0.2,
  };
}

const STAGES: Stage[] = ['infant', 'child', 'teen', 'adult', 'elder'];

export const SET_DEFS: Record<string, SetDef> = {
  races: {
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
};

// one race at every stage, and one race with tools and a hat (the page plays the pose chosen on it)
for (const row of RACES) {
  SET_DEFS[`stages:${row.id}`] = {
    label: `${row.name} × วัย 5 (ชายและหญิง)`,
    entries: () => STAGES.flatMap((stage) => [false, true].map((fem) => ({ id: `${stage.slice(0, 3)}${fem ? '-f' : ''}`, label: `${row.name} ${stage}`, look: raceLook(row, { stage, fem }) }))),
  };
  SET_DEFS[`poses:${row.id}`] = {
    label: `${row.name} กับเครื่องมือ (เลือกท่าด้านบน)`,
    entries: () => [
      ...[['', 'มือเปล่า'], ['spear', 'หอก'], ['sword', 'ดาบ'], ['axe', 'ขวาน'], ['staff', 'ไม้เท้า']].map(([tool, name]) => ({ id: tool || 'bare', label: `${row.name} ${name}`, look: raceLook(row, { tool }) })),
      ...[['', 'มือเปล่า'], ['spear', 'หอก'], ['staff', 'ไม้เท้า']].map(([tool, name]) => ({ id: `${tool || 'bare'}-f`, label: `${row.name} หญิง ${name}`, look: raceLook(row, { fem: true, tool }) })),
      { id: 'hood', label: `${row.name} ฮู้ด`, look: raceLook(row, { hat: 'hood' }) },
    ],
  };
}

export { raceOf };
