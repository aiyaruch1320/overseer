// The finishing grade of a painted place (M7 K5-7, K5-10): one pass over the finished layers, so that every pixel, whatever painted it (a sprite, a
// country's own roof colour, a literal), obeys the continent. Two things happen here:
//  - the climate of each continent in each of the four seasons (docs/appearance/01-continents.md "แสงและสี" and "พื้นและฟ้า"): sowing, rains,
//    harvest, winter, each a colour cast, a saturation and brightness move, and where the land has foliage a shift of the green;
//  - the saturation ceiling of a continent whose colour is held down by its doc (Nebulia §9: "ทุกสีลดความอิ่มลงหมด"), applied with or without a season.
// Pure: no DOM.
import type { Frame } from '../paint';
import type { Base } from './profiles';
import type { LayerName } from './types';
import { hex, lum, type Rgb } from './util';

/** One season's look: a cast laid over everything (keeping each pixel's own light and dark), the move of saturation and brightness, the shift of
 * green things, and an extra cast on the sky. */
export interface SeasonLook { tint: Rgb; tintAmt: number; sat: number; val: number; leaf: Rgb; leafAmt: number; sky: Rgb; skyAmt: number }
const L = (tint: string, tintAmt: number, sat: number, val: number, leaf: string, leafAmt: number, sky: string, skyAmt: number): SeasonLook =>
  ({ tint: hex(tint), tintAmt, sat, val, leaf: hex(leaf), leafAmt, sky: hex(sky), skyAmt });

/** The look of a season for a plain temperate land; each continent changes some of it. */
const PLAIN: SeasonLook[] = [
  L('#fff8d8', 0.06, 1.12, 1.04, '#9ad664', 0.34, '#d8ecff', 0.08), // sowing: fresh and light, young green
  L('#5c6a7c', 0.2, 0.82, 0.84, '#285448', 0.3, '#4e5a68', 0.3), // rains: dark, wet, slate
  L('#ffc478', 0.13, 1.06, 1.0, '#d69838', 0.6, '#ffd8a0', 0.16), // harvest: warm, the green gone to straw and amber
  L('#b0bed6', 0.24, 0.6, 1.04, '#8a9a98', 0.55, '#c0d0e8', 0.26), // winter: cold, pale, the green drained
];

type Over = Partial<SeasonLook>;
const h = hex;
/** What each continent changes (its climate in the doc). A missing entry keeps the plain look. */
const CLIMATE: Record<Base, Over[]> = {
  // dry blue heights: little green to shift, so the sky and the light carry the seasons
  AZ: [{ skyAmt: 0.14 }, { tintAmt: 0.16, val: 0.88, skyAmt: 0.34 }, { tint: h('#ffd890'), tintAmt: 0.16 }, { tint: h('#a8c0e8'), tintAmt: 0.28, skyAmt: 0.32 }],
  // straw and ash: the rains turn the dust to mud, the winter to ash grey
  MH: [{ tint: h('#e8d890'), tintAmt: 0.1 }, { tint: h('#4c4a46'), tintAmt: 0.22, val: 0.8 }, { tint: h('#ff9a58'), tintAmt: 0.16 }, { tint: h('#a8aab4'), tintAmt: 0.28, sat: 0.5 }],
  // the fire land: no green and no snow; the rain falls as ash, the forge runs hot in the harvest and cool in the winter
  KD: [{ tintAmt: 0.06, sat: 1.08, val: 1.04 }, { tint: h('#6a6460'), tintAmt: 0.32, sat: 0.62, val: 0.8, skyAmt: 0.32 }, { tint: h('#ff8a3a'), tintAmt: 0.2, sat: 1.18, val: 1.08, sky: h('#ffa060'), skyAmt: 0.2 }, { tint: h('#98a8c4'), tintAmt: 0.3, sat: 0.55, val: 0.96, sky: h('#a0b0c8'), skyAmt: 0.3 }],
  // the sea: teal in the sowing, grey rain in bands, warm salt light in the harvest, a cold grey sea in the winter
  NR: [{ tint: h('#d0fff0'), tintAmt: 0.1, sat: 1.18 }, { tint: h('#546470'), tintAmt: 0.24, val: 0.82 }, { tint: h('#ffd49a'), tintAmt: 0.16 }, { tint: h('#a8bcd0'), tintAmt: 0.3, sat: 0.5 }],
  // the plain: the strongest change of green and gold (the fields)
  AL: [{ leafAmt: 0.4 }, { leafAmt: 0.34 }, { leaf: h('#e0a838'), leafAmt: 0.7, tintAmt: 0.16 }, {}],
  // smoke and brass: the rains rust the town, the harvest burnishes it, the winter blues the smoke
  MK: [{ tint: h('#f0f0c0'), tintAmt: 0.08 }, { tint: h('#5a4c40'), tintAmt: 0.22, val: 0.8 }, { tint: h('#ffb860'), tintAmt: 0.17 }, { tint: h('#a0b0cc'), tintAmt: 0.28 }],
  // the desert: a short violet storm, deep gold light in the harvest, a cold violet shade in the winter
  SH: [{ tint: h('#fff0c8'), tintAmt: 0.1, sat: 1.1 }, { tint: h('#5c5478'), tintAmt: 0.24, val: 0.84, sky: h('#4c4868'), skyAmt: 0.34 }, { tint: h('#ffb450'), tintAmt: 0.17, sat: 1.12 }, { tint: h('#9ca0d0'), tintAmt: 0.26, sat: 0.62, sky: h('#a8b0d8'), skyAmt: 0.3 }],
  // the forest: bright young leaf, deep wet green, leaf-gold in the harvest, frost blue (น้ำค้าง ฟ้าน้ำแข็ง) in the winter
  SV: [{ leaf: h('#a8e070'), leafAmt: 0.4 }, { leaf: h('#1c4838'), leafAmt: 0.38 }, { leaf: h('#d8a838'), leafAmt: 0.62 }, { leaf: h('#a0c0cc'), leafAmt: 0.62, tint: h('#a8c0d8'), tintAmt: 0.26 }],
  // the fog land: the same seasons, held down; the light of the fog moves more than the colours
  NB: [{ tint: h('#fffcf0'), tintAmt: 0.1, val: 1.06 }, { tint: h('#4c5662'), tintAmt: 0.22, val: 0.8 }, { tint: h('#f0d8b0'), tintAmt: 0.16 }, { tint: h('#dce4f0'), tintAmt: 0.3, val: 1.06 }],
};

export const lookOf = (base: Base, season: number): SeasonLook => ({ ...PLAIN[season], ...(CLIMATE[base][season] ?? {}) });

/** The ceiling of colour of a continent: HSV saturation shrunk by `k` and never above `cap`, the lightness of each pixel kept. */
export interface Ceiling { k: number; cap: number }
const CEILING: Partial<Record<Base, Ceiling>> = {
  // Nebulia §9: "ทุกสีลดความอิ่มลงหมด" (grey, milk white, pale lamp gold, wine red, dusty violet; none of them bright)
  NB: { k: 0.5, cap: 0.34 },
};
export const ceilingOf = (base: Base): Ceiling | undefined => CEILING[base];

const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);
/** Cast `c` toward `target` while keeping the pixel's own luminance (a grade, not a paint-over). */
function cast(c: Rgb, target: Rgb, amt: number): Rgb {
  const t = lum(target) || 1, f = lum(c) / t;
  return [c[0] + (clamp(target[0] * f) - c[0]) * amt, c[1] + (clamp(target[1] * f) - c[1]) * amt, c[2] + (clamp(target[2] * f) - c[2]) * amt];
}

/** The saturation ceiling at one pixel (HSV: the highest channel is kept, the gaps below it are shrunk together so the hue stays). */
export function capSat(c: Rgb, ce: Ceiling): Rgb {
  const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]);
  if (mx === 0 || mx === mn) return c;
  const s = (mx - mn) / mx, s2 = Math.min(s * ce.k, ce.cap), f = s2 / s;
  return [mx - (mx - c[0]) * f, mx - (mx - c[1]) * f, mx - (mx - c[2]) * f];
}

/** Grade the finished frame of a layer in place. `season` undefined leaves the season alone (the ceiling still applies). */
export function finish(f: Frame, name: LayerName, base: Base, season: number | undefined, withSeason: boolean): void {
  const ce = ceilingOf(base), look = season !== undefined && withSeason ? lookOf(base, season) : undefined;
  if (!ce && !look) return;
  const d = f.data, n = f.w * f.h;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (!d[i + 3]) continue;
    let c: Rgb = [d[i], d[i + 1], d[i + 2]];
    if (look) {
      const gw = Math.max(0, Math.min(1, (c[1] - Math.max(c[0], c[2]) + 4) / 36));
      if (gw > 0) c = cast(c, look.leaf, look.leafAmt * gw);
      if (name === 'sky') c = cast(c, look.sky, look.skyAmt);
      c = cast(c, look.tint, look.tintAmt);
      const l = lum(c) * 255;
      c = [(l + (c[0] - l) * look.sat) * look.val, (l + (c[1] - l) * look.sat) * look.val, (l + (c[2] - l) * look.sat) * look.val];
    }
    if (ce) c = capSat([clamp(c[0]), clamp(c[1]), clamp(c[2])], ce);
    d[i] = clamp(Math.round(c[0])); d[i + 1] = clamp(Math.round(c[1])); d[i + 2] = clamp(Math.round(c[2]));
  }
}

/** The light of a place in a season (the stage tints characters with it): the same cast as the pixels get. */
export function seasonLight(light: string, base: Base, season: number | undefined): string {
  if (season === undefined) return light;
  const k = lookOf(base, season), c = cast(hex(light), k.tint, k.tintAmt), l = lum(c) * 255;
  const o = [0, 1, 2].map((q) => clamp(Math.round((l + (c[q] - l) * k.sat) * k.val)).toString(16).padStart(2, '0'));
  return `#${o.join('')}`;
}

/**
 * The dark of a place (docs/appearance/13 §2: the cellar of the dark elves, the room under the castle; 20 §7.3: the last night of a meteor): the layer is dimmed and cast blue-violet,
 * and the bright things in it (lamps, windows, fire) are kept so they read as light. `night` is the dark under the sky: the sky layer also gets stars.
 */
export function darken(f: Frame, name: LayerName, mood: 'dark' | 'night', seed: number): void {
  const d = f.data, n = f.w * f.h;
  const base = mood === 'dark' ? 0.42 : 0.5;
  const cool: Rgb = mood === 'dark' ? hex('#1c1838') : hex('#141c42');
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (!d[i + 3]) continue;
    const c: Rgb = [d[i], d[i + 1], d[i + 2]];
    const l = lum(c);
    // what is bright and warm (a flame, a lit window) stays lit
    const keep = Math.max(0, Math.min(1, (l - 0.62) / 0.3)) * (name === 'sky' ? 0.2 : 0.9);
    const v = base + (1 - base) * keep;
    const k = 0.32 * (1 - keep);
    d[i] = clamp(Math.round((c[0] + (cool[0] - c[0]) * k) * v));
    d[i + 1] = clamp(Math.round((c[1] + (cool[1] - c[1]) * k) * v));
    d[i + 2] = clamp(Math.round((c[2] + (cool[2] - c[2]) * k) * v));
  }
  if (mood === 'night' && name === 'sky') {
    let s = (seed * 2654435761 + 12345) >>> 0;
    const rnd = (): number => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let q = 0; q < 70; q++) {
      const x = Math.floor(rnd() * f.w), y = Math.floor(rnd() * rnd() * 96), i = (y * f.w + x) * 4;
      if (!d[i + 3] || lum([d[i], d[i + 1], d[i + 2]]) > 0.42) continue;
      const a = 0.5 + rnd() * 0.5;
      d[i] = Math.round(d[i] + (236 - d[i]) * a); d[i + 1] = Math.round(d[i + 1] + (234 - d[i + 1]) * a); d[i + 2] = Math.round(d[i + 2] + (250 - d[i + 2]) * a);
    }
  }
}
