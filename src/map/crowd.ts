// The people of a town on the map: a few dozen looks of the people the docs say live in the country, at every age and both sexes, that the crowd of the
// town repeats. The races come from the country's own line "เผ่า" (`races`: "คนแคระ", "ผู้รอดชีวิตจากโครงการตุ๊กตา ลูกผสมจักรกล หุ่นหนีนาย"), first-named
// most, not from the races of its few named NPCs (a country of dwarves with one human NPC is not half human). Clothes, hair and hats vary by person
// inside what the continent wears (docs/appearance/countries/*: "ผู้คน", "วัสดุและสี"). Pure data to looks; the painting is the scene's (src/art/phaser.ts).
import type { Country } from '../core/data/types-npcs';
import type { LooksData } from '../core/data/types-looks';
import type { GameData } from '../core/game';
import type { PersonLook, Stage } from '../art/look';
import { hash as fnv, raceLook } from '../art/resolve';
import { mix } from './color';

/** FNV of near strings (`NB-10:3`, `NB-10:4`) has near high bits; the finaliser of murmur3 spreads them. */
const hash = (s: string): number => {
  let h = fnv(s);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
};

const STAGES: Stage[] = ['adult', 'adult', 'teen', 'adult', 'child', 'elder', 'adult', 'adult', 'child', 'elder', 'adult', 'teen', 'adult', 'adult', 'elder', 'adult'];
/** Looks per country: the crowd repeats them, so more of them means fewer twins side by side. */
export const CROWD_LOOKS = 24;

/** Words of the `races` line → the race they name (longest first: ดาร์กเอลฟ์ before เอลฟ์, เผ่าสัตว์ before สัตว์). */
const WORDS: [string, string][] = [
  ['ดาร์กเอลฟ์', 'darkelf'], ['หุ่นวิญญาณ', 'soulmachine'], ['หุ่นที่มีวิญญาณ', 'soulmachine'], ['ลูกผสมจักรกล', 'construct'], ['ผู้รอดชีวิต', 'human'], ['ผู้ถูกเนรเทศ', 'human'],
  ['ผู้ลี้ภัย', 'human'], ['ผู้ติดตั้ง', 'human'], ['ชนผืนทราย', 'human'], ['ชนใต้ทราย', 'human'], ['ชาวหมอก', 'human'], ['ชาวพื้น', 'human'], ['เผ่ามังกร', 'dragonkin'],
  ['เผ่าปีศาจ', 'demonkin'], ['เผ่าลาวา', 'lavakin'], ['เผ่าสัตว์', 'beast'], ['ฮาล์ฟลิง', 'halfling'], ['อาเวียน', 'winged'], ['ชาวน้ำฟ้า', 'winged'], ['แวมไพร์', 'vampire'],
  ['คนแคระ', 'dwarf'], ['เดรุยด์', 'elf'], ['เอลฟ์', 'elf'], ['ออร์ค', 'orc'], ['โอเกอร์', 'orc'], ['มัมมี่', 'mummy'], ['สไลม์', 'slime'], ['เงือก', 'merfolk'], ['ไซเรน', 'merfolk'],
  ['นาคา', 'naga'], ['ภูต', 'fae'], ['ยักษ์', 'giant'], ['กูล', 'ghoul'], ['มนุษย์', 'human'], ['สัตว์', 'beast'], ['หุ่น', 'soulmachine'], ['ปีก', 'winged'],
];
/** What "ทุกเผ่า" (every people) means in a crowd. */
const EVERY: [string, number][] = [['human', 1], ['elf', 0.4], ['dwarf', 0.4], ['halfling', 0.4], ['beast', 0.25], ['orc', 0.15], ['merfolk', 0.05]];
/** Races that a country names after its main people are a minority in the street (the doc says "a few": the dolls, the machines). */
const RARE: Record<string, number> = { construct: 0.5, soulmachine: 0.35, mummy: 0.5, ghoul: 0.5, slime: 0.5, giant: 0.5 };

/** The races of a `races` line with weights: the first named is the most. Empty when no word is known. */
export function racesOfLine(line: string, known: (id: string) => boolean): [string, number][] {
  if (line.includes('ทุกเผ่า')) return EVERY.filter(([r]) => known(r));
  const found: { at: number; race: string }[] = [];
  let rest = line;
  for (const [w, race] of WORDS) {
    for (let i = rest.indexOf(w); i >= 0; i = rest.indexOf(w)) {
      found.push({ at: i, race });
      rest = rest.slice(0, i) + ' '.repeat(w.length) + rest.slice(i + w.length);
      if (found.length > 12) break;
    }
  }
  found.sort((a, b) => a.at - b.at);
  const out: [string, number][] = [];
  for (const f of found) {
    if (!known(f.race) || out.some(([r]) => r === f.race)) continue;
    const n = out.length;
    out.push([f.race, (n === 0 ? 1 : 0.6 / (1 + n * 0.6)) * (n > 0 ? RARE[f.race] ?? 1 : 1)]);
  }
  return out;
}

interface Theme {
  /** clothes of the plain races (human, halfling, elf, dwarf out of the apron) */
  outfits: string[];
  /** cloth colours (main, second) */
  cloth: string[];
  hats?: string[];
  /** share of adults that wear a hat of the list */
  hatShare?: number;
  tools?: string[];
}
const THEMES: Record<string, Theme> = {
  AZ: { outfits: ['light', 'tunic', 'robe', 'cloak'], cloth: ['#e8e8f0', '#c8d4e8', '#d8c890', '#8a9ac0', '#b8b0a0'] },
  MH: { outfits: ['leather', 'fur', 'rags', 'tunic'], cloth: ['#5a3a30', '#6a2a24', '#4a4040', '#7a5a3a', '#3a3036'], hats: ['hood', 'furhat'], hatShare: 0.25 },
  KD: { outfits: ['apron', 'miner', 'leather', 'apron'], cloth: ['#6a4a30', '#5a4a3a', '#8a6a48', '#4a4040', '#7a3a2a'], hats: ['minerhat', 'goggles'], hatShare: 0.15, tools: ['smithhammer', 'hammer', 'pickaxe', 'smallhammer'] },
  NR: { outfits: ['sailor', 'sarong', 'light', 'tunic'], cloth: ['#4a7a9a', '#d8c8a0', '#6aa0a8', '#c8a060', '#e8e0d0'], hats: ['straw', 'bandana'], hatShare: 0.3 },
  AL: { outfits: ['tunic', 'apron', 'light', 'cloak', 'leather', 'tunic'], cloth: ['#8a7458', '#6a7a9a', '#9a5a4a', '#6a8a5a', '#c8b070', '#7a5a8a'], hats: ['cap', 'straw', 'wide'], hatShare: 0.22 },
  MK: { outfits: ['apron', 'miner', 'leather', 'light'], cloth: ['#5a5e66', '#6a6258', '#4a5058', '#7a5a4a', '#8a8a8c'], hats: ['goggles', 'cap'], hatShare: 0.25, tools: ['wrench', 'smallhammer', 'gauge', ''] },
  SH: { outfits: ['light', 'sarong', 'robe', 'cloak'], cloth: ['#d8c090', '#e8e0c8', '#b88a58', '#c87a4a', '#6a8aa0'], hats: ['turban', 'wide', 'veil'], hatShare: 0.6 },
  SV: { outfits: ['light', 'leather', 'cloak', 'tunic'], cloth: ['#3a7a4a', '#5a8a50', '#8a9a5a', '#c8b880', '#6a5a3a'] },
  NB: { outfits: ['rags', 'cloak', 'light', 'rags'], cloth: ['#6a6258', '#7a6a5a', '#58606a', '#6a5a5a', '#8a8478'], hats: ['cowl', 'veil', 'hood'], hatShare: 0.85 },
};
const PLAIN = new Set(['human', 'halfling', 'elf', 'dwarf', 'darkelf', 'orc', 'beast']);
const HAIR_COLORS = ['#3a2a20', '#5a3a24', '#2a2420', '#8a6a3a', '#b09050', '#6a3a2a', '#1e1a18'];
const HAIR_M = ['short', 'cropped', 'curly', 'wild', 'tied', 'short'];
const HAIR_F = ['long', 'braid', 'bun', 'ponytail', 'tied', 'long'];
/** Parts of a construct that show what it is: a town of runaway machines takes them off (NB-10: "ถอดชิ้นส่วนที่บ่งชี้ออกแล้ว"). */
const HIDE = ['mecheye', 'mecharm', 'visor', 'core', 'steam'];

/** Looks of the crowd of one country. */
export function crowdLooks(looks: LooksData, country: Pick<Country, 'id' | 'continent' | 'races' | 'npcs'>): PersonLook[] {
  const theme = THEMES[country.continent] ?? THEMES.AL;
  let list = racesOfLine(country.races ?? '', (r) => !!looks.races[r]);
  if (!list.length) {
    const rs = [...new Set((country.npcs ?? []).map((n) => looks.npcs[n]?.race).filter((r): r is string => !!r && !!looks.races[r]))];
    list = (rs.length ? rs : ['human']).map((r, i) => [r, 1 / (1 + i)] as [string, number]);
  }
  const total = list.reduce((a, [, w]) => a + w, 0);
  const pickRace = (h: number) => {
    let x = (h / 4294967296) * total;
    for (const [r, w] of list) if ((x -= w) < 0) return r;
    return list[0][0];
  };
  const out: PersonLook[] = [];
  for (let i = 0; i < CROWD_LOOKS; i++) {
    const seed = `${country.id}:${i}`;
    const h = hash(seed), h2 = hash(`${seed}:b`), h3 = hash(`${seed}:c`);
    const race = pickRace(h);
    const fem = (h2 & 1) === 1;
    let L: PersonLook;
    try {
      L = raceLook(looks, race, { stage: STAGES[i % STAGES.length], fem, seed });
    } catch {
      continue;
    }
    const young = L.stage === 'infant' || L.stage === 'child';
    const plain = PLAIN.has(race);
    if (plain && race !== 'dwarf' && race !== 'darkelf') L.outfit = theme.outfits[h3 % theme.outfits.length];
    if (race === 'dwarf' && !young && L.outfit === 'apron') L.outfit = h3 % 4 === 0 ? theme.outfits[h3 % theme.outfits.length] : 'apron';
    if (young) L.outfit = L.outfit === 'rags' ? 'rags' : 'tunic';
    if (plain || race === 'construct') {
      L.main = theme.cloth[h2 % theme.cloth.length];
      L.second = mix(theme.cloth[(h2 >>> 4) % theme.cloth.length], L.main, 0.35);
    }
    if (plain && L.stage !== 'elder' && L.hair && race !== 'darkelf') {
      L.hairColor = HAIR_COLORS[(h3 >>> 3) % HAIR_COLORS.length];
      if (race === 'human' || race === 'halfling' || race === 'elf') L.hair = (fem ? HAIR_F : HAIR_M)[(h3 >>> 6) % 6];
    }
    if (!young && theme.hats && ((h3 >>> 9) % 100) / 100 < (theme.hatShare ?? 0) && (plain || race === 'construct')) L.hat = theme.hats[(h >>> 5) % theme.hats.length];
    if (!young && theme.tools && race === 'dwarf') L.tool = theme.tools[h2 % theme.tools.length];
    else if (!young && theme.tools && race === 'construct') L.tool = theme.tools[h2 % theme.tools.length];
    else if (!young && plain && race === 'human') L.tool = '';
    // a country of hidden machines: no eye, no arm of metal, a cloth over the face
    if (country.continent === 'NB' && (race === 'construct' || race === 'soulmachine')) {
      L.feats = L.feats.filter((f) => !HIDE.includes(f));
      if (!young) L.hat = 'cowl';
      L.outfit = 'rags';
    }
    L.key = `${L.key}~${i}`;
    out.push(L);
  }
  return out;
}

export function crowdOf(data: GameData): (countryId: string) => PersonLook[] {
  const looks = (data.looks?.items as LooksData | undefined) ?? null;
  const countries = new Map(((data.countries?.items as Country[] | undefined) ?? []).map((c) => [c.id, c]));
  const cache = new Map<string, PersonLook[]>();
  return (id) => {
    if (!looks) return [];
    let list = cache.get(id);
    const c = countries.get(id);
    if (list || !c) return list ?? [];
    list = crowdLooks(looks, c);
    cache.set(id, list);
    return list;
  };
}
