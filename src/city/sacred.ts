// Houses of worship, one for each faith of the world: the cathedral of light, the tiered temple of the dragon cult, the naga's stepped
// shrine, the shell temple of the sea, the grove of the world tree, the moon observatory, the ancestors' hall, the war god's chapel and
// the obsidian spire of the demon cult. Large and ornate, so they stand out above the houses; villages get a small shrine of the same faith.
import type { BuildingRec } from './citygen';
import type { Theme } from './themes';
import { type Pen, shadeC, mixC, archWindow, doorAt, stoneWall, planks, flag } from './draw';

type Paint = (p: Pen, b: BuildingRec, th: Theme, X: number, Y: number, W: number, H: number) => void;
const gold = 0xf2c94c;
const steps = (p: Pen, cx: number, y: number, w: number, n: number, c: number) => { for (let s = 0; s < n; s++) { p.fill(shadeC(c, 1 - s * 0.06), cx - w / 2 - s * 2, y + s * 2, w + s * 4, 2); p.fill(shadeC(c, 0.62), cx - w / 2 - s * 2, y + s * 2 + 2, w + s * 4, 1); } };
const glowAt = (p: Pen, x: number, y: number, r: number, c: string) => { p.circ(c, x, y, r); };

/** the Church of Light: a Gothic cathedral with twin spires, a rose window and a sunburst */
const light: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, wall = mixC(b.wall, 0xeee8d8, 0.7), cx = X + W / 2, base = Y + H - 3, tw = Math.max(16, Math.round(W * 0.2));
  const body = base - Math.round(H * 0.44);
  p.ell('rgba(0,0,0,0.28)', cx + 5, base + 2, W / 2, 6);
  stoneWall(p, X + tw, body, W - 2 * tw, base - body, wall, r); p.fill('rgba(255,248,224,0.18)', X + tw, body, 3, base - body);
  for (let k = 0; k < Math.floor((W - 2 * tw) / 16); k++) p.fill(shadeC(wall, 0.78), X + tw + 6 + k * 16, body + 6, 3, base - body - 6); // buttresses
  const nave = [X + tw - 2, body - 4, cx, body - Math.round(H * 0.3), X + W - tw + 2, body - 4];
  p.poly(0x6a7aa8, nave); p.poly(shadeC(0x6a7aa8, 0.72), [cx, nave[3], nave[4], nave[5], cx, nave[5]]); p.line(gold, nave[0], nave[1], cx, nave[3], 1); p.line(gold, cx, nave[3], nave[4], nave[5], 1);
  for (const tx of [X, X + W - tw]) {
    p.fill(wall, tx, body - Math.round(H * 0.22), tw, base - body + Math.round(H * 0.22)); p.fill(shadeC(wall, 0.8), tx + tw - 4, body - Math.round(H * 0.22), 4, base - body + Math.round(H * 0.22)); p.fill(shadeC(wall, 1.15), tx, body - Math.round(H * 0.22), 3, base - body + Math.round(H * 0.22));
    const ty = body - Math.round(H * 0.22);
    p.poly(0x4a68b8, [tx - 2, ty, tx + tw / 2, ty - Math.round(H * 0.34), tx + tw + 2, ty]); p.poly(shadeC(0x4a68b8, 0.7), [tx + tw / 2, ty - Math.round(H * 0.34), tx + tw + 2, ty, tx + tw / 2, ty]);
    p.fill(gold, tx + tw / 2, ty - Math.round(H * 0.34) - 8, 1, 10); p.fill(gold, tx + tw / 2 - 3, ty - Math.round(H * 0.34) - 5, 7, 1);
    archWindow(p, tx + tw / 2 - 3, ty + 8, 6, 12, 0xf6d878, gold);
  }
  // the rose window
  const rx = cx, ry = body + Math.round((base - body) * 0.28), rr = Math.min(13, Math.round(W * 0.09));
  p.circ(gold, rx, ry, rr + 2); p.circ(0x2a3a8a, rx, ry, rr);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.line([0xe04848, 0xf2c94c, 0x5aa0ea, 0x6cc05a][k % 4], rx, ry, rx + Math.cos(a) * rr, ry + Math.sin(a) * rr, 2); }
  p.circ(0xfff0b0, rx, ry, 2.5); glowAt(p, rx, ry, rr + 6, 'rgba(255,220,140,0.2)');
  // tall stained windows and the great door
  const wn = Math.max(2, Math.floor((W - 2 * tw - 40) / 20));
  for (let k = 0; k < wn; k++) { const wx = cx - 16 - (wn - 1) * 10 + k * 20 + (k >= wn / 2 ? 28 : 0); if (Math.abs(wx - cx) > 14) archWindow(p, wx, body + 12, 5, 16, [0xe04848, 0x5aa0ea, 0xf2c94c][k % 3], gold); }
  doorAt(p, Math.round(cx - 6), base - 24, 12, 24, 0x5a3a22, true); p.fill(gold, cx - 7, base - 26, 14, 2);
  steps(p, cx, base, 22, 3, 0xd8d0c0);
  p.doorX = cx;
  p.circ(gold, cx, nave[3] - 6, 3); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.line(gold, cx + Math.cos(a) * 4, nave[3] - 6 + Math.sin(a) * 4, cx + Math.cos(a) * 8, nave[3] - 6 + Math.sin(a) * 8, 1); } // sunburst
  void th;
};

/** the dragon cult: a tiered temple with upturned golden eaves, red pillars and a dragon coiled on the ridge */
const dragon: Paint = (p, b, th, X, Y, W, H) => {
  const cx = X + W / 2, base = Y + H - 3, red = 0xb03a2a;
  p.ell('rgba(0,0,0,0.28)', cx + 5, base + 2, W / 2, 6);
  steps(p, cx, base - 8, W - 14, 3, 0xd8d0c0);
  const tiers = 3;
  for (let t = 0; t < tiers; t++) {
    const w = (W - 6) * (1 - t * 0.26), y1 = base - 12 - t * Math.round((H - 22) / tiers), h = Math.round((H - 22) / tiers) - 6;
    p.fill(shadeC(red, 0.88), cx - w / 2 + 4, y1 - h, w - 8, h);
    for (let k = 0; k <= 4; k++) p.fill(red, cx - w / 2 + 6 + (k * (w - 16)) / 4, y1 - h, 3, h);
    p.fill(0x2a1a14, cx - 5, y1 - h + 3, 10, h - 3);
    // the eaves curve up at the ends
    p.poly(gold, [cx - w / 2 - 6, y1 - h + 2, cx - w / 2 + 4, y1 - h - 6, cx + w / 2 - 4, y1 - h - 6, cx + w / 2 + 6, y1 - h + 2, cx + w / 2 - 3, y1 - h + 6, cx - w / 2 + 3, y1 - h + 6]);
    p.poly(shadeC(gold, 0.7), [cx, y1 - h - 6, cx + w / 2 - 4, y1 - h - 6, cx + w / 2 + 6, y1 - h + 2, cx + w / 2 - 3, y1 - h + 6, cx, y1 - h + 6]);
    p.fill('rgba(0,0,0,0.3)', cx - w / 2 + 3, y1 - h + 6, w - 6, 2);
    p.circ(gold, cx - w / 2 - 6, y1 - h + 1, 1.6); p.circ(gold, cx + w / 2 + 6, y1 - h + 1, 1.6);
  }
  // the dragon on the ridge
  const ty = base - 12 - tiers * Math.round((H - 22) / tiers) - 4;
  p.x2.strokeStyle = '#e8c060'; p.x2.lineWidth = 4; p.x2.lineCap = 'round'; p.x2.beginPath(); p.x2.moveTo(cx - 10, ty + 4); p.x2.quadraticCurveTo(cx - 8, ty - 8, cx, ty - 2); p.x2.quadraticCurveTo(cx + 8, ty + 4, cx + 9, ty - 8); p.x2.stroke(); p.x2.lineCap = 'butt';
  p.circ(0xe8c060, cx + 10, ty - 10, 3.4); p.poly(red, [cx + 8, ty - 13, cx + 6, ty - 18, cx + 11, ty - 13]); p.fill(0x2a1a14, cx + 11, ty - 11, 1, 1);
  for (const dx of [-W / 2 + 6, W / 2 - 6]) { p.line(0x3a2a1a, cx + dx, base - 14, cx + dx, base - 6, 1); p.circ(0xe04030, cx + dx, base - 4, 3); p.circ('rgba(255,150,80,0.3)', cx + dx, base - 4, 6); }
  p.doorX = cx; void th; void b;
};

/** the naga cult: a stepped shrine with the seven-headed serpent rising over the door and a pool at its foot */
const naga: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, cx = X + W / 2, base = Y + H - 3, stone = mixC(b.wall, 0x7aa08a, 0.5);
  p.ell('rgba(0,0,0,0.28)', cx + 5, base + 2, W / 2, 6);
  const n = 4;
  for (let s = 0; s < n; s++) { const w = (W - 4) * (1 - s * 0.2), h = Math.round((H - 36) / n), y = base - 10 - s * h; stoneWall(p, cx - w / 2, y - h, w, h, shadeC(stone, 1 - s * 0.04), r); p.fill(shadeC(stone, 1.25), cx - w / 2 - 1, y - h - 1, w + 2, 2); p.fill(gold, cx - w / 2, y - h + 3, w, 1); }
  // seven serpent heads fanned over a hood
  const hy = base - 10 - n * Math.round((H - 36) / n) - 2;
  p.ell(shadeC(0x3a8a5a, 0.8), cx, hy - 2, 16, 8); p.ell(0x3a8a5a, cx, hy - 4, 15, 7);
  for (let k = 0; k < 7; k++) { const a = -Math.PI + (k + 0.5) * (Math.PI / 7), hx = cx + Math.cos(a) * 18, hy2 = hy - 4 + Math.sin(a) * 20; p.line(0x3a8a5a, cx, hy - 4, hx, hy2, 3); p.circ(0x4aa86a, hx, hy2, 3.4); p.fill(gold, hx - 2, hy2 - 4, 4, 1); p.fill(0xe04030, hx, hy2, 1, 1); }
  p.circ(gold, cx, hy - 4, 2.4);
  p.fill(0x14101a, cx - 6, base - 22, 12, 16); p.ell(0x14101a, cx, base - 22, 6, 5);
  p.ell(0x2a8ac8, cx, base + 1, W / 3, 4); p.ell(0x7ad0f0, cx - 4, base, W / 6, 2); // the pool
  for (const dx of [-W / 2 + 8, W / 2 - 8]) { p.fill(0x6a8a7a, dx + cx - 2, base - 24, 4, 20); p.circ(gold, dx + cx, base - 26, 3); }
  p.doorX = cx; void th;
};

/** the sea faith: a white shell-roofed temple on a tidal stair, an anchor over the door, a lamp-spire */
const sea: Paint = (p, b, th, X, Y, W, H) => {
  const cx = X + W / 2, base = Y + H - 3, blue = 0x3a8ad0;
  p.ell('rgba(0,0,0,0.25)', cx + 4, base + 2, W / 2, 6);
  steps(p, cx, base - 10, W - 12, 4, 0xe8f0f4); p.ell('rgba(120,200,240,0.5)', cx, base + 1, W / 2 - 4, 3);
  const wallH = Math.round(H * 0.34), wy = base - 12 - wallH;
  p.fill(0xf4f8fa, X + 8, wy, W - 16, wallH); p.fill('rgba(60,120,180,0.15)', X + W - 22, wy, 14, wallH);
  for (let k = 0; k < 4; k++) archWindow(p, X + 14 + k * ((W - 40) / 3), wy + 6, 6, wallH - 12, 0x7ac8f0, 0xcfe0e8);
  // the shell: a fan of ridges rising from the roof line
  const fy = wy + 2, fr = (W - 8) / 2;
  p.x2.save(); p.x2.beginPath(); p.x2.rect(X - 4, fy - fr - 4, W + 8, fr + 6); p.x2.clip();
  p.ell(shadeC(blue, 0.75), cx, fy, fr, fr); p.ell(0xe8f4f8, cx, fy, fr - 2, fr - 2);
  for (let k = 0; k < 11; k++) { const a = Math.PI + (k / 10) * Math.PI; p.line(k % 2 ? 0xb8d8e8 : 0x8ac0e0, cx, fy, cx + Math.cos(a) * (fr - 2), fy + Math.sin(a) * (fr - 2), 3); }
  p.ell(0xf8fcff, cx, fy, fr * 0.3, fr * 0.3); p.x2.restore();
  p.fill(0xcfe0e8, cx - 3, fy - fr - 12, 6, 12); p.circ('rgba(255,236,160,0.5)', cx, fy - fr - 14, 6); p.circ(0xfff0a0, cx, fy - fr - 14, 2.4);
  // anchor over the door
  p.line(0x2a5a90, cx, wy + wallH - 20, cx, wy + wallH - 12, 2); p.line(0x2a5a90, cx - 4, wy + wallH - 18, cx + 4, wy + wallH - 18, 1); p.x2.strokeStyle = '#2a5a90'; p.x2.lineWidth = 1.5; p.x2.beginPath(); p.x2.arc(cx, wy + wallH - 12, 4, 0, Math.PI); p.x2.stroke();
  doorAt(p, Math.round(cx - 5), wy + wallH - 12, 10, 12, 0x2a6aa0, true); p.doorX = cx; void th; void b;
};

/** the faith of nature: a sacred grove: a ring of standing stones around a great living tree and a moss altar */
const nature: Paint = (p, b, th, X, Y, W, H) => {
  const cx = X + W / 2, base = Y + H - 4, L = th.leaf, tw = Math.min(14, W * 0.12);
  p.ell('rgba(0,0,0,0.25)', cx + 4, base + 2, W / 2, 7); p.ell(shadeC(L[0], 0.5), cx, base - 2, W / 2 - 2, 9); p.ell(shadeC(L[1 % L.length], 0.75), cx, base - 4, W / 2 - 6, 7);
  p.fill(0x5e3a26, cx - tw / 2, base - H * 0.62, tw, H * 0.62 - 2); p.fill(0x7a5238, cx - tw / 2, base - H * 0.62, 3, H * 0.62 - 2); p.fill(0x3e2616, cx + tw / 2 - 3, base - H * 0.62, 3, H * 0.62 - 2);
  for (const s of [-1, 1]) { p.x2.strokeStyle = '#4a3322'; p.x2.lineWidth = 4; p.x2.beginPath(); p.x2.moveTo(cx, base - 4); p.x2.quadraticCurveTo(cx + s * 12, base, cx + s * 22, base + 1); p.x2.stroke(); }
  const crown = (x: number, y: number, rad: number, c: number) => { p.circ(shadeC(c, 0.6), x + 2, y + 3, rad); p.circ(c, x, y, rad); for (let k = 0; k < 7; k++) p.circ(shadeC(c, 1.1 + (k % 3) * 0.12), x + Math.cos(k * 1.9) * rad * 0.55, y + Math.sin(k * 1.9) * rad * 0.5, rad * 0.32); };
  crown(cx - 16, base - H * 0.62, 15, L[0]); crown(cx + 16, base - H * 0.6, 14, L[1 % L.length]); crown(cx, base - H * 0.8, 18, L[2 % L.length]);
  for (let k = 0; k < 5; k++) p.circ(gold, cx - 20 + k * 10, base - H * 0.56 + (k % 2) * 10, 1.8);
  for (let k = 0; k < 8; k++) { const a = Math.PI * 0.1 + (k / 7) * Math.PI * 0.8, sx = cx + Math.cos(a + Math.PI) * (W / 2 - 4), sy = base - 2 + Math.sin(a) * 6; p.fill(0x8a8a82, sx - 2, sy - 12, 5, 13); p.fill(0xaaaaa0, sx - 2, sy - 12, 2, 13); p.fill('rgba(120,255,180,0.9)', sx - 1, sy - 9, 2, 2); } // runed stones
  p.ell(0x8a8a82, cx, base - 2, 8, 3); p.fill('rgba(150,255,190,0.5)', cx - 3, base - 5, 6, 2);
  p.doorX = cx; void b;
};

/** the moon faith: a silver observatory with an opened dome, a telescope and a crescent finial */
const moon: Paint = (p, b, th, X, Y, W, H) => {
  const cx = X + W / 2, base = Y + H - 3, tw = Math.round(W * 0.56), silver = 0xc8d0e8;
  p.ell('rgba(0,0,0,0.28)', cx + 5, base + 2, W / 2, 6);
  steps(p, cx, base - 6, tw + 10, 2, 0xb8c0d8);
  const bh = Math.round(H * 0.5), by = base - 8 - bh;
  p.fill(silver, cx - tw / 2, by, tw, bh); p.fill('rgba(255,255,255,0.3)', cx - tw / 2, by, 4, bh); p.fill('rgba(30,30,80,0.22)', cx + tw / 2 - 7, by, 7, bh);
  for (let j = 10; j < bh - 6; j += 10) p.fill(shadeC(silver, 0.8), cx - tw / 2, by + j, tw, 1);
  for (let k = 0; k < 2; k++) archWindow(p, cx - tw / 2 + 8 + k * (tw - 22), by + 8, 6, 12, 0x1a2a6a, 0xe8e8ff);
  // the dome, split open to the sky, a telescope through the gap
  const dr = tw / 2 + 4;
  p.x2.save(); p.x2.beginPath(); p.x2.rect(X, by - dr - 4, W, dr + 6); p.x2.clip();
  p.ell(0x4a5a98, cx, by + 2, dr, dr); p.ell(0x7a8ad0, cx - 3, by, dr - 3, dr - 3); p.ell(0xb8c4f0, cx - dr * 0.3, by - dr * 0.4, dr * 0.3, dr * 0.2);
  p.poly(0x0e1230, [cx - 4, by - dr + 2, cx + 6, by - dr + 2, cx + 10, by + 2, cx - 2, by + 2]); p.x2.restore();
  p.line(0x3a3a50, cx, by - 6, cx + 16, by - dr - 8, 3); p.circ(0xe8c060, cx + 16, by - dr - 8, 2.4);
  // the crescent
  p.circ(0xf4f0d8, cx - dr * 0.6, by - dr - 4, 6); p.circ(0x4a5a98, cx - dr * 0.6 + 3, by - dr - 6, 5);
  for (let k = 0; k < 6; k++) p.circ('rgba(235,240,255,0.9)', cx - dr + k * (dr / 2.5), by - dr - 10 + (k % 3) * 5, 1);
  doorAt(p, Math.round(cx - 4), base - 16, 8, 16, 0x2a3a78, true); p.doorX = cx; void th; void b;
};

/** the ancestor faith: a long dark hall of carved faces with niches of lamps, and a brazier that never goes out */
const ancestor: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, stone = mixC(b.wall, 0x5a5048, 0.55), cx = X + W / 2, base = Y + H - 3, wh = Math.round(H * 0.5);
  p.ell('rgba(0,0,0,0.28)', cx + 5, base + 2, W / 2, 6);
  stoneWall(p, X + 4, base - wh, W - 8, wh, stone, r);
  for (let k = 0; k < Math.floor((W - 20) / 14); k++) { const fx = X + 12 + k * 14; p.fill(shadeC(stone, 0.55), fx, base - wh + 8, 9, 12); p.fill(0xffd070, fx + 3, base - wh + 11, 3, 5); p.circ('rgba(255,208,112,0.3)', fx + 4, base - wh + 13, 6); p.fill(shadeC(stone, 1.25), fx + 1, base - wh + 22, 7, 7); p.fill(0x2a2018, fx + 2, base - wh + 24, 2, 2); p.fill(0x2a2018, fx + 5, base - wh + 24, 2, 2); }
  const rh = Math.round(H * 0.34);
  p.poly(shadeC(0x5a2a22, 1), [X - 2, base - wh + 2, X + 12, base - wh - rh, X + W - 12, base - wh - rh, X + W + 2, base - wh + 2]); p.fill('rgba(0,0,0,0.3)', X - 2, base - wh + 2, W + 4, 3);
  for (let k = 0; k < 6; k++) p.line(0x3a1a14, X + 8 + k * ((W - 16) / 5), base - wh - rh + 2, X + 4 + k * ((W - 8) / 5), base - wh + 1, 1);
  p.fill(0xb03a2a, X + 14, base - wh - rh - 4, W - 28, 3);
  doorAt(p, Math.round(cx - 6), base - 20, 12, 20, 0x2a1a14, true); p.doorX = cx;
  for (const s of [-1, 1]) { p.fill(0x3a3a3e, cx + s * 22 - 2, base - 12, 5, 10); p.ell(0x1a1a1e, cx + s * 22, base - 12, 4, 2); p.poly(0xe85a1a, [cx + s * 22 - 3, base - 12, cx + s * 22, base - 22, cx + s * 22 + 3, base - 12]); p.circ('rgba(255,140,50,0.25)', cx + s * 22, base - 16, 7); }
  for (let k = 0; k < 3; k++) { p.fill(0x6a645a, X - 8 + k * 4, base - 10 - (k % 2) * 3, 3, 10 + (k % 2) * 3); } // steles
  void th;
};

/** the war god's chapel: rough stone with weapon racks, trophy skulls, red banners and an anvil for an altar */
const war: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, stone = mixC(b.wall, 0x6a6460, 0.5), cx = X + W / 2, base = Y + H - 3, wh = Math.round(H * 0.5);
  p.ell('rgba(0,0,0,0.28)', cx + 5, base + 2, W / 2, 6);
  stoneWall(p, X + 4, base - wh, W - 8, wh, stone, r); p.fill(shadeC(stone, 0.55), X + 4, base - 3, W - 8, 3);
  p.poly(0x6a2a22, [X - 2, base - wh + 2, cx, base - wh - Math.round(H * 0.32), X + W + 2, base - wh + 2]); p.poly(shadeC(0x6a2a22, 0.7), [cx, base - wh - Math.round(H * 0.32), X + W + 2, base - wh + 2, cx, base - wh + 2]);
  for (let k = 0; k < 5; k++) p.circ(0xe8e0d0, X + 10 + k * ((W - 20) / 4), base - wh - 2, 3); // skulls along the eave
  // the great door with crossed swords above, red banners, racks of spears
  p.fill(0x2a1a14, cx - 8, base - 24, 16, 24); p.ell(0x2a1a14, cx, base - 24, 8, 4); p.fill(0x5a3a2a, cx - 7, base - 22, 6, 22); p.fill(0x5a3a2a, cx + 1, base - 22, 6, 22); p.doorX = cx;
  p.line(0xc8c8d4, cx - 10, base - wh + 8, cx + 10, base - wh + 24, 2); p.line(0xc8c8d4, cx + 10, base - wh + 8, cx - 10, base - wh + 24, 2); p.fill(gold, cx - 2, base - wh + 14, 4, 4);
  for (const s of [-1, 1]) { p.fill(0x4a3a22, cx + s * 30, base - wh + 2, 1, 22); p.poly(0xb02a1a, [cx + s * 30, base - wh + 2, cx + s * 30 + s * 10, base - wh + 6, cx + s * 30, base - wh + 14]); }
  for (let k = 0; k < 5; k++) { p.fill(0x6a4a2a, X + 8 + k * 3, base - 22, 1, 22); p.poly(0xc8c8d4, [X + 7 + k * 3, base - 22, X + 9 + k * 3, base - 22, X + 8 + k * 3, base - 27]); }
  p.fill(0x4a4f60, X + W - 22, base - 8, 12, 3); p.fill(0x7a7f90, X + W - 23, base - 11, 14, 3); void th;
};

/** the demon cult: black obsidian spires split by glowing red runes, braziers and a horned gate */
const demon: Paint = (p, b, th, X, Y, W, H) => {
  const cx = X + W / 2, base = Y + H - 3, obs = 0x1c1822;
  p.ell('rgba(0,0,0,0.4)', cx + 5, base + 2, W / 2, 7);
  const spire = (x: number, w: number, h: number) => { p.poly(obs, [x - w / 2, base - 4, x - w / 4, base - h * 0.6, x, base - h, x + w / 4, base - h * 0.55, x + w / 2, base - 4]); p.poly(0x2e2838, [x, base - h, x + w / 4, base - h * 0.55, x + w / 2, base - 4, x + 2, base - 4]); p.line(0xe03a2a, x - 1, base - h * 0.8, x + 1, base - h * 0.2, 1); p.circ('rgba(255,60,40,0.3)', x, base - h * 0.5, w * 0.5); };
  spire(cx - W * 0.3, W * 0.26, H * 0.7); spire(cx + W * 0.3, W * 0.26, H * 0.62); spire(cx, W * 0.34, H);
  p.fill(0x14101a, cx - 7, base - 22, 14, 20); p.poly(obs, [cx - 9, base - 22, cx - 12, base - 32, cx - 5, base - 24]); p.poly(obs, [cx + 9, base - 22, cx + 12, base - 32, cx + 5, base - 24]); p.fill(0xe03a2a, cx - 4, base - 12, 8, 2); p.doorX = cx;
  for (const s of [-1, 1]) { p.fill(0x3a3a3e, cx + s * 26 - 2, base - 10, 5, 8); flame(p, cx + s * 26, base - 11); }
  void th; void b;
};
const flame = (p: Pen, x: number, y: number) => { p.circ('rgba(255,80,40,0.25)', x, y - 4, 9); p.poly(0xe03a2a, [x - 3, y, x, y - 12, x + 3, y]); p.poly(0xff9a3a, [x - 1.6, y, x, y - 7, x + 1.6, y]); };

/** a faithless land's meeting hall: a timber hall with a bell */
const hall: Paint = (p, b, th, X, Y, W, H) => {
  const cx = X + W / 2, base = Y + H - 3, wh = Math.round(H * 0.5);
  p.ell('rgba(0,0,0,0.25)', cx + 4, base + 2, W / 2, 6); planks(p, X + 4, base - wh, W - 8, wh, shadeC(b.wall, 0.9));
  p.poly(shadeC(b.roof, 0.9), [X - 2, base - wh + 2, X + 10, base - wh - Math.round(H * 0.28), X + W - 10, base - wh - Math.round(H * 0.28), X + W + 2, base - wh + 2]);
  p.fill(0x5e3a26, cx - 3, base - wh - Math.round(H * 0.28) - 14, 6, 14); p.poly(shadeC(b.roof, 0.7), [cx - 5, base - wh - Math.round(H * 0.28) - 14, cx, base - wh - Math.round(H * 0.28) - 22, cx + 5, base - wh - Math.round(H * 0.28) - 14]); p.circ(gold, cx, base - wh - Math.round(H * 0.28) - 8, 2.4);
  doorAt(p, Math.round(cx - 5), base - 16, 10, 16, 0x6a4a2a, true); p.doorX = cx; void th;
};

export const FAITH: Record<string, Paint> = { light, dragon, naga, sea, nature, moon, ancestor, war, demon, none: hall };
export const sacred: Paint = (p, b, th, X, Y, W, H) => (FAITH[th.religion] ?? hall)(p, b, th, X, Y, W, H);
void flag;
