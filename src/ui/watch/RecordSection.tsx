// The play record and the A/B of the director, one block of the settings panel (M8). It holds no store: the screen hands it the numbers and the actions.
import { useState } from 'preact/hooks';
import { AB_MODES, abMode, setAbMode, type AbMode, type Arm } from '../../app/ab';
import { downloadRecord, recorder } from '../../app/record';
import { store } from '../../app/store';
import { RECORD_WORDS as R } from '../../app/record-words';
import { color, size } from '../tokens';
import { button, tint } from './style';

export interface RecordView {
  on: boolean;
  /** Events and lives in the record now. */
  size: number;
  lives: number;
  onToggle: (on: boolean) => void;
  /** Hands the record to the browser as a file; returns its name, or null when the browser refused. */
  onExport: () => string | null;
  onClear: () => void;
  ab: AbMode;
  onAb: (m: AbMode) => void;
  /** The arm of the life now (null when the split is off). */
  arm: Arm | null;
}

/** The record and the A/B bound to the app (the watch screen and the start screen share it). Reads signals, so call it while rendering. */
export function boundRecordView(): RecordView {
  return {
    on: recorder.on.value,
    size: recorder.size.value,
    lives: recorder.lives.value,
    onToggle: (on) => recorder.setOn(on),
    onExport: () => downloadRecord(),
    onClear: () => recorder.clear(),
    ab: abMode.value,
    onAb: setAbMode,
    arm: store.currentArm(),
  };
}

const heading = { color: color.textDim, fontSize: size.small, marginBottom: 6 } as const;
const note = { margin: '8px 0 0', fontSize: size.small, color: color.textDim, lineHeight: 1.5 } as const;

export function RecordSection({ on, size: n, lives, onToggle, onExport, onClear, ab, onAb, arm }: RecordView) {
  const [line, setLine] = useState<string | null>(null);
  const doExport = () => {
    const name = onExport();
    setLine(name ? R.exported(name) : R.exportFailed);
  };
  return (
    <div data-testid="record">
      <div style={heading}>{R.title}</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: size.gap, cursor: 'pointer' }}>
        <input type="checkbox" role="switch" checked={on} onChange={(e) => onToggle((e.currentTarget as HTMLInputElement).checked)} data-testid="set-record" />
        <span>{R.on}</span>
      </label>
      <p style={note}>{R.note}</p>
      <p style={note} data-testid="record-count">
        {n > 0 ? R.count(n, lives) : R.empty}
      </p>
      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        <button class="wt-btn" style={{ ...button, flex: 1 }} disabled={n === 0} onClick={doExport} data-testid="record-export">
          {R.export}
        </button>
        <button
          class="wt-btn"
          style={{ ...button, flex: 1 }}
          disabled={n === 0}
          onClick={() => {
            onClear();
            setLine(R.cleared);
          }}
          data-testid="record-clear"
        >
          {R.clear}
        </button>
      </div>
      {line && (
        <p role="status" style={note} data-testid="record-line">
          {line}
        </p>
      )}

      <div style={{ ...heading, marginTop: size.pad * 1.5 }}>{R.ab}</div>
      <div role="radiogroup" aria-label={R.ab} style={{ display: 'flex', gap: 4 }}>
        {AB_MODES.map((m) => (
          <button
            key={m}
            class="wt-btn"
            role="radio"
            aria-checked={ab === m}
            style={{ ...button, flex: 1, ...(ab === m ? { borderColor: color.light, color: color.light, background: tint(color.light, 12) } : {}) }}
            onClick={() => onAb(m)}
            data-testid={`set-ab-${m}`}
          >
            {R.abModes[m]}
          </button>
        ))}
      </div>
      <p style={note}>{R.abNote}</p>
      {arm && (
        <p style={note} data-testid="ab-arm">
          {R.arms[arm]}
        </p>
      )}
    </div>
  );
}
