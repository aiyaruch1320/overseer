// The world map as resolution-independent vector art, drawn straight onto a DPR-sized canvas every time the camera moves.
// Coordinates inside draw calls are map units (MU, 1600 × 900 sheet); `s` is CSS px per MU.
import { DEFS, CONT_LABELS, MU_TO_WU } from '../../world/geo';
import { buildLand, CELL, GW, GH, traceMask, type Land, type Loop } from './land';
import { buildFields, makeProbe, type Fields } from './fields';
import { buildGround, buildShallows } from './palette';
import { coastPath, coastLines, type ViewRect } from './coast';
import { Scatter, TIERS, type Placed } from './scatter';
import { SpriteBank } from './sprites';
import { META } from './glyphs';
import { Floating } from './floating';
import type { Road } from '../../world/roads';
import { Landmarks } from './landmarks';

export interface View { cx: number; cy: number; zoom: number; w: number; h: number } // cx, cy in world units; w, h CSS px

const SEA = { deep: '#102c48', foam: 'rgba(226,247,246,0.8)' };

export class TerrainRenderer {
  readonly canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  land: Land;
  ter: Fields;
  probe: ReturnType<typeof makeProbe>;
  private ground: HTMLCanvasElement;
  private shallows: HTMLCanvasElement;
  private groundLoops: Loop[] = [];
  private skyLoops: Loop[][] = [];
  private floating: Floating;
  private scatter: Scatter;
  private skyScatter: Scatter;
  private seaScatter: Scatter;
  private landmarks = new Landmarks();
  private sprites = new SpriteBank();
  private placed: Placed[] = [];
  private alphas: number[] = new Array(TIERS).fill(0);
  private labels: string[] = [];
  private roads: { kind: Road['kind']; full: number[]; cut: number[]; bb: [number, number, number, number] }[] = [];
  private highlight: Path2D | null = null;
  private fateLoops: { loops: ReturnType<typeof traceMask>; tint: string }[] = [];
  private hlLoops: Float32Array[] = [];
  private borders: { bb: [number, number, number, number]; pts: Float32Array }[] = [];
  dpr = 1;
  stats = { ms: 0, glyphs: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.land = buildLand();
    this.ter = buildFields(this.land);
    this.probe = makeProbe(this.land, this.ter);
    this.ground = buildGround(this.land, this.ter);
    this.shallows = buildShallows(this.land);
    this.scatter = new Scatter(this.probe);
    this.skyScatter = new Scatter(this.probe, 'sky');
    this.seaScatter = new Scatter(this.probe, 'sea');
    this.land.loops.forEach((ls, di) => { if (DEFS[di].float) this.skyLoops[di] = ls; else this.groundLoops.push(...ls); });
    this.floating = new Floating(this.skyLoops);
  }

  setLabels(names: string[]) { this.labels = names; }

  /**
   * Roads between towns (points in map units). `cut` is the same line without the stretch inside each end town's footprint:
   * close up the town's own street plan takes over there.
   */
  setRoads(roads: { kind: Road['kind']; full: number[]; cut: number[] }[]) {
    this.roads = roads.map((r) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < r.full.length; i += 2) { x0 = Math.min(x0, r.full[i]); x1 = Math.max(x1, r.full[i]); y0 = Math.min(y0, r.full[i + 1]); y1 = Math.max(y1, r.full[i + 1]); }
      return { ...r, bb: [x0, y0, x1, y1] as [number, number, number, number] };
    });
  }

  private drawRoads(s: number, view: ViewRect, zoom: number, kinds: Road['kind'][]) {
    const { ctx } = this;
    const a = Math.min(1, Math.max(0, (zoom - 0.24) / 0.12));
    if (a <= 0.02) return;
    const trim = zoom >= 1.0;
    const paths: Record<string, Path2D> = {};
    for (const r of this.roads) {
      if (!kinds.includes(r.kind)) continue;
      if (r.bb[2] < view.x0 || r.bb[0] > view.x1 || r.bb[3] < view.y0 || r.bb[1] > view.y1) continue;
      const pts = trim ? r.cut : r.full;
      if (pts.length < 4) continue;
      const path = paths[r.kind] || (paths[r.kind] = new Path2D());
      path.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
    }
    ctx.save();
    ctx.globalAlpha = a; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const px = (v: number) => v / s;
    if (paths.road) { ctx.strokeStyle = 'rgba(70,48,26,0.55)'; ctx.lineWidth = px(Math.max(2.2, 0.5 * s + 1.2)); ctx.stroke(paths.road); ctx.strokeStyle = '#dcc690'; ctx.lineWidth = px(Math.max(1.1, 0.5 * s)); ctx.stroke(paths.road); }
    if (paths.highway) { ctx.strokeStyle = 'rgba(60,40,22,0.6)'; ctx.lineWidth = px(Math.max(3, 0.8 * s + 1.4)); ctx.stroke(paths.highway); ctx.strokeStyle = '#efe2b4'; ctx.lineWidth = px(Math.max(1.6, 0.8 * s)); ctx.stroke(paths.highway); }
    if (paths.sea) { ctx.setLineDash([px(7), px(6)]); ctx.strokeStyle = 'rgba(232,250,255,0.55)'; ctx.lineWidth = px(1.3); ctx.stroke(paths.sea); ctx.setLineDash([]); }
    if (paths.sky) { ctx.setLineDash([px(3), px(6)]); ctx.strokeStyle = 'rgba(255,242,205,0.75)'; ctx.lineWidth = px(1.4); ctx.stroke(paths.sky); ctx.setLineDash([]); }
    ctx.restore();
  }

  /** built-up areas (map units): the map's own trees, fields and houses stay out of them */
  setTownAreas(areas: { x: number; y: number; rx: number; ry: number }[]) {
    const CELLS = 40, grid = new Map<number, typeof areas>();
    for (const a of areas) {
      for (let gx = Math.floor((a.x - a.rx) / CELLS); gx <= Math.floor((a.x + a.rx) / CELLS); gx++) for (let gy = Math.floor((a.y - a.ry) / CELLS); gy <= Math.floor((a.y + a.ry) / CELLS); gy++) {
        const k = gx * 1000 + gy; const l = grid.get(k); if (l) l.push(a); else grid.set(k, [a]);
      }
    }
    this.scatter.exclude = (x, y) => { const l = grid.get(Math.floor(x / CELLS) * 1000 + Math.floor(y / CELLS)); if (!l) return false; for (const a of l) if (((x - a.x) / a.rx) ** 2 + ((y - a.y) / a.ry) ** 2 < 1) return true; return false; };
    this.scatter.clear();
  }

  /** outline a country (tile mask) with a warm wash; `null` clears it */
  setHighlight(inside: ((i: number) => boolean) | null, w = 0, h = 0, tileMU = 0) {
    this.hlLoops = inside ? traceMask(inside, w, h, tileMU) : [];
  }

  /** the line between countries: every country's outline traced once (inside its own bounding box, so 143 of them stay cheap) */
  setBorders(owner: ArrayLike<number>, w: number, h: number, tileMU: number) {
    const box = new Map<number, [number, number, number, number]>();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const id = owner[y * w + x];
      if (id < 0) continue;
      const b = box.get(id);
      if (!b) box.set(id, [x, y, x, y]); else { if (x < b[0]) b[0] = x; if (x > b[2]) b[2] = x; if (y < b[1]) b[1] = y; if (y > b[3]) b[3] = y; }
    }
    this.borders = [];
    for (const [id, [x0, y0, x1, y1]] of box) {
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      for (const pts of traceMask((i) => owner[(y0 + Math.floor(i / bw)) * w + x0 + (i % bw)] === id, bw, bh, tileMU)) {
        let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
        for (let i = 0; i < pts.length; i += 2) { pts[i] += x0 * tileMU; pts[i + 1] += y0 * tileMU; a = Math.min(a, pts[i]); c = Math.max(c, pts[i]); b = Math.min(b, pts[i + 1]); d = Math.max(d, pts[i + 1]); }
        this.borders.push({ bb: [a, b, c, d], pts });
      }
    }
  }

  /** faint dashed borders, only while countries are the thing to read (continent to city-block zoom) */
  private drawBorders(ground: Path2D, sky: Path2D, s: number, view: ViewRect, zoom: number) {
    const a = Math.min(1, Math.max(0, (zoom - 0.36) / 0.1)) * Math.min(1, Math.max(0, (3.4 - zoom) / 1.2));
    if (a <= 0.02 || !this.borders.length) return;
    const { ctx } = this;
    const loops = this.borders.filter((b) => b.bb[2] >= view.x0 && b.bb[0] <= view.x1 && b.bb[3] >= view.y0 && b.bb[1] <= view.y1).map((b) => ({ def: 0, pts: b.pts, area: 0 }));
    if (!loops.length) return;
    const path = coastPath(loops, s, view);
    ctx.save();
    ctx.lineJoin = 'round'; ctx.globalAlpha = a;
    for (const clip of [ground, sky]) {
      ctx.save(); ctx.clip(clip, 'evenodd');
      ctx.strokeStyle = 'rgba(20,14,6,0.45)'; ctx.lineWidth = 3 / s; ctx.stroke(path);
      ctx.setLineDash([6 / s, 5 / s]); ctx.strokeStyle = 'rgba(228,242,255,0.85)'; ctx.lineWidth = 1.4 / s; ctx.stroke(path); ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.restore();
  }

  setRootHoles(list: { x: number; y: number }[]) { this.landmarks.setRootHoles(list); }
  treeCover(mx: number, my: number) { return this.landmarks.treeCover(mx, my); }

  /** lands the story has reshaped (docs/systems/events/world-events.md §15): a tint over each, in the colour of what became of them */
  setFates(regions: { inside: (i: number) => boolean; tint: string }[], w = 0, h = 0, tileMU = 0) {
    this.fateLoops = regions.map((r) => ({ loops: traceMask(r.inside, w, h, tileMU), tint: r.tint }));
  }

  private drawFates(ground: Path2D, sky: Path2D, s: number, view: ViewRect) {
    if (!this.fateLoops.length) return;
    const { ctx } = this;
    for (const f of this.fateLoops) {
      const path = coastPath(f.loops.map((pts) => ({ def: 0, pts, area: 0 })), s, view);
      for (const clip of [ground, sky]) {
        ctx.save(); ctx.clip(clip, 'evenodd'); ctx.fillStyle = f.tint; ctx.fill(path, 'evenodd'); ctx.restore();
      }
    }
  }

  private fit(w: number, h: number) {
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    const pw = Math.round(w * this.dpr), ph = Math.round(h * this.dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph; }
  }

  private paintGround(path: Path2D) {
    const { ctx } = this;
    ctx.save();
    ctx.clip(path, 'evenodd');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(this.ground, -CELL / 2, -CELL / 2, (GW + 1) * CELL, (GH + 1) * CELL);
    ctx.restore();
  }

  /** symbols, back to front: still parts blit from sprites at device resolution, moving parts (smoke, flags) are drawn live */
  private drawGlyphs(sc: Scatter, view: ViewRect, s: number, v: View, time: number) {
    const { ctx, dpr } = this;
    const placed = this.placed; placed.length = 0;
    sc.collect(view, s, placed, this.alphas);
    placed.sort((a, b) => a.y - b.y);
    const S = dpr * s, { key, ds } = SpriteBank.bucket(S), ratio = S / ds;
    const offx = dpr * (v.w / 2 - (v.cx / MU_TO_WU) * s), offy = dpr * (v.h / 2 - (v.cy / MU_TO_WU) * s);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const p of placed) {
      const sp = this.sprites.get(p.fn, p.u, p.v, key, ds);
      ctx.drawImage(sp.cv, Math.round(p.x * S + offx - sp.ox * ratio), Math.round(p.y * S + offy - sp.oy * ratio), sp.w * ratio, sp.h * ratio);
    }
    ctx.restore();
    const g = { ctx, hair: 1 / s, time, pass: 1 as const };
    for (const p of placed) if (META.get(p.fn)!.anim) p.fn(g, p.x, p.y, p.u, p.r);
    this.stats.glyphs += placed.length;
  }

  private drawHighlight(ground: Path2D, s: number, view: ViewRect) {
    if (!this.hlLoops.length) return;
    const { ctx } = this;
    const path = coastPath(this.hlLoops.map((pts) => ({ def: 0, pts, area: 0 })), s, view);
    ctx.save();
    ctx.clip(ground, 'evenodd');
    ctx.fillStyle = 'rgba(255,238,150,0.26)'; ctx.fill(path, 'evenodd');
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,226,120,0.95)'; ctx.lineWidth = 2.2 / s; ctx.stroke(path);
    ctx.restore();
  }

  /** continent names, crisp at the screen's real resolution; they fade as the camera comes down to country level */
  private drawLabels(v: View, s: number) {
    const a = 1 - Math.min(1, Math.max(0, (v.zoom - 0.3) / 0.28));
    if (a <= 0.02 || !this.labels.length) return;
    const { ctx, dpr } = this;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const size = 30;
    ctx.font = `${size}px Itim, Sarabun, sans-serif`;
    ctx.globalAlpha = a * 0.95;
    CONT_LABELS.forEach((p, i) => {
      const name = this.labels[i];
      if (!name) return;
      const x = v.w / 2 + (p.x - v.cx / MU_TO_WU) * s, y = v.h / 2 + (p.y - v.cy / MU_TO_WU) * s;
      if (x < -200 || x > v.w + 200 || y < -60 || y > v.h + 60) return;
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(24,14,6,0.85)'; ctx.strokeText(name, x, y);
      ctx.fillStyle = '#fff6dc'; ctx.fillText(name, x, y);
    });
    ctx.restore();
  }

  render(v: View, time = 0) {
    const t0 = performance.now();
    this.fit(v.w, v.h);
    const { ctx, dpr } = this;
    const s = v.zoom * MU_TO_WU; // CSS px per MU
    const cx = v.cx / MU_TO_WU, cy = v.cy / MU_TO_WU;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (v.w / 2 - cx * s), dpr * (v.h / 2 - cy * s));
    const pad = 70 / s; // a few symbols' height beyond the screen edge
    const view: ViewRect = { x0: cx - v.w / 2 / s - pad, y0: cy - v.h / 2 / s - pad, x1: cx + v.w / 2 / s + pad, y1: cy + v.h / 2 / s + pad };
    this.stats.glyphs = 0;
    ctx.fillStyle = SEA.deep;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);

    // shallows (stacked wide strokes), foam, then the land itself
    const ground = coastPath(this.groundLoops, s, view);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(this.shallows, -CELL / 2, -CELL / 2, (GW + 1) * CELL, (GH + 1) * CELL);
    this.drawGlyphs(this.seaScatter, view, s, v, time);
    const shore = coastLines(this.groundLoops, s, view);
    const foamPx = Math.max(1.4, Math.min(5, 1.1 * s));
    ctx.lineWidth = (foamPx / s) * 2; ctx.strokeStyle = SEA.foam; ctx.stroke(shore);
    this.paintGround(ground);
    this.drawRoads(s, view, v.zoom, ['road', 'highway', 'sea']);
    this.drawGlyphs(this.scatter, view, s, v, time);
    this.landmarks.drawGround(ctx, s, view, time);
    this.landmarks.drawFog(ctx, view, time, s);
    ctx.lineWidth = 1.3 / s; ctx.strokeStyle = 'rgba(40,30,20,0.75)'; ctx.stroke(shore);

    // the sky islands float above everything else
    this.floating.drawBelow(ctx, s, view, time);
    const sky = new Path2D();
    for (const isl of this.floating.islands) sky.addPath(coastPath(isl.loops, s, view));
    this.paintGround(sky);
    this.drawGlyphs(this.skyScatter, view, s, v, time);
    this.floating.drawLip(ctx, s, view);
    this.drawRoads(s, view, v.zoom, ['sky']);

    this.drawFates(ground, sky, s, view);
    this.drawBorders(ground, sky, s, view, v.zoom);
    this.drawHighlight(ground, s, view);
    this.drawLabels(v, s);
    this.stats.ms = performance.now() - t0;
  }
}
