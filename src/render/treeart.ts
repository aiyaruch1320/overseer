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

/** the roots as short straight pieces in tree units (the foot of the trunk at 0, 0): drawn by paintWorldTree, and read by the town generator so
 *  that streets and houses keep to the ground between them instead of lying on top of them */
export function rootSegs(base: boolean): { x0: number; y0: number; x1: number; y1: number; w: number; seg: number }[] {
  const out: { x0: number; y0: number; x1: number; y1: number; w: number; seg: number }[] = [], n = base ? 22 : 14;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + 0.3, len = (base ? 70 : 40) + (k % 4) * (base ? 22 : 12), bend = (k % 2 ? 1 : -1) * 0.55;
    let px = 0, py = 0;
    for (let seg = 0; seg < 4; seg++) {
      const aa = a + bend * seg * 0.28, nx = px + Math.cos(aa) * (len / 4), ny = py + Math.sin(aa) * (len / 4) * 0.42 + 0.8;
      out.push({ x0: px, y0: py, x1: nx, y1: ny, w: (base ? 13 : 9) - seg * (base ? 3 : 2.1), seg }); px = nx; py = ny;
    }
  }
  return out;
}
const ROOTS = rootSegs(true);
/** is a point of the map (map units) on the root of the world tree, or on the foot of its trunk? */
export function onTreeRoot(mx: number, my: number, margin = 0): boolean {
  const ux = (mx - WORLD_TREE.x) / WORLD_TREE.scale, uy = (my - WORLD_TREE.y) / WORLD_TREE.scale;
  if (Math.abs(ux) > 170 || uy < -190 || uy > 120) return false;
  if (Math.abs(ux) < 28 + margin && uy > -182 - margin && uy < 6 + margin) return true; // the trunk
  for (const r of ROOTS) {
    const dx = r.x1 - r.x0, dy = r.y1 - r.y0, l2 = dx * dx + dy * dy, k = Math.max(0, Math.min(1, ((ux - r.x0) * dx + (uy - r.y0) * dy) / l2));
    if (Math.hypot(ux - (r.x0 + dx * k), uy - (r.y0 + dy * k)) < r.w / 2 + margin) return true;
  }
  return false;
}

/** the great tree itself: buttressed roots, a barked trunk, branches reaching out, a canopy of leaf masses, vines and blossoms. `s` is px per unit; (x, y) is the foot of the trunk */
export const TREE_SPR = { fx: 220, fy: 300, w: 440, h: 320 }; // sprite size and where the foot of the trunk is in it (tree units)

export function paintWorldTree(c: CanvasRenderingContext2D, x: number, y: number, s: number, leaves: number[], seed = 7, glow = 1, mode: 'full' | 'base' = 'full') {
  const rnd = leafRng(seed), bark = [0x5b4030, 0x4a3322, 0x7a5a40].map(rgb), full = mode === 'full';
  c.save(); c.translate(x, y); c.scale(s, s);
  // the aura and the shadow the tree throws on the land
  let g: CanvasGradient;
  if (full) { g = c.createRadialGradient(0, -150, 10, 0, -160, 260); g.addColorStop(0, `rgba(210,255,170,${0.26 * glow})`); g.addColorStop(1, 'rgba(200,255,160,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, -160, 260, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(8,24,10,0.3)'; c.beginPath(); c.ellipse(full ? 14 : 8, 6, full ? 140 : 74, full ? 26 : 18, 0, 0, TAU); c.fill();
  // roots spread over the ground in curving buttresses
  c.lineCap = 'round';
  for (const r of rootSegs(mode === 'base')) {
    c.strokeStyle = css(bark[r.seg % 2 ? 2 : 0], 1, 1); c.lineWidth = full ? r.w * 1.25 : r.w; c.beginPath(); c.moveTo(r.x0, r.y0); c.lineTo(r.x1, r.y1); c.stroke();
  }
  // the trunk. Seen from the ground: a swelling column with ridged bark, a hollow with a warm light. Seen from afar: a vast tapering pillar that
  // narrows to a neck and flares at the top into the branches that carry the crown, as tall as the crown is wide.
  const tw = full ? 24 : 17, top = full ? -182 : -76;
  const trunk = (lx: number, rx: number) => {
    c.beginPath();
    if (!full) { c.moveTo(-tw - 8, 4); c.bezierCurveTo(-tw, -14, -tw * 0.62, -40, -tw * 0.5, -76); c.lineTo(tw * 0.5, -76); c.bezierCurveTo(tw * 0.62, -40, tw, -14, tw + 8, 4); }
    else { c.moveTo(-tw - 14, 6); c.bezierCurveTo(-tw - 2, -26, -19, -66, -18, -104); c.bezierCurveTo(-17, -136, -34, -156, -64, top); c.lineTo(64, top); c.bezierCurveTo(34, -156, 17, -136, 18, -104); c.bezierCurveTo(19, -66, tw + 2, -26, tw + 14, 6); }
    c.closePath(); void lx; void rx;
  };
  c.fillStyle = css(bark[0]); trunk(0, 0); c.fill();
  c.save(); trunk(0, 0); c.clip();
  c.fillStyle = css(bark[2], 1, 0.9); c.fillRect(-80, top, 82, 24 - top);
  c.fillStyle = 'rgba(20,10,4,0.38)'; c.fillRect(10, top, 60, 24 - top);
  c.strokeStyle = 'rgba(22,12,6,0.5)'; c.lineWidth = 1.2;
  for (let k = 0; k < 13; k++) { const bx = -tw - 8 + k * ((tw * 2 + 16) / 12); c.beginPath(); c.moveTo(bx, 4); c.bezierCurveTo(bx * 0.9, top * 0.3, bx * 0.7 + (rnd() - 0.5) * 4, top * 0.7, bx * 0.5, top + 2); c.stroke(); }
  c.restore();
  c.fillStyle = '#1a0e06'; c.beginPath(); c.ellipse(-2, -10, 7, 10, 0, 0, TAU); c.fill(); g = c.createRadialGradient(-2, -8, 0, -2, -8, 9); g.addColorStop(0, 'rgba(255,220,130,0.95)'); g.addColorStop(1, 'rgba(255,200,100,0)'); c.fillStyle = g; c.beginPath(); c.arc(-2, -8, 9, 0, TAU); c.fill();
  if (!full) {
    // from the ground the crown is overhead and out of sight: the trunk climbs into a dark roof of leaves at the top of the picture
    const rnd2 = leafRng(seed + 3);
    leafCluster(c, 0, -84, 40, 18, [0x0f4a22, 0x1a6a2e, 0x2a8a3c], rnd2, 1.1);
    for (let k = 0; k < 6; k++) leafCluster(c, -70 + k * 28, -88 + (k % 2) * 6, 26, 14, [0x0f4a22, 0x1a6a2e, 0x2a8a3c], rnd2, 1);
    c.restore();
    return;
  }
  // great boughs fan out from the top of the trunk and climb to the underside of the crown
  c.lineCap = 'round';
  const targets = [-185, -150, -112, -72, -34, 0, 34, 72, 112, 150, 185];
  for (const tx of targets) {
    const sx = Math.max(-50, Math.min(50, tx * 0.3)), ty = -204 - Math.abs(tx) * 0.02;
    for (const [lw, col] of [[Math.max(5, 15 - Math.abs(tx) / 18), css(bark[0])], [Math.max(2, 7 - Math.abs(tx) / 30), css(bark[2], 1, 0.85)]] as [number, string][]) {
      c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(sx, top + 10); c.quadraticCurveTo(sx + tx * 0.5, top - 24 - Math.abs(tx) * 0.04, tx, ty); c.stroke();
    }
  }
  // the underside of the crown: a deep shade of leaves hanging down in clumps, with vines and their beads of light
  const dark = leaves.map((v) => ((((v >> 16) & 255) * 0.42) << 16) | ((((v >> 8) & 255) * 0.5) << 8) | ((v & 255) * 0.42));
  g = c.createRadialGradient(0, -200, 20, 0, -200, 200); g.addColorStop(0, 'rgba(4,20,8,0.7)'); g.addColorStop(1, 'rgba(4,20,8,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(0, -198, 205, 40, 0, 0, TAU); c.fill();
  for (let k = 0; k < 20; k++) { const a = (k / 19) * Math.PI, hx = Math.cos(a) * 178, hy = -192 + Math.sin(a) * 26 + (k % 3) * 4; leafCluster(c, hx, hy, 24 + (k % 4) * 4, 14 + (k % 3) * 3, dark, rnd, 0.9); }
  for (let k = 0; k < 46; k++) {
    const vx = -185 + rnd() * 370, vy = -196 + rnd() * 24, len = 14 + rnd() * 50;
    c.strokeStyle = css(rgb(leaves[0]), 0.7, 0.9); c.lineWidth = 1; c.beginPath(); c.moveTo(vx, vy); c.bezierCurveTo(vx + 4, vy + len * 0.4, vx - 4, vy + len * 0.7, vx + 1, vy + len); c.stroke();
    if (k % 3 === 0) { g = c.createRadialGradient(vx + 1, vy + len, 0, vx + 1, vy + len, 4); g.addColorStop(0, 'rgba(255,250,190,0.95)'); g.addColorStop(1, 'rgba(255,250,190,0)'); c.fillStyle = g; c.beginPath(); c.arc(vx + 1, vy + len, 4, 0, TAU); c.fill(); }
  }
  // the crown itself: three tiers of leaf masses laid round an ellipse, back to front, the upper tiers brighter and goldening in the light
  const lit = [leaves, leaves.map((v) => mixRgb(v, 0xa8d050, 0.25)), leaves.map((v) => mixRgb(v, 0xd8e060, 0.35))];
  const tiers: { cy: number; rx: number; ry: number; n: number; mr: number; mry: number }[] = [{ cy: -208, rx: 200, ry: 36, n: 22, mr: 46, mry: 26 }, { cy: -228, rx: 156, ry: 30, n: 15, mr: 44, mry: 24 }, { cy: -246, rx: 100, ry: 22, n: 9, mr: 40, mry: 21 }];
  const placed: [number, number, number, number][] = [];
  tiers.forEach((tr, ti) => {
    const ms: [number, number, number, number, number][] = [];
    for (let k = 0; k < tr.n; k++) { const a = (k / tr.n) * TAU + ti * 0.4; ms.push([Math.cos(a) * tr.rx, tr.cy + Math.sin(a) * tr.ry, tr.mr + (k % 3) * 4, tr.mry + (k % 2) * 3, Math.sin(a)]); }
    ms.push([0, tr.cy, tr.rx * 0.7, tr.ry * 1.1, 0.2]);
    ms.sort((p, q) => p[4] - q[4]);
    for (const [mx, my, rx, ry] of ms) { leafCluster(c, mx, my, rx, ry, lit[ti], rnd, 1); placed.push([mx, my, rx, ry]); }
  });
  g = c.createRadialGradient(-70, -246, 10, -40, -226, 230); g.addColorStop(0, 'rgba(255,248,190,0.2)'); g.addColorStop(1, 'rgba(255,248,190,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(0, -224, 210, 54, 0, 0, TAU); c.fill();
  // blossoms and glowing fruit scattered through the leaves
  for (let k = 0; k < 70; k++) {
    const mm = placed[Math.floor(rnd() * placed.length)], a = rnd() * TAU, d = Math.sqrt(rnd()) * 0.9, bx = mm[0] + Math.cos(a) * mm[2] * d, by = mm[1] + Math.sin(a) * mm[3] * d;
    const col = ['255,250,190', '255,200,120', '255,170,200'][k % 3]; const gg = c.createRadialGradient(bx, by, 0, bx, by, 4.5); gg.addColorStop(0, `rgba(${col},0.9)`); gg.addColorStop(1, `rgba(${col},0)`); c.fillStyle = gg; c.beginPath(); c.arc(bx, by, 4.5, 0, TAU); c.fill(); c.fillStyle = `rgb(${col})`; c.beginPath(); c.arc(bx, by, 1.3, 0, TAU); c.fill();
  }
  c.restore();
}
const mixRgb = (a: number, b: number, t: number) => { const f = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (f(16) << 16) | (f(8) << 8) | f(0); };

/** where the world tree stands on the map (map units) and how much of the ground around it lies under its crown: 1 under the middle of the
 *  canopy, thinning to 0 at its drip line. Only towns under it get the leaf-light of the dive; the rest of the forest does not. */
export const WORLD_TREE = { x: 265, y: 282, scale: 0.62 };
export function canopyCover(mx: number, my: number): number {
  const cx = WORLD_TREE.x, cy = WORLD_TREE.y - 62, rx = 124, ry = 66; // the ground beneath the umbrella of the crown
  const d = Math.hypot((mx - cx) / rx, (my - cy) / ry);
  const k = Math.max(0, Math.min(1, (d - 0.45) / 0.55));
  return 1 - k * k * (3 - 2 * k);
}
