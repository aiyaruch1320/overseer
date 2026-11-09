// The watch screen as a picture of a model (20-god-ui.md §2): scene, life line, mini-map, god panel, candle, story log, speed, calls, settings.
// It holds no game and no store: `WatchScreen` binds it to the store, the storybook gives it a sample. The scene player and the map are other
// agents' parts and come in as `scene` and `map`; until then each is a placeholder box.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { settingsView, type GodKind, type GodOpen, type WatchModel } from '../../app/views/watch';
import { WATCH_WORDS as W } from '../../app/views/watch-words';
import type { GameData } from '../../core/game';
import type { Settings } from '../../core/types';
import { CardStack, StopPanel } from './calls';
import { Candle, GodPanel, LifeLine, Slot, SpeedControl, StoryLog } from './parts';
import type { RecordView } from './RecordSection';
import { SettingsPanel } from './SettingsPanel';
import { button, css, layout } from './style';
import { TITLE_LINE, color, font, size } from '../tokens';

export interface WatchActions {
  /** Open a god screen (another agent builds them). */
  onOpenGod: (open: GodOpen) => void;
  setSpeed: (s: Settings['speed']) => void;
  /** Pause when the clock runs, go on when it does not. */
  togglePause: () => void;
  /** The player goes on after a stop. */
  resume: () => void;
  /** A patch of the settings; returns why the core refused it, or null. */
  setSettings: (patch: Partial<Settings>) => string | null;
  /** Saves the game; says what came of it (a short line for the player: saved, or why not). */
  save?: () => Promise<{ ok: boolean; text: string }> | void;
}

export interface WatchViewProps {
  data: GameData;
  model: WatchModel;
  settings: Settings;
  actions: WatchActions;
  candlePct: boolean;
  onCandlePct: (on: boolean) => void;
  scene?: ComponentChildren;
  map?: ComponentChildren;
  /** The storybook opens the settings panel at once. */
  settingsOpen?: boolean;
  /** The play record and the A/B (settings panel); the storybook leaves it out. */
  record?: RecordView;
}

const typing = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

const KEY_GOD: Record<string, GodKind> = { c: 'chest', d: 'dream', w: 'whisper', m: 'miracle', h: 'chronicle' };

export function WatchView({ data, model, settings, actions, candlePct, onCandlePct, scene, map, settingsOpen = false, record }: WatchViewProps) {
  const [settingsShown, showSettings] = useState(settingsOpen);
  const [saveNote, setSaveNote] = useState<{ ok: boolean; text: string } | null>(null);
  const saveTimer = useRef(0);
  const doSave = async () => {
    const r = await actions.save?.();
    if (!r) return;
    setSaveNote(r);
    clearTimeout(saveTimer.current);
    // a failure stays until the next try: the player must not miss that nothing was stored
    if (r.ok) saveTimer.current = window.setTimeout(() => setSaveNote(null), 4000);
  };
  useEffect(() => () => clearTimeout(saveTimer.current), []);
  const live = useRef({ model, actions, settingsShown });
  live.current = { model, actions, settingsShown };
  // Space past an ally in crisis whose card still waits warns once (the second press goes on): the stop it was said for
  const [crisisWarn, setCrisisWarn] = useState<number | null>(null);
  const warned = useRef(new Set<number>());

  // Space pauses or goes on; 1 and 2 are the speeds; C D W M H open the god's five screens. Nothing while typing, with a modifier, or over the settings.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const { model: m, actions: a, settingsShown: s } = live.current;
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey || s) return;
      // W A S D move a map that has the focus: they are not the whisper then
      if ('wasd'.includes(e.key.toLowerCase()) && e.key.length === 1 && (e.target as Element | null)?.closest?.('[data-world-map]')) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (m.stop && !m.stop.death) {
          const stopN = m.stop.n;
          if ([...m.stop.cards, ...m.cards].some((c) => c.kind === 'crisis') && !warned.current.has(stopN)) {
            warned.current.add(stopN);
            setCrisisWarn(stopN);
            return;
          }
          a.resume();
        } else if (!m.stop) a.togglePause();
        return;
      }
      if (e.key === '1') a.setSpeed('normal');
      else if (e.key === '2') a.setSpeed('fast');
      else if (KEY_GOD[e.key.toLowerCase()] && m.panel.alive && !m.panel.gates[KEY_GOD[e.key.toLowerCase()]]) a.onOpenGod({ kind: KEY_GOD[e.key.toLowerCase()], args: {} });
    };
    // a button that has the focus would also press itself on the key up of the space: the space is the screen's
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' && !typing(e.target) && !live.current.settingsShown) e.preventDefault();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const { stop, cards } = model;
  const open = (o: GodOpen) => actions.onOpenGod(o);
  return (
    <div class="wt-root" style={{ position: 'relative', display: 'grid', gridTemplateColumns: `1fr ${layout.panelWidth}px`, height: '100vh', minWidth: size.minWidth, minHeight: size.minHeight, background: color.panel, color: color.text, fontFamily: font.body, fontSize: size.text }} data-testid="watch">
      <style>{css}</style>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, padding: size.pad }}>
          <div style={{ position: 'absolute', inset: size.pad, filter: stop ? 'brightness(0.55)' : 'none', transition: 'filter 0.5s' }}>{scene ?? <Slot title={W.scene} note={W.sceneNote} style={{ width: '100%', height: '100%' }} />}</div>

          <div style={{ position: 'absolute', left: size.pad * 2, top: size.pad * 2, display: 'flex', flexDirection: 'column', gap: size.gap, zIndex: 1 }}>
            <div data-testid="who">
              <div style={{ fontFamily: font.title, fontSize: size.title, lineHeight: TITLE_LINE }}>{model.name}</div>
              {model.age !== null && (
                <div style={{ color: color.textDim, fontSize: size.small }}>
                  {W.age} {model.age}
                </div>
              )}
            </div>
            {model.candle && <Candle candle={model.candle} showPct={candlePct} />}
          </div>

          <div style={{ position: 'absolute', right: size.pad * 2, top: size.pad * 2, width: layout.mapWidth, height: layout.mapHeight, zIndex: 1 }}>
            {map ?? <Slot title={W.map} style={{ width: '100%', height: '100%', background: color.panel }} />}
          </div>

          {!stop && <CardStack cards={cards} onOpen={open} />}
          {stop && <StopPanel stop={stop} onOpen={open} onContinue={actions.resume} warn={crisisWarn === stop.n} />}
        </div>
        <StoryLog log={model.log} before={model.before} note={model.startNote} />
        <LifeLine line={model.line} />
      </div>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: size.gap, padding: size.pad, borderLeft: `1px solid ${color.line}` }}>
        <GodPanel panel={model.panel} onOpen={(kind) => actions.onOpenGod({ kind, args: {} })} />
        <div style={{ flex: 1 }} />
        <SpeedControl speed={model.speed} running={model.running} onSpeed={actions.setSpeed} />
        {model.slowed && (
          <div role="status" style={{ color: color.textDim, fontSize: size.small, lineHeight: 1.4 }} data-testid="slowed-note">
            {W.slowedNote}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4 }}>
          <button class="wt-btn" style={{ ...button, flex: 1 }} onClick={() => showSettings(true)} data-testid="open-settings">
            {W.settings.open}
          </button>
          {actions.save && (
            <button class="wt-btn" style={{ ...button, flex: 1 }} onClick={() => void doSave()} data-testid="save">
              {W.save}
            </button>
          )}
        </div>
        <div role="status" aria-live="polite" style={{ minHeight: saveNote ? undefined : 0, fontSize: size.small, lineHeight: 1.35, color: saveNote?.ok ? color.light : color.dreadText }} data-testid="save-note">
          {saveNote?.text}
        </div>
      </aside>

      {settingsShown && (
        <SettingsPanel view={settingsView(data, settings)} settings={settings} candlePct={candlePct} onChange={actions.setSettings} onCandlePct={onCandlePct} onClose={() => showSettings(false)} record={record} />
      )}
    </div>
  );
}
