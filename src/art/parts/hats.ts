// Hats (poc-visuals: หมวก 21 แบบ; the ids are src/art/parts/ids.ts). Drawn in the `hat` layer, over the hair; a part of a hat that hangs behind
// (a hood's drape, a mitre's lappets, a knot's tail) is in `back`. The person painter draws the eye and the nose again over a hat, so a hat may
// cover the forehead freely; hoods, cowls, turbans and veils keep the whole face open. Cloth hats take the colours of the clothes (`second`),
// metal ones the metal, crowns and circlets the accent or gold.
import type { Part, Rig } from '../rig';
import { TONE, cap, darker, headOf, keepFace, lighter, mix, patches, type Head } from './kit';

const sz = (r: Rig, v: number) => Math.max(1, Math.round(v * r.k));
/** The last row a hat may cover on the forehead. */
const brow = (h: Head) => h.hy - Math.max(1, Math.round(h.ry * 0.4));
/** A hat that sits on the crown: from the crown to the brow, and down the back of the head. */
const dome = (r: Rig, mat: number, grow: number, back = 0.1): void => cap(r, mat, grow, (nx, ny) => ny < -0.3 || (nx < -0.25 && ny < back));
const wearDark = (r: Rig, base: string) => r.p.mat(mix(base, '#b8a98a', 0.3));

/** The metal of a crown: the look's accent when it has little colour (silver, iron, bone, jet), else gold. */
function crownMetal(accent: string): string {
  const v = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(accent);
  if (!v) return TONE.gold;
  const [r, g, b] = v.slice(1).map((x) => parseInt(x, 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx - mn < 0.18 ? accent : TONE.gold;
}

export const HATS: Record<string, Part> = {
  // ── hood: a cloth hood over the head with a peak at the back, the face open, a drape at the neck ─────────────────────────────────────
  hood: {
    back: (r) => { const h = headOf(r); r.p.rect(h.l - 2, h.hy, 3, Math.round(h.ry * 1.5), r.m.second); },
    hat: (r) => {
      const h = headOf(r), { p } = r;
      keepFace(r, () => {
        p.ell(r.head[0] - 0.5, r.head[1] - 0.5, h.rx + 1.1, h.ry + 1.1, r.m.second);
        p.poly([[h.hx - 2, h.top - 1], [h.l - 2, h.top + 2], [h.l - 2 - sz(r, 1), h.top]], r.m.second);
      });
      patches(r, { x: h.l, y: h.top + 1, w: 4, h: 3 }, wearDark(r, r.look.second));
    },
  },

  // ── cowl: a close hood with a short cape over the shoulders and a rounded top ──────────────────────────────────────────────────────
  cowl: {
    hat: (r) => {
      const h = headOf(r), { p } = r;
      keepFace(r, () => p.ell(r.head[0] - 0.5, r.head[1] - 0.3, h.rx + 0.8, h.ry + 0.9, r.m.main));
      // the cape over the shoulders (the arms are drawn over it)
      p.rect(r.x0 - 1, r.sh + 1, r.tw + 2, sz(r, 3), r.m.main);
      p.px(r.x0 - 1, r.sh + 1, 0);
      p.rect(r.x0 - 1, r.sh + sz(r, 3), r.tw + 2, 1, r.m.second);
      patches(r, { x: h.l, y: h.top + 1, w: 4, h: 3 }, wearDark(r, r.look.main));
    },
  },

  // ── helmet: a steel dome with a nasal bar, cheek and neck guards and a ridge ────────────────────────────────────────────────────────
  helmet: {
    hat: (r) => {
      const h = headOf(r), { p, m } = r, hi = p.mat(lighter(TONE.steel, 0.35));
      cap(r, m.metal, 0.8, (nx, ny) => ny < -0.1 || (nx < 0 && ny < 0.75));
      p.rect(h.l - 1, brow(h), Math.round(h.rx * 2) + 1, 1, p.mat(TONE.darkSteel));
      p.line([h.hx, h.top - 1], [h.hx - 2, h.top + 2], hi);
      const nasal = h.hx + Math.round(h.rx * 0.75);
      p.line([nasal, brow(h)], [nasal, h.hy + 1], m.metal);
      p.px(h.hx - 2, brow(h), hi);
      patches(r, { x: h.l + 1, y: h.top + 1, w: 4, h: 3 }, p.mat('#6a6f78'));
    },
  },

  // ── horned: a dark iron cap with a pair of long horns that curve up and forward ─────────────────────────────────────────────────────
  horned: {
    hat: (r) => {
      const h = headOf(r), { p, m } = r, bone = p.mat('#bdb292'), iron = p.mat(TONE.darkSteel);
      cap(r, iron, 0.6, (nx, ny) => ny < -0.15 || (nx < -0.15 && ny < 0.45));
      p.rect(h.l - 1, brow(h), Math.round(h.rx * 2), 1, m.leather);
      const up = sz(r, 5), a: [number, number] = [h.hx - 2, h.top + 1], b: [number, number] = [h.hx - 3 - sz(r, 1), h.top - Math.round(up * 0.55)], c: [number, number] = [h.hx - 1, h.top - up];
      p.line(a, b, bone, 2); p.line(b, c, bone, 2);
      p.px(c[0] + 1, c[1] - 1, bone);
      p.line([h.hx + 2, h.top + 1], [h.hx + 3, h.top - sz(r, 2)], bone, 2);
    },
  },

  // ── wide: a broad felt brim and a crown with a band ─────────────────────────────────────────────────────────────────────────────────
  wide: {
    hat: (r) => {
      const h = headOf(r), { p, m } = r, bw = Math.round(h.rx * 1.75), y = h.top + 1;
      p.rect(h.hx - bw - 1, y + 1, 2, 1, m.second);
      p.rect(h.hx - bw, y, bw * 2 + 2, 1, m.second);
      p.rect(h.hx - Math.round(h.rx * 0.8), h.top - sz(r, 3), Math.round(h.rx * 1.7), sz(r, 3) + 1, m.second);
      p.px(h.hx + Math.round(h.rx * 0.9), h.top - sz(r, 3), 0);
      p.rect(h.hx - Math.round(h.rx * 0.8), h.top, Math.round(h.rx * 1.7), 1, m.leather);
      p.px(h.hx + Math.round(h.rx * 0.5), h.top, m.accent);
      patches(r, { x: h.hx - 3, y: h.top - sz(r, 2), w: 4, h: 2 }, wearDark(r, r.look.second));
    },
  },

  // ── straw: a conical straw hat with a woven pattern and a chin cord ─────────────────────────────────────────────────────────────────
  straw: {
    hat: (r) => {
      const h = headOf(r), { p } = r, st = p.mat('#bfa968'), dk = p.mat('#8a7440'), bw = Math.round(h.rx * 2.0), y = h.top + 2;
      p.poly([[h.hx - 0.5, h.top - sz(r, 5)], [h.hx - bw, y + 1], [h.hx + bw, y + 1]], st);
      for (let i = 0; i < sz(r, 5) + 2; i++) for (let x = h.hx - bw; x <= h.hx + bw; x++) if ((x + i) % 3 === 0 && p.at(x, y - i) === st) p.px(x, y - i, dk);
      p.rect(h.hx - bw, y + 1, bw * 2, 1, dk);
      p.line([h.hx + 2, y + 1], [h.hx + 2, h.hy + 2], p.mat(TONE.leather));
    },
  },

  // ── cap: a soft cloth cap with a short bill at the front ────────────────────────────────────────────────────────────────────────────
  cap: {
    hat: (r) => {
      const h = headOf(r), { p, m } = r;
      dome(r, m.second, 0.6, 0.3);
      p.rect(h.hx + 1, brow(h), Math.round(h.rx) + 2, 1, m.second);
      p.rect(h.hx + 2, brow(h) + 1, Math.round(h.rx), 1, p.mat(darker(r.look.second, 0.3)));
      p.px(h.hx, h.top - 1, m.second);
      patches(r, { x: h.hx - 3, y: h.top + 1, w: 4, h: 2 }, wearDark(r, r.look.second));
    },
  },

  // ── bandana: a knotted cloth over the head with the ends hanging behind ────────────────────────────────────────────────────────────
  bandana: {
    back: (r) => {
      const h = headOf(r), c = r.p.mat(mix(r.look.accent, '#1a1418', 0.35));
      r.p.rect(h.l - 3, h.hy - 2, 2, sz(r, 3), c);
      r.p.rect(h.l - 2 - r.flap, h.hy + 1, 2, sz(r, 3), c);
    },
    hat: (r) => {
      const h = headOf(r), c = r.p.mat(mix(r.look.accent, '#1a1418', 0.35));
      cap(r, c, 0.45, (nx, ny) => ny < -0.5 || (nx > -0.9 && ny < -0.25 && ny > -0.55) || (nx < -0.2 && ny < -0.1 && ny > -0.6));
      r.p.px(h.l - 1, h.hy - 2, c);
    },
  },

  // ── chef: a tall white pleated hat ──────────────────────────────────────────────────────────────────────────────────────────────────
  chef: {
    hat: (r) => {
      const h = headOf(r), { p } = r, wh = p.mat('#d8d2c2'), ln = p.mat('#b0a890'), w = Math.round(h.rx * 1.7), hh = sz(r, 5);
      p.rect(h.hx - Math.round(w / 2), h.top - 1, w, 2, wh);
      p.rect(h.hx - Math.round(w / 2) - 1, h.top - hh, w + 2, hh - 1, wh);
      p.ell(r.head[0] - 0.5, h.top - hh, w / 2 + 1.5, 1.8, wh);
      for (let x = h.hx - Math.round(w / 2) + 1; x < h.hx + Math.round(w / 2); x += 2) p.line([x, h.top - hh + 2], [x, h.top - 1], ln);
      patches(r, { x: h.hx - 2, y: h.top - hh + 2, w: 4, h: 3 }, p.mat('#9a8a60'));
    },
  },

  // ── circlet: a thin band of the accent round the brow with one gem ─────────────────────────────────────────────────────────────────
  circlet: {
    hat: (r) => {
      const h = headOf(r), { p, m } = r, y = brow(h) - 0;
      cap(r, m.accent, 0.35, (nx, ny) => ny > -0.52 && ny < -0.3 && (nx > -1.2));
      p.px(h.hx + Math.round(h.rx * 0.55), y, p.mat('#7a2a2a', { flat: true }));
    },
  },

  // ── crown: a band with points and red stones: gold, or the accent when the accent is a metal or bone (a silver crown, a crown of bones) ──
  crown: {
    // a band with three broad points (not a comb of needles) and one stone: red on gold, pale blue on silver
    hat: (r) => {
      const h = headOf(r), { p } = r, metal = crownMetal(r.look.accent), silver = metal !== TONE.gold, gold = p.mat(metal), hi = p.mat(lighter(metal, 0.35), { flat: true });
      const gem = p.mat(silver ? '#8ab8d8' : TONE.blood, { flat: true });
      const x0 = h.hx - Math.round(h.rx) + 1, n = Math.round(h.rx * 2) - 1, ph = sz(r, 3);
      p.rect(x0 - 1, h.top - 1, n + 2, 3, gold);
      for (const i of [0, Math.floor((n - 2) / 2), n - 2]) {
        p.rect(x0 + i, h.top - 2, 2, 1, gold);
        p.rect(x0 + i, h.top - 1 - ph, 1 + (ph > 2 ? 1 : 0), ph - 1, gold);
      }
      p.px(x0 + Math.floor((n - 2) / 2), h.top, gem);
      p.px(x0 - 1, h.top - 1, hi);
    },
  },

  // ── tiara: a fine arc of the accent over the front of the head with small peaks and a stone ────────────────────────────────────────────
  tiara: {
    hat: (r) => {
      const h = headOf(r), { p, m } = r;
      cap(r, m.accent, 0.35, (nx, ny) => ny < -0.55 && ny > -0.8 && nx > -0.5);
      p.px(h.hx + 1, h.top - 1, m.accent); p.px(h.hx + 2, h.top - 1, m.accent); p.px(h.hx + 1, h.top - sz(r, 2), m.accent);
      p.px(h.hx + 3, h.top, m.accent);
      p.px(h.hx + 1, h.top, p.mat('#9ad0e0', { flat: true }));
    },
  },

  // ── laurel: a wreath of leaves round the head, tied at the back ────────────────────────────────────────────────────────────────────
  laurel: {
    back: (r) => {
      const h = headOf(r), t = r.p.mat('#8a7a50');
      r.p.rect(h.l - 1, h.hy - 1, 1, sz(r, 3), t);
      r.p.rect(h.l - 2 - r.flap, h.hy + 1, 1, sz(r, 3), t);
    },
    hat: (r) => {
      const h = headOf(r), { p } = r, leaf = p.mat('#66783a'), lt = p.mat('#8a9a50');
      cap(r, leaf, 0.5, (nx, ny) => ny > -0.62 && ny < -0.22 && nx > -1.3);
      for (let x = h.l; x <= h.rgt; x += 2) p.px(x, brow(h) - 2 + ((x - h.l) % 4 === 0 ? 0 : 1), lt);
    },
  },

  // ── feather: a soft cap with a long feather of the accent rising from the side ─────────────────────────────────────────────────────
  feather: {
    hat: (r) => {
      const h = headOf(r), { p, m } = r, fe = p.mat(mix(r.look.accent, '#e8e0d0', 0.2));
      dome(r, m.second, 0.5, 0.2);
      p.rect(h.hx, brow(h), Math.round(h.rx) + 1, 1, m.second);
      const tip: [number, number] = [h.hx - 2 - sz(r, 5), h.top - sz(r, 6)];
      p.line([h.hx - 1, h.top + 1], tip, fe, r.k >= 0.8 ? 2 : 1);
      p.line([h.hx - 1, h.top + 1], [tip[0] + 1, tip[1] + 1], p.mat(lighter(r.look.accent, 0.5)));
      p.px(h.hx - 1, h.top + 1, m.leather);
    },
  },

  // ── furhat: a big fur hat with flaps down over the ears ─────────────────────────────────────────────────────────────────────────────
  furhat: {
    hat: (r) => {
      const h = headOf(r), { p } = r, fur = p.mat(mix(r.look.second, '#8a7a68', 0.35)), lt = p.mat(lighter(mix(r.look.second, '#8a7a68', 0.35), 0.25));
      cap(r, fur, 2.0, (nx, ny) => ny < -0.1 || (nx < 0.1 && ny < 0.85));
      p.rect(h.l - 2, brow(h) - 1, Math.round(h.rx * 2) + 3, 2, fur);
      p.rect(h.l - 2, brow(h) + 1, 3, sz(r, 3), fur);
      for (let x = h.l - 1; x < h.rgt + 2; x += 2) p.px(x, brow(h) + (x % 4 === 0 ? 1 : 0), lt);
      for (let x = h.l; x < h.rgt; x += 3) p.px(x + 1, h.top - 1, lt);
      p.rect(h.hx - 1, h.top - 2, 2, 1, fur);
    },
  },

  // ── goggles: brass goggles pushed up on the brow, a strap round the head ───────────────────────────────────────────────────────────
  goggles: {
    hat: (r) => {
      const h = headOf(r), { p } = r, brass = p.mat('#a8843a'), glass = p.mat('#7ab0c0', { flat: true }), y = h.top + 1;
      p.rect(h.l, y + 1, Math.round(h.rx * 2) - 1, 1, r.m.leather);
      const lens = (cx: number) => { p.ell(cx, y, 1.9, 1.7, brass); p.ell(cx, y, 0.9, 0.8, glass); };
      lens(h.hx + 1.5); lens(h.hx - 1.8);
      p.px(h.hx, y, brass);
    },
  },

  // ── minerhat: a hard hat with a short brim and a lamp at the front that shines ──────────────────────────────────────────────────────
  minerhat: {
    hat: (r) => {
      const h = headOf(r), { p, m } = r, lamp = p.mat('#f2e4a0', { flat: true });
      cap(r, m.second, 0.7, (nx, ny) => ny < -0.12 || (nx < -0.2 && ny < 0.35));
      p.rect(h.l - 1, brow(h), Math.round(h.rx * 2) + 2, 1, m.second);
      p.line([h.hx - 1, h.top - 1], [h.hx + 1, h.top - 1], p.mat(lighter(r.look.second, 0.2)));
      p.rect(h.hx + Math.round(h.rx) - 1, h.top, 2, 2, m.metal);
      p.px(h.hx + Math.round(h.rx) + 1, h.top, lamp); p.px(h.hx + Math.round(h.rx) + 1, h.top + 1, lamp);
      patches(r, { x: h.l + 1, y: h.top, w: 3, h: 3 }, p.mat(darker(r.look.second, 0.3)));
    },
  },

  // ── mitre: a tall pointed hat, split, with a band and a cross of the accent, two lappets behind ────────────────────────────────────
  mitre: {
    back: (r) => {
      const h = headOf(r);
      r.p.rect(h.l - 1, h.hy, 2, sz(r, 6), r.m.main);
      r.p.rect(h.l - 2 - r.flap, h.hy + 1, 2, sz(r, 6), r.m.second);
    },
    hat: (r) => {
      const h = headOf(r), { p, m } = r, up = sz(r, 6), w = Math.round(h.rx);
      p.poly([[h.hx - w, brow(h) + 1], [h.hx - w + 1, h.top - 1], [h.hx - 0.5, h.top - up], [h.hx + w - 1, h.top - 1], [h.hx + w, brow(h) + 1]], m.main);
      p.rect(h.hx - w, brow(h), w * 2, 1, m.accent);
      p.line([h.hx - 0.5, h.top - up + 1], [h.hx - 0.5, brow(h) - 1], m.second);
      p.px(h.hx - 1, h.top - 1, m.accent); p.px(h.hx, h.top - 1, m.accent); p.px(h.hx - 1, h.top - 2, m.accent); p.px(h.hx - 1, h.top, m.accent);
      patches(r, { x: h.hx - 3, y: h.top - 2, w: 3, h: 3 }, p.mat(mix(r.look.main, '#b8a98a', 0.3)));
    },
  },

  // ── turban: a big wound cloth with diagonal folds and a stone at the front ─────────────────────────────────────────────────────────
  turban: {
    hat: (r) => {
      const h = headOf(r), { p } = r, cloth = p.mat(lighter(r.look.second, 0.1)), fold = p.mat(darker(r.look.second, 0.22)), hi = p.mat(lighter(r.look.second, 0.3));
      // a round wound cloth wider than the head: a smooth dome, bands that wrap level round it, a knot on top, and the lowest band pulled down over the brow
      const cx = h.hx - 1, wr = Math.round(h.rx) + 2, top = h.top - 2;
      p.ell(cx, (top + brow(h)) / 2 + 0.5, wr, (brow(h) - top) / 2 + 1.2, cloth);
      p.ell(cx - 1, top - 0.5, 2.6, 1.8, hi);
      for (let y = top + 2; y <= brow(h); y += 2) p.line([cx - wr + 1, y + (y > top + 3 ? 0 : 1)], [cx + wr - 1, y - 1], fold);
      p.rect(Math.round(cx - wr), brow(h), wr * 2 + 1, 2, fold);
      p.px(h.hx + Math.round(h.rx) - 1, brow(h) - 1, p.mat(TONE.blood, { flat: true }));
    },
  },

  // ── veil: a light cloth over the crown that falls behind to the shoulder blades, the face open ────────────────────────────────────────
  veil: {
    back: (r) => {
      const h = headOf(r), c = r.p.mat(lighter(r.look.second, 0.3));
      r.p.poly([[h.hx - 1, h.hy - 1], [h.l - 3 - r.flap, h.hy + Math.round(h.ry * 2.6)], [h.hx - 1, h.hy + Math.round(h.ry * 2.4)]], c);
    },
    hat: (r) => {
      const h = headOf(r), c = r.p.mat(lighter(r.look.second, 0.3));
      keepFace(r, () => cap(r, c, 1.0, (nx, ny) => ny < -0.2 || (nx < -0.1 && ny < 0.7)));
      r.p.rect(h.l, brow(h), Math.round(h.rx * 2) - 1, 1, r.m.accent);
    },
  },

  // ── wizard: a tall soft cone with a broad brim, bent back at the tip, a band and a star ───────────────────────────────────────────────
  wizard: {
    hat: (r) => {
      const h = headOf(r), { p, m } = r, bw = Math.round(h.rx * 1.8), y = h.top + 1, up = sz(r, 8);
      p.rect(h.hx - bw, y, bw * 2 + 1, 1, m.second);
      p.rect(h.hx - bw - 1, y + 1, 2, 1, m.second);
      p.poly([[h.hx - Math.round(h.rx * 0.9), y], [h.hx + Math.round(h.rx * 0.8), y], [h.hx + 1, h.top - Math.round(up * 0.7)], [h.hx - 1, h.top - up]], m.second);
      p.line([h.hx - 1, h.top - up], [h.hx - 3 - sz(r, 2), h.top - up + sz(r, 3)], m.second, r.k >= 0.8 ? 2 : 1);
      p.rect(h.hx - Math.round(h.rx * 0.9), y - 1, Math.round(h.rx * 1.7), 1, m.accent);
      p.px(h.hx, h.top - Math.round(up * 0.4), m.glow);
      patches(r, { x: h.hx - 2, y: h.top - sz(r, 5), w: 3, h: 3 }, wearDark(r, r.look.second));
    },
  },
};
