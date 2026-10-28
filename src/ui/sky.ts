// The sky above the map, drawn on a DOM canvas over the game canvas:
//  • clouds at altitude — they grow faster than the ground while zooming in, so diving toward a town
//    feels like falling through them, then they thin out near ground level
//  • the weather of the country under the camera (rain, snow, sand, fog, storm, ash, heat)
//  • a fog veil used as the transition into and out of a town
import { RNG } from '../sim/rng';

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

export class Sky {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  private sprites = cloudSprites();
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
