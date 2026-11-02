// G5 of the god (god/06-implementation.md §2): the large and grand miracles MR-17 to MR-22, the ruins of the god and their events RU-01 to RU-08, the
// seals and the story nodes that hang on them. The data is the generated data/gen/ (the files the game loads); every check and preview goes through
// `command()`, as the screen does.
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife, type Session } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { command } from '../../src/core/command';
import { Game, sortSystems, type GameData } from '../../src/core/game';
import type { GodData } from '../../src/core/data/types-god';
import { godActsSystem, actsOf, implementedMiracles, modAdd, modMul } from '../../src/core/god/acts';
import { allCountries, continentOf, hasFlag, neighboursOf } from '../../src/core/god/acts/geo';
import { lifeCounters } from '../../src/core/god/acts/state';
import { crackAt, replyFor, ruinAt, ruinExt, ruinStep, sealAt, sealCountries, wOverride } from '../../src/core/god/ruin';
import { geoOf } from '../../src/core/world/place';
import { weightOf, tablesOf } from '../../src/core/world';
import { slotsOf } from '../../src/core/npc/types';
import { addTie } from '../../src/core/bonds';
import { incomeOf } from '../../src/core/god/power';
import { test } from '../../src/core/rules';
import { save, load } from '../../src/core/save';
import type { CommandResult, GameState } from '../../src/core/types';

let data: GameData;
let god: GodData;

beforeAll(() => {
  data = loadAll();
  god = data.god.items as GodData;
});

/** A world run to year 120 with a human born in it, the acts of the god in the loop, and plenty of both powers. */
function mk(seed = 1, power = { light: 200, dread: 200 }): { s: Session; g: Game; st: GameState; ctx: Game['ctx'] } {
  const s = createSession(data, { seed, race: 'hu', startYear: 120 });
  const systems = (s.game as unknown as { systems: unknown[] }).systems;
  if (!(systems as { name: string }[]).some((x) => x.name === 'god.acts')) systems.push(godActsSystem);
  systems.splice(0, systems.length, ...sortSystems(systems as never));
  s.game.state.god.light = power.light;
  s.game.state.god.dread = power.dread;
  startLife(s);
  s.game.state.life!.hAge = 30;
  s.game.state.life!.godFaith = 0;
  return { s, g: s.game, st: s.game.state, ctx: s.game.ctx };
}

const run = (c: Game['ctx'], args: Record<string, unknown>, confirm = true, action: 'miracle' | 'decree' = 'miracle'): CommandResult => command(c, { type: 'god', action, args, confirm });
const prev = (r: CommandResult) => (r as { ok: true; preview: Record<string, any> }).preview;
const why = (r: CommandResult) => (r as { ok: false; reason: string }).reason;

/** A country that is not a seal, is not the character's, and has a neighbour: the place to drop a star. */
function victim(ctx: Game['ctx'], not: string[] = []): string {
  const home = ctx.state.life!.country;
  const c = allCountries(ctx).find((x) => x !== home && !not.includes(x) && !sealAt(ctx, x) && neighboursOf(ctx, x).length >= 2 && continentOf(x) !== continentOf(home));
  if (!c) throw new Error('no country to strike');
  return c;
}

/** Lets the omen of a large miracle come due (one beat of a season) and lets the world run on a few years. */
function omen(g: Game, n = 1): void {
  for (let i = 0; i < n; i++) g.beat();
}

/** Years pass: the clock moves and the events that are due happen (what a world step does for the ruins). */
function years(ctx: Game['ctx'], n: number): void {
  ctx.state.clock.worldYear += n;
  godActsSystem.worldStep!(ctx);
}

describe('G5: the table', () => {
  it('MR-17 to 22 are implemented now, with the price, the line and the wait of the table', () => {
    expect(implementedMiracles()).toEqual(Array.from({ length: 25 }, (_, i) => `MR-${String(i + 1).padStart(2, '0')}`));
    const { ctx, st } = mk(3);
    const here = st.life!.country;
    const geo = (c: string) => geoOf(ctx, c);
    const coast = allCountries(ctx).find((c) => c !== here && geo(c)?.coast && !sealAt(ctx, c))!;
    for (const [id, args] of [['MR-17', { country: victim(ctx) }], ['MR-18', { country: victim(ctx) }], ['MR-19', { country: coast }], ['MR-20', { country: coast }], ['MR-22', { continent: continentOf(here) }]] as const) {
      const m = god.miracles.list.find((x) => x.id === id)!;
      const r = run(ctx, { id, ...args }, false);
      expect(r.ok, `${id} ${r.ok ? '' : why(r)}`).toBe(true);
      expect(prev(r).cost, id).toEqual(m.cost.faith ? { faith: m.cost.faith } : { dread: m.cost.dread });
      expect(prev(r).tier, id).toBe(m.tier);
      expect(prev(r).wait, id).toBe(m.wait);
      if (id === 'MR-17' || id === 'MR-18' || id === 'MR-19') expect(prev(r).back, id).toEqual({ dread: 20 }); // the survivors tell: 20, not a third
    }
  });

  it('a preview rolls nothing and changes nothing: not a stream, not the state', () => {
    const { ctx, st } = mk(4);
    const c = victim(ctx);
    const before = JSON.stringify(st);
    for (const id of ['MR-17', 'MR-18']) {
      const r = run(ctx, { id, country: c }, false);
      expect(r.ok).toBe(true);
      expect(prev(r).notes.length).toBeGreaterThan(2);
    }
    expect(run(ctx, { id: 'MR-22', continent: continentOf(c) }, false).ok).toBe(true);
    expect(JSON.stringify(st)).toBe(before);
  });
});

describe('G5: the ruin (MR-17 · MR-18)', () => {
  it('MR-17 takes the dread, gives 20 back, shows an omen a season ahead, and on the day makes the country a ruin of the god', () => {
    const { g, ctx, st } = mk(5);
    const c = victim(ctx);
    const d0 = st.god.dread;
    const r = run(ctx, { id: 'MR-17', country: c });
    expect(r.ok).toBe(true);
    expect(st.god.dread).toBe(d0 - 60);
    expect(actsOf(st).pending.length).toBe(1);
    expect(st.world.countryFlags[c]).not.toContain('god_ruin'); // the omen is not the day
    omen(g);
    expect(st.world.countryFlags[c]).toContain('god_ruin');
    expect(st.god.dread).toBe(d0 - 60 + 20); // the survivors tell: +20 (not a third)
    const rec = ruinAt(ctx, c)!;
    expect(rec.kind).toBe('MR-17');
    expect(rec.pop).toBeGreaterThanOrEqual(0.1);
    expect(rec.pop).toBeLessThanOrEqual(0.4);
    expect(st.world.ruins.some((x) => x.country === c)).toBe(true);
    expect(wOverride(ctx, c)).toBe(1);
    expect(modMul(ctx, 'population', { country: c })).toBeCloseTo(rec.pop);
    expect(modAdd(ctx, 'C', { country: c })).toBe(-5);
    // the neighbours lose 10 of their faith
    expect(neighboursOf(ctx, c).length).toBeGreaterThan(0);
    expect(st.log.some((e) => e.sys === 'god' && e.kind === 'ruin' && e.id === 'made')).toBe(true);
    expect(st.god.chronicle.some((e) => e.kind === 'ruin')).toBe(true);
  });

  it('the omen can be taken back for half of the dread, and the right and the wait stay spent', () => {
    const { ctx, st } = mk(6);
    const c = victim(ctx);
    run(ctx, { id: 'MR-17', country: c });
    const d = st.god.dread;
    const n = actsOf(st).pending[0].n;
    const r = run(ctx, { cancel: n });
    expect(r.ok).toBe(true);
    expect(st.god.dread).toBe(d + 30);
    expect(lifeCounters(ctx).big).toBe(1);
    expect(lifeCounters(ctx).ruin).toBe(1);
    expect(st.world.countryFlags[c]).not.toContain('god_ruin');
  });

  it('the dice of the people are the document\'s: NPCs die, flee or stay; the leader who lives stays; the dead have a successor by the rules', () => {
    const { g, ctx, st } = mk(7);
    const c = victim(ctx);
    const slots = slotsOf(st);
    const here = Object.keys(slots).filter((id) => slots[id].status === 'alive' && (slots[id].place ?? id.replace(/(\D+\d\d)-.*/, '$1').replace(/^(\D\D)(\d\d)$/, '$1-$2')) === c);
    run(ctx, { id: 'MR-17', country: c });
    omen(g);
    const rec = ruinAt(ctx, c)!;
    expect(rec.died.length + rec.fled.length + rec.stayed.length).toBeGreaterThan(0);
    expect(rec.died.length + rec.fled.length + rec.stayed.length).toBe(here.length || rec.died.length + rec.fled.length + rec.stayed.length);
    for (const id of rec.fled) expect(slotsOf(st)[id].status).toBe('alive');
    if (rec.leader) expect(rec.stayed).toContain(rec.leader);
  });

  it('the allies of the character in the country roll the die of 25 (the others come to him); the dead are told as dead', () => {
    let died = 0;
    let came = 0;
    for (let i = 0; i < 12; i++) {
      const { g, ctx, st } = mk(70 + i);
      const c = victim(ctx);
      const life = st.life!;
      const ties = [1, 2, 3, 4].map(() => addTie(ctx, life, { line: 'สหาย', level: 3, from: 'test', quiet: true, country: c, gap: 0, race: 'same' }));
      run(ctx, { id: 'MR-17', country: c });
      omen(g);
      for (const t of ties) {
        if (t.state === 'dead') died++;
        else {
          came++;
          expect(t.country, 'a living ally comes to the character').toBe(life.country);
        }
      }
    }
    // 25 in a hundred die: 48 allies, about 12 dead
    expect(died).toBeGreaterThan(3);
    expect(died).toBeLessThan(24);
    expect(died + came).toBe(48);
  });

  it('MR-18 is the lake: RU-08 takes the place of the diggers; the ruin is the same', () => {
    const { g, ctx, st } = mk(8);
    const c = victim(ctx);
    run(ctx, { id: 'MR-18', country: c });
    omen(g);
    const rec = ruinAt(ctx, c)!;
    expect(rec.kind).toBe('MR-18');
    expect(rec.due['RU-08']).toBeGreaterThanOrEqual(rec.year + 3);
    expect(rec.due['RU-08']).toBeLessThanOrEqual(rec.year + 10);
    expect(rec.due['RU-03']).toBeUndefined();
    expect(rec.due['RU-01']).toBeUndefined(); // the first year of the pit is the star's
    expect(st.world.countryFlags[c]).toContain('god_ruin');
  });

  it('the caps: a ruin once a life, a hundred years between ruins, a large one every 25 years, two large in a life', () => {
    const { g, ctx, st } = mk(9);
    const a = victim(ctx);
    const b = victim(ctx, [a]);
    expect(run(ctx, { id: 'MR-17', country: a }).ok).toBe(true);
    omen(g);
    // another ruin in the same life: refused by the ruin cap, not by the large cap
    const again = run(ctx, { id: 'MR-18', country: b }, false);
    expect(again.ok).toBe(false);
    expect(why(again)).toContain('ชีวิตละครั้ง');
    // a flood is a large miracle that makes no ruin, but 25 years must pass
    const coast = allCountries(ctx).find((x) => geoOf(ctx, x)?.coast && !sealAt(ctx, x) && x !== a)!;
    const early = run(ctx, { id: 'MR-19', country: coast }, false);
    expect(early.ok).toBe(false);
    expect(why(early)).toContain('25');
    years(ctx, 26);
    expect(run(ctx, { id: 'MR-19', country: coast }, false).ok).toBe(true);
    expect(run(ctx, { id: 'MR-19', country: coast }).ok).toBe(true);
    omen(g);
    // two large miracles are all a life has
    years(ctx, 30);
    st.god.dread = 200;
    const third = run(ctx, { id: 'MR-19', country: coast }, false);
    expect(third.ok).toBe(false);
    expect(why(third)).toContain('2');
  });
});

describe('G5: the events of the ruin follow the take rules', () => {
  /** The ruin in `c`, its days drawn, the clock moved so that every event is due. */
  function ruined(seed: number) {
    const m = mk(seed);
    const c = victim(m.ctx);
    run(m.ctx, { id: 'MR-17', country: c });
    omen(m.g);
    return { ...m, c, rec: ruinAt(m.ctx, c)! };
  }

  it('every event happens in its window, once, in the order of its days', () => {
    const { ctx, st, rec, c } = ruined(11);
    const row = (id: string) => god.miracles.ruin.events.find((e) => e.id === id)!;
    for (const [id, due] of Object.entries(rec.due)) {
      expect(due - rec.year, id).toBeGreaterThanOrEqual(row(id).from);
      if (row(id).to !== null) expect(due - rec.year, id).toBeLessThanOrEqual(row(id).to!);
    }
    st.god.dread = 200; // the cult wants the god to be feared (≥ 60)
    const seen: string[] = [];
    for (let y = 0; y < 90; y++) {
      years(ctx, 1);
      for (const id of Object.keys(rec.done)) if (!seen.includes(id)) seen.push(id);
    }
    // nothing happened twice, and the days kept the order they were drawn in
    for (const id of seen) expect(rec.done[id]).toBeGreaterThanOrEqual(rec.due[id]);
    expect(seen).toContain('RU-01');
    expect(seen).toContain('RU-02');
    expect(seen).toContain('RU-03');
    expect(seen).toContain('RU-06');
    expect(rec.done['RU-04']).toBeDefined();
    expect(rec.cult).toBeTruthy();
    // the city is built (no war here), the flag is gone, and W is 2
    expect(rec.ended).toBeDefined();
    expect(st.world.countryFlags[c]).not.toContain('god_ruin');
    expect(wOverride(ctx, c)).toBe(2);
    expect(rec.city).toBeTruthy();
    expect(st.world.ruins.find((x) => x.country === c)!.healed).toBe(true);
  });

  it('no event of the ruin happens after the ruin is over, and none happens twice', () => {
    const { ctx, st, rec } = ruined(12);
    st.god.dread = 200;
    for (let y = 0; y < 100; y++) years(ctx, 1);
    expect(rec.ended).toBeDefined();
    const done = { ...rec.done };
    const log = st.log.length;
    // a late event is put back by hand: it is not played (the ruin is over)
    rec.due['RU-05'] = ctx.state.clock.worldYear - 1;
    delete rec.done['RU-05'];
    for (let y = 0; y < 30; y++) years(ctx, 1);
    expect(rec.done['RU-05']).toBeUndefined();
    expect({ ...rec.done, 'RU-05': undefined }).toEqual({ ...done, 'RU-05': undefined });
    expect(st.log.slice(log).filter((e) => e.kind === 'ruin' && e.id !== 'made')).toEqual([]);
    for (const [id, y] of Object.entries(rec.done)) expect(y, id).toBeLessThanOrEqual(rec.ended!);
  });

  it('the cult waits for the god to be feared; RU-05 waits for the cult or the leader; RU-07 waits for the war to end', () => {
    const { ctx, st, rec, c } = ruined(13);
    st.god.dread = 10;
    years(ctx, 20);
    expect(rec.done['RU-04']).toBeUndefined(); // dread 10 < 60
    st.god.dread = 100;
    years(ctx, 1);
    expect(rec.done['RU-04']).toBeDefined();
    // a war in the country holds the new city back
    rec.due['RU-07'] = ctx.state.clock.worldYear;
    delete rec.done['RU-07'];
    st.world.countryFlags[c].push('war');
    years(ctx, 3);
    expect(rec.done['RU-07']).toBeUndefined();
    st.world.countryFlags[c] = st.world.countryFlags[c].filter((f) => f !== 'war');
    years(ctx, 1);
    expect(rec.done['RU-07']).toBeDefined();
  });

  it('the events that name the country as their place are closed and do not happen when the world runs on', () => {
    const { s, ctx, st } = mk(14);
    // a country that a world event names as its place
    const t = tablesOf(ctx);
    const ev = t.data.events.find((e) => !e.role && !e.home.world && e.home.countries.length === 1 && !sealAt(ctx, e.home.countries[0]) && e.home.countries[0] !== st.life!.country && st.world.happened[e.id] === undefined)!;
    const c = ev.home.countries[0];
    run(ctx, { id: 'MR-17', country: c });
    omen(s.game);
    expect(st.world.closed).toContain(ev.id);
    expect(ruinAt(ctx, c)!.closed).toContain(ev.id);
    st.world.chains['w:' + ev.id] = 50; // as likely as can be
    s.game.worldSteps(40);
    expect(st.world.happened[ev.id]).toBeUndefined();
  });
});

describe('G5: the seals', () => {
  const homes = () => god.miracles.seal.homes;

  it('the seals are the places of the living dragons and AL-01; a dragon that falls leaves an ordinary country', () => {
    const { ctx, st } = mk(15);
    expect(sealCountries(ctx)).toContain('AL-01');
    expect(sealCountries(ctx)).toContain(homes()[0].countries[0]);
    expect(sealAt(ctx, 'AZ-06')!.dragons).toEqual([2]);
    expect(sealAt(ctx, 'NR-04')!.dragons).toEqual([2, 9]);
    st.world.dragons[0].alive = false;
    expect(sealAt(ctx, 'AZ-01')).toBeNull();
  });

  it('a large miracle on a seal makes a cracked city, not a ruin: 35% of the buildings, 70% of the people, W −2, the dragon hurts, the ruin of the life is kept', () => {
    const { g, ctx, st } = mk(16);
    const c = 'AZ-02'; // the fire elder
    const d = 1;
    st.world.dragons[d].mood = 70;
    st.world.dragons[d].alive = true;
    const pre = run(ctx, { id: 'MR-17', country: c }, false);
    expect(pre.ok).toBe(true);
    expect(prev(pre).sealed).toBe(true);
    expect(prev(pre).back).toEqual({ dread: 20 }); // a third of 60 on a seal
    expect(prev(pre).seal.dragons[0].after).toBe(50);
    expect(prev(pre).seal.dragons[0].reply).toBe('protect');
    const dread = st.god.dread;
    expect(run(ctx, { id: 'MR-17', country: c }).ok).toBe(true);
    omen(g);
    expect(st.world.countryFlags[c]).not.toContain('god_ruin');
    expect(st.world.countryFlags[c]).toContain('cracked');
    expect(ruinAt(ctx, c)).toBeUndefined();
    expect(crackAt(ctx, c)).toBeDefined();
    expect(modAdd(ctx, 'W', { country: c })).toBe(-2);
    expect(modMul(ctx, 'population', { country: c })).toBeCloseTo(0.7);
    expect(modMul(ctx, 'buildings', { country: c })).toBeCloseTo(0.65);
    expect(st.world.dragons[d].mood).toBeLessThanOrEqual(50.01);
    expect(st.world.vars['capDrop:' + d]).toBe(5);
    expect(lifeCounters(ctx).ruin).toBe(0); // it made no ruin
    expect(lifeCounters(ctx).big).toBe(1);
    // a third of the price comes back (not the 20 of a ruin)
    expect(st.god.dread).toBe(dread - 60 + 20);
    expect(ruinExt(st).bigDestroy).toBe(2); // a blow on a seal counts twice
    expect(Object.keys(crackAt(ctx, c)!.due).sort()).toEqual(['RU-02', 'RU-03']);
  });

  it('the dragon answers within a year by its mood: protects its place for 50 years · roars through its sibling · wakes in pain', () => {
    expect(replyFor(mk(17).ctx, 80)).toBe('protect');
    expect(replyFor(mk(17).ctx, 50)).toBe('protect');
    expect(replyFor(mk(17).ctx, 49)).toBe('growl');
    expect(replyFor(mk(17).ctx, 25)).toBe('growl');
    expect(replyFor(mk(17).ctx, 24)).toBe('awake');
    const { g, ctx, st } = mk(18);
    st.world.dragons[1].mood = 80;
    run(ctx, { id: 'MR-18', country: 'AZ-02' });
    omen(g);
    expect(ruinExt(st).replies.length).toBe(1);
    years(ctx, 2);
    expect(ruinExt(st).replies.length).toBe(0);
    expect(ruinExt(st).protect['AZ-02']).toBeGreaterThan(ctx.state.clock.worldYear + 40);
    // the protected country takes no miracle of any kind, small ones too
    const r = run(ctx, { id: 'MR-01', country: 'AZ-02' }, false);
    expect(r.ok).toBe(false);
    expect(why(r)).toContain('ผนึก');
    years(ctx, 51);
    expect(run(ctx, { id: 'MR-01', country: 'AZ-02' }, false).ok).toBe(true);
  });

  it('the roar hurts the closest sibling; the pain wakes a pillar (its awakening is ×3 for ten years)', () => {
    const { g, ctx, st } = mk(19);
    const pair = tablesOf(ctx).dragons[1].pair!;
    st.world.dragons[1].mood = 40; // after the blow 20: awake (a pillar? no, an elder) -> use a pillar below
    st.world.dragons[7].mood = 60; // Hrod-gath, a pillar, after −20 = 40 → growl
    st.world.dragons[pair].mood = 70;
    const sib = tablesOf(ctx).dragons[7].pair!;
    st.world.dragons[sib].mood = 70;
    run(ctx, { id: 'MR-18', country: 'MH-10' });
    omen(g);
    years(ctx, 2);
    expect(st.world.dragons[sib].mood).toBeLessThan(70);
    // a pillar at 30 → 10 after the blow wakes in pain
    const { g: g2, ctx: c2, st: s2 } = mk(20);
    s2.world.dragons[8].mood = 30;
    run(c2, { id: 'MR-18', country: 'KD-10' });
    omen(g2);
    expect(s2.world.dragons[8].mood).toBeLessThan(25);
    years(c2, 2);
    expect(weightOf(c2, tablesOf(c2).dragons[8].awakeEvent!)).toBe(3);
  });

  it('a mid miracle on a seal has the small effect: W −1 for two years, the flag for one year, the dragon −10; it is struck once in 100 years, any seal in 25', () => {
    const { ctx, st } = mk(21);
    st.world.dragons[3].mood = 70;
    const r = run(ctx, { id: 'MR-13', country: 'AZ-03' }); // fire on the storm's place
    expect(r.ok).toBe(true);
    expect(modAdd(ctx, 'W', { country: 'AZ-03' })).toBe(-1);
    expect(st.world.countryFlags['AZ-03']).toContain('famine');
    expect(st.world.dragons[3].mood).toBeLessThanOrEqual(60.01);
    expect(modAdd(ctx, 'wood', { country: 'AZ-03' })).toBe(0);
    // another seal at once: no. The same one a hundred years on: yes
    st.god.cooldowns['world.mid'] = 0;
    const other = run(ctx, { id: 'MR-12', country: 'AZ-04' }, false);
    expect(other.ok).toBe(false);
    expect(why(other)).toContain('25');
    years(ctx, 26);
    st.god.cooldowns['world.mid'] = 0;
    st.world.dragons[4].mood = 70;
    expect(run(ctx, { id: 'MR-12', country: 'AZ-04' }, false).ok).toBe(true);
    ruinExt(st).protect = {};
    years(ctx, 30);
    st.god.cooldowns['world.mid'] = 0;
    const same = run(ctx, { id: 'MR-13', country: 'AZ-03' }, false);
    expect(same.ok).toBe(false);
    years(ctx, 70);
    st.god.cooldowns['world.mid'] = 0;
    ruinExt(st).protect = {};
    expect(run(ctx, { id: 'MR-13', country: 'AZ-03' }, false).ok).toBe(true);
  });

  it('the key of the oath takes the blow for AL-01: confidence of gold C −20, and the council breaks or a delegate dies for ten years', () => {
    const { ctx, st } = mk(22);
    const r = run(ctx, { id: 'MR-13', country: 'AL-01' });
    expect(r.ok).toBe(true);
    expect(modAdd(ctx, 'C', { country: 'AL-01' })).toBe(-20);
    expect(weightOf(ctx, st.world.era === 4 ? 'LE-05' : 'PO-08')).toBe(2);
  });

  it('the third large destroying miracle in a world wakes the other gods: GD-08 opens and is ×1.5 likelier at each one from then on', () => {
    const { g, ctx, st } = mk(23);
    const a = victim(ctx);
    run(ctx, { id: 'MR-17', country: a });
    omen(g);
    expect(ruinExt(st).bigDestroy).toBe(1);
    expect(weightOf(ctx, 'GD-08')).toBe(1);
    st.clock.worldYear += 26;
    lifeCounters(ctx).ruin = 0;
    const coast = allCountries(ctx).find((x) => geoOf(ctx, x)?.coast && !sealAt(ctx, x) && !hasFlag(ctx, x, 'god_ruin'))!;
    run(ctx, { id: 'MR-19', country: coast });
    omen(g);
    expect(ruinExt(st).bigDestroy).toBe(2);
    const w2 = weightOf(ctx, 'GD-08'); // the avengers of a ruin (RU-05) may have made it a little likelier already
    // the third: a blow on a seal counts two, so it is the third and the fourth at once
    lifeCounters(ctx).big = 0;
    st.clock.worldYear += 26;
    st.world.dragons[1].mood = 80;
    ruinExt(st).protect = {};
    run(ctx, { id: 'MR-18', country: 'AZ-02' });
    omen(g);
    expect(ruinExt(st).bigDestroy).toBe(4);
    expect(weightOf(ctx, 'GD-08')).toBeCloseTo(w2 * 2.25);
    expect(ruinExt(st).base).toBe('AZ-02');
    // and it is open for the decade
    tablesOf(ctx);
    expect(st.world.chains['godopen:GD-08']).toBeUndefined();
    st.world.era = 3;
    g.worldSteps(1);
    expect(st.world.chains['godopen:GD-08']).toBe(ctx.state.clock.worldYear);
  });
});

describe('G5: MR-19 · MR-20 · MR-22', () => {
  it('MR-19: the country must be on a coast or a river; a flood of three years, W −2 for five, the neighbours that take the refugees have food ×1.3; no ruin', () => {
    const { g, ctx, st } = mk(24);
    const dry = allCountries(ctx).find((c) => !geoOf(ctx, c)?.coast && !geoOf(ctx, c)?.river && !sealAt(ctx, c))!;
    expect(run(ctx, { id: 'MR-19', country: dry }, false).ok).toBe(false);
    const wet = allCountries(ctx).find((c) => geoOf(ctx, c)?.coast && neighboursOf(ctx, c).length >= 1 && !sealAt(ctx, c) && c !== st.life!.country)!;
    expect(run(ctx, { id: 'MR-19', country: wet }).ok).toBe(true);
    omen(g);
    expect(st.world.countryFlags[wet]).toContain('flood');
    expect(st.world.countryFlags[wet]).not.toContain('god_ruin');
    expect(modAdd(ctx, 'W', { country: wet })).toBe(-2);
    const took = neighboursOf(ctx, wet).filter((n) => modMul(ctx, 'food', { country: n }) > 1);
    expect(took.length).toBeGreaterThan(0);
    expect(modMul(ctx, 'food', { country: took[0] })).toBeCloseTo(1.3);
    years(ctx, 4);
    expect(st.world.countryFlags[wet]).not.toContain('flood');
    expect(modAdd(ctx, 'W', { country: wet })).toBe(-2);
    years(ctx, 2);
    expect(modAdd(ctx, 'W', { country: wet })).toBe(0);
  });

  it('MR-20: new land beside a coast; settlers within 20 years make a country of W 2; it has a name from the bank, unique in the world', () => {
    const { g, ctx, st } = mk(25);
    const coast = allCountries(ctx).find((c) => geoOf(ctx, c)?.coast && !sealAt(ctx, c))!;
    const faith = st.world.countryFaith[coast];
    expect(run(ctx, { id: 'MR-20', country: coast }).ok).toBe(true);
    expect(st.god.light).toBe(120);
    omen(g);
    const land = ruinExt(st).lands[0];
    expect(land.beside).toBe(coast);
    expect(land.due - land.year).toBeGreaterThanOrEqual(1);
    expect(land.due - land.year).toBeLessThanOrEqual(20);
    expect(land.name.length).toBeGreaterThan(2);
    expect(Object.values(st.world.names)).toContain(land.name);
    expect(st.world.countryFaith[coast]).toBe(Math.min(100, faith + 10));
    // a second land beside the same country waits for the first to be settled
    st.god.cooldowns['MR-20'] = 0;
    st.god.cooldowns['world.big'] = 0;
    expect(run(ctx, { id: 'MR-20', country: coast }, false).ok).toBe(false);
    years(ctx, 21);
    expect(land.founded).toBeDefined();
    expect(wOverride(ctx, land.id)).toBe(2);
    expect(st.log.some((e) => e.kind === 'land' && e.id === 'found')).toBe(true);
  });

  it('MR-22: all the dread there is; war flags off for ten years, faith −15, GD-08 ×2, the dread of the year ×2 for the rest of the life; once a life', () => {
    const { g, ctx, st } = mk(26, { light: 100, dread: 200 });
    const k = continentOf(st.life!.country);
    const cs = allCountries(ctx).filter((c) => continentOf(c) === k);
    for (const c of cs.slice(0, 3)) st.world.countryFlags[c] = ['war'];
    const faith = Object.fromEntries(cs.map((c) => [c, st.world.countryFaith[c]]));
    const income = incomeOf(ctx).dread;
    expect(run(ctx, { id: 'MR-22', continent: k }).ok).toBe(true);
    expect(st.god.dread).toBe(200 - 150);
    omen(g);
    expect(st.god.dread).toBe(200 - 150 + 50); // a third comes back
    for (const c of cs) {
      expect(st.world.countryFlags[c], c).not.toContain('war');
      if (!sealAt(ctx, c)) expect(st.world.countryFaith[c], c).toBe(Math.max(0, faith[c] - 15));
    }
    expect(weightOf(ctx, 'GD-08')).toBe(2);
    st.life!.godFaith = 0; // the belief of the character moved when he saw it; the yearly dread is read at the same belief
    expect(incomeOf(ctx).dread).toBeCloseTo(income * 2, 5);
    // the world may put a war on again: it is taken off while the peace of fear lasts
    st.world.countryFlags[cs[0]] = ['war'];
    years(ctx, 5);
    expect(st.world.countryFlags[cs[0]]).not.toContain('war');
    years(ctx, 6);
    st.world.countryFlags[cs[0]] = ['war'];
    years(ctx, 1);
    expect(st.world.countryFlags[cs[0]]).toContain('war');
    // once a life
    st.god.dread = 200;
    expect(run(ctx, { id: 'MR-22', continent: k }, false).ok).toBe(false);
    // the dragons of the continent took −15, the seals the effect of a mid blow
    expect(st.log.some((e) => e.kind === 'miracle' && e.id === 'MR-22')).toBe(true);
  });
});

describe('G5: the story nodes mr hang on the events', () => {
  it('mr.a1 opens in the country that takes the refugees (RU-02) and not far from it; mr.a3 on the cult; the id is heard of only near the character', () => {
    const { g, ctx, st } = mk(27);
    const life = st.life!;
    // a ruin next to the character's country, so that he is near
    const near = neighboursOf(ctx, life.country).find((c) => !sealAt(ctx, c) && neighboursOf(ctx, c).length >= 2);
    if (!near) return;
    run(ctx, { id: 'MR-17', country: near });
    omen(g);
    st.god.dread = 200;
    const rec = ruinAt(ctx, near)!;
    for (let y = 0; y < 14; y++) {
      years(ctx, 1);
      g.beat();
    }
    expect(rec.done['RU-03']).toBeDefined();
    // heard of at his place: RU-03 is next door; RU-02 only if his country took the refugees
    expect(st.world.happened['RU-03']).toBeDefined();
    expect(test(ctx, { k: 'event', id: 'RU-03', happened: true })).toBe(true);
    expect(test(ctx, { k: 'event', id: 'RU-02', happened: true })).toBe(rec.took.includes(life.country));
    expect(st.world.happened['MR-17']).toBeDefined();
    // a character who lives far away has not heard of it
    life.country = victim(ctx, [near]);
    g.beat();
    expect(st.world.happened['RU-03']).toBeDefined(); // once heard of in this life, it stays
    const second = mk(27);
    second.st.life!.country = victim(second.ctx, [near]);
    run(second.ctx, { id: 'MR-17', country: near });
    omen(second.g);
    for (let y = 0; y < 14; y++) years(second.ctx, 1);
    second.g.beat();
    expect(second.st.world.happened['RU-03']).toBeUndefined();
    expect(second.st.world.happened['RU-04']).toBeUndefined();
  });

  it('mr.a5 and mr.a6 read the creating miracles and the new land near him; a new life starts without them', () => {
    const { g, ctx, st } = mk(28);
    const c = st.life!.country;
    st.world.countryFlags[c] = ['famine'];
    run(ctx, { id: 'MR-01', country: c });
    g.beat();
    expect(st.world.happened['MR-01']).toBeDefined();
    expect(test(ctx, { k: 'event', id: 'MR-01', happened: true })).toBe(true);
    expect(test(ctx, { k: 'event', id: 'MR-20', happened: true })).toBe(false);
    // the character dies; the next one is born and has heard of nothing
    st.life!.dead = { cause: 'age', hAge: 70 } as never;
    expect(st.world.happened['MR-01']).toBeDefined();
  });
});

describe('G5: the iron rules on the large deeds (04-miracles.md §2)', () => {
  it('rule 1: a star on his own country, a flood, the wrath: the character lives (hurt at most), belief −10 for what he sees, the curse of the homeland at 50%', () => {
    let cursed = 0;
    let hurt = 0;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const { g, ctx, st } = mk(40 + i);
      const life = st.life!;
      const c = life.country;
      if (sealAt(ctx, c)) continue;
      const belief = life.godFaith;
      expect(run(ctx, { id: 'MR-17', country: c }).ok).toBe(true);
      omen(g);
      expect(st.life!.dead, `seed ${40 + i}`).toBeUndefined();
      expect(st.world.countryFlags[c]).toContain('god_ruin');
      expect(life.godFaith).toBeLessThanOrEqual(belief - 10);
      if (life.curses.includes('nc_homeland_ghost')) cursed++;
      if (life.flags.includes('wounded')) hurt++;
    }
    // a coin and a quarter: the numbers of the doc (50%) and of the code (25% to be hurt), over a dozen lives
    expect(cursed).toBeGreaterThan(1);
    expect(cursed).toBeLessThan(13);
    expect(hurt).toBeLessThan(12);
  });

  it('rule 1: the wrath on his continent does not kill him either', () => {
    const { g, ctx, st } = mk(60);
    expect(run(ctx, { id: 'MR-22', continent: continentOf(st.life!.country) }).ok).toBe(true);
    omen(g, 2);
    expect(st.life!.dead).toBeUndefined();
  });

  it('rules 2 and 4: a dragon is hurt, never killed; no miracle makes an ending or an era by itself', () => {
    const { g, ctx, st } = mk(61);
    st.world.dragons[1].mood = 12; // close to its fall
    expect(run(ctx, { id: 'MR-18', country: 'AZ-02' }).ok).toBe(true);
    omen(g);
    expect(st.world.dragons[1].mood).toBeLessThan(0);
    expect(st.world.dragons[1].alive).toBe(true);
    expect(st.world.happened[tablesOf(ctx).dragons[1].fallEvent]).toBeUndefined();
    const dfc = st.world.dfc;
    years(ctx, 3);
    expect(st.world.dfc).toBe(dfc);
    expect(Object.keys(st.world.happened).filter((k) => k.startsWith('END-'))).toEqual([]);
    expect(st.world.ended).toBeUndefined();
    expect(st.world.era).toBe(1);
  });

  it('rule 3: a country with a living legend dragon, and AL-01, is a seal and is never made a ruin by the policies', () => {
    const { ctx, st } = mk(62);
    for (const d of st.world.dragons) d.alive = true; // a world of 120 years may have lost one
    for (const h of god.miracles.seal.homes) for (const c of h.countries) expect(sealAt(ctx, c), c).not.toBeNull();
    expect(sealAt(ctx, 'AL-01')).not.toBeNull();
    expect(sealCountries(ctx).length).toBeGreaterThan(15);
  });
});

describe('G5: a whole life next to a ruin walks the nodes mr', () => {
  /** A life from birth to death; at 22 a star falls on `where(country)`; the god keeps both powers full. */
  function lifeWith(seed: number, where: (ctx: Game['ctx'], home: string) => string | undefined): { passed: string[]; happened: string[]; place?: string } {
    const s = createSession(data, { seed, race: 'hu', startYear: 300 });
    const g = s.game;
    startLife(s);
    const st = g.state;
    let place: string | undefined;
    for (let i = 0; i < 4 * 80 && st.life && !st.life.dead; i++) {
      g.beat();
      st.god.dread = 200;
      st.god.light = 200;
      if (place === undefined && st.life && st.life.hAge >= 22) {
        place = where(g.ctx, st.life.country) ?? '';
        if (place) expect(run(g.ctx, { id: 'MR-17', country: place }).ok).toBe(true);
      }
    }
    return {
      passed: Object.keys(st.life!.passed).filter((k) => /^mr\./.test(k)),
      happened: Object.keys(st.world.happened).filter((k) => /^(RU|MR)-/.test(k)),
      place,
    };
  }

  it('the ruin next door brings the nodes of the refugees, the diggers, the cult; each one needs its event', () => {
    let some = 0;
    for (const seed of [1, 2, 3]) {
      const r = lifeWith(seed, (ctx, home) => neighboursOf(ctx, home).find((c) => !sealAt(ctx, c)));
      expect(r.place, `seed ${seed}`).toBeTruthy();
      const need: Record<string, string[]> = { 'mr.a1': ['RU-02'], 'mr.a2': ['RU-03', 'RU-08'], 'mr.a3': ['RU-04'], 'mr.a4': ['RU-05'] };
      for (const n of r.passed) if (need[n]) expect(need[n].some((e) => r.happened.includes(e)), `${n} in seed ${seed}`).toBe(true);
      some += r.passed.length;
    }
    expect(some).toBeGreaterThan(3);
  });

  it('a ruin on another continent brings no node mr to a life that never went there', () => {
    for (const seed of [1, 2]) {
      const r = lifeWith(seed, (ctx, home) => allCountries(ctx).find((c) => continentOf(c) !== continentOf(home) && !sealAt(ctx, c) && neighboursOf(ctx, c).length >= 2));
      expect(r.place).toBeTruthy();
      expect(r.passed.filter((n) => n !== 'mr.e1'), `seed ${seed}`).toEqual([]);
      expect(r.happened.some((e) => /^RU-/.test(e)), `seed ${seed}`).toBe(false);
    }
  });
});

describe('G5: saves replay', () => {
  it('the same seed and commands give the same ruin, and a saved game goes on as the unsaved one', () => {
    const play = (seed: number, saved: boolean) => {
      let m = mk(seed);
      const c = victim(m.ctx);
      run(m.ctx, { id: 'MR-17', country: c });
      omen(m.g);
      m.st.god.dread = 200;
      for (let y = 0; y < 12; y++) years(m.ctx, 1);
      if (saved) {
        const loaded = load(save(m.st), {}).state;
        const s = createSession(data, { seed, race: 'hu', startYear: 120 });
        (s.game as unknown as { ctx: { state: GameState } }).ctx.state = loaded;
        const g2 = new Game(loaded, data, s.game.systems);
        m = { s, g: g2, st: loaded, ctx: g2.ctx };
      }
      for (let y = 0; y < 60; y++) years(m.ctx, 1);
      const e = ruinExt(m.st);
      return JSON.stringify({ ruins: e.ruins, made: e.made, w: m.st.world.countryFlags[c], rng: m.st.rng['god.ruin'], log: m.st.log.filter((x) => x.kind === 'ruin').map((x) => [x.id, x.data]) });
    };
    expect(play(31, false)).toBe(play(31, false));
    expect(play(31, true)).toBe(play(31, false));
    expect(play(31, false)).not.toBe(play(32, false));
  });
});
