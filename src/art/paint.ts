// The pixel painter (docs/appearance/21-pixel-art.md §1): flat materials on a small grid, then one pass that shades every material with four
// tones (outline, shadow, base, light; light from the top left, shadows lean blue and lights lean warm, a part under another is shadowed)
// and rings the silhouette with the dark tone of the colour next to it. Pure: no DOM, so the checks (check:looks) run it in Node.

export interface Frame { w: number; h: number; data: Uint8ClampedArray<ArrayBuffer> }

// ── colour ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Rgb = [number, number, number];
/** `#rrggbb` (a bad value paints magenta, so it shows on the characters page instead of passing as grey). */
const parse = (h: string): Rgb => (/^#[0-9a-f]{6}$/i.test(h) ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : [255, 0, 255]);

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

/** How warm a hue is, 0 (not at all) to 1 (red, orange, skin): the hues from red round to yellow-orange. */
const warmth = (h: number): number => (h <= 70 ? Math.min(1, (70 - h) / 20) : h >= 330 ? Math.min(1, (h - 320) / 20) : 0);

/**
 * The four tones of a material: outline, shadow, base, light. A shadow leans blue; but a warm hue (skin, orange) made more saturated and
 * turned toward blue goes a raw red-orange, so the shadow of a warm hue is a good deal less saturated and turns a little toward the red-violet.
 */
export function tones(hex: string): Rgb[] {
  const [h, s, l] = toHsl(parse(hex));
  const w = warmth(h);
  return [
    toRgb(toward(h, 245, 25), s * 0.75, Math.max(0.05, l * 0.3)),
    toRgb(w ? toward(h, 345, 10 * w) : toward(h, 240, 14), s * (1.05 - 0.37 * w), l - 0.13),
    parse(hex),
    toRgb(toward(h, 50, 10), s * 0.95, l + 0.1),
  ];
}

// ── the grid ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
interface Mat { t: Rgb[]; flat: boolean; deep: boolean; alpha: number }
export interface MatOpts { flat?: boolean; deep?: boolean; alpha?: number }
export type Pt = [number, number];
/** A free-floating pixel laid on the finished frame (sparks, embers, dust, steam): flat colour, no shading, no outline. */
export interface Glow { x: number; y: number; hex: string; a: number }

export class Paint {
  readonly m: Uint8Array;
  readonly mats: Mat[] = [{ t: [], flat: true, deep: false, alpha: 255 }];
  private readonly known = new Map<string, number>();
  /** The glow pixels, laid by `finish` over everything else (the ground shadow too). */
  readonly glows: Glow[] = [];
  constructor(readonly w: number, readonly h: number) { this.m = new Uint8Array(w * h); }
  /** A material of this colour (the same colour and options give the same id). `flat` keeps one tone (eyes, glows); `deep` shades two pixels in (big shapes); `alpha` 0..1 for gel and ghosts. */
  mat(hex: string, o: MatOpts = {}): number {
    const key = `${hex}|${o.flat ? 1 : 0}${o.deep ? 1 : 0}|${o.alpha ?? 1}`;
    const have = this.known.get(key);
    if (have) return have;
    const t = tones(hex);
    this.mats.push({ t: o.flat ? [t[0], t[2], t[2], t[2]] : t, flat: !!o.flat, deep: !!o.deep, alpha: Math.round(255 * (o.alpha ?? 1)) });
    if (this.mats.length > 255) throw new Error('more than 255 materials in one frame');
    this.known.set(key, this.mats.length - 1);
    return this.mats.length - 1;
  }
  /** A pixel of `hex` (`alpha` 0..1) that is laid after the shading, the outline and the ground shadow: it gets no dark ring. Anywhere on the grid above the ground line. */
  glow(x: number, y: number, hex: string, alpha = 1): void { this.glows.push({ x, y, hex, a: alpha }); }
  /** Turn what is drawn a quarter turn around a point (`dir` 1 clockwise, -1 counter-clockwise): a figure that falls. */
  turn(dir: 1 | -1, about: Pt): void {
    const old = this.m.slice();
    this.m.fill(0);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const k = old[y * this.w + x];
        if (!k) continue;
        const dx = x - about[0], dy = y - about[1];
        this.px(about[0] - dir * dy, about[1] + dir * dx, k);
      }
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
        put(y * w + x, mt.t[t], mt.alpha);
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
    // the glow pixels on top: blended over what is there, above the ground line only
    for (const { x, y, hex, a } of this.glows) {
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= w || yi >= Math.min(h, shadow.cy)) continue;
      const o = (yi * w + xi) * 4, c = parse(hex), under = out[o + 3] / 255, res = a + under * (1 - a);
      for (let q = 0; q < 3; q++) out[o + q] = Math.round((c[q] * a + out[o + q] * under * (1 - a)) / (res || 1));
      out[o + 3] = Math.round(res * 255);
    }
    return { w, h, data: out };
  }
}

