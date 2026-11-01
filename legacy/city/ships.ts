// The harbour's furniture: ships moored by the piers (each people builds its own kind), quay cranes, the light at the end of a mole,
// and the rafts that a floating town's houses sit on.
import { RNG } from '../sim/rng';
import { type Pen, shadeC, mixC } from './draw';
import type { Theme } from './themes';
import { T } from './citygen';

interface Ship { x: number; y: number; len: number; horizontal: boolean; kind: string; seed: number }

/** a ship alongside a pier. Horizontal ones are drawn in side view, vertical ones from above, bow down */
export function paintShip(p: Pen, s: Ship, th: Theme) {
  const r = new RNG(s.seed), X = s.x * T, Y = s.y * T, L = s.len * T;
  const hullC = { nerea: 0x8a5a3a, aldria: 0x2a4a7a, mecharia: 0x5a5e68, morhaven: 0x3a2a22, kazdurum: 0x44403e, saharan: 0xb08a50, silvanel: 0x6a4a2a, nebulia: 0x3a3a4a, azgar: 0xe8e0d0 }[s.kind] ?? 0x6a4a2a;
  const sail = [0xf4f0e0, 0xe8d8b0, th.banner[0], 0xe8e0d0, th.banner[1]][r.int(0, 4)];
  const trim = s.kind === 'nerea' ? th.banner[0] : 0xf2c94c;
  if (s.horizontal) {
    const base = Y + 28, hl = L - 6, x0 = X + 3;
    p.ell('rgba(10,40,70,0.3)', x0 + hl / 2 + 3, base + 3, hl / 2 + 2, 4);
    // hull: a swelling curve with a raised stern and a pointed bow, a wale stripe, gun ports or oars
    p.poly(shadeC(hullC, 0.8), [x0, base - 12, x0 + hl, base - 8, x0 + hl - 10, base + 2, x0 + 8, base + 2]);
    p.poly(hullC, [x0, base - 12, x0 + hl, base - 8, x0 + hl - 4, base - 4, x0 + 3, base - 5]);
    p.fill(trim, x0 + 2, base - 7, hl - 4, 1);
    if (s.kind === 'aldria') for (let i = 0; i < hl / 9 - 1; i++) p.fill(0x14141a, x0 + 12 + i * 9, base - 3, 3, 2);
    else if (s.kind === 'morhaven') { p.fill(0x2a1a14, x0 + hl - 2, base - 16, 2, 9); p.circ(0xe8e0d0, x0 + hl, base - 17, 2.4); for (let i = 0; i < 5; i++) p.circ(th.banner[0], x0 + 8 + i * 11, base - 5, 2.6); }
    else if (s.kind === 'mecharia') { p.fill(0x3a3a40, x0 + hl * 0.4, base - 30, 7, 20); p.fill(0x1a1a1e, x0 + hl * 0.4 - 1, base - 31, 9, 3); p.circ('rgba(80,76,74,0.5)', x0 + hl * 0.4 + 4, base - 38, 5); p.circ('rgba(80,76,74,0.35)', x0 + hl * 0.4 + 9, base - 48, 7); p.circ(0x44484e, x0 + 12, base - 5, 5); }
    else if (s.kind === 'saharan') p.fill(shadeC(hullC, 1.2), x0 + 6, base - 14, hl - 12, 2);
    const masts = s.kind === 'mecharia' || s.kind === 'morhaven' ? 1 : hl > 90 ? 3 : 2;
    for (let m = 0; m < masts; m++) {
      const mx = x0 + hl * (masts === 1 ? 0.5 : 0.22 + (m * 0.56) / (masts - 1)), top = base - 52 - (m === 1 ? 6 : 0);
      p.fill(0x4a3a22, mx, top, 2, base - 10 - top);
      if (s.kind === 'saharan') p.poly(sail, [mx - hl * 0.14, base - 14, mx + 1, top, mx + 1, base - 14]); // a lateen sail
      else if (s.kind === 'nerea') { for (let k = 0; k < 4; k++) p.fill(k % 2 ? shadeC(sail, 0.9) : sail, mx - 10, top + 2 + k * 8, 22, 8); p.fill(0x4a3a22, mx - 10, top + 2, 22, 1); }
      else if (s.kind === 'morhaven') { for (let k = 0; k < 6; k++) p.fill(k % 2 ? th.banner[0] : 0xe8e0d0, mx - 14 + k * 5, top + 4, 5, 26); }
      else { p.poly(sail, [mx - 12, top + 6, mx + 14, top + 6, mx + 12, top + 30, mx - 10, top + 30]); p.poly(shadeC(sail, 0.78), [mx + 3, top + 6, mx + 14, top + 6, mx + 12, top + 30, mx + 3, top + 30]); p.fill(0x4a3a22, mx - 12, top + 5, 27, 1); }
      p.poly(th.banner[m % 2], [mx + 2, top - 1, mx + 11, top + 2, mx + 2, top + 5]);
    }
    p.fill('rgba(255,255,255,0.8)', x0 + hl - 6, base, 8, 1); p.fill('rgba(255,255,255,0.6)', x0 + 6, base + 1, hl - 14, 1); // foam at the waterline
  } else {
    const cx = X + 16, y0 = Y + 3, hl = L - 6;
    p.ell('rgba(10,40,70,0.3)', cx + 3, y0 + hl / 2 + 3, 14, hl / 2 + 2);
    p.poly(shadeC(hullC, 0.8), [cx - 11, y0, cx + 11, y0, cx + 9, y0 + hl - 10, cx, y0 + hl, cx - 9, y0 + hl - 10]);
    p.poly(hullC, [cx - 9, y0 + 2, cx + 9, y0 + 2, cx + 7, y0 + hl - 12, cx, y0 + hl - 3, cx - 7, y0 + hl - 12]);
    for (let j = 6; j < hl - 8; j += 4) p.fill(shadeC(0xb08a5a, 0.9), cx - 6, y0 + j, 12, 1); // the deck
    const masts = hl > 90 ? 3 : 2;
    for (let m = 0; m < masts; m++) { const my = y0 + 16 + (m * (hl - 40)) / Math.max(1, masts - 1); p.circ(0x4a3a22, cx, my, 2.4); p.fill(sail, cx - 12, my - 1, 24, 3); p.fill(shadeC(sail, 0.75), cx - 12, my + 2, 24, 1); }
    p.fill(trim, cx - 9, y0 + 2, 18, 1);
  }
}

/** a quay crane: a tall lattice mast with a long jib and a hanging load */
export function paintCrane(p: Pen, x: number, y: number) {
  p.ell('rgba(0,0,0,0.25)', x + 6, y + 2, 12, 4);
  p.fill(0x5a5a62, x - 3, y - 44, 6, 44); p.fill(0x8a8a94, x - 3, y - 44, 2, 44); for (let j = 4; j < 44; j += 7) p.line(0x3a3a40, x - 3, y - j, x + 3, y - j - 6, 1);
  p.fill(0x3a3a40, x - 12, y - 8, 24, 5); p.fill(0xe0b030, x - 12, y - 8, 24, 1);
  p.fill(0xc83a2a, x - 26, y - 48, 40, 3); p.line(0x3a3a40, x, y - 52, x - 22, y - 46, 1); p.line(0x3a3a40, x, y - 52, x + 14, y - 46, 1);
  p.line(0x2a2a30, x - 22, y - 45, x - 22, y - 24, 1); p.fill(0x8a5a2a, x - 27, y - 24, 10, 8); p.fill(0xc08a3a, x - 26, y - 23, 8, 2);
}

/** the lighthouse at the end of a mole: a banded tower and a lamp that throws light over the water */
export function paintBeacon(p: Pen, x: number, y: number) {
  p.ell('rgba(0,0,0,0.3)', x + 5, y + 2, 14, 5);
  p.fill(0x9a948a, x - 12, y - 6, 24, 6); p.fill(0xb8b2a6, x - 12, y - 6, 24, 1);
  p.poly(0xf4f0e6, [x - 8, y - 6, x - 5, y - 52, x + 5, y - 52, x + 8, y - 6]); p.poly(0xd8d0c0, [x + 1, y - 52, x + 5, y - 52, x + 8, y - 6, x + 2, y - 6]);
  for (const j of [14, 30]) p.poly(0xc83a2a, [x - 7 + j / 40, y - j, x - 6 + j / 40, y - j - 8, x + 6 - j / 40, y - j - 8, x + 7 - j / 40, y - j]);
  p.fill(0x3a3a40, x - 7, y - 58, 14, 7); p.circ('rgba(255,240,160,0.4)', x, y - 55, 20); p.circ('rgba(255,240,160,0.25)', x, y - 55, 34); p.circ(0xfff0a0, x, y - 55, 4);
  p.poly(0x8a3a2a, [x - 8, y - 58, x, y - 68, x + 8, y - 58]);
}

/** the raft under a house of a floating town: planks, floats of barrels, ropes to the walkway */
export function paintRaft(p: Pen, th: Theme, X: number, Y: number, W: number, H: number, r: RNG) {
  const wood = mixC(0x9a7a50, th.road, 0.2);
  p.ell('rgba(10,40,70,0.28)', X + W / 2 + 3, Y + H + 2, W / 2 + 6, 6);
  p.fill(shadeC(wood, 0.55), X - 4, Y + 6, W + 8, H); p.fill(wood, X - 4, Y + 4, W + 8, H - 2);
  for (let k = 0; k < W + 8; k += 5) p.fill(shadeC(wood, 0.82), X - 4 + k, Y + 4, 1, H - 2);
  p.fill(shadeC(wood, 1.2), X - 4, Y + 4, W + 8, 1);
  for (let k = 0; k < Math.floor((W + 8) / 14); k++) { const bx = X - 2 + k * 14; p.fill(0x6a4a2a, bx, Y + H, 9, 6); p.fill(0x8a6a3a, bx, Y + H, 9, 2); p.fill(0x3a2a18, bx, Y + H + 2, 9, 1); }
  p.line(0x5a4a30, X - 4, Y + H - 2, X - 12, Y + H + 4, 1); p.line(0x5a4a30, X + W + 4, Y + H - 2, X + W + 12, Y + H + 4, 1);
  void r;
}
