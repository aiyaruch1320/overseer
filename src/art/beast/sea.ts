// Sea creatures that fit a sprite: the abyss lurker, an angler lying on the mud with its light on a stalk. (The siren is a person with a tail:
// look.ts. The kraken and the leviathan are background pieces: colossus.ts.)
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { dark, light, mix, type Ctx, type Info } from './kit';

export function paintSea(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 38, (c.w * 0.95) / 74);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const body = p.mat(L.main, { deep: true }), bodyD = p.mat(dark(L.second, 0.4)), fin = p.mat(L.second, { deep: true }), lure = p.mat(L.eye, { flat: true }), halo = p.mat(L.eye, { flat: true, alpha: 0.35 });
  const tooth = p.mat('#e8e4d0', { flat: true }), ink = p.mat('#06080e', { flat: true }), eye = p.mat('#c8d0d8', { flat: true }), mud = p.mat('#2a2a30', { alpha: 0.8 });
  const open = mo.pose === 'attack' ? [0.3, 1, 0.6][mo.a] : mo.pose === 'idle' ? 0.12 : mo.pose === 'hurt' ? 0.6 : mo.dead ? 0.7 : 0.2;
  const glow = mo.pose === 'idle' ? mo.breath : mo.f % 2;
  const sway = Math.sin(mo.ph) * 1.4;
  // tail fin and body
  pen.poly([[-34, -16], [-48, -26 + sway], [-45, -14], [-49, -4 - sway], [-34, -9]], fin);
  pen.ell(-8, -17, 30, 15, body);
  pen.poly([[-22, -29], [-14, -40], [-8, -29]], fin); pen.poly([[-2, -30], [4, -37], [8, -28]], fin);
  pen.ell(-4, -9, 24, 4, bodyD);
  for (let i = 0; i < 7; i++) pen.dot(-26 + i * 6, -22 - (i % 2) * 3, bodyD, 1.4);
  // the head is mostly mouth: a lower jaw that drops, rows of needles
  const jaw = open * 11;
  pen.poly([[8, -17], [34, -9 + jaw * 0.5], [36, -2 + jaw], [14, 0 + jaw * 0.7], [4, -4]], bodyD);
  pen.ell(18, -22, 17, 12, body);
  pen.poly([[10, -20], [36, -23], [37, -16], [26, -12 + jaw * 0.2], [10, -10]], body);
  pen.rect(12, -18, 24, 3 + jaw * 0.8, ink);
  for (let i = 0; i < 8; i++) {
    pen.poly([[13 + i * 3, -18], [14.4 + i * 3, -18 + 4 + (i % 2) * 2], [15.8 + i * 3, -18]], tooth);
    pen.poly([[14 + i * 3, -14.5 + jaw * 0.85], [15.4 + i * 3, -14.5 + jaw * 0.85 - 3.4 - (i % 2) * 2], [16.8 + i * 3, -14.5 + jaw * 0.85]], tooth);
  }
  pen.dot(24, -27, mo.dead ? bodyD : eye, 3); pen.dot(24.5, -27, ink, 1.4);
  // the lure: a stalk arching over the mouth, and the light that blinks
  pen.chain([[10, -32], [18, -46], [30, -48], [37, -41 + open * 3]], [1.3, 1.1, 0.9, 0.8], bodyD);
  if (!mo.dead) { pen.ell(38, -40 + open * 3, 4.6 + glow, 4.6 + glow, halo); pen.ell(38, -40 + open * 3, 2.4, 2.4, lure); pen.dot(37.4, -40.8 + open * 3, p.mat(light(L.eye, 0.6), { flat: true }), 1); }
  pen.ell(-4, -1, 34, 2.6, mud);
  void mix;
  return { shadow: { cx: c.cx, cy: c.foot, rx: 34 * s, ry: Math.max(2, 2.4 * s * 0.5) }, tall: false };
}
