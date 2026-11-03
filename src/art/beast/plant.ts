// Trees that walk: the enraged ent (a dead-looking tree whose branches move slowly) and the blighted one (grey, shedding sap).
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { blend, dark, light, mix, ovEll, rnd, type Ctx, type Info } from './kit';

export function paintPlant(c: Ctx<EnemyLook>): Info {
  if (c.L.form === 'mushroom') return mushroom(c);
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

// ── the mushroom king: a mushroom as big as a small house; a violet cap with pale blue lights, a thick stalk with a calm face like bark ──────────
function mushroom(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 66, (c.w * 0.92) / 78);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const cap = p.mat(L.main, { deep: true }), capD = p.mat(dark(L.main, 0.34)), capL = p.mat(light(L.main, 0.28)), ol = p.mat(dark(L.main, 0.66), { flat: true });
  const stalk = p.mat('#c8b8a0', { deep: true }), stalkD = p.mat('#9a8a78'), stalkL = p.mat('#e4d8c4'), gill = p.mat(mix(L.main, '#e8c8c0', 0.35));
  const glow = p.mat(L.second, { flat: true }), glowL = p.mat(light(L.second, 0.55), { flat: true }), eye = p.mat(L.eye, { flat: true }), ink = p.mat('#2a1e1a', { flat: true });
  const att = mo.pose === 'attack', lift = att ? [-3, -5, -1][mo.a] : mo.pose === 'idle' ? -mo.breath * 1 : 0;
  const sway = mo.pose === 'walk' ? Math.sin(mo.ph) * 1.2 : 0;
  // roots and small mushrooms round the foot
  for (let i = 0; i < 6; i++) { const d = i % 2 ? 1 : -1, x = d * (12 + (i >> 1) * 6); pen.chain([[d * 7, -2], [x, -1 - (i % 3)], [x + d * 5, 0.5]], [2.4, 1.6, 0.8], stalkD); }
  for (const [x, h] of [[-26, 7], [-20, 4], [22, 6], [28, 3.4], [16, 4.4]] as const) { pen.rect(x - 0.8, -h, 1.8, h, stalkL); pen.ell(x, -h, h * 0.62 + 1, h * 0.36 + 0.8, ol); pen.ell(x, -h, h * 0.62, h * 0.36, capL); }
  // the stalk: wide at the foot, with folds in it, a calm face
  pen.poly([[-13, 0], [-9.6 + sway, -22], [-9 + sway, -34], [9 + sway, -34], [9.6 + sway, -22], [14, 0]], ol);
  pen.poly([[-12, 0], [-8.6 + sway, -22], [-8 + sway, -34], [8 + sway, -34], [8.6 + sway, -22], [13, 0]], stalk);
  pen.poly([[-12, 0], [-8.6 + sway, -22], [-8 + sway, -34], [-4 + sway, -34], [-5.4 + sway, -22], [-8, 0]], stalkL);
  pen.poly([[13, 0], [8.6 + sway, -22], [8 + sway, -34], [5 + sway, -34], [5.4 + sway, -22], [9, 0]], stalkD);
  for (let i = 0; i < 5; i++) pen.line([-6 + i * 3 + sway * 0.4, -30 + (i % 2) * 2], [-7 + i * 3.4, -3 - (i % 3) * 2], i % 2 ? stalkD : stalkL, 0.7);
  const fy = -23;
  pen.poly([[-6 + sway, fy - 7], [6 + sway, fy - 7], [5.6 + sway, fy + 4], [-5.6 + sway, fy + 4]], stalkL);
  if (mo.dead) { pen.line([-4.4 + sway, fy - 1], [-1.4 + sway, fy - 1], ink, 0.9); pen.line([1.6 + sway, fy - 1], [4.6 + sway, fy - 1], ink, 0.9); }
  else { pen.ell(-2.6 + sway, fy - 1.4, 2, 1, ink); pen.ell(2.8 + sway, fy - 1.4, 2, 1, ink); pen.dot(-2.6 + sway, fy - 1.6, eye, 1.4); pen.dot(2.8 + sway, fy - 1.6, eye, 1.4); }
  pen.line([-2.4 + sway, fy + 1.8], [2.4 + sway, fy + 1.8 + mo.open], ink, 0.8);
  // the cap: a dome with gills under the rim and lights of pale blue over it
  const cy = -38 + lift * 0.6;
  pen.ell(0 + sway, cy + 3.4, 36, 8.8, ol); pen.ell(sway, cy + 3.4, 35, 7.8, gill);
  for (let i = 0; i < 17; i++) pen.line([-30 + i * 3.7 + sway, cy + 1.6], [-30 + i * 3.7 + sway * 0.6 + (i - 8) * 0.12, cy + 9.6], i % 2 ? capD : p.mat(mix(L.main, '#ffffff', 0.15)), 0.7);
  pen.ell(sway, cy - 3, 35.4, 17.4, ol); pen.ell(sway, cy - 3, 34.4, 16.4, cap);
  pen.ell(-8 + sway, cy - 9, 21, 7.6, capL);
  pen.ell(15 + sway, cy + 1, 15, 5.2, capD);
  const spots: [number, number, number][] = [[-22, -5, 3.4], [-10, -16, 3], [4, -13, 4.2], [18, -9, 3.2], [28, -2, 2.4], [-28, 0, 2], [-2, -3, 2.4], [12, -19, 2.2], [-17, -10, 1.8], [22, -14, 1.8]];
  spots.forEach(([x, y, r], i) => { pen.ell(x + sway, cy + y, r + 0.8, r * 0.7 + 0.6, mix(L.second, '#1a2a40', 0.5) === '' ? ol : capD); pen.ell(x + sway, cy + y, r, r * 0.7, glow); pen.dot(x + sway - r * 0.3, cy + y - r * 0.2, glowL, Math.max(1, r * 0.5)); void i; });
  return {
    shadow: { cx: c.cx + mo.push * s, cy: c.foot, rx: 30 * s, ry: Math.max(2, 3 * s * 0.5) }, tall: true,
    after: (f) => { // spores hang in a haze round it and burst when it is angry
      const n = att && mo.a >= 1 ? 26 : 12;
      for (let i = 0; i < n; i++) {
        const ph = ((rnd(L.id, i + 50) * 4 + mo.f) % 4) / 4, a = rnd(L.id, i) * Math.PI * 2, d = 18 + rnd(L.id, i + 20) * (att && mo.a >= 1 ? 40 : 22) * (att ? 0.6 + ph : 1);
        const x = pen.X(Math.cos(a) * d), y = pen.Y(-34 + Math.sin(a) * d * 0.6 - ph * 6);
        blend(f, x, y, '#bff0d8', 0.85 - ph * 0.4); if (i % 3 === 0) blend(f, x + 1, y, '#8ad0c0', 0.5);
      }
      ovEll(f, pen.X(0), pen.Y(-30), 44 * s, 26 * s, '#a0e0d0', 0.08);
    },
  };
}
