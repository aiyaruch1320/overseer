// Painter features (ลักษณะที่วาดเพิ่ม of 02-races.md, and personal marks): wings, tails, horns, crests, runes, glows, scars.
// Each is a part with whatever layers it needs; the race work of M6 fills this table from the codes the race docs name.
import type { Part } from '../rig';

export const FEATS: Record<string, Part> = {
  scar: { front: (r) => { const [hx, hy] = r.head; r.p.line([hx + 1, hy - 2], [hx + 2, hy + 1], r.p.mat('#a8605a')); } },
};
