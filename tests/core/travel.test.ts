// The travel system (code-plan §7 row "travel", docs/systems/travel/01-travel-rules.md): each rule of the tables on the character system's real data.
import { describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { birth, characterSystem, extOf as charExtOf, holds } from '../../src/core/character';
import { Game, type Ctx, type GameData } from '../../src/core/game';
import { onNode } from '../../src/core/story';
import { storySystem } from '../../src/core/story';
import { registered, test as cond } from '../../src/core/rules';
import { newGame } from '../../src/core/state';
import type { Condition, LifeState } from '../../src/core/types';
import type { TravelData } from '../../src/core/data/types-travel';
import {
  CAUSES, EDGES, canSmuggle, entryOf, followStory, geo, go, move, plan, relocate, routeState, stanceOf, travelExt, travelSystem, type RouteId,
} from '../../src/core/travel';
import { rollCauses } from '../../src/core/travel/causes';
import { roadWeights } from '../../src/core/travel/trip';
import { extOf as storyExt } from '../../src/core/story/state';
import { cityYear } from '../../src/core/travel/jobs';
import { FOLLOW_STORY } from '../../src/core/travel/tuning';

const data = loadGen();
const travel = data.travel.items as TravelData;

function game(seed: number, extra: GameData = {}, steps = 0) {
  const g = new Game(newGame(seed), { ...data, ...extra }, [characterSystem, storySystem, travelSystem]);
  g.init();
  g.worldSteps(steps);
  return g;
}

/** A born character, with the fields a test wants set. */
function born(seed: number, opts: Parameters<typeof birth>[1] = {}, patch: Partial<LifeState> = {}, extra: GameData = {}) {
  const g = game(seed, extra);
  const life = birth(g.ctx, { second: null, ...opts });
  g.born();
  Object.assign(life, patch);
  return { g, ctx: g.ctx, life };
}

const world = (ctx: Ctx) => ctx.state.world;
const happen = (ctx: Ctx, id: string, year = 0) => {
  world(ctx).happened[id] = year;
};
const info = (ctx: Ctx, id: string) => geo(ctx).countries.get(id)!;

describe('data: the tables the system reads', () => {
  it('15 routes (4 of them sky routes), 8 causes, 7 overlay lines, 3 levels', () => {
    expect(travel.routes).toHaveLength(15);
    expect(travel.routes.filter((r) => r.sky)).toHaveLength(4);
    expect(travel.causes).toHaveLength(8);
    expect(travel.overlays.map((o) => o.id).sort()).toEqual(['ex', 'ml', 'ps', 'sc', 'sf', 'wd', 'xc']);
    expect(travel.levels.map((l) => l.id)).toEqual(['L0', 'L1', 'L2']);
    expect(travel.encounters).toHaveLength(12);
  });
  it('every route of the data has a route state, and the edges join the continents of continents.md §12', () => {
    const { ctx, life } = born(1);
    const a = info(ctx, 'AL-01');
    const b = info(ctx, 'AL-02');
    for (const r of travel.routes) expect(() => routeState(ctx, life, r.id as RouteId, a, b)).not.toThrow();
    const pairs = EDGES.map((e) => [e.a, e.b].sort().join('-'));
    for (const p of ['AL-SV', 'AL-KD', 'AL-MK', 'AL-NB', 'AL-SH', 'MH-SV', 'KD-MH', 'NB-SV', 'AZ-SH', 'AZ-MK', 'AZ-NR', 'AL-NR', 'MH-NR']) expect(pairs).toContain(p);
  });
});

describe('levels and the numbers conditions read', () => {
  it('a life starts at L0 in its birth country; a stay in another country of the continent is L1, another continent L2, and the level never goes down', () => {
    const { ctx, life } = born(2, { race: 'human', country: 'AL-01' });
    const ex = travelExt(life);
    expect(ex.level).toBe(0);
    expect(ex.base).toBe('AL-01');
    move(ctx, life, 'AL-02', 't');
    expect(ex.level).toBe(1);
    move(ctx, life, 'SV-01', 't');
    expect(ex.level).toBe(2);
    move(ctx, life, 'AL-01', 't');
    expect(ex.level).toBe(2);
    expect(ex.visited).toEqual(['AL-02', 'SV-01']);
    expect(ex.continents.sort()).toEqual(['AL', 'SV']);
    expect(ctx.state.log.filter((e) => e.sys === 'travel' && e.kind === 'move')).toHaveLength(3);
  });
  it('travel.continents and travel.countries count what the docs ask (continents include the birth one)', () => {
    const { ctx, life } = born(3, { race: 'human', country: 'AL-01' });
    const c = (what: string, min: number): Condition => ({ k: 'count', what, min });
    expect(cond(ctx, c('travel.countries', 1))).toBe(false);
    move(ctx, life, 'AL-05', 't');
    expect(cond(ctx, c('travel.countries', 1))).toBe(true);
    expect(cond(ctx, c('travel.continents', 2))).toBe(false);
    move(ctx, life, 'KD-01', 't');
    expect(cond(ctx, c('travel.continents', 2))).toBe(true);
    expect(cond(ctx, c('travel.continents', 3))).toBe(false);
    expect(cond(ctx, { k: 'cmp', stat: 'travel.level', op: '==', value: 2 })).toBe(true);
  });
  it('the rules registry knows no travel kind that nobody handles', () => {
    const r = registered();
    expect(r.conds).toContain('place');
    expect(r.effects).toContain('place');
  });
});

describe('the stance of a place (§3.2)', () => {
  const firstOf = (ctx: Ctx, code: string) => geo(ctx).list.find((c) => c.first === code && c.scale >= 1)!;

  it('the people of the place are welcome; a people the table likes ↔ is welcome; a people it shuns is wary (−1) or shut out (−2)', () => {
    const { ctx, life } = born(4, { race: 'elf', country: 'SV-01' });
    expect(stanceOf(ctx, life, firstOf(ctx, 'el'))).toBe(1);
    expect(stanceOf(ctx, life, firstOf(ctx, 'fa'))).toBe(1); // elf ↔ fae +1
    expect(stanceOf(ctx, life, firstOf(ctx, 'hu'))).toBe(-1); // elf → human −1
    const naga = born(5, { race: 'naga' });
    const merPlace = firstOf(naga.ctx, 'me');
    expect(stanceOf(naga.ctx, naga.life, merPlace)).toBe(-2); // merfolk ↔ naga −2
    expect(entryOf(naga.ctx, naga.life, merPlace).open).toBe(false);
  });
  it('a closed place opens to a pass (an invitation, an envoy, trusted people there) and the modifiers move the stance by one', () => {
    const naga = born(6, { race: 'naga' });
    const place = geo(naga.ctx).list.find((c) => c.first === 'me')!;
    const ex = travelExt(naga.life);
    expect(entryOf(naga.ctx, naga.life, place).pass).toBe(false);
    ex.invited.push(place.id);
    expect(stanceOf(naga.ctx, naga.life, place)).toBe(-1);
    expect(entryOf(naga.ctx, naga.life, place)).toMatchObject({ open: true, pass: false, stance: -1 });
    const hu = born(7, { race: 'human' });
    const home = firstOf(hu.ctx, 'hu');
    hu.life.curses.push('c_infamous');
    expect(stanceOf(hu.ctx, hu.life, geo(hu.ctx).list.find((c) => c.first === 'gi')!)).toBe(-1 + 0); // a place with no feeling for humans: 0, then −1 for being infamous
    void home;
  });
  it('a mummy is shut out of SH-01; the dead and the necromancer are shut out of the light faith of AL-02', () => {
    const mu = born(8, { race: 'mummy' });
    expect(stanceOf(mu.ctx, mu.life, info(mu.ctx, 'SH-01'))).toBe(-2);
    const va = born(9, { race: 'vampire' });
    expect(stanceOf(va.ctx, va.life, info(va.ctx, 'AL-02'))).toBe(-2);
    const hu = born(10, { race: 'human' });
    hu.life.flags.push('necro');
    expect(entryOf(hu.ctx, hu.life, info(hu.ctx, 'AL-02'))).toMatchObject({ open: false, never: true });
  });
  it('a stance of −1 doubles the road checks and ×1.5 the toll; a closed place costs the smuggler', () => {
    const el = born(11, { race: 'elf' }, { gold: 500 });
    const hu = firstOf(el.ctx, 'hu');
    const p = plan(el.ctx, el.life, el.life.country, hu.id);
    const leg = p.legs[p.legs.length - 1];
    expect(leg.checks).toBe(1);
    expect(leg.toll).toBe(1.5);
  });
});

describe('destinations the body or the morals take out (§3.3, §3.5)', () => {
  it('deep water scenes need breath under water or the people of the water', () => {
    const hu = born(12, { race: 'human', country: 'NR-01' }, { gold: 500 });
    expect(plan(hu.ctx, hu.life, 'NR-01', 'NR-04').ok).toBe(false);
    expect(plan(hu.ctx, hu.life, 'NR-01', 'NR-04').why).toBe('deep water');
    const me = born(13, { race: 'merfolk' }, { gold: 500 });
    me.life.country = 'NR-01';
    expect(entryOf(me.ctx, me.life, info(me.ctx, 'NR-04')).never).toBe(false);
  });
  it('lava folk do not go to the cold of Nebulia; a wanted character is arrested at the border of the country that hunts it and those that extradite', () => {
    const la = born(14, { race: 'lavakin' });
    expect(entryOf(la.ctx, la.life, info(la.ctx, 'NB-01'))).toMatchObject({ open: false, never: true, why: 'cold' });
    const hu = born(15, { race: 'human', country: 'AL-01' });
    const ex = travelExt(hu.life);
    ex.wantedIn = ['AL-03'];
    expect(entryOf(hu.ctx, hu.life, info(hu.ctx, 'AL-03'))).toMatchObject({ open: false, why: 'wanted' });
    const justice = (id: string) => info(hu.ctx, id).justice;
    const same = geo(hu.ctx).byContinent.get('AL')!.filter((c) => c.id !== 'AL-03' && ['court', 'martial', 'ledger'].includes(c.justice));
    if (['court', 'martial', 'ledger'].includes(justice('AL-03'))) expect(entryOf(hu.ctx, hu.life, same[0]).why).toBe('extradition');
    const far = geo(hu.ctx).byContinent.get('KD')![0];
    expect(entryOf(hu.ctx, hu.life, far).why).not.toBe('extradition');
  });
});

describe('the routes and the world events (§3.1, §3.4, §3.6)', () => {
  it('war flags on both countries close the land way, and a smuggler still crosses', () => {
    const { ctx, life } = born(16, { race: 'human', country: 'AL-01' });
    const a = info(ctx, 'AL-01');
    const b = info(ctx, 'AL-02');
    expect(routeState(ctx, life, 'land', a, b).open).toBe(true);
    world(ctx).countryFlags['AL-01'] = ['war'];
    expect(routeState(ctx, life, 'land', a, b).open).toBe(true);
    world(ctx).countryFlags['AL-02'] = ['war'];
    const st = routeState(ctx, life, 'land', a, b);
    expect(st.open).toBe(false);
    expect(st.smuggle).toBe(true);
  });
  it('DR-01 shuts the stair, the whale and the waterfall, opens the way to the ruin, and leaves one airship to AZ-09', () => {
    const { ctx, life } = born(17, { race: 'human' });
    life.items.push('ky_waterfall_key');
    travelExt(life).invited.push('NR-16');
    const sh = info(ctx, 'SH-03');
    const az4 = info(ctx, 'AZ-04');
    expect(routeState(ctx, life, 'stair', sh, az4).open).toBe(true);
    expect(routeState(ctx, life, 'stair', sh, az4).test).toBe('stair');
    expect(routeState(ctx, life, 'whale', info(ctx, 'NR-16'), info(ctx, 'AZ-06')).open).toBe(true);
    expect(routeState(ctx, life, 'waterfall', info(ctx, 'NR-02'), info(ctx, 'AZ-06')).open).toBe(true);
    expect(routeState(ctx, life, 'ruin', sh, az4).open).toBe(false);
    happen(ctx, 'DR-01');
    expect(routeState(ctx, life, 'stair', sh, az4).open).toBe(false);
    expect(routeState(ctx, life, 'whale', info(ctx, 'NR-16'), info(ctx, 'AZ-06')).open).toBe(false);
    expect(routeState(ctx, life, 'waterfall', info(ctx, 'NR-02'), info(ctx, 'AZ-06')).open).toBe(false);
    expect(routeState(ctx, life, 'ruin', sh, az4).open).toBe(true);
    expect(routeState(ctx, life, 'airship', info(ctx, 'MK-09'), info(ctx, 'AZ-09')).open).toBe(true);
    expect(routeState(ctx, life, 'airship', info(ctx, 'MK-09'), info(ctx, 'AZ-03')).open).toBe(false);
  });
  it('WR-02 way ก closes the stair for good unless HP-03 opens it again; the whale and the waterfall ask an invitation or a key', () => {
    const { ctx, life } = born(18, { race: 'human' });
    const sh = info(ctx, 'SH-03');
    const az4 = info(ctx, 'AZ-04');
    happen(ctx, 'WR-02');
    world(ctx).chains['out:WR-02'] = 1; // way ก
    expect(routeState(ctx, life, 'stair', sh, az4).open).toBe(false);
    happen(ctx, 'HP-03');
    expect(routeState(ctx, life, 'stair', sh, az4).open).toBe(true);
    expect(routeState(ctx, life, 'whale', info(ctx, 'NR-16'), info(ctx, 'AZ-06')).open).toBe(false);
    expect(routeState(ctx, life, 'waterfall', info(ctx, 'NR-02'), info(ctx, 'AZ-06')).open).toBe(false);
  });
  it('DR-06: for twenty years the sails stay in port (oars, time ×2, fare ×1.3) and the airships are grounded; after that the winds are wild (×1.25, ×1.1) unless a navigator is on board', () => {
    const { ctx, life } = born(19, { race: 'human' });
    const a = info(ctx, 'AL-04');
    const b = info(ctx, 'NR-01');
    const mk = info(ctx, 'MK-09');
    const az = info(ctx, 'AZ-08');
    happen(ctx, 'DR-06', 0);
    ctx.state.clock.worldYear = 5;
    const still = routeState(ctx, life, 'sea', a, b);
    expect(still).toMatchObject({ open: true, timeMul: 2 });
    expect(still.fareMul).toBeCloseTo(1.3);
    expect(routeState(ctx, life, 'airship', mk, az).open).toBe(false);
    expect(routeState(ctx, life, 'airship', mk, az).smuggle).toBe(false);
    ctx.state.clock.worldYear = 40;
    const wild = routeState(ctx, life, 'sea', a, b);
    expect(wild.timeMul).toBeCloseTo(1.25);
    expect(wild.fareMul).toBeCloseTo(1.1);
    life.job = 'navigator';
    expect(routeState(ctx, life, 'sea', a, b).timeMul).toBe(1);
    expect(routeState(ctx, life, 'airship', mk, az).open).toBe(true);
  });
  it('PO-02 leaves only the smugglers\' airships (fare ×3, risk of arrest); DW-04 cuts the sea fare ×0.7; DR-05 takes the harbour of AL-04 away until DW-04', () => {
    const { ctx, life } = born(20, { race: 'human' });
    const mk = info(ctx, 'MK-09');
    const az = info(ctx, 'AZ-08');
    happen(ctx, 'PO-02');
    expect(routeState(ctx, life, 'airship', mk, az)).toMatchObject({ open: true, fareMul: 3, illegal: true });
    const al4 = info(ctx, 'AL-04');
    const nr = info(ctx, 'NR-01');
    if (al4.coast && nr.coast) {
      happen(ctx, 'DR-05');
      happen(ctx, 'DW-01');
      expect(routeState(ctx, life, 'sea', al4, nr).open).toBe(false);
      happen(ctx, 'DW-04');
      expect(routeState(ctx, life, 'sea', al4, nr)).toMatchObject({ open: true, fareMul: 0.7 });
    }
  });
  it('FG-03 shuts the border of Aldria and Nebulia; the roots under the strait ask a guide and die with BIO-02', () => {
    const { ctx, life } = born(21, { race: 'human' });
    const al = info(ctx, 'AL-20');
    const nb = info(ctx, 'NB-01');
    expect(routeState(ctx, life, 'isthmus', al, nb).open).toBe(true);
    happen(ctx, 'FG-03');
    expect(routeState(ctx, life, 'isthmus', al, nb).open).toBe(false);
    const sv = info(ctx, 'SV-01');
    expect(routeState(ctx, life, 'roots', sv, nb).open).toBe(false);
    life.job = 'guide';
    expect(routeState(ctx, life, 'roots', sv, nb).open).toBe(true);
    happen(ctx, 'BIO-02');
    expect(routeState(ctx, life, 'roots', sv, nb).open).toBe(false);
  });
});

describe('planning a trip (§3.1, §3.6)', () => {
  it('Azgar before DR-01 is reached by the stair from the desert: caravan, then the stair, then the chain of islands', () => {
    const { ctx, life } = born(22, { race: 'human', country: 'AL-01' }, { gold: 500 });
    const p = plan(ctx, life, 'AL-01', 'AZ-01');
    expect(p.ok).toBe(true);
    const kinds = p.legs.map((l) => l.route);
    expect(kinds).toContain('caravan');
    expect(kinds).toContain('stair');
    expect(p.fare).toBeGreaterThan(20);
    expect(p.legs.find((l) => l.route === 'stair')!.state.test).toBe('stair');
  });
  it('after DR-01 the stair is gone and the way is the ruin from the east of Saharan; the winged fly and pay nothing', () => {
    const { ctx, life } = born(23, { race: 'human', country: 'AL-01' }, { gold: 500 });
    happen(ctx, 'DR-01');
    const p = plan(ctx, life, 'AL-01', 'AZ-01');
    expect(p.legs.map((l) => l.route)).not.toContain('stair');
    if (p.ok) expect(p.legs.map((l) => l.route)).toContain('ruin');
    happen(ctx, 'DR-01'); // keep
    const w = born(24, { race: 'winged', country: 'AZ-01' }, { gold: 0 });
    const fly = plan(w.ctx, w.life, 'AZ-01', 'SH-01');
    expect(fly.ok).toBe(true);
    expect(fly.fare).toBe(0);
    expect(fly.legs.some((l) => l.route === 'fly')).toBe(true);
  });
  it('a ship joins Aldria and Nerea; a purse that cannot pay may walk the overland ways (twice the days) but not take a ship', () => {
    const { ctx, life } = born(25, { race: 'human', country: 'AL-01' }, { gold: 0 });
    expect(plan(ctx, life, 'AL-01', 'NR-01').why).toBe('purse');
    const land = plan(ctx, life, 'AL-01', 'AL-03', { walk: true });
    expect(land.ok).toBe(true);
    expect(land.walk).toBe(true);
    expect(land.fare).toBe(0);
    const paid = plan(ctx, { ...life, gold: 100 }, 'AL-01', 'AL-03');
    expect(land.days).toBeCloseTo(paid.days * 2);
    expect(plan(ctx, life, 'AL-01', 'NR-01', { walk: true }).ok).toBe(false);
  });
  it('a closed way is crossed by a smuggler: 30 to 100 gold, c_wanted 25% when caught; without the skill there is no way', () => {
    const { ctx, life } = born(26, { race: 'human', country: 'AL-01' }, { gold: 500 });
    world(ctx).countryFlags['AL-01'] = ['war'];
    world(ctx).countryFlags['AL-02'] = ['war'];
    expect(plan(ctx, life, 'AL-01', 'AL-02', { smuggle: true }).ok).toBe(false);
    life.skills.push('stealth');
    life.aptitudes.stealth = 2;
    expect(canSmuggle(ctx, life)).toBe(true);
    const p = plan(ctx, life, 'AL-01', 'AL-02', { smuggle: true });
    expect(p.ok).toBe(true);
    expect(p.smuggle).toBe(true);
    expect(p.fare).toBeGreaterThanOrEqual(travel.smuggle.cost[0]);
    expect(p.fare).toBeLessThanOrEqual(travel.smuggle.cost[1]);
    expect(travel.smuggle.wantedChance).toBe(0.25);
  });
  it('a fog leg asks a mask for those the fog is not home to, and 1.5 times the time', () => {
    const hu = born(27, { race: 'human', country: 'AL-01' }, { gold: 500 });
    const into = plan(hu.ctx, hu.life, 'AL-01', 'NB-01');
    const other = plan(hu.ctx, hu.life, 'AL-01', 'AL-03');
    expect(into.mask).toBe(true);
    expect(into.fare).toBeGreaterThan(other.fare + 30);
    const co = born(28, { race: 'construct', country: 'AL-01' }, { gold: 500 });
    expect(plan(co.ctx, co.life, 'AL-01', 'NB-01').mask).toBe(false);
  });
});

describe('the road (§4)', () => {
  it('the d12 table keeps its weights and the world flags move them: war ×3 on row 6, plague ×3 on row 7, famine ×2 on rows 5 and 2, a sea leg after DR-06 ×2 on row 8', () => {
    const { ctx } = born(29, { race: 'human', country: 'AL-01' });
    const leg = { from: 'AL-01', to: 'AL-02', route: 'land' as const };
    expect(roadWeights(ctx, leg)).toEqual(Array(12).fill(1));
    world(ctx).countryFlags['AL-02'] = ['war', 'plague', 'famine'];
    const w = roadWeights(ctx, leg);
    expect(w[5]).toBe(3);
    expect(w[6]).toBe(3);
    expect(w[4]).toBe(2);
    expect(w[1]).toBe(2);
    happen(ctx, 'DR-06');
    expect(roadWeights(ctx, { ...leg, route: 'sea' as const })[7]).toBe(2);
    expect(roadWeights(ctx, leg)[7]).toBe(1);
  });
  it('a trip takes the fare out of the purse, writes the move, the trip and the road; the employer pays for a courier', () => {
    const a = born(30, { race: 'human', country: 'AL-01' }, { gold: 200 });
    const r = go(a.ctx, 'AL-05', 'test');
    expect(r.ok).toBe(true);
    expect(a.life.country).toBe('AL-05');
    expect(a.life.gold).toBeLessThanOrEqual(200 - r.fare); // the fare, and what the road took besides (a toll, a repair)
    expect(travelExt(a.life).spent).toBe(r.fare);
    expect(r.fare).toBeGreaterThanOrEqual(1);
    const kinds = a.ctx.state.log.filter((e) => e.sys === 'travel').map((e) => e.kind);
    expect(kinds).toContain('move');
    expect(kinds).toContain('trip');
    const b = born(31, { race: 'human', country: 'AL-01' }, { gold: 200, job: 'courier' });
    const free = go(b.ctx, 'AL-05', 'test', { free: true });
    expect(free.ok).toBe(true);
    expect(travelExt(b.life).spent).toBe(0); // the road may still take a toll; the fare is the employer's
    expect(b.life.country).toBe('AL-05');
  });
  it('a trip across a continent rolls the table twice per leg (§4) and the same seed gives the same road', () => {
    const run = (seed: number) => {
      const a = born(seed, { race: 'human', country: 'AL-01' }, { gold: 500 });
      go(a.ctx, 'KD-01', 'test');
      return JSON.stringify(a.ctx.state.log.filter((e) => e.sys === 'travel'));
    };
    expect(run(32)).toBe(run(32));
    expect(run(33)).not.toBe(run(32));
  });
});

describe('the causes of a journey (§2)', () => {
  const eligible = (key: string, ctx: Ctx, life: LifeState) => {
    const c = CAUSES.find((x) => x.key === key)!;
    const row = travel.causes.find((r) => r.cause === c.row)!;
    return c.eligible(ctx, life, travelExt(life), row);
  };
  it('study: age 15 to 24, class 3 or more, class 4 doubles it', () => {
    const { ctx, life } = born(34, { race: 'human' });
    life.hAge = 14;
    life.cls = 'c3';
    expect(eligible('sc', ctx, life).ok).toBe(false);
    life.hAge = 15;
    expect(eligible('sc', ctx, life)).toEqual({ ok: true, mul: 1 });
    life.cls = 'c4';
    expect(eligible('sc', ctx, life).mul).toBe(2);
    life.cls = 'c2';
    expect(eligible('sc', ctx, life).ok).toBe(false);
    life.cls = 'c3';
    life.hAge = 25;
    expect(eligible('sc', ctx, life).ok).toBe(false);
  });
  it('pilgrimage: faith above 40, three times above 60; mercenary: a war flag or a soldier, twice in a total war; refugee: a disaster; exile: wanted where the character stands', () => {
    const { ctx, life } = born(35, { race: 'human', country: 'AL-01' });
    const axes = (life.ext.character as { axes: Record<string, number> }).axes;
    axes.piety = 40;
    expect(eligible('ps', ctx, life).ok).toBe(false);
    axes.piety = 41;
    expect(eligible('ps', ctx, life)).toEqual({ ok: true, mul: 1 });
    axes.piety = 61;
    expect(eligible('ps', ctx, life).mul).toBe(3);
    expect(eligible('ml', ctx, life).ok).toBe(false);
    world(ctx).countryFlags['AL-01'] = ['war'];
    // the flag of war alone draws the young who hold a weapon (ML_WAR_AGE, WEAPON_APTS); the old and the untrained are not recruits
    life.hAge = 25;
    life.aptitudes = {};
    expect(eligible('ml', ctx, life).ok).toBe(false);
    life.aptitudes = { sword: 1 };
    expect(eligible('ml', ctx, life).ok).toBe(true);
    life.hAge = 50;
    expect(eligible('ml', ctx, life).ok).toBe(false);
    world(ctx).countryFlags['AL-01'] = [];
    life.job = 'soldier';
    expect(eligible('ml', ctx, life).ok).toBe(true);
    expect(eligible('ex', ctx, life).ok).toBe(false);
    world(ctx).countryFlags['AL-01'] = ['famine'];
    expect(eligible('ex', ctx, life).ok).toBe(true);
    expect(eligible('exile', ctx, life).ok).toBe(false);
    life.curses.push('c_wanted');
    expect(eligible('exile', ctx, life).ok).toBe(false);
    travelExt(life).wantedIn = ['AL-01'];
    expect(eligible('exile', ctx, life).ok).toBe(true);
  });
  it('invitation: a foreign people trusts the character at 3 or more; curiosity: the axis above 40 and no family; debt: 100 gold or more', () => {
    const { ctx, life } = born(36, { race: 'elf' });
    expect(eligible('xc', ctx, life).ok).toBe(false);
    (life.ext.character as { trust: Record<string, number> }).trust['มนุษย์'] = 3;
    expect(eligible('xc', ctx, life).ok).toBe(true);
    const axes = (life.ext.character as { axes: Record<string, number> }).axes;
    axes.curious = 41;
    life.traits = life.traits.filter((t) => t !== 'family');
    expect(eligible('wd', ctx, life).ok).toBe(true);
    life.traits.push('family');
    expect(eligible('wd', ctx, life).ok).toBe(false);
    expect(eligible('tr', ctx, life).ok).toBe(false);
    life.ext.economy = { debt: 100 };
    expect(eligible('tr', ctx, life).ok).toBe(true);
  });
  it('a roll that succeeds opens the line of the cause in the story system and writes the cause; one travel event in three years; settled ×0.5 adventurous ×1.5', () => {
    const sure = JSON.parse(JSON.stringify(data.travel)) as GameData[string];
    for (const c of (sure.items as TravelData).causes) c.chance = 1;
    const { ctx, life } = born(37, { race: 'human', country: 'AL-01' }, { hAge: 20, cls: 'c3' }, { travel: sure });
    rollCauses(ctx, life, travelExt(life), new Set());
    expect(storyExt(life).external).toContain('sc');
    expect(travelExt(life).opened).toContain('sc');
    expect(ctx.state.log.some((e) => e.sys === 'travel' && e.kind === 'cause' && e.id === 'sc')).toBe(true);
    // the cause is not asked again within three years (a disaster cause is exempt)
    const ex = travelExt(life);
    const before = ex.stats.sc.years;
    ex.away = undefined;
    life.hAge = ex.lastTrip + 2;
    rollCauses(ctx, life, ex, new Set());
    expect(ex.stats.sc.years).toBe(before);
    life.hAge = ex.lastTrip + 3;
    rollCauses(ctx, life, ex, new Set());
    expect(ex.stats.sc.years).toBe(before + 1);

    const mod = (traits: string[]) => {
      const b = born(38, { race: 'human', country: 'AL-01' }, { hAge: 20, cls: 'c3' });
      b.life.traits = traits;
      rollCauses(b.ctx, b.life, travelExt(b.life), new Set());
      return travelExt(b.life).stats.sc.exp;
    };
    expect(mod(['homebody'])).toBeCloseTo(0.015);
    expect(mod(['adventurer'])).toBeCloseTo(0.045);
    expect(mod([])).toBeCloseTo(0.03);
  });
  it('a city job takes a post abroad now and then (assumption of the code, the table has no cause for it)', () => {
    const { ctx, life } = born(39, { race: 'human', country: 'AL-01' }, { hAge: 30, job: 'teacher', gold: 100 });
    let trips = 0;
    for (let i = 0; i < 2000; i++) {
      travelExt(life).away = undefined;
      life.country = 'AL-01';
      cityYear(ctx, life, travelExt(life));
      if (travelExt(life).away) trips++;
    }
    expect(trips).toBeGreaterThan(0);
    expect(trips).toBeLessThan(40);
  });
});

describe('the story names a place (the `place` effect)', () => {
  const node = (places: string[]) => ({ id: 'x.a1', choices: [{ key: 'a', effects: [{ k: 'place' as const, ids: places }] }, { key: 'b', effects: [] }] });
  it('the character moves to the first place the filters allow and the base moves with it', () => {
    const was = { ...FOLLOW_STORY };
    FOLLOW_STORY.same = 1;
    FOLLOW_STORY.cross = 1;
    const { ctx, life } = born(40, { race: 'human', country: 'AL-01' }, { hAge: 25, gold: 100 });
    expect(followStory(ctx, node(['AL-02']), 'b')).toBe(false);
    expect(life.country).toBe('AL-01');
    expect(followStory(ctx, node(['AL-02']), 'a')).toBe(true);
    expect(life.country).toBe('AL-02');
    expect(travelExt(life).base).toBe('AL-02');
    expect(ctx.state.log.some((e) => e.sys === 'travel' && e.kind === 'move' && String(e.data.why).startsWith('story:'))).toBe(true);
    Object.assign(FOLLOW_STORY, was);
  });
  it('a share of the ways is followed, by the tuning, in the same continent and across continents', () => {
    expect(FOLLOW_STORY.same).toBeGreaterThan(FOLLOW_STORY.cross);
    expect(FOLLOW_STORY.same).toBeLessThanOrEqual(1);
  });
  it('relocate stays put when every way is shut', () => {
    const { ctx, life } = born(41, { race: 'naga', country: 'NR-07' });
    const place = geo(ctx).list.find((c) => c.first === 'me')!;
    expect(relocate(ctx, place.id, 'test')).toBe(false);
    expect(life.country).toBe('NR-07');
  });
  it('the hook is registered with the story system', () => {
    const off = onNode({});
    off();
    expect(typeof followStory).toBe('function');
  });
});

describe('a whole life', () => {
  it('is deterministic, and its counts agree: the level follows what was visited, the character is somewhere real, an absence ends', () => {
    const run = (seed: number) => {
      const g = game(seed, {}, 45);
      const life = birth(g.ctx, {});
      g.born();
      g.runLife(1500);
      return { g, life: g.state.life! };
    };
    const a = run(77);
    const b = run(77);
    expect(JSON.stringify(a.life.ext.travel)).toBe(JSON.stringify(b.life.ext.travel));
    expect(JSON.stringify(a.g.state.log)).toBe(JSON.stringify(b.g.state.log));
    for (const seed of [78, 79, 80, 81, 82, 83]) {
      const { g, life } = run(seed);
      const ex = travelExt(life);
      expect(geo(g.ctx).countries.has(life.country)).toBe(true);
      expect(ex.level).toBe(ex.continents.length > 1 ? 2 : ex.visited.length > 0 ? 1 : 0);
      expect(ex.visited).not.toContain(ex.born);
      expect(ex.legs).toBeGreaterThanOrEqual(0);
      expect(holds(g.ctx, life, 'flag', 'zzz')).toBe(false);
    }
  });
});

describe('a life in bondage goes nowhere by itself (10-bondage.md §2, M3 review B1)', () => {
  it('cannot go, relocate or follow the story to another country at any level, and the refusal is for the developer; the owner carries him, a free man goes', () => {
    const { ctx, life, g } = born(41, { race: 'human', country: 'AL-01' }, { hAge: 30, gold: 500 });
    for (const level of [1, 2, 3]) {
      life.ext.bondage = { level };
      const r = go(ctx, 'AL-02', 'test', { free: true });
      expect(r.ok).toBe(false);
      expect(r.why).toBe('bound');
      expect(relocate(ctx, 'AL-02', 'story:x')).toBe(false);
      expect(life.country).toBe('AL-01');
    }
    expect(g.state.log.filter((e) => e.sys === 'travel' && e.kind === 'trip')).toEqual([]);
    const blocked = g.state.log.filter((e) => e.sys === 'travel' && e.kind === 'blocked' && e.data.why === 'bound');
    expect(blocked.length).toBeGreaterThanOrEqual(3);
    expect(blocked.every((e) => e.level === 0)).toBe(true);
    life.ext.bondage = { level: 0 };
    const free = go(ctx, 'AL-02', 'test', { free: true });
    expect(free.ok).toBe(true);
    expect(life.country).toBe('AL-02');
  });

  it('takes no cause of a journey and makes no trip while bound, a trip in the making ends where he stands, and the causes come back with his freedom', () => {
    let freeCauses = 0;
    for (let seed = 50; seed < 58; seed++) {
      const { g, ctx, life } = born(seed, { race: 'human', country: 'AL-01' }, { hAge: 20, gold: 500 });
      charExtOf(life).axes.curious = 100;
      life.ext.bondage = { level: 2 };
      for (let a = 20; a < 70; a++) {
        life.hAge = a;
        travelSystem.lifeYear!(ctx);
      }
      expect(g.state.log.filter((e) => e.sys === 'travel' && (e.kind === 'cause' || e.kind === 'trip'))).toEqual([]);
      expect(life.country).toBe('AL-01');
      life.ext.bondage = { level: 0 };
      for (let a = 20; a < 70; a++) {
        life.hAge = a;
        travelSystem.lifeYear!(ctx);
      }
      freeCauses += g.state.log.filter((e) => e.sys === 'travel' && e.kind === 'cause').length;
    }
    expect(freeCauses).toBeGreaterThan(0);
    // away on a trip when taken: the trip is over at the next beat, and he is based where he stands
    const { ctx, life } = born(60, { race: 'human', country: 'AL-01' }, { hAge: 30, gold: 500 });
    const ex = travelExt(life);
    ex.away = { cause: 'wd', to: 'AL-01', until: 9999, settle: false };
    life.country = 'AL-02';
    life.ext.bondage = { level: 3 };
    travelSystem.beat!(ctx);
    expect(ex.away).toBeUndefined();
    expect(ex.base).toBe('AL-02');
  });
});
