// The parts of the character screen and its card: bars, pips, gift cards, item frames. Presentational: they get a model from
// src/app/views/character.ts and know neither the store nor the core. Colours, sizes and fonts come from tokens.ts only; the frames of rarity are the
// ones of the weapons (20-god-ui.md §1, items README), the same as the chest.
import type { ComponentChildren, JSX } from 'preact';
import type { AptView, AxisBar, CarriedView, CompanionView, GiftView, ItemView, SkillView, SlotView, StatBar, Tier, TraitView } from '../../app/views/character';
import { CHAR_WORDS as W } from '../../app/views/character-words';
import { color, font, rarity, size } from '../tokens';

type CSS = JSX.CSSProperties;

/** A colour at a share of its strength over what is under it. */
export const tint = (c: string, pct: number): string => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

export const box: CSS = { background: '#13141b', border: `1px solid ${color.line}`, borderRadius: size.radius, padding: size.pad };

/** The glow of the rarity of a thing: none for C and U, faint for R, steady for E, and bright for L (items README "กรอบ"). */
const GLOW: Record<Tier, string> = { C: 'none', U: 'none', R: `0 0 4px ${tint(rarity.R, 45)}`, E: `0 0 8px ${tint(rarity.E, 60)}`, L: `0 0 12px ${tint(rarity.L, 75)}, inset 0 0 8px ${tint(rarity.L, 25)}` };

export const frame = (tier: Tier, extra: CSS = {}): CSS => ({
  border: `2px solid ${rarity[tier]}`,
  borderRadius: size.radius,
  boxShadow: GLOW[tier],
  background: tint(rarity[tier], 7),
  ...extra,
});

export function Section({ title, note, children, style }: { title: string; note?: string; children: ComponentChildren; style?: CSS }) {
  return (
    <section style={{ ...box, ...style }}>
      <h2 style={{ margin: `0 0 ${size.gap}px`, fontFamily: font.title, fontWeight: 400, fontSize: size.text + 3, color: color.light, display: 'flex', alignItems: 'baseline', gap: size.gap }}>
        {title}
        {note && <span style={{ fontFamily: font.body, fontSize: size.small, color: color.textDim }}>{note}</span>}
      </h2>
      {children}
    </section>
  );
}

export function Dim({ children, style }: { children: ComponentChildren; style?: CSS }) {
  return <span style={{ color: color.textDim, fontSize: size.small, ...style }}>{children}</span>;
}

export function Row({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div style={{ display: 'flex', gap: size.gap, padding: '2px 0', alignItems: 'baseline' }}>
      <span style={{ color: color.textDim, fontSize: size.small, width: 74, flex: 'none' }}>{label}</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}

/** A tier mark: the letter in the colour of its frame. */
export function TierMark({ tier, name }: { tier: Tier; name?: string }) {
  return (
    <span title={name} style={{ display: 'inline-block', minWidth: 18, textAlign: 'center', padding: '0 4px', border: `1px solid ${rarity[tier]}`, borderRadius: 3, color: rarity[tier], fontSize: size.small - 2, fontFamily: font.mono, lineHeight: '16px' }}>
      {tier}
    </span>
  );
}

// ---------- bars ----------

/** A bar read as a meter: the part up to `pct`, and a segment after it for what the gear adds (light) or takes (dread). */
export function Meter({ label, valueText, pct, extra = 0, extraTone = color.light, tone = color.light, height = 8 }: { label: string; valueText: string; pct: number; extra?: number; extraTone?: string; tone?: string; height?: number }) {
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-valuetext={valueText} style={{ position: 'relative', height, background: tint(color.text, 8), borderRadius: height / 2, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: tone }} />
      {extra > 0 && <div style={{ position: 'absolute', left: `${pct}%`, top: 0, bottom: 0, width: `${extra}%`, background: extraTone }} />}
    </div>
  );
}

export function StatRow({ s }: { s: StatBar }) {
  const text = s.gear ? `${s.base} ${s.gear > 0 ? '+' : '−'}${Math.abs(s.gear)}` : `${s.base}`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '58px 1fr 64px', alignItems: 'center', gap: size.gap, padding: '3px 0' }} data-testid={`stat-${s.key}`}>
      <span>{s.label}</span>
      <Meter label={s.label} valueText={`${s.total}`} pct={s.pct} extra={s.gearPct} extraTone={s.gear < 0 ? color.dread : color.fate} />
      <span style={{ fontFamily: font.mono, fontSize: size.small, textAlign: 'right' }} title={s.gear ? `${W.gearBonus}: ${s.gear > 0 ? '+' : '−'}${Math.abs(s.gear)}` : undefined}>
        {text}
      </span>
    </div>
  );
}

/** An axis from −100 to 100: the bar grows from the middle toward the side of the sign. */
export function AxisRow({ a }: { a: AxisBar }) {
  const left = a.value < 0;
  const tone = left ? color.dread : color.light;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr 40px', alignItems: 'center', gap: size.gap, padding: '3px 0' }} data-testid={`axis-${a.key}`}>
      <span>{a.label}</span>
      <div role="meter" aria-label={a.label} aria-valuemin={-100} aria-valuemax={100} aria-valuenow={a.value} style={{ position: 'relative', height: 8, background: tint(color.text, 8), borderRadius: 4 }}>
        <div style={{ position: 'absolute', left: left ? `${50 - a.pct}%` : '50%', width: `${a.pct}%`, top: 0, bottom: 0, background: tone, borderRadius: 4 }} />
        <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: color.textDim }} />
      </div>
      <span style={{ fontFamily: font.mono, fontSize: size.small, textAlign: 'right' }}>{a.value > 0 ? `+${a.value}` : a.value < 0 ? `−${Math.abs(a.value)}` : '0'}</span>
    </div>
  );
}

/** Three pips for the level of an aptitude. */
export function Pips({ level, max = 3, tone = color.light }: { level: number; max?: number; tone?: string }) {
  return (
    <span aria-label={`${W.level} ${level}`} style={{ display: 'inline-flex', gap: 3 }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: i < level ? tone : 'transparent', border: `1px solid ${i < level ? tone : color.line}` }} />
      ))}
    </span>
  );
}

// ---------- traits, aptitudes, skills ----------

export function TraitChip({ t }: { t: TraitView }) {
  return (
    <span title={t.desc} data-testid="trait" style={{ display: 'inline-block', margin: '0 6px 6px 0', padding: '3px 10px', border: `1px solid ${color.line}`, borderRadius: 14, background: tint(color.text, 5) }}>
      {t.name}
      {t.desc && <Dim style={{ marginLeft: 6 }}>{t.desc}</Dim>}
    </span>
  );
}

export function AptCard({ a }: { a: AptView }) {
  return (
    <div style={{ padding: '6px 0', borderTop: `1px solid ${color.line}` }} data-testid="apt">
      <div style={{ display: 'flex', alignItems: 'center', gap: size.gap }}>
        <span style={{ flex: 1 }}>{a.name}</span>
        {a.stat && <Dim>{a.stat}</Dim>}
        <Pips level={a.level} />
      </div>
      {a.levels
        .filter((l) => l.reached)
        .map((l) => (
          <div key={l.level} style={{ fontSize: size.small, color: color.textDim, paddingLeft: size.pad }}>
            <span style={{ fontFamily: font.mono, marginRight: 6, color: color.fate }}>{l.level}</span>
            {l.name}
            {l.effect && ` · ${l.effect}`}
          </div>
        ))}
    </div>
  );
}

export function SkillLine({ s }: { s: SkillView }) {
  return (
    <div style={{ padding: '6px 0', borderTop: `1px solid ${color.line}` }} data-testid="skill">
      <div style={{ display: 'flex', gap: size.gap, alignItems: 'center' }}>
        <span style={{ flex: 1 }}>{s.name}</span>
        {s.level > 0 && <Pips level={s.level} />}
      </div>
      {s.effect && <div style={{ fontSize: size.small, color: color.textDim }}>{s.effect}</div>}
    </div>
  );
}

// ---------- blessings and curses ----------

export function GiftCard({ g, curse }: { g: GiftView; curse?: boolean }) {
  const tone = curse ? color.dread : color.light;
  return (
    <div style={{ ...frame(g.tier, { borderColor: rarity[g.tier], borderLeft: `5px solid ${tone}` }), padding: '6px 10px', marginBottom: 6 }} data-testid={curse ? 'curse' : 'blessing'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: size.gap }}>
        <TierMark tier={g.tier} />
        <span style={{ flex: 1, color: tone }}>{g.name}</span>
      </div>
      {g.effect && <div style={{ fontSize: size.small }}>{g.effect}</div>}
      {g.deltas.length > 0 && <div style={{ fontSize: size.small, color: color.textDim, fontFamily: font.mono }}>{g.deltas.join(' · ')}</div>}
      {g.tags.map((t) => (
        <div key={t} style={{ fontSize: size.small, color: color.textDim }}>
          {t}
        </div>
      ))}
      {g.cure && (
        <div style={{ fontSize: size.small, color: color.fate }}>
          {W.cure}: {g.cure}
        </div>
      )}
    </div>
  );
}

// ---------- items ----------

export function ItemFrame({ item, label }: { item: ItemView | null; label: string }) {
  if (!item) {
    return (
      <div style={{ border: `2px dashed ${color.line}`, borderRadius: size.radius, padding: '8px 10px', minHeight: 56, color: color.textDim, fontSize: size.small }} data-testid="slot-empty">
        {label} · {W.empty}
      </div>
    );
  }
  return (
    <div style={{ ...frame(item.tier), padding: '8px 10px', minHeight: 56 }} data-testid="slot-item" tabIndex={0} title={[item.name, item.tierName, ...item.lines].join('\n')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: size.gap }}>
        <TierMark tier={item.tier} name={item.tierName} />
        <span style={{ flex: 1 }}>{item.name}</span>
        <Dim>{label}</Dim>
      </div>
      {item.lines.map((l, i) => (
        <div key={i} style={{ fontSize: size.small, color: i === 0 ? color.text : color.textDim }}>
          {l}
        </div>
      ))}
    </div>
  );
}

export function SlotGrid({ slots }: { slots: SlotView[] }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {slots.map((s) => (
        <ItemFrame key={s.key} item={s.item} label={s.label} />
      ))}
    </div>
  );
}

export function Carried({ group }: { group: CarriedView }) {
  return (
    <div style={{ marginTop: size.gap }}>
      <Dim>{group.label}</Dim>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {group.items.map((i) => (
          <span key={i.id} style={{ ...frame(i.tier, { borderWidth: 1 }), padding: '2px 8px', fontSize: size.small }} data-testid="carried">
            {i.name}
            {i.count > 1 ? ` ×${i.count}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CompanionCard({ c }: { c: CompanionView }) {
  return (
    <div style={{ ...frame(c.tier), padding: '8px 10px' }} data-testid="companion">
      <div style={{ display: 'flex', alignItems: 'center', gap: size.gap }}>
        <TierMark tier={c.tier} />
        <span style={{ flex: 1 }}>{c.name}</span>
        <Dim>{c.category}</Dim>
      </div>
      {c.note && <div style={{ fontSize: size.small, color: color.textDim }}>{c.note}</div>}
      {c.abilities.map((a) => (
        <div key={a.name} style={{ fontSize: size.small }}>
          <span style={{ color: color.fate }}>{a.name}</span>
          {a.text && <Dim> · {a.text}</Dim>}
        </div>
      ))}
    </div>
  );
}
