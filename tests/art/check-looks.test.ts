// The measures of npm run check:looks (scripts/tools/check-looks.ts) on small synthetic looks: identical looks fail, a different hat passes the
// signature, a different outfit passes the silhouette, near colours fail the colour check; and the loader reads the whole world.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HUMAN_BODY, type PersonLook } from '../../src/art/look';
import { paintPerson } from '../../src/art/person';
import type { LooksData } from '../../src/core/data/types-looks';
import {
  COLOUR_MIN, SILHOUETTE_MIN, areaOf, checkEntries, deltaE, failed, labOf, loadEntries, maskOf, report, signatureOf, silhouetteDiff, summary, type Entry,
} from '../../scripts/tools/check-looks';

const base: PersonLook = {
  kind: 'person', key: 'a', race: 'human', stage: 'adult', fem: false, body: HUMAN_BODY, skin: '#e8b48a', hairColor: '#3a2a20', eye: '#1e1a22',
  accent: '#d9a030', main: '#5a6a4a', second: '#6a4a32', outfit: 'tunic', hair: 'short', hat: '', beard: '', tool: '', feats: [], wear: 0.1,
};
const look = (over: Partial<PersonLook>): PersonLook => ({ ...base, ...over });
const entry = (id: string, over: Partial<PersonLook> = {}, e: Partial<Entry> = {}): Entry => ({
  id, kind: 'npc', country: 'XX-01', continent: 'XX', name: id, look: look({ key: id, ...over }), pose: 'ยืน', defaults: [], ...e,
});
const mask = (L: PersonLook) => maskOf(paintPerson(L, 'idle', 0));

describe('check:looks: the measures', () => {
  it('the same look has the same shape, a different outfit and a hat make another', () => {
    expect(silhouetteDiff(mask(base), mask(base))).toBe(0);
    const robe = look({ outfit: 'robe', hat: 'wizard' });
    expect(silhouetteDiff(mask(base), mask(robe))).toBeGreaterThan(SILHOUETTE_MIN);
    // the grid basis is the smaller number: a figure fills a small part of the 56 x 56 grid
    expect(silhouetteDiff(mask(base), mask(robe), 'grid')).toBeLessThan(silhouetteDiff(mask(base), mask(robe)));
  });
  it('the ground shadow is not part of the shape; the figure has some cells', () => {
    const m = mask(base);
    expect(areaOf(m)).toBeGreaterThan(150);
    expect(areaOf(m)).toBeLessThan(900);
  });
  it('a taller figure and a child differ in shape', () => {
    const tall = look({ body: { ...HUMAN_BODY, scale: 1.3 } }), kid = look({ stage: 'child' });
    expect(silhouetteDiff(mask(base), mask(tall))).toBeGreaterThan(SILHOUETTE_MIN);
    expect(silhouetteDiff(mask(base), mask(kid))).toBeGreaterThan(SILHOUETTE_MIN);
  });
  it('colours in L*a*b*: white and black are 100 apart, the same colour is 0, near colours are near', () => {
    expect(labOf('#ffffff')[0]).toBeCloseTo(100, 0);
    expect(labOf('#000000')[0]).toBeCloseTo(0, 0);
    expect(deltaE('#ffffff', '#000000')).toBeCloseTo(100, 0);
    expect(deltaE('#5a6a4a', '#5a6a4a')).toBe(0);
    expect(deltaE('#5a6a4a', '#5b6a4a')).toBeLessThan(2);
    expect(deltaE('#5a6a4a', '#4a5a3a')).toBeLessThan(COLOUR_MIN + 5);
    expect(deltaE('#5a6a4a', '#8a2a1a')).toBeGreaterThan(40);
    expect(deltaE('#8a2a1a', '#5a6a4a')).toBeCloseTo(deltaE('#5a6a4a', '#8a2a1a'), 6);
  });
  it('the signature reads race line stage outfit main colour hair hat held thing and pose', () => {
    const s = signatureOf(base, 'ยืน');
    expect(signatureOf(look({ key: 'other', fem: true, beard: 'long', skin: '#000000', wear: 0.9 }), 'ยืน')).toBe(s);
    for (const over of [{ race: 'elf' }, { line: 'x' }, { stage: 'elder' as const }, { outfit: 'robe' }, { main: '#5a6a4b' }, { hair: 'long' }, { hat: 'cap' }, { tool: 'sword' }])
      expect(signatureOf(look(over), 'ยืน'), JSON.stringify(over)).not.toBe(s);
    expect(signatureOf(base, 'นั่ง')).not.toBe(s);
  });
});

describe('check:looks: the pairs of one country', () => {
  it('two identical looks fail every check', () => {
    const r = checkEntries([entry('A'), entry('B')]);
    expect(r.signatures).toHaveLength(1);
    expect(r.signatures[0].ids).toEqual(['A', 'B']);
    expect(r.pairs).toHaveLength(1);
    expect(r.pairs[0]).toMatchObject({ failSilhouette: true, failColour: true, silhouette: 0, colour: 0 });
    expect(r.confusable).toHaveLength(1);
    expect(failed(r)).toBe(true);
  });
  it('a different hat passes the signature; a different outfit passes the silhouette; a different colour passes the colour', () => {
    const hat = checkEntries([entry('A'), entry('B', { hat: 'cap' })]);
    expect(hat.signatures).toHaveLength(0);
    const outfit = checkEntries([entry('A'), entry('B', { outfit: 'robe', hat: 'wizard' })]);
    expect(outfit.pairs[0]?.failSilhouette ?? false).toBe(false);
    expect(outfit.pairs[0]?.failColour).toBe(true);
    const colour = checkEntries([entry('A'), entry('B', { main: '#8a2a1a' })]);
    expect(colour.pairs[0]?.failColour ?? false).toBe(false);
    expect(colour.pairs[0]?.failSilhouette).toBe(true);
    const both = checkEntries([entry('A'), entry('B', { outfit: 'robe', hat: 'wizard', main: '#8a2a1a' })]);
    expect(both.pairs).toHaveLength(0);
    expect(both.signatures).toHaveLength(0);
    expect(failed(both)).toBe(false);
  });
  it('people of other countries are not compared; a successor is not compared with the person it succeeds', () => {
    expect(checkEntries([entry('A'), entry('B', {}, { country: 'XX-02' })]).pairs).toHaveLength(0);
    const kin = checkEntries([entry('A'), entry('AS', { key: 'AS' }, { kind: 'successor', of: 'A' })]);
    expect(kin.pairs).toHaveLength(0);
    expect(kin.pairCount).toBe(0);
    const other = checkEntries([entry('A'), entry('C'), entry('AS', {}, { kind: 'successor', of: 'A' })]);
    expect(other.pairCount).toBe(2);
  });
  it('a duplicate signature is found across countries too', () => {
    expect(checkEntries([entry('A'), entry('B', {}, { country: 'XX-02' })]).signatures).toHaveLength(1);
  });
  it('the thresholds are the arguments, the painter is replaceable', () => {
    const loose = checkEntries([entry('A'), entry('B', { hat: 'cap' })], { silhouetteMin: 0, colourMin: 0 });
    expect(loose.pairs).toHaveLength(0);
    const blank = checkEntries([entry('A', { main: '#111111' }), entry('B', { main: '#999999' })], { frame: () => ({ w: 56, h: 56, data: new Uint8ClampedArray(56 * 56 * 4) }) });
    expect(blank.pairs[0]).toMatchObject({ failSilhouette: true, failColour: false });
  });
  it('people with three or more defaulted fields are listed as underspecified', () => {
    const r = checkEntries([entry('A', {}, { defaults: ['outfit', 'hair', 'eye'] }), entry('B', { hat: 'cap' }, { defaults: ['skin'] })]);
    expect(r.underspecified.map((e) => e.id)).toEqual(['A']);
  });
  it('the report names the countries, the ids and the thresholds', () => {
    const r = checkEntries([entry('A'), entry('B')]);
    const md = report(r), text = summary(r).join('\n');
    expect(md).toContain('XX-01');
    expect(md).toContain('| XX-01 | A A | B B | เงาร่าง+สีหลัก |');
    expect(text).toContain('ΔE76 12');
    expect(text).toContain('8.0%');
  });
});

describe('check:looks: the world', () => {
  const looks = (JSON.parse(readFileSync('data/gen/looks.json', 'utf8')) as { items: LooksData }).items;
  const entries = loadEntries(looks);
  it('every NPC and successor is an entry; a successor sits in the country of its original', () => {
    expect(entries).toHaveLength(Object.keys(looks.npcs).length + Object.keys(looks.successors).length);
    for (const e of entries.filter((x) => x.kind === 'successor')) expect(e.country).toBe(looks.npcs[e.of!].country);
    for (const e of entries) expect(e.country, e.id).toMatch(/^[A-Z]{2}-\d\d$/);
  });
  it('the check runs on the world and names pairs by their ids', () => {
    const r = checkEntries(entries.filter((e) => e.country <= 'AL-04'));
    expect(r.pairCount).toBeGreaterThan(5);
    for (const p of r.pairs) {
      expect(p.a).not.toBe(p.b);
      expect(p.silhouette).toBeGreaterThanOrEqual(0);
      expect(p.colour).toBeGreaterThanOrEqual(0);
    }
  });
});
