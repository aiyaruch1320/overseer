// M5 ui: the view models of the character screen and its card (src/app/views/character.ts). Pure over (data, state): they read a real seeded life,
// change nothing, and never show a code to the player.
import { beforeAll, describe, expect, it } from 'vitest';
import { characterCardView, characterView, type CharacterModel } from '../../src/app/views/character';
import { STAT_NAMES } from '../../src/app/views/character-words';
import type { GameData } from '../../src/core/game';
import { leaks } from '../../src/core/text';
import { command } from '../../src/core/command';
import type { Command, GameState } from '../../src/core/types';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, startLife } from '../../scripts/tools/session';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

/** Seeds like the stories of the screen (bonded: a bound, cursed, hurt life; the world's flags changed the lives, so it is seed 77 now, not 24). */
const LIVES = { newborn: [12, 0], warrior: [38, 200], bonded: [77, 81], elder: [17, 250] } as const;
const memo = new Map<string, GameState>();
function life(key: keyof typeof LIVES): GameState {
  const hit = memo.get(key);
  if (hit) return hit;
  const [seed, beats] = LIVES[key];
  const s = createSession(data, { seed });
  startLife(s);
  for (let i = 0; i < beats && s.game.state.life && !s.game.state.life.dead; i++) s.game.beat();
  memo.set(key, s.game.state);
  return s.game.state;
}
const model = (key: keyof typeof LIVES): CharacterModel => characterView(data, life(key)) as CharacterModel;

/** Every string a model holds. */
function strings(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) for (const y of x) strings(y, out);
  else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) if (k !== 'id' && k !== 'key' && k !== 'tone' && k !== 'band') strings(y, out);
  return out;
}

describe('character view', () => {
  it('there is no sheet between lives', () => {
    const s = life('newborn');
    expect(characterView(data, { ...s, life: null })).toBeNull();
    expect(characterCardView(data, { ...s, life: null })).toBeNull();
  });

  it('reading changes nothing in the state', () => {
    for (const k of Object.keys(LIVES) as (keyof typeof LIVES)[]) {
      const s = life(k);
      const before = JSON.stringify(s);
      characterView(data, s);
      characterCardView(data, s);
      expect(JSON.stringify(s)).toBe(before);
    }
  });

  it('a newborn: who, the question of the life, six stats, eight axes, empty gear, free', () => {
    const m = model('newborn');
    expect(m.identity.age).toBe(0);
    expect(m.identity.name).toBeTruthy();
    expect(m.identity.race).toBeTruthy();
    expect(m.identity.where).toBeTruthy();
    expect(m.identity.cls).toBeTruthy();
    expect(m.identity.job).toBe('');
    expect(m.question.length).toBeGreaterThan(10);
    expect(m.stats.map((s) => s.label)).toEqual(Object.values(STAT_NAMES));
    expect(m.stats.every((s) => s.pct >= 0 && s.pct <= 100)).toBe(true);
    expect(m.axes).toHaveLength(8);
    expect(m.gear.slots.map((s) => s.key)).toEqual(['weapon', 'armor', 'acc1', 'acc2', 'charm']);
    expect(m.gear.slots.every((s) => s.item === null)).toBe(true);
    expect(m.standing.bondage.level).toBe(0);
    expect(m.hp.pct).toBe(100);
  });

  it('a grown warrior: a job, aptitudes with their levels, gear in slots with a rarity, gear adds to the stats', () => {
    const m = model('warrior');
    expect(m.identity.job).toBeTruthy();
    expect(m.identity.jobYears).toBeGreaterThan(0);
    expect(m.aptitudes.length).toBeGreaterThan(2);
    const sword = m.aptitudes.find((a) => a.level === 3);
    expect(sword?.levels.filter((l) => l.reached)).toHaveLength(3);
    const weapon = m.gear.slots[0].item;
    expect(weapon).not.toBeNull();
    expect(['C', 'U', 'R', 'E', 'L']).toContain(weapon!.tier);
    expect(weapon!.tierName).toBeTruthy();
    expect(m.stats.some((s) => s.gear !== 0)).toBe(true);
    for (const s of m.stats) expect(s.total).toBe(s.base + s.gear);
    expect(m.gear.carried.length).toBeGreaterThan(0);
  });

  it('a cursed life in bondage: the curses show with their words, the bondage level and the owner', () => {
    const m = model('bonded');
    expect(m.curses.length).toBeGreaterThanOrEqual(1);
    for (const c of m.curses) {
      expect(c.name).toBeTruthy();
      expect(c.effect || c.deltas.length || c.cure).toBeTruthy();
    }
    expect(m.standing.bondage.level).toBeGreaterThan(0);
    expect(m.standing.bondage.name).not.toBe('อิสระ');
    expect(m.standing.bondage.rows.length).toBeGreaterThan(0);
    expect(m.hp.pct).toBeLessThan(100);
    expect(m.identity.faith).toBeTruthy();
  });

  it('an elder sage: the secret job, a high mind, and many aptitudes', () => {
    const m = model('elder');
    expect(m.identity.age).toBeGreaterThanOrEqual(60);
    expect(m.identity.secretJob).toBeTruthy();
    expect(m.stats.find((s) => s.label === STAT_NAMES.int)!.total).toBeGreaterThanOrEqual(20);
    expect(m.aptitudes.length).toBeGreaterThanOrEqual(3);
  });

  it('a companion of the data shows with its tier and abilities', () => {
    const s = life('warrior');
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    (copy.life!.ext.character as { companions: string[] }).companions = ['sp_wolf_pup'];
    const m = characterView(data, copy)!;
    expect(m.companions).toHaveLength(1);
    expect(m.companions[0].name).toBeTruthy();
    expect(m.companions[0].abilities.length).toBeGreaterThan(0);
    expect(characterCardView(data, copy)!.companion).toBe(m.companions[0].name);
  });

  it('the god standing is the belief of the life, with the band in words', () => {
    const s = JSON.parse(JSON.stringify(life('warrior'))) as GameState;
    s.life!.godFaith = 72;
    const m = characterView(data, s)!;
    expect(m.god.belief).toBe(72);
    expect(m.god.bandName).toBeTruthy();
    expect(m.god.tone).toBe('loyal');
    s.life!.godFaith = -80;
    expect(characterView(data, s)!.god.tone).toBe('cold');
  });

  it('a dead life says so', () => {
    const s = JSON.parse(JSON.stringify(life('warrior'))) as GameState;
    s.life!.dead = { year: s.clock.worldYear, hAge: 51, cause: 'age' };
    expect(characterView(data, s)!.dead).toEqual({ age: 51 });
    expect(characterCardView(data, s)!.dead).toBe(true);
  });

  it('the card is a short version of the sheet', () => {
    for (const k of Object.keys(LIVES) as (keyof typeof LIVES)[]) {
      const m = model(k);
      const c = characterCardView(data, life(k))!;
      expect(c.name).toBe(m.identity.name);
      expect(c.top).toHaveLength(3);
      expect(c.top[0].total).toBeGreaterThanOrEqual(c.top[2].total);
      expect(c.gold).toBe(m.standing.gold);
      expect(c.blessings).toBe(m.blessings.length);
      expect(c.curses).toBe(m.curses.length);
      expect(c.hand?.name).toBe(m.gear.slots[0].item?.name);
    }
    expect(characterCardView(data, life('bonded'))!.bound).toBeTruthy();
    expect(characterCardView(data, life('newborn'))!.bound).toBe('');
  });

  it('no code, id or latin word reaches the player in any of the four lives', () => {
    const bad: string[] = [];
    for (const k of Object.keys(LIVES) as (keyof typeof LIVES)[]) {
      for (const t of strings(model(k))) if (t && leaks(t).length) bad.push(`${k}: ${t} [${leaks(t).join(',')}]`);
      for (const t of strings(characterCardView(data, life(k)))) if (t && leaks(t).length) bad.push(`${k} card: ${t}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('M5 fix S7: the vow of the life on the character screen', () => {
  it('shows the vow taken, in words, from birth; and none when none was taken', () => {
    const s = createSession(data, { seed: 12 });
    startLife(s);
    expect(characterView(data, s.game.state)?.vow).toBeNull();
    expect(command(s.game.ctx, { type: 'god', action: 'vow.pick' as Extract<Command, { type: 'god' }>['action'], args: { pick: 1 }, confirm: true }).ok).toBe(true);
    const v = characterView(data, s.game.state)?.vow;
    expect(v?.name).toBeTruthy();
    expect(v?.done).toBeTruthy();
    expect(v?.changeable).toBe(true);
    expect(leaks(String(v?.name) + ' ' + String(v?.done)).filter((x) => x !== "latin word")).toEqual([]);
    expect(v?.result).toBeNull();
  });
});
