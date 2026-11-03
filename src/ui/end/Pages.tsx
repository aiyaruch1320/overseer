// The legend page, the collection and the summary of the world (03-ending-and-collection.md §3 §5 §7; 20-god-ui.md §10 "พงศาวดารสายตระกูล").
// Each is a screen of its own (`LegendScreen`, `CollectionScreen`, `WorldSummaryScreen`) with a back button; they read the state of the store or the one handed in.
import { useMemo, useState } from 'preact/hooks';
import { store } from '../../app/store';
import { cardView, collectionPage, END_LABELS, legendView, worldPage, WORLD_SECTIONS, type LegendLife } from '../../app/views/end';
import type { GameData } from '../../core/game';
import type { GameState } from '../../core/types';
import { Button, Heading, panel, paper, Styles } from '../start/parts';
import { color, font, motion, size } from '../tokens';
import { CardPanel } from './CardPanel';

export interface PageProps {
  data?: GameData;
  state?: GameState | null;
  onBack?: () => void;
}

const stage = { height: '100vh', minHeight: size.minHeight, minWidth: size.minWidth, boxSizing: 'border-box', padding: size.pad, color: color.text, fontFamily: font.body, fontSize: size.text, background: color.panel, overflowY: 'auto' } as const;

function useSource(p: PageProps): { data: GameData; state: GameState } | null {
  void store.rev.value;
  const data = p.data ?? store.gameData;
  const state = p.state ?? store.state;
  return data && state ? { data, state } : null;
}

function Top({ title, onBack, children }: { title: string; onBack?: () => void; children?: preact.ComponentChildren }) {
  return (
    <header style={{ display: 'flex', alignItems: 'baseline', gap: size.pad, marginBottom: size.pad }}>
      {onBack && <Button onClick={onBack}>{END_LABELS.back}</Button>}
      <Heading>{title}</Heading>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>{children}</div>
    </header>
  );
}

// ---------- the legend page ----------

/** The colour of the leaf of a life: gold for a vow kept, ash for one broken, dim for none (the colour of the god's title is not in the lineage yet). */
const leafColor = (l: LegendLife): string => (l.vowResult === 'kept' ? color.light : l.vowResult === 'broken' ? '#8a857a' : color.line);

export function LegendScreen(props: PageProps) {
  const src = useSource(props);
  const [open, setOpen] = useState<string | null>(null);
  const view = useMemo(() => (src ? legendView(src.data, src.state) : null), [src?.data, src?.state, store.rev.value]);
  if (!src || !view) return null;
  const card = open ? cardView(src.data, src.state, open) : null;
  const rings = Math.min(8, Math.floor(view.chronicle.points / 3) + (view.chronicle.points > 0 ? 1 : 0));
  return (
    <div style={stage}>
      <Styles />
      <Top title={`${END_LABELS.legend} · ${END_LABELS.family} ${view.dynasty}`} onBack={props.onBack}>
        <span style={{ color: color.textDim }}>
          {END_LABELS.seed} {view.seed}
        </span>
        <Button onClick={() => store.newLife({ seed: view.seed })} title={END_LABELS.replay}>
          {END_LABELS.replay}
        </Button>
      </Top>
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: size.pad, alignItems: 'start' }}>
        {/* the tree of the family: the trunk with a ring for every few points of the chronicle, a leaf for every life */}
        <section aria-label={END_LABELS.family} style={panel({ position: 'relative' })}>
          <div aria-hidden="true" style={{ position: 'absolute', left: 38, top: 20, bottom: 20, width: 6, background: '#3a3328', borderRadius: 3 }} />
          <ol style={{ margin: 0, padding: 0 }}>
            {view.lives.map((l) => (
              <li key={l.id} style={{ listStyle: 'none', position: 'relative', paddingLeft: 66, marginBottom: 12 }}>
                <span aria-hidden="true" style={{ position: 'absolute', left: 28, top: 8, width: 26, height: 26, borderRadius: '2px 60% 2px 60%', background: l.alive ? 'transparent' : leafColor(l), border: `2px solid ${leafColor(l) === color.line ? '#5a5a66' : leafColor(l)}`, transform: 'rotate(-12deg)' }} />
                <button
                  type="button"
                  onClick={() => setOpen(open === l.id ? null : l.id)}
                  disabled={!l.card}
                  aria-pressed={open === l.id}
                  style={{ textAlign: 'left', width: '100%', fontFamily: font.body, fontSize: size.text, color: color.text, background: open === l.id ? '#2a2618' : '#16171f', border: `1px solid ${open === l.id ? color.light : color.line}`, borderRadius: size.radius, padding: '6px 10px', cursor: l.card ? 'pointer' : 'default' }}
                >
                  <div style={{ fontFamily: font.title, fontSize: size.title - 2 }}>
                    {l.generation}. {l.name}
                  </div>
                  <div style={{ color: color.textDim, fontSize: size.small }}>{l.line}</div>
                  {l.titles.length > 0 && <div style={{ fontSize: size.small }}>{l.titles.join(' · ')}</div>}
                  {l.vow && <div style={{ fontSize: size.small, color: l.vowResult === 'kept' ? color.light : color.textDim }}>{l.vow}</div>}
                </button>
              </li>
            ))}
          </ol>
          <div aria-label={END_LABELS.family} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0, marginTop: 8 }}>
            {Array.from({ length: rings }, (_, i) => (
              <span key={i} aria-hidden="true" style={{ width: 20 + i * 10, height: 20 + i * 10, borderRadius: '50%', border: `2px solid ${color.light}`, opacity: 0.35 + i * 0.07, marginLeft: i ? -(20 + i * 10) + 6 : 0, animation: `flicker ${motion.flicker} ease-in-out infinite` }} />
            ))}
          </div>
        </section>

        {/* the chronicle: what each threshold opened (a fruit on the branch) and the lines of the lives */}
        <section style={{ display: 'grid', gap: size.pad }}>
          {card ? (
            <CardPanel card={card} />
          ) : (
            <>
              <div style={panel()}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {view.chronicle.fruits.map((f) => (
                    <span key={f.at} style={{ opacity: f.open ? 1 : 0.4, border: `1px solid ${f.open ? color.light : color.line}`, borderRadius: 14, padding: '4px 12px', fontSize: size.small, boxShadow: f.open ? `0 0 8px ${color.light}55` : 'none' }}>
                      {f.open ? f.opens : `${END_LABELS.shadow} ${f.at}`}
                    </span>
                  ))}
                </div>
              </div>
              <div style={panel()}>
                {view.chronicle.lines.length === 0 && <div style={{ color: color.textDim }}>{END_LABELS.unknown}</div>}
                {view.chronicle.lines.map((t, i) => (
                  <p key={i} style={{ margin: '0 0 8px', lineHeight: 1.6 }}>
                    {t}
                  </p>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------- the collection ----------

export function CollectionScreen(props: PageProps) {
  const src = useSource(props);
  const page = useMemo(() => (src ? collectionPage(src.data, src.state) : null), [src?.data, src?.state, store.rev.value]);
  if (!src || !page) return null;
  return (
    <div style={stage}>
      <Styles />
      <Top title={`${END_LABELS.collection} · ${page.have}/${page.total}`} onBack={props.onBack} />
      <div style={{ height: 8, background: '#16171f', borderRadius: 4, marginBottom: size.pad, overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(page.ratio * 100)}%`, height: '100%', background: color.light }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: size.pad }}>
        {page.categories.map((c) => (
          <section key={c.id} style={panel()} aria-label={c.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: color.light }}>{c.name}</span>
              <span style={{ color: color.textDim }}>{c.unlimited ? c.have : `${c.have}/${c.total}`}</span>
            </div>
            {!c.unlimited && (
              <div style={{ height: 4, background: '#1d1e27', borderRadius: 2, margin: '4px 0 8px' }}>
                <div style={{ width: `${Math.round(c.ratio * 100)}%`, height: '100%', background: color.light, borderRadius: 2 }} />
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {c.found.slice(0, 40).map((f) => (
                <span key={f.id} style={{ border: `1px solid ${color.line}`, borderRadius: 10, padding: '1px 8px', fontSize: size.small }}>
                  {f.name}
                </span>
              ))}
              {c.found.length > 40 && <span style={{ color: color.textDim, fontSize: size.small }}>+{c.found.length - 40}</span>}
              {/* the entries not found are shadows: no name, no way told */}
              {Array.from({ length: c.shadows }, (_, i) => (
                <span key={`s${i}`} aria-label={END_LABELS.shadow} style={{ width: 18, height: 18, borderRadius: 4, background: '#1d1e27', border: `1px dashed ${color.line}` }} />
              ))}
            </div>
          </section>
        ))}
        <section style={panel()} aria-label="modes">
          <div style={{ color: color.light, marginBottom: 6 }}>{END_LABELS.modes}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {page.modes.map((m) => (
              <span key={m.id} style={{ border: `1px solid ${m.used ? color.light : color.line}`, borderRadius: 10, padding: '2px 10px', fontSize: size.small, opacity: m.open ? 1 : 0.45 }}>
                {m.open ? m.name : END_LABELS.shadow}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------- the summary of the world ----------

export function WorldSummaryScreen(props: PageProps) {
  const src = useSource(props);
  const page = useMemo(() => (src ? worldPage(src.data, src.state) : null), [src?.data, src?.state, store.rev.value]);
  if (!src || !page) return null;
  return (
    <div style={stage}>
      <Styles />
      <Top title={`${END_LABELS.world} · ${page.title}`} onBack={props.onBack} />
      <div style={{ maxWidth: 900, margin: '0 auto', background: paper.bg, color: paper.ink, border: `2px solid ${paper.edge}`, borderRadius: 4, padding: size.pad + 6, boxShadow: `inset 0 0 22px ${paper.edge}88` }}>
        {page.sections.map((s) => (
          <div key={s.id} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: size.small, color: paper.inkFaint, borderBottom: `1px solid ${paper.inkFaint}55` }}>{s.title}</div>
            {s.lines.map((l, i) => (
              <div key={i} style={{ lineHeight: 1.55 }}>
                {l}
              </div>
            ))}
          </div>
        ))}
        <div style={{ fontSize: size.small, color: paper.inkFaint, borderBottom: `1px solid ${paper.inkFaint}55` }}>{WORLD_SECTIONS.legend}</div>
        <p style={{ fontFamily: font.title, fontSize: size.title - 2, lineHeight: 1.6 }}>{page.legend.text}</p>
      </div>
    </div>
  );
}
