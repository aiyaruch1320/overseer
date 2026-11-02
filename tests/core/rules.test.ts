import { beforeEach, describe, expect, it } from 'vitest';
import { makeCtx } from '../../src/core/game';
import { apply, onCond, onEffect, resetRules, test } from '../../src/core/rules';
import { newGame } from '../../src/core/state';

describe('rules registry', () => {
  beforeEach(() => resetRules());
  it('combines conditions and reports a kind nobody handles', () => {
    const ctx = makeCtx(newGame(1), {});
    onCond('era', (c, x) => c.state.world.era >= x.min);
    expect(test(ctx, { k: 'and', of: [{ k: 'era', min: 1 }, { k: 'not', of: { k: 'era', min: 2 } }] })).toBe(true);
    expect(test(ctx, { k: 'text', text: 'อะไรสักอย่าง' })).toBe(false);
    expect(test(ctx, { k: 'faith', ids: ['faith.01'] })).toBe(false);
    expect(ctx.state.log.some((e) => e.kind === 'unhandled' && e.id === 'cond:faith')).toBe(true);
  });
  it('applies if, pick and chance through the registered effects, with seeded draws', () => {
    const run = (seed: number) => {
      resetRules();
      const ctx = makeCtx(newGame(seed), {});
      const got: string[] = [];
      onEffect('grant', (_c, e) => got.push(e.id));
      onCond('era', (c, x) => c.state.world.era >= x.min);
      apply(ctx, [
        { k: 'if', cond: { k: 'era', min: 1 }, then: [{ k: 'grant', kind: 'trait', id: 'a' }] },
        { k: 'if', cond: { k: 'era', min: 3 }, then: [{ k: 'grant', kind: 'trait', id: 'never' }] },
        { k: 'pick', of: [{ weight: 1, effects: [{ k: 'grant', kind: 'job', id: 'x' }] }, { weight: 0, effects: [{ k: 'grant', kind: 'job', id: 'y' }] }] },
        { k: 'grant', kind: 'curse', id: 'rare', chance: 0 },
        { k: 'grant', kind: 'curse', id: 'sure', chance: 1 },
      ], { sys: 'test' });
      return got;
    };
    expect(run(5)).toEqual(['a', 'x', 'sure']);
  });
});
