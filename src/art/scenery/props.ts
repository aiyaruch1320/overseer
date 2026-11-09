// The props of a scene (M7 ข1): the things a script names that the painted place does not have (the craft table of a rite, the anvil of a dwarf, the roots of the world tree,
// the pearl egg of the sky nest, the eternal flame, the rim of a cliff, the people who watch). One painter per prop, flat pixel art in the art contract's way
// (docs/appearance/21-pixel-art.md: flat materials, four tones, a dark outline), drawn into ONE transparent layer as wide as the ground, so they follow the camera
// with the ground and stand behind the figures. A prop is named `kind` or `kind:#colour` (the colour is a tint the docs name: the purple of a dark-elf candle).
// Pure and deterministic: the same list and seed give the same pixels.
import type { Frame } from '../paint';
import { GND_W, H, W } from './ctx';
import { dark, hex, light, mix, rng, type Rgb, Pix } from './util';

/** The props the painter knows (the mapping from the words of a script is src/scene/props.ts). */
export const PROP_KINDS = ['worktable', 'anvil', 'roots', 'egg', 'flame', 'campfire', 'cliff', 'spectators', 'obelisk', 'scales', 'candle', 'cup', 'blossoms', 'stone', 'longtable', 'pearl', 'grave'] as const;
export type PropKind = (typeof PROP_KINDS)[number];

/** Where a prop stands, as a share of the stage's width (the figures stand at 0.34 · 0.5 · 0.66). */
const AT: Record<PropKind, number> = { worktable: 0.5, anvil: 0.62, roots: 0.5, egg: 0.5, flame: 0.12, campfire: 0.5, cliff: 0.86, spectators: 0.5, obelisk: 0.64, scales: 0.64, candle: 0.7, cup: 0.66, blossoms: 0.5, stone: 0.66, longtable: 0.5, pearl: 0.66, grave: 0.5 };
/** The row the feet of a figure stand on: a prop stands on it too. */
const BASE = 150;
const OUT: Rgb = [20, 18, 26];

interface Pal { o: Rgb; a: Rgb; b: Rgb; c: Rgb; d: Rgb }
/** Four tones of a colour (light to shadow) and the outline. */
const tones = (c: Rgb): Pal => ({ o: OUT, a: light(c, 0.35), b: c, c: dark(c, 0.3), d: dark(c, 0.55) });
const glow = (px: Pix, cx: number, cy: number, r: number, c: Rgb, a: number): void => {
  for (let k = 3; k >= 1; k--) px.disc(cx, cy, r * (k / 3), c, Math.round((a / 3) * (4 - k) * 0.5));
};
/** A box with a lit top edge and a dark base: the shape of most props. */
function box(px: Pix, x: number, y: number, w: number, h: number, p: Pal): void {
  px.rect(x - 1, y - 1, w + 2, h + 2, p.o);
  px.rect(x, y, w, h, p.b);
  px.rect(x, y, w, 1, p.a);
  px.rect(x, y + h - 2, w, 2, p.c);
  px.rect(x + w - 1, y, 1, h, p.c);
}
const FLAME: Rgb[] = [[200, 70, 30], [236, 130, 40], [250, 200, 80], [255, 240, 190]];
/** A tongue of fire: the point is at the top, the foot is at (x, y). */
function fire(px: Pix, x: number, y: number, w: number, h: number, seed: number, cols: Rgb[] = FLAME): void {
  const r = rng(seed);
  for (let k = 0; k < cols.length; k++) {
    const hw = Math.max(1, Math.round((w / 2) * (1 - k * 0.24)));
    const hh = Math.round(h * (1 - k * 0.2));
    for (let j = 0; j < hh; j++) {
      const t = j / hh;
      const half = Math.max(0, Math.round(hw * Math.sin(Math.PI * Math.min(1, t * 0.85 + 0.15)) * (1 - t * 0.5)));
      const sway = Math.round(Math.sin(t * 5 + seed) * 1.2 * t + (r() - 0.5) * 0.6);
      px.rect(x - half + sway, y - j, half * 2 + 1, 1, cols[k]);
    }
  }
}

const PAINT: Record<PropKind, (px: Pix, x: number, c: Rgb | undefined, seed: number) => void> = {
  /** A craft bench with tools on it: the hand of a child touches it (human rite), the pen and the paper (a demon's), the white of an operating table (a hybrid's). */
  worktable(px, x, c) {
    const wood = tones(c ?? [132, 94, 58]);
    const w = 52;
    px.rect(x - w / 2 - 1, BASE - 22, w + 2, 6, wood.o);
    px.rect(x - w / 2, BASE - 21, w, 4, wood.b);
    px.rect(x - w / 2, BASE - 21, w, 1, wood.a);
    px.rect(x - w / 2, BASE - 18, w, 1, wood.c);
    for (const lx of [x - w / 2 + 3, x + w / 2 - 6]) { px.rect(lx - 1, BASE - 16, 5, 17, wood.o); px.rect(lx, BASE - 16, 3, 16, wood.c); px.rect(lx, BASE - 16, 1, 16, wood.b); }
    px.rect(x - w / 2 + 4, BASE - 25, 9, 3, [150, 154, 164]);
    px.rect(x - w / 2 + 4, BASE - 25, 9, 1, [200, 204, 214]);
    px.rect(x - 4, BASE - 29, 2, 8, [88, 64, 40]);
    px.rect(x - 6, BASE - 31, 6, 2, [120, 124, 134]);
    px.rect(x + 10, BASE - 24, 8, 3, [214, 196, 150]);
  },
  /** An anvil three times the child: the face, the horn, the waist and a block under it, a spark of orange on the face. */
  anvil(px, x) {
    const s = tones([84, 90, 104]);
    box(px, x - 11, BASE - 12, 22, 12, tones([92, 80, 70]));
    px.rect(x - 6, BASE - 24, 12, 12, s.o);
    px.rect(x - 5, BASE - 24, 10, 12, s.c);
    px.rect(x - 5, BASE - 24, 2, 12, s.b);
    px.rect(x - 22, BASE - 36, 44, 13, s.o);
    px.rect(x - 21, BASE - 35, 42, 11, s.b);
    px.rect(x - 21, BASE - 35, 42, 3, s.a);
    px.rect(x - 21, BASE - 26, 42, 2, s.c);
    // the horn narrows to a point at the right
    for (let k = 0; k < 9; k++) { px.rect(x + 22 + k, BASE - 35 + Math.floor(k / 2), 1, 6 - Math.floor(k * 0.55), k === 0 ? s.a : s.b); }
    px.rect(x - 12, BASE - 36, 8, 2, [240, 150, 60]);
    px.rect(x - 10, BASE - 37, 4, 1, [255, 220, 130]);
  },
  /** A strip of the trunk of the world tree on the left and its roots running across the ground in green and gold. */
  roots(px, x, c, seed) {
    const bark = tones([72, 62, 44]);
    const green: Rgb = c ?? [92, 150, 80];
    const gold: Rgb = [226, 190, 96];
    px.rect(x - 150, 0, 34, BASE - 6, bark.o);
    px.rect(x - 149, 0, 32, BASE - 6, bark.b);
    for (let y = 0; y < BASE - 6; y += 3) px.rect(x - 149 + ((y * 7) % 11), y, 2, 3, bark.c);
    px.rect(x - 149, 0, 4, BASE - 6, bark.a);
    const r = rng(seed + 11);
    for (let i = 0; i < 6; i++) {
      let yy = BASE - 8 + i * 0.5, xx = x - 130;
      const th = i < 3 ? 3 : 2;
      const sl = 0.05 + r() * 0.25;
      for (let k = 0; k < 190; k++) {
        xx += 1;
        yy += Math.sin(k * 0.12 + i * 1.7) * 0.5 + sl * (k < 30 ? -0.4 : 0.2);
        const yi = Math.round(Math.min(BASE + 1, Math.max(BASE - 14, yy)));
        px.rect(xx, yi - 1, 1, th + 2, bark.o);
      }
      xx = x - 130; yy = BASE - 8 + i * 0.5;
      for (let k = 0; k < 190; k++) {
        xx += 1;
        yy += Math.sin(k * 0.12 + i * 1.7) * 0.5 + sl * (k < 30 ? -0.4 : 0.2);
        const yi = Math.round(Math.min(BASE + 1, Math.max(BASE - 14, yy)));
        px.rect(xx, yi, 1, th, k % 17 < 3 ? gold : green);
      }
    }
    for (let i = 0; i < 14; i++) px.set(x - 120 + Math.round(r() * 220), BASE - 12 - Math.round(r() * 30), gold, 220);
  },
  /** The pearl egg the size of a house in a nest of twigs: warm rings of light, a lit side, a shadow side. */
  egg(px, x, _c, seed) {
    const cy = BASE - 38;
    // the glow of a pearl: rings of pale rose, mint and gold round it
    glow(px, x, cy, 62, [255, 226, 236], 80);
    glow(px, x, cy, 44, [214, 255, 238], 70);
    glow(px, x, cy, 30, [255, 244, 190], 70);
    const r = rng(seed + 3);
    // the egg: pearl, lit from the left, with bands of rose, mint and lilac that slide over it
    const pale: Rgb[] = [[255, 252, 244], [250, 226, 236], [214, 244, 232], [226, 218, 250]];
    for (let y = -28; y <= 28; y++) {
      const t = y / 28;
      const half = Math.round(22 * Math.sqrt(1 - t * t) * (1 + (y > 0 ? 0 : 0.1 * -t)));
      for (let dx = -half - 1; dx <= half + 1; dx++) {
        const edge = Math.abs(dx) > half;
        const u = dx / Math.max(1, half);
        const band = pale[((Math.floor((dx + y * 0.6 + 40) / 5) % 4) + 4) % 4];
        const shade = u < -0.3 ? 1 : u < 0.3 ? 0.9 : 0.74;
        const c: Rgb = [band[0] * shade, band[1] * shade, Math.min(255, band[2] * shade + (u > 0.3 ? 10 : 0))];
        px.set(x + dx, cy + y, edge ? [104, 84, 120] : c);
      }
    }
    px.rect(x - 13, cy - 19, 5, 2, [255, 255, 255]);
    px.rect(x - 16, cy - 15, 2, 3, [255, 255, 255]);
    // the nest: a wide bowl of woven twigs on the floating rock, dark outline, lit rim, the egg sunk in it
    for (let row = 0; row < 12; row++) {
      const half = Math.round(50 - Math.pow(1 - row / 12, 1.5) * 8 + Math.sin(row * 1.3) * 1.5);
      const y = BASE - 12 + row;
      px.rect(x - half - 1, y, half * 2 + 3, 1, OUT);
      for (let xx = -half; xx <= half; xx++) {
        const w = (xx * 3 + row * 5 + Math.floor(r() * 3)) % 7;
        px.set(x + xx, y, row < 2 ? [168, 128, 80] : w < 2 ? [64, 46, 32] : w < 4 ? [112, 82, 52] : [136, 100, 62]);
      }
    }
    for (let i = 0; i < 26; i++) {
      const tx = x - 54 + r() * 108;
      px.line(tx, BASE - 12 - r() * 3, tx + (r() - 0.5) * 14, BASE - 14 - r() * 4, [150, 112, 70]);
    }
    // the nest is high on the edge of a sky island: pale rock hangs under it, and a bank of cloud lies below and round it, so it reads as in the sky
    const rock: Rgb = [138, 154, 188];
    for (let row = 0; row < 34; row++) {
      const half = Math.round(48 * Math.pow(1 - row / 34, 0.8) + Math.sin(row * 1.7) * 1.2);
      const y = BASE + row;
      px.rect(x - half - 1, y, half * 2 + 3, 1, OUT);
      px.rect(x - half, y, half * 2 + 1, 1, row % 6 === 5 ? dark(rock, 0.3) : rock);
      px.rect(x - half, y, Math.max(1, Math.round(half * 0.35)), 1, light(rock, 0.3));
      px.rect(x + Math.round(half * 0.5), y, Math.max(1, Math.round(half * 0.5)) + 1, 1, dark(rock, 0.25));
    }
    for (let i = 0; i < 40; i++) {
      const cx = x - 150 + r() * 300, cy = BASE + 6 + r() * 26, cr = 7 + r() * 9;
      if (Math.abs(cx - x) < 20 && cy < BASE + 22) continue;
      px.disc(cx, cy + 2, cr, [196, 208, 232], 235);
      px.disc(cx, cy, cr, [244, 247, 255], 240);
    }
  },
  /** The eternal flame: a stone brazier on a pillar with a tall flame and a pool of orange light. */
  flame(px, x, _c, seed) {
    glow(px, x, BASE - 46, 44, [255, 150, 60], 60);
    box(px, x - 6, BASE - 26, 12, 26, tones([128, 124, 120]));
    box(px, x - 10, BASE - 32, 20, 7, tones([110, 106, 104]));
    px.rect(x - 8, BASE - 34, 16, 2, [60, 56, 56]);
    fire(px, x, BASE - 34, 14, 26, seed);
  },
  /** A fire of logs and stones. */
  campfire(px, x, _c, seed) {
    glow(px, x, BASE - 14, 38, [255, 150, 60], 55);
    for (let i = -3; i <= 3; i++) px.rect(x + i * 6 - 2, BASE - 3 + (Math.abs(i) > 1 ? 1 : 0), 5, 4, tones([110, 108, 104]).b);
    px.line(x - 14, BASE - 3, x + 12, BASE - 9, [84, 58, 36]);
    px.line(x + 14, BASE - 3, x - 12, BASE - 9, [102, 72, 44]);
    fire(px, x, BASE - 7, 12, 22, seed);
  },
  /** The rim of a cliff: the ground ends in a broken edge and below it is the drop, dark rock and mist. */
  cliff(px, x, _c, seed) {
    const r = rng(seed + 5);
    const from = x - 4;
    let edge = BASE - 5;
    // the rock: the ground ends in a broken lip with a sheer face of warm stone; past it is the drop, open air in dithered blue and mist (never a flat box)
    for (let xx = from; xx < from + 240; xx++) {
      const gap = xx - from;
      if (gap < 28 && r() < 0.4) edge += r() < 0.5 ? 1 : -1;
      edge = Math.max(BASE - 8, Math.min(BASE + 1, edge));
      const faceEnd = gap < 6 ? H : Math.max(edge + 2, Math.round(H - (gap - 6) * 4.2 - (r() < 0.3 ? 2 : 0)));
      for (let y = edge; y < H; y++) {
        if (gap < 30 && y < faceEnd) {
          const t = Math.min(1, (y - edge) / 34);
          const rock = mix([138, 120, 100], [70, 62, 62], t);
          px.set(xx, y, gap < 3 || y === edge ? OUT : y === edge + 1 ? [176, 158, 130] : (xx + y) % 9 === 0 ? dark(rock, 0.25) : rock);
        } else {
          const t = (y - 120) / 60;
          const sky = mix([150, 176, 214], [232, 236, 246], Math.min(1, Math.max(0, t)));
          px.set(xx, y, (xx * 7 + y * 3) % 11 === 0 ? [248, 250, 255] : sky);
        }
      }
    }
    // a wing feather stuck in the rock at the rim (13 §3: the feather in the stone at the edge)
    const fx = from + 8, fy = edge - 1;
    px.rect(fx, fy - 14, 1, 14, [236, 230, 214]);
    for (let k = 0; k < 6; k++) { px.set(fx - 1, fy - 12 + k * 2, [214, 208, 192]); px.set(fx + 1, fy - 11 + k * 2, [250, 246, 234]); }
    for (let k = 0; k < 14; k++) px.rect(from + 40 + Math.round(r() * 190), 168 + Math.round(r() * 10), 14 + Math.round(r() * 22), 2, [246, 248, 255], 150);
  },
  /** A row of people standing along the rim, still: cloaks in the muted colours of the place, small heads. */
  spectators(px, x, c, seed) {
    const r = rng(seed + 7);
    const cloaks: Rgb[] = [[74, 66, 84], [92, 70, 62], [60, 74, 88], [86, 84, 70], [110, 88, 72]];
    for (let i = 0; i < 14; i++) {
      const left = i < 7;
      const px0 = left ? x - 150 + i * 15 + Math.round(r() * 3) : x + 70 + (i - 7) * 15 + Math.round(r() * 3);
      const base = BASE - 5 - (i % 3);
      const cloak = c ?? cloaks[i % cloaks.length];
      const h = 14 + (i % 4);
      const top = base - h;
      // a head, then a cloak that widens from the shoulders to the hem, with a lit edge and an outline
      for (let y = 0; y < h; y++) {
        const half = y < 5 ? 2 : 2 + Math.floor((y - 5) / 3);
        px.rect(px0 - half - 1, top + y, half * 2 + 3, 1, OUT);
      }
      // the Aviyan: a folded wing stands up behind the shoulder (scale red or feather white), so a spectator reads as winged
      const wing: Rgb = i % 3 === 0 ? [168, 66, 54] : i % 3 === 1 ? [226, 222, 212] : [96, 120, 172];
      // both wings spread out from the shoulders, each a feathered blade that rises above the head and a darker underside, so the row reads as winged
      for (const side of [-1, 1]) {
        for (let y = 0; y < h + 2; y++) {
          const wy = y / (h + 1), ww = Math.max(1, Math.round(1 + Math.sin(Math.min(1, wy * 1.05) * Math.PI) * 4.2));
          const wx = px0 + side * (3 + Math.floor(wy * 2));
          const x0 = side < 0 ? wx - ww : wx;
          px.rect(x0 - 1, top - 3 + y, ww + 2, 1, OUT);
        }
        for (let y = 0; y < h + 2; y++) {
          const wy = y / (h + 1), ww = Math.max(1, Math.round(1 + Math.sin(Math.min(1, wy * 1.05) * Math.PI) * 4.2));
          const wx = px0 + side * (3 + Math.floor(wy * 2));
          px.rect(side < 0 ? wx - ww : wx, top - 3 + y, ww, 1, y % 3 === 0 ? light(wing, 0.35) : wy > 0.6 ? dark(wing, 0.2) : wing);
        }
      }
      px.disc(px0 + 0.5, top + 2.5, 2.4, [214, 178, 146]);
      px.set(px0 - 1, top + 2, [40, 30, 30]); px.set(px0 + 2, top + 2, [40, 30, 30]);
      for (let y = 5; y < h; y++) {
        const half = 2 + Math.floor((y - 5) / 3);
        px.rect(px0 - half, top + y, half * 2 + 1, 1, cloak);
        px.rect(px0 - half, top + y, 1, 1, light(cloak, 0.25));
        px.rect(px0 + half, top + y, 1, 1, dark(cloak, 0.3));
      }
      px.rect(px0 - 2, top, 5, 2, dark(cloak, 0.35));
    }
  },
  /** A standing stone with runes: green jade light flows down it (the naga's test). */
  obelisk(px, x, c) {
    const jade: Rgb = c ?? [96, 220, 160];
    glow(px, x, BASE - 36, 40, jade, 45);
    px.rect(x - 11, BASE - 78, 22, 78, OUT);
    for (let y = 0; y < 76; y++) {
      const half = 9 - Math.floor(y / 30);
      px.rect(x - half, BASE - 77 + y, half * 2, 1, y < 2 ? [150, 156, 160] : [86, 92, 100]);
      px.rect(x - half, BASE - 77 + y, 2, 1, [116, 124, 132]);
    }
    for (let i = 0; i < 8; i++) px.rect(x - 4 + (i % 2) * 5, BASE - 70 + i * 8, 3, 1, jade);
    px.rect(x - 1, BASE - 70, 1, 64, jade, 180);
  },
  /** The great gold scale of the weighing of the heart: a heart glowing green in one pan, a feather in the other. */
  scales(px, x) {
    const gold: Rgb = [214, 176, 70];
    glow(px, x, BASE - 52, 42, [140, 230, 150], 35);
    px.rect(x - 1, BASE - 72, 3, 72, OUT);
    px.rect(x, BASE - 72, 1, 72, gold);
    box(px, x - 8, BASE - 5, 17, 5, tones(gold));
    px.rect(x - 30, BASE - 70, 61, 3, OUT);
    px.rect(x - 29, BASE - 69, 59, 1, gold);
    for (const s of [-1, 1]) {
      const px0 = x + s * 28;
      px.line(px0, BASE - 69, px0 - 8, BASE - 40, OUT);
      px.line(px0, BASE - 69, px0 + 8, BASE - 40, OUT);
      px.rect(px0 - 11, BASE - 40, 23, 3, OUT);
      px.rect(px0 - 10, BASE - 39, 21, 1, gold);
    }
    px.rect(x - 34, BASE - 46, 7, 6, [60, 220, 120]);
    px.rect(x - 33, BASE - 47, 5, 1, [120, 255, 170]);
    px.line(x + 26, BASE - 41, x + 33, BASE - 50, [250, 248, 236]);
  },
  /** One candle on an iron stick, the flame the colour the docs give (the purple of the dark elves). */
  candle(px, x, c) {
    const f: Rgb = c ?? [208, 150, 240];
    glow(px, x, BASE - 38, 40, f, 50);
    px.rect(x - 1, BASE - 24, 3, 24, OUT);
    px.rect(x, BASE - 24, 1, 24, [70, 66, 76]);
    px.rect(x - 6, BASE - 2, 13, 3, OUT);
    px.rect(x - 5, BASE - 2, 11, 2, [70, 66, 76]);
    box(px, x - 3, BASE - 34, 7, 10, tones([226, 220, 206]));
    fire(px, x + 1, BASE - 35, 4, 8, 3, [mix(f, [0, 0, 0], 0.3), f, light(f, 0.4), [255, 250, 255]]);
  },
  /** A black stone block with a cup of blood on it. */
  cup(px, x, c) {
    const blood: Rgb = c ?? [170, 28, 40];
    box(px, x - 16, BASE - 14, 32, 14, tones([48, 46, 56]));
    px.rect(x - 5, BASE - 26, 11, 2, OUT);
    px.rect(x - 4, BASE - 25, 9, 8, [180, 170, 120]);
    px.rect(x - 4, BASE - 25, 9, 2, blood);
    px.rect(x - 1, BASE - 17, 3, 4, [150, 140, 100]);
    px.set(x - 3, BASE - 24, [240, 120, 120]);
  },
  /** A ring of buds on the ground of a clearing (the naming of the fae) with a little light round each. */
  blossoms(px, x, c, seed) {
    const bud: Rgb = c ?? [226, 168, 206];
    const r = rng(seed + 9);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const bx = Math.round(x + Math.cos(a) * 62), by = Math.round(BASE - 3 + Math.sin(a) * 6);
      const h = 7 + Math.round(r() * 5);
      glow(px, bx, by - h, 8, bud, 40);
      px.rect(bx, by - h, 1, h, [70, 128, 80]);
      px.rect(bx - 2, by - h - 3, 5, 4, OUT);
      px.rect(bx - 1, by - h - 3, 3, 3, bud);
      px.rect(bx - 1, by - h - 3, 1, 1, light(bud, 0.5));
    }
  },
  /** A rock the size of a house, with a flat face the giant carves a name into. */
  stone(px, x) {
    const s = tones([118, 112, 106]);
    for (let y = 0; y < 52; y++) {
      const half = Math.round(30 * Math.sqrt(Math.max(0, 1 - ((y - 26) / 28) ** 2)) + (y > 40 ? 4 : 0));
      px.rect(x - half - 1, BASE - 52 + y, half * 2 + 2, 1, OUT);
      px.rect(x - half, BASE - 52 + y, half * 2, 1, y < 6 ? s.a : s.b);
      px.rect(x + half - 8, BASE - 52 + y, 8, 1, s.c);
    }
    for (let i = 0; i < 5; i++) px.rect(x - 14 + i * 6, BASE - 32, 3, 8 - (i % 2) * 2, s.d);
  },
  /** One long table the width of the room with a plate and a candle at every place. */
  longtable(px, x) {
    const wood = tones([140, 98, 60]);
    px.rect(x - 130, BASE - 22, 260, 7, OUT);
    px.rect(x - 129, BASE - 21, 258, 5, wood.b);
    px.rect(x - 129, BASE - 21, 258, 1, wood.a);
    px.rect(x - 129, BASE - 16, 258, 1, wood.c);
    for (const lx of [x - 124, x - 42, x + 40, x + 120]) px.rect(lx, BASE - 15, 4, 15, wood.c);
    for (let i = 0; i < 12; i++) {
      const tx = x - 122 + i * 22;
      px.rect(tx, BASE - 24, 8, 2, [236, 230, 214]);
      if (i % 3 === 1) {
        px.rect(tx + 14, BASE - 32, 3, 8, [240, 232, 200]);
        fire(px, tx + 15, BASE - 32, 3, 5, i, [[210, 120, 40], [250, 190, 70], [255, 240, 170], [255, 250, 220]]);
      }
    }
  },
  /** A single pearl rising on a thread of light. */
  pearl(px, x) {
    glow(px, x, BASE - 52, 22, [200, 236, 255], 70);
    px.rect(x - 1, BASE - 40, 1, 40, [200, 236, 255], 90);
    px.disc(x, BASE - 52, 5, OUT);
    px.disc(x, BASE - 52, 4, [244, 244, 250]);
    px.rect(x - 2, BASE - 55, 2, 2, [255, 255, 255]);
  },
  /** A mound with a plain marker. */
  grave(px, x) {
    const earth = tones([104, 86, 66]);
    for (let y = 0; y < 8; y++) px.rect(x - 22 + y * 2, BASE - 8 + y, 44 - y * 4, 1, y < 2 ? earth.a : earth.b);
    box(px, x - 3, BASE - 30, 7, 24, tones([150, 146, 140]));
  },
};

/** The layer of props: the named props painted on a transparent frame as wide as the ground. Empty list: nothing (the caller skips the layer). */
export function paintProps(props: readonly string[], seed: number): Frame | null {
  const list = props.map((s) => { const [k, c] = s.split(':'); return { k: k as PropKind, c: c && /^#[0-9a-f]{6}$/i.test(c) ? hex(c) : undefined }; }).filter((p) => p.k in PAINT);
  if (!list.length) return null;
  const px = new Pix(GND_W, H, true);
  const ox = (GND_W - W) / 2;
  // far things first: the cliff and the spectators behind, the big props over them
  const order: PropKind[] = ['cliff', 'spectators', 'roots', 'egg', 'stone', 'longtable'];
  const rank = (k: PropKind): number => (order.includes(k) ? order.indexOf(k) : 99);
  list.sort((a, b) => rank(a.k) - rank(b.k));
  for (const p of list) PAINT[p.k](px, Math.round(ox + AT[p.k] * W), p.c, seed);
  return px.frame();
}
