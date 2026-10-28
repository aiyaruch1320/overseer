// Hand-placed story landmarks drawn live on top of the terrain (few, so they can breathe): the world tree, the nine-axis machine
// ruin at Arkea, the hell rift between Morhaven and Kaz-Durum, the sunken city's whirlpool in Nebulia, and Nebulia's drifting fog.
import type { ViewRect } from './coast';

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
    if (near(view, 265, 280, 110)) { ctx.save(); ctx.translate(265, 282); ctx.scale(1.25, 1.25); this.worldTree(ctx, 0, 0, time, hair / 1.25); ctx.restore(); }
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

  private worldTree(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, hair: number) {
    const pulse = 0.85 + 0.15 * Math.sin(time * 0.8);
    // aura, roots, trunk
    let g = ctx.createRadialGradient(x, y - 16, 4, x, y - 16, 78);
    g.addColorStop(0, `rgba(190,255,150,${0.34 * pulse})`); g.addColorStop(1, 'rgba(190,255,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 16, 78, 0, TAU); ctx.fill();
    ctx.lineCap = 'round';
    for (let k = 0; k < 13; k++) {
      const a = (k / 13) * TAU + 0.4, len = 38 + (k % 4) * 10, bend = (k % 2 ? 1 : -1) * 0.5;
      let px = x, py = y + 2;
      for (let seg = 0; seg < 3; seg++) {
        const aa = a + bend * seg * 0.35, nx = px + Math.cos(aa) * (len / 3), ny = py + Math.sin(aa) * (len / 3) * 0.55 + 1.2;
        ctx.strokeStyle = seg < 2 ? '#4a3322' : '#5c4330'; ctx.lineWidth = 3.4 - seg * 1.1;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
        px = nx; py = ny;
      }
    }
    ctx.fillStyle = '#5b4030'; ctx.beginPath(); ctx.moveTo(x - 9, y + 4); ctx.quadraticCurveTo(x - 6, y - 12, x - 5, y - 24); ctx.lineTo(x + 5, y - 24); ctx.quadraticCurveTo(x + 6, y - 12, x + 9, y + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a5a40'; ctx.fillRect(x - 2, y - 22, 3, 24);
    // canopy: three layers of overlapping crowns
    const crowns: [number, number, number][] = [[-26, -34, 16], [26, -34, 16], [0, -28, 20], [-34, -52, 15], [34, -52, 15], [-14, -58, 18], [14, -58, 18], [0, -74, 19], [-22, -74, 14], [22, -74, 14]];
    for (const [dx, dy, r] of crowns) { ctx.fillStyle = '#1f5f2e'; ctx.beginPath(); ctx.arc(x + dx + 1.5, y + dy + 2.5, r, 0, TAU); ctx.fill(); }
    for (const [dx, dy, r] of crowns) { ctx.fillStyle = '#2f8a3f'; ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, TAU); ctx.fill(); }
    for (const [dx, dy, r] of crowns) { ctx.fillStyle = 'rgba(170,240,120,0.55)'; ctx.beginPath(); ctx.arc(x + dx - r * 0.25, y + dy - r * 0.3, r * 0.55, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(15,45,20,0.55)'; ctx.lineWidth = hair;
    for (const [dx, dy, r] of crowns) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, TAU); ctx.stroke(); }
    // motes of light drifting up
    for (let k = 0; k < 16; k++) {
      const t = (time * 0.07 + k * 0.137) % 1, a = k * 2.4;
      ctx.fillStyle = `rgba(255,252,190,${0.85 * (1 - t)})`;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * (14 + 30 * t) , y - 40 - 55 * t + Math.sin(a + time) * 3, 1.1 + (k % 3) * 0.3, 0, TAU); ctx.fill();
    }
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
