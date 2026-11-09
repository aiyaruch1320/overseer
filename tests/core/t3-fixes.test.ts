// The fixes of the last simulated player with the real LLM (review/overnight/t3/report.md): the wish says what it did not understand and reads "in a city",
// a woman's life is told with "เธอ", a country is a place by its name, a class is not said twice, an heir does not begin with a fight of its own.
import { beforeAll, describe, expect, it } from 'vitest';
import { readWish } from '../../src/core/character';
import type { GameData } from '../../src/core/game';
import { asPronoun, dedupeClass, fill, pronounOf } from '../../src/core/text/pick';
import { plainName, wayWords } from '../../src/core/text';
import { loadAll } from '../../scripts/tools/node-data';
import { runLifeReport } from '../../scripts/tools/life-run';
import { runLineageReport } from '../../scripts/tools/lineage-run';
import { createSession, startLife } from '../../scripts/tools/session';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

const read = (text: string) => readWish(data, { text, mode: null, picks: {} });

describe('T3-2: the wish reads "in a city" and tells what it did not understand', () => {
  it('"โตมาในเมือง" and its kin are a kind of place (city)', () => {
    for (const t of ['อยากเป็นเด็กกำพร้าที่โตมาในเมือง', 'เกิดในเมืองใหญ่', 'โตในเมือง']) expect(read(t).ask.placeKind, t).toBe('city');
  });

  it('a life of that wish is born in a land that is drawn as a city (size 3 or more)', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const r = read('เด็กกำพร้าที่โตมาในเมือง');
      const s = createSession(data, { seed, wish: r.sheet });
      const life = startLife(s);
      const c = (data.countries?.items as { id: string; ui: { scale?: number } }[]).find((x) => x.id === life.country)!;
      expect(c.ui.scale ?? 0, `seed ${seed} ${life.country}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('every stretch of the text that no word matched is reported, and nothing else', () => {
    const r = read('อยากเป็นเด็กกำพร้าที่โตมาในเมือง แล้วได้เดินทางไกลตามหาครอบครัว');
    expect(r.notUnderstood).toEqual(['ตามหา']);
    expect(r.sheet.notUnderstood).toEqual(['ตามหา']);
    expect(read('ดาร์กเอลฟ์ ชาย').notUnderstood).toEqual([]);
    expect(read('ดาร์กเอลฟ์ ชาย').sheet.notUnderstood).toBeUndefined();
  });
});

describe('T3-10: the pronoun of the life', () => {
  it('a woman is "เธอ", a man and the rest "เขา"; the mountain is not touched', () => {
    expect(pronounOf('f')).toBe('เธอ');
    expect(pronounOf('m')).toBe('เขา');
    expect(asPronoun('เขาตายด้วยวัย 74 ที่ภูเขา ตอนเขาอายุ 30', 'f')).toBe('เธอตายด้วยวัย 74 ที่ภูเขา ตอนเธออายุ 30');
    expect(asPronoun('เขาตาย', 'm')).toBe('เขาตาย');
  });

  it('the death line of a woman in the log and the card never says "เขา" for her', () => {
    // find a woman's life by trying seeds, then read what the ending card and the god's lines say
    let checked = 0;
    for (let seed = 1; seed <= 16 && checked < 2; seed++) {
      const r = runLifeReport(data, { seed, minLevel: 1 });
      if (r.state.life?.gender !== 'f') continue;
      checked++;
      const own = r.text.split('\n').filter((l) => /\[พระเจ้า\]|^ที่|^คู่ชีวิต|^จากไปก่อน|^ยังอยู่เมื่อ/.test(l));
      for (const l of own) expect(l.replace(/ภูเขา/g, ''), `seed ${seed}: ${l}`).not.toContain('เขา');
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('T3-11: words of the place and of the class', () => {
  it('a country is told by its name, not by its epithet', () => {
    for (const c of (data.countries?.items as { id: string; name: string }[]).slice(0, 143)) expect(plainName(data, c.id)).toBe(c.name);
  });

  it('a class is not said twice', () => {
    expect(dedupeClass('เป็นเผ่าสัตว์ชนชั้นชนชั้นล่าง')).toBe('เป็นเผ่าสัตว์ชนชั้นล่าง');
    expect(fill('{race}ชนชั้น{class_birth}', { race: 'เผ่าสัตว์', class_birth: 'ชนชั้นล่าง' })).toBe('เผ่าสัตว์ชนชั้นล่าง');
  });

  it('the way of a node of the birth is put in a verb, a later one is left as the data says it', () => {
    expect(wayWords('กำพร้า', 0)).toBe('เป็นกำพร้า');
    expect(wayWords('ผูกได้', 20)).toBe('ผูกได้');
    expect(wayWords('ไม่ผ่าน', 1)).toBe('ไม่ผ่าน');
  });
});

describe('T3-13: an heir starts with the hand-over', () => {
  it('the line of taking over comes before the first job, the first fight and the first meeting of the heir', () => {
    let seen = 0;
    for (const seed of [2, 5, 7, 8]) {
      const lines = runLineageReport(data, { seed, lives: 2, minLevel: 1 }).text.split('\n');
      const at = lines.findIndex((l) => l.startsWith('=== ชีวิตที่ 2'));
      if (at < 0) continue;
      seen++;
      const rest = lines.slice(at + 1);
      const take = rest.findIndex((l) => l.includes('[สายตระกูล]') && l.includes('รับช่วงต่อ'));
      expect(take, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      expect(rest.slice(0, take).filter((l) => /\[(ศึก|ตัวละคร|NPC)\]/.test(l)), `seed ${seed}`).toEqual([]);
    }
    expect(seen).toBeGreaterThan(0);
  });
});
