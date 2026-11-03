// The bare figure: torso, arms, legs, head and face, the ears of the race and the lower body (02-races.md ค่า UI: หู · ท่อนล่าง).
// An outfit that has its own `torso`, `farArm` or `nearArm` draws instead of these; a lower body other than legs draws instead of the legs.
// Hand-made pixel sprites read because limbs are chunky and each limb is a different tone from what is behind it: the far limbs are in the
// shadow tone, the near arm is outlined where it crosses the torso, forearms and hands are skin against cloth, feet are boots.
import type { Ears, Lower } from '../look';
import { tones, type Paint, type Pt, type Rgb } from '../paint';
import type { Part, Rig } from '../rig';

// What the person painter adds to the Rig (kept here so the Rig of rig.ts stays as the lead wrote it).

// ── colour helpers (feats use them too) ─────────────────────────────────────────────────────────────────────────────────────────────
export const hexOf = ([r, g, b]: Rgb): string => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
/** A tone of a colour as a hex: 0 outline, 1 shadow, 3 light. */
export const tone = (hex: string, i: 0 | 1 | 3): string => hexOf(tones(hex)[i]);
export const mixHex = (a: string, b: string, t: number): string => {
  const [p, q] = [tones(a)[2], tones(b)[2]];
  return hexOf([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
};
/** A shadow colour that keeps the colour (the painter's own shadow tone turns skin a raw red): the colour mixed a third of the way to a blue-grey dark. */
export const shadowOf = (hex: string): string => mixHex(hex, '#3a2c58', 0.3);
/** The materials of the far side of the body: the shadow tone is their base, so a near limb reads in front of them. */
export const farMat = (p: Paint, hex: string): number => p.mat(shadowOf(hex));
export const darkMat = (p: Paint, hex: string): number => p.mat(tone(hex, 0), { flat: true });

// ── strokes ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A square of `w` pixels centred on a point. */
export function dab(p: Paint, x: number, y: number, w: number, k: number): void {
  const xi = Math.round(x) - (w >> 1), yi = Math.round(y) - (w >> 1);
  p.rect(xi, yi, w, w, k);
}

/** A thick line; `t` 0..1 along it picks the material (first before `split`, second after). */
export function stroke(p: Paint, a: Pt, b: Pt, w: number, k1: number, k2 = k1, split = 0.5, taper = 0): Pt[] {
  const n = Math.max(1, Math.round(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    dab(p, x, y, Math.max(1, Math.round(w * (1 - taper * t))), t < split ? k1 : k2);
    out.push([x, y]);
  }
  return out;
}

/** The width of an arm: 3 on a bulky body, 2 on most, 1 on a tiny one. */
export const armW = (r: Rig): number => (r.tw >= 11 ? 3 : r.tw >= 6 ? 2 : 1);
/** The width of a leg. */
export const legW = (r: Rig): number => Math.max(1, Math.round(r.tw / 3.2));

/** An arm from the shoulder to the hand: sleeve then skin, a dark line where it crosses the body, the hand at the end. */
export function drawArm(r: Rig, a: Pt, b: Pt, far: boolean, sleeve: number, skin: number): void {
  const { p } = r, w = armW(r);
  const n = Math.max(1, Math.round(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  const cells = new Set<number>();
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const xi = Math.round(x) - (w >> 1), yi = Math.round(y) - (w >> 1);
    for (let j = 0; j < w; j++) for (let q = 0; q < w; q++) cells.add((yi + j) * 1000 + xi + q);
    dab(p, x, y, w, t < 0.55 ? sleeve : skin);
  }
  dab(p, b[0], b[1], w >= 2 ? w : 1, skin);
  if (far || w < 2) return;
  // outline: the neighbours of the upper arm that belong to something else get the dark tone (not next to the hand: a tool is there)
  const edge: Pt[] = [];
  const upper = Math.round(n * 0.7);
  for (let i = 0; i <= upper; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const xi = Math.round(x) - (w >> 1), yi = Math.round(y) - (w >> 1);
    for (let j = -1; j <= w; j++)
      for (let q = -1; q <= w; q++) {
        if ((j >= 0 && j < w) === (q >= 0 && q < w)) continue; // only the four sides, not the corners
        const px = xi + q, py = yi + j;
        if (!cells.has(py * 1000 + px) && p.at(px, py) && py > r.sh) edge.push([px, py]);
      }
  }
  const ink = p.mat(tone(r.look.main, 0), { flat: true });
  for (const [x, y] of edge) if (p.at(x, y) !== r.m.leather && p.at(x, y) !== r.m.wood && p.at(x, y) !== r.m.metal) p.px(x, y, ink);
}

// ── the infant ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A baby is a swaddled bundle: cloth from the shoulders to the ground with a band across, the hands out. */
function swaddle(r: Rig): void {
  const { p, m } = r, w = r.tw + 1, x0 = r.x0 - 1, top = r.sh, bottom = r.foot - 1;
  p.ell(x0 + w / 2, (top + bottom + 1) / 2, w / 2 + 0.2, (bottom - top + 1) / 2, m.main);
  p.rect(x0, Math.round(top + (bottom - top) * 0.5), w, 1, m.second);
}

// ── legs ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Where each foot is this frame (the ends of the legs: feats that sit on the feet use them). */
export function feet(r: Rig): { x: number; y: number; far: boolean }[] {
  const w = legW(r);
  const at = (L: { x: number; fx: number; lift: number }, far: boolean) => {
    if (r.sit) return { x: Math.round(L.x + 4 * r.k), y: r.foot - 1, far };
    if (r.kneel) return { x: Math.round(L.x + 3 * r.k - 4 * r.k), y: r.foot - 1, far };
    return { x: Math.round(L.fx), y: r.foot - L.lift - 1, far };
  };
  void w;
  return [at(r.far, true), at(r.near, false)];
}

function leg(r: Rig, L: { x: number; fx: number; lift: number }, far: boolean) {
  const { p } = r, w = legW(r), bh = r.k >= 0.75 ? 3 : 2, bottom = r.foot - L.lift;
  const pants = far ? farMat(p, r.look.second) : r.m.pants;
  const boot = far ? farMat(p, '#5a3a24') : r.m.leather;
  if (r.infant) return;
  if (r.sit) {
    // thigh forward, shin down from the knee
    const kx = Math.round(L.x + 4 * r.k);
    p.rect(L.x, r.hip, kx - L.x + w, w, pants);
    p.rect(kx, r.hip, w, Math.max(1, r.foot - r.hip - bh), pants);
    p.rect(kx, r.foot - bh, w + 1, bh, boot);
    return;
  }
  if (r.kneel) {
    const kx = Math.round(L.x + 3 * r.k);
    p.rect(L.x, r.hip, kx - L.x + w, w, pants);
    p.rect(kx - 4 * r.k, r.foot - w, Math.round(4 * r.k) + w, w, pants);
    p.rect(Math.round(kx - 4 * r.k) - 1, r.foot - w - 1, 2, w + 1, boot);
    return;
  }
  const hy = r.hip, ky = bottom - bh;
  stroke(p, [L.x + (w >> 1), hy], [L.fx + (w >> 1), ky], w, pants);
  p.rect(Math.round(L.fx), ky, w + 1, bh, boot);
  p.px(L.fx + w, bottom - 1, boot);
}

// ── the gel body (slime) ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** How the gel is squeezed this frame: [wider, taller] (1 at rest). The slime hops, stretches, flattens when it falls. */
export function squash(r: Rig): [number, number] {
  const f = r.f;
  switch (r.pose) {
    case 'idle': return [[1, 1], [1.04, 0.96]][f] as [number, number];
    case 'walk': return [[1.18, 0.82], [0.88, 1.16], [0.92, 1.1], [1.1, 0.92]][f] as [number, number];
    case 'attack': return [[1.1, 0.9], [0.85, 1.12], [0.95, 1.04]][f] as [number, number];
    case 'hurt': return [[1.12, 0.9], [1.2, 0.84]][f] as [number, number];
    case 'die': return [[1.1, 0.92], [1.35, 0.6], [1.7, 0.34]][f] as [number, number];
    case 'cheer': return [[0.92, 1.1], [1.0, 1.0]][f] as [number, number];
    case 'sit': return [1.2, 0.85];
    default: return [1, 1];
  }
}

const gelMat = (r: Rig): number => r.p.mat(r.look.skin, { alpha: 0.82, deep: true });

function gelLower(r: Rig): void {
  const { p } = r, g = gelMat(r), [sx] = squash(r);
  const cx = r.x0 + r.tw / 2, ground = r.foot - (r.hip > r.foot - r.legs ? 0 : 0);
  const top = r.hip - 1, bottom = ground - Math.max(0, r.legs - (r.foot - r.hip)) * 0 - (r.pose === 'walk' ? r.near.lift : 0);
  const rx = r.tw * 0.62 * sx + 1.5, hgt = Math.max(3, bottom - top);
  p.ell(cx, top + hgt / 2 + 0.5, rx, hgt / 2 + 0.5, g);
  p.rect(Math.round(cx - rx + 1), bottom - 2, Math.round(rx * 2 - 1), 2, g);
  // a lip at the bottom, wavy
  for (let i = 0; i < 4; i++) p.px(Math.round(cx - rx + 2 + i * (rx * 2 - 4) / 3), bottom, g);
}

function gelArm(r: Rig, a: Pt, b: Pt, far: boolean): void {
  const { p } = r, g = far ? p.mat(shadowOf(r.look.skin), { alpha: 0.8, deep: true }) : p.mat(mixHex(r.look.skin, '#ffffff', 0.3), { alpha: 0.9 });
  // a tapering strand of gel, no hand at the end
  stroke(p, a, b, armW(r) + (r.tw >= 9 ? 0 : -1), g, g, 0.5, 0.7);
}

export const GEL_BODY: Part = {
  farArm: (r) => gelArm(r, r.shoulderFar, r.farHand, true),
  lower: gelLower,
  torso: (r) => {
    const { p } = r, g = gelMat(r), [sx] = squash(r), cx = r.x0 + r.tw / 2;
    const w = r.tw * sx, h = Math.max(2, r.hip - r.sh + 1);
    p.ell(cx, r.sh + h / 2, w / 2 + 1, h / 2 + 0.5, g);
    p.rect(Math.round(cx - w / 2), r.sh + 2, Math.round(w), Math.max(1, h - 3), g);
  },
  head: (r) => {
    const { p } = r, g = gelMat(r);
    p.ell(r.head[0], r.head[1], r.hr[0], r.hr[1], g);
    p.rect(Math.round(r.head[0] - 1), Math.round(r.head[1] + r.hr[1] - 1), 3, 2, g);
  },
  nearArm: (r) => gelArm(r, r.shoulderNear, r.hand, false),
};

// ── the bare body ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const BODY_PARTS: { torso: Part; arms: Part; legs: Part; head: Part } = {
  torso: {
    torso: (r) => {
      const { p, m } = r, w = r.tw, x0 = r.x0, top = r.sh, h = Math.max(2, r.hip - r.sh);
      if (r.infant && r.look.body.lower === 'legs') { swaddle(r); return; }
      const fem = r.look.fem, big = r.k >= 0.75, belt = r.hip - (big ? 3 : 2);
      for (let y = top; y < r.hip; y++) {
        let a = x0, b = x0 + w; // [a, b)
        if (y === top && w >= 7) { a++; b--; }
        else if (y === top + 1 && w >= 10) { a++; b--; }
        if (fem && w >= 7 && y >= belt - 2 && y <= belt) { a++; b--; }
        p.rect(a, y, b - a, 1, m.main);
      }
      // the stoop of the old: a hump on the back
      if (r.look.stage === 'elder' && h >= 6) { p.rect(x0 - 1, top + 1, 1, Math.min(4, h - 3), m.main); p.px(x0 - 1, top, 0); }
      if (big) {
        // the tunic skirt over the hips, a belt with a buckle
        const fl = fem ? 2 : 1;
        p.rect(x0 - fl, r.hip - 1, w + fl * 2, 2, m.main);
        p.rect(x0, belt, w, 1, m.leather);
        p.px(x0 + w - 3, belt, m.accent);
        p.rect(x0, r.hip + 1, w, 0, m.second);
      } else p.rect(x0, belt, w, 1, m.leather);
    },
  },
  arms: {
    farArm: (r) => drawArm(r, r.shoulderFar, r.farHand, true, farMat(r.p, r.look.main), farMat(r.p, r.look.skin)),
    nearArm: (r) => drawArm(r, r.shoulderNear, r.hand, false, r.m.main, r.m.skin),
  },
  legs: {
    lower: (r) => { leg(r, r.far, true); leg(r, r.near, false); },
  },
  head: {
    head: (r) => {
      const { p, m } = r;
      if (r.gel) return;
      const [hx, hy] = r.head, rx = r.hr[0], ry = r.hr[1];
      // the neck, then the skull
      if (!r.infant) p.rect(Math.round(hx) - 2 - Math.floor(r.lean / 2), Math.round(hy + ry) - 1, 3, 2 + (r.hh >= 7 ? 1 : 0), m.skin);
      headShape(r);
      void rx;
    },
    face: (r) => {
      if (r.gel) return;
      const { p, m } = r, [hx, hy] = r.head, rx = r.hr[0];
      const shut = r.pose === 'pray' || (r.pose === 'die' && r.f > 0) || (r.pose === 'hurt' && r.f > 0);
      const ex = Math.round(hx + rx * 0.55), ey = Math.round(hy - 0.4);
      const ink = p.mat(mixHex(r.look.skin, '#1a1210', 0.7), { flat: true }), shade = p.mat(mixHex(r.look.skin, '#3a2018', 0.45));
      const white = p.mat(mixHex(r.look.skin, '#ffffff', 0.8), { flat: true });
      if (shut) { p.px(ex, ey, ink); p.px(ex - 1, ey, ink); } else { p.px(ex, ey, m.eye); p.px(ex - 1, ey, r.hh >= 6 ? white : m.eye); }
      if (r.hh >= 6 && !r.infant) { p.px(ex, ey - 1, shade); p.px(ex - 1, ey - 1, shade); } // the brow
      p.px(Math.round(hx + rx), ey + 1, m.skin); // the nose
      if (r.hh >= 7) p.px(ex, ey + 2, shade); // the mouth
      if (r.look.stage === 'elder' && r.hh >= 6) p.px(ex - 1, ey + 2, ink);
    },
  },
};

/** The skull: a rounded block (the corners cut), not an oval, the way hand-made sprites draw a head this small. */
function headShape(r: Rig): void {
  const { p, m } = r, [hx, hy] = r.head, w = Math.round(r.hr[0] * 2), h = r.hh, x0 = Math.round(hx - w / 2), y0 = Math.round(hy - h / 2);
  if (w < 5 || h < 5) { p.ell(hx, hy, r.hr[0], r.hr[1], m.skin); return; }
  for (let j = 0; j < h; j++) {
    const edge = j === 0 ? (w >= 7 ? 2 : 1) : j === 1 && w >= 7 ? 1 : j === h - 1 ? 1 : 0;
    p.rect(x0 + edge, y0 + j, w - edge * 2, 1, m.skin);
  }
}

// ── ears ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Drawn in `face` (round: under the hair) or `front` (the ears that rise or reach out of hair and hats).
const earMat = (r: Rig): number => r.p.mat(shadowOf(r.look.skin));
const earInner = (r: Rig): number => r.p.mat(mixHex(r.look.skin, '#1a1210', 0.55), { flat: true });
const earX = (r: Rig): number => r.head[0] - r.hr[0] * 0.55;
/** An ear that twitches one frame in the idle (the beast people). */
const twitch = (r: Rig): number => (r.pose === 'idle' && r.f === 1) || (r.pose === 'walk' && r.f === 2) ? 1 : 0;

export const EARS: Record<Ears, Part> = {
  round: {
    face: (r) => {
      if (r.gel) return;
      const x = Math.round(earX(r)), y = Math.round(r.head[1]);
      r.p.px(x, y, earMat(r));
      if (r.hh >= 6) r.p.px(x, y + 1, earMat(r));
    },
  },
  long: {
    // up and back, as long as the head is wide; the old ones droop
    front: (r) => {
      const { p, k } = r, x = earX(r), y = r.head[1] - 0.5, len = Math.max(3, Math.round(r.hr[0] * 1.5 + 1)), droop = r.look.stage === 'elder';
      const tx = x - len * 0.9, ty = droop ? y + 2 : y - len * 0.8 - (r.f === 1 && r.pose === 'idle' ? 0 : 0.5);
      p.poly([[x + 0.5, y - 1.2], [tx, ty], [x + 0.5, y + 1.8]], r.m.skin);
      p.px(x - 0.5, y - 0.5, earMat(r));
      void k;
    },
  },
  pointed: {
    front: (r) => {
      const { p } = r, x = earX(r), y = r.head[1], len = Math.max(2, Math.round(r.hr[0] * 0.8));
      p.poly([[x + 0.5, y - 1], [x - len, y - len * 0.6 - 0.5], [x + 0.5, y + 1.5]], r.m.skin);
    },
  },
  animal: {
    // up on the head, in the fur colour with a darker inside; they swivel in the idle
    front: (r) => {
      const { p, k } = r, [hx, hy] = r.head, top = hy - r.hr[1], sz = Math.max(2, Math.round(3.5 * k)), t = twitch(r);
      const fur = r.m.hair, inner = p.mat(shadowOf(r.look.skin), { flat: true });
      const ear = (cx: number, lean: number) => {
        p.poly([[cx - sz * 0.45, top + 1.2], [cx + lean, top - sz], [cx + sz * 0.45, top + 1.2]], fur);
        p.px(cx + lean * 0.3, top - sz * 0.35 + 0.5, inner);
      };
      ear(hx - r.hr[0] * 0.45, -t * 1.5 - 0.5);
      ear(hx + r.hr[0] * 0.45, t * 0.5 + 0.5);
    },
  },
  fin: {
    // a fan of three rays in the accent colour, open to the back, a little see-through
    front: (r) => {
      const { p } = r, x = earX(r), y = r.head[1], len = Math.max(2, Math.round(r.hr[0] * 0.95));
      const fan = p.mat(mixHex(r.look.skin, r.look.accent, 0.35), { alpha: 0.92 }), rib = p.mat(r.look.accent, { flat: true });
      p.poly([[x + 0.5, y - 1.5], [x - len, y - len * 0.7 - 0.5], [x - len - 0.5, y + 0.5], [x - len * 0.7, y + len * 0.5 + 1], [x + 0.5, y + 2]], fan);
      p.px(x - len * 0.55, y - 0.5, rib);
      p.px(x - len * 0.3, y + 1, rib);
    },
  },
  none: {},
};

// ── the lower body ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The coils of a naga: where the pile stands and how tall it is (feats that mark the tail use it). */
export function coils(r: Rig): { cx: number; gy: number; rx1: number; h1: number; rx2: number; h2: number } {
  const h1 = Math.max(2, Math.round(r.legs * 0.55)), h2 = Math.max(2, r.legs - h1 + 2);
  return { cx: r.x0 + r.tw / 2, gy: r.foot, rx1: r.tw * 0.95 + 1, h1, rx2: r.tw * 0.7, h2 };
}

/** The slither of the tail this frame: how far the coils lean and how high the tip is. */
function slither(r: Rig): { sway: number; tip: number } {
  if (r.pose === 'walk') return { sway: [0, 1, 0, -1][r.f], tip: [0, -1, 0, 1][r.f] };
  if (r.pose === 'idle') return { sway: 0, tip: r.f ? -1 : 0 };
  if (r.pose === 'attack') return { sway: [-1, 1, 0][r.f], tip: [-1, -2, -1][r.f] };
  if (r.pose === 'die') return { sway: 0, tip: 0 };
  return { sway: 0, tip: r.f % 2 ? -1 : 0 };
}

export const LOWER: Record<Lower, Part> = {
  legs: BODY_PARTS.legs,
  serpent: {
    lower: (r) => {
      const { p, m } = r, c = coils(r), s = slither(r);
      const belly = p.mat(tone(r.look.skin, 3)), plate = p.mat(shadowOf(r.look.skin), { flat: true });
      const cx = c.cx + s.sway, gy = c.gy;
      // the tail trails behind along the ground and curls up at the tip
      const len = Math.round(r.tw * 0.8 + 3);
      for (let i = 0; i < len; i++) {
        const x = c.cx - c.rx1 + 1 - i, th = i < len * 0.4 ? 3 : i < len * 0.75 ? 2 : 1, y = gy - th - (i > len - 4 ? Math.round((i - (len - 4)) * 0.7) + (s.tip < 0 ? 1 : 0) : 0);
        p.rect(Math.round(x), Math.round(y), 1, th, m.skin);
      }
      // the pile: a wide bottom coil, a narrower one above it, the body rising out of them
      p.ell(cx - 1, gy - c.h1 / 2, c.rx1, c.h1 / 2, m.skin);
      p.ell(cx + 1, gy - c.h1 - c.h2 / 2 + 1, c.rx2, c.h2 / 2, m.skin);
      p.poly([[r.x0 + 0.5, r.hip - 1], [r.x0 + r.tw - 0.5, r.hip - 1], [cx + c.rx2 - 1, gy - c.h1 - c.h2 / 2], [cx - c.rx2 + 1, gy - c.h1 - c.h2 / 2]], m.skin);
      // the pale belly plates down the front and along the coils
      for (let y = r.hip + 1; y < gy - c.h1 - 1; y += 2) p.px(r.x0 + r.tw - 2, y, belly);
      p.rect(Math.round(cx + 1), Math.round(gy - c.h1 - 1), Math.round(c.rx2), 1, belly);
      p.rect(Math.round(cx - 2), gy - 2, Math.round(c.rx1), 1, belly);
      // the seams between the coils
      p.rect(Math.round(cx - c.rx1 + 2), Math.round(gy - c.h1 - 0), Math.round(c.rx1 * 1.2), 1, plate);
      p.rect(Math.round(cx - c.rx2 + 2), Math.round(gy - c.h1 - c.h2 + 2), Math.round(c.rx2), 1, plate);
    },
  },
  gown: {
    // a long skirt that trails: the hem is cut into points like a fin and moves even when nothing moves
    lower: (r) => {
      const { p } = r, sway = r.flap, gy = r.foot, w0 = r.tw, wb = r.tw + 4 + Math.round(r.k * 2);
      const back = p.mat(mixHex(r.look.main, '#101830', 0.25)), hem = p.mat(r.look.accent), front = p.mat(r.look.second);
      const top = r.hip - 1, cx = r.x0 + w0 / 2;
      // the back panel, darker, leaning the other way
      p.poly([[r.x0 + 1, top], [r.x0 + w0 - 1, top], [cx + wb / 2 - 1 - sway * 0.5, gy], [cx - wb / 2 - 2 + sway, gy]], back);
      // the front panel with a cut hem
      const left = cx - wb / 2 - sway * 0.5, right = cx + wb / 2 + 1;
      p.poly([[r.x0, top], [r.x0 + w0, top], [right, gy - 2], [left, gy - 2]], front);
      const teeth = 4, tw = (right - left) / teeth;
      for (let i = 0; i < teeth; i++) {
        const x = left + i * tw, tip = gy - (i % 2 ? 0 : 1) + (i === teeth - 1 ? -1 : 0);
        p.poly([[x, gy - 2.5], [x + tw, gy - 2.5], [x + tw / 2 + sway * 0.4 * (i % 2 ? 1 : -1), tip]], front);
      }
      p.rect(Math.round(left + 1), gy - 4, Math.round(right - left - 1), 1, hem);
      // the toe of a slipper at the front
      p.rect(Math.round(right - 3), gy - 1, 2, 1, hem);
    },
  },
  blob: { lower: gelLower },
};
