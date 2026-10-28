// The buildings that make a town read as a place with a purpose: the fortress and drill yard of a country at war, the arena of a
// people who settle things by duel, rows of shops with their signs, the bank, the hospital.
import type { BuildingRec } from './citygen';
import type { Theme } from './themes';
import { type Pen, shadeC, mixC, stoneWall, planks, windowAt, doorAt, archWindow, flag } from './draw';

type Paint = (p: Pen, b: BuildingRec, th: Theme, X: number, Y: number, W: number, H: number) => void;

const merlons = (p: Pen, x: number, y: number, w: number, c: number) => { for (let i = 0; i < w - 3; i += 7) { p.fill(shadeC(c, 1.08), x + i, y - 6, 4, 7); p.fill(shadeC(c, 1.3), x + i, y - 6, 4, 1); p.fill(shadeC(c, 0.7), x + i + 3, y - 5, 1, 6); } };
const roundTower = (p: Pen, cx: number, base: number, w: number, h: number, c: number, roof: number, a: number, b: number) => {
  p.ell('rgba(0,0,0,0.25)', cx + 5, base + 3, w / 2 + 4, 5);
  p.fill(c, cx - w / 2, base - h, w, h); p.fill(shadeC(c, 1.18), cx - w / 2, base - h, 4, h); p.fill(shadeC(c, 0.72), cx + w / 2 - 5, base - h, 5, h); p.ell(shadeC(c, 0.8), cx, base, w / 2, 4);
  for (let j = 8; j < h - 6; j += 9) p.fill(shadeC(c, 0.75), cx - w / 2, base - h + j, w, 1);
  p.fill(0x14101a, cx - 1, base - h * 0.55, 3, 8); // arrow slit
  p.fill(shadeC(c, 1.1), cx - w / 2 - 2, base - h - 3, w + 4, 4); merlons(p, cx - w / 2 - 2, base - h - 3, w + 4, c);
  p.poly(roof, [cx - w / 2 - 3, base - h - 4, cx, base - h - 24, cx + w / 2 + 3, base - h - 4]); p.poly(shadeC(roof, 0.72), [cx, base - h - 24, cx + w / 2 + 3, base - h - 4, cx, base - h - 4]);
  flag(p, cx, base - h - 22, a, b);
};

export const fortress: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, stone = mixC(b.wall, 0x8a8478, 0.72), roof = th.banner[0], wh = Math.min(30, Math.round(H * 0.3));
  p.fill('rgba(0,0,0,0.25)', X + 6, Y + 10, W, H - 4);
  p.fill(0x8a7a5a, X + 8, Y + wh, W - 16, H - wh - 6); // trodden courtyard
  for (let k = 0; k < 40; k++) p.fill(shadeC(0x8a7a5a, r.float(0.8, 1.2)), X + 12 + r.int(0, W - 24), Y + wh + 4 + r.int(0, H - wh - 14), 3, 1);
  // back wall with walkway, side walls, then the keep standing in the yard
  stoneWall(p, X + 6, Y + 8, W - 12, wh, shadeC(stone, 0.95), r); merlons(p, X + 6, Y + 8, W - 12, stone); p.fill('rgba(0,0,0,0.25)', X + 6, Y + 8 + wh - 3, W - 12, 3);
  for (const sx of [X + 2, X + W - 14]) { stoneWall(p, sx, Y + 14, 12, H - 28, shadeC(stone, sx < X + W / 2 ? 1 : 0.8), r); merlons(p, sx, Y + 14, 12, stone); }
  // the keep
  const kw = Math.min(70, Math.round(W * 0.34)), kx = X + Math.round((W - kw) / 2), kh = Math.round(H * 0.5), ky = Y + wh + 6;
  stoneWall(p, kx, ky, kw, kh, shadeC(stone, 0.9), r); p.fill(shadeC(stone, 0.7), kx + kw - 8, ky, 8, kh); p.fill(shadeC(stone, 1.2), kx, ky - 4, kw, 5); merlons(p, kx, ky - 4, kw, stone);
  roundTower(p, kx + kw / 2, ky + 8, 22, 30, shadeC(stone, 0.95), roof, th.banner[0], th.banner[1]);
  for (let k = 0; k < 3; k++) archWindow(p, kx + 10 + k * Math.round((kw - 22) / 2), ky + 14, 6, 11, 0x2a3a50, shadeC(stone, 1.25));
  p.fill(0x1a1a1e, kx + kw / 2 - 6, ky + kh - 14, 12, 14); p.ell(0x1a1a1e, kx + kw / 2, ky + kh - 14, 6, 5);
  // front wall with the gatehouse and its portcullis
  stoneWall(p, X + 6, Y + H - wh - 4, W - 12, wh, shadeC(stone, 1.02), r); merlons(p, X + 6, Y + H - wh - 4, W - 12, stone); p.fill('rgba(0,0,0,0.3)', X + 6, Y + H - 7, W - 12, 3);
  const gx = X + Math.round(W / 2), gw = 30;
  stoneWall(p, gx - gw / 2 - 6, Y + H - wh - 12, gw + 12, wh + 8, shadeC(stone, 1.1), r); merlons(p, gx - gw / 2 - 6, Y + H - wh - 12, gw + 12, stone);
  p.ell(0x14101a, gx, Y + H - 22, 11, 11); p.fill(0x14101a, gx - 11, Y + H - 22, 22, 22);
  for (let i = -8; i <= 8; i += 4) p.fill(0x5a5a62, gx + i, Y + H - 30, 1, 18); for (let j = 0; j < 3; j++) p.fill(0x5a5a62, gx - 10, Y + H - 28 + j * 6, 20, 1);
  p.doorX = gx;
  // corner towers
  for (const [tx, ty] of [[X + 4, Y + 20], [X + W - 4, Y + 20], [X + 4, Y + H - 6], [X + W - 4, Y + H - 6]]) roundTower(p, tx, ty + 6, 22, 34, stone, roof, th.banner[0], th.banner[1]);
  // banners over the gate and tents in the yard
  for (const s of [-1, 1]) { p.fill(0x4a3a22, gx + s * 22, Y + H - 52, 1, 24); p.poly(th.banner[s < 0 ? 0 : 1], [gx + s * 22 + 1, Y + H - 52, gx + s * 22 + 9, Y + H - 44, gx + s * 22 + 1, Y + H - 36]); }
  for (const tx of [X + 24, X + W - 44]) { const ty = Y + wh + 14 + r.int(0, 10); p.poly(0xe8dcc0, [tx, ty + 14, tx + 10, ty, tx + 20, ty + 14]); p.poly(th.banner[0], [tx + 10, ty, tx + 20, ty + 14, tx + 10, ty + 14]); }
};

export const drill: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, dirt = 0x9a7e56;
  p.fill('rgba(0,0,0,0.2)', X + 4, Y + 6, W, H - 4);
  p.fill(dirt, X + 2, Y + 4, W - 4, H - 8); p.fill(shadeC(dirt, 1.12), X + 2, Y + 4, W - 4, 3);
  for (let k = 0; k < 60; k++) p.fill(shadeC(dirt, r.float(0.8, 1.15)), X + 4 + r.int(0, W - 10), Y + 8 + r.int(0, H - 18), r.int(2, 4), 1);
  for (let i = 4; i < W - 4; i += 6) { p.fill(0x6a4a2a, X + i, Y + 2, 2, 9); p.fill(0x6a4a2a, X + i, Y + H - 12, 2, 9); } // palisade rails
  p.fill(0x6a4a2a, X + 2, Y + 5, W - 4, 2); p.fill(0x6a4a2a, X + 2, Y + H - 8, W - 4, 2);
  // straw dummies and archery targets
  const n = Math.max(2, Math.floor((W - 40) / 28));
  for (let k = 0; k < n; k++) {
    const dx = X + 26 + (k * (W - 52)) / Math.max(1, n - 1), dy = Y + 22 + (k % 2) * 10;
    if (k % 2 === 0) { p.fill(0x5e3a26, dx - 1, dy, 3, 20); p.fill(0x5e3a26, dx - 7, dy + 4, 15, 2); p.ell(0xd8b858, dx, dy + 8, 6, 9); p.circ(0xe8cc70, dx, dy - 2, 4.5); p.circ(0xb04a3a, dx, dy + 8, 2.4); p.fill(0x6a4a2a, dx - 9, dy + 18, 18, 2); }
    else { p.fill(0x5e3a26, dx - 6, dy + 8, 2, 14); p.fill(0x5e3a26, dx + 4, dy + 8, 2, 14); p.circ(0xe8e0d0, dx, dy + 8, 9); p.circ(0x2a5aa8, dx, dy + 8, 7); p.circ(0xe8e0d0, dx, dy + 8, 5); p.circ(0xc83a2a, dx, dy + 8, 3); p.circ(0xf2c94c, dx, dy + 8, 1.3); p.line(0x6a4a2a, dx - 3, dy + 7, dx + 7, dy + 5, 1); }
  }
  // weapon racks, the banner pole, a pavilion
  const rx = X + 10, ry = Y + H - 26;
  p.fill(0x5e3a26, rx, ry, 2, 14); p.fill(0x5e3a26, rx + 20, ry, 2, 14); p.fill(0x5e3a26, rx, ry + 3, 22, 2);
  for (let k = 0; k < 5; k++) { p.fill(0x8a8a94, rx + 3 + k * 4, ry - 8, 1, 12); p.poly(0xc8c8d0, [rx + 2 + k * 4, ry - 8, rx + 4 + k * 4, ry - 8, rx + 3 + k * 4, ry - 12]); }
  p.fill(0x4a3a22, X + W - 18, Y + 12, 2, 40); p.poly(th.banner[0], [X + W - 16, Y + 12, X + W - 2, Y + 18, X + W - 16, Y + 26]);
  const tx = X + W - 52, ty = Y + H - 32;
  p.fill(0x5e3a26, tx, ty, 2, 18); p.fill(0x5e3a26, tx + 28, ty, 2, 18); for (let s = 0; s < 30; s += 6) p.fill(s % 12 ? 0xf0e8d0 : th.banner[0], tx + s, ty - 6, 6, 8); p.fill('rgba(0,0,0,0.25)', tx, ty + 2, 30, 3);
};

// the trades and the sign each hangs out
const SIGNS: ((p: Pen, x: number, y: number) => void)[] = [
  (p, x, y) => { p.ell(0xd8a050, x, y, 4.5, 3); p.ell(0xf0c070, x - 1, y - 1, 3, 1.6); }, // bread
  (p, x, y) => { p.fill(0x4a4f60, x - 4, y - 1, 8, 3); p.fill(0x7a7f90, x - 5, y - 3, 10, 3); p.fill(0x4a4f60, x - 1, y + 2, 3, 3); }, // anvil
  (p, x, y) => { p.circ(0x9a4ac8, x, y + 1, 3.6); p.fill(0xe8e0d0, x - 1, y - 5, 2, 4); p.circ('rgba(255,255,255,0.7)', x - 1, y, 1); }, // potion
  (p, x, y) => { p.fill(0xe04848, x - 4, y - 3, 8, 6); p.fill(0xf0d878, x - 4, y - 1, 8, 1); p.fill(0x5aa0ea, x - 4, y + 1, 8, 1); }, // cloth
  (p, x, y) => { p.ell(0x6a98b0, x, y, 5, 2.6); p.poly(0x6a98b0, [x + 4, y, x + 8, y - 3, x + 8, y + 3]); p.fill(0xffffff, x - 3, y - 1, 1, 1); }, // fish
  (p, x, y) => { p.fill(0x8a2a2a, x - 4, y - 4, 8, 8); p.fill(0xf0d878, x - 3, y - 3, 6, 6); p.fill(0x8a2a2a, x - 1, y - 2, 2, 4); }, // book
  (p, x, y) => { p.fill(0xb8b0a0, x - 3, y - 4, 6, 8); p.fill(0xe0c060, x - 2, y - 3, 4, 2); p.fill(0x3a6a3a, x - 2, y + 1, 4, 2); }, // herbs
];
export const shops: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, units = Math.max(2, Math.min(4, Math.round(W / 34))), uw = W / units, wallH = Math.min(H - 12, 40), top = Y + H - wallH;
  const tints = [b.wall, mixC(b.wall, 0xc87a50, 0.5), mixC(b.wall, 0x7a9ab0, 0.42), mixC(b.wall, 0xd8b860, 0.5), mixC(b.wall, 0x9a5a50, 0.4)];
  const roof = mixC(0x7a5a3e, b.roof, 0.5);
  for (let u = 0; u < units; u++) {
    const x0 = Math.round(X + u * uw), w = Math.round(X + (u + 1) * uw) - x0 - 1, wall = tints[(b.seed + u * 3) % tints.length];
    p.fill(wall, x0, top, w, wallH); p.fill('rgba(255,248,224,0.16)', x0, top, 2, wallH); p.fill('rgba(0,0,40,0.16)', x0 + w - 2, top, 2, wallH);
    p.poly(shadeC(roof, 0.9), [x0 - 2, top + 3, x0 + 4, top - 8, x0 + w - 4, top - 8, x0 + w + 2, top + 3]); p.fill('rgba(0,0,0,0.25)', x0 - 2, top + 3, w + 4, 3);
    p.fill(shadeC(roof, 1.25), x0 + 4, top - 8, w - 8, 2);
    windowAt(p, x0 + 3, top + 8, 6, 8, 0xffe6a0, 0x4a3a2a); if (w > 30) windowAt(p, x0 + w - 10, top + 8, 6, 8, 0x8ec8e8, 0x4a3a2a);
    // shopfront: awning, goods table, door
    const aw = [0xe04848, 0x5aa0ea, 0xf2c94c, 0x6cc05a, th.banner[0], th.banner[1]][(b.seed + u) % 6], gy = Y + H - 20;
    for (let s = 0; s < w; s += 4) p.fill(s % 8 ? 0xffffff : aw, x0 + s, gy - 4, 4, 6); p.fill('rgba(0,0,0,0.28)', x0, gy + 2, w, 2);
    doorAt(p, x0 + w - 9, Y + H - 15, 6, 15, shadeC(0x6a4a2a, r.float(0.8, 1.2)), false, true);
    p.fill(0x7a5a38, x0 + 3, Y + H - 9, Math.max(8, w - 18), 4); for (let g = 0; g < Math.max(2, (w - 18) / 4); g++) p.circ([0xe04848, 0xf2c94c, 0x6cc05a, 0xe08030][(g + u) % 4], x0 + 5 + g * 4, Y + H - 11, 1.6);
    // the hanging sign: a bracket, a board, the trade's mark
    const sx = x0 + Math.round(w / 2), sy = top + 21 - (u % 2) * 3;
    p.fill(0x3a2a1a, sx - 1, top + 17, 1, 5); p.fill(0x3a2a1a, sx - 1, top + 17, 8, 1); p.fill(0xe8d8a8, sx + 1, sy, 10, 9); p.fill(0x6a4a2a, sx, sy - 1, 12, 1); p.fill(0x6a4a2a, sx, sy + 9, 12, 1);
    SIGNS[(b.seed + u * 2) % SIGNS.length](p, sx + 6, sy + 4);
  }
};

export const bank: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, F = Math.round(H * 0.6), top = Y + H - F, st = 0xe0d8c4;
  p.fill(0xcfc7b2, X + 2, top, W - 4, F); p.fill(st, X + 2, top, W - 4, 3);
  p.poly(shadeC(st, 0.92), [X - 2, top + 2, X + W / 2, Y, X + W + 2, top + 2]); p.poly(shadeC(st, 0.72), [X + W / 2, Y, X + W + 2, top + 2, X + W / 2, top + 2]);
  p.circ(0xf2c94c, X + W / 2, top - 6, 6); p.circ(0xc8a030, X + W / 2, top - 6, 4); p.fill(0x6a4a10, X + W / 2 - 1, top - 9, 2, 6);
  const cols = Math.max(3, Math.floor((W - 12) / 16));
  for (let k = 0; k < cols; k++) { const cx = X + 8 + (k * (W - 16)) / (cols - 1); p.fill(0xf2eee0, cx - 3, top + 3, 6, F - 7); p.fill(0xcfc7b2, cx + 1, top + 3, 2, F - 7); p.fill(st, cx - 4, top + 3, 8, 2); p.fill(st, cx - 4, top + F - 6, 8, 3); }
  p.fill(0x2a2a30, X + W / 2 - 6, top + F - 22, 12, 20); p.fill(0xf2c94c, X + W / 2 - 5, top + F - 21, 4, 18); p.fill(0xf2c94c, X + W / 2 + 1, top + F - 21, 4, 18);
  for (let s = 0; s < 3; s++) p.fill(shadeC(st, 0.9 - s * 0.05), X + 6 - s * 2, Y + H - 4 + s * 1.5 - 3, W - 12 + s * 4, 2);
  void r; void th;
};

export const hospital: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, F = Math.round(H * 0.55), top = Y + H - F;
  const wing = (x: number, w: number, hh: number) => { p.fill(0xf4f0e8, x, Y + H - hh, w, hh); p.fill('rgba(0,0,40,0.1)', x + w - 4, Y + H - hh, 4, hh); p.poly(0x6a9ad0, [x - 3, Y + H - hh + 3, x + 6, Y + H - hh - 10, x + w - 6, Y + H - hh - 10, x + w + 3, Y + H - hh + 3]); p.fill('rgba(0,0,0,0.2)', x - 3, Y + H - hh + 3, w + 6, 3); for (let k = 0; k < Math.floor(w / 16); k++) windowAt(p, x + 6 + k * 16, Y + H - hh + 10, 7, 9, 0x8ec8e8, 0xcfd8e0); };
  const wy = Math.round(W * 0.3);
  wing(X, wy, F - 6); wing(X + W - wy, wy, F - 6); wing(X + wy - 4, W - 2 * wy + 8, F + 8);
  const mx = X + W / 2; p.fill(0xffffff, mx - 8, Y + H - F - 6, 16, 16); p.fill(0xd83a3a, mx - 2, Y + H - F - 4, 4, 12); p.fill(0xd83a3a, mx - 6, Y + H - F, 12, 4);
  doorAt(p, Math.round(mx - 5), Y + H - 17, 10, 17, 0x5aa0d8, true);
  for (let k = 0; k < 5; k++) p.circ(['#ffffff', '#f2c94c', '#e8607a', '#7ac07a'][k % 4], X + 4 + r.int(0, wy - 8), Y + H - 3, 1.6); // flower beds
  void th;
};

// a real arena: stepped stone tiers with arches, sand floor, gates, banners round the rim, a crowd
export const arena: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, cx = X + W / 2, cy = Y + H * 0.56, rx = W / 2 - 1, ry = H * 0.42;
  p.ell('rgba(0,0,0,0.3)', cx + 5, cy + 10, rx, ry);
  p.fill(0xb8ae98, cx - rx, cy, rx * 2, 16); p.fill(shadeC(0xb8ae98, 0.8), cx - rx, cy + 12, rx * 2, 4); p.ell(0xb8ae98, cx, cy + 16, rx, ry * 0.5); p.ell(shadeC(0xb8ae98, 0.8), cx, cy + 19, rx, ry * 0.5);
  for (let k = 0; k < Math.floor(rx / 6); k++) { const ax = cx - rx + 8 + k * ((rx * 2 - 16) / Math.floor(rx / 6)); p.fill(0x3a342c, ax, cy + 4, 5, 11); p.ell(0x3a342c, ax + 2.5, cy + 4, 2.5, 2); }
  p.ell(0xcfc6b0, cx, cy, rx, ry); p.ell(0x9a907a, cx, cy, rx - 3, ry - 3);
  p.ell(0xb8ae98, cx, cy, rx - 12, ry - 9); p.ell(0x8a8068, cx, cy, rx - 14, ry - 11);
  for (let k = 0; k < 90; k++) { const a = r.float(0, 6.28), t = r.float(0.8, 0.96); p.fill([0xe04848, 0x5aa0ea, 0xf2c94c, 0xe8e0d0, 0x6cc05a, 0xc07aff][k % 6], cx + Math.cos(a) * (rx - 8) * t, cy + Math.sin(a) * (ry - 6) * t, 1.5, 1.5); }
  p.ell(0xd8c08a, cx, cy + 1, rx - 20, ry - 15); p.ell(0xe4cf9c, cx - 2, cy, rx - 28, ry - 20);
  p.line(0x7a6a50, cx - 10, cy - 4, cx + 10, cy + 6, 2); p.line(0x7a6a50, cx + 10, cy - 4, cx - 10, cy + 6, 2); p.circ(0xb04a3a, cx, cy + 1, 2.4);
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; if (Math.sin(a) < 0.2) continue; }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2, bx = cx + Math.cos(a) * (rx - 1), by = cy + Math.sin(a) * (ry - 1); p.fill(0x4a3a2a, bx, by - 20, 1, 22); p.poly([th.banner[0], th.banner[1], 0xf0e8d0][k % 3], [bx + 1, by - 20, bx + 10, by - 16, bx + 1, by - 12]); }
  p.fill(0x1a1612, cx - 7, cy + ry - 4, 14, 8); p.ell(0x1a1612, cx, cy + ry - 4, 7, 4); p.fill(0x5a5a62, cx - 6, cy + ry - 2, 12, 1); p.doorX = cx;
};

/** AZ-01: a perch-tower where the wing-knights of the Thrax Legion roost and ride out */
export const aerie: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, white = 0xf0ece0, cx = X + W / 2, base = Y + H - 3, tw = Math.min(30, Math.round(W * 0.4));
  p.ell('rgba(0,0,0,0.28)', cx + 5, base + 2, W / 2, 7);
  p.fill(0xe0d8c4, cx - tw / 2, Y + 30, tw, base - Y - 30); p.fill(0xf4f0e6, cx - tw / 2, Y + 30, 5, base - Y - 30); p.fill(0xb8b09c, cx + tw / 2 - 6, Y + 30, 6, base - Y - 30);
  for (let j = Y + 40; j < base - 8; j += 14) { p.fill(0xb8b09c, cx - tw / 2, j, tw, 1); archWindow(p, cx - 3, j + 3, 6, 9, 0x6ab0e8, 0xf2c94c); }
  p.poly(th.banner[0], [cx - tw / 2 - 3, Y + 32, cx, Y + 8, cx + tw / 2 + 3, Y + 32]); p.poly(shadeC(th.banner[0], 0.7), [cx, Y + 8, cx + tw / 2 + 3, Y + 32, cx, Y + 32]);
  p.fill(0xf2c94c, cx, Y - 2, 1, 12); p.circ(0xf2c94c, cx, Y - 3, 2);
  // landing perches jutting out on both sides, with a dragon-rider on each
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) {
    const py = Y + 44 + k * 28, px = cx + s * (tw / 2 + 12 + k * 4);
    p.fill(0x8a6a3a, Math.min(cx + s * tw / 2, px), py, Math.abs(px - (cx + s * tw / 2)) + 1, 3); p.fill(0x6a4a2a, px - 1, py - 1, 2, 5);
    p.ell('rgba(0,0,0,0.2)', px + 2, py + 6, 8, 2); p.ell(r.chance(0.5) ? white : 0xdde8f4, px, py - 5, 7, 4); p.circ(white, px + s * 6, py - 8, 2.6); p.poly(0xe8e4f4, [px - 2, py - 7, px - s * 8, py - 16, px - s * 4, py - 6]); p.fill(th.banner[0], px - 1, py - 10, 2, 4);
  }
  p.fill(0x14101a, cx - 5, base - 14, 10, 14); p.ell(0x14101a, cx, base - 14, 5, 4); p.doorX = cx;
};

/** AZ-03: a mast-tower where the floating-stone sail ships of the post and trade fleet tie up */
export const skydock: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, cx = X + W / 2, base = Y + H - 4;
  p.ell('rgba(0,0,0,0.25)', cx + 4, base + 3, W / 2, 6); planks(p, X + 4, base - 12, W - 8, 12, 0x9a7a50);
  p.fill(0x5e3a26, X + 8, base - 40, 4, 32); p.fill(0x5e3a26, X + W - 12, base - 40, 4, 32); p.fill(0x5e3a26, X + 8, base - 40, W - 16, 3);
  // the hovering ship: a stone-grey hull, two white sails, a lantern
  const hx = cx + r.int(-6, 6), hy = Y + 24;
  p.ell('rgba(120,200,255,0.25)', hx, hy + 12, 22, 5); p.poly(0x7a7468, [hx - 22, hy, hx + 22, hy, hx + 14, hy + 10, hx - 14, hy + 10]); p.fill(0x9a948a, hx - 22, hy, 44, 2);
  p.fill(0x4a3a22, hx - 1, hy - 28, 2, 28); p.poly(0xf4f0e6, [hx + 2, hy - 26, hx + 18, hy - 6, hx + 2, hy - 6]); p.poly(0xe0dcd0, [hx - 2, hy - 20, hx - 14, hy - 6, hx - 2, hy - 6]);
  p.poly(th.banner[0], [hx - 1, hy - 28, hx + 9, hy - 25, hx - 1, hy - 22]); p.circ('rgba(255,216,144,0.5)', hx + 20, hy + 3, 5); p.circ(0xffd890, hx + 20, hy + 3, 2);
  for (let k = 0; k < 6; k++) p.circ('rgba(190,230,255,0.8)', hx - 14 + k * 6, hy + 14 + (k % 2) * 3, 1);
  p.doorX = cx;
};

export const CIVIC: Record<string, Paint> = { fortress, drill, shops, bank, hospital, arena, aerie, skydock };
void planks; void archWindow;
