// The art lab (art-lab.html): the same pixel sprites drawn by each way the browser can draw, side by side, with a meter, plus a map, a cut
// scene and the god's effects drawn the ways that suit them. Only one tab runs at a time, so the meter measures that tab alone.
import { METHODS, METHOD_NAME, legacyVector, mountBench, sheetFile, type Bench, type Method } from './benches';
import { mountCutscene } from './cutscene';
import { mountEffects } from './effects';
import { mountMap } from './map';
import { allSheets, COLS, frameIndex } from './pixel';
import { mountUi } from './uisample';
import { SUMMARY } from './summary';

const app = document.getElementById('app')!;
const sheets = allSheets();

const css = document.createElement('style');
css.textContent = `
.lab{max-width:1280px;margin:0 auto;padding:16px}
.lab h1{font-size:22px;margin:0 0 4px}.lab h2{font-size:18px;margin:20px 0 8px}
.lab p{margin:4px 0;color:#9a9486}.lab .dim{color:#9a9486;font-size:13px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}
.tabs button,.ctl button,.ctl select{background:#16171e;color:#e6e0d0;border:1px solid #2a2c36;border-radius:6px;padding:6px 12px;font:inherit;cursor:pointer}
.tabs button[aria-pressed=true]{background:#e8c36a;color:#0e0f14;border-color:#e8c36a}
.ctl{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:8px 0;font-size:13px}
.ctl input[type=range]{width:180px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.cell h3{font-size:14px;margin:0 0 4px}.cell .note{font-size:12px;color:#9a9486;margin-top:4px}
.meter{position:fixed;right:12px;top:12px;background:#16171eee;border:1px solid #2a2c36;border-radius:6px;padding:6px 10px;font:12px ui-monospace,Menlo,monospace;z-index:9}
table.sum{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}
table.sum th,table.sum td{border:1px solid #2a2c36;padding:6px 8px;text-align:left;vertical-align:top}
table.sum th{background:#16171e}
.good{color:#8ac870}.mid{color:#e8c36a}.bad{color:#d4616f}
`;
document.head.append(css);

// ── the meter: frames per second and the slowest frame of the last second, plus the JS time the bench reports ───────────────────────
const meter = document.createElement('div');
meter.className = 'meter';
document.body.append(meter);
let benchCost: () => number = () => 0;
const samples: number[] = [];
let lastT = performance.now();
const tickMeter = (now: number) => {
  samples.push(now - lastT);
  lastT = now;
  while (samples.length > 240) samples.shift();
  requestAnimationFrame(tickMeter);
};
requestAnimationFrame(tickMeter);
function stats(windowMs: number): { fps: number; worst: number } {
  let t = 0, n = 0, worst = 0;
  for (let i = samples.length - 1; i >= 0 && t < windowMs; i--) { t += samples[i]; n++; worst = Math.max(worst, samples[i]); }
  return { fps: t ? (n * 1000) / t : 0, worst };
}
setInterval(() => {
  const s = stats(1000);
  meter.textContent = `FPS ${s.fps.toFixed(0)} · เฟรมช้าสุด ${s.worst.toFixed(1)} ms · JS ${benchCost().toFixed(2)} ms`;
}, 250);

// ── page ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const root = document.createElement('div');
root.className = 'lab';
root.innerHTML = `<h1>ห้องทดลองภาพ</h1>
<p>ตัวละครชุดเดียวกัน (วาดด้วยโค้ดเป็นพิกเซลอาร์ต ลงเงาและเส้นขอบอัตโนมัติจาก Look) ถูกวาดลงจอด้วย 5 วิธี ตัวเลข FPS มุมขวาบนวัดเฉพาะแท็บที่เปิดอยู่</p>
${SUMMARY}`;
app.append(root);

const tabs = document.createElement('div');
tabs.className = 'tabs';
const body = document.createElement('div');
root.append(tabs, body);

type Tab = { id: string; label: string; mount: (el: HTMLElement) => Promise<() => void> };
let unmount: (() => void) | null = null;

const ctl = (html: string) => { const d = document.createElement('div'); d.className = 'ctl'; d.innerHTML = html; return d; };

// tab: the five side by side, one figure each
async function compare(el: HTMLElement): Promise<() => void> {
  el.append(ctl(`<label>ซูม <input id="cz" type="range" min="1" max="12" step="0.1" value="4"> <b id="czv">4.0×</b></label>
    <label><input id="cwob" type="checkbox"> ซูมเข้าออกต่อเนื่อง (ดูความลื่นตอนซูม)</label>`));
  const grid = document.createElement('div');
  grid.className = 'grid';
  el.append(grid);
  let zoom = 4;
  const benches: Bench[] = [];
  const notes: Record<Method, string> = {
    dom: 'ทุกพิกเซลเป็น box-shadow ของ div เดียว ซูมด้วย CSS zoom',
    svg: 'ทุกแถวสีเป็น rect ซูมด้วย viewBox (คมทุกระดับ)',
    canvas: 'drawImage จากแผ่นสไปรต์ทุกเฟรม ปิดการเกลี่ยภาพ',
    webgl: 'แผ่นสไปรต์เป็น texture ของ GPU กล้องซูมได้ต่อเนื่อง',
    bitmap: 'แผ่นสไปรต์เป็นไฟล์ PNG เดินเฟรมด้วย CSS steps() ไม่มีสคริปต์ต่อเฟรม',
  };
  for (const m of METHODS) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.innerHTML = `<h3>${METHOD_NAME[m]}</h3>`;
    const host = document.createElement('div');
    cell.append(host);
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = notes[m];
    cell.append(note);
    grid.append(cell);
    benches.push(await mountBench(m, host, { W: 380, H: 220, sheets, zoom, count: 1 }));
  }
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.innerHTML = '<h3>เทียบ · เวกเตอร์เดิม (legacy/render)</h3>';
  const host = document.createElement('div');
  cell.append(host);
  cell.insertAdjacentHTML('beforeend', '<div class="note">ตัววาดเวกเตอร์ที่มีอยู่แล้ว (แนวสมจริง) วาดใหม่ตามซูม จึงคมทุกระดับ แต่ต้องวาดใหม่ทุกครั้งที่ซูมเปลี่ยน</div>');
  grid.append(cell);
  const stopVec = await legacyVector(host, 380, 220, () => zoom);
  const z = el.querySelector<HTMLInputElement>('#cz')!, zv = el.querySelector('#czv')!, wob = el.querySelector<HTMLInputElement>('#cwob')!;
  const set = (v: number) => { zoom = v; zv.textContent = `${v.toFixed(1)}×`; benches.forEach((b) => b.setZoom(v)); };
  z.oninput = () => set(Number(z.value));
  let id = 0;
  const wobble = (now: number) => {
    if (wob.checked) { const v = 1.5 + 4.5 * (0.5 - 0.5 * Math.cos(now / 1200)); z.value = String(v); set(v); }
    id = requestAnimationFrame(wobble);
  };
  id = requestAnimationFrame(wobble);
  benchCost = () => benches.reduce((t, b) => t + b.cost(), 0);
  return () => { cancelAnimationFrame(id); benches.forEach((b) => b.destroy()); stopVec(); };
}

// tab: one way under load
async function stress(el: HTMLElement): Promise<() => void> {
  el.append(ctl(`<label>วิธี <select id="sm">${METHODS.map((m) => `<option value="${m}">${METHOD_NAME[m]}</option>`).join('')}</select></label>
    <label>จำนวนตัว <select id="sn">${[1, 50, 200, 1000, 3000].map((n) => `<option ${n === 200 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>ซูม <input id="sz" type="range" min="1" max="8" step="0.1" value="3"> <b id="szv">3.0×</b></label>
    <label><input id="swob" type="checkbox"> ซูมเข้าออกต่อเนื่อง</label>
    <button id="sauto">วัดอัตโนมัติทั้ง 5 แบบ (ราว 80 วินาที)</button>`));
  const host = document.createElement('div');
  el.append(host);
  const out = document.createElement('div');
  el.append(out);
  const W = 1240, H = 420;
  let bench: Bench | null = null, zoom = 3, count = 200, method: Method = 'dom', busy = false;
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const remount = async () => {
    bench?.destroy();
    bench = await mountBench(method, host, { W, H, sheets, zoom, count });
    benchCost = () => bench?.cost() ?? 0;
  };
  const setZoom = (v: number) => { zoom = v; q('#szv').textContent = `${v.toFixed(1)}×`; bench?.setZoom(v); };
  q<HTMLSelectElement>('#sm').onchange = (e) => { method = (e.target as HTMLSelectElement).value as Method; void remount(); };
  q<HTMLSelectElement>('#sn').onchange = (e) => { count = Number((e.target as HTMLSelectElement).value); bench?.setCount(count); };
  q<HTMLInputElement>('#sz').oninput = (e) => setZoom(Number((e.target as HTMLInputElement).value));
  let wob = false, id = 0;
  q<HTMLInputElement>('#swob').onchange = (e) => { wob = (e.target as HTMLInputElement).checked; };
  const wobble = (now: number) => { if (wob) setZoom(1.5 + 4.5 * (0.5 - 0.5 * Math.cos(now / 1200))); id = requestAnimationFrame(wobble); };
  id = requestAnimationFrame(wobble);
  const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
  q<HTMLButtonElement>('#sauto').onclick = async () => {
    if (busy) return;
    busy = true;
    const cases: { n: number; wob: boolean }[] = [{ n: 1, wob: false }, { n: 200, wob: false }, { n: 1000, wob: false }, { n: 3000, wob: false }, { n: 200, wob: true }];
    const rows: string[] = [];
    for (const m of METHODS) {
      method = m;
      const cells: string[] = [];
      for (const c of cases) {
        count = c.n; wob = c.wob; setZoom(3);
        await remount();
        await wait(700);
        samples.length = 0;
        let js = 0, k = 0;
        const t0 = performance.now();
        while (performance.now() - t0 < 1800) { await wait(100); js += bench!.cost(); k++; }
        const s = stats(1800);
        const cls = s.fps >= 55 ? 'good' : s.fps >= 30 ? 'mid' : 'bad';
        cells.push(`<td class="${cls}">${s.fps.toFixed(0)} fps · ช้าสุด ${s.worst.toFixed(0)} ms · JS ${(js / k).toFixed(1)} ms</td>`);
        out.innerHTML = `<p class="dim">กำลังวัด ${METHOD_NAME[m]} · ${c.n} ตัว${c.wob ? ' · ซูมต่อเนื่อง' : ''}</p>`;
      }
      rows.push(`<tr><th>${METHOD_NAME[m]}</th>${cells.join('')}</tr>`);
    }
    wob = false;
    const files = await Promise.all(sheets.map(sheetFile));
    out.innerHTML = `<table class="sum" data-testid="bench-result"><tr><th>วิธี</th>${cases.map((c) => `<th>${c.n} ตัว${c.wob ? ' + ซูมต่อเนื่อง' : ''}</th>`).join('')}</tr>${rows.join('')}</table>
      <p class="dim">ซูม 3× · ขนาดเวที ${W}×${H} · ไฟล์ PNG ของแผ่นสไปรต์ทั้ง 9 แผ่นรวม ${(files.reduce((t, f) => t + f.bytes, 0) / 1024).toFixed(1)} KB</p>`;
    busy = false;
  };
  await remount();
  return () => { cancelAnimationFrame(id); bench?.destroy(); bench = null; };
}

// tab: the eight people and the wolf, like a sheet of an artist
async function variety(el: HTMLElement): Promise<() => void> {
  el.insertAdjacentHTML('beforeend', '<p>ทุกตัวมาจากตัววาดเดียว ต่างกันที่ Look (สีผิว ชุด ผ้าคลุม หมวก หู อาวุธ) เหมือนที่ M6 จะอ่านจากเอกสาร แถวล่างคือทุกเฟรมของตัวหนึ่ง</p>');
  const Z = 4;
  const cv = document.createElement('canvas');
  cv.width = 5 * 52 * Z; cv.height = 2 * 44 * Z;
  cv.style.cssText = `background:#c8cdd5;max-width:100%;image-rendering:pixelated`;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.font = '12px sans-serif';
  sheets.forEach((s, k) => {
    const col = k % 5, row = Math.floor(k / 5), idx = frameIndex('idle', 0);
    g.drawImage(s.canvas, (idx % COLS) * s.fw, Math.floor(idx / COLS) * s.fh, s.fw, s.fh, col * 52 * Z + 4 * Z, row * 44 * Z, s.fw * Z, s.fh * Z);
  });
  el.append(cv);
  for (const s of [sheets[4], sheets[1], sheets[8]]) {
    const st = document.createElement('canvas');
    st.width = s.canvas.width * 3; st.height = s.canvas.height * 3;
    st.style.cssText = 'background:#c8cdd5;margin:8px 8px 0 0;image-rendering:pixelated';
    const c = st.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.drawImage(s.canvas, 0, 0, st.width, st.height);
    el.append(st);
  }
  benchCost = () => 0;
  return () => {};
}

const TABS: Tab[] = [
  { id: 'compare', label: 'ตัวละคร: เทียบ 5 แบบ', mount: compare },
  { id: 'stress', label: 'ตัวละคร: ทดสอบหนัก', mount: stress },
  { id: 'variety', label: 'ความหลากหลายจาก Look', mount: variety },
  { id: 'map', label: 'แผนที่', mount: async (el) => { benchCost = () => 0; return mountMap(el, sheets, (f) => (benchCost = f)); } },
  { id: 'cut', label: 'ฉากคัตซีน', mount: async (el) => { benchCost = () => 0; return mountCutscene(el, sheets, (f) => (benchCost = f)); } },
  { id: 'fx', label: 'เอฟเฟกต์', mount: async (el) => { benchCost = () => 0; return mountEffects(el, sheets, (f) => (benchCost = f)); } },
  { id: 'ui', label: 'UI', mount: async (el) => { benchCost = () => 0; return mountUi(el, sheets); } },
];

async function open(t: Tab): Promise<void> {
  unmount?.();
  unmount = null;
  body.replaceChildren();
  tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === t.id)));
  history.replaceState(null, '', `#${t.id}`);
  unmount = await t.mount(body);
}

for (const t of TABS) {
  const b = document.createElement('button');
  b.textContent = t.label;
  b.dataset.id = t.id;
  b.onclick = () => void open(t);
  tabs.append(b);
}
void open(TABS.find((t) => `#${t.id}` === location.hash) ?? TABS[0]);
