// Things with wings: the harpy and the storm harpy (a woman's body on wings and talons), the griffon, the flying flesh.
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { dark, light, rnd, type Ctx, type Info, type Pen } from './kit';

export function paintFlyer(c: Ctx<EnemyLook>): Info {
  switch (c.L.form) {
    case 'griffon': return griffon(c);
    case 'flesh': return flesh(c);
    default: return harpy(c);
  }
}

/** A feathered wing: root, then fingers fanning out to a scalloped trailing edge. `up` 0 (down) .. 1 (up). */
function wing(pen: Pen, root: [number, number], len: number, up: number, k: number, edge: number, fold = 0): void {
  const a = (-1.15 + (1 - up) * 2.1) * (1 - fold * 0.7) - fold * 0.35; // angle of the leading edge from the root (radians, 0 = backwards)
  const tip: [number, number] = [root[0] - Math.cos(a) * len * (1 - fold * 0.5), root[1] + Math.sin(a) * len * (1 - fold * 0.5)];
  const pts: [number, number][] = [root, tip];
  const n = 4;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const bx = tip[0] + (root[0] + len * 0.2 - tip[0]) * t, by = tip[1] + (root[1] + len * 0.45 + (1 - up) * len * 0.1 - tip[1]) * t;
    pts.push([bx - 1.4 * (i % 2) - 0.6, by + (i % 2 ? 1.4 : 0)]);
  }
  pts.push([root[0] + 1, root[1] + 3]);
  pen.poly(pts, k);
  pen.line(root, tip, edge, 1.2);
  for (let i = 2; i < pts.length - 1; i++) pen.line(root, pts[i], edge, 0.5);
}

function harpy(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const storm = L.form === 'storm';
  const s = Math.min(c.px / 18, (c.w * 0.9) / 30);
  const flying = mo.pose === 'walk' || mo.pose === 'attack';
  const lift = flying ? 3 + (mo.pose === 'walk' ? [0, -2, 0, -2][mo.f] : mo.a === 0 ? 2 : -1) : 0;
  const pen = c.pen(s).at(mo.push, mo.bob - lift);
  const feather = p.mat(L.main, { deep: true }), featherD = p.mat(dark(L.main, 0.3)), chest = p.mat(L.second), skin = p.mat(storm ? '#aab4c8' : '#c8a890'), eye = p.mat(L.eye, { flat: true }), claw = p.mat('#d8c8a0');
  const up = mo.pose === 'walk' ? [1, 0.45, 0, 0.45][mo.f] : mo.pose === 'attack' ? [1, 0, 0.5][mo.a] : mo.pose === 'idle' ? 0 : mo.pose === 'hurt' ? 0.8 : 0.1;
  const fold = mo.pose === 'idle' || mo.dead ? 0.45 : 0;
  // far wing
  wing(pen.at(1, 0), [0, -17], 15, up, featherD, p.mat(dark(L.main, 0.45)), fold);
  // legs and talons
  const dive = mo.pose === 'attack' ? mo.strike : 0;
  pen.line([-1, -8], [-1.5 + dive * 4, -2.2 + (flying ? 0 : 0)], feather, 1.4); pen.line([1.5, -8], [2 + dive * 5, -2.2], feather, 1.5);
  for (const x of [-1.5, 2]) { pen.line([x + dive * 4.5, -2.2], [x + 1.8 + dive * 5, -0.6 + dive * 0.5], claw, 0.8); pen.line([x + dive * 4.5, -2.2], [x - 0.8 + dive * 4, -0.5], claw, 0.8); }
  // body: feathered thighs and chest, a woman's torso
  pen.ell(0, -12, 3.9, 5.2, feather);
  pen.ell(1.2, -14, 2.6, 4, chest);
  for (let i = 0; i < 3; i++) pen.poly([[-2.5 + i * 2, -8], [-1.5 + i * 2, -5], [-0.5 + i * 2, -8]], chest);
  // head with wild hair
  pen.ell(1.4, -20, 2.7, 2.9, skin);
  pen.poly([[-2.2, -23], [-5.4, -21 + (mo.f % 2) * 0.6], [-4, -17], [-1.5, -18]], feather);
  pen.poly([[-1, -23], [0.5, -26.4], [2.5, -23.6]], chest);
  pen.dot(2.8, -20.3, mo.dead ? featherD : eye, 1.1);
  pen.rect(2.4, -18.5 + 0, 1.8, 0.7 + mo.open * 0.8, p.mat('#6a2a2a', { flat: true }));
  if (storm && flying) for (let i = 0; i < 3; i++) pen.line([2 + dive * 5, -2 + i * 0.4], [3 + i * 2.4 + dive * 8, -1 + (i % 2 ? 2.6 : -2.6) + i], p.mat(L.eye, { flat: true }), 0.7);
  if (storm && mo.a === 1) { pen.line([6, -14], [9, -11], p.mat(L.eye, { flat: true }), 0.9); pen.line([9, -11], [8, -8], p.mat(L.eye, { flat: true }), 0.9); pen.line([8, -8], [12, -3], p.mat(L.eye, { flat: true }), 0.9); }
  // near wing
  wing(pen, [-0.5, -16.5], 17, up, feather, featherD, fold);
  return { shadow: { cx: c.cx, cy: c.foot, rx: (flying ? 5 : 6) * s, ry: Math.max(1.2, 1.4 * s) }, tall: true };
}

function griffon(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 28, (c.w * 0.9) / 52);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const fur = p.mat(L.main, { deep: true }), furD = p.mat(dark(L.main, 0.3)), head = p.mat(L.second, { deep: true }), headD = p.mat(dark(L.second, 0.25));
  const eye = p.mat(L.eye, { flat: true }), beak = p.mat('#e0b440'), claw = p.mat('#c8a040');
  const walk = mo.pose === 'walk', att = mo.pose === 'attack';
  const spread = att ? [0.8, 1, 0.5][mo.a] : walk ? [1, 0.5, 0, 0.5][mo.f] : mo.pose === 'idle' ? 0 : 0.2;
  const cy = -16;
  // rear lion legs
  const sw = walk ? 2.4 * Math.sin(mo.ph) : 0;
  pen.cap([-9, cy + 3], [-10 - sw, -1], 3, 2, furD); pen.cap([-5, cy + 3], [-5 + sw, -1], 3.2, 2.2, fur);
  pen.rect(-12 - sw, -1.4, 4, 1.4, furD); pen.rect(-7 + sw, -1.4, 4, 1.4, fur);
  // tail with a tuft
  pen.cap([-13, cy - 1], [-22, cy + 2 + Math.sin(mo.ph + 1) * 2], 2, 0.9, fur); pen.ell(-23, cy + 2 + Math.sin(mo.ph + 1) * 2, 2.4, 2, furD);
  // far wing and body
  wing(pen.at(2, 0), [0, cy - 5], 22, spread, furD, p.mat(dark(L.main, 0.5)), mo.pose === 'idle' ? 0.75 : 0);
  pen.ell(-3, cy, 12, 5.8, fur);
  pen.ell(-3, cy + 3.6, 9, 2, p.mat(L.second));
  pen.ell(6, cy - 3, 6, 6.5, head); // the eagle's chest and neck feathers
  for (let i = 0; i < 4; i++) pen.poly([[3 + i * 2, cy + 1], [4 + i * 2, cy + 4.4], [5 + i * 2, cy + 1]], headD);
  // eagle forelegs with talons
  const reach = att ? 3.5 * mo.strike : 0;
  pen.cap([5, cy + 3], [6.5 - sw + reach, -1 - (att ? (mo.a === 0 ? 5 : 0) : 0)], 2.2, 1.5, head);
  pen.cap([8, cy + 3], [9 + sw + reach, -1], 2.2, 1.5, headD);
  for (const x of [6.5 - sw + reach, 9 + sw + reach]) { pen.rect(x - 1, -1.6 - (att && mo.a === 0 ? 5 : 0), 4, 1.4, claw); }
  // head: hooked beak, big eye
  const hy = cy - 10 + (att ? 4 * mo.strike : 0), hx = 10 + (att ? 3 * mo.strike : 0);
  pen.ell(hx, hy, 4.6, 4.2, head);
  pen.poly([[hx + 2.5, hy - 2], [hx + 9.5, hy + 1.2 + mo.open * 0.5], [hx + 8, hy + 3.6], [hx + 2.5, hy + 2.8]], beak);
  pen.poly([[hx + 8.4, hy + 1.6], [hx + 9.4, hy + 4.6], [hx + 7.4, hy + 3.4]], beak);
  pen.poly([[hx - 3.4, hy - 3], [hx - 6.5, hy - 6.2], [hx - 2, hy - 1]], headD);
  pen.dot(hx + 1.4, hy - 0.8, mo.dead ? headD : eye, 1.6);
  // near wing
  wing(pen, [-2, cy - 5], 25, spread, fur, furD, mo.pose === 'idle' ? 0.75 : 0);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 15 * s, ry: Math.max(1.6, 2 * s * 0.7) }, tall: false };
}

function flesh(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 22, (c.w * 0.9) / 26);
  const hover = -8 + Math.sin(mo.ph) * 1.4 + (mo.pose === 'idle' ? mo.breath * 1.4 : 0);
  const pen = c.pen(s).at(mo.push, mo.bob + hover);
  const mass = p.mat(L.main, { deep: true }), vein = p.mat(L.second), eye = p.mat(L.eye, { flat: true }), mouth = p.mat('#4a1a22', { flat: true });
  const flap = mo.pose === 'idle' ? mo.breath : mo.f % 2;
  // two ragged membranes
  pen.poly([[-4, -13], [-14, -20 + flap * 3], [-11, -15], [-14, -11 + flap * 2], [-8, -9], [-3, -9]], p.mat(L.second, { alpha: 0.9 }));
  pen.poly([[3, -13], [12, -19 + flap * 3], [9, -14], [12, -10 + flap * 2], [6, -8], [2, -9]], p.mat(L.second, { alpha: 0.9 }));
  pen.ell(0, -11, 8, 7, mass);
  pen.ell(-4, -9, 3.5, 3.2, mass); pen.ell(4, -14, 3.6, 3, mass);
  for (let i = 0; i < 5; i++) pen.line([-6 + i * 3, -16 + (i % 2) * 2], [-3 + i * 2.2, -9 + (i % 3)], vein, 0.8);
  // eyes scattered and a shrieking mouth
  for (const [x, y] of [[3, -13], [-3.5, -12], [1, -8.5]] as const) { pen.dot(x, y, mo.dead ? vein : eye, 1.7); }
  pen.ell(4.8, -9.6, 2.4 + mo.open * 0.8, 1.4 + mo.open * 2.2, mouth);
  for (let i = 0; i < 3; i++) pen.cap([-2 + i * 2, -5.5], [-3 + i * 2.6 - mo.ph * 0.2, -1 + (mo.f % 2) - i * 0.4], 1.1, 0.5, vein);
  void rnd; void light;
  return { shadow: { cx: c.cx, cy: c.foot, rx: 8 * s * 0.8, ry: Math.max(1.2, s) }, tall: false };
}
