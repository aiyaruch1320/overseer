// The heart of a town that is known for one great thing: where other towns keep a square, these keep that thing. A holy city has a minster
// taller than every roof, a rich one a cluster of towers, a land at war a citadel, a land of scholars an academy, a trading land its bazaar,
// a land of duels its arena, a land of the dead its tomb. Which one is read from the country's own text (src/city/flavor.ts heartOf).
import { type Pen, hex, shadeC, mixC } from './draw';
import type { CityData } from './citygen';
import { dais, banner, flame, glow } from './landmarks';

type Draw = (p: Pen, d: CityData, px: number, py: number) => void;
export type Heart = 'minster' | 'towers' | 'citadel' | 'academy' | 'bazaar' | 'arena' | 'tomb';

/** the ground each heart takes: base ellipse (px), and the tall part above it */
export const HEART_FOOT: Record<Heart, { rx: number; ry: number; up: number; upW: number }> = {
  minster: { rx: 92, ry: 30, up: 176, upW: 130 }, towers: { rx: 84, ry: 26, up: 192, upW: 150 }, citadel: { rx: 94, ry: 32, up: 120, upW: 170 },
  academy: { rx: 90, ry: 28, up: 126, upW: 160 }, bazaar: { rx: 90, ry: 38, up: 70, upW: 130 }, arena: { rx: 96, ry: 42, up: 50, upW: 170 }, tomb: { rx: 84, ry: 32, up: 100, upW: 110 },
};

const stepsFront = (p: Pen, px: number, py: number, w: number, c: number, n = 4) => { for (let k = 0; k < n; k++) { p.fill(shadeC(c, 0.8 - k * 0.04), px - w / 2 - k * 4, py - 2 + k * 3, w + k * 8, 3); p.fill(shadeC(c, 1.08), px - w / 2 - k * 4, py - 3 + k * 3, w + k * 8, 1); } };
const crenel = (p: Pen, x: number, y: number, w: number, c: number) => { for (let i = 0; i < w; i += 6) { p.fill(shadeC(c, 0.8), x + i, y - 5, 4, 5); p.fill(shadeC(c, 1.1), x + i, y - 5, 4, 1); } };
const win = (p: Pen, x: number, y: number, w: number, h: number, lit: boolean) => { p.fill(0x2a2a34, x - 1, y - 1, w + 2, h + 2); p.fill(lit ? 0xffe6a0 : 0x7aa0c8, x, y, w, h); p.fill('rgba(255,255,255,0.35)', x, y, 1, h); };

const minster: Draw = (p, d, px, py) => {
  const stone = 0xe4dccb, slate = mixC(d.theme.roofs[0], 0x4a5470, 0.55), [b0, b1] = d.theme.banner;
  p.ell('rgba(0,0,0,0.28)', px + 6, py + 6, 104, 24);
  stepsFront(p, px, py - 2, 76, stone, 5);
  // the two aisles, lower, with their own slate roofs
  for (const s of [-1, 1]) { p.fill(shadeC(stone, 0.9), px + s * 58 - 16, py - 56, 32, 54); p.fill(shadeC(stone, 0.7), px + s * 58 + (s > 0 ? 4 : -16), py - 56, 12, 54); p.poly(slate, [px + s * 58 - 20, py - 56, px + s * 58, py - 78, px + s * 58 + 20, py - 56]); for (let k = 0; k < 3; k++) { p.fill(0x2a2a34, px + s * 58 - 5, py - 46 + k * 0, 10, 18); p.fill([0xd8504a, 0x4a78d8, 0xe8c84a][k], px + s * 58 - 4, py - 44, 8, 14); break; } }
  // the nave and its gable
  p.fill(stone, px - 44, py - 76, 88, 74); p.fill(shadeC(stone, 0.78), px + 24, py - 76, 20, 74); p.fill(shadeC(stone, 1.1), px - 44, py - 76, 6, 74);
  p.poly(slate, [px - 48, py - 76, px, py - 112, px + 48, py - 76]); p.poly(shadeC(slate, 0.75), [px, py - 112, px + 48, py - 76, px, py - 76]);
  p.circ(0x2a2a34, px, py - 90, 12); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.poly([0xd8504a, 0x4a78d8, 0xe8c84a, 0x58b868][k % 4], [px, py - 90, px + Math.cos(a) * 10, py - 90 + Math.sin(a) * 10, px + Math.cos(a + 0.78) * 10, py - 90 + Math.sin(a + 0.78) * 10]); }
  p.circ('rgba(255,235,170,0.35)', px, py - 90, 17);
  // the great portal
  p.fill(0x3a2a22, px - 12, py - 40, 24, 38); p.ell(0x3a2a22, px, py - 40, 12, 12); p.fill(0x6a4a30, px - 9, py - 36, 18, 34); p.ell(0x6a4a30, px, py - 36, 9, 9); p.fill(0x3a2a22, px, py - 36, 1, 34);
  for (const dx of [-34, -24, 24, 34]) { p.fill(0x2a2a34, px + dx - 3, py - 60, 6, 22); p.ell(0x2a2a34, px + dx, py - 60, 3, 3); p.fill([0xd8504a, 0x4a78d8, 0xe8c84a, 0x58b868][(dx + 40) % 4], px + dx - 2, py - 58, 4, 18); }
  // twin towers with their spires
  for (const s of [-1, 1]) {
    const tx = px + s * 40, w = 28;
    p.fill(stone, tx - w / 2, py - 128, w, 126); p.fill(shadeC(stone, 0.76), tx + (s > 0 ? 4 : -w / 2 + w - 12), py - 128, 10, 126);
    for (let j = 0; j < 6; j++) p.fill(shadeC(stone, 0.86), tx - w / 2, py - 120 + j * 20, w, 1);
    for (const wy of [-110, -80, -50]) { p.fill(0x2a2a34, tx - 3, py + wy, 6, 14); p.ell(0x2a2a34, tx, py + wy, 3, 3); p.fill(0xffe6a0, tx - 2, py + wy + 2, 4, 10); }
    p.fill(shadeC(stone, 0.7), tx - w / 2 - 2, py - 132, w + 4, 6); crenel(p, tx - w / 2 - 2, py - 132, w + 4, stone);
    p.poly(slate, [tx - w / 2 - 2, py - 132, tx, py - 176, tx + w / 2 + 2, py - 132]); p.poly(shadeC(slate, 0.72), [tx, py - 176, tx + w / 2 + 2, py - 132, tx, py - 132]);
    p.line(0x4a3a22, tx, py - 176, tx, py - 190, 2); p.circ(0xf2c94c, tx, py - 192, 3); glow(p, tx, py - 192, 8, 'rgba(255,230,130,0.35)');
  }
  // the central spire and the bell
  p.poly(slate, [px - 12, py - 112, px, py - 160, px + 12, py - 112]); p.poly(shadeC(slate, 0.72), [px, py - 160, px + 12, py - 112, px, py - 112]); p.line(0x4a3a22, px, py - 160, px, py - 174, 2); p.circ(0xf2c94c, px, py - 176, 3);
  for (const s of [-1, 1]) banner(p, px + s * 84, py + 2, 54, s > 0 ? b0 : b1, s > 0 ? b1 : b0);
  for (const dx of [-70, -52, 52, 70]) { p.fill(0x4a3a2a, px + dx - 1, py - 14, 2, 14); p.circ('rgba(255,210,110,0.5)', px + dx, py - 16, 6); p.circ(0xffd070, px + dx, py - 16, 2); }
};

const towers: Draw = (p, d, px, py) => {
  const [b0, b1] = d.theme.banner, tone = [0x9aa4b8, 0x8a96aa, 0xa8b0c0, 0x8a92a8, 0x9ea8b8];
  dais(p, px, py, 84, 26, 0xb8b4aa, 3);
  const spec: [number, number, number][] = [[-62, 112, 22], [-30, 156, 24], [2, 190, 26], [36, 144, 24], [66, 100, 22]];
  // sky bridges first, so the towers stand in front of their ends
  for (const [dy, i, j] of [[-84, 0, 1], [-118, 1, 2], [-104, 2, 3], [-76, 3, 4]] as [number, number, number][]) { const a = spec[i], c = spec[j]; p.fill(0x6a7288, px + a[0] + a[2] / 2, py + dy, c[0] - a[0] - a[2] / 2 - 0, 6); p.fill(0xb8c4d8, px + a[0] + a[2] / 2, py + dy, c[0] - a[0] - a[2] / 2, 2); for (let k = px + a[0] + a[2] / 2 + 4; k < px + c[0]; k += 6) p.fill(0xffe6a0, k, py + dy + 3, 3, 2); }
  spec.forEach(([dx, h, w], i) => {
    const tx = px + dx, c = tone[i];
    p.fill(c, tx - w / 2, py - h, w, h); p.fill(shadeC(c, 1.15), tx - w / 2, py - h, 4, h); p.fill(shadeC(c, 0.7), tx + w / 2 - 6, py - h, 6, h);
    for (let y = py - h + 10; y < py - 6; y += 9) for (let x = tx - w / 2 + 4; x < tx + w / 2 - 4; x += 6) p.fill(((x + y) * 7) % 5 === 0 ? 0xffe6a0 : 0x5a7aa0, x, y, 3, 5);
    p.fill(shadeC(c, 0.55), tx - w / 2 - 1, py - h - 3, w + 2, 4);
    if (i % 2 === 0) { p.poly(i === 2 ? b0 : 0x4a5470, [tx - w / 2, py - h - 3, tx, py - h - 22, tx + w / 2, py - h - 3]); p.line(0x4a4a52, tx, py - h - 22, tx, py - h - 34, 1.5); p.circ(0xff6a5a, tx, py - h - 35, 2); glow(p, tx, py - h - 35, 8, 'rgba(255,100,90,0.4)'); }
    else { p.fill(shadeC(c, 0.8), tx - w / 4, py - h - 12, w / 2, 9); p.fill(b1, tx - w / 2, py - h - 3, w, 2); }
    p.fill(0x2a2a34, tx - 4, py - 12, 8, 12); p.fill(0xffe6a0, tx - 3, py - 10, 6, 10);
  });
  for (const s of [-1, 1]) for (const dy of [4, 14]) { p.fill(0x3a3a44, px + s * 84 - 1.5, py + dy - 20, 3, 20); p.circ(0xffd070, px + s * 84, py + dy - 22, 3); p.circ('rgba(255,220,130,0.3)', px + s * 84, py + dy - 22, 9); }
};

const citadel: Draw = (p, d, px, py) => {
  const stone = mixC(0x9a948a, d.theme.walls[0], 0.35), [b0, b1] = d.theme.banner;
  p.ell('rgba(0,0,0,0.3)', px + 6, py + 6, 104, 26);
  // curtain wall with its gate
  p.fill(stone, px - 86, py - 40, 172, 40); p.fill(shadeC(stone, 1.12), px - 86, py - 40, 172, 3); p.fill(shadeC(stone, 0.74), px - 86, py - 6, 172, 6); crenel(p, px - 86, py - 40, 172, stone);
  for (let k = 0; k < 14; k++) p.fill(shadeC(stone, 0.82), px - 82 + k * 12, py - 34, 1, 26);
  for (let j = 0; j < 4; j++) p.fill(shadeC(stone, 0.84), px - 86, py - 30 + j * 8, 172, 1);
  p.fill(0x2a1c14, px - 14, py - 36, 28, 36); p.ell(0x2a1c14, px, py - 36, 14, 12); p.fill(0x5a4630, px - 11, py - 30, 22, 30); p.ell(0x5a4630, px, py - 30, 11, 9); for (let k = 0; k < 5; k++) p.fill(0x2a2a30, px - 9 + k * 4.5, py - 30, 1.5, 30);
  p.fill(shadeC(stone, 0.8), px - 18, py - 50, 36, 14); crenel(p, px - 18, py - 50, 36, stone);
  // the keep behind
  p.fill(stone, px - 34, py - 98, 68, 60); p.fill(shadeC(stone, 0.72), px + 18, py - 98, 16, 60); p.fill(shadeC(stone, 1.12), px - 34, py - 98, 4, 60); crenel(p, px - 36, py - 98, 72, stone);
  for (const [dx, dy] of [[-18, -86], [4, -86], [-18, -66], [4, -66]]) win(p, px + dx, py + dy, 8, 14, true);
  p.fill(shadeC(stone, 0.6), px - 8, py - 116, 16, 18); crenel(p, px - 10, py - 116, 20, stone);
  p.line(0x4a3a22, px, py - 116, px, py - 140, 2); p.poly(b0, [px + 1, py - 140, px + 18, py - 134, px + 1, py - 127]); p.poly(b1, [px + 1, py - 140, px + 8, py - 137, px + 1, py - 133]);
  // four round corner towers
  for (const [dx, dy, h] of [[-86, 0, 72], [86, 0, 72], [-52, -34, 86], [52, -34, 86]] as [number, number, number][]) {
    const tx = px + dx, ty = py + dy, w = 24;
    p.fill(shadeC(stone, 0.96), tx - w / 2, ty - h, w, h); p.fill(shadeC(stone, 1.15), tx - w / 2, ty - h, 5, h); p.fill(shadeC(stone, 0.7), tx + w / 2 - 6, ty - h, 6, h); p.ell(shadeC(stone, 0.7), tx, ty, w / 2, 4);
    p.fill(shadeC(stone, 0.8), tx - w / 2 - 2, ty - h - 3, w + 4, 6); crenel(p, tx - w / 2 - 2, ty - h - 3, w + 4, stone);
    p.fill(0x1a1a22, tx - 2, ty - h + 12, 4, 10); p.fill(0x1a1a22, tx - 2, ty - h + 34, 4, 10);
    p.line(0x4a3a22, tx, ty - h - 3, tx, ty - h - 22, 1.5); p.poly(b0, [tx + 1, ty - h - 22, tx + 11, ty - h - 18, tx + 1, ty - h - 14]);
  }
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { p.fill(0x4a3a2a, px + s * (30 + k * 20) - 1, py + 4, 2, 10); p.circ('rgba(255,200,100,0.5)', px + s * (30 + k * 20), py + 2, 6); flame(p, px + s * (30 + k * 20), py + 4, 0.6); }
};

const academy: Draw = (p, d, px, py) => {
  const stone = 0xf0e8d8, dome = mixC(d.theme.banner[0], 0x6a8aa8, 0.5), [b0, b1] = d.theme.banner;
  p.ell('rgba(0,0,0,0.26)', px + 6, py + 6, 98, 24);
  stepsFront(p, px, py - 2, 112, stone, 6);
  // the wings
  for (const s of [-1, 1]) { p.fill(shadeC(stone, 0.94), px + s * 70 - 22, py - 56, 44, 54); p.fill(shadeC(stone, 0.74), px + s * 70 + (s > 0 ? 8 : -22), py - 56, 14, 54); p.poly(shadeC(dome, 0.8), [px + s * 70 - 26, py - 56, px + s * 70, py - 74, px + s * 70 + 26, py - 56]); for (const dx of [-12, 0, 12]) win(p, px + s * 70 + dx - 3, py - 44, 6, 14, dx !== 0); }
  // the portico: pediment on eight columns
  p.fill(shadeC(stone, 0.9), px - 50, py - 62, 100, 60); p.fill(0x3a3a44, px - 44, py - 52, 88, 48);
  for (let k = 0; k < 8; k++) { const cx = px - 44 + k * 12.6; p.fill(stone, cx - 3, py - 56, 6, 54); p.fill(shadeC(stone, 0.7), cx + 1, py - 56, 2, 54); p.fill(shadeC(stone, 1.1), cx - 4, py - 58, 8, 3); p.fill(shadeC(stone, 0.8), cx - 4, py - 4, 8, 3); }
  p.fill(stone, px - 54, py - 68, 108, 8); p.poly(stone, [px - 56, py - 68, px, py - 92, px + 56, py - 68]); p.poly(shadeC(stone, 0.8), [px - 40, py - 70, px, py - 86, px + 40, py - 70]); p.circ(b0, px, py - 76, 5); p.circ(0xf2c94c, px, py - 76, 2.4);
  // the great dome and its lantern
  p.fill(shadeC(stone, 0.92), px - 30, py - 110, 60, 26); for (let k = 0; k < 7; k++) p.fill(shadeC(stone, 0.7), px - 26 + k * 9, py - 108, 2, 22);
  p.ell(dome, px, py - 110, 32, 30); p.ell(shadeC(dome, 1.2), px - 8, py - 118, 14, 12); p.fill(shadeC(dome, 0.7), px + 6, py - 110, 26, 1);
  for (let k = 0; k < 6; k++) { const a = -2.6 + k * 0.42; p.line(shadeC(dome, 0.7), px, py - 112, px + Math.cos(a) * 31, py - 110 + Math.sin(a) * 29, 1); }
  p.fill(stone, px - 6, py - 148, 12, 12); p.ell(dome, px, py - 148, 6, 8); p.line(0x8a7a50, px, py - 154, px, py - 168, 2); p.circ(0xf2c94c, px, py - 170, 3); glow(p, px, py - 170, 10, 'rgba(255,230,130,0.35)');
  for (const s of [-1, 1]) { banner(p, px + s * 100, py + 2, 60, s > 0 ? b0 : b1, s > 0 ? b1 : b0); p.fill(0xf4eedc, px + s * 100 + 2, py - 40, 8, 12); }
};

const bazaar: Draw = (p, d, px, py) => {
  const [b0, b1] = d.theme.banner, cols = [b0, b1, 0xe04848, 0xf2c94c, 0x5aa0ea, 0x6cc05a];
  p.ell('rgba(0,0,0,0.22)', px + 4, py + 8, 96, 36); p.ell(mixC(d.theme.plaza, b0, 0.18), px, py, 92, 34); p.ell(shadeC(d.theme.plaza, 1.06), px, py, 84, 30);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; p.fill(['#a83a2a', '#2a5a8a', '#c8a050', '#5a8a4a'][k % 4], px + Math.cos(a) * 60 - 8, py + Math.sin(a) * 22 - 3, 16, 6); }
  // the ring of canopies, back to front
  const stalls = Array.from({ length: 8 }, (_, k) => ({ k, a: (k / 8) * Math.PI * 2 + 0.4 })).sort((u, v) => Math.sin(u.a) - Math.sin(v.a));
  for (const { k, a } of stalls) {
    const sx = px + Math.cos(a) * 66, sy = py + Math.sin(a) * 26 + 6, w = 28;
    p.ell('rgba(0,0,0,0.2)', sx + 3, sy + 2, 15, 4);
    p.fill(0x6a4a2e, sx - w / 2 + 1, sy - 28, 2, 28); p.fill(0x6a4a2e, sx + w / 2 - 3, sy - 28, 2, 28);
    p.fill(0x8a6a3e, sx - w / 2 + 2, sy - 10, w - 4, 10); for (let j = 0; j < 5; j++) p.circ([0xe04848, 0xf2c94c, 0x6cc05a, 0xe8a060, 0xa86ad8][(k + j) % 5], sx - 9 + j * 4.6, sy - 12, 2.4);
    p.poly(cols[k % cols.length], [sx - w / 2 - 3, sy - 26, sx + w / 2 + 3, sy - 26, sx + w / 2, sy - 36, sx - w / 2, sy - 36]); for (let j = 0; j < w + 6; j += 8) p.poly(0xf4eedc, [sx - w / 2 - 3 + j, sy - 26, sx - w / 2 + j + 4, sy - 26, sx - w / 2 + j + 3, sy - 36, sx - w / 2 + j - 1, sy - 36]);
    p.fill(shadeC(cols[k % cols.length], 0.7), sx - w / 2 - 3, sy - 26, w + 6, 2);
  }
  // the pavilion in the middle, and its pole of pennants
  p.fill(0x6a4a2e, px - 18, py - 40, 3, 40); p.fill(0x6a4a2e, px + 15, py - 40, 3, 40); p.fill(0x7a5a3a, px - 18, py - 12, 36, 12);
  p.poly(b0, [px - 26, py - 40, px + 26, py - 40, px + 14, py - 62, px - 14, py - 62]); for (let j = 0; j < 5; j++) p.poly(j % 2 ? 0xf4eedc : b1, [px - 26 + j * 10.4, py - 40, px - 16 + j * 10.4, py - 40, px - 11 + j * 5.6 - 4, py - 62, px - 14 + j * 5.6 - 4, py - 62]);
  p.line(0x4a3a22, px, py - 62, px, py - 96, 2); for (let k = 0; k < 4; k++) p.poly(cols[(k + 2) % cols.length], [px + 1, py - 94 + k * 7, px + 14, py - 90 + k * 7, px + 1, py - 87 + k * 7]);
  p.circ(0xf2c94c, px, py - 98, 3);
};

const arena: Draw = (p, d, px, py) => {
  const stone = 0xd4c4a0, [b0, b1] = d.theme.banner;
  p.ell('rgba(0,0,0,0.3)', px + 6, py + 8, 100, 44); p.ell(shadeC(stone, 0.66), px, py + 4, 98, 42); p.ell(stone, px, py, 94, 40);
  p.ell(shadeC(stone, 0.82), px, py + 2, 76, 29); p.ell(0xd8c088, px, py + 2, 66, 24); p.ell(0xe8d4a0, px - 4, py, 40, 12); p.x2.strokeStyle = 'rgba(140,110,70,0.5)'; p.x2.lineWidth = 1; p.x2.beginPath(); p.x2.ellipse(px, py + 2, 40, 14, 0, 0, 6.3); p.x2.stroke();
  // the stands: rings of seats and the wall of arches in front
  for (let r = 0; r < 4; r++) { p.x2.strokeStyle = hex(shadeC(stone, 0.7 + r * 0.06)); p.x2.lineWidth = 3; p.x2.beginPath(); p.x2.ellipse(px, py + 2, 70 + r * 6, 27 + r * 2.6, 0, 0, 6.3); p.x2.stroke(); }
  p.fill(shadeC(stone, 0.9), px - 94, py + 8, 188, 30); p.ell(shadeC(stone, 0.9), px, py + 8, 94, 8);
  p.fill(shadeC(stone, 0.7), px - 94, py + 34, 188, 4); p.fill(shadeC(stone, 1.12), px - 94, py + 8, 188, 2);
  for (let k = 0; k < 12; k++) { const ax = px - 86 + k * 15.6; p.fill(0x3a3028, ax - 4, py + 16, 8, 20); p.ell(0x3a3028, ax, py + 16, 4, 4); p.fill(shadeC(stone, 0.78), ax + 5, py + 10, 2, 26); }
  p.fill(0x1a1410, px - 8, py + 14, 16, 22); p.ell(0x1a1410, px, py + 14, 8, 7); for (let k = 0; k < 4; k++) p.fill(0x6a645a, px - 6 + k * 4, py + 14, 1.4, 22);
  for (const s of [-1, 1]) for (const dx of [20, 56, 84]) { p.fill(0x4a3a2a, px + s * dx - 1, py - 40 + (dx === 84 ? 18 : 0), 2, 40); p.poly(dx % 2 ? b0 : b1, [px + s * dx + 1, py - 40 + (dx === 84 ? 18 : 0), px + s * dx + 13, py - 35 + (dx === 84 ? 18 : 0), px + s * dx + 1, py - 30 + (dx === 84 ? 18 : 0)]); }
  for (const dx of [-70, 70]) { flame(p, px + dx, py + 4, 0.9); p.fill(0x2a2a30, px + dx - 4, py + 4, 8, 6); }
};

const tomb: Draw = (p, d, px, py) => {
  const stone = 0x8a8478, [b0, b1] = d.theme.banner;
  p.ell('rgba(0,0,0,0.3)', px + 6, py + 8, 90, 30);
  // an avenue of standing stones up to the mound
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { const y = py + 18 - k * 5, x = px + s * (24 + k * 6); p.fill(shadeC(stone, 0.72), x - 3, y - 18 - k * 2, 6, 18 + k * 2); p.fill(stone, x - 3, y - 18 - k * 2, 3, 18 + k * 2); p.circ('rgba(150,255,210,0.7)', x, y - 12 - k, 1.4); }
  // the stepped mound of earth and slabs
  p.ell(shadeC(stone, 0.6), px, py - 2, 84, 30); p.ell(0x5a7a4a, px, py - 6, 78, 26); p.ell(0x6a8a52, px, py - 18, 62, 20); p.ell(0x7a9a5e, px, py - 32, 44, 14); p.ell(0x8aaa6a, px - 4, py - 44, 24, 8);
  for (let k = 0; k < 5; k++) { p.fill(shadeC(stone, 0.9), px - 38 + k * 16, py - 60 + (k % 2) * 6, 6, 18); p.fill('rgba(150,255,210,0.5)', px - 37 + k * 16, py - 55 + (k % 2) * 6, 3, 2); }
  // the doorway into the hill, between two pylons with braziers
  p.fill(0x1a1a22, px - 14, py - 34, 28, 34); p.ell(0x1a1a22, px, py - 34, 14, 10); p.fill(shadeC(stone, 1.1), px - 18, py - 38, 6, 38); p.fill(shadeC(stone, 1.1), px + 12, py - 38, 6, 38); p.fill(shadeC(stone, 0.9), px - 20, py - 42, 40, 6);
  p.circ('rgba(150,255,210,0.3)', px, py - 18, 18); p.fill(0xc8f8e0, px - 1, py - 24, 2, 20);
  for (const s of [-1, 1]) { p.fill(shadeC(stone, 0.85), px + s * 44 - 5, py - 56, 10, 56); p.fill(shadeC(stone, 1.15), px + s * 44 - 5, py - 56, 3, 56); p.fill(0x2a2a30, px + s * 44 - 8, py - 62, 16, 7); flame(p, px + s * 44, py - 62, 1); p.poly(s > 0 ? b0 : b1, [px + s * 44 - 4, py - 50, px + s * 44 + 4, py - 50, px + s * 44, py - 28]); }
  for (let k = 0; k < 9; k++) p.circ('rgba(170,255,220,0.75)', px - 60 + ((k * 37) % 120), py - 70 + ((k * 23) % 60), 1.3);
};

export const HEARTS: Record<Heart, Draw> = { minster, towers, citadel, academy, bazaar, arena, tomb };
export const isHeart = (k: string): k is Heart => k in HEARTS;
