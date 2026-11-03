// Outfits (poc-visuals: ชุด 26 แบบ). An outfit's `torso`, `farArm`, `nearArm` replace the bare ones; other layers add to the figure.
import type { Part } from '../rig';

export const OUTFITS: Record<string, Part> = {
  tunic: {},
  robe: {
    torso: (r) => { const { p, m } = r; p.poly([[r.x0, r.sh], [r.x0 + r.tw, r.sh], [r.x0 + r.tw + 2, r.foot - 1], [r.x0 - 2 - r.flap, r.foot - 1]], m.main); p.rect(r.x0, r.hip - 3, r.tw, 1, m.second); },
  },
  cape: {
    back: (r) => { const { p, m } = r; p.poly([[r.x0 + 1, r.sh], [r.x0 - 3 - r.flap, r.hip + 3], [r.x0 + 3, r.hip + 4], [r.x0 + 4, r.sh + 1]], m.second); },
  },
  armor: {
    torso: (r) => { const { p, m } = r; p.rect(r.x0, r.sh, r.tw, r.hip - r.sh, m.metal); p.px(r.x0, r.sh, 0); p.rect(r.x0 - 1, r.sh, 2, 2, m.metal); p.rect(r.x0 - 1, r.hip - 1, r.tw + 2, 2, m.main); p.rect(r.x0, r.hip - 3, r.tw, 1, m.leather); },
  },
};
