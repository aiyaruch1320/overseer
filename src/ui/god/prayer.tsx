// Prayers (20-god-ui.md §6): a scroll of rice paper with a slow-burning edge, who prays, and the five answers with their cost and what they do.
// Silence is the fifth answer (the card burns on). `id` shows one card (the card that calls the player), none shows all that wait.
import { useState } from 'preact/hooks';
import { prayerView, type PrayerCardView } from '../../app/views/god';
import { W } from '../../app/views/god-words';
import { color, size } from '../tokens';
import { useView } from './bridge';
import { askGod } from './confirm';
import { Empty, Gate } from './parts';
import { box, col, row } from './style';

function Scroll(p: { c: PrayerCardView }) {
  const c = p.c;
  const [opt, setOpt] = useState(0);
  return (
    <article class="g-rise" aria-label={`${W.prayer.title} ${c.n}`} style={{ ...box, background: '#1b1812', borderColor: '#5a4a30', minWidth: 300, flex: '1 1 340px', ...col }}>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <b class="g-title" style={{ fontSize: 18 }}>
          {c.name}
        </b>
        <span class="g-small g-dim">#{c.n}</span>
      </div>
      {c.by && (
        <div class="g-small g-dim">
          {W.prayer.by} {c.by}
        </div>
      )}
      <div class="g-small g-dim" role="timer">
        {W.prayer.timeLeft} {c.yearsLeft} {W.yearWord}
        {c.silent ? ` · ${W.prayer.silent}` : ''}
        <div class="g-burn" aria-hidden="true">
          <i style={{ width: `${c.fraction * 100}%` }} />
        </div>
      </div>
      {c.options.length > 0 && (
        <fieldset style={{ border: `1px solid ${color.line}`, borderRadius: 4, padding: 6 }}>
          <legend class="g-small g-dim">{W.prayer.option}</legend>
          {c.options.map((o) => (
            <label key={o.index} style={{ ...row, cursor: 'pointer' }}>
              <input type="radio" name={`opt${c.n}`} checked={opt === o.index} onChange={() => setOpt(o.index)} />
              <span>
                {o.name} <span class="g-small g-dim">({o.tierWord})</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div style={{ ...col, gap: 6 }}>
        {c.answers.map((a) => (
          <div key={a.key} style={{ ...row, alignItems: 'flex-start', borderTop: `1px solid ${color.line}`, paddingTop: 6 }}>
            <Gate
              ok={a.ok}
              reason={a.reason}
              tone={a.key === 'punish' ? 'dread' : a.key === 'silent' || a.key === 'deny' ? '' : 'light'}
              style={{ minWidth: 120 }}
              onClick={() => askGod('prayer.answer', { id: c.n, answer: a.arg, ...(a.key === 'strange' ? { option: opt } : {}) })}
            >
              <span aria-hidden="true">{a.glyph}</span> {a.word}
            </Gate>
            <div class="g-small" style={{ flex: 1 }}>
              {a.ok && a.cost && (
                <div>
                  {W.prayer.cost}: {a.cost}
                </div>
              )}
              {a.ok && a.effect.map((l, i) => (
                <div key={i} class="g-dim">
                  {l}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function Prayer(p: { id?: number }) {
  const v = useView((g, d) => prayerView(g, d));
  if (!v) return <Empty>{W.noGame}</Empty>;
  if (!v.alive) return <Empty>{W.noLife}</Empty>;
  const cards = p.id === undefined ? v.cards : v.cards.filter((c) => c.n === p.id);
  if (!cards.length) return <Empty>{W.prayer.none}</Empty>;
  return <div style={{ display: 'flex', gap: size.pad, flexWrap: 'wrap' }}>{cards.map((c) => <Scroll key={c.n} c={c} />)}</div>;
}
