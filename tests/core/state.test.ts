import { describe, expect, it } from 'vitest';
import { beat, newClock, worldYearsPerLifeYear } from '../../src/core/clock';
import { since, write } from '../../src/core/log';
import { clone, load, save } from '../../src/core/save';
import { newGame } from '../../src/core/state';

describe('state, save and log', () => {
  it('a new game is plain JSON and round-trips through a save', () => {
    const g = newGame(42, { 'storylines.json': 'abc' });
    write(g, { sys: 'test', kind: 'hello', data: { x: 1 } });
    const back = load(save(g), { 'storylines.json': 'abc' });
    expect(back.state).toEqual(g);
    expect(back.stale).toEqual([]);
    expect(clone(g)).toEqual(g);
  });
  it('a save made with other data versions is flagged', () => {
    const g = newGame(1, { 'storylines.json': 'old' });
    expect(load(save(g), { 'storylines.json': 'new' }).stale).toEqual(['storylines.json']);
  });
  it('log entries are numbered and since() returns the tail', () => {
    const g = newGame(1);
    write(g, { sys: 's', kind: 'a' });
    const mark = g.logN;
    write(g, { sys: 's', kind: 'b' });
    write(g, { sys: 's', kind: 'c' });
    expect(since(g, mark).map((e) => e.kind)).toEqual(['b', 'c']);
  });
});

describe('clocks', () => {
  it('a human life year is lifespan ÷ 75 world years; late wakers use ÷ 58', () => {
    expect(worldYearsPerLifeYear(75)).toBe(1);
    expect(worldYearsPerLifeYear(58, 'mummy')).toBe(1);
  });
  it('four beats make a life year and world steps fire every ten world years', () => {
    const c = newClock(0);
    let steps = 0;
    let years = 0;
    for (let i = 0; i < 4 * 30; i++) {
      const r = beat(c, 3.2 / 4);
      steps += r.worldSteps;
      if (r.lifeYearDone) years++;
    }
    expect(years).toBe(30);
    expect(c.worldYear).toBe(96);
    expect(steps).toBe(9);
  });
});
