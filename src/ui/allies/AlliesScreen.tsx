// The allies and family screen (code-plan §8.2 row "พวกพ้องและครอบครัว"; docs/appearance/16-ally-scenes.md): the circle of ties grouped by line, each with its
// level as a thread, its present feeling as an emote, its age and stage, the other parent, and the history of the tie; the crises that wait with a button to
// whisper to the ally; and the family tree across the lineage on its own tab. The view models are src/app/views/allies.ts; every drawing is by code (glyphs.tsx).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { store } from '../../app/store';
import { ALLIES_W, circleOf, type Circle as CircleView, type TieView } from '../../app/views/allies';
import type { GameData } from '../../core/game';
import type { GameState } from '../../core/types';
import { color } from '../tokens';
import { FamilyTree } from './FamilyTree';
import { Emote, LineIcon, Thread } from './glyphs';
import { css, inkOf, lineOf } from './style';

export interface AlliesProps {
  data?: GameData;
  state?: GameState | null;
  /** The player asks the god to whisper to this ally (the lead opens the whisper on him by name). */
  onWhisper?: (allyName: string) => void;
  onClose?: () => void;
  /** Which tab opens first. */
  tab?: 'circle' | 'tree';
  /** The tie shown first (else the one with a crisis, else the first). */
  selected?: string;
}

export function AlliesScreen(props: AlliesProps) {
  void store.rev.value;
  const data = props.data ?? store.gameData;
  const state = props.state ?? store.state;
  if (!data || !state) return null;
  return <Inner {...props} data={data} state={state} />;
}

function Inner({ data, state, onWhisper, onClose, tab: first = 'circle', selected }: AlliesProps & { data: GameData; state: GameState }) {
  const [tab, setTab] = useState<'circle' | 'tree'>(first);
  const circle = circleOf(data, state);
  return (
    <div class="al-root" data-screen="allies">
      <style>{css}</style>
      <header class="al-head">
        <span class="al-title">{ALLIES_W.title}</span>
        {circle.who && (
          <span class="al-dim">
            {circle.who.name} · {ALLIES_W.age} {circle.who.age}
          </span>
        )}
        <div class="al-tabs" role="tablist">
          <button type="button" role="tab" class="al-btn" aria-selected={tab === 'circle'} aria-pressed={tab === 'circle'} onClick={() => setTab('circle')}>
            {ALLIES_W.circle}
          </button>
          <button type="button" role="tab" class="al-btn" aria-selected={tab === 'tree'} aria-pressed={tab === 'tree'} onClick={() => setTab('tree')}>
            {ALLIES_W.tree}
          </button>
          {onClose && (
            <button type="button" class="al-btn" onClick={onClose}>
              ×
            </button>
          )}
        </div>
      </header>
      {tab === 'circle' ? <CirclePane circle={circle} onWhisper={onWhisper} selected={selected} /> : <FamilyTree data={data} state={state} />}
    </div>
  );
}

/** The mood of a tie as an emote in the colour of its line, with its word for a label. */
function Mood({ t, size }: { t: TieView; size: number }) {
  if (!t.mood) return <span aria-hidden="true" style={{ width: size, display: 'inline-block' }} />;
  return (
    <span style={{ color: inkOf(t.line), display: 'inline-flex' }} title={t.mood}>
      <Emote mood={t.mood} size={size} label={`${ALLIES_W.feeling}${t.mood}`} />
    </span>
  );
}

function Row({ t, on, onPick }: { t: TieView; on: boolean; onPick: () => void }) {
  const cls = t.light ? 'al-row frame' : 'al-row';
  return (
    <button type="button" class={cls} aria-current={on} style={{ borderLeftColor: lineOf(t.line) }} onClick={onPick} data-tie={t.id}>
      <span style={{ color: inkOf(t.line), display: 'inline-flex' }}>
        <LineIcon line={t.line} size={20} />
      </span>
      <span class="al-name">
        {t.name} <span class="al-dim al-small">{t.word}{t.isChild && t.stage ? ` · ${t.stage}` : ''} · {t.age}</span>
        {t.crisis && <span aria-label={ALLIES_W.crisis} style={{ color: color.fate }}> ✦</span>}
      </span>
      <span style={{ color: lineOf(t.line) }}>
        <Thread level={t.level} width={54} />
      </span>
      <Mood t={t} size={22} />
    </button>
  );
}

function CirclePane({ circle, onWhisper, selected }: { circle: CircleView; onWhisper?: (n: string) => void; selected?: string }) {
  const all = useMemo(() => [...circle.groups.flatMap((g) => g.ties), ...circle.gone], [circle]);
  const [pick, setPick] = useState<string | null>(selected ?? circle.waiting[0]?.id ?? circle.groups[0]?.ties[0]?.id ?? circle.gone[0]?.id ?? null);
  // a state that changed under the screen (a tie that went) leaves the pick on the first one that is still there
  useEffect(() => {
    if (pick && !all.some((t) => t.id === pick)) setPick(circle.waiting[0]?.id ?? circle.groups[0]?.ties[0]?.id ?? circle.gone[0]?.id ?? null);
  }, [all, pick]);
  if (!circle.who) return <div class="al-empty">{ALLIES_W.noLife}</div>;
  const cur = all.find((t) => t.id === pick) ?? null;
  return (
    <>
      <div class="al-body">
        <div class="al-list" role="list">
          {circle.lonely && <p class="al-dim" style={{ margin: '0 0 12px' }}>{ALLIES_W.lonely}</p>}
          {circle.groups.map((g) => (
            <section class="al-group" key={g.id} data-group={g.id} aria-label={g.title}>
              <h3>
                {g.title} · {g.ties.length}
              </h3>
              {g.ties.map((t) => (
                <Row key={t.id} t={t} on={t.id === pick} onPick={() => setPick(t.id)} />
              ))}
            </section>
          ))}
          {circle.gone.length > 0 && (
            <section class="al-group" data-group="gone" aria-label={ALLIES_W.gone}>
              <h3>
                {ALLIES_W.gone} · {circle.gone.length}
              </h3>
              {circle.gone.map((t) => (
                <Row key={t.id} t={t} on={t.id === pick} onPick={() => setPick(t.id)} />
              ))}
            </section>
          )}
          {circle.total === 0 && circle.gone.length === 0 && <p class="al-dim">{ALLIES_W.empty}</p>}
        </div>
        <Detail circle={circle} t={cur} onWhisper={onWhisper} onPick={setPick} />
      </div>
    </>
  );
}

function Crisis({ t, onWhisper }: { t: TieView; onWhisper?: (n: string) => void }) {
  if (!t.crisis) return null;
  return (
    <div class="al-crisis" role="alert" data-crisis={t.id}>
      <div class="al-small" style={{ color: color.fate, marginBottom: 4 }}>
        {ALLIES_W.crisis}
      </div>
      <div style={{ lineHeight: 1.6 }}>{t.crisis.text}</div>
      <div class="al-dim al-small" style={{ margin: '6px 0 8px' }}>
        {ALLIES_W.whisperHint} · {ALLIES_W.age} {t.crisis.since}
      </div>
      <button type="button" class="al-btn fate" disabled={!onWhisper} onClick={() => onWhisper?.(t.name)}>
        {ALLIES_W.whisper}: {t.name}
      </button>
    </div>
  );
}

function Detail({ circle, t, onWhisper, onPick }: { circle: CircleView; t: TieView | null; onWhisper?: (n: string) => void; onPick: (id: string) => void }) {
  const others = circle.waiting.filter((w) => w.id !== t?.id);
  return (
    <section class="al-detail" aria-label={t?.name ?? ALLIES_W.circle}>
      {others.map((w) => (
        <div key={w.id}>
          <button type="button" class="al-btn" style={{ marginBottom: 6 }} onClick={() => onPick(w.id)}>
            ✦ {w.name} · {ALLIES_W.crisis}
          </button>
        </div>
      ))}
      {!t && <p class="al-dim">{circle.lonely ? ALLIES_W.lonely : ALLIES_W.empty}</p>}
      {t && <Crisis t={t} onWhisper={onWhisper} />}
      {t && <TieCard t={t} />}
    </section>
  );
}

function TieCard({ t }: { t: TieView }) {
  const ink = inkOf(t.line);
  return (
    <article data-detail={t.id} style={{ opacity: t.alive ? 1 : 0.8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: ink }}>
          <LineIcon line={t.line} size={28} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20 }}>{t.name}</div>
          <div class="al-dim">
            {t.word}
            {t.line !== t.word && !t.isChild ? ` · ${t.line}` : ''} · {ALLIES_W.age} {t.age}
            {t.stage ? ` · ${t.stage}` : ''}
          </div>
        </div>
        {t.mood && (
          <div style={{ textAlign: 'center', color: ink }}>
            <Emote mood={t.mood} size={48} label={`${ALLIES_W.feeling}${t.mood}`} />
            <div class="al-small">{t.mood}</div>
          </div>
        )}
      </div>
      <div style={{ color: lineOf(t.line), margin: '10px 0 4px' }}>
        <Thread level={t.level} width={300} lit={t.level >= 5 && t.alive} />
      </div>
      <div class="al-small al-dim">
        {ALLIES_W.level} {t.level} · {t.levelName}
        {t.alsoMood ? ` · ${t.alsoMood}` : t.mood ? '' : ` · ${ALLIES_W.calm}`}
      </div>
      <div style={{ margin: '10px 0' }}>
        {t.party && <span class="al-pill">{ALLIES_W.party}</span>}
        {t.other && (
          <span class="al-pill">
            {ALLIES_W.otherParent}: {t.other}
          </span>
        )}
        {t.married && (
          <span class="al-pill">
            {ALLIES_W.married} {t.married}
          </span>
        )}
        {t.goneNote && <span class="al-pill" style={{ color: color.dreadText }}>{t.goneNote}</span>}
      </div>
      <h4 style={{ margin: '14px 0 4px', fontWeight: 'normal', color: color.textDim }}>{ALLIES_W.history}</h4>
      {t.history.length === 0 ? (
        <p class="al-dim al-small">{ALLIES_W.noHistory}</p>
      ) : (
        <ul class="al-hist">
          {t.historyMore > 0 && (
            <li class="al-dim al-small">
              <span />
              <span>
                {ALLIES_W.moreHistory} {t.historyMore}
              </span>
            </li>
          )}
          {t.history.map((h) => (
            <li key={h.n}>
              <span class="al-dim al-small">{h.age !== null ? `${ALLIES_W.age} ${Math.floor(h.age)}` : ''}</span>
              <span>{h.text}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
