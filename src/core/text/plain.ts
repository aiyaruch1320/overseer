// Plain Thai for the player (review M1 T1 T3): the documents write a choice as a table cell that carries the sentence of the way
// and then what it does (percentages, stat marks, ids, template codes, remarks). The player reads the sentence only, and never an id.
// Pure: the same text gives the same result, nothing is drawn from the seed streams.
import type { GameData } from '../game';
import { labels, type RiteLite } from './labels';

// ---------- what a player-facing line must never hold ----------

/** Forms of internal codes (docs/guide/id-glossary.md). The tests run them over every line a player can see. */
/** Latin words that are part of the game's own Thai (the player reads NPC as a word). */
const LATIN_OK = /\bNPC\b/g;

export const CODE_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'country', re: /\b[A-Z]{2}-\d{2}\b/ },
  { name: 'npc', re: /\b[A-Z]{2}\d{2}-\d\b/ },
  { name: 'event or template', re: /\b[A-Z]{2,4}-\d{1,3}\b/ },
  { name: 'npc clash', re: /\bNF-[A-Z]{2}\d{2}-\d\b/ },
  { name: 'node', re: /\b[a-z]{1,3}\.[a-z]?\d+\b/ },
  { name: 'convergence', re: /\bcv\.\d+/ },
  { name: 'snake id', re: /\b[a-z]+_[a-z0-9_]+\b/ },
  { name: 'mood marker', re: /\{[^{}]*@\d\}/ },
  { name: 'faith or flag', re: /\b(?:faith|sign|meet)\.[a-z0-9_]+/ },
  { name: 'tag', re: /#[a-z_]+/ },
  { name: 'latin word', re: /[A-Za-z]{2,}/ },
];

/** Leftovers of a table cell with its codes cut out: a sentence with these in it was cut badly. */
export const LEFTOVERS: { name: string; re: RegExp }[] = [
  { name: 'หรือ หรือ', re: /(?:หรือ|และ)\s+(?:หรือ|และ)(?=\s|$)/ },
  { name: 'empty brackets', re: /\(\s*\)|\[\s*\]|（\s*）/ },
  { name: 'empty middle dot', re: /·\s*·|·\s*$|^\s*·/ },
  { name: 'double space', re: /\S {2,}\S/ },
  { name: 'dangling arrow', re: /[→>]\s*$/ },
  { name: 'template slot', re: /\{[^{}]*\}/ },
  { name: 'markup', re: /\*\*|`|\[[^\]]*\]/ },
  { name: 'undefined', re: /undefined|\[object|NaN/ },
];

/** What is wrong with a player-facing line: the names of the patterns it matches, empty when it is clean. */
export function leaks(text: string): string[] {
  const t = text.replace(LATIN_OK, 'เอ็นพีซี');
  return [...CODE_PATTERNS, ...LEFTOVERS].filter((p) => p.re.test(t)).map((p) => p.name);
}

// ---------- cutting a cell down to words ----------

const ID_NODE = /\b(?:[a-z]{2}\.[btaelx]\d+|cv\.\d+)\b(?:\s*(?:จบ)?ทาง\s*[กขค](?:\s*(?:หรือ|และ|,)\s*[กขค])*)?/g;
const ID_NPC = /\b[A-Z]{2}\d{2}-\d\b/g;
const ID_CLASH = /\bNF-[A-Z]{2}\d{2}-\d\b/g;
const ID_CODE = /\b[A-Z]{2,4}-\d{1,3}\b/g;
const ID_WORD = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)*\b/g;
const ID_CONTINENT = /(?<![A-Za-z])[A-Z]{2}(?![A-Za-z\d-])/g;
const MOOD = /\{[^{}]*@\d\}/g;
const TEMPLATE_CODE = /^(?:PR|FT|KN)-/;

/** A fragment that says what the way does to numbers: `ทอง +300` `B −2` `×3` `30%` `ถึง +120`. */
const EFFECT_NUMBER = /(?:[+−±×]\s*\d[\d.,]*%?|\d[\d.,]*\s*%|\d+\s*ถึง\s*[+−]?\d+)/g;
const HAS_SIGNED = /[+−±×]\s*\d/;
const LATIN_TOKEN = /(?<![A-Za-z฀-๿])[A-Za-z]{1,2}(?![A-Za-z])/g;
const FUNCTION_WORDS = '(?:หรือ|และ|ถ้าเป็น|ถ้า|เมื่อ|ใน|ที่|ของ|กับ|แบบ|ตาม|ไป|ให้|เปิดเส้น|เปิด|ข้ามไป|ได้)';

/** Cleans what is left after ids and numbers were cut out. */
export function tidy(text: string, edges = true): string {
  let x = text;
  for (let i = 0; i < 4; i++) {
    const before = x;
    x = x
      .replace(/\(\s*(?:[·,\s]|หรือ|และ|ถ้าเป็น|ถ้า|ใน|ที่|ต้องมี|ระดับ)*\)/g, ' ')
      .replace(/（\s*）/g, ' ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .replace(/(\S)\s*\(\s*\1\s*\)/g, '$1') // `X (X)` after a name replaced an id
      .replace(/\s*([,，])\s*(?=[,，)]|$)/g, '')
      .replace(/(?:^|\s)(หรือ|และ)(?:\s+(?:หรือ|และ))+(?=\s|$|\))/g, ' $1')
      .replace(/(\s)((?:ถ้าเป็น|ถ้า|เมื่อ))(?=\s+(?:หรือ|และ)|\s*$|\s*\))/g, ' ')
      .replace(edges ? new RegExp(`^\\s*(?:หรือ|และ|${FUNCTION_WORDS})\\s+(?=\\S)`) : /^$/, '')
      .replace(edges ? new RegExp(`\\s+(?:หรือ|และ|ถ้าเป็น|ถ้า|เมื่อ|เปิดเส้น|ข้ามไป|แบบ|ตาม|ใน|แต่|ทางสู่)\\s*$`) : /^$/, '')
      .replace(/\s*[→>]+\s*$/g, '')
      .replace(/\s*·\s*(?:·\s*)+/g, ' · ')
      .replace(/^\s*·\s*|\s*·\s*$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (x === before) break;
  }
  return x;
}

const COND_WORDS = '(?:ถ้า|เมื่อ|ต้อง|หลัง|ก่อน|ตาม|ผ่าน|มิฉะนั้น)';
/** A bracket that states a condition or a link by id (`(ถ้าผ่าน hu.t1 บรรลุ แล้ว)` `(คืนบุญใน ha.a1)`): for the writer. */
const COND_PAREN = new RegExp(`\\(\\s*${COND_WORDS}?[^()]*?(?:\\b[a-z]{2}\\.[btaelx]\\d+\\b|\\bcv\\.\\d+\\b|\\b[a-z]+_[a-z0-9_]+\\b)[^()]*\\)`, 'g');
/** A bracket that holds a number of an effect (`(ทอง 300)` `( ×3)` `(20%)`). */
const EFFECT_PAREN = /\([^()]*(?:[+−±×]\s*\d|\d[\d.,]*\s*%)[^()]*\)/g;

/** The Thai runs of a name that are long enough to tell that a bracket only says again what was said just before it. */
function repeats(before: string, name: string): boolean {
  const tail = before.slice(-40);
  return (name.match(/[฀-๿]{4,}/g) ?? []).some((w) => tail.includes(w));
}

/** Drops the `)` or `(` that has no partner (a label cut short leaves a `(` open). */
function balance(x: string): string {
  let depth = 0;
  let out = '';
  for (const ch of x) {
    if (ch === '(') depth++;
    else if (ch === ')') {
      if (depth === 0) continue;
      depth--;
    }
    out += ch;
  }
  // an unclosed `(` and what it holds: the label was cut there
  if (depth > 0) out = out.slice(0, out.lastIndexOf('('));
  return out;
}

export interface ScrubOpts {
  /** Keep the numbers of a sentence (`×0.2 ถึง ×0.9`, `ต้อง 20 มี 11`): a rule or a reason the player needs to read, not a cell of a table. */
  keepNumbers?: boolean;
  /** Keep an id the data does not know instead of cutting it (what the player typed, told back to him). */
  keepUnknown?: boolean;
}

/**
 * Words only: ids become names (or vanish when the data does not know them), template codes, numbers of effects, mood markers
 * and stray latin letters are cut, and the sentence is tidied. Never returns a code.
 */
export function scrub(data: GameData, text: string, opts: ScrubOpts = {}): string {
  const L = labels(data);
  let x = text.replace(/\*\*|`/g, '').replace(MOOD, ' ');
  x = x.replace(/\[(?:ช่วย|ร่วม|ขัดขวาง|ปล่อย)\]/g, ' ');
  // a pointer to a section of a document (`( หัวข้อ 6)`) is for the writer, not the player
  x = x.replace(/\(\s*[^()]*หัวข้อ\s*[\d.]+[^()]*\)/g, ' ').replace(/หัวข้อ\s*[\d.]+/g, ' ');
  x = x.replace(COND_PAREN, ' ');
  if (!opts.keepNumbers) x = x.replace(EFFECT_PAREN, ' ');
  x = x.replace(ID_CLASH, ' ');
  // a bracket that holds only an id: the name, unless the words before it already say it
  x = x.replace(/\(\s*([A-Z]{2}\d{2}-\d|[A-Z]{2,4}-\d{1,3})\s*\)/g, (m, id: string, off: number, whole: string) => {
    const nm = L.npc.get(id) ?? (TEMPLATE_CODE.test(id) ? undefined : L.name.get(id));
    return !nm || repeats(whole.slice(0, off), nm) ? ' ' : `(${nm})`;
  });
  // an NPC id usually sits in front of the name the document writes after it: keep the name once
  x = x.replace(ID_NPC, (m, off: number, whole: string) => {
    const nm = L.npc.get(m);
    if (!nm) return ' ';
    const after = whole.slice(off + m.length).replace(/^\s/, '');
    if (after.startsWith(nm)) return '';
    const parts = nm.split(' ');
    for (let k = parts.length - 1; k >= 1; k--) if (after.startsWith(parts.slice(k).join(' '))) return `${parts.slice(0, k).join(' ')} `;
    return nm;
  });
  x = x.replace(ID_NODE, ' ');
  x = x.replace(ID_CODE, (m) => (TEMPLATE_CODE.test(m) ? ' ' : (L.name.get(m) ?? (opts.keepUnknown ? m : ' '))));
  x = x.replace(ID_WORD, (m) => L.name.get(m) ?? ' ');
  x = x.replace(ID_CONTINENT, (m) => L.name.get(m) ?? m);
  if (!opts.keepNumbers) x = x.replace(EFFECT_NUMBER, ' ');
  // a bracket with a stray latin mark inside (`(พิธี t1 ของเผ่าหลัก)`) is a remark for the writer
  x = x.replace(/\([^()]*(?<![A-Za-z฀-๿])[A-Za-z]{1,2}(?![A-Za-z])[^()]*\)/g, ' ');
  x = x.replace(LATIN_TOKEN, ' ');
  return tidy(balance(x));
}

/** A number written against the Thai word after it (`กอร์ทาที่ 44หายใจแผ่วลง` `ถึงยุคที่ 4โดยไม่ลังเล`) gets its space (review M2 round 1). */
export function spaceDigits(text: string): string {
  return text.replace(/(\d)(?=[ก-ฮเ-ไ])/g, '$1 ');
}

/**
 * A reason the game gives for a refusal, in words (review M2 L3): ids become names and the codes of parameters are cut, but the numbers stay
 * (`ชะลอได้ ×0.2 ถึง ×0.9`) and so does what the player typed in quotes (`ไม่มีคำใบ้ "foo"`).
 */
export function reasonText(data: GameData, text: string): string {
  const parts = text.split(/("[^"]*"|“[^”]*”)/);
  const out: string[] = [];
  parts.forEach((p, i) => {
    if (i % 2) out.push(p.length > 42 ? `${p.slice(0, 40)}…${p[0] === '"' ? '"' : '”'}` : p);
    else {
      const t = scrub(data, p, { keepNumbers: true, keepUnknown: true });
      if (t) out.push(t);
    }
  });
  return out.join(' ').replace(/\s+([,.])/g, '$1');
}

const names = new WeakMap<GameData, Map<string, string>>();

/** The name of an id as the player reads it: the name the data gives, scrubbed (titles carry codes of countries and events). */
export function plainName(data: GameData, id: unknown): string {
  if (typeof id !== 'string') return '';
  let m = names.get(data);
  if (!m) names.set(data, (m = new Map()));
  const hit = m.get(id);
  if (hit !== undefined) return hit;
  const raw = labels(data).name.get(id);
  // a name the document glosses in Latin (`ราชันย์ (Ruler)`) is read without the gloss
  const out = raw === undefined ? '' : scrub(data, raw.replace(/\s*\([A-Za-z][A-Za-z\s'-]*\)/g, '')) || raw.replace(/[A-Za-z\d.\-_]+/g, '').trim();
  m.set(id, out);
  return out;
}

/** The first part of a cell (before the middle dots that start the notes) that holds words once it is scrubbed. */
export function sentence(data: GameData, cell: string | undefined): string {
  if (!cell) return '';
  for (const seg of cell.split(/\s+·\s+/)) {
    // `A → cv.16`: the way, then where it leads
    const s = scrub(data, seg.split(/\s*→\s*/)[0]).replace(/^ยุค\s*(\d+)$/, 'ถึงยุคที่ $1');
    if (/[฀-๿]{2}/.test(s)) return s;
  }
  return '';
}

/** A remark of a rite cell (what happens on a pass or a fail): the first part that is words, and nothing when it is only an effect. */
export function remark(data: GameData, text: string | undefined): string {
  if (!text) return '';
  for (const seg of text.split(/\s+·\s+/)) {
    if (HAS_SIGNED.test(seg)) continue;
    // an id with a chance (`ns_pack_lead 15%`) is a gift, not a remark; a remark in brackets beside it stays
    const kept = seg.replace(/\b[a-z]+(?:_[a-z0-9]+)+\b\s*\d*\s*%?/g, ' ').replace(/\b[a-z]+\b/g, ' ');
    const s = scrub(data, kept).replace(/^\((.*)\)$/, '$1').trim();
    if (/[฀-๿]{3}/.test(s) && !/^(?:แต่|ทางสู่|ทาง)$/.test(s)) return s;
  }
  return '';
}

// ---------- the way a rite took ----------

/**
 * The sentence for the way taken at a rite node. The log holds the key (`a` pass · `b` fail for a rite with sub-lines; the outcome
 * in the order of the weighted outcomes for the other form) and the label the story wrote.
 */
export function riteSentence(data: GameData, rite: RiteLite, key: string, logLabel: string | undefined): string {
  if (rite.form === 'variants') {
    const sub = logLabel?.split(':')[0]?.trim();
    const o = rite.outcomes.find((x) => x.label === sub) ?? undefined;
    if (!o) return sentence(data, logLabel);
    const pass = key === 'a';
    const doing = o ? scrub(data, o.text) : '';
    const result = o ? remark(data, pass ? o.pass?.text : o.fail?.text) : '';
    const verdict = pass ? 'ผ่าน' : key === 'b' ? 'ไม่ผ่าน' : '';
    const head = [o ? scrub(data, o.label) : '', doing].filter(Boolean);
    const first = head.length === 2 ? `${head[0]}: ${head[1]}` : head[0] ?? '';
    return [first, verdict, result].filter(Boolean).join(' · ');
  }
  // outcomes form: the label of the outcome and what the document says happened
  const ix = (logLabel ? rite.outcomes.findIndex((x) => x.label === logLabel) : -1);
  const o = ix >= 0 ? rite.outcomes[ix] : undefined;
  if (!o) return logLabel ? sentence(data, logLabel) : '';
  const label = scrub(data, o.label);
  const said = o.text
    .split(/\s+·\s+/)
    .map((p) => remark(data, p.replace(/\([^)]*(?:ข้ามไป|[a-z]{2}\.[btaelx]\d)[^)]*\)/g, '')))
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ');
  return said ? `${label} — ${said}` : label;
}
