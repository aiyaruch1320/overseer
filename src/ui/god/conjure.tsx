// Conjuring at will (20-god-ui.md §9): three rings (verb, core, size) turned until the wanted cell lies under the silver line, shut cells as
// silhouettes without a name; on the side the expected result, the price with its multipliers, the chance of the shadow, the omen and the quota
// (three fingerprints). A mix that is a listed miracle says so and costs no fingerprint.
import { useState } from 'preact/hooks';
import { conjureArgs, conjurePreview, conjureTargets, conjureView, type ConjureView } from '../../app/views/god';
import { W } from '../../app/views/god-words';
import { color, size } from '../tokens';
import { useBridge, useView } from './bridge';
import { askGod } from './confirm';
import { MapSlot } from './map-slot';
import { Drop, Empty, Gate } from './parts';
import { Wheel } from './wheel';
import { TargetList } from './target';
import { box, col, row } from './style';

function Marks(p: { used: number; limit: number }) {
  return (
    <span aria-label={`${W.conjure.marks} ${p.used}/${p.limit}`}>
      {Array.from({ length: p.limit }, (_, i) => (
        <span key={i} style={{ color: i < p.used ? '#5a5650' : color.light, marginRight: 3 }}>
          ☝
        </span>
      ))}
    </span>
  );
}

function Circle(p: { v: ConjureView }) {
  const b = useBridge();
  const g = b.game()!;
  const data = b.data()!;
  const [verb, setVerb] = useState<string | null>(null);
  const [core, setCore] = useState<string | null>(null);
  const [scale, setScale] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const sc = p.v.scales.find((s) => s.id === scale);
  const targets = scale ? conjureTargets(g, data, scale) : [];
  const complete = !!(verb && core && scale);
  const args = complete ? conjureArgs(verb!, core!, scale!, target ?? undefined) : null;
  const pr = args ? conjurePreview(g, data, args) : null;
  const needsTarget = !!sc && pr && !pr.ok && /ต้อง|เป้า/.test(pr.reason ?? '') && !target;
  const tone = pr?.cost.dread && !pr.cost.faith ? 'dread' : 'light';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: size.pad }}>
      <div style={col}>
        <Wheel verbs={p.v.verbs} cores={p.v.cores} scales={p.v.scales} verb={verb} core={core} scale={scale} onVerb={setVerb} onCore={setCore} onScale={(id) => (setScale(id), setTarget(null))} />
        <div class="g-small g-dim" style={{ textAlign: 'center' }} aria-live="polite">
          {[p.v.verbs.find((c) => c.id === verb)?.name, p.v.cores.find((c) => c.id === core)?.name, sc ? `${sc.name} (${sc.base})` : undefined].filter(Boolean).join(' · ') || W.conjure.pickAll}
        </div>
      </div>
      {scale && (
        <div style={col}>
          <div class="g-small g-dim">{W.conjure.target}</div>
          <MapSlot kind={sc!.target === 'npc' ? 'npc' : sc!.target === 'continent' ? 'continent' : 'country'} targets={targets} picked={target ? [target] : []} onPick={setTarget} tone={tone} omens={[]} ruins={[]} />
          <TargetList targets={targets} picked={target ? [target] : []} onPick={setTarget} label={W.conjure.pickTarget} />
        </div>
      )}
      <div style={{ ...box, ...col, alignContent: 'start' }} aria-live="polite">
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <b>{W.conjure.quota}</b>
          <Marks used={p.v.quota.used} limit={p.v.quota.limit} />
        </div>
        {!complete ? (
          <div class="g-dim">{W.conjure.pickAll}</div>
        ) : !pr || !pr.ok ? (
          <div style={{ color: '#d4616f' }}>⌛ {pr?.reason}</div>
        ) : (
          <>
            {pr.listed && (
              <div class="g-small" style={{ color: color.fate }}>
                ✦ {W.conjure.known} ({pr.listed})
              </div>
            )}
            <div class="g-title">{pr.name || pr.listed}</div>
            <div>{pr.result}</div>
            {pr.expected && (
              <div>
                {W.conjure.expected}: {pr.expected}
              </div>
            )}
            {pr.effects.map((e, i) => (
              <div key={i} class="g-small">
                – {e}
              </div>
            ))}
            {pr.reaction && (
              <div class="g-small" style={{ color: '#c8a87a' }}>
                {W.conjure.here}: {pr.reaction.say} ({pr.reaction.text})
              </div>
            )}
            <div>
              {W.conjure.price}: {pr.cost.faith > 0 && <Drop line="faith" n={pr.cost.faith} />} {pr.cost.dread > 0 && <Drop line="dread" n={pr.cost.dread} />}
              {pr.priceNote && <div class="g-small g-dim">{pr.priceNote}</div>}
            </div>
            <div class="g-small g-dim">{pr.shadow}</div>
            {pr.omen && <div class="g-small g-dim">{W.conjure.omen}: {pr.omen}</div>}
            {pr.seal && <div class="g-small" style={{ color: '#c8a87a' }}>{W.conjure.seal}: {pr.seal}</div>}
          </>
        )}
        <div style={{ ...row, justifyContent: 'flex-end' }}>
          <Gate ok={!!pr?.ok} reason={!complete ? W.conjure.pickAll : needsTarget ? W.conjure.pickTarget : pr?.reason} tone={tone} onClick={() => args && askGod('conjure', args)}>
            ✦ {W.conjure.cast}
          </Gate>
        </div>
      </div>
    </div>
  );
}

export function Conjure() {
  const v = useView((g) => conjureView(g));
  if (!v) return <Empty>{W.noGame}</Empty>;
  if (!v.alive) return <Empty>{W.noLife}</Empty>;
  return (
    <div style={col}>
      <Circle v={v} />
      {v.omens.length > 0 && (
        <div style={col}>
          <b>{W.conjure.omens}</b>
          {v.omens.map((o) => (
            <div key={o.n} style={{ ...row, justifyContent: 'space-between' }}>
              <span>
                {o.name} <span class="g-small g-dim">· {W.miracle.omenLeft} {o.left}/{o.total} {W.seasons}</span>
              </span>
              <button class="g-btn fate" onClick={() => askGod('conjure', { cancel: o.n })}>
                {W.miracle.cancelOmen}
              </button>
            </div>
          ))}
        </div>
      )}
      <div class="g-small g-dim">
        {W.conjure.chronicle}: {v.points} {W.conjure.open}: {v.verbs.filter((x) => x.open).length}/{v.verbs.length} · {v.cores.filter((x) => x.open).length}/{v.cores.length}
      </div>
    </div>
  );
}
