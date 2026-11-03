// The calls of the game on the watch screen (07-attention.md §2, 20-god-ui.md §2 "การเรียกผู้เล่น"): the stop panel, the cards, the ring of time.
import type { CardView, GodOpen, StopView } from '../../app/views/watch';
import { WATCH_WORDS as W } from '../../app/views/watch-words';
import { color, font, size } from '../tokens';
import { button, layout, tint, toneColor } from './style';

/** Cards on the screen at most (07-attention.md §2). */
export const MAX_CARDS = 2;

const RING = 15;
const CIRC = 2 * Math.PI * RING;

/** The edge of a card as a ring that shrinks with the time left; a card with no time (folded into a stop, the clock is stopped) is a full dot. */
function Ring({ frac, tone, stopped }: { frac: number; tone: string; stopped: boolean }) {
  if (stopped)
    return (
      <svg width={38} height={38} viewBox="0 0 38 38" aria-hidden="true" style={{ flex: 'none' }}>
        <circle cx={19} cy={19} r={7} fill={tone} />
      </svg>
    );
  return (
    <svg width={38} height={38} viewBox="0 0 38 38" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx={19} cy={19} r={RING} fill="none" stroke={color.line} stroke-width={3} />
      <circle cx={19} cy={19} r={RING} fill="none" stroke={tone} stroke-width={3} stroke-linecap="round" stroke-dasharray={CIRC} stroke-dashoffset={CIRC * (1 - frac)} transform="rotate(-90 19 19)" />
    </svg>
  );
}

function Options({ options, onOpen }: { options: GodOpen[]; onOpen: (o: GodOpen) => void }) {
  if (!options.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o, i) => (
        <button key={`${o.kind}${i}`} class="wt-btn" style={button} onClick={() => onOpen(o)} data-testid={`open-${o.kind}`}>
          {W.god[o.kind]}
        </button>
      ))}
    </div>
  );
}

export function Card({ card, onOpen }: { card: CardView; onOpen: (o: GodOpen) => void }) {
  const tone = toneColor[card.tone];
  return (
    <article
      class="wt-card"
      style={{ width: layout.cardWidth, background: color.panel, border: `1px solid ${tint(tone, 55)}`, borderRadius: size.radius, padding: size.gap + 2, display: 'flex', flexDirection: 'column', gap: size.gap, boxShadow: `0 2px 10px ${tint(color.panel, 90)}` }}
      data-testid="card"
    >
      <div style={{ display: 'flex', gap: size.gap, alignItems: 'center' }}>
        <Ring frac={card.frac} tone={tone} stopped={card.left === null} />
        <div style={{ fontSize: size.small, lineHeight: 1.45 }}>
          <div>{card.text}</div>
          {card.left !== null && <div style={{ color: color.textDim, fontFamily: font.mono, fontSize: 11 }}>{W.card.left(card.left)}</div>}
        </div>
      </div>
      <Options options={card.options} onOpen={onOpen} />
    </article>
  );
}

/** At most two cards, the one that runs out first on top; a new one pushes the old down. They slide in from the left edge. */
export function CardStack({ cards, onOpen }: { cards: CardView[]; onOpen: (o: GodOpen) => void }) {
  if (!cards.length) return null;
  return (
    <div role="region" aria-live="polite" style={{ position: 'absolute', left: size.pad, top: layout.cardsTop, display: 'flex', flexDirection: 'column', gap: size.gap, zIndex: 2 }} data-testid="cards">
      {cards.slice(0, MAX_CARDS).map((c) => (
        <Card key={c.n} card={c} onOpen={onOpen} />
      ))}
    </div>
  );
}

/** The stop (20-god-ui.md §2 "หยุด"): the scene dims, a black cloth panel holds the reason, what the god can do, and the cards that waited. */
export function StopPanel({ stop, onOpen, onContinue }: { stop: StopView; onOpen: (o: GodOpen) => void; onContinue: () => void }) {
  return (
    <div class="wt-veil" style={{ position: 'absolute', inset: 0, background: tint(color.panel, 72), display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }} data-testid="stop">
      <section role="dialog" aria-label={W.stop.title} style={{ width: 'min(860px, 92%)', maxHeight: '92%', overflowY: 'auto', background: color.panel, border: `1px solid ${color.line}`, borderRadius: size.radius, padding: size.pad * 1.5, display: 'flex', flexDirection: 'column', gap: size.pad }}>
        <header>
          <div style={{ color: color.textDim, fontSize: size.small }}>{W.stop.title}</div>
          <h2 style={{ margin: '4px 0 0', fontFamily: font.title, fontWeight: 400, fontSize: size.title, color: color.light }} data-testid="stop-reason">
            {stop.reason}
          </h2>
        </header>
        {stop.recap.length > 0 && (
          <div>
            <div style={{ color: color.textDim, fontSize: size.small, marginBottom: 4 }}>{W.stop.recap}</div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: size.small, lineHeight: 1.6 }} data-testid="recap">
              {stop.recap.map((l) => (
                <li key={l.n}>
                  {l.age !== undefined && <span style={{ color: color.textDim, fontFamily: font.mono, marginRight: size.gap }}>{`${W.age} ${l.age}`}</span>}
                  {l.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Options options={stop.options} onOpen={onOpen} />
        {stop.cards.length > 0 && (
          <div>
            <div style={{ color: color.textDim, fontSize: size.small, marginBottom: 4 }}>{W.stop.waiting}</div>
            <div style={{ display: 'flex', gap: size.gap, flexWrap: 'wrap' }} data-testid="stop-cards">
              {stop.cards.map((c) => (
                <Card key={c.n} card={c} onOpen={onOpen} />
              ))}
            </div>
          </div>
        )}
        {!stop.death && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button class="wt-btn" autoFocus style={{ ...button, borderColor: color.light, color: color.light, padding: `${size.gap}px ${size.pad * 1.5}px` }} onClick={onContinue} data-testid="continue">
              {W.stop.cont} <kbd style={{ fontFamily: font.mono, fontSize: 11, color: color.textDim }}>{W.stop.contKey}</kbd>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
