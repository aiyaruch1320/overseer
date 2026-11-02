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

describe('stats', () => {
  it('cmp, count and stat effects go through the registered numbers, prefixes included', async () => {
    const { onStat } = await import('../../src/core/rules');
    resetRules();
    const ctx = makeCtx(newGame(1), {});
    let gold = 40;
    const axes: Record<string, number> = { curious: 55 };
    onStat('gold', { read: () => gold, add: (_c, _n, d) => { gold += d; } });
    onStat('axis.', { read: (_c, n) => axes[n.slice(5)] ?? 0 });
    expect(test(ctx, { k: 'cmp', stat: 'gold', op: '>=', value: 100 })).toBe(false);
    apply(ctx, [{ k: 'stat', stat: 'gold', delta: 70 }], { sys: 'test' });
    expect(test(ctx, { k: 'cmp', stat: 'gold', op: '>=', value: 100 })).toBe(true);
    expect(test(ctx, { k: 'cmp', stat: 'axis.curious', op: '>', value: 40 })).toBe(true);
    expect(test(ctx, { k: 'count', what: 'lineage.open', min: 1 })).toBe(false);
    expect(ctx.state.log.some((e) => e.id === 'cond:stat:lineage.open')).toBe(true);
  });
});
