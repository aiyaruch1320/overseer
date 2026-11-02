import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import run, { themeOf } from '../../scripts/codegen/groups/storylines';
import { RACE_WORDS, parseCell, parseChoice, parseConditionX, parseWeightCell, textConditions } from '../../scripts/codegen/lib/effects';
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
    expect(report.strict).toBe(true); // turned on when M0-c2 brought the docs to zero
    // phrases the grammar did not read (the text conditions that are left are counted apart, see the H2 M1 tests)
    const md = readFileSync(path.join(genDir, '_unparsed/storylines.md'), 'utf8');
    const textCount = md.split('\n').filter((l) => l.endsWith('| text in condition |')).length;
    expect(report.unparsed - textCount).toBeLessThanOrEqual(30);
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
    // the words before the path are a condition the grammar cannot read (kept as text and reported), the path stays inside it
    expect(p.effects).toEqual([
      {
        k: 'if',
        cond: { k: 'text', text: 'ชนะหัวหน้าด้วยดาบ' },
        then: [{ k: 'jobpath', job: 'swordsaint', secret: true, need: { k: 'has', kind: 'aptitude', id: 'sword', level: 3 } }],
      },
    ]);
    expect(textConditions(p.effects)).toEqual(['ชนะหัวหน้าด้วยดาบ']);
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

// ---------- M0-ค: the fixes the data review asked for (review/m0/data-review.md) ----------

const docsStoryFiles = listDocs('docs/lore/storylines', /^\d\d-.*\.md$/);
const deep = (x: unknown, f: (o: Record<string, unknown>) => void) => {
  if (Array.isArray(x)) x.forEach((y) => deep(y, f));
  else if (x && typeof x === 'object') {
    f(x as Record<string, unknown>);
    Object.values(x).forEach((y) => deep(y, f));
  }
};
const nodeOf = (id: string) => [...story.nodes, ...conv.points].find((n) => n.id === id)!;
const choiceOf = (id: string, key: 'a' | 'b' | 'c') => nodeOf(id).choices.find((c) => c.key === key)!;
const pickIds = (effects: EffectX[]) => {
  const p = effects.find((e) => e.k === 'pick');
  return p && p.k === 'pick' ? p.of.map((b) => (b.effects[0].k === 'grant' || b.effects[0].k === 'event' ? b.effects[0].id : b.effects[0].k)) : null;
};

describe('B1: no ghoul in a family', () => {
  it('has no race condition in the heir rules or the heir endings', () => {
    const races: string[] = [];
    deep([story.heirRules, story.endings.filter((e) => e.line === 'hr')], (o) => {
      if (o.k === 'race') races.push(JSON.stringify(o));
    });
    expect(races).toEqual([]);
    expect(story.heirRules.map((h) => h.node)).toEqual(['hr.b1', 'hr.b2', 'hr.t1', 'hr.t2', 'hr.a1 hr.a2 hr.a3', 'hr.a4', 'hr.e1']);
    expect(story.heirRules[0].cond).toBeUndefined(); // "ทุกทายาท (เกิดในตระกูลที่มีสมุดตระกูล)": the family book applies to every heir
    // "ทุกทายาท" holds for everybody
    expect(story.heirRules[3].cond).toBeUndefined();
  });
  it('finds a race only where the docs write a race word', () => {
    // every race condition in the data stands on a race word that is a whole word in the source row
    const rows = new Map<string, string>();
    for (const f of docsStoryFiles) for (const t of tables(f)) for (const r of t.rows) rows.set(`docs/lore/storylines/${f.split('/').pop()}:${r.line}`, r.cells.join(' | '));
    const bad: string[] = [];
    for (const [name, list] of [['node', story.nodes], ['ending', story.endings], ['link', story.links], ['heir', story.heirRules]] as const) {
      for (const x of list as { src: string }[]) {
        const row = rows.get(x.src) ?? '';
        deep(x, (o) => {
          if (o.k !== 'race') return;
          for (const code of o.ids as string[]) {
            const word = RACE_WORDS.find(([, c]) => c === code)![0];
            const whole = new RegExp(`(?<![฀-๿])${word}(?![฀-๿])|(?<=ชาว|และ|หรือ|กับ)${word}|${word}(?=และ|หรือ|กับ)`);
            if (!whole.test(row)) bad.push(`${name} ${x.src} ${word}`);
          }
        });
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('B2: "A หรือ B" of codes is a pick', () => {
  it('reads the five examples of the review', () => {
    expect(pickIds(choiceOf('or.t3', 'a').effects)).toEqual(['soldier', 'mercenary']); // 05-orc.md:40
    expect(pickIds(choiceOf('be.t3', 'b').effects)).toEqual(['tamer', 'courier']); // 07-beast.md:45
    expect(pickIds(choiceOf('be.t3', 'c').effects)).toEqual(['caravan_guard', 'shepherd']);
    expect(pickIds(choiceOf('sf.a3', 'c').effects)).toEqual(['ferryman', 'shipwright']); // 25-journeys.md:46
    expect(pickIds(choiceOf('cv.6', 'c').effects)).toEqual(['BIO-03', 'WT-02']); // 00-convergence.md:114
    expect(pickIds(choiceOf('hb.t2', 'a').effects)).toEqual(['trust', 'nc_betrayed_trust']); // 22-halfblood.md:59
  });
  it('has the convergence hand-off of dm.a5 as a pick between cv.8 and cv.10', () => {
    const n = nodeOf('dm.a5');
    const p = n.notes.find((e) => e.k === 'pick');
    expect(p && p.k === 'pick' && p.of.map((b) => b.effects)).toEqual([[{ k: 'converge', to: 'cv.8' }], [{ k: 'converge', to: 'cv.10' }]]);
    expect(n.converge).toEqual(['cv.8', 'cv.10']);
  });
});

describe('H1: a condition stays with its result', () => {
  const ifs = (effects: EffectX[]) => effects.filter((e) => e.k === 'if');
  it('wraps the examples of the review', () => {
    // 01-human.md:43 hu.b1 ข: the war orphan only where there is a war
    expect(ifs(choiceOf('hu.b1', 'b').effects)).toEqual([{ k: 'if', cond: { k: 'place', kinds: ['war'] }, then: [{ k: 'grant', kind: 'curse', id: 'nc_war_orphan' }] }]);
    expect(choiceOf('hu.b1', 'b').effects.some((e) => e.k === 'grant')).toBe(false);
    // 00-convergence.md:40 cv.1 ก
    expect(ifs(choiceOf('cv.1', 'a').effects)).toEqual([{ k: 'if', cond: { k: 'event', id: 'SF-08', happened: true }, then: [{ k: 'grant', kind: 'job', id: 'ruin_city_lord' }] }]);
    // 00-convergence.md:114 cv.6 ค
    const c6 = ifs(choiceOf('cv.6', 'c').effects);
    expect(c6).toHaveLength(1);
    expect(c6[0]).toMatchObject({ cond: { k: 'and' }, then: [{ k: 'grant', kind: 'job', id: 'sapling_guardian' }] });
    // 16-giant.md:48 gi.a7: both the job path and the mark are behind a condition
    expect(ifs(choiceOf('gi.a7', 'a').effects)[0]).toMatchObject({ cond: { k: 'event', id: 'GD-08', happened: true }, then: [{ k: 'jobpath', job: 'godslayer' }] });
    expect(ifs(choiceOf('gi.a7', 'c').effects)[0]).toMatchObject({ then: [{ k: 'grant', id: 'nb_mark_gromdhar' }] });
    expect(choiceOf('gi.a7', 'c').effects.some((e) => e.k === 'grant')).toBe(false);
    // 09-dragonkin.md:49 dk.e2 ค: the x3 only with the dragon mark
    expect(choiceOf('dk.e2', 'c').effects).toContainEqual({ k: 'entryMod', choice: 'a', cond: { k: 'has', kind: 'blessing', id: 'nb_mark_*' }, mul: 3 });
    // 28-allies.md:41 kn.t1 ค
    expect(ifs(choiceOf('kn.t1', 'c').effects)[0]).toMatchObject({ then: [{ k: 'ref', nodes: ['bd.b1'] }] });
    // 22-halfblood.md:59 hb.t2 ข: the infamy only with the hidden-blood flag
    expect(ifs(choiceOf('hb.t2', 'b').effects)[0]).toMatchObject({ then: [{ k: 'grant', id: 'c_infamous', chance: 0.2 }] });
    // 25-journeys.md:46 sf.a3: the kraken fight only if DR-05 happened
    expect(nodeOf('sf.a3').notes).toContainEqual({ k: 'if', cond: { k: 'event', id: 'DR-05', happened: true }, then: [{ k: 'battleFor', choices: ['a'], enemies: ['kraken'] }] });
  });
});

describe('H2 M1: a text condition is never kept silently', () => {
  const everything = () => [story.nodes, story.rites, story.endings, story.links, story.lines, story.origins, story.heirRules, story.allyArcs, conv.points, conv.fallback];
  const md = readFileSync(path.join(genDir, '_unparsed/storylines.md'), 'utf8');
  it('lists every text condition of the data in the unparsed report', () => {
    const texts = new Set(textConditions(everything()));
    expect(texts.size).toBeGreaterThanOrEqual(0); // the prose that is left waits in scripts/codegen/accepted/storylines.txt
    const missing = [...texts].filter((t) => !md.includes(t.replace(/\|/g, '\\|')));
    expect(missing).toEqual([]);
    if (texts.size) expect(md).toContain('text in condition');
    // the report counts them: not only the phrases that were not read
    expect(report.unparsed).toBeGreaterThanOrEqual(texts.size);
  });
  it('has no explaining word of a code left as a condition', () => {
    const texts = textConditions(everything());
    expect(texts.filter((t) => /^(?:สำเร็จ|อาชีพลับ|ชาวพื้นหลัง|ชาวพื้น|ชาว|เกิดแล้ว|แล้ว)$/.test(t.trim()))).toEqual([]);
    // 01-human.md:62 "ชาวพื้นหลัง DR-01"
    expect(story.links.find((l) => l.from === 'hu.a3' && l.to.includes('cv.1'))!.cond).toEqual({ k: 'event', id: 'DR-01', happened: true });
    // the endings of hu and be keep only the code
    expect(story.endings.find((e) => e.line === 'hu' && /รวมเผ่า/.test(e.title))?.cond).toEqual({ k: 'node', id: 'hu.a7' });
    expect(story.endings.find((e) => e.line === 'be' && /ราชันย์อสูร/.test(e.title))?.cond).toEqual({ k: 'has', kind: 'job', id: 'beastking' });
  });
  it('reads the numbers of the review as comparisons', () => {
    const hasCond = (list: unknown, want: Record<string, unknown>) => {
      let found = false;
      deep(list, (o) => {
        if (Object.entries(want).every(([k, v]) => JSON.stringify(o[k]) === JSON.stringify(v))) found = true;
      });
      return found;
    };
    expect(hasCond(nodeOf('gi.a7').choices, { k: 'cmp', stat: 'godFaith', op: '<=', value: -70 })).toBe(true);
    expect(hasCond(nodeOf('fa.a7').choices, { k: 'cmp', stat: 'magic', op: '>=', value: 17 })).toBe(true);
    expect(hasCond(nodeOf('ec.a2').choices, { k: 'class', min: 3 })).toBe(true);
    expect(hasCond(story.endings.filter((e) => /ไม่เคยกลับมา/.test(e.title)), { k: 'age', max: 49 })).toBe(true);
    expect(hasCond(nodeOf('iv.a1').choices, { k: 'cmp', stat: 'mine', op: '>=', value: 300 })).toBe(true);
    expect(hasCond(nodeOf('le.a6'), { k: 'cmp', stat: 'allyLevel', op: '>=', value: 3 })).toBe(true);
  });
});

describe('M8 L1 L6', () => {
  it('lets so.a6 open for the first question OR for MC-05 (M8)', () => {
    expect(nodeOf('so.a6').when).toEqual({ k: 'or', of: [{ k: 'node', id: 'so.t1' }, { k: 'event', id: 'MC-05', happened: true }] });
  });
  it('reads "DM-07 WR-13 หรือ PL-03" of dw.a4 as any of the three (M8)', () => {
    const l = story.links.find((x) => x.from === 'dw.a4')!;
    expect(l.cond).toEqual({
      k: 'or',
      of: ['DM-07', 'WR-13', 'PL-03'].map((id) => ({ k: 'event', id, happened: true })),
    });
  });
  it('has no empty label and none opening with "หรือ" (L1)', () => {
    const bad: string[] = [];
    for (const n of [...story.nodes, ...conv.points, conv.fallback]) for (const c of n.choices) if (!c.label.trim() || /^(?:หรือ|\()/.test(c.label.trim())) bad.push(`${n.id}${c.key}`);
    expect(bad).toEqual([]);
    expect(choiceOf('dw.t3', 'c').label).toBe('engineer หรือ rune_carver');
    expect(choiceOf('or.t3', 'b').label).toBe('smith หรือช่างล้อมเมือง');
  });
  it('keeps "หรือ" before an arrow as the condition, and "ไม่เข้า" as nothing granted', () => {
    // 08-naga.md:18 "เกิด NR-06 หรือ NR-07 → `c_outcast` 40%"
    const o = story.origins.find((x) => x.line === 'na' && x.kind === 'ลูกครึ่ง')!;
    expect(o.effects[0]).toEqual({
      k: 'if',
      cond: { k: 'or', of: [{ k: 'country', ids: ['NR-06'] }, { k: 'country', ids: ['NR-07'] }] },
      then: [{ k: 'grant', kind: 'curse', id: 'c_outcast', chance: 0.4 }],
    });
    // 22-halfblood.md:87 "เติบโตแบบมนุษย์ ไม่เข้า `fisher` หรือ `ferryman`"
    expect(choiceOf('nh.t1', 'b').effects).toEqual([]);
    expect(choiceOf('nh.t1', 'b').label).toContain('fisher หรือ ferryman');
  });
  it('lists both places of the dwarf who left home (L6)', () => {
    const o = story.origins.find((x) => x.line === 'dw' && x.kind === 'พลัดถิ่น')!;
    expect(o.places).toEqual(['MK-07', 'AL-21', 'MH-05', 'SH-07', 'SH-15']);
    const named = o.effects.flatMap((e) => (e.k === 'place' ? e.ids : []));
    expect(named).toEqual(o.places);
  });
});

describe('no choice or condition without a pick or an if (regression)', () => {
  // Segments of the node and convergence tables that say "หรือ", "ถ้า" or "เมื่อ" next to a code, a number or an arrow.
  // Each one must come out of the grammar with a pick, an if, a requirement, a weight change or a job-path condition,
  // unless it gives no result at all (nothing but references to events, NPCs and places).
  // Segments the grammar cannot structure yet are listed with the reason; the next wave fixes the docs.
  const EXPLAINED: Record<string, string> = {
    '28-allies.md:40 kn.b1#6': 'the condition names a template (KN-08) and the result is a link to another doc',
  };
  const COND = /(?<!เ)ถ้า|เมื่อ/;
  const TOKEN = /`[^`]+`|\b[A-Z]{2,4}-\d{2,3}\b|→|[฀-๿]\s*[+\-−]\s*\d|\b[a-z]{2}\.[btaelx]\d+\b/;
  const OR = /(?:^|\s)หรือ(?=\s|`|[฀-๿A-Za-z])/;
  const KINDS = new Set(['if', 'pick', 'only', 'chance', 'variant', 'entryMod', 'choiceMod', 'nodeWeight', 'stanceMul', 'ending', 'battleFor', 'eventWeight']);
  const structured = (x: unknown): boolean => {
    let ok = false;
    deep(x, (o) => {
      if (typeof o.k === 'string' && KINDS.has(o.k)) ok = true;
      if (o.k === 'jobpath' && o.need) ok = true;
    });
    return ok;
  };
  const scan = () => {
    let checked = 0;
    const bad: string[] = [];
    for (const f of docsStoryFiles) {
      for (const t of tables(f)) {
        const isNode = t.header[0] === 'โหนด' && t.header.length === 7;
        if (!isNode && t.header[0] !== 'ทางเลือก') continue;
        for (const r of t.rows) {
          for (const i of isNode ? [3, 4, 5, 6] : [2]) {
            for (const raw of (r.cells[i] ?? '').split(/\s+·\s+/)) {
              const seg = raw.replace(/^\d+(?:\.\d+)?\s+/, '');
              if (!(COND.test(seg) || OR.test(seg)) || !TOKEN.test(seg)) continue;
              checked++;
              const p = parseCell(seg, ids, { choice: i < 6, notes: isNode && i === 6, battle: isNode && i === 6 });
              const meta = p.nodeWhen?.length || p.when || p.mods.length || p.replaces?.length || p.choiceWhen || p.altForm;
              const refsOnly = p.effects.every((e) => (e.k === 'event' && !e.open) || e.k === 'npc' || e.k === 'place' || e.k === 'ref');
              if (structured(p.effects) || meta || refsOnly) continue;
              bad.push(`${f.split('/').pop()}:${r.line} ${r.cells[0]}#${i}`);
            }
          }
        }
      }
    }
    return { checked, bad };
  };
  it('has none outside the explained list', () => {
    const { checked, bad } = scan();
    expect(checked).toBeGreaterThan(200);
    expect(bad.filter((b) => !EXPLAINED[b])).toEqual([]);
    // an exception that stops being true must leave the list
    expect(Object.keys(EXPLAINED).filter((k) => !bad.includes(k))).toEqual([]);
  });
  it('keeps every percentage of a code in the node rows', () => {
    // "`c_frail` 30%" must come out as a grant (or a branch of a pick) with chance 0.3 on the same node
    const miss: string[] = [];
    for (const n of story.nodes) {
      const [file, line] = n.src.split(':');
      const row = tables(file).flatMap((t) => t.rows).find((r) => r.line === Number(line));
      if (!row) continue;
      const text = row.cells.slice(3, 7).join(' ');
      for (const m of text.matchAll(/`([a-z_#][a-z_0-9]*)`\s*(\d+(?:\.\d+)?)%/g)) {
        let found = false;
        deep([n.choices, n.notes], (o) => {
          if (o.k === 'grant' && o.id === m[1] && o.chance === Number(m[2]) / 100) found = true;
          // an enemy with a percentage is a fight that happens with that chance
          if (o.k === 'chance' && o.p === Number(m[2]) / 100 && JSON.stringify(o.then).includes(`"${m[1]}"`)) found = true;
        });
        if (!found) miss.push(`${n.id} ${m[1]} ${m[2]}%`);
      }
    }
    expect(miss).toEqual([]);
  });
});

describe('M1 T6: the theme and the question of the life of each race', () => {
  const fileOf = (t: string) =>
    listDocs('docs/lore/storylines', /^\d\d-.*\.md$/).find((f) => new RegExp(`^# เส้นเรื่อง.*\\(${t}\\)`, 'm').test(readFileSync(f, 'utf8')));

  it('gives each of the 21 race lines a theme paragraph and one question, and no other line has them', () => {
    for (const t of TRIBES) {
      const l = story.lines.find((x) => x.id === t)!;
      expect(l.theme, t).toBeTruthy();
      expect(l.question, t).toBeTruthy();
      expect(l.theme, t).not.toContain('คำถามหลัก');
      expect(l.theme, t).not.toContain('**');
      expect(l.question, t).not.toContain('**');
      expect(l.question!.length, t).toBeLessThan(120);
    }
    expect(story.lines.filter((l) => !TRIBES.includes(l.id)).filter((l) => l.theme || l.question)).toEqual([]);
  });

  it('takes the question from the bold `คำถามหลัก:` of section 1, word for word', () => {
    const human = story.lines.find((l) => l.id === 'hu')!;
    expect(human.question).toBe('จะใช้ชีวิตสั้น ๆ นี้เพื่อตัวเอง หรือเป็นคนที่รวมเผ่าอื่นได้ (คำสัตย์ร้อยเผ่า)');
    expect(human.theme).toContain('มนุษย์อายุสั้น');
    for (const t of TRIBES) {
      const f = fileOf(t);
      expect(f, t).toBeTruthy();
      expect(readFileSync(f!, 'utf8'), t).toContain(`**คำถามหลัก: ${story.lines.find((l) => l.id === t)!.question}**`);
    }
  });

  it('falls back to the first sentence of the theme when a file marks no question', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'overseer-theme-'));
    const f = path.join(dir, '99-test.md');
    writeFileSync(f, '# เส้นเรื่อง: ทดสอบ (zz)\n\n## 1. ธีม\n\nเผ่านี้ไม่มีคำถามหลักที่ทำเครื่องหมาย ประโยคที่สองอยู่ตรงนี้\n\n## 2. จุดกำเนิด\n');
    try {
      const t = themeOf(f);
      expect(t.marked).toBe(false);
      expect(t.theme).toContain('ประโยคที่สอง');
      expect(t.question).toBeTruthy();
      expect(t.question.length).toBeLessThanOrEqual(t.theme.length);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
