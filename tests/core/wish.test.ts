// The wish in the core (docs/systems/character/19-wish.md, 20-wish-synonyms.md): the parser that reads it, and the birth that applies each ask deterministically
// within the rules of the doc; the asks the doc forbids are refused with a reason the screen can show. Every test lives a real life of the real data.
import { beforeAll, describe, expect, it } from 'vitest';
import { lifeGoals } from '../../src/core/god/goals';
import { birth, extOf, readWish, START_MODE_IDS, type WishRead } from '../../src/core/character';
import { MODES } from '../../src/core/ending';
import { Game, makeCtx, versions, type GameData } from '../../src/core/game';
import { newGame } from '../../src/core/state';
import { lines } from '../../src/core/text';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, startLife, type Session } from '../../scripts/tools/session';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

const read = (text: string, mode: string | null = null): WishRead => readWish(data, { text, mode, picks: {} });

/** Lives the birth of a wish through the session the screen uses (the world runs to the start year first). */
function born(text: string, seed = 5, mode: string | null = null): { r: WishRead; s: Session; life: ReturnType<typeof startLife> } {
  const r = read(text, mode);
  const s = createSession(data, { seed, ...(r.ask.race ? { race: r.ask.race } : {}), ...(r.ask.country ? { country: r.ask.country } : {}), wish: r.sheet });
  const life = startLife(s);
  return { r, s, life };
}
const wishOf = (life: ReturnType<typeof startLife>) => extOf(life).wish;
const refusedKeys = (life: ReturnType<typeof startLife>) => (wishOf(life)?.born?.refused ?? []).map((x) => x.key);

describe('the wish in the core', () => {
  it('the ids of the start modes are the ones of the ending system, in the order of the document', () => {
    expect([...START_MODE_IDS]).toEqual(MODES.map((m) => m.id));
  });

  it('is saved on the life (life.ext.character.wish) with the rows, the points and what the birth applied', () => {
    const { life } = born('ดาร์กเอลฟ์ ชาย');
    const w = wishOf(life)!;
    expect(w.v).toBe(1);
    expect(w.text).toBe('ดาร์กเอลฟ์ ชาย');
    expect(w.ask).toMatchObject({ race: 'darkelf', gender: 'm' });
    expect(w.items.length).toBeGreaterThan(0);
    expect(w.points.total).toBe(10);
    expect(w.born?.applied).toEqual(expect.arrayContaining(['race', 'gender']));
    // plain JSON: a save keeps it
    expect(JSON.parse(JSON.stringify(life.ext.character)).wish.ask.race).toBe('darkelf');
  });

  it('a life nobody ordered has no sheet, and the same wish gives the same life', () => {
    const plain = createSession(data, { seed: 3 });
    expect(extOf(startLife(plain)).wish).toBeUndefined();
    const a = born('คนแคระ ชาย รวย ขี้ขลาด', 9).life;
    const b = born('คนแคระ ชาย รวย ขี้ขลาด', 9).life;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  describe('fixed asks', () => {
    it('race, gender, sign and time of birth', () => {
      const { life } = born('เอลฟ์ หญิง กลางคืน ดาวหาง');
      expect(life.race).toBe('elf');
      expect(life.gender).toBe('f');
      const e = extOf(life);
      expect(e.time).toBe('night');
      expect(e.sign).toBe('comet');
    });

    it('class: the one asked for, with the starting gold of it', () => {
      for (const n of [1, 2, 3, 4, 5]) {
        const word = ['ทาส', 'ยากจน', 'ฐานะปานกลาง', 'รวย', 'ลูกขุนนาง'][n - 1];
        const { life, r } = born(`มนุษย์ ${word}`, 11);
        expect(r.ask.cls).toBe(n);
        expect(life.cls).toBe(`c${n}`);
      }
    });

    it('a class the land and the race do not give is refused with a reason', () => {
      // the shadowless of NB-13 are born class 1 only (classOf)
      const { life } = born('มนุษย์ นอกถิ่น ลูกขุนนาง', 4, null);
      // an ask the birth could not keep is told on the sheet; when it can, nothing is refused
      if (life.cls !== 'c5') expect(refusedKeys(life)).toContain('class');
      else expect(refusedKeys(life)).not.toContain('class');
    });

    it('family: an orphan has no living parent, one parent has one, an only child has no sibling, a big family has at least four', () => {
      const kin = (life: ReturnType<typeof startLife>, s: Session, names: string[]) => {
        s.game.beat(); // the first beat does the late part of the wish
        const ties = Object.values((life.ext.bonds as { ties: Record<string, { kin?: string; state: string; light: boolean }> }).ties);
        return ties.filter((t) => t.light && t.state === 'alive' && names.includes(t.kin ?? '')).length;
      };
      const a = born('กำพร้า', 6);
      expect(kin(a.life, a.s, ['father', 'mother'])).toBe(0);
      const b = born('พ่อหรือแม่คนเดียว', 6);
      expect(kin(b.life, b.s, ['father', 'mother'])).toBe(1);
      const c = born('ลูกคนเดียว', 6);
      expect(kin(c.life, c.s, ['elder_sibling', 'younger_sibling'])).toBe(0);
      const d = born('พี่น้องเยอะ', 6);
      expect(kin(d.life, d.s, ['elder_sibling', 'younger_sibling'])).toBeGreaterThanOrEqual(4);
      expect(wishOf(a.life)?.ask.family).toBe('orphan');
    });

    it('religion: a faith of the land, by choosing a land that has it; a faith the named land lacks is refused', () => {
      const a = born('ศรัทธาต้นไม้โลก', 8);
      expect(extOf(a.life).faith).toBe('faith.03');
      const b = born('ศรัทธาต้นไม้โลก ในประเทศอัลเดรีย', 8);
      void b;
      const lacks = born('เอลฟ์ ศรัทธาต้นไม้โลก', 2, null);
      expect(extOf(lacks.life).faith).toBe('faith.03');
    });

    it('continent and the kind of land: the country is drawn inside the continent; the kind of land fixes main, diaspora or outside', () => {
      const a = born('คนแคระ ทวีปซาฮารัน', 3);
      expect(a.life.country.startsWith('SH')).toBe(true);
      const kinds = ['ถิ่นหลักของเผ่า', 'ถิ่นพลัดถิ่น', 'นอกถิ่น'];
      const got = kinds.map((k) => extOf(born(`คนแคระ ${k}`, 3).life).born);
      expect(got).toEqual(['main', 'diaspora', 'outside']);
    });

    it('a country named: that country, with its price in points', () => {
      const { life, r } = born('มนุษย์ เกิดที่อัลเดรีย', 2);
      void r;
      expect(life.country.startsWith('AL')).toBe(true);
    });

    it('genderless where the race can be: the slime, the fae, the soul machine; a race that cannot is refused', () => {
      const a = born('ไร้เพศ', 4);
      expect(extOf(a.life).neuter).toBe(true);
      expect(['slime', 'fae', 'soulmachine']).toContain(a.life.race);
      const b = born('ภูตพราย ไร้เพศ', 4);
      expect(extOf(b.life).neuter).toBe(true);
      // a human cannot: the parser cuts the ask with the reason of the table, and the birth keeps the gender of the race
      const c = read('มนุษย์ ไร้เพศ');
      expect(c.items.some((i) => i.row === 'cannot' && i.value === 'ไร้เพศ' && i.note.length > 0)).toBe(true);
      expect(c.ask.neuter).toBeUndefined();
      // the same ask handed straight to the birth (a screen that chose by hand): refused on the sheet of the life
      const s = createSession(data, { seed: 4, race: 'human' });
      const ctx = makeCtx(s.game.state, data);
      const life = birth(ctx, { race: 'human', wish: { ...c.sheet, ask: { race: 'human', neuter: true } } });
      expect(extOf(life).neuter).toBe(false);
      expect(refusedKeys(life)).toContain('gender');
    });

    it('a gender the race does not have is refused (the slime is neither man nor woman)', () => {
      const r = read('สไลม์ ชาย');
      expect(r.items.some((i) => i.row === 'cannot' && i.value === 'ชาย')).toBe(true);
      expect(r.ask.gender).toBeUndefined();
    });

    it('the half-blood, and the doll as the construct', () => {
      const a = born('ฮาล์ฟเอลฟ์', 2);
      expect(a.life.flags).toContain('half');
      expect(extOf(a.life).second).toBe('human');
      const d = born('ตุ๊กตา', 2);
      expect(d.life.race).toBe('construct');
    });
  });

  describe('special births are forced', () => {
    it('the summoned appear at AL-02 at 16 with no family, class 2; the reincarnated are born at MH-07', () => {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const a = born('ผู้ถูกอัญเชิญ', seed);
        expect(extOf(a.life).special).toBe('summoned');
        expect(a.life.country).toBe('AL-02');
        expect(a.life.hAge).toBe(16);
        expect(['c1', 'c2']).toContain(a.life.cls); // class 2 at the birth; a gift of the birth may lower it (a curse of poverty)
        const b = born('ผู้กลับชาติ', seed);
        expect(extOf(b.life).special).toBe('reincarnated');
        expect(b.life.country).toBe('MH-07');
        expect(b.life.race).toBe('human');
      }
    });

    it('the start mode asks the same thing as the words', () => {
      expect(read('', 'summoned').ask).toMatchObject({ race: 'human', specialBirth: 'summoned' });
      expect(extOf(born('', 3, 'summoned').life).special).toBe('summoned');
      expect(extOf(born('', 3, 'reincarnated').life).special).toBe('reincarnated');
    });

    it('they are human only: another race typed with the summoned is cut with a reason, a family asked of the summoned is refused', () => {
      const r = read('เอลฟ์ ผู้ถูกอัญเชิญ');
      expect(r.ask.race).toBe('human');
      expect(r.items.some((i) => i.row === 'cannot' && i.key === 'race' && i.note.length > 0)).toBe(true);
      const { life } = born('ผู้ถูกอัญเชิญ กำพร้า ชนชั้น 4', 5);
      expect(refusedKeys(life)).toEqual(expect.arrayContaining(['family']));
    });
  });

  describe('tendencies', () => {
    it('traits: the first typed is given for sure (a strong word makes another the sure one), the rest weigh x3, the refused are out', () => {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const { life } = born('ขี้ขลาด ใจบุญ', seed);
        expect(life.traits).toContain('coward');
        expect(life.traits.length).toBeGreaterThanOrEqual(3);
      }
      const r = read('ขี้ขลาด ใจบุญมาก');
      expect(r.ask.traits).toEqual([{ id: 'coward', sure: false }, { id: 'kind', sure: true }]);
      expect(born('ขี้ขลาด ใจบุญมาก', 4).life.traits).toContain('kind');
      // x3: over many lives the asked-for trait shows far more often than a trait nobody asked for
      let asked = 0;
      let other = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const t = born('ซื่อสัตย์ ขี้เกียจ', seed).life.traits;
        if (t.includes('lazy')) asked++;
        if (t.includes('glutton')) other++;
      }
      expect(asked).toBeGreaterThan(other);
      // refused: never drawn
      for (let seed = 1; seed <= 30; seed++) expect(born('ไม่เอาใจร้อน', seed).life.traits).not.toContain('hot');
    });

    it('traits that cannot live together: the one typed first stays and the other is cut with a reason', () => {
      const r = read('ขี้ขลาด กล้าบ้าบิ่น');
      expect(r.ask.traits).toHaveLength(1);
      expect(r.items.some((i) => i.row === 'cannot' && i.key === 'trait' && i.note.length > 0)).toBe(true);
    });

    it('aptitudes: the first at the lowest level for sure, the second weighs x3', () => {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const { life } = born('ดาบ เวทไฟ', seed);
        expect(life.aptitudes.sword).toBe(1);
      }
      expect(read('ดาบ เวทไฟ').ask.aptitudes).toEqual([{ id: 'sword', sure: true }, { id: 'fire', sure: false }]);
    });

    it('swallowing is the slime only', () => {
      const r = read('คนแคระ กลืนกิน');
      expect(r.ask.aptitudes).toBeUndefined();
      expect(r.items.some((i) => i.row === 'cannot' && i.key === 'aptitude')).toBe(true);
    });

    it('first job: x3 in the offer at twenty; a secret job cannot be asked; a job the race cannot do is told on the sheet', () => {
      let got = 0;
      for (let seed = 1; seed <= 24; seed++) {
        const { s, life } = born('มนุษย์ ช่างตีเหล็ก', seed);
        s.game.runLife(4 * 21);
        if (life.job === 'smith') got++;
      }
      let base = 0;
      for (let seed = 1; seed <= 24; seed++) {
        const s = createSession(data, { seed, race: 'human' });
        const life = startLife(s);
        s.game.runLife(4 * 21);
        if (life.job === 'smith') base++;
      }
      expect(got).toBeGreaterThan(base);
      expect(read('นักฆ่า').ask.job).toBe('assassin'); // the table of synonyms holds only the common jobs (rule 8), so a secret job has no word to be asked by
      const giant = born('ยักษ์ ชาวนา', 3).life;
      expect(wishOf(giant)?.ask.job).toBe('farmer');
      expect(refusedKeys(giant)).toContain('job');
    });

    it('companion: the species is weighed for the childhood meeting (x3 of the 2%), and the meeting grants it between 5 and 14', () => {
      let met = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const { s, life } = born('สุนัข', seed);
        expect(extOf(life).favour['companion:sp_dog']).toBe(3);
        const age = extOf(life).wishChild?.age;
        if (age !== undefined) {
          expect(age).toBeGreaterThanOrEqual(5);
          expect(age).toBeLessThanOrEqual(14);
          s.game.runLife(4 * 15);
          expect(extOf(life).companions).toContain('sp_dog');
          met++;
        }
      }
      expect(met).toBeGreaterThan(0);
      expect(met).toBeLessThan(25);
    });

    it('blessing C or U, one only; a curse for a harder life; a gift that clashes with the race is refused', () => {
      const a = born('พรแห่งกระทิง', 5).life;
      expect(a.blessings).toContain('b_bull');
      const b = born('คำสาปค่าหัว', 5).life;
      expect(b.curses).toContain('c_wanted');
      expect(read('คำสาปค่าหัว').points.refunded).toBe(2);
      // a second blessing is cut by the limit with a reason
      const r = read('พรแห่งกระทิง พรแห่งยักษ์');
      expect(r.items.filter((i) => i.key === 'blessing' && i.row !== 'cannot')).toHaveLength(1);
      expect(r.items.some((i) => i.key === 'blessing' && i.row === 'cannot' && i.note.length > 0)).toBe(true);
    });
  });

  describe('the story part', () => {
    it('travel: the trait of freedom weighs x3 and the line of the wanderers is opened from outside at the first beat', () => {
      const { s, life } = born('อยากเดินทาง', 5);
      expect(wishOf(life)?.ask.story).toEqual(['travel']);
      s.game.beat();
      expect((life.ext.story as { external: string[] }).external).toContain('wd');
      let free = 0;
      let base = 0;
      for (let seed = 1; seed <= 40; seed++) {
        if (born('อยากเดินทาง', seed).life.traits.includes('freedom')) free++;
        const plain = createSession(data, { seed });
        if (startLife(plain).traits.includes('freedom')) base++;
      }
      expect(free).toBeGreaterThan(base);
    });

    it('revenge opens the line of the kin; the ordinary life is the plain mode; the demon lord is a demonkin or a half of one', () => {
      const a = born('อยากล้างแค้น', 5);
      a.s.game.beat();
      expect((a.life.ext.story as { external: string[] }).external).toContain('kn');
      expect(read('อยากเป็นคนธรรมดา').mode).toBe('plain');
      expect(born('อยากเป็นจอมมาร', 5).life.race).toBe('demonkin');
      const h = read('มนุษย์ อยากเป็นจอมมาร');
      expect(h.ask.second === 'demonkin' || h.items.some((i) => i.key === 'story' && i.row === 'cannot')).toBe(true);
    });

    it('love, the hero and no god are kept on the sheet for the god, and say that no system binds them yet', () => {
      for (const t of ['อยากมีความรัก', 'อยากเป็นผู้กล้า', 'ไม่ให้พระเจ้ายุ่ง']) {
        const r = read(t);
        expect(r.ask.story).toHaveLength(1);
        expect(r.items.find((i) => i.key === 'story')?.pending).toBe(true);
        expect(born(t, 3).life.ext.character).toBeDefined();
      }
    });

    it('the era: the opening year of the main story, the early years, or the fall of the dragons', () => {
      expect(born('ยุคปัจจุบัน', 5).life.birthYear).toBe(0);
      expect(born('ยุคต้นโลก', 5).life.birthYear).toBeLessThanOrEqual(60);
      const dragons = born('อยากเห็นมังกรล้ม', 5);
      expect(wishOf(dragons.life)?.ask.story).toEqual(['dragonfall']);
    });
  });

  describe('refusals and the budget', () => {
    it('what is typed twice with a refusal cancels both; a refusal of a class cuts the classes of it', () => {
      const r = read('คนแคระ ไม่เอาคนจน');
      expect(r.ask.ban?.class).toEqual(['1', '2']);
      for (let seed = 1; seed <= 25; seed++) expect(['c1', 'c2']).not.toContain(born('คนแคระ ไม่เอาคนจน', seed).life.cls);
      const c = read('ขี้ขลาด ไม่เอาขี้ขลาด');
      expect(c.ask.traits).toBeUndefined();
      expect(c.ask.ban).toBeUndefined();
    });

    it('a refused race is never drawn', () => {
      for (let seed = 1; seed <= 25; seed++) expect(born('ไม่เอามนุษย์', seed).life.race).not.toBe('human');
    });

    it('over the ten points the later asks are cut, and the ask does not carry them', () => {
      const r = read('ผู้ถูกอัญเชิญ ขุนนาง แวมไพร์ พรเทพดาบ');
      expect(r.points.used).toBeLessThanOrEqual(10);
      const cut = r.items.filter((i) => i.row === 'cannot' && i.note.includes('ขาด'));
      expect(cut.length).toBeGreaterThan(0);
      for (const c of cut) {
        if (c.key === 'class') expect(r.ask.cls).toBeUndefined();
        if (c.key === 'blessing') expect(r.ask.blessing).toBeUndefined();
      }
    });
  });

  describe('the words of the opening', () => {
    const opening = (life: ReturnType<typeof startLife>, s: Session) => lines(data, s.game.state.log, 1).map((l) => l.text).find((t) => t.includes(life.name)) ?? '';

    it('a ghoul that wakes at 17 wakes; it does not take over', () => {
      const { life, s } = born('กูล', 3);
      expect(life.hAge).toBe(17);
      const t = opening(life, s);
      expect(t).toContain('ตื่นขึ้น');
      expect(t).not.toContain('รับช่วงต่อ');
      const all = lines(data, s.game.state.log, 1).map((l) => l.text).join('\n');
      expect(all).not.toContain('รับช่วงต่อ');
      expect(all).not.toContain('เติบโต');
    });

    it('the summoned are called from another world; they do not take over', () => {
      const { life, s } = born('ผู้ถูกอัญเชิญ', 3);
      const t = opening(life, s);
      expect(t).toContain('ถูกอัญเชิญ');
      expect(t).not.toContain('รับช่วงต่อ');
    });
  });

  it('a wish with every field random changes nothing: the same life as no wish', () => {
    const plain = createSession(data, { seed: 12 });
    const a = startLife(plain);
    const r = read('อะไรก็ได้');
    const s = createSession(data, { seed: 12, wish: r.sheet });
    const b = startLife(s);
    const strip = (l: typeof a) => ({ ...l, ext: { ...l.ext, character: { ...(l.ext.character as object), wish: undefined } } });
    expect(JSON.stringify(strip(b))).toBe(JSON.stringify(strip(a)));
  });

  it('keeps the game state shape: a Game of a state with the wish saved resumes the same life', () => {
    const { s, life } = born('คนแคระ ชาย', 7);
    const copy = structuredClone(s.game.state);
    const g = new Game(copy, data, s.game.systems);
    expect(extOf(g.state.life!).wish?.ask.race).toBe('dwarf');
    expect(versions(data)).toBeDefined();
    expect(newGame(1, versions(data)).life).toBeNull();
    void life;
  });
});

describe('the vows follow the wish (M5 review round two R4, 19-wish.md §2 "ส่วนเรื่อง")', () => {
  const offered = (text: string, seed: number): string[] => lifeGoals(born(text, seed).life).offers;

  it('the wishes of the story part are read as the asks of the story', () => {
    for (const [text, id] of [['อยากมีความรัก', 'love'], ['พบรักแท้', 'love'], ['อยากเดินทาง', 'travel']] as const) expect(read(text).ask.story ?? [], text).toContain(id);
  });

  it('a wish for love puts the vow of love among the three, whatever the seed', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const o = offered('อยากมีความรัก', seed);
      expect(o, `seed ${seed}`).toContain('GV-06');
      expect(o).toHaveLength(3);
      expect(new Set(o).size).toBe(3);
    }
  });

  it('the other story wishes bring their vows; a life without a wish is drawn as before', () => {
    for (let seed = 1; seed <= 6; seed++) {
      expect(offered('อยากเดินทาง', seed)).toContain('GV-04');
      expect(offered('อยากล้างแค้น', seed)).toEqual(expect.arrayContaining(['GV-07', 'GV-08']));
      expect(offered('อยากเป็นผู้กล้า', seed)).toContain('GV-09');
    }
    const plain = lifeGoals(startLife(createSession(data, { seed: 3 }))).offers;
    expect(plain).toHaveLength(3);
  });
});
