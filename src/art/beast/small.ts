// Small bodies: the slimes (gel, a nucleus, no eyes), the kappa, the imps, the scorpion and the spider.
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { dark, light, mix, rnd, type Ctx, type Info } from './kit';

export function paintSmall(c: Ctx<EnemyLook>): Info {
  switch (c.L.form) {
    case 'slime': case 'lava': return slime(c);
    case 'kappa': return kappa(c);
    case 'imp': return imp(c);
    case 'scorpion': return scorpion(c);
    case 'spider': return spider(c);
    default: return slime(c);
  }
}

// ── slime: gel with a beating nucleus. No eyes, no mouth (04-enemies.md: the slime has none) ─────────────────────────────────────────
function slime(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c, lava = L.form === 'lava';
  const s = Math.min(c.px / 11, (c.w * 0.9) / 26);
  const pen = c.pen(s);
  const gel = p.mat(L.main, { alpha: lava ? 1 : 0.88, deep: true }), shine = p.mat(light(L.main, 0.55), { flat: true, alpha: 0.9 });
  const core = p.mat(L.eye, { flat: true }), crust = p.mat(L.second, { deep: true });
  const bit = p.mat(lava ? '#ffb040' : L.second, { flat: true }), bone = p.mat('#e8e0c8', { flat: true });
  const hop = mo.pose === 'walk' ? Math.abs(Math.sin(mo.ph / 2)) : 0;
  const stretch = mo.pose === 'attack' ? mo.strike : 0;
  const breathe = mo.pose === 'idle' ? mo.breath : 0;
  const w = 8.6 + breathe * 0.8 + stretch * 3.4 - hop * 1.2, h = 10.5 - breathe * 1.1 - stretch * 3 + hop * 3;
  const x0 = stretch * 3 + mo.push * 0.3, lift = hop * 3;
  pen.ell(x0, -h * 0.5 - lift, w, h * 0.52, gel);
  pen.rect(x0 - w * 0.98, -h * 0.4 - lift, w * 1.96, h * 0.4, gel);
  if (stretch > 0.5) pen.cap([x0 + w * 0.6, -h * 0.4], [x0 + w + 5, -h * 0.25], 3, 1.4, gel);
  if (lava) {
    for (let i = 0; i < 4; i++) pen.ell(x0 - w * 0.5 + i * (w * 0.42), -h * 0.85 - lift, 2.2 + (i % 2), 1.1, crust);
    for (let i = 0; i < 3; i++) pen.dot(x0 - 4 + i * 4.5, -h - lift - 1.5 - ((mo.f + i) % 2) * 1.6 - i * 0.4, bit, 1);
  } else {
    pen.rect(x0 - w * 0.55, -h * 0.82 - lift, 3, 1.3, shine);
    pen.rect(x0 - w * 0.62, -h * 0.62 - lift, 1.4, 2, shine);
    for (let i = 0; i < 5; i++) {
      const bx = x0 + (rnd(L.id, i) - 0.5) * w * 1.3, by = -h * 0.2 - rnd(L.id, i + 9) * h * 0.4 - lift;
      if (i % 2) pen.rect(bx, by, 2, 0.9, bone); else pen.dot(bx, by, bit, 1.4);
    }
  }
  // the nucleus beats slowly
  const beat = mo.pose === 'idle' ? 1.6 + 0.5 * mo.breath : 1.9;
  pen.ell(x0 + 0.5, -h * 0.5 - lift, beat, beat * 0.85, core);
  return { shadow: { cx: c.cx + x0 * s, cy: c.foot, rx: (w + 1) * s * 0.85, ry: Math.max(1.4, 2 * s * 0.5) }, tall: false };
}

// ── kappa: a green boy-shaped thing with a shell, a beak and a dish of water on its head; bows before it fights ──────────────────────
function kappa(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 18, (c.w * 0.9) / 24);
  const pen = c.pen(s).at(mo.push * 0.5, mo.bob);
  const skin = p.mat(L.main, { deep: true }), shell = p.mat(L.second, { deep: true }), shellL = p.mat(light(L.second, 0.3));
  const water = p.mat(L.eye, { flat: true }), beak = p.mat('#d8b848'), white = p.mat('#f0ecd8', { flat: true }), ink = p.mat('#15131a', { flat: true });
  const bow = mo.pose === 'idle' ? 0.7 + 0.3 * mo.breath : mo.pose === 'attack' ? 0.4 + 0.8 * mo.strike : mo.pose === 'walk' ? 0.5 : mo.dead ? 1 : 0.6;
  const sw = mo.pose === 'walk' ? 2 * Math.sin(mo.ph) : 0;
  // legs
  pen.cap([-2, -6], [-2 - sw, -0.6], 1.5, 1.3, p.mat(dark(L.main, 0.25)));
  pen.cap([2.5, -6], [2.5 + sw, -0.6], 1.6, 1.3, skin);
  pen.rect(-3.5 - sw, -1.2, 3, 1.2, skin); pen.rect(1.5 + sw, -1.2, 3, 1.2, skin);
  // shell on the back
  pen.ell(-3 - bow * 1.2, -9.5 - bow * 0.4, 5.3, 4.8, shell);
  pen.line([-6, -12], [-1, -7], shellL, 0.8); pen.line([-8, -9], [-3, -6], shellL, 0.8);
  // torso leans forward by the bow; the head hangs low
  const hx = 3 + bow * 4.2, hy = -13 + bow * 3.5;
  pen.cap([0, -8], [hx - 1, hy + 2], 3.2, 2.6, skin);
  pen.ell(hx, hy, 3.7, 3.4, skin);
  pen.poly([[hx + 2.5, hy - 0.4], [hx + 6.5 + (mo.open > 0.6 ? 1 : 0), hy + 0.6], [hx + 2.5, hy + 2]], beak);
  // the dish of water on the head (it spills at the death)
  const dish = mo.dead ? p.mat(dark(L.eye, 0.4), { flat: true }) : water;
  pen.ell(hx - 0.6, hy - 3.3, 2.7, 1, dish);
  if (!mo.dead) { pen.dot(hx - 1.2, hy - 4.6, water, 1); if (mo.pose === 'attack') pen.dot(hx + 2.5, hy - 6, water, 1); }
  else pen.dot(hx + 3, hy + 5 + mo.die * 2, water, 1.5);
  pen.ell(hx + 1.1, hy - 0.6, 1.2, 1.3, white); pen.dot(hx + 1.6, hy - 0.5, mo.dead ? p.mat(dark(L.main, 0.3), { flat: true }) : ink, 1);
  // arms: they hang, and swing the head's way at the butt
  pen.cap([1.5, -7.5], [3 + bow * 3, -3.8], 1.3, 1.1, skin);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 8 * s, ry: Math.max(1.4, 1.7 * s) }, tall: true };
}

// ── imp: a small red thing on bat wings with a fork of fire ───────────────────────────────────────────────────────────────────────────
function imp(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 16, (c.w * 0.9) / 20);
  const flap = mo.pose === 'walk' || mo.pose === 'idle' ? mo.f % 2 : mo.pose === 'attack' ? [0, 1, 0][mo.f] : 0;
  const hover = mo.pose === 'idle' ? 0 : 0;
  const pen = c.pen(s).at(mo.push * 0.7, mo.bob + hover - 3);
  const skin = p.mat(L.main, { deep: true }), wingM = p.mat(L.second), wing = p.mat(dark(L.main, 0.2)), eye = p.mat(L.eye, { flat: true }), horn = p.mat('#2a1a1a');
  const fire = p.mat(L.second, { flat: true }), shaft = p.mat('#4a3a32');
  // wings
  const wy = flap ? -17 : -12;
  pen.poly([[-1, -10], [-11, wy], [-9, wy + 5], [-6, wy + 4], [-5, wy + 8], [-1, -6]], wing);
  pen.poly([[1, -10], [9, wy + 1], [7, wy + 5], [4, wy + 5], [3, wy + 8], [0.5, -6]], wing);
  pen.line([-1, -9], [-10, wy + 0.8], wingM, 0.8);
  // body, legs, tail
  pen.ell(0, -8, 3.2, 4, skin);
  pen.line([-1, -4.5], [-1.5, -0.8], skin, 1.7); pen.line([1.5, -4.5], [2, -0.8], skin, 1.7);
  pen.cap([-2.5, -6.5], [-8, -4 + (mo.f % 2)], 0.9, 0.5, skin); pen.poly([[-8, -4.5], [-10, -3], [-7.4, -2.6]], horn);
  pen.ell(1, -13.2, 3.1, 2.8, skin);
  pen.poly([[-0.6, -15.2], [-1.4, -18.6], [0.6, -15.8]], horn); pen.poly([[2.2, -15.2], [3.4, -18.2], [3.4, -15.2]], horn);
  pen.dot(2.2, -13.6, eye, 1.4); pen.rect(1.2, -11.5, 2.4 + mo.open, 0.8, p.mat('#1a0a0a', { flat: true }));
  // the fork: held forward, with a little fire at the tips at the strike
  const reach = mo.pose === 'attack' ? 3 + mo.strike * 4 : 1;
  pen.line([3, -7], [5 + reach, -9.5], skin, 1.2);
  pen.line([4, -4], [4 + reach + 2, -13.5], shaft, 0.9);
  pen.poly([[4 + reach + 2, -13.5], [4 + reach + 1, -16], [4 + reach + 2.4, -15], [4 + reach + 3.6, -16], [4 + reach + 3.2, -13.2]], p.mat('#8a8a90'));
  if (mo.a === 1) { pen.dot(4 + reach + 3, -17.5, fire, 1.4); pen.dot(4 + reach + 1.5, -17, fire, 1); }
  return { shadow: { cx: c.cx, cy: c.foot, rx: 5 * s, ry: Math.max(1.2, 1.2 * s) }, tall: true };
}

// ── scorpion: iron-grey, claws forward, tail high ──────────────────────────────────────────────────────────────────────────────────────
function scorpion(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 10, (c.w * 0.92) / 40);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const shell = p.mat(L.main, { deep: true }), shellD = p.mat(dark(L.main, 0.3)), plate = p.mat(L.second), eye = p.mat('#e8e0c0', { flat: true });
  const q = mo.pose === 'attack' ? mo.strike : 0;
  const walk = mo.pose === 'walk';
  // eight legs
  for (let i = 0; i < 4; i++) for (const far of [true, false]) {
    const x = -4 + i * 3.2, o = walk ? 2 * Math.sin(mo.ph + i * 1.3 + (far ? Math.PI : 0)) : 0;
    pen.line([x, -3], [x + (far ? -1.2 : 1.5) + o, -0.4], far ? shellD : shell, 0.9);
  }
  // body segments, tail arching up and over
  pen.ell(0, -4, 7.5, 3.3, shell);
  for (let i = 0; i < 4; i++) pen.line([-5 + i * 3.2, -6.8], [-5 + i * 3.2, -1.8], plate, 0.7);
  const tail: [number, number][] = [[-7, -5], [-11, -7], [-13, -12 + q * 4], [-10 + q * 11, -17 + q * 5], [-4 + q * 20, -17 + q * 8]];
  pen.chain(tail, [1.9, 1.7, 1.5, 1.4, 1.1], shell);
  for (const [tx, ty] of tail.slice(1, 4)) pen.line([tx - 1.2, ty - 0.5], [tx + 1.2, ty + 0.5], plate, 0.8);
  const sting = tail[4];
  pen.poly([[sting[0], sting[1] - 1], [sting[0] + 3.5, sting[1] + 1.6], [sting[0], sting[1] + 1.3]], p.mat('#c8c8d0', { flat: true }));
  // pincers: they snap shut at the strike
  const snap = mo.pose === 'attack' ? 1 - mo.strike * 0.9 : 1;
  pen.cap([6, -4.5], [10.5, -4.2 - q], 1.4, 1.1, shell);
  pen.cap([6, -3], [10.5, -2.4 + q], 1.3, 1.0, shellD);
  for (const dir of [-1, 1]) pen.cap([10.5, -4 + dir * 0.4 - q * 0.4], [14.5, -4 + dir * 1.9 * snap - q * 0.5], 1.6, 0.8, dir > 0 ? shellD : shell);
  pen.dot(7, -6.6, eye, 1); pen.dot(8.4, -6.4, eye, 0.9);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 15 * s, ry: Math.max(1.4, 1.5 * s) }, tall: false };
}

// ── spider: hangs from black web threads ───────────────────────────────────────────────────────────────────────────────────────────────
function spider(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 22, (c.w * 0.5) / 26);
  const sway = mo.pose === 'idle' ? mo.breath * 1.2 : 0;
  const drop = mo.pose === 'attack' ? 6 * mo.strike : 0;
  const pen = c.pen(s).at(mo.push * 0.6, mo.bob + sway - 20 + drop);
  const body = p.mat(L.main, { deep: true }), mark = p.mat(L.second, { flat: true }), legM = p.mat(dark(L.main, 0.15)), eye = p.mat(L.eye, { flat: true }), web = p.mat(mix(L.second, L.main, 0.55), { flat: true });
  // threads up to the fog ceiling and a few down to the ground
  const top = -(c.foot / s) - 10;
  pen.line([0, top], [0, -14], web, 0.5); pen.line([-6, top], [-1.5, -13], web, 0.4); pen.line([6, top], [2, -13], web, 0.4);
  const bend = mo.pose === 'walk' ? Math.sin(mo.ph) * 2 : mo.pose === 'attack' ? 3 * mo.strike : 0;
  for (let i = 0; i < 4; i++) for (const far of [true, false]) {
    const sx = (far ? -1 : 1) * 0.6, a = i * 0.55 - 0.7 + (far ? 0.25 : 0);
    const kx = sx + (far ? -1 : 1) * (5 + i * 0.4), ky = -12 + a * 2 - 2 + (i % 2) * 2 + bend * (far ? 0.4 : 0.8);
    const fx = kx + (far ? -1 : 1) * 2, fy = 9 + i * 2.2 + (far ? 1 : 0);
    const col = far ? legM : body;
    pen.line([sx, -9], [kx, ky], col, 1.1); pen.line([kx, ky], [fx + (far ? 0 : 2), fy + bend], col, 1.0);
  }
  pen.ell(0.5, -8, 5, 4.4, body); pen.ell(5.4, -9.4, 3.2, 2.9, body);
  pen.poly([[-1.5, -11], [0.5, -7.2], [2.5, -11]], mark); pen.rect(-1.5, -9, 4, 0.8, mark);
  for (const [ex, ey] of [[5.8, -10.8], [7.2, -10.3], [6, -9.2], [7.3, -8.9]] as const) pen.dot(ex, ey, mo.dead ? legM : eye, 0.9);
  if (mo.open > 0.5) { pen.line([8, -8], [9.4, -5.5], mark, 0.7); pen.line([6.6, -7.7], [7, -5.2], mark, 0.7); }
  return { shadow: { cx: c.cx, cy: c.foot, rx: 7 * s, ry: Math.max(1.4, 1.4 * s) }, tall: false };
}
