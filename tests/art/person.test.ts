// The person painter (M6 races): every race at every stage in every pose paints inside its frame, the stages differ in height, an infant never
// holds a tool, the slime has no eye, the gaits move as the docs say (docs/appearance/21-pixel-art.md, 02-races.md).
import { describe, expect, it } from 'vitest';
import { FRAME, POSES, type Pose } from '../../src/art/anim';
import { RACES, raceLook } from '../../src/art/dev/sets-races';
import type { PersonLook, Stage } from '../../src/art/look';
import { Paint, tones, type Frame } from '../../src/art/paint';
import { keys, paintPerson, unknownParts } from '../../src/art/person';

const STAGES: Stage[] = ['infant', 'child', 'teen', 'adult', 'elder'];
const row = (id: string) => RACES.find((r) => r.id === id)!;
const same = (a: Frame, b: Frame) => a.data.every((v, i) => v === b.data[i]);
/** Rows of the figure (solid pixels: the ground shadow is see-through) from the top to the bottom. */
function span(f: Frame): { top: number; bottom: number; left: number; right: number } {
  let top = 99, bottom = -1, left = 99, right = -1;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.data[(y * f.w + x) * 4 + 3] > 100) { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  return { top, bottom, left, right };
}

describe('every race, stage and pose', () => {
  it('names only parts that exist', () => {
    for (const r of RACES) for (const fem of [false, true]) expect(unknownParts(raceLook(r, { fem })), r.id).toEqual([]);
  });

  it('paints every frame inside the frame, feet on the ground line or above it', () => {
    const bad: string[] = [];
    for (const r of RACES)
      for (const stage of STAGES)
        for (const fem of [false, true])
          for (const tool of ['', 'spear', 'staff'])
            for (const p of POSES)
              for (let i = 0; i < p.n; i++) {
                const f = paintPerson(raceLook(r, { stage, fem, tool }), p.id, i);
                const s = span(f);
                if (s.bottom < 0) bad.push(`${r.id} ${stage} ${p.id}${i}: empty`);
                // (only a giant, bigger than 1.25x, with a spear or a staff reaches the frame's top or right edge: the frame is 56 wide, 24 columns behind the body and 31 in front)
                else if (s.left <= 0 || ((s.top <= 0 || s.right >= FRAME.w - 1) && !(tool && r.scale > 1.25)) || s.bottom > FRAME.foot) bad.push(`${r.id} ${stage}${fem ? '-f' : ''} ${tool || 'bare'} ${p.id}${i}: ${JSON.stringify(s)}`);
              }
    expect(bad.slice(0, 20)).toEqual([]);
  });
});

describe('life stages', () => {
  it('grow from the infant to the adult and the elder stoops', () => {
    for (const r of RACES) {
      const h = Object.fromEntries(STAGES.map((st) => { const s = span(paintPerson(raceLook(r, { stage: st }), 'idle', 0)); return [st, s.bottom - s.top]; }));
      expect(h.infant, r.id).toBeLessThan(h.child);
      expect(h.child, r.id).toBeLessThan(h.teen);
      expect(h.teen, r.id).toBeLessThanOrEqual(h.adult);
      expect(h.elder, r.id).toBeLessThanOrEqual(h.adult);
    }
  });

  it('draws no tool for an infant in any pose', () => {
    for (const r of RACES)
      for (const tool of ['spear', 'sword', 'axe', 'staff'])
        for (const p of POSES)
          for (let i = 0; i < p.n; i++)
            expect(same(paintPerson(raceLook(r, { stage: 'infant', tool }), p.id, i), paintPerson(raceLook(r, { stage: 'infant', tool: '' }), p.id, i)), `${r.id} ${tool} ${p.id}${i}`).toBe(true);
  });

  it('shows a child, a teen, an adult and an elder as four different pictures', () => {
    for (const r of RACES) {
      const fs = (['child', 'teen', 'adult', 'elder'] as Stage[]).map((st) => paintPerson(raceLook(r, { stage: st }), 'idle', 0));
      for (let a = 0; a < fs.length; a++) for (let b = a + 1; b < fs.length; b++) expect(same(fs[a], fs[b]), `${r.id} ${a} ${b}`).toBe(false);
    }
  });
});

describe('the slime', () => {
  it('has no eye: not one pixel of the eye colour, at any stage or pose', () => {
    const slime = row('slime');
    const eye = '#ff00ff';
    for (const stage of STAGES)
      for (const p of POSES)
        for (let i = 0; i < p.n; i++) {
          const f = paintPerson({ ...raceLook(slime, { stage }), eye }, p.id as Pose, i);
          for (let k = 0; k < f.data.length; k += 4) expect(f.data[k] === 255 && f.data[k + 1] === 0 && f.data[k + 2] === 255 && f.data[k + 3] > 0, `${stage} ${p.id}${i}`).toBe(false);
        }
  });

  it('is gel: see-through pixels in the body and a flat nucleus in the accent colour', () => {
    const f = paintPerson(raceLook(row('slime')), 'idle', 0);
    let seeThrough = 0, nucleus = 0;
    for (let k = 0; k < f.data.length; k += 4) {
      if (f.data[k + 3] > 100 && f.data[k + 3] < 240) seeThrough++;
      if (f.data[k] === 255 && f.data[k + 1] === 255 && f.data[k + 2] === 255 && f.data[k + 3] === 255) nucleus++;
    }
    expect(seeThrough).toBeGreaterThan(40);
    expect(nucleus).toBeGreaterThan(2);
  });
});

describe('lower bodies', () => {
  const body = (id: string, over: Partial<PersonLook> = {}) => ({ ...raceLook(row(id)), ...over });
  const cells = (f: Frame, x0: number, x1: number, y0: number, y1: number) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (f.data[(y * f.w + x) * 4 + 3] > 100) n++; return n; };

  it('a naga stands on a coil of tail wider than its body', () => {
    const f = paintPerson(body('naga', { feats: [] }), 'idle', 0), s = span(f);
    const waist = cells(f, 0, 48, 28, 29), floor = cells(f, 0, 48, 41, 42);
    expect(floor).toBeGreaterThan(waist);
    expect(s.bottom).toBeLessThanOrEqual(FRAME.foot);
    // not two legs: the row of the knees is one piece
    const on = (x: number) => f.data[(36 * f.w + x) * 4 + 3] > 100;
    let a = s.left, b = s.right;
    while (a < b && !on(a)) a++;
    while (b > a && !on(b)) b--;
    let gaps = 0;
    for (let x = a; x <= b; x++) if (!on(x)) gaps++;
    expect(gaps).toBe(0);
  });

  it('a merfolk trails a hem that is wider at the ground than at the hip', () => {
    const f = paintPerson(body('merfolk'), 'idle', 0);
    expect(cells(f, 0, 48, 42, 43)).toBeGreaterThan(cells(f, 0, 48, 31, 32));
  });
});

describe('gaits', () => {
  const tops = (id: string, tool = '') => [0, 1, 2, 3].map((i) => { const s = span(paintPerson(raceLook(row(id), { tool }), 'walk', i)); return s; });
  const range = (v: number[]) => Math.max(...v) - Math.min(...v);

  it('glide has no bob, hop has a big one, heavy a small one', () => {
    const glide = tops('elf').map((s) => s.bottom), hop = tops('halfling').map((s) => s.bottom);
    expect(range(tops('elf').map((s) => s.top))).toBeLessThanOrEqual(1); // the leafcrest and the ear move a pixel at most
    expect(range(hop)).toBeGreaterThanOrEqual(2);
    expect(range(tops('halfling').map((s) => s.top))).toBeGreaterThanOrEqual(3);
    expect(range(tops('orc').map((s) => s.top))).toBeLessThanOrEqual(1);
    void glide;
  });

  it('float hovers: the feet are off the ground line in every frame', () => {
    for (const s of tops('fae')) expect(s.bottom).toBeLessThanOrEqual(FRAME.foot - 2);
  });

  it('heavy stands wider than normal', () => {
    const human = raceLook(row('human'));
    const width = (gait: 'normal' | 'heavy') => cellsWide(paintPerson({ ...human, body: { ...human.body, gait } }, 'idle', 0), FRAME.foot - 3);
    expect(width('heavy')).toBeGreaterThan(width('normal'));
  });

  it('shuffle steps are shorter than normal steps', () => {
    const human = raceLook(row('human'));
    const reach = (gait: 'normal' | 'shuffle') => { const fs = [0, 2].map((i) => cellsWide(paintPerson({ ...human, body: { ...human.body, gait } }, 'walk', i), FRAME.foot - 2)); return Math.max(...fs); };
    expect(reach('shuffle')).toBeLessThan(reach('normal'));
  });
});

/** The width of the solid pixels on one row. */
function cellsWide(f: Frame, y: number): number {
  let l = 99, r = -1;
  for (let x = 0; x < f.w; x++) if (f.data[(y * f.w + x) * 4 + 3] > 100) { l = Math.min(l, x); r = Math.max(r, x); }
  return r < 0 ? 0 : r - l + 1;
}

describe('carried things and the bow', () => {
  const DEG = Math.PI / 180;
  it('a carried thing is held out in front, upright, with no swing in walk, attack or work', () => {
    for (const pose of ['idle', 'walk', 'attack', 'work'] as const)
      for (const k of keys(pose, 'carry', 'normal')) {
        expect(k.ang ?? -90 * DEG, pose).toBeCloseTo(-90 * DEG, 5);
        expect(k.hand[0], pose).toBeGreaterThanOrEqual(4); // forward of the shoulder
        expect(k.hand[1], pose).toBeLessThanOrEqual(4);
        expect(k.hand[1], pose).toBeGreaterThanOrEqual(1);
      }
    const walk = keys('walk', 'carry', 'normal').map((k) => k.hand[0]);
    expect(Math.max(...walk) - Math.min(...walk)).toBeLessThan(0.7);
    const atk = keys('attack', 'carry', 'normal').map((k) => k.hand[0]);
    expect(Math.max(...atk) - Math.min(...atk)).toBeLessThanOrEqual(4); // a small push
    expect(atk[1]).toBeGreaterThan(atk[0]);
  });

  it('the bow: arm out, drawn on frames 0 and 1, loosed on frame 2', () => {
    const ks = keys('attack', 'shoot', 'normal');
    expect(ks).toHaveLength(3);
    expect(ks.every((k) => k.hand[0] >= 5 && k.hand[1] <= 0)).toBe(true);
    expect(ks[1].far[0]).toBeGreaterThan(ks[0].far[0]);
    expect(ks[2].far[0]).toBeLessThan(ks[1].far[0] - 3);
    // the arrow is nocked on the draw frames and gone after the shot
    const L = { ...raceLook(row('human')), tool: 'bow' }, bareL = { ...L, tool: '' };
    const right = (i: number) => span(paintPerson(L, 'attack', i)).right;
    expect(right(0)).toBeGreaterThan(right(2) + 3);
    expect(right(1)).toBeGreaterThan(right(2) + 3);
    void bareL;
  });

  it('every carry tool and the bow paint on every pose without leaving the frame', () => {
    for (const tool of ['book', 'ledger', 'scroll', 'mug', 'bowl', 'flask', 'lantern', 'censer', 'bow'])
      for (const p of POSES)
        for (let i = 0; i < p.n; i++) {
          const s = span(paintPerson({ ...raceLook(row('human')), tool }, p.id, i));
          expect(s.left, `${tool} ${p.id}${i}`).toBeGreaterThan(0);
          expect(s.right, `${tool} ${p.id}${i}`).toBeLessThan(FRAME.w - 1);
        }
  });
});

describe('the painter: warm shadows and glow pixels', () => {
  const sat = ([r, g, b]: number[]) => { const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); };
  const hue = ([r, g, b]: number[]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return h * 60; };

  it('the shadow of skin and orange is less saturated than the base, and not turned to a raw red-orange', () => {
    for (const hex of ['#e8b48a', '#d08a62', '#c98f5a', '#f6e0c8', '#ff6a1a']) {
      const t = tones(hex), base = sat(t[2]), shadow = sat(t[1]);
      expect(shadow, hex).toBeLessThan(base * 0.8);
      expect(hue(t[1]) <= hue(t[2]) + 0.01 || hue(t[1]) >= 340, hex).toBe(true);
    }
  });

  it('the shadow of a cool hue still leans blue and keeps its colour', () => {
    const t = tones('#4a8a5a');
    expect(sat(t[1])).toBeGreaterThan(sat(t[2]) * 0.95);
    expect(hue(t[1])).toBeGreaterThan(hue(t[2]));
  });

  it('a glow pixel has no outline and does not need a body under it', () => {
    const p = new Paint(20, 20);
    p.glow(10, 8, '#ffcc40');
    p.glow(5, 5, '#ffffff', 0.5);
    const f = p.finish({ cx: 10, cy: 18, rx: 3, ry: 1 });
    const a = (x: number, y: number) => f.data[(y * f.w + x) * 4 + 3];
    expect(a(10, 8)).toBe(255);
    expect([f.data[(8 * f.w + 10) * 4], f.data[(8 * f.w + 10) * 4 + 1]]).toEqual([255, 204]);
    for (const [x, y] of [[9, 8], [11, 8], [10, 7], [10, 9]]) expect(a(x, y), `ring ${x},${y}`).toBe(0);
    expect(a(5, 5)).toBe(128);
  });
});
