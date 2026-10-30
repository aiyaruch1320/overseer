// Builds docs/_generated/weapon-catalog.md from the weapon tables in docs/systems/items/01-08 plus material variants.
// Run: node scripts/docs/build-weapon-catalog.mjs
import fs from 'node:fs';
import path from 'node:path';
import { root } from '../lib/paths.mjs';

const dir = path.join(root, 'docs/systems/items');
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

const SOURCES = [
  ['01-everyday-and-standard.md', 'ของใช้และมาตรฐาน'],
  ['03-job-weapons-common-1.md', 'อาชีพทั่วไป'],
  ['04-job-weapons-common-2.md', 'อาชีพทั่วไป'],
  ['05-job-weapons-secret-special.md', 'อาชีพลับและพิเศษ'],
  ['06-regional-weapons.md', 'ประเทศและทวีป'],
  ['07-forge-weapons.md', 'ชาติช่าง'],
  ['08-legendary.md', 'ตำนาน'],
];
const RARITY = ['ของใช้', 'C', 'U', 'R', 'E', 'L'];
const POWER = { C: 1, U: 2, R: 3 };

const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
const ticks = (s) => (s.match(/`[^`]+`/g) || []).map((t) => t.slice(1, -1));

// ---------- weapons written by hand ----------
const weapons = [];
for (const [file, source] of SOURCES) {
  for (const line of read(file).split('\n')) {
    if (!/^\| w[a-z]_/.test(line)) continue;
    const [id, name, rarity, power, type, tags, stats, ability, last] = cells(line);
    weapons.push({ id, name, rarity, power: Number(power), type, tags, stats, ability, last, source, file });
  }
}

// ---------- materials ----------
const materials = [];
let group = null;
for (const line of read('02-materials.md').split('\n')) {
  if (line.startsWith('## 2.')) group = 'โลหะ';
  if (line.startsWith('## 3.')) group = 'ไม้';
  if (line.startsWith('## 4.')) group = null;
  if (!group || !/^\| [a-z_]+ \|/.test(line) || line.startsWith('| ID')) continue;
  const [id, name, rarity, stats, tags, ability, excluded] = cells(line);
  materials.push({ id, name, rarity, stats, tags, ability, group, excluded: excluded === '—' ? [] : excluded.split(/\s+/) });
}

function addStats(a, b) {
  const sum = {};
  for (const t of [...ticks(a), ...ticks(b)]) {
    const m = t.match(/^([a-z]+)([+-]\d+)$/);
    if (m) sum[m[1]] = (sum[m[1]] || 0) + Number(m[2]);
  }
  const out = Object.entries(sum).filter(([, v]) => v !== 0).map(([k, v]) => `\`${k}${v > 0 ? '+' : ''}${v}\``);
  return out.length ? out.join(' ') : '—';
}
const join = (a, b) => [a, b].filter((x) => x && x !== '—').join(' · ') || '—';

const variants = [];
for (const w of weapons.filter((x) => x.id.startsWith('ws_') && (x.last === 'โลหะ' || x.last === 'ไม้'))) {
  for (const m of materials) {
    if (m.group !== w.last || m.excluded.includes(w.type)) continue;
    variants.push({
      id: `${w.id}_${m.id}`, name: `${w.name}${m.name}`, rarity: m.rarity, power: POWER[m.rarity], type: w.type,
      tags: join(w.tags, m.tags), stats: addStats(w.stats, m.stats), ability: join(w.ability, m.ability), source: 'รุ่นวัสดุ',
    });
  }
}
// dragon_bone is listed under both groups; it already applies to both through the loop above.

const all = [...weapons, ...variants];
const ids = new Set();
for (const w of all) {
  if (ids.has(w.id)) throw new Error(`duplicate id ${w.id}`);
  ids.add(w.id);
}

// ---------- write ----------
const count = (pred) => all.filter(pred).length;
const sources = [...new Set([...SOURCES.map(([, s]) => s), 'รุ่นวัสดุ'])];
let md = `# รายการอาวุธทั้งหมด

สร้างโดย \`node scripts/docs/build-weapon-catalog.mjs\` จากไฟล์ 01 ถึง 08 อย่าแก้ไฟล์นี้โดยตรง กติกาอยู่ที่ [../systems/items/README.md](../systems/items/README.md)

## สรุป

**รวม ${all.length} ชิ้น** (เขียนเอง ${weapons.length} · รุ่นวัสดุ ${variants.length})

| ที่มา | ${RARITY.join(' | ')} | รวม |
| --- | ${RARITY.map(() => '---').join(' | ')} | --- |
`;
for (const s of sources) {
  md += `| ${s} | ${RARITY.map((r) => count((w) => w.source === s && w.rarity === r) || '').join(' | ')} | ${count((w) => w.source === s)} |\n`;
}
md += `| **รวม** | ${RARITY.map((r) => count((w) => w.rarity === r)).join(' | ')} | ${all.length} |\n`;

const types = [...new Set(all.map((w) => w.type))];
md += `\n| ประเภท | จำนวน |\n| --- | --- |\n${types.map((t) => `| ${t} | ${count((w) => w.type === t)} |`).join('\n')}\n`;

for (const s of sources) {
  md += `\n## ${s}\n\n| ID | ชื่อ | ระดับ | พลัง | ประเภท | แท็ก | ค่าสถานะ | ความสามารถ |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const w of all.filter((x) => x.source === s)) {
    md += `| ${w.id} | ${w.name} | ${w.rarity} | ${w.power} | ${w.type} | ${w.tags} | ${w.stats} | ${w.ability} |\n`;
  }
}
fs.writeFileSync(path.join(root, 'docs/_generated/weapon-catalog.md'), md);
console.log(`weapons: ${weapons.length} hand-written + ${variants.length} variants = ${all.length}`);
