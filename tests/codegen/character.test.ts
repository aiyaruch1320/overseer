import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import run from '../../scripts/codegen/groups/character';
import { idIndex } from '../../scripts/codegen/lib/ids';
import { genDir, tables } from '../../scripts/codegen/lib/table';
import type {
  Aptitude,
  CharCond,
  CompanionsFile,
  FatesFile,
  Gift,
  JobsFile,
  OriginFile,
  RacesFile,
  Skill,
  SynonymsFile,
  TagMeaning,
  Trait,
  WishFile,
} from '../../src/core/data/types-character';

const FILES = ['races', 'traits', 'aptitudes', 'skills', 'blessings', 'curses', 'jobs', 'fates', 'origin', 'wish', 'synonyms', 'companions'];
const read = (n: string) => readFileSync(path.join(genDir, `${n}.json`), 'utf8');
const snapshot = () => Object.fromEntries([...FILES.map((n) => `${n}.json`), '_unparsed/character.md'].map((f) => [f, readFileSync(path.join(genDir, f), 'utf8')]));

// generate once (the same call `npx tsx scripts/codegen/run-all.ts character` makes), then read what is on disk
const first = (() => {
  const rep = run();
  return { rep, bytes: snapshot() };
})();
const load = <T>(n: string): T => JSON.parse(read(n)).items as T;

const races = load<RacesFile>('races');
const { traits, tags } = load<{ traits: Trait[]; tags: TagMeaning[] }>('traits');
const apts = load<Aptitude[]>('aptitudes');
const skills = load<Skill[]>('skills');
const blessings = load<Gift[]>('blessings');
const curses = load<Gift[]>('curses');
const jobs = load<JobsFile>('jobs');
const fates = load<FatesFile>('fates');
const origin = load<OriginFile>('origin');
const wish = load<WishFile>('wish');
const syn = load<SynonymsFile>('synonyms');
const comp = load<CompanionsFile>('companions');
const ids = idIndex();

const set = (a: string[]) => new Set(a);
const raceIds = set(races.races.map((r) => r.id));
const traitIds = set(traits.map((t) => t.id));
const aptIds = set(apts.map((a) => a.id));
const skillIds = set(skills.map((s) => s.id));
const blessIds = set(blessings.map((b) => b.id));
const curseIds = set(curses.map((c) => c.id));
const jobIds = set(jobs.jobs.map((j) => j.id));
const speciesIds = set(comp.species.map((s) => s.id));
const abilityIds = set(comp.abilities.map((a) => a.id));
const storyIds = set(comp.stories.map((s) => s.id));
const tagIds = set([...tags.map((t) => t.tag), ...races.races.flatMap((r) => r.tags)]);

/** Ids that the docs name but do not define (known gaps, reported, not hidden). */
const missing = (label: string, used: string[], known: Set<string>, allow: string[] = []) => {
  const bad = [...new Set(used.filter((x) => !known.has(x) && !allow.includes(x)))];
  expect(bad, `${label}: ids that are not defined`).toEqual([]);
};

describe('character generator: counts (README.md, code-plan §5.1)', () => {
  it('runs and reports', () => {
    expect(first.rep.group).toBe('character');
    expect(first.rep.files.sort()).toEqual(FILES.map((n) => `${n}.json`).sort());
    expect(first.rep.strict).toBe(false);
  });
  it('21 races with their gifts', () => {
    expect(races.races).toHaveLength(21);
    expect(races.races.map((r) => r.n)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    expect(races.races.reduce((n, r) => n + r.blessings.length, 0)).toBe(84);
    expect(races.races.reduce((n, r) => n + r.curses.length, 0)).toBe(63);
    expect(races.races.reduce((n, r) => n + r.skills.length, 0)).toBe(84);
    expect(races.synergy).toHaveLength(59);
  });
  it('traits and aptitudes (48 + 8, 45 + 20)', () => {
    expect(traits).toHaveLength(56);
    expect(traits.filter((t) => t.src === 'code')).toHaveLength(48);
    expect(apts).toHaveLength(65);
    expect(apts.filter((a) => a.src === 'code')).toHaveLength(45);
  });
  it('232 skills in the README sense (150 old + 70 + 12), 60 more from the 20 added aptitudes', () => {
    const readme = skills.filter((s) => !(s.kind === 'apt' && s.src === 'doc'));
    expect(readme).toHaveLength(232);
    expect(skills.filter((s) => s.kind === 'apt' && s.src === 'code')).toHaveLength(135);
    expect(skills.filter((s) => s.kind === 'unique')).toHaveLength(15);
    expect(skills.filter((s) => s.kind === 'new')).toHaveLength(70);
    expect(skills.filter((s) => s.kind === 'companion')).toHaveLength(12);
    expect(skills).toHaveLength(292);
  });
  it('every blessing and curse has a line the game can show (desc, or the world line)', () => {
    const bare = [...blessings, ...curses].filter((g) => !(g.desc || g.world)).map((g) => g.id);
    expect(bare).toEqual([]);
  });

  it('200 blessings and 152 curses', () => {
    expect(blessings).toHaveLength(200);
    expect(blessings.filter((b) => b.src === 'code')).toHaveLength(107);
    expect(curses).toHaveLength(152);
    expect(curses.filter((c) => c.src === 'code')).toHaveLength(103);
  });
  it('157 jobs: 115 common, 26 secret, 16 special, 14 slow life', () => {
    expect(jobs.jobs).toHaveLength(157);
    expect(jobs.jobs.filter((j) => j.kind === 'common')).toHaveLength(115);
    expect(jobs.jobs.filter((j) => j.kind === 'secret')).toHaveLength(26);
    expect(jobs.jobs.filter((j) => j.kind === 'special')).toHaveLength(16);
    expect(jobs.jobs.filter((j) => j.slow)).toHaveLength(14);
  });
  it('22 fates, 102 + 1 species, 60 abilities, 32 stories', () => {
    expect(fates.fates).toHaveLength(22);
    expect(fates.fates.filter((f) => f.good)).toHaveLength(10);
    expect(comp.species.filter((s) => s.std)).toHaveLength(102);
    expect(comp.species).toHaveLength(103);
    expect(comp.abilities).toHaveLength(60);
    expect(comp.stories).toHaveLength(32);
    expect(comp.rules.interactions).toHaveLength(20);
    expect(comp.rules.personalities).toHaveLength(10);
  });
  it('synonyms: 507 values, 3,576 words, and each field matches its declared count', () => {
    expect(syn.totals.values).toBe(507);
    expect(syn.totals.synonyms).toBe(3576);
    expect(syn.totals.declaredValues).toBe(507);
    expect(syn.totals.declaredSynonyms).toBe(3576);
    for (const f of syn.fields) {
      expect(f.values.length, f.key).toBe(f.declaredValues);
      expect(f.values.reduce((n, v) => n + v.syn.length, 0), f.key).toBe(f.declaredSyn);
    }
  });
  it('origin: 21 birth rows, shares add to 100, every half-blood pair resolved', () => {
    expect(origin.birthplaces).toHaveLength(21);
    expect(origin.raceShare.reduce((n, p) => n + p.w, 0)).toBeCloseTo(100);
    expect(origin.halfPairs).toHaveLength(16);
    expect(origin.noHalf.sort()).toEqual(['construct', 'ghoul', 'mummy', 'slime', 'soulmachine']);
    expect(origin.meetingPlaces).toHaveLength(27);
    expect(origin.meetCauses).toHaveLength(8);
    expect(origin.continentGifts).toHaveLength(9);
    for (const hp of origin.halfPairs) expect(hp.second.reduce((n, p) => n + p.w, 0), hp.main).toBe(100);
    for (const m of origin.meetingPlaces) {
      expect(m.places.reduce((n, p) => n + p.w, 0), m.src).toBeCloseTo(100);
      expect(m.causes.reduce((n, p) => n + p.w, 0), m.src).toBe(100);
    }
  });
  it('wish: 10 points and a cost row each', () => {
    expect(wish.budget.total).toBe(10);
    expect(wish.budget.costs.length).toBeGreaterThan(10);
    expect(wish.budget.costs.every((c) => c.points !== null)).toBe(true);
    expect(wish.principles).toHaveLength(6);
  });
});

describe('character generator: data agrees with its sources', () => {
  it('race stat ranges match races/README.md and each race file', () => {
    const readme = tables('docs/systems/character/races/README.md')[0];
    for (const [i, r] of races.races.entries()) {
      const row = readme.rows[i].cells;
      const range = (s: string) => s.split('–').map(Number);
      expect(r.stats.pow).toEqual(range(row[2]));
      expect(r.stats.vit).toEqual(range(row[7]));
      expect(r.lifespan).toEqual(range(row[8]));
    }
    // the per-race file must agree with the README table
    for (const [i, r] of races.races.entries()) {
      const file = `docs/systems/character/races/${String(i + 1).padStart(2, '0')}-${r.id}.md`;
      const t = tables(file)[0].rows[0].cells.map((c) => c.replace(/\s*ปี$/, '').split('–').map((x) => Number(x.replace(/,/g, ''))));
      expect([r.stats.pow, r.stats.mag, r.stats.spd, r.stats.luk, r.stats.int, r.stats.vit, r.lifespan], r.id).toEqual(t);
    }
  });
  it('world-time numbers: one life year is lifespan ÷ 75 (÷ 58 for those who wake)', () => {
    for (const r of races.races) {
      const mid = (r.lifespan[0] + r.lifespan[1]) / 2;
      expect(r.worldYearsPerLifeYear, r.id).toBeCloseTo(mid / r.lifeYearDivisor, 1);
    }
    expect(races.races.filter((r) => r.wakes).map((r) => r.id)).toEqual(['soulmachine', 'mummy', 'ghoul']);
    expect(races.races.find((r) => r.id === 'human')!.sublines.find((s) => s.name === 'ชาวหมอก')!.lifespan).toEqual([70, 120]);
    expect(races.races.find((r) => r.id === 'vampire')!.lifespan).toEqual([305, 400]);
    expect(Math.max(...races.races.map((r) => r.lifespan[1]))).toBeLessThanOrEqual(400);
  });
  it('three rows spot-checked against the docs', () => {
    // 1. a blessing from 05-new-blessings.md (nb_sky_born)
    const sky = blessings.find((b) => b.id === 'nb_sky_born')!;
    expect(sky).toMatchObject({ name: 'เกิดใต้ท้องฟ้ามังกร', tier: 'U', from: 'เกิดในอัซการ์' });
    expect(sky.fx).toEqual([
      { k: 'stat', stat: 'spd', delta: 1 },
      { k: 'grant', kind: 'tag', id: 'fall_save' },
    ]);
    expect(sky.fromCond).toEqual([{ k: 'continent', ids: ['AZ'] }]);
    // 2. a secret job from 10-jobs-secret.md (lich: code condition, bans, direct and assisting nodes)
    const lich = jobs.jobs.find((j) => j.id === 'lich')!;
    expect(lich.kind).toBe('secret');
    expect(lich.direct).toEqual([{ id: 'hu.a6', choice: 'c' }, { id: 'mu.a2', choice: 'b' }]);
    expect(lich.assist).toEqual([{ id: 'cv.4' }, { id: 'gh.a2', choice: 'b' }]);
    expect(lich.linked!.events).toEqual(['DM-09']);
    expect(lich.baseChance).toBe(0.0075);
    expect(lich.req[1]).toEqual({ k: 'cmp', stat: 'int', op: '>=', value: 13 });
    expect(lich.req[3]).toMatchObject({ k: 'or' });
    // 3. a species from 15-companion-species.md
    const fox = comp.species.find((s) => s.id === 'sp_nine_tailed_fox')!;
    expect(fox).toMatchObject({ name: 'จิ้งจอกเก้าหาง', tier: 'L', category: 'วิญญาณ', lifespan: [800, 1100] });
    expect(fox.abilities).toEqual([
      { id: 'pa_lie_sense', level: 3 },
      { id: 'pa_distract', level: 3 },
      { id: 'pa_omen', level: 2 },
    ]);
    // and a fate and a wish cost
    const fate = fates.fates.find((f) => f.id === 'fate_shortlife')!;
    expect(fate).toMatchObject({ good: false, tier: 'R', age: [25, 35] });
    expect(wish.budget.costs.find((c) => c.what.startsWith('ชนชั้น 4'))!.parts).toEqual([
      { label: 'ชนชั้น 4', points: 2 },
      { label: 'ชนชั้น 5', points: 4 },
    ]);
  });
  it('old-code effect strings become stat and tag effects', () => {
    expect(blessings.find((b) => b.id === 'b_titan')!.fx).toEqual([
      { k: 'stat', stat: 'pow', delta: 3 },
      { k: 'stat', stat: 'vit', delta: 1 },
    ]);
    expect(traits.find((t) => t.id === 'paranoid')!.fx).toEqual([
      { k: 'stat', stat: 'curious', delta: -25 },
      { k: 'grant', kind: 'tag', id: 'distrustful' },
    ]);
    expect(curses.find((c) => c.id === 'c_debt')!.fx).toEqual([
      { k: 'stat', stat: 'gold', delta: -50 },
      { k: 'grant', kind: 'tag', id: 'debt' },
    ]);
  });
  it('new blessings and curses are read as blessings and curses, not skills', () => {
    const gi = (g: { k: string }) => g.k === 'grant';
    for (const e of origin.birthSigns.flatMap((b) => b.fx).filter(gi) as { id: string; kind: string }[]) {
      if (e.id.startsWith('nb_')) expect(e.kind).toBe('blessing');
      if (e.id.startsWith('c_')) expect(e.kind).toBe('curse');
    }
  });
});

describe('character generator: references across files', () => {
  const inJob = (c: CharCond): string[] => {
    if (c.k === 'and' || c.k === 'or') return c.of.flatMap(inJob);
    if (c.k === 'not') return inJob(c.of);
    if (c.k === 'anyOf') return c.ids.map((id) => `${c.kind}:${id}`);
    return c.k === 'has' ? [`${c.kind}:${c.id}`] : [];
  };
  const level = (id: string) => id.replace(/_\d$/, '');

  it('races point at real traits, aptitudes, blessings, curses, jobs', () => {
    const rs = races.races;
    missing('traitPlus/Minus', rs.flatMap((r) => [...r.traitPlus, ...r.traitMinus]), traitIds);
    missing('aptPlus/Minus', rs.flatMap((r) => [...r.aptPlus, ...r.aptMinus]), aptIds);
    missing('blessPlus/Clash', rs.flatMap((r) => [...r.blessPlus, ...r.blessClash]), blessIds);
    missing('cursePlus/Clash', rs.flatMap((r) => [...r.cursePlus, ...r.curseClash]), curseIds);
    missing('jobBonus', rs.flatMap((r) => r.jobBonus), jobIds);
    missing('overrides', races.overrides.map((o) => o.of), new Set([...blessIds, ...curseIds]));
    expect(races.overrides.every((o) => o.races.every((r) => raceIds.has(r)))).toBe(true);
    // every race tag used by a synergy rule is a race tag or a tag some gift gives
    const known = new Set([...tagIds, ...apts.flatMap((a) => a.tags), 'weak_silver', 'weak_iron', 'undead', 'infernal', 'flight', 'venom', 'amorphous']);
    missing('synergy tags', races.synergy.flatMap((s) => [...(s.attacker ?? []), ...(s.target ?? [])]).filter((t) => !/\*/.test(t)), known);
  });
  it('traits, aptitudes and skills', () => {
    missing('trait conflicts', traits.flatMap((t) => t.conflicts), traitIds);
    missing('skill parents', skills.filter((s) => s.apt).map((s) => s.apt!), aptIds);
    missing('skill learnFrom', skills.flatMap((s) => s.learnFrom ?? []), ids.countries);
    for (const a of apts) for (const l of a.levels) expect(skillIds.has(l.skill)).toBe(true);
    expect(skills.filter((s) => s.kind === 'apt').every((s) => s.stat && s.bonus === s.level)).toBe(true);
  });
  it('jobs point at real aptitudes, races, nodes, and the ids their conditions name', () => {
    const js = jobs.jobs;
    const nodes = js.flatMap((j) => [...(j.direct ?? []), ...(j.assist ?? [])].map((n) => n.id));
    // aptitudes written in the job tables; `navigator` is not defined anywhere (reported)
    missing('job aptitudes', js.flatMap((j) => j.apts), aptIds, ['navigator', 'cunning']);
    missing('job race bonus', js.flatMap((j) => j.raceBonus), raceIds);
    missing('job nodes', nodes.filter((n) => !/^cv\.\d+$/.test(n)), ids.nodes);
    missing('job nodes cv', nodes.filter((n) => /^cv\.\d+$/.test(n)), new Set(Array.from({ length: 16 }, (_, i) => `cv.${i + 1}`)));
    const has = js.flatMap((j) => [...j.req, ...j.ban].flatMap(inJob));
    missing('required blessings', has.filter((x) => x.startsWith('blessing:')).map((x) => x.slice(9)), blessIds);
    missing('required curses', has.filter((x) => x.startsWith('curse:')).map((x) => x.slice(6)), curseIds);
    missing('required jobs', has.filter((x) => x.startsWith('job:')).map((x) => x.slice(4)), jobIds);
    missing('required aptitudes', has.filter((x) => x.startsWith('aptitude:')).map((x) => x.slice(9)), aptIds);
    missing('required skills', has.filter((x) => x.startsWith('skill:')).map((x) => x.slice(6)), new Set([...skillIds, ...skills.map((s) => `${s.id}_1`), ...skills.flatMap((s) => [1, 2, 3].map((n) => `${s.id}_${n}`))]));
    expect(new Set(js.map((j) => j.id)).size).toBe(157);
  });
  it('gifts point at real events, countries and jobs', () => {
    const all = [...blessings, ...curses];
    missing('gift events', all.flatMap((g) => g.refs.events), ids.events);
    missing('gift countries', all.flatMap((g) => g.refs.countries), ids.countries);
    expect(all.every((g) => ['C', 'U', 'R', 'E', 'L'].includes(g.tier))).toBe(true);
    expect(new Set(all.map((g) => g.id)).size).toBe(352);
  });
  it('companions', () => {
    missing('species abilities', comp.species.flatMap((s) => s.abilities.map((a) => a.id)), abilityIds);
    // 14-companion-abilities.md writes `bow users` `guard` `lavakin` in the job column: an aptitude, a word that is no job id, a race
    const loose = comp.abilities.flatMap((a) => a.jobsText.split(/\s+/).filter((w) => w && !a.jobs.includes(w) && !a.apts.includes(w) && !a.races.includes(w)));
    expect([...new Set(loose)].sort()).toEqual(['guard', 'users']);
    missing('story species', comp.stories.flatMap((s) => s.species), speciesIds);
    missing('story ids', comp.stories.map((s) => s.id), storyIds);
    missing('yearly jobs', comp.rules.yearly.flatMap((y) => y.jobs), jobIds);
    missing('support skills', comp.support.skills, skillIds);
    missing('support blessings', comp.support.blessings, blessIds);
    missing('support curses', comp.support.curses, curseIds);
    missing('traits used', [...comp.traitsUsed.use, ...comp.traitsUsed.clash], traitIds);
    expect(comp.stories.every((s) => s.choices.length >= 2)).toBe(true);
    // 13-companions-overview.md §2 leaves darkelf and demonkin out of the race multiplier table (reported; they take the default ×1)
    const listed = new Set(comp.rules.raceMultiplier.flatMap((m) => m.races));
    expect([...raceIds].filter((r) => !listed.has(r)).sort()).toEqual(['darkelf', 'demonkin']);
  });
  it('origin', () => {
    const o = origin;
    missing('birth races', o.birthplaces.map((b) => b.race), raceIds);
    for (const b of o.birthplaces) expect(b.main.length, b.race).toBeGreaterThan(0);
    missing('birth countries', o.birthplaces.flatMap((b) => [...b.main, ...b.diaspora]), ids.countries);
    missing('half races', o.halfPairs.flatMap((h) => [h.main, ...h.second.map((s) => s.id)]), raceIds);
    missing('meeting races', o.meetingPlaces.flatMap((m) => m.pair), raceIds);
    missing('meeting countries', o.meetingPlaces.flatMap((m) => [...m.places.map((p) => p.id), ...m.mainOnlyCountries]), ids.countries);
    missing('continent gifts b', o.continentGifts.flatMap((c) => c.blessings.flatMap((g) => g.ids)), blessIds);
    missing('continent gifts c', o.continentGifts.flatMap((c) => c.curses.flatMap((g) => g.ids)), curseIds);
    missing('institution countries', o.institutions.flatMap((i) => i.countries), ids.countries);
    expect(Object.keys(o.gender).sort()).toEqual([...raceIds].sort());
    for (const g of Object.values(o.gender)) expect(g.m + g.f + g.n).toBe(100);
    for (const b of o.birthplaces) expect(b.mainPct + b.diasporaPct + b.outPct).toBe(100);
  });
  it('fates', () => {
    missing('fate events', fates.fates.flatMap((f) => f.refs.events), ids.events);
  });
  it('synonyms: every code is a defined id', () => {
    const f = (k: string) => syn.fields.find((x) => x.key === k)!.values.map((v) => v.code);
    missing('race', f('race'), raceIds);
    missing('trait', f('trait'), traitIds);
    missing('aptitude', f('aptitude'), aptIds);
    missing('job', f('job'), jobIds, ['noble']);
    missing('companion', f('companion'), speciesIds);
    missing('blessing', f('blessing'), blessIds);
    missing('curse', f('curse'), curseIds);
    expect(f('race')).toEqual(races.races.map((r) => r.id));
    expect(f('continent').sort()).toEqual(['AL', 'AZ', 'KD', 'MH', 'MK', 'NB', 'NR', 'SH', 'SV']);
    void level;
  });
});

describe('character generator: reproducible', () => {
  it('a second run writes the same bytes, including the unparsed report', () => {
    const again = run();
    expect(again.unparsed).toBe(first.rep.unparsed);
    expect(snapshot()).toEqual(first.bytes);
  });
  it('every file has the GenFile shape and a version', () => {
    for (const n of FILES) {
      const j = JSON.parse(read(n));
      expect(Object.keys(j)).toEqual(['version', 'sources', 'generatedBy', 'items']);
      expect(j.version).toMatch(/^[0-9a-f]{12}$/);
      expect(j.generatedBy).toBe('scripts/codegen/groups/character.ts');
      expect(j.sources.length).toBeGreaterThan(0);
    }
  });
  it('the unparsed report is bounded (every condition and number the grammar cannot read is listed, none dropped)', () => {
    expect(first.rep.unparsed).toBeLessThan(250);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Regression tests for the data review of M0-b (review/m0/data-review.md): H7 H8 M5 M9 M10 H2 L2
// ---------------------------------------------------------------------------------------------------------------

const unparsedMd = readFileSync(path.join(genDir, '_unparsed', 'character.md'), 'utf8');
const unparsedRows = unparsedMd.split('\n').filter((l) => l.startsWith('| docs/'));
const jobOf = (id: string) => jobs.jobs.find((j) => j.id === id)!;
type Cond = CharCond;
const textsOf = (c: Cond): string[] => {
  if (c.k === 'text') return [c.text];
  if (c.k === 'and' || c.k === 'or') return c.of.flatMap(textsOf);
  if (c.k === 'not') return textsOf(c.of);
  return [];
};
const walkAll = (o: unknown, f: (x: Record<string, unknown>) => void) => {
  if (Array.isArray(o)) o.forEach((x) => walkAll(x, f));
  else if (o && typeof o === 'object') {
    f(o as Record<string, unknown>);
    Object.values(o).forEach((x) => walkAll(x, f));
  }
};

describe('H7: job bans keep the polarity of the words', () => {
  it('dragonknight is banned when the dragon continent is gone and no dragon mark is held', () => {
    const marks = blessings.filter((b) => b.id.startsWith('nb_mark_')).map((b) => b.id);
    expect(marks).toHaveLength(15);
    expect(jobOf('dragonknight').ban).toEqual([
      { k: 'and', of: [{ k: 'event', id: 'DR-01', happened: true }, { k: 'not', of: { k: 'anyOf', kind: 'blessing', ids: marks, min: 1 } }] },
    ]);
  });
  it('contract_redeemer, seal_keeper and the others that name a held id are `has`, not text', () => {
    expect(jobOf('contract_redeemer').ban).toEqual([{ k: 'has', kind: 'curse', id: 'c_oathbreaker' }]);
    expect(jobOf('seal_keeper').ban).toEqual([{ k: 'has', kind: 'curse', id: 'nc_seal_scar' }]);
    expect(jobOf('seal_breaker').ban).toEqual([{ k: 'has', kind: 'blessing', id: 'nb_seal_hand' }]);
    expect(jobOf('peacemaker_legend').ban).toEqual([{ k: 'has', kind: 'tag', id: 'bloodlust' }]);
    expect(jobOf('demonlord').ban).toEqual([{ k: 'has', kind: 'blessing', id: 'b_saintmark' }]);
  });
  it('a ban cell that says "ต้อง …" or "เฉพาะ …" is the opposite of that requirement', () => {
    expect(jobOf('piratelord').ban).toEqual([{ k: 'not', of: { k: 'country', ids: ['NR-05'] } }]);
    expect(jobOf('slimeking').ban).toEqual([{ k: 'not', of: { k: 'race', ids: ['slime'] } }]);
    expect(jobOf('third_home_founder').ban[0]).toMatchObject({ k: 'not' });
    expect(jobOf('vampirelord').ban[0]).toMatchObject({ k: 'and' }); // ถ้าไม่ใช่แวมไพร์แท้ ต้องมี ns_blood_ledger
  });
  it('every secret job whose ban cell starts "ถ้า … ต้อง" is and[condition, not requirement]', () => {
    const rows = jobs.jobs.filter((j) => /^ถ้า.+ต้อง/.test(j.banText));
    expect(rows.map((j) => j.id).sort()).toEqual(['dragonknight', 'vampirelord']);
    for (const j of rows) {
      const b = j.ban[0];
      expect(b.k, j.id).toBe('and');
      expect((b as { of: Cond[] }).of.some((c) => c.k === 'not'), j.id).toBe(true);
    }
  });
  it('a "ผูก" link and a weight are notes of the ban cell, not bans', () => {
    expect(jobOf('prophet').ban).toEqual([]);
    expect(jobOf('prophet').banNotes.join(' ')).toContain('GD-01');
    expect(jobOf('hero').ban).toEqual([]);
    expect(jobOf('archmage').ban).toEqual([]);
    expect(jobOf('swordsaint').ban).toEqual([]);
  });
  it('a fate "ทุกคน ยกเว้นผู้มี b_destiny" excludes the holders', () => {
    expect(fates.fates.find((f) => f.id === 'fate_shortlife')!.eligibleCond).toEqual([{ k: 'not', of: { k: 'has', kind: 'blessing', id: 'b_destiny' } }]);
  });
});

describe('H8: synergy chances stay with the thing granted', () => {
  const rule = (id: string) => races.synergy.find((r) => r.id === id)!;
  it('SR-39 and SR-65 grants carry their own chance and leave no loose percent', () => {
    expect(rule('SR-39').effects).toEqual([{ k: 'grant', kind: 'curse', id: 'c_outcast', chance: 0.3 }]);
    expect(rule('SR-65').effects).toEqual([
      { k: 'grant', kind: 'curse', id: 'nc_homeland_ghost', chance: 0.35 },
      { k: 'grant', kind: 'blessing', id: 'nb_homeland_call', chance: 0.2 },
    ]);
    expect(rule('SR-61').effects).toEqual([{ k: 'grant', kind: 'curse', id: 'nc_war_orphan', chance: 0.1 }]);
  });
  it('no rule keeps a `pct` that equals the chance of one of its grants', () => {
    for (const r of races.synergy) {
      const chances = r.effects.flatMap((e) => (e.k === 'grant' && e.chance !== undefined ? [Math.round(e.chance * 100)] : []));
      for (const e of r.effects) if ((e as { k: string }).k === 'pct') expect(chances, r.id).not.toContain((e as unknown as { pct: number }).pct);
    }
  });
  it('SR-29 "ลดความสามารถทั้งหมด 20%" is a cut', () => {
    expect(rule('SR-29').effects).toEqual([{ k: 'pct', text: 'ร่างพองน้ำ ลดความสามารถทั้งหมด', pct: -20 }]);
    expect(rule('SR-31').effects).toEqual([{ k: 'pct', text: 'คำสาปถูกสะท้อน', pct: 50 }]); // "สะท้อน 50%" is not a cut
  });
  it('"ลบ" and "เสีย" remove, "ง่ายขึ้น" favours, "ผลเป็น 2 เท่า" grants nothing', () => {
    expect(rule('SR-20').effects).toEqual([{ k: 'remove', kind: 'tag', id: 'weak_light' }]);
    expect(rule('SR-23').effects).toContainEqual({ k: 'remove', kind: 'tag', id: 'infernal' });
    expect(rule('SR-62').effects).toEqual([
      { k: 'favour', kind: 'blessing', id: 'b_plagueward', mul: 2 },
      { k: 'favour', kind: 'curse', id: 'c_sickly', mul: 2 },
    ]);
    expect(rule('SR-42').effects).toEqual([
      { k: 'favour', kind: 'tag', id: 'holy', mul: 2 },
      { k: 'favour', kind: 'tag', id: 'oracle', mul: 2 },
    ]);
    expect(rule('SR-44').effects).toEqual([]);
    expect(rule('SR-44').mul).toBe(2);
  });
  it('a percent that has a chance beside it is not read as a favour, and the aptitude rules carry their +1', () => {
    expect(rule('SR-45').effects).toEqual([
      { k: 'favour', kind: 'tag', id: 'polyglot' },
      { k: 'favour', kind: 'tag', id: 'copycat' },
    ]);
    for (const id of ['SR-50', 'SR-51', 'SR-52', 'SR-56']) expect(rule(id).effects, id).toEqual([{ k: 'stat', stat: 'aptMain', delta: 1 }]);
  });
  it('the values that matched the docs still match', () => {
    expect(rule('SR-01').mul).toBe(1.5);
    expect(rule('SR-07').mul).toBe(2);
    expect(rule('SR-12').mul).toBe(0);
    expect(rule('SR-32').effects).toEqual([{ k: 'grant', kind: 'curse', id: 'c_echo' }]);
  });
});

describe('M5: birth signs raise the draw weight, they do not grant', () => {
  const sign = (id: string) => origin.birthSigns.find((b) => b.id === id)!;
  it('comet, storm, night, dawn and dusk are favour only', () => {
    expect(sign('comet').fx).toEqual([
      { k: 'favour', kind: 'tag', id: 'hero_luck', mul: 3 },
      { k: 'favour', kind: 'tag', id: 'fate_shift', mul: 3 },
    ]);
    expect(sign('storm').fx).toEqual([
      { k: 'favour', kind: 'tag', id: 'lightning', mul: 3 },
      { k: 'favour', kind: 'tag', id: 'wind', mul: 3 },
    ]);
    expect(sign('night').fx).toEqual([
      { k: 'favour', kind: 'blessing', id: 'b_nighteye' },
      { k: 'favour', kind: 'blessing', id: 'b_nightowl' },
    ]);
    expect(sign('dawn').fx.every((e) => e.k === 'favour')).toBe(true);
    expect(sign('dusk').fx.every((e) => e.k === 'favour')).toBe(true);
  });
  it('a full moon favours the werewolf curse only for the beast race; a day-born vampire gets the sunburn curse', () => {
    expect(sign('fullmoon').fx).toEqual([{ k: 'if', cond: { k: 'race', ids: ['beast'] }, then: [{ k: 'favour', kind: 'curse', id: 'c_moonfrenzy', mul: 3 }] }]);
    expect(sign('day').fx).toEqual([{ k: 'if', cond: { k: 'race', ids: ['vampire'] }, then: [{ k: 'grant', kind: 'curse', id: 'c_sunburn' }] }]);
  });
  it('the eclipse blessing keeps its 25% and the curse has the 15% M0-c2 wrote into the doc', () => {
    expect(sign('eclipse').fx).toEqual([
      { k: 'grant', kind: 'blessing', id: 'nb_eclipse_born', chance: 0.25 },
      { k: 'grant', kind: 'curse', id: 'c_shadow', chance: 0.15 },
    ]);
  });
  it('no sign whose effect says "ง่ายขึ้น" or "เพิ่ม n เท่า" grants anything outside an if', () => {
    for (const b of origin.birthSigns) {
      if (!/ง่ายขึ้น|เพิ่ม\s*[\d.]+\s*เท่า/.test(b.effect)) continue;
      expect(b.fx.some((e) => e.k === 'grant'), b.id).toBe(false);
    }
  });
});

describe('M9: jobs read as has / not race, and the music curse names a job that does not exist', () => {
  it('noble needs the noble class (no longer itself); farmer is anyone but a giant', () => {
    expect(jobOf('noble').req).toEqual([{ k: 'class', min: 5 }]);
    expect(jobOf('farmer').req[0]).toEqual({ k: 'not', of: { k: 'race', ids: ['giant'] } });
    expect(jobOf('royal_guard').req).toEqual([{ k: 'or', of: [{ k: 'class', min: 5 }, { k: 'cmp', stat: 'fame', op: '>=', value: 15 }] }]);
  });
  it('mummies and ghouls do not take the jobs the cell says they refuse', () => {
    const refuse = jobs.jobs.filter((j) => j.req.some((c) => c.k === 'not' && c.of.k === 'race' && c.of.ids.includes('ghoul')));
    expect(refuse.length).toBeGreaterThan(0);
  });
  it('nc_tone_deaf names jobs that exist (the doc now says กวีพเนจร instead of นักดนตรี)', () => {
    const c = curses.find((x) => x.id === 'nc_tone_deaf')!;
    expect(c.jobs).toEqual(['bard', 'dancer']);
  });
  it('dragon_whisperer asks for any dragon mark, as one anyOf over the marks that exist', () => {
    const flat = JSON.stringify(jobOf('dragon_whisperer').req);
    expect(flat).not.toContain('nb_mark_*');
    expect(flat).toContain('"anyOf"');
  });
});

describe('M10: fate eligibility is a condition where the doc allows one', () => {
  const fate = (id: string) => fates.fates.find((f) => f.id === id)!;
  it('"ทุกคน" is no condition and its remarks are notes', () => {
    for (const id of ['fate_mentor', 'fate_war', 'fate_plague', 'fate_beast', 'fate_treasure', 'fate_exile', 'fate_demon']) expect(fate(id).eligibleCond, id).toEqual([]);
    expect(fate('fate_war').eligibleNotes.join(' ')).toContain('ศึกชายแดน');
    expect(fate('fate_demon').eligibleNotes.join(' ')).toContain('น้ำหนัก ×2');
  });
  it('religion channels, a continent, a reincarnation flag, a class and events', () => {
    const trial = fate('fate_trial').eligibleCond[0];
    expect(trial).toMatchObject({ k: 'anyOf', kind: 'flag', min: 1 });
    expect((trial as { ids: string[] }).ids).toEqual(['faith.01', 'faith.02', 'faith.03', 'faith.04', 'faith.05', 'faith.06', 'faith.07', 'faith.13', 'faith.16', 'faith.17']);
    expect(fate('fate_chosen').eligibleCond).toEqual([{ k: 'or', of: [{ k: 'continent', ids: ['AL'] }, { k: 'has', kind: 'flag', id: 'faith.02' }] }]);
    expect(fate('fate_pastlife').eligibleCond).toEqual([{ k: 'has', kind: 'flag', id: 'reincarnated' }]);
    expect(fate('fate_demonlord').eligibleCond).toEqual([{ k: 'or', of: [{ k: 'event', id: 'DM-01', happened: true }, { k: 'event', id: 'PL-02', happened: true }] }]);
    expect(JSON.stringify(fate('fate_throne').eligibleCond)).toContain('{"k":"class","min":5}');
  });
  it('"หรือ" between events is an or, never both', () => {
    for (const f of fates.fates) {
      const top = f.eligibleCond.filter((c) => c.k === 'event');
      expect(top.length, f.id).toBeLessThanOrEqual(1);
    }
  });
  it('fewer fates carry a text condition than the 18 of 22 the review found, and each is reported', () => {
    const withText = fates.fates.filter((f) => f.eligibleCond.some((c) => textsOf(c).length));
    expect(withText.length).toBeLessThanOrEqual(10);
    expect(withText.length).toBeGreaterThan(0);
  });
});

describe('H2: a text condition is never kept silently', () => {
  type Row = { where: string; conds: Cond[] };
  const rows: Row[] = [
    ...jobs.jobs.map((j) => ({ where: j.src, conds: [...j.req, ...j.ban] })),
    ...fates.fates.map((f) => ({ where: f.src, conds: f.eligibleCond })),
    ...[...blessings, ...curses].map((g) => ({ where: g.at, conds: g.fromCond })),
    ...comp.stories.map((s) => ({ where: s.src, conds: s.condCond })),
  ];
  it('every text condition has a line in _unparsed/character.md at the row it came from', () => {
    const miss: string[] = [];
    for (const r of rows)
      for (const c of r.conds)
        for (const t of textsOf(c)) if (!unparsedRows.some((u) => u.includes(r.where.replace(/:\d+$/, '') + ':') && u.includes(t.replace(/\|/g, '\\|')))) miss.push(`${r.where} ${t}`);
    expect(miss).toEqual([]);
  });
  it('the text conditions went down from 123 / 18 / 38 / 17 / 4 and none is a bare "ทุก…" or a weight', () => {
    const n = (cs: Cond[][]) => cs.reduce((a, c) => a + c.reduce((b, x) => b + textsOf(x).length, 0), 0);
    expect(n(jobs.jobs.map((j) => [...j.req, ...j.ban]))).toBeLessThanOrEqual(85);
    expect(n(fates.fates.map((f) => f.eligibleCond))).toBeLessThanOrEqual(15);
    expect(n(blessings.map((g) => g.fromCond))).toBeLessThanOrEqual(20);
    expect(n(curses.map((g) => g.fromCond))).toBeLessThanOrEqual(25);
    for (const r of rows) for (const c of r.conds) for (const t of textsOf(c)) expect(t, r.where).not.toMatch(/^(ทุก(เผ่า|เมือง|เมืองเล็ก|ประเทศ|ทวีป|คน)|ไม่จำกัด(เพศ|เผ่า)?)$/);
  });
  it('the explaining words went to notes, not away', () => {
    expect(jobOf('bard').reqNotes.join(' ')).toContain('ไซเรนและเงือกได้ง่ายขึ้น');
    expect(jobOf('smith').reqNotes.join(' ')).toContain('SR-52');
    expect(jobOf('swordsaint').banNotes.join(' ')).toContain('ns_giant_forge');
  });
  it('religion names in a grant source become faith flags', () => {
    const dragon = blessings.find((b) => b.from.startsWith('ลัทธิบูชามังกร'));
    expect(dragon?.fromCond).toEqual([{ k: 'has', kind: 'flag', id: 'faith.01' }]);
    const curse = curses.find((c) => c.from.includes('ศาสนาช่อง D'));
    expect(curse?.fromCond[0]).toMatchObject({ k: 'anyOf', kind: 'flag' });
  });
  it('several events in one source cell are alternatives', () => {
    const oran = blessings.find((b) => b.id === 'nb_mark_oran')!;
    expect(oran.fromCond.length).toBe(1);
    expect(oran.fromCond[0]).toMatchObject({ k: 'or' });
  });
});

describe('L2: tag ids carry no leading #', () => {
  it('no id, tag or event-grant id in the character files starts with #', () => {
    const bad: string[] = [];
    for (const f of FILES) {
      walkAll(JSON.parse(read(f)).items, (o) => {
        if (o.kind === 'tag' && typeof o.id === 'string' && o.id.startsWith('#')) bad.push(`${f} ${o.id}`);
        if (typeof o.tag === 'string' && o.tag.startsWith('#')) bad.push(`${f} ${o.tag}`);
        for (const key of ['tags', 'attacker', 'target', 'newTags']) {
          const v = o[key];
          if (Array.isArray(v)) for (const x of v) if (typeof x === 'string' && x.startsWith('#')) bad.push(`${f} ${key} ${x}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });
});
