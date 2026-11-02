// What goes with the lineage from world to world (god/08-goals.md §4): the chronicle and what it opened, the vows kept, the titles seen, the names of the
// miracles conjured, the reactions met and the rhythm chosen. A plain JSON object; the lineage system (or the screen that starts a world) takes it from the
// state of the world that ended with `goalsCarry` and puts it in the state of the next world with `applyCarry` before the first life is born.
import type { GameState } from '../../types';
import { freshMeta, goalsOf, type GoalsMeta } from './state';

export type GoalsCarry = GoalsMeta;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** The carry of a world. A copy: the state can go on without changing it. */
export function goalsCarry(state: GameState): GoalsCarry {
  return clone(goalsOf(state).meta);
}

/** Puts a carry in a world that has none yet (a new world, before its first life). Fields a saved carry lacks are filled in blank. */
export function applyCarry(state: GameState, carry: GoalsCarry | undefined): void {
  const w = goalsOf(state);
  if (!carry) return;
  w.meta = { ...freshMeta(), ...clone(carry) };
  w.lives = 0;
  w.carried = w.meta.lines.length;
}
