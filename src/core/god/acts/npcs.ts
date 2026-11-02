// What the acts need to know of the NPCs and to do to them. The state of an NPC (grave illness, grudge, death by a deed, a cure) is the NPC
// system's: this file reads it through the NPC system's own exports and adds only what belongs to the acts, the circle of the character.
import type { Ctx } from '../../game';
import { favourNpc as favour, healNpc as heal, killNpc as kill, nemeses as grudges, sickNpcs } from '../../npc';
import { slotsOf, type NpcSlotX } from '../../npc/types';
import { CIRCLE_KNOWN } from './tuning';

export const slotOf = (ctx: Ctx, id: string): NpcSlotX | undefined => slotsOf(ctx.state)[id];

/** NPCs in the character's circle who are gravely ill (prayer `kin_sick`): ill by the NPC system's reckoning and known to the character. Ids, sorted. */
export function sickInCircle(ctx: Ctx): string[] {
  const slots = slotsOf(ctx.state);
  return sickNpcs(ctx).filter((id) => (slots[id]?.rel['mc.known'] ?? 0) >= CIRCLE_KNOWN);
}

/** NPCs who hold a grudge against the character (prayer `vengeance`). Ids, sorted. */
export const nemeses = (ctx: Ctx): string[] => grudges(ctx);

export const nameOf = (ctx: Ctx, id: string): string => slotOf(ctx, id)?.name ?? id;
export const aliveNpc = (ctx: Ctx, id: string): boolean => slotOf(ctx, id)?.status === 'alive';

/** The holder dies by the god's hand; the position gets a successor by the rules of the NPC system. */
export const killNpc = (ctx: Ctx, id: string, cause: string): boolean => kill(ctx, id, cause, 'god');

/** The sick NPC recovers: lives longer and owes the character a favour. */
export const healNpc = (ctx: Ctx, id: string, favourBy = 1): boolean => heal(ctx, id, favourBy);

export const favourNpc = (ctx: Ctx, id: string, delta: number): void => favour(ctx, id, delta);
