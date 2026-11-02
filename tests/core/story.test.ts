import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { Game, makeCtx, type GameData, type System } from '../../src/core/game';
import type { StoryNodeX, StorylinesData, ConvergenceData } from '../../src/core/data/types-storylines';
import { onCond, onStat, resetRules, test } from '../../src/core/rules';
import { newGame } from '../../src/core/state';
import { registerStoryRules, storySystem } from '../../src/core/story';
import { fresh } from '../../src/core/story/state';
import type { Choice, Condition, Effect, LifeState } from '../../src/core/types';

// ---------- a toy character system and the conditions other systems would answer ----------

const toy: System = {
  name: 'character',
  beat(ctx) {
    const l = ctx.state.life!;
    if (l.hAge >= 75 && !l.dead) l.dead = { year: ctx.state.clock.worldYear, hAge: l.hAge, cause: 'old' };
  },
};

const CODE: Record<string, string> = { human: 'hu', elf: 'el', darkelf: 'de', dwarf: 'dw', orc: 'or', halfling: 'ha', beast: 'be', naga: 'na', dragonkin: 'dk', vampire: 'va', fae: 'fa', slime: 'sl', demonkin: 'dm', merfolk: 'me', winged: 'wi', giant: 'gi', lavakin: 'la', construct: 'co', soulmachine: 'so', mummy: 'mu', ghoul: 'gh' };
const RACES = Object.keys(CODE);

/** Events that "happened" in the test world; `world.happened` is the world system's, so the mock reads it. */
function mocks() {
  resetRules();
  registerStoryRules();
  const life = (c: { state: { life: LifeState | null } }) => c.state.life!;
  onCond('has', (c, x) => [...life(c).traits, ...life(c).blessings, ...life(c).curses, ...life(c).skills, ...(life(c).job ? [life(c).job!] : [])].includes(x.id));
  onCond('event', (c, x) => (c.state.world.happened[x.id] !== undefined) === x.happened);
  onCond('country', (c, x) => x.ids.includes(life(c).country));
  onCond('continent', (c, x) => x.ids.includes(life(c).country.slice(0, 2) as never));
  onCond('race', (c, x) => x.ids.includes(CODE[life(c).race] ?? life(c).race));
  onCond('era', (c, x) => c.state.world.era >= x.min && c.state.world.era <= (x.max ?? 9));
  onCond('half', () => false);
  onStat('gold', { read: (c) => life(c).gold, add: (c, _n, d) => void (life(c).gold += d) });
}

function person(race = 'human', patch: Partial<LifeState> = {}): LifeState {
  return {
    id: 'L1', name: 't', race, gender: 'm', birthYear: 0, lifespan: 75, hAge: 0, country: 'AL-01', home: 'AL-01', traits: [], aptitudes: {}, skills: [], blessings: [], curses: [], fate: [],
    cls: 'c3', gold: 0, stats: { pow: 0, mag: 0, spd: 0, luk: 0, int: 12, vit: 0 }, items: [], flags: [], passed: {}, pending: [], memory: [], godFaith: 0, heart: 0, ext: {}, ...patch,
  };
}

function play(seed: number, data: GameData, life: LifeState, setup?: (g: Game) => void): Game {
  const g = new Game(newGame(seed), data, [toy, storySystem]);
  g.state.life = life;
  setup?.(g);
  g.born();
  g.runLife();
  return g;
}

// ---------- a tiny storyline set to test one rule at a time ----------

const choice = (key: 'a' | 'b' | 'c', weight: number, extra: Partial<Choice> = {}): Choice => ({ key, weight, label: `way ${key}`, effects: [], mods: [], ...extra });
const node = (id: string, age: [number, number], choices: Choice[], extra: Partial<StoryNodeX> = {}): StoryNodeX => ({
  id, line: id.split('.')[0], stage: id.split('.')[1][0] as StoryNodeX['stage'], age, title: `title ${id}`, kind: 'main', section: '4', choices, notes: [], titleEvents: [], notesText: '', src: '', ...extra,
});

function mini(nodes: StoryNodeX[], opts: { cv?: ConvergenceData['points']; links?: StorylinesData['links']; fallback?: StoryNodeX } = {}): GameData {
  const sl: StorylinesData = {
    nodes, rites: [], endings: [], links: opts.links ?? [], lines: [{ id: 'hu', name: 'มนุษย์', file: '', nodeIds: nodes.map((n) => n.id) }],
    allyArcs: [], origins: [], heirRules: [], pairSets: [], halfbloodNpcs: [], jobOpeners: [],
  };
  const data: GameData = { storylines: { version: 't', items: sl } };
  if (opts.cv) data.convergence = { version: 't', items: { points: opts.cv, fallback: opts.fallback ?? node('cv.0', [0, 999], [choice('a', 50), choice('b', 50)], { line: 'cv', stage: 'x', kind: 'fallback' }), intro: '' } };
  return data;
}

const cvPoint = (id: string, open: Condition | undefined, choices: Choice[], extra: Partial<ConvergenceData['points'][number]> = {}): ConvergenceData['points'][number] => ({
  ...node(id, [0, 999], choices, { line: 'cv', stage: 'x', kind: 'convergence' }), name: id, openRaw: '', open, places: [], placesRaw: '', entries: [], entriesRaw: '', extraEntries: [], intro: '', byRace: '', battleText: '', npcs: [], enemies: [], ...extra,
});

const nodeLog = (g: Game) => g.state.log.filter((e) => e.sys === 'story' && e.kind === 'node');
const ids = (g: Game) => nodeLog(g).map((e) => String(e.id));

// ---------- real data ----------

let real: GameData;
beforeAll(() => {
  real = loadGen(['storylines', 'convergence', 'races']);
});
beforeEach(mocks);

describe('walk of the real storylines', () => {
  it('the same seed gives the same life, another seed another', () => {
    // the rules registry reports an unhandled kind once per process, so start each run from a clean registry
    const run = (seed: number) => {
      mocks();
      return play(seed, real, person('human'));
    };
    const a = run(11);
    const b = run(11);
    expect(JSON.stringify(a.state.log)).toBe(JSON.stringify(b.state.log));
    expect(a.state.life!.passed).toEqual(b.state.life!.passed);
    expect(a.state.life!.memory).toEqual(b.state.life!.memory);
    expect(JSON.stringify(run(12).state.log)).not.toBe(JSON.stringify(a.state.log));
    expect(a.state.rng['life.story']).toBeDefined();
  });

  it('every race walks its 14 nodes and closes with e2 before the natural death, without stalling', () => {
    const ix = (real.storylines.items as StorylinesData).nodes;
    for (const race of RACES) {
      const code = CODE[race];
      for (const seed of [1, 2, 3]) {
        const g = play(seed, real, person(race, { country: homeOf(real, code) }));
        const life = g.state.life!;
        expect(life.dead?.hAge, `${race} lives to 75`).toBe(75);
        const ex = life.ext.story as { skipped: string[]; fallbackUsed: string[] };
        // every node of the main line either played, was skipped by its own rule, or a fallback stood in
        for (const n of ix.filter((x) => x.line === code && x.kind === 'main')) {
          expect(life.passed[n.id] !== undefined || ex.skipped.includes(n.id), `${n.id} seed ${seed}`).toBe(true);
        }
        // nothing is left waiting, and e2 closes the life (README §6 rule 9)
        expect(life.pending.filter((p) => p.startsWith('cv.'))).toEqual([]);
        expect(life.passed[`${code}.e2`] ?? ex.skipped.includes(`${code}.e2`), `${race} e2`).toBeTruthy();
        const e2 = nodeLog(g).find((e) => e.id === `${code}.e2`);
        if (e2) expect(e2.age!).toBeLessThanOrEqual(74);
        expect(life.memory.length).toBeLessThanOrEqual(8);
        expect(life.memory.length).toBeGreaterThan(0);
      }
    }
  });

  it('e2 of mummy (table age 80+) still comes before the natural death, after e1', () => {
    const g = play(5, real, person('mummy', { hAge: 17, country: homeOf(real, 'mu') }));
    const list = nodeLog(g);
    const e1 = list.findIndex((e) => e.id === 'mu.e1');
    const e2 = list.findIndex((e) => e.id === 'mu.e2');
    expect(e2).toBeGreaterThan(e1);
    expect(list[e2].age!).toBeLessThanOrEqual(74);
  });

  it('a life that dies early never gets e2', () => {
    const killer: System = { name: 'character', beat: (ctx) => { const l = ctx.state.life!; if (l.hAge >= 40 && !l.dead) l.dead = { year: 0, hAge: l.hAge, cause: 'sword' }; } };
    const g = new Game(newGame(3), real, [killer, storySystem]);
    g.state.life = person('human');
    g.born();
    g.runLife();
    expect(g.state.life!.passed['hu.e2']).toBeUndefined();
    expect(g.state.life!.passed['hu.b1']).toBeDefined();
  });

  it('convergences are entered through links and rows, once per life, and counted by the stat', () => {
    let entered = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = play(seed, real, person('human'), (x) => { x.state.world.happened = { 'DR-01': 0, 'WR-14': 0, 'FG-01': 0, 'PO-01': 0, 'MC-04': 0, 'DM-07': 0 }; });
      const cvs = Object.keys(g.state.life!.passed).filter((k) => /^cv\.[1-9]/.test(k));
      expect(new Set(cvs).size).toBe(cvs.length);
      const ctx = makeCtx(g.state, real);
      expect(test(ctx, { k: 'cmp', stat: 'convergence.passed', op: '==', value: cvs.length })).toBe(true);
      entered += cvs.length;
    }
    expect(entered).toBeGreaterThan(20);
  });

  it('a race with a fallback plays it when its convergence is closed, and the convergence when open', () => {
    // darkelf: de.a3 → cv.5 (needs DM-07 or WR-13 or PL-03 and the continent KD)
    const shut = play(4, real, person('darkelf', { country: 'KD-05' }));
    expect(shut.state.life!.passed['de.l1']).toBeDefined();
    const open = play(4, real, person('darkelf', { country: 'KD-05' }), (g) => { g.state.world.happened = { 'DM-07': 0 }; });
    expect(open.state.life!.passed['cv.5']).toBeDefined();
    expect(open.state.life!.passed['de.a3']).toBe(open.state.life!.passed['cv.5']);
    const row = nodeLog(open).find((e) => e.id === 'de.a3')!;
    expect(row.data.cv).toBe('cv.5');
  });

  it('godWindow nodes are written at level 3, others at 1 or 2', () => {
    const g = play(2, real, person('human'));
    const win = (real.storylines.items as StorylinesData).nodes.filter((n) => n.godWindow && n.line === 'hu').map((n) => n.id);
    const logged = nodeLog(g);
    for (const e of logged) {
      if (win.includes(String(e.id))) expect(e.level).toBe(3);
      else expect([1, 2]).toContain(e.level);
    }
    expect(logged.some((e) => e.level === 3)).toBe(true);
  });

  it('effects nobody handles are reported as unhandled and do not break the walk', () => {
    resetRules();
    registerStoryRules();
    const g = play(6, real, person('elf', { country: 'SV-01' }));
    expect(g.state.life!.dead?.hAge).toBe(75);
    const un = g.state.log.filter((e) => e.sys === 'rules' && e.kind === 'unhandled');
    expect(un.length).toBeGreaterThan(0);
    expect(un.map((e) => e.id)).toContain('effect:grant');
    expect(g.state.life!.passed['el.b1']).toBeDefined();
  });
});

function homeOf(data: GameData, line: string): string {
  const o = (data.storylines.items as StorylinesData).origins.find((x) => x.line === line && x.places[0]);
  return o?.places[0] ?? 'AL-01';
}

// ---------- one rule at a time on a tiny storyline ----------

describe('choosing a way', () => {
  const pick = (data: GameData, life: () => LifeState, n: number, key = 'hu.b1') => {
    const got: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let seed = 1; seed <= n; seed++) got[String(play(seed, data, life()).state.life!.passed[key])]++;
    return got;
  };

  it('follows the written weights', () => {
    const data = mini([node('hu.b1', [1, 1], [choice('a', 80), choice('b', 20)])]);
    const got = pick(data, () => person(), 300);
    expect(got.a / 300).toBeGreaterThan(0.72);
    expect(got.a / 300).toBeLessThan(0.88);
    expect(got.c).toBe(0);
  });

  it('a trait multiplies the weight of its way, and an addition adds to it', () => {
    const data = mini([
      node('hu.b1', [1, 1], [choice('a', 50), choice('b', 50, { mods: [{ cond: { k: 'has', kind: 'trait', id: 'freedom' }, mul: 20 }] })]),
      node('hu.b2', [2, 2], [choice('a', 50), choice('b', 50, { mods: [{ cond: { k: 'has', kind: 'trait', id: 'kind' }, mul: 1, add: 400 }] })]),
    ]);
    const plain = pick(data, () => person(), 100);
    const free = pick(data, () => person('human', { traits: ['freedom'] }), 100);
    expect(free.b).toBeGreaterThan(plain.b + 25);
    expect(free.b).toBeGreaterThan(85);
    const kind = pick(data, () => person('human', { traits: ['kind'] }), 100, 'hu.b2');
    expect(kind.b).toBeGreaterThan(85);
  });

  it('a way with a `when` that fails is never taken, and a node with a failing `when` is skipped', () => {
    const data = mini([
      node('hu.b1', [1, 1], [choice('a', 50, { when: { k: 'has', kind: 'trait', id: 'brave' } }), choice('b', 50)]),
      node('hu.b2', [2, 2], [choice('a', 50)], { when: { k: 'event', id: 'DR-01', happened: true } }),
    ]);
    expect(pick(data, () => person(), 60).a).toBe(0);
    expect(pick(data, () => person('human', { traits: ['brave'] }), 200).a).toBeGreaterThan(60);
    const g = play(1, data, person());
    expect(g.state.life!.passed['hu.b2']).toBeUndefined();
    expect((g.state.life!.ext.story as { skipped: string[] }).skipped).toContain('hu.b2');
    const h = play(1, data, person(), (x) => { x.state.world.happened = { 'DR-01': 0 }; });
    expect(h.state.life!.passed['hu.b2']).toBe('a');
  });

  it('choiceMod in the notes of the node changes its own weights when its condition holds', () => {
    const data = mini([node('hu.b1', [1, 1], [choice('a', 50), choice('b', 50)], { notes: [{ k: 'choiceMod', choice: 'b', cond: { k: 'has', kind: 'trait', id: 'hungry' }, mul: 30 }] })]);
    expect(pick(data, () => person('human', { traits: ['hungry'] }), 100).b).toBeGreaterThan(90);
    expect(pick(data, () => person(), 100).b).toBeLessThan(75);
  });

  it('a variant node offers other ways where its condition holds', () => {
    const alt = [choice('a', 0), choice('b', 0), choice('c', 100, { label: 'only here' })];
    const data = mini([node('hu.b1', [1, 1], [choice('a', 50), choice('b', 50)], { notes: [{ k: 'variant', cond: { k: 'country', ids: ['SH-10'] }, text: '', choices: alt }] })]);
    expect(pick(data, () => person('human', { country: 'SH-10' }), 20).c).toBe(20);
    expect(pick(data, () => person(), 20).c).toBe(0);
  });

  it('nodeWeight with a label weighs one side of a later node', () => {
    const data = mini([
      node('hu.b1', [1, 1], [choice('a', 100)], { notes: [{ k: 'nodeWeight', node: 'hu.b2', label: 'quiet', mul: 0.001 }] }),
      node('hu.b2', [2, 2], [choice('a', 50, { label: 'quiet way' }), choice('b', 50, { label: 'loud way' })]),
    ]);
    expect(pick(data, () => person(), 60, 'hu.b2').b).toBeGreaterThan(55);
  });

  it('an outcome run is one weighted split, and the stream is the life.story one', () => {
    const data = mini([node('hu.b1', [1, 1], [choice('a', 100, { effects: [{ k: 'outcome', label: 'win', weight: 70, effects: [{ k: 'label', text: 'win' }, { k: 'stat', stat: 'gold', delta: 5 }] }, { k: 'outcome', label: 'lose', weight: 30, effects: [{ k: 'stat', stat: 'gold', delta: -5 }] }] })])]);
    let up = 0;
    for (let seed = 1; seed <= 100; seed++) up += play(seed, data, person()).state.life!.gold > 0 ? 1 : 0;
    expect(up).toBeGreaterThan(55);
    expect(up).toBeLessThan(85);
  });
});

describe('director', () => {
  const data = mini([node('hu.b1', [1, 1], [choice('a', 50, { effects: [{ k: 'npc', id: 'AL01-1' }] }), choice('b', 50)])]);
  const rate = (director: boolean) => {
    let a = 0;
    const n = 600;
    for (let seed = 1; seed <= n; seed++) {
      const life = person();
      life.ext.story = { ...fresh(), line: 'hu', seen: { npcs: ['AL01-1'], events: [] } };
      const g = new Game(newGame(seed), data, [toy, storySystem]);
      g.state.settings.llm.director = director;
      g.state.life = life;
      g.born();
      g.runLife();
      if (g.state.life!.passed['hu.b1'] === 'a') a++;
    }
    return a / n;
  };

  it('a way that ties back to someone met is weighted ×1.75 when the switch is on, and not when it is off', () => {
    const on = rate(true);
    const off = rate(false);
    expect(off).toBeGreaterThan(0.44);
    expect(off).toBeLessThan(0.56);
    // 50×1.75 against 50: 0.636
    expect(on).toBeGreaterThan(0.58);
    expect(on).toBeLessThan(0.69);
  });

  it('writes whether a fork could tie back and whether the way taken did', () => {
    const life = person();
    life.ext.story = { ...fresh(), line: 'hu', seen: { npcs: ['AL01-1'], events: [] } };
    const g = new Game(newGame(1), data, [toy, storySystem]);
    g.state.life = life;
    g.born();
    g.runLife();
    const e = nodeLog(g)[0];
    expect(e.data.chance).toBe(true);
    expect(e.data.ties).toBe(1);
  });
});

describe('convergence', () => {
  const row = (id: string, to: string[], age: [number, number]) => node(id, age, [], { converge: to, notes: [{ k: 'converge', to: to[0] }] });
  const cv1 = cvPoint('cv.1', { k: 'event', id: 'DR-01', happened: true }, [choice('a', 100, { label: 'cv one' })]);

  it('a row hands over to its convergence when open, to the fallback when not', () => {
    const fb = node('hu.l1', [10, 12], [choice('a', 100, { label: 'fallback' })], { kind: 'fallback', replaces: ['hu.a3'] });
    const data = mini([row('hu.a3', ['cv.1'], [10, 12]), fb], { cv: [cv1] });
    const shut = play(1, data, person());
    expect(shut.state.life!.passed['hu.l1']).toBe('a');
    expect(shut.state.life!.passed['cv.1']).toBeUndefined();
    const open = play(1, data, person(), (g) => { g.state.world.happened = { 'DR-01': 0 }; });
    expect(open.state.life!.passed['cv.1']).toBe('a');
    expect(open.state.life!.passed['hu.l1']).toBeUndefined();
    expect(nodeLog(open).filter((e) => e.id === 'hu.a3').length).toBe(1);
  });

  it('with no fallback of its own the generic table of 00-convergence.md §3 stands in', () => {
    const data = mini([row('hu.a3', ['cv.1'], [10, 12])], { cv: [cv1] });
    const g = play(1, data, person());
    const e = nodeLog(g).find((x) => x.id === 'hu.a3')!;
    expect(e.data.cv).toBe('cv.0');
  });

  it('takes the character to the place of the convergence: the place is not a gate (00-convergence.md §1 "ที่")', () => {
    const far = cvPoint('cv.1', undefined, [choice('a', 100)], { places: ['SH-09'] });
    const data = mini([row('hu.a3', ['cv.1'], [10, 12])], { cv: [far] });
    expect(play(1, data, person('human', { country: 'AL-01', home: 'AL-01' })).state.life!.passed['cv.1']).toBe('a');
    expect(play(1, data, person('human', { country: 'SH-02', home: 'SH-02' })).state.life!.passed['cv.1']).toBe('a');
  });

  it('a way that leads to a convergence that is not open is cut', () => {
    const data = mini([node('hu.a1', [10, 10], [choice('a', 90, { effects: [{ k: 'converge', to: 'cv.1' }] }), choice('b', 10)])], { cv: [cv1] });
    let a = 0;
    for (let seed = 1; seed <= 30; seed++) if (play(seed, data, person()).state.life!.passed['hu.a1'] === 'a') a++;
    expect(a).toBe(0);
    let open = 0;
    for (let seed = 1; seed <= 30; seed++) if (play(seed, data, person(), (g) => { g.state.world.happened = { 'DR-01': 0 }; }).state.life!.passed['hu.a1'] === 'a') open++;
    expect(open).toBeGreaterThan(20);
  });

  it('a link queues the convergence on `life.pending` and it is played a beat later, once', () => {
    const link = { from: 'hu.a1', to: ['cv.1'], toRaw: 'cv.1', condRaw: '', src: '', cond: { k: 'event', id: 'DR-01', happened: true } as Condition };
    const data = mini([node('hu.a1', [10, 10], [choice('a', 100)])], { cv: [cv1], links: [link] });
    const g = new Game(newGame(1), data, [toy, storySystem]);
    g.state.world.happened = { 'DR-01': 0 };
    g.state.life = person('human', { hAge: 9 });
    g.born();
    while (g.state.life!.hAge < 10) g.beat();
    expect(g.state.life!.passed['hu.a1']).toBe('a');
    expect(g.state.life!.pending).toEqual(['cv.1']);
    expect(g.state.life!.passed['cv.1']).toBeUndefined();
    g.beat();
    expect(g.state.life!.pending).toEqual([]);
    expect(g.state.life!.passed['cv.1']).toBe('a');
    g.runLife();
    expect(nodeLog(g).filter((e) => e.id === 'cv.1').length).toBe(1);
  });

  it('entryMod raises a way of the convergence set up by the row', () => {
    const cv = cvPoint('cv.1', undefined, [choice('a', 50), choice('b', 50)]);
    const r = node('hu.a3', [10, 12], [], { converge: ['cv.1'], notes: [{ k: 'converge', to: 'cv.1' }, { k: 'entryMod', choice: 'b', mul: 50 }] });
    const data = mini([r], { cv: [cv] });
    let b = 0;
    for (let seed = 1; seed <= 60; seed++) if (play(seed, data, person()).state.life!.passed['cv.1'] === 'b') b++;
    expect(b).toBeGreaterThan(52);
  });
});

describe('jump', () => {
  const nodes = (extra: Effect[]) => [
    node('hu.t1', [13, 15], [choice('a', 100, { effects: extra })]),
    node('hu.t2', [15, 19], [choice('a', 100)]),
    node('hu.t3', [17, 19], [choice('a', 100)]),
    node('hu.a1', [20, 26], [choice('a', 50), choice('b', 50)]),
  ];

  it('skips the nodes between and lets the target come years early', () => {
    const g = play(1, mini(nodes([{ k: 'jump', to: 'hu.a1', years: 2 }])), person());
    const life = g.state.life!;
    expect(life.passed['hu.t2']).toBeUndefined();
    expect(life.passed['hu.t3']).toBeUndefined();
    const a1 = nodeLog(g).find((e) => e.id === 'hu.a1')!;
    expect(a1.age!).toBeGreaterThanOrEqual(18);
    expect(a1.age!).toBeLessThanOrEqual(26);
    // without the jump all four play
    const plain = play(1, mini(nodes([])), person());
    expect(plain.state.life!.passed['hu.t3']).toBeDefined();
  });

  it('a jump with a named way forces that way on the target', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const g = play(seed, mini(nodes([{ k: 'jump', to: 'hu.a1', choice: 'b' } as unknown as Effect])), person());
      expect(g.state.life!.passed['hu.a1']).toBe('b');
    }
  });

  it('is on `life.pending` until the target plays', () => {
    const g = new Game(newGame(1), mini(nodes([{ k: 'jump', to: 'hu.a1', years: 2 }])), [toy, storySystem]);
    g.state.life = person();
    g.born();
    while (!g.state.life!.passed['hu.t1']) g.beat();
    expect(g.state.life!.pending).toContain('hu.a1');
    g.runLife();
    expect(g.state.life!.pending).not.toContain('hu.a1');
  });
});

describe('effects of the story', () => {
  it('a battle row is one roll and a log entry of kind battle, on its own stream', () => {
    const data = mini([node('hu.b1', [1, 1], [choice('a', 100, { effects: [{ k: 'battle', enemies: ['wolf'] }] })]), node('hu.b2', [2, 2], [choice('a', 100)], { notes: [{ k: 'battleFor', choices: ['b'], enemies: ['goblin'] }] })]);
    const results = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const g = play(seed, data, person());
      const b = g.state.log.filter((e) => e.kind === 'battle');
      expect(b.length).toBe(1); // battleFor names choice b only; the node took a
      expect(b[0].id).toBe('wolf');
      results.add(String(b[0].data.result));
      expect(g.state.rng['life.story.battle']).toBeDefined();
    }
    expect([...results].sort()).toEqual(['flee', 'lose', 'win']);
  });

  it('battleFor fires only for the named way', () => {
    const data = mini([node('hu.b1', [1, 1], [choice('a', 0), choice('b', 100)], { notes: [{ k: 'battleFor', choices: ['b'], enemies: ['goblin'] }] })]);
    expect(play(1, data, person()).state.log.filter((e) => e.kind === 'battle').length).toBe(1);
  });

  it('mood, template and bond are written as log entries of level 1 and the walk goes on', () => {
    const data = mini([node('hu.b1', [1, 1], [choice('a', 100, { effects: [{ k: 'mood', line: 'สหาย', mood: 'คิดถึง', level: 2 }, { k: 'template', kind: 'FT', code: 'FT-03' }, { k: 'bond', line: 'คู่หู', level: 1 }] })])]);
    const g = play(1, data, person());
    const kinds = g.state.log.filter((e) => e.sys === 'story' && ['mood', 'template', 'bond'].includes(e.kind));
    expect(kinds.map((e) => e.kind)).toEqual(['mood', 'template', 'bond']);
    expect(kinds.every((e) => e.level === 1)).toBe(true);
  });

  it('jobpath keeps the job when its need holds, ending keeps its title, place keeps the places', () => {
    const data = mini([node('hu.b1', [1, 1], [choice('a', 100, { effects: [
      { k: 'jobpath', job: 'swordsaint', secret: true, need: { k: 'has', kind: 'trait', id: 'brave' } },
      { k: 'jobpath', job: 'farmer', secret: false },
      { k: 'ending', title: 'the end' },
      { k: 'place', ids: ['AL-19'] },
      { k: 'level', scale: 'B', values: [2] },
      { k: 'check', dc: 12, die: 'd20' },
    ] })])]);
    const ex = play(1, data, person()).state.life!.ext.story as { jobpaths: { job: string }[]; endings: string[]; places: string[]; levels: Record<string, number[]>; checks: unknown[] };
    expect(ex.jobpaths.map((j) => j.job)).toEqual(['farmer']);
    expect(ex.endings).toEqual(['the end']);
    expect(ex.places).toEqual(['AL-19']);
    expect(ex.levels.B).toEqual([2]);
    expect(ex.checks.length).toBe(1);
  });

  it('the node condition reads life.passed, with the way when one is named', () => {
    const ctx = makeCtx(newGame(1), {});
    ctx.state.life = person('human', { passed: { 'el.b2': 'a', 'hu.a1': '-' } });
    expect(test(ctx, { k: 'node', id: 'el.b2' })).toBe(true);
    expect(test(ctx, { k: 'node', id: 'el.b2', choice: 'a' })).toBe(true);
    expect(test(ctx, { k: 'node', id: 'el.b2', choice: 'b' })).toBe(false);
    expect(test(ctx, { k: 'node', id: 'el.b3' })).toBe(false);
  });

  it('keeps only the last eight memory lines', () => {
    const g = play(1, real, person('human'));
    expect(g.state.life!.memory.length).toBe(8);
    const last = nodeLog(g).at(-1)!;
    expect(g.state.life!.memory[7].startsWith(`${last.id} `)).toBe(true);
  });
});

describe('overlay lines', () => {
  it('an overlay opens when its condition holds, by the sim rate, and ec only from outside', () => {
    const lines = (real.storylines.items as StorylinesData).lines;
    expect(lines.find((l) => l.id === 'ec')).toBeDefined();
    let ec = 0;
    let bn = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = play(seed, real, person('human'));
      const open = (g.state.life!.ext.story as { open: Record<string, boolean> }).open;
      if (open.ec) ec++;
      if (open.bn) bn++;
    }
    expect(ec).toBe(0);
    expect(bn).toBeGreaterThan(18);
  });

  it('openLine opens a line the story would not open itself', async () => {
    const { openLine } = await import('../../src/core/story');
    const g = new Game(newGame(2), real, [toy, storySystem]);
    g.state.life = person('human');
    g.born();
    openLine(makeCtx(g.state, real), 'ec');
    g.runLife();
    expect(g.state.life!.passed['ec.b1'] ?? g.state.life!.passed['ec.b2']).toBeDefined();
  });
});
