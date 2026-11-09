// Fixes of the third overnight review (review/overnight/t3/report.md): the way a whisper was read, the end summary facts, the prompts. Offline only.
import { beforeAll, describe, expect, it } from 'vitest';
import { runLifeReport } from '../../scripts/tools/life-run';
import { loadAll } from '../../scripts/tools/node-data';
import { perLifeText } from '../../src/app/life-number';
import { lineName } from '../../src/app/views/end';
import { birthBefore } from '../../src/app/views/watch';
import type { GameData } from '../../src/core/game';
import { checkSummary, type CommandMenu, type EndingSummaryInput } from '../../src/core/llm';
import { matchTier0 } from '../../src/core/llm/command';
import { handFacts, summaryInputOf } from '../../src/core/llm/summary-input';
import { COMMAND_SYSTEM, ENDING_SYSTEM } from '../../src/core/llm/prompts';
import { ERA_NAME, PROMPT_VERSION } from '../../src/core/llm/tuning';
import { lx } from '../../src/core/lineage';
import { newGame } from '../../src/core/state';
import type { GameState, LogEntry } from '../../src/core/types';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

const menu: CommandMenu = {
  hints: [{ hint: 'จงไป', needs: 'place' }, { hint: 'ระวัง' }],
  places: [
    { id: 'HOME', name: 'ลาเฟธิล', roles: ['บ้าน'] },
    { id: 'NB', name: 'นอร์ธบรันด์' },
  ],
  people: [],
  says: { จงไป: ['กลับบ้าน', 'ออกเดินทางเถอะ'], ระวัง: ['อย่าประมาท'] },
};

describe('how tier 0 read the words', () => {
  it('names the hint by its own name or by a phrase of the table, and the target by name or by a role word', () => {
    expect(matchTier0('จงไป นอร์ธบรันด์', menu)).toMatchObject({ draft: { hint: 'จงไป', target: 'NB' }, via: { hint: 'name', target: 'name' } });
    expect(matchTier0('กลับบ้านเถิด แม่รออยู่', menu)).toMatchObject({ draft: { hint: 'จงไป', target: 'HOME' }, via: { hint: 'phrase', target: 'role', role: 'บ้าน' } });
    expect(matchTier0('อย่าประมาทนะ', menu).via).toEqual({ hint: 'phrase' });
  });

  it('a phrase with no place asks for the place (rule 8) instead of guessing', () => {
    expect(matchTier0('ออกเดินทางเถอะ โลกกว้างรออยู่', menu)).toMatchObject({ draft: null, ask: { hint: 'จงไป', needs: 'place' } });
  });
});

describe('the prompts', () => {
  it('say what each hint means, and the version moved with them', () => {
    for (const h of ['ระวัง', 'กล้าเถิด', 'จงไป', 'จงอยู่', 'จุดอ่อนของศัตรู', 'คนนั้นโกหก', 'ช่วย', 'สางเรื่อง', 'ชี้ทายาท']) expect(COMMAND_SYSTEM).toContain(h);
    expect(PROMPT_VERSION).toBeGreaterThanOrEqual(5);
  });

  it('the ending prompt keeps prayers and miracles apart, wants the birth and the travels, forbids a zero count and other eras', () => {
    expect(ENDING_SYSTEM).toMatch(/prayer is something the character asked/);
    expect(ENDING_SYSTEM).toMatch(/orphan/);
    expect(ENDING_SYSTEM).toMatch(/ศูนย์/);
    expect(ENDING_SYSTEM).toMatch(/`era`/);
  });
});

describe('the facts of the end summary', () => {
  it('tell prayers and miracles as separate facts and never a count of zero', () => {
    const f = handFacts({ 'prayer.give': 2, 'prayer.strange': 1, miracle: 1, 'prayer.punish': 0 });
    expect(f).toHaveLength(2);
    expect(f[0]).toContain('3 ครั้ง');
    expect(f[1]).toContain('ปาฏิหาริย์');
    expect(f.join('')).not.toMatch(/\b0 ครั้ง|ศูนย์/);
    expect(handFacts({})).toEqual([]);
  });

  it('a real life: the era name goes with the input, no fact counts nothing, the birth and the travels stay', () => {
    const run = runLifeReport(data, { seed: 1 });
    const input = summaryInputOf(data, run.state)!;
    expect(input.era).toBe(ERA_NAME);
    expect(input.facts.join(' ')).not.toMatch(/ศูนย์/);
    expect(input.facts.length).toBeLessThanOrEqual(14);
  });

  it('the check refuses a zero count and an era the game does not name', () => {
    const input: EndingSummaryInput = {
      lifeId: 'L1',
      name: 'ทอร์เวน',
      pronoun: 'เขา',
      race: 'มนุษย์',
      age: 70,
      ending: 'ผู้กลับคืนบ้าน',
      era: ERA_NAME,
      facts: ['เกิดในครอบครัวชาวนา', 'ตายเมื่ออายุ 70'],
      template: 'ทอร์เวน',
    };
    const pad = ' เขาใช้ชีวิตเรียบง่ายและเป็นที่รักของคนรอบตัวตลอดมาจนวาระสุดท้ายของชีวิตที่ยาวนาน';
    expect(checkSummary(`ทอร์เวนเกิดในครอบครัวชาวนา และตายเมื่ออายุ 70 ไม่มีผู้สืบ${pad}`, input).ok).toBe(true);
    expect(checkSummary(`ทอร์เวนเกิดในครอบครัวชาวนา และตายเมื่ออายุ 70 ทิ้งทายาทอีกศูนย์คน${pad}`, input).ok).toBe(false);
    expect(checkSummary(`ทอร์เวนเกิดในครอบครัวชาวนา ในยุคแห่งเปลวไฟ และตายเมื่ออายุ 70${pad}`, input).ok).toBe(false);
  });
});

const entry = (n: number, sys: string, kind: string, data: Record<string, unknown> = {}): LogEntry => ({ n, sys, kind, id: '', data, level: 2, worldYear: 10000 + n } as unknown as LogEntry);

describe('the screen numbers per life, the recap starts at the birth, the family is the line', () => {
  it('counts prayers from the first of each life', () => {
    const st = newGame(1) as GameState;
    st.log = [entry(1, 'character', 'birth'), entry(2, 'god', 'prayer', { n: 1 }), entry(3, 'god', 'prayer', { n: 2 }), entry(4, 'character', 'birth'), entry(5, 'god', 'prayer', { n: 7 }), entry(6, 'god', 'prayer.give', { n: 7 })];
    st.logN = 6;
    expect(perLifeText(st, st.log[4], 'คำอธิษฐานใบที่ 7: ขอพร')).toBe('คำอธิษฐานใบที่ 1: ขอพร');
    expect(perLifeText(st, st.log[5], 'ท่านให้ตามคำอธิษฐานใบที่ 7 (ขอพร)')).toBe('ท่านให้ตามคำอธิษฐานใบที่ 1 (ขอพร)');
    expect(perLifeText(st, st.log[2], 'คำอธิษฐานใบที่ 2: ก')).toBe('คำอธิษฐานใบที่ 2: ก');
    expect(birthBefore(st, 5)).toBe(4);
    expect(birthBefore(st, 3)).toBe(1);
  });

  it('names the family after the founder of the current line (a newcomer starts a new one)', () => {
    const st = newGame(1) as GameState;
    st.lineage.lives = [
      { id: 'L1', name: 'ตราดุสวัน', race: 'human', born: 0, died: 1 },
      { id: 'L2', name: 'นาดอร์', race: 'human', born: 2, died: 3 },
    ];
    const rec = (id: string, generation: number, origin: 'first' | 'heir' | 'newcomer') => ({ id, generation, origin, startAge: 0, startYear: 0, age: 0, cause: '', startN: 0, endN: 0, threads: [] });
    lx(st).dynasty = 'ตราดุสวัน';
    lx(st).recs = [rec('L1', 1, 'first'), rec('L2', 0, 'newcomer')];
    expect(lineName(st)).toBe('นาดอร์');
    lx(st).recs = [rec('L1', 1, 'first'), rec('L2', 2, 'heir')];
    expect(lineName(st)).toBe('ตราดุสวัน');
  });
});
