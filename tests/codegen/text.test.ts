import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { NamesFile, TemplatesEndingFile, TemplatesGodFile } from '../../src/core/data/types-text';
import { readDoc } from '../../scripts/codegen/lib/table';

const load = <T>(n: string): T => JSON.parse(readFileSync(`data/gen/${n}.json`, 'utf8'));
const N = load<NamesFile>('names').items;
const G = load<TemplatesGodFile>('templates-god').items;
const E = load<TemplatesEndingFile>('templates-ending').items;

describe('text generator: counts the docs state', () => {
  it('name bank: 740 words, every bank as many words as its header says', () => {
    expect(N.counts.words).toBe(740);
    expect(N.counts.declared).toBe(740);
    expect(N.banks.reduce((a, b) => a + b.words.length, 0)).toBe(740);
    for (const b of N.banks) {
      expect(b.words.length, b.id).toBeGreaterThan(0);
      if (b.declared != null) expect(b.words.length, b.id).toBe(b.declared);
    }
    expect(new Set(N.banks.map((b) => b.id)).size).toBe(N.banks.length);
  });
  it('god templates: 539 in 15 families, each family as many as the doc says', () => {
    expect(G.templates.length).toBe(539);
    expect(G.counts.declared).toBe(539);
    expect(G.families.length).toBe(15);
    for (const f of G.families) if (f.declared != null) expect(f.count, f.id).toBe(f.declared);
    expect(new Set(G.templates.map((t) => t.id)).size).toBe(539);
  });
  it('ending templates: 437 in 17 families, each family as many as the doc says', () => {
    expect(E.templates.length).toBe(437);
    expect(E.counts.declared).toBe(437);
    for (const f of E.families) if (f.declared != null) expect(f.count, f.id).toBe(f.declared);
    expect(new Set(E.templates.map((t) => t.id)).size).toBe(437);
    expect(E.families.filter((f) => f.id.startsWith('connect_')).reduce((a, f) => a + f.count, 0)).toBe(48);
  });
});

describe('text generator: slots', () => {
  it('every {slot} used in a template is in the slot list (doc check "ช่องครบ")', () => {
    expect(G.unknownSlots).toEqual([]);
    expect(E.unknownSlots).toEqual([]);
    const known = new Set(G.slots.map((s) => s.slot));
    for (const t of G.templates) for (const s of t.slots) expect(known.has(s), `${t.id} {${s}}`).toBe(true);
    const knownE = new Set(E.slots.map((s) => s.slot));
    for (const t of E.templates) for (const s of t.slots) expect(knownE.has(s), `${t.id} {${s}}`).toBe(true);
  });
  it('god slot list has the 21 rows of section 1', () => {
    expect(G.slots.length).toBe(21);
    expect(G.slots[0].slot).toBe('ชื่อตัวละคร');
  });
  it('vow pages keep both lines', () => {
    const v = E.templates.filter((t) => t.family === 'vow_done');
    expect(v.length).toBe(19);
    for (const t of v) expect(t.lines!.length).toBe(2);
  });
});

describe('text generator: two rows against the docs', () => {
  it('a god template and a name-bank row', () => {
    const t = G.templates.find((x) => x.id === 'symbol_meaning.งู.คนบ้านเมือง')!;
    expect(t.text).toBe('คนใกล้ตัวพูดหวานแต่ซ่อนพิษ');
    expect(readDoc('docs/systems/llm/06-god-templates.md')).toContain('คนใกล้ตัวพูดหวานแต่ซ่อนพิษ');
    const b = N.banks.find((x) => x.id.endsWith('.MR-17 ดาวตก.เวลา'))!;
    expect(b.words).toEqual(['คืน', 'ยาม', 'ค่ำ', 'เที่ยงคืน', 'ดึก', 'ก่อนรุ่ง', 'หัวค่ำ', 'ปลายคืน']);
    expect(readDoc('docs/systems/llm/05-name-bank.md')).toContain('| MR-17 ดาวตก | หนัก | คืน ยาม ค่ำ เที่ยงคืน ดึก ก่อนรุ่ง หัวค่ำ ปลายคืน |');
  });
});

// ---------- review M0-b fixes: L4 L6 ----------
describe('ids are clean (L4 L6)', () => {
  it('no word-bank id has "..." or a group that starts with a dot or a digit', () => {
    for (const b of N.banks) {
      expect(b.id, b.id).not.toMatch(/\.\./);
      expect(b.group, b.id).not.toMatch(/^[.\s\d]/);
      expect(b.id, b.id).not.toMatch(/^\d+\.\./);
    }
  });
  it('the four banks the review named keep their section number and their group name', () => {
    const id = (re: RegExp) => N.banks.filter((b) => re.test(b.id));
    expect(id(/^3\./).map((b) => b.group)).toEqual(Array(12).fill('ปาฏิหาริย์ใหญ่'));
    expect(id(/^3\./).map((b) => b.key)).toContain('MR-17 ดาวตก / เวลา');
    expect(id(/^4\./).map((b) => b.id)).toContain('4.ลัทธิจากซาก.เฝ้ารอ.คำ');
    expect(id(/^6\./).map((b) => b.id)).toContain('6.แผ่นดินใหม่.มอร์เฮเวน.ลักษณะ');
    expect(N.banks.find((b) => b.id === '6.แผ่นดินใหม่.มอร์เฮเวน.ลักษณะ')!.group).toBe('แผ่นดินใหม่ (MR-20)');
    expect(new Set(N.banks.map((b) => b.id)).size).toBe(83);
  });
  it('no template id has an empty part ("..") and the connectives are numbered by row', () => {
    for (const t of [...G.templates, ...E.templates]) expect(t.id, t.id).not.toMatch(/\.\./);
    expect(E.templates.filter((t) => t.family === 'connect_then').map((t) => t.id)).toEqual(Array.from({ length: 12 }, (_, i) => `connect_then.${i + 1}.คำเชื่อม`));
    expect(E.templates.filter((t) => t.family === 'connect_but').length).toBe(10);
    expect(E.templates.filter((t) => t.family === 'connect_because').length).toBe(11);
    expect(E.templates.length).toBe(437);
  });
});
