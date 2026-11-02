// Shared reader for the markdown tables in docs/ and writer for data/gen/ (code-plan §5.1, §5.3).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const docsDir = path.join(root, 'docs');
export const genDir = path.join(root, 'data/gen');

/** Path relative to the repo root, with forward slashes. */
export const rel = (p: string) => path.relative(root, path.resolve(root, p)).split(path.sep).join('/');

export function readDoc(p: string): string {
  return readFileSync(path.resolve(root, p), 'utf8');
}

/** Markdown files in a docs folder, sorted, as repo-relative paths. */
export function listDocs(dir: string, re = /\.md$/): string[] {
  const abs = path.resolve(root, dir);
  return readdirSync(abs)
    .filter((f) => re.test(f))
    .sort()
    .map((f) => rel(path.join(abs, f)));
}

export const cells = (line: string) => line.split('|').slice(1, -1).map((c) => c.trim());

export interface Row {
  cells: string[];
  line: number; // 1-based line in the file
}

export interface Table {
  file: string;
  /** Headings above the table, outermost first (`## 4. โหนด`, `### 4.1 ...`). */
  headings: string[];
  header: string[];
  rows: Row[];
  line: number;
}

/** Every pipe table in a file, with the headings it sits under. */
export function tables(file: string): Table[] {
  const lines = readDoc(file).split('\n');
  const out: Table[] = [];
  const heads: string[] = [];
  let cur: Table | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      heads.length = h[1].length - 1;
      heads[h[1].length - 1] = h[2].trim();
      cur = null;
      continue;
    }
    if (!l.startsWith('|')) {
      cur = null;
      continue;
    }
    if (!cur) {
      const sep = lines[i + 1] ?? '';
      if (!/^\|\s*:?-{3,}/.test(sep)) continue;
      cur = { file: rel(file), headings: heads.filter(Boolean), header: cells(l), rows: [], line: i + 1 };
      out.push(cur);
      i++; // skip the separator
      continue;
    }
    cur.rows.push({ cells: cells(l), line: i + 1 });
  }
  return out;
}

/** Writes through a temporary file and a rename, so a test that reads data/gen while a generator runs never sees half a file. */
export function writeAtomic(file: string, text: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

/** Short hash of the source files, stored as `version` in every generated file. */
export function versionOf(files: string[]): string {
  const h = createHash('sha1');
  for (const f of [...files].sort()) {
    h.update(rel(f));
    h.update(readDoc(f));
  }
  return h.digest('hex').slice(0, 12);
}

/** Writes data/gen/<name>.json in the shape of GenFile (src/core/types.ts). Keys are written in a stable order. */
export function writeGen(name: string, items: unknown, sources: string[], generatedBy: string): void {
  mkdirSync(genDir, { recursive: true });
  const body = { version: versionOf(sources), sources: sources.map(rel).sort(), generatedBy, items };
  writeAtomic(path.join(genDir, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
}

/** Collects phrases that look like effects but did not parse; written to data/gen/_unparsed/<group>.md. */
export class Unparsed {
  private items: { at: string; phrase: string; why: string }[] = [];
  constructor(readonly group: string) {}
  add(file: string, line: number, phrase: string, why = '') {
    this.items.push({ at: `${rel(file)}:${line}`, phrase, why });
  }
  get count() {
    return this.items.length;
  }
  write(): void {
    const dir = path.join(genDir, '_unparsed');
    mkdirSync(dir, { recursive: true });
    const lines = [`# ส่วนที่แปลไม่ได้: ${this.group}`, '', `${this.items.length} รายการ (สร้างโดยตัวสร้าง ห้ามแก้มือ)`, ''];
    if (this.items.length) {
      lines.push('| ที่ | วลี | เหตุ |', '| --- | --- | --- |');
      for (const it of this.items) lines.push(`| ${it.at} | ${it.phrase.replace(/\|/g, '\\|')} | ${it.why} |`);
    }
    writeAtomic(path.join(dir, `${this.group}.md`), lines.join('\n') + '\n');
  }
}
