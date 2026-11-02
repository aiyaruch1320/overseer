// Event generator (code-plan §5.1 rows 2 and 3): reads the world events, the branch events, the last-era events and the
// local events, and writes data/gen/world-events.json and data/gen/local-events.json.
//   npx tsx scripts/codegen/run-all.ts events
// The structure the doc-level sim reads (era gate, prerequisites, thresholds, closures, successors, religion weights, dragons)
// is read with the same rules as scripts/sim/sim-world.mjs, so the core gets the same data from JSON (tests/codegen/events.test.ts).
import type { ContinentId, Effect } from '../../../src/core/types';
import type {
  BranchEvent,
  Closure,
  Disturbance,
  DragonDef,
  EconEffect,
  FaithInfo,
  FaithWeight,
  FlagDef,
  Home,
  LastEraEvent,
  LastEraPhase,
  LocalEvent,
  LocalEventsData,
  LocalNpc,
  LocalRead,
  LocalTemplate,
  Mark,
  Outcome,
  WorldCond,
  WorldEvent,
  WorldEventsData,
  WorldRules,
  WorldVar,
} from '../../../src/core/data/types-events';
import type { GenReport } from '../run-all';
import {
  anyIdsIn,
  eraColumn,
  eraGate,
  idsIn,
  num,
  parseFeedback,
  parseLean,
  parseCond,
  parseLocalEffect,
  parseWorldEffect,
  plain,
  splitOutcomes,
  splitPaths,
  thresholds,
} from '../lib/events-grammar';
import { idIndex } from '../lib/ids';
import { Unparsed, listDocs, readDoc, tables, writeGen } from '../lib/table';

const F = {
  world: 'docs/systems/events/world-events.md',
  b1: 'docs/systems/events/branches/01-dragon-falls.md',
  b2: 'docs/systems/events/branches/02-new-lands.md',
  b3: 'docs/systems/events/branches/03-character-and-quests.md',
  b4: 'docs/systems/events/branches/04-last-era.md',
  bReadme: 'docs/systems/events/branches/README.md',
  local: 'docs/systems/events/local-events.md',
  localGen: 'docs/_generated/local-events-by-country.md',
  econ: 'docs/systems/economy/01-world-economy.md',
  dragons: 'docs/lore/dragons/README.md',
  mood: 'docs/systems/simulation/dragon-mood.md',
  faiths: 'docs/lore/religions/README.md',
  religions: ['docs/lore/religions/02-major-faiths.md', 'docs/lore/religions/03-regional-faiths.md', 'docs/lore/religions/04-movements.md'],
  storyContinents: 'docs/lore/world/story-continents.md',
  convergence: 'docs/lore/storylines/00-convergence.md',
};

const CONTINENT: Record<string, ContinentId> = {
  อัซการ์: 'AZ',
  มอร์เฮเวน: 'MH',
  'คาซ-ดูรัม': 'KD',
  เนเรีย: 'NR',
  อัลเดรีย: 'AL',
  เมคาเรีย: 'MK',
  ซาฮารัน: 'SH',
  ซิลวาเนล: 'SV',
  เนบูเลีย: 'NB',
};
const COUNTRY_RE = /\b(?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}\b/g;
const MARKS: Mark[] = ['⭐', '●', '○'];
/** Events the code handles itself (the sim's SPECIAL set): dragon falls, the mourning wave, the hero, the endings, the start state. */
const MOURN = 'DR-15';
const HERO = 'DR-13';
const ENDINGS = ['END-10', 'END-11', 'END-12'];
const START_EVENT = 'FG-01';

/** Names of the 15 dragons in index order, set by `run` for the condition parser ("อารมณ์เพลิงนิรันดร์ < 40"). */
let dragonNames: string[] = [];
const lines = (f: string) => readDoc(f).split('\n');
const lineOf = (f: string, text: string) => lines(f).findIndex((l) => l.includes(text)) + 1;

export default function run(): GenReport {
  const unp = new Unparsed('events');
  const ids = idIndex();
  const sources: string[] = [
    F.world, F.b1, F.b2, F.b3, F.b4, F.bReadme, F.local, F.localGen, F.econ, F.dragons, F.mood, F.faiths, ...F.religions, F.storyContinents,
    F.convergence, 'docs/lore/religions/04-movements.md',
  ];

  // ---------- world event rows ----------
  const worldTables = tables(F.world).filter((t) => /^ID · ชื่อ/.test(t.header[0]));
  const rows: { cells: string[]; line: number; section: string }[] = [];
  for (const t of worldTables) for (const r of t.rows) rows.push({ ...r, section: t.headings[t.headings.length - 1] });

  interface RawWorld {
    id: string;
    mark: Mark | null;
    name: string;
    alias: string;
    cond: string;
    what: string;
    eff: string;
    line: number;
  }
  const raw: RawWorld[] = [];
  for (const r of rows) {
    const m = r.cells[0].match(/^\*\*([A-Z]{2,3}-\d{2}) ([⭐●○])? ?([^*]*)\*\*(.*)$/);
    if (!m) continue;
    const c = r.cells;
    // war rows have four cells: name · pair and trigger · era · outcomes
    raw.push({ id: m[1], mark: (m[2] as Mark) || null, name: m[3].trim(), alias: m[4].replace(/^\s*\(|\)\s*$/g, '').trim(), cond: c[1], what: c[2], eff: c[c.length - 1], line: r.line });
  }
  const byId = new Map(raw.map((e) => [e.id, e]));

  // ---------- dragons ----------
  const dragonTable = tables(F.dragons).find((t) => t.header[1] === 'มังกร' && t.header.includes('ทางล้มหลัก'))!;
  const moodTable = tables(F.mood).find((t) => t.header[0] === 'มังกร' && t.header[1] === 'อารมณ์เริ่มต้น')!;
  const pairTable = tables(F.dragons).find((t) => t.header[0] === 'คู่')!;
  const dragons: DragonDef[] = dragonTable.rows.map((r, i) => {
    const name = r.cells[1];
    const fall = r.cells[6].match(/\b(?:DR|END)-\d{2}\b/)![0];
    const mood = moodTable.rows.find((x) => x.cells[0] === name)!;
    const awake = raw.find((e) => e.name === name + 'ตื่น' && e.id.startsWith('PL-'));
    return {
      index: i,
      name,
      title: r.cells[2],
      fallEvent: fall,
      ...(awake ? { awakeEvent: awake.id } : {}),
      minEra: eraGate(byId.get(fall)!.cond)[0],
      initMood: Number(mood.cells[1]),
      decay: Number(mood.cells[2]),
      pair: null,
    };
  });
  for (const r of pairTable.rows) {
    const [a, b] = r.cells[0].split('↔').map((x) => x.trim());
    const ia = dragons.findIndex((d) => d.name === a), ib = dragons.findIndex((d) => d.name === b);
    if (ia < 0 || ib < 0) continue; // `ราหู ↔ ทุกตัว` has no single closest sibling
    dragons[ia].pair = ib;
    dragons[ib].pair = ia;
  }
  dragonNames = dragons.map((d) => d.name);
  const pillarIndex = new Map(dragons.filter((d) => d.awakeEvent).map((d) => [d.awakeEvent!, d.index]));
  // the mood of a dragon is read in the condition of its fall as well ("อารมณ์ต่ำกว่า 10 (สิ้นแรง)" in DR-04 DR-05 END-01…END-08); `thr` keeps the awakening pillar only (the sim's view)
  const moodIndex = new Map([...pillarIndex, ...dragons.map((d) => [d.fallEvent, d.index] as [string, number])]);
  const fallIds = new Set(dragons.map((d) => d.fallEvent));

  // ---------- flags and closures (branches/) ----------
  const flags: FlagDef[] = [];
  for (const l of lines(F.bReadme)) {
    const m = l.match(/^\| (\S+) \| ([A-Z]{2,3}-\d{2}) \|$/);
    if (m) flags.push({ name: m[1], trigger: m[2] });
  }
  const FLAG: Record<string, string> = Object.fromEntries(flags.map((f) => [f.name, f.trigger]));
  const closureMap = new Map<string, { close: Set<string>; replace: Map<string, string>; keep: string[]; swaps: Closure['swaps'] }>();
  const ensure = (t: string) => {
    if (!closureMap.has(t)) closureMap.set(t, { close: new Set(), replace: new Map(), keep: [], swaps: [] });
    return closureMap.get(t)!;
  };
  /** Every `X → Y` of a แทนที่ item that the sim-level `replace` (closed event → branch event) does not hold: world-event and named successors. */
  const swapsOf = (item: string): Closure['swaps'] => {
    const [from, to] = item.split('→').map((x) => x.trim());
    const fromIds = idsIn(from);
    const a = fromIds.length ? fromIds : [from.replace(/\s*\(.*$/, '').trim()];
    const toIds = to.match(/\b[A-Z]{2,3}-\d{2}\b/g) || [];
    const named = to.replace(/\s*\(.*$/, '').trim();
    const out: Closure['swaps'] = [];
    a.forEach((x, i) => {
      const y: string = (toIds.length === a.length ? toIds[i] : toIds[0]) ?? named;
      if (fromIds.length && toIds.length && !byId.has(y)) return; // a branch successor: `replace` holds it
      out.push({ from: x, to: y, text: item });
    });
    return out;
  };
  const close = (t: string, xs: string[]) => {
    const c = ensure(t);
    for (const x of xs) if (byId.has(x)) c.close.add(x);
  };
  const succ = (t: string, from: string, to: string) => {
    const a = idsIn(from);
    const b = to.match(/\b[A-Z]{2,3}-\d{2}\b/g) || [];
    const c = ensure(t);
    a.forEach((x, i) => {
      const y = b.length === a.length ? b[i] : b[0];
      if (y && !byId.has(y)) c.replace.set(x, y);
    });
  };
  {
    let trig: string[] = [];
    for (const l of lines(F.b1)) {
      const h = l.match(/^## \d+\. (\S+) → (.*)$/);
      if (h) {
        trig = [dragons.find((d) => d.name === h[1])?.fallEvent].filter((x): x is string => !!x);
        for (const [f, id] of Object.entries(FLAG)) if (h[2].includes(f) && !trig.includes(id)) trig.push(id);
        continue;
      }
      const row = l.match(/^\| \*\*(ปิด|แทนที่)\*\* \| (.*) \|$/);
      if (!row) continue;
      const xs =
        row[1] === 'ปิด'
          ? row[2].split(/,\s*(?![^()]*\))/).filter((x) => !/รูปแบบปกติ|แบบเดิม/.test(x)).flatMap(idsIn)
          : row[2]
              .split(' · ')
              .filter((x) => /→.*(?:[A-Z]{2,3}-\d{2}|ไม่มีผู้สืบทอด)/.test(x))
              .flatMap((x) => {
                const [from, to] = x.split('→');
                for (const t of trig) succ(t, from, to);
                return idsIn(from);
              });
      for (const t of trig) close(t, xs);
      if (row[1] === 'แทนที่')
        for (const item of row[2].split(' · ').filter((x) => x.includes('→')))
          for (const t of trig) ensure(t).swaps.push(...swapsOf(item));
    }
    const sec = readDoc(F.b2).split(/^## /m).find((x) => x.startsWith('9.'))!;
    for (const l of sec.split('\n')) {
      const c = l.split(' | ').map((x) => x.replace(/^\| |\s\|$/g, '').trim());
      const t = FLAG[c[0]];
      if (c.length !== 4 || !t) continue; // flags without a world-wide trigger (one country only) are not modelled
      if (c[2] === 'แทนที่' && /^[A-Z]{2}-\d{2}/.test(c[3])) {
        close(t, idsIn(c[1]));
        succ(t, c[1], c[3].replace(/\(.*$/, ''));
      } else if (c[2].startsWith('ปิด')) close(t, idsIn(c[1]));
      else if (c[2].startsWith('คงอยู่')) ensure(t).keep.push(...idsIn(c[1]));
    }
    // ไร้ธง: after WR-23 the PO and HP events close (section 9)
    close('WR-23', raw.filter((e) => /^(PO|HP)-/.test(e.id)).map((e) => e.id));
  }
  const closures: Closure[] = [...closureMap].map(([trigger, c]) => ({
    trigger,
    close: [...c.close],
    replace: [...c.replace].map(([from, to]) => ({ from, to })),
    swaps: c.swaps,
    keep: c.keep,
  }));

  // ---------- religion: faiths, home, weights ----------
  const faiths: FaithInfo[] = [];
  {
    const t = tables(F.faiths).find((x) => x.header[1] === 'ศาสนา')!;
    for (const r of t.rows) if (/^\d+$/.test(r.cells[0])) faiths.push({ no: +r.cells[0], name: r.cells[1], pct: r.cells[3] === '' || isNaN(Number(r.cells[3])) ? null : Number(r.cells[3]) });
  }
  // main faiths of every country (world-events §0.2.1): the faith numbers its ศาสนา field names, a dragon it worships counts as the faiths that dragon feeds,
  // and a movement is a main faith of its base countries. Same words and same order as the sim, so the share of a home comes out equal.
  const mainFaiths: Record<string, number[]> = {};
  {
    const WORDS: [RegExp, number][] = [
      [/มังกร/, 1], [/แสง/, 2], [/ต้นไม้โลก/, 3], [/สมุทร/, 4], [/พญานาค|นาคา/, 5], [/จันทรา/, 6], [/สงคราม/, 7], [/ปีศาจ/, 8], [/บรรพบุรุษ/, 9],
      [/ไม่มี(?!ศาสนา)|เหตุผล/, 10], [/เตาหลอม/, 11], [/เฟือง/, 12], [/ศิลา|ไททัน/, 13], [/กระซิบ/, 14], [/ฟาโรห์|บัญชีวิญญาณ/, 15], [/ผู้ชี้ทาง/, 16], [/ความฝัน/, 17],
      [/วิญญาณสัตว์|วิญญาณหมาป่า/, 18], [/ลาง/, 19],
    ];
    const faithsIn = (text: string) => WORDS.filter(([re]) => re.test(text)).map(([, n]) => n);
    const dragonFaith: [string, number[]][] = dragonTable.rows.filter((r) => /^\d+$/.test(r.cells[0]) && r.cells[4]).map((r) => [r.cells[1], faithsIn(r.cells[4])]);
    const sets: Record<string, Set<number>> = {};
    for (const f of listDocs('docs/lore/countries', /^\d\d-.*\.md$/)) {
      let cur: string | null = null;
      for (const l of readDoc(f).split('\n')) {
        const h = l.match(/^#### ([A-Z]{2}-\d{2}) /);
        if (h) {
          cur = h[1];
          continue;
        }
        const m = cur && l.match(/\*\*ศาสนา:\*\* ([^·]*)/);
        if (!m) continue;
        let text = m[1];
        const set = new Set<number>();
        for (const [name, ns] of dragonFaith)
          if (text.includes(name)) {
            ns.forEach((n) => set.add(n));
            text = text.replace(name, '');
          }
        faithsIn(text).forEach((n) => set.add(n));
        sets[cur!] = set;
        cur = null;
      }
    }
    let no = 0;
    for (const l of lines('docs/lore/religions/04-movements.md')) {
      const h = l.match(/^## (\d+)\./);
      if (h) no = +h[1];
      if (l.startsWith('- **ฐาน**')) for (const c of l.match(/\b[A-Z]{2}-\d{2}\b/g) || []) sets[c]?.add(no);
    }
    for (const c of Object.keys(sets).sort()) mainFaiths[c] = [...sets[c]].sort((a, b) => a - b);
  }
  const homeTable = new Map<string, string>();
  for (const l of readDoc(F.world).split('### 0.2.1')[1].split('### 0.3')[0].split('\n')) {
    const m = l.match(/^\| ([A-Z]{2,3}-\d{2}) \| ([^|]+) \|/);
    if (m) homeTable.set(m[1], m[2].trim());
  }
  const homeOf = (e: RawWorld): Home => {
    const fromTable = homeTable.get(e.id);
    const text = fromTable ?? [...new Set([e.cond, e.what, e.eff].join(' ').match(COUNTRY_RE) || [])].join(' ');
    const home: Home = { source: fromTable ? 'table' : text ? 'row' : 'world', words: [], countries: [], continents: [], world: false };
    if (!text || text === 'ทั้งโลก') {
      home.world = true;
      home.source = fromTable ? 'table' : 'world';
      return home;
    }
    home.words = text.split(/\s+/);
    for (const w of home.words) {
      if (CONTINENT[w]) home.continents.push(CONTINENT[w]);
      else if (/^[A-Z]{2}-\d{2}$/.test(w)) home.countries.push(w);
      else if (ids.countries.has(w)) home.countries.push(w);
      else unp.add(F.world, lineOf(F.world, `| ${e.id} | ${w}`) || e.line, w, `ถิ่นของ ${e.id} ไม่รู้จักคำนี้ (ไม่ใช่รหัสประเทศหรือชื่อทวีป)`);
    }
    return home;
  };
  const faithByEvent = new Map<string, FaithWeight[]>();
  for (const f of F.religions) {
    let no = 0;
    lines(f).forEach((l, li) => {
      const h = l.match(/^## (\d+)\./);
      if (h) {
        no = +h[1];
        return;
      }
      if (!l.startsWith('- **หนุน**') || no > 21) return;
      const src = `${f}:${li + 1}`;
      const body = l.replace(/\*\*เปิดเฉพาะ\*\*.*$/, '');
      const [forPart, againstPart = ''] = body.replace(/^- \*\*หนุน\*\*/, '').split('**ต้าน**');
      for (const [kind, seg] of [['for', forPart], ['against', againstPart]] as const) {
        for (const tok of seg.split(/,\s*|\s+(?=[A-Z]{2,3}-\d{2}\b)/)) {
          const m = tok.trim().match(/^([A-Z]{2,3}-\d{2})\s*(?:\(([^)]*)\)\s*)?×([\d.]+)\s*(.*)$/);
          if (!m) continue;
          const rest = m[4].replace(/\((?![A-Z]{2,3}-\d{2}\))[^)]*\)/g, '').trim();
          const after = rest.match(/^หลัง.*?\(([A-Z]{2,3}-\d{2})\)$/)?.[1];
          const fw: FaithWeight = { faith: no, kind, mul: Number(m[3]), src };
          if (m[2]) fw.note = m[2];
          if (after) fw.after = after;
          // a weight the doc-level sim cannot read is kept with its condition text
          const cond = (m[2] && /เมื่อ|หลัง/.test(m[2]) ? `(${m[2]})` : '') || (/\([^)]*เมื่อ/.test(m[4]) ? m[4] : '') || (rest && !after ? rest : '');
          if (cond) fw.when = cond;
          if (!faithByEvent.has(m[1])) faithByEvent.set(m[1], []);
          faithByEvent.get(m[1])!.push(fw);
        }
      }
    });
  }

  // ---------- economy table ----------
  const econ = new Map<string, EconEffect>();
  {
    const t = tables(F.econ).find((x) => x.header[0] === 'เหตุการณ์' && x.header.includes('ผลต่อ C'));
    for (const r of t?.rows ?? []) {
      const id = r.cells[0].match(/^([A-Z]{2,3}-\d{2})/)?.[1];
      if (!id) continue;
      const c = r.cells[4].replace(MINUS_RE, '-');
      econ.set(id, { scope: r.cells[1], wealth: r.cells[2], price: r.cells[3], c: /^[+-]?\d+$/.test(c) ? Number(c) : null, src: `${F.econ}:${r.line}` });
    }
  }

  // ---------- witness table (branches/03 §1) ----------
  const witness = new Map<string, Effect[]>();
  {
    const t = tables(F.b3).find((x) => x.header[0] === 'เหตุการณ์' && x.header[1].startsWith('สถานะผู้ผ่านเหตุการณ์'));
    for (const r of t?.rows ?? []) {
      const id = r.cells[0].match(/^([A-Z]{2,3}-\d{2})/)?.[1];
      if (!id) continue;
      const eff: Effect[] = [{ k: 'label', text: r.cells[1].replace(/\s*\(.*$/, '').trim() }];
      for (const m of r.cells[1].matchAll(/`([^`]+)`/g)) eff.push({ k: 'grant', kind: ids.kind(m[1]), id: m[1] });
      witness.set(id, eff);
    }
  }

  // ---------- slow variables and disturbance (world-events §0.1 and §0.1.1) ----------
  const rangeTable = tables(F.world).find((t) => t.header[0] === 'ตัวแปร' && t.header[1] === 'ช่วง')!;
  const rangeOf = (name: string): [number, number] => {
    const r = rangeTable.rows.find((x) => x.cells[0].replace(/\*\*/g, '').startsWith(name));
    const m = r?.cells[1].match(/([+\-−]?\d+)\s*[–…-]\s*([+\-−]?\d+)/);
    return m ? [num(m[1]), num(m[2])] : [0, 100];
  };
  const driftTable = tables(F.world).find((t) => t.header[0] === 'ตัวแปร' && t.header[1].startsWith('ค่าตั้งต้น'))!;
  const VARS: [string, string, string][] = [
    ['ความหิวมอร์เฮเวน', 'H', 'ความหิวมอร์เฮเวน'],
    ['สุขภาพต้นไม้โลก', 'T', 'สุขภาพต้นไม้โลก'],
    ['ความหนาหมอก', 'D', 'ความหนาหมอก'],
    ['ศรัทธารวมของโลก', 'F', 'ศรัทธารวมของโลก'],
    ['มลพิษเมคาเรีย', 'P', 'มลพิษเมคาเรีย'],
    ['ศิลาลอยคงเหลือ', 'FLOAT', 'ศิลาลอยคงเหลือ'],
    ['ตึงเครียดคู่ทวีป', 'TENSION', 'ตึงเครียดคู่ทวีป'],
    ['ระดับทะเล', 'SEA', 'ระดับทะเล'],
  ];
  const vars: WorldVar[] = [];
  const driftOf = (s: string) => {
    const m = s.match(/([+\-−]\d+(?:\.\d+)?)\s*(?:\(สุ่ม ±([\d.]+)\))?/);
    return { drift: m ? num(m[1]) : 0, noise: m?.[2] ? Number(m[2]) : 0 };
  };
  // one-time changes and stops in the stop cell: `HP-07 −40 ครั้งเดียว` · `FG-10 −40 และหยุด · FG-11 +1.2 แทน` · `มังกรล้ม +4 · DR-11 +10`
  const haltIds = new Set<string>();
  const changesOf = (stop: string): WorldVar['changes'] => {
    const list: WorldVar['changes'] = [];
    haltIds.clear();
    for (const m of stop.matchAll(/((?:[A-Z]{2,3}-\d{2}\s+(?:หรือ\s+)?)*[A-Z]{2,3}-\d{2}|มังกรล้ม)\s+([+\-−]\d+(?:\.\d+)?)(\s*ครั้งเดียว|\s*และหยุด|\s*แทน|\s*ต่อทศวรรษแทน)?/g)) {
      const evs = m[1] === 'มังกรล้ม' ? ['fall'] : m[1].match(/[A-Z]{2,3}-\d{2}/g)!;
      const kind = /แทน/.test(m[3] || '') ? 'drift' : 'once';
      for (const e of evs) {
        list.push({ event: e, delta: num(m[2]), kind });
        if (/และหยุด/.test(m[3] || '')) haltIds.add(e);
      }
    }
    return list;
  };
  for (const [name, code, rangeName] of VARS) {
    const r = driftTable.rows.find((x) => x.cells[0] === name);
    if (!r) continue;
    const [min, max] = rangeOf(rangeName);
    const startM = r.cells[1].match(/^(\d+)/);
    const { drift, noise } = /^ไม่เปลี่ยนเอง/.test(r.cells[2]) ? { drift: 0, noise: 0 } : driftOf(r.cells[2]);
    const stop = r.cells[3];
    const stopEvents = [...new Set(stop.match(/\b(?:DR|PL|WR|CT|DM|MC|BIO|GD|HP|PO|GI|FG|END|WT)-\d{2}\b/g) || [])];
    const changes = changesOf(stop);
    vars.push({
      code,
      name,
      start: startM ? Number(startM[1]) : null,
      drift,
      noise,
      min,
      max,
      stopEvents,
      // a change with a number (`HP-07 −40 ครั้งเดียว`, `DR-11 +10`, `MC-04 +20`, `MC-09 −3 แทน`) does not end the drift unless it says so; a name with no number does
      halts: stopEvents.filter((x) => haltIds.has(x) || !changes.some((c) => c.event === x)),
      changes,
      note: `${r.cells[2]} · ${stop}`,
      inSim: r.cells[4],
      src: `${F.world}:${r.line}`,
    });
  }
  const disturb: Disturbance[] = [];
  for (const r of driftTable.rows) {
    const m = r.cells[0].match(/^การรบกวน(\S+)$/);
    if (!m) continue;
    const di = dragons.find((d) => d.name === m[1]);
    if (!di || !di.awakeEvent) continue;
    const { drift, noise } = driftOf(r.cells[2]);
    const stop = r.cells[3];
    const bumps: { event: string; delta: number }[] = [];
    for (const b of stop.matchAll(/((?:[A-Z]{2,3}-\d{2}\s+)+)([+\-−]\d+)(?!\d)/g)) for (const e of b[1].trim().split(/\s+/)) bumps.push({ event: e, delta: num(b[2]) });
    const stops = [...stop.matchAll(/([A-Z]{2,3}-\d{2})(?: เกิดแล้ว)?\s*หยุด(?!ส่วน)/g)].map((x) => x[1]);
    disturb.push({
      dragon: m[1],
      dragonIndex: di.index,
      start: Number(r.cells[1].match(/^(\d+)/)![1]),
      drift,
      noise,
      event: di.awakeEvent,
      stopEvents: stops,
      bumps,
      note: `${r.cells[2]} · ${stop}`,
    });
  }
  // ---------- rules ----------
  const rules = buildRules(raw, unp);

  // ---------- build world events ----------
  const flagOf = new Map(flags.map((f) => [f.trigger, f.name]));
  const events: WorldEvent[] = raw.map((e) => {
    const isWar = e.id.startsWith('WR-');
    const markOk = e.mark ?? '○';
    if (!e.mark) unp.add(F.world, e.line, e.id, 'ไม่มีเครื่องหมาย ⭐ ● ○ ในชื่อ (ตัวจำลองนับเป็น ○)');
    const sim = eraGate(e.cond);
    const docEra = isWar ? eraColumn(e.what) ?? sim : sim;
    const prereq = [...new Set(idsIn(e.cond).filter((x) => x !== e.id))];
    const isFall = fallIds.has(e.id);
    const role: WorldEvent['role'] = isFall ? 'fall' : e.id === MOURN ? 'mourn' : e.id === HERO ? 'hero' : ENDINGS.includes(e.id) ? 'ending' : e.id === START_EVENT ? 'start' : undefined;
    const dragon = dragons.find((d) => d.fallEvent === e.id || d.awakeEvent === e.id)?.index;
    const effectCell = e.eff;
    const outcomeParts = isWar || /\*\*[กขค]\)/.test(effectCell + e.what) ? splitOutcomes(isWar ? effectCell : effectCell.includes('**ก)') ? effectCell : e.what) : [];
    const effects: Effect[] = [];
    const chain: string[] = [];
    const flag = flagOf.get(e.id);
    if (flag) effects.push({ k: 'grant', kind: 'flag', id: flag });
    const outcomes: Outcome[] = [];
    const baseCell = outcomeParts.length ? effectCell.split('**ก)')[0] : effectCell;
    const p = isWar && outcomeParts.length ? { effects: [] as Effect[], chain: [] as string[], unparsed: [] as string[] } : parseWorldEffect(baseCell, e.id, ids);
    p.unparsed.forEach((u) => unp.add(F.world, e.line, u, `${e.id} ผลถาวร`));
    effects.push(...p.effects);
    chain.push(...p.chain);
    for (const o of outcomeParts) {
      const po = parseWorldEffect(o.text, e.id, ids);
      po.unparsed.forEach((u) => unp.add(F.world, e.line, u, `${e.id} ผลลัพธ์ ${o.key}`));
      outcomes.push({ key: o.key, label: o.label, text: plain(o.text), effects: po.effects, chain: po.chain });
      for (const c of po.chain) if (!chain.includes(c)) chain.push(c);
    }
    // the condition cell may name events that this one leads to; the chain is the effect cell only
    const ev: WorldEvent = {
      id: e.id,
      name: e.name,
      alias: e.alias,
      mark: markOk,
      group: e.id.split('-')[0],
      condText: plain(e.cond),
      whatText: isWar ? '' : plain(e.what),
      effectText: plain(effectCell),
      era: docEra,
      needs: prereq,
      thr: thresholds(e.cond, pillarIndex.get(e.id)),
      home: homeOf(e),
      effects,
      chain: chain.filter((x) => x !== e.id),
      outcomes,
      faith: faithByEvent.get(e.id) ?? [],
      witness: witness.get(e.id) ?? [],
      src: `${F.world}:${e.line}`,
    };
    if (docEra[0] !== sim[0] || docEra[1] !== sim[1]) ev.eraSim = sim;
    const { cond, note } = condOf(e, moodIndex.get(e.id), (t) => unp.add(F.world, e.line, t, `${e.id} เงื่อนไขเป็นข้อความ`));
    if (cond) ev.cond = cond;
    if (note) ev.condNote = note;
    // numbers the prose cell gives beyond thresholds: fallen dragons, keys held, peace events, and which events an ending needs together
    const dfcMin = e.cond.match(/DFC ≥ (\d+)/)?.[1];
    const dfcEq = e.cond.match(/DFC = (\d+)/)?.[1];
    if (dfcMin) ev.dfc = [+dfcMin, 15];
    else if (dfcEq) ev.dfc = [+dfcEq, +dfcEq];
    const keys = e.cond.match(/กุญแจ (\d+)\+ ชิ้น/)?.[1];
    if (keys) ev.keysMin = +keys;
    const hp = e.cond.match(/เหตุการณ์ HP เกิดแล้วอย่างน้อย (\d+) รายการ/)?.[1];
    if (hp) ev.hpMin = +hp;
    if (role === 'ending') {
      const all = plain(e.cond).split(/\s+\+\s+/).filter((part) => !/หรือ/.test(part)).flatMap((part) => idsIn(part)).filter((x) => x !== e.id);
      if (all.length) ev.needsAll = [...new Set(all)];
    }
    if (role) ev.role = role;
    if (dragon !== undefined) ev.dragon = dragon;
    if (flag) ev.flag = flag;
    if (econ.has(e.id)) ev.econ = econ.get(e.id);
    return ev;
  });

  // ---------- branch events (branches/02) ----------
  const branch: BranchEvent[] = [];
  {
    const sectionOf: Record<string, string> = {};
    for (const t of tables(F.b2)) {
      if (!/^ID · ชื่อ/.test(t.header[0])) continue;
      const head = t.headings.find((h) => /^\d+\. /.test(h)) ?? '';
      const cont = head.replace(/^\d+\.\s*/, '').replace(/\s*[—(].*$/, '');
      const headTrigger = head.match(/หลัง ([A-Z]{2,3}-\d{2})/)?.[1] ?? null;
      for (const r of t.rows) {
        const m = r.cells[0].match(/^\*\*([A-Z]{2}-\d{2}) ([⭐●○])? ?([^*]*)\*\*/);
        if (!m) continue;
        sectionOf[m[1]] = cont;
        const cond = r.cells[1];
        const trigger = headTrigger;
        const replaces = cond.startsWith('แทน') ? idsIn(cond.replace(/;.*$/, '')) : [];
        const years = cond.match(/(?:ภายใน|หลัง [A-Z]{2}-\d{2})\s*(\d+)\s*ปี/);
        const p = parseWorldEffect(r.cells[3], m[1], ids);
        const p2 = parseWorldEffect(r.cells[2], m[1], ids);
        [...p.unparsed, ...p2.unparsed].forEach((u) => unp.add(F.b2, r.line, u, `${m[1]}`));
        const eff = econ.get(m[1]);
        const need = [...new Set(anyIdsIn(cond).filter((x) => x !== m[1] && !replaces.includes(x)))];
        branch.push({
          id: m[1],
          name: m[3].trim(),
          mark: (m[2] as Mark) || '○',
          group: m[1].split('-')[0],
          continent: cont,
          trigger,
          condText: plain(cond),
          whatText: plain(r.cells[2]),
          effectText: plain(r.cells[3]),
          replaces,
          needs: need,
          ...(years ? { afterYears: +years[1] } : {}),
          effects: p.effects,
          chain: p.chain,
          ...(eff ? { econ: eff } : {}),
          src: `${F.b2}:${r.line}`,
        });
      }
    }
  }

  // ---------- last era (branches/04) ----------
  const phases: LastEraPhase[] = [];
  const lastEra: LastEraEvent[] = [];
  {
    const pt = tables(F.b4).find((t) => t.header[0] === 'ช่วง')!;
    const startOf = (s: string) => Number(s.match(/DFC = (\d+)/)?.[1]);
    const starts = [startOf(pt.rows[0].cells[2]), startOf(pt.rows[0].cells[3]), startOf(pt.rows[2].cells[2])];
    pt.rows.forEach((r, i) => phases.push({ id: r.cells[0], name: r.cells[1], dfc: [starts[i], i === 2 ? 14 : starts[i + 1] - 1] }));
    const fbTable = tables(F.b4).find((t) => t.header[0] === 'LE' && t.header[1].startsWith('ผลต่อสถานะโลก'))!;
    const fbBy = new Map<string, { text: string; line: number }>();
    for (const r of fbTable.rows) for (const id of r.cells[0].match(/LE-\d{2}/g) || []) fbBy.set(id, { text: r.cells[1], line: r.line });
    const leTable = tables(F.b4).find((t) => /^ID · ชื่อ/.test(t.header[0]))!;
    const rulesText = readDoc(F.b4).split('## 2.')[1].split('## 3.')[0];
    const repeatList = rulesText.match(/ยกเว้น ((?:LE-\d{2}\s*)+)ซึ่งเกิดซ้ำได้ ห่างกันอย่างน้อย (\d+) ปี/);
    const repeatIds: string[] = repeatList ? repeatList[1].match(/LE-\d{2}/g)! : [];
    for (const r of leTable.rows) {
      const m = r.cells[0].match(/^\*\*(LE-\d{2}) ([⭐●○]) ([^*]*)\*\*/);
      if (!m) continue;
      const cond = r.cells[1];
      const ph = [...cond.matchAll(/4[กขค]/g)].map((x) => x[0]);
      const range = /4([กขค]) ถึง 4([กขค])/.exec(cond);
      const used = range ? phases.filter((p) => p.id >= '4' + range[1] && p.id <= '4' + range[2]).map((p) => p.id) : [...new Set(ph)];
      const sel = phases.filter((p) => used.includes(p.id));
      const dfcMin = cond.match(/DFC ≥ (\d+)/)?.[1];
      const dfc: [number, number] = sel.length ? [Math.min(...sel.map((p) => p.dfc[0])), Math.max(...sel.map((p) => p.dfc[1]))] : [dfcMin ? +dfcMin : 10, 14];
      const needs = [...new Set(cond.match(/\bLE-\d{2}\b/g) || [])].filter((x) => x !== m[1]);
      const keysMin = cond.match(/(?:กุญแจที่รวมได้|ถือกุญแจ|ผู้ถือกุญแจ) ≥ (\d+)/)?.[1];
      const cv = [...new Set(cond.match(/\bcv\.\d+\b/g) || [])];
      const fb = fbBy.get(m[1]);
      const un: string[] = [];
      let feedback: LastEraEvent['feedback'] = fb ? (m[1] === 'LE-11' ? { text: plain(fb.text), lean: parseLean(fb.text) } : parseFeedback(fb.text, un)) : { text: '' };
      un.forEach((u) => unp.add(F.b4, fb?.line ?? r.line, u, `${m[1]} ผลต่อสถานะโลก`));
      const p = parseWorldEffect(r.cells[3], m[1], ids);
      const p2 = parseWorldEffect(r.cells[1] + ' ' + r.cells[2], m[1], ids);
      p.unparsed.forEach((u) => unp.add(F.b4, r.line, u, `${m[1]} ผลถาวร`));
      const le: LastEraEvent = {
        id: m[1],
        name: m[3].trim(),
        mark: m[2] as Mark,
        condText: plain(cond),
        whatText: plain(r.cells[2]),
        effectText: plain(r.cells[3]),
        phases: used,
        dfc,
        needs,
        feedback,
        chain: [...new Set([...p.chain, ...p2.chain])].filter((x) => x !== m[1] && !needs.includes(x)),
        src: `${F.b4}:${r.line}`,
      };
      if (keysMin) le.keysMin = +keysMin;
      if (cv.length) le.cv = cv;
      if (repeatIds.includes(m[1]) || /ซ้ำได้/.test(cond)) le.repeatYears = repeatList ? +repeatList[2] : 30;
      if (/นับถอยหลัง/.test(cond)) le.countdown = true;
      const same = cond.match(/เกิดในปีเดียวกับ (WR-\d{2})/);
      if (same) le.withEvent = same[1];
      lastEra.push(le);
    }
  }

  // ---------- assemble world-events.json ----------
  const world: WorldEventsData = {
    rules,
    dragons,
    vars,
    disturb,
    flags,
    closures,
    faiths,
    mainFaiths,
    events,
    branch,
    lastEra,
    phases,
  };
  writeGen('world-events', world, sources, 'scripts/codegen/groups/events.ts');

  // ---------- local events ----------
  const local = buildLocal(ids, unp, new Set([...raw.map((e) => e.id), ...branch.map((b) => b.id), ...lastEra.map((l) => l.id)]));
  writeGen('local-events', local, [F.local, F.localGen], 'scripts/codegen/groups/events.ts');
  unp.write();

  return { group: 'events', files: ['world-events.json', 'local-events.json'], unparsed: unp.count, strict: true };
}

const MINUS_RE = /[−–]/g;

/**
 * The condition cell of a world event as a tree. A war row writes `pair · fuse`: the pair (`จักรกล × มังกร`, `ภายใน…`) and a fuse that
 * holds no readable atom are the story of the war, kept in `condNote`; what can be tested stays in `cond`.
 */
function condOf(e: { id: string; cond: string }, pillar: number | undefined, text: (t: string) => void): { cond?: WorldCond; note?: string } {
  const report = (r: ReturnType<typeof parseCond>) => r.texts.forEach(text);
  if (!e.id.startsWith('WR-')) {
    const r = parseCond(e.cond, { pillar, dragons: dragonNames });
    report(r);
    return r.cond ? { cond: r.cond } : {};
  }
  const notes: string[] = [];
  const conds: WorldCond[] = [];
  for (const part of plain(e.cond).split(/\s+·\s+/)) {
    const r = parseCond(part, { pillar, dragons: dragonNames });
    if (!r.cond) {
      if (/[฀-๿A-Za-z]/.test(part.replace(/ยุค\s*[≥\d–-]+/g, '').replace(/ทุกยุค/g, ''))) notes.push(part);
      continue;
    }
    if (r.cond.k === 'text') {
      notes.push(part);
      continue;
    }
    report(r);
    conds.push(r.cond);
  }
  const cond = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : ({ k: 'and', of: conds.flatMap((c) => (c.k === 'and' ? c.of : [c])) } as WorldCond);
  return { ...(cond ? { cond } : {}), ...(notes.length ? { note: notes.join(' · ') } : {}) };
}

// ---------- rules block ----------

function buildRules(raw: { id: string; mark: Mark | null; cond: string; eff: string }[], unp: Unparsed): WorldRules {
  const text = readDoc(F.world);
  const sec = text.split('### 0.2 ')[1].split('### 0.2.1')[0];
  const rate = { '⭐': 0.08, '●': 0.12, '○': 0.2 } as Record<Mark, number>;
  const capYears = { '⭐': 80, '●': 25, '○': 8 } as Record<Mark, number>;
  const rm = sec.match(/⭐ (\d+)% · ● (\d+)% · ○ (\d+)%/);
  if (rm) [rate['⭐'], rate['●'], rate['○']] = [+rm[1] / 100, +rm[2] / 100, +rm[3] / 100];
  else unp.add(F.world, lineOf(F.world, 'ค่าตั้งต้นต่อทศวรรษ'), 'ค่าตั้งต้นต่อทศวรรษ', 'หา ⭐ 8% · ● 12% · ○ 20% ไม่พบ');
  const cm = sec.match(/⭐ เกิดไม่เกิน 1 ครั้งต่อ (\d+) ปี · ● ไม่เกิน 1 ต่อ (\d+) ปี · ○ ไม่เกิน 1 ต่อ (\d+) ปี/);
  if (cm) [capYears['⭐'], capYears['●'], capYears['○']] = [+cm[1], +cm[2], +cm[3]];
  else unp.add(F.world, lineOf(F.world, 'ไม่เกิน 1 ครั้งต่อ'), 'เพดานความถี่', 'หา ⭐ 80 ● 25 ○ 8 ปี ไม่พบ');
  // events the cap does not count: DR-01 DR-04 ถึง DR-08 DR-13 END-01 ถึง END-09 and DR-15
  const capLine = sec.split('\n').find((l) => l.includes('เพดานนี้ไม่นับ')) ?? '';
  const free: string[] = [];
  for (const m of capLine.matchAll(/((?:DR|END)-\d{2})(?: ถึง ((?:DR|END)-\d{2}))?/g)) {
    if (!m[2]) free.push(m[1]);
    else {
      const [p, a] = m[1].split('-'), b = Number(m[2].split('-')[1]);
      for (let n = Number(a); n <= b; n++) free.push(`${p}-${String(n).padStart(2, '0')}`);
    }
  }
  // DR-13: ราว 2% before the first fall, ราว 7% after
  const hm = sec.match(/ก่อนมีมังกรล้มตัวแรก[^\n]*?ราว (\d+)% ต่อทศวรรษ[^\n]*?ตีได้ ราว (\d+)% ต่อทศวรรษ/);
  const hero = hm ? { before: +hm[1] / 100, after: +hm[2] / 100 } : { before: 0.02, after: 0.07 };
  // mourning wave
  const moodDoc = readDoc(F.mood);
  const mm = moodDoc.match(/อารมณ์ −(\d+) ถึง −(\d+)[^\n]*?ตัวที่สนิทสุดได้ −(\d+)/);
  const cl = moodDoc.match(/ลดถาวร (\d+) ต่อการล้ม/);
  const fa = moodDoc.match(/ศรัทธาช่อง A ทั่วโลก \| \+(\d+) เป็นเวลา(\S+)ปี/);
  const yearWords: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10 };
  const mourn = {
    moodMin: mm ? +mm[1] : 3,
    moodMax: mm ? +mm[2] : 5,
    moodClosest: mm ? +mm[3] : 8,
    capLoss: cl ? +cl[1] : 3,
    faithA: fa ? +fa[1] : 10,
    faithAYears: fa ? (yearWords[fa[2]] ?? 5) : 5,
  };
  // era 4: END and MC-12 weight x3
  const era4 = text.match(/ยุค 4 บังคับให้เหตุการณ์ชั้นลึก \(END, MC-12\) น้ำหนักสูงขึ้น (\d+) เท่า/);
  // eras by DFC
  const eras: { era: number; dfc: [number, number] }[] = [];
  for (const t of tables(F.storyContinents)) {
    if (t.header[0] !== 'ยุค' || t.header[2] !== 'DFC') continue;
    for (const r of t.rows) {
      const m = r.cells[2].match(/^(\d+)(?:[–-](\d+))?$/);
      if (m) eras.push({ era: Number(r.cells[0]), dfc: [+m[1], m[2] ? +m[2] : +m[1]] });
    }
  }
  const windowYears = Number(readDoc(F.convergence).match(/จุดบรรจบเปิดอยู่ (\d+) ปีโลก/)?.[1] ?? 100);
  const lean: WorldRules['lean'] = [];
  const lm = readDoc('docs/systems/events/branches/04-last-era.md').match(/ผนึก (\d+)% · เปิด (\d+)% · กระจาย (\d+)%/);
  if (lm) lean.push({ key: 'a', chance: +lm[1] / 100, ending: 'END-12' }, { key: 'b', chance: +lm[2] / 100, ending: 'END-11' }, { key: 'c', chance: +lm[3] / 100, ending: 'END-10' });
  const endings = ENDINGS.map((id) => {
    const e = raw.find((x) => x.id === id)!;
    const c = e.cond.match(/(\d+)% ต่อทศวรรษ/);
    return { id, chance: c ? +c[1] / 100 : null, text: plain(e.cond) };
  });
  const keyW = readDoc(F.b4).match(/โอกาสเกิดคูณ \(1 \+ \(K − (\d+)\) × ([\d.]+)\)/);
  const warRepeat = text.match(/คู่เดิมเปิดซ้ำได้หลังผ่านไป ≥ (\d+) ปี/);
  const counts = text.match(/น้ำหนัก: ⭐ (\d+) · ● (\d+) · ○ (\d+)/);
  return {
    rate,
    capYears,
    capFree: free,
    hero,
    windowYears,
    mourn,
    era4Weight: { events: raw.filter((e) => e.id.startsWith('END-') && !ENDINGS.includes(e.id)).map((e) => e.id).concat(['MC-12']), mul: era4 ? +era4[1] : 3 },
    eras,
    lean,
    endings,
    keyWeight: keyW ? { from: +keyW[1], per: Number(keyW[2]) } : { from: 4, per: 0.5 },
    warRepeatYears: warRepeat ? +warRepeat[1] : 100,
    markCounts: counts ? { '⭐': +counts[1], '●': +counts[2], '○': +counts[3] } : { '⭐': 0, '●': 0, '○': 0 },
  };
}

// ---------- local events ----------

const COUNTRY_CODE = /\b(?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}\b/g;

function localNpcs(cell: string, at: string, unp: Unparsed, line: number): LocalNpc[] {
  const out: LocalNpc[] = [];
  for (const part of cell.split(/\s+·\s+/)) {
    const m = part.trim().match(/^([A-Z]{2}\d{2}-\d)\s+(.*?)(?:\s*([★☆]))?$/);
    if (!m) {
      unp.add(at, line, part, 'NPC ที่บรรจบอ่านไม่ได้');
      continue;
    }
    out.push({ id: m[1], name: m[2].trim(), star: (m[3] as '★' | '☆') || '' });
  }
  return out;
}

function readsOf(depends: string): LocalRead[] {
  const out: LocalRead[] = [];
  const text = plain(depends).replace(/`/g, '');
  const parts = text.split(/\s*หรือ\s*|\s*และ\s*|\s*·\s*/);
  for (const seg of parts) {
    for (const id of anyIdsIn(seg)) {
      if (out.some((x) => x.id === id)) continue;
      const phase: LocalRead['phase'] = /ใกล้เกิด/.test(seg) ? 'near' : /เกิดแล้ว|หลัง|ภายใน/.test(seg) ? 'after' : 'window';
      out.push({ id, phase });
    }
  }
  return out;
}

function buildLocal(ids: ReturnType<typeof idIndex>, unp: Unparsed, eventIds: Set<string>): LocalEventsData {
  const allEvents = new Set([...eventIds, ...ids.events]);
  const rowOf = (cells: string[], line: number, generated: boolean, file: string): LocalEvent | null => {
    const m = cells[0].match(/^\*\*(LC-\d+) ([^*]*)\*\*(?:\s*\((LT-\d)\))?/);
    if (!m) return null;
    const at = `${file}:${line}`;
    const { common, paths } = splitPaths(cells[5]);
    const parsedCommon = parseLocalEffect(common, ids);
    parsedCommon.unparsed.forEach((u) => unp.add(file, line, u, `${m[1]} ผลถาวร`));
    const pathOut = paths.map((p) => {
      const q = parseLocalEffect(p.text, ids);
      q.unparsed.forEach((u) => unp.add(file, line, u, `${m[1]} ผลถาวร`));
      return { when: p.when, text: p.text, effects: q.effects, chain: q.localChain, receives: q.receives, touches: q.chain };
    });
    const chain = [...parsedCommon.localChain, ...pathOut.flatMap((p) => p.chain)];
    const receives = [...new Set([...parsedCommon.receives, ...pathOut.flatMap((p) => p.receives)])];
    const depends = parseCond(cells[2], { dragons: dragonNames });
    depends.texts.forEach((t) => unp.add(file, line, t, `${m[1]} ขึ้นกับ: เงื่อนไขเป็นข้อความ`));
    const chanceM = cells[6].match(/(\d+(?:\.\d+)?)%/);
    if (!chanceM) unp.add(file, line, cells[6], `${m[1]} โอกาสต่อทศวรรษอ่านไม่ได้`);
    const ev: LocalEvent = {
      id: m[1],
      name: m[2].trim(),
      ...(m[3] ? { template: m[3] } : {}),
      generated,
      placeText: plain(cells[1]),
      countries: [...new Set(cells[1].match(COUNTRY_CODE) || [])],
      dependsText: plain(cells[2]),
      reads: readsOf(cells[2]),
      depends: depends.cond ?? { k: 'text', text: plain(cells[2]) },
      npcs: localNpcs(cells[3], file, unp, line),
      whatText: plain(cells[4]),
      resultText: plain(cells[5]),
      paths: pathOut.map(({ when, text, effects, chain: c }) => ({ when, text, effects, chain: c })),
      effects: parsedCommon.effects,
      touches: [...new Set([...parsedCommon.chain, ...pathOut.flatMap((p) => p.touches)])],
      chain,
      receives,
      chance: chanceM ? Number(chanceM[1]) / 100 : 0,
      src: at,
    };
    return ev;
  };

  const handT = tables(F.local).find((t) => /^ID · ชื่อ/.test(t.header[0]))!;
  const events: LocalEvent[] = [];
  for (const r of handT.rows) {
    const ev = rowOf(r.cells, r.line, false, F.local);
    if (ev) events.push(ev);
  }
  const genT = tables(F.localGen).find((t) => /^ID · ชื่อ/.test(t.header[0]))!;
  const generated: LocalEvent[] = [];
  for (const r of genT.rows) {
    const ev = rowOf(r.cells, r.line, true, F.localGen);
    if (ev) generated.push(ev);
  }

  // templates
  const tt = tables(F.local).find((t) => t.header[0] === 'แม่แบบ')!;
  const templates: LocalTemplate[] = tt.rows.map((r) => {
    const id = r.cells[0].match(/^(LT-\d)/)![1];
    const name = r.cells[0].replace(/^LT-\d\s*/, '');
    const open = r.cells[1];
    const war = [...open.matchAll(/war=(\w+)/g)].map((m) => m[1]);
    const justice = [...open.matchAll(/justice=(\w+)/g)].map((m) => m[1]);
    const marks = open.match(/mark=\s*มี(.*)$/)?.[1].trim();
    const p = parseLocalEffect(r.cells[3], ids);
    p.unparsed.forEach((u) => unp.add(F.local, r.line, u, `${id} ผล`));
    return {
      id,
      name,
      openText: plain(open),
      npcText: plain(r.cells[2]),
      resultText: plain(r.cells[3]),
      open: { ...(war.length ? { war } : {}), ...(justice.length ? { justice } : {}), ...(marks ? { landmarks: marks.split(/\s+หรือ\s+|\s+/).filter(Boolean) } : {}), text: plain(open) },
      effects: p.effects,
      src: `${F.local}:${r.line}`,
    };
  });

  // checks that cost nothing: every id a local event reads must exist
  for (const e of [...events, ...generated]) {
    for (const rd of e.reads) if (!allEvents.has(rd.id)) unp.add(e.src.split(':')[0], Number(e.src.split(':')[1]), rd.id, `${e.id} อ้างเหตุการณ์ที่ไม่มี`);
    for (const n of e.npcs) if (!ids.npcs.has(n.id)) unp.add(e.src.split(':')[0], Number(e.src.split(':')[1]), n.id, `${e.id} อ้าง NPC ที่ไม่มี`);
  }
  return { rules: { once: true, minNpcs: 3, chance: 0.08 }, templates, events, generated };
}
