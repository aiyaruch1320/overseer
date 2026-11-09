// L1 (review M4 G5): the check of a retelling refuses a name the game did not give for this life and a number the facts do not carry.
import { describe, expect, it } from 'vitest';
import { bentName, checkSummary, fakeLlm, markNames, requestData, type EndingSummaryInput } from '../../src/core/llm';
import { numbersIn, wordNumbersIn, wordValue } from '../../src/core/llm/validate';

const input = (over: Partial<EndingSummaryInput> = {}): EndingSummaryInput => ({
  lifeId: 'L1',
  name: 'ธีเวนมอน',
  pronoun: 'เขา',
  race: 'มนุษย์',
  age: 74,
  ending: 'ผู้ที่ไม่ต้องอยู่คนเดียว',
  facts: ['ธีเวนมอน เกิดที่เฮฟากริด เมื่อ ศ.ม. 10,450', 'เขาพบโรริไลราเมื่ออายุ 25', 'เขาตายเมื่ออายุ 74 ที่เฮฟากริด'],
  template: 'ธีเวนมอน เกิดที่เฮฟากริด และตายเมื่ออายุ 74',
  names: ['ธีเวนมอน', 'โรริไลรา', 'เฮฟากริด'],
  others: ['คาเรน', 'ดุสกริม'],
  ...over,
});

const pad = ' เขาใช้ชีวิตเรียบง่ายและเป็นที่รักของคนรอบตัวตลอดมาจนวาระสุดท้าย';
const check = (text: string, i: EndingSummaryInput) => checkSummary(text + pad, i);

const ok = 'ธีเวนมอนเกิดที่เฮฟากริด เมื่ออายุ 25 เขาพบโรริไลรา และจากไปเมื่ออายุ 74 ท่ามกลางคนที่รัก';

describe('checkSummary refuses what the facts do not hold', () => {
  it('accepts a retelling made of the facts', () => {
    expect(check(ok, input())).toMatchObject({ ok: true });
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด ใน ศ.ม. 10450 และอยู่จนอายุ 74 ปี', input()).ok).toBe(true);
  });

  it('refuses the name of another person of the world', () => {
    const r = check('ธีเวนมอนเกิดที่เฮฟากริด เมื่ออายุ 25 เขาพบคาเรนที่ตลาด และจากไปเมื่ออายุ 74', input());
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.reason).toContain('คาเรน');
  });

  it('refuses a name given after "named", and lets the given names stand after it', () => {
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด เขามีสหายชื่อมาร์ธาที่อยู่ข้างเขา และจากไปเมื่ออายุ 74', input()).ok).toBe(false);
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด เขามีคนรักชื่อโรริไลราที่อยู่ข้างเขา และจากไปเมื่ออายุ 74', input()).ok).toBe(true);
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด ชื่อเสียงของเขาไปไกล และจากไปเมื่ออายุ 74', input()).ok).toBe(true);
  });

  it('refuses an age, a year or a count that is not in the facts, in digits and in words', () => {
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด เมื่ออายุ 52 เขาพบโรริไลรา และจากไปเมื่ออายุ 74', input())).toMatchObject({ ok: false });
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด ใน ศ.ม. 10,540 เขาพบโรริไลรา และจากไปเมื่ออายุ 74', input())).toMatchObject({ ok: false });
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด เมื่ออายุ 75 เขาพบโรริไลรา และจากไปอย่างสงบ', input())).toMatchObject({ ok: false });
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด เมื่ออายุสามสิบ เขาพบโรริไลรา และจากไปเมื่ออายุ 74', input())).toMatchObject({ ok: false });
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด เขาอยู่กับโรริไลราสี่สิบปี และจากไปเมื่ออายุ 74', input())).toMatchObject({ ok: false });
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด เมื่ออายุยี่สิบห้า เขาพบโรริไลรา และจากไปเมื่ออายุ 74', input()).ok).toBe(true);
  });

  it('refuses a vow or a title the game did not give, and accepts them when it did', () => {
    const text = 'ธีเวนมอนเกิดที่เฮฟากริด เขาพบโรริไลรา และคำปฏิญาณของเขาเป็นจริงเมื่ออายุ 74';
    expect(check(text, input())).toMatchObject({ ok: false });
    expect(check(text, input({ vow: 'คำปฏิญาณที่เป็นจริง · ให้เขาได้รัก' })).ok).toBe(true);
    const titled = 'ธีเวนมอนเกิดที่เฮฟากริด เขาพบโรริไลรา และได้ฉายาผู้อยู่ที่เดิมเมื่ออายุ 74';
    expect(check(titled, input({ ending: '' }))).toMatchObject({ ok: false });
    expect(check(titled, input({ ending: '', titles: ['ผู้อยู่ที่เดิม'] })).ok).toBe(true);
  });

  it('reads numbers: digits, Thai digits, commas, and Thai words', () => {
    expect(numbersIn('ศ.ม. 10,450 อายุ ๗๔ และ 3.5')).toEqual(['10450', '74', '3.5']);
    expect(wordValue('ยี่สิบห้า')).toBe(25);
    expect(wordValue('สิบเอ็ด')).toBe(11);
    expect(wordValue('หนึ่งร้อยสอง')).toBe(102);
    expect(wordNumbersIn('เมื่ออายุสามสิบ และอยู่มาห้าปี แต่หนึ่งในสี่')).toEqual([30, 5]);
  });
});

describe('a fake answer that invents a name is not used', () => {
  it('the summary falls back to the template, and a clean answer is used', async () => {
    const bad = fakeLlm({ responses: [{ point: 'ending', answers: ['ธีเวนมอนเกิดที่เฮฟากริด เมื่ออายุ 25 เขาพบคาเรนที่ตลาด และจากไปเมื่ออายุ 74 ท่ามกลางคนที่รัก'] }] });
    const out = await bad.llm.summarizeEnding(input());
    expect(out).toEqual({ text: input().template, source: 'template' });
    const good = fakeLlm({ responses: [{ point: 'ending', answers: [ok] }] });
    expect((await good.llm.summarizeEnding(input())).source).toBe('llm');
  });
});

describe('Thai names are marked in the request and kept exact in the answer', () => {
  it('marks every given name with « » in the facts and lists them letter for letter', async () => {
    const i = input();
    const d = requestData(i);
    expect(d.facts[1]).toBe('เขาพบ«โรริไลรา»เมื่ออายุ 25');
    expect(d.exact_names).toEqual(['ธีเวนมอน', 'โรริไลรา', 'เฮฟากริด']);
    expect(markNames('ธีเวนมอนพบโรริไลรา', ['ธีเวน', 'ธีเวนมอน'])).toBe('«ธีเวนมอน»พบโรริไลรา');
    const fake = fakeLlm({ responses: [{ point: 'ending', answers: [ok] }] });
    await fake.llm.summarizeEnding(i);
    expect(fake.provider.calls[0].user).toContain('«โรริไลรา»');
    expect(fake.provider.calls[0].system).toContain('exact_names');
  });

  it('takes the marks off an answer that copies them, and keeps the text clean', () => {
    const r = check('«ธีเวนมอน»เกิดที่«เฮฟากริด» เมื่ออายุ 25 เขาพบ«โรริไลรา» และจากไปเมื่ออายุ 74', input());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).not.toMatch(/[«»]/);
  });

  it('refuses a name that is bent: a tone mark added, a letter dropped, the ending changed', () => {
    for (const bad of ['โรริไลร่า', 'โรริไล', 'โรริไลรี']) {
      const r = check(`ธีเวนมอนเกิดที่เฮฟากริด เมื่ออายุ 25 เขาพบ${bad} และจากไปเมื่ออายุ 74`, input());
      expect(r.ok, bad).toBe(false);
    }
    expect(bentName('ธีเวนมอนพบโรริไลรา', ['ธีเวนมอน', 'โรริไลรา'])).toBeUndefined();
  });

  it('a bent name in the fake answer sends the summary back to the template', async () => {
    const fake = fakeLlm({ responses: [{ point: 'ending', answers: ['ธีเวนมอนเกิดที่เฮฟากริด เมื่ออายุ 25 เขาพบโรริไลร่า และจากไปเมื่ออายุ 74 ท่ามกลางคนที่รัก'] }] });
    expect((await fake.llm.summarizeEnding(input())).source).toBe('template');
  });
});
