// Colour helpers of the map sprites (houses, trees, centres, icons): hex in, hex out. Pure, no DOM.
export type Rgb = [number, number, number];

export function parse(hex: string): Rgb {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const n = parseInt(f, 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [255, 0, 255];
}

const to2 = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
export const toHex = (c: Rgb): string => `#${to2(c[0])}${to2(c[1])}${to2(c[2])}`;

export function mixHex(a: string, b: string, t: number): string {
  const A = parse(a), B = parse(b);
  return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** Lighter (k > 0) or darker (k < 0) by k. */
export const shadeHex = (h: string, k: number): string => mixHex(h, k >= 0 ? '#ffffff' : '#000000', Math.abs(k));

/** Small deterministic hash of a string to 0..1 steps (for variants). */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}
