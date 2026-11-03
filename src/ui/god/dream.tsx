// Dreams (20-god-ui.md §4): three misty doors above the sleeper, a candle under each for his heart (willing, hesitant, resisting) and the reasons
// beside it, the chance to obey, the price; the allies in trouble; the dreams waiting for the crossroads; the results; the burden of the heart.
import { dreamView, type DreamDoor } from '../../app/views/god';
import { W } from '../../app/views/god-words';
import { color } from '../tokens';
import { useView } from './bridge';
import { askGod } from './confirm';
import { Drop, Empty, Flame, Gate, Section } from './parts';
import { col, row } from './style';

function Door(p: { d: DreamDoor }) {
  const d = p.d;
  return (
    <div style={{ ...col, alignItems: 'center', width: 250 }}>
      <button class="g-door" disabled={!d.ok} aria-label={`${d.label} ${d.level}`} style={{ width: '100%', minHeight: 250, opacity: d.ok ? 1 : 0.55, cursor: d.ok ? 'pointer' : 'not-allowed' }} onClick={() => d.ok && askGod('dream.send', { path: d.path })}>
        <div style={{ fontSize: 34, color: '#b8a8e8' }} aria-hidden="true">
          ☾
        </div>
        <div class="g-small" style={{ color: '#b8a8e8', marginBottom: 6 }}>
          {d.symbol}
        </div>
        <div style={{ fontStyle: 'italic', marginBottom: 8 }}>{d.label}</div>
        <div style={{ ...row, justifyContent: 'center', alignItems: 'flex-end', minHeight: 34 }}>
          <Flame level={d.level} />
          <span>
            <b>{d.level}</b>
            <div class="g-small g-dim">
              {W.dream.obey} {d.band}
            </div>
          </span>
        </div>
        <div class="g-small g-dim" style={{ marginTop: 6 }}>
          {d.reasons.map((r, i) => (
            <div key={i}>{r}</div>
          ))}
        </div>
        {d.against && (
          <div class="g-small" style={{ color: '#d4916f', marginTop: 4 }}>
            {W.dream.burdenWarn}
          </div>
        )}
        <div style={{ marginTop: 8 }}>{d.free ? W.free : <Drop line="faith" n={d.price} />}</div>
      </button>
      {!d.ok && d.reason && (
        <span class="g-small g-dim" role="note">
          ⌛ {d.reason}
        </span>
      )}
    </div>
  );
}

export function Dream() {
  const v = useView((g, d) => dreamView(g, d));
  if (!v) return <Empty>{W.noGame}</Empty>;
  if (!v.alive) return <Empty>{W.noLife}</Empty>;
  return (
    <div style={{ background: 'linear-gradient(#14122c, #0e0f14)', borderRadius: 8, padding: 16 }}>
      <div class="g-small g-dim" style={{ ...row, justifyContent: 'space-between' }}>
        <span>
          {W.dream.left} {v.left} {W.dream.times}
        </span>
        <span aria-label={`${W.dream.burden} ${v.heart}/${v.burdenAt}`}>
          {W.dream.burden}:{' '}
          {Array.from({ length: v.burdenAt }, (_, i) => (
            <span key={i} style={{ color: i < v.heart ? '#9a9486' : '#3a3c46' }}>
              ●
            </span>
          ))}
        </span>
      </div>
      <Section title={W.dream.doors} tone="dream">
        {v.doors.length === 0 ? (
          <Empty>{W.dream.none}</Empty>
        ) : (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {v.doors.map((d) => (
              <Door key={d.path} d={d} />
            ))}
          </div>
        )}
      </Section>
      {v.allies.length > 0 && (
        <Section title={W.dream.allies} tone="dream">
          <div style={col}>
            {v.allies.map((a) => (
              <div key={a.id} style={{ ...row, justifyContent: 'space-between', borderBottom: `1px solid ${color.line}`, paddingBottom: 6 }}>
                <span>
                  <b>{a.name}</b> <span class="g-dim">({a.line})</span>
                  {a.text && <div class="g-small g-dim">{a.text}</div>}
                </span>
                <Gate ok={a.ok} reason={a.reason} tone="dream" onClick={() => askGod('dream.send', { ally: a.id })}>
                  {W.dream.allySend} {a.ok && <Drop line="faith" n={a.price} />}
                </Gate>
              </div>
            ))}
          </div>
        </Section>
      )}
      {v.waiting.length > 0 && (
        <Section title={W.dream.waiting} tone="dream">
          <div style={row}>
            {v.waiting.map((w, i) => (
              <span key={i} class="g-chip g-small">
                <Flame level={w.level} /> {w.symbol}
              </span>
            ))}
          </div>
        </Section>
      )}
      {v.results.length > 0 && (
        <Section title={W.dream.results} tone="dream">
          <div style={{ ...col, gap: 4 }}>
            {v.results.map((r, i) => (
              <div key={i} style={{ ...row, alignItems: 'flex-start' }}>
                <span class="g-chip g-small" style={{ flexShrink: 0, color: r.outcome === 'obey' ? color.light : r.outcome === 'defy' ? '#7a9ac8' : color.textDim }}>
                  {r.word}
                </span>
                <span>{r.text}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
