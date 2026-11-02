// The only place the bond system reaches into the NPC system (src/core/npc): slots of the roster that stand in ties.
// Kept apart so a change to the NPC state touches one file.
import type { Ctx } from '../game';
import { npcIndex, slotsOf, type NpcSlotX } from '../npc';
import type { NpcRow } from '../data/types-npcs';

export type { NpcSlotX, NpcRow };

export function slotOf(ctx: Ctx, id: string): NpcSlotX | undefined {
  return slotsOf(ctx.state)[id];
}

export function rowOf(ctx: Ctx, id: string): NpcRow | undefined {
  return ctx.data.npcs ? npcIndex(ctx).rows.get(id) : undefined;
}

export function allRows(ctx: Ctx): NpcRow[] {
  return ctx.data.npcs ? [...npcIndex(ctx).rows.values()] : [];
}

/** hAge (human-equivalent years) of the holder of a slot at this world year. */
export function slotHAge(ctx: Ctx, slot: NpcSlotX): number {
  return ((ctx.state.clock.worldYear - slot.born) * 75) / Math.max(1, slot.span);
}

/** Does the position have a living holder now? */
export function holderAlive(slot: NpcSlotX | undefined): boolean {
  return !!slot && slot.status === 'alive';
}

/** Country the holder lives in now. */
export function holderPlace(slot: NpcSlotX, row: NpcRow | undefined): string {
  return slot.place ?? row?.country ?? '';
}

/** Writes what the tie says about the person toward the main character on the NPC's own axes (npcs/README §4: `mc.trust` `mc.favor` `mc.grudge` `mc.known`). */
export function mirrorAxes(slot: NpcSlotX, axes: { trust: number; favor: number; grudge: number; known: number }): void {
  slot.rel['mc.trust'] = axes.trust;
  slot.rel['mc.favor'] = axes.favor;
  slot.rel['mc.grudge'] = axes.grudge;
  slot.rel['mc.known'] = axes.known;
}
