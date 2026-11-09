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
  /** `roles`: words that stand for the entry in a sentence ("บ้าน" for the home country, "ครู" for the mentor); a pointing hint with no name in the words may resolve by one. */
  places: { id: string; name: string; roles?: string[] }[];
  people: { id: string; name: string; roles?: string[] }[];
  /** The colloquial phrases of each hint (docs/systems/god/09-whisper-words.md): tier 0 reads them beside the hint's own name. Never sent to the LLM. */
  says?: Record<string, string[]>;
}

export interface Draft {
  hint: string;
  target?: string;
}

/** How tier 0 read the words: the hint by its own name or by one of its phrases, and a target by its name (or id) or by a role word ("บ้าน"). */
export interface Via {
  hint: 'name' | 'phrase';
  target?: 'name' | 'role';
  /** With `target: 'role'`: the role word that was in the words. */
  role?: string;
}

export interface CommandOutcome {
  /** The whisper to send (`confirm: false` first, for the preview), or null: show the menu. */
  command: Extract<Command, { type: 'god' }> | null;
  /** `template` tier 0: the words named the hint (or nothing fit: the menu) · `llm` / `cache` the translator chose. */
  source: Source;
  /** When there is no command: why the menu is shown (`no_match` the words fit nothing · `off` · `breaker` · `need_target` the words named a pointing hint but not whom or where). */
  reason?: string;
  /** Tier 0 only: what the words matched, so the screen can say how the whisper was read. */
  via?: Via;
  /** With `need_target`: the hint the words named and what it points at, so the screen asks for the target instead of refusing. */
  ask?: { hint: string; needs: Needs };
}

/** The words as the layer takes them: control characters out, spaces folded, cut at 300 characters (llm/README.md §5 rule 3). */
export function cleanWords(words: string): string {
  return words.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, WORDS_MAX);
}

const targetsOf = (menu: CommandMenu, need: Needs | undefined): { id: string; name: string; roles?: string[] }[] => (need === 'place' ? menu.places : need === 'npc' || need === 'heir' ? menu.people : []);

/** What tier 0 found in the words: the draft when the hint (and its target, if it needs one) is clear, else the hint that lacks its target. */
export interface Match {
  draft: Draft | null;
  via?: Via;
  ask?: { hint: string; needs: Needs };
}

/**
 * Tier 0: the words hold the name of one hint or one of its phrases (09-whisper-words.md), and for a hint that needs a target, the name (or the id) of one entry,
 * or a role word of one ("ครู" "พ่อ" "แม่" "เพื่อน" "บ้าน", `roles` of the menu). The longest phrase wins; when the longest hint lacks its target a shorter hint
 * whose target is there may win instead ("จงไปหาครู" is the help of the teacher, not a trip). A hint that matched but has no target is returned as `ask`.
 */
export function matchTier0(words: string, menu: CommandMenu): Match {
  const w = cleanWords(words).replace(/\s+/g, '');
  const flat = (x: string) => x.replace(/\s+/g, '');
  const found: { h: CommandMenu['hints'][number]; len: number; by: Via['hint'] }[] = [];
  for (const h of menu.hints) {
    let len = 0;
    let by: Via['hint'] = 'name';
    for (const p of [h.hint, ...(menu.says?.[h.hint] ?? [])]) {
      const f = flat(p);
      if (f && w.includes(f) && f.length > len) {
        len = f.length;
        by = p === h.hint ? 'name' : 'phrase';
      }
    }
    if (len) found.push({ h, len, by });
  }
  found.sort((a, b) => b.len - a.len);
  let ask: Match['ask'];
  for (const { h, by } of found) {
    if (!h.needs) return { draft: { hint: h.hint }, via: { hint: by } };
    const list = targetsOf(menu, h.needs);
    const named = list.find((x) => w.includes(flat(x.name)) || w.includes(x.id));
    if (named) return { draft: { hint: h.hint, target: named.id }, via: { hint: by, target: 'name' } };
    const roled = list.find((x) => (x.roles ?? []).some((r) => w.includes(flat(r))));
    if (roled) return { draft: { hint: h.hint, target: roled.id }, via: { hint: by, target: 'role', role: (roled.roles ?? []).find((r) => w.includes(flat(r))) } };
    ask ??= { hint: h.hint, needs: h.needs };
  }
  return ask ? { draft: null, ask } : { draft: null };
}

/** The draft of tier 0 alone (see `matchTier0`). */
export const matchWords = (words: string, menu: CommandMenu): Draft | null => matchTier0(words, menu).draft;

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
  const m0 = matchTier0(w, menu);
  if (m0.draft) return { command: toCommand(m0.draft), source: 'template', ...(m0.via ? { via: m0.via } : {}) };
  // a pointing hint named without its target: the LLM may still read the target, else the screen asks for it (09-whisper-words.md rule 4)
  const lack = (o: CommandOutcome): CommandOutcome => (m0.ask && !o.command ? { ...o, reason: 'need_target', ask: m0.ask } : o);
  const life = ctx.state.life;
  // the roles are for tier 0 only: the LLM (and the hash of its input) sees the ids and names as before
  const bare = (xs: { id: string; name: string }[]) => xs.map((x) => ({ id: x.id, name: x.name }));
  const input = { words: w, menu: { hints: menu.hints, places: bare(menu.places), people: bare(menu.people) } };
  const key = keys.command(hashOf({ life: life?.id ?? null, age: life?.hAge ?? null, input }));
  const kept = answerOf(ctx.state, key);
  if (kept !== undefined) {
    const c = checkDraft(kept, menu);
    if (c.ok) return c.value ? { command: toCommand(c.value), source: 'llm' } : lack({ command: null, source: 'llm', reason: 'no_match' });
  }
  if (!pointOn(ctx.state, client, 'command')) return lack({ command: null, source: 'template', reason: 'off' });
  const r = await client!.run({
    point: 'command',
    input,
    life: life?.id,
    system: COMMAND_SYSTEM,
    user: JSON.stringify({ words: w, hints: menu.hints, places: bare(menu.places), people: bare(menu.people) }),
    schema: schemaOf(menu),
    maxTokens: MAX_TOKENS.command,
    check: (text) => checkDraft(text, menu),
  });
  if (r.source === 'template') return lack({ command: null, source: 'template', reason: r.reason });
  keep(ctx.state, key, r.text);
  logAnswer(ctx.state, 'command', r.value?.hint ?? 'none', { words: w, answer: r.text, from: r.source });
  return r.value ? { command: toCommand(r.value), source: r.source } : lack({ command: null, source: r.source, reason: 'no_match' });
}
