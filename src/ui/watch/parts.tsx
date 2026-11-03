// The parts of the watch screen (20-god-ui.md §2): candle, god panel, speed control, life line, story log. Presentational: they get a model
// from src/app/views/watch.ts and callbacks; they know neither the store nor the core.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CandleView, GodKind, GodPanelView, LifeLineView, Vial } from '../../app/views/watch';
import { WATCH_WORDS as W } from '../../app/views/watch-words';
import type { Line } from '../../core/text';
import type { Settings } from '../../core/types';
import { color, font, size } from '../tokens';
import { button, buttonOff, layout, panelBox, tint, toneColor } from './style';

// ---------- the candle of the character's belief ----------

const CANDLE_COLOR: Record<CandleView['tone'], string> = { loyal: color.light, wavering: color.text, cold: color.fate };
const FLAME_MAX = 54;

/** How the number last moved: shown for a moment next to the candle as +3 or −2. */
function useDelta(value: number | null): { delta: number; key: number } | null {
  const prev = useRef(value);
  const [shown, setShown] = useState<{ delta: number; key: number } | null>(null);
  useEffect(() => {
    if (value === null || prev.current === null) {
      prev.current = value;
      return;
    }
    const d = Math.round(value - prev.current);
    prev.current = value;
    if (d === 0) return;
    setShown((s) => ({ delta: d, key: (s?.key ?? 0) + 1 }));
    const t = setTimeout(() => setShown(null), 1600);
    return () => clearTimeout(t);
  }, [value]);
  return shown;
}

export function Candle({ candle, showPct }: { candle: CandleView; showPct: boolean }) {
  const delta = useDelta(Math.round(candle.belief));
  const c = CANDLE_COLOR[candle.tone];
  const h = Math.round(FLAME_MAX * candle.fill);
  const sign = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: size.gap }} title={`${W.belief} ${Math.round(candle.belief)}${candle.bandName ? ` · ${candle.bandName}` : ''}`} data-testid="candle">
      <div style={{ position: 'relative', width: 26, height: FLAME_MAX + 30 }}>
        <div class="wt-flame" style={{ position: 'absolute', left: 8, bottom: 28, width: 10, height: h, background: c, borderRadius: '50% 50% 40% 40% / 70% 70% 30% 30%', boxShadow: `0 0 10px ${tint(c, 60)}` }} />
        <div style={{ position: 'absolute', left: 4, bottom: 0, width: 18, height: 30, background: tint(color.text, 22), borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: 12, bottom: 28, width: 2, height: 4, background: color.textDim }} />
        {delta && (
          <span key={delta.key} class="wt-rise" style={{ position: 'absolute', left: 26, bottom: FLAME_MAX, color: c, fontSize: size.small, fontFamily: font.mono }}>
            {sign(delta.delta)}
          </span>
        )}
      </div>
      <div style={{ fontSize: size.small, lineHeight: 1.3 }}>
        <div style={{ color: color.textDim }}>{W.belief}</div>
        <div style={{ color: c }}>
          {Math.round(candle.belief)}
          {showPct ? ` · ${candle.pct}%` : ''}
        </div>
        {candle.bandName && <div style={{ color: color.textDim }}>{candle.bandName}</div>}
      </div>
    </div>
  );
}

// ---------- the god panel ----------

/** A drop-shaped glass; the level is a liquid (20-god-ui.md §2 "ดวงไฟสองดวงซ้อนแนวตั้ง"). */
function Drop({ vial, tone, label, id }: { vial: Vial; tone: string; label: string; id: string }) {
  const top = 6 + (1 - vial.fill) * 50;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size.gap }} title={`${label} ${vial.value} / ${vial.cap}`} data-testid={id}>
      <svg width={40} height={62} viewBox="0 0 40 62" aria-hidden="true">
        <defs>
          <clipPath id={`clip-${id}`}>
            <path d="M20 3 C20 3 5 24 5 40 a15 15 0 0 0 30 0 C35 24 20 3 20 3Z" />
          </clipPath>
        </defs>
        <path d="M20 3 C20 3 5 24 5 40 a15 15 0 0 0 30 0 C35 24 20 3 20 3Z" fill={tint(tone, 8)} stroke={color.line} stroke-width={1.5} />
        <rect x={0} y={top} width={40} height={62 - top} fill={tint(tone, 85)} clip-path={`url(#clip-${id})`} class="wt-flame" />
      </svg>
      <div style={{ fontSize: size.small, lineHeight: 1.25 }}>
        <div style={{ color: tone, fontFamily: font.mono, fontSize: size.text }}>{vial.value}</div>
        <div style={{ color: color.textDim }}>{label}</div>
      </div>
    </div>
  );
}

export function GodPanel({ panel, onOpen }: { panel: GodPanelView; onOpen: (kind: GodKind) => void }) {
  return (
    <section aria-label="god" style={{ ...panelBox, display: 'flex', flexDirection: 'column', gap: size.gap }}>
      <Drop vial={panel.light} tone={color.light} label={W.light} id="light" />
      <Drop vial={panel.dread} tone={color.dread} label={W.dread} id="dread" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {panel.buttons.map((k) => {
          const glow = panel.windowOpen && (k === 'chest' || k === 'dream');
          const off = !panel.alive;
          const gate = panel.gates[k];
          const grey = off || !!gate;
          return (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button
                class={`wt-btn${glow && !gate ? ' wt-edge' : ''}`}
                style={{ ...(grey ? buttonOff : button), display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...(glow && !gate ? { borderColor: color.light } : {}) }}
                disabled={off}
                aria-disabled={grey}
                aria-keyshortcuts={W.keys[k]}
                title={gate?.reason}
                onClick={() => !gate && onOpen(k)}
                data-testid={`god-${k}`}
              >
                <span>{W.god[k]}</span>
                <kbd style={{ fontFamily: font.mono, fontSize: 11, color: color.textDim }}>{W.keys[k]}</kbd>
              </button>
              {gate && (
                <span role="note" style={{ color: color.textDim, fontSize: size.small, lineHeight: 1.3 }} data-testid={`god-${k}-why`}>
                  {W.gate.hourglass} {gate.reason}
                  {gate.wait !== undefined && !gate.reason.includes('ปี') ? ` · ${W.gate.wait(gate.wait)}` : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- speed ----------

const SPEEDS: Settings['speed'][] = ['pause', 'normal', 'fast'];

export function SpeedControl({ speed, running, onSpeed }: { speed: Settings['speed']; running: boolean; onSpeed: (s: Settings['speed']) => void }) {
  const now = running ? speed : 'pause';
  return (
    <div role="group" aria-label={W.settings.speed} style={{ display: 'flex', gap: 4 }}>
      {SPEEDS.map((s) => {
        const on = s === now;
        return (
          <button
            key={s}
            class="wt-btn"
            aria-pressed={on}
            aria-keyshortcuts={W.speedKeys[s]}
            title={`${W.speed[s]} (${W.speedKeys[s]})`}
            style={{ ...button, flex: 1, padding: `${size.gap - 2}px 4px`, ...(on ? { borderColor: color.light, color: color.light, background: tint(color.light, 12) } : {}) }}
            onClick={() => onSpeed(s)}
            data-testid={`speed-${s}`}
          >
            {W.speed[s]}
          </button>
        );
      })}
    </div>
  );
}

// ---------- the life line ----------

const PAD = 28;
const at = (pos: number): string => `calc(${PAD}px + (100% - ${PAD * 2}px) * ${pos})`;

export function LifeLine({ line }: { line: LifeLineView }) {
  return (
    <section aria-label={W.lifeLine} style={{ position: 'relative', height: layout.lineHeight, background: color.panel, borderTop: `1px solid ${color.line}` }} data-testid="lifeline">
      <div style={{ position: 'absolute', left: PAD, right: PAD, top: '50%', height: 2, background: color.line }} />
      <div style={{ position: 'absolute', left: PAD, top: '50%', height: 2, width: `calc((100% - ${PAD * 2}px) * ${line.pos})`, background: tint(color.text, 40) }} />
      {line.pegs.map((p) => (
        <div key={p.age} style={{ position: 'absolute', left: at(p.pos), top: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }} data-testid="peg">
          <div style={{ width: 14, height: 14, borderRadius: 3, background: p.passed ? color.textDim : color.panel, border: `2px solid ${p.passed ? color.textDim : color.text}`, margin: '0 auto' }} />
          <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: color.textDim, fontFamily: font.mono }}>{p.age}</div>
        </div>
      ))}
      {line.stops.map((s) => (
        <div key={s.n} title={`${s.age.toFixed(1)}`} style={{ position: 'absolute', left: at(s.pos), top: '50%', width: 9, height: 9, background: color.textDim, transform: 'translate(-50%, -50%) rotate(45deg)' }} data-testid="stopmark" />
      ))}
      {line.marks.map((m, i) => (
        <div
          key={m.n}
          title={m.text || W.mark}
          style={{ position: 'absolute', left: at(m.pos), top: `calc(50% - ${18 + (i % 2) * 9}px)`, width: 7, height: 10, borderRadius: '50%', background: toneColor[m.tone], transform: 'translate(-50%, -50%)', opacity: 0.9 }}
          data-testid="mark"
        />
      ))}
      {line.glows.map((g) => (
        <div
          key={g.n}
          class={g.open ? 'wt-beat-open' : ''}
          title={g.title ? `${W.glow}: ${g.title}` : W.glow}
          style={{ position: 'absolute', left: at(g.pos), top: '50%', width: 12, height: 12, borderRadius: '50%', background: tint(color.light, g.open ? 90 : 30), boxShadow: g.open ? `0 0 8px ${tint(color.light, 80)}` : 'none', transform: 'translate(-50%, -50%)' }}
          data-testid={g.open ? 'glow-open' : 'glow'}
        />
      ))}
      <div style={{ position: 'absolute', left: at(line.pos), top: 14, bottom: 14, width: 2, background: color.light, transform: 'translateX(-1px)', boxShadow: `0 0 6px ${tint(color.light, 60)}` }} data-testid="now" />
    </section>
  );
}

// ---------- the story log ----------

const LEVEL_COLOR = { 0: color.textDim, 1: color.textDim, 2: color.text, 3: color.light } as const;

export function StoryLog({ log }: { log: Line[] }) {
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  return (
    <section
      aria-label={W.story}
      ref={box}
      class="wt-log"
      tabIndex={0}
      onScroll={(e) => {
        const el = e.currentTarget as HTMLElement;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
      style={{ height: layout.logHeight, overflowY: 'auto', background: color.panel, borderTop: `1px solid ${color.line}`, padding: `${size.gap}px ${size.pad}px`, fontSize: size.small, lineHeight: 1.55 }}
      data-testid="log"
    >
      {log.length === 0 && <div style={{ color: color.textDim }}>{W.empty}</div>}
      {log.map((l) => (
        <div key={l.n} style={{ color: LEVEL_COLOR[l.level], fontWeight: l.level >= 3 ? 600 : 400 }}>
          {l.age !== undefined && <span style={{ color: color.textDim, fontFamily: font.mono, marginRight: size.gap }}>{`${W.age} ${l.age}`}</span>}
          {l.text}
        </div>
      ))}
    </section>
  );
}

/** A box that stands for a part another agent builds (the scene player, the map). */
export function Slot({ title, note, children, style }: { title: string; note?: string; children?: ComponentChildren; style?: Record<string, string | number> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, color: color.textDim, border: `1px dashed ${color.line}`, borderRadius: size.radius, fontSize: size.small, ...style }}>
      {children ?? (
        <>
          <div>{title}</div>
          {note && <div style={{ fontSize: 11 }}>{note}</div>}
        </>
      )}
    </div>
  );
}
