// Every system of the core, in loop order (game/SYSTEM_ORDER). Owned by the lead: a system joins this list when its
// branch is merged (docs/guide/code-plan.md §12.7). Importing a system also registers its rules (rules/).
import { attentionSystem } from './attention';
import { characterSystem } from './character';
import type { System } from './game';
import { godSystem } from './god';
import { godActsSystem } from './god/acts';
import { npcSystem } from './npc';
import { storySystem } from './story';
import { textSystem } from './text';
import { worldSystem } from './world';

const list: System[] = [worldSystem, characterSystem, npcSystem, storySystem, textSystem, godSystem, godActsSystem, attentionSystem];

export function allSystems(): System[] {
  return [...list];
}
