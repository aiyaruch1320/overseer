import { describe, expect, it } from 'vitest';
import { Game, type System } from '../../src/core/game';
import { write } from '../../src/core/log';
import { newGame } from '../../src/core/state';

// a toy character system: places a human and kills it at hAge 75 (world-time.md: natural death at hAge 75)
const toy: System = {
  name: 'character',
  beat(ctx) {
    const l = ctx.state.life!;
    if (l.hAge >= 75) l.dead = { year: ctx.state.clock.worldYear, hAge: l.hAge, cause: 'old' };
  },
  lifeYear(ctx) {
    if (ctx.rng('life').chance(0.5)) write(ctx.state, { sys: 'character', kind: 'year' });
  },
};
const order: string[] = [];
const spy: System = { name: 'world', worldStep: () => order.push('world'), lifeYear: () => order.push('year') };

function life(seed: number) {
  const g = new Game(newGame(seed), {}, [toy, spy]);
  g.state.life = {
    id: 'L1', name: 'x', race: 'human', gender: 'm', birthYear: 0, lifespan: 75, hAge: 0, country: 'AL-01', home: 'AL-01',
    traits: [], aptitudes: {}, skills: [], blessings: [], curses: [], fate: [], cls: 'c3', gold: 0,
    stats: { pow: 0, mag: 0, spd: 0, luk: 0, int: 0, vit: 0 }, items: [], flags: [], passed: {}, pending: [], memory: [], godFaith: 0, heart: 0, ext: {},
  };
  g.born();
  g.runLife();
  return g.state;
}

describe('loop', () => {
  it('a human lives 75 life years = 75 world years and gets 7 world steps', () => {
    order.length = 0;
    const s = life(1);
    expect(s.life!.dead!.hAge).toBe(75);
    expect(s.clock.worldYear).toBe(75);
    expect(order.filter((x) => x === 'world').length).toBe(7);
  });
  it('the same seed gives the same log', () => {
    expect(JSON.stringify(life(9).log)).toBe(JSON.stringify(life(9).log));
    expect(JSON.stringify(life(9).log)).not.toBe(JSON.stringify(life(10).log));
  });
});
