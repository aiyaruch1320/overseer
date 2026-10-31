// Checks design docs for broken references and table rules (storylines, combat, items).
// Run: node scripts/docs/check-docs.mjs   (exit code 1 when an error is found)
import fs from 'node:fs';
import path from 'node:path';
import { root } from '../lib/paths.mjs';

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
const charFiles = [...list('systems/character'), ...list('_generated/character-catalog')];
const gifts = collect(charFiles, /\b((?:nb|nc|ns|b|c|sp|cs|u|pa)_[a-z0-9_]+)\b/g);
const jobs = new Set();
for (const f of ['systems/character/09-jobs-common.md', 'systems/character/10-jobs-secret.md', 'systems/character/11-jobs-special.md'])
  for (const line of lines(f)) { const m = line.match(/^\| ([a-z_]+) \| /); if (m && m[1] !== 'ID') jobs.add(m[1]); }
const tableIds = (files) => collect(files, /^\| `?([a-z_]+)`? \| /gm);
const traits = tableIds(['_generated/character-catalog/traits.md', 'systems/character/12-job-support.md']);
const apts = tableIds(['_generated/character-catalog/aptitudes-skills.md', 'systems/character/12-job-support.md']);
const tags = new Set([...collect([...charFiles, ...list('systems/combat')], /`(#[a-z_]+)`/g), ...collect(['_generated/character-catalog/tags.md'], /^\| (#[a-z_]+) /gm)]);
const enemies = new Set();
for (const line of lines('systems/combat/03-enemies.md')) { const m = line.match(/^\| `?([a-z_]+|[A-Z]{2}\d{2}-\d)`? \| /); if (m && m[1] !== 'ID') enemies.add(m[1]); }
const npcNames = {};
for (const f of list('lore/npcs')) for (const line of lines(f)) { const m = line.match(/^\| ([A-Z]{2}\d{2}-\d) \| \*\*(.+?)\*\*/); if (m) npcNames[m[1]] = m[2]; }
const events = new Set();
for (const f of ['systems/events/world-events.md', 'systems/events/branches/02-new-lands.md', 'systems/events/branches/04-last-era.md', 'systems/events/local-events.md', '_generated/local-events-by-country.md']) for (const line of lines(f)) { const m = line.match(/^\| \*\*([A-Z]+-\d+) /); if (m) events.add(m[1]); }
const COUNTRIES = { AZ: 10, MH: 12, KD: 12, NR: 16, AL: 28, MK: 16, SH: 17, SV: 18, NB: 14 };
const EVENT_PREFIX = new Set(['DR', 'PL', 'WR', 'CT', 'DM', 'MC', 'BIO', 'GD', 'HP', 'PO', 'GI', 'FG', 'END', 'SF', 'AS', 'DW', 'RF', 'WT', 'RL', 'CL', 'DV', 'LC', 'LE']);
const storyFiles = list('lore/storylines');
const raceFiles = storyFiles.filter((f) => /\/\d\d-/.test(f) && !f.endsWith('00-convergence.md'));
const nodeRow = /^\| ([a-z]{2}\.[btael]\d) \|/;
const nodes = collect(storyFiles, /^\| ([a-z]{2}\.[btael]\d) \|/gm);
const itemFiles = list('systems/items');
const weapons = new Map();
for (const f of itemFiles.filter((x) => /\/0[1-8]-/.test(x))) for (const line of lines(f)) if (/^\| w[a-z]_/.test(line)) weapons.set(cells(line)[0], { f, c: cells(line) });
const materials = tableIds(['systems/items/02-materials.md']);
// non-weapon items (armor, accessories, talismans, consumables, life tools, materials, key items) and the flags key items set
const gear = new Map();
const gearFlags = new Set();
for (const f of itemFiles.filter((x) => /\/1[2-8]-/.test(x))) for (const line of lines(f)) {
  const m = line.match(/^\| ((?:ar|ac|tm|cn|lt|mt|ky)_[a-z0-9_]+) \|/);
  if (!m) continue;
  const c = cells(line);
  gear.set(m[1], { f, c });
  if (m[1].startsWith('ky_')) for (const [, t] of (c[3] || '').matchAll(/`([a-z_0-9]+)`/g)) gearFlags.add(t);
}

const STAT = /^(pow|mag|spd|luk|int|vit)([+-]\d+)$/;
const ATTACK = new Set(['blade', 'blunt', 'pierce', 'ranged', 'poison', 'silver', 'iron', 'light', 'fire', 'water', 'ice', 'lightning', 'wind', 'earth', 'dark', 'blood', 'holy', 'cursed_weapon']);
// words that appear in backticks but are not ids: code fields, LLM roles, proposed chain ids
const NOT_IDS = new Set(['npc_voice', 'homeland_letter', 'side_event', 'hurt', 'doubt', 'faith', 'none', 'loot', 'weak', 'resist', 'hAge', 'affinity', 'deeds', 'legend', 'dream', 'battle', 'naming', 'rumor', 'omen', 'prayer', 'history', 'id', 'type', 'stats', 'abilities', 'source', 'kind', 'cursed', 'mundane', 'materials', 'pow', 'mag', 'spd', 'luk', 'int', 'vit']);
// string literals in the game code (country flags, monster tags, choice tags, effect tokens) count as known words
function srcFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? srcFiles(path.join(dir, e.name)) : /\.ts$/.test(e.name) ? [path.join(dir, e.name)] : []));
}
const codeWords = new Set();
for (const f of srcFiles(path.join(root, 'src'))) for (const m of fs.readFileSync(f, 'utf8').matchAll(/['"`]([a-z][a-z0-9_]*)['"`]/g)) codeWords.add(m[1]);
// tags defined inside the docs themselves: race tags in the synergy rules, enemy types and traits in the type matrix
const docTags = new Set([
  ...collect(['systems/character/03-synergy-rules.md'], /\*\*([a-z_]+)\*\*/g),
  ...collect(['systems/character/03-synergy-rules.md'], /`([a-z_]+)`/g),
  ...[...read('systems/combat/02-type-matrix.md').matchAll(/^\| [^|`]*`([a-z_]+)`/gm)].map((m) => m[1]),
  'spirit_bane',
]);
const pairedItems = tableIds(['systems/bonds/06-paired-items.md']);
const known = new Set([...gifts, ...jobs, ...traits, ...apts, ...enemies, ...weapons.keys(), ...gear.keys(), ...gearFlags, ...materials, ...pairedItems, ...codeWords, ...docTags]);
const aptLevel = (t) => { const m = t.match(/^([a-z_]+)_(\d)$/); return m && apts.has(m[1]); };

// ---------- reference check ----------
function checkRefs(file) {
  lines(file).forEach((line, i) => {
    const n = i + 1;
    for (const [, t] of line.matchAll(/`([^`]+)`/g)) {
      if (t === '#แท็ก') continue;
      if (t.startsWith('#')) { if (!tags.has(t)) err(file, n, 'tag', t); continue; }
      if (t.length < 2 || t === '#แท็ก' || STAT.test(t) || ATTACK.has(t) || NOT_IDS.has(t) || /^chain_/.test(t) || /^[a-z]{2}_(f_)?$/.test(t) || /^ws_[a-z_]+_[a-z_]+$/.test(t)) continue;
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
[...storyFiles, ...list('systems/combat'), ...itemFiles, ...list('lore/heirs'), ...list('systems/economy'), ...list('systems/bonds'), 'systems/events/local-events.md', 'systems/events/branches/04-last-era.md'].forEach(checkRefs);

// NPC rows may name other NPCs and events: every id they mention must exist.
for (const f of list('lore/npcs')) lines(f).forEach((line, i) => {
  if (!/^\| [A-Z]{2}\d{2}-\d \|/.test(line)) return;
  for (const [, id] of line.matchAll(/\b([A-Z]{2}\d{2}-\d)\b/g)) if (!npcNames[id]) err(f, i + 1, 'npc-ref', id);
  for (const [, id] of line.matchAll(/\b([A-Z]{1,3}-\d{2})\b/g)) if (EVENT_PREFIX.has(id.split('-')[0]) && !events.has(id)) err(f, i + 1, 'npc-event', id);
});

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
    if (age && !/^→ cv\./.test(c[3])) starts.push(Number(age[0]));
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
for (const line of lines('lore/storylines/00-convergence.md')) {
  const m = line.trim().match(/^\| (cv\.\d+) \|.*\| ([^|]*) \|$/);
  if (!m) continue;
  for (const [node] of m[2].matchAll(/[a-z]{2}\.[btae]\d/g))
    if (!new RegExp(`${m[1].replace('.', '\\.')}(?!\\d)`).test(nodeText[node] || '')) err('lore/storylines/00-convergence.md', 0, 'cv-entry', `${m[1]} ${node}`);
}

// Tag source table in the secret jobs file (section ฉ): the gift named in a row must appear in the node it points to.
{
  const rows = lines('systems/character/10-jobs-secret.md').filter((l) => /^\| `#[a-z_]+` \|/.test(l));
  if (!rows.length) err('systems/character/10-jobs-secret.md', 0, 'tag-source', 'no rows in the tag source table');
  for (const row of rows) {
    const cells = row.split('|').map((c) => c.trim());
    const gift = (cells[3].match(/`([a-z]+_[a-z_]+)`/) || [])[1];
    const node = (cells[4].match(/\b[a-z]{2}\.[btae]\d/) || [])[0];
    if (!node) continue;
    if (!gift) { err('systems/character/10-jobs-secret.md', 0, 'tag-source', `${cells[1]} has a node but no gift id`); continue; }
    if (!(nodeText[node] || '').includes(`\`${gift}\``)) err('systems/character/10-jobs-secret.md', 0, 'tag-source', `${cells[1]} ${gift} not in ${node}`);
  }
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
for (const [id, { f, c }] of gear) {
  if (!/^(ar|ac|tm)_/.test(id)) continue;
  const [, , rarity, slot, , , stats] = c;
  const band = BAND[rarity];
  if (!band || rarity === 'ของใช้') { err(f, 0, 'rarity', `${id} ${rarity}`); continue; }
  const [lo, hi, min, max] = band;
  if (id.startsWith('ar_') && (Number(slot) < lo || Number(slot) > hi)) err(f, 0, 'defense', `${id} ${rarity} ${slot}`);
  const { pos, neg } = budget(stats);
  if (pos > max + neg || (pos < min && !['C'].includes(rarity))) err(f, 0, 'budget', `${id} ${rarity} +${pos} -${neg}`);
}
if (fs.existsSync(path.join(docs, '_generated/weapon-catalog.md'))) {
  let section = '';
  for (const line of lines('_generated/weapon-catalog.md')) {
    if (line.startsWith('## ')) section = line;
    if (section !== '## รุ่นวัสดุ' || !line.startsWith('| ws_')) continue;
    const c = cells(line);
    const { pos, neg } = budget(c[6]);
    if (pos > BAND[c[2]][3] + neg) err('_generated/weapon-catalog.md', 0, 'variant-budget', `${c[0]} ${c[6]}`);
  }
}

// ---------- structure ----------
// every doc lives in one of the five top-level folders, and every folder with docs has a README.md index
const TOP = new Set(['guide', 'lore', 'systems', 'appearance', '_generated']);
function folders(dir, rel = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (!rel && !TOP.has(e.name)) err(r, 0, 'structure', 'unknown top-level folder');
      folders(path.join(dir, e.name), r);
    } else if (!rel && e.name !== 'README.md') err(r, 0, 'structure', 'doc outside a layer folder');
  }
  if (rel && !rel.startsWith('_generated') && fs.readdirSync(dir).some((f) => f.endsWith('.md')) && !fs.existsSync(path.join(dir, 'README.md'))) err(rel, 0, 'structure', 'folder has no README.md');
}
folders(docs);

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

// Every named NPC fighter in 03-enemies (section ง) needs a clash entry in the system and the scene file.
{
  const read = (f) => fs.readFileSync(path.join(docs, f), 'utf8');
  const enemies = read('systems/combat/03-enemies.md');
  const fighters = [...(enemies.split(/^## ง\./m)[1] || '').split(/^## จ\./m)[0].matchAll(/^\| ([A-Z]{2}\d{2}-\d) \|/gm)].map((m) => m[1]);
  const clashFiles = ['systems/combat/07-npc-clashes.md', 'appearance/15-npc-clash-scenes.md'];
  for (const f of clashFiles) {
    const text = read(f);
    for (const id of fighters) if (!new RegExp(`^#### NF-${id} `, 'm').test(text)) err(f, 0, 'npc-clash', `missing NF-${id}`);
    for (const [, id] of text.matchAll(/^#### NF-([A-Z]{2}\d{2}-\d) /gm)) if (!fighters.includes(id)) err(f, 0, 'npc-clash', `NF-${id} is not in 03-enemies section ง`);
  }
  if (!fighters.length) err('systems/combat/03-enemies.md', 0, 'npc-clash', 'no fighters found in section ง');
}

// ---------- bonds: feelings by tie ----------
// The matrix in 02-feelings.md says which tie can show which feeling from which bond level. Every {tie:feeling@level} mark in the docs must obey it.
{
  const F = 'systems/bonds/02-feelings.md';
  const rows = lines(F);
  const head = rows.findIndex((l) => /^\| อารมณ์ \| สหาย \|/.test(l));
  const ties = head < 0 ? [] : cells(rows[head]).slice(1);
  const matrix = {};
  for (let i = head + 2; head >= 0 && i < rows.length && rows[i].startsWith('|'); i++) {
    const c = cells(rows[i]);
    matrix[c[0].replace(/\*/g, '')] = Object.fromEntries(ties.map((t, k) => [t, c[k + 1] === '-' ? null : Number(c[k + 1])]));
  }
  if (ties.length !== 9 || Object.keys(matrix).length !== 24) err(F, 0, 'feelings-matrix', `expected 9 ties and 24 feelings, got ${ties.length} and ${Object.keys(matrix).length}`);
  const TOKEN = /\{([^{}:@]+):([^{}:@]+)@(\d)\}/g;
  for (const f of [...list('systems/bonds'), ...list('lore/storylines')]) {
    let declared = null;
    lines(f).forEach((line, i) => {
      const n = i + 1;
      if (/^#{2,3} /.test(line)) declared = null;
      const d = line.match(/^สาย: (.+)$/);
      if (d) declared = d[1].split('·').map((s) => s.trim());
      const st = line.match(/^\| \d [^|]+\| (\d) \|/);
      for (const [, tie, feel, lv] of line.matchAll(TOKEN)) {
        const level = Number(lv);
        if (!ties.includes(tie)) { err(f, n, 'feeling-tie', `unknown tie ${tie}`); continue; }
        if (!matrix[feel]) { err(f, n, 'feeling', `unknown feeling ${feel}`); continue; }
        const min = matrix[feel][tie];
        if (min === null) err(f, n, 'feeling-tie', `${tie} cannot show ${feel}`);
        else if (level < min) err(f, n, 'feeling-level', `${tie} shows ${feel} from level ${min}, not ${level}`);
        if (level < 1 || level > 5) err(f, n, 'feeling-level', `${feel}@${level}`);
        if (declared && !declared.includes(tie)) err(f, n, 'feeling-declared', `${tie} is not in this story's declared ties (${declared.join(', ')})`);
        if (st && level > Number(st[1])) err(f, n, 'feeling-stage', `${feel}@${level} is above the stage level ${st[1]}`);
      }
    });
  }
  // ids of the bond templates and paired items that other docs mention must exist
  const defs = { FT: new Set(), KN: new Set(), PR: new Set() };
  for (const [f, k] of [['systems/bonds/04-friend-arcs.md', 'FT'], ['systems/bonds/05-family.md', 'KN'], ['systems/bonds/06-paired-items.md', 'PR']])
    for (const line of lines(f)) { const m = line.match(new RegExp(`^\\| \`(${k}-\\d{2})\` \\|`)); if (m) defs[k].add(m[1]); }
  for (const f of [...list('systems/bonds'), ...list('lore/storylines')]) lines(f).forEach((line, i) => {
    for (const [, k, num] of line.matchAll(/\b(FT|KN|PR)-(\d{2})\b/g)) if (!defs[k].has(`${k}-${num}`)) err(f, i + 1, 'bond-id', `${k}-${num}`);
  });
  // every paired item has both halves, and each pair row names two existing halves
  const halves = [...pairedItems];
  for (const id of halves) if (/_a$/.test(id) && !pairedItems.has(id.replace(/_a$/, '_b'))) err('systems/bonds/06-paired-items.md', 0, 'paired-item', `${id} has no _b half`);
  for (const line of lines('systems/bonds/06-paired-items.md')) {
    const m = line.match(/^\| `PR-\d{2}` \| (pr_[a-z_]+) กับ (pr_[a-z_]+) \|/);
    if (m) for (const id of [m[1], m[2]]) if (!pairedItems.has(id)) err('systems/bonds/06-paired-items.md', 0, 'paired-item', `${id} is in a pair row but not in the halves table`);
  }
  // the named allies in 28-allies: the cover table and the sections must list the same NPCs, each section declaring its ties
  for (const A of ['lore/storylines/28-allies.md', 'lore/storylines/29-allies-flagship.md']) {
    const cover = lines(A).map((l) => l.match(/^\| ([A-Z]{2}\d{2}-\d) /)).filter(Boolean).map((m) => m[1]);
    const secs = lines(A).map((l) => l.match(/^### ([A-Z]{2}\d{2}-\d) /)).filter(Boolean).map((m) => m[1]);
    for (const id of cover) if (!secs.includes(id)) err(A, 0, 'ally', `${id} is in the cover table but has no section`);
    for (const id of secs) if (!cover.includes(id)) err(A, 0, 'ally', `${id} has a section but is not in the cover table`);
    const text = read(A);
    for (const id of secs) {
      const body = text.split(new RegExp(`^### ${id} .*$`, 'm'))[1]?.split(/^#{2,3} /m)[0] || '';
      if (!/^สาย: /m.test(body)) err(A, 0, 'ally', `${id} has no "สาย:" line`);
      if (!/ปลายทาง: ก\) /.test(body)) err(A, 0, 'ally', `${id} has no ending line`);
      const ending = body.match(/^ปลายทาง: .*$/m);
      const pct = ending ? [...ending[0].matchAll(/[กขค]\) (\d+) /g)].map((m) => Number(m[1])) : [];
      if (ending && (pct.length !== 3 || pct.reduce((s, x) => s + x, 0) !== 100)) err(A, 0, 'ally', `${id} ending weights must be three numbers that sum to 100`);
      if (!/\*\*ขอบเขต/.test(body)) err(A, 0, 'ally', `${id} has no boundary scene (ขอบเขต)`);
    }
  }
  // one NPC, one ally section across both files
  const allSecs = ['lore/storylines/28-allies.md', 'lore/storylines/29-allies-flagship.md'].flatMap((f) => lines(f).map((l) => l.match(/^### ([A-Z]{2}\d{2}-\d) /)).filter(Boolean).map((m) => m[1]));
  for (const id of new Set(allSecs)) if (allSecs.filter((x) => x === id).length > 1) err('lore/storylines', 0, 'ally', `${id} has two ally sections`);
}

for (const w of warnings) console.log('warn', w);
for (const e of errors) console.log('error', e);
console.log(`checked: ${storyFiles.length} storyline files · ${nodes.size} nodes · ${weapons.size} weapons · ${errors.length} errors · ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
