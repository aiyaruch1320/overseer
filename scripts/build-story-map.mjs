// Builds docs/story-map.html from the lore docs.
// Run: node scripts/build-story-map.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const curated = JSON.parse(read('scripts/story-map.curated.json'));

// ---------- parse event tables ----------
function parseEvents(md, source) {
  const lines = md.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('| ID · ชื่อ')) continue;
    const header = lines[i].slice(2, -2).split(' | ');
    const isWar = header[1].includes('คู่');
    for (let j = i + 2; j < lines.length && lines[j].startsWith('| **'); j++) {
      const cells = lines[j].slice(2, lines[j].lastIndexOf(' |')).split(' | ');
      const m = cells[0].match(/^\*\*([A-Z]{2,3}-\d{2})\s*([⭐●○])?\s*(.*?)\*\*\s*(.*)$/);
      if (!m) continue;
      const [, id, mark, title, extra] = m;
      const ev = { id, mark: mark || '', title, extra: extra.replace(/^\(|\)$/g, ''), source };
      if (isWar) { ev.cond = `${cells[1] || ''}${cells[2] ? ' · ยุค ' + cells[2] : ''}`; ev.what = cells[3] || ''; ev.result = ''; }
      else { ev.cond = cells[1] || ''; ev.what = cells[2] || ''; ev.result = cells[3] || ''; }
      out.push(ev);
    }
  }
  return out;
}
const events = [
  ...parseEvents(read('docs/world-events.md'), 'world-events'),
  ...parseEvents(read('docs/branches/02-new-lands.md'), 'new-lands'),
];
const ids = new Set(events.map((e) => e.id));

// ---------- lanes ----------
const LANES = curated.lanes.slice(0, 9);
LANES.push({ id: 9, name: 'ความหวัง ยุค และปลายทางของโลก', color: '#7d4f3a' });
LANES.push({ id: 10, name: 'ภัยระดับโลก', color: '#8c8c3a' });
const LANE_BY_PREFIX = { DR: 0, PL: 0, WR: 4, CT: 10, DM: 1, MC: 5, BIO: 6, GD: 8, HP: 9, PO: 4, GI: 2, END: 9, FG: 7, SF: 0, AS: 2, DW: 3, RF: 4, WT: 6, RL: 5, CL: 7, DV: 7 };
const LANE_OVERRIDE = {
  'DR-04': 2, 'DR-05': 3, 'DR-06': 3, 'DR-07': 4, 'DR-11': 8, 'DR-13': 8, 'DR-14': 0, 'DR-15': 9,
  'PL-02': 1, 'PL-03': 2, 'PL-04': 3, 'PL-05': 4, 'PL-06': 5, 'PL-07': 2, 'PL-08': 6, 'PL-09': 7,
  'WR-01': 0, 'WR-02': 2, 'WR-03': 1, 'WR-04': 6, 'WR-05': 1, 'WR-06': 3, 'WR-07': 3, 'WR-08': 7, 'WR-09': 7,
  'WR-10': 2, 'WR-11': 2, 'WR-12': 5, 'WR-13': 4, 'WR-14': 4, 'WR-15': 9, 'WR-16': 4, 'WR-17': 6, 'WR-18': 0,
  'WR-19': 1, 'WR-20': 3, 'WR-21': 5, 'WR-22': 0, 'WR-23': 9, 'WR-24': 2,
  'BIO-04': 7, 'BIO-05': 7, 'BIO-06': 7, 'BIO-07': 3, 'BIO-08': 3, 'DM-09': 7,
  'END-01': 0, 'END-02': 1, 'END-03': 2, 'END-04': 3, 'END-05': 4, 'END-06': 5, 'END-07': 2, 'END-08': 6, 'END-09': 7,
};
function eraHint(e) {
  const m = e.cond.match(/ยุค\s*(?:≥\s*)?(\d)/);
  if (m) return Math.min(5, +m[1]);
  if (/ทุกยุค/.test(e.cond)) return 1;
  const n = +e.id.split('-')[1];
  if (e.id.startsWith('END')) return n >= 10 ? 5 : 3;
  if (e.id === 'MC-12') return 4;
  if (e.source === 'new-lands') return 3;
  return 1;
}
const nodes = events.map((e) => ({
  id: e.id, title: e.title, mark: e.mark, extra: e.extra, cond: e.cond, what: e.what, result: e.result,
  lane: LANE_OVERRIDE[e.id] ?? LANE_BY_PREFIX[e.id.split('-')[0]] ?? 9, hint: eraHint(e), group: e.id.split('-')[0], source: e.source,
}));
// virtual nodes
nodes.push(
  { id: 'START', title: 'จุดเริ่มต้นของโลก', mark: '', extra: '', cond: 'โลกเดินด้วยตัวเอง ตัวละครหลักเกิดและใช้ชีวิตอยู่ในโลกนี้', what: 'ศ.ม. 10,400 · DFC = 0 · ยุค 1 · รอยแยกเมฆาเปิดแล้ว · สงครามฟอร์เทียและสงครามธุลีทิพย์กำลังดำเนิน · ผนึกมังกรยังไม่สั่น', result: 'เรื่องทุกเส้นเริ่มจากที่นี่', lane: 4, hint: 1, group: 'VIRT', source: 'virtual' },
  { id: 'ERA', title: 'ยุคเลื่อน (DFC สะสม)', mark: '', extra: '', cond: 'DFC เพิ่มตามจำนวนมังกรที่ล้ม', what: 'ยุค 1 ผนึก (0–2) · ยุค 2 ร้าว (3–5) · ยุค 3 สั่น (6–9) · ยุค 4 ปลาย (10–14) · ยุค 5 ไร้มังกร (15)', result: 'เปิดเหตุการณ์ใหญ่ตามยุค · กำหนดตอนจบ', lane: 9, hint: 4, group: 'VIRT', source: 'virtual' },
  { id: 'PLX', title: 'คู่สนิทขาดสติ', mark: '', extra: '', cond: 'มังกรคู่สนิทของผู้ล้มเลือก: คลั่ง สละตัว หรือหลับลึก', what: 'โอรัน-ซัล↔ฮรอด-กาธ · เพลิง↔สมุทร · พายุ↔อีริดาน · ศิลา↔กรอม-ธาร · คัลดรา↔ธาลาสซา · อันดาร์↔เซเรเน · ซิลเวรา↔นิเวรี', result: 'เปิดเหตุการณ์ PL หรือ END ของคู่สนิทนั้น', lane: 9, hint: 3, group: 'VIRT', source: 'virtual' },
);
ids.add('START'); ids.add('ERA'); ids.add('PLX');

// ---------- edges ----------
const COMPOSITE = {
  SF: ['SF-01', 'SF-10'], AS: ['AS-01', 'AS-05'], DW: ['DW-01', 'DW-05'], RF: ['RF-01', 'RF-05'],
  WT: ['WT-01', 'WT-05'], RL: ['RL-01', 'RL-04'], CL: ['CL-01', 'CL-04'], DV: ['DV-01', 'END-09'],
};
function mapId(raw, role) {
  if (['START', 'ERA', 'PLX'].includes(raw)) return raw;
  if (COMPOSITE[raw]) return COMPOSITE[raw][role === 'to' ? 0 : 1];
  const m = raw.match(/^([A-Z]{2,3})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}` : raw;
}
const edges = [];
const seen = new Set();
const key = (a, b) => `${a}>${b}`;
for (const e of curated.edges) {
  const from = mapId(e.from, 'from'), to = mapId(e.to, 'to');
  if (!ids.has(from) || !ids.has(to)) throw new Error(`curated edge references missing node: ${e.from}→${e.to} (${from}→${to})`);
  if (seen.has(key(from, to))) continue;
  seen.add(key(from, to));
  edges.push({ from, to, kind: e.kind, label: e.label, bias: e.bias, derived: false });
}
const idRe = /\b([A-Z]{2,3}-\d{2})\b/g;
for (const n of events) {
  for (const m of n.result.matchAll(idRe)) {
    const to = m[1];
    if (to === n.id || !ids.has(to) || seen.has(key(n.id, to))) continue;
    seen.add(key(n.id, to));
    edges.push({ from: n.id, to, kind: 'f', label: 'ผลที่ระบุไว้ในรายการ', bias: null, derived: true });
  }
  const outcomeText = n.id.startsWith('WR') ? n.what : '';
  for (const m of outcomeText.matchAll(idRe)) {
    const to = m[1];
    if (to === n.id || !ids.has(to) || seen.has(key(n.id, to))) continue;
    seen.add(key(n.id, to));
    edges.push({ from: n.id, to, kind: 'f', label: 'ผลลัพธ์ของสงคราม', bias: null, derived: true });
  }
  for (const m of n.cond.matchAll(idRe)) {
    const from = m[1];
    if (from === n.id || !ids.has(from) || seen.has(key(from, n.id))) continue;
    seen.add(key(from, n.id));
    edges.push({ from, to: n.id, kind: 'f', label: 'เงื่อนไขอ้างถึง', bias: null, derived: true });
  }
}
edges.forEach((e, i) => (e.i = i));

// ---------- presets ----------
const range = (p, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `${p}-${String(a + i).padStart(2, '0')}`);
const PRESETS = [
  { id: 'sky', name: 'ฟ้าถล่มและสกายฟอลล์', desc: 'มังกรปฐม ไข่ฟ้า สงครามท้องฟ้า ทวีปมังกรหาย', seeds: ['DR-03', 'DR-02', 'WR-01', 'DR-01'], f: 3, b: 1 },
  { id: 'siblings', name: 'พี่น้องมังกรและคลื่นไว้อาลัย', desc: 'ทุกครั้งที่มังกรล้ม ทุกทวีปรู้สึก', seeds: ['DR-15', 'DR-09', 'DR-10', 'DR-14'], f: 2, b: 1 },
  { id: 'war', name: 'ความหิวและจอมมาร', desc: 'สงครามอาหาร ผู้กล้า ฮรอด-กาธ ข้าวเถ้า', seeds: ['WR-03', 'DM-01', 'PL-02', 'HP-07'], f: 3, b: 1 },
  { id: 'fire', name: 'ไฟ เถ้า และปากเหว', desc: 'คัลดรา ฤดูหนาวเถ้า ปากเหวนรก', seeds: ['PL-03', 'DR-04', 'GI-04', 'WR-05', 'WR-13'], f: 3, b: 1 },
  { id: 'sea', name: 'น้ำขึ้นและทะเล', desc: 'มหาน้ำขึ้น ธาลาสซา เงือกกับนาคา', seeds: ['DR-05', 'PL-04', 'BIO-08', 'WR-07', 'WR-20'], f: 3, b: 1 },
  { id: 'plains', name: 'ทุ่งราบ สภา และสงครามฟอร์เทีย', desc: 'สงครามรวมทุ่งราบ สภาเก้าทวีป แผ่นดินแยก', seeds: ['WR-16', 'PO-01', 'PO-05', 'PO-08', 'DR-07'], f: 3, b: 1 },
  { id: 'mecha', name: 'จักรกลและเครื่องจักรปฐม', desc: 'ตุ๊กตา หุ่นลุกฮือ เซเรเน ซากอาร์เคีย', seeds: ['MC-02', 'PL-06', 'MC-04', 'MC-05', 'END-06'], f: 3, b: 1 },
  { id: 'forest', name: 'ต้นไม้โลกและป่า', desc: 'ต้นไม้ป่วย กล้า สงครามน้ำเลี้ยง ป่าเหี่ยว', seeds: ['BIO-01', 'BIO-03', 'WR-04', 'WR-17', 'BIO-02'], f: 3, b: 1 },
  { id: 'fog', name: 'หมอกกินคน', desc: 'ภารกิจเมฆา หมอกทึบ ปิดรอยแยกหรือหมอกกินทวีป', seeds: ['FG-01'], f: 4, b: 0 },
  { id: 'stone', name: 'ยักษ์ ภูเขา และทะเลทราย', desc: 'บันไดหมื่นขั้น ไททัน สงครามธุลีทิพย์', seeds: ['WR-02', 'GI-01', 'GI-02', 'WR-24', 'PL-07'], f: 3, b: 1 },
  { id: 'faith', name: 'ศรัทธา พระเจ้า และผู้ปลดผนึก', desc: 'พิธีสังเวย ผู้ไม่ก้มหัว ปาฏิหาริย์ ความเงียบ', seeds: [...range('GD', 1, 8), 'DR-11', 'DR-13'], f: 2, b: 1 },
  { id: 'world', name: 'ภัยระดับโลก', desc: 'ดาวหาง โรคระบาด ภัยแล้ง สุริยคราสร้อยปี', seeds: range('CT', 1, 10), f: 2, b: 1 },
  { id: 'hope', name: 'ความหวังและสันติภาพ', desc: 'สนธิสัญญา เกาะลอยฟ้าใหม่ ข้าวเถ้า', seeds: range('HP', 1, 8), f: 2, b: 1 },
  { id: 'ends', name: 'ตอนจบของโลก', desc: 'ย้อนจากสามตอนจบไปหาต้นเหตุ', seeds: ['END-10', 'END-11', 'END-12'], f: 0, b: 3 },
];
for (const p of PRESETS) for (const s of p.seeds) if (!ids.has(s)) throw new Error(`preset ${p.id} missing seed ${s}`);

const data = { lanes: LANES, actions: curated.actions, presets: PRESETS, nodes, edges };
const tpl = read('scripts/story-map.template.html');
fs.writeFileSync(path.join(root, 'docs/story-map.html'), tpl.replace('/*__DATA__*/null', JSON.stringify(data)));
console.log(`nodes ${nodes.length} (events ${events.length}) · edges ${edges.length} (curated ${edges.filter((e) => !e.derived).length}, derived ${edges.filter((e) => e.derived).length}) · presets ${PRESETS.length}`);
