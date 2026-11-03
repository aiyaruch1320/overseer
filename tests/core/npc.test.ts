// The NPC system against the document-level simulators (scripts/sim/sim-npc-timeline.mjs, sim-npc-fate.mjs, sim-npc-density.mjs)
// and the rules of docs/lore/npcs/README.md and succession.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { Game, makeCtx, versions, type GameData } from '../../src/core/game';
import { detached } from '../../src/core/rng';
import { apply, test as testCond } from '../../src/core/rules';
import { clone } from '../../src/core/save';
import { newGame } from '../../src/core/state';
import { applyClashOutcome, candidatesFor, canClash, clashesOf, clearClashHandlers, countSlots, fateOutcome, grudgeOf, healNpc, isNemesis, isSick, killNpc, nemeses, npcIndex, npcState, npcSystem, onClash, openClash, pathChances, rollNewcomers, rowOf, sickNpcs, slotsOf, tiedIds, triggersOf, viewOf } from '../../src/core/npc';
import { adjustPath, advanceSlot, end, meetZone } from '../../src/core/npc/engine';
import { NT_ENDS } from '../../src/core/npc/data';
import { clashAtResolve } from '../../src/core/npc/clash';
import type { ClashReq } from '../../src/core/npc';
import type { LifeState } from '../../src/core/types';
import { ERA4_FATE } from '../../src/core/npc/tuning';
import type { Condition } from '../../src/core/types';
import type { NpcRow, NpcsFile } from '../../src/core/data/types-npcs';

let data: GameData;
let rows: NpcRow[];
beforeAll(() => {
  data = loadGen(['npcs', 'countries', 'continents', 'clashes', 'world-events', 'local-events', 'convergence']);
  rows = (data.npcs.items as NpcsFile).npcs;
});

function world(seed: number, trace = false): Game {
  const g = new Game(newGame(seed, versions(data)), data, [npcSystem]);
  g.init();
  if (trace) npcState(g.state).trace = true;
  return g;
}

const sigma = (p: number, n: number) => Math.sqrt((p * (1 - p)) / n);

describe('npc: the same seed gives the same world', () => {
  it('replays exactly and differs for another seed', () => {
    const run = (seed: number) => {
      const g = world(seed, true);
      g.worldSteps(80);
      // the rules layer reports an unhandled kind once per process, so only the entries of this system are compared
      return JSON.stringify([g.state.npcs, g.state.log.filter((e) => e.sys === 'npc').map((e) => ({ ...e, n: 0 })), g.state.rng]);
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).not.toBe(run(8));
  });

  it('a saved state continues exactly like the uninterrupted one', () => {
    const a = world(3);
    a.worldSteps(40);
    const b = new Game(clone(a.state), data, [npcSystem]);
    a.worldSteps(60);
    b.worldSteps(60);
    // a saved state drops keys that hold undefined, so compare the values, not the text
    expect(b.state.npcs).toEqual(a.state.npcs);
    expect(b.state.rng).toEqual(a.state.rng);
    expect(b.state.clock).toEqual(a.state.clock);
  });
});

describe('npc: the start', () => {
  it('has 614 slots, every leader present, the rest appearing by their percent', () => {
    let present = 0;
    let expected = 0;
    let variance = 0;
    const N = 20;
    for (let seed = 1; seed <= N; seed++) {
      const g = world(seed);
      const slots = slotsOf(g.state);
      expect(Object.keys(slots)).toHaveLength(614);
      for (const r of rows) {
        const s = slots[r.id];
        expect(s.holder).toBe(r.id);
        expect(s.place).toBe(r.country);
        expect(s.step).toBe(0);
        if (r.group === 'leader') expect(s.status).toBe('alive');
        else {
          const p = r.appearPct / 100;
          present += s.status === 'alive' ? 1 : 0;
          expected += p;
          variance += p * (1 - p);
        }
      }
    }
    expect(Math.abs(present - expected)).toBeLessThan(4 * Math.sqrt(variance));
  });

  it('draws lifespans like sim-npc-fate: few humans of the roster are still alive at a random start, elves more', () => {
    // sim-npc-fate.mjs column "still holder at a random start": humans 2%, elves 7%, dark elves 8%, dwarves 7% (uniform start in 0..1780)
    const share = (people: string) => {
      let sum = 0;
      let n = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const slots = slotsOf(world(seed).state);
        for (const r of rows) {
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
});

describe('npc: story paths', () => {
  /** Chance of each path for a story without the main character and without world events, from the raw data. */
  function expected(row: NpcRow): Record<string, number> {
    const noEvents = (c: Condition | null | undefined): boolean => {
      if (!c) return true;
      if (c.k === 'event') return c.happened === false;
      if (c.k === 'and') return c.of.every(noEvents);
      if (c.k === 'or') return c.of.some(noEvents);
      if (c.k === 'not') return !noEvents(c.of);
      return false;
    };
    const free = row.paths.filter((p) => !p.needsMc && noEvents(p.cond as Condition | null) && !row.cuts.some((c) => c.cut === p.key && c.when && noEvents(c.when)));
    const total = free.reduce((a, p) => a + p.pct, 0);
    const out: Record<string, number> = { a: 0, b: 0, c: 0, '-': 1 };
    if (!total) return out;
    out['-'] = row.restPct / 100;
    for (const p of free) out[p.key] = (1 - row.restPct / 100) * (p.pct / total);
    return out;
  }

  it('resolve with the shares written in the rows (after the cuts and without the main character)', () => {
    const seen = new Map<string, Record<string, number>>();
    for (let seed = 1; seed <= 6; seed++) {
      const g = world(seed, true);
      g.worldSteps(150);
      for (const e of g.state.log) {
        // a story whose paths a tied story cut or weighed (README §2.2) no longer follows the written shares
        if (e.sys !== 'npc' || e.data.what !== 'end' || e.data.byDeath || e.data.tied || !rows.some((r) => r.id === e.id)) continue;
        const c = seen.get(e.id!) ?? { a: 0, b: 0, c: 0, '-': 0, n: 0 };
        c[String(e.data.path)]++;
        c.n++;
        seen.set(e.id!, c);
      }
    }
    expect(seen.size).toBeGreaterThan(400);
    const obs: Record<string, number> = { a: 0, b: 0, c: 0, '-': 0 };
    const exp: Record<string, number> = { a: 0, b: 0, c: 0, '-': 0 };
    const varSum: Record<string, number> = { a: 0, b: 0, c: 0, '-': 0 };
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const [id, c] of seen) {
      const e = expected(byId.get(id)!);
      for (const k of ['a', 'b', 'c', '-']) {
        obs[k] += c[k];
        exp[k] += c.n * e[k];
        varSum[k] += c.n * e[k] * (1 - e[k]);
      }
    }
    for (const k of ['a', 'b', 'c', '-']) expect(Math.abs(obs[k] - exp[k]), `path ${k}: ${obs[k]} vs ${exp[k].toFixed(1)}`).toBeLessThan(4 * Math.sqrt(varSum[k]) + 3);
    // path ค is almost always a path with the main character (578 of 614 rows), so without one it is almost never taken
    expect(obs.c / (obs.a + obs.b + obs.c + obs['-'])).toBeLessThan(0.03);
  });

  it('a path with the main character opens only when he was in the zone', () => {
    const g = world(1);
    const slots = slotsOf(g.state);
    const row = rows.find((r) => r.id === 'AZ01-1')!;
    const s = slots['AZ01-1'];
    expect(pathChances(makeCtx(g.state, data), row, s).a).toBe(0); // path ก) is tagged [ช่วย]
    s.story.mc = true;
    expect(pathChances(makeCtx(g.state, data), row, s).a).toBeGreaterThan(0.3);
  });

  it('cuts paths when the condition of the cut holds (ถ้า DR-01 ตัดก)', () => {
    const g = world(1);
    const ctx = makeCtx(g.state, data);
    const row = rows.find((r) => r.id === 'AZ01-1')!;
    const s = slotsOf(g.state)['AZ01-1'];
    s.story.mc = true;
    const before = pathChances(ctx, row, s);
    g.state.world.happened['DR-01'] = 5;
    const after = pathChances(ctx, row, s);
    expect(before.a).toBeGreaterThan(0);
    expect(after.a).toBe(0);
    expect(after.b + after.c + after['-']).toBeCloseTo(1, 6);
    // the rest keeps its own share, the other paths fill the remaining part
    expect(after['-']).toBeCloseTo(row.restPct / 100, 6);
  });
});

describe('npc: event-bound stories (sim-npc-timeline)', () => {
  /** P(the first holder is alive at world year t), drawn from the same lifespan rule with an independent stream. */
  function aliveAt(row: NpcRow, t: number, n = 30000): number {
    const file = data.npcs.items as NpcsFile;
    const lives = file.rules.lives;
    const life = lives.find((l) => row.raceText.startsWith(l.people.replace(/ \(.*\)$/, ''))) ?? lives.find((l) => l.id === (row.peopleId ?? 'hu'))!;
    const r = detached(99);
    const age = row.age ?? Math.round((life.adult + life.elder) / 2);
    let alive = 0;
    for (let i = 0; i < n; i++) {
      const span = Math.max(life.lifeLo + r.next() * (life.lifeHi - life.lifeLo), age + 1 + r.next() * 5);
      if (span - age >= t) alive++;
    }
    return alive / n;
  }

  it('the first holder opens the event story iff he is alive when the event happens', () => {
    const picks = rows.filter((r) => r.clock.open === 'event' && r.appearPct === 100 && r.age !== null).slice(0, 8);
    expect(picks.length).toBeGreaterThanOrEqual(5);
    const T = 205;
    const N = 300;
    const opened = new Map<string, number>(picks.map((r) => [r.id, 0]));
    for (let seed = 1; seed <= N; seed++) {
      const g = world(seed * 31);
      g.worldSteps(20);
      for (const r of picks) g.state.world.happened[r.clock.events[0]] = T;
      g.worldSteps(1);
      for (const r of picks) if (slotsOf(g.state)[r.id].evGen === 1) opened.set(r.id, opened.get(r.id)! + 1);
    }
    for (const r of picks) {
      const p = aliveAt(r, T);
      const got = opened.get(r.id)! / N;
      expect(Math.abs(got - p), `${r.id} ${r.clock.events[0]}: ${got.toFixed(3)} vs ${p.toFixed(3)}`).toBeLessThan(4 * sigma(p, N) + 0.03);
    }
  });

  it('the story of an event row waits for the event even after the age clock would have opened it', () => {
    const r = rows.find((x) => x.clock.open === 'event' && x.group === 'leader')!;
    const g = world(5, true);
    g.worldSteps(3);
    g.state.world.happened[r.clock.events[0]] = 35;
    g.worldSteps(1);
    const logged = g.state.log.filter((e) => e.sys === 'npc' && e.id === r.id && e.data.what === 'event');
    expect(logged.length).toBe(1);
    expect(logged[0].data.id).toBe(r.clock.events[0]);
  });
});

describe('npc: succession', () => {
  it('leaders and key positions are always held after many generations; tier 3 rows are refilled by their share', () => {
    const g = world(11);
    g.worldSteps(150);
    const slots = slotsOf(g.state);
    const dead = rows.filter((r) => slots[r.id].status !== 'alive' && slots[r.id].status !== 'absent');
    // a tier 1 or 2 position never stays empty (a keeper ends only through the last-era table, not here)
    expect(dead.filter((r) => r.succession.tier < 3)).toEqual([]);
    const t3 = rows.filter((r) => r.succession.tier === 3);
    const held = t3.filter((r) => slots[r.id].status === 'alive').length / t3.length;
    expect(held).toBeGreaterThan(0.5);
    expect(held).toBeLessThan(0.75);
    // the holders after the first carry the generation in the name
    const later = rows.filter((r) => slots[r.id].gen > 1 && !r.succession.allySuccessor);
    expect(later.length).toBeGreaterThan(300);
    for (const r of later.slice(0, 50)) expect(slots[r.id].name).toBe(`${r.name}ที่ ${slots[r.id].gen}`);
  });

  it('an ally position passes to the written successor (bonds/07-successors.md)', () => {
    const r = rows.find((x) => x.succession.allySuccessor && x.appearPct === 100)!;
    const g = world(4);
    const s = slotsOf(g.state)[r.id];
    for (let i = 0; i < 60 && s.gen === 1; i++) g.worldSteps(1);
    expect(s.gen).toBe(2);
    expect(s.name).toBe(r.succession.allySuccessor!.name);
    for (let i = 0; i < 60 && s.gen === 2; i++) g.worldSteps(1);
    expect(s.name).toBe(`${r.succession.allySuccessor!.name}ที่ 2`);
  });

  it('keeps about 3.3 positions with a living holder and 1.3 open stories per country (sim-npc-density: 3.6 and 1.4 with newcomers)', () => {
    let alive = 0;
    let open = 0;
    const W = 8;
    for (let seed = 1; seed <= W; seed++) {
      const g = world(seed * 17);
      g.worldSteps(80);
      const c = countSlots(g.state);
      alive += c.alive / 143 / W;
      open += c.open / 143 / W;
    }
    expect(alive).toBeGreaterThan(2.9);
    expect(alive).toBeLessThan(3.8);
    expect(open).toBeGreaterThan(1.0);
    expect(open).toBeLessThan(1.7);
  });

  it('writes npc entries (trace kept when asked) and reports the death of a holder with the cause', () => {
    const g = world(2, true);
    g.worldSteps(60);
    const deaths = g.state.log.filter((e) => e.kind === 'npc' && e.data.what === 'die');
    expect(deaths.length).toBeGreaterThan(100);
    expect(deaths.every((e) => typeof e.data.cause === 'string' && e.id)).toBe(true);
    const succeeded = g.state.log.filter((e) => e.kind === 'npc' && e.data.what === 'succeed');
    expect(succeeded.length).toBeGreaterThan(50);
  });
});

describe('npc: the last era (sim-npc-fate, 04-last-era.md §4)', () => {
  /** Three sub-periods in a row, as sim-npc-fate.mjs counts them: moved holders roll again, dead and vanished are out. */
  function cumulative(cls: 'keeper' | 'leader' | 'other', n = 40000) {
    const r = detached(5);
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

  it('gives the cumulative shares of the sim (keeper 7/12/46/35, leader 39/12/37/13, other 36/25/25/13)', () => {
    const want = { keeper: [7, 12, 46, 35], leader: [39, 12, 37, 13], other: [36, 25, 25, 13] } as const;
    for (const cls of ['keeper', 'leader', 'other'] as const) {
      const got = cumulative(cls);
      const w = want[cls];
      // "stay" in the sim table means never moved; a mover that stays after is counted as moved
      expect(got.stay * 100).toBeCloseTo(w[0], -0.3);
      expect(Math.abs(got.moved * 100 - w[1])).toBeLessThan(2.5);
      expect(Math.abs(got.dead * 100 - w[2])).toBeLessThan(2.5);
      expect(Math.abs(got.gone * 100 - w[3])).toBeLessThan(2.5);
    }
  });

  it('the table rows are those of the document', () => {
    expect(ERA4_FATE.keeper[1]).toEqual([35, 20, 25, 20]);
    expect(ERA4_FATE.leader[2]).toEqual([65, 5, 25, 5]);
    expect(ERA4_FATE.other[0]).toEqual([80, 10, 5, 5]);
  });

  it('rolls the table once when a sub-period starts (4ก: other 5% die, 5% vanish, 10% move)', () => {
    let alive = 0;
    let died = 0;
    let gone = 0;
    let moved = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const g = world(seed * 3, true);
      g.worldSteps(50);
      const before = slotsOf(g.state);
      const holders = rows.filter((r) => r.seq !== 1 && before[r.id].status === 'alive' && !before[r.id].keeper);
      const placeBefore = new Map(holders.map((r) => [r.id, before[r.id].place]));
      const mark = g.state.logN;
      g.state.world.dfc = 10;
      g.worldSteps(1);
      const after = slotsOf(g.state);
      const era = g.state.log.filter((e) => e.n >= mark && e.kind === 'npc');
      alive += holders.length;
      // newcomers arrive at the same roll and take part in the table: only the roster is counted
      const roster = (e: { id?: string }) => rows.find((r) => r.id === e.id);
      died += era.filter((e) => e.data.what === 'die' && e.data.cause === 'ยุคปลาย' && roster(e) && roster(e)!.seq !== 1 && !after[e.id!].keeper).length;
      gone += era.filter((e) => e.data.what === 'vanish' && roster(e) && roster(e)!.seq !== 1).length;
      moved += holders.filter((r) => after[r.id].status === 'alive' && after[r.id].place !== placeBefore.get(r.id)).length;
    }
    expect(alive).toBeGreaterThan(1500);
    expect(Math.abs(died / alive - 0.05)).toBeLessThan(0.03);
    expect(Math.abs(gone / alive - 0.05)).toBeLessThan(0.03);
    expect(Math.abs(moved / alive - 0.1)).toBeLessThan(0.03);
  });

  it('a key keeper who dies in the last era leaves no successor', () => {
    const keeperRow = rows.find((r) => /ผู้ถือกุญแจ|ผู้เฝ้ากุญแจ/.test(r.role))!;
    let ended = false;
    for (let seed = 1; seed <= 400 && !ended; seed++) {
      const g = world(seed);
      g.worldSteps(5);
      const s = slotsOf(g.state)[keeperRow.id];
      if (s.status !== 'alive') continue;
      g.state.world.dfc = 14;
      g.worldSteps(1);
      if ((s.status as string) !== 'alive') {
        const before = s.gen;
        g.worldSteps(20);
        expect(s.status).not.toBe('alive');
        expect(s.gen).toBe(before);
        ended = true;
      }
    }
    expect(ended).toBe(true);
  });
});

describe('npc: rules', () => {
  it('condition npc tells whether the position has a living holder', () => {
    const g = world(1);
    const ctx = makeCtx(g.state, data);
    const absent = rows.find((r) => slotsOf(g.state)[r.id].status === 'absent')!;
    expect(testCond(ctx, { k: 'npc', id: 'AZ01-1', alive: true })).toBe(true);
    expect(testCond(ctx, { k: 'npc', id: 'AZ01-1', alive: false })).toBe(false);
    expect(testCond(ctx, { k: 'npc', id: absent.id, alive: true })).toBe(false);
  });

  it('effect npc records the meeting, the relation and, for a main ally, one line of memory', () => {
    const g = world(1);
    g.state.life = {
      id: 'L1', name: 'x', race: 'human', gender: 'm', birthYear: 0, lifespan: 75, hAge: 20, country: 'AZ-01', home: 'AZ-01', traits: [], aptitudes: {}, skills: [], blessings: [], curses: [], fate: [], cls: 'c3', gold: 0,
      stats: { pow: 1, mag: 1, spd: 1, luk: 1, int: 1, vit: 1 }, items: [], flags: [], passed: {}, pending: [], memory: [], godFaith: 0, heart: 0, ext: {},
    };
    const ctx = makeCtx(g.state, data);
    const ally = rows.find((r) => r.succession.tier === 1 && slotsOf(g.state)[r.id].status === 'alive')!;
    apply(ctx, [{ k: 'npc', id: ally.id }], { sys: 'story', id: 'hu.a1' });
    const s = slotsOf(g.state)[ally.id];
    expect(s.rel['mc.known']).toBe(1);
    expect(g.state.log.some((e) => e.kind === 'npc' && e.data.what === 'meet' && e.id === ally.id && e.level === 2)).toBe(true);
    expect(g.state.life!.memory[0]).toContain(s.name);
    apply(ctx, [{ k: 'npc', id: ally.id }], { sys: 'story', id: 'hu.a1' });
    expect(g.state.life!.memory).toHaveLength(1);
    // a leader is met without a line of memory
    apply(ctx, [{ k: 'npc', id: 'AZ01-1' }], { sys: 'story', id: 'hu.a1' });
    expect(g.state.life!.memory).toHaveLength(1);
    expect(slotsOf(g.state)['AZ01-1'].rel['mc.known']).toBe(1);
  });

  it('effect npcPath cuts, weighs, delays and forces a path (combat/07-npc-clashes.md §3.0)', () => {
    const g = world(1, true);
    const ctx = makeCtx(g.state, data);
    const row = rows.find((r) => r.id === 'AZ01-1')!;
    const s = slotsOf(g.state)['AZ01-1'];
    s.story.mc = true;
    const base = pathChances(ctx, row, s);
    apply(ctx, [{ k: 'npcPath', npc: 'AZ01-1', path: 'b', op: 'weight', n: 10, unit: 'add' }], { sys: 'combat' });
    expect(pathChances(ctx, row, s).b).toBeGreaterThan(base.b);
    apply(ctx, [{ k: 'npcPath', npc: 'AZ01-1', path: 'a', op: 'cut' }], { sys: 'combat' });
    expect(pathChances(ctx, row, s).a).toBe(0);
    const open = s.story.openAt;
    apply(ctx, [{ k: 'npcPath', npc: 'AZ01-1', path: 'b', op: 'delay', n: 3, unit: 'year' }], { sys: 'combat' });
    expect(s.story.openAt).toBe(open + 3);
    // path ข) of this row has no death in it: the story is done and the holder stays
    apply(ctx, [{ k: 'npcPath', npc: 'AZ01-1', path: 'b', op: 'force' }], { sys: 'combat' });
    expect(s.story.state).toBe('done');
    expect(s.story.result).toBe('b');
    expect(s.gen).toBe(1);
    expect(g.state.log.some((e) => e.id === 'AZ01-1' && e.data.what === 'end' && e.data.path === 'b')).toBe(true);
    // path ค) ends with the holder's death and the successor takes the position
    const t = slotsOf(g.state)['AZ01-2'];
    apply(ctx, [{ k: 'npcPath', npc: 'AZ01-2', path: 'c', op: 'force' }], { sys: 'combat' });
    expect(t.gen).toBe(2);
    expect(g.state.log.some((e) => e.id === 'AZ01-2' && e.data.what === 'die')).toBe(true);
  });

  it('the view of a slot reads the holder', () => {
    const g = world(1);
    const v = viewOf(makeCtx(g.state, data), 'AZ01-1')!;
    expect(v.alive).toBe(true);
    expect(v.name).toBe('ไอรัสวาร์');
    expect(v.role).toContain('ผู้ปรนนิบัติ');
  });
});

// ---------- M3: newcomers, ties, illness and grudge, clashes ----------

function mcLife(country: string, over: Partial<LifeState> = {}): LifeState {
  return {
    id: 'L1', name: 'x', race: 'human', gender: 'm', birthYear: 0, lifespan: 75, hAge: 20, country, home: country, traits: [], aptitudes: {}, skills: [], blessings: [], curses: [], fate: [], cls: 'c3', gold: 0,
    stats: { pow: 1, mag: 1, spd: 1, luk: 1, int: 1, vit: 1 }, items: [], flags: [], passed: {}, pending: [], memory: [], godFaith: 0, heart: 0, ext: {}, ...over,
  };
}

/** Puts a living holder in the position with a story that waits for a long time (the roster may have left it absent). */
function revive(g: Game, id: string) {
  const s = slotsOf(g.state)[id];
  const now = g.state.clock.worldYear;
  s.status = 'alive';
  s.alive = true;
  s.born = now - 40;
  s.span = 90;
  s.story = { state: 'wait', mode: 'age', openAt: now + 1e6, endAt: null, mc: false, cut: [], add: {}, mul: {} };
  s.rel = {};
  s.sick = undefined;
  s.follow = undefined;
  return s;
}

describe('npc: newcomers NT-01 to NT-54 (succession.md §5)', () => {
  it('none before the first 100 years; then the countries roll at each block of 100 years', () => {
    const g = world(3);
    g.worldSteps(9);
    expect(npcState(g.state).newcomers).toEqual([]);
    g.worldSteps(1);
    const first = npcState(g.state).newcomers.length;
    expect(first).toBeGreaterThan(10); // 143 countries, 40% of them with a template that fits (era 1 and no world events yet)
    expect(first).toBeLessThan(80);
    g.worldSteps(10);
    expect(npcState(g.state).newcomers.length).toBeGreaterThan(first);
  });

  it('writes an `npc/arrive` entry for each newcomer with the template (the key of its NT-xx scene), the country and whether it came to the character', () => {
    const g = world(3, true);
    g.worldSteps(10);
    const made = npcState(g.state).newcomers;
    const arrivals = g.state.log.filter((e) => e.sys === 'npc' && e.kind === 'arrive');
    expect(made.length).toBeGreaterThan(10);
    expect(arrivals.map((e) => e.id).sort()).toEqual([...made].sort());
    for (const e of arrivals) {
      const s = slotsOf(g.state)[e.id!];
      expect(e.data).toMatchObject({ template: s.nt!.tpl, name: s.name, place: s.home, near: false });
      expect(e.data.template).toMatch(/^NT-\d+$/);
      expect(e.level).toBe(0);
    }
    // without a life and without the trace nothing is written (the world run of 1,800 years keeps its log small)
    const quiet = world(3);
    quiet.worldSteps(10);
    expect(quiet.state.log.filter((e) => e.kind === 'arrive')).toHaveLength(0);
  });

  it('a template is used once per country, the id follows the highest number of the country, the continent templates stay on their continent', () => {
    const g = world(5);
    g.worldSteps(150);
    const st = npcState(g.state);
    const idx = npcIndex(g.ctx);
    const seen = new Set<string>();
    const ids = new Set<string>();
    expect(st.newcomers.length).toBeGreaterThan(100);
    for (const id of st.newcomers) {
      expect(ids.has(id)).toBe(false);
      ids.add(id);
      expect(idx.rows.has(id)).toBe(false);
      const s = slotsOf(g.state)[id];
      const t = idx.templates.get(s.nt!.tpl)!;
      const key = `${s.home}:${t.id}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
      const rosterMax = Math.max(...(idx.byCountry.get(s.home) ?? []).map((r) => r.seq));
      expect(s.nt!.seq).toBeGreaterThan(rosterMax);
      expect(id).toBe(`${s.home.replace('-', '')}-${s.nt!.seq}`);
      expect(t.continents.length === 0 || t.continents.includes(idx.countries.get(s.home)!.continent)).toBe(true);
      expect(s.name).toBe(t.name);
      expect(rowOf(g.ctx, id)!.name).toBe(t.name);
    }
  });

  it('the start of era 2 rolls at once, with the templates of that era', () => {
    const g = world(2);
    g.worldSteps(3);
    expect(npcState(g.state).newcomers).toEqual([]);
    g.state.world.era = 2;
    g.worldSteps(1);
    const made = npcState(g.state).newcomers;
    expect(made.length).toBeGreaterThan(10);
    const idx = npcIndex(g.ctx);
    for (const id of made) expect(idx.templates.get(slotsOf(g.state)[id].nt!.tpl)!.eras).toContain('2');
  });

  it('the conditions of the templates read the country and the world', () => {
    const g = world(1);
    const ctx = g.ctx;
    const idx = npcIndex(ctx);
    const country = (id: string) => idx.countries.get(id)!;
    const has = (c: string, tag: string, nt: string) => candidatesFor(ctx, country(c), tag).some((x) => x.t.id === nt);
    // NT-19: Azgar, but not AZ-09, and only before the sky falls
    expect(has('AZ-01', '1', 'NT-19')).toBe(true);
    expect(has('AZ-09', '1', 'NT-19')).toBe(false);
    expect(has('MH-01', '1', 'NT-19')).toBe(false);
    ctx.state.world.happened['DR-01'] = 300;
    expect(has('AZ-01', '1', 'NT-19')).toBe(false);
    // NT-27: the five countries of the forge
    expect(has('KD-01', '1', 'NT-27')).toBe(true);
    expect(has('KD-03', '1', 'NT-27')).toBe(false);
    // NT-21 and NT-22 need the fall of the sky
    ctx.state.clock.worldYear = 400;
    expect(has('AZ-01', '3', 'NT-21')).toBe(true);
    expect(has('AZ-01', '4a', 'NT-22')).toBe(true);
    expect(has('AZ-02', '4a', 'NT-22')).toBe(false);
    ctx.state.world.happened['SF-10'] = 400;
    expect(has('AZ-01', '3', 'NT-21')).toBe(false);
    // a template of another era is never offered
    expect(candidatesFor(ctx, country('AZ-01'), '1').every((x) => x.t.eras.includes('1'))).toBe(true);
    // the templates of a continent weigh double
    const w = candidatesFor(ctx, country('KD-01'), '1');
    expect(w.find((x) => x.t.id === 'NT-27')!.w).toBe(2);
    expect(w.filter((x) => !x.t.continentTemplate).every((x) => x.w === 1)).toBe(true);
  });

  it('a newcomer tells one story by age; a template that ends the holder leaves no successor; one that sends him away does not end the position', () => {
    const g = world(4);
    g.worldSteps(3);
    const ctx = g.ctx;
    const idx = npcIndex(ctx);
    let dead: string | undefined;
    let gone: string | undefined;
    for (let i = 0; i < 40 && !(dead && gone); i++) {
      for (const tag of ['1', '2', '3']) rollNewcomers(ctx, tag);
      for (const id of npcState(g.state).newcomers) {
        const s = slotsOf(g.state)[id];
        if (s.story.state !== 'wait') continue;
        const t = idx.templates.get(s.nt!.tpl)!;
        const ends = Object.entries(NT_ENDS[t.id] ?? {});
        if (!dead && ends.some(([, e]) => e![0] === 'dead')) dead = id;
        if (!gone && ends.some(([, e]) => e![0] === 'gone')) gone = id;
      }
    }
    expect(dead && gone).toBeTruthy();
    for (const [id, how] of [[dead!, 'dead'], [gone!, 'gone']] as const) {
      const s = slotsOf(g.state)[id];
      const [key] = Object.entries(NT_ENDS[s.nt!.tpl]!).find(([, e]) => e![0] === how)!;
      expect(s.refill).toBe(false);
      expect(s.status).toBe('alive');
      adjustPath(ctx, id, key as 'a', 'force', undefined, undefined);
      expect(s.story.result).toBe(key);
      expect(s.status).toBe(how);
      expect(s.gen).toBe(1);
    }
    // a story that fades or ends well keeps the holder, and the story is done
    const other = npcState(g.state).newcomers.find((id) => slotsOf(g.state)[id].status === 'alive' && slotsOf(g.state)[id].story.state === 'wait')!;
    const key = (['a', 'b', 'c'] as const).find((k) => !NT_ENDS[slotsOf(g.state)[other].nt!.tpl]?.[k])!;
    adjustPath(ctx, other, key, 'force', undefined, undefined);
    expect(slotsOf(g.state)[other].status).toBe('alive');
    expect(slotsOf(g.state)[other].story.state).toBe('done');
  });

  it('a newcomer is a living NPC for the rest of the system: view, condition, the table of the last era', () => {
    const g = world(6);
    g.worldSteps(12);
    const id = npcState(g.state).newcomers[0];
    const v = viewOf(g.ctx, id)!;
    expect(v.alive).toBe(true);
    expect(testCond(g.ctx, { k: 'npc', id, alive: true })).toBe(true);
    g.state.world.dfc = 10;
    g.worldSteps(1);
    expect(['alive', 'dead', 'gone']).toContain(slotsOf(g.state)[id].status);
  });
});

describe('npc: ties between stories (README §2.2)', () => {
  const pair = (seed: number, a: string, b: string) => {
    const g = world(seed);
    return { g, sa: revive(g, a), sb: revive(g, b), ctx: g.ctx };
  };

  it('2(ก): the path A ended on names B; the paths of B that name A gain 10 points and the others give them back', () => {
    const { ctx, sb } = pair(1, 'AZ05-1', 'AZ05-2');
    const rowB = rowOf(ctx, 'AZ05-2')!;
    const before = pathChances(ctx, rowB, sb);
    adjustPath(ctx, 'AZ05-1', 'a', 'force', undefined, undefined); // ก) "ดึงอำนาจ → ความขัดแย้งกับ AZ05-2"
    expect(sb.story.boost).toEqual(['b']); // ข) of B is "ถูก AZ05-1 ถอดถอน"
    const after = pathChances(ctx, rowB, sb);
    // paths a (40) and b (30) are open to B without the main character: b gets 10 of 70 more
    expect(after.b - before.b).toBeCloseTo(((100 - rowB.restPct) / 100) * (10 / 70), 6);
    expect(after.a + after.b + after.c + after['-']).toBeCloseTo(1, 6);
  });

  it('2(ค): a path of B that names the world event A ended on gets the same 10 points', () => {
    // KD02-2 ข) and KD06-1 ข) both end on DR-04 and the rows name each other
    const { ctx, sb } = pair(2, 'KD02-2', 'KD06-1');
    expect(tiedIds(ctx, rowOf(ctx, 'KD02-2')!)).toContain('KD06-1');
    adjustPath(ctx, 'KD02-2', 'b', 'force', undefined, undefined);
    expect(sb.story.boost).toContain('b');
  });

  it('2(ข): when the holder of A dies the paths of B that need him are cut, those that go on without him are not', () => {
    const { ctx, sb } = pair(1, 'AZ02-1', 'AZ02-4');
    expect(killNpc(ctx, 'AZ02-1', 'ทดสอบ', 'mc')).toBe(true);
    expect(sb.story.cut).toEqual(['a']); // "ทะเลาะกับ AZ02-1"; ค) "ได้เป็นผู้พิพากษาสูงสุดเมื่อ AZ02-1 ลงจากเวที" stays
  });

  it('3: an end that was not old age gives the tied NPC one follow-up story, which opens after his own and ends with revenge, the goal of A or letting go', () => {
    const { g, ctx, sb } = pair(1, 'AZ02-1', 'AZ02-4');
    sb.span = 120; // the follow-up lasts a fifth of the life, 24 years, and ends before he dies
    killNpc(ctx, 'AZ02-1', 'ทดสอบ', 'mc');
    expect(sb.follow).toMatchObject({ of: 'AZ02-1', doer: 'mc', state: 'wait' });
    g.worldSteps(2);
    expect(sb.follow!.state).toBe('wait'); // his own story (wait) still has paths
    sb.story.state = 'done';
    g.worldSteps(1);
    expect(sb.follow!.state).toBe('open');
    expect(['a', 'b', 'c']).toContain(sb.follow!.kind);
    for (let i = 0; i < 12 && sb.follow!.state !== 'done'; i++) g.worldSteps(1);
    expect(sb.follow!.state).toBe('done');
    // one at a time, and a follow-up makes none
    const others = Object.values(slotsOf(g.state)).filter((s) => s.follow && s.follow.of === 'AZ02-4');
    expect(others).toEqual([]);
  });

  it('3: the follow-up opens in place of the story when every path of it is cut', () => {
    const { g, ctx, sb } = pair(1, 'AZ02-1', 'AZ02-4');
    for (const k of ['a', 'b', 'c'] as const) adjustPath(ctx, 'AZ02-4', k, 'cut', undefined, undefined);
    killNpc(ctx, 'AZ02-1', 'ทดสอบ', 'mc');
    g.worldSteps(1);
    expect(sb.follow!.state).toBe('open');
  });

  it('3: revenge (ก) is drawn only when the doer is the character or a living NPC; old age gives no follow-up', () => {
    let b = 0;
    let n = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { g, ctx, sb } = pair(seed, 'AZ02-1', 'AZ02-4');
      sb.story.state = 'done';
      killNpc(ctx, 'AZ02-1', 'ฟ้าผ่า', 'god');
      g.worldSteps(1);
      expect(sb.follow!.kind).not.toBe('a');
      n++;
      b += sb.follow!.kind === 'b' ? 1 : 0;
    }
    expect(b).toBeGreaterThan(5);
    expect(b).toBeLessThan(n);
    const { ctx, g } = pair(1, 'AZ02-1', 'AZ02-4');
    end(ctx, slotsOf(g.state)['AZ02-1'], rowOf(ctx, 'AZ02-1')!, ctx.state.clock.worldYear, 'dead', 'ชราภาพ');
    expect(slotsOf(g.state)['AZ02-4'].follow).toBeUndefined();
  });
});

describe('npc: illness and grudge (prayers kin_sick and vengeance)', () => {
  it('an old holder is gravely ill for the last stretch of his life; healing ends it, lengthens the life and owes a favour', () => {
    const g = world(1);
    const ctx = g.ctx;
    const s = slotsOf(g.state)['AZ01-1'];
    const row = rowOf(ctx, 'AZ01-1')!;
    const now = g.state.clock.worldYear;
    s.born = now - 0.5 * s.span;
    advanceSlot(ctx, s, row, now);
    expect(isSick(ctx, 'AZ01-1')).toBe(false);
    s.born = now - 0.95 * s.span;
    advanceSlot(ctx, s, row, now);
    expect(isSick(ctx, 'AZ01-1')).toBe(true);
    expect(sickNpcs(ctx)).toContain('AZ01-1');
    const span = s.span;
    expect(healNpc(ctx, 'AZ01-1')).toBe(true);
    expect(isSick(ctx, 'AZ01-1')).toBe(false);
    expect(s.span).toBeGreaterThanOrEqual(span + 3);
    expect(s.rel['mc.favor']).toBe(1);
    advanceSlot(ctx, s, row, now + 0.2);
    expect(isSick(ctx, 'AZ01-1')).toBe(false); // a recovered holder is spared for a while
    expect(healNpc(ctx, 'ไม่มี')).toBe(false);
  });

  it('a story that says the holder falls ill makes him ill for a few years, then he dies of it or recovers', () => {
    const row = rows.find((r) => r.paths.some((p) => /ล้มป่วย/.test(p.text) && !p.effects.some((e) => e.k === 'death')))!;
    const key = row.paths.find((p) => /ล้มป่วย/.test(p.text))!.key;
    let died = 0;
    let well = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const g = world(seed, true);
      const s = revive(g, row.id);
      adjustPath(g.ctx, row.id, key, 'force', undefined, undefined);
      expect(isSick(g.ctx, row.id)).toBe(true);
      expect(s.sickEnd! - s.sick!).toBeGreaterThanOrEqual(3);
      expect(s.sickEnd! - s.sick!).toBeLessThanOrEqual(9);
      g.worldSteps(1);
      if (s.gen > 1) {
        died++;
        expect(g.state.log.some((e) => e.id === row.id && e.data.what === 'die' && e.data.cause === 'โรคภัย')).toBe(true);
      } else {
        well++;
        expect(isSick(g.ctx, row.id)).toBe(false);
      }
    }
    // ILL_DEATH is 30%
    expect(died).toBeGreaterThan(5);
    expect(well).toBeGreaterThan(25);
  });

  it('a plague in the country makes holders ill', () => {
    const g = world(1, true);
    g.state.world.countryFlags['AZ-01'] = ['plague'];
    g.worldSteps(20);
    expect(g.state.log.some((e) => e.sys === 'npc' && e.data.what === 'sick' && e.data.why === 'plague')).toBe(true);
  });

  it('grudge: a holder who holds 2 or more against the character is a nemesis; the kin of one the character killed hold a grudge, those of one the god killed do not', () => {
    const g = world(1);
    const ctx = g.ctx;
    const x = slotsOf(g.state)['AZ01-1'];
    expect(grudgeOf(ctx, 'AZ01-1')).toBe(0);
    expect(isNemesis(ctx, 'AZ01-1')).toBe(false);
    x.rel['mc.grudge'] = 2;
    expect(grudgeOf(ctx, 'AZ01-1')).toBe(2);
    expect(isNemesis(ctx, 'AZ01-1')).toBe(true);
    expect(nemeses(ctx)).toEqual(['AZ01-1']);
    // AZ01-1 names his disciple AZ09-3 in his unique cell
    for (const by of ['mc', 'god'] as const) {
      const w = world(1);
      const kin = revive(w, 'AZ09-3');
      revive(w, 'AZ01-1');
      killNpc(w.ctx, 'AZ01-1', 'ทดสอบ', by);
      expect(kin.rel['mc.grudge'] ?? 0).toBe(by === 'mc' ? 2 : 0);
    }
    expect(killNpc(ctx, 'AZ01-1', 'ทดสอบ')).toBe(true);
    expect(slotsOf(g.state)['AZ01-1'].gen).toBe(2); // the position goes on
    expect(isNemesis(ctx, 'AZ01-1')).toBe(false); // the new holder starts clean
  });

  it('a new life starts with no grudge, no meeting and no clash count', () => {
    const g = world(1);
    const s = slotsOf(g.state)['AZ02-1'];
    s.rel['mc.grudge'] = 3;
    s.clash = { n: 1, last: 'draw' };
    s.story.mc = true;
    s.story.seen = true;
    g.state.life = mcLife('AZ-02');
    g.born();
    expect(s.rel['mc.grudge']).toBeUndefined();
    expect(s.clash).toBeUndefined();
    expect(s.story.mc).toBe(false);
    expect(s.story.seen).toBe(false);
  });
});

describe('npc: clashes (combat/07-npc-clashes.md)', () => {
  const field = (seed = 1, country = 'AZ-02', over: Partial<LifeState> = {}) => {
    clearClashHandlers();
    const g = world(seed);
    g.state.life = mcLife(country, over);
    g.born();
    return g;
  };

  it('reads the opening cell of the rows into triggers', () => {
    const g = world(1);
    const first = (id: string) => clashesOf(g.ctx, id)[0];
    expect(triggersOf(first('AZ02-1'))).toEqual([
      { code: 'T', pct: 0.06, zone: 'AZ-02', age: [16, 40] },
      { code: 'B', pct: null },
    ]);
    expect(triggersOf(first('AZ10-3'))).toEqual([{ code: 'X', pct: 0.08, path: 'b', zone: 'AZ-10' }]);
    const p = triggersOf(first('AZ04-1'));
    expect(p.map((t) => t.code)).toEqual(['P', 'B']);
    expect(p[1].path).toBe('b');
    // every clash of the data has at least one trigger
    let n = 0;
    for (const r of rows) {
      for (const c of clashesOf(g.ctx, r.id)) {
        expect(triggersOf(c).length, c.id).toBeGreaterThan(0);
        n++;
      }
    }
    expect(n).toBe(102);
  });

  it('a clash of kind B reaches the handler of the combat system; its answer is written back into the lines of the NPC', () => {
    const g = field();
    const ctx = g.ctx;
    const seen: ClashReq[] = [];
    onClash((_, req) => {
      seen.push(req);
      return { outcome: 'talk' };
    });
    const s = slotsOf(g.state)['AZ02-1'];
    s.story.state = 'open';
    s.story.endAt = 1e6;
    expect(canClash(ctx, s)).toBe(true);
    expect(openClash(ctx, 'AZ02-1', 'B')).toBe('talk');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ npc: 'AZ02-1', code: 'B', why: 'mc' });
    expect(seen[0].clash.id).toBe('NF-AZ02-1');
    // "เจรจา: เส้น ข) บังคับเกิด เขายกเลิกดวล ไว้ใจ +2" and the standard: trust +2, known +1
    expect(s.story.state).toBe('done');
    expect(s.story.result).toBe('b');
    expect(s.rel['mc.trust']).toBe(4);
    expect(s.rel['mc.known']).toBe(1);
    expect(s.rel['mc.memory']).toBe(1);
    expect(g.state.log.some((e) => e.id === 'AZ02-1' && e.data.what === 'clash' && e.data.outcome === 'talk' && e.level === 2)).toBe(true);
    clearClashHandlers();
  });

  it('a veto means the clash does not open and is not counted; a handler that does not answer leaves it to the default', () => {
    const g = field();
    const ctx = g.ctx;
    const off = onClash(() => 'veto');
    expect(openClash(ctx, 'AZ02-1', 'B')).toBeNull();
    expect(slotsOf(g.state)['AZ02-1'].clash).toBeUndefined();
    off();
    let asked = 0;
    onClash(() => void asked++);
    const kind = openClash(ctx, 'AZ02-1', 'B');
    expect(asked).toBe(1);
    expect(['talk', 'win_spare', 'win_kill', 'draw', 'lose', 'flee']).toContain(kind);
    expect(slotsOf(g.state)['AZ02-1'].clash!.n).toBe(1);
    clearClashHandlers();
  });

  it('without a handler the default result is one of the written outcomes and the shares follow CLASH_DEFAULT', () => {
    const count: Record<string, number> = {};
    for (let seed = 1; seed <= 300; seed++) {
      const g = field(seed);
      const k = openClash(g.ctx, 'AZ02-1', 'B')!;
      expect(k).toBeTruthy();
      count[k] = (count[k] ?? 0) + 1;
    }
    // NF-AZ02-1 has win_spare, win_kill, draw and lose (its talk needs "ห้ามดวลถึงตาย" in the hand, no flight): 15 12 13 22 of 62
    for (const [k, w] of Object.entries({ win_spare: 15, win_kill: 12, draw: 13, lose: 22 })) {
      const p = w / 62;
      expect(Math.abs((count[k] ?? 0) / 300 - p), k).toBeLessThan(4 * sigma(p, 300) + 0.01);
    }
    expect(count.talk).toBeUndefined();
    expect(count.flee).toBeUndefined();
  });

  it('standard results: a draw makes a nemesis; a kill kills him and opens the succession; defeat touches the relations', () => {
    const g = field();
    const ctx = g.ctx;
    const s = slotsOf(g.state)['AZ02-1'];
    applyClashOutcome(ctx, 'NF-AZ02-1', 'draw');
    expect(isNemesis(ctx, 'AZ02-1')).toBe(true);
    expect(nemeses(ctx)).toContain('AZ02-1');
    expect(s.clash).toMatchObject({ n: 1, last: 'draw' });
    const h = field(2);
    applyClashOutcome(h.ctx, 'NF-AZ02-1', 'win_kill');
    const t = slotsOf(h.state)['AZ02-1'];
    expect(t.gen).toBe(2); // "ตาย เส้น ค) บังคับเกิด AZ02-2 ขึ้นแทน"
    expect(h.state.log.some((e) => e.id === 'AZ02-1' && e.data.what === 'die')).toBe(true);
    const l = field(3);
    applyClashOutcome(l.ctx, 'NF-AZ02-1', 'lose');
    expect(slotsOf(l.state)['AZ02-1'].rel['mc.grudge']).toBe(1);
  });

  it('two clashes per NPC in a life, the second only after a draw, a defeat or a flight, one per season', () => {
    const g = field();
    const ctx = g.ctx;
    onClash(() => ({ outcome: 'draw' }));
    expect(openClash(ctx, 'AZ02-1', 'B')).toBe('draw');
    expect(openClash(ctx, 'AZ02-1', 'B')).toBeNull(); // same season
    g.state.life!.hAge += 1;
    expect(openClash(ctx, 'AZ02-1', 'B')).toBe('draw');
    g.state.life!.hAge += 1;
    expect(openClash(ctx, 'AZ02-1', 'B')).toBeNull(); // two in this life
    clearClashHandlers();
    const h = field(2);
    onClash(() => ({ outcome: 'talk' }));
    expect(openClash(h.ctx, 'AZ02-1', 'B')).toBe('talk');
    h.state.life!.hAge += 1;
    expect(openClash(h.ctx, 'AZ02-1', 'B')).toBeNull(); // a talk does not open again
    clearClashHandlers();
  });

  it('needs the NPC alive and in the country of the character, and the path he is hindered on not cut', () => {
    const g = field(1, 'AZ-01');
    expect(openClash(g.ctx, 'AZ02-1', 'B')).toBeNull();
    const h = field(1, 'AZ-01');
    onClash(() => ({ outcome: 'talk' }));
    const x = clashesOf(h.ctx, 'AZ01-2');
    expect(x[0].id).toBe('NF-AZ01-2'); // B hinders path ก)
    adjustPath(h.ctx, 'AZ01-2', 'a', 'cut', undefined, undefined);
    expect(openClash(h.ctx, 'AZ01-2', 'B', { path: 'a' })).toBeNull();
    slotsOf(h.state)['AZ01-2'].refill = false;
    killNpc(h.ctx, 'AZ01-2', 'x');
    expect(openClash(h.ctx, 'AZ01-2', 'B')).toBeNull();
    clearClashHandlers();
  });

  it('kinds T and S roll their yearly chance while the character is in the country (and in the age they name)', () => {
    const run = (hAge: number, country = 'AZ-02') => {
      const g = field(1, country, { hAge });
      let calls = 0;
      onClash((_, req) => {
        if (req.clash.id === 'NF-AZ02-1' && req.code === 'T') calls++;
        return 'veto';
      });
      for (let i = 0; i < 3000; i++) meetZone(g.ctx);
      clearClashHandlers();
      return calls;
    };
    const n = run(20);
    // 6% a year: 180 of 3,000
    expect(n).toBeGreaterThan(140);
    expect(n).toBeLessThan(225);
    expect(run(50)).toBe(0); // "อายุเทียบ 16 ถึง 40"
    expect(run(20, 'AZ-03')).toBe(0); // not in AZ-02
  });

  it('kind X rolls the yearly chance for each year the character spent in the country when the NPC draws the path', () => {
    const g = field(1, 'AZ-10');
    const s = slotsOf(g.state)['AZ10-3'];
    const row = rowOf(g.ctx, 'AZ10-3')!;
    s.status = 'alive';
    s.story.mc = true;
    s.story.mcYears = 3;
    let calls = 0;
    onClash((_, req) => {
      if (req.why === 'path' && req.path === 'b') calls++;
      return 'veto';
    });
    for (let i = 0; i < 2000; i++) clashAtResolve(g.ctx, s, row, 'b');
    // 1 − 0.92³ = 22%
    expect(calls).toBeGreaterThan(380);
    expect(calls).toBeLessThan(510);
    const before = calls;
    for (let i = 0; i < 100; i++) clashAtResolve(g.ctx, s, row, 'a'); // another path is not his
    expect(calls).toBe(before);
    clearClashHandlers();
  });

  it('a result that forces a path while the draw of that very story is under way leaves the draw to take it', () => {
    const g = field(1, 'AZ-02');
    const ctx = g.ctx;
    const s = slotsOf(g.state)['AZ02-1'];
    // the story is open with the character in the country; a clash of kind X answers "talk" (path ข forced) in the middle of the draw
    s.story = { state: 'open', mode: 'age', openAt: 0, endAt: g.state.clock.worldYear, mc: true, cut: [], add: {}, mul: {}, mcYears: 1 };
    onClash(() => ({ outcome: 'talk' }));
    s.clash = undefined;
    // AZ02-1 has no X trigger, so it ends without a clash: the forced path of the call below is the one it takes
    adjustPath(ctx, 'AZ02-1', 'b', 'force', undefined, undefined, { kind: 'mc' });
    expect(s.story.result).toBe('b');
    expect(s.gen).toBe(1);
    clearClashHandlers();
  });
});
