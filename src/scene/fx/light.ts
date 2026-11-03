// The light of a beat (`LightMode`) as pixels, and the effects of the god's three powers (20-god-ui.md §1) that ride on a coloured `glow`. Pure, like ./pixels.ts.
// Light is drawn in bands (an even gradient would blur the pixels) and added to the picture; only `dim` covers it.
import type { LightMode } from '../../core/data/types-scenes';
import { ART, GOD, GOD_FX, LIGHT, LIGHT_BANDS } from '../tuning';
import { hexNum, rnd, Sink, type Px } from './pixels';

/**
 * The fixed light of a beat: from the front below (a pass), from behind above (a fail), over all (a tie), in rings from the middle (a glow), or a dimming with a darker rim.
 * `color` is the beat's own colour; a diffuse light takes the colour of the place when it has none.
 */
export function lightPixels(mode: LightMode, color: string | undefined, placeLight: string): Px[] {
  const L = LIGHT[mode];
  const col = hexNum(color ?? (mode === 'diffuse' ? placeLight : L.color));
  const s = new Sink();
  const n = LIGHT_BANDS;
  if (L.from === 'all') {
    s.rect(0, 0, ART.w, ART.h, col, L.alpha, L.add);
    // the dimming is darker at the edges: four steps of a frame
    if (mode === 'dim')
      for (let b = 0; b < 4; b++) {
        const v = 12 - b * 3;
        const h = 24 - b * 6;
        s.rect(0, 0, ART.w, v, col, 0.07, false);
        s.rect(0, ART.h - v, ART.w, v, col, 0.07, false);
        s.rect(0, 0, h, ART.h, col, 0.07, false);
        s.rect(ART.w - h, 0, h, ART.h, col, 0.07, false);
      }
    return s.out;
  }
  if (L.from === 'centre') {
    for (let b = 0; b < n; b++) {
      const k = 1 - b / n;
      s.blob(ART.w / 2, ART.h * 0.55, (ART.w * 0.9 * k) / 2, (ART.h * 1.1 * k) / 2, col, L.alpha / n, L.add, 1);
    }
    return s.out;
  }
  const span = ART.h * 0.7;
  for (let b = 0; b < n; b++) {
    const a = L.alpha * (1 - (b + 0.5) / n);
    const y0 = L.from === 'front' ? ART.h - ((b + 1) * span) / n : (b * span) / n;
    s.rect(0, Math.round(y0), ART.w, Math.ceil(span / n), col, a, L.add);
  }
  return s.out;
}

// ---------- the god's colours ----------

export type God = 'faith' | 'dread' | 'fate';

const rgb = (h: string): [number, number, number] => {
  const n = hexNum(h);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Which power a `glow` colour belongs to, if it is one of the three colours of 20-god-ui.md §1 (within `GOD.near` of it); other glows are just light. */
export function godOf(color: string | undefined): God | null {
  if (!color) return null;
  const c = rgb(color);
  let best: God | null = null;
  let near: number = GOD.near;
  for (const g of ['faith', 'dread', 'fate'] as const) {
    const o = rgb(GOD[g]);
    const d = Math.hypot(c[0] - o[0], c[1] - o[1], c[2] - o[2]);
    if (d <= near) {
      near = d;
      best = g;
    }
  }
  return best;
}

/** How far the rim of the pillar is pushed out or in on a row: two slow waves of different pace, so the edge trembles a row at a time like a flame in the wind. */
function wobble(y: number, t: number, side: number): number {
  const sh = GOD_FX.pillar.shake;
  return Math.round(Math.sin(y * 0.45 + t * 7.5 + side * 2.1) * sh * 0.75 + Math.sin(y * 0.13 - t * 4.3 + side) * sh);
}

function faith(t: number, seed: number, s: Sink): void {
  const P = GOD_FX.pillar;
  const cx = GOD_FX.centre.x;
  const gold = hexNum(GOD.faith);
  const pale = hexNum('#fff2c0');
  const ground = ART.groundY;
  const half = (y: number) => P.top + (P.ground - P.top) * (y / ground);
  // a pillar of light that comes through thick cloud: thin and weak, not a flood, and its rim shakes a row at a time
  for (let y = 0; y < ground; y++) {
    const h = half(y);
    const flick = 0.85 + 0.15 * Math.sin(y * 0.2 + t * 5);
    const l = Math.round(cx - h + wobble(y, t, 0));
    const r = Math.round(cx + h + wobble(y, t, 1));
    s.rect(l, y, r - l, 1, gold, P.alpha * flick, true);
    const cl = Math.round(cx - h / 2 + wobble(y, t, 2) * 0.5);
    const cr = Math.round(cx + h / 2 + wobble(y, t, 3) * 0.5);
    s.rect(cl, y, cr - cl, 1, pale, P.core * flick, true);
  }
  // the pool of light where it lands
  s.blob(cx, ground, P.ground * 2.4, 5, gold, 0.3 + 0.05 * Math.sin(t * 3), true, 3);
  // gold embers rise out of it
  for (let i = 0; i < P.embers; i++) {
    const life = 2.4 + rnd(seed, i, 1) * 2.2;
    const c = t / life + rnd(seed, i, 2);
    const k = Math.floor(c);
    const u = c - k;
    const ph = rnd(seed, i, 3 + k) * 6.3;
    const x = cx + (rnd(seed, i, 4 + k) - 0.5) * 2 * half(ground) + Math.sin(ph + u * 5) * 3;
    const y = ground - 2 - u * life * (14 + rnd(seed, i, 5) * 16);
    s.rect(x, y, 1, 1, u < 0.6 ? pale : gold, (1 - u) ** 0.8 * (0.7 + 0.3 * Math.sin(ph * 3 + t * 8)), true);
  }
}

function dread(t: number, seed: number, s: Sink): void {
  const D = GOD_FX.dread;
  const { x: cx, y: cy } = GOD_FX.centre;
  const red = hexNum(GOD.dread);
  // blood-pork red that goes black in the middle, its edge smoke
  s.blob(cx, cy, D.rx, D.ry, red, 0.38, false, 4);
  s.blob(cx, cy, D.core, D.core * 0.62, 0x0a0206, 0.7, false, 4);
  for (let i = 0; i < D.smoke; i++) {
    const th = (i / D.smoke + rnd(seed, i, 1) * 0.08) * Math.PI * 2 + t * (0.12 + 0.05 * rnd(seed, i, 2));
    const r = 0.85 + 0.2 * rnd(seed, i, 3);
    const rise = ((t * (4 + 4 * rnd(seed, i, 4)) + rnd(seed, i, 5) * 40) % 40) * 0.6;
    const x = cx + Math.cos(th) * D.rx * r;
    const y = cy + Math.sin(th) * D.ry * r - rise + Math.sin(t * 0.9 + i) * 3;
    const rad = 9 + rnd(seed, i, 6) * 9 + 2 * Math.sin(t + i);
    s.blob(x, y, rad, rad * 0.8, i % 2 ? 0x3a0e18 : 0x180610, 0.5 * (1 - rise / 28), false, 3);
  }
}

function fate(t: number, seed: number, s: Sink): void {
  const F = GOD_FX.fate;
  const cx = GOD_FX.centre.x;
  const silver = hexNum(GOD.fate);
  const sway = (k: number, y: number) => Math.round(Math.sin(y * 0.07 + t * 1.6 + k * 1.9) * (1.5 + y * 0.025));
  // silver threads hang from the top of the picture, each swaying; the outer ones are stitched (dashes that crawl down), the middle one is taut
  F.threads.forEach((off, k) => {
    for (let y = 0; y < F.end; y++) {
      if (k !== 1 && (y + Math.floor(t * 9)) % 8 > 5) continue;
      s.rect(cx + off + sway(k, y), y, 1, 1, silver, k === 1 ? 0.85 : 0.5, true);
    }
    // the needle at the end of a thread
    s.rect(cx + off + sway(k, F.end), F.end, 1, 3, 0xffffff, 0.8, true);
  });
  // the ring of the omen is sewn: dashes round an ellipse that move round it
  for (let i = 0; i < F.stitches; i++) {
    if ((i + Math.floor(t * 6)) % 3 === 0) continue;
    const th = (i / F.stitches) * Math.PI * 2;
    s.rect(cx + Math.cos(th) * F.ringRx - 1, GOD_FX.centre.y + 14 + Math.sin(th) * F.ringRy, 2, 1, silver, 0.65, true);
  }
  // loose fibres of the thread drift off it
  for (let i = 0; i < 8; i++) {
    const u = (t * 0.3 + rnd(seed, i, 1)) % 1;
    s.rect(cx + (rnd(seed, i, 2) - 0.5) * 70 + Math.sin(u * 6) * 3, 20 + u * 100, 1, 1, silver, 0.6 * Math.sin(Math.PI * u), true);
  }
}

/** The effects of one of the god's powers at motion time `t`: the pillar of faith light with its shaking rim and rising gold embers, the red and black smoke of dread, the sewn silver thread of fate. */
export function godPixels(god: God, t: number, seed: number): Px[] {
  const s = new Sink();
  if (god === 'faith') faith(t, seed, s);
  else if (god === 'dread') dread(t, seed, s);
  else fate(t, seed, s);
  return s.out;
}
