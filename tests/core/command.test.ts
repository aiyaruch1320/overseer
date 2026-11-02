import { beforeEach, describe, expect, it } from 'vitest';
import { command, onAction, resetActions } from '../../src/core/command';
import { makeCtx } from '../../src/core/game';
import { newGame } from '../../src/core/state';

describe('commands', () => {
  beforeEach(() => resetActions());
  it('previews without running, runs on confirm, refuses when the check says no', () => {
    const ctx = makeCtx(newGame(1), {});
    let ran = 0;
    onAction('whisper', {
      check: (c) => (c.state.god.light < 5 ? 'แสงศรัทธาไม่พอ' : null),
      preview: () => ({ cost: 5 }),
      run: (c) => {
        c.state.god.light -= 5;
        ran++;
      },
    });
    expect(command(ctx, { type: 'god', action: 'whisper', args: {}, confirm: true })).toEqual({ ok: false, reason: 'แสงศรัทธาไม่พอ' });
    ctx.state.god.light = 12;
    expect(command(ctx, { type: 'god', action: 'whisper', args: {}, confirm: false })).toEqual({ ok: true, preview: { cost: 5 }, log: [] });
    expect(ran).toBe(0);
    expect(command(ctx, { type: 'god', action: 'whisper', args: {}, confirm: true }).ok).toBe(true);
    expect(ran).toBe(1);
    expect(ctx.state.god.light).toBe(7);
  });
  it('changes settings', () => {
    const ctx = makeCtx(newGame(1), {});
    command(ctx, { type: 'settings', patch: { attention: 'low', llm: { director: false } as never } });
    expect(ctx.state.settings.attention).toBe('low');
    expect(ctx.state.settings.llm.director).toBe(false);
    expect(ctx.state.settings.llm.setup).toBe(true);
  });
});
