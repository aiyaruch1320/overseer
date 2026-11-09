// T2-1: every "ได้แน่นอน" of the birth card is true in the life, over many seeds and not only at the birth, and a "แนวโน้ม" really tilts it
// (docs/systems/character/19-wish.md §2, 20-wish-synonyms.md). Real data, real lives.
import { beforeAll, describe, expect, it } from 'vitest';
import { extOf, readWish } from '../../src/core/character';
import type { GameData } from '../../src/core/game';
import { loadAll } from '../../scripts/tools/node-data';
import { lines } from '../../src/core/text';
import { createSession, runToDeath, startLife, type Session } from '../../scripts/tools/session';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

type Life = ReturnType<typeof startLife>;
function live(text: string, seed: number, run = false): { s: Session; life: Life; log: { sys: string; kind: string; id?: string; age?: number; data: Record<string, unknown> }[] } {
  const r = text ? readWish(data, { text, mode: null, picks: {} }) : null;
  const s = createSession(data, { seed, ...(r?.ask.race ? { race: r.ask.race } : {}), ...(r?.ask.country ? { country: r.ask.country } : {}), ...(r ? { wish: r.sheet } : {}) });
  const life = startLife(s);
  if (run) runToDeath(s.game);
  else s.game.beat(); // the first beat does the late part of the wish
  return { s, life, log: s.game.state.log as never };
}
const ties = (life: Life) => Object.values((life.ext.bonds as { ties: Record<string, { kin?: string; state: string; light: boolean }> }).ties);
const alive = (life: Life, kins: string[]) => ties(life).filter((t) => t.light && t.state === 'alive' && kins.includes(t.kin ?? '')).length;

/** The peoples of the origin file keep one elder 'parent' tie instead of a father and a mother. */
const PARENTS = ['father', 'mother', 'parent'];
const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

describe('a sure ask is true in every life', () => {
  it('orphan: no living parent at any time, no prayer of the mother, 50 of 50 lives', () => {
    for (const seed of SEEDS) {
      const { life, log } = live('อยากเป็นเด็กกำพร้า', seed, true);
      expect(alive(life, PARENTS), `seed ${seed}`).toBe(0);
      expect(log.filter((e) => e.sys === 'god' && e.kind === 'prayer' && e.id === 'mother'), `seed ${seed}`).toHaveLength(0);
    }
  });

  it('the line of the birth says the life is an orphan', () => {
    const { log } = live('อยากเป็นเด็กกำพร้า', 3);
    const fam = log.find((e) => e.sys === 'text' && e.kind === 'family');
    expect(fam?.data.orphan).toBe(true);
  });

  const kinds: { name: string; text: string; ok: (life: Life) => boolean }[] = [
    { name: 'race', text: 'ดาร์กเอลฟ์', ok: (l) => l.race === 'darkelf' },
    { name: 'gender', text: 'มนุษย์ หญิง', ok: (l) => l.gender === 'f' },
    { name: 'class', text: 'มนุษย์ รวย', ok: (l) => l.cls === 'c4' },
    { name: 'continent', text: 'คนแคระ ทวีปซาฮารัน', ok: (l) => l.country.startsWith('SH') },
    { name: 'country', text: 'มนุษย์ เกิดที่อัลเดรีย', ok: (l) => l.country.startsWith('AL') },
    { name: 'place kind', text: 'คนแคระ ถิ่นพลัดถิ่น', ok: (l) => extOf(l).born === 'diaspora' },
    { name: 'sign', text: 'ดาวหาง', ok: (l) => extOf(l).sign === 'comet' },
    { name: 'time', text: 'กลางคืน', ok: (l) => extOf(l).time === 'night' },
    { name: 'religion', text: 'ศรัทธาต้นไม้โลก', ok: (l) => extOf(l).faith === 'faith.03' },
    { name: 'trait', text: 'ขี้ขลาด', ok: (l) => l.traits.includes('coward') },
    { name: 'aptitude', text: 'ดาบ', ok: (l) => (l.aptitudes.sword ?? 0) >= 1 },
    { name: 'blessing', text: 'พรแห่งกระทิง', ok: (l) => l.blessings.includes('b_bull') },
    { name: 'curse', text: 'คำสาปค่าหัว', ok: (l) => l.curses.includes('c_wanted') },
    { name: 'half-blood', text: 'ฮาล์ฟเอลฟ์', ok: (l) => l.flags.includes('half') },
    { name: 'special birth', text: 'ผู้ถูกอัญเชิญ', ok: (l) => extOf(l).special === 'summoned' },
    { name: 'family: one parent', text: 'พ่อหรือแม่คนเดียว', ok: (l) => alive(l, PARENTS) === 1 },
    { name: 'family: only child', text: 'ลูกคนเดียว', ok: (l) => alive(l, ['elder_sibling', 'younger_sibling']) === 0 },
    { name: 'family: many', text: 'พี่น้องเยอะ', ok: (l) => alive(l, ['elder_sibling', 'younger_sibling']) >= 4 },
  ];
  for (const k of kinds) {
    it(`${k.name}: ${k.text} (50 of 50)`, () => {
      let kept = 0;
      for (const seed of SEEDS) {
        const { life } = live(k.text, seed);
        // an ask the birth could not keep is refused on the sheet with a reason (20-wish-synonyms.md §9): the card then says so; every other one is true
        const refused = extOf(life).wish?.born?.refused.length ?? 0;
        if (refused) continue;
        kept++;
        expect(k.ok(life), `seed ${seed}`).toBe(true);
      }
      expect(kept).toBeGreaterThanOrEqual(45);
    });
  }
});

describe('a tendency tilts the life', () => {
  it('the wish to travel: far more lives set out than without it', () => {
    const count = (text: string) => {
      let any = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const { log } = live(text, seed, true);
        if (log.some((e) => e.sys === 'travel' && e.kind === 'cause')) any++;
      }
      return any;
    };
    const base = count('');
    const wished = count('อยากเดินทาง');
    expect(wished).toBeGreaterThan(base * 1.2);
  });
});

describe('prayers do not repeat their words (T2-4)', () => {
  it('two prayers of one kind in a life are told in different words while another text is left, and the answers differ', () => {
    let pairs = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const { s } = live('', seed, true);
      const all = lines(data, s.game.state.log as never, 0);
      const ask = new Map<string, string[]>();
      const give = new Map<string, string[]>();
      for (const l of all) {
        if (l.sys !== 'god') continue;
        const k = String(l.entry.id);
        const story = l.text.split(' — ')[1]?.replace(/ \(ขอเรื่องเดิม.*\)$/, '');
        if (!story) continue;
        if (l.entry.kind === 'prayer') ask.set(k, [...(ask.get(k) ?? []), story]);
        if (l.entry.kind === 'prayer.give') give.set(k, [...(give.get(k) ?? []), story]);
      }
      for (const m of [ask, give]) {
        for (const v of m.values()) {
          for (let i = 1; i < v.length; i++) {
            pairs++;
            expect(v[i], `seed ${seed}`).not.toBe(v[i - 1]);
          }
        }
      }
    }
    expect(pairs).toBeGreaterThan(5);
  });
});
