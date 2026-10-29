// The heart of a town: the paved square and the monument that stands in it. Every landmark is drawn large, on a stepped dais, with
// the town's own banners, so a visitor reads it at once as "the place this town is about". The sky nations of Azgar each have their
// own, taken from docs/countries/01-azgar.md (the dragon's nest of Oran-Sal, the caldera of the fire elder, the stair gate...).
import { type Pen, hex, shadeC, mixC } from './draw';
import type { CityData } from './citygen';
import { leafCluster, leafRng } from '../render/treeart';
import { T, CW, Tile } from './citygen';
import { RNG, hashString } from '../sim/rng';

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

/** how each continent lays its square: the paving, its pattern and its inlay, over the whole square and not just a ring round the monument */
export function paintSquare(p: Pen, d: CityData, px: number, py: number) {
  const th = d.theme, { x, y, w, h } = d.plaza, x2 = p.x2, X = x * T, Y = y * T, W = w * T, H = h * T;
  const cx = X + W / 2, cy = Y + H / 2, base = th.plaza, [b0, b1] = th.banner, r = new RNG(hashString('sq' + d.townId));
  const live = (tx: number, ty: number) => d.grid[ty * CW + tx] === Tile.Plaza && !d.wet[ty * CW + tx];
  x2.save();
  x2.beginPath();
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) if (live(tx, ty)) x2.rect(tx * T, ty * T, T, T);
  x2.clip();
  const id = th.id, plain = d.plazaMode === 'none' || d.plazaMode === 'heart';
  // the field of the paving
  if (id === 'kazdurum' || id === 'mecharia') {
    // slabs of iron / steel plate with rivets; on Kaz-Durum the seams glow like a banked forge
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) {
      const A = tx * T, B = ty * T, c = shadeC(base, ((tx + ty) % 2 ? 0.9 : 1.04));
      p.fill(c, A, B, T, T); p.fill(shadeC(base, 0.62), A, B, T, 1); p.fill(shadeC(base, 0.62), A, B, 1, T);
      p.fill(shadeC(base, 1.25), A + 1, B + 1, T - 2, 1);
      for (const [rx, ry] of [[3, 3], [T - 4, 3], [3, T - 4], [T - 4, T - 4]]) p.fill(shadeC(base, 1.3), A + rx, B + ry, 2, 2);
    }
    if (id === 'kazdurum') { x2.strokeStyle = 'rgba(240,120,50,0.4)'; x2.lineWidth = 1.5; for (let k = 0; k < 7; k++) { x2.beginPath(); x2.moveTo(cx, cy); x2.lineTo(cx + Math.cos(k * 0.9) * W, cy + Math.sin(k * 0.9) * H); x2.stroke(); } }
  } else if (id === 'saharan') {
    // a mosaic of diamonds in three colours
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) {
      const A = tx * T, B = ty * T, c = [mixC(base, b0, 0.35), shadeC(base, 1.05), mixC(base, b1, 0.3)][(tx + ty * 2) % 3];
      p.fill(shadeC(base, 0.92), A, B, T, T); p.poly(c, [A + T / 2, B + 1, A + T - 1, B + T / 2, A + T / 2, B + T - 1, A + 1, B + T / 2]);
      p.circ(shadeC(c, 0.8), A + T / 2, B + T / 2, 1.5);
    }
  } else if (id === 'silvanel') {
    // trodden earth and moss, roots crawling over the stones and a sap that glows along them
    p.fill(mixC(base, 0x8a7448, 0.4), X, Y, W, H);
    for (let k = 0; k < 220; k++) { const mx = X + r.float(0, W), my = Y + r.float(0, H), m = r.pick([0x6a9a4a, 0x4a8a44, 0x82a85a, 0x5a7a3a]); p.ell(m, mx, my, r.float(3, 9), r.float(2, 5)); }
    for (let k = 0; k < 90; k++) { const A = X + r.float(0, W), B = Y + r.float(0, H); p.fill(shadeC(base, r.float(0.8, 1.12)), A, B, r.int(4, 9), r.int(3, 6)); p.fill(shadeC(base, 0.66), A, B + 4, 5, 1); }
    for (let k = 0; k < 9; k++) {
      const a0 = (k / 9) * Math.PI * 2 + r.float(-0.2, 0.2); let ax = px, ay = py;
      const path: [number, number][] = [[ax, ay]];
      for (let st = 0; st < 12; st++) { const a = a0 + Math.sin(st * 0.9 + k) * 0.45; ax += Math.cos(a) * 17; ay += Math.sin(a) * 9; path.push([ax, ay]); }
      for (const [col, lw] of [['#4a3322', 4], ['#6a4a30', 2.4], ['rgba(150,255,150,0.55)', 1]] as [string, number][]) { x2.strokeStyle = col; x2.lineWidth = lw; x2.lineCap = 'round'; x2.beginPath(); path.forEach(([qx, qy], i) => i ? x2.lineTo(qx, qy) : x2.moveTo(qx, qy)); x2.stroke(); }
    }
    for (let k = 0; k < 60; k++) p.circ(r.pick([0xf2c94c, 0xf4a0c0, 0xffffff, 0xa0d0ff]), X + r.float(4, W - 4), Y + r.float(4, H - 4), 1.3);
  } else if (id === 'nebulia' || id === 'morhaven') {
    // irregular flags and cobbles: wet and blue-grey under the fog, dust and cracked under the ash
    p.fill(shadeC(base, 0.78), X, Y, W, H);
    for (let ty = y * 2; ty < (y + h) * 2; ty++) for (let tx = x * 2; tx < (x + w) * 2; tx++) {
      const A = tx * 8 + ((ty % 2) * 4), B = ty * 8, c = shadeC(base, r.float(0.88, 1.14));
      p.ell(c, A + 4, B + 4, r.float(3, 4.2), r.float(2.6, 3.8));
      p.ell('rgba(255,255,255,0.12)', A + 3, B + 3, 1.6, 1);
    }
    if (id === 'morhaven') { x2.strokeStyle = 'rgba(40,24,16,0.55)'; x2.lineWidth = 1.2; for (let k = 0; k < 14; k++) { let ax = X + r.float(0, W), ay = Y + r.float(0, H); x2.beginPath(); x2.moveTo(ax, ay); for (let st = 0; st < 5; st++) { ax += r.float(-12, 12); ay += r.float(-8, 8); x2.lineTo(ax, ay); } x2.stroke(); } }
  } else {
    // flagstones laid in rings round the monument (the plains, the sea and the sky share this)
    p.fill(shadeC(base, 0.9), X, Y, W, H);
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) {
      const A = tx * T, B = ty * T, v = ((tx * 7 + ty * 13) % 5) / 5;
      p.fill(shadeC(base, 0.98 + v * 0.1), A + 1, B + 1, T / 2 - 1, T / 2 - 1); p.fill(shadeC(base, 1.04 - v * 0.08), A + T / 2, B + 1, T / 2 - 1, T / 2 - 1);
      p.fill(shadeC(base, 1.06 - v * 0.1), A + 1, B + T / 2, T / 2 - 1, T / 2 - 1); p.fill(shadeC(base, 0.96 + v * 0.12), A + T / 2, B + T / 2, T / 2 - 1, T / 2 - 1);
    }
  }
  // the inlay: a ring and a star of the country's colours around the monument, so the square has a heart even where the monument is small
  const rr = Math.min(W * 0.3, H * 0.62), ry = rr * 0.5;
  if (!plain) {
  p.ell(shadeC(base, 0.6), px, py, rr + 4, ry + 3); p.ell(mixC(base, b0, 0.5), px, py, rr + 1, ry + 1); p.ell(shadeC(base, 1.04), px, py, rr - 3, ry - 2);
  p.ell(mixC(base, b1, 0.35), px, py, rr * 0.72, ry * 0.72); p.ell(shadeC(base, 1.08), px, py, rr * 0.72 - 3, ry * 0.72 - 2);
  x2.strokeStyle = hex(mixC(base, b0, 0.6)); x2.lineWidth = 1.6;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; x2.beginPath(); x2.moveTo(px + Math.cos(a) * rr * 0.34, py + Math.sin(a) * ry * 0.34); x2.lineTo(px + Math.cos(a) * (rr - 2), py + Math.sin(a) * (ry - 1)); x2.stroke(); }
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; p.circ(mixC(base, k % 2 ? b1 : b0, 0.8), px + Math.cos(a) * (rr + 1), py + Math.sin(a) * (ry + 1), 1.8); }
  }
  // the kerb all round the square, and the four corner stones
  x2.strokeStyle = hex(shadeC(base, 0.55)); x2.lineWidth = 3; x2.strokeRect(X + 1.5, Y + 1.5, W - 3, H - 3);
  x2.strokeStyle = hex(shadeC(base, 1.18)); x2.lineWidth = 1; x2.strokeRect(X + 3.5, Y + 3.5, W - 7, H - 7);
  for (const [qx, qy] of [[X + 7, Y + 7], [X + W - 7, Y + 7], [X + 7, Y + H - 7], [X + W - 7, Y + H - 7]]) { p.circ(shadeC(base, 0.6), qx, qy, 4); p.circ(mixC(base, b0, 0.6), qx, qy, 2.6); }
  x2.restore();
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

// ---------------------------------------------------------------- the three common monuments that were only small stones: the great forge, the gear works and the oasis
/** Kaz-Durum: a great furnace in the square, glowing at its mouth, a chimney going up, an anvil and a hammer before it */
const forge: Draw = (p, d, px, py) => {
  dais(p, px, py, 46, 23, 0x6a6670, 3);
  p.fill(0x3a3640, px - 26, py - 40, 52, 40); p.fill(0x5a5662, px - 26, py - 40, 9, 40); p.fill(0x24202a, px + 15, py - 40, 11, 40);
  for (let j = 0; j < 6; j++) p.fill(0x24202a, px - 26, py - 35 + j * 7, 52, 1);
  p.fill(0x2a2630, px - 29, py - 44, 58, 6); p.fill(0x4a4652, px - 29, py - 44, 58, 2);
  p.fill(0x140c0a, px - 14, py - 24, 28, 24); p.ell(0x140c0a, px, py - 24, 14, 10);
  p.fill(0xc2360c, px - 11, py - 17, 22, 17); p.ell(0xc2360c, px, py - 17, 11, 8); p.fill(0xf08c3a, px - 8, py - 11, 16, 11); p.ell(0xf08c3a, px, py - 11, 8, 6); p.ell(0xffd36a, px, py - 6, 5, 4);
  glow(p, px, py - 12, 34, 'rgba(255,120,40,0.3)');
  p.fill(0x34303a, px - 9, py - 84, 18, 42); p.fill(0x4a4652, px - 9, py - 84, 5, 42); p.fill(0x24202a, px - 12, py - 88, 24, 6);
  p.circ('rgba(70,60,56,0.55)', px + 3, py - 98, 8); p.circ('rgba(70,60,56,0.4)', px + 10, py - 112, 11); p.circ('rgba(70,60,56,0.25)', px + 18, py - 128, 14);
  for (let k = 0; k < 6; k++) p.circ('rgba(255,170,60,0.9)', px - 6 + ((k * 13) % 22), py - 96 - ((k * 17) % 34), 1.3);
  p.fill(0x4a4f60, px + 30, py + 4, 14, 3); p.fill(0x7a7f90, px + 28, py + 1, 18, 4); p.fill(0x4a4f60, px + 34, py + 7, 6, 7);
  p.line(0x8a5a3a, px - 38, py + 2, px - 30, py - 12, 3); p.fill(0x4a4f60, px - 41, py - 16, 12, 6);
  for (const [dx, dy] of [[-40, 10], [-34, 12], [-37, 7]]) { p.fill(0xe8742a, px + dx, py + dy, 10, 4); p.fill(0xffd36a, px + dx, py + dy, 10, 1); }
  for (const s2 of [-1, 1]) { p.fill(0x34303a, px + s2 * 52 - 2, py - 24, 4, 26); p.fill(0x1a1612, px + s2 * 52 - 6, py - 30, 12, 7); flame(p, px + s2 * 52, py - 30, 1); }
  banner(p, px - 56, py + 4, 36, d.theme.banner[0], d.theme.banner[1]); banner(p, px + 52, py + 4, 36, d.theme.banner[1], d.theme.banner[0]);
};
/** Mecharia: a flat brass gear laid in the paving with a boiler tower and its pressure gauge standing on it, steam rising */
const gear: Draw = (p, d, px, py) => {
  dais(p, px, py, 48, 24, 0x7a7a80, 2);
  const teeth = 16, brass = 0xc49a3a;
  for (let k = 0; k < teeth; k++) { const a = (k / teeth) * Math.PI * 2, cx = px + Math.cos(a) * 40, cy = py - 2 + Math.sin(a) * 20; p.poly(shadeC(brass, 0.72), [cx - 4, cy - 3, cx + 4, cy - 3, cx + 4, cy + 5, cx - 4, cy + 5]); p.poly(brass, [cx - 4, cy - 5, cx + 4, cy - 5, cx + 4, cy + 1, cx - 4, cy + 1]); }
  p.ell(shadeC(brass, 0.7), px, py, 38, 19); p.ell(brass, px, py - 2, 37, 18); p.ell(shadeC(brass, 0.8), px, py - 2, 26, 12.5); p.ell(shadeC(brass, 1.12), px, py - 3, 24, 11);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; p.line(shadeC(brass, 0.6), px + Math.cos(a) * 6, py - 3 + Math.sin(a) * 3, px + Math.cos(a) * 25, py - 3 + Math.sin(a) * 12, 3); }
  p.ell(0x4a4a52, px, py - 3, 8, 4);
  p.fill(0x5a5a62, px - 13, py - 82, 26, 76); p.fill(0x7a7a84, px - 13, py - 82, 7, 76); p.fill(0x3e3e46, px + 7, py - 82, 6, 76);
  for (let j = 0; j < 8; j++) { p.fill(0x34343c, px - 13, py - 76 + j * 9, 26, 1); for (const rx of [-10, 0, 10]) p.fill(0x9a9aa4, px + rx, py - 75 + j * 9, 2, 2); }
  p.ell(0x6a6a74, px, py - 84, 13, 5); p.ell(0x8a8a94, px, py - 87, 11, 4);
  p.circ(0x2a2a30, px, py - 52, 10); p.circ(0xe8e2c8, px, py - 52, 8.4); p.line(0x1a1a22, px, py - 52, px + 5, py - 57, 1.5); p.line(0xc2360c, px, py - 52, px - 6, py - 49, 1.2);
  p.line(0x6a6a74, px + 13, py - 70, px + 36, py - 70, 5); p.line(0x6a6a74, px + 36, py - 70, px + 36, py - 14, 5); p.fill(0x4a4a52, px + 30, py - 16, 12, 5);
  for (const [dx, dy, r] of [[2, -98, 7], [8, -112, 10], [16, -128, 13], [26, -144, 15]] as [number, number, number][]) p.circ('rgba(235,235,240,' + (0.55 - r * 0.02) + ')', px + dx, py + dy, r);
  for (const s2 of [-1, 1]) { p.fill(0x4a4a52, px + s2 * 54 - 2, py - 30, 4, 32); p.circ(0xffd070, px + s2 * 54, py - 34, 4); p.circ('rgba(255,220,120,0.3)', px + s2 * 54, py - 34, 11); }
  banner(p, px - 60, py + 4, 36, d.theme.banner[0], d.theme.banner[1]);
};
/** Saharan: the spring itself, a turquoise pool ringed with stone and reeds, three date palms and a striped shade beside it */
const oasis: Draw = (p, d, px, py) => {
  p.ell('rgba(0,0,0,0.22)', px + 4, py + 8, 50, 26); p.ell(0xb8986a, px, py + 2, 49, 25); p.ell(0xe8d8a8, px, py, 46, 23);
  for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; p.ell(k % 2 ? 0xd8c48c : 0xc4a870, px + Math.cos(a) * 43, py + Math.sin(a) * 21, 5, 3); }
  p.ell(0x1e7c8a, px, py, 39, 18); p.ell(0x2e9aa8, px, py - 1, 36, 16); p.ell(0x5ad0d8, px - 4, py - 2, 27, 10); p.ell(0xa8f0f0, px - 10, py - 5, 12, 3.5);
  p.x2.strokeStyle = 'rgba(255,255,255,0.5)'; p.x2.lineWidth = 1; for (let k = 0; k < 3; k++) { p.x2.beginPath(); p.x2.ellipse(px + 8, py + 1, 6 + k * 5, 2.5 + k * 2, 0, 0, 6.3); p.x2.stroke(); }
  for (const [lx, ly] of [[-18, 4], [14, -6], [22, 6]]) { p.ell(0x3e9a4a, px + lx, py + ly, 5, 2); p.circ(0xf4a0c0, px + lx + 1, py + ly - 1, 1.6); }
  const palm = (tx: number, ty: number, h: number, lean: number) => {
    p.ell('rgba(0,0,0,0.2)', tx + 5, ty + 2, 10, 3);
    p.x2.strokeStyle = hex(0x8a6a3a); p.x2.lineWidth = 4; p.x2.lineCap = 'round'; p.x2.beginPath(); p.x2.moveTo(tx, ty); p.x2.quadraticCurveTo(tx + lean * 0.2, ty - h * 0.6, tx + lean, ty - h); p.x2.stroke();
    p.x2.lineWidth = 1; p.x2.strokeStyle = hex(0x5e4a28); for (let j = 1; j < 6; j++) { p.x2.beginPath(); p.x2.moveTo(tx + lean * 0.2 * j / 6 - 2, ty - h * j / 6); p.x2.lineTo(tx + lean * 0.2 * j / 6 + 2, ty - h * j / 6); p.x2.stroke(); }
    const hx = tx + lean, hy = ty - h;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.line(k % 2 ? 0x3e9a4a : 0x2a7a3a, hx, hy, hx + Math.cos(a) * 17, hy + Math.sin(a) * 8 + 5, 3); }
    p.circ(0xc4801c, hx - 2, hy + 3, 1.8); p.circ(0xc4801c, hx + 2, hy + 4, 1.8);
  };
  palm(px - 34, py - 8, 54, -10); palm(px + 38, py - 10, 62, 12); palm(px + 4, py - 16, 70, 4);
  for (const [rx, ry] of [[-40, 8], [-28, 18], [34, 12], [42, 4]]) for (let k = 0; k < 4; k++) p.line(0x4aa04e, px + rx + k * 2, py + ry, px + rx + k * 2 + (k - 1.5), py + ry - 10 - (k % 2) * 4, 1.5);
  p.fill(0x8a6a3a, px + 50, py - 20, 2, 28); p.fill(0x8a6a3a, px + 78, py - 20, 2, 28);
  for (let j = 0; j < 30; j += 6) p.fill((j / 6) % 2 ? 0xf4eedc : d.theme.banner[0], px + 49 + j, py - 24, 6, 5);
  p.fill('rgba(0,0,0,0.18)', px + 50, py + 4, 30, 5);
};

export { dais, banner, flame, glow };

/** the monuments an ordinary town may keep, drawn smaller than the capital's: the ones that stand in a square */
export const MINOR_CENTRE = new Set(['fountain', 'statue', 'bonfire', 'clock', 'sapling', 'obelisk', 'forge', 'gear', 'oasis']);

/** what each continent sets around its square; the town picks from this list at random along the edge */
export const FURNITURE: Record<string, string[]> = {
  azgar: ['pennant', 'pennant', 'lamp', 'planter', 'bench', 'urn'],
  morhaven: ['skullpole', 'skullpole', 'brazier', 'rack', 'bones', 'barrel'],
  kazdurum: ['brazier', 'brazier', 'anvil', 'cart', 'grate', 'barrel'],
  nerea: ['barrel', 'net', 'tub', 'bench', 'planter', 'crate'],
  aldria: ['bench', 'planter', 'crate', 'board', 'lamp', 'tree', 'barrel'],
  mecharia: ['lamp', 'pipe', 'crate', 'gearpost', 'bench', 'pipe'],
  saharan: ['jar', 'awning', 'palm', 'cushion', 'jar', 'lamp'],
  silvanel: ['lantern', 'lantern', 'mushroom', 'fern', 'stump', 'glowflower', 'bench', 'tree'],
  nebulia: ['lamp', 'lamp', 'urn', 'bench', 'raven', 'deadtree'],
};

type Prop = (p: Pen, d: CityData, x: number, y: number, v: number) => void;
const FLOWERS = [0xe8607a, 0xf2c94c, 0xc07aff, 0xf4f4f4, 0xff9a4a, 0x7ac0ff];
const shade = (p: Pen, x: number, y: number, rx: number) => p.ell('rgba(0,0,0,0.25)', x + 3, y, rx, rx * 0.32);
const PROPS: Record<string, Prop> = {
  bench: (p, d, x, y, v) => { shade(p, x, y, 13); p.fill(0x4a3220, x - 10, y - 6, 2, 6); p.fill(0x4a3220, x + 8, y - 6, 2, 6); p.fill(0x7a5632, x - 12, y - 9, 24, 4); p.fill(0x9a7444, x - 12, y - 9, 24, 1); p.fill(0x5e4224, x - 12, y - 15, 24, 3); p.fill(0x4a3220, x - 11, y - 15, 2, 7); p.fill(0x4a3220, x + 9, y - 15, 2, 7); },
  lamp: (p, d, x, y) => { shade(p, x, y, 5); p.fill(0x2a2a30, x - 1, y - 24, 2, 24); p.fill(0x2a2a30, x - 3, y - 2, 6, 2); p.circ('rgba(255,210,110,0.28)', x, y - 28, 11); p.fill(0x2a2a30, x - 4, y - 29, 8, 2); p.fill(0xffd070, x - 3, y - 27, 6, 5); p.fill(0x2a2a30, x - 4, y - 32, 8, 3); },
  planter: (p, d, x, y, v) => { shade(p, x, y, 11); p.fill(0x8a8478, x - 9, y - 7, 18, 7); p.fill(0xb8b0a0, x - 9, y - 7, 18, 2); p.fill(0x6a645a, x + 5, y - 7, 4, 7); p.circ(0x3a8a3e, x, y - 10, 6); p.circ(0x4aa04e, x - 4, y - 11, 4); for (let k = 0; k < 6; k++) p.circ(FLOWERS[(v + k) % 6], x - 6 + k * 2.4, y - 11 - (k % 2) * 3, 1.5); },
  tree: (p, d, x, y, v) => { shade(p, x, y, 14); p.fill(0x5e3a26, x - 2, y - 14, 4, 14); p.circ(0x2e7a3e, x, y - 22, 11); p.circ(0x3e9a4a, x - 4, y - 25, 7); p.circ(0x5ab85e, x + 4, y - 27, 4); },
  crate: (p, d, x, y, v) => { shade(p, x, y, 10); p.fill(0x8a6a3e, x - 8, y - 9, 16, 9); p.fill(0xa8844e, x - 8, y - 9, 16, 2); p.fill(0x5e4224, x - 8, y - 5, 16, 1); p.fill(0x6a4e2a, x - 8, y - 9, 1, 9); p.fill(0x6a4e2a, x + 7, y - 9, 1, 9); p.fill(0x8a6a3e, x - 3, y - 15, 11, 6); p.fill(0xe04848, x - 1, y - 17, 3, 3); p.fill(0xf2c94c, x + 3, y - 17, 3, 3); },
  barrel: (p, d, x, y) => { shade(p, x, y, 8); p.fill(0x8a5a3a, x - 6, y - 12, 12, 12); p.ell(0x8a5a3a, x, y - 12, 6, 2); p.ell(0x5e3a26, x, y - 12, 4.5, 1.5); p.fill(0x3a2a1a, x - 6, y - 9, 12, 1); p.fill(0x3a2a1a, x - 6, y - 4, 12, 1); p.fill(0xa87a4a, x - 4, y - 12, 2, 12); },
  board: (p, d, x, y, v) => { shade(p, x, y, 11); p.fill(0x5e3a26, x - 9, y - 22, 2, 22); p.fill(0x5e3a26, x + 7, y - 22, 2, 22); p.fill(0x8a6a3e, x - 11, y - 26, 22, 14); p.fill(0xe8e0c0, x - 8, y - 24, 7, 6); p.fill(0xd8d0b0, x + 1, y - 24, 7, 5); p.fill(0xe8e0c0, x - 5, y - 17, 8, 4); p.fill(0xc2360c, x - 6, y - 25, 1, 1); },
  pennant: (p, d, x, y) => { shade(p, x, y, 6); p.fill(0xe8e2d4, x - 2, y - 5, 4, 5); p.fill(0xd8d0c0, x - 1, y - 40, 2, 36); p.circ(0xf2c94c, x, y - 41, 2.4); p.poly(d.theme.banner[0], [x + 1, y - 38, x + 14, y - 33, x + 1, y - 26]); p.poly(d.theme.banner[1], [x + 1, y - 38, x + 6, y - 36, x + 1, y - 31]); },
  urn: (p, d, x, y) => { shade(p, x, y, 8); p.fill(0xcfc8b8, x - 5, y - 4, 10, 4); p.ell(0xe8e2d4, x, y - 9, 6, 6); p.fill(0xcfc8b8, x - 3, y - 17, 6, 5); p.ell(0xe8e2d4, x, y - 17, 5, 1.8); p.fill(d.theme.banner[0], x - 6, y - 10, 12, 1.5); p.circ(0x4aa04e, x, y - 20, 3); },
  skullpole: (p, d, x, y, v) => { shade(p, x, y, 7); p.fill(0x4a3a2a, x - 1.5, y - 34, 3, 34); p.circ(0xe0d8c4, x, y - 36, 5); p.fill(0x1a1210, x - 3, y - 37, 2, 2); p.fill(0x1a1210, x + 1, y - 37, 2, 2); p.fill(0xe0d8c4, x - 3, y - 32, 6, 2); p.poly(0x8a2a22, [x + 1, y - 28, x + 11, y - 22, x + 6, y - 14, x + 1, y - 18]); p.line(0xc8b898, x - 7, y - 24, x + 7, y - 24, 2); },
  brazier: (p, d, x, y) => { shade(p, x, y, 9); p.fill(0x2a2a30, x - 6, y - 14, 2, 14); p.fill(0x2a2a30, x + 4, y - 14, 2, 14); p.poly(0x34343c, [x - 9, y - 16, x + 9, y - 16, x + 6, y - 9, x - 6, y - 9]); p.ell(0x1a1210, x, y - 16, 9, 2.4); flame(p, x, y - 15, 1.3); },
  anvil: (p, d, x, y) => { shade(p, x, y, 10); p.fill(0x5e3a26, x - 6, y - 9, 12, 9); p.fill(0x4a4f60, x - 8, y - 14, 16, 4); p.fill(0x7a7f90, x - 10, y - 17, 20, 4); p.poly(0x7a7f90, [x + 10, y - 17, x + 16, y - 15, x + 10, y - 13]); p.fill(0xe8742a, x - 4, y - 19, 6, 2); },
  cart: (p, d, x, y) => { shade(p, x, y, 14); p.fill(0x5e3a26, x - 12, y - 11, 24, 8); p.fill(0x7a5238, x - 12, y - 11, 24, 2); for (const rx of [-10, 10]) { p.circ(0x2a2a30, x + rx, y - 3, 4.5); p.circ(0x6a6a74, x + rx, y - 3, 2); } for (let k = 0; k < 5; k++) p.circ(k % 2 ? 0x8a8a94 : 0xe8742a, x - 8 + k * 4, y - 14 - (k % 2), 3.4); },
  grate: (p, d, x, y) => { p.fill(0x1a1612, x - 10, y - 6, 20, 8); p.fill(0xc2360c, x - 9, y - 5, 18, 6); for (let k = 0; k < 6; k++) p.fill(0x2a2a30, x - 9 + k * 3.6, y - 5, 1.6, 6); p.fill(0x2a2a30, x - 9, y - 3, 18, 1.4); p.circ('rgba(255,120,40,0.25)', x, y - 2, 13); },
  bones: (p, d, x, y, v) => { shade(p, x, y, 11); for (let k = 0; k < 4; k++) { p.line(0xe0d8c4, x - 8 + k * 4, y - 2 - (k % 2) * 2, x - 3 + k * 4, y - 8 + (k % 2) * 3, 2); p.circ(0xe0d8c4, x - 8 + k * 4, y - 2 - (k % 2) * 2, 1.6); } p.circ(0xe0d8c4, x + 2, y - 8, 4.5); p.fill(0x1a1210, x, y - 9, 1.6, 1.6); p.fill(0x1a1210, x + 3, y - 9, 1.6, 1.6); },
  rack: (p, d, x, y) => { shade(p, x, y, 12); p.fill(0x4a3a2a, x - 11, y - 18, 2, 18); p.fill(0x4a3a2a, x + 9, y - 18, 2, 18); p.fill(0x4a3a2a, x - 11, y - 16, 22, 2); for (let k = 0; k < 5; k++) { p.line(0x8a5a3a, x - 8 + k * 4, y - 3, x - 7 + k * 4, y - 26, 1.5); p.poly(0xb8b8c4, [x - 9 + k * 4, y - 26, x - 7 + k * 4, y - 26, x - 8 + k * 4, y - 31]); } },
  net: (p, d, x, y) => { shade(p, x, y, 12); p.fill(0x5e3a26, x - 12, y - 20, 2, 20); p.fill(0x5e3a26, x + 10, y - 20, 2, 20); p.fill(0x5e3a26, x - 12, y - 20, 24, 2); p.x2.strokeStyle = 'rgba(190,170,120,0.9)'; p.x2.lineWidth = 0.8; for (let k = 0; k <= 6; k++) { p.x2.beginPath(); p.x2.moveTo(x - 10 + k * 3.4, y - 18); p.x2.lineTo(x - 10 + k * 3.4 + (k % 2 ? 1 : -1), y - 5); p.x2.stroke(); } for (let k = 0; k < 3; k++) p.fill(0x9ab8c8, x - 8 + k * 7, y - 6, 4, 2); },
  tub: (p, d, x, y) => { shade(p, x, y, 13); p.fill(0x8a5a3a, x - 12, y - 8, 24, 8); p.fill(0xa87a4a, x - 12, y - 8, 24, 2); p.fill(0x3f8ad0, x - 10, y - 7, 20, 3); p.fill(0x7ac0f0, x - 8, y - 7, 8, 1); p.fill(0x3a2a1a, x - 12, y - 3, 24, 1); },
  pipe: (p, d, x, y, v) => { shade(p, x, y, 9); p.fill(0x6a6a74, x - 3, y - 22, 6, 22); p.fill(0x8a8a94, x - 3, y - 22, 2, 22); p.line(0x6a6a74, x, y - 20, x + 12, y - 20, 4); p.fill(0x4a4a52, x + 9, y - 20, 6, 14); p.circ('rgba(235,235,240,0.5)', x - 2, y - 28, 5); p.circ('rgba(235,235,240,0.32)', x + 2, y - 35, 7); p.fill(0xc49a3a, x - 4, y - 12, 8, 2); },
  gearpost: (p, d, x, y) => { shade(p, x, y, 8); p.fill(0x4a4a52, x - 2, y - 20, 4, 20); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.fill(0xc49a3a, x + Math.cos(a) * 8 - 1.5, y - 22 + Math.sin(a) * 8 - 1.5, 3, 3); } p.circ(0xc49a3a, x, y - 22, 6.5); p.circ(0x4a4a52, x, y - 22, 2.4); },
  jar: (p, d, x, y, v) => { shade(p, x, y, 8); p.ell(0xb8683a, x, y - 8, 7, 8); p.fill(0xa85a30, x - 3, y - 18, 6, 4); p.ell(0xc87848, x, y - 18, 4, 1.6); p.fill(d.theme.banner[v % 2], x - 6, y - 10, 12, 2); p.fill(0x7a3e1e, x + 3, y - 12, 3, 8); },
  awning: (p, d, x, y, v) => { shade(p, x, y, 14); p.fill(0x8a6a3a, x - 13, y - 20, 2, 20); p.fill(0x8a6a3a, x + 11, y - 20, 2, 20); for (let j = 0; j < 26; j += 5) p.fill((j / 5) % 2 ? 0xf4eedc : [d.theme.banner[0], d.theme.banner[1]][v % 2], x - 13 + j, y - 24, 5, 6); p.fill('rgba(0,0,0,0.2)', x - 12, y - 4, 24, 4); p.fill(0xc87848, x - 8, y - 6, 16, 4); p.fill(0xe8d8a8, x - 6, y - 8, 12, 2); },
  palm: (p, d, x, y, v) => { shade(p, x, y, 10); p.x2.strokeStyle = hex(0x8a6a3a); p.x2.lineWidth = 3; p.x2.beginPath(); p.x2.moveTo(x, y); p.x2.quadraticCurveTo(x + 2, y - 18, x + (v % 2 ? 5 : -5), y - 34); p.x2.stroke(); const hx = x + (v % 2 ? 5 : -5), hy = y - 34; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; p.line(k % 2 ? 0x3e9a4a : 0x2a7a3a, hx, hy, hx + Math.cos(a) * 14, hy + Math.sin(a) * 6 + 4, 2.4); } p.circ(0xc4801c, hx, hy + 3, 1.6); },
  cushion: (p, d, x, y, v) => { shade(p, x, y, 13); p.fill(0xc2a874, x - 12, y - 4, 24, 4); p.ell(d.theme.banner[v % 2], x - 6, y - 6, 7, 3.4); p.ell(mixC(d.theme.banner[(v + 1) % 2], 0xffffff, 0.2), x + 5, y - 6, 7, 3.4); p.circ(0xf2c94c, x - 6, y - 6, 1); p.fill(0xe8d8a8, x - 3, y - 12, 6, 6); p.fill(0x6a4a2a, x - 1, y - 14, 2, 3); },
  lantern: (p, d, x, y) => { shade(p, x, y, 6); p.fill(0x4a3322, x - 1.5, y - 30, 3, 30); p.line(0x4a3322, x, y - 30, x + 9, y - 24, 2); p.circ('rgba(170,255,170,0.3)', x + 9, y - 19, 12); p.fill(0x4a3322, x + 6, y - 24, 6, 2); p.fill(0xd8f8a8, x + 7, y - 22, 4, 6); p.fill(0xffffff, x + 8, y - 21, 2, 3); p.fill(0x4a3322, x + 6, y - 16, 6, 2); },
  mushroom: (p, d, x, y, v) => { shade(p, x, y, 9); for (const [dx, h, r, c] of [[-6, 9, 6, 0xc8603a], [3, 14, 7.5, 0x9a4a8a], [9, 7, 4.5, 0x6a8ad8]] as [number, number, number, number][]) { p.fill(0xe8e0c8, x + dx - 1.4, y - h, 2.8, h); p.ell(c, x + dx, y - h, r, r * 0.6); p.circ('rgba(255,255,255,0.7)', x + dx - r * 0.3, y - h - r * 0.2, 1.1); p.circ('rgba(255,255,255,0.7)', x + dx + r * 0.3, y - h - r * 0.1, 0.9); } p.circ('rgba(160,255,200,0.2)', x + 2, y - 8, 14); },
  fern: (p, d, x, y) => { shade(p, x, y, 8); for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.42; p.line(k % 2 ? 0x4aa04e : 0x2e7a3e, x, y - 1, x + Math.cos(a) * 14, y - 2 + Math.sin(a) * 14, 2.2); } },
  stump: (p, d, x, y) => { shade(p, x, y, 9); p.fill(0x6a4a30, x - 7, y - 9, 14, 9); p.ell(0x8a6a44, x, y - 9, 7, 2.6); p.ell(0xb88a5a, x, y - 9.5, 5, 1.8); p.ell(0x8a6a44, x, y - 9.5, 2.8, 1); p.circ(0x5aa04e, x - 6, y - 8, 2.4); p.circ(0x82a85a, x + 5, y - 3, 2); },
  glowflower: (p, d, x, y, v) => { shade(p, x, y, 8); p.circ('rgba(160,255,200,0.22)', x, y - 8, 13); for (let k = 0; k < 5; k++) { p.line(0x4aa04e, x - 6 + k * 3, y - 1, x - 6 + k * 3, y - 8 - (k % 3) * 3, 1.2); p.circ([0xb8f4d8, 0xf8f0a0, 0xd8b8ff][(v + k) % 3], x - 6 + k * 3, y - 9 - (k % 3) * 3, 2.2); } },
  deadtree: (p, d, x, y) => { shade(p, x, y, 10); p.line(0x3a3640, x, y, x, y - 22, 3); p.line(0x3a3640, x, y - 14, x - 9, y - 26, 2); p.line(0x3a3640, x, y - 17, x + 9, y - 28, 2); p.line(0x3a3640, x - 9, y - 26, x - 12, y - 32, 1.4); p.line(0x3a3640, x + 9, y - 28, x + 13, y - 33, 1.4); },
  raven: (p, d, x, y) => { shade(p, x, y, 8); p.fill(0x6a6a78, x - 5, y - 8, 10, 8); p.fill(0x8a8a98, x - 5, y - 8, 10, 2); p.ell(0x1a1a22, x, y - 13, 5, 4); p.circ(0x1a1a22, x + 4, y - 17, 2.6); p.poly(0xc8a040, [x + 6, y - 17, x + 10, y - 16, x + 6, y - 15]); p.poly(0x1a1a22, [x - 5, y - 13, x - 12, y - 10, x - 5, y - 9]); },
};

/** the square's furniture: before the monument for the pieces behind it, after it for the ones in front */
export function paintFurniture(p: Pen, d: CityData, phase: 'behind' | 'front') {
  const my = d.landmark ? d.landmark.y : -Infinity;
  const list = d.furniture.filter((f) => (phase === 'behind') === (f.y <= my || !d.landmark)).sort((a, b) => a.y - b.y);
  for (const f of list) (PROPS[f.kind] ?? PROPS.bench)(p, d, f.x, f.y, f.v);
}

export const LANDMARKS: Record<string, Draw> = { fountain, statue, bonfire, clock, sapling, obelisk, forge, gear, oasis, skynest, caldera, stairgate, twinpalace, eridan, liftmine, pump, rainspire };

// ---------------------------------------------------------------- where each monument stands, and the ground it takes
/** the ground a landmark takes, in px around its base point: the elliptical base, and the tall part rising above it that people must not walk "behind" */
export const FOOT: Record<string, { rx: number; ry: number; up: number; upW: number }> = {
  fountain: { rx: 42, ry: 22, up: 44, upW: 14 }, statue: { rx: 40, ry: 21, up: 82, upW: 26 }, bonfire: { rx: 48, ry: 18, up: 30, upW: 60 }, clock: { rx: 32, ry: 16, up: 82, upW: 30 },
  sapling: { rx: 40, ry: 20, up: 94, upW: 60 }, obelisk: { rx: 36, ry: 18, up: 94, upW: 24 }, skynest: { rx: 62, ry: 30, up: 150, upW: 72 }, caldera: { rx: 60, ry: 30, up: 0, upW: 0 },
  stairgate: { rx: 56, ry: 22, up: 74, upW: 100 }, twinpalace: { rx: 58, ry: 28, up: 62, upW: 100 }, eridan: { rx: 52, ry: 20, up: 54, upW: 50 }, liftmine: { rx: 54, ry: 22, up: 76, upW: 60 },
  pump: { rx: 46, ry: 22, up: 72, upW: 70 }, rainspire: { rx: 46, ry: 18, up: 112, upW: 24 }, abyss: { rx: 52, ry: 30, up: 0, upW: 0 },
  arkea: { rx: 64, ry: 36, up: 0, upW: 0 }, gate: { rx: 46, ry: 24, up: 0, upW: 0 }, lake: { rx: 50, ry: 30, up: 0, upW: 0 }, airship: { rx: 70, ry: 16, up: 44, upW: 120 },
  lighthouse: { rx: 22, ry: 10, up: 58, upW: 22 }, council: { rx: 62, ry: 35, up: 24, upW: 90 }, pyramid: { rx: 56, ry: 16, up: 66, upW: 100 }, crystal: { rx: 30, ry: 10, up: 56, upW: 40 },
  oasis: { rx: 50, ry: 26, up: 72, upW: 80 }, forge: { rx: 56, ry: 24, up: 90, upW: 60 }, gear: { rx: 50, ry: 25, up: 100, upW: 40 },
};
/** where a country's monument belongs: in the square (to one side of it), at the rim of the town toward the cliff or shore, or in a quarter of its own */
export type Site = 'plaza' | 'core' | 'edge' | 'shore' | 'offset' | 'craft';
export const SITE: Record<string, Site> = {
  fountain: 'plaza', statue: 'plaza', council: 'plaza', clock: 'plaza', obelisk: 'offset', bonfire: 'plaza', sapling: 'offset', oasis: 'plaza', crystal: 'offset',
  skynest: 'edge', caldera: 'edge', stairgate: 'edge', twinpalace: 'plaza', eridan: 'offset', liftmine: 'craft', pump: 'craft', rainspire: 'edge', lake: 'shore',
  airship: 'shore', lighthouse: 'shore', pyramid: 'edge', abyss: 'edge', arkea: 'edge', gate: 'edge', forge: 'plaza', gear: 'plaza',
};
