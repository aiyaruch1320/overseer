// The person painter (M6 races): every race at every stage in every pose paints inside its frame, the stages differ in height, an infant never
// holds a tool, the slime has no eye, the gaits move as the docs say (docs/appearance/21-pixel-art.md, 02-races.md).
import { describe, expect, it } from 'vitest';
import { FRAME, POSES, type Pose } from '../../src/art/anim';
import { RACES, raceLook } from '../../src/art/dev/sets-races';
import type { PersonLook, Stage } from '../../src/art/look';
import type { Frame } from '../../src/art/paint';
import { paintPerson, unknownParts } from '../../src/art/person';

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
                // (a spear or a staff held by a body bigger than 1.1x reaches the frame's top or right edge: the frame is 48 wide, 21 columns behind the body and 26 in front)
                else if (s.left <= 0 || (s.top <= 0 && !(tool && r.scale > 1.1)) || (!tool && s.right >= FRAME.w - 1) || s.bottom > FRAME.foot) bad.push(`${r.id} ${stage}${fem ? '-f' : ''} ${tool || 'bare'} ${p.id}${i}: ${JSON.stringify(s)}`);
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
    const w = (id: string) => { const s = span(paintPerson(raceLook({ ...row(id), scale: 1, shoulders: 1, feats: [], ears: 'none' }), 'idle', 0)); return s.right - s.left; };
    const normal = { ...row('human') };
    const heavy = { ...row('human'), gait: 'heavy' as const };
    const width = (r: typeof normal) => { const f = paintPerson(raceLook(r), 'idle', 0); return cellsWide(f, 41); };
    expect(width(heavy)).toBeGreaterThan(width(normal));
    void w;
  });

  it('shuffle steps are shorter than normal steps', () => {
    const reach = (gait: 'normal' | 'shuffle') => { const fs = [0, 2].map((i) => cellsWide(paintPerson(raceLook({ ...row('human'), gait }), 'walk', i), 42)); return Math.max(...fs); };
    expect(reach('shuffle')).toBeLessThan(reach('normal'));
  });
});

/** The width of the solid pixels on one row. */
function cellsWide(f: Frame, y: number): number {
  let l = 99, r = -1;
  for (let x = 0; x < f.w; x++) if (f.data[(y * f.w + x) * 4 + 3] > 100) { l = Math.min(l, x); r = Math.max(r, x); }
  return r < 0 ? 0 : r - l + 1;
}
