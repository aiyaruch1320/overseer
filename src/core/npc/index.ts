// NPC system (docs/lore/npcs/README.md, succession.md; code-plan §7 row "npc").
// 614 slots, each a position with a holder, a story clock and successors; the paths a b c are drawn by percent.
// Around them: the newcomers NT-01..54 (newcomers.ts), the ties between stories (ties.ts), the clashes with the main character
// (clash.ts, the combat system plays them through `onClash`), illness and grudge (status.ts).
// Rule kinds owned here: condition `npc` · effects `npc` `npcPath` (docs/guide/code-plan.md §12.4 task split).
import { clash as playClash, linkClashes } from '../combat/clash';
import type { System } from '../game';
import { onCond, onEffect } from '../rules';
import { applyClashOutcome, onClash, type ClashDecision, type ClashReq } from './clash';
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

/**
 * The combat system plays the clashes (combat/07-npc-clashes.md): it fights the NPC and answers which standard result came out. The effects of that
 * result are written back here (`applyClashOutcome`), so the combat system is asked not to apply them itself. A year that is full, or an NPC already
 * met this season or twice, is a clash that does not open; an NPC with no row of enemies gets the default result.
 */
export function combatClashHandler(ctx: Parameters<typeof playClash>[0], req: ClashReq): ClashDecision {
  const life = ctx.state.life;
  // a world that loaded no combat data has no fights: the default result is drawn
  if (!life || life.dead || !ctx.data.combat || !ctx.data.enemies) return undefined;
  const r = playClash(ctx, req.clash.id, { opener: req.code, apply: false, announce: true });
  if (r.result === 'waiting') return 'wait';
  if (r.result === 'deferred' || r.result === 'closed') return 'veto';
  if (r.result === 'unknown' || !r.kind) return undefined;
  return { outcome: r.kind, index: r.index };
}
onClash(combatClashHandler);
// a clash announced ahead is fought by the combat system on its day; the result is written back into the lines of the NPC as for any played clash
linkClashes({
  ready(ctx, npc) {
    const slot = slotsOf(ctx.state)[npc];
    return !!slot && !!ctx.state.life && !ctx.state.life.dead && slot.status === 'alive' && slot.place === ctx.state.life.country;
  },
  played(ctx, r) {
    if (r.kind) applyClashOutcome(ctx, r.clash, r.kind, r.index);
  },
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
