// Grammar of the event rows (world events, branch events, last-era events, local events).
// It reads the phrases of the "permanent result" cells that world-events.md, branches/ and local-events.md write in Thai
// beside the ids, and returns Effect objects (src/core/types.ts). Phrases that still hold a digit, a percent or a
// multiplier after the known patterns are taken out come back as `unparsed` for data/gen/_unparsed/events.md.
//
// Patterns read as effects:
//   DFC+1 · DFC −1                              stat DFC
//   ศรัทธาโลก +15 · ความหิว −40 · สุขภาพ −30 · ความหนาหมอก/หมอกรุก ±n · มลพิษ +n · ระดับทะเล +1   stat F H T D P SEA
//   อารมณ์มังกร +40 ทุกตัว · เพดานอารมณ์ทุกตัว −3    stat mood.all · mood.cap.all
//   ศรัทธามังกร −30 · ศรัทธาช่อง A ทั่วโลก +10        stat F.dragon · F.A
//   เรียก DR-15 · บังคับ PL-01 · เปิด ... · ids       event (open when the verb opens it)
//   `WR-24` น้ำหนัก +10 · cv.10 น้ำหนัก +5          stat weight:<id>
//   → LC-32 ×1.5 · → ปิด LC-39                      chain (local events)
//   c_wanted · b_x (ids of gifts)                  grant
import type { Effect } from '../../../src/core/types';
import type { WorldCond } from '../../../src/core/data/types-events';
import type { IdIndex } from './ids';

export const WORLD_PREFIXES = ['DR', 'PL', 'WR', 'CT', 'DM', 'MC', 'BIO', 'GD', 'HP', 'PO', 'GI', 'FG', 'END'];
export const BRANCH_PREFIXES = ['SF', 'AS', 'DW', 'RF', 'WT', 'RL', 'CL', 'DV'];
/** Same pattern the doc-level sim uses to find world event ids in a cell. */
export const idRe = new RegExp(`\\b(?:${WORLD_PREFIXES.join('|')})-\\d{2}\\b`, 'g');
export const anyEventRe = new RegExp(`\\b(?:${[...WORLD_PREFIXES, ...BRANCH_PREFIXES, 'LE'].join('|')})-\\d{2}\\b`, 'g');
export const lcRe = /\bLC-\d{2,3}\b/g;

export const idsIn = (s: string): string[] => s.match(idRe) || [];
export const anyIdsIn = (s: string): string[] => [...new Set(s.match(anyEventRe) || [])];

const MINUS = /[−–]/g;
export const num = (s: string) => Number(s.replace(MINUS, '-'));
/** Markdown emphasis out, so patterns read plain text. */
export const plain = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

// ---------- conditions of a world event ----------

/** Era window from a condition cell: `ยุค ≥ 2` · `ยุค 1–2` · `ยุค 4`; none = every era (port of the sim's eraGate). */
export function eraGate(c: string): [number, number] {
  let m: RegExpMatchArray | null;
  if ((m = c.match(/ยุค ≥ (\d)/))) return [+m[1], 4];
  if ((m = c.match(/ยุค (\d)[–-](\d)/))) return [+m[1], +m[2]];
  if ((m = c.match(/ยุค (\d)(?!\d)/))) return [+m[1], +m[1]];
  return [1, 4];
}

/** Era column of a war row: `1+` `2+` `3+` `4`. */
export function eraColumn(c: string): [number, number] | null {
  const m = c.trim().match(/^(\d)(\+)?$/);
  if (!m) return null;
  return m[2] ? [+m[1], 4] : [+m[1], +m[1]];
}

export interface VarCondOut {
  v: string;
  op: '<' | '>';
  n: number;
}

/** State thresholds of a condition cell: hunger, tree health, fog, faith, mood of the awakening pillar, disturbance. */
export function thresholds(c: string, pillarIndex: number | undefined): VarCondOut[] {
  const thr: VarCondOut[] = [];
  let m: RegExpMatchArray | null;
  if ((m = c.match(/ความหิว > (\d+)/))) thr.push({ v: 'H', op: '>', n: +m[1] });
  if ((m = c.match(/สุขภาพต้นไม้ < (\d+)/))) thr.push({ v: 'T', op: '<', n: +m[1] });
  if ((m = c.match(/ความหนาหมอก > (\d+)/))) thr.push({ v: 'D', op: '>', n: +m[1] });
  if ((m = c.match(/(?:ศรัทธาโลก|ศรัทธา|ความเชื่อ) < (\d+)/))) thr.push({ v: 'F', op: '<', n: +m[1] });
  if ((m = c.match(/(?:ศรัทธาโลก|ศรัทธา) > (\d+)/))) thr.push({ v: 'F', op: '>', n: +m[1] });
  // beyond the sim: `ศรัทธาโลกต่ำกว่า 38` (WR-23, END-10) and Mecharia pollution (the sim has no such variable)
  if (!thr.some((t) => t.v === 'F' && t.op === '<') && (m = c.match(/ศรัทธา(?:โลก)?ต่ำกว่า (\d+)/))) thr.push({ v: 'F', op: '<', n: +m[1] });
  if ((m = c.match(/มลพิษ > (\d+)/))) thr.push({ v: 'P', op: '>', n: +m[1] });
  if (pillarIndex !== undefined && (m = c.match(/อารมณ์ < (\d+)/))) thr.push({ v: 'M' + pillarIndex, op: '<', n: +m[1] });
  if ((m = c.match(/การรบกวน(\S+?) > (\d+)/))) thr.push({ v: 'Z:' + m[1], op: '>', n: +m[2] });
  return thr;
}

// ---------- effects of a world, branch or last-era event ----------

const VAR_NAMES: [string, string][] = [
  ['ศรัทธาช่อง A ทั่วโลก', 'F.A'],
  ['ศรัทธามังกร', 'F.dragon'],
  ['ศรัทธาโลก', 'F'],
  ['ศรัทธา', 'F'],
  ['ความหิวมอร์เฮเวน', 'H'],
  ['ความหิว', 'H'],
  ['สุขภาพต้นไม้', 'T'],
  ['สุขภาพ', 'T'],
  ['ความหนาหมอก', 'D'],
  ['หมอกเนบูเลียหนาขึ้น', 'D'],
  ['หมอกรุก', 'D'],
  ['มลพิษเมคาเรีย', 'P'],
  ['มลพิษ', 'P'],
  ['ระดับทะเล', 'SEA'],
  ['เพดานอารมณ์ทุกตัว', 'mood.cap.all'],
  ['อารมณ์มังกรทุกตัว', 'mood.all'],
  ['อารมณ์มังกร', 'mood.all'],
  ['อารมณ์นิเวรี', 'mood.14'],
  ['อายุขัยเฉลี่ยโลก', 'lifespan'],
  ['ประชากรโลก', 'population'],
  ['ประชากร', 'population'],
  ['ความตึงเครียด', 'tension'],
  ['ตึงเครียด', 'tension'],
  ['อุณหภูมิโลก', 'temperature'],
  ['กุญแจที่รวมได้', 'K'],
];
/** The number must not be glued to a code: in `ความหิวสะสม → DM-08` the `-08` belongs to the event id, not to the hunger. */
const VAR_RE = new RegExp(
  `(${VAR_NAMES.map(([n]) => n)
    .sort((a, b) => b.length - a.length)
    .join('|')})(?:[^\\d+\\-−;·()]{0,24}?)\\s*(?<![A-Za-z0-9])([+\\-−]\\d+(?:\\.\\d+)?)(%)?`,
  'g',
);
const VAR_CODE = new Map(VAR_NAMES);
/** Words after a consumed number that only say how long or how often it lasts. */
const DURATION = /^\s*(?:\(ครั้งเดียว\)|ครั้งเดียว|ถาวร|(?:\d+|หนึ่ง|สอง|สาม|ห้า|สิบ)\s*(?:ปี|ทศวรรษ)|ต่อทศวรรษ|ทุกตัว|ทั่วโลก)/;
const OPEN_VERBS = /(?:เรียก|บังคับ|เปิด|ลูกโซ่|→|ตามมา)\s*$/;
/** Words after an event id that only make it likelier, sooner or heavier: the row names the event, it does not open it. */
const NUDGE = /^\s*(?:เกิดเร็วขึ้น|เกิดช้าลง|เกิดเร็ว|เกิดช้า|เร็วขึ้น|ช้าลง|ถี่ขึ้น|หนักขึ้น)/;

/** Ids of countries, NPCs, nodes and events carry digits that are not numbers of an effect. */
const NOISE = /\b[A-Z]{2}\d{2}-\d\b|\b(?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}\b|\bcv\.\d+\b|\b[a-z]{2}\.[a-z]\d+\b|\b(?:LC|LE|LT)-\d+\b|\b(?:[A-Z]{2,3})-\d{2}\b|`\s*`/g;
const MDLINK = /\[([^\]]*)\]\([^)]*\)/g;
/** A markdown link only points at a file: its words and digits are not an effect. */
const stripLinks = (s: string) => s.replace(MDLINK, ' ');

/** What is left of a segment once the known patterns are out: true when it still holds a number, a percent or a multiplier. */
export function leftover(seg: string): string {
  return stripLinks(seg).replace(NOISE, ' ').replace(/ตัวที่\s*\d+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The phrase to report: the whole segment when it is short, else the words around the first number that is left. */
export function phraseOf(seg0: string, left: string): string {
  const s = seg0.trim();
  if (s.length <= 110) return s;
  const toks = left.split(' ');
  const i = toks.findIndex((t) => /\d|%|×/.test(t));
  return toks.slice(Math.max(0, i - 4), i + 2).join(' ');
}

/** Truth layers of the world revealed: ความจริงชั้น 2 · ความจริงชั้นที่ 1–2. */
function truthLayers(seg: string, out: { effects: Effect[] }, eat: (s: string) => void): void {
  for (const m of [...seg.matchAll(/ความจริงชั้น(?:ที่)?\s*(\d)(?:\s*[–-]\s*(\d))?/g)]) {
    for (let n = +m[1]; n <= +(m[2] ?? m[1]); n++) out.effects.push({ k: 'grant', kind: 'flag', id: `truth.${n}` });
    eat(m[0]);
  }
}

export interface Parsed {
  effects: Effect[];
  chain: string[];
  unparsed: string[];
}

// ---------- conditions as a tree ----------

const EV = `(?:${[...WORLD_PREFIXES, ...BRANCH_PREFIXES, 'LE', 'LC'].join('|')})-\\d{2,3}`;
const THAI = /[฀-๿]/g;
const FILLER = /หลัง|เมื่อ|เกิดแล้ว|แล้ว|ทุกยุค|ที่|ของ|และ|หรือ|ถึง|ขึ้นไป|อย่างน้อย|รายการ|ชิ้น/g;
const thaiLen = (s: string) => (s.replace(FILLER, '').match(THAI) || []).length;
const tidy = (s: string) => s.replace(/`/g, '').replace(/\s+/g, ' ').replace(/^[\s·;,:+/→]+|[\s·;,:+/→]+$/g, '').trim();
const OUTCOME_WORD: Record<string, 'a' | 'b' | 'c'> = { ผนึก: 'a', เปิด: 'b', กระจาย: 'c' };
const PATH_KEY: Record<string, 'a' | 'b' | 'c'> = { ก: 'a', ข: 'b', ค: 'c' };

/**
 * Variable thresholds as a condition tree reads them: wider than `thresholds` (which stays as the sim-equal flat view): both signs, `ต่ำกว่า`,
 * the world tree as `สุขภาพต้นไม้โลก` or `สุขภาพ`, the mood of the last pillar and the pair tension.
 */
const VAR_PHRASES: [string, (pillar: number | undefined, m: RegExpMatchArray) => string | null][] = [
  ['ความหิว(?:มอร์เฮเวน)?', () => 'H'],
  ['สุขภาพต้นไม้(?:โลก)?|สุขภาพ', () => 'T'],
  ['ความหนาหมอก', () => 'D'],
  ['ศรัทธา(?:โลก)?|ความเชื่อ', () => 'F'],
  ['มลพิษ(?:เมคาเรีย)?', () => 'P'],
  ['อารมณ์นิเวรี', () => 'M14'],
  ['อารมณ์', (pillar) => (pillar === undefined ? null : 'M' + pillar)],
  ['การรบกวน(?<z>\\S+?)', (_, m) => 'Z:' + m.groups!.z],
  ['ความตึงเครียดคู่', () => 'tension'],
];

/** The readable atoms of one clause: era, DFC, keys, HP count, variable thresholds, events. What is not read comes back as `rest`. */
function atomsOf(s0: string, pillar: number | undefined, dragons: readonly string[] = []): { atoms: WorldCond[]; rest: string; hit: boolean } {
  let s = s0;
  let hit = false;
  const atoms: WorldCond[] = [];
  const take = (re: RegExp, f: (m: RegExpMatchArray) => WorldCond | null) => {
    for (const m of [...s.matchAll(re)]) {
      hit = true;
      const a = f(m);
      if (a) atoms.push(a);
    }
    s = s.replace(re, ' ');
  };
  const era = (min: number, max?: number): WorldCond | null => (min <= 1 && (max === undefined || max >= 4) ? null : { k: 'era', min, ...(max !== undefined && max < 4 ? { max } : {}) });
  take(/ยุค\s*≥\s*(\d)/g, (m) => era(+m[1]));
  take(/ยุค\s*(\d)\s*[–-]\s*(\d)/g, (m) => era(+m[1], +m[2]));
  take(/ยุค\s*(\d)(?!\d)/g, (m) => era(+m[1], +m[1]));
  take(/DFC\s*≥\s*(\d+)/g, (m) => ({ k: 'cmp', stat: 'dfc', op: '>=', value: +m[1] }));
  take(/DFC\s*=\s*(\d+)/g, (m) => ({ k: 'cmp', stat: 'dfc', op: '==', value: +m[1] }));
  take(/เหตุการณ์ HP เกิดแล้วอย่างน้อย\s*(\d+)\s*รายการ/g, (m) => ({ k: 'cmp', stat: 'happened.HP', op: '>=', value: +m[1] }));
  take(/(?:ผู้ครอบครอง|ผู้ถือ)?กุญแจ[฀-๿]{0,14}?\s*(?:≥\s*)?(\d+)\s*\+?(?:\s*ชิ้น)?/g, (m) => ({ k: 'cmp', stat: 'keys', op: '>=', value: +m[1] }));
  // "อารมณ์เพลิงนิรันดร์ < 40": the mood of a dragon named in the words
  const phrases: typeof VAR_PHRASES = dragons.length
    ? [[`อารมณ์(?<dn>${[...dragons].sort((a, b) => b.length - a.length).join('|')})`, (_, m) => 'M' + dragons.indexOf(m.groups!.dn)], ...VAR_PHRASES]
    : VAR_PHRASES;
  for (const [name, code] of phrases) {
    // "ศรัทธาโลก < 20 นาน 3 ทศวรรษ": the threshold has to hold that many decades in a row (DR-01)
    take(new RegExp(`(?:${name})\\s*(?<op>[<>]|ต่ำกว่า)\\s*(?<n>\\d+)(?:\\s*นาน\\s*(?<dec>\\d+)\\s*ทศวรรษ)?`, 'g'), (m) => {
      const c = code(pillar, m);
      return c ? { k: 'var', name: c, op: m.groups!.op === '>' ? '>' : '<', n: +m.groups!.n, ...(m.groups!.dec ? { decades: +m.groups!.dec } : {}) } : null;
    });
  }
  take(new RegExp(`(${EV})\\s*จบด้วยการ(เปิด|ผนึก|กระจาย)(?:กุญแจ)?`, 'g'), (m) => ({ k: 'event', id: m[1], happened: true, outcome: OUTCOME_WORD[m[2]] }));
  take(new RegExp(`(?:หลัง\\s*)?(${EV}(?:\\s*/\\s*${EV})*)(?:\\s*(?:ทาง\\s*)?([กขค])\\))?(?:\\s*(เกิดแล้ว|ยังไม่เกิด|แล้ว|ใกล้เกิด|ใกล้|กำลังเดิน|สำเร็จ))?`, 'g'), (m) => {
    const list = m[1].split(/\s*\/\s*/);
    const mk = (id: string): WorldCond => ({
      k: 'event',
      id,
      happened: m[3] !== 'ยังไม่เกิด',
      ...(m[2] ? { outcome: PATH_KEY[m[2]] } : {}),
      ...(m[3] && /ใกล้/.test(m[3]) ? { phase: 'near' as const } : m[3] === 'กำลังเดิน' ? { phase: 'running' as const } : {}),
    });
    return list.length > 1 ? { k: 'or', of: list.map(mk) } : mk(list[0]);
  });
  return { atoms, rest: s, hit: hit || atoms.length > 0 };
}

export interface CondParse {
  cond: WorldCond | null;
  /** prose the parser could not read, one entry per `{k:'text'}` leaf of `cond` */
  texts: string[];
}

const allOf = (xs: WorldCond[]): WorldCond | null => {
  const flat = xs.flatMap((x) => (x.k === 'and' ? x.of : [x]));
  const seen = new Set<string>();
  const uniq = flat.filter((x) => {
    const key = JSON.stringify(x);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return uniq.length === 0 ? null : uniq.length === 1 ? uniq[0] : { k: 'and', of: uniq };
};

/**
 * A condition cell as a tree. `;` `+` and `·` join with and; `หรือ` and ` / ` split into or (and binds tighter than or); an or or an and is
 * only split when one side holds a readable atom, so a prose phrase like "พงไพรหรือหมอก" stays one text. A parenthesis that holds an atom
 * defines the words in front of it (`ทุกฝ่ายหมดศรัทธา (ศรัทธาโลกต่ำกว่า 38)` is the threshold). Left-over prose becomes a `text` leaf.
 */
export function parseCond(cell: string, opts: { pillar?: number; dragons?: readonly string[] } = {}): CondParse {
  const texts: string[] = [];
  const pillar = opts.pillar;
  const dragons = opts.dragons ?? [];
  let t = stripLinks(plain(cell)).replace(/`/g, '').replace(/\s*·\s*\d+(?:\.\d+)?%\s*ต่อทศวรรษ.*$/, '');
  const masks: string[] = [];
  t = t.replace(/\([^()]*\)/g, (m) => {
    masks.push(m);
    return `\u0001${masks.length - 1}\u0002`;
  });
  const unmask = (s: string) => s.replace(/\u0001(\d+)\u0002/g, (_, i) => masks[+i]);
  const hasAtoms = (s: string) => atomsOf(unmask(s), pillar, dragons).hit;

  const leaf = (piece0: string): WorldCond | null => {
    const piece = unmask(piece0);
    // "ถ้า LC-32 เกิดแล้ว เรื่องทะเบียนใช้ผลเดิม" is a rule about sharing a result, not something to wait for
    if (/^\s*ถ้า/.test(piece)) {
      const text = tidy(piece);
      texts.push(text);
      return { k: 'text', text };
    }
    const parens: string[] = [];
    const outside = piece.replace(/\(([^()]*)\)/g, (_, p) => {
      parens.push(p);
      return ' ';
    });
    const out = atomsOf(outside, pillar, dragons);
    // A bracket that offers another way ("(หรือเกาะร่วงต่อเนื่อง)", "(หรืออารมณ์เพลิงนิรันดร์ < 40)", "(ศรัทธาเปลี่ยนมือ หรือพระเจ้าทำลาย…)") is a branch of an
    // or: the atoms it holds, else a text leaf next to the readable part. It is never dropped (the condition would silently get narrower).
    const alts: WorldCond[] = [];
    const rest = parens.filter((p) => {
      const lead = /^\s*หรือ\s*/.test(p);
      const offers = lead || (/หรือ/.test(p) && out.atoms.some((a) => a.k === 'var'));
      if (!offers) return true;
      const body = p.replace(/^\s*หรือ\s*/, '');
      const a = atomsOf(body, pillar, dragons);
      if (a.hit) {
        if (!lead) return true;
        const c = allOf(a.atoms);
        if (c) alts.push(c);
        return false;
      }
      const text = tidy(body);
      texts.push(text);
      alts.push({ k: 'text', text });
      return false;
    });
    const inn = atomsOf(rest.join(' ; '), pillar, dragons);
    const parts: WorldCond[] = [...out.atoms, ...inn.atoms];
    if (!parts.length && !out.hit && !inn.hit && !alts.length) {
      const text = tidy(piece);
      if (thaiLen(text) < 3) return null;
      texts.push(text);
      return { k: 'text', text };
    }
    if (out.hit && thaiLen(out.rest) >= 4) {
      const text = tidy(out.rest);
      texts.push(text);
      parts.push({ k: 'text', text });
    }
    const base = allOf(parts);
    if (!alts.length) return base;
    return base ? { k: 'or', of: [base, ...alts] } : allOf(alts);
  };
  const andOf = (piece: string): WorldCond | null => {
    const bits = piece.split(/\s*และ\s*/).filter((x) => x.trim());
    if (bits.length > 1 && bits.some(hasAtoms)) return allOf(bits.map(leaf).filter((x): x is WorldCond => !!x));
    return leaf(piece);
  };
  const orOf = (part: string): WorldCond | null => {
    const bits = part.split(/\s*หรือ\s*|\s+\/\s+/).filter((x) => x.trim());
    if (bits.length > 1 && bits.some(hasAtoms)) {
      const of = bits.map(andOf).filter((x): x is WorldCond => !!x);
      return of.length > 1 ? { k: 'or', of } : (of[0] ?? null);
    }
    return andOf(part);
  };
  const conds = t
    .split(/\s*;\s*|\s+\+\s+|\s+·\s+/)
    .filter((x) => x.trim())
    .map(orOf)
    .filter((x): x is WorldCond => !!x);
  return { cond: allOf(conds), texts };
}

// ---------- effect segments ----------

interface SegCtx {
  out: Parsed;
  self: string;
  ids: IdIndex;
}

const noteId = (ctx: SegCtx, id: string) => {
  if (id !== ctx.self && !ctx.out.chain.includes(id)) ctx.out.chain.push(id);
};

/** Segments of an effect cell: `;` and ` · ` end one. */
export function segmentsOf(cell: string): string[] {
  return stripLinks(plain(cell))
    .replace(/\s+/g, ' ')
    .split(/\s*;\s*|\s+·\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** True when a segment holds a word that makes its effects a choice, a condition or a swap (the test of M0-c: such a segment must come out as pick, if or replace). */
export const STRUCTURE_WORDS = /หรือ|(?:^|[\s(])ถ้า|แทน/;

/** `ปลุกสำเร็จ → DR-14 …` `ถ้าฟักสำเร็จ: …` `ไข่แตกเสีย → …`: one case of a row whose cases are told apart by how it went. */
const CASE_RE = /(?:^|[:：]\s*)(ถ้า)?([^→:：;]*?(?:สำเร็จ|ล้มเหลว|ถูกขโมย|แตกเสีย)[^→:：;]*?)\s*(?:→|[:：])\s*(.+)$/;
function caseOf(seg: string): { prefix: string; label: string; body: string } | null {
  if ((seg.match(/(?:^|\s)ถ้า/g) || []).length >= 2) return null; // several ถ้า cases in one segment are told apart in parseSeg
  const m = CASE_RE.exec(seg);
  if (!m) return null;
  // the arrow stays in front of the body, so an event right after it reads as opened
  const arrow = /→/.test(seg.slice(m.index + m[0].length - m[3].length - 3, m.index + m[0].length - m[3].length));
  return { prefix: seg.slice(0, m.index).trim(), label: m[2].trim(), body: (arrow ? '→ ' : '') + m[3].trim() };
}

/** `ต่อต้าน: END-10`: a label and one event. */
const LABEL_ID = new RegExp(`(?:^|→\\s*)([฀-๿]{2,14})\\s*[:：]\\s*(${EV})\\s*$`);

const optionLabel = (s: string) => tidy(s.replace(/\([^()]*\)/g, ' ')).slice(0, 80);

function pickOf(options: { label?: string; effects: Effect[]; fallback?: string }[]): Effect {
  return {
    k: 'pick',
    of: options.map((o) => ({
      ...(o.label ? { label: o.label } : {}),
      effects: o.effects.length || !o.fallback ? o.effects : [{ k: 'label' as const, text: o.fallback }],
    })),
  };
}

/** Effects of one segment, with the structure the words say: pick (หรือ, /, เลือกหนึ่ง, cases), if (ถ้า, หลัง, เมื่อถึงยุค) and replace (แทน). */
function parseSeg(seg0: string, ctx: SegCtx): Effect[] {
  const { out, ids } = ctx;
  const fx: Effect[] = [];
  let seg = seg0.trim();
  if (!seg) return fx;
  const eat = (s: string | RegExp) => {
    seg = seg.replace(s, ' ');
  };
  const wraps: WorldCond[] = [];

  // "เมื่อถึงยุค 4": the whole segment waits for the era
  const era = seg.match(/เมื่อถึงยุค\s*(\d)/);
  if (era) {
    wraps.push({ k: 'era', min: +era[1] });
    eat(era[0]);
  }

  // "แทน WR-01 ด้วย WR-22"
  for (const m of [...seg.matchAll(new RegExp(`แทน\\s*(${EV})\\s*ด้วย\\s*(${EV})`, 'g'))]) {
    fx.push({ k: 'replace', from: m[1], to: m[2] });
    noteId(ctx, m[1]);
    noteId(ctx, m[2]);
    eat(m[0]);
  }

  // "(↔สกายฟอลล์ หลัง DR-01)": a note that holds only after the event
  for (const m of [...seg.matchAll(new RegExp(`\\(([^()]*?)\\s*หลัง\\s*(${EV})\\s*\\)`, 'g'))]) {
    fx.push({ k: 'if', cond: { k: 'event', id: m[2], happened: true }, then: [{ k: 'label', text: tidy(m[1]) }] });
    noteId(ctx, m[2]);
    eat(m[0]);
  }

  // "HP-08 เกิดได้ถ้ามีทายาทฟ้าจาก SF-03": the first event is open only when the second has happened
  for (const m of [...seg.matchAll(new RegExp(`(${EV})\\s*เกิดได้ถ้า(?:มี)?[^()]*?(${EV})`, 'g'))]) {
    fx.push({ k: 'if', cond: { k: 'event', id: m[2], happened: true }, then: [{ k: 'event', id: m[1] }] });
    noteId(ctx, m[1]);
    noteId(ctx, m[2]);
    eat(m[0]);
  }

  // "ถ้า DR-01 เกิดแล้ว: …"
  const lead = seg.match(new RegExp(`^ถ้า\\s*(${EV}(?:\\s*(?:หรือ|/)\\s*${EV})*)\\s*(?:เกิดแล้ว|แล้ว)\\s*[:：]?\\s*(.*)$`));
  if (lead) {
    const c = parseCond(lead[1] + ' เกิดแล้ว').cond!;
    const then = parseSeg(lead[2], ctx);
    for (const id of lead[1].match(new RegExp(EV, 'g')) || []) noteId(ctx, id);
    fx.push({ k: 'if', cond: c, then: then.length ? then : [{ k: 'label', text: tidy(lead[2]) }] });
    return wrap(fx, wraps);
  }

  // "ราคา (เลือกหนึ่ง): A / B / C"
  const choose = seg.match(/^(.*?)\(เลือกหนึ่ง\)\s*[:：]\s*(.*)$/);
  if (choose) {
    if (tidy(choose[1])) fx.push({ k: 'label', text: tidy(choose[1]) });
    fx.push(pickOf(choose[2].split(/\s+\/\s+/).map((o) => ({ label: optionLabel(o), effects: parseSeg(o, ctx), fallback: tidy(o) }))));
    return wrap(fx, wraps);
  }

  // two or more "ถ้า …" cases in one segment
  const ifs = seg.split(/(?:^|\s)(?=ถ้า)/).filter((x) => x.trim());
  if (ifs.filter((x) => x.startsWith('ถ้า')).length >= 2) {
    const common = ifs[0].startsWith('ถ้า') ? '' : ifs.shift()!;
    if (common.trim()) fx.push(...parseSeg(common, ctx));
    fx.push(
      pickOf(
        ifs.map((piece) => {
          const arrow = piece.match(/^ถ้า\s*(.*?)\s*→\s*(.*)$/);
          const word = piece.match(/^ถ้า\s*([฀-๿]+)\s*(.*)$/);
          const label = arrow ? arrow[1] : (word?.[1] ?? '');
          const body = arrow ? '→ ' + arrow[2] : (word?.[2] ?? piece);
          return { label, effects: parseSeg(body, ctx), fallback: tidy(body) };
        }),
      ),
    );
    return wrap(fx, wraps);
  }

  // "รับ → … ขับไล่ → WR-22": a choice told as arrows, each answer named by the last word before its arrow
  if ((seg.match(/→/g) || []).length >= 2 && !/ถ้า/.test(seg)) {
    const pieces = seg.split('→').map((x) => x.trim());
    const labels = [pieces[0]];
    const bodies: string[] = [];
    for (let i = 1; i < pieces.length; i++) {
      if (i < pieces.length - 1) {
        const m = pieces[i].match(/^(.*?)\s+(\S+)$/);
        bodies.push(m ? m[1] : pieces[i]);
        labels.push(m ? m[2] : '');
      } else bodies.push(pieces[i]);
    }
    fx.push(pickOf(labels.map((label, i) => ({ label, effects: parseSeg(bodies[i], ctx), fallback: tidy(bodies[i]) }))));
    return wrap(fx, wraps);
  }

  // "A หรือ B" / "A / B" between event ids
  seg = seg.replace(/\b([A-Z]{2,3})-(\d{2})\/(\d{2})\b/g, '$1-$2/$1-$3');
  const toks = [...seg.matchAll(new RegExp(EV, 'g'))];
  const groups: (typeof toks)[] = [];
  for (let i = 0; i < toks.length; i++) {
    const prev = groups[groups.length - 1];
    const last = prev?.[prev.length - 1];
    const between = last ? seg.slice(last.index! + last[0].length, toks[i].index) : '';
    if (prev && /^\s*\)?\s*(?:หรือ|\/)\s*[฀-๿]{0,16}\s*\(?\s*$/.test(between)) prev.push(toks[i]);
    else groups.push([toks[i]]);
  }
  for (const g of groups.filter((x) => x.length >= 2)) {
    const first = g[0];
    const open = OPEN_VERBS.test(seg.slice(0, first.index));
    const options = g.map((t) => {
      // an option is named by the word in front of its bracket: `ยารักษา (HP-06) หรือกักกัน (PO-06)`
      const head = seg.slice(0, t.index);
      let label = '';
      if (/\(\s*$/.test(head)) {
        const run = head.replace(/[\s(]+$/, '').match(/[฀-๿]+$/)?.[0] ?? '';
        label = run.includes('หรือ') ? run.slice(run.lastIndexOf('หรือ') + 4) : run;
      }
      noteId(ctx, t[0]);
      return { label: label.slice(-20) || undefined, effects: [open ? ({ k: 'event', id: t[0], open: true } as Effect) : ({ k: 'event', id: t[0] } as Effect)] };
    });
    fx.push(pickOf(options));
    for (const t of g) seg = seg.replace(t[0], ' ');
    seg = seg.replace(/\s(?:หรือ|\/)[฀-๿]{0,16}/g, ' ');
  }

  // "ร่วมมือ: END-11 · ต่อต้าน: END-10": this is told apart in parseRun, one level up

  // the mourning wave is described in rules.mourn
  const wave = seg.match(/อารมณ์มังกรที่เหลือ[^()]*\(ตัวที่สนิทสุด[^)]*\)/);
  if (wave) {
    fx.push({ k: 'label', text: 'คลื่นไว้อาลัย: ดู rules.mourn' });
    eat(wave[0]);
  }
  // "(DFC −1 เมื่อโตเต็มวัยใน HP-08)": the change belongs to the event that comes later
  for (const m of [...seg.matchAll(new RegExp(`\\(DFC\\s*[+\\-−]\\d+\\s*เมื่อ[^()]*?ใน\\s*(${EV})\\s*\\)`, 'g'))]) {
    fx.push({ k: 'event', id: m[1] });
    noteId(ctx, m[1]);
    eat(m[0]);
  }
  // "ผู้แพ้มีโอกาส 40% ล้ม (DFC+1)"
  for (const m of [...seg.matchAll(/มีโอกาส\s*(\d+)%\s*([฀-๿ ]*?)\s*\(DFC\s*([+\-−]\d+)\)/g)]) {
    fx.push({ k: 'chance', p: +m[1] / 100, text: tidy(m[2]), then: [{ k: 'stat', stat: 'DFC', delta: num(m[3]) }] });
    eat(m[0]);
  }
  for (const m of [...seg.matchAll(/DFC\s*([+\-−]\d+)/g)]) {
    fx.push({ k: 'stat', stat: 'DFC', delta: num(m[1]) });
    eat(m[0]);
  }
  for (const m of [...seg.matchAll(VAR_RE)]) {
    const code = VAR_CODE.get(m[1]);
    if (!code) continue;
    if (m[3] && code !== 'population') continue;
    fx.push({ k: 'stat', stat: m[3] ? code + '.pct' : code, delta: num(m[2]) });
    let tail = '';
    let rest = seg.slice(seg.indexOf(m[0]) + m[0].length);
    for (let i = 0; i < 2; i++) {
      const d = rest.match(DURATION);
      if (!d) break;
      tail += d[0];
      rest = rest.slice(d[0].length);
    }
    eat(m[0] + tail);
  }
  // rift state
  const rift = seg.match(/รอยแยกเมฆา\s*=\s*(เปิด|ปิด)/);
  if (rift) {
    fx.push(rift[1] === 'เปิด' ? { k: 'grant', kind: 'flag', id: 'rift_open' } : { k: 'remove', kind: 'flag', id: 'rift_open' });
    eat(rift[0]);
  }
  // event ids, with the verb in front telling whether the row opens it; a risk, a closeness and a refusal are words, not events
  const orig = seg;
  let lastOpen = false;
  for (const m of [...orig.matchAll(new RegExp(EV, 'g'))]) {
    const id = m[0];
    if (id === ctx.self) {
      eat(id);
      continue;
    }
    const before = orig.slice(0, m.index);
    const after = orig.slice((m.index ?? 0) + id.length);
    noteId(ctx, id);
    if (/(?:เสี่ยง|ใกล้)\s*\(?\s*$/.test(before) || /^\s*\)?\s*(?:เสี่ยง|ใกล้)/.test(after)) {
      fx.push({ k: 'label', text: `${id} ${/เสี่ยง/.test(before.slice(-8) + after.slice(0, 8)) ? 'เสี่ยง' : 'ใกล้'}` });
    } else if (/ป้องกัน\s*$/.test(before) || /^\s*ไม่เปิด/.test(after)) {
      fx.push({ k: 'label', text: /ป้องกัน\s*$/.test(before) ? `ป้องกัน ${id}` : `${id} ไม่เปิด` });
    } else if (!fx.some((e) => e.k === 'event' && e.id === id)) {
      // "→ FG-02, FG-14": the second one of a list opens like the first
      const open: boolean = (OPEN_VERBS.test(before) || (lastOpen && /(?:,|และ)\s*$/.test(before))) && !NUDGE.test(after);
      lastOpen = open;
      fx.push(open ? { k: 'event', id, open: true } : { k: 'event', id });
    }
    eat(id);
  }
  // ids of gifts: c_wanted b_nobleblood
  for (const m of [...seg.matchAll(/\b((?:nb|nc|ns|b|c|sp|cs|u|pa)_[a-z0-9_]+)\b/g)]) {
    fx.push({ k: 'grant', kind: ids.kind(m[1]), id: m[1] });
    eat(m[0]);
  }
  truthLayers(seg, { effects: fx }, eat);
  const left = leftover(seg);
  if (/\d|%|×/.test(left)) out.unparsed.push(phraseOf(seg0, left));

  // a single "ถ้า …" left over: the effects wait for a condition the parser cannot read
  const cond = seg0.match(/(?:^|\s)ถ้า\s*([฀-๿]+)/);
  if (cond && !fx.some((e) => e.k === 'if' || e.k === 'pick') && fx.some((e) => e.k !== 'label')) {
    out.unparsed.push(`ถ้า${cond[1]} …`);
    return wrap([{ k: 'if', cond: { k: 'text', text: `ถ้า${cond[1]}` }, then: fx }], wraps);
  }
  return wrap(fx, wraps);
}

const wrap = (fx: Effect[], wraps: WorldCond[]): Effect[] => (wraps.length && fx.length ? [{ k: 'if', cond: wraps.length === 1 ? wraps[0] : { k: 'and', of: wraps }, then: fx }] : fx);

/** Effects of one effect cell (segments separated by `;` or ` · `), for a world, branch or last-era event. */
export function parseWorldEffect(cell: string, self: string, ids: IdIndex): Parsed {
  const out: Parsed = { effects: [], chain: [], unparsed: [] };
  const ctx: SegCtx = { out, self, ids };
  const segs = segmentsOf(cell);
  for (let i = 0; i < segs.length; ) {
    // cases told apart by how it went (DR-02 DR-03)
    const c = caseOf(segs[i]);
    if (c) {
      const group = [c];
      let j = i + 1;
      for (let d: ReturnType<typeof caseOf>; j < segs.length && (d = caseOf(segs[j])); j++) group.push(d);
      if (c.prefix) out.effects.push(...parseSeg(c.prefix, ctx));
      if (group.length >= 2) out.effects.push(pickOf(group.map((g) => ({ label: g.label, effects: parseSeg(g.body, ctx), fallback: tidy(g.body) }))));
      else {
        out.unparsed.push(`ถ้า${c.label} …`);
        const then = parseSeg(c.body, ctx);
        out.effects.push({ k: 'if', cond: { k: 'text', text: c.label }, then: then.length ? then : [{ k: 'label', text: tidy(c.body) }] });
      }
      i = j;
      continue;
    }
    // "ร่วมมือ: END-11 · ต่อต้าน: END-10 · ปลอบ: END-12" (MC-12)
    const l = LABEL_ID.exec(segs[i]);
    if (l) {
      const run: RegExpExecArray[] = [l];
      let j = i + 1;
      for (let d: RegExpExecArray | null; j < segs.length && (d = LABEL_ID.exec(segs[j])); j++) run.push(d);
      if (run.length >= 2) {
        const open = OPEN_VERBS.test(segs[i].slice(0, l.index) + (segs[i].includes('→') ? '→' : ''));
        const head = segs[i].slice(0, l.index).replace(/→\s*$/, '').trim();
        if (head) out.effects.push({ k: 'label', text: head });
        out.effects.push(
          pickOf(
            run.map((r) => {
              noteId(ctx, r[2]);
              return { label: r[1], effects: [open ? ({ k: 'event', id: r[2], open: true } as Effect) : ({ k: 'event', id: r[2] } as Effect)] };
            }),
          ),
        );
        i = j;
        continue;
      }
    }
    out.effects.push(...parseSeg(segs[i], ctx));
    i++;
  }
  return out;
}

/** Splits an outcome cell (`**ก) จักรกลชนะ:** … **ข) …`) into its branches. */
export function splitOutcomes(cell: string): { key: 'a' | 'b' | 'c'; label: string; text: string }[] {
  const re = /\*\*([กขค])\)\s*([^*]*?)\*\*/g;
  const marks = [...cell.matchAll(re)];
  const keyOf: Record<string, 'a' | 'b' | 'c'> = { ก: 'a', ข: 'b', ค: 'c' };
  return marks.map((m, i) => ({
    key: keyOf[m[1]],
    label: m[2].replace(/[:：]\s*$/, '').trim(),
    text: cell.slice(m.index! + m[0].length, i + 1 < marks.length ? marks[i + 1].index : cell.length).trim(),
  }));
}

// ---------- last-era feedback (branches/04-last-era.md §3.1) ----------

export interface Feedback {
  keys?: { set?: number; delta?: number; chance?: number; max?: number; alt?: { delta: number; chance: number } };
  faith?: number;
  moodAll?: number;
  warMul?: { mul: number; years: number } | { clear: true };
  hpBlockYears?: number;
  lean?: { key: 'a' | 'b' | 'c'; label: string; chance: number; ending: string }[];
  text: string;
}

export function parseFeedback(cell: string, unparsed: string[]): Feedback {
  const text = plain(cell);
  const fb: Feedback = { text };
  for (const seg0 of text.split(/\s*·\s*/)) {
    let m: RegExpMatchArray | null;
    let ok = true;
    if ((m = seg0.match(/^K\s*=\s*(\d+)$/))) fb.keys = { set: +m[1] };
    else if ((m = seg0.match(/^K\s*([+\-−]\d+)\s*\(โอกาส\s*(\d+)%\)\s*หรือ\s*([+\-−]\d+)\s*\((\d+)%\)$/)))
      fb.keys = { alt: { delta: num(m[1]), chance: +m[2] / 100 }, delta: num(m[3]), chance: +m[4] / 100 };
    else if ((m = seg0.match(/^K\s*([+\-−]\d+)\s*\(โอกาส\s*(\d+)%\)$/))) fb.keys = { delta: num(m[1]), chance: +m[2] / 100 };
    else if ((m = seg0.match(/^K\s*([+\-−]\d+)\s*\(ไม่เกิน\s*(\d+)\)$/))) fb.keys = { delta: num(m[1]), max: +m[2] };
    else if ((m = seg0.match(/^K\s*([+\-−]\d+)$/))) fb.keys = { delta: num(m[1]) };
    else if ((m = seg0.match(/^ศรัทธาโลก\s*([+\-−]\d+(?:\.\d+)?)$/))) fb.faith = num(m[1]);
    else if ((m = seg0.match(/^อารมณ์มังกรทุกตัว\s*([+\-−]\d+)$/))) fb.moodAll = num(m[1]);
    else if ((m = seg0.match(/^น้ำหนักสงคราม \(WR\) ×([\d.]+) เป็นเวลา (\d+) ปี$/))) fb.warMul = { mul: Number(m[1]), years: +m[2] };
    else if (/^ยกเลิกน้ำหนักสงคราม/.test(seg0)) fb.warMul = { clear: true };
    else if ((m = seg0.match(/^เหตุการณ์ HP ถูกบล็อก (\d+) ปี$/))) fb.hpBlockYears = +m[1];
    else ok = false;
    if (!ok && /^(ไม่มี|LE-)/.test(seg0)) ok = true;
    if (!ok && /\d|%|×/.test(seg0)) unparsed.push(seg0);
  }
  return fb;
}

/** LE-11 row: `ผนึก 35% · เปิด 30% · กระจาย 35%` with the END each leads to (`ผนึกคูณโอกาส END-12 ×2`). */
export function parseLean(cell: string): { key: 'a' | 'b' | 'c'; label: string; chance: number; ending: string }[] {
  const text = plain(cell);
  const pick = (word: string) => text.match(new RegExp(`${word}\\s*(\\d+)%`))?.[1];
  const end = (word: string) => text.match(new RegExp(`${word}คูณโอกาส (END-\\d{2})`))?.[1] ?? text.match(new RegExp(`${word}คูณ (END-\\d{2})`))?.[1];
  const out: { key: 'a' | 'b' | 'c'; label: string; chance: number; ending: string }[] = [];
  const a = pick('ผนึก'), b = pick('เปิด'), c = pick('กระจาย');
  if (a && b && c)
    out.push(
      { key: 'a', label: 'ผนึก', chance: +a / 100, ending: end('ผนึก') ?? 'END-12' },
      { key: 'b', label: 'เปิด', chance: +b / 100, ending: end('เปิด') ?? 'END-11' },
      { key: 'c', label: 'กระจาย', chance: +c / 100, ending: 'END-10' },
    );
  return out;
}

// ---------- local events ----------

export interface LocalChainOut {
  to: string;
  op: 'mul' | 'close';
  mul?: number;
}

export interface LocalParsed extends Parsed {
  localChain: LocalChainOut[];
  receives: string[];
}

/** Effects of a local-event result cell or one of its branches. */
export function parseLocalEffect(cell: string, ids: IdIndex): LocalParsed {
  const out: LocalParsed = { effects: [], chain: [], unparsed: [], localChain: [], receives: [] };
  const text = stripLinks(plain(cell));
  for (const seg0 of text.split(/\s+·\s+(?=ได้รับผลจาก)|(?<=\))\s*(?=→)/)) {
    let seg = seg0;
    const eat = (s: string) => {
      seg = seg.replace(s, ' ');
    };
    for (const m of [...seg.matchAll(/ได้รับผลจาก\s+(LC-\d+)/g)]) {
      out.receives.push(m[1]);
      eat(m[0]);
    }
    for (const m of [...seg.matchAll(/→\s*ปิด\s+(LC-\d+)(?:\s*\([^)]*\))?/g)]) {
      out.localChain.push({ to: m[1], op: 'close' });
      eat(m[0]);
    }
    for (const m of [...seg.matchAll(/→\s*(LC-\d+)\s*×\s*([\d.]+)/g)]) {
      out.localChain.push({ to: m[1], op: 'mul', mul: Number(m[2]) });
      eat(m[0]);
    }
    // weight of a world event or a convergence point: `WR-24` น้ำหนัก +10 · cv.10 น้ำหนัก +5
    for (const m of [...seg.matchAll(/`?((?:[A-Z]{2,3}-\d{2})|cv\.\d+)`?\s*น้ำหนัก\s*([+\-−]\d+)/g)]) {
      out.effects.push({ k: 'stat', stat: `weight:${m[1]}`, delta: num(m[2]) });
      if (!m[1].startsWith('cv.') && !out.chain.includes(m[1])) out.chain.push(m[1]);
      eat(m[0]);
    }
    // weight written before the id: น้ำหนัก `WR-04` ของคู่ประเทศ +5
    for (const m of [...seg.matchAll(/น้ำหนัก\s*`?([A-Z]{2,3}-(?:\d{2}|\*))`?[^\d+\-−`]{0,24}([+\-−]\d+)/g)]) {
      out.effects.push({ k: 'stat', stat: `weight:${m[1]}`, delta: num(m[2]) });
      if (!out.chain.includes(m[1])) out.chain.push(m[1]);
      eat(m[0]);
    }
    // the trust line of a verdict: ตัดสินตามอำนาจ −1 (the sibling path names what it moves)
    for (const m of [...seg.matchAll(/ตัดสินตามอำนาจ\s*([+\-−]\d+)/g)]) {
      out.effects.push({ k: 'stat', stat: 'ไว้ใจของประเทศต่อสถาบันตัดสิน', delta: num(m[1]) });
      eat(m[0]);
    }
    for (const m of [...seg.matchAll(/`?((?:[A-Z]{2,3}-\d{2}))`?\s*(?:ช้าลง|เร็วขึ้น|เกิดเร็ว|เกิดช้า)[^ \n]*(?:\s*(?:หนึ่ง|สอง|สาม|ห้า|\d+)\s*(?:ทศวรรษ|ปี))?/g)]) {
      out.effects.push({ k: 'label', text: m[0].replace(/`/g, '') });
      eat(m[0]);
    }
    // gifts
    for (const m of [...seg.matchAll(/\b((?:nb|nc|ns|b|c|sp|cs|u|pa)_[a-z0-9_]+)\b/g)]) {
      out.effects.push({ k: 'grant', kind: ids.kind(m[1]), id: m[1] });
      eat(m[0]);
    }
    // a risk or a closeness is a word about the event, not an event that happens: `PL-03` เสี่ยง · เสี่ยง PL-03
    for (const m of [...seg.matchAll(new RegExp(`(?:(เสี่ยง|ใกล้)\\s*\`?(${EV})\`?|\`?(${EV})\`?\\s*(เสี่ยง|ใกล้))`, 'g'))]) {
      const id = m[2] ?? m[3];
      out.effects.push({ k: 'label', text: `${id} ${m[1] ?? m[4]}` });
      if (!out.chain.includes(id)) out.chain.push(id);
      eat(m[0]);
    }
    // remaining event ids are references
    for (const m of [...seg.matchAll(anyEventRe)]) {
      if (!out.chain.includes(m[0])) out.chain.push(m[0]);
      if (!out.effects.some((e) => e.k === 'event' && e.id === m[0])) out.effects.push({ k: 'event', id: m[0] });
      eat(m[0]);
    }
    // opens a convergence point: เปิด cv.12
    for (const m of [...seg.matchAll(/เปิด\s+(cv\.\d+)/g)]) {
      out.effects.push({ k: 'converge', to: m[1] });
      eat(m[0]);
    }
    // opens a story node or a story line: เปิด ex.a1 · เปิดโหนด xc
    for (const m of [...seg.matchAll(/เปิด(?:โหนด)?\s+([a-z]{2}(?:\.[a-z]\d+)?)(?![\w.])/g)]) {
      out.effects.push({ k: 'ref', nodes: [m[1]], rel: /โหนด/.test(m[0]) ? 'เปิดโหนด' : 'เปิด' });
      eat(m[0]);
    }
    // standing of a country toward a people: ท่าทีของ AL-02 ต่อแวมไพร์ −2 · ท่าทีของสภาต่อ AZ-01 −1
    for (const m of [...seg.matchAll(/ท่าที(?:ของ)?\s*(\S+)\s*ต่อ\s*(\S+)\s*([+\-−]\d+)/g)]) {
      out.effects.push({ k: 'stat', stat: `stance:${m[1]}>${m[2]}`, delta: num(m[3]) });
      eat(m[0]);
    }
    // trust / fame of a country: ไว้ใจ ... +1 · ชื่อเสียงประเทศ +1
    for (const m of [...seg.matchAll(/(ไว้ใจ[^\d+\-−]{0,30}|ชื่อเสียง[^\d+\-−]{0,10})([+\-−]\d+)/g)]) {
      out.effects.push({ k: 'stat', stat: m[1].trim(), delta: num(m[2]) });
      eat(m[0]);
    }
    truthLayers(seg, out, eat);
    const left = leftover(seg);
    if (/\d|%|×/.test(left)) out.unparsed.push(phraseOf(seg0, left));
  }
  return out;
}

/** Splits a result cell at each `ถ้า …` (a branch of the story) into [{when, text}]; the text before the first is common. */
export function splitPaths(cell: string): { common: string; paths: { when: string; text: string }[] } {
  const text = plain(cell);
  const parts = text.split(/(?:^|\s)(?=ถ้า)/);
  const common = parts[0].startsWith('ถ้า') ? '' : parts.shift()!.trim();
  const paths = parts.map((p) => {
    const body = p.trim().replace(/^ถ้า\s*/, '');
    // the doc puts a space after the condition clause: the first word is the condition, the whole sentence stays as text
    return { when: body.split(/\s+/)[0], text: body };
  });
  return { common, paths };
}
