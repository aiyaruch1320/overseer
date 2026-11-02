// What the acts need to know of the NPCs and to do to them. Read-only over the NPC system except for the two deeds of the god:
// an NPC dies by the god's hand, or lives longer. (Proposal: the NPC system exports `killNpc` and `healNpc`; until then this calls its `end` and `bumpRel`.)
import type { Ctx } from '../../game';
import { npcIndex } from '../../npc/data';
import { bumpRel, end } from '../../npc/engine';
import { slotsOf, type NpcSlotX } from '../../npc/types';
import { CIRCLE_KNOWN, NEMESIS_GRUDGE, NPC_HEAL_SPAN, SICK_AGE_SHARE } from './tuning';

export const slotOf = (ctx: Ctx, id: string): NpcSlotX | undefined => slotsOf(ctx.state)[id];

/** NPCs in the character's circle who are old enough to be gravely ill (prayer `kin_sick`). Ids, sorted. */
export function sickInCircle(ctx: Ctx): string[] {
  const now = ctx.state.clock.worldYear;
  const out: string[] = [];
  const slots = slotsOf(ctx.state);
  for (const id of Object.keys(slots).sort()) {
    const s = slots[id];
    if (s.status !== 'alive' || (s.rel['mc.known'] ?? 0) < CIRCLE_KNOWN) continue;
    if (now - s.born >= SICK_AGE_SHARE * s.span) out.push(id);
  }
  return out;
}

/** NPCs who hold a grudge against the character (prayer `vengeance`). Ids, sorted. */
export function nemeses(ctx: Ctx): string[] {
  const slots = slotsOf(ctx.state);
  return Object.keys(slots)
    .sort()
    .filter((id) => slots[id].status === 'alive' && (slots[id].rel['mc.grudge'] ?? 0) >= NEMESIS_GRUDGE);
}

export const nameOf = (ctx: Ctx, id: string): string => slotOf(ctx, id)?.name ?? id;
export const aliveNpc = (ctx: Ctx, id: string): boolean => slotOf(ctx, id)?.status === 'alive';

/** The holder dies by the god's hand; the position gets a successor by the rules of the NPC system. */
export function killNpc(ctx: Ctx, id: string, cause: string): boolean {
  const slot = slotOf(ctx, id);
  const row = npcIndex(ctx).rows.get(id);
  if (!slot || !row || slot.status !== 'alive') return false;
  end(ctx, slot, row, ctx.state.clock.worldYear, 'dead', cause);
  return true;
}

/** The sick NPC recovers: lives longer and owes the character a favour. */
export function healNpc(ctx: Ctx, id: string, favour = 1): boolean {
  const slot = slotOf(ctx, id);
  if (!slot || slot.status !== 'alive') return false;
  slot.span += Math.max(3, Math.round(slot.span * NPC_HEAL_SPAN));
  bumpRel(ctx, slot, 'favor', favour);
  return true;
}

export function favourNpc(ctx: Ctx, id: string, delta: number): void {
  const slot = slotOf(ctx, id);
  if (slot && slot.status === 'alive') bumpRel(ctx, slot, 'favor', delta);
}

