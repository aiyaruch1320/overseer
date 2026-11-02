// What the story system keeps on the life that `LifeState` has no field for: `life.ext.story` (plain JSON).
// The walk itself lives in the contract fields: `life.passed`, `life.pending`, `life.memory`.
import type { Ctx } from '../game';
import type { LifeState, NodeId } from '../types';

export type Key = 'a' | 'b' | 'c';

export interface StoryExt {
  /** Storyline code of the race (`hu`). */
  line: string;
  /** hAge the walk began at: nodes that ended before it are never played. */
  start: number;
  /** Overlay line → decided open (true) or shut (false). Decided once, when the first node of the line is due. */
  open: Record<string, boolean>;
  /** Node → hAge it fires at, drawn when the node first becomes due. */
  fire: Record<NodeId, number>;
  /** Node → the first hAge it could have played (its turn came), so a node that waits for a free year is counted from there. */
  due: Record<NodeId, number>;
  /** Nodes that never played (their condition failed, a jump went over them, another node stood in). */
  skipped: NodeId[];
  /** Jump: years earlier than its table age a node may fire. */
  earlier: Record<NodeId, number>;
  /** Jump with a named choice: `ข้ามไป el.a1 ทาง ก`. */
  force: Record<NodeId, Key>;
  /** Fallback nodes already used. */
  fallbackUsed: NodeId[];
  /** Convergences that were closed at a row and may open again at the next adult node. */
  waiting: NodeId[];
  /** `nodeWeight`: a node (or one side of it, by label) is weighted by this much. */
  nodeMods: { node: NodeId; label?: string; mul: number }[];
  /** `entryMod`: a choice of a convergence that a row set up. */
  entryMods: { to: NodeId; choice: Key; mul: number; cond?: import('../types').Condition }[];
  /**
   * The director's memory of who and what came back (llm/04-story.md §3.1 rule 2): NPCs and events this life met, and the turning
   * points it chose (a job path opened, a bond line, a convergence entered: "ติดตามผู้กล้า", "ชิงตำแหน่ง").
   */
  seen: { npcs: string[]; events: string[]; pivots: string[] };
  jobpaths: { job: string; secret: boolean }[];
  places: string[];
  /** Endings the life earned, by title, as nodes and conditions grant them. One is chosen at death (`ended`); none is announced before. */
  endings: string[];
  /** Title → the line of the node that granted it (an ending of the life's own race line weighs more at death). */
  endingLines: Record<string, string>;
  /** The one ending chosen at death. */
  ended?: string;
  levels: Record<string, number[]>;
  battles: { win: number; lose: number; flee: number };
  checks: { dc: number; roll: number; ok: boolean }[];
  /** The node being applied, so effects that depend on the choice (battleFor, entryMod with no target) can see it. */
  cur?: { id: NodeId; choice: Key | '-' };
  /** Lines opened from outside (`openLine`). */
  external: string[];
  /** Overlay lines whose opening was drawn and passed but wait for a free place (tuning OVERLAY_AT_ONCE, JOURNEY_AT_ONCE). */
  queue: string[];
  /**
   * Nodes with a god window that were announced (a `story/window` entry) and wait to be decided: node → the log number of the announcement and
   * the beats since. The node is decided at the next beat once the attention system has answered (07-attention.md §3), at the latest after
   * WINDOW_MAX_BEATS.
   */
  announced: Record<NodeId, { n: number; beats: number }>;
  /** What this life year already holds: nodes played, battles fought and the enemies fought (tuning NODES_PER_YEAR, BATTLES_PER_YEAR). */
  year: { age: number; nodes: number; battles: number; fought: string[] };
}

export function fresh(): StoryExt {
  return {
    line: '', start: 0, open: {}, fire: {}, due: {}, skipped: [], earlier: {}, force: {}, fallbackUsed: [], waiting: [], nodeMods: [], entryMods: [],
    seen: { npcs: [], events: [], pivots: [] }, jobpaths: [], places: [], endings: [], endingLines: {}, levels: {}, battles: { win: 0, lose: 0, flee: 0 }, checks: [], external: [],
    queue: [], announced: {}, year: { age: -1, nodes: 0, battles: 0, fought: [] },
  };
}

export function lifeOf(ctx: Ctx): LifeState | null {
  const l = ctx.state.life;
  return l && !l.dead ? l : null;
}

/** The extension of the living life, created on first use. */
export function extOf(life: LifeState): StoryExt {
  let e = life.ext.story as StoryExt | undefined;
  if (!e) {
    e = fresh();
    life.ext.story = e;
  }
  // a life saved before these fields existed
  const f = fresh();
  e.seen.pivots ??= f.seen.pivots;
  e.endingLines ??= f.endingLines;
  e.queue ??= f.queue;
  e.due ??= f.due;
  e.year ??= f.year;
  e.announced ??= f.announced;
  return e;
}

export function addOnce(list: string[], id: string): boolean {
  if (list.includes(id)) return false;
  list.push(id);
  return true;
}

/** This life year's count of nodes and battles; it starts again when the age goes up. */
export function yearOf(ex: StoryExt, life: LifeState): StoryExt['year'] {
  if (ex.year.age !== life.hAge) ex.year = { age: life.hAge, nodes: 0, battles: 0, fought: [] };
  return ex.year;
}
