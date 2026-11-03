// The chronicle of the hand (20-god-ui.md §8): an old black leather book; the epithet of the god in this life at the top, one row for each
// intervention (world year and the age of the character, the kind, a line of the colour of the power), what followed hanging from the row by an ink line.
import { chronicleView } from '../../app/views/god';
import { W } from '../../app/views/god-words';
import { color } from '../tokens';
import { useView } from './bridge';
import { Empty } from './parts';
import { box, col, row } from './style';

const LINE_COLOR = { faith: color.light, dread: color.dreadText, fate: color.fate } as const;

export function Chronicle() {
  const v = useView((g, d) => chronicleView(g, d));
  if (!v) return <Empty>{W.noGame}</Empty>;
  return (
    <div style={{ ...box, background: '#17130d', borderColor: '#5a4a30', ...col, gap: 4 }}>
      <div style={{ textAlign: 'center', paddingBottom: 8, borderBottom: '1px solid #5a4a30' }}>
        <div class="g-small g-dim">{W.chronicle.epithet}</div>
        <div class="g-title" style={{ color: color.light }}>
          {v.epithets.length ? v.epithets.join(' · ') : W.chronicle.noEpithet}
        </div>
      </div>
      {v.rows.length === 0 && <Empty>{W.chronicle.empty}</Empty>}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, ...col, gap: 4 }}>
        {v.rows.map((r, i) => (
          <li key={i}>
            <div style={{ ...row, alignItems: 'baseline' }}>
              <span class="g-small g-dim" style={{ minWidth: 120 }}>
                {r.yearWord}
                {r.age !== null ? ` · ${W.ageWord} ${r.age}` : ''}
              </span>
              <span class="g-chip g-small" style={{ color: LINE_COLOR[r.line], borderColor: LINE_COLOR[r.line] + '88' }}>
                {r.kindWord}
              </span>
              <span>{r.text}</span>
            </div>
            {r.after.length > 0 && (
              <ul style={{ margin: '2px 0 4px 132px', padding: '0 0 0 10px', borderLeft: '2px solid #5a4a30', listStyle: 'none' }}>
                {r.after.map((a, j) => (
                  <li key={j} class="g-small g-dim">
                    {W.chronicle.after}: {a.text}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
