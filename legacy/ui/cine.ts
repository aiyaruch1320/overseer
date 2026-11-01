// Little animated scenes for big happenings (disasters, wars, festivals). Drawn in code on a 320×180 canvas that is
// scaled up with hard pixels, using the same pixel icons as the rest of the UI. Each scene is a function of time.
import { iconCanvas, hasIcon } from './icons';

export const CW = 320, CH = 180;
type Ctx = CanvasRenderingContext2D;
type Scene = (c: Ctx, t: number) => void;

const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const rect = (c: Ctx, col: string, x: number, y: number, w: number, h: number) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

function sky(c: Ctx, top: number[], bot: number[]) {
  for (let y = 0; y < CH; y += 6) rect(c, rgb(mix(top, bot, y / CH)), 0, y, CW, 6);
}
function stars(c: Ctx, t: number, n = 50) {
  for (let i = 0; i < n; i++) { const tw = (Math.sin(t * 3 + i) + 1) / 2; c.globalAlpha = 0.3 + tw * 0.7; rect(c, '#fff8d8', rnd(i) * CW, rnd(i + 99) * CH * 0.6, 1, 1); }
  c.globalAlpha = 1;
}
function spr(c: Ctx, name: string, x: number, y: number, k: number, flip = false, alpha = 1) {
  if (!hasIcon(name)) return;
  const cv = iconCanvas(name, k);
  c.globalAlpha = alpha;
  if (flip) { c.save(); c.translate(Math.round(x), 0); c.scale(-1, 1); c.drawImage(cv, -cv.width / 2, Math.round(y)); c.restore(); }
  else c.drawImage(cv, Math.round(x - cv.width / 2), Math.round(y));
  c.globalAlpha = 1;
}
// a row of little houses; `lit` windows glow, `fire` makes roofs flicker orange
function town(c: Ctx, t: number, o: { y?: number; col?: string; roof?: string; lit?: number; fire?: boolean; day?: boolean } = {}) {
  const gy = o.y ?? 140;
  rect(c, o.col ?? '#2c3a2a', 0, gy, CW, CH - gy);
  for (let i = 0; i < 12; i++) {
    const w = 18 + rnd(i) * 14, h = 14 + rnd(i + 7) * 16, x = i * 28 + rnd(i + 3) * 8 - 6, y = gy - h + 4;
    rect(c, o.day ? '#cbb88f' : '#2a2438', x, y, w, h);
    const burning = o.fire && rnd(i + 20) < 0.6;
    rect(c, burning ? (Math.sin(t * 9 + i) > 0 ? '#f08c3a' : '#e04848') : o.roof ?? '#3a2a3a', x - 2, y - 5, w + 4, 6);
    if (rnd(i + 11) < (o.lit ?? 0.5)) rect(c, burning ? '#ffe680' : '#f2c94c', x + 4, y + 5, 3, 3);
    if (burning) for (let k = 0; k < 3; k++) rect(c, '#ffb040', x + 3 + k * 5, y - 8 - Math.abs(Math.sin(t * 8 + i + k)) * 7, 3, 5);
  }
}
function ground(c: Ctx, col: string, y = 150) { rect(c, col, 0, y, CW, CH - y); }
function moon(c: Ctx, x: number, y: number, r: number, col = '#f6f2e8') { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function particles(c: Ctx, t: number, n: number, col: string | string[], o: { dx?: number; dy?: number; size?: number; x0?: number; w?: number; y0?: number; h?: number; wob?: number } = {}) {
  const dx = o.dx ?? 0, dy = o.dy ?? 30, size = o.size ?? 1;
  for (let i = 0; i < n; i++) {
    const sp = 0.6 + rnd(i + 5) * 0.8;
    const px = ((o.x0 ?? 0) + rnd(i) * (o.w ?? CW) + dx * t * sp + Math.sin(t * 2 + i) * (o.wob ?? 0));
    const py = ((o.y0 ?? 0) + rnd(i + 50) * (o.h ?? CH) + dy * t * sp);
    const X = ((px % CW) + CW) % CW, Y = ((py % CH) + CH) % CH;
    rect(c, Array.isArray(col) ? col[i % col.length] : col, X, Y, size, size);
  }
}
function crowd(c: Ctx, t: number, y: number, n: number, o: { cheer?: boolean; cols?: string[]; march?: number; x0?: number; w?: number } = {}) {
  const cols = o.cols ?? ['#8a3a2a', '#2a5a8a', '#3a7a3a', '#7a5a2a', '#5a3a7a'];
  for (let i = 0; i < n; i++) {
    const x = (o.x0 ?? 0) + (((i / n) * (o.w ?? CW) + (o.march ?? 0) * t) % (o.w ?? CW)) + rnd(i) * 4;
    const hop = o.cheer ? Math.abs(Math.sin(t * 6 + i * 1.7)) * 5 : Math.abs(Math.sin(t * 8 + i)) * 1.5;
    rect(c, '#e8b48a', x, y - 10 - hop, 4, 4);
    rect(c, cols[i % cols.length], x, y - 6 - hop, 4, 6);
    if (o.cheer) { rect(c, '#e8b48a', x - 1, y - 14 - hop + Math.sin(t * 9 + i) * 2, 1, 4); rect(c, '#e8b48a', x + 4, y - 14 - hop - Math.sin(t * 9 + i) * 2, 1, 4); }
  }
}
function firework(c: Ctx, t: number, i: number, cols: string[]) {
  const per = 1.6, ph = ((t + i * 0.55) % per) / per, id = Math.floor((t + i * 0.55) / per) + i * 13;
  const cx = 50 + rnd(id) * 220, cy = 25 + rnd(id + 1) * 60;
  if (ph < 0.3) { rect(c, '#fff', cx, CH - 30 - (CH - 30 - cy) * (ph / 0.3), 1, 3); return; }
  const k = (ph - 0.3) / 0.7;
  for (let a = 0; a < 18; a++) { const ang = (a / 18) * Math.PI * 2, d = 26 * Math.sqrt(k); c.globalAlpha = 1 - k; rect(c, cols[(a + id) % cols.length], cx + Math.cos(ang) * d, cy + Math.sin(ang) * d + k * 8, 2, 2); }
  c.globalAlpha = 1;
}
function ship(c: Ctx, x: number, y: number, flag = '#e04848', k = 1) {
  rect(c, '#5e3a26', x - 12 * k, y, 24 * k, 5 * k); rect(c, '#8a5a3a', x - 10 * k, y + 5 * k, 20 * k, 2 * k);
  rect(c, '#8a5a3a', x, y - 20 * k, 2, 20 * k); rect(c, '#f0e8d8', x + 2, y - 18 * k, 10 * k, 12 * k); rect(c, flag, x + 2, y - 22 * k, 5, 3);
}
function waves(c: Ctx, t: number, y: number, col: string, hi: string, amp = 2, h = CH) {
  rect(c, col, 0, y, CW, h - y);
  for (let x = 0; x < CW; x += 4) { const yy = y + Math.sin(x * 0.08 + t * 2) * amp; rect(c, hi, x, yy, 4, 2); }
}
function shake(c: Ctx, t: number, amp: number) { if (amp > 0) c.translate(Math.round((rnd(Math.floor(t * 30)) - 0.5) * amp), Math.round((rnd(Math.floor(t * 30) + 9) - 0.5) * amp)); }
function figure(c: Ctx, x: number, y: number, body: string, k = 1, step = 0) {
  rect(c, '#e8b48a', x, y - 12 * k, 4 * k, 4 * k); rect(c, body, x, y - 8 * k, 4 * k, 6 * k); rect(c, '#2a2438', x + (step > 0 ? 1 : 0), y - 2 * k, 1 * k, 2 * k); rect(c, '#2a2438', x + 2 + (step > 0 ? 0 : 1), y - 2 * k, 1 * k, 2 * k);
}

// ---------------- scenes ----------------
const SCENES: Record<string, Scene> = {
  dragon: (c, t) => {
    sky(c, [60, 20, 40], [230, 110, 50]); town(c, t, { fire: true, lit: 0.2 });
    const x = ((t * 55) % 420) - 50, y = 40 + Math.sin(t * 2) * 10 + Math.sin(x * 0.03) * 12;
    spr(c, 'dragon', x, y, 8, false);
    for (let i = 0; i < 20; i++) { const a = ((t * 2.4 + i * 0.13) % 1); rect(c, ['#ffe680', '#f08c3a', '#e04848'][i % 3], x - 40 + a * -10 + rnd(i) * 8, y + 60 + a * 60 + rnd(i + 3) * 6, 3, 3); }
    particles(c, t, 25, '#443', { dx: 6, dy: -20, y0: 100, h: 60 });
  },
  meteor: (c, t) => {
    const tt = t % 5, hit = tt > 2.4;
    sky(c, [8, 8, 28], hit ? [180, 90, 60] : [40, 30, 70]); stars(c, t); town(c, t, { lit: 0.7 });
    if (!hit) { const k = tt / 2.4, x = 40 + k * 190, y = -20 + k * 150; for (let i = 0; i < 14; i++) rect(c, ['#fff', '#ffe680', '#f08c3a'][i % 3], x - i * 6, y - i * 4.5, 8 - i * 0.5, 8 - i * 0.5); spr(c, 'meteor', x, y, 6); }
    else { const k = (tt - 2.4) / 2.6; c.globalAlpha = Math.max(0, 1 - k * 3); rect(c, '#fff', 0, 0, CW, CH); c.globalAlpha = 1; c.strokeStyle = '#ffd080'; c.lineWidth = 3; c.beginPath(); c.ellipse(230, 150, 20 + k * 170, 6 + k * 24, 0, 0, Math.PI * 2); c.stroke(); for (let i = 0; i < 24; i++) rect(c, '#f08c3a', 230 + (rnd(i) - 0.5) * 140 * k, 150 - Math.sin(k * 3 + rnd(i + 2) * 2) * 70 * (1 - k * 0.5), 3, 3); }
  },
  alien: (c, t) => {
    sky(c, [6, 10, 30], [24, 50, 60]); stars(c, t); ground(c, '#1c2c24', 148);
    const x = 160 + Math.sin(t * 0.8) * 50, y = 34 + Math.sin(t * 2) * 4;
    c.globalAlpha = 0.35 + Math.sin(t * 5) * 0.08; c.fillStyle = '#7aff9a'; c.beginPath(); c.moveTo(x - 10, y + 40); c.lineTo(x + 10, y + 40); c.lineTo(x + 34, 150); c.lineTo(x - 34, 150); c.fill(); c.globalAlpha = 1;
    const k = (t * 0.25) % 1, cy = 140 - k * 90;
    rect(c, '#f6f2e8', x - 6, cy, 12, 7); rect(c, '#2a2438', x - 3, cy + 1, 3, 3); rect(c, '#2a2438', x + 2, cy + 2, 3, 3); rect(c, '#f6f2e8', x - 8, cy + 6, 2, 3); rect(c, '#f6f2e8', x + 6, cy + 6, 2, 3);
    spr(c, 'ufo', x, y, 8);
    for (let i = 0; i < 8; i++) { const a = (t * 0.9 + i / 8) * Math.PI * 2; rect(c, '#7aff9a', x + Math.cos(a) * 28, y + 36 + Math.sin(a) * 4, 2, 2); }
    town(c, t, { y: 160, col: '#1c2c24', lit: 0.1 });
  },
  titan: (c, t) => {
    sky(c, [40, 30, 60], [200, 120, 90]);
    const step = Math.sin(t * 2.2), pulse = Math.max(0, Math.sin(t * 2.2 + Math.PI / 2) - 0.8);
    c.save(); shake(c, t, pulse > 0 ? 6 : 1);
    ground(c, '#4a3a32', 150);
    spr(c, 'giant', 200 + step * 6, 10 + step * 2, 13);
    town(c, t, { y: 160, col: '#4a3a32', lit: 0.2 });
    for (let i = 0; i < 24; i++) { const a = (t * 0.8 + rnd(i)) % 1; rect(c, '#9a8a7a', 120 + rnd(i + 4) * 150, 155 - a * 30, 3 + a * 3, 3 + a * 3); }
    c.restore();
  },
  locust: (c, t) => {
    sky(c, [200, 170, 70], [230, 200, 120]); moon(c, 250, 40, 20, '#fff2a0'); ground(c, '#8a7a3a', 150);
    for (let x = 0; x < CW; x += 8) { rect(c, '#c8a830', x, 140 + Math.sin(x) * 2, 3, 10); rect(c, '#e0c040', x + 3, 138, 3, 12); }
    c.globalAlpha = 0.35; rect(c, '#2a2010', 0, 0, CW, CH); c.globalAlpha = 1;
    particles(c, t, 260, '#2a1a08', { dx: 90, dy: 14, size: 2, wob: 6 });
    particles(c, t + 3, 120, '#5a3a18', { dx: 120, dy: 8, size: 1, wob: 4 });
  },
  flood: (c, t) => {
    sky(c, [60, 70, 90], [120, 140, 160]); town(c, t, { y: 130, col: '#444', lit: 0.2 });
    const rise = Math.min(1, (t % 8) / 5); waves(c, t, 150 - rise * 60, 'rgba(50,110,170,0.9)', '#9ad0ff', 3);
    particles(c, t, 120, '#bcd8f0', { dx: -10, dy: 260, size: 1 });
    ship(c, 60 + ((t * 20) % 240), 150 - rise * 60 - 8, '#f2c94c', 0.7);
  },
  quake: (c, t) => {
    sky(c, [90, 70, 60], [200, 160, 110]);
    c.save(); shake(c, t, 7); town(c, t, { y: 140, col: '#6a5a44', day: true, lit: 0 });
    c.strokeStyle = '#1b1626'; c.lineWidth = 2; const g = Math.min(1, (t % 5) / 2);
    c.beginPath(); c.moveTo(30, 150); for (let x = 30; x < 30 + 260 * g; x += 14) c.lineTo(x, 150 + ((x / 14) % 2 ? 8 : -2) + Math.sin(x) * 6); c.stroke();
    for (let i = 0; i < 18; i++) { const a = (t * 1.1 + rnd(i)) % 1; rect(c, '#a09080', rnd(i + 3) * CW, 80 + a * 80, 4, 4); }
    c.restore();
    particles(c, t, 50, '#c8b090', { dx: 5, dy: -8, y0: 110, h: 60, size: 2 });
  },
  eclipse: (c, t) => {
    const k = Math.min(1, (t % 9) / 5);
    sky(c, mix([110, 160, 230], [10, 6, 20], k), mix([190, 220, 250], [30, 10, 30], k)); if (k > 0.6) stars(c, t, 30); town(c, t, { y: 150, col: '#1a1a22', lit: k, day: k < 0.4 });
    const sx = 160, sy = 60; moon(c, sx, sy, 26, '#fff2a0'); moon(c, sx - 30 + k * 30, sy, 26, k > 0.95 ? '#08040c' : '#16101e');
    if (k > 0.9) { c.strokeStyle = '#ffd080'; c.lineWidth = 2; c.beginPath(); c.arc(sx, sy, 29 + Math.sin(t * 4), 0, Math.PI * 2); c.stroke(); }
    if (k > 0.8) for (let i = 0; i < 8; i++) { const on = Math.sin(t * 2 + i * 2) > -0.3; if (on) { rect(c, '#e04848', 20 + i * 38, 150 + rnd(i) * 20, 3, 2); rect(c, '#e04848', 26 + i * 38, 150 + rnd(i) * 20, 3, 2); } }
  },
  magic: (c, t) => {
    sky(c, mix([90, 40, 140], [30, 80, 150], (Math.sin(t) + 1) / 2), [220, 120, 200]); town(c, t, { lit: 0.8 });
    const cols = ['#ff6a6a', '#ffd060', '#7aff9a', '#6ac0ff', '#c07aff'];
    for (let i = 0; i < 70; i++) { const a = t * 1.5 + i * 0.37; rect(c, cols[i % 5], 160 + Math.cos(a) * (30 + i * 2), 80 + Math.sin(a * 1.3) * (20 + i * 0.7), 2, 2); }
    ['book', 'mug', 'key', 'orb', 'note'].forEach((n, i) => spr(c, n, 40 + i * 58, 70 + Math.sin(t * 1.6 + i) * 20, 3));
  },
  whale: (c, t) => {
    sky(c, [90, 150, 230], [200, 230, 255]); for (let i = 0; i < 5; i++) { const x = ((t * (4 + i * 2) + i * 90) % 420) - 50; rect(c, '#fff', x, 20 + i * 24, 40, 8); rect(c, '#fff', x + 8, 14 + i * 24, 24, 8); }
    ground(c, '#4a9a4a', 156); town(c, t, { y: 160, col: '#4a9a4a', day: true, roof: '#b04a3a', lit: 0 });
    const x = ((t * 14) % 480) - 80; spr(c, 'whale', x, 40 + Math.sin(t) * 8, 12, true);
    particles(c, t, 80, ['#fff8c0', '#c8f0ff', '#ffd0f0'], { dy: 18, dx: 6, size: 2, x0: 0, w: CW, h: CH });
  },
  kraken: (c, t) => {
    sky(c, [10, 12, 36], [30, 40, 80]); stars(c, t, 30); moon(c, 260, 34, 14);
    waves(c, t, 120, '#10284a', '#3a68a8', 3);
    [70, 150, 240].forEach((x, i) => { const up = 0.5 + Math.sin(t * 1.5 + i * 2) * 0.4; c.save(); c.beginPath(); c.rect(0, 0, CW, 130); c.clip(); spr(c, 'tentacle', x, 130 - up * 90, 8); c.restore(); });
    ship(c, 160 + Math.sin(t) * 8, 118 + Math.sin(t * 2) * 3, '#e04848', 1.2);
    waves(c, t + 1, 132, 'rgba(16,40,74,0.8)', '#4a78b8', 2);
  },
  army: (c, t) => {
    sky(c, [50, 10, 20], [200, 60, 40]); moon(c, 250, 40, 26, '#a02020'); ground(c, '#1c1418', 140);
    spr(c, 'demon', 80, 10, 6, false, 0.35 + Math.sin(t * 2) * 0.1);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 18; i++) { const x = ((i * 20 + t * 24 + r * 9) % 360) - 20, y = 150 + r * 12, st = Math.sin(t * 8 + i + r); figure(c, x, y, '#2a1a2a', 1, st); rect(c, '#e0d0d0', x + 5, y - 22 + st, 1, 14); }
    for (let i = 0; i < 5; i++) { const x = ((i * 70 + t * 24) % 360) - 20; rect(c, '#5e3a26', x, 100, 2, 50); rect(c, '#8c2030', x + 2, 100, 14 + Math.sin(t * 5 + i) * 2, 10); }
    particles(c, t, 40, '#ff8040', { dx: 8, dy: -30, y0: 100, h: 60 });
  },
  hero: (c, t) => {
    sky(c, [120, 180, 240], [230, 240, 255]); ground(c, '#7ac060', 150); town(c, t, { y: 156, col: '#7ac060', day: true, roof: '#b04a3a', lit: 0 });
    crowd(c, t, 168, 34, { cheer: true });
    const hx = 160, hy = 150 - Math.abs(Math.sin(t * 3)) * 3; rect(c, '#f2c94c', hx - 2, hy - 28, 8, 3); spr(c, 'herosword', hx + 2, hy - 38, 3);
    figure(c, hx, hy, '#2a5a8a', 2);
    particles(c, t, 70, ['#ff6a6a', '#ffd060', '#7aff9a', '#6ac0ff'], { dy: 40, size: 2, wob: 8 });
  },
  battle: (c, t) => {
    const f = (t * 3) % 1, hit = f > 0.8;
    sky(c, [18, 8, 30], hit ? [160, 60, 60] : [90, 40, 60]); ground(c, '#241a24', 140);
    c.save(); shake(c, t, hit ? 6 : 0);
    spr(c, 'herosword', 108 + Math.sin(t * 6) * 6, 80, 7); spr(c, 'demon', 212 - Math.sin(t * 6) * 6, 62, 8, true);
    if (hit) { c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(160, 50); c.lineTo(150, 90); c.lineTo(168, 96); c.lineTo(156, 140); c.stroke(); rect(c, '#fff', 150, 100, 20, 8); }
    c.restore(); particles(c, t, 40, '#ffd080', { dy: -20, dx: 10, y0: 100, h: 60, size: 2 });
  },
  lanterns: (c, t) => {
    sky(c, [10, 10, 40], [50, 30, 70]); stars(c, t, 40); moon(c, 60, 36, 14); waves(c, t, 140, '#16224a', '#3a58a0', 2);
    for (let i = 0; i < 26; i++) { const k = (t * 0.07 * (0.6 + rnd(i)) + rnd(i + 8)) % 1, x = rnd(i) * CW + Math.sin(t + i) * 6, y = 150 - k * 160; c.globalAlpha = 1 - Math.max(0, k - 0.7) * 3; spr(c, 'lantern', x, y, 2); } c.globalAlpha = 1;
  },
  festival: (c, t) => {
    sky(c, [14, 10, 44], [70, 40, 90]); stars(c, t, 30); town(c, t, { lit: 0.9 });
    for (let i = 0; i < 4; i++) firework(c, t, i, ['#ff6a6a', '#ffd060', '#7aff9a', '#6ac0ff', '#e07aff']);
    for (let x = 0; x < CW; x += 16) { rect(c, ['#e04848', '#f2c94c', '#5aa0ea', '#6cc05a'][(x / 16) % 4], x, 112 + Math.sin(x * 0.2) * 3, 8, 6); } rect(c, '#5e3a26', 0, 110, CW, 1);
    crowd(c, t, 172, 30, { cheer: true });
  },
  dragondance: (c, t) => {
    sky(c, [10, 8, 30], [60, 20, 30]); town(c, t, { lit: 0.9 }); ground(c, '#3a2a2a', 150);
    for (let i = 0; i < 16; i++) { const x = ((t * 50 - i * 14) % 380) - 30, y = 112 + Math.sin(t * 4 - i * 0.6) * 10; rect(c, i === 0 ? '#e04848' : i % 2 ? '#f2c94c' : '#e08030', x, y, 12, 10); rect(c, '#8c2030', x + 2, y + 10, 8, 2); if (i === 0) { rect(c, '#fff', x + 8, y + 2, 2, 2); rect(c, '#f2c94c', x - 2, y - 4, 3, 4); rect(c, '#f2c94c', x + 8, y - 4, 3, 4); } }
    particles(c, t, 60, ['#ff6a6a', '#ffd060'], { dy: 30, size: 2, wob: 8 });
    for (let i = 0; i < 3; i++) firework(c, t + i, i, ['#ff6a6a', '#ffd060']);
  },
  harvest: (c, t) => {
    sky(c, [240, 190, 110], [250, 230, 170]); moon(c, 250, 44, 20, '#fff0b0'); ground(c, '#c8a040', 130);
    for (let y = 134; y < CH; y += 10) for (let x = 0; x < CW; x += 7) { const sw = Math.sin(t * 2 + x * 0.1 + y) * 1.5; rect(c, '#e8b830', x + sw, y - 6, 2, 8); rect(c, '#f6d860', x + sw, y - 8, 2, 3); }
    crowd(c, t, 166, 18, { cols: ['#8a3a2a', '#f0e8d8', '#2a7a7a'], cheer: true });
    particles(c, t, 40, ['#e8b830', '#c87a2a'], { dx: 20, dy: 14, size: 2, wob: 10 });
  },
  snowfest: (c, t) => {
    sky(c, [30, 50, 100], [150, 190, 230]); stars(c, t, 20); ground(c, '#e8f0f8', 130);
    for (let i = 0; i < 7; i++) { const x = 30 + i * 44, h = 22 + rnd(i) * 24; rect(c, '#a0d8f8', x, 140 - h, 14, h); rect(c, '#d8f4ff', x + 2, 140 - h, 4, h); rect(c, '#fff', x + 4, 140 - h - 6, 6, 6); c.globalAlpha = 0.3 + Math.sin(t * 3 + i) * 0.2; rect(c, '#fff', x - 3, 140 - h - 3, 20, h + 6); c.globalAlpha = 1; }
    particles(c, t, 120, '#fff', { dx: -12, dy: 24, size: 2, wob: 8 }); crowd(c, t, 172, 14, { cols: ['#8a3a2a', '#2a5a8a'], cheer: true });
  },
  firefest: (c, t) => {
    sky(c, [20, 6, 14], [80, 24, 20]); ground(c, '#2a1a14', 140);
    for (let i = 0; i < 46; i++) { const a = (t * 1.3 + rnd(i)) % 1, x = 160 + (rnd(i + 3) - 0.5) * 70 * (1 - a * 0.4), y = 138 - a * 110; rect(c, ['#ffe680', '#f08c3a', '#e04848'][Math.floor(a * 3)], x, y, 4 - a * 2, 4 - a * 2); }
    for (let i = 0; i < 12; i++) { const a = t * 1.1 + (i / 12) * Math.PI * 2, x = 160 + Math.cos(a) * 62, y = 148 + Math.sin(a) * 14; figure(c, x, y, '#2a1a1a', 1.4, Math.sin(t * 6 + i)); }
    particles(c, t, 50, '#ffb040', { dy: -40, dx: 4, y0: 100, h: 60 });
  },
  race: (c, t) => {
    sky(c, [120, 190, 240], [240, 230, 190]); waves(c, t, 110, '#d8b870', '#f0d890', 1, 170);
    for (let i = 0; i < 4; i++) { const x = ((t * (34 + i * 7) + i * 40) % 380) - 40; ship(c, x, 112 + i * 14, ['#e04848', '#2a5a8a', '#3a7a3a', '#f2c94c'][i], 0.9); }
    particles(c, t, 40, '#fff0c0', { dx: 80, dy: 4, y0: 100, h: 70 });
  },
  boatrace: (c, t) => {
    sky(c, [120, 190, 240], [220, 240, 255]); waves(c, t, 100, '#3a78b8', '#8ac0f0', 2, 180);
    for (let i = 0; i < 4; i++) { const x = ((t * (30 + i * 6) + i * 50) % 380) - 40, y = 110 + i * 15; rect(c, ['#e04848', '#f2c94c', '#3a7a3a', '#9a4aa0'][i], x - 22, y, 46, 4); for (let k = 0; k < 8; k++) { rect(c, '#f0e8d8', x - 20 + k * 5, y - 5 - Math.abs(Math.sin(t * 5 + k)) * 2, 3, 5); } }
  },
  masks: (c, t) => {
    sky(c, [30, 10, 50], [90, 30, 90]); town(c, t, { lit: 1, roof: '#4a2a5a' }); ground(c, '#201020', 150);
    for (let i = 0; i < 12; i++) spr(c, 'mask', 20 + i * 26 + Math.sin(t + i) * 5, 60 + Math.sin(t * 1.4 + i * 1.5) * 22, 2);
    for (let i = 0; i < 16; i++) { const a = t * 0.8 + i; c.globalAlpha = 0.25; rect(c, ['#c070ff', '#ff70c0'][i % 2], 160 + Math.cos(a) * 140, 90 + Math.sin(a * 1.2) * 60, 20, 20); } c.globalAlpha = 1;
    crowd(c, t, 172, 20, { cols: ['#5a2a7a', '#8a2a6a', '#2a2a5a'], cheer: true });
  },
  stargaze: (c, t) => {
    sky(c, [4, 4, 22], [30, 20, 60]); stars(c, t, 90); ground(c, '#102018', 150);
    for (let i = 0; i < 6; i++) { const k = (t * 0.5 + i * 0.37) % 1, x = rnd(i + Math.floor(t * 0.5 + i * 0.37)) * 260 + 30 + k * 60, y = k * 90 + 10; for (let j = 0; j < 8; j++) { c.globalAlpha = 1 - j / 8; rect(c, '#fff', x - j * 3, y - j * 2, 2, 2); } } c.globalAlpha = 1;
    crowd(c, t, 172, 10, { cols: ['#2a3a5a', '#3a2a5a'] });
  },
  blooms: (c, t) => {
    sky(c, [150, 210, 250], [250, 230, 240]); ground(c, '#7ac060', 140);
    for (let i = 0; i < 44; i++) { const x = rnd(i) * CW, y = 144 + rnd(i + 5) * 34; rect(c, '#3a8a3a', x + 1, y, 1, 6); rect(c, ['#f06aa0', '#ffd060', '#fff', '#c07aff'][i % 4], x - 1 + Math.sin(t * 2 + i) * 1, y - 3, 4, 4); }
    particles(c, t, 90, ['#f8c0d8', '#fff', '#ffe0f0'], { dx: 14, dy: 16, size: 2, wob: 10 });
    spr(c, 'flower', 160, 40 + Math.sin(t) * 4, 8);
  },
  march: (c, t) => {
    sky(c, [90, 90, 120], [220, 200, 170]); ground(c, '#5a5a44', 140);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 20; i++) { const x = ((i * 18 + t * 22 + r * 7) % 360) - 20, y = 150 + r * 11, st = Math.sin(t * 7 + i + r); figure(c, x, y, '#e8e4d8', 1, st); rect(c, '#c9ccd6', x + 5, y - 22 + st, 1, 14); }
    for (let i = 0; i < 4; i++) { const x = ((i * 90 + t * 22) % 360) - 20; rect(c, '#5e3a26', x, 100, 2, 50); rect(c, '#f2c94c', x + 2, 100, 14 + Math.sin(t * 5 + i) * 2, 10); }
    spr(c, 'herosword', 160, 30, 6);
  },
  mob: (c, t) => {
    sky(c, [16, 10, 20], [60, 30, 30]); ground(c, '#201418', 140);
    for (let i = 0; i < 40; i++) { const x = rnd(i) * CW, y = 150 + rnd(i + 2) * 24, st = Math.sin(t * 6 + i); figure(c, x + st, y, '#3a2a2a', 1, st); rect(c, '#5e3a26', x + 5, y - 20, 1, 14); rect(c, '#ffb040', x + 4, y - 25 - Math.abs(st) * 2, 3, 5); }
    particles(c, t, 70, '#ff8040', { dy: -30, dx: 4, y0: 100, h: 80 }); spr(c, 'bless', 160, 18, 6, false, 0.5);
  },
  ships: (c, t) => {
    sky(c, [40, 60, 100], [180, 160, 150]); waves(c, t, 108, '#1a3a5a', '#4a78a8', 2);
    for (let i = 0; i < 5; i++) { const x = ((t * (20 + i * 3) + i * 80) % 400) - 40; ship(c, x, 112 + i * 9, '#1b1626', 0.9); spr(c, 'jolly', x + 5, 74 + i * 9, 1); }
    for (let i = 0; i < 12; i++) { const a = (t * 0.7 + i * 0.3) % 1; rect(c, '#ffb040', 250 + rnd(i) * 50, 120 - a * 30, 2, 3); }
  },
  sandstorm: (c, t) => {
    sky(c, [180, 130, 70], [230, 190, 120]); ground(c, '#d8a860', 150); town(c, t, { y: 155, col: '#d8a860', day: true, roof: '#a07040', lit: 0 });
    particles(c, t, 360, ['#e8c080', '#c89850', '#f0d090'], { dx: 190, dy: 8, size: 2, wob: 4 });
    c.globalAlpha = 0.3; rect(c, '#c89850', 0, 0, CW, CH); c.globalAlpha = 1;
  },
  longnight: (c, t) => {
    sky(c, [2, 4, 18], [10, 20, 50]); stars(c, t, 120);
    for (let i = 0; i < 5; i++) { c.globalAlpha = 0.25 + Math.sin(t + i) * 0.1; c.fillStyle = ['#40ffa0', '#40c0ff', '#a060ff'][i % 3]; c.beginPath(); c.moveTo(i * 70, 0); for (let k = 0; k <= 8; k++) c.lineTo(i * 70 + Math.sin(t * 0.8 + k * 0.7 + i) * 24 + 20, k * 14 + 20); c.lineTo(i * 70 + 50, 0); c.fill(); } c.globalAlpha = 1;
    ground(c, '#e8f0f8', 150); town(c, t, { y: 156, col: '#e8f0f8', lit: 1, roof: '#4a5a8a' }); particles(c, t, 40, '#fff', { dy: 14, size: 1 });
  },
  eruption: (c, t) => {
    sky(c, [40, 10, 10], [200, 80, 40]); ground(c, '#2a1a18', 150);
    c.fillStyle = '#3a2420'; c.beginPath(); c.moveTo(60, 150); c.lineTo(160, 50); c.lineTo(260, 150); c.fill();
    c.fillStyle = '#f06a20'; c.beginPath(); c.moveTo(150, 56); c.lineTo(170, 56); c.lineTo(164, 150); c.lineTo(158, 150); c.fill();
    for (let i = 0; i < 40; i++) { const a = (t * 0.9 + rnd(i)) % 1, ang = (rnd(i + 3) - 0.5) * 1.6; rect(c, ['#ffe680', '#f08c3a', '#e04848'][i % 3], 160 + Math.sin(ang) * a * 100, 56 + (a * a * 130 - a * 80), 3, 3); }
    c.globalAlpha = 0.6; for (let i = 0; i < 12; i++) rect(c, '#3a3030', 120 + rnd(i) * 90 + Math.sin(t + i) * 10, 40 - ((t * 20 + i * 9) % 60) + 40, 24, 12); c.globalAlpha = 1;
    particles(c, t, 70, '#4a3a38', { dy: 24, dx: 6, size: 1 });
  },
  gate: (c, t) => {
    sky(c, [20, 0, 20], [90, 10, 40]); ground(c, '#1a0c14', 150);
    for (let r = 0; r < 6; r++) { c.strokeStyle = ['#ff40a0', '#a040ff', '#ff4040'][r % 3]; c.lineWidth = 3; c.beginPath(); c.ellipse(160, 90, 20 + r * 8 + Math.sin(t * 3 + r) * 2, 40 + r * 9, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#080008'; c.beginPath(); c.ellipse(160, 90, 24, 44, 0, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 6; i++) { const a = (t * 0.35 + i / 6) % 1; spr(c, 'demon', 160 + (rnd(i) - 0.5) * 150 * a, 80 + a * 70, 2 + Math.floor(a * 3), false, a); }
  },
  bloodmoon: (c, t) => {
    sky(c, [20, 4, 10], [90, 20, 30]); stars(c, t, 40); moon(c, 160, 70, 40, '#b01c1c'); moon(c, 150, 62, 34, '#c82828');
    ground(c, '#100808', 150); for (let i = 0; i < 9; i++) { const x = 20 + i * 36; rect(c, '#1a0a0a', x, 112, 10, 38); rect(c, '#1a0a0a', x + 4, 105, 12, 10); }
    const how = Math.sin(t * 1.5) > 0; rect(c, '#08040a', 240, 128, 22, 12); rect(c, '#08040a', 258 + (how ? 3 : 0), 118 - (how ? 4 : 0), 8, 10); rect(c, '#ffe080', 262 + (how ? 3 : 0), 121 - (how ? 4 : 0), 2, 2);
  },
  naga: (c, t) => {
    sky(c, [80, 140, 200], [190, 230, 240]); waves(c, t, 120, '#3a7ab0', '#a0d8f0', 2);
    for (let i = 0; i < 12; i++) { const a = Math.min(1, (t % 6) / 3), y = 120 - i * 7 * a - Math.abs(Math.sin(t * 2 + i)) * 2, x = 160 + Math.sin(i * 0.6 + t * 1.5) * 14; rect(c, '#2a8a6a', x - 8 + i * 0.5, y, 16 - i * 0.6, 8); rect(c, '#f2c94c', x - 2, y + 2, 4, 2); }
    spr(c, 'snake', 160 + Math.sin(t) * 3, 120 - 90 * Math.min(1, (t % 6) / 3), 5);
    particles(c, t, 60, '#c8f0ff', { dy: 24, size: 1, x0: 100, w: 120 });
  },
  undead: (c, t) => {
    sky(c, [12, 14, 28], [40, 50, 70]); stars(c, t, 40); moon(c, 250, 36, 16, '#d8e8d0'); ground(c, '#1a2418', 140);
    for (let i = 0; i < 9; i++) { const x = 20 + i * 34; rect(c, '#7a8088', x, 124 + (i % 3) * 8, 12, 18); rect(c, '#5a6068', x + 4, 128 + (i % 3) * 8, 4, 8); const up = Math.max(0, Math.sin(t * 1.2 + i * 1.3)); if (up > 0.1) spr(c, 'undead', x + 6, 130 + (i % 3) * 8 - up * 18, 2); }
    particles(c, t, 40, '#80ffa0', { dy: -10, size: 2, y0: 80, h: 80, wob: 6 });
  },
  herd: (c, t) => {
    sky(c, [240, 200, 120], [250, 240, 190]); ground(c, '#c8b060', 120);
    for (let i = 0; i < 26; i++) { const x = ((t * (50 + rnd(i) * 20) + i * 40) % 400) - 40, y = 130 + rnd(i + 4) * 40, hop = Math.abs(Math.sin(t * 9 + i)) * 4; rect(c, '#7a5a30', x, y - hop - 7, 14, 6); rect(c, '#7a5a30', x + 12, y - hop - 10, 5, 5); rect(c, '#4a3a20', x + 1, y - hop - 1, 2, 4 + hop / 2); rect(c, '#4a3a20', x + 10, y - hop - 1, 2, 4 + hop / 2); }
    particles(c, t, 120, '#a08850', { dx: 80, dy: -3, y0: 120, h: 60, size: 2 });
  },
  council: (c, t) => {
    sky(c, [40, 100, 60], [140, 200, 130]); ground(c, '#4a8a4a', 120);
    c.fillStyle = '#6a4a2a'; c.beginPath(); c.ellipse(160, 140, 70, 18, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#8a6a3a'; c.beginPath(); c.ellipse(160, 136, 70, 18, 0, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, x = 160 + Math.cos(a) * 82, y = 140 + Math.sin(a) * 24; figure(c, x, y, ['#2a7a4a', '#c8d0a0', '#5a3a7a'][i % 3], 1.4, 0); if (Math.sin(t * 2 + i) > 0.6) rect(c, '#fff', x + 2, y - 22, 3, 3); }
    spr(c, 'leaf', 160, 20, 6); particles(c, t, 30, ['#6cc05a', '#f2c94c'], { dy: 14, size: 2, wob: 8 });
  },
  gold: (c, t) => {
    sky(c, [70, 50, 20], [200, 150, 60]); ground(c, '#5a4a30', 130);
    for (let i = 0; i < 40; i++) { const a = (t * 0.5 + rnd(i)) % 1; spr(c, 'gold', rnd(i + 2) * CW, -10 + a * 150, 2); }
    for (let i = 0; i < 10; i++) { const x = 20 + i * 30, sw = Math.sin(t * 6 + i); figure(c, x, 168, '#7a5a2a', 1.3, sw); rect(c, '#8a8f9a', x + 7, 150 - Math.max(0, sw) * 6, 2, 12); rect(c, '#c9ccd6', x + 5, 148 - Math.max(0, sw) * 6, 6, 2); }
    particles(c, t, 40, ['#ffe680', '#fff'], { dy: 6, size: 2 });
  },
  inquisition: (c, t) => {
    sky(c, [14, 14, 30], [70, 50, 70]); ground(c, '#1c1820', 150); town(c, t, { lit: 0.6 });
    c.fillStyle = '#d0a040'; c.beginPath(); c.moveTo(150, 90); c.lineTo(170, 90); c.lineTo(176, 150); c.lineTo(144, 150); c.fill(); rect(c, '#f6f2e8', 154, 96, 12, 8);
    for (let i = 0; i < 40; i++) { const x = rnd(i) * CW, y = 160 + rnd(i + 2) * 14; figure(c, x, y, '#3a2a3a', 1); rect(c, '#ffb040', x + 4, y - 20 - Math.abs(Math.sin(t * 5 + i)) * 2, 3, 6); }
    spr(c, 'bless', 160, 14, 5, false, 0.6);
  },
};

// which scene (and what tint of the banner) each happening uses
const MAP: Record<string, string> = {
  dragon_raid: 'dragon', dragon_awake: 'dragon', meteor: 'meteor', alien: 'alien', titan: 'titan', locust: 'locust', flood: 'flood', quake: 'quake', eclipse: 'eclipse',
  magic_storm: 'magic', sky_whale: 'whale', kraken: 'kraken', demon_army: 'army', hero_arrives: 'hero', final_battle: 'battle',
  fest_lantern: 'lanterns', fest_ancestor_night: 'lanterns', fest_dragon_dance: 'dragondance', fest_harvest: 'harvest', fest_boat_race: 'boatrace', fest_tournament: 'march',
  fest_fire_fest: 'firefest', fest_ice_fest: 'snowfest', fest_sand_race: 'race', fest_masquerade: 'masks', fest_star_watch: 'stargaze', fest_brew_fest: 'festival',
  fest_great_hunt: 'herd', fest_flower_fest: 'blooms', fest_light_procession: 'lanterns',
  holy_war: 'march', inquisition: 'inquisition', pirates: 'ships', sandstorm: 'sandstorm', long_night: 'longnight', eruption: 'eruption', demon_gate: 'gate',
  bloodmoon: 'bloodmoon', naga_rise: 'naga', bloom: 'blooms', undead: 'undead', migration: 'herd', horde: 'army', council: 'council', gold_rush: 'gold', festival: 'festival',
};
export const hasScene = (anim: string) => anim in MAP;

// plays a scene on a canvas until stopped
export function playScene(cv: HTMLCanvasElement, anim: string): () => void {
  cv.width = CW; cv.height = CH;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const scene = SCENES[MAP[anim] || 'festival'];
  let raf = 0;
  const t0 = performance.now();
  const frame = (now: number) => {
    c.setTransform(1, 0, 0, 1, 0, 0);
    scene(c, (now - t0) / 1000);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
