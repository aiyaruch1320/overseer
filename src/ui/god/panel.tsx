// The god's screens in one place. The watch screen mounts `<GodPanel />` once and opens a power with `openGod(kind, args)` (from the five buttons of the
// panel, or from a stop or a card: a waiting prayer opens as `openGod('prayer', { id })`). While a power is open the clock is paused, and goes on when it
// is closed if it was running (a preview would be old otherwise: 06-implementation.md §3 asks the player to confirm what was shown).
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { godKindTitle, GOD_KINDS, powerView, type GodKind } from '../../app/views/god';
import { W } from '../../app/views/god-words';
import { store } from '../../app/store';
import { color, size } from '../tokens';
import { BridgeCtx, storeBridge, useView, type GodBridge } from './bridge';
import { Chest } from './chest';
import { Chronicle } from './chronicle';
import { ConfirmDialog, DoneBox, doneBox, pendingAct, registerPanelHook } from './confirm';
import { Conjure } from './conjure';
import { Dream } from './dream';
import { godFull } from './layout';
import { Miracle } from './miracle';
import { Prayer } from './prayer';
import { GodStyles, col, row } from './style';
import { Whisper } from './whisper';

export interface GodOpen {
  kind: GodKind;
  /** What the kind takes: `prayer` `{ id }` (the number of the card) · `miracle` `{ id, tab }` · `whisper` `{ hint }`. */
  args: Record<string, unknown>;
}

/** The power open now, or null. */
export const godOpen = signal<GodOpen | null>(null);

let resumeAfter = false;

/** Opens a power of the god (and pauses the clock of the page). */
export function openGod(kind: GodKind, args: Record<string, unknown> = {}): void {
  if (!godOpen.value && store.game) {
    resumeAfter = store.running.value;
    store.pause();
  }
  pendingAct.value = null;
  doneBox.value = null;
  godOpen.value = { kind, args };
}

/** Closes the power and lets the clock go on if it was running when the power opened. */
export function closeGod(): void {
  pendingAct.value = null;
  doneBox.value = null;
  if (!godOpen.value) return;
  godOpen.value = null;
  if (resumeAfter && store.phase.value === 'watch') store.play();
  resumeAfter = false;
}

const KIND_OF_ACTION: Record<string, GodKind> = { whisper: 'whisper', miracle: 'miracle', decree: 'miracle', conjure: 'conjure', 'dream.send': 'dream', 'prayer.answer': 'prayer' };
registerPanelHook({
  isOpen: () => !!godOpen.value,
  open: (action, args) => openGod(KIND_OF_ACTION[action] ?? 'chest', action === 'whisper' ? { hint: args.hint, target: args.target } : action === 'miracle' && typeof args.id === 'string' ? { id: args.id } : {}),
});

function Body(p: { open: GodOpen }): JSX.Element {
  const a = p.open.args;
  switch (p.open.kind) {
    case 'chest':
      return <Chest />;
    case 'dream':
      return <Dream />;
    case 'whisper':
      return <Whisper hint={typeof a.hint === 'string' ? a.hint : undefined} why={typeof a.why === 'string' ? a.why : undefined} id={typeof a.id === 'string' ? a.id : undefined} target={typeof a.target === 'string' ? a.target : undefined} />;
    case 'prayer':
      return <Prayer id={typeof a.id === 'number' ? a.id : undefined} />;
    case 'miracle':
      return <Miracle id={typeof a.id === 'string' ? a.id : undefined} tab={typeof a.tab === 'string' ? a.tab : undefined} />;
    case 'conjure':
      return <Conjure />;
    case 'chronicle':
      return <Chronicle />;
  }
}

function Purse() {
  const p = useView((g) => powerView(g));
  if (!p) return null;
  return (
    <span class="g-small" aria-label="power">
      <span style={{ color: color.light }}>
        ● {W.light} {p.light}
      </span>{' '}
      <span style={{ color: color.dreadText }}>
        ● {W.dread} {p.dread}
      </span>
      {p.belief !== null && (
        <span class="g-dim">
          {' '}
          · {W.belief} {p.belief}
        </span>
      )}
    </span>
  );
}

/**
 * The frame of a power: title, the purse, the tabs between powers, a close button. `inline` draws it in the flow of the page (a story); otherwise it is
 * a layer over the whole screen. `kind` overrides the signal (a story shows one power).
 */
export function GodPanel(p: { bridge?: GodBridge; kind?: GodKind; args?: Record<string, unknown>; inline?: boolean; onClose?: () => void }): JSX.Element | null {
  const bridge = p.bridge ?? storeBridge;
  const open: GodOpen | null = p.kind ? { kind: p.kind, args: p.args ?? {} } : godOpen.value;
  const close = () => (p.onClose ? p.onClose() : closeGod());
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && !pendingAct.value && close();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [!!open]);
  if (!open) return null;
  const full = godFull.value && open.kind === 'miracle';
  const shell: JSX.CSSProperties = p.inline
    ? { position: 'relative', minHeight: full ? 620 : 480, height: full ? 640 : undefined }
    : { position: 'fixed', inset: 0, zIndex: 50, background: '#000d', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  return (
    <BridgeCtx.Provider value={bridge}>
      <GodStyles />
      <div class="g-root" style={shell}>
        <div role="region" aria-label={godKindTitle(open.kind)} style={{ position: 'relative', background: color.panel, border: `1px solid ${color.line}`, borderRadius: size.radius + 2, width: p.inline || full ? '100%' : 'min(1100px, 96vw)', height: full ? '100%' : undefined, maxHeight: p.inline || full ? undefined : '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <header style={{ ...row, justifyContent: 'space-between', padding: `${size.gap}px ${size.pad}px`, borderBottom: `1px solid ${color.line}` }}>
            <span class="g-title" style={{ color: color.light }}>
              {godKindTitle(open.kind)}
            </span>
            <Purse />
            <button class="g-btn" aria-label={W.close} onClick={close}>
              {W.close} ✕
            </button>
          </header>
          {!p.kind && !full && (
            <nav aria-label="powers" style={{ ...row, flexWrap: 'wrap', padding: `${size.gap}px ${size.pad}px 0` }}>
              {GOD_KINDS.map((k) => (
                <button key={k} class="g-chip" aria-pressed={open.kind === k} onClick={() => openGod(k)}>
                  {godKindTitle(k)}
                </button>
              ))}
            </nav>
          )}
          <div style={{ ...col, padding: full ? 0 : size.pad, overflow: full ? 'hidden' : 'auto', flex: 1, minHeight: 0, gap: 0 }}>
            {!full && <DoneBox />}
            <Body open={open} />
          </div>
          <ConfirmDialog />
        </div>
      </div>
    </BridgeCtx.Provider>
  );
}
