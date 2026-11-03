// The game page: one screen per phase of the store (code-plan §8.2). The god screens, the map and the scene player join the watch
// screen when they merge (M5).
import { store } from '../app/store';
import { EndScreen } from './end';
import { StartScreen } from './start';
import { WatchScreen } from './watch';
import { color, font, size } from './tokens';

const page = { background: color.panel, color: color.text, fontFamily: font.body, fontSize: size.text, minHeight: '100vh', padding: size.pad } as const;

export function App() {
  void store.rev.value;
  const phase = store.phase.value;
  if (phase === 'loading') return <div style={page}>กำลังโหลดข้อมูลของโลก…</div>;
  if (phase === 'start') return <StartScreen />;
  if (phase === 'death') return <EndScreen />;
  // the watch screen asks for a god screen with `onOpenGod` (wired when the god screens merge)
  return <WatchScreen onOpenGod={() => undefined} />;
}
