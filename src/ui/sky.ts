// The sky above the map, drawn on a DOM canvas over the game canvas:
//  • clouds at altitude — they grow faster than the ground while zooming in, so diving toward a town
//    feels like falling through them, then they thin out near ground level
//  • the weather of the country under the camera (rain, snow, sand, fog, storm, ash, heat)
//  • a fog veil used as the transition into and out of a town
import { RNG } from '../sim/rng';
import { leafCluster, leafRng } from '../render/treeart';

export interface SkyView { zoom: number; minZoom: number; maxZoom: number; cx: number; cy: number; W: number; H: number; townZoom: number }
interface Cloud { x: number; y: number; s: number; sprite: number; drift: number }
interface Drop { x: number; y: number; v: number; len: number }

// soft cloud puffs (radial gradients), drawn at their full size so they stay smooth however far the camera dives
function cloudSprites(): HTMLCanvasElement[] {
  const r = new RNG(7);
  const out: HTMLCanvasElement[] = [];
  for (let k = 0; k < 6; k++) {
    const w = 288, h = 132;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d')!;
    for (let i = 0; i < 9; i++) {
      const cx = r.float(48, w - 48), cy = r.float(48, h - 34), rad = r.float(24, 54);
      const g = c.createRadialGradient(cx, cy, rad * 0.15, cx, cy, rad);
      const base = i < 3 ? '214,222,236' : '255,255,255';
      g.addColorStop(0, `rgba(${base},0.95)`); g.addColorStop(0.55, `rgba(${base},0.7)`); g.addColorStop(1, `rgba(${base},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.fill();
    }
    out.push(cv);
  }
  return out;
}

export type PassFx = 'none' | 'leaves' | 'clouds' | 'fog' | 'mist' | 'smoke' | 'embers' | 'steam' | 'sand';

/** soft puffs of one colour, for the haze a camera dives through (smoke, fog, mist, sand) */
function puffSprites(lit: string, shade: string, seed: number, n = 4): HTMLCanvasElement[] {
  const r = new RNG(seed), out: HTMLCanvasElement[] = [];
  for (let k = 0; k < n; k++) {
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240; const c = cv.getContext('2d')!;
    for (let i = 0; i < 12; i++) {
      const cx = r.float(60, 260), cy = r.float(60, 180), rad = r.float(34, 70), g = c.createRadialGradient(cx, cy, rad * 0.1, cx, cy, rad);
      const col = i < 5 ? shade : lit;
      g.addColorStop(0, `rgba(${col},0.85)`); g.addColorStop(0.6, `rgba(${col},0.45)`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.fill();
    }
    out.push(cv);
  }
  return out;
}
/** a bough with its leaves, seen from inside the canopy: the thing the camera passes through under the world tree */
function leafSprites(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let k = 0; k < 5; k++) {
    const cv = document.createElement('canvas'); cv.width = 360; cv.height = 300; const c = cv.getContext('2d')!, rnd = leafRng(31 + k * 17);
    c.strokeStyle = '#4a3322'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(20, 150 + (k % 2) * 40); c.quadraticCurveTo(160, 110 + k * 12, 330, 150 - (k % 3) * 30); c.stroke();
    for (const [x, y, rx, ry] of [[90, 130, 70, 50], [190, 120, 80, 56], [270, 140, 60, 46], [150, 170, 60, 44]] as number[][]) leafCluster(c, x, y + (k % 2) * 20, rx, ry, [0x1f6a34, 0x2e8a40, 0x4aa04e, 0x8acc50, 0x2a7a3a], rnd, 1.1);
    out.push(cv);
  }
  return out;
}

export class Sky {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  private sprites = cloudSprites();
  fx: PassFx = 'none';
  canopy = 0; // how far under the world tree's crown the camera is (0 outside, 1 beneath its middle)
  private ceil: HTMLCanvasElement[] = [];
  private pass: Record<string, HTMLCanvasElement[]> | null = null;
  private passDots: { a: number; r: number; ph: number; s: number }[] = [];
  private clouds: Cloud[] = [];
  private drops: Drop[] = [];
  private fog = 0;
  private fogTarget = 0;
  private fogSpeed = 0.004;
  private flash = 0;
  private t = 0;
  weather = 'clear';
  mode: 'world' | 'city' = 'world';
  view: SkyView | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    const r = new RNG(11);
    for (let i = 0; i < 46; i++) this.clouds.push({ x: r.next(), y: r.next(), s: r.float(0.7, 1.6), sprite: r.int(0, 5), drift: r.float(0.4, 1.2) });
    for (let i = 0; i < 220; i++) this.drops.push({ x: Math.random(), y: Math.random(), v: 0.5 + Math.random(), len: 0.5 + Math.random() });
  }

  // fade the veil to 1 (opaque) or 0; resolves when done
  fogTo(target: number, ms: number): Promise<void> {
    this.fogTarget = target;
    this.fogSpeed = 1 / Math.max(60, ms);
    return new Promise((res) => setTimeout(res, ms));
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  frame(dt: number) {
    this.resize();
    this.t += dt;
    const { ctx, canvas } = this;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const v = this.view;
    // ----- clouds (world view only) -----
    let weatherStrength = 1;
    if (this.mode === 'world' && v) {
      const t = Math.max(0, Math.min(1, (v.zoom - v.minZoom) / (v.townZoom - v.minZoom)));
      const alpha = t < 0.35 ? 0.3 + t * 1.2 : Math.max(0, 0.72 - (t - 0.35) * 2.2);
      const alt = 1 + t * 5; // clouds sit high above the ground: they grow faster as the camera dives
      weatherStrength = Math.max(0, Math.min(1, (t - 0.25) * 2));
      if (alpha > 0.01) {
        ctx.globalAlpha = alpha;
        const wind = this.t * 0.004;
        for (const c of this.clouds) {
          const wx = ((c.x * v.W + wind * c.drift * 60) % v.W + v.W) % v.W, wy = c.y * v.H;
          const z = v.zoom * alt;
          const sx = (wx - v.cx) * z + w / 2, sy = (wy - v.cy) * z + h / 2;
          const sp = this.sprites[c.sprite];
          const sw = sp.width * c.s * z * 0.9, sh = sp.height * c.s * z * 0.9;
          if (sx + sw / 2 < -50 || sx - sw / 2 > w + 50 || sy + sh / 2 < -50 || sy - sh / 2 > h + 50) continue;
          // shadow on the ground, then the cloud
          ctx.globalAlpha = alpha * 0.25;
          ctx.drawImage(sp, sx - sw / 2 + 18 * t, sy - sh / 2 + 30 * t, sw, sh);
          ctx.globalAlpha = alpha;
          ctx.drawImage(sp, sx - sw / 2, sy - sh / 2, sw, sh);
        }
        ctx.globalAlpha = 1;
      }
    }
    if (this.mode === 'world' && v && this.fx !== 'none') this.drawPass(v, w, h);
    // ----- weather -----
    const wx = this.weather;
    if (weatherStrength > 0.02 && wx !== 'clear') this.drawWeather(dt, w, h, weatherStrength);
    // ----- fog veil -----
    if (this.fog !== this.fogTarget) {
      const step = this.fogSpeed * dt;
      this.fog = this.fog < this.fogTarget ? Math.min(this.fogTarget, this.fog + step) : Math.max(this.fogTarget, this.fog - step);
    }
    if (this.fog > 0.01) {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, `rgba(240,244,250,${this.fog})`);
      g.addColorStop(1, `rgba(200,210,224,${this.fog})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /** zooming through a country's own sky: bundles of foliage, cloud, fog or smoke swell past the camera from the middle of the screen outward,
   *  each born a little earlier or later in the dive, so the descent to a town feels like passing through something, not just growing */
  private drawPass(v: SkyView, w: number, h: number) {
    if (!this.pass) {
      this.pass = {
        leaves: leafSprites(), clouds: this.sprites, fog: puffSprites('196,190,226', '120,110,160', 21), mist: puffSprites('232,244,252', '170,200,220', 22),
        smoke: puffSprites('120,112,108', '60,54,52', 23), embers: puffSprites('150,120,110', '70,56,52', 24), steam: puffSprites('226,226,230', '150,150,158', 25), sand: puffSprites('226,198,140', '190,150,90', 26),
      };
      const r = new RNG(77);
      for (let i = 0; i < 22; i++) this.passDots.push({ a: r.float(0, Math.PI * 2), r: r.float(0.2, 1), ph: r.next(), s: r.float(0.7, 1.4) });
    }
    if (this.fx === 'leaves') { this.drawCanopy(v, w, h); return; }
    const lo = 0.75, hi = v.townZoom * 9; // the dive that matters: from the country down to the town
    const p = Math.log(Math.max(v.zoom, lo) / lo) / Math.log(hi / lo);
    if (p <= 0.02 || p >= 0.98) return;
    const amount = Math.pow(Math.sin(Math.PI * p), 1.1) * (this.fx === 'clouds' ? 1 : 0.8);
    const { ctx } = this, set = this.pass[this.fx]; if (!set) return;
    const cx = w / 2, cy = h / 2, R = Math.max(w, h);
    const dots = this.passDots.map((d, i) => ({ ...d, u: (((p * 2.2 + d.ph) % 1) + 1) % 1, i })).sort((a, b) => a.u - b.u);
    for (const d of dots) {
      const sp = set[d.i % set.length], grow = 0.18 + d.u * d.u * 3.6;
      const sw = sp.width * grow * d.s * (R / 900) * 1.5, sh = sp.height * grow * d.s * (R / 900) * 1.5;
      const dist = (0.12 + d.u * 1.5) * d.r * R * 0.55, x = cx + Math.cos(d.a + this.t * 0.0001) * dist, y = cy + Math.sin(d.a + this.t * 0.0001) * dist * 0.8;
      ctx.globalAlpha = Math.min(1, Math.sin(Math.PI * d.u) * 1.5) * amount * 0.7;
      ctx.drawImage(sp, x - sw / 2, y - sh / 2, sw, sh);
    }
    ctx.globalAlpha = 1;
    // a tint over the whole view while inside it: green light under the canopy, white in cloud, grey in smoke
    const tint: Partial<Record<PassFx, string>> = { leaves: '34,92,40', clouds: '240,246,255', fog: '80,70,120', mist: '200,224,240', smoke: '60,54,52', embers: '90,40,20', steam: '210,212,218', sand: '220,184,120' };
    const g = ctx.createRadialGradient(cx, cy, R * 0.18, cx, cy, R * 0.8), t = tint[this.fx];
    if (t) { g.addColorStop(0, `rgba(${t},0)`); g.addColorStop(1, `rgba(${t},${0.34 * amount})`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  }

  /** under the world tree, as a person on the ground sees it: bundles of leaves swing past on the way in, then the canopy closes overhead,
   *  light falls through it in shafts and dapples on the ground, and the odd leaf drifts down. Only where the camera really is beneath the crown. */
  private drawCanopy(v: SkyView, w: number, h: number) {
    const cover = this.canopy;
    if (cover < 0.03) return;
    const { ctx } = this, cx = w / 2, cy = h / 2, R = Math.max(w, h), t = this.t;
    const ss = (a: number, b: number, x: number) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const under = ss(1.7, 4.6, v.zoom) * cover;
    // 1. on the way in: boughs swing past the camera from the middle of the view outward
    const pA = Math.log(Math.max(v.zoom, 0.9) / 0.9) / Math.log(3.4 / 0.9);
    if (pA > 0.02 && pA < 0.98 && this.pass) {
      const set = this.pass.leaves, amount = Math.sin(Math.PI * pA) * cover;
      const dots = this.passDots.map((d, i) => ({ ...d, u: (((pA * 1.9 + d.ph) % 1) + 1) % 1, i })).sort((a, b) => a.u - b.u);
      for (const d of dots) {
        const sp = set[d.i % set.length], grow = 0.16 + d.u * d.u * 3.4;
        const sw = sp.width * grow * d.s * (R / 900) * 1.5, sh = sp.height * grow * d.s * (R / 900) * 1.5, dist = (0.12 + d.u * 1.5) * d.r * R * 0.55;
        ctx.globalAlpha = Math.min(1, Math.sin(Math.PI * d.u) * 1.5) * amount * 0.95;
        ctx.drawImage(sp, cx + Math.cos(d.a) * dist - sw / 2, cy + Math.sin(d.a) * dist * 0.8 - sh / 2, sw, sh);
      }
      ctx.globalAlpha = 1;
    }
    if (under <= 0.01) return;
    // 2. shade: the whole view dims and takes the green of light through leaves
    ctx.fillStyle = `rgba(8,34,14,${0.3 * under})`; ctx.fillRect(0, 0, w, h);
    // the canopy overhead: dense foliage along the top and sides, dark toward the edges, open in the middle where the light comes through
    if (!this.ceil.length) for (let k = 0; k < 4; k++) {
      const cv = document.createElement('canvas'); cv.width = 520; cv.height = 360; const c = cv.getContext('2d')!, rnd = leafRng(91 + k * 13);
      leafCluster(c, 260, 180, 250, 165, [0x0f4a22, 0x1a6a2e, 0x2a8a3c, 0x144e26, 0x4aa04e], rnd, 1.15);
      this.ceil.push(cv);
    }
    ctx.globalAlpha = Math.min(1, under * 1.1);
    const cw = R * 0.5, ch = cw * 0.69, sway = Math.sin(t * 0.0004) * 6;
    for (let i = 0; i < 5; i++) ctx.drawImage(this.ceil[i % 4], (i / 4) * w - cw / 2 + sway * (i % 2 ? 1 : -1), -ch * 0.62, cw, ch);
    for (let i = 0; i < 2; i++) { const sw = cw * 0.7, sh = ch * 0.7; ctx.drawImage(this.ceil[(i + 1) % 4], -sw * 0.62, h * (0.25 + i * 0.42) - sh / 2, sw, sh); ctx.drawImage(this.ceil[(i + 2) % 4], w - sw * 0.38, h * (0.4 - i * 0.22) - sh / 2, sw, sh); }
    ctx.globalAlpha = 1;
    const vg = ctx.createRadialGradient(cx, cy * 1.05, R * 0.22, cx, cy, R * 0.75); vg.addColorStop(0, 'rgba(6,26,10,0)'); vg.addColorStop(1, `rgba(6,26,10,${0.55 * under})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    // light through the leaves: slanting shafts with dust in them, and moving pools of sun on the ground
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) {
      const x0 = (0.06 + k * 0.17) * w + Math.sin(t * 0.00025 + k * 1.7) * 26, wd = 30 + (k % 3) * 24, sl = h * 0.5;
      const g = ctx.createLinearGradient(x0, 0, x0 + sl, h);
      g.addColorStop(0, `rgba(255,244,190,${0.16 * under})`); g.addColorStop(0.65, `rgba(255,240,170,${0.05 * under})`); g.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + wd, 0); ctx.lineTo(x0 + wd + sl, h); ctx.lineTo(x0 + sl, h); ctx.closePath(); ctx.fill();
    }
    for (let k = 0; k < 24; k++) {
      const px = ((k * 0.6180339 + t * 0.000012 * (1 + (k % 3) * 0.4)) % 1) * w, py = (0.3 + ((k * 0.7548776) % 1) * 0.7) * h, rr = (24 + (k % 5) * 12) * (R / 900);
      const g = ctx.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, `rgba(255,246,190,${0.2 * under})`); g.addColorStop(1, 'rgba(255,246,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
    }
    for (let k = 0; k < 30; k++) { // dust and pollen turning in the light
      const px = ((k * 0.3819 + t * 0.00001) % 1) * w, py = ((k * 0.6180339 + t * 0.000025 * (1 + (k % 4) * 0.3)) % 1) * h;
      ctx.fillStyle = `rgba(255,250,200,${0.5 * under})`; ctx.fillRect(px, py, 1.6, 1.6);
    }
    ctx.restore();
    // a few leaves coming down, turning as they fall
    for (let k = 0; k < 12; k++) {
      const f = ((k * 0.4142 + t * 0.00003 * (0.6 + (k % 4) * 0.25)) % 1), x = ((k * 0.7071) % 1) * w + Math.sin(t * 0.0008 + k * 2) * 26 * (R / 900), y = f * h * 1.1 - h * 0.05;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.0012 * (k % 2 ? 1 : -1) + k); ctx.scale(Math.cos(t * 0.002 + k) * 0.6 + 0.7, 1);
      const L = (8 + (k % 3) * 4) * (R / 900) * 1.6;
      ctx.globalAlpha = under * 0.9; ctx.fillStyle = ['#3a8a3a', '#6aaa40', '#c8a030', '#2e7a34'][k % 4];
      ctx.beginPath(); ctx.moveTo(0, -L); ctx.quadraticCurveTo(L * 0.5, -L * 0.1, 0, L); ctx.quadraticCurveTo(-L * 0.5, -L * 0.1, 0, -L); ctx.fill();
      ctx.strokeStyle = 'rgba(20,50,20,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -L * 0.9); ctx.lineTo(0, L * 0.9); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawWeather(dt: number, w: number, h: number, k: number) {
    const { ctx } = this;
    const wx = this.weather;
    const tint: Record<string, string> = { rain: 'rgba(40,60,90,0.18)', storm: 'rgba(20,30,50,0.32)', snow: 'rgba(230,240,255,0.12)', blizzard: 'rgba(230,240,255,0.3)', sandstorm: 'rgba(200,160,90,0.35)', fog: 'rgba(225,230,238,0.42)', heat: 'rgba(255,170,60,0.12)', ashfall: 'rgba(60,50,50,0.28)', cloudy: 'rgba(70,80,95,0.16)' };
    if (tint[wx]) { ctx.fillStyle = tint[wx]; ctx.globalAlpha = k; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    const count = { rain: 160, storm: 220, snow: 120, blizzard: 220, sandstorm: 180, ashfall: 100 }[wx as 'rain'] || 0;
    if (count) {
      ctx.globalAlpha = 0.75 * k;
      for (let i = 0; i < count; i++) {
        const d = this.drops[i];
        if (wx === 'rain' || wx === 'storm') {
          d.y += d.v * dt * 0.0016; d.x += dt * 0.0003;
          ctx.strokeStyle = '#a8c8f0'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(d.x * w, d.y * h); ctx.lineTo(d.x * w - 3, d.y * h + 12 * d.len); ctx.stroke();
        } else if (wx === 'sandstorm') {
          d.x += d.v * dt * 0.0012; d.y += Math.sin(this.t * 0.002 + i) * 0.0004;
          ctx.fillStyle = '#e0c088'; ctx.fillRect(d.x * w, d.y * h, 10 * d.len, 2);
        } else {
          const fast = wx === 'blizzard' ? 2.2 : 1;
          d.y += d.v * dt * 0.00025 * fast; d.x += Math.sin(this.t * 0.001 + i) * 0.0004 + (wx === 'blizzard' ? dt * 0.0006 : 0);
          ctx.fillStyle = wx === 'ashfall' ? '#5a5050' : '#ffffff';
          ctx.fillRect(d.x * w, d.y * h, 3, 3);
        }
        if (d.y > 1) { d.y -= 1; d.x = Math.random(); }
        if (d.x > 1) d.x -= 1;
      }
      ctx.globalAlpha = 1;
    }
    if (wx === 'storm') {
      if (this.flash <= 0 && Math.random() < dt * 0.0004) this.flash = 1;
      if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.55 * k})`; ctx.fillRect(0, 0, w, h); this.flash -= dt * 0.006; }
    }
  }
}
