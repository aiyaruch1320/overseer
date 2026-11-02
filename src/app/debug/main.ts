// The debug page of the system phase (docs/guide/code-plan.md §8.0): plain HTML, a log, buttons that advance the clock,
// the values of the life. Not a screen of the game. Open it from the dev server at /debug.html.
// Data comes from data/gen/ and data/library/ through Vite imports; the game is driven by the same session code as `npm run life`.
import type { GameData } from '../../core/game';
import { npcsAt } from '../../core/npc';
import { placeName } from '../../core/text';
import { statusLines, timeline } from '../../../scripts/tools/report';
import { createSession, runToCall, runToDeath, startLife, type Policy, type Session } from '../../../scripts/tools/session';

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

function show() {
  if (!session) return;
  const g = session.game;
  const st = g.state;
  const level = Number(el<HTMLSelectElement>('level').value) as 0 | 1 | 2 | 3;
  el('notes').textContent = session.notes.join('\n') || '(ไม่มี)';
  el('status').textContent = statusLines(session.data, st).join('\n');
  const lines = timeline(session.data, st.log, level);
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
  el('controls').hidden = false;
  show();
}

function advance(beats: number) {
  if (!session) return;
  const g = session.game;
  for (let i = 0; i < beats && g.state.life && !g.state.life.dead; i++) g.beat();
  show();
}

loadData().then((data) => {
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
      runToCall(session.game);
      show();
    } else if (b.dataset.death) {
      runToDeath(session.game);
      show();
    }
  });
  el('level').addEventListener('change', show);
  start(data);
}).catch((err: unknown) => {
  el('loading').textContent = `โหลดไม่สำเร็จ: ${String(err)}`;
});
