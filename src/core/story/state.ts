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
  /** NPCs and events this life met, by id (the director's memory of who and what came back). */
  seen: { npcs: string[]; events: string[] };
  jobpaths: { job: string; secret: boolean }[];
  places: string[];
  endings: string[];
  levels: Record<string, number[]>;
  battles: { win: number; lose: number; flee: number };
  checks: { dc: number; roll: number; ok: boolean }[];
  /** The node being applied, so effects that depend on the choice (battleFor, entryMod with no target) can see it. */
  cur?: { id: NodeId; choice: Key | '-' };
  /** Lines opened from outside (`openLine`). */
  external: string[];
}

export function fresh(): StoryExt {
  return {
    line: '', start: 0, open: {}, fire: {}, skipped: [], earlier: {}, force: {}, fallbackUsed: [], waiting: [], nodeMods: [], entryMods: [],
    seen: { npcs: [], events: [] }, jobpaths: [], places: [], endings: [], levels: {}, battles: { win: 0, lose: 0, flee: 0 }, checks: [], external: [],
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
  return e;
}

export function addOnce(list: string[], id: string): boolean {
  if (list.includes(id)) return false;
  list.push(id);
  return true;
}
