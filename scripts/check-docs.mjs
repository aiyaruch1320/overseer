// Checks design docs for broken references and table rules (storylines, combat, items).
// Run: node scripts/check-docs.mjs   (exit code 1 when an error is found)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const read = (p) => fs.readFileSync(path.join(docs, p), 'utf8');
const list = (dir) => fs.readdirSync(path.join(docs, dir)).filter((f) => f.endsWith('.md')).map((f) => `${dir}/${f}`);
const lines = (p) => read(p).split('\n');
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());

const errors = [];
const warnings = [];
const err = (file, line, kind, msg) => errors.push(`${file}:${line} ${kind} ${msg}`);
const warn = (file, line, kind, msg) => warnings.push(`${file}:${line} ${kind} ${msg}`);

// ---------- known ids ----------
function collect(files, re) {
  const out = new Set();
  for (const f of files) for (const line of lines(f)) for (const m of line.matchAll(re)) out.add(m[1]);
  return out;
}
const charFiles = [...list('character'), ...list('character/catalog')];
const gifts = collect(charFiles, /\b((?:nb|nc|ns|b|c|sp|cs|u|pa)_[a-z0-9_]+)\b/g);
const jobs = new Set();
for (const f of ['character/09-jobs-common.md', 'character/10-jobs-secret.md', 'character/11-jobs-special.md'])
  for (const line of lines(f)) { const m = line.match(/^\| ([a-z_]+) \| /); if (m && m[1] !== 'ID') jobs.add(m[1]); }
const tableIds = (files) => collect(files, /^\| `?([a-z_]+)`? \| /gm);
const traits = tableIds(['character/catalog/traits.md', 'character/12-job-support.md']);
const apts = tableIds(['character/catalog/aptitudes-skills.md', 'character/12-job-support.md']);
const tags = new Set([...collect([...charFiles, ...list('combat')], /`(#[a-z_]+)`/g), ...collect(['character/catalog/tags.md'], /^\| (#[a-z_]+) /gm)]);
const enemies = new Set();
for (const line of lines('combat/03-enemies.md')) { const m = line.match(/^\| `?([a-z_]+|[A-Z]{2}\d{2}-\d)`? \| /); if (m && m[1] !== 'ID') enemies.add(m[1]); }
const npcNames = {};
for (const f of list('npcs')) for (const line of lines(f)) { const m = line.match(/^\| ([A-Z]{2}\d{2}-\d) \| \*\*(.+?)\*\*/); if (m) npcNames[m[1]] = m[2]; }
const events = new Set();
for (const f of ['world-events.md', 'branches/02-new-lands.md']) for (const line of lines(f)) { const m = line.match(/^\| \*\*([A-Z]+-\d+) /); if (m) events.add(m[1]); }
const COUNTRIES = { AZ: 10, MH: 12, KD: 12, NR: 16, AL: 28, MK: 16, SH: 17, SV: 18, NB: 14 };
const EVENT_PREFIX = new Set(['DR', 'PL', 'WR', 'CT', 'DM', 'MC', 'BIO', 'GD', 'HP', 'PO', 'GI', 'FG', 'END', 'SF', 'AS', 'DW', 'RF', 'WT', 'RL', 'CL', 'DV']);
const storyFiles = list('storylines');
const raceFiles = storyFiles.filter((f) => /\/\d\d-/.test(f) && !f.endsWith('00-convergence.md'));
const nodeRow = /^\| ([a-z]{2}\.[btae]\d) \|/;
const nodes = collect(storyFiles, /^\| ([a-z]{2}\.[btae]\d) \|/gm);
const itemFiles = list('items').filter((f) => !f.endsWith('09-catalog.md'));
const weapons = new Map();
for (const f of itemFiles.filter((x) => /\/0[1-8]-/.test(x))) for (const line of lines(f)) if (/^\| w[a-z]_/.test(line)) weapons.set(cells(line)[0], { f, c: cells(line) });
const materials = tableIds(['items/02-materials.md']);

const STAT = /^(pow|mag|spd|luk|int|vit)([+-]\d+)$/;
const ATTACK = new Set(['blade', 'blunt', 'pierce', 'ranged', 'poison', 'silver', 'iron', 'light', 'fire', 'water', 'ice', 'lightning', 'wind', 'earth', 'dark', 'blood', 'holy', 'cursed_weapon']);
// words that appear in backticks but are not ids: code fields, LLM roles, proposed chain ids
const NOT_IDS = new Set(['npc_voice', 'homeland_letter', 'side_event', 'hurt', 'doubt', 'faith', 'none', 'loot', 'weak', 'resist', 'hAge', 'legend', 'dream', 'battle', 'naming', 'rumor', 'omen', 'prayer', 'history', 'id', 'type', 'stats', 'abilities', 'source', 'kind', 'cursed', 'mundane', 'materials', 'pow', 'mag', 'spd', 'luk', 'int', 'vit']);
// string literals in the game code (country flags, monster tags, choice tags, effect tokens) count as known words
function srcFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? srcFiles(path.join(dir, e.name)) : /\.ts$/.test(e.name) ? [path.join(dir, e.name)] : []));
}
const codeWords = new Set();
for (const f of srcFiles(path.join(root, 'src'))) for (const m of fs.readFileSync(f, 'utf8').matchAll(/['"`]([a-z][a-z0-9_]*)['"`]/g)) codeWords.add(m[1]);
// tags defined inside the docs themselves: race tags in the synergy rules, enemy types and traits in the type matrix
const docTags = new Set([
  ...collect(['character/03-synergy-rules.md'], /\*\*([a-z_]+)\*\*/g),
  ...collect(['character/03-synergy-rules.md'], /`([a-z_]+)`/g),
  ...[...read('combat/02-type-matrix.md').matchAll(/^\| [^|`]*`([a-z_]+)`/gm)].map((m) => m[1]),
  'spirit_bane',
]);
const known = new Set([...gifts, ...jobs, ...traits, ...apts, ...enemies, ...weapons.keys(), ...materials, ...codeWords, ...docTags]);
const aptLevel = (t) => { const m = t.match(/^([a-z_]+)_(\d)$/); return m && apts.has(m[1]); };

// ---------- reference check ----------
function checkRefs(file) {
  lines(file).forEach((line, i) => {
    const n = i + 1;
    for (const [, t] of line.matchAll(/`([^`]+)`/g)) {
      if (t === '#แท็ก') continue;
      if (t.startsWith('#')) { if (!tags.has(t)) err(file, n, 'tag', t); continue; }
      if (t.length < 2 || t === '#แท็ก' || STAT.test(t) || ATTACK.has(t) || NOT_IDS.has(t) || /^chain_/.test(t) || /^w[a-z]_$/.test(t) || /^ws_[a-z_]+_[a-z_]+$/.test(t)) continue;
      if (/^[a-z_0-9]+$/.test(t) && !known.has(t) && !aptLevel(t)) err(file, n, 'id', t);
    }
    for (const m of line.matchAll(/\b([A-Z]{2,3})-(\d+)\b/g)) {
      const [code, p, num] = m;
      if (COUNTRIES[p] && !(Number(num) >= 1 && Number(num) <= COUNTRIES[p])) err(file, n, 'country', code);
      else if (EVENT_PREFIX.has(p) && !events.has(code)) err(file, n, 'event', code);
    }
    for (const [, id] of line.matchAll(/\b([A-Z]{2}\d{2}-\d)\b/g)) if (!npcNames[id]) err(file, n, 'npc', id);
    for (const [, id] of line.matchAll(/\b([a-z]{2}\.[btae]\d)\b/g)) if (!nodes.has(id)) err(file, n, 'node', id);
    for (const [, id] of line.matchAll(/\bcv\.(\d+)\b/g)) if (Number(id) < 1 || Number(id) > 16) err(file, n, 'cv', `cv.${id}`);
    // NPC name should appear near its id (warning only; roles are sometimes used instead of names)
    for (const m of line.matchAll(/ \(([A-Z]{2}\d{2}-\d)\)/g)) {
      const words = (npcNames[m[1]] || '').split(/[ "“”]+/).filter((w) => w.length > 1);
      const before = line.slice(Math.max(0, m.index - 40), m.index);
      if (words.length && !words.some((w) => before.includes(w))) warn(file, n, 'npc-name', `${m[1]} ${npcNames[m[1]]}`);
    }
  });
}
[...storyFiles, ...list('combat'), ...itemFiles].forEach(checkRefs);

// ---------- storylines ----------
for (const f of raceFiles) {
  let starts = [];
  const flush = () => {
    if (starts.join() !== [...starts].sort((a, b) => a - b).join()) err(f, 0, 'age-order', starts.join(' '));
    starts = [];
  };
  lines(f).forEach((line, i) => {
    if (/^#{2,3} /.test(line)) flush(); // ages must rise within one section (a file may hold several node tables)
    const m = line.match(nodeRow);
    if (!m) return;
    const c = cells(line);
    if (c.length < 7) return;
    const age = c[1].match(/^\d+/);
    if (age && !line.includes('→ cv.')) starts.push(Number(age[0]));
    const w = c.slice(3, 6).map((x) => x.match(/^(\d+) /));
    if (w.every(Boolean)) {
      const sum = w.reduce((s, x) => s + Number(x[1]), 0);
      if (sum !== 100) err(f, i + 1, 'weights', `${m[1]} = ${sum}`);
    }
  });
  flush();
}
const nodeText = {};
for (const f of raceFiles) for (const line of lines(f)) { const m = line.match(nodeRow); if (m) nodeText[m[1]] = (nodeText[m[1]] || '') + line; }
for (const line of lines('storylines/00-convergence.md')) {
  const m = line.trim().match(/^\| (cv\.\d+) \|.*\| ([^|]*) \|$/);
  if (!m) continue;
  for (const [node] of m[2].matchAll(/[a-z]{2}\.[btae]\d/g))
    if (!new RegExp(`${m[1].replace('.', '\\.')}(?!\\d)`).test(nodeText[node] || '')) err('storylines/00-convergence.md', 0, 'cv-entry', `${m[1]} ${node}`);
}

// ---------- items ----------
const BAND = { 'ของใช้': [0, 0, 0, 1], C: [1, 1, 0, 1], U: [1, 2, 1, 2], R: [2, 3, 2, 3], E: [3, 4, 3, 4], L: [5, 6, 4, 6] };
function budget(stats) {
  let pos = 0, neg = 0;
  for (const [, , v] of stats.matchAll(/`([a-z]+)([+-]\d+)`/g)) { if (Number(v) > 0) pos += Number(v); else neg -= Number(v); }
  return { pos, neg };
}
for (const [id, { f, c }] of weapons) {
  const [, , rarity, power, , tagCell, stats] = c;
  const band = BAND[rarity];
  if (!band) { err(f, 0, 'rarity', `${id} ${rarity}`); continue; }
  const [lo, hi, min, max] = band;
  if (Number(power) < lo || Number(power) > hi) err(f, 0, 'power', `${id} ${rarity} ${power}`);
  const { pos, neg } = budget(stats);
  if (pos > max + neg || (pos < min && !['C', 'ของใช้'].includes(rarity))) err(f, 0, 'budget', `${id} ${rarity} +${pos} -${neg}`);
  for (const [, t] of tagCell.matchAll(/`([^`]+)`/g)) if (!t.startsWith('#') && !ATTACK.has(t) && !apts.has(t)) err(f, 0, 'attack-tag', `${id} ${t}`);
}
if (fs.existsSync(path.join(docs, 'items/09-catalog.md'))) {
  let section = '';
  for (const line of lines('items/09-catalog.md')) {
    if (line.startsWith('## ')) section = line;
    if (section !== '## รุ่นวัสดุ' || !line.startsWith('| ws_')) continue;
    const c = cells(line);
    const { pos, neg } = budget(c[6]);
    if (pos > BAND[c[2]][3] + neg) err('items/09-catalog.md', 0, 'variant-budget', `${c[0]} ${c[6]}`);
  }
}

// ---------- links ----------
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []));
}
for (const abs of walk(docs)) {
  fs.readFileSync(abs, 'utf8').split('\n').forEach((line, i) => {
    for (const [, target] of line.matchAll(/\]\(([^)#]+\.md)/g))
      if (!fs.existsSync(path.normalize(path.join(path.dirname(abs), target)))) err(path.relative(docs, abs), i + 1, 'link', target);
  });
}

for (const w of warnings) console.log('warn', w);
for (const e of errors) console.log('error', e);
console.log(`checked: ${storyFiles.length} storyline files · ${nodes.size} nodes · ${weapons.size} weapons · ${errors.length} errors · ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
