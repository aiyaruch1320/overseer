// Painter features added after the first set (ghosts, tentacles, a cyclops eye, a kappa's dish, glasses and a monocle), kept apart from feats.ts
// so two hands can work at once. Same rules as feats.ts: marks on the face go in `front` (a hat or hair never covers them), things behind the
// body in `back`; glasses and a monocle are feats, not hats, so a hat stays free.
import type { Pt } from '../paint';
import type { Part, Rig } from '../rig';
import { hexOf, mixHex } from './body';

const flat = (r: Rig, hex: string, alpha = 1): number => r.p.mat(hex, { flat: true, alpha });
/** The eye of the face, where body.ts draws it. */
const eyeOf = (r: Rig): Pt => [Math.round(r.head[0] + r.hr[0] * 0.55), Math.round(r.head[1] - 0.4)];
const topOf = (r: Rig): number => Math.round(r.head[1] - r.hr[1]);

// ── ghost ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Pale and cool: the colour of a thing seen through mist. Quantised so the frame keeps fewer than 255 materials. */
const wan = (hex: string): string => {
  const m = mixHex(hex, '#d6e4f2', 0.5), q = (v: string) => Math.round(parseInt(v, 16) / 24) * 24;
  return hexOf([q(m.slice(1, 3)), q(m.slice(3, 5)), q(m.slice(5, 7))]);
};
const GHOST_UP = 0.66, GHOST_LOW = 0.4;

const ghost: Part = {
  // no legs and no feet: everything below the hip is wiped, and the body ends in a tapering tail of its own cloth
  lower: (r) => {
    const { p } = r, top = r.hip + 1, end = r.foot - 3 - r.hover;
    for (let y = top; y < p.h; y++) for (let x = 0; x < p.w; x++) p.m[y * p.w + x] = 0;
    const cx = r.x0 + r.tw / 2, half = r.tw / 2 + 1.5;
    p.poly([[cx - half, r.hip], [cx + half, r.hip], [cx + 1.2, end], [cx - 1.2 - r.flap, end + 1]], r.m.main);
    p.poly([[cx - half + 1, r.hip + 1], [cx - half * 0.2, r.hip + 1], [cx - 0.5, end - 1]], r.m.second);
    // the tail frays into wisps
    for (let i = 0; i < 3; i++) p.px(cx + (i - 1) * 1.4 + (r.f % 2) * (i - 1), end + 1 + (i % 2), r.m.second);
  },
  // everything painted turns see-through and pale; the eyes and glows stay as they were
  front: (r) => {
    const { p } = r, cache = new Map<string, number>();
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        const k = p.m[y * p.w + x];
        if (!k) continue;
        const mt = p.mats[k];
        if (mt.flat || p.mats.length > 240) continue;
        const a = y > r.hip + 1 ? GHOST_LOW : GHOST_UP, key = `${k}|${a}`;
        let nk = cache.get(key);
        if (nk == null) { nk = p.mat(wan(hexOf(mt.t[2])), { alpha: a }); cache.set(key, nk); }
        p.m[y * p.w + x] = nk;
      }
    // cold motes drifting off the tail
    const cx = r.x0 + r.tw / 2, end = r.foot - 3 - r.hover;
    r.fx.push({ x: cx - 2 + (r.f % 2), y: end - 3, hex: '#cfe6ff', a: 0.6 }, { x: cx + 2 - (r.f % 2) * 2, y: end - 6, hex: '#e6f2ff', a: 0.5 });
  },
};

// ── tentacles ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const tentacles: Part = {
  // four tendrils curling out from behind the shoulders, thick at the root, each with a row of pale suckers; they sway with the frame
  back: (r) => {
    const { p } = r, hex = mixHex(r.look.skin, '#4a2a5a', 0.55), body = p.mat(hex), sucker = p.mat(mixHex(hex, '#f2ead6', 0.55), { flat: true });
    const k = Math.max(0.7, r.k), swing = r.pose === 'walk' ? r.f : r.f % 2;
    for (let i = 0; i < 4; i++) {
      const base: Pt = [r.x0 + 1, r.sh + 2 + (i * Math.max(1, r.hip - r.sh - 3)) / 3];
      const reach = (8 + i * 2.5) * k, ph = i * 1.3 + swing * 0.8, pts: Pt[] = [];
      for (let s = 0; s <= 8; s++) {
        const t = s / 8;
        pts.push([base[0] - t * reach, base[1] + (i - 1.5) * t * 6.5 * k + Math.sin(t * 2.6 + ph) * 1.6 * k + t * t * 4 * k]);
      }
      for (let s = 0; s < pts.length - 1; s++) p.line(pts[s], pts[s + 1], body, s < 5 && r.k >= 0.8 ? 2 : 1);
      for (let s = 2; s < pts.length - 1; s += 2) p.px(pts[s][0], pts[s][1] + 1, sucker);
    }
  },
};

// ── cyclops ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const cyclops: Part = {
  // the two eyes are smoothed over and one big eye opens in the middle of the face
  front: (r) => {
    const { p, m } = r, [ex, ey] = eyeOf(r), [hx, hy] = r.head, big = r.hh >= 7;
    for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]] as Pt[]) p.px(ex + dx, ey + dy, m.skin);
    const cx = Math.round(hx + r.hr[0] * 0.15), cy = Math.round(hy - (big ? 0.8 : 0.4));
    const white = flat(r, '#efeee6'), brow = p.mat(mixHex(r.look.skin, '#3a2018', 0.55));
    const shut = r.pose === 'pray' || (r.pose === 'die' && r.f > 0);
    const w = big ? 4 : 3;
    p.rect(cx - Math.floor(w / 2), cy - (big ? 1 : 0), w, big ? 3 : 2, white);
    if (shut) { p.rect(cx - Math.floor(w / 2), cy, w, 1, brow); return; }
    p.rect(cx - 1 + 1, cy - (big ? 0 : 0), 1, big ? 2 : 1, m.eye);
    p.px(cx, cy, flat(r, '#14101a'));
    p.rect(cx - Math.floor(w / 2) - 0, cy - (big ? 2 : 1), w, 1, brow);
  },
};

// ── dish (kappa) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const dish: Part = {
  // a hollow in the crown, a pale rim round it and water inside that glints
  front: (r) => {
    const { p } = r, [hx] = r.head, top = topOf(r), rx = Math.max(2, Math.round(r.hr[0] * 0.8));
    const rim = p.mat(mixHex(r.look.skin, '#d8d0b0', 0.45)), water = flat(r, '#8ad0e0'), glint = flat(r, '#e8fbff');
    p.rect(Math.round(hx) - rx, top - 1, rx * 2, 2, rim);
    p.rect(Math.round(hx) - rx + 1, top - 1, rx * 2 - 2, 1, water);
    p.px(Math.round(hx) - rx + 1 + (r.f % 2) * Math.max(0, rx * 2 - 4), top - 1, glint);
  },
};

// ── glasses and monocle ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const frameOf = (r: Rig): number => r.p.mat(r.look.fem ? '#d0a850' : '#a4a8b4', { flat: true });

const glasses: Part = {
  // two lenses over the eye (one is seen from the side), a frame round it and an arm back to the ear
  front: (r) => {
    const { p } = r, [ex, ey] = eyeOf(r), f = frameOf(r), glint = flat(r, '#d8f0fa');
    for (let x = ex - 2; x <= ex + 1; x++) { p.px(x, ey - 1, f); p.px(x, ey + 1, f); }
    p.px(ex - 2, ey, f); p.px(ex + 1, ey, f);
    p.px(ex + 1, ey - 1, glint);
    p.line([ex - 2, ey], [Math.round(r.head[0] - r.hr[0]) + 1, ey - 1], f);
    p.px(ex + 2, ey, f);
  },
};

const monocle: Part = {
  // one ring of gold round the eye and a chain that hangs from it
  front: (r) => {
    const { p } = r, [ex, ey] = eyeOf(r), g = flat(r, '#d4b050'), chain = flat(r, '#b49440');
    for (const [dx, dy] of [[-2, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]] as Pt[]) p.px(ex + dx, ey + dy, g);
    p.px(ex, ey - 1, flat(r, '#f4fbff'));
    p.px(ex + 1, ey + 2, chain); p.px(ex + 1, ey + 3, chain); p.px(ex + 2, ey + 4 + (r.f % 2), chain);
  },
};

export const FEATS_EXTRA: Record<string, Part> = { ghost, tentacles, cyclops, dish, glasses, monocle };
