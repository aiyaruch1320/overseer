// Layered pixel-art people (16×24 px per frame). A look comes from a seed:
// race body × build × height × skin × hair style/colour × beard × face mark × outfit (by role and climate) × pattern
// × two colours × headwear × tool. Every look is drawn as a strip of pose frames, so people walk with a step cycle,
// swing tools, sit, kneel, carry babies and cheer instead of sliding around as a still image.
import type Phaser from 'phaser';
import { RNG, hashString } from '../sim/rng';

export const POSE = { idle: 0, breath: 1, walk0: 2, walk1: 3, walk2: 4, walk3: 5, work0: 6, work1: 7, sit: 8, carry0: 9, carry1: 10, carry2: 11, cheer: 12, kneel: 13 } as const;
export type Pose = keyof typeof POSE;
export const FRAMES = 14;
export const WALK = [POSE.walk0, POSE.walk1, POSE.walk2, POSE.walk3];
export const CARRY_WALK = [POSE.carry1, POSE.carry0, POSE.carry2, POSE.carry0];

export interface Look {
  race: string; role: string; skin: number; hair: number; hairStyle: number; beard: number; eye: number; mark: number;
  build: number; tall: boolean; outfit: string; cloth: number; cloth2: number; pattern: number; hat: string; tool: string;
  child: boolean; elder: boolean; fem: boolean;
}

const SKIN: Record<string, number[]> = {
  human: [0xf6d2b0, 0xe8b48a, 0xc98e62, 0xa06a42, 0x7a4a2a, 0xf0c8a0, 0xd8a070], halfling: [0xf0c49a, 0xe0a878, 0xc88a5a, 0xa87048], elf: [0xf6e0c8, 0xf2d6b8, 0xe8c8a8, 0xd8b890],
  darkelf: [0x7a6a8f, 0x6a5a80, 0x8a7aa0, 0x5a4a70], dwarf: [0xe0a07a, 0xd08a62, 0xb87050, 0x9a6040], orc: [0x6f9a4f, 0x5a8a40, 0x7aa860, 0x8a9a5a], beast: [0xc98f5a, 0xb07a48, 0xe0b080, 0x8a6a4a, 0x6a5a4a, 0xf0e0d0],
  naga: [0x4f8f7a, 0x5a9a6a, 0x3a7a8a, 0x6a8a4a], dragonkin: [0xb04a3a, 0x9a3a2a, 0x3a6aa0, 0x2a8a5a, 0x8a6a2a], vampire: [0xe8e0e8, 0xd8d0e0, 0xf0e8e0], fae: [0xf0d0f0, 0xd0f0e0, 0xd0e0ff, 0xfff0c0],
  slime: [0x5ab0e8, 0x7ad070, 0xe07ab0, 0xe0c04a, 0xa070e0], demonkin: [0xc06070, 0xa04a5a, 0x8a3a6a, 0x6a4a8a], merfolk: [0x9ad0d0, 0x8ac0e0, 0xa0d8c0, 0xc0e0f0],
};
const HAIR = [0x2a1a10, 0x5a3a1e, 0x9a5a2a, 0xd9a030, 0xe8e0a0, 0xc0c0c8, 0x9a2a1a, 0x2a4a8a, 0x6a2a8a, 0x2a6a4a, 0xf0f0f0, 0x1a1020, 0xe07a9a, 0x3a8ac0];
const CLOTH = [0x8a3a2a, 0x2a5a8a, 0x3a7a3a, 0x7a5a2a, 0x5a3a7a, 0x8a7a3a, 0x3a3a4a, 0xa05a2a, 0x2a7a7a, 0xb0a080, 0xc06a8a, 0x4a6a9a, 0x6a8a3a, 0x9a4a6a];
const EYES = [0x1b1626, 0x1b1626, 0x2a5a8a, 0x3a7a3a, 0x7a4a2a, 0x8a2a8a];

// what a role wears and carries (headwear is one of the options)
interface Style { o: string; t?: string; h?: string[] }
const ROLE_STYLE: Record<string, Style> = {
  ชาวบ้าน: { o: 'tunic', h: ['', '', 'cap', 'hood', 'flower'] }, พ่อค้า: { o: 'vest', h: ['cap', '', 'turban'] }, พ่อค้าใหญ่: { o: 'vest', h: ['feather', 'cap'] },
  ทหารยาม: { o: 'armor', t: 'spear', h: ['helmet'] }, หัวหน้าทหารยาม: { o: 'knight', t: 'spear', h: ['helmet'] }, ทหาร: { o: 'armor', t: 'sword', h: ['helmet', 'helmet', 'bandana'] },
  อัศวิน: { o: 'knight', t: 'sword', h: ['helmet', ''] }, ผู้กล้า: { o: 'knight', t: 'sword', h: ['', 'circlet'] }, เด็ก: { o: 'tunic', h: ['', '', 'cap', 'flower'] },
  นักบวช: { o: 'robe', t: 'staff', h: ['hood', ''] }, นักบวชประจำวิหาร: { o: 'robe', t: 'staff', h: ['hood', ''] }, ชาวนา: { o: 'farmer', t: 'hoe', h: ['straw'] },
  ช่างฝีมือ: { o: 'apron', t: 'hammer', h: ['', 'bandana'] }, ช่างไม้: { o: 'apron', t: 'hammer', h: ['', 'cap'] }, ช่างตีเหล็ก: { o: 'apron', t: 'hammer', h: ['', 'bandana'] },
  นักผจญภัย: { o: 'cloak', t: 'sword', h: ['hood', 'bandana', '', 'feather'] }, ผู้ใหญ่บ้าน: { o: 'noble', h: ['circlet', '', 'feather'] }, ขุนนาง: { o: 'noble', h: ['circlet', 'feather'] },
  ขอทาน: { o: 'rags', t: 'bowl', h: ['', 'hood'] }, เจ้าของโรงเตี๊ยม: { o: 'apron', t: 'mug', h: ['', 'bandana'] }, หมอยา: { o: 'robe', t: 'flask', h: ['hood', ''] },
  หมอยาประจำเมือง: { o: 'robe', t: 'flask', h: ['hood', ''] }, นักกวีพเนจร: { o: 'bard', t: 'lute', h: ['feather'] }, คนรัก: { o: 'tunic', h: ['', 'flower'] },
  เพื่อน: { o: 'tunic', h: ['', 'cap'] }, คู่แข่ง: { o: 'cloak', t: 'sword', h: ['', 'bandana'] }, อาจารย์: { o: 'scholar', t: 'book', h: ['', 'hood'] },
  คู่อาฆาต: { o: 'cloak', t: 'sword', h: ['hood'] }, คู่ชีวิต: { o: 'tunic', h: ['', 'flower'] }, พ่อแม่: { o: 'tunic', h: ['', 'cap', 'bandana'] },
  ชาวเรือ: { o: 'sailor', h: ['bandana', ''] }, ชาวประมง: { o: 'sailor', t: 'rod', h: ['straw', 'bandana'] }, นักเวท: { o: 'mage', t: 'orbstaff', h: ['wizard'] },
  นักปราชญ์: { o: 'scholar', t: 'book', h: ['', 'hood'] }, คนตัดไม้: { o: 'leather', t: 'axe', h: ['cap', 'hood', ''] }, คนงานเหมือง: { o: 'miner', t: 'pickaxe', h: ['minerhat'] },
  คนทำขนมปัง: { o: 'chef', t: 'ladle', h: ['chef'] }, ช่างตัดเสื้อ: { o: 'vest', h: ['', 'cap'] }, คนซักผ้า: { o: 'tunic', h: ['bandana', ''] },
  นายพราน: { o: 'leather', t: 'bow', h: ['hood', 'feather'] }, สัปเหร่อ: { o: 'cloak', t: 'shovel', h: ['hood'] }, คนกวาดถนน: { o: 'tunic', t: 'broom', h: ['cap', ''] },
  คนส่งสาร: { o: 'tunic', h: ['cap'] }, นักเล่นแร่แปรธาตุ: { o: 'robe', t: 'flask', h: ['wizard', 'hood'] }, คนเลี้ยงแกะ: { o: 'tunic', t: 'crook', h: ['straw', 'hood'] },
  ผู้ฝึกสัตว์: { o: 'leather', t: 'crook', h: ['', 'feather'] }, ผู้เฒ่า: { o: 'robe', h: ['', 'hood'] }, นักบวชนักรบ: { o: 'knight', t: 'staff', h: ['helmet'] },
  ทาส: { o: 'rags', h: [''] }, นักเต้น: { o: 'dress', h: ['flower', 'veil'] }, ทารก: { o: 'tunic' },
};

export function lookFor(seed: string, race: string, role: string, o: { climate?: string; gender?: string; elder?: boolean } = {}): Look {
  const r = new RNG(hashString(seed));
  const st = ROLE_STYLE[role] || ROLE_STYLE.ชาวบ้าน;
  const fem = o.gender ? o.gender === 'หญิง' : r.chance(0.5);
  const child = role === 'เด็ก';
  let outfit = st.o;
  let hat = r.pick(st.h || ['']);
  // climate dresses people: light robes and turbans in the desert, furs in the snow, wraps in the tropics
  const cl = o.climate || '';
  if (cl === 'desert' && ['tunic', 'farmer', 'vest'].includes(outfit) && r.chance(0.6)) outfit = 'light';
  if (cl === 'desert' && ['', 'cap', 'hood'].includes(hat) && r.chance(0.5)) hat = fem && r.chance(0.5) ? 'veil' : 'turban';
  if (cl === 'frozen' && ['tunic', 'farmer', 'vest', 'apron'].includes(outfit) && r.chance(0.6)) outfit = 'fur';
  if (cl === 'frozen' && ['', 'cap', 'flower', 'straw'].includes(hat) && r.chance(0.6)) hat = 'furhat';
  if ((cl === 'tropical' || cl === 'islands') && outfit === 'tunic' && r.chance(0.45)) outfit = 'sarong';
  if ((cl === 'tropical' || cl === 'islands') && hat === '' && r.chance(0.3)) hat = 'flower';
  if (fem && !child && outfit === 'tunic' && r.chance(0.45)) outfit = 'dress';
  const beardy = ['human', 'dwarf', 'orc', 'halfling', 'demonkin'].includes(race);
  const beard = !fem && !child && beardy && r.chance(race === 'dwarf' ? 0.95 : 0.4) ? r.int(1, 4) : 0;
  return {
    race, role, child, fem, beard, outfit, hat,
    skin: r.pick(SKIN[race] || SKIN.human), hair: r.pick(HAIR), hairStyle: fem ? r.pick([1, 2, 5, 6, 7, 9, 10, 11, 0]) : r.pick([0, 0, 3, 4, 8, 10, 11, 2, 7]),
    eye: r.pick(EYES), mark: r.chance(0.35) ? r.int(1, 4) : 0, build: race === 'dwarf' || race === 'orc' ? r.pick([1, 2, 2]) : r.pick([0, 1, 1, 2]),
    tall: r.chance(race === 'elf' || race === 'darkelf' ? 0.6 : 0.25), cloth: r.pick(CLOTH), cloth2: r.pick(CLOTH), pattern: r.int(0, 5),
    tool: st.t || '', elder: o.elder ?? r.chance(0.12),
  };
}

const shade = (c: number, f: number) => ((Math.min(255, ((c >> 16) & 255) * f) << 16) | (Math.min(255, ((c >> 8) & 255) * f) << 8) | Math.min(255, (c & 255) * f)) >>> 0;

type Arm = 'down' | 'fwd' | 'back' | 'up' | 'strike' | 'hold';
interface P { body: number; lLeg: number; rLeg: number; lArm: Arm; rArm: Arm; legs: 'stand' | 'sit' | 'kneel'; tool: 'side' | 'raise' | 'strike' | 'hold' | 'none'; bundle?: boolean }
const base: P = { body: 0, lLeg: 0, rLeg: 0, lArm: 'down', rArm: 'down', legs: 'stand', tool: 'side' };
const PP: P[] = [
  base,
  { ...base, body: 1 },
  { ...base, lLeg: 1, lArm: 'back', rArm: 'fwd' },
  { ...base, body: -1 },
  { ...base, rLeg: 1, lArm: 'fwd', rArm: 'back' },
  { ...base, body: -1 },
  { ...base, rArm: 'up', tool: 'raise' },
  { ...base, body: 1, rArm: 'strike', lArm: 'fwd', tool: 'strike' },
  { ...base, body: 3, legs: 'sit', tool: 'hold' },
  { ...base, lArm: 'hold', rArm: 'hold', tool: 'none', bundle: true },
  { ...base, lLeg: 1, lArm: 'hold', rArm: 'hold', tool: 'none', bundle: true },
  { ...base, rLeg: 1, lArm: 'hold', rArm: 'hold', tool: 'none', bundle: true },
  { ...base, body: -1, lArm: 'up', rArm: 'up', tool: 'raise' },
  { ...base, body: 3, legs: 'kneel', lArm: 'hold', rArm: 'hold', tool: 'none' },
];

// draw one pose of a look at scale S, with the frame's top-left at (0,0)
export function drawPerson(ctx: CanvasRenderingContext2D, L: Look, S: number, frame: number) {
  const px = (x: number, y: number, c: number, w = 1, h = 1) => { ctx.fillStyle = '#' + (c >>> 0).toString(16).padStart(6, '0'); ctx.fillRect(x * S, y * S, w * S, h * S); };
  const p = PP[frame] || base;
  const K = 0x1b1626;
  const off = L.child ? 5 : 0; // children are shorter: big head, short body
  const ty = L.tall && !L.child ? -1 : 0;
  const B = p.body + ty;
  const hair = L.elder ? 0xd0d0d8 : L.hair;
  const out = L.outfit;
  if (L.race === 'slime') {
    // a blob that squashes and stretches as it hops
    const sq = frame === POSE.walk1 || frame === POSE.walk3 ? 1 : frame === POSE.cheer ? -2 : 0;
    const jump = frame === POSE.cheer ? -3 : frame === POSE.walk0 || frame === POSE.walk2 ? -1 : 0;
    px(4, 22, shade(L.skin, 0.4), 8, 1);
    px(3 - sq, 12 + sq * 2 + jump, L.skin, 10 + sq * 2, 11 - sq * 2); px(4, 10 + sq * 2 + jump, L.skin, 8, 2); px(5, 9 + sq * 2 + jump, L.skin, 6, 1);
    px(5, 14 + sq + jump, K, 2, 2); px(9, 14 + sq + jump, K, 2, 2); px(5, 11 + sq * 2 + jump, 0xffffff, 2, 1);
    if (L.hat === 'flower') px(9, 8 + sq * 2 + jump, 0xf06aa0, 2, 2);
    return;
  }
  // body geometry by build
  const tx = L.build === 0 ? 5 : L.build === 2 ? 3 : 4;
  const tw = 16 - tx * 2;
  const lx = L.build === 2 ? 4 : 5, rx = L.build === 2 ? 10 : 9;
  const T0 = 11 + off + B; // shoulders
  const H0 = 17 + off; // hips
  const HT = 4 + off + B; // top of head
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(4 * S, 23 * S, 8 * S, S);
  // wings / tails behind the body
  if (L.race === 'fae') { px(1, T0 - 2, 0xe0f8ff, 3, 6); px(12, T0 - 2, 0xe0f8ff, 3, 6); px(2, T0 - 1, 0xffffff, 1, 3); px(13, T0 - 1, 0xffffff, 1, 3); }
  if (L.race === 'dragonkin' || L.race === 'demonkin') px(12, T0 + 5, shade(L.skin, 0.8), 3, 2);
  if (L.race === 'beast') px(12, T0 + 4, L.hair, 2, 4);
  if (out === 'cloak' || out === 'knight' || (out === 'noble' && L.pattern < 3)) px(tx - 1, T0, shade(L.cloth2, 0.7), tw + 2, 22 - T0); // cape
  // legs / lower body
  const shoe = out === 'fur' ? 0x6a4a2a : 0x3a2a1a;
  const pant = ['robe', 'mage', 'monk'].includes(out) ? L.cloth : out === 'armor' || out === 'knight' ? 0x8a90a0 : shade(L.cloth2, 0.6);
  if (L.race === 'naga') { px(5, H0, L.skin, 6, 4); px(7, 21, L.skin, 6, 2); px(11 + (p.lLeg - p.rLeg), 20, shade(L.skin, 0.8), 2, 2); }
  else if (L.race === 'merfolk') { px(5, H0, L.skin, 6, 4); px(4 + (p.lLeg - p.rLeg), 21, shade(L.skin, 0.8), 8, 2); }
  else if (p.legs === 'sit') { px(lx, H0 + 3, pant, 2, 2); px(rx, H0 + 3, pant, 2, 2); px(lx - 1, 21, pant, 2, 1); px(rx + 1, 21, pant, 2, 1); px(lx - 1, 22, shoe, 2, 1); px(rx + 1, 22, shoe, 2, 1); }
  else if (p.legs === 'kneel') { px(lx - 1, 21, pant, 3, 2); px(rx, 21, pant, 3, 2); px(lx - 2, 22, shoe, 1, 1); px(rx + 3, 22, shoe, 1, 1); }
  else {
    const top = H0 + ty;
    px(lx, top, pant, 2, 22 - top - p.lLeg); px(rx, top, pant, 2, 22 - top - p.rLeg);
    px(lx, 22 - p.lLeg, shoe, 2, 1); px(rx, 22 - p.rLeg, shoe, 2, 1);
  }
  // skirts and robes cover the legs
  const skirt = ['robe', 'mage', 'dress', 'sarong', 'monk', 'scholar', 'light'].includes(out);
  if (skirt && p.legs === 'stand' && !['naga', 'merfolk'].includes(L.race)) {
    const flare = out === 'dress' ? 1 : 0;
    const bottom = out === 'sarong' || out === 'light' ? 20 : out === 'scholar' ? 19 : 21;
    const c = out === 'sarong' ? L.cloth2 : out === 'scholar' ? shade(L.cloth, 0.8) : L.cloth;
    px(tx - flare, H0 + ty, c, tw + flare * 2, bottom - (H0 + ty) + 1);
    if (out === 'sarong') for (let k = 0; k < tw; k += 2) px(tx + k, bottom - 1, shade(L.cloth2, 0.7), 1, 1);
    if (out === 'dress') px(tx - 1, bottom, shade(c, 0.75), tw + 2, 1);
  }
  // torso
  let top = L.cloth;
  if (out === 'armor' || out === 'knight') top = 0x9aa0b0;
  if (out === 'chef') top = 0xf2efe6;
  if (out === 'fur') top = 0x8a6a4a;
  if (out === 'leather') top = 0x7a5232;
  if (out === 'monk') top = 0xd88a2a;
  px(tx, T0, top, tw, 6);
  if (out === 'robe') px(7, T0, 0xf2c94c, 2, 6);
  if (out === 'mage') { px(tx, T0 + 4, shade(L.cloth, 0.7), tw, 1); px(7, T0 + 1, L.cloth2, 2, 2); }
  if (out === 'armor') { px(tx, T0 + 2, 0x6a7080, tw, 1); px(7, T0 + 3, 0x6a7080, 2, 3); }
  if (out === 'knight') { px(tx + 2, T0, L.cloth, tw - 4, 6); px(7, T0 + 1, 0xf2c94c, 2, 3); px(tx, T0, 0xc9ccd6, 2, 2); px(tx + tw - 2, T0, 0xc9ccd6, 2, 2); }
  if (out === 'vest') { px(tx, T0, shade(top, 0.7), 2, 6); px(tx + tw - 2, T0, shade(top, 0.7), 2, 6); px(tx + 2, T0, 0xf0e8d8, tw - 4, 6); px(tx + tw - 3, T0 + 4, 0xd9a030, 2, 2); }
  if (out === 'apron') px(tx + 1, T0 + 1, 0xd8c8a8, tw - 2, 7);
  if (out === 'farmer') { px(tx + 1, T0 + 1, 0x5a7aa0, tw - 2, 6); px(tx + 1, T0, 0x5a7aa0, 1, 1); px(tx + tw - 2, T0, 0x5a7aa0, 1, 1); }
  if (out === 'miner') { px(tx + 1, T0 + 1, 0x6a5a3a, tw - 2, 6); px(tx, T0 + 5, 0x3a2a1a, tw, 1); }
  if (out === 'chef') { px(tx + 1, T0 + 2, 0xd8d0c0, tw - 2, 1); px(7, T0 + 1, 0x1b1626, 1, 1); px(7, T0 + 3, 0x1b1626, 1, 1); }
  if (out === 'rags') { px(tx, T0, 0x8a7a6a, tw, 6); px(tx + 2, T0 + 2, 0x6a5a4a, 2, 2); px(tx + 5, T0 + 4, 0x6a5a4a, 1, 2); px(tx, T0 + 6, 0x8a7a6a, 1, 1); px(tx + tw - 2, T0 + 6, 0x8a7a6a, 1, 1); }
  if (out === 'noble') { px(tx, T0, 0x6a2a8a, 1, 6); px(tx + tw - 1, T0, 0x6a2a8a, 1, 6); px(7, T0, 0xf2c94c, 2, 1); px(tx + 1, T0 + 5, 0xf2c94c, tw - 2, 1); }
  if (out === 'bard') { px(tx, T0, L.cloth2, tw / 2, 6); }
  if (out === 'sailor') for (let i = 0; i < 6; i += 2) px(tx, T0 + i, 0xf6f2e8, tw, 1);
  if (out === 'fur') { px(tx, T0, 0xe8e0d0, tw, 1); px(tx, T0 + 5, 0xe8e0d0, tw, 1); px(7, T0 + 1, 0x5a3a1a, 2, 4); }
  if (out === 'light') { px(tx, T0, 0xf0e6cc, tw, 6); px(tx, T0 + 3, L.cloth, tw, 1); }
  if (out === 'leather') { for (let k = 0; k < 6; k++) px(tx + k, T0 + k, 0x4a2e1a, 1, 1); }
  if (out === 'scholar') { px(7, T0, shade(L.cloth, 0.7), 2, 6); px(8, T0 + 1, 0xf2c94c, 1, 1); px(8, T0 + 3, 0xf2c94c, 1, 1); }
  if (out === 'dress') { px(tx, T0 + 3, L.cloth2, tw, 1); }
  if (out === 'monk') { for (let k = 0; k < 6; k++) px(tx + tw - 1 - k, T0 + k, 0xa85a1a, 1, 1); }
  // patterns make the same outfit look different on different people
  if (!['armor', 'knight', 'rags', 'sailor', 'chef'].includes(out)) {
    if (L.pattern === 1) { px(tx, T0 + 4, 0x3a2a1a, tw, 1); px(7, T0 + 4, 0xd9a030, 2, 1); }
    if (L.pattern === 2) for (let i = 1; i < 6; i += 2) px(tx, T0 + i, shade(top, 0.8), tw, 1);
    if (L.pattern === 3) for (let k = 0; k < 6; k++) px(tx + tw - 1 - k, T0 + k, L.cloth2, 1, 1);
    if (L.pattern === 4) { px(8, T0 + 1, 0xf0e0b0, 1, 1); px(8, T0 + 3, 0xf0e0b0, 1, 1); }
    if (L.pattern === 5) px(tx, T0, L.cloth2, tw, 1);
  }
  // arms (sleeve then hand)
  const sleeve = out === 'light' || out === 'sarong' ? L.skin : out === 'armor' || out === 'knight' ? 0x9aa0b0 : top;
  const hand = (x: number, y: number) => px(x, y, L.skin, 1, 1);
  let hx = tx + tw, hy = T0 + 4; // right hand
  const arm = (side: -1 | 1, a: Arm) => {
    const x = side < 0 ? tx - 1 : tx + tw;
    let h: [number, number];
    if (a === 'down') { px(x, T0 + 1, sleeve, 1, 3); h = [x, T0 + 4]; }
    else if (a === 'fwd') { px(x, T0 + 1, sleeve, 1, 2); h = [x, T0 + 3]; }
    else if (a === 'back') { px(x, T0 + 1, sleeve, 1, 4); h = [x, T0 + 5]; }
    else if (a === 'up') { px(x, T0 - 3, sleeve, 1, 4); h = [x, T0 - 4]; }
    else if (a === 'strike') { px(x, T0 + 1, sleeve, 1, 2); px(x + side, T0 + 3, sleeve, 1, 1); h = [x + side, T0 + 4]; }
    else { px(x, T0 + 1, sleeve, 1, 2); h = [side < 0 ? tx + 1 : tx + tw - 2, T0 + 3]; px(side < 0 ? tx : tx + tw - 1, T0 + 3, sleeve, 1, 1); }
    hand(h[0], h[1]);
    if (side > 0) [hx, hy] = h;
  };
  arm(-1, p.lArm); arm(1, p.rArm);
  if (p.bundle) { px(tx + 1, T0 + 2, 0xf2ead8, tw - 2, 3); px(tx + tw / 2 - 1, T0 + 2, 0xf0c8a0, 2, 2); px(tx + 1, T0 + 4, 0xe0d4b8, tw - 2, 1); }
  // head
  px(5, HT, L.skin, 6, 7); px(4, HT + 1, L.skin, 8, 5);
  const eyeY = HT + 3;
  if (p.legs === 'kneel') { px(6, eyeY, shade(L.skin, 0.6), 1, 1); px(9, eyeY, shade(L.skin, 0.6), 1, 1); } // eyes closed in prayer
  else { px(6, eyeY, L.eye, 1, 1); px(9, eyeY, L.eye, 1, 1); }
  if (frame === POSE.cheer) px(7, HT + 5, 0x8a2a2a, 2, 1); // open mouth
  if (L.mark === 1) { px(5, HT + 4, shade(L.skin, 0.8), 1, 1); px(10, HT + 4, shade(L.skin, 0.8), 1, 1); px(6, HT + 5, shade(L.skin, 0.8), 1, 1); }
  if (L.mark === 2) { px(9, HT + 2, 0xa04a4a, 1, 1); px(10, HT + 3, 0xa04a4a, 1, 1); px(9, HT + 4, 0xa04a4a, 1, 1); }
  if (L.mark === 3) { px(5, HT + 4, 0xf08a8a, 1, 1); px(10, HT + 4, 0xf08a8a, 1, 1); }
  if (L.mark === 4) { px(5, HT + 4, shade(L.cloth2, 0.8), 2, 1); px(9, HT + 4, shade(L.cloth2, 0.8), 2, 1); }
  if (L.race === 'vampire') { px(6, eyeY, 0xd02020, 1, 1); px(9, eyeY, 0xd02020, 1, 1); px(7, HT + 5, 0xffffff, 1, 1); px(8, HT + 5, 0xffffff, 1, 1); }
  if (L.race === 'orc') { px(5, HT + 5, 0xf0f0d0, 1, 1); px(10, HT + 5, 0xf0f0d0, 1, 1); }
  if (L.race === 'elf' || L.race === 'darkelf') { px(2, HT + 2, L.skin, 2, 1); px(12, HT + 2, L.skin, 2, 1); }
  if (L.race === 'beast') { px(4, HT - 3, L.hair, 2, 3); px(10, HT - 3, L.hair, 2, 3); px(5, HT - 2, 0xf0a0a0, 1, 1); px(10, HT - 2, 0xf0a0a0, 1, 1); }
  if (L.race === 'demonkin') { if (L.pattern % 2) { px(4, HT - 3, 0x3a2a2a, 1, 3); px(11, HT - 3, 0x3a2a2a, 1, 3); } else { px(3, HT - 2, 0x3a2a2a, 2, 1); px(3, HT - 3, 0x3a2a2a, 1, 1); px(11, HT - 2, 0x3a2a2a, 2, 1); px(12, HT - 3, 0x3a2a2a, 1, 1); } }
  if (L.race === 'dragonkin') { px(3, HT - 2, 0xd9a030, 1, 3); px(12, HT - 2, 0xd9a030, 1, 3); px(5, HT + 1, shade(L.skin, 0.75), 6, 1); }
  if (L.race === 'naga' || L.race === 'merfolk') px(4, HT + 5, shade(L.skin, 0.8), 1, 2);
  // beards (0 none, 1 stubble, 2 full, 3 long, 4 moustache)
  const bc = L.elder ? 0xe0e0e8 : shade(hair, 0.9);
  if (L.beard === 1) for (let k = 5; k < 11; k += 2) px(k, HT + 6, bc, 1, 1);
  if (L.beard === 2) { px(4, HT + 4, bc, 1, 3); px(11, HT + 4, bc, 1, 3); px(5, HT + 5, bc, 6, 2); px(7, HT + 5, shade(L.skin, 0.7), 2, 1); }
  if (L.beard === 3) { px(5, HT + 5, bc, 6, 2); px(6, HT + 7, bc, 4, 3); px(7, HT + 10, bc, 2, 1); }
  if (L.beard === 4) { px(5, HT + 5, bc, 2, 1); px(9, HT + 5, bc, 2, 1); }
  // hair (0 short,1 long,2 ponytail,3 bald,4 spiky,5 braid,6 bun,7 bob,8 mohawk,9 twin tails,10 curly,11 side fringe)
  const hs = L.hairStyle;
  const hidden = ['helmet', 'hood', 'turban', 'furhat', 'minerhat', 'veil'].includes(L.hat);
  if (hs !== 3 && hs !== 8) { px(4, HT - 1, hair, 8, 2); px(4, HT + 1, hair, 1, 2); px(11, HT + 1, hair, 1, 2); }
  if (!hidden) {
    if (hs === 1) { px(3, HT + 1, hair, 1, 7); px(12, HT + 1, hair, 1, 7); }
    if (hs === 2) px(12, HT + 2, hair, 2, 5);
    if (hs === 4) for (let k = 4; k < 12; k += 2) px(k, HT - 2, hair, 1, 1);
    if (hs === 5) { px(12, HT + 2, hair, 1, 9); px(12, HT + 11, 0xe04848, 1, 1); }
    if (hs === 6) px(6, HT - 3, hair, 4, 2);
    if (hs === 7) { px(3, HT + 1, hair, 1, 4); px(12, HT + 1, hair, 1, 4); px(4, HT + 1, hair, 3, 1); }
    if (hs === 8) px(7, HT - 3, hair, 2, 4);
    if (hs === 9) { px(2, HT + 1, hair, 2, 5); px(12, HT + 1, hair, 2, 5); px(2, HT + 1, 0xe04848, 1, 1); px(13, HT + 1, 0xe04848, 1, 1); }
    if (hs === 10) { for (let k = 3; k < 13; k += 2) px(k, HT - 2, hair, 2, 2); px(3, HT, hair, 1, 3); px(12, HT, hair, 1, 3); }
    if (hs === 11) { px(4, HT + 1, hair, 4, 1); px(4, HT + 2, hair, 2, 1); }
  }
  // headwear
  const h = L.hat;
  if (h === 'straw') { px(2, HT - 1, 0xe8d090, 12, 1); px(4, HT - 3, 0xe8d090, 8, 2); px(4, HT - 2, 0xc04a3a, 8, 1); }
  if (h === 'helmet') { px(4, HT - 2, 0x9aa0b0, 8, 3); px(4, HT + 1, 0x9aa0b0, 1, 2); px(11, HT + 1, 0x9aa0b0, 1, 2); px(7, HT - 3, L.role === 'หัวหน้าทหารยาม' ? 0xc03030 : 0x9aa0b0, 2, 1); }
  if (h === 'wizard') { px(3, HT - 1, L.cloth, 10, 1); px(5, HT - 3, L.cloth, 6, 2); px(6, HT - 5, L.cloth, 4, 2); px(7, HT - 6, L.cloth, 2, 1); px(7, HT - 3, 0xf2c94c, 1, 1); }
  if (h === 'circlet') { px(4, HT, 0xf2c94c, 8, 1); px(7, HT - 1, 0xe04848, 2, 1); }
  if (h === 'feather') { px(4, HT - 2, L.cloth2, 8, 2); px(11, HT - 5, 0xe04848, 1, 3); px(12, HT - 6, 0xe04848, 1, 2); }
  if (h === 'hood') { px(3, HT - 2, shade(L.cloth, 0.6), 10, 3); px(3, HT + 1, shade(L.cloth, 0.6), 1, 5); px(12, HT + 1, shade(L.cloth, 0.6), 1, 5); }
  if (h === 'cap') { px(4, HT - 2, L.cloth2, 8, 2); px(9, HT, L.cloth2, 4, 1); }
  if (h === 'bandana') { px(4, HT - 1, 0xc03a3a, 8, 2); px(12, HT, 0xc03a3a, 2, 1); }
  if (h === 'flower') { px(10, HT - 2, 0xf06aa0, 2, 2); px(11, HT - 1, 0xf2c94c, 1, 1); }
  if (h === 'turban') { px(3, HT - 3, 0xf0e6cc, 10, 4); px(4, HT - 2, 0xd8ccb0, 8, 1); px(7, HT - 2, 0xe04848, 2, 1); }
  if (h === 'veil') { px(3, HT - 2, L.cloth2, 10, 3); px(3, HT + 1, L.cloth2, 1, 7); px(12, HT + 1, L.cloth2, 1, 7); }
  if (h === 'furhat') { px(3, HT - 3, 0x8a6a4a, 10, 4); px(3, HT, 0xe8e0d0, 10, 1); }
  if (h === 'minerhat') { px(4, HT - 2, 0xd9a030, 8, 3); px(7, HT - 2, 0xfff2a0, 2, 1); }
  if (h === 'chef') { px(5, HT - 4, 0xf6f4ee, 6, 4); px(4, HT - 1, 0xf6f4ee, 8, 1); }
  // tools in the right hand
  if (p.tool !== 'none') tool(px, L.tool, p.tool, hx, hy, L);
  if (L.elder && p.lArm === 'down' && p.legs === 'stand') px(tx - 2, T0 + 4, 0x8a5a3a, 1, 22 - (T0 + 4)); // cane
}

type Px = (x: number, y: number, c: number, w?: number, h?: number) => void;
function tool(px: Px, t: string, mode: 'side' | 'raise' | 'strike' | 'hold', hx: number, hy: number, L: Look) {
  const wood = 0x8a5a3a, iron = 0xc9ccd6;
  // long poles stay upright whatever the hands do
  if (t === 'spear') { px(hx, hy - 12, wood, 1, 17); px(hx, hy - 14, iron, 1, 2); return; }
  if (t === 'staff' || t === 'orbstaff' || t === 'crook') {
    const y0 = mode === 'raise' ? hy - 6 : hy - 10;
    px(hx, y0, wood, 1, 14);
    if (t === 'orbstaff') { px(hx - 1, y0 - 2, 0x8ac8ff, 3, 2); px(hx, y0 - 3, 0xe0f4ff, 1, 1); }
    else if (t === 'crook') { px(hx + 1, y0 - 1, wood, 1, 1); px(hx + 2, y0, wood, 1, 2); }
    else px(hx - 1, y0, 0xf2c94c, 3, 1);
    return;
  }
  if (t === 'rod') {
    if (mode === 'hold') { for (let k = 0; k < 7; k++) px(hx + Math.floor(k / 2), hy - k, wood, 1, 1); px(hx + 4, hy - 6, 0xe0e0e0, 1, 6); }
    else px(hx, hy - 8, wood, 1, 12);
    return;
  }
  if (t === 'book') { if (mode === 'hold' || mode === 'raise') { px(6, hy - 1, 0x8a2a2a, 4, 3); px(7, hy - 1, 0xf0e8d8, 2, 3); } else px(hx, hy - 1, 0x8a2a2a, 2, 3); return; }
  if (t === 'lute') { px(hx - 4, hy - 2, 0xa06a42, 4, 4); px(hx - 3, hy - 1, 0x3a2a1a, 1, 1); px(hx, hy - 4, 0x5e3a26, 1, 3); return; }
  if (t === 'mug') { px(hx, hy - 2, 0xa07040, 2, 3); px(hx, hy - 2, 0xf6f2e8, 2, 1); return; }
  if (t === 'bowl') { px(hx - 1, hy, 0x8a6a4a, 3, 1); return; }
  if (t === 'flask') { px(hx, hy - 2, 0x7ad0a0, 2, 2); px(hx, hy - 3, 0xe0e0e0, 1, 1); return; }
  if (t === 'bow') { px(hx + 1, hy - 5, wood, 1, 1); px(hx + 2, hy - 4, wood, 1, 8); px(hx + 1, hy + 4, wood, 1, 1); px(hx + 1, hy - 4, 0xe0e0e0, 1, 8); return; }
  // hand tools: down at the side, raised overhead, or brought down in a strike
  const head: Record<string, [number, number, number]> = { hammer: [3, 2, 0x7a7f90], axe: [2, 3, iron], pickaxe: [4, 1, 0x7a7f90], hoe: [3, 1, 0x7a7f90], shovel: [2, 3, 0x7a7f90], sword: [1, 6, iron], ladle: [2, 2, 0xa0a0a8], broom: [3, 3, 0xd8b060] };
  const hd = head[t];
  if (!hd) return;
  const [w, h, c] = hd;
  if (t === 'sword') {
    if (mode === 'raise') { px(hx, hy - 7, c, 1, 6); px(hx - 1, hy - 1, 0xd9a030, 3, 1); }
    else if (mode === 'strike') { px(hx + 1, hy, c, 6, 1); px(hx, hy - 1, 0xd9a030, 1, 3); }
    else { px(hx, hy + 1, c, 1, 5); px(hx - 1, hy, 0xd9a030, 3, 1); }
    return;
  }
  if (mode === 'raise') { px(hx, hy - 5, wood, 1, 6); px(hx - Math.floor(w / 2), hy - 5 - h, c, w, h); }
  else if (mode === 'strike') { px(hx, hy, wood, 4, 1); px(hx + 3, hy - Math.floor(h / 2), c, h, w); }
  else if (t === 'broom') { px(hx, hy - 4, wood, 1, 8); px(hx - 1, hy + 4, c, 3, 2); }
  else { px(hx, hy, wood, 1, 4); px(hx - Math.floor(w / 2), hy + 4, c, w, h); }
  void L;
}

const lookKey = (L: Look) => `pp_${L.race}_${L.outfit}_${L.skin}_${L.hair}_${L.hairStyle}_${L.beard}_${L.eye}_${L.mark}_${L.build}_${+L.tall}_${L.cloth}_${L.cloth2}_${L.pattern}_${L.hat}_${L.tool}_${+L.child}_${+L.elder}_${+L.fem}_${L.role}`;

// a strip of FRAMES poses as one texture with numbered frames (0..FRAMES-1)
export function personFrames(scene: Phaser.Scene, L: Look, S = 2): string {
  const key = lookKey(L) + '_' + S;
  if (scene.textures.exists(key)) return key;
  const w = 16 * S, h = 24 * S;
  const cv = document.createElement('canvas');
  cv.width = w * FRAMES; cv.height = h;
  const ctx = cv.getContext('2d')!;
  for (let i = 0; i < FRAMES; i++) {
    ctx.save(); ctx.translate(i * w, 0); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    drawPerson(ctx, L, S, i);
    ctx.restore();
  }
  const tex = scene.textures.addCanvas(key, cv)!;
  for (let i = 0; i < FRAMES; i++) tex.add(i, 0, i * w, 0, w, h);
  return key;
}

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
  const child = c.hAge < 13;
  const role = child ? 'เด็ก' : JOB_ROLE[c.job || ''] || (c.hAge < 20 ? 'ชาวบ้าน' : 'นักผจญภัย');
  return lookFor(`hero:${c.name}:${c.dynastyName}`, c.race, role, { climate, gender: c.gender, elder: c.hAge >= 55 });
}

const H = (n: number) => Object.values(SKIN).reduce((a, s) => a + s.length, 0) * n;
// distinct looks: race skins × hair styles × hair colours × beards × marks × builds × heights × outfits × colours² × patterns × hats
export const LOOK_COMBOS = H(12 * HAIR.length * 5 * 5 * 3 * 2 * 18 * CLOTH.length * CLOTH.length * 6 * 6);
