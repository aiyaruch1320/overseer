// The panel of a soldier's war (code-plan §8.2 row "ศึก", 04-encounters.md §7): the name of the war, the rank and the road to the next, the battles held,
// won and lost, the pay, the foes. The player watches; the numbers are the combat system's own (`life.ext.combat.war`), told by `warModel`.
import { useEffect, useRef } from 'preact/hooks';
import { WAR_WORDS as W } from '../../app/views/battle-words';
import type { WarModel } from '../../app/views/battle';
import { color, font, size } from '../tokens';
import { box, button, chip, css, heading, tint } from './style';

export interface WarPanelProps {
  war: WarModel | null;
  onClose?: () => void;
}

function Stat({ label, value, tone, id }: { label: string; value: string | number; tone?: string; id: string }) {
  return (
    <div style={{ ...box, flex: 1, minWidth: 130, textAlign: 'center' }} data-testid={id}>
      <div style={{ fontFamily: font.title, fontSize: size.title + 8, color: tone ?? color.text, lineHeight: 1.1 }}>{value}</div>
      <div style={{ color: color.textDim, fontSize: size.small }}>{label}</div>
    </div>
  );
}

export function WarPanel({ war, onClose }: WarPanelProps) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current?.();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  if (!war) {
    return (
      <div class="bt-root" data-testid="war-panel" style={{ background: color.panel, color: color.textDim, fontFamily: font.body, fontSize: size.text, padding: size.pad * 1.5 }}>
        <style>{css}</style>
        {W.none}
      </div>
    );
  }
  const pr = war.progress;
  const pct = pr ? Math.min(100, (pr.points / pr.need) * 100) : 100;
  return (
    <div
      class="bt-root"
      data-testid="war-panel"
      style={{ minWidth: size.minWidth, minHeight: size.minHeight, background: color.panel, color: color.text, fontFamily: font.body, fontSize: size.text, padding: size.pad * 1.5, display: 'flex', flexDirection: 'column', gap: size.pad }}
    >
      <style>{css}</style>
      <header style={{ display: 'flex', alignItems: 'center', gap: size.pad }}>
        <span style={chip(color.fate)}>{W.title}</span>
        <h1 style={{ margin: 0, fontFamily: font.title, fontSize: size.title + 6, fontWeight: 400 }} data-testid="war-name">
          {war.name}
        </h1>
        <span style={{ color: color.textDim, fontSize: size.small }}>{W.since(war.years)}</span>
        <span style={{ flex: 1 }} />
        {onClose && (
          <button type="button" class="bt-btn" style={button} onClick={onClose} data-testid="close">
            {W.close} <span style={{ color: color.textDim }}>Esc</span>
          </button>
        )}
      </header>

      <div style={{ ...box, display: 'flex', gap: size.pad * 2, alignItems: 'center' }} data-testid="war-rank">
        <div>
          <div style={heading}>{W.rank}</div>
          <div style={{ fontFamily: font.title, fontSize: size.title + 6, color: color.light }}>{war.rank}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={heading}>
            {pr ? `${W.progress} ${pr.points}/${pr.need} → ${war.next}` : W.top}
          </div>
          <div style={{ height: 12, background: tint(color.text, 8), borderRadius: 3, overflow: 'hidden', border: `1px solid ${color.line}` }}>
            <div class="bt-bar" style={{ width: `${pct}%`, height: '100%', background: color.light }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: size.pad, flexWrap: 'wrap' }}>
        <Stat id="war-battles" label={W.battles} value={war.battles} />
        <Stat id="war-won" label={W.won} value={war.won} tone={color.light} />
        <Stat id="war-held" label={W.held} value={war.held} />
        <Stat id="war-lost" label={W.lost} value={war.lost} tone={war.lost ? color.dread : color.textDim} />
        <Stat id="war-pay" label={`${W.pay} (${W.gold})`} value={war.pay} tone={color.light} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: size.pad }}>
        <div style={box}>
          <div style={heading}>{W.foes}</div>
          {war.foes.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }} data-testid="war-foes">
              {war.foes.map((f) => (
                <span key={f} style={chip(color.fate)}>
                  {f}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ color: color.textDim }}>—</div>
          )}
          {war.rate !== null && (
            <div style={{ marginTop: size.gap, color: color.textDim, fontSize: size.small }}>
              {W.rate} {Math.round(war.rate * 100)}%
            </div>
          )}
        </div>
        <div style={box}>
          <div style={heading}>{W.recent}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="war-recent">
            {war.recent.length ? war.recent.map((t, i) => <div key={i}>{t}</div>) : <div style={{ color: color.textDim }}>—</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
