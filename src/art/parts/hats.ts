// Hats (poc-visuals: หมวก 21 แบบ). Drawn in the `hat` layer, over the hair.
import type { Part } from '../rig';

export const HATS: Record<string, Part> = {
  hood: {
    back: (r) => { const [hx, hy] = r.head, [rx, ry] = r.hr; r.p.rect(Math.round(hx - rx - 1), Math.round(hy + ry * 0.6), 2, Math.round(ry), r.m.second); },
    hat: (r) => {
      const [hx, hy] = r.head, [rx, ry] = r.hr, { p } = r;
      // the hood over the head with the face left open (the eye and the nose are drawn again on top)
      const keep: [number, number, number][] = [];
      for (let y = Math.floor(hy - ry); y <= Math.ceil(hy + ry); y++) for (let x = Math.floor(hx); x <= Math.ceil(hx + rx + 1); x++) { const k = p.at(x, y); if (k && (x - hx) / rx > 0.05 && (y - hy) / ry > -0.45) keep.push([x, y, k]); }
      p.ell(hx - 0.5, hy - 0.5, rx + 1, ry + 1, r.m.second);
      for (const [x, y, k] of keep) p.px(x, y, k);
    },
  },
  helmet: {
    hat: (r) => { const [hx, hy] = r.head, [rx, ry] = r.hr, { p } = r; p.ell(hx, hy - ry * 0.5, rx * 1.15, ry * 0.85, r.m.metal); p.rect(Math.round(hx - rx - 1), Math.round(hy - 1), Math.round(rx * 2 + 2), 1, r.m.metal); p.px(hx + Math.round(rx * 0.75), hy, r.m.metal); },
  },
  wide: {
    hat: (r) => { const [hx, hy] = r.head, [rx, ry] = r.hr, { p } = r, top = Math.round(hy - ry); p.rect(Math.round(hx - rx * 1.7), top + 1, Math.round(rx * 3.4), 1, r.m.second); p.rect(Math.round(hx - rx * 0.8), top - 3, Math.round(rx * 1.6), 4, r.m.second); p.rect(Math.round(hx - rx * 0.8), top, Math.round(rx * 1.6), 1, r.m.leather); },
  },
};
