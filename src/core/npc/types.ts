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
}

export function slotsOf(state: { npcs: NpcState }): Record<string, NpcSlotX> {
  return state.npcs.slots as Record<string, NpcSlotX>;
}
export function npcState(state: { npcs: NpcState }): NpcStateX {
  return state.npcs as NpcStateX;
}
