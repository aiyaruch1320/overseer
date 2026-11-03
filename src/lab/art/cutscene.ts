// A cut scene of the lab: a canvas of 320 × 180 art pixels shown at a whole multiple, a timeline of beats (walk in, a wolf, a strike, the
// god's light, the wolf runs, fade), parallax layers painted once, the same sprites, and Thai words in the DOM over it (crisp at any size).
import { COLS, FRAME_MS, FRAME_N, frameIndex, type Anim, type Sheet } from './pixel';

const W = 320, H = 180, GROUND = 150;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function layer(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  return cv;
}

/** A ridge of hills as a pixel silhouette with a lighter top edge. */
function ridge(c: CanvasRenderingContext2D, w: number, base: number, amp: number, seed: number, col: string, top: string): void {
  const r = rng(seed);
  const pts = Array.from({ length: 12 }, () => r());
  for (let x = 0; x < w; x++) {
    const t = (x / w) * 11, i = Math.floor(t), f = t - i, s = f * f * (3 - 2 * f);
    const y = Math.round(base - amp * (pts[i] + (pts[i + 1] - pts[i]) * s) - Math.sin(x / 7 + seed) * 1.5);
    c.fillStyle = top; c.fillRect(x, y, 1, 1);
    c.fillStyle = col; c.fillRect(x, y + 1, 1, H - y);
  }
}

const SKY = ['#2a2f52', '#3e4670', '#5e5e86', '#8a7690', '#c08a7a'];

function backgrounds() {
  const sky = layer(W, H, (c) => {
    // bands of the evening sky with a dithered seam between them
    const band = 26;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = Math.min(SKY.length - 1, Math.floor((y + ((x + y) % 2 ? 3 : 0)) / band));
      c.fillStyle = SKY[k]; c.fillRect(x, y, 1, 1);
    }
    const r = rng(3);
    c.fillStyle = '#e6e0d0';
    for (let i = 0; i < 40; i++) c.fillRect(Math.floor(r() * W), Math.floor(r() * 60), 1, 1);
  });
  const far = layer(W * 2, H, (c) => ridge(c, W * 2, 118, 40, 1, '#4a4a6e', '#5e5e84'));
  const mid = layer(W * 3, H, (c) => ridge(c, W * 3, 138, 26, 2, '#3e5a48', '#4e6e52'));
  const ground = layer(W * 4, H, (c) => {
    c.fillStyle = '#4e6e3a'; c.fillRect(0, GROUND - 6, W * 4, H);
    c.fillStyle = '#5e7e44'; c.fillRect(0, GROUND - 6, W * 4, 1);
    const r = rng(8);
    for (let i = 0; i < 500; i++) { c.fillStyle = r() < 0.5 ? '#3e5a2e' : '#6a8a4a'; c.fillRect(Math.floor(r() * W * 4), GROUND - 4 + Math.floor(r() * 30), 1 + Math.floor(r() * 2), 1); }
    c.fillStyle = '#8a7a5a'; c.fillRect(0, GROUND + 2, W * 4, 6);
    c.fillStyle = '#9a8a66'; c.fillRect(0, GROUND + 2, W * 4, 1);
  });
  return { sky, far, mid, ground };
}

interface Spark { x: number; y: number; vx: number; vy: number; life: number; col: string }

export async function mountCutscene(el: HTMLElement, sheets: Sheet[], report: (f: () => number) => void): Promise<() => void> {
  el.insertAdjacentHTML('beforeend', `<p>แคนวาสขนาด 320×180 พิกเซลศิลป์ ขยายเป็นเท่าเต็ม ภาพพื้นหลังสี่ชั้นเลื่อนช้าเร็วต่างกัน (parallax) ตัวละครเดียวกับข้างบน
  เอฟเฟกต์เป็นพิกเซล (ประกายตอนฟัน แสงศรัทธาที่ขอบสั่น ถ่านลอย) ข้อความไทยเป็น DOM ซ้อนบน จึงคมทุกขนาด ทั้งฉากเป็นสคริปต์เวลา ไม่ใช่โค้ดต่อฉาก</p>
  <div class="ctl"><button id="cplay">เล่นอีกครั้ง</button><label>ขยาย <select id="cscale"><option>2</option><option>3</option><option selected>4</option></select>×</label></div>`);
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;display:inline-block';
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  cv.style.cssText = 'image-rendering:pixelated;display:block';
  const words = document.createElement('div');
  words.style.cssText = 'position:absolute;left:0;right:0;bottom:8%;text-align:center;font-size:22px;color:#f4e6c0;text-shadow:0 2px 0 #0008;opacity:0;transition:opacity .4s';
  wrap.append(cv, words);
  el.append(wrap);
  const setScale = (k: number) => { cv.style.width = `${W * k}px`; cv.style.height = `${H * k}px`; };
  setScale(4);
  (el.querySelector('#cscale') as HTMLSelectElement).onchange = (e) => setScale(Number((e.target as HTMLSelectElement).value));
  const c = cv.getContext('2d')!;
  const bg = backgrounds();
  const hero = sheets[4], wolf = sheets[8];
  const flash = document.createElement('canvas');
  flash.width = wolf.fw; flash.height = wolf.fh;
  const fc = flash.getContext('2d')!;
  let start = performance.now(), sparks: Spark[] = [], embers: Spark[] = [], hitDone = false, cost = 0, id = 0;
  report(() => cost);
  (el.querySelector('#cplay') as HTMLButtonElement).onclick = () => { start = performance.now(); sparks = []; embers = []; hitDone = false; };
  const r = rng(4);

  const sprite = (s: Sheet, a: Anim, t: number, x: number, flip: boolean, white = false) => {
    const idx = frameIndex(a, Math.floor(t / FRAME_MS[a]) % FRAME_N[a]);
    const sx = (idx % COLS) * s.fw, sy = Math.floor(idx / COLS) * s.fh, y = GROUND + 4 - s.fh;
    let src: CanvasImageSource = s.canvas, ox = sx, oy = sy;
    if (white) {
      fc.clearRect(0, 0, s.fw, s.fh);
      fc.globalCompositeOperation = 'source-over';
      fc.drawImage(s.canvas, sx, sy, s.fw, s.fh, 0, 0, s.fw, s.fh);
      fc.globalCompositeOperation = 'source-atop';
      fc.fillStyle = '#ffffff'; fc.fillRect(0, 0, s.fw, s.fh);
      src = flash; ox = 0; oy = 0;
    }
    c.save();
    if (flip) { c.translate(Math.round(x) + s.fw, y); c.scale(-1, 1); c.drawImage(src, ox, oy, s.fw, s.fh, 0, 0, s.fw, s.fh); }
    else c.drawImage(src, ox, oy, s.fw, s.fh, Math.round(x), y, s.fw, s.fh);
    c.restore();
  };

  const tick = (now: number) => {
    const t0 = performance.now();
    const t = (now - start) / 1000;
    const ease = (a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
    // camera: a slow pan, a shake on the strike
    const pan = 60 * ease(0, 3);
    const shake = t > 3.2 && t < 3.5 ? Math.round((r() - 0.5) * 6) : 0;
    c.imageSmoothingEnabled = false;
    c.drawImage(bg.sky, 0, 0);
    c.drawImage(bg.far, -Math.round(pan * 0.2) + shake, 0);
    c.drawImage(bg.mid, -Math.round(pan * 0.5) + shake, 0);
    c.drawImage(bg.ground, -Math.round(pan) + shake, 0);
    // the hero walks in, strikes, stands in the light
    const hx = -40 + 170 * ease(0, 2.6) - pan * 0 + shake;
    const ha: Anim = t < 2.6 ? 'walk' : t >= 3.0 && t < 3.45 ? 'attack' : 'idle';
    // the wolf comes from the right, is struck, runs off
    const wIn = ease(1.4, 3.0), wBack = ease(3.2, 3.5), wOut = ease(6.4, 7.8);
    const wx = 360 - 192 * wIn + 14 * wBack + 220 * wOut + shake;
    const wa: Anim = t < 3.0 ? 'walk' : t < 3.3 ? 'attack' : t < 6.4 ? 'idle' : 'walk';
    sprite(wolf, wa, (t - 1.4) * 1000, wx, t < 6.4, t > 3.2 && t < 3.32);
    sprite(hero, ha, ha === 'attack' ? (t - 3.0) * 1000 : t * 1000, hx, false);
    if (t > 3.2 && !hitDone) {
      hitDone = true;
      for (let i = 0; i < 26; i++) sparks.push({ x: wx + 14, y: GROUND - 14, vx: (r() - 0.2) * 90, vy: -r() * 80, life: 0.5 + r() * 0.3, col: r() < 0.5 ? '#fff4c0' : '#e8c36a' });
    }
    // the god's light: a column from the top that comes down, its edges shaking like a flame in the wind
    const L = ease(4.0, 4.5) * (1 - ease(6.2, 6.8));
    if (L > 0) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      const cx = hx + 18, reach = (GROUND + 4) * ease(4.0, 4.5);
      for (let y = 0; y < reach; y++) {
        const wob = Math.round(Math.sin(y * 0.35 + now / 90) * 1.2 + Math.sin(y * 0.11 - now / 160) * 1.5);
        const half = 9 + wob + Math.floor((y / H) * 5);
        c.fillStyle = `rgba(232,195,106,${0.18 * L})`; c.fillRect(Math.round(cx - half), y, half * 2, 1);
        c.fillStyle = `rgba(255,236,170,${0.22 * L})`; c.fillRect(Math.round(cx - half / 2), y, half, 1);
      }
      c.restore();
      if (r() < 0.6 * L) embers.push({ x: cx + (r() - 0.5) * 18, y: GROUND, vx: (r() - 0.5) * 6, vy: -18 - r() * 22, life: 1.5 + r(), col: r() < 0.5 ? '#ffe6a0' : '#e8c36a' });
      c.fillStyle = `rgba(232,160,90,${0.12 * L})`; c.fillRect(0, 0, W, H);
    }
    // sparks and embers, whole pixels
    const dt = 1 / 60;
    for (const list of [sparks, embers]) {
      for (const p of list) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += list === sparks ? 220 * dt : 0; p.life -= dt; }
      for (const p of list) if (p.life > 0) { c.fillStyle = p.col; c.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    }
    sparks = sparks.filter((p) => p.life > 0); embers = embers.filter((p) => p.life > 0);
    // fade in and out
    const fade = Math.max(1 - ease(0, 0.6), ease(7.6, 8.2));
    if (fade > 0) { c.fillStyle = `rgba(8,8,14,${fade})`; c.fillRect(0, 0, W, H); }
    words.textContent = t > 3.6 && t < 4.2 ? 'หมาป่าถอยไปหนึ่งก้าว' : 'แสงศรัทธาลอดผ่านเมฆลงมาที่เขา';
    words.style.opacity = (t > 3.6 && t < 4.1) || (t > 4.4 && t < 6.6) ? '1' : '0';
    if (t > 9) { start = now; hitDone = false; }
    cost = performance.now() - t0;
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}
