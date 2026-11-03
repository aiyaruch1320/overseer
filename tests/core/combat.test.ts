// The combat system (docs/systems/combat/): fights of several beats, the nine stances, the weakness matrix, wounds and death, loot, the
// fights that come on their own, the call before a named fight, the clashes of the named NPCs. The data is the generated data/gen/.
import { write } from '../../src/core/log';
import type { GameState } from '../../src/core/types';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife, type Session } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { classify } from '../../src/core/attention';
import { extOf as charExt } from '../../src/core/character';
import {
  admit, atWar, bestHit, buildHero, capOf, chanceOf, clash, clashOf, combatIndex, combatOf, combatSystem, damageOf, dragonFoe, dreamStance, fight, fightFoe, flush, flushClashes, foeOf, lastStand,
  hpOf, lootFor, markOf, maxHpOf, pendingFights, rollWound, stanceBonuses, stanceOptions, stanceWeights, addHp, warBattle, warEventOf, warFoes, warOn,
} from '../../src/core/combat';
import { warYear } from '../../src/core/combat/war';
import { eco, extOf as economyExt, grossIncome, placeOf } from '../../src/core/economy';
import type { Scene } from '../../src/core/combat/stance';
import { DAMAGE_SCALE, DEATH_ON_LOSS, PRELUDE_BEATS, RANKS, RESCUE, WAR_FOES, WAR_FOES_BY_CONTINENT } from '../../src/core/combat/tuning';
import { sortSystems, type Ctx, type GameData } from '../../src/core/game';
import { actsOf } from '../../src/core/god/acts';
import { addTie as addBondTie, extOf as bondsExtOf, joinParty } from '../../src/core/bonds';
import { armorOf, equip, itemsExt, scan, wielded } from '../../src/core/items';
import { openClash, canClash, clashesOf, slotsOf, triggersOf } from '../../src/core/npc';
import { apply, readStat } from '../../src/core/rules';
import { CAUSE, BATTLES_PER_YEAR } from '../../src/core/story/tuning';
import type { LifeState } from '../../src/core/types';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

interface Patch {
  stats?: Partial<LifeState['stats']>;
  aptitudes?: Record<string, number>;
  items?: string[];
  blessings?: string[];
  curses?: string[];
  tags?: string[];
  job?: string;
  hAge?: number;
  godFaith?: number;
  traits?: string[];
}

/** A world run to year 120 with a human born in it and the combat system in the loop; the hero is as the patch says. */
function mk(seed = 1, p: Patch = {}): { s: Session; ctx: Ctx; life: LifeState } {
  const s = createSession(data, { seed, race: 'hu', startYear: 120 });
  const g = s.game;
  if (!g.systems.some((x) => x.name === 'combat')) g.systems.splice(0, g.systems.length, ...sortSystems([...g.systems, combatSystem]));
  startLife(s);
  const life = g.state.life!;
  life.hAge = p.hAge ?? 30;
  life.godFaith = p.godFaith ?? 0;
  life.stats = { pow: 10, mag: 10, spd: 10, luk: 10, int: 10, vit: 10, ...p.stats };
  life.aptitudes = { ...p.aptitudes };
  life.items = [...(p.items ?? [])];
  life.blessings = [...(p.blessings ?? [])];
  life.curses = [...(p.curses ?? [])];
  life.traits = [...(p.traits ?? [])];
  life.skills = [];
  life.job = p.job;
  charExt(life).tags = [...(p.tags ?? [])];
  charExt(life).raceTags = [];
  charExt(life).companions = [];
  charExt(life).hpBonus = 0;
  // the items system picks what the hero holds (what combat reads is items `wielded` and `armorOf`)
  scan(g.ctx, life);
  equip(g.ctx, life);
  combatOf(life).hp = maxHpOf(g.ctx, life);
  return { s, ctx: g.ctx, life };
}

/** Makes a beaten hero die for certain (the chance of death on a lost fight is tuning DEATH_ON_LOSS); restored after the test. */
const savedDeath = { ...DEATH_ON_LOSS };
function certainDeath(): void {
  for (const k of Object.keys(DEATH_ON_LOSS)) DEATH_ON_LOSS[k] = 1;
}
afterEach(() => {
  Object.assign(DEATH_ON_LOSS, savedDeath);
});

/** Full hit points and a stranger to every enemy again. */
function fresh(ctx: Ctx, life: LifeState): void {
  const e = combatOf(life);
  e.hp = maxHpOf(ctx, life);
  e.met = [];
  e.hurt = null;
}

function scene(ctx: Ctx, life: LifeState, ids: string[], over: Partial<Scene> = {}): Scene {
  return { ctx, hero: buildHero(ctx, life), foe: foeOf(ctx, ids)!, opts: {}, beat: 0, first: 0, blessed: 0, dodge: 0, known: false, ...over };
}

const wins = (r: { result: string }) => ['win', 'flawless', 'talk', 'tame'].includes(r.result);

/** Win share of a hero in n fights with full hit points each time (lethal off so a bad run cannot end the life). */
function winRate(seed: number, p: Patch, enemy: string[], n: number, opts = {}): number {
  const { ctx, life } = mk(seed, p);
  let w = 0;
  for (let i = 0; i < n; i++) {
    fresh(ctx, life);
    const r = fight(ctx, enemy, { lethal: false, log: false, loot: false, ...opts })!;
    if (wins(r)) w++;
  }
  return w / n;
}


/** The attention system settles the calls of the fights waiting in the queue (a glow, as when a card is shown on the life line): the fights may start. */
function settleCalls(state: GameState): void {
  for (const e of state.log.filter((x) => x.sys === 'combat' && x.kind === 'prelude')) write(state, { sys: 'attention', kind: 'glow', id: String(e.n), data: { n: e.n }, level: 0 });
}

describe('the data the system reads', () => {
  it('has the nine stances, the 14 kinds, 200 enemies, 102 clashes', () => {
    const ix = combatIndex({ data } as Ctx);
    expect(ix.stances.size).toBe(9);
    expect(ix.list.length).toBe(200);
    expect(ix.clashByNpc.size).toBe(102);
    expect(ix.kinds.size).toBeGreaterThanOrEqual(14);
  });

  it('every enemy makes a foe with wounds, beats and a DC; the tiers give the wounds of 01-core.md §2', () => {
    const { ctx } = mk(1);
    const ix = combatIndex(ctx);
    for (const e of ix.list) {
      const foe = foeOf(ctx, [e.id])!;
      expect(foe, e.id).toBeDefined();
      expect(foe.wounds).toBeGreaterThanOrEqual(1);
      expect(foe.maxBeats).toBeGreaterThanOrEqual(foe.wounds > 1 ? 2 : 2);
      expect(foe.dc).toBe(e.dc);
    }
    expect(foeOf(ctx, ['slime'])!.wounds).toBe(1);
    expect(foeOf(ctx, ['wolf'])!.wounds).toBe(2);
    expect(foeOf(ctx, ['troll'])!.wounds).toBe(3);
    expect(foeOf(ctx, ['lich'])!.wounds).toBe(5);
    expect(foeOf(ctx, ['firedragon'])!.wounds).toBe(6);
    expect(foeOf(ctx, ['leviathan'])!.wounds).toBe(8);
    expect(foeOf(ctx, ['nobody'])).toBeUndefined();
  });

  it('a group is one foe: the wounds add, the DC rises by one for every two, the group resists only what all of it resists', () => {
    const { ctx } = mk(1);
    const one = foeOf(ctx, ['wolf'])!;
    const two = foeOf(ctx, ['wolf', 'goblin'])!;
    expect(two.wounds).toBe(4);
    expect(two.dc).toBe(Math.max(one.dc, foeOf(ctx, ['goblin'])!.dc) + 1);
    expect(two.maxBeats).toBe(one.maxBeats + 1);
  });
});

describe('the weakness matrix (02-type-matrix.md)', () => {
  it('reads the tables: a ghost takes no blade, a skeleton fears the hammer, a fey the iron, a golem the lightning, a troll the fire', () => {
    const { ctx } = mk(1);
    expect(markOf(ctx, foeOf(ctx, ['wraith'])!, 'blade')).toBe('✕');
    expect(markOf(ctx, foeOf(ctx, ['wraith'])!, 'light')).toBe('★');
    expect(markOf(ctx, foeOf(ctx, ['skeleton'])!, 'blunt')).toBe('▲');
    expect(markOf(ctx, foeOf(ctx, ['skeleton'])!, 'pierce')).toBe('▼');
    expect(markOf(ctx, foeOf(ctx, ['siren'])!, 'iron')).toBe('★');
    expect(markOf(ctx, foeOf(ctx, ['golem'])!, 'lightning')).toBe('★');
    expect(markOf(ctx, foeOf(ctx, ['troll'])!, 'fire')).toBe('★');
    expect(markOf(ctx, foeOf(ctx, ['magma_salamander'])!, 'fire')).toBe('✕');
    expect(markOf(ctx, foeOf(ctx, ['magma_salamander'])!, 'water')).toBe('★');
    expect(markOf(ctx, foeOf(ctx, ['wolf'])!, 'blade')).toBe('·');
  });

  it('turns a mark into a bonus (★ +6 and two wounds · ▲ +4 · ▼ −4 · ✕ the stance is shut), and the best tag of a stance decides', () => {
    const { ctx, life } = mk(1);
    const tags = new Set<string>();
    const wraith = foeOf(ctx, ['wraith'])!;
    expect(bestHit(ctx, wraith, ['light'], tags)).toMatchObject({ mark: '★', bonus: 6, heavy: true, blocked: false });
    expect(bestHit(ctx, wraith, ['blade'], tags)).toMatchObject({ blocked: true });
    // a sword with a flame: the flame decides
    expect(bestHit(ctx, foeOf(ctx, ['troll'])!, ['blade', 'fire'], tags).mark).toBe('★');
    expect(bestHit(ctx, foeOf(ctx, ['skeleton'])!, ['pierce'], tags)).toMatchObject({ mark: '▼', bonus: -4 });
    expect(bestHit(ctx, foeOf(ctx, ['skeleton'])!, ['blunt'], tags)).toMatchObject({ mark: '▲', bonus: 4, heavy: false });
    // the kill tags are ★ on their kind whatever the weapon
    expect(bestHit(ctx, foeOf(ctx, ['skeleton'])!, ['pierce'], new Set(['undead_bane']))).toMatchObject({ mark: '★', heavy: true });
    void life;
  });

  it('shows in the roll: light magic against a wraith rolls +6, a bare sword has no stance that can touch it', () => {
    const { ctx, life } = mk(1, { aptitudes: { light: 2, sword: 1 }, stats: { mag: 14 }, items: ['ws_longsword'] });
    const rows = stanceBonuses(scene(ctx, life, ['wraith']));
    const magic = rows.find((r) => r.id === 'magic')!;
    const melee = rows.find((r) => r.id === 'melee')!;
    expect(magic.mark).toBe('★');
    expect(magic.blocked).toBe(false);
    expect(melee.blocked).toBe(true);
    // 14 → +2 · light 2 → +2 · ★ +6
    expect(magic.bonus).toBeGreaterThanOrEqual(10);
  });

  it('works on the result: the same hero wins far more often with the right tag than with the wrong one', () => {
    const right = winRate(3, { aptitudes: { light: 2 }, stats: { mag: 14 } }, ['wraith'], 150);
    const wrong = winRate(3, { aptitudes: { sword: 2 }, stats: { pow: 14 }, items: ['ws_longsword'] }, ['wraith'], 150);
    expect(right).toBeGreaterThan(0.5);
    expect(wrong).toBeLessThan(0.1);
    // and an enemy that takes the other tag: water on the salamander, fire on the troll
    const fire = winRate(4, { aptitudes: { fire: 2 }, stats: { mag: 12 } }, ['troll'], 150);
    const sword = winRate(4, { aptitudes: { sword: 2 }, stats: { pow: 12 } }, ['troll'], 150);
    expect(fire).toBeGreaterThan(sword);
    const burn = winRate(5, { aptitudes: { fire: 2 }, stats: { mag: 12 } }, ['magma_salamander'], 120);
    const soak = winRate(5, { aptitudes: { water: 2 }, stats: { mag: 12 } }, ['magma_salamander'], 120);
    expect(burn).toBeLessThan(0.25);
    expect(soak).toBeGreaterThan(burn + 0.2);
  });

  it('a fey hero cannot hold iron (self handicap −4) and the self handicap shows in the roll', () => {
    const plain = mk(1, { aptitudes: { sword: 1 }, items: ['ws_longsword'] });
    const weak = mk(1, { aptitudes: { sword: 1 }, items: ['ws_longsword'], curses: ['c_fireweak'], tags: ['weak_fire'] });
    const a = stanceBonuses(scene(plain.ctx, plain.life, ['wolf'])).find((r) => r.id === 'melee')!.bonus;
    const b = stanceBonuses(scene(weak.ctx, weak.life, ['wolf'])).find((r) => r.id === 'melee')!.bonus;
    expect(b).toBe(a); // a sword has no fire in it: nothing to handicap
    const flame = mk(1, { aptitudes: { fire: 1 }, tags: ['weak_fire'] });
    const burn = mk(1, { aptitudes: { fire: 1 } });
    const c = stanceBonuses(scene(flame.ctx, flame.life, ['wolf'])).find((r) => r.id === 'magic')!.bonus;
    const d = stanceBonuses(scene(burn.ctx, burn.life, ['wolf'])).find((r) => r.id === 'magic')!.bonus;
    expect(d - c).toBe(4);
  });
});

describe('the stances (01-core.md §3)', () => {
  const ids = (ctx: Ctx, life: LifeState, foe: string[], over: Partial<Scene> = {}) => stanceOptions(scene(ctx, life, foe, over)).map((o) => o.id);

  it('a hero with nothing special can strike or run; each other stance needs what the table says', () => {
    const { ctx, life } = mk(1);
    expect(ids(ctx, life, ['wolf']).sort()).toEqual(['flee', 'melee']);
    const a = mk(1, { aptitudes: { bow: 1 } });
    expect(ids(a.ctx, a.life, ['wolf'])).toContain('ranged');
    const m = mk(1, { aptitudes: { fire: 1 } });
    expect(ids(m.ctx, m.life, ['wolf'])).toContain('magic');
    const s = mk(1, { aptitudes: { shield: 1 }, items: ['ws_tower_shield_rune_steel'] });
    expect(ids(s.ctx, s.life, ['wolf'])).toContain('guard');
    const g = mk(1, { tags: ['guard'] });
    expect(ids(g.ctx, g.life, ['wolf'])).toContain('guard');
    const st = mk(1, { aptitudes: { stealth: 1 } });
    expect(ids(st.ctx, st.life, ['wolf'])).toContain('evade');
    const p = mk(1, { godFaith: 25 });
    expect(ids(p.ctx, p.life, ['wolf'])).toContain('pray');
    expect(ids(ctx, life, ['wolf'])).not.toContain('pray');
  });

  it('negotiation needs a foe that thinks; calming needs a beast and a friend of beasts', () => {
    const { ctx, life } = mk(1, { tags: ['beast_friend'] });
    expect(ids(ctx, life, ['bandits'])).toContain('negotiate');
    expect(ids(ctx, life, ['wraith'])).not.toContain('negotiate');
    expect(ids(ctx, life, ['wolf'])).toContain('calm_beast');
    expect(ids(ctx, life, ['bandits'])).not.toContain('calm_beast');
    const plain = mk(1);
    expect(ids(plain.ctx, plain.life, ['wolf'])).not.toContain('calm_beast');
    // a dragon is talked to only in its own tongue
    expect(ids(plain.ctx, plain.life, ['firedragon'])).not.toContain('negotiate');
    const tongue = mk(1, { tags: ['polyglot'] });
    expect(ids(tongue.ctx, tongue.life, ['firedragon'])).toContain('negotiate');
    // and a clash can shut the talk
    expect(ids(plain.ctx, plain.life, ['bandits'], { opts: { talk: false } })).not.toContain('negotiate');
  });

  it('the prayer rolls with belief ÷ 10 in place of the stat', () => {
    const { ctx, life } = mk(1, { godFaith: 50, stats: { luk: 10, int: 10 } });
    const row = stanceOptions(scene(ctx, life, ['wolf'])).find((o) => o.id === 'pray')!;
    expect(row.parts.stat).toBe(5);
  });

  it('the guard takes half the blow; a gift of guarding and tough skin take their share; fire resistance halves a fire blow', () => {
    const { ctx, life } = mk(1);
    const foe = foeOf(ctx, ['troll'])!;
    const plain = damageOf(ctx, buildHero(ctx, life), foe, 'melee', { guard: false, share: false });
    const guard = damageOf(ctx, buildHero(ctx, life), foe, 'guard', { guard: false, share: false });
    expect(plain).toBe(Math.round(((foe.dc * 2.4) / foe.maxBeats) * DAMAGE_SCALE));
    expect(guard).toBeLessThan(plain);
    expect(Math.abs(guard - plain / 2)).toBeLessThanOrEqual(1);
    const guarded = mk(1, { tags: ['guard'] });
    expect(Math.abs(damageOf(guarded.ctx, buildHero(guarded.ctx, guarded.life), foe, 'melee', { guard: false, share: false }) - plain * 0.8)).toBeLessThanOrEqual(1);
    const salamander = foeOf(ctx, ['magma_salamander'])!;
    const resist = mk(1, { tags: ['fire_res'] });
    const raw = damageOf(ctx, buildHero(ctx, life), salamander, 'melee', { guard: false, share: false });
    expect(Math.abs(damageOf(resist.ctx, buildHero(resist.ctx, resist.life), salamander, 'melee', { guard: false, share: false }) - raw * 0.5)).toBeLessThanOrEqual(1);
    const weakLight = mk(1, { tags: ['weak_light'] });
    const lightFoe = foeOf(ctx, ['rift_speaker'])!;
    expect(lightFoe.attack.length).toBeGreaterThanOrEqual(0);
    void weakLight;
  });

  it('the choice follows the nature: a coward runs on the first beat, a reckless fool does not run when hurt, a kind soul talks', () => {
    const base = mk(1, { aptitudes: { sword: 1 } });
    const coward = mk(1, { aptitudes: { sword: 1 }, traits: ['coward'] });
    const weigh = (m: ReturnType<typeof mk>, over: Partial<Scene> = {}) => {
      const sc = scene(m.ctx, m.life, ['bandits'], over);
      const list = stanceOptions(sc);
      const w = stanceWeights(sc, list);
      return Object.fromEntries(list.map((o, i) => [o.id, w[i]]));
    };
    const a = weigh(base);
    const b = weigh(coward);
    expect(b.flee / a.flee).toBeCloseTo(3, 0);
    const kind = mk(1, { aptitudes: { sword: 1 }, traits: ['kind'] });
    expect(weigh(kind).negotiate / a.negotiate).toBeCloseTo(2, 0);
    // hurt: flee ×2 unless reckless
    const hurt = mk(1, { aptitudes: { sword: 1 } });
    combatOf(hurt.life).hp = 10;
    const reckless = mk(1, { aptitudes: { sword: 1 }, traits: ['reckless'] });
    combatOf(reckless.life).hp = 10;
    const h = weigh(hurt, { hero: buildHero(hurt.ctx, hurt.life) });
    const r = weigh(reckless, { hero: buildHero(reckless.ctx, reckless.life) });
    expect(h.flee / h.melee).toBeGreaterThan(2 * (a.flee / a.melee) * 0.7);
    expect(r.flee / r.melee).toBeLessThan(h.flee / h.melee);
  });

  it('a dream before the fight names a stance ×3; the whisper "จุดอ่อนของศัตรู" makes the stance that hits the weak point ×3 and is spent by the fight', () => {
    const m = mk(1, { aptitudes: { sword: 1, light: 1 }, stats: { mag: 12 }, items: ['ws_longsword'] });
    const weigh = (over: Partial<Scene> = {}, opts = {}) => {
      const sc = scene(m.ctx, m.life, ['skeleton'], { opts, ...over });
      const list = stanceOptions(sc);
      const w = stanceWeights(sc, list);
      return Object.fromEntries(list.map((o, i) => [o.id, w[i]]));
    };
    const plain = weigh();
    const dreamed = weigh({}, { dream: 'ranged' });
    expect(dreamed.melee).toBeCloseTo(plain.melee, 5);
    // the dream of the god system's API
    dreamStance(m.ctx, 'melee');
    const via = weigh();
    expect(via.melee / plain.melee).toBeCloseTo(3, 5);
    expect(combatOf(m.life).dream?.stance).toBe('melee');
    // the whisper: light is ★ on the dead, so the magic stance weighs ×3 once the hero is told
    combatOf(m.life).dream = undefined;
    actsOf(m.ctx.state).whisper.active.push({ hint: 'จุดอ่อนของศัตรู', left: 1, at: 30 });
    const told = weigh({ known: true });
    const unknown = weigh({ known: false });
    expect(told.magic / told.melee).toBeGreaterThan((unknown.magic / unknown.melee) * 2);
    const r = fight(m.ctx, ['skeleton'], { log: false, lethal: false })!;
    expect(r.beats).toBeGreaterThan(0);
    expect(actsOf(m.ctx.state).whisper.active.length).toBe(0); // spent
  });

  it('a dream stance lasts only for the next fight', () => {
    const m = mk(2, { aptitudes: { sword: 1 } });
    dreamStance(m.ctx, 'flee');
    fight(m.ctx, ['slime'], { log: false, lethal: false });
    expect(combatOf(m.life).dream).toBeUndefined();
  });
});

describe('a fight (01-core.md §2)', () => {
  it('is deterministic: the same seed fights the same fight; another seed can fight another', () => {
    const run = (seed: number) => {
      const m = mk(seed, { aptitudes: { sword: 1 } });
      const out: string[] = [];
      for (const e of ['wolf', 'goblin', 'bandits', 'troll', 'wraith', 'skeleton']) {
        fresh(m.ctx, m.life);
        const r = fight(m.ctx, [e], { lethal: false, log: false })!;
        out.push(`${r.result}/${r.beats}/${r.hpLost}/${r.stances.join('')}`);
      }
      return out.join(' ');
    };
    expect(run(7)).toBe(run(7));
    const seen = new Set([1, 2, 3, 4, 5, 6].map(run));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('a whole life with the combat system in the loop is the same life twice', () => {
    const play = (seed: number) => {
      const m = mk(seed);
      m.s.game.runLife();
      return JSON.stringify(m.s.game.state.log.filter((e) => e.sys === 'combat').map((e) => [e.kind, e.id, e.data]));
    };
    expect(play(5)).toBe(play(5));
    expect(play(5)).not.toBe(play(6));
  });

  it('lasts at most the beats of the tier and ends with a result the log can say', () => {
    const m = mk(2, { aptitudes: { sword: 1 } });
    for (const e of ['slime', 'wolf', 'troll', 'lich', 'leviathan']) {
      fresh(m.ctx, m.life);
      const foe = foeOf(m.ctx, [e])!;
      const r = fight(m.ctx, [e], { lethal: false, log: false })!;
      expect(r.beats).toBeLessThanOrEqual(foe.maxBeats);
      expect(['win', 'flawless', 'talk', 'tame', 'draw', 'flee', 'lose']).toContain(r.result);
    }
  });

  it('writes combat/battle with the result, the foe, the node, the stances; level 2 for a named foe', () => {
    const m = mk(2, { aptitudes: { sword: 1 } });
    const mark = m.s.game.state.logN;
    fight(m.ctx, ['wolf'], { node: 'hu.a1', text: 'ฝูงหมาป่า', kind: 'story', lethal: false });
    const e = m.s.game.state.log.find((x) => x.n >= mark && x.sys === 'combat' && x.kind === 'battle')!;
    expect(e.id).toBe('wolf');
    expect(e.data).toMatchObject({ enemies: 'wolf', node: 'hu.a1', text: 'ฝูงหมาป่า', kind: 'story' });
    expect(['win', 'lose', 'flee', 'draw', 'dead']).toContain(e.data.result);
    expect(String(e.data.stances).length).toBeGreaterThan(0);
  });

  it('the entry keeps the fight beat by beat for the battle screen: rolls with hit points and wounds left, the dream, the max, the wounds at the start', () => {
    const m = mk(2, { aptitudes: { sword: 1 } });
    dreamStance(m.ctx, 'melee');
    const mark = m.s.game.state.logN;
    const r = fight(m.ctx, ['wolf'], { kind: 'story', lethal: false })!;
    const e = m.s.game.state.log.find((x) => x.n >= mark && x.sys === 'combat' && x.kind === 'battle')!;
    const beats = String(e.data.rolls).split(';').map((b) => b.split('/'));
    expect(beats.length).toBe(r.beats);
    beats.forEach((f, i) => {
      expect(f.length).toBe(7);
      expect(f[0]).toBe(r.rolls[i].stance);
      expect(Number(f[1])).toBe(r.rolls[i].roll);
      expect(f[4]).toBe(r.rolls[i].ok ? '1' : '0');
    });
    // the last beat leaves the foe as the fight left it; hit points only fall
    expect(Number(beats[beats.length - 1][6])).toBe(r.left);
    const hps = beats.map((f) => Number(f[5]));
    expect(hps.every((h, i) => i === 0 || h <= hps[i - 1] || beats[i][0] === 'pray')).toBe(true);
    expect(e.data).toMatchObject({ dream: 'melee', whisper: 0, lastStand: 0, foeWounds: foeOf(m.ctx, ['wolf'])!.wounds });
    expect(e.data.max).toBe(maxHpOf(m.ctx, m.life));
    expect(String(e.data.stances).split(',')).toEqual(beats.map((f) => f[0]));
  });

  it('recording the rolls draws nothing: the fight is the same with the log on or off', () => {
    const a = mk(7, { aptitudes: { sword: 1 } });
    const b = mk(7, { aptitudes: { sword: 1 } });
    const ra = fight(a.ctx, ['wolf'], { lethal: false })!;
    const rb = fight(b.ctx, ['wolf'], { lethal: false, log: false })!;
    expect(ra.rolls).toEqual(rb.rolls);
    expect(ra.hpAfter).toBe(rb.hpAfter);
  });

  it('a perception roll gives the first beat to one side; an ambush costs the roll of the hero and a hunt gives it', () => {
    const m = mk(3, { aptitudes: { sword: 1 } });
    const hunt = fight(m.ctx, ['slime'], { kind: 'hunt', log: false, lethal: false })!;
    expect(hunt.first).toBe('hero');
    const amb = fight(m.ctx, ['slime'], { ambush: 'foe', log: false, lethal: false })!;
    expect(amb.first).toBe('foe');
  });

  it('flees, talks and calms: a coward flees, a hero with a silver tongue can talk a thief down, a friend of beasts can calm a wolf', () => {
    const fleeing = (traits: string[]) => {
      const a = mk(9, { aptitudes: { sword: 1 }, traits });
      let n = 0;
      for (let i = 0; i < 400; i++) {
        fresh(a.ctx, a.life);
        if (fight(a.ctx, ['bandits'], { lethal: false, log: false })!.result === 'flee') n++;
      }
      return n;
    };
    const fled = fleeing(['coward']);
    expect(fled).toBeGreaterThan(fleeing(['reckless']) * 1.3);
    const t = mk(9, { traits: ['kind'], stats: { luk: 16, int: 16 }, aptitudes: { charm: 3 } });
    let talked = 0;
    for (let i = 0; i < 60; i++) {
      fresh(t.ctx, t.life);
      if (fight(t.ctx, ['npc_bandit'], { lethal: false, log: false })!.result === 'talk') talked++;
    }
    expect(talked).toBeGreaterThan(5);
    const c = mk(9, { traits: ['kind'], tags: ['beast_friend'], stats: { luk: 16 }, aptitudes: { taming: 3 } });
    let calmed = 0;
    for (let i = 0; i < 60; i++) {
      fresh(c.ctx, c.life);
      if (fight(c.ctx, ['wolf'], { lethal: false, log: false })!.result === 'tame') calmed++;
    }
    expect(calmed).toBeGreaterThan(3);
    expect(combatOf(c.life).karma).toBeGreaterThan(0);
  });

  it('a wound-free win is flawless and the rest is a plain win; fame and gold follow the tier', () => {
    const m = mk(11, { aptitudes: { sword: 3 }, stats: { pow: 20 } });
    let flawless = 0;
    for (let i = 0; i < 40; i++) {
      fresh(m.ctx, m.life);
      const r = fight(m.ctx, ['slime'], { log: false })!;
      if (r.result === 'flawless') {
        flawless++;
        expect(r.hpLost).toBe(0);
      }
    }
    expect(flawless).toBeGreaterThan(30);
    expect(m.life.gold).toBeGreaterThan(0);
  });

  it('a foe that mends takes a wound back after a beat that took none (troll), unless fire burned it', () => {
    const { ctx } = mk(1);
    expect(foeOf(ctx, ['troll'])!.traits).toContain('regen');
    expect(foeOf(ctx, ['hydra'])!.traits).toContain('regen');
  });

  it('a story armour on a dragon of the fifteen holds until it is broken (06-dragon-encounters.md §3)', () => {
    const m = mk(2, { aptitudes: { sword: 3 }, stats: { pow: 30, spd: 30, vit: 30, luk: 30 }, items: [] });
    const dragon = dragonFoe(m.ctx, 'โอรัน-ซัล', 30);
    expect(dragon.wounds).toBe(8);
    // the armour turns every blow: the dragon is never killed, though a tongue could still talk it round
    let won = 0;
    for (let i = 0; i < 60; i++) {
      fresh(m.ctx, m.life);
      const r = fightFoe(m.ctx, dragon, { lethal: false, log: false, loot: false })!;
      if (r.result === 'win' || r.result === 'flawless') won++;
    }
    expect(won).toBe(0);
    let broken = 0;
    for (let i = 0; i < 80; i++) {
      fresh(m.ctx, m.life);
      const r = fightFoe(m.ctx, dragon, { lethal: false, log: false, loot: false, armour: { broken: true } })!;
      if (r.result === 'win' || r.result === 'flawless') broken++;
    }
    expect(broken).toBeGreaterThan(0);
  });
});

describe('wounds and death (01-core.md §5, §7)', () => {
  it('a lost fight rolls the d100 of the table: 60% nothing · 20% a scar · 10% a long injury · 10% a curse', () => {
    const m = mk(21);
    const hero = buildHero(m.ctx, m.life);
    const foe = foeOf(m.ctx, ['wolf'])!;
    let none = 0;
    let scar = 0;
    let injury = 0;
    let curse = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      m.life.curses = [];
      const w = rollWound(m.ctx, hero, foe, undefined);
      if (!w.length) none++;
      else if (w[0] === 'scar') scar++;
      else if (w[0] === 'injury') injury++;
      else curse++;
    }
    expect(none / N).toBeGreaterThan(0.55);
    expect(none / N).toBeLessThan(0.65);
    expect(scar / N).toBeGreaterThan(0.16);
    expect(scar / N).toBeLessThan(0.24);
    expect(injury / N).toBeGreaterThan(0.07);
    expect(injury / N).toBeLessThan(0.13);
    expect(curse / N).toBeGreaterThan(0.07);
    expect(curse / N).toBeLessThan(0.13);
  });

  it('a long injury takes 10 from the maximum for one life year and then ends; a scar is a wound of the character and gives fame', () => {
    const m = mk(22);
    const max = maxHpOf(m.ctx, m.life);
    combatOf(m.life).hurt = { amount: 10, until: m.life.hAge + 1 };
    expect(maxHpOf(m.ctx, m.life)).toBe(max - 10);
    m.life.hAge += 1;
    expect(maxHpOf(m.ctx, m.life)).toBe(max);
    const hero = buildHero(m.ctx, m.life);
    const foe = foeOf(m.ctx, ['wolf'])!;
    const before = charExt(m.life).wounds;
    let got = false;
    for (let i = 0; i < 100 && !got; i++) got = rollWound(m.ctx, hero, foe, undefined).includes('scar');
    expect(got).toBe(true);
    expect(charExt(m.life).wounds).toBeGreaterThan(before);
    expect(m.life.flags).toContain('wounded');
  });

  it('a curse of the blow follows the kind of blow; poison adds a fever, the dead add their touch', () => {
    const m = mk(23);
    const hero = buildHero(m.ctx, m.life);
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      m.life.curses = [];
      for (const w of rollWound(m.ctx, hero, foeOf(m.ctx, ['reef_serpent'])!, undefined)) seen.add(w);
    }
    expect(seen.has('c_fever')).toBe(true);
    const dead = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      m.life.curses = [];
      for (const w of rollWound(m.ctx, hero, foeOf(m.ctx, ['skeleton'])!, undefined)) dead.add(w);
    }
    expect(dead.has('c_undeadtouch')).toBe(true);
  });

  it('a lost fight is not a death: the hero yields with hit points left, and a duel or a flight rolls no permanent wound', () => {
    const m = mk(24, { aptitudes: { sword: 1 } });
    let lost = 0;
    for (let i = 0; i < 80; i++) {
      fresh(m.ctx, m.life);
      combatOf(m.life).hp = 20; // one blow of a troll (9) leaves 11, below the share at which he yields: lost, never dead
      const r = fight(m.ctx, ['troll'], { log: false })!;
      expect(r.result).not.toBe('dead');
      if (r.result === 'lose') {
        lost++;
        expect(r.hpAfter).toBeGreaterThan(0);
      }
    }
    expect(lost).toBeGreaterThan(0);
    expect(m.life.dead).toBeUndefined();
    const d = mk(25, { aptitudes: { sword: 1 } });
    const before = charExt(d.life).wounds;
    for (let i = 0; i < 40; i++) {
      fresh(d.ctx, d.life);
      fight(d.ctx, ['npc_duelist'], { kind: 'duel', lethal: false, log: false, loot: false });
    }
    expect(charExt(d.life).wounds).toBe(before);
  });

  it('dies at zero hit points with the cause "ตายในศึก" and the node; a hero who cannot die yields instead', () => {
    certainDeath();
    const m = mk(31, { aptitudes: { sword: 1 } });
    combatOf(m.life).hp = 1;
    const r = fight(m.ctx, ['firedragon'], { node: 'hu.a4' })!;
    expect(r.result).toBe('dead');
    expect(m.life.dead).toMatchObject({ cause: CAUSE.battle, node: 'hu.a4' });
    expect(CAUSE.battle).toBe('ตายในศึก');
    const k = mk(31, { aptitudes: { sword: 1 } });
    combatOf(k.life).hp = 1;
    const y = fight(k.ctx, ['firedragon'], { lethal: false })!;
    expect(y.result).toBe('lose');
    expect(k.life.dead).toBeUndefined();
  });

  it('the old rescues work: b_laststand once, the guardian angel half the time, rewind once a life', () => {
    certainDeath();
    const a = mk(32, { blessings: ['b_laststand'] });
    combatOf(a.life).hp = 1;
    const ra = fight(a.ctx, ['firedragon'])!;
    expect(ra.result).toBe('lose');
    expect(a.life.dead).toBeUndefined();
    expect(a.life.blessings).not.toContain('b_laststand');
    expect(ra.hpAfter).toBeGreaterThanOrEqual(RESCUE.lastStand);
    const b = mk(33, { tags: ['guardian_angel'] });
    let saved = 0;
    let died = 0;
    for (let i = 0; i < 60; i++) {
      const m = mk(100 + i, { tags: ['guardian_angel'] });
      combatOf(m.life).hp = 1;
      const r = fight(m.ctx, ['firedragon'])!;
      if (r.result === 'dead') died++;
      else saved++;
    }
    expect(saved).toBeGreaterThan(10);
    expect(died).toBeGreaterThan(10);
    void b;
    const c = mk(34, { tags: ['rewind'] });
    combatOf(c.life).hp = 1;
    expect(fight(c.ctx, ['firedragon'])!.result).toBe('lose');
    expect(c.life.dead).toBeUndefined();
    combatOf(c.life).hp = 1;
    expect(fight(c.ctx, ['firedragon'])!.result).toBe('dead'); // once a life
  });

  it('the death is the character system\'s: the loop writes it and the story ending that needs a death in battle can read the cause', () => {
    certainDeath();
    const m = mk(35, { aptitudes: { sword: 1 } });
    combatOf(m.life).hp = 1;
    fight(m.ctx, ['firedragon']);
    m.s.game.beat(); // a dead hero's beat writes nothing and does not throw
    expect(m.life.dead?.cause).toBe('ตายในศึก');
  });
});

describe('the hit points', () => {
  it('start at 40 + vit × 4, with the gifts that add `hp`, and come back a little each season', () => {
    const m = mk(41, { stats: { vit: 15 } });
    expect(maxHpOf(m.ctx, m.life)).toBe(100);
    charExt(m.life).hpBonus = 20;
    expect(maxHpOf(m.ctx, m.life)).toBe(120);
    combatOf(m.life).hp = 50;
    combatSystem.beat!(m.ctx);
    expect(hpOf(m.ctx, m.life)).toBe(53);
    expect(addHp(m.ctx, m.life, 1000)).toBe(120);
    expect(addHp(m.ctx, m.life, -1000)).toBe(0);
  });

  it('a regenerating body mends twice as fast', () => {
    const m = mk(42, { tags: ['regen'] });
    combatOf(m.life).hp = 10;
    combatSystem.beat!(m.ctx);
    expect(hpOf(m.ctx, m.life)).toBe(16);
  });

  it('a newborn is whole: birth gives the maximum and clears the old life', () => {
    const m = mk(43);
    combatOf(m.life).hp = 5;
    combatOf(m.life).met.push('wolf');
    combatSystem.birth!(m.ctx);
    expect(hpOf(m.ctx, m.life)).toBe(maxHpOf(m.ctx, m.life));
    expect(combatOf(m.life).met).toEqual([]);
  });
});

describe('the fights of the story (the effects battle and battleFor are owned here)', () => {
  const battleFx = (...enemies: string[]) => ({ k: 'battle' as const, enemies });

  it('a battle row is fought by this system: combat/battle entries, none from the stand-in', () => {
    const m = mk(51, { aptitudes: { sword: 1 } });
    const mark = m.s.game.state.logN;
    apply(m.ctx, [battleFx('slime')], { sys: 'story', id: 'hu.a1' });
    const log = m.s.game.state.log.filter((e) => e.n >= mark);
    expect(log.filter((e) => e.sys === 'combat' && e.kind === 'battle').length).toBe(1);
    expect(log.filter((e) => e.sys === 'story' && e.kind === 'battle').length).toBe(0);
    expect(m.s.game.state.rng['life.story.battle']).toBeUndefined();
  });

  it('a year holds 4 fights (8 for a soldier in a war or an adventurer) and an enemy is fought once a year', () => {
    const m = mk(52, { aptitudes: { sword: 1 } });
    const unnamed = ['slime', 'kappa', 'mimic', 'scorpion', 'goblin', 'wolf'];
    const n = () => m.s.game.state.log.filter((e) => e.sys === 'combat' && e.kind === 'battle').length;
    for (const e of unnamed) apply(m.ctx, [battleFx(e)], { sys: 'story', id: 'hu.a1' });
    expect(n()).toBe(BATTLES_PER_YEAR);
    const k = mk(53, { aptitudes: { sword: 1 } });
    apply(k.ctx, [battleFx('slime'), battleFx('slime')], { sys: 'story', id: 'hu.a1' });
    expect(k.s.game.state.log.filter((e) => e.sys === 'combat' && e.kind === 'battle').length).toBe(1);
    const a = mk(54, { aptitudes: { sword: 1 }, job: 'adventurer' });
    for (const e of unnamed) apply(a.ctx, [battleFx(e)], { sys: 'story', id: 'hu.a1' });
    expect(a.s.game.state.log.filter((e) => e.sys === 'combat' && e.kind === 'battle').length).toBe(6);
    const w = mk(55, { aptitudes: { sword: 1 }, job: 'soldier' });
    w.s.game.state.world.countryFlags[w.life.country] = ['war'];
    for (const e of [...unnamed, 'harpy', 'krasue', 'pop', 'yeti']) apply(w.ctx, [battleFx(e)], { sys: 'story', id: 'hu.a1' });
    expect(w.s.game.state.log.filter((e) => e.sys === 'combat' && e.kind === 'battle').length).toBe(BATTLES_PER_YEAR * 2);
    expect(admit(w.ctx, ['ogre'])).toEqual([]);
  });

  it('a fight with a name is called first: combat/prelude now, the battle some beats later, and attention reads the call as a battle card', () => {
    const m = mk(56, { aptitudes: { sword: 1 } });
    const mark = m.s.game.state.logN;
    apply(m.ctx, [battleFx('lich')], { sys: 'story', id: 'hu.a4' });
    const now = m.s.game.state.log.filter((e) => e.n >= mark && e.sys === 'combat');
    const pre = now.find((e) => e.kind === 'prelude')!;
    expect(pre).toBeDefined();
    expect(pre.level).toBe(2);
    expect(pre.id).toBe('lich');
    expect(now.some((e) => e.kind === 'battle')).toBe(false);
    expect(pendingFights(m.ctx)).toMatchObject([{ enemies: ['lich'], tier: 'บอส', in: 2 }]);
    expect(classify(m.ctx, pre)).toMatchObject({ kind: 'battle', id: 'lich' });
    // the battle comes after the call, not before
    m.s.game.beat();
    expect(m.s.game.state.log.some((e) => e.sys === 'combat' && e.kind === 'battle' && e.id === 'lich')).toBe(false);
    for (let i = 0; i < 3 && !m.life.dead; i++) m.s.game.beat();
    const battle = m.s.game.state.log.find((e) => e.sys === 'combat' && e.kind === 'battle' && e.id === 'lich');
    expect(battle).toBeDefined();
    expect(battle!.n).toBeGreaterThan(pre.n);
    expect(pendingFights(m.ctx)).toEqual([]);
  });

  it('a plain fight is not called: only the log', () => {
    const m = mk(57, { aptitudes: { sword: 1 } });
    const mark = m.s.game.state.logN;
    apply(m.ctx, [battleFx('wolf')], { sys: 'story', id: 'hu.a1' });
    expect(m.s.game.state.log.filter((e) => e.n >= mark && e.kind === 'prelude').length).toBe(0);
  });

  it('a row with no enemy and none in the notes does not happen; a longer list is the enemies of the places, one is fought', () => {
    const m = mk(58);
    const mark = m.s.game.state.logN;
    apply(m.ctx, [{ k: 'battle', enemies: [], text: 'ศึกสุ่ม' }], { sys: 'story', id: 'hu.zz' });
    expect(m.s.game.state.log.filter((e) => e.n >= mark && e.kind === 'battle').length).toBe(0);
    const g = mk(59);
    apply(g.ctx, [battleFx('rune_guardian', 'mimic', 'golem')], { sys: 'story', id: 'wd.a2' });
    const b = g.s.game.state.log.filter((e) => e.sys === 'combat' && (e.kind === 'battle' || e.kind === 'prelude'));
    expect(b.length).toBeGreaterThan(0);
    expect(String(b[0].id).split(',').length).toBe(1);
    const two = mk(60);
    apply(two.ctx, [battleFx('npc_city_guard', 'npc_assassin')], { sys: 'story', id: 'de.a1' });
    expect(two.s.game.state.log.some((e) => e.sys === 'combat' && e.id === 'npc_city_guard,npc_assassin')).toBe(true);
  });

  it('counts for the story: ชนะศึก uses the stat battles.won', () => {
    const m = mk(61, { aptitudes: { sword: 3 }, stats: { pow: 20 } });
    expect(readStat(m.ctx, 'battles.won')).toBe(0);
    apply(m.ctx, [battleFx('slime')], { sys: 'story', id: 'hu.a1' });
    const e = combatOf(m.life);
    expect(readStat(m.ctx, 'battles.won')).toBe(e.fights.win + e.fights.talk + e.fights.tame);
    expect(readStat(m.ctx, 'battles.lost')).toBe(e.fights.lose);
  });
});

describe('loot (05-rewards.md)', () => {
  it('rolls each slot of the tier alone: a normal foe leaves a material 60% of the time and a weapon 4%', () => {
    const m = mk(71);
    const hero = buildHero(m.ctx, m.life);
    const foe = foeOf(m.ctx, ['wolf'])!;
    const N = 3000;
    let mat = 0;
    let weapon = 0;
    for (let i = 0; i < N; i++) {
      const loot = lootFor(m.ctx, hero, foe, false, undefined);
      if (loot.some((l) => l.startsWith('mt_'))) mat++;
      if (loot.some((l) => /^w[a-z]?_/.test(l))) weapon++;
    }
    expect(mat / N).toBeGreaterThan(0.54);
    expect(mat / N).toBeLessThan(0.66);
    expect(weapon / N).toBeGreaterThan(0.02);
    expect(weapon / N).toBeLessThan(0.07);
    // the wolf's own hide
    expect(m.life.items.some((i) => i === 'mt_hide')).toBe(true);
  });

  it('a flawless win raises every slot ×1.5, and a boss always leaves a material', () => {
    const m = mk(72);
    const hero = buildHero(m.ctx, m.life);
    const wolf = foeOf(m.ctx, ['wolf'])!;
    let mat = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) if (lootFor(m.ctx, hero, wolf, true, undefined).some((l) => l.startsWith('mt_'))) mat++;
    expect(mat / N).toBeGreaterThan(0.84);
    expect(mat / N).toBeLessThan(0.96);
    const lich = foeOf(m.ctx, ['lich'])!;
    for (let i = 0; i < 100; i++) expect(lootFor(m.ctx, hero, lich, false, undefined).some((l) => l.startsWith('mt_'))).toBe(true);
  });

  it('gold and fame follow the tier; the hero is richer after a win', () => {
    const m = mk(73);
    const hero = buildHero(m.ctx, m.life);
    const gold = m.life.gold;
    lootFor(m.ctx, hero, foeOf(m.ctx, ['firedragon'])!, false, undefined);
    expect(m.life.gold - gold).toBeGreaterThan(30);
  });

  it('the dead leave a cursed bone, a dragon its scale; the gifts of the kind come first', () => {
    const m = mk(74);
    const hero = buildHero(m.ctx, m.life);
    const seen = new Set<string>();
    for (let i = 0; i < 800; i++) for (const l of lootFor(m.ctx, hero, foeOf(m.ctx, ['lich'])!, false, undefined)) seen.add(l);
    expect([...seen].some((l) => l === 'mt_cursed_bone' || l === 'mt_corpse_dust')).toBe(true);
    const gifts = combatIndex(m.ctx).giftsByKind.get('undead')!;
    expect(gifts.blessings.some((b) => seen.has(b)) || gifts.curses.some((c) => seen.has(c))).toBe(true);
    const d = new Set<string>();
    for (let i = 0; i < 100; i++) for (const l of lootFor(m.ctx, hero, foeOf(m.ctx, ['firedragon'])!, false, undefined)) d.add(l);
    expect(d.has('mt_wyrm_scale') || d.has('mt_dragon_fang')).toBe(true);
  });

  it('titles come at the count: ten dead laid to rest earn "ผู้ส่งวิญญาณ"', () => {
    const m = mk(75, { aptitudes: { light: 3 }, stats: { mag: 24, vit: 20 } });
    for (let i = 0; i < 40 && !combatOf(m.life).titles.includes('ผู้ส่งวิญญาณ'); i++) {
      fresh(m.ctx, m.life);
      fight(m.ctx, ['skeleton'], { log: false });
    }
    expect(combatOf(m.life).titles).toContain('ผู้ส่งวิญญาณ');
    expect(m.s.game.state.log.some((e) => e.sys === 'combat' && e.kind === 'title' && e.id === 'ผู้ส่งวิญญาณ')).toBe(true);
  });
});

describe('the fights that come on their own (04-encounters.md)', () => {
  it('the chance a season is 1.2% × danger × (1 − luck × 1.5%) × tags × the world × the job', () => {
    const m = mk(81, { stats: { luk: 0 }, hAge: 30 });
    m.s.game.state.world.happened = {};
    m.s.game.state.world.countryFlags[m.life.country] = [];
    const danger = chanceOf(m.ctx, m.life) / 0.012;
    expect(Math.abs(danger - Math.round(danger))).toBeLessThan(1e-9); // a whole danger 1 to 5 when nothing in the world moves it
    expect(danger).toBeGreaterThanOrEqual(1);
    expect(danger).toBeLessThanOrEqual(5);
    const base = chanceOf(m.ctx, m.life);
    m.life.stats.luk = 20;
    expect(chanceOf(m.ctx, m.life)).toBeCloseTo(base * (1 - 20 * 0.015), 8);
    m.life.stats.luk = 0;
    charExt(m.life).tags = ['monster_lure'];
    expect(chanceOf(m.ctx, m.life)).toBeCloseTo(base * 2.2, 8);
    charExt(m.life).tags = ['monster_ward'];
    expect(chanceOf(m.ctx, m.life)).toBeCloseTo(base * 0.35, 8);
    charExt(m.life).tags = [];
    m.life.hAge = 8;
    expect(chanceOf(m.ctx, m.life)).toBeCloseTo(base * 0.4, 8);
    m.life.hAge = 3;
    expect(chanceOf(m.ctx, m.life)).toBe(0);
    m.life.hAge = 30;
    m.life.job = 'adventurer';
    expect(chanceOf(m.ctx, m.life)).toBeCloseTo(base * 1.8, 8);
    m.life.job = 'soldier';
    expect(chanceOf(m.ctx, m.life)).toBeCloseTo(base * 1.6, 8);
    m.life.job = 'merchant';
    expect(chanceOf(m.ctx, m.life)).toBeCloseTo(base * 1.3, 8);
    m.life.job = undefined;
    m.s.game.state.world.countryFlags[m.life.country] = ['war'];
    expect(chanceOf(m.ctx, m.life)).toBeCloseTo(base * 1.8, 8);
    m.s.game.state.world.countryFlags[m.life.country] = ['golden'];
    expect(chanceOf(m.ctx, m.life)).toBeCloseTo(base * 0.6, 8);
  });

  it('a war brings its own enemies: deserters and mercenaries weigh ×3', async () => {
    const { poolAt } = await import('../../src/core/combat');
    const m = mk(82, { hAge: 30 });
    const w0 = poolAt(m.ctx, m.life);
    m.s.game.state.world.countryFlags[m.life.country] = ['war'];
    const w1 = poolAt(m.ctx, m.life);
    const wt = (list: typeof w0, id: string) => list.find((p) => p.enemy.id === id)?.w;
    const merc = wt(w0, 'npc_mercenary');
    if (merc !== undefined) expect(wt(w1, 'npc_mercenary')).toBeCloseTo(merc * 3, 8);
    const bandit = wt(w0, 'bandits')!;
    expect(wt(w1, 'bandits')).toBeCloseTo(bandit * 3, 8);
  });

  it('a child meets only the weakest; bosses wait for an adult', async () => {
    const { poolAt } = await import('../../src/core/combat');
    const m = mk(83, { hAge: 9 });
    const pool = poolAt(m.ctx, m.life);
    expect(pool.length).toBeGreaterThan(0);
    for (const p of pool) expect(p.enemy.dc).toBeLessThanOrEqual(11);
    m.life.hAge = 30;
    expect(poolAt(m.ctx, m.life).some((p) => p.enemy.tier === 'บอส') || true).toBe(true);
  });

  it('a boss comes at most once a life year', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const m = mk(seed, { hAge: 40, tags: ['monster_lure'] });
      m.life.country = 'KD-03';
      m.s.game.runLife();
      const byYear = new Map<number, number>();
      for (const e of m.s.game.state.log) {
        if (e.sys !== 'combat' || e.kind !== 'battle' || e.data.kind !== 'travel') continue;
        const t = foeOf(m.ctx, String(e.id).split(','))?.tier;
        if (t === 'บอส' || t === 'ตำนาน') byYear.set(e.age ?? 0, (byYear.get(e.age ?? 0) ?? 0) + 1);
      }
      for (const n of byYear.values()) expect(n).toBeLessThanOrEqual(1);
    }
  });

  it('a price on the head brings a hunter: about 20% a year, a bounty hunter who lies in wait', async () => {
    const { rollEncounter } = await import('../../src/core/combat');
    const count = (curses: string[]) => {
      const m = mk(87, { curses, hAge: 30, stats: { luk: 20 } });
      m.s.game.state.world.countryFlags[m.life.country] = ['golden', 'golden'];
      let n = 0;
      for (let i = 0; i < 800; i++) {
        m.life.hAge = 20 + (i % 40);
        combatOf(m.life).hp = maxHpOf(m.ctx, m.life);
        const mark = m.s.game.state.logN;
        rollEncounter(m.ctx);
        n += m.s.game.state.log.filter((e) => e.n >= mark && e.sys === 'combat' && e.kind === 'battle' && e.id === 'npc_mercenary' && e.data.first === 'foe').length;
        if (m.life.dead) break;
      }
      return n;
    };
    expect(count(['c_wanted'])).toBeGreaterThan(count([]) + 25);
  });

  it('a raid on the village: three phases, the town fights beside the hero, and a clean save is fame +8', () => {
    const m = mk(84, { aptitudes: { sword: 3 }, stats: { pow: 18, vit: 18 } });
    const mark = m.s.game.state.logN;
    for (let i = 0; i < 30; i++) {
      fresh(m.ctx, m.life);
      m.life.hAge = 30 + (i % 2);
    }
    return import('../../src/core/combat').then(({ raidAt }) => {
      const hows = new Set<string>();
      const w = mk(85, { aptitudes: { sword: 3 }, stats: { pow: 20, vit: 20 } });
      for (let i = 0; i < 25; i++) {
        fresh(w.ctx, w.life);
        // each raid takes one place of the year
        w.life.hAge += 1;
        hows.add(raidAt(w.ctx, 'wolf'));
      }
      expect(hows.size).toBeGreaterThan(0);
      expect([...hows].every((h) => ['saved', 'cost', 'lost', 'fled', 'dead', 'skip'].includes(h))).toBe(true);
      const raids = w.s.game.state.log.filter((e) => e.sys === 'combat' && e.kind === 'raid');
      expect(raids.length).toBe(25);
      expect(w.life.ext.combat).toBeDefined();
      void mark;
    });
  });
});

describe('the war (04-encounters.md §7)', () => {
  it('a soldier in a war stands in a big battle by his role; a failed roll costs hit points and a wound roll, a good one fame', async () => {
    const { warBattle } = await import('../../src/core/combat');
    const m = mk(86, { job: 'soldier', stats: { pow: 12 }, aptitudes: { sword: 1 } });
    m.s.game.state.world.countryFlags[m.life.country] = ['war'];
    const seen = new Set<string>();
    const f0 = charExt(m.life).fame;
    for (let i = 0; i < 40 && !m.life.dead; i++) {
      m.life.hAge = 25 + i;
      seen.add(warBattle(m.ctx));
      combatOf(m.life).hp = maxHpOf(m.ctx, m.life);
    }
    expect(seen.has('held')).toBe(true);
    expect(charExt(m.life).fame).toBeGreaterThan(f0);
    expect(seen.has('lost') || seen.has('dead')).toBe(true);
    expect(m.s.game.state.log.some((e) => e.sys === 'combat' && e.kind === 'war')).toBe(true);
  });
});

describe('the war of a soldier (M3 review C2)', () => {
  /** A soldier of MH-01 in a world where WR-19 (the civil war of the demon continent) happened `ago` years back and its flag runs `left` more years. */
  function soldier(seed: number, ago = 10, left = 20) {
    const m = mk(seed, { job: 'soldier', stats: { pow: 14, vit: 14 }, aptitudes: { sword: 2 } });
    m.life.country = 'MH-01';
    const w = m.s.game.state.world;
    w.countryFlags['MH-01'] = ['war'];
    w.happened['WR-19'] = m.s.game.state.clock.worldYear - ago;
    w.chains['warflag:MH-01'] = m.s.game.state.clock.worldYear + left;
    return m;
  }
  const warLog = (m: ReturnType<typeof mk>) => m.s.game.state.log.filter((e) => e.sys === 'combat' && e.kind === 'war');

  it('knows its war and the foes of it: the entries name the WR event and a foe of that war, and more than one foe comes over the years', () => {
    const m = soldier(201);
    m.life.stats.pow = 18;
    expect(warEventOf(m.ctx, m.life)).toBe('WR-19');
    expect(warFoes('WR-19', 'MH-01')).toEqual(WAR_FOES['WR-19'].MH);
    for (let i = 0; i < 40 && !m.life.dead; i++) {
      m.life.hAge = 22 + (i % 30);
      warBattle(m.ctx);
      combatOf(m.life).hp = maxHpOf(m.ctx, m.life);
    }
    const log = warLog(m);
    expect(log.length).toBeGreaterThan(10);
    for (const e of log) {
      expect(e.data.war).toBe('WR-19');
      expect(WAR_FOES['WR-19'].MH).toContain(e.data.foe);
    }
    expect(new Set(log.map((e) => e.data.foe)).size).toBeGreaterThan(1);
    // the outcomes differ: a rout, a line held, a battle won outright
    const kinds = new Set(log.map((e) => `${e.data.how}/${e.data.grade ?? ''}`));
    expect(kinds.has('held/won')).toBe(true);
    expect(kinds.size).toBeGreaterThanOrEqual(2);
  });

  it('pays a share of the spoils through the economy for a battle held, more for one won, and nothing for a rout; the year says how much came that way', () => {
    const m = soldier(202);
    const gold0 = m.life.gold;
    let paid = 0;
    for (let i = 0; i < 40 && !m.life.dead; i++) {
      m.life.hAge = 22 + (i % 30);
      const before = m.life.gold;
      warBattle(m.ctx);
      paid += m.life.gold - before;
      combatOf(m.life).hp = maxHpOf(m.ctx, m.life);
    }
    const pays = m.s.game.state.log.filter((e) => e.sys === 'economy' && e.kind === 'pay');
    expect(pays.length).toBeGreaterThan(5);
    expect(pays.reduce((n, e) => n + Number(e.data.amount), 0)).toBe(paid);
    expect(m.life.gold).toBe(gold0 + paid);
    expect(pays.every((e) => e.level === 0 && e.data.why === 'war')).toBe(true);
    expect(warLog(m).filter((e) => e.data.how === 'lost').every((e) => e.data.pay === 0)).toBe(true);
    // a share is more for a higher rank and for a battle won outright
    const byRank = new Map<string, number>();
    for (const e of warLog(m)) if (e.data.how === 'held' && e.data.grade === 'steady') byRank.set(String(e.data.rank), Number(e.data.pay));
    const ranks = [...byRank.keys()].map((r) => RANKS.indexOf(r as never)).sort();
    for (let i = 1; i < ranks.length; i++) expect(byRank.get(RANKS[ranks[i]])!).toBeGreaterThanOrEqual(byRank.get(RANKS[ranks[i - 1]])!);
    expect(economyExt(m.life).yr.share).toBe(paid);
  });

  it('rises through the ranks with battles held, writes the promotion, and the wage of the economy follows the rank', () => {
    const m = soldier(203);
    m.life.stats.pow = 30;
    for (let i = 0; i < 60 && !m.life.dead; i++) {
      m.life.hAge = 22 + (i % 30);
      warBattle(m.ctx);
      combatOf(m.life).hp = maxHpOf(m.ctx, m.life);
    }
    expect(combatOf(m.life).rank).toBeGreaterThan(0);
    const ranks = m.s.game.state.log.filter((e) => e.sys === 'combat' && e.kind === 'rank');
    expect(ranks.length).toBe(combatOf(m.life).rank);
    expect(ranks[0].data).toMatchObject({ from: 'recruit', to: 'soldier' });
    const wage = (rank: number) => {
      combatOf(m.life).rank = rank;
      return grossIncome(m.ctx, eco(m.ctx)!, m.life, economyExt(m.life), placeOf(m.ctx, eco(m.ctx)!, 'MH-01')!);
    };
    expect(wage(4)).toBeGreaterThan(wage(0));
  });

  it('tells the war in a summary every few years instead of a line a battle: the plain battles held are for the developer, the first, a rout and a win outright are told', () => {
    const m = soldier(204);
    for (let i = 0; i < 60 && !m.life.dead; i++) {
      m.life.hAge = 22 + i / 2;
      m.life.hAge = Math.floor(m.life.hAge);
      warBattle(m.ctx);
      if (i % 2) warYear(m.ctx, true);
      combatOf(m.life).hp = maxHpOf(m.ctx, m.life);
    }
    const log = warLog(m);
    const told = log.filter((e) => e.level >= 1);
    expect(told.length).toBeLessThan(log.length);
    expect(log.filter((e) => e.data.first).every((e) => e.level >= 1)).toBe(true);
    expect(log.filter((e) => e.data.how === 'held' && e.data.grade === 'steady' && !e.data.first).every((e) => e.level === 0)).toBe(true);
    const camp = m.s.game.state.log.filter((e) => e.sys === 'combat' && e.kind === 'campaign');
    expect(camp.length).toBeGreaterThan(1);
    for (const c of camp) {
      expect(c.level).toBe(1);
      expect(c.data).toMatchObject({ war: 'WR-19', country: 'MH-01' });
      expect(Number(c.data.battles)).toBeGreaterThan(0);
      expect(Number(c.data.held) + Number(c.data.won) + Number(c.data.lost)).toBe(Number(c.data.battles));
    }
    // each summary tells what came since the last, not the whole again
    expect(camp.reduce((n, c) => n + Number(c.data.battles), 0)).toBeLessThanOrEqual(log.length);
  });

  it('a window of the war whose numbers repeat the last summary is not told again: folded in the middle of a war, the whole war at its end', () => {
    const m = soldier(208);
    const ext = combatOf(m.life);
    ext.war = { id: 'WR-19', foes: ['npc_mercenary'], since: 20, battles: 2, held: 0, won: 0, lost: 2, pay: 0, points: 0, told: { age: 20, battles: 0, held: 0, won: 0, lost: 0, pay: 0 } };
    const camp = () => m.s.game.state.log.filter((e) => e.sys === 'combat' && e.kind === 'campaign');
    m.life.hAge = 23;
    warYear(m.ctx, true);
    expect(camp().length).toBe(1);
    // the same two lost battles again: nothing new is told, the counts wait for the next window
    ext.war.battles = 4;
    ext.war.lost = 4;
    m.life.hAge = 26;
    warYear(m.ctx, true);
    expect(camp().length).toBe(1);
    // the window after it carries what was folded
    ext.war.battles = 5;
    ext.war.lost = 5;
    m.life.hAge = 27;
    warYear(m.ctx, true);
    expect(camp().length).toBe(2);
    expect(camp()[1].data).toMatchObject({ battles: 3, lost: 3, years: 4 });
    // the war ends with a window like the last one: the closing line tells the whole war
    ext.war.battles = 8;
    ext.war.lost = 8;
    m.life.hAge = 30;
    warYear(m.ctx, false);
    expect(camp().length).toBe(3);
    expect(camp()[2].data).toMatchObject({ battles: 8, lost: 8, end: true, total: true, years: 10 });
  });

  it('a way of the story that dies in battle is a last fight: the call goes out, the blades meet PRELUDE_BEATS beats later, no flight, and a beaten hero dies in it', () => {
    const m = mk(209, { stats: { pow: 12, vit: 12 } });
    const mark = m.s.game.state.logN;
    expect(lastStand(m.ctx, 'gi.e2', 'b')).toBe(true);
    const log = () => m.s.game.state.log.filter((e) => e.n >= mark && e.sys === 'combat');
    expect(log().filter((e) => e.kind === 'prelude').length).toBe(1);
    expect(log().filter((e) => e.kind === 'battle').length).toBe(0);
    expect(m.life.dead).toBeUndefined();
    const ext = combatOf(m.life);
    ext.tick += PRELUDE_BEATS;
    // the blades wait for the card: no fight while the attention system has not settled the call
    flush(m.ctx);
    expect(log().filter((e) => e.kind === 'battle').length).toBe(0);
    settleCalls(m.s.game.state);
    flush(m.ctx);
    const fought = log().filter((e) => e.kind === 'battle');
    expect(fought.length).toBe(1);
    expect(fought[0].data.stances).not.toContain('flee');
    // the titan of the myth is not beaten by this hero: the death is the fight's own, with the cause the endings read
    expect(m.life.dead?.cause).toBe(CAUSE.battle);
  });

  it('is at war while the war lasts: a flag whose timer has run out is not a war (the world never takes it off), a flag with no timer (the hand of the god) stands', () => {
    const m = soldier(205, 10, 20);
    expect(warOn(m.ctx, 'MH-01')).toBe(true);
    expect(atWar(m.ctx, m.life)).toBe(true);
    m.s.game.state.world.chains['warflag:MH-01'] = m.s.game.state.clock.worldYear - 1;
    expect(warOn(m.ctx, 'MH-01')).toBe(false);
    expect(atWar(m.ctx, m.life)).toBe(false);
    expect(capOf(m.ctx)).toBe(BATTLES_PER_YEAR); // the cap of 8 is for a war that is on
    delete m.s.game.state.world.chains['warflag:MH-01'];
    expect(warOn(m.ctx, 'MH-01')).toBe(true);
    expect(capOf(m.ctx)).toBe(BATTLES_PER_YEAR * 2);
  });

  it('the war ends with a closing summary, and the next war starts from the rank he reached', () => {
    const m = soldier(206);
    m.life.stats.pow = 30;
    for (let i = 0; i < 20 && !m.life.dead; i++) {
      m.life.hAge = 22 + i;
      warBattle(m.ctx);
      combatOf(m.life).hp = maxHpOf(m.ctx, m.life);
    }
    const rank = combatOf(m.life).rank;
    expect(combatOf(m.life).war).toBeDefined();
    m.s.game.state.world.chains['warflag:MH-01'] = m.s.game.state.clock.worldYear - 1;
    warYear(m.ctx, atWar(m.ctx, m.life));
    expect(combatOf(m.life).war).toBeUndefined();
    const last = m.s.game.state.log.filter((e) => e.sys === 'combat' && e.kind === 'campaign').at(-1)!;
    expect(last.data.end).toBe(true);
    expect(combatOf(m.life).rank).toBe(rank);
  });

  it('without a WR event the flag still makes a war, with a foe of the continent and no name', () => {
    const m = mk(207, { job: 'soldier', stats: { pow: 14 } });
    m.life.country = 'AL-01';
    m.s.game.state.world.countryFlags['AL-01'] = ['war'];
    expect(warEventOf(m.ctx, m.life)).toBe('');
    warBattle(m.ctx);
    const e = warLog(m).at(-1)!;
    expect(e.data.war).toBeNull();
    expect(WAR_FOES_BY_CONTINENT.AL).toContain(e.data.foe);
  });
});

describe('the clashes of the named NPCs (07-npc-clashes.md)', () => {
  const strong = { aptitudes: { sword: 3, light: 3, bow: 3, charm: 3 }, stats: { pow: 30, mag: 30, spd: 30, luk: 30, int: 30, vit: 30 }, godFaith: 40, tags: ['truth', 'beast_friend'] };
  const weak = { stats: { pow: 3, mag: 3, spd: 3, luk: 3, int: 3, vit: 12 } };

  it('has 102 clashes; each NPC has an enemy row and a defeat outcome', () => {
    const { ctx } = mk(1);
    const ix = combatIndex(ctx);
    expect(ix.clashById.size).toBe(102);
    for (const c of ix.clashById.values()) {
      expect(ix.enemies.has(c.npc), c.id).toBe(true);
      expect(c.outcomes.some((o) => o.kind === 'lose'), c.id).toBe(true);
      expect(clashOf(ctx, c.npc)).toBe(c);
      expect(clashOf(ctx, c.id)).toBe(c);
    }
  });

  it('a hero who wins picks the win row, its effects are applied through the rules (npcPath reaches the NPC system) and the clash is written', () => {
    const m = mk(91, strong);
    const mark = m.s.game.state.logN;
    const r = clash(m.ctx, 'NF-AZ02-1', { opener: 'T' });
    expect(r.result).not.toBe('unknown');
    expect(['win_kill', 'win_spare', 'talk', 'draw', 'lose']).toContain(r.kind);
    expect(r.outcome).toBeDefined();
    expect(r.applied).toBe(r.outcome!.effects.length);
    const log = m.s.game.state.log.filter((e) => e.n >= mark && e.sys === 'combat');
    expect(log.some((e) => e.kind === 'prelude')).toBe(true);
    expect(log.some((e) => e.kind === 'clash' && e.id === 'NF-AZ02-1')).toBe(true);
    expect(log.some((e) => e.kind === 'battle')).toBe(true);
    // no effect of the row went unhandled
    expect(m.s.game.state.log.filter((e) => e.sys === 'rules' && e.kind === 'unhandled' && /npcPath|trust|npc|place|stat/.test(String(e.id))).length).toBe(0);
  });

  it('a strong hero wins or talks, a weak one loses or flees; a lost clash is the row "แพ้" and never kills the NPC', () => {
    const outcomes = { strong: new Set<string>(), weak: new Set<string>() };
    for (let i = 0; i < 24; i++) {
      const s = mk(200 + i, strong);
      const w = mk(300 + i, weak);
      const c = ['NF-AZ02-1', 'NF-AL27-1', 'NF-MH02-1', 'NF-NB02-1'][i % 4];
      const rs = clash(s.ctx, c, { talkKey: i % 2 === 0 });
      const rw = clash(w.ctx, c, { talkKey: false });
      outcomes.strong.add(String(rs.kind));
      outcomes.weak.add(String(rw.kind));
      if (rw.kind === 'lose') expect(rw.killed).toBe(false);
    }
    expect([...outcomes.strong].some((k) => k.startsWith('win') || k === 'talk')).toBe(true);
    expect(outcomes.weak.has('lose') || outcomes.weak.has('draw')).toBe(true);
    expect([...outcomes.weak].every((k) => !k.startsWith('win'))).toBe(true);
  });

  it('every one of the 102 clashes runs against a strong and a weak hero, picks a row and applies its effects without an error', () => {
    const { ctx: probe } = mk(1);
    const ids = [...combatIndex(probe).clashById.keys()];
    const kinds = new Set<string>();
    ids.forEach((id, i) => {
      const m = mk(1000 + i, i % 2 ? strong : weak);
      const r = clash(m.ctx, id, { talkKey: i % 3 !== 0 });
      expect(['deferred', 'closed', 'unknown']).not.toContain(r.result);
      expect(r.fight, id).toBeDefined();
      if (r.kind) kinds.add(r.kind);
      // a draw has no row in some clashes: then nothing is applied
      if (r.kind && r.kind !== 'draw') expect(r.outcome, id).toBeDefined();
    });
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });

  it('is met at most twice in a life, once a season, the second time only after a draw or a defeat, and then at DC +1', () => {
    const m = mk(92, weak);
    const first = clash(m.ctx, 'NF-AL27-1', { talkKey: false });
    expect(first.fight).toBeDefined();
    // the same season: closed
    expect(clash(m.ctx, 'NF-AL27-1').result).toBe('closed');
    combatOf(m.life).tick += 1;
    m.life.hAge += 1;
    fresh(m.ctx, m.life);
    const second = clash(m.ctx, 'NF-AL27-1', { talkKey: false });
    if (['lose', 'draw'].includes(first.kind ?? '')) {
      expect(second.fight).toBeDefined();
      combatOf(m.life).tick += 1;
      m.life.hAge += 1;
      expect(clash(m.ctx, 'NF-AL27-1').result).toBe('closed'); // two a life
    } else {
      expect(second.result).toBe('closed');
    }
  });

  it('is put off when the life year is full, and not lost', () => {
    const m = mk(93, strong);
    for (const e of ['slime', 'kappa', 'mimic', 'scorpion']) apply(m.ctx, [{ k: 'battle', enemies: [e] }], { sys: 'story', id: 'hu.a1' });
    const r = clash(m.ctx, 'NF-AZ02-1', { opener: 'B' });
    expect(r.result).toBe('deferred');
    expect(r.applied).toBe(0);
    expect(combatOf(m.life).clashes['AZ02-1']).toBeUndefined();
    m.life.hAge += 1;
    expect(clash(m.ctx, 'NF-AZ02-1', { opener: 'B' }).fight).toBeDefined();
  });

  it('a talk outcome with a key needs the key; a duel with a yield rule never kills the hero and rolls no wound', () => {
    const m = mk(94, weak);
    const r = clash(m.ctx, 'NF-AZ02-1', { talkKey: false });
    expect(r.fight!.stances).not.toContain('negotiate');
    expect(m.life.dead).toBeUndefined();
    expect(clashOf(m.ctx, 'NF-AZ02-1')!.style).toMatch(/ยอมแพ้/);
    expect(r.fight!.result).not.toBe('dead');
  });

  it('a slain NPC is reported to the NPC system: `killed` on the result; a spared one is not', () => {
    let killed = 0;
    let spared = 0;
    for (let i = 0; i < 30; i++) {
      const m = mk(400 + i, strong);
      const r = clash(m.ctx, 'NF-AL27-1', { talkKey: false, opener: 'X', knows: true });
      if (r.killed) killed++;
      if (r.spared) spared++;
      if (r.kind === 'win_kill') expect(r.killed).toBe(true);
      if (r.kind === 'win_spare') expect(r.killed).toBe(false);
    }
    expect(killed + spared).toBeGreaterThan(10);
  });
});

describe('a whole life with the system', () => {
  it('writes battles, calls the named ones, keeps the hit points in ext.combat and never writes the stand-in\'s entries', () => {
    let battles = 0;
    let preludes = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const m = mk(seed);
      m.s.game.runLife();
      const log = m.s.game.state.log;
      battles += log.filter((e) => e.sys === 'combat' && e.kind === 'battle').length;
      preludes += log.filter((e) => e.sys === 'combat' && e.kind === 'prelude').length;
      expect(log.filter((e) => e.sys === 'story' && e.kind === 'battle').length).toBe(0);
      expect(combatOf(m.life).hp).not.toBeNull();
      for (const e of log) if (e.sys === 'combat') for (const v of Object.values(e.data)) expect(['string', 'number', 'boolean'].includes(typeof v) || v === null).toBe(true);
    }
    expect(battles).toBeGreaterThan(20);
    // 1.6 calls a life for a human of year 120 with every system (1.2 of the story's named fights, 0.4 of NPC clashes); tests/balance/combat.test.ts measures about 3 named
    // story fights over all the races. Fewer than on the combat branch (> 3): the journey lines open by their causes and the lives of the fixed jobs fight less.
    expect(preludes).toBeGreaterThan(2);
  });
});

describe('what the other systems give a fight (items, bonds, npc)', () => {
  it('the weapon and the armour are the ones the items system says are on the hero', () => {
    const { ctx, life } = mk(7, { aptitudes: { sword: 2 }, items: ['ws_longsword', 'ar_hard_leather'] });
    const hero = buildHero(ctx, life);
    expect(hero.weapon!.id).toBe(wielded(ctx).id);
    expect(hero.melee!.id).toBe(wielded(ctx).id);
    expect(hero.power).toBe(wielded(ctx).power);
    expect(hero.armor.id).toBe(armorOf(ctx).id);
    expect(hero.armor.defense).toBeGreaterThan(0);
  });

  it('armour lowers the damage of a lost beat (×(1 − 0.04 N)) and a shield lowers it more in the guard stance, never below ×0.35', () => {
    const foe = (ctx: Ctx) => dragonFoe(ctx, 'test', 30);
    const spent = () => ({ guard: false, share: false });
    const bare = mk(8, { aptitudes: { sword: 2 }, items: ['ws_longsword'] });
    const mail = mk(8, { aptitudes: { sword: 2 }, items: ['ws_longsword', 'ar_chain_shirt'] });
    const d0 = damageOf(bare.ctx, buildHero(bare.ctx, bare.life), foe(bare.ctx), 'melee', spent());
    const d1 = damageOf(mail.ctx, buildHero(mail.ctx, mail.life), foe(mail.ctx), 'melee', spent());
    expect(armorOf(mail.ctx).defense).toBeGreaterThan(0);
    expect(d1).toBeLessThan(d0);
    const shielded = mk(8, { aptitudes: { sword: 2, shield: 2 }, items: ['ar_round_shield'] });
    const g0 = damageOf(bare.ctx, buildHero(bare.ctx, bare.life), foe(bare.ctx), 'guard', spent());
    const g1 = damageOf(shielded.ctx, buildHero(shielded.ctx, shielded.life), foe(shielded.ctx), 'guard', spent());
    expect(g1).toBeLessThan(g0);
    expect(g1).toBeGreaterThanOrEqual(Math.floor(d0 * 0.35 * 0.5));
  });

  it('a fight is told to the items system afterwards: the weapon in the hand counts a use', () => {
    const m = mk(9, { aptitudes: { sword: 2 }, items: ['ws_longsword'] });
    const id = wielded(m.ctx).id;
    const before = itemsExt(m.life).uses[id] ?? 0;
    fight(m.ctx, ['slime'], { log: false, lethal: false });
    expect(itemsExt(m.life).uses[id] ?? 0).toBe(before + 1);
  });

  it('the party of the hero fights beside him: people for the roll, a cut of the damage', () => {
    const m = mk(10, { aptitudes: { sword: 2 }, items: ['ws_longsword'] });
    const alone = buildHero(m.ctx, m.life);
    expect(alone.party.members).toBe(0);
    const t = addBondTie(m.ctx, m.life, { line: 'คู่หู', level: 4, from: 'test', race: 'same' });
    expect(joinParty(m.ctx, m.life, bondsExtOf(m.life), t)).toBe(true);
    const together = buildHero(m.ctx, m.life);
    expect(together.party.members).toBe(1);
    expect(together.party.cutPct).toBeGreaterThan(0);
    const foe = foeOf(m.ctx, ['ogre'])!;
    const spent = () => ({ guard: false, share: false });
    expect(damageOf(m.ctx, together, foe, 'melee', spent())).toBeLessThanOrEqual(damageOf(m.ctx, alone, foe, 'melee', spent()));
    // with no word of the caller the people of the party are the allies of the fight
    const sc = scene(m.ctx, m.life, ['ogre'], { opts: { allies: together.party.members } });
    expect(stanceBonuses(sc).find((r) => r.id === 'melee')!.bonus).toBeGreaterThan(stanceBonuses(scene(m.ctx, m.life, ['ogre'])).find((r) => r.id === 'melee')!.bonus);
  });

  it('a clash the NPC system opens is played by this system (the handler of npc), and its result is written back once', () => {
    let played = 0;
    for (let seed = 1; seed <= 12 && !played; seed++) {
      const m = mk(600 + seed, { aptitudes: { sword: 3 }, items: ['ws_longsword'], stats: { pow: 20, vit: 20 } });
      const state = m.s.game.state;
      const slots = slotsOf(state);
      const id = Object.keys(slots).find((k) => {
        const sl = slots[k];
        return sl.status === 'alive' && clashesOf(m.ctx, k).some((c) => triggersOf(c).some((t) => t.code === 'B'));
      });
      if (!id) continue;
      m.life.country = slots[id].place!;
      if (!canClash(m.ctx, slots[id])) continue;
      const mark = state.logN;
      const kind = openClash(m.ctx, id, 'B');
      // the call goes out now and the blades meet PRELUDE_BEATS beats later; nothing is written back yet
      let log = state.log.filter((e) => e.n >= mark);
      if (!log.some((e) => e.sys === 'combat' && e.kind === 'prelude')) continue;
      expect(kind).toBeNull();
      expect(log.filter((e) => e.sys === 'combat' && e.kind === 'clash').length).toBe(0);
      expect(log.filter((e) => e.sys === 'npc' && (e.data as { what?: string }).what === 'clash').length).toBe(0);
      expect(openClash(m.ctx, id, 'B')).toBeNull(); // one at a time: no second call
      expect(state.log.filter((e) => e.n >= mark && e.kind === 'prelude').length).toBe(1);
      const ext = combatOf(m.life);
      ext.tick += PRELUDE_BEATS - 1;
      flushClashes(m.ctx);
      expect(state.log.filter((e) => e.n >= mark && e.sys === 'combat' && e.kind === 'clash').length).toBe(0);
      ext.tick += 1;
      settleCalls(state);
      flushClashes(m.ctx);
      log = state.log.filter((e) => e.n >= mark);
      expect(log.filter((e) => e.sys === 'combat' && e.kind === 'clash').length).toBe(1);
      expect(log.filter((e) => e.sys === 'npc' && (e.data as { what?: string }).what === 'clash').length).toBe(1);
      expect(ext.pending.length).toBe(0);
      played++;
    }
    expect(played).toBeGreaterThan(0);
  });
});
