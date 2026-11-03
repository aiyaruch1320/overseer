// The game page: one screen per phase of the store. The screens of code-plan §8.2 fill these places in M5; until then each place
// shows the plain text of the tools so a life can be played from birth to death on the page.
import { store } from '../app/store';
import { callText, clockOf, purseOf, storyLines } from '../app/view';
import { color, font, size } from './tokens';

const page = { background: color.panel, color: color.text, fontFamily: font.body, fontSize: size.text, minHeight: '100vh', padding: size.pad } as const;

export function App() {
  void store.rev.value;
  const phase = store.phase.value;
  if (phase === 'loading') return <div style={page}>กำลังโหลดข้อมูลของโลก…</div>;
  if (phase === 'start') return <Start />;
  return <Watch />;
}

function Start() {
  return (
    <div style={page}>
      <button onClick={() => store.newLife({ seed: Math.floor(Math.random() * 1e6) })}>เริ่มชีวิตใหม่</button>{' '}
      <button onClick={() => store.loadLocal()}>เล่นต่อจากที่บันทึก</button>
    </div>
  );
}

function Watch() {
  const st = store.state;
  const data = store.gameData;
  if (!st || !data) return null;
  const c = clockOf(st);
  const p = purseOf(st);
  const stop = store.stopCall.value;
  return (
    <div style={page}>
      <div>
        {c.name} · อายุ {c.age} · แสง {p.light} · ความกลัว {p.dread} · ศรัทธาเทพ {p.belief ?? '-'}{' '}
        {store.running.value ? <button onClick={() => store.pause()}>หยุด</button> : <button onClick={() => store.resume()}>เดินต่อ</button>}{' '}
        <button onClick={() => store.saveLocal()}>บันทึก</button>
        {store.phase.value === 'death' && <button onClick={() => store.nextLife()}>รุ่นต่อไป</button>}
      </div>
      {stop && <pre style={{ color: color.light, whiteSpace: 'pre-wrap' }}>{callText(data, stop).join('\n')}</pre>}
      {store.cards.value.map((e) => (
        <pre key={e.n} style={{ color: color.fate, whiteSpace: 'pre-wrap' }}>{callText(data, e).join('\n')}</pre>
      ))}
      <pre style={{ whiteSpace: 'pre-wrap' }}>{storyLines(data, st).slice(-60).map((l) => l.text).join('\n')}</pre>
    </div>
  );
}
