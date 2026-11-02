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
