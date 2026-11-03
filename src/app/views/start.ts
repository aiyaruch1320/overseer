// The view models of the start screen (docs/systems/character/19-wish.md, 20-wish-synonyms.md, docs/systems/experience/04-start-modes.md,
// docs/appearance/20-god-ui.md §10 §11, docs/systems/god/08-goals.md §2 §5). Pure: (data, draft) -> what the screen draws.
//
// The core has no parser of the wish yet, so the synonym parser lives here, over data/gen/synonyms.json and data/gen/wish.json. It follows the steps of
// 20-wish-synonyms.md: one form of the text, the longest word first, a negation binds to the next value, a level word to the value beside it, the limits
// and the 10 points of fate, and a verdict on how much was understood (full · mostly · part · none: the last two open the page of choosing by hand).
//
// What the core can do with a request is what `BirthOpts` of src/core/character takes: race, second race, country, gender, sign, time, special birth.
// The other fields of the sheet (class, family, religion, traits, aptitudes, jobs, companion, blessing, curse, story, era) are read, shown and priced,
// but the core does not apply them yet: they carry `pending: true` and the screen says so (needs in the report of the lead).
import { birth as characterBirth } from '../../core/character';
import type { SynField, SynonymsFile, SynValue, WishFile } from '../../core/data/types-character';
import { rhythms } from '../../core/god/goals';
import { peekLife } from '../../core/god/goals/state';
import { modeOf, MODES, collectionView } from '../../core/ending';
import { versions, type GameData } from '../../core/game';
import { newGame } from '../../core/state';
import { command } from '../../core/command';
import { lines } from '../../core/text';
import { labels } from '../../core/text/labels';
import { placeName, raceName } from '../../core/text/pick';
import type { Command, GameState, LifeState } from '../../core/types';
import { createSession, startLife, type Session, type SessionOpts } from '../../../scripts/tools/session';
import type { GameStore } from '../store';

// ---------- the words of the screen (the sheet and the buttons the documents name) ----------

/** Chrome of the start screen, each from the document named. The sheet's parts come from wish.json `sheet` (see `sheetParts`). */
export const START_LABELS = {
  prompt: 'อยากให้ชีวิตนี้เป็นอย่างไร', // 20-god-ui.md §11 "ช่องคำขอ"
  placeholder: 'เช่น อยากเป็นเด็กกำพร้าเผ่าสัตว์ที่โตมาในเมืองมนุษย์ แล้วอยากให้ชีวิตได้เดินทางไกล', // 19-wish.md opening
  modes: 'แบบเริ่มต้น', // 04-start-modes.md
  random: 'สุ่มทั้งหมด', // 20-god-ui.md §11 "ปุ่มสุ่มทั้งหมด"
  start: 'เริ่มชีวิต', // 20-god-ui.md §11 "ปุ่ม"
  edit: 'แก้ใบคำขอ',
  reroll: 'สุ่มส่วนที่ยังสุ่มใหม่',
  sheet: 'ใบเกิด', // 20-god-ui.md §11 "ใบเกิด"
  fate: 'แต้มชะตา', // 19-wish.md §4
  rhythm: 'จังหวะชะตา', // 08-goals.md §5
  vow: 'คำปฏิญาณ', // 08-goals.md §2
  noVow: 'ไม่ปฏิญาณ', // 20-god-ui.md §10 "แผ่นที่สี่"
  pickByHand: 'เลือกเอง', // 19-wish.md §3 "หน้าเลือกเอง"
  locked: 'ยังไม่เปิด', // 04-start-modes.md "กติกา"
  pending: 'ยังไม่ผูกกับแกน', // the core does not apply this field yet
  chosen: 'เลือกแล้ว',
  maxLen: 'ไม่เกิน',
} as const;

/** The six tags of the box of the wish (20-god-ui.md §11): the name on the tag and the field of the synonym table it fills from. */
export const WISH_CHIPS: { label: string; field: string }[] = [
  { label: 'เผ่า', field: 'race' },
  { label: 'ถิ่น', field: 'continent' },
  { label: 'ฐานะ', field: 'class' },
  { label: 'นิสัย', field: 'trait' },
  { label: 'อาชีพ', field: 'job' },
  { label: 'โทนชีวิต', field: 'story' },
];

// ---------- the draft ----------

export interface StartDraft {
  /** The wish as typed. */
  text: string;
  /** The start mode chosen (an id of `MODES`) or null. */
  mode: string | null;
  /** The seed of the world; "reroll" draws a new one. */
  seed: number;
  /** The rhythm of fate (`natural` `gentle` `sorrow` `irony`). */
  rhythm: string;
  /** The vow taken: 1..N of the table, N + 1 for none, null while undecided. */
  vow: number | null;
  /** Choices made by hand on the page of choosing: field key → code ('' = random). They stand over what was understood. */
  picks: Record<string, string>;
}

export const emptyDraft = (seed = 1): StartDraft => ({ text: '', mode: null, seed, rhythm: 'natural', vow: null, picks: {} });

// ---------- the start modes ----------

export interface ModeView {
  id: string;
  name: string;
  open: boolean;
  chosen: boolean;
}

/** The modes of 04-start-modes.md with the rule of the collection: `state` is the save whose collection is read (null: a world not yet begun, so only the modes that open from the start). */
export function startModes(data: GameData, state: GameState | null, chosen: string | null): ModeView[] {
  const s = state ?? newGame(1, versions(data));
  const view = collectionView(s, data);
  return view.modes.map((m) => ({ id: m.id, name: m.name, open: m.open && !(m.id === 'heir' && !state), chosen: m.id === chosen }));
}

/** What a mode asks of the birth (a mode is a wish already written: 04-start-modes.md). */
interface Ask {
  race?: string;
  second?: string | null;
  country?: string;
  special?: boolean;
}

const MODE_ASK: Record<string, Ask> = {
  summoned: { race: 'human', country: 'AL-02', special: true },
  reincarnated: { race: 'human', country: 'MH-07', special: true },
  slime: { race: 'slime' },
  soulmachine: { race: 'soulmachine' },
  demonkin: { race: 'demonkin' },
  ghoul: { race: 'ghoul' },
  elf: { race: 'elf' },
  orc: { race: 'orc' },
  dragonkin: { race: 'dragonkin' },
  halfblood: { race: 'human' },
  plain: {},
  heir: {},
};

// ---------- the synonym parser ----------

export type WishKind = 'value' | 'neg' | 'level' | 'random' | 'filler' | 'fname' | 'off' | 'imp' | 'unknown';

/** A stretch of the typed text with what the parser took it for: the box colours the stretches while the player types. */
export interface Segment {
  text: string;
  kind: WishKind;
  /** For a value: the part of the sheet it goes to. */
  part?: 'fixed' | 'tendency' | 'story';
  /** A value that was cut (limit, conflict, budget) or negated. */
  cut?: boolean;
  negated?: boolean;
}

export type Row = 'sure' | 'lean' | 'cannot' | 'random';

/** One line of the sheet. */
export interface SheetItem {
  row: Row;
  /** The field (`เผ่า`). */
  field: string;
  key: string;
  /** The value as the player reads it (`คนแคระ`); empty for a random field. */
  value: string;
  code: string;
  /** For `cannot`: why, and what stands in; from the tables of the documents. */
  note: string;
  points: number;
  /** Read and priced, but the core does not apply it yet. */
  pending: boolean;
  negated?: boolean;
  /** The level the player gave ("มาก", "นิดหน่อย"). */
  level?: 'strong' | 'weak';
  /** Where in the typed text it came from. */
  at: number;
}

export type Understood = 'empty' | 'full' | 'mostly' | 'part' | 'none';

export interface FatePoints {
  total: number;
  used: number;
  left: number;
  /** Points given back by a harder life (orphan, class 1, a curse asked), counted inside `used` as negative. */
  refunded: number;
  /** The beads of the ring: gold for spent, ash for refunded, empty for left. */
  beads: ('spent' | 'refund' | 'free')[];
}

export interface WishRead {
  text: string;
  segments: Segment[];
  items: SheetItem[];
  points: FatePoints;
  understood: Understood;
  /** The share of characters the parser knew (0..1). */
  coverage: number;
  /** The mode named in the text, if any. */
  mode: string | null;
  /** What the core is asked to bear. */
  ask: Ask & { gender?: 'm' | 'f'; sign?: string; time?: string };
  /** The synonym parser fully understood nothing: the sheet opens as the page of choosing by hand (20-god-ui.md §11 "ไม่มี LLM"). */
  byHand: boolean;
}

interface Entry {
  t: WishKind;
  field?: SynField;
  value?: SynValue;
  /** neg: 'neg' or 'except'; level: 'strong' | 'weak'; random: 'all' | 'field'; off: topic; imp: ask. */
  tag?: string;
  note?: string;
}

interface Lexicon {
  map: Map<string, Entry[]>;
  maxLen: number;
  syn: SynonymsFile;
  wish: WishFile;
  countries: { id: string; continent: string; name: string }[];
  trait: Map<string, string>;
}

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

/** One form of the text (step 1): lower case, no spaces or marks, Thai digits as Arabic; the marks of Thai letters and ๆ stay. Returns the form and where each character was. */
export function normalize(text: string): { norm: string; pos: number[] } {
  let norm = '';
  const pos: number[] = [];
  let i = 0;
  for (const ch of text) {
    const d = THAI_DIGITS.indexOf(ch);
    const c = d >= 0 ? String(d) : ch.toLowerCase();
    if (/[\p{L}\p{N}\p{M}ๆ]/u.test(c)) {
      for (const u of c) {
        norm += u;
        pos.push(i);
      }
    }
    i += ch.length;
  }
  return { norm, pos };
}

/** The name of a field as the sheet prints it (the table's heading carries a note in brackets: `ดวงวันเกิด (ดวง)`). */
export const fieldLabel = (f: string): string => f.replace(/ \(.*\)$/, '');

const cache = new WeakMap<GameData, Lexicon>();

function lexicon(data: GameData): Lexicon {
  const hit = cache.get(data);
  if (hit) return hit;
  const syn = data.synonyms?.items as SynonymsFile | undefined;
  const wish = data.wish?.items as WishFile | undefined;
  if (!syn || !wish) throw new Error('start: data/gen/synonyms.json and wish.json are not loaded');
  const map = new Map<string, Entry[]>();
  let maxLen = 0;
  const put = (word: string, e: Entry, min = 2) => {
    const n = normalize(word).norm;
    if (n.length < min) return;
    maxLen = Math.max(maxLen, n.length);
    const list = map.get(n) ?? [];
    if (!list.some((x) => x.t === e.t && x.field === e.field && x.value === e.value && x.tag === e.tag)) list.push(e);
    map.set(n, list);
  };
  const countries = ((data.countries?.items ?? []) as { id: string; continent: string; name: string }[]).map((c) => ({ id: c.id, continent: c.continent, name: c.name }));
  for (const f of syn.fields) {
    for (const v of f.values) {
      put(v.name, { t: 'value', field: f, value: v });
      for (const w of v.syn) put(w, { t: 'value', field: f, value: v }, syn.minSynonymLength);
    }
  }
  // 143 countries are not written in the table: the index of countries is the table (19-wish.md rule 6)
  const countryField: SynField = { key: 'country', heading: 'ประเทศ', field: 'ถิ่นเกิด (ประเทศ)', part: 'fixed', values: [] };
  for (const c of countries) {
    const v: SynValue = { code: c.id, name: c.name, syn: [] };
    countryField.values.push(v);
    put(c.name, { t: 'value', field: countryField, value: v }, 3);
  }
  for (const n of syn.negation) for (const w of n.words) put(w, { t: 'neg', tag: n.kind === 'ยกเว้น' ? 'except' : 'neg' });
  for (const l of syn.levelWords) for (const w of l.words) put(w, { t: 'level', tag: l.kind === 'แรง' ? 'strong' : 'weak' });
  for (const r of syn.randomWords) for (const w of r.words) put(w, { t: 'random', tag: r.scope === 'ทั้งใบ' ? 'all' : 'field' });
  for (const f of syn.fillerWords) for (const w of f.words) put(w, { t: 'filler' }, 1);
  for (const f of syn.fieldNames) put(f.name, { t: 'fname', value: f }), f.syn.forEach((w) => put(w, { t: 'fname', value: f }));
  for (const o of syn.offForm) for (const w of o.words) put(w, { t: 'off', tag: o.topic, note: o.reason });
  for (const o of syn.impossible) for (const w of o.words) put(w, { t: 'imp', tag: o.ask, note: o.nearest });
  const out: Lexicon = { map, maxLen, syn, wish, countries, trait: labels(data).kind.trait };
  cache.set(data, out);
  return out;
}

interface Match {
  s: number;
  e: number;
  entries: Entry[];
}

/** Step 2: the longest words first, no overlap, the way that covers the most characters (a longer word beats a shorter inside it). */
function scan(lex: Lexicon, norm: string): Match[] {
  const n = norm.length;
  const best: number[] = new Array(n + 1).fill(0);
  const from: (Match | null)[] = new Array(n + 1).fill(null);
  for (let i = 1; i <= n; i++) {
    best[i] = best[i - 1];
    for (let len = Math.min(lex.maxLen, i); len >= 1; len--) {
      const entries = lex.map.get(norm.slice(i - len, i));
      if (!entries) continue;
      // a word of fillers only counts a little: the values must win a tie
      const gain = entries.every((e) => e.t === 'filler') ? len * 0.99 : len;
      if (best[i - len] + gain > best[i] + 1e-9) {
        best[i] = best[i - len] + gain;
        from[i] = { s: i - len, e: i, entries };
      }
    }
  }
  const out: Match[] = [];
  for (let i = n; i > 0; ) {
    const m = from[i];
    if (m && Math.abs(best[i] - best[i - 1]) > 1e-9) {
      out.push(m);
      i = m.s;
    } else i--;
  }
  return out.reverse();
}

const COMMON = new Set(['human', 'orc', 'halfling', 'beast', 'dwarf', 'elf']);
const RARE = new Set(['dragonkin', 'vampire', 'soulmachine', 'mummy']);
/** The fields the core applies (see the head of this file). */
const APPLIED = new Set(['race', 'specialBirth', 'half', 'gender', 'continent', 'country', 'birthTime', 'birthSign']);
const SINGLE = new Set(['race', 'specialBirth', 'gender', 'continent', 'country', 'placeKind', 'class', 'family', 'birthTime', 'birthSign', 'religion', 'era']);
const LIMITS: Record<string, keyof WishFile['limits']> = { trait: 'traits', aptitude: 'aptitudes', blessing: 'blessings' };

const GENDER: Record<string, 'm' | 'f'> = { ชาย: 'm', หญิง: 'f' };
const SIGN: Record<string, string> = { ดาวหาง: 'comet', สุริยคราส: 'eclipse', จันทร์เต็มดวง: 'fullmoon', พายุ: 'storm' };
const TIME: Record<string, string> = { รุ่งอรุณ: 'dawn', กลางวัน: 'day', สนธยา: 'dusk', กลางคืน: 'night' };

/** The price of a value in fate points (19-wish.md §4). */
function priceOf(data: GameData, key: string, v: SynValue, level: 'strong' | 'weak' | undefined, order: number): number {
  switch (key) {
    case 'race':
      return COMMON.has(v.code) ? 0 : RARE.has(v.code) ? 2 : 1;
    case 'specialBirth':
      return 3;
    case 'half':
      return 1;
    case 'country':
      return 1;
    case 'class': {
      const n = Number(/\d/.exec(v.code)?.[0]);
      return n === 4 ? 2 : n === 5 ? 4 : n === 1 ? -2 : 0;
    }
    case 'family':
      return v.code === 'กำพร้า' ? -2 : 0;
    case 'birthSign':
      return v.code === 'ดาวหาง' || v.code === 'สุริยคราส' ? 2 : 0;
    case 'aptitude':
      return order === 0 ? 1 : 0;
    case 'blessing': {
      const list = (data.blessings?.items ?? []) as { id: string; tier: string }[];
      const tier = list.find((b) => b.id === v.code)?.tier;
      return level === 'strong' || tier === 'U' ? 4 : 2;
    }
    case 'curse':
      return -2;
    default:
      return 0;
  }
}

interface Hit {
  m: Match;
  field: SynField;
  value: SynValue;
  negated: boolean;
  level?: 'strong' | 'weak';
  order: number;
}

const ALL_FIELDS_CHECK = ['race', 'continent', 'class', 'family', 'birthSign', 'religion', 'trait', 'aptitude', 'blessing'];

/** Reads the wish (steps 1 to 6 of 20-wish-synonyms.md §10). */
export function readWish(data: GameData, draft: Pick<StartDraft, 'text' | 'mode' | 'picks'>): WishRead {
  const lex = lexicon(data);
  const { norm, pos } = normalize(draft.text);
  const matches = norm ? scan(lex, norm) : [];

  // bind the negations, the levels and the random words to the values beside them (step 3)
  const hits: Hit[] = [];
  const segs: { m: Match; kind: WishKind; part?: Segment['part']; hit?: Hit }[] = [];
  const valueIdx = matches.map((m, i) => (m.entries.some((e) => e.t === 'value') ? i : -1));
  let randomAll = false;
  const randomFields = new Set<string>();
  const offs: { topic: string; note: string; at: number }[] = [];
  const imps: { ask: string; note: string; at: number }[] = [];
  const nameKey = (code: string): string | undefined => lex.syn.fields.find((f) => f.field === code || f.field.startsWith(`${code} `))?.key;
  matches.forEach((m, i) => {
    const e0 = m.entries.find((e) => e.t !== 'filler') ?? m.entries[0];
    const val = m.entries.filter((e) => e.t === 'value');
    if (val.length) {
      let negated = false;
      for (let j = i - 1; j >= 0 && i - j <= 2; j--) {
        const e = matches[j].entries;
        if (e.some((x) => x.t === 'neg')) negated = true;
        if (e.some((x) => x.t === 'value')) break;
      }
      let level: 'strong' | 'weak' | undefined;
      const prev = matches[i - 1];
      const next = matches[i + 1];
      const lv = (x?: Match) => x?.entries.find((e) => e.t === 'level')?.tag as 'strong' | 'weak' | undefined;
      level = lv(next) ?? lv(prev);
      for (const e of val) {
        const hit: Hit = { m, field: e.field!, value: e.value!, negated, level, order: hits.length };
        hits.push(hit);
      }
      segs.push({ m, kind: 'value', part: val[0].field!.part || 'fixed', hit: hits[hits.length - 1] });
    } else if (e0.t === 'random') {
      if (e0.tag === 'all') randomAll = true;
      else {
        // "ไหนก็ได้" binds to the field name beside it
        for (const x of [matches[i - 1], matches[i + 1]]) for (const e of x?.entries ?? []) if (e.t === 'fname') for (const k of [nameKey(e.value!.code)]) if (k) randomFields.add(k);
      }
      segs.push({ m, kind: 'random' });
    } else if (e0.t === 'off') {
      offs.push({ topic: e0.tag!, note: e0.note ?? '', at: pos[m.s] });
      segs.push({ m, kind: 'off' });
    } else if (e0.t === 'imp') {
      imps.push({ ask: e0.tag!, note: e0.note ?? '', at: pos[m.s] });
      segs.push({ m, kind: 'imp' });
    } else segs.push({ m, kind: e0.t });
  });
  void valueIdx;

  // the mode named in the text, and the words that are only the mode: "ถูกอัญเชิญ" is a start mode and a special birth (rule 5 of the table)
  let mode: string | null = draft.mode;
  const items: SheetItem[] = [];
  const request = { second: undefined as string | null | undefined };
  const kept: Hit[] = [];
  const cut: { hit: Hit; why: string }[] = [];
  const countBy: Record<string, number> = {};
  const seenSingle = new Map<string, Hit>();
  const hasHalfWord = hits.some((h) => h.field.key === 'half' && !h.negated);
  const races = hits.filter((h) => h.field.key === 'race' && !h.negated);
  const reason = (needle: string): string => lex.syn.conflicts.find((c) => c.case.includes(needle))?.effect ?? '';
  for (const h of hits) {
    const key = h.field.key;
    if (key === 'startMode') {
      const id = MODES.find((m) => m.name === h.value.name)?.id;
      if (id && !h.negated) mode = mode ?? id;
      continue;
    }
    if (h.negated) {
      // a refusal takes the value out of the draw (step 3); the sheet shows it struck out
      items.push({ row: 'cannot', field: fieldLabel(h.field.field), key, value: h.value.name, code: h.value.code, note: lex.syn.negationResults[0]?.effect ?? '', points: 0, pending: !APPLIED.has(key), negated: true, at: pos[h.m.s] });
      continue;
    }
    // two ambiguous readings of one word are one value for the sheet: keep the first field
    if (key === 'race' && h !== races[0]) {
      if (hasHalfWord && h === races[1]) {
        kept.push({ ...h, field: { ...h.field, key: 'second' } });
      } else cut.push({ hit: h, why: reason('สองเผ่าและไม่มีคำว่าลูกครึ่ง') });
      continue;
    }
    if (SINGLE.has(key)) {
      const first = seenSingle.get(key);
      if (first && first.value.code !== h.value.code) {
        cut.push({ hit: h, why: reason(key === 'class' ? 'ฐานะสองค่า' : key === 'religion' ? 'ศาสนาสองค่า' : 'สองเผ่า') });
        continue;
      }
      seenSingle.set(key, h);
    }
    const lim = LIMITS[key];
    if (lim) {
      countBy[key] = (countBy[key] ?? 0) + 1;
      if (countBy[key] > lex.wish.limits[lim]) {
        cut.push({ hit: h, why: reason('นิสัยเกิน 3') });
        continue;
      }
    }
    if (!kept.some((k) => k.field.key === key && k.value.code === h.value.code)) kept.push(h);
  }

  // the page of choosing by hand stands over what was understood
  for (const [key, code] of Object.entries(draft.picks)) {
    const f = lex.syn.fields.find((x) => x.key === key);
    const v = f?.values.find((x) => x.code === code);
    if (!f) continue;
    for (let i = kept.length - 1; i >= 0; i--) if (kept[i].field.key === key) kept.splice(i, 1);
    if (v) kept.unshift({ m: { s: 0, e: 0, entries: [] }, field: f, value: v, negated: false, order: -1 });
    else randomFields.add(key);
  }

  // the half-blood: two races and the word, or one race and the word (conflicts of §9)
  const askOut: WishRead['ask'] = {};
  const ask: WishRead['ask'] = askOut;
  const fix = (key: string): Hit | undefined => kept.find((k) => k.field.key === key);
  const modeAsk = mode ? MODE_ASK[mode] ?? {} : {};
  Object.assign(ask, modeAsk);
  const raceHit = fix('race');
  const special = fix('specialBirth');
  if (raceHit) ask.race = raceHit.value.code;
  if (special) {
    if (special.value.name === 'ตุ๊กตา') ask.race = 'construct';
    else {
      ask.race = 'human';
      ask.special = true;
      ask.country = special.value.name === 'ผู้กลับชาติ' ? 'MH-07' : 'AL-02';
    }
  }
  const secondHit = kept.find((k) => k.field.key === 'second');
  const halfWord = fix('half');
  const origin = data.origin?.items as { halfPairs: { main: string; second: { id: string; w: number }[] }[]; noHalf: string[] } | undefined;
  if (secondHit) {
    const pair = origin?.halfPairs.find((p) => p.main === ask.race)?.second.some((s) => s.id === secondHit.value.code);
    if (pair) ask.second = secondHit.value.code;
    else cut.push({ hit: secondHit, why: reason('สองเผ่าและมีคำว่าลูกครึ่ง') });
  } else if (halfWord || mode === 'halfblood') {
    const r = ask.race ?? 'human';
    const pairs = origin?.halfPairs.find((p) => p.main === r)?.second;
    if (pairs?.length && !origin?.noHalf.includes(r)) {
      ask.race = r;
      ask.second = [...pairs].sort((a, b) => b.w - a.w)[0].id;
    }
  }
  void request;
  const g = fix('gender');
  if (g && GENDER[g.value.name]) ask.gender = GENDER[g.value.name];
  const sg = fix('birthSign');
  if (sg && SIGN[sg.value.name]) ask.sign = SIGN[sg.value.name];
  const tm = fix('birthTime');
  if (tm && TIME[tm.value.name]) ask.time = TIME[tm.value.name];
  const ct = fix('country');
  const cn = fix('continent');
  if (ct) ask.country = ct.value.code;
  else if (cn) {
    // a continent: the first country of it where the race is born (origin.birthplaces), else the first of the continent
    const bp = (data.origin?.items as { birthplaces: { race: string; main: string[]; [k: string]: unknown }[] } | undefined)?.birthplaces.find((b) => b.race === (ask.race ?? ''));
    const pool = (bp?.main ?? []).filter((id) => id.startsWith(cn.value.code));
    const any = lex.countries.filter((c) => c.continent === cn.value.code).map((c) => c.id);
    ask.country = pool[0] ?? any[0];
  }

  // the price and the limit of 10 points (step 5); the order is the order of typing
  const total = lex.wish.budget.total;
  let used = 0;
  let refunded = 0;
  const aptSeen = { n: 0 };
  const lean: SheetItem[] = [];
  const sure: SheetItem[] = [];
  const cannot: SheetItem[] = items.filter((x) => x.row === 'cannot');
  for (let k of [...kept].sort((a, b) => a.order - b.order)) {
    const key = k.field.key === 'second' ? 'half' : k.field.key;
    // the level of a class: a strong word moves it one step to the end of its side, a weak one one step toward class 3 (20-wish-synonyms.md §6 "คำบอกระดับ")
    if (key === 'class' && k.level) {
      const n = Number(/\d/.exec(k.value.code)?.[0]);
      const to = k.level === 'strong' ? (n > 3 ? 5 : n < 3 ? 1 : 3) : 3;
      const moved = n + Math.sign(to - n);
      const v = n && moved !== n ? k.field.values.find((x) => x.code === `ชนชั้น ${moved}`) : undefined;
      if (v) k = { ...k, value: v };
    }
    const order = key === 'aptitude' ? aptSeen.n++ : 0;
    const cost = priceOf(data, key, k.value, k.level, order);
    const isLean = k.field.part === 'tendency' || k.field.part === 'story' || (key === 'trait') || (key === 'aptitude' && order > 0);
    const item: SheetItem = {
      row: isLean ? 'lean' : 'sure',
      field: fieldLabel(k.field.field),
      key,
      value: k.value.name,
      code: k.value.code,
      note: '',
      points: cost,
      pending: !APPLIED.has(key) || (key === 'half' && !ask.second),
      level: k.level,
      at: k.order < 0 ? -1 : pos[k.m.s],
    };
    if (cost > 0 && used + cost > total) {
      cannot.push({ ...item, row: 'cannot', note: `${lex.wish.budget.overBudget} (ขาด ${used + cost - total} แต้ม)` });
      continue;
    }
    used += cost;
    if (cost < 0) refunded += -cost;
    (isLean ? lean : sure).push(item);
  }
  for (const c of cut) cannot.push({ row: 'cannot', field: fieldLabel(c.hit.field.field), key: c.hit.field.key, value: c.hit.value.name, code: c.hit.value.code, note: c.why, points: 0, pending: false, at: pos[c.hit.m.s] });
  for (const o of imps) cannot.push({ row: 'cannot', field: '', key: 'impossible', value: o.ask, code: o.ask, note: o.note, points: 0, pending: false, at: o.at });
  for (const o of offs) cannot.push({ row: 'cannot', field: '', key: 'off', value: o.topic, code: o.topic, note: o.note, points: 0, pending: false, at: o.at });

  // the fields not asked stay random (the sheet shows a question mark)
  const asked = new Set([...kept.map((k) => (k.field.key === 'second' ? 'half' : k.field.key)), ...(mode ? ['startMode'] : [])]);
  const random: SheetItem[] = [];
  for (const key of ALL_FIELDS_CHECK) {
    const f = lex.syn.fields.find((x) => x.key === key)!;
    const explicit = randomAll || randomFields.has(key);
    const unaskedMode = key === 'race' && !!ask.race && !asked.has('race');
    if (asked.has(key) || unaskedMode) continue;
    if (key === 'continent' && (asked.has('country') || ask.country)) continue;
    random.push({ row: 'random', field: fieldLabel(f.field), key, value: '', code: '', note: explicit ? 'random' : '', points: 0, pending: false, at: -1 });
  }

  // the verdict (step 6): the known stretches over the whole, and the unknown runs of 3 letters or more
  const total0 = norm.length;
  let known = 0;
  let unknownRun = 0;
  let longUnknown = false;
  let last = 0;
  const unknownRuns: [number, number][] = [];
  for (const m of matches) {
    if (m.s > last) unknownRuns.push([last, m.s]);
    known += m.e - m.s;
    last = m.e;
  }
  if (last < total0) unknownRuns.push([last, total0]);
  for (const [a, b] of unknownRuns) {
    unknownRun += b - a;
    if (b - a >= 3) longUnknown = true;
  }
  void unknownRun;
  const hasValue = hits.length > 0 || randomAll || !!mode;
  const coverage = total0 ? known / total0 : 1;
  let understood: Understood;
  if (!total0) understood = mode ? 'full' : 'empty';
  else if (hasValue && !longUnknown) understood = 'full';
  else if (hasValue && coverage >= lex.syn.knownCharShare) understood = 'mostly';
  else if (hasValue) understood = 'part';
  else understood = 'none';

  // the segments for the box
  const cutSet = new Set(cut.map((c) => c.hit.m));
  const segments: Segment[] = [];
  let cursor = 0;
  const text = draft.text;
  const origAt = (i: number) => pos[i];
  for (const s of segs) {
    const a = origAt(s.m.s);
    const b = origAt(s.m.e - 1) + 1;
    if (a > cursor) segments.push({ text: text.slice(cursor, a), kind: text.slice(cursor, a).trim() ? 'unknown' : 'filler' });
    segments.push({ text: text.slice(a, b), kind: s.kind, ...(s.part ? { part: s.part } : {}), ...(cutSet.has(s.m) ? { cut: true } : {}), ...(s.hit?.negated ? { negated: true } : {}) });
    cursor = b;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), kind: text.slice(cursor).trim() ? 'unknown' : 'filler' });

  // the ring of 10 beads: gold for the points spent, plain for those left; the points a harder life gives back are ash beads on top of the ten
  const beads: FatePoints['beads'] = [];
  const spent = used + refunded;
  for (let i = 0; i < total + refunded; i++) beads.push(i < spent ? 'spent' : i >= total ? 'refund' : 'free');
  const points: FatePoints = { total, used, left: total - used, refunded, beads };

  return {
    text,
    segments,
    items: [...sure, ...lean, ...cannot, ...random],
    points,
    understood,
    coverage,
    mode,
    ask: { ...ask },
    byHand: understood === 'none' || understood === 'part',
  };
}

/** The values a tag offers (the chips under the box): the names of a field of the table. */
export function chipValues(data: GameData, field: string, limit = 12): { code: string; name: string }[] {
  const f = lexicon(data).syn.fields.find((x) => x.key === field);
  return (f?.values ?? []).slice(0, limit).map((v) => ({ code: v.code, name: v.name }));
}

/** The fields of the page of choosing by hand, each with its list (19-wish.md §3 "หน้าเลือกเอง": every field of the sheet from a list). */
export const HAND_FIELDS = ['race', 'gender', 'continent', 'class', 'family', 'birthSign', 'birthTime'] as const;

export function handFields(data: GameData): { key: string; name: string; values: { code: string; name: string }[] }[] {
  const lex = lexicon(data);
  return HAND_FIELDS.map((k) => {
    const f = lex.syn.fields.find((x) => x.key === k)!;
    return { key: k, name: f.field, values: f.values.map((v) => ({ code: v.code, name: v.name })) };
  });
}

/** The parts of the sheet in the order the document gives (wish.json `sheet`). */
export function sheetParts(data: GameData): { part: string; shows: string }[] {
  return (data.wish?.items as WishFile).sheet;
}

// ---------- the request -> the options of the birth ----------

/** The options the bridge takes (`store.newLife`): the race and the country for the start rule of the world, and a birther that carries the rest of the request to the core. */
export function sessionOpts(read: WishRead, seed: number): SessionOpts {
  const a = read.ask;
  const opts: SessionOpts = { seed };
  if (a.race) opts.race = a.race;
  if (a.country) opts.country = a.country;
  const needsBirther = a.second !== undefined || a.gender || a.sign || a.time || a.special;
  if (needsBirther) {
    opts.birther = (ctx, req) =>
      characterBirth(ctx, {
        race: a.race ?? req.race,
        country: a.country ?? req.country,
        ...(a.second !== undefined ? { second: a.second } : {}),
        ...(a.gender ? { gender: a.gender } : {}),
        ...(a.sign ? { sign: a.sign } : {}),
        ...(a.time ? { time: a.time } : {}),
        ...(a.special ? { special: true } : {}),
      });
  }
  return opts;
}

// ---------- the sheet of birth ----------

export interface VowView {
  n: number;
  id: string | null;
  name: string;
  /** "สำเร็จเมื่อ" (08-goals.md §2 table). */
  done: string;
  /** The chronicle points a kept vow and a broken one give. */
  reward: { kept: number; broken: number } | null;
}

export interface RhythmView {
  id: string;
  name: string;
  effect: string;
  open: boolean;
  chosen: boolean;
}

export interface Certificate {
  /** The lines of the birth the text system tells (who, family, the traits that show, the question): the "คำบรรยาย". */
  story: string[];
  /** What the scratch life is, to check the request against (the screen shows it as the verdict of each sure row). */
  born: { name: string; race: string; raceName: string; home: string; homeName: string; gender: string; mode: string; modeName: string };
  /** The rows of the sheet with the requests the birth did not honour moved to `cannot`. */
  items: SheetItem[];
  points: FatePoints;
  vows: VowView[];
  rhythms: RhythmView[];
  /** Did the first life of this world get the mode asked for? (The core cannot yet force the special births.) */
  modeHeld: boolean;
}

interface Scratch {
  session: Session;
  life: LifeState;
}

const scratches = new Map<string, Scratch>();

/** A copy of the world with the life that would be born: same seed, same options, so the same life as `store.newLife` (the bridge builds it the same way). */
export function scratchLife(data: GameData, opts: SessionOpts, key: string): Scratch {
  const hit = scratches.get(key);
  if (hit) return hit;
  const session = createSession(data, opts);
  const life = startLife(session);
  if (scratches.size > 8) scratches.delete(scratches.keys().next().value as string);
  const out = { session, life };
  scratches.set(key, out);
  return out;
}

const sendVow = (s: Session, args: Record<string, unknown>) => command(s.game.ctx, { type: 'god', action: 'vow.pick' as Extract<Command, { type: 'god' }>['action'], args, confirm: false });

/** The sheet of birth: the request checked against the life that would be born, the vows on the stones, the cups of fate. */
export function certificate(data: GameData, draft: StartDraft, read: WishRead = readWish(data, draft)): Certificate {
  const opts = sessionOpts(read, draft.seed);
  const { session, life } = scratchLife(data, opts, JSON.stringify([draft.seed, read.ask]));
  const ctx = session.game.ctx;
  const state = session.game.state;
  const story = lines(data, state.log, 1)
    .map((l) => l.text)
    .filter((t, i, all) => i >= all.length - 4);
  const mode = modeOf(state, life);
  const modeName = MODES.find((m) => m.id === mode)?.name ?? mode;
  const born = { name: life.name, race: life.race, raceName: raceName(ctx, life.race), home: life.country, homeName: placeName(ctx, life.country) ?? life.country, gender: life.gender, mode, modeName };

  // the request against the life (a request the birth did not honour is "cannot", with the life that stands in)
  const items = read.items.map((it) => {
    if (it.row !== 'sure' || it.pending) return it;
    const ok =
      (it.key === 'race' && life.race === it.code) ||
      (it.key === 'specialBirth' && (it.value === 'ตุ๊กตา' ? life.race === 'construct' : mode === (it.value === 'ผู้กลับชาติ' ? 'reincarnated' : 'summoned'))) ||
      (it.key === 'half' && life.flags.includes('half')) ||
      (it.key === 'gender' && (GENDER[it.value] ? life.gender === GENDER[it.value] : true)) ||
      (it.key === 'continent' && life.country.startsWith(it.code)) ||
      (it.key === 'country' && life.country === it.code) ||
      !['race', 'specialBirth', 'half', 'gender', 'continent', 'country'].includes(it.key);
    return ok ? it : { ...it, row: 'cannot' as Row, note: `${born.raceName} ${born.homeName}`, pending: false };
  });

  const peek = peekLife(life);
  const vows: VowView[] = peek.offers.map((id, i) => {
    const r = sendVow(session, { pick: i + 1 });
    const p = r.ok ? r.preview : undefined;
    return { n: i + 1, id, name: String(p?.name ?? id), done: String(p?.done ?? ''), reward: (p?.reward as VowView['reward']) ?? null };
  });
  vows.push({ n: vows.length + 1, id: null, name: START_LABELS.noVow, done: '', reward: null });

  const rh = rhythms(ctx).map((r) => ({ ...r, chosen: r.id === draft.rhythm }));
  const modeHeld = !read.mode || read.mode === mode || read.mode === 'plain';
  return { story, born, items, points: read.points, vows, rhythms: rh, modeHeld };
}

// ---------- starting the life ----------

export interface Launched {
  ok: boolean;
  reason?: string;
}

/** Starts the life: `store.newLife` with the options of the request, then the rhythm of fate and the vow, confirmed before the first beat is run (the clock runs on the next frame). */
export function launch(store: GameStore, read: WishRead, draft: StartDraft): Launched {
  const opts = sessionOpts(read, draft.seed);
  store.newLife(opts);
  if (draft.rhythm && draft.rhythm !== 'natural') {
    const r = store.god('vow.pick', { rhythm: draft.rhythm }, true);
    if (!r.ok) return { ok: false, reason: r.reason };
  }
  if (draft.vow !== null) {
    const r = store.god('vow.pick', { pick: draft.vow }, true);
    if (!r.ok) return { ok: false, reason: r.reason };
  }
  return { ok: true };
}
