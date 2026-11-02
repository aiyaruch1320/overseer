import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { Game, makeCtx, type GameData, type System } from '../../src/core/game';
import type { ConvergenceData, Ending, StoryNodeX, StorylinesData } from '../../src/core/data/types-storylines';
import { onCond, onEffect, onStat, resetRules, test } from '../../src/core/rules';
import { newGame } from '../../src/core/state';
import { write } from '../../src/core/log';
import { weigh } from '../../src/core/story/choose';
import { onNode, openLine, registerStoryRules, setPlaceGate, setRuleDirector, storySystem } from '../../src/core/story';
import { fresh, extOf as storyExtOf, yearOf } from '../../src/core/story/state';
import { indexOf as storyIndex } from '../../src/core/story/data';
import { BATTLES_PER_YEAR, CAUSE, EXTERNAL_LINES, JOURNEY_AT_ONCE, JOURNEY_LINES, NODES_PER_YEAR, OPEN_RATE, OVERLAY_AT_ONCE, WAR_ENDINGS, WINDOW_MAX_BEATS } from '../../src/core/story/tuning';
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
  standIns();
}

/**
 * The effects that belong to other systems (combat: `battle` `battleFor`; bonds: `mood` `template` `bond`), answered by a stand-in so that the story is
 * tested alone: a battle is one roll of win, lose or flee, at most BATTLES_PER_YEAR a year and an enemy once a year; the other three are a log entry.
 */
/** The enemies the notes of the node being played name for the way it took (what the combat system reads the same way). */
function notesEnemies(list: readonly Effect[], key: string, out: Set<string> = new Set()): Set<string> {
  for (const e of list) {
    if (e.k === 'battleFor' && e.choices.includes(key as 'a')) e.enemies.forEach((x) => out.add(x));
    else if (e.k === 'battle') e.enemies.forEach((x) => out.add(x));
    else if (e.k === 'if' || e.k === 'only' || e.k === 'chance') notesEnemies(e.then, key, out);
    else if (e.k === 'pick') e.of.forEach((b) => notesEnemies(b.effects, key, out));
  }
  return out;
}

function standIns() {
  const fight = (ctx: Parameters<Parameters<typeof onEffect>[1]>[0], enemiesIn: readonly string[], src: { id?: string }, text?: string) => {
    const l = ctx.state.life!;
    const ex = storyExtOf(l);
    let enemies = enemiesIn;
    if (!enemies.length) {
      const node = src.id ? storyIndex(ctx).nodes.get(src.id) : undefined;
      const cur = ex.cur;
      enemies = node && cur && cur.id === node.id && cur.choice !== '-' ? [...notesEnemies(node.notes, cur.choice)] : [];
      if (!enemies.length) return void write(ctx.state, { sys: 'story', kind: 'battleSkip', id: src.id, data: { why: 'none', text: text ?? null }, level: 0 });
    }
    const year = yearOf(ex, l);
    const fresh = enemies.filter((e) => !year.fought.includes(e));
    if (!fresh.length || year.battles >= BATTLES_PER_YEAR) return;
    year.battles++;
    year.fought.push(...fresh);
    const i = ctx.rng('life.story.battle').weighted([0.6, 0.25, 0.15]);
    const result = i === 0 ? 'win' : i === 1 ? 'lose' : 'flee';
    ex.battles[result]++;
    write(ctx.state, { sys: 'story', kind: 'battle', id: fresh.join(','), data: { result, enemies: fresh.join(','), node: src.id ?? null, text: text ?? null }, level: 2 });
  };
  onEffect('battle', (ctx, e, src) => fight(ctx, e.enemies, src, e.text));
  onEffect('battleFor', (ctx, e, src) => {
    const cur = storyExtOf(ctx.state.life!).cur;
    if (cur && cur.choice !== '-' && e.choices.includes(cur.choice)) fight(ctx, e.enemies, src, e.role);
  });
  onEffect('mood', (ctx, e, src) => write(ctx.state, { sys: 'story', kind: 'mood', id: e.line, data: { mood: e.mood, node: src.id ?? null }, level: 1 }));
  onEffect('template', (ctx, e, src) => write(ctx.state, { sys: 'story', kind: 'template', id: e.code, data: { node: src.id ?? null }, level: 1 }));
  onEffect('bond', (ctx, e, src) => write(ctx.state, { sys: 'story', kind: 'bond', id: e.line, data: { node: src.id ?? null }, level: 1 }));
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

  it('a godWindow node is announced (story/window, level 3) a beat before it is decided; the other nodes are written at level 1 or 2', () => {
    const g = play(2, real, person('human'));
    const win = (real.storylines.items as StorylinesData).nodes.filter((n) => n.godWindow && n.line === 'hu').map((n) => n.id);
    const logged = nodeLog(g);
    const announced = g.state.log.filter((e) => e.sys === 'story' && e.kind === 'window');
    for (const e of logged) expect([1, 2]).toContain(e.level);
    expect(announced.length).toBeGreaterThan(0);
    for (const w of announced) {
      expect(w.level).toBe(3);
      expect(win).toContain(String(w.id));
      expect(w.data.ways).toBeTruthy();
      // the announcement comes before the node it announces, and the node is decided later
      const played = logged.find((e) => e.id === w.id);
      expect(played, `${w.id} played`).toBeDefined();
      expect(played!.n).toBeGreaterThan(w.n);
    }
    for (const e of logged.filter((x) => win.includes(String(x.id)))) expect(announced.some((w) => w.id === e.id)).toBe(true);
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

describe('the director: two layers, two switches', () => {
  /** A fork of two ways, `a` ties back to someone met; the life has met AL01-1. */
  const fork = () => {
    const data = mini([node('hu.b1', [1, 1], [choice('a', 50, { effects: [{ k: 'npc', id: 'AL01-1' }] }), choice('b', 50)])]);
    const g = new Game(newGame(1), data, [toy, storySystem]);
    const life = person();
    life.ext.story = { ...fresh(), line: 'hu', seen: { npcs: ['AL01-1'], events: [] } };
    g.state.life = life;
    const choices = (data.storylines!.items as StorylinesData).nodes[0].choices;
    const no = { choice: [], entry: [], label: [] };
    const ex = storyExtOf(life);
    const w = (point?: string) => weigh(g.ctx, choices, no, ex, () => false, point).weights;
    const offer = (pick: string, id = 'p1') => {
      g.state.llmAnswers[`director.asked:L1:${id}`] = '1';
      g.state.llmAnswers[`director.offer:L1:${id}`] = JSON.stringify({ pick, reason: 'old_face' });
    };
    return { g, w, offer };
  };

  it('the rule-based director does not depend on the switch of the LLM layer or on the master', () => {
    const { g, w } = fork();
    expect(w()).toEqual([87.5, 50]);
    g.state.settings.llm.director = false;
    expect(w('p1')).toEqual([87.5, 50]);
    (g.state.settings.llm as { master?: boolean }).master = false;
    expect(w('p1')).toEqual([87.5, 50]);
  });

  it('without a question to the LLM the point leaves no trace in the save', () => {
    const { g, w } = fork();
    w('p1');
    expect(g.state.llmAnswers).toEqual({});
    expect(g.state.log).toHaveLength(0);
  });

  it('the LLM layer lifts the way it chose ×1.5, together with the rule-based layer at most ×2.5, and the answer is frozen at the first read', () => {
    const { g, w, offer } = fork();
    offer('b');
    // b is not tied: 50 × 1.5; a keeps the rule-based 87.5
    expect(w('p1')).toEqual([87.5, 75]);
    expect(g.state.llmAnswers['director:L1:p1']).toContain('"pick":"b"');
    expect(g.state.log.filter((e) => e.sys === 'llm' && e.kind === 'director')).toHaveLength(1);
    // a point with no id (a preview) is not touched by the LLM layer
    expect(w()).toEqual([87.5, 50]);
    // the pick on the tied way: 50 × min(2.5, 1.75 × 1.5)
    const second = fork();
    second.offer('a', 'p2');
    expect(second.w('p2')).toEqual([125, 50]);
  });

  it('the player switch (and the master) turn the LLM layer off, and what was frozen stays frozen', () => {
    const off = fork();
    off.offer('b');
    off.g.state.settings.llm.director = false;
    expect(off.w('p1')).toEqual([87.5, 50]);
    expect(off.g.state.llmAnswers['director:L1:p1']).toBe('none');
    off.g.state.settings.llm.director = true;
    expect(off.w('p1')).toEqual([87.5, 50]);
    const master = fork();
    master.offer('b');
    (master.g.state.settings.llm as { master?: boolean }).master = false;
    expect(master.w('p1')).toEqual([87.5, 50]);
  });

  it('a pick that is not one of the two best ways is ignored', () => {
    const { g, w, offer } = fork();
    offer('c');
    expect(w('p1')).toEqual([87.5, 50]);
    expect(g.state.llmAnswers['director:L1:p1']).toBe('none');
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
      setRuleDirector(director);
      g.state.life = life;
      g.born();
      g.runLife();
      if (g.state.life!.passed['hu.b1'] === 'a') a++;
    }
    setRuleDirector(true);
    return a / n;
  };

  it('a way that ties back to someone met is weighted ×1.75 by the rule-based director, and not when the layer is taken out (a test hook)', () => {
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

  it('openLine opens a line the story would not open itself', () => {
    const g = new Game(newGame(2), real, [toy, storySystem]);
    g.state.life = person('human');
    g.born();
    openLine(makeCtx(g.state, real), 'ec');
    g.runLife();
    expect(g.state.life!.passed['ec.b1'] ?? g.state.life!.passed['ec.b2']).toBeDefined();
  });
});

// ---------- M1 review: the ending, the way a life ends, the pace of a year ----------

/** The kills of the character system, as the story asks for them: a `death` effect ends the life at once with its cause and the node. */
function mockDeath() {
  onEffect('death', (c, e, src) => {
    const l = c.state.life!;
    if (!l.dead) l.dead = { year: c.state.clock.worldYear, hAge: l.hAge, cause: e.cause ?? 'story', ...(src.sys === 'story' && src.id ? { node: src.id } : {}) };
  });
}

const ending = (title: string, cond?: Condition): Ending => ({ line: 'hu', title, condRaw: '', ...(cond ? { cond } : {}), nodes: [], events: [], legend: '', src: '' });
const endingLog = (g: Game) => g.state.log.filter((e) => e.sys === 'story' && e.kind === 'ending');
const battleLog = (g: Game) => g.state.log.filter((e) => e.sys === 'story' && e.kind === 'battle');

/** A set of nodes for the line `hu` with the rites the closing node needs to be known as a race line's. */
function closing(nodes: StoryNodeX[], endings: Ending[] = []): GameData {
  const data = mini(nodes);
  const sl = data.storylines.items as StorylinesData;
  sl.endings = endings;
  sl.rites = [{ id: 'hu.t1', line: 'hu', title: '', intro: '', header: [], form: 'outcomes', outcomes: [], src: '' }];
  return data;
}

describe('the ending of a life', () => {
  beforeEach(mockDeath);

  it('a life earns several endings and is told one at its death, never before', () => {
    const data = closing([
      node('hu.a1', [20, 20], [choice('a', 100, { effects: [{ k: 'ending', title: 'first' }] })]),
      node('hu.a2', [30, 30], [choice('a', 100, { effects: [{ k: 'ending', title: 'second' }] })]),
      node('hu.a3', [40, 40], [choice('a', 100, { effects: [{ k: 'ending', title: 'never', cond: { k: 'event', id: 'WR-99', happened: true } }] })]),
    ]);
    for (let seed = 1; seed <= 12; seed++) {
      mocks();
      mockDeath();
      const g = play(seed, data, person());
      const ex = g.state.life!.ext.story as { endings: string[]; ended: string };
      expect(ex.endings).toEqual(['first', 'second']);
      const log = endingLog(g);
      expect(log.length).toBe(1);
      expect(['first', 'second']).toContain(log[0].id);
      expect(log[0].id).toBe(ex.ended);
      // after the death entry of the game, none before
      const death = g.state.log.findIndex((e) => e.kind === 'death');
      expect(g.state.log.indexOf(log[0])).toBeGreaterThan(death);
    }
    // both can win, by weight (assumption: a draw between the two)
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      mocks();
      mockDeath();
      seen.add(String(endingLog(play(seed, data, person()))[0].id));
    }
    expect(seen.size).toBe(2);
  });

  it('the condition of the table gives an ending too, and the one of the life\'s own race line weighs more than a harder one of another line', () => {
    const data = closing([node('hu.a1', [20, 20], [choice('a', 100)])], [ending('from the table', { k: 'node', id: 'hu.a1' })]);
    const g = play(1, data, person());
    expect(endingLog(g).map((e) => e.id)).toEqual(['from the table']);
  });

  it('an ending that is a death in battle needs a death in battle', () => {
    const data = closing([node('hu.a1', [20, 20], [choice('a', 100)])], [ending('ผู้ตายในสงคราม', { k: 'node', id: 'hu.a1' }), ending('คนธรรมดาที่รอด')]);
    // a long life: the war ending is not told, and the plain one is (no convergence, died of age)
    const old = play(1, data, person());
    expect(old.state.life!.dead!.cause).toBe('old');
    expect(endingLog(old).map((e) => e.id)).toEqual(['คนธรรมดาที่รอด']);
    // the same life ends in battle: the war ending is the one
    mocks();
    mockDeath();
    const war = closing([node('hu.a1', [20, 20], [choice('a', 100)]), node('hu.a2', [40, 40], [choice('a', 100, { effects: [{ k: 'death', cause: CAUSE.battle }] })])], [ending('ผู้ตายในสงคราม', { k: 'node', id: 'hu.a1' })]);
    const g = play(1, war, person());
    expect(g.state.life!.dead!.cause).toBe(CAUSE.battle);
    expect(endingLog(g).map((e) => e.id)).toEqual(['ผู้ตายในสงคราม']);
  });

  it('the plain ending is for a life that never met a convergence', () => {
    const data = closing([node('hu.a1', [20, 20], [choice('a', 100)])], [ending('คนธรรมดาที่รอด')]);
    const g = play(1, data, person('human', { passed: { 'cv.3': 'a' } }));
    expect(endingLog(g)).toEqual([]);
  });

  it('on the real data no life is told more than one ending, and a war ending only after a death in battle', () => {
    for (const race of RACES) {
      for (const seed of [1, 2, 3, 4]) {
        mocks();
        mockDeath();
        const g = play(seed, real, person(race, { country: homeOf(real, CODE[race]) }));
        const log = endingLog(g);
        expect(log.length, `${race} ${seed}`).toBeLessThanOrEqual(1);
        if (log[0] && WAR_ENDINGS.has(String(log[0].id))) expect(g.state.life!.dead!.cause).toBe(CAUSE.battle);
      }
    }
  });
});

describe('a way that says the character dies', () => {
  beforeEach(mockDeath);

  it('the closing node comes in the last life year and a way of it ends the life with its cause', () => {
    const nodes = (key: 'a' | 'b'): StoryNodeX[] => [
      node('hu.e1', [55, 65], [choice('a', 100)]),
      node('hu.e2', [65, 999], [choice('a', key === 'a' ? 100 : 0), choice('b', key === 'b' ? 100 : 0), choice('c', 0)]),
    ];
    const peace = play(1, closing(nodes('a')), person());
    expect(peace.state.life!.dead).toMatchObject({ cause: 'old', node: 'hu.e2', hAge: 74 });
    expect(nodeLog(peace).at(-1)!.id).toBe('hu.e2');
    // hu.e2 ทาง ข "โรคหรืออุบัติเหตุ": illness or accident, never old age
    const sick = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      mocks();
      mockDeath();
      sick.add(play(seed, closing(nodes('b')), person()).state.life!.dead!.cause);
    }
    expect([...sick].sort()).toEqual(['accident', 'illness']);
  });

  it('the way that goes on to the last era (c) does not kill: the natural death comes after', () => {
    const data = closing([node('hu.e2', [65, 999], [choice('a', 0), choice('b', 0), choice('c', 100)])]);
    const g = play(1, data, person());
    expect(g.state.life!.passed['hu.e2']).toBe('c');
    expect(g.state.life!.dead).toMatchObject({ cause: 'old', hAge: 75 });
    expect(g.state.life!.dead!.node).toBeUndefined();
  });

  it('the hidden death age moves the last year: a short life closes before it', () => {
    const g = play(1, closing([node('hu.e1', [55, 65], [choice('a', 100)]), node('hu.e2', [65, 999], [choice('a', 100)])]), person('human', { ext: { character: { deathAge: 60 } } }));
    expect(g.state.life!.dead).toMatchObject({ node: 'hu.e2', hAge: 59 });
    expect(nodeLog(g).map((e) => e.id)).toEqual(['hu.e1', 'hu.e2']);
  });

  it('the listed ways: dying in battle, in the light, of violence', () => {
    const cases: [string, 'a' | 'b', string][] = [
      ['or', 'a', CAUSE.battle],
      ['gi', 'b', CAUSE.battle],
      ['va', 'b', CAUSE.light],
      ['de', 'b', 'violence'],
      ['dw', 'b', 'accident'],
      ['mu', 'a', 'old'],
    ];
    for (const [line, key, cause] of cases) {
      mocks();
      mockDeath();
      const id = `${line}.e2`;
      const data = closing([node(id, [65, 999], [choice('a', key === 'a' ? 100 : 0), choice('b', key === 'b' ? 100 : 0), choice('c', 0)])]);
      (data.storylines.items as StorylinesData).rites = [{ id: `${line}.t1`, line, title: '', intro: '', header: [], form: 'outcomes', outcomes: [], src: '' }];
      (data.storylines.items as StorylinesData).lines.push({ id: line, name: line, file: '', nodeIds: [id] });
      const race = Object.entries(CODE).find(([, c]) => c === line)![0];
      const g = play(1, data, person(race));
      expect(g.state.life!.dead, id).toMatchObject({ cause, node: id });
    }
  });

  it('a rite outcome that turns the character to stone ends the life at once, and the log names the outcome', () => {
    const data = mini([node('na.t1', [15, 15], [], { rite: 'na.t1' })]);
    (data.storylines.items as StorylinesData).rites = [{
      id: 'na.t1', line: 'na', title: '', intro: '', header: [], form: 'outcomes', src: '',
      outcomes: [
        { label: 'ผ่าน', weight: 0, mods: [], effects: [], text: 'สิทธิ์เข้าวังใต้น้ำ' },
        { label: 'ไม่ผ่าน กลายเป็นหิน', weight: 100, mods: [], effects: [], text: 'ปลายทางทันที' },
      ],
    }];
    (data.storylines.items as StorylinesData).lines.push({ id: 'na', name: 'นาคา', file: '', nodeIds: ['na.t1'] });
    const g = play(1, data, person('naga'));
    expect(g.state.life!.dead).toMatchObject({ cause: CAUSE.stone, hAge: 15, node: 'na.t1' });
    const e = nodeLog(g)[0];
    expect(e.data).toMatchObject({ rite: 'na.t1', variant: 'ไม่ผ่าน กลายเป็นหิน', text: 'ปลายทางทันที', label: 'ไม่ผ่าน กลายเป็นหิน' });
  });

  it('a rite of sub-lines keeps the sub-line and how it went; a convergence keeps the way it took', () => {
    const data = mini([node('hu.t1', [15, 15], [], { rite: 'hu.t1' })], { cv: [cvPoint('cv.1', undefined, [choice('a', 100, { label: 'sit with them' })])], links: [{ from: 'hu.t1', to: ['cv.1'], toRaw: '', condRaw: '', src: '' }] });
    (data.storylines.items as StorylinesData).rites = [{
      id: 'hu.t1', line: 'hu', title: '', intro: '', header: [], form: 'variants', src: '',
      outcomes: [{ label: 'ทุ่งราบ', weight: null, mods: [], effects: [], text: '', pass: { text: 'ผ่านด้วยดาบ', effects: [] }, fail: { text: 'แพ้', effects: [] } }],
    }];
    const g = play(1, data, person());
    const rite = nodeLog(g).find((e) => e.id === 'hu.t1')!;
    expect(rite.data).toMatchObject({ rite: 'hu.t1', variant: 'ทุ่งราบ' });
    expect(['pass', 'fail']).toContain(rite.data.result);
    const cv = nodeLog(g).find((e) => e.id === 'cv.1')!;
    expect(cv.data).toMatchObject({ choice: 'a', label: 'sit with them' });
  });
});

describe('the pace of a year', () => {
  beforeEach(mockDeath);

  it('a year holds NODES_PER_YEAR nodes; the rest wait for the next year', () => {
    const data = mini(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((n) => node(`hu.${n}`, [20, 22], [choice('a', 100)])));
    for (const seed of [1, 2, 3, 4, 5]) {
      mocks();
      mockDeath();
      const g = play(seed, data, person());
      const per = new Map<number, number>();
      for (const e of nodeLog(g)) per.set(e.age!, (per.get(e.age!) ?? 0) + 1);
      expect(nodeLog(g).length, `seed ${seed}`).toBe(6);
      expect(Math.max(...per.values()), `seed ${seed}`).toBeLessThanOrEqual(NODES_PER_YEAR);
    }
  });

  it('a closing node is not delayed by a full year', () => {
    const data = closing([...['a1', 'a2', 'a3'].map((n) => node(`hu.${n}`, [74, 74], [choice('a', 100)])), node('hu.e2', [65, 999], [choice('a', 100)])]);
    const g = play(1, data, person());
    expect(nodeLog(g).at(-1)!.id).toBe('hu.e2');
    expect(g.state.life!.dead!.node).toBe('hu.e2');
  });

  it('an enemy is fought once a year, the notes of the node and the way it chose together', () => {
    const data = mini([node('hu.a1', [20, 20], [choice('a', 100, { effects: [{ k: 'battle', enemies: ['wolf', 'goblin'] }] })], { notes: [{ k: 'battle', enemies: ['wolf'] }, { k: 'battle', enemies: ['wolf', 'bandits'] }] })]);
    const g = play(1, data, person());
    expect(battleLog(g).map((e) => e.data.enemies)).toEqual(['wolf,goblin', 'bandits']);
    expect((g.state.life!.ext.story as { battles: Record<string, number> }).battles).toBeDefined();
  });

  it('a battle with no enemy is the battle the notes name for that way (one battle, not two); with none named it does not happen', () => {
    const pv = mini([node('hu.a1', [20, 20], [choice('a', 0), choice('b', 0), choice('c', 100, { effects: [{ k: 'battle', enemies: [], text: 'ศึกสุ่มหนึ่งครั้งต่อปี' }] })], { notes: [{ k: 'battleFor', choices: ['c'], enemies: ['wolf'], role: 'x' }] })]);
    const g = play(1, pv, person());
    expect(battleLog(g).map((e) => e.data.enemies)).toEqual(['wolf']);
    const bare = mini([node('hu.a1', [20, 20], [choice('a', 100, { effects: [{ k: 'battle', enemies: [], text: 'ศึกสุ่ม' }] })])]);
    const h = play(1, bare, person());
    expect(battleLog(h)).toEqual([]);
    expect(h.state.log.filter((e) => e.kind === 'battleSkip').length).toBe(1);
  });

  it('a year holds BATTLES_PER_YEAR battles at most', () => {
    const enemies = ['wolf', 'goblin', 'bandits', 'troll', 'ogre', 'bat'];
    const data = mini([node('hu.a1', [20, 20], [choice('a', 100, { effects: enemies.map((e): Effect => ({ k: 'battle', enemies: [e] })) })])]);
    const g = play(1, data, person());
    expect(battleLog(g).length).toBe(BATTLES_PER_YEAR);
    // the next year the count starts again
    const two = mini([node('hu.a1', [20, 20], [choice('a', 100, { effects: enemies.slice(0, 4).map((e): Effect => ({ k: 'battle', enemies: [e] })) })]), node('hu.a2', [21, 21], [choice('a', 100, { effects: [{ k: 'battle', enemies: ['ogre'] }] })])]);
    expect(battleLog(play(1, two, person())).length).toBe(5);
  });

  it('one journey line at a time: the second opens when the first is done', () => {
    const data = mini([]);
    const sl = data.storylines.items as StorylinesData;
    const mk = (line: string, ages: number[]) => ages.map((a, i) => node(`${line}.a${i + 1}`, [a, a], [choice('a', 100)], { line, kind: 'overlay' }));
    sl.nodes = [...mk('sf', [20, 24, 28]), ...mk('ps', [20, 22, 26])];
    sl.lines.push({ id: 'sf', name: 'sf', file: '', nodeIds: [] }, { id: 'ps', name: 'ps', file: '', nodeIds: [] });
    const g = play(1, data, person(), (game) => {
      openLine(makeCtx(game.state, data), 'sf');
      openLine(makeCtx(game.state, data), 'ps');
    });
    const at = (line: string) => nodeLog(g).filter((e) => String(e.id).startsWith(`${line}.`)).map((e) => e.age!);
    expect(at('sf').length).toBe(3);
    expect(at('ps').length).toBe(3);
    // the second line opens in the year the first is done, after its last node was played
    expect(Math.min(...at('ps'))).toBeGreaterThanOrEqual(Math.max(...at('sf')));
    expect(at('ps')).not.toEqual(at('sf'));
  });

  it('on the real data lines opened by chance are walked OVERLAY_AT_ONCE at a time at most, and the journey lines one at a time', () => {
    // every job counts, so the lines of jobs open as in the sim (tests/balance/story.test.ts)
    const OPEN = Object.keys(OPEN_RATE);
    let widest = 0;
    let journeys = 0;
    for (let seed = 1; seed <= 120; seed++) {
      resetRules();
      registerStoryRules();
      mockDeath();
      const life = (c: { state: { life: LifeState | null } }) => c.state.life!;
      onCond('has', (c, x) => x.kind === 'job' || [...life(c).traits, ...life(c).blessings, ...life(c).curses, ...life(c).skills].includes(x.id));
      onCond('event', () => true);
      onCond('country', (c, x) => x.ids.includes(life(c).country));
      onCond('continent', (c, x) => x.ids.includes(life(c).country.slice(0, 2) as never));
      onCond('race', (c, x) => x.ids.includes(CODE[life(c).race] ?? life(c).race));
      onCond('era', (c, x) => c.state.world.era >= x.min);
      onCond('half', () => false);
      onCond('class', () => true);
      onCond('bond', () => true);
      onCond('age', (c, x) => life(c).hAge >= (x.min ?? 0) && life(c).hAge <= (x.max ?? 999));
      onCond('place', () => false);
      onStat('gold', { read: (c) => life(c).gold });
      onStat('int', { read: (c) => life(c).stats.int });
      onStat('travel.countries', { read: () => 1 });
      const race = RACES[seed % RACES.length];
      const g = play(seed, real, person(race, { country: homeOf(real, CODE[race]) }));
      const span = new Map<string, [number, number]>();
      for (const e of nodeLog(g)) {
        const line = String(e.data.line);
        if (!OPEN.includes(line)) continue;
        const s = span.get(line);
        span.set(line, s ? [Math.min(s[0], e.age!), Math.max(s[1], e.age!)] : [e.age!, e.age!]);
      }
      for (let age = 0; age <= 80; age++) {
        // a line is walked from its first node to the year of its last (the year its last node plays it is done)
        const now = [...span].filter(([, [a, b]]) => a <= age && age < b);
        widest = Math.max(widest, now.length);
        // the year a journey ends is the year the next one may open
        const j = now.filter(([l]) => JOURNEY_LINES.has(l));
        if (j.length > JOURNEY_AT_ONCE) journeys++;
      }
    }
    expect(widest).toBeLessThanOrEqual(OVERLAY_AT_ONCE);
    expect(journeys).toBe(0);
    expect(widest).toBeGreaterThanOrEqual(2);
  });
});

describe('the memory of the director', () => {
  it('keeps the turning points the life chose, and a way that follows one ties back to it', () => {
    const data = mini([
      node('hu.a1', [20, 20], [choice('a', 100, { effects: [{ k: 'jobpath', job: 'kingmaker', secret: false }, { k: 'bond', line: 'คู่หู' }] })]),
      node('hu.a2', [30, 30], [choice('a', 50, { effects: [{ k: 'jobpath', job: 'kingmaker', secret: false }] }), choice('b', 50, { effects: [{ k: 'grant', kind: 'trait', id: 'brave' }] })]),
      node('hu.a3', [40, 40], [choice('a', 50, { effects: [{ k: 'ref', nodes: ['hu.a1'], rel: 'ตรงกับ' }] }), choice('b', 50)]),
    ]);
    const g = play(1, data, person());
    const ex = g.state.life!.ext.story as { seen: { pivots: string[] } };
    expect(ex.seen.pivots).toEqual(expect.arrayContaining(['job:kingmaker', 'bond:คู่หู']));
    const a2 = nodeLog(g).find((e) => e.id === 'hu.a2')!;
    expect(a2.data.ties).toBe(1);
    const a3 = nodeLog(g).find((e) => e.id === 'hu.a3')!;
    expect(a3.data.ties).toBe(1);
  });

  it('the pivots lift the odds of a way that ties back when the director is on, by the same factor as for a person met again', () => {
    const data = mini([
      node('hu.a1', [20, 20], [choice('a', 100, { effects: [{ k: 'jobpath', job: 'kingmaker', secret: false }] })]),
      node('hu.a2', [30, 30], [choice('a', 50, { effects: [{ k: 'jobpath', job: 'kingmaker', secret: false }] }), choice('b', 50)]),
    ]);
    const count = (on: boolean) => {
      let a = 0;
      for (let seed = 1; seed <= 400; seed++) {
        mocks();
        setRuleDirector(on);
        const g = play(seed, data, person());
        setRuleDirector(true);
        if (g.state.life!.passed['hu.a2'] === 'a') a++;
      }
      return a / 400;
    };
    const off = count(false);
    const on = count(true);
    expect(off).toBeGreaterThan(0.43);
    expect(off).toBeLessThan(0.57);
    // 1.75 / (1.75 + 1) = 0.636
    expect(on).toBeGreaterThan(0.58);
    expect(on).toBeLessThan(0.69);
  });
});

// ---------- M2 review G1 G3: the god window is announced, the god's lines wait for the god ----------

describe('a god window is announced a beat before it is decided', () => {
  beforeEach(mockDeath);
  const windowed = () => mini([node('hu.a1', [20, 20], [choice('a', 50), choice('b', 50)], { godWindow: { what: 'a dream', effect: 'x' } }), node('hu.a2', [20, 20], [choice('a', 100)])]);
  const announces = (g: Game) => g.state.log.filter((e) => e.sys === 'story' && e.kind === 'window');
  const start = (data: GameData, patch: Partial<LifeState> = {}): Game => {
    const g = new Game(newGame(1), data, [toy, storySystem]);
    g.state.life = person('human', patch);
    g.born();
    return g;
  };
  const beatsToWindow = (g: Game): void => {
    for (let i = 0; i < 400 && !announces(g).length; i++) g.beat();
  };

  it('the node is written as a window at the year step, the ways are not chosen until the next beat, and the line waits with it', () => {
    const g = start(windowed());
    beatsToWindow(g);
    const life = g.state.life!;
    expect(life.hAge).toBe(20);
    const w = announces(g)[0];
    expect(w).toMatchObject({ id: 'hu.a1', level: 3 });
    expect(String(w.data.ways)).toContain('way a');
    expect(life.passed['hu.a1']).toBeUndefined();
    expect(life.passed['hu.a2']).toBeUndefined(); // behind it in the line
    g.beat();
    expect(life.passed['hu.a1']).toBeDefined();
    expect(nodeLog(g).find((e) => e.id === 'hu.a1')!.level).toBe(2);
    expect(nodeLog(g).find((e) => e.id === 'hu.a1')!.n).toBeGreaterThan(w.n);
  });

  it('with the attention system, the node waits for its answer (a call or a glow naming it) and no longer than WINDOW_MAX_BEATS', () => {
    const g = start(windowed(), { ext: { attention: {} } });
    beatsToWindow(g);
    const life = g.state.life!;
    for (let i = 0; i < 4; i++) g.beat();
    expect(life.passed['hu.a1']).toBeUndefined();
    write(g.state, { sys: 'attention', kind: 'glow', id: 'hu.a1', level: 1, data: { why: 'gap' } });
    g.beat();
    expect(life.passed['hu.a1']).toBeDefined();
    // never answered: decided after the longest wait
    const h = start(windowed(), { ext: { attention: {} } });
    beatsToWindow(h);
    let beats = 0;
    while (h.state.life!.passed['hu.a1'] === undefined && beats < 40) (h.beat(), beats++);
    expect(beats).toBe(WINDOW_MAX_BEATS);
  });

  it('the hooks of the god are told before the ways are weighed and after the way is taken', () => {
    const told: string[] = [];
    const off = onNode({ before: (_c, _n, id) => void told.push(`before ${id}`), after: (_c, _n, id, key) => void told.push(`after ${id} ${key}`) });
    try {
      const g = start(windowed());
      g.runLife();
      expect(told.filter((t) => t.includes('hu.a1'))).toEqual(['before hu.a1', expect.stringMatching(/^after hu\.a1 [ab]$/)]);
    } finally {
      off();
    }
  });
});

describe('the lines that read what the god did', () => {
  beforeEach(mockDeath);
  const god = () => {
    const data = mini([node('hu.a1', [1, 1], [choice('a', 100)])]);
    const sl = data.storylines.items as StorylinesData;
    sl.lines.push({ id: 'dp', name: 'dp', file: '', nodeIds: [] });
    sl.nodes.push(
      node('dp.t1', [13, 19], [choice('a', 100)], { line: 'dp', kind: 'overlay', when: { k: 'has', kind: 'unknown', id: 'f1' } }),
      node('dp.a1', [20, 54], [choice('a', 100)], { line: 'dp', kind: 'overlay', when: { k: 'has', kind: 'unknown', id: 'f3' } }),
    );
    return data;
  };
  const start = (): Game => {
    const g = new Game(newGame(1), god(), [toy, storySystem]);
    g.state.life = person();
    g.born();
    return g;
  };
  const until = (g: Game, age: number) => {
    while (!g.state.life!.dead && g.state.life!.hAge < age) g.beat();
  };

  it('a node plays the year its condition holds and is skipped once its age window is over', () => {
    const g = start();
    g.state.god.chronicle.push({ worldYear: 0, kind: 'dream', id: 'x' });
    until(g, 24);
    // the first node's condition never held in 13 to 19: it is skipped as late; the second has not met its condition yet
    expect(g.state.life!.passed['dp.t1']).toBeUndefined();
    expect(g.state.log.some((e) => e.sys === 'story' && e.kind === 'skip' && e.id === 'dp.t1' && e.data.why === 'late')).toBe(true);
    expect(g.state.life!.passed['dp.a1']).toBeUndefined();
    g.state.life!.traits.push('f3'); // the test's `has` reads traits
    until(g, 26);
    expect(g.state.life!.passed['dp.a1']).toBe('a');
  });

  it('a line that waits for the god opens again each year until the god has acted (no draw, no shut door)', () => {
    const g = start();
    until(g, 22);
    expect((g.state.life!.ext.story as { open: Record<string, boolean> }).open.dp).toBeUndefined();
    g.state.god.chronicle.push({ worldYear: 0, kind: 'dream', id: 'x' });
    g.state.life!.traits.push('f3');
    until(g, 25);
    expect(g.state.life!.passed['dp.a1']).toBe('a');
  });
});

describe('lines and places that belong to other systems', () => {
  it('the journey lines, the bondage lines and the economy line have no rate of their own: they open only through openLine', () => {
    for (const l of ['sf', 'ps', 'ml', 'sc', 'ex', 'wd', 'xc', 'bd', 'bo', 'ab', 'ec']) {
      expect(EXTERNAL_LINES.has(l), l).toBe(true);
      expect(OPEN_RATE[l], l).toBeUndefined();
    }
  });

  it('a way that names a country the travel filters shut is weighed down, not cut', () => {
    const data = mini([node('hu.b1', [10, 10], [choice('a', 50), choice('b', 50, { effects: [{ k: 'place', ids: ['AL-02'] }] })])]);
    const share = () => {
      let b = 0;
      for (let seed = 1; seed <= 200; seed++) if (play(seed, data, person()).state.life!.passed['hu.b1'] === 'b') b++;
      return b / 200;
    };
    mocks();
    const open = share();
    setPlaceGate(() => false);
    try {
      const shut = share();
      expect(open).toBeGreaterThan(0.4);
      expect(shut).toBeGreaterThan(0.05);
      expect(shut).toBeLessThan(0.3);
    } finally {
      setPlaceGate(null);
    }
    setPlaceGate(() => true);
    try {
      expect(share()).toBeGreaterThan(0.4);
    } finally {
      setPlaceGate(null);
    }
  });
});
