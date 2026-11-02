// Balance of the NPC system (code-plan §7 row npc, M3): the targets of scripts/sim/sim-npc-density.mjs, sim-npc-fate.mjs and
// sim-npc-timeline.mjs on the real system, the share of newcomers (succession.md §5) and the stories a character meets per life year
// (review/m1/triage.md: elves met too many). Slow: `npm run test:balance`.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { Game, makeCtx, versions, type GameData } from '../../src/core/game';
import { detached } from '../../src/core/rng';
import { clone } from '../../src/core/save';
import { newGame } from '../../src/core/state';
import { countSlots, fateOutcome, npcIndex, npcState, npcSystem, rollNewcomers, slotsOf } from '../../src/core/npc';
import { candidatesFor, eraTag } from '../../src/core/npc';
import { worldSystem } from '../../src/core/world';
import type { LifeState } from '../../src/core/types';

let data: GameData;
beforeAll(() => {
  data = loadGen(['npcs', 'countries', 'continents', 'world-events', 'local-events', 'convergence', 'clashes']);
});

const sigma = (p: number, n: number) => Math.sqrt((p * (1 - p)) / n);

/** A world of the world system and the NPC system, run for 1,800 years in decades. */
function run(seed: number, steps = 180, each?: (g: Game, step: number) => void): Game {
  const g = new Game(newGame(seed, versions(data)), data, [worldSystem, npcSystem]);
  g.init();
  for (let i = 0; i < steps; i++) {
    g.worldSteps(1);
    each?.(g, i);
  }
  return g;
}

describe('npc balance: density of stories (sim-npc-density, succession.md §5.1)', () => {
  it('about 3.6 NPCs with a story per country and 1.4 stories open at one moment, from the second century on', () => {
    let alive = 0;
    let open = 0;
    let newcomers = 0;
    let n = 0;
    const W = 30;
    for (let seed = 1; seed <= W; seed++) {
      run(seed, 180, (g, i) => {
        if (i < 10 || i % 10 !== 5) return;
        const c = countSlots(g.state);
        alive += c.alive;
        open += c.open;
        for (const id of npcState(g.state).newcomers) if (slotsOf(g.state)[id].status === 'alive') newcomers++;
        n++;
      });
    }
    const per = (x: number) => x / n / 143;
    // doc: 3.6–3.7 alive (with 0.3–0.5 newcomers) and 1.4 open
    expect(per(alive)).toBeGreaterThan(3.1);
    expect(per(alive)).toBeLessThan(3.9);
    expect(per(open)).toBeGreaterThan(1.1);
    expect(per(open)).toBeLessThan(1.7);
    // a template fits only part of the countries, and one template is used once per country: fewer than the 0.3–0.5 the sim assumed
    // (every roll gives one), but a real share of the density
    expect(per(newcomers)).toBeGreaterThan(0.1);
    expect(per(newcomers)).toBeLessThan(0.5);
  });
});

describe('npc balance: newcomers (succession.md §5)', () => {
  it('each roll gives a newcomer to 40% of the countries that have a template to give, the templates of a continent weigh double', () => {
    // one world at year 700, rolled 150 times with other random streams
    const base = run(7, 70);
    const tag = eraTag(base.state)!;
    expect(tag).toBeTruthy();
    const idx = npcIndex(base.ctx);
    let offered = 0;
    let given = 0;
    let continentGiven = 0;
    let continentExpected = 0;
    for (let t = 0; t < 150; t++) {
      const st = clone(base.state);
      st.seed = 1000 + t;
      delete st.rng['npc.nt'];
      const ctx = makeCtx(st, data);
      const cands = new Map<string, ReturnType<typeof candidatesFor>>();
      for (const c of idx.countries.values()) cands.set(c.id, candidatesFor(ctx, c, tag));
      const made = rollNewcomers(ctx, tag);
      for (const [id, list] of cands) {
        if (!list.length) continue;
        offered++;
        const total = list.reduce((a, c) => a + c.w, 0);
        continentExpected += list.filter((c) => c.t.continentTemplate).reduce((a, c) => a + c.w, 0) / total;
      }
      for (const id of made) {
        given++;
        if (idx.templates.get(slotsOf(st)[id].nt!.tpl)!.continentTemplate) continentGiven++;
      }
    }
    expect(offered).toBeGreaterThan(3000);
    const p = given / offered;
    expect(Math.abs(p - 0.4), `${given} of ${offered}`).toBeLessThan(4 * sigma(0.4, offered));
    // the draw is by weight: the continent templates come as often as their double weight says (given a continent template is on offer)
    expect(Math.abs(continentGiven - 0.4 * continentExpected), `${continentGiven} vs ${(0.4 * continentExpected).toFixed(0)}`).toBeLessThan(4 * Math.sqrt(0.4 * continentExpected) + 5);
  });

  it('about 600 newcomers per world of 1,800 years, spread over the eras, and (almost) every template of the 54 comes in 60 worlds', () => {
    const tpls = new Map<string, number>();
    const perWorld: number[] = [];
    const eraCount: Record<string, number> = {};
    for (let seed = 1; seed <= 60; seed++) {
      const g = run(seed);
      const ids = npcState(g.state).newcomers;
      perWorld.push(ids.length);
      for (const id of ids) {
        const nt = slotsOf(g.state)[id].nt!;
        tpls.set(nt.tpl, (tpls.get(nt.tpl) ?? 0) + 1);
        const t = npcIndex(g.ctx).templates.get(nt.tpl)!;
        for (const e of t.eras) eraCount[e] = (eraCount[e] ?? 0) + 1;
      }
    }
    const mean = perWorld.reduce((a, b) => a + b, 0) / perWorld.length;
    expect(mean).toBeGreaterThan(350);
    expect(mean).toBeLessThan(1000);
    const missing = Array.from({ length: 54 }, (_, i) => `NT-${String(i + 1).padStart(2, '0')}`).filter((k) => !tpls.has(k));
    // NT-26 asks for the Morhaven hunger below 40 before END-02 in the second half of the last era: rare, not impossible
    expect(missing.length, `missing ${missing.join(' ')}`).toBeLessThanOrEqual(3);
    // every era has its newcomers
    for (const e of ['1', '2', '3', '4a']) expect(eraCount[e], e).toBeGreaterThan(100);
  });
});

describe('npc balance: stories met per life year (review/m1/triage.md)', () => {
  /** One life from age 0 to 59 in a random country, with only the NPC system around; returns the stories met. */
  function met(seed: number, race: string, lifespan: number): number {
    const g = new Game(newGame(seed, versions(data)), data, [npcSystem]);
    g.init();
    g.worldSteps(10 + (seed % 120));
    const countries = [...npcIndex(g.ctx).countries.keys()];
    const country = countries[(seed * 7) % countries.length];
    const st = g.state;
    const life: LifeState = {
      id: 'L1', name: 'x', race, gender: 'm', birthYear: st.clock.worldYear, lifespan, hAge: 0, country, home: country, traits: [], aptitudes: {}, skills: [], blessings: [], curses: [], fate: [], cls: 'c3', gold: 0,
      stats: { pow: 1, mag: 1, spd: 1, luk: 1, int: 1, vit: 1 }, items: [], flags: [], passed: {}, pending: [], memory: [], godFaith: 0, heart: 0, ext: {},
    };
    st.life = life;
    g.born();
    const mark = st.logN;
    for (let i = 0; i < 4 * 60; i++) g.beat();
    return st.log.filter((e) => e.n >= mark && e.sys === 'npc' && e.data.what === 'meet').length;
  }

  it('an elf, a vampire and a dwarf meet about as many stories per life year as a human (the life year of an elf is 4 world years, of a vampire 5)', () => {
    const N = 120;
    const rate = (race: string, span: number) => {
      let m = 0;
      for (let s = 1; s <= N; s++) m += met(s, race, span);
      return m / (N * 54);
    };
    const human = rate('human', 75);
    const elf = rate('elf', 300);
    const vampire = rate('vampire', 350);
    const dwarf = rate('dwarf', 220);
    expect(human).toBeGreaterThan(0.05);
    // before the rate was set the elf met 2.8 times as many (0.27 against 0.095)
    for (const [name, r] of [['elf', elf], ['vampire', vampire], ['dwarf', dwarf]] as const) {
      expect(r / human, `${name} ${r.toFixed(3)} against human ${human.toFixed(3)}`).toBeGreaterThan(0.7);
      expect(r / human, `${name} ${r.toFixed(3)} against human ${human.toFixed(3)}`).toBeLessThan(1.35);
    }
  });
});

describe('npc balance: the targets of the document simulators (sim-npc-fate, sim-npc-timeline)', () => {
  /** Three sub-periods in a row, as sim-npc-fate.mjs counts them: moved holders roll again, dead and vanished are out. */
  function cumulative(cls: 'keeper' | 'leader' | 'other', n = 200000) {
    const r = detached(17);
    const tot = { stay: 0, moved: 0, dead: 0, gone: 0 };
    for (let i = 0; i < n; i++) {
      let state: 'stay' | 'moved' | 'dead' | 'gone' = 'stay';
      for (const phase of ['4ก', '4ข', '4ค'] as const) {
        if (state === 'dead' || state === 'gone') break;
        const o = fateOutcome(r, cls, phase);
        if (o === 'dead' || o === 'gone') state = o;
        else if (o === 'moved') state = 'moved';
      }
      tot[state]++;
    }
    return { stay: tot.stay / n, moved: tot.moved / n, dead: tot.dead / n, gone: tot.gone / n };
  }

  it('the table of the last era gives the cumulative shares of the sim (keeper 7/12/46/35, leader 39/12/37/13, other 36/25/25/13)', () => {
    const want = { keeper: [7, 12, 46, 35], leader: [39, 12, 37, 13], other: [36, 25, 25, 13] } as const;
    for (const cls of ['keeper', 'leader', 'other'] as const) {
      const got = cumulative(cls);
      const w = want[cls];
      expect(Math.abs(got.stay * 100 - w[0]), `${cls} stay`).toBeLessThan(1);
      expect(Math.abs(got.moved * 100 - w[1]), `${cls} moved`).toBeLessThan(1);
      expect(Math.abs(got.dead * 100 - w[2]), `${cls} dead`).toBeLessThan(1);
      expect(Math.abs(got.gone * 100 - w[3]), `${cls} gone`).toBeLessThan(1);
    }
  });

  it('few humans of the roster are still holders at a random start of the world (2%), more elves and dwarves (7%): sim-npc-fate "still holder at a random start"', () => {
    const idx = npcIndex(makeCtx(newGame(1), data));
    const share = (people: string) => {
      let sum = 0;
      let n = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const g = new Game(newGame(seed, versions(data)), data, [npcSystem]);
        g.init();
        const slots = slotsOf(g.state);
        for (const r of idx.file.npcs) {
          if (r.peopleId !== people) continue;
          const s = slots[r.id];
          sum += Math.min(1, Math.max(0, (s.born + s.span) / 1780));
          n++;
        }
      }
      return sum / n;
    };
    expect(share('hu')).toBeLessThan(0.05);
    expect(share('el')).toBeGreaterThan(0.04);
    expect(share('el')).toBeLessThan(0.11);
    expect(share('dw')).toBeGreaterThan(0.04);
    expect(share('dw')).toBeLessThan(0.11);
  });

  it('the stories of the rows bound to a world event open only when their first holder is alive at the event, so most of them are played by successors (sim-npc-timeline: 61 of 75 rows)', () => {
    // the first holder of an event row is alive at the first event in under 30% of the worlds for most rows
    const rows = npcIndex(makeCtx(newGame(1), data)).file.npcs.filter((r) => r.clock.open === 'event');
    expect(rows.length).toBeGreaterThanOrEqual(75);
    let weak = 0;
    let rowsSeen = 0;
    const W = 80;
    const opened = new Map<string, number>();
    const happened = new Map<string, number>();
    for (let seed = 1; seed <= W; seed++) {
      const g = run(seed, 140);
      const slots = slotsOf(g.state);
      for (const r of rows) {
        const first = r.clock.events.map((e) => g.state.world.happened[e]).filter((y) => y !== undefined);
        if (!first.length) continue;
        happened.set(r.id, (happened.get(r.id) ?? 0) + 1);
        if (slots[r.id].evGen === 1) opened.set(r.id, (opened.get(r.id) ?? 0) + 1);
      }
    }
    for (const r of rows) {
      const h = happened.get(r.id) ?? 0;
      if (h < 20) continue;
      rowsSeen++;
      if ((opened.get(r.id) ?? 0) / h < 0.3) weak++;
    }
    expect(rowsSeen).toBeGreaterThan(30);
    expect(weak / rowsSeen).toBeGreaterThan(0.6);
  });
});

describe('npc balance: illness', () => {
  it('about one holder in ten is gravely ill at a moment (old age, a story, a plague), almost none young', () => {
    let alive = 0;
    let sick = 0;
    let youngSick = 0;
    let young = 0;
    for (let seed = 1; seed <= 20; seed++) {
      run(seed, 180, (g, i) => {
        if (i % 10 !== 5) return;
        const now = g.state.clock.worldYear;
        for (const s of Object.values(slotsOf(g.state))) {
          if (s.status !== 'alive') continue;
          alive++;
          if (s.sick !== undefined) sick++;
          if (now - s.born < 0.5 * s.span) {
            young++;
            if (s.sick !== undefined) youngSick++;
          }
        }
      });
    }
    expect(sick / alive).toBeGreaterThan(0.05);
    expect(sick / alive).toBeLessThan(0.2);
    expect(youngSick / young).toBeLessThan(0.02);
  });
});
