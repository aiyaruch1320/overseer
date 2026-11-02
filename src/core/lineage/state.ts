// What the lineage keeps (docs/lore/heirs/, docs/systems/experience/05-world-across-lives.md): plain JSON in the save.
// `GameState.lineage` (types.ts) has four fields: `lives` (one line per life), `open` (the texts of the open threads), `chronicle` (the lines of the
// chronicle of the family) and `collection` (the ids of the collection). The rest lives under `state.lineage.x` (`LineageState.x` in types.ts), typed here. A save of a lineage is the whole state, so a lineage replays from a save made in the middle of any life.
import type { EndingCard, EndingInput } from '../ending/types';
import type { GameState, LifeState, NodeId } from '../types';

/** How a life began (04-start-modes.md "ผู้สืบตระกูล"). */
export type Origin = 'first' | 'heir' | 'successor' | 'newcomer';

/** The rungs of "เมื่อตระกูลสิ้น" (heirs/01-inheritance.md §6) plus the child itself. */
export type HeirHow = 'child' | 'adopted' | 'student' | 'partner' | 'helped' | 'newcomer';

/** Who takes over when the main character dies. Chosen at the death (`pickHeir`), used by `nextLife`. */
export interface HeirSpec {
  how: HeirHow;
  /** Rung of the ladder: 0 child · 1 adopted or student · 2 partner · 3 someone helped · 4 nobody (newcomer, only by the choice of the player). */
  rung: 0 | 1 | 2 | 3 | 4;
  /** Id of the tie in the bond book of the dead life. */
  tie?: string;
  name: string;
  race: string;
  gender: 'm' | 'f' | 'n';
  country: string;
  /** Life years of the heir at the moment of the death. */
  age: number;
  /** Gratitude and trust toward the dead character (a child of the blood has them from the start). */
  blood: boolean;
}

export type ThreadState = 'open' | 'closed' | 'dropped' | 'legend' | 'faded';

/** An open thread (heirs/03-open-threads.md). */
export interface Thread {
  id: string;
  /** One of the eight kinds of §1: หนี้ ศึกสายเลือด สัญญา คำมั่น ที่มั่น ของที่ยังไม่ส่ง ความลับ ศิษย์ของผู้อื่น. */
  kind: string;
  text: string;
  /** The life that left it, and the generation it was left in. */
  from: string;
  gen: number;
  /** The weight it was chosen with (§2). */
  weight: number;
  state: ThreadState;
  /** The generations that carried it and dropped it; after two it becomes a legend (§3). */
  dropped: number;
  /** The id in the source (a tie id, a curse id). */
  ref?: string;
  /** The life that carries it now, the age it meets it at, and how it went (`closed` or `dropped`) once it did. */
  holder?: string;
  due?: number;
  tried?: 'closed' | 'dropped';
}

/** The book of the family (heirs/02-no-repeat.md §2): what the lives of the family have walked. */
export interface Book {
  /** Node → the way taken (the latest life that walked it). */
  nodes: Record<NodeId, string>;
  /** Nodes that stand for a world event or a convergence: the heir does not walk them again. */
  burnt: NodeId[];
  /** Convergence points entered. */
  converge: NodeId[];
  /** World events the family was part of (seen by a life). */
  events: string[];
  /** Endings earned (an ending is not earned twice, 02 §6). */
  endings: string[];
  jobs: string[];
  secretJobs: string[];
  weapons: string[];
  /** NPC ties that carried gratitude or a grudge when a life ended: name → { gratitude, grudge }. */
  npcs: Record<string, { gratitude: number; grudge: number }>;
}

/** One life in the lineage, beside the short line `LineageState.lives` keeps. */
export interface LifeRec {
  id: string;
  generation: number;
  origin: Origin;
  /** The id of the life it follows. */
  parent?: string;
  /** hAge the life began at (an heir does not begin at 0), and the world year the player took it over. */
  startAge: number;
  startYear: number;
  age: number;
  cause: string;
  ending?: string;
  /** Log numbers: the life's entries are those from `startN` up to `endN`. */
  startN: number;
  endN: number;
  heir?: string;
  threads: string[];
  /** Gold, gifts and items that went to the heir, as a short report of what was carried. */
  carried?: { gold: number; items: number; blessing?: string; fame: number; faith: number; threads: number };
}

export interface LineageX {
  v: 1;
  /** The name the family is known by: the first life's name (assumption: the docs name no family name). */
  dynasty: string;
  recs: LifeRec[];
  cards: Record<string, EndingCard>;
  /** What the llm layer reads for each card (`endingInput`). */
  inputs: Record<string, EndingInput>;
  threads: Thread[];
  book: Book;
  /** The heir chosen when the last life died, and the tie the player picked (heirs/01 §1: the player picks, else the eldest). */
  heir: HeirSpec | null;
  pick?: string;
  /** Set when the family has no heir left (and the player did not ask for a newcomer). */
  extinct?: { generation: number; year: number };
  /** World years that passed between one life and the next, beside the world steps. */
  gaps: { from: string; to: string; years: number }[];
  /** Templates the ending and the chronicle used in this save (07 §10.3 rule 1): a template does not come again until the others of its kind are used. */
  used: string[];
  /** The object cross-life systems keep (the goals of the god: `onLifeChange`). Plain JSON; this system never reads it. */
  carry: Record<string, unknown>;
  /** The nodes the book set as passed in the life now living (they are not the life's own nodes). */
  preset: NodeId[];
  /** How the life being born began; read by the birth hook of the lineage system and cleared. */
  begin?: { origin: Origin; parent?: string };
  /** Start modes the player has seen unlocked. */
  modes: string[];
}

export const fresh = (): LineageX => ({
  v: 1,
  dynasty: '',
  recs: [],
  cards: {},
  inputs: {},
  threads: [],
  book: { nodes: {}, burnt: [], converge: [], events: [], endings: [], jobs: [], secretJobs: [], weapons: [], npcs: {} },
  heir: null,
  gaps: [],
  used: [],
  carry: {},
  preset: [],
  modes: [],
});

/** The extension of the lineage, created on first use. */
export function lx(state: GameState): LineageX {
  const l = state.lineage;
  if (!l.x) l.x = fresh();
  return l.x;
}

export const hasX = (state: GameState): boolean => !!state.lineage.x;

/** The record of a life by its id. */
export function recOf(state: GameState, id: string): LifeRec | undefined {
  return lx(state).recs.find((r) => r.id === id);
}

export const generationOf = (state: GameState, life: LifeState | null = state.life): number => {
  const x = lx(state);
  const r = life ? x.recs.find((q) => q.id === life.id) : undefined;
  return r?.generation ?? state.lineage.lives.length + (life && !life.dead ? 1 : 0);
};
