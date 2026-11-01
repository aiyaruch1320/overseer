// Checks whether the story of each NPC row that names world events can open while its holder is alive.
// Rule (docs/lore/npcs/README.md section 2.1): a row that names events outside an arrow opens when the first of them happens.
// Lifespans come from docs/lore/world/world-time.md section 3; event years come from the world sim.
// Usage: node scripts/sim/sim-npc-timeline.mjs [worlds=1000] [--md] [--all]
import fs from 'fs';
import path from 'path';
import { root } from '../lib/paths.mjs';
import { runWorld } from './sim-world.mjs';

const docs = path.join(root, 'docs');
const read = (p) => fs.readFileSync(path.join(docs, p), 'utf8');
const WORLDS = Number(process.argv[2]) || 1000;
const md = process.argv.includes('--md');
const START = 10400;
const DEAD = 0.1, WEAK = 0.3; // share of worlds in which the story opens in time

// ---- lifespans by people name ----
const life = [];
for (const l of read('lore/world/world-time.md').split('## 3.')[1].split('## 4.')[0].split('\n')) {
  const c = l.split('|').map((x) => x.trim());
  const m = c[2] && c[2].replace(/,/g, '').match(/^(\d+)–(\d+)$/);
  if (m) life.push([c[1].replace(/ \(.*\)$/, ''), +m[1], +m[2]]);
}
// human lineages (lore/races/README.md) and other names the NPC files use for the 21 peoples
const ALIAS = [['ชาวทุ่ง', 'มนุษย์'], ['ชนผืนทราย', 'มนุษย์'], ['ชนใต้ทราย', 'มนุษย์'], ['มนุษย์เรือ', 'มนุษย์'], ['ชาวพื้น', 'มนุษย์'], ['ผู้กลับชาติ', 'มนุษย์'], ['ผู้ถูกอัญเชิญ', 'มนุษย์'], ['ชาวหิน', 'มนุษย์'],
  ['อาเวียน', 'เผ่าปีก'], ['ลูกหลานปีก', 'เผ่าปีก'], ['เผ่านก', 'เผ่าสัตว์'], ['โอเกอร์', 'ออร์ค'], ['ฮาล์ฟออร์ค', 'ออร์ค'], ['เผ่าหมาป่า', 'เผ่าสัตว์'], ['เผ่าสิงโต', 'เผ่าสัตว์'], ['เผ่ากวาง', 'เผ่าสัตว์'],
  ['ภูต', 'ภูตพราย'], ['หุ่นมีวิญญาณ', 'หุ่นวิญญาณ'], ['ปีศาจ', 'เผ่าปีศาจ'], ['ตุ๊กตา', 'ลูกผสมจักรกล']];
life.sort((a, b) => b[0].length - a[0].length);
const span = (label) => {
  const find = (t) => life.find(([n]) => t.startsWith(n)) || life.find(([n]) => n === (ALIAS.find(([k]) => t.startsWith(k)) || [])[1]);
  const [a, b] = label.split('ครึ่ง');
  const x = find(a.trim());
  const y = b ? find(b.trim()) : null;
  if (!x) return null;
  return y ? [(x[1] + y[1]) / 2, (x[2] + y[2]) / 2] : [x[1], x[2]];
};

// ---- NPC rows ----
const EV = /\b(?:DR|PL|WR|CT|DM|MC|BIO|GD|HP|PO|GI|FG|END|LE)-\d{2}\b/g;
const rows = [];
const skipped = [];
for (const f of fs.readdirSync(path.join(docs, 'lore/npcs')).filter((n) => /^\d\d-.*\.md$/.test(n)).sort())
  for (const line of read(`lore/npcs/${f}`).split('\n')) {
    const m = line.match(/^\| ([A-Z]{2}\d{2}-\d) \| \*\*([^*]*)\*\* *\(([^)]*)\)/);
    if (!m) continue;
    // codes after an arrow are effects of the story, not its opening (README section 7)
    const opening = line.replace(/→\s*(?:`?(?:DR|PL|WR|CT|DM|MC|BIO|GD|HP|PO|GI|FG|END|LE)-\d{2}`?(?:\s*(?:,|\/|และ|หรือ)\s*)?)+/g, '');
    const codes = [...new Set(opening.match(EV) || [])];
    if (!codes.length) continue;
    const [race, ageText] = m[3].split('·').map((x) => x.trim());
    const age = Number((ageText || '').replace(/[^\d]/g, ''));
    const s = span(race);
    if (!s || !age) { skipped.push(`${m[1]} ${m[2]} (${m[3]})`); continue; }
    if (age > s[1]) { skipped.push(`${m[1]} ${m[2]} (${m[3]}, ข้อยกเว้นอายุ world-time หัวข้อ 6)`); continue; }
    rows.push({ id: m[1], name: m[2], race, age, lo: s[0], hi: s[1], codes, file: f, open: 0, first: [] });
  }

// ---- worlds ----
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
for (let s = 1; s <= WORLDS; s++) {
  const w = runWorld(s * 7919);
  const when = new Map([...w.fired].map(([id, ys]) => [id, Math.min(...ys) - START]));
  for (const [y, id] of w.le || []) if (!when.has(id) || when.get(id) > y - START) when.set(id, y - START);
  const r = rng(s * 31337);
  for (const n of rows) {
    const L = Math.max(n.lo, n.age) + r() * Math.max(0, n.hi - Math.max(n.lo, n.age));
    const left = L - n.age;
    const t = Math.min(...n.codes.map((c) => (when.has(c) ? when.get(c) : Infinity)));
    if (t <= left) n.open++;
    if (t < Infinity) n.first.push(t);
  }
}

// ---- report ----
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
for (const n of rows) { n.p = n.open / WORLDS; n.med = med(n.first); n.seen = n.first.length / WORLDS; }
const dead = rows.filter((n) => n.p < DEAD), weak = rows.filter((n) => n.p >= DEAD && n.p < WEAK);
const fmt = (n) => `${n.id} ${n.name} (${n.race} · ${n.age}, เหลือ ≤ ${Math.round(n.hi - n.age)} ปีโลก) ${n.codes.join(' ')} → เปิดทัน ${Math.round(n.p * 100)}% · เหตุการณ์แรกกลาง ${n.med === null ? 'ไม่เกิด' : `ปีที่ ${n.med}`} (เกิดใน ${Math.round(n.seen * 100)}% ของโลก)`;
const tier = (n) => (n.id.endsWith('-1') ? 'ตำแหน่ง' : 'อื่น');
if (md) {
  console.log(`| ระดับ | แถว | ผู้นำ (-1 มีผู้สืบ) | อื่น |\n| --- | --- | --- | --- |`);
  for (const [k, list] of [['เปิดไม่ทัน (< 10%)', dead], ['เปิดยาก (10–30%)', weak], ['เปิดได้ (≥ 30%)', rows.filter((n) => n.p >= WEAK)]])
    console.log(`| ${k} | ${list.length} | ${list.filter((n) => tier(n) === 'ตำแหน่ง').length} | ${list.filter((n) => tier(n) !== 'ตำแหน่ง').length} |`);
}
console.log(`npc timeline: ${rows.length} event rows · cannot open in time ${dead.length} · hard ${weak.length} · skipped ${skipped.length} · ${WORLDS} worlds`);
for (const n of dead.sort((a, b) => a.p - b.p)) console.log('DEAD ' + fmt(n));
if (process.argv.includes('--all')) for (const n of weak.sort((a, b) => a.p - b.p)) console.log('WEAK ' + fmt(n));
if (skipped.length) console.log('skipped (no lifespan or age): ' + skipped.join(' · '));
