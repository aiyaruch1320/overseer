// Hair and beards (poc-visuals: ผม 14 ทรง; the ids are src/art/parts/ids.ts). Hair has a `back` layer (behind the body: long hair, braids, tails) and
// a `hair` layer over the head (the cap of hair). The face — the eye, the nose and the ear of a pointed-eared race — is kept clear. A hat that
// covers the head drops the parts that stand above it (a bun, a topknot, a crest), so the hat never has hair growing through it.
// Beards draw in the `face` layer: over the chest when they hang, under the hat.
import type { Part, Rig } from '../rig';
import { TONE, hash, headOf, mix, seedOf } from './kit';

/** Hats under which hair can stand above the head (the rest cover it). */
const LOW_HATS = new Set(['', 'circlet', 'laurel', 'bandana', 'goggles', 'feather']);
const standsUp = (r: Rig): boolean => LOW_HATS.has(r.look.hat);

/**
 * Hair that hugs the head: every pixel of the head's ellipse (grown by `grow`) for which `pred` holds. `nx` runs from the back of the head (-1)
 * to the face (+1), `ny` from the crown (-1) to the chin (+1), both relative to the head's own radii.
 */
function cap(r: Rig, grow: number, pred: (nx: number, ny: number) => boolean, mat = r.m.hair): void {
  const h = headOf(r), [cx, cy] = r.head, rx = h.rx + grow, ry = h.ry + grow;
  const clearEar = ['long', 'pointed', 'fin'].includes(r.look.body.ears);
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if ((dx / rx) ** 2 + (dy / ry) ** 2 > 1) continue;
      const nx = dx / h.rx, ny = dy / h.ry;
      if (clearEar && nx < -0.35 && ny > -0.5 && ny < 0.5) continue;
      if (pred(nx, ny)) r.p.px(x, y, mat);
    }
}
/** Short hair's outline: over the crown, the back and the side of the head, a fringe over the brow. */
const shortCap = (r: Rig, grow = 0.6): void => cap(r, grow, (nx, ny) => ny < -0.32 || (nx < -0.1 && ny < 0.5));
const sz = (r: Rig, v: number) => Math.max(1, Math.round(v * r.k));
/** A strand that falls behind the head and shoulders. */
const behind = (r: Rig, len: number, w = 3): void => {
  const h = headOf(r), x = h.l - 1, y0 = h.hy - Math.round(h.ry * 0.3);
  r.p.rect(x, y0, w, Math.round(h.ry * 1.3) + len, r.m.hair);
};

export const HAIR: Record<string, Part> = {
  // ── short: a plain cap of hair with a fringe ─────────────────────────────────────────────────────────────────────────────────────
  short: { hair: (r) => shortCap(r) },

  // ── long: hangs behind the head to the middle of the back ───────────────────────────────────────────────────────────────────────
  long: {
    back: (r) => { behind(r, sz(r, 6), 3); const h = headOf(r); r.p.rect(h.l - 2, h.hy + Math.round(h.ry), 2, sz(r, 5), r.m.hair); },
    hair: (r) => shortCap(r, 0.8),
  },

  // ── bald: a bare scalp with a shine, a thin ring of hair above the ears ──────────────────────────────────────────────────────────
  bald: {
    hair: (r) => {
      const h = headOf(r), shine = r.p.mat(mix(r.look.skin, '#ffffff', 0.35));
      r.p.px(h.hx - 1, h.top, shine);
      if (h.rx >= 3.5) r.p.px(h.hx, h.top, shine);
      cap(r, 0.2, (nx, ny) => nx < -0.55 && ny > -0.25 && ny < 0.45);
    },
  },

  // ── braid: a cap of hair and one thick braid down the back, tied at the end ──────────────────────────────────────────────────────
  braid: {
    back: (r) => {
      const h = headOf(r), n = sz(r, 9), tie = r.p.mat(TONE.leather), dk = r.p.mat(mix(r.look.hairColor, '#000000', 0.3));
      for (let i = 0; i < n; i++) {
        const x = h.l - 1 - (i % 4 < 2 ? 0 : 1), y = h.hy - 1 + i;
        r.p.rect(x, y, 2, 1, i % 4 === 1 || i % 4 === 3 ? dk : r.m.hair);
      }
      r.p.px(h.l - 1, h.hy - 1 + n, tie); r.p.px(h.l, h.hy - 1 + n, tie);
    },
    hair: (r) => shortCap(r, 0.4),
  },

  // ── bun: hair drawn back tight, a round bun at the top of the back ───────────────────────────────────────────────────────────────
  bun: {
    hair: (r) => {
      const h = headOf(r);
      cap(r, 0.3, (nx, ny) => ny < -0.4 || (nx < -0.2 && ny < 0.2));
      if (standsUp(r)) r.p.ell(h.hx - h.rx * 0.45, h.top - 0.5, Math.max(1.6, 1.9 * r.k), Math.max(1.6, 1.9 * r.k), r.m.hair);
      else r.p.ell(h.hx - h.rx * 0.9, h.hy - 1, 1.5, 1.8, r.m.hair);
    },
  },

  // ── ponytail: hair pulled back to a tail that swings behind ─────────────────────────────────────────────────────────────────────
  ponytail: {
    back: (r) => {
      const h = headOf(r), len = sz(r, 8), sway = r.flap - 1;
      const x = h.l - 1;
      for (let i = 0; i < len; i++) {
        const t = i / len, wid = i < len * 0.6 ? 2 : 1, ox = Math.round(-1 - t * 2 - sway * t);
        r.p.rect(x + ox, h.hy - 2 + i, wid + (i < 2 ? 1 : 0), 1, r.m.hair);
      }
      r.p.px(x + 1, h.hy - 2, r.p.mat(TONE.leather));
    },
    hair: (r) => cap(r, 0.35, (nx, ny) => ny < -0.4 || (nx < -0.25 && ny < 0.2)),
  },

  // ── topknot: hair gathered into a knot that stands on the crown, tied ───────────────────────────────────────────────────────────
  topknot: {
    hair: (r) => {
      const h = headOf(r);
      cap(r, 0.3, (nx, ny) => ny < -0.4 || (nx < -0.2 && ny < 0.15));
      if (standsUp(r)) {
        const w = Math.max(1.4, 1.6 * r.k);
        r.p.ell(h.hx - 0.5, h.top - 1.2 * r.k - 0.8, w, w * 1.1, r.m.hair);
        r.p.px(h.hx - 1, h.top, r.p.mat(TONE.leather)); r.p.px(h.hx, h.top, r.p.mat(TONE.leather));
      }
    },
  },

  // ── curly: a big head of curls, bumpy at the edge ───────────────────────────────────────────────────────────────────────────────
  curly: {
    hair: (r) => {
      const h = headOf(r), s = seedOf(r);
      cap(r, standsUp(r) ? 1.5 : 0.9, (nx, ny) => ny < -0.25 || (nx < 0.1 && ny < 0.55));
      if (standsUp(r)) for (let i = 0; i < 6; i++) {
        const a = Math.PI * (0.95 + i * 0.22), rad = h.ry + 1.6;
        const x = h.hx - 0.5 + Math.cos(a) * (h.rx + 1.2), y = h.hy - 0.5 + Math.sin(a) * rad;
        r.p.ell(x, y, 1.1 + hash(s, i) * 0.5, 1.1, r.m.hair);
      }
    },
  },

  // ── wild: unkempt, spikes in every direction ────────────────────────────────────────────────────────────────────────────────────
  wild: {
    hair: (r) => {
      const h = headOf(r), s = seedOf(r);
      cap(r, 0.8, (nx, ny) => ny < -0.3 || (nx < 0 && ny < 0.55));
      const up = standsUp(r), n = 6;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (1.0 + (i * 0.72) / (n - 1)) + 0.05, len = (2 + hash(s, i, 5) * 3) * r.k * (up ? 1 : 0.5);
        const fx = h.hx - 0.5 + Math.cos(a) * (h.rx + 0.4), fy = h.hy - 0.5 + Math.sin(a) * (h.ry + 0.2);
        r.p.line([fx, fy], [fx + Math.cos(a) * len, fy + Math.sin(a) * len], r.m.hair, r.k >= 0.8 ? 2 : 1);
      }
      r.p.line([h.l, h.hy], [h.l - sz(r, 2), h.hy + sz(r, 3)], r.m.hair, 2);
    },
  },

  // ── cropped: shaved close, only a dark shadow of hair on the scalp ──────────────────────────────────────────────────────────────
  cropped: {
    hair: (r) => cap(r, 0.1, (nx, ny) => ny < -0.5 || (nx < -0.3 && ny < 0.05)),
  },

  // ── mohawk: the sides shaved, a crest of hair from brow to nape ─────────────────────────────────────────────────────────────────
  mohawk: {
    hair: (r) => {
      const h = headOf(r), up = standsUp(r), hs = [2, 4, 5, 6, 6, 5, 4, 3];
      cap(r, 0.1, (nx, ny) => ny < -0.82);
      const x0 = h.hx - 4;
      hs.forEach((v, i) => { if (up) r.p.rect(x0 + i, h.top - Math.round(v * r.k) , 1, Math.round(v * r.k) + 1, r.m.hair); });
      if (!up) cap(r, 0.4, (nx, ny) => ny < -0.55);
      // the shaved sides keep a shadow of stubble
      cap(r, 0, (nx, ny) => nx < -0.2 && ny > -0.7 && ny < 0.1 && (Math.round(nx * 10) + Math.round(ny * 10)) % 3 === 0, r.p.mat(mix(r.look.skin, r.look.hairColor, 0.4)));
    },
  },

  // ── tied: hair pulled back from the brow and tied at the nape, the tail short ───────────────────────────────────────────────────
  tied: {
    back: (r) => {
      const h = headOf(r);
      r.p.rect(h.l - 2, h.hy + 1, 3, sz(r, 4), r.m.hair);
      r.p.rect(h.l - 1, h.hy + 1 + sz(r, 4), 2, 1, r.m.hair);
    },
    hair: (r) => {
      const h = headOf(r);
      cap(r, 0.3, (nx, ny) => ny < -0.45 || (nx < -0.2 && ny < 0.3));
      r.p.px(h.l - 1, h.hy + 1, r.p.mat(TONE.leather));
    },
  },
};

// ── beards ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The lower face: from the cheek round the chin, `grow` pixels beyond the head. */
const jaw = (r: Rig, grow: number, from = 0.28, back = -0.62, mat = r.m.hair): void => {
  const h = headOf(r), [cx, cy] = r.head, rx = h.rx + grow, ry = h.ry + grow;
  const top = Math.max(from, (h.hy + 2 - cy + 0.5) / h.ry);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if ((dx / rx) ** 2 + (dy / ry) ** 2 > 1) continue;
      if (dy / h.ry >= top && dx / h.rx > back) r.p.px(x, y, mat);
    }
};

export const BEARDS: Record<string, Part> = {
  short: { face: (r) => jaw(r, 0.7, 0.28, -0.35) },

  long: {
    face: (r) => {
      const h = headOf(r), len = sz(r, 8), bot = h.bot;
      jaw(r, 0.9);
      for (let i = 0; i < len; i++) {
        const w = Math.max(1, Math.round((h.rx * 1.3) * (1 - i / (len + 1))));
        r.p.rect(h.hx - Math.floor(w / 2) + 1, bot + 1 + i, w, 1, r.m.hair);
      }
    },
  },

  braided: {
    face: (r) => {
      const h = headOf(r), len = sz(r, 7), bead = r.p.mat(TONE.gold), dk = r.p.mat(mix(r.look.hairColor, '#000000', 0.3));
      jaw(r, 0.7);
      for (const ox of [0, 3]) {
        for (let i = 0; i < len; i++) { r.p.rect(h.hx - 1 + ox, h.bot + 1 + i, 2, 1, i % 2 ? dk : r.m.hair); }
        r.p.px(h.hx - 1 + ox, h.bot + len, bead); r.p.px(h.hx + ox, h.bot + len, bead);
      }
    },
  },

  stubble: {
    face: (r) => {
      const mat = r.p.mat(mix(r.look.skin, r.look.hairColor, 0.55));
      const h = headOf(r);
      for (let y = h.hy + 1; y <= h.bot; y++) for (let x = h.hx - 2; x <= h.hx + Math.round(h.rx) - 1; x++) if (r.p.at(x, y) === r.m.skin && (x + y) % 2 === 0) r.p.px(x, y, mat);
    },
  },

  moustache: {
    face: (r) => {
      const h = headOf(r), y = h.hy + 2;
      r.p.rect(h.hx + 1, y, Math.round(h.rx), 1, r.m.hair);
      r.p.px(h.hx + Math.round(h.rx) + 0, y, r.m.hair);
      if (r.k >= 0.8) { r.p.px(h.hx + 1, y + 1, r.m.hair); r.p.px(h.hx + Math.round(h.rx) - 1, y + 1, r.m.hair); }
    },
  },
};
