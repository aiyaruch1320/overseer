// The god system, steps G0 to G2 (docs/systems/god/06-implementation.md §2 and §5): prices, income, caps, the chest and dreams.
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { idx } from '../../src/core/character';
import type { GiftLike } from '../../src/core/character/data';
import { command } from '../../src/core/command';
import { sortSystems, makeCtx, type Ctx, type GameData, type Game } from '../../src/core/game';
import {
  addBelief, canPay, checkDream, checkOpen, compOf, currentChest, dreamWeight, dreamsOf, earn, godSystem, incomeOf, offersNow, openChest, pathsNow, pay, pickSlot,
  priceOf, resolveDream, rerollChest, settleDreams, obeyChance, tierChances, sourceOf, type Chest, type ChestSlot,
} from '../../src/core/god';
import { OPPOSITES, TIERS } from '../../src/core/god/tuning';
import { bump, count, gx } from '../../src/core/god/state';
import { newGame } from '../../src/core/state';
import type { Condition, LifeState } from '../../src/core/types';
import { test as holds } from '../../src/core/rules';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

interface World {
  game: Game;
  ctx: Ctx;
  life: LifeState;
}

/** A real game with the god system added, a life born, and `years` life years lived. */
function world(seed: number, o: { race?: string; years?: number; policy?: 'เงียบ' | 'เมตตา' | 'ลงโทษ' | 'สุ่ม'; data?: GameData } = {}): World {
  const s = createSession(o.data ?? data, { seed, race: o.race, policy: o.policy });
  s.game.systems.push(godSystem);
  s.game.systems.splice(0, s.game.systems.length, ...sortSystems(s.game.systems));
  startLife(s);
  const g = s.game;
  const stop = (o.years ?? 0) + g.state.life!.hAge;
  for (let i = 0; i < 4 * 80 && g.state.life && !g.state.life.dead && g.state.life.hAge < stop; i++) g.beat();
  return { game: g, ctx: g.ctx, life: g.state.life! };
}

/** A tiny state with the god data only: for the tests of prices and income that need no story. */
function bare(): { ctx: Ctx; life: LifeState } {
  const state = newGame(7);
  const ctx = makeCtx(state, { god: data.god });
  const life: LifeState = {
    id: 'L1', name: 't', race: 'human', gender: 'm', birthYear: 0, lifespan: 75, hAge: 20, country: 'AL-01', home: 'AL-01', traits: [], aptitudes: {}, skills: [],
    blessings: [], curses: [], fate: [], cls: 'c3', gold: 0, stats: { pow: 0, mag: 0, spd: 0, luk: 0, int: 10, vit: 0 }, items: [], flags: [], passed: {}, pending: [],
    memory: [], godFaith: 0, heart: 0, ext: {},
  };
  state.life = life;
  state.god.light = 100;
  state.god.dread = 100;
  return { ctx, life };
}

// ---------- G0: prices ----------

describe('god G0: prices (01-power.md §2)', () => {
  it('the tables by tier', () => {
    const { ctx } = bare();
    const cases: [Parameters<typeof priceOf>[1], string, number][] = [
      ['bless', 'C', 10], ['bless', 'U', 16], ['bless', 'R', 26], ['bless', 'E', 40], ['bless', 'L', 60],
      ['skill', 'C', 10], ['skill', 'U', 16], ['skill', 'R', 26], ['skill', 'E', 40],
      ['item', 'C', 8], ['item', 'U', 14], ['item', 'R', 24], ['item', 'E', 40],
      ['holyWeapon', 'C', 12], ['holyWeapon', 'U', 20], ['holyWeapon', 'R', 34], ['holyWeapon', 'E', 55],
    ];
    for (const [a, t, v] of cases) expect(priceOf(ctx, a, { tier: t })!.faith, `${a} ${t}`).toBe(v);
    for (const [a, t, v] of [['curse', 'C', 6], ['curse', 'U', 12], ['curse', 'R', 20], ['curse', 'E', 30], ['curse', 'L', 45], ['cursedWeapon', 'C', 9], ['cursedWeapon', 'U', 15], ['cursedWeapon', 'R', 26], ['cursedWeapon', 'E', 42]] as const) {
      const p = priceOf(ctx, a, { tier: t })!;
      expect(p.dread, `${a} ${t}`).toBe(v);
      expect(p.faith).toBeUndefined();
    }
  });

  it('things that are not sold have no price', () => {
    const { ctx } = bare();
    expect(priceOf(ctx, 'skill', { tier: 'L' })).toBeNull();
    expect(priceOf(ctx, 'item', { tier: 'L' })).toBeNull();
    expect(priceOf(ctx, 'holyWeapon', { tier: 'L' })).toBeNull();
    expect(priceOf(ctx, 'cursedWeapon', { tier: 'L' })).toBeNull();
  });

  it('reroll 5 10 20, +5 with a lock, at most three', () => {
    const { ctx } = bare();
    expect([0, 1, 2].map((n) => priceOf(ctx, 'reroll', { n })!.faith)).toEqual([5, 10, 20]);
    expect([0, 1, 2].map((n) => priceOf(ctx, 'reroll', { n, lock: true })!.faith)).toEqual([10, 15, 25]);
    expect(priceOf(ctx, 'reroll', { n: 3 })).toBeNull();
  });

  it('a dream is 10, the second in a year 14, and each dream sent in the life adds 1', () => {
    const { ctx } = bare();
    expect(priceOf(ctx, 'dream', { n: 0 })!.faith).toBe(10);
    expect(priceOf(ctx, 'dream', { n: 0, second: true })!.faith).toBe(14);
    expect(priceOf(ctx, 'dream', { n: 4 })!.faith).toBe(14);
    expect(priceOf(ctx, 'dream', { n: 4, second: true })!.faith).toBe(18);
  });

  it('a whisper is 5 for the four hints and 8 for the five dear ones', () => {
    const { ctx } = bare();
    for (const h of ['ระวัง', 'กล้าเถิด', 'จงไป', 'จงอยู่']) expect(priceOf(ctx, 'whisper', { hint: h })!.faith).toBe(5);
    for (const h of ['จุดอ่อนของศัตรู', 'คนนั้นโกหก', 'ช่วย', 'สางเรื่อง', 'ชี้ทายาท']) expect(priceOf(ctx, 'whisper', { hint: h })!.faith).toBe(8);
  });

  it('revive 60 light or 50 dread; fate 40 light or 30 dread', () => {
    const { ctx } = bare();
    expect(priceOf(ctx, 'revive', { line: 'faith' })!.faith).toBe(60);
    expect(priceOf(ctx, 'revive', { line: 'dread' })!.dread).toBe(50);
    expect(priceOf(ctx, 'fate', { kind: 'good' })!.faith).toBe(40);
    expect(priceOf(ctx, 'fate', { kind: 'bad' })!.dread).toBe(30);
  });

  it('belief below −30 makes light ×1.5; belief above 60 makes dread ×1.2; a window ×0.7 on gifts, dreams and whispers only', () => {
    const { ctx, life } = bare();
    life.godFaith = -31;
    expect(priceOf(ctx, 'bless', { tier: 'C' })!.faith).toBe(15);
    expect(priceOf(ctx, 'dream', { n: 0 })!.faith).toBe(15);
    expect(priceOf(ctx, 'reroll', { n: 0 })!.faith).toBe(8); // 5 × 1.5 rounded
    expect(priceOf(ctx, 'curse', { tier: 'C' })!.dread).toBe(6); // dread is not touched by low belief
    life.godFaith = -30;
    expect(priceOf(ctx, 'bless', { tier: 'C' })!.faith).toBe(10); // "below −30"
    life.godFaith = 61;
    expect(priceOf(ctx, 'curse', { tier: 'R' })!.dread).toBe(24);
    expect(priceOf(ctx, 'bless', { tier: 'R' })!.faith).toBe(26);
    life.godFaith = 60;
    expect(priceOf(ctx, 'curse', { tier: 'R' })!.dread).toBe(20);
    life.godFaith = 0;
    expect(priceOf(ctx, 'bless', { tier: 'U', window: true })!.faith).toBe(11);
    expect(priceOf(ctx, 'dream', { n: 0, window: true })!.faith).toBe(7);
    expect(priceOf(ctx, 'whisper', { hint: 'ระวัง', window: true })!.faith).toBe(4);
    expect(priceOf(ctx, 'reroll', { n: 2, window: true })!.faith).toBe(20);
    expect(priceOf(ctx, 'revive', { line: 'faith', window: true })!.faith).toBe(60);
  });

  it('a weapon of the sage makes one dream or whisper a year free; the free act is used up by pay', () => {
    const { ctx, life } = bare();
    life.items.push('wj_sage_e');
    const p = priceOf(ctx, 'dream', { n: 3 })!;
    expect(p.free).toBe(true);
    expect(p.faith).toBe(0);
    const before = ctx.state.god.light;
    pay(ctx, p, 'dream');
    expect(ctx.state.god.light).toBe(before);
    expect(priceOf(ctx, 'dream', { n: 3 })!.faith).toBe(13);
  });
});

// ---------- G0: income, caps, switching ----------

describe('god G0: income and power (01-power.md §1)', () => {
  it('the base is 1 light and 0.3 dread; the country adds B ÷ 25; belief adds ÷ 30 or ÷ 75; a prophet +4', () => {
    const { ctx, life } = bare();
    ctx.state.world.countryFaith['AL-01'] = 0;
    let i = incomeOf(ctx);
    expect(i.faith).toBeCloseTo(1);
    expect(i.dread).toBeCloseTo(0.3);
    ctx.state.world.countryFaith['AL-01'] = 40;
    life.godFaith = 30;
    i = incomeOf(ctx);
    expect(i.faith).toBeCloseTo(3.6); // the example of the doc: belief 30, channel B 40 ≈ 3.6 a year
    life.godFaith = -75;
    i = incomeOf(ctx);
    expect(i.dread).toBeCloseTo(1.3);
    expect(i.faith).toBeCloseTo(2.6);
    life.godFaith = 100;
    ctx.state.world.countryFaith['AL-01'] = 100;
    expect(incomeOf(ctx).faith).toBeCloseTo(1 + 4 + 100 / 30);
    life.job = 'prophet';
    expect(incomeOf(ctx).faith).toBeCloseTo(1 + 4 + 100 / 30 + 4);
  });

  it('GD-04 makes light ×1.5 for the rest of the life; GD-05 ×0.5 until three prayers are answered', () => {
    const { ctx, life } = bare();
    ctx.state.world.countryFaith['AL-01'] = 0;
    const base = incomeOf(ctx).faith;
    ctx.state.world.happened['GD-04'] = 100;
    expect(incomeOf(ctx).faith).toBeCloseTo(base * 1.5);
    delete ctx.state.world.happened['GD-04'];
    ctx.state.world.happened['GD-05'] = 100;
    expect(incomeOf(ctx).faith).toBeCloseTo(base * 0.5);
    gx(ctx).answered = 3;
    expect(incomeOf(ctx).faith).toBeCloseTo(base);
    life.birthYear = 200; // an event of an earlier life does not count
    gx(ctx).answered = 0;
    expect(incomeOf(ctx).faith).toBeCloseTo(base);
  });

  it('both powers stop at 200 and cannot go below 0', () => {
    const { ctx } = bare();
    const got = earn(ctx, { faith: 500, dread: 150 }, 'test');
    expect(ctx.state.god.light).toBe(200);
    expect(ctx.state.god.dread).toBe(200);
    expect(got.faith).toBe(100);
    expect(canPay(ctx, { faith: 200, dread: 200 })).toBe(true);
    expect(canPay(ctx, { faith: 201 })).toBe(false);
    expect(() => pay(ctx, { faith: 201 }, 'x')).toThrow();
    pay(ctx, { faith: 200 }, 'x');
    expect(ctx.state.god.light).toBe(0);
  });

  it('using the other power inside one life year costs belief −4 a switch, at most −25 in a life', () => {
    const { ctx, life } = bare();
    let last = life.godFaith;
    pay(ctx, { faith: 1 }, 'a');
    expect(life.godFaith).toBe(last);
    for (let i = 0; i < 10; i++) {
      pay(ctx, { dread: 1 }, 'b');
      pay(ctx, { faith: 1 }, 'c');
    }
    expect(life.godFaith).toBe(-25);
    expect(count(ctx, 'l.switch')).toBe(25);
    // the same line twice, or another year, costs nothing
    last = life.godFaith;
    life.hAge += 1;
    pay(ctx, { dread: 1 }, 'd');
    expect(life.godFaith).toBe(last);
  });

  it('the belief changes only through addBelief: halved for a gift to one who does not know the god', () => {
    const { ctx, life } = bare();
    expect(addBelief(ctx, 8, 'gift', { gift: true })).toBe(4);
    life.godFaith = 25;
    expect(addBelief(ctx, 8, 'gift', { gift: true })).toBe(8);
    life.godFaith = 98;
    expect(addBelief(ctx, 8, 'x')).toBe(2);
    expect(life.godFaith).toBe(100);
  });

  it('belief bands give the tags devoted, heretic and godslayer', () => {
    const w = world(3, { years: 3 });
    addBelief(w.ctx, 100, 'test');
    const tags = (c: Ctx) => [...(idxTags(c))];
    expect(tags(w.ctx)).toContain('devoted');
    addBelief(w.ctx, -200, 'test');
    expect(tags(w.ctx)).toContain('heretic');
    expect(tags(w.ctx)).toContain('godslayer');
    expect(tags(w.ctx)).not.toContain('devoted');
    addBelief(w.ctx, 50, 'test');
    expect(tags(w.ctx)).not.toContain('godslayer');
  });
});

function idxTags(ctx: Ctx): Set<string> {
  const e = ctx.state.life!.ext.character as { tags: string[] };
  return new Set(e.tags);
}

describe('god G0: the loop', () => {
  it('start power 30 and 10; income once a life year; half goes to the heir at death', () => {
    const w = world(11);
    expect(w.ctx.state.god.light).toBe(30);
    expect(w.ctx.state.god.dread).toBe(10);
    const g = w.game;
    const l0 = w.ctx.state.god.light;
    while (g.state.life!.hAge < 5) g.beat();
    expect(w.ctx.state.god.light).toBeGreaterThan(l0 + 4);
    const income = g.state.log.filter((e) => e.sys === 'god' && e.kind === 'income');
    expect(income.length).toBe(5);
    expect(income.every((e) => e.level === 0 && typeof e.data.faith === 'number')).toBe(true);
    g.runLife();
    const light = w.ctx.state.god.light;
    // the death hook ran: the power before it is gone by half (the log of the last income says what it was)
    const last = g.state.log.filter((e) => e.sys === 'god' && e.kind === 'income').pop()!;
    expect(light).toBeLessThanOrEqual(Number(last.data.light) * 0.5 + 1);
  });

  it('feelings fade by 2 a year after ten quiet years', () => {
    const w = world(12, { years: 1 });
    w.life.godFaith = 40;
    const g = w.game;
    for (let y = 0; y < 14; y++) {
      const a = w.life.hAge;
      while (w.life.hAge === a && !w.life.dead) g.beat();
    }
    expect(w.life.godFaith).toBeLessThan(40);
    expect(w.life.godFaith).toBeGreaterThanOrEqual(40 - 2 * 5);
  });

  it('the policy of the tools plays the year: silent does nothing, merciful opens chests and sends dreams', () => {
    const silent = world(21, { policy: 'เงียบ' });
    silent.game.runLife();
    expect(silent.ctx.state.god.chronicle.length).toBe(0);
    expect(count(silent.ctx, 'spent.faith')).toBe(0);
    const merciful = world(21, { policy: 'เมตตา' });
    merciful.game.runLife();
    expect(merciful.ctx.state.god.chronicle.length).toBeGreaterThan(3);
    expect(count(merciful.ctx, 'spent.faith')).toBeGreaterThan(20);
  });

  it('the same seed gives the same god log', () => {
    const run = () => {
      const w = world(31, { policy: 'เมตตา' });
      w.game.runLife();
      return JSON.stringify(w.ctx.state.god) + w.ctx.state.log.filter((e) => e.sys === 'god').length;
    };
    expect(run()).toBe(run());
  });
});

// ---------- G1: the chest ----------

/** Checks every rule of §2 on a chest just drawn. */
function checkChest(ctx: Ctx, life: LifeState, ch: Chest): string[] {
  const bad: string[] = [];
  const ix = idx(ctx);
  const ids = ch.slots.filter(Boolean).map((s) => s!.id);
  if (new Set(ids).size !== ids.length) bad.push(`duplicate in chest ${ids.join(' ')}`);
  if (ch.slots.length !== 6) bad.push('not six slots');
  const second = (life.ext.character as { second?: string }).second;
  for (const s of ch.slots) {
    if (!s) continue;
    const here = `${s.slot} ${s.id}`;
    if (s.slot <= 2 && s.kind !== 'bless' && !(s.slot === 5)) bad.push(`${here} slot kind ${s.kind}`);
    if (s.slot === 3 || s.slot === 4) if (s.kind !== 'curse') bad.push(`${here} slot kind ${s.kind}`);
    if (s.kind === 'bless' || s.kind === 'curse') {
      const g: GiftLike | undefined = ix.gifts.get(s.id);
      if (!g) { bad.push(`${here} unknown gift`); continue; }
      if (g.curse !== (s.kind === 'curse')) bad.push(`${here} wrong kind`);
      if ((s.kind === 'curse' ? life.curses : life.blessings).includes(s.id)) bad.push(`${here} already owned`);
      if (g.race && g.race !== life.race && g.race !== second) bad.push(`${here} gift of race ${g.race}`);
      const race = ix.races.get(life.race);
      if ((s.kind === 'curse' ? race?.curseClash : race?.blessClash)?.includes(s.id)) bad.push(`${here} clashes with the race`);
      for (const c of g.fromCond) if (!holds(ctx, c as Condition)) bad.push(`${here} condition fails`);
      if (s.tier === 'L') {
        const ok = ch.window || (s.kind === 'curse' ? life.godFaith <= -30 : life.godFaith >= 50);
        if (!ok) bad.push(`${here} L without the gate`);
      }
      // opposite of what he has
      const tags = g.fx.filter((f) => f.k === 'grant' && f.kind === 'tag').map((f) => (f as { id: string }).id);
      const ownTags = (list: string[]) => list.flatMap((id) => (ix.gifts.get(id)?.fx ?? []).filter((f) => f.k === 'grant' && f.kind === 'tag').map((f) => (f as { id: string }).id));
      if (s.kind === 'bless') for (const t of tags) for (const o of OPPOSITES[t] ?? []) if (ownTags(life.curses).includes(o)) bad.push(`${here} opposite ${o}`);
      if (s.kind === 'curse') for (const t of ownTags(life.blessings)) if ((OPPOSITES[t] ?? []).some((o) => tags.includes(o))) bad.push(`${here} opposite of own ${t}`);
    }
    if (s.kind === 'weapon') {
      const w = (data.weapons.items as { items: { id: string; group: string; rarity: string; type: string }[] }).items.find((x) => x.id === s.id);
      if (!w) bad.push(`${here} unknown weapon`);
      else {
        if (w.group === 'legend' || w.group === 'forge' || w.group === 'continent' || w.group === 'everyday') bad.push(`${here} weapon group ${w.group}`);
        if (w.rarity === 'L' || w.rarity === 'ของใช้') bad.push(`${here} weapon rarity ${w.rarity}`);
      }
      if (life.hAge < 13) bad.push(`${here} weapon for a child`);
      if (count(ctx, 'l.weapon') >= 1) bad.push(`${here} second gifted weapon`);
      if (life.items.includes(s.id)) bad.push(`${here} owned`);
    }
    if (s.kind === 'item') {
      const it = (data.items.items as { items: { id: string; cat: string; tier: string }[] }).items.find((x) => x.id === s.id);
      if (!it) bad.push(`${here} unknown item`);
      else {
        if (!['armor', 'accessory', 'folk', 'consumable', 'tool'].includes(it.cat)) bad.push(`${here} item category ${it.cat}`);
        if (it.tier === 'L') bad.push(`${here} item tier L`);
        if (life.hAge < 13 && it.cat !== 'folk') bad.push(`${here} item for a child ${it.cat}`);
      }
      if (count(ctx, 'l.items') >= 3) bad.push(`${here} fourth gifted item`);
    }
    if (s.kind === 'skill' && s.level && s.level <= 3 && /_[1-3]$/.test(s.id)) {
      const apt = s.id.replace(/_[1-3]$/, '');
      if ((life.aptitudes[apt] ?? 0) !== s.level - 1) bad.push(`${here} skill level jump`);
    }
    const p = priceOf(ctx, s.kind === 'weapon' ? (s.variant === 'holy' ? 'holyWeapon' : 'cursedWeapon') : s.kind, { tier: s.tier, window: ch.window });
    if (!p) bad.push(`${here} has no price`);
    else if ((s.pay === 'faith' ? p.faith : p.dread) !== s.price) bad.push(`${here} price ${s.price}`);
  }
  return bad;
}

/** Opens a chest outside the caps of the year (the caps are tested separately) and closes it again. */
function drawOne(w: World): Chest {
  w.ctx.state.god.chest = null;
  ctxReset(w.ctx);
  return openChest(w.ctx);
}
const ctxReset = (ctx: Ctx) => {
  delete ctx.state.god.counters['y.chest'];
};

describe('god G1: the chest (02-bestow.md)', () => {
  it('10,000 chests hold nothing that breaks a filter: no repeats, no gifts of other peoples, no legends, no talismans, one weapon, three things', () => {
    const bad: string[] = [];
    let n = 0;
    const races = ['human', 'elf', 'darkelf', 'dwarf', 'orc', 'halfling', 'beast', 'naga', 'dragonkin', 'vampire', 'fae', 'slime', 'demonkin', 'merfolk', 'winged', 'giant', 'lavakin', 'construct', 'soulmachine', 'mummy', 'ghoul'];
    for (let k = 0; n < 10000; k++) {
      const w = world(100 + k, { race: races[k % races.length], years: 6 + (k * 7) % 55 });
      if (!w.game.state.life || w.game.state.life.dead) continue;
      // vary the belief so the gates of level L open and shut
      w.life.godFaith = [-60, -35, 0, 20, 55, 90][k % 6];
      for (let j = 0; j < 160; j++) {
        const ch = drawOne(w);
        bad.push(...checkChest(w.ctx, w.life, ch).map((x) => `${w.life.race} ${w.life.hAge}: ${x}`));
        n++;
        // now and then take the thing so the weapon and item caps are met, and curses and blessings pile up
        if (j % 5 === 0) {
          const s = ch.slots.find((x) => x && (x.kind === 'weapon' || x.kind === 'item' || x.kind === 'bless' || x.kind === 'curse'));
          if (s) {
            earn(w.ctx, { faith: 200, dread: 200 }, 'test');
            pickSlot(w.ctx, s.slot);
          }
        }
        if (bad.length > 20) break;
      }
      if (bad.length > 20) break;
    }
    expect(n).toBeGreaterThanOrEqual(10000);
    expect(bad.slice(0, 20)).toEqual([]);
  });

  it('tier shares follow the weights: C 100 · U 38 · R 11 · E 2.6 (L only behind its gate), the compensator trims R', () => {
    const tiers: Record<string, number> = { C: 0, U: 0, R: 0, E: 0, L: 0 };
    let slots = 0;
    for (let k = 0; k < 40; k++) {
      const w = world(500 + k, { years: 20 + (k % 30) });
      if (!w.game.state.life || w.game.state.life.dead) continue;
      w.life.godFaith = 0;
      w.ctx.state.world.era = 1;
      for (let j = 0; j < 100; j++) {
        const ch = drawOne(w);
        for (const s of ch.slots) if (s && (s.slot === 1 || s.slot === 2) && !ch.window) (tiers[s.tier]++, slots++);
      }
    }
    expect(slots).toBeGreaterThan(5000);
    const share = (t: string) => tiers[t] / slots;
    // L is behind its gate at belief 0
    expect(tiers.L).toBe(0);
    // without L the weights give C 66.0 · U 25.1 · R 7.25 · E 1.71 (the doc's 65.7 · 25.0 · 7.2 · 1.7 · 0.33 with L)
    expect(share('U')).toBeGreaterThan(0.2);
    expect(share('U')).toBeLessThan(0.3);
    expect(share('E')).toBeGreaterThan(0.01);
    expect(share('E')).toBeLessThan(0.028);
    // the compensator starts at −5 and rises 2 for each chest without an R: R is below its base on average and above 3%
    expect(share('R')).toBeGreaterThan(0.03);
    expect(share('R')).toBeLessThan(0.0725);
    expect(share('C')).toBeGreaterThan(0.6);
  });

  it('without the compensator the shares are exactly the weights', () => {
    const w = world(1);
    w.ctx.state.world.era = 1;
    const p = tierChances(w.ctx, ['C', 'U', 'R', 'E', 'L'], {});
    expect(p.C * 100).toBeCloseTo(65.7, 0);
    expect(p.U * 100).toBeCloseTo(25.0, 0);
    expect(p.R * 100).toBeCloseTo(7.2, 0);
    expect(p.E * 100).toBeCloseTo(1.7, 0);
    expect(p.L * 100).toBeCloseTo(0.33, 1);
    const c = tierChances(w.ctx, ['C', 'U', 'R', 'E', 'L'], { comp: -5 });
    expect(c.R * 100).toBeCloseTo(2.2, 0);
    expect(c.C * 100).toBeCloseTo(65.7 + 5, 0); // the points come from, and go to, the lowest tier
    const up = tierChances(w.ctx, ['C', 'U', 'R', 'E', 'L'], { comp: 1 });
    expect(up.R * 100).toBeCloseTo(8.2, 0);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('a chest has at most six things and empty slots stay empty', () => {
    const w = world(41, { years: 8 });
    const ch = drawOne(w);
    expect(ch.slots.length).toBe(6);
    expect(ch.slots.filter(Boolean).length).toBeLessThanOrEqual(6);
    // a child has no weapon: slot 6 is a folk charm or empty
    expect(w.life.hAge).toBeLessThan(13);
    expect(ch.slots[5]?.kind === 'weapon').toBe(false);
  });

  it('the compensator rises by 2 a chest without an R and falls back to −5 after one', () => {
    const w = world(42, { years: 25 });
    w.ctx.state.god.counters.comp = -5;
    expect(compOf(w.ctx)).toBe(-5);
    let seen = [compOf(w.ctx)];
    for (let i = 0; i < 40; i++) {
      const ch = drawOne(w);
      const hit = ch.slots.some((s) => s && s.kind !== 'curse' && TIERS.indexOf(s.tier as 'C') >= 2);
      const now = compOf(w.ctx);
      if (hit) expect(now).toBe(-5);
      else expect(now).toBe(Math.min(10, seen[seen.length - 1] + 2));
      seen.push(now);
    }
    expect(Math.max(...seen)).toBeGreaterThan(-5);
  });

  it('opens once a year, a second time in a god window; the child of the year counters is cleared by the next year', () => {
    const w = world(43, { years: 25 });
    const { ctx } = w;
    ctx.state.god.chest = null;
    delete ctx.state.god.counters['y.chest'];
    gx(ctx).window = { age: w.life.hAge, nodes: [], stop: false, played: 0 };
    expect(checkOpen(ctx)).toBeNull();
    openChest(ctx);
    ctx.state.god.chest = null;
    expect(checkOpen(ctx)).toMatch(/เพดาน/);
    gx(ctx).window = { age: w.life.hAge, nodes: ['hu.a1'], stop: false, played: 1 };
    expect(checkOpen(ctx)).toBeNull();
    openChest(ctx);
    expect(checkOpen(ctx)).toMatch(/เปิดอยู่/);
    ctx.state.god.chest = null;
    expect(checkOpen(ctx)).toMatch(/เพดาน/);
  });

  it('pick pays, gives the thing, changes the belief, closes the chest and writes the chronicle', () => {
    const w = world(44, { years: 25 });
    const { ctx, life } = w;
    earn(ctx, { faith: 200, dread: 200 }, 'test');
    life.godFaith = 25; // he knows the god: no halving
    for (let i = 0; i < 30; i++) {
      const ch = drawOne(w);
      const s = ch.slots.find((x) => x && x.kind === 'bless');
      if (!s) continue;
      const light = ctx.state.god.light;
      const belief = life.godFaith;
      const n = ctx.state.god.chronicle.length;
      pickSlot(ctx, s.slot);
      expect(life.blessings).toContain(s.id);
      expect(ctx.state.god.light).toBe(light - s.price);
      expect(life.godFaith).toBeCloseTo(Math.min(100, belief + 5 + 3 * TIERS.indexOf(s.tier as 'C')));
      expect(currentChest(ctx)).toBeNull();
      expect(ctx.state.god.chronicle.length).toBe(n + 1);
      expect(ctx.state.god.chronicle.at(-1)).toMatchObject({ kind: 'chest.pick', id: s.id });
      return;
    }
    throw new Error('no blessing came up in 30 chests');
  });

  it('a curse is paid with dread and costs the belief 4 + 3 × tier; the curse ward turns it back', () => {
    const w = world(45, { years: 25 });
    const { ctx, life } = w;
    earn(ctx, { faith: 200, dread: 200 }, 'test');
    life.godFaith = 25;
    let done = false;
    for (let i = 0; i < 40 && !done; i++) {
      const ch = drawOne(w);
      const s = ch.slots.find((x) => x && x.kind === 'curse');
      if (!s) continue;
      const d = ctx.state.god.dread;
      const b = life.godFaith;
      pickSlot(ctx, s.slot);
      expect(life.curses).toContain(s.id);
      expect(ctx.state.god.dread).toBe(d - s.price);
      expect(life.godFaith).toBeLessThanOrEqual(b - (4 + 3 * TIERS.indexOf(s.tier as 'C')) + 0.001);
      done = true;
    }
    expect(done).toBe(true);
    life.blessings.push('b_curseward');
    life.godFaith = 25;
    done = false;
    for (let i = 0; i < 40 && !done; i++) {
      const ch = drawOne(w);
      const s = ch.slots.find((x) => x && x.kind === 'curse');
      if (!s) continue;
      const before = life.curses.length;
      pickSlot(ctx, s.slot);
      expect(life.curses.length).toBe(before);
      expect(life.godFaith).toBeCloseTo(20);
      done = true;
    }
    expect(done).toBe(true);
  });

  it('reroll: 5 10 20 light, three at most, thrown-away things do not come back, a locked slot stays and costs 5 more', () => {
    const w = world(46, { years: 30 });
    const { ctx } = w;
    earn(ctx, { faith: 200 }, 'test');
    const ch0 = drawOne(w);
    const first = ch0.slots.map((s) => s?.id);
    const light = ctx.state.god.light;
    const ch1 = rerollChest(ctx);
    const second = ch1.slots.map((s) => s?.id);
    expect(ctx.state.god.light).toBe(light - 5);
    for (const s of ch1.slots) if (s) expect(first).not.toContain(s.id);
    const keep = { ...ch1.slots.find(Boolean)! };
    const light2 = ctx.state.god.light;
    const ch2 = rerollChest(ctx, keep.slot);
    expect(ctx.state.god.light).toBe(light2 - 15); // the second reroll is 10, plus 5 for the lock
    expect(ch2.slots[keep.slot - 1]?.id).toBe(keep.id);
    const seen = new Set([...first, ...second]);
    for (const s of ch2.slots) if (s && s.slot !== keep.slot) expect(seen.has(s.id), s.id).toBe(false);
    expect(ch2.locked).toBe(keep.slot);
    rerollChest(ctx);
    expect(priceOf(ctx, 'reroll', { n: ch2.rerolls })).toBeNull();
    expect(command(ctx, { type: 'god', action: 'chest.reroll', args: {}, confirm: true })).toMatchObject({ ok: false });
  });

  it('the commands: check and preview roll nothing and change nothing; open, pick and skip run', () => {
    const w = world(47, { years: 30 });
    const { ctx } = w;
    earn(ctx, { faith: 200, dread: 200 }, 'test');
    delete ctx.state.god.counters['y.chest'];
    gx(ctx).window = null;
    const snap = () => JSON.stringify(ctx.state);
    const before = snap();
    const dry = command(ctx, { type: 'god', action: 'chest.open', args: {}, confirm: false });
    expect(dry).toMatchObject({ ok: true });
    expect(snap()).toBe(before);
    expect(command(ctx, { type: 'god', action: 'chest.pick', args: { slot: 1 }, confirm: true })).toMatchObject({ ok: false });
    const run = command(ctx, { type: 'god', action: 'chest.open', args: {}, confirm: true });
    expect(run).toMatchObject({ ok: true });
    const ch = currentChest(ctx)!;
    expect(ch).toBeTruthy();
    const slot = ch.slots.find((s) => s && s.pay === 'faith')!.slot;
    const mid = snap();
    const prev = command(ctx, { type: 'god', action: 'chest.pick', args: { slot }, confirm: false });
    expect(prev).toMatchObject({ ok: true });
    expect(snap()).toBe(mid);
    expect((prev as { preview: Record<string, unknown> }).preview.price).toBeGreaterThan(0);
    expect(command(ctx, { type: 'god', action: 'chest.pick', args: { slot }, confirm: true })).toMatchObject({ ok: true });
    expect(currentChest(ctx)).toBeNull();
    // a second chest in the same year is refused
    expect(command(ctx, { type: 'god', action: 'chest.open', args: {}, confirm: true })).toMatchObject({ ok: false });
    // skipping closes the chest and counts as the opening of the year
    gx(ctx).window = { age: w.life.hAge, nodes: ['x'], stop: false, played: 1 };
    expect(command(ctx, { type: 'god', action: 'chest.open', args: {}, confirm: true })).toMatchObject({ ok: true });
    expect(command(ctx, { type: 'god', action: 'chest.skip', args: {}, confirm: true })).toMatchObject({ ok: true });
    expect(currentChest(ctx)).toBeNull();
    expect(count(ctx, 'y.chest')).toBe(2);
  });

  it('a weapon is given once in a life, and the god may not give what he cannot pay', () => {
    const w = world(48, { years: 30 });
    const { ctx, life } = w;
    earn(ctx, { faith: 200, dread: 200 }, 'test');
    let gifted = 0;
    for (let i = 0; i < 400 && gifted < 1; i++) {
      const ch = drawOne(w);
      const s = ch.slots.find((x) => x && x.kind === 'weapon');
      if (s) {
        pickSlot(ctx, s.slot);
        gifted++;
      }
    }
    expect(gifted).toBe(1);
    expect(life.items.length).toBeGreaterThan(0);
    for (let i = 0; i < 150; i++) expect(drawOne(w).slots.some((s) => s?.kind === 'weapon')).toBe(false);
    // the third non-weapon item is the last
    for (let i = 0; i < 300 && count(ctx, 'l.items') < 3; i++) {
      const s = drawOne(w).slots.find((x) => x?.kind === 'item');
      if (s) pickSlot(ctx, s.slot);
    }
    expect(count(ctx, 'l.items')).toBe(3);
    for (let i = 0; i < 60; i++) expect(drawOne(w).slots.some((s) => s?.kind === 'item')).toBe(false);
    ctx.state.god.light = 0;
    ctx.state.god.dread = 0;
    const ch = drawOne(w);
    const any = ch.slots.find(Boolean)!;
    expect(command(ctx, { type: 'god', action: 'chest.pick', args: { slot: any.slot }, confirm: true })).toMatchObject({ ok: false });
  });

  it('a window row that names a gift puts it in the chest for sure', () => {
    const w = world(49, { years: 0 });
    const { ctx } = w;
    // hu.b2: "พร `b_courage` หรือคำใบ้ กล้าเถิด"
    const ok = w.life.race === 'human';
    if (!ok) return;
    delete w.life.passed['hu.b2'];
    w.life.blessings = w.life.blessings.filter((b) => b !== 'b_courage');
    gx(ctx).window = { age: w.life.hAge, nodes: ['hu.b2'], stop: false, played: 1 };
    for (let i = 0; i < 20; i++) expect(drawOne(w).slots[0]?.id).toBe('b_courage');
  });
});

// ---------- G2: dreams ----------

function dreamWorld(seed: number, years: number): World {
  let w = world(seed, { years });
  for (let k = 1; offersNow(w.ctx).length === 0 && k < 40; k++) w = world(seed + 1000 * k, { years });
  return w;
}

describe('god G2: dreams (03-dreams.md)', () => {
  it('every way offered is a real way: its node is ahead, its conditions hold, at most three, none from one source more than twice, all different', () => {
    let offers = 0;
    for (let k = 0; k < 60; k++) {
      const w = world(700 + k, { years: 3 + (k * 5) % 60 });
      if (!w.game.state.life || w.game.state.life.dead) continue;
      const ix = w.ctx.state.life!;
      const list = offersNow(w.ctx);
      expect(list.length).toBeLessThanOrEqual(3);
      const keys = list.map((o) => `${o.node}.${o.choice}`);
      expect(new Set(keys).size).toBe(keys.length);
      const bySource: Record<string, number> = {};
      for (const o of list) {
        const src = sourceOf(w.ctx, o);
        bySource[src] = (bySource[src] ?? 0) + 1;
        offers++;
        expect(ix.passed[o.node], `${o.node} already passed`).toBeUndefined();
        expect(o.due).toBeLessThanOrEqual(ix.hAge + 2);
        expect(o.share).toBeGreaterThan(0);
        const n = (data.storylines.items as { nodes: { id: string; when?: Condition; choices: { key: string; when?: Condition; effects: { k: string; to?: string }[] }[] }[] }).nodes.find((x) => x.id === o.node) ??
          (data.convergence.items as { points: { id: string; choices: { key: string; when?: Condition; effects: { k: string; to?: string }[] }[] }[] }).points.find((x) => x.id === o.node);
        expect(n, o.node).toBeTruthy();
        const nw = (n as unknown as { when?: Condition }).when;
        if (nw) expect(holds(w.ctx, nw)).toBe(true);
        const c = n!.choices.find((x) => x.key === o.choice)!;
        expect(c).toBeTruthy();
        if (c.when) expect(holds(w.ctx, c.when)).toBe(true);
        expect(Object.values(bySource).every((v) => v <= 2)).toBe(true);
      }
    }
    expect(offers).toBeGreaterThan(40);
  });

  it('the first way is the one he would most likely take at the soonest node; a second node-mate goes against his nature', () => {
    const w = dreamWorld(5, 4);
    const list = offersNow(w.ctx);
    const all = pathsNow(w.ctx);
    const first = list[0];
    const best = all.filter((p) => p.node === first.node).sort((a, b) => b.share - a.share)[0];
    expect(first.choice).toBe(best.choice);
    if (list.length > 1) expect(list[1].fit).toBeLessThanOrEqual(first.fit);
  });

  it('the chance to obey: 0.30 + belief ÷ 140 + fit + clarity, between 0.05 and 0.95, and the level is the chance', () => {
    const w = dreamWorld(6, 4);
    const way = { node: 'x.y', choice: 'a' as const, fit: 0, immoral: false };
    w.life.stats.int = 10;
    w.life.godFaith = 0;
    gx(w.ctx).history = [];
    gx(w.ctx).punishedAge = null;
    expect(obeyChance(w.ctx, way).p).toBeCloseTo(0.3);
    w.life.godFaith = 70;
    expect(obeyChance(w.ctx, way).p).toBeCloseTo(0.8);
    expect(obeyChance(w.ctx, way).level).toBe('เต็มใจ');
    expect(obeyChance(w.ctx, { ...way, fit: 2 }).p).toBeCloseTo(0.95);
    expect(obeyChance(w.ctx, { ...way, fit: 1 }).p).toBeCloseTo(0.85);
    expect(obeyChance(w.ctx, { ...way, fit: -1 }).p).toBeCloseTo(0.6);
    expect(obeyChance(w.ctx, { ...way, fit: -1 }).level).toBe('ลังเล');
    expect(obeyChance(w.ctx, { ...way, immoral: true }).p).toBeCloseTo(0.5);
    w.life.godFaith = -100;
    expect(obeyChance(w.ctx, { ...way, immoral: true }).p).toBe(0.05);
    expect(obeyChance(w.ctx, { ...way, immoral: true }).level).toBe('ขัดขืน');
    w.life.godFaith = 0;
    w.life.stats.int = 15;
    expect(obeyChance(w.ctx, way).p).toBeCloseTo(0.4);
    w.life.skills.push('u_oracle');
    expect(obeyChance(w.ctx, way).p).toBeCloseTo(0.5);
    w.life.blessings.push('nb_god_whisper');
    expect(obeyChance(w.ctx, way).p).toBeCloseTo(0.7);
    gx(w.ctx).punishedAge = w.life.hAge - 2;
    expect(obeyChance(w.ctx, way).p).toBeCloseTo(0.6);
    gx(w.ctx).punishedAge = w.life.hAge - 5;
    expect(obeyChance(w.ctx, way).p).toBeCloseTo(0.7);
    gx(w.ctx).history = [{ age: w.life.hAge - 2, node: 'x.y', choice: 'a' }];
    expect(obeyChance(w.ctx, way).p).toBeCloseTo(0.8);
    gx(w.ctx).history = [{ age: w.life.hAge - 4, node: 'x.y', choice: 'a' }];
    expect(obeyChance(w.ctx, way).p).toBeCloseTo(0.7);
  });

  it('after two willing dreams that were not obeyed, the next willing one gets +0.15 and says so', () => {
    const w = dreamWorld(7, 4);
    const way = { node: 'x.y', choice: 'a' as const, fit: 1, immoral: false };
    w.life.godFaith = 60;
    w.life.stats.int = 10;
    gx(w.ctx).history = [];
    gx(w.ctx).punishedAge = null;
    const p0 = obeyChance(w.ctx, way).p;
    expect(p0).toBeGreaterThanOrEqual(0.7);
    gx(w.ctx).willFails = 2;
    const g = obeyChance(w.ctx, way);
    expect(g.p).toBeCloseTo(Math.min(0.95, p0 + 0.15));
    expect(g.parts.guard).toBeGreaterThan(0);
    // a level below willing is not helped
    w.life.godFaith = 0;
    expect(obeyChance(w.ctx, { ...way, fit: 0 }).parts.guard).toBe(0);
  });

  it('the level shown is the chance the dice will use', () => {
    const w = dreamWorld(8, 4);
    const o = offersNow(w.ctx)[0];
    w.ctx.state.god.light = 200;
    const cmd = { type: 'god', action: 'dream.send', args: { node: o.node, choice: o.choice }, confirm: false } as const;
    const r = command(w.ctx, cmd) as unknown as { ok: true; preview: { level: string; reasons: string[] } };
    expect(r.ok).toBe(true);
    expect(r.preview.level).toBe(obeyChance(w.ctx, o).level);
    expect(r.preview.reasons.length).toBeGreaterThan(0);
    expect(r.preview.reasons.length).toBeLessThanOrEqual(2);
  });

  it('check and preview roll nothing; sending pays 10, then 14 in the same year, +1 for each dream of the life; two a year at most', () => {
    const w = dreamWorld(9, 4);
    const { ctx } = w;
    ctx.state.god.light = 200;
    const rngBefore = JSON.stringify(ctx.state.rng);
    const o = offersNow(ctx)[0];
    const dry = command(ctx, { type: 'god', action: 'dream.send', args: { node: o.node, choice: o.choice }, confirm: false });
    expect(dry).toMatchObject({ ok: true });
    expect(JSON.stringify(ctx.state.rng)).toBe(rngBefore);
    expect(dreamsOf(ctx).length).toBe(0);
    delete ctx.state.god.counters['y.dream'];
    const l0 = ctx.state.god.light;
    const first = o.window || false ? 7 : 10;
    expect(command(ctx, { type: 'god', action: 'dream.send', args: { node: o.node, choice: o.choice }, confirm: true })).toMatchObject({ ok: true });
    expect(l0 - ctx.state.god.light).toBe(first);
    expect(dreamsOf(ctx).length).toBe(1);
    // the same node cannot be dreamed twice
    expect(command(ctx, { type: 'god', action: 'dream.send', args: { node: o.node, choice: o.choice }, confirm: true })).toMatchObject({ ok: false });
    const o2 = offersNow(ctx)[0];
    if (o2) {
      const l1 = ctx.state.god.light;
      expect(command(ctx, { type: 'god', action: 'dream.send', args: { node: o2.node, choice: o2.choice }, confirm: true })).toMatchObject({ ok: true });
      expect(l1 - ctx.state.god.light).toBe(Math.round((14 + 1) * (o2.window ? 0.7 : 1)));
      const o3 = offersNow(ctx)[0];
      if (o3) expect(checkDream(ctx, o3)).toMatch(/เพดาน/);
    }
  });

  it('at most three dreams wait at once, and the chronicle keeps each', () => {
    const w = dreamWorld(10, 4);
    const { ctx } = w;
    ctx.state.god.light = 200;
    let sent = 0;
    for (let i = 0; i < 6; i++) {
      delete ctx.state.god.counters['y.dream'];
      const o = offersNow(ctx)[0];
      if (!o || checkDream(ctx, o)) break;
      command(ctx, { type: 'god', action: 'dream.send', args: { node: o.node, choice: o.choice }, confirm: true });
      sent++;
    }
    expect(dreamsOf(ctx).length).toBeLessThanOrEqual(3);
    expect(ctx.state.god.chronicle.filter((c) => c.kind === 'dream').length).toBe(sent);
  });

  function sendOne(w: World): { node: string; choice: 'a' | 'b' | 'c' } {
    const { ctx } = w;
    ctx.state.god.light = 200;
    delete ctx.state.god.counters['y.dream'];
    const o = offersNow(ctx)[0];
    command(ctx, { type: 'god', action: 'dream.send', args: { node: o.node, choice: o.choice }, confirm: true });
    return o;
  }

  /** The weights a dream gives the three ways of its node: from the story's pulls when the dream is armed already, else from `dreamWeight`. */
  function weightsOf(w: World, node: string): number[] {
    const d = dreamsOf(w.ctx).find((x) => x.node === node)!;
    if (d.applied) {
      const mods = (w.life.ext.story as { entryMods: { to: string; choice: string; mul: number }[] }).entryMods.filter((m) => m.to === node);
      return ['a', 'b', 'c'].map((k) => mods.filter((m) => m.choice === k).reduce((a, m) => a * m.mul, 1));
    }
    return ['a', 'b', 'c'].map((k) => dreamWeight(w.ctx, node, k));
  }

  it('the four results: obey +3 and the way ×4 · misread +1 and a near way ×2 · refuse −2 · defy (belief −30 or less) the way ×0.3', () => {
    const tally: Record<string, number> = { obey: 0, misread: 0, refuse: 0, defy: 0 };
    let armed = 0;
    for (let k = 0; k < 120; k++) {
      const w = dreamWorld(900 + k, 4);
      const { ctx, life } = w;
      life.godFaith = [60, 0, -10, -50][k % 4];
      const o = sendOne(w);
      const d = dreamsOf(ctx)[0];
      // a dream whose node is near is rolled at once (and its weights are in the story's pulls); the others when the story asks
      if (d.applied) armed++;
      const b = d.applied ? life.godFaith : life.godFaith;
      void b;
      const before = d.applied ? undefined : life.godFaith;
      const weights = weightsOf(w, o.node);
      expect(d.resolved).toBeTruthy();
      const r = d.resolved!;
      tally[r.outcome]++;
      const ci = ['a', 'b', 'c'].indexOf(o.choice);
      if (r.outcome === 'obey') {
        expect(weights[ci]).toBe(4);
        expect(weights.filter((x) => x === 1).length).toBe(2);
      } else if (r.outcome === 'misread') {
        expect(life.godFaith).toBeGreaterThanOrEqual(-5);
        expect(r.alt).toBeTruthy();
        expect(r.alt).not.toBe(o.choice);
        expect(weights[['a', 'b', 'c'].indexOf(r.alt!)]).toBe(2);
        expect(weights[ci]).toBe(1);
      } else if (r.outcome === 'refuse') {
        expect(weights).toEqual([1, 1, 1]);
      } else {
        expect(weights[ci]).toBe(0.3);
      }
      void before;
      // asking again does not roll again
      expect(weightsOf(w, o.node)).toEqual(weights);
    }
    expect(armed).toBeGreaterThan(0);
    expect(tally.obey).toBeGreaterThan(10);
    expect(tally.refuse + tally.defy).toBeGreaterThan(10);
    expect(tally.misread).toBeGreaterThan(0);
    expect(tally.defy).toBeGreaterThan(0);
  });

  it('the belief moves with the result: obey +3 · misread +1 · refuse or defy −2', () => {
    const seen = new Set<string>();
    for (let k = 0; k < 200 && seen.size < 4; k++) {
      const w = dreamWorld(2000 + k, 4);
      const { ctx, life } = w;
      sendOne(w);
      const d = dreamsOf(ctx)[0];
      if (d.applied || d.resolved) continue; // rolled by the arming already
      life.godFaith = [60, 0, -10, -50][k % 4];
      const b = life.godFaith;
      resolveDream(ctx, d, false);
      const r = d.resolved!;
      seen.add(r.outcome);
      expect(life.godFaith - b).toBeCloseTo({ obey: 3, misread: 1, refuse: -2, defy: -2 }[r.outcome]);
      if (r.outcome === 'defy') expect(b).toBeLessThanOrEqual(-30);
      if (r.outcome === 'misread') expect(b).toBeGreaterThanOrEqual(0);
    }
    expect([...seen].sort()).toEqual(['defy', 'misread', 'obey', 'refuse']);
  });

  it('the story reads the dream: a dream whose node is near puts its weights into the story pulls, and they are gone once the node has passed', () => {
    let done = 0;
    for (let k = 0; k < 80 && done < 4; k++) {
      const w = dreamWorld(3000 + k, 6);
      const { ctx, life } = w;
      life.godFaith = 100;
      sendOne(w);
      const d = dreamsOf(ctx)[0];
      if (!d.applied) continue;
      const mods = (life.ext.story as { entryMods: { to: string }[] }).entryMods;
      expect(mods.filter((m) => m.to === d.node).length).toBeGreaterThanOrEqual(d.resolved!.outcome === 'refuse' ? 0 : 1);
      life.passed[d.node] = 'a';
      settleDreams(ctx);
      expect((life.ext.story as { entryMods: { to: string }[] }).entryMods.some((m) => m.to === d.node)).toBe(false);
      expect(dreamsOf(ctx).length).toBe(0);
      done++;
    }
    expect(done).toBeGreaterThanOrEqual(2);
  });

  it('the dreamed way is taken far more often when the dream is obeyed (the story takes it into account)', () => {
    let obeyed = 0;
    let took = 0;
    let base = 0;
    for (let k = 0; k < 120; k++) {
      const w = world(4000 + k, { policy: 'เมตตา' });
      w.game.runLife();
      const log = w.ctx.state.log.filter((e) => e.sys === 'god' && e.kind === 'dream');
      const sent: Record<string, string> = {};
      for (const e of log) if (e.data.choice) sent[String(e.id)] = String(e.data.choice);
      for (const e of log) {
        if (e.data.outcome !== 'obey') continue;
        const choice = sent[String(e.id)];
        const got = w.life.passed[String(e.id)];
        if (!choice || got === undefined) continue;
        obeyed++;
        if (got === choice) took++;
        const nodes = (data.storylines.items as { nodes: { id: string; choices: { key: string; weight: number }[] }[] }).nodes.find((n) => n.id === e.id);
        const ws = nodes?.choices.find((c) => c.key === choice)?.weight ?? 0;
        base += ws / ((nodes?.choices ?? []).reduce((a, c) => a + c.weight, 0) || 1);
      }
    }
    expect(obeyed).toBeGreaterThan(80);
    // the written weights alone would give him the dreamed way about 40% of the time; ×4 makes it about 70%
    expect(took / obeyed).toBeGreaterThan(base / obeyed + 0.15);
    expect(took / obeyed).toBeGreaterThan(0.55);
  });

  it('the level of a dream is honest: over many lives the willing obey as often as the chance says, and a hesitant dream less often', () => {
    const by: Record<string, { n: number; obeyed: number; p: number }> = {};
    for (let k = 0; k < 150; k++) {
      const w = world(5000 + k, { policy: k % 2 ? 'เมตตา' : 'สุ่ม' });
      w.game.runLife();
      for (const e of w.ctx.state.log) {
        if (e.sys !== 'god' || e.kind !== 'dream' || e.data.outcome === undefined || e.data.outcome === 'fade') continue;
        const lv = String(e.data.level);
        const row = (by[lv] ??= { n: 0, obeyed: 0, p: 0 });
        row.n++;
        row.p += Number(e.data.p);
        if (e.data.outcome === 'obey') row.obeyed++;
      }
    }
    expect(by['เต็มใจ'].n).toBeGreaterThan(100);
    expect(by['ลังเล'].n).toBeGreaterThan(100);
    for (const row of Object.values(by)) if (row.n > 100) expect(Math.abs(row.obeyed / row.n - row.p / row.n)).toBeLessThan(0.07);
    expect(by['เต็มใจ'].p / by['เต็มใจ'].n).toBeGreaterThanOrEqual(0.7);
    expect(by['ลังเล'].p / by['ลังเล'].n).toBeLessThan(0.7);
    expect(by['เต็มใจ'].obeyed / by['เต็มใจ'].n).toBeGreaterThan(by['ลังเล'].obeyed / by['ลังเล'].n);
  });

  it('an heir starts with half of the power and 60% of the belief; the counters of a life start again', () => {
    const w = world(81, { policy: 'เมตตา' });
    w.game.runLife();
    const { ctx } = w;
    const belief = w.life.godFaith;
    expect(gx(ctx).heirBelief).toBeCloseTo(belief * 0.6, 1);
    expect(count(ctx, 'l.dream')).toBeGreaterThan(0);
    // the next life: the character system places another life, the loop runs the birth hooks
    ctx.state.life = { ...w.life, id: 'L2', hAge: 0, godFaith: 0, dead: undefined, passed: {}, pending: [], ext: {}, items: [], blessings: [], curses: [] } as LifeState;
    w.game.born();
    expect(ctx.state.life!.godFaith).toBeCloseTo(belief * 0.6, 1);
    expect(count(ctx, 'l.dream')).toBe(0);
    expect(count(ctx, 'l.pick')).toBe(0);
    expect(ctx.state.god.dreams.length).toBe(0);
    expect(gx(ctx).heirBelief).toBeUndefined();
  });

  it('a node with no dream keeps its weights', () => {
    const w = dreamWorld(11, 4);
    expect(dreamWeight(w.ctx, 'hu.t1', 'a')).toBe(1);
    expect(dreamWeight(w.ctx, 'nowhere', 'a')).toBe(1);
  });

  it('an obeyed dream against his nature adds 1 to the heart; at 2 a burden event happens and the heart starts again', () => {
    let events = 0;
    let checked = 0;
    for (let k = 0; k < 150 && checked < 6; k++) {
      const w = dreamWorld(1200 + k, 4);
      const { ctx, life } = w;
      const o = sendOne(w);
      const d = dreamsOf(ctx)[0];
      d.fit = -1;
      life.godFaith = 100;
      life.stats.int = 20;
      life.heart = 1;
      resolveDream(ctx, d, false);
      if (d.resolved!.outcome !== 'obey') continue;
      checked++;
      expect(life.heart).toBe(0);
      expect(ctx.state.log.filter((e) => e.sys === 'god' && e.kind === 'burden').length).toBeGreaterThanOrEqual(1);
      events++;
      void o;
    }
    expect(events).toBeGreaterThanOrEqual(4);
    // one against dream: the heart goes to 1 and nothing happens
    const w = dreamWorld(77, 4);
    sendOne(w);
    const d = dreamsOf(w.ctx)[0];
    d.fit = -1;
    w.life.godFaith = 100;
    w.life.stats.int = 20;
    w.life.heart = 0;
    for (let i = 0; i < 20 && d.resolved?.outcome !== 'obey'; i++) {
      delete d.resolved;
      w.life.heart = 0;
      resolveDream(w.ctx, d, false);
    }
    expect(w.life.heart).toBe(1);
    // a dream that fits him does not ease the heart (03-dreams.md §4: relief 0)
    const f = dreamWorld(78, 4);
    sendOne(f);
    const e = dreamsOf(f.ctx)[0];
    e.fit = 1;
    f.life.godFaith = 100;
    f.life.heart = 1;
    f.life.stats.int = 20;
    for (let i = 0; i < 20 && e.resolved?.outcome !== 'obey'; i++) {
      delete e.resolved;
      resolveDream(f.ctx, e, false);
    }
    expect(f.life.heart).toBe(1);
  });

  it('a dream the story never asked about is settled when its node has passed; one that waited three years fades without a cost', () => {
    const w = dreamWorld(13, 4);
    const { ctx, life, game } = w;
    const o = sendOne(w);
    const belief = life.godFaith;
    life.passed[o.node] = 'a';
    settleDreams(ctx);
    expect(dreamsOf(ctx).length).toBe(0);
    expect(ctx.state.god.chronicle.at(-1)).toMatchObject({ kind: 'dream', id: o.node });
    expect(ctx.state.god.chronicle.at(-1)!.result).not.toBe('faded');
    expect(life.godFaith).not.toBe(belief - 99);
    // a dream whose node never comes
    const w2 = dreamWorld(14, 4);
    const o2 = sendOne(w2);
    const b2 = w2.life.godFaith;
    w2.life.hAge += 3;
    settleDreams(w2.ctx);
    expect(dreamsOf(w2.ctx).length).toBe(0);
    expect(w2.life.godFaith).toBe(b2);
    expect(w2.ctx.state.god.chronicle.at(-1)).toMatchObject({ id: o2.node, result: 'faded' });
    void game;
  });

  it('a question asked by the burden costs −8 at the end of the year unless the god answers (then +12 instead)', () => {
    const w = dreamWorld(15, 4);
    const { ctx, life } = w;
    life.godFaith = 0;
    gx(ctx).questions = [{ age: life.hAge }];
    settleDreams(ctx);
    expect(life.godFaith).toBe(0); // the year is not over
    life.hAge += 1;
    settleDreams(ctx);
    expect(life.godFaith).toBe(-8);
    gx(ctx).questions = [{ age: life.hAge }];
    ctx.state.god.light = 50;
    expect(command(ctx, { type: 'god', action: 'dream.send', args: {}, confirm: false })).toMatchObject({ ok: false });
  });
});

describe('god: the numbers are plain data', () => {
  it('the state of a life with the god system is plain JSON', () => {
    const w = world(61, { policy: 'เมตตา' });
    w.game.runLife();
    const s = JSON.stringify(w.ctx.state);
    expect(JSON.parse(s)).toEqual(JSON.parse(JSON.stringify(JSON.parse(s))));
    expect(s).not.toMatch(/undefined|NaN|Infinity/);
    for (const k of ['light', 'dread'] as const) expect(Number.isFinite(w.ctx.state.god[k])).toBe(true);
    void bump;
  });
});
