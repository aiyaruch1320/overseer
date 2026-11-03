// Every action of the god goes through here (code-plan §6.4): the screen asks `askGod(action, args)`, the dialog shows the preview the core answered
// (cost, caps, what it will do, or why it may not) and, on a yes, runs it and tells what the log wrote. A miracle is confirmed by holding the
// button (20-god-ui.md §7.1: 1.5 seconds, 3 for the grand ones); everything else by a click.
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { confirmView, resultView } from '../../app/views/god';
import { W } from '../../app/views/god-words';
import type { CommandResult, GodAction } from '../../core/types';
import { color, size } from '../tokens';
import { useBridge } from './bridge';
import { box, col, row, toneColor } from './style';

export interface PendingAct {
  action: GodAction;
  args: Record<string, unknown>;
  onDone?: (r: CommandResult) => void;
}

/** The action waiting for the player's yes (one at a time), and what the last action brought. */
export const pendingAct = signal<PendingAct | null>(null);
export const doneBox = signal<{ title: string; lines: string[]; moved: string[] } | null>(null);

export function askGod(action: GodAction, args: Record<string, unknown> = {}, onDone?: (r: CommandResult) => void): void {
  doneBox.value = null;
  pendingAct.value = { action, args, onDone };
}

export function dropAct(): void {
  pendingAct.value = null;
}

// ---------- hold to confirm ----------

/** The progress (0 to 1) of a hold of `seconds` that began at `t0`, at the time `now` (ms). */
export const holdProgress = (t0: number, now: number, seconds: number): number => Math.max(0, Math.min(1, (now - t0) / (seconds * 1000)));

export function HoldButton(p: { seconds: number; label: string; tone: string; onDone: () => void; disabled?: boolean }) {
  const [prog, setProg] = useState(0);
  const t0 = useRef<number | null>(null);
  const raf = useRef(0);
  const stop = () => {
    t0.current = null;
    cancelAnimationFrame(raf.current);
    setProg(0);
  };
  const tick = () => {
    if (t0.current === null) return;
    const v = holdProgress(t0.current, performance.now(), p.seconds);
    setProg(v);
    if (v >= 1) {
      t0.current = null;
      p.onDone();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };
  const start = () => {
    if (p.disabled || t0.current !== null) return;
    t0.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => stop, []);
  const c = toneColor[p.tone] ?? color.light;
  return (
    <button
      class="g-btn"
      disabled={p.disabled}
      aria-label={`${p.label} (${W.holdToConfirm} ${p.seconds})`}
      style={{ position: 'relative', overflow: 'hidden', borderColor: c, minWidth: 190, touchAction: 'none' }}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && (e.preventDefault(), start())}
      onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && stop()}
      onBlur={stop}
    >
      <span style={{ position: 'absolute', inset: 0, width: `${prog * 100}%`, background: `${c}55` }} />
      <span style={{ position: 'relative' }}>
        {prog > 0 ? W.holding : `${p.label} · ${W.holdToConfirm} ${p.seconds}`}
      </span>
    </button>
  );
}

// ---------- the dialog ----------

export function ConfirmDialog() {
  const b = useBridge();
  void b.rev.value;
  const pending = pendingAct.value;
  const g = b.game();
  const data = b.data();
  const [error, setError] = useState('');
  useEffect(() => setError(''), [pending]);
  useEffect(() => {
    if (!pending) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), dropAct());
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [pending]);
  if (!pending || !g || !data) return null;
  const v = confirmView(g, data, pending.action, pending.args);
  const c = toneColor[v.tone];
  const go = () => {
    const before = { light: g.state.god.light, dread: g.state.god.dread };
    const r = b.run(pending.action, pending.args, true);
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    const rv = resultView(g, data, r, before);
    doneBox.value = { title: v.title, lines: rv.lines, moved: rv.moved };
    pendingAct.value = null;
    pending.onDone?.(r);
  };
  return (
    <div role="dialog" aria-modal="true" aria-label={v.title} style={{ position: 'absolute', inset: 0, background: '#000b', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }} onClick={(e) => e.target === e.currentTarget && dropAct()}>
      <div class="g-rise" style={{ ...box, background: color.panel, border: `1px solid ${c}`, boxShadow: `0 0 28px ${c}44`, width: 'min(560px, 92vw)', maxHeight: '88vh', overflow: 'auto', ...col }}>
        <div class="g-title" style={{ color: c }}>{v.title}</div>
        {!v.ok ? (
          <div style={{ color: '#d4616f' }} role="alert">
            <b>{W.refused}</b>
            <div>{v.reason}</div>
          </div>
        ) : (
          <>
            <div style={{ ...col, gap: 4 }}>
              {v.lines.map((l, i) => (
                <div key={i} style={{ color: i === 0 ? color.text : color.textDim }}>{l}</div>
              ))}
            </div>
            <div class="g-small" style={{ ...row, justifyContent: 'space-between', borderTop: `1px solid ${color.line}`, paddingTop: size.gap }}>
              <span>
                {W.power}: <span style={{ color: color.light }}>{W.light} {v.light}</span> · <span style={{ color: toneColor.dread }}>{W.dread} {v.dread}</span>
              </span>
              {(v.cost.faith > 0 || v.cost.dread > 0) && (
                <span>
                  {W.after}: <span style={{ color: color.light }}>{v.afterLight}</span> · <span style={{ color: toneColor.dread }}>{v.afterDread}</span>
                </span>
              )}
            </div>
            {v.caps.length > 0 && (
              <div class="g-small g-dim">
                {W.caps}: {v.caps.join(' · ')}
              </div>
            )}
          </>
        )}
        {error && (
          <div role="alert" style={{ color: '#d4616f' }}>
            {error}
          </div>
        )}
        <div style={{ ...row, justifyContent: 'flex-end' }}>
          <button class="g-btn" onClick={dropAct} autoFocus={!v.ok}>
            {v.ok ? W.cancel : W.close}
          </button>
          {v.ok &&
            (v.hold > 0 ? (
              <HoldButton seconds={v.hold} label={W.confirm} tone={v.tone} onDone={go} />
            ) : (
              <button class={`g-btn ${v.tone}`} onClick={go} autoFocus>
                {W.confirm}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

/** What the last action brought: the lines the log wrote and the move of the power. */
export function DoneBox() {
  const d = doneBox.value;
  if (!d) return null;
  return (
    <div class="g-rise" role="status" style={{ ...box, borderColor: color.light, margin: `0 0 ${size.gap}px`, ...col, gap: 3 }}>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <b style={{ color: color.light }}>
          {W.done}: {d.title}
        </b>
        <button class="g-btn" aria-label={W.close} onClick={() => (doneBox.value = null)}>
          ×
        </button>
      </div>
      {d.lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
      {d.moved.length > 0 && <div class="g-small g-dim">{d.moved.join(' · ')}</div>}
    </div>
  );
}
