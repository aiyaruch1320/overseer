// The god's blessing (20-god-ui.md §1: a light that tries to come through thick cloud, its edge shaking like a flame in the wind) made
// five ways over the same figure: CSS, an SVG filter, pixels on a canvas, WebGL particles, and a flipbook baked from the canvas one.
import { COLS, frameIndex, type Sheet } from './pixel';

const S = 220; // the panel
const Z = 4; // the figure's zoom
const GOLD = '#e8c36a';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function panel(host: HTMLElement, title: string, note: string): HTMLDivElement {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.innerHTML = `<h3>${title}</h3>`;
  const box = document.createElement('div');
  box.style.cssText = `position:relative;width:${S}px;height:${S}px;overflow:hidden;background:#1a1c26;border-radius:4px`;
  cell.append(box);
  cell.insertAdjacentHTML('beforeend', `<div class="note">${note}</div>`);
  host.append(cell);
  return box;
}

function figure(box: HTMLElement, sheet: Sheet): void {
  const c = document.createElement('canvas');
  c.width = sheet.fw; c.height = sheet.fh;
  const idx = frameIndex('idle', 0);
  c.getContext('2d')!.drawImage(sheet.canvas, (idx % COLS) * sheet.fw, Math.floor(idx / COLS) * sheet.fh, sheet.fw, sheet.fh, 0, 0, sheet.fw, sheet.fh);
  c.style.cssText = `position:absolute;left:${S / 2 - (sheet.fw * Z) / 2}px;top:${S - 30 - sheet.fh * Z}px;width:${sheet.fw * Z}px;image-rendering:pixelated;z-index:1`;
  box.append(c);
}

// ── 1 · CSS ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function cssFx(box: HTMLElement, n: number): () => void {
  const style = document.createElement('style');
  style.textContent = `
@keyframes fx-flick{0%,100%{opacity:.75;transform:translateX(-50%) scaleX(1)}30%{opacity:.95;transform:translateX(-50%) scaleX(1.08)}60%{opacity:.7;transform:translateX(-50%) scaleX(.94)}}
@keyframes fx-rise{from{transform:translate(0,0);opacity:1}to{transform:translate(var(--dx),-170px);opacity:0}}
.fx-col{position:absolute;left:50%;top:0;bottom:30px;width:70px;background:linear-gradient(to right,transparent,${GOLD}88 30%,#fff2c0cc 50%,${GOLD}88 70%,transparent);filter:blur(4px);mix-blend-mode:screen;animation:fx-flick .9s ease-in-out infinite;z-index:2}
.fx-em{position:absolute;bottom:34px;width:4px;height:4px;border-radius:50%;background:#ffe6a0;box-shadow:0 0 6px ${GOLD};animation:fx-rise linear infinite;z-index:2}`;
  box.append(style);
  const col = document.createElement('div');
  col.className = 'fx-col';
  box.append(col);
  const r = rng(1);
  for (let i = 0; i < n; i++) {
    const e = document.createElement('div');
    e.className = 'fx-em';
    e.style.cssText = `left:${S / 2 - 30 + r() * 60}px;--dx:${(r() - 0.5) * 40}px;animation-duration:${1.6 + r() * 1.4}s;animation-delay:-${r() * 3}s`;
    box.append(e);
  }
  return () => {};
}

// ── 2 · SVG with a turbulence filter that shakes the edge ──────────────────────────────────────────────────────────────────────────
function svgFx(box: HTMLElement, n: number): () => void {
  const r = rng(2);
  const em = Array.from({ length: n }, () => {
    const x = S / 2 - 30 + r() * 60, d = 1.6 + r() * 1.4;
    return `<circle cx="${x}" cy="${S - 34}" r="2" fill="#ffe6a0"><animate attributeName="cy" from="${S - 34}" to="${S - 200}" dur="${d}s" begin="-${r() * 3}s" repeatCount="indefinite"/><animate attributeName="opacity" from="1" to="0" dur="${d}s" begin="-${r() * 3}s" repeatCount="indefinite"/></circle>`;
  }).join('');
  box.insertAdjacentHTML('beforeend', `<svg width="${S}" height="${S}" style="position:absolute;inset:0;z-index:2;mix-blend-mode:screen">
  <defs>
    <linearGradient id="fxg" x1="0" x2="1"><stop offset="0" stop-color="${GOLD}" stop-opacity="0"/><stop offset=".5" stop-color="#fff2c0" stop-opacity=".85"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></linearGradient>
    <filter id="fxf" x="-50%" y="0" width="200%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.09" numOctaves="2" seed="3"><animate attributeName="baseFrequency" values="0.02 0.09;0.03 0.12;0.02 0.09" dur="1.2s" repeatCount="indefinite"/></feTurbulence>
      <feDisplacementMap in="SourceGraphic" scale="18"/><feGaussianBlur stdDeviation="1.5"/>
    </filter>
  </defs>
  <rect x="${S / 2 - 35}" y="0" width="70" height="${S - 30}" fill="url(#fxg)" filter="url(#fxf)"/>
  ${em}
</svg>`);
  return () => {};
}

// ── 3 · Canvas pixels: the light at the art's own resolution, embers as single pixels ──────────────────────────────────────────────
function paintPixelFx(c: CanvasRenderingContext2D, w: number, h: number, t: number, embers: { x: number; y: number; v: number; l: number }[], r: () => number, n: number, step: number): void {
  c.clearRect(0, 0, w, h);
  c.globalCompositeOperation = 'lighter';
  const cx = w / 2;
  for (let y = 0; y < h - 7; y++) {
    const wob = Math.round(Math.sin(y * 0.4 + t / 90) * 1.2 + Math.sin(y * 0.13 - t / 150) * 1.4);
    const half = 7 + wob;
    c.fillStyle = 'rgba(232,195,106,0.4)'; c.fillRect(Math.round(cx - half), y, half * 2, 1);
    c.fillStyle = 'rgba(255,240,190,0.55)'; c.fillRect(Math.round(cx - half / 2), y, Math.round(half), 1);
  }
  c.globalCompositeOperation = 'source-over';
  while (embers.length < n) embers.push({ x: cx + (r() - 0.5) * 16, y: h - 8, v: 8 + r() * 12, l: 1 + r() * 2 });
  for (const e of embers) { e.y -= e.v * step; e.x += (r() - 0.5) * 0.6; e.l -= step; }
  for (let i = embers.length - 1; i >= 0; i--) if (embers[i].l <= 0) embers.splice(i, 1);
  for (const e of embers) { c.fillStyle = e.l > 0.8 ? '#ffe6a0' : GOLD; c.fillRect(Math.round(e.x), Math.round(e.y), 1, 1); }
}

function canvasFx(box: HTMLElement, n: number, report: (ms: number) => void): () => void {
  const w = S / Z, h = S / Z;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.style.cssText = `position:absolute;inset:0;width:${S}px;height:${S}px;image-rendering:pixelated;z-index:2;mix-blend-mode:screen`;
  box.append(cv);
  const c = cv.getContext('2d')!, r = rng(3), embers: { x: number; y: number; v: number; l: number }[] = [];
  let id = 0;
  const tick = (now: number) => {
    const t0 = performance.now();
    paintPixelFx(c, w, h, now, embers, r, Math.round(n / 3), 1 / 60);
    report(performance.now() - t0);
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}

// ── 4 · WebGL particles (Phaser), added light ──────────────────────────────────────────────────────────────────────────────────────
async function webglFx(box: HTMLElement, n: number): Promise<() => void> {
  const Phaser = (await import('phaser')).default;
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;inset:0;z-index:2;mix-blend-mode:screen';
  box.append(host);
  const game = new Phaser.Game({
    type: Phaser.WEBGL, parent: host, width: S, height: S, transparent: true, banner: false, audio: { noAudio: true },
    scene: {
      create(this: Phaser.Scene) {
        const g = this.make.graphics({ x: 0, y: 0 }, false);
        for (let i = 8; i > 0; i--) { g.fillStyle(0xffe6a0, 0.12); g.fillCircle(8, 8, i); }
        g.generateTexture('soft', 16, 16);
        g.clear(); g.fillStyle(0xe8c36a, 1); g.fillRect(0, 0, 4, 4); g.generateTexture('px', 4, 4);
        this.add.particles(S / 2, S - 30, 'soft', { x: { min: -28, max: 28 }, speedY: { min: -60, max: -110 }, scale: { start: 2.4, end: 0.6 }, alpha: { start: 0.5, end: 0 }, lifespan: 2000, frequency: 40, blendMode: 'ADD' });
        this.add.particles(S / 2, S - 34, 'px', { x: { min: -28, max: 28 }, speedY: { min: -50, max: -100 }, speedX: { min: -8, max: 8 }, alpha: { start: 1, end: 0 }, lifespan: 2400, quantity: 1, frequency: Math.max(4, 2400 / n), blendMode: 'ADD' });
      },
    },
  });
  return () => game.destroy(true);
}

// ── 5 · flipbook: the canvas effect baked into 16 frames of a PNG, played by CSS ───────────────────────────────────────────────────
async function bitmapFx(box: HTMLElement, n: number): Promise<{ stop: () => void; bytes: number }> {
  const w = S / Z, h = S / Z, N = 16;
  const sheet = document.createElement('canvas');
  sheet.width = w * N; sheet.height = h;
  const sc = sheet.getContext('2d')!;
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tc = tmp.getContext('2d')!, r = rng(4), embers: { x: number; y: number; v: number; l: number }[] = [];
  for (let k = 0; k < 80; k++) paintPixelFx(tc, w, h, k * 66, embers, r, Math.round(n / 3), 1 / 15); // warm up the embers
  for (let k = 0; k < N; k++) { paintPixelFx(tc, w, h, k * 66, embers, r, Math.round(n / 3), 1 / 15); sc.drawImage(tmp, k * w, 0); }
  const blob = await new Promise<Blob>((ok) => sheet.toBlob((b) => ok(b!), 'image/png'));
  const url = URL.createObjectURL(blob);
  const style = document.createElement('style');
  style.textContent = `@keyframes fx-book{from{background-position-x:0}to{background-position-x:-${S * N}px}}`;
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;inset:0;z-index:2;background:url(${url}) 0 0/${S * N}px ${S}px no-repeat;image-rendering:pixelated;mix-blend-mode:screen;animation:fx-book ${N * 66}ms steps(${N}) infinite`;
  box.append(style, el);
  return { stop: () => URL.revokeObjectURL(url), bytes: blob.size };
}

export async function mountEffects(el: HTMLElement, sheets: Sheet[], report: (f: () => number) => void): Promise<() => void> {
  el.insertAdjacentHTML('beforeend', `<p>พรของพระเจ้า: แสงที่พยายามลอดผ่านเมฆหนา ขอบสั่นเหมือนเปลวโดนลม (20-god-ui.md §1) ทำ 5 แบบบนตัวละครตัวเดียวกัน</p>
  <div class="ctl"><label>เปิด <select id="fxon"><option value="all">ทั้งหมด</option><option value="0">1 · CSS</option><option value="1">2 · SVG filter</option><option value="2">3 · Canvas พิกเซล</option><option value="3">4 · WebGL particles</option><option value="4">5 · ภาพสำเร็จ (flipbook)</option></select></label>
  <label>ถ่านลอย <select id="fxn"><option>30</option><option selected>90</option><option>600</option></select> เม็ด</label></div>`);
  const grid = document.createElement('div');
  grid.className = 'grid';
  el.append(grid);
  const hero = sheets[4];
  let stops: (() => void)[] = [], cv = 0;
  report(() => cv);
  const build = async () => {
    stops.forEach((s) => s());
    stops = [];
    grid.replaceChildren();
    const on = (el.querySelector('#fxon') as HTMLSelectElement).value, n = Number((el.querySelector('#fxn') as HTMLSelectElement).value);
    const want = (k: number) => on === 'all' || on === String(k);
    const notes = [
      'ไล่สี + blur + mix-blend ถ่านแต่ละเม็ดเป็น div ที่ CSS animation พาลอย',
      'gradient ผ่าน feTurbulence + feDisplacementMap ให้ขอบสั่นจริง ถ่านเป็น SMIL',
      'วาดที่ความละเอียดของพิกเซลศิลป์ (55×55) แล้วขยาย เข้ากับตัวละครที่สุด',
      'particle emitter ของ Phaser แสงบวกกัน (ADD) ทำงานบน GPU',
      'อบผลของแบบ 3 เป็น 16 เฟรมใน PNG เล่นด้วย CSS steps() วนซ้ำเหมือนเดิมทุกรอบ',
    ];
    const titles = ['1 · CSS', '2 · SVG filter', '3 · Canvas พิกเซล', '4 · WebGL particles', '5 · ภาพสำเร็จ (flipbook)'];
    for (let k = 0; k < 5; k++) {
      if (!want(k)) continue;
      const box = panel(grid, titles[k], notes[k]);
      figure(box, hero);
      if (k === 0) stops.push(cssFx(box, n));
      if (k === 1) stops.push(svgFx(box, n));
      if (k === 2) stops.push(canvasFx(box, n, (ms) => (cv = ms)));
      if (k === 3) stops.push(await webglFx(box, n));
      if (k === 4) {
        const b = await bitmapFx(box, n);
        stops.push(b.stop);
        box.parentElement!.querySelector('.note')!.insertAdjacentText('beforeend', ` · ไฟล์ ${(b.bytes / 1024).toFixed(1)} KB`);
      }
    }
  };
  (el.querySelector('#fxon') as HTMLSelectElement).onchange = () => void build();
  (el.querySelector('#fxn') as HTMLSelectElement).onchange = () => void build();
  await build();
  return () => stops.forEach((s) => s());
}
