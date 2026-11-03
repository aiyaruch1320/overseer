// The bare figure: torso, arms, legs, head and face, the ears of the race and the lower body (02-races.md ค่า UI: หู · ท่อนล่าง).
// An outfit that has its own `torso`, `farArm` or `nearArm` draws instead of these; a lower body other than legs draws instead of the legs.
import type { Ears, Lower } from '../look';
import type { Part, Rig } from '../rig';

const sleeve = (r: Rig, from: [number, number], to: [number, number]) => {
  r.p.line(from, to, r.m.main, r.k >= 0.8 ? 2 : 1);
  r.p.px(to[0], to[1], r.m.skin);
};

function leg(r: Rig, L: { x: number; fx: number; lift: number }) {
  const { p, m } = r, w = r.k >= 0.8 ? 2 : 1, bottom = r.foot - L.lift;
  if (r.sit) {
    // thigh forward, shin down from the knee
    const knee: [number, number] = [L.x + 4 * r.k, r.hip];
    p.rect(L.x, r.hip - w + 1, Math.round(knee[0] - L.x) + 1, w, m.pants);
    p.rect(Math.round(knee[0]), r.hip, w, Math.max(1, r.foot - r.hip - 1), m.pants);
    p.rect(Math.round(knee[0]), r.foot - 2, w + 1, 2, m.leather);
    return;
  }
  if (r.kneel) {
    const knee: [number, number] = [L.x + 3 * r.k, r.foot - 2];
    p.line([L.x, r.hip], knee, m.pants, w);
    p.line(knee, [knee[0] - 4 * r.k, r.foot - 1], m.pants, w);
    return;
  }
  p.line([L.x, r.hip], [L.fx, bottom - 2], m.pants, w);
  if (w > 1) p.line([L.x + 1, r.hip], [L.fx + 1, bottom - 2], m.pants);
  p.rect(Math.round(L.fx), bottom - 2, w + 1, 2, m.leather);
}

export const BODY_PARTS: { torso: Part; arms: Part; legs: Part; head: Part } = {
  torso: {
    torso: (r) => {
      const { p, m } = r, top = r.sh, h = Math.max(2, r.hip - r.sh);
      p.rect(r.x0, top, r.tw, h, m.main);
      p.px(r.x0, top, 0); p.px(r.x0 + r.tw - 1, top, 0);
      if (r.k >= 0.8) { p.rect(r.x0 - 1, r.hip - 1, r.tw + 2, 2, m.main); p.rect(r.x0, r.hip - 3, r.tw, 1, m.leather); }
    },
  },
  arms: {
    farArm: (r) => sleeve(r, r.shoulderFar, r.farHand),
    nearArm: (r) => sleeve(r, r.shoulderNear, r.hand),
  },
  legs: {
    lower: (r) => { leg(r, r.far); leg(r, r.near); },
  },
  head: {
    head: (r) => r.p.ell(r.head[0], r.head[1], r.hr[0], r.hr[1], r.m.skin),
    face: (r) => {
      const [hx, hy] = r.head, rx = r.hr[0];
      const shut = r.pose === 'pray' || (r.pose === 'die' && r.f > 0);
      r.p.px(hx + Math.round(rx * 0.5), hy, shut ? r.p.mat('#5a4a40') : r.m.eye);
      r.p.px(hx + Math.round(rx), hy + 1, r.m.skin);
    },
  },
};

/** The ears, drawn after the head (and after a hood: they poke out of it). */
export const EARS: Record<Ears, Part> = {
  round: { face: (r) => { r.p.px(r.head[0] - Math.round(r.hr[0] * 0.7), r.head[1], r.m.skin); r.p.px(r.head[0] - Math.round(r.hr[0] * 0.7), r.head[1] + 1, r.m.skin); } },
  long: { face: (r) => { const [hx, hy] = r.head; r.p.line([hx - r.hr[0] * 0.7, hy - 1], [hx - r.hr[0] * 0.7 - 3 * r.k, hy - 4 * r.k], r.m.skin, 2); } },
  pointed: { face: (r) => { const [hx, hy] = r.head; r.p.line([hx - r.hr[0] * 0.7, hy], [hx - r.hr[0] - 1.5 * r.k, hy - 1.5 * r.k], r.m.skin); } },
  animal: { hat: (r) => { const [hx, hy] = r.head, t = hy - r.hr[1]; r.p.poly([[hx - 3 * r.k, t + 1], [hx - 2 * r.k, t - 3 * r.k], [hx - 0.5 * r.k, t + 1]], r.m.hair); r.p.poly([[hx + 0.5 * r.k, t + 1], [hx + 1.5 * r.k, t - 3 * r.k], [hx + 3 * r.k, t + 1]], r.m.hair); } },
  fin: { face: (r) => { const [hx, hy] = r.head; r.p.poly([[hx - r.hr[0] * 0.6, hy - 2], [hx - r.hr[0] - 2.5 * r.k, hy - 3 * r.k], [hx - r.hr[0] * 0.6, hy + 2]], r.m.accent); } },
  none: {},
};

/** A lower body other than two legs replaces the legs (layer `lower`). The serpent tail, the trailing hem and the gel are drawn by the race work of M6. */
export const LOWER: Record<Lower, Part> = {
  legs: BODY_PARTS.legs,
  serpent: { lower: (r) => { const { p } = r; p.ell(r.x0 + r.tw / 2, r.foot - 3, r.tw * 0.7, 3, r.m.skin); p.poly([[r.x0, r.hip], [r.x0 + r.tw, r.hip], [r.x0 + r.tw + 1, r.foot - 3], [r.x0 - 1, r.foot - 3]], r.m.skin); } },
  gown: { lower: (r) => { r.p.poly([[r.x0, r.hip - 1], [r.x0 + r.tw, r.hip - 1], [r.x0 + r.tw + 2, r.foot], [r.x0 - 2 - r.flap, r.foot]], r.m.main); } },
  blob: { lower: (r) => { r.p.ell(r.x0 + r.tw / 2, r.foot - 4, r.tw * 0.8, 4, r.p.mat(r.look.skin, { alpha: 0.75 })); } },
};
