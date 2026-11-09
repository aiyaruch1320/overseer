// The check of an answer (god/05-llm.md §7, llm/08-live-test.md §3): an answer that breaks a rule is not used, the game takes tier 0.
// Pure functions of the text and the list the game gave; none touches the state.
import { parseThaiNumber } from './thai-number';
import { THAI_SHARE } from './tuning';
import type { Checked } from './types';

const THAI = /[฀-๿]/g;
const LATIN = /[A-Za-z]/;
const DIGIT = /[0-9๐-๙]/g;

/**
 * Words the text may not hold (llm/08-live-test.md §3 "เสียงของพระเจ้า"): the god has no voice in the game, so `ข้า` (not `ข้าง` `ข้าม` `ข้าว` `ข้าศึก`
 * `ข้าทาส` `ข้าราชการ`) and `เรา` (not `หัวเราะ` `เราะ`) are out. Assumption: the live test banned these two; the lookaheads here are a guess at the common words.
 */
export const BANNED: { word: string; re: RegExp }[] = [
  { word: 'ข้า', re: /ข้า(?![งมวศทรบ])/ },
  { word: 'เรา', re: /(?<!หัว)เรา(?!ะ)/ },
];

export interface TextRules {
  min: number;
  max: number;
  /** Digits that may appear (the ones the facts of the game carry: an age, a year). */
  allowDigits?: string;
  /** Latin words that may appear (a name given in Latin letters by the game). */
  allowLatin?: string[];
  /** Paragraphs, at most. */
  paragraphs?: number;
  /** The words of the game the text may quote: a banned word inside a quote of them is the game's own (a question of life "ยังเป็นตัวเราอยู่ไหม"), not the voice of the text. */
  quotes?: readonly string[];
}

/** Letters on each side of a banned word that must match the game's own words for the word to count as quoted. */
const QUOTE_SIDE = 5;
const squash = (s: string) => s.replace(/\s+/g, '');

/** Is every place the banned word stands in the text inside a quote of the game's words? */
function quoted(text: string, re: RegExp, quotes: readonly string[]): boolean {
  if (!quotes.length) return false;
  const given = quotes.map(squash);
  const flat = squash(text);
  const all = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  let any = false;
  while ((m = all.exec(flat))) {
    any = true;
    const around = flat.slice(Math.max(0, m.index - QUOTE_SIDE), m.index + m[0].length + QUOTE_SIDE);
    if (!given.some((g) => g.includes(around))) return false;
    if (m[0].length === 0) all.lastIndex++;
  }
  return any;
}

/** Thai text for the player: Thai letters, no code or number the game did not give, no banned word, within the length. Returns the text trimmed (and cut at a paragraph when a little long). */
export function checkThai(raw: string, r: TextRules): Checked<string> {
  let text = raw.trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > r.max * 2) return { ok: false, reason: `too long (${text.length} > ${r.max * 2})` };
  if (text.length > r.max) {
    // cut at the last paragraph that fits; with no paragraph break there is no clean place to cut Thai text
    const paras = text.split(/\n\s*\n/);
    while (paras.length > 1 && paras.join('\n\n').length > r.max) paras.pop();
    text = paras.join('\n\n');
    if (text.length > r.max) return { ok: false, reason: `too long (${text.length} > ${r.max})` };
  }
  if (text.length < r.min) return { ok: false, reason: `too short (${text.length} < ${r.min})` };
  if (r.paragraphs && text.split(/\n\s*\n/).length > r.paragraphs) return { ok: false, reason: `more than ${r.paragraphs} paragraphs` };
  let latin = text;
  for (const w of r.allowLatin ?? []) latin = latin.split(w).join('');
  if (LATIN.test(latin)) return { ok: false, reason: 'latin letters' };
  const letters = text.replace(/[\s\d.,!?;:"'“”‘’()\-–—…ๆฯ]/g, '');
  const thai = (letters.match(THAI) ?? []).length;
  if (!letters.length || thai / letters.length < THAI_SHARE) return { ok: false, reason: 'not Thai' };
  const digits = text.match(DIGIT);
  if (digits && digits.some((d) => !(r.allowDigits ?? '').includes(d))) return { ok: false, reason: 'a number the game did not give' };
  for (const b of BANNED) if (b.re.test(text) && !quoted(text, b.re, r.quotes ?? [])) return { ok: false, reason: `banned word ${b.word}` };
  // a code of the game (`hu.a1` `b_nobleblood`) must not reach the player
  if (/\b[a-z]{1,3}_[a-z_]+\b/.test(text)) return { ok: false, reason: 'an id of the game' };
  return { ok: true, value: text };
}

/** Parses an answer that must be one JSON object (a model may wrap it in a code fence). */
export function parseObject(text: string): Checked<Record<string, unknown>> {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
  if (fence) t = fence[1];
  try {
    const v: unknown = JSON.parse(t);
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ok: true, value: v as Record<string, unknown> };
  } catch {
    // falls through
  }
  return { ok: false, reason: 'not a JSON object' };
}

// ---------- the facts of a retelling: numbers and names (review M4 G5) ----------

const THAI_DIGIT = '๐๑๒๓๔๕๖๗๘๙';
const NUMBER = /[0-9๐-๙][0-9๐-๙,]*(?:\.[0-9๐-๙]+)?/g;

/** A number as the game writes it: Thai digits to Arabic, no thousands comma (`10,450` and `10450` are one year). */
function plainNumber(raw: string): string {
  return raw
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGIT.indexOf(d)))
    .replace(/,/g, '')
    .replace(/\.$/, '');
}

/** Every number written with digits in the text, normalised. */
export function numbersIn(text: string): string[] {
  return (text.match(NUMBER) ?? []).map(plainNumber);
}

const NUMBER_WORDS = /(?:หนึ่ง|เอ็ด|สอง|ยี่|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน)+/g;
/** A digit word right before a place word (`สองพัน` `ห้าร้อย`): the run is a counted number, not a stray syllable (`สามี` `ห้าม` `พันธุ์` `ร้อยกรอง`). */
const COUNTED = /(?:หนึ่ง|สอง|ยี่|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า)(?:สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน)/;

/** The value of a number written in Thai words (`ยี่สิบห้า` 25, `สามสิบ` 30, `สิบเอ็ด` 11, `หนึ่งหมื่นหนึ่งพันห้าร้อยสี่สิบ` 11540); undefined when the words are not a number (thai-number.ts). */
export function wordValue(words: string): number | undefined {
  return parseThaiNumber(words);
}

/**
 * The numbers the text says in words that the facts must carry: where they count years of life (`อายุสามสิบ` `ห้าสิบปี`), after a year mark (`ศักราช` `พ.ศ.`), and any counted number
 * of a hundred or more (a year or a count: `สามพันสองร้อย`). Words that are not a number at all (`สองพันสิบเอ็ดพันห้าร้อยสี่สิบ`) give NaN, which no fact carries.
 */
export function wordNumbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(NUMBER_WORDS)) {
    const after = text.slice((m.index ?? 0) + m[0].length);
    const before = text.slice(0, m.index ?? 0);
    if (m[0].endsWith('พัน') && after.startsWith('ธุ์')) continue;
    const v = parseThaiNumber(m[0]);
    // only where the words count years of life: right after "อายุ", or right before "ปี" (not `หนึ่งในสี่` or `สองฝั่ง`); or a year after its mark; or a counted number of a hundred or more
    const context = /^\s*ปี/.test(after) || /(?:อายุ|ศักราช|พ\.ศ\.|ค\.ศ\.|ศ\.ม\.|ปีที่)\s*$/.test(before);
    const big = COUNTED.test(m[0]) && (v === undefined || v >= 100);
    if (!context && !big) continue;
    out.push(v ?? NaN);
  }
  return out;
}

export interface FactRules {
  /** Everything the game gave as text (the facts, the name, the ending, the vow ...): the numbers in it are the numbers the retelling may say. */
  given: string[];
  /** Numbers the game gave beside the text (the age at death). */
  numbers?: number[];
  /** Names the retelling may use. */
  names: string[];
  /** Names of other people of the world that it may not use. */
  others?: string[];
  /** The game gave a vow / a title or an ending: a retelling that speaks of one when the game gave none is wrong. */
  hasVow: boolean;
  hasTitle: boolean;
}

/** Longest names first, so a short name inside a long one does not cut it. */
const byLength = (list: string[]): string[] => [...new Set(list.filter(Boolean))].sort((a, b) => b.length - a.length);

const MARK = '\u0001';

/** The text with the allowed names hidden, to look for the names that are left. */
function maskNames(text: string, names: string[]): string {
  let t = text;
  for (const n of byLength(names)) t = t.split(n).join(MARK);
  return t;
}

/** Words that follow `ชื่อ` without being a name (`ชื่อเสียง` fame, `ชื่อนี้` this name ...). */
const NOT_A_NAME = /^(?:เสียง|นี้|นั้น|สกุล|เดิม|ตน|ของ|ตระกูล)/;

/**
 * The check of a retelling against the facts of the game: every number it says is a number the game gave (a year, an age, a count; in digits or in Thai words), and every name
 * is a name the game gave. Thai has no capital letters, so a name that the game did not give is found by what can be known: a name of another person of the world (`others`),
 * and the name after `ชื่อ` ("named"). A name invented with no such mark cannot be found by a rule and is the work of the prompt (llm/04-story.md §2); this check catches the
 * ones that can be found, and the text goes back to tier 0 when it does.
 */
export function checkFacts(text: string, r: FactRules): Checked<string> {
  const allowed = new Set<string>([...r.given.flatMap(numbersIn), ...r.given.flatMap(wordNumbersIn).filter(Number.isFinite).map(String), ...(r.numbers ?? []).map(String)]);
  for (const n of numbersIn(text)) if (!allowed.has(n)) return { ok: false, reason: `a number the facts do not carry (${n})` };
  for (const v of wordNumbersIn(text)) if (!allowed.has(String(v))) return { ok: false, reason: `a number the facts do not carry (${Number.isNaN(v) ? 'words that are no number' : v})` };
  const masked = maskNames(text, r.names);
  for (const o of byLength(r.others ?? [])) {
    if (o.length < 2 || r.names.some((n) => n.includes(o) || o.includes(n))) continue;
    if (masked.includes(o)) return { ok: false, reason: `a name that is not this life's (${o})` };
  }
  for (const m of masked.matchAll(/ชื่อ(?:ว่า)?\s*([฀-๿]+)/g)) {
    const after = m[1];
    if (after.startsWith(MARK) || NOT_A_NAME.test(after)) continue;
    return { ok: false, reason: `a name the game did not give (${after.slice(0, 12)})` };
  }
  if (!r.hasVow && /คำปฏิญาณ/.test(text)) return { ok: false, reason: 'a vow the game did not give' };
  if (!r.hasTitle && /ฉายา/.test(text)) return { ok: false, reason: 'a title the game did not give' };
  return { ok: true, value: text };
}
