// Painter features (ลักษณะที่วาดเพิ่ม of 02-races.md, and personal marks): wings, tails, horns, crests, runes, glows, scars.
// Each is a part with whatever layers it needs. Rules of this table:
//  - marks on the face are drawn in `front` (the last layer), so a hat, a hood or hair never covers them;
//  - things behind the body (wings, tails, a cobra hood) are drawn in `back`, things on the clothes in `torso` (the arms are drawn after it);
//  - glows (lavaglow, embers, core, glow-eyes, sparkle) are flat materials: one colour, no shading;
//  - wings and tails move with `r.flap` and the frame; the feats that need the limbs read r.shoulderNear → r.hand and the feet of `feet(r)`.
import type { Pt } from '../paint';
import type { Part, Rig } from '../rig';
import { coils, feet, hexOf, mixHex, shadowOf, stroke, tone, armW } from './body';

// ── small helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const DEG = Math.PI / 180;
const flat = (r: Rig, hex: string, alpha = 1): number => r.p.mat(hex, { flat: true, alpha });
const solid = (r: Rig, hex: string, alpha = 1): number => r.p.mat(hex, { alpha });
const ink = (r: Rig, over = 0.7): number => r.p.mat(mixHex(r.look.skin, '#1a1210', over), { flat: true });
/** The eye of the face (where body.ts draws it). */
const eyeAt = (r: Rig): Pt => [Math.round(r.head[0] + r.hr[0] * 0.5), Math.round(r.head[1] - 0.4)];
const topY = (r: Rig): number => r.head[1] - r.hr[1];
const cxOf = (r: Rig): number => r.x0 + r.tw / 2;
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const nearArm = (r: Rig, t: number): Pt => lerp(r.shoulderNear, r.hand, t);
const farArm = (r: Rig, t: number): Pt => lerp(r.shoulderFar, r.farHand, t);
/** A swing that follows the frame: tails and ribbons move a pixel or two. */
const sway = (r: Rig): number => (r.pose === 'walk' ? [0, 1, 0, -1][r.f] : r.pose === 'idle' ? r.f : r.pose === 'attack' ? [-1, 1, 0][r.f] : r.f % 2);
const isAngry = (r: Rig): boolean => r.pose === 'attack' || r.pose === 'hurt' || r.pose === 'cast' || r.pose === 'cheer';
const horn = (r: Rig): string => (r.look.race === 'demonkin' ? '#3a2a34' : r.look.race === 'lavakin' ? '#2a1a1a' : '#d6c9a4');

/** A leaf-shaped polygon from a base in a direction (degrees from straight up, positive toward the back/left). */
function blade(r: Rig, base: Pt, deg: number, len: number, wid: number, k: number): void {
  const dx = -Math.sin(deg * DEG), dy = -Math.cos(deg * DEG), px = -dy, py = dx;
  r.p.poly([base, [base[0] + dx * len * 0.4 + px * wid, base[1] + dy * len * 0.4 + py * wid], [base[0] + dx * len, base[1] + dy * len], [base[0] + dx * len * 0.4 - px * wid, base[1] + dy * len * 0.4 - py * wid]], k);
}
const tip = (base: Pt, deg: number, len: number): Pt => [base[0] - Math.sin(deg * DEG) * len, base[1] - Math.cos(deg * DEG) * len];

/** How far a wing is open this frame: 0 folded, 1 half, 2 spread. Wings fold on the ground and open for anger or joy. */
function wingOpen(r: Rig): number {
  if (r.pose === 'cheer') return 2;
  if (r.pose === 'attack' || r.pose === 'cast') return r.f === 0 ? 1 : 2;
  if (r.pose === 'hurt') return 1;
  if (r.pose === 'die') return r.f === 0 ? 1 : 0;
  if (r.pose === 'walk') return r.flap >= 2 ? 1 : 0;
  return r.pose === 'idle' && r.f === 1 ? 1 : 0;
}

/** A wing of long feathers fanning from the shoulder blade: a filled fan with a ragged edge, the feathers marked by lines, shorter ones under. */
function featherWing(r: Rig, light: string, shade: string): void {
  const { p } = r, open = wingOpen(r), base: Pt = [r.x0 + 2 + r.lean * 0.5, r.sh + 3];
  const deg = [160, 68, 32][open], span = [24, 38, 50][open], len = r.H * [0.52, 0.5, 0.64][open];
  const a = p.mat(light), sh = p.mat(mixHex(shade, '#9aa4c8', 0.4)), line = p.mat(shade, { flat: true });
  const n = 6, tips: Pt[] = [], under: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const d = deg + (i / (n - 1) - 0.5) * span, ln = len * (0.7 + 0.3 * Math.sin((i / (n - 1)) * Math.PI * 0.9 + 0.35));
    tips.push(tip(base, d, ln)); under.push(tip(base, d + 4, ln * 0.55));
  }
  p.poly([base, ...tips], sh);
  p.poly([base, ...tips.map((t) => lerp(base, t, 0.92))], a);
  p.poly([base, ...under], sh);
  tips.forEach((t, i) => { p.line(lerp(base, t, 0.45), lerp(base, t, 0.95), line); if (i % 2) p.px(t[0], t[1], a); });
  p.ell(base[0] - 0.5, base[1] - 0.5, 2.2, 2.6, a);
}

/** A bat's wing: an arm bone out and up, two finger bones, a membrane with a scalloped edge between them. */
function batWing(r: Rig, membrane: string, bone: string, scaled: boolean): void {
  const { p } = r, open = wingOpen(r), base: Pt = [r.x0 + 2 + r.lean * 0.5, r.sh + 3];
  const mem = p.mat(membrane, { deep: true }), bn = p.mat(bone, { flat: true });
  const arm = [[-14, 14], [-22, -4], [-12, -24]][open].map((v) => v * (r.H / 28)) as Pt; // elbow-to-wrist as (dx,dy)
  const wrist: Pt = [base[0] + arm[0], base[1] + arm[1]];
  const tips: Pt[] = [
    [[wrist[0] - 5, wrist[1] + 5], [wrist[0] - 8, wrist[1] - 6], [wrist[0] - 3, wrist[1] - 9]][open].map((v, i) => v * 1) as Pt,
    [[wrist[0] - 1, wrist[1] + 9], [wrist[0] - 2, wrist[1] + 4], [wrist[0] + 2, wrist[1] - 1]][open] as Pt,
    [[base[0] - 2, wrist[1] + 11], [base[0] - 6, wrist[1] + 11], [base[0] - 3, wrist[1] + 9]][open] as Pt,
  ];
  const lower: Pt = [base[0], base[1] + 9 * (r.H / 28)];
  // the membrane between the bones, with scallops along the trailing edge
  p.poly([base, wrist, tips[0], [(tips[0][0] + tips[1][0]) / 2 + 1, (tips[0][1] + tips[1][1]) / 2 - 1], tips[1], [(tips[1][0] + tips[2][0]) / 2 + 1, (tips[1][1] + tips[2][1]) / 2 - 1], tips[2], lower], mem);
  stroke(p, base, wrist, 1, bn);
  for (const t of tips) stroke(p, wrist, t, 1, bn);
  stroke(p, base, tips[1], 1, bn);
  if (scaled) for (let i = 0; i < 5; i++) p.px(lerp(base, tips[1], 0.25 + i * 0.14)[0] - 1, lerp(base, tips[1], 0.25 + i * 0.14)[1] + 1, p.mat(tone(membrane, 3), { flat: true }));
}

/** A wing of a fairy: thin and clear, two pairs, beating all the time. */
function insectWing(r: Rig): void {
  const { p } = r, base: Pt = [r.x0 + 2 + r.lean * 0.5, r.sh + 2], beat = r.f % 2 ? 2 : 0;
  const pale = p.mat('#f4eaff', { alpha: 0.6, deep: true }), edge = p.mat(r.look.accent, { alpha: 0.9, flat: true }), vein = p.mat('#ffffff', { alpha: 0.9, flat: true });
  const L = r.H * 0.7;
  for (const [off, ln, wd] of [[0, L, 2.6], [22, L * 0.72, 2]] as [number, number, number][]) {
    const d = [150, 128, 110][beat === 2 ? 2 : r.pose === 'walk' ? 1 : 0] - (beat ? 8 : 0) + off * 0.3;
    blade(r, base, d, ln, wd * Math.max(1, r.k * 1.4), pale);
    const t = tip(base, d, ln);
    p.line(base, [(base[0] + t[0]) / 2, (base[1] + t[1]) / 2], vein);
    p.px(t[0], t[1], edge);
  }
}

/** Where a tail starts: the back of the hips. */
const tailRoot = (r: Rig): Pt => [r.x0 - 1, r.hip - 1];

/** The glow of the eye in `look.eye`, with a faint halo. */
const eyeGlow = (r: Rig): void => {
  const [ex, ey] = eyeAt(r), core = flat(r, r.look.eye), halo = flat(r, r.look.eye, 0.4);
  for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 1], [0, 1], [-2, 0], [1, 0]] as Pt[]) if (!r.p.at(ex + dx, ey + dy) || dx !== 1) r.p.px(ex + dx, ey + dy, halo);
  r.p.px(ex, ey, core); r.p.px(ex - 1, ey, core);
};

/** A thin line of marks across the near forearm. */
const armMarks = (r: Rig, ts: number[], k: number): void => { for (const t of ts) { const [x, y] = nearArm(r, t); r.p.px(x, y, k); } };

// ── the feats ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const FEATS: Record<string, Part> = {
  // ── elf ──
  leafcrest: {
    // a crest of leaves swept back from the top of the head (not a flower, not a bow)
    front: (r) => {
      const { p } = r, top = topY(r), hx = r.head[0], leaf = p.mat(r.look.accent), lite = p.mat(tone(r.look.accent, 3), { flat: true });
      for (let i = 0; i < 3; i++) {
        const b: Pt = [hx - 1.5 + i * 1.8, top + 1.5], t: Pt = [b[0] - 1.5 - i * 0.4, top - 2.2 - (i === 1 ? 1 : 0) + (r.pose === 'idle' && r.f ? 0.5 : 0)];
        stroke(p, b, t, 2, leaf, leaf, 0.5, 0.7);
        p.px(t[0], t[1], lite);
      }
    },
  },
  vines: {
    // a living vine wound across the chest and trailing from the belt
    torso: (r) => {
      const { p } = r, v = p.mat(tone(r.look.accent, 0), { flat: true }), lf = p.mat(r.look.accent, { flat: true });
      const a: Pt = [r.x0 + r.tw - 2, r.sh + 1], b: Pt = [r.x0 + 1, r.hip - 3];
      const pts = stroke(p, a, b, 1, v);
      pts.forEach(([x, y], i) => { if (i % 3 === 1) p.px(x + 1, y - 1, lf); });
      const end = Math.min(r.hip + 2, r.foot - 2);
      p.line([r.x0 + 1, r.hip - 3], [r.x0 + 1 + sway(r) * 0.5, end], v);
      p.px(r.x0 + 1 + sway(r) * 0.5, end, lf);
    },
  },
  // ── dark elf ──
  webcrown: {
    // a thin silver crown that crosses the brow in the shape of a web: an arc with three points
    front: (r) => {
      const { p } = r, [hx] = r.head, top = Math.round(topY(r)) + 1, rx = r.hr[0], silver = p.mat('#b0b8d0');
      for (let x = Math.round(hx - rx * 0.8); x <= Math.round(hx + rx * 0.9); x++) p.px(x, top + (Math.abs(x - hx) > rx * 0.6 ? 1 : 0), silver);
      for (const dx of [-1.5, 0.5, 2.5]) p.px(hx + dx * 0.9, top - 1, silver);
      p.px(hx + 0.5, top - 2, flat(r, r.look.accent));
    },
  },
  lavaglow: {
    // the edges of the dark cloth glow lava orange: collar, hem and cuff (flat)
    front: (r) => {
      const { p } = r, g = flat(r, r.look.accent);
      for (let x = r.x0; x < r.x0 + r.tw; x += 2) p.px(x, r.hip + 1, g);
      p.px(r.x0 + r.tw - 3, r.sh + 1, g); p.px(r.x0 + r.tw - 4, r.sh + 1, g);
      const [cx, cy] = nearArm(r, 0.5); p.px(cx, cy, g);
      if (r.pose !== 'idle' || r.f) p.px(r.x0 + r.tw - 1, r.hip - 2, flat(r, tone(r.look.accent, 3)));
    },
  },
  slit: {
    // a slit pupil: the eye is two or three pixels tall
    front: (r) => { const [ex, ey] = eyeAt(r), e = r.m.eye; r.p.px(ex, ey - 1, e); r.p.px(ex, ey, e); r.p.px(ex, ey + 1, e); r.p.px(ex - 1, ey, ink(r)); },
  },
  // ── dwarf ──
  runes: {
    // tattooed runes on the back of the hand and along the forearm
    nearArm: (r) => {
      const k = ink(r, 0.6), g = flat(r, mixHex(r.look.accent, r.look.skin, 0.2));
      armMarks(r, [0.62, 0.78], k);
      const [hx, hy] = r.hand; r.p.px(hx, hy - 1, g);
      const [fx, fy] = nearArm(r, 0.7); r.p.px(fx + 1, fy, k);
    },
    farArm: (r) => { const [x, y] = farArm(r, 0.7); r.p.px(x, y, ink(r, 0.6)); },
  },
  beadbeard: {
    // the long beard braided in two with metal rings (women braid the hair instead and ring it the same)
    hair: (r) => {
      const { p } = r, [hx, hy] = r.head, [rx, ry] = r.hr, hair = r.m.hair, ring = p.mat(r.look.accent);
      const chin = Math.round(hy + ry) - 1, bottom = Math.round(r.sh + (r.hip - r.sh) * 0.75), mid = Math.round(hx + rx * 0.15);
      if (r.look.fem) {
        for (const dx of [-rx * 0.55, rx * 0.35]) { const x = Math.round(hx + dx); p.rect(x, Math.round(hy), 1, bottom - Math.round(hy), hair); p.px(x, bottom, ring); p.px(x, bottom - 3, ring); }
        return;
      }
      const sp = Math.max(3, Math.round(r.hh * 0.6)), split = bottom - 3;
      for (let y = chin; y <= bottom; y++) {
        const w = y < r.sh ? Math.round(rx * 1.3) : Math.max(3, Math.round(rx * 1.3) - Math.floor((y - r.sh) * 0.3));
        if (y < split) p.rect(mid - Math.floor(w / 2) + 1, y, w, 1, hair);
        else { p.px(mid - 1, y, hair); p.px(mid + 1, y, hair); }
      }
      p.px(mid - 1, bottom, ring); p.px(mid + 1, bottom - 1, ring); p.px(mid, split - 1, ring);
      void sp;
    },
  },
  // ── orc ──
  tusks: {
    // lower tusks that curve up past the lip (the old ones have broken one)
    front: (r) => {
      const [ex, ey] = eyeAt(r), x = Math.round(r.head[0] + r.hr[0] * 0.65), b = r.m.bone;
      r.p.px(x, ey + 2, b); r.p.px(x, ey + 1, b);
      if (r.look.stage !== 'elder') { r.p.px(x - 2, ey + 2, b); r.p.px(x - 2, ey + 1, b); r.p.px(x + 1, ey + 1, b); }
      void ex;
    },
  },
  warpaint: {
    // two stripes of blood-red paint across the cheek and three on the chest
    front: (r) => {
      const [ex, ey] = eyeAt(r), red = flat(r, '#9a2a1a');
      r.p.px(ex - 1, ey + 1, red); r.p.px(ex, ey + 2, red); r.p.px(ex - 2, ey + 2, red); r.p.px(ex - 1, ey + 3, red);
      for (let i = 0; i < 3; i++) r.p.line([r.x0 + 1 + i * 2, r.sh + 2], [r.x0 + 2 + i * 2, r.sh + 4], red);
    },
  },
  scars: {
    // old scars: a line across the face, two across the chest, one on the arm (pale, not bloody)
    front: (r) => {
      const [ex, ey] = eyeAt(r), pale = flat(r, mixHex(r.look.skin, '#e8d8c8', 0.55));
      r.p.line([ex - 3, ey - 2], [ex - 2, ey + 3], pale);
      r.p.line([r.x0 + 1, r.sh + 3], [r.x0 + 4, r.sh + 5], pale);
      r.p.line([r.x0 + 3, r.sh + 2], [r.x0 + 5, r.sh + 6], pale);
      const [ax, ay] = nearArm(r, 0.8); r.p.px(ax, ay, pale);
    },
  },
  // ── halfling ──
  hairyfeet: {
    // bare feet with a fur of hair over the toes and up the ankle
    lower: (r) => {
      const { p } = r, hair = r.m.hair, skin = r.m.skin, w = Math.max(2, Math.round(r.tw / 3.2) + 1);
      for (const f of feet(r)) {
        const y = f.y;
        p.rect(f.x, y - 1, w, 2, skin);
        p.rect(f.x - 1, y - 2, w + 1, 1, hair); p.px(f.x + w, y, hair); p.px(f.x + w, y - 1, hair); p.px(f.x - 1, y, hair); p.px(f.x + 1, y - 3, hair);
      }
    },
  },
  rosycheeks: {
    // a flush on the cheek, one or two pixels, muted
    front: (r) => { const [ex, ey] = eyeAt(r), c = flat(r, mixHex(r.look.skin, '#c0504a', 0.55)); r.p.px(ex - 1, ey + 2, c); r.p.px(ex, ey + 2, c); },
  },
  // ── beast people ──
  fur: {
    // fur on the cheek and along the forearm: the edge of the face is ragged and the arm is striped in the coat colour
    front: (r) => {
      const [, ey] = eyeAt(r), x = Math.round(r.head[0] + r.hr[0]) - 1;
      r.p.px(x, ey + 2, r.m.hair); r.p.px(x - 1, ey + 3, r.m.hair); r.p.px(x + 1, ey + 2, r.m.hair);
    },
    nearArm: (r) => armMarks(r, [0.6, 0.72, 0.84], r.m.hair),
    farArm: (r) => { const [x, y] = farArm(r, 0.75); r.p.px(x, y, r.m.hair); },
  },
  'tail:fluffy': {
    // a thick brush of a tail, curling up behind, tipped light; it tells the mood and moves all the time
    back: (r) => {
      const { p, k } = r, s = sway(r), root = tailRoot(r), c = r.m.hair, tipc = p.mat(tone(r.look.hairColor, 3));
      // a curve out and up from the hips, fat in the middle: a chain of ovals
      const P: Pt[] = [root, [root[0] - 5 * k - s * 0.5, root[1] + 1.5 * k], [root[0] - 7 * k - s, root[1] - 6 * k]];
      const N = 7;
      for (let i = 0; i <= N; i++) {
        const t = i / N, u = 1 - t, x = u * u * P[0][0] + 2 * u * t * P[1][0] + t * t * P[2][0], y = u * u * P[0][1] + 2 * u * t * P[1][1] + t * t * P[2][1];
        const rad = (1.1 + 1.9 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.9)) * Math.max(0.8, k);
        p.ell(x, y, rad, rad, i >= N - 1 ? tipc : c);
      }
    },
  },
  pawhands: {
    // the hands are paws: fur to the wrist, a dark pad
    front: (r) => {
      const w = armW(r), pad = flat(r, '#5a3a3a');
      for (const h of [r.hand, r.farHand]) { r.p.rect(Math.round(h[0]) - (w >> 1), Math.round(h[1]) - (w >> 1), w, w, r.m.hair); r.p.px(h[0], h[1] + (w > 1 ? 0 : 0), pad); }
    },
  },
  beads: {
    // a string of beads at the throat: three colours, none bright
    front: (r) => {
      const c = [r.p.mat(r.look.accent, { flat: true }), flat(r, '#3a8ac0'), flat(r, '#c04a3a')], cx = Math.round(cxOf(r)) + 1;
      [[-2, 1], [-1, 2], [0, 2], [1, 2], [2, 1]].forEach(([dx, dy], i) => r.p.px(cx + dx, r.sh + dy, c[i % 3]));
    },
  },
  // ── scaled folk (naga, dragon, merfolk) ──
  scales: {
    // scales on the cheek, the neck and the forearm: a light and a dark one in turn
    front: (r) => {
      const lt = flat(r, tone(r.look.skin, 3)), dk = flat(r, shadowOf(r.look.skin)), [ex, ey] = eyeAt(r);
      r.p.px(ex, ey + 2, dk); r.p.px(ex - 1, ey + 3, lt); r.p.px(ex - 2, ey + 2, lt); r.p.px(ex - 3, ey + 1, dk);
      armMarks(r, [0.62, 0.74, 0.86], dk);
      const [ax, ay] = nearArm(r, 0.68); r.p.px(ax + 1, ay, lt);
    },
    lower: (r) => {
      // along the tail of a naga: a diamond of lighter scales over the coils
      if (r.look.body.lower !== 'serpent') return;
      const c = coils(r), lt = flat(r, tone(r.look.skin, 3));
      for (let i = 0; i < 6; i++) r.p.px(c.cx - c.rx1 + 3 + i * (c.rx1 * 1.6 / 6), c.gy - c.h1 + 1 + (i % 2), lt);
      for (let i = 0; i < 3; i++) r.p.px(c.cx - c.rx2 + 3 + i * (c.rx2 * 1.5 / 3), c.gy - c.h1 - c.h2 + 3 + (i % 2), lt);
    },
  },
  hood: {
    // the cobra hood: a narrow fold behind the head, spread wide when angry, an accent edge
    back: (r) => {
      const { p } = r, [hx, hy] = r.head, [rx, ry] = r.hr, wide = isAngry(r);
      const body = p.mat(shadowOf(r.look.skin), { deep: true }), edge = p.mat(r.look.accent);
      const cx = hx - rx * 0.7, rw = wide ? rx * 2.1 : rx * 1.3, rh = wide ? ry * 1.5 : ry * 1.15;
      p.ell(cx, hy + (wide ? 0.5 : 0), rw + 0.6, rh + 0.6, edge);
      p.ell(cx, hy + (wide ? 0.5 : 0), rw - 0.4, rh - 0.4, body);
      if (wide) p.px(cx - 1, hy, p.mat(tone(r.look.skin, 3), { flat: true }));
    },
  },
  goldjewel: {
    // gold on the upper arm and a chain at the waist
    nearArm: (r) => { const g = r.p.mat('#e0b040'), [x, y] = nearArm(r, 0.25); r.p.rect(Math.round(x) - 1, Math.round(y), armW(r), 1, g); },
    torso: (r) => { const g = r.p.mat('#e0b040'); for (let x = r.x0; x < r.x0 + r.tw; x += 2) r.p.px(x, r.hip - (r.k >= 0.75 ? 4 : 3), g); },
  },
  shedskin: {
    // the old skin, pale and see-through, trailing from the shoulder like a scarf
    back: (r) => {
      const { p } = r, s = solid(r, mixHex(r.look.skin, '#ffffff', 0.7), 0.6), f = sway(r);
      stroke(p, [r.x0 + 1, r.sh + 2], [r.x0 - 3 - f, r.sh + 7], 2, s);
      stroke(p, [r.x0 - 3 - f, r.sh + 7], [r.x0 - 4 + f, r.hip + 1], 2, s, s, 0.5, 0.6);
    },
  },
  // ── horned folk ──
  horns: {
    // two curved horns over the brow: the near one is drawn whole, the far one shows past it; they grow with age, women's are thinner
    hair: (r) => {
      const { p, k } = r, [hx] = r.head, top = Math.round(topY(r)) + 1, col = horn(r), old = r.look.stage === 'elder', child = r.look.stage === 'child' || r.look.stage === 'infant';
      const len = Math.max(2, Math.round(r.hh * (old ? 0.85 : child ? 0.35 : 0.7))), w = 1;
      const h = p.mat(col), lite = p.mat(tone(col, 3), { flat: true });
      const near: Pt = [hx - 1, top], mid: Pt = [near[0] - len * 0.35, top - len * 0.8], end: Pt = [near[0] - len * 0.1 - (r.look.race === 'demonkin' ? -1 : 1.5), top - len * 1.15];
      stroke(p, [hx + r.hr[0] * 0.5, top + 1], [hx + r.hr[0] * 0.55, top - len * 0.8], 1, h, lite, 0.5); // the far one, straight up
      stroke(p, near, mid, r.look.fem || child ? 1 : 2, h, h, 0.5, 0.5);
      stroke(p, mid, end, 1, h, lite, 0.6);
    },
  },
  'tail:lizard': {
    // a thick tail that drags behind along the ground, spined along the back, tapering to the tip
    back: (r) => {
      const { p, k } = r, s = sway(r), root = tailRoot(r), gy = r.foot - 1, sp = p.mat(r.look.accent, { flat: true });
      const pts: Pt[] = [root, [root[0] - 3 * k, root[1] + 3 * k], [root[0] - 6 * k, gy - 2 - s * 0.5], [root[0] - 10 * k, gy - 1 + s * 0.5 - (s ? 1 : 0)]];
      const w = Math.max(2, Math.round(3.4 * k));
      const path: Pt[] = [];
      for (let i = 0; i < 3; i++) path.push(...stroke(p, pts[i], pts[i + 1], Math.max(1, Math.round(w * (1 - i * 0.28))), r.m.skin, r.m.skin, 0.5, 0.35));
      path.forEach(([x, y], i) => { if (i % 3 === 1) p.px(x, y - Math.ceil(w / 2), sp); });
    },
  },
  fangs: {
    // two small fangs at the lip (not shown by a closed mouth: a pixel, no more)
    front: (r) => { const [ex, ey] = eyeAt(r); r.p.px(ex, ey + 3, flat(r, '#f4f0e8')); if (r.look.race === 'vampire') r.p.px(ex - 2, ey + 3, flat(r, '#f4f0e8')); },
  },
  'tail:spade': {
    // a thin whip of a tail ending in a spade, curling up behind
    back: (r) => {
      const { p, k } = r, s = sway(r), root = tailRoot(r), c = p.mat(shadowOf(r.look.skin)), sp = p.mat(r.look.skin);
      const a: Pt = [root[0] - 3 * k, root[1] + 3 * k], b: Pt = [root[0] - 6 * k - s, root[1] + 1 * k], t: Pt = [root[0] - 7 * k - s * 1.5, root[1] - 5 * k];
      stroke(p, root, a, 1, c); stroke(p, a, b, 1, c); stroke(p, b, t, 1, c);
      p.poly([[t[0], t[1] - 3], [t[0] + 2, t[1]], [t[0], t[1] + 1], [t[0] - 2, t[1]]], sp);
    },
  },
  contract: {
    // thin glowing marks of the contract on the brow and the forearm, and the contract itself rolled at the belt (flat glow)
    front: (r) => {
      const { p } = r, g = flat(r, r.look.accent), top = Math.round(topY(r));
      p.px(r.head[0] + 1, top + 2, g); p.px(r.head[0] + 1, top + 3, g); p.px(r.head[0] - 1, top + 2, g);
      armMarks(r, [0.62, 0.8], g);
      p.rect(r.x0 + 1, r.hip - 1, 1, 3, r.m.bone); p.px(r.x0 + 1, r.hip + 1, flat(r, '#d02a4a'));
    },
  },
  // ── vampire ──
  tallcollar: {
    // a collar that stands up behind the neck and the ears, lined in the deep colour
    torso: (r) => {
      const { p } = r, [hx, hy] = r.head, rx = r.hr[0], out = p.mat(tone(r.look.main, 0)), lin = p.mat(r.look.second);
      p.poly([[r.x0, r.sh + 2], [r.x0 + 3, r.sh + 1], [hx - rx * 0.2, hy + 1], [hx - rx * 1.05, hy - 0.5]], out);
      p.poly([[r.x0 + 1, r.sh + 2], [r.x0 + 3, r.sh + 1], [hx - rx * 0.3, hy + 1.5]], lin);
      p.poly([[r.x0 + r.tw - 2, r.sh + 1], [r.x0 + r.tw, r.sh + 2], [hx + rx * 0.5, hy + ry(r) * 0.9], [hx + rx * 0.1, hy + ry(r) * 0.9]], out);
    },
  },
  ledger: {
    // the ledger of blood debts on the belt: a small black book, a red clasp
    front: (r) => {
      const { p } = r, x = r.x0 + r.tw - 4, y = r.hip - 1, book = p.mat('#1c1620');
      p.rect(x, y, 3, 4, book); p.px(x + 2, y + 1, flat(r, '#8a1a2a')); p.px(x, y + 3, flat(r, '#d9a030'));
    },
  },
  redeyes: {
    // the eye glows red (flat) with a faint halo
    front: (r) => {
      const [ex, ey] = eyeAt(r), c = flat(r, '#e03040');
      r.p.px(ex - 1, ey, flat(r, '#ff2040', 0.45)); r.p.px(ex, ey - 1, flat(r, '#ff2040', 0.4)); r.p.px(ex, ey + 1, flat(r, '#ff2040', 0.4)); r.p.px(ex, ey, c);
    },
  },
  // ── fae ──
  'wings:insect': { back: insectWing },
  sparkle: {
    // dust that glitters round the figure: three of four specks at a time, one of them a little star (flat)
    front: (r) => {
      const { p, H } = r, g = flat(r, r.look.accent), w = flat(r, '#ffffff'), cx = cxOf(r), cy = r.sh + r.H * 0.15;
      const spots: Pt[] = [[-H * 0.55, -H * 0.2], [H * 0.5, -H * 0.4], [H * 0.6, H * 0.1], [-H * 0.4, H * 0.35]];
      spots.forEach(([dx, dy], i) => { if ((i + r.f + (r.pose === 'walk' ? 1 : 0)) % 4 === 0) return; p.px(cx + dx, cy + dy + ((r.f + i) % 2), i % 2 ? g : w); });
      const [sx, sy] = spots[(r.f + 1) % 4]; p.px(cx + sx + 1, cy + sy, w); p.px(cx + sx - 1, cy + sy, w); p.px(cx + sx, cy + sy - 1, w); p.px(cx + sx, cy + sy + 1, w);
    },
  },
  antenna: {
    // two fine feelers from the brow, bobbing, a bead on each tip
    front: (r) => {
      const { p } = r, [hx] = r.head, top = Math.round(topY(r)) + 1, s = r.f % 2, a = p.mat(tone(r.look.skin, 0), { flat: true }), bead = flat(r, r.look.accent);
      for (const [dx, tx] of [[0.5, 2.5 + s], [-1, -2.5 - s * 0.5]]) { p.line([hx + dx, top], [hx + tx, top - 4], a); p.px(hx + tx, top - 4, bead); }
    },
  },
  // ── slime ──
  gel: {
    // a nucleus that beats in the chest (a flat core with a pale halo), and the shine on the gel; no eye and no mouth
    front: (r) => {
      const { p } = r, cx = Math.round(cxOf(r)), ny = Math.round(r.sh + Math.max(2, (r.hip - r.sh) * 0.4)), beat = r.f % 2 === 0 || r.pose === 'walk' && r.f === 2;
      const halo = p.mat(mixHex(r.look.skin, '#ffffff', 0.55), { alpha: 0.85, flat: true }), core = flat(r, r.look.accent);
      const big = r.tw >= 8;
      p.rect(cx - 1 - (beat ? 1 : 0), ny - 1 - (beat ? 1 : 0), 3 + (beat ? 2 : 0), 3 + (beat ? 2 : 0), halo);
      p.rect(cx - (big ? 1 : 0), ny - (big ? 1 : 0), big ? 3 : 2, big ? 3 : 2, core);
      const sh = flat(r, '#ffffff', 0.85);
      p.px(r.head[0] - r.hr[0] * 0.6, topY(r) + 1.5, sh); p.px(r.head[0] - r.hr[0] * 0.6 + 1, topY(r) + 1, sh);
      p.px(r.x0 + 1, r.sh + 3, sh); p.px(r.x0 + 1, r.sh + 4, sh);
    },
  },
  swallowed: {
    // what the slime has swallowed floats inside: a coin, a bone, a flower (they bob a pixel)
    torso: (r) => {
      const { p } = r, b = (r.f + 1) % 2, a = 0.9;
      const gy = r.hip + Math.max(1, Math.round(r.legs * 0.3));
      p.rect(r.x0 + 1, gy + b, 2, 2, solid(r, '#d9a030', a));
      p.line([r.x0 + r.tw - 1, gy - 1 - b], [r.x0 + r.tw + 1, gy + 1 - b], solid(r, '#e8e0cc', a));
      p.px(r.x0 + r.tw - 1, gy - 1 - b, solid(r, '#e8e0cc', a)); p.px(r.x0 + r.tw + 1, gy + 1 - b, solid(r, '#e8e0cc', a));
      p.rect(r.x0 + 3, gy + 2 - b, 2, 1, solid(r, '#d06a9a', a)); p.px(r.x0 + 3, gy + 1 - b, solid(r, '#d06a9a', a)); p.px(r.x0 + 4, gy + 3 - b, solid(r, '#e0c04a', a));
    },
  },
  hairless: {
    // no hair at all (person.ts leaves the hair out): the crown catches a light
    hair: (r) => { const [hx] = r.head, top = Math.round(topY(r)); r.p.px(hx - 1, top + 1, flat(r, tone(r.look.skin, 3))); r.p.px(hx, top + 1, flat(r, tone(r.look.skin, 3))); },
  },
  // ── merfolk ──
  gills: {
    // gill slits on the neck, two or three dark lines
    front: (r) => {
      const [hx, hy] = r.head, y = Math.round(hy + r.hr[1]) - 1, k = ink(r, 0.65);
      r.p.px(hx - 2, y, k); r.p.px(hx - 2, y + 1, k); r.p.px(hx - 1, y, k);
    },
  },
  pearls: {
    // a string of pearls at the throat and one at the temple (white, with the shadow of the painter)
    front: (r) => {
      const { p } = r, w = p.mat('#f4f0f0'), cx = Math.round(cxOf(r)) + 1;
      [[-2, 1], [-1, 2], [0, 2], [1, 2], [2, 1]].forEach(([dx, dy]) => p.px(cx + dx, r.sh + dy, w));
      p.px(r.head[0] - r.hr[0] * 0.3, Math.round(topY(r)) + 2, w);
    },
  },
  finskirt: {
    // fins that flare from the hem on both sides, thin and a little see-through; they flutter even when nothing moves
    lower: (r) => {
      const { p } = r, gy = r.foot, cx = cxOf(r), wb = r.tw + 4 + Math.round(r.k * 2), left = cx - wb / 2 - r.flap * 0.5, right = cx + wb / 2 + 1;
      const fin = p.mat(mixHex(r.look.accent, '#ffffff', 0.35), { alpha: 0.85 }), rib = p.mat(tone(r.look.accent, 0), { flat: true, alpha: 0.9 });
      p.poly([[left + 1, gy - 8], [left - 3 - r.flap, gy - 1], [left + 3, gy - 1]], fin);
      p.poly([[right - 1, gy - 8], [right + 3 + r.flap, gy - 1], [right - 3, gy - 1]], fin);
      p.px(left - 1, gy - 3, rib); p.px(right + 1, gy - 3, rib);
    },
  },
  wet: {
    // the skin is wet: bright flecks on the head, the shoulder and the arm, and a drip from the hand
    front: (r) => {
      const { p } = r, w = flat(r, '#e8f6ff'), drip = flat(r, '#bfe4f0', 0.8), top = Math.round(topY(r));
      p.px(r.head[0] - 1, top + 1, w); p.px(r.x0 + 1, r.sh + 1, w); armMarks(r, [0.35, 0.75], w);
      p.px(r.hand[0], r.hand[1] + 2 + r.f % 2, drip);
    },
  },
  // ── winged ──
  'wings:feather': {
    back: (r) => { const lite = mixHex(r.look.accent, '#ffffff', r.look.accent.toLowerCase() === '#ffffff' ? 0 : 0.55); featherWing(r, lite, shadowOf(lite)); },
  },
  sunstrap: {
    // the chest strap that holds the wings: leather across the chest to the far hip, a gold sun where it crosses
    torso: (r) => {
      const { p } = r, a: Pt = [r.x0 + r.tw - 2, r.sh], b: Pt = [r.x0 + 1, r.hip - 3], c = lerp(a, b, 0.45);
      stroke(p, a, b, 2, r.m.leather);
      p.rect(Math.round(c[0]) - 1, Math.round(c[1]) - 1, 3, 3, p.mat('#d9a030')); p.px(c[0], c[1], flat(r, '#ffe8a0'));
    },
  },
  goldcirclet: {
    // a thin gold band across the brow with a pale gem
    front: (r) => {
      const { p } = r, [hx] = r.head, rx = r.hr[0], y = Math.round(topY(r)) + 2, g = p.mat('#d9a030');
      for (let x = Math.round(hx - rx * 0.85); x <= Math.round(hx + rx * 0.8); x++) p.px(x, y, g);
      p.px(hx + rx * 0.2, y, flat(r, '#8ac8f0'));
    },
  },
  // ── giant ──
  stone: {
    // skin of rock: a plate on the shoulder, pale and dark flakes on the head, the chest and the arm
    torso: (r) => {
      const { p } = r, lt = p.mat(tone(r.look.skin, 3)), dk = flat(r, shadowOf(r.look.skin));
      p.rect(r.x0 + r.tw - 4, r.sh, 4, 3, p.mat(r.look.skin)); p.rect(r.x0 + r.tw - 4, r.sh, 3, 1, lt);
      p.rect(r.x0 + 1, r.sh + 2, 2, 2, lt); p.px(r.x0 + 3, r.sh + 5, dk); p.px(r.x0 + 2, r.sh + 6, dk); p.px(r.x0 + 2, r.sh + 7, dk);
    },
    front: (r) => {
      const { p } = r, [hx, hy] = r.head, dk = flat(r, shadowOf(r.look.skin)), lt = flat(r, tone(r.look.skin, 3));
      p.px(hx - 1, Math.round(topY(r)) + 2, lt); p.px(hx + 1, hy - 1, dk); p.px(hx, hy + 2, dk); p.px(hx - 2, hy + 1, lt);
      armMarks(r, [0.65], dk);
    },
  },
  moss: {
    // moss on the shoulders and in the cracks: patches that hang over the edge
    torso: (r) => {
      const { p } = r, m = r.m.accent, lt = flat(r, tone(r.look.accent, 3));
      p.rect(r.x0, r.sh - 1, 4, 2, m); p.px(r.x0, r.sh + 1, m); p.px(r.x0 + 2, r.sh + 1, m); p.px(r.x0 + 1, r.sh - 1, lt);
      p.rect(r.x0 + r.tw - 3, r.sh - 1, 3, 2, m); p.px(r.x0 + r.tw - 1, r.sh + 1, m); p.px(r.x0 + r.tw - 2, r.sh - 1, lt);
    },
  },
  heavybrow: {
    // a ridge of brow over deep eyes: shaded, and it stands out from the profile
    front: (r) => {
      const [ex, ey] = eyeAt(r), s = r.p.mat(mixHex(r.look.skin, '#2a1c14', 0.55), { flat: true });
      r.p.px(ex - 2, ey - 1, s); r.p.px(ex - 1, ey - 1, s); r.p.px(ex, ey - 1, s); r.p.px(ex + 1, ey - 1, r.m.skin);
      r.p.px(ex - 1, ey - 2, r.m.skin); r.p.px(ex, ey - 2, r.m.skin);
    },
  },
  // ── lava folk ──
  cracks: {
    // cracks of glowing lava across the dark skin: brow, neck, chest and forearm. They beat; on the old they are fewer and cold (flat)
    front: (r) => {
      const { p } = r, old = r.look.stage === 'elder', g = flat(r, old ? tone(r.look.accent, 1) : r.f % 2 ? tone(r.look.accent, 3) : r.look.accent), [hx] = r.head, top = Math.round(topY(r));
      p.px(hx + 1, top + 2, g); p.px(hx + 2, top + 3, g);
      p.line([r.x0 + 1, r.sh + 2], [r.x0 + 3, r.sh + 4], g); p.px(r.x0 + 3, r.sh + 5, g);
      if (old) return;
      p.line([r.x0 + 3, r.sh + 4], [r.x0 + 2, r.sh + 7], g);
      armMarks(r, [0.6, 0.72, 0.84], g);
      p.px(hx - 1, r.head[1] + r.hr[1] - 1, g);
    },
  },
  embers: {
    // embers rise from the shoulders: three sparks, each higher at the next frame (flat)
    front: (r) => {
      const { p } = r, c = [flat(r, r.look.accent), flat(r, '#ffc040'), flat(r, tone(r.look.accent, 1))];
      for (let i = 0; i < 3; i++) p.px(r.x0 + 1 + i * Math.max(2, Math.round(r.tw / 3)) + ((r.f + i) % 2), r.sh - 1 - ((r.f * 2 + i * 3) % 7), c[i]);
    },
  },
  flamehair: {
    // hair of flame: tongues that flicker on the head and stream back from it (flat)
    back: (r) => {
      const { p } = r, [hx, hy] = r.head, c = flat(r, r.look.accent), y = flat(r, '#ffc040');
      const L = [3, 4, 3, 5][r.f % 4] + (r.pose === 'walk' ? 1 : 0);
      p.poly([[hx - r.hr[0] * 0.6, hy - 1], [hx - r.hr[0] - L, hy - 2 - L * 0.6], [hx - r.hr[0] * 0.8, hy + 1]], c);
      p.px(hx - r.hr[0] - L * 0.4, hy - 1 - L * 0.3, y);
    },
    hair: (r) => {
      const { p } = r, [hx] = r.head, top = Math.round(topY(r)) + 1, c = flat(r, r.look.accent), y = flat(r, '#ffc040'), d = flat(r, tone(r.look.accent, 1));
      const h = [[3, 5, 4, 3], [4, 3, 5, 4], [5, 4, 3, 5], [3, 4, 5, 3]][r.f % 4];
      h.forEach((ht, i) => {
        const x = Math.round(hx - r.hr[0] * 0.8 + i * (r.hr[0] * 1.5 / 3));
        p.rect(x, top - ht + 1, 2, ht, i % 2 ? c : d); p.px(x, top - ht, c); p.px(x + (i % 2), top - ht + 1, y);
      });
    },
  },
  'glow-eyes': { front: eyeGlow },
  // ── hybrid and golem ──
  plates: {
    // iron plates: a pauldron on the shoulder, a bracer on the forearm, a plate on the knee
    torso: (r) => {
      const { p } = r, m = r.m.metal, lt = flat(r, tone('#9a9ea6', 3));
      p.rect(r.x0 + r.tw - 4, r.sh, 4, 3, m); p.rect(r.x0 + r.tw - 4, r.sh, 3, 1, lt);
      p.rect(r.x0, r.sh, 2, 2, m);
    },
    nearArm: (r) => { const [x, y] = nearArm(r, 0.7), w = armW(r); r.p.rect(Math.round(x) - (w >> 1), Math.round(y) - 1, w, 2, r.m.metal); },
    lower: (r) => {
      if (r.sit || r.kneel || r.infant) return;
      const w = Math.max(2, Math.round(r.tw / 3.2)), y = Math.round(r.hip + r.legs * 0.45);
      r.p.rect(r.near.x + (r.near.fx - r.near.x) * 0.45, y, w, 2, r.m.metal);
    },
  },
  rivets: {
    // bright rivets on the plates, the belt and the cuffs (flat)
    front: (r) => {
      const l = flat(r, '#f0e0a8'), belt = r.hip - (r.k >= 0.75 ? 3 : 2);
      r.p.px(r.x0 + r.tw - 4, r.sh, l); r.p.px(r.x0 + r.tw - 1, r.sh + 2, l); r.p.px(r.x0 + 2, belt, l); r.p.px(r.x0 + r.tw - 2, belt, l);
      const [x, y] = nearArm(r, 0.7); r.p.px(x, y - 1, l);
    },
  },
  steam: {
    // steam from the joints: two puffs rise and thin out (a pale, see-through white)
    front: (r) => {
      const { p } = r, s = flat(r, '#f2f4f8', 0.7), t = flat(r, '#f2f4f8', 0.4);
      for (let i = 0; i < 2; i++) {
        const x = r.x0 + r.tw - 1 + i * 2 + (r.f % 2), y = r.sh - 1 - ((r.f * 2 + i * 3) % 6);
        p.rect(x, y, 2, 2, s); p.px(x + 1, y - 1, t);
      }
    },
  },
  mecheye: {
    // an eye of brass and glass: a brass ring and a cyan lens (flat)
    front: (r) => {
      const [ex, ey] = eyeAt(r), br = r.p.mat('#c08a3a');
      r.p.rect(ex - 1, ey - 1, 3, 3, br); r.p.px(ex, ey, flat(r, '#6ad0ff'));
    },
  },
  mecharm: {
    // the near arm is brass and iron: an upper arm, a joint, a forearm, three claws for fingers
    nearArm: (r) => {
      const { p } = r, w = armW(r), br = p.mat('#c08a3a'), fe = p.mat('#8a94a4'), jt = flat(r, '#2a2a30');
      const j = nearArm(r, 0.5);
      stroke(p, r.shoulderNear, j, w, br);
      stroke(p, j, r.hand, w, fe);
      p.px(j[0], j[1], jt);
      const [hx, hy] = r.hand; p.rect(Math.round(hx) - (w >> 1), Math.round(hy) - (w >> 1), w, w, fe);
      p.px(hx + 1, hy + 1, jt); p.px(hx + 1 + (w >> 1), hy, fe);
    },
  },
  core: {
    // the glass of the soul in the chest: a flat cyan core with a halo that dims and brightens
    front: (r) => {
      const { p } = r, cx = Math.round(cxOf(r)) + 1, ny = Math.round(r.sh + Math.max(2, (r.hip - r.sh) * 0.35)), on = r.f % 2 === 0 || r.pose === 'walk';
      const g = flat(r, r.look.accent), h = flat(r, r.look.accent, on ? 0.5 : 0.3), frame = p.mat('#2a2a32', { flat: true });
      p.rect(cx - 2, ny - 2, 4, 4, frame); p.rect(cx - 1, ny - 1, 2, 2, g);
      p.rect(cx - 3, ny - 1, 1, 2, h); p.rect(cx + 2, ny - 1, 1, 2, h); p.rect(cx - 1, ny - 3, 2, 1, h); p.rect(cx - 1, ny + 2, 2, 1, h);
    },
  },
  visor: {
    // a dark band across the eyes with two points of fire (flat)
    front: (r) => {
      const { p } = r, [ex, ey] = eyeAt(r), band = p.mat('#24242c', { flat: true }), e = flat(r, r.look.eye);
      p.rect(ex - 3, ey - 1, 5, 3, band);
      p.px(ex - 2, ey, e); p.px(ex, ey, e);
    },
  },
  seams: {
    // the joints between the pieces: a line down the head, down the chest, round the neck and the elbow
    front: (r) => {
      const { p } = r, k = flat(r, mixHex(r.look.skin, '#101014', 0.7)), [hx, hy] = r.head, top = Math.round(topY(r));
      p.line([hx - r.hr[0] * 0.3, top + 1], [hx - r.hr[0] * 0.3, hy + 1], k);
      p.line([r.x0 + 1, r.sh + 1], [r.x0 + 1, r.hip - 4], k);
      for (let x = Math.round(hx - 2); x <= Math.round(hx); x++) p.px(x, r.sh, k);
      const [ex, ey] = nearArm(r, 0.5); p.px(ex, ey, k);
    },
  },
  // ── mummy ──
  wraps: {
    // linen wound over everything: the head (a slit left for the eyes), the chest in diagonals, the legs in rings, the arms in bands, ends that hang
    hat: (r) => {
      const { p } = r, [hx, hy] = r.head, [rx, ry] = r.hr, lin = p.mat(r.look.main), line = flat(r, shadowOf(r.look.main)), slit = flat(r, '#16120e');
      p.ell(hx - 0.2, hy - 0.2, rx + 0.6, ry + 0.6, lin);
      const [ex, ey] = eyeAt(r);
      for (let i = -ry; i < ry; i += 2) p.line([hx - rx - 0.5, hy + i + 1], [hx + rx + 0.5, hy + i - 1], line);
      p.px(ex, ey, slit); p.px(ex - 1, ey, slit); p.px(ex - 2, ey, slit); p.px(ex + 1, ey, slit);
      p.px(hx - rx - 1, hy + 1, lin); p.px(hx - rx - 2, hy + 2 + (r.f % 2), lin);
    },
    torso: (r) => {
      const line = flat(r, shadowOf(r.look.main));
      for (let y = r.sh + 1; y < r.hip - 1; y++) for (let x = r.x0; x < r.x0 + r.tw; x++) if (((x - r.x0) + (y - r.sh) * 1) % 4 === 0 && r.p.at(x, y)) r.p.px(x, y, line);
    },
    lower: (r) => {
      if (r.sit || r.kneel || r.look.body.lower !== 'legs') return;
      const line = flat(r, shadowOf(r.look.second));
      for (const L of [r.far, r.near]) for (let y = r.hip + 2; y < r.foot - 3 - L.lift; y += 3) { const x = Math.round(L.x + (L.fx - L.x) * ((y - r.hip) / Math.max(1, r.foot - r.hip))); r.p.rect(x, y, Math.max(1, Math.round(r.tw / 3.2)), 1, line); }
    },
    nearArm: (r) => { const line = flat(r, shadowOf(r.look.main)); armMarks(r, [0.25, 0.45, 0.65, 0.85], line); },
    front: (r) => {
      // the loose end hanging from the belt and one from the elbow
      const lin = r.p.mat(r.look.main), s = sway(r);
      r.p.line([r.x0 + 2, r.hip], [r.x0 + 2 + s, r.hip + 4], lin);
      const [x, y] = nearArm(r, 0.55); r.p.line([x, y + 1], [x - 1 - s * 0.5, y + 4], lin);
    },
  },
  usekh: {
    // the broad gold collar: three arcs of gold, blue and gold across the chest
    torso: (r) => {
      const { p } = r, cx = Math.round(cxOf(r)) + 1, w = Math.max(3, Math.min(7, r.tw - 1)), gold = r.m.accent, blue = p.mat('#2a6aa0');
      p.rect(cx - (w >> 1), r.sh + 1, w, 1, gold);
      p.rect(cx - ((w - 2) >> 1), r.sh + 2, w - 2, 1, blue);
      p.rect(cx - ((w - 4) >> 1), r.sh + 3, Math.max(1, w - 4), 1, gold);
    },
  },
  kohl: {
    // black liner round the eye, drawn out to a wing, and the eye mark on the brow
    front: (r) => {
      const { p } = r, [ex, ey] = eyeAt(r), k = flat(r, '#16141a');
      p.px(ex - 1, ey, k); p.px(ex - 2, ey + 1, k); p.px(ex + 1, ey + 1, k); p.px(ex, ey + 1, k);
      const top = Math.round(topY(r)) + 2; p.px(r.head[0] + 1, top, flat(r, '#2a6aa0')); p.px(r.head[0] + 2, top, r.m.accent); p.px(r.head[0] + 1, top + 1, r.m.accent);
    },
  },
  dust: {
    // dust that falls from the wraps and the feet: sand-coloured specks that drop one row a frame (flat)
    front: (r) => {
      const { p } = r, c = flat(r, '#d4bc88', 0.75), n = r.f % 4;
      p.px(r.hand[0], r.hand[1] + 2 + n % 3, c); p.px(r.x0 + 1, r.hip + 2 + (n + 1) % 3, c); p.px(r.x0 + r.tw, r.foot - 2 - ((n + 2) % 3), c);
    },
  },
  // ── ghoul ──
  gaunt: {
    // hollow cheek, the cords of the neck and the blades of the shoulder: skin on bone
    front: (r) => {
      const { p } = r, [hx, hy] = r.head, [, ey] = eyeAt(r), d = flat(r, mixHex(r.look.skin, '#1a2018', 0.55));
      p.px(Math.round(hx + r.hr[0] * 0.2), ey + 2, d); p.px(Math.round(hx + r.hr[0] * 0.2) - 1, ey + 3, d);
      p.px(hx - 1, Math.round(hy + r.hr[1]) - 1, d); p.px(hx + 1, Math.round(hy + r.hr[1]) - 1, d);
      p.px(r.x0 + 1, r.sh + 3, d); p.px(r.x0 + 1, r.sh + 4, d);
    },
  },
  claws: {
    // long nails: three pale points past each hand
    front: (r) => {
      const { p } = r, n = flat(r, '#d8d0b0');
      for (const [a, h] of [[r.shoulderNear, r.hand], [r.shoulderFar, r.farHand]] as [Pt, Pt][]) {
        const dx = h[0] - a[0], dy = h[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
        for (const o of [-1, 0, 1]) { const bx = h[0] + ux + -uy * o, by = h[1] + uy + ux * o; p.px(bx + ux, by + uy, n); p.px(bx + ux * 2, by + uy * 2, n); }
      }
    },
  },
  ribs: {
    // the ribs show through where the cloth is gone: a patch of skin on the chest with a dark line between each rib
    torso: (r) => {
      const { p } = r, w = Math.max(3, r.tw - 4), h = Math.min(7, r.hip - r.sh - 3), x = r.x0 + 1, k = flat(r, mixHex(r.look.skin, '#141a14', 0.6));
      p.rect(x, r.sh + 2, w, h, r.m.skin);
      for (let y = r.sh + 3; y < r.sh + 2 + h; y += 2) p.rect(x + 1, y, w - 1, 1, k);
    },
  },
  hunger: {
    // the mouth hangs open and dark, a thread of spit; it never closes
    front: (r) => {
      const { p } = r, [ex, ey] = eyeAt(r), m = flat(r, '#160c0c');
      p.px(ex, ey + 2, m); p.px(ex, ey + 3, m); p.px(ex - 1, ey + 3, m);
      p.px(ex, ey + 4 + (r.f % 2), flat(r, '#c8d0c0', 0.8));
    },
  },
  sunkeneyes: {
    // eyes sunk deep in dark sockets
    front: (r) => {
      const { p } = r, [ex, ey] = eyeAt(r), k = flat(r, mixHex(r.look.skin, '#101410', 0.7));
      p.px(ex - 1, ey, k); p.px(ex, ey - 1, k); p.px(ex, ey + 1, k); p.px(ex - 1, ey - 1, k); p.px(ex - 1, ey + 1, k);
    },
  },

  // ── people ──
  scar: { front: (r) => { const [ex, ey] = eyeAt(r); r.p.line([ex - 3, ey - 2], [ex - 2, ey + 3], flat(r, mixHex(r.look.skin, '#b0605a', 0.7))); } },
  eyepatch: {
    // a black patch over the eye with its strap round the head
    front: (r) => {
      const { p } = r, [ex, ey] = eyeAt(r), k = p.mat('#16141a', { flat: true });
      p.rect(ex - 1, ey - 1, 3, 2, k); p.line([ex - 1, ey - 1], [r.head[0] - r.hr[0], Math.round(topY(r)) + 2], k); p.px(ex, ey + 1, k);
    },
  },
  halo: {
    // a ring of light over the head (flat gold), hovering a pixel up and down
    front: (r) => {
      const { p } = r, g = flat(r, '#f0d070'), cy = topY(r) - 2.5 - (r.f % 2) * 0.6, rx = r.hr[0] * 1.0;
      for (let a = 0; a < 360; a += 25) p.px(r.head[0] + Math.cos(a * DEG) * rx, cy + Math.sin(a * DEG) * 1.3, g);
    },
  },
  tattoo: {
    // ink: a curl on the cheek and bands on the forearm (a blue-black, flat)
    front: (r) => {
      const { p } = r, k = flat(r, '#243050'), [ex, ey] = eyeAt(r);
      p.px(ex - 1, ey + 2, k); p.px(ex - 2, ey + 2, k); p.px(ex - 2, ey + 3, k); p.px(ex - 3, ey + 3, k);
      armMarks(r, [0.3, 0.45, 0.6, 0.75], k);
    },
  },
  mask: {
    // cloth over the nose and mouth, its strap to the ear
    front: (r) => {
      const { p } = r, [hx, hy] = r.head, [rx, ry] = r.hr, [, ey] = eyeAt(r), c = p.mat(r.look.second);
      p.rect(Math.round(hx - rx * 0.2), ey + 1, Math.round(rx * 1.2) + 1, Math.max(2, Math.round(hy + ry - ey - 1)), c);
      p.line([hx - rx * 0.7, ey + 1], [hx - rx * 0.2, ey + 1], c);
    },
  },
  bandage: {
    // a band round the head with a spot of blood, and one round the forearm
    front: (r) => {
      const { p } = r, [hx] = r.head, rx = r.hr[0], y = Math.round(topY(r)) + 2, b = r.m.bone;
      p.rect(Math.round(hx - rx), y, Math.round(rx * 2) + 1, 2, b); p.px(hx + 1, y, flat(r, '#8a2a2a')); p.px(hx - rx - 1, y + 2 + (r.f % 2), b);
      armMarks(r, [0.7, 0.78], b);
    },
  },
  blind: {
    // a milk-white eye, and no brow lifted for anything
    front: (r) => { const [ex, ey] = eyeAt(r); r.p.px(ex, ey, flat(r, '#d4d8e0')); r.p.px(ex - 1, ey, flat(r, '#b8bcc8')); },
  },
  freckles: {
    // three freckles
    front: (r) => { const [ex, ey] = eyeAt(r), k = flat(r, mixHex(r.look.skin, '#6a3a20', 0.45)); r.p.px(ex - 2, ey + 1, k); r.p.px(ex - 1, ey + 2, k); r.p.px(ex - 3, ey + 2, k); },
  },
  'wings:scale': {
    // thin wings like a dragon's: bone and membrane in a red-brown, scales on the arm
    back: (r) => batWing(r, mixHex(r.look.skin, '#a04a3a', 0.6), '#3a1a14', true),
  },
  'wings:night': {
    // wings like a bat's, black-violet
    back: (r) => batWing(r, '#34283f', '#161020', false),
  },
  missingarm: {
    // the far arm is gone: the empty sleeve is knotted short at the shoulder
    farArm: (r) => {
      const { p } = r, s = p.mat(shadowOf(r.look.main)), n = p.mat(r.look.second), w = armW(r);
      p.rect(r.x0 - 1, r.sh + 1, w + 1, 4, s); p.px(r.x0 - 1, r.sh + 4, n); p.px(r.x0, r.sh + 4, n);
    },
  },
};

function ry(r: Rig): number { return r.hr[1]; }
void hexOf;
