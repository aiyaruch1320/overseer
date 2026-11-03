// M5 review S6: a stop lists only what still waits (07-attention.md §2 "หยุด").
import { describe, expect, it } from 'vitest';
import { attentionSystem, callsOf, sourcesOf } from '../../src/core/attention';
import { Game, type System } from '../../src/core/game';
import { write } from '../../src/core/log';
import { newGame } from '../../src/core/state';
import type { LifeState } from '../../src/core/types';

const blank = (): LifeState => ({
  id: 'L1', name: 'x', race: 'human', gender: 'm', birthYear: 0, lifespan: 75, hAge: 13, country: 'AL-01', home: 'AL-01',
  traits: [], aptitudes: {}, skills: [], blessings: [], curses: [], fate: [], cls: 'c3', gold: 0,
  stats: { pow: 0, mag: 0, spd: 0, luk: 0, int: 0, vit: 0 }, items: [], flags: [], passed: {}, pending: [], memory: [], godFaith: 0, heart: 0, ext: {},
});

describe('a stop lists only what still waits', () => {
  for (const end of ['prayer.give', 'prayer.lapse', 'prayer.moot']) {
    it(`a prayer that ended (${end}) while it waited for the age stop is not folded into the stop`, () => {
      const source: System = {
        name: 'story',
        beat(ctx) {
          const l = ctx.state.life!;
          if (l.hAge === 14 && ctx.state.clock.quarter === 0) {
            write(ctx.state, { sys: 'god', kind: 'prayer', id: 'heal', data: { n: 1 }, level: 2 });
            write(ctx.state, { sys: 'god', kind: 'prayer', id: 'rain', data: { n: 2 }, level: 2 });
          }
          if (l.hAge === 14 && ctx.state.clock.quarter === 1) write(ctx.state, { sys: 'god', kind: end, id: 'heal', data: { n: 1 }, level: 2 });
        },
      };
      const character: System = {
        name: 'character',
        beat(ctx) {
          const l = ctx.state.life!;
          if (l.hAge >= 20) l.dead = { year: ctx.state.clock.worldYear, hAge: l.hAge, cause: 'old' };
        },
      };
      const g = new Game(newGame(1), {}, [character, source, attentionSystem]);
      g.state.life = blank();
      g.born();
      g.runLife();
      const stop = callsOf(g.state.log).find((e) => e.data.why === 'age' && e.data.age === 15)!;
      expect(stop).toBeDefined();
      const rain = g.state.log.find((e) => e.sys === 'god' && e.kind === 'prayer' && e.id === 'rain')!;
      expect(sourcesOf(stop)).toEqual([rain.n]);
    });
  }
});
