// Crowds that are one body: the locust cloud (a whirl of insects over the field), the moths that circle a flame, the rust-eaten rats that
// pour over pipes. Many small marks, placed by hash so a frame is the same every time it is asked for.
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { dark, light, rnd, type Ctx, type Info } from './kit';

export function paintSwarm(c: Ctx<EnemyLook>): Info {
  switch (c.L.form) {
    case 'locust': return locusts(c);
    case 'moth': return moths(c);
    default: return rats(c);
  }
}

function locusts(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 80, (c.w * 0.95) / 220);
  const pen = c.pen(s);
  const body = p.mat(L.main, { flat: true }), bodyD = p.mat(L.second, { flat: true }), wing = p.mat(light(L.main, 0.35), { flat: true, alpha: 0.85 }), eye = p.mat(L.eye, { flat: true });
  const stretch = mo.pose === 'attack' ? [0.2, 1, 0.5][mo.a] : 0;
  const N = 150;
  const spin = mo.pose === 'idle' ? mo.f * 0.35 : mo.pose === 'walk' ? mo.f * 0.8 : mo.pose === 'attack' ? mo.a * 0.6 : 0.2;
  for (let i = 0; i < N; i++) {
    const r = Math.sqrt(rnd(L.id, i)) * 100, a = rnd(L.id, i + 400) * Math.PI * 2 + spin * (1.2 - r / 100) * (1 + (i % 3) * 0.2);
    // the cloud is a flattened ellipse with a denser heart; it streams forward when it attacks
    const x = Math.cos(a) * r * (1 + stretch * 0.5) + stretch * 40, y = -62 + Math.sin(a) * r * 0.55 * (1 - stretch * 0.3);
    const flap = (i + mo.f) % 2;
    const m = r < 40 ? body : i % 3 ? bodyD : body;
    pen.px(x, y, m);
    pen.px(x + 1, y, m);
    pen.px(x, y - 1 - flap, wing);
    if (i % 17 === 0) pen.px(x + 2, y, eye);
  }
  // the dark underbelly of the cloud
  for (let i = 0; i < 12; i++) pen.px(-40 + rnd(L.id, i + 900) * 80, -18 - rnd(L.id, i + 950) * 14 - mo.f, bodyD);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 70 * s, ry: Math.max(3, 4 * s * 0.5) }, tall: false, ground: [c.cx, c.foot] };
}

function moths(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 22, (c.w * 0.9) / 46);
  const pen = c.pen(s);
  const wing = p.mat(L.main, { deep: true }), wingD = p.mat(L.second), eye = p.mat(L.eye, { flat: true }), glow = p.mat('#ffd890', { flat: true, alpha: 0.5 }), core = p.mat('#fff0c0', { flat: true });
  // the flame they circle
  pen.ell(0, -12, 4.6, 4.6, glow); pen.ell(0, -12, 2, 2.6, core);
  const N = 8, spin = mo.pose === 'idle' ? mo.f * 0.45 : mo.f * 0.9 + (mo.pose === 'attack' ? mo.a * 1.2 : 0);
  const pts: [number, number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + spin, r = 8 + (i % 3) * 3.2 - (mo.pose === 'attack' ? mo.strike * 4 : 0);
    pts.push([Math.cos(a) * r * 1.3, -12 + Math.sin(a) * r * 0.62, Math.sin(a)]);
  }
  pts.sort((a, b) => a[2] - b[2]);
  pts.forEach(([x, y], i) => {
    const up = (mo.f + i) % 2;
    pen.poly([[x - 0.4, y], [x - 3.4, y - 3 - up * 1.2], [x - 2.4, y + 0.8]], wing);
    pen.poly([[x + 0.4, y], [x + 3.4, y - 3 - up * 1.2], [x + 2.4, y + 0.8]], wing);
    pen.rect(x - 0.5, y - 1, 1.2, 2.6, wingD); pen.dot(x, y - 1.5, eye, 0.9);
  });
  if (mo.a === 1) for (let i = 0; i < 5; i++) pen.dot(-7 + i * 3.4, -3 + i * 1.8, wing, 1);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 9 * s, ry: Math.max(1.2, 1.2 * s) }, tall: false };
}

function rats(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 10, (c.w * 0.92) / 32);
  const pen = c.pen(s);
  const fur = p.mat(L.main, { deep: true }), furD = p.mat(dark(L.main, 0.3)), rust = p.mat(L.second, { deep: true }), eye = p.mat(L.eye, { flat: true }), tail = p.mat(light(L.main, 0.1), { flat: true });
  const N = 9, run = mo.pose === 'walk' ? mo.f * 2.2 : mo.pose === 'attack' ? [0, 3, 1][mo.a] : mo.pose === 'idle' ? mo.breath * 0.8 : 0;
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => rnd(L.id, a + 50) - rnd(L.id, b + 50));
  for (const i of order) {
    const x = -13 + rnd(L.id, i) * 26 + run * (0.5 + rnd(L.id, i + 9) * 0.5) - (mo.pose === 'walk' ? 5 : 0), y = -1 - rnd(L.id, i + 20) * 6 - (rnd(L.id, i + 21) > 0.7 ? 5 : 0) - ((mo.f + i) % 2) * 0.6;
    pen.ell(x, y - 2, 3.2, 1.9, i % 3 ? fur : furD); pen.ell(x + 2.8, y - 2.5, 1.6, 1.3, fur); pen.dot(x + 4.5, y - 2.6, rust, 0.9);
    pen.poly([[x + 2.2, y - 3.6], [x + 2.8, y - 5], [x + 3.4, y - 3.6]], furD);
    pen.line([x - 3, y - 2], [x - 7, y - 3 + (i % 2) * 1.4], tail, 0.5);
    pen.dot(x + 3.4, y - 2.8, mo.dead ? furD : eye, 0.8);
    pen.px(x - 1.4, y - 0.4 + ((mo.f + i) % 2) * 0, furD); pen.px(x + 1.2, y - 0.4, furD);
    if (i % 3 === 0) pen.rect(x - 1, y - 3.4, 2.6, 0.8, rust);
  }
  return { shadow: { cx: c.cx, cy: c.foot, rx: 15 * s, ry: Math.max(1.4, 1.6 * s) }, tall: false };
}
