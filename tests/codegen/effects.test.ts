import { describe, expect, it } from 'vitest';
import { parseCell, parseChoice, parseConditionX, textConditions } from '../../scripts/codegen/lib/effects';
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

describe('whole-word race names (review B1)', () => {
  it('does not find the ghoul in a family (ตระกูล) or a race in a longer word', () => {
    // docs/lore/storylines/23-heir.md:22 hr.b1 and :49 :51 (the endings of the heir file)
    for (const text of ['ทายาทเกิดในตระกูลที่มีสมุดตระกูล', 'ตระกูลอยู่รอดเหตุการณ์ใหญ่สองยุค', 'ผู้พาตระกูลข้ามยุค']) {
      const c = parseConditionX(text, ids, true);
      expect(JSON.stringify(c), text).not.toContain('"race"');
      expect(c, text).toEqual({ k: 'text', text });
    }
  });
  it('still finds a race written as a word, with the longer name winning', () => {
    expect(parseConditionX('กูล', ids, true)).toEqual({ k: 'race', ids: ['gh'] });
    expect(parseConditionX('ชาวกูล', ids, true)).toEqual({ k: 'race', ids: ['gh'] });
    expect(parseConditionX('ดาร์กเอลฟ์', ids, true)).toEqual({ k: 'race', ids: ['de'] });
    expect(parseConditionX('เอลฟ์', ids, true)).toEqual({ k: 'race', ids: ['el'] });
    // a connective glued to the name is still a border
    expect(parseConditionX('ยักษ์และ `leadership`', ids, true)).toEqual({
      k: 'and',
      of: [
        { k: 'race', ids: ['gi'] },
        { k: 'has', kind: 'aptitude', id: 'leadership' },
      ],
    });
  });
});

describe('digits that touch a code are not a number (review H4)', () => {
  it('reads DM-08 as the event, not as a hunger of -8', () => {
    // world-events.md:253 "ความหิวสะสม → DM-08"
    const p = parseCell('ความหิวสะสม → DM-08', ids);
    expect(p.effects).toEqual([{ k: 'event', id: 'DM-08', open: true }]);
    for (const text of ['ส่งไป DM-03 ศรัทธา +15', 'ถ้าอยู่ SH-10 ไปที่ DM-08', 'SH-10 ทอง −20']) {
      const e = parseCell(text, ids).effects;
      expect(
        e.filter((x) => x.k === 'stat' && /^(DM|SH)$/.test(x.stat)),
        text,
      ).toEqual([]);
    }
    expect(parseCell('ส่งไป DM-03 ศรัทธา +15', ids).effects).toContainEqual({ k: 'stat', stat: 'ศรัทธา', delta: 15 });
  });
  it('keeps a country id out of the numbers of a condition', () => {
    expect(parseConditionX('SH-10 และ DM-08 เกิด', ids, true)).toEqual({
      k: 'and',
      of: [
        { k: 'country', ids: ['SH-10'] },
        { k: 'event', id: 'DM-08', happened: true },
      ],
    });
  });
});

describe('"A หรือ B" is a choice (review B2)', () => {
  it('picks one of two jobs, of three jobs, and of a stat and a curse', () => {
    const jobs = (cell: string) => parseCell(cell, ids).effects;
    // 05-orc.md:40 or.t3 ก
    expect(jobs('`soldier` หรือ `mercenary`')).toEqual([
      {
        k: 'pick',
        of: [
          { label: 'soldier', effects: [{ k: 'grant', kind: 'job', id: 'soldier' }] },
          { label: 'mercenary', effects: [{ k: 'grant', kind: 'job', id: 'mercenary' }] },
        ],
      },
    ]);
    // 06-halfling.md:38 "`baker` `cook` หรือ `innkeeper`"
    const three = jobs('`baker` `cook` หรือ `innkeeper`')[0];
    expect(three.k === 'pick' && three.of.length).toBe(2);
    // 22-halfblood.md:59 hb.t2 ก
    const hb = parseCell('บอกคนใกล้ชิด · ไว้ใจเพื่อน +1 หรือ `nc_betrayed_trust` 15%', ids).effects;
    expect(hb).toEqual([
      {
        k: 'pick',
        of: [
          { label: 'ไว้ใจเพื่อน +1', effects: [{ k: 'trust', toward: 'เพื่อน', delta: 1 }] },
          { label: 'nc_betrayed_trust 15%', effects: [{ k: 'grant', kind: 'curse', id: 'nc_betrayed_trust', chance: 0.15 }] },
        ],
      },
    ]);
  });
  it('picks one of two events and one of two convergences', () => {
    // 00-convergence.md:114 "→ BIO-03 หรือ WT-02"
    const ev = parseCell('→ BIO-03 หรือ WT-02 ที่ไชร์วิก (AL-16)', ids).effects;
    const pick = ev[0];
    expect(pick.k === 'pick' && pick.of.map((b) => b.effects[0])).toEqual([
      { k: 'event', id: 'BIO-03', open: true },
      { k: 'event', id: 'WT-02', open: true },
    ]);
    // 13-demonkin.md:46 dm.a5
    const cv = parseCell('→ cv.8 (ปีศาจเพลิง) หรือ cv.10 (คนอื่น)', ids, { notes: true }).effects;
    expect(cv).toEqual([
      {
        k: 'pick',
        of: [
          { label: 'cv.8 (ปีศาจเพลิง)', effects: [{ k: 'converge', to: 'cv.8' }] },
          { label: 'cv.10 (คนอื่น)', effects: [{ k: 'converge', to: 'cv.10' }] },
        ],
      },
    ]);
  });
  it('shares a signed number written once and keeps "หรือ" in a condition a condition', () => {
    const t = parseCell('ท่าทีถิ่น −1 หรือ −2', ids).effects[0];
    expect(t.k === 'pick' && t.of.map((b) => b.effects)).toEqual([[{ k: 'stat', stat: 'ท่าทีถิ่น', delta: -1 }], [{ k: 'stat', stat: 'ท่าทีถิ่น', delta: -2 }]]);
    const c = parseChoice('b', '35 เสนอแก้กฎ · ต้องผ่าน el.b2 ทาง ก หรือ `ns_mediate`', ids);
    expect(c.choice.effects.some((e) => e.k === 'pick')).toBe(false);
    expect(c.choice.when).toMatchObject({ k: 'or' });
    // "ถ้า MC-03 หรือ MC-04 เกิด" is the or of a condition
    const w = parseCell('ถ้า MC-03 หรือ MC-04 เกิด → cv.9', ids).effects;
    expect(w[0]).toMatchObject({ k: 'if', cond: { k: 'or' }, then: [{ k: 'converge', to: 'cv.9' }] });
  });
  it('keeps "ระดับ B2 หรือ B3" as one level with two values', () => {
    expect(parseCell('ระดับ B2 หรือ B3 ตามพ่อแม่', ids).effects).toEqual([{ k: 'level', scale: 'B', values: [2, 3] }]);
  });
});

describe('a condition stays with the result it belongs to (review H1)', () => {
  it('wraps "ถ้า … <code>" and "<code> เมื่อ …" in an if', () => {
    // 01-human.md:43 hu.b1 ข
    expect(parseCell('ครอบครัวยากจน · ถ้าถิ่นมีสงครามได้ `nc_war_orphan`', ids).effects).toEqual([
      { k: 'if', cond: { k: 'text', text: 'ถิ่นมีสงคราม' }, then: [{ k: 'grant', kind: 'curse', id: 'nc_war_orphan' }] },
    ]);
    // 00-convergence.md:40 cv.1 ก
    expect(parseCell('`ns_refugee_lead` · เปิดอาชีพ `ruin_city_lord` เมื่อ SF-08 เกิด', ids).effects).toEqual([
      { k: 'grant', kind: 'skill', id: 'ns_refugee_lead' },
      { k: 'if', cond: { k: 'event', id: 'SF-08', happened: true }, then: [{ k: 'grant', kind: 'job', id: 'ruin_city_lord' }] },
    ]);
    // 16-giant.md:48 gi.a7 ก
    const g = parseCell('ถ้า GD-08 เกิดแล้ว ทางสู่อาชีพลับ `godslayer` (ศรัทธาเทพ ≤ −70 และกล้าหาญ > 30)', ids).effects;
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ k: 'if', cond: { k: 'event', id: 'GD-08', happened: true }, then: [{ k: 'jobpath', job: 'godslayer' }] });
    // 16-giant.md:48 gi.a7 ค: an unreadable requirement is a text condition
    const gr = parseCell('ไปหากรอม-ธารเพื่อการทดสอบ (`nb_mark_gromdhar` ต้องนำคำขอบคุณจากเกาะ)', ids).effects;
    expect(gr).toEqual([{ k: 'if', cond: { k: 'text', text: 'นำคำขอบคุณจากเกาะ' }, then: [{ k: 'grant', kind: 'blessing', id: 'nb_mark_gromdhar' }] }]);
    expect(textConditions(gr)).toEqual(['นำคำขอบคุณจากเกาะ']);
  });
  it('ties a battle to a condition and a weight change to its condition', () => {
    // 25-journeys.md:46 sf.a3 notes
    const b = parseCell('ศึก: `kraken` (ทาง ก ถ้า DR-05 เกิด)', ids, { battle: true, notes: true }).effects;
    expect(b).toEqual([{ k: 'if', cond: { k: 'event', id: 'DR-05', happened: true }, then: [{ k: 'battleFor', choices: ['a'], enemies: ['kraken'] }] }]);
    // 09-dragonkin.md:49 dk.e2 ค
    const e = parseCell('ยุค 4 → cv.16 (ทาง ก น้ำหนัก ×3 ถ้ามีตรามังกร)', ids).effects;
    expect(e).toContainEqual({ k: 'entryMod', choice: 'a', cond: { k: 'text', text: 'มีตรามังกร' }, mul: 3 });
  });
  it('turns "ถ้าเกิด" and "ถ้าต่ำกว่า 3" into the condition they point at', () => {
    expect(parseCell('ผูก CT-04 ถ้าเกิด', ids).effects).toEqual([{ k: 'if', cond: { k: 'event', id: 'CT-04', happened: true }, then: [{ k: 'event', id: 'CT-04' }] }]);
    expect(parseCell('ชนชั้น +1 ถ้าต่ำกว่า 3', ids).effects[0]).toMatchObject({ k: 'if', cond: { k: 'cmp', stat: 'ชนชั้น', op: '<', value: 3 } });
  });
  it('is not fooled by ash (เถ้า) which holds the letters of "ถ้า"', () => {
    const p = parseCell('ช่วย ซาวี (MH06-2) ชาวนาข้าวเถ้า `b_courage`', ids);
    expect(p.effects.some((e) => e.k === 'if')).toBe(false);
  });
});

describe('words beside a code are not conditions (review H2 M1)', () => {
  it('drops the explaining words', () => {
    expect(parseConditionX('hu.a7 สำเร็จ', ids, true)).toEqual({ k: 'node', id: 'hu.a7' });
    expect(parseConditionX('อาชีพลับ `beastking`', ids, true)).toEqual({ k: 'has', kind: 'job', id: 'beastking' });
    expect(parseConditionX('ชาวพื้นหลัง DR-01', ids, true)).toEqual({ k: 'event', id: 'DR-01', happened: true });
    expect(parseConditionX('SF-08 เกิดแล้ว', ids, true)).toEqual({ k: 'event', id: 'SF-08', happened: true });
  });
  it('reads the numbers the grammar already has', () => {
    expect(parseConditionX('ศรัทธาเทพ ≤ −70', ids, true)).toEqual({ k: 'cmp', stat: 'godFaith', op: '<=', value: -70, label: 'ศรัทธาเทพ' });
    expect(parseConditionX('เวท 17', ids, true)).toEqual({ k: 'cmp', stat: 'magic', op: '>=', value: 17, label: 'เวท' });
    expect(parseConditionX('ชั้น 3 ขึ้นไป', ids, true)).toEqual({ k: 'class', min: 3 });
    expect(parseConditionX('ชนชั้น 3 ขึ้นไป', ids, true)).toEqual({ k: 'class', min: 3 });
    expect(parseConditionX('ก่อนอายุ 50', ids, true)).toEqual({ k: 'age', max: 49 });
    expect(parseConditionX('เหมือง ≥ 300', ids, true)).toEqual({ k: 'cmp', stat: 'mine', op: '>=', value: 300, label: 'เหมือง' });
    expect(parseConditionX('พวกพ้องระดับ 3 ขึ้นไป', ids, true)).toEqual({ k: 'cmp', stat: 'allyLevel', op: '>=', value: 3, label: 'พวกพ้องระดับ' });
  });
  it('lists every text condition that is left', () => {
    const c = parseConditionX('hu.a7 และ มอบต้นกล้า', ids, true);
    expect(textConditions(c)).toEqual(['มอบต้นกล้า']);
    expect(textConditions({ k: 'if', cond: { k: 'and', of: [{ k: 'text', text: 'ก' }, { k: 'event', id: 'MC-01', happened: true }] }, then: [{ k: 'label', text: 'x' }] })).toEqual(['ก']);
    expect(textConditions([])).toEqual([]);
  });
});

describe('a label is never empty or opening with "หรือ" (review L1)', () => {
  it('says the codes when only codes are written', () => {
    expect(parseChoice('a', '45 `soldier` หรือ `mercenary`', ids).choice.label).toBe('soldier หรือ mercenary');
    expect(parseChoice('b', '30 `smith` หรือช่างล้อมเมือง · `ns_siege_craft`', ids).choice.label).toBe('smith หรือช่างล้อมเมือง');
    expect(parseChoice('b', '30 `tamer` หรือ `courier` (นก)', ids).choice.label).toBe('tamer หรือ courier (นก)');
  });
});
