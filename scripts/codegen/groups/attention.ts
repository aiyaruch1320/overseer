// Attention generator (code-plan §5.1, row "การเรียก"): three levels, stop gap, merge rules, the three player settings,
// the trigger rates and card deadlines sim-attention.mjs builds a life from. Writes data/gen/attention.json.
import type { AttentionData, AttentionRule } from '../../../src/core/data/types-attention';
import { findTable, finish, nums, num, src, Unparsed } from '../helpers-m0b';
import { writeGen } from '../lib/table';

const F = 'docs/systems/experience/07-attention.md';
const un = new Unparsed('attention');

const must = <T>(v: T | null | undefined, what: string): T => {
  if (v == null) throw new Error('attention: missing ' + what);
  return v;
};

export default function run() {
  const principles = findTable(F, /1\. หลัก/, 'ข้อ');
  const levels = findTable(F, /สามระดับ/, 'ระดับ');
  const trig = findTable(F, /สามระดับ/, 'เรื่อง');
  const rulesT = findTable(F, /กติกาการเรียก/, 'กติกา');
  const waitT = findTable(F, /กติกาการเรียก/, 'การ์ด');
  const setT = findTable(F, /การตั้งค่าของผู้เล่น/, 'ระดับ');
  const goal = findTable(F, /ผลจำลอง/, 'เป้า', 0);
  const simT = findTable(F, /ผลจำลอง/, 'กติกา');
  const old = findTable(F, /โค้ดเดิม/, 'โค้ดเดิม');

  // default rule from the rule table
  const rv = (p: string) => must(rulesT.rows.find((r) => r.cells[0].startsWith(p)), p).cells[1];
  const stopGap = nums(rv('การหยุดสองครั้ง'))[0];
  const merge = nums(rulesT.rows.find((r) => r.cells[0].startsWith('หน้าต่างพระเจ้าหลังจุดหยุด'))!.cells[0])[0];
  const gapRow = rv('การหยุดหรือการ์ดหลังการเรียกครั้งก่อน');
  const cardGap = nums(gapRow)[0];
  const stopWait = nums(gapRow.replace(/^ห่างอย่างน้อย\s*\d+\s*วินาที/, ''))[0];
  const stopAges = nums(rulesT.rows.find((r) => r.cells[0].startsWith('หน้าต่างพระเจ้าหรือลาง'))!.cells[0])[0];
  if (stopAges !== stopGap) throw new Error('attention: age-stop pull window differs from the stop gap');
  const normal: AttentionRule = { stopGap, merge, cardGap, stopWait, cards: null, windows: true };

  const low = must(setT.rows.find((r) => r.cells[0] === 'น้อย'), 'low').cells[1];
  const high = must(setT.rows.find((r) => r.cells[0] === 'มาก'), 'high').cells[1];
  const ln = nums(low);
  const hn = nums(high);
  const settings = {
    low: { ...normal, stopGap: ln[1], cardGap: ln[0], windows: false, cards: ['prayer', 'crisis', 'majorOmen'] },
    normal,
    high: { ...normal, stopGap: hn[0], cardGap: hn[1] },
  };

  // deadlines in life years, per kind
  const w = (p: string) => must(waitT.rows.find((r) => r.cells[0].startsWith(p)), p).cells[1];
  const prayerWait = nums(w('คำอธิษฐาน'));
  const deadlines = {
    prayer: prayerWait[0], // 3.5 life years; the sim writes 14 / 4
    omen: num(w('ลางเหตุการณ์โลก'))!,
    battle: num(w('ก่อนศึก'))!,
    crisis: num(w('วิกฤตพวกพ้อง'))!,
    majorOmen: num(w('ลาง ⭐'))!,
  };

  // trigger rates (table 2, column 3)
  const t = (p: string) => must(trig.rows.find((r) => r.cells[0].startsWith(p)), p);
  const per = (p: string) => num(t(p).cells[2])!;
  const windowRow = t('หน้าต่างพระเจ้า');
  const wm = must(windowRow.cells[3].match(/(\d+)\s*โหนดต่อชีวิต\s*×\s*(\d+)\s*แถวหน้าต่างใน\s*(\d+)/), 'window rate source');
  const prayerRow = t('คำอธิษฐาน');
  const trouble = Number(must(prayerRow.cells[3].match(/ความทุกข์ใกล้ตัว\s*(\d+)%/), 'trouble share')[1]) / 100;
  // sim-attention: prayer per life-year = 4 ticks × (calm share × 0.035 + trouble share × 0.105)
  const base = 0.035;
  const rates = {
    window: (Number(wm[1]) * Number(wm[2])) / Number(wm[3]),
    prayer: 4 * ((1 - trouble) * base + trouble * base * 3),
    omen: per('ลางเหตุการณ์โลกในทวีป'),
    majorOmen: per('ลาง ⭐'),
    battle: per('ก่อนศึก'),
    crisis: per('วิกฤตขั้น 3'),
  };

  const targets = goal.rows.map((r) => {
    const n = nums(r.cells[1]);
    return { what: r.cells[0], value: r.cells[1], min: /ถึง/.test(r.cells[1]) ? n[0] : null, max: /ไม่เกิน/.test(r.cells[1]) ? n[0] : /ถึง/.test(r.cells[1]) ? n[1] : null };
  });

  const data: AttentionData = {
    principles: principles.rows.map((r) => ({ n: Number(r.cells[0]), title: r.cells[1].replace(/\*/g, ''), effect: r.cells[2] })),
    levels: levels.rows.map((r) => ({ id: ({ หยุด: 'stop', การ์ด: 'card', บันทึก: 'log' } as const)[r.cells[0].replace(/\*/g, '') as 'หยุด'], name: r.cells[0].replace(/\*/g, ''), screen: r.cells[1], time: r.cells[2] })),
    triggers: trig.rows.map((r) => ({ name: r.cells[0], level: r.cells[1], perLife: /ราว|^\d/.test(r.cells[2]) ? num(r.cells[2]) : null, source: r.cells[3], src: src(trig, r.line) })),
    rule: normal,
    settings,
    deadlines,
    rates,
    ageStops: nums(t('จุดหยุดตามอายุ').cells[0]),
    lifeMinutes: { min: 25, max: 45, sim: 35 },
    lifeYears: 75,
    earlyDeath: { perYear: 0.004, fromAge: 15 },
    rulesTable: rulesT.rows.map((r) => ({ rule: r.cells[0], value: r.cells[1] })),
    targets,
    simResults: simT.rows.map((r) => ({ rule: r.cells[0], cells: r.cells.slice(1) })),
    oldCodeChanges: old.rows.map((r) => ({ old: r.cells[0], becomes: r.cells[1] })),
    settingsText: setT.rows.map((r) => ({ level: r.cells[0], diff: r.cells[1] })),
  };
  // the age stops are the ones the sim hard-codes
  if (data.ageStops.join() !== '5,15,30,50,70') throw new Error('attention: age stops changed ' + data.ageStops);
  writeGen('attention', data, [F, 'docs/systems/god/06-implementation.md', 'docs/systems/experience/01-one-life.md'], 'scripts/codegen/groups/attention.ts');
  return finish('attention', ['attention.json'], un);
}
