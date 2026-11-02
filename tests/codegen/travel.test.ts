import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ItemsFile } from '../../src/core/data/types-items';
import type { StorylinesData } from '../../src/core/data/types-storylines';
import type { TravelFile } from '../../src/core/data/types-travel';
import type { GenFile } from '../../src/core/types';
import travel from '../../scripts/codegen/groups/travel';
import { genDir, readDoc } from '../../scripts/codegen/lib/table';

const read = <T>(name: string) => JSON.parse(readFileSync(`data/gen/${name}.json`, 'utf8')) as T;
const D = read<TravelFile>('travel').items;
const story = read<GenFile<StorylinesData>>('storylines').items;
const items = read<ItemsFile>('items').items.items;
const nodes = new Set(story.nodes.map((n) => n.id));
const doc = readDoc('docs/systems/travel/01-travel-rules.md');

describe('travel generator: counts the doc states', () => {
  it('3 levels, 7 travelling jobs, 8 causes, 7 overlays, 4 stances, 6 moral rules, 12 race rows, 15 routes with 4 sky routes, 12 d12 rows', () => {
    expect(D.levels.map((l) => l.id)).toEqual(['L0', 'L1', 'L2']);
    expect(D.jobLegs).toHaveLength(7);
    expect(D.causes).toHaveLength(8);
    expect(D.overlays.map((o) => o.id)).toEqual(['sf', 'ps', 'ml', 'sc', 'ex', 'wd', 'xc']);
    expect(D.stances.map((s) => s.value)).toEqual([1, 0, -1, -2]);
    expect(D.moral).toHaveLength(6);
    expect(D.raceMoves).toHaveLength(12);
    expect(D.routes).toHaveLength(15);
    expect(D.routes.filter((r) => r.sky).map((r) => r.id)).toEqual(['stair', 'airship', 'whale', 'waterfall']);
    expect(D.encounters.map((e) => e.d)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(D.raw).toHaveLength(13);
  });
  it('the three level shares of each job group add up to 100', () => {
    expect(D.levelTargets).toHaveLength(3);
    for (const t of D.levelTargets) expect(t.pct[0] + t.pct[1] + t.pct[2], t.group).toBe(100);
    expect(D.levelTargets[2].pct).toEqual([0, 45, 55]);
  });
  it('legs per year by job', () => {
    const J = (job: string) => D.jobLegs.find((j) => j.jobs.includes(job))!;
    expect(J('merchant').legs).toEqual([2, 3]);
    expect(J('courier').legs).toEqual([3, 4]);
    expect(J('mercenary').legs).toEqual([0.5, 1]);
    expect(D.jobLegs.find((j) => j.perLife)!.label).toBe('ผู้แสวงบุญ');
    expect(D.legRule).toMatchObject({ daysJob: 240, daysCause: 90 });
  });
});

describe('travel generator: the causes that open the overlays', () => {
  const C = (overlay: string, cause?: string) => D.causes.find((c) => c.overlay === overlay && (!cause || c.cause === cause))!;
  it('yearly chances in the order of the doc table', () => {
    expect(D.causes.map((c) => c.chance)).toEqual([0.03, 0.01, 0.015, 0.15, 0.08, 0.03, 0.015, 0.02]);
    expect(D.causes.map((c) => c.overlay)).toEqual(['sc', 'ps', 'ml', 'ex', 'ex', 'xc', 'wd', 'tr']);
  });
  it('multipliers', () => {
    expect(C('sc').mods).toEqual([{ cond: { k: 'class', min: 4 }, mul: 2, raw: '(ชนชั้น 4 ขึ้นไป ×2)' }]);
    expect(C('ps').mods[0]).toMatchObject({ mul: 3, cond: { k: 'cmp', stat: 'faith', op: '>', value: 60 } });
    expect(C('ml').mods[0]).toMatchObject({ mul: 2, cond: { k: 'place', kinds: ['war=total'] } });
    expect(C('ex', 'ลี้ภัย').inEventYear).toBe(true);
    expect(C('ex', 'เนรเทศหรือหนีโทษ').inEventYear).toBe(false);
  });
  it('conditions the grammar can read are read', () => {
    expect(C('sc').when).toEqual({ k: 'and', of: [{ k: 'age', min: 15, max: 24 }, { k: 'or', of: [{ k: 'class', min: 3 }, { k: 'text', text: 'มีผู้ค้ำ' }] }] });
    expect(C('ex', 'เนรเทศหรือหนีโทษ').when).toEqual({ k: 'or', of: [{ k: 'has', kind: 'curse', id: 'c_wanted' }, { k: 'text', text: 'ถูกขับจากสถาบัน' }] });
    expect(C('tr').when).toMatchObject({ k: 'or', of: [{ k: 'cmp', stat: 'debt', op: '>=', value: 100 }, { k: 'text' }] });
    expect(C('tr').opens).toEqual(['tr.a1', 'ml.a1']);
  });
  it('every node a cause opens exists; the stranger line xc opens by race', () => {
    for (const c of D.causes) for (const n of c.opens) expect(nodes.has(n), n).toBe(true);
    expect(C('xc').byRace).toBe(true);
    expect(C('xc').opens).toEqual([]);
  });
  it('shared rules: one travel event per three years, settled halves it, adventurous raises it', () => {
    expect(D.causeRules.oncePerYears).toBe(3);
    expect(D.causeRules.mods.map((m) => m.mul)).toEqual([0.5, 0.5, 1.5]);
    expect(D.causeRules.mods[1].cond).toEqual({ k: 'has', kind: 'trait', id: 'settled' });
  });
  it('overlays: node counts match the storyline, the chances come from the causes', () => {
    for (const o of D.overlays) {
      expect(o.nodes.length, o.id).toBe(o.nodeCount);
      for (const n of o.nodes) expect(nodes.has(n), n).toBe(true);
    }
    expect(D.overlays.map((o) => o.nodeCount)).toEqual([5, 4, 4, 4, 4, 5, 20]);
    expect(D.overlays.find((o) => o.id === 'ex')!.causes).toEqual([0.15, 0.08]);
    expect(D.overlays.find((o) => o.id === 'sf')!.causes).toEqual([]);
    expect(D.overlays.find((o) => o.id === 'xc')!.spontaneous).toEqual({ chance: 0.35, ageMin: 24, ageMax: 36, level: 'L0' });
  });
});

describe('travel generator: filters', () => {
  it('stance of the place toward the race', () => {
    const S = (v: number) => D.stances.find((s) => s.value === v)!;
    expect(S(-1)).toMatchObject({ enterable: true, tollMul: 1.5, extraChecks: 1, helpers: 'none' });
    expect(S(1).helpers).toBe('more');
    expect(S(-2).enterable).toBe(false);
    expect(S(-2).entry).toMatchObject({ k: 'or' });
    expect(D.allRacesStance).toEqual([0, 1]);
    expect(D.stanceModifiers.map((m) => m.delta)).toEqual([1, 1, 1, -1, -1]);
  });
  it('race relations: both ways and one way, with the exceptions', () => {
    const find = (a: string, b: string) => D.raceRelations.find((r) => r.from.some((p) => p.name === a) && r.to.some((p) => p.name === b))!;
    expect(find('เอลฟ์', 'ภูต')).toMatchObject({ value: 1, mutual: true });
    expect(find('ยักษ์', 'คนแคระ')).toMatchObject({ value: 1, mutual: false });
    expect(find('เงือก', 'นาคา')).toMatchObject({ value: -2, mutual: true });
    expect(find('ทุกเผ่า', 'กูล')).toMatchObject({ value: -1, except: [{ name: 'ออร์ค', race: 'or' }, { name: 'เผ่าปีศาจ', race: 'dm' }] });
    expect(find('มัมมี่', 'SH-01')).toMatchObject({ value: -2, mutual: false });
    expect(D.raceRelations.find((r) => r.place)!.place).toEqual({ text: 'ในถิ่นศาสนาแสง', countries: ['AL-02'] });
    expect(D.raceRelations.every((r) => r.from.every((p) => p.name) && r.value !== 0)).toBe(true);
  });
  it('moral rules and body limits', () => {
    expect(D.moral[0].onEnter).toEqual([{ k: 'grant', kind: 'curse', id: 'c_wanted' }]);
    expect(D.moral.find((m) => m.forbiddenContinents.includes('SV'))).toBeDefined();
    expect(D.moral.find((m) => m.forbiddenCountries.includes('AL-02'))).toBeDefined();
    expect(D.bodyLimits.length).toBeGreaterThanOrEqual(8);
    expect(D.bodyLimits[0].races).toEqual(expect.arrayContaining(['me', 'na']));
  });
  it('race movement and deep water', () => {
    const wing = D.raceMoves.find((r) => r.raceRaw === 'เผ่าปีก')!;
    expect(wing).toMatchObject({ canFly: true, races: ['wi'] });
    expect(D.raceMoves.find((r) => r.raceRaw === 'ภูตพราย')!.canFly).toBe(false);
    expect(D.raceMoves.filter((r) => r.deepWater).map((r) => r.raceRaw)).toEqual(['เงือก', 'นาคา']);
    expect(D.deepWater).toMatchObject({ countries: ['NR-04', 'NR-03', 'NR-11', 'NR-07'], needTag: '#water_breath', notEnoughTag: '#water_breath_short' });
    expect(D.smuggle).toMatchObject({ cost: [30, 100], wantedChance: 0.25, skill: { id: 'stealth', level: 2 }, guides: ['NB12-*', 'NB09-*', 'MK05-4'] });
  });
});

describe('travel generator: routes', () => {
  const R = (id: string) => D.routes.find((r) => r.id === id)!;
  it('time and fare ranges of the table', () => {
    expect([R('land').days, R('land').fare]).toEqual([[10, 20], [1, 3]]);
    expect([R('isthmus').days, R('isthmus').fare]).toEqual([[20, 35], [3, 6]]);
    expect([R('sea').days, R('sea').fare]).toEqual([[25, 45], [8, 12]]);
    expect([R('airship').days, R('airship').fare]).toEqual([[4, 7], [40, 60]]);
    expect(R('whale').fare).toEqual([0, 0]);
    expect(R('stair').days).toBeNull();
    expect(R('fog').days).toBeNull();
    for (const r of D.routes) if (r.days) expect(r.days[0], r.id).toBeLessThanOrEqual(r.days[1]);
  });
  it('the key items exist', () => {
    expect(R('stair').needs).toEqual(['ky_stair_ticket']);
    expect(R('waterfall').needs).toEqual(['ky_waterfall_key']);
    for (const k of D.routes.flatMap((r) => r.needs)) expect(items.some((i) => i.id === k), k).toBe(true);
  });
  it('events that change a route', () => {
    const sea = R('sea').eventMods;
    expect(sea.find((m) => m.events.includes('PO-03'))).toMatchObject({ fareMul: 1.2, closes: false });
    expect(sea.find((m) => m.events.includes('WR-06'))).toMatchObject({ fareMul: 2 });
    expect(sea.find((m) => m.events.includes('DW-04') && !m.events.includes('DR-05'))).toMatchObject({ fareMul: 0.7 });
    expect(R('isthmus').eventMods[0].wildcard).toEqual(['WR-*']);
    expect(R('land').eventMods.find((m) => m.events.includes('DR-07'))).toMatchObject({ timeMul: 1.5, fareMul: 1.4 });
    expect(R('whale').eventMods.some((m) => m.events.includes('CT-10'))).toBe(true);
  });
  it('the calm after DR-06 lasts 20 years; sailing times double, then settle at x1.25', () => {
    expect(D.windStill.years).toBe(20);
    const [calm, after] = D.windStill.rows;
    expect(calm).toMatchObject({ from: 0, to: 20, seaTimeMul: 2, seaFareMul: 1.3, coastTimeMul: 1.5, d12: { item: 8, mul: 2 } });
    expect(after).toMatchObject({ from: 20, to: null, seaTimeMul: 1.25, seaFareMul: 1.1, d12: { item: 8, mul: 2 } });
  });
});

describe('travel generator: the d12 table and the targets', () => {
  it('rolls per leg and the world-flag weights', () => {
    expect(D.encounterRolls).toMatchObject({ perLeg: 1, crossContinent: 2, caravanWithPassengers: 1 });
    expect(D.encounterMods.map((m) => m.items)).toEqual([[{ d: 6, mul: 3 }], [{ d: 7, mul: 3 }], [{ d: 5, mul: 2 }, { d: 2, mul: 2 }], [{ d: 8, mul: 2 }]]);
    expect(D.encounterMods[3]).toMatchObject({ cond: { k: 'event', id: 'DR-06', happened: true }, routes: ['sea', 'airship'] });
    expect(D.encounterMods[2].cond).toEqual({ k: 'place', kinds: ['famine'] });
  });
  it('rows 6 and 7 against the doc, numbers kept for the prose', () => {
    const e = (d: number) => D.encounters[d - 1];
    expect(e(6).name).toBe('ขบวนทหารหรือด่านตรวจสงคราม');
    expect(JSON.stringify(e(6).effects)).toContain('ml.a1');
    expect(JSON.stringify(e(7).effects)).toContain('c_fever');
    expect(e(1).nums).toEqual(expect.arrayContaining([-5, -15, 15]));
    expect(doc).toContain('| 6 | ขบวนทหารหรือด่านตรวจสงคราม |');
    expect(e(12).effects).toEqual([]);
  });
  it('targets for meeting other races', () => {
    expect(D.targets.goals.map((g) => g.nums[0])).toEqual([3, 2, 1, 25]);
    expect(D.targets.goals[3].nums).toEqual([25, 35]);
    expect(D.targets.measured).toHaveLength(4);
  });
});

describe('travel generator: deterministic', () => {
  it('runs again and leaves the same bytes', () => {
    const before = readFileSync(`${genDir}/travel.json`, 'utf8');
    expect(travel()).toMatchObject({ group: 'travel', files: ['travel.json'], strict: false });
    expect(readFileSync(`${genDir}/travel.json`, 'utf8')).toBe(before);
  });
});
