// Compares ways to pick the start year of a life (docs/lore/world/world-time.md section 8.1).
// Usage: node scripts/sim/sim-start.mjs [worlds] [--tables]
// --tables prints the life tables of docs/systems/simulation/world-sim.md (sections 3.4 and 3.6) for the rule the docs use ('mixed').
import fs from 'fs';
import path from 'path';
import { root } from '../lib/paths.mjs';
import { runWorld, races, cvs, lifeSeesCv } from './sim-world.mjs';

const START = 10400;
const WORLDS = Number(process.argv[2]) || 600;
const docs = path.join(root, 'docs');

// ---- roster ages per race (same parsing as sim-npc-fate.mjs) ----
const PREFIX = [['ดาร์กเอลฟ์', 'de'], ['เอลฟ์ใต้ดิน', 'de'], ['เอลฟ์', 'el'], ['ดรูอิด', 'el'], ['คนแคระ', 'dw'], ['ฮาล์ฟลิง', 'ha'], ['เผ่าปีศาจ', 'dm'], ['ออร์ค', 'or'], ['โอเกอร์', 'or'], ['ยักษ์', 'gi'], ['ลูกผสมจักรกล', 'co'], ['เผ่าลาวา', 'la'], ['กูล', 'gh'], ['เผ่าสัตว์', 'be'], ['เผ่าเสือ', 'be'], ['เผ่าหมี', 'be'], ['เผ่าหมาป่า', 'be'], ['เผ่ามังกร', 'dk'], ['อาเวียน', 'wi'], ['ปีก', 'wi'], ['เผ่านก', 'wi'], ['แวมไพร์', 'va'], ['นาคา', 'na'], ['สไลม์', 'sl'], ['มัมมี่', 'mu'], ['หุ่น', 'so'], ['ภูต', 'fa'], ['เงือก', 'me'], ['ไซเรน', 'me'], ['มนุษย์', 'hu'], ['ฮาล์ฟออร์ค', 'or'], ['ตุ๊กตา', 'co'], ['ลูกหลานปีก', 'wi'], ['ชาวหิน', 'gi'], ['กัปปะ', 'me'], ['สัตว์ทะเล', 'me'], ['เผ่า', 'be'], ['หมาป่า', 'be'], ['ปีศาจ', 'dm']];
const ages = {};
for (const f of fs.readdirSync(path.join(docs, 'lore/npcs')).filter((n) => /^\d\d-.*\.md$/.test(n)))
  for (const line of fs.readFileSync(path.join(docs, 'lore/npcs', f), 'utf8').split('\n')) {
    const m = line.match(/^\| [A-Z]{2}\d{2}-\d \| \*\*[^*]*\*\* *\(([^·)]*)·? *(?:ตายมา )?(\d+)?[^)]*\)/);
    if (!m) continue;
    const race = (PREFIX.find(([p]) => m[1].trim().startsWith(p)) || [, 'hu'])[1];
    (ages[race] ||= []).push(Number(m[2] || 30));
  }
// chance that a roster NPC of this race is still alive t world-years after the story starts
const castAlive = (race, t) => {
  const [lo, hi] = [races.find((r) => r.code === race).lo, races.find((r) => r.code === race).hi];
  const list = ages[race] || [30];
  let s = 0;
  for (const a0 of list) {
    const from = Math.max(lo, a0 + 1);
    if (a0 + t >= hi) continue;
    s += from >= hi ? 0 : Math.min(1, (hi - Math.max(a0 + t, from)) / (hi - from));
  }
  return s / list.length;
};

// ---- rng ----
let seed = 5;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const MARK_W = { '⭐': 3, '●': 2, '○': 1 };
const ADULT = 0.27, ELDER = 0.73; // share of lifespan, world-time.md section 3

// ---- rules: each returns a birth offset (world years after START) ----
function pick(rule, w, race, L, E, evs) {
  const adult = ADULT * L, span = (ELDER - ADULT) * L;
  const maxB = Math.max(0, E - adult - 5);
  if (rule === 'uniform') return rnd() * maxB;
  if (rule === 'early') return rnd() * Math.min(60, maxB);
  if (rule === 'mixed') return rnd() < P_EARLY ? rnd() * Math.min(60, maxB) : pick('aligned+cast', w, race, L, E, evs);
  // aligned: pick an anchor event the character comes of age just before; r3 favours anchors early enough that the original cast is still around
  // an anchor must leave at least half an adult span before the world ends, and the three endings are never anchors
  const pool = evs.filter((e) => e.y >= adult * 0.5 && e.y <= E - 0.5 * span && !['END-10', 'END-11', 'END-12'].includes(e.id));
  if (!pool.length) return rnd() * maxB;
  const weight = (e) => {
    const b = Math.max(0, e.y - adult);
    const f = rule === 'aligned' ? 1 : 0.25 + 0.75 * castAlive(race, b + adult);
    return MARK_W[e.mk] * f;
  };
  let total = pool.reduce((s, e) => s + weight(e), 0), x = rnd() * total, anchor = pool[pool.length - 1];
  for (const e of pool) { x -= weight(e); if (x <= 0) { anchor = e; break; } }
  return Math.min(maxB, Math.max(0, anchor.y - adult - rnd() * 0.3 * span));
}

const RULES = ['uniform', 'early', 'aligned', 'aligned+cast', 'mixed'];
const P_EARLY = 0.25; // 'mixed': this share of lives start in the opening years, the rest use 'aligned+cast'

// ---- NPC story clocks: how many of the 4 NPC stories of a country are open during a stretch of a life ----
const raceMix = Object.entries(ages).flatMap(([c, a]) => a.map(() => c));
const ARC_FRACTION = Number(process.env.ARC) || 0.20; // an NPC story stays open for this share of the holder's lifespan
function arcsOpen(model, lo, hi) {
  const tm = lo + rnd() * Math.max(0, hi - lo); // a random moment of the adult part of the life
  let any = 0, now = 0;
  for (let k = 0; k < 4; k++) {
    const code = raceMix[Math.floor(rnd() * raceMix.length)], rc = races.find((x) => x.code === code);
    const L = rc.lo + rnd() * (rc.hi - rc.lo), D = ARC_FRACTION * L, a = ADULT * L, e = ELDER * L;
    if (model === 'fixed') { if (D >= lo) any++; if (D >= tm) now++; continue; } // every story opens when the world starts
    // clock: each holder opens a story at a random time in the adult part of their life, holders follow one another
    let t = -rnd() * (e - a), hitAny = false, hitNow = false;
    while (t < hi) {
      const o = t + a + rnd() * (e - a);
      if (o <= hi && o + D >= lo) hitAny = true;
      if (o <= tm && o + D >= tm) hitNow = true;
      t += (e - a) + a * 0.3;
    }
    if (hitAny) any++;
    if (hitNow) now++;
  }
  return { any, now };
}

const acc = {};
for (let s = 1; s <= WORLDS; s++) {
  const w = runWorld(s * 7919, {});
  const E = w.ended ? w.ended[1] - START : 1800;
  const evs = [];
  for (const [y, id] of w.log) { if (id === 'DR-15') continue; evs.push({ y: y - START, id, mk: id.startsWith('END') || id.startsWith('DR') ? '⭐' : '●' }); }
  // the last-era events are anchors too (they are the events of the last era); the two countdown scenes sit next to the end and are left out
  const LE_MARK = { 'LE-01': '○', 'LE-02': '○', 'LE-03': '●', 'LE-04': '○', 'LE-05': '●', 'LE-06': '●', 'LE-07': '○', 'LE-08': '●', 'LE-09': '●', 'LE-11': '●' };
  for (const [y, id] of w.le) if (LE_MARK[id] && !process.env.NO_LE_ANCHOR) evs.push({ y: y - START, id, mk: LE_MARK[id] });
  const leYears = w.le.filter(([, id]) => LE_MARK[id]).map(([y]) => y - START);
  const falls = [];
  for (const [id, ys] of w.fired) if (id.startsWith('_fall_')) for (const y of ys) falls.push(y - START);
  for (const race of races) {
    const L = race.lo + rnd() * (race.hi - race.lo);
    for (const rule of RULES) {
      const b = pick(rule, w, race.code, L, E, evs);
      const lo = b + ADULT * L, hi = Math.min(b + L, E);
      const a = ((acc[rule] ||= {})[race.code] ||= { n: 0, ev: 0, evLife: 0, noEvLife: 0, cv: 0, cvPos: 0, noCv: 0, fall: 0, fallLife: 0, cast: 0, endHit: 0, late: 0, le: 0, leLives: 0, sigs: new Set(), arcFixed: 0, arcClock: 0, arcFixedNow: 0, arcClockNow: 0, arcFixedNowZero: 0, arcClockNowZero: 0 });
      a.n++;
      const adultEv = evs.filter((e) => e.y >= lo && e.y <= hi).length;
      const lifeEv = evs.filter((e) => e.y >= b && e.y <= Math.min(b + L, E));
      a.ev += adultEv; a.evLife += lifeEv.length; if (!lifeEv.length) a.noEvLife++;
      a.sigs.add(lifeEv.map((e) => e.id).sort().join(','));
      let seen = 0, possible = 0;
      for (const c of cvs) { const v = lifeSeesCv(race, START + b, L, c, w); if (v === null) continue; possible++; if (v) seen++; }
      a.cv += seen; a.cvPos = possible; if (!seen) a.noCv++;
      const leIn = leYears.filter((y) => y >= b && y <= b + L).length;
      a.le += leIn; if (leIn) a.leLives++;
      const fl = falls.filter((y) => y >= b && y <= b + L).length;
      a.fall += fl; if (fl) a.fallLife++;
      a.cast += castAlive(race.code, lo);
      if (w.ended && w.ended[1] - START <= b + L && w.ended[1] - START >= b) a.endHit++;
      if (b > 200) a.late++;
      const af = arcsOpen('fixed', lo, hi), ac = arcsOpen('clock', lo, hi);
      a.arcFixed += af.any; a.arcClock += ac.any; a.arcFixedNow += af.now; a.arcClockNow += ac.now; if (!af.now) a.arcFixedNowZero++; if (!ac.now) a.arcClockNowZero++;
    }
  }
}

const f1 = (v) => v.toFixed(1);
const f2 = (v) => v.toFixed(2);
const pc = (v) => `${Math.round(100 * v)}%`;
const out = [];
const avgOf = (rule, key) => { const rows = Object.values(acc[rule]); return rows.reduce((s, a) => s + a[key] / a.n, 0) / rows.length; };
if (process.argv.includes('--tables')) {
  out.push(`<<TABLE-LIVES>> (${WORLDS} worlds, rule mixed: ${pc(P_EARLY)} start in the opening years, the rest aligned+cast)`);
  out.push('| เผ่า | มังกรล้มที่เห็น | เหตุการณ์โลกที่เกิดในช่วงชีวิต | จุดบรรจบที่เจอ (จากที่เข้าได้) | ไม่เจอจุดบรรจบเลย |', '| --- | --- | --- | --- | --- |');
  for (const race of races) { const a = acc.mixed[race.code]; out.push(`| ${race.name} | ${f1(a.fall / a.n)} | ${(a.evLife / a.n).toFixed(0)} | ${f2(a.cv / a.n)} (${a.cvPos}) | ${pc(a.noCv / a.n)} |`); }
  out.push('<<TABLE-FRESH>>', '| เผ่า | เห็นมังกรล้มในชีวิต | โลกจบในชีวิต | เหตุการณ์โลกต่อชีวิต | ชีวิตที่ไม่มีเหตุการณ์โลกเลย | ชุดเหตุการณ์ไม่ซ้ำกัน |', '| --- | --- | --- | --- | --- | --- |');
  for (const race of races) { const a = acc.mixed[race.code]; out.push(`| ${race.name} | ${pc(a.fallLife / a.n)} | ${pc(a.endHit / a.n)} | ${f1(a.evLife / a.n)} | ${pc(a.noEvLife / a.n)} | ${pc(a.sigs.size / a.n)} |`); }
  out.push('<<TABLE-CAST>>', '| เผ่า | NPC ต้นฉบับยังอยู่ตอนตัวละครโตเป็นผู้ใหญ่ |', '| --- | --- |');
  for (const race of races) { const a = acc.mixed[race.code]; out.push(`| ${race.name} | ${pc(a.cast / a.n)} |`); }
  out.push('<<END>>');
} else {
  out.push('| กติกา | เหตุการณ์ต่อชีวิต (เฉลี่ยทุกเผ่า) | มังกรล้มที่เห็น | จุดบรรจบที่เจอ | NPC ต้นฉบับยังมีชีวิตตอนโตเป็นผู้ใหญ่ | ชีวิตที่โลกจบ | เกิดหลังปี 200 | LE ต่อชีวิต | ชีวิตที่เจอ LE |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const rule of RULES) out.push(`| ${rule} | ${f1(avgOf(rule, 'ev'))} | ${f1(avgOf(rule, 'fall'))} | ${f1(avgOf(rule, 'cv'))} | ${pc(avgOf(rule, 'cast'))} | ${pc(avgOf(rule, 'endHit'))} | ${pc(avgOf(rule, 'late'))} | ${f2(avgOf(rule, 'le'))} | ${pc(avgOf(rule, 'leLives'))} |`);
  out.push('', 'เรื่องของ NPC ในประเทศ (4 ตำแหน่ง): ทุกเรื่องเปิดตอนโลกเริ่ม (fixed) เทียบกับนาฬิกาของแต่ละผู้ถือ (clock) · "ช่วงผู้ใหญ่" = เรื่องที่เปิดอย่างน้อยครั้งหนึ่ง · "ขณะหนึ่ง" = เรื่องที่เปิดอยู่ ณ จังหวะสุ่มหนึ่งของช่วงผู้ใหญ่', '| กติกาจุดเกิด | fixed ช่วงผู้ใหญ่ | fixed ขณะหนึ่ง | fixed ขณะหนึ่งไม่มีเลย | clock ช่วงผู้ใหญ่ | clock ขณะหนึ่ง | clock ขณะหนึ่งไม่มีเลย |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const rule of RULES) out.push(`| ${rule} | ${f2(avgOf(rule, 'arcFixed'))} | ${f2(avgOf(rule, 'arcFixedNow'))} | ${pc(avgOf(rule, 'arcFixedNowZero'))} | ${f2(avgOf(rule, 'arcClock'))} | ${f2(avgOf(rule, 'arcClockNow'))} | ${pc(avgOf(rule, 'arcClockNowZero'))} |`);
}
console.log(out.join('\n'));
console.log(`\nworlds ${WORLDS} · seed 5 · events = world events in the adult part of the life, DR-15 left out`);
