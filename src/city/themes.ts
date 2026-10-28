// How a country's towns look. Each continent has a base theme (palette, building shapes, street plan, ambience);
// every country then bends it by its own faith, people and a stable hash so no two countries share a skyline.
import { CONT } from '../world/geo';
import { RNG, hashString } from '../sim/rng';
import type { Country } from '../sim/types';
import { flavorOf, type Special } from './flavor';
import { mixC } from './draw';

export type BStyle = 'gable' | 'dome' | 'hut' | 'aframe' | 'tree' | 'stone' | 'tent' | 'stilt' | 'brick' | 'spire' | 'forge' | 'mushroom' | 'keep' | 'terrace' | 'adobe' | 'carved' | 'boomtown' | 'burrow' | 'tower';
export type TreeKind = 'oak' | 'pine' | 'palm' | 'dead' | 'jungle' | 'cactus' | 'none';
export type Plan = 'grid' | 'organic' | 'radial' | 'canal';
export type WallKind = 'stone' | 'palisade' | 'hedge' | 'iron' | 'none';
export type Centre = 'fountain' | 'statue' | 'forge' | 'gear' | 'oasis' | 'bonfire' | 'clock' | 'sapling' | 'worldtree' | 'abyss' | 'arkea' | 'gate' | 'lake' | 'airship' | 'lighthouse' | 'council' | 'pyramid' | 'crystal' | 'obelisk';
export type Ambient = 'none' | 'embers' | 'fog' | 'leaves' | 'smoke' | 'sand' | 'clouds' | 'gulls';

export interface Theme {
  id: string;
  ground: number; // tint of the built-up ground under the town
  road: number; roadDot: number; cobble: boolean; plaza: number;
  roofs: number[]; walls: number[];
  styles: [BStyle, number][];
  temple: BStyle;
  tree: TreeKind; treeDensity: number;
  field: number[]; farm: number; // farmland colours and how much farmland ring the town has
  plan: Plan; wall: WallKind; centre: Centre; ambient: Ambient;
  lamps: boolean; river: boolean; boardwalk: boolean;
  banner: [number, number]; // default flag colours
  leaf: number[]; // foliage of the tree and mushroom houses
  extra: Special[]; // the buildings this country is known for
  graves: boolean;
}

const BASE: Record<number, Omit<Theme, 'leaf' | 'extra' | 'graves'>> = {
  [CONT.azgar]: {
    id: 'azgar', ground: 0xa4da7e, road: 0xdcd6c8, roadDot: 0xc4bdae, cobble: true, plaza: 0xf0eadc,
    roofs: [0x3d78c4, 0xc9a23a, 0xe9e9f6, 0x6aa0d8], walls: [0xf4eedc, 0xe6e0d0],
    styles: [['spire', 4], ['gable', 3], ['dome', 2]], temple: 'spire', tree: 'oak', treeDensity: 0.04,
    field: [0xcfe8b0, 0xa9d68a], farm: 0.5, plan: 'radial', wall: 'none', centre: 'statue', ambient: 'clouds', lamps: true, river: false, boardwalk: false, banner: [0x3d78c4, 0xf2c94c],
  },
  [CONT.morhaven]: {
    id: 'morhaven', ground: 0x9d7e5a, road: 0x8a7350, roadDot: 0x6f5a3e, cobble: false, plaza: 0x9a8260,
    roofs: [0x6d4a36, 0x5a3e30, 0x8a3c30, 0x4a3a30], walls: [0x7a6a58, 0x6a5a48],
    styles: [['tent', 5], ['hut', 3], ['stone', 1]], temple: 'stone', tree: 'dead', treeDensity: 0.03,
    field: [0x8a7a4a, 0x7a6a3a], farm: 0.1, plan: 'organic', wall: 'palisade', centre: 'bonfire', ambient: 'embers', lamps: false, river: false, boardwalk: false, banner: [0x8a2a22, 0x1a1210],
  },
  [CONT.kazdurum]: {
    id: 'kazdurum', ground: 0x45382f, road: 0x4f4440, roadDot: 0x3a302c, cobble: true, plaza: 0x5e524c,
    roofs: [0x4a3a3a, 0x3a3030, 0x5a3a30, 0x6a4034], walls: [0x5a4a44, 0x6a5a52],
    styles: [['forge', 3], ['stone', 5], ['brick', 1]], temple: 'forge', tree: 'none', treeDensity: 0.0,
    field: [0x5a4a3a, 0x4a3a2c], farm: 0.0, plan: 'grid', wall: 'iron', centre: 'forge', ambient: 'embers', lamps: true, river: false, boardwalk: false, banner: [0xc2360c, 0x2a2a30],
  },
  [CONT.nerea]: {
    id: 'nerea', ground: 0x8cc860, road: 0xb08a5a, roadDot: 0x8a6a42, cobble: false, plaza: 0xd8c8a0,
    roofs: [0x4a7ab0, 0xe0e0e0, 0x3a9ab0, 0xe8a060], walls: [0xf0eadc, 0xdcead8],
    styles: [['stilt', 5], ['gable', 2], ['dome', 1]], temple: 'dome', tree: 'palm', treeDensity: 0.07,
    field: [0xb4d88a, 0x98c870], farm: 0.15, plan: 'canal', wall: 'none', centre: 'fountain', ambient: 'gulls', lamps: true, river: false, boardwalk: true, banner: [0x2a7ab0, 0xf0f0f0],
  },
  [CONT.aldria]: {
    id: 'aldria', ground: 0x6aa84f, road: 0xa88a64, roadDot: 0x8a6e4e, cobble: false, plaza: 0xb8b0a0,
    roofs: [0xb04a3a, 0x8a5a3a, 0x5a6a8a, 0x9a6a30], walls: [0xd8c8a8, 0xe4d8bc],
    styles: [['gable', 6], ['stone', 1], ['aframe', 1]], temple: 'gable', tree: 'oak', treeDensity: 0.07,
    field: [0xd2c673, 0xa6cc6a, 0xc9a860], farm: 1.0, plan: 'grid', wall: 'stone', centre: 'fountain', ambient: 'none', lamps: false, river: true, boardwalk: false, banner: [0x8c2030, 0x2c5a9c],
  },
  [CONT.mecharia]: {
    id: 'mecharia', ground: 0x777770, road: 0x6a6a68, roadDot: 0x55555a, cobble: true, plaza: 0x8a8a86,
    roofs: [0x7a7a7a, 0x8a5a4a, 0x4a5a6a, 0x5a5a60], walls: [0xa89888, 0x8f8f90],
    styles: [['brick', 6], ['gable', 1], ['stone', 1]], temple: 'brick', tree: 'none', treeDensity: 0.01,
    field: [0x8c9b64, 0x7a8a58], farm: 0.35, plan: 'grid', wall: 'iron', centre: 'gear', ambient: 'smoke', lamps: true, river: true, boardwalk: false, banner: [0xd8a030, 0x3a3a44],
  },
  [CONT.saharan]: {
    id: 'saharan', ground: 0xe3cc8a, road: 0xd2b27a, roadDot: 0xb8965a, cobble: false, plaza: 0xe8d8a8,
    roofs: [0xd8b878, 0xc8a060, 0xe8d4a8, 0xb8784a], walls: [0xe8d4a8, 0xdcc698],
    styles: [['dome', 6], ['tent', 2], ['stone', 1]], temple: 'dome', tree: 'palm', treeDensity: 0.03,
    field: [0xc8a050, 0x8ab05a], farm: 0.15, plan: 'organic', wall: 'stone', centre: 'oasis', ambient: 'sand', lamps: false, river: false, boardwalk: false, banner: [0xc83a2a, 0xf2c94c],
  },
  [CONT.silvanel]: {
    id: 'silvanel', ground: 0x3c8f45, road: 0x7a6a4a, roadDot: 0x5e5038, cobble: false, plaza: 0x8a9a62,
    roofs: [0x2e7a3e, 0x3d8f45, 0x5aa04e, 0x4a8a5a], walls: [0x7a5a3a, 0x8a6a46],
    styles: [['tree', 7], ['hut', 1]], temple: 'tree', tree: 'jungle', treeDensity: 0.1,
    field: [0x7ab05a, 0x5a9a4a], farm: 0.3, plan: 'organic', wall: 'hedge', centre: 'sapling', ambient: 'leaves', lamps: true, river: true, boardwalk: false, banner: [0x2e7a3e, 0xe8e0a0],
  },
  [CONT.nebulia]: {
    id: 'nebulia', ground: 0x5b6a86, road: 0x565c74, roadDot: 0x434860, cobble: true, plaza: 0x7a8098,
    roofs: [0x4a5a72, 0x3a4660, 0x6a6a86, 0x2e3850], walls: [0x8a90a4, 0x70788c],
    styles: [['gable', 4], ['stone', 2], ['aframe', 1]], temple: 'stone', tree: 'dead', treeDensity: 0.04,
    field: [0x6a7a74, 0x5a6a64], farm: 0.1, plan: 'organic', wall: 'none', centre: 'clock', ambient: 'fog', lamps: true, river: false, boardwalk: false, banner: [0x6a4a9a, 0xd8d0f0],
  },
};

// the faith's own temple look and what each people prefers to build with
const BY_RACE: Record<string, BStyle> = {
  elf: 'tree', fae: 'tree', dwarf: 'stone', dragonkin: 'stone', orc: 'tent', demonkin: 'tent', beast: 'hut', halfling: 'hut',
  merfolk: 'stilt', naga: 'dome', vampire: 'gable', darkelf: 'stone', slime: 'dome',
};

const ACCENTS = [0xc83a2a, 0x2a7ab0, 0xf2c94c, 0x3a9a4a, 0x8a3ac0, 0xe07a30, 0x20a0a0, 0xd04a8a, 0x5a5ad0, 0xf0f0f0];
const hash = (s: string) => hashString(s);

/** the theme of one country: the continent's base, bent by the country's own people, faith and a stable hash */
export function themeFor(co: Pick<Country, 'id' | 'code' | 'continent' | 'races' | 'religion' | 'gov' | 'climate'>): Theme {
  const base = BASE[co.continent] || BASE[CONT.aldria];
  const r = new RNG(hash(`theme${co.id}`));
  const major = co.races[0].race;
  const t: Theme = { ...base, leaf: [0x2e7a3e, 0x3d8f45, 0x5aa04e, 0x4a8a5a], extra: [], graves: false, roofs: base.roofs.slice(), walls: base.walls.slice(), styles: base.styles.map((s) => [...s] as [BStyle, number]), field: base.field.slice() };
  // roofs: a country keeps three of the continent's colours plus its own accent
  t.roofs = r.shuffle(t.roofs.slice()).slice(0, 3);
  const accent = r.pick(ACCENTS);
  t.roofs.push(mixC(accent, t.roofs[0], 0.4)); // the accent is muted toward the continent's own roofs, so a skyline stays believable
  t.banner = [accent, r.pick(ACCENTS.filter((a) => a !== accent))];
  // the dominant people tilt the building shapes
  const pref = BY_RACE[major];
  const hasFlavor = !!flavorOf(co.code).styles;
  if (!hasFlavor) { // a country the docs shape in detail keeps exactly its own mix; the rest lean toward their people's habit
    if (pref && !t.styles.some(([s]) => s === pref)) t.styles.push([pref, 3]);
    else if (pref) for (const s of t.styles) if (s[0] === pref) s[1] += 3;
  }
  // Aldria is a continent of many eras at once: each country sits at its own step of the climb
  if (co.continent === CONT.aldria) {
    const era = r.next();
    if (era > 0.78) { t.roofs = [0x6a6a72, 0x7a5a4a, 0x4a5a6a]; t.styles = [['brick', 6], ['gable', 2]]; t.cobble = true; t.lamps = true; t.road = 0x8a8a86; t.ambient = 'smoke'; }
    else if (era > 0.58) { t.styles = [['gable', 4], ['brick', 3]]; t.cobble = true; t.lamps = true; t.road = 0x9a948a; }
    else if (era < 0.2) { t.styles = [['hut', 3], ['gable', 3]]; t.cobble = false; }
  }
  // plan: most countries keep the continent's plan, some break from it
  if (co.continent === CONT.aldria || co.continent === CONT.mecharia) { if (r.chance(0.25)) t.plan = 'organic'; else if (r.chance(0.2)) t.plan = 'radial'; }
  if (co.continent === CONT.saharan && r.chance(0.3)) t.plan = 'radial';
  if (co.gov.includes('ป้อมปราการ') || co.gov.includes('มาตาธิปไตย')) t.wall = 'stone';
  // a little hue drift in the ground and the walls so neighbours still differ
  const tint = (c: number, k: number) => ((Math.min(255, ((c >> 16) & 255) * k) << 16) | (Math.min(255, ((c >> 8) & 255) * k) << 8) | Math.min(255, (c & 255) * k)) >>> 0;
  t.walls = t.walls.map((w) => tint(w, r.float(0.92, 1.08)));
  t.ground = tint(t.ground, r.float(0.94, 1.06));
  // then what the docs say about this very country wins over the continent's habit
  const f = flavorOf(co.code);
  if (f.styles) t.styles = f.styles.map((x) => [...x] as [BStyle, number]);
  if (f.roofs) { t.roofs = f.roofs.slice(); t.banner = [f.roofs[0], f.roofs[1] ?? t.banner[1]]; }
  if (f.walls) t.walls = f.walls.slice();
  if (f.leaf) t.leaf = f.leaf.slice();
  if (f.plan) t.plan = f.plan;
  if (f.wall) t.wall = f.wall;
  if (f.centre) t.centre = f.centre;
  if (f.ambient) t.ambient = f.ambient;
  if (f.lamps !== undefined) t.lamps = f.lamps;
  if (f.farm !== undefined) t.farm = base.farm * f.farm;
  if (f.tree) t.tree = f.tree;
  if (f.cobble !== undefined) t.cobble = f.cobble;
  if (f.graves) t.graves = true;
  t.extra = (f.extra || []).slice();
  t.id = `${base.id}`;
  return t;
}

export const pickStyle = (t: Theme, r: RNG): BStyle => r.weighted(t.styles, (s) => s[1])![0];
