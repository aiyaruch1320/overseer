// States of an NPC that other systems ask for or change: grave illness, grudge against the character, the deeds of the god and of the
// character on a holder (docs/systems/god/03-dreams.md prayers `kin_sick` `vengeance`, `npc:heal`, `npc:die`, `relkill:nemesis`).
import type { Ctx } from '../game';
import type { NpcRow } from '../data/types-npcs';
import { rowOf } from './data';
import { bumpRel, end, note, visible } from './engine';
import { tiedIds, type Doer, type DoerKind } from './ties';
import { HEAL_SPAN, ILL_DEATH, ILL_YEARS, KIN_GRUDGE, NEMESIS_GRUDGE, PLAGUE_SICK, RECOVER_IMMUNE, SICK_ONSET, SICK_PATH_RE } from './tuning';
import { slotsOf, type NpcSlotX } from './types';

// ---------- reading ----------

/** Is the holder of the position gravely ill (old, ill by his story, or by a plague)? Dead or absent holders are not. */
export function isSick(ctx: Ctx, id: string): boolean {
  const s = slotsOf(ctx.state)[id];
  return !!s && s.status === 'alive' && s.sick !== undefined;
}

/** Ids of the living holders who are gravely ill, sorted. The prayer `kin_sick` adds its own filter (the character's circle). */
export function sickNpcs(ctx: Ctx): string[] {
  const slots = slotsOf(ctx.state);
  return Object.keys(slots)
    .sort()
    .filter((id) => slots[id].status === 'alive' && slots[id].sick !== undefined);
}

/** How much the holder holds against the main character, 0..5 (relation axis `grudge`). */
export function grudgeOf(ctx: Ctx, id: string): number {
  return slotsOf(ctx.state)[id]?.rel['mc.grudge'] ?? 0;
}

/** A nemesis: a living holder whose grudge reached NEMESIS_GRUDGE (the prayer `vengeance`). */
export function isNemesis(ctx: Ctx, id: string): boolean {
  const s = slotsOf(ctx.state)[id];
  return !!s && s.status === 'alive' && (s.rel['mc.grudge'] ?? 0) >= NEMESIS_GRUDGE;
}

export function nemeses(ctx: Ctx): string[] {
  const slots = slotsOf(ctx.state);
  return Object.keys(slots)
    .sort()
    .filter((id) => slots[id].status === 'alive' && (slots[id].rel['mc.grudge'] ?? 0) >= NEMESIS_GRUDGE);
}

// ---------- the deeds ----------

/** Kin and disciples of a row: the NPCs its unique cell or its links name, and the ones whose cells name it (combat/07 §3 "แค้นของคนใกล้ชิด"). */
function kinOf(ctx: Ctx, row: NpcRow): string[] {
  const out: string[] = [];
  for (const id of tiedIds(ctx, row)) {
    const other = rowOf(ctx, id);
    const mine = row.refs.some((r) => r.to === id && (r.in === 'unique' || r.in === 'link'));
    const theirs = other?.refs.some((r) => r.to === row.id && (r.in === 'unique' || r.in === 'link'));
    if (mine || theirs || row.links.includes(id)) out.push(id);
  }
  return out;
}

/**
 * The holder dies by a deed: of the god (default), of the main character (`mc`: his kin hold a grudge against the character) or of the world.
 * The position gets a successor by the rules of the NPC system. Returns false when nobody was there.
 */
export function killNpc(ctx: Ctx, id: string, cause: string, by: DoerKind = 'god'): boolean {
  const slot = slotsOf(ctx.state)[id];
  const row = rowOf(ctx, id);
  if (!slot || !row || slot.status !== 'alive') return false;
  const doer: Doer = { kind: by };
  end(ctx, slot, row, ctx.state.clock.worldYear, 'dead', cause, { by: doer });
  if (by === 'mc') {
    const slots = slotsOf(ctx.state);
    for (const k of kinOf(ctx, row)) {
      const sk = slots[k];
      if (sk && sk.status === 'alive') bumpRel(ctx, sk, 'grudge', KIN_GRUDGE);
    }
  }
  return true;
}

/** The sick holder recovers: lives longer and owes the character a favour. Returns false when nobody was there. */
export function healNpc(ctx: Ctx, id: string, favour = 1): boolean {
  const slot = slotsOf(ctx.state)[id];
  const row = rowOf(ctx, id);
  if (!slot || slot.status !== 'alive') return false;
  slot.span += Math.max(3, Math.round(slot.span * HEAL_SPAN));
  const was = slot.sick !== undefined;
  slot.sick = undefined;
  slot.sickEnd = undefined;
  slot.immune = ctx.state.clock.worldYear + RECOVER_IMMUNE * slot.span;
  if (favour) bumpRel(ctx, slot, 'favor', favour);
  if (row && was) note(ctx, slot, row, 'heal', {}, 1);
  return true;
}

export function favourNpc(ctx: Ctx, id: string, delta: number): void {
  const slot = slotsOf(ctx.state)[id];
  if (slot && slot.status === 'alive') bumpRel(ctx, slot, 'favor', delta);
}

// ---------- the clock of an illness ----------

/** The holder falls ill by an illness that ends (his story, a plague): `sick` now, `sickEnd` some years later. */
export function fallIll(ctx: Ctx, slot: NpcSlotX, row: NpcRow, now: number, why: string): void {
  if (slot.sick !== undefined || slot.status !== 'alive') return;
  const rng = ctx.rng('npc.sick');
  slot.sick = now;
  slot.sickEnd = now + ILL_YEARS[0] + rng.next() * (ILL_YEARS[1] - ILL_YEARS[0]);
  note(ctx, slot, row, 'sick', { why }, visible(ctx, slot));
}

/** The text of a path says the holder falls ill. */
export const pathMakesIll = (text: string): boolean => SICK_PATH_RE.test(text);

/**
 * Old age, an illness ending and a plague, for one holder at `now`. Returns true when the holder changed (he died and a successor came),
 * so the clock has to look at the new one.
 */
export function stepSickness(ctx: Ctx, slot: NpcSlotX, row: NpcRow, now: number): boolean {
  if (slot.status !== 'alive') return false;
  const rng = ctx.rng('npc.sick');
  if (slot.sick === undefined) {
    if (now >= (slot.immune ?? -Infinity) && now - slot.born >= SICK_ONSET * slot.span) {
      slot.sick = now;
      note(ctx, slot, row, 'sick', { why: 'old' }, visible(ctx, slot));
    } else if ((ctx.state.world.countryFlags[slot.place ?? row.country] ?? []).includes('plague') && rng.chance(PLAGUE_SICK)) {
      fallIll(ctx, slot, row, now, 'plague');
    }
    return false;
  }
  if (slot.sickEnd !== undefined && slot.sickEnd <= now) {
    const at = slot.sickEnd;
    slot.sickEnd = undefined;
    if (rng.chance(ILL_DEATH)) {
      end(ctx, slot, row, Math.min(at, now), 'dead', 'โรคภัย');
      return true;
    }
    slot.sick = undefined;
    slot.immune = now + RECOVER_IMMUNE * slot.span;
    note(ctx, slot, row, 'well', {}, visible(ctx, slot));
  }
  return false;
}

