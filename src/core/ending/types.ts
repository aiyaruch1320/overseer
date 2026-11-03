// The shapes of the ending (docs/systems/experience/03-ending-and-collection.md §1, docs/systems/llm/07-ending-templates.md §5):
// plain JSON only, so the card sits in the save (state.lineage.x.cards) and the llm layer can read and replace its text.

/** What wrote a piece of text. The llm layer replaces `template` by `llm`; the facts never change. */
export type TextSource = 'template' | 'llm';

export interface SourcedText {
  text: string;
  source: TextSource;
}

/** The answer a life gave to its question (07 §5.3). */
export type QuestionGrade = 'good' | 'bad' | 'open' | 'early' | 'changed';

/** The five groups a cause of death is shortened to (07 §2.5). */
export type CauseGroup = 'ชราภาพ' | 'ศึก' | 'ป่วย' | 'อุบัติเหตุ' | 'เสียสละ';

/** The level of a life's mark on the world (03 §2). */
export type WorldMark = 'none' | 'local' | 'era';

export type FactPos = 'start' | 'mid' | 'end' | 'after';
export type FactDir = 'gain' | 'loss' | 'mid';

/** One true thing the log says about the life (07 §2.2). The text of a sentence is built from `slots` only. */
export interface SummaryFact {
  /** Kind of fact in the words of the doc: `เกิด` `ความตาย` `จุดบรรจบ` `อาชีพลับ` ... */
  kind: string;
  base: number;
  /** Score after the bonuses and penalties of 07 §2.3 when it was chosen. */
  score: number;
  dir: FactDir;
  pos: FactPos;
  age?: number;
  /** The values of the slots, as strings the sentences print. */
  slots: Record<string, string | number>;
  /** The sentence the template tier wrote for this fact (empty when no template fit). */
  sentence: string;
  /** Id of the template used (`life_fact.ความตาย|4.ประโยค`). */
  template: string;
}

/** A moment shown on the card: three lines of at most 36 characters (07 §5.4). */
export interface Moment {
  kind: string;
  age?: number;
  line: string;
}

/** What the hand of the god did in this life (03 §1 "มือของพระเจ้า"). */
export interface HandSummary {
  total: number;
  byKind: Record<string, number>;
  /** The intervention that changed the life most, by the fixed order of kinds (assumption: the doc leaves "most" to the god system). */
  top?: { kind: string; age?: number; id: string; /** The name the god gave a miracle he conjured. */ name?: string };
  /** The names of the miracles the god conjured in this life (the world remembers them: 07 §6). */
  conjured?: string[];
  /** Prayers that were not answered. */
  silent: number;
}

/**
 * A life the player ordered (character/19-wish.md §6: the card shows it as "ถูกสั่ง"): the words he typed, what the birth gave (a sure ask is `sure`, a weight is
 * `lean`) and what it could not (with the reason). Read from the saved sheet `life.ext.character.wish`; absent for a life nobody ordered.
 */
export interface WishOnCard {
  text: string;
  granted: { field: string; value: string; row: 'sure' | 'lean' }[];
  refused: { field: string; value: string; reason: string }[];
}

/** The numbers and ids the llm layer reads: `endingInput(state)`. Stable: the keys do not change between versions. */
export interface EndingInput {
  v: 1;
  seed: number;
  life: { id: string; name: string; race: string; raceName: string; gender: string; home: string; homeName: string; bornYear: number; diedYear: number; age: number; cls: string; job: string };
  death: { cause: string; group: CauseGroup; place: string; enemy?: string };
  ending?: string;
  question: { text: string; grade: QuestionGrade };
  /** The facts the summary tells, in the order it tells them (born first, death near the end). The llm may reword; it may not add a fact. */
  facts: Omit<SummaryFact, 'sentence' | 'template'>[];
  /** Three candidates for the three moments of the card, by score. */
  moments: Moment[];
  hand: HandSummary;
  /** The family: generation, parent, heir, threads handed on. */
  lineage: { dynasty: string; generation: number; parent?: string; heir?: string; threads: string[] };
  /** The titles of the life (08-goals §3) and the vow with its result: the retelling may use them and may not add a title or a vow. */
  titles: string[];
  vow?: { name: string; result: 'kept' | 'broken'; lines: string[] };
  /** The people of the life and the traces it left (the lines of the card). */
  people: string[];
  traces: string[];
  /** The wish of the player, when the life was ordered: the retelling may say the life was asked for, and may not add what was not given. */
  wish?: WishOnCard;
  /** Names in the registry of the world that the text may use (no other name is allowed). */
  names: string[];
  /** Names of other people in this world that the text may not use for this life (the neighbours, the kin of the earlier lives): a retelling that takes one is wrong. */
  others: string[];
  /** Entries of the collection this life opened for the first time. */
  earned: string[];
}

export interface EndingCard {
  v: 1;
  life: string;
  generation: number;
  name: string;
  race: string;
  home: string;
  bornYear: number;
  diedYear: number;
  age: number;
  cause: string;
  group: CauseGroup;
  /** The ending title chosen at death by the story system (storylines "ปลายทาง"), the title of the life. */
  ending: string | null;
  question: { text: string; grade: QuestionGrade; line: string };
  /** Line 2 of the card. */
  titleLine: string;
  moments: Moment[];
  /** Facts the summary tells (with their sentences). */
  facts: SummaryFact[];
  /** One paragraph, at most 6 sentences and 600 characters (07 §10.2). The llm layer may replace it. */
  summary: SourcedText;
  epitaph: SourcedText;
  hand: HandSummary;
  /** Collection entries this life opened (ids like `node:hu.b1`). */
  earned: string[];
  mark: { level: WorldMark; label: string };
  /** The card as lines of text, in the order of 07 §5.1 (lines that do not apply are left out). */
  lines: string[];
  /** Heir and threads, filled by the lineage system after the death. */
  heir?: { name: string; how: string; age: number };
  threads: string[];
  /** The titles of the life that the goals gave at the death (08-goals §3), one to three; empty when none holds. */
  titles: string[];
  /** The vow of the life and what came of it: its page (07 §7) and its line on the card. Absent when the player took no vow. */
  vow?: { id: string; name: string; result: 'kept' | 'broken'; head: string; lines: string[]; line: string; /** A broken vow: what it lacked, from the goals judge (M5 review round two R3). */ missing?: string[] };
  /** "ผู้คน" of 03 §1: the people of the life and how they stood when the character left. */
  people: string[];
  /** "ร่องรอยที่ทิ้งไว้" of 03 §1: the children, the things left, the threads, what the world keeps. */
  traces: string[];
  /** The life was ordered (19-wish.md §6 "ถูกสั่ง"): what was asked, what the birth gave and what it refused. Absent for a life nobody ordered. */
  wish?: WishOnCard;
}
