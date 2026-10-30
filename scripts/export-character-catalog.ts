// Dumps the in-game traits, aptitudes, skills, blessings and curses to docs/_generated/character-catalog/*.md
// Run: npx tsx scripts/export-character-catalog.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLESSINGS, CURSES } from '../src/data/gifts';
import { TRAITS, TRAIT_CONFLICTS, APTITUDES, SKILLS, UNIQUE_SKILLS } from '../src/data/traits';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (f: string, s: string) => fs.writeFileSync(path.join(root, 'docs/_generated/character-catalog', f), s);
const cell = (s: unknown) => String(s ?? '').replace(/\|/g, '/');
const table = (head: string[], rows: unknown[][]) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
const hdr = (title: string, note: string) => `# ${title}\n\nสร้างจากโค้ดเกม (\`${note}\`) ด้วย \`scripts/export-character-catalog.ts\` · ระบบ: [../../systems/character/README.md](../../systems/character/README.md)\n\n`;

// traits
out('traits.md', hdr(`นิสัย ${TRAITS.length} รายการ`, 'src/data/traits.ts') +
  table(['ID', 'ชื่อ', 'ผล', 'คำอธิบาย'], TRAITS.map((t) => [t.id, t.name, t.fx, t.desc])) +
  `\n\n## นิสัยที่อยู่ร่วมกันไม่ได้\n\n` + table(['นิสัย', 'ขัดกับ'], TRAIT_CONFLICTS.map(([a, b]) => [`${a} (${TRAITS.find((t) => t.id === a)!.name})`, `${b} (${TRAITS.find((t) => t.id === b)!.name})`])) + '\n');

// aptitudes + skills
const sk = (id: string) => SKILLS.find((s) => s.id === id)!;
out('aptitudes-skills.md', hdr(`ความถนัด ${APTITUDES.length} หมวด และ skill ${SKILLS.length} รายการ`, 'src/data/traits.ts') +
  `ความถนัดหนึ่งหมวดปลด skill 3 ระดับ (ค่า +1 +2 +3 ของสถานะหลัก) และ skill เฉพาะตัวอีก ${UNIQUE_SKILLS.length} รายการ\n\n## ความถนัด\n\n` +
  table(['ID', 'ชื่อ', 'สถานะหลัก', 'แท็ก', 'ระดับ 1', 'ระดับ 2', 'ระดับ 3'],
    APTITUDES.map((a) => [a.id, a.name, a.stat, a.tags.join(' '), ...a.skills.map((id) => sk(id).name)])) +
  `\n\n## skill เฉพาะตัว\n\n` + table(['ID', 'ชื่อ', 'ผล', 'คำอธิบาย'], UNIQUE_SKILLS.map((s) => [s.id, s.name, s.fx, s.desc])) + '\n');

// gifts
const gift = (title: string, list: typeof BLESSINGS) => hdr(`${title} ${list.length} รายการ`, 'src/data/gifts.ts') +
  `ระดับ C ธรรมดา · U ไม่ธรรมดา · R หายาก · E มหากาพย์ · L ตำนาน (ระดับราคา 1–3 กำหนดความแพงเมื่อซื้อ)\n\n` +
  table(['ID', 'ชื่อ', 'ระดับ', 'ราคา', 'ผล', 'คำอธิบาย'], list.map((g) => [g.id, g.name, g.rarity, g.tier, g.fx, g.desc]));
out('blessings.md', gift('พร', BLESSINGS) + '\n');
out('curses.md', gift('คำสาป', CURSES) + '\n');

// tag glossary (used by the lore layer)
const tags = new Map<string, number>();
for (const g of [...BLESSINGS, ...CURSES]) for (const m of g.fx.matchAll(/#(\w+)/g)) tags.set(m[1], (tags.get(m[1]) || 0) + 1);
for (const t of TRAITS) for (const m of t.fx.matchAll(/#(\w+)/g)) tags.set(m[1], (tags.get(m[1]) || 0) + 1);
for (const s of UNIQUE_SKILLS) for (const m of s.fx.matchAll(/#(\w+)/g)) tags.set(m[1], (tags.get(m[1]) || 0) + 1);
out('tags.md', hdr(`แท็กผลพิเศษ ${tags.size} รายการ`, 'ผล #แท็ก ในพร คำสาป นิสัย skill') +
  table(['แท็ก', 'จำนวนที่ใช้'], [...tags.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, n]) => ['#' + t, n])) + '\n');
console.log({ traits: TRAITS.length, apt: APTITUDES.length, skills: SKILLS.length, blessings: BLESSINGS.length, curses: CURSES.length, tags: tags.size });
