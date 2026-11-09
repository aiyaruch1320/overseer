// The game page: one screen per phase of the store (code-plan §8.2). The watch screen holds the life's scene (LifeScene) and the mini-map;
// the miracle's aim draws the full map (god-map.tsx), and a click on the mini-map opens it to browse (MapOverlay.tsx).
import { SAVE_WORDS } from '../app/save-words';
import { store } from '../app/store';
import { useFocusReturn } from './focus';
import { EndScreen } from './end';
import { GodPanel, openGod } from './god';
import { WorldMap } from '../map';
import { LifeScene } from './LifeScene';
import { MapOverlay, openMap } from './MapOverlay';
import { Layers } from './Layers';
import './god-map';
import { StartScreen, VowChoice } from './start';
import { WatchScreen } from './watch';
import { color, font, size } from './tokens';

/** The mini-map slot of the watch screen is 200 px wide (src/ui/watch/style.ts `layout.mapWidth`). */
const MINI_MAP_WIDTH = 200;

const page = { background: color.panel, color: color.text, fontFamily: font.body, fontSize: size.text, minHeight: '100vh', padding: size.pad } as const;

/** A line over every screen until the player takes it in: the data of the game moved since the save that was loaded (code-plan §5.3). */
function Notice() {
  const text = store.notice.value;
  if (!text) return null;
  return (
    <div role="status" style={{ position: 'fixed', left: '50%', bottom: size.pad, transform: 'translateX(-50%)', zIndex: 3, maxWidth: 'min(760px, 92vw)', display: 'flex', gap: size.pad, alignItems: 'center', background: color.panel, color: color.text, border: `1px solid ${color.light}`, borderRadius: size.radius, padding: `${size.gap}px ${size.pad}px`, fontFamily: font.body, fontSize: size.small, lineHeight: 1.45, boxShadow: '0 4px 18px #000a' }} data-testid="notice">
      <span>{text}</span>
      <button type="button" onClick={() => (store.notice.value = null)} style={{ flex: 'none', background: 'transparent', color: color.light, border: `1px solid ${color.light}`, borderRadius: size.radius, padding: '4px 12px', fontFamily: font.body, fontSize: size.small, cursor: 'pointer' }}>
        {SAVE_WORDS.dismiss}
      </button>
    </div>
  );
}

export function App() {
  void store.rev.value;
  useFocusReturn();
  return (
    <>
      <Screen />
      <Notice />
    </>
  );
}

function Screen() {
  const phase = store.phase.value;
  if (phase === 'loading') return <div style={page}>กำลังโหลดข้อมูลของโลก…</div>;
  if (phase === 'start') return <StartScreen />;
  if (phase === 'death') return <EndScreen />;
  // the watch screen's buttons open the god's screens; `decree` is the miracle of fate (MR-25, 20-god-ui.md §7)
  return (
    <>
      <WatchScreen
        onOpenGod={(o) => (o.kind === 'decree' ? openGod('miracle', { id: 'MR-25', tab: 'fate', ...o.args }) : openGod(o.kind, o.args))}
        map={store.gameData && store.state ? <WorldMap data={store.gameData} state={store.state} mini width={MINI_MAP_WIDTH} onOpen={openMap} /> : undefined}
        scene={<LifeScene />}
      />
      <Layers />
      <MapOverlay />
      {/* the vow of an heir who is born before 15, and the one change at 15 (08-goals; the first life takes its vow on the start sheet): the box draws nothing while no choice is open */}
      <VowChoice modal />
      <GodPanel />
    </>
  );
}
