import { describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { birth, chooseJob, classNum, characterSystem, evalCond, extOf, grantJob, idx, offerJobs, recomputeDeathAge, rollSecretJobs, secretChance } from '../../src/core/character';
import { yearlyDeath } from '../../src/core/character/death';
import { Game, type Ctx } from '../../src/core/game';
import { apply, test as holds } from '../../src/core/rules';
import { newGame } from '../../src/core/state';
import type { Condition, Effect } from '../../src/core/types';
import type { OriginFile, RacesFile } from '../../src/core/data/types-character';

const data = loadGen();
const origin = data.origin.items as OriginFile;
const races = (data.races.items as RacesFile).races;
const src = { sys: 'test' };

function game(seed: number) {
  return new Game(newGame(seed), data, [characterSystem]);
}
function born(seed: number, opts: Parameters<typeof birth>[1] = {}) {
  const g = game(seed);
  const life = birth(g.ctx, opts);
  g.born();
  return { g, ctx: g.ctx, life };
}
const test = (ctx: Ctx, c: Condition) => holds(ctx, c);
const has = (kind: Extract<Condition, { k: 'has' }>['kind'], id: string, level?: number): Condition => ({ k: 'has', kind, id, ...(level ? { level } : {}) });

describe('birth', () => {
  it('the same seed gives the same life and log, another seed another life', () => {
    const a = born(11);
    const b = born(11);
    expect(JSON.stringify(a.life)).toBe(JSON.stringify(b.life));
    expect(JSON.stringify(a.g.state.log)).toBe(JSON.stringify(b.g.state.log));
    expect(JSON.stringify(born(12).life)).not.toBe(JSON.stringify(a.life));
  });

  it('every race can be born when named, with what 01-origin asks for', () => {
    for (const r of races) {
      const { g, life } = born(5, { race: r.id, second: null });
      const e = extOf(life);
      expect(life.race).toBe(r.id);
      expect(life.lifespan).toBeGreaterThanOrEqual(r.lifespan[0]);
      expect(life.lifespan).toBeLessThanOrEqual(r.lifespan[1]);
      expect(life.hAge).toBe(r.wakes ? 17 : 0);
      expect(idx(g.ctx).countries.has(life.country)).toBe(true);
      expect(life.traits.length).toBeGreaterThanOrEqual(3);
      expect(Object.keys(life.aptitudes).length).toBeGreaterThanOrEqual(1);
      expect(life.skills.length).toBeGreaterThanOrEqual(1);
      expect(e.second).toBeUndefined();
      expect(life.name).toBe('');
      const b = g.state.log.find((x) => x.kind === 'birth')!;
      expect(b.level).toBe(3);
      expect(JSON.stringify(b.data)).not.toContain(String(life.lifespan)); // the lifespan is hidden
      expect(life.dead).toBeUndefined();
    }
  });

  it('keeps the six stats in the race range (plus what the birth gifts add)', () => {
    for (const r of races) {
      const { life } = born(21, { race: r.id, second: null });
      for (const k of ['pow', 'mag', 'spd', 'luk', 'int', 'vit'] as const) {
        const [lo, hi] = r.stats[k];
        expect(life.stats[k]).toBeGreaterThanOrEqual(1);
        expect(life.stats[k]).toBeLessThanOrEqual(hi + 6);
        expect(life.stats[k]).toBeGreaterThanOrEqual(Math.max(1, lo - 6));
      }
    }
  });

  it('draws three traits that do not conflict', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { g, life } = born(seed);
      const ix = idx(g.ctx);
      expect(life.traits.length).toBeGreaterThanOrEqual(3);
      for (const t of life.traits) for (const c of ix.traits.get(t)?.conflicts ?? []) expect(life.traits).not.toContain(c);
    }
  });

  it('keeps to the tables: gender, no half-blood for the races that cannot, the birth lands of the race', () => {
    const none = new Set(origin.noHalf);
    for (let seed = 1; seed <= 150; seed++) {
      const { life } = born(seed);
      const e = extOf(life);
      if (none.has(life.race)) expect(e.second).toBeUndefined();
      if (e.second) {
        const pair = origin.halfPairs.find((p) => p.main === life.race)!;
        expect(pair.second.map((s) => s.id)).toContain(e.second);
        expect(life.blood).toBe(`${life.race}+${e.second}`);
      }
      const g = origin.gender[life.race];
      if (g.n === 100) expect(e.neuter).toBe(true);
      if (g.m === 0 && g.f === 0) expect(e.neuter).toBe(true);
      if (e.born === 'main' && !e.second && !life.flags.includes('summoned')) expect(origin.birthplaces.find((b) => b.race === life.race)!.main).toContain(life.country);
    }
  });

  it('a named half-blood is born in a meeting land or, for a special cause, in a main land of the pair', () => {
    for (const [a, b] of [['human', 'elf'], ['dwarf', 'human'], ['naga', 'merfolk'], ['elf', 'fae']]) {
      const row = origin.meetingPlaces.find((m) => m.pair.includes(a) && m.pair.includes(b))!;
      const allowed = new Set([...row.places.map((p) => p.id), ...row.mainOnlyCountries]);
      for (let seed = 1; seed <= 40; seed++) {
        const { life } = born(seed, { race: a, second: b });
        const e = extOf(life);
        expect(e.second).toBe(b);
        expect(allowed.has(life.country)).toBe(true);
        expect(row.causes.map((c) => c.id)).toContain(e.meet);
        const r1 = races.find((r) => r.id === a)!;
        const r2 = races.find((r) => r.id === b)!;
        const mid = (r1.lifespan[0] + r1.lifespan[1] + r2.lifespan[0] + r2.lifespan[1]) / 4;
        expect(life.lifespan).toBeGreaterThanOrEqual(Math.floor(mid * 0.85));
        expect(life.lifespan).toBeLessThanOrEqual(Math.ceil(mid * 1.15));
      }
    }
  });

  it('the special births: the summoned appears in AL-02 at 16, the woken at 17', () => {
    let summoned = 0;
    for (let seed = 1; seed <= 3000 && summoned < 3; seed++) {
      const g = game(seed);
      const l = birth(g.ctx, { race: undefined });
      if (extOf(l).special === 'summoned') {
        summoned++;
        expect(l.country).toBe('AL-02');
        expect(l.hAge).toBe(16);
        expect(extOf(l).second).toBeUndefined();
        expect(extOf(l).firstNode).toBe('hu.t2');
      }
    }
    expect(summoned).toBeGreaterThan(0);
    for (const id of ['mummy', 'ghoul', 'soulmachine']) expect(born(3, { race: id }).life.hAge).toBe(17);
  });

  it('the world year option sets the clock; lineage numbers the life', () => {
    const { g, life } = born(4, { worldYear: 1234 });
    expect(life.birthYear).toBe(1234);
    expect(g.state.clock.worldYear).toBe(1234);
    expect(life.id).toBe('L1');
  });

  it('class and starting gold follow the economy tables', () => {
    const eco = data.economy.items as { startGold: { range: [number, number] }[] };
    for (let seed = 1; seed <= 80; seed++) {
      const { life } = born(seed);
      const c = classNum(life);
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeLessThanOrEqual(5);
      if (!life.flags.includes('summoned') && !extOf(life).meet && !life.blessings.length && !life.curses.length) {
        const [lo, hi] = eco.startGold[c - 1].range;
        expect(life.gold).toBeGreaterThanOrEqual(lo);
        expect(life.gold).toBeLessThanOrEqual(hi + 30);
      }
      if (c === 5) expect(life.flags).toContain('noble');
    }
  });
});

describe('conditions', () => {
  it('has: every kind of id the character holds, a prefix, and levels', () => {
    const { ctx, life } = born(7, { race: 'human', second: null });
    life.traits = ['kind'];
    life.aptitudes = { sword: 2 };
    life.skills = ['sword_1', 'sword_2', 'u_sage', 'ns_mediate'];
    extOf(life).skillLevels = { ns_mediate: 2 };
    life.blessings = ['nb_mark_oran'];
    life.curses = ['c_frail'];
    life.job = 'soldier';
    life.flags = ['faith.02', 'cs_child_rescue'];
    life.items = ['w1_sword', 'ar_leather'];
    extOf(life).companions = ['sp_dog'];
    extOf(life).tags = ['necro'];
    const yes: Condition[] = [
      has('trait', 'kind'), has('aptitude', 'sword', 2), has('skill', 'sword_2'), has('skill', 'sword_1'), has('skill', 'ns_mediate_2'), has('skill', 'u_sage'),
      has('blessing', 'nb_mark_*'), has('curse', 'c_frail'), has('job', 'soldier'), has('flag', 'faith.02'), has('story', 'cs_child_rescue'),
      has('weapon', 'w1_sword'), has('gear', 'ar_leather'), has('companion', 'sp_dog'), has('tag', 'necro'), has('tag', '#necro'),
    ];
    const no: Condition[] = [
      has('trait', 'coward'), has('aptitude', 'sword', 3), has('skill', 'sword_3'), has('skill', 'ns_mediate_3'), has('blessing', 'nb_mark_zzz'), has('curse', 'c_lonely'),
      has('job', 'mage'), has('flag', 'faith.03'), has('tag', 'holy'), has('companion', 'sp_cat'),
    ];
    for (const c of yes) expect(test(ctx, c), JSON.stringify(c)).toBe(true);
    for (const c of no) expect(test(ctx, c), JSON.stringify(c)).toBe(false);
  });

  it('race (id or story code), half, gender, age, class, faith, sign, country, continent', () => {
    const { ctx, life } = born(8, { race: 'elf', second: 'human', gender: 'f', country: 'SV-09' });
    const e = extOf(life);
    e.faith = 'faith.06';
    e.sign = 'comet';
    e.time = 'night';
    life.cls = 'c4';
    life.hAge = 30;
    life.home = 'AL-22';
    expect(test(ctx, { k: 'race', ids: ['el'] })).toBe(true);
    expect(test(ctx, { k: 'race', ids: ['elf', 'orc'] })).toBe(true);
    expect(test(ctx, { k: 'race', ids: ['hu'] })).toBe(false); // the main race only
    expect(test(ctx, { k: 'half' })).toBe(true);
    expect(test(ctx, { k: 'gender', value: 'f' })).toBe(true);
    expect(test(ctx, { k: 'gender', value: 'm' })).toBe(false);
    expect(test(ctx, { k: 'age', min: 30, max: 30 })).toBe(true);
    expect(test(ctx, { k: 'age', min: 31 })).toBe(false);
    expect(test(ctx, { k: 'age', max: 29 })).toBe(false);
    expect(test(ctx, { k: 'class', min: 4 })).toBe(true);
    expect(test(ctx, { k: 'class', min: 5 })).toBe(false);
    expect(test(ctx, { k: 'class', max: 3 })).toBe(false);
    expect(test(ctx, { k: 'faith', ids: ['faith.06'] })).toBe(true);
    expect(test(ctx, { k: 'faith', ids: ['faith.02'] })).toBe(false);
    expect(test(ctx, { k: 'sign', ids: ['comet'] })).toBe(true);
    expect(test(ctx, { k: 'sign', ids: ['sign_night'] })).toBe(true);
    expect(test(ctx, { k: 'sign', ids: ['storm'] })).toBe(false);
    expect(test(ctx, { k: 'country', ids: ['SV-09'] })).toBe(true);
    expect(test(ctx, { k: 'country', ids: ['AL-22'] })).toBe(true); // born or living there
    expect(test(ctx, { k: 'country', ids: ['AL-01'] })).toBe(false);
    expect(test(ctx, { k: 'continent', ids: ['SV'] })).toBe(true);
    expect(test(ctx, { k: 'continent', ids: ['KD'] })).toBe(false);
    expect(test(ctx, { k: 'not', of: { k: 'half' } })).toBe(false);
  });

  it('numbers: stats, axes, gold, fame, trust and the Thai names', () => {
    const { ctx, life } = born(9, { race: 'human', second: null });
    life.stats.pow = 10;
    life.gold = 40;
    extOf(life).axes.brave = 55;
    extOf(life).fame = 12;
    life.godFaith = -72;
    extOf(life).trust = { เอลฟ์: 3, ออร์ค: 4, มนุษย์: 1 };
    expect(test(ctx, { k: 'cmp', stat: 'pow', op: '>=', value: 10 })).toBe(true);
    expect(test(ctx, { k: 'cmp', stat: 'พลัง', op: '>', value: 10 })).toBe(false);
    expect(test(ctx, { k: 'cmp', stat: 'ทอง', op: '==', value: 40 })).toBe(true);
    expect(test(ctx, { k: 'cmp', stat: 'brave', op: '>', value: 50 })).toBe(true);
    expect(test(ctx, { k: 'cmp', stat: 'axis.brave', op: '>', value: 50 })).toBe(true);
    expect(test(ctx, { k: 'cmp', stat: 'courage', op: '>', value: 30 })).toBe(true);
    expect(test(ctx, { k: 'cmp', stat: 'fame', op: '>=', value: 12 })).toBe(true);
    expect(test(ctx, { k: 'cmp', stat: 'ชื่อเสียง', op: '>=', value: 13 })).toBe(false);
    expect(test(ctx, { k: 'cmp', stat: 'godFaith', op: '<=', value: -70 })).toBe(true);
    expect(test(ctx, { k: 'cmp', stat: 'trust.เอลฟ์', op: '>=', value: 3 })).toBe(true);
    expect(test(ctx, { k: 'cmp', stat: 'trust:เอลฟ์', op: '>=', value: 4 })).toBe(false);
    expect(test(ctx, { k: 'cmp', stat: 'trust', op: '>=', value: 3, count: 2 })).toBe(true); // two peoples trusted at 3 or more
    expect(test(ctx, { k: 'cmp', stat: 'trust', op: '>=', value: 3, count: 3 })).toBe(false);
  });
});

describe('effects', () => {
  it('grant and remove: traits (no conflicts), skills, aptitudes, gifts with their stat changes, flags', () => {
    const { ctx, life } = born(10, { race: 'human', second: null });
    life.traits = ['kind'];
    const pow = life.stats.pow;
    const list: Effect[] = [
      { k: 'grant', kind: 'trait', id: 'cold' }, // conflicts with kind
      { k: 'grant', kind: 'trait', id: 'coward' },
      { k: 'grant', kind: 'blessing', id: 'b_bull' }, // pow+1
      { k: 'grant', kind: 'aptitude', id: 'axe', level: 2 },
      { k: 'grant', kind: 'skill', id: 'sword_2' },
      { k: 'grant', kind: 'story', id: 'cs_x' },
      { k: 'grant', kind: 'tag', id: '#holy' },
      { k: 'grant', kind: 'companion', id: 'sp_dog' },
    ];
    apply(ctx, list, src);
    expect(life.traits).toContain('coward');
    expect(life.traits).not.toContain('cold');
    expect(life.blessings).toContain('b_bull');
    expect(life.aptitudes.axe).toBe(2);
    expect(life.aptitudes.sword).toBe(2);
    expect(test(ctx, has('skill', 'axe_2'))).toBe(true);
    expect(life.stats.pow).toBeGreaterThan(pow);
    expect(life.flags).toContain('cs_x');
    expect(test(ctx, has('tag', 'holy'))).toBe(true);
    const after = life.stats.pow;
    apply(ctx, [{ k: 'remove', kind: 'blessing', id: 'b_bull' }, { k: 'remove', kind: 'tag', id: 'holy' }], src);
    expect(life.blessings).not.toContain('b_bull');
    expect(life.stats.pow).toBe(after - 1);
    expect(test(ctx, has('tag', 'holy'))).toBe(false);
  });

  it('a grant with a chance is rolled from the seed', () => {
    const run = (seed: number) => {
      const { ctx, life } = born(seed, { race: 'human', second: null });
      life.curses = [];
      apply(ctx, [{ k: 'grant', kind: 'curse', id: 'c_frail', chance: 0.5 }], src);
      return life.curses.length;
    };
    const got = new Set<number>();
    for (let s = 1; s <= 30; s++) got.add(run(s));
    expect(got.size).toBe(2);
    expect(run(3)).toBe(run(3));
  });

  it('stat, statPct, statMul, range, trust, class, favour, wound', () => {
    const { ctx, life } = born(13, { race: 'human', second: null });
    life.gold = 100;
    life.cls = 'c2';
    apply(ctx, [{ k: 'stat', stat: 'ทอง', delta: -50 }], src);
    expect(life.gold).toBe(50);
    apply(ctx, [{ k: 'statPct', stat: 'gold', pct: 20 }], src);
    expect(life.gold).toBe(60);
    apply(ctx, [{ k: 'statMul', stat: 'ทองเริ่มต้น', mul: 0 }], src);
    expect(life.gold).toBe(0);
    apply(ctx, [{ k: 'range', stat: 'gold', min: 10, max: 20 }], src);
    expect(life.gold).toBeGreaterThanOrEqual(10);
    expect(life.gold).toBeLessThanOrEqual(20);
    apply(ctx, [{ k: 'stat', stat: 'fame', delta: 5 }, { k: 'stat', stat: 'piety', delta: 500 }, { k: 'stat', stat: 'ศรัทธาเทพ', delta: 500 }], src);
    expect(extOf(life).fame).toBe(5);
    expect(extOf(life).axes.piety).toBe(100);
    expect(life.godFaith).toBe(100);
    apply(ctx, [{ k: 'trust', toward: 'เอลฟ์', delta: 2 }, { k: 'trust', toward: 'เอลฟ์', delta: 1 }, { k: 'trust', toward: '', delta: -1 }], src);
    expect(extOf(life).trust).toEqual({ เอลฟ์: 3, '*': -1 });
    apply(ctx, [{ k: 'class', value: 5 }], src);
    expect(life.cls).toBe('c5');
    extOf(life).favour = {};
    apply(ctx, [{ k: 'favour', kind: 'blessing', id: 'b_luckystar', mul: 3 }, { k: 'favour', kind: 'blessing', id: 'b_luckystar', mul: 2 }, { k: 'favour', kind: 'tag', id: 'light' }], src);
    expect(extOf(life).favour['blessing:b_luckystar']).toBe(6);
    expect(extOf(life).favour['tag:light']).toBe(2);
    apply(ctx, [{ k: 'wound', chance: 1 }, { k: 'wound', chance: 0 }], src);
    expect(extOf(life).wounds).toBe(1);
  });

  it('a sign changes the draw weights stored for later: comet favours the fate tags ×3', () => {
    const { life } = born(14, { race: 'human', second: null, sign: 'comet' });
    expect(extOf(life).sign).toBe('comet');
    expect(extOf(life).favour['tag:hero_luck']).toBeGreaterThanOrEqual(3); // a race that likes the sign doubles it
  });
});

describe('death', () => {
  it('natural death comes at hAge 75; untimely death before it only from 15', () => {
    let old = 0;
    let early = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const { g, life } = born(seed, { race: 'human', second: null });
      // strip anything that moves the death age
      life.blessings = [];
      life.curses = [];
      extOf(life).tags = [];
      recomputeDeathAge(g.ctx, life);
      g.runLife();
      const d = life.dead!;
      if (d.cause === 'old') {
        old++;
        expect(d.hAge).toBe(75);
        expect(Math.abs(d.year - (life.birthYear + life.lifespan))).toBeLessThanOrEqual(2);
      } else {
        early++;
        expect(d.hAge).toBeGreaterThanOrEqual(15);
        expect(d.hAge).toBeLessThan(75);
        expect(['illness', 'accident', 'violence']).toContain(d.cause);
      }
      expect(g.state.log.some((e) => e.kind === 'death')).toBe(true);
    }
    expect(old).toBeGreaterThan(40);
    expect(early).toBeGreaterThan(0);
  });

  it('who wakes at 17 lives 58 life years; a long-lived race lives in world years but dies at hAge 75 too', () => {
    const w = born(2, { race: 'mummy' });
    w.life.blessings = [];
    w.life.curses = [];
    w.g.runLife();
    expect(w.life.dead!.hAge === 75 || w.life.dead!.hAge < 75).toBe(true);
    if (w.life.dead!.cause === 'old') expect(Math.abs(w.life.dead!.year - w.life.lifespan)).toBeLessThanOrEqual(2);
    const e = born(3, { race: 'elf', second: null });
    e.life.blessings = [];
    e.life.curses = [];
    recomputeDeathAge(e.ctx, e.life);
    e.g.runLife();
    if (e.life.dead!.cause === 'old') {
      expect(e.life.dead!.hAge).toBe(75);
      expect(e.life.dead!.year).toBeGreaterThan(200);
    }
  });

  it('the death effect kills (with a chance), and longevity or short life moves the death age', () => {
    const { ctx, life } = born(15, { race: 'human', second: null });
    life.blessings = [];
    life.curses = [];
    apply(ctx, [{ k: 'death', chance: 0, cause: 'x' }], src);
    expect(life.dead).toBeUndefined();
    recomputeDeathAge(ctx, life);
    expect(extOf(life).deathAge).toBe(75);
    apply(ctx, [{ k: 'grant', kind: 'blessing', id: 'b_longevity' }], src);
    expect(extOf(life).deathAge).toBe(90); // a short-lived race gets +20% (02-race-affinity §ค)
    apply(ctx, [{ k: 'grant', kind: 'curse', id: 'c_shortlife' }], src);
    expect(extOf(life).deathAge).toBe(75); // SR-33: the two cancel
    apply(ctx, [{ k: 'death', cause: 'plague' }], src);
    expect(life.dead).toMatchObject({ cause: 'plague', hAge: 0 });
    expect(yearlyDeath(ctx, life)).toBeNull();
  });
});

describe('jobs', () => {
  it('a job whose requirement or ban is not met is refused and the miss is logged', () => {
    const { ctx, life } = born(16, { race: 'giant', second: null });
    expect(grantJob(ctx, 'farmer', src)).toBe(false); // not for giants
    expect(life.job).toBeUndefined();
    expect(ctx.state.log.some((e) => e.kind === 'jobFail' && e.id === 'farmer')).toBe(true);
    expect(grantJob(ctx, 'no_such_job', src)).toBe(false);
  });

  it('the church of light takes men as priests and not women (institution limits, 01-origin §7)', () => {
    const male = born(17, { race: 'human', second: null, gender: 'm', country: 'AL-02' });
    extOf(male.life).faith = 'faith.02';
    expect(grantJob(male.ctx, 'priest', src)).toBe(true);
    expect(male.life.job).toBe('priest');
    const female = born(17, { race: 'human', second: null, gender: 'f', country: 'AL-02' });
    extOf(female.life).faith = 'faith.02';
    expect(grantJob(female.ctx, 'priest', src)).toBe(false);
    expect(female.life.job).toBeUndefined();
  });

  it('the effect grant job goes through the same check; prose in a requirement does not block a story', () => {
    const { ctx, life } = born(18, { race: 'human', second: null });
    apply(ctx, [{ k: 'grant', kind: 'job', id: 'soldier' }], { sys: 'story', id: 'hu.t2' });
    expect(life.job).toBe('soldier');
    expect(ctx.state.log.some((e) => e.kind === 'job' && e.id === 'soldier')).toBe(true);
  });

  it('three different common jobs are offered, all open to the character', () => {
    const { ctx, life } = born(19, { race: 'human', second: null });
    life.stats.int = 12;
    const offer = offerJobs(ctx);
    expect(offer.length).toBe(3);
    expect(new Set(offer).size).toBe(3);
    for (const id of offer) expect(idx(ctx).jobs.get(id)!.kind).toBe('common');
    expect(chooseJob(ctx)).toBeTruthy();
    expect(life.job).toBeTruthy();
  });

  it('the aptitude of a job grows over the years', () => {
    const { g, life } = born(20, { race: 'human', second: null });
    life.aptitudes = {};
    life.skills = [];
    apply(g.ctx, [{ k: 'grant', kind: 'job', id: 'soldier' }], src);
    for (let y = 0; y < 60; y++) {
      life.hAge = 21 + y;
      characterSystem.lifeYear!(g.ctx);
      if (life.dead) delete life.dead;
    }
    expect(Math.max(...Object.values(life.aptitudes))).toBe(3);
  });

  it('secret jobs: needs the conditions; the direct path offers for sure; the path that helps multiplies by 6', () => {
    const { ctx, life } = born(22, { race: 'human', second: null });
    const sword = idx(ctx).jobs.get('swordsaint')!;
    life.aptitudes = {};
    life.stats.pow = 10;
    life.stats.spd = 10;
    expect(secretChance(ctx, life, sword).chance).toBe(0);
    apply(ctx, [{ k: 'grant', kind: 'skill', id: 'sword_3' }], src);
    life.stats.pow = 15;
    life.stats.spd = 12;
    expect(secretChance(ctx, life, sword)).toEqual({ chance: 0.0075, direct: false });
    life.passed['cv.14'] = 'a';
    expect(secretChance(ctx, life, sword).chance).toBeCloseTo(0.045, 5);
    life.passed['hu.a4'] = 'b';
    expect(secretChance(ctx, life, sword)).toEqual({ chance: 1, direct: true });
  });

  it('a secret job offered through the direct path is taken or refused; taking replaces the job', () => {
    let taken = 0;
    let refused = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { ctx, life } = born(seed, { race: 'human', second: null });
      life.aptitudes = {};
      apply(ctx, [{ k: 'grant', kind: 'skill', id: 'sword_3' }, { k: 'grant', kind: 'job', id: 'soldier' }], src);
      life.stats.pow = 16;
      life.stats.spd = 13;
      life.passed['hu.a4'] = 'b';
      life.hAge = 30;
      const got = rollSecretJobs(ctx, life);
      if (got) {
        taken++;
        expect(got).toBe('swordsaint');
        expect(life.secretJob).toBe('swordsaint');
        expect(life.job).toBe('swordsaint');
        expect(ctx.state.log.some((e) => e.kind === 'job' && e.id === 'swordsaint' && e.level === 3)).toBe(true);
        expect(grantJob(ctx, 'soldier', src)).toBe(false); // a secret job takes no common one
      } else {
        refused++;
        expect(extOf(life).refused).toContain('swordsaint');
      }
    }
    expect(taken).toBeGreaterThan(20);
    expect(refused).toBeGreaterThan(0);
  });

  it('prose in a job condition leans the way the caller says, and flips under not; anyOf counts what the character holds', () => {
    const { ctx, life } = born(24, { race: 'human', second: null });
    life.blessings = ['nb_mark_oran', 'nb_mark_sea'];
    const text: Condition = { k: 'text', text: 'ธงสายเลือดฟาโรห์' };
    expect(evalCond(ctx, text, true)).toBe(true);
    expect(evalCond(ctx, text, false)).toBe(false);
    // leaning true means "the prose is met" in a requirement and "the ban does not apply" when it sits under a not
    expect(evalCond(ctx, { k: 'not', of: text }, true)).toBe(true);
    expect(evalCond(ctx, { k: 'not', of: text }, false)).toBe(false);
    expect(evalCond(ctx, { k: 'and', of: [text, { k: 'not', of: text }] }, true)).toBe(true);
    const any = (min: number): Condition => ({ k: 'anyOf', kind: 'blessing', ids: ['nb_mark_oran', 'nb_mark_sea', 'nb_mark_stone'], min });
    expect(evalCond(ctx, any(2), true)).toBe(true);
    expect(evalCond(ctx, any(3), true)).toBe(false);
  });

  it('godslayer stays shut without GD-08 or the godslayer faith, however the numbers look', () => {
    const { ctx, life } = born(23, { race: 'giant', second: null });
    const job = idx(ctx).jobs.get('godslayer')!;
    life.godFaith = -90;
    extOf(life).axes.brave = 80;
    expect(secretChance(ctx, life, job).chance).toBe(0);
    life.flags.push('faith.23');
    expect(secretChance(ctx, life, job).chance).toBeGreaterThan(0);
  });
});
