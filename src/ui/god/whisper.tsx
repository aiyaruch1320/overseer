// The whisper (20-god-ui.md §5): nine silver icons in a ring around the character, one hint each. A hint that points names its target first
// (a place, a person of his circle, an ally by name). The price, the chance he heeds it and what it does are shown before it is sent.
import { useState } from 'preact/hooks';
import { whisperView, type WhisperHint } from '../../app/views/god';
import { W } from '../../app/views/god-words';
import { color } from '../tokens';
import { useView } from './bridge';
import { askGod } from './confirm';
import { TypedWhisper } from './typed-whisper';
import { Drop, Empty, Gate, Section } from './parts';
import { box, col, row } from './style';

const R = 150;

function Ring(p: { hints: WhisperHint[]; sel: string | null; onPick: (h: string) => void }) {
  const n = p.hints.length;
  return (
    <div role="group" aria-label={W.whisper.ring} style={{ position: 'relative', width: 2 * R + 90, height: 2 * R + 90, flexShrink: 0 }}>
      <div aria-hidden="true" style={{ position: 'absolute', left: R + 5, top: R + 5, width: 80, height: 80, borderRadius: '50%', background: '#1a1b24', border: `1px solid ${color.fate}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.fate }}>
        ☾
      </div>
      {p.hints.map((h, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        return (
          <button
            key={h.hint}
            class="g-chip"
            aria-pressed={p.sel === h.hint}
            aria-label={`${h.hint}${h.ok || h.needs ? '' : ` (${h.reason ?? ''})`}`}
            style={{ position: 'absolute', left: R + 45 + Math.cos(a) * R - 45, top: R + 45 + Math.sin(a) * R - 28, width: 90, height: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderColor: h.ok || h.needs ? color.fate : color.line, color: h.ok || h.needs ? color.fate : color.textDim, opacity: h.ok || h.needs ? 1 : 0.6 }}
            onClick={() => p.onPick(h.hint)}
          >
            <span aria-hidden="true" style={{ fontSize: 18 }}>
              {h.glyph}
            </span>
            <span class="g-small">{h.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function Detail(p: { h: WhisperHint; pre?: string }) {
  const h = p.h;
  const [target, setTarget] = useState(h.targets.find((t) => !!p.pre && (t.id === p.pre || t.plain === p.pre))?.id ?? '');
  const groups = [...new Set(h.targets.map((t) => t.group))];
  const ready = !h.needs || !!target;
  const args = h.needs ? { hint: h.hint, target } : { hint: h.hint };
  return (
    <div style={{ ...col, flex: 1, minWidth: 260 }}>
      <div class="g-title">
        {h.glyph} {h.hint}
      </div>
      <div>{h.effect}</div>
      <div class="g-small g-dim">
        {W.dream.heart}: <b style={{ color: color.text }}>{h.level}</b> · {W.whisper.price}: <Drop line="faith" n={h.price} />
      </div>
      {h.needs && (
        <label style={col}>
          <span class="g-small">{h.needs === 'place' ? W.whisper.place : W.whisper.npc}</span>
          <select value={target} onChange={(e) => setTarget((e.target as HTMLSelectElement).value)} style={{ background: '#1a1b24', color: color.text, border: `1px solid ${color.line}`, padding: 6, borderRadius: 4 }}>
            <option value="">{W.whisper.target}…</option>
            {groups.map((gr) => (
              <optgroup key={gr} label={gr}>
                {h.targets.filter((t) => t.group === gr).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      <Gate ok={h.ok && ready} reason={!h.ok ? h.reason : !ready ? W.whisper.pickTarget : undefined} tone="fate" onClick={() => askGod('whisper', args)}>
        {W.whisper.send}
      </Gate>
    </div>
  );
}

/**
 * `why` and `id` come from the card that opened the whisper: a crisis card brings the id of the ally in crisis, and the whisper opens on the
 * hint of help with him picked (20-god-ui.md §2: the card is the way in, so the screen must know whom it is about).
 */
export function Whisper(p: { hint?: string; why?: string; id?: string; target?: string; typed?: string }) {
  const v = useView((g, d) => whisperView(g, d));
  const crisis = v ? v.crises.find((c) => c.id === p.id || c.id === p.target || c.name === p.target) ?? (p.why === 'crisis' ? v.crises[0] : undefined) : undefined;
  const [sel, setSel] = useState<string | null>(p.hint ?? (crisis || p.target ? W.whisper.helpHint : null));
  // the target the typed words named, kept until the player picks another hint
  const [typedTarget, setTypedTarget] = useState<string | undefined>(undefined);
  if (!v) return <Empty>{W.noGame}</Empty>;
  if (!v.alive) return <Empty>{W.noLife}</Empty>;
  const cur = v.hints.find((h) => h.hint === sel);
  return (
    <div>
      {crisis && (
        <div role="note" style={{ ...box, borderColor: '#b4364a', marginBottom: 8 }}>
          <b style={{ color: color.dreadText }}>
            {W.whisper.crisisMark} {crisis.name}
          </b>{' '}
          <span class="g-small g-dim">
            ({crisis.line}) · {W.whisper.inCrisis}
          </span>
          {crisis.text && <div class="g-small">{crisis.text}</div>}
          <div class="g-small g-dim">{W.whisper.crisisFor} {crisis.name}</div>
        </div>
      )}
      {p.target && !crisis && !v.hints.some((h) => h.targets.some((t) => t.id === p.target || t.plain === p.target || t.name === p.target)) && (
        <div role="note" class="g-small" style={{ color: color.dreadText, marginBottom: 6 }}>
          {p.target}: {W.whisper.notOffered}
        </div>
      )}
      <div class="g-small g-dim">
        {W.whisper.left} {v.left} {W.whisper.times}
      </div>
      <TypedWhisper initial={p.typed} onUnderstood={(h, t) => (setTypedTarget(t), setSel(h))} />
      <div style={{ ...row, alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
        <Ring hints={v.hints} sel={sel} onPick={(h) => (setTypedTarget(undefined), setSel(h))} />
        {cur ? <Detail key={`${cur.hint}:${typedTarget ?? ''}`} h={cur} pre={typedTarget ?? crisis?.id ?? p.target} /> : <Empty>{W.whisper.ring}</Empty>}
      </div>
      {v.active.length > 0 && (
        <Section title={W.whisper.active} tone="fate">
          <div style={row}>
            {v.active.map((a, i) => (
              <span key={i} class="g-chip g-small">
                {a.hint}
                {a.target ? ` → ${a.target}` : ''}
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
