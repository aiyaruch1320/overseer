// Bones: the skeleton of the army (old rust on a few bones, a broken sword and a rotten shield), the lich that floats in his robe, and the lich king
// on his throne of shadow.
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { dark, light, mix, rnd, type Ctx, type Info, type Pen } from './kit';

export function paintUndead(c: Ctx<EnemyLook>): Info {
  if (c.L.form === 'lichking') return lichKing(c);
  if (c.L.form === 'lich') return lich(c);
  return skeleton(c);
}

function skull(pen: Pen, x: number, y: number, r: number, bone: number, boneD: number, eye: number, ink: number, dead: boolean, jaw: number, crooked = true): void {
  pen.ell(x, y, r, r * 0.95, bone);
  pen.rect(x + r * 0.2, y + r * 0.4, r * 0.95, r * 0.55, bone);
  for (const dx of [-0.3, 0.55]) { pen.ell(x + r * dx, y - 0.2, r * 0.3, r * 0.34, ink); if (!dead) pen.dot(x + r * dx + 0.2, y - 0.1, eye, r * 0.4); }
  pen.line([x + r * 0.35, y + r * 0.18], [x + r * 0.45, y + r * 0.4], ink, 0.7);
  // the jaw hangs, a little crooked
  pen.rect(x + r * 0.05 + (crooked ? 0.6 : 0), y + r * 0.8 + jaw, r * 0.95, r * 0.5, boneD);
  for (let i = 0; i < 3; i++) pen.dot(x + r * 0.2 + i * r * 0.28, y + r * 0.78, bone, 0.8);
}

function skeleton(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 28, (c.w * 0.9) / 30);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const bone = p.mat(L.main, { deep: true }), boneD = p.mat(dark(L.main, 0.3)), rust = p.mat(L.second, { deep: true }), eye = p.mat(L.eye, { flat: true }), ink = p.mat('#1a1814', { flat: true });
  const metal = p.mat('#9a9ea6'), wood = p.mat('#6a5232'), dirt = p.mat('#6a5a40', { flat: true });
  const walk = mo.pose === 'walk', att = mo.pose === 'attack';
  const sw = walk ? 3 * Math.sin(mo.ph) : att ? (mo.a === 1 ? 2 : -1) : 0;
  const hip = -13, sh = -24;
  const tilt = mo.pose === 'idle' ? 0.5 * mo.breath : 0;
  // legs: thin bones, a knee, a foot
  const leg = (x: number, o: number, k: number, lift: number) => { pen.line([x, hip], [x + o * 0.5 + 0.8, hip + 6.5], k, 1.4); pen.line([x + o * 0.5 + 0.8, hip + 6.5], [x + o, -lift - 1], k, 1.2); pen.rect(x + o - 0.5, -lift - 1.2, 3.4, 1.2, k); pen.dot(x + o * 0.5 + 0.8, hip + 6.5, k, 2); };
  leg(-1.8, -sw, boneD, walk ? Math.max(0, -Math.cos(mo.ph)) * 1.6 : 0); leg(2.2, sw, bone, walk ? Math.max(0, Math.cos(mo.ph)) * 1.6 : 0);
  // far arm with the rotten shield
  const far: [number, number] = [-5, sh + 8 + (walk ? -sw * 0.2 : 0)];
  pen.line([-1.5, sh + 1.5], far, boneD, 1.1);
  pen.ell(far[0] - 1.2, far[1] - 1, 3.4, 4.6, wood); pen.line([far[0] - 3.4, far[1] - 3], [far[0] + 1, far[1] + 1], p.mat('#3a2e1e'), 0.8);
  // pelvis, spine and ribs
  pen.ell(0.2, hip - 0.5, 3.4, 2, bone);
  pen.line([0, hip - 1], [0.6 + tilt * 0.3, sh + 1], boneD, 1.2);
  for (let i = 0; i < 4; i++) { const y = sh + 2.2 + i * 2.1; pen.line([-3.4 + i * 0.3, y], [3.6 - i * 0.3, y + 0.6], bone, 1); }
  pen.line([-3.6, sh + 0.6], [3.8, sh + 0.6], bone, 1.2);
  for (let i = 0; i < 6; i++) pen.dot(-2 + (rnd(L.id, i) * 5), sh + 2 + rnd(L.id, i + 5) * 8, dirt, 0.8);
  // rust: a pauldron, part of a breastplate
  pen.poly([[1.6, sh - 0.4], [5.8, sh + 0.2], [5.2, sh + 3.4], [2, sh + 2.6]], rust);
  pen.poly([[-3, sh + 4], [0, sh + 4], [0.2, sh + 7.6], [-3, sh + 7.2]], rust);
  // near arm: a thrust at the strike
  const hand: [number, number] = att ? (mo.a === 0 ? [1, sh + 2] : mo.a === 1 ? [11, sh + 5] : [7, sh + 6]) : walk ? [5 - sw * 0.3, sh + 9] : [5.4, sh + 8.6];
  pen.line([3.6, sh + 1.6], hand, bone, 1.2);
  pen.dot(hand[0], hand[1], bone, 1.6);
  const bl = att ? 12 : 9, ang = att ? (mo.a === 0 ? -1.0 : mo.a === 1 ? -0.12 : -0.5) : -1.2;
  const tip: [number, number] = [hand[0] + Math.cos(ang) * bl, hand[1] + Math.sin(ang) * bl];
  pen.line([hand[0] - Math.cos(ang) * 1.5, hand[1] - Math.sin(ang) * 1.5], tip, metal, 1.2);
  pen.line([hand[0] - Math.sin(ang) * 1.6, hand[1] + Math.cos(ang) * 1.6], [hand[0] + Math.sin(ang) * 1.6, hand[1] - Math.cos(ang) * 1.6], rust, 0.9);
  // neck and skull
  pen.line([0.8, sh + 0.4], [1.8 + tilt, sh - 2.2], boneD, 1.2);
  skull(pen, 2 + tilt + (mo.pose === 'hurt' ? -1 : 0), sh - 5, 3.7, bone, boneD, eye, ink, mo.dead, mo.open * 0.6 + (mo.dead ? 1 : 0));
  return { shadow: { cx: c.cx, cy: c.foot, rx: 8 * s, ry: Math.max(1.4, 1.8 * s) }, tall: true };
}

function lich(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 34, (c.w * 0.9) / 36);
  const hover = -5 - (mo.pose === 'idle' ? mo.breath * 1.4 : 0) - (mo.pose === 'walk' ? Math.sin(mo.ph) * 1.2 : 0);
  const pen = c.pen(s).at(mo.push, mo.bob + hover);
  const robe = p.mat(L.main, { deep: true }), robeD = p.mat(dark(L.main, 0.3)), trim = p.mat(L.second, { deep: true }), glow = p.mat(L.eye, { flat: true }), bone = p.mat('#d8d0b8', { deep: true }), ink = p.mat('#100c16', { flat: true });
  const fl = mo.pose === 'idle' ? mo.breath : mo.f % 2;
  // the hem drifts in wisps; no feet
  pen.poly([[-9, -6], [9, -6], [10.5, 3 + fl], [6, 1.5 - fl], [3, 5], [-1, 1.5 + fl], [-5, 5 - fl], [-10.5, 2]], robe);
  for (const x of [-7, -2, 3, 7]) pen.line([x, -8], [x - 1, 1 + fl], robeD, 1);
  pen.poly([[-8, -8], [8, -8], [7, -22], [2, -27], [-6, -24]], robe);
  pen.line([-8, -9], [8, -9], trim, 1.4);
  // hood, face of bone, burning eyes
  pen.ell(1.5, -27, 6.2, 6.4, robeD);
  pen.ell(2.6, -26.5, 4, 4.4, ink);
  pen.ell(3, -26.4, 3, 3.4, bone);
  for (const dx of [2.1, 4.2]) { pen.dot(dx, -27.6, mo.dead ? ink : glow, 1.5); if (!mo.dead) pen.dot(dx, -29.2 - fl * 0.8, glow, 1); }
  pen.rect(2.2, -24.6, 2.4, 0.8, ink);
  // hands: raised to bind the circle at the strike
  const up = mo.pose === 'attack' ? [0.4, 1, 0.6][mo.a] : 0;
  pen.line([5, -20], [9 + up * 3, -17 - up * 8], robe, 2.4); pen.dot(9.4 + up * 3, -17.5 - up * 8, bone, 1.8);
  pen.line([-5, -20], [-9, -14], robeD, 2.2); pen.dot(-9.4, -13.6, bone, 1.6);
  if (mo.pose === 'attack') {
    // a circle of seals turning in the air
    const cx = 15, cy = -18 - up * 5, rr = 6 + up * 4;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + mo.a * 0.6; pen.dot(cx + Math.cos(a) * rr * 0.5, cy + Math.sin(a) * rr, glow, i % 3 ? 1 : 1.8); }
    pen.ell(cx, cy, rr * 0.35, rr * 0.7, p.mat(mix(L.eye, L.second, 0.6), { flat: true, alpha: 0.7 }));
  }
  return { shadow: { cx: c.cx, cy: c.foot, rx: 8 * s, ry: Math.max(1.2, 1.4 * s) }, tall: false, ground: [c.cx, c.foot - hover * s] };
}

function lichKing(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 52, (c.w * 0.5) / 36);
  const pen = c.pen(s).at(mo.push * 0.5, 0);
  const robe = p.mat(L.main, { deep: true }), robeD = p.mat(dark(L.main, 0.3)), trim = p.mat(L.second, { deep: true }), glow = p.mat(L.eye, { flat: true }), bone = p.mat('#d8d0c0', { deep: true }), ink = p.mat('#0e0c14', { flat: true });
  const thr = p.mat(mix(L.main, L.second, 0.18), { deep: true }), thrL = p.mat(light(mix(L.main, L.second, 0.18), 0.15)), rune = p.mat(L.second, { flat: true });
  const fl = mo.pose === 'idle' ? mo.breath : mo.f % 2;
  // the throne: a tall spiked back
  pen.poly([[-16, 0], [-17, -34], [-13, -48], [-9, -36], [-5, -56], [0, -38], [5, -52], [8, -34], [13, -44], [14, -30], [15, 0]], thr);
  pen.rect(-16, -8, 32, 8, thrL);
  for (let i = 0; i < 4; i++) pen.dot(-9 + i * 6, -22 - (i % 2) * 8, rune, 1.8);
  // the king floats a little before it, robe falling over the seat
  const y0 = -4 - (mo.pose === 'idle' ? mo.breath * 1.2 : 0);
  pen.poly([[-10, y0 - 4], [10, y0 - 4], [12, y0 + 4], [5, y0 + 2 + fl], [0, y0 + 5], [-6, y0 + 2 - fl], [-12, y0 + 4]], robe);
  pen.poly([[-9, y0 - 6], [9, y0 - 6], [7, y0 - 24], [1, y0 - 28], [-6, y0 - 25]], robe);
  pen.line([-9, y0 - 8], [9, y0 - 8], trim, 1.6);
  pen.ell(1, y0 - 28, 5.6, 5.8, bone);
  for (const dx of [-0.8, 2.6]) { pen.ell(dx + 0.6, y0 - 28.4, 1.5, 1.7, ink); if (!mo.dead) pen.dot(dx + 0.6, y0 - 28.2, glow, 1.5); }
  pen.rect(-1.5, y0 - 25, 5.4, 0.8, ink);
  // the crown, and the empty throne room behind when he dies
  pen.poly([[-4.6, y0 - 32], [-5.6, y0 - 38], [-2.6, y0 - 34.5], [0.4, y0 - 40], [3, y0 - 34.5], [6.2, y0 - 38], [6, y0 - 32]], trim);
  // arms spread: the bones rise from the floor at the strike
  const up = mo.pose === 'attack' ? [0.3, 1, 0.5][mo.a] : 0;
  pen.line([6, y0 - 22], [15 + up * 5, y0 - 15 - up * 6], robe, 3); pen.dot(15.6 + up * 5, y0 - 15.5 - up * 6, bone, 2.2);
  pen.line([-6, y0 - 22], [-15 - up * 5, y0 - 15 - up * 6], robeD, 3); pen.dot(-15.6 - up * 5, y0 - 15.5 - up * 6, bone, 2.2);
  const ringY = 0;
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + mo.f * 0.4; pen.dot(Math.cos(a) * 26, ringY - 1 + Math.sin(a) * 3.4, glow, i % 4 ? 1 : 1.8); }
  if (up > 0.5) for (let i = 0; i < 7; i++) { const x = -26 + i * 8.6, h = 6 + rnd(L.id, i + (mo.a * 3)) * 9; pen.poly([[x - 1.2, 0], [x, -h], [x + 1.2, 0]], bone); }
  return { shadow: { cx: c.cx, cy: c.foot, rx: 30 * s, ry: Math.max(2, 3.2 * s * 0.5) }, tall: false, ground: [c.cx, c.foot] };
}
