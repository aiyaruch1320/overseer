// Colour helpers of the map painters: hex strings in, numbers and CSS strings out.
import { clamp } from './noise';

export type RGB = [number, number, number];

const cache = new Map<string, RGB>();

export function rgb(hex: string): RGB {
  let c = cache.get(hex);
  if (!c) {
    const h = hex.replace('#', '');
    const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    const n = parseInt(f, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    cache.set(hex, c);
  }
  return c;
}

export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export const css = (c: RGB, a = 1): string => `rgba(${Math.round(clamp(c[0], 0, 255))},${Math.round(clamp(c[1], 0, 255))},${Math.round(clamp(c[2], 0, 255))},${a})`;

/** `mix('#aa0000', '#0000aa', 0.5)` as a CSS colour. */
export const mix = (a: string, b: string, t: number): string => hex(mixRGB(rgb(a), rgb(b), t));

/** Lighter (k > 0) or darker (k < 0) by k, as a hex colour. */
export const shade = (h: string, k: number): string => {
  const c = rgb(h);
  return hex(k >= 0 ? mixRGB(c, [255, 255, 255], k) : mixRGB(c, [0, 0, 0], -k));
};

export const luma = (c: RGB) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

export const hex = (c: RGB): string => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
