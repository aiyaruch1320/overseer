// The box of the whisper panel where the player types free words (20-god-ui.md §5, llm/README.md §2 `command`). The game reads them (the LLM when the page has one and the
// switch is on, else the hint's own name in the words) and the panel shows the hint and target it understood, ready for the whisper's own confirm. Nothing is sent here.
import { useState } from 'preact/hooks';
import type { Understood } from '../../app/views/typed';
import { W } from '../../app/views/god-words';
import { color } from '../tokens';
import { useBridge } from './bridge';
import { col, row } from './style';

const T = W.whisper.typed;

export function TypedWhisper(p: { onUnderstood: (hint: string, target?: string) => void }) {
  const b = useBridge();
  const [words, setWords] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Understood | null>(null);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    const r = await b.understand(words);
    setBusy(false);
    setRes(r);
    if (r.ok) p.onUnderstood(r.hint, r.target);
  };
  return (
    <div style={{ ...col, marginBottom: 10 }} data-testid="typed-whisper">
      <label style={col}>
        <span class="g-small">{T.label}</span>
        <div style={row}>
          <input
            type="text"
            value={words}
            maxLength={300}
            placeholder={T.placeholder}
            aria-label={T.label}
            style={{ flex: 1, minWidth: 200, background: '#1a1b24', color: color.text, border: `1px solid ${color.line}`, padding: 6, borderRadius: 4 }}
            onInput={(e) => setWords((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && void go()}
          />
          <button class="g-chip" disabled={busy} onClick={() => void go()}>
            {busy ? T.busy : T.go}
          </button>
        </div>
      </label>
      {res && (
        <div role="status" class="g-small" style={{ color: res.ok ? color.fate : color.dreadText }}>
          {res.ok ? (
            <>
              {T.understood} <b>{res.hint}</b>
              {res.targetName ? ` · ${T.toTarget} ${res.targetName}` : ''} ({res.source === 'template' ? T.viaWords : T.viaLlm}) · {T.confirmHint}
            </>
          ) : (
            res.line
          )}
        </div>
      )}
    </div>
  );
}
