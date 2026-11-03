// The dragons of the earth: Stone Tremor (low and broad as a tortoise, stone plates and moss), Eridan (soft and round as a fog), Andar (a hill
// of fat sleep with grass on its back) and Grom-Thar (swallowed by a mountain: a shoulder, a tail and one brown eye in a crack).
import type { Pt } from '../paint';
import type { Out, Z } from './dragon';
import { head, leg, paw, spine, tube } from './dragon-parts';
import { blend, dark, light, mix, ovEll, ovPuff, rnd } from './kit';

export function earthShape(z: Z): Out {
  switch (z.L.form) {
    case 'turtle': return stone(z);
    case 'round': return eridan(z);
    case 'sleeper': return andar(z);
    default: return gromThar(z);
  }
}

/** The x extent of a silhouette at height y (for laying strata). */
function spanAt(poly: Pt[], y: number): [number, number] | null {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)); }
  return xs.length < 2 ? null : [Math.min(...xs), Math.max(...xs)];
}

// ── Stone Tremor ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function stone(z: Z): Out {
  const { pen, p, P, ph, strike, walk } = z;
  const lunge = Math.max(0, strike);
  const moss = p.mat('#6a8a4a', { deep: true }), mossL = p.mat('#8aaa5a'), plate = p.mat(light(z.L.main, 0.1), { deep: true }), plateL = p.mat(light(z.L.main, 0.26));
  const step = (o: number): Pt => walk ? [Math.sin(ph + o) * 2.4, -Math.max(0, Math.cos(ph + o)) * 1.8] : [0, 0];
  const lg = (x: number, o: number, far: boolean): void => { const [dx, dy] = step(o); leg(pen, [x, -13], { a: 5.5, b: 6, foot: [x + dx, dy], r: 4.6, k: far ? P.bodyD : P.body, ol: P.seam, claw: P.claw, paw: 2.4 }); };
  lg(-17, Math.PI, true); lg(14, 0.3, true);
  // the tail, thick and blunt with stone knuckles
  const tpts: Pt[] = [[-23, -14], [-31, -11], [-38, -9 + Math.sin(ph) * 1.2]];
  tube(pen, tpts, [6, 3.8, 1.6], P.body, { ol: P.seam });
  // the shell: a dome of stone slabs with mossy seams
  pen.ell(0, -21, 29, 16.5, P.seam); pen.ell(0, -21, 28, 15.6, P.bodyD);
  pen.ell(0, -22, 26.5, 14.2, P.body);
  const rows: [number, number, number][] = [[-10, -31, 5.6], [0, -33, 6], [10, -31, 5.6], [-18, -24, 5.4], [-6, -25.5, 6.2], [6, -25.5, 6.2], [18, -24, 5.4], [-12, -17, 6], [0, -17.5, 6.6], [12, -17, 6]];
  rows.forEach(([x, y, r], i) => { pen.ell(x, y, r + 0.8, r * 0.66 + 0.8, P.seam); pen.ell(x, y, r, r * 0.66, i % 3 ? plate : plateL); });
  for (const [x, y, r] of [[-3, -35, 4], [13, -29, 3.4], [-17, -27, 3], [7, -21, 3.4], [-8, -20, 2.6]] as const) { pen.ell(x, y, r, r * 0.5, moss); pen.dot(x - 1, y - 1, mossL, 1.2); }
  lg(-10, 0, false); lg(21, Math.PI * 0.8, false);
  // the head lowered on a short thick neck; the eyes small, grey as smoke, almost shut
  const hx = 34 + lunge * 6, hy = -12 + lunge * 3;
  tube(pen, [[18, -16], [27, -13 + lunge * 2], [hx - 3, hy + 1]], [8, 6.4, 5.4], P.body, { ol: P.seam });
  const h = head(pen, hx + 2, hy, { sz: 1.15, ang: 0.08 + lunge * 0.3, open: z.open, style: 'round', horns: 'stub', hk: 0.9, eye: z.shut ? 'shut' : 'half', cheek: false, pupil: P.ink }, P);
  return { mouth: h.mouth, ang: 0.3, breath: 'dust', shadow: { cx: z.c.cx, cy: z.c.foot, rx: 32 * z.s, ry: 2.4 } };
}

// ── Eridan ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function eridan(z: Z): Out {
  const { pen, p, P, ph, strike, walk, t, L } = z;
  const lunge = Math.max(0, strike), br = z.mo.breath;
  const stain = p.mat('#c8b890', { deep: true }), fog = p.mat('#ffffff', { alpha: 0.5 }), hornM = p.mat('#e8dcc0');
  const step = (o: number): Pt => walk ? [Math.sin(ph + o) * 3, -Math.max(0, Math.cos(ph + o)) * 2] : [0, 0];
  const lg = (x: number, o: number, far: boolean): void => { const [dx, dy] = step(o); leg(pen, [x, -17], { a: 7, b: 8, foot: [x + dx, dy], r: 5.2, k: far ? P.bodyD : P.body, ol: P.seam, claw: P.claw, paw: 2.8 }); };
  lg(-22, Math.PI, true); lg(15, 0.4, true);
  // a tail that ends in a soft tuft
  tube(pen, [[-30, -20], [-40, -17], [-48, -17 + Math.sin(ph) * 1.5]], [7, 4.4, 2.4], P.body, { ol: P.seam });
  pen.ell(-50, -18 + Math.sin(ph) * 1.5, 4.4, 3.4, P.acc);
  // the body is a heap of soft lobes, like a bank of fog with a dragon in it
  const cy = -27 - br * 0.6;
  pen.ell(0, cy, 34, 20, P.seam); pen.ell(0, cy, 33, 19, P.bodyD); pen.ell(0, cy - 0.8, 32, 18, P.body);
  for (let i = 0; i < 12; i++) { const a = -Math.PI + (i / 11) * Math.PI, r = 7 + (i % 3) * 1.4; pen.ell(Math.cos(a) * 29, cy - 1 + Math.sin(a) * 15.5, r + 0.9, r * 0.9 + 0.9, P.seam); }
  for (let i = 0; i < 12; i++) { const a = -Math.PI + (i / 11) * Math.PI, r = 7 + (i % 3) * 1.4; pen.ell(Math.cos(a) * 29, cy - 1 + Math.sin(a) * 15.5, r, r * 0.9, i % 3 === 1 ? P.bodyL : P.body); }
  pen.ell(1, cy + 9, 27, 7.5, P.belly);
  // the pale brown of old water stains
  for (const [x, y, rx, ry] of [[-18, -6, 6, 3.4], [-4, -12, 4.4, 2.6], [12, -3, 6.4, 3.6], [22, -10, 3.6, 2.2], [-26, 5, 4, 2.4]] as const) pen.ell(x, cy + y, rx, ry, stain);
  lg(-14, 0, false); lg(22, Math.PI * 0.8, false);
  // a round friendly head: large pale-gold eyes, small horns, soft ear fins
  const hx = 33 + lunge * 6, hy = cy - 8 + lunge * 5;
  pen.chain([[22, cy - 2], [hx - 2, hy + 2]], [11, 7.6], P.body);
  const h = head(pen, hx + 2, hy, { sz: 1.75, ang: 0.05 + lunge * 0.25, open: z.open * 0.7, style: 'round', horns: 'stub', hk: 1, eye: z.shut ? 'shut' : 'big', cheek: false, frill: P.acc, pupil: P.ink }, P);
  pen.dot(h.eye[0] - 1.2, h.eye[1] - 0.9, P.glowL, 1.6);
  void hornM; void fog; void mix; void dark;
  return {
    mouth: h.mouth, ang: 0.25, breath: 'wind', shadow: { cx: z.c.cx, cy: z.c.foot, rx: 44 * z.s, ry: 3 },
    after: (f) => {
      // clouds gather round it, in the outline of a dragon, the closer the more awake it is
      const spots: [number, number, number][] = [[-52, -52, 6], [-36, -62, 7], [-18, -68, 6.5], [4, -66, 7], [26, -62, 6], [44, -52, 6.4], [54, -34, 5.4], [-58, -34, 5.4], [-4, -4, 5], [36, -2, 4.4], [-40, -2, 4.6]];
      spots.forEach(([x, y, r], i) => ovPuff(f, Math.max(r * z.s + 3, Math.min(f.w - r * z.s * 1.3 - 4, pen.X(x + Math.sin((t + i) * 1.1) * 1.2))), Math.max(r * z.s + 3, pen.Y(y - br * 0.8)), r * z.s, '#f4f2ea', 0.52));
      void L;
    },
  };
}

// ── Andar: a hill asleep ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function andar(z: Z): Out {
  const { pen, p, P, ph, strike, t, L } = z;
  const br = z.mo.breath, lunge = Math.max(0, strike);
  const g1 = p.mat('#5a8a3a', { deep: true }), g2 = p.mat('#8aaa4a'), g3 = p.mat('#a8c05a'), soil = p.mat('#7a6038', { deep: true }), whisk = p.mat(L.second, { deep: true });
  const fl = ['#f0d860', '#e88aa0', '#f4f0e4', '#e8a050'].map((h) => p.mat(h, { flat: true }));
  const cy = -36 - br * 0.9, rise = br * 0.8;
  // the tail, curled round the heel of the hill
  tube(pen, [[-58, -12], [-70, -8], [-78, -14], [-74, -22 + Math.sin(ph) * 0.8]], [8, 5.6, 3.4, 1.6], P.body, { ol: P.seam });
  // paws tucked under the belly
  for (const [x, far] of [[-34, true], [-10, true], [38, false], [20, false]] as const) { pen.ell(x, -6, 9, 7, far ? P.bodyD : P.body); paw(pen, x + 4, 0, 3, far ? P.bodyD : P.body, P.seam, P.claw); }
  // the hill: a dome with a heavy belly
  pen.ell(0, cy, 72, 36 + rise, P.seam); pen.ell(0, cy, 71, 35 + rise, P.bodyD); pen.ell(0, cy - 1.2, 69.4, 33 + rise, P.body);
  pen.ell(2, cy + 24, 56, 9, P.belly);
  // earth-coloured scales and patches of soil
  for (let i = 0; i < 38; i++) { const a = rnd('an', i) * Math.PI, rr = 0.22 + rnd('an', i + 40) * 0.72, x = -Math.cos(a) * 66 * rr, y = cy - Math.sin(a) * (30 + rise) * rr; pen.dot(x, y, i % 3 ? P.bodyL : P.bodyD, 2); if (i % 5 === 0) pen.ell(x + 2, y + 1, 3.4, 1.8, soil); }
  // grass and flowers that grow too fast on its back
  const top = (x: number): number => cy - (33 + rise) * Math.sqrt(Math.max(0, 1 - (x / 69) ** 2));
  for (let i = 0; i < 34; i++) {
    const x = -62 + i * 3.7 + (rnd('ag', i) - 0.5) * 2, y = top(x) + 2, h = 6 + rnd('ag', i + 20) * 7 + (i % 5 === 0 ? 4 : 0), sway = Math.sin(ph * 0.8 + i * 0.7) * 0.9;
    const m = [g1, g2, g3][i % 3];
    pen.poly([[x - 1.6, y + 1], [x + sway, y - h], [x + 1.8, y + 1]], m);
    if (i % 4 === 1) { pen.poly([[x + 1.4, y + 1], [x + 3 + sway, y - h * 0.7], [x + 3.8, y + 1]], g2); }
    if (i % 5 === 2) { const f = fl[(i >> 1) % 4]; pen.dot(x + sway, y - h - 1, f, 2.2); pen.px(x + sway, y - h - 1, fl[2]); }
  }
  // the head rests on the front paws, eyes closed, a long breath through the nose
  const hx = 62 + lunge * 6, hy = -11 + lunge * 2;
  pen.chain([[46, cy + 8], [hx - 6, hy - 6]], [14, 8], P.body);
  const h = head(pen, hx + 2, hy, { sz: 1.9, ang: 0.28 + lunge * 0.15, open: z.open * 0.5, style: 'sleep', horns: 'stub', hk: 0.9, eye: 'shut', cheek: false, pupil: P.ink }, P);
  // the whiskers, long, wound round the roots of the grass
  for (const [dy, k] of [[0, 0], [5, 1]] as const) {
    const wp = spine(8, (u) => [h.mouth[0] - 6 + u * 16, h.mouth[1] - 1 + dy + Math.sin(u * 5.5 + ph * 0.7 + k) * 3 + u * (k ? 4 : 1) - (k ? 1 : 0)]);
    pen.chain(wp, wp.map((_, i) => 0.75 - i * 0.05), whisk);
  }
  for (let i = 0; i < 6; i++) { const x = 66 + i * 4, y = -1; pen.poly([[x - 1, y + 1], [x + 0.2, y - 3 - (i % 3)], [x + 1.4, y + 1]], i % 2 ? g1 : g2); }
  return { mouth: h.mouth, ang: 0.3, breath: 'dust', shadow: { cx: z.c.cx, cy: z.c.foot, rx: 76 * z.s, ry: 3.2 }, after: () => void t };
}

// ── Grom-Thar: only a shoulder, a tail and an eye ───────────────────────────────────────────────────────────────────────────────────────
function gromThar(z: Z): Out {
  const { pen, p, P, ph, t, L } = z;
  const stone = p.mat(L.second, { deep: true }), stoneD = p.mat(dark(L.second, 0.34)), stoneL = p.mat(light(L.second, 0.22)), seamM = p.mat(dark(L.second, 0.62), { flat: true });
  const poly: Pt[] = [[-64, 0], [-62, -10], [-56, -18], [-52, -30], [-44, -36], [-40, -50], [-30, -54], [-26, -68], [-16, -72], [-10, -84], [2, -82], [10, -90], [20, -80], [30, -78], [36, -66], [44, -60], [48, -46], [56, -40], [60, -26], [64, -18], [66, 0]];
  const ol = poly.map(([x, y]) => [x + Math.sign(x) * 0.9, y - (y < -1 ? 0.9 : 0)] as Pt);
  pen.poly(ol, P.seam);
  pen.poly(poly, stone);
  // strata: broken ledges of darker and lighter stone with blotches between them, a lit face on the left, a shaded side on the right
  for (let i = 0; i < 46; i++) {
    const y = -4 - rnd(L.id, i) * 80, sp = spanAt(poly, y); if (!sp) continue;
    const w = sp[1] - sp[0], x0 = sp[0] + 2 + rnd(L.id, i + 60) * w * 0.7, len = 5 + rnd(L.id, i + 120) * 14, x1 = Math.min(sp[1] - 2, x0 + len);
    pen.line([x0, y], [x1, y + (i % 3 === 0 ? 1.5 : 0.5)], i % 3 === 0 ? seamM : i % 3 === 1 ? stoneD : stoneL, 0.8);
    if (i % 5 === 0) pen.ell((x0 + x1) / 2, y + 3, len * 0.4, 2.2, i % 2 ? stoneD : stoneL);
  }
  pen.poly([[-60, -16], [-50, -34], [-38, -50], [-24, -68], [-8, -84], [-12, -70], [-30, -48], [-44, -28], [-54, -10]], stoneL);
  pen.poly([[66, 0], [62, -18], [54, -38], [42, -58], [28, -76], [34, -50], [46, -28], [52, -8]], stoneD);
  for (let i = 0; i < 9; i++) { const x = -40 + rnd(L.id, i) * 80, y = -8 - rnd(L.id, i + 4) * 66; pen.line([x, y], [x + (i % 2 ? 4 : -4), y - 7], seamM, 0.8); pen.line([x + (i % 2 ? 4 : -4), y - 7], [x + (i % 2 ? 1 : -1), y - 13], seamM, 0.8); }
  // the shoulder of the dragon comes out of the stone: scaled, sandy, with a foreleg that grips the foot of the mountain
  const sx = 24, sy = -44;
  pen.ell(sx, sy, 21, 15.5, P.seam); pen.ell(sx, sy, 20, 14.6, P.body);
  for (let i = 0; i < 16; i++) { const a = rnd('gt', i) * Math.PI * 2, r = rnd('gt', i + 9) * 0.8; pen.dot(sx + Math.cos(a) * 17 * r, sy + Math.sin(a) * 11 * r, i % 2 ? P.bodyL : P.bodyD, 1.8); }
  pen.chain([[sx + 6, sy + 6], [sx + 16, sy + 22], [sx + 20, -4 + Math.sin(ph) * 0.5]], [9, 7.4, 6.4], P.seam);
  pen.chain([[sx + 6, sy + 6], [sx + 16, sy + 22], [sx + 20, -4 + Math.sin(ph) * 0.5]], [8.2, 6.6, 5.6], P.body);
  paw(pen, sx + 20, 0, 3.8, P.body, P.seam, P.claw);
  for (let i = 0; i < 6; i++) pen.poly([[sx - 14 + i * 5.4, sy - 11 + Math.abs(i - 2.5) * 1.4], [sx - 12 + i * 5.4, sy - 18 + Math.abs(i - 2.5) * 1.2], [sx - 9.4 + i * 5.4, sy - 11 + Math.abs(i - 2.5) * 1.4]], P.horn);
  // the tail along the foot of the mountain
  const tpts = spine(8, (u) => [-62 - u * 20, -12 - 6 * Math.sin(u * 3 + ph) * u + u * 8 - (u > 0.8 ? 12 * (u - 0.8) / 0.2 : 0)]);
  tube(pen, tpts, tpts.map((_, i) => 9 - i * 0.9), P.body, { ol: P.seam, scale: P.bodyL, scaleD: P.bodyD, step: 1, ridge: P.horn, rh: 4.4, rstep: 1 });
  // the eye: brown stone in a crack of the mountain, slow to open
  pen.poly([[-14, -58], [-4, -63], [6, -56], [-2, -52], [-12, -53]], P.seam);
  pen.poly([[-13, -57], [-4, -61.4], [4.6, -56], [-2, -53.2], [-11, -54]], seamM);
  if (!z.shut) { pen.ell(-4.4, -57.4, 3.6, 2.4, P.eye); pen.dot(-3.8, -57.2, P.ink, 1.6); pen.px(-5.4, -58.6, P.glowL); }
  else pen.line([-10, -56], [1, -57], P.ink, 0.9);
  return {
    mouth: undefined, shadow: { cx: z.c.cx, cy: z.c.foot, rx: 78 * z.s, ry: 3.2 },
    after: (f) => { // rocks come down in ripples
      for (let i = 0; i < 7; i++) { const x = -44 + rnd(L.id, i + 30) * 88, y = -70 + ((t * 3 + i * 5) % 14) * 4.6; blend(f, pen.X(x), pen.Y(y), '#a8987a', 0.9); blend(f, pen.X(x) + 1, pen.Y(y) + 1, '#6a5a46', 0.9); }
    },
  };
  void ovEll; void ovPuff; void mix;
}
