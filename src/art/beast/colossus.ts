// The XXL enemies are not sprites but background pieces the size of the scene (320 × 180), showing one part: the kraken's tentacles and eye,
// the titan's shoulder and fist, the gate of hell, the primordial engine's gears, the leviathan's coils and head (04-enemies.md "ขนาด" XXL).
// The pen's origin is the middle of the bottom edge; one unit is one art pixel.
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { dark, light, mix, rnd, type Ctx, type Info, type Pen } from './kit';
import type { Paint } from '../paint';

export function paintColossus(c: Ctx<any>): Info {
  const L = c.L as EnemyLook;
  switch (L.form) {
    case 'kraken': return kraken(c as Ctx<EnemyLook>);
    case 'titan': return titan(c as Ctx<EnemyLook>);
    case 'gate': return gate(c as Ctx<EnemyLook>);
    case 'engine': return engine(c as Ctx<EnemyLook>);
    default: return leviathan(c as Ctx<EnemyLook>);
  }
}

const spine = (n: number, f: (u: number) => [number, number]): [number, number][] => Array.from({ length: n + 1 }, (_, i) => f(i / n));
const info = (c: Ctx<EnemyLook>): Info => ({ shadow: { cx: c.cx, cy: c.foot, rx: 0.1, ry: 0.1 }, tall: false, ground: [c.cx, c.foot] });

function sea(pen: Pen, p: Paint, c: Ctx<EnemyLook>, y: number, tone: string): void {
  // the water: a dark band across the whole frame with slow wave lines
  const w = p.mat(tone, { deep: true }), wl = p.mat(light(tone, 0.25), { flat: true });
  pen.rect(-c.w / 2, y, c.w, 200, w);
  for (let i = 0; i < 12; i++) pen.rect(-150 + i * 27 + ((c.mo.f * 3 + i * 5) % 9), y + 3 + (i % 3) * 5, 10 + (i % 3) * 4, 1, wl);
}

function tentacle(pen: Pen, p: Paint, c: Ctx<EnemyLook>, x0: number, len: number, lean: number, sw: number, k: number, kd: number, suck: number, w0 = 13): void {
  const pts = spine(16, (u) => [x0 + lean * u * len * 0.3 + Math.sin(u * 5 + sw) * 12 * u + lean * 30 * u * u, -len * u + Math.cos(u * 3 + sw) * 6 * u]);
  pen.chain(pts, pts.map((_, i) => w0 * (1 - i / 16) ** 0.9 + 1.4), k);
  for (let i = 2; i < 16; i += 2) { const q = pts[i]; pen.dot(q[0] + 3, q[1] + 2, suck, 3); pen.dot(q[0] - 4, q[1] - 1, suck, 2.2); }
  const t = pts[16];
  pen.chain([t, [t[0] + 7 * (lean || 1), t[1] - 5], [t[0] + 9, t[1] + 3]], [1.4, 1.1, 0.8], kd);
}

function kraken(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const pen = c.pen(1);
  const temple = L.words.includes('temple');
  const k = p.mat(L.main, { deep: true }), kd = p.mat(dark(L.main, 0.3)), suck = p.mat(L.second, { flat: true }), eye = p.mat(L.eye, { flat: true }), ink = p.mat('#06060c', { flat: true });
  const strike = mo.pose === 'attack' ? [0.2, 1, 0.5][mo.a] : 0;
  const sw = mo.pose === 'idle' ? mo.breath * 1.4 : mo.ph + mo.a;
  if (temple) {
    // the basin of a temple: stone rim, tide water, one tentacle laid across it
    const rim = p.mat('#7a7a82', { deep: true }), rimD = p.mat('#4a4a54', { deep: true });
    pen.rect(-160, -70, 320, 70, rimD);
    pen.rect(-150, -60, 300, 50, p.mat('#1a3a50', { deep: true }));
    pen.rect(-160, -74, 320, 8, rim);
    for (let i = 0; i < 6; i++) pen.rect(-150 + i * 54, -72, 4, 70, rim);
    const n = mo.pose === 'attack' ? 11 : 1;
    for (let i = 0; i < n; i++) tentacle(pen, p, c, -120 + i * (240 / Math.max(1, n - 1)) * (n > 1 ? 1 : 0) + (n === 1 ? 30 : 0), 90 + (i % 3) * 18, (n > 1 ? (i - 5) * 0.06 : -0.5) * (1 + strike), sw + i, k, kd, suck, 10);
    return info(c);
  }
  sea(pen, p, c, -76, '#10202e');
  // the eye, half under the surface, and the mass behind it
  pen.ell(30, -88, 52, 36, kd);
  pen.ell(30, -84, 44, 30, k);
  pen.ell(32, -86, 20, 15, p.mat('#e8e0c0', { deep: true }));
  const lid = mo.dead ? 0.2 : mo.pose === 'hurt' ? 0.45 : 1;
  pen.ell(36, -86, 9, 12 * lid, eye); pen.ell(37, -86, 3.2, 10 * lid, ink);
  pen.rect(-50, -76, 300, 3, p.mat(light('#10202e', 0.2), { flat: true, alpha: 0.7 }));
  // the tentacles rise on both sides, curl, and slam down at the strike
  const spec: [number, number, number, number][] = [[-125, 110, -0.1, 0], [-85, 140, 0.15, 1.7], [-45, 100, 0.3, 3.1], [105, 120, -0.2, 0.9], [135, 150, 0.1, 2.4], [160, 90, -0.4, 3.9]];
  spec.forEach(([x, len, lean, ph], i) => tentacle(pen, p, c, x, (len - (mo.dead ? mo.die * 70 : 0)) * (i === 1 || i === 4 ? 1 + strike * 0.2 : 1) + 0, lean + (i % 2 ? 1 : -1) * strike * 0.9 * (i === 1 || i === 4 ? 1 : 0.4), sw + ph, i % 2 ? k : kd, kd, suck));
  if (mo.dead) for (let i = 0; i < 9; i++) pen.ell(-90 + i * 22, -62 + rnd(L.id, i) * 20, 12, 7, ink);
  return info(c);
}

function titan(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const pen = c.pen(1);
  const rock = p.mat(L.main, { deep: true }), rockD = p.mat(dark(L.main, 0.3)), rockL = p.mat(light(L.main, 0.15)), lava = p.mat(L.second, { flat: true }), eye = p.mat(L.eye, { flat: true });
  const breath = mo.pose === 'idle' ? mo.breath * 2 : 0;
  const strike = mo.pose === 'attack' ? [0, 1, 0.4][mo.a] : 0;
  const sag = mo.dead ? mo.die * 24 : 0;
  // no sky: a wall of stone body whose chest fills the frame; the head is out of the picture
  pen.rect(-160, -180 + sag, 320, 180 - sag, rockD);
  pen.poly([[-160, -120 + sag], [-110, -150 + sag + breath], [-30, -178 + sag + breath], [60, -176 + sag + breath], [150, -140 + sag], [160, -120 + sag], [160, 0], [-160, 0]], rock);
  for (let i = 0; i < 14; i++) { const x0 = -150 + rnd(L.id, i) * 300, y0 = -170 + rnd(L.id, i + 20) * 150 + sag; pen.line([x0, y0], [x0 + 20 * (rnd(L.id, i + 40) - 0.4), y0 + 22], rockD, 1.6); }
  for (let i = 0; i < 8; i++) { const x0 = -140 + rnd(L.id, i + 70) * 280, y0 = -150 + rnd(L.id, i + 90) * 120 + sag; pen.line([x0, y0], [x0 + 12, y0 + 16], lava, mo.dead ? 0.5 : 1.4 + ((mo.f + i) % 2) * 0.5); }
  // moss and rubble on the shoulder ledge
  for (let i = 0; i < 9; i++) pen.rect(-140 + i * 30, -126 + sag + (i % 3) * 3, 22, 4, rockL);
  // the right fist is raised, then swung across the ground (the doc: it never dies, it sits and closes its eyes when music calms it)
  const fx = mo.pose === 'attack' ? [-90, 40, -20][mo.a] : -70, fy = mo.pose === 'attack' ? [-130, -40, -60][mo.a] : -46 + breath * 0.5;
  pen.chain([[150, -100 + sag], [(150 + fx) / 2 + 30, Math.min(fy - 24, -92)], [fx + 6, fy - 14]], [34, 28, 24], p.mat(mix(L.main, '#000000', 0.12), { deep: true }));
  pen.ell(fx, fy, 28, 24, rockL);
  for (let i = 0; i < 4; i++) { pen.ell(fx + 16 - i * 11, fy + 12, 7, 7, rockL); pen.line([fx + 16 - i * 11, fy + 4], [fx + 16 - i * 11, fy + 18], rockD, 1.2); }
  pen.ell(fx - 20, fy - 10, 9, 7, rockL);
  if (mo.a === 1) for (let i = 0; i < 12; i++) pen.dot(fx - 50 + i * 12, -4 - (i % 3) * 3, p.mat('#a09a88', { flat: true }), 2.4);
  // a slit of an eye on the chest-plate (a second face of stone)
  pen.rect(-92, -146 + sag, 22, 5, mo.dead ? rockD : eye);
  void mix;
  return info(c);
}

function gate(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const pen = c.pen(1);
  const iron = p.mat(L.main, { deep: true }), ironL = p.mat(mix(L.main, '#6a4a4a', 0.4), { deep: true }), fire = p.mat(L.second, { deep: true }), eye = p.mat(L.eye, { flat: true }), core = p.mat(light(L.eye, 0.4), { flat: true }), ink = p.mat('#080204', { flat: true });
  const open = mo.pose === 'attack' ? [0.4, 1, 0.7][mo.a] : mo.pose === 'idle' ? 0.2 + 0.08 * mo.breath : 0.3;
  const shut = mo.dead ? mo.die : 0;
  const w = 74 * (1 - shut * 0.9);
  // the arch of black iron with two horns, and fire where the doors have opened
  pen.rect(-96, -170, 192, 170, ink);
  pen.poly([[-100, 0], [-100, -120], [-70, -168], [-34, -178], [0, -164], [34, -178], [70, -168], [100, -120], [100, 0], [74, 0], [74, -110], [48, -142], [0, -154], [-48, -142], [-74, -110], [-74, 0]], iron);
  pen.poly([[-92, -128], [-124, -174], [-86, -150]], ironL); pen.poly([[92, -128], [124, -174], [86, -150]], ironL);
  pen.rect(-w, -146, w * 2, 146, fire);
  pen.ell(0, -90, w * 0.72, 50, p.mat(mix(L.second, '#ffc040', 0.5), { deep: true }));
  pen.ell(0, -88, w * 0.3, 28, core);
  // teeth along the doorframe and a stony brow over the eyes
  for (let i = 0; i < 9; i++) { const x = -w + 8 + i * ((w * 2 - 16) / 8); pen.poly([[x - 5, -146], [x, -146 + 20 + open * 10 + (i % 2) * 6], [x + 5, -146]], ironL); pen.poly([[x - 5, 0], [x, -(20 + open * 10 + (i % 2) * 5)], [x + 5, 0]], ironL); }
  for (const dx of [-30, 30]) { pen.poly([[dx - 14, -118], [dx + 14, -112], [dx + 12, -102], [dx - 14, -106]], ink); if (!mo.dead) pen.ell(dx, -108, 6, 4, eye); }
  // chains hang from the horns and sway; at the strike they sweep out
  for (const side of [-1, 1]) {
    const sweep = mo.pose === 'attack' ? [0.2, 1, 0.5][mo.a] : 0;
    const pts = spine(12, (u) => [side * (98 + u * 40 + sweep * u * 90), -150 + u * 110 + Math.sin(u * 6 + mo.ph + side) * 6 * (1 - sweep) - sweep * u * 30]);
    for (let i = 0; i < 12; i++) pen.ell(pts[i][0], pts[i][1], 3.4, i % 2 ? 2 : 3.4, p.mat('#8a8a94', { deep: true }));
    if (sweep > 0.8) for (let i = 0; i < 6; i++) pen.dot(pts[11][0] + side * i * 3, pts[11][1] - i, fire, 2.4);
  }
  for (let i = 0; i < 12; i++) pen.dot(-60 + rnd(L.id, i) * 120, -((mo.f * 3 + i * 9) % 90) - 6, eye, 1.6);
  void dark;
  return info(c);
}

function engine(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const pen = c.pen(1);
  const metal = p.mat(L.main, { deep: true }), metalL = p.mat(light(L.main, 0.22)), metalD = p.mat(dark(L.main, 0.4)), core = p.mat(L.second, { flat: true }), oil = p.mat(L.extra.find((e) => e.label === 'น้ำมัน')?.hex ?? '#d8a030', { deep: true });
  const stopped = mo.dead ? mo.die : 0;
  // each layer of gears turns on its own, a step per frame; on death they stop from the outside in
  const turn = (layer: number) => (mo.pose === 'attack' ? mo.a + layer : mo.pose === 'idle' ? mo.f + layer : mo.pose === 'walk' ? mo.f : 0) * (stopped > layer * 0.3 ? 0 : 1);
  const gear = (x: number, y: number, r: number, teeth: number, a: number, k: number, kl: number) => {
    pen.ell(x, y, r, r, k);
    for (let i = 0; i < teeth; i++) { const t = a + (i / teeth) * Math.PI * 2; pen.poly([[x + Math.cos(t - 0.12) * r * 0.9, y + Math.sin(t - 0.12) * r * 0.9], [x + Math.cos(t - 0.09) * (r + 6), y + Math.sin(t - 0.09) * (r + 6)], [x + Math.cos(t + 0.09) * (r + 6), y + Math.sin(t + 0.09) * (r + 6)], [x + Math.cos(t + 0.12) * r * 0.9, y + Math.sin(t + 0.12) * r * 0.9]], kl); }
    pen.ell(x, y, r * 0.62, r * 0.62, metalD);
    for (let i = 0; i < 4; i++) { const t = a + (i / 4) * Math.PI * 2; pen.line([x, y], [x + Math.cos(t) * r * 0.62, y + Math.sin(t) * r * 0.62], kl, 2); }
    pen.ell(x, y, r * 0.2, r * 0.2, core);
  };
  pen.rect(-160, -180, 320, 180, metalD);
  for (let i = 0; i < 5; i++) pen.rect(-150 + i * 70, -180, 8, 180, metal);
  gear(-95, -110, 62, 16, turn(0) * 0.12, metal, metalL);
  gear(10, -60, 44, 12, -turn(1) * 0.16 + 0.1, metalL, metal);
  gear(100, -118, 52, 14, turn(2) * 0.13, metal, metalL);
  gear(-30, -152, 30, 10, -turn(3) * 0.2, metalL, metal);
  gear(150, -30, 34, 10, -turn(1) * 0.15, metal, metalL);
  // pipes, a column of oil, the blue light that is the code being said
  pen.rect(-14, -180, 7, 150, oil); pen.rect(-14, -180, 2, 150, p.mat(light('#d8a030', 0.4), { flat: true }));
  const lit = mo.dead ? 0 : mo.pose === 'attack' ? 1 : 0.5 + 0.5 * mo.breath;
  if (lit) for (let i = 0; i < 4; i++) { pen.line([10, -60], [10 + (i - 1.5) * 50 * lit, -60 - (60 + i * 18) * lit], core, 1.4 + lit); pen.dot(10 + (i - 1.5) * 50 * lit, -60 - (60 + i * 18) * lit, core, 4); }
  return info(c);
}

function leviathan(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const pen = c.pen(1);
  const body = p.mat(L.main, { deep: true }), bodyL = p.mat(L.second, { deep: true }), eye = p.mat(L.eye, { flat: true }), ink = p.mat('#04080e', { flat: true });
  const strike = mo.pose === 'attack' ? [0.1, 1, 0.5][mo.a] : 0;
  const slide = mo.pose === 'walk' ? mo.f * 6 : mo.pose === 'idle' ? mo.breath * 3 : 0;
  sea(pen, p, c, -58, '#0c1a2c');
  // coils arch out of the water across the frame, the rest below; the head lifts from the left
  const humps: [number, number, number][] = [[110, 70, 24], [20, 86, 30], [-70, 62, 22]];
  humps.forEach(([cx, h, r], i) => {
    const pts = spine(12, (u) => [cx - 36 + u * 72 + slide * (i ? 1 : -1), -50 - Math.sin(u * Math.PI) * h]);
    pen.chain(pts, Array(13).fill(r), i % 2 ? body : p.mat(dark(L.main, 0.1), { deep: true }));
    for (let k = 1; k < 12; k += 2) pen.line([pts[k][0], pts[k][1] - r + 3], [pts[k][0] + 3, pts[k][1] - r + 9], bodyL, 1.4);
  });
  const lift = 54 + strike * 36 - (mo.dead ? mo.die * 40 : 0);
  const neck = spine(10, (u) => [-120 - u * 24 + Math.sin(u * 4 + mo.ph) * 3, -48 - u * lift * 1.4]);
  pen.chain(neck, neck.map((_, i) => 24 - i * 0.9), body);
  const hd = neck[10];
  const open = mo.pose === 'attack' ? [0.4, 1, 0.5][mo.a] : 0.15;
  pen.poly([[hd[0] + 10, hd[1] - 10], [hd[0] - 52, hd[1] - 4 + open * 8], [hd[0] - 54, hd[1] + 6 + open * 14], [hd[0] + 8, hd[1] + 18]], body);
  pen.ell(hd[0], hd[1], 24, 20, body);
  pen.rect(hd[0] - 50, hd[1] - 2 + open * 4, 54, 3 + open * 10, ink);
  for (let i = 0; i < 7; i++) pen.poly([[hd[0] - 48 + i * 7, hd[1] - 2 + open * 4], [hd[0] - 45 + i * 7, hd[1] + 6 + open * 4], [hd[0] - 42 + i * 7, hd[1] - 2 + open * 4]], p.mat('#e8e4d0', { flat: true }));
  pen.ell(hd[0] + 4, hd[1] - 9, 7, 6, mo.dead ? bodyL : eye); pen.dot(hd[0] + 5, hd[1] - 9, ink, 3);
  pen.poly([[hd[0] + 14, hd[1] - 16], [hd[0] + 36, hd[1] - 30], [hd[0] + 26, hd[1] - 10]], bodyL);
  if (open > 0.8) for (let i = 0; i < 4; i++) pen.ell(-130, -58, 20 + i * 14, 3 + i * 1.6, p.mat('#5a7a96', { flat: true, alpha: 0.35 }));
  return info(c);
}
