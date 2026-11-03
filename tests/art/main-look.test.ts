// M6 ui: the Look of the main character (src/art/main-look.ts): every job maps to parts the painter draws, the stage follows the age, the same life
// gives the same figure, the class and the marks of the life change what is drawn.
import { beforeAll, describe, expect, it } from 'vitest';
import { JOB_LOOKS } from '../../src/art/job-looks';
import { lookKey, stageOf } from '../../src/art/look';
import { MARKS, bloodOf, mainLook, mainLookInfo, shownAge, toolOfWeapon } from '../../src/art/main-look';
import { paintPerson } from '../../src/art/person';
import { BEARDS, FEATS, HAIR, HATS, OUTFITS, TOOLS } from '../../src/art/parts';
import { unknownParts } from '../../src/art/person';
import type { LooksData } from '../../src/core/data/types-looks';
import type { GameData } from '../../src/core/game';
import type { LifeState } from '../../src/core/types';
import { items } from '../../src/core/text/labels';
import { foeBeastOf, mainLookOf, tieLooks } from '../../src/app/views/looks';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, startLife } from '../../scripts/tools/session';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

const life = (o: Partial<LifeState> = {}): LifeState =>
  ({ id: 'L1', name: 'ทดสอบ', race: 'human', gender: 'm', hAge: 30, job: undefined, cls: 'c3', items: [], curses: [], blessings: [], ext: {}, ...o }) as unknown as LifeState;

describe('job looks', () => {
  it('every one of the 157 jobs has a look of parts the painter draws', () => {
    const jobs = (items<{ jobs: { id: string }[] }>(data, 'jobs')?.jobs ?? []).map((j) => j.id);
    expect(jobs.length).toBe(157);
    for (const id of jobs) {
      const j = JOB_LOOKS[id];
      expect(j, `job ${id}`).toBeDefined();
      expect(OUTFITS[j.outfit], `${id} outfit ${j.outfit}`).toBeDefined();
      if (j.hat) expect(HATS[j.hat], `${id} hat ${j.hat}`).toBeDefined();
      if (j.tool) expect(TOOLS[j.tool], `${id} tool ${j.tool}`).toBeDefined();
      if (j.hair) expect(HAIR[j.hair], `${id} hair ${j.hair}`).toBeDefined();
    }
    expect(Object.keys(JOB_LOOKS).sort()).toEqual([...jobs].sort());
  });

  it('every job has the two colours of its weapon set', () => {
    const sets = new Set((items<{ jobSets: { job: string; ui: { colors: string[] } }[] }>(data, 'weapons')?.jobSets ?? []).filter((s) => s.ui.colors.length >= 2).map((s) => s.job));
    for (const id of Object.keys(JOB_LOOKS)) expect(sets.has(id), id).toBe(true);
  });

  it('a life of every job draws as a complete figure', () => {
    for (const id of Object.keys(JOB_LOOKS)) {
      const L = mainLook(life({ job: id }), data);
      expect(unknownParts(L), id).toEqual([]);
      expect(L.main).toMatch(/^#[0-9a-f]{6}$/);
      expect(L.second).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('main look', () => {
  it('the stage follows the age', () => {
    for (const [age, st] of [[0, 'infant'], [3, 'infant'], [4, 'child'], [12, 'child'], [13, 'teen'], [19, 'teen'], [20, 'adult'], [54, 'adult'], [55, 'elder'], [90, 'elder']] as const) {
      expect(mainLook(life({ hAge: age }), data).stage, String(age)).toBe(st);
      expect(stageOf(age)).toBe(st);
    }
  });

  it('the same life gives the same look, another life another one', () => {
    const a = mainLook(life({ job: 'smith', hAge: 40 }), data);
    const b = mainLook(life({ job: 'smith', hAge: 40 }), data);
    expect(lookKey(a)).toBe(lookKey(b));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = mainLook(life({ id: 'L2', name: 'อีกคน', job: 'smith', hAge: 40 }), data);
    expect(lookKey(c)).not.toBe(lookKey(a));
  });

  it('a noble is dressed differently from a farmer', () => {
    const farmer = mainLook(life({ job: 'farmer', cls: 'c2' }), data);
    const noble = mainLook(life({ job: 'farmer', cls: 'c5' }), data);
    expect(farmer.outfit).toBe('tunic');
    expect(noble.outfit).toBe('noble');
    expect(noble.main).not.toBe(farmer.main);
    expect(noble.second).toBe('#c8a030');
    expect(noble.wear).toBeLessThan(farmer.wear);
    // and a ruler is dressed in the regal cut
    expect(mainLook(life({ job: 'noble', cls: 'c5' }), data).outfit).toBe('regal');
  });

  it('a bound or class-1 life is in rags and holds nothing', () => {
    const bound = mainLook(life({ job: 'knight', cls: 'c3', ext: { bondage: { level: 2 } } }), data);
    expect(bound.outfit).toBe('rags');
    expect(bound.tool).toBe('');
    expect(bound.hat).toBe('');
    expect(bound.wear).toBeGreaterThan(0.8);
    expect(mainLook(life({ job: 'knight', cls: 'c1' }), data).outfit).toBe('rags');
  });

  it('holds the weapon of the life, else the tool of the job; an infant and a child hold nothing', () => {
    expect(mainLook(life({ job: 'farmer' }), data).tool).toBe('hoe');
    const sword = (items<{ items: { id: string; group: string; type: string }[] }>(data, 'weapons')?.items ?? []).find((w) => w.type === 'ดาบ' && w.group === 'standard');
    expect(sword).toBeDefined();
    expect(mainLook(life({ job: 'farmer', items: [sword!.id] }), data).tool).toMatch(/sword/);
    expect(mainLook(life({ job: 'farmer', hAge: 2, items: [sword!.id] }), data).tool).toBe('');
    expect(mainLook(life({ job: 'farmer', hAge: 8, items: [sword!.id] }), data).tool).toBe('');
    // an old person with nothing in the hand leans on a stick
    expect(mainLook(life({ hAge: 70 }), data).tool).toBe('cane');
    expect(toolOfWeapon('ธนูยาว', 'ธนู')).toBe('bow');
    expect(toolOfWeapon('ตำราหนา', 'ค้อน')).toBe('book');
  });

  it('the marks that show are drawn only where the data says they show, and only on a body that can show them', () => {
    const L = mainLookInfo(life({ curses: ['c_oneeye', 'c_badluck'], blessings: ['b_saintmark', 'b_clover'] }), data);
    expect(L.look.feats).toContain('eyepatch');
    expect(L.look.feats).toContain('halo');
    expect(L.marks.length).toBe(2);
    for (const m of Object.values(MARKS)) expect(FEATS[m.feat], m.feat).toBeDefined();
    expect(mainLook(life({ curses: ['c_oneeye'], hAge: 6 }), data).feats).not.toContain('eyepatch');
    expect(mainLook(life({}), data, { scarred: true }).feats).toContain('scar');
    expect(mainLook(life({ curses: ['c_bald'], hAge: 30 }), data).hair).toBe('bald');
    expect(mainLook(life({ curses: ['c_limp'] }), data).body.gait).toBe('shuffle');
  });

  it('a curse or a blessing may move the age the face shows', () => {
    expect(shownAge(life({ hAge: 20, curses: ['c_fastaging'] }))).toBe(50);
    expect(mainLook(life({ hAge: 36, curses: ['c_fastaging'] }), data).stage).toBe('elder');
    // a human at fifty shows grey hair (02-races.md §1), the same human at thirty does not
    expect(mainLook(life({ hAge: 20, curses: ['c_fastaging'] }), data).hairColor).not.toBe(mainLook(life({ hAge: 20 }), data).hairColor);
    expect(mainLook(life({ hAge: 70, blessings: ['b_youth'] }), data).stage).toBe('adult');
  });

  it('reads the blood: a sub-line is the n-th line of the race, a half-blood has the ears of the second race', () => {
    const looks = items<LooksData>(data, 'looks')!;
    // every sub-line of the character data finds its line in the looks, but the one the docs do not draw (winged 4, ปีกฟ้า)
    const races = (items<{ races: { id: string; sublines?: { id: string; name: string }[] }[] }>(data, 'races')?.races ?? []);
    const missing: string[] = [];
    for (const r of races)
      for (const s of r.sublines ?? []) if (!bloodOf(data, life({ race: r.id as never, blood: s.id })).line) missing.push(s.id);
    expect(missing).toEqual(['sub_winged_4']);
    expect(bloodOf(data, life({ race: 'winged', blood: 'sub_winged_5' })).line).toBe('ปีกสั้น');
    expect(bloodOf(data, life({ race: 'beast', blood: 'sub_beast_1' })).line).toBe('หมาป่า');
    expect(bloodOf(data, life({ race: 'human', blood: 'sub_human_2' })).line).toBe('ชาวหมอก');
    expect(mainLook(life({ race: 'human', blood: 'human+elf' }), data).body.ears).toBe('long');
    expect(mainLook(life({ race: 'elf', blood: 'elf+human' }), data).body.ears).toBe('long'); // the round ears of the second race do not hide the first's
  });

  it('the summoned arrive in the clothes of the other world', () => {
    expect(mainLook(life({ blood: 'sub_human_7', hAge: 16 }), data).outfit).toBe('otherworld');
    expect(mainLook(life({ blood: 'sub_human_7', hAge: 25, job: 'farmer' }), data).outfit).toBe('tunic');
  });

  it('every race, gender, age and class paints without a missing part', () => {
    const looks = items<LooksData>(data, 'looks')!;
    let n = 0;
    for (const race of Object.keys(looks.races))
      for (const [age, cls, g, job] of [[1, 'c3', 'f', 'farmer'], [9, 'c1', 'm', 'smith'], [16, 'c2', 'n', 'hunter'], [35, 'c5', 'f', 'mage'], [70, 'c4', 'm', 'banker']] as const) {
        const L = mainLook(life({ race: race as never, hAge: age, cls, gender: g, job }), data);
        expect(unknownParts(L), `${race} ${age}`).toEqual([]);
        expect(BEARDS[L.beard] || L.beard === '').toBeTruthy();
        const f = paintPerson(L, 'idle', 0);
        expect(f.data.some((v, i) => i % 4 === 3 && v > 0), `${race} ${age} draws pixels`).toBe(true);
        n++;
      }
    expect(n).toBe(Object.keys(looks.races).length * 5);
  });

  it('the lives the game makes all get a complete look', () => {
    for (const seed of [12, 38, 24, 17, 3, 9]) {
      const s = createSession(data, { seed });
      startLife(s);
      for (let i = 0; i < 160 && s.game.state.life && !s.game.state.life.dead; i++) s.game.beat();
      const l = s.game.state.life!;
      const L = mainLook(l, data);
      expect(unknownParts(L), `seed ${seed}`).toEqual([]);
      expect(L.race).toBe(l.race);
      expect(lookKey(L)).toBe(lookKey(mainLook(l, data)));
    }
  });
});

describe('the looks the screens draw', () => {
  it('every enemy of enemies.json and every dragon of a fight has a beast', () => {
    const ids = (items<{ items: { id: string }[] }>(data, 'enemies')?.items ?? []).map((e) => e.id);
    expect(ids.length).toBeGreaterThan(150);
    expect(ids.filter((id) => !foeBeastOf(id))).toEqual([]);
    expect(foeBeastOf('dragon:ราหู')?.kind).toBe('dragon');
    expect(foeBeastOf('no_such_foe')).toBeUndefined();
  });

  it('every tie of a life with a circle gets a figure, an ally of the roster by its own id', () => {
    for (const seed of [38, 24]) {
      const s = createSession(data, { seed });
      startLife(s);
      for (let i = 0; i < 220 && s.game.state.life && !s.game.state.life.dead; i++) s.game.beat();
      const st = s.game.state;
      const ties = Object.values((st.life!.ext.bonds as { ties?: Record<string, { id: string; npc?: string }> } | undefined)?.ties ?? {});
      const looks = tieLooks(data, st);
      expect(looks.size, `seed ${seed}`).toBe(ties.length);
      for (const t of ties) {
        const L = looks.get(t.id)!;
        expect(unknownParts(L), t.id).toEqual([]);
        if (t.npc && L.key !== t.npc) expect(L.key.startsWith('race:') || L.key === t.npc).toBe(true);
      }
      const m = mainLookOf(data, st)!;
      expect(m.race).toBe(st.life!.race);
    }
  });
});
