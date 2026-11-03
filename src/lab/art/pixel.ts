// The pixel painter of the art lab (a try-out before M6, not game code). A look of a few named parts is drawn as flat materials on a small
// grid; one pass shades every material (light from the top left, a darker hue-shifted tone at the bottom right, a shadow where a part sits
// under another) and one more rings the silhouette with a dark outline of the colour next to it, the way hand-made pixel art is coloured.
// Every renderer of the lab draws these same frames, so the comparison is of the renderers, not of the art.

export type Anim = 'idle' | 'walk' | 'attack';
export const ANIMS: readonly Anim[] = ['idle', 'walk', 'attack'];
export const FRAME_N: Record<Anim, number> = { idle: 2, walk: 4, attack: 3 };
export const FRAME_MS: Record<Anim, number> = { idle: 520, walk: 130, attack: 150 };
/** Frames per row of a sheet (the longest animation). */
export const COLS = 4;

export interface Frame { w: number; h: number; data: Uint8ClampedArray<ArrayBuffer> }
export interface Sheet { name: string; fw: number; fh: number; canvas: HTMLCanvasElement; frames: Record<Anim, Frame[]> }
export const frameIndex = (a: Anim, i: number): number => ANIMS.indexOf(a) * COLS + i;

// ── colour ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
type Rgb = [number, number, number];
const parse = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function toHsl([r, g, b]: Rgb): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function toRgb(h: number, s: number, l: number): Rgb {
  s = Math.min(1, Math.max(0, s)); l = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Turn a hue toward another by at most `by` degrees (shadows lean blue, lights lean warm). */
const toward = (h: number, to: number, by: number): number => {
  const d = ((to - h + 540) % 360) - 180;
  return (h + Math.sign(d) * Math.min(Math.abs(d), by) + 360) % 360;
};

/** The four tones of a material: outline, shadow, base, light. */
export function tones(hex: string): Rgb[] {
  const [h, s, l] = toHsl(parse(hex));
  return [
    toRgb(toward(h, 245, 25), s * 0.75, Math.max(0.05, l * 0.3)),
    toRgb(toward(h, 240, 14), s * 1.05, l - 0.13),
    parse(hex),
    toRgb(toward(h, 50, 10), s * 0.95, l + 0.1),
  ];
}

// ── the grid ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
interface Mat { t: Rgb[]; flat: boolean; deep: boolean }
export type Pt = [number, number];

export class Paint {
  readonly m: Uint8Array;
  readonly mats: Mat[] = [{ t: [], flat: true, deep: false }];
  constructor(readonly w: number, readonly h: number) { this.m = new Uint8Array(w * h); }
  mat(hex: string, o: { flat?: boolean; deep?: boolean } = {}): number {
    const t = tones(hex);
    this.mats.push({ t: o.flat ? [t[0], t[2], t[2], t[2]] : t, flat: !!o.flat, deep: !!o.deep });
    return this.mats.length - 1;
  }
  at(x: number, y: number): number { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.m[y * this.w + x]; }
  px(x: number, y: number, k: number): void {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.m[y * this.w + x] = k;
  }
  rect(x: number, y: number, w: number, h: number, k: number): void { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, k); }
  ell(cx: number, cy: number, rx: number, ry: number, k: number): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, k);
      }
  }
  line(a: Pt, b: Pt, k: number, thick = 1): void {
    const n = Math.max(1, Math.round(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
    const steep = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]);
    for (let i = 0; i <= n; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / n, y = a[1] + ((b[1] - a[1]) * i) / n;
      this.px(x, y, k);
      if (thick > 1) this.px(steep ? x + 1 : x, steep ? y : y + 1, k);
    }
  }
  poly(pts: Pt[], k: number): void {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const yc = y + 0.5, xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.px(x, y, k);
    }
  }

  /** Shade, outline and lay the ground shadow; the finished RGBA frame. */
  finish(shadow: { cx: number; cy: number; rx: number; ry: number }): Frame {
    const { w, h, m, mats } = this, out = new Uint8ClampedArray(w * h * 4);
    const put = (i: number, c: Rgb, a = 255) => { out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = a; };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = m[y * w + x];
        if (!k) continue;
        const mt = mats[k];
        let t = 2;
        if (!mt.flat) {
          const up = this.at(x, y - 1);
          const lit = up === 0 || this.at(x - 1, y) === 0;
          const shade = this.at(x, y + 1) === 0 || this.at(x + 1, y) === 0 || (up !== 0 && up !== k) || (mt.deep && (this.at(x, y + 2) === 0 || this.at(x + 2, y) === 0));
          t = lit && shade ? 2 : lit ? 3 : shade ? 1 : 2;
        }
        put(y * w + x, mt.t[t]);
      }
    const ring = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (m[y * w + x]) continue;
        const k = this.at(x, y + 1) || this.at(x - 1, y) || this.at(x + 1, y) || this.at(x, y - 1);
        if (k) { put(y * w + x, mats[k].t[0]); ring[y * w + x] = 1; }
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (m[i] || ring[i]) continue;
        const dx = (x + 0.5 - shadow.cx) / shadow.rx, dy = (y + 0.5 - shadow.cy) / shadow.ry;
        if (dx * dx + dy * dy <= 1) put(i, [24, 26, 44], 70);
      }
    return { w, h, data: out };
  }
}

// ── people ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface PixelLook {
  name: string;
  skin: string; cloth: string; cloth2: string; leather: string; metal: string;
  hat: 'none' | 'helm' | 'hood' | 'wide' | 'skull';
  hatColor?: string; hair?: string; glow?: string;
  ears: 'long' | 'round';
  weapon: 'spear' | 'sword' | 'axe' | 'staff';
  cape: boolean;
}

export const PERSON = { w: 36, h: 36, foot: 32 } as const;
const DEG = Math.PI / 180;

interface Pose { b: number; L: number; fa: number; ba: number; lift: 0 | 1 | 2; hand: Pt; ang: number; push: number; flap: number; bh: number }

function poseOf(a: Anim, i: number, swing: boolean): Pose {
  if (a === 'idle') return { b: i, L: 0, fa: 1, ba: -1, lift: 0, hand: [22, -4], ang: (swing ? -60 : -78) * DEG, push: 0, flap: i, bh: 0 };
  if (a === 'walk') {
    const fa = [2, 0, -2, 0][i];
    return { b: [0, -1, 0, -1][i], L: 0, fa, ba: -fa, lift: i === 1 ? 1 : i === 3 ? 2 : 0, hand: [22 - fa / 2, -4], ang: (swing ? -55 : -32) * DEG, push: 0, flap: 1 + (i % 2), bh: fa / 2 };
  }
  const sw: Pose[] = [
    { b: 0, L: -1, fa: 1, ba: -2, lift: 0, hand: [18, -10], ang: -125 * DEG, push: 0, flap: 0, bh: 0 },
    { b: 1, L: 2, fa: 3, ba: -2, lift: 0, hand: [25, -5], ang: 25 * DEG, push: 0, flap: 2, bh: 0 },
    { b: 0, L: 1, fa: 2, ba: -1, lift: 0, hand: [23, -4], ang: -10 * DEG, push: 0, flap: 1, bh: 0 },
  ];
  const th: Pose[] = [
    { b: 0, L: -1, fa: 1, ba: -2, lift: 0, hand: [19, -6], ang: -12 * DEG, push: -3, flap: 0, bh: 0 },
    { b: 1, L: 2, fa: 3, ba: -2, lift: 0, hand: [26, -6], ang: -4 * DEG, push: 4, flap: 2, bh: 0 },
    { b: 0, L: 1, fa: 2, ba: -1, lift: 0, hand: [24, -5], ang: -20 * DEG, push: 1, flap: 1, bh: 0 },
  ];
  return (swing ? sw : th)[i];
}

export function paintPerson(L: PixelLook, a: Anim, i: number): Frame {
  const p = new Paint(PERSON.w, PERSON.h);
  const S = p.mat(L.skin), C = p.mat(L.cloth), C2 = p.mat(L.cloth2), LE = p.mat(L.leather), ME = p.mat(L.metal), WO = p.mat('#7a5232');
  const EY = p.mat('#16141c', { flat: true }), HT = p.mat(L.hatColor ?? L.cloth2), HA = p.mat(L.hair ?? '#3a2a20'), GL = p.mat(L.glow ?? '#9fe0ff', { flat: true }), BO = p.mat('#d9cfb2');
  const swing = L.weapon === 'sword' || L.weapon === 'axe';
  const q = poseOf(a, i, swing);
  const hip = 25 + q.b, x0 = 14 + q.L;
  const hc: Pt = [x0 + 5, hip - 13];

  if (L.cape) p.poly([[x0 + 1, hip - 9], [x0 - 3 - q.flap, hip + 3], [x0 + 3, hip + 4], [x0 + 4, hip - 8]], C2);
  // the far arm, behind the body
  p.line([x0 + 2, hip - 8], [x0 + 1 - q.bh, hip - 3], C, 2);
  p.px(x0 + 1 - q.bh, hip - 2, S);
  const leg = (x: number, up: boolean) => {
    const bottom = PERSON.foot - (up ? 1 : 0);
    p.rect(x, hip, 2, bottom - hip - 1, C2);
    p.rect(x, bottom - 2, 3, 2, LE);
  };
  leg(x0 + 1 + q.ba, q.lift === 1);
  leg(x0 + 4 + q.fa, q.lift === 2);
  // the body
  p.rect(x0, hip - 9, 8, 9, C);
  p.px(x0, hip - 9, 0); p.px(x0 + 7, hip - 9, 0);
  p.rect(x0 - 1, hip - 1, 10, 2, C);
  p.rect(x0, hip - 3, 8, 1, LE);
  p.px(x0 + 6, hip - 3, ME);
  // the head
  const [hx, hy] = hc;
  const ears = () => {
    if (L.ears === 'long') p.line([hx - 3, hy], [hx - 7, hy - 3], S, 2);
    else { p.px(hx - 3, hy, S); p.px(hx - 3, hy + 1, S); }
  };
  if (L.hat === 'hood') {
    p.ell(hx - 0.5, hy - 0.5, 5, 5, HT);
    p.rect(hx - 5, hy + 3, 2, 4, HT);
    p.ell(hx + 2, hy + 0.5, 2.6, 3, S);
    ears();
  } else {
    p.ell(hx, hy, 4, 4, S);
    ears();
  }
  p.px(hx + 2, hy, EY);
  p.px(hx + 4, hy + 1, S);
  if (L.hat === 'none') { p.ell(hx - 0.5, hy - 2, 4.2, 2.5, HA); p.rect(hx - 4, hy - 2, 3, 4, HA); }
  if (L.hat === 'helm') {
    p.ell(hx, hy - 2, 4.8, 3.3, ME);
    p.rect(hx - 5, hy - 1, 10, 1, ME);
    p.px(hx + 3, hy, ME); p.px(hx + 3, hy + 1, ME);
  }
  if (L.hat === 'wide') {
    p.rect(hx - 7, hy - 3, 14, 1, HT);
    p.rect(hx - 3, hy - 7, 6, 4, HT);
    p.px(hx + 3, hy - 7, HT); p.px(hx + 4, hy - 8, HT);
    p.rect(hx - 3, hy - 4, 6, 1, LE);
  }
  if (L.hat === 'skull') {
    p.ell(hx + 0.5, hy - 1, 4.5, 3.5, BO);
    p.rect(hx + 1, hy - 1, 2, 2, EY);
    p.line([hx - 2, hy - 4], [hx - 5, hy - 8], BO);
    p.line([hx + 1, hy - 4], [hx + 2, hy - 8], BO);
  }
  // the weapon and the near arm, which holds it
  const hand: Pt = [q.hand[0], hip + q.hand[1]];
  const d: Pt = [Math.cos(q.ang), Math.sin(q.ang)], n: Pt = [-d[1], d[0]];
  const at = (t: number): Pt => [hand[0] + d[0] * (t + q.push), hand[1] + d[1] * (t + q.push)];
  const off = (pt: Pt, s: number): Pt => [pt[0] + n[0] * s, pt[1] + n[1] * s];
  if (L.weapon === 'spear') {
    p.line(at(-7), at(9), WO);
    p.line(at(9), at(12), ME);
    p.px(...off(at(10), 1), ME); p.px(...off(at(10), -1), ME);
  } else if (L.weapon === 'sword') {
    p.px(...at(-2), ME);
    p.line(at(-1), at(0), LE);
    p.px(...off(at(1), 1), ME); p.px(...off(at(1), -1), ME);
    p.line(at(1), at(9), ME);
  } else if (L.weapon === 'axe') {
    p.line(at(-3), at(8), WO);
    p.poly([at(5), at(8.5), off(at(9), 3.2), off(at(4.5), 3.2)], ME);
  } else {
    p.line(at(-9), at(9), WO);
    p.ell(...at(10.5), 1.8, 1.8, GL);
  }
  p.line([x0 + 5, hip - 8], hand, C, 2);
  p.px(...hand, S);
  return p.finish({ cx: 18, cy: PERSON.foot, rx: 8, ry: 2 });
}

// ── beasts ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface BeastLook { name: string; fur: string; belly: string }
export const BEAST = { w: 44, h: 30, foot: 27 } as const;

export function paintWolf(L: BeastLook, a: Anim, i: number): Frame {
  const p = new Paint(BEAST.w, BEAST.h);
  const F = p.mat(L.fur, { deep: true }), FD = p.mat(L.fur), B = p.mat(L.belly), EY = p.mat('#e8d070', { flat: true }), NO = p.mat('#15131a', { flat: true }), TE = p.mat('#f0eadc', { flat: true });
  const bob = a === 'walk' ? [0, -1, 0, -1][i] : a === 'attack' ? [0, -1, 0][i] : 0;
  const lx = a === 'attack' ? [-1, 3, 1][i] : 0;
  const ph = a === 'walk' ? (i / 4) * Math.PI * 2 : a === 'attack' ? [0.5, 2.2, 1][i] : 0;
  const cy = 17 + bob + (a === 'idle' ? i : 0);
  const leg = (x: number, phase: number, near: boolean) => {
    const o = a === 'idle' ? 0 : Math.round(2.4 * Math.sin(phase));
    const lift = a === 'idle' ? 0 : Math.max(0, Math.round(1.4 * Math.cos(phase)));
    p.line([x + lx, cy + 3], [x + lx + o, BEAST.foot - 1 - lift], near ? F : FD, 2);
  };
  leg(16, ph + 0.6, false); leg(30, ph + Math.PI + 0.6, false);
  p.line([12 + lx, cy - 2], [5 + lx, cy - 5 + (i % 2)], F, 2);
  p.px(4 + lx, cy - 5 + (i % 2), B);
  p.ell(22 + lx, cy, 10, 5, F);
  p.ell(22 + lx, cy + 3, 7, 1.6, B);
  p.ell(28 + lx, cy - 2, 4, 4, F);
  leg(14, ph, true); leg(28, ph + Math.PI, true);
  p.ell(33 + lx, cy - 4, 4, 3.5, F);
  p.rect(35 + lx, cy - 4, 5, 3, F);
  const open = a === 'attack' && i === 1;
  p.rect(35 + lx, cy - 2 + (open ? 1 : 0), 4, 1, B);
  if (open) { p.px(38 + lx, cy - 1, TE); p.px(36 + lx, cy - 1, TE); }
  p.px(40 + lx, cy - 4, NO);
  p.px(35 + lx, cy - 5, EY);
  p.line([31 + lx, cy - 7], [31 + lx, cy - 10], F, 2);
  p.line([34 + lx, cy - 7], [34 + lx, cy - 9], F);
  return p.finish({ cx: 22, cy: BEAST.foot, rx: 13, ry: 2 });
}

// ── sheets ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const LOOKS: PixelLook[] = [
  { name: 'ขวานหมวกเหล็ก', skin: '#6f9a4a', cloth: '#7a5a3a', cloth2: '#c4b080', leather: '#5a3a24', metal: '#7a7f88', hat: 'helm', ears: 'long', weapon: 'axe', cape: false },
  { name: 'ดาบผ้าคลุมแดง', skin: '#6f9a4a', cloth: '#4a4f3a', cloth2: '#a8262a', leather: '#3a2a22', metal: '#8a8e96', hat: 'helm', ears: 'long', weapon: 'sword', cape: true },
  { name: 'มีดผ้าพันหน้า', skin: '#7aa050', cloth: '#4d5a3a', cloth2: '#c8b890', leather: '#3a3024', metal: '#b0b4bc', hat: 'hood', hatColor: '#d0c49a', ears: 'long', weapon: 'sword', cape: false },
  { name: 'หมวกปีกน้ำเงิน', skin: '#6a9448', cloth: '#5a5a3a', cloth2: '#6a5a40', leather: '#4a3424', metal: '#9a9ea6', hat: 'wide', hatColor: '#3a62a8', ears: 'long', weapon: 'spear', cape: false },
  { name: 'มนุษย์ฮู้ดหอก', skin: '#d8a878', cloth: '#5a6a4a', cloth2: '#6a4a32', leather: '#3e2a1e', metal: '#a8acb4', hat: 'hood', hatColor: '#5a3e2a', ears: 'round', weapon: 'spear', cape: true },
  { name: 'หัวกะโหลกไม้เท้า', skin: '#7a9658', cloth: '#4a4a40', cloth2: '#5a4a3a', leather: '#3a2a20', metal: '#8a8a90', hat: 'skull', glow: '#e86a3a', ears: 'long', weapon: 'staff', cape: true },
  { name: 'มนุษย์ผมดำดาบ', skin: '#c89068', cloth: '#3a5a8a', cloth2: '#2a2f3a', leather: '#4a3020', metal: '#c0c4cc', hat: 'none', hair: '#2a1e18', ears: 'round', weapon: 'sword', cape: false },
  { name: 'ผิวเทาไม้เท้าแสง', skin: '#8a94a0', cloth: '#5a3a6a', cloth2: '#3a2a4a', leather: '#2a2230', metal: '#9aa0a8', hat: 'none', hair: '#d8d8e0', glow: '#9fe0ff', ears: 'long', weapon: 'staff', cape: true },
];
export const WOLF: BeastLook = { name: 'หมาป่า', fur: '#6a6e66', belly: '#a8a494' };

export function sheetOf(name: string, fw: number, fh: number, paint: (a: Anim, i: number) => Frame): Sheet {
  const canvas = document.createElement('canvas');
  canvas.width = fw * COLS; canvas.height = fh * ANIMS.length;
  const ctx = canvas.getContext('2d')!;
  const frames = {} as Record<Anim, Frame[]>;
  ANIMS.forEach((a, row) => {
    frames[a] = [];
    for (let i = 0; i < FRAME_N[a]; i++) {
      const f = paint(a, i);
      frames[a].push(f);
      ctx.putImageData(new ImageData(f.data, f.w, f.h), i * fw, row * fh);
    }
  });
  return { name, fw, fh, canvas, frames };
}

let cache: Sheet[] | null = null;
/** The eight people and the wolf, painted once. */
export function allSheets(): Sheet[] {
  cache ??= [
    ...LOOKS.map((L) => sheetOf(L.name, PERSON.w, PERSON.h, (a, i) => paintPerson(L, a, i))),
    sheetOf(WOLF.name, BEAST.w, BEAST.h, (a, i) => paintWolf(WOLF, a, i)),
  ];
  return cache;
}

/** A frame on a canvas of its own (for things drawn once: trees, houses, a portrait). */
export function frameCanvas(f: Frame): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = f.w; c.height = f.h;
  c.getContext('2d')!.putImageData(new ImageData(f.data, f.w, f.h), 0, 0);
  return c;
}
