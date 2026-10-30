// Writes docs/_generated/local-events-by-country.md: one local event (LC-1xx) for every country that no hand-written event names,
// built from the templates LT-1..LT-6 in docs/systems/events/local-events.md, the country context overlay and the country's NPC rows.
// A hand-written row in local-events.md for a country suppresses its generated event. Run: node scripts/docs/build-local-events.mjs
import fs from 'node:fs';
import path from 'node:path';
import { docs } from '../lib/paths.mjs';

const read = (f) => fs.readFileSync(path.join(docs, f), 'utf8');
const files = (d) => fs.readdirSync(path.join(docs, d)).filter((n) => /^\d\d-.*\.md$/.test(n)).map((n) => `${d}/${n}`);
const CODE = /\b(?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}\b/g;

// countries: name and relations
const countries = {};
for (const f of files('lore/countries')) {
  let cur = null;
  for (const line of read(f).split('\n')) {
    const h = line.match(/^#### ((?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}) (\S+)/);
    if (h) { cur = h[1]; countries[cur] = { name: h[2], rel: '' }; continue; }
    const r = line.match(/^- \*\*ความสัมพันธ์:\*\* (.*)/);
    if (r && cur) countries[cur].rel = r[1];
  }
}
// context overlay
const WAR = { สงบ: 0, เฝ้าระวัง: 1, 'ขัดแย้งเป็นพัก ๆ': 2, รบบ่อย: 3, ภาวะสงครามเต็มตัว: 4 };
const JUST = { ศาลเมือง: 'court', สภาตัดสิน: 'council', ผู้เฒ่าตัดสิน: 'elders', ศาลคำสาบาน: 'oath', ศาลดวล: 'duel', 'ศาลบัญชีและหนี้': 'ledger', ศาลศาสนา: 'faith', ศาลทหาร: 'martial', สภามารดา: 'mothers', ศาลสัญญา: 'contract', ศาลกิลด์: 'guild', การทดสอบพิธี: 'ritual', ไม่มีศาล: 'lawless', ไม่มีระบบชัด: 'none' };
const ctx = {};
for (const line of read('appearance/countries/11-context-and-landmarks.md').split('\n')) {
  const c = line.split('|').map((x) => x.trim());
  if (!/^(AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}$/.test(c[1] || '') || c.length < 6) continue;
  const parts = c[3].split(' · ');
  ctx[c[1]] = { war: WAR[parts[0]] ?? 0, justice: JUST[parts[parts.length - 1]] || 'none', landmarks: c[4] || '' };
}
// npcs
const npcs = {};
for (const f of files('lore/npcs'))
  for (const line of read(f).split('\n')) {
    const m = line.match(/^\| ([A-Z]{2}\d{2}-\d) \| \*\*([^*]*)\*\* *(?:\([^)]*\))?([^|]*)\|/);
    if (!m) continue;
    const cc = m[1].replace(/(\d{2})-\d$/, '-$1');
    (npcs[cc] ||= []).push({ id: m[1], name: m[2], role: m[3].trim() });
  }
// countries already named by an event written by hand
const named = new Set();
for (const f of ['systems/events/world-events.md', 'systems/events/branches/01-dragon-falls.md', 'systems/events/branches/02-new-lands.md', 'systems/events/local-events.md'])
  for (const line of read(f).split('\n')) {
    if (!/^\| \*\*[A-Z]+-\d+ /.test(line)) continue;
    // a hand-written local event names only the country in its "ที่" cell; its NPC list and story may mention others in passing
    const scope = f.endsWith('local-events.md') ? line.split('|')[2] : line;
    for (const c of new Set(scope.match(CODE) || [])) named.add(c);
    for (const [c, v] of Object.entries(countries)) if (v.name.length >= 4 && scope.includes(v.name)) named.add(c);
  }

const CONT_EVENT = { AZ: ['WR-01', 'DR-01'], MH: ['WR-19', 'DM-01'], KD: ['WR-05', 'DR-04'], NR: ['WR-06', 'DR-05'], AL: ['WR-16', 'WR-14'], MK: ['WR-09', 'MC-03'], SH: ['WR-24', 'GI-07'], SV: ['WR-04', 'BIO-01'], NB: ['FG-02', 'FG-03'] };
// lead = the first NPC of the country, knower = the second, affected = the third; the fourth NPC and an outsider are listed as bystanders
const TEMPLATES = [
  { id: 'LT-1', name: 'ศึกชายแดน', ok: (c) => c.war >= 2, reads: (c, p) => CONT_EVENT[p][0],
    story: (n, o) => `${n.lead} ต้องตัดสินว่าจะส่งกำลังไปชายแดนหรือไม่ ${n.knower} รู้ว่ากำลังของฝ่ายตรงข้ามมีเท่าใด ${n.affected} เป็นผู้ที่ครอบครัวถูกเกณฑ์${o ? ` ข่าวไปถึง ${o}` : ''}`,
    effect: (e) => `ถ้ารบ น้ำหนัก \`${e}\` ของคู่ประเทศ +5 และไว้ใจต่อผู้ปกครองลดหนึ่งขั้น ถ้าเจรจา ภาวะสงครามของประเทศลดหนึ่งขั้นสิบปี` },
  { id: 'LT-2', name: 'คดีใหญ่', ok: (c) => !['none', 'lawless', 'elders'].includes(c.justice), reads: (c) => ({ faith: 'GD-02', ledger: 'PO-07', contract: 'PO-07', guild: 'PO-07', martial: 'WR-23' }[c.justice] || 'PO-01'),
    story: (n, o) => `คดีใหญ่ของเมืองถูกยกขึ้นพิจารณาต่อหน้าคนทั้งเมือง ${n.lead} เป็นผู้ตัดสินหรือผู้ที่ผลคดีกระทบ ${n.knower} รู้ความจริงที่ไม่มีใครถาม ${n.affected} ต้องรับผลของคำตัดสิน${o ? ` ผลคดีเป็นที่จับตาของ ${o}` : ''}`,
    effect: (e) => `ถ้าตัดสินตามหลักฐาน ไว้ใจของประเทศต่อสถาบันตัดสิน +1 และ \`${e}\` ช้าลง ถ้าตัดสินตามอำนาจ −1 และ \`${e}\` น้ำหนัก +5` },
  { id: 'LT-3', name: 'ปีขาดแคลน', ok: (c, rel) => /ผู้ลี้ภัย|ยากจน|ขาด|หนี้|อดอยาก/.test(rel + c.landmarks), reads: () => 'CT-04',
    story: (n, o) => `ผลผลิตตกทั้งเมือง ${n.lead} ต้องเลือกว่าจะเปิดคลังหรือรักษาราคา ${n.knower} รู้ว่าใครกักของรอราคา ${n.affected} ขาดทั้งกินและทุน${o ? ` พ่อค้าจาก ${o} เริ่มเข้ามาซื้อ` : ''}`,
    effect: (e) => `ถ้าเปิดคลัง ไว้ใจประชาชน +2 ทองประเทศลดครึ่งหนึ่งของคลังปีนั้น ถ้ารักษาราคา ผู้ลี้ภัยออกจากเมือง (เปิด ex.a1) และ \`${e}\` ขยายผล` },
  { id: 'LT-4', name: 'งานใหญ่', ok: (c) => /หอ|วิหาร|สะพาน|เสา|บันได|ประภาคาร|ลาน/.test(c.landmarks), reads: () => 'HP-04',
    story: (n, o) => `ประเทศเตรียมงานก่อสร้างหรือพิธีใหญ่ที่เกิดทุกหลายสิบปี ${n.lead} กำหนดผู้ที่ได้เข้า ${n.knower} รู้ว่างานนี้เสี่ยงอะไร ${n.affected} ขอเป็นลูกมือเพื่อเข้าไปดู${o ? ` แขกจาก ${o} เดินทางมา` : ''}`,
    effect: (e) => `ถ้าสำเร็จ ชื่อเสียงประเทศ +1 และแขกต่างถิ่นเข้า (เปิด xc ตามเผ่าของแขก) ถ้าล้มเหลว ไว้ใจต่อผู้ปกครอง −1 และ \`${e}\` ช้าลง` },
  { id: 'LT-5', name: 'แขกต่างถิ่น', ok: (c, rel) => /ท่า|ตลาด|ด่าน|คลัง|ค้า/.test(c.landmarks + rel), reads: () => 'HP-02',
    story: (n, o) => `กองแขกต่างเผ่าเดินทางมาถึงด่านและตลาด ${n.lead} ตัดสินว่าจะให้เข้าเมืองหรือไม่ ${n.knower} รู้ว่าแขกกลุ่มนี้พาอะไรมา ${n.affected} ได้ของแปลกจากแขก${o ? ` แขกส่วนหนึ่งมาจาก ${o}` : ''}`,
    effect: (e) => `ถ้าให้เข้า เปิดโหนด xc ของเผ่าแขก และ \`${e}\` น้ำหนัก +3 ถ้าไม่ให้เข้า ท่าทีของประเทศต่อเผ่านั้น −1 หนึ่งทศวรรษ` },
  { id: 'LT-6', name: 'ข่าวร้าย', ok: () => true, reads: (c, p) => CONT_EVENT[p][1],
    story: (n, o) => `ข่าวของเหตุการณ์ใหญ่ในทวีปมาถึงเมือง ${n.lead} ต้องบอกประชาชน ${n.knower} รู้รายละเอียดที่ผู้อื่นไม่รู้ ${n.affected} มีญาติอยู่ในที่ที่ได้รับผล${o ? ` ผู้ส่งข่าวมาจาก ${o}` : ''}`,
    effect: (e) => `คนหนึ่งในสามกลุ่มย้ายถิ่นหรือเปลี่ยนเส้น เปิดผู้ลี้ภัยหรือผู้เดินทาง (ex.a1 หรือ tr.a1) และตัวละครที่อยู่ในประเทศได้ข่าว \`${e}\` ก่อนผู้อื่นหนึ่งฤดู` },
];

const short = (r) => (r.length > 26 ? r.slice(0, 26).trim() : r);
const rows = [];
const all = Object.keys(countries);
const codes = Object.keys(countries).filter((c) => !named.has(c));
codes.forEach((code, idx) => {
  const c = ctx[code] || { war: 0, justice: 'none', landmarks: '' };
  const ns = npcs[code] || [];
  if (ns.length < 3) return;
  const rel = countries[code].rel;
  const ok = TEMPLATES.map((t, i) => [t, i]).filter(([t, i]) => i < 5 && t.ok(c, rel));
  const list = ok.length ? ok : [[TEMPLATES[5], 5]];
  const start = (Number(code.slice(3)) + idx) % 5;
  const [t] = list.find(([, i]) => i >= start) || list[0];
  const label = (x) => `${x.name} (${x.id}${x.role ? ' ' + short(x.role) : ''})`;
  const nm = { lead: label(ns[0]), knower: label(ns[1]), affected: label(ns[2]) };
  const other = [...new Set((rel.match(CODE) || []).filter((x) => x !== code && npcs[x]))][0];
  const outsider = other ? npcs[other][0] : null;
  const outsiderText = outsider ? `${countries[other].name} (${outsider.id} ${outsider.name})` : '';
  const ev = t.reads(c, code.slice(0, 2));
  const people = [...ns, ...(outsider ? [outsider] : [])].map((x) => `${x.id} ${x.name}`).join(' · ');
  rows.push(`| **LC-${100 + all.indexOf(code) + 1} ${t.name}** (${t.id}) | ${code} ${countries[code].name} | \`${ev}\` | ${people} | ${t.story(nm, outsiderText)} | ${t.effect(ev)} | 8% |`);
});

const out = [];
out.push('# เหตุการณ์ท้องถิ่นรายประเทศ (สร้างอัตโนมัติ)', '');
out.push('สร้างด้วย `node scripts/docs/build-local-events.mjs` ห้ามแก้ด้วยมือ ถ้าต้องการเปลี่ยนเหตุการณ์ของประเทศใด ให้เขียนแถวมือ (`LC-` สองหลัก) ใน [../systems/events/local-events.md](../systems/events/local-events.md) ที่ระบุประเทศนั้น แถวที่สร้างของประเทศนั้นจะหายไปเอง', '');
out.push(`ทุกแถวมาจากแม่แบบ LT-1 ถึง LT-6 ในไฟล์นั้น เลือกแม่แบบจากบริบทของประเทศ ([../appearance/countries/11-context-and-landmarks.md](../appearance/countries/11-context-and-landmarks.md)) แล้วใส่ NPC ของประเทศตามบทบาท และ NPC ตัวที่ 1 ของประเทศที่เกี่ยวข้องในช่อง ความสัมพันธ์ เพื่อให้เกิดจุดบรรจบข้ามประเทศ จำนวน ${rows.length} รายการ โอกาสทุกแถว 8% ต่อทศวรรษ ปรับเมื่อทดสอบ`, '');
out.push('| ID · ชื่อ | ที่ | ขึ้นกับ | NPC ที่บรรจบ | เกิดอะไรขึ้น | ผลถาวร → ลูกโซ่ | โอกาสต่อทศวรรษ |', '| --- | --- | --- | --- | --- | --- | --- |', ...rows, '');
fs.writeFileSync(path.join(docs, '_generated/local-events-by-country.md'), out.join('\n'));
const byT = rows.reduce((a, r) => { const t = r.match(/\((LT-\d)\)/)[1]; a[t] = (a[t] || 0) + 1; return a; }, {});
console.log(`local events: ${rows.length} generated · skipped ${codes.length - rows.length} · by template ${JSON.stringify(byT)}`);
