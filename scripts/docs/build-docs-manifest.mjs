// Builds docs/_generated/manifest.json: a machine-readable index of every markdown doc
// (path, title, layer, group, kind, size, level-2 headings) plus a description of every layer and group.
// Run: node scripts/docs/build-docs-manifest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { root } from '../lib/paths.mjs';

const docs = path.join(root, 'docs');

export const LAYERS = {
  lore: 'Facts of the world: history, places, peoples, characters, storylines. No formulas.',
  systems: 'Rules and data the game computes: numbers, tables, conditions and effects.',
  appearance: 'How things look and move: colors, shapes, poses, effects, scenes, UI values.',
  guide: 'How to read, add and fix the docs.',
  generated: 'Built by scripts. Never edit by hand.',
};

// path prefix (inside docs/) -> [layer, one-line role]; longest prefix wins
export const GROUPS = {
  lore: ['lore', 'Layer index'],
  systems: ['systems', 'Layer index'],
  'lore/world': ['lore', 'Main story, continents, map layout, cross-continent politics, the two clocks'],
  'lore/countries': ['lore', '143 countries, one file per continent'],
  'lore/races': ['lore', '21 peoples: history, homes, sub-lines, relations (stats are in systems/character/races)'],
  'lore/dragons': ['lore', '15 legendary dragons: who they are and how they relate'],
  'lore/religions': ['lore', 'How faith flows; major and regional faiths; movements'],
  'lore/npcs': ['lore', '608 NPCs, one file per country group'],
  'lore/storylines': ['lore', 'Life storylines per people, half-bloods, heirs, economy, convergence points'],
  'lore/heirs': ['lore', 'Houses, inheritance and what carries across lives'],
  'systems/character': ['systems', 'Origin, blessings, curses, skills, jobs, companions'],
  'systems/character/races': ['systems', 'Per-people starting stats, abilities, blessings, curses, skills'],
  'systems/combat': ['systems', 'Combat core, type matrix, enemies, encounters, rewards'],
  'systems/items': ['systems', 'Weapons, armor, accessories, talismans, consumables, materials, forging'],
  'systems/economy': ['systems', 'Money, classes, income, trade, investment, wealth of every country'],
  'systems/events': ['systems', 'World events (conditions and effects) and branches after dragon falls'],
  'systems/travel': ['systems', 'Travel levels, why a life travels, destination filters by people and morals, road events, contact targets'],
  'systems/simulation': ['systems', 'World simulation results and dragon mood values'],
  'systems/experience': ['systems', 'What the player sees and feels in one life and across lives'],
  appearance: ['appearance', 'Look of continents, countries, peoples, NPCs, enemies, items, events and scenes'],
  'appearance/countries': ['appearance', 'Per-country look, city scale, sacred sites, war and landmarks'],
  'appearance/npcs': ['appearance', 'Look of the 608 NPCs'],
  'appearance/poc-visuals': ['appearance', 'Vector-art design notes of the proof-of-concept (superseded by the files above)'],
  guide: ['guide', 'Organization rules, ID glossary, consistency notes'],
  _generated: ['generated', 'Script output'],
};
const GROUP_KEYS = Object.keys(GROUPS).sort((a, b) => b.length - a.length);

const SOURCE = {
  '_generated/npc-map.html': 'scripts/docs/build-npc-map.mjs',
  '_generated/story-map.html': 'scripts/docs/build-story-map.mjs',
  '_generated/storyline-balance.md': 'scripts/docs/build-storyline-balance.mjs',
  '_generated/event-coverage.md': 'scripts/docs/build-event-coverage.mjs',
  '_generated/country-links.md': 'scripts/docs/build-country-links.mjs',
  '_generated/local-events-by-country.md': 'scripts/docs/build-local-events.mjs',
  '_generated/weapon-catalog.md': 'scripts/docs/build-weapon-catalog.mjs',
  '_generated/item-catalog.md': 'scripts/docs/build-item-catalog.mjs',
  '_generated/character-catalog': 'scripts/codegen/export-character-catalog.ts',
  '_generated/poc-visuals': 'scripts/codegen/gen-visual-docs.ts',
  '_generated/manifest.json': 'scripts/docs/build-docs-manifest.mjs',
};

function kindOf(rel, layer) {
  if (layer === 'generated') return 'generated';
  if (path.basename(rel) === 'README.md') return 'index';
  if (layer === 'lore') return 'fact';
  if (layer === 'systems') return 'data';
  if (layer === 'appearance') return 'visual';
  return 'guide';
}

const out = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) { walk(full); continue; }
    if (!name.endsWith('.md')) continue;
    const rel = path.relative(docs, full).split(path.sep).join('/');
    const text = fs.readFileSync(full, 'utf8');
    const title = (text.match(/^# (.+)$/m) || [, name])[1].trim();
    const group = GROUP_KEYS.find((k) => rel.startsWith(k + '/'));
    const layer = group ? GROUPS[group][0] : rel.includes('/') ? 'unknown' : 'root';
    const entry = {
      path: rel, title, layer, group: group || '', kind: kindOf(rel, layer),
      lines: text.split('\n').length, bytes: Buffer.byteLength(text),
      headings: [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()),
    };
    const src = Object.keys(SOURCE).find((k) => `${rel}` === k || rel.startsWith(k + '/'));
    if (src) entry.source = SOURCE[src];
    out.push(entry);
  }
}
walk(docs);

const unknown = out.filter((f) => f.layer === 'unknown').map((f) => f.path);
if (unknown.length) { console.error('files outside any known group:', unknown.join(', ')); process.exitCode = 1; }

const files = ['_generated/npc-map.html', '_generated/story-map.html'].filter((f) => fs.existsSync(path.join(docs, f)))
  .map((f) => ({ path: f, title: path.basename(f), layer: 'generated', group: '_generated', kind: 'generated', source: SOURCE[f] }));
fs.writeFileSync(
  path.join(docs, '_generated', 'manifest.json'),
  JSON.stringify({ generatedBy: 'scripts/docs/build-docs-manifest.mjs', count: out.length, layers: LAYERS, groups: Object.fromEntries(GROUP_KEYS.reverse().map((k) => [k, { layer: GROUPS[k][0], role: GROUPS[k][1] }])), files: out, extra: files }, null, 1),
);
console.log(`manifest: ${out.length} docs`);
