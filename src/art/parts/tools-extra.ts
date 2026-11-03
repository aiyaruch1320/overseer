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
};
