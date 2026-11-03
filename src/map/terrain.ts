// The code-drawn ground of the map (world-map.md §2, ported from legacy/render/terrain): sea by depth, coast, land by continent and zone, borders,
// then the icons (trees, peaks, dunes, fields) and the great landmarks. One function paints one tile at the pixel size of its zoom level; it is
// deterministic (the noise and every scatter come from seeded streams), so a tile is the same on every run.
import { CONT_IDS, DEFS, type ContId, type Zone } from './geo';
import { css, mixRGB, rgb, type RGB } from './color';
import { drawGlyph, drawLandmark, type GlyphKind } from './glyphs';
import { landValue, type MapLayout } from './layout';
import { Stream, clamp, hashString, makeNoise, smooth } from './noise';
import type { PaintCanvas, TileRequest } from './provider';
import { FATE_BY_ID, GROUND, SEA, ZONE_COLOR, type FateId } from './tuning';

const nTex = makeNoise(7001), nDetail = makeNoise(7002), nShade = makeNoise(7003), nWave = makeNoise(7004), nFate = makeNoise(7005);
const FLOOD_RISE = 4.5; // MU of inland distance the great flood covers

interface ZoneRef { z: Zone; cont: number; box: [number, number, number, number]; col: RGB }
const ZONES: ZoneRef[] = [];
for (const d of DEFS)
  for (const z of d.zones ?? []) {
    const r = Math.max(z.rx, z.ry) * 1.25;
    ZONES.push({ z, cont: d.cont, box: [z.x - r, z.y - r, z.x + r, z.y + r], col: rgb(ZONE_COLOR[z.kind] ?? '#888888') });
  }

const SAND = rgb('#e2d3a0'), INK = rgb('#2c2418'), FOAM = rgb(SEA.foam);
const SEA_SH = rgb(SEA.shallow), SEA_MID = rgb(SEA.mid), SEA_DEEP = rgb(SEA.deep);
const CLIFF = rgb('#6a5a48');

/** Strength (0..1) of a zone at a point: 1 at the centre, 0 at the rim of its ellipse. */
function zoneWeight(zr: ZoneRef, x: number, y: number): number {
  const { z } = zr;
  let dx = x - z.x, dy = y - z.y;
  if (z.rot) { const c = Math.cos(z.rot), s = Math.sin(z.rot); const t = dx * c + dy * s; dy = -dx * s + dy * c; dx = t; }
  const d = Math.sqrt((dx * dx) / (z.rx * z.rx) + (dy * dy) / (z.ry * z.ry));
  return 1 - smooth(0.55, 1.05, d);
}

/** The continent whose land is at (or just beside) a point, or −1. */
function contAt(layout: MapLayout, x: number, y: number): number {
  const g = layout.grid;
  const i = Math.floor(x / g.cell), j = Math.floor(y / g.cell);
  for (let r = 0; r <= 2; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (r && Math.abs(di) < r && Math.abs(dj) < r) continue;
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= g.cols || b >= g.rows) continue;
        const d = g.def[b * g.cols + a];
        if (d >= 0) return DEFS[d].cont;
      }
  return -1;
}

/** Country under a point, smoothed: the country that carries most of the bilinear weight of the four cells round the point. */
export function ownerSmooth(layout: MapLayout, x: number, y: number): number {
  const g = layout.grid;
  const fx = x / g.cell - 0.5, fy = y / g.cell - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy);
  const tx = fx - i, ty = fy - j;
  let a = -1, wa = 0, b = -1, wb = 0;
  for (let k = 0; k < 4; k++) {
    const ci = clamp(i + (k & 1), 0, g.cols - 1), cj = clamp(j + (k >> 1), 0, g.rows - 1);
    const o = layout.owner[cj * g.cols + ci];
    const w = (k & 1 ? tx : 1 - tx) * (k >> 1 ? ty : 1 - ty);
    if (o === a) wa += w;
    else if (o === b) wb += w;
    else if (wa <= wb && (a < 0 || wa < w)) { a = o; wa = w; }
    else if (b < 0 || wb < w) { b = o; wb = w; }
  }
  return wa >= wb ? a : b;
}

export interface PaintOpts {
  /** Draw the icons (trees, peaks…). Off for the mini-map. */
  icons?: boolean;
}

export function paintTerrain(canvas: PaintCanvas, req: TileRequest, layout: MapLayout, opts: PaintOpts = {}): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const sx = W / req.rect.w; // px per MU
  const { x: rx0, y: ry0 } = req.rect;
  const g = layout.grid;
  const img = ctx.createImageData(W, H);
  const out = img.data;
  const fates = req.looks.fates;
  const flood = req.looks.flood;
  const fine = sx >= 1.5;
  const borders = req.level === 'continent' || req.level === 'country';
  const bw = 0.8 / sx; // border half width in MU
  const aj = layout.continents.AZ.box;
  const seedK = req.seed;

  // colour tables per continent: ground under the look
  const groundOf = CONT_IDS.map((id) => {
    const f = fates[id] ? FATE_BY_ID[fates[id]!] : undefined;
    const base = rgb(GROUND[id]);
    return f ? mixRGB(base, rgb(f.ground), f.tint) : base;
  });
  const countryTint = layout.countries.map((c) => {
    const h = hashString(c.id) % 1000 / 1000;
    return 0.92 + h * 0.16;
  });

  for (let j = 0; j < H; j++) {
    const y = ry0 + (j + 0.5) / sx;
    for (let i = 0; i < W; i++) {
      const x = rx0 + (i + 0.5) / sx;
      let v = landValue(g, x, y);
      if (fine) v += (nDetail(x / 4.5, y / 4.5, 3) - 0.5) * (v > -3 && v < 3 ? 2.2 : 0);
      let r: number, gg: number, b: number;
      const p = (j * W + i) * 4;
      if (v > 0) {
        const ci = contAt(layout, x, y);
        const cid = (ci >= 0 ? CONT_IDS[ci] : 'AL') as ContId;
        const fate = fates[cid] ? FATE_BY_ID[fates[cid]!] : undefined;
        let col: RGB = groundOf[ci < 0 ? 4 : ci];
        // zones (later ones paint over earlier ones)
        for (const zr of ZONES) {
          if (zr.cont !== ci || x < zr.box[0] || x > zr.box[2] || y < zr.box[1] || y > zr.box[3]) continue;
          const w = zoneWeight(zr, x, y);
          if (w <= 0.01) continue;
          let zc = zr.col;
          if (fate) zc = mixRGB(zc, rgb(fate.ground), Math.min(1, fate.tint + (zr.z.kind === 'lava' ? 0.2 : 0)));
          col = mixRGB(col, zc, w * 0.78);
        }
        const tex = nTex(x / 7, y / 7, 3) - 0.5;
        const slope = (nShade((x + 1.3) / 10, (y + 1.3) / 10, 2) - nShade((x - 1.3) / 10, (y - 1.3) / 10, 2)) * 5;
        let k = 1 + tex * 0.2 + slope * 0.16 + Math.min(v, 70) / 700;
        const o = fine || borders ? layout.owner[Math.floor(y / g.cell) * g.cols + Math.floor(x / g.cell)] : -1;
        if (borders && o >= 0) k *= countryTint[o];
        col = [col[0] * k, col[1] * k, col[2] * k];
        // the look of a changed continent
        if (fate) {
          const n2 = nFate(x / 3, y / 3, 2) - 0.5;
          if (fate.id === 'rust') col = mixRGB(col, rgb(n2 > 0.1 ? '#8a3a1e' : '#5a4a3a'), 0.25 + Math.abs(n2));
          else if (fate.id === 'fog') col = mixRGB(col, rgb('#e8e8f0'), 0.12 + (nFate(x / 14, y / 14, 3) - 0.3) * 0.5);
          else if (fate.id === 'light') col = mixRGB(col, rgb('#fff2c0'), 0.18 + n2 * 0.3);
          else if (fate.id === 'ash') col = mixRGB(col, rgb(n2 > 0.12 ? '#c8d0d8' : '#4a4a4e'), 0.2);
          else if (fate.id === 'skyfall') col = mixRGB(col, rgb(n2 > 0.1 ? '#c8b890' : '#4a4a52'), 0.25);
          else if (fate.id === 'withered') col = mixRGB(col, rgb('#a8a07a'), 0.15 + Math.max(0, n2));
          else if (fate.id === 'split') {
            // a dark chasm from north to south across the middle of Aldria; the two sides take different colours
            const cx = 775 + Math.sin(y / 38) * 9 + (nFate(x / 20, y / 20, 2) - 0.5) * 14;
            const west = x < cx;
            col = mixRGB(col, rgb(west ? fate.after[0] : '#8a7a4a'), 0.35);
            const dx = Math.abs(x - cx);
            const half = 3.2 + (nFate(0.3, y / 16, 2) - 0.5) * 3;
            if (dx < half) col = mixRGB(col, rgb('#0c0a0a'), 1 - smooth(half * 0.4, half, dx));
          }
        }
        // the great flood: land near the sea is drowned
        if (flood && cid !== 'AZ' && v < FLOOD_RISE + n2f(x, y)) {
          col = mixRGB(col, rgb('#4f7f78'), 0.8 - smooth(0, FLOOD_RISE, v) * 0.5);
        } else if (cid !== 'AZ' && v < 1.4 && !fate) {
          col = mixRGB(col, SAND, 0.55 * (1 - v / 1.4));
        }
        // ink along the coast
        const inkA = 1 - smooth(bw * 0.4, bw * 1.8 + 0.18, v);
        if (inkA > 0) col = mixRGB(col, INK, inkA * 0.75);
        // borders between the countries of one continent
        if (borders && o >= 0 && v > 0.8) {
          const d = bw * 1.1;
          const a = ownerSmooth(layout, x + d, y + d), b2 = ownerSmooth(layout, x - d, y - d);
          const c2 = ownerSmooth(layout, x + d, y - d), d2 = ownerSmooth(layout, x - d, y + d);
          if ((a !== b2 && a >= 0 && b2 >= 0) || (c2 !== d2 && c2 >= 0 && d2 >= 0)) col = mixRGB(col, rgb('#3a2a1a'), 0.42);
        }
        r = col[0]; gg = col[1]; b = col[2];
      } else {
        // sea
        const depth = clamp(-v / 46, 0, 1);
        let col = depth < 0.35 ? mixRGB(SEA_SH, SEA_MID, depth / 0.35) : mixRGB(SEA_MID, SEA_DEEP, (depth - 0.35) / 0.65);
        const wave = nWave(x / 2.4, y / 2.4, 2) - 0.5;
        col = [col[0] * (1 + wave * 0.12), col[1] * (1 + wave * 0.12), col[2] * (1 + wave * 0.1)];
        if (v > -2.2) col = mixRGB(col, FOAM, smooth(-2.2, 0, v) * 0.5);
        const inkA = 1 - smooth(bw * 0.4, bw * 1.8 + 0.18, -v);
        if (inkA > 0) col = mixRGB(col, INK, inkA * 0.75);
        // the shadow and the underside of the sky islands (Azgar hangs over the sea)
        if (x > aj.x - 40 && x < aj.x + aj.w + 40 && y > aj.y - 40 && y < aj.y + aj.h + 60 && v < 0.5) {
          if (contAtFast(layout, x - 5, y - 9)) col = mixRGB(col, rgb('#0c1a2c'), 0.38);
          let under = 0;
          for (let d = 1.6; d <= 6; d += 1.6) if (landValue(g, x, y - d) > 0 && isAzgar(layout, x, y - d)) { under = d; break; }
          if (under) col = mixRGB(col, CLIFF, 0.9 - under * 0.07);
        }
        r = col[0]; gg = col[1]; b = col[2];
      }
      out[p] = r; out[p + 1] = gg; out[p + 2] = b; out[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // ---- vector layer: clouds, icons, landmarks ----
  const rng = new Stream(hashString(`${req.level}:${req.key}`) ^ seedK);
  const toPx = (x: number, y: number): [number, number] => [(x - rx0) * sx, (y - ry0) * sx];
  if (opts.icons !== false && req.level !== 'world') scatterIcons(ctx, req, layout, rng, sx);
  if (req.level !== 'world') drawLandmarks(ctx, req, layout, sx, toPx);
  drawClouds(ctx, req, layout, rng, sx, toPx);
}

function n2f(x: number, y: number): number {
  return (nFate(x / 5, y / 5, 2) - 0.5) * 3;
}

const azCache = new WeakMap<object, (x: number, y: number) => boolean>();
function isAzgar(layout: MapLayout, x: number, y: number): boolean {
  let f = azCache.get(layout);
  if (!f) {
    f = (a, b) => {
      const g = layout.grid;
      const k = Math.floor(b / g.cell) * g.cols + Math.floor(a / g.cell);
      const d = g.def[k];
      return d >= 0 && DEFS[d].cont === 0;
    };
    azCache.set(layout, f);
  }
  return f(x, y);
}
const contAtFast = (layout: MapLayout, x: number, y: number) => landValue(layout.grid, x, y) > 0 && isAzgar(layout, x, y);

// ---- icons ----

/** Which icon each zone scatters, how thick, and the size in px at one pixel per MU. */
const ZONE_ICON: Record<string, { glyph: GlyphKind; density: number; size: number } | undefined> = {
  forest: { glyph: 'tree', density: 1, size: 3.2 },
  tree: { glyph: 'tree', density: 1.2, size: 3.6 },
  swamp: { glyph: 'reed', density: 0.8, size: 2.6 },
  mountain: { glyph: 'peak', density: 0.9, size: 4.6 },
  highland: { glyph: 'hill', density: 0.8, size: 4 },
  dune: { glyph: 'dune', density: 0.8, size: 4 },
  sand: { glyph: 'dune', density: 0.4, size: 3.4 },
  badland: { glyph: 'mesa', density: 0.6, size: 3.4 },
  farm: { glyph: 'field', density: 0.9, size: 4.2 },
  grass: { glyph: 'tuft', density: 0.5, size: 2.4 },
  crater: { glyph: 'volcano', density: 0.4, size: 5.4 },
  lava: { glyph: 'crack', density: 0.7, size: 3.4 },
  glass: { glyph: 'crystal', density: 0.7, size: 3 },
  ruin: { glyph: 'ruin', density: 0.7, size: 3.2 },
  oasis: { glyph: 'palm', density: 1.5, size: 3.4 },
  pit: { glyph: 'crack', density: 0.5, size: 3 },
  ash: { glyph: 'tuft', density: 0.3, size: 2.2 },
  fog: undefined,
  city: undefined,
};
/** Icon of the open ground of each continent (outside every zone). */
const OPEN_ICON: Record<ContId, { glyph: GlyphKind; density: number }> = {
  AZ: { glyph: 'tuft', density: 0.25 }, MH: { glyph: 'deadtree', density: 0.35 }, KD: { glyph: 'crack', density: 0.3 }, NR: { glyph: 'palm', density: 0.3 },
  AL: { glyph: 'oak', density: 0.25 }, MK: { glyph: 'chimney', density: 0.25 }, SH: { glyph: 'dune', density: 0.35 }, SV: { glyph: 'tree', density: 0.9 }, NB: { glyph: 'deadtree', density: 0.2 },
};

function scatterIcons(ctx: CanvasRenderingContext2D, req: TileRequest, layout: MapLayout, rng: Stream, sx: number): void {
  const g = layout.grid;
  const { x: rx0, y: ry0, w, h } = req.rect;
  // spacing between icon sites in MU: about 14 px apart on the screen of the tile
  const sp = clamp(14 / sx, 0.9, 12);
  const sizeK = clamp(sx / 2.2, 0.85, 2.4) * (req.level === 'continent' ? 1 : 1);
  const sites: { x: number; y: number; z: number; glyph: GlyphKind; size: number; cid: ContId; col: string }[] = [];
  for (let y = ry0 + sp / 2; y < ry0 + h; y += sp)
    for (let x = rx0 + sp / 2; x < rx0 + w; x += sp) {
      const px = x + rng.float(-0.45, 0.45) * sp, py = y + rng.float(-0.45, 0.45) * sp;
      const keep = rng.next(); // drawn even when skipped so the stream does not shift
      if (landValue(g, px, py) < 3.2) continue;
      const ci = contAt(layout, px, py);
      if (ci < 0) continue;
      const cid = CONT_IDS[ci];
      // strongest zone here
      let bz: ZoneRef | null = null, bw = 0.3;
      for (const zr of ZONES) {
        if (zr.cont !== ci || px < zr.box[0] || px > zr.box[2] || py < zr.box[1] || py > zr.box[3]) continue;
        const wz = zoneWeight(zr, px, py);
        if (wz >= bw) { bw = wz; bz = zr; }
      }
      let glyph: GlyphKind, size: number, dens: number;
      if (bz && ZONE_ICON[bz.z.kind]) {
        const zi = ZONE_ICON[bz.z.kind]!;
        glyph = zi.glyph; size = zi.size * (bz.z.s ?? 1); dens = zi.density * bw;
      } else if (bz) continue;
      else { glyph = OPEN_ICON[cid].glyph; size = 3; dens = OPEN_ICON[cid].density; }
      if (keep > dens) continue;
      const fate = req.looks.fates[cid];
      sites.push({ x: px, y: py, z: bz ? bw : 0, glyph, size, cid, col: fate ?? '' });
    }
  sites.sort((a, b) => a.y - b.y);
  for (const s of sites) {
    const fate = s.col ? FATE_BY_ID[s.col as FateId] : undefined;
    drawGlyph(ctx, s.glyph, (s.x - rx0) * sx, (s.y - ry0) * sx, s.size * sizeK, { cid: s.cid, fate: fate?.id, seed: Math.floor(s.x * 31 + s.y * 17) });
  }
}

function drawLandmarks(ctx: CanvasRenderingContext2D, req: TileRequest, layout: MapLayout, sx: number, toPx: (x: number, y: number) => [number, number]): void {
  const { x, y, w, h } = req.rect;
  const at = (id: string) => layout.byId.get(id);
  const inside = (px: number, py: number) => px > x - 30 && px < x + w + 30 && py > y - 30 && py < y + h + 30;
  const k = clamp(sx / 2.2, 0.8, 3);
  const sv = at('SV-01'), mk = at('MK-04'), kd8 = at('KD-08'), nb = at('NB-08'), kd10 = at('KD-10'), az6 = at('AZ-06'), nr2 = at('NR-02');
  const put = (c: typeof sv, kind: Parameters<typeof drawLandmark>[1]) => {
    if (!c || !inside(c.x, c.y)) return;
    const [px, py] = toPx(c.x, c.y);
    drawLandmark(ctx, kind, px, py, k, req.looks.fates[c.continent]);
  };
  put(sv, 'worldtree'); put(mk, 'arkea'); put(kd8, 'abyss'); put(nb, 'whirlpool'); put(kd10, 'volcano');
  if (az6 && nr2 && (inside(az6.x, az6.y) || inside(nr2.x, nr2.y))) {
    const [ax, ay] = toPx(az6.x, az6.y + 6), [bx, by] = toPx(nr2.x, nr2.y - 4);
    ctx.save();
    ctx.strokeStyle = 'rgba(190,225,245,0.85)';
    ctx.lineWidth = Math.max(1, 1.4 * k);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.restore();
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, req: TileRequest, layout: MapLayout, rng: Stream, sx: number, toPx: (x: number, y: number) => [number, number]): void {
  const aj = layout.continents.AZ.box;
  const { x, y, w, h } = req.rect;
  const n = req.level === 'world' ? 16 : 10;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const cx = aj.x - 20 + rng.next() * (aj.w + 40), cy = aj.y - 20 + rng.next() * (aj.h + 40);
    const rr = 10 + rng.next() * 16;
    const fate = req.looks.fates.AZ;
    if (cx < x - rr || cx > x + w + rr || cy < y - rr || cy > y + h + rr) continue;
    const [px, py] = toPx(cx, cy);
    ctx.fillStyle = fate ? 'rgba(150,140,120,0.16)' : 'rgba(255,255,255,0.20)';
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(px + (k - 1.5) * rr * 0.4 * sx, py + (k % 2) * rr * 0.12 * sx, rr * 0.5 * sx, rr * 0.26 * sx, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A soft white-on-clear mask of one country on a canvas of `pxPerMu`, covering `rect` (for tinting the country as a ruin or a fallen land). */
export function paintCountryMask(canvas: PaintCanvas, rect: { x: number; y: number; w: number; h: number }, layout: MapLayout, countryN: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const s = W / rect.w;
  const img = ctx.createImageData(W, H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const x = rect.x + (i + 0.5) / s, y = rect.y + (j + 0.5) / s;
      const p = (j * W + i) * 4;
      if (ownerSmooth(layout, x, y) === countryN && landValue(layout.grid, x, y) > 0) {
        img.data[p] = 255; img.data[p + 1] = 255; img.data[p + 2] = 255; img.data[p + 3] = 255;
      }
    }
  ctx.putImageData(img, 0, 0);
}

export const fateCss = (id: FateId, i: number): string => css(rgb(FATE_BY_ID[id].after[i]));
