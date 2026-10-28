// Paints a town's plan into its pixel texture: streets and squares, then every building from its own drawing (not a recoloured box),
// with a different roof, wall, windows and extras each time, and finally the landmark in the square.
import { RNG, hashString } from '../sim/rng';
import type { Town } from '../sim/worldgen';
import { T, CW, CH, Tile, type CityData, type BuildingRec } from './citygen';
import type { Theme, TreeKind } from './themes';

import { NEW_STYLES, doorPath, fence } from './houses';
import { LANDMARKS, paintSquare } from './landmarks';
import { CIVIC } from './civic';
import { FATES } from '../sim/fate';
import { type Pen, type Col, makePen, hex, shadeC, mixC, shadow, shingles, slates, thatch, stoneWall, planks, bricks, windowAt, archWindow, doorAt, chimney, eaves, flag } from './draw';

// ---------------------------------------------------------------- building styles (X, Y, W, H in px; wall height F at the bottom)
type Paint = (p: Pen, b: BuildingRec, th: Theme, X: number, Y: number, W: number, H: number) => void;

const cottage: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, F = Math.min(30, Math.round(H * 0.46)), RH = H - F;
  const timber = shadeC(0x6a4a2a, r.float(0.85, 1.15));
  p.fill(b.wall, X + 1, Y + RH, W - 2, F);
  p.fill(0x6a6a62, X + 1, Y + H - 4, W - 2, 4); // foundation
  for (let i = 1; i < W - 1; i += 12) p.fill(timber, X + i, Y + RH, 2, F - 4);
  p.fill(timber, X + 1, Y + RH + Math.floor(F * 0.45), W - 2, 2); p.fill(timber, X + 1, Y + RH, W - 2, 2);
  const n = Math.max(1, Math.floor((W - 16) / 22));
  const door = r.int(0, n);
  for (let k = 0; k <= n; k++) {
    const cx = X + 8 + (k * (W - 16)) / Math.max(1, n);
    if (k === door) doorAt(p, Math.round(cx - 4), Y + H - 15, 8, 15, shadeC(0x7a5030, r.float(0.8, 1.2)));
    else windowAt(p, Math.round(cx - 3), Y + RH + 7, 7, 8, 0x8ec8e8, timber, r.chance(0.7) ? mixC(th.banner[0], 0x806040, 0.5) : undefined, r.chance(0.45), b.seed % 5 === 0);
  }
  // roof with deep eaves, ridge cap, chimney, sometimes a dormer
  const roof = b.roof;
  shingles(p, X - 3, Y + 4, W + 6, RH - 1, roof);
  p.poly(shadeC(roof, 0.82), [X - 3, Y + 4, X + 4, Y, X + W - 4, Y, X + W + 3, Y + 4]);
  p.fill(shadeC(roof, 1.3), X + 4, Y, W - 8, 2);
  eaves(p, X - 3, Y + RH + 3, W + 6);
  if (W > 44 && r.chance(0.7)) chimney(p, X + r.int(6, W - 18), Y - 6, 0x8a847a);
  if (W > 60 && r.chance(0.6)) { const dx = X + r.int(10, W - 30); p.poly(shadeC(roof, 1.08), [dx, Y + RH - 2, dx + 8, Y + 6, dx + 16, Y + RH - 2]); p.fill(b.wall, dx + 2, Y + RH - 12, 12, 9); windowAt(p, dx + 5, Y + RH - 10, 6, 6, 0x8ec8e8, timber); }
};

const stoneHouse: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, F = Math.min(30, Math.round(H * 0.46)), RH = H - F;
  stoneWall(p, X + 1, Y + RH, W - 2, F, shadeC(b.wall, 0.82), r);
  p.fill(shadeC(b.wall, 0.55), X + 1, Y + H - 3, W - 2, 3);
  const n = Math.max(1, Math.floor((W - 14) / 20));
  const door = r.int(0, n);
  for (let k = 0; k <= n; k++) {
    const cx = X + 7 + (k * (W - 14)) / Math.max(1, n);
    if (k === door) doorAt(p, Math.round(cx - 4), Y + H - 15, 8, 15, 0x5a3a22, true);
    else archWindow(p, Math.round(cx - 3), Y + RH + 6, 6, 10, 0x8aa8c8, shadeC(b.wall, 1.2));
  }
  slates(p, X - 2, Y + 4, W + 4, RH - 1, b.roof);
  p.poly(shadeC(b.roof, 0.8), [X - 2, Y + 4, X + 3, Y, X + W - 3, Y, X + W + 2, Y + 4]);
  eaves(p, X - 2, Y + RH + 3, W + 4);
  if (W > 50) chimney(p, X + r.int(6, W - 16), Y - 5, 0x6a645a);
  if (W > 66 && r.chance(0.5)) { p.fill(shadeC(b.wall, 0.9), X + W - 14, Y - 8, 14, RH + 6); p.poly(shadeC(b.roof, 0.9), [X + W - 16, Y - 8, X + W - 7, Y - 18, X + W + 2, Y - 8]); }
};

const domeHouse: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, F = Math.min(30, Math.round(H * 0.5)), RH = H - F;
  p.fill(b.wall, X + 1, Y + RH + 2, W - 2, F - 2);
  p.fill(shadeC(b.wall, 1.12), X + 1, Y + RH + 2, W - 2, 2);
  p.fill(shadeC(b.wall, 0.82), X + 1, Y + H - 3, W - 2, 3);
  // parapet and a dome (or two) on the flat roof
  p.fill(shadeC(b.wall, 1.05), X - 1, Y + RH - 2, W + 2, 6);
  const domes = W > 70 ? 2 : 1;
  for (let k = 0; k < domes; k++) {
    const cx = X + (W * (k + 1)) / (domes + 1), rr = Math.min(W * 0.28, RH * 0.9);
    p.ell(shadeC(b.roof, 0.7), cx + 1, Y + RH - 1, rr, rr * 0.9); p.x2.save(); p.x2.beginPath(); p.x2.rect(X - 4, Y - 20, W + 8, RH + 18); p.x2.clip();
    p.ell(b.roof, cx, Y + RH - 2, rr, rr); p.ell(shadeC(b.roof, 1.25), cx - rr * 0.3, Y + RH - 2 - rr * 0.4, rr * 0.35, rr * 0.3); p.x2.restore();
    p.fill(0xf2c94c, cx, Y + RH - 2 - rr - 4, 1, 5); p.circ(0xf2c94c, cx, Y + RH - 2 - rr - 5, 1.6);
  }
  const n = Math.max(1, Math.floor((W - 14) / 22)), door = r.int(0, n);
  for (let k = 0; k <= n; k++) {
    const cx = X + 7 + (k * (W - 14)) / Math.max(1, n);
    if (k === door) { doorAt(p, Math.round(cx - 4), Y + H - 15, 8, 15, 0x6a4a2a, true); for (let i = 0; i < 8; i += 2) p.fill(i % 4 ? 0xffffff : b.roof, Math.round(cx - 5) + i, Y + H - 19, 2, 4); }
    else archWindow(p, Math.round(cx - 3), Y + RH + 8, 6, 9, 0x3a6a9a, shadeC(b.wall, 0.7));
  }
  if (r.chance(0.5)) p.fill(0xb8603a, X + W - 8, Y + RH - 6, 4, 4);
};

const hutHouse: Paint = (p, b, th, X, Y, W, H) => {
  const cx = X + W / 2, cy = Y + H * 0.62, rx = Math.min(W / 2, 30), wallH = 14;
  p.ell('rgba(0,0,0,0.28)', cx + 4, cy + 8, rx, rx * 0.5);
  p.fill(b.wall, cx - rx * 0.8, cy - wallH + 6, rx * 1.6, wallH);
  p.ell(b.wall, cx, cy + 6, rx * 0.8, 5);
  for (let i = -rx * 0.8; i < rx * 0.8; i += 4) p.fill(shadeC(b.wall, 0.8), cx + i, cy - wallH + 6, 1, wallH);
  // conical thatch
  const top = Y + 2;
  p.poly(b.roof, [cx - rx - 2, cy - wallH + 8, cx, top, cx + rx + 2, cy - wallH + 8]);
  p.poly(shadeC(b.roof, 0.78), [cx, top, cx + rx + 2, cy - wallH + 8, cx + 2, cy - wallH + 8]);
  for (let k = 1; k < 5; k++) p.line(shadeC(b.roof, 0.65), cx - rx * (k / 5) - 1, cy - wallH + 8 - (cy - wallH + 8 - top) * (k / 6) * 0 + 0, cx + rx * (k / 5) + 1, cy - wallH + 8, 1);
  p.ell(shadeC(b.roof, 0.7), cx, cy - wallH + 8, rx + 2, 4);
  doorAt(p, Math.round(cx - 3), cy - 2, 6, 9, 0x3a2410, true, false);
  p.fill(0x4a3a22, cx, top - 5, 1, 6);
};

const tentHouse: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, cx = X + W / 2, base = Y + H - 4, top = Y + 1;
  p.ell('rgba(0,0,0,0.26)', cx + 4, base + 2, W / 2, 6);
  const panels = [b.roof, shadeC(b.roof, 0.78), mixC(b.roof, 0xe8dcc0, 0.35)];
  const n = 6;
  for (let k = 0; k < n; k++) {
    const x0 = X + 2 + ((W - 4) * k) / n, x1 = X + 2 + ((W - 4) * (k + 1)) / n;
    p.poly(panels[k % 3], [x0, base, cx, top, x1, base]);
  }
  p.poly(0x1a1210, [cx - 5, base, cx, base - 15, cx + 5, base]);
  p.line(0x2a1a12, cx, top, cx, base - 15, 1);
  // bone arch, ropes and stakes
  p.line(0xd8cfb8, cx - 6, base, cx - 5, base - 14, 2); p.line(0xd8cfb8, cx + 6, base, cx + 5, base - 14, 2);
  p.line('rgba(40,30,20,0.6)', X + 1, base + 1, X - 4, base + 6, 1); p.line('rgba(40,30,20,0.6)', X + W - 1, base + 1, X + W + 4, base + 6, 1);
  p.fill(0x3a2a22, cx, top - 7, 1, 8); p.poly(th.banner[0], [cx + 1, top - 7, cx + 10, top - 4 + r.int(-1, 1), cx + 1, top - 1]);
  if (r.chance(0.5)) { p.circ(0xe8e0d0, X + 6, base - 2, 2.5); p.fill(0x222222, X + 5, base - 3, 1, 1); }
};

const aframe: Paint = (p, b, th, X, Y, W, H) => {
  const F = 20, RH = H - F;
  planks(p, X + 1, Y + RH, W - 2, F, shadeC(b.wall, 0.9));
  p.poly(b.roof, [X - 3, Y + RH + 2, X + W / 2, Y - 4, X + W + 3, Y + RH + 2]);
  p.poly(shadeC(b.roof, 0.78), [X + W / 2, Y - 4, X + W + 3, Y + RH + 2, X + W / 2, Y + RH + 2]);
  p.poly(0xf6f2ea, [X - 3, Y + RH + 2, X + W / 2, Y - 4, X + W / 2 + 6, Y + 2, X + 6, Y + RH - 8, X - 3, Y + RH - 4]); // snow cap
  p.poly(0xe0e8f0, [X + W + 3, Y + RH + 2, X + W / 2, Y - 4, X + W / 2 + 6, Y + 2, X + W - 6, Y + RH - 8]);
  doorAt(p, Math.round(X + W / 2 - 4), Y + H - 14, 8, 14, 0x6a4a2a);
  windowAt(p, X + 6, Y + RH + 6, 6, 7, 0xffe6a0, 0x4a3a2a);
  chimney(p, X + W - 14, Y + 2, 0x8a847a);
};

const stiltHouse: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, F = 18, RH = H - F - 8;
  for (let i = 2; i < W - 2; i += 10) { p.fill(0x5e3a26, X + i, Y + H - 12, 3, 12); p.fill('rgba(255,255,255,0.35)', X + i - 1, Y + H - 2, 5, 1); }
  p.fill(0x9a7040, X, Y + H - 14, W, 4); p.fill(shadeC(0x9a7040, 0.7), X, Y + H - 11, W, 1);
  planks(p, X + 2, Y + RH + 2, W - 4, F, shadeC(b.wall, 0.95));
  const n = Math.max(1, Math.floor((W - 10) / 20)), door = r.int(0, n);
  for (let k = 0; k <= n; k++) { const cx = X + 6 + (k * (W - 12)) / Math.max(1, n); if (k === door) doorAt(p, Math.round(cx - 3), Y + H - 28, 7, 14, 0x6a4a2a, false, false); else windowAt(p, Math.round(cx - 3), Y + RH + 6, 6, 7, 0x9ae6f6, 0x5e3a26, undefined, r.chance(0.4)); }
  // hip roof of tiles or leaves, hung with a net and a lantern
  p.poly(b.roof, [X - 4, Y + RH + 4, X + 6, Y, X + W - 6, Y, X + W + 4, Y + RH + 4]);
  p.poly(shadeC(b.roof, 0.8), [X - 4, Y + RH + 4, X + 4, Y + RH + 4, X + 6, Y, X - 2, Y + RH - 2]);
  for (let j = 4; j < RH; j += 4) p.fill(shadeC(b.roof, 0.78), X - 2 + j / 3, Y + j, W + 4 - j / 1.5, 1);
  p.fill(shadeC(b.roof, 1.25), X + 6, Y, W - 12, 2);
  p.line(0x2a2a30, X + W - 2, Y + H - 28, X + W - 2, Y + H - 22, 1); p.circ(0xffd070, X + W - 2, Y + H - 21, 1.6);
  p.fill(0x9a7040, X + W, Y + H - 14, 8, 2); p.line(0x9a7040, X + W + 3, Y + H - 12, X + W + 3, Y + H - 2, 1); // ladder
  if (r.chance(0.5)) { p.fill(0x7a6a4a, X - 7, Y + H - 22, 6, 7); for (let i = 0; i < 6; i += 2) p.fill(0x4a3a22, X - 7 + i, Y + H - 22, 1, 7); }
};

const brickHouse: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, F = Math.min(30, Math.round(H * 0.5)), RH = H - F;
  bricks(p, X + 1, Y + RH, W - 2, F, shadeC(0xb4543a, r.float(0.8, 1.1)));
  p.fill(0x4a4a50, X + 1, Y + H - 3, W - 2, 3);
  // sawtooth roof: glazed slopes and iron ribs
  const teeth = Math.max(2, Math.floor(W / 18));
  p.fill(shadeC(b.roof, 0.7), X - 1, Y + 6, W + 2, RH - 4);
  for (let k = 0; k < teeth; k++) {
    const x0 = X + (W * k) / teeth, x1 = X + (W * (k + 1)) / teeth;
    p.poly(b.roof, [x0, Y + RH, x0, Y + 4, x1, Y + RH]);
    p.poly(0x8ab8c8, [x0, Y + 4, x0 + 2, Y + 4, x0 + 2, Y + RH - 2, x0, Y + RH]);
    p.line(shadeC(b.roof, 0.6), x0, Y + RH, x1, Y + RH, 1);
  }
  const door = r.int(0, 2);
  for (let k = 0; k < 3; k++) { const cx = X + 10 + (k * (W - 20)) / 2; if (k === door) { p.fill(0x3a3a40, cx - 5, Y + H - 18, 10, 18); p.fill(0x2a2a30, cx - 4, Y + H - 17, 4, 17); p.fill(0x2a2a30, cx + 1, Y + H - 17, 4, 17); } else windowAt(p, Math.round(cx - 3), Y + RH + 6, 7, 9, 0xffd98a, 0x3a3a40); }
  const cxn = X + r.int(6, Math.max(7, W - 14));
  p.fill(0x6a3a30, cxn, Y - 18, 8, 22); p.fill(0x3a3a3e, cxn - 1, Y - 20, 10, 3);
  p.fill('rgba(70,66,64,0.45)', cxn + 1, Y - 26, 6, 5); p.fill('rgba(70,66,64,0.3)', cxn + 4, Y - 33, 6, 6);
  p.line(0x7a7a82, X + W - 3, Y + RH, X + W - 3, Y + H - 2, 2); // downpipe
};

const spireHouse: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, F = Math.min(32, Math.round(H * 0.5)), RH = H - F;
  p.fill(b.wall, X + 4, Y + RH, W - 8, F); p.fill(0xe8c860, X + 4, Y + RH + 4, W - 8, 2); p.fill(0xe8c860, X + 4, Y + H - 6, W - 8, 2);
  p.fill(shadeC(b.wall, 0.86), X + W / 2, Y + RH, W / 2 - 4, F);
  const n = Math.max(1, Math.floor((W - 18) / 18)), door = Math.floor(n / 2);
  for (let k = 0; k <= n; k++) { const cx = X + 9 + (k * (W - 18)) / Math.max(1, n); if (k === door) doorAt(p, Math.round(cx - 4), Y + H - 16, 8, 16, 0x4a6aa8, true); else archWindow(p, Math.round(cx - 3), Y + RH + 9, 6, 11, 0x6ab0e8, 0xe8c860); }
  // conical blue roof with a golden finial and a balcony ring
  const mid = X + W / 2;
  p.fill(0xe8e0d0, X, Y + RH - 2, W, 4);
  p.poly(b.roof, [X - 1, Y + RH, mid, Y - 16, X + W + 1, Y + RH]);
  p.poly(shadeC(b.roof, 0.72), [mid, Y - 16, X + W + 1, Y + RH, mid, Y + RH]);
  for (let k = 1; k < 4; k++) p.line(shadeC(b.roof, 0.6), X + (W / 2) * (1 - k / 4), Y + RH - (RH + 16) * (k / 4) * 0.0 - 0, X + W - (W / 2) * (1 - k / 4), Y + RH, 1);
  p.fill(0xf2c94c, mid, Y - 26, 1, 12); p.circ(0xf2c94c, mid, Y - 27, 2.2);
  p.poly(th.banner[1], [mid + 1, Y - 25, mid + 9, Y - 22, mid + 1, Y - 19]);
  if (W > 60) for (const sx of [X - 6, X + W - 6]) { p.fill(b.wall, sx, Y + RH - 6, 12, F + 6); p.ell(0x6ab0e8, sx + 6, Y + RH - 6, 7, 5); p.fill(0xf2c94c, sx + 6, Y + RH - 16, 1, 6); }
  void r;
};

const forgeHouse: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, F = Math.min(30, Math.round(H * 0.5)), RH = H - F;
  stoneWall(p, X + 1, Y + RH, W - 2, F, shadeC(b.wall, 0.78), r);
  slates(p, X - 2, Y + 4, W + 4, RH - 1, shadeC(b.roof, 0.9));
  p.fill(0x3a3a3e, X + 8, Y - 14, 9, 22); p.fill(0x26262a, X + 7, Y - 16, 11, 3); p.fill(0xf08c3a, X + 9, Y - 15, 7, 1);
  p.fill('rgba(90,80,76,0.5)', X + 9, Y - 24, 6, 7);
  p.fill(0x1a1410, X + W / 2 - 7, Y + H - 18, 14, 18); p.fill(0xe04820, X + W / 2 - 5, Y + H - 14, 10, 12); p.fill(0xffb030, X + W / 2 - 3, Y + H - 10, 6, 8); p.fill('rgba(255,170,60,0.25)', X + W / 2 - 14, Y + H - 4, 28, 6);
  p.fill(0x4a4f60, X + W - 14, Y + H - 8, 10, 3); p.fill(0x7a7f90, X + W - 15, Y + H - 11, 12, 3); // anvil
  windowAt(p, X + 6, Y + RH + 6, 6, 8, 0xffa040, 0x2a2a30);
  eaves(p, X - 2, Y + RH + 3, W + 4);
};

const mushroomHouse: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, cx = X + W / 2, capC = th.leaf[b.seed % th.leaf.length] ?? 0x9a4a8a, rx = Math.min(W / 2 + 4, 34);
  p.ell('rgba(0,0,0,0.24)', cx + 4, Y + H - 2, rx * 0.7, 5);
  const sw = Math.min(W * 0.34, 18);
  p.fill(0xe8dcc0, cx - sw / 2, Y + H * 0.42, sw, H * 0.58 - 3); p.fill(0xcdbf9e, cx + sw / 4, Y + H * 0.42, sw / 4, H * 0.58 - 3); p.ell(0xcdbf9e, cx, Y + H - 3, sw / 2 + 3, 3);
  doorAt(p, Math.round(cx - 3), Y + H - 14, 6, 11, 0x6a4a2a, true, false); windowAt(p, Math.round(cx - sw / 2 + 1), Y + H * 0.55, 4, 5, 0xffe6a0, 0x8a6a40, undefined, false, true);
  p.x2.save(); p.x2.beginPath(); p.x2.rect(X - 8, Y - 4, W + 16, H * 0.5); p.x2.clip();
  p.ell(shadeC(capC, 0.72), cx + 1, Y + H * 0.46, rx, H * 0.46); p.ell(capC, cx, Y + H * 0.44, rx, H * 0.44); p.ell(shadeC(capC, 1.25), cx - rx * 0.3, Y + H * 0.22, rx * 0.4, H * 0.16);
  for (let k = 0; k < 6; k++) p.circ('rgba(255,255,255,0.8)', cx - rx * 0.7 + r.int(0, Math.floor(rx * 1.4)), Y + H * 0.12 + r.int(0, Math.floor(H * 0.3)), r.float(1.3, 2.6));
  p.x2.restore();
  p.ell('rgba(120,255,200,0.3)', cx, Y + H - 2, rx * 0.7, 3);
};

const keepHouse: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, F = Math.min(34, Math.round(H * 0.55)), RH = H - F;
  stoneWall(p, X, Y + RH - 6, W, F + 6, shadeC(b.wall, 0.8), r);
  for (let i = 0; i < W; i += 8) p.fill(shadeC(b.wall, 0.95), X + i, Y + RH - 12, 5, 7);
  p.fill(shadeC(b.wall, 0.65), X, Y + RH - 5, W, 2);
  for (const tx of [X - 6, X + W - 8]) { stoneWall(p, tx, Y + RH - 14, 14, F + 14, shadeC(b.wall, 0.7), r); for (let i = 0; i < 14; i += 5) p.fill(shadeC(b.wall, 0.95), tx + i, Y + RH - 20, 3, 6); p.poly(b.roof, [tx - 1, Y + RH - 20, tx + 7, Y + RH - 32, tx + 15, Y + RH - 20]); }
  p.fill(0x1a1a1e, X + W / 2 - 6, Y + H - 20, 12, 20); p.ell(0x1a1a1e, X + W / 2, Y + H - 20, 6, 5);
  for (let i = -4; i <= 4; i += 4) p.fill(0x5a5a60, X + W / 2 + i, Y + H - 22, 1, 12);
  flag(p, X + W / 2, Y + RH - 12, th.banner[0], th.banner[1]);
  archWindow(p, X + 12, Y + RH + 6, 5, 10, 0x2a3a50, 0x5a5a60); archWindow(p, X + W - 17, Y + RH + 6, 5, 10, 0x2a3a50, 0x5a5a60);
};

/** the giant-tree house of Silvanel: a cabin built into the foot of a great trunk, roofed with living leaves; its colour is its branch of the world tree */
const treeHouse: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, leaf = th.leaf, L0 = leaf[b.seed % leaf.length], L1 = leaf[(b.seed + 1) % leaf.length], L2 = leaf[(b.seed + 2) % leaf.length];
  const tx = X + (r.chance(0.5) ? W * 0.3 : W * 0.7), trR = Math.min(13, W * 0.2), base = Y + H - 4;
  p.ell('rgba(0,0,0,0.26)', X + W / 2 + 6, base + 3, W / 2 + 4, 7);
  // canopy behind: soft layers of foliage
  const crown = (cx: number, cy: number, rad: number) => { p.circ(shadeC(L0, 0.6), cx + 2, cy + 3, rad); p.circ(L0, cx, cy, rad); p.circ(L1, cx - rad * 0.3, cy - rad * 0.3, rad * 0.62); p.circ(shadeC(L2, 1.1), cx + rad * 0.4, cy - rad * 0.2, rad * 0.4); };
  crown(tx - 14, Y + 16, 16); crown(tx + 12, Y + 14, 15); crown(tx, Y + 6, 17);
  // roots and trunk
  for (const d of [-1, 1]) { p.x2.strokeStyle = hex(0x4a3322); p.x2.lineWidth = 4; p.x2.beginPath(); p.x2.moveTo(tx, base - 8); p.x2.quadraticCurveTo(tx + d * trR, base, tx + d * (trR + 12), base + 2); p.x2.stroke(); }
  p.fill(0x5a4030, tx - trR, Y + 18, trR * 2, base - Y - 18); p.ell(0x5a4030, tx, base - 2, trR + 2, 5);
  p.fill(shadeC(0x5a4030, 1.3), tx - trR, Y + 18, 3, base - Y - 18); p.fill(shadeC(0x5a4030, 0.65), tx + trR - 4, Y + 18, 4, base - Y - 18);
  for (let k = 0; k < 7; k++) p.fill(shadeC(0x5a4030, 0.6), tx - trR + 3 + k * (trR * 2 - 6) / 6, Y + 22 + (k % 3) * 8, 1, 10 + (k % 2) * 6);
  // the cabin leans against the trunk: plank walls, round door and window, roof of overlapping leaves
  const cabX = tx > X + W / 2 ? X + 2 : tx + trR - 4, cabW = Math.min(W - trR - 4, 40);
  const cx0 = Math.min(cabX, X + W - cabW - 2), cy0 = base - 22;
  planks(p, cx0, cy0, cabW, 22, shadeC(0x8a6a46, r.float(0.9, 1.1)));
  p.ell(0x4a3220, cx0 + cabW / 2, cy0 + 20, 4, 6); p.fill(0x4a3220, cx0 + cabW / 2 - 4, cy0 + 12, 8, 10); p.ell(0x6a4a2a, cx0 + cabW / 2, cy0 + 20, 3, 5);
  p.circ(0xffe6a0, cx0 + 7, cy0 + 9, 3); p.line(0x5a3a22, cx0 + 7, cy0 + 6, cx0 + 7, cy0 + 12, 1); p.line(0x5a3a22, cx0 + 4, cy0 + 9, cx0 + 10, cy0 + 9, 1);
  for (let i = 0; i < cabW + 6; i += 5) for (let j = 0; j < 3; j++) { p.ell(j % 2 ? L1 : L0, cx0 - 3 + i + (j % 2) * 2.5, cy0 - 2 + j * 4, 4, 3); }
  p.fill('rgba(0,0,0,0.25)', cx0 - 3, cy0 + 8, cabW + 6, 2);
  // a rope stair round the trunk, a hanging lantern, glowing moss
  for (let k = 0; k < 4; k++) p.fill(0x8a6a46, tx - trR - 3 + (k % 2) * 3, cy0 - 4 - k * 6, 7, 2);
  p.line(0x3a2a1a, tx + trR - 1, Y + 28, tx + trR - 1, Y + 36, 1); p.circ(0xffd878, tx + trR - 1, Y + 37, 2); p.circ('rgba(255,216,120,0.3)', tx + trR - 1, Y + 37, 5);
  for (let k = 0; k < 4; k++) p.circ('rgba(150,255,190,0.7)', X + r.int(2, W - 2), base + r.int(-1, 3), 1.2);
};

export const STYLES: Record<string, Paint> = { ...NEW_STYLES, cottage, stone: stoneHouse, dome: domeHouse, hut: hutHouse, tent: tentHouse, aframe, tree: treeHouse, stilt: stiltHouse, brick: brickHouse, spire: spireHouse, forge: forgeHouse, mushroom: mushroomHouse, keep: keepHouse };

// ---------------------------------------------------------------- the buildings a country is known for
export const SPECIAL: Record<string, Paint> = {
  cathedral(p, b, th, X, Y, W, H) {
    const r = p.r, F = Math.round(H * 0.5), RH = H - F, mid = X + W / 2;
    const wall = b.wall;
    p.fill(wall, X + 2, Y + RH, W - 4, F); p.fill(shadeC(wall, 0.85), X + W * 0.62, Y + RH, W * 0.38 - 2, F);
    for (const tx of [X, X + W - 14]) { p.fill(shadeC(wall, 0.92), tx, Y + RH - 18, 14, F + 18); p.poly(th.temple === 'dome' ? b.roof : shadeC(b.roof, 0.9), [tx - 1, Y + RH - 18, tx + 7, Y + RH - 40, tx + 15, Y + RH - 18]); p.fill(0xf2c94c, tx + 7, Y + RH - 48, 1, 9); p.fill(0xf2c94c, tx + 5, Y + RH - 45, 5, 1); archWindow(p, tx + 4, Y + RH - 8, 6, 12, 0x6a8ad8, 0xe8e0c8); }
    slates(p, X + 14, Y + RH - 6, W - 28, 10, 0xd8d0b8);
    p.poly(0xd8d0b8, [X + 16, Y + RH - 6, mid, Y + 4, X + W - 16, Y + RH - 6]); p.poly(shadeC(0xd8d0b8, 0.8), [mid, Y + 4, X + W - 16, Y + RH - 6, mid, Y + RH - 6]);
    p.circ(0xf0d8a0, mid, Y + RH + 8, 6); p.circ(0x5a7ad8, mid, Y + RH + 8, 4); p.circ(0xe05a5a, mid, Y + RH + 8, 1.6);
    doorAt(p, Math.round(mid - 6), Y + H - 22, 12, 22, 0x6a4a2a, true);
    p.fill(0xf2c94c, mid, Y - 4, 1, 10); p.fill(0xf2c94c, mid - 3, Y, 7, 1);
    void r;
  },
  granary(p, b, th, X, Y, W, H) {
    const r = p.r;
    p.fill('rgba(0,0,0,0.25)', X + 5, Y + 7, W, H - 2);
    const silos = Math.max(2, Math.floor(W / 24));
    for (let k = 0; k < silos; k++) {
      const cx = X + 14 + (k * (W - 28)) / Math.max(1, silos - 1), top = Y + 10 + (k % 2) * 4;
      p.fill(0xcfc8b4, cx - 11, top, 22, H - 12 - (top - Y)); p.fill(shadeC(0xcfc8b4, 0.8), cx + 3, top, 8, H - 12 - (top - Y));
      for (let j = top + 6; j < Y + H - 12; j += 7) p.fill(0x8a8478, cx - 11, j, 22, 1);
      p.ell(shadeC(b.roof, 1.05), cx, top, 12, 5); p.poly(b.roof, [cx - 12, top, cx, top - 10, cx + 12, top]); p.poly(shadeC(b.roof, 0.75), [cx, top - 10, cx + 12, top, cx, top]);
    }
    planks(p, X + 2, Y + H - 16, W - 4, 14, 0x9a7a50); doorAt(p, Math.round(X + W / 2 - 6), Y + H - 15, 12, 15, 0x5a3a22, false, false);
    p.fill(0xe0c050, X + 4, Y + H - 4, 10, 3); void r;
  },
  warehouse(p, b, th, X, Y, W, H) {
    const r = p.r, F = Math.round(H * 0.55), RH = H - F;
    planks(p, X + 1, Y + RH, W - 2, F, shadeC(b.wall, 0.8));
    p.fill(0x3a3a3e, X + 1, Y + H - 3, W - 2, 3);
    shingles(p, X - 3, Y + 4, W + 6, RH, shadeC(b.roof, 0.9)); p.poly(shadeC(b.roof, 0.75), [X - 3, Y + 4, X + 4, Y, X + W - 4, Y, X + W + 3, Y + 4]); eaves(p, X - 3, Y + RH + 4, W + 6);
    const doors = Math.max(2, Math.floor(W / 30));
    for (let k = 0; k < doors; k++) { const cx = X + 8 + (k * (W - 24)) / Math.max(1, doors - 1); p.fill(0x4a3220, cx, Y + H - 20, 16, 20); p.fill(0x5e4228, cx + 1, Y + H - 19, 7, 19); p.fill(0x5e4228, cx + 8, Y + H - 19, 7, 19); p.line(0x3a2a18, cx + 1, Y + H - 19, cx + 15, Y + H - 4, 1); }
    p.fill(0x8a5a2a, X + W - 12, Y + H - 8, 9, 8); p.fill(0xa87a3a, X + W - 11, Y + H - 15, 8, 7); p.fill(0x6a4a2a, X + W - 20, Y + H - 6, 6, 6);
    if (r.chance(0.6)) { p.fill(0x6a4a2a, X + 6, Y + 2, 2, 12); p.fill(0x6a4a2a, X + 6, Y + 2, 12, 2); }
  },
  library(p, b, th, X, Y, W, H) {
    const r = p.r, F = Math.round(H * 0.55), RH = H - F, mid = X + W / 2;
    stoneWall(p, X + 1, Y + RH, W - 2, F, 0xc8bea8, r);
    slates(p, X - 2, Y + 10, W + 4, RH - 8, shadeC(b.roof, 0.85)); eaves(p, X - 2, Y + RH + 2, W + 4);
    p.fill(0xc8bea8, mid - 12, Y - 8, 24, 20); p.ell(b.roof, mid, Y - 8, 13, 9); p.fill(0xf2c94c, mid, Y - 22, 1, 6); p.circ(0xf2c94c, mid, Y - 23, 1.5);
    for (let k = 0; k < 4; k++) archWindow(p, Math.round(X + 8 + (k * (W - 24)) / 3), Y + RH + 4, 7, F - 12, 0x8ab0d8, 0x6a5a44);
    doorAt(p, Math.round(mid - 5), Y + H - 14, 10, 14, 0x4a3220, true);
    for (let k = 0; k < 4; k++) p.fill([0xa83a3a, 0x3a6aa8, 0xd8a030, 0x3a8a4a][k], mid - 10 + k * 5, Y - 2, 3, 5);
  },
  barracks(p, b, th, X, Y, W, H) {
    const r = p.r, F = Math.round(H * 0.55), RH = H - F;
    stoneWall(p, X, Y + RH - 6, W, F + 6, 0x8a8478, r);
    for (let i = 0; i < W; i += 8) p.fill(0xa09a8c, X + i, Y + RH - 12, 5, 7);
    p.fill(0x6a645a, X, Y + RH - 5, W, 2);
    for (let k = 0; k < 3; k++) { const cx = X + 10 + (k * (W - 20)) / 2; if (k === 1) { p.fill(0x1a1a1e, cx - 5, Y + H - 16, 10, 16); p.ell(0x1a1a1e, cx, Y + H - 16, 5, 4); } else p.fill(0x2a2a30, cx - 2, Y + RH + 6, 4, 9); }
    flag(p, X + 6, Y + RH - 10, th.banner[0], th.banner[1]); flag(p, X + W - 8, Y + RH - 10, th.banner[1], th.banner[0]);
    p.fill(0x6a4a2a, X + W - 22, Y + H - 12, 2, 12); p.fill(0x8a8a94, X + W - 23, Y + H - 16, 4, 6); p.fill(0x6a4a2a, X + W - 17, Y + H - 11, 2, 11); p.fill(0x8a8a94, X + W - 18, Y + H - 15, 4, 5);
  },
  minehead(p, b, th, X, Y, W, H) {
    const r = p.r, cx = X + W / 2;
    p.ell('rgba(0,0,0,0.28)', cx + 4, Y + H - 3, W / 2, 7);
    p.poly(0x5a4a40, [X + 2, Y + H - 2, X + 12, Y + H * 0.5, X + W - 12, Y + H * 0.5, X + W - 2, Y + H - 2]); p.poly(0x6e5c50, [X + 8, Y + H - 4, X + 18, Y + H * 0.52, X + W * 0.5, Y + H * 0.5, X + W * 0.5, Y + H - 4]);
    p.poly(0x14100e, [cx - 8, Y + H - 3, cx - 6, Y + H - 22, cx + 6, Y + H - 22, cx + 8, Y + H - 3]); p.fill(0x6a4a2a, cx - 10, Y + H - 24, 3, 22); p.fill(0x6a4a2a, cx + 7, Y + H - 24, 3, 22); p.fill(0x6a4a2a, cx - 10, Y + H - 26, 20, 3);
    p.fill(0x5e3a26, cx - 2, Y + 2, 4, H * 0.5); p.line(0x3a2a1a, cx - 12, Y + 6, cx + 12, Y + 6, 2); p.circ(0x7a7a82, cx, Y + 6, 4); p.circ(0x3a3a40, cx, Y + 6, 1.5);
    p.line(0x6a5a50, cx - 6, Y + H - 3, X - 2, Y + H + 2, 1); p.line(0x6a5a50, cx + 6, Y + H - 3, X + W + 2, Y + H + 2, 1);
    p.fill(0x4a4f60, X + W - 18, Y + H - 12, 13, 8); p.fill(0xe0b030, X + W - 16, Y + H - 14, 9, 3); p.circ(0x2a2a30, X + W - 15, Y + H - 4, 2); p.circ(0x2a2a30, X + W - 8, Y + H - 4, 2);
    void r;
  },
  arena(p, b, th, X, Y, W, H) {
    const cx = X + W / 2, cy = Y + H / 2 + 2, rx = W / 2, ry = H / 2 - 2;
    p.ell('rgba(0,0,0,0.28)', cx + 4, cy + 6, rx, ry);
    p.ell(0xc8bea8, cx, cy, rx, ry); p.ell(0x9a907a, cx, cy, rx - 6, ry - 5); p.ell(0xd8c08a, cx, cy + 1, rx - 12, ry - 9);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; p.fill(0x4a4238, cx + Math.cos(a) * (rx - 3) - 1, cy + Math.sin(a) * (ry - 2) - 2, 2, 4); }
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; p.circ([th.banner[0], th.banner[1], 0xf0e8d0][k % 3], cx + Math.cos(a) * (rx - 8), cy + Math.sin(a) * (ry - 6), 1.4); }
    p.line(0x7a6a50, cx - rx + 14, cy, cx + rx - 14, cy, 1); p.circ(0xb04a3a, cx, cy, 2);
  },
  market(p, b, th, X, Y, W, H) {
    const r = p.r, rows = Math.max(1, Math.floor((H - 8) / 22));
    for (let j = 0; j < rows; j++) {
      const y0 = Y + 6 + j * 22, n = Math.floor((W - 4) / 14);
      p.fill('rgba(0,0,0,0.22)', X + 4, y0 + 20, W - 4, 4);
      for (let k = 0; k < n; k++) {
        const x0 = X + 2 + k * 14, a = [th.banner[0], th.banner[1], 0xf0e8d0, 0xe04848, 0x5aa0ea][(j + k) % 5];
        p.fill(0x6a4a2a, x0, y0 + 8, 2, 12); p.fill(0x6a4a2a, x0 + 12, y0 + 8, 2, 12);
        for (let s = 0; s < 14; s += 4) p.fill(s % 8 ? 0xffffff : a, x0 + s, y0, 4, 8); p.fill('rgba(0,0,0,0.2)', x0, y0 + 8, 14, 2);
        p.fill(0x9a7a50, x0 + 1, y0 + 14, 12, 5);
        for (let g = 0; g < 4; g++) p.circ([0xe04848, 0xf2c94c, 0x6cc05a, 0xe08030][(g + k) % 4], x0 + 3 + g * 3, y0 + 13, 1.6);
      }
    }
    void r;
  },
};

Object.assign(SPECIAL, CIVIC);

// ---------------------------------------------------------------- landmark in the square
function landmark(p: Pen, d: CityData, px: number, py: number) {
  const th = d.theme, r = p.r;
  const drawNew = LANDMARKS[th.centre];
  if (drawNew) { drawNew(p, d, px, py); return; }
  const rock = (c: number, x: number, y: number, rad: number) => { p.circ(shadeC(c, 0.75), x + 1, y + 1, rad); p.circ(c, x, y, rad); };
  switch (th.centre) {
    case 'statue': rock(0xb8b0a0, px, py, 16); p.fill(0xd8d0c0, px - 4, py - 22, 8, 22); p.poly(0xf2c94c, [px - 6, py - 22, px, py - 32, px + 6, py - 22]); break;
    case 'forge': rock(0x5a5a62, px, py, 17); p.fill(0x34343a, px - 11, py - 16, 22, 14); p.fill(0xf08c3a, px - 8, py - 13, 16, 6); p.fill(0xffd36a, px - 4, py - 11, 8, 3); p.fill(0x4a4f60, px - 16, py + 4, 12, 5); p.fill(0x7a7f90, px - 17, py + 2, 14, 3); p.fill(0x34343a, px + 6, py - 28, 8, 14); break;
    case 'gear': { rock(0x6a6a70, px, py, 19); p.x2.fillStyle = hex(0x8a8a90); for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; p.x2.fillRect(px + Math.cos(a) * 17 - 2, py + Math.sin(a) * 17 - 2, 4, 4); } p.circ(0x44444a, px, py, 10); p.circ(0xd8a030, px, py, 4); break; }
    case 'oasis': p.ell(0x2e8a3e, px, py, 36, 20); p.ell(0x5aa0ea, px, py, 28, 14); p.ell(0x9ad0f6, px - 6, py - 3, 11, 4); for (const dx of [-26, 24]) { p.fill(0x8a5a3a, px + dx, py - 22, 2, 18); p.fill(0x2e8a3e, px + dx - 8, py - 26, 18, 5); p.fill(0x3eaa4e, px + dx - 5, py - 29, 12, 3); } break;
    case 'bonfire': p.circ(0x3a2a22, px, py + 2, 14); p.fill(0x5e3a26, px - 11, py - 1, 22, 3); p.fill(0x5e3a26, px - 4, py - 9, 7, 14); p.poly(0xe04820, [px - 7, py - 2, px, py - 22, px + 7, py - 2]); p.poly(0xffb030, [px - 4, py - 2, px, py - 14, px + 4, py - 2]); for (let k = 0; k < 6; k++) p.circ(0xd8cfb8, px - 16 + k * 6, py + 10, 1.5); break;
    case 'clock': p.fill(0x6a7088, px - 11, py - 32, 22, 36); p.fill(0x8a90a8, px - 11, py - 32, 5, 36); p.poly(0x3a4660, [px - 13, py - 32, px, py - 46, px + 13, py - 32]); p.circ(0xe8e0c0, px, py - 21, 6); p.fill(0x1a1a22, px - 1, py - 26, 2, 6); p.fill(0x1a1a22, px, py - 21, 5, 1); p.circ(0xf2c94c, px, py - 26 + 4, 0.1); break;
    case 'sapling': p.circ('rgba(160,255,140,0.28)', px, py - 8, 30); p.fill(0x5e3a26, px - 4, py - 14, 8, 16); p.circ(0x2f8a3f, px, py - 22, 15); p.circ(0x4aa04e, px - 6, py - 27, 8); p.circ(0x9be07a, px + 7, py - 20, 3.5); break;
    case 'worldtree': {
      // the trunk the city grows in: a mountain of bark with roots for streets, windows lit in its fissures, a crown filling the sky
      const R = 62;
      p.ell('rgba(0,0,0,0.3)', px + 8, py + 12, R + 8, R * 0.5);
      const root = (a: number, len: number, w: number) => { p.x2.strokeStyle = hex(0x4a3322); p.x2.lineWidth = w; p.x2.lineCap = 'round'; p.x2.beginPath(); p.x2.moveTo(px + Math.cos(a) * R * 0.6, py + Math.sin(a) * R * 0.3); p.x2.quadraticCurveTo(px + Math.cos(a) * (R + len * 0.5), py + Math.sin(a) * (R * 0.5 + len * 0.2) + 6, px + Math.cos(a) * (R + len), py + Math.sin(a) * (R * 0.5 + len * 0.3)); p.x2.stroke(); };
      for (let k = 0; k < 11; k++) root((k / 11) * Math.PI * 2 + 0.2, 36 + (k % 3) * 14, 9 - (k % 3) * 2);
      p.ell(0x4a3322, px, py + 6, R, R * 0.58); p.fill(0x5a4030, px - R * 0.82, py - 70, R * 1.64, 80); p.ell(0x5a4030, px, py - 70, R * 0.82, R * 0.3);
      p.fill(shadeC(0x5a4030, 1.25), px - R * 0.82, py - 70, 10, 80); p.fill(shadeC(0x5a4030, 0.6), px + R * 0.82 - 14, py - 70, 14, 80);
      for (let k = 0; k < 14; k++) p.fill(shadeC(0x5a4030, 0.55), px - R * 0.75 + k * (R * 1.5) / 13, py - 66 + (k % 4) * 10, 2, 28 + (k % 3) * 8);
      for (let k = 0; k < 9; k++) { const wx = px - R * 0.6 + (k % 3) * R * 0.6, wy = py - 52 + Math.floor(k / 3) * 22; p.ell(0x1a120a, wx, wy, 6, 9); p.ell(0xffd878, wx, wy + 1, 4, 6); p.circ('rgba(255,216,120,0.25)', wx, wy, 11); }
      p.fill(0x3a2a1a, px - 10, py - 12, 20, 22); p.ell(0x3a2a1a, px, py - 12, 10, 8); p.ell(0xffe6a0, px, py - 4, 4, 6);
      const crown = (cx: number, cy: number, rad: number, c: number) => { p.circ(shadeC(c, 0.6), cx + 3, cy + 4, rad); p.circ(c, cx, cy, rad); p.circ(shadeC(c, 1.3), cx - rad * 0.3, cy - rad * 0.3, rad * 0.55); };
      const L = th.leaf;
      for (const [cx, cy, rad] of [[-52, -86, 30], [52, -86, 30], [0, -96, 38], [-30, -118, 28], [30, -118, 28], [0, -132, 30]] as [number, number, number][]) crown(px + cx, py + cy, rad, L[(Math.abs(cx) + rad) % L.length]);
      for (let k = 0; k < 14; k++) p.circ('rgba(255,252,190,0.85)', px - 70 + r.int(0, 140), py - 150 + r.int(0, 90), 1.4);
      break;
    }
    case 'abyss': p.ell('rgba(0,0,0,0.3)', px + 4, py + 6, 50, 30); p.ell(0x4a3a34, px, py, 48, 28); p.ell(0x140a08, px, py + 2, 38, 21); p.ell(0x5a1408, px, py + 5, 28, 14); p.ell(0xc2360c, px, py + 6, 20, 9); p.ell(0xff8a2a, px, py + 7, 11, 4); for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; p.fill(0x6a5a52, px + Math.cos(a) * 44 - 2, py + Math.sin(a) * 25 - 3, 4, 6); } for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.4; p.line(0x2a2a30, px + Math.cos(a) * 44, py + Math.sin(a) * 25, px + Math.cos(a) * 20, py + Math.sin(a) * 10 + 3, 2); } break;
    case 'arkea': { p.ell('rgba(0,0,0,0.3)', px + 4, py + 6, 62, 36); p.ell(0x5a5a60, px, py, 60, 34); p.ell(0x34343c, px, py, 52, 29); p.x2.strokeStyle = hex(0xd8d2b8); for (const [rr, w] of [[48, 2], [38, 1.5], [26, 1.5], [14, 2]] as [number, number][]) { p.x2.lineWidth = w; p.x2.beginPath(); p.x2.ellipse(px, py, rr * 1.12, rr * 0.62, 0, 0, Math.PI * 2); p.x2.stroke(); }
      for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 - Math.PI / 2, nx = px + Math.cos(a) * 36, ny = py + Math.sin(a) * 20; p.circ('rgba(120,255,235,0.35)', nx, ny, 8); p.circ(0xd8f8f2, nx, ny, 2.4); p.line(0xd8d2b8, px, py, nx, ny, 1); }
      p.circ('rgba(160,255,240,0.4)', px, py, 14); p.circ(0xa0fff0, px, py, 5); break; }
    case 'gate': p.ell('rgba(0,0,0,0.3)', px + 3, py + 5, 44, 24); p.ell(0x6a6a7a, px, py, 42, 22); p.ell(0x0a0814, px, py + 1, 32, 15); p.ell(0x2a2050, px, py + 2, 24, 10); for (let k = 0; k < 3; k++) { p.x2.strokeStyle = 'rgba(200,190,255,0.5)'; p.x2.lineWidth = 1.2; p.x2.beginPath(); p.x2.ellipse(px, py + 2, 8 + k * 7, 3 + k * 3, k, 0, 4.2); p.x2.stroke(); } for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.circ(0xffd890, px + Math.cos(a) * 39, py + Math.sin(a) * 20, 1.6); } break;
    case 'lake': p.ell('rgba(0,0,0,0.25)', px + 4, py + 5, 48, 28); p.ell(0xcfc8b4, px, py, 46, 26); p.ell(0x3a8ad8, px, py, 40, 21); p.ell(0x7ac0f0, px - 6, py - 3, 24, 8); for (let k = 0; k < 6; k++) p.fill('rgba(255,255,255,0.6)', px - 22 + k * 8, py + 4 + (k % 2) * 3, 5, 1); for (const dx of [-8, 0, 8]) p.fill('rgba(230,248,255,0.75)', px + 36 + dx * 0.3, py + 14, 2, 14); break;
    case 'airship': p.ell('rgba(0,0,0,0.28)', px + 8, py + 28, 70, 10); p.ell(0xe8dcc0, px, py - 14, 62, 18); p.ell(shadeC(0xe8dcc0, 0.82), px + 4, py - 8, 60, 13); for (let k = 0; k < 5; k++) p.fill(0x8a7a60, px - 44 + k * 22, py - 30, 1, 26); p.fill(0x5a4a3a, px - 16, py + 2, 32, 7); p.fill(th.banner[0], px - 62, py - 18, 10, 6); p.fill(0x4a4a52, px - 66, py - 26, 3, 56); p.fill(0x4a4a52, px + 62, py - 26, 3, 56); p.line(0x6a6a72, px - 64, py - 24, px - 50, py - 16, 1); p.line(0x6a6a72, px + 64, py - 24, px + 50, py - 16, 1); break;
    case 'lighthouse': p.ell('rgba(0,0,0,0.3)', px + 5, py + 8, 20, 8); p.poly(0xf0f0f0, [px - 11, py + 4, px - 6, py - 44, px + 6, py - 44, px + 11, py + 4]); p.poly(0xd04a3a, [px - 10, py - 8, px - 8, py - 18, px + 8, py - 18, px + 10, py - 8]); p.poly(0xd04a3a, [px - 8, py - 30, px - 7, py - 40, px + 7, py - 40, px + 8, py - 30]); p.fill(0x3a3a40, px - 8, py - 52, 16, 9); p.circ('rgba(255,240,160,0.5)', px, py - 48, 14); p.circ(0xfff0a0, px, py - 48, 4); p.poly(0xb04a3a, [px - 9, py - 52, px, py - 60, px + 9, py - 52]); break;
    case 'council': { p.ell('rgba(0,0,0,0.25)', px + 4, py + 6, 62, 34); p.ell(0xd8d0c0, px, py, 58, 32); p.ell(0xb8b0a0, px, py, 50, 27); for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 - Math.PI / 2, cx = px + Math.cos(a) * 42, cy = py + Math.sin(a) * 23; p.fill('rgba(0,0,0,0.2)', cx - 2, cy + 1, 7, 12); p.fill(0xf4efe0, cx - 3, cy - 14, 6, 15); p.fill(0xd8d0c0, cx - 4, cy - 16, 8, 3); p.fill([0xe04848, 0x5aa0ea, 0xf2c94c, 0x6cc05a, 0xc07aff, 0xe08030, 0x20a0a0, 0xd04a8a, 0xf0f0f0][k], cx - 2, cy - 22, 4, 6); } p.ell(0xf2c94c, px, py, 12, 6.5); p.circ(0xfff0c0, px, py - 1, 3); break; }
    case 'pyramid': p.ell('rgba(0,0,0,0.3)', px + 8, py + 12, 54, 14); p.poly(0xd8b86a, [px - 52, py + 10, px, py - 56, px + 52, py + 10]); p.poly(0xb8984a, [px, py - 56, px + 52, py + 10, px, py + 10]); for (let k = 1; k < 8; k++) p.line('rgba(90,60,20,0.35)', px - 52 * (1 - k / 8) - 52 * (k / 8) * 0 + (k * 52) / 8 * 0 - (52 - k * 6.5) , py + 10 - k * 8.2, px + (52 - k * 6.5), py + 10 - k * 8.2, 1); p.poly(0xf2c94c, [px - 4, py - 46, px, py - 56, px + 4, py - 46]); p.fill(0x1a1208, px - 5, py - 2, 10, 12); break;
    case 'crystal': p.ell('rgba(0,0,0,0.25)', px + 4, py + 8, 28, 8); for (const [dx, h, w, c] of [[-14, 34, 8, 0xa8e0f0], [0, 52, 11, 0xd8c8f8], [14, 30, 8, 0x88b8e8], [-6, 22, 6, 0xf0d8f8], [8, 26, 6, 0xb8f0e8]] as [number, number, number, number][]) { p.poly(c, [px + dx - w, py + 4, px + dx - w * 0.3, py - h, px + dx + w * 0.4, py - h * 0.9, px + dx + w, py + 4]); p.poly(shadeC(c, 0.72), [px + dx + w * 0.2, py - h * 0.95, px + dx + w, py + 4, px + dx, py + 4]); p.fill('rgba(255,255,255,0.5)', px + dx - w * 0.5, py - h * 0.7, 2, h * 0.5); } p.circ('rgba(200,230,255,0.25)', px, py - 10, 38); break;
    case 'obelisk': p.ell('rgba(0,0,0,0.3)', px + 5, py + 8, 22, 7); p.poly(0x8a8478, [px - 9, py + 6, px - 6, py - 46, px + 6, py - 46, px + 9, py + 6]); p.poly(0x6a645a, [px + 2, py - 46, px + 6, py - 46, px + 9, py + 6, px + 3, py + 6]); p.poly(0xb8b0a0, [px - 6, py - 46, px, py - 56, px + 6, py - 46]); for (let k = 0; k < 6; k++) p.fill('rgba(40,30,20,0.55)', px - 3, py - 40 + k * 7, 6, 1); p.fill(0x6a645a, px - 13, py + 4, 26, 5); break;
    default: rock(0x7e786e, px, py, 15); p.circ(0x5aa0ea, px, py, 11); p.fill(0xc9ccd6, px - 2, py - 8, 4, 8);
  }
}

// what the town is known for, drawn into the street scene (fish racks, barrels, anvils, cloth lines...)
function props(d: CityData, x2: CanvasRenderingContext2D, fill: (c: Col, x: number, y: number, w: number, h: number) => void, r: RNG) {
  const id = d.spec?.id;
  const { grid, buildings } = d;
  const spotsNear = (kind: string) => buildings.filter((b) => b.kind === kind);
  const free = (x: number, y: number) => grid[y * CW + x] === Tile.Ground;
  const place = (n: number, draw: (X: number, Y: number) => void, near?: BuildingRec) => {
    for (let k = 0, got = 0; k < 200 && got < n; k++) {
      const x = near ? r.int(near.x - 2, near.x + near.w + 1) : r.int(CW / 2 - 40, CW / 2 + 40), y = near ? r.int(near.y - 1, near.y + near.h + 2) : r.int(CH / 2 - 24, CH / 2 + 24);
      if (x < 1 || y < 1 || x >= CW - 1 || y >= CH - 1 || !free(x, y)) continue;
      grid[y * CW + x] = Tile.Tree; // blocks buildings; people stand next to it
      draw(x * T, y * T); got++;
    }
  };
  const barrel = (X: number, Y: number) => { fill(0x8a5a3a, X + 3, Y + 4, 10, 10); fill(0x5e3a26, X + 3, Y + 7, 10, 1); fill(0x5e3a26, X + 3, Y + 11, 10, 1); fill(0xa87a4a, X + 4, Y + 4, 3, 10); };
  const sack = (X: number, Y: number, c: number) => { fill(c, X + 3, Y + 6, 10, 8); fill('rgba(0,0,0,0.22)', X + 3, Y + 12, 10, 2); fill(0xf0e0b0, X + 6, Y + 4, 4, 3); };
  const hay = (X: number, Y: number) => { fill(0xd8b040, X + 1, Y + 6, 14, 9); fill(0xf0cc60, X + 3, Y + 3, 10, 5); fill(0xb8902a, X + 1, Y + 12, 14, 2); };
  const rack = (X: number, Y: number) => { fill(0x5e3a26, X + 1, Y + 3, 2, 12); fill(0x5e3a26, X + 13, Y + 3, 2, 12); fill(0x5e3a26, X + 1, Y + 3, 14, 2); for (let k = 0; k < 4; k++) { fill(0x9ab8c8, X + 3 + k * 3, Y + 5, 2, 6); fill(0x6a8898, X + 3 + k * 3, Y + 10, 2, 2); } };
  const cloth = (X: number, Y: number) => { fill(0x5e3a26, X + 1, Y + 2, 2, 13); fill(0x5e3a26, X + 13, Y + 2, 2, 13); for (let k = 0; k < 4; k++) fill([0xe04848, 0x5aa0ea, 0xf2c94c, 0xc07aff][k], X + 3 + k * 3, Y + 4, 3, 9); };
  const cart = (X: number, Y: number) => { fill(0x5e3a26, X + 1, Y + 6, 14, 6); fill(0x2a2a30, X + 3, Y + 5, 10, 3); fill(0xf2c94c, X + 5, Y + 4, 3, 2); fill(0x3a2a1a, X + 3, Y + 12, 3, 3); fill(0x3a2a1a, X + 10, Y + 12, 3, 3); };
  const anvil = (X: number, Y: number) => { fill(0x4a4f60, X + 3, Y + 8, 10, 3); fill(0x7a7f90, X + 2, Y + 6, 12, 3); fill(0x4a4f60, X + 6, Y + 11, 4, 4); };
  const book = (X: number, Y: number) => { fill(0x8a2a2a, X + 3, Y + 9, 10, 3); fill(0x2a5a8a, X + 4, Y + 6, 9, 3); fill(0x3a7a3a, X + 3, Y + 3, 10, 3); };
  const hitch = (X: number, Y: number) => { fill(0x5e3a26, X + 2, Y + 6, 2, 9); fill(0x5e3a26, X + 12, Y + 6, 2, 9); fill(0x8a5a3a, X + 2, Y + 7, 12, 2); };
  const herb = (X: number, Y: number) => { fill(0x6a4a2a, X + 1, Y + 8, 14, 7); for (let k = 0; k < 5; k++) { fill(0x3aa04a, X + 2 + k * 3, Y + 4, 2, 6); fill(['#f06aa0', '#ffd060', '#c07aff'][k % 3], X + 2 + k * 3, Y + 3, 2, 2); } };
  const net = (X: number, Y: number) => { fill(0x7a6a4a, X + 1, Y + 5, 14, 8); for (let k = 0; k < 14; k += 3) fill(0x4a3a22, X + 1 + k, Y + 5, 1, 8); fill(0xe04848, X + 2, Y + 3, 3, 3); };
  const stand = (X: number, Y: number) => { fill(0x8c2030, X + 1, Y + 2, 2, 12); fill(0xf2c94c, X + 3, Y + 2, 8, 5); fill(0x6a4a2a, X + 1, Y + 13, 12, 2); };
  const forge: Record<string, () => void> = {
    fish: () => { place(8, rack); place(8, net); }, trade: () => { place(12, (X, Y) => sack(X, Y, r.pick([0xc8a050, 0xa05a2a, 0x8a8f9a]))); place(6, barrel); },
    wine: () => place(16, barrel, spotsNear('tavern')[0]), grain: () => place(16, hay), spice: () => place(14, (X, Y) => sack(X, Y, r.pick([0xe04848, 0xf2c94c, 0xe08030, 0x6cc05a]))),
    forge: () => { place(8, anvil, spotsNear('smithy')[0]); place(6, barrel); }, mine: () => { place(8, cart); place(5, anvil, spotsNear('smithy')[0]); },
    scholar: () => place(10, book, spotsNear('guild')[0]), magic: () => place(8, book, spotsNear('guild')[0]), herb: () => place(14, herb),
    pilgrim: () => place(8, stand, spotsNear('temple')[0]), arena: () => place(10, stand), horse: () => place(12, hitch), silk: () => place(10, cloth),
  };
  forge[id]?.();
  // a few barrels and crates anywhere, so no street is bare
  place(10, barrel);
  void x2;
}

// ---------------------------------------------------------------- the whole town
export function paintCity(d: CityData, town: Town) {
  const { theme, grid, buildings } = d;
  const cv = d.cv;
  cv.width = CW * T; cv.height = CH * T;
  const x2 = cv.getContext('2d')!;
  const r = new RNG(hashString('paint' + town.id));
  const p = makePen(x2, r);
  const { fill, circ, poly } = p;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= CW || y >= CH ? Tile.Void : grid[y * CW + x]);
  const { rx, ry } = d.extent;
  const cx = CW / 2, cy = CH / 2;

  // built-up ground: a soft wash of the town's own earth under everything, fading into the countryside
  const gr = x2.createRadialGradient(cx * T, cy * T, 0, cx * T, cy * T, rx * T * 1.2);
  gr.addColorStop(0, hex(theme.ground) + 'b8'); gr.addColorStop(0.7, hex(theme.ground) + '78'); gr.addColorStop(1, hex(theme.ground) + '00');
  x2.save(); x2.scale(1, ry / rx); x2.fillStyle = gr; x2.beginPath(); x2.arc(cx * T, (cy * T * rx) / ry, rx * T * 1.2, 0, Math.PI * 2); x2.fill(); x2.restore();
  x2.save(); x2.globalCompositeOperation = 'destination-out';
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (grid[y * CW + x] === Tile.Void) x2.fillRect(x * T, y * T, T, T);
  x2.restore();

  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const t = grid[y * CW + x];
    const X = x * T, Y = y * T;
    if (t === Tile.Void) continue;
    if (t === Tile.Ground) { if ((x * 31 + y * 17) % 5 === 0) fill(shadeC(theme.ground, r.float(0.8, 1.15)), X + r.int(0, 13), Y + r.int(0, 13), 2, 2); continue; }
    if (t === Tile.Road) {
      fill(theme.road, X, Y, T, T);
      if (theme.boardwalk) { for (let k = 0; k < T; k += 4) fill(shadeC(theme.road, 0.8), X, Y + k, T, 1); fill(shadeC(theme.road, 1.1), X + (x % 2) * 8, Y, 1, T); }
      else if (theme.cobble) { for (let k = 0; k < 5; k++) fill(theme.roadDot, X + r.int(0, 12), Y + r.int(0, 12), 4, 3); fill(shadeC(theme.road, 0.9), X, Y + 7, T, 1); }
      else for (let k = 0; k < 5; k++) fill(theme.roadDot, X + r.int(0, 13), Y + r.int(0, 13), 3, 2);
      if (at(x, y - 1) !== Tile.Road && at(x, y - 1) !== Tile.Plaza && at(x, y - 1) !== Tile.Dock) fill(shadeC(theme.road, 1.15), X, Y, T, 1);
      if (at(x, y + 1) !== Tile.Road && at(x, y + 1) !== Tile.Plaza && at(x, y + 1) !== Tile.Dock) fill(shadeC(theme.road, 0.82), X, Y + T - 1, T, 1);
    } else if (t === Tile.Plaza) {
      fill(theme.plaza, X, Y, T, T); fill(shadeC(theme.plaza, 0.9), X, Y, T, 1); fill(shadeC(theme.plaza, 0.9), X, Y, 1, T);
      if ((x + y) % 2 === 0) fill(shadeC(theme.plaza, 1.06), X + 1, Y + 1, T - 2, T - 2);
    } else if (t === Tile.Water) {
      fill(0x3f82b8, X, Y, T, T);
      if ((x + y) % 3 === 0) fill(0x6fb0d8, X + r.int(0, 8), Y + r.int(2, 12), 6, 1);
      for (const [dx, dy, ex, ey, w, h] of [[0, -1, 0, 0, T, 2], [0, 1, 0, T - 2, T, 2], [-1, 0, 0, 0, 2, T], [1, 0, T - 2, 0, 2, T]] as number[][]) if (at(x + dx, y + dy) !== Tile.Water && at(x + dx, y + dy) !== Tile.Dock) fill('rgba(230,248,250,0.7)', X + ex, Y + ey, w, h);
    } else if (t === Tile.Dock) {
      const over = at(x, y - 1) === Tile.Void || at(x, y + 1) === Tile.Void || at(x - 1, y) === Tile.Void || at(x + 1, y) === Tile.Void;
      if (over) fill('rgba(0,0,0,0.22)', X + 2, Y + 3, T, T);
      fill(theme.id === 'azgar' ? 0xf0eadc : 0x8a5a3a, X + 1, Y, T - 2, T);
      for (let k = 0; k < T; k += 4) fill(theme.id === 'azgar' ? 0xd0c8b4 : 0x6a4228, X + 1, Y + k, T - 2, 1);
    } else if (t === Tile.Wall) {
      if (theme.wall === 'palisade') { fill(0x5e3a26, X + 1, Y + 2, 3, 13); fill(0x6a4630, X + 6, Y + 1, 3, 14); fill(0x5e3a26, X + 11, Y + 3, 3, 12); poly(0x4a2c1c, [X + 1, Y + 2, X + 2.5, Y - 1, X + 4, Y + 2]); poly(0x4a2c1c, [X + 6, Y + 1, X + 7.5, Y - 2, X + 9, Y + 1]); poly(0x4a2c1c, [X + 11, Y + 3, X + 12.5, Y, X + 14, Y + 3]); }
      else if (theme.wall === 'hedge') { circ(0x2e7a3e, X + 8, Y + 8, 7); circ(0x4aa04e, X + 6, Y + 6, 4); circ(0x6acb6a, X + 11, Y + 9, 1.5); }
      else if (theme.wall === 'iron') { fill(0x4a4a52, X, Y, T, T); fill(0x2e2e34, X, Y + 6, T, 2); for (let k = 2; k < T; k += 5) fill(0x8a8a94, X + k, Y + 3, 1, 1); fill(0x34343a, X, Y + T - 2, T, 2); }
      else { fill(0x8a8478, X, Y, T, T); fill(0x6a645a, X, Y + 7, T, 2); fill(0x6a645a, X + 7, Y, 2, 7); fill(0x5a544a, X, Y + T - 2, T, 2); fill(0xa09a8c, X, Y, T, 2); }
    } else if (t === Tile.Field) {
      const c0 = theme.field[(x + (y >> 2)) % theme.field.length];
      fill(shadeC(c0, 0.72), X, Y, T, T);
      for (let k = 2; k < T; k += 5) fill(c0, X, Y + k, T, 2);
    } else if (t === Tile.Grave) {
      fill('rgba(0,0,0,0.12)', X, Y, T, T);
      if ((x + y) % 2 === 0) { fill(0x9aa0a8, X + 5, Y + 4, 6, 9); fill(0x7a8088, X + 5, Y + 11, 6, 2); fill(0x6a7078, X + 7, Y + 6, 2, 4); }
    } else if (t === Tile.Tree) tree(theme.tree, X, Y);
  }
  function tree(kind: TreeKind, X: number, Y: number) {
    fill('rgba(0,0,0,0.2)', X + 3, Y + 12, 11, 3);
    if (kind === 'cactus') { fill(0x4a8a3a, X + 6, Y + 2, 4, 12); fill(0x4a8a3a, X + 2, Y + 6, 4, 2); fill(0x4a8a3a, X + 10, Y + 4, 4, 2); }
    else if (kind === 'pine') { fill(0x2e5a3e, X + 4, Y + 2, 8, 10); fill(0xffffff, X + 4, Y + 2, 8, 2); fill(0x5e3a26, X + 7, Y + 12, 2, 3); }
    else if (kind === 'dead') { fill(0x3a2a22, X + 7, Y + 3, 2, 11); fill(0x3a2a22, X + 4, Y + 5, 3, 1); fill(0x3a2a22, X + 9, Y + 7, 3, 1); fill(0x3a2a22, X + 5, Y + 3, 2, 1); }
    else if (kind === 'palm') { fill(0x8a5a3a, X + 7, Y + 6, 2, 9); fill(0x2e8a3e, X + 2, Y + 2, 12, 4); fill(0x3eaa4e, X + 4, Y + 1, 8, 2); fill(0x2e8a3e, X + 6, Y, 4, 3); }
    else if (kind === 'jungle') { const L = theme.leaf; circ(shadeC(L[0], 0.7), X + 8, Y + 8, 8); circ(r.pick(L), X + 7, Y + 6, 6); circ(shadeC(r.pick(L), 1.4), X + 5, Y + 4, 2.5); fill(0x5e3a26, X + 7, Y + 12, 2, 4); }
    else { fill(0x5e3a26, X + 7, Y + 10, 2, 5); circ(0x2e7a3e, X + 8, Y + 7, 6); circ(0x4aa04e, X + 6, Y + 5, 3); }
  }

  // the square's landmark, then stalls
  const px = (d.plaza.x + d.plaza.w / 2) * T, py = (d.plaza.y + d.plaza.h / 2) * T;
  paintSquare(p, d, px, py);
  for (const gt of d.gates) gatehouse(p, d.theme, gt);
  const awnings = [0xe04848, 0x5aa0ea, 0xf2c94c, 0x6cc05a, theme.banner[0], theme.banner[1]];
  d.stalls.forEach((s, k) => {
    fill(0x8a5a3a, s.x + 2, s.y + 6, 2, 8); fill(0x8a5a3a, s.x + 18, s.y + 6, 2, 8);
    for (let j = 0; j < 22; j += 4) fill(j % 8 ? 0xffffff : awnings[k % awnings.length], s.x + j, s.y, 4, 6);
  });

  // buildings, back to front so a tall roof overlaps the street behind it. Each is painted on its own sprite so that a light pass
  // (sun from the upper left, shade lower right, a dark line where the walls meet the ground) can touch only the building.
  const spr = document.createElement('canvas'), shd = document.createElement('canvas');
  let sx2 = spr.getContext('2d')!;
  const PADX = 28, PADT = 70, PADB = 22;
  const DENSE = ['terrace', 'tower', 'boomtown', 'brick', 'spire', 'forge', 'keep', 'carved', 'adobe', 'hut', 'tent', 'tree', 'mushroom'];
  let lmDone = !d.landmark;
  for (const b0 of [...buildings].sort((a, c) => a.y + a.h - (c.y + c.h))) {
    if (!lmDone && d.landmark && (b0.y + b0.h) * T > d.landmark.y) { landmark(p, d, d.landmark.x, d.landmark.y); lmDone = true; }
    const GX = b0.x * T, GY = b0.y * T, Wd = b0.w * T, Ht = b0.h * T;
    const br = new RNG(b0.seed);
    const jr = new RNG(b0.seed ^ 0x7f4a);
    const b: BuildingRec = { ...b0, roof: shadeC(b0.roof, jr.float(0.92, 1.08)), wall: shadeC(b0.wall, jr.float(0.94, 1.06)) };
    const sw = Wd + 2 * PADX, sh = Ht + PADT + PADB;
    if (spr.width < sw || spr.height < sh) { spr.width = Math.max(spr.width, sw); spr.height = Math.max(spr.height, sh); sx2 = spr.getContext('2d')!; } else sx2.clearRect(0, 0, spr.width, spr.height);
    const bp = makePen(sx2, br);
    const X = PADX, Y = PADT;
    const sp = SPECIAL[b.kind];
    if (sp) sp(bp, b, theme, X, Y, Wd, Ht);
    else {
      const style = b.kind === 'palace' ? (theme.temple === 'tree' ? 'stone' : theme.temple) : b.kind === 'temple' ? theme.temple : b.style;
      (STYLES[style] || cottage)(bp, b, theme, X, Y, Wd, Ht);
      if (b.kind === 'palace') {
        for (const tx of [X - 4, X + Wd - 8]) { bp.fill(shadeC(b.wall, 0.9), tx, Y - 8, 12, Ht * 0.6); bp.poly(theme.banner[0], [tx - 1, Y - 8, tx + 6, Y - 18, tx + 13, Y - 8]); flag(bp, tx + 6, Y - 18, theme.banner[1], theme.banner[0]); }
        bp.fill(theme.banner[0], X + Wd / 2 - 9, Y + Ht - 22, 4, 14); bp.fill(theme.banner[1], X + Wd / 2 + 5, Y + Ht - 22, 4, 14);
      }
      if (b.kind === 'tavern') { bp.fill(0xb07a1e, X + Wd - 9, Y + Ht - 26, 8, 6); bp.fill(0xf2c94c, X + Wd - 8, Y + Ht - 25, 6, 4); bp.fill(0x5e3a26, X + Wd - 6, Y + Ht - 32, 2, 7); }
      if (b.kind === 'smithy') { bp.fill(0x4a4f60, X + 3, Y + Ht - 8, 9, 3); bp.fill(0xf08c3a, X + 5, Y + Ht - 10, 4, 2); }
      if (b.kind === 'guild') { bp.fill(theme.banner[0], X + 2, Y + Ht - 28, 4, 12); bp.fill(theme.banner[1], X + Wd - 6, Y + Ht - 28, 4, 12); }
    }
    // the light pass
    sx2.globalCompositeOperation = 'source-atop';
    const lg = sx2.createLinearGradient(X, Y, X + Wd, Y + Ht);
    lg.addColorStop(0, 'rgba(255,244,214,0.10)'); lg.addColorStop(0.55, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(10,12,44,0.2)');
    sx2.fillStyle = lg; sx2.fillRect(0, 0, sw, sh);
    const ao = sx2.createLinearGradient(0, Y + Ht - 7, 0, Y + Ht);
    ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,0.32)');
    sx2.fillStyle = ao; sx2.fillRect(X - 6, Y + Ht - 7, Wd + 12, 7);
    fateSprite(sx2, d.fate, X, Y, Wd, Ht, jr);
    sx2.globalCompositeOperation = 'source-over';
    // ground first (the path from the door), then the building on top of it
    const doorG = bp.doorX === undefined ? undefined : GX + bp.doorX - X;
    const plain = b.kind === 'house' && !DENSE.includes(b.style);
    if (b.kind === 'house' && !['tower', 'terrace', 'boomtown', 'brick'].includes(b.style)) doorPath(makePen(x2, br), at, GX, GY + Ht, doorG, theme);
    // a shadow in the shape of the building, thrown down and to the right
    shd.width = sw; shd.height = sh;
    const hx = shd.getContext('2d')!;
    hx.drawImage(spr, 0, 0, sw, sh, 0, 0, sw, sh);
    hx.globalCompositeOperation = 'source-in'; hx.fillStyle = 'rgba(8,10,30,0.5)'; hx.fillRect(0, 0, sw, sh);
    x2.globalAlpha = 0.34; x2.drawImage(shd, GX - PADX + 4, GY - PADT + 5); x2.globalAlpha = 0.2; x2.drawImage(shd, GX - PADX + 8, GY - PADT + 9); x2.globalAlpha = 1;
    x2.drawImage(spr, 0, 0, sw, sh, GX - PADX, GY - PADT, sw, sh);
    if (plain && br.chance(0.45)) fence(makePen(x2, br), at, GX, GY + Ht, Wd, doorG, theme);
    // life around the door: a garden plot, a barrel, firewood, a washing line, a bench, a handcart
    const extras = br.int(0, 3);
    for (let k = 0; k < extras; k++) {
      const left = br.chance(0.5), ex = left ? GX - 12 : GX + Wd + 2, ey = GY + Ht - 10 - br.int(0, 6);
      const tx = Math.floor((left ? GX - 12 : GX + Wd + 2) / T), ty = Math.floor(ey / T);
      if (at(tx, ty) !== Tile.Ground) continue;
      const kind = br.int(0, 5);
      if (kind === 0) { fill(0x6a4a2a, ex, ey, 11, 8); for (let q = 0; q < 4; q++) { fill(0x3aa04a, ex + 1 + q * 3, ey, 2, 4); fill([0xe04848, 0xf2c94c, 0xffffff, 0xc07aff][q], ex + 1 + q * 3, ey - 1, 2, 2); } }
      else if (kind === 1) { fill(0x8a5a3a, ex + 2, ey + 1, 7, 8); fill(0x5e3a26, ex + 2, ey + 4, 7, 1); }
      else if (kind === 2) { for (let q = 0; q < 3; q++) fill(0x9a6a3a, ex, ey + 6 - q * 2, 11, 2); fill(0x7a4a22, ex + 2, ey + 6, 2, 2); }
      else if (kind === 3) { fill(0x5e3a26, ex, ey - 6, 1, 14); fill(0x5e3a26, ex + 10, ey - 6, 1, 14); for (let q = 0; q < 4; q++) fill([0xe04848, 0x5aa0ea, 0xf2c94c, 0xffffff][q], ex + 1 + q * 2, ey - 5, 2, 6); }
      else if (kind === 4) { fill(0x6a4a2a, ex, ey + 3, 11, 2); fill(0x6a4a2a, ex + 1, ey + 5, 2, 3); fill(0x6a4a2a, ex + 8, ey + 5, 2, 3); }
      else { fill(0x5e3a26, ex, ey + 2, 11, 5); fill(0xd8b040, ex + 1, ey, 9, 3); circ(0x3a2a1a, ex + 2, ey + 8, 2); circ(0x3a2a1a, ex + 9, ey + 8, 2); }
    }
  }
  if (!lmDone && d.landmark) landmark(p, d, d.landmark.x, d.landmark.y);
  // street lamps and the town's flags along the main street
  for (const l of d.lamps) { fill(0x2a2a30, l.x - 1, l.y - 12, 2, 12); fill(0xffd070, l.x - 2, l.y - 15, 4, 4); }
  for (const [fx, fy] of [[d.plaza.x + 1, d.plaza.y], [d.plaza.x + d.plaza.w - 2, d.plaza.y]]) flag(p, fx * T + 8, fy * T + 12, theme.banner[0], theme.banner[1]);
  props(d, x2, fill, new RNG(hashString('props' + town.id)));
  paintFate(d, x2, new RNG(hashString('fate' + town.id)));
}


// ---------------------------------------------------------------- a land the story has reshaped (docs/world-events.md §15)
/** the look of each fate on one building's own sprite: ash on the roof, water at the walls, rust streaks, golden light, shutters in the fog */
function fateSprite(c: CanvasRenderingContext2D, fate: CityData['fate'], X: number, Y: number, W: number, H: number, r: RNG) {
  if (!fate) return;
  c.globalCompositeOperation = 'source-atop';
  const band = (y0: number, y1: number, c0: string, c1: string) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); c.fillStyle = g; c.fillRect(X - 30, y0, W + 60, y1 - y0); };
  if (fate === 'ash') band(Y - 40, Y + H * 0.55, 'rgba(238,238,244,0.82)', 'rgba(238,238,244,0)');
  else if (fate === 'flood') { band(Y + H - 22, Y + H + 2, 'rgba(70,130,196,0.1)', 'rgba(70,130,196,0.62)'); c.fillStyle = 'rgba(210,236,250,0.6)'; for (let k = 0; k < W; k += 6) c.fillRect(X + k, Y + H - 22 + (k % 12 ? 0 : 2), 4, 1); }
  else if (fate === 'rust') { for (let k = 0; k < Math.max(3, W / 14); k++) { const x = X + r.int(0, W - 3); c.fillStyle = 'rgba(160,70,24,0.45)'; c.fillRect(x, Y + r.int(0, H / 2), 2, r.int(10, H / 2)); } }
  else if (fate === 'light') { band(Y - 40, Y + H, 'rgba(255,244,180,0.34)', 'rgba(255,236,150,0.06)'); }
  else if (fate === 'fog') { band(Y - 40, Y + H, 'rgba(90,70,130,0.34)', 'rgba(40,30,70,0.5)'); }
  else if (fate === 'withered') band(Y - 40, Y + H, 'rgba(190,150,40,0.22)', 'rgba(120,90,20,0.2)');
}

/** whole-town effects drawn over everything: the colour grade, cracks, ruins, ash on the ground, water in the streets, golden motes */
function paintFate(d: CityData, x2: CanvasRenderingContext2D, r: RNG) {
  const fate = d.fate;
  if (!fate) return;
  const { buildings, grid } = d;
  const info = FATES[fate];
  x2.save(); x2.globalCompositeOperation = 'source-atop'; x2.fillStyle = info.tint; x2.fillRect(0, 0, CW * T, CH * T); x2.restore();
  const cx = (CW * T) / 2, cy = (CH * T) / 2, rx = d.extent.rx * T, ry = d.extent.ry * T;
  const inTown = (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  const speck = (c: string, n: number, w: number, h: number, only?: Tile[]) => {
    x2.fillStyle = c;
    for (let k = 0; k < n; k++) { const x = r.int(0, CW * T - 1), y = r.int(0, CH * T - 1); if (!inTown(x, y)) continue; const t = grid[Math.floor(y / T) * CW + Math.floor(x / T)]; if (t === Tile.Void || t === Tile.Building || (only && !only.includes(t))) continue; x2.fillRect(x, y, w, h); }
  };
  const crack = (x: number, y: number, len: number) => {
    let a = r.float(0, 6.28); x2.beginPath(); x2.moveTo(x, y);
    for (let s = 0; s < len; s++) { a += r.float(-0.7, 0.7); x += Math.cos(a) * 6; y += Math.sin(a) * 4; x2.lineTo(x, y); }
    x2.strokeStyle = 'rgba(14,10,8,0.8)'; x2.lineWidth = 2.2; x2.stroke(); x2.strokeStyle = 'rgba(0,0,0,0.25)'; x2.lineWidth = 5; x2.stroke();
  };
  const ruin = (b: BuildingRec, fire: boolean) => {
    const X = b.x * T, Y = b.y * T, W = b.w * T, H = b.h * T, hx = X + r.int(Math.round(W * 0.25), Math.round(W * 0.75));
    x2.fillStyle = 'rgba(22,16,12,0.82)'; x2.beginPath(); x2.moveTo(hx - 14, Y + H * 0.32); x2.lineTo(hx - 5, Y + H * 0.1); x2.lineTo(hx + 1, Y + H * 0.3); x2.lineTo(hx + 9, Y + H * 0.14); x2.lineTo(hx + 17, Y + H * 0.42); x2.lineTo(hx + 6, Y + H * 0.58); x2.lineTo(hx - 11, Y + H * 0.5); x2.closePath(); x2.fill();
    x2.strokeStyle = '#6a4a2a'; x2.lineWidth = 2; for (let k = 0; k < 3; k++) { x2.beginPath(); x2.moveTo(hx - 12 + k * 10, Y + H * 0.2 + k * 4); x2.lineTo(hx - 6 + k * 9 + r.int(-5, 5), Y + H * 0.58); x2.stroke(); }
    x2.fillStyle = 'rgba(0,0,0,0.28)'; x2.beginPath(); x2.ellipse(X + W / 2, Y + H * 0.6, W * 0.3, H * 0.18, 0, 0, 6.3); x2.fill();
    for (let k = 0; k < 14; k++) { x2.fillStyle = ['#6a645c', '#8a8478', '#4a4238', '#a09a8c'][k % 4]; x2.fillRect(X - 6 + r.int(0, W + 8), Y + H - 4 + r.int(0, 10), r.int(2, 6), r.int(2, 4)); }
    if (fire) { x2.fillStyle = 'rgba(255,150,40,0.85)'; x2.fillRect(hx - 2, Y + H * 0.3, 4, 6); x2.fillStyle = 'rgba(255,220,120,0.9)'; x2.fillRect(hx - 1, Y + H * 0.33, 2, 3); x2.fillStyle = 'rgba(60,56,54,0.4)'; x2.beginPath(); x2.arc(hx + 2, Y + H * 0.1, 6, 0, 6.3); x2.fill(); x2.beginPath(); x2.arc(hx + 5, Y - 6, 8, 0, 6.3); x2.fill(); }
  };
  // the monument in the square suffers with its town: toppled and cratered, buried in ash, or standing in water
  const mx = d.landmark ? d.landmark.x : -999, my = d.landmark ? d.landmark.y : -999;
  if (!d.landmark) { /* a town without a monument has nothing in the square to ruin */ }
  else if (fate === 'skyfall' || fate === 'fallen' || fate === 'split') {
    x2.fillStyle = 'rgba(26,20,16,0.82)'; x2.beginPath(); x2.ellipse(mx, my + 2, 46, 17, 0, 0, 6.3); x2.fill();
    x2.fillStyle = 'rgba(70,60,52,0.9)'; x2.beginPath(); x2.ellipse(mx, my, 36, 12, 0, 0, 6.3); x2.fill();
    for (let k = 0; k < 16; k++) { const a = r.float(0, 6.28), rr = r.float(8, 40); x2.fillStyle = ['#8a8478', '#6a645a', '#a09a8c', '#4a4238'][k % 4]; const w = r.int(5, 14), h = r.int(4, 10); x2.save(); x2.translate(mx + Math.cos(a) * rr, my + Math.sin(a) * rr * 0.4); x2.rotate(r.float(-0.5, 0.5)); x2.fillRect(-w / 2, -h / 2, w, h); x2.restore(); }
    x2.fillStyle = '#9a9484'; x2.save(); x2.translate(mx + 6, my - 4); x2.rotate(0.9); x2.fillRect(-4, -26, 8, 28); x2.restore(); x2.fillStyle = '#7a7468'; x2.fillRect(mx - 18, my - 10, 7, 12);
  } else if (fate === 'ash') {
    x2.fillStyle = 'rgba(238,238,244,0.8)'; x2.beginPath(); x2.ellipse(mx, my - 6, 44, 24, 0, 0, 6.3); x2.fill();
  } else if (fate === 'flood') {
    x2.fillStyle = 'rgba(64,126,196,0.6)'; x2.beginPath(); x2.ellipse(mx, my + 4, 80, 34, 0, 0, 6.3); x2.fill(); x2.fillStyle = 'rgba(214,238,252,0.7)'; for (let k = -3; k <= 3; k++) x2.fillRect(mx + k * 18 - 6, my + 8 + (k % 2) * 6, 12, 1);
  }
  switch (fate) {
    case 'skyfall': case 'split': case 'fallen': {
      for (let k = 0; k < (fate === 'split' ? 7 : 22); k++) crack(cx + r.float(-rx, rx) * 0.9, cy + r.float(-ry, ry) * 0.9, r.int(14, 40));
      for (const b of buildings) if (r.chance(fate === 'fallen' ? 0.75 : fate === 'skyfall' ? 0.6 : 0.35)) ruin(b, fate === 'fallen' && r.chance(0.4));
      speck('rgba(110,104,96,0.55)', 900, 3, 2);
      break;
    }
    case 'ash': speck('rgba(236,236,242,0.6)', 2400, 2, 1, [Tile.Ground, Tile.Road, Tile.Plaza, Tile.Tree]); speck('rgba(70,66,70,0.4)', 500, 2, 2, [Tile.Ground, Tile.Road]); break;
    case 'flood': {
      for (let k = 0; k < 260; k++) { const x = r.int(0, CW * T - 1), y = r.int(0, CH * T - 1); if (!inTown(x, y)) continue; const t = grid[Math.floor(y / T) * CW + Math.floor(x / T)]; if (t === Tile.Void || t === Tile.Building) continue; x2.fillStyle = 'rgba(64,126,196,0.55)'; x2.beginPath(); x2.ellipse(x, y, r.int(12, 34), r.int(5, 12), 0, 0, 6.3); x2.fill(); x2.fillStyle = 'rgba(214,238,252,0.65)'; x2.fillRect(x - 8, y - 1, 8, 1); }
      for (let k = 0; k < 10; k++) { const x = cx + r.float(-rx, rx) * 0.8, y = cy + r.float(-ry, ry) * 0.8; x2.fillStyle = '#6a4a2a'; x2.beginPath(); x2.moveTo(x - 12, y); x2.lineTo(x + 12, y); x2.lineTo(x + 8, y + 5); x2.lineTo(x - 8, y + 5); x2.fill(); x2.fillStyle = '#e8e0d0'; x2.fillRect(x - 1, y - 12, 1, 12); x2.fillRect(x, y - 12, 8, 7); }
      break;
    }
    case 'withered': speck('rgba(190,150,40,0.55)', 900, 3, 2, [Tile.Ground]); speck('rgba(120,86,30,0.45)', 500, 2, 2, [Tile.Ground, Tile.Road]); break;
    case 'rust': speck('rgba(150,70,30,0.5)', 700, 3, 2, [Tile.Ground, Tile.Road]); speck('rgba(40,30,26,0.4)', 300, 4, 2, [Tile.Road, Tile.Plaza]); break;
    case 'light': {
      for (const b of buildings) { if (!r.chance(0.7)) continue; const gx = (b.x + b.w / 2) * T, gy = (b.y + b.h) * T; const g = x2.createRadialGradient(gx, gy - 14, 0, gx, gy - 14, 40); g.addColorStop(0, 'rgba(255,240,170,0.5)'); g.addColorStop(1, 'rgba(255,240,170,0)'); x2.fillStyle = g; x2.fillRect(gx - 40, gy - 54, 80, 80); }
      speck('rgba(255,246,190,0.9)', 500, 2, 2);
      break;
    }
    case 'fog': speck('rgba(40,30,60,0.4)', 1200, 4, 3); break;
  }
}


/** where a street goes through the wall: a tower on the wall tile at each side */
function gatehouse(p: Pen, th: Theme, g: { ax: number; ay: number; bx: number; by: number }) {
  const stone = th.wall === 'palisade' ? 0x6a4a2a : th.wall === 'iron' ? 0x4a4a52 : th.wall === 'hedge' ? 0x4a7a3a : 0x8a8478;
  const tw = (tx: number, ty: number) => {
    const cx = tx * T + T / 2, base = ty * T + T;
    p.ell('rgba(0,0,0,0.25)', cx + 4, base + 2, 11, 4);
    p.fill(stone, cx - 8, base - 28, 16, 28); p.fill(shadeC(stone, 1.2), cx - 8, base - 28, 4, 28); p.fill(shadeC(stone, 0.72), cx + 4, base - 28, 4, 28);
    for (let j = 8; j < 26; j += 8) p.fill(shadeC(stone, 0.75), cx - 8, base - 28 + j, 16, 1);
    p.fill(0x14101a, cx - 1, base - 18, 3, 7);
    p.fill(shadeC(stone, 1.1), cx - 10, base - 31, 20, 4); for (let i = 0; i < 18; i += 6) p.fill(shadeC(stone, 1.25), cx - 10 + i, base - 36, 4, 5);
    if (th.wall !== 'hedge') { p.poly(th.banner[0], [cx - 10, base - 31, cx, base - 46, cx + 10, base - 31]); p.fill(0x4a3a22, cx, base - 56, 1, 12); p.poly(th.banner[1], [cx + 1, base - 56, cx + 8, base - 53, cx + 1, base - 50]); }
  };
  tw(g.ax, g.ay); tw(g.bx, g.by);
}
