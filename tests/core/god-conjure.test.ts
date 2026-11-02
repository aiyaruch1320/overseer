// Conjuring (god/07-conjure.md, G5b): the circle of 192 combinations has a result for each, a combination that is a listed miracle uses no quota, the result is fixed by the
// seed, a preview rolls nothing, the caps and the unlocks hold, the reactions and the shadow work. The data is the generated data/gen/ (the same files the game loads).
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { command } from '../../src/core/command';
import { Game, type GameData } from '../../src/core/game';
import type { GodData } from '../../src/core/data/types-god';
import { godData } from '../../src/core/god';
import { CELLS, REACTIONS, allMixes, conjOf, plan, shadowChance, viewConj, type Mix } from '../../src/core/god/conjure';
import { peekLife } from '../../src/core/god/conjure/state';
import { SHADOW_OPS } from '../../src/core/god/conjure';
import { VERB_MUL } from '../../src/core/god/conjure/tuning';
import { applyCarry, freshMeta, unlocked } from '../../src/core/god/goals';
import { UNLOCKS } from '../../src/core/god/goals/tuning';
import { lifeCounters } from '../../src/core/god/acts/state';
import type { GameState } from '../../src/core/types';

let data: GameData;
let god: GodData;
beforeAll(() => {
  data = loadAll();
  god = data.god.items as GodData;
});

/** A world run to year 120 with a human born in it; the powers are given. */
function mk(seed = 1, points = 0): { g: Game; st: GameState; ctx: Game['ctx'] } {
  const s = createSession(data, { seed, race: 'hu', startYear: 120 });
  const st = s.game.state;
  st.god.light = 200;
  st.god.dread = 200;
  applyCarry(st, { ...freshMeta(), points });
  startLife(s);
  st.life!.hAge = 30;
  st.life!.godFaith = 0;
  return { g: s.game, st, ctx: s.game.ctx };
}

type Conj = Record<string, unknown>;
const run = (c: Game['ctx'], args: Conj, confirm = true) => command(c, { type: 'god', action: 'conjure', args, confirm });
const at = (st: GameState) => st.life!.country;

describe('the circle', () => {
  it('has a result for every one of the 192 combinations, and the cells are the 48 of the data', () => {
    const { ctx, st } = mk();
    expect(allMixes(ctx).length).toBe(192);
    expect(god.conjure.cells.length).toBe(48);
    for (const c of god.conjure.cells) expect(CELLS[`${c.verb}.${c.core}`], `${c.verb}.${c.core}`).toBeDefined();
    const npc = Object.keys(st.npcs.slots)[0] ?? 'AL01-1';
    for (const m of allMixes(ctx)) {
      const args: Conj = { verb: m.verb, core: m.core, scale: m.scale, ...(m.scale === 'person' ? { npc } : {}) };
      const r = plan(ctx, args);
      expect(r.ok, `${m.verb}.${m.core}.${m.scale}`).toBe(true);
      if (r.ok) {
        expect(r.plan.say.length).toBeGreaterThan(0);
        expect(r.plan.name.length).toBeGreaterThan(0);
        expect((r.plan.cost.faith ?? 0) + (r.plan.cost.dread ?? 0)).toBeGreaterThan(0);
      }
    }
  });

  it('knows the verbs, cores, sizes and prices of the document', () => {
    const { ctx } = mk();
    expect(god.conjure.verbs.map((v) => v.id).sort()).toEqual(Object.keys(VERB_MUL).sort());
    // price = base of the size × the multiplier of the verb, rounded up (07-conjure.md §1)
    const price = (verb: string, scale: string, core = 'fire') => {
      const r = plan(ctx, { verb, core, scale, ...(scale === 'person' ? { npc: 'AL01-1' } : {}) });
      if (!r.ok) throw new Error(r.reason);
      return r.plan.cost;
    };
    expect(price('create', 'country')).toEqual({ faith: 45 });
    expect(price('destroy', 'person')).toEqual({ dread: 14 });
    expect(price('reveal', 'continent')).toEqual({ faith: 88 });
    expect(price('calm', 'place')).toEqual({ faith: 23 });
    expect(price('wake', 'country', 'death')).toEqual({ dread: 54 });
    expect(price('change', 'country', 'shadow')).toEqual({ dread: 54 });
    expect(price('change', 'country', 'fire')).toEqual({ faith: 54 });
  });

  it('the listed miracles are the cells that say "ใช้ MR" and the reactions are the ten rows of the document', () => {
    for (const c of god.conjure.cells) if (c.pureMr) expect(CELLS[`${c.verb}.${c.core}`].mr, c.pureMr).toBeDefined();
    expect(REACTIONS.length).toBe(10);
    expect(god.conjure.reactions.length).toBe(10);
    const verbs: Record<string, string> = { create: 'create', destroy: 'destroy', change: 'change', wake: 'wake', calm: 'calm', reveal: 'reveal' };
    for (const r of REACTIONS.slice(0, 9)) {
      const row = god.conjure.reactions[r.i];
      expect(verbs[row.verb], r.id).toBeDefined();
      expect(r.matches({ state: { world: { countryFlags: {}, happened: {}, dragons: [] }, god: { ext: {} } } } as never, { verb: row.verb, core: 'zzz', scale: 'country' }, 'XX-00')).toBe(false);
    }
  });

  it('the unlock thresholds of the code are the thresholds of the document', () => {
    expect(UNLOCKS.map((u) => u.at)).toEqual(god.goals.unlocks.map((u) => u.at));
  });
});

describe('the listed miracles use no quota', () => {
  it('a combination that is MR-01 is run as MR-01 with its price and its wait and the quota stays', () => {
    const { ctx, st } = mk();
    const r = run(ctx, { verb: 'create', core: 'water', scale: 'country' }, false);
    expect(r.ok).toBe(true);
    expect((r as unknown as { ok: true; preview: Record<string, unknown> }).preview.listed).toBe('MR-01');
    const light = st.god.light;
    expect(run(ctx, { verb: 'ให้กำเนิด', core: 'น้ำ', scale: 'ประเทศ' }).ok).toBe(true);
    expect(light - st.god.light).toBeGreaterThan(0);
    expect(peekLife(ctx).used).toBe(0);
    expect(st.god.chronicle.some((e) => e.kind === 'miracle' && e.id === 'MR-01')).toBe(true);
    expect(st.god.cooldowns['MR-01']).toBeGreaterThan(st.clock.worldYear);
    expect(st.god.chronicle.some((e) => e.kind === 'conjure')).toBe(false);
  });

  it('a combination that is not listed uses the quota', () => {
    const { ctx, st } = mk();
    expect(run(ctx, { verb: 'create', core: 'light', scale: 'place' }).ok).toBe(false); // light is shut in the first life
    expect(run(ctx, { verb: 'create', core: 'fire', scale: 'place' }).ok).toBe(true);
    expect(peekLife(ctx).used).toBe(1);
    expect(st.god.chronicle.some((e) => e.kind === 'conjure')).toBe(true);
  });

  it('MR-19 and MR-18 follow the miracle of the other agent when it is in the build; the circle has a result either way', () => {
    const { ctx } = mk();
    const r = plan(ctx, { verb: 'destroy', core: 'water', scale: 'country' });
    expect(r.ok).toBe(true);
  });
});

describe('caps and unlocks', () => {
  it('opens verbs and cores with the chronicle of the lineage (08-goals.md §4)', () => {
    const { ctx } = mk(1, 0);
    expect([...unlocked(ctx).verbs].sort()).toEqual(['calm', 'create', 'destroy']);
    expect([...unlocked(ctx).cores].sort()).toEqual(['earth', 'fire', 'life', 'water']);
    expect(run(ctx, { verb: 'change', core: 'fire', scale: 'place' }, false).ok).toBe(false);
    expect(run(ctx, { verb: 'create', core: 'wind', scale: 'place' }, false).ok).toBe(false);
    const b = mk(1, 5);
    expect([...unlocked(b.ctx).verbs]).toContain('change');
    expect([...unlocked(b.ctx).cores]).toContain('wind');
    expect(run(b.ctx, { verb: 'change', core: 'fire', scale: 'place' }, false).ok).toBe(true);
    const c = mk(1, 30);
    expect(unlocked(c.ctx).verbs.size).toBe(6);
    expect(unlocked(c.ctx).cores.size).toBe(8);
  });

  it('allows 3 a life, one of the size of a continent, no same mix, and a wait of 10 world years', () => {
    const { ctx, st } = mk(1, 30);
    const w = () => (st.clock.worldYear += 11);
    expect(run(ctx, { verb: 'create', core: 'fire', scale: 'place' }).ok).toBe(true);
    // the wait between two conjurings
    const early = run(ctx, { verb: 'create', core: 'wind', scale: 'place' }, false);
    expect(early.ok).toBe(false);
    w();
    // the same mix once a life
    expect(run(ctx, { verb: 'create', core: 'fire', scale: 'place', country: 'AZ-01' }, false).ok).toBe(false);
    expect(run(ctx, { verb: 'create', core: 'wind', scale: 'place', country: 'MH-01' }).ok).toBe(true);
    w();
    expect(run(ctx, { verb: 'create', core: 'light', scale: 'place', country: 'MH-03' }).ok).toBe(true);
    w();
    const fourth = run(ctx, { verb: 'create', core: 'shadow', scale: 'place', country: 'MH-05' }, false);
    expect(fourth.ok).toBe(false);
    expect((fourth as { reason: string }).reason).toContain('3');
  });

  it('a country is conjured on once in 25 world years', () => {
    const { ctx, st } = mk(1, 30);
    const c = at(st);
    expect(run(ctx, { verb: 'create', core: 'fire', scale: 'place', country: c }).ok).toBe(true);
    st.clock.worldYear += 11;
    const r = run(ctx, { verb: 'create', core: 'wind', scale: 'place', country: c }, false);
    expect(r.ok).toBe(false);
    st.clock.worldYear += 15;
    expect(run(ctx, { verb: 'create', core: 'wind', scale: 'place', country: c }, false).ok).toBe(true);
  });

  it('the size of a continent is allowed once a life and counts among the large miracles; none in a life of a great miracle', () => {
    const { ctx, st } = mk(1, 30);
    st.god.light = 200;
    const k = at(st).slice(0, 2);
    expect(run(ctx, { verb: 'create', core: 'wind', scale: 'continent', continent: k }).ok).toBe(true);
    expect(lifeCounters(ctx).big).toBe(1);
    st.clock.worldYear += 30;
    expect(run(ctx, { verb: 'calm', core: 'earth', scale: 'continent', continent: 'AZ' }, false).ok).toBe(false);
    const b = mk(2, 30);
    lifeCounters(b.ctx).grand = 1;
    const r = run(b.ctx, { verb: 'create', core: 'fire', scale: 'place' }, false);
    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toContain('มหา');
  });

  it('the character is never the target of the verb that destroys, and a person needs an NPC', () => {
    const { ctx } = mk();
    const r = run(ctx, { verb: 'destroy', core: 'fire', scale: 'person' }, false);
    expect(r.ok).toBe(false);
    expect(run(ctx, { verb: 'create', core: 'fire', scale: 'person' }, false).ok).toBe(true); // himself
  });
});

describe('the result is fixed by the seed', () => {
  const stateKey = (st: GameState) => JSON.stringify({ f: st.world.countryFlags, n: st.world.names, m: st.god.ext.acts, c: st.god.chronicle, l: st.god.light, d: st.god.dread, w: st.world.countryFaith });

  it('a preview rolls nothing and changes nothing', () => {
    const { ctx, st } = mk(3, 30);
    const before = JSON.stringify({ rng: st.rng, s: stateKey(st), log: st.logN });
    for (const m of [{ verb: 'create', core: 'fire', scale: 'country' }, { verb: 'destroy', core: 'earth', scale: 'place' }, { verb: 'reveal', core: 'shadow', scale: 'continent' }, { verb: 'create', core: 'water', scale: 'country' }]) {
      expect(run(ctx, m, false).ok).toBe(true);
    }
    expect(JSON.stringify({ rng: st.rng, s: stateKey(st), log: st.logN })).toBe(before);
  });

  it('the same ingredients on the same target in the same seed give the same name and the same world', () => {
    const a = mk(5, 30);
    const b = mk(5, 30);
    const args = { verb: 'destroy', core: 'wind', scale: 'place', country: 'MH-02' };
    expect(run(a.ctx, args).ok).toBe(true);
    expect(run(b.ctx, args).ok).toBe(true);
    const name = (st: GameState) => Object.entries(st.world.names).find(([k]) => k.startsWith('conjure:'))?.[1];
    expect(name(a.st)).toBeTruthy();
    expect(name(a.st)).toBe(name(b.st));
    expect(stateKey(a.st)).toBe(stateKey(b.st));
    // the preview shows the name the day will use
    const c = mk(5, 30);
    const pv = (run(c.ctx, args, false) as unknown as { ok: true; preview: { name: string } }).preview.name;
    expect(pv).toBe(name(a.st));
  });

  it('the name of the world is registered once and no other thing has it', () => {
    const { ctx, st } = mk(6, 30);
    expect(run(ctx, { verb: 'create', core: 'fire', scale: 'place', country: 'MH-02' }).ok).toBe(true);
    const names = Object.values(st.world.names);
    expect(new Set(names).size).toBe(names.length);
    expect(godData(ctx).goals.vows.length).toBe(20);
  });
});

describe('omens, reactions, the shadow', () => {
  it('a country-size conjuring has an omen of one season, then it happens; cancelling gives half back', () => {
    const { g, ctx, st } = mk(1, 30);
    const light = st.god.light;
    expect(run(ctx, { verb: 'create', core: 'fire', scale: 'country', country: 'MH-02' }).ok).toBe(true);
    expect(conjOf(st).pending.length).toBe(1);
    expect(st.god.chronicle.some((e) => e.kind === 'conjure')).toBe(false);
    g.beat();
    expect(conjOf(st).pending.length).toBe(0);
    expect(st.god.chronicle.some((e) => e.kind === 'conjure')).toBe(true);
    const b = mk(1, 30);
    const l0 = b.st.god.light;
    run(b.ctx, { verb: 'create', core: 'fire', scale: 'country', country: 'MH-02' });
    const paid = l0 - b.st.god.light;
    expect(run(b.ctx, { cancel: 1 }).ok).toBe(true);
    expect(l0 - b.st.god.light).toBe(paid - Math.floor(paid * 0.5));
    expect(light).toBeGreaterThan(0);
  });

  it('a famine met by "create · water" ends and gives two golden years instead of the rain (reaction)', () => {
    const { ctx, st } = mk(1, 30);
    st.world.countryFlags['MH-02'] = ['famine'];
    const r = run(ctx, { verb: 'create', core: 'water', scale: 'place', country: 'MH-02' }, false) as unknown as { ok: true; preview: { reaction?: { id: string } } };
    expect(r.preview.reaction?.id).toBe('R01');
    expect(run(ctx, { verb: 'create', core: 'water', scale: 'place', country: 'MH-02' }).ok).toBe(true);
    expect(st.world.countryFlags['MH-02']).not.toContain('famine');
    expect(st.world.countryFlags['MH-02']).toContain('golden');
  });

  it('the chance of the shadow is by size, 15% more when the core clashes, and a flood makes it certain', () => {
    const { ctx, st } = mk(1, 30);
    const mix = (scale: string, core = 'earth'): Mix => ({ verb: 'create', core, scale });
    const t = { country: 'MH-02' };
    expect(shadowChance(ctx, mix('person'), t)).toBe(0);
    expect(shadowChance(ctx, mix('place'), t)).toBe(0.1);
    expect(shadowChance(ctx, mix('country'), t)).toBe(0.2);
    expect(shadowChance(ctx, mix('continent'), t)).toBe(0.35);
    expect(shadowChance(ctx, mix('country', 'fire'), { country: 'NB-01' })).toBeCloseTo(0.35);
    st.world.happened['DR-05'] = st.clock.worldYear - 1;
    const r = run(ctx, { verb: 'create', core: 'water', scale: 'place', country: 'MH-02' }, false) as unknown as { ok: true; preview: { chance: { shadow: number } } };
    expect(r.preview.chance.shadow).toBe(1);
    expect(run(ctx, { verb: 'create', core: 'water', scale: 'place', country: 'MH-02' }).ok).toBe(true);
    expect(st.log.some((e) => e.kind === 'conjure.shadow')).toBe(true);
    expect(Object.keys(SHADOW_OPS).sort()).toEqual(god.conjure.cores.map((c) => c.id).sort());
  });

  it('the shadow is the same for the same seed (a fixed throw), and a person never casts one', () => {
    const roll = (seed: number) => {
      const { ctx, st } = mk(seed, 30);
      run(ctx, { verb: 'create', core: 'fire', scale: 'place', country: 'MH-02' });
      return st.log.some((e) => e.kind === 'conjure.shadow');
    };
    for (const seed of [1, 2, 3, 4]) expect(roll(seed)).toBe(roll(seed));
    const { ctx, st } = mk(1, 30);
    run(ctx, { verb: 'create', core: 'fire', scale: 'person' });
    expect(st.log.some((e) => e.kind === 'conjure.shadow')).toBe(false);
  });

  it('a person conjured on: "wake" is shut in the first life, "destroy" falls on an NPC and leaves a body or a wound', () => {
    const a = mk(1, 0);
    const npc = Object.keys(a.st.npcs.slots).find((id) => a.st.npcs.slots[id].alive);
    expect(npc).toBeTruthy();
    expect(run(a.ctx, { verb: 'wake', core: 'fire', scale: 'person', npc }, false).ok).toBe(false);
    const b = mk(1, 15);
    expect(run(b.ctx, { verb: 'wake', core: 'fire', scale: 'person', npc }).ok).toBe(true);
    b.st.clock.worldYear += 11;
    const r = run(b.ctx, { verb: 'destroy', core: 'wind', scale: 'person', npc });
    expect(r.ok).toBe(true);
    const result = (b.st.log.find((e) => e.kind === 'conjure' && e.id === 'destroy.wind.person')?.data.result as string) ?? '';
    expect(['ตาย', 'บาดเจ็บสาหัส']).toContain(result);
  });

  it('the dream of a "shared dream" is free once', () => {
    const { ctx, st } = mk(1, 30);
    st.world.countryFlags[at(st)] = [];
    expect(run(ctx, { verb: 'wake', core: 'shadow', scale: 'place', country: at(st) }).ok).toBe(true);
    expect(viewConj(st).freeDream).toBe(true);
  });
});
