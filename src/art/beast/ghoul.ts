// The famished ghoul (ghoul_horde, 04-enemies.md): a thin grey-green corpse that runs on four limbs, back hunched, arms longer than the legs,
// long black nails, pits of yellow for eyes, a mouth that hangs open on yellow teeth. The horde draws two or three of them in a pack.
// Units: the middle of the feet is (0,0), up is negative, facing right.
import type { EnemyLook } from '../../core/data/types-beast-looks';
import type { Pt } from '../paint';
import { dark, light, mix, type Ctx, type Info } from './kit';

export const isGhoul = (L: EnemyLook): boolean => L.id === 'ghoul_horde';

export function paintGhoul(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 20, (c.w * 0.94) / 36);
  const att = mo.pose === 'attack', walk = mo.pose === 'walk';
  const lunge = att ? [0.2, 1, 0.5][mo.a] : 0;
  const pen = c.pen(s).at(mo.push, mo.bob);
  const skin = p.mat(L.main, { deep: true }), skinD = p.mat(dark(L.main, 0.34)), skinL = p.mat(light(L.main, 0.12)), rib = p.mat(dark(L.main, 0.5), { flat: true });
  const nail = p.mat('#16140e', { flat: true }), pit = p.mat('#1a1c10', { flat: true }), glow = p.mat(L.eye, { flat: true }), tooth = p.mat('#d8cc78', { flat: true }), gum = p.mat('#4a2a22', { flat: true });
  const rag = p.mat(L.second, { deep: true });
  // a gallop: forelimbs and hindlimbs reach and gather in turn
  const ph = walk ? mo.ph : 0;
  const reach = (o: number): Pt => walk ? [Math.sin(ph + o) * 5.5, -Math.max(0, Math.cos(ph + o)) * 4] : att ? [lunge * 3, -(mo.a === 0 ? 3 : 0)] : [0, 0];
  const idle = mo.pose === 'idle' ? mo.breath * 0.7 : 0;
  const arm = (far: boolean, o: number): void => {
    const [dx, dy] = reach(o), col = far ? skinD : skin;
    const sh: Pt = [4 + (far ? -1.6 : 0), -14 + idle * 0.4];
    const hand: Pt = [11.5 + dx + (far ? -2.5 : 0) + lunge * 3, -0.6 + dy - (att && mo.a === 0 ? 5 : 0)];
    const el: Pt = [(sh[0] + hand[0]) / 2 + 2.6, (sh[1] + hand[1]) / 2 - 0.5];
    pen.cap(sh, el, 1.5, 1.1, col); pen.cap(el, hand, 1.1, 0.8, col);
    for (let i = 0; i < 3; i++) pen.line([hand[0] + 0.4 + i * 0.7, hand[1] - 0.2], [hand[0] + 2.6 + i * 0.7, hand[1] + 0.9], nail, 0.6);
  };
  const leg = (far: boolean, o: number): void => {
    const [dx, dy] = reach(o), col = far ? skinD : skin;
    const hip: Pt = [-9.5 + (far ? 1 : 0), -10], foot: Pt = [-9 + dx * 0.7 - (far ? 2 : 0), -0.4 + dy * 0.7], kn: Pt = [hip[0] - 3.2, -5.4 + dy * 0.3];
    pen.cap(hip, kn, 2.1, 1.3, col); pen.cap(kn, foot, 1.3, 0.9, col);
    pen.rect(foot[0] - 1, -0.9 + dy * 0.7, 3.4, 0.9, nail);
  };
  leg(true, Math.PI * 0.5); arm(true, Math.PI);
  // the hunched trunk: haunch low behind, the shoulders humped high, the belly caved in
  const spine: Pt[] = [[-12, -10], [-6, -13.5 - idle * 0.3], [0, -16.6 - idle * 0.4], [5, -15.2]];
  for (let i = 0; i + 1 < spine.length; i++) pen.cap(spine[i], spine[i + 1], [2.5, 2.9, 3.2, 2.4][i], [2.9, 3.2, 2.4, 2][i + 1] ?? 2, skin);
  for (const [x, y] of [[-6, -17.4], [-2.5, -19.4], [1, -20]] as Pt[]) pen.dot(x, y + 0.8, skinL, 1.1); // the knuckles of the spine
  for (let i = 0; i < 4; i++) pen.line([-5 + i * 2.6, -14.4 - i * 0.7], [-4.2 + i * 2.6, -9.6 - i * 0.2], rib, 0.55); // ribs
  pen.poly([[-10, -9.6], [-6, -8], [-2, -8.4], [-5, -6.6], [-9, -6]], rag); // a rag round the hips
  // the head hangs low and forward, mouth open
  const jaw = 1.6 + mo.open * 2.4 + lunge * 1.6;
  const hx = 8.6 + lunge * 3, hy = -14 + lunge * 1.4;
  pen.cap([4.4, -15], [hx - 1.5, hy - 0.6], 2.6, 2.3, skin);
  pen.ell(hx, hy, 3.2, 2.9, skin);
  pen.poly([[hx + 1, hy - 0.4], [hx + 6.6, hy + 0.6], [hx + 6.2, hy + 2 + jaw * 0.2], [hx + 1, hy + 2]], skin);
  pen.poly([[hx + 1.2, hy + 1.8], [hx + 6.4, hy + 1.8 + jaw], [hx + 5.6, hy + 3 + jaw], [hx + 0.6, hy + 3.2 + jaw * 0.4]], skinD);
  pen.poly([[hx + 1.2, hy + 1.6], [hx + 6, hy + 1.6], [hx + 6.4, hy + 1.8 + jaw], [hx + 1.4, hy + 2.4 + jaw * 0.5]], gum);
  for (let i = 0; i < 4; i++) { pen.dot(hx + 2 + i * 1.3, hy + 1.8, tooth, 0.8); pen.dot(hx + 2.4 + i * 1.2, hy + 1.2 + jaw * 0.8, tooth, 0.7); }
  pen.ell(hx + 0.8, hy - 1, 1.5, 1.3, pit); pen.dot(hx + 1, hy - 1, mo.dead ? pit : glow, 0.9);
  pen.cap([hx - 3, hy - 2.4], [hx - 7.4 - (mo.f % 2) * 0.5, hy - 1.2 + (mo.f % 2)], 0.9, 0.4, p.mat('#3a3a30', { flat: true })); // the few hairs that trail
  leg(false, Math.PI * 1.5); arm(false, 0);
  void mix;
  return { shadow: { cx: c.cx + 1, cy: c.foot, rx: 14 * s, ry: Math.max(1.4, 1.5 * s) }, tall: false };
}
