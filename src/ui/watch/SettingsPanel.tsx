// The settings panel (07-attention.md §4, llm/README.md §3): speed, how often the game calls, the LLM switches, the candle as a percentage.
// Every change goes out as a patch of `Settings`; the core refuses a value it does not know (`badSettings`) and the reason is shown.
import { useEffect, useState } from 'preact/hooks';
import { CARD_SWITCHES, cardsPatch, llmPatch, type LlmKey, type SettingsView } from '../../app/views/watch';
import { WATCH_WORDS as W } from '../../app/views/watch-words';
import type { Settings } from '../../core/types';
import { TITLE_LINE, color, font, size } from '../tokens';
import { RecordSection, type RecordView } from './RecordSection';
import { button, tint } from './style';

export interface SettingsPanelProps {
  view: SettingsView;
  /** The settings now (to build the patch of the LLM switches). */
  settings: Settings;
  candlePct: boolean;
  /** Sends a patch; returns why the core refused it, or null. */
  onChange: (patch: Partial<Settings>) => string | null;
  onCandlePct: (on: boolean) => void;
  onClose: () => void;
  /** The play record and the A/B of the director (M8); left out where the page has no record (the storybook). */
  record?: RecordView;
}

const SPEEDS: Settings['speed'][] = ['pause', 'normal', 'fast'];
const LEVELS: Settings['attention'][] = ['low', 'normal', 'high'];
const LLM_LABEL: Record<LlmKey, string> = { setup: W.settings.llmSetup, director: W.settings.llmDirector, epitaph: W.settings.llmEpitaph };
const LLM_KEYS: LlmKey[] = ['setup', 'director', 'epitaph'];

function Choice({ on, label, onClick, id }: { on: boolean; label: string; onClick: () => void; id: string }) {
  return (
    <button class="wt-btn" role="radio" aria-checked={on} style={{ ...button, flex: 1, ...(on ? { borderColor: color.light, color: color.light, background: tint(color.light, 12) } : {}) }} onClick={onClick} data-testid={id}>
      {label}
    </button>
  );
}

function Switch({ on, label, onToggle, disabled, id }: { on: boolean; label: string; onToggle: (on: boolean) => void; disabled?: boolean; id: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: size.gap, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      <input type="checkbox" role="switch" checked={on} disabled={disabled} onChange={(e) => onToggle((e.currentTarget as HTMLInputElement).checked)} data-testid={id} />
      <span>{label}</span>
    </label>
  );
}

const heading = { color: color.textDim, fontSize: size.small, marginBottom: 6 } as const;

export function SettingsPanel({ view, settings, candlePct, onChange, onCandlePct, onClose, record }: SettingsPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const send = (patch: Partial<Settings>) => setError(onChange(patch));
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div style={{ position: 'absolute', inset: 0, background: tint(color.panel, 60), zIndex: 10, display: 'flex', justifyContent: 'flex-end' }} onClick={(e) => e.target === e.currentTarget && onClose()} data-testid="settings">
      <section role="dialog" aria-modal="true" aria-label={W.settings.title} style={{ width: 420, maxWidth: '100%', height: '100%', overflowY: 'auto', background: color.panel, borderLeft: `1px solid ${color.line}`, padding: size.pad * 1.5, display: 'flex', flexDirection: 'column', gap: size.pad * 1.5 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontFamily: font.title, fontWeight: 400, fontSize: size.title, lineHeight: TITLE_LINE }}>{W.settings.title}</h2>
          <button class="wt-btn" style={button} onClick={onClose} autoFocus data-testid="settings-close">
            {W.settings.close}
          </button>
        </header>

        <div>
          <div style={heading}>{W.settings.speed}</div>
          <div role="radiogroup" aria-label={W.settings.speed} style={{ display: 'flex', gap: 4 }}>
            {SPEEDS.map((s) => (
              <Choice key={s} id={`set-speed-${s}`} on={view.speed === s} label={W.speed[s]} onClick={() => send({ speed: s })} />
            ))}
          </div>
        </div>

        <div>
          <div style={heading}>{W.settings.attention}</div>
          <div role="radiogroup" aria-label={W.settings.attention} style={{ display: 'flex', gap: 4 }}>
            {LEVELS.map((k) => (
              <Choice key={k} id={`set-attention-${k}`} on={view.attention === k} label={W.settings.attentionLevels[k]} onClick={() => send({ attention: k })} />
            ))}
          </div>
          {view.attentionNotes[view.attention] && <p style={{ margin: '8px 0 0', fontSize: size.small, color: color.textDim, lineHeight: 1.5 }}>{view.attentionNotes[view.attention]}</p>}
        </div>

        <div>
          <div style={heading}>{W.settings.cards}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CARD_SWITCHES.map((k) => (
              <Switch key={k} id={`set-card-${k}`} on={view.cards[k]} label={W.settings.cardKinds[k]} onToggle={(on) => send(cardsPatch(settings, k, on))} />
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: size.small, color: color.textDim, lineHeight: 1.5 }}>{W.settings.cardsNote}</p>
        </div>

        <div>
          <div style={heading}>{W.settings.llm}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Switch id="set-llm-master" on={view.master} label={W.settings.llmMaster} onToggle={(on) => send(llmPatch(settings, 'master', on))} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: size.pad * 1.5 }}>
              {LLM_KEYS.map((k) => (
                <Switch key={k} id={`set-llm-${k}`} on={view.llm[k]} label={LLM_LABEL[k]} disabled={!view.master} onToggle={(on) => send(llmPatch(settings, k, on))} />
              ))}
            </div>
          </div>
        </div>

        <div>
          <div style={heading}>{W.settings.candle}</div>
          <Switch id="set-candle-pct" on={candlePct} label={W.settings.candlePct} onToggle={onCandlePct} />
        </div>

        {record && <RecordSection {...record} />}

        {error && (
          <p role="alert" style={{ margin: 0, color: color.dreadText, fontSize: size.small }} data-testid="settings-error">
            {W.settings.refused}: {error}
          </p>
        )}
      </section>
    </div>
  );
}
