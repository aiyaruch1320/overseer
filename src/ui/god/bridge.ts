// How the god's screens reach a game: the store of the page (the real game) or a sample game of a story. Both answer the same four things, so a
// screen does not know which one it is drawn on. `rev` is read in a render so that the screen draws again after each change.
import { signal, type ReadonlySignal } from '@preact/signals';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { understandWords, type Understood } from '../../app/views/typed';
import { store } from '../../app/store';
import { command } from '../../core/command';
import type { Game, GameData } from '../../core/game';
import type { CommandResult, GodAction } from '../../core/types';

export interface GodBridge {
  game(): Game | null;
  data(): GameData | null;
  rev: ReadonlySignal<number>;
  /** `confirm: false` is the preview, `true` runs the action (the store's `god`). */
  run(action: GodAction, args: Record<string, unknown>, confirm: boolean): CommandResult;
  /** The free words of the player read as a whisper draft (changes nothing). */
  understand(words: string): Promise<Understood>;
}

/** The game of the page. */
export const storeBridge: GodBridge = {
  game: () => store.game,
  data: () => store.gameData,
  rev: store.rev,
  run: (action, args, confirm) => store.god(action, args, confirm),
  understand: (words) => store.understand(words),
};

/** A sample game of a story: commands run straight on it, and its own counter makes the screens draw again. */
export function sampleBridge(game: Game, data: GameData): GodBridge {
  const rev = signal(0);
  return {
    game: () => game,
    data: () => data,
    rev,
    understand: (words) => understandWords(game, undefined, words),
    run(action, args, confirm) {
      const r = command(game.ctx, { type: 'god', action, args, confirm });
      if (confirm) rev.value++;
      return r;
    },
  };
}

export const BridgeCtx = createContext<GodBridge>(storeBridge);
export const useBridge = (): GodBridge => useContext(BridgeCtx);

/** A view model of the game now, drawn again after each change; null when there is no game yet. */
export function useView<T>(make: (game: Game, data: GameData) => T): T | null {
  const b = useBridge();
  void b.rev.value;
  const g = b.game();
  const d = b.data();
  return g && d ? make(g, d) : null;
}
