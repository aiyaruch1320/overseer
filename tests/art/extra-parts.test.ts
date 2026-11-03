// The parts added in M6 wave 2 (tools-extra.ts, feats-extra.ts): every id of the list has a painter, the painter changes the picture, and
// it survives every pose, stage and body without throwing. The ghost has no feet and is see-through; the glasses leave a hat free.
import { describe, expect, it } from 'vitest';
import { FRAME, POSES } from '../../src/art/anim';
import { HUMAN_BODY, type PersonLook, type Stage } from '../../src/art/look';
import { paintPerson, unknownParts } from '../../src/art/person';
import { FEATS, TOOLS } from '../../src/art/parts';
import { FEATS_EXTRA } from '../../src/art/parts/feats-extra';
import { FEAT_IDS, TOOL_IDS } from '../../src/art/parts/ids';
import { TOOLS_EXTRA } from '../../src/art/parts/tools-extra';

const NEW_TOOLS = ['pistol', 'musket', 'rifle', 'spyglass', 'compass', 'pocketwatch', 'fan', 'scissors', 'gauge', 'whip', 'sling', 'knuckles'];
const NEW_FEATS = ['ghost', 'tentacles', 'cyclops', 'dish', 'glasses', 'monocle'];
const STAGES: Stage[] = ['infant', 'child', 'teen', 'adult', 'elder'];
const bare: PersonLook = {
  kind: 'person', key: 'extra', race: 'human', stage: 'adult', fem: false, body: HUMAN_BODY, skin: '#e8b48a', hairColor: '#3a2a20', eye: '#1e1a22',
  accent: '#d9a030', main: '#5a6a4a', second: '#6a4a32', outfit: 'tunic', hair: 'short', hat: '', beard: '', tool: '', feats: [], wear: 0.3,
};
const look = (over: Partial<PersonLook>): PersonLook => ({ ...bare, ...over });
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.length === b.length && a.every((v, i) => v === b[i]);
const alphaAt = (f: { w: number; data: Uint8ClampedArray }, x: number, y: number) => f.data[(y * f.w + x) * 4 + 3];

describe('the extra parts: tables', () => {
  it('every new id is in the id lists and has a painter in its own file', () => {
    for (const id of NEW_TOOLS) {
      expect(TOOL_IDS as readonly string[]).toContain(id);
      expect(TOOLS_EXTRA[id], id).toBeDefined();
      expect(TOOLS[id]).toBe(TOOLS_EXTRA[id]);
    }
    for (const id of NEW_FEATS) {
      expect(FEAT_IDS as readonly string[]).toContain(id);
      expect(FEATS_EXTRA[id], id).toBeDefined();
      expect(FEATS[id]).toBe(FEATS_EXTRA[id]);
    }
    expect(Object.keys(TOOLS_EXTRA).sort()).toEqual([...NEW_TOOLS].sort());
    expect(Object.keys(FEATS_EXTRA).sort()).toEqual([...NEW_FEATS].sort());
  });
  it('a look naming them names nothing the painter lacks', () => {
    for (const id of NEW_TOOLS) expect(unknownParts(look({ tool: id }))).toEqual([]);
    expect(unknownParts(look({ feats: NEW_FEATS }))).toEqual([]);
  });
  it('every held thing has a kind that makes the figure hold it', () => {
    for (const id of NEW_TOOLS) expect(TOOLS_EXTRA[id].kind, id).not.toBe('none');
  });
});

describe('the extra parts: they change the picture', () => {
  for (const id of NEW_TOOLS)
    it(`tool ${id}`, () => {
      expect(same(paintPerson(look({ tool: id }), 'idle', 0).data, paintPerson(look({}), 'idle', 0).data), `${id} draws nothing`).toBe(false);
    });
  for (const id of NEW_FEATS)
    it(`feat ${id}`, () => {
      expect(same(paintPerson(look({ feats: [id] }), 'idle', 0).data, paintPerson(look({}), 'idle', 0).data), `${id} draws nothing`).toBe(false);
    });
  it('a gun fires: the attack frames after the shot differ from the aim', () => {
    for (const id of ['pistol', 'musket', 'rifle']) {
      const a = paintPerson(look({ tool: id }), 'attack', 0), b = paintPerson(look({ tool: id }), 'attack', 1);
      expect(same(a.data, b.data), id).toBe(false);
    }
  });
});

describe('the extra parts: every pose, stage and sex', () => {
  const kinds: [string, Partial<PersonLook>][] = [
    ...NEW_TOOLS.map((id): [string, Partial<PersonLook>] => [id, { tool: id }]),
    ...NEW_FEATS.map((id): [string, Partial<PersonLook>] => [id, { feats: [id] }]),
  ];
  for (const [id, over] of kinds)
    it(id, () => {
      for (const stage of STAGES)
        for (const fem of [false, true])
          for (const pose of POSES)
            for (let f = 0; f < pose.n; f++) {
              const frame = paintPerson(look({ ...over, stage, fem, wear: (f + 1) / 4 }), pose.id, f);
              let n = 0;
              for (let i = 3; i < frame.data.length; i += 4) if (frame.data[i]) n++;
              expect(n, `${id} ${stage} ${pose.id}`).toBeGreaterThan(20);
            }
    });
});

describe('the ghost, the glasses and the cyclops', () => {
  it('a ghost stands on no feet and is see-through', () => {
    const solid = (f: { w: number; data: Uint8ClampedArray }, y: number) => {
      let n = 0;
      for (let x = 0; x < f.w; x++) if (alphaAt(f, x, y) > 200) n++;
      return n;
    };
    const man = paintPerson(look({}), 'idle', 0), ghost = paintPerson(look({ feats: ['ghost'] }), 'idle', 0);
    // the man stands on two shoes; the ghost's tail ends in a point (its outline ring is all that reaches the row above the ground line)
    expect(solid(man, FRAME.foot - 1)).toBeGreaterThanOrEqual(6);
    expect(solid(ghost, FRAME.foot - 1)).toBeLessThanOrEqual(3);
    expect(solid(ghost, FRAME.foot - 3)).toBeLessThan(solid(man, FRAME.foot - 3));
    let veil = 0;
    for (let i = 3; i < ghost.data.length; i += 4) if (ghost.data[i] > 100 && ghost.data[i] < 230) veil++;
    expect(veil).toBeGreaterThan(30);
  });
  it('glasses leave the hat as it was', () => {
    for (const hat of ['cap', 'wizard', 'helmet']) {
      const a = paintPerson(look({ hat }), 'idle', 0), b = paintPerson(look({ hat, feats: ['glasses'] }), 'idle', 0);
      // the rows above the eyes hold the hat only
      const crown = (f: { w: number; data: Uint8ClampedArray }) => Array.from(f.data.slice(0, f.w * 4 * 20)).join();
      expect(crown(a)).toBe(crown(b));
      expect(same(a.data, b.data)).toBe(false);
    }
  });
  it('a cyclops changes the face', () => {
    expect(same(paintPerson(look({}), 'idle', 0).data, paintPerson(look({ feats: ['cyclops'] }), 'idle', 0).data)).toBe(false);
  });
});
