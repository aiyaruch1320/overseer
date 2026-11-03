// Sets of the characters page for the part tables of M6: one human per id, with the id under it (outfits, hair and beards, hats, tools).
// `tools:attack` carries `pose: 'attack'`; the page plays one pose for a whole set, so until it reads that field open it with `&pose=attack`.
import type { Pose } from '../anim';
import { BEARD_IDS, HAIR_IDS, HAT_IDS, OUTFIT_IDS, TOOL_IDS } from '../parts/ids';
import { human, type Entry, type SetDef } from './sets';

type PartsSet = SetDef & { pose?: Pose };

// muted colours of the world: a main and a second that read against each other, and a single bright accent
const SCHEMES = [
  { main: '#6a5a46', second: '#3e4a5a', accent: '#c9a24a' },
  { main: '#7a3a34', second: '#4a4036', accent: '#c9a24a' },
  { main: '#4e5e48', second: '#6a5238', accent: '#d9a030' },
  { main: '#4a4e70', second: '#8a8068', accent: '#c9a24a' },
];

const FACES = [
  { skin: '#e8b48a', hairColor: '#3a2a20' },
  { skin: '#c98e62', hairColor: '#241a14' },
  { skin: '#e2b896', hairColor: '#8a5a2e' },
  { skin: '#a9764e', hairColor: '#d8d2c8' },
];

type Over = Partial<Parameters<typeof human>[0]>;
const labelled = (kind: string, ids: readonly string[], over: (id: string, i: number) => Over): Entry[] =>
  ids.map((id, i) => {
    const sc = SCHEMES[i % SCHEMES.length], face = FACES[i % FACES.length];
    return { id, label: `${kind} ${id}`, look: human({ key: `${kind}-${id}`, ...sc, ...face, ...over(id, i) }) };
  });

const toolSet = (): Entry[] => labelled('tool', TOOL_IDS, (id) => ({ tool: id, outfit: 'tunic', hair: 'short', wear: 0.2 }));
const small = (kind: 'outfit' | 'hat' | 'tool', ids: readonly string[]): Entry[] =>
  (['child', 'teen'] as const).flatMap((stage) =>
    labelled(stage, ids, (id) => ({ [kind]: id, stage, hair: 'short', ...(kind === 'outfit' ? {} : { outfit: 'tunic' }), wear: 0.2 })));

export const SET_DEFS: Record<string, PartsSet> = {
  outfits: {
    label: 'ชุด (หนึ่งตัวต่อหนึ่งรหัส)',
    entries: () => labelled('outfit', OUTFIT_IDS, (id, i) => ({ outfit: id, hair: i % 3 === 0 ? 'long' : 'short', fem: id === 'dress', wear: id === 'rags' ? 0.9 : id === 'tunic' ? 0.4 : 0.15 })),
  },
  'outfits:small': { label: 'ชุด เด็กและวัยรุ่น', entries: () => small('outfit', OUTFIT_IDS) },
  hair: {
    label: 'ผม และ เครา',
    entries: () => [
      ...labelled('hair', HAIR_IDS, (id, i) => ({ hair: id, fem: i % 2 === 1, outfit: 'tunic' })),
      ...labelled('beard', BEARD_IDS, (id) => ({ beard: id, hair: 'short', outfit: 'tunic' })),
    ],
  },
  'hair:hats': {
    label: 'ผมใต้หมวก (ผมที่ชูขึ้นกับหมวกที่คลุมหัว)',
    entries: () => ['bun', 'topknot', 'mohawk', 'ponytail', 'long', 'braid'].flatMap((h) =>
      ['helmet', 'hood', 'wide', 'cap', 'circlet', 'wizard'].map((hat, i) => ({ id: `${h}/${hat}`, label: `${h} ${hat}`, look: human({ key: `hh-${h}-${hat}`, hair: h, hat, outfit: 'tunic', ...SCHEMES[i % 4] }) }))),
  },
  hats: {
    label: 'หมวก',
    entries: () => labelled('hat', HAT_IDS, (id, i) => ({ hat: id, hair: (['short', 'long', 'braid', 'bun'] as const)[i % 4], outfit: 'tunic', beard: i % 5 === 2 ? 'short' : '' })),
  },
  'hats:small': { label: 'หมวก เด็กและวัยรุ่น', entries: () => small('hat', HAT_IDS) },
  tools: { label: 'เครื่องมือและอาวุธ', entries: toolSet },
  'tools:attack': { label: 'เครื่องมือ ท่าโจมตี (เปิดด้วย pose=attack)', pose: 'attack', entries: toolSet },
  'tools:small': { label: 'เครื่องมือ เด็กและวัยรุ่น', entries: () => small('tool', TOOL_IDS) },
};
