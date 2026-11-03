import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LooksData } from '../../src/core/data/types-looks';
import { BEARD_IDS, FEAT_IDS, HAIR_IDS, HAT_IDS, OUTFIT_IDS, TOOL_IDS } from '../../src/art/parts/ids';
import { npcLook, raceLook, successorLook } from '../../src/art/resolve';
import type { PersonLook, Stage } from '../../src/art/look';

const looks = (JSON.parse(readFileSync('data/gen/looks.json', 'utf8')) as { items: LooksData }).items;
const HEX = /^#[0-9a-f]{6}$/i;
const STAGES: Stage[] = ['infant', 'child', 'teen', 'adult', 'elder'];
const has = (id: string, all: readonly string[]) => id === '' || all.includes(id);

function check(L: PersonLook, what: string): void {
  expect(L.kind, what).toBe('person');
  for (const c of [L.skin, L.hairColor, L.eye, L.accent, L.main, L.second]) expect(c, what).toMatch(HEX);
  expect(has(L.outfit, OUTFIT_IDS), `${what} outfit ${L.outfit}`).toBe(true);
  expect(has(L.hair, HAIR_IDS), `${what} hair ${L.hair}`).toBe(true);
  expect(has(L.beard, BEARD_IDS), `${what} beard ${L.beard}`).toBe(true);
  expect(has(L.hat, HAT_IDS), `${what} hat ${L.hat}`).toBe(true);
  expect(has(L.tool, TOOL_IDS), `${what} tool ${L.tool}`).toBe(true);
  for (const f of L.feats) expect(FEAT_IDS as readonly string[], `${what} feat ${f}`).toContain(f);
  expect(L.body.scale, what).toBeGreaterThan(0);
  expect(L.wear, what).toBeGreaterThanOrEqual(0);
  expect(L.wear, what).toBeLessThanOrEqual(1);
}

describe('resolve: NPCs', () => {
  it('every NPC resolves to a complete Look keyed by its id', () => {
    const ids = Object.keys(looks.npcs);
    expect(ids.length).toBe(614);
    for (const id of ids) {
      const L = npcLook(looks, id);
      check(L, id);
      expect(L.key).toBe(id);
      expect(L.race).toBe(looks.npcs[id].race);
    }
  });
  it('is deterministic and JSON-clean', () => {
    for (const id of Object.keys(looks.npcs)) {
      const a = npcLook(looks, id), b = npcLook(looks, id);
      expect(a).toEqual(b);
      expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    }
  });
  it('a sub-line changes the body and the race feats it shows', () => {
    const scale = npcLook(looks, 'AZ01-2'); // ปีกเกล็ด
    expect(scale.feats).toContain('wings:scale');
    expect(scale.feats).not.toContain('wings:feather');
    expect(npcLook(looks, 'AZ01-1').feats).toContain('wings:feather');
  });
  it('opts change the stage and the sex of one Look only', () => {
    const base = npcLook(looks, 'KD01-1');
    const kid = npcLook(looks, 'KD01-1', { stage: 'child', fem: true });
    expect(kid.stage).toBe('child');
    expect(kid.fem).toBe(true);
    expect(kid.beard).toBe('');
    expect(base.beard).toBe('long');
    expect(npcLook(looks, 'KD01-1')).toEqual(base);
  });
  it('an unknown id is an error', () => {
    expect(() => npcLook(looks, 'XX00-0')).toThrow();
    expect(() => successorLook(looks, 'XX00-0S')).toThrow();
  });
  it('the Looks of one continent are mostly told apart by their drawn fields', () => {
    const sig = (L: PersonLook) => JSON.stringify([L.race, L.line, L.stage, L.fem, L.outfit, L.main, L.second, L.hair, L.hat, L.tool]);
    const seen = new Map<string, string>();
    let same = 0;
    for (const id of Object.keys(looks.npcs)) {
      const s = sig(npcLook(looks, id));
      if (seen.has(s)) same++;
      seen.set(s, id);
    }
    expect(same).toBeLessThan(10);
  });
});

describe('resolve: successors', () => {
  it('55 of them resolve, keyed by their code, deterministic', () => {
    const ids = Object.keys(looks.successors);
    expect(ids).toHaveLength(55);
    for (const id of ids) {
      const L = successorLook(looks, id);
      check(L, id);
      expect(L.key).toBe(id);
      expect(successorLook(looks, id)).toEqual(L);
    }
  });
});

describe('resolve: races', () => {
  it('every race, sub-line, stage and sex resolves; same seed, same figure', () => {
    for (const r of Object.values(looks.races)) {
      for (const line of [undefined, ...r.lines.map((l) => l.name)]) {
        for (const stage of STAGES) {
          for (const fem of [false, true]) {
            const a = raceLook(looks, r.id, { line, stage, fem, seed: 'x' });
            check(a, `${r.id}/${line}/${stage}`);
            expect(raceLook(looks, r.id, { line, stage, fem, seed: 'x' })).toEqual(a);
            expect(a.stage).toBe(stage);
            expect(a.fem).toBe(fem);
          }
        }
      }
    }
  });
  it('the seed picks among the skins of the race', () => {
    const skins = new Set(Array.from({ length: 40 }, (_, i) => raceLook(looks, 'human', { stage: 'adult', fem: false, seed: `s${i}` }).skin));
    expect(skins.size).toBeGreaterThan(2);
    for (const s of skins) expect(looks.races.human.skins).toContain(s);
  });
  it('a dwarf man has the beard and the apron of his race; women and children have no beard, a dwarf woman braids her hair', () => {
    const man = raceLook(looks, 'dwarf', { stage: 'adult', fem: false, seed: 'a' });
    expect(man.beard).toBe(looks.races.dwarf.beard);
    expect(man.beard).not.toBe('');
    expect(man.outfit).toBe('apron');
    expect(raceLook(looks, 'dwarf', { stage: 'elder', fem: false, seed: 'a' }).beard).not.toBe('');
    expect(raceLook(looks, 'dwarf', { stage: 'child', fem: false, seed: 'a' }).beard).toBe('');
    const woman = raceLook(looks, 'dwarf', { stage: 'adult', fem: true, seed: 'a' });
    expect(woman.beard).toBe('');
    expect(woman.hair).toBe('braid');
    expect(raceLook(looks, 'elf', { stage: 'adult', fem: false, seed: 'a' }).beard).toBe('');
  });
  it('a race is dressed as its เครื่องแต่ง says: clothes, hat, colours, hair, a thing carried by habit', () => {
    const adult = (race: string, fem = false) => raceLook(looks, race, { stage: 'adult', fem, seed: 'z' });
    const dwarf = adult('dwarf');
    expect(dwarf).toMatchObject({ outfit: 'apron', tool: 'hammer', beard: 'braided' });
    expect(dwarf.main).toBe('#6a4a30'); // leather
    expect(dwarf.second).toBe('#8a90a0'); // tempered iron
    expect(adult('dragonkin')).toMatchObject({ outfit: 'armor', hat: 'crown' });
    expect(adult('halfling')).toMatchObject({ hat: 'cap', hair: 'curly' });
    expect(adult('elf').hair).toBe('braid');
    expect(adult('elf').outfit).toBe('light');
    expect(adult('darkelf').hairColor).toBe('#dcdee8');
    expect(adult('vampire')).toMatchObject({ outfit: 'robe', main: '#1e1a1c' });
    expect(adult('orc').hat).toBe(''); // "ไม่ใส่หมวกในที่อบอุ่น"
    expect(adult('giant').tool).toBe('hammer');
    expect(adult('slime')).toMatchObject({ outfit: 'tunic', hat: '', tool: '' });
    // no race looks like the plain tunic in the colours of its accents any more
    const dressed = Object.keys(looks.races).filter((r) => adult(r).outfit !== 'tunic' || adult(r).hat || adult(r).tool || adult(r).hair !== 'short');
    expect(dressed.length).toBeGreaterThanOrEqual(12);
    for (const r of Object.values(looks.races)) {
      expect(r.main, r.id).toMatch(HEX);
      expect(r.second, r.id).toMatch(HEX);
      expect(r.main, r.id).not.toBe(r.second);
    }
  });
  it('the young of a race wear its clothes but no hat, no beard and carry nothing', () => {
    for (const stage of ['infant', 'child'] as const) {
      const L = raceLook(looks, 'dwarf', { stage, fem: false, seed: 'z' });
      expect(L).toMatchObject({ hat: '', beard: '', tool: '', outfit: 'apron' });
    }
    expect(raceLook(looks, 'dragonkin', { stage: 'child', fem: false, seed: 'z' }).hat).toBe('');
  });
  it('a spirit NPC keeps its ghost feat through the resolver', () => {
    expect(npcLook(looks, 'MH12-1').feats).toContain('ghost');
  });
  it('the slime has no hair', () => {
    expect(raceLook(looks, 'slime', { stage: 'adult', fem: true, seed: 'a' }).hair).toBe('');
  });
});

describe('resolve: what one person has that the race has not (M6 wave 5)', () => {
  it('a row body replaces only the fields it names', () => {
    const q = npcLook(looks, 'SH14-1'), race = looks.races[looks.npcs['SH14-1'].race].body;
    expect(q.body.gait).toBe('float');
    expect(q.body.scale).toBeGreaterThan(race.scale);
    expect(q.body.lower).toBe(race.lower);
    // a fat man is as tall as his race and wider
    const fat = npcLook(looks, 'SH15-1');
    expect(fat.body.shoulders).toBeGreaterThan(1.3);
    expect(fat.body.gait).toBe('normal');
  });
  it('a row of its own race feats replaces the race one: the shadow queen is no ghoul, the sky-water heir keeps the gills', () => {
    expect(npcLook(looks, 'SH14-1').feats).not.toContain('gaunt');
    expect(npcLook(looks, 'SH14-1').feats).toContain('glow-eyes');
    expect(successorLook(looks, 'AZ06-4S').feats).toContain('gills');
  });
  it('an heir the doc calls small or new is as tall as the doc says, not as the age column makes it', () => {
    expect(successorLook(looks, 'MK03-6S').stage).toBe('teen');
    expect(npcLook(looks, 'MK06-4').stage).toBe('adult');
    expect(npcLook(looks, 'NB10-3').stage).toBe('teen');
  });
});
