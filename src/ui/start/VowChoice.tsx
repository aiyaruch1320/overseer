// The vows of the life on the table, where the game offers them (08-goals.md §2): at the birth of a life that did not start from the start screen (an heir, a newcomer), and the
// one change at the age stop of 15. The start screen takes the first vow of the first life itself; the watch screen mounts this component for the rest:
//
//   import { VowChoice } from '../start';   ...   <VowChoice />
//
// It draws nothing while no choice is open, so it can sit in the watch screen's overlays (the card list or beside the age-stop card) all the time. `only` limits it to one phase
// ('first' at birth, 'change' at 15). `VowLine` is the one small line of the vow of the life ("ผู้เล่นเห็นมันมุมจอตลอดชีวิต"), for the corner of the watch and the character screen.
import { useState } from 'preact/hooks';
import { store } from '../../app/store';
import { vowChoiceView, vowLineOf, START_LABELS, type VowChoiceView } from '../../app/views/start';
import type { Ctx } from '../../core/game';
import { color, font, size } from '../tokens';
import { Button, panel } from './parts';

export interface VowChoiceProps {
  /** The game to read; the store's game when absent. */
  ctx?: Ctx;
  /** Which phase to show; both when absent. */
  only?: 'first' | 'change';
  /** Called with the number picked (1 to N, N + 1 for none); the default sends `vow.pick` to the store. */
  onPick?: (n: number) => { ok: boolean; reason?: string } | void;
  /** Called when the player has chosen or leaves the choice. */
  onDone?: () => void;
}

/** The choices the player turned away from, so the panel does not come back at every frame (a life and a phase). */
const left = new Set<string>();

export function VowChoice(props: VowChoiceProps) {
  void store.rev.value;
  const [, redraw] = useState(0);
  const [error, setError] = useState('');
  const ctx = props.ctx ?? store.game?.ctx;
  const data = ctx?.data;
  const view: VowChoiceView | null = ctx && data ? vowChoiceView(ctx) : null;
  if (!view || (props.only && view.phase !== props.only)) return null;
  const key = `${view.life}:${view.phase}`;
  if (left.has(key)) return null;
  const pick = (n: number) => {
    const r = props.onPick ? props.onPick(n) : store.god('vow.pick', { pick: n }, true);
    if (r && !r.ok) return setError(r.reason ?? '');
    left.add(key);
    redraw((x) => x + 1);
    props.onDone?.();
  };
  const leave = () => {
    left.add(key);
    redraw((x) => x + 1);
    props.onDone?.();
  };
  return (
    <section aria-label={START_LABELS.vow} style={{ ...panel({ padding: size.pad }), color: color.text, fontFamily: font.body, fontSize: size.text, display: 'grid', gap: size.gap }}>
      <div style={{ fontFamily: font.title, fontSize: size.title, color: color.light }}>{view.phase === 'change' ? START_LABELS.vowChange : START_LABELS.vowFirst}</div>
      {view.current && (
        <div style={{ color: color.textDim, fontSize: size.small }}>
          {START_LABELS.vowNow}: {view.current}
        </div>
      )}
      <div role="group" aria-label={START_LABELS.vow} style={{ display: 'grid', gap: 6 }}>
        {view.vows.map((v) => (
          <button
            key={v.n}
            type="button"
            onClick={() => pick(v.n)}
            style={{ textAlign: 'left', fontFamily: font.body, fontSize: size.text, color: color.text, background: '#1d1e27', border: `1px solid ${color.line}`, borderRadius: size.radius, padding: '6px 10px', cursor: 'pointer' }}
          >
            <div>{v.name}</div>
            {v.done && <div style={{ color: color.textDim, fontSize: size.small }}>{v.done}</div>}
          </button>
        ))}
        <button
          type="button"
          onClick={() => pick(view.vows.length + 1)}
          style={{ textAlign: 'left', fontFamily: font.body, fontSize: size.text, color: color.textDim, background: '#16171f', border: `1px dashed ${color.line}`, borderRadius: size.radius, padding: '6px 10px', cursor: 'pointer' }}
        >
          {START_LABELS.noVow}
        </button>
      </div>
      <div style={{ color: color.textDim, fontSize: size.small }}>{view.phase === 'change' ? START_LABELS.vowChangeNote : START_LABELS.vowFirstNote}</div>
      {error && <div role="alert" style={{ color: color.dreadText }}>{error}</div>}
      <div>
        <Button onClick={leave}>{view.phase === 'change' ? START_LABELS.vowKeep : START_LABELS.vowLater}</Button>
      </div>
    </section>
  );
}

/** The vow of the life as one small line: "คำปฏิญาณ · ให้เขากลับบ้าน"; nothing when the life has none. */
export function VowLine({ ctx }: { ctx?: Ctx }) {
  void store.rev.value;
  const c = ctx ?? store.game?.ctx;
  const line = c ? vowLineOf(c) : null;
  if (!line) return null;
  return (
    <span title={line.done} style={{ color: color.textDim, fontSize: size.small }}>
      {START_LABELS.vow} · {line.name}
    </span>
  );
}
