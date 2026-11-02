// Storyline generator (code-plan §5.1 row 1): docs/lore/storylines/01..31 and 00-convergence.md
// → data/gen/storylines.json (nodes, rites, endings, links, lines, ally arcs) and data/gen/convergence.json.
import type { GenReport } from '../run-all';
import { idIndex, type IdIndex } from '../lib/ids';
import { parseCell, parseChoice, parseConditionX, parseWeightCell, type Parsed } from '../lib/effects';
import { Unparsed, listDocs, readDoc, rel, tables, writeGen, type Row, type Table } from '../lib/table';
import type {
  AllyArc,
  AllyEnding,
  AllyStep,
  ChoiceX,
  ConditionX,
  ConvergenceData,
  ConvergencePoint,
  EffectX,
  Ending,
  LineMeta,
  Link,
  MoodEffect,
  NodeKind,
  Rite,
  RiteOutcome,
  StoryNodeX,
  StorylinesData,
} from '../../../src/core/data/types-storylines';
import type { Condition, LifeStage } from '../../../src/core/types';

const GROUP = 'storylines';
const BY = 'scripts/codegen/groups/storylines.ts';
const DIR = 'docs/lore/storylines';
const NODE_ID = /^[a-z]{2}\.[btaelx]\d+$/;
const NODE_ID_G = /\b([a-z]{2}\.[btaelx]\d+)\b/g;
const NODE_CHOICE_G = /\b([a-z]{2}\.[btaelx]\d+|cv\.\d+)(?:\s*(?:จบ)?ทาง\s*([กขค]))?/g;
const KEY: Record<string, 'a' | 'b' | 'c'> = { ก: 'a', ข: 'b', ค: 'c' };
const STAGE_BY_AGE = (min: number): LifeStage => (min < 13 ? 'b' : min < 20 ? 't' : min < 55 ? 'a' : 'e');

const unparsed = new Unparsed(GROUP);

// ---------- small helpers ----------

/** `0–3` `65+` `55+` `5–12` `20` → [min, max] with 999 for open ended. */
export function parseAge(text: string): [number, number] | null {
  const t = text.replace(/\s/g, '');
  let m = t.match(/^(\d+)[–\-~](\d+)$/);
  if (m) return [Number(m[1]), Number(m[2])];
  m = t.match(/^(\d+)\+$/);
  if (m) return [Number(m[1]), 999];
  m = t.match(/^(\d+)$/);
  if (m) return [Number(m[1]), Number(m[1])];
  return null;
}

/** Age cells of the races that wake instead of being born say things like `อายุ 20–28 (เทียบ)`, `ปีแรก`, `ทุกวัย`. */
export function parseAgeLoose(text: string): [number, number] | null {
  const strict = parseAge(text);
  if (strict) return strict;
  const num = text.match(/(\d+)\s*[–\-]\s*(\d+)/);
  if (num) return [Number(num[1]), Number(num[2])];
  if (/ทุกวัย/.test(text)) return [0, 999];
  if (/ช่วงผู้เฒ่า/.test(text)) return [55, 999];
  // `so mu gh` b and t nodes count the first three life years after waking, which are 17 to 19 (README §7)
  const year = (t: string) => (/แรก/.test(t) ? 17 : /สาม/.test(t) ? 19 : /สอง/.test(t) ? 18 : null);
  const parts = text.split('ถึง');
  const a = year(parts[0]);
  const b = parts[1] ? (year(parts[1]) ?? a) : a;
  return a !== null && b !== null ? [a, b] : null;
}

const uniq = <T>(a: T[]) => [...new Set(a)];
const and = (a: ConditionX | undefined, b: ConditionX): ConditionX => (a ? { k: 'and', of: [a as Condition, b as Condition] } : b);

function fileLines(file: string): string[] {
  return readDoc(file).split('\n');
}

/** Prose between the nearest heading above a line and that line. */
function introBefore(lines: string[], tableLine: number): string {
  const out: string[] = [];
  for (let i = tableLine - 2; i >= 0; i--) {
    const l = lines[i];
    if (l.startsWith('#')) break;
    if (l.startsWith('|')) continue;
    if (l.trim()) out.unshift(l.trim());
  }
  return out.join('\n');
}

const tribalFile = (f: string) => /\/(0[1-9]|1\d|2[01])-/.test(f);

// ---------- nodes ----------

interface NodeCtx {
  file: string;
  kind: NodeKind;
  section: string;
  ids: IdIndex;
}

function reportUnparsed(ctx: { file: string }, line: number, who: string, list: string[]) {
  for (const u of list) unparsed.add(ctx.file, line, `${who}: ${u}`);
}

/** Converge targets named in effects of a cell, including those nested in `if`. */
function convergeTargets(effects: EffectX[]): string[] {
  const out: string[] = [];
  for (const e of effects) {
    if (e.k === 'converge') out.push(e.to);
    else if (e.k === 'if') out.push(...convergeTargets(e.then as EffectX[]));
  }
  return out;
}

function unknownIds(effects: EffectX[], ctx: { file: string }, line: number, who: string) {
  for (const e of effects) {
    if (e.k === 'grant' && e.kind === 'unknown') unparsed.add(ctx.file, line, `${who}: \`${e.id}\``, 'unknown id');
    else if (e.k === 'if' || e.k === 'only') unknownIds(e.then as EffectX[], ctx, line, who);
  }
}

function nodeFromRow(row: Row, ctx: NodeCtx): StoryNodeX | null {
  const c = row.cells;
  const id = c[0];
  if (!NODE_ID.test(id)) {
    unparsed.add(ctx.file, row.line, c[0], 'node id not recognised');
    return null;
  }
  const line = id.split('.')[0];
  const letter = id.split('.')[1][0];
  const age = parseAgeLoose(c[1]);
  if (!age) unparsed.add(ctx.file, row.line, `${id} อายุ ${c[1]}`, 'age not readable');
  const ageR: [number, number] = age ?? [0, 999];
  const stage: LifeStage = letter === 'l' ? STAGE_BY_AGE(ageR[0]) : (letter as LifeStage);
  const titleEvents = uniq([...c[2].matchAll(/\b([A-Z]{2,4}-\d{2,3})\b/g)].map((m) => m[1]).filter((e) => ctx.ids.events.has(e)));
  const node: StoryNodeX = {
    id,
    line,
    stage,
    age: ageR,
    title: c[2],
    kind: ctx.kind,
    section: ctx.section,
    choices: [],
    notes: [],
    titleEvents,
    notesText: c[6] ?? '',
    src: `${ctx.file}:${row.line}`,
  };
  if (titleEvents.length) {
    const of = titleEvents.map((e) => ({ k: 'event', id: e, happened: true }) as Condition);
    node.when = of.length === 1 ? of[0] : { k: 'or', of };
  }
  const keys = ['a', 'b', 'c'] as const;
  const choiceWhen: Parsed['choiceWhen'] = {};
  const nodeWhen: ConditionX[] = [];
  let rite = false;
  for (let i = 0; i < 3; i++) {
    const cell = (c[3 + i] ?? '').trim();
    if (!cell) continue;
    if (!/^\d/.test(cell)) {
      // no weight: the whole row hands off (`→ cv.4`) or points at the rite section
      const p = parseCell(cell, ctx.ids, { notes: true });
      if (p.rite) rite = true;
      node.notes.push(...(p.effects as EffectX[]));
      const conv = convergeTargets(p.effects as EffectX[]);
      if (conv.length) node.converge = uniq([...(node.converge ?? []), ...conv]);
      reportUnparsed(ctx, row.line, `${id} ${keys[i]})`, p.unparsed);
      continue;
    }
    const { choice, unparsed: un, parsed } = parseChoice(keys[i], cell, ctx.ids);
    node.choices.push(choice as ChoiceX);
    reportUnparsed(ctx, row.line, `${id} ${keys[i]})`, un);
    unknownIds(choice.effects as EffectX[], ctx, row.line, `${id} ${keys[i]})`);
    if (parsed.nodeWhen) nodeWhen.push(...parsed.nodeWhen);
    if (parsed.replaces) node.replaces = uniq([...(node.replaces ?? []), ...parsed.replaces]);
  }
  const notes = parseCell(c[6] ?? '', ctx.ids, { battle: true, notes: true });
  node.notes.push(...(notes.effects as EffectX[]));
  reportUnparsed(ctx, row.line, `${id} ศึก·NPC·โลก`, notes.unparsed);
  unknownIds(notes.effects as EffectX[], ctx, row.line, `${id} ศึก·NPC·โลก`);
  if (notes.rite) rite = true;
  if (notes.nodeWhen) nodeWhen.push(...notes.nodeWhen);
  if (notes.replaces) node.replaces = uniq([...(node.replaces ?? []), ...notes.replaces]);
  Object.assign(choiceWhen, notes.choiceWhen);
  for (const ch of node.choices) if (choiceWhen[ch.key]) ch.when = and(ch.when, choiceWhen[ch.key]!);
  for (const w of nodeWhen) node.when = and(node.when, w);
  if (rite) node.rite = id;
  // entry weight changes written without a target belong to the convergence this row enters
  const conv0 = node.converge?.[0];
  for (const e of node.notes) if (e.k === 'entryMod' && !e.to && conv0) e.to = conv0;
  return node;
}

// ---------- tribal pieces ----------

function lineNameFrom(file: string, lineId: string, headings: string[]): string {
  const h1 = fileLines(file).find((l) => l.startsWith('# '));
  if (tribalFile(file)) {
    const m = h1?.match(/เส้นเรื่อง:\s*(.+?)\s*\(/);
    if (m) return m[1];
  }
  for (const h of headings) {
    const m = h.match(new RegExp(`(?:^|[\\s.])${lineId}\\s+([^()]+?)\\s*(?:\\(|$)`));
    if (m) return m[1].trim();
    const p = h.match(new RegExp(`\\(${lineId}\\b`));
    if (p) return h.replace(/\s*\(.*$/, '').replace(/^[\d.]+\s*/, '').trim();
  }
  return (h1 ?? '').replace(/^#\s*เส้นเรื่อง:\s*/, '').trim();
}

function riteFrom(file: string, t: Table, ids: IdIndex): Rite | null {
  const head = t.headings[t.headings.length - 1] ?? '';
  const idm = head.match(/\(([a-z]{2}\.t\d)\)/);
  const lines = fileLines(file);
  const id = idm ? idm[1] : null;
  if (!id) return null;
  const title = head.replace(/^[\d.]+\s*/, '').replace(/\s*\(.*\)\s*$/, '').trim();
  const outcomes: RiteOutcome[] = [];
  const four = t.header.length === 4;
  for (const r of t.rows) {
    const c = r.cells;
    const who = `${id} พิธี`;
    if (four) {
      const pass = parseCell(c[2] ?? '', ids);
      const fail = parseCell(c[3] ?? '', ids);
      reportUnparsed({ file }, r.line, `${who} ${c[0]} ผ่าน`, pass.unparsed);
      reportUnparsed({ file }, r.line, `${who} ${c[0]} ไม่ผ่าน`, fail.unparsed);
      outcomes.push({
        label: c[0],
        weight: null,
        mods: [],
        effects: [],
        text: c[1] ?? '',
        pass: { text: pass.label, effects: pass.effects as EffectX[] },
        fail: { text: fail.label, effects: fail.effects as EffectX[] },
      });
    } else {
      const w = parseWeightCell(c[1] ?? '', ids);
      const p = parseCell(c[2] ?? '', ids, { choice: false });
      reportUnparsed({ file }, r.line, `${who} ${c[0]} น้ำหนัก`, w.unparsed);
      reportUnparsed({ file }, r.line, `${who} ${c[0]}`, p.unparsed);
      unknownIds(p.effects as EffectX[], { file }, r.line, `${who} ${c[0]}`);
      const o: RiteOutcome = { label: c[0], weight: w.weight, mods: w.mods, effects: p.effects as EffectX[], text: p.label };
      if (w.when) o.when = w.when;
      const after = c[0].match(/^หลัง\s*(.+)$/); // a row for the form after an event
      const ac = after ? parseConditionX(after[1], ids, true) : null;
      if (ac) o.when = and(o.when, ac);
      outcomes.push(o);
    }
  }
  return {
    id,
    line: id.split('.')[0],
    title,
    intro: introBefore(lines, t.line),
    header: t.header,
    form: four ? 'variants' : 'outcomes',
    outcomes,
    src: `${rel(file)}:${t.line}`,
  };
}

function nodeRefs(text: string): { id: string; choice?: 'a' | 'b' | 'c' }[] {
  return [...text.matchAll(NODE_CHOICE_G)].map((m) => (m[2] ? { id: m[1], choice: KEY[m[2]] } : { id: m[1] }));
}

function endingFrom(file: string, line: string, r: Row, ids: IdIndex): Ending {
  const [title, condRaw, legend] = r.cells;
  const cond = parseConditionX(condRaw ?? '', ids, true) ?? undefined;
  const events = uniq([...(condRaw ?? '').matchAll(/\b([A-Z]{2,4}-\d{2,3})\b/g)].map((m) => m[1]).filter((e) => ids.events.has(e)));
  const e: Ending = { line, title, condRaw: condRaw ?? '', nodes: nodeRefs(condRaw ?? ''), events, legend: legend ?? '', src: `${rel(file)}:${r.line}` };
  if (cond) e.cond = cond;
  return e;
}

function linkFrom(file: string, r: Row, ids: IdIndex): Link {
  const [from, toRaw, condRaw] = r.cells;
  const cond = parseConditionX(condRaw ?? '', ids, true) ?? undefined;
  const l: Link = {
    from,
    to: uniq(toRaw.match(/cv\.\d+|[a-z]{2}\.[btaelx]\d+/g) ?? []),
    toRaw,
    condRaw: condRaw ?? '',
    src: `${rel(file)}:${r.line}`,
  };
  if (cond) l.cond = cond;
  return l;
}

// ---------- allies ----------

const MOOD_G = /\{([฀-๿]+):([฀-๿]+)@(\d)\}/g;
const ALLY_KEEP = new Set(['mood', 'template', 'npc', 'event', 'place', 'bond', 'grant', 'ref', 'battle', 'death', 'converge', 'jump']);

function moodsOf(text: string): MoodEffect[] {
  return [...text.matchAll(MOOD_G)].map((m) => ({ k: 'mood', line: m[1], mood: m[2], level: Number(m[3]) }));
}

function allyEffects(text: string, ids: IdIndex): EffectX[] {
  const p = parseCell(text, ids, { notes: true });
  return (p.effects as EffectX[]).filter((e) => ALLY_KEEP.has(e.k) && e.k !== 'mood' && !(e.k === 'grant' && e.kind === 'unknown'));
}

function allyArcs(file: string, group: AllyArc['group'], ids: IdIndex): AllyArc[] {
  const lines = fileLines(file);
  const covers = new Map<string, { name: string; country: string; race: string; lines: string; origin: string }>();
  for (const t of tables(file))
    if (t.header[0] === 'NPC' && t.header[1] === 'ประเทศ')
      for (const r of t.rows) {
        const m = r.cells[0].match(/^([A-Z]{2}\d{2}-\d)\s+(.+)$/);
        if (m) covers.set(m[1], { name: m[2], country: r.cells[1], race: r.cells[2], lines: r.cells[3], origin: r.cells[4] ?? '' });
      }
  const arcs: AllyArc[] = [];
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^### ([A-Z]{2}\d{2}-\d)\s+(.+)$/);
    if (!h) continue;
    let j = i + 1;
    const body: string[] = [];
    while (j < lines.length && !/^#{1,3} /.test(lines[j])) body.push(lines[j++]);
    const cov = covers.get(h[1]);
    const lineDecl = body.find((l) => l.startsWith('สาย:'));
    const intro = body.find((l) => l.trim() && !l.startsWith('สาย:') && !l.startsWith('|') && !l.startsWith('ปลายทาง:')) ?? '';
    const steps: AllyStep[] = [];
    for (const l of body)
      if (l.startsWith('|') && !/^\|\s*(ขั้น|---)/.test(l)) {
        const c = l.split('|').slice(1, -1).map((x) => x.trim());
        const sm = c[0].match(/^(\d+)\s*(.*)$/);
        if (!sm) continue;
        steps.push({
          n: Number(sm[1]),
          title: sm[2],
          level: Number(c[1]) || 0,
          text: c[2] ?? '',
          moods: moodsOf(c[2] ?? ''),
          effects: allyEffects((c[2] ?? '').replace(MOOD_G, ' '), ids),
        });
      }
    const endLine = body.find((l) => l.startsWith('ปลายทาง:')) ?? '';
    const endings: AllyEnding[] = [];
    const parts = endLine.replace(/^ปลายทาง:\s*/, '').split(/(?:^|\s)([กขค])\)\s*(?=\d)/);
    for (let k = 1; k + 1 < parts.length; k += 2) {
      const mm = parts[k + 1].match(/^(\d+)\s+(.*)$/s);
      if (!mm) continue;
      endings.push({
        key: KEY[parts[k]],
        weight: Number(mm[1]),
        text: mm[2].trim(),
        moods: moodsOf(mm[2]),
        effects: allyEffects(mm[2].replace(MOOD_G, ' '), ids),
      });
    }
    const intro2 = intro;
    const evs = uniq([...intro2.matchAll(/เหตุ\s+((?:`[A-Z]{2}-\d+`\s*)+)/g)].flatMap((m) => [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1])));
    const wev = uniq([...intro2.matchAll(/โลก\s+((?:`[A-Z]{2,4}-\d+`\s*)+)/g)].flatMap((m) => [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1])));
    const rel2 = intro2.match(/NPC ที่เกี่ยว\s+(.+)$/);
    const related = rel2 ? uniq(rel2[1].match(/[A-Z]{2}\d{2}-\d/g) ?? []) : [];
    for (const s of steps) for (const m of s.text.matchAll(/\{[^}]*\}/g)) if (!moodsOf(m[0]).length) unparsed.add(file, i + 1, m[0], 'mood marker not in {สาย:อารมณ์@ระดับ} form');
    arcs.push({
      npc: h[1],
      name: h[2].trim(),
      country: cov?.country ?? '',
      race: cov?.race ?? '',
      lines: lineDecl ? lineDecl.replace('สาย:', '').split('·').map((x) => x.trim()).filter(Boolean) : [],
      origin: cov?.origin ?? '',
      intro: intro2,
      events: evs,
      worldEvents: wev,
      related,
      steps,
      endings,
      group,
      src: `${rel(file)}:${i + 1}`,
    });
  }
  return arcs;
}

// ---------- convergence ----------

function convergence(ids: IdIndex): ConvergenceData {
  const file = `${DIR}/00-convergence.md`;
  const lines = fileLines(file);
  const tabs = tables(file);
  const overview = tabs.find((t) => t.header[0] === 'รหัส');
  const meta = new Map<string, string[]>();
  for (const r of overview?.rows ?? []) meta.set(r.cells[0], r.cells);
  const points: ConvergencePoint[] = [];
  for (const t of tabs.filter((x) => x.header[0] === 'ทางเลือก' && /^cv\.\d+/.test(x.headings[x.headings.length - 1] ?? ''))) {
    const head = t.headings[t.headings.length - 1];
    const hm = head.match(/^(cv\.\d+)\s+(.+)$/)!;
    const id = hm[1];
    const m = meta.get(id) ?? [];
    const choices: ChoiceX[] = [];
    for (const r of t.rows) {
      const [label, weightCell, result] = r.cells;
      const km = label.match(/^([กขค])\)\s*(.*)$/);
      if (!km) {
        unparsed.add(file, r.line, label, 'choice key not recognised');
        continue;
      }
      const w = parseWeightCell(weightCell, ids);
      const p = parseCell(result, ids, { choice: true });
      reportUnparsed({ file }, r.line, `${id} ${km[1]}) น้ำหนัก`, w.unparsed);
      reportUnparsed({ file }, r.line, `${id} ${km[1]})`, p.unparsed);
      unknownIds(p.effects as EffectX[], { file }, r.line, `${id} ${km[1]})`);
      const ch: ChoiceX = { key: KEY[km[1]], weight: w.weight ?? 0, label: km[2], effects: p.effects as EffectX[], mods: w.mods };
      const when = [w.when, p.when].filter(Boolean) as ConditionX[];
      if (when.length) ch.when = when.length === 1 ? when[0] : { k: 'and', of: when as Condition[] };
      if (w.note) (ch as ChoiceX & { favours?: string }).favours = w.note;
      choices.push(ch);
    }
    // prose around the table: intro above, then ศึก: / ผลตามเผ่า: / ทางเข้าเพิ่ม below
    const start = lines.findIndex((l) => l === `### ${head.replace(/^.*?(cv\.)/, '$1')}` || l === `### ${head}`);
    let end = start + 1;
    while (end < lines.length && !/^#{1,3} /.test(lines[end])) end++;
    const prose = lines.slice(start + 1, end).filter((l) => l.trim() && !l.startsWith('|'));
    const intro = prose.filter((l) => !/^(ศึก:|ผลตามเผ่า:|\*\*ทางเข้าเพิ่ม)/.test(l)).join('\n');
    const battleText = (prose.find((l) => l.startsWith('ศึก:')) ?? '').replace(/^ศึก:\s*/, '');
    const byRace = (prose.find((l) => l.startsWith('ผลตามเผ่า:')) ?? '').replace(/^ผลตามเผ่า:\s*/, '');
    const extraLine = (prose.find((l) => l.startsWith('**ทางเข้าเพิ่ม')) ?? '').replace(/^\*\*ทางเข้าเพิ่ม[^*]*\*\*\s*/, '');
    const extraEntries: ConvergencePoint['extraEntries'] = [];
    for (const part of extraLine.split(/\s+·\s+/).filter(Boolean)) {
      const em = part.match(/^([a-z]{2}\.[btaelx]\d+)\s*(?:ทาง\s*([กขค]))?\s*(.*)$/);
      if (em) extraEntries.push({ from: em[1], ...(em[2] ? { choice: KEY[em[2]] } : {}), text: em[3] });
      else extraEntries.push({ from: '', text: part });
    }
    const bp = parseCell(battleText, ids, { battle: true, notes: true });
    reportUnparsed({ file }, start + 1, `${id} ศึก`, bp.unparsed);
    const open = parseConditionX(m[2] ?? '', ids, true) ?? undefined;
    const point: ConvergencePoint = {
      id,
      line: 'cv',
      stage: 'x',
      age: [0, 999],
      title: hm[2],
      kind: 'convergence',
      section: head,
      choices,
      notes: bp.effects as EffectX[],
      titleEvents: [],
      notesText: battleText,
      src: `${rel(file)}:${t.line}`,
      name: hm[2],
      openRaw: m[2] ?? '',
      placesRaw: m[3] ?? '',
      places: uniq((m[3] ?? '').match(/\b[A-Z]{2}-\d\d\b/g) ?? []),
      entriesRaw: m[4] ?? '',
      entries: uniq((m[4] ?? '').match(/\b[a-z]{2}\.[btaelx]\d+\b/g) ?? []),
      extraEntries,
      intro,
      byRace,
      battleText,
      npcs: uniq(battleText.match(/\b[A-Z]{2}\d{2}-\d\b/g) ?? []),
      enemies: uniq([...battleText.matchAll(/`([^`]+)`/g)].map((x) => x[1]).filter((x) => ids.enemies.has(x))),
    };
    if (open) {
      point.open = open;
      point.when = open;
    }
    points.push(point);
  }
  // section 3: the generic stand-in when a convergence is closed
  const ft = tabs.find((t) => t.headings.some((h) => h.startsWith('3. เมื่อจุดบรรจบยังไม่เปิด')));
  const fbChoices: ChoiceX[] = [];
  for (const r of ft?.rows ?? []) {
    const [label, weightCell, result] = r.cells;
    const km = label.match(/^([กขค])\)\s*(.*)$/)!;
    const w = parseWeightCell(weightCell, ids);
    const p = parseCell(result, ids, { choice: true });
    reportUnparsed({ file }, r.line, `cv.0 ${km[1]})`, p.unparsed);
    fbChoices.push({ key: KEY[km[1]], weight: w.weight ?? 0, label: km[2], effects: p.effects as EffectX[], mods: w.mods });
  }
  const fb: StoryNodeX = {
    id: 'cv.0',
    line: 'cv',
    stage: 'x',
    age: [0, 999],
    title: 'เมื่อจุดบรรจบยังไม่เปิด',
    kind: 'fallback',
    section: '3. เมื่อจุดบรรจบยังไม่เปิด',
    choices: fbChoices,
    notes: [],
    titleEvents: [],
    notesText: '',
    src: `${rel(file)}:${ft?.line ?? 0}`,
  };
  return { points, fallback: fb, intro: lines.slice(2, 8).filter((l) => l.trim()).join('\n') };
}

// ---------- run ----------

export default function run(): GenReport {
  const ids = idIndex();
  const files = listDocs(DIR, /^\d\d-.*\.md$/).filter((f) => !/\/00-/.test(f));
  const nodes: StoryNodeX[] = [];
  const rites: Rite[] = [];
  const endings: Ending[] = [];
  const links: Link[] = [];
  const lineMeta = new Map<string, LineMeta>();
  const godRows: { file: string; row: Row }[] = [];
  const arcs: AllyArc[] = [];

  for (const file of files) {
    const tribal = tribalFile(file);
    for (const t of tables(file)) {
      const h = t.headings;
      const last = h[h.length - 1] ?? '';
      if (t.header[0] === 'โหนด' && t.header.length === 7) {
        const kind: NodeKind = /สำรอง/.test(h.join(' ')) ? 'fallback' : tribal ? 'main' : 'overlay';
        for (const r of t.rows) {
          const n = nodeFromRow(r, { file, kind, section: h.slice(1).join(' > '), ids });
          if (!n) continue;
          nodes.push(n);
          let lm = lineMeta.get(n.line);
          if (!lm) {
            lm = { id: n.line, name: lineNameFrom(file, n.line, h), file: rel(file), nodeIds: [] };
            lineMeta.set(n.line, lm);
          }
          lm.nodeIds.push(n.id);
        }
      } else if (t.header[0] === 'โหนด' && t.header[1] === 'การแทรกแซง') {
        for (const r of t.rows) godRows.push({ file, row: r });
      } else if (t.header[0] === 'ปลายทาง') {
        const line = (tribal ? fileLines(file).find((l) => l.startsWith('# '))?.match(/\(([a-z]{2})\)/)?.[1] : null) ?? basenameLine(file);
        for (const r of t.rows) endings.push(endingFrom(file, line, r, ids));
      } else if (t.header[0] === 'จาก' && t.header[1] === 'ไป') {
        for (const r of t.rows) links.push(linkFrom(file, r, ids));
      } else if (tribal && /^3\./.test(h[1] ?? '') && !/^NPC$/.test(t.header[0])) {
        const rite = riteFrom(file, t, ids);
        if (rite) rites.push(rite);
      } else if (t.header[0] === 'เส้น' && t.header[2] === 'เปิดเมื่อ') {
        for (const r of t.rows) {
          const [id, name, openRaw] = r.cells;
          const open = parseConditionX(openRaw, ids, true) ?? undefined;
          const lm: LineMeta = lineMeta.get(id) ?? { id, name, file: rel(file), nodeIds: [] };
          lm.name = name;
          lm.openRaw = openRaw;
          if (open) lm.open = open;
          lineMeta.set(id, lm);
        }
      }
    }
    if (/\/28-/.test(file)) arcs.push(...allyArcs(file, 'first10', ids));
    if (/\/29-/.test(file)) arcs.push(...allyArcs(file, 'flagship', ids));
  }

  // god windows go onto the node they name
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const { file, row } of godRows) {
    const [id, what, effect] = row.cells;
    const n = byId.get(id);
    if (!n) {
      unparsed.add(file, row.line, id, 'god window names a node that is not in any node table');
      continue;
    }
    n.godWindow = n.godWindow ? { what: `${n.godWindow.what} / ${what}`, effect: `${n.godWindow.effect} / ${effect}` } : { what, effect };
  }

  // the tribal rite node: choices are the rite outcomes' keys, so say which rite
  for (const r of rites) {
    const n = byId.get(r.id);
    if (n && !n.rite) n.rite = r.id;
  }

  const data: StorylinesData = {
    nodes,
    rites,
    endings,
    links,
    lines: [...lineMeta.values()],
    allyArcs: arcs,
  };
  const conv = convergence(ids);
  const sources = [...files, `${DIR}/00-convergence.md`];
  writeGen('storylines', data, files, BY);
  writeGen('convergence', conv, [`${DIR}/00-convergence.md`], BY);
  void sources;
  unparsed.write();
  return { group: GROUP, files: ['storylines.json', 'convergence.json'], unparsed: unparsed.count, strict: false };
}

function basenameLine(file: string): string {
  return file.split('/').pop()!.replace(/^\d+-/, '').replace(/\.md$/, '');
}
