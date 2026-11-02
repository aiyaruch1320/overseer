// The debug page of the system phase (docs/guide/code-plan.md §8.0): plain HTML, a log, buttons that advance the clock,
// the values of the life. Not a screen of the game. Open it from the dev server at /debug.html.
// Data comes from data/gen/ and data/library/ through Vite imports; the game is driven by the same session code as `npm run life`.
import type { GameData } from '../../core/game';
import { npcsAt } from '../../core/npc';
import { placeName } from '../../core/text';
import { statusLines, timeline, worldLines } from '../../../scripts/tools/report';
import { GodConsole, callLines, godHelp } from '../../../scripts/tools/god-commands';
import { POLICIES, afterBeat, createSession, runToCall, runToDeath, startLife, stepBeat, toolNotes, type Policy, type Session } from '../../../scripts/tools/session';

const gen = import.meta.glob('../../../data/gen/*.json', { import: 'default' }) as Record<string, () => Promise<{ version: string; items: unknown }>>;
const lib = import.meta.glob('../../../data/library/*.jsonl', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function loadData(): Promise<GameData> {
  const data: GameData = {};
  for (const [path, load] of Object.entries(gen)) {
    const name = path.replace(/^.*\//, '').replace(/\.json$/, '');
    data[name] = await load();
  }
  for (const [path, load] of Object.entries(lib)) {
    const name = path.replace(/^.*\//, '').replace(/\.jsonl$/, '');
    const text = await load();
    data[`library.${name}`] = { version: `lib-${text.length}`, items: text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as unknown) };
  }
  return data;
}

let session: Session | null = null;
let god: GodConsole | null = null;

function show() {
  if (!session) return;
  const g = session.game;
  const st = g.state;
  const level = Number(el<HTMLSelectElement>('level').value) as 0 | 1 | 2 | 3;
  el('notes').textContent = session.notes.join('\n') || '(ไม่มี)';
  el('status').textContent = [...statusLines(session.data, st), '', '-- โลก (ดีบัก) --', ...worldLines(st)].join('\n');
  const lines = timeline(session.data, st.log, level, { notes: toolNotes(st) });
  el('log').textContent = lines.slice(-300).join('\n');
  const life = st.life;
  el('npcs').textContent = life
    ? npcsAt(g.ctx, life.country)
        .map((v) => `${v.id} ${v.name}${v.role ? ` (${v.role})` : ''} · อายุ ${v.age} · ${v.story === 'open' ? 'เรื่องเปิดอยู่' : v.story === 'wait' ? 'รอ' : 'จบแล้ว'} · ที่ ${placeName(g.ctx, v.place) ?? v.place}`)
        .join('\n')
    : '';
  el('life').textContent = life ? JSON.stringify(life, null, 1) : '';
}

function start(data: GameData) {
  const opts = {
    seed: Number(el<HTMLInputElement>('seed').value) || 1,
    race: el<HTMLInputElement>('race').value.trim() || undefined,
    startYear: Number(el<HTMLInputElement>('year').value) || undefined,
    policy: (el<HTMLSelectElement>('policy').value || undefined) as Policy | undefined,
  };
  session = createSession(data, opts);
  startLife(session);
  god = new GodConsole({ game: session.game, data, dev: true });
  el('god').hidden = false;
  el('godout').textContent = godHelp().join('\n');
  el('controls').hidden = false;
  show();
}

function advance(beats: number) {
  if (!session) return;
  const g = session.game;
  god?.drop();
  for (let i = 0; i < beats && g.state.life && !g.state.life.dead; i++) {
    stepBeat(g);
    afterBeat(session);
  }
  show();
}

function godPanel() {
  const panel = document.createElement('div');
  panel.id = 'god';
  panel.hidden = true;
  panel.innerHTML = [
    '<h2>คำสั่งพระเจ้า</h2>',
    '<p>พิมพ์คำสั่งแล้วกด Enter: ทุกคำสั่งที่เปลี่ยนโลกแสดงตัวอย่างผลก่อน แล้วกด yes เพื่อทำจริง หรือ no เพื่อยกเลิก</p>',
    '<form id="godform"><input id="godtext" type="text" size="50" placeholder="เช่น chest · pick 2 · dream 1 · whisper ระวัง · miracle MR-04" /> <button type="submit">ส่ง</button></form>',
    '<p id="godbtns"></p>',
    '<pre id="godout"></pre>',
  ].join('');
  const controls = el('controls');
  controls.insertAdjacentElement('afterend', panel);
  const btns = panel.querySelector('#godbtns') as HTMLElement;
  for (const c of ['chest', 'reroll', 'skip', 'power', 'options', 'yes', 'no', 'help']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = c;
    b.dataset.god = c;
    btns.append(b, ' ');
  }
}

function sendGod(text: string) {
  if (!session || !god) return;
  const t = text.trim();
  if (!t) return;
  const out = t === 'help' ? godHelp() : god.handle(t) ?? [`คำสั่งไม่รู้จัก: "${t}" (กด help)`];
  el('godout').textContent = [`> ${t}`, ...out, '', el('godout').textContent ?? ''].join('\n').slice(0, 20000);
  show();
}

loadData().then(async (data) => {
  godPanel();
  const sel = el<HTMLSelectElement>('policy');
  sel.replaceChildren(new Option('(ไม่ระบุ)', ''), ...POLICIES.map((p) => new Option(p, p)));
  el('godform').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = el<HTMLInputElement>('godtext');
    sendGod(input.value);
    input.value = '';
  });
  el('godbtns').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (b?.dataset.god) sendGod(b.dataset.god);
  });
  el('loading').hidden = true;
  const form = el<HTMLFormElement>('new');
  form.hidden = false;
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    start(data);
  });
  el('controls').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b || !session) return;
    if (b.dataset.beats) advance(Number(b.dataset.beats));
    else if (b.dataset.call) {
      god?.drop();
      const r = runToCall(session.game, undefined, () => void afterBeat(session!));
      show();
      if (r.call && god) el('godout').textContent = [...callLines(data, r.call, true), `ทำได้ตอนนี้: ${god.doableNow().join(' ') || '(ยังไม่มีพลังใด)'}`, '', el('godout').textContent ?? ''].join('\n');
    } else if (b.dataset.death) {
      god?.drop();
      runToDeath(session.game, undefined, () => void afterBeat(session!));
      show();
    }
  });
  el('level').addEventListener('change', show);
  start(data);
}).catch((err: unknown) => {
  el('loading').textContent = `โหลดไม่สำเร็จ: ${String(err)}`;
});
