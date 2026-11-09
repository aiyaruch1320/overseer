// M5 review S6: a card leaves the screen when its matter is over; a third card waits for a place; a named fight and a crisis wait for their card
// (07-attention.md §2 "การ์ด", §3 "ลำดับการ์ดที่รอ"). Unit tests on a made-up log, then real lives.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, runToDeath, startLife } from '../../scripts/tools/session';
import {
  CARD_MIN_SEC, CARD_MIN_YEARS, DEFAULT_AGE_STOPS, DEFAULT_DEADLINES, FAST_SPEED_MUL, DEFAULT_RULES, SEC_PER_YEAR, agesOf, attentionSystem, callsOf, closed, liveCards, newMem, settled, sourcesOf, tick,
  type Out, type Plan,
} from '../../src/core/attention';
import { addTie, bondsSystem, extOf, type Tie } from '../../src/core/bonds';
import { arcsYear } from '../../src/core/bonds/arcs';
import { godActsSystem } from '../../src/core/god/acts';
import { sortSystems, type Ctx, type GameData, type System } from '../../src/core/game';
import { ready } from '../../src/core/combat/launch';
import { callReason } from '../../src/core/text';
import { SPEED_MUL } from '../../src/app/tuning';
import { write } from '../../src/core/log';
import { newGame } from '../../src/core/state';
import type { GameState, LifeState, LogEntry } from '../../src/core/types';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

const S = SEC_PER_YEAR;

function life(over: Partial<LifeState> = {}): LifeState {
  return {
    id: 'L1', name: 'x', race: 'human', gender: 'm', birthYear: 0, lifespan: 75, hAge: 8, country: 'AL-01', home: 'AL-01',
    traits: [], aptitudes: {}, skills: [], blessings: [], curses: [], fate: [], cls: 'c3', gold: 0,
    stats: { pow: 0, mag: 0, spd: 0, luk: 0, int: 0, vit: 0 }, items: [], flags: [], passed: {}, pending: [], memory: [], godFaith: 0, heart: 0, ext: {}, ...over,
  };
}

/** A state at age 8 whose log holds a source entry and the call (a card) that stands for it. */
function withCard(why: 'prayer' | 'battle' | 'crisis' | 'omen', src: Parameters<typeof write>[1], until = 10) {
  const st: GameState = newGame(1);
  st.life = life();
  st.life.ext.attention = newMem(0, 0);
  const e = write(st, { ...src, level: 2 });
  const call = write(st, { sys: 'attention', kind: 'call', id: String(src.id), data: { call: 'card', why, age: null, n: String(e.n), ids: String(src.id), cards: why, until, sec: 0 }, level: 3 });
  return { st, e, call };
}

describe('a card leaves the screen when its matter is over', () => {
  it('a prayer that was answered, taken back as moot or lapsed is closed; one that waits is not', () => {
    for (const end of ['prayer.give', 'prayer.deny', 'prayer.punish', 'prayer.moot', 'prayer.lapse']) {
      const { st, e, call } = withCard('prayer', { sys: 'god', kind: 'prayer', id: 'heal', data: { n: 7 } });
      expect(liveCards(st)).toEqual([call]);
      write(st, { sys: 'god', kind: 'prayer.give', id: 'wealth', data: { n: 99 }, level: 2 }); // another prayer's answer does not close this one
      expect(closed(st, 'prayer', e.n)).toBe(false);
      write(st, { sys: 'god', kind: end, id: 'heal', data: { n: 7 }, level: 2 });
      expect(closed(st, 'prayer', e.n), end).toBe(true);
      expect(liveCards(st), end).toEqual([]);
    }
  });

  it('a prayer set to silence still waits (the card stays until it lapses)', () => {
    const { st, e } = withCard('prayer', { sys: 'god', kind: 'prayer', id: 'heal', data: { n: 7 } });
    write(st, { sys: 'god', kind: 'prayer.silent', id: 'heal', data: { n: 7 }, level: 1 });
    expect(closed(st, 'prayer', e.n)).toBe(false);
    expect(liveCards(st)).toHaveLength(1);
  });

  it('a battle is closed once it is not waiting in the queue of the fights; a crisis once it is not waiting for the answer', () => {
    const b = withCard('battle', { sys: 'combat', kind: 'prelude', id: 'lich', data: {} });
    b.st.life!.ext.combat = { pending: [{ prelude: b.e.n }] };
    expect(liveCards(b.st)).toHaveLength(1);
    b.st.life!.ext.combat = { pending: [] };
    expect(liveCards(b.st)).toEqual([]);
    const c = withCard('crisis', { sys: 'bonds', kind: 'crisis', id: 'T1', data: { tie: 'T1' } });
    c.st.life!.ext.bonds = { crises: [{ n: c.e.n }] };
    expect(liveCards(c.st)).toHaveLength(1);
    c.st.life!.ext.bonds = { crises: [] };
    expect(liveCards(c.st)).toEqual([]);
  });

  it('an omen has no answer: only its time takes it away', () => {
    const { st } = withCard('omen', { sys: 'world', kind: 'event', id: 'DR-09', data: { mark: '●' } });
    expect(liveCards(st)).toHaveLength(1);
    st.life!.hAge = 10;
    expect(liveCards(st)).toEqual([]);
  });

  it('a stale card does not take a place of the two: the new card shows', () => {
    const { st } = withCard('prayer', { sys: 'god', kind: 'prayer', id: 'heal', data: { n: 1 } }, 11);
    write(st, { sys: 'god', kind: 'prayer.give', id: 'heal', data: { n: 1 }, level: 2 });
    const o = withCard('omen', { sys: 'world', kind: 'event', id: 'A', data: {} }, 12);
    void o;
    const p = write(st, { sys: 'god', kind: 'prayer', id: 'rain', data: { n: 2 }, level: 2 });
    write(st, { sys: 'attention', kind: 'call', id: 'rain', data: { call: 'card', why: 'prayer', n: String(p.n), ids: 'rain', cards: 'prayer', until: 11.5, sec: 0 }, level: 3 });
    expect(liveCards(st).map((c) => c.id)).toEqual(['rain']);
  });
});

describe('a third card waits for a place (07-attention.md §2: two at most)', () => {
  const plan: Plan = { ages: [], nearAt: null, waitOf: (k) => DEFAULT_DEADLINES[k] * S };
  const rule = DEFAULT_RULES.normal;

  it('the card stays in the queue while two are up, shows when a place frees, and the log tells it when its time ran out waiting', () => {
    const m = newMem(0, 0);
    const out: Out[] = [];
    const t0 = 10 * S;
    tick(m, rule, plan, t0, [{ kind: 'prayer', n: 1 }], out, { slots: 0 });
    expect(out).toEqual([]);
    expect(m.queue).toHaveLength(1);
    tick(m, rule, plan, t0 + S, [], out, { slots: 0 });
    expect(out).toEqual([]);
    tick(m, rule, plan, t0 + 3 * S, [], out, { slots: 1 });
    expect(out.filter((o) => o.t === 'call')).toHaveLength(1);
    expect(m.queue).toHaveLength(0);
    // a card that waits past its time without a place is told as one that came too late
    const m2 = newMem(0, 0);
    const out2: Out[] = [];
    tick(m2, rule, plan, t0, [{ kind: 'omen', n: 2 }], out2, { slots: 0 });
    tick(m2, rule, plan, t0 + 2.5 * S, [], out2, { slots: 0 });
    expect(out2).toMatchObject([{ t: 'missed', kind: 'omen', n: 2 }]);
    expect(m2.queue).toHaveLength(0);
  });
});

describe('a call is settled for the fight and the crisis it announces', () => {
  it('a card on the screen is not settled until its time runs out or the player acts; a stop, a glow and a missed card are', () => {
    const { st, e, call } = withCard('battle', { sys: 'combat', kind: 'prelude', id: 'lich', data: {} }, 10);
    expect(settled(st, e.n)).toBe(false);
    // the god does something unrelated to the fight: a prayer answered, a chest
    write(st, { sys: 'god', kind: 'prayer.give', id: 'heal', data: { n: 1 }, level: 2 });
    expect(settled(st, e.n)).toBe(false);
    write(st, { sys: 'god', kind: 'whisper', id: 'weak_point', data: {}, level: 1 });
    expect(settled(st, e.n)).toBe(true);
    // time
    const t = withCard('battle', { sys: 'combat', kind: 'prelude', id: 'lich', data: {} }, 10);
    t.st.life!.hAge = 10;
    expect(settled(t.st, t.e.n)).toBe(true);
    // a dream told as over is not an act; a dream sent is
    const d = withCard('battle', { sys: 'combat', kind: 'prelude', id: 'lich', data: {} }, 10);
    write(d.st, { sys: 'god', kind: 'dream', id: 'node', data: { outcome: 'obey' }, level: 2 });
    expect(settled(d.st, d.e.n)).toBe(false);
    write(d.st, { sys: 'god', kind: 'dream', id: 'node', data: { choice: 'a', paid: 3 }, level: 2 });
    expect(settled(d.st, d.e.n)).toBe(true);
    // a stop that folds the fight in
    const s = withCard('battle', { sys: 'combat', kind: 'prelude', id: 'lich', data: {} }, 10);
    write(s.st, { sys: 'attention', kind: 'call', id: 'age.15', data: { call: 'stop', why: 'age', n: String(s.e.n), until: null }, level: 3 });
    expect(settled(s.st, s.e.n)).toBe(true);
    void call;
  });

  it('a life without the attention system settles at once', () => {
    const st = newGame(1);
    st.life = life();
    expect(settled(st, 0)).toBe(true);
  });
});

/** A real life with the attention system in the loop. */
function real(seed: number) {
  const s = createSession(data, { seed });
  const g = s.game;
  g.systems.splice(0, g.systems.length, ...sortSystems([...g.systems.filter((x) => x.name !== 'attention'), attentionSystem]));
  startLife(s);
  return s;
}
const ageOf = (e: LogEntry) => (e.age ?? 0) + (e.quarter ?? 0) / 4;

describe('on real lives', () => {
  it('a named fight whose card is on the screen waits for the card: the fight comes within a beat of the end of the card, or after a whisper or a dream', () => {
    let cards = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = real(seed);
      runToDeath(s.game);
      const log = s.game.state.log;
      for (const p of log.filter((e) => e.sys === 'combat' && e.kind === 'prelude')) {
        const c = callsOf(log).find((e) => e.data.call === 'card' && sourcesOf(e).includes(p.n));
        const f = log.find((e) => e.sys === 'combat' && e.kind === 'battle' && e.n > p.n && e.id === p.id);
        if (!c || !f || typeof c.data.until !== 'number') continue;
        cards++;
        // the blades meet some seasons after the call, not the beat after it (the cap PRELUDE_MAX_BEATS keeps it within the 2 years of the card)
        expect(ageOf(f) - ageOf(p), `seed ${seed} ${p.id}`).toBeGreaterThanOrEqual(1.5);
      }
    }
    expect(cards).toBeGreaterThan(5);
  });

  it('a crisis card waits for the player like a battle: it is answered when the card ran out, and at once after a whisper', () => {
    function mk(seed: number) {
      const s = createSession(data, { seed, race: 'hu', startYear: 120 });
      const list = s.game.systems as System[];
      for (const x of [bondsSystem, godActsSystem, attentionSystem]) if (!list.some((y) => y.name === x.name)) list.push(x);
      list.splice(0, list.length, ...sortSystems(list));
      s.game.state.god.light = 200;
      const l = startLife(s);
      l.hAge = 33;
      (l.ext.attention as { ages: Record<string, string> }).ages = { 5: 'done', 15: 'done', 30: 'done' }; // the age stops are behind: a stop would settle the card
      l.godFaith = 0;
      return { s, g: s.game, ctx: s.game.ctx as Ctx, life: l, e: extOf(l) };
    }
    function crisis() {
      for (let seed = 1; seed < 80; seed++) {
        const m = mk(seed);
        const t: Tie = addTie(m.ctx, m.life, { line: 'สหาย', level: 3, from: 'test', quiet: true, country: m.life.country, gap: 0, race: 'same' });
        t.rapport = false;
        t.family = false;
        t.arc = { code: 'FT-03', stage: 2, next: m.life.hAge };
        arcsYear(m.ctx, m.life, m.e);
        if (m.e.crises.length) return m;
      }
      throw new Error('no seed gave a crisis card');
    }
    const a = crisis();
    const n = a.e.crises[0].n;
    let beats = 0;
    while (a.e.crises.some((c) => c.n === n) && beats < 10) {
      a.g.beat();
      beats++;
    }
    const call = callsOf(a.g.state.log).find((e) => sourcesOf(e).includes(n));
    expect(call).toBeDefined();
    // the card is called after the beat of the announcement; the answer waits for the year of the card (CRISIS_MAX_BEATS), not for the next beat
    expect(beats).toBeGreaterThanOrEqual(4);

    const b = crisis();
    const nb = b.e.crises[0].n;
    b.g.beat();
    b.g.beat();
    expect(b.e.crises.some((c) => c.n === nb)).toBe(true);
    write(b.g.state, { sys: 'god', kind: 'whisper', id: 'help', data: {}, level: 1 });
    b.g.beat();
    expect(b.e.crises.some((c) => c.n === nb)).toBe(false);

    // F4: a card the call gap holds back until the character has answered alone is told as missed, not dropped without a word
    const c = crisis();
    const nc = c.e.crises[0].n;
    (c.life.ext.attention as { lastCard: number }).lastCard = 1e9;
    let guard = 0;
    while (c.e.crises.some((x) => x.n === nc) && guard++ < 10) c.g.beat();
    expect(callsOf(c.g.state.log).some((e) => sourcesOf(e).includes(nc))).toBe(false);
    expect(c.g.state.log.some((e) => e.sys === 'attention' && e.kind === 'missed' && e.data.n === nc && e.data.kind === 'crisis')).toBe(true);
  });
});

describe('a card stays up a readable minimum of real seconds (M5 review round two R1)', () => {
  const plan: Plan = { ages: [], nearAt: null, waitOf: (k) => DEFAULT_DEADLINES[k] * S };
  const rule = DEFAULT_RULES.normal;

  it('the floor is CARD_MIN_SEC real seconds at the fastest speed, and the app runs the same fast speed', () => {
    expect(SPEED_MUL.fast).toBe(FAST_SPEED_MUL);
    expect((CARD_MIN_YEARS * S) / FAST_SPEED_MUL).toBeCloseTo(CARD_MIN_SEC, 6);
  });

  it('a card the gap holds back until 0.3 years of its wait are left is still up for the floor, whatever its kind', () => {
    for (const kind of ['prayer', 'omen', 'battle', 'crisis'] as const) {
      const m = newMem(0, 0);
      const out: Out[] = [];
      const t0 = 10 * S;
      const wait = DEFAULT_DEADLINES[kind] * S;
      m.lastCard = t0 + wait - 0.3 * S - rule.cardGap; // the last call keeps the gap shut until 0.3 years before the card runs out
      m.last = t0;
      tick(m, rule, plan, t0, [{ kind, n: 1 }], out, { slots: 2 });
      expect(out, kind).toEqual([]);
      tick(m, rule, plan, t0 + wait - 0.3 * S, [], out, { slots: 2 });
      const call = out.find((o) => o.t === 'call');
      expect(call, kind).toBeDefined();
      if (call?.t !== 'call') continue;
      expect(call.until! - call.sec / S, kind).toBeGreaterThanOrEqual(CARD_MIN_YEARS - 0.02);
      // and in real seconds at the fastest speed, the card lasts at least the floor
      expect(((call.until! - call.sec / S) * S) / FAST_SPEED_MUL, kind).toBeGreaterThanOrEqual(CARD_MIN_SEC - 0.5);
    }
  });

  it('a card shown early keeps the wait of its kind (the floor only lifts a short one)', () => {
    const m = newMem(0, 0);
    const out: Out[] = [];
    const t0 = 10 * S;
    tick(m, rule, plan, t0, [{ kind: 'battle', n: 1 }], out, { slots: 2 });
    const call = out.find((o) => o.t === 'call');
    expect(call?.t === 'call' && call.until).toBeCloseTo(t0 / S + DEFAULT_DEADLINES.battle, 1);
  });
});

describe('the fight waits for its card (R1)', () => {
  it('past the wait cap of the fight, a card that is up still holds it until the card runs out', () => {
    const { st, e } = withCard('battle', { sys: 'combat', kind: 'prelude', id: 'lich', data: {} }, 9);
    st.life!.hAge = 8;
    const ctx = { state: st } as unknown as Ctx;
    // due long ago, the cap passed, but the card runs out at age 9
    expect(ready(ctx, { due: 2, prelude: e.n }, 40)).toBe(false);
    st.life!.hAge = 9;
    expect(ready(ctx, { due: 2, prelude: e.n }, 40)).toBe(true);
    // no card was called for it: the cap lets it go
    const lone = newGame(1);
    lone.life = life();
    lone.life.ext.attention = newMem(0, 0);
    const pn = write(lone, { sys: 'combat', kind: 'prelude', id: 'lich', data: {}, level: 2 });
    expect(ready({ state: lone } as unknown as Ctx, { due: 2, prelude: pn.n }, 40)).toBe(true);
  });
});

describe('the battle card names the foe and its tier (R1)', () => {
  it('callReason reads the foe from the prelude the call stands for', () => {
    const { st, e, call } = withCard('battle', { sys: 'combat', kind: 'prelude', id: 'lich', data: { foe: 'ลิชแห่งสุสาน', tier: 'บอส' } }, 10);
    const text = callReason(data, call, undefined, (n) => (n === e.n ? e : undefined));
    expect(text).toContain('ลิชแห่งสุสาน');
    expect(text).toContain('บอส');
    expect(text).toContain('ศึกกำลังจะมาถึง');
    void st;
  });
});
