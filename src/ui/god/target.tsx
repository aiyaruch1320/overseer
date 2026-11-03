// Picking a target from a list (countries by continent, continents, people, dragons) with a filter: the way to aim until the map joins, and the
// keyboard way after. The map slot sits above it and picks the same ids.
import { useState } from 'preact/hooks';
import type { TargetOption } from '../../app/views/god';
import { W } from '../../app/views/god-words';
import { color } from '../tokens';
import { col } from './style';

export function TargetList(p: { targets: TargetOption[]; picked: string[]; multi?: boolean; onPick: (id: string) => void; label: string; fill?: boolean }) {
  const [q, setQ] = useState('');
  const shown = p.targets.filter((t) => !q || t.name.includes(q) || t.id.toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(shown.map((t) => t.group))];
  return (
    <div style={{ ...col, ...(p.fill ? { flex: 1, minHeight: 0 } : {}) }}>
      {p.targets.length > 8 && <input type="search" placeholder={`${p.label}…`} aria-label={p.label} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} style={{ background: '#1a1b24', color: color.text, border: `1px solid ${color.line}`, borderRadius: 4, padding: '6px 8px' }} />}
      <div class="g-scroll" role="listbox" aria-label={p.label} aria-multiselectable={p.multi} style={{ ...(p.fill ? { flex: 1, minHeight: 0 } : { maxHeight: 220 }), border: `1px solid ${color.line}`, borderRadius: 4, padding: 6 }}>
        {groups.map((gr) => (
          <div key={gr}>
            <div class="g-small g-dim" style={{ margin: '4px 0 2px' }}>
              {gr}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {shown
                .filter((t) => t.group === gr)
                .map((t) => (
                  <button key={t.id} role="option" aria-selected={p.picked.includes(t.id)} class="g-chip g-small" aria-pressed={p.picked.includes(t.id)} onClick={() => p.onPick(t.id)} style={{ padding: '3px 10px' }}>
                    {t.name}
                    {t.here ? ` · ${W.miracle.here}` : ''}
                    {t.note ? ` ${t.note}` : ''}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
