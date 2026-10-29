// Hand-placed story landmarks drawn live on top of the terrain (few, so they can breathe): the world tree, the nine-axis machine
// ruin at Arkea, the hell rift between Morhaven and Kaz-Durum, the sunken city's whirlpool in Nebulia, and Nebulia's drifting fog.
import type { ViewRect } from './coast';
import { paintWorldTree, TREE_SPR, WORLD_TREE } from '../treeart';
import { MU_TO_WU } from '../../world/geo';

const TAU = Math.PI * 2;

function fogSprite(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d')!;
  for (const [x, y, r] of [[70, 76, 44], [116, 58, 52], [160, 70, 56], [200, 80, 40], [132, 86, 48]] as [number, number, number][]) {
    const g = c.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(214,214,238,0.8)'); g.addColorStop(0.6, 'rgba(196,198,226,0.42)'); g.addColorStop(1, 'rgba(190,192,224,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  return cv;
}

const near = (v: ViewRect, x: number, y: number, r: number) => x + r > v.x0 && x - r < v.x1 && y + r > v.y0 && y - r < v.y1;

export class Landmarks {
  private fog = fogSprite();
  private puffs: { x: number; y: number; size: number; phase: number }[] = [];

  constructor() {
    let h = 7;
    const rnd = () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 22; i++) this.puffs.push({ x: 520 + rnd() * 470, y: 60 + rnd() * 160, size: 55 + rnd() * 70, phase: rnd() * TAU });
  }

  /** drawn after the ground symbols: the tree, the machine, the rift, the whirlpool */
  drawGround(ctx: CanvasRenderingContext2D, s: number, view: ViewRect, time: number) {
    const hair = 1 / s;
    if (near(view, 265, 280, 110)) {
      const z = s / MU_TO_WU, ss = (lo: number, hi: number) => { const k = Math.max(0, Math.min(1, (z - lo) / (hi - lo))); return k * k * (3 - 2 * k); };
      // from afar the whole tree; as the camera goes in under it the crown is overhead and out of sight, and only the roots and the foot of the trunk remain on the ground the town stands on
      const fa = 1 - ss(1.3, 2.6), ra = ss(1.0, 2.2);
      ctx.save(); ctx.translate(WORLD_TREE.x, WORLD_TREE.y); ctx.scale(WORLD_TREE.scale, WORLD_TREE.scale);
      if (ra > 0.01) { ctx.globalAlpha = ra; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(this.holes.length ? this.rootsHoled(ss(1.2, 2.3)) : this.roots(), -TREE_SPR.fx, -TREE_SPR.fy, TREE_SPR.w, TREE_SPR.h); }
      if (fa > 0.01) { ctx.globalAlpha = fa; this.worldTree(ctx, 0, 0, time, hair / WORLD_TREE.scale); }
      ctx.restore();
    }
    if (near(view, 1112, 302, 50)) this.arkea(ctx, 1112, 302, time, hair);
    if (near(view, 710, 150, 60)) this.whirlpool(ctx, 708, 150, 44, 19, time, hair);
    if (near(view, 705, 808, 120)) this.rift(ctx, time, hair);
  }

  /** Nebulia's fog, above the land and below the labels */
  drawFog(ctx: CanvasRenderingContext2D, view: ViewRect, time: number, s: number) {
    if (!near(view, 745, 140, 300)) return;
    const k = Math.min(1, s / 1.2); // thins out when you dive into the land
    ctx.globalAlpha = 0.34 * (1 - 0.6 * Math.min(1, Math.max(0, (s - 2) / 6))) * Math.max(0.55, k);
    for (const p of this.puffs) {
      const x = p.x + Math.sin(time * 0.045 + p.phase) * 14, y = p.y + Math.cos(time * 0.037 + p.phase * 1.3) * 6;
      ctx.drawImage(this.fog, x - p.size, y - p.size * 0.5, p.size * 2, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private treeSprite: HTMLCanvasElement | null = null;
  private rootSprite: HTMLCanvasElement | null = null;
  private coverGrid: Uint8ClampedArray | null = null;
  private holes: { x: number; y: number }[] = [];
  private holed: { key: number; cv: HTMLCanvasElement } | null = null;

  /** towns (map units) that stand on or among the roots: the roots become see-through around each as the camera goes in, so a town is never drawn over a root */
  setRootHoles(list: { x: number; y: number }[]) { this.holes = list; this.holed = null; }

  /** how much of the tree (crown, trunk) is drawn at a point of the map: 0 clear ground, 1 solid tree. A town behind it is seen through it as the tree fades. */
  treeCover(mx: number, my: number): number {
    const gw = TREE_SPR.w / 2, gh = TREE_SPR.h / 2;
    if (!this.coverGrid) {
      const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh;
      const c = cv.getContext('2d', { willReadFrequently: true })!; c.drawImage(this.tree(), 0, 0, gw, gh);
      const px = c.getImageData(0, 0, gw, gh).data, g = new Uint8ClampedArray(gw * gh);
      for (let i = 0; i < g.length; i++) g[i] = px[i * 4 + 3];
      this.coverGrid = g;
    }
    const sc = WORLD_TREE.scale, gx = Math.floor((((mx - WORLD_TREE.x) / sc) + TREE_SPR.fx) / 2), gy = Math.floor((((my - WORLD_TREE.y) / sc) + TREE_SPR.fy) / 2);
    let sum = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = gx + dx, y = gy + dy; n++; if (x >= 0 && y >= 0 && x < gw && y < gh) sum += this.coverGrid[y * gw + x]; }
    return sum / n / 255;
  }

  /** the root sprite with a clearing at each town on it, opened to `open` (0..1) */
  private rootsHoled(open: number): HTMLCanvasElement {
    const src = this.roots(), key = Math.round(open * 10);
    if (this.holed && this.holed.key === key) return this.holed.cv;
    const cv = this.holed?.cv ?? document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const c = cv.getContext('2d')!, k = src.width / TREE_SPR.w, sc = WORLD_TREE.scale;
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    for (const h of this.holes) {
      const x = (((h.x - WORLD_TREE.x) / sc) + TREE_SPR.fx) * k, y = (((h.y - WORLD_TREE.y) / sc) + TREE_SPR.fy) * k, rx = (19 / sc) * k, ry = (13 / sc) * k;
      c.save(); c.translate(x, y); c.scale(1, ry / rx);
      const g = c.createRadialGradient(0, 0, rx * 0.55, 0, 0, rx); g.addColorStop(0, `rgba(0,0,0,${open})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
    }
    this.holed = { key, cv };
    return cv;
  }
  /** the same tree seen from under its crown: only roots and the foot of the trunk, as the town below it would see it */
  private roots(): HTMLCanvasElement {
    if (this.rootSprite) return this.rootSprite;
    const k = 4, cv = document.createElement('canvas');
    cv.width = TREE_SPR.w * k; cv.height = TREE_SPR.h * k;
    paintWorldTree(cv.getContext('2d')!, TREE_SPR.fx * k, TREE_SPR.fy * k, k, [0x2a7a3a, 0x3d8f45, 0x5aa04e, 0x86c44e, 0x1f6a34], 11, 1, 'base');
    return (this.rootSprite = cv);
  }

  /** the tree is painted once, leaf by leaf, into a big sprite; only the pulse of its aura and the drifting motes are live */
  private tree(): HTMLCanvasElement {
    if (this.treeSprite) return this.treeSprite;
    const k = 5, cv = document.createElement('canvas');
    cv.width = TREE_SPR.w * k; cv.height = TREE_SPR.h * k;
    paintWorldTree(cv.getContext('2d')!, TREE_SPR.fx * k, TREE_SPR.fy * k, k, [0x2a7a3a, 0x3d8f45, 0x5aa04e, 0x86c44e, 0x1f6a34], 11);
    return (this.treeSprite = cv);
  }

  private puff: HTMLCanvasElement | null = null;
  private cloudPuff(): HTMLCanvasElement {
    if (this.puff) return this.puff;
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 120; const c = cv.getContext('2d')!;
    for (const [x, y, r] of [[50, 70, 34], [88, 54, 42], [128, 62, 40], [160, 74, 28], [104, 78, 36], [70, 84, 24]] as [number, number, number][]) {
      const g = c.createRadialGradient(x, y, r * 0.15, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(236,244,255,0.6)'); g.addColorStop(1, 'rgba(226,238,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    return (this.puff = cv);
  }
  /** a ring of cloud turning slowly round the trunk and the crown (tree units): the half behind the tree is drawn before it, the half in front after */
  private cloudRing(ctx: CanvasRenderingContext2D, cy: number, rx: number, ry: number, n: number, size: number, speed: number, rise: number, time: number, front: boolean) {
    const p = this.cloudPuff();
    for (let i = 0; i < n; i++) {
      const a = time * speed + (i * TAU) / n + rise;
      if ((Math.sin(a) > 0) !== front) continue;
      const s = size * (0.75 + 0.5 * (((i * 7) % 5) / 5)) * (front ? 1 + 0.22 * Math.sin(a) : 0.9), x = Math.cos(a) * rx, y = cy + Math.sin(a) * ry + ((i / n) - 0.5) * rise * 6;
      ctx.globalAlpha = front ? 0.6 : 0.5; ctx.drawImage(p, x - s, y - s * 0.6, s * 2, s * 1.2);
    }
    ctx.globalAlpha = 1;
  }

  /** the world tree as the whole continent sees it: a vast umbrella crown on a pillar of a trunk, cloud turning round it in rings, shafts of light through the
   *  leaves, mist in the valley under it and fireflies over the land (all in tree units, the foot of the trunk at x, y) */
  private worldTree(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, hair: number) {
    void hair;
    const pulse = 0.85 + 0.15 * Math.sin(time * 0.8), a0 = ctx.globalAlpha;
    const rings: [number, number, number, number, number, number, number][] = [[-70, 140, 22, 22, 32, 0.05, 0.4], [-128, 190, 30, 28, 40, -0.04, 1.7], [-172, 250, 38, 30, 48, 0.035, 3.1]];
    ctx.save(); ctx.translate(x, y);
    for (const [cy, rx, ry, n, size, sp, ph] of rings) this.cloudRing(ctx, cy, rx, ry, n, size, sp, ph, time, false);
    ctx.globalAlpha = a0;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.tree(), -TREE_SPR.fx, -TREE_SPR.fy, TREE_SPR.w, TREE_SPR.h);
    for (const [cy, rx, ry, n, size, sp, ph] of rings) this.cloudRing(ctx, cy, rx, ry, n, size, sp, ph, time, true);
    ctx.globalAlpha = a0;
    // light falling through the crown in slanting shafts
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 7; k++) {
      const tx = -150 + k * 50 + Math.sin(time * 0.3 + k) * 6, w0 = 10 + (k % 3) * 6, w1 = 26 + (k % 3) * 10, lean = 46 + (k % 2) * 16;
      const g = ctx.createLinearGradient(tx, -196, tx + lean, 0); g.addColorStop(0, `rgba(255,248,200,${0.2 * pulse})`); g.addColorStop(0.7, 'rgba(255,244,190,0.06)'); g.addColorStop(1, 'rgba(255,244,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(tx - w0, -196); ctx.lineTo(tx + w0, -196); ctx.lineTo(tx + lean + w1, 0); ctx.lineTo(tx + lean - w1, 0); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // mist lying in the valley round the foot of the trunk
    const p = this.cloudPuff();
    for (let k = 0; k < 12; k++) { const mx = -170 + k * 31 + Math.sin(time * 0.1 + k) * 8, s = 34 + (k % 4) * 8; ctx.globalAlpha = a0 * 0.5; ctx.drawImage(p, mx - s, 2 - s * 0.4 + (k % 3) * 4, s * 2, s * 0.9); }
    ctx.globalAlpha = a0;
    // fireflies and drifting seed-light over the whole land under it
    for (let k = 0; k < 56; k++) {
      const t = time * (0.05 + (k % 5) * 0.012) + k * 1.37, fx = Math.cos(t * 0.7 + k) * (120 + (k * 13) % 110), fy = -(k * 29 % 250) + Math.sin(t + k * 2) * 6 + 6, tw = 0.5 + 0.5 * Math.sin(time * 1.6 + k * 2.1);
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 5); g.addColorStop(0, `rgba(255,252,190,${0.9 * tw * a0})`); g.addColorStop(1, 'rgba(255,252,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  private arkea(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, hair: number) {
    ctx.fillStyle = 'rgba(30,28,28,0.5)'; ctx.beginPath(); ctx.ellipse(x, y, 40, 30, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.74);
    ctx.strokeStyle = 'rgba(205,198,178,0.9)';
    for (const [r, w] of [[34, 1.6], [26, 1.1], [18, 1.1], [9, 1.2]] as [number, number][]) { ctx.lineWidth = Math.max(hair, w * 0.7); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
    ctx.setLineDash([2, 2.4]); ctx.lineWidth = Math.max(hair, 1.2); ctx.strokeStyle = 'rgba(195,160,100,0.8)'; ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = Math.max(hair, 0.7); ctx.strokeStyle = 'rgba(205,198,178,0.6)'; ctx.beginPath();
    for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU - Math.PI / 2; ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); }
    ctx.stroke();
    // the nine axes
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU - Math.PI / 2, nx = Math.cos(a) * 26, ny = Math.sin(a) * 26, f = 0.7 + 0.3 * Math.sin(time * 1.6 + k);
      const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, 6);
      g.addColorStop(0, `rgba(120,255,235,${0.9 * f})`); g.addColorStop(1, 'rgba(120,255,235,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(nx, ny, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d8f8f2'; ctx.beginPath(); ctx.arc(nx, ny, 1.5, 0, TAU); ctx.fill();
    }
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
    cg.addColorStop(0, `rgba(160,255,240,${0.8 + 0.2 * Math.sin(time * 2)})`); cg.addColorStop(1, 'rgba(160,255,240,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
    ctx.restore();
  }

  private whirlpool(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, time: number, hair: number) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, 'rgba(10,8,30,0.85)'); g.addColorStop(0.7, 'rgba(40,36,90,0.45)'); g.addColorStop(1, 'rgba(60,60,120,0)');
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rx, 0, TAU); ctx.fill();
    ctx.lineCap = 'round'; ctx.lineWidth = Math.max(hair * 1.2, 0.9);
    for (let arm = 0; arm < 3; arm++) {
      ctx.strokeStyle = `rgba(200,190,255,${0.55 - arm * 0.1})`; ctx.beginPath();
      for (let i = 0; i <= 28; i++) { const t = i / 28, a = arm * (TAU / 3) + t * 5 + time * 0.25, r = t * rx * 0.92; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
    ctx.restore();
    // lanterns of the drowned city
    for (let k = 0; k < 9; k++) { const a = k * 0.9 + time * 0.05, r = rx * (0.3 + 0.55 * ((k * 0.37) % 1)); ctx.fillStyle = `rgba(255,220,150,${0.5 + 0.4 * Math.sin(time * 2 + k)})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * (ry / rx), 0.8, 0, TAU); ctx.fill(); }
  }

  private rift(ctx: CanvasRenderingContext2D, time: number, hair: number) {
    const pts: [number, number][] = [[605, 818], [632, 812], [655, 820], [680, 808], [705, 812], [728, 802], [752, 808], [778, 800], [806, 806]];
    const path = new Path2D();
    path.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1] + (i % 2 ? 2.2 : -2.2));
    path.moveTo(705, 812); path.lineTo(713, 826); path.lineTo(724, 836); path.moveTo(752, 808); path.lineTo(762, 795); path.lineTo(776, 786);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const f = 0.8 + 0.2 * Math.sin(time * 1.3);
    ctx.strokeStyle = `rgba(255,90,30,${0.38 * f})`; ctx.lineWidth = 13; ctx.stroke(path);
    ctx.strokeStyle = `rgba(255,140,50,${0.3 * f})`; ctx.lineWidth = 7.5; ctx.stroke(path);
    ctx.strokeStyle = '#140807'; ctx.lineWidth = 4.2; ctx.stroke(path);
    ctx.strokeStyle = `rgba(255,${Math.round(96 + 50 * f)},34,0.95)`; ctx.lineWidth = Math.max(hair, 1.6); ctx.stroke(path);
  }
}
