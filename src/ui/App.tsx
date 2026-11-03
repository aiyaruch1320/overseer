// The game page: one screen per phase of the store. The screens of code-plan §8.2 fill these places in M5; until then each place
// shows the plain text of the tools so a life can be played from birth to death on the page.
import { store } from '../app/store';
import { WatchScreen } from './watch';
import { color, font, size } from './tokens';

const page = { background: color.panel, color: color.text, fontFamily: font.body, fontSize: size.text, minHeight: '100vh', padding: size.pad } as const;

export function App() {
  void store.rev.value;
  const phase = store.phase.value;
  if (phase === 'loading') return <div style={page}>กำลังโหลดข้อมูลของโลก…</div>;
  if (phase === 'start') return <Start />;
  // the god screens are wired here when they merge (M5): the watch screen asks for them with `onOpenGod`
  return <WatchScreen onOpenGod={() => undefined} />;
}

function Start() {
  return (
    <div style={page}>
      <button onClick={() => store.newLife({ seed: Math.floor(Math.random() * 1e6) })}>เริ่มชีวิตใหม่</button>{' '}
      <button onClick={() => store.loadLocal()}>เล่นต่อจากที่บันทึก</button>
    </div>
  );
}
