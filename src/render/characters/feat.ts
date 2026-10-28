// Race features that are not clothes: wings, tails, horns, ears, serpent and gown bodies, the slime body, glows and small ambient effects.
import { type Cx, FOOT, CX, ell, poly, rrect, stroke, curve, lin, rad, glow, hex, rgba, mix, shade, lite, lineOf, jitter, ik, INK } from './kit';

const TAU = Math.PI * 2;
const ph = (k: Cx, o = 0) => Math.sin((k.P.amb + o) * TAU);

// ---------- wings ----------
export function wingsBack(k: Cx) {
  const f = k.feats;
  if (f.has('wings:feather')) for (const sd of [-1, 1]) featherWing(k, sd);
  if (f.has('wings:bat') || f.has('wings:scale')) for (const sd of [-1, 1]) membraneWing(k, sd, f.has('wings:scale'));
  if (f.has('wings:insect')) for (const sd of [-1, 1]) insectWing(k, sd);
  if (f.has('wings:stub')) for (const sd of [-1, 1]) { const x = CX + sd * (k.sw * 0.7) + k.P.sway, y = k.shY + 3; ell(k.c, x + sd * 3, y - 3, 3.2, 6.5, hex(lite(k.accent, 0.1)), hex(lineOf(k.accent)), 0.7, sd * 0.5); }
}

function featherWing(k: Cx, sd: number) {
  const { c } = k, flap = k.P.flap, sz = Math.max(0.5, k.sz);
  const bx = k.sh[0][0] * 0.5 + k.sh[1][0] * 0.5 + sd * k.sw * 0.78, by = k.shY + 4 * sz;
  const a0 = 0.42 + flap * 0.85, spread = 0.62 + flap * 0.5;
  const base = k.L.race === 'winged' && k.L.line === 'night' ? 0x4a3a6a : lite(k.accent, k.accent === 0xffffff ? 0 : 0.55);
  const rows = [{ n: 7, len: 30, w: 3.6, col: base, shadeF: 0.9 }, { n: 6, len: 20, w: 3.2, col: lite(base, 0.22), shadeF: 0.95 }, { n: 5, len: 11, w: 2.8, col: lite(base, 0.42), shadeF: 1 }];
  for (const row of rows) for (let i = row.n - 1; i >= 0; i--) {
    const u = i / (row.n - 1), ang = a0 + (u - 0.5) * spread + (row === rows[0] ? 0.15 : 0.05);
    const len = row.len * sz * (0.72 + 0.28 * Math.sin(u * Math.PI * 0.9 + 0.5)) * (0.78 + 0.22 * flap);
    // angle 0 points up; positive turns outward (sd) and downward as it grows
    const dx = Math.sin(ang) * sd, dy = -Math.cos(ang);
    const tx = bx + dx * len, ty = by + dy * len, nx = -dy * sd, ny = dx * sd;
    c.beginPath(); c.moveTo(bx, by);
    c.quadraticCurveTo(bx + dx * len * 0.5 + nx * row.w * sz * 0.9, by + dy * len * 0.5 + ny * row.w * sz * 0.9, tx, ty);
    c.quadraticCurveTo(bx + dx * len * 0.5 - nx * row.w * sz * 0.9, by + dy * len * 0.5 - ny * row.w * sz * 0.9, bx, by);
    c.fillStyle = lin(c, bx, by, tx, ty, [0, hex(shade(row.col, row.shadeF))], [1, hex(lite(row.col, 0.3))]); c.fill();
    c.strokeStyle = hex(shade(row.col, 0.55)); c.lineWidth = 0.5; c.stroke();
    stroke(c, rgba(0xffffff, 0.35), 0.3, bx + dx * len * 0.15, by + dy * len * 0.15, bx + dx * len * 0.8, by + dy * len * 0.8);
  }
}

function membraneWing(k: Cx, sd: number, scaled: boolean) {
  const { c } = k, flap = k.P.flap, sz = Math.max(0.5, k.sz);
  const bx = (k.sh[0][0] + k.sh[1][0]) / 2 + sd * k.sw * 0.55, by = k.shY + 3 * sz;
  const col = scaled ? mix(k.accent, 0xc03a2a, 0.5) : mix(k.accent, 0x2a1a3a, 0.4);
  const wx = bx + sd * (7 + 13 * flap) * sz, wy = by - (11 + 6 * flap) * sz;
  const tips: [number, number][] = [[wx + sd * (4 + 8 * flap) * sz, wy - (3 - 5 * flap) * sz], [wx + sd * (6 + 8 * flap) * sz, wy + (6 + 3 * flap) * sz], [wx + sd * (2 + 5 * flap) * sz, wy + (14 + 2 * flap) * sz]];
  c.beginPath(); c.moveTo(bx, by);
  c.lineTo(wx, wy); c.lineTo(tips[0][0], tips[0][1]);
  c.quadraticCurveTo((tips[0][0] + tips[1][0]) / 2 - sd * 3, (tips[0][1] + tips[1][1]) / 2 + 2, tips[1][0], tips[1][1]);
  c.quadraticCurveTo((tips[1][0] + tips[2][0]) / 2 - sd * 3, (tips[1][1] + tips[2][1]) / 2 + 2, tips[2][0], tips[2][1]);
  c.quadraticCurveTo((tips[2][0] + bx) / 2, (tips[2][1] + by) / 2 + 3, bx, by + 6 * sz);
  c.closePath();
  c.fillStyle = lin(c, bx, by, wx, wy, [0, hex(shade(col, 0.7))], [1, hex(lite(col, 0.15))]); c.fill();
  c.strokeStyle = hex(shade(col, 0.4)); c.lineWidth = 0.7; c.lineJoin = 'round'; c.stroke();
  for (const t of tips) stroke(c, hex(shade(col, 0.45)), 0.7, wx, wy, t[0], t[1]);
  stroke(c, hex(shade(col, 0.45)), 0.9, bx, by, wx, wy);
  if (scaled) for (let i = 0; i < 6; i++) ell(c, bx + sd * (4 + i * 2.2), by - 3 - i * 1.2 + (i % 2) * 2, 1.1, 0.8, rgba(lite(col, 0.3), 0.5));
}

function insectWing(k: Cx, sd: number) {
  const { c } = k, flap = k.P.flap, sz = k.sz;
  const bx = (k.sh[0][0] + k.sh[1][0]) / 2 + sd * 2, by = k.shY + 3 * sz;
  const open = 0.55 + flap * 0.45, a = k.accent;
  for (const [len, wid, rot, dy, alpha] of [[30, 8.5, -0.95, 0, 0.66], [21, 6, -0.15, 4, 0.58]] as [number, number, number, number, number][]) {
    c.save(); c.translate(bx, by + dy * sz); c.rotate(sd * (-rot * open - 0.2)); c.scale(sd, 1);
    c.beginPath(); c.ellipse(len * 0.5 * sz, 0, len * 0.5 * sz, wid * sz, 0, 0, TAU);
    c.fillStyle = lin(c, 0, -wid * sz, len * sz, wid * sz, [0, rgba(0xffffff, Math.min(1, alpha + 0.25))], [0.5, rgba(lite(a, 0.2), alpha)], [1, rgba(0xb0a0ff, alpha)]); c.fill();
    c.strokeStyle = rgba(lite(a, 0.2), 0.95); c.lineWidth = 0.5; c.stroke();
    stroke(c, rgba(0xffffff, 0.55), 0.3, 1, 0, len * sz * 0.9, 0); stroke(c, rgba(0xffffff, 0.4), 0.25, len * 0.3 * sz, 0, len * 0.7 * sz, -wid * 0.6 * sz); stroke(c, rgba(0xffffff, 0.4), 0.25, len * 0.3 * sz, 0, len * 0.7 * sz, wid * 0.6 * sz);
    c.restore();
  }
}

// ---------- tails ----------
export function tailBack(k: Cx) {
  const { c, feats: f } = k;
  if (f.has('legs') && k.theme.lower === 'serpent') return;
  const kind = f.has('tail:lizard') ? 'lizard' : f.has('tail:spade') ? 'spade' : f.has('tail:long') ? 'long' : f.has('tail:fluffy') || f.has('tail:short') ? 'fluffy' : '';
  if (!kind) return;
  const sz = k.sz, sw = ph(k) * (k.frame >= 2 && k.frame <= 9 ? 2.2 : 1.6);
  const hx = CX + k.P.sway * 0.4 + 2.5 * sz, hy = k.hipY + 3 * sz, gy = FOOT - k.P.hover - 1;
  const P: [number, number][] = kind === 'long'
    ? [[hx, hy], [hx + 9 * sz, hy + 3 * sz], [hx + 12 * sz + sw, hy - 6 * sz], [hx + 7 * sz + sw * 1.5, hy - 14 * sz]]
    : kind === 'fluffy' ? [[hx, hy], [hx + 8 * sz, hy + 1], [hx + 12 * sz + sw, hy - 5 * sz], [hx + 9 * sz + sw * 1.4, hy - 11 * sz]]
      : [[hx, hy], [hx + 11 * sz, hy + 4 * sz], [hx + 14 * sz + sw, gy - 12 * sz], [hx + 8 * sz + sw * 1.3, gy - 1]];
  const at = (t: number): [number, number] => {
    const u = 1 - t;
    return [u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0], u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1]];
  };
  const col = kind === 'fluffy' || kind === 'long' ? k.skin : shade(k.skin, 0.88);
  const base = kind === 'fluffy' ? 6.5 : kind === 'long' ? 2.6 : 4.2;
  const N = 14;
  for (const pass of [0, 1]) {
    for (let i = 0; i < N; i++) {
      const t = i / N, [x0, y0] = at(t), [x1, y1] = at(t + 1 / N);
      const w = kind === 'fluffy' ? base * (0.5 + 0.55 * Math.sin(Math.min(1, t * 1.15 + 0.15) * Math.PI * 0.85)) * sz : base * (1 - t * 0.82) * sz;
      stroke(c, pass === 0 ? hex(lineOf(col)) : hex(i % 2 && kind !== 'fluffy' ? shade(col, 0.95) : col), pass === 0 ? w + 1.1 : w, x0, y0, x1, y1);
    }
  }
  if (kind === 'fluffy') { const [ex, ey] = at(1); ell(c, ex, ey, 2.8 * sz, 2.8 * sz, hex(lite(col, 0.55)), hex(lineOf(col)), 0.5); }
  if (kind === 'lizard') for (let i = 1; i < N - 2; i += 2) { const [x, y] = at(i / N); poly(c, [x - 1.1, y - 0.5, x + 0.2, y - 2.8 * (1 - i / N) - 0.6, x + 1.1, y - 0.5], hex(k.accent), hex(lineOf(k.accent)), 0.35); }
  if (kind === 'spade') { const [ex, ey] = at(1), [px, py] = at(0.93); const a = Math.atan2(ey - py, ex - px); c.save(); c.translate(ex, ey); c.rotate(a); poly(c, [0, 0, 1, -3, 4.4, 0, 1, 3], hex(shade(k.skin, 0.8)), hex(lineOf(k.skin)), 0.5); c.restore(); }
  if (kind === 'long') { for (let i = 3; i < N; i += 3) { const [x, y] = at(i / N); ell(c, x, y, 1.3, 0.9, hex(shade(k.skin, 0.55))); } }
}

// ---------- the body of a naga, a merfolk's gown and a slime ----------
export function serpentBody(k: Cx) {
  const { c } = k, sz = k.sz;
  const x0 = CX + k.P.sway * 0.4, y0 = k.hipY - 1, gy = FOOT - 1;
  const moving = k.frame >= 2 && k.frame <= 9 ? 1.6 : 0.8;
  const sw = ph(k) * moving, col = k.skin, belly = lite(k.skin, 0.4);
  // the body runs from the hips down into a coil on the ground, a curl of the tail tip at the far side
  const pts: [number, number, number][] = [];
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let x: number, y: number;
    if (t < 0.45) { const u = t / 0.45; x = x0 + Math.sin(u * Math.PI) * 2.6 * sw * 0.5 - u * 3 * sz; y = y0 + u * (gy - 7 * sz - y0); }
    else { const u = (t - 0.45) / 0.55; const a = Math.PI * 0.9 - u * Math.PI * 1.9; x = x0 - 3 * sz + 4 * sz + Math.cos(a) * (14 - u * 5) * sz + sw * u; y = gy - 6 * sz + Math.sin(a) * (4.2 - u * 1.2) * sz; }
    pts.push([x, y, (9.2 * (1 - t * 0.78) + 1.1) * sz * (k.stage === 'child' ? 0.85 : 1)]);
  }
  for (const pass of [0, 1, 2]) {
    for (let i = 0; i < N; i++) {
      const [x, y, w] = pts[i], [x1, y1] = pts[i + 1];
      if (pass === 0) stroke(c, hex(lineOf(col)), w + 1.2, x, y, x1, y1);
      else if (pass === 1) stroke(c, hex(i % 4 < 2 ? col : shade(col, 0.9)), w, x, y, x1, y1);
      else if (i > 1) { stroke(c, hex(belly), w * 0.38, x + 0.5, y, x1 + 0.5, y1); }
    }
  }
  // scale scallops along the length
  for (let i = 2; i < N - 1; i += 2) { const [x, y, w] = pts[i]; c.beginPath(); c.arc(x - w * 0.2, y, w * 0.28, 0.2, Math.PI - 0.2); c.strokeStyle = rgba(shade(col, 0.55), 0.55); c.lineWidth = 0.4; c.stroke(); }
  for (let i = 5; i < N - 3; i += 6) { const [x, y, w] = pts[i]; stroke(c, rgba(k.accent, 0.8), 0.7, x - w * 0.5, y, x + w * 0.3, y + 0.5); }
}

export function gownBody(k: Cx) {
  const { c } = k, sz = k.sz;
  const cx = CX + k.P.sway * 0.4, y0 = k.hipY - 1, y1 = FOOT - k.P.hover - 1, w0 = k.ww + 0.8, w1 = (k.ww + 6.5) * (k.stage === 'child' ? 0.85 : 1);
  const swish = ph(k) * 1.4;
  const base = mix(k.accent, k.L.cloth, 0.35);
  c.beginPath(); c.moveTo(cx - w0, y0);
  c.bezierCurveTo(cx - w0 - 1, y0 + (y1 - y0) * 0.5, cx - w1 - 1 + swish, y1 - 6, cx - w1 + swish, y1);
  for (let i = 0; i <= 6; i++) { const t = i / 6; c.lineTo(cx - w1 + swish + t * (w1 * 2), y1 + (i % 2 ? -1.8 : 0.5) * sz + (i % 2 ? 0 : 1)); }
  c.bezierCurveTo(cx + w1 + 1 + swish, y1 - 6, cx + w0 + 1, y0 + (y1 - y0) * 0.5, cx + w0, y0);
  c.closePath();
  c.fillStyle = lin(c, cx - w1, 0, cx + w1, 0, [0, rgba(lite(base, 0.25), 0.95)], [0.5, rgba(base, 0.88)], [1, rgba(shade(base, 0.7), 0.95)]); c.fill();
  c.strokeStyle = hex(lineOf(base)); c.lineWidth = 0.7; c.stroke();
  for (let i = -3; i <= 3; i++) stroke(c, rgba(0xffffff, 0.22), 0.4, cx + i * w0 * 0.5, y0 + 4, cx + i * w1 * 0.55 + swish * 0.6, y1 - 1.5);
  // slippers that look like small fins
  for (const sd of [-1, 1]) poly(c, [cx + sd * 2, y1 - 1.5, cx + sd * 6 + swish, y1 + 0.5, cx + sd * 8 + swish, y1 - 1.2, cx + sd * 6, y1 + 1.4], hex(k.accent), hex(lineOf(k.accent)), 0.4);
}

export function slimeBody(k: Cx) {
  const { c, P } = k, sz = Math.max(0.55, k.sz);
  const squash = P.bob * 0.06 + (k.frame >= 2 && k.frame <= 9 ? Math.cos((k.frame - 2) / 8 * TAU * 2) * 0.1 : 0) + ph(k) * 0.025;
  const jump = (k.frame >= 2 && k.frame <= 9 ? -Math.abs(Math.sin((k.frame - 2) / 8 * TAU)) * 3.2 : 0) + (k.frame === 18 ? -5 : 0) + P.bob * 0.5 - P.hover;
  const w = 17 * sz * (1 + squash) * k.theme.wide * (k.stage === 'infant' ? 0.6 : 1), h = 21 * sz * (1 - squash * 1.3), x = CX + P.sway, yb = FOOT - 1 + jump * 0.2, yt = yb - h + jump;
  const col = k.skin;
  // body: a dome with a soft flat base and a wavy lip
  c.beginPath(); c.moveTo(x - w, yb);
  c.bezierCurveTo(x - w * 1.05, yb - h * 0.55, x - w * 0.55, yt, x, yt);
  c.bezierCurveTo(x + w * 0.55, yt, x + w * 1.05, yb - h * 0.55, x + w, yb);
  for (let i = 0; i <= 8; i++) { const t = i / 8; c.lineTo(x + w - t * 2 * w, yb + (i % 2 ? 1.2 : -0.4) + Math.sin(k.P.amb * TAU + i) * 0.4); }
  c.closePath();
  c.fillStyle = lin(c, 0, yt, 0, yb, [0, rgba(lite(col, 0.45), 0.92)], [0.55, rgba(col, 0.88)], [1, rgba(shade(col, 0.72), 0.95)]); c.fill();
  c.strokeStyle = hex(lineOf(col)); c.lineWidth = 0.9; c.lineJoin = 'round'; c.stroke();
  // things swallowed float inside, drawn dimmer than the gel in front of them
  if (k.feats.has('swallowed') && k.stage !== 'infant') {
    const items = [0xd9a030, 0xf0ead8, 0xf06aa0, 0x6aa84f, 0xc8c0d0];
    for (let i = 0; i < 4; i++) {
      const ix = x + (jitter(i, k.L.cloth) - 0.5) * w * 1.1 + ph(k, i * 0.2) * 0.5, iy = yb - h * (0.18 + jitter(i + 9, k.L.hair) * 0.3) + ph(k, i * 0.37) * 0.6;
      const it = items[(i + k.L.cloth2) % items.length];
      if (i === 0) ell(c, ix, iy, 1.6, 1.6, rgba(it, 0.7), rgba(shade(it, 0.5), 0.5), 0.3);
      else if (i === 1) { c.save(); c.translate(ix, iy); c.rotate(0.7); rrect(c, -2.2, -0.6, 4.4, 1.2, 0.6, rgba(it, 0.65)); ell(c, -2.2, 0, 0.9, 0.9, rgba(it, 0.65)); ell(c, 2.2, 0, 0.9, 0.9, rgba(it, 0.65)); c.restore(); }
      else ell(c, ix, iy, 1.1, 1.1, rgba(it, 0.6));
    }
    ell(c, x + w * 0.12, yb - h * 0.2, 1.8, 1.8, rgba(0xffffff, 0.15), rgba(0xffffff, 0.3), 0.3); // a core
  }
  // shine
  ell(c, x - w * 0.5, yt + h * 0.2, w * 0.17, h * 0.1, rgba(0xffffff, 0.7), undefined, 0, -0.6);
  ell(c, x - w * 0.62, yt + h * 0.42, 0.9, 0.9, rgba(0xffffff, 0.55));
  // small arms of gel that follow the hands
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1, ax = x + sd * w * 0.85, ay = yb - h * 0.38, hx = ax + sd * 3.6 + k.P[i ? 'rh' : 'lh'][0] * sd * 0.5, hy = ay + 2.2 + k.P[i ? 'rh' : 'lh'][1] * 0.75;
    stroke(c, hex(lineOf(col)), 4.2 * sz + 0.9, ax, ay, hx, hy); stroke(c, rgba(lite(col, 0.1), 0.95), 4.2 * sz, ax, ay, hx, hy);
    ell(c, hx, hy, 2.3 * sz, 2.3 * sz, rgba(col, 0.95), hex(lineOf(col)), 0.7);
    k.hand[i] = [hx, hy];
  }
  k.headX = x; k.headY = yb - h * 0.5 + jump * 0.5;
  // the face sits on the body
  const ey = yb - h * 0.52 + jump * 0.5, es = k.stage === 'infant' ? 0.9 : 1.2;
  if (k.P.eyes === 'closed') { for (const sd of [-1, 1]) curve(c, hex(INK), 0.9, x + sd * w * 0.34 - 1.8, ey, x + sd * w * 0.34, ey + 1.2, x + sd * w * 0.34 + 1.8, ey); }
  else for (const sd of [-1, 1]) {
    const ex = x + sd * w * 0.34 + k.fx * 0.8;
    ell(c, ex, ey, 2.1 * es, 2.6 * es, hex(INK), undefined);
    ell(c, ex - 0.6, ey - 0.9 * es, 0.85, 0.85, '#ffffff'); ell(c, ex + 0.6, ey + 0.9 * es, 0.4, 0.4, rgba(0xffffff, 0.8));
  }
  const mo = k.P.mouth;
  if (mo === 'open' || mo === 'sing' || mo === 'oh') ell(c, x + k.fx * 0.8, ey + 5, 1.6, 1.8, hex(INK));
  else curve(c, hex(INK), 0.8, x - 1.8 + k.fx * 0.8, ey + 4.4, x + k.fx * 0.8, ey + 6.2, x + 1.8 + k.fx * 0.8, ey + 4.4);
  ell(c, x - w * 0.55, ey + 3.4, 1.6, 1, rgba(0xff8aa8, 0.55)); ell(c, x + w * 0.55, ey + 3.4, 1.6, 1, rgba(0xff8aa8, 0.55));
}

// ---------- things that sit on the head ----------
/** horns, antlers and tall ears: they grow from behind the head shape */
export function headBack(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh, feats: f, L } = k;
  const hornCol = k.L.race === 'dragonkin' ? mix(k.accent, 0xd9a030, 0.5) : k.L.race === 'demonkin' ? 0x3a2a34 : k.L.race === 'lavakin' ? 0x2a1a1a : 0xe8dcc0;
  const horn = (sd: number, style: number, scale = 1) => {
    const bx = hx + sd * hw * 0.62, by = hy - hh * 0.8;
    c.beginPath();
    if (style === 0) { c.moveTo(bx - sd * 1.6, by + 1); c.quadraticCurveTo(bx + sd * 3.5 * scale, by - 3 * scale, bx + sd * 3 * scale, by - 10 * scale); c.quadraticCurveTo(bx + sd * 1.2, by - 4, bx + sd * 1.6, by + 1); }
    else if (style === 1) { c.moveTo(bx - sd * 1.8, by + 1); c.bezierCurveTo(bx + sd * 6 * scale, by - 2, bx + sd * 9 * scale, by - 8 * scale, bx + sd * 5 * scale, by - 10 * scale); c.bezierCurveTo(bx + sd * 6, by - 6, bx + sd * 3, by - 3, bx + sd * 1.8, by + 1); }
    else { c.moveTo(bx - sd * 1.6, by + 1); c.quadraticCurveTo(bx - sd * 3 * scale, by - 5 * scale, bx - sd * 1 * scale, by - 11 * scale); c.quadraticCurveTo(bx + sd * 1, by - 5, bx + sd * 1.6, by + 1); }
    c.closePath(); c.fillStyle = lin(c, bx - 3, by, bx + 3, by - 10, [0, hex(shade(hornCol, 0.7))], [1, hex(lite(hornCol, 0.2))]); c.fill(); c.strokeStyle = hex(lineOf(hornCol)); c.lineWidth = 0.6; c.stroke();
    for (let i = 1; i < 3; i++) stroke(c, rgba(shade(hornCol, 0.5), 0.5), 0.3, bx + sd * (i * 0.6), by - i * 2.4, bx + sd * (i * 0.6 + 1.6), by - i * 2.4 + 0.3);
  };
  if (f.has('horns')) { const st = k.L.race === 'dragonkin' ? 2 : k.L.pattern % 2 ? 1 : 0; horn(-1, st); horn(1, st); }
  if (f.has('hornsSmall')) { horn(-1, 0, 0.55); horn(1, 0, 0.55); }
  if (f.has('antlers')) for (const sd of [-1, 1]) {
    const bx = hx + sd * hw * 0.5, by = hy - hh * 1.0; const col = hex(0xb89868), ln = hex(0x5a3a1e);
    for (const [w, pts] of [[1.4, [bx, by, bx + sd * 3, by - 7, bx + sd * 2, by - 14]], [1.0, [bx + sd * 2, by - 6, bx + sd * 6, by - 8, bx + sd * 8, by - 12]], [0.9, [bx + sd * 1.5, by - 10, bx + sd * 5, by - 13, bx + sd * 6, by - 17]]] as [number, number[]][]) {
      stroke(c, ln, w + 0.8, ...pts); stroke(c, col, w, ...pts);
    }
  }
  if (f.has('crest')) for (let i = 0; i < 5; i++) { const a = -0.5 + i * 0.25; poly(c, [hx + Math.sin(a) * hw * 0.2 - 1.2, hy - hh * 1.0, hx + Math.sin(a) * hw * 1.2, hy - hh * 1.0 - 7 - Math.cos(a * 2) * 2, hx + Math.sin(a) * hw * 0.2 + 1.2, hy - hh * 0.95], hex(i % 2 ? lite(k.accent, 0.1) : k.accent), hex(lineOf(k.accent)), 0.4); }
  if (f.has('antenna')) for (const sd of [-1, 1]) { const bx = hx + sd * hw * 0.35, by = hy - hh * 1.15; curve(c, hex(lineOf(k.skin)), 0.5, bx, by, bx + sd * 3, by - 7, bx + sd * 6 + ph(k) * 0.8, by - 8); ell(c, bx + sd * 6 + ph(k) * 0.8, by - 8, 1.2, 1.2, hex(k.accent), undefined); glow(c, bx + sd * 6, by - 8, 4, k.accent, 0.5); }
  if (f.has('antennaMech')) { stroke(c, '#5a6074', 0.7, hx + hw * 0.4, hy - hh * 1.1, hx + hw * 0.5, hy - hh * 1.9); ell(c, hx + hw * 0.5, hy - hh * 1.95, 1.1, 1.1, hex(k.accent)); glow(c, hx + hw * 0.5, hy - hh * 1.95, 4, k.accent, 0.4 + 0.3 * ph(k)); }
  if (f.has('mushcap')) { c.beginPath(); c.ellipse(hx, hy - hh * 0.85, hw * 1.4, hh * 0.8, 0, Math.PI, 0); c.closePath(); c.fillStyle = hex(mix(k.accent, 0xc04a3a, 0.7)); c.fill(); c.strokeStyle = '#601818'; c.lineWidth = 0.8; c.stroke(); for (const [dx, dy] of [[-0.6, 0.35], [0.1, 0.6], [0.6, 0.3]]) ell(c, hx + dx * hw, hy - hh * (0.85 + dy), 1.3, 1, '#fff0e0'); }
  void L;
}

export function ears(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh } = k, kind = k.theme.ears;
  const sk = hex(k.skin), ln = hex(lineOf(k.skin)), inner = hex(mix(k.skin, 0xe07a8a, 0.4));
  const fur = k.feats.has('fur') ? k.L.hair : k.skin;
  const tw = ph(k, 0.5) * 0.12 * (k.frame <= 1 || k.frame >= 29 ? 1 : 0);
  for (const sd of [-1, 1]) {
    if (kind === 'round') { ell(c, hx + sd * hw * 1.02, hy + hh * 0.18, 1.8, 2.5, sk, ln, 0.6); ell(c, hx + sd * hw * 1.04, hy + hh * 0.2, 0.8, 1.3, hex(shade(k.skin, 0.88))); }
    else if (kind === 'long' || kind === 'point') {
      const len = kind === 'long' ? 10 : 5.5, rise = kind === 'long' ? 3.5 : 1.5, droop = (k.stage === 'elder' && kind === 'long') ? 3 : 0;
      c.beginPath(); c.moveTo(hx + sd * hw * 0.92, hy - hh * 0.05); c.quadraticCurveTo(hx + sd * (hw + len * 0.55), hy - hh * 0.3 - rise * 0.3, hx + sd * (hw + len), hy - hh * 0.55 - rise + droop); c.quadraticCurveTo(hx + sd * (hw + len * 0.5), hy + hh * 0.35, hx + sd * hw * 0.95, hy + hh * 0.42); c.closePath();
      c.fillStyle = sk; c.fill(); c.strokeStyle = ln; c.lineWidth = 0.65; c.stroke();
      c.beginPath(); c.moveTo(hx + sd * hw * 1.0, hy + hh * 0.02); c.quadraticCurveTo(hx + sd * (hw + len * 0.5), hy - hh * 0.2, hx + sd * (hw + len * 0.78), hy - hh * 0.4 - rise * 0.7 + droop); c.quadraticCurveTo(hx + sd * (hw + len * 0.4), hy + hh * 0.2, hx + sd * hw, hy + hh * 0.3); c.closePath(); c.fillStyle = inner; c.fill();
    } else if (kind === 'beast') {
      const bx = hx + sd * hw * 0.68, by = hy - hh * 0.88;
      c.save(); c.translate(bx, by); c.rotate(sd * (0.22 + tw));
      c.beginPath(); c.moveTo(-sd * 4.2, 1.5); c.quadraticCurveTo(-sd * 3.4, -7, sd * 0.5, -10.5); c.quadraticCurveTo(sd * 4.6, -5, sd * 4.4, 1.5); c.closePath();
      c.fillStyle = lin(c, 0, -10, 0, 2, [0, hex(lite(fur, 0.1))], [1, hex(shade(fur, 0.85))]); c.fill(); c.strokeStyle = hex(lineOf(fur)); c.lineWidth = 0.7; c.stroke();
      c.beginPath(); c.moveTo(-sd * 2.4, 0.5); c.quadraticCurveTo(-sd * 1.8, -4.8, sd * 0.5, -7); c.quadraticCurveTo(sd * 2.7, -3.5, sd * 2.6, 0.5); c.closePath(); c.fillStyle = inner; c.fill();
      c.restore();
    } else if (kind === 'fin') {
      const bx = hx + sd * hw * 0.98, by = hy + hh * 0.05;
      c.beginPath(); c.moveTo(bx, by - 3); c.quadraticCurveTo(bx + sd * 6, by - 8, bx + sd * 9, by - 5); c.lineTo(bx + sd * 7, by - 1); c.lineTo(bx + sd * 9, by + 3); c.quadraticCurveTo(bx + sd * 5, by + 4, bx, by + 3); c.closePath();
      c.fillStyle = lin(c, bx, by, bx + sd * 9, by, [0, rgba(k.accent, 0.95)], [1, rgba(lite(k.accent, 0.5), 0.75)]); c.fill(); c.strokeStyle = hex(lineOf(k.accent)); c.lineWidth = 0.55; c.stroke();
      for (let i = 0; i < 4; i++) stroke(c, rgba(shade(k.accent, 0.6), 0.6), 0.3, bx + sd * 0.8, by + (i - 1.5) * 1.4, bx + sd * (7 - Math.abs(i - 1.5) * 1), by + (i - 1.5) * 2.4 - 2);
    }
  }
  void fur;
}
