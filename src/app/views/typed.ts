// The free words of the player to the character (llm/README.md §2 point `command`, 20-god-ui.md §5): the words become one known whisper of the game, or nothing.
// The LLM is asked only when the store has one and the player's switch is on (`interpretWords` reads the switch); with none, the offline matcher (the hint's own name
// in the words) answers, so the box works without a network. The result is only a draft: the panel shows it and the whisper's own confirm sends it.
import type { Game } from '../../core/game';
import type { Llm } from '../../core/llm';
import { cleanWords, interpretWords, type CommandMenu } from '../../core/llm/command';
import { commandMenu } from '../../core/llm/menu';
import { W } from './god-words';

export type Understood =
  | { ok: true; hint: string; target?: string; targetName?: string; source: 'template' | 'llm' | 'cache' }
  /** `line` says why nothing fits; the screen then shows the menu. */
  | { ok: false; reason: string; line: string };

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
    if (!a) return { ok: false, reason: out.reason ?? out.source, line: whyLine(out.reason) };
    return { ok: true, hint: a.hint, ...(a.target ? { target: a.target, targetName: nameOf(menu, a.target) } : {}), source: out.source as 'template' | 'llm' | 'cache' };
  } catch {
    return { ok: false, reason: 'error', line: whyLine('error') };
  }
}
