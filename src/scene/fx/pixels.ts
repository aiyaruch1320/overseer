// The pixels of the effects of a scene (M7 ก3): what is on the 320 × 180 picture at motion time `t`, as a list of rectangles of whole art pixels. A pure function of the
// list of effects, the seed and `Frame.motion`: no clock, no state, no Phaser. So a frame draws the same picture at any speed and after a skip, and the clock of the
// particles stops under a `hold` beat (the frame's motion stops, and so does every particle). The stage (../stage/controller.ts) draws the list; the tests read it in Node.
import type { FxKind } from '../../core/data/types-scenes';
import { AMBIENT, ART, FX_GRAVITY, FX_LOOK, FX_PAD, type FxLook } from '../tuning';

/** One rectangle of the picture in whole art pixels, inside 0..320 × 0..180. `add` is light (added to what is behind it); otherwise it covers. */
export interface Px {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  alpha: number;
  add: boolean;
}

/** One effect that is on: the kind, how much of it (0 to 1, the beat's `amount`), the beat's own colour if it has one, a share of strength (the place's faint ambient). */
export interface FxItem {
  kind: FxKind;
  amount: number;
  color?: string;
  fade?: number;
}

export const hexNum = (s: string): number => parseInt(s.replace('#', '').slice(0, 6), 16) || 0;

/** A fixed pseudo-random number in [0, 1) from three integers (no state: the same three give the same number). */
export function rnd(a: number, b: number, c = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ b, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h ^ c, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export const lerp = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
const mod = (a: number, m: number): number => ((a % m) + m) % m;

/** Collects rectangles, cut to the picture (a rectangle wholly outside is dropped). */
export class Sink {
  readonly out: Px[] = [];
  rect(x: number, y: number, w: number, h: number, color: number, alpha: number, add: boolean): void {
    if (alpha <= 0.01) return;
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(ART.w, Math.round(x + w));
    const y1 = Math.min(ART.h, Math.round(y + h));
    if (x1 <= x0 || y1 <= y0) return;
    this.out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, color, alpha: Math.min(1, alpha), add });
  }
  /** A soft ellipse as a few nested bands (a cel look: even gradients blur the pixels). Each band adds `alpha / levels`; the middle is the strongest. */
  blob(cx: number, cy: number, rx: number, ry: number, color: number, alpha: number, add: boolean, levels = 3): void {
    for (let l = 0; l < levels; l++) {
      const k = 1 - (l / levels) * 0.62;
      const a = rx * k;
      const b = Math.max(1, ry * k);
      const top = Math.ceil(cy - b);
      const bottom = Math.floor(cy + b);
      for (let y = top; y <= bottom; y++) {
        const q = (y + 0.5 - cy) / b;
        if (q * q >= 1) continue;
        const half = a * Math.sqrt(1 - q * q);
        this.rect(cx - half, y, half * 2, 1, color, alpha / levels, add);
      }
    }
  }
}

// ---------- one tumbling piece (leaf, petal, feather): its shape turns through four frames as it falls ----------

function tumble(s: Sink, x: number, y: number, frame: number, len: number, c1: number, c2: number, a: number): void {
  switch (frame & 3) {
    case 0:
      s.rect(x, y, len, 1, c1, a, false);
      break;
    case 1:
      s.rect(x, y, len - 1, 1, c1, a, false);
      s.rect(x + len - 1, y + 1, 1, 1, c2, a, false);
      break;
    case 2:
      s.rect(x, y, 1, Math.max(2, len - 1), c1, a, false);
      s.rect(x + 1, y + 1, 1, 1, c2, a, false);
      break;
    default:
      s.rect(x, y + 1, len - 1, 1, c1, a, false);
      s.rect(x, y, 1, 1, c2, a, false);
  }
}

// ---------- the models ----------

type Ctx = { s: Sink; look: FxLook; n: number; t: number; seed: number; fade: number; colors: number[]; add: boolean };

/** The number of one particle's colour, from a palette, by a number in [0, 1). */
const pick = (cs: number[], u: number): number => cs[Math.min(cs.length - 1, Math.floor(u * cs.length))];

function drift(c: Ctx): void {
  const { s, look, n, t, seed, fade, colors } = c;
  const W = ART.w + FX_PAD * 2;
  const H = ART.h + FX_PAD * 2;
  for (let i = 0; i < n; i++) {
    const R = (k: number) => rnd(seed, i * 16 + k);
    const d = R(0); // nearness: near ones are quicker, brighter, bigger
    const sp = 0.6 + 0.8 * d;
    const ph = R(3) * Math.PI * 2;
    const vy = lerp(look.vy, R(4)) * sp;
    const vx = lerp(look.vx, R(5)) * sp;
    const y = mod(R(2) * H + vy * t, H) - FX_PAD;
    const x = mod(R(1) * W + vx * t + look.sway[0] * Math.sin(ph + look.sway[1] * t * sp), W) - FX_PAD;
    const col = pick(colors, R(6));
    let a = lerp(look.alpha, d) * fade;
    switch (look.shape) {
      case 'dot': {
        const big = d > 0.9 ? look.size[1] : 1;
        s.rect(x, y, big, big, col, a, c.add);
        break;
      }
      case 'streak': {
        // a slanted streak: the head, and a tail up and to the right (the rain falls to the left)
        const len = Math.round(look.size[0] + (look.size[1] - look.size[0]) * d);
        const half = Math.ceil(len / 2);
        s.rect(x, y, 1, half, col, a, c.add);
        s.rect(x + 1, y - (len - half), 1, len - half, col, a * 0.7, c.add);
        break;
      }
      case 'tumble': {
        const frame = Math.floor(ph + t * (1.4 + R(7)));
        tumble(s, x, y, frame, look.size[0], col, pick(colors, (R(6) + 0.37) % 1), a);
        break;
      }
      case 'twinkle': {
        a *= 0.55 + 0.45 * Math.sin(ph * 2 + t * (1.5 + 2 * R(7)));
        s.rect(x, y, 1, 1, col, a, c.add);
        // the brightest motes carry a faint cross of light
        if (c.add && d > 0.55 && a > 0.75) {
          s.rect(x - 1, y, 3, 1, col, a * 0.3, true);
          s.rect(x, y - 1, 1, 3, col, a * 0.3, true);
        }
        break;
      }
    }
  }
}

/** Embers: born low, drift up while they cool from white-yellow through orange to dull red, and die; each birth is somewhere else. */
function ember(c: Ctx): void {
  const { s, look, n, t, seed, fade, colors } = c;
  for (let i = 0; i < n; i++) {
    const R = (k: number, cycle = 0) => rnd(seed, i * 16 + k, cycle);
    const life = lerp(look.life, R(0));
    const cyc = t / life + R(1);
    const k = Math.floor(cyc);
    const u = cyc - k;
    const tau = u * life;
    const ph = R(4, k) * Math.PI * 2;
    const x = R(2, k) * ART.w + lerp(look.vx, R(5)) * tau + look.sway[0] * Math.sin(ph + look.sway[1] * tau);
    const y = ART.groundY + 6 + R(3, k) * 20 + lerp(look.vy, R(6)) * tau;
    const flick = 0.75 + 0.25 * Math.sin(ph * 3 + t * 9);
    const big = R(7) > 0.85 ? look.size[1] : 1;
    s.rect(x, y, big, big, pick(colors, u), lerp(look.alpha, R(8)) * (1 - u) ** 0.7 * flick * fade, c.add);
  }
}

/** Sparks: showers from a point, thrown up in a fan and pulled back by gravity, a pixel with a tail, cooling from white to ember red. Groups of seven share a point and a beat. */
function burst(c: Ctx): void {
  const { s, look, n, t, seed, fade, colors } = c;
  const G = FX_GRAVITY.sparks;
  const groups = Math.max(1, Math.round(n / 7));
  for (let i = 0; i < n; i++) {
    const g = i % groups;
    const life = lerp(look.life, rnd(seed, 900 + g, 1));
    const cyc = t / life + rnd(seed, 900 + g, 2);
    const k = Math.floor(cyc);
    const u = cyc - k - rnd(seed, i * 16 + 5) * 0.1;
    if (u < 0) continue;
    const ox = (0.12 + 0.76 * rnd(seed, 900 + g, k + 7)) * ART.w;
    const oy = ART.groundY - 4 - rnd(seed, 900 + g, k + 11) * 14;
    const ang = -Math.PI / 2 + (rnd(seed, i * 16 + 6, k) - 0.5) * Math.PI * 0.9;
    const speed = 45 + rnd(seed, i * 16 + 7, k) * 85;
    const at = (tau: number) => [ox + Math.cos(ang) * speed * tau, oy + Math.sin(ang) * speed * tau + 0.5 * G * tau * tau] as const;
    const tau = u * life;
    const [x, y] = at(tau);
    const col = pick(colors, u);
    const a = lerp(look.alpha, rnd(seed, i * 16 + 8)) * (1 - u) ** 0.6 * fade;
    s.rect(x, y, 1, 1, col, a, c.add);
    const [x2, y2] = at(Math.max(0, tau - 0.05));
    s.rect(x2, y2, 1, 1, col, a * 0.5, c.add);
  }
}

/** A fountain: droplets thrown up from a few feet on the ground, falling back in the same arcs again and again. */
function spray(c: Ctx): void {
  const { s, look, n, t, seed, fade, colors } = c;
  const G = FX_GRAVITY.water;
  const feet = Math.max(1, Math.round(n / 10));
  for (let i = 0; i < n; i++) {
    const R = (k: number) => rnd(seed, i * 16 + k);
    const g = i % feet;
    const ox = (0.15 + 0.7 * rnd(seed, 950 + g, 0)) * ART.w;
    const oy = ART.groundY - 2 - rnd(seed, 950 + g, 1) * 6;
    const ang = (R(2) - 0.5) * 0.7;
    const speed = 70 + R(3) * 60;
    const vy = -Math.cos(ang) * speed;
    const life = (2 * -vy) / G;
    const u = mod(t / life + R(1), 1);
    const tau = u * life;
    const x = ox + Math.sin(ang) * speed * tau;
    const y = oy + vy * tau + 0.5 * G * tau * tau;
    const a = lerp(look.alpha, R(4)) * Math.min(1, u * 12) * fade;
    s.rect(x, y, 1, 1, pick(colors, R(5)), a, c.add);
    // a drop going up leaves a faint mark behind it
    if (tau < life * 0.5) s.rect(x, y + 1, 1, 1, pick(colors, R(5)), a * 0.4, c.add);
  }
}

/** Smoke: soft blobs that rise from a few fixed feet, grow, thin out and are gone. */
function plume(c: Ctx): void {
  const { s, look, n, t, seed, fade, colors } = c;
  const feet = Math.max(1, Math.round(n / 4));
  for (let i = 0; i < n; i++) {
    const R = (k: number) => rnd(seed, i * 16 + k);
    const g = i % feet;
    const ox = (0.1 + 0.8 * rnd(seed, 980 + g, 0)) * ART.w;
    const oy = ART.groundY - 4 - rnd(seed, 980 + g, 1) * 14;
    const life = lerp(look.life, R(0));
    const u = mod(t / life + R(1), 1);
    const tau = u * life;
    const ph = R(4) * Math.PI * 2;
    const x = ox + lerp(look.vx, R(5)) * tau + look.sway[0] * Math.sin(ph + look.sway[1] * tau) * (0.4 + u);
    const y = oy + lerp(look.vy, R(6)) * tau;
    const r = lerp(look.size, u) * (0.8 + 0.4 * R(7));
    const a = lerp(look.alpha, R(8)) * Math.sin(Math.PI * u) ** 0.8 * fade;
    s.blob(x, y, r, r * 0.8, pick(colors, R(9)), a, c.add);
  }
}

/** Fog: wide soft strips low in the picture, sliding slowly sideways. */
function band(c: Ctx): void {
  const { s, look, n, t, seed, fade, colors } = c;
  for (let i = 0; i < n; i++) {
    const R = (k: number) => rnd(seed, i * 16 + k);
    const hw = lerp(look.size, R(0));
    const span = ART.w + hw * 2;
    const x = mod(R(1) * span + lerp(look.vx, R(2)) * t, span) - hw;
    const y = 92 + R(3) * 78 + 2 * Math.sin(R(4) * 6.3 + t * 0.2);
    s.blob(x, y, hw, 6 + R(5) * 8, pick(colors, R(6)), lerp(look.alpha, R(7)) * fade, c.add, 3);
  }
}

const MODEL: Record<FxLook['model'], (c: Ctx) => void> = { drift, ember, burst, spray, plume, band };

/** The pixels of one effect at motion time `t`; `seed` makes two effects of the same kind (or two scenes) differ. */
function one(item: FxItem, t: number, seed: number, s: Sink): void {
  const look = FX_LOOK[item.kind];
  const amount = Math.max(0, Math.min(2, item.amount));
  if (amount <= 0) return;
  const n = Math.max(look.model === 'drift' ? 4 : 1, Math.round(amount * look.count));
  const colors = (item.color ? [item.color] : look.colors).map(hexNum);
  MODEL[look.model]({ s, look, n, t, seed, fade: item.fade ?? 1, colors, add: look.add });
}

/**
 * Every pixel of the effects on at motion time `t`: the place's own `ambient` first and faintly (when it names an effect; "gulls", "clouds" and the rest are not particles),
 * then each of the beats' effects. Same arguments, same list.
 */
export function fxPixels(items: readonly FxItem[], t: number, seed: number, ambient?: string): Px[] {
  const s = new Sink();
  const all: FxItem[] = [];
  if (isFx(ambient)) all.push({ kind: ambient, amount: AMBIENT.amount, fade: AMBIENT.alpha });
  all.push(...items);
  all.forEach((item, k) => one(item, t, (seed + k * 977) | 0, s));
  return s.out;
}

/** Whether a name (the scenery's `ambient`) is an effect the stage can draw. */
export const isFx = (name: string | undefined): name is FxKind => !!name && Object.hasOwn(FX_LOOK, name);
