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
const VAR_RE = new RegExp(
  `(${VAR_NAMES.map(([n]) => n)
    .sort((a, b) => b.length - a.length)
    .join('|')})(?:[^\\d+\\-−;·()]{0,24}?)\\s*([+\\-−]\\d+(?:\\.\\d+)?)(%)?`,
  'g',
);
const VAR_CODE = new Map(VAR_NAMES);
/** Words after a consumed number that only say how long or how often it lasts. */
const DURATION = /^\s*(?:\(ครั้งเดียว\)|ครั้งเดียว|ถาวร|(?:\d+|หนึ่ง|สอง|สาม|ห้า|สิบ)\s*(?:ปี|ทศวรรษ)|ต่อทศวรรษ|ทุกตัว|ทั่วโลก)/;
const OPEN_VERBS = /(?:เรียก|บังคับ|เปิด|ลูกโซ่|→|ตามมา)\s*$/;


/** Ids of countries, NPCs, nodes and events carry digits that are not numbers of an effect. */
const NOISE = /\b[A-Z]{2}\d{2}-\d\b|\b(?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}\b|\bcv\.\d+\b|\b[a-z]{2}\.[a-z]\d+\b|\b(?:LC|LE|LT)-\d+\b|\b(?:[A-Z]{2,3})-\d{2}\b|`\s*`/g;

/** What is left of a segment once the known patterns are out: true when it still holds a number, a percent or a multiplier. */
export function leftover(seg: string): string {
  return seg.replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
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

/** Effects of one effect cell (segments separated by `;` or ` · `), for a world, branch or last-era event. */
export function parseWorldEffect(cell: string, self: string, ids: IdIndex): Parsed {
  const out: Parsed = { effects: [], chain: [], unparsed: [] };
  const text = plain(cell);
  for (const seg0 of text.split(/\s*;\s*|\s+·\s+/)) {
    let seg = seg0;
    if (!seg) continue;
    const eat = (s: string) => {
      seg = seg.replace(s, ' ');
    };
    // the mourning wave is described in rules.mourn
    const wave = seg.match(/อารมณ์มังกรที่เหลือ[^()]*\(ตัวที่สนิทสุด[^)]*\)/);
    if (wave) {
      out.effects.push({ k: 'label', text: 'คลื่นไว้อาลัย: ดู rules.mourn' });
      eat(wave[0]);
    }
    for (const m of [...seg.matchAll(/DFC\s*([+\-−]\d+)/g)]) {
      out.effects.push({ k: 'stat', stat: 'DFC', delta: num(m[1]) });
      eat(m[0]);
    }
    for (const m of [...seg.matchAll(VAR_RE)]) {
      const code = VAR_CODE.get(m[1]);
      if (!code) continue;
      if (m[3] && code !== 'population') continue;
      out.effects.push({ k: 'stat', stat: m[3] ? code + '.pct' : code, delta: num(m[2]) });
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
      out.effects.push(rift[1] === 'เปิด' ? { k: 'grant', kind: 'flag', id: 'rift_open' } : { k: 'remove', kind: 'flag', id: 'rift_open' });
      eat(rift[0]);
    }
    // event ids, with the verb in front telling whether the row opens it
    for (const m of [...seg.matchAll(anyEventRe)]) {
      const id = m[0];
      if (id === self) {
        eat(id);
        continue;
      }
      const before = seg.slice(0, m.index);
      const open = OPEN_VERBS.test(before);
      if (!out.chain.includes(id)) out.chain.push(id);
      if (!out.effects.some((e) => e.k === 'event' && e.id === id)) out.effects.push(open ? { k: 'event', id, open: true } : { k: 'event', id });
      eat(id);
    }
    // ids of gifts: c_wanted b_nobleblood
    for (const m of [...seg.matchAll(/\b((?:nb|nc|ns|b|c|sp|cs|u|pa)_[a-z0-9_]+)\b/g)]) {
      out.effects.push({ k: 'grant', kind: ids.kind(m[1]), id: m[1] });
      eat(m[0]);
    }
    truthLayers(seg, out, eat);
    const left = leftover(seg);
    if (/\d|%|×/.test(left)) out.unparsed.push(phraseOf(seg0, left));
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
  const text = plain(cell);
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
    for (const m of [...seg.matchAll(/น้ำหนัก\s*`?([A-Z]{2,3}-\d{2})`?[^\d+\-−`]{0,24}([+\-−]\d+)/g)]) {
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
