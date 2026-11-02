// Bonds generator (code-plan §5.1, row "พวกพ้อง ครอบครัว ผูกตัว เดินทาง"): the nine lines and five levels, the 24 moods and
// the mood-by-line table (02), formation and invitations (03), the 12 friend templates FT (04), family and the 8 kin
// templates KN (05), the 10 paired items PR (06) and the 55 successors (07). Writes data/gen/bonds.json from
// docs/systems/bonds/*.md. The 55 hand-written flagship stories (lore/storylines/28 and 29) belong to the storylines generator.
import type { Condition, Effect } from '../../../src/core/types';
import type {
  AmongBonds,
  ArcsData,
  BChange,
  BondLevel,
  BondLine,
  BondsData,
  Candidate,
  ChildStage,
  CloseKin,
  EffectCell,
  Ending,
  FamilyData,
  Feeling,
  FeelingBan,
  FeelingsData,
  FormationData,
  Invite,
  InviteChance,
  KinCount,
  KinOrigin,
  KinRow,
  Layer,
  LineEffect,
  LineEnding,
  LineTransition,
  NpcAxisRules,
  NpcInvite,
  OccupationWeight,
  PairChoice,
  PairedData,
  PairedItem,
  PairHalf,
  PairingRules,
  PairSource,
  PairStory,
  PartyRules,
  RaceForm,
  Refusal,
  RuleRow,
  StoryStep,
  StoryTemplate,
  Successor,
  SuccessorsData,
  TiesData,
} from '../../../src/core/data/types-bonds';
import type { RawTable } from '../../../src/core/data/types-economy';
import { RACE_WORDS, parseCell, parseConditionX, textConditions } from '../lib/effects';
import { idIndex } from '../lib/ids';
import { findTable, finish, nums, statsOf, ticks, Unparsed } from '../helpers-m0b';
import { listDocs, readDoc, tables, writeGen } from '../lib/table';
import type { Table } from '../lib/table';

const B = 'docs/systems/bonds/';
const T = B + '01-ties-and-levels.md';
const FE = B + '02-feelings.md';
const FO = B + '03-formation.md';
const AR = B + '04-friend-arcs.md';
const FA = B + '05-family.md';
const PA = B + '06-paired-items.md';
const SU = B + '07-successors.md';
const GEN = 'scripts/codegen/groups/bonds.ts';
const un = new Unparsed('bonds');
const ids = idIndex();

const must = <T>(v: T | null | undefined, what: string): T => {
  if (v == null) throw new Error('bonds: missing ' + what);
  return v;
};
const strip = (s: string) => s.replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const raw = (t: Table): RawTable => ({ headings: t.headings.slice(1), header: t.header, rows: t.rows.map((r) => r.cells), src: `${t.file}:${t.line}` });
const at = (t: Table, line: number) => `${t.file}:${line}`;
const numsOf = (s: string) => nums(strip(s));
const pctsOf = (s: string) => [...strip(s).matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
const minus = (s: string) => Number(s.replace('−', '-').replace('+', ''));
const rangeOf = (s: string): [number, number] | null => {
  const m = strip(s).match(/(\d+)\s*[–-]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const THAI_NUM: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5 };

/** Rows of a two-column rule table: first cell is the key, the rest is the text, with every number found in it. */
function rules(t: Table): RuleRow[] {
  return t.rows.map((r) => {
    const text = strip(r.cells.slice(1).join(' | '));
    return { key: strip(r.cells[0]), text, nums: nums(text), src: at(t, r.line) };
  });
}
const lineOf = (text: string, re: RegExp, what: string) => {
  const m = text.match(re);
  if (!m) throw new Error(`bonds: ${what}: no match for ${re} in "${text.slice(0, 80)}"`);
  return m;
};

// ---------- the nine lines (01 §1), the moods (02 §1) ----------

const LINE_IDS: Record<string, string> = {
  สหาย: 'friend', คู่หู: 'partner', คนรัก: 'lover', ครู: 'mentor', ศิษย์: 'student', ญาติผู้ใหญ่: 'elder', ญาติรุ่นเยาว์: 'junior', พี่น้อง: 'sibling', คู่แข่ง: 'rival',
};
const LINES = Object.keys(LINE_IDS);
/** Lines named in a text, in reading order. A bare `ญาติ` stands for both kinds. */
function linesIn(text: string): string[] {
  const t = strip(text);
  const out: string[] = [];
  const re = /ญาติผู้ใหญ่|ญาติรุ่นเยาว์|ญาติ|สหาย|คู่หู|คนรัก|ครู|ศิษย์|พี่น้อง|คู่แข่ง/g;
  for (const m of t.matchAll(re)) {
    const add = m[0] === 'ญาติ' ? ['ญาติผู้ใหญ่', 'ญาติรุ่นเยาว์'] : [m[0]];
    for (const a of add) if (!out.includes(a)) out.push(a);
  }
  return out;
}

let FEELING_NAMES: string[] = [];
const moodsIn = (text: string): string[] => {
  const t = strip(text);
  return FEELING_NAMES.filter((m) => t.includes(m)).sort((a, b) => t.indexOf(a) - t.indexOf(b));
};

// ---------- effect helpers ----------

const STAT_WORDS = ['บุญคุณ', 'ทอง', 'แค้น', 'ไว้ใจ', 'ชื่อเสียง', 'ความรู้จัก', 'ศรัทธาเทพ', 'ใจ', 'B'];
/** parseCell reads "เขาใช้คืนครบ บุญคุณ +2" as a stat with a long label; the label is cut to the known word at its end, other labels are dropped. */
function tidy(effects: Effect[], file: string, line: number, why: string): { effects: Effect[]; stats: { stat: string; delta: number }[] } {
  const stats: { stat: string; delta: number }[] = [];
  const clean = (es: Effect[]): Effect[] =>
    es.flatMap((e): Effect[] => {
      if (e.k === 'stat') {
        const w = STAT_WORDS.find((x) => e.stat === x || e.stat.endsWith(' ' + x) || e.stat.endsWith(x));
        if (w) {
          stats.push({ stat: w, delta: e.delta });
          return [{ ...e, stat: w }];
        }
        un.add(file, line, `${e.stat} ${e.delta > 0 ? '+' : ''}${e.delta}`, `${why}: ชื่อค่าที่ตัวแปลสร้างจากร้อยแก้ว ไม่ใช่ค่าที่รู้จัก`);
        return [];
      }
      if (e.k === 'level' && !/^[A-Z]$/.test(e.scale)) {
        un.add(file, line, `ระดับ ${e.scale} ${e.values.join(',')}`, `${why}: "ระดับ N" ในร้อยแก้วที่ตัวแปลอ่านเป็นระดับของ B/L`);
        return [];
      }
      if (e.k === 'pick') return [{ ...e, of: e.of.map((o) => ({ ...o, effects: clean(o.effects) })) }];
      if (e.k === 'if') return [{ ...e, then: clean(e.then) }];
      return [e];
    });
  return { effects: clean(effects), stats };
}

/** parseCell for a prose cell, with the leftover phrases that carry numbers and the text conditions sent to the report. */
function cellEffects(cell: string, file: string, line: number, why: string, weighted = false) {
  const p = parseCell(cell, ids, { weighted });
  for (const u of p.unparsed) un.add(file, line, u, why);
  const t = tidy(p.effects, file, line, why);
  for (const c of new Set(textConditions(t.effects))) un.add(file, line, c, `${why}: เงื่อนไขข้อความ`);
  return { ...t, weight: p.weight, label: p.label };
}

// ---------- 01 ----------

function ties(): TiesData {
  const lt = findTable(T, /1\. สายสัมพันธ์/, 'สาย');
  const lines: BondLine[] = lt.rows.map((r) => ({
    id: must(LINE_IDS[r.cells[0]], 'line id of ' + r.cells[0]),
    name: r.cells[0],
    meaning: r.cells[1],
    legacy: ticks(r.cells[2]),
    isNew: /^ใหม่/.test(r.cells[2]),
    mainEffect: r.cells[3],
    src: at(lt, r.line),
  }));
  const vt = findTable(T, /2\. ความผูกพันและระดับ/, 'ระดับ');
  const levels: BondLevel[] = vt.rows.map((r) => {
    const [min, max] = must(rangeOf(r.cells[1]), 'B range ' + r.cells[1]);
    return { n: Number(r.cells[0]), min, max, name: r.cells[2], meaning: r.cells[3], src: at(vt, r.line) };
  });
  const all = readDoc(T).split('\n');
  const capAt = all.findIndex((l) => l.startsWith('**เพดาน**'));
  const cap = all[capAt];
  const caps = {
    close: Number(lineOf(cap, /ระดับ 3 ขึ้นไปมีพร้อมกันไม่เกิน\s*(\d+)\s*สาย/, 'cap of close bonds')[1]),
    loose: Number(lineOf(cap, /สายระดับ 1–2 มีไม่เกิน\s*(\d+)\s*สาย/, 'cap of loose bonds')[1]),
    text: strip(cap),
    src: `${T}:${capAt + 1}`,
  };
  // 2.0 axes
  const at20 = findTable(T, /2\.0/, 'ข้อ');
  const rowText = (k: string) => strip(must(at20.rows.find((r) => r.cells[0].startsWith(k)), 'axis row ' + k).cells[1]);
  const start = rowText('B เริ่มต้น');
  const known = lineOf(rowText('ย้อนกลับ'), /ทุก \+(\d+) B ความรู้จัก \+(\d+) \(ไม่เกิน (\d+)\)/, 'known axis');
  const betray = lineOf(rowText('ย้อนกลับ'), /หักหลังเขา \(−(\d+) B\) แค้นของเขาต่อตัวละคร \+(\d+)/, 'betrayal');
  const npcAxes: NpcAxisRules = {
    startBPerTrust: Number(lineOf(start, /\+ (\d+) × ไว้ใจ/, 'B per trust')[1]),
    gratitudeMin: Number(lineOf(rowText('บุญคุณ'), /บุญคุณ (\d+) ขึ้นไป/, 'gratitude level')[1]),
    gratitudeAcceptBonus: Number(lineOf(rowText('บุญคุณ'), /\+(\d+) ในโอกาสตอบรับ/, 'gratitude bonus')[1]),
    grudgeBars: Number(lineOf(rowText('แค้น'), /แค้น (\d+) ขึ้นไป/, 'grudge bar')[1]),
    knownPerB: Number(known[1]),
    knownMax: Number(known[3]),
    betrayB: -Number(betray[1]),
    betrayGrudge: Number(betray[2]),
    crisisGratitude: Number(lineOf(rowText('ย้อนกลับ'), /ช่วยผ่านวิกฤต บุญคุณ \+(\d+)/, 'crisis gratitude')[1]),
    redeemStartB: Number(lineOf(start, /B (\d+) ใน 03/, 'redeem B')[1]),
    rows: rules(at20),
  };
  // 2.1 B changes
  const ct = findTable(T, /2\.1/, 'เหตุ');
  const KEYS: [string, string][] = [
    ['เจอกันตามปกติ', 'meet'], ['ช่วยกันผ่านวิกฤต', 'crisis'], ['ช่วยเขาตอนที่เขาขอ', 'asked'], ['ความสุขร่วมกัน', 'joy'], ['อยู่ในขบวนเดียวกัน', 'party'],
    ['ให้ของที่ตรงใจ', 'gift'], ['ไม่ติดต่อกันนานกว่า 3 ปี ในประเทศเดียวกัน', 'silentSame'], ['ไม่ติดต่อกันนานกว่า 3 ปี คนละทวีป', 'silentFar'], ['ผิดคำมั่น', 'brokenPromise'],
    ['ขัดค่านิยม', 'valueClash'], ['หักหลัง', 'betray'],
  ];
  const bChanges: BChange[] = ct.rows.map((r, i) => {
    const key = KEYS.find(([p]) => r.cells[0].startsWith(p));
    if (!key) un.add(T, r.line, r.cells[0], 'สาเหตุของ B ที่ตัวสร้างไม่รู้ชื่อรหัส');
    const silent = r.cells[0].match(/นานกว่า\s*(\d+)\s*ปี/);
    return {
      id: key?.[1] ?? `b${i}`,
      cause: r.cells[0],
      delta: minus(must(r.cells[1].match(/[+−-]\d+/), 'B change ' + r.cells[1])[0]),
      perYear: /ต่อปี/.test(r.cells[1]),
      ...(silent ? { silentYears: Number(silent[1]), scope: (/คนละทวีป/.test(r.cells[0]) ? 'otherContinent' : 'sameCountry') as 'otherContinent' | 'sameCountry' } : {}),
      ...(/ไม่เกินหนึ่งครั้ง/.test(r.cells[0]) ? { maxPerYear: 1 } : {}),
      changesLine: /สายเปลี่ยน/.test(r.cells[1]),
      text: strip(r.cells.join(' | ')),
      src: at(ct, r.line),
    };
  });
  // 3 effects by line and level
  const et = findTable(T, /3\. ผลตามสายและระดับ/, 'สาย');
  const cell = (s: string): EffectCell => ({ text: strip(s), pcts: pctsOf(s), nums: numsOf(s) });
  const lineEffects: LineEffect[] = et.rows.map((r) => {
    const m = r.cells[0].match(/^(.+?)\s*\((.+)\)$/);
    return { line: m ? m[1] : r.cells[0], ...(m ? { variant: m[2] } : {}), lv3: cell(r.cells[1]), lv4: cell(r.cells[2]), lv5: cell(r.cells[3]), src: at(et, r.line) };
  });
  const partyAt = all.findIndex((l) => l.startsWith('**ผู้ร่วมทาง**'));
  const pt = all[partyAt];
  const legend = lineOf(pt, /ผู้ร่วมทางระดับ (\d) ขึ้นไป(สอง|สาม|สี่|ห้า)คน/, 'legend companions');
  const party: PartyRules = {
    maxParty: Number(lineOf(pt, /ขบวนมีได้ไม่เกิน\s*(\d+)\s*คน/, 'party size')[1]),
    bonusCapPct: Number(lineOf(pt, /โบนัสไม่เกิน\s*\+(\d+)%/, 'party bonus')[1]),
    damageCutCapPct: Number(lineOf(pt, /ลดความเสียหายไม่เกิน\s*(\d+)%/, 'party damage cut')[1]),
    legendMinLevel: Number(legend[1]),
    legendCount: THAI_NUM[legend[2]],
    text: strip(pt),
    src: `${T}:${partyAt + 1}`,
  };
  // 4 transitions
  const tt = findTable(T, /4\. การเปลี่ยนสาย/, 'จาก');
  const transitions: LineTransition[] = tt.rows.map((r) => {
    const lvl = r.cells[2].match(/ระดับ\s*(\d)\s*ขึ้นไป/);
    return {
      from: r.cells[0],
      fromLines: linesIn(r.cells[0]),
      to: r.cells[1],
      toLines: linesIn(r.cells[1]),
      whenRaw: r.cells[2],
      ...(lvl ? { minLevel: Number(lvl[1]) } : {}),
      ...(/อย่างน้อยหนึ่งปี/.test(r.cells[2]) ? { togetherYears: 1 } : {}),
      toNemesis: /ศัตรูตลอดกาล/.test(r.cells[1]),
      src: at(tt, r.line),
    };
  });
  const banAt = all.findIndex((l) => l.startsWith('**ห้าม**'));
  const forbidden = all[banAt].replace('**ห้าม**', '').split(/\s+·\s+/).map((x) => ({ text: strip(x), nums: numsOf(x) }));
  // 5 endings
  const nt = findTable(T, /5\. การสิ้นสุดของสาย/, 'ทางสิ้นสุด');
  const END_IDS = ['death', 'fade', 'split', 'betray', 'goodEnd'] as const;
  if (nt.rows.length !== END_IDS.length) un.add(T, nt.line, `${nt.rows.length} ทางสิ้นสุด`, 'ตัวสร้างรู้ห้าทาง');
  const endings: LineEnding[] = nt.rows.map((r, i) => {
    const ce = cellEffects(r.cells[2], T, r.line, 'การสิ้นสุดของสาย ' + r.cells[0]);
    const setB = r.cells[2].match(/B ตกเหลือ\s*(\d+)/);
    const delta = r.cells[2].match(/B\s*[−-](\d+)/);
    return {
      id: END_IDS[i],
      way: r.cells[0],
      whenRaw: r.cells[1],
      effectRaw: strip(r.cells[2]),
      effects: ce.effects,
      ...(setB ? { setB: Number(setB[1]) } : {}),
      ...(delta ? { deltaB: -Number(delta[1]) } : {}),
      src: at(nt, r.line),
    };
  });
  const capHeir = all.find((l) => l.startsWith('**เรื่องของพวกพ้องที่ยังไม่จบ'));
  const heirOpenThreadCap = Number(lineOf(capHeir ?? '', /ตามเพดานเดิม\s*(\d+)\s*ข้อ/, 'heir open-thread cap')[1]);
  return {
    lines,
    levels,
    caps,
    npcAxes,
    bChanges,
    lineEffects,
    party,
    transitions,
    forbidden,
    endings,
    heirOpenThreadCap,
    tests: rules(findTable(T, /6\. ที่ต้องทดสอบ/, 'ข้อ')),
  };
}

// ---------- 02 ----------

function feelings(): FeelingsData {
  const ft = findTable(FE, /1\. อารมณ์ 24 อย่าง/, 'อารมณ์');
  const list: Feeling[] = ft.rows.map((r) => ({ name: r.cells[0], meaning: r.cells[1], cause: r.cells[2], src: at(ft, r.line) }));
  FEELING_NAMES = list.map((f) => f.name);
  const mt = findTable(FE, /2\. ตารางว่าสายไหน/, 'อารมณ์');
  const head = mt.header.slice(1);
  if (head.join('|') !== LINES.join('|')) un.add(FE, mt.line, head.join(' '), 'หัวคอลัมน์ของตารางอารมณ์ไม่ตรงลำดับสายของ 01 §1');
  const matrix: FeelingsData['matrix'] = {};
  for (const r of mt.rows) {
    const mood = r.cells[0].replace(/\*/g, '');
    if (!FEELING_NAMES.includes(mood)) un.add(FE, r.line, mood, 'อารมณ์ในตารางที่ไม่มีใน 24 อย่าง');
    matrix[mood] = Object.fromEntries(head.map((h, i) => [h, r.cells[i + 1] === '-' ? null : Number(r.cells[i + 1])]));
  }
  const bt = findTable(FE, /3\. ข้อห้าม/, 'อารมณ์');
  const bans: FeelingBan[] = bt.rows.map((r) => ({
    moods: moodsIn(r.cells[0]),
    allowedRaw: r.cells[1],
    forbiddenRaw: r.cells[2],
    allowed: linesIn(r.cells[1]),
    forbidden: linesIn(r.cells[2]),
    substituteRaw: strip(r.cells[3]),
    src: at(bt, r.line),
  }));
  const rt = findTable(FE, /4\. กติกาอื่น/, 'ข้อ');
  const ruleRows = rules(rt);
  const rowOf = (n: string) => must(ruleRows.find((x) => x.key === n), 'mood rule ' + n);
  const limits = { moodsAtOnce: rowOf('2').nums[0], perLinePerYear: rowOf('3').nums[0] };
  const wt = findTable(FE, /5\. วิธีแสดงออก/, 'ทาง');
  const ht = findTable(FE, /5\. วิธีแสดงออก/, 'อารมณ์', 0);
  const heart = ht.rows.map((r) => {
    const moods = moodsIn(r.cells[0]);
    if (!moods.length) un.add(FE, r.line, r.cells[0], 'ผลต่อใจ: ไม่พบชื่ออารมณ์');
    return { moods, delta: minus(r.cells[1].match(/[+−-]?\d+/)![0]), bloodFeud: /ศึกสายเลือด/.test(r.cells[1]), text: strip(r.cells[1]) };
  });
  const heartByMood: Record<string, number> = {};
  for (const h of heart) for (const m of h.moods) heartByMood[m] = h.delta;
  const missing = FEELING_NAMES.filter((m) => !(m in heartByMood));
  if (missing.length) un.add(FE, ht.line, missing.join(' '), 'ผลต่อใจ: อารมณ์ที่ไม่ได้ระบุผล');
  const tt = findTable(FE, /5\. วิธีแสดงออก/, 'อารมณ์และสาย');
  const tone = tt.rows.map((r) => {
    const m = must(r.cells[0].match(/^(.+?)\s*\((.+)\)$/), 'tone label ' + r.cells[0]);
    const min = matrix[m[1]]?.[m[2]];
    if (min == null) un.add(FE, r.line, r.cells[0], 'ตัวอย่างน้ำเสียงใช้อารมณ์ที่ตารางห้ามสายนั้น');
    return { mood: m[1], line: m[2], text: r.cells[1], allowed: min != null };
  });
  return {
    feelings: list,
    matrix,
    bans,
    rules: ruleRows,
    limits,
    expression: wt.rows.map((r) => ({ way: r.cells[0], usedFor: r.cells[1], note: strip(r.cells[2]) })),
    heart,
    heartByMood,
    tone,
    marker: '{สาย:อารมณ์@ระดับ}',
  };
}

// ---------- 03 ----------

function formation(): FormationData {
  const SRC_IDS = ['childhood', 'kin', 'school', 'journey', 'redeem', 'work', 'clash', 'event', 'firstLove', 'taught'];
  const ct = findTable(FO, /1\. พวกพ้องมาจากไหน/, 'ที่มา');
  if (ct.rows.length !== SRC_IDS.length) un.add(FO, ct.line, `${ct.rows.length} ที่มา`, 'ตัวสร้างรู้สิบที่มา');
  const candidates: Candidate[] = ct.rows.map((r, i) => {
    const lvl = r.cells[3].match(/^(\d)(?:\s*\(B\s*(\d+))/);
    const age = r.cells[1] === 'ทุกวัย' ? null : (rangeOf(r.cells[1]) ?? ((n) => (n.length ? ([n[0], n[0]] as [number, number]) : null))(numsOf(r.cells[1])));
    return {
      id: SRC_IDS[i],
      source: strip(r.cells[0]),
      ageRaw: r.cells[1],
      age,
      chanceRaw: strip(r.cells[2]),
      chances: pctsOf(r.cells[2]).map((x) => x / 100),
      startLevelRaw: r.cells[3],
      startLevel: lvl ? Number(lvl[1]) : /^\d$/.test(r.cells[3]) ? Number(r.cells[3]) : null,
      ...(lvl?.[2] ? { startB: Number(lvl[2]) } : {}),
      lines: linesIn(r.cells[4]),
      src: at(ct, r.line),
    };
  });
  const pt = findTable(FO, /2\. ข้อพิจารณาตอนจับคู่/, 'ข้อ');
  const prow = (k: string) => strip(must(pt.rows.find((r) => r.cells[0].startsWith(k)), 'pairing row ' + k).cells[1]);
  const age = prow('อายุ');
  const held = prow('ผู้ถูกผูกตัว');
  const pairing: PairingRules = {
    friendMaxAgeGap: Number(lineOf(age, /สหายและคู่หูต่างกันไม่เกิน\s*(\d+)/, 'friend age gap')[1]),
    loverMaxAgeGap: Number(lineOf(age, /คนรักต่างกันไม่เกิน\s*(\d+)/, 'lover age gap')[1]),
    studentYoungerBy: Number(lineOf(age, /เด็กกว่าตัวละครอย่างน้อย\s*(\d+)/, 'student age gap')[1]),
    heldMaxLevel: Number(lineOf(held, /ผูกพันได้สูงสุดระดับ\s*(\d)/, 'held max level')[1]),
    freedStartLevel: Number(lineOf(held, /ปล่อยแล้วเริ่มที่ระดับ\s*(\d)/, 'freed start level')[1]),
    rows: rules(pt),
  };
  const it = findTable(FO, /3\. การชวน/, 'ชนิดการชวน');
  const INV_IDS = ['travel', 'business', 'lover', 'spouse', 'mentor', 'student', 'reconcile'];
  const invites: Invite[] = it.rows.map((r, i) => {
    const party = r.cells[3].match(/ไม่เกิน\s*(\d+)/);
    return {
      id: INV_IDS[i] ?? `invite${i}`,
      kind: r.cells[0],
      whenRaw: strip(r.cells[1]),
      minLevel: /^\d$/.test(r.cells[2]) ? Number(r.cells[2]) : null,
      resultRaw: r.cells[3],
      ...(linesIn(r.cells[3])[0] ? { resultLine: linesIn(r.cells[3])[0] } : {}),
      ...(party ? { partyMax: Number(party[1]) } : {}),
      src: at(it, r.line),
    };
  });
  const all = readDoc(FO).split('\n');
  const fAt = all.findIndex((l) => l.startsWith('**โอกาสที่อีกฝ่ายตอบรับ**'));
  const f = lineOf(all[fAt], /=\s*(\d+)\s*\+\s*\(([\d.]+)\s*×\s*B\)[^แ]*แล้วจำกัดไว้ระหว่าง\s*(\d+)\s*และ\s*(\d+)/, 'accept formula');
  const tt = findTable(FO, /3\. การชวน/, 'พจน์');
  const terms = (label: string) => {
    const row = must(tt.rows.find((r) => r.cells[0] === label), 'accept term ' + label);
    return row.cells[1].split(/\s+·\s+/).map((seg) => {
      const m = must(seg.match(/^([+−-]\d+)\s+ถ้า(.+)$/), 'accept term ' + seg);
      const cond = parseConditionX(m[2], ids, true) as Condition | null;
      if (cond) for (const c of new Set(textConditions(cond))) un.add(FO, row.line, c, `ชวน ${label}: เงื่อนไขข้อความ`);
      else un.add(FO, row.line, m[2], `ชวน ${label}: อ่านเงื่อนไขไม่ได้`);
      return { delta: minus(m[1]), condRaw: m[2], cond };
    });
  };
  const inviteChance: InviteChance = { base: Number(f[1]), perB: Number(f[2]), min: Number(f[3]), max: Number(f[4]), formula: strip(all[fAt]), compat: terms('ความเข้ากัน'), burden: terms('ภาระ'), src: `${FO}:${fAt + 1}` };
  const rt = findTable(FO, /3\. การชวน/, 'ผล');
  const REF_IDS = ['plain', 'condition', 'hurt'] as const;
  const refusals: Refusal[] = rt.rows.map((r, i) => {
    const ce = cellEffects(r.cells[2], FO, r.line, 'ปฏิเสธการชวน ' + r.cells[0]);
    const b = r.cells[2].match(/B\s*[−-](\d+)/);
    return {
      id: REF_IDS[i],
      chance: pctsOf(r.cells[1])[0] / 100,
      name: r.cells[0],
      effectRaw: strip(r.cells[2]),
      deltaB: b ? -Number(b[1]) : 0,
      moods: /ตามสาย/.test(r.cells[2]) || /อารมณ์/.test(r.cells[2]) ? moodsIn(r.cells[2]) : [],
      opensGate: /เป็นด่าน/.test(r.cells[2]),
      src: at(rt, r.line),
    };
    void ce;
  });
  const npcAt = all.findIndex((l) => l.startsWith('**NPC เป็นฝ่ายชวนตัวละคร**'));
  const nm = lineOf(all[npcAt], /ขั้นวิกฤตของเรื่องตน\s*และ B ถึงระดับ\s*(\d)/, 'npc invite');
  const npcInvite: NpcInvite = { stage: 3, minLevel: Number(nm[1]), text: strip(all[npcAt]), src: `${FO}:${npcAt + 1}` };
  const apart = rules(findTable(FO, /4\. ชีวิตของพวกพ้องเมื่อห่างกัน/, 'ข้อ', 0));
  const newsRow = must(apart.find((r) => r.key.startsWith('เรื่องไปถึง')), 'news row');
  const delay = lineOf(newsRow.text, /ต่างทวีป:\s*ล่าช้า\s*(\d+)[–-](\d+)\s*ปี/, 'news delay');
  const news = { otherContinentDelay: [Number(delay[1]), Number(delay[2])] as [number, number], sameCountryPerYear: 1, text: newsRow.text, src: newsRow.src };
  if (!/ประเทศเดียวกัน:\s*จดหมายหรือข่าวอย่างมากปีละครั้ง/.test(newsRow.text)) un.add(FO, 1, newsRow.text.slice(0, 80), 'ข่าวในประเทศเดียวกัน "ปีละครั้ง" อ่านไม่ได้');
  // 4.1
  const amt = findTable(FO, /4\.1/, 'ข้อ');
  const arow = (k: string) => strip(must(amt.rows.find((r) => r.cells[0] === k), 'among row ' + k).cells[1]);
  const wmap = arow('สายที่เกิด');
  const lineWeights: Record<string, number> = {};
  for (const m of wmap.matchAll(/(สหาย|คู่แข่ง|คนรัก)\s+(\d+)/g)) lineWeights[m[1]] = Number(m[2]);
  const sideFeel = lineOf(arow('ผลต่อเรื่อง'), /B ของฝ่ายที่ไม่ถูกเลือก\s*([−-]\d+)/, 'side penalty');
  const yearsRange = lineOf(all.join('\n'), /ทอยครั้งเดียว\s*(\d+)[–-](\d+)\s*ปีชีวิต/, 'pair story years');
  const among: AmongBonds = {
    minLevel: Number(lineOf(arow('เงื่อนไข'), /ที่ระดับ\s*(\d)\s*ขึ้นไป/, 'among min level')[1]),
    chancePerYear: Number(lineOf(arow('โอกาส'), /(\d+)%/, 'among chance')[1]) / 100,
    lineWeights,
    maxOpenPairs: Number(lineOf(arow('เพดาน'), /ไม่เกิน\s*(\d+)\s*สาย/, 'among cap')[1]),
    storyYears: [Number(yearsRange[1]), Number(yearsRange[2])],
    sidePenaltyB: minus(sideFeel[1]),
    rows: rules(amt),
    src: at(amt, amt.line),
  };
  // pair stories
  const pst = findTable(FO, /4\.1/, 'สาย');
  const dwAt = all.findIndex((l) => l.startsWith('**เมื่อคนหนึ่งตาย**'));
  const dwText = strip(all[dwAt]);
  const weightsOf = (word: string): [number, number, number] => {
    const seg = must(dwText.split(/\s+·\s+/).find((x) => x.startsWith(word) || x.includes(` ${word} ก)`)), 'death weights of ' + word);
    const body = seg.slice(seg.indexOf(word));
    const w = Object.fromEntries([...body.matchAll(/([กขค])\)\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
    if (w['ก'] == null || w['ข'] == null || w['ค'] == null) throw new Error(`bonds: death weights of ${word} not read from "${body}"`);
    return [w['ก'], w['ข'], w['ค']];
  };
  const deathW: Record<string, [number, number, number]> = { สหาย: [40, 35, 25], คู่แข่ง: weightsOf('คู่แข่ง'), คนรัก: weightsOf('คนรัก') };
  if (!/สหาย\s*40\s*·?\s*35\s*·?\s*25 ตามเดิม/.test(dwText)) un.add(FO, dwAt + 1, dwText.slice(0, 90), 'น้ำหนักเมื่อคนหนึ่งตายของสหาย "ตามเดิม" อ่านไม่ได้');
  const pairStories: PairStory[] = pst.rows.map((r) => {
    const keys = ['a', 'b', 'c'] as const;
    const choices: PairChoice[] = r.cells.slice(2, 5).map((c, i) => {
      const ce = cellEffects(c, FO, r.line, `เรื่องของคู่ ${r.cells[0]} ${keys[i]}`, true);
      return { key: keys[i], weight: ce.weight ?? 0, label: strip(c.replace(/^\d+\s+/, '')), effects: ce.effects };
    });
    const w = deathW[r.cells[0]];
    if (!w) un.add(FO, r.line, r.cells[0], 'สายของเรื่องคู่ที่ไม่มีน้ำหนักเมื่อคนหนึ่งตาย');
    return { line: r.cells[0], story: r.cells[1], choices, deathWeights: w ?? [0, 0, 0], ...(r.cells[0] === 'คนรัก' && /ทาง ก ถูกตัด/.test(dwText) ? { deathCut: 'a' as const } : {}), src: at(pst, r.line) };
  });
  // 5 occupations
  const ot = findTable(FO, /5\. อาชีพกับสายที่เกิดบ่อย/, 'กลุ่มอาชีพ');
  const occupations: OccupationWeight[] = ot.rows.map((r) => ({
    groupRaw: r.cells[0],
    lines: [...strip(r.cells[1]).matchAll(/(ญาติผู้ใหญ่|ญาติรุ่นเยาว์|ญาติ|สหาย|คู่หู|คนรัก|ครู|ศิษย์|พี่น้อง|คู่แข่ง)\s*×(\d+(?:\.\d+)?)(?:\s*\(([^)]*)\))?/g)].flatMap((m) =>
      (m[1] === 'ญาติ' ? ['ญาติผู้ใหญ่', 'ญาติรุ่นเยาว์'] : [m[1]]).map((line) => ({ line, mul: Number(m[2]), ...(m[3] ? { note: m[3] } : {}) })),
    ),
    example: strip(r.cells[2]),
    src: at(ot, r.line),
  }));
  for (const o of occupations) if (!o.lines.length) un.add(FO, 1, o.groupRaw, 'กลุ่มอาชีพที่ไม่พบตัวคูณสาย');
  return { candidates, pairing, invites, inviteChance, refusals, npcInvite, apart, news, among, pairStories, occupations, tests: rules(findTable(FO, /6\. ที่ต้องทดสอบ/, 'ข้อ')) };
}

// ---------- 04 and 05 stories ----------

const mark = (s: string) => [...s.matchAll(/\{([^:{}]+):([^@{}]+)@(\d)\}/g)].map((m) => ({ line: m[1], mood: m[2], level: Number(m[3]) }));

function endings(cell: string, file: string, line: number, id: string): Ending[] {
  const segs = cell.split(/\s+·\s+(?=\d+\s)/);
  if (segs.length !== 3) un.add(file, line, strip(cell).slice(0, 80), `${id}: ปลายทางไม่ใช่สามทาง (พบ ${segs.length})`);
  return segs.map((seg, i) => {
    const key = (['a', 'b', 'c'] as const)[i];
    const w = seg.match(/^(\d+)\s+/);
    const body = seg.replace(/^\d+\s+/, '');
    const ce = cellEffects(body, file, line, `${id} ปลายทาง ${key}`);
    const link = body.match(/\[[^\]]*\]\([^)]*?(\d\d-[a-z-]+)\.md\)/);
    return {
      key,
      weight: w ? Number(w[1]) : 0,
      label: strip(body),
      effects: ce.effects,
      opensLines: [...new Set([...body.matchAll(/เปิดเส้น\s+([a-z]{2})\b/g)].map((m) => m[1]))],
      ...(link ? { opensFile: link[1] } : {}),
      stats: ce.stats,
      templates: [...new Set(body.match(/\b(?:FT|KN|PR)-\d\d\b/g) ?? [])],
    };
  });
}

function templates(file: string, first: Table, second: Table, prefix: 'FT' | 'KN'): StoryTemplate[] {
  const byId = new Map(second.rows.map((r) => [strip(r.cells[0]).replace(/`/g, ''), r]));
  return first.rows.map((r) => {
    const id = strip(r.cells[0]).replace(/`/g, '');
    if (!id.startsWith(prefix)) un.add(file, r.line, id, `รหัสแม่แบบต้องขึ้นต้น ${prefix}`);
    const s = must(byId.get(id), 'story row of ' + id);
    const fitCell = prefix === 'FT' ? r.cells[3] : '';
    const linesCell = r.cells[2];
    const moodsCell = prefix === 'FT' ? r.cells[4] : r.cells[3];
    const noClass = fitCell.replace(/ชนชั้น\s*\d\s*[–-]\s*\d/, '');
    const age = rangeOf(noClass);
    const cls = fitCell.match(/ชนชั้น\s*(\d)\s*[–-]\s*(\d)/);
    const moods = mark(moodsCell);
    if (!moods.length) un.add(file, r.line, moodsCell, `${id}: ไม่พบเครื่องหมายอารมณ์`);
    const st = prefix === 'FT' ? { s2: s.cells[1], s3: s.cells[2], s4: s.cells[3], end: s.cells[4] } : { s2: s.cells[1], s3: s.cells[2], s4: s.cells[3], end: s.cells[4] };
    return {
      id,
      name: r.cells[1],
      linesRaw: linesCell,
      lines: linesIn(linesCell),
      allLines: /ทุกสาย/.test(linesCell),
      fitRaw: fitCell,
      ...(age ? { age } : {}),
      ...(cls ? { classRange: [Number(cls[1]), Number(cls[2])] as [number, number] } : {}),
      ...(/สงครามในประเทศ/.test(fitCell) ? { fitCond: { k: 'place', kinds: ['war'] } as Condition } : {}),
      moods,
      stage2: strip(st.s2),
      stage3: strip(st.s3),
      stage4: strip(st.s4),
      endings: endings(st.end, file, s.line, id),
      src: `${file}:${r.line}`,
    };
  });
}

function arcs(): ArcsData {
  const lt = findTable(AR, /1\. สามชั้นของเรื่อง/, 'ชั้น');
  const layers: Layer[] = lt.rows.map((r) => ({ n: Number(r.cells[0].match(/^\d/)![0]), name: r.cells[0].replace(/^\d\s*/, ''), what: strip(r.cells[1]), usedFor: strip(r.cells[2]), good: strip(r.cells[3]), limit: strip(r.cells[4]) }));
  const st = findTable(AR, /2\. ห้าขั้น/, 'ขั้น');
  const steps: StoryStep[] = st.rows.map((r) => ({
    n: Number(r.cells[0].match(/^\d/)![0]),
    name: r.cells[0].replace(/^\d\s*/, ''),
    openLevel: Number(r.cells[1].match(/\d/)![0]),
    orEnd: /หรือสิ้นสาย/.test(r.cells[1]),
    what: strip(r.cells[2]),
  }));
  const all = readDoc(AR).split('\n');
  const eAt = all.findIndex((l) => l.startsWith('**ปลายทางที่เปลี่ยนบทบาทในโลก**'));
  const e = all[eAt];
  const ew = lineOf(e, /\(น้ำหนัก\s*(\d+)\s*(\d+)\s*(\d+)\)/, 'end-role weights');
  const endRole = { weights: [Number(ew[1]), Number(ew[2]), Number(ew[3])] as [number, number, number], heirRollPct: Number(lineOf(e, /ทอยผู้สืบ\s*(\d+)%/, 'end-role heir roll')[1]), text: strip(e), src: `${AR}:${eAt + 1}` };
  const t1 = findTable(AR, /3\. แม่แบบ 12 แบบ/, 'ID', 0);
  const t2 = findTable(AR, /3\. แม่แบบ 12 แบบ/, 'ID', 1);
  const list = templates(AR, t1, t2, 'FT');
  const rf = findTable(AR, /3\. แม่แบบ 12 แบบ/, 'แม่แบบ');
  const raceForms: RaceForm[] = rf.rows.map((r) => ({
    template: strip(r.cells[0]).replace(/`/g, ''),
    racesRaw: r.cells[1],
    races: [...new Set(RACE_WORDS.filter(([w]) => r.cells[1].includes(w)).map(([, c]) => c))],
    form: strip(r.cells[2]),
    src: at(rf, r.line),
  }));
  const gt = findTable(AR, /5\. เกณฑ์เลือก NPC ธง/, 'เกณฑ์', 0);
  const at2 = findTable(AR, /5\. เกณฑ์เลือก NPC ธง/, 'เกณฑ์', 1);
  const nodesOf = (line: string) => [...ids.nodes].filter((n) => n.startsWith(line + '.')).sort();
  return {
    layers,
    steps,
    nodes: { bn: nodesOf('bn'), kn: nodesOf('kn') },
    endRole,
    templates: list,
    raceForms,
    quality: rules(findTable(AR, /4\. กติกาคุณภาพ/, 'ข้อ')),
    flagship: {
      criteria: rules(gt),
      actual: at2.rows.map((r) => ({ criterion: r.cells[0], target: strip(r.cells[1]), actual: strip(r.cells[2]), nums: numsOf(r.cells[2]), src: at(at2, r.line) })),
    },
  };
}

function dist(cell: string): KinCount {
  const c = strip(cell);
  const d = [...c.matchAll(/(\d+)\s*ตัว(ขึ้นไป)?\s*(\d+)%/g)].map((m) => ({ n: Number(m[1]), pct: Number(m[3]), orMore: !!m[2] }));
  if (d.length) {
    if (d.reduce((a, x) => a + x.pct, 0) !== 100) un.add(FA, 1, c.slice(0, 80), 'ตารางจำนวนญาติรวมไม่ถึง 100%');
    return { dist: d, range: null };
  }
  const range = c.match(/0\s*[–-]\s*(\d)\s*(?:คน)?$/);
  return { dist: null, range: range ? [0, Number(range[1])] : null };
}

function family(): FamilyData {
  const kt = findTable(FA, /1\. โครงญาติตอนเกิด/, 'ญาติ');
  const kin: KinRow[] = kt.rows.map((r) => {
    const lv = r.cells[3];
    const two = lv.match(/^(\d)\s*ถ้า.*?(\d)\s*ถ้า/);
    return {
      relative: r.cells[0],
      term: r.cells[1],
      countRaw: strip(r.cells[2]),
      count: dist(r.cells[2]),
      startLevelRaw: lv,
      startLevel: two ? Number(two[1]) : Number(lv),
      ...(two ? { startLevelFar: Number(two[2]) } : {}),
      src: at(kt, r.line),
    };
  });
  const ot = findTable(FA, /1\. โครงญาติตอนเกิด/, 'เผ่าหรือจุดกำเนิด');
  const origins: KinOrigin[] = ot.rows.map((r) => {
    const lvOf = (s: string) => s.match(/ระดับ\s*(\d)/)?.[1];
    return {
      originRaw: r.cells[0],
      nodes: [...new Set(r.cells[0].match(/\b[a-z]{2}\.[btaelx]\d+\b/g) ?? [])].filter((n) => (ids.nodes.has(n) ? true : (un.add(FA, r.line, n, 'โหนดที่ไม่มีในเส้นเรื่อง'), false))),
      elderRaw: strip(r.cells[1]),
      elderLevel: lvOf(r.cells[1]) ? Number(lvOf(r.cells[1])) : null,
      siblingRaw: strip(r.cells[2]),
      siblingLevel: lvOf(r.cells[2]) ? Number(lvOf(r.cells[2])) : null,
      siblingRange: rangeOf(r.cells[2].replace(/ระดับ.*/, '')),
      src: at(ot, r.line),
    };
  });
  const all = readDoc(FA).split('\n');
  const cAt = all.findIndex((l) => l.startsWith('**ญาติใกล้ชิด**'));
  const c = all[cAt];
  const ages = lineOf(c, /อายุ\s*(\d+)[–-](\d+)\s*สุ่มญาติ/, 'close kin age');
  const flagNpcs = [...new Set(c.match(/\b[A-Z]{2}\d{2}-\d\b/g) ?? [])];
  for (const n of flagNpcs) if (!ids.npcs.has(n)) un.add(FA, cAt + 1, n, 'NPC ธงญาติที่ไม่มีในไฟล์ NPC');
  const closeKin: CloseKin = {
    ageMin: Number(ages[1]),
    ageMax: Number(ages[2]),
    count: 1,
    countBigHouse: 2,
    minClassForTwo: Number(lineOf(c, /ชนชั้น\s*(\d)\s*ขึ้นไปหรือบ้านใหญ่/, 'close kin class')[1]),
    flagChance: Number(lineOf(c, /มีโอกาส\s*(\d+)%/, 'flag kin chance')[1]) / 100,
    flagNpcs,
    text: strip(c),
    src: `${FA}:${cAt + 1}`,
  };
  const st = findTable(FA, /2\. แม่แบบญาติ 8 แบบ/, 'ID', 0);
  const st2 = findTable(FA, /2\. แม่แบบญาติ 8 แบบ/, 'ID', 1);
  const tpl = templates(FA, st, st2, 'KN');
  const ct = findTable(FA, /3\. ญาติรุ่นเยาว์/, 'ช่วงอายุลูก');
  const stages: ChildStage[] = ct.rows.map((r) => {
    const ce = cellEffects(r.cells[2], FA, r.line, 'ลูก ' + r.cells[0]);
    return { ageRaw: r.cells[0], age: rangeOf(r.cells[0]), moods: moodsIn(r.cells[1].replace(/\(.*?\)/g, '')), effectRaw: strip(r.cells[2]), effects: ce.effects, src: at(ct, r.line) };
  });
  const startAt = all.findIndex((l) => l.startsWith('ลูกเป็นสายญาติรุ่นเยาว์'));
  const adAt = all.findIndex((l) => l.startsWith('**ลูกบุญธรรม**'));
  const ad = lineOf(all[adAt], /ผูกพันเริ่มที่ระดับ\s*(\d)\s*และเลื่อนเร็วกว่า\s*\(\+(\d+)\s*ต่อปี/, 'adopted child');
  const sys = findTable(FA, /4\. ครอบครัวกับระบบอื่น/, 'ระบบ');
  return {
    kin,
    origins,
    closeKin,
    templates: tpl,
    children: {
      startLevel: Number(lineOf(all[startAt], /ระดับเริ่ม\s*(\d)/, 'child start level')[1]),
      stages,
      adopted: { startLevel: Number(ad[1]), plusPerYear: Number(ad[2]), text: strip(all[adAt]) },
      src: `${FA}:${startAt + 1}`,
    },
    withSystems: sys.rows.map((r) => ({ system: r.cells[0], text: strip(r.cells[1]) })),
  };
}

// ---------- 06 ----------

const LINE_SYNONYMS: [string, string][] = [
  ['สหาย', 'สหาย'], ['คู่หู', 'คู่หู'], ['คนรัก', 'คนรัก'], ['คู่ชีวิต', 'คนรัก'], ['ครู', 'ครู'], ['ศิษย์', 'ศิษย์'], ['พี่น้อง', 'พี่น้อง'], ['คู่แข่ง', 'คู่แข่ง'], ['พ่อแม่', 'ญาติผู้ใหญ่'], ['ลูก', 'ญาติรุ่นเยาว์'],
];
function paired(): PairedData {
  const rt = findTable(PA, /1\. กติกา/, 'ข้อ');
  const rr = rules(rt);
  const rule2 = must(rr.find((r) => r.key === '2'), 'paired rule 2').text;
  const rule6 = must(rr.find((r) => r.key === '6'), 'paired rule 6').text;
  const full = {
    minLevel: Number(lineOf(rule2, /ระดับ\s*(\d)\s*ขึ้นไป/, 'full-effect level')[1]),
    sameContinent: /ทวีปเดียวกัน/.test(rule2),
    sellPenaltyB: minus(lineOf(rule6, /B\s*([−-]\d+)/, 'sale penalty')[1]),
  };
  const st = findTable(PA, /2\. ที่มา/, 'ที่มา');
  const sources: PairSource[] = st.rows.map((r) => {
    const p = pctsOf(r.cells[1]);
    return {
      source: strip(r.cells[0]),
      chanceRaw: strip(r.cells[1]),
      chance: p.length ? p[0] / 100 : null,
      tiers: [...strip(r.cells[1]).matchAll(/ระดับ\s*([CURE])\s*ถึง\s*([CURE])/g)].flatMap((m) => ['C', 'U', 'R', 'E'].slice('CURE'.indexOf(m[1]), 'CURE'.indexOf(m[2]) + 1)),
      example: strip(r.cells[2]),
      templates: [...new Set(strip(r.cells.join(' ')).match(/\bPR-\d\d\b/g) ?? [])],
      src: at(st, r.line),
    };
  });
  const ht = findTable(PA, /3\. ซีกของไอเทมคู่/, 'ID');
  const pt = findTable(PA, /4\. คู่และผล/, 'ID');
  const pairOf = new Map<string, string>();
  for (const r of pt.rows) for (const id of r.cells[1].match(/pr_[a-z_]+/g) ?? []) pairOf.set(id, strip(r.cells[0]).replace(/`/g, ''));
  const halves: PairHalf[] = ht.rows.map((r) => {
    if (!pairOf.has(r.cells[0])) un.add(PA, r.line, r.cells[0], 'ซีกที่ไม่อยู่ในคู่ใดของตารางคู่');
    return { id: r.cells[0], pair: pairOf.get(r.cells[0]) ?? '', name: r.cells[1], tier: r.cells[2], singleRaw: strip(r.cells[3]), stats: statsOf(r.cells[3]), src: at(ht, r.line) };
  });
  const pairs: PairedItem[] = pt.rows.map((r) => {
    const hs = r.cells[1].match(/pr_[a-z_]+/g) ?? [];
    if (hs.length !== 2) un.add(PA, r.line, r.cells[1], 'คู่ไม่ได้มีสองซีก');
    const lineSet = new Set<string>();
    for (const [w, line] of LINE_SYNONYMS) if (r.cells[2].includes(w)) lineSet.add(line);
    return {
      id: strip(r.cells[0]).replace(/`/g, ''),
      halves: [hs[0] ?? '', hs[1] ?? ''],
      linesRaw: r.cells[2],
      lines: [...lineSet],
      races: [...new Set(RACE_WORDS.filter(([w]) => r.cells[2].includes(w)).map(([, c]) => c))],
      fullRaw: strip(r.cells[3]),
      fullPcts: pctsOf(r.cells[3]),
      memorialRaw: strip(r.cells[4]),
      story: strip(r.cells[5]),
      templates: [...new Set(strip(r.cells[3] + ' ' + r.cells[4]).match(/\b(?:FT|KN)-\d\d\b/g) ?? [])],
      src: at(pt, r.line),
    };
  });
  return { rules: rr, full, sources, halves, pairs };
}

// ---------- 07 ----------

function successors(): SuccessorsData {
  const rt = findTable(SU, /1\. กติกา/, 'ข้อ');
  const rr = rules(rt);
  const rule5 = must(rr.find((r) => r.key.startsWith('5')), 'successor rule 5').text;
  const rule4 = must(rr.find((r) => r.key.startsWith('4')), 'successor rule 4').text;
  const lt = findTable(SU, /2\. รายชื่อ 55 คน/, 'รหัสผู้สืบ');
  const seen = new Set<string>();
  const list: Successor[] = lt.rows.map((r) => {
    const code = r.cells[0];
    const p = must(r.cells[1].match(/^(.*?)\s*\(([A-Z]{2}\d{2}-\d)\)$/), 'prototype ' + r.cells[1]);
    const s = must(r.cells[2].match(/^\*\*(.+?)\*\*\s*\((.+?)\s*·\s*(\d+)\)$/), 'successor ' + r.cells[2]);
    if (code !== p[2] + 'S') un.add(SU, r.line, code, `รหัสผู้สืบไม่ใช่ ${p[2]}S`);
    if (seen.has(code)) un.add(SU, r.line, code, 'รหัสผู้สืบซ้ำ');
    seen.add(code);
    const known = ids.npcs.get(p[2]);
    if (!known) un.add(SU, r.line, p[2], 'ต้นแบบที่ไม่มีในไฟล์ NPC');
    else if (!known.includes(p[1]) && !p[1].includes(known)) un.add(SU, r.line, `${p[1]} (${p[2]}) ไฟล์ NPC เรียก ${known}`, 'ชื่อต้นแบบต่างจากไฟล์ NPC');
    return { code, proto: p[2], protoName: p[1], name: s[1], race: s[2], age: Number(s[3]), relation: strip(r.cells[3]), lines: linesIn(r.cells[4]), hook: strip(r.cells[5]), src: at(lt, r.line) };
  });
  const drop = lineOf(rule5, /ต่ำกว่าต้นแบบ(หนึ่ง|สอง|สาม)ระดับ/, 'successor level drop');
  return { rules: rr, levelDrop: THAI_NUM[drop[1]] ?? 1, loverDropped: /คนรักไม่สืบ/.test(rule4), list };
}

export default function run() {
  const t = ties();
  const fe = feelings();
  const fo = formation();
  const ar = arcs();
  const fa = family();
  const pa = paired();
  const su = successors();
  const rawAll: RawTable[] = [];
  for (const f of listDocs('docs/systems/bonds')) for (const x of tables(f)) rawAll.push(raw(x));
  const data: BondsData = {
    counts: {
      lines: t.lines.length,
      levels: t.levels.length,
      feelings: fe.feelings.length,
      matrixCells: Object.values(fe.matrix).reduce((a, r) => a + Object.keys(r).length, 0),
      candidates: fo.candidates.length,
      invites: fo.invites.length,
      friendTemplates: ar.templates.length,
      kinTemplates: fa.templates.length,
      pairedHalves: pa.halves.length,
      pairedItems: pa.pairs.length,
      successors: su.list.length,
      tables: rawAll.length,
    },
    ties: t,
    feelings: fe,
    formation: fo,
    arcs: ar,
    family: fa,
    paired: pa,
    successors: su,
    summary: rules(findTable(B + 'README.md', /ตัวเลขสรุป/, 'เรื่อง')),
    raw: rawAll,
  };
  writeGen('bonds', data satisfies BondsData, listDocs('docs/systems/bonds'), GEN);
  return finish('bonds', ['bonds.json'], un);
}

