// Effects of the bond system, for a story that runs without it: the story only records them as a log entry of level 1 and goes on.
// When the bonds system is loaded (src/core/bonds) it installs its own handlers in `stubHooks`, and the three kinds are handled there. The kinds are
// registered once, here, because the registry takes a kind from one owner only (src/core/rules).
import { write } from '../log';
import { onEffect, type EffectFn } from '../rules';

export const stubHooks: { mood?: EffectFn<'mood'>; template?: EffectFn<'template'>; bond?: EffectFn<'bond'> } = {};

export function registerStubRules(): void {
  onEffect('mood', (ctx, e, src) => (stubHooks.mood ? stubHooks.mood(ctx, e, src) : write(ctx.state, { sys: 'story', kind: 'mood', id: e.line, data: { mood: e.mood, level: e.level, node: src.id ?? null }, level: 1 })));
  onEffect('template', (ctx, e, src) => (stubHooks.template ? stubHooks.template(ctx, e, src) : write(ctx.state, { sys: 'story', kind: 'template', id: e.code, data: { type: e.kind, to: e.to ?? null, chance: e.chance ?? null, node: src.id ?? null }, level: 1 })));
  onEffect('bond', (ctx, e, src) => (stubHooks.bond ? stubHooks.bond(ctx, e, src) : write(ctx.state, { sys: 'story', kind: 'bond', id: e.line, data: { level: e.level ?? null, node: src.id ?? null }, level: 1 })));
}
