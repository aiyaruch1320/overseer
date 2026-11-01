// A town's streets and buildings: layout on a 108 × 67 tile plan (5× the area of the old 48 × 30 scene), painted into one
// transparent pixel texture that sits on the world map at the town's real position. The ground itself is the map's own terrain,
// so shores, floating-island edges and the countryside around a town are the real ones; the town only adds what people built.
import { RNG, hashString, makeNoise } from '../sim/rng';
import { generateWorld, type Town } from '../sim/worldgen';
import type { Country, Fate } from '../sim/types';
import { fateOf } from '../sim/fate';
import { townSpecialty } from '../sim/locale';
import type { Specialty } from '../data/npclife';
import { themeFor, pickStyle, type Theme, type BStyle } from './themes';
import { paintCity } from './paint';
import { FOOT, SITE, MINOR_CENTRE, FURNITURE } from './landmarks';
import { HEART_FOOT, type Heart } from './hearts';
import { wealthOf, portOf, floatsOf, heartOf } from './flavor';
import { MU_TO_WU } from '../world/geo';

export const T = 16; // px per tile
const BASE_CENTRE: Record<string, string> = { azgar: 'statue', morhaven: 'bonfire', kazdurum: 'forge', nerea: 'fountain', aldria: 'fountain', mecharia: 'gear', saharan: 'oasis', silvanel: 'sapling', nebulia: 'clock' };
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
  plazaMode: 'centre' | 'offset' | 'none' | 'heart'; // where the square is: in the middle, off to one side, hardly there (a crossing), or given over to the town's one great building
  landmark?: { kind: string; x: number; y: number; k: number }; // the monument (px of the plan) and its scale: a capital's is full size, an ordinary town's a smaller one of the same kind
  centrepiece?: { kind: string; x: number; y: number; k: number }; // a capital whose great monument stands away from the square (a lighthouse on the shore, a spire on the cliff) still has this one in the middle of it
  furniture: { kind: string; x: number; y: number; v: number }[]; // what stands around the square (benches, lamps, braziers...): one tile each, never walked through
  roadCls: Uint8Array; wealth: number; // street class per tile, and how rich the town is (0 poor … 1 great): decides what its streets are made of
  wet: Uint8Array; // tiles standing on water (a floating town): their streets are boardwalks and their houses sit on rafts
  ships: { x: number; y: number; len: number; horizontal: boolean; kind: string; seed: number }[]; // moored ships, in tiles
  cranes: Pt[]; beacons: Pt[]; // harbour cranes and the light at a pier's end (px)
  port: number; // 0 none, 1 harbour, 2 a great trading port
  solid: number[]; // tiles that keep their ground but cannot be walked: the foot of the monument, the market stalls
  gates: { ax: number; ay: number; bx: number; by: number }[]; // the wall tiles on each side of a street that passes through the wall
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
  // a floating town builds out over the water: the sea inside its plan becomes buildable (boardwalks and rafts), and what is left empty goes back to sea
  const wet = new Uint8Array(CW * CH);
  const floating = !!probe && floatsOf(country.code, hashString('fl' + town.id));
  if (floating) for (let i = 0; i < CW * CH; i++) if (g[i] === Tile.Void && inExt(i % CW, Math.floor(i / CW), 0.99)) { g[i] = Tile.Ground; wet[i] = 1; }
  const port = edge || floating ? portOf(country.code, town.capital) : 0;
  if (floating) { theme.farm = 0; theme.graves = false; theme.wall = 'none'; theme.ambient = 'gulls'; theme.tree = 'none'; if (!theme.styles.some(([s]) => s === 'stilt')) theme.styles.push(['stilt', 6]); }
  const sky = theme.id === 'azgar';
  const river = false; // the map has no rivers yet: a stream that stops at the plan's edge would look like a cut
  const kind: CityData['kind'] = edge ? (sky ? 'sky' : 'coast') : village ? 'village' : river ? 'river' : 'grid';

  const free = (x: number, y: number) => get(x, y) === Tile.Ground;
  const roadCls = new Uint8Array(CW * CH); // 0 lane, 1 street, 2 avenue: the better the street, the better its surface
  const road = (x: number, y: number, cls = 0) => { const t = get(x, y); if (t === Tile.Ground || t === Tile.Tree) set(x, y, Tile.Road); else if (t === Tile.Water) set(x, y, Tile.Dock); if (inb(x, y)) roadCls[y * CW + x] = Math.max(roadCls[y * CW + x], cls); };
  const line = (x0: number, y0: number, x1: number, y1: number, w = 1, clip = 1.04) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
      if (!inExt(x, y, clip)) continue;
      for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) road(x + a, y + b, Math.min(2, w));
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
    for (const f of [0.38, 0.7, 0.97]) for (let a = 0; a < 6.3; a += 0.03) { const x = Math.round(cx + Math.cos(a) * rx * f), y = Math.round(cy + Math.sin(a) * ry * f); road(x, y, 1); road(x + 1, y, 1); }
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; line(cx, cy, Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1); }
  } else {
    // winding lanes: walkers that wander outward from the square, sometimes forking
    const walkers: { x: number; y: number; a: number; life: number }[] = [];
    // each lane bends slowly (its curvature drifts, it does not jitter) and is two tiles wide, so it reads as one smooth road and not a staircase of single tiles
    const n = village ? 5 : 10;
    const reach = Math.max(1, rx / 52); // lanes run as far as the town is wide
    for (let k = 0; k < n; k++) walkers.push({ x: cx, y: cy, a: (k / n) * Math.PI * 2 + rng.float(-0.3, 0.3), life: Math.round(rng.int(village ? 22 : 30, village ? 46 : 70) * reach) });
    while (walkers.length) {
      const w = walkers.pop()!;
      let curv = rng.float(-0.03, 0.03);
      for (let s = 0; s < w.life; s++) {
        curv = Math.max(-0.07, Math.min(0.07, curv * 0.92 + rng.float(-0.018, 0.018)));
        w.a += curv;
        w.x += Math.cos(w.a) * 1.2; w.y += Math.sin(w.a) * 0.85;
        const x = Math.round(w.x), y = Math.round(w.y);
        if (!inExt(x, y, 1.05)) break;
        road(x, y);
        if (Math.abs(Math.cos(w.a)) > Math.abs(Math.sin(w.a)) * 1.3) road(x, y + 1); else road(x + 1, y);
        if (s > 10 && s % 18 === 0 && walkers.length < 18 && rng.chance(0.5)) walkers.push({ x: w.x, y: w.y, a: w.a + (rng.chance(0.5) ? 1.0 : -1.0), life: Math.round(rng.int(16, 34) * reach) });
      }
    }
  }
  // the roads that really leave this town: they run on, outside the streets, to the edge of the plan where the map's own road takes over
  for (const l of links.get(town.id) || []) for (let i = 0; i + 3 < l.pts.length; i += 2) line(l.pts[i], l.pts[i + 1], l.pts[i + 2], l.pts[i + 3], l.w, 99);
  // the square: not every town has one, and where it has, it is not always in the middle. A town known for one great thing (a holy city, a fortress, a bazaar) keeps that in place of a square
  const spec0 = townSpecialty(town.id, country);
  const pr = new RNG(hashString('plz' + town.id));
  const roll = pr.next();
  const HEART_OF_SPEC: Record<string, Heart> = { pilgrim: 'minster', scholar: 'academy', magic: 'academy', arena: 'arena', trade: 'bazaar', spice: 'bazaar' };
  let heart: Heart | null = null;
  if (theme.centre !== 'worldtree' && !floating) {
    if (town.capital) heart = heartOf(country.code) && roll < 0.85 ? heartOf(country.code) : null;
    else if (!village && HEART_OF_SPEC[spec0.id] && roll < 0.4) heart = HEART_OF_SPEC[spec0.id];
  }
  let plazaMode: CityData['plazaMode'] = heart ? 'heart' : 'centre';
  if (!heart) {
    const r2 = pr.next();
    plazaMode = town.capital ? (r2 < 0.55 ? 'centre' : 'offset') : village ? (r2 < 0.2 ? 'centre' : r2 < 0.55 ? 'offset' : 'none') : (r2 < 0.25 ? 'centre' : r2 < 0.65 ? 'offset' : 'none');
  }
  const pw = plazaMode === 'none' ? 2 : plazaMode === 'heart' ? 6 : village ? 5 : town.capital ? 10 : 8, ph = plazaMode === 'none' ? 1 : plazaMode === 'heart' ? 4 : village ? 3 : town.capital ? 6 : 5; // (the world tree has no monument in the square: the tree itself, drawn on the map, is what the town stands under)
  let plx = cx, ply = cy;
  if (plazaMode === 'offset' || (plazaMode === 'none' && pr.chance(0.6))) {
    const sx = pr.chance(0.5) ? 1 : -1, sy = pr.chance(0.5) ? 1 : -1;
    plx = cx + sx * Math.round(rx * pr.float(0.26, 0.4)); ply = cy + sy * Math.round(ry * pr.float(0.12, 0.3));
    if (plazaMode === 'none') { plx = cx + sx * Math.round(rx * pr.float(0.15, 0.4)); }
  }
  if (plazaMode === 'heart') ply = cy + 3; // the forecourt lies in front of the great building, which rises behind it
  const rect = { x0: plx - pw, y0: ply - ph, x1: plx + pw + 1, y1: ply + ph };
  // a street from the middle of the town to the square, if the square stands to one side
  if (plx !== cx || ply !== cy) { line(cx, cy, plx, ply, 2, 1.3); line(plx - pw - 3, ply, plx + pw + 4, ply, 2, 1.3); }
  for (let y = rect.y0; y <= rect.y1; y++) for (let x = rect.x0; x <= rect.x1; x++) { const t = get(x, y); if (t !== Tile.Water && t !== Tile.Void) set(x, y, Tile.Plaza); }
  const plaza = { x: plx - pw, y: ply - ph, w: pw * 2 + 2, h: ph * 2 + 1 };
  // walls around a capital, stakes around a camp, hedges around a grove
  if ((town.capital || (theme.wall === 'palisade') || (!village && theme.wall !== 'none')) && theme.wall !== 'none') {
    for (let a = 0; a < 6.3; a += 0.012) {
      const x = Math.round(cx + Math.cos(a) * rx * 1.01), y = Math.round(cy + Math.sin(a) * ry * 1.01);
      const t = get(x, y);
      if (t === Tile.Ground || t === Tile.Tree) set(x, y, Tile.Wall);
    }
  }
  // the gates: where a street (one or two tiles wide) passes through the wall; a tower stands on the wall tile at each side
  const gates: CityData['gates'] = [];
  const seenGate = new Set<string>();
  const addGate = (ax: number, ay: number, bx: number, by: number) => { const k = `${ax},${ay},${bx},${by}`; if (!seenGate.has(k)) { seenGate.add(k); gates.push({ ax, ay, bx, by }); } };
  for (let y = 1; y < CH - 1; y++) for (let x = 1; x < CW - 1; x++) {
    if (get(x, y) !== Tile.Road) continue;
    if (get(x, y - 1) === Tile.Wall) { let j = y + 1; while (get(x, j) === Tile.Road && j < y + 4) j++; if (get(x, j) === Tile.Wall) addGate(x, y - 1, x, j); }
    if (get(x - 1, y) === Tile.Wall) { let i = x + 1; while (get(i, y) === Tile.Road && i < x + 4) i++; if (get(i, y) === Tile.Wall) addGate(x - 1, y, i, y); }
  }
  // buildings along the streets
  const buildings: BuildingRec[] = [];
  // a street within three tiles
  const nearRoad = (x: number, y: number, w: number, h: number) => { for (let i = x - 3; i <= x + w + 2; i++) for (let j = y - 3; j <= y + h + 3; j++) { const t = get(i, j); if (t === Tile.Road || t === Tile.Plaza) return true; } return false; };
  // `side` is the yard kept free left and right: terraced townhouses may touch, huts and tents keep their space
  const clear = (x: number, y: number, w: number, h: number, side = 1) => { for (let i = x - side; i <= x + w - 1 + side; i++) for (let j = y - 1; j <= y + h; j++) if (get(i, j) !== Tile.Ground) return false; return true; };
  const wallOf = () => rng.pick(theme.walls);
  // the landmark in the square takes its ground; nobody builds or walks there
  // ---- the monument: only the capitals (and now and then a great town) have one, and it stands where the country's theme puts it
  const solid = new Set<number>();
  const stalls: Pt[] = [];
  for (let k = 0; k < (village ? 3 : 6); k++) stalls.push({ x: (plaza.x + 2 + k * 3) * T, y: (plaza.y + plaza.h - 1) * T });
  for (const s of stalls) for (let x = Math.floor(s.x / T); x <= Math.floor((s.x + 22) / T); x++) solid.add(Math.floor(s.y / T) * CW + x);
  let landmark: CityData['landmark'];
  // every town has a monument in its square: a capital (or now and then a great town) the full one of its country, the rest a smaller one of the same kind
  const major = town.capital || (town.size >= 2 && hashString('lm' + town.id) % 7 === 0);
  const kind0: string = heart ?? (major || MINOR_CENTRE.has(theme.centre) ? theme.centre : (BASE_CENTRE[theme.id] ?? 'fountain'));
  const k = heart ? (town.capital ? 1 : 0.75) : major ? (MINOR_CENTRE.has(kind0) ? 1.25 : 1) : village ? 0.6 : 0.78; // the monuments that stand in a square are drawn a little larger for a capital
  const foot0 = plazaMode === 'none' ? undefined : heart ? HEART_FOOT[heart] : FOOT[kind0];
  const foot = foot0 && { rx: foot0.rx * k, ry: foot0.ry * k, up: foot0.up * k, upW: foot0.upW * k };
  if (foot) {
    const open = (px: number, py: number, strict: boolean) => {
      for (let y = Math.floor((py - foot.up) / T); y <= Math.floor((py + foot.ry) / T); y++) for (let x = Math.floor((px - Math.max(foot.rx, foot.upW / 2)) / T); x <= Math.floor((px + Math.max(foot.rx, foot.upW / 2)) / T); x++) {
        const cxp = (x + 0.5) * T, cyp = (y + 0.5) * T;
        const inBase = ((cxp - px) / (foot.rx + 6)) ** 2 + ((cyp - py) / (foot.ry + 6)) ** 2 <= 1;
        const inCol = foot.up > 0 && Math.abs(cxp - px) <= foot.upW / 2 + 4 && cyp <= py && cyp >= py - foot.up;
        if (!inBase && !inCol) continue;
        const t = get(x, y);
        if (t === Tile.Void || t === Tile.Water || t === Tile.Wall || t === Tile.Dock || t === Tile.Building || solid.has(y * CW + x)) return false;
        if (strict && t === Tile.Road) return false;
        if (!inb(x, y)) return false;
      }
      return true;
    };
    const site = heart ? 'core' : major ? (SITE[kind0] ?? 'plaza') : 'core';
    const pcx = (plaza.x + plaza.w / 2) * T, pcy = (plaza.y + plaza.h / 2) * T;
    const cand: { x: number; y: number; s: number }[] = [];
    if (site === 'core') cand.push({ x: pcx, y: pcy, s: 1 });
    else if (site === 'plaza') { const side = rng.chance(0.5) ? 1 : -1; for (const dx of [0.2, 0.14, 0.08, 0]) for (const dy of [-0.1, 0, 0.1]) for (const sd of [side, -side]) cand.push({ x: pcx + sd * dx * plaza.w * T, y: pcy + dy * plaza.h * T, s: 1 - dx }); }
    else {
      const [k0, k1] = site === 'shore' ? [0.55, 0.92] : site === 'edge' ? [0.5, 0.88] : [0.4, 0.72];
      for (let i = 0; i < 160; i++) {
        const a = rng.float(0, Math.PI * 2), k = rng.float(k0, k1), x = (cx + Math.cos(a) * rx * k) * T, y = (cy + Math.sin(a) * ry * k) * T;
        let score = rng.float(0, 0.4);
        if (site === 'edge' || site === 'shore') { let voids = 0; for (let dy = -10; dy <= 10; dy += 2) for (let dx = -14; dx <= 14; dx += 2) if (get(Math.floor(x / T) + dx, Math.floor(y / T) + dy) === Tile.Void) voids++; score += voids / 60; }
        if (site === 'craft') score += Math.abs(Math.cos(a)) * 0.6; // the working quarter lies out along the main street
        if (Math.hypot(x - pcx, (y - pcy) * 1.4) < plaza.w * T * 0.6) score -= 2; // not on the square itself
        cand.push({ x, y, s: score });
      }
    }
    cand.sort((p, q) => q.s - p.s);
    for (const strict of [true, false]) {
      const hit = cand.find((q) => open(q.x, q.y, strict));
      if (hit) { landmark = { kind: kind0, x: Math.round(hit.x), y: Math.round(hit.y), k }; break; }
    }
    if (landmark) {
      const { x: lx, y: ly } = landmark;
      for (let y = Math.floor((ly - foot.up) / T); y <= Math.floor((ly + foot.ry) / T); y++) for (let x = Math.floor((lx - Math.max(foot.rx, foot.upW / 2)) / T); x <= Math.floor((lx + Math.max(foot.rx, foot.upW / 2)) / T); x++) {
        const cxp = (x + 0.5) * T, cyp = (y + 0.5) * T;
        const inBase = ((cxp - lx) / (foot.rx + 6)) ** 2 + ((cyp - ly) / (foot.ry + 6)) ** 2 <= 1;
        const inCol = foot.up > 0 && Math.abs(cxp - lx) <= foot.upW / 2 + 4 && cyp <= ly && cyp >= ly - foot.up;
        if (!inBase && !inCol) continue;
        const t = get(x, y);
        if (t === Tile.Plaza) solid.add(y * CW + x); else if (t === Tile.Ground || t === Tile.Road || t === Tile.Tree) set(x, y, Tile.Building);
      }
    }
  }
  let centrepiece: CityData['centrepiece'];
  const inSquare = plazaMode === 'none' || landmark && Math.abs(landmark.x - (plaza.x + plaza.w / 2) * T) < plaza.w * T * 0.3 && Math.abs(landmark.y - (plaza.y + plaza.h / 2) * T) < plaza.h * T * 0.4;
  if (!inSquare && kind0 !== 'worldtree') {
    const kc = MINOR_CENTRE.has(kind0) ? kind0 : (BASE_CENTRE[theme.id] ?? 'fountain'), f = FOOT[kc], kk = 1.15;
    if (f) {
      centrepiece = { kind: kc, x: Math.round((plaza.x + plaza.w / 2) * T), y: Math.round((plaza.y + plaza.h / 2) * T), k: kk };
      for (let y = plaza.y; y < plaza.y + plaza.h; y++) for (let x = plaza.x; x < plaza.x + plaza.w; x++) if (get(x, y) === Tile.Plaza && ((((x + 0.5) * T) - centrepiece.x) / (f.rx * kk)) ** 2 + ((((y + 0.5) * T) - centrepiece.y) / (f.ry * kk)) ** 2 <= 1) solid.add(y * CW + x);
    }
  }
  // the square's furniture: what the country puts around its square, spaced along the edge and clear of the monument, the stalls and the streets that enter it
  const furniture: CityData['furniture'] = [];
  const kinds = FURNITURE[theme.id] ?? FURNITURE.aldria;
  const nF = plazaMode === 'none' ? 2 : heart ? 6 : town.capital ? 22 : village ? 7 : 14;
  const fr = new RNG(hashString('furn' + town.id));
  for (let tries = 0; tries < 400 && furniture.length < nF; tries++) {
    const side = fr.int(0, 3), u = fr.float(0.04, 0.96), inset = fr.float(0.9, 1.9);
    const tx = side < 2 ? plaza.x + Math.floor(u * plaza.w) : side === 2 ? plaza.x + Math.floor(inset) : plaza.x + plaza.w - 1 - Math.floor(inset);
    const ty = side >= 2 ? plaza.y + Math.floor(u * plaza.h) : side === 0 ? plaza.y + Math.floor(inset) : plaza.y + plaza.h - 1 - Math.floor(inset);
    if (ty >= plaza.y + plaza.h - 2 || get(tx, ty) !== Tile.Plaza || solid.has(ty * CW + tx) || wet[ty * CW + tx]) continue; // (the bottom rows hold the stalls)
    const clearOfRoads = Math.abs(tx - plx) > 2 && Math.abs(ty - ply) > 1; // the two avenues cross the square through its middle: keep them open
    const fx = tx * T + T / 2, fy = ty * T + T - 3;
    if (!clearOfRoads || furniture.some((o) => Math.hypot(o.x - fx, (o.y - fy) * 1.6) < 38)) continue;
    if (landmark && foot && Math.hypot((fx - landmark.x) / (foot.rx + 18), (fy - landmark.y) / (foot.ry + 14)) < 1) continue;
    if (centrepiece && Math.hypot((fx - centrepiece.x) / ((FOOT[centrepiece.kind]?.rx ?? 40) * centrepiece.k + 18), (fy - centrepiece.y) / ((FOOT[centrepiece.kind]?.ry ?? 20) * centrepiece.k + 14)) < 1) continue;
    furniture.push({ kind: fr.pick(kinds), x: fx, y: fy, v: fr.int(0, 5) });
    solid.add(ty * CW + tx);
  }
  // what the country is known for first (near the square), then the houses
  const DIM: Record<string, [number, number, number, number]> = { arena: [10, 12, 8, 9], warehouse: [8, 11, 5, 6], granary: [7, 10, 5, 6], market: [8, 12, 5, 7], cathedral: [8, 10, 6, 8], library: [7, 9, 6, 7], barracks: [8, 11, 5, 6], minehead: [6, 8, 5, 6], temple: [8, 10, 6, 8], fortress: [11, 13, 8, 9], drill: [7, 9, 5, 6], shops: [8, 11, 4, 5], bank: [6, 8, 5, 6], hospital: [8, 10, 5, 6], aerie: [4, 5, 7, 8], skydock: [6, 8, 6, 7] };
  const base = ['temple', 'tavern', 'smithy', 'guild', 'tavern', 'smithy'].slice(0, town.capital ? 6 : village ? 3 : 5);
  const extraCap = town.capital ? 99 : village ? 3 : 7;
  // a town of a land at war keeps its fortress for the larger towns; every town has its shops
  const role = theme.extra.filter((k) => !(k === 'fortress' && village));
  const must = [...base, ...(town.capital ? ['shops', 'shops', 'shops'] : village ? ['shops'] : ['shops', 'shops']), ...role.slice(0, extraCap)];
  let hall = 0;
  if (town.capital) {
    // the seat of government: a large hall just off the square
    for (let tries = 0; tries < 600; tries++) {
      const w = rng.int(11, 13), h = rng.int(7, 8), x = rng.int(plx - 30, plx + 30), y = ply - ph - h - 2 - rng.int(0, 3 + Math.floor(tries / 100));
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
  // districts, as in a real town: the civic buildings gather round the square, the trades along the streets out from it, the noisy and the bulky
  // toward the wall, the soldiers in one quarter by the gates
  const radOf = (x: number, y: number) => Math.hypot((x - cx) / rx, (y - cy) / ry);
  const angOf = (x: number, y: number) => Math.atan2((y - cy) / ry, (x - cx) / rx);
  const adiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const milAng = rng.float(0, Math.PI * 2);
  const nearVoid = (x: number, y: number) => { for (let dy = -6; dy <= 6; dy += 3) for (let dx = -8; dx <= 8; dx += 4) if (get(x + dx, y + dy) === Tile.Void) return true; return false; };
  const PREF: Record<string, (x: number, y: number) => number> = {
    temple: (x, y) => (radOf(x, y) < 0.5 ? 1 : 0.15), cathedral: (x, y) => (radOf(x, y) < 0.5 ? 1 : 0.1), guild: (x, y) => (radOf(x, y) < 0.5 ? 1 : 0.2), bank: (x, y) => (radOf(x, y) < 0.45 ? 1 : 0.05),
    library: (x, y) => (radOf(x, y) < 0.55 ? 1 : 0.2), shops: (x, y) => (radOf(x, y) < 0.5 ? 1 : 0.2), market: (x, y) => (radOf(x, y) < 0.5 ? 1 : 0.2), tavern: (x, y) => (radOf(x, y) < 0.75 ? 1 : 0.3),
    hospital: (x, y) => (radOf(x, y) > 0.25 && radOf(x, y) < 0.7 && adiff(angOf(x, y), milAng) > 1.6 ? 1 : 0.1),
    smithy: (x, y) => (radOf(x, y) > 0.4 && radOf(x, y) < 0.9 ? 1 : 0.15), minehead: (x, y) => (radOf(x, y) > 0.5 ? 1 : 0.1),
    warehouse: (x, y) => (nearVoid(x, y) ? 1 : radOf(x, y) > 0.55 ? 0.6 : 0.1), skydock: (x, y) => (nearVoid(x, y) ? 1 : 0.05), granary: (x, y) => (radOf(x, y) > 0.55 ? 1 : 0.15),
    barracks: (x, y) => (radOf(x, y) > 0.5 && adiff(angOf(x, y), milAng) < 0.8 ? 1 : 0.06), fortress: (x, y) => (radOf(x, y) > 0.45 && adiff(angOf(x, y), milAng) < 0.6 ? 1 : 0.04),
    drill: (x, y) => (radOf(x, y) > 0.5 && adiff(angOf(x, y), milAng) < 0.9 ? 1 : 0.05), aerie: (x, y) => (nearVoid(x, y) ? 1 : 0.15),
    arena: (x, y) => (radOf(x, y) > 0.45 && radOf(x, y) < 0.9 && adiff(angOf(x, y), milAng + Math.PI / 2) < 0.9 ? 1 : 0.1),
  };
  for (const kind of must) {
    const dim = village && kind === 'temple' ? [5, 6, 5, 6] : DIM[kind] || [5, 8, 5, 6];
    const pref = PREF[kind];
    for (let tries = 0; tries < 6000; tries++) {
      const w = rng.int(dim[0], dim[1]), h = rng.int(dim[2], dim[3]);
      const a = rng.float(0, Math.PI * 2), rr = Math.sqrt(rng.next());
      const x = Math.round(cx + Math.cos(a) * rx * rr * 0.95 - w / 2), y = Math.round(cy + Math.sin(a) * ry * rr * 0.95 - h / 2);
      if (!inb(x, y) || !clear(x, y, w, h) || !nearRoad(x, y, w, h)) continue;
      // the wish of the district fades as the search goes on, so a crowded town still gets its building somewhere
      if (pref && !rng.chance(Math.max(pref(x + w / 2, y + h / 2), tries / 6000))) continue;
      place(kind, w, h, x, y);
      break;
    }
  }
  // about two fifths of the built-up ground is houses, each 3–6 tiles wide and 3–5 deep
  const want = buildings.length + Math.round((Math.PI * rx * ry * 0.5) / 18);
  const TERRACE: string[] = ['gable', 'stone', 'brick', 'spire', 'dome', 'forge', 'keep', 'aframe', 'terrace', 'tower', 'carved', 'boomtown', 'adobe'];
  const poor: BStyle = theme.styles.some(([s]) => s === 'tent') ? 'tent' : theme.styles.some(([s]) => s === 'hut') ? 'hut' : theme.id === 'nerea' ? 'stilt' : 'gable';
  // a house stands with its door to a street: the row below it is road or square
  const fronts = (x: number, y: number, w: number, h: number) => { for (let i = x; i < x + w; i++) for (let j = y + h; j <= y + h + 1; j++) { const t = get(i, j); if (t === Tile.Road || t === Tile.Plaza) return true; } return false; };
  for (let tries = 0; buildings.length < want && tries < 60000; tries++) {
    const a = rng.float(0, Math.PI * 2), rr = Math.sqrt(rng.next());
    const k = rr * 0.97; // the rich live in the middle, the poor out toward the wall
    const w = k < 0.4 ? rng.int(4, 6) : k > 0.75 ? rng.int(3, 4) : rng.int(3, 6), h = k < 0.4 ? rng.int(4, 5) : k > 0.75 ? rng.int(3, 4) : rng.int(3, 5);
    const x = Math.round(cx + Math.cos(a) * rx * k - w / 2), y = Math.round(cy + Math.sin(a) * ry * k - h / 2);
    let style = pickStyle(theme, rng);
    if (k > 0.75 && !village && rng.chance(0.55)) style = poor;
    if (!inb(x, y) || !clear(x, y, w, h, !village && TERRACE.includes(style) ? 0 : 1) || !nearRoad(x, y, w, h)) continue;
    if (!fronts(x, y, w, h) && !rng.chance(0.16)) continue;
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
  // the harbour: piers over the water (or landing stages over the sky). A great trading port has a stone quay along its whole shore, many long
  // broad piers with ships moored at their sides, cranes, and a light at the end of the longest mole.
  const ships: CityData['ships'] = [], cranes: Pt[] = [], beacons: Pt[] = [];
  if (edge || floating) {
    const shore: [number, number, number, number][] = [];
    for (let y = 1; y < CH - 1; y++) for (let x = 1; x < CW - 1; x++) {
      const t = get(x, y);
      if ((t !== Tile.Ground && t !== Tile.Road) || !inExt(x, y, 1.15)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (get(x + dx, y + dy) === Tile.Void) { shore.push([x, y, dx, dy]); break; }
    }
    if (port >= 1 && !sky) {
      // the quay: a paved band along the water's edge, the water side planked out two tiles
      for (const [x, y, dx, dy] of shore) {
        if (!inExt(x, y, 1.02)) continue;
        if (get(x, y) === Tile.Ground) { set(x, y, Tile.Road); roadCls[y * CW + x] = Math.max(roadCls[y * CW + x], 2); }
        for (let s = 1; s <= (port >= 2 ? 2 : 1); s++) if (get(x + dx * s, y + dy * s) === Tile.Void) set(x + dx * s, y + dy * s, Tile.Dock);
      }
    }
    const want = port >= 2 ? 12 : port === 1 ? 7 : 5, wide = port >= 2 ? 3 : 2;
    const piers: [number, number][] = [];
    let longest: { x: number; y: number } | null = null, longLen = 0;
    for (let k = 0; k < 400 && piers.length < want && shore.length; k++) {
      const [x, y, dx, dy] = rng.pick(shore);
      if (piers.some(([px, py]) => Math.hypot(px - x, py - y) < (port >= 2 ? 10 : 12))) continue;
      const len = port >= 2 ? rng.int(10, 20) : rng.int(6, 11);
      let ok = 0;
      for (let s = 1; s <= len; s++) for (let wd = 0; wd < wide; wd++) { const px = x + dx * s + (dy !== 0 ? wd : 0), py = y + dy * s + (dx !== 0 ? wd : 0); if (get(px, py) === Tile.Void) { set(px, py, Tile.Dock); ok = s; } else if (get(px, py) !== Tile.Dock) { s = len + 1; break; } }
      if (!ok) continue;
      piers.push([x, y]);
      if (ok > longLen) { longLen = ok; longest = { x: x + dx * ok, y: y + dy * ok }; }
      // ships lie alongside, on both sides of a long pier, each with its own look
      if (port >= 1 && ok >= 6 && !sky) {
        for (const side of [-1, 1]) {
          let s0 = 2;
          while (s0 + 5 < ok) {
            const l = rng.int(5, port >= 2 ? 9 : 7);
            const sx = dy !== 0 ? x + (side < 0 ? -2 : wide + 0) : x + dx * s0 - (dx > 0 ? 0 : l - 1), sy = dy !== 0 ? y + dy * s0 - (dy > 0 ? 0 : l - 1) : y + (side < 0 ? -2 : wide);
            const horizontal = dy === 0;
            let free = true;
            for (let i = 0; i < l && free; i++) for (let j = 0; j < 2 && free; j++) { const tx = horizontal ? sx + i : sx + j, ty = horizontal ? sy + j : sy + i; if (get(tx, ty) !== Tile.Void) free = false; }
            if (free && rng.chance(0.8)) { ships.push({ x: sx, y: sy, len: l, horizontal, kind: theme.id, seed: rng.int(1, 1e9) }); }
            s0 += l + 1;
          }
        }
      }
      if (port >= 2 && rng.chance(0.7)) cranes.push({ x: (x + dx) * T + T / 2, y: (y + dy) * T + T });
    }
    if (port >= 1 && longest && !sky) beacons.push({ x: longest.x * T + T / 2, y: longest.y * T + T });
  }
  // trees in what is left
  // (they stand in groves and leave clearings, not as a dust of single trees over every open tile)
  if (theme.tree !== 'none') {
    const grove = makeNoise(hashString('grove' + town.id));
    for (let i = 0; i < CW * CH; i++) {
      if (g[i] !== Tile.Ground || wet[i]) continue;
      const x = i % CW, y = Math.floor(i / CW);
      const out = inExt(x, y, 0.95) ? 0.45 : 2.2, n = grove(x * 0.085, y * 0.11);
      if (n > 0.52 && rng.chance(theme.treeDensity * out * 4.2 * (n - 0.45))) g[i] = Tile.Tree;
    }
  }
  if (floating) for (let i = 0; i < CW * CH; i++) if (wet[i] && g[i] === Tile.Ground) g[i] = Tile.Void; // what the town did not build on is open water again
  const walk: [number, number][] = [];
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const t = g[y * CW + x]; if ((t === Tile.Road || t === Tile.Plaza || t === Tile.Dock) && !solid.has(y * CW + x)) walk.push([x, y]); }
  const lamps: Pt[] = [];
  if (theme.lamps) for (let y = 0; y < CH; y += 1) for (let x = 0; x < CW; x += 1) if (g[y * CW + x] === Tile.Road && (x * 7 + y * 13) % 19 === 0 && g[y * CW + x - 1] !== Tile.Building && inExt(x, y, 1)) lamps.push({ x: x * T + T / 2, y: y * T + T - 2 });
  const spec = townSpecialty(town.id, country);
  const wealth = Math.max(0, Math.min(1, wealthOf(country.code, country.continent) + (town.capital ? 0.14 : town.size >= 3 ? 0.1 : town.size === 1 ? -0.1 : 0) + ((hashString('w' + town.id) % 100) / 100 - 0.5) * 0.16));
  const data: CityData = { townId: town.id, roadCls, wealth, wet, ships, cranes, beacons, port, theme, kind, grid: g, buildings, walk, lamps, stalls, plaza, extent: { rx, ry }, spec, plazaMode, landmark, centrepiece, furniture, solid: [...solid], gates, cv: document.createElement('canvas'), edge, fate: fateOf({ fate: country.fate, flags: country.flags ?? [] }) };
  paintCity(data, town);
  return data;
}

