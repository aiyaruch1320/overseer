// Bondage generator (code-plan §5.1, row "พวกพ้อง ครอบครัว ผูกตัว เดินทาง"): the levels B0 to B3, the five stances
// D L M A H and the country list of §3.1, class-1 shares, the ways in and out, ransom prices, the roles of buyer, redeemer
// and helper. Writes data/gen/bondage.json from docs/systems/economy/10-bondage.md.
import type { Condition, Effect } from '../../../src/core/types';
import type {
  BondageData,
  BondageExit,
  BondageIncome,
  BondageLevel,
  BondagePrice,
  BondageRole,
  BondageRoles,
  BondageRoute,
  Class1Share,
  Legality,
  Stance,
  StanceGroup,
  StanceId,
} from '../../../src/core/data/types-bondage';
import type { RawTable } from '../../../src/core/data/types-economy';
import { parseCell, parseConditionX } from '../lib/effects';
import { idIndex } from '../lib/ids';
import { findTable, finish, nums, src, tables, Unparsed } from '../helpers-m0b';
import { readDoc, writeGen } from '../lib/table';
import type { Table } from '../lib/table';

const F = 'docs/systems/economy/10-bondage.md';
const GEN = 'scripts/codegen/groups/bondage.ts';
const un = new Unparsed('bondage');
const ids = idIndex();

const must = <T>(v: T | null | undefined, what: string): T => {
  if (v == null) throw new Error('bondage: missing ' + what);
  return v;
};
const rowOf = (t: Table, first: string) => must(t.rows.find((r) => r.cells[0] === first), `${t.file} row "${first}"`);
const raw = (t: Table): RawTable => ({ headings: t.headings.slice(1), header: t.header, rows: t.rows.map((r) => r.cells), src: `${t.file}:${t.line}` });
const pct = (s: string) => Number(must(s.match(/(\d+(?:\.\d+)?)\s*%/), 'percent in ' + s)[1]) / 100;
/** A condition cell read as far as the grammar goes. Prose that holds no readable condition stays null (the raw text is kept beside it). */
const cond = (text: string): Condition | null => parseConditionX(text, ids) as Condition | null;
const NODE = /\b[a-z]{2}\.[btaelx]\d+\b/g;

/** Effects of a cell. Phrases the grammar leaves behind that carry a number go to the unparsed report. */
function effects(cell: string, line: number, why: string): Effect[] {
  const p = parseCell(cell, ids);
  for (const u of p.unparsed) un.add(F, line, u, why);
  return p.effects;
}

const LEGAL: Record<string, Legality> = { ถูกกฎหมาย: 'legal', ผิดกฎหมาย: 'illegal', แอบมี: 'hidden', ไม่มี: 'none' };
const legal = (cell: string, at: string): Legality => must(LEGAL[cell.trim()], `legality "${cell}" at ${at}`);

function levels(): BondageLevel[] {
  const t = findTable(F, /2\. ระดับการผูกตัว/, 'ระดับ');
  const classOne = readDoc(F).match(/B1 ถึง B3 รวมเป็นชนชั้น 1/) !== null;
  return t.rows.map((r) => {
    const id = must(r.cells[0].match(/^B[0-3]$/), 'level id ' + r.cells[0])[0] as BondageLevel['id'];
    const n = Number(id[1]) as BondageLevel['n'];
    const exits = r.cells[4] === 'ไม่มี' ? [] : r.cells[4].split(/\s+/);
    return { id, n, name: r.cells[1], arisesRaw: r.cells[2], arises: cond(r.cells[2]), rights: r.cells[3], exits, classOne: n > 0 && classOne, src: src(t, r.line) };
  });
}

function stances(): { stances: Stance[]; groups: StanceGroup[]; byCountry: Record<string, StanceId>; defaultStance: StanceId } {
  const t = findTable(F, /3\. ท่าทีของประเทศ/, 'รหัส');
  const list: Stance[] = t.rows.map((r) => {
    const id = must(r.cells[0].match(/^[AHDLM]$/), 'stance id ' + r.cells[0])[0] as StanceId;
    const eff = r.cells[5];
    return {
      id,
      name: r.cells[1],
      legal: { B1: legal(r.cells[2], r.cells[0]), B2: legal(r.cells[3], r.cells[0]), B3: legal(r.cells[4], r.cells[0]) },
      effectRaw: eff,
      effects: effects(eff, r.line, 'ท่าที ' + id + ': ผลต่อผู้ค้าและผู้ครอบครอง'),
      freeOnEntry: /เข้าประเทศได้อิสระทันที/.test(eff),
      canBuyContract: /ซื้อสัญญาได้/.test(eff) || /ซื้อขายได้|ตลาดเปิดซื้อขาย/.test(eff),
      canBuyPerson: /ซื้อขายได้|ตลาดเปิดซื้อขาย/.test(eff),
      registry: /มีทะเบียน/.test(eff),
      chaseBack: /ถูกตามคืน/.test(eff),
      marketFee: /ค่าธรรมเนียมตลาด/.test(eff),
      look: /ปิดตา/.test(eff),
      src: src(t, r.line),
    };
  });
  const g = findTable(F, /3\.1 ประเทศที่ระบุ/, 'ท่าที');
  const byCountry: Record<string, StanceId> = {};
  const groups: StanceGroup[] = [];
  let defaultStance: StanceId | null = null;
  for (const r of g.rows) {
    const stance = must(r.cells[0].replace(/\*/g, '').match(/^[AHDLM]$/), 'stance code ' + r.cells[0])[0] as StanceId;
    const cell = r.cells[1];
    if (/ประเทศอื่นที่ไม่ได้ระบุ/.test(cell)) {
      defaultStance = stance;
      continue;
    }
    const named = [...cell.matchAll(/\b([A-Z]{2}-\d\d)\s+([฀-๿]+)/g)].map((m) => ({ id: m[1], name: m[2] })).filter((n) => n.name !== 'ถึง');
    const range = cell.match(/\(([A-Z]{2}-\d\d)\s*ถึง\s*([A-Z]{2}-\d\d)\)/);
    let countries = named.map((n) => n.id);
    if (range) {
      const [a, b] = [range[1], range[2]];
      const pre = a.slice(0, 3);
      for (let i = Number(a.slice(3)); i <= Number(b.slice(3)); i++) countries.push(pre + String(i).padStart(2, '0'));
      countries = [...new Set(countries)];
    }
    if (!countries.length) un.add(F, r.line, cell, 'ไม่พบรหัสประเทศในแถวท่าที');
    for (const c of countries) {
      if (!ids.countries.has(c)) un.add(F, r.line, c, 'รหัสประเทศที่ไม่มีในไฟล์ประเทศ');
      if (byCountry[c] && byCountry[c] !== stance) un.add(F, r.line, c, `ประเทศถูกระบุสองท่าที ${byCountry[c]} และ ${stance}`);
      byCountry[c] = stance;
    }
    groups.push({ stance, countries, named, ...(range ? { range: [range[1], range[2]] as [string, string] } : {}), reason: r.cells[2], src: src(g, r.line) });
  }
  const def = must(defaultStance, 'row "ประเทศอื่นที่ไม่ได้ระบุ"');
  for (const c of [...ids.countries].sort()) if (!byCountry[c]) byCountry[c] = def;
  const sorted: Record<string, StanceId> = {};
  for (const k of Object.keys(byCountry).sort()) sorted[k] = byCountry[k];
  return { stances: list, groups, byCountry: sorted, defaultStance: def };
}

function class1(): Class1Share[] {
  const t = findTable(F, /4\. ชนชั้น 1/, 'ท่าที');
  return t.rows.map((r) => {
    const n = r.cells.slice(1, 5).map((c) => Number(c.match(/^\d+/)![0]));
    const share = { stance: r.cells[0] as StanceId, b1: n[0], b2: n[1], b3: n[2], rest: n[3], restText: r.cells[4].replace(/^\d+\s*/, ''), src: src(t, r.line) };
    if (n[0] + n[1] + n[2] + n[3] !== 100) un.add(F, r.line, r.cells.join(' | '), 'สัดส่วนชนชั้น 1 รวมไม่ถึง 100');
    return share;
  });
}

function routes(): BondageRoute[] {
  const t = findTable(F, /5\. ทางที่คนถูกผูกตัว/, 'ทาง');
  return t.rows.map((r) => {
    const levels = [...r.cells[2].matchAll(/B(\d)/g)].map((m) => Number(m[1]));
    const nodes = [...new Set(r.cells[3].match(NODE) ?? [])];
    for (const n of nodes) if (!ids.nodes.has(n)) un.add(F, r.line, n, 'โหนดที่ไม่มีในเส้นเรื่อง');
    const note = r.cells[3].replace(NODE, '').replace(/เริ่มที่|หรือ/g, '').replace(/\s+/g, ' ').trim();
    return { way: r.cells[0], causeRaw: r.cells[1], cause: cond(r.cells[1]), levels, levelsRaw: r.cells[2], nodes, note, src: src(t, r.line) };
  });
}

function exits(): { list: BondageExit[]; freeLand: { text: string; src: string } } {
  const t = findTable(F, /6\. ทางออก/, 'ทาง');
  const list = t.rows.map((r) => {
    const to = r.cells[2].match(/เป็น B(\d)/);
    const up = r.cells[2].match(/ชนชั้นขึ้น(หนึ่ง|สอง)ชั้น(?:\s*\(([^)]*)\))?/);
    if (up) un.add(F, r.line, up[0], 'ขึ้นชั้นแบบสัมพัทธ์ (ชนชั้นขึ้นหนึ่งชั้น) ไม่อยู่ในไวยากรณ์ ตัวแปลมีแต่ "ชั้น N" จึงสกัดเอง');
    return {
      way: r.cells[0],
      condRaw: r.cells[1],
      cond: cond(r.cells[1]),
      resultRaw: r.cells[2],
      effects: effects(r.cells[2].replace(/ชนชั้นขึ้น(?:หนึ่ง|สอง)ชั้น(?:\s*\([^)]*\))?/, ''), r.line, 'ทางออก ' + r.cells[0]),
      toLevel: to ? Number(to[1]) : null,
      classUp: up ? (up[1] === 'หนึ่ง' ? 1 : 2) : 0,
      ...(up?.[2] ? { classUpIf: up[2].replace(/^ถ้า/, '') } : {}),
      src: src(t, r.line),
    };
  });
  const lines = readDoc(F).split('\n');
  const at = lines.findIndex((l) => l.startsWith('**ดินแดนเสรี**'));
  return { list, freeLand: { text: lines[at].replace(/\*\*/g, ''), src: `${F}:${at + 1}` } };
}

function prices(): { prices: BondagePrice[]; income: BondageIncome } {
  const t = findTable(F, /7\. ราคา/, 'ระดับ');
  const list: BondagePrice[] = t.rows.map((r) => {
    const level = r.cells[0] as BondagePrice['level'];
    const range = nums(r.cells[1].replace(/[()]/g, ' '));
    const p: BondagePrice = { level, min: range[0], max: range[1], note: r.cells[2], src: src(t, r.line) };
    if (level === 'B1') p.wageCut = [nums(r.cells[2].match(/(\d+)\s*ถึง\s*(\d+)%/)![0])[0] / 100, nums(r.cells[2].match(/(\d+)\s*ถึง\s*(\d+)%/)![0])[1] / 100];
    if (level === 'B2') p.perContractYear = Number(must(r.cells[2].match(/×(\d+)\s*ทอง/), 'B2 gold per contract year')[1]);
    if (level === 'B3') {
      const sk = must(r.cells[2].match(/ราคาพื้น\s*(\d+)\s*คูณระดับฝีมือ\s*(\d+)\s*ถึง\s*(\d+)/), 'B3 base price');
      p.basePrice = Number(sk[1]);
      p.skillRange = [Number(sk[2]), Number(sk[3])];
      if (p.basePrice * p.skillRange[1] !== p.max) un.add(F, r.line, r.cells[2], 'ราคาพื้น × ระดับฝีมือสูงสุดไม่เท่าราคาสูงสุดของช่อง');
    }
    return p;
  });
  const lines = readDoc(F).split('\n');
  const at = lines.findIndex((l) => l.startsWith('ตัวละครหลักที่เป็น B1 ถึง B3'));
  const text = lines[at];
  const mul = (re: RegExp) => Number(must(text.match(re), 'income ' + re)[1]);
  const living = nums(must(text.match(/ค่าครองชีพ\s*(\d+)\s*ถึง\s*(\d+)/), 'living cost')[0]);
  const saving = nums(must(text.match(/ปีละประมาณ\s*(\d+)\s*ถึง\s*(\d+)\s*ทอง/), 'saving per year')[0]);
  const income: BondageIncome = {
    b1ClassMul: mul(/B1 ใช้ตัวคูณชนชั้นล่าง\s*×([\d.]+)/),
    b23ClassMul: mul(/B2 B3 ใช้ตัวคูณผู้ไร้สิทธิ์\s*×([\d.]+)/),
    livingCost: [living[0], living[1]],
    savingPerYear: [saving[0], saving[1]],
    atW: mul(/ที่ W\s*(\d)/),
    text,
    src: `${F}:${at + 1}`,
  };
  return { prices: list, income };
}

function roles(): { roles: BondageRole[]; rules: BondageRoles; allyChance: BondageData['allyChance']; gratitude: BondageData['gratitude'] } {
  const t = findTable(F, /8\. ผู้ครอบครอง/, 'บทบาท');
  const list: BondageRole[] = t.rows.map((r) => ({
    role: r.cells[0],
    whenRaw: r.cells[1],
    when: cond(r.cells[1]),
    costRaw: r.cells[2],
    gainRaw: r.cells[3],
    src: src(t, r.line),
  }));
  const at = (p: string) => ({ role: must(list.find((x) => x.role.startsWith(p)), 'role ' + p), row: must(t.rows.find((x) => x.cells[0].startsWith(p)), 'role ' + p) });
  const buyer = at('ผู้ซื้อ');
  const free = at('ผู้ไถ่');
  const help = at('ผู้ช่วยหนี');
  // The grammar of effects.ts cannot read these cells ("ไว้ใจของประเทศท่าที A ต่อตัวละคร −2", "รายได้ไม่เกิน +15%"), so the numbers are read here.
  const trust = must(buyer.role.costRaw.match(/ไว้ใจของประเทศท่าที\s*([AHDLM])\s*ต่อตัวละคร\s*[−-](\d+)/), 'buyer trust loss');
  const inf = must(buyer.role.costRaw.match(/`(c_[a-z]+)`\s*(\d+)%\s*ในประเทศ\s*([AHDLM])\s*และ\s*([AHDLM])/), 'buyer infamy');
  const bonus = must(buyer.role.gainRaw.match(/ไม่เกิน\s*\+(\d+)%/), 'buyer income bonus');
  un.add(F, buyer.row.line, buyer.role.costRaw, 'ผลของผู้ซื้อ: ตัวแปลอ่านความไว้ใจของประเทศ (ไว้ใจของประเทศท่าที A ต่อตัวละคร −2) ไม่ได้ จึงสกัดตัวเลขเอง');
  const grat = Number(must(free.role.gainRaw.match(/บุญคุณ\s*\+(\d+)/), 'gratitude of redeemer')[1]);
  const wanted = must(help.role.costRaw.match(/`(c_[a-z]+)`/), 'helper curse')[1];
  const rules: BondageRoles = {
    buyer: {
      stances: [...buyer.role.whenRaw.matchAll(/ท่าที\s*([AHDLM])|\b([DLM])\b/g)].map((m) => (m[1] ?? m[2]) as StanceId),
      trustLossInA: -Number(trust[2]),
      infamousChance: Number(inf[2]) / 100,
      infamousStances: [inf[3], inf[4]] as StanceId[],
      incomeBonusMax: Number(bonus[1]) / 100,
    },
    redeemer: { gratitude: grat, allyChance: pct(free.role.gainRaw), freeInStance: must(free.role.whenRaw.match(/ที่ท่าที\s*([AHDLM])/), 'redeemer free stance')[1] as StanceId },
    helper: {
      wantedCurse: wanted,
      trust: Number(must(help.role.gainRaw.match(/ไว้ใจของผู้หนี\s*\+(\d+)/), 'trust of helper')[1]),
      allyChance: pct(help.role.gainRaw),
      viaStance: must(help.role.whenRaw.match(/ท่าที\s*([AHDLM])/), 'helper stance')[1] as StanceId,
    },
  };
  return {
    roles: list,
    rules,
    allyChance: { redeemOrFree: rules.redeemer.allyChance, helper: rules.helper.allyChance },
    gratitude: { redeem: grat, free: grat, helperTrust: rules.helper.trust },
  };
}

function hold() {
  const lines = readDoc(F).split('\n');
  const at = lines.findIndex((l) => l.startsWith('**ถ้าถือต่อ**'));
  const text = lines[at];
  const year = Number(must(text.match(/ปีที่\s*(\d+)/), 'hold year')[1]);
  const chances = [...text.matchAll(/(\d+)%/g)].map((m) => Number(m[1]) / 100);
  const trust = must(text.match(/−(\d+)\s*ต่อสองปี\s*ไม่ต่ำกว่า\s*−(\d+)/), 'owner trust drop');
  return { year, escapeChance: chances[0], suedChance: chances[1], ownerTrustPerTwoYears: -Number(trust[1]), ownerTrustFloor: -Number(trust[2]), src: `${F}:${at + 1}` };
}

export default function run() {
  const lv = levels();
  const st = stances();
  const c1 = class1();
  const rt = routes();
  const ex = exits();
  const pr = prices();
  const ro = roles();
  const intent = findTable(F, /1\. เจตนา/, 'ข้อ').rows.map((r) => ({ n: Number(r.cells[0]), text: r.cells[1], src: `${F}:${r.line}` }));
  const rawAll = tables(F).map(raw);
  const data: BondageData = {
    counts: {
      levels: lv.length,
      stances: st.stances.length,
      stanceGroups: st.groups.length,
      namedCountries: Object.keys(st.byCountry).filter((c) => st.groups.some((g) => g.countries.includes(c))).length,
      countries: Object.keys(st.byCountry).length,
      routes: rt.length,
      exits: ex.list.length,
      roles: ro.roles.length,
      tables: rawAll.length,
    },
    intent,
    levels: lv,
    stances: st.stances,
    stanceGroups: st.groups,
    byCountry: st.byCountry,
    defaultStance: st.defaultStance,
    class1: c1,
    routes: rt,
    exits: ex.list,
    freeLand: ex.freeLand,
    prices: pr.prices,
    income: pr.income,
    roles: ro.roles,
    roleRules: ro.rules,
    allyChance: ro.allyChance,
    gratitude: ro.gratitude,
    hold: hold(),
    raw: rawAll,
  };
  writeGen('bondage', data satisfies BondageData, [F], GEN);
  return finish('bondage', ['bondage.json'], un);
}
