// Builds docs/_generated/npc-economy.md: class and gold of every NPC at the start of the story,
// from the rules in docs/systems/economy/03-classes.md section 8 and the W of each country in 02-countries.md.
// Run: node scripts/docs/build-npc-economy.mjs
import fs from 'node:fs';
import path from 'node:path';
import { docs } from '../lib/paths.mjs';

const read = (f) => fs.readFileSync(path.join(docs, f), 'utf8');
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
const num = (s) => Number(s.replace(/,/g, ''));

// ---------- rules (03-classes section 8) ----------
const sec = read('systems/economy/03-classes.md').split('## 8. NPC')[1].split(/^## 9\./m)[0];
const rows = sec.split('\n').filter((l) => l.startsWith('| ') && !/^\| (---|ลำดับ|NPC|ชั้น) /.test(l)).map(cells);
const keywordRules = rows.filter((c) => /^\d+$/.test(c[0]) && /^\d$/.test(c[2]) && !/รหัสลงท้าย|ที่เหลือ|ยกเว้น/.test(c[1])).map((c) => [Number(c[2]), c[1].split(/\s+/)]);
const exceptions = Object.fromEntries(rows.filter((c) => /^[A-Z]{2}\d{2}-\d /.test(c[0])).map((c) => [c[0].split(' ')[0], Number(c[1])]));
const median = Object.fromEntries(rows.filter((c) => /^\d$/.test(c[0]) && c.length === 3 && /^[\d,]+$/.test(c[1])).map((c) => [Number(c[0]), num(c[1])]));
if (keywordRules.length !== 4 || Object.keys(median).length !== 5) throw new Error(`03-classes section 8: expected 4 keyword rules and 5 class medians, got ${keywordRules.length} and ${Object.keys(median).length}`);

// ---------- W of each country and the income index ----------
const W = {};
for (const line of read('systems/economy/02-countries.md').split('\n')) {
  const m = line.match(/^\| ([A-Z]{2}-\d{2}) \| [^|]+ \| (\d) → (\d) \|/);
  if (m) W[m[1]] = Number(m[3]);
}
const INCOME = {};
for (const line of read('systems/economy/02-countries.md').split('\n')) {
  const m = line.match(/^\| (\d) \| [^|]+ \| ×[\d.]+ \| ×([\d.]+) \|/);
  if (m) INCOME[m[1]] = Number(m[2]);
}

// ---------- NPCs ----------
const npcs = [];
for (const f of fs.readdirSync(path.join(docs, 'lore/npcs')).filter((n) => /^\d\d-/.test(n)).sort())
  for (const line of read('lore/npcs/' + f).split('\n')) {
    const m = line.match(/^\| ([A-Z]{2}\d{2}-\d) \| \*\*([^*]+)\*\* \([^)]*\)([^|]*)\|/);
    if (!m) continue;
    const [, id, name, role] = m;
    const text = `${name} ${role}`;
    const cls = exceptions[id] ?? (id.endsWith('-1') ? 5 : (keywordRules.find(([, words]) => words.some((w) => text.includes(w))) || [3])[0]);
    const country = id.replace(/^([A-Z]{2})(\d{2})-\d$/, '$1-$2');
    const w = W[country];
    npcs.push({ id, name: name.trim(), role: role.trim(), country, w, cls, gold: Math.round(median[cls] * (INCOME[w] ?? 1)) });
  }
const missingW = [...new Set(npcs.filter((n) => !n.w).map((n) => n.country))];
if (missingW.length) throw new Error('no W for ' + missingW.join(' '));

// ---------- output ----------
const count = [1, 2, 3, 4, 5].map((c) => npcs.filter((n) => n.cls === c).length);
const out = [
  '# ชนชั้นและทองของ NPC (สร้างอัตโนมัติ)',
  '',
  'สร้างด้วย `node scripts/docs/build-npc-economy.mjs` ห้ามแก้ด้วยมือ กติกาอยู่ใน [../systems/economy/03-classes.md](../systems/economy/03-classes.md) หัวข้อ 8 W ของประเทศจาก [../systems/economy/02-countries.md](../systems/economy/02-countries.md) ค่าเป็นของ ณ ต้นเรื่อง (ศ.ม. 10,400)',
  '',
  `NPC ${npcs.length} ตัว · ชั้น 1: ${count[0]} · ชั้น 2: ${count[1]} · ชั้น 3: ${count[2]} · ชั้น 4: ${count[3]} · ชั้น 5: ${count[4]}`,
  '',
  '| NPC | ชื่อ | บทบาท | ประเทศ (W) | ชั้น | ทอง |',
  '| --- | --- | --- | --- | --- | --- |',
  ...npcs.map((n) => `| ${n.id} | ${n.name} | ${n.role || '-'} | ${n.country} (${n.w}) | ${n.cls} | ${n.gold.toLocaleString('en-US')} |`),
  '',
];
fs.writeFileSync(path.join(docs, '_generated/npc-economy.md'), out.join('\n'));
console.log(`npc economy: ${npcs.length} npcs · class 1-5: ${count.join(' ')}`);
