// Made things: the stone golem and its cousins (the one carrying a piece of a floating island, the guardian with its shield and hammer, the
// company's war automaton) and the mimic, a chest with a tongue.
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { dark, light, mix, rnd, type Ctx, type Info, type Pen } from './kit';

export function paintConstruct(c: Ctx<EnemyLook>): Info {
  if (c.L.form === 'mimic') return mimic(c);
  return golem(c);
}

type Arm = 'fist' | 'shield' | 'hammer' | 'gun';

function golem(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const form = L.form;
  const machine = form === 'automaton', guardian = form === 'guardian', debris = form === 'debris';
  const s = Math.min(c.px / 36, (c.w * 0.9) / 34);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const stone = p.mat(L.main, { deep: true }), stoneD = p.mat(dark(L.main, 0.3)), stoneL = p.mat(light(L.main, 0.2)), second = p.mat(L.second, { deep: true });
  const rune = p.mat(L.eye, { flat: true }), runeDim = p.mat(mix(L.eye, L.main, 0.6), { flat: true }), ink = p.mat('#101018', { flat: true });
  const alive = !mo.dead;
  const blink = mo.pose === 'idle' ? mo.breath : mo.f % 2;
  const walk = mo.pose === 'walk', att = mo.pose === 'attack';
  const sw = walk ? 2.4 * Math.sin(mo.ph) : 0;
  const hip = -13;
  // legs: pillars
  const leg = (x: number, o: number, k: number, lift: number) => { pen.rect(x - 3 + o * 0.3, hip, 6.2, 12 - lift, k); pen.rect(x - 4.2 + o * 0.6, -3 - lift, 8.4, 3, k); };
  leg(-5, -sw, stoneD, walk ? Math.max(0, -Math.cos(mo.ph)) * 1.5 : 0); leg(5.5, sw, stone, walk ? Math.max(0, Math.cos(mo.ph)) * 1.5 : 0);
  // far arm
  const armKind: Arm = machine ? 'gun' : guardian ? 'shield' : 'fist';
  pen.cap([-9, -26], [-12, -14 + (blink ? 0.6 : 0)], 3.4, 3, stoneD); pen.rect(-15, -15, 6.4, 6, stoneD);
  if (guardian) {
    // a tower shield held up on the far arm, with a ring of runes
    pen.rect(-20, -34, 10, 26, second); pen.rect(-19, -33, 8, 24, stone);
    pen.line([-15, -31], [-15, -11], alive && blink ? rune : runeDim, 0.9); pen.line([-18.5, -22], [-11.5, -22], alive && blink ? rune : runeDim, 0.9);
  }
  // torso
  pen.rect(-10, -29, 20, 18, stone);
  pen.rect(-8, hip - 2, 16, 4, stoneD);
  pen.rect(-10, -29, 20, 3, stoneL);
  pen.rect(-3, -22, 7, 6, second);
  if (machine) {
    pen.rect(-9, -28, 18, 4, p.mat('#8a2a2a')); pen.rect(-3, -22, 7, 6, p.mat('#16161c'));
    for (let i = 0; i < 3; i++) pen.dot(-6 + i * 6, -14, p.mat('#c8603a', { flat: true }), 1.4);
    if (att || mo.f % 2) for (let i = 0; i < 2; i++) pen.dot(-12 - i * 1.6, -32 - i * 3, p.mat('#a8a8b0', { flat: true, alpha: 0.6 }), 1.6);
  } else {
    // crack lines and glowing runes (the runes die first)
    for (let i = 0; i < 4; i++) { const x = -8 + rnd(L.id, i) * 16, y = -28 + rnd(L.id, i + 3) * 14; pen.line([x, y], [x + 2, y + 4], stoneD, 0.8); }
    const rm = alive ? (blink || mo.pose === 'attack' ? rune : runeDim) : ink;
    for (const [x, y] of [[-6, -26], [3, -27], [-7, -17], [6, -17], [0, -20]] as const) { pen.rect(x, y, 3, 0.9, rm); pen.rect(x, y, 0.9, 3, rm); }
  }
  if (debris) {
    // a piece of a floating island on the shoulder: grass, a stair sticking out, dust falling from the rim
    pen.poly([[-12, -27], [-6, -35], [4, -37], [10, -31], [9, -27]], p.mat('#5a6a50', { deep: true }));
    pen.poly([[-12, -27], [-10, -24], [-2, -23], [6, -24], [9, -27]], stoneD);
    pen.rect(-8, -37.5, 14, 2, p.mat('#7a9a50'));
    for (let i = 0; i < 4; i++) pen.rect(-10 + i * 2.6, -36 + i * 2, 2.6, 2, stoneL);
    for (let i = 0; i < 4; i++) pen.dot(-9 + i * 5, -23 + ((mo.f * 2 + i * 2) % 7) * 1.4, p.mat('#9a9a94', { flat: true }), 1);
  }
  // head: a block with one slit of light
  const hy = -34 + (att ? 0.6 * mo.strike : 0);
  pen.rect(-4, hy - 2, 10, 8, stone); pen.rect(-4, hy - 2, 10, 2, stoneL);
  if (machine) { pen.rect(0, hy, 6, 3, p.mat('#16161c')); pen.dot(3, hy + 1.5, alive ? rune : ink, 2.6); }
  else { pen.rect(0.4, hy + 1.6, 5.4, 1.4, alive ? rune : ink); }
  // near arm: a fist raised and brought down, a hammer, a gun
  const reach = att ? [0.0, 1, 0.5][mo.a] : 0;
  const sh: [number, number] = [9, -26];
  let hand: [number, number] = att ? [sh[0] + 2 - (mo.a === 0 ? 4 : -9 * reach), mo.a === 0 ? -42 : mo.a === 1 ? -8 : -20] : walk ? [13 + sw, -13] : [13, -13 + (blink ? 0.6 : 0)];
  if (armKind === 'gun') hand = att ? [sh[0] + 9, -22] : [sh[0] + 6, -16];
  pen.cap(sh, hand, 3.6, 3.2, stone);
  if (armKind === 'gun') {
    // a rotary gun: barrels in a ring, a muzzle flash at the strike
    pen.rect(hand[0] - 2, hand[1] - 3, 10, 6, p.mat('#16161c'));
    for (let i = 0; i < 3; i++) pen.rect(hand[0] + 7, hand[1] - 2.4 + i * 2.2, 8, 1.1, p.mat('#a0a0a8'));
    if (mo.a === 1) { for (let i = 0; i < 5; i++) pen.dot(hand[0] + 17 + i * 3, hand[1] + (i % 2) - 0.5, p.mat('#ffd060', { flat: true }), 1.8); pen.poly([[hand[0] + 15, hand[1] - 3], [hand[0] + 21, hand[1]], [hand[0] + 15, hand[1] + 3]], p.mat('#fff0a0', { flat: true })); }
    pen.rect(-10, -37, 8, 6, p.mat('#16161c')); for (let i = 0; i < 2; i++) pen.dot(-8 + i * 3.6, -34, p.mat('#8a2a2a', { flat: true }), 2);
  } else if (guardian) {
    const ang = att ? (mo.a === 0 ? -2.2 : mo.a === 1 ? 0.9 : -0.2) : -1.2;
    const tip: [number, number] = [hand[0] + Math.cos(ang) * 20, hand[1] + Math.sin(ang) * 20];
    pen.line(hand, tip, p.mat('#6a5232'), 1.6);
    pen.rect(tip[0] - 5, tip[1] - 4, 10, 8, stoneD); pen.rect(tip[0] - 5, tip[1] - 4, 10, 2, stoneL);
    pen.dot(tip[0], tip[1], alive ? rune : ink, 1.6);
    pen.rect(hand[0] - 3, hand[1] - 3, 6.4, 6, stone);
  } else pen.rect(hand[0] - 3.4, hand[1] - 3, 7.4, 7, stone);
  if (att && mo.a === 1 && armKind === 'fist') for (let i = 0; i < 6; i++) pen.dot(hand[0] - 6 + i * 3.5, -1 - (i % 2) * 1.6, p.mat('#a09a88', { flat: true }), 1.5);
  void (pen as Pen);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 12 * s, ry: Math.max(1.8, 2.4 * s * 0.5) }, tall: true };
}

function mimic(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 15, (c.w * 0.9) / 24);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const wood = p.mat(L.main, { deep: true }), woodD = p.mat(dark(L.main, 0.3)), gold = p.mat(L.second, { deep: true }), tongue = p.mat(L.eye, { deep: true }), tooth = p.mat('#ece4cc', { flat: true }), mouth = p.mat('#2a0e12', { flat: true });
  const open = mo.pose === 'attack' ? [0.7, 1, 0.3][mo.a] : mo.pose === 'hurt' ? 0.6 : mo.pose === 'idle' ? 0.12 * mo.breath : mo.pose === 'walk' ? 0.25 + 0.2 * Math.sin(mo.ph) : mo.dead ? 1 : 0;
  const hop = mo.pose === 'walk' ? Math.abs(Math.sin(mo.ph / 2)) * 3 : 0;
  const P = pen.at(0, -hop);
  // little feet
  P.rect(-8, -1.4, 3, 1.6, woodD); P.rect(5, -1.4, 3, 1.6, woodD);
  // the chest, the inside of the mouth, a row of teeth, the tongue
  P.rect(-9, -10, 18, 9, wood);
  P.rect(-9, -3.4, 18, 1.4, gold);
  P.rect(-8, -10 - open * 1.2, 16, 2.2, mouth);
  const lidA = open * 7;
  P.poly([[-9, -10 - open], [-9, -10 - open * 2 - 2], [-7 - open * 2, -17 - lidA], [9 + open * 1.5, -17 - lidA], [9, -10 - open * 2 - 2], [9, -10 - open]], wood);
  P.rect(-9, -10 - open * 1.2, 18, 1.3, gold);
  P.rect(-1.6, -9.8, 3.2, 3.6, gold); P.dot(0, -8.2, mouth, 1);
  for (let i = 0; i < 5; i++) { P.poly([[-7 + i * 3.4, -10 - open * 1.2], [-6 + i * 3.4, -10 - open * 1.2 - 1.8], [-5 + i * 3.4, -10 - open * 1.2]], tooth); if (open > 0.2) P.poly([[-6.4 + i * 3.4, -8], [-5.4 + i * 3.4, -9.6 - open * 0.4], [-4.4 + i * 3.4, -8]], tooth); }
  // the tongue lolls out; it lashes forward at the strike
  const lash = mo.pose === 'attack' ? [0.3, 1, 0.5][mo.a] : 0;
  const pts: [number, number][] = [[2, -8.4], [6 + lash * 5, -6 + lash * 1], [8 + lash * 13, -3.5 + Math.sin(mo.ph) - lash * 4 + (mo.dead ? 2 : 0)]];
  P.chain(pts, [1.5, 1.3, 1.1], tongue);
  if (!mo.dead) P.dot(-5, -12 - lidA * 0.5, p.mat('#f0d060', { flat: true }), 1.2);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 9 * s, ry: Math.max(1.2, 1.4 * s) }, tall: false };
}
