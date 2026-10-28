// A town's streets and buildings: layout on a 108 × 67 tile plan (5× the area of the old 48 × 30 scene), painted into one
// transparent pixel texture that sits on the world map at the town's real position. The ground itself is the map's own terrain,
// so shores, floating-island edges and the countryside around a town are the real ones; the town only adds what people built.
import { RNG, hashString } from '../sim/rng';
import { generateWorld, type Town } from '../sim/worldgen';
import type { Country, Fate } from '../sim/types';
import { fateOf } from '../sim/fate';
import { townSpecialty } from '../sim/locale';
import type { Specialty } from '../data/npclife';
import { themeFor, pickStyle, type Theme, type BStyle } from './themes';
import { paintCity } from './paint';
import { MU_TO_WU } from '../world/geo';

export const T = 16; // px per tile
export const CW = 162, CH = 101;
export const CITY_WU = 120; // world units across the whole plan (15 tiles of the map)
export const CITY_S = CITY_WU / (CW * T); // world units per city pixel
export enum Tile { Ground, Road, Plaza, Building, Water, Tree, Wall, Dock, Field, Grave, Void }

export interface BuildingRec { x: number; y: number; w: number; h: number; kind: string; roof: number; wall: number; style: BStyle; seed: number }
export interface Pt { x: number; y: number }
export interface CityData {
  townId: number; theme: Theme; kind: 'grid' | 'river' | 'coast' | 'village' | 'sky';
  grid: Uint8Array; buildings: BuildingRec[]; walk: [number, number][]; lamps: Pt[]; stalls: Pt[];
  plaza: { x: number; y: number; w: number; h: number }; extent: { rx: number; ry: number };
  spec: Specialty; cv: HTMLCanvasElement; edge: boolean;
  fate?: Fate; // set when the story has reshaped the land (ruins, ash, flood...)
}

export interface LandInfo { land: boolean; inland: number }
let probe: ((mx: number, my: number) => LandInfo) | null = null;
const cache = new Map<number, CityData>();
/** the map's land mask (in map units); lets towns respect the real coast */
export function setLandProbe(p: (mx: number, my: number) => LandInfo) { probe = p; cache.clear(); }

const links = new Map<number, { pts: number[]; w: number }[]>();
/** the roads that leave each town, as lines from the town centre to the edge of its plan (tile coordinates) */
export function setTownLinks(m: Map<number, { pts: number[]; w: number }[]>) { links.clear(); m.forEach((v, k) => links.set(k, v)); cache.clear(); }

/** footprint of a town's built-up area, in tiles of the plan: size 1 villages are small, capitals fill the plan */
export const extentOf = (town: Town) => { const f = town.capital ? 0.97 : [0.5, 0.78, 0.97][Math.min(2, town.size - 1)]; return { rx: (CW / 2) * f, ry: (CH / 2) * f }; };

/** what the city needs to know of its country: who they are, and how the story has reshaped them */
export type CityCountry = Pick<Country, 'id' | 'code' | 'continent' | 'races' | 'religion' | 'gov' | 'climate'> & { fate?: Fate; flags?: string[] };

export function getCity(town: Town, country: CityCountry): CityData {
  const fate = fateOf({ fate: country.fate, flags: country.flags ?? [] });
  const hit = cache.get(town.id);
  if (hit && hit.fate === fate) { cache.delete(town.id); cache.set(town.id, hit); return hit; }
  const data = generate(town, country);
  cache.set(town.id, data);
  if (cache.size > 8) cache.delete(cache.keys().next().value as number);
  return data;
}

function generate(town: Town, country: CityCountry): CityData {
  const rng = new RNG(hashString('town' + town.id));
  const theme = themeFor(country);
  const g = new Uint8Array(CW * CH);
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < CW && y < CH;
  const set = (x: number, y: number, v: Tile) => { if (inb(x, y)) g[y * CW + x] = v; };
  const get = (x: number, y: number) => (inb(x, y) ? g[y * CW + x] : Tile.Void);
  const cx = Math.floor(CW / 2), cy = Math.floor(CH / 2);
  const { rx, ry } = extentOf(town);
  const village = town.size === 1 && !town.capital;
  const inExt = (x: number, y: number, k = 1) => ((x - cx) / (rx * k)) ** 2 + ((y - cy) / (ry * k)) ** 2 <= 1;

  // the map's own land under each tile: water, a floating island's rim, the shore band
  let edge = false;
  if (probe) {
    const wx = town.x * 8 + 4, wy = town.y * 8 + 4, tw = T * CITY_S;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const info = probe((wx + (x + 0.5 - CW / 2) * tw) / MU_TO_WU, (wy + (y + 0.5 - CH / 2) * tw) / MU_TO_WU);
      if (!info.land || info.inland < 0.55) { g[y * CW + x] = Tile.Void; if (inExt(x, y, 1.25)) edge = true; }
    }
  }
  const sky = theme.id === 'azgar';
  const river = false; // the map has no rivers yet: a stream that stops at the plan's edge would look like a cut
  const kind: CityData['kind'] = edge ? (sky ? 'sky' : 'coast') : village ? 'village' : river ? 'river' : 'grid';

  const free = (x: number, y: number) => get(x, y) === Tile.Ground;
  const road = (x: number, y: number) => { const t = get(x, y); if (t === Tile.Ground || t === Tile.Tree) set(x, y, Tile.Road); else if (t === Tile.Water) set(x, y, Tile.Dock); };
  const line = (x0: number, y0: number, x1: number, y1: number, w = 1, clip = 1.04) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
      if (!inExt(x, y, clip)) continue;
      for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) road(x + a, y + b);
    }
  };

  if (river) {
    let rxp = rng.int(Math.floor(CW * 0.66), Math.floor(CW * 0.8));
    for (let y = 0; y < CH; y++) { rxp += rng.int(-1, 1); rxp = Math.max(CW * 0.58, Math.min(CW - 5, rxp)); for (let k = 0; k < 4; k++) if (get(rxp + k, y) === Tile.Ground) set(rxp + k, y, Tile.Water); }
  }
  // streets by the plan of the country
  const plan = village ? 'organic' : theme.plan;
  line(cx - rx, cy, cx + rx, cy, 2); line(cx, cy - ry, cx, cy + ry, 2);
  if (plan === 'grid' || plan === 'canal') {
    if (!village) {
      const bx = rng.int(13, 17), by = rng.int(9, 12);
      for (let k = 1; k * bx < rx; k++) for (const s of [-1, 1]) line(cx + s * k * bx, cy - ry, cx + s * k * bx, cy + ry, 1);
      for (let k = 1; k * by < ry; k++) for (const s of [-1, 1]) line(cx - rx, cy + s * k * by, cx + rx, cy + s * k * by, 1);
    }
    if (plan === 'canal') {
      // two canals with bridges where the streets cross them
      for (const dy of [-Math.floor(ry * 0.45), Math.floor(ry * 0.45)]) for (let x = Math.floor(cx - rx * 1.1); x <= cx + rx * 1.1; x++) for (let w = 0; w < 3; w++) { const t = get(x, cy + dy + w); if (inExt(x, cy + dy + w, 1.12) && (t === Tile.Ground || t === Tile.Tree)) set(x, cy + dy + w, Tile.Water); else if (t === Tile.Road) set(x, cy + dy + w, Tile.Dock); }
    }
  } else if (plan === 'radial') {
    for (const f of [0.38, 0.7, 0.97]) for (let a = 0; a < 6.3; a += 0.03) { const x = Math.round(cx + Math.cos(a) * rx * f), y = Math.round(cy + Math.sin(a) * ry * f); road(x, y); road(x + 1, y); }
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; line(cx, cy, Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1); }
  } else {
    // winding lanes: walkers that wander outward from the square, sometimes forking
    const walkers: { x: number; y: number; a: number; life: number }[] = [];
    const n = village ? 5 : 10;
    const reach = Math.max(1, rx / 52); // lanes run as far as the town is wide
    for (let k = 0; k < n; k++) walkers.push({ x: cx, y: cy, a: (k / n) * Math.PI * 2 + rng.float(-0.3, 0.3), life: Math.round(rng.int(village ? 22 : 30, village ? 46 : 70) * reach) });
    while (walkers.length) {
      const w = walkers.pop()!;
      for (let s = 0; s < w.life; s++) {
        w.a += rng.float(-0.28, 0.28);
        w.x += Math.cos(w.a) * 1.1; w.y += Math.sin(w.a) * 0.75;
        const x = Math.round(w.x), y = Math.round(w.y);
        if (!inExt(x, y, 1.05)) break;
        road(x, y); if (s % 3 === 0) road(x + 1, y);
        if (s > 8 && s % 14 === 0 && walkers.length < 22 && rng.chance(0.5)) walkers.push({ x: w.x, y: w.y, a: w.a + (rng.chance(0.5) ? 1.2 : -1.2), life: Math.round(rng.int(14, 34) * reach) });
      }
    }
  }
  // the roads that really leave this town: they run on, outside the streets, to the edge of the plan where the map's own road takes over
  for (const l of links.get(town.id) || []) for (let i = 0; i + 3 < l.pts.length; i += 2) line(l.pts[i], l.pts[i + 1], l.pts[i + 2], l.pts[i + 3], l.w, 99);
  // the square
  const pw = village ? 5 : theme.centre === 'worldtree' ? 11 : 8, ph = village ? 3 : theme.centre === 'worldtree' ? 7 : 5;
  for (let y = cy - ph; y <= cy + ph; y++) for (let x = cx - pw; x <= cx + pw + 1; x++) { const t = get(x, y); if (t !== Tile.Water && t !== Tile.Void) set(x, y, Tile.Plaza); }
  const plaza = { x: cx - pw, y: cy - ph, w: pw * 2 + 2, h: ph * 2 + 1 };
  // walls around a capital, stakes around a camp, hedges around a grove
  if ((town.capital || (theme.wall === 'palisade') || (!village && theme.wall !== 'none')) && theme.wall !== 'none') {
    for (let a = 0; a < 6.3; a += 0.012) {
      const x = Math.round(cx + Math.cos(a) * rx * 1.04), y = Math.round(cy + Math.sin(a) * ry * 1.04);
      const t = get(x, y);
      if (t === Tile.Ground || t === Tile.Tree) set(x, y, Tile.Wall);
    }
  }
  // buildings along the streets
  const buildings: BuildingRec[] = [];
  // a street within three tiles
  const nearRoad = (x: number, y: number, w: number, h: number) => { for (let i = x - 3; i <= x + w + 2; i++) for (let j = y - 3; j <= y + h + 3; j++) { const t = get(i, j); if (t === Tile.Road || t === Tile.Plaza) return true; } return false; };
  // `side` is the yard kept free left and right: terraced townhouses may touch, huts and tents keep their space
  const clear = (x: number, y: number, w: number, h: number, side = 1) => { for (let i = x - side; i <= x + w - 1 + side; i++) for (let j = y - 1; j <= y + h; j++) if (get(i, j) !== Tile.Ground) return false; return true; };
  const wallOf = () => rng.pick(theme.walls);
  // the landmark in the square takes its ground; nobody builds or walks there
  const CENTRE: Record<string, [number, number]> = { worldtree: [6, 3], abyss: [5, 2], arkea: [6, 3], gate: [4, 2], lake: [4, 2], airship: [6, 2], lighthouse: [1, 1], council: [6, 3], pyramid: [4, 2], crystal: [2, 1], obelisk: [2, 1], oasis: [3, 2], statue: [2, 1], forge: [2, 1], gear: [2, 1], bonfire: [2, 1], clock: [1, 1], sapling: [2, 1], fountain: [2, 1], skynest: [3, 2], caldera: [3, 3], stairgate: [3, 1], twinpalace: [3, 2], eridan: [3, 1], liftmine: [3, 1], pump: [2, 1], rainspire: [2, 1] };
  const [crx, cry] = CENTRE[theme.centre] || [1, 1];
  for (let y = cy - cry; y <= cy + cry; y++) for (let x = cx - crx; x <= cx + crx + 1; x++) if (get(x, y) === Tile.Plaza) set(x, y, Tile.Building);
  // what the country is known for first (near the square), then the houses
  const DIM: Record<string, [number, number, number, number]> = { arena: [10, 12, 8, 9], warehouse: [8, 11, 5, 6], granary: [7, 10, 5, 6], market: [8, 12, 5, 7], cathedral: [8, 10, 6, 8], library: [7, 9, 6, 7], barracks: [8, 11, 5, 6], minehead: [6, 8, 5, 6], fortress: [11, 13, 8, 9], drill: [7, 9, 5, 6], shops: [8, 11, 4, 5], bank: [6, 8, 5, 6], hospital: [8, 10, 5, 6], aerie: [4, 5, 7, 8], skydock: [6, 8, 6, 7] };
  const base = ['temple', 'tavern', 'smithy', 'guild', 'tavern', 'smithy'].slice(0, town.capital ? 6 : village ? 3 : 5);
  const extraCap = town.capital ? 99 : village ? 3 : 7;
  // a town of a land at war keeps its fortress for the larger towns; every town has its shops
  const role = theme.extra.filter((k) => !(k === 'fortress' && village));
  const must = [...base, ...(town.capital ? ['shops', 'shops', 'shops'] : village ? ['shops'] : ['shops', 'shops']), ...role.slice(0, extraCap)];
  let hall = 0;
  if (town.capital) {
    // the seat of government: a large hall just off the square
    for (let tries = 0; tries < 600; tries++) {
      const w = rng.int(11, 13), h = rng.int(7, 8), x = rng.int(cx - 30, cx + 30), y = cy - ph - h - 2 - rng.int(0, 3 + Math.floor(tries / 100));
      // the hall may cut across a street: the street simply ends at its walls
      let free = true;
      for (let i = x - 1; i <= x + w && free; i++) for (let j = y - 1; j <= y + h && free; j++) { const t = get(i, j); if (t !== Tile.Ground && t !== Tile.Road && t !== Tile.Tree) free = false; }
      if (!free) continue;
      for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) set(i, j, Tile.Building);
      buildings.push({ x, y, w, h, kind: 'palace', roof: theme.roofs[0], wall: wallOf(), style: theme.temple === 'tree' ? 'stone' : theme.temple, seed: rng.int(1, 1e9) });
      hall = 1;
      break;
    }
  }
  void hall;
  const place = (kind: string, w: number, h: number, x: number, y: number) => {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) set(i, j, Tile.Building);
    buildings.push({ x, y, w, h, kind, roof: rng.pick(theme.roofs), wall: wallOf(), style: kind === 'temple' ? theme.temple : kind === 'smithy' && theme.id === 'kazdurum' ? 'forge' : pickStyle(theme, rng), seed: rng.int(1, 1e9) });
  };
  for (const kind of must) {
    const dim = DIM[kind] || [5, 8, 5, 6];
    for (let tries = 0; tries < 2500; tries++) {
      const w = rng.int(dim[0], dim[1]), h = rng.int(dim[2], dim[3]);
      const a = rng.float(0, Math.PI * 2), rr = Math.sqrt(rng.next());
      const x = Math.round(cx + Math.cos(a) * rx * rr * 0.95 - w / 2), y = Math.round(cy + Math.sin(a) * ry * rr * 0.95 - h / 2);
      if (!inb(x, y) || !clear(x, y, w, h) || !nearRoad(x, y, w, h)) continue;
      if (Math.hypot(x - cx, (y - cy) * 1.6) > rx * (0.4 + tries / 2500)) continue;
      place(kind, w, h, x, y);
      break;
    }
  }
  // about two fifths of the built-up ground is houses, each 3–6 tiles wide and 3–5 deep
  const want = buildings.length + Math.round((Math.PI * rx * ry * 0.4) / 18);
  const TERRACE: string[] = ['gable', 'stone', 'brick', 'spire', 'dome', 'forge', 'keep', 'aframe', 'terrace', 'tower', 'carved', 'boomtown', 'adobe'];
  for (let tries = 0; buildings.length < want && tries < 40000; tries++) {
    const w = rng.int(3, 6), h = rng.int(3, 5);
    const a = rng.float(0, Math.PI * 2), rr = Math.sqrt(rng.next());
    const x = Math.round(cx + Math.cos(a) * rx * rr * 0.97 - w / 2), y = Math.round(cy + Math.sin(a) * ry * rr * 0.97 - h / 2);
    const style = pickStyle(theme, rng);
    if (!inb(x, y) || !clear(x, y, w, h, !village && TERRACE.includes(style) ? 0 : 1) || !nearRoad(x, y, w, h)) continue;
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) set(i, j, Tile.Building);
    buildings.push({ x, y, w, h, kind: 'house', roof: rng.pick(theme.roofs), wall: wallOf(), style, seed: rng.int(1, 1e9) });
  }
  // farmland and outlying plots ring the town; a graveyard for towns that honour (or fear) their dead
  if (theme.farm > 0) {
    const plots = Math.round((village ? 16 : 9) * theme.farm);
    for (let k = 0; k < plots; k++) for (let tries = 0; tries < 30; tries++) {
      const a = rng.float(0, Math.PI * 2), rr = rng.float(1.02, 1.5);
      const x = Math.round(cx + Math.cos(a) * rx * rr), y = Math.round(cy + Math.sin(a) * ry * rr);
      const fw = rng.int(6, 11), fh = rng.int(4, 7);
      if (!inb(x, y) || !inb(x + fw, y + fh) || inExt(x, y, 0.98)) continue;
      let ok = true;
      for (let i = x; i < x + fw && ok; i++) for (let j = y; j < y + fh; j++) if (get(i, j) !== Tile.Ground) { ok = false; break; }
      if (!ok) continue;
      for (let i = x; i < x + fw; i++) for (let j = y; j < y + fh; j++) set(i, j, Tile.Field);
      break;
    }
  }
  if (theme.graves || ['ancestor', 'demon'].includes(country.religion)) {
    for (let tries = 0; tries < 300; tries++) {
      const gx = rng.int(4, CW - 10), gy = rng.int(4, CH - 7);
      if (!inExt(gx, gy, 1.0) || inExt(gx, gy, 0.5) || !clear(gx, gy, 6, 4)) continue;
      for (let x = gx; x < gx + 6; x++) for (let y = gy; y < gy + 4; y++) set(x, y, Tile.Grave);
      break;
    }
  }
  // piers over the water (or landing stages over the sky)
  if (edge) {
    const shore: [number, number, number, number][] = [];
    for (let y = 1; y < CH - 1; y++) for (let x = 1; x < CW - 1; x++) {
      const t = get(x, y);
      if ((t !== Tile.Ground && t !== Tile.Road) || !inExt(x, y, 1.15)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (get(x + dx, y + dy) === Tile.Void) { shore.push([x, y, dx, dy]); break; }
    }
    const piers: [number, number][] = [];
    for (let k = 0; k < 90 && piers.length < 5 && shore.length; k++) {
      const [x, y, dx, dy] = rng.pick(shore);
      if (piers.some(([px, py]) => Math.hypot(px - x, py - y) < 12)) continue;
      const len = rng.int(6, 11);
      for (let s = 1; s <= len; s++) for (let wd = 0; wd < 2; wd++) { const px = x + dx * s + (dy !== 0 ? wd : 0), py = y + dy * s + (dx !== 0 ? wd : 0); if (get(px, py) === Tile.Void) set(px, py, Tile.Dock); }
      piers.push([x, y]);
    }
  }
  // trees in what is left
  if (theme.tree !== 'none') for (let i = 0; i < CW * CH; i++) {
    if (g[i] !== Tile.Ground) continue;
    const x = i % CW, y = Math.floor(i / CW);
    const out = inExt(x, y, 0.95) ? 1 : 2.2;
    if (rng.chance(theme.treeDensity * out)) g[i] = Tile.Tree;
  }
  const walk: [number, number][] = [];
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const t = g[y * CW + x]; if (t === Tile.Road || t === Tile.Plaza || t === Tile.Dock) walk.push([x, y]); }
  const lamps: Pt[] = [];
  if (theme.lamps) for (let y = 0; y < CH; y += 1) for (let x = 0; x < CW; x += 1) if (g[y * CW + x] === Tile.Road && (x * 7 + y * 13) % 19 === 0 && g[y * CW + x - 1] !== Tile.Building && inExt(x, y, 1)) lamps.push({ x: x * T + T / 2, y: y * T + T - 2 });
  const stalls: Pt[] = [];
  for (let k = 0; k < (village ? 3 : 6); k++) stalls.push({ x: (plaza.x + 2 + k * 3) * T, y: (plaza.y + plaza.h - 1) * T });
  const spec = townSpecialty(town.id, country);
  const data: CityData = { townId: town.id, theme, kind, grid: g, buildings, walk, lamps, stalls, plaza, extent: { rx, ry }, spec, cv: document.createElement('canvas'), edge, fate: fateOf({ fate: country.fate, flags: country.flags ?? [] }) };
  paintCity(data, town);
  return data;
}

