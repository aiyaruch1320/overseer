import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BondageFile } from '../../src/core/data/types-bondage';
import type { BondsFile } from '../../src/core/data/types-bonds';
import type { CountriesGen } from '../../src/core/data/types-npcs';
import type { StorylinesData } from '../../src/core/data/types-storylines';
import type { GenFile } from '../../src/core/types';
import bondage from '../../scripts/codegen/groups/bondage';
import { genDir, readDoc } from '../../scripts/codegen/lib/table';

const read = <T>(name: string) => JSON.parse(readFileSync(`data/gen/${name}.json`, 'utf8')) as T;
const D = read<BondageFile>('bondage').items;
const countries = read<CountriesGen>('countries').items;
const story = read<GenFile<StorylinesData>>('storylines').items;
const bonds = read<BondsFile>('bonds').items;
const curses = read<{ items: { id: string }[] }>('curses').items;
const doc = readDoc('docs/systems/economy/10-bondage.md');

describe('bondage generator: counts the doc states', () => {
  it('four levels B0 to B3, five stances, seven ways in, six ways out, three roles, 143 countries', () => {
    expect(D.levels.map((l) => l.id)).toEqual(['B0', 'B1', 'B2', 'B3']);
    expect(D.stances.map((s) => s.id).sort()).toEqual(['A', 'D', 'H', 'L', 'M']);
    expect(D.routes).toHaveLength(7);
    expect(D.exits).toHaveLength(6);
    expect(D.roles).toHaveLength(3);
    expect(D.intent).toHaveLength(5);
    expect(Object.keys(D.byCountry)).toHaveLength(143);
    expect(D.counts.tables).toBe(9);
    expect(D.raw).toHaveLength(9);
  });
  it('B1 to B3 are class 1', () => {
    expect(D.levels.map((l) => l.classOne)).toEqual([false, true, true, true]);
    expect(D.levels[0].exits).toEqual([]);
    expect(D.levels[3].exits).toEqual(['ไถ่', 'ปล่อย', 'หนี', 'ตายพันธะเมื่อเจ้าของตายและไม่มีทายาท']);
  });
});

describe('bondage generator: stances', () => {
  const S = (id: string) => D.stances.find((s) => s.id === id)!;
  it('what each stance allows, from the doc table', () => {
    expect(S('A').legal).toEqual({ B1: 'illegal', B2: 'illegal', B3: 'illegal' });
    expect(S('H').legal).toEqual({ B1: 'hidden', B2: 'hidden', B3: 'none' });
    expect(S('D').legal).toEqual({ B1: 'legal', B2: 'legal', B3: 'illegal' });
    expect(S('L').legal).toEqual({ B1: 'legal', B2: 'legal', B3: 'legal' });
    expect(S('M').legal).toEqual({ B1: 'legal', B2: 'legal', B3: 'legal' });
  });
  it('effects on traders and owners', () => {
    expect(S('A').effects).toEqual([{ k: 'grant', kind: 'curse', id: 'c_wanted' }]);
    expect(S('H').effects).toEqual([{ k: 'grant', kind: 'curse', id: 'c_infamous', chance: 0.4 }]);
    expect(S('A').freeOnEntry).toBe(true);
    expect(S('D')).toMatchObject({ canBuyContract: true, canBuyPerson: false });
    expect(S('L')).toMatchObject({ canBuyPerson: true, registry: true, chaseBack: true });
    expect(S('M')).toMatchObject({ canBuyPerson: true, marketFee: true });
    for (const c of ['c_wanted', 'c_infamous']) expect(curses.some((x) => x.id === c), c).toBe(true);
  });
  it('the named countries are real, carry the name the doc gives, and sit in one stance each', () => {
    const byId = new Map(countries.map((c) => [c.id, c]));
    let named = 0;
    for (const g of D.stanceGroups) {
      for (const n of g.named) {
        expect(byId.get(n.id), n.id).toBeDefined();
        expect(byId.get(n.id)!.name, n.id).toBe(n.name);
        expect(D.byCountry[n.id], n.id).toBe(g.stance);
        named++;
      }
      for (const c of g.countries) expect(D.byCountry[c], c).toBe(g.stance);
    }
    expect(named).toBe(27);
    expect(D.stanceGroups.filter((g) => g.stance === 'A')).toHaveLength(8);
  });
  it('all of Silvanel is stance A, the countries no row names are H', () => {
    const sv = countries.filter((c) => c.continent === 'SV');
    expect(sv).toHaveLength(18);
    for (const c of sv) expect(D.byCountry[c.id], c.id).toBe('A');
    expect(D.defaultStance).toBe('H');
    const tally: Record<string, number> = {};
    for (const s of Object.values(D.byCountry)) tally[s] = (tally[s] ?? 0) + 1;
    expect(tally).toEqual({ A: 33, D: 7, H: 98, L: 2, M: 3 });
    for (const c of countries) expect(D.byCountry[c.id], c.id).toBeDefined();
  });
  it('a sample of countries against the doc rows', () => {
    expect(D.byCountry['MH-09']).toBe('M');
    expect(D.byCountry['SH-11']).toBe('L');
    expect(D.byCountry['AL-10']).toBe('D');
    expect(D.byCountry['AL-19']).toBe('A');
    expect(doc).toContain('| **M** | MH-09 โมธมาร์ต |');
    expect(doc).toContain('| **D** | AL-10 มาร์เชลโล |');
  });
  it('class 1 shares add up to 100 for each stance', () => {
    expect(D.class1.map((c) => c.stance)).toEqual(['M', 'L', 'D', 'H', 'A']);
    for (const c of D.class1) expect(c.b1 + c.b2 + c.b3 + c.rest, c.stance).toBe(100);
    expect(D.class1.find((c) => c.stance === 'A')).toMatchObject({ b1: 0, b2: 0, b3: 0, rest: 100 });
    expect(D.class1.find((c) => c.stance === 'D')).toMatchObject({ b1: 35, b2: 30, b3: 0, rest: 35 });
    // a stance that bans a level has no one at it
    for (const s of D.stances) for (const lv of ['B1', 'B2', 'B3'] as const) if (s.legal[lv] === 'illegal' || s.legal[lv] === 'none') expect(D.class1.find((c) => c.stance === s.id)![lv.toLowerCase() as 'b1'], `${s.id} ${lv}`).toBe(0);
  });
});

describe('bondage generator: ways in and out, prices, roles', () => {
  it('ways in start the storyline nodes bd.*, and the nodes exist', () => {
    const nodes = new Set(story.nodes.map((n) => n.id));
    for (const r of D.routes) {
      expect(r.nodes.length, r.way).toBeGreaterThan(0);
      for (const n of r.nodes) expect(nodes.has(n), n).toBe(true);
    }
    expect(D.routes.find((r) => r.way === 'เกิดในพันธะ')).toMatchObject({ levels: [3, 2], nodes: ['bd.b1'] });
    expect(D.routes.find((r) => r.way === 'ถูกจับ')!.nodes).toEqual(['bd.t1', 'bd.a1']);
    expect(D.routes.find((r) => r.way === 'เป็นหนี้')!.levels).toEqual([1]);
  });
  it('every way out leads to B0; ransom brings gratitude 3; the self-ransom lifts the class by one when there is work', () => {
    for (const e of D.exits) expect(e.toLevel, e.way).toBe(0);
    expect(D.exits.find((e) => e.way === 'ถูกไถ่')!.effects).toContainEqual({ k: 'stat', stat: 'บุญคุณ', delta: 3 });
    expect(D.exits.find((e) => e.way === 'ไถ่ตัวเอง')).toMatchObject({ classUp: 1, classUpIf: 'มีงาน' });
    expect(D.freeLand.text).toContain('ดินแดนเสรี');
  });
  it('ransom prices', () => {
    const P = (l: string) => D.prices.find((p) => p.level === l)!;
    expect([P('B1').min, P('B1').max]).toEqual([20, 150]);
    expect([P('B2').min, P('B2').max, P('B2').perContractYear]).toEqual([30, 150, 5]);
    expect([P('B3').min, P('B3').max, P('B3').basePrice, P('B3').skillRange]).toEqual([60, 360, 60, [1, 6]]);
    expect(P('B1').wageCut).toEqual([0.3, 0.6]);
    expect(D.income).toMatchObject({ b1ClassMul: 0.8, b23ClassMul: 0.2, livingCost: [0, 1], savingPerYear: [2, 14], atW: 3 });
  });
  it('roles of the buyer, the redeemer and the helper; the chances agree with the bonds file', () => {
    expect(D.roleRules.buyer).toEqual({ stances: ['D', 'L', 'M'], trustLossInA: -2, infamousChance: 0.25, infamousStances: ['A', 'H'], incomeBonusMax: 0.15 });
    expect(D.roleRules.redeemer).toEqual({ gratitude: 3, allyChance: 0.4, freeInStance: 'A' });
    expect(D.roleRules.helper).toEqual({ wantedCurse: 'c_wanted', trust: 4, allyChance: 0.5, viaStance: 'A' });
    const redeem = bonds.formation.candidates.find((c) => c.id === 'redeem')!;
    expect(redeem.chances).toEqual([D.allyChance.redeemOrFree, D.allyChance.helper]);
    expect(D.hold).toMatchObject({ year: 5, escapeChance: 0.3, suedChance: 0.15, ownerTrustPerTwoYears: -1, ownerTrustFloor: -5 });
  });
});

describe('bondage generator: deterministic', () => {
  it('runs again and leaves the same bytes', () => {
    const before = readFileSync(`${genDir}/bondage.json`, 'utf8');
    expect(bondage()).toMatchObject({ group: 'bondage', files: ['bondage.json'], strict: false });
    expect(readFileSync(`${genDir}/bondage.json`, 'utf8')).toBe(before);
  });
});
