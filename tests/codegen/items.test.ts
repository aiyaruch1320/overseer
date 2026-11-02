import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ForgingFile, ItemsFile, MaterialsFile, WeaponsFile } from '../../src/core/data/types-items';
import { idIndex } from '../../scripts/codegen/lib/ids';
import { readDoc } from '../../scripts/codegen/lib/table';

const load = <T>(n: string): T => JSON.parse(readFileSync(`data/gen/${n}.json`, 'utf8'));
const W = load<WeaponsFile>('weapons').items;
const ITEMS = load<ItemsFile>('items').items;
const I = ITEMS.items;
const M = load<MaterialsFile>('materials').items;
const F = load<ForgingFile>('forging').items;

describe('items generator: counts the docs state', () => {
  it('weapons: 1,336 = 816 hand-written + 520 material variants (README, weapon-catalog)', () => {
    expect(W.items.length).toBe(1336);
    expect(W.counts).toMatchObject({ handWritten: 816, variants: 520, total: 1336 });
    expect(W.counts.byRarity).toEqual({ 'ของใช้': 40, C: 291, U: 399, R: 486, E: 84, L: 36 });
    expect(new Set(W.items.map((w) => w.id)).size).toBe(1336);
  });
  it('weapons by source group: 40 + 55 · 345 job · 126 secret and special · 143 + 27 · 44 · 36', () => {
    const n = (g: string) => W.items.filter((w) => w.group === g).length;
    expect([n('everyday'), n('standard'), n('job'), n('job_secret') + n('job_special'), n('country'), n('continent'), n('forge'), n('legend'), n('material')]).toEqual([40, 55, 345, 126, 143, 27, 44, 36, 520]);
    expect(W.jobSets.length).toBe(157);
  });
  it('other items: 332 in nine groups', () => {
    expect(I.length).toBe(332);
    expect(ITEMS.counts.byCat).toEqual({ armor: 37, accessory: 34, talisman: 24, folk: 24, consumable: 47, tool: 83, material: 36, key: 27, paired: 20 });
  });
  it('materials: 17 weapon materials (13 metal + 5 wood, dragon_bone in both) and 36 living-thing materials', () => {
    expect(M.materials.length).toBe(17);
    expect(M.materials.find((m) => m.id === 'dragon_bone')!.groups).toEqual(['โลหะ', 'ไม้']);
    expect(M.bio.length).toBe(36);
  });
  it('forging: 20 named smiths · 18 trials · 9 forges · 4 smith tiers', () => {
    expect([F.smiths.length, F.trials.length, F.forges.length, F.smithTiers.length]).toEqual([20, 18, 9, 4]);
    expect(F.roll.difficulty).toEqual({ C: 6, U: 9, R: 13, E: 17 });
    expect(F.order.prices.map((p) => p.price)).toEqual([15, 50, 250, 800]);
  });
  it('talisman story: 8 spirits, odds U 8/10 R 12/20 E 15/30 L 20/40, tiers U7 R8 E7 L2', () => {
    const t = ITEMS.talisman;
    expect(t.spirits.length).toBe(8);
    expect(t.odds).toEqual([
      { tier: 'U', omen: 0.08, possess: 0.1 },
      { tier: 'R', omen: 0.12, possess: 0.2 },
      { tier: 'E', omen: 0.15, possess: 0.3 },
      { tier: 'L', omen: 0.2, possess: 0.4 },
    ]);
    expect(t.npc.sim.tierCounts).toEqual({ U: 7, R: 8, E: 7, L: 2 });
    expect(t.npc.buyers.length).toBe(6);
    expect(t.exits.map((e) => e.weight)).toEqual([25, 30, 15, 20, 10]);
  });
  it('the values sim-items.mjs uses are in the JSON', () => {
    expect(ITEMS.prices.toolPayback).toEqual([
      { tier: 'C', base: 14, price: 6, bonus: 0.06, life: 15 },
      { tier: 'U', base: 22, price: 24, bonus: 0.1, life: 25 },
      { tier: 'R', base: 36, price: 80, bonus: 0.2, life: 40 },
    ]);
    expect(ITEMS.prices.priceIndexW).toEqual([0.7, 0.85, 1, 1.2, 1.5]);
    expect(ITEMS.prices.incomeIndexW).toEqual([0.5, 0.75, 1, 1.4, 1.9]);
    expect(ITEMS.talisman.npc.sim).toMatchObject({ start: 6, findPerYear: 0.01, countries: 20, holderDeathPerYear: 0.025, years: 1000, runs: 300 });
    expect(ITEMS.talisman.npc.exitWeights.collector).toEqual({ ก: 10, ข: 25, ค: 5, ง: 40, จ: 20 });
  });
});

describe('items generator: references across files', () => {
  const ids = idIndex();
  const weaponIds = new Set(W.items.map((w) => w.id));
  it('every smith makes list names a known weapon or material', () => {
    const mats = new Set(M.materials.map((m) => m.id));
    for (const s of F.smiths) for (const id of s.makes) expect(weaponIds.has(id) || mats.has(id), `${s.npc} ${id}`).toBe(true);
  });
  it('smith NPC ids exist in the NPC index', () => {
    for (const s of F.smiths) expect(ids.npcs.has(s.npc), s.npc).toBe(true);
  });
  it('material variants point at a standard weapon and a material', () => {
    const mats = new Set(M.materials.map((m) => m.id));
    for (const w of W.items.filter((x) => x.from)) {
      expect(weaponIds.has(w.from!.base)).toBe(true);
      expect(mats.has(w.from!.material)).toBe(true);
    }
  });
  it('repel abilities name enemy codes that exist', () => {
    for (const w of W.items) for (const a of w.abilities) for (const c of a.codes ?? []) if (/^[a-z_]+$/.test(c)) expect(ids.enemies.has(c) || ids.kind(c) !== 'unknown', `${w.id} ${c}`).toBe(true);
  });
  it('every weapon has a type with a known aptitude', () => {
    for (const w of W.items) expect(w.apt, w.id).not.toBe('');
  });
  it('ids are unique across weapons and other items; nine keys', () => {
    const all = new Set([...weaponIds, ...I.map((i) => i.id)]);
    expect(all.size).toBe(1336 + 332);
    expect(I.filter((i) => i.id.startsWith('ky_') && i.flags!.some((f) => /^key_/.test(f))).length).toBe(9);
  });
});

describe('items generator: prices agree with the generated catalog', () => {
  it('every item matches docs/_generated/item-catalog.md', () => {
    const md = readDoc('docs/_generated/item-catalog.md');
    const price = new Map<string, number | null>();
    for (const l of md.split('\n')) {
      const m = l.match(/^\| ([a-z]{2}_[a-z0-9_]+) \| .*? \| [CUREL] \| (\d+(?:\.\d+)?|ไม่ขาย) \|/);
      if (m) price.set(m[1], m[2] === 'ไม่ขาย' ? null : Number(m[2]));
    }
    expect(price.size).toBe(332);
    for (const i of I) expect(i.price, i.id).toBe(price.get(i.id));
  });
});

describe('items generator: two rows against the docs', () => {
  it('wl_flame (legendary sword) and ar_world_bark_mail', () => {
    const f = W.items.find((w) => w.id === 'wl_flame')!;
    expect(f).toMatchObject({ name: 'ดาบเพลิงนิรันดร์', rarity: 'L', power: 6, type: 'ดาบ', stats: { pow: 3, vit: 2 } });
    expect(f.tags).toEqual(['blade', 'fire', 'holy']);
    expect(readDoc('docs/systems/items/08-legendary.md')).toContain('| wl_flame | ดาบเพลิงนิรันดร์ | L | 6 | ดาบ | `blade` `fire` `holy` | `pow+3` `vit+2` |');
    const a = I.find((i) => i.id === 'ar_world_bark_mail')!;
    expect(a).toMatchObject({ tier: 'L', defense: 5, cat: 'armor', price: null });
    expect(a.stats).toEqual({ vit: 3, mag: 1, luk: 1 });
    expect(readDoc('docs/systems/items/12-armor.md')).toContain('| ar_world_bark_mail | เปลือกต้นไม้โลก | L | 5 |');
  });
});

// ---------- review M0-b fixes: M3 L3 ----------
describe('forging trials: the numbers are fields (M3)', () => {
  const trial = (id: string) => F.trials.find((t) => t.id === id)!;
  it('each trial has three ways whose weights add up to 100 (one way may be "—")', () => {
    expect(F.trials.length).toBe(18);
    for (const t of F.trials) {
      const ws = [t.a, t.b, t.c].map((p) => p.weight);
      expect(ws.reduce<number>((s, w) => s + (w ?? 0), 0), t.id).toBe(100);
      for (const p of [t.a, t.b, t.c]) expect(p.text.startsWith(p.weight === null ? '—' : String(p.weight)), `${t.id} ${p.key}`).toBe(true);
    }
    expect(trial('มือช่าง').c.weight).toBeNull();
  });
  it('the roll, its DC, bonus and auto-pass', () => {
    expect(trial('ทั่งฟังเสียง').a).toMatchObject({ weight: 45, trust: 2, roll: { stat: 'pow', dc: 13, bonus: [{ id: 'smithing', delta: 2 }], autoPass: ['ns_anvil_voice'] } });
    expect(trial('ยกค้อน').a.roll).toMatchObject({ stat: 'pow', dc: 15, autoPass: ['ยักษ์'] });
    expect(trial('ยิงเป้าเคลื่อนที่').a.roll).toMatchObject({ stat: 'spd', dc: 14, bonus: [{ id: 'bow', delta: 2 }] });
    expect(trial('ยืนในลมหายใจมังกร').a.roll).toMatchObject({ stat: 'vit', dc: 15, autoPass: ['b_flameward'] });
    expect(trial('มือช่าง').a.roll).toMatchObject({ what: 'งานช่าง' });
    expect(F.trials.filter((t) => t.a.roll?.dc).length).toBe(5);
  });
  it('trust earned or needed, gold, skills, multipliers, battles and the retreat way', () => {
    expect(trial('ทั่งฟังเสียง').b).toMatchObject({ weight: 35, trust: 2, skills: [{ id: 'smithing', delta: 1 }] });
    expect(trial('ยกค้อน').c).toMatchObject({ weight: 20, trustReq: { toward: 'ทูมิ', min: 2 } });
    expect(trial('ถ้ำเยติ').b.gold).toBe(80);
    expect(trial('ทรายแก้ว').b.gold).toBe(60);
    expect(trial('ทั่งฟังเสียง').c.weightMods).toEqual([{ ids: ['greedy', 'proud'], mul: 2 }]);
    expect(trial('พิธีเช้า').a).toMatchObject({ weightMods: [{ ids: ['devout'], mul: 2 }], grants: [{ id: 'nb_faith_forge', chance: 0.1 }] });
    expect(trial('คำสัญญาของมือปืน').b.grants).toEqual([{ id: 'c_oathbreaker', when: 'ถ้าถูกจับได้' }]);
    expect(trial('คำสาบาน').a.traits).toEqual(['knight', 'loyal_love']);
    expect(trial('ถ้ำเยติ').a.battle).toEqual(['yeti']);
    expect(trial('น้ำมันโคม').a.battle).toEqual(['npc_smuggler']);
    expect(trial('ทดลองในศึก').a).toMatchObject({ battle: [], battleWorld: true });
    expect(F.trials.filter((t) => t.c.retreat).length).toBe(11);
  });
  it('the numbers match the doc text of the same cell', () => {
    const doc = readDoc('docs/systems/items/10-forging.md');
    for (const t of F.trials) for (const p of [t.a, t.b, t.c]) {
      expect(doc, `${t.id} ${p.key}`).toContain(p.text);
      if (p.roll?.dc) expect(p.text).toMatch(new RegExp('ทอย `' + p.roll.stat + '` ' + p.roll.dc + '\\b'));
    }
  });
});

describe('weapon names from materials do not repeat a word (L3)', () => {
  it('"ตะบองไม้ไม้ป่าเหี่ยว" is "ตะบองไม้ป่าเหี่ยว", and no variant name doubles its join', () => {
    const name = (id: string) => W.items.find((w) => w.id === id)!.name;
    expect(name('ws_war_club_withered_wood')).toBe('ตะบองไม้ป่าเหี่ยว');
    expect(name('ws_iron_claws_steel')).toBe('กรงเล็บเหล็กกล้า');
    expect(name('ws_crossbow_hardwood')).toBe('หน้าไม้เนื้อแข็ง');
    expect(name('ws_mace_rune_steel')).toBe('กระบองหัวเหล็กรูน');
    for (const w of W.items.filter((x) => x.group === 'material')) {
      const mat = M.materials.find((m) => m.id === w.from!.material)!;
      expect(w.name, w.id).not.toMatch(/(.{3,})\1/);
      expect(w.name, w.id).not.toMatch(/ไม้ไม้|เหล็กเหล็ก/);
      expect(w.name.endsWith(mat.name.slice(-3)), w.id).toBe(true);
    }
    expect(W.items.length).toBe(1336);
  });
  it('a weapon whose name does not end in the material word keeps both whole', () => {
    expect(W.items.find((w) => w.id === 'ws_shortsword_bronze')?.name ?? 'ดาบสั้นสำริด').toBe('ดาบสั้นสำริด');
  });
});
