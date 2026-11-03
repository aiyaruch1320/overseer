// The held things of M6 wave 4 (tools-extra.ts): the things the docs name that used to fall to a generic book or box. Every id of the list has a
// painter, the painter changes the picture, no two of them look alike, and each survives every pose, stage and body.
import { describe, expect, it } from 'vitest';
import { POSES } from '../../src/art/anim';
import { HUMAN_BODY, type PersonLook, type Stage } from '../../src/art/look';
import { paintPerson, unknownParts } from '../../src/art/person';
import { TOOLS } from '../../src/art/parts';
import { TOOL_IDS } from '../../src/art/parts/ids';
import { TOOLS_EXTRA } from '../../src/art/parts/tools-extra';

const WAVE4 = [
  'keyring', 'basket', 'garland', 'mallet', 'bellrope', 'beads', 'doll', 'bucket', 'papyrus', 'card', 'letter', 'crystal', 'jar', 'net',
  'brush', 'map', 'bottle', 'pipe', 'bag', 'hotiron', 'tank', 'quill', 'chalk',
];
const STAGES: Stage[] = ['infant', 'child', 'teen', 'adult', 'elder'];
const bare: PersonLook = {
  kind: 'person', key: 'extra', race: 'human', stage: 'adult', fem: false, body: HUMAN_BODY, skin: '#e8b48a', hairColor: '#3a2a20', eye: '#1e1a22',
  accent: '#d9a030', main: '#5a6a4a', second: '#6a4a32', outfit: 'tunic', hair: 'short', hat: '', beard: '', tool: '', feats: [], wear: 0.3,
};
const look = (over: Partial<PersonLook>): PersonLook => ({ ...bare, ...over });
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.length === b.length && a.every((v, i) => v === b[i]);

describe('the wave-4 held things: tables', () => {
  it('every id is in the id list and has a painter', () => {
    for (const id of WAVE4) {
      expect(TOOL_IDS as readonly string[]).toContain(id);
      expect(TOOLS_EXTRA[id], id).toBeDefined();
      expect(TOOLS[id]).toBe(TOOLS_EXTRA[id]);
      expect(TOOLS_EXTRA[id].kind, id).not.toBe('none');
      expect(unknownParts(look({ tool: id }))).toEqual([]);
    }
  });
  it('every id of the tool list has a painter', () => {
    expect(TOOL_IDS.filter((id) => !TOOLS[id])).toEqual([]);
  });
});

describe('the wave-4 held things: they change the picture and differ from each other', () => {
  const bare0 = paintPerson(look({}), 'idle', 0);
  for (const id of WAVE4)
    it(`tool ${id}`, () => {
      expect(same(paintPerson(look({ tool: id }), 'idle', 0).data, bare0.data), `${id} draws nothing`).toBe(false);
    });
  it('no two of them paint the same picture', () => {
    const seen = new Map<string, string>();
    for (const id of [...WAVE4, 'book', 'scroll', 'ledger', 'mug', 'bowl', 'flask', 'lantern', 'hammer', 'wand', 'lute']) {
      const key = Array.from(paintPerson(look({ tool: id }), 'idle', 0).data).join(',');
      expect(seen.get(key), `${id} looks like ${seen.get(key)}`).toBeUndefined();
      seen.set(key, id);
    }
  });
});

describe('the wave-4 held things: every pose, stage and sex', () => {
  for (const id of WAVE4)
    it(id, () => {
      for (const stage of STAGES)
        for (const fem of [false, true])
          for (const pose of POSES)
            for (let f = 0; f < pose.n; f++) {
              const frame = paintPerson(look({ tool: id, stage, fem, wear: (f + 1) / 4 }), pose.id, f);
              let n = 0;
              for (let i = 3; i < frame.data.length; i += 4) if (frame.data[i]) n++;
              expect(n, `${id} ${stage} ${pose.id}`).toBeGreaterThan(20);
            }
    });
});

// ── wave 5: a sheathed sword, ankle bells, a second pistol, a stone drum, a chisel, a small hammer, a wrench, a slate, a bouquet, a sleeping child ──
const WAVE5 = ['sheathed', 'greatsheath', 'goldsheath', 'anklebells', 'twinpistol', 'drum', 'chisel', 'smallhammer', 'wrench', 'slate', 'bouquet', 'sleepingchild'];
/** The things that draw at the body and leave the hands free (kind none); every other wave-5 thing is held. */
const AT_BODY = ['sheathed', 'greatsheath', 'goldsheath', 'anklebells'];

describe('the wave-5 held things: tables', () => {
  it('every id is in the id list and has a painter', () => {
    for (const id of WAVE5) {
      expect(TOOL_IDS as readonly string[]).toContain(id);
      expect(TOOLS_EXTRA[id], id).toBeDefined();
      expect(TOOLS[id]).toBe(TOOLS_EXTRA[id]);
      expect(unknownParts(look({ tool: id }))).toEqual([]);
      expect(TOOLS_EXTRA[id].kind === 'none', id).toBe(AT_BODY.includes(id));
    }
  });
});

describe('the wave-5 held things: they change the picture and differ from each other and from the older things', () => {
  const bare0 = paintPerson(look({}), 'idle', 0);
  for (const id of WAVE5)
    it(`tool ${id}`, () => {
      expect(same(paintPerson(look({ tool: id }), 'idle', 0).data, bare0.data), `${id} draws nothing`).toBe(false);
    });
  it('no two of them paint the same picture', () => {
    const seen = new Map<string, string>();
    for (const id of [...WAVE5, 'hammer', 'mallet', 'dagger', 'sword', 'greatsword', 'pistol', 'book', 'doll', 'garland', 'lute']) {
      const key = Array.from(paintPerson(look({ tool: id }), 'idle', 0).data).join(',');
      expect(seen.get(key), `${id} looks like ${seen.get(key)}`).toBeUndefined();
      seen.set(key, id);
    }
  });
  it('the sheathed sword shows in every pose, also with empty hands', () => {
    for (const pose of POSES)
      for (let f = 0; f < pose.n; f++) expect(same(paintPerson(look({ tool: 'sheathed' }), pose.id, f).data, paintPerson(look({}), pose.id, f).data), `${pose.id} ${f}`).toBe(false);
  });
  it('the second pistol is in a lower hand for a man with four arms and at the hip for another', () => {
    const four = paintPerson(look({ tool: 'twinpistol', feats: ['fourarms'] }), 'idle', 0), two = paintPerson(look({ tool: 'twinpistol' }), 'idle', 0);
    expect(same(four.data, two.data)).toBe(false);
    expect(same(two.data, paintPerson(look({ tool: 'pistol' }), 'idle', 0).data)).toBe(false);
  });
});

describe('the wave-5 held things: every pose, stage and sex', () => {
  for (const id of WAVE5)
    it(id, () => {
      for (const stage of STAGES)
        for (const fem of [false, true])
          for (const pose of POSES)
            for (let f = 0; f < pose.n; f++) {
              const frame = paintPerson(look({ tool: id, stage, fem, wear: (f + 1) / 4 }), pose.id, f);
              let n = 0;
              for (let i = 3; i < frame.data.length; i += 4) if (frame.data[i]) n++;
              expect(n, `${id} ${stage} ${pose.id}`).toBeGreaterThan(20);
            }
    });
});
