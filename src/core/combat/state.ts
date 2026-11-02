// What the combat system keeps on the life that `LifeState` has no field for: `life.ext.combat` (plain JSON; code-plan §6.1).
// The contract has no hit points, so they live here: `hp`, the long injury, the fights fought, the enemies met, the titles earned.
import type { Ctx } from '../game';
import type { LifeState } from '../types';
import type { FightOpts } from './types';

export interface PendingFight {
  /** Enemy ids and the plain options the fight was queued with (JSON only). */
  enemies: string[];
  opts: FightOpts;
  /** The beat counter (`CombatExt.tick`) at which the fight is fought. */
  due: number;
  /** The log number of the `combat/prelude` entry that announced it. */
  prelude?: number;
}

export interface CombatExt {
  /** Hit points now; `null` until the first beat (birth sets it to the maximum). */
  hp: number | null;
  /** A long injury: maximum hit points down by `amount` until hAge `until` (01-core.md §5 81–90). */
  hurt: { amount: number; until: number } | null;
  /** Beats seen by this system in this life; the clock of the queue and of the cooldowns. */
  tick: number;
  /** Enemy ids the hero has met (and so knows the weak points of; 01-core.md §6). */
  met: string[];
  fights: { win: number; flawless: number; lose: number; flee: number; draw: number; talk: number; tame: number };
  /** Wins counted for the titles of 05-rewards.md §7, by key (`kind:undead` `duel` `raid` `calm` `npc_named` `wild_dragon`). */
  tally: Record<string, number>;
  titles: string[];
  /** Karma gained by quiet wins (05 §6); no stat of that name exists yet, so it is kept here. */
  karma: number;
  /** Fights waiting for their day (named fights, announced by `combat/prelude`). */
  pending: PendingFight[];
  /** NPC clashes by NPC id: how many, and the tick of the last (07-npc-clashes.md §2: one a season, two a life). */
  clashes: Record<string, { n: number; last: number; result: string }>;
  /** Bosses fought this life year (04 §1: one a year) and the age of that year. */
  bossYear: { age: number; n: number };
  /** The stance a dream names for the next fight (03-dreams.md §5 "ก่อนศึก"): set by `dreamStance`, spent by the next fight. */
  dream?: { stance: string; until: number };
  /** Rescues spent (`rewind` works once a life). */
  rewound?: boolean;
  /** Companions the hero calmed or tamed and could take (id of the species). */
  tamed: string[];
}

export function fresh(): CombatExt {
  return {
    hp: null,
    hurt: null,
    tick: 0,
    met: [],
    fights: { win: 0, flawless: 0, lose: 0, flee: 0, draw: 0, talk: 0, tame: 0 },
    tally: {},
    titles: [],
    karma: 0,
    pending: [],
    clashes: {},
    bossYear: { age: -1, n: 0 },
    tamed: [],
  };
}

export function lifeOf(ctx: Ctx): LifeState | null {
  const l = ctx.state.life;
  return l && !l.dead ? l : null;
}

/** The extension of a life, created on first use. */
export function extOf(life: LifeState): CombatExt {
  let e = life.ext.combat as CombatExt | undefined;
  if (!e) {
    e = fresh();
    life.ext.combat = e;
  }
  const f = fresh();
  e.pending ??= f.pending;
  e.clashes ??= f.clashes;
  e.tamed ??= f.tamed;
  e.tally ??= f.tally;
  e.titles ??= f.titles;
  e.met ??= f.met;
  e.bossYear ??= f.bossYear;
  return e;
}

export const bump = (tally: Record<string, number>, key: string, by = 1): void => {
  tally[key] = (tally[key] ?? 0) + by;
};
