// The player's own display choices (they are not part of the game or the save): kept in the browser, safe when the storage is not there.
import { signal } from '@preact/signals';
import { PREFS_KEY } from './watch-tuning';

interface Prefs {
  /** Show the belief of the character as a percentage of the candle (code-plan §8.2 "ร้อยละของเทียน"). */
  candlePct: boolean;
}

function read(): Prefs {
  try {
    const text = localStorage.getItem(PREFS_KEY);
    if (text) return { candlePct: JSON.parse(text).candlePct === true };
  } catch {
    // no storage, or a text that is not ours: the defaults
  }
  return { candlePct: false };
}

export const prefs = signal<Prefs>(read());

export function setPrefs(patch: Partial<Prefs>): void {
  prefs.value = { ...prefs.value, ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs.value));
  } catch {
    // the choice holds for this page only
  }
}
