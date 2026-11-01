// How many NPCs with a story of their own are around at each point of the world clock, and how many such stories one life can meet.
// Rules: docs/lore/npcs/README.md section 2.1 (age clock, open window 20% of lifespan), docs/lore/npcs/succession.md
// (tier 1 allies and tier 2 roles get a successor when the holder dies, 60% of tier 3 rows too; newcomers NT roll 40% per country every 100 years
// and at each era start).
// Usage: node scripts/sim/sim-npc-density.mjs [worlds=200] [--nt=0.4] [--ntEvery=100] [--tier3=0.6] [--old]
//   --tier3=x    share of tier 3 rows that get a successor
//   --ntEvery=y  roll newcomers every y world-years from year y (0 = only at era starts)
//   --old        the rule before 2026-11-01: no tier 3 successors, newcomers only at era starts
import fs from 'fs';
import path from 'path';
import { root } from '../lib/paths.mjs';
import { runWorld } from './sim-world.mjs';

const docs = path.join(root, 'docs');
const read = (p) => fs.readFileSync(path.join(docs, p), 'utf8');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const WORLDS = Number(process.argv[2]) || 200;
const OLD = process.argv.includes('--old');
const NT = arg('nt', 0.4), TIER3 = OLD ? 0 : arg('tier3', 0.6), EVERY = OLD ? 0 : arg('ntEvery', 100);
const START = 10400, HORIZON = 1800, WINDOW = 0.2;

// ---- lifespans and life stages per people (world-time.md section 3) ----
const life = [];
for (const l of read('lore/world/world-time.md').split('## 3.')[1].split('## 4.')[0].split('\n')) {
  const c = l.split('|').map((x) => x.trim());
  const m = c[2] && c[2].replace(/,/g, '').match(/^(\d+)–(\d+)$/);
  if (m) life.push({ name: c[1].replace(/ \(.*\)$/, ''), lo: +m[1], hi: +m[2], adult: +c[4], elder: +c[5] });
}
life.sort((a, b) => b.name.length - a.name.length);
const ALIAS = [['ชาวทุ่ง', 'มนุษย์'], ['ชนผืนทราย', 'มนุษย์'], ['ชนใต้ทราย', 'มนุษย์'], ['มนุษย์เรือ', 'มนุษย์'], ['ชาวพื้น', 'มนุษย์'], ['ผู้กลับชาติ', 'มนุษย์'], ['ผู้ถูกอัญเชิญ', 'มนุษย์'], ['ชาวหิน', 'มนุษย์'],
  ['อาเวียน', 'เผ่าปีก'], ['ลูกหลานปีก', 'เผ่าปีก'], ['เผ่านก', 'เผ่าสัตว์'], ['โอเกอร์', 'ออร์ค'], ['ฮาล์ฟออร์ค', 'ออร์ค'], ['เผ่าหมาป่า', 'เผ่าสัตว์'], ['เผ่าสิงโต', 'เผ่าสัตว์'], ['เผ่ากวาง', 'เผ่าสัตว์'],
  ['ภูต', 'ภูตพราย'], ['หุ่นมีวิญญาณ', 'หุ่นวิญญาณ'], ['ปีศาจ', 'เผ่าปีศาจ'], ['ตุ๊กตา', 'ลูกผสมจักรกล']];
const people = (t) => life.find((p) => t.startsWith(p.name)) || life.find((p) => p.name === (ALIAS.find(([k]) => t.startsWith(k)) || [])[1]) || life.find((p) => p.name === 'มนุษย์');

// ---- roster ----
const EV = /\b(?:DR|PL|WR|CT|DM|MC|BIO|GD|HP|PO|GI|FG|END|LE)-\d{2}\b/g;
const allies = new Set(read('systems/bonds/07-successors.md').match(/[A-Z]{2}\d{2}-\dS/g).map((x) => x.slice(0, -1)));
const npcs = [];
for (const f of fs.readdirSync(path.join(docs, 'lore/npcs')).filter((n) => /^\d\d-.*\.md$/.test(n)))
  for (const line of read(`lore/npcs/${f}`).split('\n')) {
    const m = line.match(/^\| ([A-Z]{2})(\d{2})-(\d) \| \*\*[^*]*\*\* *\(([^)]*)\)/);
    if (!m) continue;
    const [race, ageText] = m[4].split('·').map((x) => x.trim());
    const p = people(race.split('ครึ่ง')[0]);
    const age = Number((ageText || '').replace(/[^\d]/g, '')) || Math.round((p.adult + p.elder) / 2);
    const opening = line.replace(/→\s*(?:`?(?:DR|PL|WR|CT|DM|MC|BIO|GD|HP|PO|GI|FG|END|LE)-\d{2}`?(?:\s*(?:,|\/|และ|หรือ)\s*)?)+/g, '');
    const id = `${m[1]}${m[2]}-${m[3]}`;
    const tier = allies.has(id) ? 1 : m[3] === '1' || EV.test(opening) ? 2 : 3;
    EV.lastIndex = 0;
    npcs.push({ id, country: `${m[1]}-${m[2]}`, cont: m[1], p, age, tier });
  }
const countries = [...new Set(npcs.map((n) => n.country))];
const leaderPeople = Object.fromEntries(npcs.filter((n) => n.id.endsWith('-1')).map((n) => [n.country, n.p]));

// ---- rng ----
let seed = 11;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const u = (a, b) => a + rnd() * (b - a);

// one holder: alive [from, to), story open [s, s + 0.2 L) cut at death; age clock opens between adult and elder age
function holder(p, age, from) {
  const L = age > p.hi ? age + 100 : u(Math.max(p.lo, age + 1), p.hi);
  const to = from + (L - age);
  const s = from + (age >= p.elder ? u(0, 5) : u(Math.max(0, p.adult - age), p.elder - age));
  return { from, to, s, e: Math.min(to, s + WINDOW * L) };
}

// ---- worlds ----
const ERAS = [[0, 100, 'ยุค 1 ต้น (0–100)'], [100, 300, 'ยุค 1 กลาง (100–300)'], [300, 620, 'ยุค 1 ปลาย (300–620)'], [620, 980, 'ยุค 2 (620–980)'], [980, 1320, 'ยุค 3 (980–1,320)'], [1320, 1800, 'ยุค 4 (1,320–1,800)']];
const alive = ERAS.map(() => ({ orig: 0, role: 0, nt: 0 }));
const open = ERAS.map(() => 0);
const LIVES = [[40, 'เริ่มช่วงต้น (ผู้ใหญ่ปีที่ 40)'], [450, 'ยุค 1 ปลาย (ปีที่ 450)'], [800, 'ยุค 2 (ปีที่ 800)'], [1150, 'ยุค 3 (ปีที่ 1,150)'], [1450, 'ยุค 4 (ปีที่ 1,450)']];
const SPANS = [[35, 'มนุษย์ (ผู้ใหญ่ 35 ปีโลก)'], [136, 'เอลฟ์ (ผู้ใหญ่ 136 ปีโลก)']];
const met = LIVES.map(() => SPANS.map(() => ({ country: 0, cont: 0 })));
for (let w = 1; w <= WORLDS; w++) {
  const world = runWorld(w * 7919);
  const e2 = world.eraStart[1] ? world.eraStart[1] - START : null, e3 = world.eraStart[2] ? world.eraStart[2] - START : null, e4 = world.eraStart[3] ? world.eraStart[3] - START : null;
  const rolls = [e2, e3, e4].filter((x) => x !== null);
  if (e4 !== null) for (let y = e4 + 100; y < HORIZON; y += 100) rolls.push(y);
  if (EVERY) for (let y = EVERY; y < HORIZON; y += EVERY) rolls.push(y);
  const all = []; // [country, cont, kind, holder]
  for (const n of npcs) {
    let h = holder(n.p, n.age, 0);
    all.push([n.country, n.cont, 'orig', h]);
    const refill = n.tier < 3 || rnd() < TIER3;
    while (refill && h.to < HORIZON) { h = holder(n.p, Math.round(u(n.p.adult, n.p.elder)), h.to); all.push([n.country, n.cont, 'role', h]); }
  }
  for (const y of rolls) for (const c of countries) if (rnd() < NT) { const p = leaderPeople[c]; all.push([c, c.slice(0, 2), 'nt', holder(p, Math.round(u(p.adult, p.elder)), y)]); }
  ERAS.forEach(([a, b], i) => {
    for (let t = a + 5; t < b; t += 10) for (const [, , kind, h] of all) {
      if (h.from <= t && t < h.to) alive[i][kind] += 1 / ((b - a) / 10) / WORLDS / countries.length;
      if (h.s <= t && t < h.e) open[i] += 1 / ((b - a) / 10) / WORLDS / countries.length;
    }
  });
  LIVES.forEach(([t0], i) => SPANS.forEach(([span], j) => {
    const c = countries[Math.floor(rnd() * countries.length)];
    for (const [cc, cont, , h] of all) {
      if (h.s < t0 + span && h.e > t0) { if (cc === c) met[i][j].country += 1 / WORLDS; if (cont === c.slice(0, 2)) met[i][j].cont += 1 / WORLDS; }
    }
  }));
}

const f1 = (x) => x.toFixed(1);
console.log(`npc density: ${npcs.length} roster (tier 1 ${npcs.filter((n) => n.tier === 1).length} · tier 2 ${npcs.filter((n) => n.tier === 2).length} · tier 3 ${npcs.filter((n) => n.tier === 3).length}) · ${WORLDS} worlds · NT ${NT}${EVERY ? ` every ${EVERY}y` : ''} · tier 3 refill ${TIER3}`);
console.log('\n| ช่วง | NPC มีเรื่องที่ยังมีชีวิตต่อประเทศ | ต้นฉบับ | ผู้สืบ | ที่มาใหม่ | เรื่องที่เปิดอยู่ต่อประเทศ ณ หนึ่งจังหวะ |\n| --- | --- | --- | --- | --- | --- |');
ERAS.forEach(([, , name], i) => { const a = alive[i]; console.log(`| ${name} | ${f1(a.orig + a.role + a.nt)} | ${f1(a.orig)} | ${f1(a.role)} | ${f1(a.nt)} | ${f1(open[i])} |`); });
console.log('\n| ชีวิตเริ่มเป็นผู้ใหญ่ที่ | ' + SPANS.map(([, n]) => `${n}: ประเทศเกิด · ทั้งทวีป`).join(' | ') + ' |\n| --- | ' + SPANS.map(() => '---').join(' | ') + ' |');
LIVES.forEach(([, name], i) => console.log(`| ${name} | ${SPANS.map((_, j) => `${f1(met[i][j].country)} · ${Math.round(met[i][j].cont)}`).join(' | ')} |`));
