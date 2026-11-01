// Runs every data generator in scripts/codegen/groups/ (code-plan §5.1).
//   npx tsx scripts/codegen/run-all.ts            regenerate data/gen/
//   npx tsx scripts/codegen/run-all.ts --check    also fail when the regenerated data differs from what was there
//   npx tsx scripts/codegen/run-all.ts storylines only the named groups
// Each group file default-exports `run(): GenReport`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { genDir, root } from './lib/table';

export interface GenReport {
  group: string;
  files: string[]; // data/gen file names written
  unparsed: number;
  /** Groups whose unparsed report must be empty for the gate (storylines and events, code-plan §11 M0). */
  strict?: boolean;
}

const args = process.argv.slice(2);
const check = args.includes('--check');
const only = args.filter((a) => !a.startsWith('--'));

const snapshot = () => {
  const out = new Map<string, string>();
  if (!existsSync(genDir)) return out;
  const walk = (d: string) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else out.set(path.relative(root, p), readFileSync(p, 'utf8'));
    }
  };
  walk(genDir);
  return out;
};

const dir = path.join(root, 'scripts/codegen/groups');
const groups = readdirSync(dir)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .filter((f) => !only.length || only.includes(f.replace(/\.ts$/, '')))
  .sort();

const before = snapshot();
let failed = false;
for (const g of groups) {
  const mod = await import(pathToFileURL(path.join(dir, g)).href);
  const t0 = Date.now();
  const rep: GenReport = await mod.default();
  const flag = rep.strict && rep.unparsed ? '  ✗ must be 0' : '';
  console.log(`${rep.group.padEnd(14)} ${String(rep.unparsed).padStart(5)} unparsed  ${rep.files.join(' ')}  (${Date.now() - t0} ms)${flag}`);
  if (flag) failed = true;
}
if (check) {
  const after = snapshot();
  const changed = [...after.keys()].filter((k) => before.get(k) !== after.get(k));
  if (changed.length) {
    console.log(`data/gen differs from the docs (run npm run gen and commit):\n  ${changed.join('\n  ')}`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
