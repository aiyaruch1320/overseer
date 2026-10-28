// Azgar's floating islands: a soft shadow cast on the world below, a tapering rock underside with hanging crags,
// the painted top surface, a grass lip, clouds drifting underneath, chain bridges and the sky-lake waterfall.
import { DEFS, defIndex } from '../../world/geo';
import { coastPath, type ViewRect } from './coast';
import type { Loop } from './land';

interface Island { def: number; loops: Loop[]; cx: number; cy: number; w: number; h: number; depth: number; seed: number; hull: Float32Array }

const CLOUD_COUNT = 8;

function cloudSprite(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d')!;
  const puffs: [number, number, number][] = [[60, 80, 40], [105, 62, 50], [150, 70, 54], [196, 84, 38], [128, 88, 46], [90, 92, 34], [170, 95, 32]];
  for (const [x, y, r] of puffs) {
    const g = c.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(244,248,255,0.7)'); g.addColorStop(1, 'rgba(236,244,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  return cv;
}

/** outline of the rock under an island: the island's rim and a smaller copy sunk below it, joined by their convex hull */
function undersideHull(loops: Loop[], cx: number, cy: number, depth: number): Float32Array {
  const pts: [number, number][] = [];
  for (const l of loops) for (let i = 0; i < l.pts.length; i += 6) {
    const x = l.pts[i], y = l.pts[i + 1];
    pts.push([x, y]);
    pts.push([cx + (x - cx) * 0.2, cy + depth + (y - cy) * 0.18]);
  }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  return Float32Array.from(hull.flat());
}

export class Floating {
  islands: Island[] = [];
  private cloud = cloudSprite();
  private fall: { x: number; y0: number; y1: number } | null = null;
  private chains: [number, number, number, number][] = [];

  constructor(skyLoops: Loop[][]) {
    skyLoops.forEach((loops, def) => {
      if (!loops || !loops.length || !DEFS[def].float) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const l of loops) for (let i = 0; i < l.pts.length; i += 2) { x0 = Math.min(x0, l.pts[i]); x1 = Math.max(x1, l.pts[i]); y0 = Math.min(y0, l.pts[i + 1]); y1 = Math.max(y1, l.pts[i + 1]); }
      const w = x1 - x0, h = y1 - y0;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, depth = Math.max(7, Math.min(34, 0.3 * w + 0.25 * h));
      this.islands.push({ def, loops, cx, cy, w, h, depth, seed: def * 7919, hull: undersideHull(loops, cx, cy, depth) });
    });
    this.islands.sort((a, b) => a.cy - b.cy);
    // AZ-01 is forty islands bound by chain bridges: link its satellites to the main isle
    const a1 = defIndex('az01');
    const main = DEFS[a1].blobs[0];
    for (const bl of DEFS[a1].blobs.slice(1)) this.chains.push([main.x, main.y, bl.x, bl.y]);
    // AZ-06 is a lake in the sky; its overflow falls toward NR-02
    const a6 = DEFS[defIndex('az06')].blobs[0];
    this.fall = { x: a6.x + 6, y0: a6.y + a6.ry * 0.6, y1: a6.y + a6.ry + 62 };
  }

  private visible(isl: Island, view: ViewRect, pad: number) {
    return !(isl.cx + isl.w < view.x0 - pad || isl.cx - isl.w > view.x1 + pad || isl.cy + isl.h + isl.depth < view.y0 - pad * 1.4 || isl.cy - isl.h > view.y1 + pad * 1.4);
  }

  private clouds(ctx: CanvasRenderingContext2D, isl: Island, time: number, front: boolean) {
    const n = front ? 4 : CLOUD_COUNT;
    for (let k = 0; k < n; k++) {
      const h = ((isl.seed + k * 131 + (front ? 77 : 0)) * 2654435761) >>> 0;
      const a = (h % 1000) / 1000, b = ((h >>> 10) % 1000) / 1000;
      const drift = Math.sin(time * 0.1 + k * 1.7 + isl.seed) * 3.5;
      const size = (isl.w * (front ? 0.2 : 0.3) + 12) * (0.7 + b * 0.8);
      const x = isl.cx + (a - 0.5) * (isl.w * (front ? 0.7 : 1.2) + 20) + drift;
      const y = isl.cy + isl.h * 0.5 + isl.depth * (front ? 0.55 + b * 0.4 : 0.2 + b * 0.9);
      ctx.globalAlpha = front ? 0.85 : 0.5 + (1 - b) * 0.35;
      ctx.drawImage(this.cloud, x - size, y - size * 0.5, size * 2, size);
    }
    ctx.globalAlpha = 1;
  }

  /** everything under the top surfaces: the shadow thrown on the world, back clouds, chain bridges, the tapering rock underside, front wisps */
  drawBelow(ctx: CanvasRenderingContext2D, s: number, view: ViewRect, time: number) {
    const vis = this.islands.filter((i) => this.visible(i, view, 90));
    const paths = new Map<Island, Path2D>(vis.map((i) => [i, coastPath(i.loops, s, view)]));
    // shadows thrown on the world below: every island in one path, so a handful of draw calls however many are in view
    const all = new Path2D();
    for (const isl of vis) all.addPath(paths.get(isl)!);
    ctx.save();
    ctx.translate(22, 42);
    ctx.fillStyle = 'rgba(4,14,32,0.2)'; ctx.fill(all, 'evenodd');
    ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(4,14,32,0.09)'; ctx.lineWidth = 6; ctx.stroke(all);
    ctx.restore();
    for (const isl of vis) this.clouds(ctx, isl, time, false);
    // chain bridges
    ctx.strokeStyle = 'rgba(70,52,34,0.9)'; ctx.lineWidth = Math.max(1, 0.5 * s) / s; ctx.setLineDash([1.4, 1.2]);
    ctx.beginPath(); for (const [x1, y1, x2, y2] of this.chains) { ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + 7, x2, y2); } ctx.stroke();
    ctx.setLineDash([]);
    for (const isl of vis) {
      // rock underside: one gradient-filled hull, ragged crags hanging from it
      const hl = isl.hull;
      const g = ctx.createLinearGradient(0, isl.cy - isl.h * 0.2, 0, isl.cy + isl.depth + isl.h * 0.1);
      g.addColorStop(0, '#b99874'); g.addColorStop(0.45, '#8a6a52'); g.addColorStop(1, '#3a2c26');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(hl[0], hl[1]); for (let i = 2; i < hl.length; i += 2) ctx.lineTo(hl[i], hl[i + 1]); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(30,20,16,0.35)';
      for (let k = 0; k < 4; k++) {
        const h = ((isl.seed + k * 977) * 2654435761) >>> 0;
        const a = ((h % 1000) / 1000 - 0.5), b = ((h >>> 10) % 1000) / 1000;
        const x = isl.cx + a * isl.w * 0.3, y = isl.cy + isl.depth * (0.62 + b * 0.2), w = 1.2 + isl.depth * 0.07;
        ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w * 0.3, y + isl.depth * (0.3 + b * 0.22)); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
      }
      this.clouds(ctx, isl, time, true);
    }
    // waterfall of AZ-06
    if (this.fall) {
      const { x, y0, y1 } = this.fall;
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(210,240,255,0.85)'); g.addColorStop(1, 'rgba(210,240,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 2.2, y0, 4.4, y1 - y0);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, 0.5 * s) / s; ctx.setLineDash([3, 5]); ctx.lineDashOffset = -time * 14;
      for (const dx of [-1.2, 0, 1.3]) { ctx.beginPath(); ctx.moveTo(x + dx, y0); ctx.lineTo(x + dx * 1.4, y1 - 8); ctx.stroke(); }
      ctx.setLineDash([]);
    }
  }

  /** the thin grass lip around each top surface (drawn above the surface symbols) */
  drawLip(ctx: CanvasRenderingContext2D, s: number, view: ViewRect) {
    ctx.lineJoin = 'round';
    const all = new Path2D();
    for (const isl of this.islands) if (this.visible(isl, view, 60)) all.addPath(coastPath(isl.loops, s, view));
    ctx.strokeStyle = 'rgba(206,232,160,0.75)'; ctx.lineWidth = Math.max(1.3, 1.5 * s) / s; ctx.stroke(all);
    ctx.strokeStyle = 'rgba(40,28,16,0.8)'; ctx.lineWidth = 1.1 / s; ctx.stroke(all);
  }
}
