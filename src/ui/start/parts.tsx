// Small pieces of the start screen. The paper, the stones and the cups are drawn with CSS only (the pictures come later: code-plan §8.1 rule 1);
// every colour and size comes from tokens.ts and every word from the view model (src/app/views/start.ts).
import type { ComponentChildren, JSX } from 'preact';
import type { Segment, SheetItem } from '../../app/views/start';
import { START_LABELS } from '../../app/views/start';
import { color, font, motion, size } from '../tokens';

/** The paper of the sheet of birth (a hide: cream, with the edge burnt). */
export const paper = {
  bg: '#e9dcbc',
  ink: '#1c1710',
  inkBrown: '#6b4a24',
  inkRed: '#a8514f',
  inkFaint: '#8b7e63',
  edge: '#7a4a1e',
} as const;

export const panel = (extra: JSX.CSSProperties = {}): JSX.CSSProperties => ({
  background: '#13141b',
  border: `1px solid ${color.line}`,
  borderRadius: size.radius,
  padding: size.pad,
  ...extra,
});

export function Heading({ children }: { children: ComponentChildren }) {
  return <div style={{ fontFamily: font.title, fontSize: size.title, color: color.light, marginBottom: size.gap, letterSpacing: 0.5 }}>{children}</div>;
}

export function Button({ children, onClick, disabled, primary, title, pressed }: { children: ComponentChildren; onClick?: () => void; disabled?: boolean; primary?: boolean; title?: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-pressed={pressed}
      onClick={onClick}
      style={{
        fontFamily: font.body,
        fontSize: size.text,
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? color.textDim : primary ? '#1c1710' : color.text,
        background: primary ? color.light : pressed ? '#2a2c36' : '#1a1b24',
        border: `1px solid ${primary ? color.light : pressed ? color.light : color.line}`,
        borderRadius: size.radius,
        padding: '6px 12px',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

const SEGMENT_COLOR: Record<string, string> = {
  value: color.light,
  neg: color.dreadText,
  level: color.fate,
  random: color.dreamMist,
  off: color.textDim,
  imp: color.dreadText,
  fname: color.textDim,
};

/** The wish as typed, drawn again with what the parser took each stretch for (under the box, while the player types). */
export function Understood({ segments }: { segments: Segment[] }) {
  return (
    <div aria-live="polite" style={{ lineHeight: 1.7, minHeight: 28 }}>
      {segments.map((s, i) => {
        const c = SEGMENT_COLOR[s.kind];
        return (
          <span
            key={i}
            data-kind={s.kind}
            style={{
              color: c ?? (s.kind === 'unknown' ? color.text : color.textDim),
              borderBottom: c ? `1px solid ${c}` : s.kind === 'unknown' ? `1px dotted ${color.textDim}` : 'none',
              textDecoration: s.negated || s.cut ? 'line-through' : 'none',
              opacity: s.cut ? 0.6 : 1,
              whiteSpace: 'pre-wrap',
            }}
          >
            {s.text}
          </span>
        );
      })}
    </div>
  );
}

const MARK: Record<string, { glyph: string; ink: string }> = {
  sure: { glyph: '✓', ink: paper.ink },
  lean: { glyph: '〜', ink: paper.inkBrown },
  cannot: { glyph: '✕', ink: paper.inkRed },
  random: { glyph: '?', ink: paper.inkFaint },
};

/** One line of the sheet: the mark of its row, the field, the value. */
export function SheetLine({ item }: { item: SheetItem }) {
  const m = MARK[item.row];
  const struck = item.row === 'cannot';
  return (
    <li style={{ listStyle: 'none', display: 'flex', gap: 8, alignItems: 'baseline', color: m.ink, padding: '1px 0', fontSize: size.small + 1 }}>
      <span aria-hidden="true" style={{ width: 16, textAlign: 'center', fontWeight: 600 }}>
        {m.glyph}
      </span>
      <span style={{ flex: 1 }}>
        {item.field && <span style={{ opacity: 0.75 }}>{item.field} </span>}
        <span style={{ textDecoration: struck && item.value ? 'line-through' : 'none' }}>{item.value || (item.row === 'random' ? '' : '')}</span>
        {item.points !== 0 && <span style={{ marginLeft: 6, color: item.points < 0 ? paper.inkFaint : '#8a6a1a' }}>{item.points > 0 ? `−${item.points}` : `+${-item.points}`}</span>}
        {item.pending && <span style={{ marginLeft: 6, fontSize: size.small - 1, opacity: 0.7 }}>({START_LABELS.pending})</span>}
        {item.note && item.note !== 'random' && <div style={{ fontSize: size.small - 1, opacity: 0.8, paddingLeft: 2 }}>{item.note}</div>}
      </span>
    </li>
  );
}

/** The ring of fate points: ten beads, gold for the spent, ash for the ones a harder life gave back. */
export function Beads({ beads, label }: { beads: ('spent' | 'refund' | 'free')[]; label: string }) {
  return (
    <div role="img" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 120, justifyContent: 'flex-end' }}>
      {beads.map((b, i) => (
        <span
          key={i}
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: b === 'spent' ? color.light : b === 'refund' ? '#8a857a' : 'transparent',
            border: `1px solid ${b === 'free' ? paper.inkFaint : b === 'refund' ? '#8a857a' : color.light}`,
            boxShadow: b === 'spent' ? `0 0 4px ${color.light}` : 'none',
            animation: b === 'spent' ? `flicker ${motion.flicker} ease-in-out infinite` : 'none',
          }}
        />
      ))}
    </div>
  );
}

/** Makes the keyframe of the flicker once per page (the god's effects tremble at the edge: 20-god-ui.md §1). */
export function Styles() {
  return <style>{`@keyframes flicker{0%,100%{opacity:1}50%{opacity:.78}} .ov-mood{display:none} .ov-mood[data-on=true],.ov-start button:hover .ov-mood,.ov-start button:focus-visible .ov-mood{display:block} .ov-start button:focus-visible,.ov-start textarea:focus-visible,.ov-start select:focus-visible{outline:2px solid ${color.light};outline-offset:2px}`}</style>;
}
