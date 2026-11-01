import { describe, expect, it } from 'vitest';
import { parseCell, parseChoice } from '../../scripts/codegen/lib/effects';
import { idIndex } from '../../scripts/codegen/lib/ids';
import { tables } from '../../scripts/codegen/lib/table';

const ids = idIndex();

describe('effect grammar (code-plan §5.2)', () => {
  it('reads weight, chance, jump and trait multiplier', () => {
    const { choice, unparsed } = parseChoice('c', '10 หนีไปก่อนพิธี (`freedom` ×3) · ข้ามไป hu.a1 เร็วขึ้นสองปี', ids);
    expect(choice.weight).toBe(10);
    expect(choice.mods).toEqual([{ cond: { k: 'has', kind: 'trait', id: 'freedom' }, mul: 3 }]);
    expect(choice.effects).toContainEqual({ k: 'jump', to: 'hu.a1', years: 2 });
    expect(unparsed).toEqual([]);
  });
  it('reads a curse with a chance and a gold change', () => {
    const p = parseCell('35 ช่วยแม่ · `b_courage` 10% · ทอง −50', ids, { weighted: true });
    expect(p.weight).toBe(35);
    expect(p.effects).toContainEqual({ k: 'grant', kind: 'blessing', id: 'b_courage', chance: 0.1 });
    expect(p.effects).toContainEqual({ k: 'stat', stat: 'ทอง', delta: -50 });
  });
  it('reads a job, a convergence and an aptitude level', () => {
    const p = parseCell('40 ขึ้นเป็นผู้ใหญ่บ้าน · `mayor` `noble` → cv.2 · ต้องมี `sword_3`', ids, { weighted: true });
    expect(p.effects).toContainEqual({ k: 'grant', kind: 'job', id: 'mayor' });
    expect(p.effects).toContainEqual({ k: 'converge', to: 'cv.2' });
    expect(p.effects).toContainEqual({ k: 'grant', kind: 'aptitude', id: 'sword', level: 3 });
  });
  it('reads an event-gated convergence and battle enemies', () => {
    const p = parseCell('ถ้า MC-03 หรือ MC-04 เกิด → cv.9 · `wolf` ฝูง ศึก', ids);
    expect(p.effects[0]).toEqual({
      k: 'if',
      cond: { k: 'or', of: [{ k: 'event', id: 'MC-03', happened: true }, { k: 'event', id: 'MC-04', happened: true }] },
      then: [{ k: 'converge', to: 'cv.9' }],
    });
    expect(p.effects).toContainEqual({ k: 'battle', enemies: ['wolf'] });
  });
  it('the table reader finds the human node table', () => {
    const t = tables('docs/lore/storylines/01-human.md').find((x) => x.rows.some((r) => r.cells[0] === 'hu.t1'));
    expect(t?.header.length).toBe(7);
    expect(t?.rows.length).toBe(14);
  });
});

describe('effect grammar additions', () => {
  it('reads an era-gated convergence and an aptitude raise', () => {
    const p = parseCell('20 ยุค 4 → cv.16 · `bow` +1', ids, { weighted: true });
    expect(p.effects).toContainEqual({ k: 'if', cond: { k: 'era', min: 4 }, then: [{ k: 'converge', to: 'cv.16' }] });
    expect(p.effects).toContainEqual({ k: 'stat', stat: 'bow', delta: 1 });
    expect(p.unparsed).toEqual([]);
  });
});
