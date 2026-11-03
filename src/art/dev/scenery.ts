// The scenery page (scenery.html, M7 ก2): every continent × setting painted by src/art/scenery in a grid (the first screen, camera at 0), or one
// scene big with a camera to pan, or (rows=SV,NB&s=town) one row of the four seasons per continent. Parameters: ?c=AZ&s=town&season=2&country=AZ-03&seed=7&zoom=3&pan=120   (no c: the grid; zoom defaults 1 in the grid)
import { BASES } from '../scenery/profiles';
import { paintScenery, SCENE_H, SCENE_W, SETTINGS, type Setting } from '../scenery';

const q = new URLSearchParams(location.search);
const one = q.get('c');
const season = q.get('season') ? Number(q.get('season')) : undefined;
const seed = Number(q.get('seed') ?? 0);
const zoom = Number(q.get('zoom') ?? (one ? 3 : 1));
const pan = Number(q.get('pan') ?? 0);
const app = document.getElementById('app')!;

const opt = (label: string, id: string, values: string[], cur: string): string =>
  `<label>${label} <select id="${id}">${values.map((v) => `<option ${v === cur ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
app.innerHTML = `<div class="bar">
  ${opt('ทวีป', 'c', ['(ทั้งหมด)', ...BASES], one ?? '(ทั้งหมด)')}
  ${one ? opt('ฉาก', 's', [...SETTINGS], q.get('s') ?? 'outdoor') : ''}
  ${opt('ฤดู', 'season', ['-', '0', '1', '2', '3'], q.get('season') ?? '-')}
  <label>ประเทศ <input id="country" size="7" value="${q.get('country') ?? ''}" placeholder="AZ-01" /></label>
  <label>seed <input id="seed" size="4" value="${seed}" /></label>
  ${opt('ซูม', 'zoom', ['1', '2', '3', '4'], String(zoom))}
  ${one ? `<label>กล้อง <input id="pan" type="range" min="0" max="640" value="${pan}" /></label>` : ''}
  <span id="info"></span></div><div id="stage"></div><pre id="note"></pre>`;
const set = (id: string, value: string): void => { if (value === '' || value === '-' || value === '(ทั้งหมด)') q.delete(id); else q.set(id, value); };
for (const id of ['c', 's', 'season', 'zoom', 'country', 'seed'])
  (document.getElementById(id) as HTMLInputElement | null)?.addEventListener('change', (e) => { set(id, (e.target as HTMLInputElement).value); location.search = q.toString(); });
const stage = document.getElementById('stage')!;

/** Draw the layers with the camera at `cam` art pixels; each layer follows by its speed and wraps at its width. */
function draw(cv: HTMLCanvasElement, s: ReturnType<typeof paintScenery>, cam: number): void {
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  for (const l of s.layers) {
    const img = document.createElement('canvas');
    img.width = l.frame.w; img.height = l.frame.h;
    img.getContext('2d')!.putImageData(new ImageData(l.frame.data, l.frame.w, l.frame.h), 0, 0);
    const off = Math.round(cam * l.speed) % l.frame.w;
    for (let x = -off; x < SCENE_W; x += l.frame.w) c.drawImage(img, x, 0);
  }
}

function cell(id: string, setting: Setting, cam: number, seasonOf: number | undefined = season): HTMLElement {
  const country = q.get('country') || (setting === 'outdoor' ? undefined : `${id}-01`);
  const t0 = performance.now();
  const s = paintScenery({ continent: id, setting, country, season: seasonOf, seed });
  const ms = performance.now() - t0;
  const el = document.createElement('div');
  el.className = 'cell';
  const cv = document.createElement('canvas');
  cv.width = SCENE_W; cv.height = SCENE_H;
  cv.style.width = `${SCENE_W * zoom}px`; cv.style.height = `${SCENE_H * zoom}px`;
  draw(cv, s, cam);
  el.append(cv);
  el.insertAdjacentHTML('beforeend', `<span>${id} ${setting}${country ? ' ' + country : ''}${seasonOf === undefined ? '' : ' · ฤดู ' + seasonOf} · ${ms.toFixed(0)} ms · ${s.ambient ?? '-'} · ${s.light}</span>`);
  return el;
}

const rows = q.get('rows');
if (rows) {
  // ?rows=SV,NB&s=town: a row per continent, the four seasons side by side (zoom as given)
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.gridTemplateColumns = `repeat(4, ${SCENE_W * zoom}px)`;
  const setting = (q.get('s') ?? 'outdoor') as Setting;
  for (const id of rows.split(',')) for (let n = 0; n < 4; n++) grid.append(cell(id, setting, pan, n));
  stage.append(grid);
} else if (one) {
  const setting = (q.get('s') ?? 'outdoor') as Setting;
  const host = document.createElement('div');
  stage.append(host);
  const render = (cam: number): void => { host.replaceChildren(cell(one, setting, cam)); };
  render(pan);
  document.getElementById('pan')?.addEventListener('input', (e) => render(Number((e.target as HTMLInputElement).value)));
} else {
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.gridTemplateColumns = `repeat(${SETTINGS.length}, ${SCENE_W * zoom}px)`;
  for (const id of BASES) for (const setting of SETTINGS) grid.append(cell(id, setting, pan));
  stage.append(grid);
}
document.getElementById('note')!.textContent = 'กล้องที่ 0 = จอแรกของแต่ละชั้น · เลื่อนกล้องดูชั้นเลื่อนต่างความเร็ว (ฟ้า 0 · ไกล .2 · กลาง .5 · พื้น 1)';
