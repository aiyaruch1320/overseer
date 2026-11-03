// The game page: one screen per phase of the store (code-plan §8.2). The watch screen holds the life's scene (LifeScene) and the mini-map;
// the miracle's aim draws the full map (god-map.tsx).
import { store } from '../app/store';
import { EndScreen } from './end';
import { GodPanel, openGod } from './god';
import { WorldMap } from '../map';
import { LifeScene } from './LifeScene';
import { Layers } from './Layers';
import './god-map';
import { StartScreen } from './start';
import { WatchScreen } from './watch';
import { color, font, size } from './tokens';

/** The mini-map slot of the watch screen is 200 px wide (src/ui/watch/style.ts `layout.mapWidth`). */
const MINI_MAP_WIDTH = 200;

const page = { background: color.panel, color: color.text, fontFamily: font.body, fontSize: size.text, minHeight: '100vh', padding: size.pad } as const;

export function App() {
  void store.rev.value;
  const phase = store.phase.value;
  if (phase === 'loading') return <div style={page}>กำลังโหลดข้อมูลของโลก…</div>;
  if (phase === 'start') return <StartScreen />;
  if (phase === 'death') return <EndScreen />;
  // the watch screen's buttons open the god's screens; `decree` is the miracle of fate (MR-25, 20-god-ui.md §7)
  return (
    <>
      <WatchScreen
        onOpenGod={(o) => (o.kind === 'decree' ? openGod('miracle', { id: 'MR-25', tab: 'fate', ...o.args }) : openGod(o.kind, o.args))}
        map={store.gameData && store.state ? <WorldMap data={store.gameData} state={store.state} mini width={MINI_MAP_WIDTH} /> : undefined}
        scene={<LifeScene />}
      />
      <Layers />
      <GodPanel />
    </>
  );
}
