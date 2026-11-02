// Effect grammar for storyline and event rows (code-plan §5.2). Human words stay as display labels;
// only the patterns in the §5.2 table (plus the additions listed in docs/guide/id-glossary.md as they are
// confirmed) are read as effects or conditions. Phrases that still hold a digit, a percent or a multiplier
// after parsing are returned as `unparsed` for the report.
//
// The public types stay the shared ones (`Effect`, `Condition`); the extra kinds the storyline docs need
// (src/core/data/types-storylines.ts) are written through `ext()` so other generators that read this file
// keep compiling. They are JSON, so the story system reads them with the wider types.
import type { Choice, Condition, Effect, IdKind, NodeId, WeightMod } from '../../../src/core/types';
import type { ChoiceX, CmpCondition, ConditionX, EffectX, ExtraEffect, WeightModX } from '../../../src/core/data/types-storylines';
import type { IdIndex } from './ids';

const NUM = String.raw`[+\-−]?\d+(?:\.\d+)?`;
const toNum = (s: string) => Number(s.replace('−', '-').replace(/,/g, ''));
const NPC = /\b([A-Z]{2}\d{2}-\d)\b/g;
/** World and local events. FT- KN- PR- are bond templates, NF- is an NPC clash; none of them is an event reference. */
const EVENT = /\b((?!NF-|FT-|KN-|PR-|(?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-)[A-Z]{2,4}-\d{2,3})\b/g;
const COUNTRY = /(?<![A-Z-])((?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d\d)\b/g;
const NODE = /\b([a-z]{2}\.[btaelx]\d+)\b/;
const NODE_OR_CV = String.raw`(?:[a-z]{2}\.[btaelx]\d+|cv\.\d+)`;
const TH = '฀-๿';
const THAI_KEYS: Record<string, 'a' | 'b' | 'c'> = { ก: 'a', ข: 'b', ค: 'c' };
/** Words that name a stat change: `ทอง −50` `ชื่อเสียง +5` `ความถนัดอาชีพ +1` `พวกพ้อง +2`. */
const STAT = new RegExp(String.raw`([${TH}a-zA-Z_]+(?:\s[${TH}]+)?)\s*(${NUM.replace('[+\\-−]', '[+\\-−±]')}[\d,]*)(?![\d%])`, 'g');
const THAI_YEARS: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10 };

/** Race words of the docs → line code (storylines README §3). Longest names first so เอลฟ์ does not eat ดาร์กเอลฟ์. */
export const RACE_WORDS: [string, string][] = [
  ['ลูกผสมจักรกล', 'co'],
  ['ดาร์กเอลฟ์', 'de'],
  ['หุ่นวิญญาณ', 'so'],
  ['ฮาล์ฟลิง', 'ha'],
  ['เผ่าปีศาจ', 'dm'],
  ['เผ่ามังกร', 'dk'],
  ['เผ่าลาวา', 'la'],
  ['เผ่าสัตว์', 'be'],
  ['ภูตพราย', 'fa'],
  ['แวมไพร์', 'va'],
  ['คนแคระ', 'dw'],
  ['มนุษย์', 'hu'],
  ['เผ่าปีก', 'wi'],
  ['มัมมี่', 'mu'],
  ['สไลม์', 'sl'],
  ['เอลฟ์', 'el'],
  ['ออร์ค', 'or'],
  ['นาคา', 'na'],
  ['เงือก', 'me'],
  ['ยักษ์', 'gi'],
  ['กูล', 'gh'],
];

/** Number words the cond parser maps to stat keys (the Thai word is kept in `label`). */
const STAT_KEYS: [string, string][] = [
  ['ศรัทธาเทพ', 'godFaith'],
  ['ศรัทธาโลก', 'worldFaith'],
  ['ความหิวมอร์เฮเวน', 'hunger:MH'],
  ['ความหิว', 'hunger'],
  ['ชื่อเสียง', 'fame'],
  ['ปัญญา', 'int'],
  ['กล้าหาญ', 'courage'],
  ['ไว้ใจ', 'trust'],
  ['ทอง', 'gold'],
  ['ทุน', 'capital'],
  ['ชนชั้น', 'class'],
];

const CONTINENT_WORDS: [string, string][] = [
  ['อัซการ์', 'AZ'],
  ['มอร์เฮเวน', 'MH'],
  ['คาซ-ดูรัม', 'KD'],
  ['เนเรีย', 'NR'],
  ['อัลเดรีย', 'AL'],
  ['เมคาเรีย', 'MK'],
  ['ซาฮารัน', 'SH'],
  ['ซิลวาเนล', 'SV'],
  ['เนบูเลีย', 'NB'],
];

export interface Parsed {
  effects: Effect[];
  mods: WeightMod[];
  label: string;
  unparsed: string[];
  /** The cell says "ดูหัวข้อ N": options come from the rite section. */
  rite?: boolean;
  /** "ต้อง…" requirement of the choice this cell belongs to. */
  when?: ConditionX;
  /** "ทาง ค ต้อง…" written in a notes cell: requirement of another choice. */
  choiceWhen?: Partial<Record<'a' | 'b' | 'c', ConditionX>>;
  /** Conditions for the whole node ("ถ้าไม่มี … ข้าม", "ใช้เมื่อ …", "ข้ามถ้า …"). */
  nodeWhen?: ConditionX[];
  /** "ใช้แทน xx.a3 xx.a4". */
  replaces?: NodeId[];
}

export interface ParseOpts {
  weighted?: boolean;
  /** Notes column: backticked enemy ids are battles even without the word ศึก. */
  battle?: boolean;
  /** A choice cell: "ต้อง…" is a requirement of the choice (not a grant). */
  choice?: boolean;
  /** The notes column of a node row: "ต้อง…" wraps the segment, "ทาง ค ต้อง…" gates a choice. */
  notes?: boolean;
}

const ext = (e: ExtraEffect): Effect => e as unknown as Effect;
const stripLinks = (s: string) => s.replace(/\[[^\]]*\]\([^)]*\)/g, ' ');

// ---------- conditions ----------

interface Atom {
  at: number;
  end: number;
  cond: ConditionX;
}

const RACE_RE = RACE_WORDS.map(([w]) => w).join('|');
const STAT_RE = STAT_KEYS.map(([w]) => w).join('|');
const TOKEN = new RegExp(
  [
    '`([^`]+)`(?:\\s*(≥|>=|>)\\s*(\\d+)|\\s*ระดับ\\s*(\\d))?', // 1 code · 2 op · 3 n · 4 level
    `((?:${STAT_RE}|DFC)[${TH}]*?)\\s*(≥|>=|>|≤|<=|<|=|ต่ำกว่า|น้อยกว่า|มากกว่า|เกิน)\\s*(\\d+)(?:\\s*จาก\\s*(\\d+)\\s*เผ่า)?(?:\\s*ขึ้นไป)?`, // 5 stat word · 6 op · 7 n · 8 count
    `(ชนชั้น)\\s*(\\d)\\s*ขึ้นไป`, // 9 · 10
    `(${NODE_OR_CV})(?:\\s*(?:จบ)?ทาง\\s*([กขค]))?`, // 11 node · 12 choice
    '(?<![A-Z-])((?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\\d\\d)\\b', // 13 country
    '((?:NF-|FT-|KN-|PR-)?[A-Z]{2,4}-\\d{2,3})', // 14 event
    '\\b([A-Z]{2}\\d{2}-\\d)\\b', // 15 npc
    'ยุค\\s*(?:≥\\s*)?(\\d)(?:\\s*ขึ้นไป)?', // 16 era
    '(?<![ก-๿])(ชาย|หญิง)(?![ก-๿])', // 17 gender
    `(${RACE_RE})`, // 18 race
  ].join('|'),
  'g',
);

function atomsOf(text: string, ids: IdIndex): Atom[] {
  const out: Atom[] = [];
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    const end = at + m[0].length;
    const before = text.slice(Math.max(0, at - 12), at);
    const after = text.slice(end, end + 12);
    const neg = /(ไม่มี|ยังไม่|ไม่)\s*$/.test(before) || /^\s*(ยังไม่เกิด|ไม่เกิด|ไม่มี)/.test(after);
    const wrap = (c: ConditionX): ConditionX => (neg ? { k: 'not', of: c as Condition } : c);
    if (m[1]) {
      const id = m[1];
      if (m[3]) {
        const level = Number(m[3]) + (m[2] === '>' ? 1 : 0);
        out.push({ at, end, cond: wrap({ k: 'has', kind: ids.kind(id), id, level }) });
      } else if (m[4]) out.push({ at, end, cond: wrap({ k: 'has', kind: ids.kind(id), id, level: Number(m[4]) }) });
      else {
        const lvl = ids.aptLevel(id);
        out.push({ at, end, cond: wrap(lvl ? { k: 'has', kind: 'aptitude', id: lvl.apt, level: lvl.level } : { k: 'has', kind: ids.kind(id), id }) });
      }
    } else if (m[5]) {
      const word = m[5];
      const key = STAT_KEYS.find(([w]) => word.startsWith(w));
      let stat = key ? key[1] : word === 'DFC' ? 'dfc' : word;
      if (key && word.length > key[0].length && key[1] === 'trust') stat = `trust:${word.slice(key[0].length)}`;
      const OPS: Record<string, CmpCondition['op']> = { '≥': '>=', '≤': '<=', '=': '==', ต่ำกว่า: '<', น้อยกว่า: '<', มากกว่า: '>', เกิน: '>' };
      const op = OPS[m[6]] ?? (m[6] as CmpCondition['op']);
      const c: ConditionX = { k: 'cmp', stat, op, value: Number(m[7]), label: word };
      if (m[8]) c.count = Number(m[8]);
      out.push({ at, end, cond: wrap(c) });
    } else if (m[9]) out.push({ at, end, cond: { k: 'cmp', stat: 'class', op: '>=', value: Number(m[10]), label: 'ชนชั้น' } });
    else if (m[11]) out.push({ at, end, cond: wrap({ k: 'node', id: m[11], ...(m[12] ? { choice: THAI_KEYS[m[12]] } : {}) }) });
    else if (m[13]) out.push({ at, end, cond: wrap({ k: 'country', ids: [m[13]] }) });
    else if (m[14]) {
      if (/^(NF-|FT-|KN-|PR-)/.test(m[14])) continue;
      out.push({ at, end, cond: { k: 'event', id: m[14], happened: !neg } });
    } else if (m[15]) out.push({ at, end, cond: { k: 'npc', id: m[15], alive: !/ตาย/.test(after) } });
    else if (m[16]) out.push({ at, end, cond: { k: 'era', min: Number(m[16]) } });
    else if (m[17]) out.push({ at, end, cond: { k: 'gender', value: m[17] === 'ชาย' ? 'm' : 'f' } });
    else if (m[18]) {
      const code = RACE_WORDS.find(([w]) => w === m[18])![1];
      out.push({ at, end, cond: wrap({ k: 'race', ids: [code] }) });
    }
  }
  return out;
}

const STOP = /ต้อง|มี|ผ่าน|ผู้|อาชีพ|และ|หรือ|ที่|ถ้า|ใน|เมื่อ|ทุก|ทาง|ขึ้นไป|เกิด|แล้ว|ได้|เป็น|ของ|ไม่|ยัง|จาก|เผ่า|ระดับ|ใช้|เข้า|ตรา/g;

/**
 * A condition from a phrase. `และ` joins groups, `หรือ` and plain lists join alternatives. With `allowText`
 * the words that are not ids stay as a `text` condition so nothing is lost; without it only ids count.
 */
export function parseConditionX(text: string, ids: IdIndex, allowText = false): ConditionX | null {
  const groups = text.split(/\s+และ\s*/).filter((g) => g.trim());
  const parts: ConditionX[] = [];
  for (const g of groups) {
    const atoms = atomsOf(g, ids);
    let rest = g;
    for (const a of [...atoms].reverse()) rest = rest.slice(0, a.at) + ' ' + rest.slice(a.end);
    const alts: ConditionX[] = atoms.map((a) => a.cond);
    const words = rest.replace(STOP, ' ').replace(/[^฀-๿]+/g, ' ').trim();
    if (allowText && words.length >= 3) alts.push({ k: 'text', text: rest.replace(/\s+/g, ' ').trim() });
    if (!alts.length) continue;
    parts.push(alts.length === 1 ? alts[0] : { k: 'or', of: alts as Condition[] });
  }
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0] : { k: 'and', of: parts as Condition[] };
}

/** A condition from a short phrase: an event id, a backticked id, an NPC, a node. Null when nothing is readable. */
export function parseCondition(text: string, ids: IdIndex): Condition | null {
  return parseConditionX(text, ids) as Condition | null;
}

/** Country flags of the world state (code-plan §6.1) that the docs write in ticks. */
const FLAG_WORDS = new Set(['war', 'famine', 'plague', 'golden', 'fallen', 'god_ruin']);

function kindOf(id: string, ids: IdIndex): IdKind {
  const k = ids.kind(id);
  return k === 'unknown' && FLAG_WORDS.has(id) ? 'flag' : k;
}

// ---------- weight cells ----------

export interface WeightCell {
  weight: number | null;
  mods: WeightModX[];
  when?: ConditionX;
  /** Words in the parentheses that name who is favoured without a number. */
  note: string;
  unparsed: string[];
}

/** `40` · `40 (+20 \`kind\` \`generous\`)` · `35 (\`devout\` \`nature\` ×1.5)` · `60 (−20 ถ้า BIO-01 เกิดแล้ว)` · `35 (ต้องมี \`law\`)`. */
export function parseWeightCell(cell: string, ids: IdIndex): WeightCell {
  const out: WeightCell = { weight: null, mods: [], note: '', unparsed: [] };
  const m = cell.trim().match(/^(\d+(?:\.\d+)?)\s*(?:\((.*)\))?\s*(.*)$/s);
  if (!m) {
    if (!/^[—–-]?$/.test(cell.trim())) out.unparsed.push(cell.trim());
    return out;
  }
  out.weight = Number(m[1]);
  const inner = [m[2] ?? '', m[3] ?? ''].join(' · ');
  for (const part of inner.split(/\s+·\s+/).map((p) => p.trim()).filter(Boolean)) {
    const req = part.match(/^ต้อง(?:มี|ผ่าน)?\s*(.+)$/);
    if (req) {
      const c = parseConditionX(req[1], ids, true);
      if (c) out.when = out.when ? { k: 'and', of: [out.when as Condition, c as Condition] } : c;
      continue;
    }
    const add = part.match(/^([+\-−]\d+)\s*(?:ถ้า\s*)?(.*)$/);
    if (add) {
      const cond = parseConditionX(add[2], ids, true);
      if (cond) out.mods.push({ cond: cond as Condition, mul: 1, add: toNum(add[1]) });
      else out.unparsed.push(part);
      continue;
    }
    const mul = part.match(/^(.*?)\s*×\s*(\d+(?:\.\d+)?)\s*(?:ถ้า\s*(.*))?$/);
    if (mul) {
      const cond = parseConditionX([mul[1], mul[3]].filter(Boolean).join(' '), ids, true);
      if (cond) out.mods.push({ cond: cond as Condition, mul: Number(mul[2]) });
      else out.unparsed.push(part);
      continue;
    }
    // names who is favoured without saying by how much (a condition word like `ยุค ≥ 3` is kept as words too)
    out.note = [out.note, part].filter(Boolean).join(' · ');
    const plain = part.replace(COUNTRY, ' ').replace(NPC, ' ');
    if (/\d|%|×/.test(plain) && !parseConditionX(plain, ids, false)) out.unparsed.push(part);
  }
  return out;
}

// ---------- segments ----------

/** Effects of one segment (text between ` · `). Returns what was not consumed. */
function segment(seg: string, ids: IdIndex, out: Parsed, opts: ParseOpts): string {
  let rest = seg;
  const mine: Effect[] = [];
  const push = (e: ExtraEffect | Effect) => mine.push(e as Effect);
  const take = (re: RegExp, fn: (m: string[]) => void) => {
    rest = rest.replace(re, (...a) => {
      fn(a as unknown as string[]);
      return ' ';
    });
  };
  const eat = (s: string) => {
    rest = rest.replace(s, ' ');
  };
  let reqCond: ConditionX | null = null;

  // a chance at the head of the segment: "30% ได้ไอเทมคู่ `PR-01`" applies to the grants of the segment
  let lead: number | undefined;
  take(/^\s*(\d+(?:\.\d+)?)%\s*(?=[ก-๿])/, (m) => {
    lead = Number(m[1]) / 100;
  });

  // ---- structure of the row ----
  take(/(?:ดู|ตาม)?หัวข้อ\s*[\d.]+/g, () => {
    if (/ดูหัวข้อ/.test(seg)) out.rite = true;
  });
  take(/ศึก\s*:?\s*ไม่มี|ไม่มีศึก/g, () => undefined); // "ศึก: ไม่มี" says there is no battle
  take(/ข้อ\s*\d+/g, () => undefined); // "ตรงกับเรื่องของเผ่าปีศาจข้อ 2"
  take(/LLM\s*`([a-z_]+)`/g, (m) => push({ k: 'llm', role: m[1] }));
  take(/ที่\s*\d+(?=\s|,|$|\))/g, () => undefined); // "วานาลิสที่ 4" an ordinal in a name
  take(/หมายเลข\s*\d+/g, () => undefined);
  // weighted outcomes inside one choice: "ผ่าน 55 … ไม่ผ่าน 45 `c_outcast` 20%"
  {
    const occ = [...rest.matchAll(/(ผ่านทั้งคู่|ผ่านเดียว|ไม่ผ่านเลย|ไม่ผ่าน|ผ่าน)\s+(\d+)(?![\d%])/g)];
    if (occ.length) {
      occ.forEach((o, i) => {
        const from = (o.index ?? 0) + o[0].length;
        const to = i + 1 < occ.length ? (occ[i + 1].index ?? rest.length) : rest.length;
        const sub = parseCell(rest.slice(from, to), ids, { notes: opts.notes });
        out.unparsed.push(...sub.unparsed);
        push({ k: 'outcome', label: o[1], weight: Number(o[2]), effects: sub.effects as EffectX[] });
      });
      rest = '';
    }
  }
  take(/ผ่านเพิ่ม\s*(\d+)/g, (m) => push({ k: 'stat', stat: 'โอกาสผ่าน', delta: Number(m[1]) }));
  take(/ปลายทาง\s*["“]([^"”]+)["”]\s*(?:ถ้า\s*([^·]+))?/g, (m) => {
    const cond = m[2] ? parseConditionX(m[2], ids, true) : null;
    push({ k: 'ending', title: m[1], ...(cond ? { cond } : {}) });
  });
  take(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)|\b(\d+)\/(\d+)\b/g, (m) => push({ k: 'pct', text: `${m[1] ?? m[3]}/${m[2] ?? m[4]}`, pct: Number(m[1] ?? m[3]) }));
  take(/ไม่เกิน\s*(\d+)/g, (m) => push({ k: 'qty', n: Number(m[1]), unit: 'สูงสุด' }));
  take(/อายุ\s*(\d+)/g, (m) => push({ k: 'qty', n: Number(m[1]), unit: 'อายุ' }));
  take(/(ชื่อเสียง[ก-๿]*?)\s*เป็น\s*0(?!\d)/g, (m) => push({ k: 'statMul', stat: m[1], mul: 0 }));
  take(/ชนชั้น\s*(\d)\s*(?:–|-|ถึง)\s*(\d)/g, (m) => push({ k: 'range', stat: 'ชนชั้น', min: Number(m[1]), max: Number(m[2]) }));
  take(new RegExp(`ใช้แทน\\s*((?:${NODE_OR_CV}\\s*(?:และ)?\\s*)+)(?:\\s*เมื่อ\\s*([^·]+))?`), (m) => {
    out.replaces = [...(out.replaces ?? []), ...(m[1].match(new RegExp(NODE_OR_CV, 'g')) ?? [])];
    if (m[2]) {
      const c = parseConditionX(m[2], ids, true);
      if (c) (out.nodeWhen ??= []).push(c);
    }
  });
  take(/ถ้าไม่มี\s*([^·]+?)\s*ข้าม(?:โหนดนี้)?(?=\s|$)/, (m) => {
    const c = parseConditionX(m[1], ids, true);
    if (c) (out.nodeWhen ??= []).push(c);
  });
  take(/ถ้า\s*([^·]+?)\s*ข้าม(?:โหนดนี้)?(?=\s|$)/, (m) => {
    const c = parseConditionX(m[1], ids, true);
    if (c) (out.nodeWhen ??= []).push({ k: 'not', of: c as Condition });
  });
  // a condition that moves a weight of this node's own choice: "ความหิวมอร์เฮเวน > 70 → ทาง ข ×2"
  take(/([^·→]*?[^\s·→][^·→]*?)\s*→\s*ทาง\s*([กขค])\s*×\s*(\d+(?:\.\d+)?)/, (m) => {
    const cond = parseConditionX(m[1], ids, true);
    push({ k: 'choiceMod', choice: THAI_KEYS[m[2]], ...(cond ? { cond } : {}), mul: Number(m[3]) });
  });
  take(/ข้ามถ้า\s*(.+?)\s*(ไม่เกิด)?\s*(?=\(|$)/, (m) => {
    const c = parseConditionX(m[1], ids, true);
    if (!c) return;
    (out.nodeWhen ??= []).push(m[2] ? c : { k: 'not', of: c as Condition });
  });
  take(new RegExp(`ถ้า\\s*([^·:]+?)\\s*ยังไม่เกิด\\s*ใช้\\s*(${NODE_OR_CV})`), (m) => {
    const c = parseConditionX(m[1], ids, true);
    if (c) (out.nodeWhen ??= []).push(c);
    push({ k: 'ref', nodes: [m[2]], rel: 'แทน' });
  });
  take(/(?:ใช้เมื่อ|บังคับถ้า|เกิดเมื่อ)\s*([^·]+)$/, (m) => {
    const c = parseConditionX(m[1], ids, true);
    if (c) (out.nodeWhen ??= []).push(c);
  });
  // "ทาง ค ต้อง…" in a notes cell gates another choice
  take(/ทาง\s*([กขค])\s*ต้อง(?:มี|ผ่าน)?\s*([^()·]+)/, (m) => {
    const c = parseConditionX(m[2], ids, true);
    if (c) (out.choiceWhen ??= {})[THAI_KEYS[m[1]]] = c;
  });

  // ---- weight changes written on the row ----
  take(
    /(?:ถ้า\s*([^·()]*?)\s+)?ทาง\s*([กขค])\s*ของ\s*(cv\.\d+)\s*(?:ได้)?\s*(?:น้ำหนัก)?\s*×\s*(\d+(?:\.\d+)?)/,
    (m) => {
      const cond = m[1] ? parseConditionX(m[1], ids, true) : null;
      push({ k: 'entryMod', to: m[3], choice: THAI_KEYS[m[2]], ...(cond ? { cond } : {}), mul: Number(m[4]) });
    },
  );
  take(/น้ำหนัก\s*ทาง\s*([กขค])\s*×\s*(\d+(?:\.\d+)?)(?:\s*ถ้า\s*(`[^`]+`))?/, (m) => {
    const cond = m[3] ? parseConditionX(m[3], ids, true) : null;
    push({ k: 'entryMod', choice: THAI_KEYS[m[1]], ...(cond ? { cond } : {}), mul: Number(m[2]) });
  });
  take(/ทาง\s*([กขค])\s*(?:น้ำหนัก\s*)?×\s*(\d+(?:\.\d+)?)(?:\s*ถ้า\s*(`[^`]+`))?/, (m) => {
    const cond = m[3] ? parseConditionX(m[3], ids, true) : null;
    push({ k: 'entryMod', choice: THAI_KEYS[m[1]], ...(cond ? { cond } : {}), mul: Number(m[2]) });
  });
  take(new RegExp(`(?:เปิด)?ทาง\\s*([กขค])\\s*ของ\\s*(cv\\.\\d+)`, 'g'), (m) => {
    push({ k: 'ref', nodes: [m[2]], rel: /เปิดทาง/.test(m[0]) ? 'เปิด' : 'ทาง', choice: THAI_KEYS[m[1]] });
  });
  take(new RegExp(`ท่าที\\s*([${TH}]+)\\s*×\\s*(\\d+(?:\\.\\d+)?)(?:\\s*ถ้า\\s*(\`[^\`]+\`))?`), (m) => {
    const cond = m[3] ? parseConditionX(m[3], ids, true) : null;
    push({ k: 'stanceMul', stance: m[1], mul: Number(m[2]), ...(cond ? { cond } : {}) });
  });

  // weight multipliers: (`freedom` ×3) · (BIO-01 แล้ว ×3)
  for (const m of seg.matchAll(/\(([^()]*?)\s*×\s*(\d+(?:\.\d+)?)\)/g)) {
    if (!rest.includes(m[0])) continue;
    const cond = parseConditionX(m[1], ids, false);
    if (cond) {
      out.mods.push({ cond: cond as Condition, mul: Number(m[2]) });
      eat(m[0]);
    }
  }

  // what is left of a multiplier after the weight mods were taken: "(×2)" and "`ns_tide_read` ×2"
  take(/\(\s*×\s*(\d+(?:\.\d+)?)\s*\)/g, (m) => push({ k: 'statMul', stat: '', mul: Number(m[1]) }));
  take(/`([a-z_#][a-z_0-9]*)`\s*×\s*(\d+(?:\.\d+)?)/g, (m) => push({ k: 'statMul', stat: m[1], mul: Number(m[2]) }));

  // era-gated convergence: ยุค 4 → cv.16
  const eraTo = rest.match(/ยุค\s*(\d)(?:\s*ขึ้นไป)?\s*→\s*(cv\.\d+|[a-z]{2}\.[btaelx]\d+)/);
  if (eraTo) {
    push({ k: 'if', cond: { k: 'era', min: Number(eraTo[1]) }, then: [{ k: 'converge', to: eraTo[2] }] });
    eat(eraTo[0]);
  }

  // conditional: ถ้า MC-03 หรือ MC-04 เกิด → cv.9
  const iff = rest.match(/ถ้า\s*(.+?)\s*→\s*(cv\.\d+|[a-z]{2}\.[btaelx]\d+)/);
  if (iff) {
    const cond = parseConditionX(iff[1], ids, true);
    if (cond) {
      push({ k: 'if', cond: cond as Condition, then: [{ k: 'converge', to: iff[2] }] });
      eat(iff[0]);
    }
  }
  // conditional event: ถ้าเหลือมังกรตัวสุดท้าย (DFC = 14) และกุญแจถูกกระจาย → END-10
  const ife = rest.match(/ถ้า\s*([^→]+?)\s*→\s*((?:NF-)?[A-Z]{2,4}-\d{2,3})/);
  if (ife && ids.events.has(ife[2])) {
    const cond = parseConditionX(ife[1], ids, true);
    if (cond) {
      push({ k: 'if', cond: cond as Condition, then: [{ k: 'event', id: ife[2], open: true }] });
      eat(ife[0]);
    }
  }
  // an event the choice leads to: → GI-08 · → BIO-03 หรือ WT-02
  take(/→\s*((?:[A-Z]{2,4}-\d{2,3})(?:\s*หรือ\s*[A-Z]{2,4}-\d{2,3})*)/g, (m) => {
    for (const id of m[1].match(/[A-Z]{2,4}-\d{2,3}/g) ?? []) if (ids.events.has(id)) push({ k: 'event', id, open: true });
  });

  // jump: ข้ามไป hu.a1 เร็วขึ้นสองปี
  const jump = rest.match(/ข้ามไป\s*([a-z]{2}\.[btaelx]\d+)(?:\s*เร็วขึ้น\s*(\S+?)\s*ปี)?/);
  if (jump) {
    const y = jump[2] ? (THAI_YEARS[jump[2]] ?? (Number(jump[2]) || undefined)) : undefined;
    push(y ? { k: 'jump', to: jump[1], years: y } : { k: 'jump', to: jump[1] });
    eat(jump[0]);
  }

  // convergence: → cv.6   ·   → cv.4 หรือ cv.15
  for (const m of rest.matchAll(/→\s*(cv\.\d+)(?:[^→·]*?หรือ\s*(cv\.\d+))?/g)) {
    push({ k: 'converge', to: m[1] });
    if (m[2]) push({ k: 'converge', to: m[2] });
  }
  rest =rest.replace(/\s*หรือ\s*cv\.\d+(?:\s*\([^)]*\))?/g, ' ').replace(/→\s*cv\.\d+(?:\s*\([^)]*\))?/g, ' ');

  // ---- bond system markers ----
  take(new RegExp(`\`?\\{([${TH}]+):([${TH}]+)@(\\d)\\}\`?`, 'g'), (m) => push({ k: 'mood', line: m[1], mood: m[2], level: Number(m[3]) }));
  take(/`(?:LC-|\{[^}]*\})?`/g, () => undefined); // template placeholders: `LC-` and empty ticks
  take(/`([A-Z]{2,4}-\d{2,3})`/g, (m) => push({ k: 'event', id: m[1] })); // an event id written in ticks
  take(/`(FT|KN|PR)-(\d{2})`(?:\s*ถึง\s*`\1-(\d{2})`)?/g, (m) => {
    const t: ExtraEffect = { k: 'template', kind: m[1] as 'FT' | 'KN' | 'PR', code: `${m[1]}-${m[2]}` };
    if (m[3]) t.to = `${m[1]}-${m[3]}`;
    if (lead !== undefined) t.chance = lead;
    push(t);
  });
  take(/(?:เปิด)?สาย(สหาย|คู่หู|คนรัก|ครู|ศิษย์|คู่แข่ง|ญาติผู้ใหญ่|ญาติรุ่นเยาว์|พี่น้อง)(?:\s*ระดับ\s*(\d))?/g, (m) =>
    push({ k: 'bond', line: m[1], ...(m[2] ? { level: Number(m[2]) } : {}) }),
  );

  // ---- job paths ----
  take(
    /ทาง(?:สู่|ไป|เปิด)\s*(อาชีพลับ|อาชีพ)?\s*`([a-z_]+)`(?:\s*ระดับ\s*([A-Z0-9]+))?\s*(?:\(\s*(?:ต้องมี)?\s*([^()]*?)\s*\)|ถ้า\s*([^·]+))?/g,
    (m) => {
      const need = m[4] ?? m[5];
      const cond = need ? parseConditionX(need, ids, true) : null;
      push({ k: 'jobpath', job: m[2], secret: m[1] === 'อาชีพลับ', ...(cond ? { need: cond } : {}) });
    },
  );

  // ---- requirements: "ต้องมี …" gates the choice (or wraps this segment in a notes cell) ----
  if (opts.choice || opts.notes) {
    take(/ต้อง(?:มี|ผ่าน)?\s*((?:[^()]|\([^)]*\))*?)(?=\s*\)|\s*$)/, (m) => {
      const c = parseConditionX(m[1], ids, true);
      if (c) reqCond = c;
    });
  }

  // ---- numbers with a meaning ----
  take(/ระดับ\s*([BL])(\d)(?:\s*หรือ\s*\1(\d))?/g, (m) => push({ k: 'level', scale: m[1], values: [Number(m[2]), ...(m[3] ? [Number(m[3])] : [])] }));
  take(/(?<![A-Za-z])L(\d)(?![\dA-Za-z])/g, (m) => push({ k: 'level', scale: 'L', values: [Number(m[1])] }));
  take(/(?:เป็น|ครบแล้วเป็น)\s*B(\d)\b/g, (m) => push({ k: 'level', scale: 'B', values: [Number(m[1])] }));
  take(/ปีที่\s*(\d+)/g, (m) => push({ k: 'qty', n: Number(m[1]), unit: 'ปีที่' }));
  take(/(?<![ก-๿])(?:ขึ้น)?ชั้น\s*(\d)(?!\d|\s*ถึง|\s*ขึ้นไป|\s*(?:-|–)\s*\d)/g, (m) => push({ k: 'class', value: Number(m[1]) }));
  take(/(?:น้ำหนัก\s*)?((?!NF-|FT-|KN-|PR-)[A-Z]{2,4}-\d{2})\s*([+\-−]\d+)(?![\d%])/g, (m) =>
    push({ k: 'eventWeight', id: m[1], delta: toNum(m[2]) }),
  );
  take(/(?:ทอย\s*)?(d\d+)?\s*DC\s*(\d+)/g, (m) => push({ k: 'check', dc: Number(m[2]), ...(m[1] ? { die: m[1] } : {}) }));
  take(/บาดแผลถาวร\s*(?:(\d+(?:\.\d+)?)%)?/g, (m) => push({ k: 'wound', ...(m[1] ? { chance: Number(m[1]) / 100 } : {}) }));
  take(new RegExp(`ไว้ใจ\\s*(?:จาก|ใน|ต่อ)?\\s*([${TH}]*?)\\s*([+\\-−±]\\s*\\d+)(?![\\d%])`, 'g'), (m) => {
    if (!m[2].startsWith('±')) push({ k: 'trust', toward: m[1], delta: toNum(m[2].replace(/\s/g, '')) });
  });
  take(new RegExp(`(?:([${TH}]+(?:\\s[${TH}]+)?)\\s*)?(${NUM}[\\d,]*)\\s*ถึง\\s*(${NUM}[\\d,]*)\\s*(%|คน|ตัว|ชิ้น)?`, 'g'), (m) => {
    push({ k: 'range', stat: m[1] ?? '', min: toNum(m[2]), max: toNum(m[3]), ...(m[4] ? { unit: m[4] } : {}) });
  });
  take(new RegExp(`([${TH}]+(?:\\s[${TH}]+)?)\\s*(\\d+)[–-](\\d+)\\s*(ตัว|คน|ชิ้น)`, 'g'), (m) => {
    push({ k: 'range', stat: m[1], min: Number(m[2]), max: Number(m[3]), unit: m[4] });
  });
  take(new RegExp(`([${TH}]+(?:\\s[${TH}]+)?)\\s*±\\s*(\\d+)(%)?(?!\\d)`, 'g'), (m) =>
    push({ k: 'range', stat: m[1], min: -Number(m[2]), max: Number(m[2]), ...(m[3] ? { unit: '%' } : {}) }),
  );
  take(new RegExp(`([${TH}]+(?:\\s[${TH}]+)?)\\s*([+\\-−])\\s*(\\d+(?:\\.\\d+)?)%`, 'g'), (m) =>
    push({ k: 'statPct', stat: m[1], pct: toNum(m[2] + m[3]) }),
  );
  take(new RegExp(`([${TH}]+(?:\\s[${TH}]+)?)\\s*×\\s*(\\d+(?:\\.\\d+)?)`, 'g'), (m) => push({ k: 'statMul', stat: m[1], mul: Number(m[2]) }));
  take(/(\d+(?:\.\d+)?)\s*(ปีหน้า|ปี|คน|ตัว|ชิ้น|หน่วย|ครั้ง|เดือน|วัน|ฝูง|เผ่า)(?![ก-๿])/g, (m) => push({ k: 'qty', n: Number(m[1]), unit: m[2] }));

  // a condition that closes the phrase: "… +3 ถ้า `music` ≥ 2" · "เข้าเส้น iv ถ้าชั้น 3 ขึ้นไป"
  let trail: ConditionX | null = null;
  take(/ถ้า\s*([^·()]*?(?:≥|>|<|ขึ้นไป|ต่ำกว่า|มากกว่า)[^·()]*?)\s*$/, (m) => {
    trail = parseConditionX(m[1], ids, true);
  });

  // battle marker
  const isBattle = /ศึก/.test(rest) || !!opts.battle;
  const battleEnemies: string[] = [];

  // a backticked id with a signed number raises or lowers it: `bow` +1
  for (const m of rest.matchAll(new RegExp('`([a-z_]+)`\\s*(' + NUM + ')(?![\\d%])', 'g'))) {
    if (!/[+\-−]/.test(m[2])) continue;
    push({ k: 'stat', stat: m[1], delta: toNum(m[2]) });
    eat(m[0]);
  }

  // backticked ids, with an optional chance or level after them
  for (const m of rest.matchAll(/`([^`]+)`(?:\s*(\d+(?:\.\d+)?)%)?(?:\s*(?:เริ่มที่)?ระดับ\s*(\d)(?![\dA-Z]))?/g)) {
    const id = m[1].trim();
    const kind = kindOf(id, ids);
    if (kind === 'enemy' && isBattle) {
      battleEnemies.push(id);
      eat(m[0]);
      continue;
    }
    const lvl = ids.aptLevel(id);
    const e: Effect = lvl ? { k: 'grant', kind: 'aptitude', id: lvl.apt, level: lvl.level } : { k: 'grant', kind, id };
    if (m[3] && e.k === 'grant' && !lvl) e.level = Number(m[3]);
    if (m[2] && e.k === 'grant') e.chance = Number(m[2]) / 100;
    else if (lead !== undefined && e.k === 'grant') e.chance = lead;
    push(e);
    eat(m[0]);
  }
  if (isBattle && (battleEnemies.length || /ศึก/.test(rest))) {
    push({ k: 'battle', enemies: battleEnemies });
    rest = rest.replace(/ศึก/, ' ');
  }

  // NPC ids and event ids that are still in the text are references
  for (const m of rest.matchAll(NPC)) {
    push({ k: 'npc', id: m[1] });
    eat(m[1]);
  }
  for (const m of rest.matchAll(EVENT)) {
    push({ k: 'event', id: m[1] });
    eat(m[1]);
  }
  const places: string[] = [];
  for (const m of rest.matchAll(COUNTRY)) {
    places.push(m[1]);
    eat(m[1]);
  }
  if (places.length) push({ k: 'place', ids: places });
  take(/([ก-๿]+?)\s*ระดับ\s*(\d)(?![\dA-Z])/g, (m) => push({ k: 'level', scale: m[1], values: [Number(m[2])] }));
  if (trail) {
    const then = mine.splice(0);
    mine.push({ k: 'if', cond: trail as Condition, then });
  }

  // death with a chance: ตาย 10%
  const death = rest.match(/ตาย\S*\s*(\d+(?:\.\d+)?)%/);
  if (death) {
    push({ k: 'death', chance: Number(death[1]) / 100 });
    eat(death[0]);
  }

  // stat changes: ทอง −50 · ชื่อเสียง +5
  for (const m of rest.matchAll(STAT)) {
    if (!/[+\-−]/.test(m[2])) continue; // a bare number is not a change
    push({ k: 'stat', stat: m[1].trim(), delta: toNum(m[2]) });
    eat(m[0]);
  }
  take(/เสียทอง\s*(\d+)/, (m) => push({ k: 'stat', stat: 'ทอง', delta: -Number(m[1]) }));

  // a percentage that belongs to some words: ถูกค้น 40% · ผ่าน 60% · ดอก 20%
  take(new RegExp(`([${TH}]+(?:\\s[${TH}]+)?)\\s*(\\d+(?:\\.\\d+)?)%`, 'g'), (m) => push({ k: 'pct', text: m[1], pct: Number(m[2]) }));
  take(new RegExp(`(\\d+(?:\\.\\d+)?)%\\s*([${TH}]+)`, 'g'), (m) => push({ k: 'pct', text: m[2], pct: Number(m[1]) }));

  // node references that are left: เปิด ml.a1 · ตรงกับ be.b2 · ใช้ใน hb.t2
  take(
    new RegExp(`(เปิดเส้นไป|เปิดเส้น|เปิด|ตรงกับ|ใช้ใน|ผูก|ฟัง|เข้า|ต้องผ่าน)?\\s*((?:${NODE_OR_CV}\\s*)+)(?:\\s*ทาง\\s*([กขค]))?`, 'g'),
    (m) => {
      const nodes = m[2].match(new RegExp(NODE_OR_CV, 'g')) ?? [];
      push({ k: 'ref', nodes, rel: m[1] ?? '', ...(m[3] ? { choice: THAI_KEYS[m[3]] } : {}) });
    },
  );

  // a battle that the notes cell ties to some choices: "ศึก: `npc_inquisitor` หัวหน้า (ทาง ข หรือ ค)"
  if (opts.notes) {
    const sc = seg.match(/ทาง\s*([กขค](?:\s*(?:หรือ|และ|,)\s*[กขค])*)/);
    if (sc && !/ของ\s*cv\./.test(seg)) {
      const choices = (sc[1].match(/[กขค]/g) ?? []).map((x) => THAI_KEYS[x]);
      for (let i = 0; i < mine.length; i++) {
        const e = mine[i];
        if (e.k === 'battle') mine[i] = ext({ k: 'battleFor', choices, enemies: e.enemies });
      }
      rest = rest.replace(/\(?\s*ทาง\s*[กขค](?:\s*(?:หรือ|และ|,)\s*[กขค])*\s*\)?/, ' ');
    }
  }

  // wrap what this segment produced in a requirement when it came from a notes cell
  if (reqCond) {
    if (opts.choice) {
      out.when = out.when ? ({ k: 'and', of: [out.when as Condition, reqCond as Condition] } as Condition) : reqCond;
      out.effects.push(...mine);
    } else out.effects.push(ext({ k: 'only', cond: reqCond, then: mine as EffectX[] }));
  } else out.effects.push(...mine);
  return rest;
}

const CHOICE_KEYS = { ก: 'a', ข: 'b', ค: 'c' } as const;

/** "ถ้าอยู่ SH-10 (…): ก) 35 … ข) 40 … ค) 25 …": a whole set of choices under a place or event condition. */
function variantSegment(seg: string, ids: IdIndex, out: Parsed, labels: string[]): boolean {
  const k = seg.search(/(?:^|\s)ก\)\s*\d/);
  if (k < 0 || !/\sข\)\s*\d/.test(seg)) return false;
  const header = seg.slice(0, k).replace(/\*/g, '').trim();
  const parts = seg.slice(k).trim().split(/(?:^|\s)([กขค])\)\s*(?=\d)/);
  const choices: ChoiceX[] = [];
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const r = parseChoice(CHOICE_KEYS[parts[i] as 'ก' | 'ข' | 'ค'], parts[i + 1].trim(), ids);
    out.unparsed.push(...r.unparsed);
    choices.push({ ...r.choice, effects: r.choice.effects as EffectX[], mods: r.choice.mods as WeightModX[], when: r.choice.when as ConditionX | undefined });
  }
  const head = header.replace(/^ถ้า(?:อยู่)?\s*/, '');
  const cond = parseConditionX(head.replace(/\s*\(.*$/, ''), ids, true) ?? parseConditionX(head, ids, true) ?? undefined;
  out.effects.push(ext({ k: 'variant', ...(cond ? { cond } : {}), text: header, choices }));
  const label = header.replace(/\s+/g, ' ');
  if (label) labels.push(label);
  return true;
}

/** "ถ้าอยู่ KD-07 (…): พิธี…" a note that only applies in some places. */
function placeSegment(seg: string, ids: IdIndex, out: Parsed, opts: ParseOpts, labels: string[]): boolean {
  const m = seg.match(/^ถ้า(?:อยู่|เป็น)\s*((?:[A-Z]{2}-\d\d[\s,]*)+)(?:\([^)]*\))?\s*:\s*(.+)$/s);
  if (!m) return false;
  const sub = parseCell(m[2], ids, opts);
  const cond: ConditionX = { k: 'country', ids: m[1].match(/[A-Z]{2}-\d\d/g) ?? [] };
  out.effects.push(ext({ k: 'only', cond, then: sub.effects as EffectX[] }));
  out.unparsed.push(...sub.unparsed);
  if (sub.label) labels.push(sub.label);
  return true;
}

/** Parses a cell made of ` · ` separated segments. `weighted` reads a leading weight (choice cells). */
export function parseCell(cell: string, ids: IdIndex, opts: ParseOpts = {}): Parsed & { weight: number | null } {
  const out: Parsed = { effects: [], mods: [], label: '', unparsed: [] };
  let text = stripLinks(cell).trim();
  let weight: number | null = null;
  if (opts.weighted) {
    const w = text.match(/^(\d+(?:\.\d+)?)\s+/);
    if (w) {
      weight = Number(w[1]);
      text = text.slice(w[0].length);
    }
  }
  const labels: string[] = [];
  for (const seg of text.split(/\s+·\s+/)) {
    if (variantSegment(seg, ids, out, labels)) continue;
    if (placeSegment(seg, ids, out, opts, labels)) continue;
    const label = seg
      .replace(/`[^`]+`(?:\s*\d+(?:\.\d+)?%)?/g, '')
      .replace(/\{[^}]*\}/g, '')
      .replace(/\(\s*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (label) labels.push(label);
    const rest = segment(seg, ids, out, opts);
    const left = rest.replace(/\s+/g, ' ').trim();
    if (/\d|%|×/.test(left)) out.unparsed.push(seg.trim());
  }
  out.label = labels.join(' · ');
  return { ...out, weight };
}

/** One choice cell of a storyline node (`40 ลอบสังหารในเมืองใหญ่ · \`c_wanted\``). */
export function parseChoice(key: Choice['key'], cell: string, ids: IdIndex): { choice: Choice; unparsed: string[]; parsed: Parsed } {
  const p = parseCell(cell, ids, { weighted: true, choice: true });
  const choice: Choice = { key, weight: p.weight ?? 0, label: p.label, effects: p.effects, mods: p.mods };
  if (p.when) choice.when = p.when as Condition;
  if (p.weight === null) p.unparsed.unshift(`(ไม่มีน้ำหนัก) ${cell}`);
  return { choice, unparsed: p.unparsed, parsed: p };
}
