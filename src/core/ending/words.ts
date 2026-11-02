// Choosing the tier 0 words of the ending (docs/systems/llm/07-ending-templates.md §10): the same seed gives the same words, no stream is drawn
// (the choice is a hash of the seed, the life and the kind, §10.3 rule 6), a template used in this save does not come again until the others
// of its kind are used up (rule 1), and a template is used once inside a piece (rule 2).
import { dataOf, type Ctx } from '../game';
import type { Template, TemplatesData } from '../data/types-text';
import { fill, type SlotValues } from '../text/pick';
import { hashText } from '../text/plain';
import { lx } from '../lineage/state';
import { FLAG_WORD } from './tuning';

/** How many ids the save remembers; older ones are forgotten (the oldest come back first anyway). */
const MEMORY = 900;

const cache = new WeakMap<object, Map<string, Template[]>>();

/** The templates of a family (all of them, in data order). Empty when the template file is not loaded. */
export function family(ctx: Ctx, id: string): Template[] {
  if (!ctx.data['templates-ending']) return [];
  const data = dataOf<TemplatesData>(ctx, 'templates-ending');
  let by = cache.get(data);
  if (!by) {
    by = new Map();
    for (const t of data.templates) (by.get(t.family) ?? by.set(t.family, []).get(t.family)!).push(t);
    cache.set(data, by);
  }
  return by.get(id) ?? [];
}

/** The word of the doc for each flag of a fact. */
export const flagWords = (flags: string[]): Set<string> => new Set(flags.map((f) => FLAG_WORD[f] ?? f));

/** Does the "ใช้เมื่อ" cell of a template hold for these flags? A cell may add the slot it needs (`ศึก มี {enemy}`): that is checked by filling. */
export function whenHolds(t: Template, words: Set<string>): boolean {
  if (!t.when) return true;
  const base = t.when.replace(/\s*มี\s*\{[^}]+\}/, '').trim();
  return base === '' || words.has(base);
}

export interface Pick {
  id: string;
  text: string;
}

export interface PickOpts {
  /** What goes into the hash with the seed: the life id and the kind. */
  key: string;
  /** Ids used inside this piece already. */
  local?: Set<string>;
  /** Longest text allowed. */
  max?: number;
  words?: Set<string>;
  /** Do not use these ids (the connectors used in this summary). */
  skip?: Set<string>;
}

/** Picks one template of the candidates that fills, fits and has not been used; null when none fits. Marks it used in the save. */
export function pickFrom(ctx: Ctx, cands: Template[], slots: SlotValues, o: PickOpts): Pick | null {
  const ok: Pick[] = [];
  for (const t of cands) {
    if (o.words && !whenHolds(t, o.words)) continue;
    if (o.local?.has(t.id) || o.skip?.has(t.id)) continue;
    const text = fill(t.text, slots);
    if (text === null || (o.max !== undefined && [...text].length > o.max)) continue;
    ok.push({ id: t.id, text });
  }
  if (!ok.length) return null;
  const x = lx(ctx.state);
  const fresh = ok.filter((c) => !x.used.includes(c.id));
  let chosen: Pick;
  if (fresh.length) chosen = fresh[hashText(`${ctx.state.seed}|${o.key}`) % fresh.length];
  else {
    // all used: the one used longest ago comes first
    chosen = [...ok].sort((a, b) => x.used.indexOf(a.id) - x.used.indexOf(b.id))[0];
  }
  o.local?.add(chosen.id);
  const at = x.used.indexOf(chosen.id);
  if (at >= 0) x.used.splice(at, 1);
  x.used.push(chosen.id);
  if (x.used.length > MEMORY) x.used.splice(0, x.used.length - MEMORY);
  return chosen;
}

/** The age group a connector of time is chosen by (07 §4.1). */
export function timeGroup(age: number | undefined): string {
  const a = age ?? 30;
  return a <= 12 ? 'ทารกและเด็ก (0 ถึง 12)' : a <= 19 ? 'วัยรุ่น (13 ถึง 19)' : a <= 54 ? 'ผู้ใหญ่ (20 ถึง 54)' : 'ผู้เฒ่า (55 ขึ้นไป)';
}
