// tiny CDP client against the long-lived Chrome on port 9411. usage: node cdp.mjs <cmd> [args]
//   js "<js>"   shot <name>   click "<text>"   clicksel "<css>"  type "<css>" "<text>"
import { writeFileSync } from 'node:fs';
const [,, cmd, a, b] = process.argv;
const tabs = await (await fetch('http://127.0.0.1:9411/json')).json();
const ws = tabs.find((t) => t.type === 'page').webSocketDebuggerUrl;
const sock = new WebSocket(ws); await new Promise((r) => sock.addEventListener('open', r));
let id = 0; const w = new Map();
sock.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && w.has(m.id)) { w.get(m.id)(m); w.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const k = ++id; w.set(k, r); sock.send(JSON.stringify({ id: k, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.text; };
const J = JSON.stringify;
if (cmd === 'js') console.log(typeof (await ev(a)) === 'string' ? await ev(a) : J(await ev(a), null, 1));
if (cmd === 'shot') { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`/Users/aiyaruchphengthong/Learn/overseer/.claude/worktrees/agent-af69c25922292ad07/review/overnight/fix-t2/${a}.png`, Buffer.from(s.result.data, 'base64')); console.log('shot', a); }
if (cmd === 'click') console.log(await ev(`(() => { const b = [...document.querySelectorAll('button,[role=button]')].find((x) => x.offsetParent !== null && !x.disabled && x.textContent.trim().includes(${J(a)})); if (!b) return false; b.click(); return true; })()`));
if (cmd === 'clicksel') console.log(await ev(`(() => { const b = document.querySelector(${J(a)}); if (!b) return false; b.click(); return true; })()`));
if (cmd === 'type') { console.log(await ev(`(() => { const i = document.querySelector(${J(a)}); if (!i) return false; i.focus(); return true; })()`)); await send('Input.insertText', { text: b }); }
if (cmd === 'set') { console.log(await ev(`(() => { const i = document.querySelector(${J(a)}); if (!i) return false; const set = Object.getOwnPropertyDescriptor(i.constructor.prototype, 'value').set; set.call(i, ${J(b)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`)); }
if (cmd === 'tap') { const pt = await ev(`(() => { const els = [...document.querySelectorAll('body *')].filter((x) => x.offsetParent !== null && x.innerText && x.innerText.includes(${J(a)})); if (!els.length) return null; els.sort((p, q) => p.innerText.length - q.innerText.length); const r = els[0].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, els[0].tagName]; })()`); console.log(J(pt)); if (pt) { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: pt[0], y: pt[1], button: 'left', clickCount: 1 }); } }
if (cmd === 'hold') { const pt = await ev(`(() => { const els = [...document.querySelectorAll('button')].filter((x) => x.offsetParent !== null && x.innerText.includes(${J(a)})); if (!els.length) return null; const r = els[els.length-1].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`); console.log(J(pt)); if (pt) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt[0], y: pt[1] }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt[0], y: pt[1], button: 'left', clickCount: 1 }); await new Promise((r) => setTimeout(r, Number(b || 2200))); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt[0], y: pt[1], button: 'left', clickCount: 1 }); } }
if (cmd === 'ui') console.log(await ev(`(() => { const t = document.body.innerText.replace(/\\n+/g,' | ').slice(0, 1800); const bs = [...document.querySelectorAll('button,input,textarea,[role=button]')].filter((x) => x.offsetParent !== null).map((x) => (x.dataset.testid ? '#'+x.dataset.testid+':' : '') + (x.disabled?'(off)':'') + (x.getAttribute('aria-label') ? '['+x.getAttribute('aria-label')+']' : '') + x.textContent.trim().slice(0, 30)); return t + '\\n\\nBUTTONS: ' + J(bs); })()`.replace('J(bs)', 'JSON.stringify(bs)')));
process.exit(0);
