// The world system (code-plan §7, M1): determinism, stream isolation, the rules it registers, closed events stay closed.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Game, makeCtx, type GameData, type System } from '../../src/core/game';
import { apply, registered, test } from '../../src/core/rules';
import { newGame } from '../../src/core/state';
import type { Condition, Effect, GameState } from '../../src/core/types';
import type { WorldEventsData } from '../../src/core/data/types-events';
import { applyEvent, expireWarFlags } from '../../src/core/world/events';
import { releaseOmens } from '../../src/core/world/core';
import { openByGod, fallDragon, holdEvent, worldSystem, weightOf, addMood, strikeCap, onWorldPhase, clearWorldHooks } from '../../src/core/world';

const gen = path.resolve(__dirname, '../../data/gen');
const load = (n: string): GameData[string] => JSON.parse(readFileSync(path.join(gen, `${n}.json`), 'utf8'));
const DATA: GameData = { 'world-events': load('world-events'), convergence: load('convergence'), countries: load('countries'), origin: load('origin') };
const W = DATA['world-events'].items as WorldEventsData;

/** A world whose first decade is year 0, like the doc-level sim. */
function world(seed: number, steps = 0, extra: System[] = []) {
  const st = newGame(seed);
  st.clock.worldYear = -10;
  const g = new Game(st, DATA, [worldSystem, ...extra]);
  g.init();
  g.worldSteps(steps);
  return g;
}

describe('world: same seed, same world', () => {
  it('gives the same log byte for byte, and a different seed a different one', () => {
    const a = JSON.stringify(world(7, 181).state);
    expect(JSON.stringify(world(7, 181).state)).toBe(a);
    expect(JSON.stringify(world(8, 181).state)).not.toBe(a);
  });
  it('resumes from a save: the state is plain JSON and the next decades are the same', () => {
    const whole = world(11, 120);
    const half = world(11, 60);
    const saved = JSON.parse(JSON.stringify(half.state)) as GameState;
    const g = new Game(saved, DATA, [worldSystem]);
    g.worldSteps(60);
    expect(JSON.stringify(g.state)).toBe(JSON.stringify(whole.state));
  });
  it('writes events as log entries of the world system with a level from the mark', () => {
    const s = world(3, 60).state;
    const ev = s.log.filter((e) => e.sys === 'world' && e.kind === 'event');
    expect(ev.length).toBeGreaterThan(20);
    for (const e of ev) {
      expect(e.id).toBeTruthy();
      expect(e.level).toBe(e.data.mark === '⭐' ? 2 : e.data.mark === '●' ? 1 : 0);
    }
    expect(Object.keys(s.world.happened).length).toBeGreaterThan(20);
  });
});

describe('world: its random stream is its own', () => {
  it('other systems drawing on other streams, every decade, do not move the world', () => {
    const noisy: System = {
      name: 'npc',
      worldStep(ctx) {
        for (let i = 0; i < 7; i++) ctx.rng('npc').next();
        ctx.rng('life.story').next();
        ctx.rng('god.chest').next();
      },
    };
    const plain = world(21, 181).state;
    const mixed = world(21, 181, [noisy]).state;
    expect(JSON.stringify(mixed.world)).toBe(JSON.stringify(plain.world));
    expect(mixed.log.filter((e) => e.sys === 'world')).toEqual(plain.log);
    expect(Object.keys(mixed.rng).sort()).toEqual(['god.chest', 'life.story', 'npc', 'world', 'world.fx', 'world.le'].filter((k) => k in mixed.rng));
  });
  it('starts the two streams where the doc-level sim starts them', () => {
    const g = world(1234, 0);
    const first = g.ctx.rng('world.le').next();
    expect(first).toBeGreaterThanOrEqual(0);
    expect(g.state.rng.world).toBeDefined();
  });
});

describe('world: the start', () => {
  it('has fifteen dragons, the slow variables, era 1 and the rift already open', () => {
    const w = world(5, 0).state.world;
    expect(w.dragons).toHaveLength(15);
    expect(w.dragons.every((d) => d.alive)).toBe(true);
    expect(w.dragons.map((d) => Math.round(d.mood / 10))).toEqual(expect.arrayContaining([7]));
    expect([w.vars.H, w.vars.T, w.vars.D, w.vars.F, w.vars.P]).toEqual([55, 70, 55, 60, 40]);
    expect(w.vars['Z:คัลดรา']).toBe(40);
    expect(w.era).toBe(1);
    expect(w.dfc).toBe(0);
    expect(w.happened['FG-01']).toBeLessThan(w.vars.eraStart1);
    expect(Object.keys(w.countryFlags)).toHaveLength(143);
    expect(Object.values(w.countryFaith).every((f) => f === 60)).toBe(true);
  });
});

describe('world: the rules it registers', () => {
  const ctxAt = (steps = 0) => world(5, steps).ctx;
  it('registers the conditions, effects and numbers of the world domain', () => {
    const r = registered();
    for (const k of ['event', 'era', 'var', 'stance', 'place']) expect(r.conds).toContain(k);
    for (const k of ['event', 'replace', 'eventWeight']) expect(r.effects).toContain(k);
  });
  it('reads event conditions: happened, outcome, closed, running', () => {
    const ctx = ctxAt();
    const w = ctx.state.world;
    expect(test(ctx, { k: 'event', id: 'FG-01', happened: true })).toBe(true);
    expect(test(ctx, { k: 'event', id: 'WR-04', happened: true })).toBe(false);
    w.happened['WR-04'] = ctx.state.clock.worldYear - 5;
    w.chains['out:WR-04'] = 1;
    expect(test(ctx, { k: 'event', id: 'WR-04', happened: true, outcome: 'a' })).toBe(true);
    expect(test(ctx, { k: 'event', id: 'WR-04', happened: true, outcome: 'b' })).toBe(false);
    expect(test(ctx, { k: 'event', id: 'WR-04', happened: true, phase: 'running' })).toBe(true);
    w.closed.push('WR-05');
    expect(test(ctx, { k: 'event', id: 'WR-05', happened: false, closed: true })).toBe(true);
    expect(test(ctx, { k: 'event', id: 'WR-04', happened: false })).toBe(false);
  });
  it('reads era, variables, moods, disturbance and the hold of a threshold', () => {
    const ctx = ctxAt();
    const w = ctx.state.world;
    w.era = 3;
    expect(test(ctx, { k: 'era', min: 2, max: 3 })).toBe(true);
    expect(test(ctx, { k: 'era', min: 4 })).toBe(false);
    w.vars.F = 15;
    expect(test(ctx, { k: 'var', name: 'F', op: '<', n: 20 })).toBe(true);
    expect(test(ctx, { k: 'var', name: 'F', op: '>', n: 20 })).toBe(false);
    w.dragons[6].mood = 35;
    expect(test(ctx, { k: 'var', name: 'M6', op: '<', n: 40 })).toBe(true);
    expect(test(ctx, { k: 'var', name: 'Z:คัลดรา', op: '>', n: 30 })).toBe(true);
    expect(test(ctx, { k: 'var', name: 'nothing', op: '>', n: 0 })).toBe(false);
    // "ศรัทธาโลก < 20 นาน 3 ทศวรรษ" (DR-01) counts the decades in a row
    const hold: Condition = { k: 'var', name: 'F', op: '<', n: 20, decades: 3 };
    w.chains['hold:F<20'] = 2;
    expect(test(ctx, hold)).toBe(false);
    w.chains['hold:F<20'] = 3;
    expect(test(ctx, hold)).toBe(true);
  });
  it('counts the decades a threshold has held while the world runs', () => {
    const g = world(5, 0);
    g.state.world.vars.F = 5; // far below 20: the drift moves it a few points a decade
    g.worldSteps(3);
    expect(g.state.world.chains['hold:F<20']).toBe(3);
    g.state.world.vars.F = 90;
    g.worldSteps(1);
    expect(g.state.world.chains['hold:F<20']).toBe(0);
  });
  it('reads the stance and the place of the country the character lives in', () => {
    const ctx = ctxAt();
    expect(test(ctx, { k: 'stance', ids: ['A'] })).toBe(false); // nobody lives anywhere
    ctx.state.life = { country: 'AL-06', race: 'human' } as GameState['life'];
    expect(test(ctx, { k: 'stance', ids: ['A'] })).toBe(true);
    expect(test(ctx, { k: 'stance', ids: ['M', 'L'] })).toBe(false);
    ctx.state.life!.country = 'MH-09';
    expect(test(ctx, { k: 'stance', ids: ['M'] })).toBe(true);
    expect(test(ctx, { k: 'place', kinds: ['war'] })).toBe(false);
    ctx.state.world.countryFlags['MH-09'].push('war');
    expect(test(ctx, { k: 'place', kinds: ['famine', 'war'] })).toBe(true);
    ctx.state.life!.country = 'NR-06'; // a sea country
    expect(test(ctx, { k: 'place', kinds: ['coast'] })).toBe(true);
    // a half-blood human is shunned in AL-02, a full human is not
    ctx.state.life!.country = 'AL-02';
    expect(test(ctx, { k: 'place', kinds: ['halfDislike'] })).toBe(false);
    ctx.state.life!.blood = 'human/elf';
    expect(test(ctx, { k: 'place', kinds: ['halfDislike'] })).toBe(true);
  });
  it('reads and changes the numbers: dfc, H T D F P, tension, keys, moods, happened.HP', () => {
    const ctx = ctxAt();
    const w = ctx.state.world;
    const stat = (s: string, op: '>=' | '<' = '>=', value = 0): Condition => ({ k: 'cmp', stat: s, op, value });
    expect(test(ctx, stat('dfc', '>=', 0))).toBe(true);
    expect(test(ctx, stat('F', '>=', 60))).toBe(true);
    apply(ctx, [{ k: 'stat', stat: 'H', delta: -40 }, { k: 'stat', stat: 'F', delta: 30 }, { k: 'stat', stat: 'tension', delta: 90 }], { sys: 'test' });
    expect([w.vars.H, w.vars.F, w.vars.tension]).toEqual([15, 90, 100]); // tension stops at 100
    apply(ctx, [{ k: 'stat', stat: 'keys', delta: 12 }], { sys: 'test' });
    expect(w.lastEraKeys).toBe(9);
    expect(test(ctx, stat('keys', '>=', 9))).toBe(true);
    const before = w.dragons[3].mood;
    apply(ctx, [{ k: 'stat', stat: 'mood.all', delta: -5 }], { sys: 'test' });
    expect(w.dragons[3].mood).toBeCloseTo(before - 5, 9);
    w.happened['HP-01'] = 0;
    expect(test(ctx, stat('happened.HP', '>=', 2))).toBe(false);
    w.happened['HP-02'] = 0;
    expect(test(ctx, stat('happened.HP', '>=', 2))).toBe(true);
    expect(ctx.state.log.some((e) => e.sys === 'rules')).toBe(false); // nothing was left without a handler
  });
  it('opens, cuts and delays an event, replaces one with another and weighs it', () => {
    const ctx = ctxAt();
    const w = ctx.state.world;
    const y = ctx.state.clock.worldYear;
    apply(ctx, [{ k: 'event', id: 'DM-01', open: true }, { k: 'event', id: 'DM-02' }], { sys: 'test' });
    expect(w.chains['open:DM-01']).toBe(y);
    expect(w.chains['open:DM-02']).toBeUndefined(); // a reference is not an opening
    apply(ctx, [{ k: 'event', id: 'WR-09', op: 'cut' }, { k: 'event', id: 'WR-10', op: 'delay', n: 30 }], { sys: 'test' });
    expect(w.closed).toContain('WR-09');
    expect(w.chains['delay:WR-10']).toBe(y + 30);
    apply(ctx, [{ k: 'replace', from: 'WR-01', to: 'WR-22' } as Effect], { sys: 'test' });
    expect(w.closed).toContain('WR-01');
    apply(ctx, [{ k: 'eventWeight', id: 'WR-17', delta: -30 }, { k: 'eventWeight', id: 'WR-17', mul: 2 }], { sys: 'test' });
    expect(weightOf(ctx, 'WR-17')).toBeCloseTo(1.4, 9);
  });
});

describe('world: hooks for the god', () => {
  it('lets the god weigh an event for a while, open one, hurt a dragon and make one fall', () => {
    const g = world(9, 5);
    const ctx = g.ctx;
    const w = ctx.state.world;
    holdEvent(ctx, 'WR-03', 3, ctx.state.clock.worldYear + 20);
    expect(weightOf(ctx, 'WR-03')).toBe(3);
    ctx.state.clock.worldYear += 30;
    expect(weightOf(ctx, 'WR-03')).toBe(1);
    const m = w.dragons[2].mood;
    addMood(ctx, 2, -20);
    expect(w.dragons[2].mood).toBe(m - 20);
    strikeCap(ctx, 2, 5);
    expect(w.vars['capDrop:2']).toBe(5);
    const dfc = w.dfc;
    const n0 = ctx.state.log.length;
    fallDragon(ctx, 4);
    fallDragon(ctx, 4); // already fell
    // one `world/dragonFall` entry for the fall, with the dragon and the place of its fall event; no event carried this fall, so `event` is null
    const falls = ctx.state.log.slice(n0).filter((e) => e.sys === 'world' && e.kind === 'dragonFall');
    expect(falls).toHaveLength(1);
    expect(falls[0]).toMatchObject({ id: w.dragons[4].id, level: 2, data: { dragon: 4, name: 'ศิลาสะท้าน', event: null } });
    expect(w.dfc).toBe(dfc + 1);
    expect(w.dragons[4].alive).toBe(false);
    expect(w.happened['DR-15']).toBeDefined();
    openByGod(ctx, 'GD-05');
    expect(w.chains['godopen:GD-05']).toBe(ctx.state.clock.worldYear);
  });
  it('runs a hook after the variables move and before the dragons fall', () => {
    const seen: number[] = [];
    onWorldPhase('afterDrift', (ctx) => {
      seen.push(ctx.state.world.dfc);
      ctx.state.world.dragons.forEach((d) => (d.mood = Math.min(d.mood, 5))); // every dragon is spent
    });
    try {
      const g = world(2, 3);
      expect(seen).toHaveLength(3);
      expect(g.state.world.dfc).toBeGreaterThan(0);
    } finally {
      clearWorldHooks();
    }
  });
  it('lets GD-05 happen only when the god opens it', () => {
    const g = world(2, 0);
    for (let i = 0; i < 120 && !g.state.world.ended; i++) g.worldSteps(1);
    expect(g.state.world.happened['GD-05']).toBeUndefined();
    expect(g.state.world.happened['GD-04']).toBeUndefined();
  });
});

describe('world: a closed event does not happen', () => {
  it('never fires an event after its continent changed shape, or twice (except wars 100 years apart, the hero and the mourning wave)', () => {
    const closeBy = new Map(W.closures.map((c) => [c.trigger, c]));
    const awake = new Map(W.dragons.filter((d) => d.awakeEvent).map((d) => [d.awakeEvent!, d.fallEvent]));
    const succ = new Set(W.closures.flatMap((c) => c.replace.map((r) => r.to)));
    let checked = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const log = world(seed * 7919, 181).state.log.filter((e) => e.kind === 'event' && e.sys === 'world');
      const closed = new Set<string>();
      const seen = new Map<string, number[]>();
      for (const e of log) {
        const id = e.id!;
        // a closed event may only come back as the branch event that replaces it
        expect(closed.has(id), `${id} at ${e.worldYear} after it was closed (seed ${seed})`).toBe(false);
        const years = seen.get(id) ?? [];
        if (!id.startsWith('WR-') && id !== 'DR-15' && id !== 'DR-13' && !id.startsWith('LE-') && !succ.has(id)) expect(years, `${id} twice (seed ${seed})`).toHaveLength(0);
        if (id.startsWith('WR-') && years.length) expect(e.worldYear - years[years.length - 1]).toBeGreaterThanOrEqual(W.rules.warRepeatYears);
        years.push(e.worldYear);
        seen.set(id, years);
        for (const x of closeBy.get(id)?.close ?? []) closed.add(x);
        for (const [pl, fall] of awake) if (fall === id) closed.add(pl);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
  it('ends the world once: nothing happens after the ending and the ending is the last decade', () => {
    let ended = 0;
    for (let s = 1; s <= 60 && ended < 3; s++) {
      const st = world(s * 7919, 181).state;
      if (!st.world.ended) continue;
      ended++;
      expect(st.world.era).toBe(5);
      expect(['END-10', 'END-11', 'END-12']).toContain(st.world.ended.id);
      const last = st.log.filter((e) => e.kind === 'event' && e.id !== 'LE-10' && e.id !== 'LE-12').pop()!;
      expect(last.worldYear).toBeLessThanOrEqual(st.world.ended.year);
      expect(st.world.happened[st.world.ended.id]).toBe(st.world.ended.year);
      const again = new Game(st, DATA, [worldSystem]);
      const n = st.log.length;
      again.worldSteps(5);
      expect(st.log).toHaveLength(n);
    }
    expect(ended).toBeGreaterThan(0);
  });
});

describe('world: the data it reads', () => {
  it('has a handler for every kind of condition and effect that a world event uses', () => {
    const r = registered();
    const conds = new Set<string>();
    const effs = new Set<string>();
    const walkC = (c?: Condition) => {
      if (!c) return;
      conds.add(c.k);
      if (c.k === 'and' || c.k === 'or') c.of.forEach(walkC);
      if (c.k === 'not') walkC(c.of);
    };
    const walkE = (l: Effect[] = []) =>
      l.forEach((e) => {
        effs.add(e.k);
        if (e.k === 'if') walkE(e.then);
        if (e.k === 'pick') e.of.forEach((b) => walkE(b.effects));
        if (e.k === 'chance') walkE(e.then);
      });
    for (const e of W.events) {
      walkC(e.cond);
      walkE(e.effects);
      e.outcomes.forEach((o) => walkE(o.effects));
    }
    // grant and remove of a flag are the world's own; everything else is registered by someone
    effs.delete('grant');
    effs.delete('remove');
    expect([...conds].filter((k) => !r.conds.includes(k))).toEqual([]);
    expect([...effs].filter((k) => !r.effects.includes(k))).toEqual([]);
  });
  it('builds the contexts the engine needs from a plain state', () => {
    const ctx = makeCtx(newGame(1), DATA);
    expect(ctx.state.world.dragons).toEqual([]);
  });
});

describe('world: omens ahead and the flags of famine and plague', () => {
  it('a ⭐ or ● event is told after its omen of 1 to 3 seasons while a life runs, an ○ event and a world with no life have none', () => {
    const none = world(5, 80).state.log.filter((e) => e.sys === 'world' && e.kind === 'omen');
    expect(none).toEqual([]);
    const st = newGame(5);
    st.clock.worldYear = -10;
    const g = new Game(st, DATA, [worldSystem]);
    g.init();
    g.worldSteps(20);
    st.life = { dead: undefined } as never; // a life runs: the world announces
    g.worldSteps(60);
    releaseOmens(g.ctx, true);
    const omens = st.log.filter((e) => e.sys === 'world' && e.kind === 'omen');
    expect(omens.length).toBeGreaterThan(5);
    for (const o of omens) {
      expect(['⭐', '●']).toContain(o.data.mark);
      expect(o.data.seasons).toBeGreaterThanOrEqual(1);
      expect(o.data.seasons).toBeLessThanOrEqual(3);
      const told = st.log.find((e) => e.sys === 'world' && e.kind === 'event' && e.id === o.id && e.n > o.n && e.data.omened === true);
      expect(told, String(o.id)).toBeDefined();
    }
    // the events with an omen are the ⭐ and ● ones: every event told after the life began, but the endings and the ○ ones, has its omen
    const after = st.log.filter((e) => e.sys === 'world' && e.kind === 'event' && !e.data.omened && e.n > omens[0].n);
    for (const e of after) expect(e.data.mark === '○' || e.level === 3 || e.data.mark === undefined, String(e.id)).toBe(true);
  });

  it('the omen is told one beat at a time: an event waits its seasons', () => {
    const st = newGame(5);
    const g = new Game(st, DATA, [worldSystem]);
    g.init();
    st.world.chains['omen:DR-13'] = 2;
    releaseOmens(g.ctx);
    expect(st.world.chains['omen:DR-13']).toBe(1);
    expect(st.log.some((e) => e.kind === 'event' && e.id === 'DR-13')).toBe(false);
    releaseOmens(g.ctx);
    expect(st.world.chains['omen:DR-13']).toBeUndefined();
    expect(st.log.some((e) => e.kind === 'event' && e.id === 'DR-13' && e.data.omened === true)).toBe(true);
  });

  it('CT-02 puts famine on the countries of W 1 to 2 for three years, CT-03 puts plague on every country but the forest for ten, HP-06 cures it', () => {
    const st = newGame(9);
    st.clock.worldYear = 1000;
    const g = new Game(st, DATA, [worldSystem]);
    g.init();
    const ev = (id: string) => W.events.find((e) => e.id === id)!;
    const countries = (DATA.countries.items as { id: string; continent: string; econ?: { w?: number } }[]);
    applyEvent(g.ctx, ev('CT-02'));
    for (const c of countries) {
      const low = (c.econ?.w ?? 3) <= 2;
      expect(st.world.countryFlags[c.id].includes('famine'), c.id).toBe(low);
    }
    expect(countries.some((c) => (c.econ?.w ?? 3) <= 2)).toBe(true);
    st.clock.worldYear += 4;
    expireWarFlags(g.ctx);
    for (const c of countries) expect(st.world.countryFlags[c.id]).not.toContain('famine');
    applyEvent(g.ctx, ev('CT-03'));
    for (const c of countries) expect(st.world.countryFlags[c.id].includes('plague'), c.id).toBe(c.continent !== 'SV');
    st.clock.worldYear += 5;
    expireWarFlags(g.ctx);
    expect(Object.values(st.world.countryFlags).some((f) => f.includes('plague'))).toBe(true);
    applyEvent(g.ctx, ev('HP-06'));
    for (const c of countries) expect(st.world.countryFlags[c.id]).not.toContain('plague');
    applyEvent(g.ctx, ev('CT-03'));
    st.clock.worldYear += 11;
    expireWarFlags(g.ctx);
    for (const c of countries) expect(st.world.countryFlags[c.id]).not.toContain('plague');
  });
});
