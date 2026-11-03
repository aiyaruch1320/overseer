// Held things (poc-visuals: เครื่องมือ 30 ชนิด, and the weapons of 05-weapons-rules.md). The `held` layer is under the near arm, so the hand
// closes over the shaft. `kind` picks the attack and work frames (thrust, swing, cast, shoot).
import { along, aside, type Tool } from '../rig';

export const TOOLS: Record<string, Tool> = {
  spear: {
    kind: 'thrust',
    held: (r) => { const { p, m } = r, k = r.k; p.line(along(r, -7 * k), along(r, 9 * k), m.wood); p.line(along(r, 9 * k), along(r, 12 * k), m.metal); p.px(...aside(r, along(r, 10 * k), 1), m.metal); p.px(...aside(r, along(r, 10 * k), -1), m.metal); },
  },
  sword: {
    kind: 'swing',
    held: (r) => { const { p, m } = r, k = r.k; p.px(...along(r, -2), m.metal); p.line(along(r, -1), along(r, 0), m.leather); p.px(...aside(r, along(r, 1), 1), m.metal); p.px(...aside(r, along(r, 1), -1), m.metal); p.line(along(r, 1), along(r, 9 * k), m.metal); },
  },
  axe: {
    kind: 'swing',
    held: (r) => { const { p, m } = r, k = r.k; p.line(along(r, -3 * k), along(r, 8 * k), m.wood); p.poly([along(r, 5 * k), along(r, 8.5 * k), aside(r, along(r, 9 * k), 3.2 * k), aside(r, along(r, 4.5 * k), 3.2 * k)], m.metal); },
  },
  staff: {
    kind: 'cast',
    held: (r) => { const { p, m } = r, k = r.k; p.line(along(r, -9 * k), along(r, 9 * k), m.wood); p.ell(...along(r, 10.5 * k), 1.8 * k, 1.8 * k, m.glow); },
  },
};
