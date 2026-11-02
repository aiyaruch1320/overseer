// Shapes the combat system passes around (not data/gen shapes: those are in ../data/types-combat.ts).
import type { Mark, Reaction } from '../data/types-combat';

/** Where a fight comes from (04-encounters.md §2 "แบบของเหตุการณ์ต่อสู้"). */
export type FightKind = 'story' | 'travel' | 'raid' | 'clash' | 'hunt' | 'duel' | 'war' | 'dragon' | 'other';

/** Everything a caller may set about one fight. Plain JSON, so a named fight can wait in the state until its day. */
export interface FightOpts {
  kind?: FightKind;
  /** The story node (or clash) that asked for the fight, for the log. */
  node?: string;
  text?: string;
  /** Who has the first beat: the hero (a hunt, an NPC he knew would come) or the foe (an ambush). Unset: the hero rolls to perceive. */
  ambush?: 'hero' | 'foe';
  /** false: the hero is never killed, he yields (a duel with a yield rule, 04 §2 "ดวล"). Default true. */
  lethal?: boolean;
  /** A second fight with the same foe: DC +1 and −1 to the first perception (07-npc-clashes.md §3.1). */
  rematch?: boolean;
  /** People fighting beside the hero (+2 each, up to +4; 01-core.md §4). */
  allies?: number;
  /** `night` `fog` `dense_fog` `water` `home` `holy_ground` `ash_winter`: what the place does (01-core.md §4, 02-type-matrix.md §7). */
  env?: string[];
  /** Added to the foe's DC (a town warned in time: −2; a foe in its lair: +1; a raging foe: +2). */
  dcMod?: number;
  /** The hero protects others (a village, a family): flee ×0.3 and guard ×2 (01-core.md §6). */
  protect?: boolean;
  /** Talk is allowed only when this is true or unset; a clash row whose talk outcome needs a key sets it from `talkKey`. */
  talk?: boolean;
  /** The NPC of a named foe (`MH02-1`), for the log. */
  npc?: string;
  /** false: no loot (a duel, a clash that has its own result rows). Default true. */
  loot?: boolean;
  /** false: write no entries (a simulation that only wants the result). Default true. */
  log?: boolean;
  /** Dragons of the fifteen: the story armour (06-dragon-encounters.md §3). */
  armour?: { broken: boolean };
  /** The stance a god dream named; set by the system from `dreamStance`, a caller may also pass it. */
  dream?: string;
  /** The hero wins but spares the foe (a clash row `win_spare`): no kill, no loot of the kill. */
  spare?: boolean;
  /** A last stand (a way of the story that dies in battle): there is no fleeing, and a hero who is beaten dies (unless a rescue holds). */
  lastStand?: boolean;
  /** A title key to count the win under (`duel` `raid`), 05 §7. */
  tally?: string;
}

export type FightResult = 'win' | 'flawless' | 'talk' | 'tame' | 'draw' | 'flee' | 'lose' | 'dead';

export interface Outcome {
  result: FightResult;
  /** The log result word the story and text know: `win` `lose` `flee` plus `draw` `talk` `tame` `dead`. */
  word: string;
  beats: number;
  hpLost: number;
  hpAfter: number;
  /** Enemy ids fought and the name shown. */
  enemies: string[];
  foe: string;
  /** Stances the hero took, one per beat. */
  stances: string[];
  /** Permanent harm: ids of the curses and the word `scar` / `injury`. */
  wounds: string[];
  /** Loot: items, gifts, `gold+n`, `fame+n`. */
  loot: string[];
  /** The foe was slain (a win that was not a calm or a spare). */
  killed: boolean;
  /** The fight did not happen (the year's cap, the same foe twice in a year, no life). */
  skipped?: boolean;
  /** The perception roll of beat 0 and who had the first beat. */
  first: 'hero' | 'foe' | 'even';
}

export interface Foe {
  ids: string[];
  name: string;
  tier: string;
  tierId: string;
  rewardRow: string;
  wounds: number;
  maxBeats: number;
  dc: number;
  kinds: string[];
  /** Traits: `swarm` `flying` `regen` and the like (from `traits` and the kinds that are not a matrix row). */
  traits: string[];
  weak: Reaction[];
  resist: Reaction[];
  negotiate: { mark: Mark }[];
  /** Attack tags of the foe (`fire` `poison` ...). */
  attack: string[];
  named: boolean;
  npc?: string;
  /** ids of the first enemy of the group, which the loot and the titles follow. */
  lead: string;
  mindless: boolean;
  hardTalk: boolean;
  noTalk: boolean;
  /** Dragons of the fifteen. */
  armour?: boolean;
}
