// Golden lineage (code-plan §10, M4): three lives in a row in one world, with the ending cards, the summary of the world and the collection, must match
// the files in tests/golden/lineage/. A change must be on purpose: rerun with UPDATE_GOLDEN=1 and give the reason in the commit.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runLineageReport } from '../../scripts/tools/lineage-run';
import { loadGen } from '../../scripts/tools/load-gen';

const SEEDS = [5, 9];
const dir = path.join(__dirname, 'lineage');
const update = process.env.UPDATE_GOLDEN === '1';
const data = loadGen();

describe('golden lineage', () => {
  for (const seed of SEEDS)
    it(`seed ${seed}, three lives`, () => {
      const { text, lives } = runLineageReport(data, { seed, lives: 3, minLevel: 2 });
      expect(lives).toBe(3);
      mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${String(seed).padStart(2, '0')}.txt`);
      if (update || !existsSync(file)) writeFileSync(file, text);
      expect(text).toBe(readFileSync(file, 'utf8'));
    });
});
