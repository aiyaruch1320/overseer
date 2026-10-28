// Pure map painter shared by the main thread and the map worker: turns world tiles into RGBA pixels.
import { makeNoise } from '../sim/rng';
import { climateById } from '../data/races';

export interface PaintWorld { w: number; h: number; country: Int16Array; height: Float32Array; climates: string[]; scale: number }

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

export function makePainter(world: PaintWorld) {
  const noise = makeNoise(4242);
  const fine = makeNoise(99);
  const { w, h, country, height, climates, scale } = world;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : country[y * w + x]);

  // colour of one map pixel; `ppt` = pixels per tile of the texture being painted
  function pixel(px: number, py: number, ppt: number): number[] {
    const tx = Math.min(w - 1, Math.floor(px / ppt)), ty = Math.min(h - 1, Math.floor(py / ppt));
    const i = ty * w + tx;
    const c = country[i];
    const fx = px / ppt, fy = py / ppt;
    const hv = height[i] + (fine(fx * 1.3, fy * 1.3, 2) - 0.5) * 0.12;
    if (c < 0 || hv < 0.08) {
      let col = rgb(hv > -0.05 ? 0x3f82b8 : hv > -0.3 ? 0x2d628e : 0x1f4670);
      if (hv > 0.0 && hv < 0.08) col = rgb(0x6fb0d8);
      if (ppt >= 4 && (Math.floor(px + py * 1.7) % 37 === 0) && hv < -0.15) col = col.map((k) => Math.min(255, k + 25));
      return col;
    }
    const cl = climates[c];
    const pal = climateById(cl).colors;
    const n = noise(fx / (6 * scale), fy / (6 * scale));
    let col = rgb(pal[Math.min(pal.length - 1, Math.floor(n * pal.length * 1.2))]);
    const grain = (fine(fx * 2, fy * 2, 1) - 0.5) * 22;
    col = col.map((k) => k + grain);
    if (hv > 0.55) col = col.map((k) => k * 0.86);
    if (hv > 0.9) col = cl === 'frozen' ? [255, 255, 255] : col.map((k) => k * 0.6 + 60);
    if (hv < 0.14) col = cl === 'frozen' ? [192, 208, 220] : [232, 217, 160];
    if (ppt >= 4) {
      const hsh = ((px * 73856093) ^ (py * 19349663)) >>> 0;
      if (hv > 0.2 && hv < 0.75 && (hsh & 31) === 0) {
        col = cl === 'tropical' || cl === 'temperate' ? [31, 90, 42] : cl === 'desert' ? [176, 136, 64] : cl === 'volcanic' ? [200, 70, 30] : cl === 'frozen' ? [150, 175, 195] : [47, 138, 74];
      }
      const lx = px % ppt, ly = py % ppt;
      if ((lx === 0 && at(tx - 1, ty) !== c && at(tx - 1, ty) >= 0) || (ly === 0 && at(tx, ty - 1) !== c && at(tx, ty - 1) >= 0)) col = col.map((k) => k * 0.45);
    } else if ((at(tx - 1, ty) !== c && at(tx - 1, ty) >= 0) || (at(tx, ty - 1) !== c && at(tx, ty - 1) >= 0)) col = col.map((k) => k * 0.6);
    return col;
  }

  // RGBA bytes for a rectangle of the map
  return function paint(x0: number, y0: number, wpx: number, hpx: number, ppt: number): Uint8ClampedArray {
    const d = new Uint8ClampedArray(wpx * hpx * 4);
    for (let y = 0; y < hpx; y++) for (let x = 0; x < wpx; x++) {
      const col = pixel(x0 + x, y0 + y, ppt);
      const o = (y * wpx + x) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
    return d;
  };
}
