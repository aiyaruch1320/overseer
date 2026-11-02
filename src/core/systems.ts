// Every system of the core, in loop order (game/SYSTEM_ORDER). Owned by the lead: a system joins this list when its
// branch is merged (docs/guide/code-plan.md §12.7). Importing a system also registers its rules (rules/).
import type { System } from './game';

const list: System[] = [];

export function allSystems(): System[] {
  return [...list];
}
