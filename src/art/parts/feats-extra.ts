// Painter features added after the first set (ghosts, tentacles, a cyclops eye, a kappa's dish, glasses and a monocle), kept apart from feats.ts
// so two hands can work at once. Same rules as feats.ts: marks on the face go in `front` (a hat or hair never covers them), things behind the
// body in `back`; glasses and a monocle are feats, not hats, so a hat stays free.
import type { Pt } from '../paint';
import type { Part, Rig } from '../rig';
import { armW, drawArm, farMat, hexOf, mixHex, shadowOf, stroke, tone } from './body';
import { cap } from './kit';

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



// ── the beast people: which animal (the feats of the look say) ─────────────────────────────────────────────────────────────────────────
const has = (r: Rig, id: string): boolean => r.look.feats.includes(id);
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const nearAt = (r: Rig, t: number): Pt => lerp(r.shoulderNear, r.hand, t);
const farAt = (r: Rig, t: number): Pt => lerp(r.shoulderFar, r.farHand, t);
/** The first column past the head, at the face. */
const faceX = (r: Rig): number => Math.round(r.head[0] + r.hr[0]);
const DARK = '#241810';

const muzzle: Part = {
  // the snout of the animal: long for a wolf and a fox, long and narrow for a deer, short and broad for the big cats, very short for a rabbit with its
  // tooth; pale, with a dark nose at the tip
  front: (r) => {
    const { p } = r, [, ey] = eyeOf(r), fx = faceX(r), big = r.hh >= 6, small = r.hh < 5;
    const rabbit = has(r, 'longears'), cat = has(r, 'stripes') || has(r, 'spots') || has(r, 'mane'), deer = has(r, 'antlers');
    const len = small ? 1 : rabbit || cat ? 1 : deer ? 3 : 2;
    const rows = big ? 3 : 2;
    const pale = p.mat(mixHex(r.look.skin, '#efe0cc', 0.5)), jaw = p.mat(mixHex(r.look.skin, '#d8c8b0', 0.3));
    p.rect(fx - 1, ey + 1, len + 1, rows - 1, pale);
    p.rect(fx - 1, ey + rows, len + (deer ? 0 : 1), 1, jaw);
    p.px(fx + len - 1, ey + 1, flat(r, cat ? '#b0606a' : '#1a1414'));
    if (big && !rabbit) p.px(fx, ey + rows, flat(r, '#3a2420')); // the line of the mouth
    if (rabbit && big) p.px(fx, ey + rows + 1, flat(r, '#f4f0e8')); // the tooth
    if (cat && !small) r.fx.push({ x: fx + len + 1, y: ey + 2, hex: '#e8e0d0', a: 0.7 }, { x: fx + len + 1, y: ey + 3, hex: '#e8e0d0', a: 0.5 }); // whiskers
  },
};

const longears: Part = {
  // a rabbit's ears: two long upright ones, the inside pale; one flops and flicks in the idle
  front: (r) => {
    const { p } = r, [hx, hy] = r.head, top = Math.round(hy - r.hr[1]), t = (r.pose === 'idle' && r.f === 1) || (r.pose === 'walk' && r.f === 2) ? 1 : 0;
    const fur = r.m.hair, inner = p.mat(mixHex(r.look.skin, '#e8c0b0', 0.5), { flat: true });
    const L = Math.max(5, Math.round(r.hh * 1.25)), w = r.hh >= 6 ? 1.2 : 0.9;
    const ear = (cx: number, lean: number) => {
      p.poly([[cx - w, top + 1.5], [cx + lean - w * 0.7, top - L], [cx + lean + w * 0.7, top - L], [cx + w, top + 1.5]], fur);
      for (let y = top - L + 2; y < top; y++) p.px(cx + lean * ((top - y) / L) * 0.5, y, inner);
    };
    ear(hx - r.hr[0] * 0.45, -1 - t * 1.5);
    ear(hx + r.hr[0] * 0.05, -0.3 + t * 0.5);
  },
};

const stripes: Part = {
  // tiger stripes, black on the orange coat: across the brow, down the cheek, in bands on the arms
  front: (r) => {
    const { p } = r, [hx] = r.head, [ex, ey] = eyeOf(r), top = topOf(r), k = flat(r, DARK);
    p.px(Math.round(hx - 1), top + 1, k); p.px(Math.round(hx + 1), top + 1, k); p.px(Math.round(hx - 1), top + 2, k);
    p.px(ex - 2, ey + 2, k); p.px(ex - 3, ey + 3, k);
    for (const t of [0.5, 0.65, 0.8]) { const [x, y] = nearAt(r, t); p.px(x, y, k); if (armW(r) > 1) p.px(x + 1, y, k); }
    const [fx, fy] = farAt(r, 0.7); p.px(fx, fy, k);
  },
};

const spots: Part = {
  // spots: dark on a leopard, cream on a deer
  front: (r) => {
    const { p } = r, [hx] = r.head, [ex, ey] = eyeOf(r), top = topOf(r), deer = has(r, 'antlers'), k = flat(r, deer ? '#f0e4cc' : DARK);
    p.px(Math.round(hx - 1), top + 2, k); p.px(Math.round(hx + 2), top + 1, k); p.px(ex - 2, ey + 2, k);
    for (const [t, dy] of [[0.5, 0], [0.7, 1]] as [number, number][]) { const [x, y] = nearAt(r, t); p.px(x, y + dy, k); }
    p.px(r.x0 + r.tw - 3, r.sh + 2, k); p.px(r.x0 + 2, r.sh + 4, k);
  },
};

const mane: Part = {
  // a lion's mane: a wreath of darker hair round the head and over the shoulders, the face open in front
  back: (r) => {
    const { p } = r, [hx, hy] = r.head, mn = p.mat(mixHex(r.look.hairColor, '#5a2808', 0.55));
    p.ell(hx - 1, hy + 0.8, r.hr[0] + 2.4, r.hr[1] + 2.1, mn);
    p.ell(hx - 1.5, hy + r.hr[1], r.hr[0] + 1.5, 2.4, mn);
    p.px(hx - r.hr[0] - 3, hy + 1 + (r.f % 2), mn);
  },
  hair: (r) => {
    const mn = r.p.mat(mixHex(r.look.hairColor, '#5a2808', 0.55));
    cap(r, mn, 0.3, (nx, ny) => nx < -0.1 || ny < -0.55);
    const [hx, hy] = r.head;
    r.p.px(hx + r.hr[0] * 0.3, hy - r.hr[1] - 0.5, mn);
  },
};

const antlers: Part = {
  // a deer's antlers: a beam that sweeps up and back with two tines forward and a fork at the top, and a short stub beyond it on the far side
  hair: (r) => {
    const { p } = r, [hx] = r.head, top = topOf(r), u = r.hh >= 7 ? 1.1 : r.hh >= 6 ? 0.9 : 0.7;
    const near = p.mat('#c4ac80'), far = p.mat(mixHex('#c4ac80', '#2a2018', 0.4)), tip = flat(r, '#eadcb8');
    const bx = hx - 1;
    p.line([hx + r.hr[0] * 0.4, top + 1], [hx + r.hr[0] * 0.4 + 0.5, top - 3 * u], far);
    p.line([bx, top + 1], [bx - 1.5, top - 3 * u], near);
    p.line([bx - 1.5, top - 3 * u], [bx - 2.5, top - 7 * u], near);
    p.line([bx - 1.5, top - 3 * u], [bx + 1.5, top - 5.5 * u], near);
    p.line([bx - 2.2, top - 5.6 * u], [bx - 5, top - 7.4 * u], near);
    p.px(bx + 1.5, top - 5.5 * u - 1, tip); p.px(bx - 2.5, top - 7 * u - 1, tip);
  },
};

// ── bird ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const plumeOf = (r: Rig): string => r.look.hairColor;
const beak: Part = {
  // a hooked beak in place of the nose and mouth: a gold upper bill with a hook, a darker lower one, a dark nostril
  front: (r) => {
    const { p } = r, [, ey] = eyeOf(r), fx = faceX(r), n = r.hh >= 6 ? 3 : 2, up = p.mat('#d9ab38'), lo = p.mat('#a67e26');
    p.rect(fx - 1, ey + 1, n + 1, 2, up);
    p.px(fx + n - 1, ey + 3, up); // the hook
    p.rect(fx - 1, ey + 3, n - 1, 1, lo);
    p.px(fx, ey + 1, flat(r, '#4a3410'));
  },
};
const feathers: Part = {
  // a bird person: the head is under feathers (a crest standing up, barred), a ruff at the neck, the forearms feathered with long ones that trail
  hair: (r) => {
    const { p } = r, [hx] = r.head, top = topOf(r), plume = r.m.hair, dk = p.mat(mixHex(plumeOf(r), '#1a1420', 0.45), { flat: true }), lt = p.mat(mixHex(plumeOf(r), '#ffffff', 0.35), { flat: true });
    cap(r, plume, 0.4, (nx, ny) => nx < 0.2 || ny < -0.3);
    for (let i = 0; i < 3; i++) {
      const b: Pt = [hx - 0.5 - i * 1.4, top + 0.5], t: Pt = [b[0] - 1 - i * 0.6, top - 3 + i * 0.7 - (r.pose === 'idle' && r.f ? 1 : 0)];
      p.line(b, t, i === 1 ? dk : plume); p.px(t[0], t[1], lt);
    }
    p.px(hx - 1, top + 2, dk); p.px(hx - 3, top + 3, dk); p.px(hx, top + 1, lt); p.px(hx - 2, top + 1, lt);
  },
  head: (r) => {
    const { p } = r, [hx, hy] = r.head, y = Math.round(hy + r.hr[1]) - 1, plume = r.m.hair, dk = p.mat(mixHex(plumeOf(r), '#1a1420', 0.45), { flat: true });
    p.rect(Math.round(hx) - 3, y, 5, 2, plume);
    for (let x = Math.round(hx) - 3; x < Math.round(hx) + 2; x += 2) p.px(x, y + 2, dk);
  },
  back: (r) => {
    // a few long tail feathers instead of a tail of fur
    const { p, k } = r, root: Pt = [r.x0 - 1, r.hip - 1], plume = r.m.hair, dk = p.mat(mixHex(plumeOf(r), '#1a1420', 0.45));
    p.line(root, [root[0] - 3 * k, root[1] + 5 * k], dk); p.line([root[0], root[1] + 1], [root[0] - 1.5 * k, root[1] + 6 * k], plume); p.line([root[0] + 1, root[1] + 1], [root[0] + 0.5, root[1] + 5.5 * k], dk);
  },
  nearArm: (r) => {
    const { p } = r, w = armW(r), plume = r.m.hair, dk = p.mat(mixHex(plumeOf(r), '#1a1420', 0.45), { flat: true });
    stroke(p, nearAt(r, 0.45), nearAt(r, 0.88), w, plume);
    for (const t of [0.5, 0.7, 0.9]) { const [x, y] = nearAt(r, t); p.px(x - 1, y + 1, dk); p.px(x - 1, y + 2, plume); }
  },
  farArm: (r) => {
    const { p } = r, w = armW(r);
    stroke(p, farAt(r, 0.45), farAt(r, 0.88), w, farMat(p, plumeOf(r)));
  },
};

// ── lizard ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const crest: Part = {
  // a lizard's head: a row of scaled spines along the crown and the nape, scales on the brow and the cheek, a long jaw
  hair: (r) => {
    const { p } = r, [hx] = r.head, top = topOf(r), sp = p.mat(r.look.accent), lt = flat(r, tone(r.look.accent, 3));
    const u = r.hh >= 7 ? 1 : 0.75, hs = [2, 3, 3, 2];
    hs.forEach((h, i) => {
      const x = Math.round(hx + 2 - i * 2), len = Math.max(1, Math.round(h * u)) + (r.pose === 'idle' && r.f && i === 1 ? 1 : 0);
      p.rect(x, top - len + 1, 1, len + 1, sp); p.px(x, top - len + 1, lt);
    });
  },
  front: (r) => {
    const { p } = r, [ex, ey] = eyeOf(r), [hx] = r.head, top = topOf(r), fx = faceX(r);
    const dk = flat(r, shadowOf(r.look.skin)), l = flat(r, tone(r.look.skin, 3));
    p.px(Math.round(hx + 1), top + 2, dk); p.px(Math.round(hx - 1), top + 3, l); p.px(Math.round(hx - 3), top + 2, dk);
    p.px(ex - 2, ey + 2, dk); p.px(ex - 3, ey + 1, l); p.px(ex - 4, ey + 3, dk);
    p.rect(fx, ey + 1, 2, 2, r.m.skin); p.px(fx + 1, ey + 1, flat(r, '#1a1414')); // the long jaw
  },
};

// ── puppet ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const puppetInk = (r: Rig): number => flat(r, '#1a1410');
const joint = (r: Rig, at: Pt, w = 3): void => {
  const x = Math.round(at[0]), y = Math.round(at[1]);
  r.p.rect(x - (w >> 1), y, w, 1, puppetInk(r)); r.p.px(x, y - 1, flat(r, '#d9cfb2'));
};
const puppet: Part = {
  // a doll: the seam down the cheek, the hinge of the jaw at the mouth, and visible joints at the elbow, the wrist and the knee
  front: (r) => {
    const { p } = r, [hx, hy] = r.head, [ex, ey] = eyeOf(r), k = puppetInk(r), top = topOf(r);
    p.line([ex - 3, top + 2], [ex - 3, Math.round(hy + r.hr[1]) - 1], k);
    p.px(ex - 1, ey + 3, k); if (r.hh >= 7) p.px(ex - 1, ey + 4, k);
    p.px(Math.round(hx), top + 2, flat(r, '#d9cfb2'));
  },
  nearArm: (r) => { joint(r, nearAt(r, 0.5), armW(r) + 1); joint(r, nearAt(r, 0.88), armW(r)); },
  farArm: (r) => { joint(r, farAt(r, 0.5), armW(r)); },
  lower: (r) => {
    if (r.sit || r.kneel || r.infant) return;
    for (const L of [r.far, r.near]) {
      const w = Math.max(1, Math.round(r.tw / 3.2)), x = L.x + (L.fx - L.x) * 0.5 + (w >> 1), y = r.hip + Math.round(r.legs * 0.5);
      r.p.rect(Math.round(x) - (w >> 1), y, w, 1, puppetInk(r));
      r.p.px(Math.round(x), y - 1, flat(r, '#d9cfb2'));
    }
  },
};

// ── four arms ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const fourarms: Part = {
  // a second pair of arms below the first: the lower hands rest out in front of the belly, past the edge of the body so they show; they sway with the frame
  farArm: (r) => {
    const a: Pt = [r.shoulderFar[0] + 1, r.shoulderFar[1] + 3 * r.k];
    drawArm(r, a, [r.x0 + r.tw + 0.5 + (r.pose === 'attack' ? r.f : 0), Math.min(r.hip - 1, r.sh + (r.hip - r.sh) * 0.85)], true, farMat(r.p, r.look.second), farMat(r.p, r.look.skin));
  },
  nearArm: (r) => {
    const a: Pt = [r.shoulderNear[0] - 1, r.shoulderNear[1] + 3 * r.k];
    drawArm(r, a, [Math.max(r.hand[0] - 1, r.x0 + r.tw + 2.5) + (r.pose === 'attack' ? r.f : 0), Math.min(r.hip, r.sh + (r.hip - r.sh) * 0.7 + (r.f % 2 && r.pose === 'idle' ? 1 : 0))], false, r.m.second, r.m.skin);
  },
};

export const FEATS_EXTRA: Record<string, Part> = {
  ghost, tentacles, cyclops, dish, glasses, monocle, muzzle, longears, stripes, spots, mane, antlers, beak, feathers, crest, puppet, fourarms,
};
