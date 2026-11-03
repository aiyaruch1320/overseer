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

/**
 * Strict groups may keep unparsed phrases only when the lead has accepted them, one per line in
 * scripts/codegen/accepted/<group>.txt as `<doc path> | <phrase>` (no line number, so edits above do not break it),
 * each waiting for a grammar form listed in review/m0/triage.md. New phrases and stale entries both fail the gate.
 */
function againstAccepted(group: string): { unexpected: string[]; stale: string[] } {
  const md = path.join(genDir, '_unparsed', `${group}.md`);
  const rows = existsSync(md)
    ? readFileSync(md, 'utf8')
        .split('\n')
        .filter((l) => l.startsWith('| docs/'))
        .map((l) => {
          const c = l.split(' | ');
          return `${c[0].slice(2).replace(/:\d+$/, '')} | ${c[1]}`;
        })
    : [];
  const accFile = path.join(root, 'scripts/codegen/accepted', `${group}.txt`);
  const accepted = existsSync(accFile)
    ? readFileSync(accFile, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : [];
  const acc = new Set(accepted);
  const seen = new Set(rows);
  return { unexpected: [...new Set(rows.filter((r) => !acc.has(r)))], stale: accepted.filter((a) => !seen.has(a)) };
}

const dir = path.join(root, 'scripts/codegen/groups');
const groups = readdirSync(dir)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .filter((f) => !only.length || only.includes(f.replace(/\.ts$/, '')))
  .sort();

// A group that reads another group's output names it in `export const after = ['npcs', …]` and runs after it (the order is otherwise by file
// name: looks.ts read the npcs.json of the run before, so one run left looks.json behind the docs)
const mods = new Map<string, { default: () => Promise<GenReport> | GenReport; after?: string[] }>();
for (const g of groups) mods.set(g.replace(/\.ts$/, ''), await import(pathToFileURL(path.join(dir, g)).href));
const order: string[] = [];
const visit = (g: string, path: string[] = []) => {
  if (order.includes(g) || !mods.has(g)) return;
  if (path.includes(g)) throw new Error(`codegen groups depend on each other in a circle: ${[...path, g].join(' → ')}`);
  for (const a of mods.get(g)!.after ?? []) visit(a, [...path, g]);
  order.push(g);
};
for (const g of mods.keys()) visit(g);

const before = snapshot();
let failed = false;
for (const g of order) {
  const mod = mods.get(g)!;
  const t0 = Date.now();
  const rep: GenReport = await mod.default();
  let flag = '';
  if (rep.strict) {
    const { unexpected, stale } = againstAccepted(rep.group);
    if (unexpected.length) flag += `  ✗ ${unexpected.length} not in accepted/${rep.group}.txt`;
    if (stale.length) flag += `  ✗ ${stale.length} accepted entries no longer occur`;
    for (const x of [...unexpected.slice(0, 10).map((u) => `    new: ${u}`), ...stale.slice(0, 10).map((u) => `    stale: ${u}`)]) console.log(x);
  }
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
