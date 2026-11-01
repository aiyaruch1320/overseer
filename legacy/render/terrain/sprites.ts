// Glyph sprites: each (symbol, size, variant) is rasterised from its vector paths at the exact device resolution of the
// current zoom bucket, then blitted 1:1. Thousands of symbols per frame stay cheap and stay sharp; when the zoom moves
// to a new bucket the few distinct sprites in view are simply re-rasterised (a few ms).
import { META, type GlyphFn } from './glyphs';

export interface Sprite { cv: HTMLCanvasElement; ox: number; oy: number; w: number; h: number } // ox, oy: anchor inside the sprite (device px)

const STEPS_PER_OCTAVE = 32;
export const VARIANTS = 6;

let nextId = 1;
const ids = new Map<GlyphFn, number>();
const idOf = (fn: GlyphFn) => { let i = ids.get(fn); if (!i) ids.set(fn, (i = nextId++)); return i; };

export class SpriteBank {
  private buckets = new Map<number, Map<string, Sprite>>();
  private order: number[] = [];

  /** snaps a device scale (px per MU) to its bucket; returns the bucket's exact scale */
  static bucket(scale: number): { key: number; ds: number } {
    const key = Math.round(Math.log2(scale) * STEPS_PER_OCTAVE);
    return { key, ds: 2 ** (key / STEPS_PER_OCTAVE) };
  }

  get(fn: GlyphFn, u: number, variant: number, key: number, ds: number): Sprite {
    let m = this.buckets.get(key);
    if (!m) {
      m = new Map(); this.buckets.set(key, m); this.order.push(key);
      while (this.order.length > 5) this.buckets.delete(this.order.shift()!);
    }
    const k = `${idOf(fn)}|${Math.round(u * 1000)}|${variant}`;
    let sp = m.get(k);
    if (!sp) { sp = this.make(fn, u, variant, ds); m.set(k, sp); }
    return sp;
  }

  private make(fn: GlyphFn, u: number, variant: number, ds: number): Sprite {
    const meta = META.get(fn)!;
    const [hw, up, down] = meta.box;
    const pad = 2;
    const w = Math.ceil(hw * 2 * u * ds) + pad * 2, h = Math.ceil((up + down) * u * ds) + pad * 2;
    const cv = document.createElement('canvas');
    cv.width = Math.max(2, w); cv.height = Math.max(2, h);
    const ox = Math.round(w / 2), oy = Math.round(up * u * ds) + pad;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(ds, 0, 0, ds, ox, oy);
    fn({ ctx, hair: 1 / ds, time: 0, pass: 0 }, 0, 0, u, (variant + 0.5) / VARIANTS);
    return { cv, ox, oy, w, h };
  }
}
