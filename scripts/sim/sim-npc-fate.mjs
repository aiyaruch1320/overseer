// Checks the NPC fate table of docs/systems/events/branches/04-last-era.md against the roster and the lifespans.
// Usage: node scripts/sim/sim-npc-fate.mjs [--md] [--old]
import fs from 'fs';
import path from 'path';
import { root } from '../lib/paths.mjs';

const docs = path.join(root, 'docs');
const read = (p) => fs.readFileSync(path.join(docs, p), 'utf8');
const md = process.argv.includes('--md');

// ---- inputs the doc defines ----
const ERA4_START = 830; // median world year (from 10,400) at which DFC reaches 10, world-time.md section 4
const END = 870; // median end of the world
const PHASE_YEARS = [15, 15, 10]; // 4a, 4b, 4c lengths used for natural mortality
const REVISED = !process.argv.includes('--old'); // the adjusted table is the one in the doc; --old prints the first draft
const TABLE = REVISED ? {
  keeper: [[50, 20, 15, 15], [35, 20, 25, 20], [40, 10, 35, 15]],
  leader: [[85, 5, 5, 5], [70, 10, 15, 5], [65, 5, 25, 5]],
  other: [[80, 10, 5, 5], [65, 20, 10, 5], [70, 10, 15, 5]],
} : {
  keeper: [[40, 20, 15, 25], [25, 15, 30, 30], [35, 5, 40, 20]],
  leader: [[85, 5, 5, 5], [70, 10, 15, 5], [65, 5, 25, 5]],
  other: [[80, 10, 5, 5], [65, 20, 10, 5], [70, 10, 15, 5]],
}; // stay, moved, dead, vanished per phase

// ---- races and lifespans (same source as sim-world.mjs) ----
const CODES = ['hu', 'el', 'de', 'dw', 'or', 'ha', 'be', 'na', 'dk', 'va', 'fa', 'sl', 'dm', 'me', 'wi', 'gi', 'la', 'co', 'so', 'mu', 'gh'];
const life = {};
const names = {};
for (const l of read('systems/character/races/README.md').split('\n')) {
  const c = l.split('|').map((x) => x.trim());
  if (c.length > 10 && /^\d+$/.test(c[1]) && /–/.test(c[9])) {
    const [lo, hi] = c[9].replace(/,/g, '').split('–').map(Number);
    life[CODES[+c[1] - 1]] = [lo, hi];
    names[CODES[+c[1] - 1]] = c[2];
  }
}
const PREFIX = [['ดาร์กเอลฟ์', 'de'], ['เอลฟ์ใต้ดิน', 'de'], ['เอลฟ์', 'el'], ['ดรูอิด', 'el'], ['คนแคระ', 'dw'], ['ฮาล์ฟลิง', 'ha'], ['เผ่าปีศาจ', 'dm'], ['ออร์ค', 'or'], ['โอเกอร์', 'or'], ['ยักษ์', 'gi'], ['ลูกผสมจักรกล', 'co'], ['เผ่าลาวา', 'la'], ['กูล', 'gh'], ['เผ่าสัตว์', 'be'], ['เผ่าเสือ', 'be'], ['เผ่าหมี', 'be'], ['เผ่าหมาป่า', 'be'], ['เผ่ามังกร', 'dk'], ['อาเวียน', 'wi'], ['ปีก', 'wi'], ['เผ่านก', 'wi'], ['แวมไพร์', 'va'], ['นาคา', 'na'], ['สไลม์', 'sl'], ['มัมมี่', 'mu'], ['หุ่น', 'so'], ['ภูต', 'fa'], ['เงือก', 'me'], ['ไซเรน', 'me'], ['มนุษย์', 'hu'], ['ฮาล์ฟออร์ค', 'or'], ['ตุ๊กตา', 'co'], ['ลูกหลานปีก', 'wi'], ['ชาวหิน', 'gi'], ['กัปปะ', 'me'], ['สัตว์ทะเล', 'me'], ['เผ่า', 'be'], ['หมาป่า', 'be'], ['ปีศาจ', 'dm']];
const raceOf = (label) => (PREFIX.find(([p]) => label.startsWith(p)) || [, 'hu'])[1];

// ---- roster ----
const npcs = [];
let guessed = 0;
for (const f of fs.readdirSync(path.join(docs, 'lore/npcs')).filter((n) => /^\d\d-.*\.md$/.test(n))) {
  for (const line of read(`lore/npcs/${f}`).split('\n')) {
    const m = line.match(/^\| ([A-Z]{2}\d{2}-\d) \| \*\*[^*]*\*\* *\(([^·)]*)·? *(?:ตายมา )?(\d+)?[^)]*\)/);
    if (!m) continue;
    const label = m[2].trim();
    if (!PREFIX.some(([p]) => label.startsWith(p))) guessed++;
    npcs.push({ id: m[1], race: raceOf(label), age: Number(m[3] || 30), leader: m[1].endsWith('-1') });
  }
}

// ---- rng ----
let seed = 11;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const lifeOf = (race, age) => { const [lo, hi] = life[race]; const l = lo + rnd() * (hi - lo); return Math.max(l, age + 1 + rnd() * 5); }; // roster ages are alive now, so the draw is at least the current age

// ---- A: how many roster individuals are still the holder at a random start year ----
const N = 400;
const startAlive = {};
const era4Alive = {};
const adultOf = { hu: 20 };
for (const n of npcs) {
  const a = (startAlive[n.race] ||= { sum: 0, n: 0 });
  const b = (era4Alive[n.race] ||= { sum: 0, n: 0 });
  for (let i = 0; i < N; i++) {
    const L = lifeOf(n.race, n.age);
    const s = rnd() * (END - 20); // start year is uniform over the timeline, world-time.md 8.1
    if (n.age + s < L) a.sum++;
    a.n++;
    if (n.age + ERA4_START < L) b.sum++;
    b.n++;
  }
}

// ---- B: the table alone, three phases in a row ----
const cum = {};
for (const [cls, rows] of Object.entries(TABLE)) {
  let stay = 1, moved = 0, dead = 0, vanished = 0, at4c = 1;
  for (const [i, [s, mv, d, v]] of rows.entries()) {
    if (i === 2) at4c = stay + moved;
    const alive = stay + moved;
    const nd = alive * d / 100, nv = alive * v / 100, nm = stay * mv / 100;
    stay = stay * s / 100; moved = moved * (1 - d / 100 - v / 100) + nm; dead += nd; vanished += nv;
  }
  cum[cls] = { stay, moved, dead, vanished, at4c };
}

// ---- C: natural death in the 40 years of era 4 for a holder of typical adult age ----
const natural = {};
for (const code of CODES) {
  const [lo, hi] = life[code];
  let dead = 0;
  const M = 4000;
  for (let i = 0; i < M; i++) {
    const L = lo + rnd() * (hi - lo);
    const age = L * (0.27 + rnd() * 0.6); // uniform between adult (27% of lifespan) and old (87%)
    if (age + PHASE_YEARS.reduce((x, y) => x + y, 0) > L) dead++;
  }
  natural[code] = dead / M;
}

// ---- output ----
const pct = (v) => `${(100 * v).toFixed(0)}%`;
const byRace = CODES.map((c) => {
  const a = startAlive[c], b = era4Alive[c];
  return { c, name: names[c], npc: a ? a.n / N : 0, start: a ? a.sum / a.n : null, era4: b ? b.sum / b.n : null, nat: natural[c] };
});
const lines = [];
lines.push(`roster ${npcs.length} NPC (race guessed for ${guessed}) · era 4 starts ${ERA4_START} · world ends ${END}`, '');
lines.push('| เผ่า | NPC ในรายชื่อ | ตัวเดิมยังเป็นผู้ถือตำแหน่งที่จุดเริ่มสุ่ม | ตัวเดิมยังมีชีวิตเมื่อยุค 4 เริ่ม | ตายตามอายุขัยใน 40 ปีของยุค 4 (ผู้ถือวัยผู้ใหญ่ถึงชรา) |', '| --- | --- | --- | --- | --- |');
for (const r of byRace) lines.push(`| ${r.name} | ${r.npc} | ${r.start === null ? '-' : pct(r.start)} | ${r.era4 === null ? '-' : pct(r.era4)} | ${pct(r.nat)} |`);
lines.push('', `ตารางชะตาอย่างเดียว (สามช่วงต่อกัน เริ่มจากมีชีวิต 100%)${REVISED ? ' [ตารางปรับ]' : ''}`, '| ชั้น | ยังอยู่ก่อนเริ่ม 4ค | อยู่เดิมตอนจบ | ย้ายถิ่น | ตาย | สาบสูญ |', '| --- | --- | --- | --- | --- | --- |');
for (const [k, v] of Object.entries(cum)) lines.push(`| ${k} | ${pct(v.at4c)} | ${pct(v.stay)} | ${pct(v.moved)} | ${pct(v.dead)} | ${pct(v.vanished)} |`);
lines.push('', 'ผู้ถือตำแหน่งชั้น "NPC อื่น" รวมตายตามอายุขัยกับตารางชะตา (ตายตามอายุขัยทอยก่อน ตารางชะตาทอยกับที่เหลือ)', '| เผ่า | ตายรวมก่อนจบ | ยังมีชีวิต (อยู่เดิมหรือย้ายถิ่น) |', '| --- | --- | --- |');
for (const r of byRace) { const alive = (1 - r.nat) * (cum.other.stay + cum.other.moved); lines.push(`| ${r.name} | ${pct(1 - (1 - r.nat) * (1 - cum.other.dead))} | ${pct(alive)} |`); }
console.log(lines.join('\n'));
if (md) {
  console.log('\n<<TABLE-RACES>>');
  console.log('| เผ่า | NPC ในรายชื่อ | ตัวเดิมยังเป็นผู้ถือตำแหน่งที่จุดเริ่มสุ่ม | ตายตามอายุขัยใน 40 ปีของยุค 4 | ตายรวมก่อนจบ (ชั้น NPC อื่น) | ยังมีชีวิตตอนจบ |\n| --- | --- | --- | --- | --- | --- |');
  for (const r of byRace) { const alive = (1 - r.nat) * (cum.other.stay + cum.other.moved); console.log(`| ${r.name} | ${r.npc} | ${r.start === null ? '-' : pct(r.start)} | ${pct(r.nat)} | ${pct(1 - (1 - r.nat) * (1 - cum.other.dead))} | ${pct(alive)} |`); }
  console.log('<<END>>');
}
if (!md) console.log('\n(numbers are Monte Carlo with a fixed seed; --md prints one combined table)');
