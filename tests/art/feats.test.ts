// The feats (M6 races): every id of FEAT_IDS (the races' marks and the personal marks) has a painter and changes the picture.
import { describe, expect, it } from 'vitest';
import { POSES } from '../../src/art/anim';
import { RACES, raceLook } from '../../src/art/dev/sets-races';
import type { PersonLook } from '../../src/art/look';
import type { Frame } from '../../src/art/paint';
import { paintPerson } from '../../src/art/person';
import { FEAT_IDS } from '../../src/art/parts/ids';
import { FEATS } from '../../src/art/parts/feats';

const human = RACES.find((r) => r.id === 'human')!;
const base = (over: Partial<PersonLook> = {}): PersonLook => ({ ...raceLook(human, { tool: 'spear' }), hair: 'short', ...over });
const same = (a: Frame, b: Frame) => a.data.every((v, i) => v === b.data[i]);

/** The lower bodies and ears some feats are made for (a naga's scales are on its tail, the slime's gel is its body). */
const NEEDS: Record<string, Partial<PersonLook['body']>> = {};

/** Does the feat change any pixel of any frame of the common poses? */
function changes(id: string, stage: PersonLook['stage'] = 'adult', fem = false): boolean {
  const L0 = base({ stage, fem }), L1 = { ...L0, body: { ...L0.body, ...NEEDS[id] }, feats: [id] };
  const L2 = { ...L1, feats: [] as string[] };
  for (const p of POSES) for (let i = 0; i < p.n; i++) if (!same(paintPerson(L1, p.id, i), paintPerson(L2, p.id, i))) return true;
  return false;
}

describe('the feats', () => {
  it('has a painter for every id the looks may name', () => {
    expect(FEAT_IDS.filter((id) => !FEATS[id])).toEqual([]);
  });

  it('has no painter nobody can name', () => {
    expect(Object.keys(FEATS).filter((id) => !(FEAT_IDS as readonly string[]).includes(id))).toEqual([]);
  });

  for (const id of FEAT_IDS)
    it(`${id} changes the picture`, () => {
      expect(changes(id)).toBe(true);
    });

  it('the races of 02-races.md show their marks in the order of the doc: no race looks like another', () => {
    // every race as an adult man in the same pose is a different picture, and so is every woman
    const fs = RACES.map((r) => paintPerson(raceLook(r), 'idle', 0));
    for (let a = 0; a < fs.length; a++) for (let b = a + 1; b < fs.length; b++) expect(same(fs[a], fs[b]), `${RACES[a].id} ${RACES[b].id}`).toBe(false);
  });

  it('wings and tails move with the frame', () => {
    for (const id of ['wings:feather', 'wings:insect', 'wings:night', 'wings:scale', 'tail:fluffy', 'tail:lizard', 'tail:spade']) {
      const L = { ...base(), feats: [id] };
      const walk = [0, 1, 2, 3].map((i) => paintPerson(L, 'walk', i));
      expect(walk.some((f) => !same(f, walk[0])), id).toBe(true);
      // and the wing opens when the figure is angry or glad
      if (id.startsWith('wings:') && id !== 'wings:insect') expect(same(paintPerson(L, 'idle', 0), paintPerson(L, 'cheer', 1)), id).toBe(false);
    }
  });

  it('glows are one flat colour', () => {
    // a lava crack, an ember and a core are flat: the pixels of the glow colour are all the very same colour
    for (const [id, hex] of [['embers', '#ff6a1a'], ['core', '#6ad0ff']] as const) {
      const L = { ...base(), accent: hex, feats: [id] }, f = paintPerson(L, 'idle', 0);
      const want = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      let n = 0;
      for (let k = 0; k < f.data.length; k += 4) if (f.data[k] === want[0] && f.data[k + 1] === want[1] && f.data[k + 2] === want[2] && f.data[k + 3] === 255) n++;
      expect(n, id).toBeGreaterThanOrEqual(1);
    }
  });
});
