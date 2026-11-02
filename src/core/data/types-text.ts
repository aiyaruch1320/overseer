// Shapes of data/gen/names.json templates-god.json templates-ending.json (code-plan §5.1). Owned by the text generator.
import type { GenFile } from '../types';

export interface WordBank {
  /** `image.fire.warm` `verbMod.create` `mr.MR-17.time` ... */
  id: string;
  group: string;
  /** What splits the bank (core, verb, tone, continent, weapon kind ...). */
  key: string;
  /** Number the doc prints in the header, e.g. `(8)`. */
  declared: number | null;
  words: string[];
  /** Words marked with * in the doc (checked against collisions). */
  starred: string[];
  src: string;
}

export interface NamesData {
  counts: { words: number; banks: number; declared: number };
  /** The sentence that fixes the total. */
  excludes: string;
  banks: WordBank[];
  overview: { slot: string; template: string; splitBy: string; banks: string; wordsPerBank: string; section: string }[];
  tones: { id: string; use: string; style: string }[];
  recipes: { name: string; formula: string }[];
  rules: { section: string; rows: string[][] }[];
  tables: { headings: string[]; header: string[]; rows: string[][]; src: string }[];
}

export interface Template {
  id: string;
  family: string;
  /** Row keys (symbol, tone, hint, kind ...). */
  keys: Record<string, string>;
  /** The column the text sits in (`แบบ ก`, `ลาง 2`). */
  col: string;
  text: string;
  /** Several-line templates (vow pages) keep each line. */
  lines?: string[];
  /** Slots `{ชื่อตัวละคร}` used by the text, in order of first use, no duplicates. */
  slots: string[];
  /** The condition column of the doc ("ใช้เมื่อ") when there is one. */
  when?: string;
  src: string;
}

export interface Slot {
  slot: string;
  meaning: string;
  when?: string;
  group?: string;
  src: string;
}

export interface TemplateFamily {
  id: string;
  name: string;
  section: string;
  count: number;
  /** Number the doc states for this family. */
  declared: number | null;
}

export interface TemplatesData {
  counts: { templates: number; families: number; slots: number; declared: number };
  families: TemplateFamily[];
  slots: Slot[];
  /** Every slot used in a template appears in the slot list (doc check "ช่องครบ"). */
  unknownSlots: string[];
  rules: { section: string; rows: string[][] }[];
  templates: Template[];
  /** Word lists stored as values of a slot, not counted as templates. */
  lists: { id: string; header: string[]; rows: string[][]; src: string }[];
  tables: { headings: string[]; header: string[]; rows: string[][]; src: string }[];
}

export type NamesFile = GenFile<NamesData>;
export type TemplatesGodFile = GenFile<TemplatesData>;
export type TemplatesEndingFile = GenFile<TemplatesData>;
