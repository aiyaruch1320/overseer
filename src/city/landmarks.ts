// The heart of a town: the paved square and the monument that stands in it. Every landmark is drawn large, on a stepped dais, with
// the town's own banners, so a visitor reads it at once as "the place this town is about". The sky nations of Azgar each have their
// own, taken from docs/countries/01-azgar.md (the dragon's nest of Oran-Sal, the caldera of the fire elder, the stair gate...).
import { type Pen, hex, shadeC, mixC } from './draw';
import type { CityData } from './citygen';
import { leafCluster, leafRng } from '../render/treeart';
import { T } from './citygen';

type Draw = (p: Pen, d: CityData, px: number, py: number) => void;

// ---------------------------------------------------------------- shared pieces
/** a round stepped platform: the ground a monument stands on */
function dais(p: Pen, px: number, py: number, rx: number, ry: number, c = 0xcfc8b4, steps = 2) {
  p.ell('rgba(0,0,0,0.28)', px + 5, py + 7, rx + 3, ry + 3);
  for (let s = 0; s < steps; s++) {
    const k = 1 - s * 0.16, h = (steps - s) * 2;
    p.ell(shadeC(c, 0.7 - s * 0.05), px, py + h, rx * k, ry * k);
    p.ell(shadeC(c, 1 + s * 0.08), px, py + h - 2, rx * k, ry * k);
  }
}
const banner = (p: Pen, x: number, y: number, h: number, a: number, b: number) => {
  p.fill(0x4a3a22, x, y - h, 1, h + 2);
  p.poly(a, [x + 1, y - h, x + 11, y - h + 3, x + 8, y - h + 6, x + 11, y - h + 9, x + 1, y - h + 9]); p.fill(b, x + 1, y - h, 2, 9);
};
const flame = (p: Pen, x: number, y: number, s: number) => {
  p.circ('rgba(255,150,40,0.25)', x, y - 4 * s, 9 * s); p.poly(0xe04820, [x - 4 * s, y, x, y - 14 * s, x + 4 * s, y]); p.poly(0xffb030, [x - 2.4 * s, y, x, y - 9 * s, x + 2.4 * s, y]); p.poly(0xffe8a0, [x - 1 * s, y, x, y - 4.5 * s, x + 1 * s, y]);
};
const glow = (p: Pen, x: number, y: number, r: number, c: string) => { p.circ(c, x, y, r); p.circ(c.replace(/[\d.]+\)$/, '0.12)'), x, y, r * 1.6); };

/** the paving of the square: concentric rings and spokes around the monument, in the town's own colours */
export function paintSquare(p: Pen, d: CityData, px: number, py: number) {
  const th = d.theme, { x, y, w, h } = d.plaza, rx = w * T * 0.31, ry = h * T * 0.39;
  p.x2.save(); p.x2.beginPath(); p.x2.rect(x * T, y * T, w * T, h * T); p.x2.clip();
  const base = th.plaza;
  p.ell(shadeC(base, 0.86), px, py, rx + 4, ry + 3);
  p.ell(mixC(base, th.banner[0], 0.22), px, py, rx, ry);
  p.ell(shadeC(base, 1.06), px, py, rx - 5, ry - 4);
  p.x2.strokeStyle = hex(shadeC(base, 0.72)); p.x2.lineWidth = 1;
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; p.x2.beginPath(); p.x2.moveTo(px + Math.cos(a) * (rx * 0.35), py + Math.sin(a) * (ry * 0.35)); p.x2.lineTo(px + Math.cos(a) * (rx - 5), py + Math.sin(a) * (ry - 4)); p.x2.stroke(); }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; p.circ(mixC(base, th.banner[1], 0.7), px + Math.cos(a) * (rx - 2.5), py + Math.sin(a) * (ry - 2), 2); }
  p.x2.restore();
}

// ---------------------------------------------------------------- common monuments
const fountain: Draw = (p, d, px, py) => {
  dais(p, px, py, 40, 21, 0xd8d0c0, 2);
  p.ell(0x8a8478, px, py - 2, 30, 15); p.ell(0xb8b0a0, px, py - 4, 28, 13.5); p.ell(0x3f8ad0, px, py - 4, 25, 11.5); p.ell(0x7ac0f0, px - 5, py - 6, 14, 5);
  for (let k = 0; k < 3; k++) { p.x2.strokeStyle = 'rgba(255,255,255,0.55)'; p.x2.lineWidth = 1; p.x2.beginPath(); p.x2.ellipse(px, py - 4, 8 + k * 6, 3 + k * 2.6, 0, 0, 6.3); p.x2.stroke(); }
  p.fill(0xb8b0a0, px - 4, py - 28, 8, 24); p.fill(0xd8d0c0, px - 4, py - 28, 3, 24); p.ell(0xb8b0a0, px, py - 20, 12, 4.5); p.ell(0x7ac0f0, px, py - 21, 10, 3.4);
  p.ell(0xd8d0c0, px, py - 30, 7, 3); p.circ(d.theme.banner[0], px, py - 36, 3.6); p.fill(0xf2c94c, px - 1, py - 44, 2, 8);
  for (let k = -3; k <= 3; k++) { p.line('rgba(210,240,255,0.8)', px, py - 31, px + k * 6, py - 12 + Math.abs(k), 1); p.circ('rgba(255,255,255,0.8)', px + k * 6, py - 12 + Math.abs(k), 1); }
  for (const s of [-1, 1]) { p.fill(0x8a8478, px + s * 38 - 2, py - 3, 4, 10); p.circ(d.theme.banner[1], px + s * 38, py - 6, 3); }
};
const statue: Draw = (p, d, px, py) => {
  dais(p, px, py, 38, 20, 0xb8b0a0, 3);
  p.fill(0xcfc8b8, px - 12, py - 14, 24, 14); p.fill(0xe8e0d0, px - 12, py - 14, 24, 2); p.fill(shadeC(0xcfc8b8, 0.8), px + 4, py - 14, 8, 14);
  p.fill(0xb8b0a0, px - 8, py - 24, 16, 10); p.fill(0xf2c94c, px - 5, py - 21, 10, 3);
  // the hero: legs, cape in the town's colour, torso, helmet, raised sword
  p.fill(0x9a9484, px - 5, py - 40, 4, 16); p.fill(0x9a9484, px + 1, py - 40, 4, 16);
  p.poly(d.theme.banner[0], [px - 9, py - 56, px + 9, py - 56, px + 13, py - 30, px - 13, py - 30]); p.poly(shadeC(d.theme.banner[0], 0.7), [px + 2, py - 56, px + 9, py - 56, px + 13, py - 30, px + 4, py - 30]);
  p.fill(0xb8b0a0, px - 6, py - 58, 12, 20); p.fill(0xd8d0c0, px - 6, py - 58, 4, 20);
  p.circ(0xcfc8b8, px, py - 63, 5); p.poly(0xf2c94c, [px - 5, py - 65, px, py - 71, px + 5, py - 65]);
  p.line(0xe8e8f0, px + 8, py - 55, px + 15, py - 82, 2); p.fill(0xf2c94c, px + 11, py - 62, 8, 2); p.circ('rgba(255,255,255,0.5)', px + 15, py - 82, 3);
  banner(p, px - 34, py - 4, 34, d.theme.banner[0], d.theme.banner[1]); banner(p, px + 30, py - 4, 34, d.theme.banner[1], d.theme.banner[0]);
};
const bonfire: Draw = (p, d, px, py) => {
  p.ell('rgba(0,0,0,0.3)', px + 4, py + 8, 40, 16); p.ell(0x3a2a22, px, py + 2, 36, 15); p.ell(0x5a4638, px, py, 32, 13); p.ell(0x1a1210, px, py - 1, 22, 8);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, sx = px + Math.cos(a) * 30, sy = py + Math.sin(a) * 12; p.fill(0x6a4a2a, sx - 1, sy - 14, 3, 15); p.circ(0xe8e0d0, sx, sy - 16, 3.2); p.fill(0x1a1210, sx - 2, sy - 17, 1.5, 1.5); p.fill(0x1a1210, sx + 1, sy - 17, 1.5, 1.5); }
  for (let k = 0; k < 5; k++) { const a = -0.9 + k * 0.45; p.line(0x5e3a26, px + Math.cos(a) * 20, py + 2, px + Math.sin(a) * 6, py - 24, 4); }
  flame(p, px, py - 8, 2.4); flame(p, px - 9, py - 4, 1.4); flame(p, px + 9, py - 4, 1.4);
  p.circ('rgba(70,60,56,0.5)', px + 6, py - 50, 6); p.circ('rgba(70,60,56,0.35)', px + 11, py - 62, 8);
  for (const s of [-1, 1]) { p.fill(0x4a3a2a, px + s * 46 - 2, py - 30, 4, 34); p.circ(0xd8cfb8, px + s * 46, py - 34, 5); p.fill(d.theme.banner[0], px + s * 46 - 6, py - 26, 12, 4); p.fill(0x1a1210, px + s * 46 - 3, py - 35, 2, 2); p.fill(0x1a1210, px + s * 46 + 1, py - 35, 2, 2); }
};
const clock: Draw = (p, d, px, py) => {
  dais(p, px, py, 30, 15, 0x9a9eb0, 2);
  const w = 26, top = py - 78;
  p.fill(0x6a7088, px - w / 2, top + 14, w, 76); p.fill(0x8a90a8, px - w / 2, top + 14, 6, 76); p.fill(0x50566c, px + w / 2 - 6, top + 14, 6, 76);
  for (let j = 0; j < 7; j++) p.fill(0x50566c, px - w / 2, top + 22 + j * 10, w, 1);
  p.fill(0x50566c, px - w / 2 - 3, top + 10, w + 6, 5); p.fill(0x7a8098, px - w / 2 - 3, top + 10, w + 6, 2);
  p.poly(0x3a4660, [px - 15, top + 10, px, top - 18, px + 15, top + 10]); p.poly(0x2e3850, [px, top - 18, px + 15, top + 10, px, top + 10]); p.fill(0xf2c94c, px, top - 28, 1, 11); p.circ(0xf2c94c, px, top - 29, 2);
  p.fill(0x1a1a22, px - 6, top - 2, 12, 11); p.ell(0xb89a3a, px, top + 4, 4, 5);
  p.circ(0x3a2a1a, px, top + 36, 11.5); p.circ(0xf0e8c8, px, top + 36, 9.8);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; p.fill(0x2a2a30, px + Math.cos(a) * 8 - 0.5, top + 36 + Math.sin(a) * 8 - 0.5, 1.5, 1.5); }
  p.line(0x1a1a22, px, top + 36, px + 1, top + 29, 1.4); p.line(0x1a1a22, px, top + 36, px + 5, top + 38, 1.4); p.circ(0xb89a3a, px, top + 36, 1.4);
  p.fill(0x1a1a22, px - 5, py - 16, 10, 16); p.ell(0x1a1a22, px, py - 16, 5, 4);
  banner(p, px + 20, py - 2, 30, d.theme.banner[0], d.theme.banner[1]);
};
const sapling: Draw = (p, d, px, py) => {
  const L = d.theme.leaf;
  dais(p, px, py, 38, 19, 0x7a8a6a, 2);
  glow(p, px, py - 30, 34, 'rgba(170,255,150,0.28)');
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { p.x2.strokeStyle = hex(0x4a3322); p.x2.lineWidth = 4 - k; p.x2.beginPath(); p.x2.moveTo(px, py - 8); p.x2.quadraticCurveTo(px + s * (10 + k * 7), py - 1 + k, px + s * (18 + k * 8), py + 3 + k * 2); p.x2.stroke(); }
  p.fill(0x5e3a26, px - 6, py - 38, 12, 34); p.fill(0x7a5238, px - 6, py - 38, 4, 34); p.fill(0x3e2616, px + 3, py - 38, 3, 34);
  p.line(0x5e3a26, px, py - 30, px - 18, py - 46, 4); p.line(0x5e3a26, px, py - 34, px + 18, py - 50, 4);
  const rr = leafRng(5);
  leafCluster(p.x2, px - 22, py - 52, 22, 17, L, rr); leafCluster(p.x2, px + 22, py - 54, 22, 17, L, rr); leafCluster(p.x2, px, py - 64, 30, 22, L, rr); leafCluster(p.x2, px - 6, py - 82, 20, 14, L, rr);
  for (let k = 0; k < 14; k++) p.circ('rgba(255,252,170,0.95)', px - 34 + ((k * 37) % 68), py - 92 + ((k * 23) % 62), 1.4);
  for (let k = 0; k < 5; k++) p.circ(0xf2c94c, px - 22 + k * 11, py - 50 - (k % 2) * 8, 2);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; p.fill(0x8a9a78, px + Math.cos(a) * 34 - 2, py + Math.sin(a) * 14 - 5, 4, 6); p.fill('rgba(120,255,180,0.8)', px + Math.cos(a) * 34 - 1, py + Math.sin(a) * 14 - 3, 2, 2); }
};
const obelisk: Draw = (p, d, px, py) => {
  dais(p, px, py, 34, 17, 0xa09a8c, 3);
  p.poly(0x8a8478, [px - 11, py - 4, px - 7, py - 80, px + 7, py - 80, px + 11, py - 4]); p.poly(0x6a645a, [px + 2, py - 80, px + 7, py - 80, px + 11, py - 4, px + 3, py - 4]); p.poly(0xcfc8b8, [px - 7, py - 80, px, py - 94, px + 7, py - 80]); p.poly(0xf2c94c, [px - 2, py - 91, px, py - 96, px + 2, py - 91]);
  for (let k = 0; k < 9; k++) { p.fill('rgba(255,200,110,0.85)', px - 3, py - 74 + k * 8, 6, 2); p.fill('rgba(40,30,20,0.6)', px - 5, py - 71 + k * 8, 10, 1); }
  for (const [dx, dy] of [[-30, 2], [30, 2], [-18, 12], [18, 12]]) { p.fill(0x5a544a, px + dx - 3, py + dy - 10, 6, 10); p.ell(0x3a342c, px + dx, py + dy - 10, 4.5, 2); flame(p, px + dx, py + dy - 11, 0.8); }
};

// ---------------------------------------------------------------- Azgar: the dragon continent. Each sky nation has its own heart.
/** AZ-01: the Skynest. A spire of stone with the cave of Oran-Sal at its heart, the first dragon coiled round it, chain bridges to the anchor posts */
const skynest: Draw = (p, d, px, py) => {
  const gold = 0xf2c94c, white = 0xf4f0e6;
  // clouds and the broad base
  for (const [dx, dy, r] of [[-70, 8, 26], [64, 10, 28], [-30, 22, 20], [38, 24, 22]] as [number, number, number][]) { p.circ('rgba(255,255,255,0.55)', px + dx, py + dy, r); p.circ('rgba(255,255,255,0.35)', px + dx + 8, py + dy - 6, r * 0.7); }
  dais(p, px, py, 58, 28, 0xe8e2d4, 3);
  // chain bridges to four anchor posts
  for (const [dx, dy] of [[-96, -6], [96, -6], [-70, 30], [70, 30]]) {
    p.fill(0xcfc8b8, px + dx - 4, py + dy - 18, 8, 20); p.fill(gold, px + dx - 5, py + dy - 21, 10, 4); p.circ('rgba(255,240,160,0.4)', px + dx, py + dy - 24, 8);
    p.x2.strokeStyle = hex(0x8a7a50); p.x2.lineWidth = 1.5; p.x2.setLineDash([2, 2]); p.x2.beginPath(); p.x2.moveTo(px + dx, py + dy - 16); p.x2.quadraticCurveTo(px + dx * 0.5, py + dy * 0.5 + 8, px + dx * 0.34, py - 4); p.x2.stroke(); p.x2.setLineDash([]);
  }
  // the crag
  p.poly(0x8a8c98, [px - 46, py, px - 32, py - 52, px - 20, py - 96, px - 8, py - 140, px + 4, py - 150, px + 14, py - 116, px + 26, py - 78, px + 40, py - 38, px + 50, py]);
  p.poly(0x6a6c7a, [px + 4, py - 150, px + 14, py - 116, px + 26, py - 78, px + 40, py - 38, px + 50, py, px + 10, py]);
  p.poly(0xaeb0bc, [px - 46, py, px - 32, py - 52, px - 20, py - 96, px - 8, py - 140, px - 6, py - 100, px - 16, py - 48, px - 24, py]);
  for (let k = 0; k < 10; k++) p.line('rgba(40,40,56,0.5)', px - 30 + k * 7, py - 14 - (k * 31) % 90, px - 24 + k * 7, py - 36 - (k * 31) % 90, 1);
  // the cave mouth, lit from inside
  p.ell(0x14101a, px - 2, py - 62, 15, 20); p.ell(0xffd890, px - 2, py - 58, 10, 14); p.ell('rgba(255,236,170,0.5)', px - 2, py - 58, 19, 25);
  // Oran-Sal coiled round the spire: segments of white-gold scale, wings, head with horns at the summit
  const seg: [number, number][] = [[-44, -4], [-52, -30], [-34, -52], [2, -58], [32, -78], [28, -102], [2, -116], [-8, -130]];
  const body = (w: number, c: string, dash: number[] = []) => {
    p.x2.strokeStyle = c; p.x2.lineWidth = w; p.x2.lineCap = 'round'; p.x2.lineJoin = 'round'; p.x2.setLineDash(dash);
    p.x2.beginPath(); p.x2.moveTo(px + seg[0][0], py + seg[0][1]);
    for (let i = 1; i < seg.length - 1; i++) { const mx = (seg[i][0] + seg[i + 1][0]) / 2, my = (seg[i][1] + seg[i + 1][1]) / 2; p.x2.quadraticCurveTo(px + seg[i][0], py + seg[i][1], px + mx, py + my); }
    p.x2.lineTo(px + seg[seg.length - 1][0], py + seg[seg.length - 1][1]); p.x2.stroke(); p.x2.setLineDash([]);
  };
  body(19, 'rgba(0,0,0,0.25)'); body(17, hex(shadeC(white, 0.72))); body(14, hex(white)); body(5, 'rgba(255,255,255,0.7)');
  body(2.4, hex(gold), [3, 3]);
  p.x2.lineCap = 'butt';
  p.poly(0xe8e4f4, [px - 14, py - 112, px - 54, py - 150, px - 46, py - 128, px - 40, py - 118, px - 30, py - 104]); p.poly(0xcfcce0, [px - 14, py - 112, px - 54, py - 150, px - 36, py - 134]);
  p.poly(0xe8e4f4, [px + 8, py - 116, px + 52, py - 156, px + 44, py - 132, px + 36, py - 120, px + 28, py - 106]); p.poly(0xcfcce0, [px + 8, py - 116, px + 52, py - 156, px + 32, py - 138]);
  p.circ(white, px - 10, py - 136, 9); p.poly(white, [px - 17, py - 136, px - 30, py - 134, px - 18, py - 128]); p.poly(gold, [px - 12, py - 143, px - 20, py - 156, px - 7, py - 144]); p.poly(gold, [px - 4, py - 143, px + 2, py - 156, px + 2, py - 142]);
  p.circ(0x40a0ff, px - 11, py - 137, 1.6);
  glow(p, px - 2, py - 62, 36, 'rgba(255,230,150,0.2)');
  for (const dx of [-58, 58]) banner(p, px + dx, py + 6, 46, 0x3d78c4, gold);
  for (let k = 0; k < 8; k++) p.circ('rgba(255,252,200,0.9)', px - 60 + ((k * 41) % 120), py - 160 + ((k * 29) % 80), 1.3);
};
/** AZ-02 Zakrogar: the crater of the elder of eternal fire, a dueling ring on its lip */
const caldera: Draw = (p, d, px, py) => {
  p.ell('rgba(0,0,0,0.32)', px + 5, py + 10, 60, 26); p.ell(0x2a2224, px, py, 58, 25); p.ell(0x4a3a36, px, py - 2, 54, 22);
  p.ell(0x1a0e0a, px, py - 3, 42, 16); p.ell(0xa83010, px, py - 2, 36, 13); p.ell(0xe85a1a, px, py - 1, 28, 9.5); p.ell(0xffb030, px - 3, py, 16, 5); p.ell(0xfff0a0, px - 4, py, 7, 2.4);
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; p.poly(0x2a2224, [px + Math.cos(a) * 52 - 4, py + Math.sin(a) * 22, px + Math.cos(a) * 54, py + Math.sin(a) * 23 - 10 - (k % 3) * 4, px + Math.cos(a) * 52 + 4, py + Math.sin(a) * 22]); }
  glow(p, px, py - 4, 50, 'rgba(255,120,40,0.22)');
  for (const [dx, h] of [[-14, 34], [6, 46], [20, 28]]) { flame(p, px + dx, py - 8, h / 18); }
  // the dueling platform with weapon racks
  p.ell('rgba(0,0,0,0.3)', px + 4, py + 36, 30, 10); p.ell(0x6a5a50, px, py + 32, 28, 9); p.ell(0xb8a890, px, py + 30, 26, 8);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.fill(0x3a2a22, px + Math.cos(a) * 28 - 1, py + 30 + Math.sin(a) * 8 - 8, 2, 8); }
  p.line(0x8a8a94, px - 8, py + 24, px + 8, py + 34, 2); p.line(0x8a8a94, px + 8, py + 24, px - 8, py + 34, 2);
  banner(p, px - 62, py + 8, 34, 0xa83a2a, 0x2a2224); banner(p, px + 58, py + 8, 34, 0xa83a2a, 0x2a2224);
};
/** AZ-04 Thirovas: the upper gate of the Stair of Ten Thousand Steps */
const stairgate: Draw = (p, d, px, py) => {
  p.ell('rgba(0,0,0,0.3)', px + 6, py + 12, 54, 20);
  for (let s = 0; s < 9; s++) { const w = 54 - s * 3; p.fill(shadeC(0xa8a29a, 1 - s * 0.035), px - w, py + 16 - s * 3, w * 2, 3); p.fill(shadeC(0xa8a29a, 0.7), px - w, py + 18 - s * 3, w * 2, 1); }
  for (const s of [-1, 1]) {
    p.fill(0x7a7468, px + s * 38 - 9, py - 60, 18, 76); p.fill(0x9a948a, px + s * 38 - 9, py - 60, 6, 76); p.fill(0x5a544a, px + s * 38 + 4, py - 60, 5, 76);
    p.fill(0x8a8478, px + s * 38 - 12, py - 66, 24, 8); p.circ(0xb8b0a0, px + s * 38, py - 74, 8); p.fill(0x2a2620, px + s * 38 - 4, py - 76, 3, 2); p.fill(0x2a2620, px + s * 38 + 1, py - 76, 3, 2); // giant faces
    for (let k = 0; k < 5; k++) p.fill('rgba(255,190,100,0.8)', px + s * 38 - 3, py - 54 + k * 10, 6, 2);
  }
  p.fill(0x8a8478, px - 50, py - 70, 100, 12); p.fill(0xa8a29a, px - 50, py - 70, 100, 3); p.fill(0x6a645a, px - 50, py - 62, 100, 2);
  p.ell(0x14101a, px, py - 38, 26, 32); p.fill(0x14101a, px - 26, py - 38, 52, 40);
  for (let s = 0; s < 8; s++) p.fill(shadeC(0x7a7468, 1 - s * 0.08), px - 20 + s, py - 3 - s * 4, 40 - s * 2, 3);
  p.fill('rgba(255,240,190,0.5)', px - 3, py - 40, 6, 3); p.circ('rgba(255,240,190,0.18)', px, py - 38, 22);
  banner(p, px - 20, py - 70, 26, 0x6a645a, 0xf2c94c); banner(p, px + 14, py - 70, 26, 0x6a645a, 0xf2c94c);
};
/** AZ-05 Kosamoria: one palace, two courts: the sun by day, the moon by night */
const twinpalace: Draw = (p, d, px, py) => {
  dais(p, px, py, 56, 26, 0xd8d0c0, 3);
  // sun court, left: gold and white; moon court, right: indigo and silver with stars
  p.fill(0xf0e6c0, px - 50, py - 36, 48, 36); p.fill(0xd8c890, px - 50, py - 36, 6, 36); p.ell(0xf2c94c, px - 26, py - 36, 24, 20); p.ell(0xffe890, px - 30, py - 42, 10, 8);
  p.fill(0x2e2a5a, px + 2, py - 36, 48, 36); p.fill(0x1e1a42, px + 44, py - 36, 6, 36); p.ell(0x3e3a78, px + 26, py - 36, 24, 20); p.ell(0x7a76c8, px + 22, py - 42, 8, 6);
  for (let k = 0; k < 9; k++) p.circ('rgba(220,220,255,0.9)', px + 6 + ((k * 17) % 40), py - 34 + ((k * 13) % 30), 0.9);
  p.fill(0xe8e0d0, px - 4, py - 44, 8, 44); p.poly(0xf2c94c, [px - 6, py - 44, px, py - 62, px + 6, py - 44]);
  // sun and moon on the spire
  p.circ(0xffe070, px - 12, py - 66, 8); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; p.line(0xffe070, px - 12 + Math.cos(a) * 9, py - 66 + Math.sin(a) * 9, px - 12 + Math.cos(a) * 13, py - 66 + Math.sin(a) * 13, 1); }
  p.circ(0xc8c8ec, px + 12, py - 66, 8); p.circ(0x2e2a5a, px + 15, py - 68, 7);
  p.fill(0x6a4a2a, px - 20, py - 12, 10, 12); p.fill(0x1a1a3a, px + 10, py - 12, 10, 12); p.ell(0x6a4a2a, px - 15, py - 12, 5, 3); p.ell(0x1a1a3a, px + 15, py - 12, 5, 3);
  banner(p, px - 54, py + 4, 30, 0xf2c94c, 0xffffff); banner(p, px + 50, py + 4, 30, 0x3e3a78, 0xc8c8ec);
};
/** AZ-07 Azmeros: Eridan's cloud farm, the dragon every villager can speak to */
const eridan: Draw = (p, d, px, py) => {
  for (const [dx, dy, r] of [[-50, 10, 18], [48, 12, 20], [0, 24, 22], [-20, 26, 14]] as [number, number, number][]) { p.circ('rgba(255,255,255,0.6)', px + dx, py + dy, r); p.circ('rgba(255,255,255,0.4)', px + dx + 7, py + dy - 5, r * 0.7); }
  p.ell('rgba(0,0,0,0.25)', px + 4, py + 10, 46, 17); p.ell(0x7aa050, px, py, 44, 16); p.ell(0x9ac060, px - 2, py - 3, 40, 13);
  for (let r2 = 0; r2 < 3; r2++) for (let k = 0; k < 7; k++) p.fill(r2 % 2 ? 0xe0c050 : 0x6ab04a, px - 36 + k * 11, py - 2 + r2 * 5, 7, 3);
  // the dragon, curled round a hay-stack: green-gold, kind eyes
  p.ell(0xd8b040, px, py - 8, 16, 12); p.ell(0xf0cc60, px - 3, py - 12, 11, 7);
  const c = 0x58b070; for (const [dx, dy, r] of [[-22, -2, 7], [-20, -14, 7], [-8, -24, 7], [10, -22, 7], [22, -12, 7], [24, 0, 6]] as [number, number, number][]) { p.circ(shadeC(c, 0.7), px + dx + 1, py + dy + 1, r); p.circ(c, px + dx, py + dy, r); p.fill(0xe8c850, px + dx - 1, py + dy - r, 2, 2); }
  p.circ(c, px - 4, py - 34, 9); p.poly(c, [px - 12, py - 34, px - 22, py - 32, px - 12, py - 28]); p.poly(0xf2c94c, [px - 6, py - 41, px - 10, py - 52, px - 1, py - 42]); p.poly(0xf2c94c, [px + 1, py - 41, px + 5, py - 52, px + 5, py - 40]);
  p.circ(0xffffff, px - 6, py - 35, 2.2); p.circ(0x2a6a3a, px - 6, py - 35, 1.1); p.poly(shadeC(c, 1.15), [px + 6, py - 28, px + 30, py - 52, px + 22, py - 30]);
  p.fill(0x8a5a3a, px + 34, py - 20, 3, 22); p.fill(d.theme.banner[0], px + 30, py - 22, 11, 7); // a family altar flag
  for (let k = 0; k < 5; k++) p.circ(['#ffffff', '#f2c94c', '#e8607a'][k % 3], px - 30 + k * 14, py + 8, 1.6);
};
/** AZ-08 Kothidus: the floating-stone mine; the deeper they dig, the lower the island sinks */
const liftmine: Draw = (p, d, px, py) => {
  p.ell('rgba(0,0,0,0.3)', px + 5, py + 10, 52, 20); p.ell(0x4a3e38, px, py, 48, 18); p.ell(0x1a1210, px, py, 28, 10);
  p.fill(0x5e3a26, px - 30, py - 60, 5, 62); p.fill(0x5e3a26, px + 25, py - 60, 5, 62); p.line(0x6a4a2a, px - 30, py - 2, px + 25, py - 60, 3); p.line(0x6a4a2a, px + 25, py - 2, px - 30, py - 60, 3);
  p.fill(0x6a4a2a, px - 34, py - 64, 68, 6); p.circ(0x7a7a82, px, py - 70, 10); p.circ(0x3a3a40, px, py - 70, 4.5); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.line(0x5a5a62, px, py - 70, px + Math.cos(a) * 10, py - 70 + Math.sin(a) * 10, 1); }
  p.line(0x3a2a1a, px - 2, py - 62, px - 2, py - 26, 1.5); p.line(0x3a2a1a, px + 2, py - 62, px + 2, py - 26, 1.5);
  glow(p, px, py - 22, 22, 'rgba(120,200,255,0.3)'); p.poly(0x8ad0ff, [px - 10, py - 22, px - 4, py - 38, px + 6, py - 36, px + 11, py - 22, px + 2, py - 14]); p.poly(0xd8f4ff, [px - 4, py - 38, px + 6, py - 36, px, py - 24]); p.poly(0x5aa8e0, [px + 6, py - 36, px + 11, py - 22, px + 2, py - 14, px, py - 24]);
  for (let k = 0; k < 6; k++) p.circ('rgba(220,248,255,0.9)', px - 16 + ((k * 13) % 34), py - 46 + ((k * 7) % 28), 1.2);
  p.fill(0x4a4f60, px + 34, py - 6, 16, 9); p.fill(0x8ad0ff, px + 36, py - 10, 11, 4); p.circ(0x2a2a30, px + 38, py + 3, 2.5); p.circ(0x2a2a30, px + 47, py + 3, 2.5);
  p.line(0x6a5a50, px + 20, py + 4, px + 54, py + 8, 1);
};
/** AZ-09 Virnega: the artificial floating-stone pump that keeps the island up, and a flag with a broken chain */
const pump: Draw = (p, d, px, py) => {
  dais(p, px, py, 44, 21, 0x8a8a90, 2);
  p.fill(0x7a5a2a, px - 18, py - 56, 36, 54); p.fill(0xc08a3a, px - 18, py - 56, 8, 54); p.fill(0x5a3e1a, px + 12, py - 56, 6, 54);
  for (let j = 0; j < 5; j++) p.fill(0x3a2a14, px - 18, py - 50 + j * 11, 36, 2); p.ell(0xc08a3a, px, py - 56, 18, 6); p.ell(0x5a4a2a, px, py - 57, 14, 4);
  glow(p, px, py - 34, 20, 'rgba(120,200,255,0.3)'); p.circ(0x2a3a50, px, py - 34, 11); p.circ(0x8ad0ff, px, py - 34, 8); p.circ(0xd8f4ff, px - 2, py - 36, 3);
  for (const [dx, dy, r] of [[-30, -22, 11], [32, -40, 9], [-26, -48, 7]] as [number, number, number][]) { p.circ(0x6a6a72, px + dx, py + dy, r); p.circ(0x9a9aa4, px + dx, py + dy, r - 3); p.circ(0x44444a, px + dx, py + dy, r - 6); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; p.fill(0x9a9aa4, px + dx + Math.cos(a) * (r + 1) - 1.5, py + dy + Math.sin(a) * (r + 1) - 1.5, 3, 3); } }
  p.fill(0x5a5a62, px - 36, py - 16, 22, 4); p.fill(0x5a5a62, px + 14, py - 30, 28, 4);
  p.circ('rgba(220,220,226,0.55)', px + 10, py - 66, 5); p.circ('rgba(220,220,226,0.4)', px + 16, py - 78, 7);
  p.fill(0x4a3a22, px + 46, py - 60, 2, 62); p.poly(0xe8e0d0, [px + 48, py - 60, px + 64, py - 54, px + 48, py - 46]);
  p.x2.strokeStyle = hex(0x3a3a40); p.x2.lineWidth = 1.5; p.x2.beginPath(); p.x2.ellipse(px + 55, py - 53, 3, 2, 0, 0, 6.3); p.x2.stroke(); p.line(0x3a3a40, px + 51, py - 56, px + 54, py - 51, 1);
};
/** AZ-10 Nokmora: a tower under a rain that never stops, lanterns in the wet */
const rainspire: Draw = (p, d, px, py) => {
  p.ell('rgba(0,0,0,0.35)', px + 4, py + 10, 46, 17); p.ell(0x3a3e58, px, py + 2, 42, 14); p.ell(0x24284a, px, py, 36, 11);
  for (let k = 0; k < 3; k++) { p.x2.strokeStyle = 'rgba(160,180,230,0.5)'; p.x2.lineWidth = 1; p.x2.beginPath(); p.x2.ellipse(px - 8 + k * 9, py + 2, 6 + k, 2 + k * 0.4, 0, 0, 6.3); p.x2.stroke(); }
  p.poly(0x2a2e4a, [px - 14, py, px - 8, py - 100, px + 8, py - 100, px + 14, py]); p.poly(0x1e2240, [px + 2, py - 100, px + 8, py - 100, px + 14, py, px + 4, py]); p.poly(0x1a1e3a, [px - 12, py - 100, px, py - 130, px + 12, py - 100]);
  for (let k = 0; k < 6; k++) { p.fill(0xffd890, px - 2, py - 88 + k * 14, 4, 6); p.circ('rgba(255,216,144,0.3)', px, py - 85 + k * 14, 6); }
  p.fill(0x4a4e70, px - 12, py - 102, 24, 4); glow(p, px, py - 108, 14, 'rgba(160,200,255,0.35)'); p.circ(0xc8e0ff, px, py - 108, 3.5);
  for (let k = 0; k < 34; k++) { const rx = px - 50 + ((k * 29) % 100), ry = py - 112 + ((k * 47) % 110); p.line('rgba(170,190,240,0.55)', rx, ry, rx - 2, ry + 9, 1); }
  for (const dx of [-40, 36]) { p.fill(0x3a3e58, px + dx - 1, py - 26, 2, 28); p.circ('rgba(255,216,144,0.3)', px + dx, py - 28, 7); p.circ(0xffd890, px + dx, py - 28, 3); }
};

// ---------------------------------------------------------------- registry
export const LANDMARKS: Record<string, Draw> = { fountain, statue, bonfire, clock, sapling, obelisk, skynest, caldera, stairgate, twinpalace, eridan, liftmine, pump, rainspire };

// ---------------------------------------------------------------- where each monument stands, and the ground it takes
/** the ground a landmark takes, in px around its base point: the elliptical base, and the tall part rising above it that people must not walk "behind" */
export const FOOT: Record<string, { rx: number; ry: number; up: number; upW: number }> = {
  fountain: { rx: 42, ry: 22, up: 44, upW: 14 }, statue: { rx: 40, ry: 21, up: 82, upW: 26 }, bonfire: { rx: 48, ry: 18, up: 30, upW: 60 }, clock: { rx: 32, ry: 16, up: 82, upW: 30 },
  sapling: { rx: 40, ry: 20, up: 94, upW: 60 }, obelisk: { rx: 36, ry: 18, up: 94, upW: 24 }, skynest: { rx: 62, ry: 30, up: 150, upW: 72 }, caldera: { rx: 60, ry: 30, up: 0, upW: 0 },
  stairgate: { rx: 56, ry: 22, up: 74, upW: 100 }, twinpalace: { rx: 58, ry: 28, up: 62, upW: 100 }, eridan: { rx: 52, ry: 20, up: 54, upW: 50 }, liftmine: { rx: 54, ry: 22, up: 76, upW: 60 },
  pump: { rx: 46, ry: 22, up: 72, upW: 70 }, rainspire: { rx: 46, ry: 18, up: 112, upW: 24 }, abyss: { rx: 52, ry: 30, up: 0, upW: 0 },
  arkea: { rx: 64, ry: 36, up: 0, upW: 0 }, gate: { rx: 46, ry: 24, up: 0, upW: 0 }, lake: { rx: 50, ry: 30, up: 0, upW: 0 }, airship: { rx: 70, ry: 16, up: 44, upW: 120 },
  lighthouse: { rx: 22, ry: 10, up: 58, upW: 22 }, council: { rx: 62, ry: 35, up: 24, upW: 90 }, pyramid: { rx: 56, ry: 16, up: 66, upW: 100 }, crystal: { rx: 30, ry: 10, up: 56, upW: 40 },
  oasis: { rx: 38, ry: 22, up: 30, upW: 30 }, forge: { rx: 22, ry: 12, up: 30, upW: 30 }, gear: { rx: 22, ry: 22, up: 0, upW: 0 },
};
/** where a country's monument belongs: in the square (to one side of it), at the rim of the town toward the cliff or shore, or in a quarter of its own */
export type Site = 'plaza' | 'core' | 'edge' | 'shore' | 'offset' | 'craft';
export const SITE: Record<string, Site> = {
  fountain: 'plaza', statue: 'plaza', council: 'plaza', clock: 'plaza', obelisk: 'offset', bonfire: 'plaza', sapling: 'offset', oasis: 'offset', crystal: 'offset',
  skynest: 'edge', caldera: 'edge', stairgate: 'edge', twinpalace: 'plaza', eridan: 'offset', liftmine: 'craft', pump: 'craft', rainspire: 'edge', lake: 'shore',
  airship: 'shore', lighthouse: 'shore', pyramid: 'edge', abyss: 'edge', arkea: 'edge', gate: 'edge', forge: 'craft', gear: 'craft',
};
