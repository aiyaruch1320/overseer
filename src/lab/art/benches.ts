// The five ways to put the lab's sprites on a page. Each bench draws the same walkers
// from the same sheets in a stage of W × H, takes a zoom (screen pixels per art pixel) and a count, and reports the JS time of its last frame.
import { ANIMS, COLS, FRAME_MS, FRAME_N, frameIndex, type Anim, type Sheet } from './pixel';

export type Method = 'dom' | 'svg' | 'canvas' | 'webgl' | 'bitmap';
export const METHODS: Method[] = ['dom', 'svg', 'canvas', 'webgl', 'bitmap'];
export const METHOD_NAME: Record<Method, string> = {
  dom: '1 · DOM + CSS',
  svg: '2 · SVG',
  canvas: '3 · Canvas 2D',
  webgl: '4 · WebGL (Phaser)',
  bitmap: '5 · ภาพสำเร็จ (bitmap)',
};

export interface Bench { setZoom(z: number): void; setCount(n: number): void; destroy(): void; cost(): number }
export interface BenchOpts { W: number; H: number; sheets: Sheet[]; zoom: number; count: number }

// ── walkers ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
interface Walker { fx: number; fy: number; v: number; s: number; t0: number }

function walkers(n: number, sheets: number): Walker[] {
  let r = 7;
  const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const out: Walker[] = [];
  for (let i = 0; i < n; i++) out.push({ fx: rnd(), fy: rnd(), v: 14 + rnd() * 16, s: n === 1 ? Math.min(4, sheets - 1) : i % sheets, t0: rnd() * 1000 });
  return out.sort((a, b) => a.fy - b.fy);
}

/** One figure alone shows its three animations in turn (idle, walk, attack); many walk across. */
const SHOW: [Anim, number][] = [['idle', 1600], ['walk', 2080], ['attack', 900]];
const SHOW_MS = SHOW.reduce((t, [, ms]) => t + ms, 0);

function frameAt(single: boolean, w: Walker, now: number): number {
  let a: Anim = 'walk', t = now + w.t0;
  if (single) {
    let u = now % SHOW_MS;
    for (const [an, ms] of SHOW) { if (u < ms) { a = an; t = u; break; } u -= ms; }
  }
  return frameIndex(a, Math.floor(t / FRAME_MS[a]) % FRAME_N[a]);
}

function move(ws: Walker[], dt: number, o: BenchOpts, single: boolean): void {
  if (single) return;
  for (const w of ws) { w.fx += (w.v * dt * o.zoom) / o.W; if (w.fx > 1.02) w.fx -= 1.12; }
}

/** Where a walker stands, in art pixels of the stage. */
function place(w: Walker, o: BenchOpts, single: boolean, s: Sheet): [number, number] {
  const ww = o.W / o.zoom, wh = o.H / o.zoom;
  if (single) return [Math.round(ww / 2 - s.fw / 2), Math.round(wh / 2 - s.fh / 2)];
  return [w.fx * (ww + s.fw) - s.fw, w.fy * Math.max(0, wh - s.fh)];
}

/** A loop of frames that the bench can stop, with the time of its own work. */
function loop(tick: (now: number, dt: number) => void) {
  let id = 0, last = performance.now(), cost = 0;
  const f = (now: number) => {
    const t = performance.now();
    tick(now, Math.min(0.1, (now - last) / 1000));
    cost = performance.now() - t;
    last = now;
    id = requestAnimationFrame(f);
  };
  id = requestAnimationFrame(f);
  return { stop: () => cancelAnimationFrame(id), cost: () => cost };
}

function stageEl(host: HTMLElement, o: BenchOpts): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `position:relative;width:${o.W}px;height:${o.H}px;overflow:hidden;background:#c8cdd5`;
  host.append(el);
  return el;
}

const rgba = (d: Uint8ClampedArray, i: number) => (d[i + 3] === 255 ? `rgb(${d[i]},${d[i + 1]},${d[i + 2]})` : `rgba(${d[i]},${d[i + 1]},${d[i + 2]},${(d[i + 3] / 255).toFixed(2)})`);
const framesOf = (s: Sheet) => ANIMS.flatMap((a) => s.frames[a].map((f, i) => ({ idx: frameIndex(a, i), f })));

// ── 1 · DOM + CSS: one element per figure, each art pixel a box-shadow of it ───────────────────────────────────────────────────────
let domCss: HTMLStyleElement | null = null;
function domStyle(sheets: Sheet[]): void {
  if (domCss) return;
  const rules: string[] = ['.dpx{position:absolute;left:-1px;top:-1px;width:1px;height:1px;will-change:transform}'];
  sheets.forEach((s, k) => {
    for (const { idx, f } of framesOf(s)) {
      const sh: string[] = [];
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) { const i = (y * f.w + x) * 4; if (f.data[i + 3]) sh.push(`${x + 1}px ${y + 1}px ${rgba(f.data, i)}`); }
      rules.push(`.d${k}-${idx}{box-shadow:${sh.join(',')}}`);
    }
  });
  domCss = document.createElement('style');
  domCss.textContent = rules.join('\n');
  document.head.append(domCss);
}

function domBench(host: HTMLElement, o: BenchOpts): Bench {
  domStyle(o.sheets);
  const stage = stageEl(host, o);
  const world = document.createElement('div');
  world.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0';
  stage.append(world);
  let ws: Walker[] = [], els: HTMLDivElement[] = [], cls: string[] = [];
  const build = () => {
    world.replaceChildren();
    ws = walkers(o.count, o.sheets.length);
    els = ws.map(() => { const e = document.createElement('div'); world.append(e); return e; });
    cls = ws.map(() => '');
  };
  const zoom = () => { (world.style as CSSStyleDeclaration & { zoom: string }).zoom = String(o.zoom); };
  build(); zoom();
  const l = loop((now, dt) => {
    const single = o.count === 1;
    move(ws, dt, o, single);
    ws.forEach((w, i) => {
      const c = `dpx d${w.s}-${frameAt(single, w, now)}`;
      if (c !== cls[i]) { els[i].className = c; cls[i] = c; }
      const [x, y] = place(w, o, single, o.sheets[w.s]);
      els[i].style.transform = `translate(${x}px,${y}px)`;
    });
  });
  return { setZoom: (z) => { o.zoom = z; zoom(); }, setCount: (n) => { o.count = n; build(); }, destroy: () => { l.stop(); stage.remove(); }, cost: l.cost };
}

// ── 2 · SVG: each frame a group of rectangles (a run of one colour per row), figures are <use> of it ─────────────────────────────────
let svgDefs = '';
function svgSymbols(sheets: Sheet[]): string {
  if (svgDefs) return svgDefs;
  const parts: string[] = [];
  sheets.forEach((s, k) => {
    for (const { idx, f } of framesOf(s)) {
      const r: string[] = [];
      for (let y = 0; y < f.h; y++) {
        let x = 0;
        while (x < f.w) {
          const i = (y * f.w + x) * 4;
          if (!f.data[i + 3]) { x++; continue; }
          const c = rgba(f.data, i);
          let e = x + 1;
          while (e < f.w && f.data[(y * f.w + e) * 4 + 3] && rgba(f.data, (y * f.w + e) * 4) === c) e++;
          r.push(`<rect x="${x}" y="${y}" width="${e - x}" height="1" fill="${c}"/>`);
          x = e;
        }
      }
      parts.push(`<g id="v${k}-${idx}">${r.join('')}</g>`);
    }
  });
  svgDefs = `<defs>${parts.join('')}</defs>`;
  return svgDefs;
}

function svgBench(host: HTMLElement, o: BenchOpts): Bench {
  const stage = stageEl(host, o);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(o.W)); svg.setAttribute('height', String(o.H)); svg.setAttribute('shape-rendering', 'crispEdges');
  svg.innerHTML = svgSymbols(o.sheets);
  const layer = document.createElementNS(NS, 'g');
  svg.append(layer); stage.append(svg);
  let ws: Walker[] = [], uses: SVGUseElement[] = [], href: string[] = [];
  const build = () => {
    layer.replaceChildren();
    ws = walkers(o.count, o.sheets.length);
    uses = ws.map(() => { const u = document.createElementNS(NS, 'use'); layer.append(u); return u; });
    href = ws.map(() => '');
  };
  const zoom = () => svg.setAttribute('viewBox', `0 0 ${o.W / o.zoom} ${o.H / o.zoom}`);
  build(); zoom();
  const l = loop((now, dt) => {
    const single = o.count === 1;
    move(ws, dt, o, single);
    ws.forEach((w, i) => {
      const h = `#v${w.s}-${frameAt(single, w, now)}`;
      if (h !== href[i]) { uses[i].setAttribute('href', h); href[i] = h; }
      const [x, y] = place(w, o, single, o.sheets[w.s]);
      uses[i].setAttribute('x', x.toFixed(2)); uses[i].setAttribute('y', y.toFixed(2));
    });
  });
  return { setZoom: (z) => { o.zoom = z; zoom(); }, setCount: (n) => { o.count = n; build(); }, destroy: () => { l.stop(); stage.remove(); }, cost: l.cost };
}

// ── 3 · Canvas 2D: one canvas, every figure a drawImage from its sheet each frame ────────────────────────────────────────────────────
function canvasBench(host: HTMLElement, o: BenchOpts): Bench {
  const stage = stageEl(host, o);
  const dpr = window.devicePixelRatio || 1;
  const cv = document.createElement('canvas');
  cv.width = o.W * dpr; cv.height = o.H * dpr; cv.style.cssText = `width:${o.W}px;height:${o.H}px;display:block`;
  stage.append(cv);
  const c = cv.getContext('2d')!;
  let ws = walkers(o.count, o.sheets.length);
  const l = loop((now, dt) => {
    const single = o.count === 1;
    move(ws, dt, o, single);
    c.clearRect(0, 0, cv.width, cv.height);
    c.imageSmoothingEnabled = false;
    const k = o.zoom * dpr;
    for (const w of ws) {
      const s = o.sheets[w.s], idx = frameAt(single, w, now), [x, y] = place(w, o, single, s);
      c.drawImage(s.canvas, (idx % COLS) * s.fw, Math.floor(idx / COLS) * s.fh, s.fw, s.fh, Math.round(x * k), Math.round(y * k), Math.round(s.fw * k), Math.round(s.fh * k));
    }
  });
  return { setZoom: (z) => { o.zoom = z; }, setCount: (n) => { o.count = n; ws = walkers(n, o.sheets.length); }, destroy: () => { l.stop(); stage.remove(); }, cost: l.cost };
}

// ── 4 · WebGL through Phaser: the sheets are textures, figures are images the GPU draws in a batch ──────────────────────────────────
async function webglBench(host: HTMLElement, o: BenchOpts): Promise<Bench> {
  const Phaser = (await import('phaser')).default;
  const stage = stageEl(host, o);
  let ws: Walker[] = [], imgs: Phaser.GameObjects.Image[] = [], frames: number[] = [], cost = 0;
  let scene!: Phaser.Scene;
  const build = () => {
    imgs.forEach((i) => i.destroy());
    ws = walkers(o.count, o.sheets.length);
    imgs = ws.map((w) => scene.add.image(0, 0, `lab${w.s}`, 0).setOrigin(0, 0));
    frames = ws.map(() => -1);
  };
  const zoom = () => { scene.cameras.main.setZoom(o.zoom); scene.cameras.main.centerOn(o.W / o.zoom / 2, o.H / o.zoom / 2); };
  await new Promise<void>((done) => {
    const game = new Phaser.Game({
      type: Phaser.WEBGL, parent: stage, width: o.W, height: o.H, transparent: true, banner: false, audio: { noAudio: true },
      render: { pixelArt: true, antialias: false, roundPixels: true },
      scene: {
        create(this: Phaser.Scene) {
          scene = this;
          o.sheets.forEach((s, k) => {
            const t = this.textures.addCanvas(`lab${k}`, s.canvas)!;
            for (let i = 0; i < COLS * ANIMS.length; i++) t.add(i, 0, (i % COLS) * s.fw, Math.floor(i / COLS) * s.fh, s.fw, s.fh);
          });
          build(); zoom(); done();
        },
        update(this: Phaser.Scene, now: number, delta: number) {
          if (!imgs.length) return;
          const t = performance.now(), single = o.count === 1;
          move(ws, Math.min(0.1, delta / 1000), o, single);
          ws.forEach((w, i) => {
            const f = frameAt(single, w, now);
            if (f !== frames[i]) { imgs[i].setFrame(f); frames[i] = f; }
            const [x, y] = place(w, o, single, o.sheets[w.s]);
            imgs[i].setPosition(x, y);
          });
          cost = performance.now() - t;
        },
      },
    });
    (stage as HTMLDivElement & { game?: Phaser.Game }).game = game;
  });
  const game = (stage as HTMLDivElement & { game?: Phaser.Game }).game!;
  return { setZoom: (z) => { o.zoom = z; zoom(); }, setCount: (n) => { o.count = n; build(); }, destroy: () => { game.destroy(true); stage.remove(); }, cost: () => cost };
}

// ── 5 · Bitmap: the sheets as image files; CSS steps the frames and moves the figures, no script per frame ──────────────────────────
const urls = new Map<Sheet, { url: string; bytes: number }>();
export async function sheetFile(s: Sheet): Promise<{ url: string; bytes: number }> {
  const have = urls.get(s);
  if (have) return have;
  const blob = await new Promise<Blob>((ok) => s.canvas.toBlob((b) => ok(b!), 'image/png'));
  const v = { url: URL.createObjectURL(blob), bytes: blob.size };
  urls.set(s, v);
  return v;
}

let bmCss: HTMLStyleElement | null = null;
function bitmapStyle(): void {
  if (bmCss) return;
  const px = (k: string) => `calc(var(--${k}) * var(--z) * 1px)`;
  const keys = [2, 3, 4].map((n) => `@keyframes bm-f${n}{from{background-position-x:0}to{background-position-x:calc(var(--fw) * var(--z) * -${n}px)}}`);
  bmCss = document.createElement('style');
  bmCss.textContent = `${keys.join('\n')}
@keyframes bm-move{from{transform:translate(calc(var(--fw) * var(--z) * -1px),var(--y))}to{transform:translate(var(--W),var(--y))}}
.bm{position:absolute;left:0;top:0;width:${px('fw')};height:${px('fh')};background-repeat:no-repeat;image-rendering:pixelated;
 background-size:${px('sw')} ${px('sh')};background-position-y:calc(var(--row) * var(--fh) * var(--z) * -1px);will-change:transform}
.bm-idle{--row:0;animation:bm-f2 ${FRAME_MS.idle * 2}ms steps(2) infinite}
.bm-walk{--row:1;animation:bm-f4 ${FRAME_MS.walk * 4}ms steps(4) infinite}
.bm-attack{--row:2;animation:bm-f3 ${FRAME_MS.attack * 3}ms steps(3) infinite}
.bm-mover{position:absolute;left:0;top:0;animation:bm-move linear infinite;will-change:transform}`;
  document.head.append(bmCss);
}

async function bitmapBench(host: HTMLElement, o: BenchOpts): Promise<Bench> {
  bitmapStyle();
  const files = await Promise.all(o.sheets.map(sheetFile));
  const stage = stageEl(host, o);
  let ws: Walker[] = [], single: { el: HTMLDivElement; t: number } | null = null, id = 0;
  const build = () => {
    stage.replaceChildren();
    cancelAnimationFrame(id);
    single = null;
    stage.style.setProperty('--z', String(o.zoom));
    stage.style.setProperty('--W', `${o.W}px`);
    ws = walkers(o.count, o.sheets.length);
    for (const w of ws) {
      const s = o.sheets[w.s];
      const fig = document.createElement('div');
      fig.style.cssText = `--fw:${s.fw};--fh:${s.fh};--sw:${s.canvas.width};--sh:${s.canvas.height};background-image:url(${files[w.s].url})`;
      if (o.count === 1) {
        const [x, y] = place(w, o, true, s);
        fig.style.transform = `translate(${x * o.zoom}px,${y * o.zoom}px)`;
        fig.className = 'bm bm-idle';
        stage.append(fig);
        single = { el: fig, t: 0 };
        continue;
      }
      fig.className = 'bm bm-walk';
      fig.style.animationDelay = `-${w.t0}ms`;
      const mover = document.createElement('div');
      mover.className = 'bm-mover';
      const dur = (o.W + s.fw * o.zoom) / (w.v * o.zoom);
      mover.style.cssText = `--fw:${s.fw};--y:${w.fy * Math.max(0, o.H - s.fh * o.zoom)}px;animation-duration:${dur}s;animation-delay:-${w.fx * dur}s`;
      mover.append(fig);
      stage.append(mover);
    }
    // one figure: a timer swaps the class for the three animations (the frames themselves still step in CSS)
    if (single) {
      const s = single;
      const tick = (now: number) => {
        let u = now % SHOW_MS, a: Anim = 'idle';
        for (const [an, ms] of SHOW) { if (u < ms) { a = an; break; } u -= ms; }
        const c = `bm bm-${a}`;
        if (s.el.className !== c) s.el.className = c;
        id = requestAnimationFrame(tick);
      };
      id = requestAnimationFrame(tick);
    }
  };
  build();
  return {
    setZoom: (z) => { o.zoom = z; if (o.count === 1) build(); else stage.style.setProperty('--z', String(z)); },
    setCount: (n) => { o.count = n; build(); },
    destroy: () => { cancelAnimationFrame(id); stage.remove(); },
    cost: () => 0,
  };
}

export function mountBench(m: Method, host: HTMLElement, o: BenchOpts): Promise<Bench> {
  switch (m) {
    case 'dom': return Promise.resolve(domBench(host, o));
    case 'svg': return Promise.resolve(svgBench(host, o));
    case 'canvas': return Promise.resolve(canvasBench(host, o));
    case 'webgl': return webglBench(host, o);
    case 'bitmap': return bitmapBench(host, o);
  }
}
