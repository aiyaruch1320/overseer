// Point 1, command the character (llm/04-story.md §4 the translator, llm/README.md §2 `setup`): the free words of the player become one known command of the game,
// the whisper of the god, which then goes through `command()` like any other (its own check, preview and confirm). The LLM chooses only from the menu
// the game gives; it cannot make a command up. Tier 0 first (the words hold a hint name), the LLM only when they do not (llm/02-offline.md §4);
// with no answer the screen shows the whisper menu, which is the path the game has without an LLM.
import type { Ctx } from '../game';
import type { Command } from '../types';
import type { LlmClient } from './client';
import { hashOf } from './hash';
import { COMMAND_SYSTEM } from './prompts';
import { answerOf, keep, keys, logAnswer } from './record';
import { pointOn } from './switches';
import { MAX_TOKENS, WORDS_MAX } from './tuning';
import type { Checked, JsonSchema, Source } from './types';
import { parseObject } from './validate';

export type Needs = 'place' | 'npc' | 'heir';

/** What the player may whisper now: the hints, and the names a target can be. Built by the game (`commandMenu` in `menu.ts`) or by a test. */
export interface CommandMenu {
  hints: { hint: string; needs?: Needs }[];
  places: { id: string; name: string }[];
  people: { id: string; name: string }[];
  /** The colloquial phrases of each hint (docs/systems/god/09-whisper-words.md): tier 0 reads them beside the hint's own name. Never sent to the LLM. */
  says?: Record<string, string[]>;
}

export interface Draft {
  hint: string;
  target?: string;
}

export interface CommandOutcome {
  /** The whisper to send (`confirm: false` first, for the preview), or null: show the menu. */
  command: Extract<Command, { type: 'god' }> | null;
  /** `template` tier 0: the words named the hint (or nothing fit: the menu) · `llm` / `cache` the translator chose. */
  source: Source;
  /** When there is no command: why the menu is shown (`no_match` the words fit nothing · `off` · `breaker` ...). */
  reason?: string;
}

/** The words as the layer takes them: control characters out, spaces folded, cut at 300 characters (llm/README.md §5 rule 3). */
export function cleanWords(words: string): string {
  return words.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, WORDS_MAX);
}

const targetsOf = (menu: CommandMenu, need: Needs | undefined): { id: string; name: string }[] => (need === 'place' ? menu.places : need === 'npc' || need === 'heir' ? menu.people : []);

/**
 * Tier 0: the words hold the name of one hint or one of its phrases (09-whisper-words.md), and for a hint that needs a target, the name (or the id) of one entry.
 * The longest match wins. Nothing else is guessed.
 */
export function matchWords(words: string, menu: CommandMenu): Draft | null {
  const w = cleanWords(words).replace(/\s+/g, '');
  const flat = (x: string) => x.replace(/\s+/g, '');
  let best: { h: CommandMenu['hints'][number]; len: number } | null = null;
  for (const h of menu.hints) {
    for (const p of [h.hint, ...(menu.says?.[h.hint] ?? [])]) {
      const f = flat(p);
      if (f && w.includes(f) && (!best || f.length > best.len)) best = { h, len: f.length };
    }
  }
  if (!best) return null;
  const h = best.h;
  if (!h.needs) return { hint: h.hint };
  const t = targetsOf(menu, h.needs).find((x) => w.includes(flat(x.name)) || w.includes(x.id));
  return t ? { hint: h.hint, target: t.id } : null;
}

function schemaOf(menu: CommandMenu): JsonSchema {
  const ids = [...new Set([...menu.places, ...menu.people].map((x) => x.id))];
  return {
    type: 'object',
    properties: { hint: { type: 'string', enum: [...menu.hints.map((h) => h.hint), 'none'] }, target: { type: 'string', enum: [...ids, 'none'] } },
    required: ['hint', 'target'],
    additionalProperties: false,
  };
}

/** The check of the answer: a hint of the menu (or none) and, when it needs one, a target of the right kind. */
export function checkDraft(text: string, menu: CommandMenu): Checked<Draft | null> {
  const o = parseObject(text);
  if (!o.ok) return o;
  const hint = o.value.hint;
  const target = o.value.target;
  if (typeof hint !== 'string') return { ok: false, reason: 'no hint' };
  if (hint === 'none') return { ok: true, value: null };
  const h = menu.hints.find((x) => x.hint === hint);
  if (!h) return { ok: false, reason: `hint "${hint}" is not in the menu` };
  if (!h.needs) return { ok: true, value: { hint } };
  if (typeof target !== 'string' || !targetsOf(menu, h.needs).some((x) => x.id === target)) return { ok: false, reason: `target "${String(target)}" is not a ${h.needs} of the menu` };
  return { ok: true, value: { hint, target } };
}

const toCommand = (d: Draft): NonNullable<CommandOutcome['command']> => ({ type: 'god', action: 'whisper', args: d.target === undefined ? { hint: d.hint } : { hint: d.hint, target: d.target }, confirm: false });

/**
 * The words of the player to a command. Order: tier 0 (the words name the hint) → the answer already kept in the save for these exact words → the machine cache
 * and the provider. A kept answer is used whatever the switches say, so a save replays the same. Never throws.
 */
export async function interpretWords(ctx: Ctx, words: string, menu: CommandMenu, client: LlmClient | null | undefined): Promise<CommandOutcome> {
  const w = cleanWords(words);
  if (!w) return { command: null, source: 'template', reason: 'no_words' };
  const t0 = matchWords(w, menu);
  if (t0) return { command: toCommand(t0), source: 'template' };
  const life = ctx.state.life;
  const input = { words: w, menu: { hints: menu.hints, places: menu.places, people: menu.people } };
  const key = keys.command(hashOf({ life: life?.id ?? null, age: life?.hAge ?? null, input }));
  const kept = answerOf(ctx.state, key);
  if (kept !== undefined) {
    const c = checkDraft(kept, menu);
    if (c.ok) return c.value ? { command: toCommand(c.value), source: 'llm' } : { command: null, source: 'llm', reason: 'no_match' };
  }
  if (!pointOn(ctx.state, client, 'command')) return { command: null, source: 'template', reason: 'off' };
  const r = await client!.run({
    point: 'command',
    input,
    life: life?.id,
    system: COMMAND_SYSTEM,
    user: JSON.stringify({ words: w, hints: menu.hints, places: menu.places, people: menu.people }),
    schema: schemaOf(menu),
    maxTokens: MAX_TOKENS.command,
    check: (text) => checkDraft(text, menu),
  });
  if (r.source === 'template') return { command: null, source: 'template', reason: r.reason };
  keep(ctx.state, key, r.text);
  logAnswer(ctx.state, 'command', r.value?.hint ?? 'none', { words: w, answer: r.text, from: r.source });
  return r.value ? { command: toCommand(r.value), source: r.source } : { command: null, source: r.source, reason: 'no_match' };
}
