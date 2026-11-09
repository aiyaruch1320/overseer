// What a scene puts on its stage besides the painted place (M7 ข1): the props and the kind of place a script asks for. The docs name them in the words of the
// scene (13-storyline-scenes §2 §3: the craft table, the roots, the anvil; 12-event-visuals: the pearl egg; 15-npc-clash-scenes: the eternal flame, the people
// who watch, the cliff). Pure: the words in, a list out. The painters are src/art/scenery/props.ts.
import type { SceneScript } from '../core/data/types-scenes';
import type { Setting } from '../art/scenery/types';

/** What a scene is in: the props, and the setting when the words of its place do not say it (the nest of a dragon is in the sky, a dwarf's end is in the forge). */
export interface Staging {
  props: string[];
  setting?: Setting;
}

/** The two letters of a tribe in the id of its rite (`rite.dw`) or destination (`dest.dw`) and its story nodes (`dw.e1`). */
const TRIBE_SCENE: Record<string, Staging & { endProps?: string[] }> = {
  hu: { props: [] },
  el: { props: ['roots'], endProps: ['roots'], setting: 'outdoor' },
  de: { props: ['candle:#b070e0'], setting: 'indoor' },
  dw: { props: ['anvil'], setting: 'indoor' },
  or: { props: ['campfire'], endProps: ['campfire'], setting: 'outdoor' },
  ha: { props: ['longtable'], setting: 'indoor' },
  na: { props: ['obelisk'], setting: 'outdoor' },
  va: { props: ['cup:#aa1c28', 'candle:#c03040'], setting: 'indoor' },
  fa: { props: ['blossoms'], setting: 'outdoor' },
  dk: { props: ['spectators'], setting: 'outdoor' },
  dm: { props: ['worktable:#2a2630'], setting: 'indoor' },
  me: { props: [], endProps: ['pearl'] },
  wi: { props: ['cliff'], setting: 'outdoor' },
  gi: { props: ['stone'], setting: 'outdoor' },
  co: { props: ['worktable:#e4e8ee'], setting: 'indoor' },
  mu: { props: ['scales'], setting: 'indoor' },
  gh: { props: ['candle:#8aa87a'], setting: 'indoor' },
};

/** Words of a scene and the prop each asks for. Only the place and the first lines are read: they are where the docs set the scene. */
const WORDS: [RegExp, string, Setting?][] = [
  [/เพลิงนิรันดร์/, 'flame'],
  [/กองไฟ|กองฟืน/, 'campfire'],
  [/ทั่ง/, 'anvil'],
  [/ไข่(?:ใหญ่|เรือง|มุก)|ไข่ใบที่/, 'egg', 'outdoor'],
  [/หน้าผา|ขอบเหว/, 'cliff', 'outdoor'],
  [/ผู้ชม/, 'spectators'],
  [/โอเบลิสก์/, 'obelisk'],
  [/ตาชั่ง/, 'scales'],
  [/ถ้วยเลือด/, 'cup:#aa1c28'],
  [/โต๊ะช่าง|โต๊ะผ่าตัด/, 'worktable'],
  [/รากต้นไม้|ต้นไม้โลก/, 'roots'],
];

/** How many of the first lines of text are read for the words of the scene. */
const FIRST_LINES = 4;
const tribeOf = (id: string): string | undefined => id.match(/^(?:rite|dest)\.([a-z]{2})$/)?.[1] ?? id.match(/^([a-z]{2})\.e\d+$/)?.[1];

/** The staging of a script: the table of its tribe (a rite or an end), else the words of its place and first lines. `place` is the place the frame names now (the variants of a rite change it). */
export function stagingOf(script: Pick<SceneScript, 'id' | 'beats'>, place = ''): Staging {
  const t = tribeOf(script.id);
  const tribe = t ? TRIBE_SCENE[t] : undefined;
  const props: string[] = [];
  let setting: Setting | undefined = tribe?.setting;
  if (tribe) props.push(...(/^rite\./.test(script.id) ? tribe.props : tribe.endProps ?? tribe.props));
  // the human rite changes with the land of birth: the guild yard of the plain has the craft table of the docs (13 §2), the others have their own
  if (script.id === 'rite.hu' && /ทุ่งราบ/.test(place)) props.push('worktable');
  const text = [place, ...script.beats.filter((b) => b.k === 'text').slice(0, FIRST_LINES).map((b) => (b as { text: string }).text), ...script.beats.filter((b) => b.k === 'bg').map((b) => (b as { place: string }).place)].join(' ');
  if (!tribe)
    for (const [re, prop, set] of WORDS)
      if (re.test(text) && !props.includes(prop)) {
        props.push(prop);
        if (set) setting = set;
      }
  return { props, ...(setting ? { setting } : {}) };
}
