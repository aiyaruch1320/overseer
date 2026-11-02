// The check of an answer (god/05-llm.md §7, llm/08-live-test.md §3): an answer that breaks a rule is not used, the game takes tier 0.
// Pure functions of the text and the list the game gave; none touches the state.
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
  for (const b of BANNED) if (b.re.test(text)) return { ok: false, reason: `banned word ${b.word}` };
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
