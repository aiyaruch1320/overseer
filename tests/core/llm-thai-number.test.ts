// Thai number words and the year told in words (a real trial wrote "สองพันสิบเอ็ดพันห้าร้อยสี่สิบ" for 11,540). Pure text, no provider.
import { describe, expect, it } from 'vitest';
import { checkSummary, type EndingSummaryInput } from '../../src/core/llm';
import { parseThaiNumber } from '../../src/core/llm/thai-number';
import { wordNumbersIn } from '../../src/core/llm/validate';

describe('parseThaiNumber', () => {
  it('reads the numbers Thai writes', () => {
    const good: [string, number][] = [
      ['เจ็ดสิบสี่', 74], ['สิบ', 10], ['สิบเอ็ด', 11], ['ยี่สิบ', 20], ['ยี่สิบเอ็ด', 21], ['ยี่สิบห้า', 25], ['หนึ่งร้อย', 100], ['หนึ่งร้อยสอง', 102],
      ['ห้าร้อยสี่สิบ', 540], ['สองพัน', 2000], ['หนึ่งพันห้าร้อยสี่สิบ', 1540], ['หนึ่งหมื่นหนึ่งพันห้าร้อยสี่สิบ', 11540], ['สามแสนสองหมื่น', 320000],
      ['สองล้านสามแสน', 2300000], ['หนึ่งหมื่นสองพันสิบเอ็ด', 12011],
    ];
    for (const [w, v] of good) expect(parseThaiNumber(w), w).toBe(v);
  });

  it('refuses words that are not a number', () => {
    const bad = ['สองพันสิบเอ็ดพันห้าร้อยสี่สิบ', 'เอ็ด', 'ห้าห้า', 'สิบหนึ่ง', 'หนึ่งสิบ', 'สี่ร้อยห้าพัน', 'ร้อย', 'ยี่ร้อย', 'สิบสิบ', 'เจ็ดสิบเอ็ดสี่', 'สามี', ''];
    for (const w of bad) expect(parseThaiNumber(w), w).toBeUndefined();
  });
});

const input = (): EndingSummaryInput => ({
  lifeId: 'L1',
  name: 'ธีเวนมอน',
  pronoun: 'เขา',
  race: 'มนุษย์',
  age: 74,
  ending: 'ผู้ที่ไม่ต้องอยู่คนเดียว',
  facts: ['ธีเวนมอน เกิดที่เฮฟากริด เมื่อ ศ.ม. 11,540', 'เขาตายเมื่ออายุ 74'],
  template: 'ธีเวนมอน เกิดที่เฮฟากริด และตายเมื่ออายุ 74',
  names: ['ธีเวนมอน', 'เฮฟากริด'],
});
const pad = ' เขาใช้ชีวิตเรียบง่ายและเป็นที่รักของคนรอบตัวตลอดมาจนวาระสุดท้าย';
const check = (t: string) => checkSummary(t + pad, input());

describe('a year or an age in words must be one the facts carry', () => {
  it('refuses the year the trial wrote wrongly', () => {
    const r = check('ธีเวนมอนเกิดที่เฮฟากริด ในศักราชสองพันสิบเอ็ดพันห้าร้อยสี่สิบ และจากไปเมื่ออายุ 74');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toContain('no number');
  });

  it('refuses a well-formed year the facts do not carry, and an age', () => {
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด ในศักราชหนึ่งหมื่นหนึ่งพันห้าร้อยห้าสิบ และจากไปเมื่ออายุ 74').ok).toBe(false);
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด และจากไปเมื่ออายุเจ็ดสิบห้า').ok).toBe(false);
  });

  it('accepts the year and the age written in words when the facts carry them', () => {
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด ในศักราชหนึ่งหมื่นหนึ่งพันห้าร้อยสี่สิบ และจากไปเมื่ออายุเจ็ดสิบสี่').ok).toBe(true);
    expect(check('ธีเวนมอนเกิดที่เฮฟากริด ในศักราช 11,540 และมีชีวิตอยู่เจ็ดสิบสี่ปี').ok).toBe(true);
  });

  it('does not take other words for numbers', () => {
    expect(wordNumbersIn('สามีของเขาห้ามไม่ให้ไป ร้อยกรองบทหนึ่ง พันธุ์ไม้สองพันธุ์')).toEqual([]);
  });
});
