// The life record and the ending card (03-ending-and-collection.md §1; 20-god-ui.md §10): head, title cloths, the questions and moments, the people, the
// traces, the hand of the god, the vow stone, the epitaph and what the life opened. Words come from `src/app/views/end.ts`.
import type { CardView } from '../../app/views/end';
import { END_LABELS } from '../../app/views/end';
import { color, font, size } from '../tokens';
import { paper } from '../start/parts';

const page = { background: paper.bg, color: paper.ink, border: `2px solid ${paper.edge}`, borderRadius: 4, boxShadow: `inset 0 0 22px ${paper.edge}88` } as const;

/** The stone of the vow: gold in the cut when it was kept, cracked in the middle but still standing when it was not (20-god-ui.md §10 "ตอนตาย"). */
export function VowStone({ vow }: { vow: NonNullable<CardView['vow']> }) {
  return (
    <div
      data-kept={vow.kept}
      style={{
        position: 'relative',
        border: `2px solid ${vow.kept ? color.light : '#6a655c'}`,
        borderRadius: '14px 14px 3px 3px',
        background: vow.kept ? 'linear-gradient(180deg,#f0d588 0%,#c79b3a 100%)' : 'linear-gradient(180deg,#5b5850 0%,#3c3a35 100%)',
        color: vow.kept ? '#1c1710' : '#e6e0d0',
        padding: '10px 12px',
        boxShadow: vow.kept ? `0 0 12px ${color.light}88` : 'none',
        overflow: 'hidden',
      }}
    >
      {!vow.kept && <span aria-hidden="true" style={{ position: 'absolute', left: '48%', top: 0, bottom: 0, width: 2, background: '#17160f', transform: 'skewX(-14deg)', opacity: 0.8 }} />}
      <div style={{ fontFamily: font.title, fontSize: size.text + 2 }}>{vow.head}</div>
      {vow.lines.map((l, i) => (
        <div key={i} style={{ fontSize: size.small + 1, marginTop: 2 }}>
          {l}
        </div>
      ))}
      {!vow.kept && vow.missing.length > 0 && (
        <div data-testid="vow-missing" style={{ fontSize: size.small + 1, marginTop: 6, paddingTop: 4, borderTop: '1px solid #e6e0d055' }}>
          {END_LABELS.missing}: {vow.missing.join(' · ')}
        </div>
      )}
    </div>
  );
}

function Section({ title, lines }: { title: string; lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: size.small, color: paper.inkFaint, borderBottom: `1px solid ${paper.inkFaint}55`, marginBottom: 2 }}>{title}</div>
      {lines.map((l, i) => (
        <div key={i} style={{ lineHeight: 1.5 }}>
          {l}
        </div>
      ))}
    </div>
  );
}

/** The sheet of the wish on the card of an ordered life (19-wish.md §6): the mark "ถูกสั่ง", the words typed, what was given and what was not. */
export function WishBlock({ wish }: { wish: NonNullable<CardView['wish']> }) {
  return (
    <div data-testid="wish-block" style={{ marginBottom: 8 }}>
      <div style={{ fontSize: size.small, color: paper.inkFaint, borderBottom: `1px solid ${paper.inkFaint}55`, marginBottom: 2 }}>{END_LABELS.asked}</div>
      <div style={{ lineHeight: 1.5, fontStyle: 'italic' }}>“{wish.text}”</div>
      {wish.sure.length > 0 && <div style={{ lineHeight: 1.5 }}>{END_LABELS.sure}: {wish.sure.join(' · ')}</div>}
      {wish.lean.length > 0 && <div style={{ lineHeight: 1.5 }}>{END_LABELS.lean}: {wish.lean.join(' · ')}</div>}
      {wish.refused.map((r, i) => (
        <div key={i} style={{ lineHeight: 1.5, color: paper.inkBrown }}>
          {END_LABELS.cannot}: {r.text}
          {r.reason && <span style={{ color: paper.inkFaint }}> — {r.reason}</span>}
        </div>
      ))}
    </div>
  );
}

export function CardPanel({ card }: { card: CardView }) {
  return (
    <article aria-label={END_LABELS.record} style={{ ...page, padding: size.pad + 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: size.pad + 4, alignItems: 'start' }}>
      <header style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <div style={{ fontFamily: font.title, fontSize: size.title + 4 }}>{card.head}</div>
          <div style={{ fontSize: size.small, color: paper.inkBrown, whiteSpace: 'nowrap' }}>
            {card.wish && (
              <span data-testid="wish-mark" style={{ border: `1px solid ${paper.inkBrown}`, borderRadius: 10, padding: '0 8px', marginRight: 8 }}>
                {card.wish.mark}
              </span>
            )}
            {END_LABELS.mark}: {card.mark.label}
          </div>
        </div>
        {/* the cloths of the life hang from the stone of the grave */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {card.titles.length ? (
            card.titles.map((t) => (
              <span key={t} style={{ background: '#f6efd8', border: `1px solid ${paper.inkBrown}`, borderRadius: '2px 2px 8px 8px', padding: '3px 12px 6px', fontFamily: font.title, fontSize: size.text + 1 }}>
                {t}
              </span>
            ))
          ) : (
            <span style={{ color: paper.inkFaint }}>{card.titleLine}</span>
          )}
        </div>
        {card.ending && <div style={{ marginTop: 6, color: paper.inkBrown }}>{card.ending}</div>}
      </header>

      <div>
        {card.sections.filter((s) => ['question', 'moments', 'hand'].includes(s.id)).map((s) => (
          <Section key={s.id} title={s.title} lines={s.lines} />
        ))}
        {card.vow && (
          <div style={{ margin: '10px 0' }}>
            <div style={{ fontSize: size.small, color: paper.inkFaint, marginBottom: 4 }}>{END_LABELS.vow}</div>
            <VowStone vow={card.vow} />
          </div>
        )}
      </div>

      <div>
        {card.wish && <WishBlock wish={card.wish} />}
        {card.sections.filter((s) => ['people', 'traces'].includes(s.id)).map((s) => (
          <Section key={s.id} title={s.title} lines={s.lines} />
        ))}
        {card.heir && <Section title={END_LABELS.heir} lines={[card.heir.line]} />}
        {card.threads.length > 0 && <Section title="" lines={card.threads} />}
        <Section title={END_LABELS.summary} lines={[card.summary.text]} />
      </div>

      <footer style={{ gridColumn: '1 / -1', borderTop: `1px solid ${paper.inkFaint}55`, paddingTop: 8 }}>
        <div style={{ fontSize: size.small, color: paper.inkFaint }}>{END_LABELS.epitaph}</div>
        <div style={{ fontFamily: font.title, fontSize: size.title, textAlign: 'center', padding: '6px 0 10px', letterSpacing: 0.4 }}>{card.epitaph.text}</div>
        {card.earned.length > 0 && (
          <div>
            <div style={{ fontSize: size.small, color: paper.inkFaint }}>{END_LABELS.earned}</div>
            {card.earned.map((g) => (
              <div key={g.category} style={{ fontSize: size.small + 1, lineHeight: 1.5 }}>
                <span style={{ color: paper.inkBrown }}>{g.category}</span> {g.names.join(' · ')}
                {g.more > 0 && <span style={{ color: paper.inkFaint }}> +{g.more}</span>}
              </div>
            ))}
          </div>
        )}
      </footer>
    </article>
  );
}

