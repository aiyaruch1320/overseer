// The attention system (code-plan §7 row "attention", docs/systems/experience/07-attention.md): decides when the game calls the player.
// It runs at the end of each beat, reads what the other systems wrote in the log, and writes `attention/call` entries (level 3):
//   data.call   'stop' (the game pauses, one panel shows the summary and every waiting card) or 'card' (time goes on, a card slides in)
//   data.why    age · window · majorOmen · nearDeath · death · prayer · omen · battle · crisis
//   data.n      numbers of the log entries this call stands for, comma separated (the trigger and the cards folded into a stop)
//   data.ids    their ids; data.cards the kinds of the cards folded in; data.age the age stop it stands for; data.until the life age a card runs out
// What did not call stays in the log: `attention/glow` (a window that only glows on the life line) and `attention/missed` (a card that ran out).
// Time is real seconds at normal speed on the life clock (tuning SEC_PER_YEAR); the speed setting is the screen's business.
import type { Ctx, Game, System } from '../game';
import { cardOn } from '../command';
import { write } from '../log';
import type { GameState, LifeState, LogEntry } from '../types';
import type { AttentionData, AttentionRule } from '../data/types-attention';
import { agesOf, dying, newMem, tick, type Mem, type Out, type Plan, type Trig } from './schedule';
import { classify } from './triggers';
import { MAX_CARDS, NEAR_DEATH_YEARS, SEC_PER_YEAR, rulesOf, type CardKind } from './tuning';

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
      write(st, { sys: 'attention', kind: 'missed', ...(o.id !== undefined ? { id: o.id } : {}), level: 1, data: { kind: o.kind, n: o.n, waited: o.waited, ...(o.death ? { death: true } : {}), ...(o.off ? { off: true } : {}) } });
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
  const all = fresh(ctx, m);
  // a kind the player switched off is not called (07-attention.md §4): the log tells it like a card that came too late (§1 rule 5)
  const trigs = all.filter((t) => {
    if (t.kind === 'window' || cardOn(st.settings, t.kind)) return true;
    out.push({ t: 'missed', kind: t.kind, n: t.n, id: t.id, waited: 0, off: true });
    return false;
  });
  const plan = planOf(ctx, life, m);
  const rule = ruleOf(ctx);
  const now = nowOf(st, life);
  // a card whose matter is closed while it waits (the prayer answered, the fight fought) is not shown and not folded into a stop (07-attention.md §2)
  m.queue = m.queue.filter((c) => !closed(st, c.kind, c.n));
  if (mode === 'dying') dying(m, rule, plan, now, trigs, out);
  else if (!life.dead) tick(m, rule, plan, now, trigs, out, { slots: MAX_CARDS - liveCards(st, 99).length });
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

/**
 * Has the attention system answered the log entry `n` (a call that stands for it, a glow, or a card that came too late)? A system that announces
 * something before it decides it (the story's god windows, the crisis of a tie) waits for this; without the system on the life the answer is yes.
 */
export function answered(state: GameState, n: number): boolean {
  if (!state.life?.ext.attention) return true;
  const log = state.log;
  for (let i = log.length - 1; i >= 0 && log[i].n > n; i--) {
    const e = log[i];
    if (e.sys !== 'attention') continue;
    if (e.kind === 'call' && sourcesOf(e).includes(n)) return true;
    if ((e.kind === 'glow' || e.kind === 'missed') && e.data.n === n) return true;
  }
  return false;
}

const PRAYER_ENDS = new Set(['prayer.give', 'prayer.deny', 'prayer.punish', 'prayer.moot', 'prayer.lapse']);

/** The log entry with the number `n` (the log is in the order of the numbers). */
function entryAt(log: readonly LogEntry[], n: number): LogEntry | undefined {
  let lo = 0;
  let hi = log.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (log[mid].n === n) return log[mid];
    if (log[mid].n < n) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}

/**
 * Is the matter a card stands for over (the entry `n` the card was raised for)? A prayer that was answered, taken back as moot or lapsed; a
 * crisis the character has decided; a named fight that was fought. Such a card leaves the screen and the stop (07-attention.md §2: a card is
 * about something the player can still do). A card of a kind with no answer to wait for (an omen) is closed only by its time.
 */
export function closed(state: GameState, kind: CardKind, n: number): boolean {
  const life = state.life;
  const src = entryAt(state.log, n);
  if (!life || !src) return false;
  if (kind === 'prayer' && src.sys === 'god' && src.kind === 'prayer') {
    const pn = src.data.n;
    for (let i = state.log.length - 1; i >= 0 && state.log[i].n > n; i--) {
      const e = state.log[i];
      if (e.sys === 'god' && PRAYER_ENDS.has(e.kind) && e.data.n === pn) return true;
    }
    return false;
  }
  if (kind === 'crisis' && src.sys === 'bonds') {
    const crises = (life.ext.bonds as { crises?: { n: number }[] } | undefined)?.crises;
    return !!crises && !crises.some((c) => c.n === n);
  }
  if (kind === 'battle' && src.sys === 'combat') {
    const pending = (life.ext.combat as { pending?: { prelude?: number }[] } | undefined)?.pending;
    return !!pending && !pending.some((p) => p.prelude === n);
  }
  return false;
}

/** Cards on the screen at most (07-attention.md §2). */
export { MAX_CARDS } from './tuning';

/**
 * The cards the screen may still show: calls of kind card whose time has not run out and whose matter is not closed, the most urgent first, at most
 * `max` (07-attention.md §2: two). A third card is not lost: it shows when a place frees, and the rules make no new call while two are up.
 */
export function liveCards(state: GameState, max = MAX_CARDS): LogEntry[] {
  const life = state.life;
  if (!life || life.dead) return [];
  const age = life.hAge + state.clock.quarter / 4;
  const stopN = Math.max(-1, ...state.log.filter(isStop).map((e) => e.n));
  return state.log
    .filter(
      (e) =>
        e.sys === 'attention' &&
        e.kind === 'call' &&
        e.data.call === 'card' &&
        e.n > stopN &&
        typeof e.data.until === 'number' &&
        e.data.until > age &&
        !closed(state, e.data.why as CardKind, sourcesOf(e)[0] ?? -1),
    )
    .sort((a, b) => (a.data.until as number) - (b.data.until as number))
    .slice(0, max);
}

/** Acts of the god that answer a card of fight or crisis: a whisper, a dream sent (not the telling of how one ended), the omen of a miracle. */
const ACTS = (e: LogEntry): boolean => e.sys === 'god' && (e.kind === 'whisper' || e.kind === 'miracle.omen' || (e.kind === 'dream' && e.data.paid !== undefined));

/**
 * Has the player had the call for the entry `n`? Like `answered`, but a card on the screen counts only when its time ran out or the player acted on
 * it (a whisper, a dream, an omen of a miracle after the card): the fight and the crisis the card announces wait for that, so a card of "1.8 years"
 * gives the player those years (M5 review S6). A stop, a glow and a missed card count at once (the stop holds the clock until the player goes on).
 */
export function settled(state: GameState, n: number): boolean {
  if (!state.life?.ext.attention) return true;
  const log = state.log;
  for (let i = log.length - 1; i >= 0 && log[i].n > n; i--) {
    const e = log[i];
    if (e.sys === 'attention' && (e.kind === 'glow' || e.kind === 'missed') && e.data.n === n) return true;
    if (e.sys !== 'attention' || e.kind !== 'call' || !sourcesOf(e).includes(n)) continue;
    if (e.data.call === 'stop') return true;
    const life = state.life;
    if (typeof e.data.until !== 'number' || e.data.until <= life.hAge + state.clock.quarter / 4) return true;
    for (let j = log.length - 1; j >= 0 && log[j].n > e.n; j--) if (ACTS(log[j])) return true;
    return false;
  }
  return false;
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
