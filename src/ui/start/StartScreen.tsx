// The start screen (code-plan §8.2 row "เริ่ม"; 20-god-ui.md §11 and §10, 19-wish.md, 04-start-modes.md, 08-goals.md §2 §5).
// Left: the start modes. Middle: the box of the wish with the tags and what the parser understood while typing. Right: the sheet of birth with the fate points,
// the cups of the rhythm of fate, the stones of the vows and the buttons. The life starts with `store.newLife(opts)`; the rhythm and the vow are confirmed
// right after, before the first beat. Every word is from `src/app/views/start.ts`; the colours are from tokens.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { store } from '../../app/store';
import { SAVE_WORDS } from '../../app/save-words';
import { certificate, chipValues, emptyDraft, handFields, launch, readWish, sheetParts, startModes, START_LABELS, WISH_CHIPS, type StartDraft, type WishRead } from '../../app/views/start';
import type { GameData } from '../../core/game';
import type { GameState } from '../../core/types';
import { color, font, size } from '../tokens';
import { Beads, Button, Heading, paper, panel, SheetLine, Styles, Understood } from './parts';

export interface StartProps {
  data?: GameData;
  /** The save whose collection decides which modes are open (null: a world not begun). */
  state?: GameState | null;
  initial?: Partial<StartDraft>;
  /** Called when the player starts; the default starts the life through the bridge. */
  onStart?: (read: WishRead, draft: StartDraft) => { ok: boolean; reason?: string } | void;
}

const CUP: Record<string, string> = { natural: '#aecbd6', gentle: '#e2b873', sorrow: '#8b9099', irony: '#8f63c8' };

export function StartScreen(props: StartProps) {
  void store.rev.value;
  const data = props.data ?? store.gameData;
  if (!data) return <div style={{ color: color.text, padding: size.pad }}>…</div>;
  return <StartInner {...props} data={data} />;
}

function StartInner(props: StartProps & { data: GameData }) {
  const data = props.data;
  const [draft, setDraft] = useState<StartDraft>(() => ({ ...emptyDraft(Math.floor(Math.random() * 1e6)), ...props.initial }));
  const [chip, setChip] = useState<string | null>(null);
  const [byHand, setByHand] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<StartDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const read = useMemo(() => readWish(data, draft), [data, draft.text, draft.mode, draft.picks]);
  const cert = useMemo(() => certificate(data, draft, read), [data, read, draft.seed, draft.rhythm]);
  const modes = useMemo(() => startModes(data, props.state === undefined ? store.state : props.state, draft.mode), [data, props.state, draft.mode]);
  const parts = useMemo(() => sheetParts(data), [data]);
  const hand = useMemo(() => handFields(data), [data]);

  // the vows on the table change with the life: a pick made for other stones is let go
  const stones = cert.vows.map((v) => v.id).join('|');
  const seen = useRef(stones);
  useEffect(() => {
    if (seen.current === stones) return;
    seen.current = stones;
    set({ vow: null });
  }, [stones]);

  const chosen = cert.vows.find((v) => v.n === draft.vow) ?? null;
  const handOpen = byHand || read.byHand;
  const rowOf = (row: string) => cert.items.filter((i) => i.row === row);
  const partName = (i: number) => parts[i]?.part ?? '';
  // a save in the browser: the button goes on with that life (not in the storybook, which hands its own `onStart`)
  const saved = useMemo(() => (props.onStart ? null : store.localSave()), [props.onStart]);
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const resume = async () => {
    setResuming(true);
    setResumeError('');
    const r = await store.loadLocal();
    if (!r.ok) {
      setResumeError(r.reason);
      setResuming(false);
    }
  };
  const start = () => {
    const r = (props.onStart ?? ((rd: WishRead, dr: StartDraft) => launch(store, rd, dr)))(read, draft);
    if (r && !r.ok) setError(r.reason ?? '');
  };

  return (
    <div
      className="ov-start"
      style={{
        display: 'grid',
        gridTemplateColumns: '270px minmax(380px, 1fr) 430px',
        gridTemplateRows: 'minmax(0, 1fr)',
        gap: size.pad,
        height: '100vh',
        minHeight: size.minHeight,
        minWidth: size.minWidth,
        boxSizing: 'border-box',
        padding: size.pad,
        background: `radial-gradient(circle at 50% 38%, #1b1a2a 0%, ${color.panel} 62%)`,
        color: color.text,
        fontFamily: font.body,
        fontSize: size.text,
      }}
    >
      <Styles />

      {/* start modes */}
      <section aria-label={START_LABELS.modes} style={{ ...panel(), overflowY: 'auto' }}>
        <Heading>{START_LABELS.modes}</Heading>
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {modes.map((m) => (
            <li key={m.id} style={{ listStyle: 'none' }}>
              <button
                type="button"
                disabled={!m.open}
                aria-pressed={m.chosen}
                title={m.mood}
                onClick={() => set({ mode: m.chosen ? null : m.id })}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: font.body,
                  fontSize: size.text,
                  padding: '7px 10px',
                  borderRadius: size.radius,
                  cursor: m.open ? 'pointer' : 'default',
                  color: m.open ? color.text : color.textDim,
                  background: m.chosen ? '#2a2618' : '#16171f',
                  border: `1px solid ${m.chosen ? color.light : color.line}`,
                  boxShadow: m.chosen ? `0 0 8px ${color.light}55` : 'none',
                  opacity: m.open ? 1 : 0.6,
                }}
              >
                {m.name}
                {!m.open && <span style={{ float: 'right', fontSize: size.small }}>{START_LABELS.locked}</span>}
                {/* the mood the mode gives (04-start-modes.md): shown on the chosen mode, and on the one under the pointer or the focus */}
                <span className="ov-mood" data-on={m.chosen} style={{ fontSize: size.small, color: color.textDim, lineHeight: 1.45, marginTop: 3 }}>
                  {m.mood}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* the box of the wish */}
      <section style={{ display: 'grid', gridAutoRows: 'max-content', alignContent: 'start', gap: size.gap, minWidth: 0, overflowY: 'auto' }}>
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 4 }} data-testid="resume">
            <Button onClick={() => void resume()}>{resuming ? SAVE_WORDS.loading : SAVE_WORDS.resume}</Button>
            <span style={{ color: color.textDim, fontSize: size.small }}>{SAVE_WORDS.resumeNote(saved.age, saved.at ? new Date(saved.at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '')}</span>
            {resumeError && <div role="alert" style={{ flexBasis: '100%', textAlign: 'center', color: color.dreadText, fontSize: size.small }}>{resumeError}</div>}
          </div>
        )}
        <div aria-hidden="true" style={{ alignSelf: 'center', width: 10, height: 10, borderRadius: '50%', background: color.light, boxShadow: `0 0 18px 6px ${color.light}66`, margin: '28px 0 6px', animation: 'flicker 2.4s ease-in-out infinite' }} />
        <label htmlFor="wish" style={{ fontFamily: font.title, fontSize: size.title, color: color.light, textAlign: 'center' }}>
          {START_LABELS.prompt}
        </label>
        <textarea
          id="wish"
          value={draft.text}
          maxLength={300}
          rows={4}
          placeholder={START_LABELS.placeholder}
          onInput={(e) => set({ text: (e.target as HTMLTextAreaElement).value })}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') start();
          }}
          style={{ fontFamily: font.body, fontSize: size.text + 1, lineHeight: 1.6, color: paper.ink, background: paper.bg, border: `1px solid ${paper.edge}`, borderRadius: size.radius, padding: size.pad, resize: 'none' }}
        />
        <div style={{ textAlign: 'right', color: color.textDim, fontSize: size.small }}>
          {draft.text.length}/300
        </div>
        <div role="group" aria-label="tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {WISH_CHIPS.map((c) => (
            <Button key={c.field} pressed={chip === c.field} onClick={() => setChip(chip === c.field ? null : c.field)}>
              {c.label}
            </Button>
          ))}
          <Button
            onClick={() => setDraft({ ...emptyDraft(Math.floor(Math.random() * 1e6)) })}
            title={START_LABELS.random}
          >
            {START_LABELS.random}
          </Button>
        </div>
        {chip && (
          <div style={{ ...panel({ padding: 8 }), display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {chipValues(data, chip, 30).map((v) => (
              <Button key={v.code} onClick={() => set({ text: `${draft.text}${draft.text && !/\s$/.test(draft.text) ? ' ' : ''}${v.name} ` })}>
                {v.name}
              </Button>
            ))}
          </div>
        )}
        <div style={panel()}>
          <Understood segments={read.segments} />
        </div>
        {handOpen && (
          <div style={panel()} aria-label={START_LABELS.pickByHand}>
            <div style={{ color: color.textDim, marginBottom: 6 }}>{START_LABELS.pickByHand}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {hand.map((f) => (
                <label key={f.key} style={{ display: 'grid', gap: 2, fontSize: size.small }}>
                  {f.name}
                  <select
                    value={draft.picks[f.key] ?? read.items.find((i) => i.key === f.key && i.row !== 'random')?.code ?? ''}
                    onChange={(e) => set({ picks: { ...draft.picks, [f.key]: (e.target as HTMLSelectElement).value } })}
                    style={{ fontFamily: font.body, fontSize: size.text, background: '#16171f', color: color.text, border: `1px solid ${color.line}`, borderRadius: size.radius, padding: 4 }}
                  >
                    <option value="">?</option>
                    {f.values.map((v) => (
                      <option key={v.code} value={v.code}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* the sheet of birth */}
      <section aria-label={START_LABELS.sheet} style={{ display: 'flex', flexDirection: 'column', gap: size.gap, minWidth: 0, minHeight: 0 }}>
        {/* the sheet scrolls by itself; the buttons below it stay in sight at 1280x720 whatever the wish holds */}
        <div className="ov-sheet-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', gridAutoRows: 'max-content', alignContent: 'start', gap: size.gap }}>
        <div style={{ background: paper.bg, color: paper.ink, border: `2px solid ${paper.edge}`, borderRadius: 4, padding: size.pad, boxShadow: `inset 0 0 22px ${paper.edge}88` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontFamily: font.title, fontSize: size.title + 2 }}>{START_LABELS.sheet}</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: size.small, color: paper.inkBrown }}>
                {START_LABELS.fate} {cert.points.used}/{cert.points.total}
              </div>
              <Beads beads={cert.points.beads} label={`${START_LABELS.fate} ${cert.points.left}`} />
            </div>
          </div>
          <p style={{ fontStyle: 'italic', margin: '6px 0 8px', lineHeight: 1.5, color: paper.inkBrown }}>{cert.story.join(' ')}</p>
          {(['sure', 'lean', 'cannot', 'random'] as const).map((row, i) => {
            const items = rowOf(row);
            if (!items.length) return null;
            return (
              <div key={row} style={{ marginTop: 6 }}>
                <div style={{ fontSize: size.small, color: paper.inkFaint, borderBottom: `1px solid ${paper.inkFaint}55` }}>{partName(i)}</div>
                <ul style={{ margin: 0, padding: 0 }}>
                  {items.map((it, k) => (
                    <SheetLine key={`${row}${it.key}${it.code}${k}`} item={it} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* the rhythm of fate: four cups */}
        <div style={panel()}>
          <div style={{ color: color.textDim, fontSize: size.small, marginBottom: 4 }}>{START_LABELS.rhythm}</div>
          <div role="radiogroup" aria-label={START_LABELS.rhythm} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {cert.rhythms.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={r.chosen}
                disabled={!r.open}
                title={r.effect}
                onClick={() => set({ rhythm: r.id })}
                style={{ fontFamily: font.body, fontSize: size.small, cursor: r.open ? 'pointer' : 'default', color: color.text, background: '#16171f', border: `1px solid ${r.chosen ? color.light : color.line}`, borderRadius: size.radius, padding: '6px 4px', opacity: r.open ? 1 : 0.5, boxShadow: r.chosen ? `0 0 8px ${color.light}55` : 'none' }}
              >
                <span aria-hidden="true" style={{ display: 'block', margin: '0 auto 4px', width: 22, height: 22, borderRadius: '2px 2px 11px 11px', background: CUP[r.id] ?? color.fate, opacity: 0.85 }} />
                {r.name.replace(/\s*\(.*\)/, '')}
              </button>
            ))}
          </div>
          <div style={{ color: color.textDim, fontSize: size.small, marginTop: 4, minHeight: 18 }}>{cert.rhythms.find((r) => r.chosen)?.effect}</div>
        </div>

        {/* the vows: three stones and the fallen one */}
        <div style={panel()}>
          <div style={{ color: color.textDim, fontSize: size.small, marginBottom: 4 }}>{START_LABELS.vow}</div>
          <div role="radiogroup" aria-label={START_LABELS.vow} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {cert.vows.map((v) => {
              const on = draft.vow === v.n;
              const none = v.id === null;
              return (
                <button
                  key={v.n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!cert.vowOpen}
                  onClick={() => set({ vow: on ? null : v.n })}
                  style={{
                    fontFamily: font.body,
                    fontSize: size.small,
                    cursor: cert.vowOpen ? 'pointer' : 'default',
                    minHeight: 64,
                    color: on ? '#1c1710' : color.text,
                    background: on ? color.light : '#1d1e27',
                    border: `1px solid ${on ? color.light : color.line}`,
                    borderRadius: none ? '2px 12px 2px 2px' : '10px 10px 2px 2px',
                    transform: none ? 'rotate(4deg)' : 'none',
                    padding: 6,
                    opacity: !cert.vowOpen ? 0.4 : draft.vow !== null && !on ? 0.55 : 1,
                    boxShadow: on ? `0 0 10px ${color.light}` : 'none',
                  }}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
          <div style={{ color: color.textDim, fontSize: size.small, marginTop: 6, minHeight: 36, lineHeight: 1.4 }}>
            {!cert.vowOpen && START_LABELS.vowClosed}
            {cert.vowOpen && chosen?.done}
            {cert.vowOpen && chosen?.reward && ` · ${START_LABELS.vowReward(chosen.reward.kept, chosen.reward.broken)}`}
          </div>
        </div>

        </div>

        <div style={{ flex: 'none', display: 'grid', gap: 6, paddingTop: 6, borderTop: `1px solid ${color.line}` }}>
        {error && <div role="alert" style={{ color: color.dreadText }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button primary onClick={start}>
            {START_LABELS.start}
          </Button>
          <Button pressed={handOpen} onClick={() => setByHand(!byHand)}>
            {START_LABELS.edit}
          </Button>
          <Button onClick={() => set({ seed: Math.floor(Math.random() * 1e6) })}>{START_LABELS.reroll}</Button>
        </div>
        </div>
      </section>
    </div>
  );
}
