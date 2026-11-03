// A canvas that draws nothing but remembers what it was asked to draw, as a hash: enough to tell that two paintings are the same painting.
// (The tests run in node, which has no canvas; the painters take their canvas from a factory.)
import type { CanvasFactory, PaintCanvas } from '../../src/map/provider';

export interface FakeCanvas extends PaintCanvas {
  /** Hash of every call and every pixel written. */
  hash(): number;
  calls(): number;
  /** The last image data put on the canvas. */
  pixels(): Uint8ClampedArray | null;
}

export const fakeCanvas: CanvasFactory = (w, h) => {
  let hsh = 2166136261 >>> 0;
  let calls = 0;
  let last: Uint8ClampedArray | null = null;
  const eat = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      hsh ^= s.charCodeAt(i);
      hsh = Math.imul(hsh, 16777619) >>> 0;
    }
  };
  const fmt = (a: unknown): string => (typeof a === 'number' ? a.toFixed(3) : typeof a === 'object' && a !== null ? '{}' : String(a));
  const ctx: unknown = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'createImageData') return (cw: number, ch: number) => ({ width: cw, height: ch, data: new Uint8ClampedArray(cw * ch * 4) });
        if (prop === 'putImageData')
          return (im: { data: Uint8ClampedArray }) => {
            last = im.data;
            calls++;
            eat('put');
            let x = 0;
            for (let i = 0; i < im.data.length; i += 97) x = (Math.imul(x, 31) + im.data[i]) >>> 0;
            eat(String(x));
          };
        if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => ({ addColorStop: (o: number, c: string) => eat(`stop${o}${c}`) });
        return (...a: unknown[]) => {
          calls++;
          eat(prop + a.map(fmt).join(','));
        };
      },
      set(_t, prop: string, v: unknown) {
        eat(`${prop}=${fmt(v)}`);
        return true;
      },
    },
  );
  const c: FakeCanvas = {
    width: w,
    height: h,
    getContext: () => ctx as CanvasRenderingContext2D,
    hash: () => hsh,
    calls: () => calls,
    pixels: () => last,
  };
  return c;
};
