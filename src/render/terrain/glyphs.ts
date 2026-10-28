// Hand-drawn map symbols. Every glyph is a few vector paths anchored at its base (x, y) and `u` map units tall,
// so it stays razor sharp at any zoom. `r` is a per-glyph random in [0,1) for variety, `g.hair` is one CSS pixel in MU.
// pass 0 = the still part (cached as a sprite), 1 = only the moving part (smoke, flags, flicker), 2 = everything
export interface G { ctx: CanvasRenderingContext2D; hair: number; time: number; pass: 0 | 1 | 2 }
const still = (g: G) => g.pass !== 1, moving = (g: G) => g.pass !== 0;

const TAU = Math.PI * 2;
const pick = <T>(a: readonly T[], r: number): T => a[Math.min(a.length - 1, Math.floor(r * a.length))];
const circle = (c: CanvasRenderingContext2D, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const poly = (c: CanvasRenderingContext2D, p: number[]) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); };
const shadow = (g: G, x: number, y: number, rx: number, a = 0.2) => { const c = g.ctx; c.fillStyle = `rgba(10,20,10,${a})`; c.beginPath(); c.ellipse(x + rx * 0.25, y, rx, rx * 0.34, 0, 0, TAU); c.fill(); };

const OAK = ['#3f7d3a', '#4b8a40', '#356f35', '#558f45'], OAK_D = '#2b5a2c', OAK_L = '#7fbb5f', TRUNK = '#6b4a2f';
const PINE = ['#2c6a46', '#255d3f', '#337552'], PINE_L = '#4f9a6c';
const JUNGLE = ['#2a7a3a', '#1f6a33', '#34873f', '#1b5c30'], JUNGLE_L = '#5fbd57';
const ROCK_L = ['#a89a86', '#b5a791', '#9c8d7a'], ROCK_D = ['#6f6354', '#625748', '#77695a'];
const DARK_L = ['#5a4a46', '#665450'], DARK_D = ['#2e2523', '#3a2e2b'];
const SAND_D = ['#c99a55', '#bf8f4c', '#d4a862'], SAND_L = '#f0d89a';
const BONE = ['#d8cfb8', '#c9bfa6', '#e2dac6'], BONE_D = '#7a6e5a';

export type GlyphFn = (g: G, x: number, y: number, u: number, r: number) => void;

export const oak: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, R = u * 0.46;
  shadow(g, x, y, R * 0.9);
  c.fillStyle = TRUNK; c.fillRect(x - u * 0.06, y - u * 0.4, u * 0.12, u * 0.4);
  c.fillStyle = OAK_D; circle(c, x + R * 0.16, y - u * 0.55 + R * 0.15, R);
  c.fillStyle = pick(OAK, r); circle(c, x, y - u * 0.58, R);
  c.fillStyle = OAK_L; c.globalAlpha *= 0.55; circle(c, x - R * 0.3, y - u * 0.58 - R * 0.32, R * 0.42); c.globalAlpha /= 0.55;
};

export const pine: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, w = u * 0.34;
  shadow(g, x, y, w * 0.9);
  c.fillStyle = TRUNK; c.fillRect(x - u * 0.04, y - u * 0.18, u * 0.08, u * 0.18);
  const col = pick(PINE, r);
  for (let k = 0; k < 3; k++) {
    const by = y - u * (0.12 + k * 0.28), ww = w * (1 - k * 0.28);
    c.fillStyle = col; poly(c, [x - ww, by, x + ww, by, x, by - u * 0.4]); c.fill();
    c.fillStyle = PINE_L; c.globalAlpha *= 0.5; poly(c, [x - ww, by, x, by - u * 0.4, x - ww * 0.15, by]); c.fill(); c.globalAlpha /= 0.5;
  }
};

export const jungle: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, R = u * 0.36;
  shadow(g, x, y, R * 1.25, 0.24);
  c.fillStyle = JUNGLE[3];
  circle(c, x - R * 0.7, y - R * 0.7, R * 0.8); circle(c, x + R * 0.7, y - R * 0.75, R * 0.8); circle(c, x, y - R * 0.5, R * 0.95);
  c.fillStyle = pick(JUNGLE, r);
  circle(c, x - R * 0.62, y - R * 1.0, R * 0.78); circle(c, x + R * 0.62, y - R * 1.05, R * 0.78); circle(c, x, y - R * 1.35, R * 0.95);
  c.fillStyle = JUNGLE_L; c.globalAlpha *= 0.5; circle(c, x - R * 0.3, y - R * 1.7, R * 0.4); circle(c, x + R * 0.7, y - R * 1.3, R * 0.3); c.globalAlpha /= 0.5;
};

export const palm: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, lean = (r - 0.5) * u * 0.3;
  shadow(g, x, y, u * 0.3);
  c.strokeStyle = '#7a5a36'; c.lineWidth = Math.max(g.hair, u * 0.07); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * 0.4, y - u * 0.5, x + lean, y - u * 0.85); c.stroke();
  c.strokeStyle = '#3f9a45'; c.lineWidth = Math.max(g.hair, u * 0.06);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.3;
    c.beginPath(); c.moveTo(x + lean, y - u * 0.85); c.quadraticCurveTo(x + lean + Math.cos(a) * u * 0.28, y - u * 0.85 - u * 0.18 + Math.sin(a) * u * 0.06, x + lean + Math.cos(a) * u * 0.42, y - u * 0.85 + Math.sin(a) * u * 0.18 + u * 0.1); c.stroke();
  }
};

export const deadtree: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx;
  shadow(g, x, y, u * 0.22, 0.16);
  c.strokeStyle = r > 0.5 ? '#4a3d33' : '#5c4c3d'; c.lineCap = 'round';
  c.lineWidth = Math.max(g.hair, u * 0.07);
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r - 0.5) * u * 0.15, y - u * 0.7); c.stroke();
  c.lineWidth = Math.max(g.hair, u * 0.04);
  c.beginPath();
  c.moveTo(x, y - u * 0.3); c.lineTo(x - u * 0.28, y - u * 0.55); c.moveTo(x, y - u * 0.45); c.lineTo(x + u * 0.3, y - u * 0.72);
  c.moveTo(x, y - u * 0.62); c.lineTo(x - u * 0.16, y - u * 0.95); c.stroke();
};

export const peak = (pal: 'rock' | 'dark', snow: boolean): GlyphFn => regPeak((g, x, y, u, r) => {
  const c = g.ctx, w = u * (0.52 + r * 0.14), ax = x + (r - 0.5) * u * 0.22;
  shadow(g, x + w * 0.2, y, w * 1.05, 0.22);
  const L = pal === 'rock' ? pick(ROCK_L, r) : pick(DARK_L, r), D = pal === 'rock' ? pick(ROCK_D, r) : pick(DARK_D, r);
  const ry = x + w * 0.12 + (r - 0.5) * u * 0.1;
  c.fillStyle = L; poly(c, [x - w, y, ax, y - u, ry, y]); c.fill();
  c.fillStyle = D; poly(c, [ax, y - u, x + w, y, ry, y]); c.fill();
  if (snow) {
    const h = 0.34 + r * 0.12;
    c.fillStyle = '#f6f4ee';
    poly(c, [ax - (ax - (x - w)) * h, y - u * (1 - h), ax - (ax - (x - w)) * h * 0.4, y - u * (1 - h) + u * 0.07, ax + (ry - ax) * 0.2, y - u * (1 - h) - u * 0.02, ax, y - u, ax - (ax - (x - w)) * h, y - u * (1 - h)]); c.fill();
    c.fillStyle = '#d6dce6'; poly(c, [ax, y - u, ax + (x + w - ax) * h, y - u * (1 - h), ax + (x + w - ax) * h * 0.5, y - u * (1 - h) + u * 0.05, ax + (ry - ax) * 0.2, y - u * (1 - h) - u * 0.02]); c.fill();
  }
  c.strokeStyle = 'rgba(30,20,12,0.45)'; c.lineWidth = g.hair; c.beginPath(); c.moveTo(x - w, y); c.lineTo(ax, y - u); c.lineTo(x + w, y); c.stroke();
  c.beginPath(); c.moveTo(ax, y - u); c.lineTo(ry, y); c.stroke();
});

export const hills: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, w = u * 0.55;
  c.fillStyle = '#7d9a55'; c.beginPath(); c.ellipse(x + w * 0.45, y - u * 0.08, w * 0.7, u * 0.3, 0, Math.PI, 0); c.fill();
  c.fillStyle = r > 0.5 ? '#93ad62' : '#8aa75c'; c.beginPath(); c.ellipse(x - w * 0.2, y, w, u * 0.46, 0, Math.PI, 0); c.fill();
  c.strokeStyle = 'rgba(40,60,20,0.4)'; c.lineWidth = g.hair; c.beginPath(); c.ellipse(x - w * 0.2, y, w, u * 0.46, 0, Math.PI, 0); c.stroke();
};

export const dune: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, w = u * 0.7;
  c.fillStyle = pick(SAND_D, r); c.globalAlpha *= 0.55;
  c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w * 0.2, y - u * 0.55, x + w * 0.3, y - u * 0.18); c.quadraticCurveTo(x + w * 0.1, y - u * 0.02, x + w, y); c.quadraticCurveTo(x, y + u * 0.12, x - w, y); c.fill();
  c.globalAlpha /= 0.55;
  c.strokeStyle = SAND_L; c.lineWidth = Math.max(g.hair, u * 0.03); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - w * 0.85, y - u * 0.04); c.quadraticCurveTo(x - w * 0.2, y - u * 0.55, x + w * 0.28, y - u * 0.2); c.stroke();
};

export const mesa: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, w = u * 0.55;
  shadow(g, x + w * 0.2, y, w * 1.1, 0.22);
  c.fillStyle = '#b97a4c'; poly(c, [x - w, y, x - w * 0.8, y - u * 0.8, x + w * 0.7, y - u * 0.8, x + w, y]); c.fill();
  c.fillStyle = '#d29a62'; poly(c, [x - w * 0.8, y - u * 0.8, x + w * 0.7, y - u * 0.8, x + w * 0.62, y - u * 0.95, x - w * 0.7, y - u * 0.95]); c.fill();
  c.strokeStyle = 'rgba(80,40,20,0.35)'; c.lineWidth = g.hair;
  for (let k = 1; k < 4; k++) { const yy = y - u * (0.15 + k * 0.17); c.beginPath(); c.moveTo(x - w * (0.95 - k * 0.04), yy); c.lineTo(x + w * (0.95 - k * 0.04), yy); c.stroke(); }
  void r;
};

export const volcano: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, w = u * 0.72;
  if (still(g)) {
  shadow(g, x + w * 0.2, y, w * 1.1, 0.3);
  c.fillStyle = '#3a2d2a'; poly(c, [x - w, y, x - w * 0.22, y - u * 0.88, x + w * 0.22, y - u * 0.88, x + w, y]); c.fill();
  c.fillStyle = '#54413b'; poly(c, [x - w, y, x - w * 0.22, y - u * 0.88, x - w * 0.02, y - u * 0.88, x - w * 0.1, y]); c.fill();
  c.fillStyle = '#ff9a2a'; c.beginPath(); c.ellipse(x, y - u * 0.88, w * 0.22, u * 0.07, 0, 0, TAU); c.fill();
  c.fillStyle = '#ffd36a'; c.beginPath(); c.ellipse(x, y - u * 0.89, w * 0.12, u * 0.035, 0, 0, TAU); c.fill();
  c.strokeStyle = '#ff6a1a'; c.lineWidth = Math.max(g.hair, u * 0.03); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - w * 0.05, y - u * 0.84); c.quadraticCurveTo(x - w * 0.3, y - u * 0.5, x - w * 0.42, y - u * 0.12); c.moveTo(x + w * 0.1, y - u * 0.84); c.quadraticCurveTo(x + w * 0.3, y - u * 0.5, x + w * 0.32, y - u * 0.2); c.stroke();
  }
  if (moving(g)) { // smoke drifts up and fades
    const t = (g.time * 0.12 + r) % 1;
    for (let k = 0; k < 3; k++) {
      const tt = (t + k / 3) % 1;
      c.fillStyle = `rgba(110,100,100,${0.38 * (1 - tt)})`; circle(c, x + tt * u * 0.3 + Math.sin(k * 2 + g.time * 0.4) * u * 0.04, y - u * 0.95 - tt * u * 0.8, u * (0.1 + tt * 0.2));
    }
  }
};

export const spire: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx;
  shadow(g, x, y, u * 0.4, 0.22);
  const n = 2 + Math.floor(r * 2.99);
  for (let k = 0; k < n; k++) {
    const dx = (k - (n - 1) / 2) * u * 0.28, h = u * (0.55 + ((k * 37 + r * 91) % 10) / 22), w = u * 0.12;
    c.fillStyle = pick(BONE, (r * 7 + k * 0.37) % 1); poly(c, [x + dx - w, y, x + dx + (k % 2 ? w * 0.4 : -w * 0.4), y - h, x + dx + w, y]); c.fill();
    c.fillStyle = BONE_D; c.globalAlpha *= 0.55; poly(c, [x + dx, y - h * 0.9, x + dx + w, y, x + dx + w * 0.1, y]); c.fill(); c.globalAlpha /= 0.55;
  }
};

export const boulder: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, w = u * 0.5;
  shadow(g, x, y, w, 0.2);
  c.fillStyle = pick(ROCK_D, r); poly(c, [x - w, y, x - w * 0.8, y - u * 0.5, x - w * 0.1, y - u * 0.72, x + w * 0.7, y - u * 0.5, x + w, y]); c.fill();
  c.fillStyle = pick(ROCK_L, r); poly(c, [x - w * 0.8, y - u * 0.5, x - w * 0.1, y - u * 0.72, x + w * 0.2, y - u * 0.45, x - w * 0.5, y - u * 0.3]); c.fill();
};

export const tuft: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx;
  c.strokeStyle = r > 0.5 ? '#4e8a3c' : '#5f9a46'; c.lineWidth = Math.max(g.hair * 0.9, u * 0.07); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - u * 0.25, y); c.lineTo(x - u * 0.34, y - u * 0.5); c.moveTo(x, y); c.lineTo(x + (r - 0.5) * u * 0.1, y - u * 0.7); c.moveTo(x + u * 0.25, y); c.lineTo(x + u * 0.36, y - u * 0.45); c.stroke();
};

export const crack: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, w = u * 0.9;
  c.strokeStyle = 'rgba(55,35,20,0.7)'; c.lineWidth = Math.max(g.hair, u * 0.05); c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x - w, y); let px = x - w, py = y;
  for (let k = 1; k <= 5; k++) { px = x - w + (w * 2 * k) / 5; py = y + (((r * 977 + k * 61) % 100) / 100 - 0.5) * u * 0.5; c.lineTo(px, py); }
  c.stroke();
  c.lineWidth = Math.max(g.hair * 0.7, u * 0.025); c.beginPath(); c.moveTo(x, y); c.lineTo(x + u * 0.2, y + u * 0.32); c.stroke();
};

export const field: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, w = u * 0.55, h = u * 0.36, sk = u * 0.18;
  const cols = ['#d9c56a', '#b5d070', '#cdae5f', '#9ec45f', '#e0d58a'];
  c.fillStyle = pick(cols, r);
  poly(c, [x - w + sk, y - h, x + w + sk, y - h, x + w - sk, y + h, x - w - sk, y + h]); c.fill();
  c.strokeStyle = 'rgba(70,60,20,0.38)'; c.lineWidth = g.hair * 0.8;
  const rows = 4 + Math.floor(r * 3);
  c.beginPath();
  for (let k = 1; k < rows; k++) { const t = k / rows, yy = y - h + t * h * 2, off = sk * (1 - t * 2); c.moveTo(x - w + off, yy); c.lineTo(x + w + off, yy); }
  c.stroke();
  c.strokeStyle = 'rgba(70,50,20,0.5)'; poly(c, [x - w + sk, y - h, x + w + sk, y - h, x + w - sk, y + h, x - w - sk, y + h]); c.stroke();
};

export const hut: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, w = u * 0.34;
  shadow(g, x, y, w * 1.1, 0.2);
  c.fillStyle = '#e7dcc0'; c.fillRect(x - w, y - u * 0.34, w * 2, u * 0.34);
  c.fillStyle = r > 0.5 ? '#b5523a' : '#9a4a34'; poly(c, [x - w * 1.25, y - u * 0.34, x, y - u * 0.78, x + w * 1.25, y - u * 0.34]); c.fill();
  c.fillStyle = '#6b4a2f'; c.fillRect(x - w * 0.2, y - u * 0.2, w * 0.4, u * 0.2);
};

export const factory: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, w = u * 0.5;
  if (still(g)) {
  shadow(g, x, y, w * 1.2, 0.26);
  c.fillStyle = '#6f6a63'; c.fillRect(x - w, y - u * 0.42, w * 2, u * 0.42);
  c.fillStyle = '#8b857b'; poly(c, [x - w, y - u * 0.42, x - w * 0.3, y - u * 0.62, x - w * 0.3, y - u * 0.42, x + w * 0.4, y - u * 0.62, x + w * 0.4, y - u * 0.42]); c.fill();
  c.fillStyle = '#4e4a46'; c.fillRect(x + w * 0.5, y - u * 0.95, w * 0.34, u * 0.95);
  c.fillStyle = '#ffb347'; c.fillRect(x - w * 0.7, y - u * 0.24, w * 0.3, u * 0.1); c.fillRect(x - w * 0.15, y - u * 0.24, w * 0.3, u * 0.1);
  }
  if (moving(g)) {
    const t = (g.time * 0.1 + r) % 1;
    for (let k = 0; k < 3; k++) { const tt = (t + k / 3) % 1; c.fillStyle = `rgba(70,66,64,${0.45 * (1 - tt)})`; circle(c, x + w * 0.67 + tt * u * 0.5, y - u * 0.98 - tt * u * 0.7, u * (0.08 + tt * 0.2)); }
  }
};

export const mistcurl: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx;
  c.strokeStyle = `rgba(225,232,245,${0.35 + 0.25 * r})`; c.lineWidth = Math.max(g.hair, u * 0.06); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - u * 0.6, y);
  c.bezierCurveTo(x - u * 0.3, y - u * 0.5, x + u * 0.2, y - u * 0.5, x + u * 0.25, y - u * 0.18);
  c.bezierCurveTo(x + u * 0.28, y + u * 0.05, x + u * 0.05, y, x + u * 0.08, y - u * 0.16); c.stroke();
};

export const lamp: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, f = g.pass === 0 ? 1 : 0.75 + 0.25 * Math.sin(g.time * 2 + r * 40);
  c.fillStyle = `rgba(255,210,120,${0.25 * f})`; circle(c, x, y - u * 0.4, u * 0.55);
  c.fillStyle = `rgba(255,225,150,${0.85 * f})`; circle(c, x, y - u * 0.4, u * 0.18);
  c.strokeStyle = '#2a2a33'; c.lineWidth = Math.max(g.hair, u * 0.05); c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - u * 0.4); c.stroke();
};

export const reed: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx;
  c.strokeStyle = r > 0.5 ? '#6f9a6a' : '#5a8a62'; c.lineWidth = Math.max(g.hair * 0.9, u * 0.05); c.lineCap = 'round';
  c.beginPath(); for (let k = -1; k <= 1; k++) { c.moveTo(x + k * u * 0.22, y); c.quadraticCurveTo(x + k * u * 0.26, y - u * 0.4, x + k * u * 0.4 + (r - 0.5) * u * 0.1, y - u * 0.75); } c.stroke();
};

export const lavapool: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, f = g.pass === 0 ? 1 : 0.85 + 0.15 * Math.sin(g.time * 1.5 + r * 30);
  c.fillStyle = `rgba(255,110,30,${0.3 * f})`; c.beginPath(); c.ellipse(x, y, u * 0.75, u * 0.4, 0, 0, TAU); c.fill();
  c.fillStyle = '#c2360c'; c.beginPath(); c.ellipse(x, y, u * 0.5, u * 0.24, 0, 0, TAU); c.fill();
  c.fillStyle = `rgba(255,170,60,${f})`; c.beginPath(); c.ellipse(x - u * 0.06, y - u * 0.02, u * 0.3, u * 0.13, 0, 0, TAU); c.fill();
};

export const ashheap: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx;
  c.fillStyle = '#7b7571'; c.beginPath(); c.ellipse(x, y, u * 0.55, u * 0.28, 0, Math.PI, 0); c.fill();
  c.fillStyle = '#8f8985'; c.beginPath(); c.ellipse(x - u * 0.12, y, u * 0.3, u * 0.17, 0, Math.PI, 0); c.fill();
  void r;
};

export const tent: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, w = u * 0.45;
  shadow(g, x, y, w, 0.2);
  c.fillStyle = r > 0.5 ? '#8a3c30' : '#6d4a36'; poly(c, [x - w, y, x, y - u * 0.6, x + w, y]); c.fill();
  c.fillStyle = '#1a1210'; poly(c, [x - w * 0.18, y, x, y - u * 0.3, x + w * 0.18, y]); c.fill();
  c.strokeStyle = '#3a2a22'; c.lineWidth = Math.max(g.hair, u * 0.04); c.beginPath(); c.moveTo(x, y - u * 0.6); c.lineTo(x, y - u * 0.95); c.stroke();
  c.fillStyle = '#c2362e'; poly(c, [x, y - u * 0.95, x + u * 0.3, y - u * 0.86 + (g.pass === 0 ? 0 : Math.sin(g.time * 3 + r * 9) * u * 0.03), x, y - u * 0.76]); c.fill();
};

export const ruin: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx;
  shadow(g, x, y, u * 0.5, 0.2);
  c.fillStyle = '#a69c8a';
  for (let k = 0; k < 3; k++) { const dx = (k - 1) * u * 0.32, h = u * (0.3 + ((r * 53 + k * 29) % 10) / 20); c.fillRect(x + dx - u * 0.07, y - h, u * 0.14, h); c.fillStyle = '#8a8070'; c.fillRect(x + dx + u * 0.02, y - h, u * 0.05, h); c.fillStyle = '#a69c8a'; }
  c.fillStyle = '#8a8070'; c.fillRect(x - u * 0.55, y - u * 0.06, u * 1.1, u * 0.06);
};

export const tower: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, w = u * 0.2;
  shadow(g, x, y, w * 1.6, 0.2);
  c.fillStyle = '#f1ead6'; c.fillRect(x - w, y - u * 0.55, w * 2, u * 0.55);
  c.fillStyle = '#d6cdb4'; c.fillRect(x + w * 0.2, y - u * 0.55, w * 0.8, u * 0.55);
  c.fillStyle = r > 0.5 ? '#3d78c4' : '#c9a23a'; poly(c, [x - w * 1.3, y - u * 0.55, x, y - u * 1.0, x + w * 1.3, y - u * 0.55]); c.fill();
  c.fillStyle = '#8a6a3a'; c.fillRect(x - w * 0.3, y - u * 0.25, w * 0.6, u * 0.25);
};

export const cloudfarm: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx;
  c.fillStyle = '#f5f8fc'; c.globalAlpha *= 0.85;
  circle(c, x - u * 0.3, y - u * 0.2, u * 0.28); circle(c, x + u * 0.1, y - u * 0.3, u * 0.36); circle(c, x + u * 0.42, y - u * 0.18, u * 0.26); c.fillRect(x - u * 0.3, y - u * 0.2, u * 0.72, u * 0.2);
  c.globalAlpha /= 0.85;
  void r;
};

export const gear: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, R = u * 0.4, n = 8;
  c.fillStyle = 'rgba(60,58,56,0.55)'; c.beginPath();
  for (let k = 0; k < n * 2; k++) { const a = (k / (n * 2)) * TAU + (g.pass === 0 ? r * 6 : g.time * 0.05 * (r > 0.5 ? 1 : -1)), rr = k % 2 ? R * 0.82 : R; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.62); }
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(200,190,170,0.4)'; c.beginPath(); c.ellipse(x, y, R * 0.3, R * 0.19, 0, 0, TAU); c.fill();
};

export const wave: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx;
  c.strokeStyle = `rgba(200,236,240,${0.16 + r * 0.12})`; c.lineWidth = Math.max(g.hair * 0.9, u * 0.07); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - u * 0.5, y); c.quadraticCurveTo(x - u * 0.25, y - u * 0.28, x, y); c.quadraticCurveTo(x + u * 0.25, y + u * 0.28, x + u * 0.5, y); c.stroke();
};

export const ship: GlyphFn = (g, x, y, u, r) => {
  const c = g.ctx, dir = r > 0.5 ? 1 : -1;
  c.fillStyle = 'rgba(8,24,44,0.28)'; c.beginPath(); c.ellipse(x + u * 0.1, y + u * 0.08, u * 0.46, u * 0.09, 0, 0, TAU); c.fill();
  c.fillStyle = '#6b4a2f'; poly(c, [x - u * 0.42 * dir, y - u * 0.16, x + u * 0.42 * dir, y - u * 0.16, x + u * 0.28 * dir, y, x - u * 0.3 * dir, y]); c.fill();
  c.strokeStyle = '#3a2a1c'; c.lineWidth = Math.max(g.hair, u * 0.03); c.beginPath(); c.moveTo(x, y - u * 0.16); c.lineTo(x, y - u * 0.85); c.stroke();
  c.fillStyle = '#f4efe2'; poly(c, [x + u * 0.04 * dir, y - u * 0.8, x + u * 0.4 * dir, y - u * 0.26, x + u * 0.04 * dir, y - u * 0.26]); c.fill();
  c.fillStyle = '#e1d9c3'; poly(c, [x - u * 0.04 * dir, y - u * 0.7, x - u * 0.34 * dir, y - u * 0.26, x - u * 0.04 * dir, y - u * 0.26]); c.fill();
  c.strokeStyle = 'rgba(230,248,250,0.7)'; c.lineWidth = Math.max(g.hair * 0.8, u * 0.025); c.beginPath(); c.moveTo(x - u * 0.5 * dir, y + u * 0.02); c.lineTo(x - u * 0.9 * dir, y + u * 0.04); c.stroke();
};

// ---- sprite metadata: the box a glyph can paint into (in units of u: half width, height above, depth below) and whether part of it moves ----
export interface Meta { box: [number, number, number]; anim?: boolean }
const DEF_BOX: [number, number, number] = [0.95, 1.4, 0.3];
export const META = new Map<GlyphFn, Meta>();
const reg = (fn: GlyphFn, box: [number, number, number] = DEF_BOX, anim = false) => META.set(fn, { box, anim });
[oak, pine, jungle, palm, deadtree, hills, dune, mesa, spire, boulder, tuft, crack, field, hut, mistcurl, reed, ashheap, ruin, tower, cloudfarm, wave].forEach((f) => reg(f));
reg(ship, [1.0, 1.1, 0.25]); reg(volcano, [1.0, 2.1, 0.3], true); reg(factory, [1.4, 2.2, 0.3], true); reg(lamp, [0.8, 1.0, 0.2], true); reg(lavapool, [0.9, 0.5, 0.5], true); reg(tent, [0.9, 1.4, 0.3], true); reg(gear, [1.0, 0.8, 0.8]);
export const regPeak = (fn: GlyphFn) => { reg(fn, [0.8, 1.15, 0.3]); return fn; };
