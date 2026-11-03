// Hair and beards (poc-visuals: ผม 14 ทรง). Hair has a back layer (behind the body) and a front layer (over the head).
import type { Part } from '../rig';

export const HAIR: Record<string, Part> = {
  short: {
    hair: (r) => { const [hx, hy] = r.head, [rx, ry] = r.hr; r.p.ell(hx - 0.5, hy - ry * 0.45, rx * 1.05, ry * 0.62, r.m.hair); r.p.rect(Math.round(hx - rx), Math.round(hy - ry * 0.4), Math.max(1, Math.round(rx * 0.7)), Math.round(ry), r.m.hair); },
  },
  long: {
    back: (r) => { const [hx, hy] = r.head, [rx, ry] = r.hr; r.p.rect(Math.round(hx - rx), Math.round(hy - ry * 0.3), Math.round(rx), Math.round(ry * 2.2), r.m.hair); },
    hair: (r) => { const [hx, hy] = r.head, [rx, ry] = r.hr; r.p.ell(hx - 0.5, hy - ry * 0.45, rx * 1.08, ry * 0.65, r.m.hair); },
  },
  bald: {},
};

export const BEARDS: Record<string, Part> = {
  short: { hat: (r) => { const [hx, hy] = r.head, [rx, ry] = r.hr; r.p.rect(Math.round(hx), Math.round(hy + ry * 0.4), Math.round(rx), Math.max(1, Math.round(ry * 0.5)), r.m.hair); } },
};
