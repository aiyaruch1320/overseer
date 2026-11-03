// The part tables draw every id the Looks may name (src/art/parts/ids.ts): an entry for each, a visible change against the bare figure, and no
// throw for any pose, frame, life stage or body.
import { describe, expect, it } from 'vitest';
import { POSES, type Pose } from '../../src/art/anim';
import { HUMAN_BODY, type PersonLook, type Stage } from '../../src/art/look';
import { paintPerson, unknownParts } from '../../src/art/person';
import { BEARDS, HAIR, HATS, OUTFITS, TOOLS } from '../../src/art/parts';
import { BEARD_IDS, HAIR_IDS, HAT_IDS, OUTFIT_IDS, TOOL_IDS } from '../../src/art/parts/ids';

const STAGES: Stage[] = ['infant', 'child', 'teen', 'adult', 'elder'];
const bare: PersonLook = {
  kind: 'person', key: 'test', race: 'human', stage: 'adult', fem: false, body: HUMAN_BODY, skin: '#e8b48a', hairColor: '#3a2a20', eye: '#1e1a22',
  accent: '#d9a030', main: '#5a6a4a', second: '#6a4a32', outfit: '', hair: '', hat: '', beard: '', tool: '', feats: [], wear: 0.3,
};
const look = (over: Partial<PersonLook>): PersonLook => ({ ...bare, ...over });
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.length === b.length && a.every((v, i) => v === b[i]);

const kinds = [
  ['outfit', OUTFIT_IDS, OUTFITS],
  ['hair', HAIR_IDS, HAIR],
  ['beard', BEARD_IDS, BEARDS],
  ['hat', HAT_IDS, HATS],
  ['tool', TOOL_IDS, TOOLS],
] as const;

describe('the part tables', () => {
  for (const [kind, ids, table] of kinds) {
    it(`${kind}: every id has an entry, and no id outside the list`, () => {
      expect(ids.filter((id) => !table[id])).toEqual([]);
      expect(Object.keys(table).filter((id) => !(ids as readonly string[]).includes(id))).toEqual([]);
    });
  }

  it('no look of the list names a part that is missing', () => {
    for (const [kind, ids] of kinds) for (const id of ids) expect(unknownParts(look({ [kind]: id }))).toEqual([]);
  });

  describe('each part changes the picture against the bare figure', () => {
    // a pose where the part shows: the tools only show where the figure holds them
    const base = (kind: string, over: Partial<PersonLook>) => paintPerson(look(kind === 'beard' ? { hair: 'short', ...over } : over), 'idle', 0);
    for (const [kind, ids] of kinds)
      for (const id of ids)
        it(`${kind} ${id}`, () => {
          const bareFrame = paintPerson(look(kind === 'beard' ? { hair: 'short' } : {}), 'idle', 0);
          const withPart = base(kind, { [kind]: id });
          expect(same(withPart.data, bareFrame.data), `${kind} ${id} draws nothing`).toBe(false);
        });
  });

  describe('every part paints every pose and life stage without throwing and leaves pixels', () => {
    for (const [kind, ids] of kinds)
      for (const id of ids)
        it(`${kind} ${id}`, () => {
          for (const stage of STAGES)
            for (const fem of [false, true])
              for (const pose of POSES) for (let f = 0; f < pose.n; f++) {
                const frame = paintPerson(look({ [kind]: id, stage, fem, hair: kind === 'hair' ? id : 'short', wear: (f + 1) / 4 }), pose.id as Pose, f);
                let n = 0;
                for (let i = 3; i < frame.data.length; i += 4) if (frame.data[i]) n++;
                expect(n, `${kind} ${id} ${stage} ${pose.id}`).toBeGreaterThan(20);
              }
        });
  });

  it('a hat that covers the head leaves hair that stands up out of it', () => {
    // the bun is drawn standing above the head; under a helmet it must not poke out above the helmet's dome
    const top = (hat: string) => {
      const frame = paintPerson(look({ hair: 'topknot', hat }), 'idle', 0);
      for (let y = 0; y < frame.h; y++) for (let x = 0; x < frame.w; x++) if (frame.data[(y * frame.w + x) * 4 + 3]) return y;
      return frame.h;
    };
    expect(top('helmet')).toBeGreaterThan(top(''));
  });

  it('wear shows: a worn outfit differs from a new one', () => {
    for (const id of ['tunic', 'rags', 'apron', 'cloak', 'knight'])
      expect(same(paintPerson(look({ outfit: id, wear: 0.9 }), 'idle', 0).data, paintPerson(look({ outfit: id, wear: 0 }), 'idle', 0).data), id).toBe(false);
  });

  it('the same look paints the same pixels', () => {
    const a = paintPerson(look({ outfit: 'rags', hair: 'wild', hat: 'furhat', tool: 'orbstaff', wear: 0.8 }), 'cast', 1);
    const b = paintPerson(look({ outfit: 'rags', hair: 'wild', hat: 'furhat', tool: 'orbstaff', wear: 0.8 }), 'cast', 1);
    expect(same(a.data, b.data)).toBe(true);
  });
});
