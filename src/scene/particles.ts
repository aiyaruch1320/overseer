// Particles of a scene, drawn in code (art comes in M6 to M7): ash, embers, snow, rain, leaves, dust, fog, motes, smoke, sparks, petals,
// water, feathers. A particle's place is a function of its number and the time, never of a random call, so a frame is the same every time.
import type { FxKind } from '../core/data/types-scenes';
import { FX } from './tuning';

/** A fixed pseudo-random number in [0, 1) from two integers (a small integer hash, no state). */
export function hash01(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export interface Particle {
  /** 0 to 1 across the stage. */
  x: number;
  y: number;
  /** Radius as a share of the stage height. */
  r: number;
  a: number;
  /** For rain and sparks: the length of the streak as a share of the stage height. */
  len: number;
}

interface Look {
  color: string;
  /** Fall (+1), rise (−1) or drift (0) and how fast, in stage heights per second. */
  fall: number;
  sway: number;
  r: [number, number];
  a: [number, number];
  len?: number;
}

export const LOOK: Record<FxKind, Look> = {
  ash: { color: '#b8b4ac', fall: 0.06, sway: 0.03, r: [0.002, 0.005], a: [0.4, 0.9] },
  embers: { color: '#ff9a3a', fall: -0.12, sway: 0.03, r: [0.002, 0.005], a: [0.5, 1] },
  snow: { color: '#f0f4fa', fall: 0.08, sway: 0.025, r: [0.002, 0.006], a: [0.6, 1] },
  rain: { color: '#a8c4e8', fall: 0.9, sway: 0, r: [0.001, 0.0015], a: [0.35, 0.7], len: 0.05 },
  leaves: { color: '#6aa05a', fall: 0.07, sway: 0.08, r: [0.004, 0.008], a: [0.6, 1] },
  dust: { color: '#c8b48a', fall: 0.01, sway: 0.1, r: [0.0015, 0.004], a: [0.3, 0.7] },
  fog: { color: '#d4d6dc', fall: 0, sway: 0.05, r: [0.12, 0.22], a: [0.04, 0.1] },
  motes: { color: '#fff2c0', fall: -0.03, sway: 0.03, r: [0.002, 0.005], a: [0.4, 1] },
  smoke: { color: '#6a6a72', fall: -0.05, sway: 0.04, r: [0.03, 0.07], a: [0.08, 0.2] },
  sparks: { color: '#ffd070', fall: -0.35, sway: 0.05, r: [0.001, 0.003], a: [0.7, 1], len: 0.02 },
  petals: { color: '#f0b8c8', fall: 0.06, sway: 0.07, r: [0.003, 0.006], a: [0.6, 1] },
  water: { color: '#6aa8d8', fall: -0.04, sway: 0.06, r: [0.003, 0.008], a: [0.3, 0.7] },
  feathers: { color: '#f0eadc', fall: 0.04, sway: 0.06, r: [0.003, 0.007], a: [0.5, 0.9] },
};

const wrap = (v: number) => v - Math.floor(v);

/** The particles of one kind at motion time `t` (seconds); `seed` makes two scenes of the same kind differ. */
export function particlesAt(kind: FxKind, amount: number, seed: number, t: number): Particle[] {
  const look = LOOK[kind];
  const n = Math.max(0, Math.round(amount * (kind === 'fog' || kind === 'smoke' ? FX.fogPerAmount : FX.perAmount)));
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = hash01(seed + i, 1);
    const y0 = hash01(seed + i, 2);
    const ph = hash01(seed + i, 3) * Math.PI * 2;
    const sp = 0.6 + hash01(seed + i, 4) * 0.8;
    const y = look.fall === 0 ? y0 : wrap(y0 + look.fall * sp * t);
    const x = wrap(x0 + (look.fall === 0 ? 0.02 * sp * t : 0) + look.sway * Math.sin(ph + t * sp * 0.8));
    out.push({ x, y, r: look.r[0] + (look.r[1] - look.r[0]) * hash01(seed + i, 5), a: look.a[0] + (look.a[1] - look.a[0]) * hash01(seed + i, 6), len: look.len ?? 0 });
  }
  return out;
}

/** A number from a text, to seed the particles of a scene by its id. */
export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}

/** Draws the particles of every active kind on a canvas of the stage's size. */
export function drawFx(ctx: CanvasRenderingContext2D, w: number, h: number, fx: { kind: FxKind; amount: number; color?: string }[], motion: number, seed: number): void {
  ctx.clearRect(0, 0, w, h);
  fx.forEach((f, k) => {
    const look = LOOK[f.kind];
    ctx.fillStyle = f.color ?? look.color;
    ctx.strokeStyle = f.color ?? look.color;
    for (const p of particlesAt(f.kind, f.amount, seed + k * 977, motion)) {
      ctx.globalAlpha = p.a;
      if (p.len > 0) {
        ctx.lineWidth = Math.max(1, p.r * h);
        ctx.beginPath();
        ctx.moveTo(p.x * w, p.y * h);
        ctx.lineTo(p.x * w - p.len * h * 0.12, p.y * h + p.len * h);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, Math.max(1, p.r * h), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  ctx.globalAlpha = 1;
}
