// Two clocks (code-plan §2.4, docs/lore/world/world-time.md): world years ศ.ม. stepping by decades, and
// life years of the main character in four beats each. One life year = natural lifespan ÷ 75 world years
// (÷ 58 for the three races that wake at hAge 17: mummy, ghoul, soul machine).
import type { Clock } from '../types';

export const BEATS_PER_LIFE_YEAR = 4;
export const WORLD_STEP = 10; // world years per world step
export const HAGE_SPAN = 75;
/** Races whose life starts at hAge 17 (world-time.md §5). */
export const LATE_WAKERS: ReadonlySet<string> = new Set(['mummy', 'ghoul', 'soulmachine']);

export function newClock(worldYear: number): Clock {
  return { worldYear, worldAcc: 0, quarter: 0 };
}

/** World years that pass in one life year for a character with this natural lifespan. */
export function worldYearsPerLifeYear(lifespan: number, race?: string): number {
  return lifespan / (race && LATE_WAKERS.has(race) ? HAGE_SPAN - 17 : HAGE_SPAN);
}

/** Moves the clock one beat. Returns the whole world years crossed and whether a world step is due. */
export function beat(clock: Clock, worldYearsPerBeat: number): { lifeYearDone: boolean; worldYears: number; worldSteps: number } {
  clock.quarter = (clock.quarter + 1) % BEATS_PER_LIFE_YEAR;
  const before = Math.floor(clock.worldAcc);
  clock.worldAcc += worldYearsPerBeat;
  const crossed = Math.floor(clock.worldAcc) - before;
  clock.worldYear += crossed;
  let worldSteps = 0;
  while (clock.worldAcc >= WORLD_STEP) {
    clock.worldAcc -= WORLD_STEP;
    worldSteps++;
  }
  return { lifeYearDone: clock.quarter === 0, worldYears: crossed, worldSteps };
}

/** World advance without a living character: whole decades. */
export function worldDecade(clock: Clock): void {
  clock.worldYear += WORLD_STEP;
}
