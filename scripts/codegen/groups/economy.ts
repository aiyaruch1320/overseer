// Economy generator (code-plan §5.1, row "เศรษฐกิจ"): trust, goods, prices, classes, income, living, tax, poverty, bank,
// trade, investment and the P0 to P7 steps with the targets sim-gold measures. Writes data/gen/economy.json.
// Per-country wealth rows (02-countries.md section 4) belong to the countries generator, not here.
import type { EconomyData, RawTable } from '../../../src/core/data/types-economy';
import { findTable, finish, mult, num, nums, pct, ticks, tables, Unparsed, section } from '../helpers-m0b';
import { listDocs, readDoc, writeGen } from '../lib/table';
import type { Table } from '../lib/table';

const E = 'docs/systems/economy/';
const GEN = 'scripts/codegen/groups/economy.ts';
const un = new Unparsed('economy');
const TIERS = ['C', 'U', 'R', 'E', 'L'];

const must = <T>(v: T | null | undefined, what: string): T => {
  if (v == null) throw new Error('economy: missing ' + what);
  return v;
};
const row = (t: Table, prefix: string) => must(t.rows.find((r) => r.cells[0].startsWith(prefix)), `${t.file} row "${prefix}"`).cells;
const raw = (t: Table): RawTable => ({ headings: t.headings.slice(1), header: t.header, rows: t.rows.map((r) => r.cells), src: `${t.file}:${t.line}` });
const countries = (s: string) => {
  const out: string[] = [];
  for (const m of s.matchAll(/\b([A-Z]{2})-(\d\d)\b/g)) out.push(`${m[1]}-${m[2]}`);
  for (const m of s.matchAll(/\b([A-Z]{2})\s+ทั้งทวีป/g)) out.push(m[1]);
  return [...new Set(out)];
};
const cellPrice = (s: string): number | null => {
  const t = s.replace(/(\d),(\d{3})/g, '$1$2');
  if (/ไม่ขาย/.test(t) || t === '—' || !/\d/.test(t)) return null;
  const r = t.match(/(\d+)\s*ถึง\s*(\d+)/);
  if (r) return (Number(r[1]) + Number(r[2])) / 2;
  return Number(t.match(/\d+(?:\.\d+)?/)![0]);
};
const THAI_N: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10 };
void THAI_N;

function trust() {
  const f = E + '01-world-economy.md';
  const start = findTable(f, /เงินและความเชื่อมั่น/, 'ตัวแปร');
  const bands = findTable(f, /เงินและความเชื่อมั่น/, 'C');
  const forms = findTable(f, /เงินและความเชื่อมั่น/, 'รูปแบบ');
  const startCell = row(start, 'ความเชื่อมั่น')[2];
  const before = Number(must(startCell.match(/(\d+)\s*ก่อน/), 'trust before')[1]);
  const after = Number(must(startCell.match(/(\d+)\s*หลัง/), 'trust after')[1]);
  const recover = Number(must(readDoc(E + '08-implementation.md').match(/ฟื้น \+(\d+) ถ้าไม่มีสงคราม/), 'trust recovery')[1]);
  const mulOf = (i: number) => [1, 1.1, 1.25, 1][i] ?? 1;
  return {
    start: { before, after },
    recoverPerYear: recover,
    bands: bands.rows.map((r, i) => {
      const n = nums(r.cells[0]);
      return { min: /ต่ำกว่า/.test(r.cells[0]) ? null : n[0], max: /ต่ำกว่า/.test(r.cells[0]) ? n[0] : n[1] ?? null, effect: r.cells[1], priceMul: mulOf(i), src: `${bands.file}:${r.line}` };
    }),
    moneyForms: forms.rows.map((r) => ({ form: r.cells[0], countries: countries(r.cells[1]), rule: r.cells[2] })),
  };
}

function world() {
  const f = E + '01-world-economy.md';
  const goods = findTable(f, /สินค้า 9 หมวด/, 'รหัส');
  const bal = findTable(f, /สินค้า 9 หมวด/, 'สถานะในหมวดหนึ่ง');
  const pr = findTable(f, /ราคา/, 'ตัวคูณ');
  const routes = findTable(f, /เส้นทางและต้นทุนขนส่ง/, 'เส้นทาง');
  const eras = findTable(f, /สัญญาณเศรษฐกิจ/, 'ยุค');
  const ev = findTable(f, /เหตุการณ์ของโลกกับเศรษฐกิจ/, 'เหตุการณ์');
  const fau = findTable(f, /ทองเข้าและทองออก/, 'ทางเข้า (faucet)');
  const sink = findTable(f, /ทองเข้าและทองออก/, 'ทางออก (sink)');
  const bm = findTable(f, /ตลาดมืด/, 'ที่');
  const sc = row(pr, 'ขาดแคลน');
  const scN = nums(sc[1].replace(/ปรับ.*/, ''));
  const swing = nums(sc[1].match(/±(\d+)%/)?.[0] ?? '25')[0] / 100;
  const idx = nums(row(pr, 'ดัชนีราคา')[1].replace(/\(.*\)/, '').replace(/[×x]/g, ''));
  const trustRow = row(pr, 'ความเชื่อมั่นทอง');
  const tn = [...trustRow[1].matchAll(/×([\d.]+)/g)].map((m) => Number(m[1]));
  const balN = (p: string) => Number(bal.rows.find((r) => r.cells[0].startsWith(p))!.cells[1]);
  return {
    goods: goods.rows.map((r) => ({ code: r.cells[0], name: r.cells[1], base: /\d/.test(r.cells[2]) ? Number(r.cells[2]) : null, examples: r.cells[3], producers: countries(r.cells[4]), src: `${goods.file}:${r.line}` })),
    balance: { exporter: balN('ส่งออก'), enough: balN('ผลิตพอใช้'), short: balN('ขาด') },
    priceMods: { wIndex: idx, scarcity: { exporter: scN[0], enough: scN[1], short: scN[2], swing }, trustMid: tn[0], trustLow: tn[1] },
    routes: routes.rows.map((r) => ({ route: r.cells[0], costPct: num(r.cells[1])!, risk: r.cells[2], where: r.cells[3] })),
    eras: eras.rows.map((r) => ({ era: Number(r.cells[0].match(/^\d/)![0]), name: r.cells[0].replace(/^\d\s*/, ''), trait: r.cells[1], effect: r.cells[2], transportPlus: /ต้นทุนขนส่ง\s*\+(\d+)%/.test(r.cells[2]) ? Number(r.cells[2].match(/ต้นทุนขนส่ง\s*\+(\d+)%/)![1]) : null })),
    worldEvents: ev.rows.map((r) => ({ events: [...r.cells[0].matchAll(/\b([A-Z]{2,4}-\d\d)\b/g)].map((m) => m[1]), scope: r.cells[1], w: r.cells[2], price: r.cells[3], trust: /^[+\-−]?\d+$/.test(r.cells[4].replace('−', '-')) ? Number(r.cells[4].replace('−', '-')) : r.cells[4] === '0' ? 0 : null, src: `${ev.file}:${r.line}` })),
    faucets: fau.rows.map((r) => ({ name: r.cells[0], size: r.cells[1] })),
    sinks: sink.rows.map((r) => ({ name: r.cells[0], note: r.cells[1] })),
    blackMarket: bm.rows.map((r) => ({ where: r.cells[0], role: r.cells[1] })),
  };
}

function countriesAndClasses() {
  const f2 = E + '02-countries.md';
  const w = findTable(f2, /ผลของระดับ W/, 'W');
  const met = findTable(f2, /ตัวชี้วัด/, 'ตัวชี้วัด');
  const f = E + '03-classes.md';
  const cls = findTable(f, /ห้าชั้น/, 'ชั้น');
  const mat = findTable(f, /ชนชั้นที่เกิดตาม/, 'W');
  const gold = findTable(f, /ของที่ได้ตอนเกิด/, 'ชั้น', 0);
  const items = findTable(f, /ของที่ได้ตอนเกิด/, 'ชั้น', 1);
  const jobs = findTable(f, /ชนชั้นกับอาชีพ/, 'ชั้น');
  const moves = findTable(f, /ขึ้นและตกชั้น/, 'การเปลี่ยน');
  const reg = findTable(f, /ระบอบการปกครอง/, 'ระบอบ');
  const race = findTable(f, /เผ่าและชนชั้น/, 'กรณี');
  const CLS = ['ผู้ไร้สิทธิ์', 'ชนชั้นล่าง', 'สามัญชน', 'ผู้มั่งคั่ง', 'ขุนนาง'];
  return {
    wLevels: w.rows.map((r) => ({ w: Number(r.cells[0]), name: r.cells[1], priceIndex: mult(r.cells[2])!, incomeIndex: mult(r.cells[3])!, shops: r.cells[4], look: r.cells[5] })),
    metrics: met.rows.map((r) => ({ name: r.cells[0].replace(/\*/g, ''), range: r.cells[1], meaning: r.cells[2] })),
    classes: cls.rows.map((r) => ({ n: Number(r.cells[0]), name: r.cells[1], who: r.cells[2], rights: r.cells[3] })),
    classByWG: mat.rows.map((r) => ({ w: Number(r.cells[0]), g: r.cells[1], pct: r.cells.slice(2, 7).map(Number) })),
    startGold: gold.rows.map((r) => ({ cls: r.cells[0], range: (nums(r.cells[1]).length > 1 ? [nums(r.cells[1])[0], nums(r.cells[1])[1]] : [nums(r.cells[1])[0], nums(r.cells[1])[0]]) as [number, number] })),
    startItems: items.rows.map((r) => ({ cls: r.cells[0], w: Number(r.cells[1]), pct: { everyday: Number(r.cells[2]), C: Number(r.cells[3]), U: Number(r.cells[4]), R: Number(r.cells[5]), E: Number(r.cells[6]) } })),
    classJobs: jobs.rows.map((r) => ({ cls: Number(r.cells[0]), boosted: ticks(r.cells[1]), closed: ticks(r.cells[2]) })),
    classMoves: moves.rows.map((r) => ({ move: r.cells[0], cond: r.cells[1] })),
    regimes: reg.rows.map((r) => ({ regime: r.cells[0], examples: countries(r.cells[1]), noble: mult(r.cells[2])!, rich: mult(r.cells[3])!, bondless: mult(r.cells[4])!, climb: r.cells[5] })),
    raceRules: race.rows.map((r) => ({ case: r.cells[0], effect: r.cells[1] })),
    classNames: CLS,
  };
}

function income() {
  const f = E + '04-income-and-living.md';
  const inc = findTable(f, /รายได้ของอาชีพ/, 'ส่วน');
  const cat = findTable(f, /รายได้ของอาชีพ/, 'หมวด (ตาม [../character/09-jobs-common.md](../character/09-jobs-common.md))');
  const special = findTable(f, /รายได้ของอาชีพ/, 'อาชีพ');
  const noble = findTable(f, /ขุนนางและผู้ถือที่ดิน/, 'ฐานะ');
  const live = findTable(f, /ค่าครองชีพ/, 'ชั้น');
  const taxT = findTable(f, /ภาษีและค่าธรรมเนียม/, 'ระบอบ');
  const poor = findTable(f, /ความจน/, 'ทาง');
  const bank = findTable(f, /ธนาคารและหนี้/, 'บริการ');
  const price = findTable(f, /ราคาของ/, 'หมวด');
  const shop = findTable(f, /ราคาของ/, 'ขนาดเมือง');
  const gold = findTable(f, /ทองที่คาดว่า/, 'W');
  const baseRow = row(inc, 'ฐานของอาชีพ');
  const base: Record<string, number> = {};
  for (const m of baseRow[1].matchAll(/([CURE])\s+(\d+)/g)) base[m[1]] = Number(m[2]);
  const mRow = row(inc, 'การใช้เงิน');
  const moneyUse: Record<string, number> = { full: mult(mRow[1].match(/เต็ม\s*×[\d.]+/)![0])!, mixed: mult(mRow[1].match(/ผสม\s*×[\d.]+/)![0])!, little: mult(mRow[1].match(/น้อย\s*×[\d.]+/)![0])! };
  const cRow = row(inc, 'ชนชั้น')[1];
  const classMul = { bondless: mult(cRow.match(/ผู้ไร้สิทธิ์\s*×[\d.]+/)![0])!, low: mult(cRow.match(/ล่าง\s*×[\d.]+/)![0])!, common: mult(cRow.match(/สามัญ\s*×[\d.]+/)![0])!, rich: mult(cRow.match(/มั่งคั่ง\s*×[\d.]+/)![0])! };
  const sw = [...row(inc, 'ผันผวนต่อปี')[1].matchAll(/×([\d.]+)/g)].map((m) => Number(m[1]));
  const wIdx = nums(row(inc, 'ดัชนีรายได้')[1].replace(/\(.*\)/, ''));
  const bankText = bank.rows.map((r) => r.cells[1]).join(' ');
  const rate = (p: string) => bank.rows.find((r) => r.cells[0].startsWith(p))!.cells[1];
  const rates = [...rate('ดอกเบี้ยกู้').matchAll(/ชั้น\s*([\d\s]+(?:ถึง\s*\d+)?)\s*ปีละ\s*(\d+)%/g)].map((m) => ({ classes: m[1].trim(), rate: Number(m[2]) / 100 }));
  const gnum = (s: string) => Number(s.replace(/,/g, ''));
  void bankText;
  const goldRows = gold.rows.map((r) => ({ w: Number(r.cells[0]), p25: gnum(r.cells[1]), p50: gnum(r.cells[2]), p90: gnum(r.cells[3]) }));
  const taxRates = (s: string) => [...s.matchAll(/(\d+)%/g)].map((m) => Number(m[1]) / 100);
  return {
    base,
    wIncomeIndex: wIdx,
    moneyUse,
    classMul,
    swing: [sw[0], sw[1]] as [number, number],
    jobCategories: cat.rows.map((r) => ({ category: r.cells[0], mul: mult(r.cells[1])!, note: r.cells[2] ?? '' })),
    jobSpecial: special.rows.map((r) => ({ jobs: ticks(r.cells[0]), rule: r.cells[1] })),
    nobleIncome: noble.rows.map((r) => ({ rank: r.cells[0], income: /\d+ ถึง \d+/.test(r.cells[1]) ? ([nums(r.cells[1])[0], nums(r.cells[1])[1]] as [number, number]) : null, upkeep: pct(r.cells[2]), text: r.cells[1] })),
    living: live.rows.map((r) => ({ cls: r.cells[0], cost: [nums(r.cells[1])[0], nums(r.cells[1])[1] ?? nums(r.cells[1])[0]] as [number, number] })),
    tax: taxT.rows.map((r) => ({ regime: r.cells[0], text: r.cells[1], rates: taxRates(r.cells[1]) })),
    poverty: poor.rows.map((r) => ({ path: r.cells[0], weight: num(r.cells[1])!, text: r.cells[1] + ' | ' + r.cells[2] })),
    bank: bank.rows.map((r) => ({ service: r.cells[0], rule: r.cells[1] })),
    interestByClass: rates,
    moneylender: [nums(rate('ผู้ปล่อยกู้'))[0] / 100, nums(rate('ผู้ปล่อยกู้'))[1] / 100] as [number, number],
    depositRate: (pct(rate('ฝากทอง')) ?? 0.01) * 1,
    loanCapIncomeMul: Number(must(rate('กู้').match(/ไม่เกิน\s*(\d+)\s*เท่า/), 'loan cap')[1]),
    prices: price.rows.map((r) => ({ cat: r.cells[0], byTier: Object.fromEntries(TIERS.map((t, i) => [t, cellPrice(r.cells[i + 1] ?? '')])) })),
    shopTiers: shop.rows.map((r) => ({ size: r.cells[0], maxTier: r.cells[1], sells: r.cells[2] })),
    goldAt30: goldRows,
  };
}

function trade() {
  const f = E + '05-trade.md';
  const all = tables(f);
  const ways = all.find((t) => t.header[0] === 'ทาง')!;
  return { ways: ways.rows.map((r) => r.cells), raw: all.map(raw) };
}

function investment() {
  const f = E + '06-investment.md';
  const ch = findTable(f, /เก้าช่องทาง/, 'ช่องทาง');
  const ret = findTable(f, /ผลตอบแทนต่อปี/, 'ส่วน');
  const dec = findTable(f, /การตัดสินใจของตัวละคร/, 'นิสัย');
  const bk = findTable(f, /ล้มละลายและหนี้/, 'สถานการณ์');
  const ov = findTable(f, /กันเงินล้น/, 'กติกา');
  const pf = findTable(f, /ตัวอย่างพอร์ต/, 'ตัวละคร');
  const reg = row(ret, 'ดัชนีภูมิภาค')[1];
  const region = [...reg.matchAll(/W\s*(\d)(?:\s*ถึง\s*(\d))?\s*×([\d.]+)(?:\s*และ σ\s*×([\d.]+))?/g)].flatMap((m) => {
    const lo = Number(m[1]);
    const hi = m[2] ? Number(m[2]) : lo;
    const out = [] as { w: number; mul: number; sigmaMul: number }[];
    for (let w = lo; w <= hi; w++) out.push({ w, mul: Number(m[3]), sigmaMul: m[4] ? Number(m[4]) : 1 });
    return out;
  });
  const skill = [...row(ret, 'ตัวคูณฝีมือ')[1].matchAll(/(?:`?([a-z_]+)`?|(ผู้ที่ใช้ผู้จัดการ NPC)[^×]*)\s*×([\d.]+)/g)].map((m) => ({ who: m[1] ?? 'manager', mul: Number(m[3]) }));
  const ovRow = row(ov, 'ผลตอบแทนลดเมื่อทุนมาก')[1];
  const ovN = nums(ovRow.replace(/×/g, ' '));
  const over = [{ over: ovN[0], mul: ovN[1] }, { over: ovN[2], mul: ovN[3] }];
  const text = readDoc(f);
  void text;
  return {
    channels: ch.rows.map((r) => {
      const m = r.cells[2].match(/(\d+)%(?:\s*ถึง\s*(\d+)%)?/);
      const lo = Number(m![1]) / 100;
      return { name: r.cells[0], minCapital: num(r.cells[1])!, mean: [lo, m![2] ? Number(m![2]) / 100 : lo] as [number, number], sigma: (pct(r.cells[3]) ?? 0) * 1, risk: r.cells[4], cond: r.cells[5] };
    }),
    region,
    skillMul: skill,
    decisions: dec.rows.map((r) => ({ traits: ticks(r.cells[0]), allocation: r.cells[1] })),
    bankruptcy: bk.rows.map((r) => ({ situation: r.cells[0], result: r.cells[1] })),
    overflow: over,
    propertyTax: Number(must(row(ov, 'ภาษีทรัพย์สิน')[1].match(/(\d+)%/), 'property tax')[1]) / 100,
    managerFee: Number(must(row(ov, 'ค่าบริหาร')[1].match(/(\d+)%/), 'manager fee')[1]) / 100,
    nobleBuy: must(nums(row(ov, 'ซื้อยศและตำแหน่ง')[1]).find((x) => x >= 1000), 'noble buy gold'),
    portfolios: pf.rows.map((r) => r.cells),
  };
}

function history() {
  const f = E + '07-economic-history.md';
  const pw = findTable(f, /แปดอำนาจ/, 'อำนาจ');
  const ll = findTable(f, /สี่เส้นเลือด/, 'สาย');
  const tn = findTable(f, /ห้าแรงตึง/, 'แรงตึง');
  const wn = findTable(f, /ใครได้ใครเสีย/, 'เหตุการณ์');
  return { powers: pw.rows.map((r) => r.cells), lifelines: ll.rows.map((r) => r.cells), tensions: tn.rows.map((r) => r.cells), winners: wn.rows.map((r) => r.cells) };
}

function implementation(invCounts: Record<string, number>) {
  const f = E + '08-implementation.md';
  const code = findTable(f, /โค้ดมีอะไรอยู่แล้ว/, 'ส่วน');
  const patch = findTable(f, /จุดที่ต้องแก้ในโค้ด/, 'จุด');
  const tests = findTable(f, /การทดสอบ/, 'ตัวชี้วัด');
  const risks = findTable(f, /ความเสี่ยงและวิธีลด/, 'เสี่ยง');
  const steps = section(f, /ลำดับทำ/).filter((l) => /^\d+\.\s+\*\*P\d/.test(l)).map((l) => {
    const m = l.match(/^\d+\.\s+\*\*(P\d)\s+(.+?)\*\*\s*(.*)$/)!;
    return { id: m[1], name: m[2], text: m[3] };
  });
  if (steps.length !== 8 || steps[0].id !== 'P0' || steps[7].id !== 'P7') throw new Error('economy: expected steps P0..P7, got ' + steps.map((s) => s.id));
  const loop = section(f, /ลูปประจำปี/).join('\n').match(/^\s+\d\.\s.*$/gm)!.map((l) => l.trim());
  const tgt = (p: string) => must(tests.rows.find((r) => r.cells[0].startsWith(p)), p).cells;
  const g30 = tgt('ทองมัธยฐานที่อายุ 30');
  const w30: Record<string, number> = {};
  for (const m of g30[1].matchAll(/W\s*(\d)\s*ราว\s*(\d+)/g)) w30[m[1]] = Number(m[2]);
  const band = nums(steps[2].text.match(/ราว\s*(\d+)\s*ถึง\s*(\d+)/)![0]);
  const ratio = nums(tgt('อัตราทองเข้า')[1]);
  const bankrupt = nums(tgt('สัดส่วนที่ล้มละลาย')[1]);
  const climb = nums(tgt('สัดส่วนที่ขึ้นชั้น')[1]);
  const tradeCap = nums(tgt('กำไรจากการค้า')[1]);
  const priceYear = nums(tgt('ความเสถียรของราคา')[1]);
  const gap = nums(tgt('ความต่างระหว่างประเทศ')[1]);
  void invCounts;
  return {
    steps,
    loop,
    code: code.rows.map((r) => ({ part: r.cells[0], where: r.cells[1], state: r.cells[2] })),
    patches: patch.rows.map((r) => ({ spot: r.cells[0], task: r.cells[1] })),
    targets: tests.rows.map((r) => ({ metric: r.cells[0], target: r.cells[1], how: r.cells[2] })),
    risks: risks.rows.map((r) => ({ risk: r.cells[0], mitigation: r.cells[1] })),
    sim: { goldAt30: w30, medianBand: [band[0], band[1]] as [number, number], bankruptcy: [bankrupt[0] / 100, bankrupt[1] / 100] as [number, number], classClimb: climb[climb.length - 1] / 100, tradeProfitCap: tradeCap[0] / 100, priceYearMax: priceYear[0], borderGap: [gap[0] / 100, gap[1] / 100] as [number, number], inOutRatio: [ratio[0], ratio[1]] as [number, number] },
  };
}

export default function run() {
  const tr = trust();
  const wd = world();
  const cc = countriesAndClasses();
  const inc = income();
  const tdr = trade();
  const inv = investment();
  const his = history();
  const impl = implementation({});
  const rawAll: RawTable[] = [];
  for (const file of listDocs('docs/systems/economy')) {
    if (/09-audit|10-bondage|02-countries/.test(file)) continue;
    for (const t of tables(file)) rawAll.push(raw(t));
  }
  for (const t of tables(E + '02-countries.md').filter((x) => /ตัวชี้วัด|ผลของระดับ W/.test(x.headings.join(' ')))) rawAll.push(raw(t));
  const { classNames, ...ccRest } = cc;
  void classNames;
  const data: EconomyData = {
    counts: { goods: wd.goods.length, routes: wd.routes.length, worldEvents: wd.worldEvents.length, classes: cc.classes.length, classByWG: cc.classByWG.length, startItems: cc.startItems.length, regimes: cc.regimes.length, channels: inv.channels.length, steps: impl.steps.length, tables: rawAll.length },
    trust: tr,
    ...wd,
    ...ccRest,
    income: inc,
    trade: tdr,
    investment: inv,
    history: his,
    implementation: impl,
    raw: rawAll,
  };
  writeGen('economy', data, [...listDocs('docs/systems/economy').filter((f) => !/09-audit|10-bondage/.test(f))], GEN);
  return finish('economy', ['economy.json'], un);
}
