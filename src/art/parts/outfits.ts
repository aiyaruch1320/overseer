// Outfits (poc-visuals: ชุด 26 แบบ; the ids are src/art/parts/ids.ts). An outfit's `torso`, `farArm`, `nearArm` replace the bare ones, `lower` replaces
// the legs of a two-legged body, `back` is behind the figure and `front` over it. Colours: `main` is the garment, `second` the trim and the
// trousers, `accent` the one bright mark; the world is raw and worn, so every garment takes patches and a frayed hem from `look.wear`.
import type { Part, Rig } from '../rig';
import { TONE, band, belt, darker, feet, fray, holes, legs, lighter, mix, patches, skirt, sleeve, type SleeveOpts } from './kit';

const big = (r: Rig) => r.k >= 0.8;
const sz = (r: Rig, v: number) => Math.max(1, Math.round(v * r.k));
const patchOf = (r: Rig, base: string) => r.p.mat(mix(base, '#b8a98a', 0.35));

/** The torso block of a garment, shoulders rounded. */
function shell(r: Rig, mat: number, grow = 0): void {
  const { p } = r;
  p.rect(r.x0 - grow, r.sh, r.tw + grow * 2, Math.max(2, r.hip - r.sh), mat);
  p.px(r.x0 - grow, r.sh, 0); p.px(r.x0 + r.tw - 1 + grow, r.sh, 0);
}

type ArmFn = (r: Rig, far: boolean) => SleeveOpts;
const arms = (f: ArmFn): Pick<Part, 'farArm' | 'nearArm'> => ({
  farArm: (r) => sleeve(r, r.shoulderFar, r.farHand, f(r, true)),
  nearArm: (r) => sleeve(r, r.shoulderNear, r.hand, f(r, false)),
});

/** The point `t` of the way along an arm (for marks on a sleeve). */
const onArm = (r: Rig, far: boolean, t: number): [number, number] => {
  const a = far ? r.shoulderFar : r.shoulderNear, b = far ? r.farHand : r.hand;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
};

// ── tunic: the everyday shirt to the thigh ──────────────────────────────────────────────────────────────────────────────────────────
function tunicTorso(r: Rig): void {
  const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw, rows = big(r) ? 4 : 3, hemY = r.hip - 1;
  shell(r, m.main);
  p.rect(x0 - 1, hemY, r.tw + 2, rows, m.main);
  p.px(x0 - 1, hemY + rows - 1, 0);
  fray(r, hemY + rows - 1, x0, x1 + 1);
  p.rect(x0 + 1, r.sh + 1, r.tw - 2, 1, m.second);
  if (big(r)) for (let y = r.sh + 3; y < r.hip - 2; y += 2) p.px(x1 - 3, y, p.mat(darker(r.look.main, 0.35)));
  belt(r, r.hip - 2, m.leather, m.metal);
  patches(r, { x: x0 + 1, y: r.sh + 2, w: r.tw - 3, h: Math.max(2, r.hip - r.sh - 4) }, patchOf(r, r.look.main));
}
const tunicArms = arms((r) => ({ cloth: r.m.main, cuff: r.m.second, reach: 0.72 }));
const TUNIC: Part = { torso: tunicTorso, ...tunicArms };

export const OUTFITS: Record<string, Part> = {
  tunic: TUNIC,

  // ── robe: a long gown to the feet with a sash and a slit, wide sleeves ───────────────────────────────────────────────────────────────
  robe: {
    lower: (r) => {
      const { p, m } = r, to = r.foot - 1;
      feet(r, m.leather);
      skirt(r, { mat: m.main, to, flare: 3 });
      band(r, to - 2, { mat: m.second, to, flare: 3 });
      p.line([r.x0 + r.tw - 2, r.hip + 2], [r.x0 + r.tw, to - 1], p.mat(darker(r.look.main, 0.4)));
      fray(r, to - 1, r.x0 - 3 - r.flap, r.x0 + r.tw + 3);
    },
    torso: (r) => {
      const { p, m } = r;
      shell(r, m.main);
      belt(r, r.hip - 3, m.second, undefined, big(r) ? 2 : 1);
      if (big(r)) p.px(r.x0 + r.tw - 2, r.hip - 2, m.accent);
      p.px(r.x0 + 3, r.sh + 1, m.skin);
      patches(r, { x: r.x0 + 1, y: r.sh + 3, w: r.tw - 3, h: 3 }, patchOf(r, r.look.main));
    },
    ...arms((r) => ({ cloth: r.m.main, cuff: r.m.second, bell: big(r) })),
  },

  // ── cape: a tunic with a short cloak hanging from the shoulders, a clasp at the neck ──────────────────────────────────────────────────
  cape: {
    ...TUNIC,
    back: (r) => {
      const { p, m } = r, bot = Math.min(r.foot - 3, r.hip + sz(r, 8)), f = r.flap;
      p.poly([[r.x0 + 3, r.sh], [r.x0 - 4 - f, bot], [r.x0 + 4, bot + 1], [r.x0 + 6, r.sh + 1]], m.second);
      fray(r, bot - 1, r.x0 - 4 - f, r.x0 + 4);
    },
    front: (r) => { r.p.px(r.x0 + r.tw - 2, r.sh + 1, r.m.accent); if (big(r)) r.p.px(r.x0 + r.tw - 3, r.sh + 1, r.m.accent); },
  },

  // ── cloak: a long travelling cloak wrapped round the body, ragged at the hem ────────────────────────────────────────────────────────
  cloak: {
    back: (r) => {
      const { p, m } = r, bot = r.foot - 4, f = r.flap;
      p.poly([[r.x0 + 1, r.sh], [r.x0 + r.tw - 1, r.sh], [r.x0 + r.tw - 3, bot], [r.x0 - 4 - f, bot]], m.second);
    },
    lower: (r) => {
      const { p, m } = r, to = r.foot - 4;
      legs(r, { pants: m.pants, shoe: m.leather });
      skirt(r, { mat: m.second, to, flare: 2, top: r.hip });
      // the opening of the cloak shows the shirt
      p.line([r.x0 + r.tw - 3, r.hip], [r.x0 + r.tw - 1, to - 1], m.main);
      for (let x = r.x0 - 2 - r.flap; x < r.x0 + r.tw + 2; x += 2) p.px(x, to, 0);
      fray(r, to - 1, r.x0 - 2 - r.flap, r.x0 + r.tw + 2, 0, 0.3);
    },
    torso: (r) => {
      const { p, m } = r;
      shell(r, m.second, 1);
      // the opening: the shirt shows in a strip down the front
      p.rect(r.x0 + r.tw - 3, r.sh + 2, 2, r.hip - r.sh - 1, m.main);
      p.rect(r.x0 - 1, r.sh, r.tw + 2, 2, m.second);
      p.px(r.x0 + r.tw - 2, r.sh + 1, m.accent);
      patches(r, { x: r.x0, y: r.sh + 3, w: 3, h: 4 }, patchOf(r, r.look.second));
    },
    ...arms((r) => ({ cloth: r.m.second, cuff: r.m.main, reach: 0.85 })),
  },

  // ── armor: a mail shirt with a belted skirt of mail and leather bracers ─────────────────────────────────────────────────────────────
  armor: {
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw, dk = p.mat(darker(TONE.steel, 0.3)), rows = big(r) ? 4 : 3;
      shell(r, m.metal);
      for (let y = r.sh + 1; y < r.hip - 2; y++) for (let x = x0; x < x1; x++) if ((x + y * 2) % 4 === 0) p.px(x, y, dk);
      p.rect(x0 - 1, r.hip - 1, r.tw + 2, rows, m.metal);
      for (let x = x0 - 1; x < x1 + 1; x += 2) p.px(x, r.hip + rows - 2, dk);
      for (let x = x0 - 1; x < x1 + 1; x++) if ((x - x0) % 2 !== 0) p.px(x, r.hip + rows - 1, 0);
      belt(r, r.hip - 2, m.leather, m.accent);
      p.px(x0 + 1, r.sh + 1, m.main); p.px(x0 + 2, r.sh + 1, m.main);
      patches(r, { x: x0 + 1, y: r.sh + 2, w: r.tw - 2, h: 4 }, p.mat('#6c717a'));
    },
    ...arms((r) => ({ cloth: r.m.metal, bare: r.m.leather, cuff: r.m.leather, reach: 0.5 })),
  },

  // ── plate: full steel — big round pauldrons, a breastplate with a ridge, lames at the waist, steel legs ────────────────────────────────
  plate: {
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw, hi = p.mat(lighter(TONE.steel, 0.4)), dk = p.mat(TONE.darkSteel);
      shell(r, m.metal);
      p.rect(x0 + 1, r.sh + 1, r.tw - 2, Math.max(1, r.hip - r.sh - 4), hi);
      p.line([x0 + r.tw - 3, r.sh + 1], [x0 + r.tw - 3, r.hip - 4], dk);
      for (let y = r.hip - 3; y < r.hip + (big(r) ? 3 : 2); y += 2) p.rect(x0 - 1, y, r.tw + 2, 1, dk);
      p.rect(x0 - 1, r.hip - 2, r.tw + 2, 1, m.metal);
      // a cloth tassets strip at the front in the colour of the house
      p.rect(x1 - 4, r.hip, 3, sz(r, 4), m.main);
      patches(r, { x: x0 + 1, y: r.sh + 2, w: r.tw - 2, h: 3 }, p.mat('#6a6f78'));
    },
    lower: (r) => legs(r, { pants: r.m.metal, shoe: r.p.mat(TONE.darkSteel), knee: r.p.mat(lighter(TONE.steel, 0.35)) }),
    front: (r) => {
      const { p, m } = r, sx = r.shoulderNear[0] + 0.5, sy = r.shoulderNear[1], fx = r.shoulderFar[0] - 0.5;
      const hi = p.mat(lighter(TONE.steel, 0.35)), dk = p.mat(TONE.darkSteel), rr = Math.max(1.7, 2.7 * r.k);
      // the gorget round the neck, then a pauldron on each shoulder: a dark rim, a lit plate and a rivet
      p.rect(r.x0 + 1, r.sh + 1, r.tw - 2, 1, dk);
      for (const x of [sx, fx]) {
        p.ell(x, sy, rr + 0.8, rr + 0.5, dk);
        p.ell(x, sy - 0.2, rr - 0.2, rr - 0.4, x === sx ? hi : m.metal);
      }
      p.px(sx - 1, sy - 1, p.mat('#e8eaee'));
      p.px(sx + 1, sy + 1, dk);
    },
    ...arms((r) => ({ cloth: r.m.metal, bare: r.p.mat(TONE.darkSteel), reach: 0.62, cuff: r.p.mat(TONE.darkSteel) })),
  },

  // ── knight: mail under a surcoat of the house colour with a cross of the accent, short mantle ───────────────────────────────────────
  knight: {
    back: (r) => {
      const { p, m } = r;
      p.poly([[r.x0 + 2, r.sh], [r.x0 - 2 - r.flap, r.hip + sz(r, 6)], [r.x0 + 3, r.hip + sz(r, 6)], [r.x0 + 5, r.sh + 1]], p.mat(darker(r.look.second, 0.1)));
      void m;
    },
    lower: (r) => {
      const { p, m } = r;
      legs(r, { pants: m.pants, shoe: m.metal, calf: m.metal, calfFrom: 0.5, knee: p.mat(lighter(TONE.steel, 0.3)) });
    },
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw, cx = x1 - 3, cy = r.sh + 3, rows = sz(r, 4);
      shell(r, m.metal);
      // the surcoat: house colour down the chest and over the thigh
      p.rect(x0, r.sh + 1, r.tw, r.hip - r.sh, m.main);
      p.rect(x0 - 1, r.hip - 1, r.tw + 2, rows, m.main);
      fray(r, r.hip + rows - 2, x0 - 1, x1 + 1);
      p.rect(x0, r.hip + rows - 2, r.tw, 1, m.second);
      belt(r, r.hip - 2, m.leather, m.accent);
      // the cross
      if (r.hip - r.sh >= 8) { p.rect(cx - 1, cy, 3, 1, m.accent); p.rect(cx, cy - 1, 1, 4, m.accent); }
      else p.px(cx, cy, m.accent);
      patches(r, { x: x0, y: r.sh + 4, w: 3, h: 3 }, patchOf(r, r.look.main));
    },
    ...arms((r) => ({ cloth: r.m.metal, cuff: r.m.main, reach: 0.9 })),
  },

  // ── leather: a jerkin laced up the front, crossed straps, studs, bracers ──────────────────────────────────────────────────────────────
  leather: {
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw, lt = p.mat(lighter(TONE.leather, 0.12)), dk = p.mat(darker(TONE.leather, 0.45));
      shell(r, lt);
      for (let y = r.sh + 2; y < r.hip - 2; y += 2) p.px(x1 - 3, y, dk);
      p.line([x0, r.sh + 1], [x1 - 1, r.hip - 3], m.second);
      if (big(r)) p.line([x0 + 1, r.sh + 1], [x1, r.hip - 3], m.second);
      // pteruges: tabs of leather over the hip
      const tab = sz(r, 3);
      for (let x = x0 - 1; x < x1 + 1; x += 2) p.rect(x, r.hip - 1, 2, tab, (x - x0) % 4 === 0 ? lt : dk);
      belt(r, r.hip - 2, dk, m.metal);
      p.px(x0 + 1, r.sh + 3, m.metal); p.px(x0 + 1, r.sh + 5, m.metal);
      patches(r, { x: x0, y: r.sh + 2, w: 4, h: 4 }, p.mat(mix(TONE.leather, '#a89878', 0.4)));
    },
    ...arms((r) => ({ cloth: r.m.main, bare: r.m.leather, cuff: r.p.mat(darker(TONE.leather, 0.3)), reach: 0.5 })),
  },

  // ── light: loose cloth for the heat — open neck, a long sash, short breeches, bare arms and calves ──────────────────────────────────
  light: {
    lower: (r) => {
      const { m } = r;
      legs(r, { pants: m.second, calf: m.skin, calfFrom: 0.42, shoe: r.p.mat(darker(r.look.skin, 0.25)) });
    },
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw;
      shell(r, m.main);
      p.rect(x0 - 1, r.hip - 1, r.tw + 2, 2, m.main);
      for (let i = 0; i < 2; i++) p.px(x0 + 3 + i, r.sh + 1 + i, m.skin);
      belt(r, r.hip - 3, m.second, undefined, 1);
      // the sash's tail hangs at the hip
      p.line([x1 - 2, r.hip - 2], [x1 - 2 + 1, r.hip + sz(r, 4)], m.second);
      patches(r, { x: x0 + 1, y: r.sh + 2, w: 4, h: 3 }, patchOf(r, r.look.main));
      fray(r, r.hip, x0 - 1, x1 + 1);
    },
    ...arms((r) => ({ cloth: r.m.main, reach: 0.28 })),
  },

  // ── fur: hides — a heavy mantle with tufts, a ragged hem, fur at the wrists and the boots ───────────────────────────────────────────
  fur: {
    lower: (r) => {
      const { p } = r, fur = p.mat(lighter(r.look.main, 0.1));
      legs(r, { pants: r.m.pants, calf: fur, calfFrom: 0.45, shoe: fur });
    },
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw, lt = p.mat(lighter(r.look.main, 0.28)), dk = p.mat(darker(r.look.main, 0.3));
      shell(r, m.main, 1);
      p.rect(x0 - 2, r.sh, r.tw + 4, sz(r, 3), lt);
      p.px(x0 - 2, r.sh, 0); p.px(x1 + 1, r.sh, 0);
      // tufts and a zig-zag hem
      const hemY = r.hip + sz(r, 3);
      p.rect(x0 - 1, r.hip, r.tw + 2, hemY - r.hip, m.main);
      for (let x = x0 - 1; x < x1 + 1; x++) if ((x - x0) % 2 === 0) p.px(x, hemY, m.main);
      for (let x = x0 - 2; x < x1 + 2; x += 3) p.px(x + 1, r.sh + sz(r, 3), lt);
      for (let y = r.sh + 3; y < r.hip + 2; y += 2) for (let x = x0 - 1; x < x1 + 1; x++) if ((x + y) % 4 === 0) p.px(x, y, y % 4 === 1 ? dk : lt);
      belt(r, r.hip - 1, m.leather, m.bone);
      patches(r, { x: x0, y: r.sh + 4, w: 4, h: 3 }, dk);
    },
    ...arms((r) => ({ cloth: r.m.main, cuff: r.p.mat(lighter(r.look.main, 0.28)), reach: 0.62 })),
  },

  // ── rags: torn cloth, a bare shoulder, strips at the hem, a rope belt, patches and holes ──────────────────────────────────────────────
  rags: {
    lower: (r) => {
      const { p } = r, bare = r.m.skin;
      legs(r, { pants: p.mat(darker(r.look.second, 0.15)), calf: bare, calfFrom: 0.55, shoe: bare });
      fray(r, r.foot - 5, r.near.fx - 1, r.near.fx + 3, 0, 0.3);
    },
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw, rag = p.mat(mix(r.look.main, '#6b6050', 0.25)), under = m.skin;
      shell(r, rag);
      // a bare far shoulder
      p.rect(x0, r.sh, 2, 2, under);
      p.px(x0 + 2, r.sh, under);
      // strips at the hem, all of different length
      const s = [3, 1, 4, 2, 3, 1, 4, 2];
      for (let i = 0; i < r.tw + 1; i++) { const len = Math.max(1, Math.round(s[(i + 1) % s.length] * r.k)); p.rect(x0 - 1 + i, r.hip - 1, 1, len + 1, rag); }
      p.line([x0, r.hip - 2], [x1 - 1, r.hip - 2], p.mat('#8a7a58'));
      holes(r, { x: x0 + 1, y: r.sh + 2, w: r.tw - 2, h: 4 }, under, 0);
      p.px(x0 + 2, r.sh + 4, under); p.px(x1 - 2, r.sh + 6, under);
      patches(r, { x: x0 + 1, y: r.sh + 2, w: r.tw - 3, h: 5 }, patchOf(r, r.look.second), 3);
      p.rect(x0 + 3, r.sh + 2, 2, 2, p.mat(mix(r.look.second, '#b8a98a', 0.3)));
    },
    ...arms((r, far) => ({ cloth: r.p.mat(mix(r.look.main, '#6b6050', 0.25)), reach: far ? 0.12 : 0.45 })),
  },

  // ── apron: a tunic under a long apron with a bib, straps and a pocket; sleeves rolled ───────────────────────────────────────────────
  apron: {
    torso: (r) => {
      const { p } = r, x0 = r.x0, x1 = x0 + r.tw, ap = p.mat(TONE.cream), ln = p.mat(darker(TONE.cream, 0.25));
      tunicTorso(r);
      p.rect(x0 + 2, r.sh + 2, r.tw - 3, r.hip - r.sh - 1, ap);
      p.rect(x0 + 1, r.hip - 1, r.tw, sz(r, 6), ap);
      p.line([x0 + 2, r.sh + 2], [x0 + 1, r.sh + 1], ln);
      p.line([x1 - 2, r.sh + 2], [x1 - 1, r.sh + 1], ln);
      p.rect(x1 - 4, r.hip + 1, 2, 2, ln);
      fray(r, r.hip + sz(r, 5), x0 + 1, x1 + 1);
      patches(r, { x: x0 + 2, y: r.hip - 1, w: 4, h: 4 }, p.mat('#8a6a48'), 5);
    },
    ...arms((r) => ({ cloth: r.m.main, reach: 0.4 })),
  },

  // ── miner: heavy work clothes — wide shoulders, braces, a broad belt with a lamp clip, knee pads, soot ──────────────────────────────────
  miner: {
    lower: (r) => {
      const { p, m } = r;
      legs(r, { pants: m.pants, knee: m.leather, shoe: p.mat(darker(TONE.leather, 0.25)), calf: p.mat(darker(TONE.leather, 0.1)), calfFrom: 0.62 });
    },
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw, dk = p.mat(darker(r.look.main, 0.3)), soot = p.mat(TONE.soot);
      shell(r, m.main, 1);
      p.rect(x0 - 1, r.hip - 1, r.tw + 2, sz(r, 3), m.main);
      p.line([x0 + 1, r.sh], [x0 + 1, r.hip - 3], m.second); p.line([x1 - 2, r.sh], [x1 - 2, r.hip - 3], m.second);
      p.rect(x0 - 1, r.hip - 3, r.tw + 2, big(r) ? 2 : 1, m.leather);
      p.px(x1 - 3, r.hip - 3, m.metal);
      if (big(r)) p.rect(x0 + 2, r.sh + 3, 3, 2, dk);
      p.px(x0, r.sh + 2, soot); p.px(x0 + 2, r.sh + 5, soot); p.px(x1 - 1, r.sh + 4, soot);
      patches(r, { x: x0, y: r.sh + 2, w: 5, h: 4 }, patchOf(r, r.look.main), 2);
    },
    ...arms((r) => ({ cloth: r.m.main, cuff: r.m.leather, reach: 0.45 })),
  },

  // ── noble: a fitted long coat — high collar, buttons, trim down the front, lace at the cuffs, tall boots ─────────────────────────────
  noble: {
    lower: (r) => {
      const { p, m } = r, to = r.hip + sz(r, 6);
      legs(r, { pants: m.pants, calf: m.leather, calfFrom: 0.45, shoe: m.leather });
      skirt(r, { mat: m.main, to, flare: 2, top: r.hip - 1 });
      p.line([r.x0 + r.tw - 1, r.hip + 1], [r.x0 + r.tw + 1, to - 1], m.second);
      band(r, to - 1, { mat: m.second, to, flare: 2, top: r.hip - 1 });
    },
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw;
      shell(r, m.main);
      p.rect(x0 + 1, r.sh + 1, r.tw - 2, 1, m.second);
      p.line([x1 - 2, r.sh + 2], [x1 - 2, r.hip - 1], m.second);
      for (let y = r.sh + 3; y < r.hip - 2; y += 2) p.px(x1 - 3, y, m.accent);
      belt(r, r.hip - 2, m.second, m.accent);
      patches(r, { x: x0, y: r.sh + 3, w: 3, h: 4 }, patchOf(r, r.look.main));
    },
    ...arms((r) => ({ cloth: r.m.main, cuff: r.p.mat(TONE.cream), reach: 0.9 })),
  },

  // ── regal: a gown to the floor with a gold collar and hem, and a long ermine-edged mantle behind ─────────────────────────────────────
  regal: {
    back: (r) => {
      const { p, m } = r, bot = r.foot - 1, f = r.flap + 1, er = p.mat(TONE.ermine), sp = p.mat(TONE.ink);
      p.poly([[r.x0 + 2, r.sh], [r.x0 - 5 - f, bot], [r.x0 + 4, bot], [r.x0 + 6, r.sh + 1]], m.second);
      p.line([r.x0 + 2, r.sh + 1], [r.x0 - 5 - f, bot - 1], er, big(r) ? 2 : 1);
      p.rect(r.x0 - 5 - f, bot - 1, 10, 1, er);
      for (let i = 0; i < 3; i++) p.px(r.x0 - 4 - f + i * 3, bot - 1, sp);
    },
    lower: (r) => {
      const { p, m } = r, to = r.foot - 1;
      feet(r, m.leather);
      skirt(r, { mat: m.main, to, flare: 3 });
      band(r, to - 2, { mat: m.accent, to, flare: 3 });
      p.line([r.x0 + r.tw - 1, r.hip + 2], [r.x0 + r.tw + 1, to - 3], m.accent);
    },
    torso: (r) => {
      const { p, m } = r, x0 = r.x0;
      shell(r, m.main);
      p.rect(x0, r.sh + 1, r.tw, 2, m.accent);
      p.px(x0 + r.tw - 3, r.sh + 3, p.mat(TONE.blood, { flat: true }));
      belt(r, r.hip - 3, m.accent, undefined, 1);
      patches(r, { x: x0 + 1, y: r.sh + 4, w: 3, h: 3 }, patchOf(r, r.look.main));
    },
    ...arms((r) => ({ cloth: r.m.main, cuff: r.m.accent, bell: big(r) })),
  },

  // ── priest: a pale robe with a stole down the front, a cross of the accent, a rope belt, wide sleeves ──────────────────────────────────
  priest: {
    lower: (r) => {
      const { p, m } = r, to = r.foot - 1;
      feet(r, m.leather);
      skirt(r, { mat: m.main, to, flare: 3 });
      p.rect(r.x0 + r.tw - 3, r.hip, 2, to - r.hip - 1, m.second);
      p.px(r.x0 + r.tw - 3, to - 2, m.accent); p.px(r.x0 + r.tw - 2, to - 2, m.accent);
      fray(r, to - 1, r.x0 - 3 - r.flap, r.x0 + r.tw + 3);
    },
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw;
      shell(r, m.main);
      p.rect(x1 - 4, r.sh + 1, 2, r.hip - r.sh, m.second);
      p.rect(x0 + 1, r.sh + 1, 2, 1, m.second);
      const cy = r.sh + 3;
      p.px(x1 - 4, cy, m.accent); p.px(x1 - 3, cy, m.accent); p.px(x1 - 3, cy + 1, m.accent); p.px(x1 - 4, cy - 1, m.accent);
      p.rect(x0, r.hip - 3, r.tw, 1, p.mat('#a89868'));
      p.line([x0 + 2, r.hip - 2], [x0 + 1, r.hip + 1], p.mat('#a89868'));
      patches(r, { x: x0, y: r.sh + 3, w: 3, h: 4 }, patchOf(r, r.look.main));
    },
    ...arms((r) => ({ cloth: r.m.main, cuff: r.m.second, bell: big(r) })),
  },

  // ── scholar: a long dark coat with a tall collar, ink at the cuffs, elbow patches, a satchel on a strap ────────────────────────────────
  scholar: {
    lower: (r) => {
      const { p, m } = r, to = r.foot - 4;
      legs(r, { pants: m.pants, shoe: m.leather });
      skirt(r, { mat: m.main, to, flare: 1, top: r.hip - 1 });
      p.line([r.x0 + r.tw - 1, r.hip + 1], [r.x0 + r.tw, to - 1], p.mat(darker(r.look.main, 0.4)));
      band(r, to - 1, { mat: m.second, to, flare: 1, top: r.hip - 1 });
    },
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw;
      shell(r, m.main);
      p.rect(x0 + 1, r.sh + 1, r.tw - 2, 2, m.second);
      for (let y = r.sh + 3; y < r.hip - 2; y += 2) p.px(x1 - 3, y, m.metal);
      belt(r, r.hip - 2, m.leather);
      // the satchel's strap across the chest and the satchel at the far hip
      p.line([x1 - 2, r.sh + 3], [x0, r.hip + 1], m.leather);
      p.rect(x0 - 2, r.hip - 1, 4, 4, m.leather);
      p.rect(x0 - 2, r.hip - 1, 4, 1, p.mat(darker(TONE.leather, 0.3)));
      patches(r, { x: x0, y: r.sh + 3, w: 5, h: 3 }, patchOf(r, r.look.main), 4);
    },
    ...arms((r, far) => ({ cloth: r.m.main, cuff: far ? r.m.second : r.p.mat(TONE.ink), reach: 0.86 })),
    front: (r) => {
      const [x, y] = onArm(r, false, 0.45);
      r.p.px(x, y, r.m.second);
    },
  },

  // ── dress: a fitted bodice, a skirt that flares to the ankle and swings, a darker hem, short sleeves ──────────────────────────────────
  dress: {
    lower: (r) => {
      const { p, m } = r, to = r.foot - 2;
      feet(r, m.leather);
      skirt(r, { mat: m.main, to, flare: 4, top: r.hip - 2 });
      band(r, to - 1, { mat: m.second, to, flare: 4, top: r.hip - 2 });
      p.line([r.x0 + 1, r.hip + 1], [r.x0 - 2 - r.flap, to - 2], p.mat(darker(r.look.main, 0.28)));
      p.line([r.x0 + r.tw - 2, r.hip + 1], [r.x0 + r.tw + 1, to - 2], p.mat(darker(r.look.main, 0.28)));
    },
    torso: (r) => {
      const { p, m } = r, x0 = r.x0;
      shell(r, m.main);
      p.rect(x0 + 2, r.sh + 1, r.tw - 4, 1, m.skin);
      p.rect(x0, r.hip - 3, r.tw, 1, m.second);
      p.px(x0 + r.tw - 2, r.hip - 3, m.accent);
      patches(r, { x: x0 + 1, y: r.sh + 3, w: 3, h: 2 }, patchOf(r, r.look.main));
    },
    ...arms((r) => ({ cloth: r.m.main, reach: 0.3 })),
  },

  // ── sarong: a bare chest, a sash across it, a cloth wrapped from waist to knee, bare feet ───────────────────────────────────────────────
  sarong: {
    lower: (r) => {
      const { p, m } = r, to = r.hip + sz(r, 8);
      legs(r, { pants: m.skin, shoe: m.skin });
      skirt(r, { mat: m.main, to, flare: 1, top: r.hip - 2 });
      band(r, to - 1, { mat: m.second, to, flare: 1, top: r.hip - 2 });
      p.line([r.x0 + 1, r.hip], [r.x0 + r.tw - 1, to - 2], p.mat(darker(r.look.main, 0.3)));
      fray(r, to - 1, r.x0 - 1, r.x0 + r.tw + 2);
    },
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw;
      shell(r, m.skin);
      p.line([x0, r.sh + 1], [x1 - 1, r.hip - 3], m.second, big(r) ? 2 : 1);
      p.rect(x0, r.hip - 3, r.tw, 2, m.main);
      p.px(x0 + 2, r.hip - 2, m.accent);
    },
    ...arms((r) => ({ cloth: r.m.skin })),
  },

  // ── sailor: a striped shirt, a neckerchief, trousers rolled to the shin, bare feet ────────────────────────────────────────────────────
  sailor: {
    lower: (r) => {
      const { m } = r;
      legs(r, { pants: m.second, calf: m.skin, calfFrom: 0.6, shoe: m.skin });
    },
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw;
      shell(r, m.main);
      for (let y = r.sh + 2; y < r.hip - 1; y += 2) p.rect(x0, y, r.tw, 1, m.second);
      p.rect(x0 - 1, r.hip - 1, r.tw + 2, 2, m.second);
      p.rect(x0 + 2, r.sh + 1, r.tw - 3, 1, m.accent);
      p.px(x1 - 3, r.sh + 2, m.accent);
      belt(r, r.hip - 2, m.leather, m.metal);
      patches(r, { x: x0 + 1, y: r.sh + 2, w: 4, h: 4 }, patchOf(r, r.look.main), 6);
    },
    ...arms((r) => ({ cloth: r.m.main, cuff: r.m.second, reach: 0.5 })),
  },

  // ── otherworld: a dark jacket with lapels, a white shirt and a red tie, grey trousers, white shoes ─────────────────────────────────────
  otherworld: {
    lower: (r) => {
      legs(r, { pants: r.p.mat('#4a4a52'), shoe: r.p.mat('#e4e0d6') });
    },
    torso: (r) => {
      const { p, m } = r, x0 = r.x0, x1 = x0 + r.tw, shirt = p.mat('#e4e0d6'), tie = p.mat(TONE.blood, { flat: true });
      shell(r, m.main);
      p.rect(x1 - 4, r.sh + 1, 2, r.hip - r.sh - 2, shirt);
      p.line([x1 - 4, r.sh + 3], [x1 - 4, r.hip - 3], tie);
      p.line([x1 - 5, r.sh + 1], [x1 - 4, r.sh + 3], p.mat(lighter(r.look.main, 0.25)));
      p.rect(x0 - 1, r.hip - 1, r.tw + 2, 2, m.main);
      for (let y = r.hip - 4; y <= r.hip - 3; y++) p.px(x1 - 2, y, m.accent);
      patches(r, { x: x0, y: r.sh + 2, w: 3, h: 4 }, patchOf(r, r.look.main), 3);
    },
    ...arms((r) => ({ cloth: r.m.main, cuff: r.p.mat('#e4e0d6') })),
  },
};
