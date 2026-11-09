// The free words of the player to the character (llm/README.md §2 point `command`, 20-god-ui.md §5): the words become one known whisper of the game, or nothing.
// The LLM is asked only when the store has one and the player's switch is on (`interpretWords` reads the switch); with none, the offline matcher (the hint's own name
// in the words) answers, so the box works without a network. The result is only a draft: the panel shows it and the whisper's own confirm sends it.
import type { Game } from '../../core/game';
import type { Llm } from '../../core/llm';
import { cleanWords, interpretWords, type CommandMenu } from '../../core/llm/command';
import { commandMenu } from '../../core/llm/menu';
import { W } from './god-words';

export type Understood =
  | {
      ok: true;
      hint: string;
      target?: string;
      targetName?: string;
      source: 'template' | 'llm' | 'cache';
      /** The hint matched the hint's own name (`name`) or one of its table phrases (`phrase`); tier 0 only. */
      by?: 'name' | 'phrase';
      /** The destination or person was not in the words: the game (a role word, `role`) or the translator (`llm`) chose it. */
      guessed?: { how: 'role' | 'llm'; role?: string };
    }
  /** `line` says why nothing fits; the screen then shows the menu. With `hint` the words named a pointing hint but not its target: the screen picks the hint and asks. */
  | { ok: false; reason: string; line: string; hint?: string; needs?: 'place' | 'npc' | 'heir' };

const nameOf = (menu: CommandMenu, id: string): string => [...menu.places, ...menu.people].find((x) => x.id === id)?.name ?? id;

const whyLine = (reason: string | undefined): string => (reason === 'no_words' ? W.whisper.typed.empty : reason === 'off' ? W.whisper.typed.noFit : W.whisper.typed.noMatch);

/** Reads the words against the whisper menu of the game now. Never throws. */
export async function understandWords(game: Game, llm: Llm | undefined, words: string): Promise<Understood> {
  const w = cleanWords(words);
  if (!w) return { ok: false, reason: 'no_words', line: whyLine('no_words') };
  try {
    const menu = commandMenu(game.ctx);
    const out = llm ? await llm.interpretWords(game.ctx, w, menu) : await interpretWords(game.ctx, w, menu, null);
    const a = out.command?.args as { hint: string; target?: string } | undefined;
    if (!a && out.ask) return { ok: false, reason: 'need_target', hint: out.ask.hint, needs: out.ask.needs, line: `${W.whisper.typed.needTarget[out.ask.needs]}`.replace('{hint}', out.ask.hint) };
    if (!a) return { ok: false, reason: out.reason ?? out.source, line: whyLine(out.reason) };
    const tn = a.target ? nameOf(menu, a.target) : undefined;
    // a target the words do not hold (by name or id) was guessed, by a role word of tier 0 or by the translator
    const flat = (x: string) => x.replace(/\s+/g, '');
    const named = !a.target || flat(w).includes(flat(tn!)) || flat(w).includes(a.target);
    const guessed: { how: 'role' | 'llm'; role?: string } | undefined = named ? undefined : out.via?.target === 'role' ? { how: 'role', ...(out.via.role ? { role: out.via.role } : {}) } : { how: 'llm' };
    return { ok: true, hint: a.hint, ...(a.target ? { target: a.target, targetName: tn } : {}), source: out.source as 'template' | 'llm' | 'cache', ...(out.via ? { by: out.via.hint } : {}), ...(guessed ? { guessed } : {}) };
  } catch {
    return { ok: false, reason: 'error', line: whyLine('error') };
  }
}
