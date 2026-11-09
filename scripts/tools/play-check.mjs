// Plays the REAL game (a production build on vite preview) in headless Chrome over the DevTools protocol and measures it.
// node scripts/tools/play-check.mjs [--out=dir] [--max-min=25] [--every=20] [--throttle=4] [--speed=เร็ว] [--size=1300x850] [--port=4174] [--no-build] [--keep=1]
//   --throttle=N  CPU slowdown (Emulation.setCPUThrottlingRate) for a low-spec run   --every=S  a screenshot + a log line every S seconds (also at every scene change)
//   --speed=TEXT  label of the speed button to click ("เร็ว"|"ปกติ"|"หยุด")           --keep=1  leave the preview server running
// Needs Google Chrome (macOS path) or CHROME=<path>. Builds with `npx vite build`, serves `npx vite preview --port 4174 --strictPort`, writes out/summary.json + summary.md + log.jsonl + png.
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, appendFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v = '1'] = a.replace(/^--/, '').split('='); return [k, v]; }));
const OUT = args.out ?? 'review/play-check';
const MAX_MS = Number(args['max-min'] ?? 25) * 60000;
const EVERY = Number(args.every ?? 20) * 1000;
const THROTTLE = Number(args.throttle ?? 1);
const SPEED = args.speed ?? 'เร็ว';
const [W, H] = (args.size ?? '1300x850').split('x').map(Number);
const PORT = Number(args.port ?? 4174);
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (o) => { const line = { t: +((Date.now() - t0) / 1000).toFixed(1), ...o }; appendFileSync(join(OUT, 'log.jsonl'), JSON.stringify(line) + '\n'); return line; };

// ---- build + preview server
if (!args['no-build']) execSync('npx vite build', { stdio: 'ignore' });
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const bin = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cport = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(bin, ['--headless=new', `--remote-debugging-port=${cport}`, `--window-size=${W},${H}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'play-'))}`,
  '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch {} if (!args.keep) try { preview.kill(); } catch {} };
process.on('SIGINT', () => { cleanup(); process.exit(1); });

const probe = `(() => {
  window.__pc = { ctxCreated: 0, ctxLost: 0, frames: 0, ctxTypes: {} };
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const c = orig.call(this, type, ...rest);
    if (c && /webgl/.test(String(type)) && !this.__pcSeen) {
      this.__pcSeen = true; window.__pc.ctxCreated++;
      this.addEventListener('webglcontextlost', () => { window.__pc.ctxLost++; });
    }
    return c;
  };
  const tick = () => { window.__pc.frames++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();`;

const errors = [];
try {
  let ws;
  for (let i = 0; i < 60 && !ws; i++) { await sleep(250); try { ws = (await (await fetch(`http://127.0.0.1:${cport}/json`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {} }
  if (!ws) throw new Error('Chrome did not start');
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch {} await sleep(250); if (i === 59) throw new Error('preview server not reachable'); }
  const sock = new WebSocket(ws);
  await new Promise((r) => sock.addEventListener('open', r));
  let id = 0; const wait4 = new Map();
  sock.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && wait4.has(m.id)) { wait4.get(m.id)(m); wait4.delete(m.id); }
    const at = +((Date.now() - t0) / 1000).toFixed(1);
    if (m.method === 'Runtime.exceptionThrown') errors.push({ t: at, kind: 'exception', text: m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text });
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push({ t: at, kind: 'console', text: m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 400) });
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'warning') { const tx = m.params.args.map((a) => a.value ?? a.description).join(' '); if (/webgl|context/i.test(tx)) errors.push({ t: at, kind: 'warn-webgl', text: tx.slice(0, 300) }); }
    if (m.method === 'Log.entryAdded' && /webgl|context/i.test(m.params.entry.text ?? '') && m.params.entry.level !== 'error') errors.push({ t: at, kind: 'log-webgl', text: m.params.entry.text.slice(0, 300) });
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push({ t: at, kind: 'log', text: `${m.params.entry.text} ${m.params.entry.url ?? ''}`.slice(0, 400) });
  });
  const send = (method, params = {}) => new Promise((r) => { const k = ++id; wait4.set(k, r); sock.send(JSON.stringify({ id: k, method, params })); });
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Performance.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: probe });
  if (THROTTLE > 1) await send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await send('Page.navigate', { url: `http://localhost:${PORT}/` });
  await sleep(3000);

  // click a visible enabled button whose text contains `text`; returns true if clicked
  const clickText = (text) => ev(`(() => { const b = [...document.querySelectorAll('button,[role=button]')].find((x) => x.offsetParent !== null && !x.disabled && x.textContent.trim().includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true; })()`);
  const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); const f = join(OUT, name + '.png'); writeFileSync(f, Buffer.from(s.result.data, 'base64')); return f; };
  const metrics = async () => { const r = (await send('Performance.getMetrics')).result?.metrics ?? []; const g = (n) => r.find((x) => x.name === n)?.value ?? 0; return { heapMB: +(g('JSHeapUsedSize') / 1048576).toFixed(1), nodes: g('Nodes'), listeners: g('JSEventListeners'), taskS: +g('TaskDuration').toFixed(1) }; };
  const readPage = () => ev(`(() => {
    const body = document.body.innerText;
    const sc = document.querySelector('[data-testid=life-scene]');
    const age = body.match(/อายุ\\s*(\\d+)/);
    const yr = body.match(/ปี\\s*(\\d{1,5})/);
    const btns = [...document.querySelectorAll('button')].filter((x) => x.offsetParent !== null).map((x) => x.textContent.trim().slice(0, 24));
    const canv = document.querySelectorAll('canvas').length;
    return { scene: sc ? sc.innerText.replace(/\\s+/g, ' ').slice(0, 90) : null, hasScene: !!sc, age: age ? Number(age[1]) : null, year: yr ? yr[1] : null,
      stop: btns.some((b) => b.includes('ให้ชีวิตเดินต่อ')), ended: /ฉากความตาย|อ่านบันทึกชีวิตของเขา|จารึก/.test(body) && !sc, btns, canv, gl: window.__pc.ctxCreated, lost: window.__pc.ctxLost, frames: window.__pc.frames, title: document.title };
  })()`);

  const cpuMs = await ev('(() => { const t = performance.now(); let x = 0; for (let i = 0; i < 3e7; i++) x += i; return Math.round(performance.now() - t); })()');
  log({ ev: 'cpu-probe', ms: cpuMs, throttle: THROTTLE });
  // ---- start screen
  const rows = [];
  log({ ev: 'loaded', page: await readPage() });
  await shot('00-start');
  console.log('start screen:', await clickText('สุ่มทั้งหมด'));
  await sleep(1500);
  await shot('01-randomised');
  let started = false;
  for (let i = 0; i < 20 && !started; i++) { started = await clickText('เริ่มชีวิต'); await sleep(800); }
  log({ ev: 'start-clicked', started });
  await sleep(2500);
  console.log('speed', SPEED, await clickText(SPEED));

  // ---- play loop
  let lastScene = '', lastShotAt = 0, lastFrames = 0, lastFramesAt = Date.now(), n = 0, endAt = null, lastAge = null, contClicks = 0;
  const sceneChanges = [];
  let maxGl = 0;
  while (Date.now() - t0 < MAX_MS) {
    await sleep(1000);
    const p = await readPage();
    maxGl = Math.max(maxGl, p.gl);
    if (p.stop) { await sleep(700); await shot(`stop-${String(contClicks + 1).padStart(2, '0')}-age${p.age}`); if (await clickText('ให้ชีวิตเดินต่อ')) { contClicks++; log({ ev: 'continue', n: contClicks }); await sleep(300); await clickText(SPEED); } }
    const now = Date.now();
    const changed = p.scene !== lastScene;
    if (changed) { sceneChanges.push({ t: +((now - t0) / 1000).toFixed(1), scene: p.scene, age: p.age }); }
    if (p.age != null) lastAge = p.age;
    if ((changed && now - lastShotAt >= 6000) || now - lastShotAt >= EVERY) {
      const fps = +(((p.frames - lastFrames) / ((now - lastFramesAt) / 1000)) || 0).toFixed(1);
      lastFrames = p.frames; lastFramesAt = now;
      const m = await metrics();
      const name = `t${String(++n).padStart(3, '0')}-${Math.round((now - t0) / 1000)}s${changed ? '-scene' : ''}`;
      await shot(name);
      const row = log({ ev: changed ? 'scene' : 'tick', shot: name + '.png', age: p.age, year: p.year, scene: p.scene, stop: p.stop, ctxCreated: p.gl, ctxLost: p.lost, canvases: p.canv, fps, ...m, errors: errors.length });
      rows.push(row);
      lastShotAt = now; lastScene = p.scene;
      if (n % 5 === 0) console.log(JSON.stringify(row));
    }
    if (p.ended || /ฉากความตาย|อ่านบันทึกชีวิตของเขา/.test(p.btns.join(' ') + p.scene)) {
      if (endAt == null) { endAt = Date.now(); log({ ev: 'end-detected', page: p }); await shot('end-0-death'); }
      // walk through the end screens, one shot each
      if (Date.now() - endAt > 2000) {
        for (const [i, label] of ['อ่านบันทึกชีวิตของเขา', 'ผู้สืบ', 'ต่อ'].entries()) {
          if (await clickText(label)) { await sleep(1500); await shot(`end-${i + 1}-${label}`); log({ ev: 'end-click', label, btns: (await readPage()).btns }); }
        }
        break;
      }
    }
  }
  const final = await readPage();
  await shot('zz-final');
  const fm = await metrics();
  const pageTextTail = await ev('document.body.innerText.slice(-1500)');
  const fpsRows = rows.map((r) => r.fps).filter((x) => x > 0);
  const summary = {
    args, durationS: +((Date.now() - t0) / 1000).toFixed(0), throttle: THROTTLE, ended: endAt != null, lastAge, continueClicks: contClicks,
    cpuProbeMs: cpuMs, webgl: { created: final.gl, lost: final.lost, maxCreated: maxGl }, finalHeapMB: fm.heapMB,
    fps: { min: Math.min(...fpsRows), max: Math.max(...fpsRows), avg: +(fpsRows.reduce((a, b) => a + b, 0) / (fpsRows.length || 1)).toFixed(1) },
    heapSeries: rows.map((r) => [r.t, r.heapMB]), fpsSeries: rows.map((r) => [r.t, r.fps]), ctxSeries: rows.map((r) => [r.t, r.ctxCreated, r.ctxLost]),
    sceneChanges, errors, finalButtons: final.btns, pageTextTail,
  };
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  const md = [`# play-check ${new Date().toISOString()}`, '', `duration ${summary.durationS}s · throttle ${THROTTLE}× · ended ${summary.ended} · last age ${lastAge} · stop-continue clicks ${contClicks}`,
    `WebGL contexts created ${final.gl}, lost ${final.lost} · fps min/avg/max ${summary.fps.min}/${summary.fps.avg}/${summary.fps.max} · final heap ${fm.heapMB} MB · errors ${errors.length}`, '',
    '| t(s) | age | fps | heap MB | ctx made/lost | scene |', '|---|---|---|---|---|---|', ...rows.map((r) => `| ${r.t} | ${r.age ?? ''} | ${r.fps} | ${r.heapMB} | ${r.ctxCreated}/${r.ctxLost} | ${(r.scene ?? '').replace(/\|/g, '/').slice(0, 60)} |`), '',
    '## errors', ...(errors.length ? errors.map((e) => `- ${e.t}s ${e.kind}: ${e.text}`) : ['none'])].join('\n');
  writeFileSync(join(OUT, 'summary.md'), md);
  console.log(md.split('\n').slice(0, 6).join('\n'));
} finally { cleanup(); }
process.exit(0);
