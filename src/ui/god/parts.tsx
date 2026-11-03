// Small pieces the god's screens share: a drop of light or dread with its number, a button that is grey with the reason under it when the god may not
// (20-god-ui.md §2: the button does not vanish, so the player knows it exists), a flame for the heart of a character.
import type { ComponentChildren, JSX } from 'preact';
import { color } from '../tokens';
import { toneColor } from './style';

export function Drop(p: { line: 'faith' | 'dread'; n: number | string; strange?: boolean }) {
  const c = p.line === 'faith' ? color.light : toneColor.dread;
  return (
    <span style={{ color: c, whiteSpace: 'nowrap' }}>
      <span aria-hidden="true">{p.strange ? '✧' : '●'}</span> {p.n}
    </span>
  );
}

/** A button the god may press or not; when not, it stays on the screen, grey, with the reason as a line under it. */
export function Gate(p: { ok: boolean; reason?: string; tone?: string; onClick: () => void; children: ComponentChildren; style?: JSX.CSSProperties; label?: string }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
      <button class={`g-btn ${p.ok ? p.tone ?? '' : ''}`} aria-disabled={!p.ok} aria-label={p.label} title={p.ok ? undefined : p.reason} style={p.style} onClick={() => p.ok && p.onClick()}>
        {p.children}
      </button>
      {!p.ok && p.reason && (
        <span class="g-small g-dim" role="note" style={{ maxWidth: 260 }}>
          ⌛ {p.reason}
        </span>
      )}
    </span>
  );
}

/** The flame of a heart: tall and still, wavering, or low. */
export function Flame(p: { level: string }) {
  const kind = p.level === 'เต็มใจ' ? '' : p.level === 'ลังเล' ? 'waver' : 'low';
  const h = p.level === 'เต็มใจ' ? 28 : p.level === 'ลังเล' ? 20 : 9;
  return <span class={`g-flame ${kind}`} style={{ height: h }} aria-hidden="true" />;
}

export function Empty(p: { children: ComponentChildren }) {
  return (
    <div class="g-dim" style={{ padding: 24, textAlign: 'center' }}>
      {p.children}
    </div>
  );
}

export function Section(p: { title: string; children: ComponentChildren; tone?: string }) {
  return (
    <section style={{ marginTop: 12 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: toneColor[p.tone ?? 'light'] ?? color.light }}>{p.title}</h3>
      {p.children}
    </section>
  );
}
