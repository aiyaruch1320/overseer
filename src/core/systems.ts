// Every system of the core, in loop order (game/SYSTEM_ORDER). Owned by the lead: a system joins this list when its
// branch is merged (docs/guide/code-plan.md §12.7). Importing a system also registers its rules (rules/).
import { characterSystem } from './character';
import type { System } from './game';
import { storySystem } from './story';

const list: System[] = [characterSystem, storySystem];

export function allSystems(): System[] {
  return [...list];
}
