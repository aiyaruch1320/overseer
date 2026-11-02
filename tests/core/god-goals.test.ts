// The goals (god/08-goals.md, G6b): the vows are offered by the seed (a replay offers the same), taken, changed once at 15 and judged at death; a life gets one to three titles;
// the chronicle of the lineage grows by a line and opens things; the carry goes from world to world; the rhythm of fate and the price of too much help.
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, runToDeath, startLife } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { command } from '../../src/core/command';
import type { Game, GameData } from '../../src/core/game';
import type { GodData } from '../../src/core/data/types-god';
import {
  JUDGE,
  applyCarry,
  chooseRhythm,
  checkRhythm,
  corner,
  crossed,
  fits,
  freshMeta,
  gainOf,
  goalsCarry,
  goalsOf,
  lifeGoals,
  overreachMul,
  pool,
  pullOn,
  rhythmMul,
  rhythms,
  titlesHeld,
  titlesOf,
  unlockedAt,
  type Facts,
} from '../../src/core/god/goals';
import { TEST, THRESH } from '../../src/core/god/goals/titles';
import { armNode, settleNode } from '../../src/core/god/goals/rhythm';
import { extOf as storyExt } from '../../src/core/story/state';
import { factsOf } from '../../src/core/god/goals';
import { godGoalsSystem } from '../../src/core/god/goals';
import { tablesOf } from '../../src/core/world';

const god_beat = (ctx: Game['ctx'], _life: LifeState) => godGoalsSystem.beat!(ctx);
import type { GameState, LifeState } from '../../src/core/types';

let data: GameData;
let god: GodData;
beforeAll(() => {
  data = loadAll();
  god = data.god.items as GodData;
});

function mk(seed = 1, points = 0, race = 'hu'): { g: Game; st: GameState; ctx: Game['ctx']; life: LifeState } {
  const s = createSession(data, { seed, race, startYear: 120 });
  const st = s.game.state;
  applyCarry(st, { ...freshMeta(), points });
  const life = startLife(s);
  return { g: s.game, st, ctx: s.game.ctx, life };
}

const offers = (l: LifeState) => lifeGoals(l).offers;
const pick = (c: Game['ctx'], n: number, confirm = true) => command(c, { type: 'god', action: 'vow.pick', args: { pick: n }, confirm });

describe('the data', () => {
  it('has the 20 vows, the 16 titles and the thresholds the code reads', () => {
    expect(god.goals.vows.length).toBe(20);
    expect(god.goals.titles.length).toBe(16);
    expect(god.goals.chronicle).toEqual({ vowDone: 3, vowFail: 1, perTitle: 1, perMilestone: 2, firstLife: 1 });
    expect(Object.keys(JUDGE).sort()).toEqual(god.goals.vows.map((v) => v.id).sort());
    expect(Object.keys(TEST).sort()).toEqual(god.goals.titles.map((t) => t.title).sort());
    const cond = (t: string) => god.goals.titles.find((x) => x.title === t)!.cond;
    expect(cond('ผู้รบ')).toContain(String(THRESH.fights));
    expect(cond('ผู้รอฟ้า')).toContain(String(THRESH.gifts));
    expect(cond('ผู้ขัดขืนฟ้า')).toContain('ห้า');
    expect(cond('นักเดินทาง')).toContain('ห้า');
  });
});

describe('the vows offered', () => {
  it('are three, different, from the first set while the chronicle is under 10, and the same for the same seed', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const a = mk(seed);
      const b = mk(seed);
      expect(offers(a.life).length).toBe(3);
      expect(new Set(offers(a.life)).size).toBe(3);
      expect(offers(a.life)).toEqual(offers(b.life));
      for (const id of offers(a.life)) expect(Number(id.slice(3))).toBeLessThanOrEqual(12);
      expect(a.st.god.vows).toEqual([]);
    }
  });

  it('the second set joins at 10 points of the chronicle, and a vow that cannot be done is not offered', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const { life, ctx } = mk(seed, 10);
      for (const id of offers(life)) seen.add(id);
      expect(pool(ctx, life)).not.toContain('GV-13'); // no bad fate in the life
      if (!lifeGoals(life).track.boundAtBirth) expect(pool(ctx, life)).not.toContain('GV-14');
      expect(pool(ctx, life)).not.toContain('GV-20');
    }
    expect([...seen].some((id) => Number(id.slice(3)) > 12)).toBe(true);
    const first = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) for (const id of offers(mk(seed, 9).life)) first.add(id);
    expect([...first].every((id) => Number(id.slice(3)) <= 12)).toBe(true);
  });

  it('weigh three times more the vow that fits the omen of the birth', () => {
    const { life, ctx } = mk(1);
    const c = life.ext.character as { sign: string; special?: string };
    c.sign = 'comet';
    delete c.special;
    expect([...fits(ctx, life)]).toEqual(expect.arrayContaining(['GV-09', 'GV-15']));
    c.sign = 'none';
    c.special = 'reincarnated';
    expect([...fits(ctx, life)]).toEqual(expect.arrayContaining(['GV-13', 'GV-10']));
  });
});

describe('taking a vow', () => {
  it('is a command with a preview that changes nothing; 4 is no vow; the corner shows the one taken', () => {
    const { ctx, st, life } = mk(2);
    const before = JSON.stringify({ rng: st.rng, vows: st.god.vows, g: life.ext.goals });
    const r = pick(ctx, 1, false) as unknown as { ok: true; preview: { vow: string; name: string; reward: { kept: number; broken: number } } };
    expect(r.ok).toBe(true);
    expect(r.preview.vow).toBe(offers(life)[0]);
    expect(r.preview.reward).toEqual({ kept: 3, broken: 1 });
    expect(JSON.stringify({ rng: st.rng, vows: st.god.vows, g: life.ext.goals })).toBe(before);
    expect(pick(ctx, 9).ok).toBe(false);
    expect(corner(ctx)).toBeNull();
    expect(pick(ctx, 2).ok).toBe(true);
    expect(st.god.vows).toEqual([offers(life)[1]]);
    expect(corner(ctx)).toBe(god.goals.vows.find((v) => v.id === offers(life)[1])!.name);
    // the first choice stands until the age stop of 15
    expect(pick(ctx, 4, false).ok).toBe(false);
    expect(st.god.vows).toEqual([offers(life)[1]]);
  });

  it('none is a choice too (4 on the table of three)', () => {
    const { ctx, st, life } = mk(2);
    expect(pick(ctx, 4).ok).toBe(true);
    expect(st.god.vows).toEqual([]);
    expect(lifeGoals(life).decided).toBe(true);
    expect(lifeGoals(life).vow).toBeNull();
  });

  it('may be changed once, at the age stop of 15, from a second draw; not before the stop is reached', () => {
    const { ctx, st, life, g } = mk(3);
    expect(pick(ctx, 1).ok).toBe(true);
    life.hAge = 14;
    for (let i = 0; i < 4 * 3 && life.hAge < 15 && !life.dead; i++) g.beat();
    expect(life.hAge).toBe(15);
    const g2 = lifeGoals(life);
    expect(g2.reoffers.length).toBe(3);
    expect(pick(ctx, 1).ok).toBe(true);
    expect(g2.changed).toBe(true);
    expect(st.god.vows).toEqual([g2.reoffers[0]]);
    expect(pick(ctx, 2).ok).toBe(false);
  });

  it('cannot be picked after 15 when none was taken before', () => {
    const { ctx, life } = mk(4);
    life.hAge = 20;
    expect(pick(ctx, 1, false).ok).toBe(false);
  });
});

/** Facts of a life that kept nothing, to be changed by a test. */
function blank(over: Partial<Facts> = {}): Facts {
  return {
    life: {} as LifeState, hAge: 40, cause: 'illness', natural: false, battle: false, elder: false, belief: 0, peak: 0, curses: 0, born: 'AZ-01', where: 'AZ-01', continents: ['AZ'], countries: ['AZ-01'],
    heir: false, love: 0, rivalFell: false, forgave: false, betrayals: 0, killedKin: false, secret: false, legend: false, cv: 0, kind: 0, interventions: 0, boundNow: false, wasBound: false, freed: false,
    dragon: false, homeLost: false, built: false, keySide: false, badFate: false, ...over,
  };
}

describe('the judgement', () => {
  const kept = (id: string, f: Facts) => JUDGE[id](f);
  it('reads each vow from the facts of the life', () => {
    expect(kept('GV-01', blank({ natural: true, hAge: 60 }))).toBe(true);
    expect(kept('GV-01', blank({ natural: true, hAge: 50 }))).toBe(false);
    expect(kept('GV-02', blank())).toBe(true);
    expect(kept('GV-02', blank({ battle: true }))).toBe(false);
    expect(kept('GV-02', blank({ curses: 1 }))).toBe(false);
    expect(kept('GV-02', blank({ belief: -1 }))).toBe(false);
    expect(kept('GV-03', blank({ continents: ['AZ', 'MH'] }))).toBe(true);
    expect(kept('GV-03', blank())).toBe(false);
    expect(kept('GV-04', blank({ continents: ['AZ', 'MH', 'KD', 'NR'] }))).toBe(true);
    expect(kept('GV-04', blank({ continents: ['AZ', 'MH', 'KD'] }))).toBe(false);
    expect(kept('GV-05', blank({ heir: true }))).toBe(true);
    expect(kept('GV-06', blank({ love: 4 }))).toBe(true);
    expect(kept('GV-06', blank({ love: 3 }))).toBe(false);
    expect(kept('GV-07', blank({ rivalFell: true }))).toBe(true);
    expect(kept('GV-08', blank({ forgave: true }))).toBe(true);
    expect(kept('GV-09', blank({ cv: 2 }))).toBe(true);
    expect(kept('GV-09', blank({ cv: 1 }))).toBe(false);
    expect(kept('GV-09', blank({ secret: true }))).toBe(true);
    expect(kept('GV-10', blank({ kind: 30 }))).toBe(true);
    expect(kept('GV-10', blank({ kind: 30, cv: 1 }))).toBe(false);
    expect(kept('GV-11', blank({ peak: 85, belief: 10 }))).toBe(true);
    expect(kept('GV-11', blank({ peak: 84 }))).toBe(false);
    expect(kept('GV-12', blank({ interventions: 5 }))).toBe(true);
    expect(kept('GV-12', blank({ interventions: 6 }))).toBe(false);
    expect(kept('GV-14', blank({ wasBound: true, freed: true }))).toBe(true);
    expect(kept('GV-14', blank({ wasBound: true, freed: true, boundNow: true }))).toBe(false);
    expect(kept('GV-16', blank())).toBe(true);
    expect(kept('GV-16', blank({ homeLost: true }))).toBe(false);
    expect(kept('GV-19', blank({ belief: -70, hAge: 55 }))).toBe(true);
    expect(kept('GV-19', blank({ belief: -70, hAge: 54 }))).toBe(false);
    expect(kept('GV-19', blank({ belief: -69, hAge: 70 }))).toBe(false);
  });
});

describe('a life ends', () => {
  it('judges the vow, gives titles, writes a line of the chronicle and adds its points; the first life of the lineage gets +1', () => {
    const { g, st, ctx, life } = mk(5);
    expect(pick(ctx, 4).ok).toBe(true);
    runToDeath(g);
    expect(life.dead).toBeTruthy();
    const w = goalsOf(st);
    expect(w.lives).toBe(1);
    expect(w.meta.lines.length).toBe(1);
    const line = w.meta.lines[0];
    expect(line.life).toBe(life.id);
    expect(line.vowResult).toBe('none');
    expect(line.titles.length).toBeLessThanOrEqual(3);
    expect(line.gain).toBe(line.titles.length * 1 + Object.values(line.milestones).reduce((a, b) => a + b, 0) * 2 + 1);
    expect(w.meta.points).toBe(line.gain);
    expect(line.text).toContain(life.name);
    expect(st.log.some((e) => e.kind === 'lineage')).toBe(true);
    for (const t of line.titles) expect(w.meta.titlesSeen).toContain(t);
  });

  it('keeps or breaks the vow and the points follow (kept +3, broken +1)', () => {
    const c = mk(6);
    const l = c.life;
    const g = lifeGoals(l);
    g.vow = 'GV-12';
    runToDeath(c.g);
    const line = goalsOf(c.st).meta.lines[0];
    const f = factsOf(c.ctx, l);
    expect(line.vowResult).toBe(JUDGE['GV-12'](f) ? 'kept' : 'broken');
    expect(line.gain).toBeGreaterThanOrEqual(line.vowResult === 'kept' ? 3 : 1);
    if (line.vowResult === 'kept') expect(goalsOf(c.st).meta.vowsKept).toContain('GV-12');
    expect(c.st.log.some((e) => e.kind === 'vow.result')).toBe(true);
  });

  it('opens what the chronicle opens when a threshold is crossed (a line of the log says so)', () => {
    const { g, st } = mk(7, 4);
    runToDeath(g);
    const total = goalsOf(st).meta.points;
    expect(total).toBeGreaterThanOrEqual(5);
    expect(st.log.some((e) => e.kind === 'unlock' && e.id === '5')).toBe(true);
    expect(crossed(4, total).map((u) => u.at)).toContain(5);
  });

  it('replaying a life with the same seed gives the same vows and the same line of the chronicle', () => {
    const run = (seed: number) => {
      const c = mk(seed, 0);
      pick(c.ctx, 1);
      runToDeath(c.g);
      return { offers: offers(c.life), line: goalsOf(c.st).meta.lines[0] };
    };
    for (const seed of [2, 3]) expect(run(seed)).toEqual(run(seed));
  });
});

describe('the carry', () => {
  it('is plain JSON that goes from a world to the next and starts the first life of the new world with +1 again', () => {
    const a = mk(8, 0);
    runToDeath(a.g);
    const carry = goalsCarry(a.st);
    expect(JSON.parse(JSON.stringify(carry))).toEqual(carry);
    expect(carry.lines.length).toBe(1);
    // a copy: changing the state does not change the carry
    goalsOf(a.st).meta.points += 100;
    expect(carry.points).toBeLessThan(goalsOf(a.st).meta.points);
    const b = mk(9, 0);
    applyCarry(b.st, carry);
    expect(goalsOf(b.st).meta.points).toBe(carry.points);
    expect(goalsOf(b.st).meta.lines.length).toBe(1);
    expect(goalsOf(b.st).lives).toBe(0);
    expect(goalsOf(b.st).carried).toBe(1);
  });
});

describe('what the chronicle opens', () => {
  it('opens the verbs, the cores, the second vows, the rhythms by the thresholds', () => {
    const at = (p: number) => unlockedAt({ data } as never, p);
    expect(at(0).verbs.size).toBe(3);
    expect(at(5).verbs.has('change')).toBe(true);
    expect(at(10).vowSet2).toBe(true);
    expect(at(9).vowSet2).toBe(false);
    expect(at(15).cores.has('light')).toBe(true);
    expect(at(19).rhythms).toBe(false);
    expect(at(20).rhythms).toBe(true);
    expect(at(30).cores.size).toBe(8);
    expect(at(40).startModes).toBe(true);
  });
});

describe('the rhythm of fate and the price of too much help', () => {
  it('has four rhythms and the three that change things open at 20 points', () => {
    const { ctx } = mk(1, 0);
    expect(rhythms(ctx).length).toBe(4);
    expect(checkRhythm(ctx, 'natural')).toBeNull();
    expect(checkRhythm(ctx, 'gentle')).not.toBeNull();
    const b = mk(1, 20);
    expect(checkRhythm(b.ctx, 'gentle')).toBeNull();
    expect(checkRhythm(b.ctx, 'nope')).not.toBeNull();
  });

  it('is chosen with `vow.pick { rhythm }` when the world begins, once the chronicle has opened it', () => {
    const a = mk(1, 0);
    const ask = (c: Game['ctx'], rhythm: string, confirm = true) => command(c, { type: 'god', action: 'vow.pick', args: { rhythm }, confirm });
    expect(ask(a.ctx, 'gentle', false).ok).toBe(false);
    const b = mk(1, 20);
    const pv = ask(b.ctx, 'gentle', false) as unknown as { ok: true; preview: { rhythm: string; from: string } };
    expect(pv.ok).toBe(true);
    expect(pv.preview).toMatchObject({ rhythm: 'gentle', from: 'natural' });
    expect(ask(b.ctx, 'gentle').ok).toBe(true);
    expect(rhythmMul(b.ctx, 'badFate')).toBe(0.7);
    b.life.hAge = 10;
    expect(ask(b.ctx, 'sorrow', false).ok).toBe(false);
  });

  it('changes the weight of the ways of the story by the words of the way, and nothing of the world', () => {
    const { ctx } = mk(1, 20);
    expect(rhythmMul(ctx, 'closeDeath')).toBe(1);
    expect(pullOn(ctx, 'แม่ตาย')).toBe(1);
    chooseRhythm(ctx, 'gentle');
    expect(rhythmMul(ctx, 'closeDeath')).toBe(0.6);
    expect(rhythmMul(ctx, 'randomBattle')).toBe(0.7);
    expect(pullOn(ctx, 'พี่ชายตาย')).toBeCloseTo(0.6);
    expect(pullOn(ctx, 'ไปทำนา')).toBe(1);
    chooseRhythm(ctx, 'sorrow');
    expect(pullOn(ctx, 'สูญเสียบ้าน')).toBeCloseTo(1.5);
    expect(rhythmMul(ctx, 'prayerRate')).toBe(1.3);
    chooseRhythm(ctx, 'irony');
    expect(rhythmMul(ctx, 'ironic')).toBe(2);
    expect(rhythmMul(ctx, 'misread')).toBe(1.5);
  });

  it('puts its pulls on the ways of a node the story is about to decide, and takes them off after', () => {
    const { ctx, life } = mk(1, 20);
    const node = { id: 'zz.t1', choices: [{ key: 'a', label: 'พี่ชายตาย' }, { key: 'b', label: 'ไปทำนา' }, { key: 'c', label: 'ฝึกวิชา' }] } as never;
    armNode(ctx, node);
    expect(storyExt(life).entryMods).toEqual([]);
    chooseRhythm(ctx, 'gentle');
    armNode(ctx, node);
    expect(storyExt(life).entryMods.map((m) => [m.to, m.choice, m.mul])).toEqual([['zz.t1', 'a', 0.6]]);
    settleNode(ctx);
    expect(storyExt(life).entryMods).toEqual([]);
  });

  it('counts the gifts: ×0.9 at 10, ×0.8 at 15, and back to 1 after ten years without one', () => {
    const { ctx, st, life } = mk(1);
    st.god.counters['l.gifts'] = 9;
    expect(overreachMul(ctx)).toBe(1);
    st.god.counters['l.gifts'] = 10;
    lifeGoals(life).track.lastGift = life.hAge;
    expect(overreachMul(ctx)).toBe(0.9);
    expect(pullOn(ctx, 'ฝึกวิชา')).toBeCloseTo(0.9);
    expect(pullOn(ctx, 'อยู่บ้าน')).toBe(1);
    st.god.counters['l.gifts'] = 15;
    expect(overreachMul(ctx)).toBe(0.8);
    life.hAge += 10;
    expect(overreachMul(ctx)).toBe(1);
  });
});

describe('the titles', () => {
  it('hold when the life says so', () => {
    const { ctx, st, life } = mk(1);
    life.hAge = 40;
    expect(titlesHeld(ctx, life)).toContain('ผู้อยู่ที่เดิม');
    life.hAge = 8; // a child who died has not stayed
    expect(titlesHeld(ctx, life)).not.toContain('ผู้อยู่ที่เดิม');
    life.hAge = 40;
    const t = lifeGoals(life).track;
    t.adult = 10;
    t.years50 = 6;
    expect(titlesHeld(ctx, life)).toContain('ผู้ศรัทธา');
    t.years50 = 5;
    expect(titlesHeld(ctx, life)).not.toContain('ผู้ศรัทธา');
    st.god.counters['l.gifts'] = 16;
    expect(titlesHeld(ctx, life)).toContain('ผู้รอฟ้า');
    st.god.counters['l.gifts'] = 15;
    expect(titlesHeld(ctx, life)).not.toContain('ผู้รอฟ้า');
    life.cls = 'class 1';
    t.cls0 = 3;
    expect(titlesHeld(ctx, life)).toContain('ผู้ตกต่ำ');
    life.secretJob = 'swordsaint';
    expect(titlesHeld(ctx, life)).toContain('ผู้เป็นตำนาน');
    expect(gainOf(ctx, 'kept', 2, { cv: 1, secret: 1, legend: 0, ending: 0 }, true).total).toBe(3 + 2 + 4 + 1);
    expect(gainOf(ctx, 'broken', 0, { cv: 0, secret: 0, legend: 0, ending: 0 }, false).total).toBe(1);
  });
});

describe('the titles of a lineage (M4 review T1)', () => {
  it('a lack is told once by a lineage and gives way to a deed; a title the lineage has not earned comes first', () => {
    const { ctx, st, life } = mk(1);
    life.hAge = 40;
    const t = lifeGoals(life).track;
    // nothing else covers the life: the lacks stand
    expect(titlesOf(ctx, life)).toEqual(['ผู้ไม่มีใครเห็น', 'ผู้อยู่ที่เดิม']);
    // a deed covers it: the lack goes
    life.cls = 'class 1';
    t.cls0 = 3;
    expect(titlesOf(ctx, life)).toEqual(['ผู้ตกต่ำ']);
    life.cls = 'class 3';
    // the lineage already earned the lacks: the next life of the family has none
    goalsOf(st).meta.titlesSeen.push('ผู้อยู่ที่เดิม', 'ผู้ไม่มีใครเห็น');
    expect(titlesOf(ctx, life)).toEqual([]);
    // two deeds: the one the lineage has not earned goes first
    life.cls = 'class 5';
    t.cls0 = 3;
    st.god.counters['l.gifts'] = 16;
    goalsOf(st).meta.titlesSeen.push('ผู้รอฟ้า');
    expect(titlesOf(ctx, life)).toEqual(['ผู้มั่งคั่ง', 'ผู้รอฟ้า']);
  });

  it('survived the sky: a fall that shakes the whole world does not make every life one who was spared; the country has to be the one that fell', () => {
    const { ctx, st, life } = mk(2);
    const tb = tablesOf(ctx);
    const world = tb.dragons.find((d) => tb.byId.get(d.fallEvent)?.home.world)!;
    st.world.happened[world.fallEvent] = life.birthYear + 1;
    st.world.happened.sky_probe = 0;
    god_beat(ctx, life);
    expect(lifeGoals(life).track.skyBorn).toBe(false);
    const there = tb.dragons.find((d) => !tb.byId.get(d.fallEvent)?.home.world && tb.byId.get(d.fallEvent)?.home.countries.length)!;
    st.world.happened[there.fallEvent] = life.birthYear + 1;
    life.country = tb.byId.get(there.fallEvent)!.home.countries[0];
    god_beat(ctx, life);
    expect(lifeGoals(life).track.skyBorn).toBe(true);
  });

  it('the vow offer names the character who is born, not the one before', () => {
    const { g, st } = mk(3);
    g.beat();
    const e = st.log.find((x) => x.sys === 'god' && x.kind === 'vow.offer')!;
    expect(e.data.name).toBe(st.life!.name);
    expect(e.data.name).not.toBe('');
  });
});
