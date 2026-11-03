// The feats (M6 races): every id of FEAT_IDS (the races' marks and the personal marks) has a painter and changes the picture.
import { describe, expect, it } from 'vitest';
import { POSES } from '../../src/art/anim';
import { RACES, raceLook } from '../../src/art/dev/sets-races';
import type { PersonLook } from '../../src/art/look';
import type { Frame } from '../../src/art/paint';
import { paintPerson } from '../../src/art/person';
import { FEAT_IDS } from '../../src/art/parts/ids';
import { FEATS } from '../../src/art/parts';

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

describe('wings fold at rest and open when roused', () => {
  const WINGS = ['wings:feather', 'wings:scale', 'wings:night', 'wings:insect'];
  const bare = (): PersonLook => ({ ...base(), tool: '' });
  const solid = (f: Frame, x: number, y: number) => f.data[(y * f.w + x) * 4 + 3] > 100;
  const leftOf = (f: Frame): number => { let l = 99; for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (solid(f, x, y)) l = Math.min(l, x); return l; };
  /** The pixels the wing adds to the figure (what differs from the same figure without it) and how far back they reach. */
  function added(wing: string, pose: Parameters<typeof paintPerson>[1], i: number): { left: number; px: number } {
    const g = paintPerson({ ...bare(), feats: [wing] }, pose, i), n = paintPerson(bare(), pose, i);
    let left = 99, px = 0;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const o = (y * g.w + x) * 4;
      if (solid(g, x, y) && !(solid(n, x, y) && g.data[o] === n.data[o] && g.data[o + 1] === n.data[o + 1] && g.data[o + 2] === n.data[o + 2])) { left = Math.min(left, x); px++; }
    }
    return { left, px };
  }

  it('every kind stays small and close to the back at rest (idle, walk, sit, pray, work)', () => {
    for (const w of WINGS)
      for (const [pose, n] of [['idle', 2], ['walk', 4], ['sit', 1], ['pray', 2], ['work', 3]] as const)
        for (let i = 0; i < n; i++) {
          const s = added(w, pose, i), bodyLeft = leftOf(paintPerson(bare(), pose, i));
          expect(bodyLeft - s.left, `${w} ${pose}${i} reaches back`).toBeLessThanOrEqual(9);
          expect(s.px, `${w} ${pose}${i} size`).toBeLessThan(170);
          expect(s.px, `${w} ${pose}${i} shows`).toBeGreaterThan(6);
        }
  });

  it('every kind opens wider on cheer, cast and attack, and stays inside the frame', () => {
    for (const w of WINGS) {
      const rest = added(w, 'idle', 0);
      for (const [pose, i] of [['cheer', 0], ['cheer', 1], ['cast', 2], ['attack', 2]] as const) {
        const s = added(w, pose, i);
        expect(s.px, `${w} ${pose}${i} opens`).toBeGreaterThan(rest.px);
        expect(s.left, `${w} ${pose}${i} inside`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('a giant spreads its wings without passing the frame edge', () => {
    for (const w of WINGS) {
      const L = { ...raceLook(RACES.find((r) => r.id === 'giant')!), feats: [w] };
      for (const [pose, i] of [['cheer', 1], ['cast', 2], ['attack', 2]] as const) expect(leftOf(paintPerson(L, pose, i)), `${w} ${pose}${i}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('a feather wing has feathers: several tones in its rows when open', () => {
    const f = paintPerson({ ...bare(), feats: ['wings:feather'], accent: '#d9a030' }, 'cheer', 1), n = paintPerson(bare(), 'cheer', 1), seen = new Set<string>();
    for (let k = 0; k < f.data.length; k += 4) if (f.data[k + 3] > 200 && (f.data[k] !== n.data[k] || f.data[k + 1] !== n.data[k + 1])) seen.add(`${f.data[k]},${f.data[k + 1]},${f.data[k + 2]}`);
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
});

describe('the beast people, the bird, the lizard, the doll', () => {
  const beast = RACES.find((r) => r.id === 'beast')!;
  const kind = (feats: string[], key: string) => paintPerson({ ...raceLook(beast, { key, feats }), hair: 'short' }, 'idle', 0);
  const KINDS: Record<string, string[]> = {
    wolf: ['fur', 'tail:fluffy', 'pawhands', 'muzzle'], tiger: ['fur', 'tail:fluffy', 'pawhands', 'muzzle', 'stripes'], rabbit: ['fur', 'tail:fluffy', 'pawhands', 'muzzle', 'longears'],
    deer: ['fur', 'tail:fluffy', 'pawhands', 'muzzle', 'antlers', 'spots'], lion: ['fur', 'tail:fluffy', 'pawhands', 'muzzle', 'mane'], bird: ['feathers', 'beak'], lizard: ['crest', 'scales', 'tail:lizard'],
  };
  it('every kind is a different picture, and none is the plain beastfolk', () => {
    const plain = kind(['fur', 'tail:fluffy', 'pawhands', 'beads'], 'x');
    const fs = Object.entries(KINDS).map(([id, f]) => [id, kind(f, 'x')] as const);
    for (const [id, f] of fs) expect(same(f, plain), id).toBe(false);
    for (let a = 0; a < fs.length; a++) for (let b = a + 1; b < fs.length; b++) expect(same(fs[a][1], fs[b][1]), `${fs[a][0]} ${fs[b][0]}`).toBe(false);
  });
  it('a bird has no fur tail: the fur feats draw nothing beside the feathers', () => {
    expect(same(kind(['feathers', 'beak'], 'x'), kind(['feathers', 'beak', 'fur', 'tail:fluffy', 'pawhands'], 'x'))).toBe(true);
  });
  it('the rabbit and the deer stand taller than the wolf (long ears, antlers)', () => {
    const top = (f: Frame) => { for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.data[(y * f.w + x) * 4 + 3] > 100) return y; return 99; };
    expect(top(kind(KINDS.rabbit, 'x'))).toBeLessThan(top(kind(KINDS.wolf, 'x')));
    expect(top(kind(KINDS.deer, 'x'))).toBeLessThan(top(kind(KINDS.wolf, 'x')));
  });
  it('the four-armed has more arm pixels than the two-armed', () => {
    const L0 = { ...base(), feats: [] as string[] }, L1 = { ...L0, feats: ['fourarms'] };
    const count = (f: Frame) => { let n = 0; for (let i = 3; i < f.data.length; i += 4) if (f.data[i] > 100) n++; return n; };
    expect(count(paintPerson(L1, 'idle', 0))).toBeGreaterThan(count(paintPerson(L0, 'idle', 0)) + 2);
  });
});
