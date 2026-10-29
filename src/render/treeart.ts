// Foliage and great trees drawn from real leaves, not discs: every crown is hundreds of pointed blades, dark underneath and sunlit on top,
// with a rim of light, hanging vines and glowing blossoms. Shared by the world tree on the map, the world-tree city, saplings and treehouses.

const TAU = Math.PI * 2;
export function leafRng(seed: number) {
  let h = seed >>> 0 || 1;
  return () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const css = (c: number[], k = 1, a = 1) => `rgba(${Math.min(255, Math.round(c[0] * k))},${Math.min(255, Math.round(c[1] * k))},${Math.min(255, Math.round(c[2] * k))},${a})`;

/** one pointed leaf blade at (x, y), pointing along `ang`, with a centre vein */
function blade(c: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, wid: number, fill: string, vein?: string) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = fill; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(wid, -len * 0.45, 0, -len); c.quadraticCurveTo(-wid, -len * 0.45, 0, 0); c.fill();
  if (vein) { c.strokeStyle = vein; c.lineWidth = Math.max(0.4, wid * 0.16); c.beginPath(); c.moveTo(0, -len * 0.05); c.lineTo(0, -len * 0.9); c.stroke(); }
  c.restore();
}

/** a mass of foliage: a dark under-layer, a body of blades, and a sunlit crest on the upper left, so it reads as a lit volume */
export function leafCluster(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, colors: number[], rnd: () => number, density = 1) {
  const cs = colors.map(rgb), base = cs[0];
  c.fillStyle = css(base, 0.3, 0.95); c.beginPath(); c.ellipse(cx, cy, rx * 0.8, ry * 0.8, 0, 0, TAU); c.fill(); // the shade deep inside
  const n = Math.max(30, Math.round(((rx * ry) / 4.2) * density));
  const layers: [number, number, number, number][] = [[0.36, 0.9, 1.08, 0.34], [0.58, 0.95, 0.96, 0.3], [0.82, 1.0, 0.82, 0.24], [1.05, 1.05, 0.62, 0.12]]; // [brightness, size, reach, share]
  const unit = Math.sqrt((rx + ry) / 44);
  for (const [k, sz, reach, share] of layers) {
    for (let i = 0; i < n * share; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * reach;
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
      // blades fan outward and sag a little under their own weight
      const ang = a + Math.PI / 2 + (rnd() - 0.5) * 1.5 + (Math.sin(a) > 0 ? 0.3 : 0);
      const lit = Math.max(0, -(Math.cos(a) * 0.6 + Math.sin(a) * 0.8)) * d; // the upper left is toward the sun
      const col = cs[Math.floor(rnd() * cs.length)];
      const len = (6 + rnd() * 7) * sz * unit, wid = len * 0.3;
      blade(c, x, y, ang, len, wid, css(col, k + lit * 0.45, 1), rnd() < 0.25 ? css(col, k * 0.55, 0.55) : undefined);
    }
  }
  // sunlit crest and a thin rim of light along the top edge
  for (let i = 0; i < n * 0.07; i++) {
    const a = Math.PI * (1.05 + rnd() * 0.75), d = 0.45 + rnd() * 0.5, col = cs[Math.floor(rnd() * cs.length)];
    blade(c, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, a + Math.PI / 2 + (rnd() - 0.5), 5 + rnd() * 5, 1.8, css(col, 1.45, 0.95));
  }
  c.strokeStyle = css(cs[cs.length - 1], 1.5, 0.35); c.lineWidth = Math.max(0.6, rx * 0.025); c.beginPath(); c.ellipse(cx, cy, rx * 0.98, ry * 0.98, 0, Math.PI * 1.05, Math.PI * 1.85); c.stroke();
}

/** the great tree itself: buttressed roots, a barked trunk, branches reaching out, a canopy of leaf masses, vines and blossoms. `s` is px per unit; (x, y) is the foot of the trunk */
export function paintWorldTree(c: CanvasRenderingContext2D, x: number, y: number, s: number, leaves: number[], seed = 7, glow = 1) {
  const rnd = leafRng(seed), bark = [0x5b4030, 0x4a3322, 0x7a5a40].map(rgb);
  c.save(); c.translate(x, y); c.scale(s, s);
  // the aura and the shadow on the ground
  let g = c.createRadialGradient(0, -52, 6, 0, -52, 108); g.addColorStop(0, `rgba(200,255,160,${0.3 * glow})`); g.addColorStop(1, 'rgba(200,255,160,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, -52, 108, 0, TAU); c.fill();
  c.fillStyle = 'rgba(8,24,10,0.3)'; c.beginPath(); c.ellipse(8, 6, 74, 18, 0, 0, TAU); c.fill();
  // roots spread over the ground in curving buttresses
  c.lineCap = 'round';
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU + 0.3, len = 40 + (k % 4) * 12, bend = (k % 2 ? 1 : -1) * 0.55;
    let px = 0, py = 0;
    for (let seg = 0; seg < 4; seg++) {
      const aa = a + bend * seg * 0.28, nx = px + Math.cos(aa) * (len / 4), ny = py + Math.sin(aa) * (len / 4) * 0.42 + 0.8;
      c.strokeStyle = css(bark[seg % 2 ? 2 : 0], 1, 1); c.lineWidth = 9 - seg * 2.1; c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke(); px = nx; py = ny;
    }
  }
  // the trunk: a swelling column with ridged bark, lit from the left, a hollow with a warm light in it
  const tw = 17;
  c.fillStyle = css(bark[0]); c.beginPath(); c.moveTo(-tw - 8, 4); c.bezierCurveTo(-tw, -14, -tw * 0.62, -40, -tw * 0.5, -76); c.lineTo(tw * 0.5, -76); c.bezierCurveTo(tw * 0.62, -40, tw, -14, tw + 8, 4); c.closePath(); c.fill();
  c.fillStyle = css(bark[2], 1, 0.9); c.beginPath(); c.moveTo(-tw - 6, 4); c.bezierCurveTo(-tw, -14, -tw * 0.62, -40, -tw * 0.5, -76); c.lineTo(-tw * 0.1, -76); c.bezierCurveTo(-tw * 0.3, -40, -tw * 0.55, -14, -tw * 0.7, 4); c.closePath(); c.fill();
  c.fillStyle = 'rgba(20,10,4,0.35)'; c.beginPath(); c.moveTo(tw * 0.3, 4); c.bezierCurveTo(tw * 0.35, -14, tw * 0.25, -40, tw * 0.3, -76); c.lineTo(tw * 0.5, -76); c.bezierCurveTo(tw * 0.62, -40, tw, -14, tw + 8, 4); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(22,12,6,0.5)'; c.lineWidth = 1.1;
  for (let k = 0; k < 9; k++) { const bx = -tw + 4 + k * ((tw * 2 - 8) / 8); c.beginPath(); c.moveTo(bx, 2); c.bezierCurveTo(bx * 0.9, -22, bx * 0.8 + (rnd() - 0.5) * 3, -50, bx * 0.55, -74); c.stroke(); }
  c.fillStyle = '#1a0e06'; c.beginPath(); c.ellipse(-2, -10, 7, 10, 0, 0, TAU); c.fill(); g = c.createRadialGradient(-2, -8, 0, -2, -8, 9); g.addColorStop(0, 'rgba(255,220,130,0.95)'); g.addColorStop(1, 'rgba(255,200,100,0)'); c.fillStyle = g; c.beginPath(); c.arc(-2, -8, 9, 0, TAU); c.fill();
  // branches into the canopy, then the canopy: back masses first, front last
  c.strokeStyle = css(bark[0]); c.lineCap = 'round';
  const arms: [number, number, number, number][] = [[-8, -70, -90, -96], [8, -70, 90, -96], [-6, -72, -62, -130], [6, -72, 62, -130], [-4, -74, -26, -140], [4, -74, 26, -140], [0, -76, 0, -150]];
  for (const [x0, y0, x1, y1] of arms) { c.lineWidth = 7; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + (x1 > x0 ? -8 : 8), (y0 + y1) / 2 - 8, x1, y1); c.stroke(); }
  const masses: [number, number, number, number][] = [[-98, -104, 38, 28], [98, -104, 38, 28], [-70, -78, 32, 22], [70, -78, 32, 22], [-72, -134, 38, 28], [72, -134, 38, 28], [0, -160, 50, 34], [-38, -140, 38, 28], [38, -140, 38, 28], [0, -104, 52, 34], [-28, -186, 32, 22], [28, -186, 32, 22], [0, -206, 26, 18]];
  masses.forEach(([mx, my, rx, ry]) => leafCluster(c, mx, my, rx, ry, leaves, rnd, 1));
  // vines hanging from the lowest masses, with a bead of light at each tip
  for (let k = 0; k < 30; k++) {
    const mx = -110 + rnd() * 220, top = -86 + rnd() * 14, len = 10 + rnd() * 26;
    c.strokeStyle = css(rgb(leaves[0]), 0.7, 0.9); c.lineWidth = 0.9; c.beginPath(); c.moveTo(mx, top); c.bezierCurveTo(mx + 3, top + len * 0.4, mx - 3, top + len * 0.7, mx + 1, top + len); c.stroke();
    if (k % 3 === 0) { c.fillStyle = 'rgba(255,250,190,0.95)'; c.beginPath(); c.arc(mx + 1, top + len, 1.3, 0, TAU); c.fill(); }
  }
  // blossoms and glowing fruit scattered through the leaves
  for (let k = 0; k < 40; k++) {
    const mm = masses[Math.floor(rnd() * masses.length)], a = rnd() * TAU, d = Math.sqrt(rnd()) * 0.9, bx = mm[0] + Math.cos(a) * mm[2] * d, by = mm[1] + Math.sin(a) * mm[3] * d;
    const col = ['255,250,190', '255,200,120', '255,170,200'][k % 3]; const gg = c.createRadialGradient(bx, by, 0, bx, by, 4); gg.addColorStop(0, `rgba(${col},0.9)`); gg.addColorStop(1, `rgba(${col},0)`); c.fillStyle = gg; c.beginPath(); c.arc(bx, by, 4, 0, TAU); c.fill(); c.fillStyle = `rgb(${col})`; c.beginPath(); c.arc(bx, by, 1.2, 0, TAU); c.fill();
  }
  c.restore();
}

/** where the world tree stands on the map (map units) and how much of the ground around it lies under its crown: 1 under the middle of the
 *  canopy, thinning to 0 at its drip line. Only towns under it get the leaf-light of the dive; the rest of the forest does not. */
export const WORLD_TREE = { x: 265, y: 282, scale: 0.7 };
export function canopyCover(mx: number, my: number): number {
  const cx = WORLD_TREE.x, cy = WORLD_TREE.y - 72, rx = 100, ry = 86;
  const d = Math.hypot((mx - cx) / rx, (my - cy) / ry);
  const k = Math.max(0, Math.min(1, (d - 0.45) / 0.55));
  return 1 - k * k * (3 - 2 * k);
}
