// Held things (poc-visuals: เครื่องมือ 30 ชนิด, and the weapons of 05-weapons-rules.md, 10-job-weapons.md, 14-consumables-tools-materials.md).
// The `held` layer is under the near arm, so the hand closes over the grip. `kind` picks the attack and work frames (thrust, swing, cast, shoot);
// a tool with kind `none` is not drawn at all, so every tool here has one of the other four. Lengths are in pixels of an adult and scale with
// `r.k`; a long thing is drawn along the held angle (`along`/`aside`), a small thing (a mug, a book) is drawn upright in the hand.
// Staffs, wands and books glow on the frames where `r.glow` is set (the cast pose). Every tool takes a mark of use from `look.wear`.
import type { Pt } from '../paint';
import { along, aside, type Rig, type Tool } from '../rig';
import { TONE, darker, hash, lighter, seedOf } from './kit';

/** The point `t` pixels along the held thing from the hand and `s` pixels across it (both in pixels of an adult). */
const at = (r: Rig, t: number, s = 0): Pt => (s ? aside(r, along(r, t * r.k), s * r.k) : along(r, t * r.k));
const stroke = (r: Rig, t0: number, t1: number, mat: number, w = 1, s = 0): void => r.p.line(at(r, t0, s), at(r, t1, s), mat, w);
const thick = (r: Rig): number => (r.k >= 0.8 ? 2 : 1);
const sz = (r: Rig, v: number): number => Math.max(1, Math.round(v * r.k));
const poly = (r: Rig, pts: [number, number][], mat: number): void => r.p.poly(pts.map(([t, s]) => at(r, t, s)), mat);
const steel = (r: Rig): number => r.p.mat(lighter(TONE.steel, 0.12));
const iron = (r: Rig): number => r.p.mat(TONE.darkSteel);
const gold = (r: Rig): number => r.p.mat(TONE.gold);
const rope = (r: Rig): number => r.p.mat('#a89868');
/** Rust and nicks that show on a worn weapon: a few pixels of `mark` on the line from `t0` to `t1`. */
function marks(r: Rig, t0: number, t1: number, mark: number, s = 0): void {
  const w = r.look.wear;
  if (w < 0.25) return;
  const seed = seedOf(r), n = w > 0.6 ? 3 : w > 0.4 ? 2 : 1;
  for (let i = 0; i < n; i++) { const p = at(r, t0 + (t1 - t0) * hash(seed, i, 11), s); r.p.px(p[0], p[1], mark); }
}
/** Sparks round a point on the frames where a thing glows (deterministic for the frame): glow pixels in the accent colour, laid after the outline, so they have no dark ring. */
function sparks(r: Rig, c: Pt, n: number, reach = 3): void {
  for (let i = 0; i < n; i++) {
    const a = hash(r.f + 1, i, 3) * Math.PI * 2, d = (2.6 + hash(r.f + 1, i, 4) * reach) * Math.max(0.8, r.k);
    r.p.glow(c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d, r.look.accent, i % 2 ? 0.75 : 1);
  }
}
/** A held book, ledger or scroll sits in front of the chest, upright. */
const hold = (r: Rig, dx: number, dy: number): Pt => [r.hand[0] + dx * r.k, r.hand[1] + dy * r.k];

const wood = (r: Rig) => r.m.wood;

export const TOOLS: Record<string, Tool> = {
  // ── thrust: spears and the like ─────────────────────────────────────────────────────────────────────────────────────────────────
  spear: {
    kind: 'thrust',
    // the grip is near the middle of the shaft: the butt rests behind, the head reaches 12 forward (the frame is 56 wide)
    held: (r) => {
      const { p, m } = r;
      stroke(r, -15, 9, wood(r));
      poly(r, [[8.6, 0], [10.2, 1.7], [12.8, 0], [10.2, -1.7]], steel(r));
      p.px(...at(r, 8.4), m.leather);
      p.px(...at(r, 7.6, 1), m.accent); p.px(...at(r, 6.8, 0), m.accent); p.px(...at(r, 6, -1), m.accent);
      p.px(...at(r, -15.6), iron(r));
      marks(r, -12, 6, r.p.mat('#4a3220'));
    },
  },
  trident: {
    kind: 'thrust',
    held: (r) => {
      const { p } = r, st = steel(r);
      stroke(r, -15, 9, wood(r));
      stroke(r, 8.6, 8.6, st, 1, 2.4); stroke(r, 8.6, 8.6, st, 1, -2.4); stroke(r, 8.6, 8.6, st, 1, 1); stroke(r, 8.6, 8.6, st, 1, -1);
      stroke(r, 9, 12.8, st);
      stroke(r, 8.6, 12, st, 1, 2.4); stroke(r, 8.6, 12, st, 1, -2.4);
      p.px(...at(r, 12.6, 2.4), st); p.px(...at(r, 12.6, -2.4), st);
      marks(r, 9, 12, p.mat('#5a7a6a'), 0);
    },
  },
  banner: {
    // kind cast: the pole stays upright in every pose, so it can be as tall as a standard
    kind: 'cast',
    held: (r) => {
      const { p, m } = r, f = r.flap, d = darker(r.look.main, 0.35);
      stroke(r, -14, 18, wood(r));
      p.px(...at(r, 19), gold(r));
      poly(r, [[16.5, 0.7], [16.5, 8 + f], [13, 6.5 + f], [11.5, 9 + f], [8, 7 + f], [8, 0.7]], m.main);
      poly(r, [[16.5, 0.7], [16.5, 2], [8, 2], [8, 0.7]], p.mat(d));
      p.px(...at(r, 12.5, 4), m.accent); p.px(...at(r, 12.5, 5), m.accent); p.px(...at(r, 11.5, 4.5), m.accent);
      if (r.look.wear > 0.3) { p.px(...at(r, 9.5, 6 + f), 0); p.px(...at(r, 14, 7 + f), 0); }
      if (r.glow) sparks(r, at(r, 20), 4, 4);
    },
  },
  dagger: {
    kind: 'thrust',
    held: (r) => {
      const { p, m } = r, st = steel(r);
      stroke(r, -3, 0, m.leather);
      p.px(...at(r, -3.6), gold(r));
      stroke(r, 0.6, 0.6, iron(r), 1, 0); p.px(...at(r, 0.8, 1.4), iron(r)); p.px(...at(r, 0.8, -1.4), iron(r));
      poly(r, [[1, 1], [6, 0.8], [8.5, 0], [6, -0.8], [1, -1]], st);
      marks(r, 3, 6, 0);
    },
  },
  shield: {
    kind: 'thrust',
    // on the far arm: held in front of the body, strapped to the arm; drawn over the body and under the near arm
    held: (r) => {
      const { p, m } = r, [fx, fy] = r.farHand, k = r.k, cx = fx + 3.4 * k, cy = fy - 0.2 * k, rx = Math.max(2.4, 3.7 * k), ry = Math.max(3, 5.2 * k);
      const rim = p.mat(TONE.darkSteel), plank = p.mat('#8a6a3c'), seam = p.mat('#5a4228');
      p.ell(cx, cy, rx + 0.9, ry + 0.9, rim);
      p.ell(cx, cy, rx, ry, plank);
      p.line([cx - rx * 0.5, cy - ry * 0.8], [cx - rx * 0.5, cy + ry * 0.8], seam);
      p.line([cx + rx * 0.45, cy - ry * 0.8], [cx + rx * 0.45, cy + ry * 0.8], seam);
      p.ell(cx, cy, Math.max(1, 1.3 * k), Math.max(1, 1.3 * k), steel(r));
      p.px(cx + 1.2 * k, cy - 2.4 * k, m.accent); p.px(cx + 1.2 * k, cy - 3.4 * k, m.accent);
      if (r.look.wear > 0.25) { p.px(cx - 1.8 * k, cy + 2.2 * k, 0); p.px(cx + 0.6 * k, cy - 1.8 * k, p.mat('#5a5f68')); p.px(cx + 1.4 * k, cy + 1.4 * k, seam); }
      p.px(fx, fy, m.skin);
    },
  },

  staff: {
    kind: 'cast',
    held: (r) => {
      const { p, m } = r, on = r.glow, stone = p.mat(on ? lighter(r.look.accent, 0.35) : darker(r.look.accent, 0.3), { flat: true });
      stroke(r, -12, 14, wood(r));
      p.px(...at(r, 3, 0.8), p.mat(darker('#7a5232', 0.3))); p.px(...at(r, 8, -0.8), p.mat(darker('#7a5232', 0.3)));
      stroke(r, 12, 16, wood(r), 1, 1.6); stroke(r, 12, 16, wood(r), 1, -1.6);
      const c = at(r, 15);
      p.ell(c[0], c[1], 1.4 * r.k + 0.4, 1.4 * r.k + 0.4, stone);
      if (on) sparks(r, c, 4, 3);
      marks(r, -8, 10, 0, 0);
    },
  },
  orbstaff: {
    kind: 'cast',
    held: (r) => {
      const { p, m } = r, on = r.glow, c = at(r, 16.5), orb = p.mat(on ? lighter(r.look.accent, 0.45) : r.look.accent, { flat: true }), rad = (on ? 2.9 : 2.4) * Math.max(0.8, r.k);
      stroke(r, -12, 15, wood(r));
      p.px(...at(r, 5), gold(r)); p.px(...at(r, 6), gold(r));
      stroke(r, 13, 17, wood(r), 1, 2.4); stroke(r, 13, 17, wood(r), 1, -2.4);
      p.ell(c[0], c[1], rad, rad, orb);
      p.px(c[0] - 0.6, c[1] - 0.8, p.mat('#ffffff', { flat: true }));
      if (on) sparks(r, c, 6, 4);
    },
  },
  wand: {
    kind: 'cast',
    held: (r) => {
      const { p, m } = r, on = r.glow, tip = at(r, 11), wd = p.mat('#7a5a3c');
      stroke(r, -3, 10, wd, thick(r));
      p.px(...at(r, -3.6), p.mat(TONE.cream));
      p.px(...at(r, 3, 1), p.mat('#4a3626'));
      p.px(tip[0], tip[1], on ? m.glow : p.mat(lighter(r.look.accent, 0.55), { flat: true }));
      p.px(tip[0], tip[1] - 1, on ? m.glow : p.mat(lighter(r.look.accent, 0.55), { flat: true }));
      if (on) { p.glow(tip[0] + 1, tip[1], r.look.accent); p.glow(tip[0] - 1, tip[1], r.look.accent); p.glow(tip[0], tip[1] - 2, r.look.accent); sparks(r, tip, 5, 4); }
    },
  },
  book: {
    kind: 'carry',
    // three books by the owner: a closed cover with a gilt band, a book held open (two pages with lines of text), a thick one with a ribbon that hangs from the pages
    held: (r) => {
      const { p, m } = r, [x, y] = hold(r, 1.4, -0.8), w = sz(r, 5), h = sz(r, 6), v = seedOf(r) % 3, cover = p.mat(darker(r.look.second, 0.15)), page = p.mat(TONE.cream), ink = p.mat('#8a7a60', { flat: true });
      if (v === 1) {
        // open: two pages side by side, the spine dark between them, the text as short grey lines
        const hw = Math.max(3, Math.round(w * 0.75));
        p.rect(x - hw, y - h + 2, hw, h - 1, page); p.rect(x, y - h + 2, hw, h - 1, p.mat(darker(TONE.cream, 0.08)));
        p.rect(x, y - h + 2, 1, h - 1, cover);
        p.rect(x - hw - 1, y - h + 3, 1, h - 1, cover); p.rect(x + hw, y - h + 3, 1, h - 1, cover);
        for (let i = 0; i < h - 3; i += 2) { p.rect(x - hw + 1, y - h + 3 + i, hw - 2, 1, ink); p.rect(x + 1, y - h + 3 + i, hw - 2, 1, ink); }
        if (r.glow) { p.glow(x - 1, y - h - 1, r.look.accent); p.glow(x + 2, y - h - 3, r.look.accent); sparks(r, [x, y - h], 3, 4); }
        return;
      }
      p.rect(x, y - h + 1, w, h, cover);
      p.rect(x + w, y - h + 2, 1, h - 1, page); p.rect(x + 1, y + 1, w, 1, page);
      p.rect(x, y - h + 1, 1, h, p.mat(darker(r.look.second, 0.4)));
      if (v === 2) {
        // thick, with a ribbon marker that hangs below the pages and a clasp
        p.px(x + 2, y + 2, m.accent); p.px(x + 2, y + 3, m.accent); p.px(x + w - 1, y - Math.floor(h / 2), m.metal);
        p.rect(x + 1, y - h + 2, w - 1, 1, p.mat(lighter(r.look.second, 0.25)));
      } else {
        // a gilt band across the cover and a stamped boss
        p.rect(x + 1, y - h + 2, w - 1, 1, m.metal); p.rect(x + 1, y - 1, w - 1, 1, m.metal);
        p.px(x + Math.floor(w / 2) + 1, y - Math.floor(h / 2), m.accent);
      }
      if (r.look.wear > 0.3) p.px(x + w - 1, y - h + 1, page);
      if (r.glow) { p.glow(x + 1, y - h - 1, r.look.accent); p.glow(x + 3, y - h - 3, r.look.accent); p.glow(x + w - 1, y - h - 2, r.look.accent); sparks(r, [x + w / 2, y - h], 3, 4); }
    },
  },
  scroll: {
    kind: 'carry',
    // a roll of paper with rod ends: by the owner's seed the sheet hangs unrolled from the roll with lines of writing, or the roll is closed with a cord and a red seal
    held: (r) => {
      const { p, m } = r, [x, y] = hold(r, 1.2, -0.6), len = sz(r, 7), w = Math.max(2, Math.round(2.5 * r.k)), pa = p.mat(TONE.cream), rod = p.mat('#8a7040'), v = seedOf(r) % 2;
      if (v === 0) {
        const sw = w + 2, top = y - len + 1, sh = Math.max(3, Math.round(len * 0.7));
        p.rect(x - 1, top, sw + 2, 2, pa); p.rect(x - 2, top, 1, 2, rod); p.rect(x + sw + 1, top, 1, 2, rod);
        p.rect(x, top + 2, sw, sh, p.mat(darker(TONE.cream, 0.05)));
        for (let i = 1; i < sh - 1; i += 2) p.rect(x + 1, top + 2 + i, sw - 2, 1, p.mat('#8a7a60', { flat: true }));
        p.px(x + sw - 1, top + 2 + sh - 1, p.mat(TONE.blood, { flat: true }));
      } else {
        p.rect(x, y - len + 1, w, len, pa);
        p.rect(x - 1, y - len + 1, 1, 1, rod); p.rect(x + w, y - len + 1, 1, 1, rod); p.rect(x - 1, y, 1, 1, rod); p.rect(x + w, y, 1, 1, rod);
        p.rect(x, y - Math.floor(len / 2), w, 1, p.mat('#8a7a60'));
        p.px(x + 1, y - Math.floor(len / 2) + 1, p.mat(TONE.blood, { flat: true }));
      }
      p.px(x + w - 1, y - len + 2, m.accent);
      if (r.glow) { p.glow(x, y - len - 1, r.look.accent); p.glow(x + 2, y - len - 3, r.look.accent); sparks(r, [x + w / 2, y - len], 3, 4); }
    },
  },

  // ── swing: blades, hafted weapons, tools ────────────────────────────────────────────────────────────────────────────────────────
  sword: {
    kind: 'swing',
    held: (r) => {
      const { p, m } = r, st = steel(r);
      stroke(r, -3, 0.5, m.leather);
      p.px(...at(r, -4), gold(r));
      stroke(r, 1, 1, iron(r), 1, 0); p.px(...at(r, 1, 2), iron(r)); p.px(...at(r, 1, -2), iron(r)); p.px(...at(r, 1, 1), iron(r)); p.px(...at(r, 1, -1), iron(r));
      stroke(r, 2, 12, st, thick(r));
      stroke(r, 12, 16, st);
      marks(r, 5, 12, 0, 0.5);
    },
  },
  greatsword: {
    kind: 'swing',
    held: (r) => {
      const { p, m } = r, st = steel(r);
      stroke(r, -6, 0.5, m.leather, thick(r));
      p.px(...at(r, -7), gold(r)); p.px(...at(r, -7.8), gold(r));
      for (const s of [-3, -2, 2, 3]) p.px(...at(r, 1, s), iron(r));
      stroke(r, 1, 1, iron(r), 1, 1); stroke(r, 1, 1, iron(r), 1, -1);
      poly(r, [[2, 1.8], [14, 1.6], [17.5, 0], [14, -1.6], [2, -1.8]], st);
      stroke(r, 3, 13, p.mat(darker(TONE.steel, 0.25)));
      marks(r, 6, 15, 0, 1.2);
    },
  },
  mace: {
    kind: 'swing', rest: -42,
    held: (r) => {
      const { p, m } = r, ir = iron(r), c = at(r, 12);
      stroke(r, -5, 9, wood(r));
      p.px(...at(r, -5.5), m.metal);
      p.ell(c[0], c[1], 2.3 * r.k + 0.3, 2.3 * r.k + 0.3, ir);
      for (const [t, s] of [[12, 3.4], [12, -3.4], [15, 0], [9.6, 0]] as const) p.px(...at(r, t, s), steel(r));
      p.px(c[0] - 0.7, c[1] - 0.7, steel(r));
      marks(r, 9, 13, p.mat('#6a4a30'));
    },
  },
  club: {
    kind: 'swing', rest: -42,
    held: (r) => {
      const { p } = r;
      poly(r, [[-4, 0.7], [3, 1.1], [10, 1.7], [13, 1.8], [14, 0], [13, -1.8], [10, -1.7], [3, -1.1], [-4, -0.7]], wood(r));
      p.px(...at(r, -4.5), r.m.leather);
      for (const [t, s] of [[11, 0.8], [9, -0.8], [12.5, -0.6]] as const) p.px(...at(r, t, s), r.m.metal);
      p.px(...at(r, 6, 0.4), p.mat('#4a3220'));
      marks(r, 4, 12, p.mat('#4a3220'));
    },
  },
  hammer: {
    kind: 'swing', rest: -42,
    // three hammers by the owner: a sledge (a square head), a smith's hammer (a short haft, a head with a peen that tapers to a point) and a maul (a long haft, a big head banded with the trim colour)
    held: (r) => {
      const { p } = r, ir = iron(r), v = seedOf(r) % 3, band = p.mat(lighter(darker(r.look.second, 0.1), 0.05));
      if (v === 1) {
        stroke(r, -3, 9, wood(r));
        poly(r, [[7, -2.6], [7, 2.6], [10, 2.6], [10, -2.6]], ir);
        poly(r, [[10, 2.6], [10, -2.6], [13, 0]], ir);
        stroke(r, 7.5, 9.5, steel(r), 1, 2.4);
        marks(r, 7, 12, p.mat('#6a6f78'), 1);
        return;
      }
      if (v === 2) {
        stroke(r, -8, 11, wood(r), thick(r));
        poly(r, [[8, -4.6], [8, 4.6], [12.5, 4.6], [12.5, -4.6]], ir);
        stroke(r, 8.5, 12, steel(r), 1, 4.2);
        stroke(r, 10, 10, band, 1, 4.6); stroke(r, 10, 10, band, 1, -4.6);
        p.px(...at(r, 10, 0), band);
        marks(r, 8, 12, p.mat('#6a6f78'), 1);
        return;
      }
      stroke(r, -5, 11, wood(r));
      poly(r, [[8, -3.4], [8, 3.4], [12.5, 3.4], [12.5, -3.4]], ir);
      stroke(r, 9, 12, steel(r), 1, 3.2);
      p.px(...at(r, 10.5, -3.9), ir); p.px(...at(r, 10.5, 3.9), ir);
      marks(r, 8, 12, p.mat('#6a6f78'), 1);
    },
  },
  axe: {
    kind: 'swing', rest: -42,
    held: (r) => {
      const { p } = r;
      stroke(r, -4, 14, wood(r));
      poly(r, [[13.2, 0], [14.5, 3.4], [11.5, 5.6], [8, 3.4], [8, 0]], steel(r));
      poly(r, [[12, 0], [12, -1.6], [10, -1.6], [10, 0]], iron(r));
      stroke(r, 9, 13.5, iron(r), 1, 0.6);
      marks(r, 9, 13, p.mat('#6a4a30'), 3);
    },
  },
  pickaxe: {
    kind: 'swing', rest: -42,
    held: (r) => {
      const { p } = r, ir = iron(r), pts: [number, number][] = [[10, -5.8], [12, -3.4], [13.2, 0], [12, 3.4], [10, 5.8]];
      stroke(r, -5, 13, wood(r));
      for (let i = 0; i < pts.length - 1; i++) p.line(at(r, pts[i][0], pts[i][1]), at(r, pts[i + 1][0], pts[i + 1][1]), i === 1 || i === 2 ? steel(r) : ir, i === 1 || i === 2 ? thick(r) : 1);
      p.px(...at(r, 13.2, 0.9), ir);
      marks(r, 11, 13, p.mat('#6a4a30'), 2);
    },
  },
  hoe: {
    kind: 'swing',
    held: (r) => {
      const { p } = r;
      stroke(r, -4, 14, wood(r));
      poly(r, [[14, 0], [14.4, 5.4], [11.6, 5.4], [11.8, 1.4], [12.4, 0]], iron(r));
      stroke(r, 13.4, 13.4, steel(r), 1, 3);
      marks(r, 12, 14, p.mat('#7a4a2a'), 3);
    },
  },
  shovel: {
    kind: 'swing',
    held: (r) => {
      const { p } = r;
      stroke(r, -5, 9, wood(r));
      stroke(r, -5.4, -5.4, r.m.leather, 1, 2.2); stroke(r, -5.4, -5.4, r.m.leather, 1, -2.2); stroke(r, -5.4, -5.4, r.m.leather, 1, 0);
      poly(r, [[8, 0], [8, 2], [10.5, 3.2], [14, 2], [15.5, 0], [14, -2], [10.5, -3.2], [8, -2]], steel(r));
      stroke(r, 9, 14, iron(r), 1, 0);
      marks(r, 9, 15, p.mat('#7a4a2a'), 1.4);
    },
  },
  broom: {
    kind: 'swing',
    held: (r) => {
      const { p } = r, straw = p.mat('#b49a58'), dk = p.mat('#7a6030');
      stroke(r, -6, 10, wood(r));
      poly(r, [[8.5, 1], [8.5, -1], [15.5, -3], [15.5, 3]], straw);
      p.line(at(r, 9, -1.2), at(r, 9, 1.2), rope(r));
      p.line(at(r, 11.5, -1.8), at(r, 11.5, 1.8), dk);
      for (const s of [-2.6, -1, 0.6, 2.2]) p.px(...at(r, 16.6, s), straw);
      marks(r, 12, 15, dk, 1);
    },
  },
  ladle: {
    kind: 'swing',
    held: (r) => {
      const { p } = r, c = at(r, 11.5, 1);
      stroke(r, -4, 10, wood(r));
      p.ell(c[0], c[1], 2.2 * r.k + 0.2, 1.8 * r.k + 0.2, steel(r));
      p.px(c[0] + 0.5, c[1] - 0.2, p.mat('#6a4a2a', { flat: true }));
      marks(r, 0, 8, 0);
    },
  },
  scythe: {
    kind: 'swing',
    held: (r) => {
      const { p } = r, st = steel(r);
      stroke(r, -10, 13, wood(r));
      p.px(...at(r, 3, 1.6), wood(r)); p.px(...at(r, 3.5, 2.2), wood(r));
      const pts: [number, number][] = [[12.5, 1], [14.2, 3.6], [13.6, 7], [11, 9.4], [8, 10.2]];
      for (let i = 0; i < pts.length - 1; i++) p.line(at(r, pts[i][0], pts[i][1]), at(r, pts[i + 1][0], pts[i + 1][1]), i < 2 ? st : iron(r), i < 3 ? thick(r) : 1);
      p.px(...at(r, 11.7, 0.4), iron(r));
      marks(r, 9, 13, p.mat('#7a4a2a'), 6);
    },
  },
  crook: {
    kind: 'swing',
    held: (r) => {
      const { p } = r, pts: [number, number][] = [[15, 0], [17.6, 0.6], [19, 2.4], [18.6, 4.6], [16.6, 5.4], [15.4, 4.4]];
      stroke(r, -8, 15, wood(r));
      for (let i = 0; i < pts.length - 1; i++) p.line(at(r, pts[i][0], pts[i][1]), at(r, pts[i + 1][0], pts[i + 1][1]), wood(r));
      p.px(...at(r, 6), rope(r)); p.px(...at(r, 7), rope(r));
      marks(r, -6, 12, p.mat('#4a3220'));
    },
  },
  cane: {
    kind: 'swing',
    held: (r) => {
      const { p } = r, pts: [number, number][] = [[8, 0], [9.6, 0.4], [10.2, 1.8], [9.2, 2.8]];
      stroke(r, -4, 8, wood(r));
      for (let i = 0; i < pts.length - 1; i++) p.line(at(r, pts[i][0], pts[i][1]), at(r, pts[i + 1][0], pts[i + 1][1]), wood(r));
      p.px(...at(r, -4.6), r.m.metal);
      p.px(...at(r, 7.6), gold(r));
    },
  },
  scepter: {
    kind: 'swing',
    held: (r) => {
      const { p } = r, g = gold(r), jewel = p.mat(TONE.blood, { flat: true }), c = at(r, 12.3);
      stroke(r, -4, 10, g);
      p.px(...at(r, 5, 0.9), p.mat(lighter(TONE.gold, 0.35))); p.px(...at(r, 3, -0.9), p.mat(darker(TONE.gold, 0.3)));
      p.ell(c[0], c[1], 1.7 * r.k + 0.2, 1.7 * r.k + 0.2, g);
      p.ell(c[0], c[1], 0.9 * r.k + 0.3, 0.9 * r.k + 0.3, jewel);
      stroke(r, 10, 10.4, g, 1, 1.4); stroke(r, 10, 10.4, g, 1, -1.4);
    },
  },
  censer: {
    kind: 'carry',
    // hangs from the hand on a chain, whatever the angle of the arm
    held: (r) => {
      const { p } = r, [hx, hy] = r.hand, len = 5 * r.k, c: Pt = [hx + 1, hy + len + 2.4 * r.k], g = gold(r), dk = p.mat(darker(TONE.gold, 0.45));
      p.line([hx, hy], [hx + 1, hy + len], p.mat(TONE.steel));
      p.ell(c[0], c[1], 2.4 * r.k + 0.3, 2.0 * r.k + 0.3, g);
      p.rect(Math.round(c[0] - 1), Math.round(c[1] - 0.5), Math.max(2, Math.round(2 * r.k)), 1, dk);
      p.px(c[0] - 1, c[1] + 1, dk);
      // smoke: pale wisps that rise and drift, a little different in each frame
      for (let i = 0; i < 4; i++) p.glow(c[0] + Math.sin(r.f * 1.7 + i * 1.3) * 1.2 + i * 0.3, c[1] - 3 * r.k - i * 1.7, '#d8d4cc', 0.8 - i * 0.12);
    },
  },
  rod: {
    kind: 'swing',
    held: (r) => {
      const { p } = r, tip = at(r, 16.5, 1.6);
      p.line(at(r, -6), at(r, 6, 0.2), wood(r));
      p.line(at(r, 6, 0.2), at(r, 12, 0.8), wood(r));
      p.line(at(r, 12, 0.8), tip, p.mat('#8a6a3a'));
      p.px(...at(r, 1.5, -0.8), r.m.metal); p.px(...at(r, 2.2, -1.4), r.m.metal);
      p.line(tip, [tip[0] + 0.5, tip[1] + 7 * r.k], p.mat(TONE.cream));
      p.px(tip[0] + 0.5, tip[1] + 7 * r.k + 1, r.m.metal);
    },
  },
  bow: {
    kind: 'shoot',
    // kept upright whatever the arm does; on the draw frames of an attack the far hand pulls the nocked arrow back and the string runs to it
    held: (r) => {
      const { p } = r, [hx, hy] = r.hand, h = 11.5 * r.k, bow = p.mat('#6e4a2c'), cord = p.mat(TONE.cream);
      const top: Pt = [hx - 1.5, hy - h], bot: Pt = [hx - 1.5, hy + h * 0.85];
      const curve: Pt[] = [top, [hx + 0.6, hy - h * 0.6], [hx + 2.2, hy - h * 0.25], [hx + 2.8, hy], [hx + 2.2, hy + h * 0.25], [hx + 0.6, hy + h * 0.55], bot];
      for (let i = 0; i < curve.length - 1; i++) p.line(curve[i], curve[i + 1], bow, i >= 2 && i <= 3 ? thick(r) : 1);
      if (r.pose === 'attack' && r.f < 2) {
        const nock: Pt = [Math.min(r.farHand[0] + 1, hx - 2), hy], head: Pt = [hx + 8 * r.k, hy];
        p.line([top[0] - 0.4, top[1]], nock, cord); p.line(nock, [bot[0] - 0.4, bot[1]], cord);
        p.line(nock, head, p.mat('#8a7a5a'));
        p.px(head[0] + 1, head[1], steel(r));
        p.px(nock[0] - 0.5, nock[1] - 1, cord); p.px(nock[0] - 0.5, nock[1] + 1, cord);
      } else p.line([top[0] - 0.4, top[1]], [bot[0] - 0.4, bot[1]], cord);
    },
    // the quiver on the back, arrows showing over the shoulder
    back: (r) => {
      const { p } = r, x = r.x0 - 1, top = r.sh - 1, bot = r.hip, lt = p.mat(TONE.cream);
      p.rect(x, top + 1, 3, Math.max(3, bot - top - 1), r.m.leather);
      p.px(x, top, lt); p.px(x + 1, top - 1, lt); p.px(x + 2, top, lt);
      p.px(x + 1, top + 2, r.m.metal);
    },
  },

  // ── thrust: things carried in the hand ──────────────────────────────────────────────────────────────────────────────────────────
  ledger: {
    kind: 'carry',
    // a wide, thick account book: the cover with metal corners, the page block showing along the bottom, a strap across it and loose papers at the top
    held: (r) => {
      const { p, m } = r, [x, y] = hold(r, 1.3, -0.8), w = sz(r, 6), h = sz(r, 7), cover = p.mat(darker(r.look.second, 0.45)), page = p.mat(TONE.cream);
      p.rect(x, y - h + 1, w, h, cover);
      p.rect(x + w, y - h + 2, 1, h - 1, page); p.rect(x + 1, y + 1, w, 1, page); p.rect(x + 1, y + 2, w - 1, 1, p.mat(darker(TONE.cream, 0.2)));
      p.px(x, y - h + 1, m.metal); p.px(x, y, m.metal); p.px(x + w - 1, y, m.metal); p.px(x + w - 1, y - h + 1, m.metal);
      p.rect(x + 1, y - Math.floor(h / 2), w - 1, 1, m.leather); p.px(x + w - 1, y - Math.floor(h / 2), m.metal);
      p.px(x + 2, y - h, page); p.px(x + 3, y - h - 1, page); p.px(x + 4, y - h, page);
      p.px(x + w - 2, y + 3, p.mat(TONE.blood, { flat: true }));
      if (r.look.wear > 0.3) p.px(x + 1, y - h + 2, p.mat(lighter(darker(r.look.second, 0.45), 0.3)));
    },
  },
  lute: {
    kind: 'swing',
    held: (r) => {
      const { p } = r, body = p.mat('#9a6a3a'), b = at(r, -3), dk = p.mat('#3a2418');
      stroke(r, 0, 15, wood(r));
      p.ell(b[0], b[1], 3.3 * r.k + 0.4, 4.1 * r.k + 0.4, body);
      p.px(b[0] + 0.6, b[1], dk); p.px(b[0] + 0.6, b[1] + 1, dk);
      const head = at(r, 16.5, -1);
      p.line(at(r, 15), head, wood(r));
      p.px(...at(r, 15.5, 1), p.mat(TONE.cream)); p.px(...at(r, 17, 0.8), p.mat(TONE.cream));
      p.line(at(r, -3, 0.6), at(r, 15, 0.4), p.mat('#d8cfae'));
      marks(r, -6, 0, dk);
    },
  },
  mug: {
    kind: 'carry',
    held: (r) => {
      const { p, m } = r, [x, y] = hold(r, 1.4, -0.4), w = sz(r, 4), h = sz(r, 5);
      p.rect(x, y - h + 1, w, h, p.mat('#8a6a3a'));
      p.rect(x, y - Math.floor(h / 2), w, 1, m.metal);
      p.rect(x, y - h + 1, w, 1, p.mat('#e8e2d0'));
      p.px(x - 1, y - h + 3, p.mat('#6a4a2a')); p.px(x - 1, y - h + 4, p.mat('#6a4a2a'));
      if (r.look.wear > 0.3) p.px(x + w - 1, y - h + 3, p.mat('#4a3220'));
    },
  },
  bowl: {
    kind: 'carry',
    held: (r) => {
      const { p } = r, [x, y] = hold(r, 1.0, 0.4), w = sz(r, 6), wd = p.mat('#a88458');
      p.rect(x, y - 2, w, 1, p.mat('#6a4a2a'));
      p.rect(x, y - 1, w, 1, wd);
      p.rect(x + 1, y, w - 2, 1, wd);
      p.rect(x + Math.floor(w / 2) - 1, y + 1, 2, 1, wd);
      p.glow(x, y - 3, '#cfc8b6', 0.8);
      if (r.f % 2 === 0) p.glow(x + 2, y - 4, '#d8d4cc', 0.6);
    },
  },
  flask: {
    kind: 'carry',
    held: (r) => {
      const { p } = r, [x, y] = hold(r, 1.4, 0), liquid = p.mat('#86b0a4'), cork = p.mat('#9a7a4a'), rad = 2.2 * r.k + 0.3;
      p.ell(x + 1, y - 1.5 * r.k, rad, rad, liquid);
      p.rect(x + 1 - 0, y - sz(r, 5), 1, sz(r, 2), liquid);
      p.rect(x + 1, y - sz(r, 5) - 1, 1, 1, cork);
      p.px(x + 0.5 - 0.5, y - 2 * r.k - 0.5, p.mat('#e8f0ec', { flat: true }));
    },
  },
  lantern: {
    kind: 'carry',
    // hangs from the hand by its ring
    held: (r) => {
      const { p, m } = r, [hx, hy] = r.hand, w = sz(r, 4), h = sz(r, 5), x = hx - Math.floor(w / 2) + 1, y = hy + sz(r, 2);
      const lightM = p.mat('#f2d070', { flat: true }), core = p.mat('#fff4c0', { flat: true });
      p.line([hx, hy], [hx + 0.5, y - 1], m.metal);
      p.rect(x, y, w, h, m.metal);
      p.rect(x + 1, y + 1, w - 2, h - 2, lightM);
      p.px(x + Math.floor(w / 2), y + Math.floor(h / 2), core);
      p.rect(x - 1, y - 1, w + 2, 1, p.mat(TONE.darkSteel));
      p.rect(x - 1, y + h, w + 2, 1, p.mat(TONE.darkSteel));
    },
  },
};
