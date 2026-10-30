// Reads world events, NPC rows and country files, writes docs/_generated/event-coverage.md:
// which countries have no event naming them, which NPCs have no event or NPC link, and how NPCs connect to each other.
// Run: node scripts/docs/build-event-coverage.mjs
import fs from 'node:fs';
import path from 'node:path';
import { docs } from '../lib/paths.mjs';

const read = (f) => fs.readFileSync(path.join(docs, f), 'utf8');
const CODE = /\b(?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}\b/g;
const EVT = /\b(?:DR|PL|WR|CT|DM|MC|BIO|GD|HP|PO|GI|FG|END|SF|AS|DW|RF|WT|RL|CL|DV|LC)-\d{2,3}\b/g;
const NPC = /\b[A-Z]{2}\d{2}-\d\b/g;
const CONT = { AZ: 'อัซการ์', MH: 'มอร์เฮเวน', KD: 'คาซ-ดูรัม', NR: 'เนเรีย', AL: 'อัลเดรีย', MK: 'เมคาเรีย', SH: 'ซาฮารัน', SV: 'ซิลวาเนล', NB: 'เนบูเลีย' };

const countries = {};
for (const f of fs.readdirSync(path.join(docs, 'lore/countries')).filter((n) => /^\d\d-.*\.md$/.test(n)))
  for (const m of read(`lore/countries/${f}`).matchAll(/^#### ((?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}) (\S+)/gm)) countries[m[1]] = { name: m[2], events: new Set(), npcs: [] };

const eventRows = {};
for (const f of ['systems/events/world-events.md', 'systems/events/branches/01-dragon-falls.md', 'systems/events/branches/02-new-lands.md', 'systems/events/local-events.md', '_generated/local-events-by-country.md'])
  for (const line of read(f).split('\n')) {
    const m = line.match(/^\| \*\*([A-Z]+-\d+)\b/);
    if (m) eventRows[m[1]] = line;
  }
// A country counts as named by an event when its code or its name appears in the event row.
for (const [id, line] of Object.entries(eventRows)) {
  for (const c of new Set(line.match(CODE) || [])) if (countries[c]) countries[c].events.add(id);
  for (const [c, v] of Object.entries(countries)) if (v.name.length >= 4 && line.includes(v.name)) v.events.add(id);
}

const npcs = {};
for (const f of fs.readdirSync(path.join(docs, 'lore/npcs')).filter((n) => /^\d\d-.*\.md$/.test(n)))
  for (const line of read(`lore/npcs/${f}`).split('\n')) {
    const m = line.match(/^\| ([A-Z]{2}\d{2}-\d) \| \*\*([^*]*)\*\*/);
    if (!m) continue;
    const body = line.slice(m[0].length);
    npcs[m[1]] = { name: m[2], country: m[1].replace(/(\d{2})-\d$/, '-$1'), events: new Set(body.match(EVT) || []), links: new Set((body.match(NPC) || []).filter((x) => x !== m[1])) };
    if (countries[npcs[m[1]].country]) countries[npcs[m[1]].country].npcs.push(m[1]);
  }

// An NPC listed in an event row (local events name their NPCs) counts as tied to that event.
for (const [id, line] of Object.entries(eventRows)) for (const k of new Set(line.match(NPC) || [])) if (npcs[k]) npcs[k].events.add(id);

// Links point both ways: A names B means B is linked to A.
const linked = Object.fromEntries(Object.keys(npcs).map((k) => [k, new Set(npcs[k].links)]));
for (const [k, n] of Object.entries(npcs)) for (const l of n.links) if (linked[l]) linked[l].add(k);

const noEvent = Object.entries(npcs).filter(([, n]) => !n.events.size).map(([k]) => k);
const noLink = Object.entries(linked).filter(([, s]) => !s.size).map(([k]) => k);
const isolated = Object.keys(npcs).filter((k) => !npcs[k].events.size && !linked[k].size);
const noEventCountries = Object.entries(countries).filter(([, c]) => !c.events.size).map(([k]) => k);

const out = [];
out.push('# ความครอบคลุมของเหตุการณ์ต่อประเทศและ NPC (สร้างอัตโนมัติ)', '');
out.push('สร้างด้วย `node scripts/docs/build-event-coverage.mjs` ห้ามแก้ด้วยมือ ใช้หาประเทศและ NPC ที่ยังไม่ผูกกับเหตุการณ์หรือ NPC อื่น เพื่อเพิ่มจุดบรรจบของ NPC', '');
out.push('ที่มา: เหตุการณ์ที่ระบุรหัสประเทศในแถวของตนใน `systems/events/` (ระบุด้วยรหัสหรือชื่อประเทศ เหตุการณ์ที่เขียนเพียงชื่อทวีปไม่นับ) และรหัสเหตุการณ์ รหัส NPC ที่ปรากฏในแถว NPC ใน `lore/npcs/` ความเชื่อมระหว่าง NPC นับสองทาง (A อ้างถึง B ถือว่า B เชื่อมกับ A)', '');
out.push('## 1. ต่อทวีป', '', '| ทวีป | ประเทศ | ประเทศที่ไม่มีเหตุการณ์ระบุชื่อ | NPC | NPC ที่ไม่ผูกเหตุการณ์ | NPC ที่ไม่เชื่อกับ NPC อื่น | NPC ที่ไม่มีทั้งสอง |', '| --- | --- | --- | --- | --- | --- | --- |');
for (const [p, name] of Object.entries(CONT)) {
  const cs = Object.keys(countries).filter((c) => c.startsWith(p));
  const ns = Object.keys(npcs).filter((k) => k.startsWith(p));
  out.push(`| ${name} (${p}) | ${cs.length} | ${cs.filter((c) => noEventCountries.includes(c)).length} | ${ns.length} | ${ns.filter((k) => noEvent.includes(k)).length} | ${ns.filter((k) => noLink.includes(k)).length} | ${ns.filter((k) => isolated.includes(k)).length} |`);
}
out.push(`| รวม | ${Object.keys(countries).length} | ${noEventCountries.length} | ${Object.keys(npcs).length} | ${noEvent.length} | ${noLink.length} | ${isolated.length} |`, '');
out.push('## 2. ประเทศที่ไม่มีเหตุการณ์ระบุชื่อ', '', noEventCountries.map((c) => `${c} ${countries[c].name}`).join(' · ') || '-', '');
out.push('## 3. ประเทศที่มีเหตุการณ์ผูกมากที่สุดและน้อยที่สุด (ไม่นับศูนย์)', '');
const ranked = Object.entries(countries).map(([c, v]) => [c, v.name, v.events.size]).filter((x) => x[2] > 0).sort((a, b) => b[2] - a[2]);
out.push('มากสุด: ' + ranked.slice(0, 8).map((x) => `${x[0]} ${x[1]} (${x[2]})`).join(' · '), '', 'น้อยสุด: ' + ranked.slice(-8).map((x) => `${x[0]} ${x[1]} (${x[2]})`).join(' · '), '');
out.push('## 4. NPC ที่ไม่ผูกเหตุการณ์และไม่เชื่อกับ NPC อื่น (เรื่องของเขาอยู่โดดเดี่ยว)', '', isolated.map((k) => `${k} ${npcs[k].name}`).join(' · ') || '-', '');
fs.writeFileSync(path.join(docs, '_generated/event-coverage.md'), out.join('\n'));
console.log(`event coverage: ${Object.keys(countries).length} countries · ${Object.keys(eventRows).length} events · ${Object.keys(npcs).length} npcs · isolated npcs ${isolated.length} · countries with no event ${noEventCountries.length}`);
