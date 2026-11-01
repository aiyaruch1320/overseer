// LLM cost per life: reads the price table (section 1) and the task table (section 4) of docs/systems/llm/01-cost.md,
// prints cost per life by player style and tier, a per-task breakdown, sensitivity rows, scale and the dev-time library cost.
// Usage: node scripts/sim/sim-llm-cost.mjs [--write]   (--write puts the result tables into section 6 of the same file)
import fs from 'fs';
import path from 'path';
import { root } from '../lib/paths.mjs';

const FILE = path.join(root, 'docs/systems/llm/01-cost.md');
const doc = fs.readFileSync(FILE, 'utf8');
const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
const num = (s) => Number(String(s).replace(/,/g, ''));

// ---------- inputs from the doc ----------
const priceRow = (label) => {
  const l = doc.split('\n').find((x) => x.startsWith(`| ${label} |`));
  if (!l) throw new Error(`no price row "${label}"`);
  const [, hit, miss, out] = cells(l).map(num);
  return { hit: hit / 1e6, miss: miss / 1e6, out: out / 1e6 };
};
const PRICE = { peak: priceRow('ช่วงเร่งด่วน'), off: priceRow('นอกช่วงเร่งด่วน') };
const TASKS = doc.split('\n').filter((l) => /^\| `[a-z_]+` \| \d \| \d \|/.test(l)).map((l) => {
  const c = cells(l);
  return { id: c[0].replace(/`/g, ''), tier: { lean: num(c[1]), full: num(c[2]) }, calls: { quiet: num(c[3]), normal: num(c[4]), heavy: num(c[5]) }, prefix: num(c[6]), input: num(c[7]), output: num(c[8]) };
});
if (TASKS.length < 15) throw new Error(`task table: only ${TASKS.length} rows`);

// assumptions (section 4 of the doc says the same)
const HIT = 0.95, PEAK_SHARE = 0.25, THINK_EXTRA = 300, LIVES_PER_PLAYER_MONTH = 15;

const callCost = (t, o = {}) => {
  const hit = o.hit ?? HIT, peak = o.peak ?? PEAK_SHARE, out = t.output * (o.outMul ?? 1) + (o.think ? THINK_EXTRA : 0);
  const at = (p) => t.prefix * (hit * p.hit + (1 - hit) * p.miss) + t.input * p.miss + out * p.out;
  return peak * at(PRICE.peak) + (1 - peak) * at(PRICE.off);
};
const life = (style, tier, o = {}) => {
  let usd = 0, calls = 0, outTok = 0, inTok = 0;
  const rows = [];
  for (const t of TASKS) {
    if (t.tier[tier] < 2) continue;
    const n = t.calls[style];
    const c = n * callCost(t, o);
    usd += c; calls += n; outTok += n * (t.output + (o.think ? THINK_EXTRA : 0)); inTok += n * (t.prefix + t.input);
    rows.push({ id: t.id, n, c });
  }
  return { usd, calls, outTok, inTok, rows };
};

const STYLE = { quiet: 'เงียบ', normal: 'ปกติ', heavy: 'หนัก' };
const TIER = { lean: 'ปิดผู้กำกับ', full: 'ค่าเริ่มต้น' };
const $ = (x) => (x < 0.001 ? x.toFixed(5) : x < 0.1 ? x.toFixed(4) : x.toFixed(2));
const n0 = (x) => Math.round(x).toLocaleString('en-US');
const out = [];

out.push('**ต่อหนึ่งชีวิต** (25% ของคำขอในช่วงเร่งด่วน ส่วนหน้าชนแคช 95% ปิดโหมดคิด)', '', '| แบบผู้เล่น | แบบ | คำขอต่อชีวิต | โทเคนเข้า | โทเคนออก | ดอลลาร์ต่อชีวิต | บาทต่อชีวิต (35 บาท) |', '| --- | --- | --- | --- | --- | --- | --- |');
for (const s of Object.keys(STYLE)) for (const t of Object.keys(TIER)) {
  const r = life(s, t);
  out.push(`| ${STYLE[s]} | ${TIER[t]} | ${n0(r.calls)} | ${n0(r.inTok)} | ${n0(r.outTok)} | ${$(r.usd)} | ${(r.usd * 35).toFixed(3)} |`);
}
out.push('', 'ปิดสวิตช์ `llm` (ไม่ใช้ LLM) ไม่มีค่าระหว่างเล่น', '');

const base = life('normal', 'full');
out.push('**แยกตามงาน** แบบผู้เล่นปกติ ค่าเริ่มต้น', '', '| งาน | ครั้ง | ดอลลาร์ | สัดส่วน |', '| --- | --- | --- | --- |');
for (const r of [...base.rows].sort((a, b) => b.c - a.c)) out.push(`| \`${r.id}\` | ${r.n} | ${$(r.c)} | ${((100 * r.c) / base.usd).toFixed(0)}% |`);
out.push('');

out.push('**ความไว** แบบผู้เล่นปกติ ค่าเริ่มต้น', '', '| กรณี | ดอลลาร์ต่อชีวิต | เทียบค่าฐาน |', '| --- | --- | --- |');
const sens = [
  ['ค่าฐาน', {}],
  ['ทุกคำขอในช่วงเร่งด่วน', { peak: 1 }],
  ['ทุกคำขอนอกช่วงเร่งด่วน', { peak: 0 }],
  ['เปิดโหมดคิด (ความคิดราว 300 โทเคนต่อคำขอ)', { think: true }],
  ['แคชไม่ชนเลย', { hit: 0 }],
  ['คำตอบยาวขึ้น 50%', { outMul: 1.5 }],
];
for (const [label, o] of sens) { const r = life('normal', 'full', o); out.push(`| ${label} | ${$(r.usd)} | ×${(r.usd / base.usd).toFixed(2)} |`); }
out.push('');

out.push(`**ตามจำนวนผู้เล่น** ผู้เล่นหนึ่งคนเล่นราว ${LIVES_PER_PLAYER_MONTH} ชีวิตต่อเดือน (25 ถึง 45 นาทีต่อชีวิต)`, '', '| ผู้เล่นต่อเดือน | แบบ | คำขอต่อวัน | ดอลลาร์ต่อเดือน |', '| --- | --- | --- | --- |');
for (const players of [100, 1000, 10000]) for (const t of ['lean', 'full']) {
  const r = life('normal', t);
  const lives = players * LIVES_PER_PLAYER_MONTH;
  out.push(`| ${n0(players)} | ${TIER[t]} | ${n0((lives * r.calls) / 30)} | ${n0(lives * r.usd)} |`);
}
out.push('');

// dev-time library: entries per task family × average output, ten entries per call over the shared prefix
const LIB = [
  ['`omen` คำใบ้ 9 × ทวีป 9 × ฤดู 4 × 20 แบบ', 9 * 9 * 4 * 20, 30],
  ['`prayer` ชนิด 17 × เผ่า 21 × ระดับศรัทธา 3 × 10 แบบ', 17 * 21 * 3 * 10, 50],
  ['`dream_wake` ผล 4 × สัญลักษณ์ 12 × เผ่า 21 × 5 แบบ', 4 * 12 * 21 * 5, 50],
  ['`rumor` เหตุการณ์ 194 × ทวีป 9 × 5 แบบ', 194 * 9 * 5, 40],
  ['`npc_voice` NPC 614 × ความรู้สึก 6 × 3 แบบ', 614 * 6 * 3, 45],
  ['`fate` ชะตาราว 60 × ผล 3 × 10 แบบ', 60 * 3 * 10, 70],
  ['`flavor` หัวข้อ 12 × ผล 18 × เผ่า 21 × 3 แบบ', 12 * 18 * 21 * 3, 70],
  ['`battle` ศัตรู 200 × ผล 3 × 5 แบบ', 200 * 3 * 5, 200],
  ['`side_event` เผ่า 21 × ช่วงวัย 5 × หัวข้อ 12 × 3 แบบ', 21 * 5 * 12 * 3, 120],
  ['`homeland_letter` เผ่า 21 × ทวีป 9 × 5 แบบ', 21 * 9 * 5, 120],
];
const PRO = { miss: 1.32 / 1e6, out: 3.96 / 1e6 }; // deepseek-v4-pro at the peak rate (pricing page 2026-11-01), prefix counted as a miss to stay safe
let entries = 0, flash = 0, pro = 0;
out.push('**คลังชั้น 1 ที่สร้างตอนพัฒนา** (สิบชิ้นต่อคำขอ ส่วนหน้าร่วม 1,500 โทเคน ข้อมูลเข้า 200 โทเคนต่อคำขอ)', '', '| ชุด | ชิ้น | โทเคนออกต่อชิ้น |', '| --- | --- | --- |');
for (const [label, n, o] of LIB) {
  entries += n;
  const calls = n / 10;
  flash += calls * (1500 * (HIT * PRICE.off.hit + (1 - HIT) * PRICE.off.miss) + 200 * PRICE.off.miss) + n * o * PRICE.off.out;
  pro += calls * (1700 * PRO.miss) + n * o * PRO.out;
  out.push(`| ${label} | ${n0(n)} | ${o} |`);
}
out.push('', `รวม ${n0(entries)} ชิ้น · สร้างด้วย Flash นอกช่วงเร่งด่วนราว ${$(flash)} ดอลลาร์ · สร้างด้วย V4 Pro ช่วงเร่งด่วนราว ${$(pro)} ดอลลาร์ (ครั้งเดียวต่อรุ่นของเกม ไม่รวมการขอซ้ำเมื่อไม่ผ่านตัวตรวจ)`);

const md = out.join('\n');
if (process.argv.includes('--write')) {
  const a = '<!-- llm-cost:start -->', b = '<!-- llm-cost:end -->';
  if (!doc.includes(a) || !doc.includes(b)) throw new Error('markers missing');
  fs.writeFileSync(FILE, doc.split(a)[0] + a + '\n' + md + '\n' + b + doc.split(b)[1]);
  console.log(`llm cost: ${TASKS.length} tasks · normal/full ${$(base.usd)} USD per life · written to docs/systems/llm/01-cost.md`);
} else console.log(md);
