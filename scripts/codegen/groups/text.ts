// Text generator (code-plan §5.1, row "ข้อความ"): the name word bank (docs/systems/llm/05-name-bank.md, 740 words),
// the god templates (06, 539) and the ending templates (07, 437). Writes data/gen/names.json templates-god.json templates-ending.json.
import type { NamesData, Slot, Template, TemplateFamily, TemplatesData, WordBank } from '../../../src/core/data/types-text';
import { finish, findTable, nums, section, src, tables, Unparsed } from '../helpers-m0b';
import { readDoc, rel, writeGen } from '../lib/table';
import type { Table } from '../lib/table';

const L = 'docs/systems/llm/';
const GEN = 'scripts/codegen/groups/text.ts';
const un = new Unparsed('text');

const must = <T>(v: T | null | undefined, what: string): T => {
  if (v == null) throw new Error('text: missing ' + what);
  return v;
};
const slim = (t: Table) => ({ headings: t.headings.slice(1), header: t.header, rows: t.rows.map((r) => r.cells), src: `${t.file}:${t.line}` });
const slotsOf = (s: string): string[] => {
  const out: string[] = [];
  for (const m of s.matchAll(/\{([^{}]+)\}/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
};
const tail = (t: Table) => t.headings.slice(-1)[0] ?? '';

// ---------- names (05) ----------
function words(cell: string): { words: string[]; starred: string[]; declared: number | null } {
  let s = cell.trim();
  let declared: number | null = null;
  const lead = s.match(/^\((\d+)\)\s*/);
  if (lead) {
    declared = Number(lead[1]);
    s = s.slice(lead[0].length);
  }
  const ws: string[] = [];
  const starred: string[] = [];
  for (const raw of s.split(/\s+/).filter(Boolean)) {
    const w = raw.replace(/\*+$/, '');
    if (raw.endsWith('*')) starred.push(w);
    ws.push(w);
  }
  return { words: ws, starred, declared };
}

function names(): NamesData {
  const f = L + '05-name-bank.md';
  const banks: WordBank[] = [];
  const add = (id: string, group: string, key: string, declared: number | null, cell: string, at: string, expect?: number) => {
    const w = words(cell);
    const d = declared ?? w.declared;
    const b: WordBank = { id, group, key, declared: d, words: w.words, starred: w.starred, src: at };
    if (d != null && d !== w.words.length) un.add(f, Number(at.split(':')[1]), `${id}: header says ${d}, found ${w.words.length}`, 'word count differs from the doc');
    if (expect != null && expect !== w.words.length) un.add(f, Number(at.split(':')[1]), `${id}: expected ${expect}, found ${w.words.length}`, 'word count differs');
    banks.push(b);
  };
  // "3. ปาฏิหาริย์ใหญ่" → "ปาฏิหาริย์ใหญ่" (the number may end in a dot: review L4)
  const GROUP = (t: Table) => tail(t).replace(/^\d+(?:\.\d+)*\.?\s*/, '');
  const tbs = tables(f);
  for (const t of tbs) {
    const head = t.headings.slice(1).join(' > ');
    const sec = tail(t).match(/^(\d+(?:\.\d+)?)/)?.[1] ?? head.match(/^(\d+(?:\.\d+)?)/)?.[1] ?? '';
    const counted = t.header.map((h, i) => ({ h, i, n: h.match(/\((\d+)\)\s*$/)?.[1] })).filter((x) => x.n);
    if (sec === '5' && t.header[0] === 'คลัง') {
      for (const r of t.rows) add(`newcity.${r.cells[0].startsWith('คำฟื้น') ? 'revive' : 'fresh'}`, 'newcity', r.cells[0].replace(/\s*\(\d+\)/, ''), Number(r.cells[0].match(/\((\d+)\)/)![1]), r.cells[1], src(t, r.line));
      continue;
    }
    if (/^8/.test(sec) && t.header[1] === 'รูปร่างและสี') {
      t.rows.forEach((r) => add(`companion.shape.${r.cells[0].replace(/\s+/g, '_')}`, 'companion', r.cells[0], null, r.cells[1], src(t, r.line)));
      continue;
    }
    if (/^8/.test(sec) && t.header[0] === 'ชุด') {
      t.rows.forEach((r) => add(`companion.play.${r.cells[0].replace(/\s*\(\d+\)/, '')}`, 'companion', r.cells[0].replace(/\s*\(\d+\)/, ''), Number(r.cells[0].match(/\((\d+)\)/)![1]), r.cells[2], src(t, r.line)));
      continue;
    }
    if (/^7\.2/.test(sec) && t.header[0] === 'วัสดุ') {
      add('weapon.material', 'weapon', 'materials', 11, t.rows.map((r) => r.cells[1]).join(' '), src(t, t.rows[0].line));
      continue;
    }
    if (/^7\.3/.test(sec)) {
      add('weapon.smith', 'weapon', 'smiths', 19, t.rows[0].cells[0], src(t, t.rows[0].line));
      continue;
    }
    for (const c of counted) {
      for (const r of t.rows) {
        const key = r.cells[0].replace(/\s*\(.*\)$/, '').replace(/\s+/g, ' ');
        const id = `${sec.replace(/\./g, '_') || 'x'}.${GROUP(t).replace(/\s.*$/, '') || 'bank'}.${key}.${c.h.replace(/\s*\(\d+\)/, '')}`;
        add(id, GROUP(t), `${key} / ${c.h.replace(/\s*\(\d+\)/, '')}`, Number(c.n), r.cells[c.i], src(t, r.line));
      }
    }
  }
  // bold lines: **ชนิดที่ดิน** (10) ... and **คำสังกัด** (8) ...
  const lines = readDoc(f).split('\n');
  lines.forEach((l, i) => {
    const m = l.match(/^\*\*(ชนิดที่ดิน|คำสังกัด)\*\*\s*(\(\d+\).*)$/);
    if (m) add(m[1] === 'ชนิดที่ดิน' ? 'land.kind' : 'cult.affiliation', m[1] === 'ชนิดที่ดิน' ? 'newland' : 'cult', m[1], null, m[2], `${rel(f)}:${i + 1}`);
  });
  const total = banks.reduce((a, b) => a + b.words.length, 0);
  const declared = Number(must(readDoc(f).match(/รวมคำในคลัง\s*(\d+)\s*คำ/), 'total words sentence')[1]);
  const over = findTable(f, /ภาพรวมของคลัง/, 'ช่อง');
  const tone = findTable(f, null, 'ชุด');
  const excl = must(readDoc(f).match(/รวมคำในคลัง.*$/m), 'excludes')[0];
  const rules = [] as NamesData['rules'];
  for (const t of tbs) if (/^(9|10|12)/.test(t.headings.slice(1).join('').trim())) rules.push({ section: t.headings.slice(1).join(' > '), rows: t.rows.map((r) => r.cells) });
  return {
    counts: { words: total, banks: banks.length, declared },
    excludes: excl,
    banks,
    overview: over.rows.map((r) => ({ slot: r.cells[0], template: r.cells[1], splitBy: r.cells[2], banks: r.cells[3], wordsPerBank: r.cells[4], section: r.cells[5] })),
    tones: tone.rows.map((r) => ({ id: r.cells[0], use: r.cells[1], style: r.cells[2] })),
    recipes: tbs.filter((t) => /^4\./.test(t.headings.slice(1).join('')) && t.header[0] === 'รูปแบบ').flatMap((t) => t.rows.map((r) => ({ name: r.cells[0], formula: r.cells[1] }))),
    rules,
    tables: tbs.map(slim),
  };
}

// ---------- templates (06 and 07) ----------
interface Cfg {
  family: string;
  name: string;
  section: string;
  file: string;
  head: RegExp;
  first: string;
  nth?: number;
  /** Row key columns, template columns, and an optional "used when" column. */
  keys: number[];
  tpl: number[];
  when?: number;
  /** One template per row with several lines (vow pages). */
  multiLine?: boolean;
  /** Words of a cell split on ` · ` each count as one (connectives). */
  split?: boolean;
  declared?: number;
}

function build(cfgs: Cfg[], slotTables: { head: RegExp; first: string; slotCol: number; meaningCol: number; whenCol?: number; groupCol?: number }[], file: string, countTable: { head: RegExp; first: string; nameCol: number; countCol: number }) {
  const templates: Template[] = [];
  const families: TemplateFamily[] = [];
  const doc = findTable(file, countTable.head, countTable.first);
  const declaredBy = new Map<string, number>();
  for (const r of doc.rows) {
    const n = nums(r.cells[countTable.countCol].replace(/\*/g, ''))[0];
    if (/^\*?\*?รวม/.test(r.cells[0])) declaredBy.set('__total', n);
    else declaredBy.set(r.cells[countTable.nameCol].replace(/\s*\(.*\)$/, ''), n);
  }
  for (const c of cfgs) {
    const t = findTable(c.file, c.head, c.first, c.nth ?? 0);
    let count = 0;
    for (const [ri, r] of t.rows.entries()) {
      const keys: Record<string, string> = {};
      c.keys.forEach((k) => (keys[t.header[k]] = r.cells[k]));
      // a family without key columns (the connectives) is numbered by row: `connect_then.3.คำเชื่อม`, never an empty part (review L6)
      const rowKey = c.keys.length ? c.keys.map((k) => r.cells[k]).join('|') : String(ri + 1);
      if (c.multiLine) {
        const lines = c.tpl.map((k) => r.cells[k]).filter((x) => x && x !== '—');
        templates.push({ id: `${c.family}.${rowKey}`, family: c.family, keys, col: c.tpl.map((k) => t.header[k]).join(' + '), text: lines.join('\n'), lines, slots: slotsOf(lines.join(' ')), ...(c.when != null ? { when: r.cells[c.when] } : {}), src: src(t, r.line) });
        count++;
        continue;
      }
      for (const k of c.tpl) {
        const cell = r.cells[k];
        if (!cell || cell === '—' || cell === '-') {
          un.add(c.file, r.line, `${c.family} ${rowKey} ${t.header[k]}`, 'empty template cell');
          continue;
        }
        const pieces = c.split ? cell.split(/\s+·\s+/).map((x) => x.trim()).filter(Boolean) : [cell];
        pieces.forEach((text, pi) => {
          templates.push({ id: `${c.family}.${rowKey}.${t.header[k]}${pieces.length > 1 ? '.' + (pi + 1) : ''}`, family: c.family, keys, col: t.header[k], text, slots: slotsOf(text), ...(c.when != null && r.cells[c.when] ? { when: r.cells[c.when] } : {}), src: src(t, r.line) });
          count++;
        });
      }
    }
    families.push({ id: c.family, name: c.name, section: c.section, count, declared: c.declared ?? null });
  }
  const seenId = new Map<string, number>();
  for (const t of templates) {
    const n = (seenId.get(t.id) ?? 0) + 1;
    seenId.set(t.id, n);
    if (n > 1) t.id = `${t.id}#${n}`;
  }
  const slots: Slot[] = [];
  for (const st of slotTables) {
    const t = findTable(file, st.head, st.first);
    for (const r of t.rows) {
      const found = slotsOf(r.cells[st.slotCol]);
      for (const sname of found.length ? found : [r.cells[st.slotCol]]) slots.push({ slot: sname, meaning: r.cells[st.meaningCol], ...(st.whenCol != null ? { when: r.cells[st.whenCol] } : {}), ...(st.groupCol != null ? { group: r.cells[st.groupCol] } : {}), src: src(t, r.line) });
    }
  }
  const known = new Set(slots.map((s) => s.slot));
  return { templates, families, slots, known, declaredBy };
}

function god(): TemplatesData {
  const f = L + '06-god-templates.md';
  const c = (family: string, name: string, secNo: string, head: RegExp, first: string, keys: number[], tpl: number[], extra: Partial<Cfg> = {}): Cfg => ({ family, name, section: secNo, file: f, head, first, keys, tpl, ...extra });
  const cfgs: Cfg[] = [
    c('symbol_meaning', 'ความหมายสัญลักษณ์ตามกลุ่มเผ่า', '2.2', /2\.2/, 'สัญลักษณ์', [0], [2, 3, 4, 5, 6, 7], { declared: 72 }),
    c('dream_image', 'ภาพฝัน', '2.3', /2\.3/, 'สัญลักษณ์', [0, 1], [2, 3], { declared: 72 }),
    c('outcome_shadow', 'เงาของผล', '2.4', /2\.4/, 'แหล่ง', [0], [1, 2, 3], { declared: 24 }),
    c('candle_reason', 'เหตุผลของเทียน', '2.5', /2\.5/, 'เทอมของสูตร', [0], [1, 2, 3], { declared: 30 }),
    c('decision_result', 'ตอนตัดสินใจ (ผลทั่วไป)', '2.6', /2\.6/, 'ผล', [0], [1, 2, 3], { declared: 12 }),
    c('misread', 'ตีความผิดตามสัญลักษณ์', '2.6', /2\.6/, 'สัญลักษณ์', [0], [1], { declared: 12 }),
    c('burden', 'ภาระใจ', '2.7', /2\.7/, 'เหตุการณ์', [0], [1, 2], { declared: 6 }),
    c('whisper', 'กระซิบ', '3', /3\. กระซิบ/, 'คำใบ้', [0, 1], [2, 3, 4], { declared: 81 }),
    c('prayer_ask', 'คำขอเสริมของคำอธิษฐาน', '4.1', /4\.1/, 'ชนิด', [0], [1, 2], { declared: 34 }),
    c('prayer_give', 'ผลของคำอธิษฐาน ให้ แปลก', '4.2', /4\.2/, 'ชนิด', [0], [1, 2], { declared: 34 }),
    c('prayer_deny', 'ผลของคำอธิษฐาน ปฏิเสธ ลงโทษ นิ่ง', '4.3', /4\.3/, 'ชนิด', [0], [1, 2, 3], { declared: 51 }),
    c('omen_event', 'ลางของเหตุการณ์โลก', '5.1', /5\.1/, 'ชั้น', [0, 1], [2, 3], { declared: 36 }),
    c('omen_miracle', 'ลางของปาฏิหาริย์ใหญ่', '5.2', /5\.2/, 'ปาฏิหาริย์', [0], [1, 2], { declared: 12 }),
    c('chest_reason', 'เหตุที่หีบขึ้น', '6', /6\. หีบประทาน/, 'เหตุ (ตัวคูณ)', [0], [1, 2, 3], { declared: 33 }),
    c('miracle_day', 'วันเกิดเหตุตามกริยา', '7.1', /7\.1/, 'กริยา', [0], [1, 2, 3, 4, 5], { declared: 30 }),
  ];
  const b = build(
    cfgs,
    [{ head: /ช่องและกติกาเขียน/, first: 'ช่อง', slotCol: 0, meaningCol: 1, whenCol: 2 }],
    f,
    { head: /จำนวนแม่แบบ/, first: 'ชุด', nameCol: 0, countCol: 2 },
  );
  // 4.2 and 4.3 share one declared figure (85)
  const fam = b.families;
  const used = new Set(b.templates.flatMap((t) => t.slots));
  const unknown = [...used].filter((s) => !b.known.has(s) && !b.known.has(s.replace(/@.*/, '')));
  const lists = [
    { id: 'core_words', t: findTable(f, /7\.2/, 'แก่น') },
    { id: 'tribe_groups', t: findTable(f, /2\.1/, 'กลุ่ม') },
    { id: 'dream_tone_use', t: findTable(f, /2\.3/, 'น้ำเสียง') },
    { id: 'whisper_scenes', t: findTable(f, /3\. กระซิบ/, 'ฉาก') },
  ].map(({ id, t }) => ({ id, header: t.header, rows: t.rows.map((r) => r.cells), src: `${t.file}:${t.line}` }));
  return {
    counts: { templates: b.templates.length, families: fam.length, slots: b.slots.length, declared: must(b.declaredBy.get('__total'), 'god total') },
    families: fam,
    slots: b.slots,
    unknownSlots: unknown,
    rules: tables(f).filter((t) => /^(1\.|8\.|9\.)/.test(t.headings.slice(1).join('')) && !t.header.includes('ช่อง') ? true : false).map((t) => ({ section: t.headings.slice(1).join(' > '), rows: t.rows.map((r) => r.cells) })),
    templates: b.templates,
    lists,
    tables: tables(f).map(slim),
  };
}

function ending(): TemplatesData {
  const f = L + '07-ending-templates.md';
  const c = (family: string, name: string, secNo: string, head: RegExp, first: string, keys: number[], tpl: number[], extra: Partial<Cfg> = {}): Cfg => ({ family, name, section: secNo, file: f, head, first, keys, tpl, ...extra });
  const cfgs: Cfg[] = [
    c('life_fact', 'ประโยคข้อเท็จจริงของชีวิต', '3.2', /3\.2/, 'ชนิด', [0, 1], [2], { when: 3, declared: 119 }),
    c('connect_time', 'คำเชื่อมเวลา', '4.1', /4\.1/, 'กลุ่ม', [0], [1], { split: true, declared: 15 }),
    c('connect_but', 'คำเชื่อมขัด', '4.2', /4\.2/, 'คำเชื่อม', [], [0], { declared: 10 }),
    c('connect_because', 'คำเชื่อมเหตุ', '4.3', /4\.3/, 'คำเชื่อม', [], [0], { declared: 11 }),
    c('connect_then', 'คำเชื่อมผลตามมา', '4.4', /4\.4/, 'คำเชื่อม', [], [0], { declared: 12 }),
    c('card_title', 'บรรทัดชื่อของการ์ด', '5.2', /5\.2/, 'แบบ', [0], [2], { when: 1, declared: 16 }),
    c('card_question', 'บรรทัดสรุปคำถามของชีวิต', '5.3', /5\.3/, 'จบแบบ', [0, 1], [2], { nth: 1, declared: 24 }),
    c('card_short', 'บรรทัดสั้นของสามช่วงเวลา', '5.4', /5\.4/, 'ชนิด', [0], [1], { declared: 19 }),
    c('epitaph_cause', 'จารึกตามกลุ่มและสาเหตุ', '6.2', /6\.2/, 'กลุ่ม', [0], [1, 2, 3, 4, 5], { declared: 50 }),
    c('epitaph_group', 'จารึกทั่วไปของกลุ่ม', '6.3', /6\.3/, 'กลุ่ม', [0, 1], [2], { declared: 20 }),
    c('epitaph_cause_general', 'จารึกกลางตามสาเหตุ', '6.4', /6\.4/, 'สาเหตุ', [0, 1], [2], { declared: 20 }),
    c('vow_done', 'หน้าคำปฏิญาณเมื่อสำเร็จ', '7.1', /7\.1/, 'คำปฏิญาณ', [0], [1, 2], { multiLine: true, declared: 19 }),
    c('vow_fail', 'หน้าคำปฏิญาณเมื่อไม่สำเร็จ', '7.2', /7\.2/, 'คำปฏิญาณ', [0], [1, 2], { multiLine: true, declared: 19 }),
    c('vow_fallback', 'หน้าคำปฏิญาณสำรอง', '7.3', /7\.3/, 'ผล', [0], [1, 2], { multiLine: true, declared: 4 }),
    c('chronicle', 'รายการพงศาวดารสายตระกูล', '8', /8\. พงศาวดาร/, 'กลุ่ม', [0, 1], [2], { when: 3, declared: 30 }),
    c('world_fact', 'ประโยคข้อเท็จจริงของโลก', '9.2', /9\.2/, 'ชนิด', [0, 1], [2], { when: 3, declared: 21 }),
    c('ending_frame', 'คำเปิดและคำปิดของฉากจบ', '9.3', /9\.3/, 'ฉากจบ', [0, 1, 2], [3], { declared: 28 }),
  ];
  const b = build(
    cfgs,
    [
      { head: /2\.1 ช่องข้อมูล/, first: 'กลุ่ม', slotCol: 1, meaningCol: 2, groupCol: 0 },
      { head: /9\.2/, first: 'ช่อง', slotCol: 0, meaningCol: 1 },
      { head: /7\. หน้าคำปฏิญาณ/, first: 'ช่อง', slotCol: 0, meaningCol: 1 },
    ],
    f,
    { head: /จำนวนแม่แบบ/, first: 'ตระกูลแม่แบบ', nameCol: 0, countCol: 1 },
  );
  const used = new Set(b.templates.flatMap((t) => t.slots));
  const unknown = [...used].filter((s) => !b.known.has(s));
  const fam = b.families.map((x) => {
    // the doc counts all connectives (48) as one family and the vow pages as 19 each
    return x;
  });
  const lists = [
    { id: 'culture_groups', t: findTable(f, /6\.1/, 'กลุ่ม') },
    { id: 'death_causes', t: findTable(f, /2\.5/, 'กลุ่ม') },
    { id: 'core_effects', t: findTable(f, /3\.1/, 'ฉากจบ') },
    { id: 'fact_kinds', t: findTable(f, /2\.2/, 'ชนิด') },
    { id: 'score_rules', t: findTable(f, /2\.3/, 'โบนัสหรือตัวลด') },
  ].map(({ id, t }) => ({ id, header: t.header, rows: t.rows.map((r) => r.cells), src: `${t.file}:${t.line}` }));
  return {
    counts: { templates: b.templates.length, families: fam.length, slots: b.slots.length, declared: must(b.declaredBy.get('__total'), 'ending total') },
    families: fam,
    slots: b.slots,
    unknownSlots: unknown,
    rules: tables(f).filter((t) => /^(1\.|10\.|11\.|12\.)/.test(t.headings.slice(1).join(''))).map((t) => ({ section: t.headings.slice(1).join(' > '), rows: t.rows.map((r) => r.cells) })),
    templates: b.templates,
    lists,
    tables: tables(f).map(slim),
  };
}

export default function run() {
  const n = names();
  const g = god();
  const e = ending();
  void section;
  writeGen('names', n, [L + '05-name-bank.md'], GEN);
  writeGen('templates-god', g, [L + '06-god-templates.md'], GEN);
  writeGen('templates-ending', e, [L + '07-ending-templates.md'], GEN);
  return finish('text', ['names.json', 'templates-god.json', 'templates-ending.json'], un);
}
