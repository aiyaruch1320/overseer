// The line under the scene when a small or middle miracle fell and the scene has no script of its own (20-god-ui.md §7.3: the effect is seen on the
// map and in the scene; where the script is not written yet the scene area says it in a line). The watch screen mounts it where it likes.
import { effectLine } from '../../app/views/god';
import { color, size } from '../tokens';
import { useView } from './bridge';
import { GodStyles } from './style';

const LINE = { faith: color.light, dread: '#d4616f' } as const;

export function GodEffectLine() {
  const e = useView((g, d) => effectLine(g, d));
  if (!e) return null;
  const c = LINE[e.line];
  return (
    <>
      <GodStyles />
      <div class="g-root g-rise" role="status" aria-live="polite" style={{ borderLeft: `3px solid ${c}`, padding: `${size.gap}px ${size.pad}px`, background: 'rgba(14,15,20,0.82)', opacity: 0.55 + 0.45 * e.fresh }}>
        <b style={{ color: c }}>{e.name}</b>
        {e.where && <span class="g-dim"> · {e.where}</span>}
        {e.text && <div class="g-small">{e.text}</div>}
      </div>
    </>
  );
}
