// The wish of the player, read and priced by the core (docs/systems/character/19-wish.md, 20-wish-synonyms.md, experience/04-start-modes.md).
// The core interprets the wish so that a save replays it (19-wish.md §6): the synonym parser lives here, over data/gen/synonyms.json and wish.json,
// and the sheet it makes (`WishSheet`) goes to `birth()` as `BirthOpts.wish` and is kept in `life.ext.character.wish`.
// Pure: (data, text) -> the sheet; nothing here draws from the seed streams.
//
// It follows the steps of 20-wish-synonyms.md: one form of the text, the longest word first, a negation binds to the next value, a level word to the value
// beside it, the limits and the 10 points of fate, and a verdict on how much was understood (full, mostly, part, none: the last two open the page of
// choosing by hand). What the birth does with each field is in `birth.ts` and `wish-apply.ts`.
import type { GameData } from '../game';
import type { SynField, SynonymsFile, SynValue, WishFile } from '../data/types-character';
import { WISH_WORDS } from './tuning';

/** The start modes in the order of 04-start-modes.md (the codes `แบบ 1` to `แบบ 12` of the synonym table); the ending system's `MODES` is the same list. */
export const START_MODE_IDS = ['summoned', 'reincarnated', 'slime', 'soulmachine', 'demonkin', 'ghoul', 'elf', 'orc', 'dragonkin', 'halfblood', 'plain', 'heir'] as const;

/** The ids of the asks of the story part (`เรื่อง 1` to `เรื่อง 8` of the synonym table; 19-wish.md §2 "ส่วนเรื่อง"). */
export const STORY_IDS = ['travel', 'love', 'revenge', 'hero', 'plain', 'dragonfall', 'demonlord', 'nogod'] as const;
export type StoryId = (typeof STORY_IDS)[number];

/** What a wish asks of the birth, in the form the birth takes it. Every field left out is drawn (19-wish.md rule 6). */
export interface WishAsk {
  race?: string;
  second?: string | null;
  country?: string;
  /** A continent code (`AL`): the country is drawn inside it. */
  continent?: string;
  /** `main` `diaspora` `outside` (19-wish.md §2 "ถิ่นเกิด ... ชนิดถิ่น"). */
  placeKind?: 'main' | 'diaspora' | 'outside';
  gender?: 'm' | 'f';
  /** Genderless (19-wish.md "เพศ ... ไร้เพศ"), only for the races that can be (origin.gender `n`). */
  neuter?: boolean;
  sign?: string;
  time?: string;
  /** The special birth forced (the allowed ones are human only, `doll` is the construct). */
  specialBirth?: 'summoned' | 'reincarnated' | 'doll';
  /** Allow the special births by chance although a race was named (the legacy field; `specialBirth` forces). */
  special?: boolean;
  /** Social class 1..5. */
  cls?: number;
  family?: 'orphan' | 'single' | 'only' | 'many';
  /** `faith.NN`. */
  faith?: string;
  /** Up to three traits in the order typed; `sure` marks the one that is given for certain, the others weigh x3. */
  traits?: { id: string; sure: boolean }[];
  /** Up to two aptitudes; the first is given for certain at level 1, the second weighs x3. */
  aptitudes?: { id: string; sure: boolean }[];
  job?: string;
  companion?: string;
  blessing?: string;
  curse?: string;
  /** The asks of the story part (`StoryId`). */
  story?: StoryId[];
  /** The age of the world the player wants to be born in. */
  era?: 'early' | 'present';
  /** Values the player refused, by field (`race` `class` `trait` `aptitude` `blessing` `curse` `job` `faith` `sign` `time` `continent`): out of the draw (20-wish-synonyms.md §3). */
  ban?: Record<string, string[]>;
}

/** What a mode asks of the birth (a mode is a wish already written: 04-start-modes.md). */
const MODE_ASK: Record<string, WishAsk> = {
  summoned: { race: 'human', specialBirth: 'summoned' },
  reincarnated: { race: 'human', specialBirth: 'reincarnated' },
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

/** What the parser takes in: the text, the mode chosen and the choices made by hand (field key -> code, '' = random). */
export interface WishInput {
  text: string;
  mode: string | null;
  picks: Record<string, string>;
}

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
  /** Read and priced, but no system applies it yet (it is only kept on the sheet for the system that will). */
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

/**
 * The sheet of the wish: what was asked, read and priced, kept in the save (`life.ext.character.wish`) so that a replay uses it and not a new reading
 * (19-wish.md §6), and so that the ending card and the LLM can tell that this life was ordered. Plain JSON.
 */
export interface WishSheet {
  v: 1;
  text: string;
  mode: string | null;
  understood: Understood;
  ask: WishAsk;
  /** The rows of the sheet of birth as read (sure, lean, cannot, random). */
  items: SheetItem[];
  points: { total: number; used: number; left: number; refunded: number };
  /** Filled by the birth: the fields that were applied, and the asks the birth refused with the reason (a class the land does not give ...). */
  born?: { applied: string[]; refused: { key: string; value: string; reason: string }[] };
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
  ask: WishAsk;
  /** The sheet that goes to the birth and is kept in the save. */
  sheet: WishSheet;
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
  const out: Lexicon = { map, maxLen, syn, wish, countries };
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
/** The fields the birth applies (`birth.ts`, `wish-apply.ts`). */
const APPLIED = new Set(['race', 'specialBirth', 'half', 'gender', 'continent', 'placeKind', 'country', 'birthTime', 'birthSign', 'class', 'family', 'religion', 'trait', 'aptitude', 'job', 'companion', 'blessing', 'curse', 'story', 'era']);
const SINGLE = new Set(['race', 'specialBirth', 'gender', 'continent', 'country', 'placeKind', 'class', 'family', 'birthTime', 'birthSign', 'religion', 'era']);
const LIMITS: Record<string, keyof WishFile['limits']> = { trait: 'traits', aptitude: 'aptitudes', blessing: 'blessings' };

const GENDER: Record<string, 'm' | 'f'> = { ชาย: 'm', หญิง: 'f' };
const SIGN: Record<string, string> = { ไม่มีดวงพิเศษ: 'none', ดาวหาง: 'comet', สุริยคราส: 'eclipse', จันทร์เต็มดวง: 'fullmoon', พายุ: 'storm' };
const TIME: Record<string, string> = { รุ่งอรุณ: 'dawn', กลางวัน: 'day', สนธยา: 'dusk', กลางคืน: 'night' };

/** The price of a value in fate points (19-wish.md §4). */
function priceOf(data: GameData, key: string, v: SynValue, level: 'strong' | 'weak' | undefined, order: number): number {
  switch (key) {
    case 'race':
      return COMMON.has(v.code) ? 0 : RARE.has(v.code) ? 2 : 1;
    case 'specialBirth':
      return v.name === 'ตุ๊กตา' ? 1 : 3; // the doll is a race of the construct ("เผ่าอื่น"), the summoned and the reincarnated cost 3
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

/** The class number of a synonym code (`ชนชั้น 4` -> 4). */
const classOfCode = (code: string): number => Number(/\d/.exec(code)?.[0]);

/** A level word moves a class: a strong word one step toward the end of its side, a weak one one step toward class 3 (20-wish-synonyms.md §6 "คำบอกระดับ"). */
function moveClass(n: number, level: 'strong' | 'weak' | undefined): number {
  if (!level || !n) return n;
  const to = level === 'strong' ? (n > 3 ? 5 : n < 3 ? 1 : 3) : 3;
  return n + Math.sign(to - n);
}

/** The classes a refusal takes out of the draw (19-wish negationResults: "ไม่เอาคนจน" cuts 1 and 2, "ไม่ต้องรวยมาก" cuts 5). */
function bannedClasses(n: number): number[] {
  if (n === 2) return [1, 2];
  if (n === 4) return [4, 5];
  return [n];
}

const FAMILY: Record<string, NonNullable<WishAsk['family']>> = { กำพร้า: 'orphan', พ่อหรือแม่คนเดียว: 'single', ลูกคนเดียว: 'only', พี่น้องมาก: 'many' };
const PLACE_KIND: Record<string, NonNullable<WishAsk['placeKind']>> = { ถิ่นหลัก: 'main', พลัดถิ่น: 'diaspora', นอกถิ่น: 'outside' };
const ERA: Record<string, NonNullable<WishAsk['era']>> = { ยุคต้นโลก: 'early', ยุคปัจจุบัน: 'present' };
/** The asks of the story part that no system binds yet. The god's goals bind love, the hero and no-god now: they put GV-06, GV-09 and GV-12 among the vows offered (M5 review round two R4). */
const STORY_UNBOUND = new Set<StoryId>();

/** The faith id of a synonym code (`ศาสนา 3` -> `faith.03`). */
const faithOf = (code: string): string => `faith.${String(Number(/\d+/.exec(code)?.[0])).padStart(2, '0')}`;

const BAN_KEY: Record<string, string> = { race: 'race', class: 'class', trait: 'trait', aptitude: 'aptitude', blessing: 'blessing', curse: 'curse', job: 'job', religion: 'faith', birthSign: 'sign', birthTime: 'time', continent: 'continent' };

/** Reads the wish (steps 1 to 6 of 20-wish-synonyms.md §10) into the sheet the birth takes. */
export function readWish(data: GameData, draft: WishInput): WishRead {
  const lex = lexicon(data);
  const { norm, pos } = normalize(draft.text);
  const matches = norm ? scan(lex, norm) : [];
  const origin = data.origin?.items as
    | { halfPairs: { main: string; second: { id: string; w: number }[] }[]; noHalf: string[]; gender: Record<string, { m: number; f: number; n: number }> }
    | undefined;
  const traitData = ((data.traits?.items as { traits?: { id: string; conflicts: string[] }[] } | undefined)?.traits ?? []);
  const blessingData = (data.blessings?.items ?? []) as { id: string; tier: string; group: string }[];
  const jobData = ((data.jobs?.items as { jobs?: { id: string; kind: string }[] } | undefined)?.jobs ?? []);

  // bind the negations, the levels and the random words to the values beside them (step 3)
  const hits: Hit[] = [];
  const segs: { m: Match; kind: WishKind; part?: Segment['part']; hit?: Hit }[] = [];
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
      const prev = matches[i - 1];
      const next = matches[i + 1];
      const lv = (x?: Match) => x?.entries.find((e) => e.t === 'level')?.tag as 'strong' | 'weak' | undefined;
      const level = lv(next) ?? lv(prev);
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

  // the mode named in the text, and the words that are only the mode: "ถูกอัญเชิญ" is a start mode and a special birth (rule 5 of the table)
  let mode: string | null = draft.mode;
  const items: SheetItem[] = [];
  const kept: Hit[] = [];
  const cut: { hit: Hit; why: string }[] = [];
  const countBy: Record<string, number> = {};
  const seenSingle = new Map<string, Hit>();
  const hasHalfWord = hits.some((h) => h.field.key === 'half' && !h.negated);
  const races = hits.filter((h) => h.field.key === 'race' && !h.negated);
  const reason = (needle: string): string => lex.syn.conflicts.find((c) => c.case.includes(needle))?.effect ?? '';
  const ban: Record<string, string[]> = {};
  const banOf = (key: string, ...codes: string[]) => {
    const list = (ban[key] ??= []);
    for (const c of codes) if (!list.includes(c)) list.push(c);
  };
  for (const h of hits) {
    const key = h.field.key;
    if (key === 'startMode') {
      const id = START_MODE_IDS[Number(/\d+/.exec(h.value.code)?.[0]) - 1];
      if (id && !h.negated) mode = mode ?? id;
      continue;
    }
    if (h.negated) {
      // a refusal takes the value out of the draw (step 3); the sheet shows it struck out
      const banKey = BAN_KEY[key];
      if (banKey) {
        if (key === 'class') banOf(banKey, ...bannedClasses(moveClass(classOfCode(h.value.code), h.level)).map(String));
        else if (key === 'religion') banOf(banKey, faithOf(h.value.code));
        else if (key === 'birthSign') banOf(banKey, SIGN[h.value.name] ?? 'none');
        else if (key === 'birthTime') banOf(banKey, TIME[h.value.name] ?? h.value.code);
        else banOf(banKey, h.value.code);
      }
      items.push({ row: 'cannot', field: fieldLabel(h.field.field), key, value: h.value.name, code: h.value.code, note: lex.syn.negationResults[0]?.effect ?? '', points: 0, pending: !banKey, negated: true, at: pos[h.m.s] });
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
      if (kept.some((k) => k.field.key === key && k.value.code === h.value.code)) continue;
      countBy[key] = (countBy[key] ?? 0) + 1;
      if (countBy[key] > lex.wish.limits[lim]) {
        cut.push({ hit: h, why: key === 'trait' ? reason('นิสัยเกิน 3') : key === 'aptitude' ? reason('นิสัยเกิน 3') : reason('ขอพร C หรือ U หลายข้อ') });
        continue;
      }
    }
    if (key === 'curse' && kept.some((k) => k.field.key === 'curse' && k.value.code !== h.value.code)) {
      cut.push({ hit: h, why: WISH_WORDS.oneCurse });
      continue;
    }
    if (key === 'trait') {
      // traits that cannot live together: the one typed first stays (20-wish-synonyms.md §9)
      const clash = kept.find((k) => k.field.key === 'trait' && (traitData.find((t) => t.id === k.value.code)?.conflicts.includes(h.value.code) || traitData.find((t) => t.id === h.value.code)?.conflicts.includes(k.value.code)));
      if (clash) {
        cut.push({ hit: h, why: reason('นิสัยขัดกัน') });
        continue;
      }
    }
    if (key === 'job' && jobData.find((j) => j.id === h.value.code)?.kind !== 'common') {
      cut.push({ hit: h, why: WISH_WORDS.jobNotCommon });
      continue;
    }
    if (!kept.some((k) => k.field.key === key && k.value.code === h.value.code)) kept.push(h);
  }

  // asking and refusing the same value cancels both (negationResults); the sheet says so
  for (let i = kept.length - 1; i >= 0; i--) {
    const k = kept[i];
    const banKey = BAN_KEY[k.field.key];
    if (!banKey) continue;
    const code = k.field.key === 'class' ? String(classOfCode(k.value.code)) : k.field.key === 'religion' ? faithOf(k.value.code) : k.field.key === 'birthSign' ? (SIGN[k.value.name] ?? 'none') : k.field.key === 'birthTime' ? (TIME[k.value.name] ?? k.value.code) : k.value.code;
    if (ban[banKey]?.includes(code)) {
      cut.push({ hit: k, why: lex.syn.negationResults.find((n) => n.case.includes('ขอและห้าม'))?.effect ?? '' });
      ban[banKey] = ban[banKey].filter((c) => c !== code);
      if (!ban[banKey].length) delete ban[banKey];
      kept.splice(i, 1);
    }
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

  // the price and the limit of 10 points (step 5); the order is the order of typing
  const total = lex.wish.budget.total;
  let used = 0;
  let refunded = 0;
  const aptSeen = { n: 0 };
  const lean: SheetItem[] = [];
  const sure: SheetItem[] = [];
  const cannot: SheetItem[] = items.filter((x) => x.row === 'cannot');
  const accepted: { hit: Hit; item: SheetItem }[] = [];
  for (let k of [...kept].sort((a, b) => a.order - b.order)) {
    const key = k.field.key === 'second' ? 'half' : k.field.key;
    // the level of a class: a strong word moves it one step to the end of its side, a weak one one step toward class 3 (20-wish-synonyms.md §6 "คำบอกระดับ")
    if (key === 'class' && k.level) {
      const n = classOfCode(k.value.code);
      const moved = moveClass(n, k.level);
      const v = n && moved !== n ? k.field.values.find((x) => x.code === `ชนชั้น ${moved}`) : undefined;
      if (v) k = { ...k, value: v };
    }
    // a strong word moves a blessing of tier C to the tier U of the same line when there is one (levelEffects "พร")
    if (key === 'blessing' && k.level === 'strong') {
      const g = blessingData.find((b) => b.id === k.value.code);
      const up = g && g.tier === 'C' ? blessingData.find((b) => b.tier === 'U' && b.group === g.group && k.field.values.some((v) => v.code === b.id)) : undefined;
      const v = up ? k.field.values.find((x) => x.code === up.id) : undefined;
      if (v) k = { ...k, value: v };
    }
    const order = key === 'aptitude' ? aptSeen.n++ : 0;
    const cost = priceOf(data, key, k.value, k.level, order);
    const isLean = k.field.part === 'tendency' || k.field.part === 'story' || key === 'trait' || (key === 'aptitude' && order > 0);
    const item: SheetItem = {
      row: isLean ? 'lean' : 'sure',
      field: fieldLabel(k.field.field),
      key,
      value: k.value.name,
      code: k.value.code,
      note: '',
      points: cost,
      pending: !APPLIED.has(key) || (key === 'story' && STORY_UNBOUND.has(STORY_IDS[Number(/\d+/.exec(k.value.code)?.[0]) - 1])),
      level: k.level,
      at: k.order < 0 ? -1 : pos[k.m.s],
    };
    if (cost > 0 && used + cost > total) {
      cannot.push({ ...item, row: 'cannot', note: `${lex.wish.budget.overBudget} (ขาด ${used + cost - total} แต้ม)`, pending: false });
      continue;
    }
    used += cost;
    if (cost < 0) refunded += -cost;
    (isLean ? lean : sure).push(item);
    accepted.push({ hit: k, item });
  }

  // what an accepted ask cannot be after all (the race it needs is not the race asked, the pair is not in the table ...): out of the sheet, its points given back
  const drop = (a: { hit: Hit; item: SheetItem } | undefined, why: string): void => {
    if (!a) return;
    const list = a.item.row === 'lean' ? lean : sure;
    const i = list.indexOf(a.item);
    if (i < 0) return;
    list.splice(i, 1);
    accepted.splice(accepted.indexOf(a), 1);
    used -= a.item.points;
    if (a.item.points < 0) refunded -= -a.item.points;
    cannot.push({ ...a.item, row: 'cannot', note: why, points: 0, pending: false });
  };
  const acc = (key: string) => accepted.find((a) => a.hit.field.key === key);
  const accAll = (key: string) => accepted.filter((a) => a.hit.field.key === key);

  // ---- the ask (what the birth takes) ----
  const ask: WishAsk = {};
  const modeAsk = mode ? MODE_ASK[mode] ?? {} : {};
  Object.assign(ask, modeAsk);
  const raceA = acc('race');
  const special = acc('specialBirth');
  if (raceA) ask.race = raceA.hit.value.code;
  if (special) {
    const sp = special.hit.value.name === 'ตุ๊กตา' ? 'doll' : special.hit.value.name === 'ผู้กลับชาติ' ? 'reincarnated' : 'summoned';
    const need = sp === 'doll' ? 'construct' : 'human';
    if (raceA && raceA.hit.value.code !== need) drop(raceA, WISH_WORDS.specialNeedsRace);
    ask.race = need;
    ask.specialBirth = sp;
  } else if (ask.specialBirth && ask.race !== 'human') delete ask.specialBirth; // a mode of the special births over another race: the race typed wins
  const halfWord = accepted.find((a) => a.hit.field.key === 'half' && a.hit.value.name === 'ลูกครึ่ง');
  const secondHitA = accepted.find((a) => a.item.key === 'half' && a.hit.field.key === 'second');
  if (secondHitA) {
    const pair = origin?.halfPairs.find((p) => p.main === ask.race)?.second.some((s) => s.id === secondHitA.hit.value.code);
    if (pair && !origin?.noHalf.includes(ask.race ?? '')) ask.second = secondHitA.hit.value.code;
    else drop(secondHitA, reason('สองเผ่าและมีคำว่าลูกครึ่ง'));
  } else if (halfWord || mode === 'halfblood') {
    const r = ask.race ?? 'human';
    const pairs = origin?.halfPairs.find((p) => p.main === r)?.second;
    if (pairs?.length && !origin?.noHalf.includes(r)) {
      ask.race = r;
      ask.second = [...pairs].sort((a, b) => b.w - a.w)[0].id;
    } else if (halfWord) drop(halfWord, WISH_WORDS.noHalf);
  }
  if (ask.specialBirth && ask.specialBirth !== 'doll' && ask.second !== undefined) {
    // the summoned has no family and is not a half-blood (origin.specialBirths); the reincarnated may be one
    if (ask.specialBirth === 'summoned') {
      if (secondHitA && accepted.includes(secondHitA)) drop(secondHitA, WISH_WORDS.summonedNoHalf);
      delete ask.second;
    }
  }

  // the story part (19-wish.md §2 "ส่วนเรื่อง"): the ids go to the sheet; the demon lord asks the race, the ordinary life asks the mode
  const storyA = accAll('story');
  for (const a of storyA) {
    const id = STORY_IDS[Number(/\d+/.exec(a.hit.value.code)?.[0]) - 1];
    if (id === 'plain') mode = mode ?? 'plain';
    if (id === 'demonlord') {
      if (!ask.race) {
        ask.race = 'demonkin';
        mode = mode ?? 'demonkin';
      } else if (ask.race !== 'demonkin' && ask.second === undefined) {
        const pairs = origin?.halfPairs.find((p) => p.main === ask.race)?.second;
        if (pairs?.some((s) => s.id === 'demonkin') && !origin?.noHalf.includes(ask.race)) ask.second = 'demonkin';
        else drop(a, WISH_WORDS.demonNeedsRace);
      }
    }
  }
  const storyKept = storyA.filter((a) => accepted.includes(a)).map((a) => STORY_IDS[Number(/\d+/.exec(a.hit.value.code)?.[0]) - 1]).filter((x): x is StoryId => !!x);
  if (storyKept.length) ask.story = storyKept;

  // gender (19-wish.md "เพศ"): a gender the race does not have is cut with the reason of the table
  const gA = acc('gender');
  if (gA) {
    const row = ask.race ? origin?.gender[ask.race] : undefined;
    if (gA.hit.value.name === 'ไร้เพศ') {
      if (row && row.n === 0) drop(gA, reason('เพศไม่มีในเผ่า'));
      else ask.neuter = true;
    } else if (row && (gA.hit.value.name === 'ชาย' ? row.m === 0 : row.f === 0)) drop(gA, reason('เพศไม่มีในเผ่า'));
    else if (GENDER[gA.hit.value.name]) ask.gender = GENDER[gA.hit.value.name];
  }
  const sg = acc('birthSign');
  if (sg && SIGN[sg.hit.value.name]) ask.sign = SIGN[sg.hit.value.name];
  const tm = acc('birthTime');
  if (tm && TIME[tm.hit.value.name]) ask.time = TIME[tm.hit.value.name];
  const ct = acc('country');
  const cn = acc('continent');
  const pk = acc('placeKind');
  if (ct) ask.country = ct.hit.value.code;
  else if (cn) ask.continent = cn.hit.value.code;
  if (pk && PLACE_KIND[pk.hit.value.code]) ask.placeKind = PLACE_KIND[pk.hit.value.code];
  const cl = acc('class');
  if (cl) ask.cls = classOfCode(cl.hit.value.code);
  const fa = acc('family');
  if (fa && FAMILY[fa.hit.value.code]) ask.family = FAMILY[fa.hit.value.code];
  const re = acc('religion');
  if (re) ask.faith = faithOf(re.hit.value.code);
  const trA = accAll('trait');
  if (trA.length) {
    const firstSure = trA.find((a) => a.hit.level === 'strong') ?? trA[0];
    ask.traits = trA.map((a) => ({ id: a.hit.value.code, sure: a === firstSure }));
  }
  const apA = accAll('aptitude').filter((a) => {
    // the swallowing is the slime's alone (the draw of aptitudes keeps it out of every other race)
    if (a.hit.value.code === 'absorb' && ask.race && ask.race !== 'slime') {
      drop(a, WISH_WORDS.absorbSlime);
      return false;
    }
    return true;
  });
  if (apA.length) ask.aptitudes = apA.map((a, i) => ({ id: a.hit.value.code, sure: i === 0 }));
  const jb = acc('job');
  if (jb) ask.job = jb.hit.value.code;
  const cp = acc('companion');
  if (cp) ask.companion = cp.hit.value.code;
  const bl = acc('blessing');
  if (bl) ask.blessing = bl.hit.value.code;
  const cu = acc('curse');
  if (cu) ask.curse = cu.hit.value.code;
  const er = acc('era');
  if (er && ERA[er.hit.value.code]) ask.era = ERA[er.hit.value.code];
  if (Object.keys(ban).length) ask.ban = ban;

  // the items the ask applies are not pending; the half-blood word without a pair is
  for (const a of accepted) if (a.item.key === 'half' && !ask.second) a.item.pending = true;
  for (const c of cut) cannot.push({ row: 'cannot', field: fieldLabel(c.hit.field.field), key: c.hit.field.key, value: c.hit.value.name, code: c.hit.value.code, note: c.why, points: 0, pending: false, at: pos[c.hit.m.s] });
  for (const o of imps) cannot.push({ row: 'cannot', field: '', key: 'impossible', value: o.ask, code: o.ask, note: o.note, points: 0, pending: false, at: o.at });
  for (const o of offs) cannot.push({ row: 'cannot', field: '', key: 'off', value: o.topic, code: o.topic, note: o.note, points: 0, pending: false, at: o.at });

  // the fields not asked stay random (the sheet shows a question mark)
  const askedKeys = new Set([...accepted.map((a) => (a.hit.field.key === 'second' ? 'half' : a.hit.field.key)), ...(mode ? ['startMode'] : [])]);
  const random: SheetItem[] = [];
  for (const key of ALL_FIELDS_CHECK) {
    const f = lex.syn.fields.find((x) => x.key === key)!;
    const explicit = randomAll || randomFields.has(key);
    const unaskedMode = key === 'race' && !!ask.race && !askedKeys.has('race');
    if (askedKeys.has(key) || unaskedMode) continue;
    if (key === 'continent' && (askedKeys.has('country') || ask.country)) continue;
    random.push({ row: 'random', field: fieldLabel(f.field), key, value: '', code: '', note: explicit ? 'random' : '', points: 0, pending: false, at: -1 });
  }

  // the verdict (step 6): the known stretches over the whole, and the unknown runs of 3 letters or more
  const total0 = norm.length;
  let known = 0;
  let longUnknown = false;
  let last = 0;
  const unknownRuns: [number, number][] = [];
  for (const m of matches) {
    if (m.s > last) unknownRuns.push([last, m.s]);
    known += m.e - m.s;
    last = m.e;
  }
  if (last < total0) unknownRuns.push([last, total0]);
  for (const [a, b] of unknownRuns) if (b - a >= 3) longUnknown = true;
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
  for (const s of segs) {
    const a = pos[s.m.s];
    const b = pos[s.m.e - 1] + 1;
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
  const all = [...sure, ...lean, ...cannot, ...random];
  const sheet: WishSheet = { v: 1, text, mode, understood, ask, items: all, points: { total, used, left: total - used, refunded } };

  return { text, segments, items: all, points, understood, coverage, mode, ask: { ...ask }, sheet, byHand: understood === 'none' || understood === 'part' };
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
