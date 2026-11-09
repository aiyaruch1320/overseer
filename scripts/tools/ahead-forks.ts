// Which forks of the other key kinds (an NPC's follow-up, the burden of the heart) were played in one beat. Their plain rolls leave no log line with an id, so a tool reads the state
// before the beat and after it: a follow-up that waited and now is open, and the burden counter that went up. The ids are the ones `directorAhead` gives.
import type { Ctx } from '../../src/core/game';
import { rowOf } from '../../src/core/npc/data';
import { checkDream, offersNow, sendDream } from '../../src/core/god';
import { followId } from '../../src/core/npc/ties';
import { slotsOf } from '../../src/core/npc/types';

export interface ForkMark {
  waiting: Map<string, string>;
  burdens: number;
}

export function markForks(ctx: Ctx): ForkMark {
  const waiting = new Map<string, string>();
  for (const [rid, slot] of Object.entries(slotsOf(ctx.state))) {
    const row = rowOf(ctx, rid);
    if (slot.follow?.state === 'wait' && row) waiting.set(rid, followId(row, slot.follow));
  }
  return { waiting, burdens: ctx.state.god?.counters?.['l.burden'] ?? 0 };
}

/** The ids of the forks that were drawn between `before` and now. */
export function forksSince(ctx: Ctx, before: ForkMark): string[] {
  const out: string[] = [];
  const slots = slotsOf(ctx.state);
  for (const [rid, id] of before.waiting) {
    const f = slots[rid]?.follow;
    if (f && f.state !== 'wait') out.push(id);
  }
  const n = ctx.state.god?.counters?.['l.burden'] ?? 0;
  for (let k = before.burdens + 1; k <= n; k++) out.push(`heart:${k}`);
  return out;
}

/**
 * A god who always dreams against his nature: sends the first offered way that goes against the character whenever the rules let him (cap, pending, price). Without a dreamer a life never
 * reaches a burden of the heart, so the scans and tests of the `heart` kind drive one. Returns true when a dream was sent.
 */
export function dreamAgainst(ctx: Ctx): boolean {
  const life = ctx.state.life;
  if (!life || life.dead) return false;
  const offers = offersNow(ctx);
  const i = offers.findIndex((o) => o.fit < 0);
  if (i < 0) return false;
  const args = { path: i + 1 };
  if (checkDream(ctx, args) !== null) return false;
  sendDream(ctx, args);
  return true;
}
