import { RNG, makeNoise } from './rng';
import type { Continent, Country } from './types';
import { CLIMATES, climateById } from '../data/races';

export const WORLD_SEED = 'อาเธเรีย';
// the continent table below is authored on a 256×144 grid and scaled up by SCALE (3 → 9× the area)
export const SCALE = 3;
export const MAP_W = 256 * SCALE;
export const MAP_H = 144 * SCALE;

// 9 ทวีป รวม 143 ประเทศ
export const CONTINENTS: Continent[] = [
  { id: 0, name: 'อัลเดรีย', desc: 'ทวีปกลางแห่งอาณาจักรมนุษย์ ศูนย์กลางการค้าและสงครามชิงบัลลังก์', climates: ['temperate', 'temperate', 'tropical'], races: ['human', 'human', 'human', 'halfling', 'elf', 'beast', 'dwarf'], count: 22, cx: 128, cy: 72, r: 26 },
  { id: 1, name: 'ซิลวาเนล', desc: 'ป่าพันปีของเอลฟ์และภูตพราย ต้นไม้โลกตั้งตระหง่านใจกลาง', climates: ['tropical', 'temperate'], races: ['elf', 'elf', 'fae', 'fae', 'beast', 'human', 'slime'], count: 16, cx: 60, cy: 45, r: 22 },
  { id: 2, name: 'คาซ-ดูรัม', desc: 'แนวภูเขาไฟและเหมืองลึก บ้านของคนแคระและรังมังกร', climates: ['volcanic', 'frozen', 'volcanic'], races: ['dwarf', 'dwarf', 'dragonkin', 'human', 'orc'], count: 14, cx: 195, cy: 35, r: 20 },
  { id: 3, name: 'ซาฮารัน', desc: 'ผืนทรายไร้ขอบ รัฐสุลต่าน เผ่าออร์ค และกองคาราวานลึกลับ', climates: ['desert', 'desert', 'temperate'], races: ['orc', 'orc', 'human', 'beast', 'demonkin', 'naga'], count: 19, cx: 190, cy: 95, r: 24 },
  { id: 4, name: 'นิวาลิส', desc: 'ทุ่งน้ำแข็งเหนือสุดของโลก ราตรีหกเดือน ปราสาทแวมไพร์ซ่อนในหมอก', climates: ['frozen', 'frozen', 'temperate'], races: ['human', 'human', 'dwarf', 'vampire', 'beast'], count: 15, cx: 120, cy: 17, r: 21 },
  { id: 5, name: 'มอร์เฮเวน', desc: 'ทวีปมืดใต้สุด ดินแดนของดาร์กเอลฟ์ ปีศาจ และผู้ถูกเนรเทศ', climates: ['frozen', 'volcanic'], races: ['darkelf', 'darkelf', 'demonkin', 'vampire', 'orc', 'human'], count: 12, cx: 40, cy: 118, r: 19 },
  { id: 6, name: 'เนเรีย', desc: 'หมู่เกาะนับร้อยกลางทะเล อาณาจักรเงือก นาคา และโจรสลัด', climates: ['islands'], races: ['merfolk', 'merfolk', 'naga', 'human', 'halfling', 'slime'], count: 18, cx: 92, cy: 108, r: 21 },
  { id: 7, name: 'วานารา', desc: 'ป่าดิบชื้นและแม่น้ำใหญ่ อาณาจักรนาคา เผ่าสัตว์ และสไลม์ยักษ์', climates: ['tropical', 'tropical', 'islands'], races: ['naga', 'beast', 'beast', 'slime', 'human', 'fae'], count: 17, cx: 152, cy: 122, r: 19 },
  { id: 8, name: 'อัซการ์', desc: 'ดินแดนมังกรที่ร้อนระอุ สนามประลองของผู้แข็งแกร่ง', climates: ['volcanic', 'desert'], races: ['dragonkin', 'dragonkin', 'demonkin', 'orc'], count: 10, cx: 236, cy: 68, r: 15 },
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

const NAME_SYL: string[][][] = [
  [['เอล', 'คาร์', 'วาล', 'ลอร์', 'แบร', 'ซิล', 'อาร์', 'เม', 'รอส', 'เท'], ['ดอ', 'เว', 'มา', 'ลิ', 'นอ', 'ทา'], ['เรีย', 'เนีย', 'ฮาร์ต', 'ฟอร์ด', 'มอนต์', 'แลนด์', 'กาด', 'ดอร์']],
  [['ซิล', 'เอ', 'ลู', 'ไอ', 'ธา', 'เฟ', 'ลา'], ['วา', 'ริ', 'เล', 'นิ'], ['เนล', 'ธิล', 'ลอร์', 'เดล', 'วิน', 'ลิส']],
  [['คาซ', 'ดูร์', 'บาร์', 'กรอม', 'ธรอ', 'อิร', 'ฮัล'], ['-', 'ก', 'ดู', 'มา'], ['รัม', 'ดิน', 'กาด', 'มอร์', 'ฮอล์ม', 'ดัล']],
  [['ซา', 'อัล', 'คา', 'มา', 'ซุ', 'ฮา', 'รา'], ['ฮา', 'ซี', 'บา', 'มี'], ['ราน', 'ซาร์', 'บัด', 'มีร์', 'ดีน', 'กัช']],
  [['นิฟ', 'ส', 'วอล', 'ฟรอ', 'ฮรีม', 'แยร์', 'บอร์'], ['ก', 'วา', 'ลิ', 'เดน'], ['เฮล์ม', 'กราด', 'วิก', 'สตาด', 'ฮาฟ', 'ลิส']],
  [['มอร์', 'นอค', 'วี', 'เซ', 'ดรา', 'อุล', 'กาธ'], ['ธ', 'ซา', 'รี', 'วา'], ['เฮเวน', 'เรธ', 'ซาร์', 'โมธ', 'ดรีน', 'กูล']],
  [['เน', 'มา', 'โอ', 'คอ', 'ทา', 'ไอ', 'ลา'], ['รี', 'ลา', 'นู', 'วา'], ['เรีย', 'ทอล', 'โมอา', 'นีส', 'ไอล์', 'ปาเล']],
  [['วา', 'นา', 'สุ', 'กา', 'ภู', 'จัน', 'ปา'], ['นา', 'ริ', 'ทะ', 'มา'], ['รา', 'ปุระ', 'วดี', 'ภูมิ', 'นคร', 'ศรี']],
  [['อัซ', 'ดรา', 'วีร์', 'โค', 'ซาก', 'ธี'], ['กา', 'โร', 'ซา'], ['การ์', 'ธรักซ์', 'โมเรีย', 'วาส', 'ดุส']],
];

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
  height: Float32Array;
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
  const contOf = new Int8Array(W * H).fill(-1);
  const height = new Float32Array(W * H);

  const S = SCALE;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let best = -9, bi = -1;
      // noise once per tile (two variants alternate between continents) keeps the bigger map fast to build
      const nA = noise(x / (14 * S), y / (14 * S)) - 0.5, nB = noise(x / (14 * S) + 31, y / (14 * S) + 17) - 0.5;
      const n2 = noise2(x / (5 * S), y / (5 * S)) - 0.5;
      const fine = noise2(x / 4 + 70, y / 4, 2) - 0.5;
      for (const c of CONTINENTS) {
        const dx = (x - c.cx * S) / (c.r * S * 1.25), dy = (y - c.cy * S) / (c.r * S);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 2.2) continue;
        const isl = c.climates[0] === 'islands';
        const n = c.id % 2 ? nA : nB;
        const v = 1 - d + n * 0.9 + (isl ? n2 * 1.1 - 0.12 : n2 * 0.25) + fine * 0.08;
        if (v > best) { best = v; bi = c.id; }
      }
      const i = y * W + x;
      height[i] = best;
      if (best > 0.08) contOf[i] = bi;
    }
  }

  const country = new Int16Array(W * H).fill(-1);
  const countries: Country[] = [];
  const usedNames = new Set<string>();

  for (const cont of CONTINENTS) {
    const tiles: number[] = [];
    for (let i = 0; i < W * H; i++) if (contOf[i] === cont.id) tiles.push(i);
    const seeds: number[] = [];
    let minD = Math.sqrt(tiles.length / cont.count) * 0.8;
    let guard = 0;
    while (seeds.length < cont.count && guard < 20000) {
      guard++;
      if (guard % 2000 === 0) minD *= 0.8;
      const t = rng.pick(tiles);
      const tx = t % W, ty = Math.floor(t / W);
      if (seeds.every((s) => Math.hypot((s % W) - tx, Math.floor(s / W) - ty) >= minD)) seeds.push(t);
    }
    const baseId = countries.length;
    seeds.forEach((s, k) => {
      const id = baseId + k;
      const sx = s % W, sy = Math.floor(s / W);
      const climate = cont.climates.length === 1 ? cont.climates[0] : cont.climates[Math.min(cont.climates.length - 1, Math.floor(noise2(sx / (20 * S) + 50, sy / (20 * S)) * cont.climates.length * 1.15))];
      const races: { race: string; w: number }[] = [];
      const counts: Record<string, number> = {};
      for (const r of cont.races) counts[r] = (counts[r] || 0) + 1;
      for (const [race, c] of Object.entries(counts)) races.push({ race, w: c * rng.float(0.4, 1.6) * 10 });
      if (rng.chance(0.15)) races.push({ race: rng.pick(['human', 'elf', 'dwarf', 'orc', 'beast', 'halfling', 'slime', 'fae']), w: 3 });
      races.sort((a, b) => b.w - a.w);
      const major = races[0].race;
      const gov = rng.chance(0.6) ? rng.pick(GOV_BY_RACE[major] || GOVS) : rng.pick(GOVS);
      let name = '';
      for (let tries = 0; tries < 50; tries++) {
        const syl = NAME_SYL[cont.id];
        const mid = rng.chance(0.45) ? rng.pick(syl[1]).replace('-', '') : '';
        name = rng.pick(syl[0]) + mid + rng.pick(syl[2]);
        if (!usedNames.has(name)) break;
      }
      usedNames.add(name);
      const history = rng.sample(HISTORY_TEMPLATES, 2).map((h) => h.replace('{n}', String(rng.int(30, 900))).replace('{k}', String(rng.int(2, 12))));
      countries.push({
        id, name: `${gov}${name}`, continent: cont.id, climate, gov, races,
        danger: Math.max(1, Math.min(5, climateById(climate).danger + rng.int(-1, 1))),
        cx: sx, cy: sy, tiles: 0, neighbors: [], flags: [], warWith: null, until: {}, history,
        religion: rng.weighted(RELIGION_BY_RACE[major] || [['none', 1]], (x) => x[1])![0], towns: [],
      });
    });
    // Voronoi with warped distance
    for (const t of tiles) {
      const tx = t % W, ty = Math.floor(t / W);
      let best = Infinity, bi = baseId;
      const wx = (noise(tx / (9 * S) + 100, ty / (9 * S)) - 0.5) * 10 * S, wy = (noise(tx / (9 * S), ty / (9 * S) + 100) - 0.5) * 10 * S;
      for (let k = 0; k < seeds.length; k++) {
        const sd = seeds[k];
        const ddx = (sd % W) - tx - wx, ddy = Math.floor(sd / W) - ty - wy;
        const d = ddx * ddx + ddy * ddy;
        if (d < best) { best = d; bi = baseId + k; }
      }
      country[t] = bi;
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
    const pts: [number, number][] = [[c.cx, c.cy]];
    for (let tries = 0; pts.length < n && tries < 1200; tries++) {
      const t = rng.pick(tilesOf[c.id]);
      const x = t % W, y = Math.floor(t / W);
      if (pts.every(([px, py]) => Math.hypot(px - x, py - y) >= 9)) pts.push([x, y]);
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
  cached = { w: W, h: H, country, height, countries, towns };
  return cached;
}

export const climateCount = () => CLIMATES.length;
