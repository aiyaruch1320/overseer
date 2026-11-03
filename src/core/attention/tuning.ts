// Numbers of the attention system (docs/systems/experience/07-attention.md). The rules and the three settings come from
// data/gen/attention.json when it is loaded; DEFAULT_* below hold the same numbers so a test that loads only part of the data still runs
// (tests/core/attention.test.ts checks the two agree).
import type { AttentionData, AttentionRule } from '../data/types-attention';
import type { CardKind } from '../types';

/** The kinds of card (07-attention.md §2). `majorOmen` is a ⭐ omen on the character's own continent: a stop when the rules allow, else a card. */
export type { CardKind } from '../types';
export type TriggerKind = 'window' | CardKind;

/** A full life at normal speed in real minutes, and its length in life years (01-one-life.md: 25 to 45 minutes; the sim uses 35). */
export const LIFE_MINUTES = 35;
export const LIFE_YEARS = 75;
/** Real seconds at normal speed that one life year takes: the unit of every gap in the rules. */
export const SEC_PER_YEAR = (LIFE_MINUTES * 60) / LIFE_YEARS;

export const DEFAULT_RULES: Record<'low' | 'normal' | 'high', AttentionRule> = {
  low: { stopGap: 300, merge: 60, cardGap: 120, stopWait: 60, cards: ['prayer', 'crisis', 'majorOmen'], windows: false },
  normal: { stopGap: 180, merge: 60, cardGap: 60, stopWait: 60, cards: null, windows: true },
  high: { stopGap: 90, merge: 60, cardGap: 30, stopWait: 60, cards: null, windows: true },
};

/** How long a waiting card may wait before it is moot, in life years (07-attention.md §3 second table). */
export const DEFAULT_DEADLINES: Record<CardKind, number> = { prayer: 3.5, omen: 2, battle: 2, crisis: 1, majorOmen: 1 };
export const DEFAULT_AGE_STOPS = [5, 15, 30, 50, 70];

/**
 * How much faster the speed `fast` runs. The app clock reads it (src/app/tuning.ts); it is here because the least time a card stays up is counted in
 * real seconds at the fastest speed (07-attention.md §1 rule 6: the annoyance is in the player's seconds, not the character's years).
 */
export const FAST_SPEED_MUL = 3;

/**
 * The least real seconds a card stays on the screen before it runs out, counted at the fastest speed (M5 review round two R1: a battle omen with 0.3 years
 * left at "fast" was gone in two seconds). 07 sets the waits in life years and the gap in real seconds but no floor for a card shown late; this is that floor,
 * about nine seconds, as the review proposed (8 to 10). At normal speed it is three times as long in real time.
 */
export const CARD_MIN_SEC = 9;
export const CARD_MIN_YEARS = (CARD_MIN_SEC * FAST_SPEED_MUL) / SEC_PER_YEAR;

/** Cards on the screen at most (07-attention.md §2): the third waits in the queue of the rules until a place frees. */
export const MAX_CARDS = 2;

/** A prayer is at most two cards at once; the third does not happen (07-attention.md §3). */
export const MAX_WAITING_PRAYERS = 2;

/**
 * The death stop. The scene before the end opens one life year before the age the body fails at (the character system knows that age,
 * `life.ext.character.deathAge`; the player does not), so the last dream still has a living character to reach (god/03-dreams.md §5).
 * A death nobody saw coming (a fight, a story way, an accident) has no such scene: the stop is made when the character dies.
 */
export const NEAR_DEATH_YEARS = 1;

/** Tiers of an enemy that count as "a named enemy" for the battle card (07-attention.md §2: bosses, war, named enemies). */
export const NAMED_TIERS: ReadonlySet<string> = new Set(['บอส', 'ยอดฝีมือ', 'ตำนาน', 'หัวหน้า']);

/**
 * Log entries other systems write that call for a card or a stop, by `sys/kind` (the contract with those systems; code-plan §6.3).
 * The story, world and battle entries exist already. `god/prayer` is what src/core/god/acts/prayers.ts writes when a prayer is raised (level 2;
 * the god system asks `prayersWaiting` first and raises no third one); the bond entries are the names proposed in the attention report.
 */
export const EXTERNAL: Record<string, CardKind> = {
  'god/prayer': 'prayer',
  'bonds/crisis': 'crisis',
  'bondage/escape': 'crisis',
  'combat/prelude': 'battle',
};

export interface AttentionRules {
  rules: Record<'low' | 'normal' | 'high', AttentionRule>;
  deadlines: Record<CardKind, number>;
  ageStops: number[];
}

export function rulesOf(data?: AttentionData): AttentionRules {
  if (!data) return { rules: DEFAULT_RULES, deadlines: DEFAULT_DEADLINES, ageStops: DEFAULT_AGE_STOPS };
  return { rules: data.settings, deadlines: data.deadlines as Record<CardKind, number>, ageStops: data.ageStops };
}
