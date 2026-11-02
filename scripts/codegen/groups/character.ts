// Character group (code-plan §5.1, row "ตัวละคร"): docs/systems/character/ → data/gen/{races,traits,aptitudes,skills,
// blessings,curses,jobs,fates,origin,wish,synonyms,companions}.json
//
// Source of truth is the docs. The 48 traits, 45 aptitudes, 150 skills, 107 blessings and 103 curses of the old code have
// no table in docs/systems/character/ (README.md points at docs/_generated/character-catalog/), so those rows are read from
// that folder and flagged `src: 'code'`. Everything the docs add is flagged `src: 'doc'`.
import type { Condition, ContinentId, CountryId, Effect, IdKind, RaceId } from '../../../src/core/types';
import type {
  Aptitude,
  Birthplace,
  BirthSign,
  CharCond,
  CompanionAbility,
  CompanionsFile,
  CompanionSpecies,
  CompanionStory,
  ContinentGift,
  Fate,
  FatesFile,
  Gift,
  HalfPair,
  Institution,
  Job,
  JobKind,
  JobsFile,
  MeetCause,
  MeetingPlace,
  OriginFile,
  Pick,
  Race,
  RaceGift,
  RaceOverride,
  RacesFile,
  RaceSkill,
  RaceTagMeaning,
  Rarity,
  Refs,
  Skill,
  StatKey,
  Subline,
  SynField,
  SynonymsFile,
  SpecialBirth,
  SynergyRule,
  SynValue,
  TagMeaning,
  Trait,
  WishCost,
  WishFile,
} from '../../../src/core/data/types-character';
import { parseCell } from '../lib/effects';
import { idIndex } from '../lib/ids';
import { Unparsed, readDoc, rel, tables, writeGen, type Table } from '../lib/table';
import type { GenReport } from '../run-all';

const D = 'docs/systems/character/';
const CAT = 'docs/_generated/character-catalog/';
const WORLD_TIME = 'docs/lore/world/world-time.md';
const GEN = 'scripts/codegen/groups/character.ts';

const ids = idIndex();
let unp = new Unparsed('character');

// ---------- small helpers ----------

const src = (file: string, line: number) => `${rel(file)}:${line}`;
const clean = (s: string) => s.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
const dot = (s: string) =>
  s
    .split(/\s+·\s+/)
    .map((x) => x.trim())
    .filter((x) => x && x !== '—');
const words = (s: string) =>
  clean(s)
    .split(/\s+/)
    .filter((x) => x && x !== '—');
const toNum = (s: string) => Number(s.replace(/−/g, '-').replace(/,/g, ''));
const numIn = (s: string): number | null => {
  const m = s.replace(/,/g, '').match(/[+\-−]?\d+(?:\.\d+)?/);
  return m ? toNum(m[0]) : null;
};
/** `4–12` or `56–94 ปี` → [4, 12]. */
const rng = (s: string): [number, number] => {
  const m = s.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
  if (!m) throw new Error(`no range in "${s}"`);
  return [Number(m[1]), Number(m[2])];
};
const uniq = <T>(a: T[]) => [...new Set(a)];
const idOf = (s: string) => clean(s).split(/\s+/)[0];
/** Markdown links: a link to a .md file is dropped, any other keeps its label. */
const unlink = (s: string) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, (_, l: string) => (/\.md$/.test(l) ? '' : l));
/** Weight multipliers in prose (`×1.5` `2 เท่า`); returns them and the text without them. */
function mulOf(s: string): { mul: number | null; rest: string } {
  const m = s.match(/×\s*(\d+(?:\.\d+)?)/) ?? s.match(/(\d+(?:\.\d+)?)\s*เท่า/);
  return { mul: m ? Number(m[1]) : null, rest: s.replace(/น้ำหนัก\s*×\s*\d+(?:\.\d+)?/g, ' ').replace(/×\s*\d+(?:\.\d+)?/g, ' ').replace(/\d+(?:\.\d+)?\s*เท่า/g, ' ') };
}

type Row = Table['rows'][number];

/** Index of the column whose header starts with one of the names (exact match first). */
function col(t: Table, ...names: string[]): number {
  for (const n of names) {
    const i = t.header.findIndex((h) => clean(h) === n);
    if (i >= 0) return i;
  }
  for (const n of names) {
    const i = t.header.findIndex((h) => clean(h).startsWith(n));
    if (i >= 0) return i;
  }
  return -1;
}
const cell = (r: Row, i: number) => (i >= 0 ? (r.cells[i] ?? '') : '');

const tcache = new Map<string, Table[]>();
function tbls(file: string): Table[] {
  let t = tcache.get(file);
  if (!t) tcache.set(file, (t = tables(file)));
  return t;
}
/** First table of a file whose heading path contains `h`. */
function byHeading(file: string, h: string, nth = 0): Table {
  const hit = tbls(file).filter((t) => t.headings.join(' > ').includes(h));
  if (!hit[nth]) throw new Error(`${file}: no table under "${h}"`);
  return hit[nth];
}
function byHeader(file: string, first: string, nth = 0): Table {
  const hit = tbls(file).filter((t) => clean(t.header[0]) === first);
  if (!hit[nth]) throw new Error(`${file}: no table with first header "${first}"`);
  return hit[nth];
}

// ---------- ids, refs, races ----------

const RACE_ORDER = [
  'human', 'elf', 'darkelf', 'dwarf', 'orc', 'halfling', 'beast', 'naga', 'dragonkin', 'vampire', 'fae',
  'slime', 'demonkin', 'merfolk', 'winged', 'giant', 'lavakin', 'construct', 'soulmachine', 'mummy', 'ghoul',
];
const RACE_NAME: Record<string, RaceId> = {};
const raceNames: Record<RaceId, string> = {};
// filled from races/README.md in buildRaces(); also a few spellings used elsewhere
function registerRaceNames(t: Table) {
  t.rows.forEach((r, i) => {
    const id = RACE_ORDER[i];
    const name = clean(r.cells[1]);
    RACE_NAME[name] = id;
    raceNames[id] = name;
  });
  RACE_NAME['มังกรร่างคน'] = 'dragonkin';
}
const raceId = (name: string): RaceId | null => RACE_NAME[clean(name).replace(/★/g, '').trim()] ?? null;
/** Race ids found in a free text, longest names first, in order of appearance. */
function racesIn(text: string): RaceId[] {
  const names = Object.keys(RACE_NAME).sort((a, b) => b.length - a.length);
  const found: { at: number; id: RaceId }[] = [];
  let rest = text;
  for (const n of names) {
    let from = 0;
    for (;;) {
      const at = rest.indexOf(n, from);
      if (at < 0) break;
      // a name followed by a Thai letter is a longer word (เอลฟ์ฟ้า is a subline of elf, not elf)
      if (/[ก-ฮะ-ฺเ-ๆ]/.test(rest[at + n.length] ?? ' ')) {
        from = at + 1;
        continue;
      }
      found.push({ at, id: RACE_NAME[n] });
      rest = rest.slice(0, at) + ' '.repeat(n.length) + rest.slice(at + n.length);
      from = at + n.length;
    }
  }
  return uniq(found.sort((a, b) => a.at - b.at).map((f) => f.id));
}

const CONTINENT_NAME: Record<string, ContinentId> = {
  อัซการ์: 'AZ', มอร์เฮเวน: 'MH', 'คาซ-ดูรัม': 'KD', เนเรีย: 'NR', อัลเดรีย: 'AL', เมคาเรีย: 'MK', ซาฮารัน: 'SH', ซิลวาเนล: 'SV', เนบูเลีย: 'NB',
};
const CONTINENT_ORDER: ContinentId[] = ['AZ', 'MH', 'KD', 'NR', 'AL', 'MK', 'SH', 'SV', 'NB'];

const COUNTRY_RE = /\b([A-Z]{2})-(\d\d)\b/g;
/** Country codes in a text; `AL-01 ถึง AL-28` is expanded. */
function countriesIn(text: string): CountryId[] {
  const out: CountryId[] = [];
  let rest = text;
  for (const m of text.matchAll(/\b([A-Z]{2})-(\d\d)\s*ถึง\s*\1-(\d\d)\b/g)) {
    for (let i = Number(m[2]); i <= Number(m[3]); i++) out.push(`${m[1]}-${String(i).padStart(2, '0')}`);
    rest = rest.replace(m[0], ' ');
  }
  for (const m of rest.matchAll(COUNTRY_RE)) out.push(m[0]);
  return uniq(out).filter((c) => ids.countries.has(c)); // `SR-59` and `DR-01` look like countries; they are a rule and an event
}

function refsOf(text: string): Refs {
  const events: string[] = [];
  const countries: string[] = [];
  const nodes: string[] = [];
  const idList: string[] = [];
  for (const m of text.matchAll(/\b((?:NF-)?[A-Z]{2,4}-\d{2})\b/g)) {
    if (ids.events.has(m[1])) events.push(m[1]);
    else if (ids.countries.has(m[1])) countries.push(m[1]);
  }
  for (const m of text.matchAll(/\b([a-z]{2}\.[btaelx]\d+|cv\.\d+)\b/g)) nodes.push(m[1]);
  for (const m of text.matchAll(/`([^`\s]+)`/g)) idList.push(m[1].replace(/^#/, ''));
  for (const m of text.matchAll(/\b((?:nb|nc|ns|pa|sp|cs|b|c|u)_[a-z0-9_*]+)\b/g)) idList.push(m[1]);
  return { events: uniq(events), countries: uniq(countries), nodes: uniq(nodes), ids: uniq(idList) };
}

// ---------- the code-style effect string: `pow+2 #tag belief+20` ----------

function fxCode(raw: string, at: string): Effect[] {
  const out: Effect[] = [];
  for (const tok of raw.trim().split(/\s+/)) {
    if (!tok || tok === '—' || tok === '-') continue;
    let m: RegExpMatchArray | null;
    if ((m = tok.match(/^#([a-z_0-9]+)$/))) out.push({ k: 'grant', kind: 'tag', id: m[1] });
    else if ((m = tok.match(/^\+flag:([a-z_0-9]+)$/))) out.push({ k: 'grant', kind: 'flag', id: m[1] });
    else if ((m = tok.match(/^([a-z_]+)([+\-−])(\d+(?:\.\d+)?)$/))) out.push({ k: 'stat', stat: m[1], delta: (m[2] === '+' ? 1 : -1) * Number(m[3]) });
    else unp.add(at.split(':')[0], Number(at.split(':')[1]), tok, 'code-style effect token not read');
  }
  return out;
}

// ---------- conditions in prose: `ปัญญา 13` `#necro หรือ #lich_seed` `hu.a6 ทาง ค` ----------

const STAT_NAMES: Record<string, string> = {
  กำลัง: 'pow', เวท: 'mag', ความเร็ว: 'spd', เร็ว: 'spd', โชค: 'luk', ปัญญา: 'int', ความทนทาน: 'vit', ทน: 'vit',
  กล้าหาญ: 'brave', เมตตา: 'kind', ทะเยอทะยาน: 'ambition', ศรัทธา: 'piety', อยากรู้: 'curious', ซื่อสัตย์: 'honest', โทสะ: 'temper', เข้าสังคม: 'social',
  ศรัทธาเทพ: 'godFaith', ชื่อเสียง: 'fame', เงิน: 'gold', ทอง: 'gold',
};
const STAT_RE = Object.keys(STAT_NAMES).sort((a, b) => b.length - a.length).join('|');
const PATH_KEY: Record<string, 'a' | 'b' | 'c'> = { ก: 'a', ข: 'b', ค: 'c' };
let RACE_TAGS = new Set<string>();

function splitTop(s: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  const re = new RegExp(sep.source, 'y');
  for (let i = 0; i < s.length; ) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0) {
      re.lastIndex = i;
      const m = re.exec(s);
      if (m && m[0].length) {
        out.push(cur);
        cur = '';
        i += m[0].length;
        continue;
      }
    }
    cur += ch;
    i++;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
const and = (of: CharCond[]): CharCond => (of.length === 1 ? of[0] : { k: 'and', of });
const or = (of: CharCond[]): CharCond => (of.length === 1 ? of[0] : { k: 'or', of });

/** ids.kind reads `nb_`/`nc_` as skills (the glossary groups them); in the character docs they are the new blessings and curses. */
function kindOf(id: string): IdKind {
  if (id.startsWith('nb_')) return 'blessing';
  if (id.startsWith('nc_')) return 'curse';
  return ids.kind(id);
}
function fixKinds<T extends Effect>(effects: T[]): T[] {
  return effects.map((e) => (e.k === 'grant' && e.kind !== 'tag' ? { ...e, kind: kindOf(e.id) } : e)) as T[];
}

function hasOf(id: string): CharCond {
  if (id.startsWith('#')) return { k: 'has', kind: 'tag', id: id.slice(1) };
  if (RACE_TAGS.has(id)) return { k: 'has', kind: 'tag', id };
  if (/\*$/.test(id)) return { k: 'has', kind: id.startsWith('nb_') ? 'blessing' : 'unknown', id };
  const lvl = ids.aptLevel(id);
  if (lvl) return { k: 'has', kind: 'skill', id };
  return { k: 'has', kind: kindOf(id), id };
}

function atom(raw: string, file: string, line: number): CharCond {
  let s = raw.trim().replace(/^ต้อง(?:มี)?\s*/, '').replace(/^(?:ผู้ที่)?มี\s*/, '').replace(/^ผู้ที่\s*/, '');
  if (!s) return { k: 'text', text: raw.trim() };
  // grouping
  if (s.startsWith('(') && s.endsWith(')')) {
    const inner = s.slice(1, -1);
    // only when the parentheses wrap the whole text
    let d = 0;
    let whole = true;
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i] === '(') d++;
      else if (s[i] === ')') d--;
      if (d === 0) {
        whole = false;
        break;
      }
    }
    if (whole) return expr(inner, file, line);
  }
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(?:อยู่เมือง\s*)?([WGM])\s*(≥|≤|>|<)\s*(\d+)$/))) return { k: 'stat', stat: `country.${m[1]}`, op: (m[2] === '≥' ? '>=' : m[2] === '≤' ? '<=' : m[2]) as '>=' | '<=' | '>' | '<', value: Number(m[3]) };
  // a condition followed by a remark in parentheses, or a label followed by the real condition: `ชั้น 3 ขึ้นไป (…)` `อ่านออก (ปัญญา 8 ขึ้นไป)`
  if ((m = s.match(/^([^()]+?)\s*\((.+)\)$/)) && !/^\d/.test(m[2])) {
    const base = atom(m[1], file, line);
    if (base.k !== 'text') return base;
    const inner = atom(m[2], file, line);
    if (inner.k !== 'text') return /ไม่มี|ไม่ถูก|ไม่ได้|ไม่อยู่|ไม่ใช่/.test(m[1]) ? { k: 'not', of: inner } : inner;
  }
  // stat comparisons
  if ((m = s.match(new RegExp(`^(?:ค่า)?(${STAT_RE})(?:เริ่มต้น|ขั้นต่ำ|ในหมู่โจร)?\\s*(≥|≤|>|<)?\\s*([+\\-−]?\\d+)\\s*(?:ขึ้นไป)?$`)))) {
    const op = m[2] === '≥' || !m[2] ? '>=' : m[2] === '≤' ? '<=' : m[2];
    return { k: 'stat', stat: STAT_NAMES[m[1]], op: op as '>=' | '<=' | '>' | '<', value: toNum(m[3]) };
  }
  if ((m = s.match(/^ชื่อเสียงในหมู่โจร\s*≥\s*(\d+)$/))) return { k: 'stat', stat: 'fame.thief', op: '>=', value: Number(m[1]) };
  if ((m = s.match(/^เงิน(?:ทุน)?(?:เริ่มต้น)?\s*(\d+)(?:\s*ขึ้นไป)?$/))) return { k: 'stat', stat: 'gold', op: '>=', value: Number(m[1]) };
  if ((m = s.match(/^ชั้น\s*(\d)\s*ถึง\s*(\d)$/))) return { k: 'class', min: Number(m[1]), max: Number(m[2]) };
  if ((m = s.match(/^ชั้น\s*(\d)\s*ขึ้นไป$/))) return { k: 'class', min: Number(m[1]) };
  if ((m = s.match(/^อายุ\s*(\d+)\s*ถึง\s*(\d+)$/))) return { k: 'age', min: Number(m[1]), max: Number(m[2]) };
  if ((m = s.match(/^อายุ\s*(\d+)\s*ขึ้นไป$/))) return { k: 'age', min: Number(m[1]) };
  if (/^(?:เป็น)?ลูกครึ่ง$/.test(s)) return { k: 'half' };
  // node (with a path)
  if ((m = s.match(/^(?:ทางเปิด\s*)?([a-z]{2}\.[btaelx]\d+|cv\.\d+)(?:\s*ทาง\s*([กขค]))?$/)))
    return m[2] ? { k: 'node', id: m[1], choice: PATH_KEY[m[2]] } : { k: 'node', id: m[1] };
  // flag / job / skill words in front of a backticked id
  if ((m = s.match(/^(ธง|อาชีพ|skill|ความถนัด|พร|คำสาป|แท็ก)\s*`([^`]+)`(?:\s*(?:ระดับ\s*(\d))?(?:\s*ขึ้นไป)?)?$/))) {
    const id = m[2];
    const kind: IdKind = m[1] === 'ธง' ? 'flag' : m[1] === 'อาชีพ' ? 'job' : m[1] === 'ความถนัด' ? 'aptitude' : m[1] === 'พร' ? 'blessing' : m[1] === 'คำสาป' ? 'curse' : ids.aptLevel(id) ? 'skill' : kindOf(id);
    return { k: 'has', kind, id: m[3] ? `${id}_${m[3]}` : id };
  }
  // backticked id, with an optional level
  if ((m = s.match(/^`([^`]+)`(?:\s*ระดับ\s*(\d)(?:\s*ขึ้นไป)?)?(?:\s+(?:ที่ยังอยู่|ที่ไม่ยอมรับคำเรียก|อย่างน้อยหนึ่งตัว))?$/))) {
    const base = hasOf(m[1]) as Extract<CharCond, { k: 'has' }>;
    return m[2] ? { ...base, id: `${m[1]}_${m[2]}`, kind: base.kind === 'skill' ? 'skill' : 'skill' } : base;
  }
  if ((m = s.match(/^(?:ที่ไม่ใช่|ไม่ใช่)\s*`([^`]+)`$/))) return { k: 'not', of: hasOf(m[1]) };
  // races
  const asRaces = s.replace(/^เผ่า(?=\S)/, '');
  if (raceId(s) || raceId(asRaces)) return { k: 'race', ids: [raceId(s) ?? raceId(asRaces)!] };
  const parts = s.split(/\s+/);
  if (parts.length > 1 && parts.every((p) => raceId(p))) return { k: 'race', ids: parts.map((p) => raceId(p)!) };
  if ((m = s.match(/^(?:เผ่า)?(\S+)\s+หรือ\s+(?:เผ่า)?(\S+)$/)) && raceId(m[1]) && raceId(m[2])) return { k: 'race', ids: [raceId(m[1])!, raceId(m[2])!] };
  if ((m = s.match(/^อาชีพ\s+([a-z_]+)$/))) return { k: 'has', kind: 'job', id: m[1] };
  // countries
  const cs = countriesIn(s);
  if (cs.length) return { k: 'country', ids: cs };
  const evs = refsOf(s).events;
  if (evs.length) {
    const neg = /ไม่|ยังไม่/.test(s);
    const of = evs.map((id): CharCond => ({ k: 'event', id, happened: !neg }));
    return neg && of.length > 1 ? { k: 'and', of } : or(of);
  }
  const text = clean(s);
  const mm = mulOf(text);
  if (/\d|%|≥|≤/.test(mm.rest.replace(/\b[a-z]{2}\.[btaelx]\d+\b/g, '').replace(/\b[A-Z]{2}\d{2}-\d\b/g, '').replace(/\b[A-Z]{2,4}-\d{1,2}\b/g, ''))) unp.add(file, line, text, 'condition with a number not read');
  return { k: 'text', text };
}

function expr(raw: string, file: string, line: number): CharCond {
  const ands = splitTop(raw, /\s+·\s+|\s+และ\s*|(?<=[`)])\s*และ\s*/).map((a) => {
    const ors = splitTop(a, /\s+หรือ\s*/);
    return or(ors.map((o) => atom(o, file, line)));
  });
  return and(ands);
}

/** A list of conditions (all must hold) from a ` · `-separated cell. `—` and empty give []. */
function condList(text: string, file: string, line: number): CharCond[] {
  const t = text.trim();
  if (!t || t === '—' || t === '-') return [];
  return splitTop(t, /\s+·\s+/).map((p) => expr(p, file, line));
}

/** Conditions from a "where it comes from" cell: born on a continent, an event happened, a backticked id. */
function condFrom(text: string, file: string, line: number): CharCond[] {
  const out: CharCond[] = [];
  const cont: ContinentId[] = [];
  for (const [n, id] of Object.entries(CONTINENT_NAME)) if (text.includes('เกิดใน' + n) || text.includes('ใน' + n)) cont.push(id);
  if (cont.length) out.push({ k: 'continent', ids: cont });
  const ageM = text.match(/อายุ\s*(\d+)\s*ถึง\s*(\d+)/);
  if (ageM) out.push({ k: 'age', min: Number(ageM[1]), max: Number(ageM[2]) });
  const jobM = text.match(/อาชีพ\s+((?:[a-z_]+\s*)+)/);
  if (jobM) out.push(or(words(jobM[1]).map((j): CharCond => ({ k: 'has', kind: 'job', id: j }))));
  const r = refsOf(text);
  for (const e of r.events) out.push({ k: 'event', id: e, happened: true });
  if (r.countries.length) out.push({ k: 'country', ids: r.countries });
  for (const n of r.nodes) out.push({ k: 'node', id: n });
  for (const i of r.ids) if (!i.endsWith('*')) out.push(hasOf(i));
  if (!out.length && clean(text) && clean(text) !== '—') out.push({ k: 'text', text: clean(text) });
  void file;
  void line;
  return out;
}

// ---------- paragraph reader for the races/ files ----------

function sections(file: string): { head: string; lines: { text: string; line: number }[] }[] {
  const out: { head: string; lines: { text: string; line: number }[] }[] = [];
  let cur: (typeof out)[number] | null = null;
  readDoc(file)
    .split('\n')
    .forEach((text, i) => {
      const h = text.match(/^##\s+(.*)$/);
      if (h) out.push((cur = { head: h[1].trim(), lines: [] }));
      else if (cur) cur.lines.push({ text, line: i + 1 });
    });
  return out;
}

// =====================================================================================================================
// races.json
// =====================================================================================================================

const CLIMATE: Record<string, string> = {
  ทุ่งอบอุ่น: 'temperate', ป่าดิบ: 'tropical', ทะเลทราย: 'desert', ดินแดนน้ำแข็ง: 'frozen', ภูเขาไฟ: 'volcanic', หมู่เกาะ: 'islands',
};
const AXIS_NAME: Record<string, string> = {
  กล้าหาญ: 'brave', เมตตา: 'kind', ทะเยอทะยาน: 'ambition', ศรัทธา: 'piety', อยากรู้: 'curious', ซื่อสัตย์: 'honest', โทสะ: 'temper', เข้าสังคม: 'social',
};
const STAT_KEYS: StatKey[] = ['pow', 'mag', 'spd', 'luk', 'int', 'vit'];

function parseAxis(text: string, file: string, line: number): { axis: Race['axisShift']; birthStat: Race['birthStat'] } {
  const axis: Race['axisShift'] = {};
  const birthStat: Race['birthStat'] = {};
  for (const part of dot(text)) {
    let m: RegExpMatchArray | null;
    if ((m = part.match(/^(\S+)\s*([+\-−]\d+)$/)) && AXIS_NAME[m[1]]) (axis as Record<string, number>)[AXIS_NAME[m[1]]] = toNum(m[2]);
    else if ((m = part.match(/^(\S+)\s*\(ค่าสถานะ\)\s*([+\-−]\d+)\s*ตอนเกิด$/)) && STAT_NAMES[m[1]]) (birthStat as Record<string, number>)[STAT_NAMES[m[1]]] = toNum(m[2]);
    else unp.add(file, line, part, 'race axis shift not read');
  }
  return { axis, birthStat };
}

function buildSublines(raceKey: RaceId, n: number, mist: { lifespan: [number, number]; rate: number; adult: number; elder: number; gap: number } | null): Subline[] {
  const file = `docs/lore/races/${String(n).padStart(2, '0')}-${raceKey}.md`;
  const hit = tbls(file).filter((t) => t.headings.some((h) => h.startsWith('สายเลือดย่อย')));
  if (!hit.length) return [];
  const t = hit[0];
  const cName = col(t, 'สาย');
  const cHome = col(t, 'ที่อยู่');
  const cNote = col(t, 'ลักษณะ');
  return t.rows.map((r, i) => {
    const s: Subline = {
      id: `sub_${raceKey}_${i + 1}`,
      name: clean(cell(r, cName)),
      home: clean(cell(r, cHome)),
      countries: countriesIn(cell(r, cHome)),
      note: clean(cell(r, cNote)),
    };
    if (mist && s.name === 'ชาวหมอก') {
      s.lifespan = mist.lifespan;
      s.worldYearsPerLifeYear = mist.rate;
      s.adultAge = mist.adult;
      s.elderAge = mist.elder;
      s.gap = mist.gap;
    }
    return s;
  });
}

function bullets(sec: { lines: { text: string; line: number }[] } | undefined): { name: string; text: string; line: number }[] {
  if (!sec) return [];
  const out: { name: string; text: string; line: number }[] = [];
  for (const l of sec.lines) {
    const m = l.text.match(/^-\s+\*\*(.+?)\*\*\s*(.*)$/);
    if (m) out.push({ name: clean(m[1]), text: clean(m[2]), line: l.line });
  }
  return out;
}

function buildRaces(): RacesFile {
  const readme = 'docs/systems/character/races/README.md';
  const t0 = byHeader(readme, '#');
  registerRaceNames(t0);
  const wt = tbls(WORLD_TIME).find((t) => clean(t.header[0]) === 'เผ่า' && t.header.some((h) => h.includes('อายุขัย (ปีโลก)')))!;
  const wtRow = new Map<string, Row>();
  let mist: Parameters<typeof buildSublines>[2] = null;
  for (const r of wt.rows) {
    const id = raceId(r.cells[0]);
    if (id) wtRow.set(id, r);
    else if (r.cells[0].startsWith('ชาวหมอก'))
      mist = { lifespan: rng(r.cells[1]), rate: Number(r.cells[2]), adult: Number(r.cells[3]), elder: Number(r.cells[4]), gap: Number(r.cells[5]) };
    else throw new Error(`world-time: unknown race row ${r.cells[0]}`);
  }
  const wtText = readDoc(WORLD_TIME);
  const wakeDivisor = Number(wtText.match(/อายุขัย\s*÷\s*(\d+)\s*ปีโลก\s*\(ช่วงอายุเทียบมนุษย์ 17 ถึง 75\)/)?.[1] ?? 58);
  const normalDivisor = Number(wtText.match(/อายุขัยของตัวละครคนนั้น หารด้วย (\d+) ปีโลก/)?.[1] ?? 75);

  // 01-origin
  const origin = D + '01-origin.md';
  const stepsT = byHeading(origin, '1. ลำดับการสุ่มเกิด');
  const wakeRow = stepsT.rows.find((r) => r.cells[0] === '1ง')!;
  const wakers = new Set(racesIn(wakeRow.cells[1]));
  const shareT = byHeading(origin, '2. สัดส่วนเผ่า');
  const share = new Map<RaceId, number>();
  for (const r of shareT.rows) for (let i = 0; i < r.cells.length; i += 2) share.set(raceId(r.cells[i])!, Number(r.cells[i + 1]));
  const genderT = byHeading(origin, 'เพศ');
  const genderOf = genderTable(genderT);

  // 02
  const affA = byHeading(D + '02-race-affinity.md', 'ก. นิสัยและความถนัด');
  const affB = byHeading(D + '02-race-affinity.md', 'ข. พรและคำสาป');
  const affRow = new Map<RaceId, Row>();
  const fromCode = new Set<RaceId>();
  for (const r of affA.rows) {
    const id = raceId(r.cells[0])!;
    affRow.set(id, r);
    if (r.cells[0].includes('★')) fromCode.add(id);
  }
  const affBRow = new Map<RaceId, Row>();
  for (const r of affB.rows) affBRow.set(raceId(r.cells[0])!, r);
  const affText = readDoc(D + '02-race-affinity.md');
  const affinityRules = {
    plusWeight: Number(affText.match(/\*\*เสริม\*\*[^\n]*?เพิ่ม\s*([\d.]+)\s*เท่า/)?.[1] ?? 2),
    minusWeight: Number(affText.match(/\*\*ต้าน\*\*[^\n]*?เหลือ\s*([\d.]+)\s*เท่า/)?.[1] ?? 0.4),
    ban: 0,
  };

  // 03
  const syn = D + '03-synergy-rules.md';
  const tagT = byHeader(syn, 'เผ่า');
  const tagRow = new Map<RaceId, Row>();
  for (const r of tagT.rows) tagRow.set(raceId(r.cells[0])!, r);
  RACE_TAGS = new Set(tagT.rows.flatMap((r) => words(r.cells[1].replace(/\*\*/g, ''))));
  const tagMeanings: RaceTagMeaning[] = [];
  for (const l of readDoc(syn).split('\n')) {
    if (!l.startsWith('ความหมายของแท็กใหม่:')) continue;
    for (const p of l.replace('ความหมายของแท็กใหม่:', '').split(/\s+·\s+/)) {
      const m = p.match(/^\s*`([^`]+)`\s*(.*)$/);
      if (m) tagMeanings.push({ tag: m[1], text: clean(m[2]) });
    }
  }

  // 08
  const bonusT = byHeading(D + '08-jobs-overview.md', '5. โบนัสเผ่า');
  const bonus = new Map<RaceId, string[]>();
  for (const r of bonusT.rows) bonus.set(raceId(r.cells[0])!, words(r.cells[1]));

  const races: Race[] = t0.rows.map((r, i) => {
    const id = RACE_ORDER[i];
    const nn = String(i + 1).padStart(2, '0');
    const file = `docs/systems/character/races/${nn}-${id}.md`;
    const w = wtRow.get(id)!;
    const wakes = wakers.has(id);
    const a = affRow.get(id)!;
    const b = affBRow.get(id)!;
    const t = tagRow.get(id)!;
    const newTags = [...t.cells[1].matchAll(/\*\*([a-z_]+)\*\*/g)].map((m) => m[1]);
    const ax = parseAxis(a.cells[2], D + '02-race-affinity.md', a.line);
    const secs = sections(file);
    const sec = (h: string) => secs.find((s) => s.head.startsWith(h));
    const gifts = (head: string, prefix: string): RaceGift[] => {
      const tb = tbls(file).find((x) => x.headings.some((h) => h.startsWith(head)))!;
      return tb.rows.map((row) => ({
        id: `${prefix}_${id}_${clean(row.cells[1]).toLowerCase()}`,
        name: clean(row.cells[0]),
        tier: clean(row.cells[1]) as Rarity,
        text: clean(row.cells[2]),
      }));
    };
    const skills: RaceSkill[] = bullets(sec('สกิลเฉพาะเผ่า')).map((x, k) => ({ id: `rs_${id}_${k + 1}`, name: x.name, text: x.text }));
    const powers = bullets(sec('ความสามารถประจำเผ่า')).map((x) => ({ name: x.name, text: x.text }));
    const notes: string[] = [];
    for (const s of secs) {
      const main = ['ความสามารถประจำเผ่า', 'พรเฉพาะเผ่า', 'คำสาปเฉพาะเผ่า', 'สกิลเฉพาะเผ่า'].some((h) => s.head.startsWith(h));
      for (const l of s.lines) {
        const tx = l.text.trim();
        if (!tx || /^\|\s*:?-{3,}/.test(tx)) continue;
        if (main && (tx.startsWith('|') || tx.startsWith('- '))) continue;
        if (s.head.startsWith('ช่วงค่าสถานะเริ่มต้น') && tx.startsWith('|')) continue;
        notes.push(clean(tx.startsWith('|') ? cellsOf(tx).join(' | ') : tx));
      }
    }
    return {
      id,
      n: i + 1,
      name: clean(r.cells[1]),
      storyPrefix: storyPrefix(i + 1, id),
      stats: Object.fromEntries(STAT_KEYS.map((k, j) => [k, rng(r.cells[2 + j])])) as Race['stats'],
      lifespan: rng(w.cells[1]),
      worldYearsPerLifeYear: Number(w.cells[2]),
      adultAge: Number(w.cells[3]),
      elderAge: Number(w.cells[4]),
      generationGap: /\d/.test(w.cells[5]) ? Number(w.cells[5]) : null,
      wakes,
      lifeYearDivisor: wakes ? wakeDivisor : normalDivisor,
      sharePct: share.get(id)!,
      gender: genderOf(id),
      tags: words(t.cells[1].replace(/\*\*/g, '')),
      newTags,
      axisShift: ax.axis,
      ...(Object.keys(ax.birthStat ?? {}).length ? { birthStat: ax.birthStat } : {}),
      traitPlus: words(a.cells[3]),
      traitMinus: words(a.cells[4]),
      aptPlus: words(a.cells[5]),
      aptMinus: words(a.cells[6]),
      likes: words(a.cells[7]).map((x) => CLIMATE[x] ?? x),
      dislikes: words(a.cells[8]).map((x) => CLIMATE[x] ?? x),
      blessPlus: words(b.cells[1]),
      cursePlus: words(b.cells[2]),
      blessClash: words(b.cells[3]),
      curseClash: words(b.cells[4]),
      jobBonus: bonus.get(id) ?? [],
      powers,
      blessings: gifts('พรเฉพาะเผ่า', 'rb'),
      curses: gifts('คำสาปเฉพาะเผ่า', 'rc'),
      skills,
      sublines: buildSublines(id, i + 1, id === 'human' ? mist : null),
      notes,
      fromCode: fromCode.has(id),
      src: src(file, 1),
    };
  });

  // 02 §ค
  const ovT = byHeading(D + '02-race-affinity.md', 'ค. ผลที่ต่างกัน');
  const overrides: RaceOverride[] = ovT.rows.map((r) => ({
    of: idOf(r.cells[0]),
    races: racesIn(r.cells[1]),
    raceText: clean(r.cells[1]),
    text: clean(r.cells[2]),
    src: src(D + '02-race-affinity.md', r.line),
  }));

  // 03 rules
  const synergy: SynergyRule[] = [];
  for (const t of tbls(syn)) {
    if (clean(t.header[0]) !== 'ID') continue;
    const group = clean(t.headings[t.headings.length - 1]);
    const cC = col(t, 'เงื่อนไข');
    const cE = col(t, 'ผล');
    const cW = col(t, 'เหตุผล');
    for (const r of t.rows) {
      const cond = r.cells[cC];
      const eff = r.cells[cE];
      const line = r.line;
      const mm = mulOf(unlink(eff));
      const mul = mm.mul;
      const p = parseCell(unlink(eff), ids);
      for (const u of p.unparsed) {
        if (!/\d|%/.test(mulOf(u).rest)) continue;
        unp.add(syn, line, u, 'synergy effect with a number not read');
      }
      const rule: SynergyRule = {
        id: clean(r.cells[0]),
        group,
        cond: clean(cond),
        effect: clean(eff),
        why: clean(cell(r, cW)),
        effects: fixKinds(p.effects),
        refs: refsOf(cond + ' ' + eff),
        src: src(syn, line),
      };
      const tm = cond.split('เป้าหมายมี');
      const tagsOf = (x: string) => uniq([...x.matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/^#/, '')));
      if (tm.length === 2) {
        if (tm[0].includes('ผู้โจมตีมี')) rule.attacker = tagsOf(tm[0]);
        rule.target = tagsOf(tm[1].split('(')[0]);
      }
      if (mul !== null) rule.mul = mul;
      synergy.push(rule);
    }
  }
  return { races, tagMeanings, overrides, synergy, affinityRules };
}

function cellsOf(line: string) {
  return line.split('|').slice(1, -1).map((c) => c.trim());
}

// The story prefix (`hu` in hu.b1) is read from docs/lore/storylines/NN-<race>.md but those files are left out of `sources` on purpose:
// the storylines are edited all the time and races.json should not change version for it.
let PREFIX: Record<string, string> | null = null;
function storyPrefix(n: number, id: string): string {
  if (!PREFIX) {
    PREFIX = {};
    for (const f of listStory()) {
      const m = readDoc(f).match(/\n\| ([a-z]{2})\.b1 \|/);
      if (m) PREFIX[f.split('/').pop()!.replace(/^\d+-/, '').replace(/\.md$/, '')] = m[1];
    }
  }
  const p = PREFIX[id];
  if (!p) throw new Error(`no story prefix for ${id} (#${n})`);
  return p;
}
function listStory(): string[] {
  return RACE_ORDER.map((id, i) => `docs/lore/storylines/${String(i + 1).padStart(2, '0')}-${id}.md`);
}

function genderTable(t: Table): (id: RaceId) => { m: number; f: number; n: number; note?: string } {
  const out: Record<string, { m: number; f: number; n: number; note?: string }> = {};
  const def = { m: 50, f: 50, n: 0 };
  for (const r of t.rows) {
    const names = racesIn(r.cells[0]);
    const nums = [r.cells[1], r.cells[2], r.cells[3]];
    if (nums.every((x) => /^\d+$/.test(x))) {
      const v = { m: Number(nums[0]), f: Number(nums[1]), n: Number(nums[2]) };
      if (!names.length) Object.assign(def, v);
      else for (const n of names) out[n] = v;
    } else {
      const text = clean(r.cells[1]);
      const m = text.match(/สุ่ม\s*(\d+)\s*ชาย\s*(\d+)\s*หญิง\s*(\d+)\s*ไร้เพศ/);
      for (const n of names) out[n] = m ? { m: Number(m[1]), f: Number(m[2]), n: Number(m[3]), note: text } : { ...def, note: text };
    }
  }
  return (id) => out[id] ?? { ...def };
}

// =====================================================================================================================
// traits · aptitudes · skills · blessings · curses
// =====================================================================================================================

function buildTraits(): { traits: Trait[]; tags: TagMeaning[] } {
  const f = CAT + 'traits.md';
  const t = byHeader(f, 'ID');
  const traits: Trait[] = t.rows.map((r) => ({
    id: clean(r.cells[0]),
    name: clean(r.cells[1]),
    fx: fxCode(r.cells[2], src(f, r.line)),
    fxRaw: clean(r.cells[2]),
    desc: clean(r.cells[3]),
    conflicts: [],
    src: 'code',
    at: src(f, r.line),
  }));
  const f12 = D + '12-job-support.md';
  const t12 = byHeading(f12, 'ข. นิสัยใหม่');
  const conflict12 = new Map<string, string[]>();
  for (const r of t12.rows) {
    const id = clean(r.cells[0]);
    traits.push({
      id,
      name: clean(r.cells[1]),
      fx: fxCode(r.cells[2], src(f12, r.line)),
      fxRaw: clean(r.cells[2]),
      desc: clean(r.cells[3]),
      conflicts: [],
      src: 'doc',
      at: src(f12, r.line),
    });
    conflict12.set(id, words(r.cells[4]));
  }
  const byId = new Map(traits.map((x) => [x.id, x]));
  const link = (a: string, b: string) => {
    const A = byId.get(a);
    const B = byId.get(b);
    if (!A || !B) {
      unp.add(f, 1, `${a} ⟂ ${b}`, 'trait conflict names an id that is not a trait');
      return;
    }
    if (!A.conflicts.includes(b)) A.conflicts.push(b);
    if (!B.conflicts.includes(a)) B.conflicts.push(a);
  };
  const ct = byHeading(f, 'นิสัยที่อยู่ร่วมกันไม่ได้');
  for (const r of ct.rows) link(idOf(r.cells[0]), idOf(r.cells[1]));
  for (const [id, cs] of conflict12) for (const c of cs) link(id, c);

  // tags
  const tags: TagMeaning[] = [];
  const tf = CAT + 'tags.md';
  for (const r of byHeader(tf, 'แท็ก').rows) tags.push({ tag: clean(r.cells[0]).replace(/^#/, ''), text: '', count: Number(r.cells[1]), src: 'code', at: src(tf, r.line) });
  for (const file of ['05-new-blessings.md', '06-new-curses.md']) {
    const nt = byHeading(D + file, 'แท็กใหม่');
    for (const r of nt.rows) {
      for (const m of r.cells[0].matchAll(/`#?([a-z_0-9]+)`/g)) {
        const hit = tags.find((x) => x.tag === m[1]);
        if (hit) {
          hit.text = clean(r.cells[1]);
          hit.src = 'doc';
          hit.at = src(D + file, r.line);
        } else tags.push({ tag: m[1], text: clean(r.cells[1]), src: 'doc', at: src(D + file, r.line) });
      }
    }
  }
  return { traits, tags };
}

const STAT_OF = (s: string): StatKey => {
  const v = clean(s);
  if (!STAT_KEYS.includes(v as StatKey)) throw new Error(`bad main stat "${s}"`);
  return v as StatKey;
};

function levelSplit(text: string): { name: string; effect: string } {
  const c = clean(text);
  const i = c.indexOf(': ');
  return i > 0 ? { name: c.slice(0, i).trim(), effect: c.slice(i + 2).trim() } : { name: c, effect: '' };
}

function buildAptitudes(): { apts: Aptitude[]; skills: Skill[] } {
  const f = CAT + 'aptitudes-skills.md';
  const eff = D + '04-skill-effects.md';
  // 04: play effect per level
  const effOf = new Map<string, string[]>();
  const groupOf = new Map<string, string>();
  const GROUP: Record<string, string> = { ความถนัดการต่อสู้: 'combat', ความถนัดเวท: 'magic', ความถนัดงานช่างและชีวิต: 'life' };
  for (const t of tbls(eff)) {
    if (clean(t.header[0]) !== 'ความถนัด') continue;
    const g = GROUP[clean(t.headings[t.headings.length - 1])] ?? clean(t.headings[t.headings.length - 1]);
    for (const r of t.rows) {
      const id = r.cells[0].match(/`([a-z_]+)`/)![1];
      effOf.set(id, [clean(r.cells[1]), clean(r.cells[2]), clean(r.cells[3])]);
      groupOf.set(id, g);
    }
  }
  const apts: Aptitude[] = [];
  const skills: Skill[] = [];
  const addApt = (r: Row, file: string, srcKind: 'code' | 'doc', group: string, split: boolean) => {
    const id = clean(r.cells[0]);
    const stat = STAT_OF(r.cells[2]);
    const lv = [r.cells[4], r.cells[5], r.cells[6]].map((x) => (split ? levelSplit(x) : { name: clean(x), effect: '' }));
    const e04 = effOf.get(id);
    const levels = lv.map((x, i) => ({ level: (i + 1) as 1 | 2 | 3, skill: `${id}_${i + 1}`, name: x.name, effect: e04 ? e04[i] : x.effect }));
    apts.push({ id, name: clean(r.cells[1]), stat, tags: words(r.cells[3]), group, levels, src: srcKind, at: src(file, r.line) });
    for (const l of levels)
      skills.push({
        id: l.skill,
        name: l.name,
        kind: 'apt',
        apt: id,
        level: l.level,
        stat,
        bonus: l.level,
        group,
        fx: [{ k: 'stat', stat, delta: l.level }],
        effect: l.effect || undefined,
        src: srcKind,
        at: src(file, r.line),
      });
  };
  for (const r of byHeading(f, 'ความถนัด', 0).rows) addApt(r, f, 'code', groupOf.get(clean(r.cells[0])) ?? '', false);
  const f12 = D + '12-job-support.md';
  for (const r of byHeading(f12, 'ก. ความถนัดใหม่').rows) addApt(r, f12, 'doc', 'job-support', true);
  for (const id of effOf.keys()) if (!apts.some((a) => a.id === id)) throw new Error(`04-skill-effects names an aptitude "${id}" that is not in the catalog`);
  return { apts, skills };
}

function buildUniqueSkills(): Skill[] {
  const f = CAT + 'aptitudes-skills.md';
  const eff = D + '04-skill-effects.md';
  const play = new Map<string, string>();
  for (const r of byHeader(eff, 'ID').rows) play.set(clean(r.cells[0]), clean(r.cells[2]));
  return byHeader(f, 'ID', 1).rows.map((r) => {
    const id = clean(r.cells[0]);
    return {
      id,
      name: clean(r.cells[1]),
      kind: 'unique' as const,
      group: 'unique',
      fx: fxCode(r.cells[2], src(f, r.line)),
      fxRaw: clean(r.cells[2]),
      effect: play.get(id),
      desc: clean(r.cells[3]),
      src: 'code' as const,
      at: src(f, r.line),
    };
  });
}

function buildNewSkills(): Skill[] {
  const out: Skill[] = [];
  const add = (file: string, kind: 'new' | 'companion') => {
    for (const t of tbls(file)) {
      if (clean(t.header[0]) !== 'ID' || !t.header.some((h) => h.includes('ความถนัดแม่'))) continue;
      const group = clean(t.headings[t.headings.length - 1]);
      const cFrom = col(t, 'เรียนได้จาก');
      for (const r of t.rows) {
        const learn = cell(r, cFrom);
        out.push({
          id: clean(r.cells[0]),
          name: clean(r.cells[1]),
          kind,
          apt: clean(r.cells[2]),
          group,
          fx: [],
          levels: [clean(r.cells[3]), clean(r.cells[4]), clean(r.cells[5])],
          learnFrom: countriesIn(learn),
          learnText: clean(learn),
          src: 'doc',
          at: src(file, r.line),
        });
      }
    }
  };
  add(D + '07-new-skills.md', 'new');
  add(D + '17-companion-support.md', 'companion');
  return out;
}

function giftFrom(t: Table, file: string, kind: 'b' | 'c', srcKind: 'code' | 'doc', groupOverride?: string): Gift[] {
  const cId = col(t, 'ID');
  const cName = col(t, 'ชื่อ');
  const cTier = col(t, 'ระดับ');
  const cPrice = col(t, 'ราคา');
  const cFx = col(t, 'ผล');
  const cDesc = col(t, 'คำอธิบาย');
  const cFrom = col(t, 'ได้จาก', 'เหตุการณ์', 'ผูกกับ', 'ศาสนา', 'ที่มา');
  const cWorld = col(t, 'ในโลก');
  const cCure = col(t, 'ทางพ้น');
  const cJobs = col(t, 'อาชีพที่ได้ง่ายขึ้น', 'อาชีพที่ได้ยากขึ้น');
  const group = groupOverride ?? clean(t.headings[t.headings.length - 1]);
  void kind;
  return t.rows.map((r) => {
    const at = src(file, r.line);
    const from = clean(cell(r, cFrom));
    return {
      id: clean(cell(r, cId)),
      name: clean(cell(r, cName)),
      tier: clean(cell(r, cTier)) as Rarity,
      ...(cPrice >= 0 ? { price: Number(cell(r, cPrice)) } : {}),
      fx: fxCode(cell(r, cFx), at),
      fxRaw: clean(cell(r, cFx)),
      desc: clean(cell(r, cDesc)),
      from,
      fromCond: from ? condFrom(cell(r, cFrom), file, r.line) : [],
      refs: refsOf(cell(r, cFrom) + ' ' + cell(r, cCure) + ' ' + cell(r, cWorld)),
      world: clean(cell(r, cWorld)),
      cure: clean(cell(r, cCure)),
      jobsText: clean(cell(r, cJobs)),
      jobs: [],
      group,
      src: srcKind,
      at,
    };
  });
}

function buildGifts(): { blessings: Gift[]; curses: Gift[] } {
  const blessings: Gift[] = [];
  const curses: Gift[] = [];
  const cb = CAT + 'blessings.md';
  const cc = CAT + 'curses.md';
  blessings.push(...giftFrom(byHeader(cb, 'ID'), cb, 'b', 'code', 'code'));
  curses.push(...giftFrom(byHeader(cc, 'ID'), cc, 'c', 'code', 'code'));
  const take = (file: string, into: Gift[], kind: 'b' | 'c', headingRe: RegExp) => {
    for (const t of tbls(file)) {
      if (clean(t.header[0]) !== 'ID') continue;
      if (!headingRe.test(t.headings.join(' > '))) continue;
      if (t.header.some((h) => h.includes('ความถนัดแม่'))) continue;
      into.push(...giftFrom(t, file, kind, 'doc'));
    }
  };
  take(D + '05-new-blessings.md', blessings, 'b', /พรใหม่/);
  take(D + '12-job-support.md', blessings, 'b', /ค\. พรใหม่/);
  take(D + '17-companion-support.md', blessings, 'b', /ข\. พรใหม่/);
  take(D + '06-new-curses.md', curses, 'c', /คำสาปใหม่/);
  take(D + '12-job-support.md', curses, 'c', /ง\. คำสาปใหม่/);
  take(D + '17-companion-support.md', curses, 'c', /ค\. คำสาปใหม่/);
  return { blessings, curses };
}

// =====================================================================================================================
// jobs.json
// =====================================================================================================================

function mustNum(text: string, re: RegExp, what: string): number {
  const m = text.match(re);
  if (!m) throw new Error(`jobs: cannot read ${what}`);
  return Number(m[1]);
}

function nodeRefs(text: string): { id: string; choice?: 'a' | 'b' | 'c' }[] {
  const out: { id: string; choice?: 'a' | 'b' | 'c' }[] = [];
  for (const m of text.matchAll(/([a-z]{2}\.[btaelx]\d+|cv\.\d+)(?:\s*ทาง\s*([กขค]))?/g)) out.push(m[2] ? { id: m[1], choice: PATH_KEY[m[2]] } : { id: m[1] });
  return out;
}

function jobStat(apts: string): { apts: string[]; mainStat?: StatKey } {
  const ws = words(apts);
  const stat = ws.find((w) => /^\(.*\)$/.test(w));
  const list = ws.filter((w) => !/^\(.*\)$/.test(w));
  const s = stat?.replace(/[()]/g, '');
  return { apts: list, ...(s && STAT_KEYS.includes(s as StatKey) ? { mainStat: s as StatKey } : {}) };
}

function buildJobs(raceJobBonus: Map<string, RaceId[]>): JobsFile {
  const jobs: Job[] = [];
  const f08 = D + '08-jobs-overview.md';
  const f09 = D + '09-jobs-common.md';
  const f10 = D + '10-jobs-secret.md';
  const f11 = D + '11-jobs-special.md';
  const t08 = readDoc(f08);
  const slowNames = (() => {
    const m = t08.match(/เพราะ(\S+?)และ(\S+?)อยู่ในหมวดบริการแต่นับเป็นชีวิตช้า/);
    return m ? [m[1], m[2]] : [];
  })();

  // 09: common
  for (const t of tbls(f09)) {
    if (clean(t.header[0]) !== 'ID') continue;
    const head = t.headings.join(' > ');
    const last = clean(t.headings[t.headings.length - 1]);
    const origin: Job['origin'] = head.includes('ก. อาชีพเดิม') ? 'code' : head.includes('ค. อาชีพที่ย้าย') ? 'from-secret' : head.includes('ง. อาชีพการค้า') ? 'trade' : 'new';
    const group = origin === 'new' ? last.replace(/\s*\(slow life\)/, '') : origin === 'code' ? 'เดิมในโค้ด' : origin === 'from-secret' ? 'ย้ายจากอาชีพลับ' : 'การค้า';
    const cApt = col(t, 'ความถนัด');
    const cReq = col(t, 'เงื่อนไขเพิ่มจากโลก');
    const cOpen = col(t, 'เส้นเรื่องที่เปิด');
    for (const r of t.rows) {
      const id = clean(r.cells[0]);
      const js = jobStat(cell(r, cApt));
      const name = clean(r.cells[1]);
      jobs.push({
        id,
        name,
        kind: 'common',
        tier: clean(r.cells[2]) as Rarity,
        group,
        origin,
        ...js,
        slow: group.startsWith('ชีวิตช้า') || slowNames.includes(name),
        reqText: clean(cell(r, cReq)),
        req: condList(cell(r, cReq), f09, r.line),
        banText: '',
        ban: [],
        opens: clean(cell(r, cOpen)),
        raceBonus: raceJobBonus.get(id) ?? [],
        src: src(f09, r.line),
      });
    }
  }

  // 10: secret
  const dirRow = new Map<string, Row>();
  for (const r of byHeading(f10, 'ง. ความยากและโอกาส', 1).rows) dirRow.set(clean(r.cells[0]), r);
  const secretText = readDoc(f10);
  const baseChance = mustNum(secretText, /โอกาสต่อปี = ([\d.]+)%/, 'secret base chance') / 100;
  for (const t of tbls(f10)) {
    if (clean(t.header[0]) !== 'ID' || !t.header.some((h) => h.includes('ข้อห้ามเพิ่มจากโลก'))) continue;
    const head = t.headings.join(' > ');
    const origin: Job['origin'] = head.includes('ก. อาชีพลับเดิม') ? 'code' : head.includes('ค. อาชีพลับของลูกครึ่ง') ? 'half-blood' : 'new';
    const group = clean(t.headings[t.headings.length - 1]);
    const cReq = col(t, 'เงื่อนไขในโค้ด', 'เงื่อนไข');
    const cBan = col(t, 'ข้อห้ามเพิ่มจากโลก');
    const cAfter = col(t, 'เส้นเรื่องหลังได้');
    for (const r of t.rows) {
      const id = clean(r.cells[0]);
      const d = dirRow.get(id);
      if (!d) throw new Error(`secret job ${id} has no row in the chance table`);
      const ban = cell(r, cBan).replace(/^ห้าม\s*/, '').replace(/^ต้องไม่มี\s*/, '');
      jobs.push({
        id,
        name: clean(r.cells[1]),
        kind: 'secret',
        group,
        origin,
        apts: [],
        slow: false,
        reqText: clean(cell(r, cReq)),
        req: condList(cell(r, cReq), f10, r.line),
        banText: clean(cell(r, cBan)),
        ban: ban.trim() === '—' ? [] : condList(ban, f10, r.line),
        opens: clean(cell(r, cAfter)),
        raceBonus: raceJobBonus.get(id) ?? [],
        direct: nodeRefs(d.cells[2]),
        assist: nodeRefs(d.cells[3]),
        linked: refsOf(d.cells[4]),
        baseChance,
        src: src(f10, r.line),
      });
    }
  }

  // 11: special
  for (const r of byHeader(f11, 'ID').rows) {
    const flag = (r.cells[3].match(/`([^`]+)`/) ?? [])[1] ?? '';
    const anchor = clean(r.cells[4]);
    const arrow = anchor.split('→');
    jobs.push({
      id: clean(r.cells[0]),
      name: clean(r.cells[1]),
      kind: 'special',
      group: 'พิเศษ',
      origin: 'special',
      apts: [],
      slow: false,
      reqText: clean(r.cells[2]),
      req: [...condFrom(r.cells[2], f11, r.line), ...(flag ? [{ k: 'has', kind: 'flag', id: flag } as CharCond] : [])],
      banText: '',
      ban: [],
      opens: '',
      raceBonus: [],
      flag,
      fromStory: clean(r.cells[2]),
      anchor: arrow[0].trim(),
      onLoss: arrow.length > 1 ? arrow.slice(1).join('→').trim() : '',
      does: clean(r.cells[5]),
      linked: refsOf(r.cells[2] + ' ' + r.cells[4]),
      src: src(f11, r.line),
    });
  }

  // rules
  const kindsT = byHeading(f08, '2. ประเภทของอาชีพ');
  const retireT = byHeading(f08, '4. ชีวิตช้า');
  const instT = byHeading(f08, '6. เงื่อนไขจากสถาบัน');
  const anchorT = byHeading(f08, '7. อาชีพตายหรือเปลี่ยน');
  const compT = byHeading(f08, '1. การเสนออาชีพทั่วไป');
  const rootRow = compT.rows.find((r) => r.cells[0].includes('ความหายาก'))!;
  const rarityRoot: Record<string, number> = {};
  for (const m of rootRow.cells[1].matchAll(/([CURE])\s*≈\s*([\d.]+)/g)) rarityRoot[m[1]] = Number(m[2]);
  const weightFormula = (t08.match(/```\n([\s\S]*?)```/) ?? [])[1]?.trim() ?? '';
  const secMul = byHeading(f10, 'ง. ความยากและโอกาส', 0);
  const secretMultipliers = secMul.rows.map((r) => {
    const m = r.cells[1].match(/×\s*([\d.]+)/);
    return { id: clean(r.cells[0]), text: clean(r.cells[1]), mul: m ? Number(m[1]) : null, when: clean(r.cells[2]) };
  });
  const f12 = D + '12-job-support.md';
  const bodyT = byHeading(f12, 'จ. ข้อจำกัดเชิงร่างกาย');
  const tagT = byHeading(f10, 'ฉ. ที่มาของแท็ก');
  const pathT = byHeading(f10, 'จ. ทางสู่อาชีพลับ', 0);
  const t12 = readDoc(f10);
  const rules: JobsFile['rules'] = {
    offerCount: mustNum(t08, /ระบบสุ่มเสนอ \*\*(\d+) อาชีพ/, 'offer count'),
    weightFormula,
    aptMatchWeight: mustNum(weightFormula, /ที่ตรง × (\d+)/, 'apt weight'),
    raceBonus: mustNum(compT.rows.find((r) => r.cells[0].includes('โบนัสเผ่า'))!.cells[1], /\+(\d+)/, 'race bonus'),
    rarityRoot,
    yearlyUpgradeChance: mustNum(t08, /ทุกปีที่ทำอาชีพ ตัวละครมีโอกาส (\d+)%/, 'upgrade chance') / 100,
    jobChangeChancePerYear: mustNum(t08, /ความน่าจะเป็น ([\d.]+)% ต่อปีในโค้ดเดิม/, 'change chance') / 100,
    slowLifeChangeChance: mustNum(t08, /มีโอกาสต่ำกว่า ([\d.]+)%/, 'slow change chance') / 100,
    freedomChangeChance: mustNum(t08, /สูงกว่า ([\d.]+)%/, 'freedom change chance') / 100,
    secretBaseChance: baseChance,
    secretMaxChance: mustNum(t12, /\(ไม่เกิน (\d+)%\)/, 'secret cap') / 100,
    secretRetryChance: mustNum(t12, /ปฏิเสธแล้วทอยใหม่ปีถัดไปด้วยฐาน ([\d.]+)%/, 'secret retry') / 100,
    secretMultipliers,
    retire: retireT.rows.map((r) => ({ cond: clean(r.cells[0]), why: clean(r.cells[1]) })),
    slowLife: {
      retireAge: mustNum(t08, /อายุ (\d+) ขึ้นไป และมีเงื่อนไขข้อใดข้อหนึ่ง/, 'retire age'),
      weightMul: mustNum(t08, /น้ำหนักอาชีพชีวิตช้า ×(\d+)/, 'slow weight'),
      hpRecover: mustNum(t08, /hp ฟื้น ×([\d.]+)/, 'hp recover'),
      incomeMul: /ชีวิตช้ารับเงินครึ่งหนึ่ง/.test(t08) ? 0.5 : mustNum('', /(x)/, 'slow income'),
    },
    institutionAlternatives: instT.rows.map((r) => ({ fail: clean(r.cells[0]), alt: clean(r.cells[1]) })),
    anchorLoss: anchorT.rows.map((r) => ({ lost: clean(r.cells[0]), becomes: clean(r.cells[1]) })),
    bodyLimits: bodyT.rows.map((r) => {
      const m = r.cells[2].match(/×\s*([\d.]+)/);
      return { group: clean(r.cells[0]), cond: clean(r.cells[1]), effect: clean(r.cells[2]), ...(m ? { mul: Number(m[1]) } : {}) };
    }),
    secretTagSources: tagT.rows.map((r) => ({ tag: clean(r.cells[0]).replace(/^#/, ''), usedIn: clean(r.cells[1]), from: clean(r.cells[2]), at: clean(r.cells[3]), chance: clean(r.cells[4]) })),
    directPaths: pathT.rows.map((r) => ({ job: clean(r.cells[0]), nodes: clean(r.cells[1]), why: clean(r.cells[2]) })),
    kinds: kindsT.rows.map((r) => ({ kind: clean(r.cells[0]), how: clean(r.cells[1]), offered: clean(r.cells[2]), godHint: clean(r.cells[3]) })),
  };
  void tagT;
  return { jobs, rules };
}

// =====================================================================================================================
// text blocks
// =====================================================================================================================

/** Non-empty, non-table lines under the first heading (any level) whose text matches `re`, until the next heading of the same or higher level. */
function block(file: string, re: RegExp): { text: string; line: number }[] {
  const lines = readDoc(file).split('\n');
  const out: { text: string; line: number }[] = [];
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      if (level && h[1].length <= level) break;
      if (!level && re.test(h[2])) level = h[1].length;
      continue;
    }
    if (!level) continue;
    const t = lines[i].trim();
    if (!t || t.startsWith('|') || t.startsWith('```')) continue;
    out.push({ text: t, line: i + 1 });
  }
  if (!level) throw new Error(`${file}: no heading matching ${re}`);
  return out;
}
const bulletLines = (b: { text: string }[]) => b.filter((l) => l.text.startsWith('- ')).map((l) => clean(l.text.slice(2)));
const proseLines = (b: { text: string }[]) => b.filter((l) => !l.text.startsWith('- ')).map((l) => clean(l.text));

// =====================================================================================================================
// fates.json
// =====================================================================================================================

function buildFates(): FatesFile {
  const f = D + '18-fates.md';
  const t = byHeading(f, '2. ชะตา 22 อย่าง');
  const fates: Fate[] = t.rows.map((r) => {
    const age = rng(r.cells[4]);
    return {
      id: clean(r.cells[0]),
      name: clean(r.cells[1]),
      good: clean(r.cells[2]) === 'ดี',
      tier: clean(r.cells[3]) as Rarity,
      age,
      eligible: clean(r.cells[5]),
      eligibleCond: condFrom(r.cells[5], f, r.line),
      omen: clean(r.cells[6]),
      question: clean(r.cells[7]),
      outcomes: dot(r.cells[8]).map(clean),
      links: [...r.cells[9].matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]).concat(refsOf(r.cells[9]).events),
      refs: refsOf(r.cells[5] + ' ' + r.cells[8] + ' ' + r.cells[9]),
      src: src(f, r.line),
    };
  });
  const rulesT = byHeading(f, '1. กติกา');
  const rules = rulesT.rows.map((r) => {
    const m = clean(r.cells[0]).match(/^(\d+)\s+(.*)$/)!;
    return { n: Number(m[1]), name: m[2], text: clean(r.cells[1]) };
  });
  const r1 = rules.find((x) => x.n === 1)!.text;
  const weights = {} as Record<Rarity, number>;
  for (const m of r1.matchAll(/\b([CURE])\s+([\d.]+)/g)) weights[m[1] as Rarity] = Number(m[2]);
  const cnt = r1.match(/(\d+)\s*ถึง\s*(\d+)\s*ชะตา/)!;
  const changed = tbls(f)[0];
  return {
    fates,
    rules,
    changedFromCode: changed.rows.map((r) => ({ code: clean(r.cells[0]), now: clean(r.cells[1]), why: clean(r.cells[2]) })),
    weights,
    count: [Number(cnt[1]), Number(cnt[2])],
    minGap: mustNum(rules.find((x) => x.n === 3)!.text, /อย่างน้อย (\d+) ปี/, 'fate gap'),
    omenLead: mustNum(rules.find((x) => x.n === 4)!.text, /ลางปรากฏ (\d+) ปี/, 'omen lead'),
  };
}

// =====================================================================================================================
// origin.json
// =====================================================================================================================

const CAUSE_ID: Record<string, string> = {
  ค้าขาย: 'trade', 'งานช่าง/วิชา': 'craft', ผู้ลี้ภัย: 'refugee', เชลยสงคราม: 'captive', สัญญา: 'contract', ถูกเนรเทศ: 'exile', ทูต: 'envoy', 'ความรัก/ชุมชนร่วม': 'love',
};
const SIGN_ID: Record<string, string> = {
  ดาวหาง: 'comet', สุริยคราส: 'eclipse', จันทร์เต็มดวง: 'fullmoon', พายุ: 'storm', กลางคืน: 'night', กลางวัน: 'day', รุ่งอรุณ: 'dawn', สนธยา: 'dusk', ไม่มี: 'none',
};

/** `AL-22 40 · SV-09 35` → picks; a range with one weight shares it equally. */
function placePicks(text: string): Pick<CountryId>[] {
  const out: Pick<CountryId>[] = [];
  for (const seg of dot(text)) {
    const noParen = seg.replace(/\([^)]*\)/g, ' ');
    const cs = countriesIn(noParen);
    if (!cs.length) continue;
    const rest = noParen.replace(/\b[A-Z]{2}-\d\d\b/g, ' ').replace(/ถึง/g, ' ');
    const w = numIn(rest);
    if (w === null) continue;
    for (const c of cs) out.push({ id: c, w: w / cs.length });
  }
  return out;
}
function racePicks(text: string, file: string, line: number): Pick<RaceId>[] {
  const out: Pick<RaceId>[] = [];
  for (const seg of dot(text)) {
    const m = seg.match(/^(.*?)\s+(\d+)$/);
    const id = m ? raceId(m[1]) : null;
    if (!m || !id) {
      unp.add(file, line, seg, 'half-blood partner not read');
      continue;
    }
    out.push({ id, w: Number(m[2]) });
  }
  return out;
}

function buildOrigin(races: Race[]): OriginFile {
  const f = D + '01-origin.md';
  const stepsT = byHeading(f, '1. ลำดับการสุ่มเกิด');
  const steps = stepsT.rows.map((r) => ({ n: clean(r.cells[0]), what: clean(r.cells[1]), rule: clean(r.cells[2]) }));
  const shareT = byHeading(f, '2. สัดส่วนเผ่า');
  const raceShare: Pick<RaceId>[] = [];
  for (const r of shareT.rows) for (let i = 0; i < r.cells.length; i += 2) raceShare.push({ id: raceId(r.cells[i])!, w: Number(r.cells[i + 1]) });

  const birthT = byHeading(f, '3. ถิ่นเกิดของแต่ละเผ่า');
  const birthplaces: Birthplace[] = birthT.rows.map((r) => ({
    race: raceId(r.cells[0])!,
    main: countriesIn(r.cells[1]),
    mainPct: Number(r.cells[2]),
    diaspora: countriesIn(r.cells[3]),
    diasporaBigCity: r.cells[3].includes('เมืองใหญ่'),
    diasporaPct: Number(r.cells[4]),
    outPct: Number(r.cells[5]),
    halfPct: Number(r.cells[6]),
    mainText: clean(r.cells[1]),
    diasporaText: clean(r.cells[3]),
  }));

  const pairT = byHeading(f, 'คู่ที่เป็นไปได้');
  const halfPairs: HalfPair[] = [];
  let noHalf: RaceId[] = [];
  for (const r of pairT.rows) {
    if (r.cells[0].startsWith('เผ่าที่ไม่มีลูกครึ่ง')) {
      noHalf = racesIn(r.cells[1]);
      continue;
    }
    halfPairs.push({
      main: raceId(r.cells[0])!,
      second: racePicks(r.cells[1], f, r.line),
      worldNames: dot(r.cells[2]).map(clean),
      despised: clean(r.cells[3]),
      despisedCountries: countriesIn(r.cells[3]),
    });
  }

  const meetRules = byHeading(f, 'ถิ่นเกิดและเหตุที่พ่อแม่พบกัน', 0);
  const meetingRules = meetRules.rows.map((r) => ({ n: Number(r.cells[0]), rule: clean(r.cells[1]) }));
  const meetT = byHeader(f, 'คู่');
  const meetingPlaces: MeetingPlace[] = meetT.rows.map((r) => {
    const pair = racesIn(r.cells[0]);
    if (pair.length !== 2) throw new Error(`01-origin:${r.line}: pair "${r.cells[0]}" is not two races`);
    const causes = dot(r.cells[3]).map((seg) => {
      const m = seg.match(/^([^\d(]+?)\s+(\d+)\s*(?:\((.*)\))?$/);
      if (!m || !CAUSE_ID[m[1].trim()]) throw new Error(`01-origin:${r.line}: cause "${seg}" not read`);
      return { id: CAUSE_ID[m[1].trim()], w: Number(m[2]), note: clean(m[3] ?? '') };
    });
    return {
      pair: [pair[0], pair[1]],
      places: placePicks(r.cells[1]),
      mainOnly: clean(r.cells[2]),
      mainOnlyCountries: countriesIn(r.cells[2]),
      causes,
      src: src(f, r.line),
    };
  });
  const causeT = byHeader(f, 'เหตุ');
  const meetCauses: MeetCause[] = causeT.rows.map((r) => {
    const name = clean(r.cells[0]);
    const id = CAUSE_ID[name];
    if (!id) throw new Error(`01-origin:${r.line}: cause "${name}" has no id`);
    const p = parseCell(r.cells[1], ids);
    for (const u of p.unparsed) unp.add(f, r.line, u, 'birth cause effect with a number not read');
    return {
      id,
      name,
      start: fixKinds(p.effects),
      startText: clean(r.cells[1]),
      hbText: clean(r.cells[2]),
      hbMul: [...r.cells[2].matchAll(/ทาง\s*([กขค])\s*×\s*([\d.]+)/g)].map((m) => ({ path: PATH_KEY[m[1]], mul: Number(m[2]) })),
    };
  });
  const halfOfHalfT = byHeader(f, 'คู่ครอง');
  const halfOfHalf = halfOfHalfT.rows.map((r) => ({ partner: clean(r.cells[0]), child: clean(r.cells[1]), note: clean(r.cells[2]) }));
  const halfBlood = bulletLines(block(f, /^ค่าของลูกครึ่ง$/));
  const outsideRules = bulletLines(block(f, /^5\. เกิดนอกถิ่น/));
  const outsideT = byHeading(f, '5. เกิดนอกถิ่น');
  const outsideStories = outsideT.rows.map((r, i) => ({ id: `outside_${i + 1}`, name: clean(r.cells[0]), meaning: clean(r.cells[1]), effect: clean(r.cells[2]) }));

  const contT = byHeading(f, '6. พรถิ่นเกิดตามทวีป');
  const continentGifts: ContinentGift[] = contT.rows.map((r) => {
    const cont = CONTINENT_NAME[clean(r.cells[0])];
    if (!cont) throw new Error(`01-origin:${r.line}: continent "${r.cells[0]}" unknown`);
    return { continent: cont, name: clean(r.cells[0]), blessings: giftGroups(r.cells[1]), curses: giftGroups(r.cells[2]) };
  });

  const genderT = byHeading(f, 'เพศ');
  const gender: OriginFile['gender'] = {};
  const gOf = genderTable(genderT);
  for (const r of races) gender[r.id] = gOf(r.id);

  const instT = byHeader(f, 'สถาบัน');
  const institutions: Institution[] = instT.rows.map((r, i) => {
    const limit = clean(r.cells[1]);
    const male = limit.includes('ชายเท่านั้น') || /เป็นหญิงเท่านั้น|หญิงเท่านั้น/.test(limit);
    void male;
    const cm = r.cells[2].match(/ชั้น\s*(\d)(?:\s*ถึง\s*(\d))?(\s*ขึ้นไป)?/);
    const genderOnly = /ชายเท่านั้น/.test(limit) && !/หญิงเท่านั้น/.test(limit) ? 'm' : /หญิงเท่านั้น|เป็นหญิงเท่านั้น/.test(limit) && !/ชายเท่านั้น/.test(limit) ? 'f' : undefined;
    return {
      id: `inst_${i + 1}`,
      name: clean(r.cells[0]),
      countries: countriesIn(r.cells[0]),
      allCountries: r.cells[0].includes('ทุกประเทศ'),
      limit,
      classText: clean(r.cells[2]),
      classes: cm ? { min: Number(cm[1]), ...(cm[2] ? { max: Number(cm[2]) } : {}) } : {},
      alt: clean(r.cells[3]),
      ...(genderOnly ? { genderOnly } : {}),
    };
  });

  const signT = byHeading(f, '8. ดวงวันเกิด');
  const birthSigns: BirthSign[] = signT.rows.map((r) => {
    const name = clean(r.cells[0]);
    const id = SIGN_ID[name];
    if (!id) throw new Error(`01-origin:${r.line}: birth sign "${name}" has no id`);
    const p = parseCell(r.cells[3], ids);
    for (const u of p.unparsed) if (/\d|%/.test(mulOf(u).rest)) unp.add(f, r.line, u, 'birth sign effect with a number not read');
    return {
      id,
      name,
      kind: ['night', 'day', 'dawn', 'dusk'].includes(id) ? 'time' : 'sign',
      likes: racesIn(r.cells[1]),
      clashes: racesIn(r.cells[2]),
      effect: clean(r.cells[3]),
      likesText: clean(r.cells[1]),
      clashesText: clean(r.cells[2]),
      fx: fixKinds(p.effects),
    };
  });
  const step6 = steps.find((s) => s.n === '6')!.rule;
  const timeM = step6.match(/เวลา \(([^)]+)\)/)!;
  const signM = step6.match(/ดวง \(([^)]+)\)/)!;
  const birthSignWeights = {
    time: words(timeM[1]).map((x) => SIGN_ID[x] ?? x),
    sign: dot(signM[1]).map((seg) => {
      const m = seg.match(/^(.*?)\s+(\d+)$/)!;
      return { id: SIGN_ID[clean(m[1])] ?? clean(m[1]), w: Number(m[2]) };
    }),
  };
  const hb = halfBlood.join(' ');
  const halfStat = {
    coin: mustNum(hb, /โยนเหรียญ (\d+)\/\d+/, 'coin') / 100,
    lifespanWiggle: mustNum(hb, /±\s*(\d+)%/, 'wiggle') / 100,
    weakTagAlways: /อ่อนแอ \(`#weak_\*`\) ที่ได้ 100%|#weak_\*[^ ]* ที่ได้ 100%/.test(hb) || hb.includes('100% เสมอ'),
    secondTagChance: mustNum(hb, /เผ่าที่สองได้แต่ละแท็ก (\d+)%/, 'second tag') / 100,
  };
  // 1ข 1ค 1ง: births that skip the ordinary draw
  const rule = (n: string) => steps.find((x) => x.n === n)!.rule;
  const r1b = rule('1ข');
  const r1c = rule('1ค');
  const r1d = steps.find((x) => x.n === '1ง')!;
  const specialBirths: SpecialBirth[] = [
    {
      id: 'summoned',
      race: 'human',
      chance: mustNum(r1b, /ผู้ถูกอัญเชิญ ([\d.]+)% ของมนุษย์/, 'summoned chance') / 100,
      country: (r1b.match(/ปรากฏที่ (\w+-\d\d) อายุ (\d+)/) ?? [])[1] ?? '',
      age: mustNum(r1b, /ปรากฏที่ \w+-\d\d อายุ (\d+)/, 'summoned age'),
      node: (r1b.match(/เข้า (hu\.[bt]\d)/) ?? [])[1] ?? '',
      skipSteps: [2, 3, 4, 5, 6],
      text: clean(r1b.split('· ผู้กลับชาติ:')[0]),
    },
    {
      id: 'reincarnated',
      race: 'human',
      chance: mustNum(r1b, /เป็นผู้กลับชาติ (\d+)%/, 'reincarnated chance') / 100,
      country: (r1b.match(/ประเทศเกิด (\w+-\d\d)/) ?? [])[1] ?? '',
      node: (r1b.match(/เข้า (hu\.b1)/) ?? [])[1] ?? '',
      ofHumans: mustNum(r1b, /ราว ([\d.]+)% ของมนุษย์/, 'reincarnated share of humans') / 100,
      text: clean(r1b.split('· ผู้กลับชาติ:')[1] ?? ''),
    },
    {
      id: 'doll',
      race: 'construct',
      fromYear: mustNum(r1c.replace(/,/g, ''), /ตั้งแต่ ศ\.ม\. (\d+)/, 'doll year'),
      node: (r1c.match(/(co\.b1)/) ?? [])[1] ?? '',
      text: clean(r1c),
    },
    {
      id: 'woken',
      races: racesIn(r1d.what),
      age: mustNum(r1d.rule, /อายุเทียบมนุษย์ (\d+)/, 'woken age'),
      text: clean(r1d.rule),
    },
  ];
  return { steps, specialBirths, raceShare, birthplaces, halfPairs, noHalf, meetingRules, meetingPlaces, meetCauses, halfOfHalf, halfBlood, outsideRules, outsideStories, continentGifts, gender, institutions, birthSigns, birthSignWeights, halfStat };
}

/** "`b_falcon` · `nb_sky_born` (18%)" and "`c_fireweak` (เผ่าไม่ทนไฟ 8%) · `nc_ash_cough` (10%)" → groups sharing one chance. */
function giftGroups(text: string): { ids: string[]; chance: number | null; cond: string }[] {
  const out: { ids: string[]; chance: number | null; cond: string }[] = [];
  let pending: string[] = [];
  for (const m of text.matchAll(/`([^`]+)`\s*(?:\(([^)]*)\))?/g)) {
    pending.push(m[1]);
    if (m[2] !== undefined) {
      const pm = m[2].match(/(\d+(?:\.\d+)?)%/);
      out.push({ ids: pending, chance: pm ? Number(pm[1]) / 100 : null, cond: clean(m[2].replace(/(\d+(?:\.\d+)?)%/, '')) });
      pending = [];
    }
  }
  if (pending.length) out.push({ ids: pending, chance: null, cond: '' });
  return out;
}

// =====================================================================================================================
// wish.json
// =====================================================================================================================

function wishCost(what: string, raw: string): WishCost {
  const w = clean(what);
  const r = clean(raw);
  const labels = dot(w);
  const pts = dot(r).map((x) => numIn(x));
  const c: WishCost = { what: w, raw: r, points: pts.length ? pts[0] : null };
  if (labels.length > 1 && labels.length === pts.length && pts.every((x) => x !== null)) {
    const first = labels[0].split(' ');
    c.parts = labels.map((l, i) => ({ label: i > 0 && !l.includes(' ') && first.length > 1 ? `${first[0]} ${l}` : l, points: pts[i] as number }));
  }
  return c;
}

function buildWish(): WishFile {
  const f = D + '19-wish.md';
  const principles = byHeading(f, '1. หลัก').rows.map((r) => ({ n: Number(r.cells[0]), text: clean(r.cells[1]) }));
  const fixed = byHeader(f, 'ช่อง', 0).rows.map((r) => ({ field: clean(r.cells[0]), values: clean(r.cells[1]), replaces: clean(r.cells[2]) }));
  const tendency = byHeader(f, 'ช่อง', 1).rows.map((r) => {
    const name = clean(r.cells[0]);
    const m = name.match(/^(.*?)\s*\(ไม่เกิน (\d+)\)$/);
    return { field: m ? m[1] : name, effect: clean(r.cells[1]), ...(m ? { max: Number(m[2]) } : {}) };
  });
  const story = byHeader(f, 'คำขอแบบนี้').rows.map((r) => ({ ask: clean(r.cells[0]), becomes: clean(r.cells[1]), refs: refsOf(r.cells[1]) }));
  const sec2 = block(f, /^2\. ใบคำขอ$/);
  const storyNote = sec2.map((l) => clean(l.text)).find((l) => l.startsWith('ส่วนเรื่องไม่ใช้แต้มชะตา')) ?? '';
  const paths = byHeader(f, 'ทาง').rows.map((r) => ({ path: clean(r.cells[0]), when: clean(r.cells[1]), how: clean(r.cells[2]) }));
  const s4 = block(f, /^4\. แต้มชะตา$/);
  const budgetText = s4.map((l) => l.text).join('\n');
  const costs = byHeader(f, 'สิ่งที่ขอ').rows.map((r) => wishCost(r.cells[0], r.cells[1]));
  const sheet = byHeading(f, '5. ใบเกิด').rows.map((r) => ({ part: clean(r.cells[0]), shows: clean(r.cells[1]) }));
  const after = bulletLines(block(f, /^6\. หลังเริ่ม$/));
  const body = readDoc(f);
  return {
    principles,
    fixed,
    tendency,
    story,
    storyNote,
    paths,
    budget: {
      total: mustNum(budgetText, /ทุกคำขอมี (\d+) แต้ม/, 'wish budget'),
      costs,
      overBudget: clean((budgetText.match(/\*\*เกินงบ\*\*[^\n]*/) ?? [''])[0]),
      note: clean((budgetText.match(/\*\*ไม่มีแบบใดแรงกว่าแบบอื่น\*\*[^\n]*/) ?? [''])[0]),
    },
    sheet,
    after,
    limits: {
      traits: tendency.find((x) => x.field.startsWith('นิสัย'))?.max ?? 3,
      aptitudes: tendency.find((x) => x.field.startsWith('ความถนัด'))?.max ?? 2,
      blessings: 1,
      requestChars: mustNum(body, /ไม่เกิน (\d+) ตัวอักษร/, 'request length'),
    },
    extend: proseLines(block(f, /^7\. ข้อมูลที่ต้องขยาย/)).join(' '),
  };
}

// =====================================================================================================================
// synonyms.json
// =====================================================================================================================

const SYN_KEY: Record<string, { key: string; part: SynField['part'] }> = {
  '2.1': { key: 'race', part: 'fixed' }, '2.2': { key: 'specialBirth', part: 'fixed' }, '2.3': { key: 'half', part: 'fixed' }, '2.4': { key: 'gender', part: 'fixed' },
  '2.5': { key: 'continent', part: 'fixed' }, '2.5ข': { key: 'placeKind', part: 'fixed' }, '2.6': { key: 'class', part: 'fixed' }, '2.7': { key: 'family', part: 'fixed' },
  '2.8': { key: 'birthTime', part: 'fixed' }, '2.8ข': { key: 'birthSign', part: 'fixed' }, '2.9': { key: 'religion', part: 'fixed' }, '2.10': { key: 'trait', part: 'tendency' },
  '2.11': { key: 'aptitude', part: 'tendency' }, '2.12': { key: 'job', part: 'tendency' }, '2.13': { key: 'companion', part: 'tendency' }, '2.14': { key: 'blessing', part: 'tendency' },
  '2.15': { key: 'curse', part: 'tendency' }, '2.16': { key: 'story', part: 'story' }, '2.17': { key: 'era', part: 'story' }, '2.18': { key: 'startMode', part: 'story' },
};

function synValues(t: Table): SynValue[] {
  return t.rows.map((r) => ({ code: clean(r.cells[0]), name: clean(r.cells[1]), syn: dot(r.cells[2]).map((x) => x.trim()) }));
}

function buildSynonyms(): SynonymsFile {
  const f = D + '20-wish-synonyms.md';
  const countT = byHeader(f, 'ช่อง', 0);
  const declared = countT.rows.filter((r) => !r.cells[0].includes('รวม'));
  const totalRow = countT.rows.find((r) => r.cells[0].includes('รวม'))!;
  const fields: SynField[] = [];
  let fieldNames: SynValue[] = [];
  let i = 0;
  for (const t of tbls(f)) {
    if (clean(t.header[0]) !== 'รหัส' || clean(t.header[2]) !== 'คำพ้อง') continue;
    const head = clean(t.headings[t.headings.length - 1]);
    const m = head.match(/^(2\.\d+ข?)\s/);
    if (!m) continue;
    if (m[1] === '2.19') {
      fieldNames = synValues(t);
      continue;
    }
    const k = SYN_KEY[m[1]];
    if (!k) throw new Error(`20-wish-synonyms: no key for ${m[1]}`);
    const d = declared[i++];
    fields.push({ key: k.key, heading: head, field: clean(d.cells[0]), part: k.part, values: synValues(t), declaredValues: Number(d.cells[2]), declaredSyn: Number(d.cells[3].replace(/,/g, '')) });
  }
  const sumV = fields.reduce((a, x) => a + x.values.length, 0);
  const sumS = fields.reduce((a, x) => a + x.values.reduce((b, v) => b + v.syn.length, 0), 0);
  const pairs = (t: Table) => t.rows.map((r) => ({ kind: clean(r.cells[0]), words: dot(r.cells[1]) }));
  const neg = byHeading(f, '3. คำปฏิเสธ', 0);
  const negRes = byHeading(f, '3. คำปฏิเสธ', 1);
  const lvl = byHeading(f, '4. คำบอกระดับ', 0);
  const lvlEff = byHeading(f, '4. คำบอกระดับ', 1);
  const rnd = byHeading(f, '5. คำสุ่ม');
  const fill = byHeading(f, '6. คำเติม');
  const off = byHeading(f, '7. คำขอที่ไม่มีช่อง');
  const imp = byHeading(f, '8. คำขอที่ทำไม่ได้');
  const conf = byHeading(f, '9. คำขอขัดกัน');
  const steps = byHeading(f, '10. ลำดับการแปล', 0);
  const outs = byHeading(f, '10. ลำดับการแปล', 1);
  const rules = byHeading(f, '1. หลักของตาราง');
  const rulesRows = rules.rows.map((r) => ({ n: Number(r.cells[0]), text: clean(r.cells[1]) }));
  const body = readDoc(f);
  return {
    fields,
    fieldNames,
    totals: { values: sumV, synonyms: sumS, declaredValues: Number(totalRow.cells[2].replace(/\*/g, '')), declaredSynonyms: Number(totalRow.cells[3].replace(/[*,]/g, '')) },
    negation: pairs(neg),
    negationResults: negRes.rows.map((r) => ({ case: clean(r.cells[0]), effect: clean(r.cells[1]) })),
    levelWords: pairs(lvl),
    levelEffects: lvlEff.rows.map((r) => ({ field: clean(r.cells[0]), strong: clean(r.cells[1]), weak: clean(r.cells[2]) })),
    randomWords: rnd.rows.map((r) => ({ scope: clean(r.cells[0]), words: dot(r.cells[1]) })),
    fillerWords: pairs(fill),
    offForm: off.rows.map((r) => ({ topic: clean(r.cells[0]), words: dot(r.cells[1]), reason: clean(r.cells[2]) })),
    impossible: imp.rows.map((r) => ({ ask: clean(r.cells[0]), words: dot(r.cells[1]), nearest: clean(r.cells[2]) })),
    conflicts: conf.rows.map((r) => ({ case: clean(r.cells[0]), effect: clean(r.cells[1]) })),
    steps: steps.rows.map((r) => ({ n: Number(r.cells[0]), what: clean(r.cells[1]) })),
    outcomes: outs.rows.map((r) => ({ result: clean(r.cells[0]), cond: clean(r.cells[1]), next: clean(r.cells[2]) })),
    rules: rulesRows,
    minSynonymLength: mustNum(rulesRows.find((x) => x.n === 4)!.text, /ยาวอย่างน้อย (\d+) ตัวอักษร/, 'synonym length'),
    knownCharShare: mustNum(body, /ไม่ต่ำกว่า (\d+)%/, 'known char share') / 100,
  };
}

// =====================================================================================================================
// companions.json
// =====================================================================================================================

const PERSONALITY_ID: Record<string, string> = {
  ขี้อ้อน: 'cuddly', กล้าหาญ: 'brave', ขี้ขลาด: 'timid', เจ้าเล่ห์: 'sly', ซื่อสัตย์: 'loyal', ขี้เกียจ: 'lazy', ขยัน: 'diligent', หยิ่งผยอง: 'proud', ซุกซน: 'playful', ขี้สงสัย: 'curious',
};

function multOf(s: string): number | null {
  const m = s.match(/×\s*([\d.]+)/);
  return m ? Number(m[1]) : null;
}

function buildCompanions(gifts: { blessings: Gift[]; curses: Gift[] }, skills: Skill[], jobIds: Set<string>, aptIds: Set<string>, raceIdSet: Set<string>): CompanionsFile {
  const f13 = D + '13-companions-overview.md';
  const f14 = D + '14-companion-abilities.md';
  const f15 = D + '15-companion-species.md';
  const f16 = D + '16-companion-stories.md';
  const f17 = D + '17-companion-support.md';

  // abilities
  const abilities: CompanionAbility[] = [];
  for (const t of tbls(f14)) {
    if (clean(t.header[0]) !== 'ID') continue;
    const group = clean(t.headings[t.headings.length - 1]);
    for (const r of t.rows)
    {
      const ws = words(r.cells[5]);
      abilities.push({
        id: clean(r.cells[0]),
        name: clean(r.cells[1]),
        group,
        levels: [clean(r.cells[2]), clean(r.cells[3]), clean(r.cells[4])],
        jobsText: clean(r.cells[5]),
        jobs: ws.filter((w) => jobIds.has(w)),
        apts: ws.filter((w) => aptIds.has(w)),
        races: ws.filter((w) => raceIdSet.has(w)),
        src: src(f14, r.line),
      });
    }
  }

  // species
  const species: CompanionSpecies[] = [];
  const abil = (text: string, at: string): { abilities: { id: string; level: number }[]; rest: string } => {
    const out: { id: string; level: number }[] = [];
    let rest = text;
    for (const m of text.matchAll(/\b(pa_[a-z0-9_]+):(\d)\b/g)) {
      out.push({ id: m[1], level: Number(m[2]) });
      rest = rest.replace(m[0], ' ');
    }
    void at;
    return { abilities: out, rest: clean(rest) };
  };
  for (const t of tbls(f15)) {
    if (clean(t.header[0]) !== 'ID') continue;
    const tierM = t.headings.join(' ').match(/ระดับ ([CURLE])\b/);
    if (!tierM) continue;
    for (const r of t.rows) {
      const a = abil(r.cells[5], src(f15, r.line));
      if (a.rest) unp.add(f15, r.line, a.rest, 'species ability cell has text that is not an ability');
      let lifespan: [number, number] | null = null;
      try {
        lifespan = rng(r.cells[4]);
      } catch {
        lifespan = null;
      }
      species.push({
        id: clean(r.cells[0]),
        name: clean(r.cells[1]),
        tier: tierM[1] as Rarity,
        category: clean(r.cells[2]),
        home: clean(r.cells[3]),
        homeRefs: refsOf(r.cells[3]),
        lifespan,
        abilities: a.abilities,
        note: clean(r.cells[6] ?? ''),
        std: true,
        src: src(f15, r.line),
      });
    }
  }
  const slime = byHeading(f17, 'จ. ชนิดสัตว์ที่ได้จากคำสาป');
  for (const r of slime.rows) {
    const a = abil(r.cells[4], src(f17, r.line));
    species.push({
      id: clean(r.cells[0]),
      name: clean(r.cells[1]),
      tier: clean(r.cells[2]) as Rarity,
      category: 'คำสาป',
      home: clean(r.cells[3]),
      homeRefs: refsOf(r.cells[3]),
      lifespan: null,
      abilities: a.abilities,
      note: a.rest,
      std: false,
      src: src(f17, r.line),
    });
  }

  // stories
  const stories: CompanionStory[] = [];
  const GROUPS: Record<string, string> = { ก: 'all', ข: 'A', ค: 'S', ง: 'world' };
  for (const t of tbls(f16)) {
    if (clean(t.header[0]) !== 'ID') continue;
    const head = clean(t.headings[t.headings.length - 1]);
    const g = GROUPS[head[0]] ?? head;
    for (const r of t.rows) {
      const choiceText = clean(r.cells[5]);
      const parts = choiceText.split(/\s+(?=[ก-ง]\)\s)/);
      const choices = parts.map((p) => {
        const m = p.match(/^([ก-ง])\)\s*(.*)$/);
        return m ? { key: ({ ก: 'a', ข: 'b', ค: 'c', ง: 'd' } as const)[m[1] as 'ก'], text: m[2].trim() } : null;
      });
      if (choices.some((c) => !c)) unp.add(f16, r.line, choiceText, 'story choices not split into ก) ข) ค)');
      stories.push({
        id: clean(r.cells[0]),
        name: clean(r.cells[1]),
        group: g,
        cond: clean(r.cells[2]),
        condCond: condFrom(r.cells[2], f16, r.line),
        weight: Number(clean(r.cells[3])),
        species: uniq([...r.cells[4].matchAll(/\b(sp_[a-z0-9_]+)\b/g)].map((m) => m[1])),
        speciesText: clean(r.cells[4]),
        choices: choices.filter((c): c is NonNullable<typeof c> => !!c),
        cutWhen: clean(r.cells[6]),
        refs: refsOf(r.cells.join(' ')),
        src: src(f16, r.line),
      });
    }
  }

  // rules
  const partsT = byHeader(f13, 'ของ');
  const parts = partsT.rows.map((r) => ({ thing: clean(r.cells[0]), count: /^ดู/.test(clean(r.cells[1])) ? null : numIn(r.cells[1]), file: (r.cells[2].match(/\]\(([^)]+)\)/) ?? [])[1] ?? '' }));
  const fields = byHeading(f13, '1. ตัวสัตว์คู่หูมีอะไรบ้าง').rows.map((r) => ({ name: clean(r.cells[0]), meaning: clean(r.cells[1]) }));
  const intro = block(f13, /^1\. ตัวสัตว์คู่หูมีอะไรบ้าง/).map((l) => l.text).join(' ');
  const limM = intro.match(/ได้ \*\*(\d+) ตัว\*\* ตามปกติ อาชีพเฉพาะทางมีได้ถึง \*\*(\d+) ตัว\*\*.*?ได้ถึง (\d+) ตัว/);
  if (!limM) throw new Error('13-companions: pet limits not read');
  const yearlyT = byHeader(f13, 'กลุ่ม');
  const yearly = yearlyT.rows.map((r) => {
    const g = clean(r.cells[0])[0] as 'S' | 'A' | 'B';
    const ps = [...r.cells[1].matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]) / 100);
    return { group: g, chance: ps[0], ...(ps[1] !== undefined ? { earlyChance: ps[1] } : {}), cumulative: clean(r.cells[2]), jobs: g === 'B' ? [] : words(r.cells[3]), jobsText: clean(r.cells[3]) };
  });
  const raceMultT = byHeader(f13, 'เผ่า');
  const raceMultiplier = raceMultT.rows.map((r) => ({ races: racesIn(r.cells[0]), mul: multOf(r.cells[1]) ?? 1, why: clean(r.cells[2]) }));
  const rarT = byHeader(f13, 'ระดับ', 0);
  const rarityWeights = rarT.rows.map((r) => ({ tier: clean(r.cells[0]) as Rarity, base: Number(r.cells[1]), S: multOf(r.cells[2]) ?? 0, A: multOf(r.cells[3]) ?? 0, B: multOf(r.cells[4]) ?? 0 }));
  const body = readDoc(f13);
  const sec2 = block(f13, /^2\. โอกาสได้สัตว์คู่หู/).map((l) => l.text);
  const methods = byHeading(f13, '3. วิธีได้').rows.map((r) => ({ how: clean(r.cells[0]), detail: clean(r.cells[1]) }));
  const bond = byHeader(f13, 'ระดับความผูกพัน').rows.map((r) => ({ level: Number(r.cells[0]), effect: clean(r.cells[1]) }));
  const capsT = byHeader(f13, 'ความสามารถของผู้เลี้ยง');
  const cap = (s: string) => (/^\d+$/.test(clean(s)) ? Number(s) : null);
  const bondCaps = capsT.rows.map((r) => ({ taming: clean(r.cells[0]), cd: cap(r.cells[1]), R: cap(r.cells[2]), E: cap(r.cells[3]), L: cap(r.cells[4]) }));
  const personalities = byHeader(f13, 'บุคลิก').rows.map((r) => {
    const name = clean(r.cells[0]);
    if (!PERSONALITY_ID[name]) throw new Error(`13-companions: personality "${name}" has no id`);
    return { id: PERSONALITY_ID[name], name, effect: clean(r.cells[1]) };
  });
  const upkeep = byHeader(f13, 'ขนาด').rows.map((r) => ({ size: clean(r.cells[0]), costPerYear: Number(r.cells[1]), note: clean(r.cells[2]) }));
  const placeLimits = byHeading(f13, '7. ค่าใช้จ่าย', 1).rows.map((r) => ({ cond: clean(r.cells[0]), effect: clean(r.cells[1]) }));
  const interactions = byHeading(f13, '8. กติกาปฏิสัมพันธ์').rows.map((r) => ({ id: clean(r.cells[0]), cond: clean(r.cells[1]), effect: clean(r.cells[2]), refs: refsOf(r.cells[1] + ' ' + r.cells[2]) }));
  const worldEffects = byHeading(f13, '9. สัตว์คู่หูกับโลก').rows.map((r) => ({ event: clean(r.cells[0]), effect: clean(r.cells[1]), refs: refsOf(r.cells[0] + ' ' + r.cells[1]) }));
  const lifeBlock = block(f13, /^5\. ชีวิตของสัตว์/).map((l) => clean(l.text.replace(/^- /, '')));
  const rules: CompanionsFile['rules'] = {
    parts,
    fields,
    limits: { normal: Number(limM[1]), specialist: Number(limM[2]), beastking: Number(limM[3]) },
    yearly,
    childEventChance: mustNum(body, /ทุกคนมีโอกาส (\d+)% ครั้งเดียว/, 'child event') / 100,
    raceMultiplier,
    rarityWeights,
    storyBoost: clean(sec2.find((l) => l.startsWith('ความเข้ากับเรื่องราวที่เพิ่มน้ำหนัก')) ?? ''),
    methods,
    bond,
    bondYears: mustNum(body, /ประมาณ (\d+) ปีต่อระดับ/, 'bond years'),
    bondCaps,
    lifeRules: lifeBlock,
    personalities,
    upkeep,
    placeLimits,
    interactions,
    worldEffects,
    growth: lifeBlock.find((l) => l.startsWith('การเติบโตเป็นชนิดถัดไป')) ?? '',
  };

  // 17 ง
  const dTxt = block(f17, /^ง\. นิสัยที่เกี่ยวข้อง/).map((l) => l.text).join(' ');
  const [useTxt, clashTxt = ''] = dTxt.split('ที่ขัด:');
  const traitIds = (s: string) => uniq([...s.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]));
  const at17 = (g: Gift) => g.at.includes('17-companion-support');
  return {
    rules,
    abilities,
    species,
    stories,
    support: {
      skills: skills.filter((s) => s.kind === 'companion').map((s) => s.id),
      blessings: gifts.blessings.filter(at17).map((g) => g.id),
      curses: gifts.curses.filter(at17).map((g) => g.id),
    },
    traitsUsed: { use: traitIds(useTxt), clash: traitIds(clashTxt), text: clean(dTxt) },
  };
}

// =====================================================================================================================
// run
// =====================================================================================================================

const all = (...files: string[]) => files;
const ALL_CHAR_DOCS = [
  ...['01-origin', '02-race-affinity', '03-synergy-rules', '04-skill-effects', '05-new-blessings', '06-new-curses', '07-new-skills', '08-jobs-overview', '09-jobs-common', '10-jobs-secret', '11-jobs-special', '12-job-support', '13-companions-overview', '14-companion-abilities', '15-companion-species', '16-companion-stories', '17-companion-support', '18-fates', '19-wish', '20-wish-synonyms'].map((x) => `${D}${x}.md`),
];

export default function run(): GenReport {
  unp = new Unparsed('character'); // a fresh report each run, so two runs in one process write the same bytes
  // races first: it fills the race name table used by every condition parser
  const racesFile = buildRaces();
  const raceJobBonus = new Map<string, RaceId[]>();
  for (const r of racesFile.races) for (const j of r.jobBonus) raceJobBonus.set(j, [...(raceJobBonus.get(j) ?? []), r.id]);

  const { traits, tags } = buildTraits();
  const { apts, skills: aptSkills } = buildAptitudes();
  const skills = [...aptSkills, ...buildUniqueSkills(), ...buildNewSkills()];
  const gifts = buildGifts();
  const jobs = buildJobs(raceJobBonus);
  const jobByName = new Map(jobs.jobs.map((j) => [j.name, j.id]));
  for (const g of [...gifts.blessings, ...gifts.curses]) g.jobs = uniq(g.jobsText.split(/\s+/).map((w) => jobByName.get(w) ?? '').filter(Boolean));
  const fates = buildFates();
  const origin = buildOrigin(racesFile.races);
  const wish = buildWish();
  const synonyms = buildSynonyms();
  const companions = buildCompanions(gifts, skills, new Set(jobs.jobs.map((j) => j.id)), new Set(apts.map((a) => a.id)), new Set(racesFile.races.map((r) => r.id)));

  const raceDocs = RACE_ORDER.map((id, i) => `${D}races/${String(i + 1).padStart(2, '0')}-${id}.md`);
  const loreRaces = RACE_ORDER.map((id, i) => `docs/lore/races/${String(i + 1).padStart(2, '0')}-${id}.md`);
  const write = (name: string, items: unknown, sources: string[]) => writeGen(name, items, sources, GEN);
  write('races', racesFile, [D + '01-origin.md', D + '02-race-affinity.md', D + '03-synergy-rules.md', D + '08-jobs-overview.md', D + 'races/README.md', ...raceDocs, ...loreRaces, WORLD_TIME]);
  write('traits', { traits, tags }, [CAT + 'traits.md', CAT + 'tags.md', D + '05-new-blessings.md', D + '06-new-curses.md', D + '12-job-support.md']);
  write('aptitudes', apts, [CAT + 'aptitudes-skills.md', D + '04-skill-effects.md', D + '12-job-support.md']);
  write('skills', skills, [CAT + 'aptitudes-skills.md', D + '04-skill-effects.md', D + '07-new-skills.md', D + '12-job-support.md', D + '17-companion-support.md']);
  write('blessings', gifts.blessings, [CAT + 'blessings.md', D + '05-new-blessings.md', D + '12-job-support.md', D + '17-companion-support.md']);
  write('curses', gifts.curses, [CAT + 'curses.md', D + '06-new-curses.md', D + '12-job-support.md', D + '17-companion-support.md']);
  write('jobs', jobs, [D + '08-jobs-overview.md', D + '09-jobs-common.md', D + '10-jobs-secret.md', D + '11-jobs-special.md', D + '12-job-support.md']);
  write('fates', fates, [D + '18-fates.md']);
  write('origin', origin, [D + '01-origin.md']);
  write('wish', wish, [D + '19-wish.md']);
  write('synonyms', synonyms, [D + '20-wish-synonyms.md']);
  write('companions', companions, [D + '13-companions-overview.md', D + '14-companion-abilities.md', D + '15-companion-species.md', D + '16-companion-stories.md', D + '17-companion-support.md']);
  void all;
  void ALL_CHAR_DOCS;
  unp.write();
  return {
    group: 'character',
    files: ['races', 'traits', 'aptitudes', 'skills', 'blessings', 'curses', 'jobs', 'fates', 'origin', 'wish', 'synonyms', 'companions'].map((n) => `${n}.json`),
    unparsed: unp.count,
    strict: false,
  };
}
