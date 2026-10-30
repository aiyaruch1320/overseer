// Builds docs/_generated/item-catalog.md: every non-weapon item (armor, accessories, talismans, consumables,
// life tools, materials, key items) with its price at a W3 market, from the tables in docs/systems/items and
// the price rules in docs/systems/items/19-prices.md.  Run: node scripts/build-item-catalog.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs/systems/items');
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n');

const TIERS = ['C', 'U', 'R', 'E', 'L'];
// base price per tier (docs/systems/economy/04-income-and-living.md section 7); null = not sold
const BASE = {
  armor: [18, 60, 300, 960, null],
  accessory: [12, 40, 200, 640, null],
  folk: [8, 30, 150, null, null],
  ancient: [null, 120, 600, 1800, null],
  consumable: [3, 12, 55, 300, null],
  tool: [6, 24, 80, 600, null],
  material: [3.5, 14, 65, 200, 600],
};
// median stat budget per tier (docs/systems/items/11-item-system.md section 2)
const MID = { C: 1, U: 1.5, R: 2.5, E: 3.5, L: 5 };

const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const stat = (s) => {
  let net = 0;
  for (const m of s.matchAll(/`[a-z]+([+-]\d+)`/g)) net += Number(m[1]);
  return net;
};

const items = [];
function parse(file, kind, label, pick) {
  let head = null;
  for (const l of read(file)) {
    if (!l.startsWith('|')) { head = null; continue; }
    const c = cells(l);
    if (c[0] === 'ID') { head = c; continue; }
    if (!head || /^-+$/.test(c[0])) continue;
    const id = c[0];
    if (!/^[a-z]{2}_/.test(id)) continue;
    const tier = c[2];
    if (!TIERS.includes(tier)) continue;
    const k = typeof kind === 'function' ? kind(id) : kind;
    const tags = (l.match(/`#[a-z_]+`/g) || []).length;
    items.push({ id, name: c[1], tier, label, k, net: stat(l), tags, sell: pick ? pick(c, head) : '' });
  }
}
parse('12-armor.md', 'armor', 'เกราะและโล่');
parse('13-accessories.md', 'accessory', 'เครื่องประดับ');
parse('14-talismans.md', (id) => (id.startsWith('tm_f_') ? 'folk' : 'ancient'), 'เครื่องราง');
parse('16-consumables.md', 'consumable', 'ของใช้ในศึก');
parse('17-life-tools.md', 'tool', 'เครื่องมือชีวิต');
parse('18-materials-and-keys.md', (id) => (id.startsWith('ky_') ? 'key' : 'material'), 'วัสดุและของสำคัญ');

const price = (it) => {
  if (it.k === 'key') return null;
  const base = BASE[it.k][TIERS.indexOf(it.tier)];
  if (base == null) return null;
  if (it.k === 'consumable' || it.k === 'material' || it.k === 'tool') return Math.round(base);
  const adj = Math.min(1.35, Math.max(0.75, 1 + 0.08 * (it.net - MID[it.tier])));
  const tag = 1 + 0.05 * Math.min(3, it.tags);
  return Math.round(base * adj * tag);
};

const groups = [
  ['armor', 'เกราะและโล่'], ['accessory', 'เครื่องประดับ'], ['folk', 'ของขลังพื้นบ้าน'], ['ancient', 'เครื่องรางโบราณ'],
  ['consumable', 'ของใช้ในศึก'], ['tool', 'เครื่องมือชีวิต'], ['material', 'วัสดุจากสิ่งมีชีวิตและพืช'], ['key', 'ของสำคัญ'],
];
let md = `# รายการไอเทมที่ไม่ใช่อาวุธ

สร้างโดย \`node scripts/build-item-catalog.mjs\` จากไฟล์ 12 ถึง 18 อย่าแก้ไฟล์นี้โดยตรง กติการาคาอยู่ที่ [../systems/items/19-prices.md](../systems/items/19-prices.md) ราคาในตารางคือราคาซื้อที่ตลาดประเทศ W 3 ปกติ (ดัชนีราคา ×1.0) ราคารับซื้อ 40% ราคาขายตรงให้ผู้ใช้ 70% ของไอเทมที่ขาย

อาวุธอยู่ที่ [weapon-catalog.md](weapon-catalog.md)

## สรุป

| หมวด | ${TIERS.join(' | ')} | รวม |
| --- | ${TIERS.map(() => '---').join(' | ')} | --- |
`;
for (const [k, label] of groups) {
  const its = items.filter((i) => i.k === k);
  md += `| ${label} | ${TIERS.map((t) => its.filter((i) => i.tier === t).length || '').join(' | ')} | ${its.length} |\n`;
}
md += `| **รวม** | ${TIERS.map((t) => items.filter((i) => i.tier === t).length).join(' | ')} | ${items.length} |\n`;
for (const [k, label] of groups) {
  const its = items.filter((i) => i.k === k);
  md += `\n## ${label}\n\n| ID | ชื่อ | ระดับ | ราคาซื้อ | รับซื้อ 40% | ขายผู้ใช้ 70% |\n| --- | --- | --- | --- | --- | --- |\n`;
  for (const it of its) {
    const p = price(it);
    md += `| ${it.id} | ${it.name} | ${it.tier} | ${p == null ? 'ไม่ขาย' : p} | ${p == null ? '—' : Math.round(p * 0.4)} | ${p == null ? '—' : Math.round(p * 0.7)} |\n`;
  }
}
fs.writeFileSync(path.join(root, 'docs/_generated/item-catalog.md'), md);
const priced = items.filter((i) => price(i) != null).length;
console.log(`items: ${items.length} (priced ${priced}, not sold ${items.length - priced})`);
