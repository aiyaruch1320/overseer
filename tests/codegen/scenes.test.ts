// The scenes generator: what the appearance docs state is what data/gen/scenes.json holds.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BEAT_KINDS, type ScenesFile } from '../../src/core/data/types-scenes';
import { clausesOf, composeShort, fxOf, groupClauses, splitSound } from '../../scripts/codegen/lib/scene-compose';
import { tables } from '../../scripts/codegen/lib/table';

const D = (JSON.parse(readFileSync('data/gen/scenes.json', 'utf8')) as ScenesFile).items;
const S = new Map(D.scripts.map((s) => [s.id, s]));
const C = new Map(D.cards.map((c) => [c.id, c]));
const count = (re: RegExp) => D.scripts.filter((s) => re.test(s.id)).length;

describe('scenes generator: the counts the docs state', () => {
  it('194 world event cards: 152 + 42 after the transformations; forms X M L C as the rows say', () => {
    const world = D.cards.filter((c) => /^(?!LC-|LE-)[A-Z]+-\d+$/.test(c.id));
    expect(world).toHaveLength(194);
    const rows = tables('docs/appearance/12-event-visuals.md').filter((t) => t.header[0] === 'ID · ชื่อ').flatMap((t) => t.rows);
    expect(rows).toHaveLength(194);
    const byForm = (f: string) => world.filter((c) => c.form === f).length;
    expect(byForm('X') + byForm('M') + byForm('L') + byForm('C')).toBe(194);
    for (const c of world) expect(c.script, c.id).toBe(c.form === 'X' || c.form === 'L');
  });
  it('13 categories with their colours, the 8 follow-up groups take the colour of the new continent', () => {
    const fr = (g: string) => D.frames.find((f) => f.group === g)!;
    expect(fr('DR').color).toBe('#d8d4cc');
    expect(fr('WR').color).toBe('#8a2a2a');
    expect(fr('END').color).toBe('#e8e8f0');
    expect(D.frames).toHaveLength(13 + 8);
    expect(C.get('SF-01')!.frame).toBe(fr('SF').color);
    expect(C.get('SF-01')!.frame).not.toBe(fr('DR').color);
  });
  it('21 rites, 21 destinations, 9 other lines, 102 clashes with the standard closings, 15 dragons, 3 ends', () => {
    expect(count(/^rite\./)).toBe(21);
    expect(count(/^dest\./)).toBe(21);
    expect(count(/^line\./)).toBe(8);
    expect(count(/^NF-/)).toBe(102);
    expect(Object.keys(S.get('std.clash')!.variants!)).toHaveLength(6);
    expect(count(/^fall\./)).toBe(15);
    expect(['END-10', 'END-11', 'END-12'].every((id) => S.get(id)?.kind === 'ending')).toBe(true);
  });
  it('local events: 76 hand-written (the C ones stay cards), 6 templates; last era: 12 LE, 10 le nodes, 54 NT; allies; 17 miracle days', () => {
    expect(D.cards.filter((c) => /^LC-/.test(c.id))).toHaveLength(76);
    expect(count(/^LT-/)).toBe(6);
    expect(count(/^LE-/)).toBe(12);
    expect(count(/^le\./)).toBe(10);
    expect(count(/^NT-/)).toBe(54);
    expect(count(/^(bn|kn)\./)).toBe(13);
    expect(count(/^ally\..*\.(crisis|end)$/)).toBe(2 * 55);
    expect(count(/^(KN|FT)-/)).toBe(8 + 12);
    expect(count(/^mr\./)).toBe(17);
  });
});

describe('scenes generator: the shape of every script', () => {
  it('beats are of the ten kinds, in time order, inside the scene, with their words', () => {
    for (const s of D.scripts) {
      const check = (beats: typeof s.beats, seconds: number) => {
        let last = 0;
        for (const b of beats) {
          expect(BEAT_KINDS as readonly string[], s.id).toContain(b.k);
          expect(b.at, s.id).toBeGreaterThanOrEqual(last);
          expect(b.at, s.id).toBeLessThanOrEqual(seconds);
          last = b.at;
          if (b.k === 'text') expect(b.text.trim(), s.id).not.toBe('');
          if (b.k === 'bg') expect(b.sky, s.id).toMatch(/^#[0-9a-f]{6}$/);
        }
      };
      check(s.beats, s.seconds);
      for (const [k, v] of Object.entries(s.variants ?? {})) {
        expect(v.seconds, s.id + k).toBeGreaterThan(0);
        check(v.beats, v.seconds);
      }
      expect(s.frame, s.id).toMatch(/^#[0-9a-f]{6}$/);
      if (s.id !== 'std.clash') expect(s.seconds, s.id).toBeGreaterThan(0);
    }
  });
  it('all ten kinds of beat are used by the scripts', () => {
    const used = new Set<string>();
    for (const s of D.scripts) {
      for (const b of s.beats) used.add(b.k);
      for (const v of Object.values(s.variants ?? {})) for (const b of v.beats) used.add(b.k);
    }
    expect([...used].sort()).toEqual([...BEAT_KINDS].sort());
  });
  it('the day of an event has the five beats and the scene lasts 20 to 40 seconds; a short scene 4 to 12', () => {
    const dr01 = S.get('DR-01')!;
    expect(dr01.seconds).toBe(40);
    expect(dr01.beats.filter((b) => b.k === 'text' && b.role === 'stage')).toHaveLength(5);
    for (const id of ['DR-04', 'DR-05', 'DR-07', 'BIO-02', 'MC-04', 'BIO-05', 'FG-11']) expect(S.get(id)!.seconds, id).toBe(40);
    for (const s of D.scripts.filter((x) => x.kind === 'local' || x.kind === 'ally')) expect(s.seconds, s.id).toBeLessThanOrEqual(12);
    for (const s of D.scripts.filter((x) => x.kind === 'miracle')) expect(s.seconds, s.id).toBe(30);
  });
  it('the name struck and the new one written (11 §1.2 beat 5)', () => {
    const st = S.get('DR-01')!.beats.find((b) => b.k === 'strike');
    expect(st).toMatchObject({ k: 'strike', to: 'สกายฟอลล์' });
    expect(st && st.k === 'strike' ? st.from : '').toContain('อัซการ์');
  });
  it('the rite has a result for pass and fail; the human rite one scene for each home', () => {
    for (const id of D.scripts.filter((s) => s.kind === 'rite').map((s) => s.id)) expect(Object.keys(S.get(id)!.variants!), id).toEqual(expect.arrayContaining(['pass', 'fail']));
    expect(Object.keys(S.get('rite.hu')!.variants!)).toEqual(expect.arrayContaining(['ทุ่งราบ', 'หมอก', 'ทราย', 'เรือ', 'ชาวพื้น']));
    const el = S.get('rite.el')!;
    expect(el.title).toBe('พิธีผูกราก');
  });
  it('a clash tells the narration and keeps every result line of the doc as a variant', () => {
    const nf = S.get('NF-AZ02-1')!;
    expect(Object.keys(nf.variants!)).toEqual(['เจรจา (ห้ามดวลถึงตาย)', 'ชนะ (เขายอมแพ้)', 'ชนะ (ดวลถึงตาย)', 'เสมอ', 'แพ้']);
    expect(nf.beats.filter((b) => b.k === 'text' && b.role === 'line').length).toBeGreaterThanOrEqual(4);
  });
});

describe('scenes generator: nothing left unread', () => {
  it('the unparsed report is empty', () => {
    expect(readFileSync('data/gen/_unparsed/scenes.md', 'utf8')).toMatch(/\n0 รายการ/);
  });
});

describe('the composer', () => {
  it('clauses are the words between spaces; lines group neighbours up to the count', () => {
    expect(clausesOf('ก ข  ค')).toEqual(['ก', 'ข', 'ค']);
    expect(groupClauses('ก ข ค ง จ ฉ', 3)).toHaveLength(3);
    expect(groupClauses('ก ข', 5)).toEqual(['ก', 'ข']);
  });
  it('a sound is split from the picture at the clause that starts with เสียง', () => {
    expect(splitSound('ฟ้ามืด ควันดำ เสียงกลองไกล ดังช้า')).toEqual({ image: 'ฟ้ามืด ควันดำ', sound: 'เสียงกลองไกล ดังช้า' });
    expect(splitSound('ไม่มีเสียง').sound).toBe('');
  });
  it('words read into particles, at most two', () => {
    expect(fxOf('หิมะเถ้าตกบนลาวาและหมอก')).toEqual(['ash', 'snow']);
    expect(fxOf('คนนั่งเงียบ')).toEqual([]);
  });
  it('a short scene is the same twice (no clock, no random)', () => {
    const seed = { id: 'T', kind: 'local' as const, title: 'ทดสอบ', frame: '#e8c36a', src: 't', sky: '#223344', ground: '#112233', place: 'ลาน', seconds: 8, lines: ['ก', 'ข'], sounds: ['เสียงหนึ่ง'], fx: ['dust' as const] };
    expect(JSON.stringify(composeShort(seed))).toBe(JSON.stringify(composeShort(seed)));
  });
  it('no caption of a card points at a document (M5 review M1: "ดู 11-world-changes หัวข้อ 3" is for the writer of the doc)', () => {
    for (const c of D.cards) expect(c.picture, c.id).not.toMatch(/\d\d-[a-z][a-z0-9-]+|\.md|หัวข้อ/);
    expect(C.get('DR-01')!.picture).toBe('เกาะลอยฟ้าร่วงทั้งทวีป');
  });
});
