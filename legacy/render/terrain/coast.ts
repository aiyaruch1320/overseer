// Coastline paths. The contour is sampled at 2 MU; when zoomed in, segments are subdivided with a deterministic
// midpoint displacement (the same segment always gets the same wobble) so coasts keep gaining detail instead of going straight,
// then drawn as quadratic curves through segment midpoints (smooth at any zoom).
import type { Loop } from './land';

export interface ViewRect { x0: number; y0: number; x1: number; y1: number }

const MAX_DEPTH = 8;

function hash(ax: number, ay: number, bx: number, by: number): number {
  let h = Math.imul((ax * 997) | 0, 73856093) ^ Math.imul((ay * 997) | 0, 19349663) ^ Math.imul((bx * 997) | 0, 83492791) ^ Math.imul((by * 997) | 0, 2654435761);
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function refine(pts: Float32Array, s: number, view: ViewRect, thr: number): number[] {
  const out: number[] = [];
  const n = pts.length / 2;
  const sub = (ax: number, ay: number, bx: number, by: number, depth: number) => {
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (depth >= MAX_DEPTH || len * s < thr) { out.push(bx, by); return; }
    const d = (hash(ax, ay, bx, by) - 0.5) * len * 0.34;
    const mx = (ax + bx) / 2 - (dy / len) * d, my = (ay + by) / 2 + (dx / len) * d;
    sub(ax, ay, mx, my, depth + 1); sub(mx, my, bx, by, depth + 1);
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[j * 2], by = pts[j * 2 + 1];
    const visible = !(Math.max(ax, bx) < view.x0 || Math.min(ax, bx) > view.x1 || Math.max(ay, by) < view.y0 || Math.min(ay, by) > view.y1);
    if (visible) sub(ax, ay, bx, by, 0); else out.push(bx, by);
  }
  return out;
}

/**
 * A closed, smooth path through all the loops; `s` is CSS px per MU, `view` the visible rectangle in MU (padded by the caller).
 * The curve (a quadratic B-spline through segment midpoints) is flattened into short straight pieces here: browsers rasterise
 * thousands of line segments far faster than the same number of curve segments, which matters for the huge coast paths.
 */
export function coastPath(loops: Loop[], s: number, view: ViewRect): Path2D {
  const path = new Path2D();
  for (const l of loops) {
    const p = s * 2 > 7 ? refine(l.pts, s, view, 9) : l.pts;
    const n = p.length / 2;
    if (n < 3) continue;
    let ax = (p[(n - 1) * 2] + p[0]) / 2, ay = (p[(n - 1) * 2 + 1] + p[1]) / 2;
    path.moveTo(ax, ay);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const cx = p[i * 2], cy = p[i * 2 + 1];
      const bx = (cx + p[j * 2]) / 2, by = (cy + p[j * 2 + 1]) / 2;
      const k = Math.max(1, Math.min(10, Math.ceil(((Math.abs(cx - ax) + Math.abs(cy - ay) + Math.abs(bx - cx) + Math.abs(by - cy)) * s) / 5)));
      for (let q = 1; q <= k; q++) {
        const t = q / k, u = 1 - t;
        path.lineTo(u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by);
      }
      ax = bx; ay = by;
    }
    path.closePath();
  }
  return path;
}

/** just the stretches of coast that are on screen, as open polylines (for strokes: no need to trace the whole world's coast at deep zoom) */
export function coastLines(loops: Loop[], s: number, view: ViewRect): Path2D {
  const path = new Path2D();
  const x0 = view.x0 - 6, x1 = view.x1 + 6, y0 = view.y0 - 6, y1 = view.y1 + 6;
  for (const l of loops) {
    const p = l.pts, n = p.length / 2;
    let x = Infinity, y = Infinity;
    for (let i = 0; i < n; i++) { x = Math.min(x, p[i * 2]); y = Math.min(y, p[i * 2 + 1]); }
    // a loop wholly off screen contributes nothing
    let mx = -Infinity, my = -Infinity;
    for (let i = 0; i < n; i++) { mx = Math.max(mx, p[i * 2]); my = Math.max(my, p[i * 2 + 1]); }
    if (mx < x0 || x > x1 || my < y0 || y > y1) continue;
    // keep only the runs of points near the screen, with a point of margin each side
    const keep = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const vx = p[i * 2], vy = p[i * 2 + 1]; if (vx >= x0 && vx <= x1 && vy >= y0 && vy <= y1) { keep[i] = 1; keep[(i + 1) % n] = 1; keep[(i + n - 1) % n] = 1; } }
    const sub: Loop[] = [];
    let run: number[] = [];
    const flush = () => { if (run.length >= 6) sub.push({ def: l.def, pts: Float32Array.from(run), area: 0 }); run = []; };
    let start = 0;
    while (start < n && keep[start]) start++; // begin at a gap so runs never wrap around the seam
    if (start >= n) { path.addPath(coastPath([l], s, view)); continue; }
    for (let k = 1; k <= n; k++) { const i = (start + k) % n; if (keep[i]) run.push(p[i * 2], p[i * 2 + 1]); else flush(); }
    flush();
    for (const r of sub) {
      const q = s * 2 > 7 ? refineOpen(r.pts, s, view) : r.pts;
      path.moveTo(q[0], q[1]);
      for (let i = 1; i < q.length / 2 - 1; i++) {
        const cx = q[i * 2], cy = q[i * 2 + 1], bx = (cx + q[i * 2 + 2]) / 2, by = (cy + q[i * 2 + 3]) / 2;
        path.lineTo(cx, cy); path.lineTo(bx, by);
      }
      path.lineTo(q[q.length - 2], q[q.length - 1]);
    }
  }
  return path;
}

function refineOpen(pts: Float32Array, s: number, view: ViewRect): number[] {
  const out: number[] = [pts[0], pts[1]];
  const sub = (ax: number, ay: number, bx: number, by: number, depth: number) => {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    if (depth >= MAX_DEPTH || len * s < 9) { out.push(bx, by); return; }
    const d = (hash(ax, ay, bx, by) - 0.5) * len * 0.34;
    const mx = (ax + bx) / 2 - (dy / len) * d, my = (ay + by) / 2 + (dx / len) * d;
    sub(ax, ay, mx, my, depth + 1); sub(mx, my, bx, by, depth + 1);
  };
  const n = pts.length / 2;
  for (let i = 0; i < n - 1; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[i * 2 + 2], by = pts[i * 2 + 3];
    const vis = !(Math.max(ax, bx) < view.x0 || Math.min(ax, bx) > view.x1 || Math.max(ay, by) < view.y0 || Math.min(ay, by) > view.y1);
    if (vis) sub(ax, ay, bx, by, 0); else out.push(bx, by);
  }
  return out;
}
