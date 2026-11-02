// The call rules of 07-attention.md §3 as a pure state machine, ported from `budget()` in scripts/sim/sim-attention.mjs.
// It knows no log and no game: it is told the time (real seconds at normal speed on the life clock), what happened since the last
// tick (`Trig`) and what is fixed in the life (age stops, the death stop), and it answers with calls, glows and missed cards.
// The system (index.ts) turns the answers into log entries; tests drive it with made-up triggers.
import type { AttentionRule } from '../data/types-attention';
import { MAX_WAITING_PRAYERS, SEC_PER_YEAR, type CardKind, type TriggerKind } from './tuning';

export interface Trig {
  kind: TriggerKind;
  /** number of the log entry that raised it */
  n: number;
  id?: string;
}

/** A card waiting for the next call that can show it. */
export interface Wait {
  kind: CardKind;
  /** when it was raised (seconds) */
  s: number;
  /** how long it may wait (seconds) */
  wait: number;
  n: number;
  id?: string;
}

/** A window (or a major omen) that holds until the last call is a card gap old (§3: the node may wait up to `stopWait`). */
export interface Hold {
  kind: 'window' | 'majorOmen';
  n: number;
  id?: string;
  until: number;
  /** the age stop this call stands in for */
  asAge?: number;
}

/** Everything the rules remember. Plain JSON: it lives in `life.ext.attention`. */
export interface Mem {
  /** log entries below this number have been read */
  mark: number;
  /** life age at birth (the age stops at or below it do not happen) */
  from: number;
  lastStop: number;
  lastCard: number;
  queue: Wait[];
  hold: Hold | null;
  /** age stops that are pulled to a window or done; an age not listed is still to come */
  ages: Record<string, 'pulled' | 'done'>;
  /** the death stop was made (near death, or at the death) */
  near: boolean;
  /** time of the last tick: a call that became legal between two ticks is dated when it became legal, not at the later tick */
  last: number;
}

export const NEVER = -1e9;

export function newMem(mark: number, from: number): Mem {
  return { mark, from, lastStop: NEVER, lastCard: NEVER, queue: [], hold: null, ages: {}, near: false, last: 0 };
}

export interface Plan {
  /** age stops of this life, in life years */
  ages: readonly number[];
  /** seconds at which the death stop is due; null when the character system does not say */
  nearAt: number | null;
  /** seconds a card of that kind may wait */
  waitOf(kind: CardKind): number;
}

export interface Src {
  n: number;
  id?: string;
}

export type Out =
  | { t: 'call'; call: 'stop' | 'card'; why: string; age: number | null; src: Src[]; cards: CardKind[]; until: number | null; sec: number }
  /** A window or major omen the game did not stop for: it glows on the life line and the player may open it. */
  | { t: 'glow'; n: number; id?: string; why: 'setting' | 'joined' | 'death' | 'gap' | 'late' }
  /** A card that came too late: the character acted alone and the log tells it. */
  | { t: 'missed'; kind: CardKind; n: number; id?: string; waited: number };

const secOf = (age: number): number => age * SEC_PER_YEAR;
const lastCall = (m: Mem): number => Math.max(m.lastStop, m.lastCard);

/** Age stops of a life that starts at `from`. */
export function agesOf(stops: readonly number[], from: number): number[] {
  return stops.filter((a) => a > from);
}

export interface TickOpts {
  /** the character dies now: windows only glow, nothing is held */
  dying?: boolean;
}

/** One step of the rules at time `now`. Order: new triggers, the fixed stops that are due, the held window, the waiting cards. */
export function tick(m: Mem, rule: AttentionRule, plan: Plan, now: number, trigs: readonly Trig[], out: Out[], opts: TickOpts = {}): void {
  const age = (a: number) => m.ages[String(a)];
  const setAge = (a: number, v: 'pulled' | 'done' | undefined) => {
    if (v) m.ages[String(a)] = v;
    else delete m.ages[String(a)];
  };
  const deathSoon = () => !m.near && plan.nearAt !== null && plan.nearAt - now >= 0 && plan.nearAt - now < rule.cardGap;

  const stopComing = () => plan.ages.some((a) => !age(a) && secOf(a) >= now && secOf(a) - now < rule.cardGap);
  const missed = (c: Wait, at = now) => out.push({ t: 'missed', kind: c.kind, n: c.n, id: c.id, waited: Math.round(at - c.s) });
  /** A stop shows every card that waits (07-attention.md §1 rule 4: the panel holds all of them, also one that was held back for it). */
  const stop = (why: string, ageStop: number | null, own: Src[], at = now) => {
    m.queue.sort((a, b) => a.s + a.wait - (b.s + b.wait));
    const shown = m.queue;
    m.queue = [];
    out.push({ t: 'call', call: 'stop', why, age: ageStop, src: [...own, ...shown.map((c) => ({ n: c.n, id: c.id }))], cards: shown.map((c) => c.kind), until: null, sec: Math.round(at) });
    m.lastStop = at;
  };

  const queueCard = (kind: CardKind, e: Src) => m.queue.push({ kind, s: now, wait: plan.waitOf(kind), n: e.n, id: e.id });

  // ---- 1. new triggers ----
  for (const e of trigs) {
    if (e.kind === 'window' || e.kind === 'majorOmen') {
      // a window up to one stop gap before an age stop pulls the age stop to it: the two are one stop
      const pulled = plan.ages.find((a) => !age(a) && secOf(a) - now >= 0 && secOf(a) - now <= rule.stopGap);
      if (pulled !== undefined && !opts.dying) {
        if (m.hold?.asAge !== undefined) setAge(m.hold.asAge, undefined);
        setAge(pulled, 'pulled');
        m.hold = { kind: e.kind, n: e.n, id: e.id, until: now + rule.stopWait, asAge: pulled };
        continue;
      }
      if (rule.windows === false && e.kind === 'window') {
        out.push({ t: 'glow', n: e.n, id: e.id, why: 'setting' });
        continue;
      }
      // up to `merge` after an age stop the window joins that stop; just before the death scene it only glows
      if (plan.ages.some((a) => now - secOf(a) > 0 && now - secOf(a) <= rule.merge)) {
        out.push({ t: 'glow', n: e.n, id: e.id, why: 'joined' });
        continue;
      }
      if (opts.dying || deathSoon()) {
        out.push({ t: 'glow', n: e.n, id: e.id, why: 'death' });
        continue;
      }
      if (now - m.lastStop >= rule.stopGap && !m.hold) {
        m.hold = { kind: e.kind, n: e.n, id: e.id, until: now + rule.stopWait };
        continue;
      }
      if (e.kind === 'majorOmen') queueCard('majorOmen', e);
      else out.push({ t: 'glow', n: e.n, id: e.id, why: 'gap' });
      continue;
    }
    if (rule.cards && !rule.cards.includes(e.kind)) continue; // this setting leaves the kind to the log
    if (e.kind === 'prayer' && m.queue.filter((q) => q.kind === 'prayer').length >= MAX_WAITING_PRAYERS) continue;
    queueCard(e.kind, e);
  }

  if (opts.dying) return;

  // ---- 2. fixed stops that are due ----
  const fixed = () => {
    const due = plan.ages.filter((a) => !age(a) && secOf(a) <= now);
    const near = !m.near && plan.nearAt !== null && plan.nearAt <= now;
    if (near) {
      for (const a of due) setAge(a, 'done');
      m.near = true;
      stop('nearDeath', due.length ? due[due.length - 1] : null, []);
    } else if (due.length) {
      for (const a of due) setAge(a, 'done');
      stop('age', due[due.length - 1], []);
    }
  };
  fixed();

  // ---- 3. the held window ----
  // a call that became legal between two ticks is dated when it did (the rules count seconds, a beat is only how often the core looks)
  const legal = (since: number) => Math.min(now, Math.max(m.last, lastCall(m) + rule.cardGap, since));
  const h = m.hold;
  if (h) {
    const when = legal(h.until - rule.stopWait);
    if (lastCall(m) + rule.cardGap <= now && when <= h.until) {
      if (h.asAge !== undefined) setAge(h.asAge, 'done');
      m.hold = null;
      stop(h.kind, h.asAge ?? null, [{ n: h.n, id: h.id }], when);
    } else if (now > h.until) {
      m.hold = null;
      if (h.asAge !== undefined) {
        setAge(h.asAge, undefined); // too late: the age stop goes back to its own time
        fixed();
      }
      if (h.kind === 'majorOmen') queueCard('majorOmen', h);
      else out.push({ t: 'glow', n: h.n, id: h.id, why: 'late' });
    }
  }

  // ---- 4. waiting cards ----
  m.queue.sort((a, b) => a.s + a.wait - (b.s + b.wait));
  if (!m.hold && !stopComing() && !deathSoon()) {
    while (m.queue.length) {
      const c = m.queue[0];
      const when = legal(c.s);
      if (lastCall(m) + rule.cardGap > now) break;
      m.queue.shift();
      if (when - c.s > c.wait) {
        missed(c, when);
        continue;
      }
      out.push({ t: 'call', call: 'card', why: c.kind, age: null, src: [{ n: c.n, id: c.id }], cards: [c.kind], until: (c.s + c.wait) / SEC_PER_YEAR, sec: Math.round(when) });
      m.lastCard = when;
    }
  }
  m.last = now;
}

/** The character dies: the death stop is made unless the scene before it already was; it shows what waits. */
export function dying(m: Mem, rule: AttentionRule, plan: Plan, now: number, trigs: readonly Trig[], out: Out[]): void {
  tick(m, rule, plan, now, trigs, out, { dying: true });
  m.hold = null;
  const shown = m.queue.sort((a, b) => a.s + a.wait - (b.s + b.wait));
  m.queue = [];
  if (!m.near) {
    m.near = true;
    out.push({ t: 'call', call: 'stop', why: 'death', age: null, src: shown.map((c) => ({ n: c.n, id: c.id })), cards: shown.map((c) => c.kind), until: null, sec: Math.round(now) });
    m.lastStop = now;
    return;
  }
  // the scene before the end was made a year ago: what has come since is moot, the log tells it
  for (const c of shown) out.push({ t: 'missed', kind: c.kind, n: c.n, id: c.id, waited: Math.round(now - c.s) });
}
