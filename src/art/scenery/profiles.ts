// The look of each continent as the painter reads it: the sky colours, light, ambient particle, the `ui` values of docs/appearance/01-continents.md
// (palette, forms, wall) and the colours of the inside of a building. Values in the comments cite the doc's "ค่า UI" and "แสงและสี" lines.
import type { HouseStyle, TreeKind } from './sprites';
import { grey, dark, hex, toHex, mix } from './util';

export type Base = 'AZ' | 'MH' | 'KD' | 'NR' | 'AL' | 'MK' | 'SH' | 'SV' | 'NB';
export const BASES: readonly Base[] = ['AZ', 'MH', 'KD', 'NR', 'AL', 'MK', 'SH', 'SV', 'NB'];
/** The ids the contract's comment names (KZ, AD) are the spellings of an older draft; data/gen uses KD and AL. */
const ALIAS: Record<string, Base> = { KZ: 'KD', AD: 'AL' };

export interface Inside {
  wall: string; wall2: string; floor: string; floor2: string; beam: string; accent: string; lamp: string;
}

export interface Profile {
  base: Base;
  /** The id as asked for (an unknown one keeps its own). */
  id: string;
  /** True when the continent is not one of the nine: the look is borrowed from one of them and worn down. */
  fallback: boolean;
  /** Sky colours, zenith to horizon. */
  sky: string[];
  light: string;
  /** The lamp light inside. */
  lamp: string;
  ambient: string;
  /** How much of a winter the place keeps as snow, 0..1. */
  snow: number;
  /** The UI palette of the doc (five colours). */
  pal: string[];
  roofs: string[];
  styles: HouseStyle[];
  tree: TreeKind | '';
  wall: 'none' | 'stone' | 'iron' | 'palisade' | 'hedge';
  inside: Inside;
}

const P: Record<Base, Omit<Profile, 'id' | 'fallback' | 'base'>> = {
  // ฟ้าคราม ขาวเมฆ ทองซีดของแสงที่ไม่มีอะไรบัง
  AZ: {
    sky: ['#2b5ca8', '#3d78c4', '#6a9ad8', '#a8c6e8', '#dce8f0', '#f4f0e0'], light: '#fff0c8', lamp: '#ffe8a8', ambient: 'clouds', snow: 0.7,
    pal: ['#3d78c4', '#f4f0e0', '#c9a24a', '#8a8a96', '#1e2a4a'], roofs: ['#3d78c4', '#c9a23a', '#e9e9f6'], styles: ['spire', 'dome', 'gable'], tree: '', wall: 'none',
    inside: { wall: '#dcdcd8', wall2: '#b8bcc4', floor: '#c8ccd4', floor2: '#9a9eaa', beam: '#c9a24a', accent: '#3d78c4', lamp: '#ffe8a8' },
  },
  // เหลืองฟาง เทาเถ้า แดงเลือดหมู ไฟค่ายเป็นแสงอุ่นเดียวในคืน
  MH: {
    sky: ['#5a4a3e', '#7a6850', '#a08a5a', '#c4a870', '#d8c090'], light: '#e0b070', lamp: '#ffb060', ambient: 'embers', snow: 0.5,
    pal: ['#8a7a4a', '#6a2a22', '#c8c0a0', '#3a3030', '#d86a2a'], roofs: ['#6a2a22', '#8a7a4a', '#5a4a3a'], styles: ['tent', 'hut', 'stone', 'keep'], tree: 'dead', wall: 'palisade',
    inside: { wall: '#7a5a3a', wall2: '#5a3a2a', floor: '#5a4a3a', floor2: '#3e3228', beam: '#c8c0a0', accent: '#6a2a22', lamp: '#ffb060' },
  },
  // ดำ ส้มลาวา เหลืองกำมะถัน เทาเหล็ก แสงของเตาหลอมกระพริบตามจังหวะค้อน
  KD: {
    sky: ['#3a3230', '#544838', '#78603c', '#b07a3c', '#e0662a'], light: '#e8883a', lamp: '#ff9a40', ambient: 'embers', snow: 0.05,
    pal: ['#1a1414', '#e0662a', '#f0a830', '#8a90a0', '#5a2a22'], roofs: ['#5a2a22', '#3a3034', '#8a90a0'], styles: ['forge', 'stone', 'keep', 'carved'], tree: '', wall: 'iron',
    inside: { wall: '#2e2628', wall2: '#1c1618', floor: '#3a3234', floor2: '#262022', beam: '#8a90a0', accent: '#e0662a', lamp: '#ff9a40' },
  },
  // เขียวทะเล เทาน้ำ ขาวเกลือ ทองแดงของประภาคาร แสงตะเกียงเรือยามค่ำเป็นจุดเหลืองลอยบนน้ำดำ
  NR: {
    sky: ['#7e8c9a', '#9aa8b2', '#b8c2c8', '#d0d6d8', '#e6e8e6'], light: '#d8e0e0', lamp: '#ffd878', ambient: 'gulls', snow: 0.5,
    pal: ['#2f7a6a', '#e8e8f0', '#b87a3a', '#3a4a58', '#7ac0c8'], roofs: ['#7ac0c8', '#e8e8f0', '#b87a3a'], styles: ['stilt', 'dome', 'gable'], tree: 'palm', wall: 'none',
    inside: { wall: '#b8a890', wall2: '#8a7a68', floor: '#8a7050', floor2: '#6a5238', beam: '#b87a3a', accent: '#7ac0c8', lamp: '#ffd878' },
  },
  // เขียวสด ทองข้าวสาลี น้ำตาลดิน ขาวเมฆ
  AL: {
    sky: ['#4a88d0', '#6aa0dc', '#8abae6', '#b0d2ee', '#d8ecf4'], light: '#fff0c0', lamp: '#ffd890', ambient: 'leaves', snow: 1,
    pal: ['#5aa04e', '#d8b44a', '#8a5a3a', '#e8e4d8', '#3a5a8a'], roofs: ['#8a5a3a', '#a85a3a', '#7a4a32'], styles: ['gable', 'brick', 'hut'], tree: 'oak', wall: 'stone',
    inside: { wall: '#e8e0cc', wall2: '#c8b898', floor: '#8a5a3a', floor2: '#6a4228', beam: '#6a4228', accent: '#5aa04e', lamp: '#ffd890' },
  },
  // เหล็กเทา ทองเหลือง น้ำตาลสนิม ไฟแก๊สสีเหลืองซีด และสีฟ้าเย็นของแสงรูน
  MK: {
    sky: ['#5a5a3a', '#787844', '#94945a', '#b4b070', '#cac688'], light: '#d8d090', lamp: '#e8dc80', ambient: 'smoke', snow: 0.3,
    pal: ['#8a94a4', '#c08a3a', '#6a3a2a', '#d8d070', '#6ad0ff'], roofs: ['#6a3a2a', '#8a94a4', '#5a4a44'], styles: ['brick', 'boomtown', 'tower'], tree: '', wall: 'iron',
    inside: { wall: '#8a5a48', wall2: '#6a3a2a', floor: '#5a6270', floor2: '#3e4450', beam: '#8a94a4', accent: '#6ad0ff', lamp: '#e8dc80' },
  },
  // ทอง แดงสนิม ขาวของเกลือและหินปูน ฟ้าเข้ม ร่มเงาเป็นสีม่วงเข้ม
  SH: {
    sky: ['#1c2c5a', '#2c4880', '#4a68a0', '#a08ca0', '#e8a868'], light: '#ffd890', lamp: '#ffc070', ambient: 'sand', snow: 0.1,
    pal: ['#d8b060', '#b04a2a', '#e8e0c8', '#5a3a30', '#3a5a8a'], roofs: ['#b04a2a', '#d8b060', '#e8e0c8'], styles: ['adobe', 'stone', 'terrace'], tree: 'cactus', wall: 'stone',
    inside: { wall: '#d8a868', wall2: '#b08048', floor: '#c8a060', floor2: '#a07c40', beam: '#5a3a30', accent: '#b04a2a', lamp: '#ffc070' },
  },
  // เขียวมรกต ทองอ่อน น้ำตาลเปลือกไม้ ม่วงของเห็ดและดอกกลางคืน
  SV: {
    sky: ['#14301e', '#1e4a2a', '#2e6a3a', '#5a9a5a', '#9ac078'], light: '#c8e8a0', lamp: '#a0e8b0', ambient: 'leaves', snow: 0.5,
    pal: ['#2e7a3e', '#e0c060', '#6a4a34', '#8a5a8a', '#9ad0a0'], roofs: ['#2e7a3e', '#8a5a8a', '#6a4a34'], styles: ['tree', 'hut', 'mushroom'], tree: 'oak', wall: 'hedge',
    inside: { wall: '#5a4030', wall2: '#3a2a20', floor: '#4a5a34', floor2: '#33401f', beam: '#6a4a34', accent: '#8a5a8a', lamp: '#a0e8b0' },
  },
  // เทา ขาวนม ทองซีดของโคม แดงเลือดหมูของผ้าม่านเคานต์ ทุกสีลดความอิ่มลงหมด
  NB: {
    sky: ['#8a8e94', '#a4a8ac', '#bcbec0', '#d0d0d0', '#e4e0da'], light: '#d0d0d8', lamp: '#d8b060', ambient: 'fog', snow: 0.8,
    pal: ['#8a8e94', '#e8e4dc', '#d8b060', '#7a1a2a', '#3a3a4a'], roofs: ['#5a5e66', '#7a1a2a', '#3a3a4a'], styles: ['stone', 'tower', 'spire'], tree: '', wall: 'none',
    inside: { wall: '#7a7e86', wall2: '#5a5e66', floor: '#50545a', floor2: '#3a3e44', beam: '#3a3a4a', accent: '#7a1a2a', lamp: '#d8b060' },
  },
};

/** Ambient words of the continent doc (บรรยากาศ) in the words of the country `ui`. */
export const AMBIENT_WORDS: Record<string, string> = {
  เมฆ: 'clouds', ถ่านร้อน: 'embers', เถ้า: 'ash', ควัน: 'smoke', นกนางนวล: 'gulls', หมอก: 'fog', ใบไม้: 'leaves', ฝุ่น: 'dust', ทราย: 'sand', ประกายแสง: 'motes',
};

function worn(p: Omit<Profile, 'id' | 'fallback' | 'base'>): Omit<Profile, 'id' | 'fallback' | 'base'> {
  // a continent after the world has changed: the same land with the colour drained and a dark haze
  const f = (h: string): string => toHex(dark(grey(hex(h), 0.32), 0.1));
  const i = p.inside;
  return {
    ...p, sky: p.sky.map((h) => toHex(mix(hex(f(h)), [70, 66, 64], 0.2))), light: f(p.light), pal: p.pal.map(f), roofs: p.roofs.map(f),
    inside: { ...i, wall: f(i.wall), wall2: f(i.wall2), floor: f(i.floor), floor2: f(i.floor2), accent: f(i.accent) },
  };
}

/** The profile of a continent: the nine known ones, their old spellings, and for any other id (a land born of an event) one borrowed from the
 * continent its country id names, or by hash from the nine, and worn down. */
export function profileOf(continent: string, country?: string): Profile {
  const up = continent.toUpperCase();
  const known = (BASES as readonly string[]).includes(up) ? (up as Base) : ALIAS[up];
  if (known) return { ...P[known], base: known, id: continent, fallback: false };
  const fromCountry = country?.slice(0, 2).toUpperCase();
  const parent = fromCountry && ((BASES as readonly string[]).includes(fromCountry) ? (fromCountry as Base) : ALIAS[fromCountry]);
  let h = 2166136261;
  for (let i = 0; i < up.length; i++) h = Math.imul(h ^ up.charCodeAt(i), 16777619);
  const base = parent || BASES[(h >>> 0) % BASES.length];
  return { ...worn(P[base]), base, id: continent, fallback: true };
}
