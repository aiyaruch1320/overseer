// Effects of systems that do not exist yet (bonds, M3): the story only records them as a log entry of level 1 and goes on.
// When the bonds system lands it registers these kinds itself and this file's registration is removed (register once per kind).
import { write } from '../log';
import { onEffect } from '../rules';

export function registerStubRules(): void {
  onEffect('mood', (ctx, e, src) => write(ctx.state, { sys: 'story', kind: 'mood', id: e.line, data: { mood: e.mood, level: e.level, node: src.id ?? null }, level: 1 }));
  onEffect('template', (ctx, e, src) => write(ctx.state, { sys: 'story', kind: 'template', id: e.code, data: { type: e.kind, to: e.to ?? null, chance: e.chance ?? null, node: src.id ?? null }, level: 1 }));
  onEffect('bond', (ctx, e, src) => write(ctx.state, { sys: 'story', kind: 'bond', id: e.line, data: { level: e.level ?? null, node: src.id ?? null }, level: 1 }));
}
