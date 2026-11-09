// The full map opened from the mini-map of the watch screen (20-god-ui.md §2, row "แผนที่เล็ก"): browse mode (the map pans and zooms, names show on the
// hover, nothing is picked, no miracle is aimed). The clock is paused while it is open and goes on after, like the layers (Layers.tsx) and the god's
// screens: a map is read, not glanced at. Escape or the button closes it.
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { store } from '../app/store';
import { WorldMap } from '../map';
import { color, font, size } from './tokens';

const open = signal(false);
let resumeAfter = false;

export function openMap(): void {
  if (open.value) return;
  resumeAfter = store.running.value;
  store.pause();
  open.value = true;
}

export function closeMap(): void {
  if (!open.value) return;
  open.value = false;
  if (resumeAfter && store.phase.value === 'watch') store.play();
  resumeAfter = false;
}

/** Keys of the watch screen that must not act while the map is over it (the clock keys, the god's screens). The map keeps arrows, W A S D, + − and Home. */
const WATCH_KEYS = new Set([' ', '1', '2', 'c', 'm', 'h']);

export function MapOverlay() {
  void store.rev.value;
  const shown = open.value;
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shown) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMap(); return; }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && WATCH_KEYS.has(e.key.toLowerCase())) e.stopPropagation();
    };
    window.addEventListener('keydown', down, true);
    // the map takes the focus so that the arrows move it at once
    root.current?.querySelector<HTMLElement>('[data-world-map]')?.focus();
    return () => window.removeEventListener('keydown', down, true);
  }, [shown]);
  const data = store.gameData, state = store.state;
  if (!shown || !data || !state) return null;
  return (
    <div ref={root} role="dialog" aria-modal="true" aria-label="แผนที่โลก" data-return-focus data-testid="map-overlay" style={{ position: 'fixed', inset: 0, zIndex: 8, background: color.panel, color: color.text, display: 'flex', flexDirection: 'column', fontFamily: font.body, fontSize: size.text }}>
      <div style={{ flex: 'none', height: size.bar, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${size.pad}px`, borderBottom: `1px solid ${color.line}` }}>
        <span style={{ fontFamily: font.title }}>แผนที่โลก</span>
        <button type="button" onClick={closeMap} data-testid="map-close" style={{ background: color.panel, color: color.text, border: `1px solid ${color.line}`, borderRadius: size.radius, padding: `4px ${size.pad}px`, fontFamily: font.body, fontSize: size.small, cursor: 'pointer' }}>
          ปิด <kbd style={{ fontFamily: font.mono, fontSize: 11, opacity: 0.7 }}>Esc</kbd>
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <WorldMap data={data} state={state} focus={{ kind: 'world' }} pick={false} style={{ height: '100%' }} />
      </div>
    </div>
  );
}
