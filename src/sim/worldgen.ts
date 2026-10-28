import { RNG, makeNoise } from './rng';
import type { Continent, Country } from './types';
import { climateById } from '../data/races';
import { DEFS, ownerAt, MU_TO_WU } from '../world/geo';
import { COUNTRY_DOCS, type CountryDoc } from '../data/countries';

export const WORLD_SEED = 'อาเธเรีย';
// the tile grid is 8 world units per tile; the continents' shapes live in src/world/geo.ts (the same field the map is drawn from)
export const SCALE = 3;
export const MAP_W = 256 * SCALE;
export const MAP_H = 144 * SCALE;

// 9 ทวีป รวม 143 ประเทศ (ลำดับและจำนวนตาม docs/continents.md; รูปร่างและตำแหน่งอยู่ที่ src/world/geo.ts)
export const CONTINENTS: Continent[] = [
  { id: 0, name: 'อัซการ์', desc: 'ทวีปมังกร หมู่เกาะลอยฟ้านับร้อย รัฐเทวาธิปไตยที่ส่งบรรณาการให้มังกรอุปถัมภ์', climates: ['temperate', 'frozen'], races: ['dragonkin', 'human', 'human', 'fae', 'beast'], count: 10 },
  { id: 1, name: 'มอร์เฮเวน', desc: 'ทวีปปีศาจ ดินแดนรกร้างที่ทุกเผ่าหิวโหยและต้องรบเพื่อกิน', climates: ['desert', 'volcanic'], races: ['orc', 'orc', 'demonkin', 'demonkin', 'darkelf', 'human'], count: 12 },
  { id: 2, name: 'คาซ-ดูรัม', desc: 'ทวีปแห่งไฟ ภูเขาไฟ เหมืองลึก และช่างตีที่ดีที่สุดในโลก', climates: ['volcanic', 'volcanic', 'frozen'], races: ['dwarf', 'dwarf', 'dragonkin', 'darkelf', 'human', 'demonkin'], count: 12 },
  { id: 3, name: 'เนเรีย', desc: 'ทวีปแห่งสายน้ำ หมู่เกาะที่คุมเส้นทางเดินเรือของโลก', climates: ['islands'], races: ['merfolk', 'merfolk', 'naga', 'human', 'halfling', 'slime'], count: 16 },
  { id: 4, name: 'อัลเดรีย', desc: 'ทวีปทุ่งราบ ใหญ่ที่สุด คนมากที่สุด และเป็นที่ตั้งของสภาเก้าทวีป', climates: ['temperate', 'temperate', 'tropical'], races: ['human', 'human', 'human', 'halfling', 'elf', 'beast', 'dwarf'], count: 28 },
  { id: 5, name: 'เมคาเรีย', desc: 'ทวีปจักรกล เรือเหาะ โรงงาน และด้านมืดที่ซ่อนอยู่ใต้ความเจริญ', climates: ['temperate', 'temperate', 'frozen'], races: ['human', 'human', 'dwarf', 'halfling', 'elf'], count: 16 },
  { id: 6, name: 'ซาฮารัน', desc: 'ทวีปภูเขาและทะเลทราย ยักษ์เฝ้าบันได กองคาราวานเฝ้าโอเอซิส', climates: ['desert', 'desert', 'temperate'], races: ['orc', 'human', 'human', 'beast', 'demonkin', 'naga'], count: 17 },
  { id: 7, name: 'ซิลวาเนล', desc: 'ทวีปพงไพร ต้นไม้โลกที่ฟื้นฟูทุกสิ่งและกรองพิษหมอก', climates: ['tropical', 'tropical', 'temperate'], races: ['elf', 'elf', 'fae', 'fae', 'beast', 'human', 'slime'], count: 18 },
  { id: 8, name: 'เนบูเลีย', desc: 'ทวีปหมอก ที่ราบลุ่มไร้กลางวันกลางคืน ตลาดมืด และเมืองปฐมที่จมอยู่ใต้หมอก', climates: ['temperate', 'frozen'], races: ['human', 'human', 'vampire', 'vampire', 'darkelf', 'fae'], count: 14 },
];

export const RELIGIONS: Record<string, string> = {
  light: 'ศาสนจักรแห่งแสง', dragon: 'ลัทธิบูชามังกร', ancestor: 'การบูชาบรรพบุรุษ', nature: 'ศรัทธาต้นไม้โลก', sea: 'เทพแห่งสมุทร',
  moon: 'เทพีแห่งจันทรา', war: 'เทพแห่งสงคราม', demon: 'ลัทธิปีศาจ', naga: 'พญานาคราช', none: 'ไร้ศาสนา',
};
const RELIGION_BY_RACE: Record<string, [string, number][]> = {
  human: [['light', 5], ['war', 2], ['moon', 1], ['ancestor', 1], ['none', 1]], elf: [['nature', 4], ['moon', 2]], darkelf: [['moon', 2], ['demon', 2]],
  dwarf: [['ancestor', 4], ['war', 1]], orc: [['war', 4], ['ancestor', 1]], halfling: [['light', 1], ['nature', 2], ['none', 2]], beast: [['nature', 3], ['war', 1]],
  naga: [['naga', 5]], dragonkin: [['dragon', 5]], vampire: [['moon', 2], ['demon', 2], ['none', 1]], fae: [['nature', 3], ['moon', 2]],
  slime: [['none', 3], ['sea', 1]], demonkin: [['demon', 3], ['none', 1]], merfolk: [['sea', 5]],
};

export interface Town { id: number; countryId: number; name: string; x: number; y: number; capital: boolean; size: number }

const GOVS = ['ราชอาณาจักร', 'จักรวรรดิ', 'สาธารณรัฐ', 'นครรัฐ', 'รัฐเทวาธิปไตย', 'สหพันธ์เผ่า', 'ดัชชี', 'รัฐสุลต่าน', 'แคว้น', 'ราชรัฐ'];
const GOV_BY_RACE: Record<string, string[]> = {
  orc: ['สหพันธ์เผ่า', 'อาณาจักรเผ่า'], beast: ['สหพันธ์เผ่า', 'แคว้น'], elf: ['ราชอาณาจักร', 'สภาผู้อาวุโส'],
  dwarf: ['ป้อมปราการ', 'ราชอาณาจักร'], vampire: ['เคานตี', 'จักรวรรดิราตรี'], demonkin: ['รัฐปีศาจ', 'แดนอสูร'],
  merfolk: ['อาณาจักรใต้สมุทร', 'สหพันธ์เกาะ'], naga: ['อาณาจักรนาคา', 'รัฐเทวาธิปไตย'], dragonkin: ['ราชวงศ์มังกร', 'จักรวรรดิ'],
  fae: ['ราชสำนักภูต', 'แดนพราย'], slime: ['สหภาพเยลลี่', 'นครรัฐ'], halfling: ['ไชร์', 'นครรัฐ'],
  darkelf: ['มาตาธิปไตย', 'นครใต้พิภพ'], human: GOVS,
};

// syllables per continent, in CONTINENTS order
const NAME_SYL: string[][][] = [
  [['อัซ', 'ดรา', 'วีร์', 'โค', 'ซาก', 'ธี'], ['กา', 'โร', 'ซา'], ['การ์', 'ธรักซ์', 'โมเรีย', 'วาส', 'ดุส']],
  [['มอร์', 'นอค', 'วี', 'เซ', 'ดรา', 'อุล', 'กาธ'], ['ธ', 'ซา', 'รี', 'วา'], ['เฮเวน', 'เรธ', 'ซาร์', 'โมธ', 'ดรีน', 'กูล']],
  [['คาซ', 'ดูร์', 'บาร์', 'กรอม', 'ธรอ', 'อิร', 'ฮัล'], ['-', 'ก', 'ดู', 'มา'], ['รัม', 'ดิน', 'กาด', 'มอร์', 'ฮอล์ม', 'ดัล']],
  [['เน', 'มา', 'โอ', 'คอ', 'ทา', 'ไอ', 'ลา'], ['รี', 'ลา', 'นู', 'วา'], ['เรีย', 'ทอล', 'โมอา', 'นีส', 'ไอล์', 'ปาเล']],
  [['เอล', 'คาร์', 'วาล', 'ลอร์', 'แบร', 'ซิล', 'อาร์', 'เม', 'รอส', 'เท'], ['ดอ', 'เว', 'มา', 'ลิ', 'นอ', 'ทา'], ['เรีย', 'เนีย', 'ฮาร์ต', 'ฟอร์ด', 'มอนต์', 'แลนด์', 'กาด', 'ดอร์']],
  [['เฮ', 'ครอน', 'โนวา', 'อาร์', 'ดอร์', 'เซฟ', 'แวร์', 'ไซ'], ['ฟา', 'ไซ', 'มิน'], ['กริด', 'ไซต์', 'พอร์ต', 'ดาล', 'ฟอร์จ', 'เวิร์ค']],
  [['ซา', 'อัล', 'คา', 'มา', 'ซุ', 'ฮา', 'รา'], ['ฮา', 'ซี', 'บา', 'มี'], ['ราน', 'ซาร์', 'บัด', 'มีร์', 'ดีน', 'กัช']],
  [['ซิล', 'เอ', 'ลู', 'ไอ', 'ธา', 'เฟ', 'ลา'], ['วา', 'ริ', 'เล', 'นิ'], ['เนล', 'ธิล', 'ลอร์', 'เดล', 'วิน', 'ลิส']],
  [['เวล', 'ซอร์', 'ลู', 'ไอ', 'มอร์', 'เล', 'เน'], ['เนบ', 'มิ', 'ธา'], ['มีร์', 'ธาล', 'ลิน', 'วาน', 'โนวา']],
];

// first matching word wins; the order decides which people count as which of the sim's races
const RACE_KW: [string, string][] = [
  ['ดาร์กเอลฟ์', 'darkelf'], ['เอลฟ์', 'elf'], ['คนแคระ', 'dwarf'], ['ออร์ค', 'orc'], ['โอเกอร์', 'orc'], ['ยักษ์', 'orc'], ['กูล', 'demonkin'], ['ปีศาจ', 'demonkin'],
  ['ฮาล์ฟลิง', 'halfling'], ['เผ่าสัตว์', 'beast'], ['สัตว์', 'beast'], ['หมาป่า', 'beast'], ['นาคา', 'naga'], ['เผ่ามังกร', 'dragonkin'], ['อาเวียน', 'fae'], ['ปีก', 'fae'],
  ['ภูต', 'fae'], ['แวมไพร์', 'vampire'], ['สไลม์', 'slime'], ['เงือก', 'merfolk'], ['ไซเรน', 'merfolk'], ['กัปปะ', 'merfolk'], ['เห็ด', 'slime'], ['มนุษย์', 'human'], ['ชาวพื้น', 'human'], ['ชาวหมอก', 'human'],
];
const RELIGION_KW: [string, string][] = [
  ['ลัทธิปีศาจ', 'demon'], ['เทพแห่งสงคราม', 'war'], ['สงคราม', 'war'], ['มังกร', 'dragon'], ['พญานาค', 'naga'], ['สมุทร', 'sea'], ['วาฬ', 'sea'], ['วังวน', 'sea'], ['คราเคน', 'sea'], ['ธาลาสซา', 'sea'],
  ['น้ำ', 'sea'], ['ปะการัง', 'sea'], ['ต้นไม้โลก', 'nature'], ['ธรรมชาติ', 'nature'], ['ราก', 'nature'], ['เห็ด', 'nature'], ['จันทรา', 'moon'], ['แสง', 'light'], ['บรรพบุรุษ', 'ancestor'],
  ['เตาหลอม', 'ancestor'], ['ศิลา', 'ancestor'], ['เสียงกระซิบ', 'moon'], ['เพลิง', 'dragon'], ['พายุ', 'dragon'], ['ราหู', 'dragon'], ['ไม่มี', 'none'], ['เฟือง', 'none'],
];
/** the people and faith of a documented country, in the sim's own terms */
function readDoc(d: CountryDoc, fallbackRaces: string[]) {
  const races: { race: string; w: number }[] = [];
  d.races.split(/\s+/).forEach((tok, i) => {
    const hit = RACE_KW.find(([k]) => tok.includes(k));
    if (!hit) return;
    const w = Math.max(3, 10 - i * 2);
    const ex = races.find((r) => r.race === hit[1]);
    if (ex) ex.w += w; else races.push({ race: hit[1], w });
  });
  if (!races.length) for (const r of new Set(fallbackRaces)) races.push({ race: r, w: 4 });
  races.sort((a, b) => b.w - a.w);
  const rel = RELIGION_KW.find(([k]) => d.religion.includes(k));
  return { races, religion: rel ? rel[1] : '' };
}

/** where the docs put a country on its continent (map units); everything else is spread out around them */
const SEED_HINTS: Record<string, [number, number]> = {
  'AL-01': [722, 440], 'AL-20': [770, 318], 'AL-28': [960, 400], 'AL-04': [680, 590], 'AL-17': [800, 520], 'AL-02': [640, 480],
  'SV-01': [262, 280], 'SV-02': [350, 290], 'SV-03': [395, 330], 'SV-04': [150, 300], 'SV-05': [130, 250], 'SV-06': [330, 190], 'SV-07': [250, 165], 'SV-08': [225, 405], 'SV-09': [170, 385],
  'SV-10': [255, 225], 'SV-11': [300, 240], 'SV-12': [265, 335], 'SV-13': [225, 320], 'SV-14': [345, 235], 'SV-15': [310, 330],
  'MK-01': [1150, 250], 'MK-04': [1112, 300], 'MK-09': [1280, 200], 'MK-07': [1250, 170], 'MK-13': [1060, 255],
  'KD-10': [935, 755], 'KD-08': [780, 805], 'KD-01': [1000, 725],
  'NB-08': [705, 130], 'NB-01': [770, 120], 'NB-12': [780, 75], 'NB-09': [900, 150], 'NB-03': [620, 160],
  'SH-03': [1285, 500], 'SH-17': [1260, 560], 'SH-01': [1200, 650], 'SH-15': [1130, 500],
  'MH-10': [215, 640], 'MH-08': [335, 725], 'MH-11': [450, 800],
};

const HISTORY_TEMPLATES = [
  'เมื่อ {n} ปีก่อน มังกรเผาเมืองหลวงจนวอด แต่ชาวเมืองสร้างใหม่บนเถ้าถ่าน',
  'ก่อตั้งโดยวีรชนผู้ปราบราชาปีศาจรุ่นที่ {k}',
  'เคยเป็นเมืองขึ้นของประเทศเพื่อนบ้านนาน {n} ปี ก่อนกบฏสำเร็จ',
  'ขึ้นชื่อเรื่องโรงเรียนเวทที่เก่าแก่ที่สุดในทวีป',
  'โรคระบาดดำเมื่อ {n} ปีก่อนคร่าประชากรไปครึ่งหนึ่ง',
  'มีตำนานว่าเทพองค์หนึ่งเคยลงมาเดินบนแผ่นดินนี้',
  'กษัตริย์องค์ก่อนถูกลอบปลงพระชนม์ คดียังเป็นปริศนา',
  'เหมืองแร่มิธริลทำให้ร่ำรวยแต่ถูกเพื่อนบ้านหมายตา',
  'ทำสนธิสัญญาสันติภาพกับเผ่าที่เคยเป็นศัตรูเมื่อ {n} ปีก่อน',
  'ดันเจี้ยนใต้เมืองหลวงยังไม่เคยมีใครลงไปถึงชั้นล่างสุด',
  'ประตูมิติเปิดขึ้นเมื่อ {n} ปีก่อน มีผู้ถูกอัญเชิญจากต่างโลกโผล่มา',
  'เป็นที่ฝังศพของจอมเวทลิชผู้ถูกผนึก',
];

export interface WorldMap {
  w: number;
  h: number;
  country: Int16Array; // -1 = ocean
  countries: Country[];
  towns: Town[];
}

let cached: WorldMap | null = null;

export function generateWorld(): WorldMap {
  if (cached) return cached;
  const rng = new RNG(WORLD_SEED);
  const noise = makeNoise(rng.int(1, 1e9));
  const noise2 = makeNoise(rng.int(1, 1e9));
  const W = MAP_W, H = MAP_H;
  const S = SCALE;

  // which landmass (src/world/geo.ts) owns each tile; the map is painted from the same field
  const tileDef = new Int16Array(W * H).fill(-1);
  const contOf = new Int8Array(W * H).fill(-1);
  const tilePerMU = 8 / MU_TO_WU;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = ownerAt((x + 0.5) * tilePerMU, (y + 0.5) * tilePerMU);
    if (d >= 0) { tileDef[y * W + x] = d; contOf[y * W + x] = DEFS[d].cont; }
  }

  const country = new Int16Array(W * H).fill(-1);
  const countries: Country[] = [];
  const usedNames = new Set<string>();

  for (const cont of CONTINENTS) {
    const tiles: number[] = [];
    for (let i = 0; i < W * H; i++) if (contOf[i] === cont.id) tiles.push(i);
    const seeds: number[] = [];
    const docs = COUNTRY_DOCS.filter((d) => d.cont === cont.id);
    const docOrder: CountryDoc[] = [];
    // archipelagos (Azgar, Nerea): every island is one country, in the order of the docs
    const archipelago = DEFS.some((d) => d.cont === cont.id && d.country !== undefined);
    if (archipelago) {
      for (let k = 0; k < cont.count; k++) {
        const own = tiles.filter((t) => DEFS[tileDef[t]].country === k);
        if (!own.length) { seeds.push(rng.pick(tiles)); continue; }
        let mx = 0, my = 0;
        for (const t of own) { mx += t % W; my += Math.floor(t / W); }
        mx /= own.length; my /= own.length;
        seeds.push(own.reduce((best, t) => (Math.hypot((t % W) - mx, Math.floor(t / W) - my) < Math.hypot((best % W) - mx, Math.floor(best / W) - my) ? t : best)));
      }
    } else {
      // documented places first, at the spot the docs give them
      for (const d of docs) {
        const h = SEED_HINTS[d.code];
        if (!h) continue;
        const gx = (h[0] * MU_TO_WU) / 8, gy = (h[1] * MU_TO_WU) / 8;
        let best = -1, bd = Infinity;
        for (const t of tiles) { const dd = Math.hypot((t % W) - gx, Math.floor(t / W) - gy); if (dd < bd) { bd = dd; best = t; } }
        if (best >= 0 && seeds.every((q) => Math.hypot((q % W) - (best % W), Math.floor(q / W) - Math.floor(best / W)) >= 5)) { seeds.push(best); docOrder.push(d); }
      }
      let minD = Math.sqrt(tiles.length / cont.count) * 0.8;
      let guard = 0;
      while (seeds.length < cont.count && guard < 20000) {
        guard++;
        if (guard % 2000 === 0) minD *= 0.8;
        const t = rng.pick(tiles);
        const tx = t % W, ty = Math.floor(t / W);
        if (seeds.every((s) => Math.hypot((s % W) - tx, Math.floor(s / W) - ty) >= minD)) seeds.push(t);
      }
    }
    if (archipelago) docOrder.push(...docs);
    else {
      // the rest of the countries take the remaining seeds so that each bloc of the docs (allies, a branch of the world tree) sits side by side
      const slot: (CountryDoc | undefined)[] = seeds.map((_, k) => docOrder[k]);
      const free = new Set(seeds.map((_, k) => k).filter((k) => !slot[k]));
      const sp = (k: number): [number, number] => [seeds[k] % W, Math.floor(seeds[k] / W)];
      const placedBloc = new Map<string, number[]>();
      slot.forEach((d, k) => { if (d?.bloc) placedBloc.set(d.bloc, [...(placedBloc.get(d.bloc) || []), k]); });
      const rest = docs.filter((d) => !slot.includes(d));
      const blocSize = (d: CountryDoc) => (d.bloc ? docs.filter((o) => o.bloc === d.bloc).length : 0);
      rest.sort((a, b) => blocSize(b) - blocSize(a) || (a.bloc < b.bloc ? -1 : a.bloc > b.bloc ? 1 : 0));
      const loose = rng.shuffle(rest.filter((d) => !d.bloc)); // countries that belong to no bloc fill what is left, anywhere
      for (const d of [...rest.filter((d) => d.bloc), ...loose]) {
        if (!free.size) break;
        const mates = d.bloc ? placedBloc.get(d.bloc) : undefined;
        let pick = -1;
        if (mates?.length) {
          const cx = mates.reduce((a, k) => a + sp(k)[0], 0) / mates.length, cy = mates.reduce((a, k) => a + sp(k)[1], 0) / mates.length;
          let bd = Infinity;
          for (const k of free) { const dd = Math.hypot(sp(k)[0] - cx, sp(k)[1] - cy); if (dd < bd) { bd = dd; pick = k; } }
        } else pick = rng.pick([...free]);
        free.delete(pick); slot[pick] = d;
        if (d.bloc) placedBloc.set(d.bloc, [...(placedBloc.get(d.bloc) || []), pick]);
      }
      docOrder.length = 0;
      docOrder.push(...(slot.filter(Boolean) as CountryDoc[]));
    }
    const baseId = countries.length;
    seeds.forEach((s, k) => {
      const doc = docOrder[k];
      const id = baseId + k;
      const sx = s % W, sy = Math.floor(s / W);
      const climate = cont.climates.length === 1 ? cont.climates[0] : cont.climates[Math.min(cont.climates.length - 1, Math.floor(noise2(sx / (20 * S) + 50, sy / (20 * S)) * cont.climates.length * 1.15))];
      const parsed = readDoc(doc, cont.races);
      const races = parsed.races;
      const major = races[0].race;
      const religion = parsed.religion || rng.weighted(RELIGION_BY_RACE[major] || [['none', 1]], (x) => x[1])![0];
      const history = [doc.story, doc.hook].filter(Boolean);
      countries.push({
        id, code: doc.code, title: doc.title, name: doc.name, continent: cont.id, climate, gov: doc.gov, races,
        danger: Math.max(1, Math.min(5, climateById(climate).danger + rng.int(-1, 1))),
        cx: sx, cy: sy, tiles: 0, neighbors: [], flags: [], warWith: null, until: {}, history,
        religion, towns: [],
      });
    });
    // Voronoi with warped distance: every country is stretched along an axis of its own and weighted by how big its government is,
    // so borders are not circles around a point; allies, empires and city-states take shapes and sizes of their own
    const r0 = Math.sqrt(tiles.length / Math.max(1, seeds.length));
    const shape = seeds.map((_, k) => {
      const d = docOrder[k];
      const gov = d ? d.gov : '';
      const big = /จักรวรรดิ|มหา|อาณาจักร/.test(gov) ? 0.16 : /นครรัฐ|นคร|เมืองอิสระ/.test(gov) ? -0.08 : 0;
      return { ang: rng.float(0, Math.PI), stretch: rng.float(1, 1.75), w: (big + rng.float(-0.09, 0.09)) * r0 };
    });
    for (const t of tiles) {
      if (archipelago) { country[t] = baseId + DEFS[tileDef[t]].country!; continue; }
      const tx = t % W, ty = Math.floor(t / W);
      let best = Infinity, bi = baseId;
      const wx = (noise(tx / (9 * S) + 100, ty / (9 * S)) - 0.5) * 10 * S + (noise(tx / (26 * S) + 300, ty / (26 * S)) - 0.5) * 16 * S;
      const wy = (noise(tx / (9 * S), ty / (9 * S) + 100) - 0.5) * 10 * S + (noise(tx / (26 * S), ty / (26 * S) + 300) - 0.5) * 16 * S;
      for (let k = 0; k < seeds.length; k++) {
        const sd = seeds[k], sh = shape[k];
        const ddx = (sd % W) - tx - wx, ddy = Math.floor(sd / W) - ty - wy;
        const u = ddx * Math.cos(sh.ang) + ddy * Math.sin(sh.ang), v = (ddy * Math.cos(sh.ang) - ddx * Math.sin(sh.ang)) * sh.stretch;
        const d = Math.hypot(u, v) - sh.w;
        if (d < best) { best = d; bi = baseId + k; }
      }
      country[t] = bi;
    }
    if (!archipelago) {
      seeds.forEach((sd, k) => { country[sd] = baseId + k; });
      // a country is one piece: stray fragments of the warp go to the neighbour they touch most
      const seen = new Uint8Array(W * H);
      const comps: { id: number; cells: number[] }[] = [];
      for (const t0 of tiles) {
        if (seen[t0]) continue;
        const id = country[t0], cells: number[] = [t0];
        seen[t0] = 1;
        for (let i = 0; i < cells.length; i++) {
          const c = cells[i], cx = c % W, cy = Math.floor(c / W);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const n = ny * W + nx;
            if (!seen[n] && country[n] === id && contOf[n] === cont.id) { seen[n] = 1; cells.push(n); }
          }
        }
        comps.push({ id, cells });
      }
      const biggest = new Map<number, number>();
      for (const c of comps) if (c.cells.length > (biggest.get(c.id) ?? 0)) biggest.set(c.id, c.cells.length);
      for (const c of comps) {
        if (c.cells.length === biggest.get(c.id)) continue;
        const votes = new Map<number, number>();
        for (const cell of c.cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = (cell % W) + dx, ny = Math.floor(cell / W) + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const o = country[ny * W + nx];
          if (o >= 0 && o !== c.id && contOf[ny * W + nx] === cont.id) votes.set(o, (votes.get(o) || 0) + 1);
        }
        let win = -1, wv = 0;
        for (const [o, v] of votes) if (v > wv) { wv = v; win = o; }
        if (win >= 0) for (const cell of c.cells) country[cell] = win;
      }
    }
  }

  // centroid, tile count, neighbors
  const sx = new Float64Array(countries.length), sy = new Float64Array(countries.length);
  const nb = countries.map(() => new Set<number>());
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = country[y * W + x];
      if (c < 0) continue;
      countries[c].tiles++;
      sx[c] += x; sy[c] += y;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= W || ny >= H) continue;
        const o = country[ny * W + nx];
        if (o >= 0 && o !== c) { nb[c].add(o); nb[o].add(c); }
      }
    }
  }
  const tilesOf: number[][] = countries.map(() => []);
  for (let i = 0; i < W * H; i++) if (country[i] >= 0) tilesOf[country[i]].push(i);
  for (const c of countries) {
    if (c.tiles > 0) {
      // snap centroid onto an owned tile
      let cx = Math.round(sx[c.id] / c.tiles), cy = Math.round(sy[c.id] / c.tiles);
      if (country[cy * W + cx] !== c.id) {
        let bd = Infinity;
        for (const i of tilesOf[c.id]) {
          const d = Math.hypot((i % W) - cx, Math.floor(i / W) - cy);
          if (d < bd) { bd = d; c.cx = i % W; c.cy = Math.floor(i / W); }
        }
      } else { c.cx = cx; c.cy = cy; }
    }
    c.neighbors = [...nb[c.id]];
    // island nations: connect by sea to nearest same-continent countries
    if (c.neighbors.length === 0) {
      c.neighbors = countries.filter((o) => o.id !== c.id && o.continent === c.continent)
        .sort((a, b) => Math.hypot(a.cx - c.cx, a.cy - c.cy) - Math.hypot(b.cx - c.cx, b.cy - c.cy)).slice(0, 2).map((o) => o.id);
    }
  }
  // towns: a capital near the centroid plus 1-4 more, spaced apart on the country's own tiles
  const towns: Town[] = [];
  const TOWN_PRE = ['เมือง', 'บ้าน', 'ป้อม', 'ท่า', 'หมู่บ้าน', 'ตำบล', 'นิคม'];
  for (const c of countries) {
    const n = 1 + Math.max(4, Math.min(16, Math.round(c.tiles / 100)));
    const syl = NAME_SYL[c.continent];
    const used = new Set<string>();
    // keep towns a tile away from the shore so they never sit on the drawn coastline
    const inland = (x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (country[(y + dy) * W + x + dx] !== c.id) return false; return true; };
    if (!inland(c.cx, c.cy)) {
      let bd = Infinity;
      for (const i of tilesOf[c.id]) {
        const x = i % W, y = Math.floor(i / W);
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || !inland(x, y)) continue;
        const d = Math.hypot(x - c.cx, y - c.cy);
        if (d < bd) { bd = d; c.cx = x; c.cy = y; }
      }
    }
    const pts: [number, number][] = [[c.cx, c.cy]];
    for (let tries = 0; pts.length < n && tries < 1200; tries++) {
      const t = rng.pick(tilesOf[c.id]);
      const x = t % W, y = Math.floor(t / W);
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      if ((tries > 600 || inland(x, y)) && pts.every(([px, py]) => Math.hypot(px - x, py - y) >= 16)) pts.push([x, y]);
    }
    pts.forEach(([x, y], k) => {
      let name = '';
      for (let g = 0; g < 20 && (!name || used.has(name)); g++) {
        const base = rng.pick(syl[0]) + rng.pick(syl[2]);
        name = k === 0 ? `นครหลวง${base}` : rng.pick(TOWN_PRE) + base;
      }
      used.add(name);
      const town: Town = { id: towns.length, countryId: c.id, name, x, y, capital: k === 0, size: k === 0 ? 3 : rng.int(1, 2) };
      towns.push(town);
      c.towns.push(town.id);
    });
  }
  cached = { w: W, h: H, country, countries, towns };
  return cached;
}
