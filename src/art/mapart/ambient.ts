// The floating air of a town (the `ambient=` of the UI value: embers fog leaves smoke sand clouds gulls ash dust motes), as baked loops
// (21-pixel-art.md §5: "วนซ้ำตายตัว (หมอก ฝุ่นในเมือง): อบเป็นหลายเฟรมแล้วเล่นวน"). Each loop is a few frames of one square tile that repeats in both
// directions and joins up from the last frame to the first, so a tile sprite plays it for ever with no seam. One art pixel is one pixel here.
// The baked part of a loop is what is closed in itself: the sway and twinkle of a particle (a sine of a whole period per loop), the boil of a bank of
// periodic noise thresholded against a Bayer matrix (no soft edge: one pixel, one colour). The drift of the whole sheet (rising embers, falling ash, the
// wind in the dust) is the scroll the scene gives its tile sprite, `airScroll`, in art pixels a second: that never has a seam. Pure: no DOM.
import type { Frame } from '../paint';
import { parse } from './color';

/** Side of one tile of an air loop (a power of two: the GPU repeats it). */
export const AIR_SIDE = 128;
/** Frames of a loop and the time of one frame in ms. */
export const AIR_FRAMES = 8;
export const AIR_MS = 150;

type Rgb = [number, number, number];
interface Particles {
  /** how many in the tile */
  n: number;
  colors: string[];
  /** drift of the whole sheet in art pixels a second (the scene scrolls the tile; it is not baked) */
  vx: number;
  vy: number;
  /** side of a particle in pixels, and its alpha */
  size: [number, number];
  alpha: number;
  /** sway in pixels of a sine over the loop and whether the light twinkles */
  sway?: number;
  twinkle?: boolean;
  /** 2 wide, 1 high leaf shape instead of a square */
  leaf?: boolean;
}
interface Bank {
  /** wave numbers of the noise: more means smaller banks */
  scale: number;
  /** share of the tile that is cloud (0..1) */
  cover: number;
  color: string;
  alpha: number;
  /** whole wavelengths the bank drifts in one loop (x, y) */
  drift: [number, number];
  /** scroll of the sheet in art pixels a second */
  scroll: [number, number];
}
type Kind = { particles: Particles } | { bank: Bank } | { bank: Bank; particles: Particles };

const KINDS: Record<string, Kind> = {
  embers: { particles: { n: 26, colors: ['#ff9a3a', '#ffd070', '#ff6a2a'], vx: 3, vy: -16, size: [1, 1], alpha: 1, sway: 3, twinkle: true } },
  ash: { particles: { n: 34, colors: ['#9a968e', '#6e6a66', '#b4b0a8'], vx: 4, vy: 10, size: [1, 2], alpha: 0.85, sway: 2 } },
  dust: { particles: { n: 46, colors: ['#d8c090', '#c8a870', '#e8d8b0'], vx: 18, vy: 2, size: [1, 1], alpha: 0.55, sway: 2 } },
  sand: { particles: { n: 60, colors: ['#e0c890', '#d0b078'], vx: 26, vy: 3, size: [1, 1], alpha: 0.6, sway: 1 } },
  leaves: { particles: { n: 16, colors: ['#d89a7a', '#e8c08a', '#c8783a', '#9aa050'], vx: 8, vy: 16, size: [2, 1], alpha: 1, sway: 5, leaf: true } },
  motes: { particles: { n: 30, colors: ['#c8f0ff', '#fff0c0', '#e0d8ff'], vx: 1, vy: -3, size: [1, 1], alpha: 1, sway: 3, twinkle: true } },
  fog: { bank: { scale: 3, cover: 0.42, color: '#dfe4e6', alpha: 0.36, drift: [1, 0], scroll: [5, 0] } },
  clouds: { bank: { scale: 2, cover: 0.38, color: '#ffffff', alpha: 0.55, drift: [1, 0], scroll: [5, 0] } },
  smoke: { bank: { scale: 3, cover: 0.28, color: '#6a6a70', alpha: 0.4, drift: [1, 0], scroll: [5, 0] } },
};

/** What the air of a town of this `ambient=` is made of: a loop, its blend (add for light, normal for the rest) or null when it is only sprites (gulls) or nothing. */
export function airScroll(ambient: string): [number, number] {
  const k = KINDS[ambient];
  if (!k) return [0, 0];
  return 'particles' in k ? [k.particles.vx, k.particles.vy] : [k.bank.scroll[0], k.bank.scroll[1]];
}

export function airKind(ambient: string): { blend: 'add' | 'normal' } | null {
  if (!KINDS[ambient]) return null;
  return { blend: ambient === 'embers' || ambient === 'motes' ? 'add' : 'normal' };
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The frames of the air loop of `ambient`, side by side in one sheet (AIR_FRAMES frames of AIR_SIDE × AIR_SIDE), or null. `colors` replaces the colours of the particles (leaves). */
export function airSheet(ambient: string, colors?: string[]): Frame | null {
  const kind = KINDS[ambient];
  if (!kind) return null;
  const S = AIR_SIDE, N = AIR_FRAMES, W = S * N;
  const data = new Uint8ClampedArray(W * S * 4);
  const put = (f: number, x: number, y: number, c: Rgb, a: number) => {
    const X = ((Math.round(x) % S) + S) % S, Y = ((Math.round(y) % S) + S) % S, i = (Y * W + f * S + X) * 4;
    if (a * 255 <= data[i + 3]) return;
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = Math.round(a * 255);
  };
  if ('bank' in kind) {
    const b = kind.bank, col = parse(b.color), r = rng(hashStr(ambient));
    // a sum of waves with whole wave numbers in x and y: periodic in the tile; the time term is a whole number of turns per loop
    const waves = Array.from({ length: 7 }, (_, i) => {
      let kx = Math.round(r() * b.scale) + 1, ky = Math.round((r() * 2 - 1) * b.scale);
      if (ky === 0) ky = i % 2 ? 1 : -1; // no wave of pure stripes
      return { kx, ky, ph: r() * Math.PI * 2, kt: i % 3 === 0 ? (r() < 0.5 ? 1 : -1) * b.drift[0] : 0, amp: 0.5 + r() * 0.5 };
    });
    const norm = waves.reduce((a, w) => a + w.amp, 0);
    for (let f = 0; f < N; f++)
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let v = 0;
          for (const w of waves) v += w.amp * Math.cos(((w.kx * x + w.ky * y) / S) * Math.PI * 2 + w.ph + (f / N) * w.kt * Math.PI * 2);
          v = v / norm * 0.5 + 0.5; // 0..1
          const edge = (v - (1 - b.cover)) * 5; // 0 at the rim of a bank, 1 inside
          if (edge <= 0) continue;
          if (Math.min(1, edge) > (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16) put(f, x, y, col, b.alpha);
        }
  }
  if ('particles' in kind) {
    const p = kind.particles, cols = (colors && colors.length && ambient === 'leaves' ? colors : p.colors).map(parse), r = rng(hashStr(ambient) ^ 0x9e37);
    for (let i = 0; i < p.n; i++) {
      const x0 = r() * S, y0 = r() * S, c = cols[Math.floor(r() * cols.length)], ph = r(), spd = 1 + Math.floor(r() * 2) * 0; // all go the whole loop distance
      const w = p.size[0], h = p.size[1];
      for (let f = 0; f < N; f++) {
        const t = f / N;
        const x = x0 + (p.sway ?? 0) * Math.sin((t + ph) * Math.PI * 2) * spd;
        const y = y0 + (p.sway ?? 0) * 0.5 * Math.cos((t + ph) * Math.PI * 2);
        const a = (p.twinkle ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((t * 2 + ph) * Math.PI * 2)) : 1) * p.alpha;
        for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) put(f, x + dx, y + dy, p.leaf && dx === 1 ? ([c[0] * 0.75, c[1] * 0.75, c[2] * 0.75] as Rgb) : c, a);
      }
    }
  }
  return { w: W, h: S, data };
}

/** Size of one frame of the smoke of a chimney, and the loop that is its column: puffs rise, widen, fade and thin out; the last frame leads into the first. */
export const SMOKE = { w: 12, h: 30, frames: 8, ms: 160 };

export function smokeSheet(color = '#4a484e'): Frame {
  const { w, h, frames: N } = SMOKE, W = w * N, data = new Uint8ClampedArray(W * h * 4);
  const c = parse(color);
  const put = (f: number, x: number, y: number, a: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h || a <= 0) return;
    const i = (y * W + f * w + x) * 4;
    if (a * 255 <= data[i + 3]) return;
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = Math.round(a * 255);
  };
  const PUFFS = 3;
  for (let f = 0; f < N; f++)
    for (let k = 0; k < PUFFS; k++) {
      const age = ((f / N + k / PUFFS) % 1); // 0 at the chimney, 1 at the top
      const cy = h - 3 - age * (h - 5), rad = 1 + age * 3.2, cx = w / 2 + Math.sin((age + k) * 5.1) * 1.6 * age;
      const a = (1 - age) * 0.8;
      for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++)
        for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d <= rad && (d < rad - 0.9 || BAYER4[(y & 3) * 4 + (x & 3)] / 16 < 0.6)) put(f, x, y, a);
        }
    }
  return { w: W, h, data };
}

/** A gull in flight, two wing positions (the sprite flaps between them): 7 × 4. */
export const GULL = { w: 7, h: 4, frames: 2 };
export function gullSheet(): Frame {
  const { w, h, frames: N } = GULL, W = w * N, data = new Uint8ClampedArray(W * h * 4);
  const put = (f: number, x: number, y: number, c: Rgb) => { const i = (y * W + f * w + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255; };
  const white: Rgb = [240, 240, 236], grey: Rgb = [150, 154, 160];
  // wings up (a V) and wings level (a flat bar)
  for (const [x, y] of [[0, 0], [1, 1], [2, 2], [3, 3], [4, 2], [5, 1], [6, 0]]) put(0, x, y, x === 3 ? grey : white);
  for (const [x, y] of [[0, 2], [1, 2], [2, 1], [3, 2], [4, 1], [5, 2], [6, 2]]) put(1, x, y, x === 3 ? grey : white);
  return { w: W, h, data };
}
