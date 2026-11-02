// Golden lives (code-plan §10 "ชีวิตทองคำ"): the readable life of 20 seeds, with all systems, must match the files in
// tests/golden/lives/. A change must be on purpose: rerun with UPDATE_GOLDEN=1 and give the reason in the commit.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runLifeReport } from '../../scripts/tools/life-run';
import { loadGen } from '../../scripts/tools/load-gen';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const dir = path.join(__dirname, 'lives');
const update = process.env.UPDATE_GOLDEN === '1';
const data = loadGen();

describe('golden lives', () => {
  for (const seed of SEEDS)
    it(`seed ${seed}`, () => {
      const { text } = runLifeReport(data, { seed, minLevel: 1 });
      const file = path.join(dir, `${String(seed).padStart(2, '0')}.txt`);
      if (update || !existsSync(file)) writeFileSync(file, text);
      expect(text).toBe(readFileSync(file, 'utf8'));
    });
});
