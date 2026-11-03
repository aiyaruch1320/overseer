// Sea creatures that fit a sprite: the abyss lurker, an angler lying on the mud with its light on a stalk. (The siren is a person with a tail:
// look.ts. The kraken and the leviathan are background pieces: colossus.ts.)
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { spine, tube } from './dragon-parts';
import { dark, light, mix, rnd, type Ctx, type Info } from './kit';
import type { Pt } from '../paint';

export function paintSea(c: Ctx<EnemyLook>): Info {
  if (c.L.form === 'deepbeast') return deepBeast(c);
  const { L, mo, p } = c;
  const s = Math.min(c.px / 30, (c.w * 0.95) / 112);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const body = p.mat(L.main, { deep: true }), bodyD = p.mat(dark(L.second, 0.4)), fin = p.mat(L.second, { deep: true }), lure = p.mat(L.eye, { flat: true }), halo = p.mat(L.eye, { flat: true, alpha: 0.35 });
  const tooth = p.mat('#e8e4d0', { flat: true }), ink = p.mat('#06080e', { flat: true }), eye = p.mat('#c8d0d8', { flat: true }), mud = p.mat('#2a2a30', { alpha: 0.8 });
  const open = mo.pose === 'attack' ? [0.3, 1, 0.6][mo.a] : mo.pose === 'idle' ? 0.12 : mo.pose === 'hurt' ? 0.6 : mo.dead ? 0.7 : 0.2;
  const glow = mo.pose === 'idle' ? mo.breath : mo.f % 2;
  const sway = Math.sin(mo.ph) * 1.4;
  // a flat ray lying on the mud (04-enemies.md: ตัวแบนกว้างเหมือนกระเบนผสมปลาตกเบ็ด): a broad low disc whose rippling edge spreads over the bottom, a whip of a tail,
  // a very wide mouth at the front, two small milk-white eyes on top, and blue lights over the brow
  const ripple = (i: number): number => Math.sin(i * 1.3 + (mo.pose === 'walk' ? mo.ph : mo.breath * 0.9)) * 1.3;
  pen.chain([[-32, -10], [-44, -8 + sway * 0.5], [-54, -10 - sway]], [3, 1.6, 0.8], bodyD);
  pen.ell(-4, -14, 33, 15, body); pen.ell(-14, -22, 18, 7, p.mat(mix(L.main, L.second, 0.25), { deep: true }));
  // the wing-edges of the ray: lobes that spread and ripple along the foot of the disc
  const lobes: Pt[] = [[-38, -8]];
  for (let i = 0; i <= 12; i++) lobes.push([-38 + i * 6, -2 + ripple(i) * 0.4 - Math.sin((i / 12) * Math.PI) * 0.5]);
  lobes.push([34, -8]);
  pen.poly([...lobes, [30, -14], [-34, -14]], fin);
  pen.ell(-6, -3, 32, 3, bodyD);
  for (let i = 0; i < 9; i++) pen.dot(-26 + i * 5.4, -22 - (i % 2) * 3 + Math.abs(i - 4) * 0.8, i % 3 === 0 ? lure : bodyD, i % 3 === 0 ? 1.2 : 1.6);
  // the head is mostly mouth: a lower jaw that drops, rows of needles
  const jaw = open * 8;
  pen.poly([[14, -10], [36, -8 + jaw * 0.4], [38, -2 + jaw], [18, 0 + jaw * 0.5], [10, -3]], bodyD);
  pen.ell(22, -17, 14, 11, body);
  pen.poly([[14, -18], [38, -18], [39, -10], [28, -7 + jaw * 0.2], [14, -7]], body);
  pen.rect(16, -13, 22, 2.4 + jaw * 0.8, ink);
  for (let i = 0; i < 8; i++) {
    pen.poly([[17 + i * 2.8, -13], [18.2 + i * 2.8, -13 + 3.4 + (i % 2) * 1.6], [19.4 + i * 2.8, -13]], tooth);
    pen.poly([[18 + i * 2.8, -10.6 + jaw * 0.85], [19.2 + i * 2.8, -10.6 + jaw * 0.85 - 3 - (i % 2) * 1.6], [20.4 + i * 2.8, -10.6 + jaw * 0.85]], tooth);
  }
  // two small, pale, milky eyes on the brow
  for (const [ex, ey] of [[17, -24.5], [23.5, -25.5]] as const) { pen.dot(ex, ey, mo.dead ? bodyD : eye, 2.4); pen.dot(ex + 0.4, ey, ink, 0.9); }
  // the lure: a stalk arching over the mouth, and the light that blinks
  pen.chain([[14, -26], [18, -43], [31, -46], [39, -39 + open * 3]], [1.3, 1.1, 0.9, 0.8], bodyD);
  if (!mo.dead) { pen.ell(40, -38 + open * 3, 4.6 + glow, 4.6 + glow, halo); pen.ell(40, -38 + open * 3, 2.4, 2.4, lure); pen.dot(39.4, -38.8 + open * 3, p.mat(light(L.eye, 0.6), { flat: true }), 1); }
  pen.ell(-4, -0.5, 42, 2.2, mud);
  void mix;
  return { shadow: { cx: c.cx, cy: c.foot, rx: 34 * s, ry: Math.max(2, 2.4 * s * 0.5) }, tall: false };
}

// ── the deep-sea beast (Zenos): a giant squid with an angler's spines, the size of a house, one great eye half open, a dozen tentacles curled round itself ──
function deepBeast(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 72, (c.w * 0.94) / 104);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const hide = p.mat(L.main, { deep: true }), hideD = p.mat(dark(L.second, 0.5)), hideL = p.mat(mix(L.main, L.second, 0.3)), ol = p.mat('#04080e', { flat: true });
  const glow = p.mat(L.second, { flat: true }), glowL = p.mat(light(L.second, 0.5), { flat: true }), spine_ = p.mat(light(L.second, 0.1)), eyeM = p.mat('#c8d4cc', { deep: true }), pup = p.mat('#0a0e14', { flat: true }), iris = p.mat('#d8c060', { flat: true });
  const sway = mo.pose === 'idle' ? mo.breath * 1.4 : mo.pose === 'walk' ? Math.sin(mo.ph) * 1.4 : 0;
  const lash = mo.pose === 'attack' ? [0.2, 1, 0.5][mo.a] : 0;
  // tentacles: spirals round the foot of the body; the far ones first
  const N = 12, tens: { pts: Pt[]; depth: number }[] = [];
  for (let i = 0; i < N; i++) {
    const th0 = (i / N) * Math.PI * 2 + 0.3, R0 = 40 + (i % 3) * 5, turn = 1.5 + (i % 2) * 0.4;
    const pts = spine(14, (u) => { const th = th0 + u * turn * (i % 2 ? 1 : -1), R = R0 * (1 - 0.72 * u) + 3; return [Math.cos(th) * R * (1 + lash * 0.18 * Math.sin(th0)), -9 + Math.sin(th) * R * 0.34 - u * 5 * (1 + Math.sin(u * 6 + sway + i))]; });
    tens.push({ pts, depth: Math.sin(th0 + 1.2) });
  }
  tens.sort((a, b) => a.depth - b.depth);
  const drawT = (t: { pts: Pt[]; depth: number }, far: boolean): void => {
    const rad = t.pts.map((_, i) => 5 * (1 - i / 14 * 0.84) + 0.7);
    tube(pen, t.pts, rad, far ? hideD : hide, { ol, flip: false });
    for (let i = 3; i < 14; i += 3) pen.dot(t.pts[i][0], t.pts[i][1] + 0.4, glow, 1.2);
    pen.dot(t.pts[14][0], t.pts[14][1], glowL, 1.8);
  };
  tens.filter((t) => t.depth < 0).forEach((t) => drawT(t, true));
  // the mantle, with the spines of an angler's back and spots of cold light
  const by = -46 - mo.breath * 0.8 - lash * 2;
  for (let i = 0; i < 9; i++) { const x = -22 + i * 5.6; pen.poly([[x - 1.6, by - 17 + Math.abs(i - 4) * 1.6], [x + (i - 4) * 0.5, by - 28 - (i % 2) * 4 + Math.abs(i - 4) * 1.6], [x + 1.8, by - 17 + Math.abs(i - 4) * 1.6]], spine_); }
  pen.ell(-1, by, 29, 25, ol); pen.ell(-1, by, 28, 24, hide);
  pen.ell(-9, by - 10, 16, 8, hideL); pen.ell(8, by + 12, 22, 9, hideD);
  for (let i = 0; i < 16; i++) { const a = rnd(L.id, i) * Math.PI * 2, r = 6 + rnd(L.id, i + 30) * 19; pen.dot(-1 + Math.cos(a) * r, by + Math.sin(a) * r * 0.85, (i + mo.f) % 5 === 0 ? glowL : glow, 1.5 + (i % 3) * 0.4); }
  // the one eye: huge, pale, a lid half down
  const ex = 6, ey = by + 2;
  pen.ell(ex, ey, 14, 12.4, ol); pen.ell(ex, ey, 13, 11.4, eyeM);
  if (!mo.dead) { pen.ell(ex + 1.6, ey + 2.4, 6.4, 6.2, iris); pen.ell(ex + 2.2, ey + 2.6, 3.2, 4.4, pup); pen.dot(ex - 0.4, ey - 0.4, glowL, 1.8); }
  const lid = mo.dead ? 12 : 6.6 - mo.open * 4 + (mo.pose === 'idle' ? mo.breath * 0.8 : 0);
  pen.poly([[ex - 14, ey - 12], [ex + 14, ey - 12], [ex + 13, ey - 12 + lid + 4], [ex, ey - 12 + lid], [ex - 13, ey - 12 + lid + 3]], hide);
  pen.line([ex - 13, ey - 12 + lid + 3], [ex, ey - 12 + lid], ol, 1); pen.line([ex, ey - 12 + lid], [ex + 13, ey - 12 + lid + 4], ol, 1);
  tens.filter((t) => t.depth >= 0).forEach((t) => drawT(t, false));
  return { shadow: { cx: c.cx, cy: c.foot, rx: 44 * s, ry: Math.max(3, 5 * s * 0.5) }, tall: false };
}
