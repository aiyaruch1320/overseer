// The light of a beat (`LightMode`) as pixels, and the effects of the god's three powers (20-god-ui.md §1) that ride on a coloured `glow`. Pure, like ./pixels.ts.
// Light is drawn in bands (an even gradient would blur the pixels) and added to the picture; only `dim` covers it.
import type { LightMode } from '../../core/data/types-scenes';
import { ART, GOD, GOD_FX, GOD_VARIANT, LIGHT, LIGHT_BANDS, LIGHT_WASH, type GodVariant } from '../tuning';
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
    // the dimming is darker at the edges, a smooth fall of one pixel per step (stepped bands showed as vertical stripes at the sides)
    if (mode === 'dim') {
      for (let i = 0; i < 24; i++) {
        const a = 0.26 * Math.pow(1 - i / 24, 2);
        s.rect(i, 0, 1, ART.h, col, a, false);
        s.rect(ART.w - 1 - i, 0, 1, ART.h, col, a, false);
      }
      for (let i = 0; i < 12; i++) {
        const a = 0.26 * Math.pow(1 - i / 12, 2);
        s.rect(0, i, ART.w, 1, col, a, false);
        s.rect(0, ART.h - 1 - i, ART.w, 1, col, a, false);
      }
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
  // a wash of the light's colour over the whole picture too, so a warm scene reads warm and a cold one cold at a glance (the bands alone sat on one end of the picture)
  s.rect(0, 0, ART.w, ART.h, col, L.alpha * LIGHT_WASH, L.add);
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

/**
 * The pillar of MR-04 (20-god-ui §7.3: "ลำแสงทองกว้างเท่าลานเมืองตกนิ่ง ผีลอยออกจากหลุมศพเป็นควันขาวหนีไปขอบเมือง"): gold (#e8c36a, the colour of faith), a third of the picture
 * wide, with a bright rim that shimmers a row at a time, a pool of light where it lands, gold motes, and from the second half white wisps that leave the foot of it for the edges of the town.
 */
function beam(t: number, seed: number, s: Sink): void {
  const B = GOD_FX.beam;
  const cx = GOD_FX.centre.x;
  const gold = hexNum(GOD.faith);
  const pale = hexNum('#fff2c0');
  const ground = ART.groundY;
  const half = (y: number) => B.top + (B.ground - B.top) * (y / ground);
  const open = Math.min(1, t / B.open);
  for (let y = 0; y < ground; y++) {
    const h = half(y) * (0.4 + 0.6 * open);
    const flick = 0.88 + 0.12 * Math.sin(y * 0.2 + t * 5);
    const l = Math.round(cx - h + wobble(y, t, 0));
    const r = Math.round(cx + h + wobble(y, t, 1));
    // the body is gold laid over the sky (covering, so it stays gold and does not wash to white), the core is added light
    s.rect(l, y, r - l, 1, gold, B.body * flick, false);
    // a softer halo of light round it (added: it warms the sky beside the beam instead of greying it)
    s.rect(Math.round(l - h * 0.35), y, l - Math.round(l - h * 0.35), 1, gold, 0.16 * flick, true);
    s.rect(r, y, Math.round(r + h * 0.35) - r, 1, gold, 0.16 * flick, true);
    const cl = Math.round(cx - h * 0.55 + wobble(y, t, 2) * 0.5);
    const cr = Math.round(cx + h * 0.55 + wobble(y, t, 3) * 0.5);
    s.rect(cl, y, cr - cl, 1, pale, B.core * flick, true);
    // the rim: two bright pixels each side that flicker on and off along the height (shimmer)
    const lit = (side: number) => (Math.sin(y * 0.9 + t * 9 + side * 1.7) > -0.35 ? 1 : 0.35);
    s.rect(l, y, 2, 1, pale, B.rim * lit(0), true);
    s.rect(r - 2, y, 2, 1, pale, B.rim * lit(1), true);
    s.rect(l - 1, y, 1, 1, gold, B.rim * 0.7 * lit(2), false);
    s.rect(r, y, 1, 1, gold, B.rim * 0.7 * lit(3), false);
  }
  // slow lighter streaks slide down inside it
  for (let i = 0; i < 6; i++) {
    const u = (t * (0.18 + 0.05 * rnd(seed, i, 1)) + rnd(seed, i, 2)) % 1;
    const x = cx + (rnd(seed, i, 3) - 0.5) * 2 * half(u * ground) * 0.8;
    s.rect(x, u * ground, 1, 14 + rnd(seed, i, 4) * 12, pale, 0.28, true);
  }
  // the pool of light where it lands
  s.blob(cx, ground, B.ground * 1.5, 7, gold, 0.5 + 0.06 * Math.sin(t * 3), false, 3);
  s.blob(cx, ground, B.ground * 1.1, 4, pale, 0.4, true, 3);
  // gold motes rise out of it
  for (let i = 0; i < B.motes; i++) {
    const life = 2.4 + rnd(seed, i, 1) * 2.4;
    const c = t / life + rnd(seed, i, 2);
    const k = Math.floor(c);
    const u = c - k;
    const ph = rnd(seed, i, 3 + k) * 6.3;
    const x = cx + (rnd(seed, i, 4 + k) - 0.5) * 2 * half(ground) + Math.sin(ph + u * 5) * 3;
    const y = ground - 2 - u * life * (14 + rnd(seed, i, 5) * 18);
    s.rect(x, y, 1, 1, u < 0.6 ? pale : gold, (1 - u) ** 0.8 * (0.7 + 0.3 * Math.sin(ph * 3 + t * 9)), true);
  }
  // the dead rise out of their graves as white smoke and leave for the edge of the town
  if (t >= B.wispsAt)
    for (let i = 0; i < B.wisps; i++) {
      const u = ((t - B.wispsAt) * (0.09 + 0.04 * rnd(seed, i, 7)) + rnd(seed, i, 8)) % 1;
      const side = i % 2 ? 1 : -1;
      const x0 = cx + (rnd(seed, i, 9) - 0.5) * B.ground * 1.6;
      const x = x0 + side * u * (60 + rnd(seed, i, 10) * 70);
      const y = ground - 6 - u * (22 + rnd(seed, i, 11) * 30) + Math.sin(u * 9 + i) * 3;
      const r = 3 + u * 5 + rnd(seed, i, 12) * 2;
      s.blob(x, y, r, r * 1.3, 0xeeeae4, 0.55 * Math.sin(Math.PI * u) ** 0.7, false, 3);
    }
}

/**
 * The shooting star of MR-17 (20-god-ui §7.3, 11-world-changes §1.2): a blood-pork red star that grows every night, then falls into the middle of the town with a tail of smoke, one white frame
 * where it lands, the round wave of dust that sweeps out, and the black crater with its glass rim that stays. Before and after the fall there is no red wash: the star is a star.
 */
function meteor(t: number, seed: number, s: Sink): void {
  const M = GOD_FX.meteor;
  const red = hexNum('#d8362e');
  const [sx, sy] = M.from;
  const [ix, iy] = M.land;
  const grow = Math.min(1, t / M.fallAt);
  const fall = Math.max(0, Math.min(1, (t - M.fallAt) / (M.hitAt - M.fallAt)));
  const at = (p: number) => [sx + (ix - sx) * p ** 1.7, sy + (iy - sy) * p ** 1.7] as const;
  if (t < M.hitAt) {
    const [x, y] = at(fall);
    const r = M.r0 + (M.r1 - M.r0) * grow ** 1.4;
    // the tail: grey smoke blobs left behind along the path, wider and fainter the older they are, with fire at the head
    if (fall > 0)
      for (let i = 1; i <= M.tail; i++) {
        const [tx, ty] = at(Math.max(0, fall - i * 0.018));
        const k = i / M.tail;
        s.blob(tx + Math.sin(i * 1.9 + t * 2) * 1.5, ty, r * (0.7 + k * 1.6), r * (0.6 + k * 1.2), i % 2 ? 0x6a5a5a : 0x8a7a76, 0.8 * (1 - k * 0.7), false, 2);
        if (i < 5) s.blob(tx, ty, r * (1.3 - k), r * (1.1 - k), 0xff8a3a, 0.35 * (1 - k), true, 2);
      }
    // a halo that breathes, then the red star: a core with a pale heart (visible on a day sky: it covers, it does not only add)
    s.blob(x, y, r * 3.2, r * 3.2, red, (0.28 + 0.06 * Math.sin(t * 3)) * (0.5 + 0.5 * grow), true, 4);
    s.blob(x, y, r * 1.5, r * 1.5, 0x8a1a1e, 0.9, false, 3);
    s.blob(x, y, r, r, red, 1, false, 2);
    s.blob(x, y, r * 0.45, r * 0.45, 0xffd8b8, 1, false, 1);
    return;
  }
  const tau = t - M.hitAt;
  // one white frame (a tenth of a second, so it is never missed and never a flood)
  if (tau < M.flash) s.rect(0, 0, ART.w, ART.h, 0xffffff, 0.95 * (1 - tau / M.flash) ** 0.5, false);
  // the round wave of dust: a ring that grows along the ground and thins
  for (let w = 0; w < 2; w++) {
    const k = tau - w * 0.5;
    if (k <= 0 || k > M.wave) continue;
    const rx = 12 + k * M.waveSpeed;
    const ry = Math.max(2, rx * 0.16);
    const a = 0.7 * (1 - k / M.wave);
    const n = 90;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      s.rect(ix + Math.cos(th) * rx - 1, iy + 6 + Math.sin(th) * ry - (Math.sin(th) < 0 ? 2 : 0), 3, 3, 0xcfc0a0, a, false);
    }
  }
  // the crater: opens over a second, black, a rim of glass that glints, embers deep in it
  const open = Math.min(1, tau / 1.2);
  const rx = M.crater.rx * open;
  const ry = M.crater.ry * open;
  s.blob(ix, iy + 8, rx * 1.12, ry * 1.2, 0x1a1218, 0.95, false, 4);
  s.blob(ix, iy + 8, rx * 0.8, ry * 0.8, 0x050306, 1, false, 4);
  s.blob(ix, iy + 9, rx * 0.5, ry * 0.5, 0xff5a2a, 0.12 + 0.04 * Math.sin(t * 4), true, 3);
  for (let i = 0; i < 40; i++) {
    const th = (i / 40) * Math.PI * 2;
    const glint = Math.sin(t * 3 + i * 2.3) > 0.55;
    s.rect(ix + Math.cos(th) * rx * 1.12, iy + 8 + Math.sin(th) * ry * 1.2, 2, 1, glint ? 0xdadae8 : 0x2a2a38, glint ? 0.95 : 0.8, false);
  }
  // smoke climbs out of the hole
  for (let i = 0; i < 8; i++) {
    const u = (t * 0.12 + rnd(seed, i, 1)) % 1;
    const x = ix + (rnd(seed, i, 2) - 0.5) * rx * 1.4 + Math.sin(u * 7 + i) * 4;
    const y = iy + 4 - u * 46;
    const r = 5 + u * 9;
    s.blob(x, y, r, r * 0.8, 0x3a3236, 0.5 * Math.sin(Math.PI * u) ** 0.7 * open, false, 2);
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

/** The special effect of a miracle by the name of its place (the `bg` beat of a miracle's script is the miracle's name): the shooting star, the wide gold beam. Others have none. */
export function variantOf(place: string): GodVariant | undefined {
  return GOD_VARIANT[place];
}

/** The effects of one of the god's powers at motion time `t`: the pillar of faith light with its shaking rim and rising gold embers, the red and black smoke of dread, the sewn silver thread of fate. */
export function godPixels(god: God | null, t: number, seed: number, variant?: GodVariant): Px[] {
  const s = new Sink();
  if (variant === 'meteor') meteor(t, seed, s);
  else if (god === 'faith' && variant === 'beam') beam(t, seed, s);
  else if (!god) return s.out;
  else if (god === 'faith') faith(t, seed, s);
  else if (god === 'dread') dread(t, seed, s);
  else fate(t, seed, s);
  return s.out;
}
