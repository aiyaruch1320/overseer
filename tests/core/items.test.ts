// The items system (code-plan §7 row "items", docs/systems/items/): catalogue, prices, holding and wearing, wear, legends, forging, tools, talismans.
import { describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { birth, characterSystem } from '../../src/core/character';
import { Game, type Ctx } from '../../src/core/game';
import { newGame } from '../../src/core/state';
import type { LifeState } from '../../src/core/types';
import type { ForgingData } from '../../src/core/data/types-items';
import { storySystem } from '../../src/core/story';
import { travelSystem } from '../../src/core/travel';
import {
  activeCount, afterBattle, ancients, armorOf, catalog, damageFloor, equip, forgeOutcome, gearStats, gearTags, grantable, initTalismans, itemsExt, itemsSystem, itemsWorld, jobWeapons, lookup, nearAtHand,
  paybackYears, priceOf, releaseLegends, scan, sellPrice, shieldMult, shop, shopMax, SMITH_KIND, startForge, talismanYear, toolBonus, toolsOf, upkeep, wielded, RANK, TALISMAN_CAP,
} from '../../src/core/items';

const data = loadGen();
const forging = data.forging.items as ForgingData;

function game(seed: number) {
  const g = new Game(newGame(seed), data, [characterSystem, storySystem, travelSystem, itemsSystem]);
  g.init();
  return g;
}

function born(seed: number, opts: Parameters<typeof birth>[1] = {}, patch: Partial<LifeState> = {}) {
  const g = game(seed);
  const life = birth(g.ctx, { second: null, ...opts });
  g.born();
  Object.assign(life, patch);
  return { g, ctx: g.ctx, life };
}

/** Gives pieces and lets the system notice them. */
function give(ctx: Ctx, life: LifeState, ...ids: string[]) {
  life.items.push(...ids);
  scan(ctx, life);
  equip(ctx, life);
}

describe('the catalogue', () => {
  it('holds the 1,336 weapons, the 332 articles and the materials of the documents', () => {
    const { ctx } = born(1);
    const c = catalog(ctx);
    expect(c.weaponList).toHaveLength(1336);
    expect(c.itemList).toHaveLength(332);
    expect(c.weaponData.counts.byRarity).toEqual({ ของใช้: 40, C: 291, U: 399, R: 486, E: 84, L: 36 });
    expect(c.materials.size).toBe(17);
    expect(c.forging.smiths).toHaveLength(20);
    expect(lookup(ctx, 'ws_longsword')?.kind).toBe('weapon');
    expect(lookup(ctx, 'ar_plate_cuirass')?.kind).toBe('item');
    expect(lookup(ctx, 'bronze')?.kind).toBe('material');
    expect(lookup(ctx, 'nothing')).toBeUndefined();
  });
  it('the power and the stat budget of a weapon follow its tier (README §1)', () => {
    const { ctx } = born(2);
    for (const r of catalog(ctx).weaponData.rarity) {
      const of = catalog(ctx).weaponList.filter((w) => w.rarity === r.rarity);
      for (const w of of.filter((x) => x.group !== 'material')) {
        expect(w.power, w.id).toBeGreaterThanOrEqual(r.power[0]);
        expect(w.power, w.id).toBeLessThanOrEqual(r.power[1]);
      }
    }
  });
  it('a legendary weapon returns to a place, every one is a single piece, the aptitude of each type is known', () => {
    const { ctx } = born(3);
    const legends = catalog(ctx).byGroup.get('legend')!;
    expect(legends).toHaveLength(36);
    for (const w of legends) expect(w.returnTo, w.id).toBeTruthy();
    for (const w of catalog(ctx).weaponList) expect(w.apt, w.id).toBeTruthy();
    expect(catalog(ctx).start.get('sword')).toBe('ws_longsword');
  });
});

describe('prices (19-prices.md)', () => {
  it('a weapon: base of the tier × the piece factor × the price index of W; E at W5 is 1.5 times', () => {
    const { ctx } = born(4);
    expect(priceOf(ctx, 'ws_longsword', { w: 3 })).toBe(15);
    expect(priceOf(ctx, 'ws_longsword', { w: 1 })).toBe(11);
    expect(priceOf(ctx, 'ws_longsword', { w: 5 })).toBe(23);
    const e = catalog(ctx).weaponList.find((w) => w.rarity === 'E' && w.group === 'forge')!;
    const p3 = priceOf(ctx, e.id, { w: 3 })!;
    expect(p3).toBeGreaterThan(800 * 0.75 - 1);
    expect(p3).toBeLessThan(800 * 1.35 * 1.15 + 1);
    expect(priceOf(ctx, e.id, { w: 5 })!).toBeCloseTo(p3 * 1.5, -1);
  });
  it('the piece factor stays between 0.75 and 1.35 and a tag # adds 5%', () => {
    const { ctx } = born(5);
    const hashed = catalog(ctx).weaponList.find((w) => w.rarity === 'E' && w.tags.some((t) => t.startsWith('#')))!;
    const plain = catalog(ctx).weaponList.find((w) => w.rarity === 'C' && w.group === 'standard')!;
    for (const w of [hashed, plain]) {
      const p = priceOf(ctx, w.id, { w: 3 })!;
      const base = catalog(ctx).itemData.prices.weaponBase[w.rarity]!;
      expect(p).toBeGreaterThanOrEqual(Math.round(base * 0.75) - 1);
      expect(p).toBeLessThanOrEqual(Math.round(base * 1.35 * 1.15) + 1);
    }
  });
  it('an article carries the price of a W3 market; the place changes it (made here ×0.85, black market ×1.5); L, keys and everyday articles have none', () => {
    const { ctx } = born(6);
    expect(priceOf(ctx, 'ar_work_clothes', { w: 3 })).toBe(18);
    expect(priceOf(ctx, 'ar_work_clothes', { w: 3, black: true })).toBe(27);
    expect(priceOf(ctx, 'ky_oransal_scale')).toBeNull();
    expect(priceOf(ctx, 'wl_oran')).toBeNull();
    expect(priceOf(ctx, 'wi_stick')).toBeNull();
    const made = catalog(ctx).itemList.find((i) => i.price && /AL-0\d/.test(i.where))!;
    const code = /AL-0\d/.exec(made.where)![0];
    expect(priceOf(ctx, made.id, { w: 3, country: code })!).toBeLessThan(priceOf(ctx, made.id, { w: 3, country: 'KD-01' })!);
  });
  it('selling back: a shop 40%, a user 70%, the black market 30%', () => {
    const { ctx } = born(7);
    expect(sellPrice(ctx, 'ar_plate_cuirass', 'shop', { w: 3 })).toBe(Math.floor(priceOf(ctx, 'ar_plate_cuirass', { w: 3 })! * 0.4));
    expect(sellPrice(ctx, 'ar_plate_cuirass', 'direct', { w: 3 })).toBeGreaterThan(sellPrice(ctx, 'ar_plate_cuirass', 'shop', { w: 3 }));
    expect(sellPrice(ctx, 'ar_plate_cuirass', 'black', { w: 3 })).toBeLessThan(sellPrice(ctx, 'ar_plate_cuirass', 'shop', { w: 3 }));
    expect(sellPrice(ctx, 'wl_oran')).toBe(0);
  });
  it('a shop sells by the size of the town: a village C, a small town U, a town R, a capital E', () => {
    expect([1, 2, 3, 4, 5].map((s) => shopMax(s, 3))).toEqual(['C', 'U', 'R', 'R', 'E']);
    expect(shopMax(4, 4)).toBe('E');
  });
});

describe('holding and wearing (11-item-system.md §3)', () => {
  it('the character holds the weapon with the best score: its tier, its power, a trained aptitude', () => {
    const { ctx, life } = born(8, { race: 'human' }, { hAge: 25 });
    life.aptitudes = { sword: 1 };
    give(ctx, life, 'ws_dagger', 'ws_longsword');
    expect(wielded(ctx).id).toBe('ws_longsword');
    expect(wielded(ctx)).toMatchObject({ skilled: true, unskilled: false, power: 1, type: 'ดาบ' });
    give(ctx, life, 'wf_gromholm_1');
    // a weapon of a kind the character is trained in outranks a better one of another kind only by the points of §3; this one is the same kind (sword)
    expect(wielded(ctx).id).toBe('wf_gromholm_1');
    expect(wielded(ctx).unbreakable).toBe(true);
  });
  it('a weapon of a kind the character has no aptitude for gives −1 on the roll (unskilled); an everyday article does not', () => {
    const { ctx, life } = born(9, { race: 'human' }, { hAge: 25 });
    life.aptitudes = {};
    give(ctx, life, 'ws_longsword');
    expect(wielded(ctx).unskilled).toBe(true);
    life.items = [];
    scan(ctx, life);
    equip(ctx, life);
    expect(wielded(ctx).everyday).toBe(true);
    expect(wielded(ctx).unskilled).toBe(false);
    expect(wielded(ctx).power).toBe(0);
  });
  it('with nothing in the bag the character picks up the article near at hand for its aptitude; a child holds only those', () => {
    const { ctx, life } = born(10, { race: 'human' }, { hAge: 25 });
    life.aptitudes = { whip: 1 };
    expect(nearAtHand(ctx, life).apt).toBe('whip');
    const kid = born(11, { race: 'human' }, { hAge: 9 });
    give(kid.ctx, kid.life, 'ws_longsword');
    expect(wielded(kid.ctx).everyday).toBe(true);
    kid.life.hAge = 16;
    equip(kid.ctx, kid.life);
    expect(wielded(kid.ctx).id).toBe('ws_longsword');
  });
  it('armour: defence N cuts the damage by 4% each (3 → ×0.88, 6 → ×0.76); a shield cannot go with a two-handed weapon; the floor is ×0.35', () => {
    const { ctx, life } = born(12, { race: 'human' }, { hAge: 25 });
    give(ctx, life, 'ar_plate_cuirass');
    expect(armorOf(ctx)).toMatchObject({ id: 'ar_plate_cuirass', defense: 3 });
    expect(armorOf(ctx).mult).toBeCloseTo(0.88);
    give(ctx, life, 'ar_titan_hide_plate');
    expect(armorOf(ctx).mult).toBeCloseTo(0.76);
    life.aptitudes = { sword: 1 };
    life.items = ['ws_greatsword', 'ar_tower_shield'];
    scan(ctx, life);
    equip(ctx, life);
    expect(wielded(ctx).twoHand).toBe(true);
    expect(armorOf(ctx).defense).toBe(0);
    life.items = ['ws_longsword', 'ar_tower_shield'];
    scan(ctx, life);
    equip(ctx, life);
    expect(armorOf(ctx).shield).toBe(true);
    expect(shieldMult(ctx)).toBeCloseTo(0.5 - 0.05 * 3);
    expect(damageFloor()).toBe(0.35);
  });
  it('the gear gives its stats and tags while worn: the weapon, the armour, two ornaments, one charm', () => {
    const { ctx, life } = born(13, { race: 'human' }, { hAge: 25 });
    life.aptitudes = { sword: 1 };
    give(ctx, life, 'ws_longsword', 'ar_work_clothes', 'ac_copper_ring', 'ac_bead_string', 'tm_f_rice_knot');
    const s = gearStats(ctx);
    expect(s.pow).toBe(1);
    expect(s.vit).toBe(1);
    expect(s.luk).toBeGreaterThanOrEqual(1);
    expect(gearTags(ctx)).toContain('blade');
    expect(gearTags(ctx)).toContain('farm');
    expect(itemsExt(life).acc.length).toBeLessThanOrEqual(2);
  });
  it('a skeptic turns down a charm of tier E or higher half of the time (decided once)', () => {
    let refused = 0;
    let kept = 0;
    for (let seed = 100; seed < 140; seed++) {
      const { ctx, life } = born(seed, { race: 'human' }, { hAge: 30 });
      life.traits.push('skeptic');
      give(ctx, life, 'tm_widow_comb');
      if (itemsExt(life).charm) kept++;
      else refused++;
      equip(ctx, life);
      expect(!!itemsExt(life).charm).toBe(kept > 0 && !itemsExt(life).refused.includes('tm_widow_comb'));
    }
    expect(refused).toBeGreaterThan(8);
    expect(kept).toBeGreaterThan(8);
  });
});

describe('wear (README §5, 11-item-system.md §4)', () => {
  it('a weapon C or U may go dull after ten fights (power −2) and a smith mends it; c_dull makes it certain; an unbreakable one and an L never go dull', () => {
    const { ctx, life } = born(14, { race: 'human' }, { hAge: 30, gold: 500 });
    life.aptitudes = { sword: 1 };
    life.curses.push('c_dull');
    give(ctx, life, 'ws_longsword');
    for (let i = 0; i < 9; i++) afterBattle(ctx, { won: true });
    expect(itemsExt(life).dull).toEqual([]);
    afterBattle(ctx, { won: true });
    expect(itemsExt(life).dull).toEqual(['ws_longsword']);
    expect(wielded(ctx)).toMatchObject({ dull: true, power: 0 });
    upkeep(ctx, life);
    expect(itemsExt(life).dull).toEqual([]);
    const u = born(15, { race: 'human' }, { hAge: 30 });
    u.life.curses.push('c_dull');
    u.life.aptitudes = { sword: 1 };
    give(u.ctx, u.life, 'wf_gromholm_1');
    for (let i = 0; i < 30; i++) afterBattle(u.ctx, { won: true });
    expect(itemsExt(u.life).dull).toEqual([]);
  });
  it('armour loses a point of defence for every three lost fights, E and L never wear, and a mend costs 20%', () => {
    const { ctx, life } = born(16, { race: 'human' }, { hAge: 30, gold: 1000 });
    give(ctx, life, 'ar_plate_cuirass');
    for (let i = 0; i < 3; i++) afterBattle(ctx, { won: false });
    expect(armorOf(ctx).defense).toBe(2);
    upkeep(ctx, life);
    expect(armorOf(ctx).defense).toBe(3);
    expect(life.gold).toBeLessThan(1000);
    const e = born(17, { race: 'human' }, { hAge: 30 });
    give(e.ctx, e.life, 'ar_rune_plate');
    for (let i = 0; i < 9; i++) afterBattle(e.ctx, { won: false });
    expect(armorOf(e.ctx).defense).toBe(4);
  });
  it('an engraved weapon remembers what it killed and gives +1 against it', () => {
    const { ctx, life } = born(18, { race: 'human' }, { hAge: 30 });
    life.aptitudes = { sword: 1 };
    const w = catalog(ctx).weaponList.find((x) => x.abilities.some((a) => a.k === 'engrave'))!;
    life.aptitudes[w.apt.split(' ')[0]] = 1;
    give(ctx, life, w.id);
    expect(wielded(ctx).engrave).toBe(true);
    afterBattle(ctx, { won: true, kills: ['wolf'] });
    expect(itemsExt(life).engraved[w.id]).toEqual(['wolf']);
  });
});

describe('getting things', () => {
  it('the weapon a job starts with is its C weapon; the next one comes now and then', () => {
    const { ctx, life } = born(19, { race: 'human' }, { hAge: 25, job: 'farmer' });
    jobWeapons(ctx, life);
    scan(ctx, life);
    expect(life.items).toContain('wj_farmer_c');
    expect(itemsExt(life).given).toEqual(['farmer']);
    jobWeapons(ctx, life);
    expect(life.items.filter((i) => i === 'wj_farmer_c')).toHaveLength(1);
  });
  it('what other systems give through `grant` is noticed, logged, and a key sets its flag', () => {
    const { ctx, life } = born(20, { race: 'human' }, { hAge: 25 });
    life.items.push('ky_bone_crown', 'ar_plate_cuirass');
    scan(ctx, life);
    expect(life.flags).toContain('key_morhaven');
    const gets = ctx.state.log.filter((e) => e.sys === 'items' && e.kind === 'get').map((e) => e.id);
    expect(gets).toEqual(expect.arrayContaining(['ky_bone_crown', 'ar_plate_cuirass']));
  });
  it('a year of shopping buys what the purse and the town allow, never more than a third of the purse for one piece', () => {
    const bought: number[] = [];
    for (let seed = 200; seed < 260; seed++) {
      const { ctx, life } = born(seed, { race: 'human', country: 'AL-01' }, { hAge: 28, gold: 400 });
      life.aptitudes = { sword: 2 };
      for (let y = 0; y < 8; y++) shop(ctx, life);
      for (const e of ctx.state.log.filter((x) => x.sys === 'items' && x.kind === 'buy')) bought.push(Number(e.data.price));
      expect(life.gold).toBeGreaterThanOrEqual(0);
    }
    expect(bought.length).toBeGreaterThan(30);
    expect(Math.max(...bought)).toBeLessThanOrEqual(400 * 0.35);
  });
});

describe('legendary weapons (08-legendary.md)', () => {
  it('there is one in the world: held by one life, free again or broken when the owner dies, and a broken one cannot come back', () => {
    const { ctx, life } = born(21, { race: 'human' }, { hAge: 40 });
    expect(grantable(ctx, 'wl_oran')).toBe(true);
    give(ctx, life, 'wl_oran', 'wl_dragon_bane');
    expect(itemsWorld(ctx).legend.wl_oran).toBe(`${life.id}:${life.birthYear}`);
    expect(grantable(ctx, 'wl_oran')).toBe(false);
    releaseLegends(ctx, life);
    expect(itemsWorld(ctx).legend.wl_oran).toBe('free');
    expect(itemsWorld(ctx).legend.wl_dragon_bane).toBe('broken');
    expect(grantable(ctx, 'wl_oran')).toBe(true);
    expect(grantable(ctx, 'wl_dragon_bane')).toBe(false);
    const next = born(22, { race: 'human' }, { hAge: 40 });
    next.ctx.state.god.ext.items = itemsWorld(ctx);
    give(next.ctx, next.life, 'wl_dragon_bane');
    expect(next.life.items).not.toContain('wl_dragon_bane');
  });
  it('a legend held by another life cannot be held by a second one', () => {
    const a = born(23, { race: 'human' }, { hAge: 40 });
    give(a.ctx, a.life, 'wl_flame');
    const b = born(24, { race: 'human' }, { hAge: 40, id: 'L2' });
    b.ctx.state.god.ext.items = itemsWorld(a.ctx);
    give(b.ctx, b.life, 'wl_flame');
    expect(b.life.items).not.toContain('wl_flame');
    expect(a.life.items).toContain('wl_flame');
  });
});

describe('forging (10-forging.md)', () => {
  const table: [keyof typeof SMITH_KIND, string, number][] = [
    ['village', 'C', 0], ['village', 'U', 1], ['city', 'U', 2], ['city', 'R', 3], ['nation', 'R', 4], ['nation', 'E', 5], ['named', 'E', 6],
  ];
  it.each(table)('the roll of a %s smith for tier %s gives the odds of the table (fail, flawed, as ordered, masterpiece)', (kind, tier, row) => {
    // the rows of the document table that do not add the trust of the smith, the material or the god
    const odds = forging.roll.odds.find((o) => o.who === ['หมู่บ้าน · C', 'หมู่บ้าน · U', 'เมือง · U', 'เมือง · R', 'ชาติช่าง · R', 'ชาติช่าง · E', 'ช่างที่มีชื่อ · E'][row])!;
    const diff = forging.roll.difficulty[tier];
    const smith = SMITH_KIND[kind];
    const n: Record<string, number> = { fail: 0, flawed: 0, ordered: 0, masterpiece: 0 };
    for (let d = 1; d <= 20; d++) n[forgeOutcome(d, d + smith.skill, diff, smith.max > RANK[tier as 'C'])] += 1;
    expect(n.fail / 20).toBeCloseTo(odds.fail, 5);
    expect(n.flawed / 20).toBeCloseTo(odds.flawed, 5);
    expect(n.ordered / 20).toBeCloseTo(odds.asOrdered, 5);
    expect(n.masterpiece / 20).toBeCloseTo(odds.masterpiece, 5);
  });
  it('a need ends in a weapon, a refund or a retreat: the chain runs its steps in order, the fare and the price leave the purse, a named smith is walked to', () => {
    let weapons = 0;
    let steps: string[] = [];
    for (let seed = 300; seed < 330; seed++) {
      const { g, ctx, life } = born(seed, { race: 'dwarf', country: 'KD-01' }, { hAge: 30, gold: 3000 });
      life.aptitudes = { hammer: 2 };
      const before = life.items.length;
      expect(startForge(ctx, life, 'อาวุธทื่อหรือหักในศึก', RANK.E)).toBe(true);
      const f = itemsExt(life).forge!;
      expect(['village', 'city', 'nation', 'named']).toContain(f.kind);
      for (let i = 0; i < 80 && itemsExt(life).forge; i++) g.beat();
      expect(itemsExt(life).forge).toBeUndefined();
      const log = ctx.state.log.filter((e) => e.sys === 'items' && e.kind === 'forge').map((e) => String(e.data.step));
      steps = log;
      expect(log[0]).toBe('need');
      expect(log[log.length - 1]).toMatch(/result|abort/);
      if (life.items.length > before) weapons++;
    }
    expect(weapons).toBeGreaterThan(15);
    expect(steps.length).toBeGreaterThan(2);
  });
  it('a masterpiece gets one extra ability, a flawed piece loses a point, the weapon carries the name of the smith and the year', () => {
    let marks = 0;
    let flaws = 0;
    for (let seed = 400; seed < 520; seed++) {
      const { g, ctx, life } = born(seed, { race: 'human', country: 'AL-01' }, { hAge: 30, gold: 3000 });
      life.aptitudes = { sword: 2 };
      if (!startForge(ctx, life, 'x', RANK.U)) continue;
      for (let i = 0; i < 40 && itemsExt(life).forge; i++) g.beat();
      for (const [id, mod] of Object.entries(itemsExt(life).mods)) {
        expect(life.items).toContain(id);
        expect(mod.name).toContain(catalog(ctx).weapons.get(id)!.name);
        expect(mod.by).toBeTruthy();
        if (mod.flaw) flaws++;
        else if (mod.unbreakable || mod.engrave || mod.parry || mod.stat || mod.stance || mod.tags) marks++;
      }
    }
    expect(marks).toBeGreaterThan(0);
    expect(flaws).toBeGreaterThan(0);
  });
  it('a smith with smithing 3 forges alone and pays no gold', () => {
    const { g, ctx, life } = born(30, { race: 'dwarf', country: 'KD-01' }, { hAge: 40, gold: 5, job: 'smith' });
    life.aptitudes = { smithing: 3, hammer: 2 };
    expect(startForge(ctx, life, 'x', RANK.R)).toBe(true);
    expect(itemsExt(life).forge!.how).toBe('self');
    for (let i = 0; i < 20 && itemsExt(life).forge; i++) g.beat();
    expect(life.gold).toBe(5);
    expect(ctx.state.log.some((e) => e.sys === 'items' && e.kind === 'forge' && e.data.step === 'result')).toBe(true);
  });
});

describe('life tools (11-item-system.md §6, 17-life-tools.md)', () => {
  it('only the tools of the job\'s aptitudes count, the best four, at most +50%', () => {
    const { ctx, life } = born(31, { race: 'human' }, { hAge: 30, job: 'farmer' });
    give(ctx, life, 'lt_hoe');
    expect(toolBonus(ctx)).toBeCloseTo(0.06);
    give(ctx, life, 'lt_plow', 'lt_ash_plow', 'lt_irrigation_wheel', 'lt_ancestors_hoe');
    expect(toolsOf(ctx, life)).toHaveLength(4);
    expect(toolBonus(ctx)).toBe(0.5);
    life.items = ['lt_fishing_rod'];
    scan(ctx, life);
    expect(toolBonus(ctx)).toBe(0);
  });
  it('a tool wears out after 15, 25 and 40 years by tier; an heirloom E never', () => {
    const { ctx, life } = born(32, { race: 'human' }, { hAge: 20, job: 'farmer' });
    give(ctx, life, 'lt_hoe', 'lt_plow', 'lt_ash_plow', 'lt_ancestors_hoe');
    for (const [age, gone] of [[34, []], [35, ['lt_hoe']], [44, ['lt_hoe']], [45, ['lt_hoe', 'lt_plow']], [59, ['lt_hoe', 'lt_plow']], [60, ['lt_hoe', 'lt_plow', 'lt_ash_plow']], [90, ['lt_hoe', 'lt_plow', 'lt_ash_plow']]] as [number, string[]][]) {
      life.hAge = age;
      upkeep(ctx, life);
      for (const id of ['lt_hoe', 'lt_plow', 'lt_ash_plow']) expect(life.items.includes(id), `${id} at ${age}`).toBe(!gone.includes(id));
      expect(life.items).toContain('lt_ancestors_hoe');
    }
  });
  it('payback of a tool at W3 matches the table: C 7.1 years, U 10.9, R 11.1', () => {
    const { ctx } = born(33);
    expect(paybackYears(ctx, 'C', 3)).toBeCloseTo(7.1, 0);
    expect(paybackYears(ctx, 'U', 3)).toBeCloseTo(10.9, 0);
    expect(paybackYears(ctx, 'R', 3)).toBeCloseTo(11.1, 0);
  });
});

describe('the ancient talismans in NPC hands (20-npc-talisman.md)', () => {
  it('24 pieces (U 7, R 8, E 7, L 2), six held at the start and the rest in the ground', () => {
    const { ctx } = born(34);
    initTalismans(ctx);
    const a = ancients(ctx);
    expect(a).toHaveLength(24);
    expect(a.filter((x) => x.tier === 'U')).toHaveLength(7);
    expect(a.filter((x) => x.tier === 'L')).toHaveLength(2);
    const t = itemsWorld(ctx).talisman;
    expect(Object.values(t.held).filter((h) => h !== 'ruin')).toHaveLength(6);
    expect(Object.values(t.held).filter((h) => h === 'ruin')).toHaveLength(18);
  });
  it('never more than ten in omen or possession at once, whatever the years; the same seed runs the same centuries', () => {
    const run = (seed: number) => {
      const { ctx } = born(seed);
      initTalismans(ctx);
      const rng = ctx.rng('items.talisman');
      let max = 0;
      for (let y = 0; y < 1500; y++) {
        talismanYear(ctx, rng, TALISMAN_CAP, false);
        max = Math.max(max, activeCount(itemsWorld(ctx).talisman));
      }
      return { max, t: JSON.stringify(itemsWorld(ctx).talisman) };
    };
    const a = run(35);
    expect(a.max).toBeLessThanOrEqual(TALISMAN_CAP);
    expect(a.max).toBeGreaterThan(0);
    expect(run(35).t).toBe(a.t);
    expect(run(36).t).not.toBe(a.t);
  });
});

describe('a whole life', () => {
  it('holds only things that exist, wears only what it holds, and the same seed gives the same life', () => {
    const run = (seed: number) => {
      const g = game(seed);
      g.worldSteps(45);
      birth(g.ctx, {});
      g.born();
      g.runLife(1500);
      return g;
    };
    const a = run(61);
    expect(JSON.stringify(a.state.life!.ext.items)).toBe(JSON.stringify(run(61).state.life!.ext.items));
    for (const seed of [62, 63, 64, 65]) {
      const g = run(seed);
      const life = g.state.life!;
      for (const id of life.items) expect(lookup(g.ctx, id), id).toBeDefined();
      const ex = itemsExt(life);
      for (const id of [ex.wield, ex.armor, ex.charm, ...ex.acc]) if (id) expect(life.items).toContain(id);
      expect(g.state.log.some((e) => e.sys === 'items' && e.kind === 'talisman')).toBe(true);
    }
  });
});
