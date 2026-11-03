// The map of the lab: the ground is painted once per pixel from noise (water, a dithered coast, grass, roads) into one texture, trees and
// houses come from the same painter as the people (so they get the same shading and outline), and Phaser shows it all with a camera that
// zooms and pans and with people walking about. This is the way the game's code-drawn map already works (src/map), in the pixel look.
import { COLS, FRAME_MS, FRAME_N, frameCanvas, frameIndex, Paint, type Sheet } from './pixel';

const TW = 96, TH = 60, T = 16; // tiles of 16 art pixels
const MW = TW * T, MH = TH * T;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Value noise with a few octaves, 0..1. */
function noise(seed: number) {
  const r = rng(seed), g = new Float32Array(257 * 257).map(() => r());
  const at = (x: number, y: number) => g[(((y % 256) + 256) % 256) * 257 + (((x % 256) + 256) % 256)];
  const one = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx, b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
  return (x: number, y: number) => (one(x, y) * 0.55 + one(x * 2.1, y * 2.1) * 0.28 + one(x * 4.3, y * 4.3) * 0.17);
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const PAL = {
  deep: hex('#2a4f7e'), water: hex('#3a6e9e'), shallow: hex('#5a96b8'), foam: hex('#cfe4ea'),
  sand: hex('#d6c08a'), sandD: hex('#c2a872'),
  grass: [hex('#4e7e34'), hex('#5a8a3a'), hex('#66964a')], forest: hex('#3e6a2e'),
  road: hex('#a88a5c'), roadD: hex('#8c7048'),
};

interface World { ground: HTMLCanvasElement; objects: { img: HTMLCanvasElement; x: number; y: number }[]; walkable: (x: number, y: number) => boolean }

function makeWorld(): World {
  const h = noise(11), d = noise(23), f = noise(37);
  const cv = document.createElement('canvas');
  cv.width = MW; cv.height = MH;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(MW, MH), px = img.data;
  const height = (x: number, y: number) => {
    const e = h(x / 260, y / 260);
    const edge = Math.min(x, y, MW - x, MH - y) / 220; // the sea around the land
    return e * 0.9 + Math.min(1, edge) * 0.35 - 0.12;
  };
  // roads: a few bent lines between villages
  const villages: [number, number][] = [[520, 330], [930, 470], [1180, 250], [700, 700]];
  const roadAt = new Uint8Array(MW * MH);
  const r = rng(5);
  for (let k = 0; k < villages.length - 1; k++) {
    const [ax, ay] = villages[k], [bx, by] = villages[k + 1];
    const n = Math.hypot(bx - ax, by - ay);
    for (let i = 0; i <= n; i++) {
      const t = i / n, bend = Math.sin(t * Math.PI) * 40 * (k % 2 ? 1 : -1);
      const x = ax + (bx - ax) * t - ((by - ay) / n) * bend, y = ay + (by - ay) * t + ((bx - ax) / n) * bend;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9 + r() * 4) roadAt[Math.round(y + dy) * MW + Math.round(x + dx)] = dx * dx + dy * dy > 6 ? 2 : 1;
    }
  }
  const land = new Uint8Array(MW * MH);
  for (let y = 0; y < MH; y++)
    for (let x = 0; x < MW; x++) {
      const e = height(x, y), b = BAYER[(y & 3) * 4 + (x & 3)], i = (y * MW + x) * 4;
      let c: [number, number, number];
      if (e < 0.36) c = e < 0.3 - b * 0.04 ? PAL.deep : PAL.water;
      else if (e < 0.4) c = e < 0.38 - b * 0.02 ? PAL.water : PAL.shallow;
      else if (e < 0.405) c = PAL.foam;
      else if (e < 0.44) c = e < 0.425 + b * 0.012 ? PAL.sand : PAL.sandD;
      else {
        land[y * MW + x] = 1;
        const g = d(x / 40, y / 40) + (b - 0.5) * 0.18, fo = f(x / 120, y / 120);
        c = fo > 0.62 ? PAL.forest : PAL.grass[g < 0.42 ? 0 : g < 0.6 ? 1 : 2];
        const rd = roadAt[y * MW + x];
        if (rd) c = rd === 1 ? PAL.road : PAL.roadD;
      }
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);

  // objects: houses in the villages, trees in the woods, all painted with shading and an outline
  const objects: World['objects'] = [];
  const houseImgs = [['#b0483a', '#d8c8a0'], ['#5a6a8a', '#c8b890'], ['#7a5a3a', '#e0d0b0']].map(([roof, wall]) => house(roof, wall));
  const treeImgs = [tree('#3e7a34', 0), tree('#4a8a3a', 1), tree('#2e6a3a', 2)];
  const taken = (x: number, y: number) => roadAt[Math.round(y) * MW + Math.round(x)] || !land[Math.round(y) * MW + Math.round(x)];
  for (const [vx, vy] of villages)
    for (let k = 0; k < 7; k++) {
      const x = vx + (r() - 0.5) * 160, y = vy + (r() - 0.5) * 110;
      if (taken(x, y) || taken(x + 30, y)) continue;
      objects.push({ img: houseImgs[k % 3], x, y });
    }
  for (let k = 0; k < 1400; k++) {
    const x = r() * MW, y = r() * MH;
    if (taken(x, y) || f(x / 120, y / 120) < 0.55 + r() * 0.1) continue;
    if (villages.some(([vx, vy]) => Math.hypot(vx - x, vy - y) < 110)) continue;
    objects.push({ img: treeImgs[k % 3], x, y });
  }
  return { ground: cv, objects: objects.sort((a, b) => a.y - b.y), walkable: (x, y) => !!land[Math.round(y) * MW + Math.round(x)] };
}

function tree(leaf: string, v: number): HTMLCanvasElement {
  const p = new Paint(18, 26);
  const L = p.mat(leaf), W = p.mat('#6a4a2e');
  p.rect(8, 17, 3, 7, W);
  p.ell(9, 11 - v, 7, 7 - v * 0.3, L);
  p.ell(6, 8 - v, 4, 4, L);
  p.ell(12, 9 - v, 4, 4, L);
  return frameCanvas(p.finish({ cx: 9.5, cy: 24, rx: 6, ry: 1.6 }));
}

function house(roof: string, wall: string): HTMLCanvasElement {
  const p = new Paint(34, 32);
  const R = p.mat(roof), Wl = p.mat(wall), D = p.mat('#5a3a24'), G = p.mat('#2a3a4a', { flat: true }), Ch = p.mat('#7a6a60');
  p.rect(4, 15, 26, 14, Wl);
  p.rect(23, 4, 3, 7, Ch);
  p.poly([[1, 16], [10, 5], [24, 5], [33, 16]], R);
  p.rect(14, 21, 5, 8, D);
  p.rect(7, 19, 4, 3, G);
  p.rect(23, 19, 4, 3, G);
  return frameCanvas(p.finish({ cx: 17, cy: 29, rx: 16, ry: 2.2 }));
}

let world: World | null = null;

export async function mountMap(el: HTMLElement, sheets: Sheet[], report: (f: () => number) => void): Promise<() => void> {
  el.insertAdjacentHTML('beforeend', `<p>พื้นวาดด้วยโค้ดทีละพิกเซลครั้งเดียว (ทะเล ชายฝั่งแบบจุดกระจาย หญ้า ป่า ถนน) แล้วเป็น texture เดียว บ้านและต้นไม้ใช้ตัววาดเดียวกับตัวละคร
  Phaser แสดงด้วยกล้อง ล้อเมาส์ซูม ลากเพื่อเลื่อน <span class="dim">ซูมต่ำกว่า 1× จะเห็นพิกเซลกระพริบ (ภาพย่อแบบไม่เกลี่ย) ระดับโลกและทวีปจึงต้องมีภาพย่อของตัวเอง</span></p>
  <div class="ctl"><label>คนเดิน <select id="mn">${[50, 300, 1500].map((n) => `<option ${n === 300 ? 'selected' : ''}>${n}</option>`).join('')}</select></label> <b id="mz"></b></div>`);
  const host = document.createElement('div');
  host.style.cssText = 'width:1240px;height:560px;border:1px solid #2a2c36';
  el.append(host);
  const t0 = performance.now();
  world ??= makeWorld();
  const built = performance.now() - t0;
  el.querySelector('#mz')!.insertAdjacentText('beforebegin', `สร้างพื้นและวัตถุ ${built.toFixed(0)} ms · `);
  const Phaser = (await import('phaser')).default;
  const people = sheets.slice(0, 8);
  let cost = 0;
  report(() => cost);
  const game = new Phaser.Game({
    type: Phaser.WEBGL, parent: host, width: 1240, height: 560, backgroundColor: '#2a4f7e', banner: false, audio: { noAudio: true },
    render: { pixelArt: true, antialias: false, roundPixels: false },
    scene: {
      create(this: Phaser.Scene) {
        const w = world!;
        this.textures.addCanvas('ground', w.ground);
        this.add.image(0, 0, 'ground').setOrigin(0, 0).setDepth(-1);
        const keys = new Map<HTMLCanvasElement, string>();
        w.objects.forEach((o, k) => {
          let key = keys.get(o.img);
          if (!key) { key = `obj${k}`; this.textures.addCanvas(key, o.img); keys.set(o.img, key); }
          this.add.image(o.x, o.y, key).setOrigin(0.5, 0.92).setDepth(o.y);
        });
        people.forEach((s, k) => {
          const t = this.textures.addCanvas(`p${k}`, s.canvas)!;
          for (let i = 0; i < COLS * 3; i++) t.add(i, 0, (i % COLS) * s.fw, Math.floor(i / COLS) * s.fh, s.fw, s.fh);
        });
        const r = rng(9);
        type P = { img: Phaser.GameObjects.Image; tx: number; ty: number; rest: number; s: number; t0: number };
        let ps: P[] = [];
        const spawn = (n: number) => {
          ps.forEach((p) => p.img.destroy());
          ps = [];
          while (ps.length < n) {
            const x = 300 + r() * (MW - 600), y = 200 + r() * (MH - 400);
            if (!w.walkable(x, y)) continue;
            const s = ps.length % people.length;
            ps.push({ img: this.add.image(x, y, `p${s}`, 0).setOrigin(0.5, 0.9), tx: x, ty: y, rest: r() * 2, s, t0: r() * 1000 });
          }
        };
        spawn(300);
        (el.querySelector('#mn') as HTMLSelectElement).onchange = (e) => spawn(Number((e.target as HTMLSelectElement).value));
        const cam = this.cameras.main;
        cam.setBounds(0, 0, MW, MH);
        cam.setZoom(3);
        cam.centerOn(560, 340);
        const zl = el.querySelector('#mz')!;
        const showZoom = () => { zl.textContent = `ซูม ${cam.zoom.toFixed(2)}×`; };
        showZoom();
        this.input.on('wheel', (pt: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
          const before = cam.getWorldPoint(pt.x, pt.y);
          cam.setZoom(Phaser.Math.Clamp(cam.zoom * Math.exp(-dy * 0.0015), 0.4, 8));
          const after = cam.getWorldPoint(pt.x, pt.y);
          cam.scrollX += before.x - after.x; cam.scrollY += before.y - after.y;
          showZoom();
        });
        this.input.on('pointermove', (pt: Phaser.Input.Pointer) => {
          if (!pt.isDown) return;
          cam.scrollX -= (pt.x - pt.prevPosition.x) / cam.zoom; cam.scrollY -= (pt.y - pt.prevPosition.y) / cam.zoom;
        });
        this.events.on('update', (now: number, delta: number) => {
          const t = performance.now(), dt = Math.min(0.1, delta / 1000);
          for (const p of ps) {
            const dx = p.tx - p.img.x, dy = p.ty - p.img.y, dist = Math.hypot(dx, dy);
            if (dist < 1) {
              p.rest -= dt;
              if (p.rest < 0) {
                const nx = p.img.x + (r() - 0.5) * 160, ny = p.img.y + (r() - 0.5) * 100;
                if (w.walkable(nx, ny)) { p.tx = nx; p.ty = ny; }
                p.rest = 1 + r() * 3;
              }
              p.img.setFrame(frameIndex('idle', Math.floor((now + p.t0) / FRAME_MS.idle) % FRAME_N.idle));
            } else {
              const v = 18 * dt;
              p.img.x += (dx / dist) * Math.min(v, dist); p.img.y += (dy / dist) * Math.min(v, dist);
              p.img.setFlipX(dx < 0);
              p.img.setFrame(frameIndex('walk', Math.floor((now + p.t0) / FRAME_MS.walk) % FRAME_N.walk));
            }
            p.img.setDepth(p.img.y);
          }
          cost = performance.now() - t;
        });
      },
    },
  });
  return () => game.destroy(true);
}
