// Builds docs/manifest.json: a machine-readable index of every markdown doc (path, title, category, size).
// Run: node scripts/build-docs-manifest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const CATEGORY = {
  world: 'world', countries: 'world', dragons: 'world', races: 'world', religions: 'world', economy: 'world', branches: 'world',
  character: 'character', storylines: 'character', heirs: 'character', npcs: 'character', experience: 'character',
  combat: 'systems', items: 'systems',
  appearance: 'appearance', visuals: 'appearance',
};
const out = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) { walk(full); continue; }
    if (!name.endsWith('.md')) continue;
    const rel = path.relative(docs, full).split(path.sep).join('/');
    const text = fs.readFileSync(full, 'utf8');
    const title = (text.match(/^# (.+)$/m) || [, name])[1].trim();
    const top = rel.includes('/') ? rel.split('/')[0] : 'root';
    out.push({ path: rel, title, category: CATEGORY[top] || 'root', folder: top, lines: text.split('\n').length, generated: rel === 'items/09-catalog.md' });
  }
}
walk(docs);
fs.writeFileSync(path.join(docs, 'manifest.json'), JSON.stringify({ generatedBy: 'scripts/build-docs-manifest.mjs', count: out.length, files: out }, null, 1));
console.log(`manifest: ${out.length} docs`);
