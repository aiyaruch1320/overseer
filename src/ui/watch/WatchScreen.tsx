// The watch screen bound to the store (the main screen of the whole life): it reads the state after every beat, turns it into a model,
// and sends the player's choices to the store. The god screens are not here: a button emits `onOpenGod` and the host opens the screen.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { store } from '../../app/store';
import { prefs, setPrefs } from '../../app/views/prefs';
import { watchModel, type GodOpen } from '../../app/views/watch';
import type { Settings } from '../../core/types';
import { WatchView, type WatchActions } from './WatchView';

export interface WatchScreenProps {
  /** The player pressed a god button, or a button of a call: open that screen. */
  onOpenGod: (open: GodOpen) => void;
  /** The scene player (another agent's part) and the mini-map; a placeholder box until they come. */
  scene?: ComponentChildren;
  map?: ComponentChildren;
}

export function WatchScreen({ onOpenGod, scene, map }: WatchScreenProps) {
  void store.rev.value;
  const st = store.state;
  const data = store.gameData;
  const slowed = useRef(false);
  const cards = store.cards.value;
  const speed = st?.settings.speed;

  // 07-attention.md §2: a card brings the fast speed back to normal until the card is gone
  useEffect(() => {
    if (!speed) return;
    if (cards.length > 0 && speed === 'fast' && !slowed.current) {
      slowed.current = true;
      store.setSettings({ speed: 'normal' });
    } else if (cards.length === 0 && slowed.current) {
      slowed.current = false;
      if (speed === 'normal') store.setSettings({ speed: 'fast' });
    }
  }, [cards.length, speed]);

  if (!st || !data) return null;
  const phase = store.phase.value;
  const halted = phase === 'stop' || phase === 'death';

  const setSpeed = (s: Settings['speed']): void => {
    slowed.current = false;
    if (s === 'pause') {
      store.setSettings({ speed: 'pause' });
      store.pause();
      return;
    }
    store.setSettings({ speed: s });
    if (!halted) store.play();
  };

  const actions: WatchActions = {
    onOpenGod,
    setSpeed,
    togglePause: () => (store.running.value && st.settings.speed !== 'pause' ? setSpeed('pause') : setSpeed(st.settings.speed === 'pause' ? 'normal' : st.settings.speed)),
    resume: () => store.resume(),
    setSettings: (patch) => {
      if (patch.speed) {
        // the speed is the clock's business too
        const { speed: s, ...rest } = patch;
        if (Object.keys(rest).length) {
          const r = store.setSettings(rest);
          if (!r.ok) return r.reason;
        }
        setSpeed(s);
        return null;
      }
      const r = store.setSettings(patch);
      return r.ok ? null : r.reason;
    },
    save: () => void store.saveLocal(),
  };

  const model = watchModel(data, st, { running: store.running.value, stop: phase === 'stop' || phase === 'death' ? store.stopCall.value : null, cards });
  return <WatchView data={data} model={model} settings={st.settings} actions={actions} candlePct={prefs.value.candlePct} onCandlePct={(on) => setPrefs({ candlePct: on })} scene={scene} map={map} />;
}
