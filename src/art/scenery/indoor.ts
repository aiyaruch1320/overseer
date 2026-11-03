// An indoor scene: the back wall (sky layer, still), the posts and hangings nearer to it (far), the furniture (mid), and the floor (ground).
// Each continent builds with its own material, from the doc's palette: limestone and gold (AZ), hide and bone (MH), basalt and a furnace (KD),
// pale planks and nets (NR), plaster and timber (AL), brick pipes and runes (MK), adobe and rugs (SH), living wood (SV), old stone and drapes (NB).
import type { Frame } from '../paint';
import type { Ctx } from './ctx';
import { FAR_W, GND_W, GY, H, MID_W, W, place } from './ctx';
import { halo, hash2 } from './draw';
import type { Painter } from './outdoor-a';
import { barrel, crate, gear, sprite as drawSprite, tree } from './sprites';

/** Furniture is drawn this much larger than the drawing (the people are 28 high). */
const FURN = 1.45;
const sprite = (w: number, h: number, draw: Parameters<typeof drawSprite>[2]) => drawSprite(w, h, draw, FURN);
import { bayer, dark, hex, light, mix, Pix, rng, toHex, type Rgb } from './util';

const CEIL = 12;
const FLOOR = GY;

function inside(cx: Ctx) {
  const I = cx.P.inside, g = cx.g;
  let wall = hex(I.wall), wall2 = hex(I.wall2);
  const m = cx.country?.mats;
  if (m?.[0]) { wall = mix(wall, hex(m[0]), 0.28); wall2 = mix(wall2, dark(hex(m[0]), 0.3), 0.28); }
  const accent = cx.country?.roofs[0] ? mix(hex(I.accent), hex(cx.country.roofs[0]), 0.35) : hex(I.accent);
  return { wall: g.c(wall, 'man'), wall2: g.c(wall2, 'man'), floor: g.c(I.floor, 'man'), floor2: g.c(I.floor2, 'man'), beam: g.c(I.beam, 'man'), accent: g.c(accent, 'man'), lamp: hex(I.lamp) };
}
type In = ReturnType<typeof inside>;

/** Darken the ceiling and the far corners of a wall so the room has depth. */
function vignette(px: Pix, w: number): void {
  for (let y = 0; y < FLOOR; y++) for (let x = 0; x < w; x++) {
    const top = y < 30 ? (1 - y / 30) * 0.6 : 0, side = Math.max(0, Math.abs(x - w / 2) / (w / 2) - 0.6) * 0.9;
    const k = Math.min(0.75, top + side);
    if (bayer(x, y) < k) px.set(x, y, [10, 10, 20], 90 + Math.round(k * 120));
  }
}

function window(px: Pix, x: number, y: number, w: number, h: number, sky: Rgb[], round: boolean, frame: Rgb): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = (i + 0.5) / w * 2 - 1, v = (j + 0.5) / h;
    if (round && u * u + ((v - 0.5) * 2) ** 2 > 1) continue;
    const t = j / h * (sky.length - 1), k = Math.min(sky.length - 2, Math.floor(t));
    px.set(x + i, y + j, t - k > bayer(x + i, y + j) ? sky[k + 1] : sky[k]);
  }
  for (let i = -1; i <= w; i++) { px.set(x + i, y - 1, frame); px.set(x + i, y + h, frame); }
  for (let j = -1; j <= h; j++) { px.set(x - 1, y + j, frame); px.set(x + w, y + j, frame); }
  px.rect(x + (w >> 1), y, 1, h, frame); px.rect(x, y + (h >> 1), w, 1, frame);
}

function lightShaft(px: Pix, x0: number, y0: number, w: number, slope: number, c: Rgb, a = 0.22): void {
  for (let y = y0; y < FLOOR; y++) for (let x = Math.round(x0 + (y - y0) * slope); x < x0 + (y - y0) * slope + w; x++) if (bayer(x, y) < a) px.set(x, y, c, 70);
}

function blocks(px: Pix, I: In, bw: number, bh: number, y0: number, y1: number): void {
  for (let y = y0; y < y1; y++) for (let x = 0; x < px.w; x++) {
    const row = Math.floor((y - y0) / bh), off = row & 1 ? bw / 2 : 0, jx = (x + off) % bw, jy = (y - y0) % bh;
    px.set(x, y, jy === bh - 1 || jx === bw - 1 ? I.wall2 : jy === 0 ? light(I.wall, 0.1) : hash2(Math.floor((x + off) / bw), row, 3) < 0.25 ? mix(I.wall, I.wall2, 0.25) : I.wall);
  }
}

// ── the back wall ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function backWall(cx: Ctx, I: In): Frame {
  const px = new Pix(W, H), g = cx.g, b = cx.P.base, r = rng(cx.seed + 700);
  const lamp = I.lamp;
  switch (b) {
    case 'AZ': {
      blocks(px, I, 40, 16, 0, FLOOR);
      px.rect(0, 22, W, 3, I.beam); px.rect(0, 25, W, 1, dark(I.beam, 0.3)); px.rect(0, 128, W, 2, I.beam);
      for (const x of [58, 222]) { window(px, x, 40, 34, 78, ['#3d78c4', '#6a9ad8', '#a8c6e8', '#dce8f0'].map((h) => hex(h)), false, I.beam); lightShaft(px, x + 4, 44, 26, 0.55, hex('#fff0c8'), 0.2); }
      for (const x of [146, 178]) { px.rect(x, 26, 14, 72, I.accent); for (let y = 26; y < 98; y++) px.set(x + 7, y, light(I.accent, 0.15)); px.rect(x, 98, 14, 2, I.beam); for (let k = 0; k < 7; k++) px.set(x + k * 2, 100, I.beam); px.rect(x + 5, 40, 4, 4, I.beam); }
      break;
    }
    case 'MH': {
      for (let x = 0; x < W; x++) for (let y = 0; y < FLOOR; y++) { const s = Math.floor(x / 22), edge = Math.abs(x - 160) / 160, drape = y < 10 + edge * 40; px.set(x, y, drape ? dark(I.wall2, 0.3) : s % 2 ? mix(I.wall, I.accent, 0.55) : I.wall); if (x % 22 === 0 && !drape) px.set(x, y, dark(I.wall2, 0.3)); }
      for (let x = 0; x < W; x++) for (let y = 12; y < 20; y++) if (bayer(x, y) < 0.3) px.set(x, y, dark(I.wall2, 0.4));
      for (let k = 0; k < 9; k++) { const a = -Math.PI * (0.1 + 0.8 * k / 8); for (let s = 14; s < 150; s += 1) px.set(160 + Math.cos(a) * s * 1.1, 8 + Math.sin(a) * -s * 0.7 + s * 0.45, hex('#c8c0a0')); }
      px.rect(158, 6, 4, FLOOR - 6, hex('#c8c0a0')); px.rect(158, 6, 1, FLOOR - 6, hex('#e8e0c8')); px.rect(161, 6, 1, FLOOR - 6, hex('#8a8068'));
      halo(px, 250, 126, 70, hex('#ffb060'), 0.8);
      break;
    }
    case 'KD': {
      blocks(px, I, 28, 14, 0, FLOOR);
      for (const y of [38, 98]) { px.rect(0, y, W, 5, I.beam); px.rect(0, y + 5, W, 1, dark(I.beam, 0.5)); for (let x = 4; x < W; x += 16) px.set(x, y + 2, light(I.beam, 0.3)); }
      px.rect(196, 70, 80, 74, hex('#1a1214')); px.rect(204, 78, 64, 66, hex('#e0662a')); px.rect(212, 90, 48, 54, hex('#f0a830')); px.rect(220, 104, 32, 40, hex('#fff0a0'));
      halo(px, 236, 110, 90, hex('#e0662a'), 1.1);
      for (const x of [60, 112]) for (let y = 0; y < 60; y += 3) { px.set(x, y, I.beam); px.set(x + 1, y + 1, dark(I.beam, 0.3)); }
      break;
    }
    case 'NR': {
      for (let y = 0; y < FLOOR; y++) for (let x = 0; x < W; x++) { const row = Math.floor(y / 8); px.set(x, y, y % 8 === 7 ? I.wall2 : hash2(Math.floor((x + row * 41) / 60), row, 3) < 0.3 && (x + row * 41) % 60 === 0 ? I.wall2 : hash2(x >> 3, y, 4) < 0.1 ? mix(I.wall, I.wall2, 0.4) : I.wall); }
      const sea = ['#7aa0a0', '#5a8a90', '#3a7a78', '#2a6460'].map((h) => hex(h));
      for (let j = -22; j <= 22; j++) for (let i = -22; i <= 22; i++) if (i * i + j * j <= 22 * 22) { const t = (j + 22) / 44 * 3, k = Math.min(2, Math.floor(t)); px.set(80 + i, 70 + j, j < -6 ? hex('#dce4e6') : t - k > bayer(i, j) ? sea[k + 1] : sea[k]); }
      for (let a = 0; a < 64; a++) { px.set(80 + Math.cos(a / 10.2) * 23, 70 + Math.sin(a / 10.2) * 23, I.beam); px.set(80 + Math.cos(a / 10.2) * 24, 70 + Math.sin(a / 10.2) * 24, dark(I.beam, 0.4)); }
      for (let i = 0; i < 6; i++) px.set(70 + i * 3, 74 + (i & 1), hex('#f0f6f6'));
      for (let y = 18; y < 96; y++) for (let x = 170; x < 306; x++) if (((x + y) % 9 === 0 || (x - y + 400) % 9 === 0) && bayer(x, y) < 0.8 - (y - 18) / 140) px.set(x, y, hex('#8a7a58'), 200);
      break;
    }
    case 'AL': {
      for (let y = 0; y < FLOOR; y++) for (let x = 0; x < W; x++) px.set(x, y, bayer(x, y) < 0.06 ? mix(I.wall, I.wall2, 0.4) : I.wall);
      for (let x = 20; x < W; x += 76) { px.rect(x, 10, 6, FLOOR - 10, I.beam); px.rect(x, 10, 1, FLOOR - 10, light(I.beam, 0.15)); }
      for (const y of [22, 104]) px.rect(0, y, W, 5, I.beam);
      for (let k = 0; k < 4; k++) px.line(26 + k * 76, 104, 26 + k * 76 + 30, 28, I.beam);
      window(px, 118, 40, 44, 48, ['#8abae6', '#b0d2ee', '#7ab05a', '#5a9a48'].map((h) => hex(h)), false, I.beam);
      px.rect(236, 60, 70, 84, hex('#8a8c92')); px.rect(246, 90, 50, 54, hex('#1a1214')); px.rect(252, 112, 38, 32, hex('#e0662a')); px.rect(258, 122, 26, 22, hex('#f0a830'));
      halo(px, 270, 124, 64, hex('#ffb060'), 0.9);
      break;
    }
    case 'MK': {
      for (let y = 0; y < FLOOR; y++) for (let x = 0; x < W; x++) { const row = y >> 2, off = row & 1 ? 5 : 0, jy = y % 4, jx = (x + off) % 10; px.set(x, y, jy === 3 || jx === 9 ? I.wall2 : hash2((x + off) / 10 | 0, row, 3) < 0.25 ? mix(I.wall, I.wall2, 0.3) : I.wall); }
      for (const [y, c] of [[28, I.beam], [37, mix(I.beam, hex('#c08a3a'), 0.6)]] as [number, Rgb][]) for (let x = 0; x < W; x++) { px.set(x, y, light(c, 0.2)); px.set(x, y + 1, c); px.set(x, y + 2, c); px.set(x, y + 3, dark(c, 0.4)); if (x % 24 === 0) px.rect(x, y - 1, 3, 6, dark(c, 0.3)); }
      for (let y = 40; y < FLOOR; y++) { px.set(34, y, light(I.beam, 0.2)); px.set(35, y, I.beam); px.set(36, y, I.beam); px.set(37, y, dark(I.beam, 0.4)); }
      px.disc(92, 74, 11, I.beam); px.disc(92, 74, 9, hex('#e8e4d0')); px.line(92, 74, 98, 70, hex('#a02a22')); for (let k = 0; k < 9; k++) px.set(92 + Math.cos(-2.4 + k * 0.6) * 8, 74 + Math.sin(-2.4 + k * 0.6) * 8, hex('#1a1814'));
      px.rect(196, 52, 54, 42, hex('#2a2e38')); px.rect(199, 55, 48, 36, hex('#6ad0ff')); for (let y = 58; y < 90; y += 6) px.rect(203, y, 40, 1, hex('#e8fbff'));
      halo(px, 223, 73, 60, hex('#6ad0ff'), 0.9);
      break;
    }
    case 'SH': {
      for (let y = 0; y < FLOOR; y++) for (let x = 0; x < W; x++) px.set(x, y, bayer(x + 1, y) < 0.08 ? I.wall2 : bayer(x, y + 2) < 0.12 ? light(I.wall, 0.08) : I.wall);
      for (let x = 6; x < W; x += 22) { px.disc(x + 4, 16, 4, hex('#5a3a30')); px.disc(x + 3, 15, 2, hex('#7a5a46')); }
      px.rect(0, 22, W, 2, dark(I.wall, 0.15));
      for (let j = 0; j < 36; j++) for (let i = -14; i <= 14; i++) if ((j > 14 || i * i + (j - 14) ** 2 * 1.2 < 196)) px.set(55 + i, 70 + j, hex('#3a2a2a'));
     
      px.rect(150, 30, 8, 72, hex('#ffd890')); halo(px, 154, 60, 40, hex('#ffd890'), 0.6);
      lightShaft(px, 150, 100, 10, 0.5, hex('#ffe0a0'), 0.25);
      for (let y = 30; y < 100; y++) for (let x = 204; x < 274; x++) { const s = Math.floor((y - 30) / 8) % 3; px.set(x, y, hash2(x >> 1, y >> 2, 2) < 0.1 ? dark(I.accent, 0.2) : s === 0 ? I.accent : s === 1 ? hex('#e8d4a8') : hex('#3a5a8a')); }
      for (let x = 204; x < 274; x += 3) { px.set(x, 100, I.accent); px.set(x, 101, I.accent); px.set(x, 102, dark(I.accent, 0.2)); }
      break;
    }
    case 'SV': {
      for (let y = 0; y < FLOOR; y++) for (let x = 0; x < W; x++) { const s = hash2(x >> 1, 0, 8); px.set(x, y, bayer(x, y) < 0.15 + s * 0.15 ? I.wall2 : (x + (y >> 3)) % 7 === 0 ? light(I.wall, 0.08) : I.wall); }
      for (let i = 0; i < 6; i++) { let x = r() * W, y = 0; const dx = (r() - 0.5) * 0.8; for (; y < FLOOR; y++) { x += dx + Math.sin(y * 0.08 + i) * 0.5; px.set(x, y, hex('#3a2a1c')); px.set(x + 1, y, hex('#5a4030')); } }
      for (let j = -24; j <= 24; j++) for (let i = -24; i <= 24; i++) if (i * i + j * j <= 576) px.set(232 + i, 72 + j, Math.abs(i) + Math.abs(j) < 40 && (i + j) % 7 ? (bayer(i, j) < 0.5 ? hex('#5a9a5a') : hex('#9ac078')) : hex('#2a5a30'));
      for (let a = 0; a < 100; a++) px.set(232 + Math.cos(a * 0.0628) * 25, 72 + Math.sin(a * 0.0628) * 25, I.wall2);
      lightShaft(px, 205, 90, 40, 0.15, hex('#c8e8a0'), 0.18);
      for (let i = 0; i < 9; i++) { const x = 20 + i * 34 + (hash2(i, 1, 4) * 12 | 0), y = 100 + (hash2(i, 2, 4) * 30 | 0); px.rect(x, y, 3, 3, i % 2 ? hex('#8a5a8a') : hex('#9ad0a0')); halo(px, x + 1, y + 1, 9, i % 2 ? hex('#8a5a8a') : hex('#9ad0a0'), 0.8); }
      break;
    }
    case 'NB': default: {
      blocks(px, I, 36, 18, 0, FLOOR);
      for (const x of [68, 216]) { window(px, x, 22, 12, 94, ['#f0eee8', '#dcdcd8', '#c0c0c4'].map((h) => hex(h)), false, I.wall2); lightShaft(px, x, 30, 12, 0.7, hex('#f4f2ee'), 0.22); }
      for (let x = 128; x < 164; x++) for (let y = 12; y < 118; y++) px.set(x, y, (x - 128) % 7 < 2 ? dark(I.accent, 0.35) : (x - 128) % 7 === 5 ? light(I.accent, 0.1) : I.accent);
      px.rect(124, 10, 44, 3, hex('#2a2a32'));
      halo(px, 296, 60, 26, lamp, 0.9); px.rect(295, 56, 3, 6, hex('#e8c878'));
      break;
    }
  }
  vignette(px, W);
  // the skirting where wall meets floor
  px.rect(0, FLOOR - 4, W, 4, dark(I.wall2, 0.5)); px.rect(0, FLOOR - 4, W, 1, dark(I.wall2, 0.2));
  void g; void toHex;
  return px.frame();
}

// ── posts and hangings nearer the wall ───────────────────────────────────────────────────────────────────────────────────────────────
function column(px: Pix, x: number, w: number, top: number, bottom: number, body: Rgb, litc: Rgb, shade: Rgb, cap: Rgb): void {
  for (let y = top; y < bottom; y++) for (let i = 0; i < w; i++) px.set(x + i, y, i < 2 ? litc : i >= w - 3 ? shade : i >= w - 5 && bayer(x + i, y) < 0.5 ? shade : body);
  px.rect(x - 2, top, w + 4, 4, cap); px.rect(x - 2, top + 4, w + 4, 1, dark(cap, 0.4));
  px.rect(x - 2, bottom - 4, w + 4, 4, cap); px.rect(x - 2, bottom - 5, w + 4, 1, light(cap, 0.2));
}

function farWall(cx: Ctx, I: In): Frame {
  const px = new Pix(FAR_W, H, true), b = cx.P.base, r = cx.rand(710);
  const body: Record<string, [Rgb, Rgb]> = { AZ: [hex('#e8e8ec'), hex('#c9a24a')], MH: [hex('#c8c0a0'), hex('#8a8068')], KD: [hex('#5a6270'), hex('#8a90a0')], NR: [I.wall, I.beam], AL: [I.beam, dark(I.beam, 0.3)], MK: [hex('#6a7482'), I.beam], SH: [I.wall, I.wall2], SV: [hex('#6a4a34'), hex('#3a2a1c')], NB: [hex('#8a8e96'), hex('#50545a')] };
  const [bc, cc] = body[b] ?? body.NB;
  const tall = b === 'MH' || b === 'AL' || b === 'NR' ? 8 : 14;
  for (let i = 0; i < 4; i++) {
    const x = 20 + i * 160 + Math.round(r() * 30);
    column(px, x, tall, CEIL, FLOOR + 4, bc, light(bc, 0.22), dark(bc, 0.3), cc);
    if (b === 'KD' || b === 'MK') for (let y = CEIL + 10; y < FLOOR; y += 14) { px.set(x + 2, y, light(bc, 0.4)); px.set(x + tall - 3, y, light(bc, 0.4)); }
    if (b === 'SV') for (let y = CEIL; y < FLOOR; y += 4) px.set(x + 1 + ((y * 7) % (tall - 2)), y, light(bc, 0.2));
  }
  // lamps hung from the ceiling between the posts
  for (let i = 0; i < 4; i++) {
    const x = 100 + i * 160 + Math.round(r() * 20), y = 56 + Math.round(r() * 14), lp = I.lamp;
    for (let k = CEIL; k < y; k++) px.set(x, k, dark(I.beam, 0.2));
    px.rect(x - 3, y, 7, 8, I.beam); px.rect(x - 2, y + 1, 5, 6, lp); halo(px, x, y + 4, 26, lp, 1);
  }
  return px.frame();
}

// ── furniture ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const table = (wood: string, w = 44): Frame => sprite(w, 24, (p) => { const T = p.mat(wood), L = p.mat(toHex(dark(hex(wood), 0.25))); p.rect(0, 8, w, 4, T); p.rect(2, 12, 3, 12, L); p.rect(w - 5, 12, 3, 12, L); });
const bench = (wood: string, w = 36): Frame => sprite(w, 14, (p) => { const T = p.mat(wood); p.rect(0, 5, w, 3, T); p.rect(3, 8, 2, 6, T); p.rect(w - 5, 8, 2, 6, T); });
const brazier = (): Frame => sprite(20, 28, (p) => { const I = p.mat('#2a2e38'), F = p.mat('#e0662a', { flat: true }), F2 = p.mat('#f0a830', { flat: true }); p.poly([[2, 12], [18, 12], [14, 18], [6, 18]], I); p.line([8, 18], [5, 28], I); p.line([12, 18], [15, 28], I); p.poly([[10, 2], [16, 12], [4, 12]], F); p.poly([[10, 6], [13, 12], [7, 12]], F2); });
const anvil = (): Frame => sprite(30, 24, (p) => { const A = p.mat('#4a4e58'), S = p.mat('#5a3e28'); p.rect(8, 14, 14, 10, S); p.rect(2, 8, 26, 6, A); p.poly([[28, 8], [30, 10], [28, 13]], A); p.rect(10, 13, 10, 2, A); });
const pot = (clay: string): Frame => sprite(14, 18, (p) => { const C = p.mat(clay, { deep: true }); p.ell(7, 11, 6, 7, C); p.rect(4, 2, 6, 4, C); p.rect(3, 4, 8, 2, C); });
const cushions = (a: string, b: string): Frame => sprite(32, 12, (p) => { p.ell(9, 8, 9, 4, p.mat(a, { deep: true })); p.ell(22, 8, 9, 4, p.mat(b, { deep: true })); });
const candle = (): Frame => sprite(8, 34, (p) => { const M = p.mat('#c8b070'), F = p.mat('#ffd878', { flat: true }); p.rect(3, 12, 2, 22, M); p.rect(1, 32, 6, 2, M); p.rect(3, 8, 2, 4, p.mat('#e8e4d0')); p.rect(3, 5, 2, 3, F); });
const machine = (accent: string): Frame => sprite(34, 36, (p) => { const B = p.mat('#4a5262', { deep: true }), P = p.mat('#8a94a4'), G = p.mat(accent, { flat: true }); p.rect(2, 8, 30, 28, B); p.rect(0, 6, 34, 3, P); p.rect(6, 12, 22, 8, G); p.rect(6, 24, 8, 8, P); p.rect(20, 24, 8, 8, P); p.rect(14, 0, 3, 8, P); });
const rack = (): Frame => sprite(30, 34, (p) => { const W = p.mat('#5a3e28'), M = p.mat('#9aa0ac'); p.rect(0, 0, 2, 34, W); p.rect(28, 0, 2, 34, W); p.rect(0, 12, 30, 2, W); for (let i = 0; i < 4; i++) p.line([5 + i * 6, 2], [6 + i * 6, 33], M); });
const chair = (wood: string): Frame => sprite(14, 22, (p) => { const W = p.mat(wood); p.rect(0, 0, 3, 22, W); p.rect(0, 11, 13, 3, W); p.rect(10, 14, 3, 8, W); });
const hammock = (): Frame => sprite(40, 26, (p) => { const N = p.mat('#8a7a58'); for (let x = 0; x < 40; x++) p.px(x, 6 + Math.round(Math.sin((x / 40) * Math.PI) * 10), N); p.rect(0, 0, 2, 26, p.mat('#5a4028')); p.rect(38, 0, 2, 26, p.mat('#5a4028')); });

function furniture(cx: Ctx, I: In): Frame {
  const px = new Pix(MID_W, H, true), b = cx.P.base, r = cx.rand(720), w = (h: string): string => toHex(cx.g.c(h, 'man'));
  const wood = b === 'NB' ? '#4a3e38' : b === 'MH' ? '#4a3a2a' : b === 'SH' ? '#6a4a34' : b === 'NR' ? '#8a7a5c' : '#7a5a38';
  const lights: [number, number][] = [];
  const put = (f: Frame, x: number, y = 150): void => place(px, f, x, y);
  let x = 30 + Math.round(r() * 20);
  while (x < MID_W - 40) {
    const k = Math.floor(r() * 6);
    switch (b) {
      case 'AZ': if (k < 2) { put(cx.spr('azbr', brazier), x, 148); lights.push([x, 134]); } else if (k < 4) { put(cx.spr('aztb', () => table('#d8d4cc')), x); put(cx.spr('azpt', () => pot('#e8e4d8')), x - 10, 138); } else put(cx.spr('azbn', () => bench('#cfcac0')), x); break;
      case 'MH': if (k < 2) { put(cx.spr('mhbr', brazier), x, 148); lights.push([x, 134]); } else if (k < 4) put(cx.spr('mhra', rack), x); else put(cx.spr('mhcr', () => crate(w('#6a4a2a'), 16 + (k % 2) * 5)), x, 150); break;
      case 'KD': if (k < 2) { put(cx.spr('kdan', anvil), x); } else if (k < 4) { put(cx.spr('kdbr', brazier), x, 148); lights.push([x, 134]); } else put(cx.spr('kdra', rack), x); break;
      case 'NR': if (k < 2) put(cx.spr('nrba', () => barrel(w('#8a6a44'), 22)), x); else if (k < 4) put(cx.spr('nrcr', () => crate(w('#9a7a54'), 18)), x); else if (k < 5) put(cx.spr('nrha', hammock), x); else put(cx.spr('nrtb', () => table(w('#8a7a5c'))), x); break;
      case 'AL': if (k < 3) { put(cx.spr('altb', () => table(w('#7a5a38'), 48)), x); put(cx.spr('albn', () => bench(w('#6a4a2e'))), x + 4, 152); } else if (k < 5) put(cx.spr('alba', () => barrel(w('#8a6a44'), 22)), x); else put(cx.spr('alch', () => chair(w('#6a4a2e'))), x); break;
      case 'MK': if (k < 3) put(cx.spr('mkmc', () => machine('#6ad0ff')), x); else if (k < 4) put(cx.spr('mkge', () => gear('#5a6272', 16, 10)), x, 152); else put(cx.spr('mkcr', () => crate(w('#6a5a4a'), 18)), x); break;
      case 'SH': if (k < 2) put(cx.spr('shpt', () => pot(w('#b86a3a'))), x); else if (k < 4) put(cx.spr('shcu', () => cushions(w('#b04a2a'), w('#3a5a8a'))), x, 152); else put(cx.spr('shtb', () => table(w('#6a4a34'), 34)), x); break;
      case 'SV': if (k < 3) put(cx.spr('svmu', () => tree('mushroom', '#8a5a8a', '#d8d0c0', 22 + (k % 2) * 6)), x, 152); else put(cx.spr('svtb', () => table(w('#5a4030'), 38)), x); if (k < 3) lights.push([x, 144]); break;
      case 'NB': default: if (k < 3) { put(cx.spr('nbtb', () => table(w('#4a3e38'), 60)), x); put(cx.spr('nbcd', candle), x - 12, 140); lights.push([x - 12, 114]); } else put(cx.spr('nbch', () => chair(w('#4a3e38'))), x); break;
    }
    x += 70 + Math.round(r() * 90);
  }
  for (const [lx, ly] of lights) halo(px, lx, ly, 22, hex(b === 'KD' || b === 'MH' ? '#ffb060' : toHex(I.lamp)), 0.9);
  return px.frame();
}

// ── the floor ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function floor(cx: Ctx, I: In): Frame {
  const px = new Pix(GND_W, H, true), b = cx.P.base, r = cx.rand(730);
  const seams: number[] = [];
  for (let y = FLOOR, d = 3; y < H; y += d, d += 1) seams.push(y);
  for (let y = FLOOR; y < H; y++) {
    const si = seams.findIndex((s) => s > y) - 1, row = si < 0 ? seams.length - 1 : si, rowH = (seams[row + 1] ?? H) - seams[row], tw = 18 + (y - FLOOR) * 0.9;
    for (let x = 0; x < GND_W; x++) {
      const seam = y === seams[row];
      let c = I.floor;
      const off = row & 1 ? tw / 2 : 0, col = Math.floor((x + off) / tw), jx = (x + off) % tw < 1, cell = hash2(col, row, 11);
      switch (b) {
        case 'AZ': c = seam || jx ? hex('#8a8e9e') : (col + row) & 1 ? I.floor : light(I.floor, 0.08); if (seam && row % 3 === 1) c = I.beam; break;
        case 'MH': c = hash2(x >> 1, y, 5) < 0.12 ? I.floor2 : cell < 0.2 ? mix(I.floor, hex('#8a6a4a'), 0.5) : I.floor; if (rowH > 99) c = I.floor; break;
        case 'KD': c = seam || jx ? dark(I.floor2, 0.4) : cell < 0.15 ? mix(I.floor, hex('#d86a2a'), 0.12) : bayer(x, y) < 0.1 ? I.floor2 : I.floor; if ((x % 20 === 3 || x % 20 === 16) && y === seams[row] + 1) c = hex('#6a727e'); break;
        case 'NR': case 'AL': c = seam ? I.floor2 : (x + row * 53) % 70 === 0 ? I.floor2 : cell < 0.2 && (x + y) % 11 === 0 ? I.floor2 : bayer(x, y) < 0.08 ? light(I.floor, 0.1) : I.floor; break;
        case 'MK': c = seam || jx ? dark(I.floor2, 0.3) : (x % 12 === 2 && (y - seams[row]) === 1) ? hex('#9aa4b4') : bayer(x, y) < 0.14 ? I.floor2 : I.floor; if (row % 2 === 1 && (x % 6 < 3)) c = mix(c, [0, 0, 0], 0.2); break;
        case 'SH': c = hash2(x >> 1, y, 4) < 0.07 ? I.floor2 : cell < 0.1 ? light(I.floor, 0.06) : I.floor; if (seam && row % 2 === 0) c = mix(I.floor, I.floor2, 0.4); break;
        case 'SV': c = bayer(x, y) < 0.3 + cell * 0.3 ? I.floor2 : I.floor; if (cell < 0.12 && hash2(x, y, 3) < 0.5) c = hex('#6a9a4a'); break;
        case 'NB': default: c = seam || jx ? dark(I.floor2, 0.45) : cell < 0.5 ? mix(I.floor, I.floor2, 0.4) : I.floor; if (hash2(x, y, 1) < 0.03) c = light(c, 0.1); break;
      }
      px.set(x, y, c);
    }
  }
  // a rug under the feet where there is one
  const rugs: Record<string, [string, string]> = { AZ: ['#3d78c4', '#c9a24a'], MH: ['#6a2a22', '#c8c0a0'], KD: ['#5a2a22', '#8a90a0'], NR: ['#2f7a6a', '#e8e8f0'], AL: ['#8a3a2a', '#e0c060'], MK: ['#6a3a2a', '#c08a3a'], SH: ['#b04a2a', '#3a5a8a'], SV: ['#4a7a3a', '#8a5a8a'], NB: ['#7a1a2a', '#d8b060'] };
  const [rc, rb] = rugs[b] ?? rugs.NB;
  for (let i = 0; i < 4; i++) {
    const x0 = 40 + i * 300 + Math.round(r() * 60), w = 120 + Math.round(r() * 60), y0 = 150, h = 18;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const edge = x < x0 + 3 || x >= x0 + w - 3 || y < y0 + 2 || y >= y0 + h - 2, band = (x - x0) % 24 < 3 || (x - x0) % 24 > 20;
      px.set(x, y, edge ? cx.g.c(rb, 'man') : band ? mix(cx.g.c(rc, 'man'), cx.g.c(rb, 'man'), 0.5) : cx.g.c(rc, 'man'));
    }
    for (let x = x0; x < x0 + w; x += 2) { px.set(x, y0 - 1, cx.g.c(rb, 'man')); px.set(x, y0 + h, cx.g.c(rb, 'man')); }
  }
  return px.frame();
}

export function indoorPainter(cx: Ctx): Painter {
  const I = inside(cx);
  return {
    sky: () => backWall(cx, I),
    far: () => farWall(cx, I),
    mid: () => furniture(cx, I),
    ground: () => floor(cx, I),
  };
}
