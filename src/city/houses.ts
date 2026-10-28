// The painters that give towns their variety of homes: farmhouses with real roof materials and several silhouettes (side or front gable,
// wings, porches, two storeys), stepped-gable townhouses, adobe blocks, homes cut into rock. Also the bits of a plot around a house:
// the flagstone path from its door and the low fence along the street.
import { RNG } from '../sim/rng';
import { T, Tile, type BuildingRec } from './citygen';
import type { Theme } from './themes';
import { type Pen, shadeC, mixC, windowAt, doorAt, chimney, stoneWall, planks, bricks, slates, shingles, eaves } from './draw';

export type Paint = (p: Pen, b: BuildingRec, th: Theme, X: number, Y: number, W: number, H: number) => void;

// ---------------------------------------------------------------- roofs: the material decides the texture, the country tints it
type Mat = 'shingle' | 'tile' | 'slate' | 'thatch';
const NATURAL: Record<Mat, number> = { shingle: 0x7a5a3e, tile: 0xb4583a, slate: 0x5a6270, thatch: 0xb89a58 };
const MATS: Record<string, [Mat, number][]> = {
  azgar: [['slate', 3], ['tile', 3]], morhaven: [['thatch', 4], ['shingle', 3]], kazdurum: [['slate', 5]], nerea: [['tile', 4], ['shingle', 2], ['thatch', 1]],
  aldria: [['thatch', 3], ['tile', 4], ['shingle', 3], ['slate', 2]], mecharia: [['slate', 4], ['tile', 2]], saharan: [['tile', 4]], silvanel: [['thatch', 3], ['shingle', 3]], nebulia: [['slate', 4], ['shingle', 3]],
};
function roofMat(th: Theme, seed: number): Mat {
  const list = MATS[th.id] || MATS.aldria;
  return new RNG(seed ^ 0x51ed).weighted(list, (m) => m[1])![0];
}
/** the roof as the material really looks, tinted toward the country's own roof colour */
const roofCol = (b: BuildingRec, mat: Mat) => mixC(NATURAL[mat], b.roof, mat === 'thatch' ? 0.3 : 0.5);

function tileRoof(p: Pen, x: number, y: number, w: number, h: number, c: number) {
  p.fill(c, x, y, w, h);
  for (let j = 0, row = 0; j < h; j += 4, row++) {
    p.fill(shadeC(c, 0.68), x, y + j + 3, w, 1);
    for (let i = (row % 2) * 3; i < w; i += 6) { p.fill(shadeC(c, 0.84), x + i, y + j, 1, 3); p.fill(shadeC(c, 1.14), x + i + 1, y + j, 3, 1); }
  }
  p.fill(shadeC(c, 1.25), x, y, w, 2);
}
function thatchRoof(p: Pen, x: number, y: number, w: number, h: number, c: number) {
  p.fill(c, x, y, w, h);
  for (let i = 0; i < w; i += 2) p.fill(shadeC(c, 0.8 + ((i * 7) % 5) * 0.07), x + i, y, 1, h);
  for (let j = 5; j < h; j += 6) p.fill(shadeC(c, 0.72), x, y + j, w, 1);
  for (let i = 0; i < w; i += 3) p.fill(shadeC(c, 0.78 + (i % 2) * 0.2), x + i, y + h, 2, 2 + (i % 4 === 0 ? 1 : 0)); // shaggy eaves
  p.fill(shadeC(c, 1.2), x, y, w, 2);
}
function roofFill(p: Pen, mat: Mat, x: number, y: number, w: number, h: number, c: number) {
  (mat === 'tile' ? tileRoof : mat === 'slate' ? slates : mat === 'thatch' ? thatchRoof : shingles)(p, x, y, w, h, c);
}
function clipped(p: Pen, pts: number[], draw: () => void) {
  p.x2.save(); p.x2.beginPath(); p.x2.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.x2.lineTo(pts[i], pts[i + 1]); p.x2.closePath(); p.x2.clip(); draw(); p.x2.restore();
}
/** age on a wall or roof: streaks of dirt and a little moss */
function weather(p: Pen, x: number, y: number, w: number, h: number, moss: boolean) {
  const r = p.r;
  for (let k = 0; k < Math.round((w * h) / 220); k++) p.fill(`rgba(24,18,10,${(0.07 + r.next() * 0.08).toFixed(2)})`, x + r.int(0, Math.max(0, w - 4)), y + r.int(0, Math.max(0, h - 2)), r.int(2, 5), 1);
  if (moss) for (let k = 0; k < 4; k++) p.fill('rgba(70,120,50,0.32)', x + r.int(0, Math.max(0, w - 6)), y + r.int(0, Math.max(0, h - 3)), r.int(3, 7), 2);
}
const glassOf = (th: Theme) => (th.id === 'nebulia' ? 0x9ab0c8 : th.id === 'kazdurum' ? 0xffb050 : 0x8ec8e8);

// ---------------------------------------------------------------- the farmhouse: five roofs, side or front gable, wings, porches, two storeys
function house(p: Pen, b: BuildingRec, th: Theme, X: number, Y: number, W: number, H: number, level: number) {
  const r = p.r, mat = roofMat(th, b.seed), roof = roofCol(b, mat);
  const front = W < 58 ? r.chance(0.6) : r.chance(0.3);
  if (level === 0 && !front && W >= 66 && r.chance(0.55)) {
    // a wing behind the main block: lower, set back, its own roof
    const mw = Math.round(W * 0.64), top = Math.round(H * 0.26);
    house(p, { ...b, seed: b.seed + 17, roof: shadeC(b.roof, 0.94) }, th, X + mw - 6, Y + top, W - mw + 6, H - top, 1);
    W = mw;
  }
  const tall = H >= 72 && !front;
  const F = Math.min(tall ? 38 : 32, Math.round(H * (front ? 0.5 : 0.46)) + (tall ? 4 : 0)), RH = H - F;
  const timber = shadeC(0x6a4a2a, r.float(0.85, 1.15));
  const kind = r.int(0, 3); // 0 half-timbered, 1 plastered, 2 boards, 3 stone base with plaster
  const wallDraw = (x: number, y: number, w: number, h: number) => {
    if (kind === 2) planks(p, x, y, w, h, shadeC(b.wall, 0.86));
    else if (kind === 3) { p.fill(b.wall, x, y, w, h); stoneWall(p, x, y + h - 9, w, 9, shadeC(0xa09a8c, r.float(0.9, 1.05)), r); }
    else p.fill(b.wall, x, y, w, h);
    if (kind === 0) {
      for (let i = 1; i < w - 1; i += 12) p.fill(timber, x + i, y, 2, h - 3);
      p.fill(timber, x, y + 1, w, 2); p.fill(timber, x, y + Math.round(h * 0.5), w, 2);
      for (let i = 1; i + 12 < w; i += 12) { p.line(timber, x + i + 1, y + Math.round(h * 0.5), x + i + 11, y + 3, 1); }
    }
    p.fill(shadeC(b.wall, 0.8), x, y + h - 3, w, 3); // plinth
    p.fill('rgba(255,248,224,0.18)', x, y, 2, h); p.fill('rgba(0,0,40,0.14)', x + w - 3, y, 3, h); // light from the left
  };
  wallDraw(X + 1, Y + RH, W - 2, F);
  // openings
  const rows = F >= 32 ? 2 : 1, n = Math.max(1, Math.floor((W - 16) / 20)), door = r.int(0, n);
  const shut = r.chance(0.7) ? mixC(th.banner[0], 0x806040, 0.55) : undefined;
  for (let k = 0; k <= n; k++) {
    const cx = X + 8 + (k * (W - 16)) / Math.max(1, n);
    for (let row = 0; row < rows; row++) {
      const lower = row === rows - 1;
      const wy = lower ? Y + H - 17 - (rows === 2 ? 0 : 3) : Y + RH + 5;
      if (lower && k === door) doorAt(p, Math.round(cx - 4), Y + H - 15, 8, 15, shadeC(0x7a5030, r.float(0.8, 1.2)));
      else windowAt(p, Math.round(cx - 3), rows === 2 ? (lower ? Y + RH + F - 21 : Y + RH + 5) : Y + RH + 7, 7, 8, glassOf(th), timber, shut, r.chance(0.4), b.seed % 5 === 0);
      void wy;
    }
  }
  // the roof
  if (front) {
    const mid = X + W / 2;
    p.poly(shadeC(roof, 0.72), [X - 2, Y + RH + 3, mid, Y - 5, X + W + 3, Y + RH + 3]);
    clipped(p, [X - 3, Y + RH + 3, mid, Y - 4, X + W + 3, Y + RH + 3], () => roofFill(p, mat, X - 3, Y - 4, W + 6, RH + 8, roof));
    p.poly(b.wall, [X + 5, Y + RH + 3, mid, Y + 9, X + W - 5, Y + RH + 3]); // the gable end
    p.poly(shadeC(b.wall, 0.86), [mid, Y + 9, X + W - 5, Y + RH + 3, mid, Y + RH + 3]);
    p.line(timber, X + 5, Y + RH + 2, mid, Y + 9, 2); p.line(timber, X + W - 5, Y + RH + 2, mid, Y + 9, 2);
    p.circ(timber, mid, Y + RH - 3, 4.5); p.circ(glassOf(th), mid, Y + RH - 3, 3); p.fill(timber, mid - 3, Y + RH - 3, 7, 1);
    p.fill(shadeC(roof, 1.3), mid - 1, Y - 5, 2, 3);
    eaves(p, X - 2, Y + RH + 3, W + 5);
  } else {
    const pts = [X - 3, Y + RH + 3, X + 7, Y + 1, X + W - 7, Y + 1, X + W + 3, Y + RH + 3];
    clipped(p, pts, () => roofFill(p, mat, X - 3, Y + 1, W + 6, RH + 3, roof));
    p.poly('rgba(0,0,0,0.16)', [X + W + 3, Y + RH + 3, X + W - 7, Y + 1, X + W - 18, Y + 1, X + W - 6, Y + RH + 3]); // the hip end in shade
    p.poly('rgba(255,255,255,0.10)', [X - 3, Y + RH + 3, X + 7, Y + 1, X + 17, Y + 1, X + 5, Y + RH + 3]);
    p.line(shadeC(roof, 0.6), X - 3, Y + RH + 3, X + 7, Y + 1, 1); p.line(shadeC(roof, 0.6), X + W + 3, Y + RH + 3, X + W - 7, Y + 1, 1);
    p.fill(shadeC(roof, mat === 'thatch' ? 1.1 : 1.35), X + 7, Y, W - 14, 2); // ridge
    eaves(p, X - 3, Y + RH + 3, W + 6);
    if (W > 44 && r.chance(0.7)) chimney(p, X + r.int(8, W - 20), Y - 6, shadeC(0x8a847a, r.float(0.85, 1.1)));
    if (W > 60 && r.chance(0.5)) { // dormer
      const dx = X + r.int(14, W - 34);
      p.poly(shadeC(roof, 1.08), [dx - 1, Y + RH - 2, dx + 8, Y + 7, dx + 17, Y + RH - 2]); p.fill(b.wall, dx + 2, Y + RH - 12, 12, 9);
      windowAt(p, dx + 5, Y + RH - 10, 6, 6, glassOf(th), timber);
    }
  }
  weather(p, X, Y + 2, W, RH, mat === 'thatch' || r.chance(0.3));
  // a porch over the door
  if (level === 0 && W >= 44 && r.chance(0.4) && p.doorX !== undefined) {
    const dx = Math.round(p.doorX);
    p.fill('rgba(0,0,0,0.2)', dx - 8, Y + H - 4, 18, 4);
    p.fill(0x5e3a26, dx - 9, Y + H - 17, 2, 17); p.fill(0x5e3a26, dx + 8, Y + H - 17, 2, 17);
    p.poly(shadeC(roof, 0.9), [dx - 12, Y + H - 17, dx - 8, Y + H - 23, dx + 9, Y + H - 23, dx + 13, Y + H - 17]); p.fill('rgba(0,0,0,0.3)', dx - 12, Y + H - 17, 25, 2);
  }
}
export const farmhouse: Paint = (p, b, th, X, Y, W, H) => house(p, b, th, X, Y, W, H, 0);

// ---------------------------------------------------------------- a row of stepped-gable townhouses, each its own colour and trade
export const terrace: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, units = Math.max(2, Math.min(4, Math.round(W / 26))), uw = W / units;
  const tints = [b.wall, mixC(b.wall, 0xc87a50, 0.5), mixC(b.wall, 0x7a9ab0, 0.42), mixC(b.wall, 0xd8b860, 0.5), mixC(b.wall, 0x9a5a50, 0.45), mixC(b.wall, 0x7aa07a, 0.4)];
  const roof = roofCol(b, roofMat(th, b.seed));
  void roof;
  let prevTop = H;
  for (let u = 0; u < units; u++) {
    const x0 = Math.round(X + u * uw), w = Math.round(X + (u + 1) * uw) - x0 - 1;
    const wall = tints[(b.seed + u * 2 + (u >> 1)) % tints.length];
    const wallH = Math.min(H - 14, 22 + r.int(0, 2) * 12), top = Y + H - wallH;
    const brick = r.chance(0.4);
    if (brick) bricks(p, x0, top, w, wallH, mixC(wall, 0xb4543a, 0.6)); else { p.fill(wall, x0, top, w, wallH); p.fill('rgba(255,248,224,0.18)', x0, top, 2, wallH); }
    p.fill('rgba(0,0,40,0.16)', x0 + w - 2, top, 2, wallH);
    // stepped gable: three courses narrowing toward a finial
    const cap = shadeC(wall, 1.2);
    for (let s = 0; s < 3; s++) { const gx = x0 + s * 3, gw = w - s * 6; if (gw <= 4) break; p.fill(brick ? mixC(wall, 0xb4543a, 0.6) : wall, gx, top - (s + 1) * 4, gw, 4); p.fill(cap, gx - 1, top - (s + 1) * 4, gw + 2, 1); }
    p.circ(cap, x0 + w / 2, top - 15, 1.8); p.fill(cap, x0 + w / 2, top - 15, 1, 4);
    prevTop = Math.min(prevTop, H - wallH);
    // windows in rows, with shutters or flower boxes; a shopfront below
    const cols = Math.max(1, Math.floor((w - 4) / 11)), gap = (w - 2) / cols;
    const rowsUp = Math.max(1, Math.floor((wallH - 18) / 12));
    for (let j = 0; j < rowsUp; j++) for (let c = 0; c < cols; c++) windowAt(p, Math.round(x0 + 1 + gap * c + gap / 2 - 3), top + 4 + j * 12, 6, 8, 0x8ec8e8, 0xf4efe0, undefined, r.chance(0.25), r.chance(0.12));
    const gy = Y + H - 16;
    p.fill(shadeC(wall, 0.7), x0, gy - 2, w, 2);
    if (r.chance(0.55)) { // shop: big window, door, striped awning
      windowAt(p, x0 + 3, gy + 3, Math.max(5, Math.floor(w * 0.45)), 8, 0xffe6a0, 0x4a3a2a);
      doorAt(p, x0 + w - 9, Y + H - 14, 6, 14, shadeC(0x6a4a2a, r.float(0.8, 1.2)), false, true);
      const aw = [0xe04848, 0x5aa0ea, 0xf2c94c, 0x6cc05a, th.banner[0]][r.int(0, 4)];
      for (let s = 0; s < w; s += 4) p.fill(s % 8 ? 0xffffff : aw, x0 + s, gy - 1, 4, 4);
      p.fill('rgba(0,0,0,0.25)', x0, gy + 3, w, 2);
    } else { doorAt(p, x0 + Math.round(w / 2) - 3, Y + H - 14, 6, 14, shadeC(0x5a3a22, r.float(0.8, 1.2)), true); windowAt(p, x0 + 2, gy + 3, 5, 6, 0x8ec8e8, 0xf4efe0); }
    p.fill('rgba(0,0,0,0.22)', x0 + w, top, 1, wallH);
    if (r.chance(0.4)) { p.fill(0x5e3a26, x0 + w / 2, top - 22, 1, 6); p.fill(0x5e3a26, x0 + w / 2, top - 22, 5, 1); } // hoist beam
  }
  void prevTop;
  weather(p, X, Y + 10, W, H - 10, false);
};

// ---------------------------------------------------------------- adobe: stacked mud-brick blocks, beam ends, awnings, a ladder to the roof
export const adobe: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, wall = b.wall, lowH = Math.round(H * 0.56), upH = Math.round(H * 0.3), ly = Y + H - lowH;
  const block = (x: number, y: number, w: number, h: number, c: number) => {
    p.fill(c, x, y + 2, w, h - 2); p.ell(c, x + 3, y + 3, 3, 2); p.ell(c, x + w - 3, y + 3, 3, 2); p.fill(c, x + 2, y, w - 4, 3);
    p.fill(shadeC(c, 1.14), x + 1, y, w - 2, 2); p.fill('rgba(255,244,214,0.16)', x, y + 2, 2, h - 2); p.fill('rgba(70,40,10,0.2)', x + w - Math.max(4, Math.round(w * 0.14)), y + 2, Math.max(4, Math.round(w * 0.14)), h - 2);
    for (let i = 0; i < Math.round(w / 9); i++) p.fill(shadeC(c, r.float(0.88, 0.96)), x + r.int(2, w - 6), y + r.int(4, h - 4), r.int(3, 6), 1); // plaster cracks
  };
  // an upper room on part of the roof
  const ux = X + r.int(3, Math.max(4, Math.round(W * 0.3))), uw = Math.round(W * (r.chance(0.5) ? 0.5 : 0.38));
  if (r.chance(0.8)) block(ux, ly - upH + 2, uw, upH, shadeC(wall, 1.04));
  block(X + 1, ly, W - 2, lowH, wall);
  // beam ends poking through the parapet
  for (let i = 5; i < W - 6; i += 9) p.fill(0x5a3a22, X + i, ly + 4, 4, 2);
  p.fill(0x5a3a22, X - 1, ly + 6, 3, 2); p.fill(0x5a3a22, X + W - 2, ly + 6, 3, 2);
  // door framed in turquoise or terracotta, small deep windows
  const frame = [0x3a9aa8, 0xb4583a, 0x4a6ab0, 0x8a3a3a][b.seed % 4];
  const n = Math.max(1, Math.floor((W - 12) / 20)), door = r.int(0, n);
  for (let k = 0; k <= n; k++) {
    const cx = X + 8 + (k * (W - 16)) / Math.max(1, n);
    if (k === door) { p.fill(frame, cx - 5, Y + H - 17, 10, 17); p.ell(frame, cx, Y + H - 17, 5, 3); p.fill(0x4a2e1a, cx - 3, Y + H - 15, 6, 15); p.ell(0x4a2e1a, cx, Y + H - 15, 3, 3); p.doorX = cx; }
    else { p.fill(frame, cx - 4, ly + 9, 8, 10); p.fill(0x2a2018, cx - 3, ly + 10, 6, 8); p.ell(0x2a2018, cx, ly + 10, 3, 2); }
  }
  // cloth awning over the door, a ladder, pots and hanging peppers on the roof
  const aw = [0xe04848, 0xf2c94c, 0x5aa0ea, 0xf0e8d0][r.int(0, 3)];
  if (p.doorX !== undefined && r.chance(0.7)) { const dx = Math.round(p.doorX); for (let s = -9; s < 9; s += 3) p.fill(((s + 9) / 3) % 2 ? 0xffffff : aw, dx + s, Y + H - 23, 3, 6); p.fill('rgba(0,0,0,0.22)', dx - 9, Y + H - 17, 18, 2); }
  if (r.chance(0.6)) { const lx = X + W - 10; p.line(0x6a4a2a, lx, ly + 2, lx + 3, Y + H - 2, 1); p.line(0x6a4a2a, lx + 4, ly + 2, lx + 7, Y + H - 2, 1); for (let q = 6; q < lowH - 4; q += 6) p.fill(0x6a4a2a, lx + 1, ly + q, 6, 1); }
  for (let k = 0; k < r.int(1, 3); k++) { const px = X + r.int(6, W - 10); p.ell(0xb4583a, px, ly - 1, 3, 3); p.fill(0x8a3a22, px - 3, ly - 3, 6, 1); }
  if (r.chance(0.4)) for (let q = 0; q < 4; q++) p.fill(0xc02a1a, X + 6 + q * 2, ly + 14 + (q % 2) * 2, 1, 4);
  weather(p, X, ly, W, lowH, false);
};

// ---------------------------------------------------------------- carved: a home cut into the rock face, iron-banded door, glowing vents, a chimney of steam
export const carved: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, rock = shadeC(mixC(b.wall, 0x8a8278, 0.55), 0.8), top = Y + Math.round(H * 0.12);
  const pts: number[] = [X, Y + H];
  const steps = Math.max(4, Math.round(W / 9));
  for (let i = 0; i <= steps; i++) pts.push(X + (W * i) / steps, top + r.int(0, 8) + Math.round(Math.sin((i / steps) * Math.PI) * -4));
  pts.push(X + W, Y + H);
  p.poly(shadeC(rock, 0.8), pts.map((v, i) => (i % 2 ? v + 3 : v + 3)));
  p.poly(rock, pts);
  clipped(p, pts, () => {
    p.fill(shadeC(rock, 1.25), X, top, Math.round(W * 0.28), H); p.fill(shadeC(rock, 0.72), X + Math.round(W * 0.7), top, Math.round(W * 0.3), H);
    for (let k = 0; k < 8; k++) p.line(shadeC(rock, 0.55), X + r.int(2, W - 3), top + r.int(0, 14), X + r.int(2, W - 3), top + r.int(16, H - 6), 1);
  });
  // the dressed-stone front around the door
  const fw = Math.max(26, Math.round(W * 0.6)), fx = X + Math.round((W - fw) / 2), fy = Y + Math.round(H * 0.38);
  stoneWall(p, fx, fy, fw, Y + H - fy, shadeC(b.wall, 0.95), r);
  p.fill(shadeC(b.wall, 1.2), fx - 1, fy - 2, fw + 2, 3); p.fill('rgba(0,0,0,0.25)', fx, fy + 1, fw, 2);
  const dx = fx + Math.round(fw / 2) + r.int(-3, 3);
  p.fill(0x2a2220, dx - 7, Y + H - 21, 14, 21); p.ell(0x2a2220, dx, Y + H - 21, 7, 5); p.fill(0x5a4a40, dx - 6, Y + H - 20, 12, 20); p.ell(0x5a4a40, dx, Y + H - 20, 6, 4);
  for (const yy of [Y + H - 16, Y + H - 8]) p.fill(0x2a2a30, dx - 6, yy, 12, 2);
  for (let q = -4; q <= 4; q += 4) p.fill(0xb8a060, dx + q, Y + H - 15, 1, 1);
  p.fill(0x9a948a, dx - 9, Y + H - 2, 18, 2);
  p.doorX = dx;
  // rune lintel and glowing slit windows
  for (let q = 0; q < 5; q++) p.fill('rgba(255,170,70,0.9)', dx - 8 + q * 4, Y + H - 28, 2, 2);
  const slits = Math.max(1, Math.floor((fw - 22) / 14));
  for (let k = 0; k < slits; k++) for (const sx of [fx + 4 + k * 5, fx + fw - 8 - k * 5]) { p.fill(0x1a1410, sx, fy + 6, 4, 9); p.fill(0xffa040, sx + 1, fy + 7, 2, 7); p.fill('rgba(255,160,60,0.25)', sx - 2, fy + 5, 8, 12); }
  // chimney pipes breaking out of the rock, steam drifting
  const cx = X + r.int(6, Math.max(7, W - 14));
  p.fill(0x3a3a3e, cx, top - 12, 6, 18); p.fill(0x26262a, cx - 1, top - 14, 8, 3); p.fill(0x6a6a74, cx, top - 12, 1, 18);
  p.circ('rgba(220,220,226,0.55)', cx + 3, top - 19, 3.4); p.circ('rgba(220,220,226,0.4)', cx + 6, top - 25, 4.2); p.circ('rgba(220,220,226,0.25)', cx + 4, top - 32, 4.8);
  if (r.chance(0.5)) { p.fill(0x1a1410, X + 3, Y + H - 7, 9, 6); p.fill(0x2a2420, X + 4, Y + H - 9, 6, 3); } // coal heap
  if (r.chance(0.5)) { p.line(0x3a2a1a, fx + fw - 3, fy - 1, fx + fw - 3, fy + 6, 1); p.circ(0xffd070, fx + fw - 3, fy + 8, 2.2); p.circ('rgba(255,208,112,0.3)', fx + fw - 3, fy + 8, 5); }
};

// ---------------------------------------------------------------- boomtown: a plank false front with a painted sign, a porch roof across the street side
export const boomtown: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, wall = mixC(b.wall, 0x8a6a46, 0.65), F = Math.round(H * 0.74), top = Y + H - F;
  planks(p, X + 1, top, W - 2, F, wall);
  p.fill(shadeC(wall, 0.9), X, top - 7, W, 8); p.fill(shadeC(wall, 1.2), X, top - 7, W, 1); p.fill(shadeC(wall, 0.7), X + W - 3, top - 7, 3, 8);
  const sw = Math.min(W - 10, 44), sx = X + Math.round((W - sw) / 2);
  p.fill(0x3a2a1a, sx, top + 1, sw, 10); p.fill(0xe8d8a8, sx + 1, top + 2, sw - 2, 8);
  for (let q = 2; q < sw - 4; q += 4) p.fill(r.chance(0.8) ? 0x4a2e1a : 0xe8d8a8, sx + q, top + 4, 3, 4);
  // porch roof and posts across the front
  p.poly(shadeC(wall, 0.72), [X - 4, Y + H - 21, X + W + 4, Y + H - 21, X + W + 1, Y + H - 27, X - 1, Y + H - 27]); p.fill('rgba(0,0,0,0.28)', X - 4, Y + H - 21, W + 8, 3);
  for (const px of [X + 1, X + W - 4]) p.fill(0x4a3220, px, Y + H - 21, 3, 21);
  const n = Math.max(1, Math.floor((W - 20) / 22)), door = r.int(0, n);
  for (let k = 0; k <= n; k++) {
    const cx = X + 11 + (k * (W - 22)) / Math.max(1, n);
    if (k === door) { p.fill(0x3a2a1a, cx - 7, Y + H - 15, 14, 15); p.fill(0x7a5a38, cx - 6, Y + H - 14, 6, 11); p.fill(0x7a5a38, cx + 1, Y + H - 14, 6, 11); p.fill(0x3a2a1a, cx - 1, Y + H - 14, 2, 11); p.doorX = cx; }
    else windowAt(p, Math.round(cx - 4), Y + H - 17, 8, 9, r.chance(0.3) ? 0xffe6a0 : 0x8ec8e8, 0x4a3220);
  }
  p.fill(0x5e3a26, X + 2, Y + H - 5, 2, 5); p.fill(0x5e3a26, X + W - 5, Y + H - 5, 2, 5); // hitching rail stubs
  weather(p, X, top, W, F, false);
};

// ---------------------------------------------------------------- burrow: a round door in a grassy hill, a flower garden, a pipe for smoke
export const burrow: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, cx = X + W / 2, base = Y + H - 3, rx = W / 2 - 1, ry = Math.min(H * 0.78, rx * 0.95);
  const grass = mixC(th.ground, [0x5aa04e, 0x6ab458, 0x4a9248][b.seed % 3], th.id === 'saharan' ? 0.1 : 0.45);
  p.ell('rgba(0,0,0,0.2)', cx + 3, base + 1, rx, 4);
  p.x2.save(); p.x2.beginPath(); p.x2.rect(X - 4, Y - 10, W + 8, H + 6 - 4); p.x2.clip();
  p.ell(shadeC(grass, 0.7), cx, base, rx, ry); p.ell(grass, cx - 1, base - 1, rx - 1, ry - 1); p.ell(shadeC(grass, 1.25), cx - rx * 0.25, base - ry * 0.55, rx * 0.5, ry * 0.3);
  for (let k = 0; k < 14; k++) p.fill(shadeC(grass, r.float(0.82, 1.2)), cx + r.int(-rx + 4, rx - 4), base - r.int(2, ry - 2), 2, 1);
  if (th.id !== 'saharan') for (let k = 0; k < 6; k++) p.circ(['#ffffff', '#f2c94c', '#e8607a', '#c07aff'][k % 4], cx + r.int(-rx + 6, rx - 6), base - r.int(3, Math.round(ry * 0.7)), 1.2);
  p.x2.restore();
  const dc = [0x3a8a4a, 0xb04a3a, 0x4a6ab0, 0xe0b030][b.seed % 4], dy = base - 8;
  p.circ(0x8a8478, cx, dy, 9.5); p.circ(shadeC(dc, 0.7), cx, dy, 8); p.circ(dc, cx, dy, 7); p.fill(shadeC(dc, 0.75), cx, dy - 7, 1, 14); p.fill(shadeC(dc, 0.75), cx - 7, dy, 14, 1);
  p.circ(0xf2c94c, cx + 3, dy + 1, 1.3); p.doorX = cx;
  if (W > 56) for (const wx of [cx - rx * 0.62, cx + rx * 0.62]) { p.circ(0x8a8478, wx, dy - 2, 4.5); p.circ(0xffe6a0, wx, dy - 2, 3.2); p.fill(0x6a4a2a, wx - 3, dy - 2, 6, 1); }
  const px = cx + r.int(-Math.round(rx * 0.4), Math.round(rx * 0.4));
  const pt = Math.round(base - ry * 0.78) - 4;
  p.fill(0x7a5a44, px, pt, 5, 8); p.fill(0x5a3e30, px - 1, pt - 1, 7, 2); p.circ('rgba(200,200,205,0.45)', px + 3, pt - 6, 3); p.circ('rgba(200,200,205,0.3)', px + 5, pt - 12, 3.6);
  for (let k = 0; k < 4; k++) p.fill(0x8a8478, cx - 8 + k * 5, base + 1, 4, 2); // stepping stones
};

// ---------------------------------------------------------------- tower: a glass-and-steel block lit in neon, rising far above its plot
export const tower: Paint = (p, b, th, X, Y, W, H) => {
  const r = p.r, rise = Math.round(H * 0.8) + r.int(0, 16), top = Y - rise, body = shadeC(0x2a3040, r.float(0.85, 1.25));
  const cols = Math.max(2, Math.floor((W - 8) / 6)), gap = (W - 6) / cols;
  p.fill(body, X + 1, top + 8, W - 2, H + rise - 8); p.fill(shadeC(body, 1.35), X + 1, top + 8, 2, H + rise - 8); p.fill(shadeC(body, 0.7), X + W - 4, top + 8, 3, H + rise - 8);
  p.fill(shadeC(body, 1.1), X + 5, top + 2, W - 10, 8); p.fill(shadeC(body, 1.4), X + 5, top + 2, W - 10, 1); // setback crown
  p.fill(0x6a6a74, X + W / 2, top - 12, 1, 14); p.circ('rgba(255,60,60,0.5)', X + W / 2, top - 12, 3); p.circ(0xff4040, X + W / 2, top - 12, 1.2);
  const neon = [0xff4fd8, 0x4fe8ff, 0xffd84f, 0x7aff7a][b.seed % 4];
  for (let y = top + 13; y < Y + H - 20; y += 7) for (let c = 0; c < cols; c++) {
    const lit = r.next(); const wx = Math.round(X + 4 + gap * c);
    p.fill(lit < 0.36 ? (lit < 0.14 ? neon : 0xffe08a) : 0x161c2c, wx, y, Math.max(3, Math.round(gap) - 2), 4);
  }
  // shopfront at the street and a vertical neon sign
  p.fill(0x14181f, X + 1, Y + H - 20, W - 2, 20); p.fill(neon, X + 3, Y + H - 21, W - 6, 1); p.fill('rgba(255,255,255,0.08)', X + 1, Y + H - 20, W - 2, 3);
  for (let k = 0; k < 3; k++) p.fill(r.chance(0.7) ? 0xffe6a0 : neon, X + 4 + k * Math.floor((W - 8) / 3), Y + H - 15, Math.floor((W - 8) / 3) - 2, 8);
  doorAt(p, X + Math.round(W / 2) - 3, Y + H - 12, 6, 12, 0x2a3a50, false, true);
  const sx = r.chance(0.5) ? X - 2 : X + W - 3;
  p.fill(neon, sx, Y + 4 - rise / 2, 3, 28); p.fill(shadeC(neon, 0.6), sx + 1, Y + 6 - rise / 2, 1, 24); p.circ('rgba(255,120,220,0.18)', sx + 1, Y + 18 - rise / 2, 10);
};

// ---------------------------------------------------------------- the plot around a house: a path from the door, a low fence along the street
export type TileAt = (x: number, y: number) => number;
export function doorPath(p: Pen, at: TileAt, X: number, Y: number, doorX: number | undefined, th: Theme) {
  if (doorX === undefined) return;
  const tx = Math.floor(doorX / T), stone = th.cobble ? 0x9a948a : 0xb8aa90;
  let k = 0;
  for (let py = Y; py < Y + 3 * T; py += 5, k++) {
    if (at(tx, Math.floor(py / T)) !== Tile.Ground) break;
    const sx = Math.round(doorX) - 4 + (k % 2 ? 1 : -1) * 2, wd = 7 + (k % 3);
    p.fill(shadeC(stone, 0.7), sx, py + 1, wd, 4); p.fill(shadeC(stone, 1.05), sx, py, wd, 3); p.fill(shadeC(stone, 1.25), sx, py, wd, 1);
  }
  void X;
}
export function fence(p: Pen, at: TileAt, X: number, Y: number, Wd: number, doorX: number | undefined, th: Theme) {
  const r = p.r;
  const kind = th.id === 'morhaven' || th.id === 'silvanel' ? 'wicker' : th.id === 'kazdurum' ? 'stone' : th.id === 'saharan' ? 'none' : r.chance(0.35) ? 'hedge' : 'picket';
  if (kind === 'none') return;
  const y = Y + 5;
  for (let x = X - 4; x < X + Wd + 4; x += 4) {
    if (at(Math.floor(x / T), Math.floor(y / T)) !== Tile.Ground || at(Math.floor((x + 3) / T), Math.floor(y / T)) !== Tile.Ground) continue;
    if (doorX !== undefined && Math.abs(x + 2 - doorX) < 8) continue;
    if (kind === 'picket') { p.fill(0xe8e0cc, x, y - 5, 2, 6); p.fill(0xcfc6ae, x + 1, y - 5, 1, 6); p.fill(0xe8e0cc, x, y - 4, 4, 1); p.fill(0xe8e0cc, x, y - 1, 4, 1); }
    else if (kind === 'wicker') { p.fill(0x8a6a3e, x, y - 4, 4, 5); p.fill(0x6a4a28, x, y - 2, 4, 1); p.fill(0xa8884e, x + 1, y - 4, 1, 5); }
    else if (kind === 'stone') { p.fill(0x8a8478, x, y - 4, 4, 5); p.fill(0xa09a8c, x, y - 4, 4, 1); p.fill(0x6a645a, x, y, 4, 1); }
    else { p.circ(0x2e7a3e, x + 2, y - 2, 3); p.circ(0x4aa04e, x + 1, y - 3, 1.6); }
  }
}

export const NEW_STYLES: Record<string, Paint> = { gable: farmhouse, terrace, adobe, carved, boomtown, burrow, tower };
