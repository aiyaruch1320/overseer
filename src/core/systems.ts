// Every system of the core, in loop order (game/SYSTEM_ORDER). Owned by the lead: a system joins this list when its
// branch is merged (docs/guide/code-plan.md §12.7). Importing a system also registers its rules (rules/).
import { attentionSystem } from './attention';
import { characterSystem } from './character';
import { combatSystem } from './combat';
import { economySystem } from './economy';
import { endingSystem } from './ending';
import { lineageSystem } from './lineage';
import { bondageSystem } from './bondage';
import { bondsSystem } from './bonds';
import type { System } from './game';
import { itemsSystem } from './items';
import { travelSystem } from './travel';
import { godSystem } from './god';
import { godActsSystem } from './god/acts';
import { godConjureSystem } from './god/conjure';
import { godGoalsSystem } from './god/goals';
import { npcSystem } from './npc';
import { storySystem } from './story';
import { textSystem } from './text';
import { worldSystem } from './world';

const list: System[] = [worldSystem, characterSystem, economySystem, bondsSystem, travelSystem, bondageSystem, npcSystem, storySystem, combatSystem, itemsSystem, textSystem, godSystem, godActsSystem, godConjureSystem, godGoalsSystem, attentionSystem, endingSystem, lineageSystem];

export function allSystems(): System[] {
  return [...list];
}
