// Screens laid over the watch screen (code-plan §8.2: ศึก · พวกพ้องและครอบครัว · ตัวละคร): a small bar opens them (or the keys P A B G), Escape or the back
// button of each screen closes them. The clock is paused while one is open and goes on after, like the god's screens. The layer is one box that fits the
// window: a strip with the bar on top and the screen under it, scrolling in one place only.
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { store } from '../app/store';
import { AlliesScreen } from './allies';
import { BattleView, WarPanel, battleEntries, battleModelAt, currentWar } from './battle';
import { CharacterScreen } from './character';
import { BridgeCtx, storeBridge } from './god/bridge';
import { ConfirmDialog, DoneBox, doneBox, pendingAct, askGod } from './god/confirm';
import { GodStyles } from './god/style';
import { canWhisperTo, godOpen, openGod } from './god';
import { color, font, size } from './tokens';

type Layer = 'character' | 'allies' | 'battle' | 'war';

/** Labels of the bar (chrome words, not game text: code-plan §8.1 rule 2 covers the game's words) and the key of each (the watch screen keeps C D W M H, Space, 1, 2). */
const LABEL: Record<Layer, string> = { character: 'ตัวละคร', allies: 'พวกพ้อง', battle: 'ศึกล่าสุด', war: 'สงคราม' };
export const LAYER_KEY: Record<Layer, string> = { character: 'P', allies: 'A', battle: 'B', war: 'G' };
/** The whisper the allies screen asks for on a person in a crisis (god/acts whisper hint "ช่วย"). */
const HELP_HINT = 'ช่วย';


const layer = signal<Layer | null>(null);
let resumeAfter = false;

function open(l: Layer): void {
  if (!layer.value) {
    resumeAfter = store.running.value;
    store.pause();
  }
  layer.value = l;
}

function close(): void {
  if (!layer.value) return;
  layer.value = null;
  if (resumeAfter && store.phase.value === 'watch') store.play();
  resumeAfter = false;
}

const typing = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

/** Something else holds the screen: a god's screen, its confirm dialog, the settings. The keys of the layers wait. */
const covered = (): boolean => !!document.querySelector('.g-root, [aria-modal="true"]');

const CSS = `
.ly-body > * { height: auto !important; min-height: 100% !important; }
.ly-btn { min-height: 32px; display: inline-flex; align-items: center; gap: 6px; }
.ly-btn:hover { border-color: ${color.textDim}; }
.ly-btn:focus-visible { outline: 2px solid ${color.light}; outline-offset: 2px; }
`;

/** The bar of the watch screen and the open layer. */
export function Layers() {
  void store.rev.value;
  const st = store.state;
  const data = store.gameData;
  const alive = !!st && !!data && !!st.life;
  const lastBattle = st ? battleEntries(st).at(-1) : undefined;
  const war = st && data ? currentWar(data, st) : undefined;
  const shown: Layer[] = ['character', 'allies', ...(lastBattle ? (['battle'] as const) : []), ...(war ? (['war'] as const) : [])];
  const l = layer.value;

  // keys: P A B G open (the same key again closes), Escape closes. Nothing while typing, with a modifier, or under another screen.
  useEffect(() => {
    if (!alive) return;
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (doneBox.value) doneBox.value = null;
        else if (layer.value && !covered() && !pendingAct.value) close();
        return;
      }
      const k = (Object.keys(LAYER_KEY) as Layer[]).find((x) => LAYER_KEY[x].toLowerCase() === e.key.toLowerCase());
      if (!k || e.repeat || covered() || store.phase.value === 'death') return;
      // the map moves with A (and W S D) when it has the focus
      if ((e.target as Element | null)?.closest?.('[data-world-map]')) return;
      if (!shown.includes(k)) return;
      e.preventDefault();
      if (layer.value === k) close();
      else open(k);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  if (!alive || !st || !data) return null;
  const bar = (
    <div role="toolbar" aria-label="ชั้นของหน้าเฝ้ามอง" style={{ display: 'flex', gap: size.gap }} data-testid="layer-bar">
      {shown.map((k) => (
        <button
          key={k}
          type="button"
          class="ly-btn"
          aria-pressed={l === k}
          aria-keyshortcuts={LAYER_KEY[k]}
          onClick={() => (l === k ? close() : open(k))}
          style={{ background: l === k ? color.light : color.panel, color: l === k ? color.panel : color.text, border: `1px solid ${l === k ? color.light : color.line}`, borderRadius: size.radius, padding: `4px ${size.pad}px`, fontFamily: font.body, fontSize: size.small, cursor: 'pointer' }}
          data-testid={`layer-${k}`}
        >
          {LABEL[k]}
          <kbd style={{ fontFamily: font.mono, fontSize: 11, opacity: 0.7 }}>{LAYER_KEY[k]}</kbd>
        </button>
      ))}
    </div>
  );
  return (
    <>
      <style>{CSS}</style>
      {!l && <div style={{ position: 'fixed', left: '50%', top: size.gap, transform: 'translateX(-50%)', zIndex: 5 }}>{bar}</div>}
      {l && (
        <div data-return-focus style={{ position: 'fixed', inset: 0, background: color.panel, zIndex: 4, display: 'flex', flexDirection: 'column' }} data-testid="layer">
          <div style={{ flex: 'none', height: size.bar, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `1px solid ${color.line}` }}>{bar}</div>
          <div class="ly-body" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {l === 'character' && <CharacterScreen onBack={close} />}
            {l === 'allies' && (
              <AlliesScreen
                onClose={close}
                // a tie the god may whisper to goes straight to the confirm; one the rules do not let him reach (family: 20-god-ui.md §5 names no such target) opens the whisper screen, which says who can be reached
                onWhisper={(name) => (store.game && canWhisperTo(store.game, name) ? askGod('whisper', { hint: HELP_HINT, target: name }) : openGod('whisper', {}))}
              />
            )}
            {l === 'battle' && lastBattle && (() => {
              const m = battleModelAt(data, st, lastBattle.n);
              return m ? <BattleView model={m} autoplay onClose={close} /> : null;
            })()}
            {l === 'war' && <WarPanel war={war ?? null} onClose={close} />}
          </div>
          <WhisperHost />
        </div>
      )}
    </>
  );
}

/**
 * The confirm dialog of the god's actions lives in the god's panel, which is not open while a layer is. A button of a layer (the allies' whisper)
 * asks `askGod`, and this shows the same dialog, and what the act brought, over the layer.
 */
function WhisperHost() {
  void store.rev.value;
  const pending = pendingAct.value;
  const done = doneBox.value;
  if (godOpen.value || (!pending && !done)) return null;
  return (
    <BridgeCtx.Provider value={storeBridge}>
      <GodStyles />
      {pending ? (
        <div class="g-root" style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          <ConfirmDialog />
        </div>
      ) : (
        <div style={{ position: 'fixed', left: '50%', top: size.bar + size.gap, transform: 'translateX(-50%)', zIndex: 60, width: 'min(560px, 92vw)', color: color.text, fontFamily: font.body, fontSize: size.text }}>
          <DoneBox />
        </div>
      )}
    </BridgeCtx.Provider>
  );
}
