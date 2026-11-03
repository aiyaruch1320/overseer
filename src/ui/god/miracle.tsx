// Miracles (20-god-ui.md §7): the bar of four lines (make, break, dragon, fate), the aim (a map slot and a list of targets), the expected result before
// the holding confirm, the omens of the big ones with their countdown and cancel, the day of the event, the ruins left behind.
import { useState } from 'preact/hooks';
import { confirmView, miracleArgs, miracleTargets, miracleView, type FateRow, type MiracleRow, type MiracleView, type OmenView, type RuinView, type TargetKind } from '../../app/views/god';
import { W } from '../../app/views/god-words';
import { color, size } from '../tokens';
import { useBridge, useView } from './bridge';
import { askGod } from './confirm';
import { MapSlot } from './map-slot';
import { Drop, Empty, Gate, Section } from './parts';
import { TargetList } from './target';
import { box, col, row, toneColor } from './style';

const LINE_TONE = ['light', 'dread', 'light', 'fate'] as const;
const LINE_COLOR = [color.light, '#d4616f', '#c8a87a', color.fate];

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

function Aim(p: { row: MiracleRow }) {
  const b = useBridge();
  const g = b.game()!;
  const data = b.data()!;
  const r = p.row;
  const kind: TargetKind = r.target;
  const targets = miracleTargets(g, data, kind);
  const [picked, setPicked] = useState<string[]>([]);
  const pick = (id: string) => setPicked(kind === 'countries' ? (picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]) : [id]);
  const chosen = targets.filter((t) => picked.includes(t.id));
  const ready = kind === 'none' || chosen.length > 0;
  const args = miracleArgs(r.id, kind, chosen);
  const v = ready ? confirmView(g, data, 'miracle', args) : null;
  const tone = LINE_TONE[r.line];
  const here = chosen.some((t) => t.here);
  return (
    <div style={{ ...col, marginTop: size.pad }}>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <b style={{ color: LINE_COLOR[r.line] }}>
          {W.miracle.aim}: {r.name}
        </b>
        <span class="g-small g-dim">{r.effect}</span>
      </div>
      {kind !== 'none' && (
        <>
          <MapSlot kind={kind} targets={targets} picked={picked} onPick={pick} tone={tone} omens={[]} ruins={[]} />
          <TargetList targets={targets} picked={picked} multi={kind === 'countries'} onPick={pick} label={W.miracle.pickTarget} />
        </>
      )}
      {here && (
        <div role="note" style={{ color: '#d4916f' }} class="g-small">
          ⚠ {W.miracle.here}
        </div>
      )}
      {v && (
        <div style={{ ...box, borderColor: v.ok ? toneColor[v.tone] : '#6a2a33', ...col, gap: 3 }} aria-live="polite">
          {v.ok ? v.lines.map((l, i) => <div key={i} class={i ? 'g-small g-dim' : ''}>{l}</div>) : <div style={{ color: '#d4616f' }}>⌛ {v.reason}</div>}
        </div>
      )}
      <div style={{ ...row, justifyContent: 'flex-end' }}>
        <Gate ok={!!v?.ok} reason={!ready ? W.miracle.pickTarget : v?.reason} tone={tone} onClick={() => askGod('miracle', args, () => setPicked([]))}>
          {W.confirm} · {v?.hold === 3 ? W.miracle.holdBig : W.miracle.holdMid}
        </Gate>
      </div>
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
          <button class="g-btn fate" onClick={() => askGod(o.of, { cancel: o.n })}>
            {W.miracle.cancelOmen} · {W.miracle.refundHalf}
          </button>
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
            <s style={{ color: '#d4616f' }}>{r.name.replace(/^ซาก/, '')}</s> <b style={{ color: '#9a9486' }}>{r.name}</b>
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

function FateItem(p: { f: FateRow }) {
  const [mul, setMul] = useState(0.5);
  const f = p.f;
  return (
    <div style={{ ...box, ...col, gap: 4 }}>
      <b>
        {f.mark} {f.name}
      </b>
      <label style={row}>
        <span class="g-small">
          {W.miracle.mul} ×{mul.toFixed(1)} ({mul < 1 ? W.miracle.slow : W.miracle.fast})
        </span>
        <input type="range" min="0.2" max="3" step="0.1" value={mul} aria-label={W.miracle.mul} onInput={(e) => setMul(Number((e.target as HTMLInputElement).value))} style={{ flex: 1 }} />
        <button class="g-btn fate" disabled={Math.abs(mul - 1) < 0.05} onClick={() => askGod('decree', { event: f.id, mul: Math.round(mul * 10) / 10 })}>
          {W.miracle.decree}
        </button>
      </label>
      <div class="g-small g-dim">
        {W.miracle.slow} ×0.5: <Drop line="faith" n={f.slow.faith} /> · {W.miracle.fast} ×2: <Drop line="dread" n={f.fast.dread} />
      </div>
    </div>
  );
}

const TABS = ['aim', 'omens', 'ruins', 'fate', 'day'] as const;
type Tab = (typeof TABS)[number];
const TAB_WORD: Record<Tab, string> = { aim: W.miracle.aim, omens: W.miracle.omens, ruins: W.miracle.ruins, fate: W.miracle.fateTitle, day: W.miracle.day };

export function Miracle(p: { id?: string; tab?: string }) {
  const v = useView((g, d) => miracleView(g, d));
  const [tab, setTab] = useState<Tab>((TABS as readonly string[]).includes(p.tab ?? '') ? (p.tab as Tab) : 'aim');
  const [sel, setSel] = useState<string | null>(p.id ?? null);
  if (!v) return <Empty>{W.noGame}</Empty>;
  if (!v.alive) return <Empty>{W.noLife}</Empty>;
  const row_ = v.rows.find((r) => r.id === sel) ?? null;
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
          {row_ && row_.open ? <Aim key={row_.id} row={row_} /> : row_ ? <Empty>{row_.name}: {W.miracle.notOpen}</Empty> : null}
        </>
      )}
      {tab === 'omens' && <Omens omens={v.omens} />}
      {tab === 'ruins' && <Ruins ruins={v.ruins} />}
      {tab === 'fate' && (
        <Section title={W.miracle.fateTitle} tone="fate">
          {v.fate.length ? <div style={col}>{v.fate.map((f) => <FateItem key={f.id} f={f} />)}</div> : <Empty>{W.miracle.fateNone}</Empty>}
        </Section>
      )}
      {tab === 'day' && (
        <div style={col}>
          <div style={{ ...box, ...col, gap: 4 }}>
            <b>{v.day ? v.day.name : W.none}</b>
            {v.day?.lines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          <div class="g-dim" role="note" style={{ ...box, borderStyle: 'dashed', textAlign: 'center', minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {W.miracle.dayScene}
          </div>
        </div>
      )}
    </div>
  );
}
