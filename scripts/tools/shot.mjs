// A screenshot of a page in headless Chrome (real GPU, so WebGL draws): node scripts/tools/shot.mjs <url> <out.png> [width] [height] [waitMs]
// For agents and reviewers that have no browser of their own. Needs Google Chrome in /Applications (macOS) or CHROME=<path>.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, w = '1300', h = '900', wait = '2500'] = process.argv.slice(2);
if (!url || !out) { console.error('usage: node scripts/tools/shot.mjs <url> <out.png> [width] [height] [waitMs]'); process.exit(2); }
const bin = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(bin, [`--headless=new`, `--remote-debugging-port=${port}`, `--window-size=${w},${h}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'shot-'))}`,
  '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let ws;
  for (let i = 0; i < 60 && !ws; i++) { await sleep(200); try { ws = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {} }
  if (!ws) throw new Error('Chrome did not start');
  const sock = new WebSocket(ws);
  await new Promise((r) => sock.addEventListener('open', r));
  let id = 0; const wait4 = new Map(); const errors = [];
  sock.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && wait4.has(m.id)) { wait4.get(m.id)(m); wait4.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' ')); });
  const send = (method, params = {}) => new Promise((r) => { const k = ++id; wait4.set(k, r); sock.send(JSON.stringify({ id: k, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(Number(wait));
  const full = await send('Page.getLayoutMetrics');
  const ch = Math.max(Number(h), Math.ceil(full.result?.cssContentSize?.height ?? Number(h)));
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: Number(w), height: Math.min(ch, 8000), scale: 1 } });
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log(`saved ${out}${errors.length ? `\npage errors:\n${errors.join('\n')}` : ''}`);
} finally { chrome.kill(); }
process.exit(0);
