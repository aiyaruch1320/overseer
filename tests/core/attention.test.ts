// The attention system (docs/systems/experience/07-attention.md): the rules of §3 on triggers made up by the test, and the same rules
// driven through the game loop by a made-up log. The five targets of §5 on real lives are in tests/balance/attention.test.ts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, runToDeath, startLife } from '../../scripts/tools/session';
import {
  DEFAULT_AGE_STOPS, DEFAULT_DEADLINES, DEFAULT_RULES, SEC_PER_YEAR, agesOf, attentionSystem, callsOf, isStop, liveCards, newMem, nextCall, sourcesOf, tick,
  type Mem, type Out, type Plan, type Trig,
} from '../../src/core/attention';
import type { AttentionData, AttentionRule } from '../../src/core/data/types-attention';
import { Game, sortSystems, type GameData, type System } from '../../src/core/game';
import { write } from '../../src/core/log';
import { newGame } from '../../src/core/state';
import type { GameState, LifeState, LogEntry, Settings } from '../../src/core/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const S = SEC_PER_YEAR;
const NORMAL = DEFAULT_RULES.normal;

// ---------- the defaults are the data ----------

describe('attention: tuning', () => {
  it('the built-in defaults hold the numbers of data/gen/attention.json', () => {
    const d = (JSON.parse(readFileSync(path.join(root, 'data/gen/attention.json'), 'utf8')) as { items: AttentionData }).items;
    expect(DEFAULT_RULES).toEqual(d.settings);
    expect(DEFAULT_DEADLINES).toEqual(d.deadlines);
    expect(DEFAULT_AGE_STOPS).toEqual(d.ageStops);
    expect(d.rule).toEqual(d.settings.normal);
    expect(S).toBeCloseTo((d.lifeMinutes.sim * 60) / d.lifeYears, 9);
  });
});

// ---------- the rules, one tick at a time ----------

const plan = (from = 0, nearAt: number | null = null): Plan => ({ ages: agesOf(DEFAULT_AGE_STOPS, from), nearAt, waitOf: (k) => DEFAULT_DEADLINES[k] * S });
let n = 100;
const trig = (kind: Trig['kind'], id = `${kind}${n}`): Trig => ({ kind, n: n++, id });

/** Runs the rules over a made-up life: `at[seconds]` lists what is raised in that tick. Ticks are every beat of a quarter life year. */
function run(rule: AttentionRule, at: Record<number, Trig[]>, p: Plan = plan(), seconds = 75 * S, step = S / 4) {
  const m = newMem(0, 0);
  const out: (Out & { at: number })[] = [];
  for (let t = 0; t <= seconds; t += step) {
    const o: Out[] = [];
    tick(m, rule, p, t, at[Math.round(t * 1000) / 1000] ?? [], o);
    out.push(...o.map((x) => ({ ...x, at: t })));
  }
  return { m, out };
}
const calls = (out: (Out & { at: number })[]) => out.filter((o): o is Extract<Out, { t: 'call' }> & { at: number } => o.t === 'call');
const at = (years: number) => Math.round(years * S * 1000) / 1000;

describe('attention: the call rules (07-attention.md §3)', () => {
  it('stops at the age stops 5 15 30 50 70 and at nothing else when nothing happens', () => {
    const { out } = run(NORMAL, {});
    const c = calls(out);
    expect(c.map((x) => [x.call, x.why, x.age])).toEqual(DEFAULT_AGE_STOPS.map((a) => ['stop', 'age', a]));
    expect(c.map((x) => x.at)).toEqual(DEFAULT_AGE_STOPS.map((a) => a * S));
  });

  it('a life born at 17 has only the age stops after 17', () => {
    const { out } = run(NORMAL, {}, plan(17));
    expect(calls(out).map((x) => x.age)).toEqual([30, 50, 70]);
  });

  it('two windows closer than the stop gap: the second only glows on the life line', () => {
    const a = trig('window'), b = trig('window');
    const { out } = run(NORMAL, { [at(22)]: [a], [at(22.5)]: [b] }); // 14 seconds apart, no age stop near
    const stops = calls(out).filter((x) => x.why === 'window');
    expect(stops.map((x) => x.src[0].n)).toEqual([a.n]);
    expect(out.filter((o) => o.t === 'glow')).toEqual([expect.objectContaining({ n: b.n, why: 'gap' })]);
  });

  it('a window up to a stop gap before an age stop stands in for it: one stop, not two', () => {
    const w = trig('window');
    const { out } = run(NORMAL, { [at(27)]: [w] }); // 84 seconds before age 30
    const c = calls(out).filter((x) => x.age === 30 || x.src.some((s) => s.n === w.n));
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ call: 'stop', why: 'window', age: 30 });
    expect(c[0].at).toBeCloseTo(27 * S, 6);
  });

  it('a window up to the merge time after an age stop joins it (glows, no second stop)', () => {
    const w = trig('window');
    const { out } = run(NORMAL, { [at(30.75)]: [w] }); // 21 seconds after age 30
    expect(calls(out).filter((x) => x.at > 30 * S && x.at < 40 * S)).toHaveLength(0);
    expect(out).toContainEqual(expect.objectContaining({ t: 'glow', n: w.n, why: 'joined' }));
  });

  it('a window that cannot be shown within the wait glows, and the age stop it stood in for goes back to its time', () => {
    const w = trig('window');
    // two age stops 56 seconds apart; the window comes 42 seconds after the first, and the call gap (100) outlasts the wait (20)
    const p: Plan = { ...plan(), ages: [10, 12] };
    const rule: AttentionRule = { ...NORMAL, cardGap: 100, stopWait: 20 };
    const { out } = run(rule, { [at(11.5)]: [w] }, p);
    expect(out).toContainEqual(expect.objectContaining({ t: 'glow', n: w.n, why: 'late' }));
    const age12 = calls(out).filter((x) => x.age === 12);
    expect(age12).toHaveLength(1);
    expect(age12[0].why).toBe('age');
  });

  it('cards are at least a card gap apart, and the one that waits shows when the gap is over', () => {
    const a = trig('omen'), b = trig('omen');
    const { out } = run(NORMAL, { [at(20)]: [a], [at(20.25)]: [b] });
    const cards = calls(out).filter((x) => x.call === 'card');
    expect(cards).toHaveLength(2);
    expect(cards[1].at - cards[0].at).toBeGreaterThanOrEqual(NORMAL.cardGap);
    expect(cards[0].src[0].n).toBe(a.n);
  });

  it('the card that runs out of time before it can show becomes a missed line', () => {
    const rule = { ...NORMAL, cardGap: 100 };
    const a = trig('battle'), b = trig('battle'); // a battle card waits one life year (28 s)
    const { out } = run(rule, { [at(22)]: [a], [at(22.25)]: [b] });
    expect(calls(out).filter((x) => x.call === 'card')).toHaveLength(1);
    expect(out).toContainEqual(expect.objectContaining({ t: 'missed', kind: 'battle', n: b.n }));
  });

  it('a card that would show just before an age stop waits and is folded into the stop panel', () => {
    const p = trig('omen');
    const { out } = run(NORMAL, { [at(29.5)]: [p] });
    const stop = calls(out).find((x) => x.age === 30)!;
    expect(stop.call).toBe('stop');
    expect(stop.cards).toEqual(['omen']);
    expect(stop.src.map((s) => s.n)).toContain(p.n);
    expect(calls(out).filter((x) => x.call === 'card')).toHaveLength(0);
  });

  it('prayers wait two at most; the third does not happen', () => {
    const ps = [trig('prayer'), trig('prayer'), trig('prayer')];
    const m = newMem(0, 0);
    m.ages = { '5': 'done', '15': 'done' };
    const o: Out[] = [];
    tick(m, { ...NORMAL, cardGap: 9999 }, plan(), 20 * S, ps, o);
    expect(m.queue.filter((c) => c.kind === 'prayer')).toHaveLength(2);
  });

  it('a stop shows every card that waits, the one that runs out first at the top, also one held back for it past its time', () => {
    const rule = { ...NORMAL, cardGap: 9999 };
    const old = trig('battle'), omen = trig('omen'), pr = trig('prayer');
    const { out } = run(rule, { [at(28)]: [old, omen, pr] });
    const stop = calls(out).find((x) => x.age === 30)!;
    expect(stop.cards).toEqual(['battle', 'omen', 'prayer']); // a battle runs out in 1 year, an omen in 2, a prayer in 3.5
  });

  it('the death stop: nearDeath once, at the time the plan says, and it takes the age stop that falls on it', () => {
    const { out } = run(NORMAL, {}, plan(0, 70 * S));
    const c = calls(out);
    expect(c.filter((x) => x.why === 'nearDeath')).toHaveLength(1);
    expect(c.filter((x) => x.age === 70)).toHaveLength(1); // one stop for age 70 and the death scene
  });

  it('a window just before the death scene only glows', () => {
    const w = trig('window');
    const { out } = run(NORMAL, { [at(73.5)]: [w] }, plan(0, 74 * S));
    expect(out).toContainEqual(expect.objectContaining({ t: 'glow', n: w.n, why: 'death' }));
  });

  it('the setting low leaves windows to the life line and keeps only the cards it lists', () => {
    const w = trig('window'), omen = trig('omen'), pr = trig('prayer');
    const { out } = run(DEFAULT_RULES.low, { [at(19)]: [w, omen, pr] });
    expect(out).toContainEqual(expect.objectContaining({ t: 'glow', n: w.n, why: 'setting' }));
    expect(calls(out).filter((x) => x.call === 'card').map((x) => x.why)).toEqual(['prayer']);
  });

  it('a major omen is a stop when the gap allows and a card when it does not', () => {
    const a = trig('majorOmen'), b = trig('majorOmen');
    const { out } = run({ ...NORMAL, cardGap: 20 }, { [at(22)]: [a], [at(23)]: [b] }); // a card gap shorter than the omen's one life year of waiting
    const c = calls(out).filter((x) => x.why === 'majorOmen');
    expect(c.map((x) => x.call)).toEqual(['stop', 'card']);
  });
});

// ---------- the system in the game loop ----------

interface Mock {
  age: number;
  q?: number;
  sys: string;
  kind: string;
  id: string;
  level: LogEntry['level'];
  data?: LogEntry['data'];
}

const ENEMIES = { enemies: { version: 't', items: { items: [{ id: 'boss1', tier: 'บอส' }] } } };

const blank = (): LifeState => ({
  id: 'L1', name: 'x', race: 'human', gender: 'm', birthYear: 0, lifespan: 75, hAge: 0, country: 'AL-01', home: 'AL-01',
  traits: [], aptitudes: {}, skills: [], blessings: [], curses: [], fate: [], cls: 'c3', gold: 0,
  stats: { pow: 0, mag: 0, spd: 0, luk: 0, int: 0, vit: 0 }, items: [], flags: [], passed: {}, pending: [], memory: [], godFaith: 0, heart: 0, ext: {},
});

/** A life with a made-up log: the character dies at `deathAge`; `mocks` are written by a system named `story` at their age and quarter. */
function mockGame(mocks: Mock[], opts: { seed?: number; deathAge?: number; announce?: boolean; attention?: Settings['attention']; data?: GameData } = {}): Game {
  const deathAge = opts.deathAge ?? 75;
  const character: System = {
    name: 'character',
    beat(ctx) {
      const l = ctx.state.life!;
      if (l.hAge >= deathAge) l.dead = { year: ctx.state.clock.worldYear, hAge: l.hAge, cause: 'old' };
    },
  };
  const source: System = {
    name: 'story',
    beat(ctx) {
      const l = ctx.state.life!;
      for (const m of mocks) if (m.age === l.hAge && (m.q ?? 0) === ctx.state.clock.quarter) write(ctx.state, { sys: m.sys, kind: m.kind, id: m.id, data: m.data ?? {}, level: m.level });
    },
  };
  const g = new Game(newGame(opts.seed ?? 1), opts.data ?? ENEMIES, [character, source, attentionSystem]);
  if (opts.attention) g.state.settings.attention = opts.attention;
  g.state.life = blank();
  if (opts.announce) g.state.life.ext.character = { deathAge };
  g.born();
  return g;
}

const win = (age: number, id = `w${age}`): Mock => ({ age, sys: 'story', kind: 'node', id, level: 3 });
const pray = (age: number, q = 0): Mock => ({ age, q, sys: 'god', kind: 'prayer', id: `p${age}.${q}`, level: 2 });
const omen = (age: number, id = `o${age}`): Mock => ({ age, sys: 'world', kind: 'event', id, level: 2, data: { mark: '⭐', name: id } });

/** A dense made-up life: windows every few years, a prayer most years, omens and battles between. */
function busy(): Mock[] {
  const m: Mock[] = [];
  for (let a = 3; a < 75; a += 3) m.push(win(a, `w${a}`));
  for (let a = 4; a < 75; a += 3) m.push(pray(a, a % 4));
  for (let a = 6; a < 70; a += 9) m.push({ age: a, sys: 'story', kind: 'battle', id: 'boss1', level: 2 });
  for (let a = 8; a < 70; a += 11) m.push(omen(a));
  return m;
}

const callLog = (g: Game) => callsOf(g.state.log);
const secOf = (e: LogEntry) => e.data.sec as number;
const all = (g: Game) => {
  g.runLife();
  return g;
};

describe('attention: the system on a made-up log', () => {
  it('a life with nothing in it stops at 5 15 30 50 70 and at the death, once each', () => {
    const g = all(mockGame([]));
    const c = callLog(g);
    expect(c.map((e) => [e.data.why, e.data.age])).toEqual([...DEFAULT_AGE_STOPS.map((a) => ['age', a]), ['death', null]]);
    expect(c.every((e) => e.level === 3 && e.sys === 'attention' && e.data.call === 'stop')).toBe(true);
    expect(c.map(secOf)).toEqual([...DEFAULT_AGE_STOPS, 75].map((a) => Math.round(a * S)));
  });

  it('with the age the character system gives, the death scene opens a year before and the death makes no second stop', () => {
    const g = all(mockGame([], { deathAge: 75, announce: true }));
    const c = callLog(g);
    expect(c.filter((e) => e.data.why === 'nearDeath').map((e) => Math.round(secOf(e) / S))).toEqual([74]);
    expect(c.filter((e) => e.data.why === 'death')).toHaveLength(0);
    expect(c.filter((e) => e.data.call === 'stop')).toHaveLength(6);
  });

  it('a character who dies early (untimely) still gets the death stop, with the cards that waited', () => {
    const g = all(mockGame([pray(40, 2), pray(41, 0)], { deathAge: 41 }));
    const last = callLog(g).at(-1)!;
    expect(last.data.why).toBe('death');
    expect(last.data.call).toBe('stop');
    expect(last.data.cards).toBe('prayer');
  });

  it('writes the call with what it stands for: the entry numbers of the trigger and of the cards folded in', () => {
    const g = all(mockGame([pray(28, 3), win(29, 'hu.a2')]));
    const stop = callLog(g).find((e) => e.data.why === 'window')!;
    expect(stop.id).toBe('hu.a2');
    expect(stop.data).toMatchObject({ call: 'stop', age: 30, cards: 'prayer' });
    const src = sourcesOf(stop);
    const named = g.state.log.filter((e) => src.includes(e.n)).map((e) => e.id);
    expect(named.sort()).toEqual(['hu.a2', 'p28.3'].sort());
  });

  it('the same seed calls the same way', () => {
    const run = () => callLog(all(mockGame(busy(), { seed: 7 }))).map((e) => JSON.stringify([e.n, e.age, e.quarter, e.data]));
    expect(run()).toEqual(run());
    expect(run().length).toBeGreaterThan(10);
  });

  it('with data/gen/attention.json loaded it calls exactly as with the built-in numbers', () => {
    const file = JSON.parse(readFileSync(path.join(root, 'data/gen/attention.json'), 'utf8')) as { version: string; items: unknown };
    const key = (g: Game) => callLog(g).map((e) => JSON.stringify([e.age, e.quarter, e.data]));
    for (const setting of ['low', 'normal', 'high'] as const) {
      const a = key(all(mockGame(busy(), { attention: setting })));
      const b = key(all(mockGame(busy(), { attention: setting, data: { ...ENEMIES, attention: file } })));
      expect(b).toEqual(a);
    }
  });

  it('the three settings call less and more in the right direction', () => {
    const count = (s: Settings['attention']) => {
      const c = callLog(all(mockGame(busy(), { attention: s })));
      return { stops: c.filter(isStop).length, cards: c.filter((e) => !isStop(e)).length, total: c.length };
    };
    const low = count('low'), normal = count('normal'), high = count('high');
    expect(low.total).toBeLessThan(normal.total);
    expect(normal.total).toBeLessThan(high.total);
    expect(low.stops).toBeLessThanOrEqual(normal.stops);
    expect(normal.stops).toBeLessThanOrEqual(high.stops);
    expect(low.cards).toBeLessThan(normal.cards);
    expect(normal.cards).toBeLessThan(high.cards);
    // low stops for the age stops and the death only
    expect(low.stops).toBe(6);
  });

  it('a change of setting counts from the next call', () => {
    const g = mockGame(busy());
    const half = 35 * 4;
    for (let i = 0; i < half; i++) g.beat();
    const before = callLog(g).length;
    g.state.settings.attention = 'low';
    g.runLife();
    const after = callLog(g).slice(before);
    expect(after.filter((e) => !isStop(e)).every((e) => ['prayer', 'crisis', 'majorOmen'].includes(String(e.data.why)))).toBe(true);
    expect(before).toBeGreaterThan(5);
  });

  it('nothing goes missing: every trigger ends in a call, a glow, a missed line, or the setting that leaves it to the log', () => {
    const g = all(mockGame(busy()));
    const raised = g.state.log.filter((e) => ['story', 'world', 'god'].includes(e.sys)).map((e) => e.n);
    const told = new Set<number>();
    for (const e of g.state.log) {
      if (e.sys !== 'attention') continue;
      if (e.kind === 'call') sourcesOf(e).forEach((x) => told.add(x));
      else told.add(e.data.n as number);
    }
    const lost = raised.filter((x) => !told.has(x));
    expect(lost).toEqual([]);
  });

  it('no silence longer than the rules allow: a call at least every cardGap + the longest hold while anything waits', () => {
    // a card every two life years (56 s): between two calls never more than 6 minutes, also over the age stops and the end
    const m: Mock[] = [];
    for (let a = 1; a < 75; a += 2) m.push(pray(a));
    const g = all(mockGame(m));
    const secs = [0, ...callLog(g).map(secOf), 75 * S];
    const gaps = secs.slice(1).map((s, i) => s - secs[i]);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(6 * 60);
    // and without any card the age stops alone leave the longest silence the doc's own schedule gives: 50 to 70 is 560 seconds
    const none = [0, ...callLog(all(mockGame([]))).map(secOf)];
    expect(Math.max(...none.slice(1).map((s, i) => s - none[i]))).toBe(Math.round(20 * S));
  });

  it('a window stops only when the last stop is a stop gap old; the stops that stand in for an age stop and the death are exempt', () => {
    const g = all(mockGame(busy()));
    const stops = callLog(g).filter(isStop);
    let checked = 0;
    stops.forEach((s, i) => {
      if (i === 0 || s.data.age !== null || ['age', 'nearDeath', 'death'].includes(String(s.data.why))) return;
      expect(secOf(s) - secOf(stops[i - 1])).toBeGreaterThanOrEqual(NORMAL.stopGap);
      checked++;
    });
    expect(checked).toBeGreaterThan(3);
  });

  it('cards that are on screen: at most two, the most urgent first, not after a stop', () => {
    const g = mockGame([pray(10), pray(10, 1), omen(11)], { attention: 'high' });
    for (let i = 0; i < 4 * 12 + 2; i++) g.beat();
    const live = liveCards(g.state);
    expect(live.length).toBeLessThanOrEqual(2);
    const untils = live.map((e) => e.data.until as number);
    expect([...untils].sort((a, b) => a - b)).toEqual(untils);
  });
});

describe('attention: nextCall for the tools', () => {
  it('walks from call to call and ends at the death stop', () => {
    const g = mockGame(busy());
    const seen: LogEntry[] = [];
    for (let i = 0; i < 200; i++) {
      const r = nextCall(g);
      seen.push(...r.calls);
      if (r.stoppedBy !== 'call') {
        expect(r.stoppedBy).toBe('death');
        break;
      }
    }
    expect(seen.map((e) => e.n)).toEqual(callLog(g).map((e) => e.n));
    expect(seen.at(-1)!.data.why).toBe('death');
  });

  it('stopsOnly passes the cards by', () => {
    const g = mockGame(busy());
    const r = nextCall(g, { stopsOnly: true });
    expect(r.calls.every(isStop)).toBe(true);
    expect(r.calls[0].data.age).toBe(5);
  });

  it('gives up at the limit', () => {
    const g = mockGame([]);
    expect(nextCall(g, { max: 3 })).toMatchObject({ beats: 3, stoppedBy: 'limit', calls: [] });
  });
});

describe('attention: reads the log of the real systems', () => {
  it('a story node with a window is a window; one without is nothing', () => {
    const g = mockGame([win(22, 'a'), { age: 23, sys: 'story', kind: 'node', id: 'b', level: 1 }]);
    g.runLife();
    const srcIds = callLog(g).flatMap((e) => String(e.data.ids).split(','));
    expect(srcIds).toContain('a');
    expect(srcIds).not.toContain('b');
    expect(g.state.log.some((e) => e.sys === 'attention' && e.kind === 'glow' && e.id === 'b')).toBe(false);
  });

  it('a world omen counts only when its mark is ⭐ or ● (a ○ event is trace)', () => {
    const g = mockGame([{ age: 20, sys: 'world', kind: 'event', id: 'x', level: 0, data: { mark: '○', name: 'x' } }, omen(25, 'y')]);
    g.runLife();
    const ids = callLog(g).flatMap((e) => String(e.data.ids).split(','));
    expect(ids).toContain('y');
    expect(ids).not.toContain('x');
  });
});

describe('attention: on a real life of the core', () => {
  let loaded: GameData;
  beforeAll(() => {
    loaded = loadAll();
  });
  const real = (seed: number, setting: Settings['attention'] = 'normal') => {
    const s = createSession(loaded, { seed });
    const g = s.game;
    g.systems.splice(0, g.systems.length, ...sortSystems([...g.systems.filter((x) => x.name !== 'attention'), attentionSystem]));
    g.state.settings.attention = setting;
    startLife(s);
    runToDeath(g);
    return g;
  };

  it('the same seed calls the same way, another seed another way', () => {
    const key = (g: Game) => callLog(g).map((e) => JSON.stringify([e.age, e.quarter, e.id, e.data]));
    expect(key(real(3))).toEqual(key(real(3)));
    expect(key(real(3))).not.toEqual(key(real(4)));
  });

  it('every call points at entries that exist, the age stops come in order and the death ends the calls', () => {
    const g = real(5);
    const c = callLog(g);
    const ns = new Set(g.state.log.map((e) => e.n));
    for (const e of c) for (const n of sourcesOf(e)) expect(ns.has(n)).toBe(true);
    const ages = c.filter((e) => e.data.age !== null).map((e) => e.data.age as number);
    expect([...ages].sort((a, b) => a - b)).toEqual(ages);
    expect(ages.every((a) => DEFAULT_AGE_STOPS.includes(a))).toBe(true);
    const last = c.at(-1)!;
    expect(['death', 'nearDeath']).toContain(last.data.why);
    expect(c.filter((e) => e.data.why === 'death' || e.data.why === 'nearDeath')).toHaveLength(1);
  });

  it('the three settings call least, more, most on the same life (the lives do not change with the calls)', () => {
    const n = (s: Settings['attention']) => callLog(real(8, s)).length;
    expect(n('low')).toBeLessThan(n('normal'));
    expect(n('normal')).toBeLessThanOrEqual(n('high'));
  });
});
