// The attention system (code-plan §7 row "attention", docs/systems/experience/07-attention.md): decides when the game calls the player.
// It runs at the end of each beat, reads what the other systems wrote in the log, and writes `attention/call` entries (level 3):
//   data.call   'stop' (the game pauses, one panel shows the summary and every waiting card) or 'card' (time goes on, a card slides in)
//   data.why    age · window · majorOmen · nearDeath · death · prayer · omen · battle · crisis
//   data.n      numbers of the log entries this call stands for, comma separated (the trigger and the cards folded into a stop)
//   data.ids    their ids; data.cards the kinds of the cards folded in; data.age the age stop it stands for; data.until the life age a card runs out
// What did not call stays in the log: `attention/glow` (a window that only glows on the life line) and `attention/missed` (a card that ran out).
// Time is real seconds at normal speed on the life clock (tuning SEC_PER_YEAR); the speed setting is the screen's business.
import type { Ctx, Game, System } from '../game';
import { write } from '../log';
import type { GameState, LifeState, LogEntry } from '../types';
import type { AttentionData, AttentionRule } from '../data/types-attention';
import { agesOf, dying, newMem, tick, type Mem, type Out, type Plan, type Trig } from './schedule';
import { classify } from './triggers';
import { NEAR_DEATH_YEARS, SEC_PER_YEAR, rulesOf, type CardKind } from './tuning';

export { SEC_PER_YEAR, LIFE_MINUTES, LIFE_YEARS, DEFAULT_RULES, DEFAULT_DEADLINES, DEFAULT_AGE_STOPS } from './tuning';
export type { CardKind, TriggerKind } from './tuning';
export { tick, dying, newMem, agesOf } from './schedule';
export type { Mem, Out, Plan, Trig, Wait, Hold } from './schedule';
export { classify } from './triggers';

const dataOf = (ctx: Ctx): AttentionData | undefined => ctx.data.attention?.items as AttentionData | undefined;

/** The rule of the setting the player chose (07-attention.md §4); a change counts from the next tick. */
export function ruleOf(ctx: Ctx): AttentionRule {
  return rulesOf(dataOf(ctx)).rules[ctx.state.settings.attention];
}

function memOf(life: LifeState): Mem | undefined {
  return life.ext.attention as Mem | undefined;
}

/** Seconds on the life clock (normal speed): life years since age 0 times the seconds of a life year. */
function nowOf(state: GameState, life: LifeState): number {
  const age = life.dead ? life.dead.hAge : life.hAge;
  return (age + state.clock.quarter / 4) * SEC_PER_YEAR;
}

/** The natural end of this life, if the character system says (hidden from the player; it only moves the death scene earlier). */
function deathAgeOf(life: LifeState): number | null {
  const d = (life.ext.character as { deathAge?: number } | undefined)?.deathAge;
  return typeof d === 'number' ? d : null;
}

function planOf(ctx: Ctx, life: LifeState, m: Mem): Plan {
  const r = rulesOf(dataOf(ctx));
  const d = deathAgeOf(life);
  return {
    ages: agesOf(r.ageStops, m.from),
    nearAt: d === null ? null : Math.max(m.from, d - NEAR_DEATH_YEARS) * SEC_PER_YEAR,
    waitOf: (k: CardKind) => r.deadlines[k] * SEC_PER_YEAR,
  };
}

/** Entries written since the last tick that call for something. */
function fresh(ctx: Ctx, m: Mem): Trig[] {
  const log = ctx.state.log;
  const from: LogEntry[] = [];
  for (let i = log.length - 1; i >= 0 && log[i].n >= m.mark; i--) from.push(log[i]);
  from.reverse();
  const out: Trig[] = [];
  for (const e of from) {
    const t = classify(ctx, e);
    if (t) out.push(t);
  }
  return out;
}

const list = (xs: (string | number | undefined)[]): string => xs.filter((x) => x !== undefined).join(',');

function emit(ctx: Ctx, out: Out[]): void {
  const st = ctx.state;
  for (const o of out) {
    if (o.t === 'call') {
      const ids = o.src.map((s) => s.id);
      write(st, {
        sys: 'attention',
        kind: 'call',
        id: o.src.find((s) => s.id !== undefined)?.id ?? (o.age !== null && o.call === 'stop' ? `age.${o.age}` : o.why),
        level: 3,
        data: { call: o.call, why: o.why, age: o.age, n: list(o.src.map((s) => s.n)), ids: list(ids), cards: list(o.cards), until: o.until === null ? null : Math.round(o.until * 100) / 100, sec: o.sec },
      });
    } else if (o.t === 'glow') {
      write(st, { sys: 'attention', kind: 'glow', ...(o.id !== undefined ? { id: o.id } : {}), level: 1, data: { why: o.why, n: o.n } });
    } else {
      write(st, { sys: 'attention', kind: 'missed', ...(o.id !== undefined ? { id: o.id } : {}), level: 1, data: { kind: o.kind, n: o.n, waited: o.waited } });
    }
  }
}

function step(ctx: Ctx, mode: 'tick' | 'dying'): void {
  const st = ctx.state;
  const life = st.life;
  if (!life) return;
  const m = memOf(life);
  if (!m) return;
  const out: Out[] = [];
  const trigs = fresh(ctx, m);
  const plan = planOf(ctx, life, m);
  const rule = ruleOf(ctx);
  const now = nowOf(st, life);
  if (mode === 'dying') dying(m, rule, plan, now, trigs, out);
  else if (!life.dead) tick(m, rule, plan, now, trigs, out);
  else return; // the character died during this beat: the death hook makes the call
  emit(ctx, out);
  m.mark = st.logN;
}

export const attentionSystem: System = {
  name: 'attention',
  birth(ctx) {
    const st = ctx.state;
    const life = st.life;
    if (!life) return;
    // the life starts at its own birth entry, so what the story wrote at age 0 is read too
    let mark = st.logN;
    for (let i = st.log.length - 1; i >= 0; i--) {
      const e = st.log[i];
      if (e.sys === 'character' && e.kind === 'birth') {
        mark = e.n;
        break;
      }
    }
    life.ext.attention = newMem(mark, life.hAge);
    step(ctx, 'tick');
  },
  beat(ctx) {
    step(ctx, 'tick');
  },
  lifeYear(ctx) {
    step(ctx, 'tick');
  },
  death(ctx) {
    step(ctx, 'dying');
  },
};

// ---------- for the screens and the test tools ----------

/** The calls in a list of entries (`attention/call`). */
export const callsOf = (log: readonly LogEntry[]): LogEntry[] => log.filter((e) => e.sys === 'attention' && e.kind === 'call');
export const isStop = (e: LogEntry): boolean => e.sys === 'attention' && e.kind === 'call' && e.data.call === 'stop';

/** The numbers of the log entries a call stands for. */
export const sourcesOf = (e: LogEntry): number[] =>
  String(e.data.n ?? '')
    .split(',')
    .filter(Boolean)
    .map(Number);

/** The cards the screen may still show: calls of kind card whose time has not run out, the most urgent first, at most `max` (07-attention.md §2: two). */
export function liveCards(state: GameState, max = 2): LogEntry[] {
  const life = state.life;
  if (!life || life.dead) return [];
  const age = life.hAge + state.clock.quarter / 4;
  const stopN = Math.max(-1, ...state.log.filter(isStop).map((e) => e.n));
  return state.log
    .filter((e) => e.sys === 'attention' && e.kind === 'call' && e.data.call === 'card' && e.n > stopN && typeof e.data.until === 'number' && e.data.until > age)
    .sort((a, b) => (a.data.until as number) - (b.data.until as number))
    .slice(0, max);
}

/** Prayers that wait for a card now. The rules allow two (07-attention.md §3): the god system should not make a third, attention drops it. */
export function prayersWaiting(state: GameState): number {
  const m = state.life ? memOf(state.life) : undefined;
  return m ? m.queue.filter((c) => c.kind === 'prayer').length : 0;
}

/**
 * Has the scene before the end begun (the death stop was made, near death or at the death)? Prayers are not raised from then: the player is called
 * once more at the most, and a card raised after it could not be shown (07-attention.md §2 "ใกล้ตาย").
 */
export function inDeathScene(state: GameState): boolean {
  const m = state.life ? memOf(state.life) : undefined;
  return !!m?.near;
}

export interface NextCall {
  beats: number;
  /** the calls written by the beat that ended the run (a stop may bring several cards with it only as `cards`; usually one) */
  calls: LogEntry[];
  stoppedBy: 'call' | 'death' | 'limit';
}

/**
 * Runs the game beat by beat until the attention system calls the player, the character dies, or `max` beats pass.
 * `stopsOnly`: ignore cards (time goes on for a card in the real game); default stops at both, which is what a tool that plays the
 * part of the player wants. A death ends the run with the death stop in `calls`.
 */
export function nextCall(game: Game, opts: { max?: number; stopsOnly?: boolean } = {}): NextCall {
  const max = opts.max ?? 4 * 400;
  let beats = 0;
  while (beats < max) {
    if (!game.state.life || game.state.life.dead) return { beats, calls: [], stoppedBy: 'death' };
    const mark = game.state.logN;
    game.beat();
    beats++;
    const calls = callsOf(game.state.log.filter((e) => e.n >= mark)).filter((e) => !opts.stopsOnly || isStop(e));
    if (calls.length) return { beats, calls, stoppedBy: game.state.life?.dead ? 'death' : 'call' };
    if (!game.state.life || game.state.life.dead) return { beats, calls: [], stoppedBy: 'death' };
  }
  return { beats, calls: [], stoppedBy: 'limit' };
}
