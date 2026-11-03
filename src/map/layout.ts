// Where everything stands on the sheet (1600 × 900 map units, MU): the land, which country owns each cell, the seat and the towns of every country.
// Pure and deterministic: the same data always gives the same layout (the world's shape is fixed, so a place the docs name is always in the same spot).
// The docs give the shape of the continents (world-map.md, ported in geo.ts) and a few places by name (SEED_HINTS); the rest is spread out around
// them with a seeded stream, the way the first map code did it. Proposal for the docs: a coordinate for each country (see the report).
import type { GameData } from '../core/game';
import type { Continent, ContinentsFile, Country } from '../core/data/types-npcs';
import { CONT_IDS, DEFS, MAP_MH, MAP_MW, sampleLand, type ContId } from './geo';
import { Stream, clamp, makeNoise } from './noise';
import { CITY_H, CITY_W, GRID_CELL, LAYOUT_SEED, TOWN_SPACING } from './tuning';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapCountry {
  id: string;
  /** Position in `MapLayout.countries`; the value stored in `owner`. */
  n: number;
  continent: ContId;
  name: string;
  title: string;
  /** Seat of the capital (MU). */
  x: number;
  y: number;
  /** Box of the land the country owns (MU). */
  box: Rect;
  /** Area in MU². */
  area: number;
  /** One island is one country (Azgar, Nerea). */
  island: boolean;
}

export interface MapCity {
  /** `AL-05/0` — the country and the number of the town (0 is the capital). */
  id: string;
  country: string;
  n: number;
  x: number;
  y: number;
  capital: boolean;
  /** 1 village, 2 town, 3 capital. */
  size: 1 | 2 | 3;
  /** The capital is named like its country; the docs name no other town, so the rest have none. */
  name: string | null;
}

export interface LandGrid {
  cell: number;
  cols: number;
  rows: number;
  /** Land value in MU of inland distance (> 0 is land, < 0 is sea). */
  v: Float32Array;
  /** Index into DEFS of the landmass of each cell, or −1. */
  def: Int16Array;
}

export interface MapLayout {
  grid: LandGrid;
  /** Country index per cell, −1 at sea. */
  owner: Int16Array;
  countries: MapCountry[];
  cities: MapCity[];
  byId: Map<string, MapCountry>;
  continents: Record<ContId, { id: ContId; name: string; box: Rect; label: { x: number; y: number }; countries: string[] }>;
  /** Land value at a point (bilinear on the grid). */
  landV(x: number, y: number): number;
  countryAt(x: number, y: number): MapCountry | null;
  continentAt(x: number, y: number): ContId | null;
  /** The town nearest to a point within `r` MU. */
  cityNear(x: number, y: number, r: number): MapCity | null;
  citiesOf(country: string): MapCity[];
}

/** Where the docs put a country on its continent (MU); everything else is spread out around them. (world-map.md §1, continents' own files.) */
export const SEED_HINTS: Record<string, [number, number]> = {
  'AL-01': [722, 440], 'AL-20': [770, 318], 'AL-28': [960, 400], 'AL-04': [680, 590], 'AL-17': [800, 520], 'AL-02': [640, 480],
  'SV-01': [266, 312], 'SV-02': [350, 290], 'SV-03': [395, 330], 'SV-04': [150, 300], 'SV-05': [130, 250], 'SV-06': [330, 190], 'SV-07': [250, 165], 'SV-08': [225, 405], 'SV-09': [170, 385],
  'SV-10': [255, 225], 'SV-11': [300, 240], 'SV-12': [265, 335], 'SV-13': [225, 320], 'SV-14': [345, 235], 'SV-15': [310, 330],
  'MK-01': [1150, 250], 'MK-04': [1112, 300], 'MK-09': [1280, 200], 'MK-07': [1250, 170], 'MK-13': [1060, 255],
  'KD-10': [935, 755], 'KD-08': [780, 805], 'KD-01': [1000, 725],
  'NB-08': [705, 130], 'NB-01': [770, 120], 'NB-12': [780, 75], 'NB-09': [900, 150], 'NB-03': [620, 160],
  'SH-03': [1285, 500], 'SH-17': [1260, 560], 'SH-01': [1200, 650], 'SH-15': [1130, 500],
  'MH-10': [215, 640], 'MH-08': [335, 725], 'MH-11': [450, 800],
};

function buildGrid(): LandGrid {
  const cell = GRID_CELL;
  const cols = Math.ceil(MAP_MW / cell), rows = Math.ceil(MAP_MH / cell);
  const v = new Float32Array(cols * rows), def = new Int16Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const s = sampleLand((i + 0.5) * cell, (j + 0.5) * cell);
      v[j * cols + i] = s.v;
      def[j * cols + i] = s.v > 0 ? s.def : -1;
    }
  return { cell, cols, rows, v, def };
}

let gridCache: LandGrid | null = null;
/** The land grid of the world: the same for every game, made once per page. */
export function landGrid(): LandGrid {
  return (gridCache ??= buildGrid());
}

/** Bilinear land value at a point of the sheet. */
export function landValue(g: LandGrid, x: number, y: number): number {
  const fx = x / g.cell - 0.5, fy = y / g.cell - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy);
  const tx = fx - i, ty = fy - j;
  const at = (a: number, b: number) => g.v[clamp(b, 0, g.rows - 1) * g.cols + clamp(a, 0, g.cols - 1)];
  const top = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
  const bot = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
  return top * (1 - ty) + bot * ty;
}

const cache = new WeakMap<object, MapLayout>();

/** The layout of the world from the loaded data (`countries` and `continents`). Cached by the data file. */
export function layoutOf(data: GameData): MapLayout {
  const key = (data.countries ?? data) as object;
  let l = cache.get(key);
  if (!l) {
    l = buildLayout(
      ((data.countries?.items as Country[] | undefined) ?? []).slice(),
      (data.continents?.items as ContinentsFile | undefined)?.continents ?? [],
    );
    cache.set(key, l);
  }
  return l;
}

export function buildLayout(countriesIn: Country[], continentsIn: Continent[]): MapLayout {
  const grid = landGrid();
  const { cols, rows, cell } = grid;
  const cellDef = grid.def;
  const contOfCell = new Int8Array(cols * rows).fill(-1);
  for (let k = 0; k < cols * rows; k++) if (cellDef[k] >= 0) contOfCell[k] = DEFS[cellDef[k]].cont;
  const owner = new Int16Array(cols * rows).fill(-1);
  const rng = new Stream(LAYOUT_SEED);
  const noise = makeNoise(LAYOUT_SEED * 7 + 1);

  const countries: MapCountry[] = [];
  const seatOf = new Map<string, [number, number]>();
  const byContinent = (id: string) => countriesIn.filter((c) => c.continent === id).sort((a, b) => a.index - b.index);

  CONT_IDS.forEach((cid, ci) => {
    const list = byContinent(cid);
    if (!list.length) return;
    const cells: number[] = [];
    for (let k = 0; k < cols * rows; k++) if (contOfCell[k] === ci) cells.push(k);
    const archipelago = DEFS.some((d) => d.cont === ci && d.country !== undefined);
    const base = countries.length;
    const px = (k: number) => k % cols;
    const py = (k: number) => Math.floor(k / cols);
    const seeds: number[] = [];
    const slots: Country[] = [];

    if (archipelago) {
      // one island, one country, in the order of the docs
      list.forEach((c, k) => {
        const own = cells.filter((q) => DEFS[cellDef[q]].country === c.index - 1);
        slots.push(c);
        if (!own.length) { seeds.push(cells[0]); return; }
        let mx = 0, my = 0;
        for (const q of own) { mx += px(q); my += py(q); }
        mx /= own.length; my /= own.length;
        let best = own[0], bd = Infinity;
        for (const q of own) {
          const d = Math.hypot(px(q) - mx, py(q) - my) - landValue(grid, (px(q) + 0.5) * cell, (py(q) + 0.5) * cell) * 0.2;
          if (d < bd) { bd = d; best = q; }
        }
        seeds.push(best);
        void k;
      });
    } else {
      // places the docs name first, at the spot the docs give them
      for (const c of list) {
        const h = SEED_HINTS[c.id];
        if (!h || !cells.length) continue;
        const gx = h[0] / cell, gy = h[1] / cell;
        let best = -1, bd = Infinity;
        for (const q of cells) {
          const d = Math.hypot(px(q) - gx, py(q) - gy);
          if (d < bd) { bd = d; best = q; }
        }
        if (best >= 0 && seeds.every((s) => Math.hypot(px(s) - px(best), py(s) - py(best)) >= 3)) { seeds.push(best); slots.push(c); }
      }
      let minD = Math.sqrt(cells.length / list.length) * 0.8;
      let guard = 0;
      const free: number[] = [];
      while (seeds.length < list.length && guard < 20000) {
        guard++;
        if (guard % 2000 === 0) minD *= 0.8;
        const q = cells[Math.floor(rng.next() * cells.length)];
        if (seeds.every((s) => Math.hypot(px(s) - px(q), py(s) - py(q)) >= minD)) { seeds.push(q); free.push(seeds.length - 1); }
      }
      // the other countries take the free seeds so that each bloc of the docs sits side by side
      const placed = new Map<string, number[]>();
      slots.forEach((c, k) => { if (c.bloc) placed.set(c.bloc, [...(placed.get(c.bloc) ?? []), k]); });
      const rest = list.filter((c) => !slots.includes(c));
      const blocSize = (c: Country) => (c.bloc ? list.filter((o) => o.bloc === c.bloc).length : 0);
      rest.sort((a, b) => blocSize(b) - blocSize(a) || (a.bloc < b.bloc ? -1 : a.bloc > b.bloc ? 1 : 0));
      const loose = rng.shuffle(rest.filter((c) => !c.bloc));
      const open = new Set(free);
      slots.length = seeds.length;
      for (const c of [...rest.filter((c) => c.bloc), ...loose]) {
        if (!open.size) break;
        const mates = c.bloc ? placed.get(c.bloc) : undefined;
        let pick = -1;
        if (mates?.length) {
          const cx = mates.reduce((a, k) => a + px(seeds[k]), 0) / mates.length, cy = mates.reduce((a, k) => a + py(seeds[k]), 0) / mates.length;
          let bd = Infinity;
          for (const k of open) {
            const d = Math.hypot(px(seeds[k]) - cx, py(seeds[k]) - cy);
            if (d < bd) { bd = d; pick = k; }
          }
        } else pick = [...open][Math.floor(rng.next() * open.size)];
        open.delete(pick);
        slots[pick] = c;
        if (c.bloc) placed.set(c.bloc, [...(placed.get(c.bloc) ?? []), pick]);
      }
    }

    // Voronoi on warped distance: each country is stretched along an axis of its own and weighted by the size of its government
    const r0 = Math.sqrt(cells.length / Math.max(1, seeds.length));
    const shape = seeds.map((_, k) => {
      const gov = slots[k]?.gov ?? '';
      const big = /จักรวรรดิ|มหา|อาณาจักร/.test(gov) ? 0.16 : /นครรัฐ|นคร|เมืองอิสระ/.test(gov) ? -0.08 : 0;
      return { ang: rng.float(0, Math.PI), stretch: rng.float(1, 1.75), w: (big + rng.float(-0.09, 0.09)) * r0 };
    });
    for (const q of cells) {
      if (archipelago) {
        const idx = slots.findIndex((c) => c.index - 1 === DEFS[cellDef[q]].country);
        owner[q] = base + Math.max(0, idx);
        continue;
      }
      const tx = px(q), ty = py(q);
      const wx = (noise(tx / 12 + 100, ty / 12) - 0.5) * 8 + (noise(tx / 34 + 300, ty / 34) - 0.5) * 12;
      const wy = (noise(tx / 12, ty / 12 + 100) - 0.5) * 8 + (noise(tx / 34, ty / 34 + 300) - 0.5) * 12;
      let best = Infinity, bi = 0;
      for (let k = 0; k < seeds.length; k++) {
        const ddx = px(seeds[k]) - tx - wx, ddy = py(seeds[k]) - ty - wy;
        const sh = shape[k];
        const u = ddx * Math.cos(sh.ang) + ddy * Math.sin(sh.ang), v = (ddy * Math.cos(sh.ang) - ddx * Math.sin(sh.ang)) * sh.stretch;
        const d = Math.hypot(u, v) - sh.w;
        if (d < best) { best = d; bi = k; }
      }
      owner[q] = base + bi;
    }
    if (!archipelago) {
      seeds.forEach((s, k) => { owner[s] = base + k; });
      mergeFragments(owner, contOfCell, ci, cells, cols, rows);
    }
    slots.forEach((c, k) => {
      if (!c) return;
      const s = seeds[k];
      seatOf.set(c.id, [(px(s) + 0.5) * cell, (py(s) + 0.5) * cell]);
      countries.push({ id: c.id, n: base + k, continent: cid, name: c.name, title: c.title, x: 0, y: 0, box: { x: 0, y: 0, w: 0, h: 0 }, area: 0, island: archipelago });
    });
    // countries the seeds could not cover (more countries than free seeds) stay out of the layout: reported by the test
  });

  // fix numbering: countries is in the order it was pushed; `owner` holds base + slot, which equals the index only when no slot was skipped
  const indexOfN = new Map<number, number>();
  countries.forEach((c, i) => indexOfN.set(c.n, i));
  for (let k = 0; k < owner.length; k++) if (owner[k] >= 0) owner[k] = indexOfN.get(owner[k]) ?? -1;
  countries.forEach((c, i) => (c.n = i));

  // box, area and a seat on the country's own land, clear of the shore
  const sums = countries.map(() => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, n: 0, sx: 0, sy: 0 }));
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const o = owner[j * cols + i];
      if (o < 0) continue;
      const s = sums[o];
      s.x0 = Math.min(s.x0, i * cell); s.y0 = Math.min(s.y0, j * cell);
      s.x1 = Math.max(s.x1, (i + 1) * cell); s.y1 = Math.max(s.y1, (j + 1) * cell);
      s.n++; s.sx += i; s.sy += j;
    }
  const ownerAtCell = (i: number, j: number) => (i < 0 || j < 0 || i >= cols || j >= rows ? -1 : owner[j * cols + i]);
  countries.forEach((c, i) => {
    const s = sums[i];
    if (!s.n) { c.box = { x: 0, y: 0, w: 1, h: 1 }; return; }
    c.box = { x: s.x0, y: s.y0, w: s.x1 - s.x0, h: s.y1 - s.y0 };
    c.area = s.n * cell * cell;
    // the seat: the hint/seed when it is inland, else the owned cell nearest the centroid that is clear of the sea
    const [sx0, sy0] = seatOf.get(c.id) ?? [0, 0];
    const inland = (a: number, b: number) => landValue(grid, (a + 0.5) * cell, (b + 0.5) * cell) > 6 && ownerAtCell(a, b) === i;
    let sx = Math.floor(sx0 / cell), sy = Math.floor(sy0 / cell);
    if (!inland(sx, sy)) {
      const cx = s.sx / s.n, cy = s.sy / s.n;
      let bd = Infinity;
      for (let j = 0; j < rows; j++)
        for (let ii = 0; ii < cols; ii++) {
          if (!inland(ii, j)) continue;
          const d = Math.hypot(ii - cx, j - cy);
          if (d < bd) { bd = d; sx = ii; sy = j; }
        }
      if (bd === Infinity) { sx = Math.floor(sx0 / cell); sy = Math.floor(sy0 / cell); }
    }
    c.x = (sx + 0.5) * cell;
    c.y = (sy + 0.5) * cell;
  });

  // towns: the capital at the seat, the rest spread over the country's own land with a gap that keeps the plans apart
  const cities: MapCity[] = [];
  const cityRng = new Stream(LAYOUT_SEED + 17);
  for (const c of countries) {
    const nWanted = c.island ? (c.area > 1800 ? 3 : c.area > 800 ? 2 : 1) : clamp(Math.round(c.area / 450), 2, 12);
    const pts: { x: number; y: number }[] = [{ x: c.x, y: c.y }];
    const mine: number[] = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (owner[j * cols + i] === c.n && landValue(grid, (i + 0.5) * cell, (j + 0.5) * cell) > 8) mine.push(j * cols + i);
    for (let tries = 0; pts.length < nWanted && tries < 1500 && mine.length; tries++) {
      const q = mine[Math.floor(cityRng.next() * mine.length)];
      const x = (q % cols + 0.5) * cell + cityRng.float(-1, 1), y = (Math.floor(q / cols) + 0.5) * cell + cityRng.float(-1, 1);
      if (!apart(pts, x, y, tries > 700 ? 0.8 : 1)) continue;
      if (!apart(cities, x, y, 0.8)) continue;
      pts.push({ x, y });
    }
    pts.forEach((p, n) => {
      cities.push({ id: `${c.id}/${n}`, country: c.id, n, x: p.x, y: p.y, capital: n === 0, size: n === 0 ? 3 : n % 3 === 1 ? 2 : 1, name: n === 0 ? c.name : null });
    });
  }

  const byId = new Map(countries.map((c) => [c.id, c]));
  const contInfo = {} as MapLayout['continents'];
  CONT_IDS.forEach((cid, ci) => {
    const meta = continentsIn.find((c) => c.id === cid);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (contOfCell[j * cols + i] === ci) { x0 = Math.min(x0, i * cell); y0 = Math.min(y0, j * cell); x1 = Math.max(x1, (i + 1) * cell); y1 = Math.max(y1, (j + 1) * cell); }
    const box = isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 1, h: 1 };
    contInfo[cid] = { id: cid, name: meta?.name ?? cid, box, label: CONT_LABELS_MU[ci], countries: countries.filter((c) => c.continent === cid).map((c) => c.id) };
  });

  const ownerCell = (x: number, y: number) => {
    const i = Math.floor(x / cell), j = Math.floor(y / cell);
    return i < 0 || j < 0 || i >= cols || j >= rows ? -1 : j * cols + i;
  };
  const layout: MapLayout = {
    grid, owner, countries, cities, byId, continents: contInfo,
    landV: (x, y) => landValue(grid, x, y),
    countryAt(x, y) {
      let k = ownerCell(x, y);
      if (k < 0) return null;
      if (owner[k] < 0) {
        // a click just off the shore: take the nearest owned cell within two cells
        let bd = Infinity, bk = -1;
        const i0 = k % cols, j0 = Math.floor(k / cols);
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
          const a = i0 + di, b = j0 + dj;
          if (a < 0 || b < 0 || a >= cols || b >= rows || owner[b * cols + a] < 0) continue;
          const d = di * di + dj * dj;
          if (d < bd) { bd = d; bk = b * cols + a; }
        }
        if (bk < 0) return null;
        k = bk;
      }
      return countries[owner[k]] ?? null;
    },
    continentAt(x, y) {
      const c = layout.countryAt(x, y);
      return c ? c.continent : null;
    },
    cityNear(x, y, r) {
      let best: MapCity | null = null, bd = r;
      for (const c of cities) {
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    },
    citiesOf: (id) => cities.filter((c) => c.country === id),
  };
  return layout;
}

/** True when a point is far enough from all the points (the plan of a town is CITY_W × CITY_H, an ellipse of that size keeps the plans apart). */
function apart(pts: { x: number; y: number }[], x: number, y: number, f: number): boolean {
  for (const p of pts) {
    const dx = (p.x - x) / (CITY_W * TOWN_SPACING * f), dy = (p.y - y) / (CITY_H * TOWN_SPACING * f);
    if (dx * dx + dy * dy < 1) return false;
  }
  return true;
}

/** A country is one piece: stray fragments of the warp go to the neighbour they touch most. */
function mergeFragments(owner: Int16Array, contOfCell: Int8Array, ci: number, cells: number[], cols: number, rows: number): void {
  const seen = new Uint8Array(cols * rows);
  const comps: { id: number; cells: number[] }[] = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const q0 of cells) {
    if (seen[q0]) continue;
    const id = owner[q0];
    const list = [q0];
    seen[q0] = 1;
    for (let i = 0; i < list.length; i++) {
      const c = list[i], cx = c % cols, cy = Math.floor(c / cols);
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const n = ny * cols + nx;
        if (!seen[n] && owner[n] === id && contOfCell[n] === ci) { seen[n] = 1; list.push(n); }
      }
    }
    comps.push({ id, cells: list });
  }
  const biggest = new Map<number, number>();
  for (const c of comps) if (c.cells.length > (biggest.get(c.id) ?? 0)) biggest.set(c.id, c.cells.length);
  for (const c of comps) {
    if (c.cells.length === biggest.get(c.id)) continue;
    const votes = new Map<number, number>();
    for (const cell of c.cells)
      for (const [dx, dy] of dirs) {
        const nx = (cell % cols) + dx, ny = Math.floor(cell / cols) + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const o = owner[ny * cols + nx];
        if (o >= 0 && o !== c.id && contOfCell[ny * cols + nx] === ci) votes.set(o, (votes.get(o) ?? 0) + 1);
      }
    let win = -1, wv = 0;
    for (const [o, v] of votes) if (v > wv) { wv = v; win = o; }
    if (win >= 0) for (const cell of c.cells) owner[cell] = win;
  }
}

/** Where each continent's name is written (MU), in `CONT_IDS` order. (world-map.md; ported with the shapes.) */
export const CONT_LABELS_MU: { x: number; y: number }[] = [
  { x: 1470, y: 205 }, { x: 230, y: 660 }, { x: 930, y: 750 }, { x: 600, y: 715 }, { x: 725, y: 445 },
  { x: 1150, y: 255 }, { x: 1215, y: 590 }, { x: 250, y: 265 }, { x: 730, y: 105 },
];

