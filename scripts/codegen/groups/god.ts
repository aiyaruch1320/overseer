// God generator (code-plan §5.1, row "พระเจ้า"): prices and caps, income, belief, the chest, dreams, whispers, prayers,
// the 25 miracles, ruins, conjuring (48 cells), vows, epithets. Writes data/gen/god.json.
// Every number sim-god.mjs reads is here; numbers that only the sim or the old POC code had are marked `assumed` or `legacy`.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { GodData, Miracle, RawTable } from '../../../src/core/data/types-god';
import { dash, findTable, finish, mult, num, nums, parts, pct, recs, section, src, tagsOf, ticks, tables, Unparsed } from '../helpers-m0b';
import { listDocs, root, writeGen } from '../lib/table';
import type { Table } from '../lib/table';

const G = 'docs/systems/god/';
const un = new Unparsed('god');
const GEN = 'scripts/codegen/groups/god.ts';
const TIERS = ['C', 'U', 'R', 'E', 'L'] as const;

const THAI_N: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10 };
/** First number in a cell, written with digits or a Thai number word. */
const thaiNum = (s: string): number | null => {
  const d = s.match(/\d+(?:\.\d+)?/);
  const w = s.match(/สิบ|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า/);
  if (d && (!w || (d.index ?? 0) < (w.index ?? 0))) return Number(d[0]);
  return w ? THAI_N[w[0]] : null;
};
const row = (t: Table, prefix: string) => {
  const r = t.rows.find((x) => x.cells[0].startsWith(prefix));
  if (!r) throw new Error(`row not found: ${t.file} "${prefix}"`);
  return r.cells;
};
const must = <T>(v: T | null | undefined, what: string): T => {
  if (v == null) throw new Error('god: missing ' + what);
  return v;
};
const raw = (t: Table): RawTable => ({ headings: t.headings.slice(1), header: t.header, rows: t.rows.map((r) => r.cells), src: `${t.file}:${t.line}` });

// ---------- 01-power ----------
function power() {
  const f = G + '01-power.md';
  const vars = findTable(f, null, 'ชื่อในไฟล์นี้');
  const inc = findTable(f, /รายได้/, 'แหล่ง');
  const price = findTable(f, /ราคา/, 'การแทรกแซง', 0);
  const price2 = findTable(f, /ราคา/, 'การแทรกแซง', 1);
  const mods = findTable(f, /ราคา/, 'เงื่อนไข');
  const bel = findTable(f, /ผลต่อศรัทธาเทพ/, 'เหตุ');
  const bands = findTable(f, /ผลต่อศรัทธาเทพ/, 'ช่วง');
  const caps = findTable(f, /เพดานและจังหวะ/, 'การแทรกแซง');
  const gen = findTable(f, /ข้ามรุ่น/, 'สิ่ง');
  const epi = findTable(f, /ฉายา/, 'ฉายา');
  const text = section(f, /รายได้/).join('\n');
  const start = text.match(/แสงศรัทธา\s*(\d+)\s*ความหวาดกลัว\s*(\d+)\s*ทั้งสองมีเพดาน\s*(\d+)/);
  if (!start) throw new Error('god: start power sentence changed');

  const base = row(inc, 'ฐาน');
  const ch = row(inc, 'ศรัทธาตรง');
  const bel1 = row(inc, 'ศรัทธาเทพของตัวละคร');
  const prophet = row(inc, 'ตัวละครเป็นศาสดา');
  const grant = row(inc, 'ตอบคำอธิษฐาน');
  const punish = row(inc, 'ลงโทษผู้ขอ');
  const destroy = row(inc, 'ปาฏิหาริย์สายทำลาย');
  const gd04 = row(inc, 'GD-04');
  const gd05 = row(inc, 'GD-05');
  const prices: GodData['prices']['byTier'] = [];
  for (const r of price.rows) {
    const key = { พร: 'bless', คำสาป: 'curse', ฝีมือ: 'skill', ของ: 'item', 'อาวุธประทาน (ศักดิ์สิทธิ์)': 'holyWeapon', อาวุธต้องสาป: 'cursedWeapon' }[r.cells[0].replace(/\s*\(.*\)$/, '') === 'อาวุธประทาน' ? 'อาวุธประทาน (ศักดิ์สิทธิ์)' : r.cells[0].replace(/\s*\(เลื่อน.*\)|\s*\(เกราะ.*\)/, '')];
    if (!key) continue;
    const byTier: Record<string, number | null> = {};
    if (key === 'skill') {
      const n = nums(r.cells[1]);
      byTier.C = n[1];
      byTier.U = n[3];
      byTier.R = n[5];
      byTier.E = n[7];
      byTier.L = null;
    } else TIERS.forEach((t, i) => (byTier[t] = /^\d/.test(r.cells[i + 1]) ? Number(r.cells[i + 1]) : null));
    prices.push({ key, byTier, pay: r.cells[6].includes('ความหวาดกลัว') ? 'dread' : 'faith', src: src(price, r.line) });
  }
  const reroll = nums(row(price2, 'ทอยหีบใหม่')[1]).slice(0, 3);
  const dream = nums(row(price2, 'เข้าฝัน')[1]);
  const whisper = row(price2, 'กระซิบ')[1];
  const whisperCheap = ticks(whisper.split('·')[0]);
  const whisperDear = ticks(whisper.split('·')[1] ?? '');
  const grantRange = nums(row(price2, 'ตอบคำอธิษฐาน')[1]);
  const revive = nums(row(price2, 'ปลุกชีพ')[1]);
  const fate = row(price2, 'เปลี่ยนชะตา')[1];
  const fateN = nums(fate);
  const mod = (p: string) => mods.rows.find((r) => r.cells[0].startsWith(p))!.cells;
  const bm = (p: string) => bel.rows.find((r) => r.cells[0].startsWith(p))!.cells[1];
  const bnums = (p: string) => nums(bm(p));
  const capNum = (p: string) => caps.rows.find((r) => r.cells[0].startsWith(p))!.cells[1];
  const miracleCap = capNum('ปาฏิหาริย์');
  const cap = (re: RegExp) => Number(must(miracleCap.match(re), 'miracle cap ' + re)[1]);
  const gnum = (p: string) => gen.rows.find((r) => r.cells[0].startsWith(p))!.cells[1];
  const epiRows = epi.rows.map((r) => ({ title: r.cells[0], cond: r.cells[1], src: src(epi, r.line) }));
  const epiParams: Record<string, Record<string, number>> = {
    'ผู้ให้แสง': { ratio: 3, belief: 50 },
    'ผู้คุ้มครองเงียบ': { maxSpent: 60 },
    'ผู้พิพากษา': { beliefMin: 0 },
    'ผู้ทำลาย': { bigDestroys: 2 },
    'ผู้ถูกชิงชัง': { belief: -70 },
    'ผู้ลิขิต': { starFates: 1 },
  };
  for (const e of epiRows) {
    const p = epiParams[e.title];
    if (!p) throw new Error('god: new epithet ' + e.title);
    const ns = nums(e.cond);
    for (const v of Object.values(p)) if (!ns.includes(v) && v !== 0 && v !== 1 && v !== 2) throw new Error(`god: epithet ${e.title} param ${v} not in "${e.cond}"`);
  }
  return {
    vars: recs(vars, ['name', 'code', 'range', 'owner']).map((r) => ({ name: r.name.replace(/\*/g, ''), key: ticks(r.code)[0], min: nums(r.range)[0], max: nums(r.range)[1], owner: r.owner })),
    start: { faith: Number(start[1]), dread: Number(start[2]), cap: Number(start[3]) },
    income: {
      base: { faith: num(base[1])!, dread: num(base[2])! },
      channelDiv: nums(ch[1])[0],
      beliefDiv: { faith: nums(bel1[1])[0], dread: nums(bel1[2])[0] },
      beliefMax: { faith: nums(bel1[1])[1], dread: nums(bel1[2])[1] },
      prophet: num(prophet[1])!,
      prayerGrant: num(grant[1])!,
      punishGain: [nums(punish[2])[0], nums(punish[2])[1]] as [number, number],
      destroyReturnDiv: nums(destroy[2])[0],
      gd04: mult(gd04[1])!,
      gd05: mult(gd05[1])!,
      gd05Until: num(gd05[1].replace(/[×x]\s*[\d.]+/, ''))!,
      rows: inc.rows.map((r) => ({ source: r.cells[0], faith: r.cells[1], dread: r.cells[2], src: src(inc, r.line) })),
    },
    prices: {
      byTier: prices,
      reroll,
      dream: { first: dream[0], second: dream[1], step: dream[2] },
      whisper: { cheap: nums(whisper)[0], dear: nums(whisper)[1], cheapHints: whisperCheap, dearHints: whisperDear },
      prayerGrant: [grantRange[0], grantRange[1]] as [number, number],
      revive: { faith: revive[0], dread: revive[1] },
      fate: { good: fateN[0], bad: fateN[1], backfire: fateN[2] / 100 },
      mods: {
        beliefLow: { below: nums(mod('ศรัทธาเทพต่ำ')[0])[0], faithMul: mult(mod('ศรัทธาเทพต่ำ')[1])! },
        beliefHigh: { above: nums(mod('ศรัทธาเทพสูง')[0])[0], dreadMul: mult(mod('ศรัทธาเทพสูง')[1])! },
        switchLine: { belief: nums(mod('สลับสาย')[1])[0], cap: nums(mod('สลับสาย')[1])[1] },
        window: mult(mod('หน้าต่างพระเจ้า')[1])!,
        rows: mods.rows.map((r) => ({ cond: r.cells[0], effect: r.cells[1] })),
      },
    },
    belief: {
      bestow: { base: bnums('ได้รับพร')[0], perTier: bnums('ได้รับพร')[1] },
      curse: { base: -bnums('ได้รับคำสาป')[0], perTier: -bnums('ได้รับคำสาป')[1] },
      holyWeapon: bnums('อาวุธศักดิ์สิทธิ์')[0],
      cursedWeapon: bnums('อาวุธศักดิ์สิทธิ์')[1],
      cursedWeaponMercy: bnums('อาวุธศักดิ์สิทธิ์')[2],
      dream: { obey: bnums('ทำตามความฝัน')[0], misread: bnums('ทำตามความฝัน')[1], refuse: bnums('ทำตามความฝัน')[2] },
      prayer: { grant: bnums('คำอธิษฐาน')[0], devoutMul: bnums('คำอธิษฐาน')[1], deny: bnums('คำอธิษฐาน')[3], punish: bnums('คำอธิษฐาน')[4], ignore: bnums('คำอธิษฐาน')[5] },
      miracle: { createHere: bnums('ปาฏิหาริย์สายสร้าง')[0], destroyHere: bnums('ปาฏิหาริย์สายสร้าง')[1] },
      revive: { faith: bnums('ปลุกชีพ')[0], dread: bnums('ปลุกชีพ')[1] },
      fade: { quietYears: must(thaiNum(bel.rows.find((r) => r.cells[0].startsWith('ไม่มีการแทรกแซง'))!.cells[0]), 'fade years'), perYear: bnums('ไม่มีการแทรกแซง')[1] },
      rows: bel.rows.map((r) => ({ cause: r.cells[0], delta: r.cells[1], src: src(bel, r.line) })),
      bands: recs(bands, ['range', 'name', 'effect']).map((r) => {
        const n = nums(r.range);
        return { name: r.name, tag: ticks(r.name)[0] ?? ticks(r.effect)[0], min: /ลงไป/.test(r.range) ? -100 : n[0], max: /ขึ้นไป/.test(r.range) ? 100 : /ลงไป/.test(r.range) ? n[0] : n[1], effect: r.effect };
      }),
    },
    caps: {
      chestPerYear: 1,
      chestWindowBonus: 1,
      dreamPerYear: must(thaiNum(capNum('เข้าฝัน')), 'dream cap'),
      whisperPerYear: must(thaiNum(capNum('กระซิบ')), 'whisper cap'),
      prayersPending: must(thaiNum(capNum('คำอธิษฐาน')), 'prayer cap'),
      prayerExpiryTicks: nums(capNum('คำอธิษฐาน'))[0],
      miraclePerLife: { mid: cap(/กลาง\s*(\d+)/), big: cap(/ใหญ่\s*(\d+)/), ruinOfBig: cap(/ทำให้เป็นซากได้\s*(\d+)/), grand: cap(/มหา\s*(\d+)/), conjure: cap(/เสกตามใจ\s*(\d+)/) },
      giftedWeapon: must(thaiNum(capNum('อาวุธประทาน')), 'weapon cap'),
      giftedItems: must(thaiNum(capNum('ของประทานที่ไม่ใช่อาวุธ')), 'item cap'),
      rows: caps.rows.map((r) => ({ what: r.cells[0], cap: r.cells[1] })),
    },
    heirs: { powerShare: pct(gnum('พลังที่เหลือ'))!, beliefShare: pct(gnum('ศรัทธาเทพของทายาท'))!, bloodlineMul: nums(gnum('พรสายเลือด'))[0], bloodlineOdds: [1, 0.6, 0.3], uncurseMul: nums(gnum('ถอนคำสาป'))[0], rows: gen.rows.map((r) => ({ what: r.cells[0], rule: r.cells[1] })) },
    epithets: epiRows.map((e) => ({ ...e, params: epiParams[e.title] })),
  };
}

// ---------- 02-bestow ----------
function chest() {
  const f = G + '02-bestow.md';
  const slots = findTable(f, /หกช่อง/, 'ช่อง');
  const filt = findTable(f, /ตัวกรอง/, 'ตัวกรอง');
  const mul = findTable(f, /การสุ่ม/, 'เงื่อนไข');
  const act = findTable(f, /เลือก ทอยใหม่/, 'การกระทำ');
  const wp = findTable(f, /อาวุธประทาน/, 'กติกา');
  const ex = findTable(f, /ตัวอย่าง/, 'ช่อง');
  const text = section(f, /การสุ่ม/).join('\n');
  const w = must(text.match(/C\s*(\d+)\s*·\s*U\s*(\d+)\s*·\s*R\s*(\d+)\s*·\s*E\s*([\d.]+)\s*·\s*L\s*([\d.]+)/), 'chest tier weights');
  const comp = must(text.match(/เริ่มที่\s*[−-](\d+)%.*?เพิ่ม\s*\+(\d+)%/s), 'compensator');
  const base = must(text.match(/C\s*([\d.]+)%\s*·\s*U\s*([\d.]+)%\s*·\s*R\s*([\d.]+)%\s*·\s*E\s*([\d.]+)%\s*·\s*L\s*([\d.]+)%/), 'chest base chances');
  const slotDef = [
    { slot: 1, kind: 'bless' },
    { slot: 2, kind: 'bless' },
    { slot: 3, kind: 'curse' },
    { slot: 4, kind: 'curse' },
    { slot: 5, kind: 'skill' },
    { slot: 6, kind: 'item' },
  ];
  const rowsMul = mul.rows.map((r) => ({ cond: r.cells[0], mult: mult(r.cells[1])!, src: src(mul, r.line) }));
  const keys = ['story', 'job', 'home', 'event', 'lateTier', 'belief', 'combatCurse'];
  return {
    slots: [...slotDef.map((s) => ({ ...s, src: src(slots, slots.rows[s.slot <= 2 ? 0 : s.slot <= 4 ? 1 : s.slot - 3].line), pool: slots.rows[s.slot <= 2 ? 0 : s.slot <= 4 ? 1 : s.slot - 3].cells[2], ifEmpty: slots.rows[s.slot <= 2 ? 0 : s.slot <= 4 ? 1 : s.slot - 3].cells[3] }))],
    filters: filt.rows.map((r) => ({ key: r.cells[0], rule: r.cells[1] })),
    tierWeights: { C: Number(w[1]), U: Number(w[2]), R: Number(w[3]), E: Number(w[4]), L: Number(w[5]) },
    multipliers: rowsMul.map((m, i) => ({ id: keys[i] ?? 'm' + i, ...m })),
    lateTierFrom: 3,
    compensator: { start: -Number(comp[1]), step: Number(comp[2]), baseChance: { C: Number(base[1]), U: Number(base[2]), R: Number(base[3]), E: Number(base[4]), L: Number(base[5]) }, appliesTo: 'R' },
    actions: act.rows.map((r) => ({ action: r.cells[0].replace(/\*/g, ''), rule: r.cells[1] })),
    rerollExtraLock: 5,
    weapon: wp.rows.map((r) => ({ key: r.cells[0], value: r.cells[1] })),
    weaponMult: { job: 3, country: 2 },
    example: ex.rows.map((r) => ({ slot: r.cells[0], id: ticks(r.cells[1])[0], tier: r.cells[2], price: r.cells[3], why: r.cells[4] })),
    minAgeForWeapon: 13,
    levelLGate: { bless: 50, curse: -30 },
  };
}

// ---------- 03-dreams ----------
function dreams() {
  const f = G + '03-dreams.md';
  const srcT = findTable(f, /ทางทั้งสาม/, 'แหล่ง');
  const parts2 = findTable(f, /ประกอบด้วย/, 'ส่วน');
  const fit = findTable(f, /ความเชื่อฟัง/, 'ส่วน');
  const lv = findTable(f, /ความเชื่อฟัง/, 'ระดับ');
  const guard = findTable(f, /ความเชื่อฟัง/, 'กติกา');
  const out = findTable(f, /ผลเมื่อตื่น/, 'ผล');
  const burden = findTable(f, /ผลเมื่อตื่น/, 'ผลของเหตุการณ์ภาระใจ (สุ่มตามนิสัย)');
  const special = findTable(f, /จังหวะพิเศษ/, 'จังหวะ');
  const whisper = findTable(f, /กระซิบ/, 'คำใบ้');
  const prayer = findTable(f, /คำอธิษฐาน/, 'คำตอบ');
  const text = section(f, /ความเชื่อฟัง/).join('\n');
  const formula = must(text.match(/\*\*โอกาสทำตาม\*\*\s*=\s*([\d.]+)\s*\+\s*ศรัทธาเทพ\s*÷\s*(\d+).*?([\d.]+)\s*ถึง\s*([\d.]+)/s), 'obey formula');
  const fitRow = row(fit, 'ความเข้ากัน');
  const clarRow = row(fit, 'ความชัด');
  const fn = nums(fitRow[1].replace(/ทางตรงกับนิสัยสองข้อขึ้นไป/, ''));
  const cn = nums(clarRow[1].replace(/\(int − 10\)/, ''));
  const gRow = row(guard, 'ตัวกันโชคร้าย');
  const burdenText = section(f, /ผลเมื่อตื่น/).join('\n');
  const bur = must(burdenText.match(/ภาระใจ.*?\+(\d+)\s*ครบ\s*(\d+)/s), 'burden rule');
  const mulOf = (r: string) => mult(out.rows.find((x) => x.cells[0].includes(r))!.cells[2]);
  const whisperRows = recs(whisper, ['hint', 'effect', 'src']);
  const price2 = findTable(G + '01-power.md', /ราคา/, 'การแทรกแซง', 1);
  const wcell = row(price2, 'กระซิบ')[1];
  const dearHints = ticks(wcell.split('·')[1] ?? '');
  const cheapHints = ticks(wcell.split('·')[0]);
  return {
    sources: srcT.rows.map((r) => ({ id: r.cells[0].match(/^S\d/)![0], name: r.cells[0].replace(/^S\d\s*/, ''), paths: r.cells[1], effect: r.cells[2], mult: mult(r.cells[2]), src: src(srcT, r.line) })),
    parts: parts2.rows.map((r) => ({ part: r.cells[0], from: r.cells[1] })),
    symbols: 12,
    obey: { base: Number(formula[1]), beliefDiv: Number(formula[2]), clamp: [Number(formula[3]), Number(formula[4])] as [number, number], fit: { twoTraits: fn[0], oneTrait: fn[1], against: fn[2], immoral: fn[3] }, clarity: { perInt: cn[0], oracle: cn[1], whisper: cn[2], repeat: cn[3], punished: cn[4] }, repeatYears: 3, punishedYears: 5 },
    levels: lv.rows.map((r) => ({ name: r.cells[0], min: /ต่ำกว่า/.test(r.cells[1]) ? 0 : nums(r.cells[1])[0], max: /ต่ำกว่า/.test(r.cells[1]) ? Math.round((nums(r.cells[1])[0] - 0.01) * 100) / 100 : /ขึ้นไป/.test(r.cells[1]) ? 1 : nums(r.cells[1])[1], look: r.cells[2] })),
    luckGuard: { fails: nums(gRow[1])[0] === undefined ? 2 : 2, bonus: must(nums(gRow[1]).find((x) => x === 0.15), 'luck guard bonus'), level: 'เต็มใจ' },
    outcomes: out.rows.map((r) => ({ id: { ทำตาม: 'obey', ตีความผิด: 'misread', ปฏิเสธ: 'refuse', ขัดขืน: 'defy' }[r.cells[0].replace(/\*/g, '')]!, name: r.cells[0].replace(/\*/g, ''), cond: r.cells[1], result: r.cells[2], pathMul: mulOf(r.cells[0].replace(/\*/g, '')) , src: src(out, r.line) })),
    misreadShare: 0.5,
    defyBelief: -30,
    burden: { step: Number(bur[1]), at: Number(bur[2]), relief: 0, events: burden.rows.map((r) => ({ name: r.cells[0], effect: r.cells[1] })) },
    special: special.rows.map((r) => ({ moment: r.cells[0], rule: r.cells[1] })),
    whispers: whisperRows.map((r) => ({ hint: r.hint.replace(/\s*\(.*\)$/, ''), id: r.hint, cost: dearHints.includes(r.hint.replace(/\s*\(.*\)$/, '')) ? 8 : 5, effect: r.effect, from: r.src })),
    whisperCostGroups: { cheap: cheapHints, dear: dearHints },
    prayerAnswers: prayer.rows.map((r) => ({ answer: r.cells[0].replace(/\*/g, ''), price: r.cells[1], effect: r.cells[2] })),
  };
}

// ---------- 03-dreams §7 prayers ----------
function prayers() {
  const f = G + '03-dreams.md';
  const kindsT = findTable(f, /คำอธิษฐาน 17 ชนิด/, 'รหัส');
  const tickT = findTable(f, /ตัวเกิดคำอธิษฐาน/, 'ค่า');
  const code = (c: string) => c.replace(/`/g, '').trim();
  const list: GodData['prayers']['kinds'] = kindsT.rows.map((r) => ({
    id: r.cells[0],
    weight: Number(r.cells[2]),
    icon: r.cells[3],
    grantCost: Number(r.cells[5]),
    grantFx: code(r.cells[6]),
    punishGain: Number(r.cells[7]),
    punishFx: code(r.cells[8]),
    trouble: r.cells[9] === 'ใช่',
  }));
  if (list.length !== 17) throw new Error('god: 03-dreams.md §7.1 should list 17 prayers, found ' + list.length);
  const tv = (label: RegExp) => {
    const row = tickT.rows.find((r) => label.test(r.cells[0]));
    if (!row) throw new Error('god: 03-dreams.md §7.2 has no row ' + label);
    return Number(row.cells[1].replace('−', '-').replace(/[^\d.\-]/g, ''));
  };
  return {
    source: 'docs/systems/god/03-dreams.md section 7.1 and 7.2',
    kinds: list,
    tick: {
      ticksPerYear: tv(/ช่วงเวลาต่อปีชีวิต/),
      base: tv(/โอกาสพื้นฐาน/),
      pietyDiv: tv(/แกนศรัทธา/),
      oracle: tv(/oracle/),
      troubleMul: tv(/คูณเมื่อมีชนิดความทุกข์/),
      troubleShare: tv(/สัดส่วนช่วงเวลา/),
      maxPending: tv(/ค้างพร้อมกัน/),
      expiryTicks: tv(/หมดเวลา/),
      repeatCooldownTicks: tv(/เกิดซ้ำได้หลังจาก/),
      silentBelow: tv(/ศรัทธาเทพต่ำกว่า/),
      assumedNote: 'troubleShare is an assumption of the simulator (03-dreams.md 7.2)',
    },
  };
}

// ---------- the numbers of the ruins, the seals and the grand miracles (04-miracles.md §3, §5) ----------
const MINUS = /[−\-]/;
const sgn = (s: string) => Number(s.replace('−', '-'));
/** The first group of a regexp over a text, or a loud failure: a change of the wording of the doc must not empty the data. */
const grab = (text: string, re: RegExp, what: string): RegExpMatchArray => must(text.match(re), 'ruin numbers: ' + what);

/** When a ruin event may happen, in years after the miracle (`ปีแรกหลัง` · `ภายในสองปี` · `สามถึงสิบปีหลัง` · `ห้าปีหลัง` · `40 ถึง 80 ปีหลัง`). */
function ruWindow(id: string, cond: string): { from: number; to: number | null } {
  const c = cond.split('·')[0].trim();
  let m: RegExpMatchArray | null;
  if (/^ปีแรกหลัง/.test(c)) return { from: 0, to: 1 };
  if ((m = c.match(/^ภายใน(\S+?)ปี/))) return { from: 0, to: must(thaiNum(m[1]), id + ' window') };
  if ((m = c.match(/^(\S+?)\s*ถึง\s*(\S+?)\s*ปีหลัง/))) return { from: must(thaiNum(m[1]), id + ' from'), to: must(thaiNum(m[2]), id + ' to') };
  if ((m = c.match(/^(\S+?)\s*ปีหลัง/))) return { from: must(thaiNum(m[1]), id + ' after'), to: null };
  if (/^หลัง MR-18/.test(c)) return { from: 0, to: null };
  throw new Error(`god: the time of ${id} cannot be read: "${cond}"`);
}

/** The places of the dragons (lore/dragons/README.md table "ที่อยู่"): the seals (04-miracles.md iron rule 3). */
function sealHomes(): { dragon: number; name: string; countries: string[]; faiths: string[] }[] {
  const t = findTable('docs/lore/dragons/README.md', null, '#');
  return t.rows.map((r) => ({
    dragon: Number(r.cells[0]) - 1,
    name: r.cells[1],
    countries: [...r.cells[3].matchAll(/[A-Z]{2}-\d{2}/g)].map((x) => x[0]),
    // the faiths that send faith to the dragon ("ศาสนาหลักที่ส่งศรัทธา"): words, a bracket is a note
    faiths: r.cells[4].replace(/\([^)]*\)/g, '').split(/\s+/).filter(Boolean),
  }));
}

// ---------- 04-miracles ----------
function miracles() {
  const f = G + '04-miracles.md';
  const lines = findTable(f, null, 'สาย');
  const rules = findTable(f, /กติกาเหล็ก/, 'ข้อ');
  const list = findTable(f, /รายการปาฏิหาริย์/, 'ปาฏิหาริย์');
  const fate = findTable(f, /ลิขิต/, 'กติกา');
  const imm = findTable(f, /ผลทันที/, 'สิ่ง');
  const ruins = findTable(f, /เหตุการณ์ของซาก/, 'เหตุการณ์');
  const seal = findTable(f, /หมุดผนึก/, 'ปาฏิหาริย์ที่ตก');
  const reply = findTable(f, /หมุดผนึก/, 'อารมณ์หลังโดน');
  const react = findTable(f, /ผู้เห็น/, 'ปาฏิหาริย์');
  const items: Miracle[] = list.rows.map((r) => {
    const id = must(r.cells[0].match(/MR-\d\d/), 'miracle id')[0];
    const name = r.cells[0].replace(/\*/g, '').replace(id, '').trim();
    const tierT = r.cells[1].split('·').map((x) => x.trim());
    const costCell = r.cells[2];
    const cost: Miracle['cost'] = {};
    const cd = costCell.split('·');
    const head = cd[0];
    if (/ทั้งหมดที่มี/.test(head)) {
      cost.faithAll = true;
      cost.faithMin = nums(head)[0];
    } else if (/แสงศรัทธา/.test(head)) cost.faith = num(head)!;
    else if (/ความหวาดกลัว/.test(head)) cost.dread = num(head)!;
    if (id === 'MR-25') {
      cost.fate = { star: 60, major: 30, minor: 15 };
      const ns = nums(costCell.split('·').slice(0, 3).join(' '));
      cost.fate = { star: ns[0], major: ns[1], minor: ns[2] };
    }
    const wait = /ครั้งเดียวต่อชีวิต/.test(costCell) || id === 'MR-25' ? null : cd[1] ? num(cd[1].replace(/\(.*\)/, '')) : null;
    const world = r.cells[4];
    const flagsSet = [...world.matchAll(/ธง\s*`(\w+)`(?!\s*หาย)/g)].map((m) => m[1]).filter((x) => !new RegExp('ธง\\s*`' + x + '`\\s*หาย').test(world));
    const flagsClear = [...world.matchAll(/ธง\s*`(\w+)`\s*หาย/g)].map((m) => m[1]);
    const mults = id === 'MR-25' ? [] : [...world.matchAll(/([฀-๿A-Za-z]+(?:\s*\([A-Z]\))?)\s*[×x]\s*([\d.]+)\s*(สอง|ห้า|สิบ|สาม)?\s*(ปี)?/g)].map((m) => ({ subject: m[1].trim(), mul: Number(m[2]), years: m[3] && m[4] ? ({ สอง: 2, สาม: 3, ห้า: 5, สิบ: 10 } as Record<string, number>)[m[3]] : undefined }));
    const wDeltas = [...world.matchAll(/W\s*([+\-−]\d)\s*(สอง|ห้า|สิบ|สามสิบ)?\s*(ปี|ถาวร)?/g)].map((m) => ({ delta: Number(m[1].replace('−', '-')), years: m[3] === 'ปี' && m[2] ? ({ สอง: 2, ห้า: 5, สิบ: 10 } as Record<string, number>)[m[2]] : undefined, permanent: m[3] === 'ถาวร' }));
    const faithDelta = [...world.matchAll(/ศรัทธา(ตรง|โลก)[^+−\-\d]*([+\-−]\d+)/g)].map((m) => ({ scope: m[1] === 'ตรง' ? 'country' : 'world', delta: Number(m[2].replace('−', '-')) }));
    const mood = world.match(/อารมณ์[^+−\-\d]*([+\-−]\d+)/);
    const defense = world.match(/ศึกป้องกันของประเทศ\s*\+(\d+)/);
    const newW = world.match(/ประเทศใหม่\s*W\s*(\d)/);
    const ruin = /ซากพระเจ้า/.test(world);
    const hasNumber = /\d/.test(world);
    if (hasNumber && !mood && !defense && !newW && !ruin && !flagsSet.length && !flagsClear.length && !mults.length && !wDeltas.length && !faithDelta.length) un.add(f, r.line, world, 'miracle world effect has a number but no parsed part');
    return {
      id,
      name,
      tier: tierT[0],
      target: tierT.slice(1).join(' · '),
      cost,
      wait,
      oncePerLife: /ครั้งเดียวต่อชีวิต/.test(costCell),
      immediate: r.cells[3],
      world,
      story: r.cells[5],
      flagsSet,
      flagsClear,
      mults,
      wDeltas,
      faithDelta,
      ...(mood ? { moodDelta: Number(mood[1].replace('−', '-')) } : {}),
      ...(defense ? { defenseBonus: Number(defense[1]) } : {}),
      ...(newW ? { newCountryW: Number(newW[1]) } : {}),
      ...(ruin ? { makesRuin: true } : {}),
      src: src(list, r.line),
    };
  });
  if (items.length !== 26 && items.length !== 25) throw new Error('god: miracle rows ' + items.length);
  // MR-25 appears twice in the doc (duplicate row); keep one
  const seen = new Set<string>();
  const uniq = items.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  const fnum = (p: string) => fate.rows.find((r) => r.cells[0].startsWith(p))!.cells[1];
  const fd = fnum('มังกรล้ม');
  const slow = must(fd.match(/ไม่ต่ำกว่า\s*[×x]([\d.]+)/), 'fate slow floor');
  const fast = must(fd.match(/ไม่เกิน\s*[×x]([\d.]+)/), 'fate fast cap');
  const dirText = fnum('ทิศ');
  const dr = [...dirText.matchAll(/[×x]([\d.]+)\s*ถึง\s*[×x]([\d.]+)/g)];
  const rule5 = rules.rows.find((r) => r.cells[0] === '5')!.cells[1];
  const rule6 = rules.rows.find((r) => r.cells[0] === '6')!.cells[1];
  const rule7 = rules.rows.find((r) => r.cells[0] === '7')!.cells[1];
  const ruinGap = must(rule5.match(/ห่างกันอย่างน้อย\s*(\d+)\s*ปีโลก/), 'ruin gap');
  const perWorld = must(rule6.match(/ใหญ่หนึ่งครั้งต่อ\s*(\d+)\s*ปีโลก\s*กลางหนึ่งครั้งต่อ(\S+)\s*ปีโลก/), 'per world caps');
  const THAI: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10 };
  const sealText = section(f, /หมุดผนึก/).join('\n');
  const capText = must(sealText.match(/ครั้งเดียวต่อ\s*(\d+)\s*ปีโลก\s*และหมุดใดก็ได้ทั้งโลกครั้งเดียวต่อ\s*(\d+)\s*ปีโลก/), 'seal caps');
  const replyRows = reply.rows.map((r) => ({ moodMin: r.cells[0].includes('ต่ำกว่า') ? 0 : nums(r.cells[0])[0], moodMax: r.cells[0].includes('ต่ำกว่า') ? nums(r.cells[0])[0] - 1 : r.cells[0].includes('ขึ้นไป') ? 100 : nums(r.cells[0])[1], name: r.cells[1].match(/\*\*(.+?)\*\*/)?.[1] ?? '', effect: r.cells[1] }));
  const sealMood = seal.rows.map((r) => ({ falls: r.cells[0], country: r.cells[1], dragon: r.cells[2], other: r.cells[3], dragonMood: nums(r.cells[2])[0] }));

  // ----- the ruin, as numbers (§5.1), the cracked city (§5.4), the events of the ruin (§5.2) and the grand miracles -----
  const immCell = (what: string) => must(imm.rows.find((x) => x.cells[0].startsWith(what)), 'ruin row ' + what).cells[1];
  const popM = grab(immCell('ผู้คน'), /(\d+)%\s*ถึง\s*(\d+)%/, 'population');
  const npcM = grab(immCell('NPC ของประเทศ'), /ตาย\s*(\d+)\s*·\s*หนี[^\d]*(\d+)\s*·\s*อยู่[^\d]*(\d+)/, 'npc dice');
  const allyM = grab(immCell('พวกพ้อง'), /ตายเพียง\s*(\d+)/, 'ally dice');
  const mcM = grab(immCell('ตัวละครหลัก'), /`(\w+)`\s*(\d+)%\s*และศรัทธาเทพ\s*([−\-]\d+)/, 'main character');
  const econM = grab(immCell('เศรษฐกิจ'), /W เป็น\s*(\d+)[\s\S]*C\s*([−\-]\d+)/, 'economy');
  const faithM = grab(immCell('ศรัทธา'), /ข้างเคียง\s*([−\-]\d+)\s*ความหวาดกลัวของพระเจ้า\s*\+(\d+)[\s\S]*ศรัทธาเทพของตัวละคร\s*([−\-]\d+)/, 'faith');
  const exile = grab(section(f, /ซากกับเส้นเรื่องเดิม/).join('\n'), /nc_homeland_ghost`\s*(\d+)%/, 'exile curse');
  const crackText = seal.rows[1].cells[1];
  const crackBuild = grab(crackText, /อาคารพังราว\s*(\d+)%/, 'crack buildings');
  const crackPop = grab(crackText, /ประชากรเหลือ\s*(\d+)%/, 'crack population');
  const crackNpc = grab(crackText, /ตาย\s*(\d+)\s*หนี\s*(\d+)\s*อยู่\s*(\d+)/, 'crack npc');
  const crackW = grab(crackText, /W\s*([−\-]\d+)\s*(\S+)ปี/, 'crack W');
  const crackDragon = grab(seal.rows[1].cells[2], /อารมณ์\s*([−\-]\d+)\s*และเพดาน[^\d−\-]*([−\-]\d+)/, 'crack dragon');
  const crackOpens = [...seal.rows[1].cells[3].matchAll(/RU-\d\d/g)].map((x) => x[0]);
  const crackNot = seal.rows[1].cells[3].slice(seal.rows[1].cells[3].indexOf('ไม่เปิด') - 20);
  const crackShut = [...crackNot.matchAll(/RU-\d\d/g)].map((x) => x[0]);
  const wrathRow = list.rows.find((r) => r.cells[0].includes('MR-22'))!.cells;
  const wrathWar = grab(wrathRow[4], /ธง\s*`war`\s*หายทั้งทวีป(\S+?)ปี/, 'wrath war years');
  const wrathFaith = grab(wrathRow[4], /ศรัทธาตรงทั้งทวีป\s*([−\-]\d+)/, 'wrath faith');
  const wrathDread = grab(wrathRow[4], /ความหวาดกลัวรายปีของพระเจ้า\s*[×x](\d+)/, 'wrath dread');
  const wrathGd = grab(wrathRow[4], /GD-08\s*[×x]([\d.]+)/, 'wrath GD-08');
  const wrathMood = grab(seal.rows[2].cells[2], /อารมณ์ของทุกตัวในทวีป\s*([−\-]\d+)/, 'wrath mood');
  const floodRow = list.rows.find((r) => r.cells[0].includes('MR-19'))!.cells;
  const floodYears = grab(floodRow[3], /น้ำท่วม(\S+?)ปี/, 'flood years');
  const floodFood = grab(floodRow[4], /อาหารที่นั่น\s*[×x]([\d.]+)/, 'flood refugees');
  const landRow = list.rows.find((r) => r.cells[0].includes('MR-20'))!.cells;
  const landWithin = grab(landRow[4], /ภายใน\s*(\d+)\s*ปี/, 'land settlers');
  const ruText = new Map(ruins.rows.map((r) => [r.cells[0].replace(/\*/g, '').match(/RU-\d\d/)![0], r.cells]));
  const ruEvents = ruins.rows.map((r) => {
    const id = r.cells[0].replace(/\*/g, '').match(/RU-\d\d/)![0];
    const cond = r.cells[1];
    const w = ruWindow(id, cond);
    const dread = cond.match(/ความหวาดกลัวของพระเจ้า\s*≥\s*(\d+)/);
    return {
      id,
      name: r.cells[0].replace(/\*/g, '').replace(/RU-\d\d\s*/, ''),
      cond,
      what: r.cells[2],
      effect: r.cells[3],
      src: src(ruins, r.line),
      /** Years after the miracle it can happen: from, and to (null: stays open until the ruin is gone). */
      from: w.from,
      to: w.to,
      /** Only after this miracle (RU-01 the star) · only in a country with much rain (RU-08 after MR-17) · needs no war in the country (RU-07). */
      after: id === 'RU-01' ? ['MR-17'] : id === 'RU-08' ? ['MR-18', 'MR-17'] : ['MR-17', 'MR-18'],
      ...(dread ? { dreadMin: Number(dread[1]) } : {}),
      ...(/ไม่มีสงครามในประเทศ/.test(cond) ? { noWar: true } : {}),
      ...(/ฝนชุก/.test(cond) ? { rainy: true } : {}),
      ...(id === 'RU-05' ? { unlessCult: true } : {}),
      ...(/เปิดโหนด\s*`(mr\.\w+)`/.test(r.cells[3]) ? { opens: must(r.cells[3].match(/เปิดโหนด\s*`(mr\.\w+)`/), 'opens')[1] } : {}),
    };
  });
  void ruText;
  return {
    lines: lines.rows.map((r) => ({ line: r.cells[0], color: r.cells[1], pay: r.cells[2], examples: r.cells[3] })),
    ironRules: rules.rows.map((r) => ({ n: Number(r.cells[0]), rule: r.cells[1], why: r.cells[2] })),
    limits: {
      ruinGapYears: Number(ruinGap[1]),
      worldBigGapYears: Number(perWorld[1]),
      worldMidGapYears: THAI[perWorld[2]] ?? Number(perWorld[2]),
      gd08ThirdBigDestroy: 3,
      gd08Mul: mult(rule7.slice(rule7.indexOf('GD-08')))!,
    },
    list: uniq,
    fate: {
      rows: fate.rows.map((r) => ({ key: r.cells[0], rule: r.cells[1] })),
      slowRange: [Number(dr[0][1]), Number(dr[0][2])] as [number, number],
      fastRange: [Number(dr[1][1]), Number(dr[1][2])] as [number, number],
      dragonFloor: Number(slow[1]),
      dragonCap: Number(fast[1]),
      minCostShare: 0.5,
      maxYears: 10,
      lastEraForceStep: 1.25,
      lastEraForceCap: 2,
    },
    ruin: {
      immediate: imm.rows.map((r) => ({ what: r.cells[0], effect: r.cells[1] })),
      events: ruEvents,
      numbers: {
        pop: [Number(popM[1]), Number(popM[2])] as [number, number],
        npc: { die: Number(npcM[1]), flee: Number(npcM[2]), stay: Number(npcM[3]) },
        allyDie: Number(allyM[1]),
        mcCurse: { id: mcM[1], chance: Number(mcM[2]) },
        mcBelief: sgn(mcM[3]),
        exileCurseChance: Number(exile[1]),
        w: Number(econM[1]),
        trade: sgn(econM[2]),
        neighbourFaith: sgn(faithM[1]),
        dread: Number(faithM[2]),
        seenBelief: sgn(faithM[3]),
      },
    },
    seal: {
      hit: sealMood,
      reply: replyRows,
      anchorCdYears: Number(capText[1]),
      anyAnchorCdYears: Number(capText[2]),
      rows: seal.rows.map((r) => r.cells),
      homes: sealHomes(),
      keyCountry: must(sealText.match(/AL-01/), 'seal key country')[0],
      protectYears: must(Number(must(replyRows[0].effect.match(/อีก\s*(\d+)\s*ปีโลก/), 'protect years')[1]), 'protect'),
      midMood: sgn(must(seal.rows[0].cells[2].match(/อารมณ์\s*([−\-]\d+)/), 'mid mood')[1]),
      midWorshippers: sgn(must(seal.rows[0].cells[3].match(/ศรัทธาตรงต่อพระเจ้า\s*([−\-]\d+)/), 'mid worshippers')[1]),
      crack: {
        buildings: Number(crackBuild[1]),
        pop: Number(crackPop[1]),
        npc: { die: Number(crackNpc[1]), flee: Number(crackNpc[2]), stay: Number(crackNpc[3]) },
        w: sgn(crackW[1]),
        wYears: must(thaiNum(crackW[2]), 'crack W years'),
        mood: sgn(crackDragon[1]),
        capLoss: Math.abs(sgn(crackDragon[2])),
        opens: crackOpens.filter((x) => !crackShut.includes(x)),
        shut: crackShut,
      },
      concordia: sealText.includes('ความเชื่อมั่นทองกลาง C −20') ? { c: -20, le05Mul: 2, po08Mul: 2, years: 10 } : (() => { throw new Error('god: the AL-01 sentence changed'); })(),
    },
    grand: {
      wrath: { warYears: must(thaiNum(wrathWar[1]), 'wrath war years'), faith: sgn(wrathFaith[1]), dreadMul: Number(wrathDread[1]), gd08Mul: Number(wrathGd[1]), moodAll: sgn(wrathMood[1]) },
      flood: { years: must(thaiNum(floodYears[1]), 'flood years'), refugeeFood: Number(floodFood[1]) },
      land: { settleWithin: Number(landWithin[1]) },
    },
    reactions: react.rows.map((r) => ({ miracle: r.cells[0], country: r.cells[1], neighbors: r.cells[2], dread: r.cells[3] })),
  };
}

// ---------- 07-conjure ----------
function conjure() {
  const f = G + '07-conjure.md';
  const verbs = findTable(f, /ชิ้นส่วนสามชิ้น/, 'กริยา');
  const cores = findTable(f, /ชิ้นส่วนสามชิ้น/, 'แก่น');
  const scales = findTable(f, /ชิ้นส่วนสามชิ้น/, 'ขนาด');
  const fx = findTable(f, /ตารางผล/, 'กริยา \\ แก่น');
  const react = findTable(f, /ปฏิกิริยา/, 'ส่วนผสม');
  const shadowP = findTable(f, /เงาสะท้อน/, 'ขนาด');
  const shadowC = findTable(f, /เงาสะท้อน/, 'แก่น');
  const caps = findTable(f, /เพดาน/, 'กติกา');
  const VERB: Record<string, string> = { ให้กำเนิด: 'create', ทำลาย: 'destroy', เปลี่ยน: 'change', ปลุก: 'wake', สงบ: 'calm', เผย: 'reveal' };
  const CORE: Record<string, string> = { ไฟ: 'fire', น้ำ: 'water', ดิน: 'earth', ลม: 'wind', ชีวิต: 'life', ความตาย: 'death', แสง: 'light', เงา: 'shadow' };
  const cells: GodData['conjure']['cells'] = [];
  for (const r of fx.rows) {
    const verb = r.cells[0].replace(/\*/g, '');
    fx.header.slice(1).forEach((core, i) => {
      const text = r.cells[i + 1];
      const mr = [...new Set([...text.matchAll(/MR-\d\d/g)].map((m) => m[0]))];
      cells.push({ verb: VERB[verb], core: CORE[core], text, mr, pureMr: /^ใช้ MR-\d\d/.test(text) && !/หรือ/.test(text.split('·')[0]) ? mr[0] : undefined });
    });
  }
  if (cells.length !== 48) throw new Error('god: conjure cells ' + cells.length);
  const capRow = (p: string) => caps.rows.find((r) => r.cells[0].startsWith(p))!.cells[1];
  const sc = recs(scales, ['scale', 'target', 'tier', 'price']);
  const scKey: Record<string, string> = { คน: 'person', ถิ่น: 'place', ประเทศ: 'country', ทวีป: 'continent' };
  const sh = Object.fromEntries(shadowP.rows.map((r) => [scKey[r.cells[0]], pct(r.cells[1])!]));
  return {
    verbs: verbs.rows.map((r) => ({ id: VERB[r.cells[0]], name: r.cells[0], means: r.cells[1], pay: r.cells[2], payLine: r.cells[2].includes('แสงศรัทธา') ? 'faith' : r.cells[2].includes('ความหวาดกลัว') ? 'dread' : 'core' })),
    cores: cores.rows.map((r) => ({ id: CORE[r.cells[0]], name: r.cells[0], covers: r.cells[1] })),
    scales: sc.map((r) => ({ id: scKey[r.scale], name: r.scale, target: r.target, counts: r.tier, base: Number(r.price) })),
    cells,
    reactions: react.rows.map((r) => {
      const [v, c] = r.cells[0].split('·').map((x) => x.trim());
      return { verb: VERB[v] ?? v, core: CORE[c] ?? c ?? null, cond: r.cells[1], result: r.cells[2] };
    }),
    shadow: { chance: sh, byCore: shadowC.rows.map((r) => ({ core: CORE[r.cells[0]], text: r.cells[1] })) },
    caps: {
      perLife: num(capRow('จำนวน'))!,
      continentPerLife: 1,
      sameMixPerLife: 1,
      gapYears: num(capRow('ระยะรอ'))!,
      sameCountryGapYears: nums(capRow('เป้าหมายซ้ำ'))[0],
      firstLifeVerbs: ['create', 'destroy', 'calm'],
      firstLifeCores: ['fire', 'water', 'earth', 'life'],
      rows: caps.rows.map((r) => ({ key: r.cells[0], rule: r.cells[1] })),
    },
  };
}

// ---------- 08-goals ----------
function goals() {
  const f = G + '08-goals.md';
  const vows = findTable(f, /คำปฏิญาณของพระเจ้า/, 'รหัส');
  const vres = findTable(f, /คำปฏิญาณของพระเจ้า/, 'ผล');
  const titles = findTable(f, /ฉายาชีวิต/, 'ฉายา');
  const chrGain = findTable(f, /พงศาวดารสายตระกูล/, 'ได้จาก');
  const unlock = findTable(f, /พงศาวดารสายตระกูล/, 'ค่าสะสม');
  const rhythm = findTable(f, /จังหวะชะตา/, 'แบบ');
  const over = findTable(f, /ราคาของการแทรกแซงมากเกิน/, 'เงื่อนไข');
  const coll = findTable(f, /ของสะสม/, 'หมวด');
  const meas = findTable(f, /วัดคำปฏิญาณ/, 'รหัส');
  const g = (p: string) => chrGain.rows.find((r) => r.cells[0].startsWith(p))!.cells[1];
  const win = nums(g('คำปฏิญาณสำเร็จ'));
  const overNums = over.rows.map((r) => ({ cond: r.cells[0], effect: r.cells[1], count: num(r.cells[0]), mul: mult(r.cells[1]) }));
  return {
    vows: vows.rows.map((r) => ({ id: r.cells[0], name: r.cells[1], done: r.cells[2], set: Number(r.cells[0].slice(3)) <= 12 || r.cells[0] === 'GV-20' ? 1 : 2, selfJudged: ['GV-11', 'GV-12', 'GV-19'].includes(r.cells[0]), src: src(vows, r.line) })),
    vowResults: vres.rows.map((r) => ({ result: r.cells[0], gets: r.cells[1] })),
    titles: titles.rows.map((r) => ({ title: r.cells[0], cond: r.cells[1], src: src(titles, r.line) })),
    chronicle: { vowDone: win[0], vowFail: win[1], perTitle: num(g('ฉายาชีวิต'))!, perMilestone: num(g('ผ่านจุดบรรจบ'))!, firstLife: num(g('ชีวิตแรก'))! },
    unlocks: unlock.rows.map((r) => ({ at: Number(r.cells[0]), opens: r.cells[1] })),
    rhythms: rhythm.rows.map((r) => ({ name: r.cells[0], effect: r.cells[1] })),
    overreach: overNums.map((o) => ({ ...o, count: o.count })),
    collection: coll.rows.map((r) => ({ what: r.cells[0], count: /^\d/.test(r.cells[1]) ? Number(r.cells[1]) : null, note: r.cells[1] })),
    measure: meas.rows.map((r) => ({ ids: r.cells[0].split(/\s+/), judged: r.cells[1], result: r.cells[2] })),
  };
}

// ---------- 06-implementation §4: what the sim assumes ----------
function sim() {
  const f = G + '06-implementation.md';
  const t = findTable(f, /จำลองสมดุล/, 'เรื่อง', 0);
  const tuned = findTable(f, /จำลองสมดุล/, 'เรื่อง', 1);
  const targets = findTable(f, /จำลองสมดุล/, 'เป้า', 0);
  const pol = findTable(f, /จำลองสมดุล/, 'นโยบาย', 0);
  const r = (p: string) => t.rows.find((x) => x.cells[0].startsWith(p))!.cells;
  const n = (c: string[]) => nums(c[1]);
  return {
    assumptions: {
      nodesPerLife: n(r('จังหวะตัดสินใจ'))[0],
      windowShare: { rows: 123, of: 745, pct: nums(r('หน้าต่างพระเจ้า')[1])[0] / 100 },
      earlyDeath: { perYear: nums(r('ความตายก่อนวัย')[1])[0] / 100, fromAge: nums(r('ความตายก่อนวัย')[1])[1], naturalAge: nums(r('ความตายก่อนวัย')[1])[2] },
      channelB: [nums(r('ช่องทาง B')[1])[0], nums(r('ช่องทาง B')[1])[1]] as [number, number],
      trouble: nums(r('ความทุกข์ใกล้ตัว')[1])[0] / 100,
      troubleMul: 3,
      ageStops: [5, 15, 30, 50, 70],
      horizon: 1800,
      lifeYears: 75,
      prayerCostSpread: [8, 25] as [number, number],
      note: 'ageStops, horizon and prayerCostSpread are constants of sim-god.mjs (ageStops from experience/07-attention.md section 2); the others are read from the table',
    },
    tuned: tuned.rows.map((x) => ({ what: x.cells[0], before: x.cells[1], measured: x.cells[2], now: x.cells[3], after: x.cells[4] ?? '' })),
    targets: targets.rows.map((x) => ({ what: x.cells[0], value: x.cells[1] })),
    policies: pol.rows.map((x) => ({ policy: x.cells[0], does: x.cells[1], answers: x.cells[2] })),
  };
}

export default function run() {
  const pw = power();
  const ch = chest();
  const dr = dreams();
  const pr = prayers();
  const mr = miracles();
  const cj = conjure();
  const gl = goals();
  const sm = sim();
  // the numbers sim-god.mjs tuned (RULE) read straight from the miracle and dream docs
  const rule = {
    dreamStep: pw.prices.dream.step,
    anchorCd: mr.seal.anchorCdYears,
    anchorWorldCd: mr.seal.anyAnchorCdYears,
    ruinLife: pw.caps.miraclePerLife.ruinOfBig,
    ruinCd: mr.limits.ruinGapYears,
    dragonCd: must(mr.list.find((m) => m.id === 'MR-23')!.wait, 'MR-23 wait'),
    mahaF: must(mr.list.find((m) => m.id === 'MR-21')!.cost.faithMin, 'MR-21 min'),
    wrathD: must(mr.list.find((m) => m.id === 'MR-22')!.cost.dread, 'MR-22 dread'),
    burdenRelief: dr.burden.relief,
    burdenAt: dr.burden.at,
    endFate: 3,
    fallFate: mr.fate.dragonCap,
    largeCd: mr.limits.worldBigGapYears,
    midCd: mr.limits.worldMidGapYears,
    note: 'endFate 3 is the most MR-25 can speed an event an ending needs (WR-15 MC-12 WR-23): the doc fixes only the dragon-fall cap, so 3 is the sim value (ลิขิต ×1.1 to ×3)',
  };
  const raws: RawTable[] = [];
  for (const file of listDocs('docs/systems/god')) for (const t of tables(file)) raws.push(raw(t));
  const data: GodData = {
    counts: { miracles: mr.list.length, conjureCells: cj.cells.length, vows: gl.vows.length, lifeTitles: gl.titles.length, godTitles: pw.epithets.length, prayers: pr.kinds.length, tables: raws.length },
    ...pw,
    chest: ch,
    dreams: dr,
    prayers: pr,
    miracles: mr,
    conjure: cj,
    goals: gl,
    sim: sm,
    rule,
    raw: raws,
  };
  writeGen('god', data, [...listDocs('docs/systems/god').filter((f) => /\/0[1-8]-/.test(f)), 'docs/lore/dragons/README.md'], GEN);
  void dash;
  void tagsOf;
  void parts;
  return finish('god', ['god.json'], un);
}
