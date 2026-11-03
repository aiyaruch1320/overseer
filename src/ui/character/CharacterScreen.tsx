// The character screen (code-plan §8.2 row "ตัวละคร"): who the character is, the life question, the stats, the axes of nature, the aptitudes and skills,
// the blessings and curses, the gear in its slots with frames of rarity, the companion, the purse, the debt and the bondage, and the standing of the god
// (the belief of the character). It reads the state of the store, or the data and state handed in (the storybook), and holds nothing of the game.
import { useEffect, useMemo } from 'preact/hooks';
import { store } from '../../app/store';
import { characterView, type CharacterModel } from '../../app/views/character';
import { CHAR_WORDS as W } from '../../app/views/character-words';
import type { GameData } from '../../core/game';
import type { GameState } from '../../core/types';
import { Button } from '../start/parts';
import { Candle } from '../watch/parts';
import { css as watchCss } from '../watch/style';
import { color, font, size } from '../tokens';
import { AptCard, AxisRow, box, Carried, CompanionCard, Dim, GiftCard, Meter, Row, Section, SkillLine, SlotGrid, StatRow, TraitChip } from './parts';

export interface CharacterScreenProps {
  data?: GameData;
  state?: GameState | null;
  /** The screen is a layer over the watch screen: Escape and the back button call this. */
  onBack?: () => void;
}

const stage = { height: '100vh', minHeight: size.minHeight, minWidth: size.minWidth, boxSizing: 'border-box', padding: size.pad, color: color.text, fontFamily: font.body, fontSize: size.text, background: color.panel, overflowY: 'auto' } as const;

function useSource(p: CharacterScreenProps): { data: GameData; state: GameState } | null {
  void store.rev.value;
  const data = p.data ?? store.gameData;
  const state = p.state ?? store.state;
  return data && state ? { data, state } : null;
}

function Identity({ m }: { m: CharacterModel }) {
  const i = m.identity;
  return (
    <Section title={W.identity}>
      <div data-testid="identity">
        <Row label={W.race}>
          {i.race}
          {i.second ? ` / ${i.second}` : ''}
          {i.gender ? ` · ${i.gender}` : ''}
        </Row>
        <Row label={W.age}>
          {i.age} {W.ageUnit} <Dim>{W.year} {i.year.toLocaleString('en-US')}</Dim>
        </Row>
        <Row label={W.where}>
          {i.where}
          {i.born && <Dim> ({W.born} {i.born})</Dim>}
        </Row>
        <Row label={W.cls}>{i.cls}</Row>
        <Row label={W.job}>
          {i.job || W.none}
          {i.secretJob && (
            <span style={{ color: color.dreamMist }}>
              {' · '}
              {i.secretJob} ({W.secret})
            </span>
          )}
          {i.jobYears !== null && <Dim> · {W.jobYears(i.jobYears)}</Dim>}
        </Row>
        <Row label={W.faith}>{i.faith || W.none}</Row>
      </div>
      {m.vow && (
        <div style={{ marginTop: size.gap, paddingTop: size.gap, borderTop: `1px solid ${color.line}` }} data-testid="vow">
          <Dim>{W.vow}</Dim>
          <div style={{ fontFamily: font.title, fontSize: size.text + 2, color: m.vow.result === 'broken' ? color.textDim : color.light, lineHeight: 1.45 }}>
            {m.vow.name}
            {m.vow.result && <Dim> · {m.vow.result === 'kept' ? W.vowKept : W.vowBroken}</Dim>}
          </div>
          {m.vow.done && <Dim>{m.vow.done}</Dim>}
          {m.vow.changeable && <div><Dim>{W.vowChange}</Dim></div>}
        </div>
      )}
      {m.question && (
        <div style={{ marginTop: size.gap, paddingTop: size.gap, borderTop: `1px solid ${color.line}` }} data-testid="question">
          <Dim>{W.question}</Dim>
          <div style={{ fontFamily: font.title, fontSize: size.text + 2, color: color.light, lineHeight: 1.45 }}>{m.question}</div>
        </div>
      )}
    </Section>
  );
}

function Body({ m }: { m: CharacterModel }) {
  const low = m.hp.pct < 35;
  return (
    <Section title={W.stats}>
      <div style={{ display: 'grid', gridTemplateColumns: '58px 1fr 64px', alignItems: 'center', gap: size.gap, paddingBottom: 4 }} data-testid="hp">
        <span>{W.hp}</span>
        <Meter label={W.hp} valueText={`${m.hp.now} / ${m.hp.max}`} pct={m.hp.pct} tone={low ? color.dread : color.light} />
        <span style={{ fontFamily: font.mono, fontSize: size.small, textAlign: 'right' }}>
          {m.hp.now}/{m.hp.max}
        </span>
      </div>
      {m.hp.wounds > 0 && (
        <Dim>
          {W.wounds} {m.hp.wounds}
        </Dim>
      )}
      <div style={{ marginTop: 4 }}>
        {m.stats.map((s) => (
          <StatRow key={s.key} s={s} />
        ))}
      </div>
    </Section>
  );
}

function Nature({ m }: { m: CharacterModel }) {
  return (
    <Section title={W.axes}>
      {m.axes.map((a) => (
        <AxisRow key={a.key} a={a} />
      ))}
      <div style={{ marginTop: size.gap }}>
        <Dim>{W.traits}</Dim>
        <div style={{ marginTop: 4 }}>{m.traits.length ? m.traits.map((t) => <TraitChip key={t.id} t={t} />) : <Dim>{W.none}</Dim>}</div>
      </div>
    </Section>
  );
}

function Know({ m }: { m: CharacterModel }) {
  return (
    <>
      <Section title={W.aptitudes} note={`${m.aptitudes.length}`}>
        {m.aptitudes.length ? m.aptitudes.map((a) => <AptCard key={a.id} a={a} />) : <Dim>{W.none}</Dim>}
      </Section>
      {m.skills.length > 0 && (
        <Section title={W.skills} note={`${m.skills.length}`}>
          {m.skills.map((s) => (
            <SkillLine key={s.id} s={s} />
          ))}
        </Section>
      )}
    </>
  );
}

function Gifts({ m }: { m: CharacterModel }) {
  return (
    <>
      <Section title={W.blessings} note={`${m.blessings.length}`}>
        {m.blessings.length ? m.blessings.map((g) => <GiftCard key={g.id} g={g} />) : <Dim>{W.none}</Dim>}
      </Section>
      <Section title={W.curses} note={`${m.curses.length}`}>
        {m.curses.length ? m.curses.map((g) => <GiftCard key={g.id} g={g} curse />) : <Dim>{W.none}</Dim>}
      </Section>
    </>
  );
}

function Gear({ m }: { m: CharacterModel }) {
  return (
    <>
      <Section title={W.gear}>
        <SlotGrid slots={m.gear.slots} />
        {m.gear.carried.map((g) => (
          <Carried key={g.label} group={g} />
        ))}
      </Section>
      {m.companions.length > 0 && (
        <Section title={W.companion}>
          <div style={{ display: 'grid', gap: 6 }}>
            {m.companions.map((c) => (
              <CompanionCard key={c.id} c={c} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function Standing({ m }: { m: CharacterModel }) {
  const s = m.standing;
  const b = s.bondage;
  return (
    <Section title={W.standing}>
      <div data-testid="standing">
        <Row label={W.gold}>
          <span style={{ color: color.light, fontFamily: font.mono }}>{s.gold}</span>
        </Row>
        {s.debt > 0 && (
          <Row label={W.debt}>
            <span style={{ color: color.dreadText, fontFamily: font.mono }}>{s.debt}</span>
          </Row>
        )}
        <Row label={W.fame}>
          <span style={{ fontFamily: font.mono }}>{s.fame}</span>
        </Row>
        {s.lastYear && (
          <Row label={W.lastYear}>
            <Dim>
              {W.income} {s.lastYear.income} · {W.tax} {s.lastYear.tax} · {W.living} {s.lastYear.living}
            </Dim>
          </Row>
        )}
      </div>
      <div style={{ marginTop: size.gap, paddingTop: size.gap, borderTop: `1px solid ${color.line}` }} data-testid="bondage">
        <Row label={W.bondage}>
          <span style={{ color: b.level > 0 ? color.dreadText : color.text }}>{b.name}</span>
        </Row>
        {b.rows.map(([k, v]) => (
          <Row key={k} label={k}>
            {v}
          </Row>
        ))}
        {b.held.length > 0 && (
          <Row label={W.held}>
            {b.held.map((h) => `${h.name} (${h.level})`).join(' · ')}
          </Row>
        )}
      </div>
    </Section>
  );
}

function God({ m }: { m: CharacterModel }) {
  return (
    <Section title={W.god} note={W.godNote}>
      <Candle candle={m.god} showPct={false} />
    </Section>
  );
}

/** The whole sheet of the character on the stage. */
export function CharacterScreen(props: CharacterScreenProps) {
  const src = useSource(props);
  const model = useMemo(() => (src ? characterView(src.data, src.state) : null), [src?.data, src?.state, store.rev.value]);
  const { onBack } = props;
  useEffect(() => {
    if (!onBack) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [onBack]);
  if (!src) return null;
  if (!model) return <div style={stage}>{W.noLife}</div>;
  const col = { display: 'flex', flexDirection: 'column', gap: size.pad, minWidth: 0 } as const;
  return (
    <div class="wt-root" style={stage} data-testid="character">
      <style>{watchCss}</style>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: size.pad, marginBottom: size.pad }}>
        {onBack && <Button onClick={onBack}>{W.back}</Button>}
        <h1 style={{ margin: 0, fontFamily: font.title, fontWeight: 400, fontSize: size.title + 8 }} data-testid="name">
          {model.identity.name}
        </h1>
        <Dim>{W.title}</Dim>
        {model.dead && (
          <span style={{ ...box, padding: '2px 10px', color: color.dreadText, borderColor: color.dread }} data-testid="dead">
            {W.dead} · {W.age} {model.dead.age}
          </span>
        )}
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: size.pad, alignItems: 'start' }}>
        <div style={col}>
          <Identity m={model} />
          <Body m={model} />
          <Nature m={model} />
        </div>
        <div style={col}>
          <Know m={model} />
          <Gifts m={model} />
        </div>
        <div style={col}>
          <Gear m={model} />
          <Standing m={model} />
          <God m={model} />
        </div>
      </div>
    </div>
  );
}
