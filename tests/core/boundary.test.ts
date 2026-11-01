// The core knows no screen (code-plan §2.1): nothing under src/core imports the display layers.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const core = path.resolve(__dirname, '../../src/core');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });

describe('core boundary', () => {
  it('src/core imports no display layer, browser API or legacy code', () => {
    const bad: string[] = [];
    for (const f of files(core)) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        const resolved = spec.startsWith('.') ? path.resolve(path.dirname(f), spec) : spec;
        if (/\/src\/(app|ui|map|scene|art)(\/|$)/.test(resolved) || /legacy/.test(resolved) || /^(phaser|preact)/.test(spec))
          bad.push(`${path.relative(core, f)} → ${spec}`);
      }
      if (/\b(document|window)\./.test(src)) bad.push(`${path.relative(core, f)} uses document/window`);
    }
    expect(bad).toEqual([]);
  });
});
