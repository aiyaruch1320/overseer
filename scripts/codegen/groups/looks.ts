// Looks generator (code-plan §5.1 row "รูปลักษณ์", §9.2): what the pixel painter needs for every race (21, with their sub-lines),
// every NPC (the rows of docs/appearance/npcs) and every ally successor (docs/appearance/19-ally-successors.md). The words of
// the docs are mapped to the painter's part ids by scripts/codegen/lib/look-words.ts. Words no table knows go to
// data/gen/_unparsed/looks.md; every person still gets a complete Look (the defaults of look-words.ts, then the id's hash).
// Writes data/gen/looks.json.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Body } from '../../../src/art/look';
import type { LineOverrides, LooksData, NpcLookRow, PersonLookRow, RaceLine, RaceLookRow, SuccessorLookRow } from '../../../src/core/data/types-looks';
import type { NpcRow } from '../../../src/core/data/types-npcs';
import type { Successor } from '../../../src/core/data/types-bonds';
import {
  BEARD_START, DEFAULT_EYE, DEFAULT_HAIR, ELDER_HAIR, GARMENT_TOKEN, HAIR_START, garmentPhrases, HEX, LINE_MATCH, LINE_OVERRIDES, NO_BEARD, RACE_BY_WORD, RACE_EYE,
  SPIRIT, SPIRIT_SKIN, beardOf, clauseOf, colourIn, earsOf, eyeColourOf, featsOf, femOf, gaitOf, hairColourOf, hairStyleOf, hatOf, lowerOf,
  mix, nearest, outfitFromGarments, hatOfRace, dressColours, RACE_TOOL_RULES, pickBy, pickSkin, skinColourOf, skinHint, stageFromDescription, stageWord, toolOf, wearOf,
} from '../lib/look-words';
import { genDir, listDocs, readDoc, tables, Unparsed, writeGen } from '../lib/table';
import { stageOf } from '../../../src/art/look';
import type { Stage } from '../../../src/art/look';

const RACES_DOC = 'docs/appearance/02-races.md';
const LORE_RACES = 'docs/lore/races/README.md';
const SUCC_DOC = 'docs/appearance/19-ally-successors.md';
const GEN = 'scripts/codegen/groups/looks.ts';
const un = new Unparsed('looks');
const fail = (m: string): never => { throw new Error('looks: ' + m); };
const genJson = <T>(name: string): T => JSON.parse(readFileSync(path.join(genDir, `${name}.json`), 'utf8')).items as T;

interface RaceBase { id: string; n: number; name: string; storyPrefix: string; worldYearsPerLifeYear: number }

// ---------- races ----------

function raceUi(file: string, races: RaceBase[]): Record<string, RaceLookRow> {
  const lines = readDoc(file).split('\n');
  const out: Record<string, RaceLookRow> = {};
  let cur: RaceBase | null = null;
  let prose = '';
  lines.forEach((l, i) => {
    const h = l.match(/^## (\d+)\. (.+)$/);
    if (h) {
      prose = '';
      cur = races.find((r) => r.n === Number(h[1])) ?? fail(`race ${h[1]} not in races.json`);
      if (cur.name !== h[2].trim()) fail(`${file}:${i + 1} heading ${h[2]} is not ${cur.name}`);
      return;
    }
    if (l.startsWith('**ร่าง**')) prose = l;
    if (!l.startsWith('**ค่า UI**') || !cur) return;
    const num = (k: string) => Number(l.match(new RegExp(`${k} ([\\d.]+)×`))?.[1] ?? fail(`${file}:${i + 1} no ${k}`));
    const word = (k: string) => l.match(new RegExp(`${k} (.+?) ·`))?.[1] ?? fail(`${file}:${i + 1} no ${k}`);
    const hexes = (k: string) => (l.match(new RegExp(`${k} ((?:#[0-9a-fA-F]{6} ?)+)`))?.[1] ?? fail(`${file}:${i + 1} no ${k}`)).trim().split(/\s+/);
    const featCell = l.split('ลักษณะที่วาดเพิ่ม')[1] ?? fail(`${file}:${i + 1} no feats`);
    const feats = [...featCell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const body: Body = {
      scale: num('ขนาด'), head: num('หัว'), shoulders: num('ไหล่'),
      ears: earsOf(word('หู')) ?? fail(`${file}:${i + 1} ears ${word('หู')}`),
      lower: lowerOf(word('ท่อนล่าง')) ?? fail(`${file}:${i + 1} lower ${word('ท่อนล่าง')}`),
      gait: gaitOf(word('ท่าเดิน')) ?? fail(`${file}:${i + 1} gait ${word('ท่าเดิน')}`),
    };
    // what the race wears when the docs give no more (the เครื่องแต่ง and หน้าและผิว cells of the race): clothes, hat, colours, hair, a thing carried by habit
    const dress = prose.match(/\*\*เครื่องแต่ง\*\* (.*?) \*\*ท่วงท่า\*\*/)?.[1] ?? '';
    const face = prose.match(/\*\*หน้าและผิว\*\* (.*?) \*\*เครื่องแต่ง\*\*/)?.[1] ?? '';
    const gel = feats.includes('gel'), hairless = feats.includes('hairless');
    const beard = NO_BEARD.test(face) || hairless ? '' : beardOf(clauseOf(face, BEARD_START)) ?? '';
    // hair: the words about the head with the beard left out; what follows "ผู้หญิง" is about the women
    const head = `${face} ${dress}`.replace(/(?:หนวด|เครา)\S*/g, '');
    const menText = head.split('ผู้หญิง')[0], womenText = head.split('ผู้หญิง')[1] ?? '';
    const hairOf = (t: string) => { const c = clauseOf(t, HAIR_START); return c ? hairStyleOf(c) ?? '' : ''; };
    const hairCol = (t: string) => { const c = clauseOf(t, HAIR_START); return c ? hairColourOf(c) ?? '' : ''; };
    const [main, second] = dressColours(dress);
    const acc = hexes('สีประจำเผ่า');
    out[cur.id] = {
      id: cur.id, name: cur.name, body, skins: hexes('สีผิว'), accents: acc, feats,
      outfit: gel ? '' : outfitFromGarments(dress) ?? '', beard, hat: gel ? '' : hatOfRace(dress) ?? '',
      hair: hairless || gel ? '' : hairOf(menText), hairFem: hairless || gel ? '' : hairOf(womenText) || hairOf(menText), hairColor: hairless || gel ? '' : hairCol(menText),
      main: main ?? mix(acc[1] ?? acc[0], '#5a5a5a', 0.5), second: second ?? (main ? mix(main, '#000000', 0.35) : mix(acc[2] ?? acc[0], '#3a3a3a', 0.4)),
      tool: gel ? '' : RACE_TOOL_RULES.find(([, re]) => re.test(dress))?.[0] ?? '', lines: [], src: `${file}:${i + 1}`,
    };
  });
  for (const r of races) if (!out[r.id]) fail(`no ค่า UI for ${r.id} in ${file}`);
  return out;
}

const stripName = (s: string) => s.replace(/\([^)]*\)/g, '').trim();
const core = (s: string) => s.replace(/^เผ่า/, '');

/** Sub-lines from docs/lore/races/README.md: the table "สายเลือดย่อยที่ไม่นับเป็นเผ่าแยก" and the rows of "การจับคู่ชื่อเผ่า" that say a name is a line of a race. */
function loreLines(races: RaceBase[], ui: Record<string, RaceLookRow>): void {
  const byName = [...races].sort((a, b) => b.name.length - a.name.length);
  const raceNamed = (s: string) => byName.find((r) => s.startsWith(r.name));
  const add = (r: RaceBase, name: string) => {
    const L = ui[r.id].lines;
    if (!name || L.some((x) => core(x.name) === core(name))) return;
    L.push({ name, overrides: {} });
  };
  for (const t of tables(LORE_RACES)) {
    if (t.header[0] === 'เผ่าหลัก') {
      for (const row of t.rows) {
        const r = byName.find((x) => x.name === row.cells[0].trim()) ?? fail(`${LORE_RACES}:${row.line} race ${row.cells[0]}`);
        for (const n of row.cells[1].split(/[,，]/)) add(r, n.trim());
      }
    } else if (t.header[0].startsWith('ชื่อในไฟล์ประเทศ')) {
      for (const row of t.rows) {
        const m = row.cells[1].match(/^สาย(?:เลือดย่อย|เพลิง)?ของ(.+)$/);
        const r = m && raceNamed(m[1].trim());
        if (!r) continue;
        for (const n of stripName(row.cells[0]).split(/\s+/)) add(r, n);
      }
    }
  }
  // the fae sub-lines sit under "ภูตพราย" in the country table; the sub-lines of 02-races.md that the lore table does not list
  for (const r of races) for (const l of ui[r.id].lines) l.overrides = LINE_OVERRIDES[`${r.id}/${l.name}`]?.(ui[r.id].feats) ?? {};
}

/** The line of a race text (`อาเวียนปีกเกล็ด` → ปีกเกล็ด), or undefined. */
function lineOf(race: RaceLookRow, text: string): RaceLine | undefined {
  const custom = LINE_MATCH[race.id] ?? {};
  const hits = race.lines.filter((l) => (custom[l.name] ?? new RegExp(core(l.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).test(text));
  return hits.sort((a, b) => b.name.length - a.name.length)[0];
}

function raceOf(races: Record<string, RaceLookRow>, text: string, peopleId: string | null, prefixes: Map<string, string>): string {
  const byPeople = peopleId ? prefixes.get(peopleId) : undefined;
  if (byPeople) return byPeople;
  for (const r of Object.values(races)) if (text.includes(r.name) && !r.lines.length) return r.id;
  for (const r of Object.values(races)) if (lineOf(r, text) && r.lines.length) return r.id;
  for (const [id, re] of RACE_BY_WORD) if (re.test(text)) return id;
  return 'human';
}

// ---------- one person ----------

interface Source {
  id: string;
  name: string;
  role: string;
  raceText: string;
  stage: Stage;
  desc: string;
  items: string[];
  pose: string;
  main: string | null;
  second: string | null;
  race: string;
  file: string;
  line: number;
  /** extra text the docs give (the oddity of a successor) */
  extra?: string;
}

function personLook(s: Source, races: Record<string, RaceLookRow>): PersonLookRow {
  const R = races[s.race];
  const ln = lineOf(R, s.raceText);
  const desc = s.desc;
  const text = `${desc} ${s.extra ?? ''}`;
  const miss = (what: string, w: string) => un.add(s.file, s.line, `${s.id} ${w}`, what);
  const fem = femOf(desc, s.name, s.role);
  // the fields the docs said nothing of, filled from the defaults (check:looks lists the people who have too many of them)
  const defaults: string[] = [];

  // outfit
  let outfit: string | null = outfitFromGarments(text);
  if (!outfit) {
    defaults.push('outfit');
    outfit = 'tunic';
    const g = garmentPhrases(text).find((t) => GARMENT_TOKEN.test(t));
    if (g) miss('ชุด', g.slice(0, 16));
  }
  // hair
  const hairTok = clauseOf(text, HAIR_START);
  const hairless = R.feats.includes('hairless');
  const hairHit = hairTok ? hairStyleOf(hairTok) : null;
  const hair = hairless ? '' : hairHit || (fem ? 'long' : 'short');
  if (!hairless && !hairHit) defaults.push('hair');
  let hairColor = hairColourOf(hairTok);
  if (!hairColor && /ผมสี/.test(hairTok)) miss('สีผม', hairTok.slice(0, 14));
  if (!hairless && !hairColor && !ln?.overrides.hairColor) defaults.push('hairColor');
  hairColor = hairColor ?? ln?.overrides.hairColor ?? (s.stage === 'elder' ? ELDER_HAIR : DEFAULT_HAIR);
  // beard (not for women, not for the hairless)
  // a race with a beard of its own (the dwarves) gives it to a man whose description says nothing of one
  const beard = fem === true || hairless ? '' : beardOf(clauseOf(text, BEARD_START)) ?? (NO_BEARD.test(text) ? '' : R.beard);
  // hat
  const hat = hatOf(text) ?? '';
  // eyes
  const eyeHit = eyeColourOf(desc);
  if (!eyeHit && /ตาสี/.test(desc)) miss('สีตา', (desc.match(/ตาสี[ก-๙]{0,6}/) ?? [''])[0]);
  if (!eyeHit && !ln?.overrides.eye && !RACE_EYE[s.race]) defaults.push('eye');
  const eye = eyeHit ?? ln?.overrides.eye ?? RACE_EYE[s.race] ?? DEFAULT_EYE;
  // skin
  const hint = skinHint(desc);
  let skin: string;
  const spirit = SPIRIT.test(s.raceText);
  if (spirit) skin = colourIn(desc.split('โปร่งแสง')[1]?.slice(0, 14) ?? '') ?? SPIRIT_SKIN;
  else if (hint) skin = pickSkin(R.skins, hint, s.id);
  else {
    const sc = skinColourOf(desc);
    if (!sc && !ln?.overrides.skin) defaults.push('skin');
    skin = sc ? nearest(R.skins, sc) : ln?.overrides.skin ?? pickSkin(R.skins, null, s.id);
  }
  // tool
  const tp = toolOf(s.items, desc);
  for (const m of tp.miss) miss('ของ', m);
  // colours
  if (!s.main) defaults.push('main');
  if (!s.second) defaults.push('second');
  const main = s.main ?? mix(pickBy(R.accents, s.id + 'm'), '#5a5a5a', 0.5);
  const second = s.second ?? mix(pickBy(R.accents, s.id + 's'), '#3a3a3a', 0.4);

  const row: PersonLookRow = {
    name: s.name, race: s.race, ...(ln ? { line: ln.name } : {}), stage: s.stage, fem, skin, hairColor, eye, main, second, outfit,
    hair, beard, hat, tool: tp.tool ?? '', feats: [...(spirit ? ['ghost'] : []), ...featsOf(text, s.items)], wear: wearOf(text), defaults, items: s.items, pose: s.pose,
  };
  return row;
}

// ---------- NPC rows ----------

const NPC_FILE = /^\d\d-.*\.md$/;

function npcSources(races: Record<string, RaceLookRow>, npcs: Map<string, NpcRow>, prefixes: Map<string, string>): { src: Source; row: NpcRow }[] {
  const out: { src: Source; row: NpcRow }[] = [];
  for (const file of listDocs('docs/appearance/npcs', NPC_FILE)) {
    for (const t of tables(file)) {
      if (t.header[0] !== 'ID') continue;
      for (const r of t.rows) {
        const [id, nameRole, rav, desc, ui] = r.cells;
        const row = npcs.get(id) ?? fail(`${file}:${r.line} ${id} is not in npcs.json`);
        const nm = nameRole.match(/^\*\*(.+?)\*\*\s*(.*)$/);
        const parts = rav.split(' · ');
        const uiM = ui.match(/^สี (#[0-9a-fA-F]{6}) (#[0-9a-fA-F]{6}) · ของ (.*?) · ท่า (.*)$/);
        if (!uiM || !HEX.test(uiM[1]) || !HEX.test(uiM[2])) fail(`${file}:${r.line} ${id}: bad ค่า UI cell "${ui}"`);
        const items = uiM![3].split(/\s*และ\s*|\s*,\s*/).filter(Boolean);
        const raceText = parts[0].trim();
        const race = raceOf(races, raceText, row.peopleId, prefixes);
        const stage = stageWord(parts[parts.length - 1]) ?? stageFromDescription(desc);
        out.push({
          row,
          src: {
            id, name: nm ? nm[1] : nameRole, role: nm ? nm[2] : '', raceText, stage, desc, items, pose: uiM![4],
            main: uiM![1].toLowerCase(), second: uiM![2].toLowerCase(), race, file, line: r.line,
          },
        });
      }
    }
  }
  return out;
}

// ---------- successors ----------

function successorSources(races: Record<string, RaceLookRow>, succ: Successor[], npcLooks: Record<string, NpcLookRow>, prefixes: Map<string, string>, life: Map<string, number>) {
  const t = tables(SUCC_DOC).find((x) => x.header[0] === 'รหัส') ?? fail(`${SUCC_DOC}: no table of successors`);
  const out: { src: Source; s: Successor }[] = [];
  const byCode = new Map(succ.map((s) => [s.code, s]));
  for (const r of t.rows) {
    const [code, name, seen, oddity] = r.cells;
    const s = byCode.get(code) ?? fail(`${SUCC_DOC}:${r.line} ${code} is not in bonds.json`);
    const race = raceOf(races, s.race, null, prefixes);
    const stage = s.age == null ? 'adult' : stageOf(s.age / (life.get(race) ?? 1));
    const proto = npcLooks[s.proto];
    const raceAcc = races[race].accents;
    // the colours of the original, the main one blended toward the race's accent so the heir reads as the next in the line
    const main = proto ? mix(proto.main, pickBy(raceAcc, code), 0.3) : null;
    out.push({
      s,
      src: { id: code, name, role: '', raceText: s.race, stage, desc: seen, items: [], pose: '', main, second: proto?.second ?? null, race, file: SUCC_DOC, line: r.line, extra: oddity },
    });
  }
  return out;
}

/** Reads npcs.json, races.json and bonds.json of this run (run-all orders the groups by it). */
export const after = ['npcs', 'character', 'bonds'];

export default function run() {
  const races = genJson<{ races: RaceBase[] }>('races').races;
  const ui = raceUi(RACES_DOC, races);
  loreLines(races, ui);
  const prefixes = new Map(races.map((r) => [r.storyPrefix, r.id]));
  const life = new Map(races.map((r) => [r.id, r.worldYearsPerLifeYear]));

  const npcRows = genJson<{ npcs: NpcRow[] }>('npcs').npcs;
  const npcById = new Map(npcRows.map((n) => [n.id, n]));
  const npcs: Record<string, NpcLookRow> = {};
  for (const { src, row } of npcSources(ui, npcById, prefixes)) {
    npcs[src.id] = {
      ...personLook(src, ui),
      file: path.basename(src.file, '.md'), country: row.country, continent: row.continent, age: row.age,
    };
  }
  for (const n of npcRows) if (!npcs[n.id]) fail(`${n.id} has no row in docs/appearance/npcs`);

  const succList = genJson<{ successors: { list: Successor[] } }>('bonds').successors.list;
  const successors: Record<string, SuccessorLookRow> = {};
  for (const { src, s } of successorSources(ui, succList, npcs, prefixes, life)) {
    successors[src.id] = { ...personLook(src, ui), of: s.proto, age: s.age, seen: src.desc, oddity: src.extra ?? '' };
  }

  const counts = { races: Object.keys(ui).length, lines: Object.values(ui).reduce((n, r) => n + r.lines.length, 0), npcs: Object.keys(npcs).length, successors: Object.keys(successors).length, unmatched: un.count };
  const data: LooksData = { counts, races: ui, npcs, successors };
  const sources = [RACES_DOC, LORE_RACES, SUCC_DOC, ...listDocs('docs/appearance/npcs', NPC_FILE), 'data/gen/npcs.json', 'data/gen/races.json', 'data/gen/bonds.json'];
  writeGen('looks', data, sources, GEN);
  un.write();
  return { group: 'looks', files: ['looks.json'], unparsed: un.count, strict: false };
}
