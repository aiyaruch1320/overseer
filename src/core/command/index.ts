// Commands from the screen to the core (code-plan §6.4, god/06-implementation.md §3): the screen sends a command, the core
// checks the right to act (caps, cooldowns, the iron rules, power), answers the expected result for the confirm screen without
// rolling, and runs it only when the command says `confirm`. Systems register the god actions of their own domain.
import { write } from '../log';
import type { Ctx } from '../game';
import { CARD_KINDS, type Command, type CommandResult, type GodAction, type Settings } from '../types';

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
    const bad = badSettings(cmd.patch);
    if (bad) return { ok: false, reason: bad };
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

/** The switches of the cards when nothing was chosen (a save older than the setting has none: all on). */
export const allCardsOn = (): Settings['cards'] => ({ prayer: true, omen: true, battle: true, crisis: true, majorOmen: true });

/** Is this kind of card switched on? A settings object without the switches reads as all on. */
export const cardOn = (s: Pick<Settings, 'cards'> | { cards?: Partial<Settings['cards']> }, kind: keyof Settings['cards']): boolean => s.cards?.[kind] !== false;

export type CannotWhy = 'noLife' | 'cost' | 'cap' | 'cooldown' | 'unknown' | 'other';

export type CanDo = { ok: true } | { ok: false; why: CannotWhy; reason: string; /** world years until the action is ready, for `cooldown` when the check says */ wait?: number };

/**
 * Whether a god action can be taken now, and why not (20-god-ui.md §2: a button that cannot be used is grey with an hourglass and the time left).
 * It is the `check` of the action, sorted by what the reason says: no living character, the cost, a cap, a cooldown (with the years left).
 * Pure: no roll, no change of state. A screen asks it for each button with the args it has (none for the button itself).
 */
export function canDo(ctx: Ctx, action: GodAction, args: Record<string, unknown> = {}): CanDo {
  const h = actions.get(action);
  if (!h) return { ok: false, why: 'unknown', reason: `no handler for ${action}` };
  const reason = h.check(ctx, args);
  if (!reason) return { ok: true };
  if (/ไม่มีตัวละคร/.test(reason)) return { ok: false, why: 'noLife', reason };
  const wait = reason.match(/ต้องรออีก\s*(\d+(?:\.\d+)?)\s*ปี/);
  if (wait) return { ok: false, why: 'cooldown', reason, wait: Number(wait[1]) };
  if (/ไม่พอ/.test(reason)) return { ok: false, why: 'cost', reason };
  if (/ครบ|เพดาน/.test(reason)) return { ok: false, why: 'cap', reason };
  return { ok: false, why: 'other', reason };
}

const SPEEDS: readonly Settings['speed'][] = ['pause', 'normal', 'fast'];
const ATTENTION: readonly Settings['attention'][] = ['low', 'normal', 'high'];

/** Why a settings patch is refused (a value the game does not know), or null. */
export function badSettings(patch: Partial<Settings>): string | null {
  if (patch.speed !== undefined && !SPEEDS.includes(patch.speed)) return `ไม่รู้จักความเร็ว ${String(patch.speed)}`;
  if (patch.attention !== undefined && !ATTENTION.includes(patch.attention)) return `ไม่รู้จักความถี่ที่เกมเรียก ${String(patch.attention)}`;
  if (patch.lang !== undefined && patch.lang !== 'th') return `ไม่รู้จักภาษา ${String(patch.lang)}`;
  if (patch.llm !== undefined) for (const [k, v] of Object.entries(patch.llm)) if (!['master', 'setup', 'director', 'epitaph'].includes(k) || typeof v !== 'boolean') return `สวิตช์ LLM ${k} ไม่ถูกต้อง`;
  if (patch.cards !== undefined) {
    if (typeof patch.cards !== 'object' || patch.cards === null) return 'สวิตช์การ์ดไม่ถูกต้อง';
    for (const [k, v] of Object.entries(patch.cards)) if (!(CARD_KINDS as readonly string[]).includes(k) || typeof v !== 'boolean') return `สวิตช์การ์ด ${k} ไม่ถูกต้อง`;
  }
  if (patch.hintsSeen !== undefined) {
    if (typeof patch.hintsSeen !== 'object' || patch.hintsSeen === null) return 'สวิตช์คำแนะนำไม่ถูกต้อง';
    for (const [k, v] of Object.entries(patch.hintsSeen)) if (k !== 'firstLife' || typeof v !== 'boolean') return `คำแนะนำ ${k} ไม่ถูกต้อง`;
  }
  return null;
}

function applySettings(s: Settings, patch: Partial<Settings>): void {
  if (patch.speed) s.speed = patch.speed;
  if (patch.attention) s.attention = patch.attention;
  if (patch.lang) s.lang = patch.lang;
  if (patch.llm) s.llm = { ...s.llm, ...patch.llm };
  if (patch.cards) s.cards = { ...allCardsOn(), ...s.cards, ...patch.cards };
  if (patch.hintsSeen) s.hintsSeen = { ...s.hintsSeen, ...patch.hintsSeen };
}

/** Test helper. */
export function resetActions(): void {
  actions.clear();
}
