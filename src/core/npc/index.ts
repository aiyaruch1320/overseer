// NPC system (docs/lore/npcs/README.md, succession.md; code-plan §7 row "npc").
// 614 slots, each a position with a holder, a story clock and successors; the paths a b c are drawn by percent.
// Around them: the newcomers NT-01..54 (newcomers.ts), the ties between stories (ties.ts), the clashes with the main character
// (clash.ts, the combat system plays them through `onClash`), illness and grudge (status.ts).
// Rule kinds owned here: condition `npc` · effects `npc` `npcPath` (docs/guide/code-plan.md §12.4 task split).
import type { System } from '../game';
import { onCond, onEffect } from '../rules';
import { adjustPath, initSlots, isAlive, meetNamed, meetZone, stepWorld } from './engine';
import { slotsOf } from './types';

onCond('npc', (ctx, c) => isAlive(ctx, c.id) === c.alive);

onEffect('npc', (ctx, e) => {
  meetNamed(ctx, e.id);
});

onEffect('npcPath', (ctx, e, src) => {
  // a result written in a clash row is the character's doing; so is anything the combat system sends
  const mc = src.sys === 'combat' || (src.id ?? '').startsWith('NF-');
  adjustPath(ctx, e.npc, e.path, e.op, e.n, e.unit, mc ? { kind: 'mc' } : src.sys === 'god' ? { kind: 'god' } : undefined);
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
      slot.story.seen = false;
      slot.story.mcYears = 0;
      slot.clash = undefined;
    }
  },
  lifeYear(ctx) {
    meetZone(ctx);
  },
};

export { advanceSlot, fateClass, fateOutcome, lastEraPhase, pathChances } from './engine';
export { npcIndex, rowOf } from './data';
export * from './query';
export { npcState, slotsOf } from './types';
export type { NpcSlotX, NpcStateX, Story, Follow, NewcomerInfo } from './types';
export { favourNpc, grudgeOf, healNpc, isNemesis, isSick, killNpc, nemeses, sickNpcs } from './status';
export { applyClashOutcome, canClash, clashesOf, clearClashHandlers, onClash, openClash, triggersOf } from './clash';
export type { ClashCode, ClashDecision, ClashHandler, ClashReq, ClashTrigger, ClashWhy } from './clash';
export { candidatesFor, eraTag, rollNewcomers } from './newcomers';
export { tiedIds } from './ties';
