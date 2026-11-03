// The bestowal chest (20-god-ui.md §3): a black velvet cloth, six cards in three pairs (blessings, curses, skills and things), the frame of each
// by its tier, the price in a drop, reroll with a lock, skip. Choosing, rerolling and opening all go through the confirm dialog.
import { useEffect, useState } from 'preact/hooks';
import { chestView, rerollInfo, type ChestCard, type ChestView } from '../../app/views/god';
import { W } from '../../app/views/god-words';
import { color, size } from '../tokens';
import { useBridge, useView } from './bridge';
import { askGod } from './confirm';
import { Drop, Empty, Gate } from './parts';
import { col, frameOf, row, toneColor } from './style';

const edgeOf = (kind: string): string => (kind === 'curse' ? color.dread : kind === 'bless' ? color.light : color.fate);

function Card(p: { c: ChestCard; locked: boolean; onHover: (c: ChestCard | null) => void; onLock: () => void; locks: boolean }) {
  const c = p.c;
  const frame = frameOf(c.tier);
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => p.onHover(c)} onMouseLeave={() => p.onHover(null)} onFocusCapture={() => p.onHover(c)}>
      <button
        class={`g-card ${c.afford ? '' : 'poor'}`}
        aria-label={`${c.kindWord} ${c.name} ${c.tierWord} ${c.pay === 'faith' ? W.light : W.dread} ${c.price}`}
        style={{ width: 210, minHeight: 190, borderColor: frame, borderTop: `4px solid ${edgeOf(c.kind)}`, display: 'flex', flexDirection: 'column', gap: 6 }}
        onClick={() => askGod('chest.pick', { slot: c.slot })}
      >
        <div style={{ fontSize: 30, color: edgeOf(c.kind), textAlign: 'center' }} aria-hidden="true">
          {c.glyph}
        </div>
        <div style={{ textAlign: 'center' }}>
          <b>{c.name}</b>
          <div class="g-small" style={{ color: frame }}>
            {c.kindWord} · {c.tierWord}
          </div>
        </div>
        <div class="g-small g-dim" style={{ flex: 1 }}>
          {c.effect}
        </div>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <span class="g-small" style={{ color: c.belief >= 0 ? color.light : '#7a9ac8' }}>
            {c.belief >= 0 ? '▲' : '▼'} {c.belief > 0 ? '+' : ''}
            {c.belief}
          </span>
          <Drop line={c.pay} n={c.price} />
        </div>
      </button>
      {p.locks && (
        <button class="g-btn g-small" style={{ position: 'absolute', top: 6, right: 6, padding: '1px 8px', borderColor: p.locked ? '#a03a3a' : color.line, color: p.locked ? color.dreadText : color.textDim }} aria-pressed={p.locked} aria-label={p.locked ? W.chest.unlock : W.chest.lock} onClick={p.onLock}>
          {p.locked ? `⛓ ${W.chest.locked}` : `⛓ ${W.chest.lock}`}
        </button>
      )}
    </div>
  );
}

function Cloth(p: { v: ChestView }) {
  const b = useBridge();
  const [hover, setHover] = useState<ChestCard | null>(null);
  const [lock, setLock] = useState<number | null>(p.v.lockedSlot);
  useEffect(() => setLock(p.v.lockedSlot), [p.v.lockedSlot, p.v.rerolls]);
  const g = b.game()!;
  const data = b.data()!;
  const rr = rerollInfo(g, data, lock ?? undefined);
  const heads = W.chest.cols;
  return (
    <div style={{ ...col, gap: 12 }}>
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', background: '#0a0a0f', padding: 16, borderRadius: size.radius, border: `1px solid ${color.line}` }}>
        {p.v.columns.map((pair, i) => (
          <div key={i} style={{ ...col, gap: 10, alignItems: 'center' }}>
            <div class="g-small g-dim">{heads[i]}</div>
            {pair.map((c, j) =>
              c ? (
                <Card key={c.slot} c={c} locked={lock === c.slot} locks={p.v.rerolls < p.v.rerollMax} onHover={setHover} onLock={() => setLock(lock === c.slot ? null : c.slot)} />
              ) : (
                <div key={`e${j}`} aria-label={W.chest.empty} style={{ width: 210, minHeight: 190, border: `1px dashed ${color.line}`, borderRadius: 8 }} />
              ),
            )}
          </div>
        ))}
      </div>
      <div class="g-small" style={{ minHeight: 22, textAlign: 'center' }} aria-live="polite">
        {hover ? (
          <>
            {hover.why.length > 0 && (
              <span>
                {W.chest.why}: {hover.why.join(' · ')} ·{' '}
              </span>
            )}
            <span style={{ color: hover.belief >= 0 ? color.light : '#7a9ac8' }}>
              {W.chest.belief} {hover.belief > 0 ? '+' : ''}
              {hover.belief}
            </span>
            {!hover.afford && <span style={{ color: color.dreadText }}> · {W.chest.cantAfford}</span>}
          </>
        ) : (
          <span class="g-dim">{W.chest.noteFree}</span>
        )}
      </div>
      <div style={{ ...row, justifyContent: 'flex-end' }}>
        <span class="g-small g-dim">
          {W.chest.rerolls} {p.v.rerolls}/{p.v.rerollMax}
        </span>
        <Gate ok={rr.ok} reason={rr.reason} tone="light" onClick={() => askGod('chest.reroll', lock ? { lock } : {})}>
          ⚄ {W.chest.reroll} {rr.ok && <Drop line="faith" n={rr.price} />}
          {lock ? ` · ${W.chest.lock} ${lock}` : ''}
        </Gate>
        <button class="g-btn" onClick={() => askGod('chest.skip', {})}>
          {W.chest.skip}
        </button>
      </div>
    </div>
  );
}

export function Chest() {
  const v = useView((g, d) => chestView(g, d));
  if (!v) return <Empty>{W.noGame}</Empty>;
  if (!v.alive) return <Empty>{W.noLife}</Empty>;
  if (v.isOpen) return <Cloth v={v} />;
  return (
    <div style={{ ...col, alignItems: 'center', padding: 24, gap: 12 }}>
      <div aria-hidden="true" style={{ width: 160, height: 100, background: 'linear-gradient(#2a2118, #17120d)', border: `2px solid ${color.light}`, borderRadius: '10px 10px 4px 4px', boxShadow: `0 0 24px ${color.light}33` }} />
      <div>
        {W.chest.left}:{' '}
        <b style={{ color: toneColor.light }}>
          {v.left}/{v.limit}
        </b>
        {v.window && <span class="g-small" style={{ color: color.light }}> · {W.window}</span>}
      </div>
      <Gate ok={v.canOpen.ok} reason={v.canOpen.reason} tone="light" onClick={() => askGod('chest.open', {})}>
        {W.chest.open}
      </Gate>
      <div class="g-small g-dim">{W.chest.noteFree}</div>
    </div>
  );
}
