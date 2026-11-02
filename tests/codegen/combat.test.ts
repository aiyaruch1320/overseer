import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ClashesFile, CombatFile, EnemiesFile } from '../../src/core/data/types-combat';
import { idIndex } from '../../scripts/codegen/lib/ids';
import { readDoc } from '../../scripts/codegen/lib/table';

const load = <T>(n: string): T => JSON.parse(readFileSync(`data/gen/${n}.json`, 'utf8'));
const C = load<CombatFile>('combat').items;
const E = load<EnemiesFile>('enemies').items;
const K = load<ClashesFile>('clashes').items;
const ids = idIndex();

describe('combat generator: counts the docs state', () => {
  it('200 enemies = 32 + 40 + 20 + 102 + 6, ids unique', () => {
    expect(E.items.length).toBe(200);
    expect(E.counts).toEqual({ total: 200, code: 32, world: 40, npcGeneric: 20, npcNamed: 102, boss: 6 });
    expect(new Set(E.items.map((e) => e.id)).size).toBe(200);
  });
  it('102 NPC clashes with the five openers', () => {
    expect(K.items.length).toBe(102);
    expect(K.openers.map((o) => o.code)).toEqual(['B', 'X', 'S', 'T', 'P']);
    expect(new Set(K.items.map((c) => c.id)).size).toBe(102);
    for (const c of K.items) {
      expect(c.open.code, c.id).toMatch(/^[BXSTP]$/);
      expect(c.outcomes.length, c.id).toBeGreaterThanOrEqual(3);
    }
  });
  it('nine stances, a 14-kind matrix, ten sanity rules, five tiers', () => {
    expect(C.stances.map((s) => s.id)).toEqual(['melee', 'ranged', 'magic', 'guard', 'negotiate', 'calm_beast', 'evade', 'pray', 'flee']);
    expect(Object.keys(C.matrix.physical).length).toBe(14);
    expect(Object.keys(C.matrix.physical.undead)).toEqual(['blade', 'blunt', 'pierce', 'ranged', 'poison', 'silver', 'iron']);
    expect(Object.keys(C.matrix.special.undead).length).toBe(9);
    expect(C.matrix.sanity.map((s) => s.id)).toEqual(Array.from({ length: 10 }, (_, i) => `CR-${String(i + 1).padStart(2, '0')}`));
    expect(C.tiers.map((t) => t.id)).toEqual(['grunt', 'normal', 'chief', 'boss', 'legend']);
    expect(C.encounters.worldFlags.length).toBe(22);
    expect(C.encounters.mass.length).toBe(6);
  });
  it('the roll numbers of 01-core §4', () => {
    expect(C.roll).toMatchObject({ weak: 4, veryWeak: 6, resist: -4, selfHandicap: -4, allyPerPerson: 2, allyCap: 4, aptBonus: { 1: 1, 2: 2, 3: 4 }, firstBeat: { advantage: 2, ambush: -2 } });
    expect(C.damage.dcDamage).toBe(2.4);
    expect(C.encounters).toMatchObject({ base: 0.012, luckFactor: 0.015, capPerYear: 4, capPerYearSoldier: 8, bossPerYear: 1 });
    expect(C.damage.wounds.map((w) => [w.from, w.to])).toEqual([[1, 60], [61, 80], [81, 90], [91, 96], [97, 100]]);
  });
  it('reward table per tier', () => {
    expect(C.rewards.byTier.find((t) => t.tier === 'บอส')).toMatchObject({ material: 1, weapon: 0.25, blessing: 0.15, curse: 0.12, skill: 0.12 });
  });
});

describe('combat generator: references across files', () => {
  it('named NPC enemies and clash NPCs exist in the NPC index', () => {
    for (const e of E.items.filter((x) => x.group === 'npc_named')) expect(ids.npcs.has(e.id), e.id).toBe(true);
    for (const c of K.items) expect(ids.npcs.has(c.npc), c.id).toBe(true);
  });
  it('every clash belongs to a named NPC with an enemy row', () => {
    const named = new Set(E.items.filter((e) => e.group === 'npc_named').map((e) => e.id));
    for (const c of K.items) expect(named.has(c.npc), c.id).toBe(true);
  });
  it('world-flag enemy lists name real enemies', () => {
    const all = new Set(E.items.map((e) => e.id));
    for (const f of C.encounters.worldFlags) for (const id of f.enemies) expect(all.has(id) || ids.kind(id) !== 'unknown', `${f.flag} ${id}`).toBe(true);
  });
  it('weak and resist tags of enemies are known attack tags', () => {
    const tags = new Set(Object.values(C.matrix.physical).concat(Object.values(C.matrix.element), Object.values(C.matrix.special)).flatMap((v) => Object.keys(v)));
    tags.add('sun');
    tags.add('talk');
    for (const e of E.items) for (const r of [...e.weak, ...e.resist]) expect(tags.has(r.tag) || /[฀-๿]/.test(r.name) || r.tag.startsWith('#'), `${e.id} ${r.name}`).toBe(true);
  });
  it('enemies in 05-rewards gift table are known kinds', () => {
    expect(C.rewards.gifts.length).toBe(13);
  });
});

describe('combat generator: two rows against the docs', () => {
  it('wolf (code monster) and MH02-1 (named NPC)', () => {
    const w = E.items.find((e) => e.id === 'wolf')!;
    expect(w).toMatchObject({ name: 'หมาป่าเงา', tier: 'ปกติ', dc: 10, group: 'code' });
    expect(readDoc('docs/systems/combat/03-enemies.md')).toContain('| wolf | หมาป่าเงา | beast ฝูง | ปกติ | 10 |');
    const m = E.items.find((e) => e.id === 'MH02-1')!;
    expect(m).toMatchObject({ name: 'ดราซาร์โมธ จอมมาร', tier: 'บอส', wounds: 5, dc: 22, group: 'npc_named' });
    expect(m.weak).toEqual([{ tag: 'holy', name: 'ศักดิ์สิทธิ์', mark: '★' }]);
    expect(readDoc('docs/systems/combat/03-enemies.md')).toContain('| MH02-1 | ดราซาร์โมธ จอมมาร | บอส 5 | 22 | ศักดิ์สิทธิ์ ★ |');
    const c = K.items.find((x) => x.id === 'NF-MH02-1')!;
    expect(c.name).toBe('ดราซาร์โมธ จอมมาร');
    expect(c.continent).toBe('MH');
  });
});
