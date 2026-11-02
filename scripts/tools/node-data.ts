// Data for the node tools: everything in data/gen/ (load-gen.ts) and the tier 1 library lines of data/library/*.jsonl,
// kept in the data map as `library.<set>` so the text system reads them the way it reads generated files.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameData } from '../../src/core/game';
import { loadGen } from './load-gen';

const libDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/library');

export function parseJsonl(text: string): unknown[] {
  return text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as unknown);
}

/** Version of a library set: its size and a cheap hash of its text, enough to tell a changed library in a save. */
export function libVersion(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) >>> 0;
  return `lib-${text.length}-${h.toString(16)}`;
}

export function loadAll(only?: string[]): GameData {
  const data = loadGen(only);
  if (only || !existsSync(libDir)) return data;
  for (const f of readdirSync(libDir).filter((x) => x.endsWith('.jsonl')).sort()) {
    const text = readFileSync(path.join(libDir, f), 'utf8');
    data[`library.${f.replace(/\.jsonl$/, '')}`] = { version: libVersion(text), items: parseJsonl(text) };
  }
  return data;
}
