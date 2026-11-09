// Scenes generator (code-plan §5.1 row "รูปลักษณ์", §8.3): reads the appearance docs of the scenes into scripts of beats and event cards.
//   docs/appearance/12-event-visuals.md      194 world event cards, the four display forms, the colours of the frame by category
//   docs/appearance/11-world-changes.md      the day of the event (five beats) of 8 transformed continents + 3 big events, 15 dragons falling, 3 ends
//   docs/appearance/13-storyline-scenes.md   21 rites, 21 destinations, 9 other storylines
//   docs/appearance/15-npc-clash-scenes.md   102 NPC clashes (narration + result variants) and the standard closings
//   docs/appearance/16-ally-scenes.md        13 bn/kn nodes, 2 scenes of each flagship ally, 8 kin and 12 friend templates
//   docs/appearance/17-local-event-visuals.md 76 hand-written local events (L become scripts, C stay cards) + 6 templates
//   docs/appearance/18-last-era-scenes.md    12 LE events, 10 le nodes, 54 newcomers (NT)
//   docs/appearance/20-god-ui.md §7.3        the day of a miracle (16 rows)
// Writes data/gen/scenes.json (shape: src/core/data/types-scenes.ts). The scripts are played by src/scene/ and chosen by src/app/views/scene.ts.
// The 13-storyline-scenes table is keyed by the race name: the codes of the race lines come from data/gen/storylines.json.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Beat, CardDef, Pose, EventForm, FrameDef, SceneScript, SceneVariant, ScenesData } from '../../../src/core/data/types-scenes';
import { clausesOf, composeShort, composeStaged, fxOf, groupClauses, hexes, lightOf, castOf, plain, skyOf, splitSound, variantOf, mix, lineBeats, clean } from '../lib/scene-compose';
import type { Stage } from '../lib/scene-compose';
import { genDir, readDoc, tables, writeGen } from '../lib/table';
import type { Table } from '../lib/table';
import { Unparsed } from '../lib/table';

const D = 'docs/appearance/';
const F12 = D + '12-event-visuals.md';
const F11 = D + '11-world-changes.md';
const F13 = D + '13-storyline-scenes.md';
const F15 = D + '15-npc-clash-scenes.md';
const F16 = D + '16-ally-scenes.md';
const F17 = D + '17-local-event-visuals.md';
const F18 = D + '18-last-era-scenes.md';
const F20 = D + '20-god-ui.md';
const GEN = 'scripts/codegen/groups/scenes.ts';

/** This group reads the events (the home of a world event) and the storylines (the code of a race line) written by other groups. */
export const after = ['events', 'storylines'];

const at = (t: Table, line: number) => `${t.file}:${line}`;

export default function run() {
const un = new Unparsed('scenes');

// ---------- 12: frames, forms ----------

const FORM: Record<string, EventForm> = { ฉากเต็มจอ: 'X', ชั้นแผนที่: 'M', ฉากท้องถิ่น: 'L', การ์ดและเสียง: 'C' };
const T12 = tables(F12);
const frames: FrameDef[] = [];
const frameTable = T12.find((t) => t.header[0] === 'หมวด');
if (!frameTable) throw new Error('scenes: frame table of 12-event-visuals missing');
for (const r of frameTable.rows) {
  const [g, ...name] = plain(r.cells[0]).split(' ');
  const hex = hexes(r.cells[1])[0];
  if (!hex) {
    un.add(F12, r.line, r.cells[1], 'frame colour');
    continue;
  }
  frames.push({ group: g, name: name.join(' '), color: hex, icon: plain(r.cells[2]), sound: plain(r.cells[3]) });
}
const frameOf = new Map(frames.map((f) => [f.group, f]));
const formTable = T12.find((t) => t.header[0] === 'รหัส' && t.header[1] === 'รูปแบบ');
const forms = (formTable?.rows ?? []).map((r) => ({ code: r.cells[0] as EventForm, name: plain(r.cells[1]), size: plain(r.cells[2]), use: plain(r.cells[3]) }));
if (forms.length !== 4) throw new Error('scenes: the four display forms of 12-event-visuals');

// ---------- 11: the day of the event ----------

const T11 = tables(F11);
const grammarTable = T11.find((t) => t.header[0] === 'จังหวะ' && t.header[1] === 'ระยะ');
const grammar = (grammarTable?.rows ?? []).map((r) => {
  const m = r.cells[0].match(/^(\d+)\s+(.*)$/);
  const [from, to] = (r.cells[1].match(/\d+/g) ?? ['0', '0']).map(Number);
  return { n: Number(m?.[1] ?? 0), name: m?.[2] ?? r.cells[0], from, to, what: plain(r.cells[2]) };
});
if (grammar.length !== 5) throw new Error('scenes: the five beats of 11-world-changes §1.2');

const secText = readDoc(F11).split('\n');
/** The **ชุดสี** line of a section: before and after palettes (five colours each), as far as the doc gives them. */
function paletteOf(tableLine: number): { before: string[]; after: string[] } {
  // the colour line sits between the heading of the section and its table
  for (let i = tableLine - 2; i >= Math.max(0, tableLine - 14); i--) {
    const l = secText[i];
    if (l.startsWith('#')) break;
    if (l.startsWith('**ชุดสี**')) {
      const [a, b] = l.split('→');
      if (b) return { before: hexes(a).slice(0, 5), after: hexes(b).slice(0, 5) };
      return { before: [], after: hexes(l).slice(0, 5) };
    }
  }
  return { before: [], after: [] };
}

const groupOfId = (id: string) => id.replace(/-.*/, '');
const frameFor = (id: string) => frameOf.get(groupOfId(id))?.color ?? '#b8b39a';

const scripts: SceneScript[] = [];
const byId = new Map<string, SceneScript>();
const add = (s: SceneScript) => {
  if (byId.has(s.id)) {
    un.add(s.src.split(':')[0], Number(s.src.split(':')[1] ?? 0), s.id, 'duplicate script id');
    return;
  }
  byId.set(s.id, s);
  scripts.push(s);
};

const stagesOf = (t: Table): Stage[] =>
  t.rows.map((r) => {
    const m = r.cells[0].match(/^(\d+)\s+(.*)$/);
    const [from, to] = (r.cells[1].match(/\d+/g) ?? ['0', '0']).map(Number);
    return { n: Number(m?.[1] ?? 0), name: m?.[2] ?? r.cells[0], from, to, text: plain(r.cells[2]) };
  });

/** Section number ("2.1") → the change script of its event, so the rows of 12 that say "ดู 11-world-changes 2.1" can reuse the beats. */
const bySection = new Map<string, SceneScript>();
/** palette (after colour) of a transformed continent by the event that made it (the frame of its follow-up events). */
const afterOf = new Map<string, string>();

for (const t of T11) {
  if (t.header[0] !== 'จังหวะ' || t.header[1] !== 'เวลา') continue;
  const head = t.headings[t.headings.length - 1];
  const m = head.match(/^(\d+\.\d+)\s+(.*?)\s*\(([A-Z]+-\d+)\)/);
  if (!m) {
    un.add(F11, t.line, head, 'section without an event id');
    continue;
  }
  const [, sec, name, id] = m;
  const stages = stagesOf(t);
  const pal = paletteOf(t.line);
  const frame = frameFor(id);
  const fallback = skyOf(frame);
  const sky = pal.before[0] ?? fallback.sky;
  const ground = pal.before[4] ?? fallback.ground;
  const s5 = stages.find((s) => s.n === 5)?.text ?? '';
  // "ขึ้นคำว่า X" or "ชื่ออัซการ์ถูกขีดฆ่า ขึ้นคำว่า Y": the new name is written (and the old struck when the doc says so)
  const nm = s5.match(/ขึ้นคำว่า\s+(\S+(?:\s\S+)?)/);
  const old = s5.match(/ชื่อ(\S+?)ถูกขีดฆ่า/);
  const seed = {
    id,
    kind: 'change' as const,
    title: name.replace(/\s+—.*$/, ''),
    frame,
    src: at(t, t.line),
    sky,
    ground,
    skyAfter: pal.after[0],
    groundAfter: pal.after[4],
    stages,
    strike: nm && old ? { from: old[1], to: nm[1].replace(/\s.*/, '') } : undefined,
  };
  const s = composeStaged(seed);
  bySection.set(sec, s);
  if (pal.after[1]) afterOf.set(id, pal.after[1]);
  else if (pal.after[0]) afterOf.set(id, pal.after[0]);
  add(s);
}
// 4.1 and 4.2: a paragraph of picture, no table: the five beats with the paragraph in the third
{
  const lines = secText;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^###\s+(4\.\d)\s+(.*?)\s*\(([A-Z]+-\d+)\)/);
    if (!h) continue;
    let p = '';
    for (let j = i + 1; j < lines.length && !lines[j].startsWith('#'); j++) if (lines[j].trim()) p += (p ? ' ' : '') + lines[j].trim();
    p = plain(p.replace(/^(ภาพ|ฉาก):\s*/, ''));
    const frame = frameFor(h[3]);
    const sk = skyOf(frame);
    const stages: Stage[] = grammar.map((g) => ({ n: g.n, name: g.name, from: g.from, to: g.to, text: g.n === 3 ? p : '' }));
    const s = composeStaged({ id: h[3], kind: 'change', title: h[2], frame, src: `${F11}:${i + 1}`, ...sk, stages, strike: undefined });
    bySection.set(h[1], s);
    add(s);
  }
}
// 3. fifteen dragons falling (10–15 s: the grammar without the fifth beat)
const fallTable = T11.find((t) => t.header[0] === '#' && t.header[1] === 'มังกร');
for (const r of fallTable?.rows ?? []) {
  const n = Number(r.cells[0]);
  const [name, fall, stays, world] = [r.cells[1], r.cells[2], r.cells[3], r.cells[4]].map(plain);
  const frame = frameFor('DR-00');
  const stages: Stage[] = [
    { n: 1, name: grammar[0].name, from: 0, to: 2, text: '' },
    { n: 2, name: grammar[1].name, from: 2, to: 4, text: '' },
    { n: 3, name: grammar[2].name, from: 4, to: 9, text: fall },
    { n: 4, name: grammar[3].name, from: 9, to: 13, text: `${stays} ${world}` },
  ];
  add(composeStaged({ id: `fall.${n}`, kind: 'fall', title: name, frame, src: at(fallTable!, r.line), ...skyOf(frame), stages, seconds: 13 }));
}
// 5. the three ends of the world: a final picture, colours, a final sound
const endTable = T11.find((t) => t.header[0] === 'จุดจบ');
for (const r of endTable?.rows ?? []) {
  const m = plain(r.cells[0]).match(/^(END-\d+)\s+(.*)$/);
  if (!m) continue;
  const frame = frameFor(m[1]);
  const hx = hexes(r.cells[2]);
  const sky = hx[0] ?? '#e8e8f0';
  const stages: Stage[] = [
    { n: 1, name: grammar[0].name, from: 0, to: 3, text: '' },
    { n: 3, name: 'ภาพสุดท้าย', from: 3, to: 20, text: plain(r.cells[1]) },
    { n: 4, name: grammar[3].name, from: 20, to: 28, text: plain(r.cells[2]) + ' ' + plain(r.cells[3]) },
  ];
  add(composeStaged({ id: m[1], kind: 'ending', title: m[2], frame, src: at(endTable!, r.line), sky: mix(sky, '#101018', 0.4), ground: mix(hx[1] ?? sky, '#08080c', 0.5), skyAfter: '#f4f4f8', groundAfter: '#d8d8e0', stages, seconds: 30 }));
}

// ---------- 12: the cards and the scripts of the world events ----------

/** The new continent a follow-up event belongs to: its frame is the new colours (12-event-visuals "เหตุการณ์สืบทอด"). */
const BRANCH_OF: Record<string, string> = { SF: 'DR-01', AS: 'DR-04', DW: 'DR-05', RF: 'DR-07', WT: 'BIO-02', RL: 'MC-04', CL: 'BIO-05', DV: 'FG-11' };
const BRANCH_NAME: Record<string, string> = { SF: 'สกายฟอลล์', AS: 'ทวีปเถ้า', DW: 'ทุ่งจม', RF: 'ทุ่งแยก', WT: 'ป่าเหี่ยว', RL: 'ดินแดนสนิม', CL: 'ทวีปแสง', DV: 'ดินแดนหมอกกลืน' };
for (const [g, ev] of Object.entries(BRANCH_OF)) {
  const c = afterOf.get(ev);
  if (c && !frameOf.has(g)) {
    const f: FrameDef = { group: g, name: BRANCH_NAME[g], color: c, icon: '', sound: '' };
    frames.push(f);
    frameOf.set(g, f);
  }
}

const cards: CardDef[] = [];
const cardIds = new Set<string>();
const SECTION_REF = /ดู\s*11-world-changes\s*(?:หัวข้อ\s*)?(\d+(?:\.\d+)?)/;
/** A pointer to another document ("ดูฉากเต็มใน 11-world-changes.md 2.1", "ดูหลักการเดียวกับ 11-world-changes 2.3", "ดู 11-world-changes หัวข้อ 3") is for the writer of the doc, not the player. */
const DOC_REF = /ดู(?:ฉากเต็ม)?(?:ใน|หลักการเดียวกับ)?\s*\d\d-[a-z0-9-]+(?:\.md)?(?:\s*หัวข้อ)?(?:\s*\d+(?:\.\d+)?)?/g;
const CODE_REF = /ตามรหัส\s+[a-z][a-z0-9_]*\s+ใน\s*\d\d-[a-z0-9-]+(?:\.md)?/g;
const stripDocRefs = (t: string): string => t.replace(CODE_REF, ' ').replace(DOC_REF, ' ').replace(/\s{2,}/g, ' ').trim();

function addCard(c: CardDef) {
  if (cardIds.has(c.id)) {
    un.add(c.src.split(':')[0], Number(c.src.split(':')[1]), c.id, 'duplicate card id');
    return;
  }
  cardIds.add(c.id);
  cards.push(c);
}

for (const t of T12) {
  if (t.header[0] !== 'ID · ชื่อ' || t.header[1] !== 'รูปแบบ') continue;
  for (const r of t.rows) {
    const m = r.cells[0].match(/^\*\*([A-Z]+-\d+)\*\*\s*(⭐|●|○)?\s*(.*)$/);
    const form = FORM[plain(r.cells[1])];
    if (!m || !form) {
      un.add(F12, r.line, r.cells[0], 'row of the world events');
      continue;
    }
    const [, id, mark = '', name] = m;
    const g = groupOfId(id);
    const fr = frameOf.get(g);
    if (!fr) {
      un.add(F12, r.line, id, 'no frame colour for the category');
      continue;
    }
    const picture = plain(r.cells[2]);
    const mine = byId.get(id);
    let hasScript = false;
    if (form === 'X') {
      const ref = picture.match(SECTION_REF);
      let s = mine;
      if (!s && ref && bySection.has(ref[1])) {
        // the same five beats as the section it points to, under this event's name, with the row's own words after the pointer
        const base = bySection.get(ref[1])!;
        const own = plain(picture.replace(SECTION_REF, '').replace(/^\S+\s*/, (w) => (/^(ว|ของ)/.test(w) ? '' : w)));
        s = JSON.parse(JSON.stringify(base)) as SceneScript;
        s.id = id;
        s.title = plain(name);
        s.frame = fr.color;
        s.src = at(t, r.line);
        if (own) s.beats = clean([...s.beats, ...lineBeats(groupClauses(own, 2), base.seconds * 0.55, base.seconds * 0.85)]);
        add(s);
      } else if (!s) {
        const stages: Stage[] = grammar.map((gm) => ({ n: gm.n, name: gm.name, from: gm.from, to: gm.to, text: gm.n === 3 ? picture : '' }));
        stages.find((x) => x.n === 5)!.text = '';
        add(composeStaged({ id, kind: 'world', title: plain(name), frame: fr.color, src: at(t, r.line), ...skyOf(fr.color), stages }));
      }
      hasScript = true;
    } else if (form === 'L') {
      const { image, sound } = splitSound(picture);
      add(
        composeShort({
          id,
          kind: 'world',
          title: plain(name),
          frame: fr.color,
          src: at(t, r.line),
          ...skyOf(fr.color),
          place: clausesOf(image)[0] ?? plain(name),
          seconds: 10,
          lines: groupClauses(image, 3),
          sounds: [fr.sound, sound].filter(Boolean),
          fx: fxOf(picture),
          cast: castOf(picture, 'ผู้คน'),
          light: lightOf(picture),
        }),
      );
      hasScript = true;
    }
    addCard({ id, name: plain(name), mark: mark as CardDef['mark'], group: g, form, frame: fr.color, icon: fr.icon, sound: fr.sound, picture: stripDocRefs(picture), fx: fxOf(picture), sky: skyOf(fr.color).sky, script: hasScript, src: at(t, r.line) });
  }
}
// events that 11 makes into change scripts but whose rows are cards (DR-15 points to 11 §3 but is a card)
const nWorld = cards.length;

// ---------- 17: local events ----------

const continents: { id: string; name: string; color: string }[] = [];
const T17 = tables(F17);
const contT = T17.find((t) => t.header[0] === 'ทวีป');
for (const r of contT?.rows ?? []) {
  for (const k of [0, 2]) {
    const m = r.cells[k]?.match(/^(.*?)\s*\(([A-Z]{2})\)/);
    const hex = hexes(r.cells[k + 1] ?? '')[0];
    if (m && hex) continents.push({ id: m[2], name: m[1], color: hex });
  }
}
const contByName = new Map(continents.map((c) => [c.name, c]));
const localT = T17.find((t) => t.header[0] === 'ID · ชื่อ');
const localContinent = new Map<string, string>();
for (const r of localT?.rows ?? []) {
  const m = r.cells[0].match(/^\*\*(LC-\d+)\s+(.*?)\*\*$/);
  const parts = plain(r.cells[3]).split(/\s+·\s+/);
  const form = parts[0] as EventForm;
  if (!m || !['L', 'C'].includes(form)) {
    un.add(F17, r.line, r.cells[0], 'local event row');
    continue;
  }
  const odd = parts.find((p) => p.startsWith('ผิดปกติ:'))?.replace(/^ผิดปกติ:\s*/, '') ?? '';
  const snd = parts.find((p, i) => i > 0 && p.startsWith('เสียง')) ?? '';
  const pic = parts.slice(1).filter((p) => p !== snd && !p.startsWith('ผิดปกติ:')).join(' · ');
  const fr = frameOf.get(r.cells[2]) ?? frameOf.get('HP')!;
  const id = m[1];
  const cont = contByName.get(r.cells[1]);
  if (cont) localContinent.set(id, cont.id);
  let hasScript = false;
  if (form === 'L') {
    add(
      composeShort({
        id,
        kind: 'local',
        title: plain(m[2]),
        frame: fr.color,
        src: at(localT!, r.line),
        ...skyOf(cont ? mix(fr.color, cont.color, 0.4) : fr.color),
        place: clausesOf(pic)[0] ?? m[2],
        seconds: 10,
        lines: [...groupClauses(pic, 2), ...(odd ? [odd] : [])],
        sounds: [fr.sound, snd].filter(Boolean),
        fx: fxOf(pic),
        cast: castOf(pic, 'ผู้คน'),
        light: lightOf(pic),
        hold: /ผลถาวร/.test(odd),
      }),
    );
    hasScript = true;
  }
  addCard({ id, name: plain(m[2]), mark: '', group: r.cells[2], form, frame: fr.color, icon: fr.icon, sound: snd || fr.sound, picture: stripDocRefs([pic, odd].filter(Boolean).join(' ')), fx: fxOf(pic), sky: skyOf(fr.color).sky, script: hasScript, src: at(localT!, r.line) });
}
const tmplT = T17.find((t) => t.header[0] === 'แม่แบบ' && t.header[4] === 'รูปแบบ');
for (const r of tmplT?.rows ?? []) {
  const m = plain(r.cells[0]).match(/^(LT-\d)\s+(.*)$/);
  if (!m) {
    un.add(F17, r.line, r.cells[0], 'template row');
    continue;
  }
  const pic = plain(r.cells[1]);
  const fr = frameOf.get('HP')!;
  add(composeShort({ id: m[1], kind: 'local', title: m[2], frame: fr.color, src: at(tmplT!, r.line), ...skyOf(fr.color), place: clausesOf(pic)[0], seconds: 9, lines: [...groupClauses(pic, 2), plain(r.cells[3])], sounds: [plain(r.cells[2])], fx: fxOf(pic), cast: castOf(pic, 'ผู้คน'), light: lightOf(pic) }));
}

// ---------- 18: the last era ----------

const LAST = '#b8b39a';
const T18 = tables(F18);
const lastScene = (t: Table, r: { cells: string[]; line: number }, id: string, title: string, kind: SceneScript['kind'], seconds: number, still: boolean) => {
  const [see, snd, smell, touch, odd] = r.cells.slice(1, 6).map(plain);
  const pic = see.replace(/^การ์ดนิ่ง:\s*/, '');
  const sk = { sky: LAST, ground: mix(LAST, '#0a0a0a', 0.7) };
  const s = composeShort({
    id,
    kind,
    title,
    frame: LAST,
    src: at(t, r.line),
    ...sk,
    place: clausesOf(pic)[0],
    seconds,
    lines: [...groupClauses(pic, 2), `กลิ่น ${smell}`, `สัมผัส ${touch}`, odd],
    sounds: [snd],
    fx: fxOf(pic, 1),
    cast: still ? [] : castOf(pic, 'ตัวละคร'),
    light: lightOf(pic, 'dim'),
    camera: still ? 'high' : 'eye',
  });
  add(s);
  return pic;
};
for (const t of T18) {
  const h = t.header[0];
  if (h === 'รหัส') {
    for (const r of t.rows) {
      const id = plain(r.cells[0]).split(' ')[0];
      const title = plain(r.cells[0]).replace(/^\S+\s*/, '');
      const still = /^การ์ดนิ่ง/.test(r.cells[1]);
      const pic = lastScene(t, r, id, title, 'lastEra', still ? 6 : 10, still);
      addCard({ id, name: title, mark: '', group: 'LE', form: still ? 'C' : 'L', frame: LAST, icon: '', sound: plain(r.cells[2]), picture: stripDocRefs(pic), fx: fxOf(pic, 1), sky: LAST, script: true, src: at(t, r.line) });
    }
  } else if (h === 'โหนด') {
    for (const r of t.rows) lastScene(t, r, plain(r.cells[0]), plain(r.cells[0]), 'node', 7, false);
  } else if (h === 'แม่แบบ') {
    for (const r of t.rows) {
      const m = plain(r.cells[0]).match(/^(NT-\d+)\s+(.*)$/);
      if (!m) {
        un.add(F18, r.line, r.cells[0], 'newcomer row');
        continue;
      }
      lastScene(t, r, m[1], m[2], 'lastEra', 7, false);
    }
  }
}

// ---------- 13: rites and destinations ----------

const stories = JSON.parse(readFileSync(path.join(genDir, 'storylines.json'), 'utf8')) as { items: { lines: { id: string; name: string; file: string }[] } };
const lineOfName = new Map(stories.items.lines.map((l) => [l.name, l.id]));
const T13 = tables(F13);
const PASS = '#e8c36a';
const FAIL = '#5a6a8a';
const REGIONS = ['ทุ่งราบ', 'หมอก', 'ทราย', 'เรือ', 'ชาวพื้น'];
const riteT = T13.find((t) => t.header[1] === 'พิธี');
for (const r of riteT?.rows ?? []) {
  const race = plain(r.cells[0]);
  const line = lineOfName.get(race);
  if (!line) {
    un.add(F13, r.line, race, 'race without a storyline');
    continue;
  }
  const rite = plain(r.cells[1]);
  const [scene, pass, fail] = [r.cells[2], r.cells[3], r.cells[4]].map(plain);
  const base = skyOf(PASS);
  const variants: Record<string, SceneVariant> = {
    pass: variantOf(6, pass, { light: 'warm-front', actors: [{ id: 'a', pose: 'raise', x: 0.5 }], fx: ['motes'] }),
    fail: variantOf(6, fail, { light: 'cold-back', actors: [{ id: 'a', pose: 'kneel', x: 0.5 }] }),
  };
  let seconds = 12;
  let lines = groupClauses(scene, 3);
  const cast = castOf(scene, 'เด็ก');
  // a child that lies down in the script lies down on the stage
  if (/นอน(หงาย|ราบ|ลง)/.test(scene)) cast.forEach((c) => { if (c.id === 'a') c.pose = 'lie'; });
  if (line === 'hu') {
    // the human rite changes with the home: the scene of each region plays before the result
    const parts = scene.split(new RegExp(`\\s*·?\\s*(${REGIONS.join('|')}):\\s*`));
    lines = [];
    for (let i = 1; i < parts.length; i += 2) {
      const reg = parts[i];
      const text = parts[i + 1].replace(/\s*·\s*$/, '');
      const sk = skyOf(mix(PASS, '#808080', REGIONS.indexOf(reg) * 0.12));
      variants[reg] = { seconds: 8, beats: clean([{ k: 'bg', at: 0, place: `${rite} · ${reg}`, sky: sk.sky, ground: sk.ground }, ...fxOf(text, 1).map((k) => ({ k: 'fx' as const, at: 0, kind: k, amount: 0.5 })), ...lineBeats(groupClauses(text, 2), 0.6, 7.6)]) };
    }
    seconds = 4;
    lines = [parts[0]].filter(Boolean);
  }
  const s = composeShort({ id: `rite.${line}`, kind: 'rite', title: rite, frame: PASS, src: at(riteT!, r.line), ...base, place: rite, seconds, lines, fx: fxOf(scene, 1), cast: line === 'hu' ? [{ id: 'a', label: 'เด็ก', x: 0.5, pose: 'stand' }] : cast, light: 'diffuse' });
  s.variants = variants;
  add(s);
}
const destT = T13.find((t) => t.header[1] === 'ฉากร่วมของการตาย');
for (const r of destT?.rows ?? []) {
  const race = plain(r.cells[0]);
  const line = lineOfName.get(race);
  if (!line) {
    un.add(F13, r.line, race, 'race without a storyline');
    continue;
  }
  const [scene, left] = [r.cells[1], r.cells[2]].map(plain);
  const sk = skyOf('#9a9486');
  const s = composeShort({ id: `dest.${line}`, kind: 'destination', title: `ปลายทาง ${race}`, frame: '#9a9486', src: at(destT!, r.line), ...sk, place: clausesOf(scene)[0], seconds: 18, lines: groupClauses(scene, 3), fx: fxOf(scene, 1), cast: castOf(scene, 'ตัวละคร'), light: 'dim', hold: true, camera: 'eye' });
  s.beats = clean([...s.beats, { k: 'text', at: 13.5, dur: 3.5, role: 'result', text: left }]);
  add(s);
}
const lineT = T13.find((t) => t.header[0] === 'เส้น' && t.header[1].startsWith('ภาพหลัก'));
for (const r of lineT?.rows ?? []) {
  const file = r.cells[0].match(/\(([^)]*\.md)\)/)?.[1] ?? '';
  const base = path.basename(file, '.md');
  if (!base) {
    un.add(F13, r.line, r.cells[0], 'storyline link');
    continue;
  }
  const pic = plain(r.cells[1]);
  add(composeShort({ id: `line.${base}`, kind: 'line', title: plain(r.cells[0]), frame: '#b8c0cc', src: at(lineT!, r.line), ...skyOf('#b8c0cc'), place: clausesOf(pic)[0], seconds: 7, lines: groupClauses(pic, 3), fx: fxOf(pic, 1), cast: castOf(pic, 'ตัวละคร'), light: lightOf(pic) }));
}

// ---------- 15: NPC clashes ----------

const CLOSE: [RegExp, string][] = [
  [/^เจรจา/, 'talk'],
  [/^ชนะ.*(ล้ม|ถึงตาย|ตาย|สังหาร)/, 'win_kill'],
  [/^ชนะ/, 'win_spare'],
  [/^เสมอ/, 'draw'],
  [/^แพ้/, 'lose'],
  [/^หนี/, 'flee'],
];
const kindOfLabel = (label: string) => CLOSE.find(([re]) => re.test(label))?.[1] ?? 'draw';
const closing = (kind: string, text: string, npc: string): SceneVariant => {
  const A = (id: string, pose: Pose, x?: number) => ({ id, pose, x, label: id === 'a' ? 'ตัวละคร' : npc });
  switch (kind) {
    case 'win_kill':
      return variantOf(6, text, { light: 'warm-front', actors: [A('a', 'stand', 0.34), A('b', 'fall', 0.66)] });
    case 'win_spare':
      return variantOf(6, text, { light: 'warm-front', actors: [A('a', 'stand', 0.34), A('b', 'kneel', 0.66)] });
    case 'talk':
      return variantOf(6, text, { light: 'diffuse', actors: [A('a', 'stand', 0.38), A('b', 'bow', 0.62)] });
    case 'lose':
      return variantOf(6, text, { light: 'cold-back', actors: [A('a', 'fall', 0.34), A('b', 'stand', 0.66)] });
    case 'flee':
      return variantOf(6, text, { light: 'diffuse', actors: [A('a', 'walk', 0.12), A('b', 'stand', 0.66)] });
    default:
      return variantOf(6, text, { light: 'diffuse', actors: [A('a', 'stand', 0.3), A('b', 'stand', 0.7)] });
  }
};
{
  const lines = readDoc(F15).split('\n');
  const WAR = frameOf.get('WR')!.color;
  // the standard closings of §2
  const stdT = T13.length ? tables(F15).find((t) => t.header[0] === 'ผล') : undefined;
  const std: Record<string, SceneVariant> = {};
  for (const r of stdT?.rows ?? []) {
    const label = plain(r.cells[0]);
    std[label] = closing(kindOfLabel(label), plain(r.cells[1]), 'คู่ต่อสู้');
  }
  add({ id: 'std.clash', kind: 'clash', title: 'ท่าปิดมาตรฐาน', frame: WAR, seconds: 0, beats: [], variants: std, src: stdT ? at(stdT, stdT.line) : F15 });
  let cur: { id: string; name: string; line: number; story: string; outs: { label: string; text: string }[] } | null = null;
  let mode: 'none' | 'story' | 'outs' = 'none';
  const flush = () => {
    if (!cur) return;
    if (!cur.story || !cur.outs.length) un.add(F15, cur.line, cur.id, 'clash without narration or results');
    const npc = cur.name.split(' ')[0];
    const sk = skyOf(WAR);
    const body = groupClauses(cur.story, 6);
    const s = composeShort({ id: cur.id, kind: 'clash', title: cur.name, frame: WAR, src: `${F15}:${cur.line}`, ...sk, place: clausesOf(cur.story)[0] ?? cur.name, seconds: 3 + body.length * 3.4, lines: body, fx: fxOf(cur.story, 2), cast: [{ id: 'a', label: 'ตัวละคร', x: 0.34, pose: 'stand' }, { id: 'b', label: npc, x: 0.66, pose: 'stand' }], light: 'diffuse', camera: 'wide' });
    s.variants = Object.fromEntries(cur.outs.map((o) => [o.label, closing(kindOfLabel(o.label), o.text, npc)]));
    add(s);
    cur = null;
  };
  lines.forEach((l, i) => {
    const h = l.match(/^####\s+(NF-[A-Z]{2}\d+-\d+)\s+(.*?)\s*$/);
    if (h) {
      flush();
      cur = { id: h[1], name: h[2], line: i + 1, story: '', outs: [] };
      mode = 'none';
      return;
    }
    if (/^#{1,3}\s/.test(l)) {
      flush();
      mode = 'none';
      return;
    }
    if (!cur) return;
    if (l.startsWith('**เล่าศึก**')) {
      cur.story = plain(l.replace('**เล่าศึก**', ''));
      mode = 'story';
    } else if (l.startsWith('**ถ้าผลเป็น**')) mode = 'outs';
    else if (mode === 'outs' && l.startsWith('- ')) {
      const m = l.match(/^-\s+\*([^*]+)\*\s*(.*)$/);
      if (m) cur.outs.push({ label: plain(m[1]), text: plain(m[2]) });
      else un.add(F15, i + 1, l.slice(0, 60), 'result line without a label');
    } else if (mode === 'story' && l.trim() && !l.startsWith('**')) cur.story += ' ' + plain(l);
  });
  flush();
}

// ---------- 16: allies ----------

const T16 = tables(F16);
const ALLY = '#5a8ad0';
const KIN = '#8a5a3a';
for (const t of T16) {
  const h = t.header;
  if (h[0] === 'โหนด' && h[1] === 'ภาพหลัก') {
    for (const r of t.rows) {
      const id = plain(r.cells[0]);
      const pic = plain(r.cells[1]);
      const frame = id.startsWith('kn') ? KIN : ALLY;
      add(composeShort({ id, kind: 'ally', title: id, frame, src: at(t, r.line), ...skyOf(frame), place: clausesOf(pic)[0], seconds: 7, lines: groupClauses(pic, 3), fx: fxOf(pic, 1), cast: castOf(pic, 'ตัวละคร'), light: lightOf(pic), titleCard: false }));
    }
  } else if (h[0] === 'NPC' && h[1] === 'ฉากวิกฤต') {
    for (const r of t.rows) {
      const m = plain(r.cells[0]).match(/^([A-Z]{2}\d+-\d+)\s+(.*)$/);
      if (!m) {
        un.add(F16, r.line, r.cells[0], 'ally row');
        continue;
      }
      for (const [k, cell, label] of [['crisis', r.cells[1], 'วิกฤต'], ['end', r.cells[2], 'ปลายทาง']] as const) {
        const pic = plain(cell);
        add(composeShort({ id: `ally.${m[1]}.${k}`, kind: 'ally', title: `${m[2]} · ${label}`, frame: ALLY, src: at(t, r.line), ...skyOf(ALLY), place: clausesOf(pic)[0], seconds: 8, lines: groupClauses(pic, 3), fx: fxOf(pic, 1), cast: castOf(pic, 'ตัวละคร'), light: k === 'end' ? 'dim' : lightOf(pic, 'cold-back'), hold: k === 'end' }));
      }
    }
  } else if ((h[0] === 'แม่แบบ' && h[1] === 'ภาพหลัก') || (h[0] === 'แม่แบบ' && h[1] === 'ภาพหลักของขั้นวิกฤต')) {
    for (const r of t.rows) {
      const m = plain(r.cells[0]).match(/^([A-Z]{2}-\d+)\s+(.*)$/);
      if (!m) {
        un.add(F16, r.line, r.cells[0], 'template row');
        continue;
      }
      const pic = plain(r.cells[1]);
      const frame = m[1].startsWith('KN') ? KIN : ALLY;
      add(composeShort({ id: m[1], kind: 'ally', title: m[2], frame, src: at(t, r.line), ...skyOf(frame), place: clausesOf(pic)[0], seconds: 7, lines: groupClauses(pic, 3), fx: fxOf(pic, 1), cast: castOf(pic, 'ตัวละคร'), light: lightOf(pic) }));
    }
  }
}

// ---------- 20 §7.3: the day of a miracle ----------

const DESTROY = new Set(['MR-06', 'MR-07', 'MR-08', 'MR-15', 'MR-17', 'MR-18', 'MR-22', 'MR-24']);
const mrFrame = (id: string) => (DESTROY.has(id) ? '#8a2433' : id === 'MR-25' ? '#b8c0cc' : id === 'MR-23' ? '#d8d4cc' : '#e8c36a');
const T20 = tables(F20);
const mrT = T20.find((t) => t.header[0] === 'ปาฏิหาริย์' && /จังหวะ 2/.test(t.header[1]));
for (const r of mrT?.rows ?? []) {
  const m = plain(r.cells[0]).match(/^(MR-\d+)\s+(.*)$/);
  if (!m) {
    un.add(F20, r.line, r.cells[0], 'miracle row');
    continue;
  }
  let what = plain(r.cells[2]);
  const ref = what.match(/ใช้ฉาก\s+([A-Z]+-\d+)/);
  if (ref) what = cards.find((c) => c.id === ref[1])?.picture ?? what;
  const frame = mrFrame(m[1]);
  const stages: Stage[] = [
    { n: 1, name: grammar[0].name, from: 0, to: 3, text: '' },
    { n: 2, name: grammar[1].name, from: 3, to: 8, text: plain(r.cells[1]) },
    { n: 3, name: 'สิ่งที่เกิด', from: 8, to: 22, text: what },
    { n: 4, name: 'หลังเหตุ', from: 22, to: 30, text: `${plain(r.cells[3])} ${plain(r.cells[4]).replace(/^(?!เสียง)/, 'เสียง')}` },
  ];
  add(composeStaged({ id: `mr.${m[1]}`, kind: 'miracle', title: m[2], frame, src: at(mrT!, r.line), ...skyOf(frame), stages, seconds: 30 }));
}

// ---------- the place of each card, the fx preset of a miracle, the rules of the picture ----------

// 12 "ที่ของการ์ดที่ตารางเหตุการณ์ไม่ระบุ": a card whose event the world table calls worldwide but whose picture is in one country
const fixedPlace = new Map<string, string>();
for (const t of T12) {
  if (t.header[0] !== 'การ์ด' || t.header[1] !== 'ประเทศ') continue;
  for (const r of t.rows) {
    const c = plain(r.cells[1]);
    if (/^[A-Z]{2}-\d+$/.test(c) && /^[A-Z]+-\d+$/.test(plain(r.cells[0]))) fixedPlace.set(plain(r.cells[0]), c);
    else un.add(F12, r.line, r.cells[0], 'card place row');
  }
}
const worldHome = new Map<string, { countries: string[]; continents: string[] }>();
for (const e of (JSON.parse(readFileSync(path.join(genDir, 'world-events.json'), 'utf8')) as { items: { events: { id: string; home: { countries: string[]; continents: string[] } }[] } }).items.events) worldHome.set(e.id, e.home);
for (const c of cards) {
  const country = fixedPlace.get(c.id) ?? worldHome.get(c.id)?.countries[0];
  const continent = country?.slice(0, 2) ?? worldHome.get(c.id)?.continents[0] ?? localContinent.get(c.id);
  if (continent) c.place = { continent, ...(country ? { country } : {}) };
}

// 20 §7.3: the miracles that have an effect of their own
const FX_PRESETS = new Set(['meteor', 'beam']);
for (const t of T20) {
  if (t.header[0] !== 'ปาฏิหาริย์' || t.header[1] !== 'ภาพพิเศษ') continue;
  for (const r of t.rows) {
    const id = plain(r.cells[0]);
    const preset = plain(r.cells[1]).replace(/`/g, '');
    const sc = scripts.find((x) => x.id === `mr.${id}`);
    if (sc && FX_PRESETS.has(preset)) sc.fxPreset = preset as 'meteor' | 'beam';
    else un.add(F20, r.line, id, 'miracle fx preset row');
  }
}

// 13 §6: the rules of the picture
const rules: ScenesData['rules'] = { cityScale: NaN, tribeLand: {} };
const ruleT = T13.find((t) => t.header[0] === 'กติกา');
for (const r of ruleT?.rows ?? []) {
  const k = plain(r.cells[0]);
  const v = plain(r.cells[1]);
  const tribe = k.match(/^ฉากพิธีและปลายทางของ(.+?) อยู่ในทวีป$/);
  if (/^ภาพนิ่งของชีวิต/.test(k) && /^\d+$/.test(v)) rules.cityScale = Number(v);
  else if (tribe && lineOfName.get(tribe[1]) && /^[A-Z]{2}$/.test(v)) rules.tribeLand[lineOfName.get(tribe[1])!] = v;
  else if (!/^ฉากตัวอย่าง/.test(k)) un.add(F13, r.line, k, 'picture rule row');
}
if (Number.isNaN(rules.cityScale)) throw new Error('scenes: 13-storyline-scenes §6 has no city scale rule');

// ---------- write ----------

for (const s of scripts) if (!s.beats.length && !s.variants) un.add(s.src.split(':')[0], 0, s.id, 'script without beats');
const data: ScenesData = { frames, forms, cards, scripts, continents, grammar, rules };
const sources = [F11, F12, F13, F15, F16, F17, F18, F20];
writeGen('scenes', data, sources, GEN);
un.write();
if (nWorld !== 194) throw new Error(`scenes: expected 194 world event cards in 12-event-visuals, read ${nWorld}`);
return { group: 'scenes', files: ['scenes.json'], unparsed: un.count };
}
