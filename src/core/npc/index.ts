// NPC system (docs/lore/npcs/README.md, succession.md; code-plan §7 row "npc").
// 614 slots, each a position with a holder, a story clock and successors; the paths a b c are drawn by percent.
// Rule kinds owned here: condition `npc` · effects `npc` `npcPath` (docs/guide/code-plan.md §12.4 task split).
import type { System } from '../game';
import { onCond, onEffect } from '../rules';
import { advanceSlot, adjustPath, initSlots, isAlive, meetNamed, meetZone, stepWorld } from './engine';
import { npcIndex } from './data';
import { slotsOf } from './types';

onCond('npc', (ctx, c) => isAlive(ctx, c.id) === c.alive);

onEffect('npc', (ctx, e) => {
  meetNamed(ctx, e.id);
});

onEffect('npcPath', (ctx, e) => {
  adjustPath(ctx, e.npc, e.path, e.op, e.n, e.unit);
});

export const npcSystem: System = {
  name: 'npc',
  init(ctx) {
    initSlots(ctx);
  },
  worldStep(ctx) {
    stepWorld(ctx);
  },
  birth(ctx) {
    // a new life meets the world as it is: nobody knows the new character yet
    for (const slot of Object.values(slotsOf(ctx.state))) {
      for (const k of Object.keys(slot.rel)) if (k.startsWith('mc.')) delete slot.rel[k];
      slot.story.mc = false;
    }
  },
  lifeYear(ctx) {
    meetZone(ctx);
  },
};

export { advanceSlot, npcIndex };
export * from './query';
export type { NpcSlotX, Story } from './types';
