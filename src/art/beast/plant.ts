// Trees that walk: the enraged ent (a dead-looking tree whose branches move slowly) and the blighted one (grey, shedding sap).
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { dark, light, rnd, type Ctx, type Info } from './kit';

export function paintPlant(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const blight = L.form === 'blight';
  const s = Math.min(c.px / 62, (c.w * 0.9) / 66);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const bark = p.mat(L.main, { deep: true }), barkD = p.mat(dark(L.main, 0.3)), barkL = p.mat(light(L.main, 0.15)), leaf = p.mat(L.second, { deep: true }), leafD = p.mat(dark(L.second, 0.25));
  const eye = p.mat(L.eye, { flat: true }), ink = p.mat('#14100c', { flat: true }), sap = p.mat(L.extra.find((e) => e.label === 'พิษ')?.hex ?? '#a8b8a8', { flat: true, alpha: 0.9 });
  const walk = mo.pose === 'walk', att = mo.pose === 'attack';
  const sw = walk ? 3 * Math.sin(mo.ph) : 0;
  const sag = mo.dead ? 0 : 0;
  // roots for legs
  pen.chain([[-5, -22], [-9 - sw, -9], [-14 - sw, -1]], [5, 4, 2.4], barkD);
  pen.chain([[5, -22], [9 + sw, -9], [15 + sw, -1]], [5.4, 4.2, 2.6], bark);
  pen.chain([[-1, -20], [-3, -6], [-1, -0.5]], [3, 2.6, 2], barkD);
  // the trunk, wide at the foot, with bark ridges
  pen.poly([[-12, -4 + sag], [-9, -34], [-8, -48], [-5, -58], [6, -58], [9, -48], [10, -34], [14, -4 + sag]], bark);
  pen.poly([[-12, -4], [-9, -34], [-7, -34], [-9, -4]], barkD);
  for (let i = 0; i < 6; i++) { const x = -6 + i * 3.4; pen.line([x, -50 + (i % 2) * 2], [x + (i % 3 - 1), -10 - (i % 2) * 6], i % 2 ? barkD : barkL, 0.8); }
  // arms: boughs with twigs; one is raised to strike, the other sways
  const wind = Math.sin(mo.ph * 0.5 + mo.breath * 1.5);
  const nearEnd: [number, number] = att ? (mo.a === 0 ? [20, -62] : mo.a === 1 ? [30, -12] : [24, -28]) : [24 + wind * 2, -30 + wind * 2];
  pen.chain([[7, -44], [(7 + nearEnd[0]) / 2 + 4, (-44 + nearEnd[1]) / 2 - 4], nearEnd], [4.2, 3.6, 2.6], bark);
  for (let i = 0; i < 4; i++) pen.line(nearEnd, [nearEnd[0] + 4 + i * 1.4, nearEnd[1] + 4 - i * 3.2], barkD, 0.9);
  const farEnd: [number, number] = [-24 - wind * 2, -34 - wind];
  pen.chain([[-7, -46], [-16, -44 - wind * 2], farEnd], [4, 3.2, 2.2], barkD);
  for (let i = 0; i < 3; i++) pen.line(farEnd, [farEnd[0] - 3 - i * 1.4, farEnd[1] + 3 - i * 2.4], barkD, 0.8);
  // the face: two knot-holes and a split mouth
  const fy = -44;
  pen.ell(-2, fy, 3, 3.4, ink); pen.ell(6, fy, 2.8, 3.2, ink);
  if (!mo.dead) { pen.dot(-1.6, fy + 0.4, eye, 1.7); pen.dot(6.2, fy + 0.4, eye, 1.7); }
  pen.line([-5, fy - 4.4], [0, fy - 3], barkD, 1.1); pen.line([4, fy - 3.6], [9, fy - 5], barkD, 1.1);
  pen.poly([[-2, fy + 6], [6, fy + 6], [5, fy + 10 + mo.open * 2], [-1, fy + 10 + mo.open * 2]], ink);
  // the canopy: sparse, as if the tree were dead (the ent) or sickly yellow-grey (the blighted one)
  const nLeaves = blight ? 9 : 14;
  for (let i = 0; i < nLeaves; i++) {
    const a = (i / nLeaves) * Math.PI * 2, rx = 15, ry = 8;
    const x = Math.cos(a) * rx * (0.5 + rnd(L.id, i) * 0.6) + 0.5, y = -64 + Math.sin(a) * ry * 0.7 - rnd(L.id, i + 7) * 3 + (blight ? 3 : 0);
    pen.ell(x, y + (mo.pose === 'idle' ? mo.breath * 0.4 * (i % 2) : 0), 3.6 + rnd(L.id, i + 14) * 2, 2.4, i % 2 ? leaf : leafD);
  }
  if (blight) {
    // grey sap runs from the knots, mushrooms on the shoulder
    for (let i = 0; i < 3; i++) pen.rect(-5 + i * 6, fy + 10 + i * 4, 1.4, 6 + ((mo.f * 2 + i * 3) % 6), sap);
    for (let i = 0; i < 3; i++) { pen.rect(8 + i * 2.6, -38 - (i % 2) * 2, 1.2, 3, p.mat('#d8d0c0', { flat: true })); pen.ell(8.6 + i * 2.6, -39 - (i % 2) * 2, 2.2, 1.2, p.mat('#8ab070')); }
    pen.rect(-10, -22, 1.6, 8 + ((mo.f * 3) % 5), sap);
  }
  void ((blight ? 1 : 0) + (att && mo.a === 1 ? 0 : 0));
  if (att && mo.a === 1) for (let i = 0; i < 6; i++) pen.dot(22 + i * 3.4, -1 - (i % 2), p.mat('#8a7a5a', { flat: true }), 1.5);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 20 * s, ry: Math.max(2, 3 * s * 0.5) }, tall: true };
}
