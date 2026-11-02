// Generator for the NPC, country and continent data (code-plan §5.1 rows "ประเทศ ทวีป" and "NPC").
//   reads  docs/lore/npcs · docs/lore/countries · docs/lore/world · docs/lore/religions · docs/appearance/{01-continents,countries,npcs}
//          docs/systems/economy/{02-countries,03-classes,01-world-economy} · docs/systems/combat/07-npc-clashes · docs/systems/bonds/07-successors
//   writes data/gen/npcs.json countries.json continents.json and data/gen/_unparsed/npcs.md
// Same reading style as the older gen-countries.ts and gen-npc-cast.ts, plus the class/gold rules of
// scripts/docs/build-npc-economy.mjs and the tier rules of scripts/sim/sim-npc-density.mjs.
import type { Condition, ContinentId, CountryId, Effect, NpcId } from '../../../src/core/types';
import type {
  AllySuccessor,
  AxisDelta,
  Bloc,
  CityUi,
  Continent,
  ContinentUi,
  ContinentsFile,
  Country,
  CountryEcon,
  CountryFaith,
  EraTag,
  NpcClockRule,
  NpcLook,
  NpcPath,
  NpcRef,
  NpcRow,
  NpcRules,
  NpcsFile,
  NpcTemplate,
  PathCut,
  PathKey,
  PathTag,
  PeopleLife,
  Relation,
  RelationAxis,
  RelationKind,
  WorldMap,
  ZoomLevel,
} from '../../../src/core/data/types-npcs';
import type { GenReport } from '../run-all';
import { parseCell, parseCondition } from '../lib/effects';
import type { WorldCond } from '../../../src/core/data/types-events';
import { idIndex } from '../lib/ids';
import { Unparsed, cells, listDocs, readDoc, tables, writeGen } from '../lib/table';

// ---------- constants ----------

const CONTINENTS: { id: ContinentId; name: string }[] = [
  { id: 'AZ', name: 'อัซการ์' },
  { id: 'MH', name: 'มอร์เฮเวน' },
  { id: 'KD', name: 'คาซ-ดูรัม' },
  { id: 'NR', name: 'เนเรีย' },
  { id: 'AL', name: 'อัลเดรีย' },
  { id: 'MK', name: 'เมคาเรีย' },
  { id: 'SH', name: 'ซาฮารัน' },
  { id: 'SV', name: 'ซิลวาเนล' },
  { id: 'NB', name: 'เนบูเลีย' },
];
const CONT_BY_NAME = new Map(CONTINENTS.map((c) => [c.name, c.id]));
const COUNTRY_FILES = ['01-azgar', '02-morhaven', '03-kaz-durum', '04-nerea', '05-aldria', '06-mecharia', '07-saharan', '08-silvanel', '09-nebulia'];
const COUNTRY_RE = /\b(AZ|MH|KD|NR|AL|MK|SH|SV|NB)-(\d{2})\b/g;
const COUNTRY_ONE = /^(AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}$/;
const NPC_ID = /\b[A-Z]{2}\d{2}-\d\b/g;
/** World event ids: the 152 world events and the 42 successor events. LC- (local events) and NF- (clashes) are not world events. */
const EVENT_ID = /\b(?:DR|PL|WR|CT|DM|MC|BIO|GD|HP|PO|GI|FG|END|LE|SF|AS|DW|RF|WT|RL|CL|DV)-\d{2}\b/g;
const START_YEAR_RE = /ศ\.ม\. ([\d,]+) เมื่อ/;
const num = (s: string) => Number(s.replace(/,/g, '').replace('−', '-'));
const uniq = <T,>(a: T[]) => [...new Set(a)];
const PATH_KEYS: Record<string, PathKey> = { ก: 'a', ข: 'b', ค: 'c' };
/** `ถ้า` and `เมื่อ` as words: `เถ้า` (ash) holds the letters of `ถ้า` and is not one. */
const TRIGGER_WORD = /(?<!เ)ถ้า|เมื่อ/;
/** A clause that joins its events with `หรือ` waits for any of them. */
const waitAny = /หรือ|\//;

// ---------- people ----------

/** Prefix → people code. Sub-lineages are from docs/lore/races/README.md; longest prefix wins. */
const PEOPLE_KEYS: [string, string][] = [
  ['ดาร์กเอลฟ์', 'de'], ['เอลฟ์', 'el'], ['คนแคระ', 'dw'], ['ฮาล์ฟลิง', 'ha'], ['ฮาล์ฟออร์ค', 'or'], ['ออร์ค', 'or'], ['โอเกอร์', 'or'],
  ['เผ่าปีศาจ', 'dm'], ['ปีศาจ', 'dm'], ['เผ่ามังกร', 'dk'], ['เผ่าลาวา', 'la'], ['ลูกผสมจักรกล', 'co'], ['ตุ๊กตา', 'co'], ['หุ่น', 'so'],
  ['เผ่าปีก', 'wi'], ['อาเวียน', 'wi'], ['ปีกราตรี', 'wi'], ['ลูกหลานปีก', 'wi'], ['ชาวน้ำฟ้า', 'wi'], ['ปีกพลัดถิ่น', 'wi'],
  ['เผ่าสัตว์', 'be'], ['เผ่าหมาป่า', 'be'], ['เผ่าเสือ', 'be'], ['เผ่าแมว', 'be'], ['เผ่าสิงโต', 'be'], ['เผ่ากวาง', 'be'], ['เผ่าอูฐ', 'be'],
  ['เผ่าจิ้งจก', 'be'], ['เผ่าจิ้งจอก', 'be'], ['เผ่าหมี', 'be'], ['เผ่านก', 'be'], ['หมาป่า', 'be'],
  ['เงือก', 'me'], ['ไซเรน', 'me'], ['กัปปะ', 'me'], ['นาคา', 'na'], ['แวมไพร์', 'va'], ['ภูต', 'fa'], ['สไลม์', 'sl'], ['เผ่าเห็ด', 'sl'], ['เห็ดยักษ์', 'sl'],
  ['ยักษ์', 'gi'], ['มัมมี่', 'mu'], ['กูล', 'gh'],
  ['มนุษย์', 'hu'], ['ชาวทุ่ง', 'hu'], ['ชาวหมอก', 'hu'], ['ชนผืนทราย', 'hu'], ['ชนใต้ทราย', 'hu'], ['ชาวพื้น', 'hu'], ['ผู้กลับชาติ', 'hu'], ['ผู้ถูกอัญเชิญ', 'hu'], ['ชาวหิน', 'hu'],
];
PEOPLE_KEYS.sort((a, b) => b[0].length - a[0].length);
const peopleOf = (t: string): string | null => {
  const s = t.trim();
  for (const [k, id] of PEOPLE_KEYS) if (s.startsWith(k)) return id;
  return null;
};
/** `นาคาครึ่งเงือก` → ['na','me'] · `มนุษย์ครึ่งเผ่าปีก` → ['hu','wi'] */
function peoplePair(raceText: string): [string | null, string | null] {
  const [a, ...rest] = raceText.split('ครึ่ง');
  return [peopleOf(a), rest.length ? peopleOf(rest.join('ครึ่ง')) : null];
}

// ---------- table helpers ----------

function numberedLines(file: string): { l: string; line: number }[] {
  return readDoc(file)
    .split('\n')
    .map((l, i) => ({ l, line: i + 1 }));
}

function bulletField(l: string, key: string): string | null {
  const m = l.match(new RegExp(`^- \\*\\*${key}:?\\*\\*:?\\s*(.*)$`));
  return m ? m[1].trim() : null;
}

/** `k=v; k=v` cell → map. */
function pairs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of s.split(';')) {
    const m = part.trim().match(/^([a-z]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function mergeUi(ui: Record<string, string>): CityUi {
  const styles: Record<string, number> = {};
  for (const p of (ui.styles || '').split(',').filter(Boolean)) {
    const [k, n] = p.split(':');
    styles[k] = n ? Number(n) : 1;
  }
  const extra: Record<string, number> = {};
  if (ui.extra && ui.extra !== 'none')
    for (const p of ui.extra.split(',').filter(Boolean)) {
      const [k, n] = p.split('×');
      extra[k] = n ? Number(n) : (extra[k] ?? 0) + 1;
    }
  const known = new Set(['styles', 'roofs', 'plan', 'wall', 'centre', 'ambient', 'extra', 'scale', 'seat', 'sacred', 'war', 'defense', 'justice', 'mark']);
  const other: Record<string, string> = {};
  for (const k of Object.keys(ui).sort()) if (!known.has(k)) other[k] = ui[k];
  const out: CityUi = {
    styles,
    roofs: ui.roofs && ui.roofs !== 'default' ? ui.roofs.split(',').filter(Boolean) : [],
    plan: ui.plan ?? '',
    wall: ui.wall ?? '',
    centre: ui.centre ?? '',
    ambient: ui.ambient ?? '',
    extra,
    mark: ui.mark ? ui.mark.split(',').filter(Boolean) : [],
    other,
    raw: Object.fromEntries(Object.keys(ui).sort().map((k) => [k, ui[k]])),
  };
  if (ui.scale) out.scale = Number(ui.scale);
  for (const k of ['seat', 'sacred', 'war', 'defense', 'justice'] as const) if (ui[k] !== undefined) out[k] = ui[k];
  return out;
}

// ---------- religions ----------

interface Faith {
  id: string;
  name: string;
  channel: 'A' | 'B' | 'C' | 'D' | 'E';
}
function readFaiths(): Faith[] {
  const t = tables('docs/lore/religions/README.md').find((x) => x.header[1] === 'ศาสนา');
  if (!t) throw new Error('religions README: faith table not found');
  return t.rows
    .filter((r) => /^\d+$/.test(r.cells[0]))
    .map((r) => ({ id: `faith.${r.cells[0].padStart(2, '0')}`, name: r.cells[1], channel: r.cells[2] as Faith['channel'] }));
}
/** Substring → faith number. Local spirits and cults that no faith row names stay unmatched (id null). */
const FAITH_ALIASES: [string, number][] = [
  ['ลัทธิบูชามังกร', 1], ['ลัทธิมังกร', 1], ['บูชามังกร', 1], ['แสง', 2], ['ต้นไม้โลก', 3], ['สมุทร', 4], ['พญานาคราช', 5], ['จันทรา', 6],
  ['เทพแห่งสงคราม', 7], ['สงคราม', 7], ['ลัทธิปีศาจ', 8], ['บรรพบุรุษ', 9], ['เหตุผล', 10], ['เตาหลอม', 11], ['เฟือง', 12], ['ศรัทธาศิลา', 13],
  ['เสียงกระซิบ', 14], ['ฟาโรห์', 15], ['ผู้ชี้ทาง', 16], ['ความฝัน', 17], ['วิญญาณสัตว์', 18], ['โชคลาง', 19], ['ลางทะเล', 19], ['ลางนิยม', 19],
  ['คำพิพากษา', 20], ['ผู้ไม่ก้มหัว', 21], ['ผู้ปลดผนึก', 22], ['ผู้ล่าเทพ', 23],
];
function parseFaiths(raw: string, faiths: Faith[]): CountryFaith[] {
  const text = raw.replace(/\([^)]*\)/g, ' ');
  const hits: { at: number; n: number }[] = [];
  for (const [alias, n] of FAITH_ALIASES) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(alias, from);
      if (at < 0) break;
      // a longer alias already covering this spot wins (`ลัทธิมังกร` over `บูชามังกร`)
      if (!hits.some((h) => h.n === n || (at >= h.at && at < h.at + 3))) hits.push({ at, n });
      from = at + alias.length;
    }
  }
  hits.sort((a, b) => a.at - b.at);
  const seen = new Set<number>();
  const out: CountryFaith[] = [];
  for (const h of hits) {
    if (seen.has(h.n)) continue;
    seen.add(h.n);
    const f = faiths[h.n - 1];
    out.push({ id: f.id, name: f.name, channel: f.channel, primary: out.length === 0 });
  }
  if (!out.length) out.push({ id: null, name: raw.trim(), channel: null, primary: true });
  return out;
}

// ---------- relations ----------

function expandCodes(text: string): CountryId[] {
  const out: string[] = [];
  const t = text.replace(/\b(AZ|MH|KD|NR|AL|MK|SH|SV|NB)-(\d{2}) ถึง (?:\1-)?(\d{2})\b/g, (_, p: string, a: string, b: string) => {
    for (let i = Number(a); i <= Number(b); i++) out.push(`${p}-${String(i).padStart(2, '0')}`);
    return ' ';
  });
  for (const m of t.matchAll(COUNTRY_RE)) out.push(m[0]);
  return uniq(out);
}

function classify(clause: string): RelationKind {
  const t = clause.replace(COUNTRY_RE, ' ');
  if (/เจ้าเหนือหัว|ยึด\s*$|^ยึด|กักบริเวณ\s*$|^กักบริเวณ/.test(t.trim()) && !/ถูก/.test(t)) return 'liege';
  if (/ถูก.*(?:ยึด|กักกัน|กักบริเวณ)|พันธมิตรของ/.test(t)) return /พันธมิตร/.test(t) ? 'ally' : 'vassal';
  if (/ผู้ลี้ภัย/.test(t) && !/รับ/.test(t.split('จาก')[0] ?? '')) return 'refugee';
  if (/รับ.*ผู้ลี้ภัย|รับกูล|รับดาร์กเอลฟ์|^กูล/.test(t)) return 'refugee';
  if (/ตามล่า|ศัตรู|เกลียด|แค้น|ลอบสังหาร|ต่อต้าน|รังเกียจ|แนวหน้า vs/.test(t)) return 'foe';
  if (/ตึงเครียด|ขัดแย้ง|ทะเลาะ|ระแวง|ไม่ไว้ใจ|กลัว|แข่ง|คู่แข่ง|กดดัน|ห่างเหิน|แทรกซึม/.test(t)) return 'tense';
  if (/พันธมิตร/.test(t)) return 'ally';
  if (/เครือญาติ|ญาติ/.test(t)) return 'kin';
  if (/เพื่อน|ใกล้ชิด|เห็นใจ|เห็นอกเห็นใจ|ร่วมมือ|ร่วมภารกิจ|ไกล่เกลี่ย|ผูกพัน|ปกป้อง|หนุน|กองหนุน|ช่วยเหลือ|^ใกล้/.test(t)) return 'friend';
  if (/ค้า|ซื้อ|ขาย|ลูกค้า|แลกเปลี่ยน|ทุน|ส่งข้าว|เจ้าหนี้|ลูกหนี้|ติดหนี้|เงินช่วย|เงินสนับสนุน|ส่งออก|ใช้ผ่าน|ใช้ผู้นำทาง|ตลาดงาน|ว่าจ้าง|ผงเรืองแสงส่ง|ปลายทางของ|ผู้ซื้อ|ส่งของ/.test(t)) return 'trade';
  if (/ติดต่อ|ทูต|สายข่าว|ข่าวสาร|สัญญา|สนธิสัญญา/.test(t)) return 'contact';
  if (/สภา|ส่งสาร/.test(t)) return 'contact';
  if (/เป็นกลาง/.test(t)) return 'neutral';
  if (/ลับ|เงียบ|ไม่เปิดเผย|ปกปิด/.test(t)) return 'secret';
  return 'other';
}

function parseRelations(self: CountryId, raw: string, valid: Set<string>, unparsed: Unparsed, file: string, line: number): Relation[] {
  const out: Relation[] = [];
  const add = (to: string, kind: RelationKind, secret: boolean, text: string) => {
    if (to === self || !valid.has(to)) return;
    if (out.some((r) => r.to === to && r.kind === kind)) return;
    out.push({ to, kind, secret, text, reciprocated: false });
  };
  for (const seg of raw.split(' · ')) {
    for (const clause of seg.split(' แต่ ')) {
      const codes = expandCodes(clause);
      if (!codes.length) continue;
      const kind = classify(clause);
      const secret = /ลับ|เงียบ|ไม่เปิดเผย|ปกปิด/.test(clause);
      if (kind === 'other') unparsed.add(file, line, clause.trim(), 'ความสัมพันธ์ระหว่างประเทศ: ไม่ทราบชนิด');
      for (const c of codes) add(c, kind, secret, clause.trim());
    }
  }
  return out;
}

// ---------- reading the country lore ----------

interface RawCountry {
  id: CountryId;
  cont: ContinentId;
  index: number;
  name: string;
  title: string;
  gov: string;
  races: string;
  religion: string;
  story: string;
  rel: string;
  hook: string;
  line: number;
  file: string;
}

const NO_BLOC = /เป็นกลาง|นอกกลุ่ม|โดดเดี่ยว|ตัวแปร|พึ่งพา|ผลผลิต/;

function readCountryLore(): { countries: RawCountry[]; blocs: Map<ContinentId, Bloc[]>; heads: Map<ContinentId, { title: string }> } {
  const countries: RawCountry[] = [];
  const blocsBy = new Map<ContinentId, Bloc[]>();
  const heads = new Map<ContinentId, { title: string }>();
  COUNTRY_FILES.forEach((f, ci) => {
    const file = `docs/lore/countries/${f}.md`;
    const cont = CONTINENTS[ci].id;
    const lines = numberedLines(file);
    const blocs: Bloc[] = [];
    heads.set(cont, { title: lines[0].l.replace(/^#\s*/, '') });
    const addBloc = (name: string, members: string[], placed: boolean) => {
      if (!members.length) return;
      const ex = blocs.find((b) => b.name === name);
      if (ex) ex.members = uniq([...ex.members, ...members]);
      else blocs.push({ name, members: uniq(members), placed });
    };
    let inBlocs = false;
    for (const { l } of lines) {
      const br = l.match(/^\| (กิ่ง\S+) \|/); // Silvanel: the branches of the world tree are its blocs
      if (br) addBloc(br[1], l.match(/[A-Z]{2}-\d\d/g) || [], true);
      if (l.startsWith('**กลุ่ม**')) {
        inBlocs = true;
        continue;
      }
      if (inBlocs && l.startsWith('**')) inBlocs = false;
      if (!inBlocs) continue;
      const m = l.match(/\*\*([^*]+)\*\*/);
      if (!m) continue;
      addBloc(m[1].trim(), l.replace(m[0], '').match(/[A-Z]{2}-\d\d/g) || [], !NO_BLOC.test(m[1]));
    }
    blocsBy.set(cont, blocs);
    let cur: RawCountry | null = null;
    let index = 0;
    for (const { l, line } of lines) {
      const h = l.match(/^#### ([A-Z]{2}-\d\d) (\S+) — (.+)$/);
      if (h) {
        cur = { id: h[1], cont, index: ++index, name: h[2], title: h[3].trim(), gov: '', races: '', religion: '', story: '', rel: '', hook: '', line, file };
        countries.push(cur);
        continue;
      }
      if (!cur) continue;
      if (l.startsWith('- **รัฐ:**')) {
        const field = (key: string) => l.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*(.*?)(?:\\s+·\\s+\\*\\*|$)`))?.[1].trim() ?? '';
        cur.gov = field('รัฐ');
        cur.races = field('เผ่า');
        cur.religion = field('ศาสนา');
        continue;
      }
      cur.story = bulletField(l, 'เรื่องราว') ?? cur.story;
      cur.rel = bulletField(l, 'ความสัมพันธ์') ?? cur.rel;
      cur.hook = bulletField(l, 'ปมเรื่องหลัก') ?? cur.hook;
    }
  });
  return { countries, blocs: blocsBy, heads };
}

// ---------- economy of the countries ----------

const G_VALUES = ['ต่ำ', 'กลาง', 'สูง', 'สูงมาก'] as const;
const M_VALUES = ['เต็ม', 'ผสม', 'น้อย'] as const;

function readEconomy() {
  const catTable = tables('docs/systems/economy/01-world-economy.md').find((t) => t.header[0] === 'รหัส' && t.header[1] === 'หมวด');
  if (!catTable) throw new Error('01-world-economy: goods table not found');
  const cats = catTable.rows.map((r) => ({ code: r.cells[0], name: r.cells[1] }));
  const splitGoods = (s: string): string[] => {
    const out: string[] = [];
    let rest = s.trim();
    while (rest && rest !== '—') {
      const c = cats.find((x) => rest.startsWith(x.name));
      if (!c) throw new Error(`02-countries: unknown goods category in "${s}"`);
      out.push(c.code);
      rest = rest.slice(c.name.length).trim();
    }
    return out;
  };
  const econ = new Map<string, CountryEcon>();
  for (const t of tables('docs/systems/economy/02-countries.md')) {
    if (t.header[0] !== 'รหัส' || t.header[2] !== 'W ฐาน → ผล') continue;
    for (const r of t.rows) {
      const m = r.cells[2].match(/^(\d) → (\d)$/);
      if (!m) throw new Error(`02-countries:${r.line}: bad W cell "${r.cells[2]}"`);
      if (!(G_VALUES as readonly string[]).includes(r.cells[3]) || !(M_VALUES as readonly string[]).includes(r.cells[4])) throw new Error(`02-countries:${r.line}: bad G or M`);
      econ.set(r.cells[0], {
        wBase: Number(m[1]),
        w: Number(m[2]),
        g: r.cells[3] as CountryEcon['g'],
        m: r.cells[4] as CountryEcon['m'],
        exports: splitGoods(r.cells[5]),
        shortages: splitGoods(r.cells[6]),
        why: r.cells[7] ?? '',
      });
    }
  }
  // W level table: income index
  const incomeIndex: Record<string, number> = {};
  for (const t of tables('docs/systems/economy/02-countries.md'))
    if (t.header[0] === 'W' && t.header[3] === 'ดัชนีรายได้') for (const r of t.rows) incomeIndex[r.cells[0]] = Number(r.cells[3].replace('×', ''));
  return { econ, incomeIndex };
}

function readClassRules() {
  const sec = readDoc('docs/systems/economy/03-classes.md').split('## 8. NPC')[1].split(/^## 9\./m)[0];
  const rows = sec
    .split('\n')
    .filter((l) => l.startsWith('| ') && !/^\| (---|ลำดับ|NPC|ชั้น) /.test(l))
    .map(cells);
  const keywordRules = rows
    .filter((c) => /^\d+$/.test(c[0]) && /^\d$/.test(c[2]) && !/รหัสลงท้าย|ที่เหลือ|ยกเว้น/.test(c[1]))
    .map((c) => [Number(c[2]), c[1].split(/\s+/)] as [number, string[]]);
  const exceptions = Object.fromEntries(rows.filter((c) => /^[A-Z]{2}\d{2}-\d /.test(c[0])).map((c) => [c[0].split(' ')[0], Number(c[1])]));
  const median: Record<string, number> = {};
  for (const c of rows) if (/^\d$/.test(c[0]) && c.length === 3 && /^[\d,]+$/.test(c[1])) median[c[0]] = num(c[1]);
  if (keywordRules.length !== 4 || Object.keys(median).length !== 5) throw new Error('03-classes §8: expected 4 keyword rules and 5 class medians');
  return { keywordRules, exceptions, median };
}

// ---------- appearance of the countries ----------

function readCityUi(): { ui: Map<string, Record<string, string>>; look: Map<string, Country['look']> } {
  const ui = new Map<string, Record<string, string>>();
  const look = new Map<string, Country['look']>();
  const LABELS: [string, keyof Country['look']][] = [
    ['มุมสูง', 'aerial'], ['ระดับสายตา', 'street'], ['วัสดุและสี', 'materials'], ['เสียงและกลิ่น', 'sound'], ['ผู้คน', 'people'], ['จุดเด่น', 'landmark'], ['ผิดปกติ', 'oddity'],
  ];
  const put = (id: string, p: Record<string, string>) => ui.set(id, { ...(ui.get(id) ?? {}), ...p });
  for (const f of COUNTRY_FILES) {
    let cur = '';
    for (const l of readDoc(`docs/appearance/countries/${f}.md`).split('\n')) {
      const h = l.match(/^### ([A-Z]{2}-\d\d) /);
      if (h) {
        cur = h[1];
        look.set(cur, { aerial: '', street: '', materials: '', sound: '', people: '', landmark: '', oddity: '' });
        continue;
      }
      if (!cur) continue;
      const u = bulletField(l, 'ค่า UI');
      if (u !== null) {
        put(cur, pairs(u.replace(/`/g, '')));
        continue;
      }
      for (const [label, key] of LABELS) {
        const v = bulletField(l, label);
        if (v !== null) look.get(cur)![key] = v;
      }
    }
  }
  for (const f of ['10-scale-and-sacred', '11-context-and-landmarks']) {
    for (const l of readDoc(`docs/appearance/countries/${f}.md`).split('\n')) {
      const m = l.match(/^\| ([A-Z]{2}-\d\d) \|/);
      if (!m) continue;
      const cs = cells(l);
      const last = cs[cs.length - 1].replace(/`/g, '');
      if (/^(scale|war)=/.test(last)) put(m[1], pairs(last));
    }
  }
  return { ui, look };
}

// ---------- NPC roster ----------

interface RawNpc {
  id: NpcId;
  name: string;
  raceText: string;
  ageText: string;
  role: string;
  unique: string;
  pathsText: string;
  appearPct: number;
  file: string;
  line: number;
}

function readRoster(): RawNpc[] {
  const out: RawNpc[] = [];
  for (const file of listDocs('docs/lore/npcs', /^\d\d-.*\.md$/)) {
    for (const { l, line } of numberedLines(file)) {
      const m = l.match(/^\| ([A-Z]{2}\d{2}-\d) \| /);
      if (!m) continue;
      const c = l.slice(2, l.lastIndexOf(' |')).split(' | ');
      if (c.length !== 5) throw new Error(`${file}:${line}: ${m[1]} has ${c.length} columns, expected 5`);
      const w = c[1].match(/^\*\*(.+?)\*\* \(([^)]*)\)\s*(.*)$/);
      if (!w) throw new Error(`${file}:${line}: ${m[1]} name cell not readable`);
      const [raceText, ageText = ''] = w[2].split(' · ').map((x) => x.trim());
      const pct = c[4].match(/^(\d+)%$/);
      if (!pct) throw new Error(`${file}:${line}: ${m[1]} appear cell "${c[4]}"`);
      out.push({ id: m[1], name: w[1].trim(), raceText, ageText, role: w[3].trim(), unique: c[2], pathsText: c[3], appearPct: Number(pct[1]), file, line });
    }
  }
  return out;
}

function readNpcLooks(): Map<string, NpcLook> {
  const out = new Map<string, NpcLook>();
  for (const file of listDocs('docs/appearance/npcs', /^\d\d-.*\.md$/)) {
    for (const { l, line } of numberedLines(file)) {
      const m = l.match(/^\| ([A-Z]{2}\d{2}-\d) \| /);
      if (!m) continue;
      const c = l.slice(2, l.lastIndexOf(' |')).split(' | ');
      if (c.length !== 5) throw new Error(`${file}:${line}: ${m[1]} has ${c.length} columns, expected 5`);
      const ui = c[4].match(/^สี (#[0-9a-fA-F]{3,8}) (#[0-9a-fA-F]{3,8}) · ของ (.*) · ท่า (.*)$/);
      if (!ui) throw new Error(`${file}:${line}: ${m[1]} UI cell not readable: ${c[4].slice(0, 60)}`);
      const parts = c[2].split(' · ').map((x) => x.trim());
      out.set(m[1], {
        raceText: c[2],
        stage: parts[parts.length - 1] ?? '',
        description: c[3],
        primary: ui[1].toLowerCase(),
        secondary: ui[2].toLowerCase(),
        items: ui[3].split(/ และ |, /).map((x) => x.trim()).filter(Boolean),
        itemsRaw: ui[3],
        pose: ui[4],
        uiRaw: c[4],
      });
    }
  }
  return out;
}

function readClashes(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const { l } of numberedLines('docs/systems/combat/07-npc-clashes.md')) {
    const m = l.match(/^#### (NF-([A-Z]{2}\d{2}-\d)) /);
    if (m) out.set(m[2], [...(out.get(m[2]) ?? []), m[1]]);
  }
  return out;
}

function readAllySuccessors(): Map<string, AllySuccessor> {
  const out = new Map<string, AllySuccessor>();
  for (const { l } of numberedLines('docs/systems/bonds/07-successors.md')) {
    const m = l.match(/^\| (([A-Z]{2}\d{2}-\d)S) \| /);
    if (!m) continue;
    const c = cells(l);
    const who = c[2].match(/^\*\*(.+?)\*\* \(([^·)]*)(?: · (\d+))?\)/);
    out.set(m[2], {
      id: m[1],
      of: m[2],
      name: who ? who[1] : c[2],
      peopleText: who ? who[2].trim() : '',
      age: who && who[3] ? Number(who[3]) : null,
      relationToOriginal: c[3],
      ties: c[4],
      hook: c[5] ?? '',
    });
  }
  return out;
}

function readLives(): PeopleLife[] {
  const t = tables('docs/lore/world/world-time.md').find((x) => x.header[0] === 'เผ่า' && x.header[1].startsWith('อายุขัย'));
  if (!t) throw new Error('world-time: lifespan table not found');
  const n = (s: string) => (/^[\d.,]+$/.test(s.trim()) ? num(s) : null);
  return t.rows.map((r) => {
    const [lo, hi] = r.cells[1].replace(/,/g, '').split('–').map(Number);
    const name = r.cells[0].replace(/\s*\(.*\)$/, '');
    return { people: r.cells[0], id: peopleOf(name), lifeLo: lo, lifeHi: hi, rate: Number(r.cells[2]), adult: n(r.cells[3]) ?? 0, elder: n(r.cells[4]) ?? 0, gap: n(r.cells[5]) };
  });
}

// ---------- rules of the NPC docs ----------

function readRules(lives: PeopleLife[], classMedian: Record<string, number>, incomeIndex: Record<string, number>): NpcRules {
  const readme = readDoc('docs/lore/npcs/README.md');
  const succ = readDoc('docs/lore/npcs/succession.md');
  const need = (src: string, re: RegExp, what: string) => {
    const m = src.match(re);
    if (!m) throw new Error(`npcs rules: ${what} not found`);
    return m[1];
  };
  const axesTable = tables('docs/lore/npcs/README.md').find((t) => t.header[0] === 'แกน' && t.header[1] === 'ช่วง');
  if (!axesTable) throw new Error('npcs README: axes table not found');
  const AXIS: Record<string, RelationAxis> = { ไว้ใจ: 'trust', บุญคุณ: 'favor', แค้น: 'grudge', ความรู้จัก: 'known' };
  const axes = axesTable.rows.map((r) => {
    const label = r.cells[0].replace(/\*/g, '');
    const [lo, hi] = r.cells[1].split(' ถึง ').map(num);
    if (!AXIS[label]) throw new Error(`npcs README: unknown axis ${label}`);
    return { axis: AXIS[label], label, lo, hi };
  });
  return {
    openWindow: Number(need(readme, /เรื่องเปิดอยู่ (\d+)% ของอายุขัยผู้ถือ/, 'open window')) / 100,
    inherit: Number(need(succ, /สืบจากต้นแบบ (\d+)%/, 'inherit share')) / 100,
    tier3Refill: Number(need(succ, /(\d+)% ของแถวมีผู้สืบทุกรุ่น/, 'tier 3 refill')) / 100,
    newcomer: {
      chance: Number(need(succ, /แต่ละประเทศมีโอกาส (\d+)% ได้ NPC ที่มาใหม่/, 'newcomer chance')) / 100,
      everyYears: Number(need(succ, /ทุก (\d+) ปีโลกนับจากต้นเรื่อง/, 'newcomer years')),
      continentWeight: Number(need(succ, /น้ำหนัก ×(\d+) ของแม่แบบทั่วไป/, 'continent weight')),
    },
    axes,
    classMedian,
    incomeIndex,
    startYear: num(need(readme + '\n' + readDoc('docs/lore/npcs/01-azgar.md') + readDoc('docs/lore/world/world-time.md') + succ, START_YEAR_RE, 'start year')),
    lives,
  };
}

// ---------- NPC rows ----------

const TAG_NAMES: Record<string, PathTag> = { ช่วย: 'help', ร่วม: 'join', ขัดขวาง: 'hinder', ปล่อย: 'leave' };
const AXIS_WORDS: [string, RelationAxis][] = [['ความไว้ใจ', 'trust'], ['ไว้ใจ', 'trust'], ['บุญคุณ', 'favor'], ['ความแค้น', 'grudge'], ['แค้น', 'grudge'], ['ความรู้จัก', 'known']];
const AXIS_RE = /(ความไว้ใจ|ไว้ใจ|บุญคุณ|ความแค้น|แค้น|ความรู้จัก)(?:จาก)?([฀-๿]{0,14}?)\s?([+−])\s?(\d+)/g;
const WEIGHT_RE = /((?:cv\.\d+|[A-Z]{2,4}-\d{2,3}))(?:\s+[฀-๿]+){0,3}\s*น้ำหนัก\s*([+−])\s?(\d+)|น้ำหนัก\s*([+−])\s?(\d+)\s*([กขค])\)/g;
const RESIDUAL_RE = /[+−]\s?\d+(?:\.\d+)?|×\s?\d+(?:\.\d+)?|\d+(?:\.\d+)?\s?%/g;
const OUTCOME_VERBS = /(?:ผู้สืบทอด|สืบทอด|รับตำแหน่ง|ขึ้นแทน|ขึ้นเป็น|สืบตำแหน่ง)/;

/** Effects the NPC docs keep: stats go to `axes` and `weights`, fights to the NF- ids of the combat docs, country codes are places and not events. */
function cleanEffects(effects: Effect[], self?: string): Effect[] {
  return effects.filter((e) => {
    if (e.k === 'stat' || e.k === 'battle') return false;
    if (e.k === 'event' && (COUNTRY_ONE.test(e.id) || e.id.startsWith('LC-') || e.id.startsWith('NF-'))) return false;
    if (e.k === 'npc' && e.id === self) return false;
    return true;
  });
}

function parsePath(
  raw: RawNpc,
  key: PathKey,
  pct: number,
  text: string,
  ids: ReturnType<typeof idIndex>,
  validCountries: Set<string>,
  unparsed: Unparsed,
): { path: NpcPath; cuts: PathCut[] } {
  const tags = uniq([...text.matchAll(/\[(ช่วย|ร่วม|ขัดขวาง|ปล่อย)\]/g)].map((m) => TAG_NAMES[m[1]]));
  const mcMention = /ตัวละครหลัก/.test(text);
  const needsMc = !tags.includes('leave') && (tags.includes('help') || tags.includes('join') || tags.includes('hinder') || mcMention);
  let work = ` ${text} `;
  const eat = (re: RegExp) => {
    work = work.replace(re, ' ');
  };

  // axis changes toward the main character
  const axes: AxisDelta[] = [];
  for (const m of text.matchAll(AXIS_RE)) {
    const axis = AXIS_WORDS.find(([w]) => w === m[1])![1];
    const sign = m[3] === '−' ? -1 : 1;
    const toward = m[2] && PEOPLE_KEYS.some(([k]) => m[2].startsWith(k.replace(/^เผ่า/, ''))) ? m[2] : undefined;
    axes.push(toward ? { axis, delta: sign * Number(m[4]), toward } : { axis, delta: sign * Number(m[4]) });
  }
  eat(AXIS_RE);

  const allyChance = Number(text.match(/พวกพ้อง\s*(\d+)%/)?.[1] ?? 0) / 100;
  eat(/พวกพ้อง\s*\d+%/g);

  // weight changes on events, convergences or the other paths
  const weights: { target: string; delta: number }[] = [];
  for (const m of text.matchAll(WEIGHT_RE)) {
    if (m[1]) weights.push({ target: m[1], delta: (m[2] === '−' ? -1 : 1) * Number(m[3]) });
    else weights.push({ target: `path.${PATH_KEYS[m[6]]}`, delta: (m[4] === '−' ? -1 : 1) * Number(m[5]) });
  }
  eat(WEIGHT_RE);

  // cuts: `ถ้า DR-01 ตัดก)` and conditions: `ถ้า DR-01 เกิดก่อน ...`
  const cuts: PathCut[] = [];
  let cond: Condition | null = null;
  for (const m of text.matchAll(/ถ้า\s*(.+?)\s*ตัด([กขค])\)/g)) {
    const when = parseCondition(m[1], ids);
    cuts.push({ from: key, cut: PATH_KEYS[m[2]], when, text: m[0] });
    if (!when) unparsed.add(raw.file, raw.line, m[0], `${raw.id} ${key}: เงื่อนไขตัดทางอ่านไม่ได้`);
  }
  eat(/ถ้า\s*(.+?)\s*ตัด[กขค]\)/g);
  const noCut = text.replace(/ถ้า\s*(.+?)\s*ตัด[กขค]\)/g, ' ');
  for (const m of noCut.matchAll(/(?:^|\s|·)ถ้า\s*((?:[A-Z]{2,4}-\d{2,3})(?:\s*(?:หรือ|หรือ)\s*[A-Z]{2,4}-\d{2,3})*)\s*([฀-๿]+)/g)) {
    const c = parseCondition(m[1], ids);
    if (c && !cond) cond = c;
  }
  const looksConditional = [...text.matchAll(/(?:^|\s|·)ถ้า\s*(?:[A-Z]{2,4}-\d{2,3}|→)/g)];
  if (looksConditional.length && !cond && !cuts.length) unparsed.add(raw.file, raw.line, text.slice(0, 80), `${raw.id} ${key}: เงื่อนไข ถ้า อ่านไม่ได้`);

  // effects from the shared grammar; stats and battle markers are handled elsewhere (axes above, NF- clashes in the combat docs)
  const parsed = parseCell(text.replace(/\[(?:ช่วย|ร่วม|ขัดขวาง|ปล่อย)\]/g, ' '), ids);
  const effects: Effect[] = cleanEffects(parsed.effects, raw.id);
  // a path whose first words say the NPC dies (`ตายก่อน AZ01-3 รับตำแหน่ง`)
  const dies = text.match(/^(ตาย|ถูกฆ่า|พลีชีพ)(\S*)/);
  if (dies && !effects.some((e) => e.k === 'death')) effects.unshift({ k: 'death', cause: dies[0] });
  const eventsHere = uniq([...text.matchAll(EVENT_ID)].map((m) => m[0]));
  const npcsHere = uniq([...text.matchAll(NPC_ID)].map((m) => m[0])).filter((x) => x !== raw.id);
  for (const e of eventsHere) if (!effects.some((x) => x.k === 'event' && x.id === e)) effects.push({ k: 'event', id: e });
  for (const n of npcsHere) if (!effects.some((x) => x.k === 'npc' && x.id === n)) effects.push({ k: 'npc', id: n });

  // M0-c (data review M7): a label with `ถ้า` or `เมื่อ` says when the path happens, so the events it names are the condition (or a cut), not results
  const cutIds = uniq([...text.matchAll(/ถ้า\s*(.+?)\s*ตัด[กขค]\)/g)].flatMap((m) => [...m[1].matchAll(EVENT_ID)].map((x) => x[0])));
  if (TRIGGER_WORD.test(noCut)) {
    // events in the clause that follows the word, up to the arrow (a bracket only names a form: `(SF-09)`); with none there, the events the arrow names are what the path waits for
    const clauses = [...noCut.matchAll(/(?:(?<!เ)ถ้า|เมื่อ)([^→·]*)/g)].map((m) => m[1]);
    const idsOf = (t: string) => [...t.matchAll(EVENT_ID)].map((x) => x[0]);
    const inClause = uniq(clauses.flatMap((c) => {
      const outside = idsOf(c.replace(/\([^)]*\)/g, ' '));
      return outside.length ? outside : idsOf(c);
    }));
    const waits = inClause.length ? inClause : uniq(idsOf(noCut));
    const near = (id: string) => new RegExp(`${id}\\s*ใกล้`).test(noCut);
    const ev = (id: string): WorldCond => ({ k: 'event', id, happened: true, ...(near(id) ? { phase: 'near' as const } : {}) });
    const have = (c: Condition | null, id: string): boolean => !!c && JSON.stringify(c).includes(`"id":"${id}"`);
    const fresh = waits.filter((id) => !have(cond, id));
    if (fresh.length) {
      const wait: WorldCond = fresh.length === 1 ? ev(fresh[0]) : { k: waitAny.test(clauses.join(' ')) ? 'or' : 'and', of: fresh.map(ev) };
      cond = cond ? { k: 'and', of: [cond, wait] } : wait;
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const x = effects[i];
      if (x.k === 'event' && (waits.includes(x.id) || cutIds.includes(x.id))) effects.splice(i, 1);
    }
  } else if (cutIds.length) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const x = effects[i];
      if (x.k === 'event' && cutIds.includes(x.id)) effects.splice(i, 1);
    }
  }

  // anything that still looks like a number-bearing effect
  work = work.replace(/\[(?:ช่วย|ร่วม|ขัดขวาง|ปล่อย)\]/g, ' ');
  for (const m of work.matchAll(RESIDUAL_RE)) {
    const at = work.indexOf(m[0]);
    unparsed.add(raw.file, raw.line, work.slice(Math.max(0, at - 24), at + m[0].length + 24).replace(/\s+/g, ' ').trim(), `${raw.id} ${key}: ตัวเลขที่ไม่ใช่ผลที่อ่านได้`);
  }
  void validCountries;

  return {
    path: { key, pct, text, tags, needsMc, repays: /คืนบุญ/.test(text), ...(allyChance ? { allyChance } : {}), axes, weights, cond, effects, events: eventsHere, npcs: npcsHere },
    cuts,
  };
}

function buildNpc(
  raw: RawNpc,
  look: NpcLook,
  ctx: {
    ids: ReturnType<typeof idIndex>;
    valid: Set<string>;
    unparsed: Unparsed;
    classRules: ReturnType<typeof readClassRules>;
    econ: Map<string, CountryEcon>;
    incomeIndex: Record<string, number>;
    clashes: Map<string, string[]>;
    allies: Map<string, AllySuccessor>;
    rules: NpcRules;
  },
): NpcRow {
  const country = raw.id.replace(/^([A-Z]{2})(\d{2})-\d$/, '$1-$2');
  const continent = country.slice(0, 2) as ContinentId;
  const seq = Number(raw.id.slice(-1));
  const [peopleId, halfPeopleId] = peoplePair(raw.raceText);
  const age = /^[\d,]+$/.test(raw.ageText) ? num(raw.ageText) : null;

  const parts = raw.pathsText.split(/(?=[กขค]\) \d+%)/).map((s) => s.trim()).filter(Boolean);
  const paths: NpcPath[] = [];
  const cuts: PathCut[] = [];
  // row-level clauses at the end of a path: `· เชื่อม AZ02-3 นางโมเรียซาก DR-02` (linked NPCs and events) and `· ผูก LC-71` (bound local event)
  const links: NpcId[] = [];
  const linkEvents: string[] = [];
  const binds: string[] = [];
  for (const p of parts) {
    const m0 = p.match(/^([กขค])\) (\d+)%\s*(.*)$/);
    if (!m0) throw new Error(`${raw.file}:${raw.line}: ${raw.id} path not readable: ${p.slice(0, 50)}`);
    const keep: string[] = [];
    for (const seg of m0[3].split(' · ')) {
      const lk = seg.match(/^(เชื่อม|ผูก)\s+(.*)$/);
      if (!lk) {
        keep.push(seg);
        continue;
      }
      if (lk[1] === 'เชื่อม') {
        links.push(...[...lk[2].matchAll(NPC_ID)].map((x) => x[0]));
        linkEvents.push(...[...lk[2].matchAll(EVENT_ID)].map((x) => x[0]));
      } else binds.push(...lk[2].match(/\b[A-Z]{2,4}-\d{2,3}\b/g)!);
    }
    const m = [m0[0], m0[1], m0[2], keep.join(' · ')];
    const r = parsePath(raw, PATH_KEYS[m[1]], Number(m[2]), m[3].trim(), ctx.ids, ctx.valid, ctx.unparsed);
    paths.push(r.path);
    cuts.push(...r.cuts);
  }
  if (paths.length !== 3 || paths.map((p) => p.key).join('') !== 'abc') throw new Error(`${raw.file}:${raw.line}: ${raw.id} should have paths ก ข ค`);
  const sum = paths.reduce((a, p) => a + p.pct, 0);
  if (sum > 100) throw new Error(`${raw.file}:${raw.line}: ${raw.id} path chances sum to ${sum}`);

  // opening point: world events named outside the arrows (README §2.1 item 1; same test as scripts/sim/sim-npc-density.mjs)
  const body = `${raw.unique} ${raw.pathsText}`.replace(/→\s*(?:`?(?:[A-Z]{2,4}-\d{2,3})`?(?:\s*(?:,|\/|และ|หรือ)\s*)?)+/g, ' ');
  const openEvents = uniq([...body.matchAll(EVENT_ID)].map((m) => m[0]));
  const clock: NpcClockRule = { open: openEvents.length ? 'event' : 'age', events: openEvents, window: ctx.rules.openWindow };

  const allEvents = uniq([...`${raw.unique} ${raw.pathsText}`.matchAll(EVENT_ID)].map((m) => m[0]));

  const refs: NpcRef[] = [];
  const scan = (text: string, where: NpcRef['in']) => {
    for (const m of text.matchAll(NPC_ID)) {
      if (m[0] === raw.id) continue;
      const before = text.slice(Math.max(0, (m.index ?? 0) - 24), m.index);
      const rel: NpcRef['rel'] = OUTCOME_VERBS.test(before) ? 'successor' : 'ref';
      const ex = refs.find((r) => r.to === m[0] && r.in === where);
      if (!ex) refs.push({ to: m[0], in: where, rel });
      else if (rel === 'successor') ex.rel = rel;
    }
  };
  scan(raw.unique, 'unique');
  for (const p of paths) scan(p.text, p.key);
  for (const to of uniq(links)) if (to !== raw.id && !refs.some((r) => r.to === to && r.in === 'link')) refs.push({ to, in: 'link', rel: 'ref' });

  const leader = seq === 1;
  const ally = ctx.allies.get(raw.id);
  const tier: 1 | 2 | 3 = ally ? 1 : leader || openEvents.length ? 2 : 3;

  // class and gold (03-classes.md §8)
  const text = `${raw.name} ${raw.role}`;
  const cls = ctx.classRules.exceptions[raw.id] ?? (leader ? 5 : (ctx.classRules.keywordRules.find(([, words]) => words.some((w) => text.includes(w))) || [3])[0]);
  const w = ctx.econ.get(country)?.w;
  if (!w) throw new Error(`${raw.id}: no W for ${country}`);
  const gold = Math.round(ctx.classRules.median[cls] * (ctx.incomeIndex[w] ?? 1));

  const group: NpcRow['group'] = seq === 1 ? 'leader' : seq <= 4 ? 'regular' : seq === 5 ? 'half' : seq === 6 ? 'minor' : 'bound';
  return {
    id: raw.id,
    country,
    continent,
    seq,
    group,
    name: raw.name,
    raceText: raw.raceText,
    peopleId,
    halfPeopleId,
    ageText: raw.ageText,
    age,
    role: raw.role,
    unique: raw.unique,
    appearPct: raw.appearPct,
    paths,
    restPct: 100 - sum,
    cuts,
    clock,
    succession: { tier, leader, inherit: ctx.rules.inherit, refill: tier === 3 ? ctx.rules.tier3Refill : 1, ...(ally ? { allySuccessor: ally } : {}) },
    refs,
    links: uniq(links).filter((x) => x !== raw.id),
    linkEvents: uniq(linkEvents),
    binds: uniq(binds),
    refBy: [],
    events: allEvents,
    cls,
    gold,
    clashes: ctx.clashes.get(raw.id) ?? [],
    look,
    src: `${raw.file}:${raw.line}`,
  };
}

// ---------- newcomer templates NT-01 to NT-54 ----------

const ERA_ORDER: EraTag[] = ['1', '2', '3', '4a', '4b', '4c'];
const ERA_SUB: Record<string, string> = { ก: 'a', ข: 'b', ค: 'c' };

function parseEras(text: string): EraTag[] {
  const toks = [...text.matchAll(/(\d)([กขค])?/g)].map((m) => (m[2] ? `${m[1]}${ERA_SUB[m[2]]}` : m[1]));
  if (!toks.length) return [];
  const tag = (t: string): EraTag[] => (t === '4' ? ['4a', '4b', '4c'] : [t as EraTag]);
  const first = ERA_ORDER.indexOf(tag(toks[0])[0]);
  const last = ERA_ORDER.indexOf(tag(toks[toks.length - 1]).slice(-1)[0]);
  return toks.length === 1 ? tag(toks[0]) : ERA_ORDER.slice(first, last + 1);
}

function readTemplates(ids: ReturnType<typeof idIndex>, unparsed: Unparsed): NpcTemplate[] {
  const t = tables('docs/lore/npcs/succession.md').find((x) => x.header[0].startsWith('ID'));
  if (!t) throw new Error('succession: template table not found');
  const out: NpcTemplate[] = [];
  for (const r of t.rows) {
    const m = r.cells[0].match(/^(NT-(\d\d)) (.+)$/);
    if (!m) throw new Error(`succession.md:${r.line}: template id not readable`);
    const paths = (['a', 'b', 'c'] as PathKey[]).map((key, i) => {
      const p = parseCell(r.cells[4 + i], ids, { weighted: true });
      for (const u of p.unparsed) unparsed.add('docs/lore/npcs/succession.md', r.line, u, `${m[1]} ${key}: ผลของแม่แบบ`);
      return { key, weight: p.weight ?? 0, label: p.label, effects: cleanEffects(p.effects) };
    });
    const cond = r.cells[2];
    out.push({
      id: m[1],
      name: m[3],
      eras: parseEras(r.cells[1]),
      eraText: r.cells[1],
      conditionText: cond,
      needs: uniq([...cond.matchAll(/`([a-z]+=[a-z|]+)`/g)].map((x) => x[1])),
      continents: CONTINENTS.filter((c) => cond.includes(c.name)).map((c) => c.id),
      secret: r.cells[3],
      paths,
      links: r.cells[7].split(/\s+/).filter(Boolean),
      continentTemplate: Number(m[2]) >= 19,
      src: `docs/lore/npcs/succession.md:${r.line}`,
    });
  }
  return out;
}

// ---------- continents ----------

function readContinents(rawCountries: RawCountry[], blocs: Map<ContinentId, Bloc[]>): ContinentsFile {
  const overview = tables('docs/lore/world/continents.md').find((t) => t.header[0] === '#' && t.header[1] === 'ทวีป');
  if (!overview) throw new Error('continents.md: overview table not found');
  const mapTable = tables('docs/lore/world/world-map.md').find((t) => t.header[0] === 'ทวีป' && t.header[1] === 'ตำแหน่ง');
  const themeTable = tables('docs/lore/world/world-map.md').find((t) => t.header[0] === 'ทวีป' && t.header[1] === 'ผังเมือง');
  if (!mapTable || !themeTable) throw new Error('world-map.md: tables not found');

  // docs/appearance/01-continents.md
  const look = new Map<string, Continent['look']>();
  const uiRaw = new Map<string, string>();
  const LABELS: [string, keyof Continent['look']][] = [
    ['ภาพรวม', 'overview'], ['พื้นและฟ้า', 'ground'], ['แสงและสี', 'light'], ['เสียงและกลิ่น', 'sound'], ['เมือง', 'city'], ['ผู้คน', 'people'], ['สิ่งที่ผิดปกติ', 'oddity'],
  ];
  let curName = '';
  for (const l of readDoc('docs/appearance/01-continents.md').split('\n')) {
    const h = l.match(/^## \d+\. (\S+) /);
    if (h) {
      curName = h[1];
      look.set(curName, { overview: '', ground: '', light: '', sound: '', city: '', people: '', oddity: '' });
      continue;
    }
    if (l.startsWith('## ')) curName = '';
    if (!curName) continue;
    const u = l.match(/^\*\*ค่า UI\*\*\s*(.*)$/);
    if (u) {
      uiRaw.set(curName, u[1]);
      continue;
    }
    for (const [label, key] of LABELS) {
      const m = l.match(new RegExp(`^\\*\\*${label}\\*\\*\\s*(.*)$`));
      if (m) look.get(curName)![key] = m[1].trim();
    }
  }
  const parseUi = (raw: string): ContinentUi => {
    const seg = (key: string) => {
      const m = raw.match(new RegExp(`(?:^|· )${key}\\s+([^·]*?)\\s*(?:·|$)`));
      return m ? m[1].trim() : '';
    };
    const list = (key: string) => seg(key).split(/\s+/).filter(Boolean);
    return { palette: seg('ชุดสี').split(/\s+/).filter((x) => x.startsWith('#')), forms: list('ทรง'), plan: list('ผัง'), ambient: list('บรรยากาศ'), wall: list('กำแพง'), centre: list('กลางเมือง'), raw };
  };

  const continents: Continent[] = CONTINENTS.map((c, i) => {
    const row = overview.rows.find((r) => r.cells[2] === c.name);
    if (!row) throw new Error(`continents.md: no row for ${c.name}`);
    const mapRow = mapTable.rows.find((r) => r.cells[0] === c.name);
    const themeRow = themeTable.rows.find((r) => r.cells[0] === c.name);
    if (!mapRow || !themeRow) throw new Error(`world-map.md: no row for ${c.name}`);
    const lk = look.get(c.name);
    const ur = uiRaw.get(c.name);
    if (!lk || !ur) throw new Error(`01-continents.md: no section for ${c.name}`);
    const neighbours: { id: ContinentId; via: string }[] = [];
    const nm = [...mapRow.cells[2].matchAll(/([฀-๿-]+?)(?:\s*\(([^)]*)\))?(?=\s|$)/g)];
    for (const m of nm) {
      const id = CONT_BY_NAME.get(m[1]);
      if (id) neighbours.push({ id, via: m[2] ?? '' });
    }
    const countries = rawCountries.filter((x) => x.cont === c.id).map((x) => x.id);
    return {
      id: c.id,
      index: i + 1,
      name: c.name,
      nickname: row.cells[1],
      climate: row.cells[3],
      countryCount: Number(row.cells[4]),
      rule: row.cells[5],
      gauge: row.cells[6],
      countries,
      blocs: blocs.get(c.id) ?? [],
      look: lk,
      ui: parseUi(ur),
      map: { position: mapRow.cells[1], neighbours, reason: mapRow.cells[3] },
      cityTheme: { plan: themeRow.cells[1], buildings: themeRow.cells[2], features: themeRow.cells[3] },
      src: `docs/lore/world/continents.md:${row.line}`,
    };
  });

  // world map
  const mapText = readDoc('docs/lore/world/world-map.md');
  const size = mapText.match(/ขนาด (\d+) × (\d+) หน่วย \(MU\) 1 MU = ([\d.]+) หน่วยโลก = ([\d.]+) tile/);
  if (!size) throw new Error('world-map.md: map size not found');
  const zoomTable = tables('docs/lore/world/world-map.md').find((t) => t.header[0] === 'ระดับ' && t.header[1].startsWith('ซูม'));
  if (!zoomTable) throw new Error('world-map.md: zoom table not found');
  const ZOOM_IDS: ZoomLevel['id'][] = ['world', 'continent', 'country', 'city', 'inside'];
  const zoomLevels: ZoomLevel[] = zoomTable.rows.map((r, i) => {
    const nums = [...r.cells[1].matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    const below = r.cells[1].startsWith('ต่ำกว่า');
    return { id: ZOOM_IDS[i], name: r.cells[0], zoomMin: below ? null : nums[0], zoomMax: below ? nums[0] : nums[1], sees: r.cells[2] };
  });
  const linkLine = mapText.split('\n').find((l) => l.startsWith('อัลเดรีย–ซิลวาเนล'));
  if (!linkLine) throw new Error('world-map.md: land link line not found');
  const landLinks = linkLine
    .split(' · ')
    .map((p) => p.replace(/\s*\(.*\)$/, '').split('–'))
    .map(([a, b]) => [CONT_BY_NAME.get(a.trim()), CONT_BY_NAME.get(b.trim())] as [ContinentId, ContinentId]);
  if (landLinks.some(([a, b]) => !a || !b)) throw new Error('world-map.md: unknown continent in land links');
  const lm = tables('docs/lore/world/world-map.md').find((t) => t.header[0] === 'จุด' && t.header[1] === 'ที่');
  if (!lm) throw new Error('world-map.md: landmark table not found');
  const world: WorldMap = {
    width: Number(size[1]),
    height: Number(size[2]),
    unitToWorld: Number(size[3]),
    unitToTile: Number(size[4]),
    zoomLevels,
    landLinks,
    landmarks: lm.rows.map((r) => ({ name: r.cells[0], at: r.cells[1], drawnAs: r.cells[2] })),
  };
  return { continents, world };
}

// ---------- run ----------

export default function run(): GenReport {
  const unparsed = new Unparsed('npcs');
  const ids = idIndex();

  const lore = readCountryLore();
  const valid = new Set(lore.countries.map((c) => c.id));
  const faiths = readFaiths();
  const { econ, incomeIndex } = readEconomy();
  const classRules = readClassRules();
  const cityUi = readCityUi();
  const lives = readLives();
  const rules = readRules(lives, classRules.median, incomeIndex);
  const roster = readRoster();
  const looks = readNpcLooks();
  const clashes = readClashes();
  const allies = readAllySuccessors();

  // NPCs
  const npcs: NpcRow[] = roster.map((raw) => {
    const look = looks.get(raw.id);
    if (!look) throw new Error(`${raw.id}: no row in docs/appearance/npcs`);
    return buildNpc(raw, look, { ids, valid, unparsed, classRules, econ, incomeIndex, clashes, allies, rules });
  });
  const byId = new Map(npcs.map((n) => [n.id, n]));
  for (const n of npcs) for (const r of n.refs) byId.get(r.to)?.refBy.push(n.id);
  for (const n of npcs) n.refBy = uniq(n.refBy).sort();
  const templates = readTemplates(ids, unparsed);

  // countries
  const countries: Country[] = lore.countries.map((rc) => {
    const e = econ.get(rc.id);
    const ui = cityUi.ui.get(rc.id);
    const lk = cityUi.look.get(rc.id);
    if (!e || !ui || !lk) throw new Error(`${rc.id}: missing economy or appearance row`);
    const blocs = lore.blocs.get(rc.cont) ?? [];
    return {
      id: rc.id,
      continent: rc.cont,
      index: rc.index,
      name: rc.name,
      title: rc.title,
      gov: rc.gov,
      races: rc.races,
      religionRaw: rc.religion,
      religions: parseFaiths(rc.religion, faiths),
      story: rc.story,
      relationsRaw: rc.rel,
      relations: parseRelations(rc.id, rc.rel, valid, unparsed, rc.file, rc.line),
      hook: rc.hook,
      bloc: blocs.find((b) => b.placed && b.members.includes(rc.id))?.name ?? '',
      econ: e,
      ui: mergeUi(ui),
      look: lk,
      npcs: npcs.filter((n) => n.country === rc.id).map((n) => n.id),
      src: `${rc.file}:${rc.line}`,
    };
  });
  const cById = new Map(countries.map((c) => [c.id, c]));
  for (const c of countries) for (const r of c.relations) r.reciprocated = !!cById.get(r.to)?.relations.some((x) => x.to === c.id);

  const continents = readContinents(lore.countries, lore.blocs);

  // outputs
  const gen = 'scripts/codegen/groups/npcs.ts';
  const countryDocs = COUNTRY_FILES.map((f) => `docs/lore/countries/${f}.md`);
  const look = COUNTRY_FILES.map((f) => `docs/appearance/countries/${f}.md`);
  const common = ['docs/systems/economy/02-countries.md', 'docs/systems/economy/01-world-economy.md'];
  writeGen(
    'npcs',
    { npcs, templates, rules } satisfies NpcsFile,
    [...listDocs('docs/lore/npcs'), ...listDocs('docs/appearance/npcs'), ...common, 'docs/systems/economy/03-classes.md', 'docs/systems/combat/07-npc-clashes.md', 'docs/systems/bonds/07-successors.md', 'docs/lore/world/world-time.md'],
    gen,
  );
  writeGen(
    'countries',
    countries,
    [...countryDocs, ...look, 'docs/appearance/countries/10-scale-and-sacred.md', 'docs/appearance/countries/11-context-and-landmarks.md', ...common, 'docs/lore/religions/README.md'],
    gen,
  );
  writeGen('continents', continents, ['docs/lore/world/continents.md', 'docs/lore/world/world-map.md', 'docs/appearance/01-continents.md', ...countryDocs], gen);
  unparsed.write();
  return { group: 'npcs', files: ['npcs.json', 'countries.json', 'continents.json'], unparsed: unparsed.count, strict: false };
}
