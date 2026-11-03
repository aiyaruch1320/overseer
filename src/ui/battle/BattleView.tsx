// The watch of one battle (code-plan §8.2 row "ศึก"): the player watches and does not steer. The view plays a `BattleModel` beat by beat: the meeting,
// then each beat's stance and roll with the hero's hit points and the foe's wounds, then the result with the wounds and loot. The god's hand shows
// as a dream that named a stance (×3) and a whisper on the weak point. Presentational: it gets a model from src/app/views/battle.ts.
//
// Keys: Space plays or pauses, → steps, Enter skips to the end, R plays again, Esc closes (the same as the buttons).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BATTLE_WORDS as W } from '../../app/views/battle-words';
import { hpAt, leftAt, stepsOf, type BattleModel, type BeatView } from '../../app/views/battle';
import { Silhouette } from '../../scene/Stage';
import type { ActorView } from '../../scene/timeline';
import { color, font, size } from '../tokens';
import { box, button, chip, css, heading, tint, toneColor } from './style';
import { BEAT_MS, FIGURE, MEET_MS, RESULT_MS, SPEEDS, STAGE } from './tuning';

type Pose = ActorView['pose'];

export interface BattleViewProps {
  model: BattleModel;
  /** Start playing at once (the watch screen opens a battle that way); the storybook can start at a step and paused. */
  autoplay?: boolean;
  startStep?: number;
  onClose?: () => void;
}

// ---------- the picture of a step ----------

/** The poses of the two figures at a step: who strikes and who is struck, and how the fight ended. */
export function posesAt(m: BattleModel, step: number): { hero: Pose; foe: Pose; heroX: number } {
  const last = m.beats.length + 1;
  if (step >= last) {
    switch (m.end) {
      case 'win':
      case 'flawless':
        return { hero: 'raise', foe: 'fall', heroX: STAGE.heroX };
      case 'dead':
        return { hero: 'lie', foe: 'raise', heroX: STAGE.heroX };
      case 'lose':
        return { hero: 'kneel', foe: 'raise', heroX: STAGE.heroX };
      case 'flee':
        return { hero: 'walk', foe: 'stand', heroX: STAGE.fleeX };
      case 'talk':
      case 'tame':
        return { hero: 'bow', foe: 'bow', heroX: STAGE.heroX };
      default:
        return { hero: 'stand', foe: 'stand', heroX: STAGE.heroX };
    }
  }
  if (step <= 0) return { hero: m.first === 'hero' ? 'raise' : 'stand', foe: m.first === 'foe' ? 'raise' : 'stand', heroX: STAGE.heroX };
  const b = m.beats[step - 1];
  if (b.ok === true) return { hero: 'raise', foe: b.left !== null && b.left < (leftAt(m, step - 1) ?? 0) ? 'bow' : 'stand', heroX: STAGE.heroX };
  if (b.ok === false) return { hero: 'bow', foe: 'raise', heroX: STAGE.heroX };
  return { hero: 'stand', foe: 'stand', heroX: STAGE.heroX };
}

const actor = (id: string, label: string, pose: Pose, tintColor: string): ActorView => ({ id, label, x: 0.5, pose, tint: tintColor, count: 1 });

function Stage({ m, step }: { m: BattleModel; step: number }) {
  const p = posesAt(m, step);
  const tone = toneColor[m.tone];
  const at = (s: number) => (s <= 0 ? null : m.beats[Math.min(s, m.beats.length) - 1]);
  const here = step >= 1 && step <= m.beats.length ? at(step) : null;
  const hpNow = hpAt(m, step);
  const hpPrev = hpAt(m, step - 1);
  const leftNow = leftAt(m, step);
  const leftPrev = leftAt(m, step - 1);
  const heroHit = here && m.exact && hpNow < hpPrev ? hpPrev - hpNow : 0;
  const foeHit = here && m.exact && leftNow !== null && leftPrev !== null && leftNow < leftPrev ? leftPrev - leftNow : 0;
  const foeH = m.foe.heavy ? FIGURE.heavy : FIGURE.foe;
  const figure = (x: number, h: number, a: ActorView, pop: string | null, popColor: string) => (
    <div style={{ position: 'absolute', left: `${x * 100}%`, bottom: '14%', height: `${h * 100}%`, width: 90, transform: 'translateX(-50%)', transition: 'left 0.8s ease-in-out' }}>
      <Silhouette a={a} frame={a.tint ?? color.fate} />
      <div style={{ position: 'absolute', left: '50%', top: '100%', transform: 'translateX(-50%)', fontSize: size.small, color: color.textDim, whiteSpace: 'nowrap', paddingTop: 4 }}>{a.label}</div>
      {pop && (
        <div key={`${step}${pop}`} class="bt-pop" style={{ position: 'absolute', left: '50%', top: '8%', transform: 'translateX(-50%)', color: popColor, fontFamily: font.mono, fontSize: size.title, textShadow: '0 1px 6px #000', whiteSpace: 'nowrap' }}>
          {pop}
        </div>
      )}
    </div>
  );
  return (
    <div
      data-testid="battle-stage"
      class={m.foe.heavy ? 'bt-boss' : undefined}
      style={{
        position: 'relative',
        height: STAGE.height,
        overflow: 'hidden',
        border: `2px solid ${m.foe.heavy ? color.dread : color.line}`,
        borderRadius: size.radius,
        background: `linear-gradient(to bottom, ${tint(color.dream, 55)} 0%, ${color.panel} 62%, ${tint(color.line, 80)} 62%, ${color.panel} 100%)`,
      }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: '34%', height: 1, background: tint(color.text, 10) }} />
      {m.lastStand && <div style={{ position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center', color: color.dreadText, fontFamily: font.title, fontSize: size.title }}>{W.lastStand}</div>}
      {figure(p.heroX, FIGURE.hero, actor('hero', m.hero.name, p.hero, color.light), heroHit ? `−${heroHit}` : null, color.dreadText)}
      {figure(STAGE.foeX, foeH, actor('foe', m.foe.name, p.foe, m.foe.heavy ? color.dread : color.fate), foeHit ? `${W.wounds} −${foeHit}` : null, color.light)}
      {here?.dream && (
        <div class="bt-god" style={{ position: 'absolute', top: 8, left: 8, ...chip(color.dreamMist), background: tint(color.dream, 70) }}>
          {W.god.dreamMark}
        </div>
      )}
      {step >= m.beats.length + 1 && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 6, textAlign: 'center', fontFamily: font.title, fontSize: size.title + 4, color: tone, textShadow: '0 2px 10px #000' }} data-testid="stage-result">
          {m.resultLabel}
        </div>
      )}
    </div>
  );
}

// ---------- the side panels ----------

function Pips({ total, left }: { total: number; left: number | null }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }} data-testid="wound-pips" aria-label={`${W.wounds} ${left ?? total}/${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const broken = left !== null && i >= left;
        return <span key={i} style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${broken ? color.line : color.dread}`, background: broken ? 'transparent' : tint(color.dread, 70), transition: 'background 0.4s' }} />;
      })}
    </div>
  );
}

function HpBar({ value, max, shown }: { value: number; max: number; shown: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const c = pct <= 30 ? color.dread : color.light;
  return (
    <div>
      <div style={{ height: 12, background: tint(color.text, 8), borderRadius: 3, overflow: 'hidden', border: `1px solid ${color.line}` }}>
        <div class="bt-bar" style={{ width: `${pct}%`, height: '100%', background: c }} />
      </div>
      <div style={{ fontFamily: font.mono, fontSize: size.small, color: shown ? color.text : color.textDim, marginTop: 2 }} data-testid="hero-hp">
        {value} / {max}
      </div>
    </div>
  );
}

function FoePanel({ m, left }: { m: BattleModel; left: number | null }) {
  const f = m.foe;
  return (
    <div style={box} data-testid="foe-panel">
      <div style={heading}>{W.foe}</div>
      <div style={{ fontFamily: font.title, fontSize: size.title, color: f.heavy ? color.dreadText : color.text, lineHeight: 1.5 }}>{f.name}</div>
      <div style={{ margin: `${size.gap / 2}px 0 ${size.gap}px` }}>
        <span style={chip(f.heavy ? color.dreadText : color.fate)} data-testid="foe-tier">
          {f.tier}
        </span>
      </div>
      <div style={heading}>
        {W.wounds} {left ?? f.wounds}/{f.wounds}
      </div>
      <Pips total={f.wounds} left={left} />
      {f.weak.length > 0 && (
        <div style={{ marginTop: size.gap }}>
          <div style={heading}>{W.weak}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {f.weak.map((r) => (
              <span key={r.name} class={r.whispered ? 'bt-god' : undefined} style={chip(r.whispered ? color.light : color.text)} data-testid="weak">
                {r.name} {r.mark}
              </span>
            ))}
          </div>
        </div>
      )}
      {f.resist.length > 0 && (
        <div style={{ marginTop: size.gap }}>
          <div style={heading}>{W.resist}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {f.resist.map((r) => (
              <span key={r.name} style={chip(color.textDim)}>
                {r.name} {r.mark}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GodPanel({ m }: { m: BattleModel }) {
  const g = m.god;
  const any = !!g.dream || g.whisper;
  return (
    <div style={box} data-testid="god-panel">
      <div style={heading}>{W.god.title}</div>
      {!any && <div style={{ color: color.textDim, fontSize: size.small }}>{W.god.none}</div>}
      {g.dream && (
        <div class="bt-god" style={{ ...chip(color.dreamMist), background: tint(color.dream, 70), display: 'block', marginBottom: 4 }} data-testid="god-dream">
          {W.god.dream(g.dream.name)}
        </div>
      )}
      {g.whisper && (
        <div class="bt-god" style={{ ...chip(color.light), display: 'block' }} data-testid="god-whisper">
          {W.god.whisper}
        </div>
      )}
    </div>
  );
}

// ---------- the beats ----------

function BeatCard({ b, state, onPick }: { b: BeatView; state: 'future' | 'now' | 'past'; onPick: () => void }) {
  const on = state !== 'future';
  const c = b.ok === true ? color.light : b.ok === false ? color.dreadText : color.textDim;
  return (
    <button
      type="button"
      class="bt-beat"
      onClick={onPick}
      data-testid="beat-card"
      data-state={state}
      style={{
        width: 176,
        textAlign: 'left',
        font: 'inherit',
        color: color.text,
        background: state === 'now' ? tint(color.text, 10) : tint(color.text, 3),
        border: `1px solid ${state === 'now' ? color.textDim : color.line}`,
        borderRadius: size.radius,
        padding: `${size.gap - 2}px ${size.pad - 2}px`,
        opacity: on ? 1 : 0.4,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: size.small, color: color.textDim }}>
        <span>{W.beat(b.n)}</span>
        {on && b.dream && <span style={{ color: color.dreamMist }}>{W.god.dreamMark}</span>}
      </div>
      <div style={{ fontSize: size.text, margin: '2px 0' }}>{on ? b.name : '···'}</div>
      {on && (
        <div style={{ fontFamily: font.mono, fontSize: size.small, color: color.textDim, minHeight: 18 }}>{b.roll ? W.roll(b.roll.d20, b.roll.bonus, b.roll.dc) : b.guessed ? W.guessed : W.unknownRoll}</div>
      )}
      {on && (
        <div style={{ fontSize: size.small, color: c, marginTop: 2 }}>
          {b.ok === null ? '' : b.ok ? W.ok : W.miss}
          {b.roll?.crit ? ` · ${W.crit}` : b.roll?.fumble ? ` · ${W.fumble}` : ''}
        </div>
      )}
    </button>
  );
}

// ---------- after the fight ----------

function Aftermath({ m }: { m: BattleModel }) {
  const tone = toneColor[m.tone];
  const c = m.clash;
  return (
    <div style={{ ...box, borderColor: tint(tone, 55) }} data-testid="aftermath">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: size.pad }}>
        <span style={{ fontFamily: font.title, fontSize: size.title + 2, color: tone }} data-testid="result-label">
          {m.resultLabel}
        </span>
        <span style={{ color: color.textDim, fontSize: size.small }}>{W.hpLost(m.hpLost)}</span>
      </div>
      {m.line && <div style={{ marginTop: size.gap / 2 }}>{m.line}</div>}
      {c && (c.result || c.story) && (
        <div style={{ marginTop: size.gap / 2, color: color.text }} data-testid="clash-result">
          {c.result}
          {c.result && c.story ? ' — ' : ''}
          {c.story}
        </div>
      )}
      <div style={{ display: 'flex', gap: size.pad * 2, marginTop: size.gap, flexWrap: 'wrap' }}>
        <div>
          <div style={heading}>{W.woundTitle}</div>
          {m.wounds.length ? (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} data-testid="wounds">
              {m.wounds.map((w) => (
                <span key={w} style={chip(color.dreadText)}>
                  {w}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ color: color.textDim, fontSize: size.small }}>{W.noWound}</div>
          )}
        </div>
        <div>
          <div style={heading}>{W.lootTitle}</div>
          {m.loot.length ? (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} data-testid="loot">
              {m.loot.map((l) => (
                <span key={l} style={chip(color.light)}>
                  {l}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ color: color.textDim, fontSize: size.small }}>{W.noLoot}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- the view ----------

export function BattleView({ model: m, autoplay = true, startStep = 0, onClose }: BattleViewProps) {
  const last = stepsOf(m) - 1;
  const [step, setStep] = useState(Math.min(startStep, last));
  const [playing, setPlaying] = useState(autoplay && startStep < last);
  const [speed, setSpeed] = useState<number>(SPEEDS[0]);
  // a new battle starts again
  const was = useRef(m.n);
  useEffect(() => {
    if (was.current === m.n) return;
    was.current = m.n;
    setStep(Math.min(startStep, last));
    setPlaying(autoplay);
  }, [m.n]);

  useEffect(() => {
    if (!playing) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => Math.min(last, s + 1)), (step === 0 ? MEET_MS : step === last - 1 ? RESULT_MS : BEAT_MS) / speed);
    return () => clearTimeout(t);
  }, [playing, step, speed, last]);

  const go = (s: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(last, s)));
  };
  const again = () => {
    setStep(0);
    setPlaying(true);
  };
  const toggle = () => {
    if (step >= last) again();
    else setPlaying((p) => !p);
  };
  const keys = useRef({ toggle, go, again, onClose, step });
  keys.current = { toggle, go, again, onClose, step };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const k = keys.current;
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === ' ') (e.preventDefault(), k.toggle());
      else if (e.key === 'ArrowRight') k.go(k.step + 1);
      else if (e.key === 'ArrowLeft') k.go(k.step - 1);
      else if (e.key === 'Enter') k.go(last);
      else if (e.key === 'r' || e.key === 'R') k.again();
      else if (e.key === 'Escape') k.onClose?.();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [last]);

  const hp = hpAt(m, step);
  const left = leftAt(m, step);
  const meetText = useMemo(() => W.first[m.first], [m.first]);
  const c = m.clash;
  const done = step >= last;
  // the panel of the result comes with the last beat: the player need not wait for one more step to know how the fight went
  const shown = step >= m.beats.length;
  return (
    <div
      class="bt-root"
      data-testid="battle-view"
      data-step={step}
      style={{ minWidth: size.minWidth, minHeight: size.minHeight, background: color.panel, color: color.text, fontFamily: font.body, fontSize: size.text, padding: size.pad * 1.5, display: 'flex', flexDirection: 'column', gap: size.pad }}
    >
      <style>{css}</style>
      <header style={{ display: 'flex', alignItems: 'center', gap: size.pad }}>
        <span style={chip(color.fate)}>{c ? W.clash.title : m.kindLabel}</span>
        <h1 style={{ margin: 0, fontFamily: font.title, fontSize: size.title + 6, fontWeight: 400, color: m.foe.heavy ? color.dreadText : color.text }}>{m.foe.name}</h1>
        {m.node && <span style={{ color: color.textDim, fontSize: size.small }}>“{m.node}”</span>}
        <span style={{ flex: 1 }} />
        {onClose && (
          <button type="button" class="bt-btn" style={button} onClick={onClose} data-testid="close">
            {W.controls.close} <span style={{ color: color.textDim }}>{W.keys.close}</span>
          </button>
        )}
      </header>
      {c && (
        <div style={{ ...box, display: 'flex', gap: size.pad * 2, color: color.textDim, fontSize: size.small }} data-testid="clash-head">
          {c.name && (
            <span>
              {W.clash.place} <span style={{ color: color.text }}>{c.name}</span>
            </span>
          )}
          {c.opener && (
            <span>
              {W.clash.opener} <span style={{ color: color.text }}>{c.opener}</span>
            </span>
          )}
          {c.style && <span style={{ color: color.text }}>{c.style}</span>}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 330px', gap: size.pad }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: size.pad, minWidth: 0 }}>
          <Stage m={m} step={step} />
          <div style={{ display: 'flex', alignItems: 'center', gap: size.gap, flexWrap: 'wrap' }}>
            <button type="button" class="bt-btn" style={button} onClick={toggle} data-testid="play">
              {playing ? W.controls.pause : done ? W.controls.again : W.controls.play} <span style={{ color: color.textDim }}>{done ? W.keys.again : W.keys.play}</span>
            </button>
            <button type="button" class="bt-btn" style={button} onClick={() => go(step + 1)} disabled={done} data-testid="step">
              {W.controls.step} <span style={{ color: color.textDim }}>{W.keys.step}</span>
            </button>
            <button type="button" class="bt-btn" style={button} onClick={() => go(last)} disabled={done} data-testid="skip">
              {W.controls.skip} <span style={{ color: color.textDim }}>{W.keys.skip}</span>
            </button>
            <span style={{ flex: 1 }} />
            <span style={{ color: color.textDim, fontSize: size.small }}>{W.controls.speed}</span>
            {SPEEDS.map((s) => (
              <button key={s} type="button" class="bt-btn" style={{ ...button, ...(s === speed ? { borderColor: color.textDim } : {}) }} onClick={() => setSpeed(s)} aria-pressed={s === speed} data-testid={`speed-${s}`}>
                ×{s}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: size.gap }} data-testid="beats">
            <button
              type="button"
              class="bt-beat"
              onClick={() => go(0)}
              data-testid="meet-card"
              style={{ width: 176, textAlign: 'left', font: 'inherit', color: color.text, background: step === 0 ? tint(color.text, 10) : tint(color.text, 3), border: `1px solid ${step === 0 ? color.textDim : color.line}`, borderRadius: size.radius, padding: `${size.gap - 2}px ${size.pad - 2}px` }}
            >
              <div style={{ fontSize: size.small, color: color.textDim }}>{W.meet}</div>
              <div style={{ color: m.first === 'hero' ? color.light : m.first === 'foe' ? color.dreadText : color.text }}>{meetText}</div>
            </button>
            {m.beats.map((b) => (
              <BeatCard key={b.n} b={b} state={step === b.n ? 'now' : step > b.n ? 'past' : 'future'} onPick={() => go(b.n)} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: size.pad }}>
          <FoePanel m={m} left={left} />
          <div style={box} data-testid="hero-panel">
            <div style={heading}>
              {W.hero}
              {m.hero.name ? ` · ${m.hero.name}` : ''} · {W.hp}
            </div>
            <HpBar value={hp} max={m.hero.max} shown={m.exact || done || step === 0} />
          </div>
          <GodPanel m={m} />
          {shown && <Aftermath m={m} />}
        </div>
      </div>
    </div>
  );
}
