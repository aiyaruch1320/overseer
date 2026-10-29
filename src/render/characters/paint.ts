// Paints one frame of one person as vector art. Everything is drawn in "units" (see kit.ts) and scaled to whatever resolution the
// caller wants, so the same code gives the 14-pixel person walking in the street and the 600-pixel portrait in a card.
import { poseOf, POSE, walkPhase, DIRECTIONAL, type Pose } from './pose';
import { themeOf, type Line } from './themes';
import {
  type Cx, type Look, type View, FOOT, CX, FW, FH, stageOfLook, hex, rgba, mix, shade, lite, lineOf, INK, jitter, ik,
  ell, poly, rrect, stroke, curve, lin, rad, glow,
} from './kit';
import { hairBack, hairFront, hatBack, hatFront, beard, drawTool } from './gear';
import { wingsBack, tailBack, serpentBody, gownBody, slimeBody, headBack, ears } from './feat';

const TAU = Math.PI * 2;
const ST = { infant: { sz: 0.42, hs: 1.55 }, child: { sz: 0.68, hs: 1.2 }, teen: { sz: 0.9, hs: 1.07 }, adult: { sz: 1, hs: 1 }, elder: { sz: 0.96, hs: 1 } };
const PU = 1.38; // pose offsets were authored for a shorter body

export function featuresOf(L: Look): Set<string> {
  const th = themeOf(L.race), ln: Line | undefined = L.line ? th.lines[L.line] : undefined;
  const s = new Set(th.feats);
  for (const f of ln?.drop || []) s.delete(f);
  for (const f of ln?.add || []) s.add(f);
  for (const f of L.extra || []) { if (f.startsWith('-')) s.delete(f.slice(1)); else s.add(f); }
  return s;
}

// how a people carries itself: the heavy stamp (more bounce, a lean), the glide (almost none), the shamble (dragging), the float
const GAIT_BOB: Record<string, number> = { normal: 1, stomp: 1.35, glide: 0.35, hop: 1.8, shamble: 0.7, float: 0.5 };
function gaited(p: Pose, frame: number, gait: string): Pose {
  if (gait === 'normal') return p;
  const walking = (frame >= POSE.walk0 && frame <= POSE.walk7) || frame === POSE.carry1 || frame === POSE.carry2;
  const q = { ...p };
  if (walking) { q.bob = p.bob * GAIT_BOB[gait]; if (gait === 'shamble') { q.lean += 1.2; q.tilt += 0.03; } if (gait === 'stomp') q.sway *= 1.8; }
  if (gait === 'float') q.hover += 2.6;
  return q;
}

function makeCx(c: CanvasRenderingContext2D, L: Look, frame: number, view: View = 'front'): Cx {
  const theme = themeOf(L.race), ln = L.line ? theme.lines[L.line] : undefined, stage = stageOfLook(L), P = gaited(poseOf(frame), frame, theme.gait);
  const feats = featuresOf(L), st = ST[stage];
  const rs = ln?.scale ?? theme.scale;
  const sz = st.sz * rs * (L.tall && stage !== 'child' && stage !== 'infant' ? 1.04 : 1);
  const hsc = st.hs * theme.head * Math.pow(rs, 0.85);
  const gaunt = feats.has('gaunt');
  const wide = theme.wide * (gaunt ? 0.9 : 1) * (stage === 'child' || stage === 'infant' ? 1.1 : 1);
  const legLen = 24 * sz, torsoLen = 20 * sz * (L.build === 0 ? 1.03 : 1), armLen = 21 * sz * (gaunt ? 1.16 : 1);
  const headW = 10.6, headH = 9.6, hf = 0.66 * hsc;
  const stoop = (stage === 'elder' ? 1.3 : 0) + (feats.has('hunched') ? 1.8 : 0) + (gaunt ? 1.4 : 0) + (theme.gait === 'shamble' ? 0.6 : 0);
  const ph = walkPhase(frame), phi = ph === null ? 0 : ph * TAU, carry = frame >= POSE.carry0 && frame <= POSE.carry2;
  const side = view === 'side' && P.legs === 'stand' && DIRECTIONAL.has(frame);
  if (!side && view !== 'front' && (view === 'side' || !DIRECTIONAL.has(frame) || P.legs !== 'stand')) view = 'front'; // a pose that has no side or back drawing is drawn facing us
  const l1 = legLen * 0.49, l2 = legLen * 0.5;
  // the legs in profile: thighs swing about the hip, the knee flexes while the foot swings through; the hips sit as low as the stance foot allows
  const fk: { dx: number; dy: number }[] = [];
  if (side) {
    const A = ph === null ? 0.06 : (carry ? 0.3 : 0.46) * (theme.gait === 'glide' ? 0.8 : theme.gait === 'stomp' ? 1.1 : 1), K = ph === null ? 0 : 0.95;
    for (let n = 0; n < 2; n++) { // 0 = the far leg, 1 = the near leg
      const f = phi + (n === 0 ? Math.PI : 0), t = ph === null ? (n ? 0.08 : -0.06) : A * Math.sin(f), kf = K * Math.max(0, Math.cos(f)) * (0.55 + 0.45 * Math.abs(Math.cos(f)));
      fk.push({ dx: l1 * Math.sin(t) + l2 * Math.sin(t - kf), dy: l1 * Math.cos(t) + l2 * Math.cos(t - kf) });
    }
  }
  const drop = P.drop * 1.45 * Math.min(1, sz);
  const hipY = (side ? FOOT - P.hover * PU - Math.max(fk[0].dy, fk[1].dy) - 0.2 : FOOT - legLen + P.bob * PU * Math.min(1.2, sz) + drop - P.hover * PU);
  const shY = hipY - torsoLen - P.breath * 0.35;
  const lean = P.lean + stoop + (side ? (ph === null ? 0.4 : 1.2) : 0);
  const sx = CX + P.sway + lean * 0.6;
  const hx0 = CX + P.sway * 0.4;
  const swF = (8.9 + L.build * 0.8) * wide * sz * (L.fem ? 0.9 : 1) * (feats.has('stone') ? 1.1 : 1);
  const sw = side ? swF * 0.6 : swF;
  const ww = (swF * (L.fem ? 0.74 : 0.8)) * (side ? 0.72 : 1);
  const yaw = view === 'side' ? 0.85 : 0;
  const headX = sx + lean * 0.55 + P.tilt * -6 + (side ? 1.6 : 0);
  const headY = shY - headH * hf * 0.9 + P.nod * 0.8 + (stoop ? stoop * 0.3 : 0);
  const skin = L.skin, accent = L.accent ?? (ln?.accent?.[0] ?? theme.accent[0]), accent2 = ln?.accent?.[1] ?? theme.accent[1] ?? accent;
  const k: Cx = {
    c, L, stage, feats, P, frame, sz, hs: hsc, wide, legLen, torsoLen, armLen, hipY, shY, headX, headY, headW, headH, sw, ww, view, yaw, hf,
    sh: side ? [[sx - 0.5, shY + 1.8], [sx + 0.5, shY + 1.8]] : [[sx - (sw - 0.9), shY + 1.6], [sx + (sw - 0.9), shY + 1.6]],
    hp: side ? [[hx0 - 0.3, hipY], [hx0 + 0.3, hipY]] : [[hx0 - ww * 0.52, hipY], [hx0 + ww * 0.52, hipY]],
    hand: [], foot: [], fx: side ? 4.4 : 0, skin, hair: L.hair, accent, accent2, skinD: shade(skin, 0.8), skinL: lite(skin, 0.28), theme,
  };
  const reach = armLen * 0.94, fy = FOOT - P.hover * PU;
  if (side) {
    // arms swing against the legs: the near arm goes forward with the far leg
    const Aa = ph === null ? 0.05 : carry ? 0.0 : 0.5;
    for (let n = 0; n < 2; n++) {
      const sh = k.sh[n];
      if (P.bundle || carry && false) { k.hand[n] = [sh[0] + 4.2 * sz, sh[1] + armLen * 0.55]; continue; }
      const t = ph === null ? (n ? 0.1 : -0.08) : Aa * Math.sin(phi + (n === 1 ? Math.PI : 0)), r = armLen * (0.93 - 0.05 * Math.max(0, Math.sin(t)));
      k.hand[n] = [sh[0] + r * Math.sin(t), sh[1] + r * Math.cos(t)];
    }
    k.foot = [[hx0 + fk[0].dx, hipY + fk[0].dy + 0.3], [hx0 + fk[1].dx, hipY + fk[1].dy + 0.3]];
  } else if (ph !== null && P.legs === 'stand') {
    // seen from the front or the back the walk is a foot that reaches toward (or away from) us and a foot that trails, with the hands swinging the other way
    const dirn = view === 'back' ? -1 : 1, narrow = ww * 0.4 + 0.7;
    k.foot = [0, 1].map((n) => { const f = phi + (n ? Math.PI : 0), z = Math.sin(f), lift = Math.max(0, Math.cos(f)) * 1.3 * sz; return [hx0 + (n ? narrow : -narrow), fy - lift * 0.7 + z * 1.9 * sz ** 0.8 * dirn]; }) as [number, number][];
    k.hand = [0, 1].map((n) => { const f = phi + (n ? 0 : Math.PI), z = Math.sin(f), sh = k.sh[n]; return carry ? [sh[0] + (n ? -1.6 : 1.6), sh[1] + armLen * 0.66] : [sh[0] + (n ? 0.9 : -0.9), sh[1] + armLen * 0.985 - (1 - (z * dirn + 1) / 2) * 3 * sz ** 0.8]; }) as [number, number][];
  } else {
    const lh = k.sh[0], rh = k.sh[1];
    k.hand = [[lh[0] - 1.4 + P.lh[0] * PU * sz ** 0.5, lh[1] + reach + P.lh[1] * PU * sz ** 0.7], [rh[0] + 1.4 + P.rh[0] * PU * sz ** 0.5, rh[1] + reach + P.rh[1] * PU * sz ** 0.7]];
    const spread = P.legs === 'stand' ? ww * 0.5 + 0.9 : P.legs === 'sit' ? ww * 1.25 + 2.5 * sz : ww * 0.9 + 1.5;
    k.foot = [[hx0 - spread + P.lf[0] * PU * sz ** 0.5, fy + P.lf[1] * PU * sz ** 0.7 - (P.legs === 'stand' ? 0 : 0.5)], [hx0 + spread + P.rf[0] * PU * sz ** 0.5, fy + P.rf[1] * PU * sz ** 0.7 - (P.legs === 'stand' ? 0 : 0.5)]];
  }
  return k;
}

// ---------- outfits ----------
interface Fit { top: number; trim: number; pants: number; boot: number; sleeve: 0 | 1 | 2; skirt: 0 | 1 | 2 | 3 | 4; bare: boolean; metalArms?: boolean; cape?: number }
const CREAM = 0xf0e8d8;
function fitOf(k: Cx): Fit {
  const L = k.L, o = L.outfit, c1 = L.cloth, c2 = L.cloth2;
  const base: Fit = { top: c1, trim: c2, pants: shade(c2, 0.62), boot: 0x4a3322, sleeve: 1, skirt: 0, bare: false };
  switch (o) {
    case 'vest': return { ...base, top: CREAM, trim: c1, skirt: 4, sleeve: 2 };
    case 'armor': return { ...base, top: 0xa6adbc, trim: 0x6a7284, pants: 0x7a8294, boot: 0x4a5064, sleeve: 2, metalArms: true };
    case 'knight': return { ...base, top: 0xa6adbc, trim: c1, pants: 0x6a7284, boot: 0x3a3030, skirt: 4, sleeve: 2, metalArms: true, cape: shade(c1, 0.7) };
    case 'robe': return { ...base, top: c1, trim: 0xf2c94c, skirt: 3, sleeve: 2, boot: 0x3a2a1a };
    case 'mage': return { ...base, top: c1, trim: c2, skirt: 3, sleeve: 2, cape: shade(c1, 0.7) };
    case 'scholar': return { ...base, top: shade(c1, 0.85), trim: 0xf2c94c, skirt: 2, sleeve: 2 };
    case 'monk': return { ...base, top: 0xb06a28, trim: 0x7a4a1a, skirt: 2, sleeve: 1 };
    case 'farmer': return { ...base, top: 0xe8dcb8, trim: 0x5a7aa0, pants: 0x5a7aa0, sleeve: 1 };
    case 'apron': return { ...base, top: c1, trim: 0xd8c8a8, sleeve: 1 };
    case 'cloak': return { ...base, top: shade(c1, 0.8), trim: c2, pants: 0x3a3a4a, skirt: 4, sleeve: 2, cape: shade(c1, 0.55) };
    case 'noble': return { ...base, top: c1, trim: c2, pants: shade(c1, 0.45), skirt: 4, sleeve: 2, cape: L.pattern < 3 ? shade(c1, 0.6) : undefined };
    case 'regal': return { ...base, top: c1, trim: c2, pants: shade(c1, 0.4), skirt: 3, sleeve: 2, cape: shade(c1, 0.6) };
    case 'rags': return { ...base, top: 0x8a7a6a, trim: 0x6a5a4a, pants: 0x6a5a4a, boot: 0x6a5a4a, sleeve: 1, bare: true };
    case 'dress': return { ...base, top: c1, trim: c2, skirt: 2, sleeve: 1 };
    case 'sarong': return { ...base, top: k.skin, trim: c2, skirt: 1, sleeve: 0, bare: true };
    case 'light': return { ...base, top: 0xf0e6cc, trim: c1, skirt: 3, sleeve: 1, bare: true };
    case 'fur': return { ...base, top: 0x8a6a4a, trim: 0xe8e0d0, pants: 0x5a4a3a, boot: 0x6a4a2a, skirt: 4, sleeve: 2 };
    case 'leather': return { ...base, top: 0x7a5232, trim: 0x4a2e1a, pants: shade(c2, 0.55), skirt: 4, sleeve: 1 };
    case 'chef': return { ...base, top: 0xf6f4ee, trim: 0xd8d0c0, pants: 0x4a4a52, sleeve: 2 };
    case 'miner': return { ...base, top: 0x6a5a3a, trim: 0x3a2a1a, pants: 0x4a3c28, skirt: 4, sleeve: 1 };
    case 'bard': return { ...base, top: c1, trim: c2, skirt: 4, sleeve: 2 };
    case 'sailor': return { ...base, top: 0xf6f2e8, trim: 0x2a5a8a, pants: 0x2a3a5a, sleeve: 1 };
    case 'otherworld': return { ...base, top: 0x2a3a6a, trim: 0xc03a3a, pants: 0x4a4a52, boot: 0xf0f0f0, sleeve: 2 };
    case 'priest': return { ...base, top: 0xf6f2e8, trim: 0xf2c94c, skirt: 3, sleeve: 2, boot: 0x3a2a1a };
    case 'plate': return { ...base, top: 0xb8c0d0, trim: c1, pants: 0x7a8294, boot: 0x3a3030, skirt: 4, sleeve: 2, metalArms: true, cape: shade(c1, 0.7) };
    default: return { ...base, skirt: 4 };
  }
}

// ---------- limbs ----------
/** a tapered, shaded segment from p to q (thick end w0 at p, w1 at q) */
function taper(c: CanvasRenderingContext2D, p: [number, number], q: [number, number], w0: number, w1: number, col: number, edge = true) {
  const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  c.beginPath();
  c.moveTo(p[0] + nx * w0 / 2, p[1] + ny * w0 / 2); c.lineTo(q[0] + nx * w1 / 2, q[1] + ny * w1 / 2);
  c.lineTo(q[0] - nx * w1 / 2, q[1] - ny * w1 / 2); c.lineTo(p[0] - nx * w0 / 2, p[1] - ny * w0 / 2); c.closePath();
  const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], w = Math.max(w0, w1) / 2 + 0.1;
  c.fillStyle = lin(c, m[0] - Math.abs(nx) * w - 0.01, m[1] - Math.abs(ny) * w, m[0] + Math.abs(nx) * w + 0.01, m[1] + Math.abs(ny) * w, [0, hex(lite(col, 0.14))], [0.45, hex(col)], [1, hex(shade(col, 0.62))]);
  c.fill();
  if (edge) { c.strokeStyle = hex(lineOf(col)); c.lineWidth = 0.6; c.lineJoin = 'round'; c.stroke(); }
}
function joint(c: CanvasRenderingContext2D, p: [number, number], r: number, col: number) {
  ell(c, p[0], p[1], r, r, rad(c, p[0] - r * 0.3, p[1] - r * 0.3, r * 1.3, [0, hex(lite(col, 0.12))], [1, hex(shade(col, 0.7))]), hex(lineOf(col)), 0.5);
}

function limb(k: Cx, a: [number, number], t: [number, number], side: number, w1: number, w2: number, col1: number, col2: number): [number, number] {
  const { c } = k, l1 = (k.armLen * 0.5), l2 = k.armLen * 0.52;
  const kn = ik(a[0], a[1], t[0], t[1], l1, l2, side);
  taper(c, a, kn, w1 * 1.1, w1 * 0.88, col1);
  joint(c, kn, w1 * 0.44, col1 === col2 ? col1 : mix(col1, col2, 0.5));
  taper(c, kn, t, w2 * 0.92, w2 * 0.66, col2);
  return kn;
}

function legs(k: Cx, fit: Fit) {
  const { c, sz } = k;
  const lw = 6.4 * sz ** 0.85 * (k.feats.has('gaunt') ? 0.78 : 1) * (k.theme.wide > 1.2 ? 1.2 : 1);
  for (let i = 0; i < 2; i++) {
    const prof = k.view === 'side', side = prof ? 1 : i ? 1 : -1, hp = k.hp[i], ft = k.foot[i], dim = prof && i === 0 ? 0.72 : 1;
    const l1 = k.legLen * 0.49, l2 = k.legLen * 0.5;
    const an: [number, number] = [ft[0], ft[1] - 0.3];
    const kn = ik(hp[0], hp[1], an[0], an[1], l1, l2, side);
    const metal = k.feats.has('mecharm') && i === 0, bareShin = (fit.skirt === 1 || fit.skirt === 2 || fit.bare) && fit.skirt !== 3;
    const c1 = shade(fit.pants, dim), c2 = shade(metal ? 0x9aa0b0 : bareShin ? k.skin : fit.pants, dim);
    taper(c, hp, kn, lw * 1.12, lw * 0.9, c1);
    joint(c, kn, lw * 0.42, c1 === c2 ? c1 : mix(c1, c2, 0.5));
    taper(c, kn, an, lw * 0.9, lw * 0.62, c2);
    if (metal) ell(c, kn[0], kn[1], lw * 0.5, lw * 0.5, '#c8ccd8', '#4a5064', 0.5);
    // boot
    const barefoot = fit.bare && fit.boot === 0x6a5a4a || k.feats.has('hairyfeet') || fit.top === k.skin || k.feats.has('claws');
    const fw = 3.9 * sz ** 0.75 + (k.feats.has('hairyfeet') ? 0.6 : 0), fh = 2.6 * sz ** 0.75;
    const fxo = prof ? fw * 0.55 : side * 0.6, shoeW = prof ? fw * 1.18 : fw;
    if (barefoot) {
      ell(c, ft[0] + fxo, ft[1] - fh * 0.5, shoeW, fh, hex(shade(k.skin, dim)), hex(lineOf(k.skin)), 0.6);
      for (let t = -1; t <= 1; t++) stroke(c, rgba(shade(k.skin, 0.5), 0.5), 0.3, ft[0] + fxo + t * fw * 0.5, ft[1] - 0.2, ft[0] + fxo + t * fw * 0.55, ft[1] - fh * 0.9);
      if (k.feats.has('hairyfeet')) for (let t = -2; t <= 2; t++) stroke(c, hex(shade(k.hair, 0.8)), 0.4, ft[0] + fxo + t * 0.9, ft[1] - 0.3, ft[0] + fxo + t * 1.1, ft[1] + 0.9);
    } else {
      const bc = shade(k.L.outfit === 'sarong' ? 0x5a3e24 : fit.boot, dim), tall = fit.skirt === 3 ? 0 : 0.2 * k.legLen * (k.L.outfit === 'rags' ? 0.3 : 1);
      if (tall > 0) { // the shaft of the boot over the trouser
        const top: [number, number] = [an[0] + (kn[0] - an[0]) * (tall / k.legLen / 0.5), an[1] + (kn[1] - an[1]) * (tall / k.legLen / 0.5)];
        taper(c, top, an, lw * 0.86, lw * 0.7, bc);
        taper(c, [top[0], top[1] - 0.2], [top[0], top[1] + 1.1], lw * 0.98, lw * 0.98, lite(bc, 0.12), false);
        stroke(c, hex(shade(bc, 0.4)), 0.4, top[0] - lw * 0.45, top[1] + 1.1, top[0] + lw * 0.45, top[1] + 1.1);
      }
      rrect(c, ft[0] + fxo - shoeW, ft[1] - fh * 1.7, shoeW * 2, fh * 1.8, fh * 0.75, hex(bc), hex(lineOf(bc)), 0.6);
      rrect(c, ft[0] + fxo - shoeW, ft[1] - fh * 0.5, shoeW * 2, fh * 0.55, 0.3, hex(shade(bc, 0.45)));
      stroke(c, rgba(lite(bc, 0.5), 0.5), 0.4, ft[0] + fxo - shoeW * 0.6, ft[1] - fh * 1.35, ft[0] + fxo + shoeW * 0.3, ft[1] - fh * 1.4);
    }
  }
}

function skirt(k: Cx, fit: Fit) {
  const { c, sz } = k, kind = fit.skirt;
  if (!kind || k.P.legs !== 'stand' && kind === 3 && false) return;
  const y0 = k.hipY - 1.5, hx = (k.hp[0][0] + k.hp[1][0]) / 2;
  const fl = k.L.outfit === 'dress' ? 1.1 : 1, floor = FOOT - k.P.hover - 1 + (k.P.legs === 'stand' ? 0 : -1);
  const y1 = kind === 4 ? y0 + k.legLen * 0.36 : kind === 1 ? y0 + k.legLen * 0.62 : kind === 2 ? Math.min(floor - 5 * sz, y0 + k.legLen * 0.78) : floor;
  const col = k.L.outfit === 'sarong' ? k.L.cloth2 : kind === 2 && k.L.outfit === 'scholar' ? shade(k.L.cloth, 0.8) : fit.top;
  const w0 = k.ww + 0.9, w1 = (k.ww + (kind === 3 ? 6.2 : kind === 4 ? 2.6 : 4.4) * fl) * (kind === 1 ? 0.9 : 1);
  const sway = Math.sin(k.P.amb * TAU) * 1.2 * (k.frame >= 2 && k.frame <= 9 ? 1.6 : 0.6);
  const drop = k.P.legs === 'stand' ? 0 : k.P.drop * 0.2;
  c.beginPath(); c.moveTo(hx - w0, y0);
  c.bezierCurveTo(hx - w0 - 0.5, y0 + (y1 - y0) * 0.5, hx - w1 - 0.8 + sway, y1 - 3, hx - w1 + sway, y1 + drop);
  c.quadraticCurveTo(hx + sway, y1 + 1.6 + drop, hx + w1 + sway, y1 + drop);
  c.bezierCurveTo(hx + w1 + 0.8 + sway, y1 - 3, hx + w0 + 0.5, y0 + (y1 - y0) * 0.5, hx + w0, y0);
  c.closePath();
  c.fillStyle = lin(c, hx - w1, 0, hx + w1, 0, [0, hex(lite(col, 0.2))], [0.55, hex(col)], [1, hex(shade(col, 0.7))]); c.fill();
  c.strokeStyle = hex(lineOf(col)); c.lineWidth = 0.75; c.lineJoin = 'round'; c.stroke();
  for (let i = -2; i <= 2; i++) stroke(c, rgba(shade(col, 0.5), 0.3), 0.45, hx + i * w0 * 0.55, y0 + 2, hx + i * w1 * 0.62 + sway * 0.6, y1 - 1);
  stroke(c, hex(shade(col, 0.55)), 0.7, hx - w1 + sway, y1 - 0.6 + drop, hx + w1 + sway, y1 - 0.6 + drop);
  if (fit.trim && (k.L.outfit === 'robe' || k.L.outfit === 'priest' || k.L.outfit === 'regal')) { stroke(c, hex(fit.trim), 1, hx - w1 + sway, y1 - 1.6 + drop, hx + w1 + sway, y1 - 1.6 + drop); }
  if (k.L.outfit === 'sarong') for (let i = 0; i < 5; i++) ell(c, hx - w1 * 0.8 + i * w1 * 0.4 + sway * 0.4, y1 - 3 - (i % 2) * 2, 1, 1, hex(shade(k.L.cloth, 0.8)));
}

// ---------- torso ----------
function torsoPath(k: Cx) {
  const { c, sw, ww, shY, hipY, sh, hp } = k;
  const sx = (sh[0][0] + sh[1][0]) / 2, hx = (hp[0][0] + hp[1][0]) / 2, hy = hipY + 1.2, sy = shY;
  c.beginPath();
  c.moveTo(sx - sw, sy + 2.4);
  c.quadraticCurveTo(sx - sw, sy - 0.4, sx - sw + 3.2, sy - 0.5);
  c.lineTo(sx + sw - 3.2, sy - 0.5);
  c.quadraticCurveTo(sx + sw, sy - 0.4, sx + sw, sy + 2.4);
  c.bezierCurveTo(sx + sw * 1.0, sy + (hy - sy) * 0.55, hx + ww * 1.12, hy - (hy - sy) * 0.3, hx + ww * 1.1, hy);
  c.lineTo(hx - ww * 1.1, hy);
  c.bezierCurveTo(hx - ww * 1.12, hy - (hy - sy) * 0.3, sx - sw * 1.0, sy + (hy - sy) * 0.55, sx - sw, sy + 2.4);
  c.closePath();
}

function torso(k: Cx, fit: Fit) {
  const { c, shY, hipY, sw } = k, L = k.L, o = L.outfit;
  const sx = (k.sh[0][0] + k.sh[1][0]) / 2, hx = (k.hp[0][0] + k.hp[1][0]) / 2, tw = sw * 2, th = hipY - shY;
  const top = fit.top;
  const back = k.view === 'back';
  const cape = () => {
    if (fit.cape === undefined) return;
    c.beginPath(); c.moveTo(sx - sw - 0.8, shY + 1); c.quadraticCurveTo(sx - sw - 3, shY + th * 0.8, hx - k.ww - 4 + Math.sin(k.P.amb * TAU) * 1.2, FOOT - k.P.hover - 8);
    c.quadraticCurveTo(hx, FOOT - k.P.hover - 5, hx + k.ww + 4 + Math.sin(k.P.amb * TAU) * 1.2, FOOT - k.P.hover - 8); c.quadraticCurveTo(sx + sw + 3, shY + th * 0.8, sx + sw + 0.8, shY + 1); c.closePath();
    c.fillStyle = lin(c, 0, shY, 0, FOOT, [0, hex(fit.cape)], [1, hex(shade(fit.cape, 0.6))]); c.fill(); c.strokeStyle = hex(lineOf(fit.cape)); c.lineWidth = 0.8; c.stroke();
    if (back) for (let i = -2; i <= 2; i++) stroke(c, rgba(shade(fit.cape, 0.4), 0.4), 0.5, sx + i * sw * 0.3, shY + 3, hx + i * (k.ww + 2.4) * 0.5, FOOT - k.P.hover - 9);
  };
  if (!back) cape(); // a cape hangs behind the shoulders, seen from behind it covers the back
  torsoPath(k);
  c.fillStyle = lin(c, sx - sw, 0, sx + sw, 0, [0, hex(lite(top, 0.2))], [0.45, hex(top)], [1, hex(shade(top, 0.68))]); c.fill();
  c.save(); torsoPath(k); c.clip();
  c.fillStyle = lin(c, 0, shY, 0, hipY + 1, [0, 'rgba(255,255,255,0.1)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(10,6,30,0.28)']); c.fillRect(sx - tw, shY - 2, tw * 2, th + 6);
  const bare = o === 'sarong' || (o === 'rags' && false);
  if (bare) { c.fillStyle = lin(c, sx - sw, 0, sx + sw, 0, [0, hex(k.skinL)], [1, hex(k.skinD)]); c.fillRect(sx - tw, shY - 2, tw * 2, th + 4); stroke(c, rgba(k.skinD, 0.6), 0.5, sx, shY + 3, sx, shY + 8); }
  if (back) backDetails(k, fit, sx, shY, hipY, sw); else outfitDetails(k, fit, sx, hx, shY, hipY, sw);
  // folds that follow the motion of the walk
  const f = Math.sin(k.P.amb * TAU);
  stroke(c, rgba(shade(top, 0.5), 0.35), 0.5, sx - sw * 0.5, shY + th * 0.4, sx - sw * 0.2, shY + th * 0.6 + f * 0.4);
  stroke(c, rgba(shade(top, 0.5), 0.3), 0.5, sx + sw * 0.35, shY + th * 0.3, sx + sw * 0.5, shY + th * 0.55 - f * 0.4);
  c.restore();
  torsoPath(k); c.strokeStyle = hex(lineOf(top)); c.lineWidth = 0.9; c.lineJoin = 'round'; c.stroke();
  stroke(c, rgba(lite(top, 0.5), 0.5), 0.6, sx - sw + 0.9, shY + 2.5, sx - sw + 1.4, shY + th * 0.5); // rim light
  if (back) cape();
  void L;
}

/** the back of a garment: a seam down the spine, the yoke across the shoulders and the belt that goes all the way round */
function backDetails(k: Cx, fit: Fit, sx: number, sy: number, hy: number, sw: number) {
  const { c } = k, o = k.L.outfit, th = hy - sy, top = fit.top;
  stroke(c, rgba(shade(top, 0.45), 0.5), 0.55, sx, sy + 1, sx, hy);
  curve(c, rgba(shade(top, 0.5), 0.4), 0.5, sx - sw, sy + 4, sx, sy + 6.5, sx + sw, sy + 4); // the yoke
  if (['armor', 'knight', 'plate'].includes(o)) { poly(c, [sx - sw, sy + 1, sx + sw, sy + 1, sx + sw * 0.8, sy + th * 0.55, sx, sy + th * 0.7, sx - sw * 0.8, sy + th * 0.55], lin(c, sx - sw, 0, sx + sw, 0, [0, '#d4d8e2'], [0.5, '#9aa2b4'], [1, '#5a6278']), '#3a4258', 0.7); stroke(c, 'rgba(58,66,88,0.7)', 0.6, sx, sy + 2, sx, sy + th * 0.65); }
  if (['tunic', 'leather', 'cloak', 'vest', 'farmer', 'sailor', 'fur', 'miner', 'bard', 'noble', 'regal', 'apron', 'mage', 'scholar', 'otherworld', 'chef'].includes(o)) { rrect(c, sx - sw - 1, hy - 3.1, sw * 2 + 2, 2.1, 0.5, hex(fit.trim && o !== 'tunic' ? shade(fit.trim, 0.8) : shade(k.L.cloth2, 0.55))); }
  if (o === 'apron') { stroke(c, '#8a7a5a', 0.7, sx - sw * 0.2, sy + 1, sx + sw * 0.2, sy + 1); poly(c, [sx - 1.6, hy - 3.2, sx - 3.4, hy + 4, sx - 1.2, hy + 2.5, sx, hy + 5, sx + 1.2, hy + 2.5, sx + 3.4, hy + 4, sx + 1.6, hy - 3.2], '#d8c8a8', '#8a7a5a', 0.4); }
  if (o === 'fur') rrect(c, sx - sw - 0.5, sy - 0.5, sw * 2 + 1, 3.2, 1.3, '#eee6d6', '#a09886', 0.5);
  if (['robe', 'priest', 'regal', 'monk'].includes(o)) rrect(c, sx - 1.2, sy, 2.4, th + 8, 0.4, hex(fit.trim));
}

function outfitDetails(k: Cx, fit: Fit, sx: number, hx: number, sy: number, hy: number, sw: number) {
  const { c } = k, L = k.L, o = L.outfit, th = hy - sy, top = fit.top, c1 = L.cloth, c2 = L.cloth2;
  const belt = (col: number, buckle = 0xf2c94c) => { rrect(c, sx - sw - 1, hy - 3.1, sw * 2 + 2, 2.1, 0.5, hex(col)); rrect(c, sx - 1.2 + k.fx * 0.2, hy - 3.4, 2.4, 2.7, 0.5, hex(buckle), hex(lineOf(buckle)), 0.4); };
  const collar = (col: number) => { poly(c, [sx - 3.4, sy - 0.5, sx, sy + 3.2, sx + 3.4, sy - 0.5], hex(col), hex(lineOf(col)), 0.45); };
  const buttons = (col = 0xf2c94c, n = 3, x = sx) => { for (let i = 0; i < n; i++) ell(c, x, sy + 4 + i * (th - 7) / n, 0.55, 0.55, hex(col), undefined); };
  switch (o) {
    case 'vest': rrect(c, sx - sw, sy + 1.5, sw * 0.8, th - 1, 1, hex(shade(c1, 0.85))); rrect(c, sx + sw * 0.2, sy + 1.5, sw * 0.8, th - 1, 1, hex(shade(c1, 0.85))); collar(0xfffaf0); buttons(0xd9a030, 3, sx + sw * 0.35); break;
    case 'armor': case 'plate': {
      poly(c, [sx - sw, sy + 1, sx + sw, sy + 1, sx + sw * 0.8, sy + th * 0.55, sx, sy + th * 0.7, sx - sw * 0.8, sy + th * 0.55], lin(c, sx - sw, 0, sx + sw, 0, [0, '#e4e8f2'], [0.5, '#a6adbc'], [1, '#5a6278']), '#3a4258', 0.7);
      stroke(c, 'rgba(255,255,255,0.7)', 0.7, sx - sw * 0.6, sy + 2.5, sx - sw * 0.25, sy + th * 0.4);
      for (let i = 0; i < 3; i++) stroke(c, 'rgba(58,66,88,0.7)', 0.6, sx - sw * 0.7 + i * 0.5, sy + th * (0.62 + i * 0.1), sx + sw * 0.7 - i * 0.5, sy + th * (0.62 + i * 0.1));
      belt(0x4a3322); break;
    }
    case 'knight': rrect(c, sx - sw * 0.5, sy + 1, sw, th - 1.5, 1, hex(c1), hex(lineOf(c1)), 0.5); poly(c, [sx, sy + 3, sx + 2.6, sy + 6, sx, sy + 9, sx - 2.6, sy + 6], '#f2c94c', '#8a6a20', 0.5); belt(0x3a2a1a); break;
    case 'robe': case 'priest': rrect(c, sx - 1.2, sy, 2.4, th + 8, 0.4, hex(fit.trim)); collar(shade(top, 0.8)); belt(shade(c2, 0.6), 0xf2c94c); break;
    case 'mage': rrect(c, sx - sw, sy + th * 0.62, sw * 2, 1.6, 0.4, hex(shade(c1, 0.6))); rrect(c, sx - 1.2, sy + 2, 2.4, 2.6, 0.5, hex(c2)); for (let i = 0; i < 3; i++) ell(c, sx - sw * 0.6 + i * sw * 0.6, sy + th * 0.8, 0.5, 0.5, '#fff2a0'); break;
    case 'scholar': rrect(c, sx - 1, sy, 2, th, 0.4, hex(shade(c1, 0.65))); ell(c, sx + 0.5, sy + th * 0.3, 0.55, 0.55, '#f2c94c'); ell(c, sx + 0.5, sy + th * 0.6, 0.55, 0.55, '#f2c94c'); break;
    case 'monk': for (let i = 0; i < 6; i++) stroke(c, '#a85a1a', 1.1, sx + sw - i * 2, sy + 1 + i * 1.5, sx + sw - i * 2 - 2, sy + 2.5 + i * 1.5); break;
    case 'farmer': rrect(c, sx - sw * 0.7, sy + 2, sw * 1.4, th, 0.8, '#5a7aa0', '#2a3a5a', 0.5); stroke(c, '#5a7aa0', 1.2, sx - sw * 0.7, sy + 2, sx - sw * 0.7, sy - 0.5); stroke(c, '#5a7aa0', 1.2, sx + sw * 0.7, sy + 2, sx + sw * 0.7, sy - 0.5); ell(c, sx - sw * 0.5, sy + 3.5, 0.6, 0.6, '#d9a030'); ell(c, sx + sw * 0.5, sy + 3.5, 0.6, 0.6, '#d9a030'); rrect(c, sx - 2, sy + th * 0.5, 4, 3, 0.4, '#4a6a90', '#2a3a5a', 0.4); break;
    case 'apron': rrect(c, sx - sw * 0.78, sy + 2, sw * 1.56, th + 4, 1, '#d8c8a8', '#8a7a5a', 0.55); stroke(c, '#8a7a5a', 0.6, sx - sw * 0.6, sy + 2, sx - sw * 0.2, sy - 0.5); stroke(c, '#8a7a5a', 0.6, sx + sw * 0.6, sy + 2, sx + sw * 0.2, sy - 0.5); rrect(c, sx - 2, sy + th * 0.55, 4, 3, 0.5, '#c4b494', '#8a7a5a', 0.4); stroke(c, 'rgba(60,40,20,0.35)', 0.8, sx - sw * 0.5, sy + th * 0.3, sx - sw * 0.2, sy + th * 0.38); break;
    case 'cloak': collar(shade(c2, 0.7)); ell(c, sx, sy + 3.8, 1, 1, '#d9a030', '#7a5a10', 0.35); belt(0x3a2a1a, 0x9aa0b0); break;
    case 'noble': case 'regal': rrect(c, sx - sw, sy + 1, 2, th, 0.5, hex(fit.trim)); rrect(c, sx + sw - 2, sy + 1, 2, th, 0.5, hex(fit.trim)); stroke(c, hex(fit.trim), 1.1, sx - sw, sy + th - 2, sx + sw, sy + th - 2); for (let i = 0; i < 3; i++) ell(c, sx, sy + 3 + i * 3.2, 0.6, 0.6, '#f2c94c'); poly(c, [sx - 2.6, sy - 0.4, sx, sy + 2.4, sx + 2.6, sy - 0.4], '#f6f2e8', '#8a8478', 0.4); if (o === 'regal') { poly(c, [sx, sy + th * 0.45, sx + 2.6, sy + th * 0.62, sx, sy + th * 0.8, sx - 2.6, sy + th * 0.62], hex(k.accent), '#4a3a10', 0.45); } break;
    case 'rags': ell(c, sx - sw * 0.4, sy + th * 0.45, 2, 2.2, '#6a5a4a'); rrect(c, sx + sw * 0.1, sy + th * 0.62, 3, 2.4, 0.4, '#5a4a3a'); stroke(c, '#4a3a2a', 0.4, sx - sw * 0.7, sy + th * 0.45, sx - sw * 0.1, sy + th * 0.45); for (let i = 0; i < 4; i++) poly(c, [sx - sw + i * sw * 0.5, hy, sx - sw + i * sw * 0.5 + 1.4, hy + 2.6, sx - sw + i * sw * 0.5 + 2.8, hy], hex(fit.top), undefined); break;
    case 'dress': stroke(c, hex(c2), 1.4, sx - sw, sy + th * 0.55, sx + sw, sy + th * 0.55); collar(shade(top, 0.85)); ell(c, sx, sy + 4, 0.7, 0.7, hex(c2)); break;
    case 'sarong': stroke(c, hex(c2), 2, sx - sw, hy - 0.5, sx + sw, hy - 0.5); break;
    case 'light': stroke(c, hex(c1), 2, sx - sw, sy + th * 0.55, sx + sw, sy + th * 0.55); collar(0xe4d6b4); stroke(c, hex(c1), 1.3, sx - sw * 0.8, sy + 1, sx + sw * 0.5, sy + th * 0.7); break;
    case 'fur': rrect(c, sx - sw - 0.5, sy - 0.5, sw * 2 + 1, 3.2, 1.3, '#eee6d6', '#a09886', 0.5); for (let i = 0; i < 6; i++) ell(c, sx - sw + 1 + i * sw * 0.36, sy + 2.2, 1.3, 1.1, '#eee6d6'); rrect(c, sx - sw - 0.5, hy - 3, sw * 2 + 1, 3.2, 1.3, '#eee6d6', '#a09886', 0.5); belt(0x4a3220, 0xc0b8a8); for (let i = 0; i < 4; i++) stroke(c, 'rgba(60,40,20,0.35)', 0.5, sx - sw * 0.6 + i * sw * 0.4, sy + th * 0.25, sx - sw * 0.6 + i * sw * 0.4 + 0.8, sy + th * 0.6); break;
    case 'leather': for (let i = 0; i < 5; i++) stroke(c, '#3a2412', 0.9, sx - sw + i * 0.2, sy + 1.4 + i * th * 0.18, sx + sw - 3.6 + i * 0.4, sy + 1.4 + i * th * 0.18 + 1); rrect(c, sx - sw * 0.1, sy + 1, 1.6, th, 0.4, '#3a2412'); belt(0x3a2412, 0xb0a890); break;
    case 'chef': for (let i = 0; i < 2; i++) ell(c, sx - sw * 0.5 + i * sw, sy + th * 0.4, 0.6, 0.6, '#3a3a40'); for (let i = 0; i < 2; i++) ell(c, sx - sw * 0.5 + i * sw, sy + th * 0.62, 0.6, 0.6, '#3a3a40'); rrect(c, sx - sw, hy - 2.6, sw * 2, 2.6, 0.4, '#f6f4ee', '#c4c0b4', 0.4); break;
    case 'miner': rrect(c, sx - sw * 0.7, sy + 1.6, sw * 1.4, th, 0.8, '#6a5a3a', '#3a2a1a', 0.5); belt(0x2a1a0e, 0xa09a8a); rrect(c, sx + 1, hy - 7, 3, 3.6, 0.5, '#4a3c28', '#2a1a0e', 0.4); break;
    case 'bard': c.fillStyle = hex(c2); c.fillRect(sx - sw, sy - 1, sw, th + 2); poly(c, [sx, sy - 1, sx + 3, sy + th * 0.25, sx, sy + th * 0.5, sx - 3, sy + th * 0.25], hex(0xf2c94c), undefined); belt(0x3a2a1a); break;
    case 'sailor': for (let i = 0; i < 5; i++) rrect(c, sx - sw - 1, sy + 1 + i * 2.8, sw * 2 + 2, 1.3, 0, '#2a5a8a'); poly(c, [sx - 3, sy - 0.5, sx, sy + 4.5, sx + 3, sy - 0.5], '#d03a3a', '#701818', 0.4); break;
    case 'otherworld': poly(c, [sx - 2.6, sy - 0.5, sx, sy + 4, sx + 2.6, sy - 0.5], '#f6f6f6', '#9a9aa4', 0.4); poly(c, [sx - 0.6, sy + 1.6, sx + 0.6, sy + 1.6, sx + 1, sy + th * 0.55, sx, sy + th * 0.62, sx - 1, sy + th * 0.55], '#c03a3a', '#701818', 0.4); ell(c, sx - sw * 0.5, sy + th * 0.35, 1.5, 1.5, '#e8c050', '#8a6a20', 0.4); break;
    default: // tunic: a neckline, belt, and the patterns that tell neighbours apart
      collar(shade(top, 0.82)); belt(shade(c2, 0.55));
  }
  // patterns that make the same outfit look different on different people
  if (!['armor', 'knight', 'rags', 'sailor', 'chef', 'plate', 'otherworld', 'apron'].includes(o)) {
    if (L.pattern === 1) { stroke(c, hex(shade(top, 0.6)), 1, sx - sw, sy + th * 0.62, sx + sw, sy + th * 0.62); ell(c, sx, sy + th * 0.62, 0.9, 0.9, '#d9a030'); }
    if (L.pattern === 2) for (let i = 0; i < 4; i++) stroke(c, rgba(shade(top, 0.6), 0.4), 0.9, sx - sw, sy + 2.2 + i * 2.6, sx + sw, sy + 2.2 + i * 2.6);
    if (L.pattern === 3) for (let i = 0; i < 4; i++) stroke(c, rgba(c2, 0.55), 1.2, sx + sw - i * 3.2, sy, sx + sw - i * 3.2 - th * 0.5, sy + th * 0.9);
    if (L.pattern === 4) for (let i = 0; i < 6; i++) ell(c, sx - sw * 0.7 + (i % 3) * sw * 0.7, sy + 3 + Math.floor(i / 3) * 4.5, 0.65, 0.65, rgba(lite(c2, 0.5), 0.8));
    if (L.pattern === 5) { rrect(c, sx - sw, sy - 0.5, sw * 2, 2.2, 0.4, hex(c2)); }
  }
}

function arms(k: Cx, fit: Fit, which: 'both' | 'far' | 'near' = 'both') {
  const { c, sz } = k, th = k.theme, prof = k.view === 'side';
  const aw = 5 * sz ** 0.85 * (k.feats.has('gaunt') ? 0.75 : 1) * (th.wide > 1.2 ? 1.18 : 1);
  const sleeveCol = fit.sleeve === 0 ? k.skin : fit.metalArms ? 0xa6adbc : fit.top;
  const forearm = fit.sleeve === 2 ? (fit.metalArms ? 0x9aa0b0 : fit.top) : k.skin;
  const mech = k.feats.has('mecharm');
  for (let i = 0; i < 2; i++) {
    if (prof && (which === 'far' ? i !== 0 : which === 'near' ? i !== 1 : false)) continue;
    const side = prof ? 1 : i ? 1 : -1, sh = k.sh[i], hd = k.hand[i];
    const metal = mech && i === 1;
    const fc = metal ? 0xb89a54 : fit.sleeve === 0 && k.L.outfit !== 'sarong' ? k.skin : forearm;
    const dim = prof && i === 0 ? 0.72 : 1;
    const kn = limb(k, sh, hd, side, aw * 1.05, aw * 0.9, shade(metal ? 0xb89a54 : sleeveCol, dim), shade(fc, dim));
    // cuffs and the shoulder cap
    if (fit.sleeve === 2 && !metal && !fit.metalArms) { const dx = hd[0] - kn[0], dy = hd[1] - kn[1], d = Math.hypot(dx, dy) || 1; stroke(c, hex(fit.trim ?? 0xe8e0d0), aw * 0.9, hd[0] - dx / d * 1.6, hd[1] - dy / d * 1.6, hd[0] - dx / d * 2.6, hd[1] - dy / d * 2.6); }
    if (metal) { ell(c, kn[0], kn[1], aw * 0.6, aw * 0.6, '#d8dce8', '#4a5064', 0.5); for (const t of [0.35, 0.7]) ell(c, kn[0] + (hd[0] - kn[0]) * t, kn[1] + (hd[1] - kn[1]) * t, 0.5, 0.5, '#8a6a2a'); }
    if (fit.metalArms) ell(c, sh[0] + side * 0.4, sh[1] - 0.6, aw * 0.95, aw * 0.8, lin(c, sh[0] - 3, sh[1] - 3, sh[0] + 3, sh[1] + 3, [0, '#e4e8f2'], [1, '#7a8294']), '#3a4258', 0.6);
    if (th.id === 'soulmachine') ell(c, kn[0], kn[1], aw * 0.55, aw * 0.55, '#d8dce8', '#4a5064', 0.45);
    if (k.feats.has('scales') || k.feats.has('sandscales')) for (let s = 0; s < 4; s++) { const t = 0.2 + s * 0.22; ell(c, kn[0] + (hd[0] - kn[0]) * t, kn[1] + (hd[1] - kn[1]) * t, 0.75, 0.55, rgba(lite(k.skin, 0.4), 0.55), undefined); }
    const glove = ['armor', 'knight', 'plate', 'leather', 'miner', 'cloak', 'fur'].includes(k.L.outfit) && !metal ? (k.L.outfit === 'fur' ? 0x6a4a2a : k.L.outfit === 'knight' || k.L.outfit === 'armor' || k.L.outfit === 'plate' ? 0x4a3a2c : 0x3a2a1c) : 0;
    if (glove) { const dx = hd[0] - kn[0], dy = hd[1] - kn[1], d = Math.hypot(dx, dy) || 1; taper(c, [hd[0] - dx / d * 4.6, hd[1] - dy / d * 4.6], [hd[0] - dx / d * 0.4, hd[1] - dy / d * 0.4], aw * 0.78, aw * 0.68, glove); stroke(c, hex(lite(glove, 0.2)), 0.4, hd[0] - dx / d * 4.6 - aw * 0.3, hd[1] - dy / d * 4.6, hd[0] - dx / d * 4.6 + aw * 0.3, hd[1] - dy / d * 4.6); }
    hand(k, hd, side, metal, kn, glove, dim);
  }
}

function hand(k: Cx, hd: [number, number], side: number, metal: boolean, from?: [number, number], glove = 0, dim = 1) {
  const { c, sz } = k, r = 2.3 * sz ** 0.8 * (k.feats.has('stone') ? 1.2 : 1);
  const col = shade(glove ? glove : metal ? 0xb89a54 : k.skin, dim);
  const dx = from ? hd[0] - from[0] : 0, dy = from ? hd[1] - from[1] : 1, ang = Math.atan2(dy, dx) - Math.PI / 2;
  c.save(); c.translate(hd[0], hd[1]); c.rotate(ang);
  if (k.feats.has('pawhands') || (k.feats.has('fur') && k.L.race === 'beast')) {
    ell(c, 0, r * 0.4, r * 1.0, r * 1.2, hex(col), hex(lineOf(col)), 0.6);
    for (let t = -1; t <= 1; t++) ell(c, t * r * 0.45, r * 1.2, 0.5, 0.45, hex(shade(col, 0.5)));
    c.restore(); return;
  }
  // a relaxed hand: the palm, four fingers curled together and a thumb along the side
  c.beginPath(); c.moveTo(-r * 0.78, 0); c.quadraticCurveTo(-r * 0.95, r * 1.7, -r * 0.45, r * 2.1); c.quadraticCurveTo(0, r * 2.4, r * 0.45, r * 2.1); c.quadraticCurveTo(r * 0.95, r * 1.7, r * 0.78, 0); c.closePath();
  c.fillStyle = lin(c, -r, 0, r, 0, [0, hex(lite(col, 0.14))], [1, hex(shade(col, 0.68))]); c.fill(); c.strokeStyle = hex(lineOf(col)); c.lineWidth = 0.5; c.stroke();
  for (let t = -1; t <= 1; t++) stroke(c, rgba(shade(col, 0.35), 0.55), 0.28, t * r * 0.36, r * 1.35, t * r * 0.4, r * 2.2);
  ell(c, -side * r * 0.85, r * 0.9, r * 0.32, r * 0.78, hex(shade(col, 0.92)), hex(lineOf(col)), 0.4, side * 0.2);
  if (k.feats.has('claws')) for (let t = -1; t <= 1; t++) poly(c, [t * r * 0.36 - 0.35, r * 2.2, t * r * 0.4, r * 2.2 + 2.2, t * r * 0.4 + 0.35, r * 2.2], '#d8d4c0', '#4a4a3a', 0.3);
  c.restore();
  if (k.feats.has('summonsigil') && side > 0) { c.beginPath(); c.arc(hd[0], hd[1], r * 0.7, 0, TAU); c.strokeStyle = rgba(0x6ad0ff, 0.9); c.lineWidth = 0.4; c.stroke(); glow(c, hd[0], hd[1], 4, 0x6ad0ff, 0.4); }
}

// ---------- head ----------
function headPath(k: Cx, hx: number, hy: number, hw: number, hh: number) {
  const { c } = k;
  const sq = k.theme.id === 'dwarf' || k.theme.id === 'giant' || k.theme.id === 'orc' ? 1.08 : 1;
  const jaw = (k.L.fem ? 0.74 : 0.9) * (k.feats.has('gaunt') ? 0.8 : 1) * (k.stage === 'child' || k.stage === 'infant' ? 0.82 : 1);
  c.beginPath(); c.moveTo(hx - hw, hy - hh * 0.12);
  c.bezierCurveTo(hx - hw, hy - hh * 0.98, hx - hw * 0.55, hy - hh, hx, hy - hh);
  c.bezierCurveTo(hx + hw * 0.55, hy - hh, hx + hw, hy - hh * 0.98, hx + hw, hy - hh * 0.12);
  c.bezierCurveTo(hx + hw * 1.0 * sq, hy + hh * 0.5, hx + hw * 0.7 * jaw, hy + hh * 0.9, hx + hw * 0.3 * jaw, hy + hh);
  c.lineTo(hx - hw * 0.3 * jaw, hy + hh);
  c.bezierCurveTo(hx - hw * 0.7 * jaw, hy + hh * 0.9, hx - hw * 1.0 * sq, hy + hh * 0.5, hx - hw, hy - hh * 0.12);
  c.closePath();
}

function drawHead(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh, L, feats: f } = k, id = k.theme.id;
  const skin = k.skin, metal = id === 'soulmachine';
  headPath(k, hx, hy, hw, hh);
  c.fillStyle = metal
    ? lin(c, hx - hw, hy - hh, hx + hw, hy + hh, [0, hex(lite(skin, 0.55))], [0.35, hex(skin)], [0.6, hex(shade(skin, 0.75))], [1, hex(shade(skin, 0.55))])
    : rad(c, hx - hw * 0.4, hy - hh * 0.5, hw * 1.9, [0, hex(lite(skin, 0.16))], [0.5, hex(skin)], [1, hex(shade(skin, 0.66))]);
  c.fill();
  if (f.has('gel')) { c.fillStyle = rgba(0xffffff, 0.12); c.fill(); }
  // chin shadow under the hair, soft cheeks
  c.save(); headPath(k, hx, hy, hw, hh); c.clip();
  c.fillStyle = lin(c, 0, hy + hh * 0.4, 0, hy + hh, [0, 'rgba(0,0,0,0)'], [1, 'rgba(30,8,36,0.3)']); c.fillRect(hx - hw, hy + hh * 0.3, hw * 2, hh);
  c.fillStyle = lin(c, hx, 0, hx + hw, 0, [0, 'rgba(0,0,0,0)'], [1, 'rgba(24,8,40,0.26)']); c.fillRect(hx, hy - hh, hw, hh * 2);
  ell(c, hx, hy - hh * 0.22, hw * 0.95, hh * 0.1, 'rgba(30,10,30,0.14)'); // the shadow of the brow ridge
  for (const sd of [-1, 1]) ell(c, hx + sd * hw * 0.58, hy + hh * 0.32, hw * 0.2, hh * 0.22, 'rgba(40,10,30,0.1)'); // under the cheekbones
  stroke(c, rgba(shade(skin, 0.5), 0.22), 0.5, hx + hw * 0.78, hy + hh * 0.2, hx + hw * 0.58, hy + hh * 0.78, hx + hw * 0.28, hy + hh * 0.97);
  if (f.has('stone')) for (let i = 0; i < 9; i++) ell(c, hx + (jitter(i, 3) - 0.5) * hw * 1.8, hy + (jitter(i, 7) - 0.5) * hh * 1.8, 0.5 + jitter(i, 5) * 0.7, 0.4 + jitter(i, 6) * 0.5, rgba(shade(skin, 0.6), 0.4));
  if (f.has('gaunt')) { ell(c, hx - hw * 0.62, hy + hh * 0.38, hw * 0.28, hh * 0.3, rgba(0x1a1a2a, 0.25)); ell(c, hx + hw * 0.62, hy + hh * 0.38, hw * 0.28, hh * 0.3, rgba(0x1a1a2a, 0.25)); }
  if (f.has('seams')) { stroke(c, rgba(0x2a2a3a, 0.55), 0.45, hx - hw * 0.9, hy - hh * 0.1, hx + hw * 0.9, hy - hh * 0.1); stroke(c, rgba(0x2a2a3a, 0.5), 0.4, hx, hy - hh, hx, hy - hh * 0.2); }
  if (f.has('wraps')) wrapHead(k);
  if (f.has('scales')) for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) for (const sd of [-1, 1]) { c.beginPath(); c.arc(hx + sd * (hw * 0.72 + r * 0.2) - sd * q * 1.2, hy + hh * (0.15 + r * 0.22), 0.9, 0, Math.PI); c.strokeStyle = rgba(lite(skin, 0.5), 0.5); c.lineWidth = 0.35; c.stroke(); }
  if (f.has('cracks')) { stroke(c, rgba(0xff8a2a, 0.9), 0.55, hx - hw * 0.3, hy - hh * 0.95, hx - hw * 0.15, hy - hh * 0.6, hx - hw * 0.3, hy - hh * 0.35); stroke(c, rgba(0xffc040, 0.9), 0.25, hx - hw * 0.3, hy - hh * 0.95, hx - hw * 0.15, hy - hh * 0.6, hx - hw * 0.3, hy - hh * 0.35); stroke(c, rgba(0xff8a2a, 0.8), 0.45, hx + hw * 0.55, hy + hh * 0.1, hx + hw * 0.4, hy + hh * 0.4, hx + hw * 0.6, hy + hh * 0.6); }
  c.restore();
  headPath(k, hx, hy, hw, hh); c.strokeStyle = hex(lineOf(skin)); c.lineWidth = 0.9; c.lineJoin = 'round'; c.stroke();
  void L;
}

function wrapHead(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh } = k;
  const cloth = '#e6dcc0', edge = 'rgba(110,90,60,0.7)';
  for (let i = 0; i < 4; i++) {
    const y = hy - hh * 0.85 + i * hh * 0.24;
    c.beginPath(); c.moveTo(hx - hw, y); c.quadraticCurveTo(hx, y + 1.5 + (i % 2) * 0.6, hx + hw, y - 0.5); c.lineTo(hx + hw, y + hh * 0.2); c.quadraticCurveTo(hx, y + hh * 0.2 + 2, hx - hw, y + hh * 0.22); c.closePath();
    c.fillStyle = cloth; c.fill(); c.strokeStyle = edge; c.lineWidth = 0.35; c.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const y = hy + hh * 0.55 + i * hh * 0.17;
    c.beginPath(); c.moveTo(hx - hw, y); c.quadraticCurveTo(hx, y + 1.4, hx + hw, y - 0.3); c.lineTo(hx + hw, y + hh * 0.15); c.quadraticCurveTo(hx, y + hh * 0.15 + 1.5, hx - hw, y + hh * 0.17); c.closePath();
    c.fillStyle = cloth; c.fill(); c.strokeStyle = edge; c.lineWidth = 0.35; c.stroke();
  }
}

function eyeAt(k: Cx, ex: number, ey: number, sd: number, big: number, cw = 1) {
  const { c, L, feats: f, P } = k;
  const es = (k.stage === 'infant' ? 1.3 : k.stage === 'child' ? 1.14 : k.stage === 'elder' ? 0.94 : 1) * big * (P.eyes === 'wide' ? 1.15 : 1);
  const eh = k.headW * 0.185 * es * (L.fem ? 0.5 : 0.44), ew = k.headW * 0.185 * es * cw;
  const inner = ex - sd * ew, outer = ex + sd * ew, lift = eh * 0.35;
  const top = ey - eh * 1.75, low = ey + eh * 1.15;
  const lens = (t: number, b: number) => { c.beginPath(); c.moveTo(inner, ey + eh * 0.1); c.quadraticCurveTo(ex - sd * ew * 0.1, t, outer, ey - lift); c.quadraticCurveTo(ex + sd * ew * 0.1, b, inner, ey + eh * 0.1); c.closePath(); };
  if (P.eyes === 'closed' || P.eyes === 'happy') {
    const bend = P.eyes === 'happy' ? -eh * 1.0 : eh * 0.9;
    curve(c, hex(INK), 0.95, inner, ey + eh * 0.1, ex, ey + bend, outer, ey - lift);
    if (L.fem) stroke(c, hex(INK), 0.5, outer, ey - lift, outer + sd * 1.1, ey - lift - 0.6);
    return;
  }
  if (f.has('sunkeneyes')) ell(c, ex, ey + 0.2, ew * 1.5, eh * 2.2, rgba(0x20202e, 0.5));
  if (f.has('kohl')) { ell(c, ex, ey, ew * 1.35, eh * 1.9, rgba(0x14141e, 0.85)); stroke(c, hex(INK), 0.8, outer, ey - lift, outer + sd * 2.6, ey - lift - 0.3); }
  lens(top, low);
  c.fillStyle = lin(c, 0, top, 0, low, [0, '#b8b0a8'], [0.5, '#ebe5de'], [1, '#d6cec6']); c.fill();
  c.save(); lens(top, low); c.clip();
  const irisR = eh * 1.08 * (f.has('slit') ? 1 : 1), ix = ex + k.fx * 0.18, iy = ey + eh * 0.05;
  const ir = f.has('glow-eyes') ? mix(L.eye, 0xffffff, 0.3) : L.eye;
  c.fillStyle = rad(c, ix, iy + irisR * 0.2, irisR * 1.1, [0, hex(lite(ir, 0.35))], [0.55, hex(ir)], [1, hex(shade(ir, 0.38))]);
  c.beginPath(); c.arc(ix, iy, irisR, 0, TAU); c.fill();
  c.strokeStyle = hex(shade(ir, 0.3)); c.lineWidth = 0.3; c.stroke();
  if (f.has('slit')) ell(c, ix, iy, irisR * 0.2, irisR * 0.95, hex(INK)); else ell(c, ix, iy, irisR * 0.42, irisR * 0.42, hex(INK));
  ell(c, ix - irisR * 0.35, iy - irisR * 0.4, irisR * 0.2, irisR * 0.17, 'rgba(255,255,255,0.9)');
  c.fillStyle = 'rgba(20,8,24,0.32)'; c.fillRect(inner - 1, top - 1, ew * 2 + 2, eh * 0.9); // the upper lid shades the eye
  c.restore();
  if (f.has('glow-eyes') || f.has('redeyes')) glow(c, ex, ey, ew * 2.6, L.eye, 0.4);
  // lids: a strong upper line with a flick at the outer corner, a faint lower one and the crease above
  c.beginPath(); c.moveTo(inner, ey + eh * 0.1); c.quadraticCurveTo(ex - sd * ew * 0.1, top, outer, ey - lift); c.strokeStyle = hex(INK); c.lineWidth = L.fem ? 0.95 : 0.85; c.lineCap = 'round'; c.stroke();
  stroke(c, hex(INK), L.fem ? 0.7 : 0.5, outer, ey - lift, outer + sd * (L.fem ? 1.5 : 0.9), ey - lift - 0.55);
  c.beginPath(); c.moveTo(inner, ey + eh * 0.1); c.quadraticCurveTo(ex + sd * ew * 0.1, low, outer, ey - lift); c.strokeStyle = rgba(shade(k.skin, 0.45), 0.55); c.lineWidth = 0.35; c.stroke();
  curve(c, rgba(shade(k.skin, 0.4), 0.3), 0.35, inner + sd * 0.3, ey - eh * 2.2, ex, ey - eh * 3.1, outer, ey - eh * 2.3);
  if (k.stage === 'elder') { curve(c, rgba(shade(k.skin, 0.5), 0.5), 0.35, ex - ew, ey + eh * 2.2, ex, ey + eh * 3, ex + ew, ey + eh * 2.2); stroke(c, rgba(shade(k.skin, 0.5), 0.4), 0.3, outer + sd * 0.6, ey, outer + sd * 1.8, ey + 0.7); }
}

function drawFace(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh, L, feats: f, P } = k, id = k.theme.id;
  const ey = hy + hh * 0.04, fx = k.fx, yaw = k.yaw;
  const X = (phi: number) => hx + hw * 0.98 * Math.sin(phi + yaw), CW = (phi: number) => Math.max(0.3, Math.cos(phi + yaw));
  const ex = hw * 0.44, prof = yaw > 0.3;
  const dark = hex(shade(k.skin, 0.5));
  const lipC = mix(k.skin, 0x9a4048, L.fem ? 0.5 : 0.32);
  if (f.has('visor')) { // a smooth face plate with two lights
    rrect(c, hx - hw * 0.82 + fx * 0.4, ey - hh * 0.3, hw * 1.64, hh * 0.6, hh * 0.25, lin(c, 0, ey - hh * 0.3, 0, ey + hh * 0.3, [0, '#2a3040'], [1, '#0e1118']), '#06080c', 0.6);
    for (const sd of [-1, 1]) { glow(c, hx + sd * ex + fx * 0.5, ey, hw * 0.62, L.eye, P.eyes === 'closed' ? 0.2 : 0.6 + 0.2 * Math.sin(P.amb * TAU)); if (P.eyes === 'closed') stroke(c, hex(L.eye), 0.9, hx + sd * ex - 1.8 + fx * 0.5, ey, hx + sd * ex + 1.8 + fx * 0.5, ey); else ell(c, hx + sd * ex + fx * 0.5, ey, hw * 0.17, hh * 0.1, hex(mix(L.eye, 0xffffff, 0.6))); }
  } else if (f.has('cyclops')) {
    eyeAt(k, hx + fx * 0.5, ey - hh * 0.05, 1, 1.9);
  } else {
    eyeAt(k, X(-0.46), ey, -1, 1, CW(-0.46)); eyeAt(k, X(0.46), ey, 1, 1, CW(0.46));
    if (f.has('mecheye')) { const mx = hx + ex + fx, my = ey; ell(c, mx, my, hw * 0.27, hw * 0.27, '#3a4050', '#12161f', 0.6); ell(c, mx, my, hw * 0.16, hw * 0.16, rad(c, mx, my, hw * 0.16, [0, '#ff8a8a'], [0.5, '#d02020'], [1, '#601010'])); ell(c, mx - 0.5, my - 0.5, 0.5, 0.5, '#fff'); stroke(c, '#8a92a4', 0.5, mx - hw * 0.32, my - hw * 0.3, mx + hw * 0.32, my - hw * 0.3); }
    if (f.has('glasseye')) ell(c, hx - ex + fx, ey, hw * 0.2, hw * 0.2, rgba(0xffffff, 0.35));
  }
  // brows: a serious, slightly lowered line that is heavy on men and thin on women
  if (!f.has('visor')) {
    const bc = hex(k.stage === 'elder' ? 0xc8c8d0 : shade(k.hair, 0.78)), bw = f.has('heavybrow') ? 2.1 : f.has('gaunt') ? 0.8 : L.fem ? 0.75 : 1.25;
    const by = ey - hh * 0.27 - P.brow * 0.7, inn = 0.45 + (P.brow < -0.1 ? 1 : 0) - (P.brow > 0.2 ? 0.5 : 0);
    for (const sd of [-1, 1]) {
      const x0 = X(sd * 0.2), x1 = X(sd * 0.78);
      c.beginPath(); c.moveTo(x0, by + inn); c.quadraticCurveTo((x0 + x1) / 2, by - 0.7 - (L.fem ? 0.4 : 0), x1, by + 0.6); c.strokeStyle = bc; c.lineWidth = bw; c.lineCap = 'round'; c.stroke();
    }
  }
  // nose: a shaded bridge, the wing of the nostril and a highlight on the tip
  const ny = hy + hh * 0.36;
  if (f.has('fur') && L.race === 'beast') { poly(c, [hx + fx - 1.5, ny - 0.5, hx + fx + 1.5, ny - 0.5, hx + fx, ny + 1], '#2a1e1e', undefined); ell(c, hx + fx, hy + hh * 0.56, hw * 0.5, hh * 0.28, rgba(0xfff4e4, 0.45)); stroke(c, '#2a1e1e', 0.4, hx + fx, ny + 1, hx + fx, ny + 2.4); }
  else if (!f.has('visor')) {
    const wide = id === 'dwarf' || id === 'orc' || id === 'giant' ? 1.45 : 1, nx = X(0);
    if (prof) { poly(c, [nx - 0.6, ey + 0.8, nx + 2.4 * wide, ny + 0.9, nx + 0.4, ny + 1.5], hex(k.skin), hex(lineOf(k.skin)), 0.45); } // the nose in profile breaks the outline
    stroke(c, rgba(shade(k.skin, 0.45), 0.4), 0.7, nx + 1.3 * wide, ey + 0.5, nx + 1.1 * wide, ny - 0.4);
    c.beginPath(); c.moveTo(nx - 1.6 * wide, ny - 0.2); c.quadraticCurveTo(nx - 2.1 * wide, ny + 1.1, nx - 0.9 * wide, ny + 1.4); c.moveTo(nx + 1.6 * wide, ny - 0.2); c.quadraticCurveTo(nx + 2.1 * wide, ny + 1.1, nx + 0.9 * wide, ny + 1.4); c.strokeStyle = rgba(shade(k.skin, 0.4), 0.7); c.lineWidth = 0.45; c.stroke();
    ell(c, nx - 0.6, ny - 0.2, 0.7, 1.4, rgba(lite(k.skin, 0.5), 0.35));
    ell(c, nx, ny + 1.5, 1.3 * wide, 0.45, rgba(shade(k.skin, 0.4), 0.25));
  }
  // mouth
  const my = hy + hh * 0.66, mx = X(0) - (prof ? 0.4 : 0), mo = P.mouth, mw = hw * (L.fem ? 0.2 : 0.23) * Math.max(0.5, CW(0));
  if (f.has('visor')) { for (let i = -2; i <= 2; i++) stroke(c, 'rgba(10,12,18,0.7)', 0.4, mx + i * 0.9, hy + hh * 0.68, mx + i * 0.9, hy + hh * 0.82); }
  else if (mo === 'open' || mo === 'sing') { poly(c, [mx - mw, my, mx, my - 0.5, mx + mw, my, mx + mw * 0.75, my + 1.7, mx, my + 2.2, mx - mw * 0.75, my + 1.7], '#3a1018', hex(INK), 0.5); stroke(c, '#e8e0d4', 0.7, mx - mw * 0.7, my + 0.1, mx + mw * 0.7, my + 0.1); ell(c, mx, my + 1.6, mw * 0.5, 0.5, '#a04050'); }
  else if (mo === 'oh') ell(c, mx, my + 0.6, mw * 0.4, 0.9, '#3a1018', hex(INK), 0.4);
  else if (mo === 'chew' || f.has('hunger')) { const o = Math.sin(P.amb * TAU * 2) * 0.7; curve(c, dark, 0.7, mx - mw, my, mx, my + 0.4 + o, mx + mw, my); }
  else {
    const sm = mo === 'smile' ? 0.9 : 0;
    curve(c, hex(shade(lipC, 0.45)), 0.7, mx - mw, my - sm * 0.4, mx, my + 0.15 + sm * 0.5, mx + mw, my - sm * 0.4); // the line between the lips
    curve(c, rgba(shade(lipC, 0.6), 0.55), 0.5, mx - mw * 0.7, my - 0.45, mx, my - 0.95, mx + mw * 0.7, my - 0.45); // the bow of the upper lip
    ell(c, mx, my + 0.95, mw * 0.55, 0.5, rgba(lipC, 0.65)); ell(c, mx - 0.3, my + 0.85, mw * 0.2, 0.2, rgba(0xffffff, 0.2));
  }
  if (k.stage === 'elder') for (const sd of [-1, 1]) curve(c, rgba(shade(k.skin, 0.45), 0.5), 0.4, hx + sd * hw * 0.34 + fx, ny + 0.6, hx + sd * hw * 0.56 + fx, my - 0.6, hx + sd * hw * 0.5 + fx, my + 1.8); // lines from nose to mouth
  if (f.has('fangs')) for (const sd of [-1, 1]) poly(c, [mx + sd * mw * 0.6 - 0.45, my + 0.1, mx + sd * mw * 0.6 + 0.45, my + 0.1, mx + sd * mw * 0.6, my + 1.9], '#f4f0ec', '#8a7a7a', 0.25);
  if (f.has('tusks')) for (const sd of [-1, 1]) poly(c, [mx + sd * hw * 0.3 - 0.9, my + 0.9, mx + sd * hw * 0.3 + 0.9, my + 0.9, mx + sd * hw * 0.34, my - 2.6], '#ece6cc', '#7a7456', 0.35);
  if (f.has('gills')) for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) stroke(c, rgba(shade(k.skin, 0.5), 0.7), 0.4, hx + sd * hw * 0.92, hy + hh * (0.55 + i * 0.12), hx + sd * hw * 0.74, hy + hh * (0.58 + i * 0.12));
  // face marks
  const m = L.mark;
  if (m === 1) for (const [dx, dy] of [[-0.55, 0.38], [-0.38, 0.45], [-0.25, 0.34], [0.5, 0.4], [0.35, 0.47], [0.24, 0.36]]) ell(c, hx + dx * hw + fx, hy + dy * hh, 0.28, 0.28, rgba(0x6a3a22, 0.5));
  if (m === 2) { stroke(c, '#8a2a2a', 0.65, hx + hw * 0.5, ey - hh * 0.45, hx + hw * 0.62, ey + hh * 0.05, hx + hw * 0.7, ey + hh * 0.5); stroke(c, '#c8a0a0', 0.3, hx + hw * 0.46, ey - hh * 0.15, hx + hw * 0.66, ey - hh * 0.15); }
  if (m === 3) stroke(c, rgba(shade(k.skin, 0.5), 0.55), 0.5, hx - hw * 0.7, hy + hh * 0.5, hx - hw * 0.4, hy + hh * 0.66); // a crease from an old fight
  if (m === 4) for (const sd of [-1, 1]) { stroke(c, hex(shade(L.cloth2, 0.7)), 0.8, hx + sd * hw * 0.5, hy + hh * 0.3, hx + sd * hw * 0.88, hy + hh * 0.24); stroke(c, hex(shade(L.cloth2, 0.7)), 0.8, hx + sd * hw * 0.5, hy + hh * 0.44, hx + sd * hw * 0.85, hy + hh * 0.4); }
  if (f.has('warpaint')) { stroke(c, '#8a2a1a', 1.1, hx - hw * 0.8, hy + hh * 0.24, hx + hw * 0.8, hy + hh * 0.24); stroke(c, '#8a2a1a', 0.7, hx - hw * 0.15, hy - hh * 0.9, hx - hw * 0.1, hy - hh * 0.4); }
  if (f.has('scars')) { stroke(c, '#7a2a2a', 0.5, hx - hw * 0.6, hy - hh * 0.4, hx - hw * 0.3, hy + hh * 0.3); }
  if (f.has('rebirthmark')) { stroke(c, rgba(0xc8e8ff, 0.9), 0.7, hx, hy - hh * 0.9, hx, hy - hh * 0.55); glow(c, hx, hy - hh * 0.72, 4, 0xc8e8ff, 0.5); }
  if (f.has('moonmark')) { c.beginPath(); c.arc(hx, hy - hh * 0.62, 1.4, 0.6, TAU - 0.6); c.strokeStyle = rgba(0xe8e8ff, 0.95); c.lineWidth = 0.6; c.stroke(); }
  if (f.has('tattoo') && !f.has('wraps')) { stroke(c, rgba(0x2a4a7a, 0.7), 0.5, hx - hw * 0.9, hy + hh * 0.1, hx - hw * 0.75, hy + hh * 0.5); }
  if (f.has('mask')) { rrect(c, hx - hw * 0.95, hy + hh * 0.28, hw * 1.9, hh * 0.74, hh * 0.3, '#22202c', '#0a0810', 0.5); stroke(c, 'rgba(255,255,255,0.12)', 0.5, hx - hw * 0.6, hy + hh * 0.4, hx - hw * 0.2, hy + hh * 0.35); }
  if (f.has('monocle')) { c.beginPath(); c.arc(hx + ex + fx, ey, hw * 0.3, 0, TAU); c.strokeStyle = '#d9a030'; c.lineWidth = 0.7; c.stroke(); ell(c, hx + ex + fx - 0.5, ey - 0.5, 0.7, 0.4, rgba(0xffffff, 0.6)); stroke(c, '#d9a030', 0.3, hx + ex + fx + hw * 0.2, ey + hw * 0.26, hx + ex + fx + hw * 0.1, hy + hh * 1.5); }
  if (f.has('darkglasses')) { for (const sd of [-1, 1]) ell(c, hx + sd * ex + fx, ey, hw * 0.3, hh * 0.18, '#14121c', '#000', 0.5); stroke(c, '#000', 0.6, hx - ex + fx + hw * 0.3, ey, hx + ex + fx - hw * 0.3, ey); }
}

function headTop(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh, feats: f } = k;
  if (f.has('leafcrest')) for (const [dx, dy, r] of [[-0.9, -0.55, -0.9], [-0.6, -0.9, -0.4], [0.7, -0.85, 0.5]] as [number, number, number][]) { c.save(); c.translate(hx + dx * hw, hy + dy * hh); c.rotate(r); poly(c, [0, 0, 2.2, -1.3, 4.6, 0, 2.2, 1.3], '#4aa860', '#1f5a30', 0.4); stroke(c, '#1f5a30', 0.25, 0.3, 0, 4, 0); c.restore(); }
  if (f.has('webcrown')) { c.beginPath(); c.moveTo(hx - hw * 0.9, hy - hh * 0.5); c.quadraticCurveTo(hx, hy - hh * 0.95, hx + hw * 0.9, hy - hh * 0.5); c.strokeStyle = '#d8dcf0'; c.lineWidth = 0.7; c.stroke(); for (let i = -2; i <= 2; i++) { stroke(c, '#d8dcf0', 0.45, hx + i * hw * 0.38, hy - hh * 0.72 + Math.abs(i) * 1.2, hx + i * hw * 0.5, hy - hh * 1.05 - (i === 0 ? 3.5 : 1.2) + Math.abs(i) * 0.4); ell(c, hx + i * hw * 0.5, hy - hh * 1.05 - (i === 0 ? 3.5 : 1.2) + Math.abs(i) * 0.4, 0.55, 0.55, '#f0f4ff'); } if (f.has('matron')) { for (let i = -2; i <= 2; i++) ell(c, hx + i * hw * 0.38, hy - hh * 0.72 + Math.abs(i) * 1.2, 0.7, 0.7, '#d02a3a'); } }
  if (f.has('goldcirclet')) { curve(c, '#f2c94c', 0.9, hx - hw * 1.0, hy - hh * 0.36, hx, hy - hh * 0.6, hx + hw * 1.0, hy - hh * 0.36); ell(c, hx, hy - hh * 0.58, 0.9, 0.9, '#6ad0ff', '#2a5a8a', 0.3); }
  if (f.has('shellcrown')) for (let i = -2; i <= 2; i++) { c.save(); c.translate(hx + i * hw * 0.4, hy - hh * (0.78 - Math.abs(i) * 0.08)); c.rotate(i * 0.25); c.beginPath(); c.moveTo(-1.8, 1.2); c.quadraticCurveTo(0, -4 + Math.abs(i) * 0.8, 1.8, 1.2); c.closePath(); c.fillStyle = '#f6e8ec'; c.fill(); c.strokeStyle = '#b08090'; c.lineWidth = 0.35; c.stroke(); c.restore(); }
  if (f.has('crown') && !k.L.hat) { const y0 = hy - hh * 0.6; poly(c, [hx - hw * 0.9, y0, hx - hw * 0.9, y0 - 4.5, hx - hw * 0.45, y0 - 2, hx, y0 - 6, hx + hw * 0.45, y0 - 2, hx + hw * 0.9, y0 - 4.5, hx + hw * 0.9, y0], lin(c, 0, y0 - 6, 0, y0, [0, '#fff0a0'], [1, '#c8962a']), '#6a4a10', 0.6); }
  if (f.has('waterplate')) { ell(c, hx, hy - hh * 0.98, hw * 0.55, hh * 0.18, '#2a7aa0', '#14405a', 0.5); ell(c, hx - 0.8, hy - hh * 0.98, hw * 0.25, hh * 0.08, rgba(0xbff0ff, 0.8)); }
  if (f.has('goggles') && !k.L.hat) { rrect(c, hx - hw * 1.1, hy - hh * 0.95, hw * 2.2, hh * 0.28, 0.4, '#5a3a22', '#2a1a10', 0.5); for (const sd of [-1, 1]) { ell(c, hx + sd * hw * 0.5, hy - hh * 0.9, hw * 0.34, hh * 0.3, '#c08a3a', '#3a2a10', 0.6); ell(c, hx + sd * hw * 0.5, hy - hh * 0.9, hw * 0.22, hh * 0.2, '#9ad8f0'); } }
  if (f.has('lamp') && !k.L.hat) { rrect(c, hx - 2, hy - hh * 1.2, 4, 3, 1, '#40382a', '#1a1408', 0.4); glow(c, hx, hy - hh * 1.1, 6, 0xfff2a0, 0.6); }
  if (f.has('halo')) { const y = hy - hh * 1.5; glow(c, hx, y, 12, 0xfff0a0, 0.45); c.beginPath(); c.ellipse(hx, y, hw * 0.85, 2, 0, 0, TAU); c.strokeStyle = rgba(0xfff4b0, 0.95); c.lineWidth = 1.1; c.stroke(); }
  if (f.has('nemes') && false) { /* drawn with the hat */ }
  if (f.has('goldbeard')) { rrect(c, hx - 1.1, hy + hh * 0.85, 2.2, 6.5, 0.8, '#e8c050', '#7a5a10', 0.45); for (let i = 0; i < 3; i++) stroke(c, '#7a5a10', 0.3, hx - 1, hy + hh * 0.85 + 1.5 + i * 1.7, hx + 1, hy + hh * 0.85 + 1.5 + i * 1.7); }
  if (f.has('featherhair')) { poly(c, [hx + hw * 0.9, hy - hh * 0.5, hx + hw * 1.5, hy - hh * 1.2, hx + hw * 1.7, hy - hh * 0.9, hx + hw * 1.1, hy - hh * 0.3], '#d8ecf8', '#6a8aa8', 0.4); }
  if (f.has('mushcap') && false) { /* head back */ }
  if (f.has('wisdom')) { curve(c, hex(0x2a1a3a), 0.5, k.headX - hw * 0.25, hy + hh * 0.9, k.headX, hy + hh * 0.7, k.headX + hw * 0.25, hy + hh * 0.9); }
}

/** seen from behind: hair or a hat over the whole skull, no face */
function backOfHead(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh, L } = k, hat = L.hat;
  drawHead(k);
  const hidden = ['helmet', 'hood', 'turban', 'furhat', 'minerhat', 'veil', 'nemes', 'horned', 'mitre', 'cowl'].includes(hat);
  if (hidden || L.hairStyle === 3 || k.theme.hairless || k.feats.has('hairless') || hat === 'hood' || hat === 'cowl') return;
  const hair = k.hair, ln = hex(lineOf(hair));
  c.beginPath(); c.moveTo(hx - hw * 1.04, hy + hh * 0.2);
  c.bezierCurveTo(hx - hw * 1.22, hy - hh * 1.0, hx - hw * 0.7, hy - hh * 1.36, hx, hy - hh * 1.32);
  c.bezierCurveTo(hx + hw * 0.7, hy - hh * 1.36, hx + hw * 1.22, hy - hh * 1.0, hx + hw * 1.04, hy + hh * 0.2);
  c.quadraticCurveTo(hx + hw * 0.9, hy + hh * 0.8, hx, hy + hh * 0.86); c.quadraticCurveTo(hx - hw * 0.9, hy + hh * 0.8, hx - hw * 1.04, hy + hh * 0.2); c.closePath();
  c.fillStyle = lin(c, 0, hy - hh * 1.3, 0, hy + hh * 0.9, [0, hex(lite(hair, 0.22))], [0.5, hex(hair)], [1, hex(shade(hair, 0.62))]); c.fill(); c.strokeStyle = ln; c.lineWidth = 0.8; c.stroke();
  c.save(); c.clip();
  for (let i = -4; i <= 4; i++) stroke(c, rgba(shade(hair, 0.5), 0.35), 0.5, hx, hy - hh * 1.1, hx + i * hw * 0.24, hy + hh * 0.8); // strands from the crown
  stroke(c, rgba(lite(hair, 0.55), 0.45), 0.7, hx - hw * 0.5, hy - hh * 0.9, hx - hw * 0.2, hy - hh * 0.5);
  ell(c, hx, hy - hh * 1.0, 1.1, 0.8, rgba(shade(hair, 0.4), 0.5));
  c.restore();
}

// the multi-headed hood of a naga
function nagaHood(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh } = k;
  if (!k.feats.has('hood') && !k.feats.has('multihood')) return;
  const col = k.skin, flare = 1.9 + Math.sin(k.P.amb * TAU) * 0.08;
  c.beginPath(); c.moveTo(hx - hw * 0.9, hy + hh * 0.9); c.bezierCurveTo(hx - hw * flare, hy + hh * 0.4, hx - hw * flare * 0.9, hy - hh * 1.5, hx, hy - hh * 1.55); c.bezierCurveTo(hx + hw * flare * 0.9, hy - hh * 1.5, hx + hw * flare, hy + hh * 0.4, hx + hw * 0.9, hy + hh * 0.9); c.closePath();
  c.fillStyle = rad(c, hx, hy, hw * 2.1, [0, hex(lite(col, 0.2))], [0.7, hex(shade(col, 0.82))], [1, hex(shade(col, 0.6))]); c.fill(); c.strokeStyle = hex(lineOf(col)); c.lineWidth = 0.9; c.stroke();
  c.save(); c.clip();
  for (let r = 0; r < 5; r++) for (let q = -3; q <= 3; q++) { c.beginPath(); c.arc(hx + q * hw * 0.52 + (r % 2) * hw * 0.26, hy - hh * 1.3 + r * hh * 0.5, hw * 0.2, 0, Math.PI); c.strokeStyle = rgba(shade(col, 0.5), 0.4); c.lineWidth = 0.4; c.stroke(); }
  c.restore();
  ell(c, hx, hy - hh * 0.5, hw * 0.4, hh * 0.15, rgba(k.accent, 0.8));
  if (k.feats.has('multihood')) for (const [dx, dy, s] of [[-1.5, -1.4, 0.7], [0, -1.8, 1], [1.5, -1.4, 0.7]] as [number, number, number][]) {
    const x = hx + dx * hw, y = hy + dy * hh;
    c.beginPath(); c.moveTo(x - 2.6 * s, y + 3 * s); c.quadraticCurveTo(x - 3 * s, y - 2 * s, x, y - 3.5 * s); c.quadraticCurveTo(x + 3 * s, y - 2 * s, x + 2.6 * s, y + 3 * s); c.closePath(); c.fillStyle = hex(lite(col, 0.1)); c.fill(); c.strokeStyle = hex(lineOf(col)); c.lineWidth = 0.6; c.stroke();
    ell(c, x - 0.9 * s, y - 0.6 * s, 0.5, 0.65, '#e0c030'); ell(c, x + 0.9 * s, y - 0.6 * s, 0.5, 0.65, '#e0c030'); stroke(c, '#c03a4a', 0.4, x, y + 1.4 * s, x, y + 3.4 * s);
  }
}

// ---------- overlays on the body for the peoples that have more than skin and cloth ----------
function bodyOverlay(k: Cx) {
  const { c, feats: f, shY, hipY, sw } = k;
  const sx = (k.sh[0][0] + k.sh[1][0]) / 2, th = hipY - shY;
  c.save(); torsoPath(k); c.clip();
  if (f.has('wraps')) { // bandages crossing the chest and waist
    for (let i = 0; i < 6; i++) { const y = shY + 1 + i * th * 0.17; c.beginPath(); c.moveTo(sx - sw - 1, y + 1); c.lineTo(sx + sw + 1, y - 1.2); c.lineTo(sx + sw + 1, y + th * 0.13); c.lineTo(sx - sw - 1, y + th * 0.16 + 1); c.closePath(); c.fillStyle = i % 2 ? '#e2d8bc' : '#ece2c8'; c.fill(); c.strokeStyle = 'rgba(110,90,60,0.65)'; c.lineWidth = 0.4; c.stroke(); }
    stroke(c, 'rgba(150,120,70,0.5)', 0.4, sx - sw, shY + 2, sx + sw, shY + th * 0.8);
  }
  if (f.has('cracks')) {
    const seeds = [[-0.5, 0.15, -0.2, 0.4, -0.55, 0.75], [0.35, 0.1, 0.55, 0.45, 0.25, 0.8], [0, 0.3, 0.1, 0.55, -0.05, 0.9]];
    for (const s of seeds) { const pts = [sx + s[0] * sw, shY + s[1] * th, sx + s[2] * sw, shY + s[3] * th, sx + s[4] * sw, shY + s[5] * th]; stroke(c, rgba(0xff6a1a, 0.5 + 0.2 * Math.sin(k.P.amb * TAU)), 1.5, ...pts); stroke(c, rgba(0xff8a2a, 0.95), 0.65, ...pts); stroke(c, rgba(0xffe080, 0.95), 0.25, ...pts); }
  }
  if (f.has('stone')) { for (let i = 0; i < 12; i++) ell(c, sx + (jitter(i, 11) - 0.5) * sw * 2, shY + jitter(i, 12) * th, 0.8 + jitter(i, 13), 0.5 + jitter(i, 14) * 0.6, rgba(shade(k.skin, 0.55), 0.4)); stroke(c, 'rgba(50,50,56,0.55)', 0.5, sx - sw * 0.3, shY + th * 0.1, sx - sw * 0.1, shY + th * 0.4, sx - sw * 0.4, shY + th * 0.7); }
  if (f.has('moss')) for (let i = 0; i < 4; i++) ell(c, sx - sw * 0.7 + i * sw * 0.45, shY + 1 + (i % 2) * 1.5, 2.2, 1.3, rgba(0x6a8a3a, 0.8));
  if (f.has('ribs')) for (let i = 0; i < 4; i++) { curve(c, 'rgba(30,30,44,0.6)', 0.55, sx - sw * 0.8, shY + 3 + i * 2.2, sx, shY + 5 + i * 2.2, sx + sw * 0.8, shY + 3 + i * 2.2); }
  if (f.has('plates') && k.theme.id === 'soulmachine') { for (let i = 0; i < 3; i++) stroke(c, 'rgba(20,24,34,0.55)', 0.5, sx - sw, shY + th * (0.3 + i * 0.22), sx + sw, shY + th * (0.3 + i * 0.22)); stroke(c, 'rgba(255,255,255,0.45)', 0.6, sx - sw * 0.7, shY + 2, sx - sw * 0.5, shY + th * 0.8); }
  if (f.has('neon')) { for (const [col, ox] of [[0xff4ad0, -0.4], [0x4ae8ff, 0.4]] as [number, number][]) { stroke(c, rgba(col, 0.35), 2.2, sx + ox * sw, shY + 1, sx + ox * sw, hipY); stroke(c, rgba(col, 0.95), 0.7, sx + ox * sw, shY + 1, sx + ox * sw, hipY); } }
  if (f.has('engraved')) for (let i = 0; i < 3; i++) curve(c, 'rgba(224,192,96,0.8)', 0.4, sx - sw * 0.7, shY + th * (0.3 + i * 0.2), sx, shY + th * (0.2 + i * 0.2), sx + sw * 0.7, shY + th * (0.3 + i * 0.2));
  if (f.has('rust')) for (let i = 0; i < 5; i++) ell(c, sx + (jitter(i, 21) - 0.5) * sw * 1.8, shY + jitter(i, 22) * th, 1.4, 1, rgba(0xa05a2a, 0.5));
  if (f.has('runes')) { /* tattoos are drawn on the arms */ }
  if (f.has('mistcloak')) { c.fillStyle = 'rgba(160,170,190,0.35)'; c.fillRect(sx - sw - 2, shY - 1, sw * 2 + 4, th * 0.4); }
  if (f.has('rope')) { stroke(c, '#c8a468', 1.1, sx - sw - 1, hipY - 3.2, sx + sw + 1, hipY - 3.8); for (let i = 0; i < 6; i++) stroke(c, 'rgba(110,80,40,0.7)', 0.3, sx - sw + i * sw * 0.36, hipY - 4.3, sx - sw + i * sw * 0.36 + 0.7, hipY - 2.6); }
  if (f.has('mane')) { for (let i = 0; i < 7; i++) poly(c, [sx - sw + i * sw * 0.3, shY - 0.5, sx - sw + i * sw * 0.3 + 1.6, shY + 3.8, sx - sw + i * sw * 0.3 + 3.2, shY - 0.5], hex(lite(k.skin, 0.4)), undefined); }
  if (f.has('stripes')) for (let i = 0; i < 3; i++) stroke(c, rgba(0x3a2410, 0.5), 0.9, sx - sw, shY + 3 + i * 3.4, sx - sw * 0.2, shY + 4.5 + i * 3.4);
  if (f.has('sealband')) { rrect(c, sx - sw, shY + th * 0.2, sw * 2, 2.4, 0.4, '#2a2a30', '#0a0a10', 0.4); for (let i = 0; i < 4; i++) stroke(c, '#d9a030', 0.4, sx - sw * 0.7 + i * sw * 0.45, shY + th * 0.2 + 0.6, sx - sw * 0.7 + i * sw * 0.45 + 0.6, shY + th * 0.2 + 1.8); }
  c.restore();
  // pauldrons and plate pieces
  if (f.has('plates') && k.theme.id === 'construct') {
    for (const sd of [-1, 1]) { const x = sx + sd * (sw - 0.5), y = shY + 1.4; c.save(); c.translate(x, y); c.beginPath(); c.moveTo(-3.4, 1.6); c.quadraticCurveTo(0, -4.6, 3.4, 1.6); c.closePath(); c.fillStyle = lin(c, -3, -4, 3, 2, [0, '#e0d6b8'], [1, '#8a7a50']); c.fill(); c.strokeStyle = '#3a3220'; c.lineWidth = 0.6; c.stroke(); for (const r of [-1.6, 0, 1.6]) ell(c, r, -0.5, 0.45, 0.45, '#5a4a2a'); c.restore(); }
    rrect(c, sx - 3, shY + th * 0.55, 6, 3.4, 0.7, '#b89a54', '#3a3220', 0.5); ell(c, sx, shY + th * 0.55 + 1.7, 1, 1, '#2a2a30'); glow(c, sx, shY + th * 0.55 + 1.7, 3, k.accent, 0.4);
  }
  if (f.has('core')) {
    const cy = shY + th * 0.42, pulse = 0.65 + 0.35 * Math.sin(k.P.amb * TAU);
    glow(c, sx, cy, 11, k.L.eye, 0.35 + 0.25 * pulse);
    c.beginPath(); c.arc(sx, cy, 3.4, 0, TAU); c.fillStyle = '#12161f'; c.fill(); c.strokeStyle = '#8a92a4'; c.lineWidth = 0.8; c.stroke();
    ell(c, sx, cy, 2.3, 2.3, rad(c, sx, cy, 2.3, [0, '#ffffff'], [0.5, hex(k.L.eye)], [1, hex(shade(k.L.eye, 0.5))]));
    for (let i = 0; i < 6; i++) stroke(c, rgba(0xffffff, 0.35), 0.3, sx, cy, sx + Math.cos(i * 1.047 + k.P.amb * 2) * 2.2, cy + Math.sin(i * 1.047 + k.P.amb * 2) * 2.2);
  }
  if (f.has('runes') || f.has('glowrunes')) {
    for (const sd of [-1, 1]) { const a = k.sh[sd < 0 ? 0 : 1], h = k.hand[sd < 0 ? 0 : 1]; for (let i = 0; i < 3; i++) { const t = 0.35 + i * 0.2, x = a[0] + (h[0] - a[0]) * t, y = a[1] + (h[1] - a[1]) * t; const col = f.has('glowrunes') ? '#6ad0ff' : '#3a2a4a'; stroke(c, col, 0.45, x - 0.8, y - 0.7, x + 0.8, y + 0.6); stroke(c, col, 0.45, x - 0.8, y + 0.6, x + 0.8, y - 0.7); if (f.has('glowrunes')) glow(c, x, y, 2.6, 0x6ad0ff, 0.5); } }
  }
  if (f.has('tallcollar')) { for (const sd of [-1, 1]) poly(c, [sx + sd * 1.2, shY - 0.6, sx + sd * (sw + 0.4), shY - 3.8, sx + sd * (sw + 0.8), shY + 1.6, sx + sd * 1.2, shY + 2.4], hex(shade(k.L.cloth, 0.55)), '#1a1018', 0.5); }
  if (f.has('ledger') && !k.L.tool) { rrect(c, sx + sw * 0.35, hipY - 5.2, 4, 5.2, 0.5, '#5a1a2a', '#201018', 0.5); stroke(c, '#d9a030', 0.4, sx + sw * 0.35 + 1, hipY - 4, sx + sw * 0.35 + 3, hipY - 4); }
  if (f.has('contract')) { rrect(c, sx - sw - 1.8, hipY - 5.6, 2.6, 6.5, 1.2, '#efe3c0', '#8a7040', 0.45); stroke(c, '#b02a2a', 0.35, sx - sw - 1.4, hipY - 3.4, sx - sw - 0.4, hipY - 3.4); }
  if (f.has('sunstrap')) { stroke(c, hex(k.accent2), 1.1, sx - sw * 0.9, shY + 1, sx + sw * 0.9, hipY - 4); stroke(c, hex(k.accent2), 1.1, sx + sw * 0.9, shY + 1, sx - sw * 0.9, hipY - 4); ell(c, sx, shY + th * 0.4, 1.2, 1.2, '#f2c94c', '#7a5a10', 0.4); }
  if (f.has('shedskin')) { c.beginPath(); c.moveTo(sx - sw * 0.9, shY + 0.5); c.quadraticCurveTo(sx, shY + th * 0.2, sx + sw * 0.9, shY + th * 0.9); c.lineTo(sx + sw * 0.9 + 2.4, shY + th * 0.9); c.quadraticCurveTo(sx + 1, shY + th * 0.1, sx - sw * 0.9 + 2.2, shY - 0.5); c.closePath(); c.fillStyle = 'rgba(240,250,240,0.55)'; c.fill(); c.strokeStyle = 'rgba(80,120,100,0.6)'; c.lineWidth = 0.4; c.stroke(); }
  if (f.has('goldjewel')) { for (let i = -2; i <= 2; i++) ell(c, sx + i * sw * 0.32, shY + 2 + (2 - Math.abs(i)) * -0.1 + Math.abs(i) * 0.4, 0.8, 0.8, '#e8c050', '#7a5a10', 0.3); ell(c, sx, shY + 3.4, 1.2, 1.2, '#2a9a8a', '#14504a', 0.35); }
  if (f.has('pearls')) { for (let i = -2; i <= 2; i++) ell(c, sx + i * sw * 0.3, shY + 1.8 + Math.abs(i) * 0.4, 0.75, 0.75, '#f6f0f4', '#a090a0', 0.25); }
  if (f.has('beads')) { for (let i = -2; i <= 2; i++) ell(c, sx + i * sw * 0.3, shY + 2.4 + Math.abs(i) * 0.3, 0.7, 0.7, hex([0xc04a3a, 0x3a8ac0, 0xd9a030][(i + 2) % 3]), undefined); }
  if (f.has('bannerscrap')) { poly(c, [sx - sw, shY, sx - sw + 3, shY + 1, sx - sw + 5, shY + th * 0.9, sx - sw + 3, shY + th * 0.7, sx - sw + 1, shY + th * 0.95, sx - sw - 1, shY + th * 0.6], '#7a2a2a', '#3a1010', 0.4); }
  if (f.has('bread')) { c.save(); ell(c, k.hand[1][0] - 0.5, k.hand[1][1] - 2, 3.2, 2, '#c8924a', '#6a4418', 0.5); stroke(c, '#7a5222', 0.35, k.hand[1][0] - 1.5, k.hand[1][1] - 2.6, k.hand[1][0] - 0.8, k.hand[1][1] - 1.4); c.restore(); }
  if (f.has('canopic')) { rrect(c, k.hand[0][0] - 2.2, k.hand[0][1] - 5.5, 4.4, 5.5, 1.4, '#c8a468', '#6a4a20', 0.5); ell(c, k.hand[0][0], k.hand[0][1] - 5.8, 2.6, 1.1, '#6a8a9a', '#2a3a44', 0.4); }
  if (f.has('clubbed')) { /* the club is the tool */ }
  void f;
}

// ---------- what a traveller carries: a strap and pouch, a scarf at the neck ----------
function carried(k: Cx, fit: Fit) {
  const { c, shY, hipY, sw, L } = k, sx = (k.sh[0][0] + k.sh[1][0]) / 2, hx = (k.hp[0][0] + k.hp[1][0]) / 2;
  const casual = ['tunic', 'leather', 'cloak', 'vest', 'farmer', 'sailor', 'fur', 'miner', 'apron', 'bard'].includes(L.outfit);
  if (casual && (L.pattern === 0 || L.pattern === 3) && k.stage !== 'child' && k.stage !== 'infant') {
    const lc = 0x4a3322;
    c.save(); torsoPath(k); c.clip();
    stroke(c, hex(lineOf(lc)), 2.2, sx - sw * 0.8, shY + 0.5, hx + k.ww * 0.9, hipY - 1); stroke(c, hex(lc), 1.5, sx - sw * 0.8, shY + 0.5, hx + k.ww * 0.9, hipY - 1);
    stroke(c, rgba(lite(lc, 0.5), 0.5), 0.4, sx - sw * 0.8 + 0.5, shY + 0.5, hx + k.ww * 0.9 + 0.5, hipY - 1);
    c.restore();
    const px = hx + k.ww * 0.95, py = hipY - 2.4;
    rrect(c, px - 3.2, py, 6.4, 6.2, 1.2, lin(c, px - 3, py, px + 3, py + 6, [0, hex(lite(lc, 0.12))], [1, hex(shade(lc, 0.7))]), hex(lineOf(lc)), 0.6);
    poly(c, [px - 3.2, py + 1, px + 3.2, py + 1, px + 2.4, py + 3.2, px - 2.4, py + 3.2], hex(shade(lc, 0.85)), hex(lineOf(lc)), 0.4);
    ell(c, px, py + 3.2, 0.7, 0.7, '#b8a070', '#5a4a2a', 0.3);
  }
  if (['cloak', 'fur', 'leather', 'knight'].includes(L.outfit) && L.pattern % 2 === 0 && k.stage !== 'infant') { // a scarf wound at the neck with one end hanging
    const sc = shade(fit.trim || L.cloth2, 0.8), sy = shY - 0.8;
    rrect(c, sx - sw * 0.52, sy - 1.2, sw * 1.04, 3.6, 1.6, lin(c, 0, sy, 0, sy + 3, [0, hex(lite(sc, 0.15))], [1, hex(shade(sc, 0.65))]), hex(lineOf(sc)), 0.5);
    poly(c, [sx + sw * 0.18, sy + 2, sx + sw * 0.5, sy + 2.2, sx + sw * 0.54, sy + 9, sx + sw * 0.3, sy + 8.2, sx + sw * 0.16, sy + 9.4], hex(sc), hex(lineOf(sc)), 0.45);
  }
}

// ---------- ambient effects ----------
function ambient(k: Cx) {
  const { c, feats: f } = k, ph = k.P.amb, sx = (k.sh[0][0] + k.sh[1][0]) / 2;
  if (f.has('sparkle')) for (let i = 0; i < 6; i++) {
    const tw = (Math.sin((ph + i / 6) * TAU) + 1) / 2, x = CX + (jitter(i, 1) - 0.5) * 36, y = 18 + jitter(i, 2) * 52 - ph * 2;
    glow(c, x, y, 3 + tw * 2, 0xfff4c0, 0.4 * tw); const r = 0.9 + tw * 1.4; poly(c, [x, y - r * 1.6, x + r * 0.35, y - r * 0.35, x + r * 1.6, y, x + r * 0.35, y + r * 0.35, x, y + r * 1.6, x - r * 0.35, y + r * 0.35, x - r * 1.6, y, x - r * 0.35, y - r * 0.35], rgba(0xfffbe0, 0.4 + tw * 0.6), undefined);
  }
  if (f.has('embers')) for (let i = 0; i < 7; i++) {
    const t = (ph + i / 7) % 1, x = sx + (jitter(i, 4) - 0.5) * 26 + Math.sin(t * 6 + i) * 1.5, y = k.shY + 4 - t * 34;
    ell(c, x, y, 0.5 + (1 - t) * 0.8, 0.5 + (1 - t) * 0.8, rgba(i % 2 ? 0xffc040 : 0xff6a1a, 1 - t));
  }
  if (f.has('steam')) for (let i = 0; i < 3; i++) { const t = (ph + i / 3) % 1, x = k.sh[1][0] + 3 + t * 2, y = k.shY - 1 - t * 14; ell(c, x, y, 1.2 + t * 2.2, 1 + t * 1.8, rgba(0xe8eaf0, 0.55 * (1 - t))); }
  if (f.has('dust') || f.has('crumble')) for (let i = 0; i < 6; i++) { const t = (ph + i / 6) % 1, x = CX + (jitter(i, 8) - 0.5) * 22 + t * 4, y = k.hipY + 8 + t * 14; ell(c, x, y, 0.45, 0.45, rgba(0xd8bc80, 0.9 * (1 - t))); }
  if (f.has('songnotes')) for (let i = 0; i < 2; i++) { const t = (ph + i * 0.5) % 1, x = CX + 14 + Math.sin(t * 5 + i) * 3, y = k.headY - 6 - t * 14; c.globalAlpha = 1 - t; ell(c, x, y, 1.3, 0.9, '#7ad0f0', undefined, 0, -0.4); stroke(c, '#7ad0f0', 0.5, x + 1.1, y, x + 1.1, y - 4.5); c.globalAlpha = 1; }
  if (f.has('droplets') || f.has('wet')) for (let i = 0; i < 4; i++) { const t = (ph + i / 4) % 1, x = CX + (jitter(i, 6) - 0.5) * 24, y = k.shY + t * 26; c.globalAlpha = 0.8 * (1 - t * 0.6); poly(c, [x, y - 1.8, x + 0.9, y, x, y + 0.7, x - 0.9, y], '#bfe8ff', undefined); c.globalAlpha = 1; }
  if (f.has('smoke')) for (let i = 0; i < 2; i++) { const t = (ph + i * 0.5) % 1; ell(c, k.headX + 5 + t * 3, k.headY + k.headH * 0.5 - t * 9, 1 + t * 2, 0.9 + t * 1.6, rgba(0x9a9aa4, 0.5 * (1 - t))); }
  if (f.has('lavaglow')) glow(c, CX, FOOT - 2, 18, 0xe0662a, 0.22 + 0.06 * Math.sin(ph * TAU));
  if (f.has('biolum')) for (let i = 0; i < 6; i++) { const x = CX + (jitter(i, 31) - 0.5) * 18, y = k.shY + jitter(i, 32) * 26; glow(c, x, y, 3, 0x6af0ff, 0.5 * (0.6 + 0.4 * Math.sin((ph + i / 6) * TAU))); ell(c, x, y, 0.5, 0.5, '#d8ffff'); }
  if (f.has('frost')) for (let i = 0; i < 4; i++) ell(c, k.headX + (jitter(i, 41) - 0.5) * k.headW * 2, k.headY + k.headH * (0.7 + jitter(i, 42) * 0.8), 0.45, 0.45, 'rgba(240,250,255,0.9)');
  if (f.has('noshadow')) { c.save(); c.globalCompositeOperation = 'destination-out'; c.restore(); }
}

// ---------- the whole figure ----------
function shadow(k: Cx) {
  const { c } = k, w = (13 + (k.theme.scale - 1) * 10) * Math.min(1.3, k.sz + 0.2) * (k.theme.wide > 1.2 ? 1.2 : 1) * (1 - k.P.hover * 0.04), y = FOOT + 0.4;
  if (k.feats.has('noshadow')) return;
  c.fillStyle = rad(c, CX, y, w, [0, 'rgba(20,10,40,0.38)'], [0.6, 'rgba(20,10,40,0.2)'], [1, 'rgba(20,10,40,0)']);
  c.save(); c.translate(CX, y); c.scale(1, 0.26); c.translate(-CX, -y); c.fillRect(CX - w, y - w, w * 2, w * 2); c.restore();
}

/** the head group (hair, hat, face, horns) is drawn in design units around the head centre, then shrunk to a realistic size */
function onHead(k: Cx, draw: () => void) {
  const { c, headX: hx, headY: hy, hf } = k;
  c.save(); c.translate(hx, hy); c.scale(hf, hf); c.translate(-hx, -hy);
  draw();
  c.restore();
}

/** the neck: a column of skin from the shoulders up under the jaw */
function neck(k: Cx) {
  const { c, shY } = k, sx = (k.sh[0][0] + k.sh[1][0]) / 2, w = (k.stage === 'child' || k.stage === 'infant' ? 2.3 : 2.9) * k.sz ** 0.6 * (k.L.fem ? 0.9 : 1) * (k.feats.has('gaunt') ? 0.8 : 1);
  const hx = k.headX, top = k.headY + k.headH * k.hf * 0.8;
  if (k.theme.id === 'soulmachine') { c.strokeStyle = '#5a6074'; c.lineWidth = 1; for (let i = 0; i < 3; i++) stroke(c, '#7a8294', 1.1, hx - w, top + i * 1.4, hx + w, top + i * 1.4); }
  c.beginPath(); c.moveTo(hx - w, top - 2); c.lineTo(sx - w * 1.15, shY + 1.5); c.lineTo(sx + w * 1.15, shY + 1.5); c.lineTo(hx + w, top - 2); c.closePath();
  c.fillStyle = lin(c, hx - w, 0, hx + w, 0, [0, hex(k.skin)], [1, hex(shade(k.skin, 0.7))]); c.fill(); c.strokeStyle = hex(lineOf(k.skin)); c.lineWidth = 0.6; c.stroke();
  ell(c, hx, top + 1.6, w * 0.95, 1.5, rgba(0x120a1e, 0.28)); // the jaw's shadow on the neck
}

/** a newborn's head, facing the viewer: a big round skull, a high forehead, a small face low in it, full cheeks, a button nose and a tiny chin */
function babyHead(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh, P } = k, skin = lite(k.skin, 0.05);
  const warm = mix(skin, 0xe0907a, 0.35);
  c.beginPath(); c.moveTo(hx - hw * 1.02, hy + hh * 0.12);
  c.bezierCurveTo(hx - hw * 1.1, hy - hh * 0.75, hx - hw * 0.65, hy - hh * 1.12, hx, hy - hh * 1.12);
  c.bezierCurveTo(hx + hw * 0.65, hy - hh * 1.12, hx + hw * 1.1, hy - hh * 0.75, hx + hw * 1.02, hy + hh * 0.12);
  c.bezierCurveTo(hx + hw * 1.04, hy + hh * 0.62, hx + hw * 0.62, hy + hh * 0.98, hx, hy + hh * 0.98); // full cheeks, then a small round chin
  c.bezierCurveTo(hx - hw * 0.62, hy + hh * 0.98, hx - hw * 1.04, hy + hh * 0.62, hx - hw * 1.02, hy + hh * 0.12); c.closePath();
  c.fillStyle = rad(c, hx - hw * 0.3, hy - hh * 0.5, hw * 1.9, [0, hex(lite(skin, 0.14))], [0.55, hex(skin)], [1, hex(shade(skin, 0.8))]); c.fill();
  c.save(); c.clip();
  ell(c, hx, hy - hh * 0.62, hw * 0.55, hh * 0.28, rgba(0xffffff, 0.14)); // the round forehead catches the light
  for (const sd of [-1, 1]) { ell(c, hx + sd * hw * 0.62, hy + hh * 0.5, hw * 0.34, hh * 0.3, rgba(warm, 0.22)); ell(c, hx + sd * hw * 0.55, hy + hh * 0.42, hw * 0.16, hh * 0.12, rgba(0xffffff, 0.12)); } // cheeks
  c.fillStyle = lin(c, hx, 0, hx + hw, 0, [0, 'rgba(0,0,0,0)'], [1, 'rgba(60,20,40,0.16)']); c.fillRect(hx, hy - hh * 1.2, hw * 1.2, hh * 2.4);
  c.restore();
  c.beginPath(); c.moveTo(hx - hw * 1.02, hy + hh * 0.12);
  c.bezierCurveTo(hx - hw * 1.1, hy - hh * 0.75, hx - hw * 0.65, hy - hh * 1.12, hx, hy - hh * 1.12);
  c.bezierCurveTo(hx + hw * 0.65, hy - hh * 1.12, hx + hw * 1.1, hy - hh * 0.75, hx + hw * 1.02, hy + hh * 0.12);
  c.bezierCurveTo(hx + hw * 1.04, hy + hh * 0.62, hx + hw * 0.62, hy + hh * 0.98, hx, hy + hh * 0.98);
  c.bezierCurveTo(hx - hw * 0.62, hy + hh * 0.98, hx - hw * 1.04, hy + hh * 0.62, hx - hw * 1.02, hy + hh * 0.12); c.closePath();
  c.strokeStyle = hex(lineOf(skin)); c.lineWidth = 0.7; c.lineJoin = 'round'; c.stroke();
  // the face sits in the lower half: eyes below the middle and wide apart
  const ey = hy + hh * 0.2, ex = hw * 0.4, ew = hw * 0.16, eh = ew * 0.7;
  for (const sd of [-1, 1]) {
    const x = hx + sd * ex;
    if (P.eyes === 'closed') { curve(c, hex(INK), 0.9, x - ew, ey, x, ey + eh * 0.9, x + ew, ey); continue; }
    ell(c, x, ey, ew, eh, '#ece6e0', hex(INK), 0.45);
    c.save(); c.beginPath(); c.ellipse(x, ey, ew, eh, 0, 0, TAU); c.clip();
    ell(c, x, ey, eh * 1.05, eh * 1.05, rad(c, x, ey, eh * 1.1, [0, hex(lite(k.L.eye, 0.15))], [1, hex(shade(k.L.eye, 0.35))])); ell(c, x, ey, eh * 0.5, eh * 0.5, hex(INK));
    ell(c, x - eh * 0.35, ey - eh * 0.35, eh * 0.22, eh * 0.22, 'rgba(255,255,255,0.9)');
    c.restore();
    curve(c, hex(shade(skin, 0.3)), 0.6, x - ew * 1.05, ey - eh * 0.2, x, ey - eh * 1.5, x + ew * 1.05, ey - eh * 0.2); // the upper lid
    curve(c, rgba(shade(skin, 0.6), 0.25), 0.4, x - ew, ey - eh * 2.2, x, ey - eh * 2.9, x + ew, ey - eh * 2.2); // a faint brow, barely there
  }
  ell(c, hx, hy + hh * 0.52, hw * 0.12, hh * 0.09, rgba(lite(skin, 0.35), 0.9)); // the button nose
  for (const sd of [-1, 1]) ell(c, hx + sd * hw * 0.07, hy + hh * 0.57, 0.3, 0.2, rgba(shade(skin, 0.3), 0.6));
  const mc = mix(skin, 0xb0505a, 0.5);
  if (P.mouth === 'open' || P.mouth === 'sing') ell(c, hx, hy + hh * 0.78, hw * 0.12, hh * 0.08, '#4a1a22');
  else { ell(c, hx, hy + hh * 0.78, hw * 0.13, hh * 0.05, rgba(mc, 0.85)); curve(c, rgba(shade(mc, 0.5), 0.8), 0.4, hx - hw * 0.14, hy + hh * 0.77, hx, hy + hh * 0.8, hx + hw * 0.14, hy + hh * 0.77); }
  // sparse, fine hair
  if (k.L.hairStyle !== 3 && !k.theme.hairless) for (let i = 0; i < 6; i++) curve(c, rgba(k.hair, 0.7), 0.45, hx - hw * 0.5 + i * hw * 0.2, hy - hh * 1.0, hx - hw * 0.4 + i * hw * 0.2 + (i % 2 ? 1 : -1), hy - hh * 1.2, hx - hw * 0.25 + i * hw * 0.18, hy - hh * 0.92);
}

function infant(k: Cx) {
  const { c, L } = k, cradle = k.feats.has('cradle'), wood = 0x8a5a3a;
  // a baby lies swaddled with its head on a small pillow, propped a little; in a cradle it lies inside the wooden basin
  const cx = CX + k.P.sway * 0.4, gy = FOOT, lift = cradle ? 4 : 0, bx = cx + 2, rise = k.P.breath * 0.7;
  const cloth = L.cloth, band = L.cloth2;
  if (cradle) { // the rockers and the hood behind the head
    curve(c, hex(shade(wood, 0.6)), 1.8, cx - 17, gy - 0.5, cx, gy + 5, cx + 17, gy - 0.5);
    c.beginPath(); c.moveTo(cx - 18, gy - 16); c.quadraticCurveTo(cx - 18, gy - 31, cx - 6, gy - 31); c.lineTo(cx - 4, gy - 8); c.lineTo(cx - 18, gy - 4); c.closePath();
    c.fillStyle = lin(c, cx - 18, 0, cx - 4, 0, [0, hex(lite(wood, 0.1))], [1, hex(shade(wood, 0.7))]); c.fill(); c.strokeStyle = hex(lineOf(wood)); c.lineWidth = 0.8; c.stroke();
    ell(c, cx - 11, gy - 17, 6, 8, rgba(0x120a1e, 0.25));
  }
  // pillow
  ell(c, bx - 8, gy - 4.5 - lift, 9.5, 3.4, lin(c, 0, gy - 9, 0, gy - 2, [0, hex(lite(band, 0.35))], [1, hex(shade(band, 0.8))]), hex(lineOf(band)), 0.6);
  // the swaddled body: a long soft bundle, bound with bands
  const x0 = bx - 4, x1 = bx + 17, y0 = gy - 13 - lift - rise, y1 = gy - 2 - lift;
  c.beginPath(); c.moveTo(x0, y1); c.quadraticCurveTo(x0 - 2, y0 + 3, x0 + 4, y0 + 0.5); c.quadraticCurveTo((x0 + x1) / 2, y0 - 2.4, x1 - 3, y0 + 2); c.quadraticCurveTo(x1 + 2, y0 + 5, x1, y1); c.closePath();
  c.fillStyle = lin(c, 0, y0 - 2, 0, y1, [0, hex(lite(cloth, 0.28))], [0.5, hex(cloth)], [1, hex(shade(cloth, 0.6))]); c.fill(); c.strokeStyle = hex(lineOf(cloth)); c.lineWidth = 0.8; c.lineJoin = 'round'; c.stroke();
  for (let i = 0; i < 3; i++) curve(c, rgba(shade(cloth, 0.45), 0.55), 0.55, x0 + 3 + i * 4.6, y0 + 1 + i * 0.2, x0 + 5 + i * 4.6, (y0 + y1) / 2 + 1, x0 + 2.6 + i * 4.6, y1 - 0.4);
  curve(c, rgba(lite(cloth, 0.5), 0.5), 0.5, x0 + 3, y0 + 2.2, (x0 + x1) / 2, y0 - 0.4, x1 - 3, y0 + 3);
  for (const t of [0.38, 0.72]) { const x = x0 + (x1 - x0) * t; poly(c, [x - 1.1, y0 - 0.6 + Math.sin(t * 4) * 0.4, x + 1.1, y0 + 0.2, x + 1.7, y1, x - 0.7, y1], hex(band), hex(lineOf(band)), 0.4); }
  // a small fist out of the wrap
  ell(c, bx - 1, y0 + 2.2, 2.2, 1.9, hex(k.skin), hex(lineOf(k.skin)), 0.5); stroke(c, rgba(shade(k.skin, 0.4), 0.5), 0.3, bx - 1.6, y0 + 1.5, bx - 0.4, y0 + 3);
  // the head: turned to face us, resting on the pillow
  k.hf = 0.56;
  k.headX = bx - 7; k.headY = gy - 11.5 - lift + k.P.nod * 0.4 - rise * 0.6;
  c.save(); c.translate(k.headX, k.headY); c.rotate(0.04); c.translate(-k.headX, -k.headY);
  onHead(k, () => { headBack(k); ears(k); babyHead(k); headTop(k); });
  c.restore();
  if (cradle) { // the front board of the cradle hides the lower half of the bundle
    poly(c, [cx - 17, gy - 9, cx + 17, gy - 9, cx + 13, gy - 1, cx - 13, gy - 1], lin(c, 0, gy - 9, 0, gy, [0, hex(lite(wood, 0.15))], [1, hex(shade(wood, 0.75))]), hex(lineOf(wood)), 0.8);
    for (let i = 1; i < 3; i++) stroke(c, rgba(shade(wood, 0.5), 0.5), 0.4, cx - 16 + i * 0.5, gy - 9 + i * 2.7, cx + 16 - i * 0.5, gy - 9 + i * 2.7);
  }
}

/** where the head sits in an idle frame, for cropping busts */
export function headCentre(L: Look): { x: number; y: number; r: number } {
  const k = makeCx(document.createElement('canvas').getContext('2d')!, L, POSE.idle);
  if (k.stage === 'infant') return { x: CX + (-8 + (k.feats.has('cradle') ? 0 : 0)) * 1.2 + 0, y: FOOT - (12.5 + (k.feats.has('cradle') ? 4 : 0)) * 1.2, r: 9.6 * 0.6 * 1.2 };
  return { x: k.headX, y: k.headY, r: k.headH * k.hf };
}

export function paintFrame(c: CanvasRenderingContext2D, L: Look, frame: number, view: View = 'front') {
  const k = makeCx(c, L, frame, view);
  c.lineJoin = 'round'; c.lineCap = 'round';
  shadow(k);
  if (k.stage === 'infant' && k.theme.lower !== 'blob') { c.save(); c.translate(CX, FOOT); c.scale(1.2, 1.2); c.translate(-CX, -FOOT); infant(k); c.restore(); ambient(k); return; }
  const fit = fitOf(k);
  const lower = k.theme.lower === 'legs' || k.feats.has('legs') ? 'legs' : k.theme.lower;
  if (lower === 'blob') {
    slimeBody(k);
    ambient(k);
    return;
  }
  const back = k.view === 'back', prof = k.view === 'side';
  if (!back) wingsBack(k);
  if (prof) { c.save(); c.translate(CX * 2, 0); c.scale(-1, 1); tailBack(k); c.restore(); } else if (!back) tailBack(k);
  if (lower === 'serpent') serpentBody(k);
  else if (lower === 'gown') gownBody(k);
  else legs(k, fit);
  if (lower === 'legs') skirt(k, fit);
  if (prof) arms(k, fit, 'far'); // the far arm is behind the body
  neck(k);
  torso(k, fit);
  bodyOverlay(k);
  if (back) { wingsBack(k); tailBack(k); } // from behind the wings and the tail lie over the back
  carried(k, fit);
  arms(k, fit, prof ? 'near' : 'both');
  if (k.P.bundle) { // a bundle of cloth and bread held at the chest
    const sx = (k.sh[0][0] + k.sh[1][0]) / 2, y = k.shY + k.torsoLen * 0.38;
    ell(c, sx + (prof ? 3 : 0), y + 1, k.sw * (prof ? 1.6 : 0.95), 4.2, lin(c, 0, y - 3, 0, y + 5, [0, '#f6eedc'], [1, '#d4c4a0']), '#8a7a5a', 0.6); ell(c, sx + 2 + (prof ? 3 : 0), y - 2, 2.4, 2, '#e8b870', '#8a5a1a', 0.5); stroke(c, '#8a7a5a', 0.5, sx - k.sw * 0.7, y + 1.4, sx + k.sw * 0.7, y + 1.4);
    for (const i of [0, 1]) hand(k, k.hand[i], i ? 1 : -1, false, k.sh[i]);
  }
  // the head and everything on it
  onHead(k, () => {
    nagaHood(k);
    if (back) {
      hatBack(k); headBack(k); ears(k);
      backOfHead(k);
      hairBack(k);
      if (!['hood', 'cowl'].includes(k.L.hat)) hatFront(k);
      headTop(k);
      return;
    }
    hatBack(k); hairBack(k); headBack(k); ears(k);
    drawHead(k);
    drawFace(k);
    beard(k);
    hairFront(k);
    hatFront(k);
    headTop(k);
  });
  // what is held
  const tm = k.P.tool;
  if (k.L.tool && tm !== 'none') { const hd = k.hand[1]; drawTool(k, hd[0], hd[1], tm === 'rest' && k.P.legs !== 'stand' ? 'hold' : tm); }
  else if (k.stage === 'elder' && !k.L.tool && k.P.legs === 'stand' && tm === 'rest' && !k.P.bundle && k.frame < 10) { const hd = k.hand[0]; drawTool(k, hd[0], hd[1], 'rest', 'cane'); }
  ambient(k);
  void FW; void FH; void POSE;
}
