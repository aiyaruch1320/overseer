// Helpers the part painters share (outfits, hair, hats, tools): colour mixing, a stable hash for wear marks, the head's box, sleeves, legs, hems.
// Pure drawing on the Rig; nothing here knows an id.
import type { Pt } from '../paint';
import type { Rig } from '../rig';

// ── colour ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const parse = (h: string): [number, number, number] => (/^#[0-9a-f]{6}$/i.test(h) ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : [255, 0, 255]);
const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
/** `a` toward `b` by `t` (0..1), as a hex colour. */
export function mix(a: string, b: string, t: number): string {
  const x = parse(a), y = parse(b);
  return `#${hex2(x[0] + (y[0] - x[0]) * t)}${hex2(x[1] + (y[1] - x[1]) * t)}${hex2(x[2] + (y[2] - x[2]) * t)}`;
}
export const darker = (c: string, t = 0.3): string => mix(c, '#14121c', t);
export const lighter = (c: string, t = 0.3): string => mix(c, '#f2ead6', t);

/** Colours the tables share (muted, per the tone of the world). */
export const TONE = {
  cream: '#cfc4a6', linen: '#b9ad90', steel: '#8e949e', darkSteel: '#5c616c', gold: '#c9a24a', blood: '#8a2f2a', soot: '#2e2a2a',
  ermine: '#d8d2c4', ink: '#2a2a3a', leather: '#5a3a24', dark: '#2a2420',
} as const;

// ── marks of wear ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647 >>> 0);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
/** A stable number of the figure (so the same person wears the same patches in every frame). */
export function seedOf(r: Rig): number {
  let h = 17;
  for (let i = 0; i < r.look.key.length; i++) h = Math.imul(h ^ r.look.key.charCodeAt(i), 16777619);
  return h >>> 0;
}
export interface Box { x: number; y: number; w: number; h: number }
/** Patches sewn on a garment: more of them the more it is worn (`wear` 0..1). A patch is a small block in `ink`. */
export function patches(r: Rig, box: Box, ink: number, offset = 0): void {
  const w = r.look.wear;
  if (w < 0.2 || box.w < 2 || box.h < 2) return;
  const s = seedOf(r), n = w > 0.7 ? 3 : w > 0.45 ? 2 : 1, big = r.k >= 0.8;
  for (let i = 0; i < n; i++) {
    const x = box.x + Math.floor(hash(s, i + offset, 1) * (box.w - (big ? 1 : 0))), y = box.y + Math.floor(hash(s, i + offset, 2) * (box.h - (big ? 1 : 0)));
    r.p.px(x, y, ink);
    if (big) { r.p.px(x + 1, y, ink); r.p.px(x, y + 1, ink); r.p.px(x + 1, y + 1, ink); }
  }
}
/** Frayed edge: pixels of the row `y` between `x0` and `x1` are bitten off, more when worn. `fill` (a material) shows through instead of nothing. */
export function fray(r: Rig, y: number, x0: number, x1: number, fill = 0, extra = 0): void {
  const w = Math.min(1, r.look.wear + extra);
  if (w < 0.1) return;
  const s = seedOf(r);
  for (let x = Math.round(x0); x < Math.round(x1); x++) if (hash(s, x, y) < w * 0.55) r.p.px(x, y, fill);
}
/** Holes in a garment that show what is under it. */
export function holes(r: Rig, box: Box, under: number, from = 0.5): void {
  const w = r.look.wear;
  if (w < from) return;
  const s = seedOf(r), n = w > 0.8 ? 3 : w > 0.65 ? 2 : 1;
  for (let i = 0; i < n; i++) r.p.px(box.x + Math.floor(hash(s, i, 7) * box.w), box.y + Math.floor(hash(s, i, 8) * box.h), under);
}

// ── the head ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Head { hx: number; hy: number; rx: number; ry: number; top: number; bot: number; l: number; rgt: number }
/** The head's box in whole pixels: `top` and `bot` are the first and last rows of the head, `l` and `rgt` the first and last columns. */
export function headOf(r: Rig): Head {
  const [hx, hy] = r.head, [rx, ry] = r.hr;
  return { hx: Math.round(hx), hy: Math.round(hy), rx, ry, top: Math.round(hy - ry), bot: Math.round(hy + ry) - 1, l: Math.round(hx - rx), rgt: Math.round(hx + rx) - 1 };
}
/** Draw something over the head and keep the face (the lower front of the head) as it was: hoods, cowls, turbans. */
export function keepFace(r: Rig, draw: () => void): void {
  const { hx, hy, rx, ry } = headOf(r), { p } = r, keep: [number, number, number][] = [];
  for (let y = Math.floor(hy - ry); y <= Math.ceil(hy + ry); y++)
    for (let x = Math.floor(hx); x <= Math.ceil(hx + rx + 1); x++) {
      const k = p.at(x, y);
      if (k && (x - hx) / rx > 0.05 && (y - hy) / ry > -0.45) keep.push([x, y, k]);
    }
  draw();
  for (const [x, y, k] of keep) p.px(x, y, k);
}
/** The head and its parts as they were before: copy the pixels in a box, to put back after a hat is drawn. */
export function snapshot(r: Rig, x0: number, y0: number, x1: number, y1: number): () => void {
  const keep: [number, number, number][] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = r.p.at(x, y); if (k) keep.push([x, y, k]); }
  return () => { for (const [x, y, k] of keep) r.p.px(x, y, k); };
}

// ── arms ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface SleeveOpts {
  cloth: number;
  /** a band at the end of the sleeve */
  cuff?: number;
  /** what shows beyond the sleeve (skin by default) */
  bare?: number;
  /** the share of the arm the sleeve covers (1 = to the hand) */
  reach?: number;
  /** the sleeve ends in a wide bell (robes) */
  bell?: boolean;
  /** a second tone along the sleeve's upper edge */
  thick?: number;
}
export function sleeve(r: Rig, from: Pt, to: Pt, o: SleeveOpts): void {
  const { p, m } = r, w = o.thick ?? (r.k >= 0.8 ? 2 : 1), reach = o.reach ?? 1;
  const mid: Pt = [from[0] + (to[0] - from[0]) * reach, from[1] + (to[1] - from[1]) * reach];
  if (reach < 1) p.line(mid, to, o.bare ?? m.skin, w);
  p.line(from, mid, o.cloth, w);
  if (o.bell) {
    const big = r.k >= 0.8;
    p.rect(mid[0] - 1, mid[1] - (big ? 1 : 0), big ? 3 : 2, big ? 3 : 2, o.cloth);
  }
  if (o.cuff) p.line(mid, mid, o.cuff, Math.max(w, o.bell ? 2 : 1));
  p.px(to[0], to[1], m.skin);
}

// ── legs and hems ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface LegOpts {
  pants: number;
  shoe?: number;
  /** what the lower leg is made of (a boot top, a greave, bare skin) and where it begins along the leg (0..1) */
  calf?: number;
  calfFrom?: number;
  /** a mark at the knee */
  knee?: number;
}
function leg(r: Rig, L: { x: number; fx: number; lift: number }, o: LegOpts): void {
  const { p } = r, w = r.k >= 0.8 ? 2 : 1, bottom = r.foot - L.lift, shoe = o.shoe ?? r.m.leather, calf = o.calf ?? o.pants, from = o.calfFrom ?? 1;
  if (r.sit) {
    const kx = L.x + 4 * r.k;
    p.rect(L.x, r.hip - w + 1, Math.round(kx - L.x) + 1, w, o.pants);
    p.rect(Math.round(kx), r.hip, w, Math.max(1, r.foot - r.hip - 1), from < 1 ? calf : o.pants);
    if (o.knee) p.px(kx, r.hip - w + 1, o.knee);
    p.rect(Math.round(kx), r.foot - 2, w + 1, 2, shoe);
    return;
  }
  if (r.kneel) {
    const knee: Pt = [L.x + 3 * r.k, r.foot - 2];
    p.line([L.x, r.hip], knee, o.pants, w);
    p.line(knee, [knee[0] - 4 * r.k, r.foot - 1], from < 1 ? calf : o.pants, w);
    if (o.knee) p.px(knee[0], knee[1], o.knee);
    return;
  }
  const a: Pt = [L.x, r.hip], b: Pt = [L.fx, bottom - 2], mid: Pt = [a[0] + (b[0] - a[0]) * from, a[1] + (b[1] - a[1]) * from];
  p.line(a, mid, o.pants, w);
  if (w > 1) p.line([a[0] + 1, a[1]], [mid[0] + 1, mid[1]], o.pants);
  if (from < 1) { p.line(mid, b, calf, w); if (w > 1) p.line([mid[0] + 1, mid[1]], [b[0] + 1, b[1]], calf); }
  if (o.knee) p.px(a[0] + (b[0] - a[0]) * 0.45 + 1, a[1] + (b[1] - a[1]) * 0.45, o.knee);
  p.rect(Math.round(L.fx), bottom - 2, w + 1, 2, shoe);
}
/** Two legs with the materials given (a part's `lower` layer for two-legged bodies). */
export function legs(r: Rig, o: LegOpts): void { leg(r, r.far, o); leg(r, r.near, o); }
/** The shoes alone, for a garment that hides the legs. */
export function feet(r: Rig, shoe: number): void {
  const w = r.k >= 0.8 ? 2 : 1;
  for (const L of [r.far, r.near]) r.p.rect(Math.round(L.fx), r.foot - L.lift - 2, w + 1, 2, shoe);
}

export interface SkirtOpts { mat: number; to: number; /** extra pixels at the hem on each side */ flare?: number; top?: number }
/** A skirt or robe from the hip to the row `to` (the hem), swinging with the walk at the back. */
export function skirt(r: Rig, o: SkirtOpts): void {
  const f = o.flare ?? 2, top = o.top ?? r.hip - 1;
  r.p.poly([[r.x0, top], [r.x0 + r.tw, top], [r.x0 + r.tw + f, o.to], [r.x0 - f - r.flap, o.to]], o.mat);
}
/** A horizontal band across a skirt at row `y`, following its edges. */
export function band(r: Rig, y: number, o: { mat: number; to: number; flare?: number; top?: number; rows?: number }): void {
  const f = o.flare ?? 2, top = o.top ?? r.hip - 1, t = (y + 0.5 - top) / Math.max(1, o.to - top);
  const x0 = r.x0 - f * t - r.flap * t, x1 = r.x0 + r.tw + f * t;
  r.p.rect(Math.round(x0), y, Math.round(x1) - Math.round(x0), o.rows ?? 1, o.mat);
}

/** A belt across the waist with a buckle. */
export function belt(r: Rig, y: number, leather: number, buckle?: number, rows = 1): void {
  r.p.rect(r.x0, y, r.tw, rows, leather);
  if (buckle != null) r.p.px(r.x0 + r.tw - 2, y, buckle);
}
