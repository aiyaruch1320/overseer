// The allies as a target (M3 review H5): the god's whisper, dream and commands may name a person of `life.ext.bonds` by his id (`T12`), by the id of the
// roster position he stands for (`AL17-2`) or by his name, and what they do reaches the character's answer to that person's crisis (arcs.ts).
// This file is what the god system imports; it changes nothing but the nudge of a crisis.
import type { Ctx } from '../game';
import type { LifeState } from '../types';
import { isChild } from './people';
import { extOf, isLive, tiesOf, type PendingCrisis, type Tie } from './state';
import { NUDGE, NUDGE_YEARS } from './tuning';

const lifeOf = (ctx: Ctx): LifeState | null => {
  const l = ctx.state.life;
  return l && !l.dead ? l : null;
};

/** The ties a god's word can name: alive, with a story of their own or a child (the frame of parents, uncles and cousins is not an ally). */
export function alliesOf(ctx: Ctx): Tie[] {
  const l = lifeOf(ctx);
  if (!l || !ctx.state.life?.ext.bonds) return [];
  return tiesOf(extOf(l)).filter((t) => isLive(t) && (!t.light || isChild(t)));
}

/** The ally a reference names: his tie id, the id of his roster position, or his exact name (the first one when two share it). */
export function findAlly(ctx: Ctx, ref: string): Tie | undefined {
  const r = String(ref ?? '').trim();
  if (!r) return undefined;
  const all = alliesOf(ctx);
  return all.find((t) => t.id === r) ?? all.find((t) => t.npc === r) ?? all.find((t) => t.name === r);
}

export interface Waiting {
  tie: Tie;
  crisis: PendingCrisis;
}

/** The crises announced to the player that the character has not answered yet. */
export function crisesWaiting(ctx: Ctx): Waiting[] {
  const l = lifeOf(ctx);
  if (!l) return [];
  const e = extOf(l);
  return e.crises.flatMap((c) => {
    const tie = e.ties[c.tie];
    return tie && isLive(tie) ? [{ tie, crisis: c }] : [];
  });
}

/** The crisis of this ally that waits for an answer, if any. */
export const crisisOf = (ctx: Ctx, tie: Tie): PendingCrisis | undefined => crisesWaiting(ctx).find((w) => w.tie.id === tie.id)?.crisis;

export type NudgeKind = 'whisper' | 'dream' | 'liar';

/**
 * The god's hand on an ally: the character is more (a whisper `ช่วย`, a dream of the one in trouble) or less (a whisper that the ally lies) ready to help
 * when the ally's crisis is answered. It waits NUDGE_YEARS for a crisis that is not yet announced. Returns the ally, or null when the reference names no one.
 */
export function nudgeCrisis(ctx: Ctx, ref: string, kind: NudgeKind): Tie | null {
  const l = lifeOf(ctx);
  const t = findAlly(ctx, ref);
  if (!l || !t) return null;
  const e = extOf(l);
  const add = NUDGE[kind];
  const old = e.nudges[t.id];
  const bonus = Math.max(-0.4, Math.min(0.4, (old && old.until >= l.hAge ? old.bonus : 0) + add));
  e.nudges[t.id] = { bonus, by: kind, until: l.hAge + NUDGE_YEARS };
  return t;
}
