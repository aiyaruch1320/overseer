// Walks storyline tables by their written weights to estimate what one life meets (doc-level, no game code).
// Reads docs/lore/storylines and docs/lore/npcs. Prints a table; writes nothing.
// Run: node scripts/sim/sim-life.mjs [lives-per-race=1500] [--sample=hu|or|...] [--seed=7] [--no-overlay]
import fs from 'node:fs';
import path from 'node:path';
import { docs } from '../lib/paths.mjs';

const args = process.argv.slice(2);
const N = Number(args.find((a) => /^\d+$/.test(a)) || 1500);
const sample = (args.find((a) => a.startsWith('--sample=')) || '').slice(9);
const seed = Number((args.find((a) => a.startsWith('--seed=')) || '--seed=7').slice(7));
const useOverlay = !args.includes('--no-overlay');

let st = seed >>> 0;
const rnd = () => { st = (st + 0x6d2b79f5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const RACES = [
  ['hu', 'มนุษย์', '01-human.md'], ['el', 'เอลฟ์', '02-elf.md'], ['de', 'ดาร์กเอลฟ์', '03-darkelf.md'], ['dw', 'คนแคระ', '04-dwarf.md'], ['or', 'ออร์ค', '05-orc.md'],
  ['ha', 'ฮาล์ฟลิง', '06-halfling.md'], ['be', 'เผ่าสัตว์', '07-beast.md'], ['na', 'นาคา', '08-naga.md'], ['dk', 'เผ่ามังกร', '09-dragonkin.md'], ['va', 'แวมไพร์', '10-vampire.md'],
  ['fa', 'ภูตพราย', '11-fae.md'], ['sl', 'สไลม์', '12-slime.md'], ['dm', 'เผ่าปีศาจ', '13-demonkin.md'], ['me', 'เงือก', '14-merfolk.md'], ['wi', 'เผ่าปีก', '15-winged.md'],
  ['gi', 'ยักษ์', '16-giant.md'], ['la', 'เผ่าลาวา', '17-lavakin.md'], ['co', 'ลูกผสมจักรกล', '18-construct.md'], ['so', 'หุ่นวิญญาณ', '19-soulmachine.md'], ['mu', 'มัมมี่', '20-mummy.md'], ['gh', 'กูล', '21-ghoul.md'],
];
const PREFIX = [['ดาร์กเอลฟ์', 'de'], ['เอลฟ์ใต้ดิน', 'de'], ['เอลฟ์', 'el'], ['คนแคระ', 'dw'], ['ฮาล์ฟลิง', 'ha'], ['เผ่าปีศาจ', 'dm'], ['ออร์ค', 'or'], ['โอเกอร์', 'or'], ['ยักษ์', 'gi'], ['ลูกผสมจักรกล', 'co'], ['เผ่าลาวา', 'la'], ['กูล', 'gh'], ['เผ่าสัตว์', 'be'], ['เผ่าเสือ', 'be'], ['เผ่าหมี', 'be'], ['เผ่าหมาป่า', 'be'], ['เผ่ามังกร', 'dk'], ['อาเวียน', 'wi'], ['ปีก', 'wi'], ['เผ่านก', 'wi'], ['แวมไพร์', 'va'], ['นาคา', 'na'], ['สไลม์', 'sl'], ['มัมมี่', 'mu'], ['หุ่น', 'so'], ['ภูต', 'fa'], ['เงือก', 'me'], ['ไซเรน', 'me'], ['มนุษย์', 'hu']];
const raceOfLabel = (l) => (PREFIX.find(([p]) => l.startsWith(p)) || [, 'other'])[1];
const CV_OPEN = { 4: 1, 10: 1, 12: 1, 13: 1, 8: 0.95, 1: 0.95, 16: 0.95, 2: 0.8, 15: 0.8, 6: 0.72, 14: 0.72, 5: 0.72, 7: 0.63, 9: 0.52, 11: 0.48, 3: 0.12 };
// share of lives that open each overlay (from systems/travel/01-travel-rules.md section 2 and 25-journeys.md section 3)
const OVERLAY_RATE = { sf: 0.08, ps: 0.06, ml: 0.08, sc: 0.08, ex: 0.10, wd: 0.08, tr: 0.15, cr: 0.12, md: 0.06, ld: 0.06, fm: 0.30 };
const XC_RATE = 0.45;

const read = (f) => fs.readFileSync(path.join(docs, f), 'utf8');
const npcRace = {};
for (const f of fs.readdirSync(path.join(docs, 'lore/npcs')).filter((n) => /^\d\d-.*\.md$/.test(n)))
  for (const line of read(`lore/npcs/${f}`).split('\n')) {
    const m = line.match(/^\| ([A-Z]{2}\d{2}-\d) \| \*\*[^*]*\*\* *\(([^·)]*)/);
    if (m) npcRace[m[1]] = raceOfLabel(m[2].trim());
  }

const parseNodes = (file, prefixRe) => {
  const out = [];
  for (const line of read(file).split('\n')) {
    const m = line.match(new RegExp(`^\\| (${prefixRe}\\.[btael]\\d) \\|`));
    if (!m) continue;
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length < 4) continue;
    const branches = c.slice(3, 6).map((x) => x.match(/^(\d+) (.*)$/)).filter(Boolean).map((x) => ({ w: Number(x[1]), text: x[2] }));
    const cvOnly = c[3] && /^→ cv\.\d+/.test(c[3]);
    out.push({ id: m[1], age: Number((c[1].match(/^\d+/) || [0])[0]), event: c[2], branches, cvOnly: cvOnly ? c[3] : null, note: c[6] || '' });
  }
  return out;
};
const main = Object.fromEntries(RACES.map(([code, , file]) => [code, parseNodes(`lore/storylines/${file}`, code)]));
const overlays = {};
for (const p of ['sf', 'ps', 'ml', 'sc', 'ex', 'wd']) overlays[p] = parseNodes('lore/storylines/25-journeys.md', p);
for (const p of ['cr', 'md', 'ld', 'fm']) overlays[p] = parseNodes('lore/storylines/26-hearth.md', p);
overlays.tr = parseNodes('lore/storylines/24-economy.md', 'tr');
const xcByName = Object.fromEntries(RACES.map(([code, name]) => [code, parseNodes('lore/storylines/25-journeys.md', 'xc').filter((n) => n.event.startsWith(name))]));

const pick = (branches) => {
  const total = branches.reduce((s, b) => s + b.w, 0);
  let r = rnd() * total;
  for (const b of branches) { r -= b.w; if (r <= 0) return b; }
  return branches[branches.length - 1];
};

// Sample mode applies an overlay only when the life so far fits it (coarse text match); statistics mode keeps the plain rates.
const GATE = { sf: /sailor|ship|pirate|เรือ|ท่าเรือ|ทะเล/, ps: /pilgrim|priest|monk|devout|ศรัทธา|แสวงบุญ|นักบวช/, ml: /soldier|mercenary|knight|ทหาร|รับจ้าง/, sc: /scholar|scribe|librarian|teacher|mage|หอสมุด|เรียน|นักปราชญ์/, ex: /(WR|FG|DR|BIO|CT|MC)-\d+|ลี้ภัย|หนีออก|เนรเทศ|c_wanted/, wd: /bard|explorer|adventurer|performer|เร่|ผจญภัย|สำรวจ/, tr: /merchant|trade|peddler|พ่อค้า|ค้า/, cr: /smith|carpenter|weaver|potter|ช่าง/, md: /healer|apothecary|physician|midwife|หมอ|รักษา/, ld: /mayor|noble|tax_collector|ผู้นำ|นายก|ผู้ปกครอง/, fm: /farmer|shepherd|miller|fisher|ชาวนา|ชาวไร่|ฟาร์ม/ };
function lifeOf(code, log) {
  let pathText = '';
  const fallback = main[code].filter((n) => n.id.includes('.l'));
  const seen = { nodes: 0, cv: new Set(), events: new Set(), npcs: new Set(), other: new Set(), countries: new Set(), conts: new Set() };
  const visit = (node) => {
    seen.nodes++;
    let chosen = null;
    if (node.cvOnly) {
      const m = node.cvOnly.match(/cv\.(\d+)/);
      if (m && rnd() < (CV_OPEN[m[1]] ?? 0.5)) { seen.cv.add(`cv.${m[1]}`); log?.push(`${node.id} ${node.event} ${node.cvOnly}`); }
      else if (fallback.length) { log?.push(`${node.id} ปิด → ใช้โหนดสำรอง`); visit(fallback.shift()); }
      else log?.push(`${node.id} ${node.event} → จุดบรรจบไม่เปิด ช่วงนี้ว่าง`);
    } else if (node.branches.length) {
      chosen = pick(node.branches);
      pathText += ' ' + chosen.text;
      const cv = chosen.text.match(/→ cv\.(\d+)/);
      if (cv && rnd() < (CV_OPEN[cv[1]] ?? 0.5)) seen.cv.add(`cv.${cv[1]}`);
      log?.push(`${node.id} ${node.event}: ${chosen.text.slice(0, 120)}`);
    }
    const text = `${chosen ? chosen.text : ''} ${rnd() < 0.5 ? node.note : ''}`;
    for (const [, e] of text.matchAll(/\b((?:DR|PL|WR|CT|DM|MC|BIO|GD|HP|PO|GI|FG|END)-\d{2})\b/g)) seen.events.add(e);
    for (const [, id] of text.matchAll(/\b([A-Z]{2}\d{2}-\d)\b/g)) { seen.npcs.add(id); if (npcRace[id] && npcRace[id] !== code) seen.other.add(id); }
    for (const [, c] of text.matchAll(/\b((AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2})\b/g)) { seen.countries.add(c); seen.conts.add(c.slice(0, 2)); }
  };
  for (const n of main[code].filter((x) => !x.id.includes('.l'))) visit(n);
  if (useOverlay) {
    for (const [p, rate] of Object.entries(OVERLAY_RATE)) if (rnd() < rate && (!log || GATE[p].test(pathText))) { log?.push(`-- เส้นซ้อนทับ ${p}`); for (const n of overlays[p]) visit(n); }
    if (code !== 'hu' && rnd() < XC_RATE) { log?.push('-- เส้นเจอต่างเผ่า xc'); for (const n of xcByName[code]) visit(n); }
  }
  return seen;
}

if (sample) {
  const log = [];
  const s = lifeOf(sample, log);
  console.log(log.join('\n'));
  console.log(`\nสรุป: โหนด ${s.nodes} · จุดบรรจบ ${[...s.cv].join(' ') || '-'} · เหตุการณ์โลก ${s.events.size} (${[...s.events].join(' ')}) · NPC ${s.npcs.size} ต่างเผ่า ${s.other.size} · ประเทศ ${s.countries.size} ทวีป ${s.conts.size}`);
  process.exit(0);
}

const rows = RACES.map(([code, name]) => {
  const acc = { nodes: 0, cv: 0, events: 0, npcs: 0, other: 0, countries: 0, conts: 0, noCv: 0, noOther: 0 };
  for (let i = 0; i < N; i++) {
    const s = lifeOf(code);
    acc.nodes += s.nodes; acc.cv += s.cv.size; acc.events += s.events.size; acc.npcs += s.npcs.size; acc.other += s.other.size; acc.countries += s.countries.size; acc.conts += s.conts.size;
    if (!s.cv.size) acc.noCv++;
    if (!s.other.size) acc.noOther++;
  }
  const f = (v) => (v / N).toFixed(1);
  return [name, f(acc.nodes), f(acc.cv), `${((acc.noCv / N) * 100).toFixed(0)}%`, f(acc.events), f(acc.npcs), f(acc.other), `${((acc.noOther / N) * 100).toFixed(0)}%`, f(acc.countries), f(acc.conts)];
});
// Convergence counts are left out on purpose: this walker ignores node conditions and event timing, so use sim-world.mjs --cv for them.
console.log(['เผ่า', 'โหนด', 'เหตุการณ์โลกที่กล่าวถึง', 'NPC ที่เจอ', 'NPC ต่างเผ่า', 'ไม่เจอต่างเผ่าเลย', 'ประเทศที่กล่าวถึง', 'ทวีป'].join(' | '));
for (const r of rows) console.log([r[0], r[1], r[4], r[5], r[6], r[7], r[8], r[9]].join(' | '));
console.log(`\nlives per people ${N} · overlays ${useOverlay ? 'on' : 'off'} · seed ${seed}`);
