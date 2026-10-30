// Reads docs/lore/storylines, docs/lore/npcs and docs/lore/countries, writes docs/_generated/storyline-balance.md
// (per-race nodes, convergence entries, continents, other-race contacts, NPCs and countries). Run: node scripts/docs/build-storyline-balance.mjs
import fs from 'node:fs';
import path from 'node:path';
import { docs } from '../lib/paths.mjs';

const RACES = [
  ['hu', 'มนุษย์', '01-human.md'], ['el', 'เอลฟ์', '02-elf.md'], ['de', 'ดาร์กเอลฟ์', '03-darkelf.md'], ['dw', 'คนแคระ', '04-dwarf.md'],
  ['or', 'ออร์ค', '05-orc.md'], ['ha', 'ฮาล์ฟลิง', '06-halfling.md'], ['be', 'เผ่าสัตว์', '07-beast.md'], ['na', 'นาคา', '08-naga.md'],
  ['dk', 'เผ่ามังกร', '09-dragonkin.md'], ['va', 'แวมไพร์', '10-vampire.md'], ['fa', 'ภูตพราย', '11-fae.md'], ['sl', 'สไลม์', '12-slime.md'],
  ['dm', 'เผ่าปีศาจ', '13-demonkin.md'], ['me', 'เงือก', '14-merfolk.md'], ['wi', 'เผ่าปีก', '15-winged.md'], ['gi', 'ยักษ์', '16-giant.md'],
  ['la', 'เผ่าลาวา', '17-lavakin.md'], ['co', 'ลูกผสมจักรกล', '18-construct.md'], ['so', 'หุ่นวิญญาณ', '19-soulmachine.md'],
  ['mu', 'มัมมี่', '20-mummy.md'], ['gh', 'กูล', '21-ghoul.md'],
];
// Labels in NPC rows and country entries are free text. Prefix list (NPC rows) and keyword list (country races) map them to race codes.
const NPC_GROUPS = [
  ['ดาร์กเอลฟ์', 'de'], ['เอลฟ์ใต้ดิน', 'de'], ['เอลฟ์', 'el'], ['คนแคระ', 'dw'], ['ฮาล์ฟลิง', 'ha'], ['เผ่าปีศาจ', 'dm'], ['ออร์ค', 'or'], ['โอเกอร์', 'or'],
  ['ยักษ์', 'gi'], ['ลูกผสมจักรกล', 'co'], ['เผ่าลาวา', 'la'], ['กูล', 'gh'], ['เผ่าสัตว์', 'be'], ['เผ่าเสือ', 'be'], ['เผ่าหมี', 'be'], ['เผ่าหมาป่า', 'be'],
  ['เผ่ามังกร', 'dk'], ['อาเวียน', 'wi'], ['ปีก', 'wi'], ['เผ่านก', 'wi'], ['แวมไพร์', 'va'], ['นาคา', 'na'], ['สไลม์', 'sl'], ['มัมมี่', 'mu'], ['หุ่น', 'so'],
  ['ภูต', 'fa'], ['เงือก', 'me'], ['ไซเรน', 'me'], ['มนุษย์', 'hu'],
];
const COUNTRY_KEYS = [
  ['ดาร์กเอลฟ์', 'de'], ['เอลฟ์', 'el'], ['คนแคระ', 'dw'], ['ฮาล์ฟลิง', 'ha'], ['เผ่าปีศาจ', 'dm'], ['ออร์ค', 'or'], ['โอเกอร์', 'or'], ['ยักษ์', 'gi'],
  ['ลูกผสมจักรกล', 'co'], ['เผ่าลาวา', 'la'], ['กูล', 'gh'], ['เผ่าสัตว์', 'be'], ['เผ่าเสือ', 'be'], ['เผ่าหมาป่า', 'be'], ['เผ่าอูฐ', 'be'], ['เผ่ามังกร', 'dk'],
  ['อาเวียน', 'wi'], ['ปีก', 'wi'], ['เผ่านก', 'wi'], ['แวมไพร์', 'va'], ['นาคา', 'na'], ['สไลม์', 'sl'], ['มัมมี่', 'mu'], ['หุ่น', 'so'], ['ภูตพราย', 'fa'],
  ['เงือก', 'me'], ['ไซเรน', 'me'], ['มนุษย์', 'hu'],
];
const groupOf = (label) => (NPC_GROUPS.find(([p]) => label.startsWith(p)) || [, 'other'])[1];
const read = (f) => fs.readFileSync(path.join(docs, f), 'utf8');

const npcs = {};
for (const f of fs.readdirSync(path.join(docs, 'lore/npcs')).filter((n) => /^\d\d-.*\.md$/.test(n)))
  for (const line of read(`lore/npcs/${f}`).split('\n')) {
    const m = line.match(/^\| ([A-Z]{2}\d{2}-\d) \| \*\*[^*]*\*\* *\(([^·)]*)/);
    if (m) npcs[m[1]] = groupOf(m[2].trim());
  }

// Countries: races named in the "เผ่า" field. The first race named is the dominant one; "ทุกเผ่า" counts as open to all.
const listed = {}, first = {};
let countries = 0, open = 0;
for (const f of fs.readdirSync(path.join(docs, 'lore/countries')).filter((n) => /^\d\d-.*\.md$/.test(n)))
  for (const line of read(`lore/countries/${f}`).split('\n')) {
    const m = line.match(/\*\*เผ่า:\*\* ([^·]*)/);
    if (!m) continue;
    countries++;
    const text = m[1].trim();
    if (text.startsWith('ทุกเผ่า')) { open++; continue; }
    const hits = COUNTRY_KEYS.map(([k, c]) => [text.indexOf(k), c]).filter(([i]) => i >= 0).sort((a, b) => a[0] - b[0]);
    const codes = [...new Set(hits.map(([, c]) => c))];
    codes.forEach((c) => { listed[c] = (listed[c] || 0) + 1; });
    if (codes[0]) first[codes[0]] = (first[codes[0]] || 0) + 1;
  }

const cv = {};
for (const line of read('lore/storylines/00-convergence.md').split('\n')) {
  const m = line.match(/^\| (cv\.\d+) \| [^|]*\| [^|]*\| [^|]*\| ([^|]*) \|$/);
  if (!m) continue;
  for (const [p] of m[2].matchAll(/\b[a-z]{2}(?=\.[btae]\d)/g)) cv[p] = (cv[p] || new Set()).add(m[1]);
}

// xc rows (journeys file) belong to the race named at the start of their event cell.
const xcRows = read('lore/storylines/25-journeys.md').split('\n').filter((l) => /^\| xc\.[abt]\d \|/.test(l));
const xcOf = (name) => xcRows.filter((l) => l.split('|')[3].trim().startsWith(name)).join('\n');

const rows = RACES.map(([code, name, file]) => {
  const nodes = read(`lore/storylines/${file}`).split('\n').filter((l) => new RegExp(`^\\| ${code}\\.[btael]\\d \\|`).test(l));
  const base = nodes.join('\n');
  const text = `${base}\n${xcOf(name)}`;
  const ids = (t) => [...t.matchAll(/\b([A-Z]{2}\d{2}-\d)\b/g)].map((m) => m[1]);
  const conts = (t) => new Set([...t.matchAll(/\b(AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}\b/g)].map((m) => m[1]));
  return {
    name, nodes: nodes.length, cv: cv[code] ? cv[code].size : 0,
    conts: conts(base).size, contsX: conts(text).size,
    contacts: new Set(ids(base).filter((id) => npcs[id] && npcs[id] !== code)).size,
    contactsX: new Set(ids(text).filter((id) => npcs[id] && npcs[id] !== code)).size,
    events: new Set([...text.matchAll(/\b(DR|PL|WR|CT|DM|MC|BIO|GD|HP|PO|GI|FG|END)-\d{2}\b/g)].map((m) => m[0])).size,
    npcs: Object.values(npcs).filter((g) => g === code).length,
    listed: listed[code] || 0, first: first[code] || 0,
  };
});

const total = Object.keys(npcs).length;
const cell = (a, b) => (b > a ? `${a} → ${b}` : `${a}`);
const out = [];
out.push('# สมดุลของเส้นเรื่องระหว่างเผ่า (สร้างอัตโนมัติ)', '', 'สร้างด้วย `node scripts/docs/build-storyline-balance.mjs` ห้ามแก้ด้วยมือ ใช้ดูว่าเผ่าไหนเป็นตัวเอกและเผ่าไหนเป็นแขกรับเชิญ รันซ้ำหลังเพิ่มเส้นเรื่อง', '');
out.push('ที่มา: ไฟล์เผ่าใน `lore/storylines/` (เฉพาะโหนดของเผ่านั้น) บวกโหนดเจอต่างเผ่า `xc` ของเผ่านั้นจาก `25-journeys.md` ในช่องที่มีลูกศร (ก่อน → หลังรวม xc) NPC และประเทศนับจากข้อความอิสระในไฟล์ ใช้เทียบสัดส่วน ไม่ใช่ตัวเลขแน่นอน', '');
out.push('## 1. ต่อเผ่า', '');
out.push('| เผ่า | โหนด | จุดบรรจบที่เข้าได้ | ทวีปที่โหนดกล่าวถึง | NPC ต่างเผ่าที่โหนดอ้าง | เหตุการณ์โลกที่ผูก | NPC ของเผ่า | ประเทศที่ระบุเผ่านี้ | ประเทศที่เป็นเผ่าแรก |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) out.push(`| ${r.name} | ${r.nodes} | ${r.cv} | ${cell(r.conts, r.contsX)} | ${cell(r.contacts, r.contactsX)} | ${r.events} | ${r.npcs} | ${r.listed} | ${r.first} |`);
out.push('');
const avg = (k) => (rows.reduce((s, r) => s + r[k], 0) / rows.length).toFixed(1);
const non = rows.slice(1);
const navg = (k) => (non.reduce((s, r) => s + r[k], 0) / non.length).toFixed(1);
out.push('## 2. สรุป', '');
out.push(`- NPC ที่แยกเผ่าได้ ${total - Object.values(npcs).filter((g) => g === 'other').length} จาก ${total} ตัว มนุษย์ ${rows[0].npcs} (${((rows[0].npcs / total) * 100).toFixed(0)}%) อีก ${Object.values(npcs).filter((g) => g === 'other').length} ตัวเป็นเผ่าย่อยที่ไม่ได้จัดกลุ่ม (ชาวหมอก ชาวพื้น ฯลฯ)`);
out.push(`- ประเทศ ${countries} แห่ง ระบุ "ทุกเผ่า" ${open} แห่ง ประเทศที่ระบุมนุษย์ ${rows[0].listed} แห่ง (${((rows[0].listed / countries) * 100).toFixed(0)}%)`);
out.push(`- จุดบรรจบที่เข้าได้เฉลี่ย: มนุษย์ ${rows[0].cv} · เผ่าอื่นเฉลี่ย ${navg('cv')}`);
out.push(`- NPC ต่างเผ่าที่โหนดอ้างเฉลี่ยของเผ่าที่ไม่ใช่มนุษย์: ${navg('contacts')} → ${navg('contactsX')} (รวมโหนด xc)`);
out.push(`- ทวีปที่โหนดกล่าวถึงเฉลี่ยของเผ่าที่ไม่ใช่มนุษย์: ${navg('conts')} → ${navg('contsX')} (รวมโหนด xc)`);
out.push('', '## 3. อ่านอย่างไร', '', '- มนุษย์เป็นตัวเอกเมื่อทุกช่องของมนุษย์สูงกว่าเผ่าอื่นหลายเท่า ช่องที่ควรปรับก่อนคือ "จุดบรรจบที่เข้าได้" และ "NPC ของเผ่า"', '- ต้องการให้เผ่าอื่นอย่างน้อย 3 NPC ต่างเผ่าต่อชีวิตตาม [../systems/travel/01-travel-rules.md](../systems/travel/01-travel-rules.md) หัวข้อ 5', '');

// Rows that only say "→ cv.N" have no content of their own. When the convergence is closed the slot is blank unless the people have fallback (l) nodes.
const CV_OPEN = { 4: 1, 10: 1, 12: 1, 13: 1, 8: 0.95, 1: 0.95, 16: 0.95, 2: 0.8, 15: 0.8, 6: 0.72, 14: 0.72, 5: 0.72, 7: 0.63, 9: 0.52, 11: 0.48, 3: 0.12 };
const gaps = RACES.map(([code, name, file]) => {
  const lines = read(`lore/storylines/${file}`).split('\n').filter((l) => new RegExp(`^\\| ${code}\\.[btael]\\d \\|`).test(l));
  const cvOnly = lines.filter((l) => (l.split('|')[4] || '').trim().startsWith('→ cv.')).map((l) => [l.split('|')[1].trim(), (l.match(/→ cv\.(\d+)/) || [])[1]]);
  const fallback = lines.filter((l) => new RegExp(`^\\| ${code}\\.l\\d \\|`).test(l)).length;
  const blank = cvOnly.reduce((sum, [, c]) => sum + (1 - (CV_OPEN[c] ?? 0.5)), 0);
  return { name, cvOnly, fallback, blank };
});
out.push('## 4. ช่องว่างเมื่อจุดบรรจบไม่เปิด', '');
out.push('โหนดที่เขียนเพียง "→ cv.N" ไม่มีเนื้อหาของตัวเอง ถ้าจุดบรรจบนั้นไม่เปิดในโลกนั้น ช่วงชีวิตนั้นว่าง ยกเว้นเผ่าที่มีโหนดสำรอง (รหัส `l`) โอกาสเปิดของจุดบรรจบใช้ตาม [../systems/simulation/world-sim.md](../systems/simulation/world-sim.md) หัวข้อ 3.5', '');
out.push('| เผ่า | โหนดที่เป็น → cv เท่านั้น | โหนดสำรอง | ช่องว่างคาดต่อชีวิต |', '| --- | --- | --- | --- |');
for (const g of gaps) out.push(`| ${g.name} | ${g.cvOnly.map(([id, c]) => `${id.slice(3)}→cv.${c}`).join(' ') || '-'} | ${g.fallback} | ${g.blank.toFixed(2)} |`);
out.push('');
fs.writeFileSync(path.join(docs, '_generated/storyline-balance.md'), out.join('\n'));
console.log(`storyline balance: ${rows.length} peoples · ${countries} countries · ${total} npcs`);
