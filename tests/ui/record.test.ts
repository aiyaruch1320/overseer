// The play record (src/app/record.ts, record-facts.ts) and the A/B of the director (src/app/ab.ts): the record is local and opt-in, it notes what the player did and
// what the game called, it never keeps typed words, and the arm of a life follows the mode. `localStorage` is a stand-in.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { armFor, setAbMode } from '../../src/app/ab';
import { RECORD_KEY, Recorder, plainArgs, recorder, type PlayRecord } from '../../src/app/record';
import { Tally } from '../../src/app/record-facts';
import { GameStore } from '../../src/app/store';
import type { GameData } from '../../src/core/game';
import { runLifeReport } from '../../scripts/tools/life-run';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

class FakeStorage {
  items = new Map<string, string>();
  getItem = (k: string) => this.items.get(k) ?? null;
  removeItem = (k: string) => void this.items.delete(k);
  setItem = (k: string, v: string) => void this.items.set(k, v);
}

let ls: FakeStorage;
beforeEach(() => {
  ls = new FakeStorage();
  (globalThis as { localStorage?: unknown }).localStorage = ls;
});
afterEach(() => {
  recorder.setOn(false);
  recorder.clear();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('A/B arms', () => {
  it('off gives no arm; alternate takes turns by life; seed follows the parity', () => {
    expect(armFor('off', 2, 1)).toBeNull();
    expect([1, 2, 3, 4].map((n) => armFor('alternate', 2, n))).toEqual(['on', 'off', 'on', 'off']);
    expect([1, 2, 3, 4].map((n) => armFor('alternate', 3, n))).toEqual(['off', 'on', 'off', 'on']);
    expect([1, 2, 3].map((n) => armFor('seed', 4, n))).toEqual(['on', 'on', 'on']);
    expect(armFor('seed', 5, 2)).toBe('off');
  });
});

describe('Tally on a simulated life', () => {
  it('reads one life: a start, the facts, an end with the counts of the nodes', () => {
    const run = runLifeReport(data, { seed: 3, policy: 'เมตตา' });
    const t = new Tally({ actsFromLog: true });
    t.ingest(run.state.log);
    const start = t.events.filter((e) => e.k === 'life.start');
    const end = t.events.filter((e) => e.k === 'life.end');
    expect(start).toHaveLength(1);
    expect(end).toHaveLength(1);
    expect(end[0].nodes).toBeGreaterThan(0);
    expect(t.events.some((e) => e.k === 'vow.take')).toBe(true);
    // a second read of the same log adds nothing
    expect(t.ingest(run.state.log)).toHaveLength(0);
  });
});

describe('the recorder', () => {
  it('does nothing until the tester switches it on, then keeps and exports a record', () => {
    const r = new Recorder();
    r.note('x');
    expect(r.size.value).toBe(0);
    r.setOn(true);
    r.act('whisper', true, { hint: 'ระวัง', free: 'has a space', target: 'AL-01' });
    r.flush();
    const rec = JSON.parse(r.text()) as PlayRecord;
    expect(rec.format).toBe('overseer.record');
    const act = rec.events.find((e) => e.k === 'act');
    expect(act?.args).toEqual({ hint: 'ระวัง', target: 'AL-01' });
    expect(ls.items.get(RECORD_KEY)).toBeTruthy();
    r.clear();
    expect(r.size.value).toBe(0);
  });

  it('keeps no free text in the args', () => {
    expect(plainArgs({ a: 1, b: true, c: 'two words', d: 'x'.repeat(50), e: 'ok' })).toEqual({ a: 1, b: true, e: 'ok' });
  });

  it('records a session of the store: lives, calls, the arm, the commands', () => {
    recorder.setOn(true);
    setAbMode('alternate');
    const store = new GameStore();
    store.setData(data);
    store.newLife({ seed: 4 });
    // a seed with an even number: the first life takes the director on
    expect(store.state?.settings.llm.director).toBe(true);
    for (let i = 0; i < 4 * 90 && store.state?.life && !store.state.life.dead; i++) {
      store.step();
      if (store.phase.value === 'stop') store.resume();
    }
    store.god('whisper', { hint: 'ระวัง' }, false);
    store.god('whisper', { hint: 'ระวัง' }, true);
    const rec = JSON.parse(recorder.text()) as PlayRecord;
    const kinds = new Set(rec.events.map((e) => e.k));
    for (const k of ['game.new', 'life.start', 'call', 'act', 'clock']) expect(kinds.has(k), k).toBe(true);
    const start = rec.events.find((e) => e.k === 'life.start');
    expect(start?.arm).toBe('on');
    expect(start?.llm).toBeTruthy();
    // a preview is not an act
    expect(rec.events.filter((e) => e.k === 'act')).toHaveLength(1);
    setAbMode('off');
  });

  it('a record switched on after the life began starts that life at once, marked partial, and ends it at the death', () => {
    const store = new GameStore();
    store.setData(data);
    store.newLife({ seed: 4 });
    for (let i = 0; i < 40; i++) store.step();
    expect(recorder.on.value).toBe(false);
    recorder.setOn(true);
    expect(recorder.lives.value).toBe(1);
    let rec = JSON.parse(recorder.text()) as PlayRecord;
    const start = rec.events.find((e) => e.k === 'life.start');
    expect(start).toMatchObject({ life: 1, partial: true, race: store.state!.life!.race });
    for (let i = 0; i < 4 * 400 && store.state?.life && !store.state.life.dead; i++) {
      store.step();
      if (store.phase.value === 'stop') store.resume();
    }
    rec = JSON.parse(recorder.text()) as PlayRecord;
    expect(rec.events.find((e) => e.k === 'life.end')).toMatchObject({ life: 1, partial: true });
    // the log of the life is not read again as a new birth
    expect(rec.events.filter((e) => e.k === 'life.start')).toHaveLength(1);
  });

  it('the A/B mode stays set for the next world of the page', () => {
    setAbMode('alternate');
    const store = new GameStore();
    store.setData(data);
    store.newLife({ seed: 4 });
    expect(store.currentArm()).toBe('on');
    store.newLife({ seed: 5 });
    // an odd seed starts on the arm off (alternate follows the parity of the seed so testers start on both arms evenly)
    expect(store.currentArm()).toBe('off');
    store.newLife({ seed: 6 });
    expect(store.currentArm()).toBe('on');
    setAbMode('off');
  });

  it('keeps the changes the page makes itself out of the record, and gives each life one start marker', () => {
    // the store first: the recorder joins the life of the store made last (`attach`), and an older one would leave a stale partial life in the record
    const store = new GameStore();
    store.setData(data);
    recorder.setOn(true);
    store.newLife({ seed: 4 });
    store.setSettings({ speed: 'normal' }, 'auto');
    store.setSettings({ speed: 'fast' });
    const rec = JSON.parse(recorder.text()) as PlayRecord;
    expect(rec.events.filter((e) => e.k === 'settings' && e.source === 'auto')).toHaveLength(0);
    expect(rec.events.filter((e) => e.k === 'settings' && e.source === 'player')).toHaveLength(1);
    expect(rec.events.find((e) => e.k === 'game.new')?.life).toBe(1);
    expect(rec.events.find((e) => e.k === 'life.start')?.life).toBe(1);
  });
});
