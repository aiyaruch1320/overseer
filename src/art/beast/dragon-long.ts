// The long dragons: the winding bodies of Oran-Sal (pearl, cloud wings, floating roots), Samut Alai (the eel that weeps), Thalassa (translucent,
// eyes along its flank), Niveri (a shadow in the mist) and Silvera (coiled in the roots of a forest).
import type { Pt } from '../paint';
import type { Out, Z } from './dragon';
import { along, belly, head, leg, spine, tube, wing, type HeadO } from './dragon-parts';
import { blend, mix, ovEll, rnd } from './kit';

export function longShape(z: Z): Out {
  switch (z.L.form) {
    case 'eel': return eel(z);
    case 'coil': return coil(z);
    default: return z.L.id === 'dragon_01' ? oranSal(z) : thalassa(z);
  }
}
const smooth = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const dirAng = (a: Pt, b: Pt): number => Math.atan2(b[1] - a[1], b[0] - a[0]);

// ── Oran-Sal: the biggest, slender, pearl scales that are chipped and cracked, wings like sheets of cloud ───────────────────────────────
function oranSal(z: Z): Out {
  const { pen, p, P, ph, strike, t } = z;
  const N = 34, lunge = Math.max(0, strike);
  const pts = spine(N, (u) => [-90 + 160 * u + lunge * 8 * u, -40 - 20 * u ** 1.6 - 24 * Math.sin(u * 7.2 + ph * 0.5) * (0.45 + 0.55 * u) + lunge * 9 * smooth(0.82, 1, u)]);
  const rad = pts.map((_, i) => { const u = i / N; return 0.9 + 10.6 * Math.min(1, u * 2.6) ** 0.8 * (1 - 0.34 * smooth(0.66, 1, u)); });
  const rockM = p.mat('#8a8a90', { deep: true }), rockD = p.mat('#5a5a64'), moss = p.mat('#7a9a5a'), rootM = p.mat('#4a3a2c');
  // floating stone with its roots; the body winds round them
  const islet = (cx: number, cy: number, w: number): void => {
    pen.poly([[cx - w, cy], [cx - w * 0.8, cy - w * 0.35], [cx - w * 0.2, cy - w * 0.55], [cx + w * 0.6, cy - w * 0.4], [cx + w, cy - 1], [cx + w * 0.4, cy + w * 0.5], [cx - w * 0.1, cy + w * 0.9], [cx - w * 0.5, cy + w * 0.4]], P.seam);
    pen.poly([[cx - w + 1, cy], [cx - w * 0.78, cy - w * 0.32], [cx - w * 0.2, cy - w * 0.5], [cx + w * 0.58, cy - w * 0.37], [cx + w - 1, cy - 0.5], [cx + w * 0.4, cy + w * 0.42], [cx - w * 0.1, cy + w * 0.78], [cx - w * 0.5, cy + w * 0.34]], rockM);
    pen.poly([[cx - w * 0.5, cy + w * 0.34], [cx - w * 0.1, cy + w * 0.78], [cx + w * 0.4, cy + w * 0.42], [cx, cy + w * 0.1]], rockD);
    pen.ell(cx - w * 0.2, cy - w * 0.42, w * 0.5, 1.4, moss);
    for (let k = 0; k < 3; k++) pen.line([cx - w * 0.3 + k * w * 0.35, cy + w * 0.5], [cx - w * 0.4 + k * w * 0.4 + Math.sin(ph + k) * 0.8, cy + w * 0.5 + 7 + k * 2], rootM, 0.9);
  };
  islet(-58, -6 + Math.sin(ph) * 0.8, 9); islet(8, -2 - Math.sin(ph + 1) * 0.8, 12); islet(72, -8 + Math.sin(ph + 2) * 0.8, 7);
  // far wing (a darker sheet), then the body, then the near wing
  const wpts: [number, Pt][] = [[0.64, [0, 0]]];
  const sh = pts[Math.round(0.64 * N)];
  const cloudWing = (S: Pt, span: number, up: number, far: boolean): void => {
    const hi = Math.round(0.5 * N), hip = pts[hi];
    const w = wing(pen, S, { span, up, mem: far ? P.memD : P.mem, memD: far ? P.accD : P.memD, memL: far ? P.mem : P.memL, bone: far ? P.accD : P.bodyD, ol: P.seam, hip: [hip[0] - 4, hip[1] - rad[hi] - 2], fingers: 4 });
    // the trailing edge is a bank of cloud
    const edge: Pt[] = [w.wrist, ...w.tips];
    for (let i = 1; i < edge.length; i++) { const a = edge[i - 1], b = edge[i]; for (let k = 0; k <= 3; k++) { const q: Pt = [a[0] + (b[0] - a[0]) * (k / 3), a[1] + (b[1] - a[1]) * (k / 3)]; pen.ell(q[0], q[1] - 1, 5 + ((i + k) % 2) * 1.6, 3.4, far ? P.accD : P.accL); } }
    pen.ell(w.tips[w.tips.length - 1][0] - 3, w.tips[w.tips.length - 1][1] - 2, 6, 3.6, far ? P.accD : P.accL);
  };
  void wpts;
  cloudWing([sh[0] - 6, sh[1] - 7], 72, Math.min(1, z.flap + 0.1), true);
  // four small legs tucked under the body
  const lg = (u: number, far: boolean): void => { const q = pts[Math.round(u * N)]; leg(pen, [q[0], q[1] + 5], { a: 6, b: 7, foot: [q[0] + 4 + Math.sin(ph + u * 9) * 1.5, q[1] + 15 + Math.sin(ph + u * 5) * 1.5], hind: false, r: 2.4, k: far ? P.bodyD : P.body, ol: P.seam, claw: P.claw, paw: 1.8 }); };
  lg(0.34, true); lg(0.7, true);
  tube(pen, pts, rad, P.body, { ol: P.seam, belly: P.belly, from: 6, to: N - 2, plate: 1, plateK: P.seam, scale: P.bodyL, scaleD: P.bodyD, step: 1, edge: P.bodyL, ridge: P.horn, rh: 3.4, rstep: 2, rfrom: 8, rto: N - 3 });
  lg(0.4, false); lg(0.76, false);
  // chipped scales and cracks across the body
  for (let i = 5; i < N - 1; i += 3) { const q = pts[i], r = rad[i]; pen.line([q[0] - 0.5, q[1] - r * 0.8], [q[0] + 1.4, q[1] - r * 0.2], P.seam, 0.8); pen.line([q[0] + 1.4, q[1] - r * 0.2], [q[0] + 0.2, q[1] + r * 0.4], P.seam, 0.8); if (i % 6 === 2) pen.dot(q[0] + 1.6, q[1] - r + 0.4, P.seam, 1.8); }
  // roots round the body: the stone's own, wound over its back
  for (let k = 0; k < 3; k++) { const i = 8 + k * 7, q = pts[i], r = rad[i]; pen.chain([[q[0] - 1, q[1] - r], [q[0] + 2.4, q[1] - r * 0.1], [q[0] + 0.6, q[1] + r * 0.9], [q[0] - 4, q[1] + r + 6]], [0.8, 0.9, 0.8, 0.5], rootM); }
  cloudWing([sh[0] + 4, sh[1] - 6], 80, Math.min(1, z.flap + 0.12), false);
  // the head
  const hd = pts[N], ang = dirAng(pts[N - 3], hd) * 0.55 + lunge * 0.3;
  const h = head(pen, hd[0] + 3.4, hd[1] - 1, { sz: 1.55, ang, open: z.open, horns: 'swept', eye: z.shut ? 'shut' : 'half', fangs: false, pupil: undefined, hk: 1.2, mane: P.acc }, P);
  const sparks: Pt[] = [];
  for (let i = 0; i < 9; i++) sparks.push([-80 + rnd('os', i) * 170, -10 - rnd('os', i + 20) * 60]);
  return {
    mouth: h.mouth, ang: ang + 0.15, breath: 'light', shadow: { cx: z.c.cx, cy: z.c.foot, rx: 76 * z.s, ry: 3 },
    after: (f) => { // pearl dust drifts down from the chipped scales
      sparks.forEach(([x, y], i) => { const yy = y + (((t + i) % 4) * 6); const px = pen.X(x + Math.sin(i) * 3), py = pen.Y(yy); blend(f, px, py, '#fff8e0', 0.85); blend(f, px + 1, py, '#e8e0c8', 0.5); });
    },
  };
}

// ── Samut Alai: long and slick as a sea eel; the eyes are always wet ─────────────────────────────────────────────────────────────────────
function eel(z: Z): Out {
  const { pen, p, P, ph, strike, t } = z;
  const N = 30, lunge = Math.max(0, strike);
  const pts = spine(N, (u) => [-62 + 104 * u + lunge * 10 * u, -13 - 9 * Math.sin(u * 8.6 + ph) * (1 - 0.35 * u) - 30 * smooth(0.7, 1, u) + lunge * 6 * smooth(0.85, 1, u)]);
  const rad = pts.map((_, i) => { const u = i / N; return 0.8 + 7.6 * Math.min(1, u * 3.2) ** 0.7 * (1 - 0.3 * smooth(0.7, 1, u)); });
  // the long fin down the back and the fin of the tail
  const fin: Pt[] = [];
  for (let i = 3; i <= N - 4; i++) { const [nx, ny] = belly(pts, i); const q = pts[i], r = rad[i]; fin.push([q[0] - nx * (r - 0.4), q[1] - ny * (r - 0.4)]); }
  const finTop: Pt[] = fin.map((q, i) => { const j = i + 3, [nx, ny] = belly(pts, j); const h = 5 + 2.2 * Math.sin(i * 0.9 + ph) + (i > fin.length - 5 ? -2 : 0); return [q[0] + nx * h * -1, q[1] + ny * h * -1]; });
  pen.poly([...finTop, ...fin.slice().reverse()], P.memD);
  for (let i = 0; i < fin.length; i += 2) pen.line(fin[i], finTop[i], P.accD, 0.7);
  pen.poly([[pts[0][0] + 1, pts[0][1] + 1], [pts[0][0] - 10, pts[0][1] - 7 - Math.sin(ph) * 1.4], [pts[0][0] - 12, pts[0][1] + 1], [pts[0][0] - 9, pts[0][1] + 8 + Math.sin(ph) * 1.4]], P.mem);
  tube(pen, pts, rad, P.body, { ol: P.seam, belly: P.belly, from: 4, to: N - 2, plate: 2, plateK: P.seam, bellyW: 0.42, scale: P.bodyL, scaleD: P.bodyD, step: 1, edge: P.bodyL });
  // the pattern of water on its flanks: waves in a lighter blue
  for (let i = 4; i < N - 2; i += 2) { const [nx, ny] = belly(pts, i), q = pts[i], r = rad[i]; for (const f of [-0.3, 0.12]) pen.line([q[0] + nx * r * f - 1.4, q[1] + ny * r * f + 0.4], [q[0] + nx * r * f + 1.4, q[1] + ny * r * f - 0.5], P.accL, 0.8); }
  // fins just behind the head
  const fp = pts[N - 4], [fnx, fny] = belly(pts, N - 4);
  pen.poly([[fp[0] + fnx * 3, fp[1] + fny * 3], [fp[0] + fnx * 3 - 8, fp[1] + fny * 3 + 7 + Math.sin(ph) * 1.2], [fp[0] + fnx * 3 + 2, fp[1] + fny * 3 + 7]], P.mem);
  const hd = pts[N], ang = dirAng(pts[N - 3], hd) * 0.5 + lunge * 0.25;
  const h = head(pen, hd[0] + 3, hd[1] - 1, { sz: 1.3, ang, open: z.open, style: 'east', horns: 'swept', hk: 0.8, eye: z.shut ? 'shut' : 'tear', frill: P.mem, whisk: P.accL, sway: ph, cheek: false, pupil: P.ink }, P);
  const hx = hd[0], hy = hd[1];
  return {
    mouth: h.mouth, ang: ang + 0.2, breath: 'water', shadow: { cx: z.c.cx, cy: z.c.foot, rx: 66 * z.s, ry: 2.5 },
    after: (f) => {
      // water runs from the eyes and beads in the air round the head; a skin of water on the ground
      for (let i = 0; i < 8; i++) { const a = rnd('sa', i) * 6.28, d = 12 + rnd('sa', i + 9) * 10, y = hy - 4 + Math.sin(a) * d * 0.8 + ((t + i) % 3) * 2; const x = hx + 4 + Math.cos(a) * d; blend(f, pen.X(x), pen.Y(y), '#d8f4ff', 0.9); blend(f, pen.X(x), pen.Y(y) + 1, '#7ac0d8', 0.8); }
      for (let i = 0; i < 6; i++) { const x = -80 + i * 28 + (t % 2) * 4; ovEll(f, pen.X(x), pen.Y(-1), 10 * z.s * 0.4 + 6, 1, '#cfe8f4', 0.3); }
    },
  };
}

// ── Thalassa and Niveri: the serpents of the water and of the fog ────────────────────────────────────────────────────────────────────────
function thalassa(z: Z): Out {
  const { pen, p, P, ph, strike, t, L } = z;
  const niv = L.id === 'dragon_15', N = 36, lunge = Math.max(0, strike);
  const pts = spine(N, (u) => [-94 + 160 * u + lunge * 8 * u, -52 - 12 * u ** 1.4 - (niv ? 30 : 36) * Math.sin(u * 8.2 + ph * 0.6) * (0.55 + 0.45 * u) + lunge * 8 * smooth(0.84, 1, u)]);
  const rad = pts.map((_, i) => { const u = i / N; return (niv ? 0.8 + 8.2 : 0.9 + 11) * Math.min(1, u * 2.2) ** 0.75 * (1 - 0.3 * smooth(0.7, 1, u)) + 0.4; });
  const finM = z.P.mem;
  // fins along the back
  for (let i = 4; i < N - 3; i += 2) { const [nx, ny] = belly(pts, i), q = pts[i], r = rad[i]; const bx = q[0] - nx * r, by = q[1] - ny * r; pen.poly([[bx - 1.6, by + 0.6], [bx - nx * 6 - 2.2, by - ny * 6], [bx + 1.8, by + 0.6]], finM); pen.line([bx, by], [bx - nx * 5.4 - 1.6, by - ny * 5.4], P.accL, 0.6); }
  tube(pen, pts, rad, P.body, { ol: niv ? P.seam : P.seam, belly: P.belly, from: 5, to: N - 2, plate: 1, plateK: P.seam, bellyW: 0.42, scale: P.bodyL, scaleD: P.bodyD, step: 1 });
  const glowL = P.glowL;
  if (!niv) {
    // glowing veins down the back and the flank, and the eyes in a row along the body (silver-cold, one every few scales)
    const gl: Pt[] = [], gl2: Pt[] = [];
    for (let i = 5; i < N - 2; i++) { const [nx, ny] = belly(pts, i), q = pts[i], r = rad[i]; gl.push([q[0] - nx * r * 0.62, q[1] - ny * r * 0.62]); gl2.push([q[0] + nx * r * 0.1, q[1] + ny * r * 0.1]); }
    pen.chain(gl, gl.map(() => 0.5), P.glow);
    for (let i = 0; i < gl2.length; i += 3) pen.line(gl2[i], gl2[Math.min(gl2.length - 1, i + 1)], P.glow, 0.7);
    for (let i = 9; i < N - 3; i += 4) { const [nx, ny] = belly(pts, i), q = pts[i], r = rad[i], e: Pt = [q[0] - nx * r * 0.25, q[1] - ny * r * 0.25]; pen.ell(e[0], e[1], 2.2, 1.7, P.ink); pen.ell(e[0], e[1], 1.5, 1.1, P.eye); pen.dot(e[0] + 0.2, e[1], z.shut ? P.ink : P.glowL, 0.8); }
  } else {
    for (let i = 6; i < N - 2; i += 2) { const [nx, ny] = belly(pts, i), q = pts[i], r = rad[i]; pen.px(q[0] - nx * r * 0.5, q[1] - ny * r * 0.5, P.bodyL); }
  }
  void glowL;
  const hd = pts[N], ang = dirAng(pts[N - 3], hd) * 0.5 + lunge * 0.3;
  const hopt: HeadO = niv
    ? { sz: 1.4, ang, open: z.open, style: 'east', horns: 'none', eye: z.shut ? 'shut' : 'normal', pupil: undefined, cheek: false, whisk: P.accL, sway: ph, mane: P.accD }
    : { sz: 1.4, ang, open: z.open, style: 'east', horns: 'antler', hk: 0.8, eye: z.shut ? 'shut' : 'normal', pupil: undefined, frill: P.mem, cheek: false, whisk: P.accL, sway: ph, fangs: false };
  const h = head(pen, hd[0] + 3, hd[1] - 1, hopt, P);
  const out: Out = { mouth: h.mouth, ang: ang + 0.2, breath: niv ? 'wind' : 'water', shadow: { cx: z.c.cx, cy: z.c.foot, rx: 70 * z.s, ry: 2.4 } };
  if (niv) out.fade = (x) => 0.32 + 0.68 * smooth(0.02, 0.62, x / z.c.w) ;
  out.after = (f) => {
    // mist rolls off the body: soft, wide and low
    for (let i = 0; i < 12; i++) { const q = along(pts, rnd(L.id, i)), r = 5 + rnd(L.id, i + 5) * 6, d = ((t + i) % 4) * 1.2; ovEll(f, pen.X(q[0] - d), pen.Y(q[1] + 6 + rnd(L.id, i + 9) * 10), r * z.s, r * z.s * 0.34, niv ? '#f0f4f8' : '#bfe8ee', niv ? 0.24 : 0.16); }
  };
  void p;
  return out;
}

// ── Silvera: coiled in the roots until the two cannot be told apart ──────────────────────────────────────────────────────────────────────
function coil(z: Z): Out {
  const { pen, p, P, ph, strike, t } = z;
  const lunge = Math.max(0, strike);
  const N = 44;
  // the body: two turns of a coil (an ellipse seen from above), then the neck that rises out of the middle
  const turns = 2.1, base = spine(N, (u) => {
    if (u < 0.78) { const k = u / 0.78, th = k * turns * Math.PI * 2 + 0.6; return [-6 + (46 - k * 8) * Math.cos(th), -14 - 11 * Math.sin(th) - k * 26]; }
    const k = (u - 0.78) / 0.22; return [-6 + 44 * k * 0.6 - 4 + lunge * 10 * k, -38 - 42 * k * 1.0 + lunge * 6 * k + Math.sin(ph) * 1.5 * k];
  });
  const depthOf = (i: number): number => { if (i / N >= 0.78) return 1; const k = i / N / 0.78, th = k * turns * Math.PI * 2 + 0.6; return Math.sin(th); };
  const pts = base.map(([x, y], i) => [x, y] as Pt);
  const rad = pts.map((_, i) => { const u = i / N; return 0.8 + 7.4 * Math.min(1, u * 3) ** 0.8 * (1 - 0.34 * smooth(0.82, 1, u)); });
  const bark = p.mat('#4a3622', { deep: true }), barkD = p.mat('#2e2216'), moss = p.mat('#6a8a3a', { deep: true }), mossL = p.mat('#9ab04a'), leaf = p.mat('#4a7a30'), leafL = p.mat('#7aa040');
  // the roots that rise from the ground and run through the coil
  const root = (x0: number, y0: number, x1: number, y1: number, bend: number, r: number): void => { const m: Pt = [(x0 + x1) / 2 + bend, (y0 + y1) / 2]; pen.chain([[x0, y0], m, [x1, y1]], [r, r * 0.8, r * 0.5], barkD); pen.chain([[x0, y0], m, [x1, y1]], [r - 0.6, r * 0.8 - 0.6, 0.4], bark); };
  for (const [x0, x1, y1] of [[-64, -34, -4], [-52, -20, -2], [52, 30, -3], [66, 40, -5], [-8, 14, -1]] as const) pen.chain([[x0, -0.5], [(x0 + x1) / 2, y1 - 3], [x1, y1 - 3]], [2.8, 2.2, 1.6], barkD);
  for (const [x0, x1, y1] of [[-64, -34, -4], [-52, -20, -2], [52, 30, -3], [66, 40, -5], [-8, 14, -1]] as const) pen.chain([[x0, -1], [(x0 + x1) / 2, y1 - 3.4], [x1, y1 - 3.4]], [1.8, 1.4, 0.9], bark);
  // far half of the coil (behind), near half in front: each segment draws in the order of its depth
  const seg = (i: number, mat: number): void => { tube(pen, pts.slice(i, i + 2), rad.slice(i, i + 2), mat, {}); };
  for (let i = 0; i < N; i++) if (depthOf(i) < 0) pen.chain(pts.slice(i, i + 2), rad.slice(i, i + 2).map((r) => r + 0.9), P.seam);
  for (let i = 0; i < N; i++) if (depthOf(i) < 0) seg(i, P.bodyD);
  for (let i = 0; i < N; i++) if (depthOf(i) >= 0) pen.chain(pts.slice(i, i + 2), rad.slice(i, i + 2).map((r) => r + 0.9), P.seam);
  for (let i = 0; i < N; i++) if (depthOf(i) >= 0) seg(i, P.body);
  // the belly of the near turns and the scales
  const nearIdx = pts.map((_, i) => i).filter((i) => depthOf(i) >= 0 && i > 2);
  for (const i of nearIdx) { const [nx, ny] = belly(pts, i), q = pts[i], r = rad[i]; pen.dot(q[0] + nx * r * 0.45, q[1] + ny * r * 0.45, P.belly, r * 0.5); if (i % 2) { pen.px(q[0] - nx * r * 0.4, q[1] - ny * r * 0.4, P.bodyL); pen.px(q[0] - nx * r * 0.1, q[1] - ny * r * 0.1, P.bodyD); } }
  // moss, bark ridges and small trees growing on its back
  for (let i = 6; i < N - 6; i += 2) { const [nx, ny] = belly(pts, i), q = pts[i], r = rad[i]; if (depthOf(i) < 0) continue; pen.ell(q[0] - nx * r * 0.7, q[1] - ny * r * 0.7, 2.6, 1.5, i % 4 ? moss : mossL); }
  const tree = (x: number, y: number, hh: number): void => { pen.rect(x - 0.7, y - hh * 0.4, 1.6, hh * 0.45, barkD); pen.poly([[x - 4.4, y - hh * 0.3], [x, y - hh], [x + 4.4, y - hh * 0.3]], leaf); pen.poly([[x - 3, y - hh * 0.58], [x, y - hh * 1.14], [x + 3, y - hh * 0.58]], leafL); };
  for (const i of [10, 17, 24, 30]) { const [nx, ny] = belly(pts, i), q = pts[i], r = rad[i]; if (depthOf(i) >= 0) tree(q[0] - nx * r * 0.8, q[1] - ny * r * 0.8 + 1, 9 + (i % 3) * 2); }
  // roots over the coil, vines hanging from it
  for (const [i, s] of [[14, 1], [22, -1], [28, 1], [34, -1]] as const) { const q = pts[i], r = rad[i]; pen.chain([[q[0] - 2, q[1] - r], [q[0] + 2.6 * s, q[1]], [q[0] - 0.6 * s, q[1] + r + 1]], [1, 1.1, 0.6], bark); }
  for (let k = 0; k < 6; k++) { const q = pts[8 + k * 5], r = rad[8 + k * 5]; if (depthOf(8 + k * 5) < 0) continue; const x = q[0] + 1, y = q[1] + r; pen.line([x, y], [x + Math.sin(ph + k) * 0.8, y + 6 + (k % 3) * 2], leaf, 0.8); pen.dot(x + Math.sin(ph + k) * 0.8, y + 7 + (k % 3) * 2, leafL, 1.6); }
  // the head, a trunk with branches for horns and a hollow for an eye
  const hd = pts[N], ang = dirAng(pts[N - 3], hd) * 0.4 + lunge * 0.3;
  for (let k = 0; k < 4; k++) pen.poly([[hd[0] - 6 - k * 2, hd[1] - 5 + k * 1.5], [hd[0] - 10 - k * 3, hd[1] - 4 + k * 2.6], [hd[0] - 6 - k * 2, hd[1] - 1 + k]], k % 2 ? leaf : moss);
  const h = head(pen, hd[0] + 3, hd[1] - 1, { sz: 1.6, ang, open: z.open, horns: 'antler', hk: 1.1, eye: z.shut ? 'shut' : 'hollow', cheek: false, beard: true, sway: ph, fangs: false }, P);
  pen.ell(h.top[0] + 3, h.top[1] + 2, 3, 1.4, moss);
  const out: Out = { mouth: h.mouth, ang: ang + 0.3, breath: 'spore', shadow: { cx: z.c.cx, cy: z.c.foot, rx: 66 * z.s, ry: 3 } };
  out.after = (f) => { void t; void blend; void mix; };
  return out;
}
