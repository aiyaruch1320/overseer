// Reads countries, NPCs, storylines, events and the birth table, writes docs/_generated/country-links.md:
// how a main character can reach each country (birth, storyline nodes, journeys, events) and where the country files disagree.
// Run: node scripts/docs/build-country-links.mjs
import fs from 'node:fs';
import path from 'node:path';
import { docs } from '../lib/paths.mjs';

const read = (f) => fs.readFileSync(path.join(docs, f), 'utf8');
const files = (d) => fs.readdirSync(path.join(docs, d)).filter((n) => /^\d\d-.*\.md$/.test(n)).map((n) => `${d}/${n}`);
const CODE = /\b(?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}\b/g;
const PEOPLE = [
  ['มนุษย์', 'hu'], ['เอลฟ์', 'el'], ['ดาร์กเอลฟ์', 'de'], ['คนแคระ', 'dw'], ['ออร์ค', 'or'], ['ฮาล์ฟลิง', 'ha'], ['เผ่าสัตว์', 'be'], ['นาคา', 'na'], ['เผ่ามังกร', 'dk'], ['แวมไพร์', 'va'],
  ['ภูตพราย', 'fa'], ['สไลม์', 'sl'], ['เผ่าปีศาจ', 'dm'], ['เงือก', 'me'], ['เผ่าปีก', 'wi'], ['ยักษ์', 'gi'], ['เผ่าลาวา', 'la'], ['ลูกผสมจักรกล', 'co'], ['หุ่นวิญญาณ', 'so'], ['มัมมี่', 'mu'], ['กูล', 'gh'],
];
const KEYS = [['ดาร์กเอลฟ์', 'de'], ['เอลฟ์', 'el'], ['คนแคระ', 'dw'], ['ฮาล์ฟลิง', 'ha'], ['เผ่าปีศาจ', 'dm'], ['ออร์ค', 'or'], ['โอเกอร์', 'or'], ['ยักษ์', 'gi'], ['ลูกผสมจักรกล', 'co'], ['เผ่าลาวา', 'la'], ['กูล', 'gh'], ['เผ่าสัตว์', 'be'], ['เผ่าเสือ', 'be'], ['เผ่าหมาป่า', 'be'], ['เผ่าอูฐ', 'be'], ['เผ่าหมี', 'be'], ['เผ่ามังกร', 'dk'], ['อาเวียน', 'wi'], ['ปีก', 'wi'], ['เผ่านก', 'wi'], ['แวมไพร์', 'va'], ['นาคา', 'na'], ['สไลม์', 'sl'], ['มัมมี่', 'mu'], ['หุ่น', 'so'], ['ภูต', 'fa'], ['เงือก', 'me'], ['ไซเรน', 'me'], ['มนุษย์', 'hu']];
const groupsIn = (text) => new Set(KEYS.filter(([k]) => text.includes(k)).map(([, c]) => c));
const groupOfLabel = (label) => (KEYS.find(([k]) => label.startsWith(k)) || [, null])[1];

const countries = {};
for (const f of files('lore/countries')) {
  let cur = null;
  for (const line of read(f).split('\n')) {
    const h = line.match(/^#### ((?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}) (\S+)/);
    if (h) { cur = h[1]; countries[cur] = { name: h[2], races: '', rel: '' }; continue; }
    if (!cur) continue;
    const r = line.match(/\*\*เผ่า:\*\* ([^·]*)/); if (r) countries[cur].races = r[1].trim();
    const q = line.match(/^- \*\*ความสัมพันธ์:\*\* (.*)/); if (q) countries[cur].rel = q[1];
  }
}
const codes = Object.keys(countries);
const num = (c) => Number(c.slice(3));

// birth table: which peoples can be born in a country
const birth = Object.fromEntries(codes.map((c) => [c, new Set()]));
const originText = read('systems/character/01-origin.md').split('## 3.')[1].split('## 4.')[0];
for (const line of originText.split('\n')) {
  const cells = line.split('|').map((x) => x.trim());
  const people = PEOPLE.find(([n]) => n === cells[1]);
  if (!people) continue;
  const span = cells.slice(2, 5).filter((x) => /[A-Z]{2}-\d{2}/.test(x)).join(' ');
  for (const m of span.matchAll(/\b([A-Z]{2})-(\d{2}) ถึง \1-?(\d{2})\b/g)) for (let i = Number(m[2]); i <= Number(m[3]); i++) birth[`${m[1]}-${String(i).padStart(2, '0')}`]?.add(people[1]);
  for (const c of span.replace(/\b[A-Z]{2}-\d{2} ถึง [A-Z]{2}-?\d{2}\b/g, '').match(CODE) || []) birth[c]?.add(people[1]);
}

// rule in 01-origin section 3: a people named in a country's race field can be born there; "ทุกเผ่า" countries admit everyone
const codeOf = Object.fromEntries(PEOPLE.map(([n, c]) => [c, n]));
for (const c of codes) {
  if (/ทุกเผ่า/.test(countries[c].races)) { PEOPLE.forEach(([, k]) => birth[c].add(k)); continue; }
  for (const k of groupsIn(countries[c].races)) birth[c].add(k);
}

// storyline and journey mentions
const nodeMention = Object.fromEntries(codes.map((c) => [c, new Set()]));
const journeyMention = Object.fromEntries(codes.map((c) => [c, 0]));
for (const f of files('lore/storylines')) {
  const isJourney = f.endsWith('25-journeys.md');
  for (const line of read(f).split('\n')) {
    const m = line.match(/^\| ([a-z]{2}\.[btael]\d) \|/);
    if (!m && !(isJourney && /^## /.test(line))) { if (!isJourney) continue; }
    for (const c of new Set(line.match(CODE) || [])) {
      if (!countries[c]) continue;
      if (m) nodeMention[c].add(m[1].slice(0, 2));
      if (isJourney) journeyMention[c]++;
    }
  }
}
// events
const eventsOf = Object.fromEntries(codes.map((c) => [c, []]));
const lcOf = Object.fromEntries(codes.map((c) => [c, []]));
for (const f of ['systems/events/world-events.md', 'systems/events/branches/01-dragon-falls.md', 'systems/events/branches/02-new-lands.md', 'systems/events/local-events.md', '_generated/local-events-by-country.md'])
  for (const line of read(f).split('\n')) {
    const m = line.match(/^\| \*\*([A-Z]+-\d+)/);
    if (!m) continue;
    const isLc = m[1].startsWith('LC-');
    const scope = isLc ? line.split('|')[2] : line;
    for (const c of codes) if (scope.includes(c) || (countries[c].name.length >= 4 && scope.includes(countries[c].name))) (isLc ? lcOf[c] : eventsOf[c]).push(m[1]);
  }
// npcs
const npcs = {};
for (const f of files('lore/npcs'))
  for (const line of read(f).split('\n')) {
    const m = line.match(/^\| ([A-Z]{2}\d{2}-\d) \| \*\*([^*]*)\*\* *\(([^·)]*)/);
    if (m) (npcs[m[1].replace(/(\d{2})-\d$/, '-$1')] ||= []).push({ id: m[1], name: m[2], group: groupOfLabel(m[3].trim()) });
  }

// relations: split by " · ", classify, compare both sides
const ALLY = /พันธมิตร|เพื่อน|ใกล้ชิด|เห็นใจ|ร่วมมือ/, FOE = /ศัตรู|ตึงเครียด|ขัดแย้ง|หวาดระแวง|ระแวง|ทะเลาะ/;
const rel = Object.fromEntries(codes.map((c) => [c, { ally: new Set(), foe: new Set() }]));
for (const c of codes) for (const seg of countries[c].rel.split(' · ')) {
  const list = (seg.match(CODE) || []).filter((x) => x !== c && countries[x]);
  if (ALLY.test(seg) && !FOE.test(seg)) list.forEach((x) => rel[c].ally.add(x));
  else if (FOE.test(seg) && !ALLY.test(seg)) list.forEach((x) => rel[c].foe.add(x));
}
const clash = [];
for (const a of codes) {
  for (const b of rel[a].ally) if (rel[b].foe.has(a)) clash.push(`${a} ${countries[a].name} ถือ ${b} ${countries[b].name} เป็นพันธมิตร แต่ ${b} ถือ ${a} เป็นศัตรูหรือตึงเครียด`);
  for (const b of rel[a].foe) if (rel[b].ally.has(a) && a < b) clash.push(`${a} ${countries[a].name} ถือ ${b} ${countries[b].name} เป็นศัตรูหรือตึงเครียด แต่ ${b} ถือ ${a} เป็นพันธมิตร`);
}
const raceMismatch = [];
for (const c of codes) {
  const have = groupsIn(countries[c].races);
  if (/ทุกเผ่า/.test(countries[c].races)) continue;
  for (const n of npcs[c] || []) if (n.group && !have.has(n.group) && n.group !== 'hu') raceMismatch.push(`${n.id} ${n.name} (${n.group}) ใน ${c} ${countries[c].name} ซึ่งช่อง เผ่า ระบุ "${countries[c].races.slice(0, 40)}"`);
}

// hand-written local events: every NPC from another country must have a stated relation or share the continent
const lcCross = [];
const relAny = (a, b) => new RegExp(b).test(countries[a].rel) || new RegExp(a).test(countries[b].rel);
for (const line of read('systems/events/local-events.md').split('\n')) {
  const m = line.match(/^\| \*\*(LC-\d\d) ([^*]*)\*\* \| ((?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2})/);
  if (!m) continue;
  const cell = line.split('|')[4] || '';
  for (const [, id] of cell.matchAll(/\b([A-Z]{2}\d{2})-\d\b/g)) {
    const other = id.replace(/^([A-Z]{2})(\d{2})/, '$1-$2');
    if (other === m[3] || !countries[other]) continue;
    if (other.slice(0, 2) !== m[3].slice(0, 2) && !relAny(m[3], other)) lcCross.push(`${m[1]} ${m[2]} (${m[3]}) มี NPC จาก ${other} ${countries[other].name} ต่างทวีปโดยไฟล์ประเทศทั้งสองไม่ระบุความสัมพันธ์`);
  }
}
const lcCrossUnique = [...new Set(lcCross)];

const out = [];
out.push('# การเชื่อมของแต่ละประเทศกับตัวละครหลัก (สร้างอัตโนมัติ)', '');
out.push('สร้างด้วย `node scripts/docs/build-country-links.mjs` ห้ามแก้ด้วยมือ ตอบสองคำถาม: (1) ตัวละครหลักไปถึงประเทศนี้ได้ทางไหน (2) ไฟล์ประเทศ NPC และเหตุการณ์ขัดกันตรงไหน', '');
out.push('ทางที่ตัวละครหลักไปถึงประเทศได้: **เกิด** (ตารางถิ่นเกิดใน [../systems/character/01-origin.md](../systems/character/01-origin.md) หัวข้อ 3) · **โหนดเส้นเรื่อง** ที่ระบุรหัสประเทศ · **เส้นเดินทาง** ใน [../lore/storylines/25-journeys.md](../lore/storylines/25-journeys.md) · **เหตุการณ์โลก** และ **เหตุการณ์ท้องถิ่น** ที่ระบุประเทศ (ตัวละครที่อยู่ในประเทศในปีนั้นเข้าร่วมได้)', '');
const noBirth = codes.filter((c) => !birth[c].size), noNode = codes.filter((c) => !nodeMention[c].size), noWay = codes.filter((c) => !birth[c].size && !nodeMention[c].size && !journeyMention[c]);
out.push('## 1. สรุป', '');
out.push(`- ประเทศ ${codes.length} แห่ง เกิดได้โดยกำหนด (ถิ่นหลักหรือพลัดถิ่นในตารางถิ่นเกิด หรือช่อง เผ่า ของประเทศระบุเผ่านั้น) ${codes.length - noBirth.length} แห่ง ไม่มีเผ่าใดเกิดที่นั่นเลย ${noBirth.length} แห่ง`);
out.push(`- มีโหนดเส้นเรื่องระบุรหัสประเทศ ${codes.length - noNode.length} แห่ง ไม่มีโหนดใดระบุ ${noNode.length} แห่ง`);
out.push(`- ตัวละครหลักไปถึงได้ด้วยทางใดทางหนึ่งข้างต้นไม่ได้เลย (ไม่เกิด ไม่มีโหนด ไม่มีเส้นเดินทาง) ${noWay.length} แห่ง ซึ่งถึงได้เพียงโดยเหตุการณ์หรือการเดินทางสุ่มตามกติกา [../systems/travel/01-travel-rules.md](../systems/travel/01-travel-rules.md)`);
out.push(`- ความสัมพันธ์ที่สองไฟล์ขัดกัน ${clash.length} คู่ · NPC ที่เผ่าไม่อยู่ในช่อง เผ่า ของประเทศ ${raceMismatch.length} ตัว · NPC ข้ามทวีปในเหตุการณ์ท้องถิ่นเขียนมือที่ไม่มีความสัมพันธ์รองรับ ${lcCrossUnique.length} รายการ`, '');
out.push('## 2. ความขัดกันที่พบ', '', '### 2.1 ความสัมพันธ์ระหว่างประเทศ', '', clash.length ? clash.map((x) => `- ${x}`).join('\n') : '- ไม่พบ', '', '### 2.2 NPC ที่เผ่าไม่ตรงช่อง เผ่า ของประเทศ', '', 'ช่อง เผ่า เป็นข้อความอิสระ รายการนี้ใช้ตรวจว่าควรเพิ่มเผ่าในไฟล์ประเทศหรือแก้ NPC', '', raceMismatch.length ? raceMismatch.map((x) => `- ${x}`).join('\n') : '- ไม่พบ', '');
out.push('### 2.3 เหตุการณ์ท้องถิ่นเขียนมือที่ NPC ข้ามทวีปไม่มีความสัมพันธ์รองรับ', '', lcCrossUnique.length ? lcCrossUnique.map((x) => `- ${x}`).join('\n') : '- ไม่พบ', '');
out.push('## 3. ตารางทุกประเทศ', '', '| ประเทศ | เผ่าที่เกิดได้ตามกติกา | เผ่าที่มีโหนดระบุประเทศ | เส้นเดินทางที่ระบุ | เหตุการณ์โลก | เหตุการณ์ท้องถิ่น | NPC |', '| --- | --- | --- | --- | --- | --- | --- |');
for (const c of codes) out.push(`| ${c} ${countries[c].name} | ${[...birth[c]].join(' ') || '-'} | ${[...nodeMention[c]].join(' ') || '-'} | ${journeyMention[c] || '-'} | ${new Set(eventsOf[c]).size || '-'} | ${[...new Set(lcOf[c])].join(' ') || '-'} | ${(npcs[c] || []).length} |`);
out.push('');
fs.writeFileSync(path.join(docs, '_generated/country-links.md'), out.join('\n'));
console.log(`country links: ${codes.length} countries · no birth ${noBirth.length} · no node ${noNode.length} · no way ${noWay.length} · relation clashes ${clash.length} · npc race mismatches ${raceMismatch.length}`);
