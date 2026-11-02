// What the chronicle of the lineage opens (08-goals.md §4 "สิ่งที่เปิด"): more choices, never more power. The thresholds are the data's
// (`goals.unlocks`); what each one opens is read from the table UNLOCKS of tuning.ts, whose `at` values a test checks against the data.
import type { Ctx } from '../../game';
import { godData } from '../state';
import { peekGoals } from './state';
import { UNLOCKS } from './tuning';

export interface Unlocked {
  points: number;
  /** Verbs and cores of the conjuring that can be used (ids of `conjure.verbs` and `conjure.cores`). */
  verbs: Set<string>;
  cores: Set<string>;
  /** Vows GV-13 to GV-19 are drawn too. */
  vowSet2: boolean;
  /** Every rhythm of fate may be chosen (the natural one is always there). */
  rhythms: boolean;
  /** Start modes that the chronicle opens (experience/04-start-modes.md). */
  startModes: boolean;
}

/** What `points` open: the first life's verbs and cores (07-conjure.md §5) and each threshold reached. */
export function unlockedAt(ctx: Ctx, points: number): Unlocked {
  const caps = godData(ctx).conjure.caps;
  const u: Unlocked = { points, verbs: new Set(caps.firstLifeVerbs), cores: new Set(caps.firstLifeCores), vowSet2: false, rhythms: false, startModes: false };
  for (const x of UNLOCKS) {
    if (points < x.at) continue;
    x.verbs?.forEach((v) => u.verbs.add(v));
    x.cores?.forEach((c) => u.cores.add(c));
    if (x.vowSet) u.vowSet2 = true;
    if (x.rhythms) u.rhythms = true;
    if (x.startModes) u.startModes = true;
  }
  return u;
}

/** What the lineage of this state has opened. Pure. */
export const unlocked = (ctx: Ctx): Unlocked => unlockedAt(ctx, peekGoals(ctx.state).meta.points);

/** The thresholds this gain crosses, in order (for the line "ที่เปิดใหม่"). */
export function crossed(from: number, to: number): typeof UNLOCKS {
  return UNLOCKS.filter((x) => from < x.at && to >= x.at);
}
