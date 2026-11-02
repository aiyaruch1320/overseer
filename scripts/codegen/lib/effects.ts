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
  ['เหมือง', 'mine'],
  ['ระดับ', 'level'],
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
  /** The notes give another form of the node for when its event has not happened, so the node plays anyway. */
  altForm?: boolean;
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
/** "ต้อง" that really is a requirement: ต้องมี, ต้องผ่าน, ต้อง `id`, ต้อง ทุน ≥ 200 — not "จึงต้องหลบ". */
const REQ = `ต้อง(?:(?:มี|ผ่าน)|(?=\\s*\`)|(?=[${TH}]+\\s*[≥>]))`;

/** The opposite of a condition (events flip, `and`/`or` swap). */
export function negate(c: ConditionX): ConditionX {
  switch (c.k) {
    case 'event':
      return { ...c, happened: !c.happened };
    case 'npc':
      return { ...c, alive: !c.alive };
    case 'not':
      return c.of;
    case 'and':
      return { k: 'or', of: c.of.map(negate) as Condition[] };
    case 'or':
      return { k: 'and', of: c.of.map(negate) as Condition[] };
    default:
      return { k: 'not', of: c as Condition };
  }
}
const stripLinks = (s: string) => s.replace(/\[[^\]]*\]\([^)]*\)/g, ' ');

// ---------- conditions ----------

interface Atom {
  at: number;
  end: number;
  cond: ConditionX;
}

/**
 * A race word is a whole word: the neighbours are not Thai letters (`ตระกูล` has no ghoul in it).
 * The glued connectives of Thai (`ชาว` before, `และ` `หรือ` `กับ` before or after) still count as a border.
 */
const RACE_RE = `(?:(?<![${TH}])|(?<=ชาว|และ|หรือ|กับ))(?:${[...RACE_WORDS].sort((a, b) => b[0].length - a[0].length).map(([w]) => w).join('|')})(?:(?![${TH}])|(?=และ|หรือ|กับ))`;
const STAT_RE = STAT_KEYS.map(([w]) => w).join('|');
const TOKEN = new RegExp(
  [
    '`([^`]+)`(?:\\s*(≥|>=|>)\\s*(\\d+)|\\s*ระดับ\\s*(\\d))?', // 1 code · 2 op · 3 n · 4 level
    `((?:${STAT_RE}|DFC)[${TH}]*?)\\s*(≥|>=|>|≤|<=|<|=|ต่ำกว่า|น้อยกว่า|มากกว่า|เกิน)\\s*([+\\-−]?\\d+)(?:\\s*จาก\\s*(\\d+)\\s*เผ่า)?(?:\\s*ขึ้นไป)?`, // 5 stat word · 6 op · 7 n · 8 count
    `(?<![${TH}])(ชนชั้น|ชั้น)\\s*(\\d)\\s*ขึ้นไป`, // 9 · 10
    `(${NODE_OR_CV})(?:\\s*(?:จบ)?ทาง\\s*([กขค]))?`, // 11 node · 12 choice
    '(?<![A-Z-])((?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\\d\\d)\\b|(?<![A-Za-z-])(AZ|MH|KD|NR|AL|MK|SH|SV|NB)(?![A-Za-z0-9-])', // 13 country · 14 continent
    '((?:NF-|FT-|KN-|PR-)?[A-Z]{2,4}-\\d{2,3})', // 14 event
    '\\b([A-Z]{2}\\d{2}-\\d)\\b', // 15 npc
    'ยุค\\s*(?:≥\\s*)?(\\d)(?:\\s*ขึ้นไป)?', // 16 era
    '(?<![ก-๿])(ชาย|หญิง)(?![ก-๿])', // 17 gender
    `(${RACE_RE})`, // 19 race
    `ก่อนอายุ\\s*(\\d+)`, // 20 before this age
    `อายุ\\s*(\\d+)\\s*ขึ้นไป|อายุ\\s*(?:≥|>=)\\s*(\\d+)`, // 21 · 22 at least this age
    `(เวท)\\s*(\\d+)(?![\\d%])`, // 23 · 24 magic 17
    `พวกพ้องระดับ\\s*(\\d)\\s*ขึ้นไป`, // 25 ally level
    `(?<![${TH}])(ผู้ถูกอัญเชิญ|ผู้กลับชาติ)(?![${TH}])`, // 26 summoned / reincarnated
    `(?<![${TH}])(?:อยู่)?(?:ใน)?(?:ทวีป)?(${CONTINENT_WORDS.map(([w]) => w).join('|')})(?![${TH}])`, // 27 continent by name
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
    const neg = /(ไม่มี|ยังไม่|ไม่ได้อยู่|ไม่ได้|ไม่)\s*$/.test(before) || /^\s*(ยังไม่เกิด|ไม่เกิด|ไม่มี)/.test(after);
    const wrap = (c: ConditionX): ConditionX => (neg ? { k: 'not', of: c as Condition } : c);
    if (m[1]) {
      const id = m[1];
      if (m[3]) {
        const level = Number(m[3]) + (m[2] === '>' ? 1 : 0);
        out.push({ at, end, cond: wrap({ k: 'has', kind: kindOf(id, ids), id, level }) });
      } else if (m[4]) out.push({ at, end, cond: wrap({ k: 'has', kind: kindOf(id, ids), id, level: Number(m[4]) }) });
      else {
        const lvl = ids.aptLevel(id);
        out.push({ at, end, cond: wrap(lvl ? { k: 'has', kind: 'aptitude', id: lvl.apt, level: lvl.level } : { k: 'has', kind: kindOf(id, ids), id }) });
      }
    } else if (m[5]) {
      const word = m[5];
      const key = STAT_KEYS.find(([w]) => word.startsWith(w));
      let stat = key ? key[1] : word === 'DFC' ? 'dfc' : word;
      if (key && word.length > key[0].length && key[1] === 'trust') stat = `trust:${word.slice(key[0].length)}`;
      const OPS: Record<string, CmpCondition['op']> = { '≥': '>=', '≤': '<=', '=': '==', ต่ำกว่า: '<', น้อยกว่า: '<', มากกว่า: '>', เกิน: '>' };
      const op = OPS[m[6]] ?? (m[6] as CmpCondition['op']);
      const c: ConditionX = { k: 'cmp', stat, op, value: toNum(m[7]), label: word };
      if (m[8]) c.count = Number(m[8]);
      out.push({ at, end, cond: wrap(c) });
    } else if (m[9]) out.push({ at, end, cond: { k: 'class', min: Number(m[10]) } });
    else if (m[11]) out.push({ at, end, cond: wrap({ k: 'node', id: m[11], ...(m[12] ? { choice: THAI_KEYS[m[12]] } : {}) }) });
    else if (m[13]) out.push({ at, end, cond: wrap({ k: 'country', ids: [m[13]] }) });
    else if (m[14]) out.push({ at, end, cond: wrap({ k: 'continent', ids: [m[14] as 'AZ'] }) });
    else if (m[15]) {
      if (/^(NF-|FT-|KN-|PR-)/.test(m[15])) continue;
      out.push({ at, end, cond: { k: 'event', id: m[15], happened: !neg } });
    } else if (m[16]) out.push({ at, end, cond: { k: 'npc', id: m[16], alive: !/ตาย/.test(after) } });
    else if (m[17]) out.push({ at, end, cond: { k: 'era', min: Number(m[17]) } });
    else if (m[18]) out.push({ at, end, cond: { k: 'gender', value: m[18] === 'ชาย' ? 'm' : 'f' } });
    else if (m[19]) {
      const code = RACE_WORDS.find(([w]) => w === m[19].replace(/^ชาว/, ''))![1];
      out.push({ at, end, cond: wrap({ k: 'race', ids: [code] }) });
    } else if (m[26]) out.push({ at, end, cond: wrap({ k: 'has', kind: 'flag', id: m[26] === 'ผู้ถูกอัญเชิญ' ? 'summoned' : 'reincarnated' }) });
    else if (m[27]) out.push({ at, end, cond: wrap({ k: 'continent', ids: [CONTINENT_WORDS.find(([w]) => w === m[27])![1] as 'AZ'] }) });
    else if (m[20]) out.push({ at, end, cond: { k: 'age', max: Number(m[20]) - 1 } });
    else if (m[21] || m[22]) out.push({ at, end, cond: { k: 'age', min: Number(m[21] ?? m[22]) } });
    else if (m[23]) out.push({ at, end, cond: { k: 'cmp', stat: 'magic', op: '>=', value: Number(m[24]), label: 'เวท' } });
    else if (m[25]) out.push({ at, end, cond: { k: 'cmp', stat: 'allyLevel', op: '>=', value: Number(m[25]), label: 'พวกพ้องระดับ' } });
  }
  return out;
}

/** Words that sit beside a code to say what it is. They are kept in the label, never in a condition. */
const DESCRIPTOR = /(?<![฀-๿])(?:สำเร็จ|อาชีพลับ|อาชีพพิเศษ|ชาวพื้นหลัง|ชาวพื้น|ชาว|ธงประเทศ|ธง|อยู่ที่|อยู่ใน|อยู่|เกิดแล้ว|เกิดขึ้นแล้ว|ผ่านแล้ว|แล้ว|เคย)(?![฀-๿])/g;
/** "SF-08 เกิด": beside an event id the word only says it happened. */
const HAPPENED = /(?<![฀-๿])(?:เกิดขึ้น|เกิด)(?![฀-๿])/g;
const STOP = /ต้อง|มี|ผ่าน|ผู้|อาชีพ|และ|หรือ|ที่|ถ้า|ใน|เมื่อ|ทุก|ทาง|ขึ้นไป|เกิด|แล้ว|ได้|เป็น|ของ|ไม่|ยัง|จาก|เผ่า|ระดับ|ใช้|เข้า|ตรา/g;

/**
 * A condition from a phrase. `หรือ` joins alternatives. `mode` says what a plain list of ids means:
 * 'and' for requirements and plain conditions ("ต้องมี A B"; `และ` is AND), 'or' for weight changes
 * ("(A B ×2)": each one raises the weight; `และ` reads as OR). With `allowText` the words that are not
 * ids stay as a `text` condition so nothing is lost; without it only ids count.
 */
/** `or[or[a, b], c]` is `or[a, b, c]`: the same word list read in two steps is one list. */
function join(k: 'and' | 'or', items: ConditionX[]): ConditionX {
  const of = items.flatMap((x) => (x.k === k ? (x.of as ConditionX[]) : [x]));
  return of.length === 1 ? of[0] : ({ k, of } as ConditionX);
}

export function parseConditionX(text: string, ids: IdIndex, allowText = false, mode: 'and' | 'or' = 'and'): ConditionX | null {
  const groups = mode === 'and' ? text.split(/\s+และ\s*/) : [text.replace(/\s+และ\s*/g, ' ')];
  const parts: ConditionX[] = [];
  for (const g of groups.filter((x) => x.trim())) {
    const altConds: ConditionX[] = [];
    for (const alt of g.split(/\s*หรือ\s*/).filter((x) => x.trim())) {
      const atoms = atomsOf(alt, ids);
      let rest = alt;
      for (const a of [...atoms].reverse()) rest = rest.slice(0, a.at) + ' ' + rest.slice(a.end);
      const items: ConditionX[] = atoms.map((a) => a.cond);
      // a word that explains the code beside it ("hu.a7 สำเร็จ", "อาชีพลับ `beastking`", "DR-01 ชาวพื้นหลัง") is a note, not a condition
      if (atoms.length) rest = rest.replace(DESCRIPTOR, ' ');
      if (atoms.some((a) => a.cond.k === 'event')) rest = rest.replace(HAPPENED, ' ');
      rest = rest.replace(/\(\s*\)/g, ' ').replace(/(^|\s)[()+*,:](?=\s|$)/g, ' ');
      const words = rest.replace(STOP, ' ').replace(/[^฀-๿]+/g, ' ').trim();
      const text1: ConditionX | null = allowText && words.length >= 3 ? { k: 'text', text: rest.replace(/\s+/g, ' ').trim() } : null;
      if (!items.length && !text1) continue;
      if (mode === 'or') {
        const anyOf: ConditionX | null = items.length === 0 ? null : join('or', items);
        const all = [anyOf, text1].filter((x): x is ConditionX => !!x);
        altConds.push(join('and', all));
      } else {
        const all = text1 ? [...items, text1] : items;
        altConds.push(join('and', all));
      }
    }
    if (!altConds.length) continue;
    parts.push(join('or', altConds));
  }
  if (!parts.length) return null;
  return join('and', parts);
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
      const cond = parseConditionX(add[2], ids, true, 'or');
      if (cond) out.mods.push({ cond: cond as Condition, mul: 1, add: toNum(add[1]) });
      else out.unparsed.push(part);
      continue;
    }
    const mul = part.match(/^(.*?)\s*×\s*(\d+(?:\.\d+)?)\s*(?:ถ้า\s*(.*))?$/);
    if (mul) {
      const cond = parseConditionX([mul[1], mul[3]].filter(Boolean).join(' '), ids, true, 'or');
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

  // "มอร์เฮเวนใช้ `ash_wolf_pack`": a variant for one continent
  let scope: ConditionX | null = null;
  take(new RegExp(`^(${CONTINENT_WORDS.map(([w]) => w).join('|')})ใช้\\s*`), (m) => {
    scope = { k: 'continent', ids: [CONTINENT_WORDS.find(([w]) => w === m[1])![1] as 'AZ'] };
  });

  take(/^(ผู้ถูกอัญเชิญ|ผู้กลับชาติ)\s*:\s*/, (m) => {
    scope = { k: 'has', kind: 'flag', id: m[1] === 'ผู้ถูกอัญเชิญ' ? 'summoned' : 'reincarnated' };
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
  take(/ไม่เข้า\s*(?:`[^`]+`\s*(?:หรือ|และ)?\s*)+/g, () => undefined); // "ไม่เข้า `fisher` หรือ `ferryman`": jobs left out, nothing is granted
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
  // "ถ้าไม่มี X ข้าม": the node is played only when X is there
  take(/ถ้าไม่มี\s*([^·]+?)\s*ข้าม(?:โหนดนี้|ไป)?(?=\s|$)/, (m) => {
    const c = parseConditionX(m[1], ids, true, 'or');
    if (c) (out.nodeWhen ??= []).push(c);
  });
  // "(ถ้าเคยผ่าน cv.1 ข้าม)": the node is skipped when X
  take(/\(\s*ถ้า\s*([^()·]+?)\s*ข้าม\s*\)/, (m) => {
    const c = parseConditionX(m[1], ids, true, 'or');
    if (c) (out.nodeWhen ??= []).push(negate(c));
  });
  // "ถ้า X ข้ามโหนดนี้": skipped when X; X written as "ยังไม่เกิด" is already a negative atom
  take(/ถ้า\s*([^·]+?)\s*ข้ามโหนด(?:นี้)?(?=\s|$)/, (m) => {
    const c = parseConditionX(m[1], ids, true, 'or');
    if (c) (out.nodeWhen ??= []).push(negate(c));
  });
  // "ข้ามถ้า X ยังไม่เกิด ใช้ <another form> แทน": the node still plays, in that form
  take(/ข้ามถ้า\s*([^·:→]+?)\s*ยังไม่เกิด\s*ใช้\s*([^·]+)$/, (m) => {
    const c = parseConditionX(m[1], ids, true, 'or');
    if (!c) return;
    out.altForm = true;
    push({ k: 'if', cond: negate(c) as Condition, then: [{ k: 'label', text: m[2].trim() }] });
  });
  take(/ข้ามถ้า\s*(.+?)\s*(ไม่เกิด)?\s*(?=\(|$)/, (m) => {
    const c = parseConditionX(m[1], ids, true, 'or');
    if (!c || (c.k === 'text' && /เหตุการณ์/.test(c.text))) return; // "ข้ามถ้าไม่มีทั้งสองเหตุการณ์" is the title events
    (out.nodeWhen ??= []).push(m[2] ? c : negate(c));
  });
  take(/ถ้า\s*([^·:]+?)\s*ยังไม่เกิด\s*ข้าม(?:ไป)?(?=\s|$)/, (m) => {
    const c = parseConditionX(m[1], ids, true, 'or');
    if (c) (out.nodeWhen ??= []).push(c);
  });
  take(new RegExp(`ถ้า\\s*([^·:]+?)\\s*ยังไม่เกิด\\s*ใช้\\s*(${NODE_OR_CV})`), (m) => {
    const c = parseConditionX(m[1], ids, true, 'or');
    if (c) (out.nodeWhen ??= []).push(c);
    push({ k: 'ref', nodes: [m[2]], rel: 'แทน' });
  });
  // "ถ้า X ยังไม่เกิด: <another form of the node>": the node still plays, in that form
  take(/ถ้า\s*([^·:→]+?)\s*ยังไม่เกิด\s*:?(?!\s*→)\s*([^·]+)$/, (m) => {
    const c = parseConditionX(m[1], ids, true, 'or');
    if (!c) return;
    out.altForm = true;
    push({ k: 'if', cond: negate(c) as Condition, then: [{ k: 'label', text: m[2].trim() }] });
  });
  // a condition that moves a weight of this node's own choice: "ความหิวมอร์เฮเวน > 70 → ทาง ข ×2"
  take(/([^·→]*?[^\s·→][^·→]*?)\s*→\s*ทาง\s*([กขค])\s*×\s*(\d+(?:\.\d+)?)/, (m) => {
    const cond = parseConditionX(m[1], ids, true);
    push({ k: 'choiceMod', choice: THAI_KEYS[m[2]], ...(cond ? { cond } : {}), mul: Number(m[3]) });
  });
  take(/(?:ใช้เมื่อ|ใช้ได้เมื่อ|บังคับถ้า|เกิดเมื่อ)\s*([^·]+)$/, (m) => {
    const c = parseConditionX(m[1].replace(/\s*ถ้าไม่มี\s*ข้าม(?:ไป)?\s*$/, ''), ids, true);
    if (c) (out.nodeWhen ??= []).push(c);
  });
  // "ทาง ค ต้อง…" in a notes cell gates another choice
  take(new RegExp(`ทาง\\s*([กขค])\\s*${REQ}\\s*([^()·]+)`), (m) => {
    const c = parseConditionX(m[2], ids, true);
    if (c) (out.choiceWhen ??= {})[THAI_KEYS[m[1]]] = c;
  });

  // ---- weight changes written on the row ----
  take(new RegExp(`น้ำหนัก\\s*(${NODE_OR_CV})\\s*×\\s*(\\d+(?:\\.\\d+)?)`), (m) => push({ k: 'nodeWeight', node: m[1], mul: Number(m[2]) }));
  take(new RegExp(`น้ำหนัก([${TH}]*?)ใน\\s*(${NODE_OR_CV})\\s*×\\s*(\\d+(?:\\.\\d+)?)`), (m) =>
    push({ k: 'nodeWeight', node: m[2], ...(m[1] ? { label: m[1] } : {}), mul: Number(m[3]) }),
  );
  take(new RegExp(`\\(?\\s*(${NODE_OR_CV})\\s*ทาง([${TH}]+?)คูณ\\s*(\\d+(?:\\.\\d+)?)\\s*\\)?`), (m) =>
    push({ k: 'nodeWeight', node: m[1], label: m[2], mul: Number(m[3]) }),
  );
  take(new RegExp(`^ถ้า\\s*(.+?)\\s+น้ำหนัก([${TH}]*?)คูณ\\s*(\\d+(?:\\.\\d+)?)\\s*$`), (m) => {
    const cond = parseConditionX(m[1], ids, true);
    const w: ExtraEffect = { k: 'nodeWeight', ...(m[2] ? { label: m[2] } : {}), mul: Number(m[3]) };
    push(cond ? { k: 'if', cond: cond as Condition, then: [ext(w)] } : w);
  });
  take(new RegExp(`พิธี\\s*([btae]\\d)\\s*ของเผ่า(?:หลัก|ที่สอง)`), (m) => push({ k: 'ref', nodes: [m[1]], rel: 'พิธี' }));
  take(
    new RegExp(`(?:ถ้า\\s*([^·()]*?)\\s+)?ทาง\\s*([กขค])\\s*ของ\\s*(${NODE_OR_CV})\\s*(?:ได้)?\\s*(?:น้ำหนัก)?\\s*×\\s*(\\d+(?:\\.\\d+)?)`),
    (m) => {
      const cond = m[1] ? parseConditionX(m[1], ids, true) : null;
      push({ k: 'entryMod', to: m[3], choice: THAI_KEYS[m[2]], ...(cond ? { cond } : {}), mul: Number(m[4]) });
    },
  );
  take(/น้ำหนัก\s*ทาง\s*([กขค])\s*×\s*(\d+(?:\.\d+)?)(?:\s*ถ้า\s*(`[^`]+`|[^()·]+?(?=\s*\)|\s*·|\s*$)))?/, (m) => {
    const cond = m[3] ? parseConditionX(m[3], ids, true) : null;
    push({ k: 'entryMod', choice: THAI_KEYS[m[1]], ...(cond ? { cond } : {}), mul: Number(m[2]) });
  });
  take(/ทาง\s*([กขค])\s*(?:น้ำหนัก\s*)?×\s*(\d+(?:\.\d+)?)(?:\s*ถ้า\s*(`[^`]+`|[^()·]+?(?=\s*\)|\s*·|\s*$)))?/, (m) => {
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

  // "เข้าเส้น iv": opens a whole line (two letters) rather than a node
  take(/เข้าเส้น\s*([a-z]{2})(?![a-z.\d])/g, (m) => push({ k: 'ref', nodes: [m[1]], rel: 'เข้าเส้น' }));

  // weight multipliers: (`freedom` ×3) · (BIO-01 แล้ว ×3)
  for (const m of seg.matchAll(/\(([^()]*?)\s*×\s*(\d+(?:\.\d+)?)\)/g)) {
    if (!rest.includes(m[0])) continue;
    const cond = parseConditionX(m[1], ids, true, 'or');
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

  // a condition at the head of a notes segment: "ทุ่งราบหลัง DR-07 → RF-01 RF-02" · "NB และ AL-20 → cv.4 cv.15"
  if (opts.notes) {
    const am = rest.match(
      new RegExp(`^\\s*([^→·]*?)\\s*→\\s*((?:${NODE_OR_CV}(?:\\s*\\([^)]*\\))?\\s*(?:หรือ\\s*)?)+|(?:[A-Z]{2,4}-\\d{2,3}\\s*)+)`),
    );
    if (am && /\b[A-Z]{2,4}-\d|\b(?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)\b/.test(am[1])) {
      const cond = parseConditionX(am[1], ids, true, 'or');
      const then: Effect[] = [];
      for (const id of am[2].match(new RegExp(NODE_OR_CV, 'g')) ?? []) then.push({ k: 'converge', to: id });
      for (const id of am[2].match(/\b[A-Z]{2,4}-\d{2,3}\b/g) ?? []) if (ids.events.has(id)) then.push({ k: 'event', id, open: true });
      if (cond && then.length) {
        push({ k: 'if', cond: cond as Condition, then });
        rest = rest.replace(am[0], ' ');
      }
    }
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
  const jump = rest.match(/ข้ามไป\s*([a-z]{2}\.[btaelx]\d+)(?:\s*ทาง\s*([กขค]))?(?:\s*เร็วขึ้น\s*(\S+?)\s*ปี)?/);
  if (jump) {
    const y = jump[3] ? (THAI_YEARS[jump[3]] ?? (Number(jump[3]) || undefined)) : undefined;
    // `choice` is not in the shared Effect type: "ข้ามไป el.a1 ทาง ก" also takes that choice there
    push({ k: 'jump', to: jump[1], ...(y ? { years: y } : {}), ...(jump[2] ? { choice: THAI_KEYS[jump[2]] } : {}) } as Effect);
    eat(jump[0]);
  }

  // convergence: → cv.6   ·   → cv.4 หรือ cv.15   ·   → cv.4 cv.15
  take(/→\s*((?:cv\.\d+(?:\s*\((?!\s*ต้อง)[^)]*\))?\s*(?:หรือ\s*)?)+)/g, (m) => {
    for (const id of m[1].match(/cv\.\d+/g) ?? []) push({ k: 'converge', to: id });
  });

  // ---- bond system markers ----
  take(new RegExp(`\`?\\{([${TH}]+):([${TH}]+)@(\\d)\\}\`?`, 'g'), (m) => push({ k: 'mood', line: m[1], mood: m[2], level: Number(m[3]) }));
  take(/(?<![^\s])`\s*(?:LC-|\{[^}]*\})?\s*`(?![^\s])/g, () => undefined); // template placeholders: `LC-` and empty ticks
  take(/`((?!FT-|KN-|PR-|NF-)[A-Z]{2,4}-\d{2,3})`/g, (m) => push({ k: 'event', id: m[1] })); // an event id written in ticks
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

  // a country flag in a parenthesis of this choice ("(WR-03 CT-08 หรือธงประเทศ `famine`)") says when the path is open
  if (opts.choice) {
    take(/\(([^()]*ธง[^()]*`(?:war|famine|plague|golden|fallen|god_ruin)`[^()]*)\)/, (m) => {
      const c = parseConditionX(m[1], ids, true, 'or');
      if (c) out.when = out.when ? ({ k: 'and', of: [out.when as Condition, c as Condition] } as Condition) : c;
    });
  }

  // ---- requirements: "ต้องมี …" gates the choice (or wraps this segment in a notes cell) ----
  if (opts.choice || opts.notes) {
    take(new RegExp(`${REQ}\\s*((?:[^()]|\\([^)]*\\))*?)(?=\\s*\\)|\\s*$)`), (m) => {
      const c = parseConditionX(m[1], ids, true);
      if (c) reqCond = c;
    });
  }

  // ---- numbers with a meaning ----
  // an item in a quantity range: `mt_star_iron` 1–3 ชิ้น
  take(/`([a-z_0-9]+)`\s*(\d+)[–-](\d+)\s*(ชิ้น|ตัว|คน)/g, (m) => {
    push({ k: 'grant', kind: kindOf(m[1], ids), id: m[1] });
    push({ k: 'range', stat: m[1], min: Number(m[2]), max: Number(m[3]), unit: m[4] });
  });
  take(/ระดับ\s*([BL])(\d)(?:\s*หรือ\s*\1(\d))?/g, (m) => push({ k: 'level', scale: m[1], values: [Number(m[2]), ...(m[3] ? [Number(m[3])] : [])] }));
  take(/(?<![A-Za-z])L(\d)(?![\dA-Za-z])/g, (m) => push({ k: 'level', scale: 'L', values: [Number(m[1])] }));
  take(/(?:เป็น|ครบแล้วเป็น)\s*B(\d)\b/g, (m) => push({ k: 'level', scale: 'B', values: [Number(m[1])] }));
  take(/ปีที่\s*(\d+)/g, (m) => push({ k: 'qty', n: Number(m[1]), unit: 'ปีที่' }));
  take(/(?<![ก-๿])(?:ขึ้น)?ชั้น\s*(\d)(?!\d|\s*ถึง|\s*ขึ้นไป|\s*(?:-|–)\s*\d)/g, (m) => push({ k: 'class', value: Number(m[1]) }));
  take(/(?:น้ำหนัก\s*)?((?!NF-|FT-|KN-|PR-)[A-Z]{2,4}-\d{2})\s*(?:น้ำหนัก\s*)?([+\-−]\d+)(?![\d%])/g, (m) =>
    push({ k: 'eventWeight', id: m[1], delta: toNum(m[2]) }),
  );
  take(/(?:ทอย\s*)?(d\d+)?\s*DC\s*(\d+)/g, (m) => push({ k: 'check', dc: Number(m[2]), ...(m[1] ? { die: m[1] } : {}) }));
  take(/บาดแผลถาวร\s*(?:(\d+(?:\.\d+)?)%)?/g, (m) => push({ k: 'wound', ...(m[1] ? { chance: Number(m[1]) / 100 } : {}) }));
  take(new RegExp(`ไว้ใจ\\s*(?:จาก|ใน|ต่อ)?\\s*([${TH}]*?)\\s*([+\\-−±]\\s*\\d+)(?![\\d%])`, 'g'), (m) => {
    if (!m[2].startsWith('±')) push({ k: 'trust', toward: m[1], delta: toNum(m[2].replace(/\s/g, '')) });
  });
  take(new RegExp(`(?:([${TH}]+)\\s*)?(${NUM}[\\d,]*)\\s*ถึง\\s*(${NUM}[\\d,]*)\\s*(%|คน|ตัว|ชิ้น)?`, 'g'), (m) => {
    push({ k: 'range', stat: m[1] ?? '', min: toNum(m[2]), max: toNum(m[3]), ...(m[4] ? { unit: m[4] } : {}) });
  });
  take(new RegExp(`([${TH}]+)\\s*(\\d+)[–-](\\d+)\\s*(ตัว|คน|ชิ้น)`, 'g'), (m) => {
    push({ k: 'range', stat: m[1], min: Number(m[2]), max: Number(m[3]), unit: m[4] });
  });
  take(new RegExp(`([${TH}]+)\\s*±\\s*(\\d+)(%)?(?!\\d)`, 'g'), (m) =>
    push({ k: 'range', stat: m[1], min: -Number(m[2]), max: Number(m[2]), ...(m[3] ? { unit: '%' } : {}) }),
  );
  take(new RegExp(`([${TH}]+|[a-z]{2,})\\s*([+\\-−])\\s*(\\d+(?:\\.\\d+)?)%`, 'g'), (m) =>
    push({ k: 'statPct', stat: m[1], pct: toNum(m[2] + m[3]) }),
  );
  take(new RegExp(`([${TH}]+)\\s*×\\s*(\\d+(?:\\.\\d+)?)`, 'g'), (m) => push({ k: 'statMul', stat: m[1], mul: Number(m[2]) }));
  take(/(\d+(?:\.\d+)?)\s*(ปีหน้า|(?:ปี|คน|ตัว|ชิ้น|หน่วย|ครั้ง|เดือน|วัน|ฝูง|เผ่า)(?![ก-๿]))/g, (m) => push({ k: 'qty', n: Number(m[1]), unit: m[2] }));

  // a condition that closes the phrase: "… +3 ถ้า `music` ≥ 2" · "เข้าเส้น iv ถ้าชั้น 3 ขึ้นไป"
  let trail: ConditionX | null = null;
  take(/ถ้า\s*([^·()]*?(?:≥|>|<|ขึ้นไป|ต่ำกว่า|มากกว่า)[^·()]*?)\s*$/, (m) => {
    trail = parseConditionX(m[1], ids, true);
  });

  // "ถูกค้น 40% → ศึก": the chance that what follows the arrow happens
  take(new RegExp(`([${TH}][${TH} ]*?)\\s*(\\d+(?:\\.\\d+)?)%\\s*→\\s*([^·]+)$`), (m) => {
    const sub = parseCell(m[3], ids, { notes: opts.notes, choice: false });
    out.unparsed.push(...sub.unparsed);
    push({ k: 'chance', p: Number(m[2]) / 100, text: m[1].trim(), then: sub.effects as EffectX[] });
  });

  // battle marker
  const isBattle = /ศึก/.test(rest) || !!opts.battle;
  const battleEnemies: string[] = [];
  let battleChance: number | undefined;

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
      if (m[2]) battleChance = Number(m[2]) / 100; // "คู่แข่งท้าดวล `npc_duelist` 20%": the fight happens with that chance
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
    const words = seg.replace(/`[^`]+`/g, ' ').replace(/ศึก\s*:?/g, ' ').replace(/\s+/g, ' ').trim();
    const fight: Effect = { k: 'battle', enemies: battleEnemies, ...(!battleEnemies.length && words ? { text: words } : {}) };
    push(battleChance !== undefined ? ext({ k: 'chance', p: battleChance, text: 'ศึก', then: [fight] }) : fight);
    rest = rest.replace(/ศึก/, ' ');
  }

  take(/เปิด\s*((?!NF-|FT-|KN-|PR-|(?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-)[A-Z]{2,4}-\d{2,3})/g, (m) => {
    if (ids.events.has(m[1])) push({ k: 'event', id: m[1], open: true });
  });

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
  if (trail && mine.length) {
    const then = mine.splice(0);
    mine.push({ k: 'if', cond: trail as Condition, then });
  }
  if (scope) {
    const then = mine.splice(0);
    mine.push(ext({ k: 'only', cond: scope, then: then as EffectX[] }));
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
    if (/[A-Za-z]-\d/.test(m[0])) continue; // `DM-08` is an id: the digits that touch a code are not a number (review H4)
    push({ k: 'stat', stat: m[1].trim(), delta: toNum(m[2]) });
    eat(m[0]);
  }
  take(/เสียทอง\s*(\d+)/, (m) => push({ k: 'stat', stat: 'ทอง', delta: -Number(m[1]) }));

  // a percentage that belongs to some words: ถูกค้น 40% · ผ่าน 60% · ดอก 20%
  take(new RegExp(`([${TH}]+(?:\\s[${TH}]+)?)\\s*(\\d+(?:\\.\\d+)?)%`, 'g'), (m) => push({ k: 'pct', text: m[1], pct: Number(m[2]) }));
  take(new RegExp(`(\\d+(?:\\.\\d+)?)%\\s*([${TH}]+)`, 'g'), (m) => push({ k: 'pct', text: m[2], pct: Number(m[1]) }));

  // node references that are left: เปิด ml.a1 · ตรงกับ be.b2 · ใช้ใน hb.t2
  take(
    new RegExp(`(เปิดเส้นไป|เปิดเส้น|เปิด|ตรงกับ|ใช้ใน|ผูก|ฟัง|เข้า|ต้องผ่าน)?\\s*((?:${NODE_OR_CV}\\s*)+)(?:\\s*ทาง\\s*([กขค])|\\s+([กขค])\\))?`, 'g'),
    (m) => {
      const nodes = m[2].match(new RegExp(NODE_OR_CV, 'g')) ?? [];
      const ch = m[3] ?? m[4];
      // "เข้า cv.4" · "เปิดเส้นไป cv.2" lead into a convergence
      if (m[1] && /^(เข้า|เปิดเส้นไป|เปิดเส้น|เปิด)$/.test(m[1]) && nodes.every((n) => n.startsWith('cv.')) && !ch) {
        for (const n of nodes) push({ k: 'converge', to: n });
        return;
      }
      push({ k: 'ref', nodes, rel: m[1] ?? '', ...(ch ? { choice: THAI_KEYS[ch] } : {}) });
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
    } else if (!mine.length) (out.nodeWhen ??= []).push(reqCond);
    else out.effects.push(ext({ k: 'only', cond: reqCond, then: mine as EffectX[] }));
  } else out.effects.push(...mine);
  return rest;
}

// ---------- "ถ้า … / … เมื่อ …" and "A หรือ B" inside one cell (review H1 B2) ----------

const fresh = (): Parsed => ({ effects: [], mods: [], label: '', unparsed: [] });

/** Anything a branch carries that is not an effect: a branch like that is not wrapped or picked. */
const hasMeta = (p: Parsed) => !!(p.mods.length || p.when || p.nodeWhen?.length || p.replaces?.length || p.altForm || p.rite || p.choiceWhen);

/** Forms that segment() reads itself (skips, replacements, weight changes, outcomes): the condition wrapper leaves them alone. */
const NO_WRAP =
  /เผ่าที่เล่นได้เมื่อเป็นศัตรู|ถ้า[^()·]*ข้าม\s*\)|ข้าม(?:โหนด|ไป|ถ้า)|ยังไม่เกิด|ใช้แทน|ใช้เมื่อ|ใช้ได้เมื่อ|บังคับถ้า|เกิดเมื่อ|ถ้าไม่มี[^·]*ข้าม|ปลายทาง|×|คูณ|น้ำหนัก|(?:ผ่านทั้งคู่|ผ่านเดียว|ไม่ผ่านเลย|ไม่ผ่าน|ผ่าน)\s+\d+(?![\d%])/;
/** Where the effects of a "ถ้า COND …" phrase begin. */
const EFFECT_START = /→|`|(?<![฀-๿])ศึก|(?<![฀-๿])เปิด|ทาง(?:สู่|ไป|เปิด)|(?<![฀-๿])ได้(?=\s|`)|[฀-๿]+\s*[+\-−]\s*\d/;

/**
 * A condition from words: unreadable words stay as a `text` condition (reported by the generators).
 * A bare "ถ้ามี" / "ถ้าเกิด" / "ถ้าต่ำกว่า 3" points at the effect it follows, so `then` tells what it means.
 */
function condOf(raw: string, ids: IdIndex, then: Effect[]): { cond: ConditionX; then: Effect[] } | null {
  const t = raw
    .replace(/(เกิด|แล้ว)และ/g, '$1 และ ')
    .replace(/^\s*(?:อยู่|เป็น)\s*/, '')
    .replace(/\s*(?:ได้|ให้|เปิด|ทางสู่|ทางไป|ทางเปิด|ใช้)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;
  const grant = then.find((e) => e.k === 'grant');
  if (t === 'มี' && grant && grant.k === 'grant') return { cond: { k: 'has', kind: grant.kind, id: grant.id }, then: then.filter((e) => e !== grant) };
  if (t === 'ยังไม่มี' && grant && grant.k === 'grant') return { cond: { k: 'not', of: { k: 'has', kind: grant.kind, id: grant.id } }, then };
  const ev = then.find((e) => e.k === 'event');
  if (/^เกิด(?:แล้ว)?$/.test(t) && ev && ev.k === 'event' && then.length === 1) return { cond: { k: 'event', id: ev.id, happened: true }, then };
  const stat = then.find((e) => e.k === 'stat');
  const lowHigh = t.match(/^(ต่ำกว่า|น้อยกว่า|มากกว่า|เกิน)\s*(\d+)$/);
  if (lowHigh && stat && stat.k === 'stat')
    return {
      cond: { k: 'cmp', stat: stat.stat, op: lowHigh[1] === 'ต่ำกว่า' || lowHigh[1] === 'น้อยกว่า' ? '<' : '>', value: Number(lowHigh[2]), label: stat.stat },
      then,
    };
  const c = parseConditionX(t, ids, true) ?? (/[฀-๿]{2}/.test(t) ? ({ k: 'text', text: t } as ConditionX) : null);
  return c ? { cond: c, then } : null;
}

/** "เลือก ก" in a notes cell binds the battle to that choice, not a world condition. */
function choiceKeys(cond: string): ('a' | 'b' | 'c')[] | null {
  const m = cond.trim().match(/^เลือก\s*([กขค](?:\s*(?:หรือ|และ|,)\s*[กขค])*)$/);
  return m ? (m[1].match(/[กขค]/g) ?? []).map((x) => THAI_KEYS[x]) : null;
}

function condWrap(seg: string, ids: IdIndex, out: Parsed, opts: ParseOpts): string | null {
  if (!/(?<!เ)ถ้า|เมื่อ|\(\s*`[^`]+`\s*ต้อง(?!มี|ผ่าน)/.test(seg) || NO_WRAP.test(seg)) return null;
  let condText = '';
  let effText = '';
  let outside = '';
  // "ศึก: ถ้า ก) <enemy>" in a notes cell: the battle is for choice ก
  const cb = seg.match(/^(\s*ศึก\s*:?\s*)?ถ้า\s*([กขค])\)\s*(.*)$/);
  if (cb) {
    const sub = fresh();
    const rest = segmentFull(`${cb[1] ?? ''}${cb[3]}`, ids, sub, opts);
    if (!sub.effects.length || hasMeta(sub)) return null;
    out.effects.push(...sub.effects.map((e) => (e.k === 'battle' ? ext({ k: 'battleFor', choices: [THAI_KEYS[cb[2]]], enemies: e.enemies }) : e)));
    out.unparsed.push(...sub.unparsed);
    return rest;
  }
  const paren = seg.match(/\(\s*([^()]*?)\s*(?:(?<!เ)ถ้า|เมื่อ|(?<=`\s)ต้อง(?!มี|ผ่าน))\s*([^()]+?)\s*\)/);
  const lead = seg.match(/^\s*(?<!เ)ถ้า\s*/);
  if (lead) {
    const body = seg.slice(lead[0].length);
    const colon = body.indexOf(':');
    const at = body.search(EFFECT_START);
    // "ถ้าอยู่ X: <what happens there>": the colon ends the condition
    if (colon >= 0 && (at < 0 || colon < at)) {
      condText = body.slice(0, colon);
      effText = body.slice(colon + 1);
    } else {
      if (at < 0) return null;
      // "ถ้า X → cv.N" and "ถ้า X → EVENT" are read by segment() itself; only a choice between targets is new here
      if (body[at] === '→' && !/หรือ/.test(body.slice(at))) return null;
      condText = body.slice(0, at);
      effText = body.slice(at);
    }
  } else if (paren) {
    // "(… ถ้า X)" in the second alternative of "A หรือ B (… ถ้า X)" belongs to that alternative: the choice splits first
    if (splitOr(seg)) return null;
    condText = paren[2];
    const headHasEffect = /`|[A-Z]{2,4}-\d{2}|→|[+\-−]\s*\d|ศึก/.test(paren[1]);
    if (headHasEffect) {
      effText = paren[1];
      outside = seg.replace(paren[0], ' ');
    } else effText = seg.replace(paren[0], ` ${paren[1]} `);
  } else {
    const m = seg.match(/(?:(?<!เ)ถ้า|เมื่อ)/);
    if (!m || m.index === undefined) return null;
    const before = seg.slice(0, m.index);
    const after = seg.slice(m.index + m[0].length);
    const tokens = /`|[A-Z]{2,4}-\d{2}|(?:[a-z]{2}\.[btaelx]|cv\.)\d|→|[+\-−]\s*\d/;
    const tailParen = after.match(/^\s*([^()]+?)\s*\(\s*(`[^)]*)\)\s*$/);
    if (tokens.test(before)) {
      condText = after;
      effText = before;
      // "… ถ้ายังไม่มี (ให้ `#necro`)": a parenthesis of results at the end belongs to the effects
      const give = after.match(/^(.*?)\s*\(\s*ให้\s*([^)]*)\)\s*$/);
      if (give) {
        condText = give[1];
        effText = `${before} ${give[2]}`;
      }
    } else if (tailParen) {
      // "ห้ามเข้าถ้าถูกจับ (`c_wanted` 20%)": the results are the parenthesis, the words between are the condition
      condText = tailParen[1];
      effText = tailParen[2];
    } else return null;
  }
  if (/→/.test(condText) || !condText.trim() || !effText.trim()) return null;
  const sub = fresh();
  const rest = segmentFull(effText, ids, sub, opts);
  if (!sub.effects.length || hasMeta(sub)) return null;
  const keys = choiceKeys(condText);
  if (keys) {
    out.effects.push(...sub.effects.map((e) => (e.k === 'battle' ? ext({ k: 'battleFor', choices: keys, enemies: e.enemies }) : e)));
    out.unparsed.push(...sub.unparsed);
    return rest;
  }
  const made = condOf(condText, ids, sub.effects);
  if (!made) return null;
  const { cond, then } = made;
  let tail = rest;
  if (outside.trim()) {
    const o = segmentFull(outside, ids, out, opts);
    tail = `${o} ${rest}`;
  }
  out.effects.push({ k: 'if', cond: cond as Condition, then });
  out.unparsed.push(...sub.unparsed);
  return tail;
}

/** Top-level "หรือ" between alternatives (not inside parentheses, not inside a Thai word like "พ่อหรือแม่"). */
function splitOr(seg: string): string[] | null {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < seg.length; i++) {
    const ch = seg[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && seg.startsWith('หรือ', i) && (i === 0 || /\s/.test(seg[i - 1]))) {
      parts.push(seg.slice(from, i).trim());
      from = i + 4;
      i += 3;
    }
  }
  if (!parts.length) return null;
  parts.push(seg.slice(from).trim());
  return parts;
}

/** "A หรือ B" of codes or results in one cell: exactly one of them happens (equal weights, the docs give none). */
function pickSegment(seg: string, ids: IdIndex, out: Parsed, opts: ParseOpts): string | null {
  const alts = splitOr(seg);
  if (!alts || alts.length < 2 || alts.some((a) => !a)) return null;
  if (/×|คูณ/.test(seg)) return null;
  // story prose that offers the player a choice ("ตัวละครเลือก: A หรือ B") is not a list of codes
  if (/ตัวละครเลือก|ไม่เข้า|\*\*/.test(seg) || alts.some((a) => a.length > 90)) return null;
  // "เกิด NR-06 หรือ NR-07 → `c_outcast` 40%": the "หรือ" before the arrow is the condition of what follows it
  if (!/→/.test(alts[0]) && /→/.test(alts[alts.length - 1]) && !/(?<!เ)ถ้า|เมื่อ|ต้อง/.test(seg.slice(0, seg.indexOf('→')))) {
    const at = seg.indexOf('→');
    const sub = fresh();
    const rest = segmentFull(seg.slice(at + 1), ids, sub, opts);
    const made = condOf(seg.slice(0, at), ids, sub.effects);
    if (!sub.effects.length || hasMeta(sub) || !made) return null;
    out.effects.push({ k: 'if', cond: made.cond as Condition, then: made.then });
    out.unparsed.push(...sub.unparsed);
    return rest;
  }
  // "ถ้า A หรือ B เกิด", "ต้องผ่าน A หรือ B": the alternatives are a condition, read by the condition parser
  const head = alts[0].replace(/^.*→/, '');
  if (/(?:^|\s)(?:ถ้า|ต้อง|เมื่อ|ใช้ได้|หาก|ข้ามถ้า|ใช้เมื่อ|เกิดเมื่อ|หลัง)|ต้องผ่าน/.test(head)) return null;
  if (/(?:^|\s)(?:ถ้า|ต้อง)/.test(alts[alts.length - 1]) && !/→/.test(alts[0])) return null;
  // "ระดับ B2 หรือ B3" is one level effect with two values, read by segment()
  if (/ระดับ\s*[BL]\d\s*หรือ\s*[BL]\d/.test(seg)) return null;
  const texts = [...alts];
  // "ท่าทีถิ่น −1 หรือ −2": the later alternatives are only the other number of the first one
  const signed = texts[0].match(/^(.*?)[+\-−]\s*\d+\s*$/);
  if (signed)
    for (let i = 1; i < texts.length; i++) {
      const n = texts[i].match(/^([+\-−]\s*\d+)\s*(.*)$/);
      if (n) texts[i] = `${signed[1]}${n[1]} ${n[2]}`.trim();
    }
  // "→ cv.4 หรือ cv.15": the arrow and a leading "ศึก" belong to every alternative
  const arrow = /→/.test(texts[0]);
  const fight = /(?:^|\s)ศึก/.test(texts[0]);
  for (let i = 1; i < texts.length; i++) {
    if (arrow && !/→/.test(texts[i]) && /^(?:cv\.\d+|[a-z]{2}\.[btaelx]\d+|[A-Z]{2,4}-\d{2,3})/.test(texts[i])) texts[i] = `→ ${texts[i]}`;
    if (fight && !/ศึก/.test(texts[i])) texts[i] = `ศึก ${texts[i]}`;
  }
  // "ศึก: A หรือ B (ทาง ข)": the choices named at the end hold for every alternative
  const forChoices = texts[texts.length - 1].match(/^(.*?)\s*(\(\s*ทาง\s*[กขค](?:\s*(?:หรือ|และ|,)\s*[กขค])*\s*\))\s*$/);
  if (forChoices) {
    texts[texts.length - 1] = forChoices[1];
    for (let i = 0; i < texts.length; i++) texts[i] = `${texts[i]} ${forChoices[2]}`;
  }
  // "`art` หรือ `music` +1": a number written once after the last alternative counts for the bare codes before it
  const tail = texts[texts.length - 1].match(/^`[^`]+`\s*([+\-−]\d+)$/);
  if (tail) for (let i = 0; i < texts.length - 1; i++) if (/^`[^`]+`$/.test(texts[i])) texts[i] = `${texts[i]} ${tail[1]}`;
  const subs = texts.map((t) => {
    const sub = fresh();
    const rest = segmentFull(t, ids, sub, opts);
    return { sub, rest, t };
  });
  if (subs.some((x) => hasMeta(x.sub))) return null;
  const withEffects = subs.filter((x) => x.sub.effects.length);
  const adjacent = /[`%\d)]\s*$/.test(alts[0]) || /^\s*`/.test(alts[alts.length - 1]);
  const battle = withEffects.some((x) => x.sub.effects.some((e) => e.k === 'battle'));
  // event ids written bare ("เพราะ DR-05 หรือ WR-06") are causes the text mentions, not results to choose between
  const bare = (e: Effect) => (e.k === 'event' && !e.open) || e.k === 'npc' || e.k === 'place';
  if (withEffects.every((x) => x.sub.effects.every(bare))) return null;
  if (withEffects.length < 2 && !(withEffects.length === 1 && adjacent && !battle)) return null;
  const of = subs.map((x) => ({
    label: x.t.replace(/^→\s*/, '').replace(/`/g, '').replace(/\s+/g, ' ').trim(),
    effects: x.sub.effects,
  }));
  out.effects.push({ k: 'pick', of });
  const left = subs.map((x) => x.rest).join(' ');
  for (const x of subs) out.unparsed.push(...x.sub.unparsed);
  return /\d|%|×/.test(left.replace(/\s+/g, ' ')) ? left : '';
}

/** One segment: a condition around its effects, a choice between them, or plain effects. Returns what was left unread. */
function segmentFull(seg: string, ids: IdIndex, out: Parsed, opts: ParseOpts): string {
  const w = condWrap(seg, ids, out, opts);
  if (w !== null) return w;
  const p = pickSegment(seg, ids, out, opts);
  if (p !== null) return p;
  return segment(seg, ids, out, opts);
}

/** Every `text` condition inside any effect, condition, choice or node (they cannot be evaluated, so the generators report them). */
export function textConditions(x: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (o.k === 'text' && typeof o.text === 'string') out.push(o.text);
      for (const val of Object.values(o)) walk(val);
    }
  };
  walk(x);
  return out;
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
  const m = seg.match(/^ถ้า(?:อยู่|เป็น)\s*((?:[A-Z]{2}-\d\d(?:[\s,]|หรือ)*)+)(?:\([^)]*\))?\s*:\s*(.+)$/s);
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
    const label = (/ไม่เข้า/.test(seg) ? seg.replace(/`/g, '') : seg.replace(/`[^`]+`(?:\s*\d+(?:\.\d+)?%)?/g, ''))
      .replace(/\{[^}]*\}/g, '')
      .replace(/\(\s*(?:ต้องมี|ให้)?\s*\)/g, '')
      .replace(/ทาง(?:สู่|ไป|เปิด)\s*(?:อาชีพลับ|อาชีพ)?\s*$/, '')
      .replace(/\s*หรือ\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    const before = out.effects.length;
    const rest = segmentFull(seg, ids, out, opts);
    // a choice between codes keeps both of them in the label ("soldier หรือ mercenary"), the way the doc says it
    const picked = out.effects.slice(before).some((e) => e.k === 'pick') && splitOr(seg) !== null;
    if (picked) labels.push(seg.replace(/`/g, '').replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim());
    else if (label) labels.push(label);
    const left = rest.replace(/\s+/g, ' ').trim();
    if (/\d|%|×/.test(left)) out.unparsed.push(seg.trim());
  }
  out.label = labels.join(' · ');
  // a cell made only of codes ("`soldier` หรือ `mercenary`") has no words left: say the codes (review L1)
  if (!out.label || /^(?:หรือ|\()/.test(out.label))
    out.label = text
      .split(/\s+·\s+/)
      .map((x) => x.replace(/`/g, '').replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' · ');
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
