// Travel generator (code-plan §5.1, row "พวกพ้อง ครอบครัว ผูกตัว เดินทาง"): the three travel levels, the yearly chances of
// the causes that open the travel overlays (sf ps ml sc ex wd xc), the destination filters (route, race stance, moral
// limits, race movement, deep water), the time and fare of each kind of route, the d12 table between countries and the
// targets for meeting other races. Writes data/gen/travel.json from docs/systems/travel/01-travel-rules.md
// and the table of overlay conditions in docs/lore/storylines/25-journeys.md.
import type { Condition, ContinentId, Effect } from '../../../src/core/types';
import type {
  BodyLimit,
  CauseRules,
  Encounter,
  EncounterWeightMod,
  JobLegs,
  LevelTarget,
  MoralRule,
  Overlay,
  Party,
  RaceMove,
  RaceRelation,
  RouteEventMod,
  Stance32,
  StanceModifier,
  TravelCause,
  TravelData,
  TravelLevel,
  TravelLevelId,
  TravelRoute,
  TravelTarget,
  WindStill,
} from '../../../src/core/data/types-travel';
import type { RawTable } from '../../../src/core/data/types-economy';
import { RACE_WORDS, parseCell, parseConditionX, textConditions } from '../lib/effects';
import { idIndex } from '../lib/ids';
import { findTable, finish, mult, nums, section, src, tables, ticks, Unparsed } from '../helpers-m0b';
import { readDoc, writeGen } from '../lib/table';
import type { Table } from '../lib/table';

const F = 'docs/systems/travel/01-travel-rules.md';
const J = 'docs/lore/storylines/25-journeys.md';
const GEN = 'scripts/codegen/groups/travel.ts';
const un = new Unparsed('travel');
const ids = idIndex();

const must = <T>(v: T | null | undefined, what: string): T => {
  if (v == null) throw new Error('travel: missing ' + what);
  return v;
};
const raw = (t: Table): RawTable => ({ headings: t.headings.slice(1), header: t.header, rows: t.rows.map((r) => r.cells), src: `${t.file}:${t.line}` });
const minus = (s: string) => Number(s.replace('−', '-').replace('+', ''));
const range = (s: string): [number, number] | null => {
  const m = s.trim().match(/^(\d+)\s*[–-]\s*(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const strip = (s: string) => s.replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

// ---------- conditions ----------

/**
 * Phrases the grammar of effects.ts leaves as text but that carry only a comparison or a range. They are read here
 * so the engine gets a number; what stays text is reported (the lead can move these forms into effects.ts).
 */
function fixText(text: string): Condition | null {
  let m = text.match(/^ศรัทธา\s*(>=|>|≥|<=|<|≤)\s*(\d+)$/);
  if (m) return { k: 'cmp', stat: 'faith', op: m[1] === '≥' ? '>=' : m[1] === '≤' ? '<=' : (m[1] as '>'), value: Number(m[2]), label: 'ศรัทธา' };
  m = text.match(/^อายุเทียบ\s*(\d+)\s*ถึง\s*(\d+)$/);
  if (m) return { k: 'age', min: Number(m[1]), max: Number(m[2]) };
  m = text.match(/^เป็นหนี้\s*(>=|>|≥)\s*(\d+)\s*ทอง$/);
  if (m) return { k: 'cmp', stat: 'debt', op: m[1] === '≥' ? '>=' : (m[1] as '>'), value: Number(m[2]), label: 'เป็นหนี้' };
  m = text.match(/^war=(\w+)$/);
  if (m) return { k: 'place', kinds: [`war=${m[1]}`] };
  return null;
}

function fix(c: Condition): Condition {
  switch (c.k) {
    case 'text':
      return fixText(c.text) ?? c;
    case 'and':
    case 'or':
      return { ...c, of: c.of.map(fix) };
    case 'not':
      return { ...c, of: fix(c.of) };
    default:
      return c;
  }
}

const trustLocal = (n: number): Condition => ({ k: 'cmp', stat: 'trust.local', op: '>=', value: n, label: 'ผู้ไว้ใจในถิ่น' });
/** Whole phrases of this file that the grammar of effects.ts breaks into pieces. Each is a reading of the doc's words, not a new rule. */
const PHRASES: [RegExp, (m: RegExpMatchArray) => Condition][] = [
  // `war=total`: the war flag at its total level (the docs write the level after "="; Condition `place` has no level, so it is kept in the kind)
  [/^`?war=(\w+)`?$/, (m) => ({ k: 'place', kinds: [`war=${m[1]}`] })],
  [/^(?:มี|ใบผ่านจาก)ผู้ไว้ใจ\s*≥\s*(\d+)\s*ในถิ่น$/, (m) => trustLocal(Number(m[1]))],
  [/^NPC ต่างถิ่นที่ไว้ใจ\s*≥\s*(\d+)\s*(.+)$/, (m) => ({ k: 'and', of: [{ k: 'cmp', stat: 'trust.foreignNpc', op: '>=', value: Number(m[1]), label: 'NPC ต่างถิ่นที่ไว้ใจ' }, { k: 'text', text: m[2] }] })],
  // the overlay table of 25-journeys.md §3 spells the same disasters: war, famine, plague, DR-01, FG-02, FG-03
  [
    /^เหตุการณ์โลกที่ทำให้ถิ่นอยู่ไม่ได้\s*\(.*\)$/,
    () => ({
      k: 'or',
      of: [
        { k: 'place', kinds: ['war'] },
        { k: 'place', kinds: ['famine'] },
        { k: 'place', kinds: ['plague'] },
        { k: 'event', id: 'DR-01', happened: true },
        { k: 'event', id: 'FG-02', happened: true },
        { k: 'event', id: 'FG-03', happened: true },
      ],
    }),
  ],
];

function atom(text: string): Condition | null {
  const t = text.trim();
  for (const [re, f] of PHRASES) {
    const m = t.match(re);
    if (m) return f(m);
  }
  const c = parseConditionX(t.replace(/ธงสงคราม\s*`war`\s*ในประเทศ/g, 'ถิ่นมีสงคราม').replace(/`(war=\w+)`/g, '$1'), ids, true) as Condition | null;
  return c ? fix(c) : null;
}

/**
 * A condition cell read as far as the grammar plus the forms above go. ` · ` joins conditions that all hold; a cell without
 * "และ" is split on "หรือ" first so one unreadable part does not spoil the others. What stays text is reported at the file line.
 */
function condOf(text: string, line: number, why: string, file = F): Condition | null {
  const segs = text.split(/\s+·\s+/).filter((x) => x.trim());
  const parts: Condition[] = [];
  for (const seg of segs) {
    const alts = /\s+และ\s*/.test(seg) ? [seg] : seg.split(/\s+หรือ\s*/);
    const cs = alts.map((a) => atom(a)).filter((x): x is Condition => !!x);
    if (!cs.length) continue;
    parts.push(cs.length === 1 ? cs[0] : { k: 'or', of: cs });
  }
  if (!parts.length) {
    if (/\d|≥|>/.test(text)) un.add(file, line, text, `${why}: อ่านเงื่อนไขไม่ได้`);
    return null;
  }
  const out: Condition = parts.length === 1 ? parts[0] : { k: 'and', of: parts };
  for (const t of new Set(textConditions(out))) un.add(file, line, t, `${why}: เงื่อนไขข้อความ`);
  return out;
}

function effectsOf(cell: string, line: number, why: string, file = F): Effect[] {
  const p = parseCell(cell, ids);
  for (const u of p.unparsed) un.add(file, line, u, why);
  return p.effects;
}

// ---------- 1. levels and legs ----------

function levels() {
  const t = findTable(F, /1\. ระดับการเดินทาง/, 'ระดับ');
  const list: TravelLevel[] = t.rows.map((r) => {
    const m = must(r.cells[0].match(/^L([012])\s+(.+)$/), 'level ' + r.cells[0]);
    return { id: `L${m[1]}` as TravelLevelId, n: Number(m[1]) as 0 | 1 | 2, name: m[2], meaning: r.cells[1], examples: r.cells[2], src: src(t, r.line) };
  });
  const tg = findTable(F, /1\. ระดับการเดินทาง/, 'กลุ่มอาชีพ');
  const targets: LevelTarget[] = tg.rows.map((r) => {
    const pct = r.cells.slice(1, 4).map((c) => Number(c.replace('%', ''))) as [number, number, number];
    if (pct[0] + pct[1] + pct[2] !== 100) un.add(F, r.line, r.cells.join(' | '), 'เป้าการกระจาย L0 L1 L2 รวมไม่ถึง 100');
    return { group: r.cells[0], pct, src: src(tg, r.line) };
  });
  const jt = findTable(F, /1\. ระดับการเดินทาง/, 'อาชีพ');
  const jobs: JobLegs[] = jt.rows.map((r) => {
    const legsRaw = r.cells[1];
    let legs: [number, number];
    let perLife = false;
    if (/ทริปยาวต่อชีวิต/.test(legsRaw)) {
      legs = [1, 1];
      perLife = true;
    } else if (/ทุกหนึ่งถึงสองปี/.test(legsRaw)) legs = [0.5, 1];
    else {
      const n = nums(legsRaw.replace(/ท่า/, ''));
      legs = [n[0], n[1] ?? n[0]];
    }
    return { label: r.cells[0].replace(/`[^`]+`/g, '').trim(), jobs: ticks(r.cells[0]), legsRaw, legs, perLife, scope: r.cells[2], note: r.cells[3] ?? '', src: src(jt, r.line) };
  });
  const lines = readDoc(F).split('\n');
  const at = lines.findIndex((l) => l.startsWith('**ขาที่เดินจริงต่อปีชีวิต**'));
  const rule = lines.slice(at + 1, at + 4).map((l) => strip(l.replace(/^\d+\.\s*/, '')));
  const legRule = {
    daysJob: Number(must(rule[1].match(/อาชีพเดินทาง\s*(\d+)\s*วัน/), 'days of a travelling job')[1]),
    daysCause: Number(must(rule[1].match(/ผู้เดินทางตามเหตุในข้อ 2 ใช้\s*(\d+)\s*วัน/), 'days of a cause traveller')[1]),
    text: rule,
    src: `${F}:${at + 2}`,
  };
  return { list, targets, jobs, legRule };
}

// ---------- 2. causes and overlays ----------

/** Yearly chance cell: `3% (ชนชั้น 4 ขึ้นไป ×2)` `15% ในปีที่เหตุการณ์เกิด`. */
function chanceOf(cell: string, line: number) {
  const chance = Number(must(cell.match(/^(\d+(?:\.\d+)?)%/), 'chance ' + cell)[1]) / 100;
  const mods = [...cell.matchAll(/\(([^()]*?)\s*×(\d+(?:\.\d+)?)\)/g)].map((m) => {
    const cond = condOf(m[1], line, 'ตัวคูณโอกาสของเหตุเดินทาง') ?? ({ k: 'text', text: m[1] } as Condition);
    return { cond, mul: Number(m[2]), raw: m[0] };
  });
  return { chance, mods, inEventYear: /ในปีที่เหตุการณ์เกิด/.test(cell) };
}

function causes(): { list: TravelCause[]; rules: CauseRules } {
  const t = findTable(F, /2\. เหตุที่ทำให้ได้เดินทาง/, 'สาเหตุ');
  const list = t.rows.map((r) => {
    const opensRaw = r.cells[3];
    const opens = [...new Set(opensRaw.match(/\b[a-z]{2}\.[btaelx]\d+\b/g) ?? [])];
    for (const n of opens) if (!ids.nodes.has(n)) un.add(F, r.line, n, 'โหนดที่ไม่มีในเส้นเรื่อง');
    const byRace = /xc/.test(opensRaw) && !opens.length;
    const overlay = opens.length ? opens[0].split('.')[0] : 'xc';
    const c = chanceOf(r.cells[2], r.line);
    return { overlay, cause: r.cells[0], whenRaw: r.cells[1], when: condOf(r.cells[1], r.line, 'เหตุเดินทาง ' + r.cells[0]), ...c, opens, opensRaw, byRace, src: src(t, r.line) };
  });
  const lines = readDoc(F).split('\n');
  const at = lines.findIndex((l) => l.startsWith('กติการ่วม:'));
  const text = lines[at];
  const once = Number(
    must(
      text.match(/ไม่เกินหนึ่งครั้งต่อ(สอง|สาม|สี่|ห้า)ปี/),
      'once per N years',
    )[1] === 'สาม'
      ? 3
      : 0,
  );
  if (!once) un.add(F, at + 1, text.slice(0, 80), 'จำนวนปีของ "ไม่เกินหนึ่งครั้งต่อ N ปี" อ่านไม่ได้ (ตัวแปลรู้เฉพาะ สาม)');
  const parsed = [...text.matchAll(/(?:ตัวละครที่มีนิสัย\s*)?`([a-z_]+)`\s*×(\d+(?:\.\d+)?)/g)].map((m) => ({ raw: m[0], cond: { k: 'has', kind: 'trait', id: m[1] } as Condition, mul: Number(m[2]) }));
  const dep = text.match(/ผู้พึ่งพา\s*\(([^)]*)\)\s*ทางเลือกเดินทางน้ำหนัก\s*×(\d+(?:\.\d+)?)/);
  const out: CauseRules['mods'] = [];
  if (dep) {
    un.add(F, at + 1, `ผู้พึ่งพา (${dep[1]}) ×${dep[2]}`, 'เงื่อนไข "มีผู้พึ่งพา" ไม่อยู่ในไวยากรณ์');
    out.push({ raw: `มีผู้พึ่งพา (${dep[1]})`, cond: { k: 'text', text: `มีผู้พึ่งพา (${dep[1]})` }, mul: Number(dep[2]) });
  }
  out.push(...parsed);
  return { list, rules: { oncePerYears: once, mods: out, text, src: `${F}:${at + 1}` } };
}

function overlays(causeList: TravelCause[]): Overlay[] {
  const t = findTable(J, /3\. เงื่อนไขเปิดเส้น/, 'เส้น');
  const lineOf = (id: string) => [...ids.nodes].filter((n) => n.startsWith(id + '.')).sort();
  return t.rows.map((r) => {
    const id = r.cells[0];
    let open = condOf(r.cells[2], r.line, 'เปิดเส้น ' + id, J);
    if (!open && /^ไม่\s+(\S+)$/.test(r.cells[2])) {
      const word = r.cells[2].match(/^ไม่\s+(\S+)$/)![1];
      const code = RACE_WORDS.find(([w]) => w === word)?.[1];
      if (code) open = { k: 'not', of: { k: 'race', ids: [code] } };
      else un.add(J, r.line, r.cells[2], 'เปิดเส้น xc: ไม่รู้จักเผ่า');
    }
    const o: Overlay = {
      id,
      name: r.cells[1].replace(/\s*\(.*\)$/, ''),
      openRaw: r.cells[2],
      open,
      nodeCount: Number(r.cells[3]),
      nodes: lineOf(id),
      otherRaw: r.cells[4],
      causes: causeList.filter((c) => c.overlay === id).map((c) => c.chance),
      src: `${J}:${r.line}`,
    };
    const sp = r.cells[4].match(/(\d+)%\s*ที่เกิดขึ้นเองตอนอายุเทียบ\s*(\d+)\s*ถึง\s*(\d+)\s*ถ้าตัวละครอยู่\s*(L[012])/);
    if (sp) o.spontaneous = { chance: Number(sp[1]) / 100, ageMin: Number(sp[2]), ageMax: Number(sp[3]), level: sp[4] as TravelLevelId };
    if (o.nodes.length !== o.nodeCount) un.add(J, r.line, `${id} นับโหนด ${o.nodes.length} ตารางบอก ${o.nodeCount}`, 'จำนวนโหนดของเส้นไม่ตรงตารางเงื่อนไข');
    return o;
  });
}

// ---------- 3. filters ----------

const PARTIES = ([
  ['ลูกผสมจักรกล', 'co'], ['ดาร์กเอลฟ์', 'de'], ['หุ่นวิญญาณ', 'so'], ['ฮาล์ฟลิง', 'ha'], ['เผ่าปีศาจ', 'dm'], ['เผ่ามังกร', 'dk'], ['เผ่าลาวา', 'la'],
  ['เผ่าสัตว์', 'be'], ['ภูตพราย', 'fa'], ['แวมไพร์', 'va'], ['คนแคระ', 'dw'], ['มนุษย์ช่าง', 'hu', 'ช่าง'], ['มนุษย์เรือ', 'hu', 'เรือ'], ['มนุษย์ริมน้ำ', 'hu', 'ริมน้ำ'],
  ['มนุษย์ทั่วไป', 'hu', 'ทั่วไป'], ['มนุษย์', 'hu'], ['เผ่าปีก', 'wi'], ['มัมมี่', 'mu'], ['สไลม์', 'sl'], ['เอลฟ์', 'el'], ['ออร์ค', 'or'], ['นาคา', 'na'], ['เงือก', 'me'],
  ['ยักษ์', 'gi'], ['กูล', 'gh'], ['ภูต', 'fa'], ['ชาวหมอก', 'hu', 'หมอก'], ['กัปปะ', null], ['ทุกเผ่า', null],
] as [string, string | null, string?][]).sort((a, b) => b[0].length - a[0].length);

/** Names in a side of an arrow, greedy by longest known name; a rest the list does not know goes to `rest`. */
function partiesOf(text: string): { list: Party[]; rest: string } {
  const list: Party[] = [];
  let s = text.replace(/\s+/g, ' ').trim();
  let guard = 0;
  while (s && guard++ < 50) {
    const hit = PARTIES.find(([w]) => s.startsWith(w));
    const c = s.match(/^([A-Z]{2}-\d\d)/);
    if (hit) {
      list.push({ name: hit[0], race: hit[1], ...(hit[2] ? { sub: hit[2] } : {}) });
      s = s.slice(hit[0].length).trim();
    } else if (c) {
      list.push({ name: c[1], race: null, country: c[1] });
      s = s.slice(c[1].length).trim();
    } else break;
  }
  return { list, rest: s };
}

function raceRelations(): RaceRelation[] {
  const t = findTable(F, /3\.2 ท่าทีของถิ่นต่อเผ่า/, 'ค่า', 1);
  const out: RaceRelation[] = [];
  for (const r of t.rows) {
    const value = minus(r.cells[0]);
    for (const clause of r.cells[1].split(/\s+·\s+/)) {
      const at = src(t, r.line);
      const place = clause.match(/^(.+?)\s+(ในถิ่น\S+)\s*\(เช่น\s*([A-Z]{2}-\d\d)\)\s*$/);
      if (place) {
        const f = partiesOf(place[1]);
        if (f.rest) un.add(F, r.line, clause, 'ความสัมพันธ์เผ่า: ชื่อเผ่าที่ไม่รู้จัก ' + f.rest);
        out.push({ value, from: f.list, to: [], mutual: false, place: { text: place[2], countries: [place[3]] }, raw: clause, src: at });
        continue;
      }
      const exc = clause.match(/\(ยกเว้น([^)]*)\)/);
      const body = clause.replace(/[฀-๿]+\s*\((?=[A-Z]{2}-\d\d\))/g, '(').replace(/\([^)]*\)/g, (m) => (/^\([A-Z]{2}-\d\d\)$/.test(m) ? m.slice(1, -1) : '')).replace(/\s+/g, ' ').trim();
      const sides = body.split(/\s*[↔→]\s*/);
      const arrows = body.match(/[↔→]/g) ?? [];
      if (sides.length < 2) {
        un.add(F, r.line, clause, 'ความสัมพันธ์เผ่า: ไม่มีลูกศร');
        continue;
      }
      const groups = sides.map((s) => partiesOf(s));
      groups.forEach((g, i) => {
        if (g.rest) un.add(F, r.line, clause, `ความสัมพันธ์เผ่า: ชื่อที่ไม่รู้จัก "${g.rest}" (ด้านที่ ${i + 1})`);
      });
      const except = exc ? partiesOf(exc[1].replace(/^\s+/, '')).list : undefined;
      for (let i = 0; i < arrows.length; i++) {
        out.push({ value, from: groups[i].list, to: groups[i + 1].list, mutual: arrows[i] === '↔', ...(except?.length ? { except } : {}), raw: clause, src: at });
      }
    }
  }
  return out;
}

function stances32() {
  const t = findTable(F, /3\.2 ท่าทีของถิ่นต่อเผ่า/, 'ค่า', 0);
  const list: Stance32[] = t.rows.map((r) => {
    const eff = r.cells[2];
    const enterable = !/เข้าไม่ได้/.test(eff);
    let entry: Condition | null = null;
    if (!enterable) {
      entry = condOf(eff.replace(/^.*?ต้องมี/, '').replace(/\(ข้อ 3\.4\)/, ''), r.line, 'ท่าที ปิดกั้น: ทางเข้า');
      if (!entry) un.add(F, r.line, eff, 'ท่าทีปิดกั้น: ทางเข้าอ่านไม่ได้');
    }
    return {
      value: minus(r.cells[0]),
      name: r.cells[1],
      effectRaw: eff,
      enterable,
      tollMul: mult(eff) ?? 1,
      extraChecks: /ด่านตรวจเพิ่มหนึ่งครั้ง/.test(eff) ? 1 : 0,
      helpers: /ผู้ช่วยเพิ่ม/.test(eff) ? 'more' : /ไม่มีผู้ช่วย/.test(eff) ? 'none' : 'normal',
      entry,
      src: src(t, r.line),
    };
  });
  const lines = readDoc(F).split('\n');
  const at = lines.findIndex((l) => l.startsWith('ท่าทีคำนวณจากเผ่า'));
  const all = must(lines[at].match(/"ทุกเผ่า"\s*ใช้ค่า\s*(\d+)\s*ถึง\s*\+?(\d+)/), 'all-races stance');
  const mi = lines.findIndex((l) => l.startsWith('**ตัวปรับ**'));
  const mods: StanceModifier[] = lines[mi]
    .replace('**ตัวปรับ**', '')
    .split(/\s+·\s+/)
    .map((seg) => {
      const m = must(seg.trim().match(/^([+−-]\d+)\s+(.+)$/), 'modifier ' + seg);
      return { delta: minus(m[1]), raw: m[2], cond: condOf(m[2], mi + 1, 'ตัวปรับท่าที'), src: `${F}:${mi + 1}` };
    });
  return { list, all: [Number(all[1]), Number(all[2])] as [number, number], mods };
}

function moral(): { rules: MoralRule[]; limits: BodyLimit[] } {
  const t = findTable(F, /3\.3 ศีลธรรมและอาชีพ/, 'เงื่อนไข');
  const rules: MoralRule[] = t.rows.map((r) => {
    const forbiddenContinents = [...r.cells[1].matchAll(/\b(AZ|MH|KD|NR|AL|MK|SH|SV|NB)\s+ทุกประเทศ/g)].map((m) => m[1] as ContinentId);
    return {
      condRaw: r.cells[0],
      cond: parseConditionX(r.cells[0], ids) as Condition | null,
      forbiddenRaw: r.cells[1],
      forbiddenCountries: [...new Set(r.cells[1].match(/\b[A-Z]{2}-\d\d\b/g) ?? [])],
      forbiddenContinents,
      onEnterRaw: r.cells[2],
      onEnter: effectsOf(r.cells[2], r.line, 'ศีลธรรม: ผลถ้าเข้า'),
      src: src(t, r.line),
    };
  });
  const lines = readDoc(F).split('\n');
  const at = lines.findIndex((l) => l.startsWith('ข้อจำกัดทางกาย:'));
  const limits: BodyLimit[] = lines[at]
    .replace('ข้อจำกัดทางกาย:', '')
    .split(/\s+·\s+/)
    .map((seg) => strip(seg))
    .filter(Boolean)
    .map((text) => {
      const races = RACE_WORDS.filter(([w]) => text.includes(w)).map(([, c]) => c);
      if (/\d/.test(text) && !/ครึ่งปี/.test(text) && !/หัวข้อ|ข้อ \d/.test(text)) un.add(F, at + 1, text, 'ข้อจำกัดทางกายที่มีตัวเลข');
      return { text, races: [...new Set(races)] };
    });
  return { rules, limits };
}

function raceMoves(): { list: RaceMove[]; deep: TravelData['deepWater'] } {
  const t = findTable(F, /3\.5 การเคลื่อนที่ตามเผ่า/, 'เผ่า');
  const dash = (s: string) => (s === '—' ? '' : s);
  const list: RaceMove[] = t.rows.map((r) => ({
    raceRaw: r.cells[0],
    races: [...new Set(RACE_WORDS.filter(([w]) => r.cells[0].includes(w)).map(([, c]) => c))],
    sky: dash(r.cells[1]),
    sea: dash(r.cells[2]),
    deep: dash(r.cells[3]),
    desert: dash(r.cells[4]),
    fog: dash(r.cells[5]),
    sun: dash(r.cells[6]),
    canFly: /บินเองได้|บินได้/.test(r.cells[1]) && !/ไม่นับเป็นทางฟ้า/.test(r.cells[1]),
    deepWater: /ลงได้/.test(r.cells[3]),
    src: src(t, r.line),
  }));
  const lines = readDoc(F).split('\n');
  const at = lines.findIndex((l) => l.startsWith('**ฉากน้ำลึก**'));
  const text = lines[at];
  const deep = {
    countries: [...new Set(text.match(/\b[A-Z]{2}-\d\d\b/g) ?? [])],
    needTag: must(text.match(/`(#water_breath)`/), 'water_breath tag')[1],
    notEnoughTag: must(text.match(/`(#water_breath_short)`/), 'water_breath_short tag')[1],
    text: strip(text.replace(/\*\*/g, '')),
    src: `${F}:${at + 1}`,
  };
  return { list, deep };
}

function smuggle() {
  const lines = readDoc(F).split('\n');
  const at = lines.findIndex((l) => l.startsWith('- เส้นทางที่ปิดยังข้ามได้ด้วยลักลอบ'));
  const text = lines[at];
  const cost = must(text.match(/ค่าลักลอบ\s*(\d+)\s*ถึง\s*(\d+)\s*ทอง/), 'smuggle cost');
  const wanted = must(text.match(/`c_wanted`\s*(\d+)%/), 'smuggle wanted');
  const sk = must(text.match(/skill\s*`([a-z_]+)`\s*ระดับ\s*(\d)/), 'smuggle skill');
  return {
    cost: [Number(cost[1]), Number(cost[2])] as [number, number],
    wantedChance: Number(wanted[1]) / 100,
    skill: { id: sk[1], level: Number(sk[2]) },
    guides: ticks(text).filter((x) => /^[A-Z]{2}\d{2}-/.test(x)),
    text: strip(text.replace(/^- /, '')),
    src: `${F}:${at + 1}`,
  };
}

// ---------- 3.6 routes ----------

const ROUTE_IDS: Record<string, string> = {
  บกในทวีป: 'land', แม่น้ำและชายฝั่ง: 'coast', คอแผ่นดิน: 'isthmus', รถไฟ: 'rail', กองคาราวานทะเลทราย: 'caravan', ทะเลข้ามทวีป: 'sea',
  ปากเหวใต้ดิน: 'chasm', รากไม้ใต้ดิน: 'roots', ทางหมอก: 'fog', บันไดหมื่นขั้น: 'stair', เรือเหาะ: 'airship', วาฬฟ้า: 'whale', น้ำตกย้อนฟ้า: 'waterfall', บินเอง: 'fly', 'สู่ซาก (หลัง `DR-01`)': 'ruin',
};
const SKY = new Set(['stair', 'airship', 'whale', 'waterfall']);

function eventMods(cell: string, line: number, route: string): RouteEventMod[] {
  return cell.split(/\s+·\s+/).map((seg) => {
    const events = [...new Set(seg.match(/\b[A-Z]{2,3}-\d\d\b/g) ?? [])].filter((e) => !ids.countries.has(e));
    for (const e of events) if (!ids.events.has(e)) un.add(F, line, e, `เส้น ${route}: รหัสเหตุการณ์ที่ไม่มีในเอกสารเหตุการณ์`);
    const times = [...seg.matchAll(/เวลา\s*×(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    const fares = [...seg.matchAll(/ค่า\s*×(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    if (times.length > 1 || fares.length > 1) un.add(F, line, strip(seg), `เส้น ${route}: ตัวคูณเวลาหรือค่ามากกว่าหนึ่งตัวในส่วนเดียว อ่านเป็นข้อความ`);
    return {
      events,
      wildcard: [...new Set((seg.match(/\b[A-Z]{2,3}-\*/g) ?? []).map((w) => w))],
      ...(times.length === 1 ? { timeMul: times[0] } : {}),
      ...(fares.length === 1 ? { fareMul: fares[0] } : {}),
      closes: /ปิด|ตัดออก|เลิกใช้/.test(seg),
      text: strip(seg),
    };
  });
}

function routes(): TravelRoute[] {
  const t = findTable(F, /3\.6 เวลาและค่าเดินทาง/, 'ชนิดเส้นทาง');
  return t.rows.map((r, i) => {
    const id = ROUTE_IDS[r.cells[0]] ?? `route${i}`;
    if (!ROUTE_IDS[r.cells[0]]) un.add(F, r.line, r.cells[0], 'ชนิดเส้นทางที่ตัวสร้างไม่รู้ชื่อรหัส');
    const fareCell = r.cells[3];
    const fare = range(fareCell.split(/\s+/)[0]) ?? range(fareCell.replace(/^(?:ดาด\S+\s*)/, '').split(/\s+/)[0]) ?? (/^0\b/.test(fareCell) ? ([0, 0] as [number, number]) : null);
    return {
      id,
      kind: r.cells[0],
      linesRaw: r.cells[1],
      daysRaw: r.cells[2],
      days: range(r.cells[2]),
      fareRaw: fareCell,
      fare,
      whoRaw: r.cells[4],
      eventsRaw: r.cells[5],
      eventMods: eventMods(r.cells[5], r.line, id),
      needs: [...new Set(ticks(r.cells.slice(1).join(' ')).filter((x) => /^ky_/.test(x)))],
      sky: SKY.has(id),
      src: src(t, r.line),
    };
  });
}

function windStill(): TravelData['windStill'] {
  const t = findTable(F, /3\.6 เวลาและค่าเดินทาง/, 'ช่วง');
  const lines = readDoc(F).split('\n');
  const at = lines.findIndex((l) => l.startsWith('**ลมหยุด'));
  const years = Number(must(lines[at].match(/(\d+)\s*ปีโลก/), 'wind-still years')[1]);
  const rows: WindStill[] = t.rows.map((r) => {
    const m = must(r.cells[0].match(/(\d+)\s*[–-]\s*(\d+)|หลังปีที่\s*(\d+)/), 'wind period ' + r.cells[0]);
    const sea = r.cells[1];
    const one = (re: RegExp, s: string) => {
      const x = s.match(re);
      return x ? Number(x[1]) : null;
    };
    const d12 = sea.match(/d12 ข้อ\s*(\d+)\s*×(\d+(?:\.\d+)?)/);
    return {
      period: r.cells[0],
      from: m[3] ? Number(m[3]) : Number(m[1]),
      to: m[3] ? null : Number(m[2]),
      seaTimeMul: one(/เวลา\s*×(\d+(?:\.\d+)?)/, sea),
      seaFareMul: one(/ค่า\s*×(\d+(?:\.\d+)?)/, sea),
      coastTimeMul: one(/เวลา\s*×(\d+(?:\.\d+)?)/, r.cells[2]),
      airship: r.cells[3],
      d12: d12 ? { item: Number(d12[1]), mul: Number(d12[2]) } : null,
      textRaw: r.cells.slice(1),
      src: src(t, r.line),
    };
  });
  return { years, rows, src: `${F}:${at + 1}` };
}

// ---------- 4. between countries ----------

function encounters() {
  const t = findTable(F, /4\. ระหว่างทาง/, 'd12');
  const list: Encounter[] = t.rows.map((r) => {
    const p = parseCell(r.cells[2], ids);
    let dropped = 0;
    // The column is prose with codes in it: keep only the effects that name a thing (a curse, a node, a battle with enemies); the
    // numbers about gold, prices and acquaintance sit in `nums` and the phrase goes to the unparsed report.
    const clean = (es: Effect[]): Effect[] =>
      es.flatMap((e): Effect[] => {
        if (e.k === 'grant' || e.k === 'remove') {
          if (e.kind === 'flag' || e.kind === 'unknown' || e.kind === 'tag') return (dropped++, []);
          return [e];
        }
        if (e.k === 'battle') return e.enemies.length ? [e] : (dropped++, []);
        if (e.k === 'pick') return [{ ...e, of: e.of.map((o) => ({ ...o, effects: clean(o.effects) })) }];
        if (e.k === 'if') return [{ ...e, then: clean(e.then) }];
        if (e.k === 'ref' || e.k === 'event' || e.k === 'converge' || e.k === 'jump') return [e];
        return (dropped++, []);
      });
    const effects = clean(p.effects);
    if (dropped || p.unparsed.length || /\d|%|×/.test(r.cells[2].replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/[a-z]{2}\.[a-z]\d|c_[a-z]+|DR-\d+/g, ''))) {
      un.add(F, r.line, strip(r.cells[2]), `d12 ข้อ ${r.cells[0]}: ผลเป็นร้อยแก้ว (ทอง ราคา ความรู้จัก ขอบเขตของผล) อ่านเฉพาะรหัสและเก็บตัวเลขใน nums`);
    }
    return { d: Number(r.cells[0]), name: r.cells[1], effectRaw: r.cells[2], effects, nums: nums(strip(r.cells[2]).replace(/หัวข้อ\s*\d+/g, '')), src: src(t, r.line) };
  });
  const lines = readDoc(F).split('\n');
  const at1 = lines.findIndex((l) => l.startsWith('ทุกขา (ประเทศถึงประเทศ)'));
  const text = lines[at1];
  const rolls = { perLeg: 1, crossContinent: 2, caravanWithPassengers: 1, src: `${F}:${at1 + 1}` };
  if (!/ทอยตารางนี้หนึ่งครั้ง/.test(text) || !/ข้ามทวีปทอยสองครั้ง/.test(text) || !/ทอยเพิ่มหนึ่งครั้งเมื่อขบวนมีผู้โดยสาร/.test(text)) un.add(F, at1 + 1, text.slice(0, 90), 'จำนวนครั้งที่ทอย d12 ต่อขา อ่านไม่ได้');
  const at2 = lines.findIndex((l) => l.startsWith('น้ำหนักของ d12 คงที่'));
  const wt = lines[at2];
  const body = wt.replace(/^น้ำหนักของ d12 คงที่\s*ปรับเฉพาะตามธงโลก:\s*/, '');
  const mods: EncounterWeightMod[] = body.split(/\s+·\s+/).map((seg) => {
    const items = [...seg.matchAll(/ข้อ\s*(\d+)\s*×(\d+(?:\.\d+)?)/g)].map((m) => ({ d: Number(m[1]), mul: Number(m[2]) }));
    const head = seg.replace(/ข้อ\s*\d+\s*×\d+(?:\.\d+)?/g, '').trim();
    const when = head.replace(/\(.*$/, '').replace(/`/g, '').trim();
    const e: EncounterWeightMod = { when, cond: null, items, src: `${F}:${at2 + 1}` };
    if (/DR-06/.test(seg)) {
      e.cond = { k: 'event', id: 'DR-06', happened: true };
      e.routes = ['sea', 'airship'];
    } else if (/สงคราม/.test(head)) e.cond = { k: 'place', kinds: ['war'] };
    else if (/โรคระบาด/.test(head)) e.cond = { k: 'place', kinds: ['plague'] };
    else if (/ภัยอดอยาก/.test(head)) e.cond = { k: 'place', kinds: ['famine'] };
    else un.add(F, at2 + 1, seg, 'ธงโลกของน้ำหนัก d12 ที่ไม่รู้จัก');
    return e;
  });
  return { list, rolls, mods };
}

function targets(): { goals: TravelTarget[]; measured: TravelTarget[] } {
  const g = findTable(F, /5\. เป้าการเจอต่างเผ่า/, 'ตัวชี้วัด', 0);
  const m = findTable(F, /5\. เป้าการเจอต่างเผ่า/, 'ตัวชี้วัด', 1);
  return {
    goals: g.rows.map((r) => ({ metric: r.cells[0], target: r.cells[1], min: r.cells[2], nums: nums(r.cells[1] + ' ' + r.cells[2]), src: src(g, r.line) })),
    measured: m.rows.map((r) => ({ metric: r.cells[0], target: r.cells[3], min: `${r.cells[1]} → ${r.cells[2]}`, nums: nums(r.cells.slice(1).join(' ')), src: src(m, r.line) })),
  };
}

function routeRules() {
  const out: TravelData['routeRules'] = [];
  const lines = readDoc(F).split('\n');
  const heads = [/^### 3\.1 /, /^### 3\.4 /];
  for (const re of heads) {
    const at = lines.findIndex((l) => re.test(l));
    for (let i = at + 1; i < lines.length && !/^#{1,3} /.test(lines[i]); i++) {
      if (!lines[i].startsWith('- ')) continue;
      const events = [...new Set(lines[i].match(/\b[A-Z]{2,3}-\d\d\b/g) ?? [])];
      for (const e of events) if (!ids.events.has(e) && !ids.countries.has(e)) un.add(F, i + 1, e, 'รหัสในกติกาเส้นทาง ไม่ใช่เหตุการณ์หรือประเทศ');
      out.push({ text: strip(lines[i].replace(/^- /, '')), events: events.filter((e) => ids.events.has(e)), src: `${F}:${i + 1}` });
    }
  }
  return out;
}

export default function run() {
  const lv = levels();
  const ca = causes();
  const ov = overlays(ca.list);
  const st = stances32();
  const mo = moral();
  const rm = raceMoves();
  const en = encounters();
  const rt = routes();
  const rel = raceRelations();
  const rawAll = tables(F).map(raw);
  const skyCount = rt.filter((r) => r.sky).length;
  if (skyCount !== 4) un.add(F, 1, `ทางฟ้าไปอัซการ์ ${skyCount} ทาง`, 'เอกสารบอกสี่ทาง');
  const data: TravelData = {
    counts: {
      levels: lv.list.length,
      jobs: lv.jobs.length,
      causes: ca.list.length,
      overlays: ov.length,
      stances: st.list.length,
      raceRelations: rel.length,
      moral: mo.rules.length,
      raceMoves: rm.list.length,
      routes: rt.length,
      skyRoutes: skyCount,
      encounters: en.list.length,
      tables: rawAll.length,
    },
    levels: lv.list,
    levelTargets: lv.targets,
    jobLegs: lv.jobs,
    legRule: lv.legRule,
    causes: ca.list,
    causeRules: ca.rules,
    overlays: ov,
    routeRules: routeRules(),
    stances: st.list,
    allRacesStance: st.all,
    raceRelations: rel,
    stanceModifiers: st.mods,
    moral: mo.rules,
    bodyLimits: mo.limits,
    raceMoves: rm.list,
    deepWater: rm.deep,
    smuggle: smuggle(),
    routes: rt,
    noSmuggleText: strip(readDoc(F).split('\n').find((l) => l.startsWith('เส้นที่ปิดยังไปได้ด้วยลักลอบ')) ?? ''),
    windStill: windStill(),
    encounters: en.list,
    encounterRolls: en.rolls,
    encounterMods: en.mods,
    targets: targets(),
    raw: rawAll,
  };
  void section;
  writeGen('travel', data, [F, J], GEN);
  return finish('travel', ['travel.json'], un);
}
