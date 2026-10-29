// How a street is surfaced, from the wealth of the town that built it: red clay for the poor, packed earth and gravel, rounded cobbles,
// dressed flagstones, and for the richest towns polished slabs with inlaid borders. Main avenues are always a step better than the lanes.
import { RNG } from '../sim/rng';
import { type Pen, shadeC, mixC } from './draw';
import type { Theme } from './themes';
import { T } from './citygen';

export type Surface = 'clay' | 'earth' | 'cobble' | 'flag' | 'slab' | 'board';

/** the quality of one street tile: the town's wealth, lifted on avenues and near the square, lowered in back lanes */
export const quality = (wealth: number, cls: number, centre: number) => Math.max(0, Math.min(1, wealth + (cls >= 2 ? 0.24 : cls === 1 ? 0.07 : -0.14) + (1 - centre) * 0.1));

export function surfaceOf(q: number, th: Theme): Surface {
  if (th.boardwalk && q < 0.5) return 'board'; // a sea nation's poorer streets are plank walkways; its rich ones are stone
  if (q < 0.24) return 'clay';
  if (q < 0.42) return 'earth';
  if (q < 0.62) return 'cobble';
  if (q < 0.8) return 'flag';
  return 'slab';
}

/** paint one tile of street. `open` tells which sides continue as road (up, down, left, right) so edges and ruts follow the street */
export function paintStreet(p: Pen, th: Theme, surf: Surface, X: number, Y: number, open: [boolean, boolean, boolean, boolean], r: RNG, flavour: number) {
  const [up, down, left, right] = open;
  const clay = mixC(th.road, 0xa4503a, 0.62), earth = mixC(th.road, 0xb49468, 0.4);
  const horiz = left && right && !(up && down);
  switch (surf) {
    case 'clay': {
      p.fill(clay, X, Y, T, T);
      for (let k = 0; k < 7; k++) p.fill(shadeC(clay, r.float(0.8, 1.18)), X + r.int(0, 13), Y + r.int(0, 13), r.int(2, 4), r.int(1, 3));
      // wheel ruts and the odd puddle
      const rut = shadeC(clay, 0.72);
      if (horiz) { p.fill(rut, X, Y + 4, T, 2); p.fill(rut, X, Y + 10, T, 2); } else { p.fill(rut, X + 4, Y, 2, T); p.fill(rut, X + 10, Y, 2, T); }
      if (r.chance(0.18)) { p.ell('rgba(70,40,34,0.55)', X + r.int(4, 12), Y + r.int(4, 12), r.int(3, 5), 2); p.ell('rgba(160,190,210,0.5)', X + 7, Y + 7, 2, 1); }
      if (r.chance(0.3)) p.fill(0x5a8a3a, X + r.int(0, 14), Y + r.int(0, 14), 1, 2); // weeds
      break;
    }
    case 'earth': {
      p.fill(earth, X, Y, T, T);
      for (let k = 0; k < 9; k++) p.fill(shadeC(earth, r.float(0.82, 1.15)), X + r.int(0, 14), Y + r.int(0, 14), r.int(1, 3), r.int(1, 2));
      for (let k = 0; k < 5; k++) p.fill(shadeC(earth, 1.3), X + r.int(0, 14), Y + r.int(0, 14), 2, 1); // gravel
      if (horiz) p.fill(shadeC(earth, 0.86), X, Y + 7, T, 1); else if (up && down) p.fill(shadeC(earth, 0.86), X + 7, Y, 1, T);
      break;
    }
    case 'cobble': {
      p.fill(shadeC(th.road, 0.78), X, Y, T, T);
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) {
        const sx = X + i * 4 + (row % 2) * 2, sy = Y + row * 5 + 1;
        const c = shadeC(th.road, r.float(0.92, 1.14));
        p.fill(c, sx, sy, 3, 4); p.fill(shadeC(c, 1.18), sx, sy, 3, 1);
      }
      break;
    }
    case 'flag': {
      const c0 = mixC(th.road, 0xd8d0c0, 0.32);
      p.fill(shadeC(c0, 0.7), X, Y, T, T);
      const cols = (X / T + Y / T) % 2 ? [8, 8] : [5, 11];
      for (const [i, w] of [[0, cols[0]], [cols[0], 16 - cols[0]]]) { p.fill(shadeC(c0, r.float(0.94, 1.08)), X + i + 1, Y + 1, w - 1, 7); p.fill(shadeC(c0, r.float(0.94, 1.08)), X + i + 1, Y + 9, w - 1, 6); }
      p.fill(shadeC(c0, 1.2), X, Y, T, 1);
      break;
    }
    case 'slab': {
      const c0 = mixC(th.plaza, 0xf2ede2, 0.5);
      p.fill(shadeC(c0, 0.8), X, Y, T, T); p.fill(shadeC(c0, r.float(1.0, 1.08)), X + 1, Y + 1, 14, 14);
      p.fill(shadeC(c0, 1.22), X + 1, Y + 1, 14, 1);
      // an inlaid band of the town's colour down the middle of every other tile, so a great avenue reads as laid out
      if (flavour % 2 === 0) { const a = mixC(c0, th.banner[0], 0.4); if (horiz) p.fill(a, X + 2, Y + 7, 12, 2); else p.fill(a, X + 7, Y + 2, 2, 12); p.fill(mixC(c0, th.banner[1], 0.6), X + 7, Y + 7, 2, 2); }
      break;
    }
    case 'board': {
      p.fill(th.road, X, Y, T, T);
      for (let k = 0; k < T; k += 4) { p.fill(shadeC(th.road, 0.8), X, Y + k, T, 1); }
      p.fill(shadeC(th.road, 1.1), X + (flavour % 2) * 8, Y, 1, T);
      break;
    }
  }
  // the edge: kerbs on good streets, ragged verges on poor ones
  const kerb = surf === 'slab' ? 0xf8f4ea : surf === 'flag' ? 0xb8b0a0 : surf === 'cobble' ? 0x6a645a : 0;
  if (kerb) { if (!up) p.fill(kerb, X, Y, T, 2); if (!down) p.fill(shadeC(kerb, 0.7), X, Y + T - 2, T, 2); if (!left) p.fill(shadeC(kerb, 0.9), X, Y, 2, T); if (!right) p.fill(shadeC(kerb, 0.8), X + T - 2, Y, 2, T); }
  else if (surf !== 'board') {
    const verge = surf === 'clay' ? 0x6a8a3a : 0x7a8a48;
    for (let k = 0; k < T; k += 3) {
      if (!up && r.chance(0.6)) p.fill(verge, X + k, Y, 2, 1 + r.int(0, 1));
      if (!down && r.chance(0.6)) p.fill(verge, X + k, Y + T - 1 - r.int(0, 1), 2, 1 + r.int(0, 1));
      if (!left && r.chance(0.6)) p.fill(verge, X, Y + k, 1 + r.int(0, 1), 2);
      if (!right && r.chance(0.6)) p.fill(verge, X + T - 1 - r.int(0, 1), Y + k, 1 + r.int(0, 1), 2);
    }
  }
}
