// Commands from the screen to the core (code-plan §6.4, god/06-implementation.md §3): the screen sends a command, the core
// checks the right to act (caps, cooldowns, the iron rules, power), answers the expected result for the confirm screen without
// rolling, and runs it only when the command says `confirm`. Systems register the god actions of their own domain.
import { write } from '../log';
import type { Ctx } from '../game';
import type { Command, CommandResult, GodAction, Settings } from '../types';

export interface ActionHandler {
  /** Why the action cannot be taken now, or null when it can. Must not roll or change the state. */
  check(ctx: Ctx, args: Record<string, unknown>): string | null;
  /** What the confirm screen shows: cost, expected result, chance. Must not roll or change the state. */
  preview(ctx: Ctx, args: Record<string, unknown>): Record<string, unknown>;
  /** Runs the action (pays, applies, writes the chronicle and the log). */
  run(ctx: Ctx, args: Record<string, unknown>): void;
}

const actions = new Map<string, ActionHandler>();

export function onAction(action: GodAction, h: ActionHandler): void {
  if (actions.has(action)) throw new Error(`god action ${action} registered twice`);
  actions.set(action, h);
}

export function hasAction(action: GodAction): boolean {
  return actions.has(action);
}

/** Runs one command. `advance` is handled by the caller (it owns the Game); settings and god actions are handled here. */
export function command(ctx: Ctx, cmd: Exclude<Command, { type: 'advance' }>): CommandResult {
  const mark = ctx.state.logN;
  if (cmd.type === 'settings') {
    applySettings(ctx.state.settings, cmd.patch);
    write(ctx.state, { sys: 'settings', kind: 'change', data: { keys: Object.keys(cmd.patch).join(' ') }, level: 0 });
    return { ok: true, log: ctx.state.log.filter((e) => e.n >= mark) };
  }
  const h = actions.get(cmd.action);
  if (!h) return { ok: false, reason: `no handler for ${cmd.action}` };
  const why = h.check(ctx, cmd.args);
  if (why) return { ok: false, reason: why };
  const preview = h.preview(ctx, cmd.args);
  if (!cmd.confirm) return { ok: true, preview, log: [] };
  h.run(ctx, cmd.args);
  return { ok: true, preview, log: ctx.state.log.filter((e) => e.n >= mark) };
}

function applySettings(s: Settings, patch: Partial<Settings>): void {
  if (patch.speed) s.speed = patch.speed;
  if (patch.attention) s.attention = patch.attention;
  if (patch.lang) s.lang = patch.lang;
  if (patch.llm) s.llm = { ...s.llm, ...patch.llm };
}

/** Test helper. */
export function resetActions(): void {
  actions.clear();
}
