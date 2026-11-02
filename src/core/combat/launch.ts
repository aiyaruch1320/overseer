// Starting a fight: the year's cap (04-encounters.md §1), the call before a fight with a name (07-attention.md §2), and the queue the
// call waits in so that the god has a beat or two to whisper before the blades meet.
import type { Ctx } from '../game';
import { write } from '../log';
import { extOf as storyExt, yearOf } from '../story/state';
import { BATTLES_PER_YEAR } from '../story/tuning';
import { foeOf } from './foe';
import { resolve, type Fought } from './fight';
import { extOf, lifeOf } from './state';
import { warOn } from './warflag';
import { PRELUDE_BEATS, SOLDIER_JOBS } from './tuning';
import type { FightOpts } from './types';

/** Fights in one life year: 4, or 8 for a soldier in a war and an adventurer (04 §1). The count is the story's own so that story fights and random ones share it. */
export function capOf(ctx: Ctx): number {
  const l = lifeOf(ctx);
  if (!l) return 0;
  const war = warOn(ctx, l.country);
  const wide = l.job === 'adventurer' || (!!l.job && SOLDIER_JOBS.has(l.job) && war);
  return wide ? BATTLES_PER_YEAR * 2 : BATTLES_PER_YEAR;
}

/**
 * Takes places in the year for the enemies not yet fought this year. Returns the ones to fight, or [] when the year is full or all were
 * fought already (the battle of a node's notes and the battle of the way it chose often name the same enemy; M1 review S2).
 */
export function admit(ctx: Ctx, ids: readonly string[]): string[] {
  const life = lifeOf(ctx);
  if (!life) return [];
  const y = yearOf(storyExt(life), life);
  const fresh = ids.filter((e) => !y.fought.includes(e));
  if (!fresh.length || y.battles >= capOf(ctx)) return [];
  y.battles++;
  y.fought.push(...fresh);
  return fresh;
}

/** True while the year still has room (a clash may be put off to the next season when it does not; 07-npc-clashes.md §2). */
export function hasRoom(ctx: Ctx): boolean {
  const life = lifeOf(ctx);
  if (!life) return false;
  return yearOf(storyExt(life), life).battles < capOf(ctx);
}

export type Launched = { how: 'done'; fought: Fought } | { how: 'queued'; due: number } | { how: 'skipped' };

/**
 * Fights the enemies now, or, when the fight has a name (`announce`), writes the call `combat/prelude` and puts the fight in the queue
 * for PRELUDE_BEATS beats later. The places in the year are taken by the caller (`admit`).
 */
export function launch(ctx: Ctx, ids: readonly string[], opts: FightOpts, announce: boolean): Launched {
  const life = lifeOf(ctx);
  const foe = foeOf(ctx, ids);
  if (!life || !foe) return { how: 'skipped' };
  if (!announce) return { how: 'done', fought: resolve(ctx, foe, opts) };
  const ext = extOf(life);
  const e = write(ctx.state, {
    sys: 'combat',
    kind: 'prelude',
    id: foe.ids.join(','),
    data: { enemies: foe.ids.join(','), foe: foe.name, tier: foe.tier, node: opts.node ?? null, kind: opts.kind ?? 'other', text: opts.text ?? null },
    level: 2,
  });
  const due = ext.tick + PRELUDE_BEATS;
  ext.pending.push({ enemies: [...foe.ids], opts: { ...opts }, due, prelude: e.n });
  return { how: 'queued', due };
}

/** Fights that are due this beat (the day after their call). */
export function flush(ctx: Ctx): void {
  const life = lifeOf(ctx);
  if (!life) return;
  const ext = extOf(life);
  const due = ext.pending.filter((p) => p.due <= ext.tick && !p.clash);
  if (!due.length) return;
  ext.pending = ext.pending.filter((p) => p.due > ext.tick || p.clash);
  for (const p of due) {
    if (!lifeOf(ctx)) return;
    const foe = foeOf(ctx, p.enemies);
    if (foe) resolve(ctx, foe, p.opts);
  }
}
