// Painter features (ลักษณะที่วาดเพิ่ม of 02-races.md, and personal marks): wings, tails, horns, crests, runes, glows, scars.
// Each is a part with whatever layers it needs. Rules of this table:
//  - marks on the face are drawn in `front` (the last layer), so a hat, a hood or hair never covers them;
//  - things behind the body (wings, tails, a cobra hood) are drawn in `back`, things on the clothes in `torso` (the arms are drawn after it);
//  - glows (lavaglow, embers, core, glow-eyes, sparkle) are flat materials: one colour, no shading;
//  - wings and tails move with `r.flap` and the frame; the feats that need the limbs read r.shoulderNear → r.hand and the feet of `feet(r)`.
import type { Pt } from '../paint';
import type { Part, Rig } from '../rig';
import { coils, feet, hexOf, mixHex, shadowOf, stroke, tone, armW } from './body';
import { seedOf } from './kit';

// ── small helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const DEG = Math.PI / 180;
const flat = (r: Rig, hex: string, alpha = 1): number => r.p.mat(hex, { flat: true, alpha });
const solid = (r: Rig, hex: string, alpha = 1): number => r.p.mat(hex, { alpha });
const ink = (r: Rig, over = 0.7): number => r.p.mat(mixHex(r.look.skin, '#1a1210', over), { flat: true });
/** A glow pixel on the finished frame (no outline). */
const glowPx = (r: Rig, x: number, y: number, hex: string, a = 1): void => r.p.glow(x, y, hex, a);
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

/** How far a wing is open this frame: 0 folded against the back, 1 half, 2 spread. Wings are folded at rest (idle, walk, sit, pray, work) and open for attack, cast, cheer and hurt. */
export function wingOpen(r: Rig): 0 | 1 | 2 {
  switch (r.pose) {
    case 'cheer': return 2;
    case 'attack': case 'cast': return r.f === 0 ? 1 : 2;
    case 'hurt': return 1;
    case 'die': return r.f === 0 ? 1 : 0;
    default: return 0;
  }
}

/** Where a wing joins the back: the shoulder blade. */
const wingRoot = (r: Rig): Pt => [r.x0 + 1 + r.lean * 0.5, r.sh + 2];
/** The scale of a wing in pixels per unit: the figure's, shrunk when `reach` units would pass the left edge of the frame (a giant's spread wing). */
const wingScale = (r: Rig, reach: number): number => r.k * Math.min(1, Math.max(0.4, (wingRoot(r)[0] - 3) / (reach * r.k)));
const at = (b: Pt, dx: number, dy: number, s: number): Pt => [b[0] + dx * s, b[1] + dy * s];

/** A row of feathers: each a pointed blade from a root on the line `from`→`to`, with its own angle and length (the row is shaded by the painter where it meets the row above). */
function featherRow(r: Rig, from: Pt, to: Pt, degs: number[], lens: number[], wid: number, mat: number, tipMat?: number): void {
  const n = degs.length;
  for (let i = 0; i < n; i++) {
    const base = lerp(from, to, n > 1 ? i / (n - 1) : 0);
    blade(r, base, degs[i], lens[i], wid, mat);
    if (tipMat !== undefined) { const e = tip(base, degs[i], lens[i] * 0.96); r.p.px(e[0], e[1], tipMat); }
  }
}
const spread = (a: number, b: number, n: number): number[] => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / Math.max(1, n - 1));

/** A wing of feathers: folded it is the arch of the wing over the shoulder and three layered rows hanging down the back; open it is a long arm with a fan of primaries from the wrist, secondaries along the arm and short coverts on top. */
function featherWing(r: Rig, light: string, shade: string): void {
  const { p } = r, open = wingOpen(r), B = wingRoot(r);
  const dark = p.mat(shade), mid = p.mat(light), top = p.mat(mixHex(light, '#ffffff', 0.4)), edge = p.mat(mixHex(shade, '#000000', 0.2), { flat: true });
  if (open === 0) {
    const s = r.k, W = at(B, -2.2, -2.6, s), wid = 1.05 * s + 0.15;
    featherRow(r, W, at(B, -1.4, 1, s), spread(172, 163, 4), [13.2 * s, 12 * s, 10.6 * s, 9 * s], wid, dark, edge);
    featherRow(r, at(B, -0.6, -1.4, s), at(B, -0.4, 3, s), spread(178, 168, 4), [10 * s, 9 * s, 8 * s, 7 * s], wid, mid);
    featherRow(r, at(B, -0.8, -2.3, s), at(B, -0.2, 1.5, s), spread(180, 172, 4), [5.5 * s, 5 * s, 4.5 * s, 4 * s], wid * 0.9, top);
    p.ell(W[0] + 0.4, W[1] + 0.6, 1.6 * s + 0.3, 1.9 * s + 0.3, top);
    return;
  }
  const s = wingScale(r, open === 2 ? 24 : 17);
  // the arm rises up and back to the wrist; the primaries fan from the wrist (the first goes on along the arm), the secondaries and coverts trail from the arm toward the ground side
  const W = open === 2 ? at(B, -6, -8.5, s) : at(B, -4, -7, s);
  const wid = 1.25 * s + 0.2;
  const pri = open === 2 ? spread(34, 128, 6) : spread(12, 96, 5);
  const plen = pri.map((_, i) => (open === 2 ? 17 : 12) * s * (0.8 + 0.2 * Math.sin((i / (pri.length - 1)) * Math.PI * 0.85 + 0.55)));
  featherRow(r, W, at(W, -0.8, 0.8, s), pri, plen, wid, dark, edge);
  const sec = open === 2 ? spread(118, 152, 6) : spread(112, 150, 5);
  featherRow(r, lerp(W, B, 0.15), lerp(W, B, 0.95), sec, sec.map((_, i) => (open === 2 ? 14 - i * 1.1 : 10.5 - i) * s), wid, mid, edge);
  const cov = open === 2 ? spread(112, 150, 6) : spread(110, 148, 5);
  featherRow(r, W, lerp(W, B, 0.9), cov, cov.map((_, i) => (open === 2 ? 7 - i * 0.4 : 5.2 - i * 0.3) * s), wid * 0.95, top);
  p.ell(W[0] + 0.3, W[1] + 0.4, 1.4 * s + 0.3, 1.6 * s + 0.3, top);
}

/** A bat's wing: folded it is a hunched arm over the shoulder with the membrane hanging in scallops down the back; open it is an arm out and up, three finger bones, a scalloped membrane between them. */
function batWing(r: Rig, membrane: string, bone: string, scaled: boolean): void {
  const { p } = r, open = wingOpen(r), B = wingRoot(r);
  const mem = p.mat(membrane), bn = p.mat(bone, { flat: true });
  let W: Pt, tips: Pt[], L: Pt, s: number;
  if (open === 0) {
    s = r.k; W = at(B, -3, -4.5, s);
    tips = [at(B, -0.5, 8, s), at(B, -3, 10.5, s), at(B, -5.5, 8.5, s)];
    L = at(B, 0, 7, s);
    const notch = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2 + 0.6 * s, (a[1] + b[1]) / 2 - 1.8 * s];
    p.poly([B, W, tips[2], notch(tips[2], tips[1]), tips[1], notch(tips[1], tips[0]), tips[0], L], mem);
  } else {
    s = wingScale(r, open === 2 ? 23 : 15);
    const rel: Pt[] = open === 2 ? [[-4, -6], [-11, -2], [-11, 8]] : [[-3, -4.5], [-7, 0], [-6.5, 6.5]];
    W = open === 2 ? at(B, -11, -12, s) : at(B, -7, -8, s);
    tips = rel.map((v) => at(W, v[0], v[1], s));
    L = at(B, -0.5, open === 2 ? 10 : 8.5, s);
    const pull = (a: Pt, b: Pt): Pt => { const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; return lerp(m, W, 0.36); };
    p.poly([B, W, tips[0], pull(tips[0], tips[1]), tips[1], pull(tips[1], tips[2]), tips[2], pull(tips[2], L), L], mem);
  }
  stroke(p, B, W, 1, bn);
  for (const t of tips) stroke(p, W, t, 1, bn);
  p.px(W[0] - 1, W[1] - 1, bn); // the thumb claw
  if (scaled) for (let i = 0; i < 4; i++) { const q = lerp(B, tips[1], 0.3 + i * 0.16); p.px(q[0] - 1, q[1] + 1, p.mat(tone(membrane, 3), { flat: true })); }
}

/** A wing of a fairy: thin and clear, two pairs, flat down the back at rest (a small flutter), spread when she is roused. */
function insectWing(r: Rig): void {
  const { p, H } = r, open = wingOpen(r), B: Pt = [r.x0 + 1 + r.lean * 0.5, r.sh + 1], flick = r.f % 2;
  const pale = p.mat('#f4eaff', { alpha: 0.6, deep: true }), edge = p.mat(r.look.accent, { alpha: 0.9, flat: true }), vein = p.mat('#ffffff', { alpha: 0.9, flat: true });
  const spec: [number, number, number][] = open === 0
    ? [[172 - flick * 7, H * 0.48, 1.3], [180 - flick * 4, H * 0.36, 1.1]]
    : [[(open === 2 ? 108 : 128) - flick * 10, H * 0.66, 2.4], [(open === 2 ? 146 : 156) - flick * 6, H * 0.5, 1.9]];
  for (const [d, len0, wd] of spec) {
    const ln = Math.min(len0, (B[0] - 3) / Math.max(0.3, Math.abs(Math.sin(d * DEG)))); // never past the left edge of the frame
    blade(r, B, d, ln, wd * Math.max(1, r.k * 1.2), pale);
    const t = tip(B, d, ln);
    p.line(B, lerp(B, t, 0.6), vein);
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

/** The light of a machine's eye: the eye colour if it is bright, else the signature colour (`other` takes the one the first did not). */
const glowOf = (r: Rig, other = false): string => {
  const bright = (h: string) => (parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16)) / 3 > 110;
  const pick = bright(r.look.eye) ? r.look.eye : r.look.accent;
  return other ? (pick === r.look.accent ? mixHex(r.look.accent, '#ffffff', 0.4) : r.look.accent) : pick;
};
/** The colour of the iron plates: grey iron turned toward the second colour of the look. */
const plateHex = (r: Rig): string => mixHex('#9a9ea6', r.look.second, 0.4);
const plateOf = (r: Rig): number => r.p.mat(plateHex(r));

/** A bird and a lizard have no fur, whatever else the look carries. */
const noFur = (r: Rig): boolean => r.look.feats.includes('feathers') || r.look.feats.includes('crest');

/** A thin line of marks across the near forearm. */
const armMarks = (r: Rig, ts: number[], k: number): void => { for (const t of ts) { const [x, y] = nearArm(r, t); r.p.px(x, y, k); } };

// ── the feats ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const FEATS: Record<string, Part> = {
  // ── elf ──
  leafcrest: {
    // a thin circlet of leaves across the brow and behind the ear: the hair above it and its colour stay visible (not a cap)
    front: (r) => {
      const { p } = r, [hx] = r.head, rx = r.hr[0], y = Math.round(topY(r)) + (r.hh >= 6 ? 2 : 1);
      const leaf = p.mat(r.look.accent), vein = p.mat(tone(r.look.accent, 0), { flat: true }), lite = p.mat(tone(r.look.accent, 3), { flat: true });
      // the hair falls over the circlet and the leaves: nothing is drawn where there is hair
      const put = (x: number, y2: number, m: number) => { if (p.at(x, y2) !== r.m.hair) p.px(x, y2, m); };
      for (let x = Math.round(hx - rx * 0.8); x <= Math.round(hx + rx * 0.7); x++) put(x, y, vein);
      const fx = Math.round(hx + rx * 0.35), flick = r.pose === 'idle' && r.f ? 1 : 0;
      // two leaves at the brow, one up and forward, one up and back; a third drops behind the ear
      put(fx, y, leaf); put(fx + 1, y, lite); put(fx - 1, y, leaf); put(fx, y - 1, leaf); put(fx + 1, y - 1 - flick, lite);
      const bx = Math.round(hx - rx * 0.75);
      put(bx, y + 1, leaf); put(bx - 1, y + 2 + flick, leaf);
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
    // a stripe of dried blood-red paint under the eye (dull, two pixels: not a rash); only grown orcs wear it, and not all of them: the young have none
    front: (r) => {
      if (r.look.stage === 'infant' || r.look.stage === 'child' || r.look.stage === 'teen') return;
      const [ex, ey] = eyeAt(r), red = flat(r, '#7a2a20');
      r.p.px(ex - 1, ey + 2, red); r.p.px(ex - 2, ey + 3, red);
    },
  },
  scars: {
    // old scars: a short pale line across the cheek and one across the chest (pale, not bloody); the young have none
    front: (r) => {
      if (r.look.stage === 'infant' || r.look.stage === 'child') return;
      const [ex, ey] = eyeAt(r), pale = flat(r, mixHex(r.look.skin, '#e8d8c8', 0.4));
      r.p.line([ex - 3, ey - 1], [ex - 2, ey + 2], pale);
      r.p.line([r.x0 + 1, r.sh + 3], [r.x0 + 4, r.sh + 5], pale);
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
    // fur on the cheek and along the forearm: the edge of the face is ragged and the arm is striped in the coat colour (a bird and a lizard have none)
    front: (r) => {
      if (noFur(r)) return;
      const [, ey] = eyeAt(r), x = Math.round(r.head[0] + r.hr[0]) - 1;
      r.p.px(x, ey + 2, r.m.hair); r.p.px(x - 1, ey + 3, r.m.hair); r.p.px(x + 1, ey + 2, r.m.hair);
    },
    nearArm: (r) => { if (!noFur(r)) armMarks(r, [0.6, 0.72, 0.84], r.m.hair); },
    farArm: (r) => { if (noFur(r)) return; const [x, y] = farArm(r, 0.75); r.p.px(x, y, r.m.hair); },
  },
  'tail:fluffy': {
    // the tail of the animal the feats name: a thick brush (wolf, fox), a long thin one that curls (the big cats, banded or plain), a round puff
    // (rabbit), a short blade (deer); a bird has none. It tells the mood and moves all the time
    back: (r) => {
      const f = r.look.feats;
      if (f.includes('feathers') || f.includes('crest')) return;
      const { p, k } = r, s = sway(r), root = tailRoot(r), c = r.m.hair, tipc = p.mat(tone(r.look.hairColor, 3));
      if (f.includes('longears')) { p.ell(root[0] - 1.5, root[1] + 0.5, 1.6 * Math.max(1, k), 1.6 * Math.max(1, k), p.mat(tone(r.look.hairColor, 3))); return; }
      if (f.includes('antlers')) { p.poly([root, [root[0] - 3.5 * k - s * 0.5, root[1] - 1.5 * k], [root[0] - 0.5, root[1] + 2.2]], c); p.px(root[0] - 1, root[1] + 1, tipc); return; }
      const cat = f.includes('stripes') || f.includes('spots') || f.includes('mane');
      const band = f.includes('stripes') ? flat(r, '#241810') : undefined;
      // a curve out and up from the hips, fat in the middle: a chain of ovals
      const P: Pt[] = cat ? [root, [root[0] - 6 * k - s * 0.5, root[1] + 3 * k], [root[0] - 8 * k - s, root[1] - 5 * k]] : [root, [root[0] - 5 * k - s * 0.5, root[1] + 1.5 * k], [root[0] - 7 * k - s, root[1] - 6 * k]];
      const N = cat ? 9 : 7;
      for (let i = 0; i <= N; i++) {
        const t = i / N, u = 1 - t, x = u * u * P[0][0] + 2 * u * t * P[1][0] + t * t * P[2][0], y = u * u * P[0][1] + 2 * u * t * P[1][1] + t * t * P[2][1];
        const rad = cat ? 0.9 + 0.35 * k * Math.sin(t * Math.PI) : (1.1 + 1.9 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.9)) * Math.max(0.8, k);
        const dark = cat && (i >= N - 1 || (band && i % 3 === 1));
        p.ell(x, y, rad, rad, dark ? (band ?? p.mat('#241810')) : i >= N - 1 ? tipc : c);
      }
    },
  },
  pawhands: {
    // the hands are paws: fur to the wrist, a dark pad (not on a bird or a lizard)
    front: (r) => {
      if (noFur(r)) return;
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
      r.p.px(ex - 3, ey + 1, dk); r.p.px(ex - 4, ey, lt); // a pair at the cheek, back from the eye: the face stays clear
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
      if (wide) p.ell(cx, hy + 0.5, rw + 0.6, rh + 0.6, edge);
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
      const demon = r.look.race === 'demonkin', thin = child ? 2 : r.look.fem ? 2 : 3;
      // dragon horns sweep back from the brow; a demon's rise and hook, both are two: the near one whole, the far one past it
      const back = demon ? 0.25 : 0.9, rise = demon ? 1.1 : 0.8;
      const horn1 = (bx: number, by: number, w: number, scale: number, sweep = 1) => {
        const mid: Pt = [bx - len * back * 0.4 * scale * sweep, by - len * rise * 0.55 * scale], end: Pt = [bx - len * back * scale * sweep - (demon ? -0.5 : 0), by - len * rise * scale];
        // sturdy: three pixels at the root, two at the middle, one at the point (a horn is not an antenna)
        stroke(p, [bx, by], mid, w, h, h, 0.5, 0.3);
        stroke(p, mid, end, Math.max(2, w - 1), h, lite, 0.6, 0.55);
      };
      horn1(hx + r.hr[0] * 0.55, top + 1, 2, 0.85, 0.35);
      horn1(hx - 0.5, top, thin, 1);
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
    // dust that glitters round the figure: two or three faint specks at a time, one a little brighter (flat, no outline, dim: the fae are not a cartoon)
    front: (r) => {
      const { H } = r, cx = cxOf(r), cy = r.sh + r.H * 0.15, g = mixHex(r.look.accent, '#8a8a98', 0.35);
      const spots: Pt[] = [[-H * 0.55, -H * 0.2], [H * 0.5, -H * 0.4], [H * 0.6, H * 0.1], [-H * 0.4, H * 0.35]];
      spots.forEach(([dx, dy], i) => { if ((i + r.f + (r.pose === 'walk' ? 1 : 0)) % 4 === 0) return; glowPx(r, cx + dx, cy + dy + ((r.f + i) % 2), i % 2 ? g : '#d8d6e0', 0.55); });
      const [sx, sy] = spots[(r.f + 1) % 4];
      glowPx(r, cx + sx, cy + sy, '#e8e6f0', 0.8); glowPx(r, cx + sx + 1, cy + sy, '#e8e6f0', 0.35); glowPx(r, cx + sx, cy + sy + 1, '#e8e6f0', 0.35);
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
      const halo = p.mat(mixHex(r.look.skin, '#ffffff', 0.4), { alpha: 0.9, flat: true }), core = flat(r, r.look.accent);
      const big = r.tw >= 8, hs = big ? 5 : 4, e = beat ? 0 : 1;
      p.rect(cx - (hs >> 1) + e, ny - (hs >> 1) + e, hs - e * 2, hs - e * 2, halo);
      p.rect(cx - (big ? 1 : 0), ny - (big ? 1 : 0), 2, 2, core);
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
    // a string of pearls at the throat (how many, and whether there is a pearl at the temple, change from look to look)
    front: (r) => {
      const { p } = r, sd = seedOf(r), w = p.mat(mixHex('#f4f0f0', r.look.skin, 0.2 + (sd % 3) * 0.1)), cx = Math.round(cxOf(r)) + 1;
      const row = [[-2, 1], [-1, 2], [0, 2], [1, 2], [2, 1]].slice(sd % 2, 5 - ((sd >> 1) % 2));
      row.forEach(([dx, dy]) => p.px(cx + dx, r.sh + dy, w));
      if ((sd >> 2) % 3 !== 0) p.px(r.head[0] - r.hr[0] * 0.85, Math.round(topY(r)) + 3, w);
    },
  },
  finskirt: {
    // a short ribbon of fin that trails from the back of the hip: thin and a little see-through, it flutters even when nothing moves (the tail itself is the `gown` lower)
    lower: (r) => {
      const { p } = r, fl = r.flap, x = r.x0, end = Math.min(r.foot - 6, r.hip + 5);
      const fin = p.mat(mixHex(r.look.second, r.look.accent, 0.25), { alpha: 0.85 });
      p.poly([[x + 1, r.hip + 1], [x - 2 - fl, end], [x - 1 - fl * 0.5, end + 1], [x + 2, r.hip + 4]], fin);
    },
  },
  wet: {
    // the skin is wet: bright flecks on the head, the shoulder and the arm, and a drip from the hand
    front: (r) => {
      const { p } = r, w = flat(r, '#e8f6ff'), drip = flat(r, '#bfe4f0', 0.8), top = Math.round(topY(r));
      p.px(r.head[0] - 1, top + 1, w); p.px(r.x0 + 1, r.sh + 1, w); armMarks(r, [0.35, 0.75], w);
      glowPx(r, r.hand[0], r.hand[1] + 2 + (r.f % 2), '#bfe4f0', 0.85); void drip;
    },
  },
  // ── winged ──
  'wings:feather': {
    // the wing is the look's accent (the docs' wing colour), only a little lightened, so a blue, a gold or a grey wing reads as that colour and not as white;
    // a docs-white wing is a warm white that the shading still models
    back: (r) => { const a = r.look.accent.toLowerCase(), lite = a === '#ffffff' ? '#ece8e0' : mixHex(r.look.accent, '#ffffff', 0.16); featherWing(r, lite, shadowOf(lite)); },
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
    // embers rise from the shoulders: three sparks, each higher at the next frame (flat, no outline)
    front: (r) => {
      const c = [r.look.accent, '#ffc040', tone(r.look.accent, 1)];
      for (let i = 0; i < 3; i++) glowPx(r, r.x0 + 1 + i * Math.max(2, Math.round(r.tw / 3)) + ((r.f + i) % 2), r.sh - 1 - ((r.f * 2 + i * 3) % 7), c[i]);
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
      // the flame is the hair and only the hair: a few tongues stand up from the crown with the dark hair showing between them; the brow and the face stay clear
      const { p } = r, [hx] = r.head, top = Math.round(topY(r)) + 1, c = flat(r, r.look.accent), y = flat(r, '#ffc040'), d = flat(r, tone(r.look.accent, 1));
      const h = [[3, 5, 4], [4, 3, 5], [5, 4, 3], [3, 4, 5]][r.f % 4];
      h.forEach((ht, i) => {
        const x = Math.round(hx - r.hr[0] * 0.75 + i * (r.hr[0] * 0.78));
        p.rect(x, top, 2, 1, i % 2 ? c : d);
        p.rect(x + (i % 2 ? 0 : 1), top - ht + 1, 1, ht, i % 2 ? c : d);
        p.px(x + (i % 2 ? 0 : 1), top - ht, y);
        if (ht > 3) p.px(x + (i % 2 ? 1 : 0), top - 1, y);
      });
    },
  },
  'glow-eyes': { front: eyeGlow },
  // ── hybrid and golem ──
  plates: {
    // iron plates in the second colour: a pauldron on the shoulder, a bracer on the forearm, a plate on the knee, and on the head a crown plate
    // (the soul machines) or a plate at the temple (the constructs)
    torso: (r) => {
      const { p } = r, m = plateOf(r), lt = flat(r, tone(plateHex(r), 3));
      p.rect(r.x0 + r.tw - 4, r.sh, 4, 3, m); p.rect(r.x0 + r.tw - 4, r.sh, 3, 1, lt);
      p.rect(r.x0, r.sh, 2, 2, m);
    },
    nearArm: (r) => { const [x, y] = nearArm(r, 0.7), w = armW(r); r.p.rect(Math.round(x) - (w >> 1), Math.round(y) - 1, w, 2, plateOf(r)); },
    lower: (r) => {
      if (r.sit || r.kneel || r.infant) return;
      const w = Math.max(2, Math.round(r.tw / 3.2)), y = Math.round(r.hip + r.legs * 0.45);
      r.p.rect(r.near.x + (r.near.fx - r.near.x) * 0.45, y, w, 2, plateOf(r));
    },
    hair: (r) => {
      const { p } = r, [hx, hy] = r.head, [rx, ry] = r.hr, top = Math.round(topY(r)), pl = plateOf(r), seam = flat(r, tone(plateHex(r), 0));
      if (r.look.race === 'soulmachine' || r.look.feats.includes('hairless')) {
        for (let x = Math.round(hx - rx); x < Math.round(hx + rx * 0.3); x++) p.rect(x, top, 1, x < hx - rx * 0.6 ? 3 : 2, pl);
        p.px(Math.round(hx - rx * 0.2), top + 2, seam); p.px(Math.round(hx - rx * 0.2), top + 3, seam);
        p.px(Math.round(hx - rx * 0.8), Math.round(hy), seam);
      } else if (r.hh >= 6) {
        p.rect(Math.round(hx - rx * 0.7), Math.round(hy - ry * 0.2), 2, 2, pl);
      }
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
      for (let i = 0; i < 2; i++) {
        const x = r.x0 + r.tw - 1 + i * 2 + (r.f % 2), y = r.sh - 1 - ((r.f * 2 + i * 3) % 6);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) glowPx(r, x + dx, y + dy, '#f2f4f8', 0.75);
        glowPx(r, x + 1, y - 1, '#f2f4f8', 0.45);
      }
    },
  },
  mecheye: {
    // an eye of metal and glass: a ring (brass, steel or copper, square or cut-cornered) and a lens that takes the signature colour (flat)
    front: (r) => {
      const [ex, ey] = eyeAt(r), sd = seedOf(r), ring = r.p.mat(['#c08a3a', '#8a94a4', '#a86a3a'][sd % 3]);
      if ((sd >> 2) % 2) { r.p.rect(ex - 1, ey - 1, 3, 3, ring); } else { r.p.rect(ex - 1, ey, 3, 1, ring); r.p.rect(ex, ey - 1, 1, 3, ring); r.p.px(ex - 1, ey - 1, ring); r.p.px(ex + 1, ey + 1, ring); }
      r.p.px(ex, ey, flat(r, glowOf(r)));
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
    // a dark plate across the eyes with points of fire in the eye colour and the signature colour (flat); the shape of the plate changes from look to look:
    // a band, a narrow slit under a brow, one round lens, two round lenses
    front: (r) => {
      const { p } = r, [ex, ey] = eyeAt(r), sd = seedOf(r) % 4, band = p.mat(mixHex('#24242c', r.look.second, 0.3), { flat: true });
      const a = flat(r, glowOf(r)), b = flat(r, glowOf(r, true));
      if (sd === 0) { p.rect(ex - 3, ey - 1, 5, 3, band); p.px(ex - 2, ey, a); p.px(ex, ey, b); }
      else if (sd === 1) { p.rect(ex - 4, ey - 2, 6, 1, band); p.rect(ex - 3, ey - 1, 5, 2, band); p.px(ex - 2, ey, a); p.px(ex - 1, ey, a); p.px(ex, ey, b); }
      else if (sd === 2) { p.rect(ex - 2, ey - 1, 4, 3, band); p.rect(ex - 3, ey, 6, 1, band); p.px(ex - 1, ey, a); p.px(ex, ey, b); p.px(ex - 1, ey - 1, b); }
      else { p.rect(ex - 3, ey - 1, 2, 3, band); p.rect(ex, ey - 1, 2, 3, band); p.px(ex - 2, ey, a); p.px(ex, ey, b); p.line([ex - 4, ey], [Math.round(r.head[0] - r.hr[0]) + 1, ey], band); }
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
    // dust that falls from the wraps and the feet: sand-coloured specks that drop one row a frame (no outline)
    front: (r) => {
      const n = r.f % 4;
      glowPx(r, r.hand[0], r.hand[1] + 2 + n % 3, '#d4bc88', 0.8); glowPx(r, r.x0 + 1, r.hip + 2 + (n + 1) % 3, '#d4bc88', 0.8); glowPx(r, r.x0 + r.tw, r.foot - 2 - ((n + 2) % 3), '#d4bc88', 0.8);
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
    // a wound bound with cloth, never on the face: a band round the chest with a spot of blood, and two turns round the forearm
    front: (r) => {
      const { p } = r, b = r.m.bone, y0 = r.sh + 2, y1 = Math.min(r.hip - 3, y0 + 2);
      p.rect(r.x0, y0, r.tw, 1, b); p.rect(r.x0, y1, r.tw, 1, b);
      p.line([r.x0, y1], [r.x0 + r.tw - 1, y0], b);
      p.px(r.x0 + r.tw - 3, y0 + 1, flat(r, '#8a2a2a'));
      armMarks(r, [0.55, 0.65, 0.75], b);
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
    back: (r) => batWing(r, '#34283f', '#6a5a86', false),
  },
  'wings:fin': {
    // the finned wing of a winged merfolk (04-nerea NR02): a thin sea-green membrane on pale ribs, folded flat at rest and spread when she is glad
    back: (r) => batWing(r, mixHex(r.look.skin, '#2a8aa8', 0.55), mixHex(r.look.skin, '#ffffff', 0.55), false),
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
