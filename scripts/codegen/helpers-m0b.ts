// Small helpers shared by the M0-b generators (items, combat, economy, god, attention, text).
// They sit beside run-all.ts (not in groups/, which run-all treats as one generator per file, and not in lib/, which the lead owns).
import { tables, readDoc, rel, Unparsed, type Row, type Table } from './lib/table';

export const STATS = ['pow', 'mag', 'spd', 'luk', 'int', 'vit'] as const;

/** Every `backticked` token in a cell. */
export const ticks = (s: string): string[] => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

/** Numbers in a cell, `−` read as a minus sign, thousands commas removed. */
export const nums = (s: string): number[] => [...s.replace(/(\d),(\d{3})/g, '$1$2').matchAll(/[+\-−]?\d+(?:\.\d+)?/g)].map((m) => Number(m[0].replace('−', '-')));
export const num = (s: string): number | null => nums(s)[0] ?? null;

/** `pow+1 spd-1` tokens → { pow: 1, spd: -1 }. */
export function statsOf(cell: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of ticks(cell)) {
    const m = t.match(/^([a-z]+)([+\-−]\d+)$/);
    if (m && (STATS as readonly string[]).includes(m[1])) out[m[1]] = (out[m[1]] ?? 0) + Number(m[2].replace('−', '-'));
  }
  return out;
}

/** Backticked tokens that are not stat changes (attack tags, element tags, `#tags`). */
export const tagsOf = (cell: string): string[] => ticks(cell).filter((t) => !/^[a-z]+[+\-−]\d+$/.test(t));

export const dash = (s: string) => (s === '—' || s === '-' || s === '–' ? '' : s);

/** Table (by file + heading regexp + first header cell). Throws when there is none so a doc change cannot silently empty the data. */
export function findTable(file: string, head: RegExp | null, first?: string, nth = 0): Table {
  const hits = tables(file).filter((t) => (!head || head.test(t.headings.slice(1).join(' > '))) && (first === undefined || t.header[0] === first));
  if (!hits[nth]) throw new Error(`table not found: ${file} ${head ?? ''} ${first ?? ''} #${nth}`);
  return hits[nth];
}

export type Rec = Record<string, string> & { _line: number };

/** Rows of a table as objects: keys[i] names column i. */
export function recs(t: Table, keys: string[]): Rec[] {
  return t.rows.map((r: Row) => {
    const o: Record<string, string> = {};
    keys.forEach((k, i) => (o[k] = r.cells[i] ?? ''));
    return Object.assign(o, { _line: r.line }) as Rec;
  });
}

export const src = (t: Table, line: number) => `${t.file}:${line}`;

/** Splits a cell on ` · ` (the docs' separator inside one cell). */
export const parts = (s: string) => s.split(/\s+·\s+/).map((x) => x.trim()).filter(Boolean);

/** Percent in a cell: `25%` → 0.25. */
export const pct = (s: string): number | null => {
  const m = s.match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) / 100 : null;
};

/** `×1.5` / `x1.5` → 1.5 */
export const mult = (s: string): number | null => {
  const m = s.match(/[×x]\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

/** Plain key/value rows of a two-column rule table with every number found in the value kept beside the text. */
export function ruleRows(t: Table): { key: string; text: string; nums: number[]; src: string }[] {
  return t.rows.map((r) => ({ key: r.cells[0], text: r.cells.slice(1).join(' | '), nums: nums(r.cells.slice(1).join(' ')), src: src(t, r.line) }));
}

/** The text of a doc section: from heading matching `re` to the next heading of the same or higher level. */
export function section(file: string, re: RegExp): string[] {
  const lines = readDoc(file).split('\n');
  const out: string[] = [];
  let level = 0;
  for (const l of lines) {
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      if (!level && re.test(h[2])) {
        level = h[1].length;
        continue;
      }
      if (level && h[1].length <= level) break;
    }
    if (level) out.push(l);
  }
  return out;
}

export function finish(group: string, files: string[], un: Unparsed, strict = false) {
  un.write();
  return { group, files, unparsed: un.count, strict };
}

export { rel, tables, readDoc, Unparsed };
export type { Table, Row };
