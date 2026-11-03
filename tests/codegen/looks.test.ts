import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LooksData } from '../../src/core/data/types-looks';
import type { NpcRow } from '../../src/core/data/types-npcs';
import { BEARD_IDS, FEAT_IDS, HAIR_IDS, HAT_IDS, OUTFIT_IDS, TOOL_IDS } from '../../src/art/parts/ids';
import {
  BEARD_RULES, FEAT_RULES, HAIR_RULES, HAT_RULES, HEX, LINE_OVERRIDES, OUTFIT_RULES, TOOL_RULES, earsOf, featsOf, femOf, gaitOf, lowerOf, outfitFromGarments, skinHint,
  stageFromDescription, stageWord, toolOf, wearOf,
} from '../../scripts/codegen/lib/look-words';

const L = (JSON.parse(readFileSync('data/gen/looks.json', 'utf8')) as { items: LooksData }).items;
const npcs = (JSON.parse(readFileSync('data/gen/npcs.json', 'utf8')) as { items: { npcs: NpcRow[] } }).items.npcs;
const bonds = JSON.parse(readFileSync('data/gen/bonds.json', 'utf8')) as { items: { successors: { list: unknown[] } } };

const inSet = (id: string, all: readonly string[]) => id === '' || all.includes(id);

describe('looks generator: counts match the docs', () => {
  it('21 races, each with a ค่า UI line, a body, skins and accents', () => {
    expect(Object.keys(L.races)).toHaveLength(21);
    for (const r of Object.values(L.races)) {
      expect(r.skins.length, r.id).toBeGreaterThan(0);
      expect(r.accents.length, r.id).toBeGreaterThan(0);
      for (const c of [...r.skins, ...r.accents]) expect(c, r.id).toMatch(HEX);
      expect(r.body.scale, r.id).toBeGreaterThan(0.3);
    }
  });
  it('the body words became the codes of the README table', () => {
    expect(L.races.human.body).toEqual({ scale: 1, head: 1, shoulders: 1, ears: 'round', lower: 'legs', gait: 'normal' });
    expect(L.races.elf.body).toMatchObject({ scale: 1.08, ears: 'long', gait: 'glide' });
    expect(L.races.naga.body).toMatchObject({ ears: 'fin', lower: 'serpent', gait: 'glide' });
    expect(L.races.slime.body).toMatchObject({ ears: 'none', lower: 'blob', gait: 'hop' });
    expect(L.races.merfolk.body).toMatchObject({ lower: 'gown' });
    expect(L.races.fae.body.gait).toBe('float');
    expect(L.races.beast.body.ears).toBe('animal');
    expect(L.races.mummy.body.gait).toBe('shuffle');
    expect(L.races.dwarf.body.gait).toBe('heavy');
    expect(L.races.human.feats).toEqual([]);
    expect(L.races.winged.feats).toContain('wings:feather');
  });
  it('every sub-line of the lore table is there; overrides come only from words the docs show', () => {
    const names = (r: string) => L.races[r].lines.map((l) => l.name);
    expect(names('winged')).toEqual(expect.arrayContaining(['อาเวียนขาว', 'ปีกราตรี', 'ปีกเกล็ด', 'ปีกสั้น', 'ชาวน้ำฟ้า']));
    expect(names('human')).toEqual(expect.arrayContaining(['ชาวทุ่ง', 'ชาวหมอก', 'ชนผืนทราย', 'มนุษย์เรือ', 'ชาวพื้น', 'ผู้กลับชาติ', 'ผู้ถูกอัญเชิญ']));
    expect(names('elf')).toHaveLength(5);
    expect(names('dwarf')).toHaveLength(6);
    expect(names('giant')).toHaveLength(4);
    expect(L.races.winged.lines.find((l) => l.name === 'ปีกราตรี')!.overrides.feats).toContain('wings:night');
    expect(L.races.winged.lines.find((l) => l.name === 'ปีกราตรี')!.overrides.feats).not.toContain('wings:feather');
    expect(L.races.elf.lines.find((l) => l.name === 'เอลฟ์สูง')!.overrides.scale).toBeGreaterThan(L.races.elf.body.scale);
    expect(L.races.elf.lines.find((l) => l.name === 'เอลฟ์ต้นไม้')!.overrides).toEqual({});
  });
  it('the NPCs are the rows of docs/appearance/npcs and of data/gen/npcs.json', () => {
    const rows = readdirSync('docs/appearance/npcs')
      .filter((f) => /^\d\d-.*\.md$/.test(f))
      .map((f) => readFileSync(`docs/appearance/npcs/${f}`, 'utf8').split('\n').filter((l) => /^\| [A-Z]{2}\d\d-\d \|/.test(l)).length);
    const total = rows.reduce((a, b) => a + b, 0);
    expect(total).toBe(npcs.length);
    expect(Object.keys(L.npcs)).toHaveLength(total);
    expect(L.counts.npcs).toBe(total);
    for (const n of npcs) expect(L.npcs[n.id], n.id).toBeTruthy();
  });
  it('55 successors, as many as bonds.json', () => {
    expect(Object.keys(L.successors)).toHaveLength(55);
    expect(Object.keys(L.successors)).toHaveLength(bonds.items.successors.list.length);
    for (const s of Object.values(L.successors)) expect(L.npcs[s.of], s.of).toBeTruthy();
  });
});

describe('looks generator: every person is complete and uses only the vocabulary', () => {
  const all = [...Object.entries(L.npcs), ...Object.entries(L.successors)];
  it('no field is missing; colours are hex; stage is one of five', () => {
    for (const [id, p] of all) {
      for (const c of [p.skin, p.hairColor, p.eye, p.main, p.second]) expect(c, id).toMatch(HEX);
      expect(['infant', 'child', 'teen', 'adult', 'elder'], id).toContain(p.stage);
      expect(L.races[p.race], id).toBeTruthy();
      expect(p.wear, id).toBeGreaterThanOrEqual(0);
      expect(p.wear, id).toBeLessThanOrEqual(1);
      expect(Array.isArray(p.feats), id).toBe(true);
      expect(p.fem === null || typeof p.fem === 'boolean', id).toBe(true);
    }
  });
  it('every part id is in src/art/parts/ids.ts', () => {
    for (const [id, p] of all) {
      expect(inSet(p.outfit, OUTFIT_IDS), `${id} outfit ${p.outfit}`).toBe(true);
      expect(inSet(p.hair, HAIR_IDS), `${id} hair ${p.hair}`).toBe(true);
      expect(inSet(p.beard, BEARD_IDS), `${id} beard ${p.beard}`).toBe(true);
      expect(inSet(p.hat, HAT_IDS), `${id} hat ${p.hat}`).toBe(true);
      expect(inSet(p.tool, TOOL_IDS), `${id} tool ${p.tool}`).toBe(true);
      for (const f of p.feats) expect(FEAT_IDS as readonly string[], `${id} feat ${f}`).toContain(f);
    }
    for (const r of Object.values(L.races)) {
      for (const f of r.feats) expect(FEAT_IDS as readonly string[], `${r.id} feat ${f}`).toContain(f);
      for (const l of r.lines) for (const f of l.overrides.feats ?? []) expect(FEAT_IDS as readonly string[], `${r.id}/${l.name} feat ${f}`).toContain(f);
    }
  });
  it('every id the word tables can produce is in src/art/parts/ids.ts', () => {
    const ids = (rules: [string, RegExp][]) => rules.map((r) => r[0]);
    for (const id of ids(OUTFIT_RULES)) expect(OUTFIT_IDS as readonly string[]).toContain(id);
    for (const id of ids(HAIR_RULES)) expect(HAIR_IDS as readonly string[]).toContain(id);
    for (const id of ids(BEARD_RULES)) expect(BEARD_IDS as readonly string[]).toContain(id);
    for (const id of ids(HAT_RULES)) expect(HAT_IDS as readonly string[]).toContain(id);
    for (const id of ids(TOOL_RULES)) expect(TOOL_IDS as readonly string[]).toContain(id);
    for (const id of ids(FEAT_RULES)) expect(FEAT_IDS as readonly string[]).toContain(id);
    for (const fn of Object.values(LINE_OVERRIDES)) for (const f of fn(['wings:feather']).feats ?? []) expect(FEAT_IDS as readonly string[]).toContain(f);
  });
  it('the sub-line of an NPC belongs to its race', () => {
    for (const [id, p] of all) if (p.line) expect(L.races[p.race].lines.map((l) => l.name), id).toContain(p.line);
  });
  it('sampled NPCs read as their description says', () => {
    expect(L.npcs['AZ01-1']).toMatchObject({ race: 'winged', line: 'อาเวียนขาว', outfit: 'priest', hair: 'braid', tool: 'censer', fem: false });
    expect(L.npcs['AZ01-2']).toMatchObject({ race: 'winged', line: 'ปีกเกล็ด', outfit: 'plate', tool: 'spear', main: '#8a2a1a', second: '#d8a030' });
    expect(L.npcs['AZ01-3'].fem).toBe(true);
    expect(L.npcs['KD01-1']).toMatchObject({ race: 'dwarf', stage: 'elder', beard: 'long', hat: 'crown', outfit: 'apron' });
    expect(L.npcs['SH04-1']).toMatchObject({ outfit: 'regal', hat: 'turban', beard: 'moustache' });
    expect(L.npcs['MH03-6']).toMatchObject({ race: 'ghoul', stage: 'child', fem: true });
  });
});

describe('look-words: the word tables', () => {
  it('Thai codes of the README', () => {
    expect(earsOf('หูยาวชี้ขึ้น')).toBe('long');
    expect(earsOf('หูแหลมสั้น')).toBe('pointed');
    expect(earsOf('ไม่มีหู')).toBe('none');
    expect(lowerOf('ชายผ้าพลิ้วคล้ายครีบ')).toBe('gown');
    expect(gaitOf('ก้าวเบาลื่น')).toBe('glide');
    expect(gaitOf('ลอยเหนือพื้น')).toBe('float');
    expect(gaitOf('เดินลากเท้า')).toBe('shuffle');
  });
  it('stage, sex, skin, wear and tools', () => {
    expect(stageWord('ผู้เฒ่า')).toBe('elder');
    expect(stageWord('วัยรุ่น')).toBe('teen');
    expect(stageWord('-')).toBeNull();
    expect(stageFromDescription('เด็กหญิงอายุแปดขวบ')).toBe('child');
    expect(femOf('หญิงสาวร่างบาง', '', '')).toBe(true);
    expect(femOf('ชายเฒ่า', '', '')).toBe(false);
    expect(femOf('ร่างสูงโปร่ง', 'เงา', '')).toBeNull();
    expect(skinHint('ผิวคล้ำ')).toBe('dark');
    expect(skinHint('ผิวซีดมีรอยย่น')).toBe('light');
    expect(wearOf('ชุดขาดวิ่นเปื้อน')).toBeGreaterThan(wearOf('ชุดเก่า'));
    expect(wearOf('ชุดสะอาด')).toBe(0);
    expect(toolOf(['หอกยาวและเกราะเต็มยศ'], '').tool).toBe('spear');
    expect(toolOf(['ปืนสั้น'], '').tool).toBe('pistol');
    expect(toolOf(['เครื่องยิงลำแสง'], '').miss).toEqual(['เครื่องยิงลำแสง']);
  });
  it('the second set of held things: guns, instruments, a fan, scissors, a whip', () => {
    const tool = (w: string) => toolOf([w], '').tool;
    expect(tool('ปืนสองกระบอก')).toBe('pistol');
    expect(tool('ปืนยาว')).toBe('musket');
    expect(tool('รูนปืนไรเฟิล')).toBe('rifle');
    expect(tool('กล้องส่องทางไกลทองเหลือง')).toBe('spyglass');
    expect(tool('เข็มทิศทองเหลือง')).toBe('compass');
    expect(tool('นาฬิกาพกรถไฟ')).toBe('pocketwatch');
    expect(tool('พัดขนนก')).toBe('fan');
    expect(tool('กรรไกรตัดกิ่ง')).toBe('scissors');
    expect(tool('เครื่องวัดแรงสั่น')).toBe('gauge');
    expect(tool('แส้ม้า')).toBe('whip');
    expect(tool('หนังสติ๊กไม้')).toBe('sling');
    expect(tool('สนับมือเหล็ก')).toBe('knuckles');
    // not held in the hand: a cart, a podium, a pet bird (ignored, not reported)
    for (const w of ['รถเข็นอาหาร', 'โพเดียมไม้โอ๊ก', 'นกส่งสาร']) expect(toolOf([w], ''), w).toEqual({ tool: null, miss: [] });
  });
  it('a held thing never sets the outfit; a head cloth is no outfit either', () => {
    expect(outfitFromGarments('ชุดคลุมสีเทาถือผ้าคลุมกันฝน')).toBe('robe');
    expect(outfitFromGarments('ผมรวบใต้ผ้าคลุมสีเทา ชุดเดินทางสีน้ำตาล')).toBe('cloak');
    expect(outfitFromGarments('ศีรษะโล้นชุดนักบวชสีเทาเข้มคลุมหลวม')).toBe('priest');
    expect(outfitFromGarments('ผมดำพันผ้าขาวม้า กางเกงขาก๊วยสีคราม')).toBeNull();
    expect(outfitFromGarments('หญิงสาว ถือแผนที่และเกราะเหล็กของพ่อ ชุดผ้าฝ้ายสีทราย')).toBe('light');
  });
  it('the face items and the spirits', () => {
    expect(featsOf('แว่นตากรอบทองบนจมูก')).toEqual(['glasses']);
    expect(featsOf('ชายเฒ่า', ['แว่นเลนส์เดียว'])).toEqual(['monocle']);
    expect(featsOf('ผมสั้น', ['แว่นขยาย'])).toEqual([]);
    expect(featsOf('กัปปะชราจานน้ำบนหัวใหญ่')).toEqual(['dish']);
    expect(featsOf('ไซคลอปส์ตาเดียวใหญ่กลางหน้าผาก')).toEqual(['cyclops']);
    expect(featsOf('หนวดสิบกว่าเส้นห่อกันเหมือนผ้า')).toEqual(['tentacles']);
  });
});

describe('looks generator: the second set of words reaches the rows', () => {
  it('nothing the docs name is left unmatched', () => {
    expect(L.counts.unmatched).toBe(0);
    expect(readFileSync('data/gen/_unparsed/looks.md', 'utf8')).toContain('0 รายการ');
  });
  it('spirits are ghosts, in whatever race they were', () => {
    for (const id of ['MH12-1', 'MH12-2', 'AL25-3', 'SH14-1', 'SH14-3', 'SH14-4', 'SV13-2', 'NB08-2', 'NB08-4', 'NB13-3']) expect(L.npcs[id].feats, id).toContain('ghost');
    expect(L.npcs['MH10-1'].feats).not.toContain('ghost');
  });
  it('the sampled rows carry their new things', () => {
    expect(L.npcs['MH11-1'].tool).toBe('compass');
    expect(L.npcs['AL27-1'].tool).toBe('pistol');
    expect(L.npcs['AL09-2'].tool).toBe('pocketwatch');
    expect(L.npcs['NR09-1'].feats).toContain('dish');
    expect(L.npcs['SH06-5'].feats).toContain('cyclops');
  });
  it('the dwarves have a beard and an apron by default, the races that have none have none', () => {
    expect(L.races.dwarf).toMatchObject({ outfit: 'apron', beard: 'braided' });
    expect(L.races.elf.beard).toBe('');
    expect(L.races.human.beard).toBe('');
    for (const r of Object.values(L.races)) {
      expect(inSet(r.outfit, OUTFIT_IDS), r.id).toBe(true);
      expect(inSet(r.beard, BEARD_IDS), r.id).toBe(true);
      expect(inSet(r.hat, HAT_IDS), r.id).toBe(true);
      expect(inSet(r.hair, HAIR_IDS), r.id).toBe(true);
      expect(inSet(r.hairFem, HAIR_IDS), r.id).toBe(true);
      expect(inSet(r.tool, TOOL_IDS), r.id).toBe(true);
      expect(r.main, r.id).toMatch(HEX);
      expect(r.second, r.id).toMatch(HEX);
      if (r.hairColor) expect(r.hairColor, r.id).toMatch(HEX);
    }
    // the dwarf women braid their hair in place of a beard; the slime is gel and has none of it
    expect(L.races.dwarf).toMatchObject({ hair: '', hairFem: 'braid', hat: '', tool: 'hammer' });
    expect(L.races.slime).toMatchObject({ outfit: '', hat: '', hair: '', tool: '' });
  });
});
