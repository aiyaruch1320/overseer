// The dragons of a western build: four legs, a long neck, wings on the shoulders (Eternal Flame, Hrod-Gath, Caldra, the fire, ice and wyrmling
// of the monster table), and the wyverns, whose wings are their arms (Storm, Serene, the wyvern, the ash drake).
import type { Pt } from '../paint';
import type { Out, Z } from './dragon';
import { head, leg, makePal, spine, tailTip, tube, wing, type HeadO } from './dragon-parts';
import { dark, light, rnd } from './kit';

interface Q {
  bulk: number; bodyY: number; legR: number; legLen: number; neckUp: number; neckLen?: number;
  wing: 'big' | 'small' | 'bone' | 'none'; ridge: 'spikes' | 'flames' | 'crystal' | 'bones' | 'none';
  ribs?: boolean; crater?: boolean; seams?: boolean; tail: 'spade' | 'blade' | 'club' | 'flame' | 'none'; head: Partial<HeadO>; headSz: number; eyeShut?: boolean;
  twin?: boolean; bones?: boolean; crack?: boolean; scaleGlow?: boolean; breath: NonNullable<Out['breath']>; low?: boolean; legs4?: boolean; pipes?: boolean; silk?: boolean; barb?: boolean; headDown?: number; fold?: boolean;
}
const Qs: Record<string, Q> = {
  stout: { bulk: 1, bodyY: -25, legR: 3.5, legLen: 11, neckUp: 1, wing: 'small', ridge: 'flames', tail: 'flame', head: { horns: 'swept', fangs: true, eye: 'big' }, headSz: 1.38, scaleGlow: true, breath: 'fire' },
  // Throkad the Flame (KD07-1): a big copper dragon, the wings folded like heavy cloth, long curved horns, a black stone crown
  copper: { bulk: 1.12, bodyY: -26, legR: 3.9, legLen: 12, neckUp: 0.95, wing: 'small', ridge: 'spikes', tail: 'spade', head: { horns: 'swept', fangs: true, eye: 'big', hk: 1.3 }, headSz: 1.45, breath: 'fire', fold: true },
  fire: { bulk: 1, bodyY: -25, legR: 3.5, legLen: 11, neckUp: 1, wing: 'big', ridge: 'flames', tail: 'flame', head: { horns: 'swept', fangs: true }, headSz: 1.35, breath: 'fire' },
  ice: { bulk: 1, bodyY: -25, legR: 3.5, legLen: 11, neckUp: 1, wing: 'big', ridge: 'crystal', tail: 'spade', head: { horns: 'antler', fangs: true }, headSz: 1.3, breath: 'ice' },
  wyrmling: { bulk: 0.9, bodyY: -22, legR: 3, legLen: 10, neckUp: 0.9, wing: 'small', ridge: 'spikes', tail: 'spade', head: { horns: 'stub', fangs: false }, headSz: 1.5, breath: 'fire' },
  skeletal: { bulk: 0.7, bodyY: -26, legR: 2.6, legLen: 12, neckUp: 1.05, wing: 'bone', ridge: 'bones', ribs: true, bones: true, crack: true, tail: 'blade', head: { style: 'skull', horns: 'swept', teeth: 'long', fangs: true, eye: 'blind', hk: 1.15 }, headSz: 1.5, breath: 'smoke' },
  twohead: { bulk: 0.95, bodyY: -25, legR: 3.3, legLen: 11, neckUp: 0.78, wing: 'big', ridge: 'spikes', tail: 'blade', twin: true, head: { horns: 'swept', fangs: true, eye: 'normal' }, headSz: 1.3, breath: 'fire' },
  lava: { bulk: 1.28, bodyY: -19, legR: 6, legLen: 7, neckUp: 0.4, neckLen: 0.8, wing: 'none', ridge: 'none', crater: true, seams: true, tail: 'none', head: { horns: 'ram', eye: 'shut', hk: 1.1 }, headSz: 1.75, low: true, breath: 'lava', headDown: 8 },
};

export function westShape(z: Z): Out {
  if (['slender', 'wyvern', 'ashdrake'].includes(z.L.form)) return wyvern(z);
  return quad(z, Qs[z.L.form] ?? Qs.stout);
}

function quad(z: Z, q: Q): Out {
  const { pen, p, P, ph, strike, walk, t, mo } = z;
  const B = q.bulk, b = q.bodyY, sk = !!q.bones;
  const lunge = Math.max(0, strike) + z.mo.die * 0.9;
  // ── the spine: tail, body, neck, from the tip of the tail to the back of the head
  const nl = q.neckLen ?? 1;
  const tw = Math.sin(ph) * 1.6;
  const hdn = (q.headDown ?? 0) * 0.5;
  const pts: Pt[] = [
    [-56, b + 5 + tw], [-47, b + 11 + tw * 0.5], [-37, b + 12], [-27, b + 7],
    [-18, b + 1], [-6, b - 0.5], [6, b - 0.5], [16, b + 0.5],
    [23 + lunge * 3, b - 4 * q.neckUp + hdn * 0.3], [29 * nl + lunge * 6, b - 13 * q.neckUp * nl + lunge * 4 + hdn * 0.6], [34 * nl + lunge * 8, b - 21 * q.neckUp * nl + lunge * 7 + hdn], [37 * nl + lunge * 9, b - 27 * q.neckUp * nl + lunge * 9 + hdn * 1.3],
  ];
  const rad = [0.8, 2, 3.4, 5.2, 7.4 * B, 9.2 * B, 10.4 * B, 10 * B, 8 * B, 6.2 * B, 5.1 * B, 4.4 * B];
  if (sk) { rad[5] = 8; rad[6] = 8.6; rad[7] = 8.4; rad[4] = 6; }
  const body = P.body;
  const hipY = b + 6, ground = 0;
  const stride = 4.2, lift = 3.2;
  const step = (off: number): Pt => walk ? [Math.sin(ph + off) * stride, -Math.max(0, Math.cos(ph + off)) * lift] : [0, 0];
  const L = (x: number, off: number, far: boolean, hind: boolean): void => {
    const [dx, dy] = step(off), len = q.legLen;
    leg(pen, [x, hipY + (hind ? 1 : 0)], { a: len, b: len + (hind ? 1.5 : 0), foot: [x + 1 + dx, ground + dy], hind, r: q.legR * (hind ? 1.08 : 1), k: far ? P.bodyD : body, ol: P.seam, claw: P.claw, paw: far ? 1.9 : 2.2 });
  };
  const hindX = -17, frontX = 13;
  // bones scattered on the dry ground (Hrod-Gath)
  if (q.crack) groundBones(z);
  L(hindX - 6, 0.6 + Math.PI, true, true); L(frontX - 6, Math.PI * 0.2, true, false);
  // far wing (darker, behind the body)
  const P2 = q.twin && z.alt ? makePal(p, z.alt.main, z.alt.second, z.alt.eye) : P;
  const wopt = (up: number, span: number, far: boolean) => ({ span, up, mem: far ? P2.mem : P.mem, memD: far ? P2.memD : P.memD, memL: far ? P2.memL : P.memL, bone: far ? P2.horn : P.horn, bone2: P.horn, ol: P.seam, hip: [-14, b + 3] as Pt, fingers: q.wing === 'small' ? 3 : 4, ragged: q.wing === 'bone' });
  const sh: Pt = [8, b - 8];
  const span = q.wing === 'big' ? 54 : q.wing === 'bone' ? 60 : 38;
  if (q.wing !== 'none') wing(pen, [sh[0] - 3, sh[1] + 1], { ...wopt(q.fold ? 0 : Math.max(0, z.flap - 0.18), span * (q.fold ? 0.7 : 0.92), true), hip: [-18, b + 2] });
  // the second neck of a two-headed dragon rises behind the first, dark where the other is bright
  let far: { mouth: Pt; ang: number } | null = null;
  if (q.twin) {
    const sw2 = Math.sin(ph + 1) * 1.6;
    const n2: Pt[] = [[8, b - 1], [12, b - 12], [14 + sw2, b - 24 - lunge * 2], [19 + sw2, b - 36 - lunge * 3]];
    tube(pen, n2, [8, 5.8, 4.8, 4.2], P2.body, { ol: P2.seam, belly: P2.belly, plate: 1, plateK: P2.seam, bellyW: 0.46, scale: P2.bodyL, scaleD: P2.bodyD, step: 1 });
    const h2 = head(pen, n2[3][0] + 4, n2[3][1] - 2, { sz: 1.3, ang: -0.1 + Math.sin(ph) * 0.05, open: 0.15 + (z.mo.pose === 'attack' ? 0.2 : 0), horns: 'swept', fangs: true, eye: z.shut ? 'shut' : 'normal', pupil: undefined }, P2);
    far = { mouth: h2.mouth, ang: 0 };
  }
  void far;
  // the tail's tip, then the body
  const tipDir: Pt = [-0.9, -0.4];
  if (q.tail !== 'none') tailTip(pen, pts[0], tipDir, q.tail, P, body, P.glow);
  tube(pen, pts, rad, body, {
    ol: P.seam, belly: P.belly, from: 4, to: 10, plate: 1, plateK: P.seam, bellyW: sk ? 0.38 : 0.5,
    scale: q.scaleGlow ? P.glow : P.bodyL, scaleD: q.scaleGlow ? P.accD : P.bodyD, step: 1, edge: P.bodyL,
  });
  // the back: spikes, flames, crystals or bare bone
  const ridgeMat = q.ridge === 'crystal' ? P.accL : q.ridge === 'bones' ? P.horn : P.accD;
  if (q.ridge === 'flames') {
    for (let i = 2; i <= 10; i++) {
      const [x, y] = pts[i], r = rad[i], fh = (3.8 + (i % 3) * 1.6 + ((t + i) % 3) * 1.1) * (i > 8 ? 0.6 : 1);
      pen.poly([[x - 1.9, y - r + 1.4], [x + ((i + t) % 2 ? 0.8 : -0.5), y - r - fh], [x + 2, y - r + 1.4]], P.glow);
      pen.poly([[x - 0.8, y - r + 1.4], [x + 0.2, y - r - fh * 0.55], [x + 1.1, y - r + 1.4]], P.glowL);
    }
  } else if (q.ridge !== 'none') {
    const big = q.ridge === 'crystal' ? 6 : q.ridge === 'bones' ? 4.6 : 3.8;
    for (let i = 1; i <= 10; i++) {
      const [x, y] = pts[i], r = rad[i], h = big * (0.65 + 0.35 * Math.min(1, r / 6)) * (i % 2 ? 1 : 0.8);
      pen.poly([[x - 1.8, y - r + 1.3], [x + 0.2 - (q.ridge === 'crystal' ? 0 : 1), y - r - h], [x + 1.8, y - r + 1.3]], ridgeMat);
    }
  }
  if (q.seams) { // the orange of a forge at every join of the plates
    for (let i = 4; i <= 9; i++) { const [x, y] = pts[i], r = rad[i]; pen.line([x - 1, y - r * 0.9], [x + 1.5, y + r * 0.35], P.glow, 1.3); pen.line([x + 1.5, y + r * 0.35], [x + 0.2, y + r * 0.85], P.glowL, 0.8); }
    for (let i = 0; i < 4; i++) pen.line([-26 + i * 9, b + 7 - i], [-23 + i * 9, b + 13 - i], P.glow, 1);
  }
  if (q.ribs) ribs(z, pts, rad);
  // the near legs
  L(hindX, 0, false, true); L(frontX, Math.PI * 0.8 + 0.2, false, false);
  // the shoulder and hip are heavier than the tube alone says
  if (q.wing !== 'none') wing(pen, sh, wopt(q.fold ? 0.05 : z.flap, span * (q.fold ? 0.8 : 1), false));
  if (q.crater) crater(z, pts, rad);
  // the head
  const end = pts[11];
  const ang = 0.18 + lunge * 0.55 + (z.mo.dead ? 0.4 : 0) + (q.low ? 0.55 : 0);
  const hd = head(pen, end[0] + 4.5, end[1] + (q.low ? -0.5 : -1.5), {
    sz: q.headSz, ang, open: z.open, eye: z.shut && q.head.eye !== 'shut' ? 'shut' : q.head.eye ?? 'normal', pupil: P.ink, ...q.head,
  }, P);
  void rnd; void light; void dark;
  if (z.L.id === 'KD07-1') {
    // a thin black stone crown on the horns, a little tilted
    const [x, y] = hd.top;
    pen.poly([[x - 5.5, y - 0.5], [x + 4.5, y - 3.2], [x + 5.2, y - 0.8], [x - 4.8, y + 1.8]], P.ink);
    for (let i = 0; i < 4; i++) pen.poly([[x - 4.2 + i * 2.7, y + 0.8 - i * 0.7], [x - 3.2 + i * 2.7, y - 3.4 - i * 0.7 - (i % 2)], [x - 2.2 + i * 2.7, y + 0.4 - i * 0.7]], P.ink);
  }
  if (q.head.eye === 'shut' && !z.mo.dead && q.crater) { const e = hd.eye; pen.line([e[0] - 1.6, e[1] + 0.9], [e[0] + 2.6, e[1] + 1.1], P.glow, 0.9); }
  // a glow in the mouth and nose at the strike
  const out: Out = { mouth: hd.mouth, ang: ang + 0.3, breath: q.breath };
  out.after = (f) => {
    if (q.breath === 'fire' && z.open > 0.5) pen.dot(hd.mouth[0] - 3, hd.mouth[1], P.glowL, 2);
  };
  return out;
}

function ribs(z: Z, pts: Pt[], rad: number[]): void {
  const { pen, P } = z;
  for (let i = 4; i <= 8; i++) {
    const [x, y] = pts[i], r = rad[i];
    pen.chain([[x - 0.6, y - r * 0.75], [x + 1.8, y - r * 0.05], [x + 0.8, y + r * 0.7]], [0.8, 0.9, 0.7], P.horn);
    pen.line([x + 1.2, y - r * 0.3], [x + 1.6, y + r * 0.3], P.hornD, 0.6);
  }
  // spine knuckles and the hip bones that stand out
  for (let i = 3; i <= 9; i++) pen.dot(pts[i][0], pts[i][1] - rad[i] + 0.3, P.horn, 1.6);
  pen.poly([[-21, pts[4][1] - 6], [-17, pts[4][1] - 10.5], [-14, pts[4][1] - 5]], P.horn);
}

function crater(z: Z, pts: Pt[], rad: number[]): void {
  const { pen, p, P, L } = z;
  const base = pts[6];
  // a cone of black glass on the back with a lake of lava in the mouth, and a rim that glows
  const rock = P.bodyD, top = base[1] - rad[6] + 2;
  pen.poly([[base[0] - 34, top + 4], [base[0] - 18, top - 7], [base[0] - 8, top - 15], [base[0] + 8, top - 16], [base[0] + 18, top - 7], [base[0] + 34, top + 4]], P.seam);
  pen.poly([[base[0] - 32, top + 4], [base[0] - 17, top - 6], [base[0] - 7, top - 14], [base[0] + 7, top - 15], [base[0] + 17, top - 6], [base[0] + 32, top + 4]], rock);
  pen.poly([[base[0] - 7, top - 14], [base[0] - 17, top - 6], [base[0] - 12, top - 4], [base[0] - 4, top - 11]], P.bodyL);
  for (let i = 0; i < 5; i++) pen.line([base[0] - 24 + i * 11, top + 2 - (i % 2) * 2], [base[0] - 20 + i * 11, top - 4 - (i % 2) * 3], P.seam, 0.9);
  pen.ell(base[0], top - 15.5, 8, 2.2, P.glow);
  pen.ell(base[0], top - 15.8, 5.4, 1.3, P.glowL);
  for (const [dx, dy] of [[-12, -2], [10, -4], [-3, -8], [20, 1]] as const) pen.line([base[0] + dx, top + dy], [base[0] + dx + 1.6, top + dy + 5], P.glow, 0.9);
  void p; void L;
}

function groundBones(z: Z): void {
  const { pen, P } = z;
  // the ribs and the skull of other dragons, half buried in cracked earth
  const arc = (x: number, h: number, n: number) => { for (let i = 0; i < n; i++) pen.chain([[x + i * 3.2, 0.5], [x + i * 3.2 + 0.8, -h], [x + i * 3.2 + 2.4, -h * 0.75]], [0.9, 0.7, 0.4], P.horn); };
  arc(-52, 6, 4); arc(28, 5, 3);
  pen.ell(52, -1.4, 4.8, 2.6, P.horn); pen.dot(50.5, -1.8, P.ink, 1.4); pen.poly([[55, -1], [58, -0.2], [55, 0.4]], P.horn);
  pen.line([-60, 0.4], [-44, 0.4], P.seam, 0.6); pen.line([40, 0.4], [58, 0.4], P.seam, 0.6);
}

// ── the wyverns: the wings are the arms ─────────────────────────────────────────────────────────────────────────────────────────────
function wyvern(z: Z): Out {
  const { pen, p, P, ph, strike, walk, t, words, L } = z;
  const pipes = words.includes('pipes'), silk = words.includes('silkwings'), storm = L.id === 'dragon_04', ash = L.form === 'ashdrake', serene = pipes;
  const b = -22, lunge = Math.max(0, strike) + z.mo.die * 0.9;
  const tw = Math.sin(ph) * 2.2;
  const pts: Pt[] = [
    [-52, b + 14 + tw], [-44, b + 16 - tw * 0.4], [-34, b + 12], [-24, b + 6],
    [-14, b + 1], [-4, b - 1], [6, b - 2],
    [12 + lunge * 3, b - 8], [17 + lunge * 6, b - 17 + lunge * 3], [22 + lunge * 8, b - 25 + lunge * 7], [26 + lunge * 9, b - 31 + lunge * 11],
  ];
  const rad = [0.7, 1.7, 3, 4.4, 6.2, 6.9, 6.4, 5, 4.1, 3.5, 3.2];
  if (serene) { rad[4] = 5.2; rad[5] = 5.6; rad[6] = 5.2; }
  const stepOf = (off: number): Pt => walk ? [Math.sin(ph + off) * 4, -Math.max(0, Math.cos(ph + off)) * 3] : [0, 0];
  const legOf = (x: number, off: number, far: boolean, hind: boolean): void => {
    const [dx, dy] = stepOf(off);
    leg(pen, [x, b + 5], { a: 10, b: 11, foot: [x + dx, dy], hind, r: hind ? 3.1 : 2.4, k: far ? P.bodyD : P.body, ol: P.seam, claw: P.claw, paw: far ? 1.8 : 2 });
  };
  legOf(-10, Math.PI, true, true);
  if (serene) legOf(7, Math.PI * 0.3, true, false);
  // wings: far (darker) first
  const wf = z.flap;
  const mem = silk ? P.mem : P.mem, wi = (up: number, span: number, far: boolean) => ({
    span, up, mem: far ? P.memD : mem, memD: far ? P.accD : P.memD, memL: far ? P.mem : P.memL, bone: far ? P.accD : silk ? P.bodyD : P.horn, bone2: silk ? P.accD : P.horn, ol: silk ? P.seam : P.seam,
    hip: [-12, b + 3] as Pt, fingers: silk ? 5 : ash ? 4 : 3, ragged: ash, sag: silk ? 2 : 0,
  });
  const span = storm ? 56 : silk ? 54 : ash ? 48 : 44;
  if (!serene) wing(pen, [5, b - 4], wi(Math.max(0, wf - 0.2), span * 0.9, true));
  // tail barb or ribbon fin, then the body
  if (L.form === 'wyvern' || ash) tailTip(pen, pts[0], [-0.95, -0.3], 'blade', P, P.body, P.glow);
  else if (storm) tailTip(pen, pts[0], [-0.95, -0.3], 'fin', P, P.body);
  tube(pen, pts, rad, P.body, { ol: P.seam, belly: P.belly, from: 3, to: 9, plate: 1, plateK: P.seam, scale: P.bodyL, scaleD: P.bodyD, edge: P.bodyL, ridge: storm ? P.accL : P.horn, rh: storm ? 2.6 : 3.2, rstep: serene ? 2 : 1, rfrom: 2, rto: 9 });
  if (serene) legOf(11, Math.PI * 1.2, false, false);
  legOf(-5, 0, false, true);
  pen.ell(-5, b + 2, 4.4, 4.6, P.bodyL);
  if (!serene) wing(pen, [7, b - 5], wi(wf, span, false));
  if (pipes) pipesThrough(z, pts, rad);
  const end = pts[10];
  const ang = 0.12 + lunge * 0.5;
  const hd = head(pen, end[0] + 4, end[1] - 1.5, {
    sz: storm ? 1.45 : serene ? 1.3 : 1.35, ang, open: z.open, horns: storm ? 'stub' : 'swept', fangs: !storm, eye: storm ? 'big' : serene ? 'slit' : 'normal', pupil: storm ? undefined : P.ink,
    style: 'west', cheek: !storm, mane: serene ? P.accD : undefined,
  }, P);
  void p; void t;
  const out: Out = { mouth: hd.mouth, ang: ang + 0.35, breath: storm ? 'wind' : L.form === 'ashdrake' ? 'smoke' : serene ? 'smoke' : 'fire' };
  if (serene) out.after = (f) => {
    // the blue light that flickers out of rhythm; the factory chimneys on its back stand in the frame
    const blink = z.mo.f % 2 || z.mo.pose === 'attack' ? '#9ae4ff' : '#4ab0e0';
    pen.dot(hd.eye[0], hd.eye[1], P.glowL, 1.4);
    void blink; void f;
  };
  return out;
}

function pipesThrough(z: Z, pts: Pt[], rad: number[]): void {
  const { pen, P, t } = z;
  const oil = P.ink, metal = z.p.mat('#34363e', { deep: true }), rim = z.p.mat('#5a5e68'), blue = z.p.mat('#6ad0ff', { flat: true });
  const spec: [number, number, number][] = [[3, -0.5, 1], [4, 0.45, 1], [5, -0.2, 1], [6, 0.3, 1], [2, 0.7, -1], [4, -0.6, -1]];
  spec.forEach(([i, a, sgn], k) => {
    const [x, y] = pts[i], r = rad[i];
    const x0 = x + a * 4, y0 = sgn > 0 ? y - r + 2 : y + r - 2;
    const tip: Pt = [x0 + Math.sin(a) * 9, y0 - sgn * Math.cos(a) * 12];
    pen.line([x0, y0], tip, rim, 3); pen.line([x0, y0], tip, metal, 2);
    pen.dot(tip[0], tip[1], rim, 3.2); pen.dot(tip[0], tip[1], (z.mo.f + k) % 2 ? blue : metal, 1.6);
    // black oil runs out where the iron goes in
    for (let j = 0; j < 3; j++) pen.dot(x0 + (sgn > 0 ? 1 : -0.5), y0 + 1.5 + j * 3 + ((t * 2 + j) % 3), oil, 1.1);
  });
  // chimneys of the factory that stands on the back
  const [bx, by] = pts[5];
  for (const dx of [-5, 2]) { pen.rect(bx + dx, by - rad[5] - 6, 3.4, 6, rim); pen.rect(bx + dx + 0.5, by - rad[5] - 6, 2.4, 6, metal); pen.dot(bx + dx + 1.7, by - rad[5] - 6.6 - ((t + dx) % 2), P.bodyL, 1.4); }
}
