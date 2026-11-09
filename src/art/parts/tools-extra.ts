// Held things added after the first set (guns, gauges, compasses, fans, whips, slings …), kept apart from tools.ts so two hands can work at once.
// Same rules as tools.ts: the `held` layer is under the near arm, lengths are pixels of an adult scaled by `r.k`, `kind` picks the attack and work
// frames. A gun is drawn along its own aim (not the held angle): low in the idle and walk, level in the attack, raised in the cast. The small
// instruments (watch, compass, gauge, fan) sit upright in the palm, the way a mug does.
import type { Pt } from '../paint';
import { along, aside, type Rig, type Tool } from '../rig';
import { TONE, darker, hash, lighter, seedOf } from './kit';

const DEG = Math.PI / 180;
const at = (r: Rig, t: number, s = 0): Pt => (s ? aside(r, along(r, t * r.k), s * r.k) : along(r, t * r.k));
const stroke = (r: Rig, t0: number, t1: number, mat: number, w = 1, s = 0): void => r.p.line(at(r, t0, s), at(r, t1, s), mat, w);
const sz = (r: Rig, v: number): number => Math.max(1, Math.round(v * r.k));
const thick = (r: Rig): number => (r.k >= 0.8 ? 2 : 1);
const steel = (r: Rig): number => r.p.mat(lighter(TONE.steel, 0.12));
const iron = (r: Rig): number => r.p.mat(TONE.darkSteel);
const brass = (r: Rig): number => r.p.mat('#c2a050');
const darkBrass = (r: Rig): number => r.p.mat('#7a5a24');
const flat = (r: Rig, hex: string): number => r.p.mat(hex, { flat: true });
const wood = (r: Rig): number => r.m.wood;
/** Where a small instrument sits: just above and in front of the hand. */
const palm = (r: Rig): Pt => [Math.round(r.hand[0]) + 1, Math.round(r.hand[1]) - sz(r, 2)];
/** A point `t` pixels along a direction `a` (radians) from the hand and `s` pixels to its lower side. */
const dir = (r: Rig, a: number, t: number, s = 0): Pt => [r.hand[0] + (Math.cos(a) * t - Math.sin(a) * s) * r.k, r.hand[1] + (Math.sin(a) * t + Math.cos(a) * s) * r.k];
/** A mark of rust or soot on a worn thing, a few pixels along a line. */
function worn(r: Rig, a: Pt, b: Pt, mark: number): void {
  const w = r.look.wear;
  if (w < 0.3) return;
  const seed = seedOf(r), n = w > 0.6 ? 2 : 1;
  for (let i = 0; i < n; i++) { const t = hash(seed, i, 21); r.p.px(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, mark); }
}

// ── guns ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The aim of a gun in this pose: low ready when it walks and stands, level when it fires, up when it casts. */
function aim(r: Rig): number {
  if (r.pose === 'attack') return r.f === 0 ? -12 * DEG : 0;
  if (r.pose === 'cast') return -38 * DEG;
  if (r.pose === 'work') return 12 * DEG;
  if (r.pose === 'hurt') return 60 * DEG;
  return 46 * DEG;
}
/** Flash and smoke at the muzzle on the frames after the shot. */
function muzzle(r: Rig, a: number, t: number): void {
  if (r.pose !== 'attack' || r.f === 0) return;
  const m = dir(r, a, t + 1);
  if (r.f === 1) {
    const hot = flat(r, '#ffe27a'), core = flat(r, '#fff6d0');
    r.p.px(m[0], m[1], core); r.p.px(m[0] + 1, m[1], hot); r.p.px(m[0] + 2, m[1] - 1, hot); r.p.px(m[0] + 2, m[1] + 1, hot); r.p.px(m[0] + 1, m[1] - 1, hot); r.p.px(m[0] + 1, m[1] + 1, hot);
  } else {
    const smoke = r.p.mat('#b8b8be', { alpha: 0.7, flat: true });
    r.p.px(m[0] + 1, m[1] - 1, smoke); r.p.px(m[0] + 2, m[1] - 2, smoke); r.p.px(m[0] + 3, m[1] - 2, smoke); r.p.px(m[0], m[1] - 2, smoke);
  }
}

function pistol(r: Rig): void {
  const { p, m } = r, a = aim(r), w = thick(r) > 1 ? 2 : 1;
  const barrel = r.p.mat('#4a4e58'), wood = m.wood;
  // the barrel, then the lock, then the grip falling away below the hand
  p.line(dir(r, a, -1), dir(r, a, 6.5), barrel, w);
  p.line(dir(r, a, 3, 0.2), dir(r, a, 6.5, 0.2), steel(r));
  p.px(...dir(r, a, 6.5, -0.6), iron(r));
  p.rect(Math.round(dir(r, a, 0, 1)[0]), Math.round(dir(r, a, 0, 1)[1]), 1, 1, brass(r));
  p.line(dir(r, a, -0.5, 0.6), dir(r, a, -2.4, 3.6), wood, w);
  p.px(...dir(r, a, -1.4, -0.9), iron(r));
  worn(r, dir(r, a, 0), dir(r, a, 6), p.mat('#5a3a24'));
  muzzle(r, a, 6.5);
}

function musket(r: Rig): void {
  const { p, m } = r, a = aim(r), w = thick(r) > 1 ? 2 : 1;
  const barrel = r.p.mat('#52565f'), wood = r.p.mat('#8a5a30'), band = brass(r);
  // a long stock behind the hand, a long barrel before it, a ramrod under the barrel
  p.line(dir(r, a, -8), dir(r, a, 0.5), wood, w);
  p.line(dir(r, a, -8.4, 0.8), dir(r, a, -6, 1.2), wood, w);
  p.line(dir(r, a, 0.5), dir(r, a, 14), barrel, 1);
  p.line(dir(r, a, 1, 1), dir(r, a, 12, 1), p.mat('#a89868'));
  for (const t of [4, 8, 12]) p.px(...dir(r, a, t), band);
  p.px(...dir(r, a, -1.2, -1), iron(r));
  p.px(...dir(r, a, 14.6), iron(r));
  void m;
  worn(r, dir(r, a, 1), dir(r, a, 13), p.mat('#5a3a24'));
  muzzle(r, a, 14.6);
}

function rifle(r: Rig): void {
  const { p } = r, a = aim(r), w = thick(r) > 1 ? 2 : 1;
  const barrel = r.p.mat('#3e424c'), stock = r.p.mat('#5a4a3c'), lens = flat(r, '#9ad0e0');
  // a shorter stock, a heavy barrel, and a sight tube on top
  p.line(dir(r, a, -6), dir(r, a, 0.5), stock, w);
  p.line(dir(r, a, 0.5), dir(r, a, 12), barrel, w);
  p.line(dir(r, a, 3, -1.8), dir(r, a, 8, -1.8), steel(r));
  p.px(...dir(r, a, 8.8, -1.8), lens);
  p.px(...dir(r, a, 5.5, 1.2), iron(r)); p.px(...dir(r, a, 5.5, 2.2), iron(r));
  p.px(...dir(r, a, 12.6), iron(r));
  worn(r, dir(r, a, 1), dir(r, a, 11), p.mat('#6a4a2a'));
  muzzle(r, a, 12.6);
}

// ── instruments ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function pocketwatch(r: Rig): void {
  const { p } = r, [cx, cy] = palm(r), R = Math.max(1.6, 2.3 * r.k), face = flat(r, '#eee6cc'), ink = flat(r, '#2a2420');
  p.ell(cx, cy, R + 0.7, R + 0.7, brass(r));
  p.ell(cx, cy, R - 0.2, R - 0.2, face);
  // hands: the minute hand turns a quarter a frame
  const a = (r.f * 90 - 90) * DEG;
  p.px(cx, cy, ink); p.px(cx + Math.cos(a) * 1.4, cy + Math.sin(a) * 1.4, ink); p.px(cx, cy - 1, ink);
  p.px(cx, cy - R - 1.2, brass(r)); p.px(cx, cy - R - 2.2, darkBrass(r));
  // the chain hangs from the hand
  for (let i = 1; i <= sz(r, 5); i++) p.px(r.hand[0] - (i % 2) * 0.6, r.hand[1] + i, i % 2 ? brass(r) : darkBrass(r));
}

function compass(r: Rig): void {
  const { p } = r, [cx, cy] = palm(r), n = sz(r, 2), x = Math.round(cx) - n, y = Math.round(cy) - n;
  const w = n * 2 + 1;
  // a square brass case with its lid open behind, a pale face, a needle that wavers
  p.rect(x - 1, y - 1, w + 2, w + 2, brass(r));
  p.rect(x, y, w, w, flat(r, '#dcd4b8'));
  p.px(x - 1, y - 1, 0); p.px(x + w, y - 1, 0); p.px(x - 1, y + w, 0); p.px(x + w, y + w, 0);
  p.rect(x - 1, y - 2, w + 2, 1, darkBrass(r));
  const wob = [0, 1, 0, -1][r.f % 4];
  p.px(cx + wob, cy - 1, flat(r, '#c03a2a')); p.px(cx + wob, cy - 2, flat(r, '#c03a2a'));
  p.px(cx - wob, cy, flat(r, '#2a2a30')); p.px(cx - wob, cy + 1, flat(r, '#2a2a30'));
  p.px(x - 1, y + Math.floor(w / 2), darkBrass(r));
}

function gauge(r: Rig): void {
  const { p } = r, [cx, cy] = palm(r), w = sz(r, 6), h = sz(r, 4), x = Math.round(cx) - Math.floor(w / 2), y = Math.round(cy) - h + 1;
  // a brass box with a dial and a needle that sweeps, a stub of aerial and a wooden handle
  p.rect(x, y, w, h, brass(r));
  p.rect(x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2), flat(r, '#e4ddc4'));
  const sweep = [0, 1, 2, 1][r.f % 4];
  const needle = flat(r, '#b83228');
  p.px(x + 1 + Math.min(sweep, Math.max(0, w - 3)), y + 1, needle);
  if (h > 3) p.px(x + 1 + Math.min(sweep, Math.max(0, w - 3)), y + 2, needle);
  p.rect(x + Math.floor(w / 2), y - sz(r, 2), 1, sz(r, 2), iron(r));
  p.px(x + Math.floor(w / 2), y - sz(r, 2) - 1, darkBrass(r));
  p.rect(x + 1, y + h, 1, sz(r, 2), r.m.wood);
  p.px(x, y + h - 1, darkBrass(r)); p.px(x + w - 1, y + h - 1, darkBrass(r));
}

function spyglass(r: Rig): void {
  const { p } = r, b = brass(r), d = darkBrass(r), gl = flat(r, '#aee0ee');
  // three tubes, each thinner than the last, the bands between them, a glint on the lens
  stroke(r, -3, 3, d, thick(r));
  stroke(r, 3, 8, b, thick(r));
  stroke(r, 8, 12, p.mat(lighter('#c2a050', 0.2)));
  for (const t of [3, 8]) p.px(...at(r, t, 0.9), iron(r));
  p.px(...at(r, 12.8), gl);
  p.px(...at(r, -3.6), iron(r));
  worn(r, at(r, -2), at(r, 11), p.mat('#5a3a20'));
}

function fan(r: Rig): void {
  const { p } = r, [cx, cy] = palm(r), len = 7 * r.k;
  const spread = (r.pose === 'idle' && r.f === 0 ? 62 : 84) * DEG, mid = -62 * DEG;
  const cloth = p.mat(r.look.accent), rib = p.mat(darker(r.look.accent, 0.5), { flat: true }), tip = p.mat(lighter(r.look.accent, 0.4));
  // a wedge of cloth on ribs, its edge scalloped
  const pts: Pt[] = [[cx, cy]];
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const a = mid - spread / 2 + (spread * i) / n, l = len * (i % 2 ? 0.92 : 1);
    pts.push([cx + Math.cos(a) * l, cy + Math.sin(a) * l]);
  }
  p.poly(pts, cloth);
  for (let i = 1; i < pts.length; i += 2) p.line(pts[0], pts[i], rib);
  for (let i = 1; i < pts.length; i++) p.px(pts[i][0], pts[i][1], tip);
  p.px(cx, cy + 1, r.m.wood); p.px(cx - 0.5, cy + 2, r.m.wood);
}

function scissors(r: Rig): void {
  const { p } = r, st = steel(r), ring = iron(r);
  // two blades crossing at a pivot, the rings behind the hand; they snip on the attack frames
  const open = r.pose === 'attack' && r.f === 1 ? 1.5 : 0.6;
  const piv = 2;
  p.line(at(r, piv), at(r, 10, open), st);
  p.line(at(r, piv), at(r, 10, -open), st);
  p.line(at(r, piv), at(r, -1.5, -1.3), ring);
  p.line(at(r, piv), at(r, -1.5, 1.3), ring);
  p.px(...at(r, -2.4, -1.6), ring); p.px(...at(r, -2.4, 1.6), ring);
  p.px(...at(r, piv), brass(r));
  worn(r, at(r, 4, open), at(r, 9, open), p.mat('#6a4a2a'));
}

// ── whip, sling, fist weapon ────────────────────────────────────────────────────────────────────────────────────────────────────────
function whip(r: Rig): void {
  const { p, m } = r, cord = p.mat('#8a6a3a'), dark = p.mat('#4a3220');
  // a short plaited handle, then a thong: lashed out along the swing, or hanging to the ground
  stroke(r, -4, 3.5, m.leather, thick(r));
  p.px(...at(r, -4.6), brass(r));
  const o = at(r, 3.5);
  const striking = (r.pose === 'attack' && r.f > 0) || (r.pose === 'work' && r.f === 1);
  const pts: Pt[] = [];
  if (striking) {
    const len = 17 * r.k;
    for (let i = 0; i <= 7; i++) {
      const t = i / 7, a = r.ang + Math.sin(t * Math.PI * 1.4 + r.f) * 0.28;
      pts.push([o[0] + Math.cos(a) * len * t, o[1] + Math.sin(a) * len * t]);
    }
  } else {
    const gx = o[0] + 3.5 * r.k, gy = r.foot - 1;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, x = o[0] + (gx - o[0]) * t * t * 0.9 + Math.sin(t * Math.PI) * 1.8 * r.k, y = o[1] + (gy - o[1]) * t;
      pts.push([x, y]);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) p.line(pts[i], pts[i + 1], i > pts.length - 3 ? dark : cord);
  p.px(pts[pts.length - 1][0] + 0.6, pts[pts.length - 1][1], dark);
}

function sling(r: Rig): void {
  const { p } = r, strap = p.mat('#9a7a48'), stone = p.mat('#7e7e78'), hi = p.mat('#b4b4aa');
  // a strap with a pouch: it hangs from the hand, or whirls overhead on the attack and work frames
  const whirl = r.pose === 'attack' || r.pose === 'work' || r.pose === 'cast';
  const [hx, hy] = r.hand;
  let c: Pt;
  if (whirl) {
    const a = (r.f * 110 - 30) * DEG, rad = 7 * r.k;
    c = [hx + Math.cos(a) * rad, hy - 4 * r.k + Math.sin(a) * rad * 0.45];
    p.line([hx, hy], c, strap);
    p.line([hx + 1, hy], c, strap);
  } else {
    c = [hx + 1.4 * r.k, hy + 6.5 * r.k];
    p.line([hx, hy], c, strap);
    p.line([hx + 1, hy], [c[0] + 1, c[1]], strap);
  }
  p.rect(c[0] - 1, c[1] - 1, 3, 3, strap);
  p.px(c[0], c[1], stone); p.px(c[0] + 1, c[1] - 1, hi);
  p.px(hx, hy - 1, r.m.leather);
}

function knuckles(r: Rig): void {
  const { p } = r, st = steel(r), dk = iron(r), big = r.k >= 0.8;
  const [hx, hy] = [Math.round(r.hand[0]), Math.round(r.hand[1])];
  // a metal fist: a band over the knuckles with studs that stand out in front, and a short spike on the top
  p.rect(hx - 1, hy - (big ? 2 : 1), big ? 4 : 3, big ? 4 : 3, st);
  p.rect(hx - 1, hy + 1, big ? 4 : 3, 1, dk);
  p.px(hx + (big ? 3 : 2), hy - 1, dk); p.px(hx + (big ? 3 : 2), hy, dk); if (big) p.px(hx + 3, hy + 1, dk);
  const shine = p.mat(lighter(TONE.steel, 0.3));
  p.px(hx, hy - (big ? 3 : 2), shine); p.px(hx + 1, hy - (big ? 3 : 2), shine);
  worn(r, [hx, hy - 1], [hx + 2, hy], p.mat('#6a4a2a'));
}

// ── things carried that the docs name (wave 4: keys, a basket, a garland, a doll, a bucket ...) ───────────────────────────────────────────────
/** A ring of pixels of radius `rad` round a centre, between two angles (degrees; 180 to 360 is the upper half). */
function ring(r: Rig, c: Pt, rad: number, mat: number, from = 0, to = 360): void {
  const n = Math.max(8, Math.round(rad * 8));
  for (let i = 0; i <= n; i++) {
    const a = (from + ((to - from) * i) / n) * DEG;
    r.p.px(c[0] + Math.cos(a) * rad, c[1] + Math.sin(a) * rad, mat);
  }
}
function mixHex(a: string, b: string): string {
  const A = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), B = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + A.map((v, i) => Math.round((v + B[i]) / 2).toString(16).padStart(2, '0')).join('');
}

function keyring(r: Rig): void {
  const { p } = r, [hx, hy] = r.hand, c: Pt = [hx + 1, hy + 3 * r.k], sw = [0, 1, 0, -1][r.f % 4] * 0.4;
  // an iron ring held in the fist with three big keys hanging from it: a round bow, a long shank, teeth
  ring(r, c, 1.8 * r.k + 0.4, brass(r));
  const keys: [number, number, number][] = [[-1.6, 5, 0], [0.2, 6.5, 1], [1.8, 4.5, 0]];
  keys.forEach(([dx, len, tooth], i) => {
    const x = c[0] + dx * r.k + sw * (i - 1), y0 = c[1] + 1.6 * r.k, y1 = y0 + len * r.k;
    const mat = i === 1 ? iron(r) : steel(r);
    p.line([x, y0], [x, y1], mat, 1);
    p.px(x, y0 - 0.6, darkBrass(r));
    p.px(x + 1, y1 - 1, mat); p.px(x + 1, y1 - 2.4, iron(r));
    if (tooth) p.px(x + 1, y1, iron(r));
  });
  worn(r, [c[0], c[1] + 2], [c[0], c[1] + 6], p.mat('#5a3a24'));
}

function basket(r: Rig): void {
  const { p } = r, [hx, hy] = r.hand, w = sz(r, 8), h = sz(r, 5), x = Math.round(hx) - Math.floor(w / 2) + 1, y = Math.round(hy) + sz(r, 3);
  const straw = p.mat('#b08a4a'), dark = p.mat('#7a5a2c'), cloth = p.mat('#d8d0bc');
  // a woven basket on its arched handle, a cloth over the load
  ring(r, [hx + 1, y], w / 2 - 0.4, dark, 180, 360);
  p.rect(x, y, w, h, straw);
  p.rect(x, y + Math.floor(h / 2), w, 1, dark);
  for (let i = 1; i < w; i += 2) p.px(x + i, y + 1, dark);
  p.rect(x - 1, y - 1, w + 2, 1, dark);
  p.rect(x + 1, y - 2, w - 2, 1, cloth);
  p.px(x + 2, y - 3, cloth); p.px(x + w - 3, y - 3, p.mat('#e8e0cc'));
}

function garland(r: Rig): void {
  const { p } = r, [cx, cy] = palm(r), R = 3.2 * r.k + 0.6, leaf = p.mat('#4a8a3a'), leaf2 = p.mat('#6aa04a');
  const bloom = [flat(r, '#e07a9a'), flat(r, '#f0d070'), flat(r, '#f4f0e8')];
  // a wreath of leaves with a bloom every third, held up in front of the chest, a ribbon trailing
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 1.05;
    p.px(x, y, i % 3 === 0 ? bloom[Math.floor(i / 3) % 3] : i % 2 ? leaf : leaf2);
    if (r.k >= 0.8) p.px(x + Math.cos(a), y + Math.sin(a), i % 3 === 0 ? bloom[(Math.floor(i / 3) + 1) % 3] : leaf);
  }
  p.px(cx - R, cy + R * 0.7, p.mat(r.look.accent)); p.px(cx - R - 0.5, cy + R * 0.7 + 1, p.mat(r.look.accent));
}

function mallet(r: Rig): void {
  const { p, m } = r, head = p.mat('#8a6238'), band = iron(r);
  // a short wooden maul for striking armour and bells: a round head of wood with iron bands, a leather-wrapped haft
  stroke(r, -6, 8, wood(r), thick(r));
  stroke(r, 8, 13, head, thick(r)); stroke(r, 8, 13, head, 1, 1.6); stroke(r, 8, 13, head, 1, -1.6);
  p.px(...at(r, 8, 1.8), band); p.px(...at(r, 8, -1.8), band); p.px(...at(r, 13, 1.6), band); p.px(...at(r, 13, -1.6), band);
  stroke(r, -5, -1, m.leather, 1, 0.5);
  p.px(...at(r, 13.6), p.mat(lighter('#8a6238', 0.3)));
  worn(r, at(r, 8), at(r, 13), p.mat('#4a3220'));
}

function bellrope(r: Rig): void {
  const { p } = r, [hx, hy] = r.hand, b = brass(r), rope = p.mat('#c4b080'), dk = p.mat('#7a6a40');
  const sway = [0, 1, 0, -1][r.f % 4] * 0.5;
  // a small bronze bell in the fist and the thick rope hanging from it, knotted, ending in a tuft
  p.poly([[hx - 1, hy - 3 * r.k], [hx + 3, hy - 3 * r.k], [hx + 4, hy - 0.6], [hx - 2, hy - 0.6]], b);
  p.px(hx + 1, hy - 3 * r.k - 1, darkBrass(r));
  p.px(hx + 1, hy - 0.2, darkBrass(r));
  const len = 8 * r.k;
  for (let i = 0; i <= len; i++) p.px(hx + 1 + Math.sin(i * 0.5) * 0.6 + sway * (i / len), hy + i, i % 3 === 2 ? dk : rope);
  p.px(hx + 1 + sway, hy + len * 0.5, dk); p.px(hx + 2 + sway, hy + len * 0.5, dk);
  p.rect(Math.round(hx + sway), Math.round(hy + len) + 1, 3, 2, rope);
  p.px(hx + sway, hy + len + 3, dk); p.px(hx + 2 + sway, hy + len + 3, dk);
}

function beads(r: Rig): void {
  const { p } = r, [hx, hy] = r.hand, col = [p.mat('#e8e0cc'), p.mat('#a8a49c')];
  // a string of prayer beads hanging in a loop from the hand, with a tassel and a charm
  const n = Math.round(10 * r.k) + 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    p.px(hx + 0.5 - Math.sin(t * Math.PI) * 2.6 * r.k, hy + 0.5 + t * 5 * r.k, i % 2 ? col[0] : col[1]);
  }
  const end: Pt = [hx + 0.5, hy + 6 * r.k];
  p.px(end[0], end[1], p.mat(r.look.accent)); p.px(end[0], end[1] + 1, p.mat(r.look.accent)); p.px(end[0] + 1, end[1] + 2, p.mat(darker(r.look.accent, 0.3)));
}

function doll(r: Rig): void {
  const { p } = r, [cx, cy] = palm(r), body = p.mat('#c9bba0'), dress = p.mat(darker(r.look.second, 0.1)), face = flat(r, '#2a2420');
  // a small doll held upright: a round head with two dot eyes, a cloth body, stubby arms and legs
  p.ell(cx, cy - 3.6 * r.k, 1.8 * r.k + 0.3, 1.8 * r.k + 0.3, body);
  p.poly([[cx - 2, cy - 1.8 * r.k], [cx + 2, cy - 1.8 * r.k], [cx + 2.4, cy + 1.6 * r.k], [cx - 2.4, cy + 1.6 * r.k]], dress);
  p.px(cx - 2.6, cy - 0.6, body); p.px(cx + 2.6, cy - 0.2, body);
  p.px(cx - 1.4, cy + 2.4 * r.k, body); p.px(cx + 1.2, cy + 2.4 * r.k, body);
  p.px(cx - 0.8, cy - 3.8 * r.k, face); p.px(cx + 0.8, cy - 3.8 * r.k, face);
  p.px(cx + 1, cy - 5.6 * r.k, p.mat(darker(r.look.accent, 0.1)));
}

function bucket(r: Rig): void {
  const { p } = r, [hx, hy] = r.hand, w = sz(r, 6), h = sz(r, 5), x = Math.round(hx) - 1, y = Math.round(hy) + sz(r, 3);
  const stave = p.mat('#8a6a3a'), water = flat(r, '#9ac0d0');
  // a wooden pail with two iron hoops, a rope handle arching over the rim, water showing at the top
  ring(r, [hx + w / 2 - 0.5, y], w / 2, p.mat('#a89868'), 180, 360);
  p.poly([[x, y], [x + w, y], [x + w - 1, y + h], [x + 1, y + h]], stave);
  p.rect(x + 1, y, w - 2, 1, water);
  p.rect(x, y + 1, w, 1, iron(r)); p.rect(x + 1, y + h - 1, w - 2, 1, iron(r));
  p.px(x + 2, y + 2, p.mat(lighter('#8a6a3a', 0.25)));
  if (r.f % 2) p.glow(x + 2, y - 1, '#c8e0e8', 0.7);
}

function papyrus(r: Rig): void {
  const { p } = r, x = Math.round(r.hand[0]) + 1, y = Math.round(r.hand[1]) - sz(r, 4), w = sz(r, 5), h = sz(r, 9);
  const sheet = p.mat('#d4b878'), edge = p.mat('#a8884c'), ink = flat(r, '#4a3820');
  // a long strip of reed paper unrolled from a thin rod, yellow-brown, rows of tiny ink marks, a ragged lower edge
  p.rect(x - 1, y, w + 2, 1, p.mat('#8a6a3a'));
  p.rect(x, y + 1, w, h, sheet);
  for (let j = 2; j < h; j += 2) for (let i = 1; i < w - 1; i += 2) p.px(x + i, y + j, (i + j) % 3 ? ink : edge);
  p.px(x, y + h + 1, sheet); p.px(x + 2, y + h + 1, edge); p.px(x + w - 1, y + h, edge);
  p.rect(x, y + 1, 1, h, edge);
}

function card(r: Rig): void {
  const { p } = r, [cx, cy] = palm(r), w = sz(r, 6), h = sz(r, 4), x = Math.round(cx) - 1, y = Math.round(cy) - h;
  const paper = p.mat('#e4dcc0'), line = flat(r, '#4a4438');
  // a small hard card or ticket: pale, a dark strip, a stamp in the accent and a hole with a cord
  p.rect(x, y, w, h, paper);
  p.rect(x, y + 1, w, 1, line);
  p.rect(x + w - 2, y + 2, 2, Math.max(1, h - 2), p.mat(r.look.accent));
  p.px(x + 1, y + h - 1, line); p.px(x + 2, y + h - 1, line);
  p.px(x - 1, y, r.m.metal);
  p.line([x - 1, y], [x - 2, y - 2 * r.k], p.mat('#a89868'));
}

function letter(r: Rig): void {
  const { p } = r, [cx, cy] = palm(r), w = sz(r, 7), h = sz(r, 5), x = Math.round(cx) - 1, y = Math.round(cy) - h;
  const paper = p.mat('#e8e0cc'), fold = p.mat('#b8ac90');
  // an envelope with a folded flap and a red wax seal, a corner of the letter showing
  p.rect(x, y, w, h, paper);
  p.line([x, y], [x + w / 2, y + h / 2], fold); p.line([x + w - 1, y], [x + w / 2, y + h / 2], fold);
  p.px(x + Math.floor(w / 2), y + Math.floor(h / 2), flat(r, '#a8302a'));
  p.px(x + Math.floor(w / 2) + 1, y + Math.floor(h / 2), flat(r, '#8a2420'));
  p.px(x + 1, y - 1, paper); p.px(x + 2, y - 1, paper);
}

function crystal(r: Rig): void {
  const { p } = r, [cx, cy] = palm(r), body = p.mat('#8ad0e8', { alpha: 0.9 }), hi = flat(r, '#e8f8ff'), sh = p.mat('#4a8aa8');
  // a faceted crystal point-up with a bright facet and a pale glow that pulses
  const s = r.k >= 0.8 ? 1 : 0.8;
  p.poly([[cx, cy - 6 * s], [cx + 2.4 * s, cy - 2.6 * s], [cx + 1.8 * s, cy + 1], [cx - 1.8 * s, cy + 1], [cx - 2.4 * s, cy - 2.6 * s]], body);
  p.line([cx, cy - 6 * s], [cx + 1.8 * s, cy + 0.5], sh);
  p.px(cx - 1, cy - 3 * s, hi); p.px(cx - 1, cy - 2 * s, hi); p.px(cx - 0.4, cy - 4.4 * s, hi);
  p.glow(cx + 3, cy - 5 + (r.f % 2), '#cfeef8', 0.8); p.glow(cx - 3, cy - 3, '#cfeef8', 0.6);
}

function jar(r: Rig): void {
  const { p } = r, [cx, cy] = palm(r), w = sz(r, 5), h = sz(r, 6), x = Math.round(cx) - 1, y = Math.round(cy) - h + 1;
  const glass = p.mat('#c8e0e0', { alpha: 0.75 }), lid = p.mat('#8a6a3a'), stuff = flat(r, mixHex(r.look.accent, '#6a5a3a'));
  // a glass jar with a cork lid and something dim inside
  p.rect(x, y, w, h, glass);
  p.rect(x + 1, y + Math.floor(h / 2), w - 2, Math.ceil(h / 2) - 1, stuff);
  p.rect(x, y - 1, w, 1, lid); p.rect(x + 1, y - 2, w - 2, 1, lid);
  p.px(x + 1, y + 1, flat(r, '#f4fbfb'));
  p.glow(x + w - 1, y + h - 2, mixHex(r.look.accent, '#ffffff'), 0.6);
}

function net(r: Rig): void {
  const { p } = r, cord = p.mat('#a8986c'), float = p.mat('#c8503a');
  // a cast net: a hoop on a pole, a mesh bag below it, a float or two on the rim
  stroke(r, -8, 4, wood(r));
  const c = at(r, 8), rad = 4 * r.k + 1;
  ring(r, c, rad, cord);
  for (let j = -2; j <= 3; j++) for (let i = -2; i <= 2; i++) if ((i + j) % 2 === 0 && i * i + j * j < 10) p.px(c[0] + i * r.k, c[1] + j * r.k + 1, cord);
  p.px(c[0] - rad, c[1], float); p.px(c[0] + rad, c[1] + 1, float);
}

function brush(r: Rig): void {
  const { p } = r, ink = flat(r, '#2a2430'), paint = p.mat(r.look.accent);
  // a long thin brush with a tuft dipped in colour
  stroke(r, -5, 8, wood(r));
  stroke(r, 8, 11, paint, thick(r) > 1 ? 2 : 1);
  p.px(...at(r, 11.6), ink); p.px(...at(r, 8, 0.8), r.m.metal);
  p.px(...at(r, 12.4, 0.8), paint);
}

function mapPaper(r: Rig): void {
  const { p } = r, [cx, cy] = palm(r), w = sz(r, 8), h = sz(r, 6), x = Math.round(cx) - 2, y = Math.round(cy) - h;
  const sheet = p.mat('#d8cca0'), fold = p.mat('#a89c70'), route = flat(r, '#5a4a30'), mark = flat(r, '#b83a2a'), sea = flat(r, '#8aa8b0');
  // an opened map with its folds: a coast, a dotted route and a red cross
  p.rect(x, y, w, h, sheet);
  p.rect(x + Math.floor(w / 3), y, 1, h, fold); p.rect(x + Math.floor((2 * w) / 3), y, 1, h, fold);
  p.rect(x, y, Math.max(2, Math.floor(w / 4)), h, sea);
  for (let i = 2; i < w - 1; i += 2) p.px(x + i, y + 1 + ((i >> 1) % 3), route);
  p.px(x + w - 2, y + h - 2, mark); p.px(x + w - 3, y + h - 3, mark); p.px(x + w - 1, y + h - 3, mark); p.px(x + w - 3, y + h - 1, mark);
}

function bottle(r: Rig): void {
  const { p } = r, [cx, cy] = palm(r), h = sz(r, 8), x = Math.round(cx) - 1, y = Math.round(cy) - h + 1;
  const glass = p.mat('#7ab0a0', { alpha: 0.85 }), cork = p.mat('#9a7a4a');
  // a tall corked glass bottle with a neck and a rolled note inside
  p.rect(x, y + 3, 3, h - 3, glass);
  p.rect(x + 1, y, 1, 4, glass);
  p.px(x + 1, y - 1, cork); p.px(x + 1, y, cork);
  p.px(x + 1, y + 4, flat(r, '#e8e0cc')); p.px(x + 1, y + 5, flat(r, '#e8e0cc'));
  p.px(x, y + 4, flat(r, '#f4fbf8'));
}

function pipe(r: Rig): void {
  const { p } = r, tube = p.mat('#7a5a34'), band = brass(r);
  // a long thin tube held out to the side, a flute or a blowpipe, with finger holes and brass rings
  stroke(r, -6, 12, tube);
  for (const t of [2, 4.5, 7]) p.px(...at(r, t, 0.1), flat(r, '#2a1c10'));
  p.px(...at(r, -6.4), band); p.px(...at(r, 12.4), band); p.px(...at(r, 9, 0.6), band);
  if (r.pose === 'cast' || r.f % 2) p.glow(...at(r, 14, -1.6), '#d8e8d0', 0.7);
}

function bag(r: Rig): void {
  const { p, m } = r, [hx, hy] = r.hand, w = sz(r, 7), h = sz(r, 6), x = Math.round(hx) - 2, y = Math.round(hy) + sz(r, 2);
  const canvas = p.mat('#9a8a64'), flap = p.mat('#7a6a48');
  // a canvas satchel hanging from the hand by its strap: a flap with a buckle and a bulging body
  p.line([hx, hy], [x + w - 1, y], m.leather);
  p.rect(x, y, w, h, canvas);
  p.rect(x, y, w, Math.ceil(h / 2), flap);
  p.px(x + Math.floor(w / 2), y + Math.ceil(h / 2) - 1, m.metal);
  p.px(x + 1, y + h - 1, p.mat(darker('#9a8a64', 0.2))); p.px(x + w - 2, y + h - 1, p.mat(darker('#9a8a64', 0.2)));
}

function hotiron(r: Rig): void {
  const { p } = r, glowC = ['#ff7a1a', '#ff9a30', '#ffb050'];
  // an iron bar fresh from the fire: the tip glows orange and sheds sparks
  stroke(r, -4, 6, iron(r));
  for (let t = 6; t <= 12; t++) p.px(...at(r, t), flat(r, glowC[Math.min(2, Math.floor((t - 6) / 2.5))]));
  p.glow(...at(r, 13), '#ffd070', 0.9);
  for (let i = 0; i < 3; i++) p.glow(...at(r, 8 + i * 2, (i % 2 ? 1 : -1) * (1.6 + ((r.f + i) % 3))), '#ff9a30', 0.8 - i * 0.2);
}

function tank(r: Rig): void {
  const { p } = r, sn = r.shoulderNear, w = sz(r, 9), h = sz(r, 7), x = Math.round(sn[0]) - 2, y = Math.round(sn[1]) - h - sz(r, 3);
  const glass = p.mat('#bcd8e0', { alpha: 0.55 }), water = p.mat('#6a9ab8', { alpha: 0.8 }), fish = flat(r, '#e07a30');
  // a fish tank floating above the shoulder: a glass box, water in it, a small fish that swims from side to side
  p.rect(x, y, w, h, glass);
  p.rect(x + 1, y + 2, w - 2, h - 3, water);
  p.rect(x, y, w, 1, iron(r)); p.rect(x, y + h - 1, w, 1, iron(r));
  const fx = x + 2 + (r.f % 3) * 2;
  p.px(fx, y + 4, fish); p.px(fx + 1, y + 4, fish); p.px(fx - 1, y + 3, fish);
  p.glow(x + 3, y - 1, '#d8eef4', 0.7);
}

function quill(r: Rig): void {
  const { p } = r, vane = p.mat('#e8e2d4'), edge = p.mat('#b4aca0'), ink = flat(r, '#2a2a3a');
  // a long white feather pen: the shaft, a vane that tapers, the nib dark with ink
  stroke(r, -2, 10, edge);
  stroke(r, 2, 10, vane, 1, 0.8); stroke(r, 4, 9, vane, 1, -0.8);
  p.px(...at(r, 10.6), vane); p.px(...at(r, -2.6), ink); p.px(...at(r, -3.4), ink);
}

function chalk(r: Rig): void {
  const { p } = r;
  // a stick of chalk or charcoal in the fingers with dust falling from the knuckle
  stroke(r, -1, 4, p.mat('#ece8dc'), thick(r));
  p.px(...at(r, 4.6), flat(r, '#fffdf2'));
  p.glow(r.hand[0] + 1, r.hand[1] + 2 + (r.f % 2), '#f4f0e4', 0.6);
}


// ── wave 5: a sword in its sheath, a second pistol, a stone drum, ankle bells, a chisel, a small hammer, a wrench, a chalk slate ──────────────────────
/**
 * A sword that stays in its scabbard (`ไม่เคยชัก` `ในฝัก`): it hangs at the near hip and the hands stay free (kind `none`: the tool draws in the front layer,
 * not in the hand). The hilt shows above the belt, the scabbard runs back and down behind the leg, its tip a little off the ground.
 */
function sheath(r: Rig, len: number, cover: string, fit: string): void {
  const { p } = r, k = r.k;
  const bx = r.x0 + r.tw - 1.5, by = r.hip - 1;
  const ux = -0.55, uy = 0.83;
  const tip: Pt = [bx + ux * len * k, Math.min(r.foot - 2, by + uy * len * k)];
  const body = p.mat(cover), band = p.mat(fit, { flat: true }), pommel = p.mat(lighter(fit, 0.2), { flat: true }), grip = p.mat('#3a2a22');
  p.line([bx, by], tip, body, 2);
  for (const t of [0.12, 0.5, 0.92]) p.px(bx + (tip[0] - bx) * t, by + (tip[1] - by) * t, band);
  p.px(tip[0], tip[1], band);
  // the hilt above the belt, the cross-guard across it
  const gx = bx - ux * 3.2 * k, gy = by - uy * 3.2 * k;
  p.line([bx, by], [gx, gy], grip, 2);
  p.line([bx - 1.6 * k - 0.4, by - 0.3], [bx + 1.6 * k + 0.4, by - 0.3], band, 1);
  p.px(gx, gy - 1, pommel);
}
function sheathedSword(r: Rig): void { sheath(r, 12, '#6a4a30', '#d8d0b0'); }
function greatSheath(r: Rig): void {
  // a sword too big for a hand: a wide dark scabbard runs from the hip past the knee at a slant with pale bands, and a long grip with a broad gold guard and a round pommel
  // stands up above the hip (past the elbow), so the sword reads on grey plate at zoom 2 as well
  const { p } = r, k = r.k, bx = r.x0 + r.tw - 1.5, by = r.hip - 1;
  const tip: Pt = [bx - 0.55 * 22 * k, Math.min(r.foot - 2, by + 0.83 * 22 * k)], dark = p.mat('#1e1a24'), pale = p.mat('#f0f0fa', { flat: true });
  p.line([bx + 0.5, by], [tip[0] + 0.5, tip[1]], dark, 3);
  for (const t of [0.2, 0.5, 0.8, 1]) p.rect(Math.round(bx + (tip[0] - bx) * t - 1), Math.round(by + (tip[1] - by) * t), 3, 1, pale);
  p.line([bx, by - 1], [bx + 0.5, by - 7 * k], p.mat('#6a4a2a'), 2);
  p.line([bx - 4, by - 3 * k], [bx + 4, by - 3 * k], p.mat('#f0c850', { flat: true }), 2);
  p.ell(bx + 0.5, by - 8 * k, 1.6, 1.6, p.mat('#f0c850'));
}
function goldSheath(r: Rig): void { sheath(r, 18, '#a88628', '#f0d070'); }

/** Two pistols: one in the hand, the other in the lower hand of a man with four arms (held out in front of the belly), else holstered at the hip. */
function twinPistol(r: Rig): void {
  pistol(r);
  const four = r.look.feats.includes('fourarms');
  const second: Pt = four ? [r.x0 + r.tw + 1.5, r.sh + (r.hip - r.sh) * 0.72] : [r.x0 + 1.5, r.hip - 1];
  pistol({ ...r, hand: second, pose: four ? r.pose : 'idle' });
}

function drum(r: Rig): void {
  const { p } = r, [hx, hy] = r.hand, rx = 4 * r.k + 0.4, ry = 3.2 * r.k + 0.4, cx = hx + 3 * r.k, cy = hy + 3 * r.k;
  const stone = p.mat('#8a8478'), skin = p.mat('#c8b48a'), rim = p.mat('#5a5448', { flat: true }), crack = flat(r, '#3a362e');
  // a drum cut from the rock: a grey body, a head of hide on top, two cracks down the side, struck on the beat
  p.ell(cx, cy + 1.6 * r.k, rx, ry, stone);
  p.rect(Math.round(cx - rx), Math.round(cy - 1), Math.round(rx * 2), Math.max(2, Math.round(3 * r.k)), stone);
  p.ell(cx, cy - 1.2 * r.k, rx, ry * 0.55, skin);
  for (let i = -1; i <= 1; i += 2) p.px(cx + i * (rx - 0.3), cy - 1.2 * r.k, rim);
  p.px(cx - 1, cy + 1, crack); p.px(cx - 1, cy + 2, crack); p.px(cx + 2, cy + 2, crack);
  if (r.f % 2) p.glow(cx, cy - 3.4 * r.k, '#d8d0b8', 0.7);
}

function ankleBells(r: Rig): void {
  const { p } = r, g = flat(r, '#d8b040'), d = flat(r, '#8a6a20');
  // small brass bells on the ankles: a bead and its dark mouth at each foot
  for (const L of [r.near, r.far]) {
    const x = Math.round(L.fx) + 1, y = Math.round(r.foot - 3 - L.lift - r.hover);
    p.px(x, y, g); p.px(x + 1, y, g); p.px(x, y + 1, d);
  }
}

function chisel(r: Rig): void {
  const { p } = r;
  // a stonecutter's chisel: a wooden handle, a steel shank that widens to a bevelled edge, chips that fly off the edge
  stroke(r, -4, 2, wood(r), thick(r));
  stroke(r, 2, 9, steel(r), thick(r));
  poly2(r, [[9, -0.7], [10.6, -1.5], [10.6, 1.5], [9, 0.7]], iron(r));
  p.px(...at(r, 2, 1), brass(r));
  if (r.pose !== 'idle' || r.f % 2) p.glow(...at(r, 11, -1.6 - (r.f % 3)), '#d8d0b8', 0.8);
}
const poly2 = (r: Rig, pts: [number, number][], mat: number): void => r.p.poly(pts.map(([t, s]) => at(r, t, s)), mat);

function smallHammer(r: Rig): void {
  const { p } = r;
  // a small hammer: a short haft and a small iron head, one face and one peen (no bigger than the fist that holds it)
  stroke(r, -3, 7, wood(r), thick(r));
  poly2(r, [[6, -1.9], [6, 1.9], [9, 1.9], [9, -1.9]], iron(r));
  p.px(...at(r, 9.6, 1.6), steel(r));
  p.px(...at(r, 8, -1), p.mat(lighter(TONE.darkSteel, 0.3), { flat: true }));
  worn(r, at(r, 6), at(r, 9), p.mat('#6a6f78'));
}

// ── M7: the hammers of the dwarves of Kaz-Durum, one each (03-kaz-durum.md: the king's smithing hammer, the grandfather's cloth-wrapped hammer, the black stone hammer, the hot small hammer, the sculptor's trowel) ──
function smithHammer(r: Rig): void {
  const { p } = r, ir = iron(r), band = brass(r);
  // the king's hammer: a long haft, a tall soot-black head with a peen that tapers, a gold band at the neck
  stroke(r, -8, 11, wood(r), thick(r));
  poly2(r, [[7.5, -3], [7.5, 3], [11, 3], [11, -3]], ir);
  poly2(r, [[11, 3], [11, -3], [14.2, 0]], ir);
  stroke(r, 7.5, 7.5, band, 1, 3.2); stroke(r, 7.5, 7.5, band, 1, -3.2);
  p.px(...at(r, 9, 0), flat(r, '#ffb040'));
  worn(r, at(r, 8), at(r, 12), p.mat('#6a6f78'));
}
function wrappedHammer(r: Rig): void {
  const { p } = r, cloth = flat(r, '#c8bca0'), dk = flat(r, '#8a7a5c');
  // the grandfather's hammer wrapped in cloth: a plain haft with a head bound in strips of pale cloth, an end of the cloth hanging
  stroke(r, -6, 9, wood(r), thick(r));
  poly2(r, [[7, -3], [7, 3], [11, 3], [11, -3]], cloth);
  for (const t of [8, 10]) stroke(r, t, t, dk, 1, 2.6), stroke(r, t, t, dk, 1, -2.6);
  stroke(r, 7, 7, dk, 1, 2.6); stroke(r, 7, 7, dk, 1, -2.6);
  p.line(at(r, 7, 3), at(r, 4.5, 4.4), cloth);
}
function blackHammer(r: Rig): void {
  const { p } = r, stone = flat(r, '#2a2a34'), lt = flat(r, '#4a4a5a'), frost = flat(r, '#d8ecf8');
  // a hammer of black stone: a thick haft, a big square head of dark stone with a lit edge and ice that does not melt on the face
  stroke(r, -7, 10, wood(r), thick(r));
  poly2(r, [[8, -4.2], [8, 4.2], [12.6, 4.2], [12.6, -4.2]], stone);
  stroke(r, 8.4, 12.2, lt, 1, 3.8);
  p.px(...at(r, 12.6, 1.4), frost); p.px(...at(r, 12.6, -1.8), frost); p.px(...at(r, 10, -4.6), frost);
  worn(r, at(r, 8.5), at(r, 12), p.mat('#4a4a5a'));
}
function hotSmallHammer(r: Rig): void {
  const { p } = r, glow = r.look.accent;
  // the small hammer of the fire-smith: the head is the colour of the hot iron it strikes, with a spark on every other frame
  stroke(r, -3, 7, wood(r), thick(r));
  poly2(r, [[6, -1.9], [6, 1.9], [9, 1.9], [9, -1.9]], flat(r, lighter(glow, 0.1)));
  p.px(...at(r, 9.6, 1.6), flat(r, lighter(glow, 0.55)));
  p.glow(...at(r, 9.5, 0), glow, 0.7);
  if (r.f % 2) p.glow(...at(r, 11, -1.6), '#ffe0a0', 0.9);
}
function trowel(r: Rig): void {
  const { p } = r, st = steel(r);
  // a sculptor's trowel: a short wooden grip and a flat leaf-shaped blade with a lump of red clay on it
  stroke(r, -4, 3, wood(r), thick(r));
  stroke(r, 3, 5, st);
  poly2(r, [[5, -1], [8.5, -2.6], [12, 0], [8.5, 2.6], [5, 1]], st);
  poly2(r, [[7, -0.8], [9.4, -1.2], [9.4, 1], [7, 1.2]], flat(r, '#b8603a'));
}

// ── M7: the shadow merchant's cart of smoke (SH14-2) and the box on the chest of the boy who speaks to it (SH12-2S) ──
function smokeCart(r: Rig): void {
  const { p } = r, k = r.k, [hx, hy] = r.hand, wd = p.mat('#5a4668'), wdLite = p.mat('#8a74a0'), rim = p.mat('#c8cce0'), spoke = p.mat('#e4e8f6', { flat: true }), tyre = p.mat('#2a2236', { flat: true });
  const smoke = p.mat('#b4bcd8', { alpha: 0.85 }), smoke2 = p.mat('#e0e6f4', { alpha: 0.7 });
  const x = Math.round(hx) + 4, f = r.f % 2;
  // a small hand cart (not an anvil): two big spoked wheels, a shallow box on the axle, a long handle to the hand, and above the box a person made of smoke
  // (head, shoulders, two arms) that wavers and thins to a wisp where it meets the box
  const R = Math.max(3, Math.round(3.6 * k)), w = Math.round(11 * k), h = Math.max(3, Math.round(3.5 * k)), gy = Math.round(hy) + Math.round(8 * k), wy = gy - R;
  const y = wy - h - 1;
  p.line([hx, hy], [x, wy - 1], wd, 1);
  p.rect(x, y, w, h, wd); p.rect(x, y, w, 1, wdLite); p.rect(x, y + h - 1, w, 1, tyre);
  for (const wx of [x + R, x + w - R]) {
    for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2; p.px(wx + Math.cos(t) * R, wy + Math.sin(t) * R, a % 2 ? rim : tyre); }
    for (let a = 0; a < 4; a++) { const t = (a / 4) * Math.PI * 2 + (r.pose === 'walk' ? f * 0.4 : 0); p.line([wx, wy], [wx + Math.cos(t) * (R - 1), wy + Math.sin(t) * (R - 1)], spoke, 1); }
    p.px(wx, wy, tyre);
  }
  const cx = x + Math.round(w * 0.5), top = y - Math.round(12 * k);
  p.ell(cx + f * 0.5, top + 2, 2.2 * k + 0.4, 2.3 * k + 0.4, smoke2);
  p.poly([[cx - 3 * k - f, top + 5], [cx + 3 * k + f, top + 5], [cx + 1.5, y - 1], [cx - 1.5, y - 1]], smoke);
  p.line([cx - 3 * k - f, top + 5], [cx - 5 * k, top + 8 * k], smoke2); p.line([cx + 3 * k + f, top + 5], [cx + 5 * k, top + 8 * k + f], smoke2);
  p.px(cx + f, y - 2, smoke2);
}
function chestBox(r: Rig): void {
  const { p } = r, k = r.k, w = Math.max(5, Math.round(7 * k)), h = Math.max(6, Math.round(8 * k)), x = r.x0 + r.tw - w + 1, y = r.sh + 1;
  const wd = p.mat('#c8a468'), dk = p.mat('#2a1a0e', { flat: true }), strap = p.mat('#3a2a1a'), edge = p.mat('#6a4a28');
  // a pale wooden box with a row of holes bored in the front, hung on the chest by a dark strap over each shoulder, its frame a darker wood so it stands out from the shirt
  p.line([x + 1, y], [r.x0 + 1, r.sh - 1], strap); p.line([x + w - 2, y], [r.x0 + r.tw - 1, r.sh - 1], strap);
  p.rect(x, y, w, h, edge); p.rect(x + 1, y + 1, w - 2, h - 2, wd); p.rect(x + 1, y + 1, w - 2, 1, p.mat(lighter('#c8a468', 0.3)));
  for (let i = 0; i < 3; i++) p.px(x + 1 + i * 2 - (w < 6 ? 1 : 0), y + 3, dk);
  for (let i = 0; i < 3; i++) p.px(x + 1 + i * 2 - (w < 6 ? 1 : 0), y + 5, dk);
}

function wrench(r: Rig): void {
  const { p } = r, st = steel(r);
  // a long wrench: a flat bar of steel with an open jaw at the far end (two prongs and the gap between them) and a ring at the near end
  stroke(r, -5, 11, st, thick(r));
  poly2(r, [[10, -2.2], [10, 2.2], [13.4, 2.2], [13.4, 0.9], [11.6, 0.9], [11.6, -0.9], [13.4, -0.9], [13.4, -2.2]], iron(r));
  p.px(...at(r, -5.8, 0), iron(r)); p.px(...at(r, -5.8, 1), iron(r));
  p.px(...at(r, 3, 0.8), p.mat('#c0a050', { flat: true }));
  worn(r, at(r, -3), at(r, 10), p.mat('#5a3a24'));
}

function slate(r: Rig): void {
  const { p } = r, [hx, hy] = r.hand, w = sz(r, 7), h = sz(r, 6), x = Math.round(hx) + 1, y = Math.round(hy) - h - sz(r, 1);
  const frame = p.mat('#8a6238'), board = p.mat('#2e3a36'), chalkm = flat(r, '#eae6da');
  // a school slate: a wooden frame round a dark board with a line of chalk on it, held upright before the body
  p.rect(x, y, w, h, frame);
  p.rect(x + 1, y + 1, w - 2, h - 2, board);
  p.line([x + 1.5, y + 1.6], [x + w - 2, y + 1.6], chalkm);
  p.line([x + 1.5, y + 3], [x + w - 3.5, y + 3], chalkm);
  p.px(x + w - 2.5, y + h - 1.6, chalkm);
}

function bouquet(r: Rig): void {
  const { p } = r, [cx, cy] = palm(r), stem = p.mat('#4a6a3a', { flat: true }), leaf = flat(r, '#5a8a48');
  // a small bunch of wild flowers held upright: three stems from the fist, a white, a pink and a yellow head, a leaf
  p.line([cx, cy + 2.4 * r.k], [cx - 1.6, cy - 1], stem); p.line([cx, cy + 2.4 * r.k], [cx + 0.4, cy - 2.4 * r.k], stem); p.line([cx, cy + 2.4 * r.k], [cx + 2, cy - 0.6], stem);
  p.px(cx - 1.8, cy - 1.6, flat(r, '#f0ecd8')); p.px(cx + 0.4, cy - 3 * r.k, flat(r, '#e8a0c0')); p.px(cx + 2.2, cy - 1.2, flat(r, '#e8d060'));
  p.px(cx - 0.8, cy + 0.4, leaf); p.px(cx + 1.4, cy + 0.8, leaf);
}

function sleepingChild(r: Rig): void {
  const { p } = r, k = r.k, cx = r.hand[0] - 0.5, cy = r.hand[1] + 1.4 * k;
  const blanket = p.mat('#b4a68a'), edge = p.mat('#8a7a5c'), skin = p.mat('#ecc8a0'), hair = p.mat('#6a4a30'), shut = flat(r, '#4a3028');
  // a child asleep in the crook of the arm: a bundle of blanket laid across the chest, the small head at the chest side with the hair over it, one eye shut
  p.ell(cx + 0.5, cy, 4.6 * k + 0.4, 2.2 * k + 0.6, blanket);
  p.line([cx - 3, cy + 1.6 * k], [cx + 4, cy + 1.6 * k], edge);
  p.ell(cx - 4.2 * k, cy - 0.8 * k, 1.9 * k + 0.2, 1.9 * k + 0.2, skin);
  p.rect(Math.round(cx - 6 * k), Math.round(cy - 2.6 * k), Math.max(2, Math.round(3.4 * k)), 1, hair);
  p.px(cx - 3.4 * k, cy - 0.8 * k, shut);
  p.px(cx + 4.6, cy + 0.6, p.mat('#d8c8a8', { flat: true }));
}

export const TOOLS_EXTRA: Record<string, Tool> = {
  pistol: { kind: 'shoot', held: pistol },
  musket: { kind: 'shoot', held: musket },
  rifle: { kind: 'shoot', held: rifle },
  spyglass: { kind: 'thrust', held: spyglass },
  compass: { kind: 'carry', held: compass },
  pocketwatch: { kind: 'carry', held: pocketwatch },
  fan: { kind: 'carry', held: fan },
  scissors: { kind: 'thrust', held: scissors },
  gauge: { kind: 'carry', held: gauge },
  whip: { kind: 'swing', held: whip },
  sling: { kind: 'swing', held: sling },
  knuckles: { kind: 'thrust', held: knuckles },
  // wave 4: the things the docs name that fell to a generic book or box
  keyring: { kind: 'carry', held: keyring },
  basket: { kind: 'carry', held: basket },
  garland: { kind: 'carry', held: garland },
  mallet: { kind: 'swing', held: mallet },
  bellrope: { kind: 'carry', held: bellrope },
  beads: { kind: 'carry', held: beads },
  doll: { kind: 'carry', held: doll },
  bucket: { kind: 'carry', held: bucket },
  papyrus: { kind: 'carry', held: papyrus },
  card: { kind: 'carry', held: card },
  letter: { kind: 'carry', held: letter },
  crystal: { kind: 'cast', held: crystal },
  jar: { kind: 'carry', held: jar },
  net: { kind: 'swing', held: net },
  brush: { kind: 'swing', held: brush },
  map: { kind: 'carry', held: mapPaper },
  bottle: { kind: 'carry', held: bottle },
  pipe: { kind: 'swing', held: pipe },
  bag: { kind: 'carry', held: bag },
  hotiron: { kind: 'swing', held: hotiron },
  tank: { kind: 'carry', held: tank },
  quill: { kind: 'swing', held: quill },
  chalk: { kind: 'swing', held: chalk },
  // wave 5: a sheathed sword and ankle bells draw at the body (front layer), the hands stay free
  sheathed: { kind: 'none', front: sheathedSword },
  greatsheath: { kind: 'none', front: greatSheath },
  goldsheath: { kind: 'none', front: goldSheath },
  anklebells: { kind: 'none', front: ankleBells },
  twinpistol: { kind: 'shoot', held: twinPistol },
  drum: { kind: 'carry', held: drum },
  chisel: { kind: 'swing', held: chisel },
  smallhammer: { kind: 'swing', held: smallHammer },
  smithhammer: { kind: 'swing', held: smithHammer },
  wrappedhammer: { kind: 'swing', held: wrappedHammer },
  blackhammer: { kind: 'swing', held: blackHammer },
  hotsmallhammer: { kind: 'swing', held: hotSmallHammer },
  trowel: { kind: 'swing', held: trowel },
  smokecart: { kind: 'carry', held: smokeCart },
  chestbox: { kind: 'none', front: chestBox },
  wrench: { kind: 'swing', held: wrench },
  slate: { kind: 'carry', held: slate },
  bouquet: { kind: 'carry', held: bouquet },
  sleepingchild: { kind: 'carry', held: sleepingChild },
};
