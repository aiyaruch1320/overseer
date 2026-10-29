// People in town. A look is chosen from a seed (race and sub-line theme x build x height x skin x hair x beard x face mark x outfit by role and
// climate x pattern x two colours x headwear x tool); the look is then painted as vector art at whatever resolution the camera needs, with
// a full pose set (walk cycle, work swings, sit, kneel, cheer, wave, talk, read, cast) by src/render/characters.
import type Phaser from 'phaser';
import { RNG, hashString } from '../sim/rng';
import { type Look, lookKey } from '../render/characters/kit';
import { THEMES, themeOf, stageOf } from '../render/characters/themes';
import { POSE, FRAMES, WALK, CARRY_WALK, IDLE_STANDARD } from '../render/characters/pose';

export { POSE, FRAMES, WALK, CARRY_WALK, IDLE_STANDARD };
export type { Look };

// natural hair and eye colours: the fantastic ones belong to the peoples whose themes list them
const HAIR = [0x16110e, 0x241810, 0x34210f, 0x4a3018, 0x6a4424, 0x8a5a2c, 0xa87a3e, 0xc4a05a, 0xd8c088, 0x7a2e1a, 0x9a9aa2, 0x0e0c10];
const EYES = [0x1b1626, 0x2a1a10, 0x3a2a1a, 0x2a4a6a, 0x3a5a3a, 0x5a3a1e, 0x4a3a2a, 0x5a7a8a];

// What a person wears is one colour with one trim, not two colours at random: [base, trim]. Muted bases keep the eye on faces and on
// the few saturated accents; each calling and each people has its own family, so a crowd reads as one world.
type Scheme = [number, number];
const EARTH: Scheme[] = [[0x6b5a43, 0xb89a5a], [0x4d5a3c, 0xa8986a], [0x5e3b2e, 0xb08a52], [0x3c4a5c, 0x9aa6b4], [0x6a3430, 0xb89a5a], [0x4a4a52, 0xa89a6a], [0x7a6a52, 0x4a3a2a],
  [0x2f4a44, 0xb4a672], [0x58485e, 0xb8a880], [0x8a7a62, 0x5a4a3a], [0x3a3a3e, 0x8a3a32], [0x6e5c2e, 0x3a2a1a], [0x39503c, 0xc8b88a], [0x4a3a30, 0x9a8a6a]];
const JEWEL: Scheme[] = [[0x5a1f2e, 0xd0a84a], [0x1f3558, 0xd0a84a], [0x24493a, 0xd0a84a], [0x3f2a5a, 0xd0a84a], [0x22222a, 0xb0b4c0], [0x6a2a1a, 0xd0a84a]];
const MAGE: Scheme[] = [[0x24365a, 0xb8c0d8], [0x2e2a54, 0xc0a8e0], [0x1f4a50, 0xa8d0c8], [0x3a2a4a, 0xb0a0c0], [0x2a2a30, 0x8a94b0]];
const CLERGY: Scheme[] = [[0xe8e2d2, 0xc8a84a], [0xd6d0c0, 0x6a1a1a], [0x2a2a30, 0xb0b4c0], [0xe8e2d2, 0x3a5a8a], [0x6a5a3a, 0xe8e2d2]];
const HOUSE: Scheme[] = [[0x6a1a1a, 0xb0b4c0], [0x1f3558, 0xb0b4c0], [0x24493a, 0xb0b4c0], [0x22222a, 0xa8a090], [0x5a4a1a, 0xb0b4c0], [0x4a2a4a, 0xb0b4c0]];
const SCHEME_BY_OUTFIT: Record<string, Scheme[]> = { noble: JEWEL, regal: JEWEL, mage: MAGE, scholar: MAGE, robe: CLERGY, priest: CLERGY, monk: CLERGY, knight: HOUSE, armor: HOUSE, plate: HOUSE };

// what a role wears and carries (headwear is one of the options)
interface Style { o: string; t?: string; h?: string[] }
const ROLE_STYLE: Record<string, Style> = {
  ชาวบ้าน: { o: 'tunic', h: ['', '', 'cap', 'hood'] }, พ่อค้า: { o: 'vest', h: ['cap', '', 'turban'] }, พ่อค้าใหญ่: { o: 'vest', h: ['feather', 'cap'] },
  ทหารยาม: { o: 'armor', t: 'spear', h: ['helmet'] }, หัวหน้าทหารยาม: { o: 'knight', t: 'spear', h: ['helmet'] }, ทหาร: { o: 'armor', t: 'sword', h: ['helmet', 'helmet', 'bandana'] },
  อัศวิน: { o: 'knight', t: 'sword', h: ['helmet', ''] }, ผู้กล้า: { o: 'knight', t: 'sword', h: ['', 'circlet'] }, เด็ก: { o: 'tunic', h: ['', '', 'cap'] },
  นักบวช: { o: 'robe', t: 'staff', h: ['hood', ''] }, นักบวชประจำวิหาร: { o: 'robe', t: 'staff', h: ['hood', ''] }, ชาวนา: { o: 'farmer', t: 'hoe', h: ['straw'] },
  ช่างฝีมือ: { o: 'apron', t: 'hammer', h: ['', 'bandana'] }, ช่างไม้: { o: 'apron', t: 'hammer', h: ['', 'cap'] }, ช่างตีเหล็ก: { o: 'apron', t: 'hammer', h: ['', 'bandana'] },
  นักผจญภัย: { o: 'cloak', t: 'sword', h: ['hood', 'bandana', '', 'feather'] }, ผู้ใหญ่บ้าน: { o: 'noble', h: ['circlet', '', 'feather'] }, ขุนนาง: { o: 'noble', h: ['circlet', 'feather'] },
  ขอทาน: { o: 'rags', t: 'bowl', h: ['', 'hood'] }, เจ้าของโรงเตี๊ยม: { o: 'apron', t: 'mug', h: ['', 'bandana'] }, หมอยา: { o: 'robe', t: 'flask', h: ['hood', ''] },
  หมอยาประจำเมือง: { o: 'robe', t: 'flask', h: ['hood', ''] }, นักกวีพเนจร: { o: 'bard', t: 'lute', h: ['feather'] }, คนรัก: { o: 'tunic', h: [''] },
  เพื่อน: { o: 'tunic', h: ['', 'cap'] }, คู่แข่ง: { o: 'cloak', t: 'sword', h: ['', 'bandana'] }, อาจารย์: { o: 'scholar', t: 'book', h: ['', 'hood'] },
  คู่อาฆาต: { o: 'cloak', t: 'sword', h: ['hood'] }, คู่ชีวิต: { o: 'tunic', h: [''] }, พ่อแม่: { o: 'tunic', h: ['', 'cap', 'bandana'] },
  ชาวเรือ: { o: 'sailor', h: ['bandana', ''] }, ชาวประมง: { o: 'sailor', t: 'rod', h: ['straw', 'bandana'] }, นักเวท: { o: 'mage', t: 'orbstaff', h: ['wizard'] },
  นักปราชญ์: { o: 'scholar', t: 'book', h: ['', 'hood'] }, คนตัดไม้: { o: 'leather', t: 'axe', h: ['cap', 'hood', ''] }, คนงานเหมือง: { o: 'miner', t: 'pickaxe', h: ['minerhat'] },
  คนทำขนมปัง: { o: 'chef', t: 'ladle', h: ['chef'] }, ช่างตัดเสื้อ: { o: 'vest', h: ['', 'cap'] }, คนซักผ้า: { o: 'tunic', h: ['bandana', ''] },
  นายพราน: { o: 'leather', t: 'bow', h: ['hood', 'feather'] }, สัปเหร่อ: { o: 'cloak', t: 'shovel', h: ['hood'] }, คนกวาดถนน: { o: 'tunic', t: 'broom', h: ['cap', ''] },
  คนส่งสาร: { o: 'tunic', h: ['cap'] }, นักเล่นแร่แปรธาตุ: { o: 'robe', t: 'flask', h: ['wizard', 'hood'] }, คนเลี้ยงแกะ: { o: 'tunic', t: 'crook', h: ['straw', 'hood'] },
  ผู้ฝึกสัตว์: { o: 'leather', t: 'crook', h: ['', 'feather'] }, ผู้เฒ่า: { o: 'robe', h: ['', 'hood'] }, นักบวชนักรบ: { o: 'knight', t: 'staff', h: ['helmet'] },
  ทาส: { o: 'rags', h: [''] }, นักเต้น: { o: 'dress', h: ['veil', ''] }, ทารก: { o: 'tunic' },
};


/** sub-lines that mark rulers and the rare: townspeople seldom wear them */
const RARE_LINES = new Set(['summoned', 'reborn', 'king', 'emperor', 'pharaoh', 'high', 'mother', 'merrow', 'silent', 'chosen', 'shadowless']);
const CASUAL = ['tunic', 'vest', 'apron', 'farmer', 'light', 'sarong', 'fur', 'dress'];

export function lookFor(seed: string, race: string, role: string, o: { climate?: string; gender?: string; elder?: boolean; line?: string; hAge?: number } = {}): Look {
  const r = new RNG(hashString(seed));
  const th = themeOf(race);
  const st = ROLE_STYLE[role] || ROLE_STYLE.ชาวบ้าน;
  const sexless = race === 'slime' || race === 'soulmachine';
  const fem = sexless ? false : o.gender ? o.gender === 'หญิง' : r.chance(0.5);
  const stage = o.hAge !== undefined ? stageOf(o.hAge) : role === 'เด็ก' ? 'child' : o.elder ? 'elder' : 'adult';
  const child = stage === 'child' || stage === 'infant';
  const elder = stage === 'elder';
  // a sub-line of the people (docs/races/README.md): most townspeople are of the commonest lines, a few are of the rare ones
  const lineKeys = Object.keys(th.lines);
  let line = o.line;
  if (line === undefined && lineKeys.length && r.chance(0.7)) {
    const common = lineKeys.filter((k) => !RARE_LINES.has(k));
    line = common.length && !r.chance(0.04) ? r.pick(common) : r.pick(lineKeys);
  }
  const ln = line ? th.lines[line] : undefined;
  let outfit = st.o;
  let hat = r.pick(st.h || ['']);
  // climate dresses people: light robes and turbans in the desert, furs in the snow, wraps in the tropics
  const cl = o.climate || '';
  if (cl === 'desert' && ['tunic', 'farmer', 'vest'].includes(outfit) && r.chance(0.6)) outfit = 'light';
  if (cl === 'desert' && ['', 'cap', 'hood'].includes(hat) && r.chance(0.5)) hat = fem && r.chance(0.5) ? 'veil' : 'turban';
  if (cl === 'frozen' && ['tunic', 'farmer', 'vest', 'apron'].includes(outfit) && r.chance(0.6)) outfit = 'fur';
  if (cl === 'frozen' && ['', 'cap', 'straw'].includes(hat) && r.chance(0.6)) hat = 'furhat';
  if ((cl === 'tropical' || cl === 'islands') && outfit === 'tunic' && r.chance(0.45)) outfit = 'sarong';
  if (fem && !child && outfit === 'tunic' && r.chance(0.45)) outfit = 'dress';
  if (th.dress && !child && r.chance(0.8)) outfit = r.pick(th.dress);
  if (ln?.outfit && CASUAL.concat(['tunic']).includes(outfit) && !child) outfit = ln.outfit;
  const people = th.cloth && r.chance(0.75) ? th.cloth : EARTH;
  const scheme = r.pick(SCHEME_BY_OUTFIT[outfit] || people);
  const beard = !fem && !child && !th.hairless && stage !== 'teen' && r.chance(th.bearded ?? 0) ? r.int(1, 4) : 0;
  const skins = ln?.skins || th.skins;
  const hairs = ln?.hair || th.hairs || HAIR;
  const hairStyle = (() => {
    if (th.hairless) return 3;
    if (race === 'elf' || race === 'darkelf') return fem ? r.pick([13, 1, 2, 5, 13, 7]) : r.pick([13, 2, 0, 11, 5]);
    if ((race === 'dwarf' || race === 'orc') && !fem) return r.pick([12, 12, 3, 0, 4]);
    if (race === 'lavakin') return r.pick([4, 4, 10, 11]);
    return fem ? r.pick([1, 2, 5, 6, 7, 9, 10, 11, 0]) : r.pick([0, 0, 3, 4, 8, 10, 11, 2, 7]);
  })();
  const build = race === 'dwarf' || race === 'orc' || race === 'giant' ? r.pick([1, 2, 2]) : race === 'elf' || race === 'fae' ? r.pick([0, 0, 1]) : r.pick([0, 1, 1, 2]);
  return {
    race, role, child, fem, beard, outfit, hat, line, stage: stage === 'teen' || stage === 'infant' ? stage : undefined,
    skin: r.pick(skins), hair: r.pick(hairs), hairStyle: elder && !fem && r.chance(0.3) ? 3 : hairStyle,
    eye: r.pick(th.eyes || EYES), mark: r.chance(0.35) ? r.int(1, 4) : 0, build,
    tall: r.chance(race === 'elf' || race === 'darkelf' ? 0.6 : 0.25), cloth: scheme[0], cloth2: scheme[1], pattern: r.int(0, 5),
    tool: st.t || '', elder, accent: r.pick(ln?.accent || th.accent),
  };
}

export { lookKey };

/** the poses a person cycles through while standing about (a race breathes, flutters or glows its own way) */
export const idleFrames = (L: Look): number[] => L.sig || themeOf(L.race).idle;

// a wooden cradle with a baby in it (for the protagonist's first years), two rocking frames
export function cradleTex(scene: Phaser.Scene, skin: number, S = 2): string {
  const key = `cradle_${skin}_${S}`;
  if (scene.textures.exists(key)) return key;
  const cv = document.createElement('canvas');
  cv.width = 16 * S; cv.height = 12 * S;
  const x = cv.getContext('2d')!;
  const px = (a: number, b: number, c: number | string, w = 1, h = 1) => { x.fillStyle = typeof c === 'string' ? c : '#' + c.toString(16).padStart(6, '0'); x.fillRect(a * S, b * S, w * S, h * S); };
  px(2, 11, 'rgba(0,0,0,0.25)', 12, 1);
  px(1, 9, 0x6a4228, 14, 2); px(2, 5, 0x8a5a3a, 12, 5); px(3, 6, 0xf2ead8, 10, 3); px(4, 4, skin, 3, 3); px(5, 5, 0x1b1626, 1, 1);
  px(7, 5, 0xc8d8f0, 6, 2); px(12, 2, 0x8a5a3a, 2, 4); px(11, 1, 0xe8a0b0, 3, 2);
  scene.textures.addCanvas(key, cv);
  return key;
}

// the protagonist dressed for their career, age and homeland
const JOB_ROLE: Record<string, string> = {
  soldier: 'ทหาร', knight: 'อัศวิน', royal_guard: 'ทหารยาม', priest: 'นักบวช', monk: 'นักบวช', healer: 'หมอยา', mage: 'นักเวท', scholar: 'นักปราชญ์', warlock: 'นักเวท',
  alchemist: 'นักเล่นแร่แปรธาตุ', seer: 'นักเวท', merchant: 'พ่อค้า', innkeeper: 'เจ้าของโรงเตี๊ยม', cook: 'คนทำขนมปัง', farmer: 'ชาวนา', shepherd: 'คนเลี้ยงแกะ',
  smith: 'ช่างตีเหล็ก', carpenter: 'ช่างไม้', miner: 'คนงานเหมือง', bard: 'นักกวีพเนจร', performer: 'นักกวีพเนจร', noble: 'ขุนนาง', diplomat: 'ขุนนาง', sailor: 'ชาวเรือ',
  fisher: 'ชาวประมง', pirate: 'ชาวเรือ', hunter: 'นายพราน', thief: 'นักผจญภัย', adventurer: 'นักผจญภัย', hero: 'ผู้กล้า', hero_companion: 'นักผจญภัย', sage: 'นักปราชญ์',
  archmage: 'นักเวท', scribe: 'นักปราชญ์', weaver: 'ช่างตัดเสื้อ', gravekeeper: 'สัปเหร่อ', tamer: 'ผู้ฝึกสัตว์', druid: 'นักบวช', paladin: 'นักบวชนักรบ', prophet: 'นักบวช',
};
export const JOB_WORK: Record<string, string> = {
  soldier: 'train', knight: 'train', royal_guard: 'patrol', priest: 'pray', monk: 'pray', healer: 'heal', mage: 'cast', scholar: 'read', warlock: 'cast', alchemist: 'brew',
  seer: 'cast', merchant: 'sell', innkeeper: 'serve', cook: 'cook', farmer: 'hoe', shepherd: 'tend', smith: 'hammer', carpenter: 'hammer', miner: 'dig', bard: 'sing',
  performer: 'sing', noble: 'stroll', diplomat: 'stroll', sailor: 'haul', fisher: 'fish', pirate: 'haul', hunter: 'hunt', thief: 'stroll', adventurer: 'train', hero: 'train',
  sage: 'read', archmage: 'cast', scribe: 'read', weaver: 'sew', gravekeeper: 'dig', tamer: 'tend', druid: 'pray', prophet: 'pray',
};
export function heroLook(c: { name: string; dynastyName: string; race: string; gender: string; job?: string | null; hAge: number }, climate: string): Look {
  const stage = stageOf(c.hAge);
  const child = stage === 'child' || stage === 'infant';
  const role = child ? 'เด็ก' : JOB_ROLE[c.job || ''] || (c.hAge < 20 ? 'ชาวบ้าน' : 'นักผจญภัย');
  return lookFor(`hero:${c.name}:${c.dynastyName}`, c.race, role, { climate, gender: c.gender, hAge: c.hAge });
}

/** every race has its own look; how many distinct people the painter can produce */
export const LOOK_COMBOS = Object.values(THEMES).reduce((a, t) => a + t.skins.length * (Object.keys(t.lines).length + 1), 0) * 12 * HAIR.length * 5 * 5 * 3 * 2 * 18 * EARTH.length * 6 * 6;
