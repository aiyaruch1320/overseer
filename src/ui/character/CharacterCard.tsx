// The compact card of the character for the side of the watch screen: name, who, class and job, hit points, the three highest stats, the purse,
// what is in the hand (with its frame), the companion, the counts of blessings and curses, bondage if any, and the candle of belief in a line.
// It is a button when `onOpen` is given: it opens the whole sheet (CharacterScreen).
import { store } from '../../app/store';
import { characterCardView, type CardModel } from '../../app/views/character';
import { CHAR_WORDS as W } from '../../app/views/character-words';
import type { GameData } from '../../core/game';
import type { GameState } from '../../core/types';
import { color, font, size } from '../tokens';
import { Dim, frame, Meter, TierMark, tint } from './parts';

export interface CharacterCardProps {
  data?: GameData;
  state?: GameState | null;
  onOpen?: () => void;
  /** Card width in px; the watch screen's side panel is narrow. */
  width?: number;
}

const BELIEF_TONE: Record<CardModel['god']['tone'], string> = { loyal: color.light, wavering: color.text, cold: color.fate };

export function CharacterCardView({ m, onOpen, width = 200 }: { m: CardModel; onOpen?: () => void; width?: number }) {
  const body = (
    <>
      <div style={{ fontFamily: font.title, fontSize: size.text + 3, lineHeight: 1.2 }} data-testid="card-name">
        {m.name}
      </div>
      <Dim>{m.line}</Dim>
      <div style={{ fontSize: size.small }}>
        {m.cls}
        {m.job && ` · ${m.job}`}
      </div>
      {m.dead && <div style={{ color: color.dread, fontSize: size.small }}>{W.dead}</div>}
      <div style={{ marginTop: 6 }} title={`${W.hp} ${m.hp.now} / ${m.hp.max}`}>
        <Meter label={W.hp} valueText={`${m.hp.now} / ${m.hp.max}`} pct={m.hp.pct} tone={m.hp.pct < 35 ? color.dread : color.light} height={6} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: size.small }} data-testid="card-top">
        {m.top.map((t) => (
          <span key={t.label}>
            {t.label} <span style={{ fontFamily: font.mono, color: color.light }}>{t.total}</span>
          </span>
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: size.small }}>
        {W.gold} <span style={{ fontFamily: font.mono, color: color.light }}>{m.gold}</span>
        {m.bound && <span style={{ color: color.dread, marginLeft: 8 }}>{m.bound}</span>}
      </div>
      {m.hand && (
        <div style={{ ...frame(m.hand.tier), padding: '3px 6px', marginTop: 6, fontSize: size.small, display: 'flex', gap: 6, alignItems: 'center' }} data-testid="card-hand">
          <TierMark tier={m.hand.tier} />
          <span style={{ minWidth: 0 }}>{m.hand.name}</span>
        </div>
      )}
      {m.companion && <div style={{ marginTop: 4, fontSize: size.small, color: color.textDim }}>{`${W.companion} · ${m.companion}`}</div>}
      <div style={{ marginTop: 6, fontSize: size.small, display: 'flex', gap: 10 }}>
        <span style={{ color: color.light }}>
          {W.blessings} {m.blessings}
        </span>
        <span style={{ color: color.dread }}>
          {W.curses} {m.curses}
        </span>
      </div>
      <div style={{ marginTop: 6, fontSize: size.small, color: BELIEF_TONE[m.god.tone] }} data-testid="card-belief" title={`${W.god} ${Math.round(m.god.belief)}`}>
        {W.god} {Math.round(m.god.belief)}
        {m.god.bandName && <Dim> · {m.god.bandName}</Dim>}
      </div>
    </>
  );
  const box = { width, boxSizing: 'border-box', padding: size.pad - 2, textAlign: 'left', fontFamily: font.body, fontSize: size.text, color: color.text, background: '#13141b', border: `1px solid ${color.line}`, borderRadius: size.radius } as const;
  if (!onOpen) {
    return (
      <div style={box} data-testid="character-card">
        {body}
      </div>
    );
  }
  return (
    <button type="button" onClick={onOpen} style={{ ...box, display: 'block', cursor: 'pointer' }} class="ch-card" data-testid="character-card" title={W.title}>
      <style>{`.ch-card:hover { border-color: ${color.textDim}; background: ${tint(color.text, 8)}; } .ch-card:focus-visible { outline: 2px solid ${color.text}; outline-offset: 1px; }`}</style>
      {body}
    </button>
  );
}

/** The card of the life on the stage, from the store or from the data and state handed in. */
export function CharacterCard({ data, state, onOpen, width }: CharacterCardProps) {
  void store.rev.value;
  const d = data ?? store.gameData;
  const s = state ?? store.state;
  if (!d || !s) return null;
  const m = characterCardView(d, s);
  return m ? <CharacterCardView m={m} onOpen={onOpen} width={width} /> : null;
}
