import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import run from '../../scripts/codegen/groups/storylines';
import { parseCell, parseChoice, parseConditionX, parseWeightCell } from '../../scripts/codegen/lib/effects';
import { idIndex } from '../../scripts/codegen/lib/ids';
import { genDir, listDocs, tables } from '../../scripts/codegen/lib/table';
import type { ConvergenceData, EffectX, StoryNodeX, StorylinesData } from '../../src/core/data/types-storylines';

const ids = idIndex();
const read = (name: string) => readFileSync(path.join(genDir, name), 'utf8');
const gen = <T>(name: string): T => (JSON.parse(read(name)) as { items: T }).items;

// make sure the files are there and current before the checks read them
const report = run();
const story = gen<StorylinesData>('storylines.json');
const conv = gen<ConvergenceData>('convergence.json');

const TRIBES = ['hu', 'el', 'de', 'dw', 'or', 'ha', 'be', 'na', 'dk', 'va', 'fa', 'sl', 'dm', 'me', 'wi', 'gi', 'la', 'co', 'so', 'mu', 'gh'];
const MAIN_IDS = ['b1', 'b2', 't1', 't2', 't3', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'e1', 'e2'];

const walk = (effects: EffectX[] | undefined, f: (e: EffectX) => void) => {
  for (const e of effects ?? []) {
    f(e);
    if (e.k === 'if' || e.k === 'only' || e.k === 'chance') walk(e.then as EffectX[], f);
    if (e.k === 'outcome') walk(e.effects, f);
    if (e.k === 'variant') for (const c of e.choices) walk(c.effects, f);
  }
};

describe('storyline generator (code-plan §5.1 row 1)', () => {
  it('reports itself and writes both files', () => {
    expect(report.group).toBe('storylines');
    expect(report.files).toEqual(['storylines.json', 'convergence.json']);
    expect(report.strict).toBe(false); // the lead turns this on after M0-ค
    expect(report.unparsed).toBeLessThanOrEqual(30);
  });

  it('gives the same bytes on every run', () => {
    const names = ['storylines.json', 'convergence.json', '_unparsed/storylines.md'];
    const before = names.map(read);
    run();
    expect(names.map(read)).toEqual(before);
  });

  it('reads every node table row: 14 main nodes for each of the 21 races', () => {
    for (const t of TRIBES) {
      const main = story.nodes.filter((n) => n.line === t && n.kind === 'main').map((n) => n.id);
      expect(main, t).toEqual(MAIN_IDS.map((x) => `${t}.${x}`));
    }
    const rows = listDocs('docs/lore/storylines', /^\d\d-.*\.md$/)
      .filter((f) => !/\/00-/.test(f))
      .flatMap((f) => tables(f).filter((t) => t.header[0] === 'โหนด' && t.header.length === 7))
      .reduce((n, t) => n + t.rows.length, 0);
    expect(story.nodes.length).toBe(rows);
    expect(new Set(story.nodes.map((n) => n.id)).size).toBe(story.nodes.length);
  });

  it('three way weights add up to 100 on every node that has weights', () => {
    const bad: string[] = [];
    for (const n of [...story.nodes, ...conv.points, conv.fallback]) {
      if (!n.choices.length) continue;
      const sum = n.choices.reduce((a, c) => a + c.weight, 0);
      if (sum !== 100) bad.push(`${n.id}=${sum}`);
    }
    expect(bad).toEqual([]);
    // choices are written a b c in order
    for (const n of story.nodes) expect(n.choices.map((c) => c.key)).toEqual(['a', 'b', 'c'].slice(0, n.choices.length));
  });

  it('every node, jump, convergence, replacement and link points at something that exists', () => {
    const known = new Set<string>([...story.nodes.map((n) => n.id), ...conv.points.map((p) => p.id), conv.fallback.id]);
    const missing = new Set<string>();
    const check = (from: string, to: string | undefined, why: string) => {
      if (to && !known.has(to)) missing.add(`${from} ${why} ${to}`);
    };
    for (const n of [...story.nodes, ...conv.points]) {
      const all = [...n.notes, ...n.choices.flatMap((c) => c.effects)];
      walk(all, (e) => {
        if (e.k === 'converge') check(n.id, e.to, 'converge');
        if (e.k === 'jump') check(n.id, e.to, 'jump');
        if (e.k === 'entryMod') check(n.id, e.to, 'entryMod');
        if (e.k === 'ref') for (const t of e.nodes) if (/^[a-z]{2}\./.test(t) || /^cv\./.test(t)) check(n.id, t, `ref ${e.rel}`);
      });
      for (const r of n.replaces ?? []) check(n.id, r, 'replaces');
      for (const r of n.converge ?? []) check(n.id, r, 'converge field');
    }
    for (const l of story.links) {
      check(l.from, l.from, 'link from');
      for (const t of l.to) check(l.from, t, 'link to');
    }
    for (const e of story.endings) for (const nn of e.nodes) check(e.line, nn.id, 'ending');
    for (const p of conv.points) {
      for (const e of p.entries) check(p.id, e, 'entry');
      for (const e of p.extraEntries) if (e.from) check(p.id, e.from, 'extra entry');
    }
    // `ทุกโหนด` is a words-only link in a table of 24-economy
    expect([...missing].filter((m) => !/ทุกโหนด/.test(m))).toEqual([]);
  });

  it('compares three rows with the docs', () => {
    const rowOf = (file: string, id: string) => {
      const t = tables(`docs/lore/storylines/${file}`).find((x) => x.header[0] === 'โหนด' && x.rows.some((r) => r.cells[0] === id))!;
      return t.rows.find((r) => r.cells[0] === id)!;
    };
    for (const [file, id] of [
      ['01-human.md', 'hu.b2'],
      ['02-elf.md', 'el.a2'],
      ['09-dragonkin.md', 'dk.a7'],
    ] as const) {
      const row = rowOf(file, id);
      const n = story.nodes.find((x) => x.id === id)!;
      expect(n.src).toBe(`docs/lore/storylines/${file}:${row.line}`);
      expect(n.title).toBe(row.cells[2]);
      const age = row.cells[1].split(/[–-]/).map(Number);
      expect(n.age).toEqual([age[0], age[1]]);
      for (let i = 0; i < 3; i++) {
        const w = Number(row.cells[3 + i].match(/^\d+/)?.[0]);
        expect(n.choices[i].weight, `${id} ${n.choices[i].key}`).toBe(w);
      }
    }
    // content of the human wolf attack
    const b2 = story.nodes.find((x) => x.id === 'hu.b2')!;
    expect(b2.choices[2].effects).toContainEqual({ k: 'wound', chance: 0.1 });
    expect(b2.choices[2].effects).toContainEqual({ k: 'grant', kind: 'companion', id: 'sp_wolf_pup' });
    expect(b2.notes).toContainEqual({ k: 'battle', enemies: ['wolf'] });
    expect(b2.godWindow?.what).toContain('b_courage');
    // an elf choice that needs an earlier choice or a skill
    const a2 = story.nodes.find((x) => x.id === 'el.a2')!;
    expect(a2.when).toEqual({ k: 'event', id: 'WR-17', happened: true });
    expect(a2.choices[1].when).toEqual({
      k: 'or',
      of: [
        { k: 'node', id: 'el.b2', choice: 'a' },
        { k: 'has', kind: 'skill', id: 'ns_mediate' },
      ],
    });
    expect(a2.choices[1].effects).toContainEqual({ k: 'eventWeight', id: 'WR-17', delta: -30 });
    // a whole-row hand-off to a convergence with a weight change on cv.4
    const a4 = story.nodes.find((x) => x.id === 'de.a4')!;
    expect(a4.converge).toEqual(['cv.4']);
    expect(a4.choices).toEqual([]);
    expect(a4.notes).toContainEqual({ k: 'entryMod', to: 'cv.4', choice: 'b', mul: 2 });
  });

  it('reads the race rites, the endings, the links and the god windows', () => {
    expect(story.rites.map((r) => r.id)).toEqual(TRIBES.map((t) => `${t}.t1`));
    for (const r of story.rites) {
      const n = story.nodes.find((x) => x.id === r.id)!;
      expect(n.rite, r.id).toBe(r.id);
      expect(r.outcomes.length).toBeGreaterThanOrEqual(3);
    }
    const elRite = story.rites.find((r) => r.id === 'el.t1')!;
    expect(elRite.outcomes[0].weight).toBe(60);
    expect(elRite.outcomes[0].mods).toEqual([{ cond: { k: 'event', id: 'BIO-01', happened: true }, mul: 1, add: -20 }]);
    expect(story.rites.find((r) => r.id === 'hu.t1')!.form).toBe('variants');

    const docEndings = listDocs('docs/lore/storylines', /^\d\d-.*\.md$/).flatMap((f) => tables(f).filter((t) => t.header[0] === 'ปลายทาง'));
    expect(story.endings.length).toBe(docEndings.reduce((n, t) => n + t.rows.length, 0));
    const docLinks = listDocs('docs/lore/storylines', /^\d\d-.*\.md$/).flatMap((f) => tables(f).filter((t) => t.header[0] === 'จาก' && t.header[1] === 'ไป'));
    expect(story.links.length).toBe(docLinks.reduce((n, t) => n + t.rows.length, 0));

    const godRows = listDocs('docs/lore/storylines', /^\d\d-.*\.md$/).flatMap((f) => tables(f).filter((t) => t.header[0] === 'โหนด' && t.header[1] === 'การแทรกแซง'));
    const godNodes = new Set(godRows.flatMap((t) => t.rows.map((r) => r.cells[0])));
    expect(story.nodes.filter((n) => n.godWindow).map((n) => n.id).sort()).toEqual([...godNodes].sort());
  });

  it('reads the 16 convergence points', () => {
    expect(conv.points.map((p) => p.id)).toEqual(Array.from({ length: 16 }, (_, i) => `cv.${i + 1}`));
    for (const p of conv.points) expect(p.choices.map((c) => c.key), p.id).toEqual(['a', 'b', 'c']);
    expect(conv.fallback.choices.length).toBe(3);
    const cv1 = conv.points[0];
    expect(cv1.entries).toEqual(['wi.a1', 'hu.a3', 'dk.a3', 'gi.a2', 'be.a3', 'sw.a1', 'na.t3']);
    expect(cv1.choices[0].mods).toEqual([
      {
        cond: {
          k: 'or',
          of: [
            { k: 'has', kind: 'trait', id: 'kind' },
            { k: 'has', kind: 'trait', id: 'generous' },
          ],
        },
        mul: 1,
        add: 20,
      },
    ]);
    // every entry node the overview names really sends the character to that point
    const sends = new Map<string, Set<string>>();
    for (const n of story.nodes) {
      const to = new Set<string>(n.converge ?? []);
      const all = [...n.notes, ...n.choices.flatMap((c) => c.effects)];
      walk(all, (e) => {
        if (e.k === 'converge') to.add(e.to);
      });
      sends.set(n.id, to);
    }
    const unlinked: string[] = [];
    for (const p of conv.points) for (const e of p.entries) if (!sends.get(e)?.has(p.id)) unlinked.push(`${e}->${p.id}`);
    // the overview also lists nodes that only reach a point through a choice written in prose; keep the list short and visible
    expect(unlinked).toEqual([]);
  });

  it('reads the 55 ally arcs', () => {
    expect(story.allyArcs.length).toBe(55);
    expect(story.allyArcs.filter((a) => a.group === 'first10').length).toBe(10);
    expect(story.allyArcs.filter((a) => a.group === 'flagship').length).toBe(45);
    for (const a of story.allyArcs) {
      expect(a.steps.length, a.npc).toBeGreaterThanOrEqual(4);
      expect(a.endings.map((e) => e.key), a.npc).toEqual(['a', 'b', 'c']);
      expect(a.endings.reduce((s, e) => s + e.weight, 0), a.npc).toBe(100);
      expect(a.lines.length, a.npc).toBeGreaterThan(0);
    }
  });
});

describe('effect grammar of the storylines', () => {
  it('reads a permanent wound with a chance', () => {
    expect(parseCell('ตามผู้ใหญ่ออกไป · บาดแผลถาวร 10%', ids).effects).toContainEqual({ k: 'wound', chance: 0.1 });
  });

  it('reads "ต้อง…" as the condition of the choice', () => {
    const a = parseChoice('a', '25 เริ่มรวบรวมคำสัตย์ ต้องมีไว้ใจ ≥ 3 จาก 10 เผ่าขึ้นไป', ids);
    expect(a.choice.when).toEqual({ k: 'cmp', stat: 'trust', op: '>=', value: 3, label: 'ไว้ใจ', count: 10 });
    const b = parseChoice('b', '35 เสนอแก้กฎ · ต้องผ่าน el.b2 ทาง ก หรือ `ns_mediate`', ids);
    expect(b.choice.when).toEqual({
      k: 'or',
      of: [
        { k: 'node', id: 'el.b2', choice: 'a' },
        { k: 'has', kind: 'skill', id: 'ns_mediate' },
      ],
    });
    expect(b.unparsed).toEqual([]);
  });

  it('reads a weight change on a convergence choice', () => {
    const p = parseCell('→ cv.4 · ทาง ข ของ cv.4 ได้น้ำหนัก ×2 (ผู้ไร้เงาได้ยินชัด)', ids, { notes: true });
    expect(p.effects).toContainEqual({ k: 'converge', to: 'cv.4' });
    expect(p.effects).toContainEqual({ k: 'entryMod', to: 'cv.4', choice: 'b', mul: 2 });
    expect(p.unparsed).toEqual([]);
  });

  it('reads mood markers and bond template codes', () => {
    const p = parseCell('45 เพื่อนวัยเด็ก · สายสหายระดับ 2 · `{สหาย:คิดถึง@2}` · 30% ได้ไอเทมคู่ `PR-01` `PR-02` · แม่แบบ `FT-01` ถึง `FT-05`', ids, { weighted: true, choice: true });
    expect(p.effects).toContainEqual({ k: 'mood', line: 'สหาย', mood: 'คิดถึง', level: 2 });
    expect(p.effects).toContainEqual({ k: 'bond', line: 'สหาย', level: 2 });
    expect(p.effects).toContainEqual({ k: 'template', kind: 'PR', code: 'PR-01', chance: 0.3 });
    expect(p.effects).toContainEqual({ k: 'template', kind: 'FT', code: 'FT-01', to: 'FT-05' });
    expect(p.unparsed).toEqual([]);
  });

  it('reads weight cells with additions, multipliers and requirements', () => {
    expect(parseWeightCell('40 (+20 `kind` `generous`)', ids).mods[0]).toMatchObject({ mul: 1, add: 20 });
    expect(parseWeightCell('35 (ต้องมี `leadership` หรือ `law`)', ids).when).toEqual({
      k: 'or',
      of: [
        { k: 'has', kind: 'aptitude', id: 'leadership' },
        { k: 'has', kind: 'aptitude', id: 'law' },
      ],
    });
    const w = parseWeightCell('35 (ยักษ์และผู้มี `leadership` ×2)', ids);
    expect(w.weight).toBe(35);
    expect(w.mods).toEqual([
      {
        cond: {
          k: 'or',
          of: [
            { k: 'race', ids: ['gi'] },
            { k: 'has', kind: 'aptitude', id: 'leadership' },
          ],
        },
        mul: 2,
      },
    ]);
  });

  it('reads a secret job path with its requirement', () => {
    const p = parseCell('ถ้าชนะหัวหน้าด้วยดาบ ทางสู่อาชีพลับ `swordsaint` (ต้องมี `sword_3`)', ids);
    expect(p.effects).toContainEqual({ k: 'jobpath', job: 'swordsaint', secret: true, need: { k: 'has', kind: 'aptitude', id: 'sword', level: 3 } });
  });

  it('keeps and and or apart in a condition', () => {
    const c = parseConditionX('`nb_peace_seed` `ns_mediate` ระดับ 3 ชื่อเสียง ≥ 30 และไม่มี `#bloodlust`', ids, true);
    expect(c).toMatchObject({ k: 'and' });
    const e = story.nodes.find((n) => n.id === 'hu.a7')!;
    expect(e.notes.some((x) => x.k === 'jobpath' && x.job === 'peacemaker_legend')).toBe(true);
  });

  it('wraps a note that is only for one continent', () => {
    const p = parseCell('มอร์เฮเวนใช้ `ash_wolf_pack`', ids, { battle: true, notes: true });
    expect(p.effects).toEqual([{ k: 'only', cond: { k: 'continent', ids: ['MH'] }, then: [{ k: 'battle', enemies: ['ash_wolf_pack'] }] }]);
  });

  it('ties a battle to the choices it belongs to', () => {
    const p = parseCell('ศึก: `npc_inquisitor` หัวหน้า (ทาง ข หรือ ค)', ids, { battle: true, notes: true });
    expect(p.effects).toContainEqual({ k: 'battleFor', choices: ['b', 'c'], enemies: ['npc_inquisitor'] });
  });
});

describe('nodes keep their position in the file', () => {
  it('orders nodes the way the docs do', () => {
    const order = (n: StoryNodeX) => Number(n.src.split(':')[1]);
    const byFile = new Map<string, number[]>();
    for (const n of story.nodes) {
      const f = n.src.split(':')[0];
      byFile.set(f, [...(byFile.get(f) ?? []), order(n)]);
    }
    for (const [f, lines] of byFile) expect(lines, f).toEqual([...lines].sort((a, b) => a - b));
  });
});
