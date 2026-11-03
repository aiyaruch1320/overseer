// Four creatures that needed a body of their own: the yeti (a shaggy ape with arms to the ground), the glow mutant (a man whose one arm has
// swollen), the fog tentacle (a stalk of white vapour out of a wall of fog) and the manticore (a lion with an old man's face, bat wings and a
// scorpion's tail). Units: the middle of the feet is (0,0), up is negative, facing right.
import type { EnemyLook } from '../../core/data/types-beast-looks';
import type { Pt } from '../paint';
import { ik, paw, spine, tube, wing } from './dragon-parts';
import { blend, dark, light, mix, ovEll, ovPuff, rnd, type Ctx, type Info } from './kit';

export const isSpecial = (L: EnemyLook): boolean => L.form === 'ape' || L.form === 'mutant' || L.form === 'tentacle' || L.form === 'manticore';

export function paintSpecial(c: Ctx<EnemyLook>): Info {
  switch (c.L.form) {
    case 'ape': return yeti(c);
    case 'mutant': return mutant(c);
    case 'tentacle': return tentacle(c);
    default: return manticore(c);
  }
}

// arm swing of the idle, the walk and the strike: the fist's place (units) for a shoulder at S
function fistFor(c: Ctx<EnemyLook>, rest: Pt, raised: Pt, slam: Pt, far: boolean): Pt {
  const { mo } = c;
  if (mo.pose === 'attack') { const k = [raised, slam, [(rest[0] + slam[0]) / 2, (rest[1] + slam[1]) / 2 - 8]][mo.a] as Pt; return [k[0] + (far ? -2 : 0), k[1]]; }
  if (mo.pose === 'walk') return [rest[0] + Math.sin(mo.ph + (far ? Math.PI : 0)) * 5, rest[1] - Math.max(0, Math.cos(mo.ph + (far ? Math.PI : 0))) * 2];
  if (mo.pose === 'idle') return [rest[0] + (far ? -0.5 : 0.5) * (mo.breath ? 2 : 0), rest[1] - mo.breath * 0.8];
  if (mo.pose === 'hurt') return [rest[0] - 4, rest[1] - 3];
  return [rest[0] + 2, rest[1] + (mo.dead ? 0 : -2)];
}

// ── the yeti ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function yeti(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 48, (c.w * 0.92) / 52);
  const pen = c.pen(s).at(mo.push * 0.7, mo.bob);
  const fur = p.mat(L.main, { deep: true }), furL = p.mat(light(L.main, 0.3)), furD = p.mat(L.second, { deep: true }), furDD = p.mat(dark(L.second, 0.3)), ol = p.mat(dark(L.second, 0.55), { flat: true });
  const face = p.mat(dark(L.second, 0.5), { deep: true }), faceL = p.mat(light(L.second, 0.1)), eye = p.mat(L.eye, { flat: true }), ink = p.mat('#14161c', { flat: true }), snow = p.mat('#f2f6fc'), tooth = p.mat('#d8d4c4', { flat: true });
  const atk = mo.pose === 'attack';
  const lean = atk ? [-3, 4, 1][mo.a] : mo.dead ? 3 : 0;
  const S: Pt = [4 + lean * 0.6, -35 + (atk && mo.a === 0 ? -2 : 0)];
  const arm = (far: boolean): void => {
    const sh: Pt = [S[0] + (far ? -4 : 3), S[1] + 1];
    const F = fistFor(c, [15 + (far ? -6 : 0), -5], [9 + (far ? -3 : 2), -56], [23 + (far ? -4 : 1), -3], far);
    const E = ik(sh, F, 17, 17, 1);
    const k = far ? furDD : p.mat(mix(L.main, L.second, 0.55), { deep: true });
    pen.chain([sh, E, F], [7.6, 6.6, 5.4], ol); pen.chain([sh, E, F], [6.8, 5.8, 4.6], k);
    // shaggy edges: tufts hang from the underside of the arm
    for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6, q: Pt = t < 0.5 ? [sh[0] + (E[0] - sh[0]) * t * 2, sh[1] + (E[1] - sh[1]) * t * 2] : [E[0] + (F[0] - E[0]) * (t - 0.5) * 2, E[1] + (F[1] - E[1]) * (t - 0.5) * 2]; pen.poly([[q[0] - 2.2, q[1] + 3], [q[0] - 1.2 - (i % 2), q[1] + 7.2], [q[0] + 0.6, q[1] + 3]], i % 2 ? (far ? furD : furD) : k); }
    pen.ell(F[0] + 0.5, F[1] + 1.4, 5.6, 4.8, ol); pen.ell(F[0] + 0.5, F[1] + 1.4, 4.8, 4, far ? furD : furL);
    for (const dx of [-1.8, 0.4, 2.6]) pen.line([F[0] + dx, F[1] + 3], [F[0] + dx, F[1] + 5.4], ol, 0.8);
  };
  arm(true);
  // legs: two pillars of fur on wide flat feet that leave deep prints
  const leg = (x: number, o: number, far: boolean): void => {
    const sw = mo.pose === 'walk' ? Math.sin(mo.ph + o) * 3 : 0, up = mo.pose === 'walk' ? Math.max(0, Math.cos(mo.ph + o)) * 2.4 : 0, k = far ? furD : fur;
    pen.chain([[x, -19], [x + sw * 0.5, -10 - up], [x + sw, -3 - up]], [6.4, 5.6, 5], ol); pen.chain([[x, -19], [x + sw * 0.5, -10 - up], [x + sw, -3 - up]], [5.6, 4.8, 4.2], k);
    pen.ell(x + sw + 2.2, -1.6 - up, 6.6, 2.8, ol); pen.ell(x + sw + 2.2, -1.6 - up, 5.8, 2.2, far ? furDD : furD);
    for (const dx of [0, 2.6, 5.2]) pen.dot(x + sw + dx, -0.6 - up, snow, 1.4);
  };
  leg(-5, Math.PI, true); leg(6, 0, false);
  // the torso: a barrel of a chest, a hump of shoulders, a belly of lighter fur
  pen.ell(2 + lean * 0.3, -26, 14.5, 13.5, ol); pen.ell(2 + lean * 0.3, -26, 13.5, 12.6, fur);
  pen.ell(0 + lean * 0.5, -35, 13.4, 7.6, ol); pen.ell(0 + lean * 0.5, -35, 12.4, 6.8, fur);
  pen.ell(4, -23, 8.4, 8, furL);
  for (let i = 0; i < 12; i++) { const a = rnd('yt', i) * Math.PI * 2, r = 0.3 + rnd('yt', i + 20) * 0.7; const x = 2 + Math.cos(a) * 11 * r, y = -27 + Math.sin(a) * 11 * r; pen.line([x, y], [x - 0.6, y + 2.6], i % 2 ? furD : furL, 0.7); }
  // snow clings to the top of the shoulders and head
  for (const [x, y, r] of [[-7, -41, 3.6], [-1, -42.6, 3.2], [5, -41.4, 2.8], [-9, -37, 2.2]] as const) pen.ell(x + lean * 0.5, y, r, r * 0.55, snow);
  for (let i = 0; i < 9; i++) { const x = -12 + i * 3.4, y = -26 - Math.cos(i * 0.9) * 8; pen.poly([[x - 1.6, y + 6], [x + (i % 2 ? 0.5 : -0.5), y + 11.2 + (i % 3)], [x + 1.8, y + 6]], i % 2 ? furL : fur); }
  arm(false);
  // the head sunk between the shoulders: a dark flat bear's face, small pale eyes, a wide blunt mouth
  const hx = 13 + lean * 0.9, hy = -37 + (mo.dead ? 4 : 0);
  pen.ell(hx, hy, 8, 7, ol); pen.ell(hx, hy, 7.2, 6.2, fur);
  pen.ell(hx + 1.6, hy + 1, 5.4, 4.8, ol); pen.ell(hx + 1.6, hy + 1, 4.6, 4, face);
  pen.ell(hx + 2.4, hy + 3, 3.4, 1.8, faceL);
  pen.poly([[hx - 3, hy - 3.6], [hx + 6, hy - 3.2], [hx + 6, hy - 1.6], [hx - 3, hy - 1.6]], furD);
  const eyeK = mo.dead ? ink : eye;
  pen.dot(hx + 1.4, hy - 0.6, eyeK, 1.5); pen.dot(hx + 4.4, hy - 0.6, eyeK, 1.5);
  const jaw = mo.open * 2.4 + (atk && mo.a === 1 ? 1.6 : 0);
  pen.rect(hx + 0.4, hy + 2.6, 6, 1 + jaw, ink);
  for (const dx of [0.8, 2.8, 4.8]) pen.rect(hx + dx, hy + 2.6, 1, 1, tooth);
  for (let i = 0; i < 5; i++) pen.poly([[hx - 5 + i * 2.6, hy + 3.5], [hx - 4.4 + i * 2.6, hy + 7.4 + (i % 2)], [hx - 3 + i * 2.6, hy + 3.5]], i % 2 ? furL : fur);
  // snow thrown up by the blow
  const info: Info = { shadow: { cx: c.cx + (mo.push + 1) * s * 0.7, cy: c.foot, rx: 17 * s, ry: Math.max(2, 3.2 * s * 0.5) }, tall: true };
  if (atk && mo.a >= 1) info.after = (f) => { for (let i = 0; i < 12; i++) { const x = pen.X(22 + (rnd('ys', i) - 0.5) * 20), y = pen.Y(-3 - rnd('ys', i + 9) * (mo.a === 1 ? 14 : 8)); blend(f, x, y, '#ffffff', 0.9); blend(f, x + 1, y, '#d8e4f0', 0.7); } };
  return info;
}

// ── the glow mutant ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function mutant(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 34, (c.w * 0.92) / 50);
  const pen = c.pen(s).at(mo.push * 0.7 - 4, mo.bob);
  const skin = p.mat(L.main, { deep: true }), skinD = p.mat(dark(L.main, 0.3)), skinL = p.mat(light(L.main, 0.25)), ol = p.mat(dark(L.main, 0.6), { flat: true });
  const glow = p.mat(L.second, { flat: true }), glowL = p.mat(light(L.second, 0.5), { flat: true }), eye = p.mat(L.eye, { flat: true }), ink = p.mat('#101418', { flat: true });
  const rag = p.mat('#4a463e', { deep: true }), ragD = p.mat('#2e2c28');
  const atk = mo.pose === 'attack', lean = atk ? [-2, 3, 1][mo.a] : mo.dead ? 2 : 1.5;
  const pulse = mo.pose === 'idle' ? mo.breath : mo.f % 2;
  // legs: ragged trousers, bare feet
  const leg = (x: number, o: number, far: boolean): void => {
    const sw = mo.pose === 'walk' ? Math.sin(mo.ph + o) * 2.4 : 0, up = mo.pose === 'walk' ? Math.max(0, Math.cos(mo.ph + o)) * 1.8 : 0;
    pen.chain([[x, -15], [x + sw * 0.5, -8 - up], [x + sw, -1.6 - up]], [4.2, 3.6, 3], ol); pen.chain([[x, -15], [x + sw * 0.5, -8 - up], [x + sw, -1.6 - up]], [3.4, 2.8, 2.2], far ? ragD : rag);
    pen.rect(x + sw - 1.4, -1.8 - up, 5, 1.8, skinD);
    for (let i = 0; i < 3; i++) pen.px(x + sw - 0.4 + i * 1.6, -4 - up, skin);
  };
  leg(-3, Math.PI, true); leg(3, 0, false);
  // a thin hunched body, the ribs showing, the glow of blue-green veins
  const bx = 1 + lean * 0.4;
  pen.chain([[0, -14], [bx, -22], [bx + 3.4, -28]], [5.6, 5.6, 4.6], ol); pen.chain([[0, -14], [bx, -22], [bx + 3.4, -28]], [4.8, 4.8, 3.8], skin);
  pen.ell(bx + 0.4, -22, 4.2, 5.6, skinL);
  for (let i = 0; i < 4; i++) pen.line([bx - 2.4, -26 + i * 2.4], [bx + 3, -25 + i * 2.4], skinD, 0.7);
  pen.line([bx - 1.6, -26], [bx, -16], glow, 0.8); pen.line([bx + 2.4, -27], [bx + 1.6, -17], glow, 0.8); pen.line([bx - 3, -20], [bx + 4, -22], glow, 0.7);
  pen.poly([[-4.6, -15], [5, -15], [4.6, -9], [-4, -8]], rag);
  // the small arm, hanging, and the great one: twice the size, dragged on the floor
  const hand: Pt = [bx - 1 + (mo.pose === 'walk' ? Math.sin(mo.ph) * 2 : 0), -12];
  pen.chain([[bx - 1, -26], [bx - 3, -19], hand], [2, 1.6, 1.4], ol); pen.chain([[bx - 1, -26], [bx - 3, -19], hand], [1.4, 1.1, 1], skin);
  const sh: Pt = [bx + 4, -26];
  const slam = atk ? [[-2, -36], [19, -3], [12, -10]][mo.a] : mo.pose === 'idle' ? [22 + pulse * 0.8, -4] : mo.pose === 'walk' ? [22 + Math.sin(mo.ph) * 2, -4 - Math.max(0, Math.cos(mo.ph))] : [14, mo.dead ? -3 : -9];
  const F: Pt = [slam[0], slam[1]];
  const E = ik(sh, F, 16, 15.5, -1);
  pen.chain([sh, E, F], [7.4, 7, 6.6], ol); pen.chain([sh, E, F], [6.6, 6.2, 5.8], skin);
  pen.chain([[sh[0] - 1, sh[1] - 2], [E[0] - 1, E[1] - 2.2], [F[0] - 1.4, F[1] - 2.4]], [2.4, 2.4, 2.4], skinL);
  pen.ell(F[0] + 1, F[1] + 2, 7, 5.8, ol); pen.ell(F[0] + 1, F[1] + 2, 6.2, 5, skin);
  for (const dx of [-3.4, -0.4, 2.6, 5.4]) pen.line([F[0] + dx, F[1] + 4], [F[0] + dx + 0.4, F[1] + 7], ol, 0.8);
  // veins of light over the swollen arm, brightest at the knuckles
  const v = (a: Pt, b: Pt, m: number) => pen.line(a, b, m, 0.9);
  v([sh[0] - 1, sh[1] + 1], [E[0] + 1, E[1] - 1], glow); v([E[0] + 1, E[1] - 1], [F[0] - 1, F[1] - 1], glow); v([sh[0] + 3, sh[1] + 3], [E[0] + 3, E[1] + 1], glow);
  v([E[0] - 3, E[1] + 3], [F[0] + 3, F[1] - 2], glowL); v([F[0] - 3, F[1] - 2], [F[0] + 4, F[1] + 2], glow); v([F[0], F[1] - 4], [F[0] + 4, F[1] - 1], glowL);
  // the head: bald, jaw hanging, eyes white and burning, drool that glows
  const hx = bx + 6, hy = -31 + (atk && mo.a === 0 ? -1 : 0) + (mo.dead ? 4 : 0);
  pen.ell(hx, hy, 4.8, 4.8, ol); pen.ell(hx, hy, 4.1, 4.1, skin);
  pen.poly([[hx - 1, hy + 2], [hx + 4.4, hy + 2.4], [hx + 3.6, hy + 5 + mo.open * 2], [hx - 0.4, hy + 4.4 + mo.open * 2]], skinD);
  pen.dot(hx + 2.4, hy - 0.6, mo.dead ? ink : eye, 1.9); pen.dot(hx - 0.6, hy - 0.4, mo.dead ? ink : eye, 1.5);
  pen.line([hx + 2, hy + 4], [hx + 1.6, hy + 9 + pulse], glow, 0.8);
  pen.line([hx - 3, hy - 3], [hx + 2, hy - 4.4], glow, 0.6);
  return {
    shadow: { cx: c.cx + (mo.push + 3) * s, cy: c.foot, rx: 17 * s, ry: Math.max(2, 3 * s * 0.5) }, tall: true,
    after: (f) => { // the glow bleeds a little into the air round the arm
      const g = [pen.X(F[0] + 1), pen.Y(F[1] + 2)];
      ovEll(f, g[0], g[1], 11 * s, 8 * s, L.second, 0.16 + 0.06 * pulse);
    },
  };
}

// ── the fog tentacle ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function tentacle(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 90, (c.w * 0.92) / 72);
  const pen = c.pen(s).at(0, 0);
  const skin = p.mat(L.main, { deep: true }), skinD = p.mat(L.second), skinL = p.mat('#fbfbff'), ol = p.mat(dark(L.second, 0.42), { flat: true }), glow = p.mat('#ffffff', { flat: true });
  const atk = mo.pose === 'attack', k = atk ? [0.1, 1, 0.5][mo.a] : 0;
  const sway = mo.pose === 'idle' ? mo.breath * 0.9 : mo.pose === 'walk' ? Math.sin(mo.ph) : 0;
  const stalk = (x0: number, len: number, lean: number, phase: number, thick: number, lash: number): Pt[] => spine(16, (u) => [x0 + lean * u * u * 14 + Math.sin(u * 4.4 + phase + sway) * (3 + u * 6) + lash * u * u * (30 - 14 * lean), -u * len + lash * u * u * (len * 0.55)]);
  const draw = (pts: Pt[], thick: number, far: boolean): void => {
    const rad = pts.map((_, i) => Math.max(0.7, thick * (1 - (i / 16) * 0.93) ** 1.15));
    tube(pen, pts, rad, far ? skinD : skin, { ol, flip: false });
    // swirls of vapour: curved lights across the body, thin and pale toward the tip
    for (let i = 2; i < 15; i += 2) { const q = pts[i], r = rad[i]; pen.line([q[0] - r * 0.5, q[1] - 1], [q[0] + r * 0.5, q[1] - 2.4 + (i % 4) * 0.6], skinL, 0.8); if (i % 4 === 0) pen.px(q[0] + r * 0.2, q[1] + 1, skinD); }
    const tip = pts[16]; pen.dot(tip[0], tip[1], glow, 1.6);
  };
  // two shorter stalks behind, one great stalk in front
  draw(stalk(-22, 48, -0.4, 1.7, 5, 0), 5.4, true);
  draw(stalk(24, 54, 0.4, 3.1, 5.6, atk ? k * 0.6 : 0), 5.6, true);
  const main = stalk(0, 80, 0.2, 0, 8, atk ? k : 0);
  draw(main, 8, false);
  void mix;
  return {
    shadow: { cx: c.cx, cy: c.foot, rx: 32 * s, ry: Math.max(2, 2.4 * s * 0.5) }, tall: false,
    after: (f) => { // the wall of fog the stalks come out of: soft, wide, no outline
      for (let i = 0; i < 14; i++) { const x = pen.X(-40 + i * 6.2 + (rnd('ft', i) - 0.5) * 4), y = pen.Y(-1 - (i % 3) * 2.2); ovPuff(f, x, y, (7 + (i % 3) * 2.4) * s, '#eef0f8', 0.9); }
      for (let i = 0; i < 6; i++) ovEll(f, pen.X(-34 + i * 14 + (mo.f % 2) * 2), pen.Y(-7 - (i % 2) * 3), 9 * s, 3 * s, '#ffffff', 0.35);
    },
  };
}

// ── the manticore ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function manticore(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 40, (c.w * 0.95) / 74);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const fur = p.mat(L.main, { deep: true }), furD = p.mat(dark(L.main, 0.3)), furL = p.mat(light(L.main, 0.22)), belly = p.mat(light(L.main, 0.28)), ol = p.mat(dark(L.main, 0.6), { flat: true });
  const hair = p.mat('#b8b8bc', { deep: true }), hairD = p.mat('#8a8a90'), skinM = p.mat('#c8a890', { deep: true }), skinD = p.mat('#a08068');
  const mem = p.mat(L.second, { deep: true }), memD = p.mat(dark(L.second, 0.25)), bone = p.mat(light(L.second, 0.3));
  const eye = p.mat(L.eye, { flat: true }), ink = p.mat('#14121a', { flat: true }), tooth = p.mat('#f2ecdc', { flat: true }), venom = p.mat('#9ae04a', { flat: true }), sting = p.mat('#e8e0c8', { flat: true });
  const walking = mo.pose === 'walk', atk = mo.pose === 'attack';
  const lunge = atk ? [0, 1, 0.3][mo.a] : 0;
  const by = -22;
  const step = (o: number): Pt => walking ? [Math.sin(mo.ph + o) * 3.4, -Math.max(0, Math.cos(mo.ph + o)) * 2.6] : [0, 0];
  const lg = (x: number, o: number, far: boolean, hind: boolean): void => {
    const [dx, dy] = step(o), hip: Pt = [x, by + 4], foot: Pt = [x + 1 + dx, dy];
    const mid: Pt = hind ? ik(hip, [foot[0] - 1, foot[1] - 5], 8.6, 8, 1) : ik(hip, [foot[0], foot[1] - 1], 9.4, 9.4, -1);
    const pts: Pt[] = hind ? [hip, mid, [foot[0] - 1, foot[1] - 5], foot] : [hip, mid, [foot[0], foot[1] - 1]];
    const rs = hind ? [4.4, 3.4, 2.2, 2] : [4, 3, 2.4];
    pen.chain(pts, rs.map((r) => r + 0.8), ol); pen.chain(pts, rs, far ? furD : fur);
    paw(pen, foot[0], foot[1], 1.9, far ? furD : fur, ol, tooth);
  };
  lg(-17, Math.PI, true, true); lg(12, 0.4, true, false);
  // a scorpion's tail, arched over the back, ringed, with a barb that drips
  const q = atk ? [0.05, 1, 0.45][mo.a] : mo.pose === 'idle' ? 0.2 * mo.breath : 0;
  const tail: Pt[] = [[-22, by - 2], [-31, by - 7 + q * 2], [-36, by - 17 + q * 4], [-33 + q * 30, by - 28 + q * 14], [-21 + q * 50, by - 33 + q * 20], [-10 + q * 62, by - 30 + q * 26]];
  const tr = [3.6, 3.2, 2.8, 2.5, 2.2, 1.8];
  pen.chain(tail, tr.map((r) => r + 0.8), ol); pen.chain(tail, tr, fur);
  for (let i = 1; i < tail.length; i++) pen.line([tail[i][0] - 0.8, tail[i][1] - tr[i]], [tail[i][0] + 0.8, tail[i][1] + tr[i]], furD, 0.9);
  const tp = tail[5];
  pen.poly([[tp[0] + 1, tp[1] - 1.4], [tp[0] + 7, tp[1] + 3.4 + q * 2], [tp[0] + 1, tp[1] + 2]], sting);
  pen.dot(tp[0] + 4, tp[1] + 2.6 + q, venom, 1.4);
  // the body: a lion's, deep in the chest, narrow at the loins, a pale belly
  pen.chain([[-20, by + 1], [-6, by], [8, by - 1]], [7, 8.6, 9.4], ol); pen.chain([[-20, by + 1], [-6, by], [8, by - 1]], [6.2, 7.8, 8.6], fur);
  pen.chain([[-14, by + 5], [4, by + 6]], [3, 3.2], belly);
  for (let i = 0; i < 6; i++) pen.line([-14 + i * 4.4, by - 5], [-13 + i * 4.4, by + 2], furD, 0.7);
  // bat wings folded on the shoulders, short
  const wi = (up: number, far: boolean) => wing(pen, [far ? 2 : 6, by - 7], { span: 22, up, mem: far ? memD : mem, memD: memD, memL: mem, bone: bone, bone2: bone, ol, hip: [-8, by - 6], fingers: 3 });
  wi(Math.max(0.1, 0.7 - 0.4 * (atk ? mo.strike : 0)), true);
  lg(-12, 0.6 + Math.PI * 0.8, false, true); lg(17, Math.PI * 0.8, false, false);
  wi(0.9 + (atk ? 0.1 * mo.strike : 0), false);
  // the mane, ruddy brown, and over it an old man's face: grey hair, a long beard, a cunning yellow eye, three rows of teeth
  const hx = 20 + lunge * 7, hy = by - 11 + lunge * 3 + (mo.dead ? 6 : 0);
  pen.chain([[8, by - 3], [hx - 2, hy + 2]], [9, 7.4], ol); pen.chain([[8, by - 3], [hx - 2, hy + 2]], [8.2, 6.6], fur);
  for (let i = 0; i < 9; i++) { const a = -Math.PI * 0.95 + i * 0.5, r = 8.6; pen.poly([[hx + Math.cos(a) * 5, hy + Math.sin(a) * 5], [hx + Math.cos(a) * (r + 3 + (i % 2) * 1.6), hy + Math.sin(a) * (r + 3 + (i % 2) * 1.6)], [hx + Math.cos(a + 0.5) * 5, hy + Math.sin(a + 0.5) * 5]], i % 2 ? furD : p.mat(L.second)); }
  pen.ell(hx, hy, 7.6, 7.4, ol); pen.ell(hx, hy, 6.8, 6.6, hairD);
  pen.ell(hx + 1.4, hy + 0.6, 5.2, 5.4, skinM);
  pen.poly([[hx - 3, hy - 5], [hx + 5, hy - 5.6], [hx + 5.4, hy - 3], [hx - 3.4, hy - 2.4]], hair);
  pen.line([hx + 1, hy - 3], [hx + 5, hy - 3.6], hairD, 1);
  // the nose and a deep-set eye
  pen.poly([[hx + 5, hy - 1], [hx + 8.4, hy + 1.6], [hx + 5.2, hy + 2.2]], skinD);
  pen.dot(hx + 3.4, hy - 1.4, mo.dead ? ink : eye, 1.7); pen.px(hx + 3.8, hy - 1.4, ink);
  // the mouth, wide, with rows of teeth; the beard falls from the chin
  const jaw = mo.open * 3 + (atk && mo.a === 1 ? 1.6 : 0);
  pen.rect(hx + 0.4, hy + 2.8, 6, 1.2 + jaw, ink);
  for (let r = 0; r < 3; r++) pen.rect(hx + 0.8 + r * 0.4, hy + 2.8 + r * 0.5, 5 - r * 0.8, 0.8, tooth);
  pen.poly([[hx - 2.6, hy + 4], [hx + 6, hy + 4.4 + jaw], [hx + 2.4, hy + 14 + jaw + Math.sin(mo.ph + mo.f) * 0.8]], hair);
  pen.poly([[hx - 1, hy + 5], [hx + 3.6, hy + 5.4 + jaw], [hx + 1.4, hy + 11 + jaw]], hairD);
  void rnd;
  return { shadow: { cx: c.cx + (mo.push + 1) * s, cy: c.foot, rx: 27 * s, ry: Math.max(2, 3 * s * 0.5) }, tall: false };
}
