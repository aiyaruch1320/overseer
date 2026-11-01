// Loads data/gen/*.json for node tools (npm run life, npm run play, tests). The browser imports the same files.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { GameData } from '../../src/core/game';
import { genDir } from '../codegen/lib/table';

export function loadGen(only?: string[]): GameData {
  const out: GameData = {};
  if (!existsSync(genDir)) return out;
  for (const f of readdirSync(genDir).filter((x) => x.endsWith('.json')).sort()) {
    const name = f.replace(/\.json$/, '');
    if (only && !only.includes(name)) continue;
    out[name] = JSON.parse(readFileSync(path.join(genDir, f), 'utf8'));
  }
  return out;
}
