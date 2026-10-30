// Builds docs/npc-map.html from docs/npcs/*.md and the event tables.
// Run: node scripts/build-npc-map.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// ---------- event titles ----------
function eventTitles(md) {
  const out = {};
  for (const line of md.split('\n')) {
    const m = line.match(/^\| \*\*([A-Z]{2,3}-\d{2})\s*(?:[⭐●○])?\s*(.*?)\*\*/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const titles = { ...eventTitles(read('docs/world/world-events.md')), ...eventTitles(read('docs/branches/02-new-lands.md')) };

// ---------- continents ----------
const CONTINENTS = [
  { id: 'AZ', name: 'อัซการ์', color: '#4a7fc1' },
  { id: 'MH', name: 'มอร์เฮเวน', color: '#8a3b4f' },
  { id: 'KD', name: 'คาซ-ดูรัม', color: '#c4602f' },
  { id: 'NR', name: 'เนเรีย', color: '#2a8a9a' },
  { id: 'AL', name: 'อัลเดรีย', color: '#6f9a3a' },
  { id: 'MK', name: 'เมคาเรีย', color: '#6d7380' },
  { id: 'SH', name: 'ซาฮารัน', color: '#b88a2a' },
  { id: 'SV', name: 'ซิลวาเนล', color: '#2f8a52' },
  { id: 'NB', name: 'เนบูเลีย', color: '#7a5aa8' },
];

// ---------- parse NPC tables ----------
const dir = path.join(root, 'docs/npcs');
const files = fs.readdirSync(dir).filter((f) => /^\d\d-.*\.md$/.test(f)).sort();
const countries = [];
const npcs = [];
const eventRe = /\b((?:DR|PL|WR|CT|DM|MC|BIO|GD|HP|PO|GI|FG|END|SF|AS|DW|RF|WT|RL|CL|DV)-\d{2})\b/g;
const npcRe = /\b([A-Z]{2}\d{2}-\d)\b/g;
const TAGS = ['ช่วย', 'ขัดขวาง', 'ปล่อย', 'ร่วม'];

for (const f of files) {
  let cur = null;
  for (const line of read(`docs/npcs/${f}`).split('\n')) {
    const h = line.match(/^## ([A-Z]{2}-\d{2}) (\S+)(?: \((.*)\))?\s*$/);
    if (h) {
      cur = { id: h[1], name: h[2], desc: h[3] || '', continent: h[1].slice(0, 2) };
      countries.push(cur);
      continue;
    }
    const m = line.match(/^\| ([A-Z]{2}\d{2}-\d) \|/);
    if (!m || !cur) continue;
    const cells = line.slice(2, line.lastIndexOf(' |')).split(' | ');
    if (cells.length !== 5) throw new Error(`bad row ${m[1]} in ${f}`);
    const [id, who, unique, arcsText, spawn] = cells;
    const wm = who.match(/^\*\*(.+?)\*\*\s*(?:\((.*?)\))?\s*(.*)$/);
    const parts = arcsText.split(/(?=[กขค]\) \d+%)/).map((s) => s.trim()).filter(Boolean);
    const branches = parts.map((p) => {
      const bm = p.match(/^([กขค])\) (\d+)%\s*(.*)$/);
      if (!bm) throw new Error(`bad branch in ${id}: ${p}`);
      const text = bm[3];
      return {
        k: bm[1], pct: +bm[2], text,
        events: [...new Set([...text.matchAll(eventRe)].map((x) => x[1]))],
        npcs: [...new Set([...text.matchAll(npcRe)].map((x) => x[1]))].filter((x) => x !== id),
        tags: TAGS.filter((t) => text.includes(`[${t}]`)),
        favor: text.includes('คืนบุญ'),
      };
    });
    const sum = branches.reduce((a, b) => a + b.pct, 0);
    if (sum > 100) throw new Error(`branches of ${id} sum ${sum}`);
    npcs.push({
      id, country: cur.id, continent: cur.continent, leader: id.endsWith('-1'),
      name: wm ? wm[1] : who, meta: wm ? wm[2] || '' : '', role: wm ? wm[3] : '',
      unique, branches, rest: 100 - sum, spawn: parseInt(spawn, 10), file: f,
    });
  }
}

// references
const ids = new Set(npcs.map((n) => n.id));
for (const n of npcs) for (const b of n.branches) for (const r of b.npcs) if (!ids.has(r)) throw new Error(`${n.id} refs missing ${r}`);
const eventSet = new Set();
for (const n of npcs) for (const b of n.branches) b.events.forEach((e) => eventSet.add(e));
const events = {};
for (const e of eventSet) events[e] = titles[e] || e;
const missing = [...eventSet].filter((e) => !titles[e]);

const data = { continents: CONTINENTS, countries, npcs, events };
const tpl = read('scripts/npc-map.template.html');
fs.writeFileSync(path.join(root, 'docs/npc-map.html'), tpl.replace('/*__DATA__*/null', JSON.stringify(data)));
const expected = npcs.reduce((a, n) => a + n.spawn / 100, 0);
console.log(`npcs ${npcs.length} · countries ${countries.length} · events referenced ${eventSet.size}${missing.length ? ` (no title: ${missing.join(', ')})` : ''} · expected appear ${expected.toFixed(0)}`);
