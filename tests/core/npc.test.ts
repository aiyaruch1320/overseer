// The NPC system against the document-level simulators (scripts/sim/sim-npc-timeline.mjs, sim-npc-fate.mjs, sim-npc-density.mjs)
// and the rules of docs/lore/npcs/README.md and succession.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { Game, makeCtx, versions, type GameData } from '../../src/core/game';
import { detached } from '../../src/core/rng';
import { apply, test as testCond } from '../../src/core/rules';
import { clone } from '../../src/core/save';
import { newGame } from '../../src/core/state';
import { countSlots, fateOutcome, npcState, npcSystem, pathChances, slotsOf, viewOf } from '../../src/core/npc';
import { ERA4_FATE } from '../../src/core/npc/tuning';
import type { Condition } from '../../src/core/types';
import type { NpcRow, NpcsFile } from '../../src/core/data/types-npcs';

let data: GameData;
let rows: NpcRow[];
beforeAll(() => {
  data = loadGen(['npcs', 'countries']);
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
        if (e.sys !== 'npc' || e.data.what !== 'end' || e.data.byDeath) continue;
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
    expect(obs.c / (obs.a + obs.b + obs.c + obs['-'])).toBeLessThan(0.02);
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
      died += era.filter((e) => e.data.what === 'die' && e.data.cause === 'ยุคปลาย' && rows.find((r) => r.id === e.id)!.seq !== 1 && !after[e.id!].keeper).length;
      gone += era.filter((e) => e.data.what === 'vanish' && rows.find((r) => r.id === e.id)!.seq !== 1).length;
      moved += holders.filter((r) => after[r.id].status === 'alive' && after[r.id].place !== placeBefore.get(r.id)).length;
    }
    expect(alive).toBeGreaterThan(1500);
    expect(Math.abs(died / alive - 0.05)).toBeLessThan(0.02);
    expect(Math.abs(gone / alive - 0.05)).toBeLessThan(0.02);
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

  it('effect npc records the meeting, the relation and one line of memory', () => {
    const g = world(1);
    g.state.life = {
      id: 'L1', name: 'x', race: 'human', gender: 'm', birthYear: 0, lifespan: 75, hAge: 20, country: 'AZ-01', home: 'AZ-01', traits: [], aptitudes: {}, skills: [], blessings: [], curses: [], fate: [], cls: 'c3', gold: 0,
      stats: { pow: 1, mag: 1, spd: 1, luk: 1, int: 1, vit: 1 }, items: [], flags: [], passed: {}, pending: [], memory: [], godFaith: 0, heart: 0, ext: {},
    };
    const ctx = makeCtx(g.state, data);
    apply(ctx, [{ k: 'npc', id: 'AZ01-1' }], { sys: 'story', id: 'hu.a1' });
    const s = slotsOf(g.state)['AZ01-1'];
    expect(s.rel['mc.known']).toBe(1);
    expect(g.state.log.some((e) => e.kind === 'npc' && e.data.what === 'meet' && e.id === 'AZ01-1' && e.level === 2)).toBe(true);
    expect(g.state.life!.memory[0]).toContain(s.name);
    apply(ctx, [{ k: 'npc', id: 'AZ01-1' }], { sys: 'story', id: 'hu.a1' });
    expect(g.state.life!.memory).toHaveLength(1);
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
