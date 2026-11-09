// The pixel pictures of the map levels that are prebuilt (world, continent, country; 21-pixel-art.md §4, code-plan §8.4): small sprites stamped into
// the raw pixel buffer of a tile at whole pixels (no smoothing), each with a one-pixel outline like the sprites of the towns, and the ordered dither that
// turns a smooth value into a few tones. Pure: no canvas, no DOM; the same call gives the same pixels.
import { parse, mixHex, shadeHex, type Rgb } from './color';

export interface Buf {
  data: Uint8ClampedArray;
  w: number;
  h: number;
}

/** 4 × 4 ordered-dither matrix, thresholds in (0,1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number): number => BAYER[((y & 3) << 2) | (x & 3)];

/** `v` (0..1) cut into `levels` tones; the dither of the pixel (x, y) decides which of the two nearest tones it takes. Returns 0..1. */
export function toneOf(v: number, levels: number, x: number, y: number): number {
  const t = Math.min(1, Math.max(0, v)) * levels;
  const f = Math.floor(t);
  return Math.min(levels, f + (t - f > bayer(x, y) ? 1 : 0)) / levels;
}

// ---------- sprites ----------

export interface FateTint {
  color: string;
  mix: number;
}

const pack = (hex: string): number => {
  const c = parse(hex);
  return 0xff000000 | (c[0] << 16) | (c[1] << 8) | c[2];
};

/** A small grid of colours (0 = clear). */
export class Sprite {
  readonly cells: Uint32Array;
  constructor(readonly w: number, readonly h: number) {
    this.cells = new Uint32Array(w * h);
  }
  px(x: number, y: number, hex: string): void {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.cells[y * this.w + x] = pack(hex);
  }
  rect(x: number, y: number, w: number, h: number, hex: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, hex);
  }
  /** A filled ellipse (centre, radii) in whole pixels. */
  disk(cx: number, cy: number, rx: number, ry: number, hex: string): void {
    for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++)
      for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
        const dx = (i - cx) / (rx + 0.4), dy = (j - cy) / (ry + 0.4);
        if (dx * dx + dy * dy <= 1) this.px(i, j, hex);
      }
  }
  /** A filled triangle. */
  tri(a: [number, number], b: [number, number], c: [number, number], hex: string): void {
    const minX = Math.floor(Math.min(a[0], b[0], c[0])), maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
    const minY = Math.floor(Math.min(a[1], b[1], c[1])), maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
    const s = (p: [number, number], q: [number, number], x: number, y: number) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const d1 = s(a, b, x, y), d2 = s(b, c, x, y), d3 = s(c, a, x, y);
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) this.px(x, y, hex);
      }
  }
  /** A one-pixel line (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, hex: string): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, hex);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** A new sprite one pixel larger on every side with a one-pixel outline round everything drawn. */
  outlined(hex: string): Sprite {
    const o = new Sprite(this.w + 2, this.h + 2);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) o.cells[(y + 1) * o.w + x + 1] = this.cells[y * this.w + x];
    const v = pack(hex);
    const out = o.cells.slice();
    const filled = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < o.w && yy < o.h && o.cells[yy * o.w + xx] !== 0;
    for (let y = 0; y < o.h; y++)
      for (let x = 0; x < o.w; x++) {
        if (o.cells[y * o.w + x]) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) out[y * o.w + x] = v;
      }
    o.cells.set(out);
    return o;
  }
  /** Stamp into a buffer with the bottom centre of the sprite at (x, y); clear cells leave the buffer alone. */
  stamp(b: Buf, x: number, y: number): void {
    const ox = Math.round(x) - (this.w >> 1), oy = Math.round(y) - this.h + 1;
    for (let j = 0; j < this.h; j++) {
      const yy = oy + j;
      if (yy < 0 || yy >= b.h) continue;
      for (let i = 0; i < this.w; i++) {
        const v = this.cells[j * this.w + i];
        if (!v) continue;
        const xx = ox + i;
        if (xx < 0 || xx >= b.w) continue;
        const p = (yy * b.w + xx) * 4;
        b.data[p] = (v >> 16) & 255; b.data[p + 1] = (v >> 8) & 255; b.data[p + 2] = v & 255; b.data[p + 3] = 255;
      }
    }
  }
}

// ---------- the icons of the ground ----------

export type PixelGlyph = 'tree' | 'oak' | 'deadtree' | 'palm' | 'reed' | 'peak' | 'hill' | 'dune' | 'mesa' | 'field' | 'tuft' | 'volcano' | 'crack' | 'crystal' | 'ruin' | 'chimney';

/** Leaf and rock colours of each continent (the same table the vector glyphs used). */
const FOLIAGE: Record<string, string> = { AZ: '#5f9a52', MH: '#7a6a3a', KD: '#5a4a3a', NR: '#4f8a52', AL: '#3f8a3a', MK: '#6a7a5a', SH: '#7a8a4a', SV: '#1f5a2e', NB: '#5a6a5a' };
const ROCK: Record<string, string> = { AZ: '#9a9aa6', MH: '#8a6a4a', KD: '#4a3c38', NR: '#8a8a82', AL: '#8a8680', MK: '#7a7e84', SH: '#a8805a', SV: '#6a6a5a', NB: '#7a7e84' };
const INK = '#1e1a14';

const cache = new Map<string, Sprite>();

/** The sprite of an icon: `n` is its height in art pixels (at least 5), `seed` picks the variant. Cached by what it looks like. */
export function glyphSprite(kind: PixelGlyph, n: number, cid: string, fate: FateTint | undefined, seed: number): Sprite {
  n = Math.max(5, Math.round(n));
  const v = Math.abs(seed) % 3;
  const key = `${kind}|${n}|${cid}|${fate ? fate.color + fate.mix.toFixed(2) : ''}|${v}|${seed & 1}`;
  let s = cache.get(key);
  if (s) return s;
  const tint = (hex: string, k = 1) => (fate ? mixHex(hex, fate.color, Math.min(0.95, fate.mix * k)) : hex);
  const leaf = tint(FOLIAGE[cid] ?? '#3f8a3a'), rock = tint(ROCK[cid] ?? '#8a8680');
  const hi = (c: string) => shadeHex(c, 0.28), lo = (c: string) => shadeHex(c, -0.3);
  const w = Math.max(5, Math.round(n * 0.9));
  const wide = kind === 'peak' || kind === 'field' || kind === 'hill' || kind === 'dune' || kind === 'mesa';
  const g = new Sprite(wide ? Math.round(n * 1.4) : w, n);
  const cx = (g.w - 1) / 2;
  switch (kind) {
    case 'tree':
    case 'oak':
      if (kind === 'tree' && v === 0 && n >= 6) {
        // a pine: stacked triangles
        g.rect(Math.round(cx), n - 2, 1, 2, tint('#4a3624'));
        const bands = n >= 9 ? 3 : 2, bh = Math.ceil((n - 2) / bands) + 1;
        for (let b = 0; b < bands; b++) {
          const top = Math.round(b * ((n - 2 - bh) / Math.max(1, bands - 1))), wd = Math.round(((b + 1) / bands) * (g.w / 2 - 0.5));
          g.tri([cx, top], [cx - wd - 0.5, top + bh], [cx + wd + 0.5, top + bh], b % 2 ? lo(leaf) : leaf);
          g.line(cx - wd + 1, top + bh - 1, cx - 1, top + Math.round(bh / 2), hi(leaf));
        }
      } else {
        const r = Math.max(2, (n - 2) / 2);
        g.rect(Math.round(cx), n - Math.max(2, Math.round(n * 0.3)), 1, Math.max(2, Math.round(n * 0.3)), tint('#4a3624'));
        g.disk(cx, r, g.w / 2 - 0.4, r, lo(leaf));
        g.disk(cx - 0.5, r - 0.6, g.w / 2 - 1.2, r - 0.9, leaf);
        g.px(cx - g.w / 4, r - r / 2, hi(leaf));
        if (n >= 8) g.px(cx - g.w / 4 + 1, r - r / 2 - 1, hi(leaf));
      }
      break;
    case 'deadtree': {
      const t = tint('#3a2c20');
      g.line(cx, n - 1, cx, 0, t);
      g.line(cx, Math.round(n * 0.55), cx + Math.round(w * 0.4), Math.round(n * 0.25), t);
      g.line(cx, Math.round(n * 0.4), cx - Math.round(w * 0.4), Math.round(n * 0.12), t);
      break;
    }
    case 'palm': {
      const t = tint('#6a5030');
      g.line(cx, n - 1, cx + 1, Math.round(n * 0.3), t);
      const tx = cx + 1, ty = Math.round(n * 0.3);
      g.line(tx, ty, tx - Math.round(w * 0.45), ty + 1, leaf); g.line(tx, ty, tx + Math.round(w * 0.45), ty + 1, leaf);
      g.line(tx, ty, tx - Math.round(w * 0.3), ty - 2, leaf); g.line(tx, ty, tx + Math.round(w * 0.3), ty - 2, leaf);
      g.px(tx, ty - 2, hi(leaf));
      break;
    }
    case 'reed': {
      const t = tint('#5a7a3a');
      for (const dx of [-1, 0, 1]) g.line(cx + dx, n - 1, cx + dx * 2, Math.round(n * (dx === 0 ? 0.05 : 0.3)), t);
      break;
    }
    case 'peak': {
      const wd = g.w / 2 - 0.5;
      g.tri([cx, 0], [cx - wd, n - 1], [cx + wd, n - 1], rock);
      g.tri([cx, 0], [cx + wd, n - 1], [cx + 1, n - 1], lo(rock));
      g.line(cx, 1, cx - wd + 1, n - 2, hi(rock));
      if (cid !== 'SH' && cid !== 'KD' && !fate) { g.tri([cx, 0], [cx - 1.5, 2.4], [cx + 1.5, 2.4], '#f2f2ee'); g.px(cx + 1, 2, '#c8ccd4'); }
      break;
    }
    case 'hill': {
      const col = tint(mixHex(ROCK[cid] ?? '#8a8680', '#5a7a3a', 0.35));
      g.disk(cx, n - 1, g.w / 2 - 0.4, n - 1.2, col);
      g.px(cx - 1, Math.round(n * 0.3), hi(col));
      break;
    }
    case 'dune': {
      const a = tint('#c8a050'), b = tint('#a8803a');
      for (let x = 0; x < g.w; x++) {
        const y = Math.round(n * 0.55 - Math.sin(((x + v - 1) / g.w) * Math.PI * 1.3) * n * 0.35);
        g.px(x, y, a); g.px(x, y + 1, b);
      }
      break;
    }
    case 'mesa': {
      const c = tint('#a87450');
      g.rect(1, 1, g.w - 2, n - 1, c); g.rect(1, 1, g.w - 2, 1, tint('#c8905e')); g.rect(g.w - 3, 2, 2, n - 2, lo(c));
      break;
    }
    case 'field': {
      const cols = seed & 1 ? ['#c8c860', '#a8b848'] : ['#d6b448', '#b8d070'];
      const h2 = Math.max(2, Math.floor(n / 2));
      g.rect(0, 0, g.w, h2, tint(cols[0])); g.rect(0, h2, g.w, n - h2, tint(cols[1]));
      for (let x = 1; x < g.w; x += 2) g.px(x, 0, shadeHex(tint(cols[0]), -0.12));
      break;
    }
    case 'tuft': {
      const t = tint(mixHex(leaf, '#ffffff', 0.15));
      g.line(cx - 1, n - 1, cx - 2, 0, t); g.line(cx, n - 1, cx, 0, t); g.line(cx + 1, n - 1, cx + 2, 1, t);
      break;
    }
    case 'volcano': {
      const c = tint('#3a302c');
      g.tri([cx - g.w / 2 + 0.5, n - 1], [cx - 1.5, 1], [cx + 1.5, 1], c);
      g.tri([cx + g.w / 2 - 0.5, n - 1], [cx + 1.5, 1], [cx - 1.5, n - 1], c);
      g.rect(Math.round(cx) - 1, 0, 3, 2, fate ? '#5a5a60' : '#e0662a');
      break;
    }
    case 'crack': {
      const c = fate ? '#3a3a3e' : '#e0662a';
      g.line(0, n - 2, 2, n - 4, c); g.line(2, n - 4, 4, n - 2, c); g.line(4, n - 2, Math.min(g.w - 1, 6), n - 4, c);
      break;
    }
    case 'crystal': {
      const c = tint('#8ad8e0');
      g.tri([cx, 0], [0, n * 0.55], [g.w - 1, n * 0.55], c); g.tri([cx, n - 1], [0, n * 0.55], [g.w - 1, n * 0.55], lo(c));
      g.px(cx - 1, 2, '#e8ffff');
      break;
    }
    case 'ruin': {
      const c = tint('#9a9a9e');
      g.rect(0, 1, 2, n - 1, c); g.rect(g.w - 2, Math.round(n * 0.4), 2, n - Math.round(n * 0.4), c); g.rect(0, n - 1, g.w, 1, lo(c));
      break;
    }
    case 'chimney': {
      const c = tint('#6a4a3a');
      g.rect(Math.round(cx) - 1, 2, 3, n - 2, c); g.px(cx + 1, 0, '#8a8a8a'); g.px(cx + 2, 1, '#6a6a6a');
      break;
    }
  }
  s = g.outlined(tint(INK, 0.3));
  cache.set(key, s);
  if (cache.size > 400) cache.delete(cache.keys().next().value as string);
  return s;
}

// ---------- the great landmarks ----------

export type PixelLandmark = 'worldtree' | 'arkea' | 'abyss' | 'whirlpool' | 'volcano';

/** A landmark stamped into the buffer, centred on (x, y); `n` is its radius in art pixels (at least 6). */
export function stampLandmark(b: Buf, kind: PixelLandmark, x: number, y: number, n: number, fate?: string): void {
  n = Math.max(6, Math.round(n));
  const s = new Sprite(n * 2 + 3, n * 2 + 3);
  const c = n + 1;
  const dead = fate === 'withered';
  switch (kind) {
    case 'worldtree': {
      const cols = dead ? ['#4a4a38', '#6a6a50', '#8a8a66', '#a8a07a'] : ['#173f22', '#1f5a2e', '#2e7a3e', '#6ab058'];
      s.rect(c - 1, c + Math.round(n * 0.2), 3, Math.round(n * 0.7), dead ? '#4a4030' : '#5a4028');
      s.disk(c, c - 1, n, n * 0.66, cols[0]);
      s.disk(c, c - 2, n * 0.82, n * 0.54, cols[1]);
      s.disk(c - 1, c - 3, n * 0.58, n * 0.38, cols[2]);
      s.disk(c - 2, c - 4, n * 0.28, n * 0.2, cols[3]);
      break;
    }
    case 'arkea': {
      const ring = '#aab0ba', node = fate === 'rust' ? '#4a8a6a' : '#6ad0ff';
      const R = n - 1;
      for (let a = 0; a < 360; a += 4) {
        const t = (a * Math.PI) / 180;
        s.px(c + Math.cos(t) * R, c + Math.sin(t) * R * 0.8, ring);
        s.px(c + Math.cos(t) * R * 0.55, c + Math.sin(t) * R * 0.55 * 0.8, ring);
      }
      for (let i = 0; i < 9; i++) {
        const t = (i / 9) * Math.PI * 2;
        s.line(c, c, c + Math.cos(t) * R * 0.55, c + Math.sin(t) * R * 0.44, '#7a808a');
        s.rect(Math.round(c + Math.cos(t) * R), Math.round(c + Math.sin(t) * R * 0.8), 2, 2, node);
      }
      break;
    }
    case 'abyss': {
      const ash = fate === 'ash';
      s.disk(c, c, n, n * 0.5, '#120a0a');
      s.disk(c, c, n * 0.7, n * 0.32, ash ? '#2a2a2e' : '#6a1a10');
      s.disk(c, c, n * 0.36, n * 0.16, ash ? '#3a3a3e' : '#ff5a20');
      break;
    }
    case 'whirlpool': {
      for (let arm = 0; arm < 3; arm++)
        for (let t = 0; t <= 1; t += 0.02) {
          const a = t * Math.PI * 3.2 + arm * 2.1, r = n * (0.2 + 0.78 * t);
          s.px(c + Math.cos(a) * r, c + Math.sin(a) * r * 0.62, t > 0.5 ? '#d2e1eb' : '#8ab8d0');
        }
      s.rect(c - 1, c - 1, 2, 2, fate === 'fog' ? '#c8c8d0' : '#f0d070');
      break;
    }
    case 'volcano': {
      const ash = fate === 'ash';
      const body = ash ? '#6a6a6e' : '#241c1a';
      const a = Math.round(n * 0.3), top = c - Math.round(n * 0.6), base = c + Math.round(n * 0.4);
      s.tri([c - n, base], [c - a, top], [c + a, top], body);
      s.tri([c + n, base], [c + a, top], [c - a, base], body);
      s.rect(c - a, top - 1, a * 2, 2, ash ? '#8a8a90' : '#ff7a2a');
      if (!ash) s.line(c, top + 1, c + a, base - 2, '#e0662a');
      for (let i = 0; i < 3; i++) s.disk(c + i * 1.5, top - 2 - i * 2.2, 1.2 + i * 0.6, 1.1 + i * 0.4, '#5a5a5a');
      break;
    }
  }
  const o = s.outlined('#14100c');
  o.stamp(b, x, y + (o.h >> 1));
}

/** A straight one-pixel line stamped into a buffer (the bridge of light between two lands). */
export function stampLine(b: Buf, x0: number, y0: number, x1: number, y1: number, rgb: Rgb): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x0 >= 0 && y0 >= 0 && x0 < b.w && y0 < b.h) {
      const p = (y0 * b.w + x0) * 4;
      b.data[p] = rgb[0]; b.data[p + 1] = rgb[1]; b.data[p + 2] = rgb[2]; b.data[p + 3] = 255;
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
