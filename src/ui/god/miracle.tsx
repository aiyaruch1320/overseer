// Miracles (20-god-ui.md §7): the bar of four lines (make, break, dragon, fate), the aim (a map slot and a list of targets), the expected result before
// the holding confirm, the omens of the big ones with their countdown and cancel, the day of the event, the ruins left behind.
import { useEffect, useRef, useState } from 'preact/hooks';
import { FATE_STEPS, confirmView, fateCostOf, miracleArgs, miracleTargets, miracleView, type FateRow, type MiracleRow, type MiracleView, type OmenView, type RuinView, type TargetKind } from '../../app/views/god';
import { W } from '../../app/views/god-words';
import { color, size } from '../tokens';
import { useBridge, useView } from './bridge';
import { HoldButton, askGod, pendingAct, runGod } from './confirm';
import { godFull } from './layout';
import { MapSlot } from './map-slot';
import { Drop, Empty, Gate, Section } from './parts';
import { DayScene } from './day-scene';
import { TargetList } from './target';
import { box, col, row, toneColor } from './style';

const LINE_TONE = ['light', 'dread', 'light', 'fate'] as const;
const LINE_COLOR = [color.light, color.dreadText, '#c8a87a', color.fate];

function Bar(p: { v: MiracleView; sel: string | null; onPick: (r: MiracleRow) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: size.gap }}>
      {W.miracle.lines.map((name, li) => {
        const rows = p.v.rows.filter((r) => r.line === li);
        if (!rows.length) return null;
        return (
          <div key={li} role="group" aria-label={name} style={{ ...box, borderColor: LINE_COLOR[li] + '77' }}>
            <div style={{ color: LINE_COLOR[li], fontWeight: 600, marginBottom: 6 }}>{name}</div>
            <div style={{ ...col, gap: 4 }}>
              {rows.map((r) => (
                <button key={r.id} class="g-chip" aria-pressed={p.sel === r.id} aria-label={`${r.name} ${r.costWord}`} onClick={() => p.onPick(r)} style={{ borderRadius: 8, textAlign: 'left', opacity: r.open ? 1 : 0.5, borderColor: p.sel === r.id ? LINE_COLOR[li] : undefined, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span>
                    {r.name}
                    <span class="g-small g-dim"> · {r.tier}</span>
                  </span>
                  <span class="g-small" style={{ color: r.afford ? undefined : color.textDim }}>
                    {r.open ? (r.waitYears > 0 ? `⌛ ${r.waitYears}` : r.costWord) : W.miracle.notOpen}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The aim of a miracle with nothing to point at (the world as a whole): the expected result and the confirm, in the flow of the panel. */
function AimFlat(p: { row: MiracleRow }) {
  const b = useBridge();
  const g = b.game()!;
  const data = b.data()!;
  const r = p.row;
  const v = confirmView(g, data, 'miracle', miracleArgs(r.id, 'none'));
  const tone = LINE_TONE[r.line];
  return (
    <div style={{ ...col, marginTop: size.pad }}>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <b style={{ color: LINE_COLOR[r.line] }}>
          {W.miracle.aim}: {r.name}
        </b>
        <span class="g-small g-dim">{r.effect}</span>
      </div>
      <PreviewBox v={v} />
      <div style={{ ...row, justifyContent: 'flex-end' }}>
        <Gate ok={v.ok} reason={v.reason} tone={tone} onClick={() => askGod('miracle', miracleArgs(r.id, 'none'))}>
          {W.confirm} · {v.hold === 3 ? W.miracle.holdBig : W.miracle.holdMid}
        </Gate>
      </div>
    </div>
  );
}

function PreviewBox(p: { v: ReturnType<typeof confirmView> | null }) {
  const v = p.v;
  if (!v) return null;
  return (
    <div style={{ ...box, borderColor: v.ok ? toneColor[v.tone] : '#6a2a33', ...col, gap: 3, overflow: 'auto', minHeight: 0 }} aria-live="polite">
      {v.ok ? v.lines.map((l, i) => <div key={i} class={i ? 'g-small g-dim' : ''}>{l}</div>) : <div style={{ color: color.dreadText }}>⌛ {v.reason}</div>}
    </div>
  );
}

/** The miracles of the four lines as a strip over the map (20-god-ui.md §7.1: the bar unrolls at the bottom), to change the miracle while aiming. */
function Strip(p: { v: MiracleView; sel: string | null; onPick: (r: MiracleRow) => void }) {
  return (
    <div role="toolbar" aria-label={W.miracle.title} style={{ position: 'absolute', left: 8, right: 8, bottom: 8, zIndex: 6, display: 'flex', gap: 12, padding: '6px 8px', overflowX: 'auto', background: 'rgba(14,15,20,0.88)', border: `1px solid ${color.line}`, borderRadius: size.radius }}>
      {W.miracle.lines.map((name, li) => {
        const rows = p.v.rows.filter((r) => r.line === li && r.open);
        if (!rows.length) return null;
        return (
          <div key={li} role="group" aria-label={name} style={{ ...row, gap: 4, flexShrink: 0 }}>
            <span class="g-small" style={{ color: LINE_COLOR[li], fontWeight: 600 }}>{name}</span>
            {rows.map((r) => (
              <button key={r.id} class="g-chip g-small" aria-pressed={p.sel === r.id} title={`${r.name} ${r.costWord}`} onClick={() => p.onPick(r)} style={{ padding: '3px 9px', whiteSpace: 'nowrap', opacity: r.afford && !r.waitYears ? 1 : 0.55, borderColor: p.sel === r.id ? LINE_COLOR[li] : undefined }}>
                {r.name}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Aiming a miracle at a place or a person (20-god-ui.md §7.1): the world map takes the whole room, the miracles are a strip over its foot, and the side
 * holds the targets, the expected result and the hold that confirms, so nothing needs a scroll at 1280×720. The wheel over the map zooms only the map.
 */
function AimScreen(p: { v: MiracleView; row: MiracleRow; onPick: (r: MiracleRow) => void; onBack: () => void }) {
  const b = useBridge();
  const g = b.game()!;
  const data = b.data()!;
  const r = p.row;
  const kind: TargetKind = r.target;
  const mapped = kind === 'country' || kind === 'countries' || kind === 'continent';
  const targets = miracleTargets(g, data, kind);
  const [picked, setPicked] = useState<string[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const pick = (id: string) => setPicked(kind === 'countries' ? (picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]) : [id]);
  const chosen = targets.filter((t) => picked.includes(t.id));
  const ready = chosen.length > 0;
  const args = miracleArgs(r.id, kind, chosen);
  const v = ready ? confirmView(g, data, 'miracle', args) : null;
  const tone = LINE_TONE[r.line];
  const here = chosen.some((t) => t.here);
  const [error, setError] = useState('');
  useEffect(() => {
    // the wheel belongs to the map here: the page and the panel never scroll under it
    const el = wrap.current;
    const stop = (e: WheelEvent) => e.preventDefault();
    el?.addEventListener('wheel', stop, { passive: false });
    const key = (e: KeyboardEvent) => e.key === 'Escape' && !pendingAct.value && (e.stopPropagation(), p.onBack());
    window.addEventListener('keydown', key, true);
    return () => {
      el?.removeEventListener('wheel', stop);
      window.removeEventListener('keydown', key, true);
    };
  }, [p.onBack]);
  const fire = () => {
    if (!v?.ok) return;
    const res = runGod(b, 'miracle', args, v.title);
    if (!res.ok) setError(res.reason);
    else p.onBack();
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', height: '100%', minHeight: 0 }}>
      <div ref={wrap} style={{ position: 'relative', minHeight: 0, minWidth: 0 }}>
        {mapped ? (
          <MapSlot kind={kind} targets={targets} picked={picked} onPick={pick} tone={tone} omens={[]} ruins={[]} fill />
        ) : (
          <div style={{ ...col, height: '100%', padding: `${size.pad}px ${size.pad}px 56px` }}>
            <TargetList targets={targets} picked={picked} onPick={pick} label={W.miracle.pickTarget} fill />
          </div>
        )}
        <Strip v={p.v} sel={r.id} onPick={p.onPick} />
      </div>
      <aside style={{ ...col, gap: 8, padding: size.pad, borderLeft: `1px solid ${color.line}`, minHeight: 0, background: color.panel }}>
        <div style={{ ...row, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <b style={{ color: LINE_COLOR[r.line], fontSize: 16 }}>{r.name}</b>
            <div class="g-small g-dim">{r.effect}</div>
          </div>
          <button class="g-btn g-small" onClick={p.onBack} aria-label={W.back}>
            {W.back}
          </button>
        </div>
        {mapped && (
          <div style={{ flex: '1 1 120px', minHeight: 90, ...col }}>
            <TargetList targets={targets} picked={picked} multi={kind === 'countries'} onPick={pick} label={W.miracle.pickTarget} fill />
          </div>
        )}
        {here && (
          <div role="note" style={{ color: '#d4916f' }} class="g-small">
            ⚠ {W.miracle.here}
          </div>
        )}
        <div style={{ flex: mapped ? '0 1 auto' : '1 1 auto', maxHeight: mapped ? '38%' : undefined, ...col, minHeight: 0 }}>
          {v ? <PreviewBox v={v} /> : <div class="g-dim g-small">{W.miracle.pickTarget}</div>}
        </div>
        {error && (
          <div role="alert" style={{ color: color.dreadText }} class="g-small">
            {error}
          </div>
        )}
        <div style={{ ...col, gap: 2, flexShrink: 0 }}>
          <HoldButton seconds={v?.hold || 1.5} label={W.confirm} tone={tone} onDone={fire} disabled={!v?.ok} />
          {!v?.ok && <span class="g-small g-dim">⌛ {!ready ? W.miracle.pickTarget : v?.reason}</span>}
        </div>
      </aside>
    </div>
  );
}

function Ring(p: { fraction: number; color: string; label: string }) {
  const c = 2 * Math.PI * 16;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" role="img" aria-label={p.label}>
      <circle cx="22" cy="22" r="16" fill="none" stroke={color.line} strokeWidth="4" />
      <circle cx="22" cy="22" r="16" fill="none" stroke={p.color} strokeWidth="4" strokeDasharray={c} strokeDashoffset={c * (1 - p.fraction)} transform="rotate(-90 22 22)" strokeLinecap="round" />
    </svg>
  );
}

function Omens(p: { omens: OmenView[] }) {
  if (!p.omens.length) return <Empty>{W.none}</Empty>;
  return (
    <div style={col}>
      {p.omens.map((o) => (
        <div key={`${o.of}${o.n}`} style={{ ...box, ...row, justifyContent: 'space-between' }}>
          <span style={row}>
            <Ring fraction={o.fraction} color={color.fate} label={`${W.miracle.omenLeft} ${o.left} ${W.seasons}`} />
            <span>
              <b>{o.name}</b>
              <div class="g-small g-dim">
                {o.where && `${o.where} · `}
                {W.miracle.omenLeft} {o.left}/{o.total} {W.seasons}
              </div>
            </span>
          </span>
          <span style={{ ...col, gap: 2, alignItems: 'flex-end' }}>
            <button class="g-btn fate" onClick={() => askGod(o.of, { cancel: o.n })}>
              {W.miracle.cancelOmen} · {W.miracle.refundHalf}
            </button>
            <span class="g-small g-dim">{W.miracle.refundNote}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Ruins(p: { ruins: RuinView[] }) {
  if (!p.ruins.length) return <Empty>{W.miracle.ruinNone}</Empty>;
  return (
    <div style={col}>
      {p.ruins.map((r) => (
        <article key={r.country} style={{ ...box, ...col, gap: 4, opacity: r.ended ? 0.7 : 1 }}>
          <div>
            <s style={{ color: color.dreadText }}>{r.name.replace(/^ซาก/, '')}</s> <b style={{ color: '#9a9486' }}>{r.name}</b>
            <span class="g-small g-dim"> · {r.kind} · {r.year}</span>
          </div>
          <div class="g-small g-dim">
            {W.miracle.ruinLeft} {r.popPct}%{r.lake ? ` · ${W.miracle.lake}` : ''}
            {r.cult && ` · ${W.miracle.ruinCult} ${r.cult}`}
            {r.city && ` · ${W.miracle.ruinCity} ${r.city}`}
            {r.took.length > 0 && ` · ${W.miracle.ruinRefuge} ${r.took.join(' ')}`}
          </div>
          {r.events.length > 0 && (
            <div class="g-small" style={{ borderLeft: '2px solid #5a4a30', paddingLeft: 8 }}>
              {W.miracle.ruinEvents}:{' '}
              {r.events.map((e) => (
                <span key={e.id} class="g-chip" style={{ marginRight: 4, color: e.done ? color.text : color.textDim, borderStyle: e.done ? 'solid' : 'dashed' }}>
                  {e.name}
                </span>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

/** One step of the multiplier: a silver chip; the steps beyond what the event can take are shut. */
function FateStep(p: { mul: number; on: boolean; shut: boolean; onPick: () => void }) {
  return (
    <button class="g-chip g-small" aria-pressed={p.on} disabled={p.shut} aria-label={`${W.miracle.mul} ×${p.mul}`} onClick={p.onPick} style={{ padding: '2px 8px', borderColor: p.on ? color.fate : undefined, color: p.on ? color.fate : p.mul < 1 ? undefined : '#d4916f', opacity: p.shut ? 0.35 : 1 }}>
      ×{p.mul}
    </button>
  );
}

function FateItem(p: { f: FateRow }) {
  const b = useBridge();
  const g = b.game()!;
  const [mul, setMul] = useState<number>(0.5);
  const f = p.f;
  const cost = fateCostOf(g, f.mark, mul);
  return (
    <li style={{ ...box, ...row, alignItems: 'center', gap: 12, padding: '8px 10px', listStyle: 'none' }}>
      <span aria-hidden="true" style={{ color: color.fate, width: 16, textAlign: 'center' }}>{f.mark}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b>{f.name}</b>
        {f.about && (
          <div class="g-small g-dim" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.about}>
            {f.about}
          </div>
        )}
      </span>
      <span role="group" aria-label={W.miracle.mul} style={{ ...row, gap: 4, flexShrink: 0 }}>
        {FATE_STEPS.map((m) => (
          <FateStep key={m} mul={m} on={m === mul} shut={m < f.range[0] - 1e-9 || m > f.range[1] + 1e-9} onPick={() => setMul(m)} />
        ))}
      </span>
      <span class="g-small" style={{ minWidth: 92, textAlign: 'right', flexShrink: 0 }}>
        {mul < 1 ? W.miracle.slow : W.miracle.fast}: {cost.faith > 0 ? <Drop line="faith" n={cost.faith} /> : <Drop line="dread" n={cost.dread} />}
      </span>
      <button class="g-btn fate" onClick={() => askGod('decree', { event: f.id, mul })}>
        {W.miracle.decree}
      </button>
    </li>
  );
}

/** The fate screen (MR-25): the events that show an omen as a compact list, with a filter, in a frame that scrolls inside itself. */
function Fate(p: { rows: FateRow[] }) {
  const [q, setQ] = useState('');
  if (!p.rows.length) return <Empty>{W.miracle.fateNone}</Empty>;
  const shown = p.rows.filter((f) => !q || f.name.includes(q) || f.about.includes(q));
  return (
    <Section title={W.miracle.fateTitle} tone="fate">
      <div style={col}>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <input type="search" aria-label={W.miracle.fateFind} placeholder={`${W.miracle.fateFind}…`} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} style={{ background: '#1a1b24', color: color.text, border: `1px solid ${color.line}`, borderRadius: 4, padding: '6px 8px', minWidth: 220 }} />
          <span class="g-small g-dim">{shown.length}/{p.rows.length}</span>
        </div>
        <ul class="g-scroll" style={{ ...col, gap: 6, margin: 0, padding: 0, maxHeight: 'min(54vh, 430px)', overflow: 'auto' }}>
          {shown.map((f) => <FateItem key={f.id} f={f} />)}
          {!shown.length && <Empty>{W.none}</Empty>}
        </ul>
      </div>
    </Section>
  );
}

const TABS = ['aim', 'omens', 'ruins', 'fate', 'day'] as const;
type Tab = (typeof TABS)[number];
const TAB_WORD: Record<Tab, string> = { aim: W.miracle.aim, omens: W.miracle.omens, ruins: W.miracle.ruins, fate: W.miracle.fateTitle, day: W.miracle.day };

export function Miracle(p: { id?: string; tab?: string }) {
  const v = useView((g, d) => miracleView(g, d));
  const [tab, setTab] = useState<Tab>((TABS as readonly string[]).includes(p.tab ?? '') ? (p.tab as Tab) : 'aim');
  const [sel, setSel] = useState<string | null>(p.id ?? null);
  const bridge = useBridge();
  const dayData = bridge.data();
  const dayState = bridge.game()?.state ?? null;
  const row_ = v?.rows.find((r) => r.id === sel) ?? null;
  // a miracle with something to point at takes the whole screen for the aim (20-god-ui.md §7.1)
  const aiming = !!v && v.alive && tab === 'aim' && !!row_ && row_.open && row_.target !== 'none';
  useEffect(() => {
    godFull.value = aiming;
    return () => {
      godFull.value = false;
    };
  }, [aiming]);
  if (!v) return <Empty>{W.noGame}</Empty>;
  if (!v.alive) return <Empty>{W.noLife}</Empty>;
  if (aiming) return <AimScreen key={row_!.id} v={v} row={row_!} onPick={(r) => setSel(r.id)} onBack={() => setSel(null)} />;
  return (
    <div>
      <div role="tablist" style={{ ...row, borderBottom: `1px solid ${color.line}`, marginBottom: size.pad }}>
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} class="g-chip" aria-pressed={tab === t} onClick={() => setTab(t)} style={{ borderRadius: '8px 8px 0 0' }}>
            {TAB_WORD[t]}
            {t === 'omens' && v.omens.length > 0 ? ` (${v.omens.length})` : ''}
          </button>
        ))}
      </div>
      {tab === 'aim' && (
        <>
          <Bar v={v} sel={sel} onPick={(r) => setSel(r.id)} />
          {row_ && row_.open ? <AimFlat key={row_.id} row={row_} /> : row_ ? <Empty>{row_.name}: {W.miracle.notOpen}</Empty> : null}
        </>
      )}
      {tab === 'omens' && <Omens omens={v.omens} />}
      {tab === 'ruins' && <Ruins ruins={v.ruins} />}
      {tab === 'fate' && <Fate rows={v.fate} />}
      {tab === 'day' && (
        <div style={col}>
          <div style={{ ...box, ...col, gap: 4 }}>
            <b>{v.day ? v.day.name : W.none}</b>
            {v.day?.lines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          {v.day && dayData && dayState ? (
            <DayScene key={v.day.n} n={v.day.n} data={dayData} state={dayState} />
          ) : (
            <div class="g-dim" role="note" style={{ ...box, borderStyle: 'dashed', textAlign: 'center', minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {W.miracle.dayScene}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
