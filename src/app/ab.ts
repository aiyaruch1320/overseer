// The A/B of the LLM director (llm/04-story.md §3.5): "A/B with real players (switch off vs on)". A tester's lives are split into two arms; the arm of a life is the value
// of `Settings.llm.director` for it, so the save carries it and the record names it. It is the player's own page setting (not part of the save), off by default: the doc's
// default is the director on for everyone, and the test turns the split on (review/m8/how-to-test.md).
import { signal } from '@preact/signals';

export type AbMode = 'off' | 'alternate' | 'seed';
export type Arm = 'on' | 'off';

export const AB_MODES: readonly AbMode[] = ['off', 'alternate', 'seed'];

/** Key of the page setting in the browser's storage. */
export const AB_KEY = 'overseer.ab.1';

function read(): AbMode {
  try {
    const v = localStorage.getItem(AB_KEY);
    if (v && (AB_MODES as readonly string[]).includes(v)) return v as AbMode;
  } catch {
    // no storage: the default
  }
  return 'off';
}

export const abMode = signal<AbMode>(read());

export function setAbMode(m: AbMode): void {
  abMode.value = m;
  try {
    localStorage.setItem(AB_KEY, m);
  } catch {
    // the choice holds for this page only
  }
}

/**
 * The arm of life number `lifeNo` (1 for the first life of a world) in a world of this seed.
 * `alternate`: the lives of one world take turns, and the first life's arm follows the seed's parity so that testers start on both arms evenly.
 * `seed`: the arm is the parity of the seed for every life of the world (even: on). Null when the split is off.
 */
export function armFor(mode: AbMode, seed: number, lifeNo: number): Arm | null {
  if (mode === 'off') return null;
  const even = Math.abs(Math.trunc(seed)) % 2 === 0;
  if (mode === 'seed') return even ? 'on' : 'off';
  return (lifeNo % 2 === 1) === even ? 'on' : 'off';
}
