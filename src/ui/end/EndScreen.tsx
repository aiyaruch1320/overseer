// The end of a life (code-plan §8.2 row "จบชีวิต"; 03-ending-and-collection.md §1; 20-god-ui.md §10): the death scene (a placeholder drawn with CSS), the life
// record with the card, and the choice of the heir. From here the player goes on (`store.nextLife`) or to the legend, the collection, the summary of the world.
import { useMemo, useState } from 'preact/hooks';
import { store } from '../../app/store';
import { cardView, deathOf, END_LABELS, goOn, heirChoice, worldEnded, type HeirCandidate } from '../../app/views/end';
import type { Ctx, GameData } from '../../core/game';
import { makeCtx } from '../../core/game';
import type { GameState } from '../../core/types';
import { color, font, motion, size } from '../tokens';
import { Button, Heading, paper, Styles } from '../start/parts';
import { CardPanel } from './CardPanel';
import { CollectionScreen, LegendScreen, WorldSummaryScreen } from './Pages';

export interface EndProps {
  data?: GameData;
  state?: GameState | null;
  /** The ctx of the game that ended (the heirs are read from its bond book); made from `state` when absent. */
  ctx?: Ctx;
  /** Which page opens first. */
  start?: Page;
  /** The player goes on; the default bears the next life through the bridge. */
  onContinue?: (opts: { tie?: string; newcomer?: boolean }) => { ok: boolean } | void;
}

export type Page = 'death' | 'record' | 'heir' | 'legend' | 'collection' | 'world';

const stage = { height: '100vh', minHeight: size.minHeight, minWidth: size.minWidth, boxSizing: 'border-box', padding: size.pad, color: color.text, fontFamily: font.body, fontSize: size.text, background: color.panel, overflowY: 'auto' } as const;

export function EndScreen(props: EndProps) {
  void store.rev.value;
  const data = props.data ?? store.gameData;
  const state = props.state ?? store.state;
  if (!data || !state) return null;
  return <EndInner {...props} data={data} state={state} />;
}

function DeathScene({ data, state, onNext }: { data: GameData; state: GameState; onNext: () => void }) {
  const lifeCard = deathOf(state);
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh', textAlign: 'center' }}>
      <div style={{ maxWidth: 560 }}>
        {/* the placeholder of the scene: one candle going out in the dark (the picture comes later) */}
        <div aria-hidden="true" style={{ margin: '0 auto 28px', width: 8, height: 8, borderRadius: '50%', background: color.light, boxShadow: `0 0 30px 12px ${color.light}55`, animation: `flicker ${motion.flicker} ease-in-out infinite` }} />
        {lifeCard && (
          <>
            <div style={{ fontFamily: font.title, fontSize: size.title + 8, color: color.light }}>{lifeCard.name}</div>
            <div style={{ color: color.textDim, margin: '6px 0 14px' }}>{lifeCard.head}</div>
            <p style={{ lineHeight: 1.7, fontSize: size.text + 1 }}>{lifeCard.sentence}</p>
            <div style={{ color: color.textDim, marginTop: 6 }}>{lifeCard.cause}</div>
          </>
        )}
        <div style={{ marginTop: 28 }}>
          <Button primary onClick={onNext}>
            {END_LABELS.readRecord}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The paper of the card of the record: the heirs and the end of a family are written on the same hide (M5 review: they were bare dark boxes). */
const sheet = { background: paper.bg, color: paper.ink, border: `2px solid ${paper.edge}`, borderRadius: 4, boxShadow: `inset 0 0 22px ${paper.edge}88` } as const;

function HeirCard({ h, on, pickable, onPick }: { h: HeirCandidate; on: boolean; pickable: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role={pickable ? 'radio' : undefined}
      aria-checked={pickable ? on : undefined}
      onClick={onPick}
      disabled={!pickable}
      style={{
        ...sheet,
        textAlign: 'left',
        cursor: pickable ? 'pointer' : 'default',
        fontFamily: font.body,
        fontSize: size.text,
        borderColor: on ? color.light : paper.edge,
        boxShadow: on ? `0 0 12px ${color.light}, inset 0 0 22px ${paper.edge}88` : sheet.boxShadow,
        opacity: pickable && !on ? 0.82 : 1,
        // the card of the heir is as big as the card of the record, with the same paper (M5 review round two R7: one small card in the corner of an empty page)
        padding: size.pad * 2,
        minHeight: 200,
        display: 'grid',
        alignContent: 'start',
        gap: 8,
      }}
    >
      <span style={{ fontFamily: font.title, fontSize: size.title + 8 }}>{h.name}</span>
      <span style={{ color: paper.inkBrown }}>{h.line}</span>
      {h.traits.length > 0 && <span>{h.traits.join(' · ')}</span>}
      {h.aptitudes.length > 0 && <span style={{ color: paper.inkBrown }}>{h.aptitudes.join(' · ')}</span>}
    </button>
  );
}

function EndInner(props: EndProps & { data: GameData; state: GameState }) {
  const { data, state } = props;
  const [page, setPage] = useState<Page>(props.start ?? 'death');
  const ctx = useMemo(() => props.ctx ?? store.game?.ctx ?? makeCtx(state, data), [props.ctx, state, data]);
  const heirs = useMemo(() => heirChoice(data, ctx), [data, ctx]);
  const card = useMemo(() => cardView(data, state), [data, state]);
  const [tie, setTie] = useState<string | null>(null);
  const [error, setError] = useState('');
  const picked = tie ?? heirs.candidates.find((c) => c.chosen)?.tie ?? null;
  // the summary of the world is a rare scene (03 §7): its button comes only when the world fell; the legend page reaches it otherwise
  const fell = useMemo(() => worldEnded(data, state), [data, state]);
  const [from, setFrom] = useState<Page>('record');
  const go = (to: Page) => {
    if (to === 'legend' || to === 'collection' || to === 'world') setFrom(page);
    setPage(to);
  };

  const next = (opts: { tie?: string; newcomer?: boolean }) => {
    const r = props.onContinue ? props.onContinue(opts) : (goOn(store, opts) as { ok: boolean; reason?: string } | null);
    if (r && !r.ok) setError(END_LABELS.noHeir);
  };

  if (page === 'legend') return <LegendScreen data={data} state={state} onBack={() => setPage(from)} onWorld={() => setPage('world')} />;
  if (page === 'collection') return <CollectionScreen data={data} state={state} onBack={() => setPage(from)} />;
  if (page === 'world') return <WorldSummaryScreen data={data} state={state} onBack={() => setPage(fell ? 'record' : 'legend')} />;

  return (
    <div style={stage} className="ov-start">
      <Styles />
      {page === 'death' && <DeathScene data={data} state={state} onNext={() => setPage('record')} />}

      {page === 'record' && (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          {card ? <CardPanel card={card} /> : null}
          <div style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 8, marginTop: size.pad, padding: `${size.gap}px 0`, flexWrap: 'wrap', background: color.panel }}>
            <Button primary onClick={() => setPage('heir')}>
              {END_LABELS.next}
            </Button>
            <Button onClick={() => go('legend')}>{END_LABELS.toLegend}</Button>
            <Button onClick={() => go('collection')}>{END_LABELS.toCollection}</Button>
            {fell && <Button onClick={() => go('world')}>{END_LABELS.world}</Button>}
          </div>
        </div>
      )}

      {page === 'heir' && (
        <div style={{ maxWidth: 1000, margin: '0 auto', minHeight: '86vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }} data-testid="heir-page">
          <Heading>
            {END_LABELS.heir} · {END_LABELS.family} {heirs.family.dynasty}
          </Heading>
          {heirs.blocked && <div style={{ ...sheet, padding: size.pad }}>{END_LABELS.ended}</div>}
          {!heirs.blocked && heirs.candidates.length > 0 && (
            <div role="radiogroup" aria-label={END_LABELS.heir} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: size.pad }}>
              {heirs.candidates.map((h) => (
                <HeirCard key={h.tie} h={h} on={picked === h.tie} pickable onPick={() => setTie(h.tie)} />
              ))}
            </div>
          )}
          {!heirs.blocked && heirs.candidates.length === 0 && heirs.successor && (
            <div style={{ display: 'grid', gap: size.pad }}>
              <HeirCard h={heirs.successor} on pickable={false} onPick={() => undefined} />
            </div>
          )}
          {!heirs.blocked && heirs.extinct && (
            <div style={{ ...sheet, padding: size.pad + 4 }}>
              <div style={{ fontFamily: font.title, fontSize: size.title + 4 }}>{END_LABELS.extinct}</div>
              <div style={{ color: paper.inkBrown, margin: '4px 0 10px' }}>{END_LABELS.noHeir}</div>
              <Button onClick={() => next({ newcomer: true })}>{END_LABELS.newcomer}</Button>
            </div>
          )}
          {error && (
            <div role="alert" style={{ color: color.dreadText, marginTop: 8 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: size.pad, flexWrap: 'wrap' }}>
            {!heirs.blocked && !heirs.extinct && (
              <Button primary onClick={() => next({ tie: picked ?? undefined })}>
                {END_LABELS.next}
              </Button>
            )}
            <Button onClick={() => setPage('record')}>{END_LABELS.back}</Button>
            <Button onClick={() => go('legend')}>{END_LABELS.toLegend}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
