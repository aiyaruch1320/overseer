// Runtime shape of the NPC state. src/core/types.ts gives NpcSlotState only the fields every system shares;
// the NPC system keeps its own fields on the same objects (plain JSON, saved with the state).
// Proposal for the contract: move these fields into NpcSlotState / NpcState in types.ts.
import type { NpcSlotState, NpcState } from '../types';
import type { PathKey } from '../data/types-npcs';

export type { PathKey };

/** One story of one holder (README §2.1). */
export interface Story {
  /** wait: the clock has not reached the opening point · open: inside the 20% window · done: resolved. */
  state: 'wait' | 'open' | 'done';
  /** How it opened: the holder's age clock or the world event the row names. */
  mode: 'age' | 'event';
  /** World year the story opens (age clock). */
  openAt: number;
  /** World year the window closes, set when it opens. */
  endAt: number | null;
  /** The main character was in the zone (the country) while the story was open. */
  mc: boolean;
  /** Changes made by clash results (`npcPath`): cut paths, weight additions, weight factors, a forced path. */
  cut: PathKey[];
  add: Partial<Record<PathKey, number>>;
  mul: Partial<Record<PathKey, number>>;
  force?: PathKey;
  /** The path it ended with, `-` when nothing happened (rest, or every path cut). */
  result?: PathKey | '-';
  /** README §2.2 item 2(ค): paths that got +10 because a tied story ended on the same event (the others shrink so the total stays). */
  boost?: PathKey[];
  /** The main character has been looked at for this story once (the meeting rate per life year, tuning MEET_FULL_RATE). */
  seen?: boolean;
  /** Life years the main character spent in the zone while the story was open (a clash of kind X rolls its yearly chance that many times). */
  mcYears?: number;
}

/** README §2.2 item 3: the story that follows when a tied NPC's end took the holder of another story. */
export interface Follow {
  /** The position whose end started it, and who did it: the main character, a world event, another NPC (`doerId`) or the god. */
  of: string;
  doer: 'mc' | 'npc' | 'event' | 'god';
  doerId?: string;
  state: 'wait' | 'open' | 'done';
  openAt: number;
  endAt: number | null;
  /** The path drawn when it opened: a revenge · b takes over the goal · c lets go. */
  kind?: PathKey;
}

/** A newcomer: the template, the people of the holder and the number in the id (succession.md §5). */
export interface NewcomerInfo {
  tpl: string;
  people: string | null;
  seq: number;
  /** World year the template was drawn. */
  year: number;
}

export type SlotStatus = 'absent' | 'alive' | 'dead' | 'gone';

export interface NpcSlotX extends NpcSlotState {
  /** Name of the current holder: the roster name for generation 1, "<name>ที่ N" after. */
  name: string;
  gen: number;
  status: SlotStatus;
  /** World year of birth (negative before the start) and natural lifespan in world years. */
  born: number;
  span: number;
  died?: number;
  cause?: string;
  /** Does this row get successors at all (tier 3 rolled once at the start, others always). */
  refill: boolean;
  /** Key keepers have no successor when they die or vanish in the last era. */
  keeper: boolean;
  story: Story;
  /** The row's event has fired and the story of the holder at that time was started by it (once per world). */
  evFired: boolean;
  /** Generation of the holder that got the event story. */
  evGen?: number;
  /** What the 20% table of succession.md §3.1 changed for this holder. */
  twist?: string;
  /** Home place of the row, to tell a moved holder. */
  home: string;
  /** Gravely ill since this world year (old age, a path of the story, a plague). It ends with death, a recovery or `healNpc`. */
  sick?: number;
  /** An illness (not old age) ends at this world year: the holder dies or recovers. */
  sickEnd?: number;
  /** No new illness of old age before this world year (after a recovery). */
  immune?: number;
  /** Set when the slot is a newcomer (NT-xx, succession.md §5). */
  nt?: NewcomerInfo;
  /** The story that follows (README §2.2 item 3). */
  follow?: Follow;
  /** Clashes of this NPC with the main character in this life: how many and how the last ended (combat/07 §2 common rules). */
  clash?: { n: number; last?: string; at?: number };
}

export interface NpcStateX extends NpcState {
  /** World year up to which stories were advanced. */
  last: number;
  /** Last era sub-period the fate table was rolled for (`4ก` `4ข` `4ค`) and the year of that roll. */
  phase?: string;
  phaseAt?: number;
  rollAt?: number;
  /** Write trace entries (level 0) too, also while no main character lives. Off by default: a world run would write thousands. */
  trace?: boolean;
  /** Newcomers (succession.md §5): the 100-year block, the era tag and the era-4 roll already handled, the templates used per country, the last number per country. */
  ntBlock?: number;
  ntEra?: string;
  ntRollAt?: number;
  ntUsed?: Record<string, string[]>;
  ntSeq?: Record<string, number>;
}

export function slotsOf(state: { npcs: NpcState }): Record<string, NpcSlotX> {
  return state.npcs.slots as Record<string, NpcSlotX>;
}
export function npcState(state: { npcs: NpcState }): NpcStateX {
  return state.npcs as NpcStateX;
}
