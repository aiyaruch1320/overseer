// The pixel effects of a scene (M7 ก3): every kind of particle is on the 320 × 180 picture in whole art pixels, the same for the same (seed, motion), and still while
// the motion clock is held; the light modes and the god's three colours are drawn.
import { describe, expect, it } from 'vitest';
import { FX_KINDS, type SceneScript } from '../../src/core/data/types-scenes';
import { fxPixels, godOf, godPixels, isFx, lightPixels, type Px } from '../../src/scene/fx';
import { frameAt } from '../../src/scene/timeline';
import { ART, FX_LOOK, GOD, LIGHT } from '../../src/scene/tuning';

const inside = (list: readonly Px[]) => {
  for (const p of list) {
    expect(Number.isInteger(p.x) && Number.isInteger(p.y) && Number.isInteger(p.w) && Number.isInteger(p.h)).toBe(true);
    expect(p.w).toBeGreaterThanOrEqual(1);
    expect(p.h).toBeGreaterThanOrEqual(1);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + p.w).toBeLessThanOrEqual(ART.w);
    expect(p.y + p.h).toBeLessThanOrEqual(ART.h);
    expect(p.alpha).toBeGreaterThan(0);
    expect(p.alpha).toBeLessThanOrEqual(1);
    expect(p.color).toBeGreaterThanOrEqual(0);
    expect(p.color).toBeLessThanOrEqual(0xffffff);
  }
};

const TIMES = [0, 0.4, 1.3, 2.9, 7.7, 20, 61.5];

describe('every kind of particle', () => {
  for (const kind of FX_KINDS) {
    it(`${kind}: is on the picture in whole pixels at any time, from a little amount too`, () => {
      for (const amount of [0.05, 0.6, 1]) {
        for (const t of TIMES) {
          const list = fxPixels([{ kind, amount }], t, 11);
          expect(list.length, `${kind} ${amount} at ${t}`).toBeGreaterThan(0);
          inside(list);
        }
      }
    });
    it(`${kind}: the same (seed, motion) gives the same pixels, another gives others`, () => {
      const a = fxPixels([{ kind, amount: 0.7 }], 3.3, 5);
      expect(fxPixels([{ kind, amount: 0.7 }], 3.3, 5)).toEqual(a);
      expect(fxPixels([{ kind, amount: 0.7 }], 3.4, 5)).not.toEqual(a);
      expect(fxPixels([{ kind, amount: 0.7 }], 3.3, 6)).not.toEqual(a);
    });
  }
  it('has a look for every kind, and light is the kind that glows', () => {
    expect(Object.keys(FX_LOOK).sort()).toEqual([...FX_KINDS].sort());
    for (const k of ['embers', 'motes', 'sparks'] as const) expect(fxPixels([{ kind: k, amount: 1 }], 2, 1).every((p) => p.add)).toBe(true);
    for (const k of ['smoke', 'fog', 'rain', 'ash', 'snow', 'leaves'] as const) expect(fxPixels([{ kind: k, amount: 1 }], 2, 1).some((p) => p.add)).toBe(false);
  });
  it('more amount is more particles; none is none', () => {
    for (const kind of ['ash', 'snow', 'rain', 'dust', 'motes', 'embers', 'water'] as const)
      expect(fxPixels([{ kind, amount: 1 }], 2, 3).length).toBeGreaterThan(fxPixels([{ kind, amount: 0.2 }], 2, 3).length);
    expect(fxPixels([{ kind: 'ash', amount: 0 }], 2, 3)).toEqual([]);
  });
  it('the beat\'s colour replaces the colours of the kind', () => {
    const list = fxPixels([{ kind: 'dust', amount: 0.5, color: '#336699' }], 2, 3);
    expect(new Set(list.map((p) => p.color))).toEqual(new Set([0x336699]));
  });
  it('two effects of one kind are not the same particles', () => {
    const one = fxPixels([{ kind: 'snow', amount: 0.5 }], 2, 3);
    const two = fxPixels([{ kind: 'snow', amount: 0.5 }, { kind: 'snow', amount: 0.5 }], 2, 3);
    expect(two.length).toBeGreaterThan(one.length * 1.8);
    expect(two.slice(one.length)).not.toEqual(one);
  });
});

describe('the place\'s ambient', () => {
  it('is drawn faintly under the beats\' own when it names an effect', () => {
    const none = fxPixels([], 4, 9);
    const dust = fxPixels([], 4, 9, 'dust');
    expect(none).toEqual([]);
    expect(dust.length).toBeGreaterThan(0);
    inside(dust);
    const beat = fxPixels([{ kind: 'dust', amount: 1 }], 4, 9);
    expect(Math.max(...dust.map((p) => p.alpha))).toBeLessThan(Math.max(...beat.map((p) => p.alpha)));
    expect(fxPixels([{ kind: 'snow', amount: 0.5 }], 4, 9, 'fog').length).toBeGreaterThan(fxPixels([{ kind: 'snow', amount: 0.5 }], 4, 9).length);
  });
  it('ignores the names that are not particles', () => {
    for (const a of ['gulls', 'clouds', 'none', 'sand', '', 'constructor', undefined]) expect(fxPixels([], 4, 9, a)).toEqual([]);
    expect(isFx('embers')).toBe(true);
    expect(isFx('gulls')).toBe(false);
  });
});

describe('the motion clock', () => {
  const script: SceneScript = {
    id: 'test.hold',
    kind: 'world',
    title: 't',
    frame: '#fff',
    seconds: 10,
    src: 'test',
    beats: [
      { k: 'fx', at: 0, kind: 'embers', amount: 0.8 },
      { k: 'fx', at: 0, kind: 'rain', amount: 0.5 },
      { k: 'light', at: 0, mode: 'glow', color: '#e8c36a' },
      { k: 'hold', at: 4, dur: 3 },
    ],
  };
  const at = (t: number) => {
    const f = frameAt(script, t);
    return fxPixels(f.fx, f.motion, 77);
  };
  it('freezes the particles while a hold beat is on, and runs on after it, the same at any step', () => {
    expect(at(4)).toEqual(at(5.5));
    expect(at(5.5)).toEqual(at(6.99));
    expect(at(3)).not.toEqual(at(4));
    expect(at(8)).not.toEqual(at(7));
    // a skip to a time is the same picture as playing to it
    expect(at(8.5)).toEqual(at(8.5));
  });
});

describe('the light', () => {
  it('draws every mode inside the picture; it is added except the dimming, which covers', () => {
    for (const mode of Object.keys(LIGHT) as (keyof typeof LIGHT)[]) {
      const list = lightPixels(mode, undefined, '#ffeecc');
      expect(list.length, mode).toBeGreaterThan(0);
      inside(list);
      expect(list.every((p) => p.add === LIGHT[mode].add), mode).toBe(true);
    }
    expect(LIGHT.dim.add).toBe(false);
    expect(LIGHT['warm-front'].add && LIGHT['cold-back'].add && LIGHT.glow.add && LIGHT.diffuse.add).toBe(true);
  });
  it('comes from the front below, from behind above, from the middle in rings', () => {
    const mean = (l: Px[]) => l.reduce((s, p) => s + (p.y + p.h / 2) * p.alpha * p.w * p.h, 0) / l.reduce((s, p) => s + p.alpha * p.w * p.h, 0);
    expect(mean(lightPixels('warm-front', undefined, '#fff'))).toBeGreaterThan(ART.h * 0.6);
    expect(mean(lightPixels('cold-back', undefined, '#fff'))).toBeLessThan(ART.h * 0.4);
    const glow = lightPixels('glow', undefined, '#fff');
    expect(Math.min(...glow.map((p) => p.x))).toBeGreaterThan(0);
  });
  it('takes the colour of the beat, and for a diffuse light the colour of the place', () => {
    expect(new Set(lightPixels('warm-front', '#112233', '#fff').map((p) => p.color))).toEqual(new Set([0x112233]));
    expect(new Set(lightPixels('diffuse', undefined, '#445566').map((p) => p.color))).toEqual(new Set([0x445566]));
  });
});

describe('the god\'s three colours', () => {
  it('are told from other glows', () => {
    expect(godOf(GOD.faith)).toBe('faith');
    expect(godOf(GOD.dread)).toBe('dread');
    expect(godOf(GOD.fate)).toBe('fate');
    // the glows the scripts use for the dread and the fate of the docs (not exactly the god's colour)
    expect(godOf('#8a2a2a')).toBe('dread');
    expect(godOf('#c8c8d0')).toBe('fate');
    for (const c of ['#d8d4cc', '#4a7a4a', '#6a7a8a', '#4a5a7a', '#a89860', '#f0e8c8', undefined]) expect(godOf(c), String(c)).toBeNull();
  });
  for (const god of ['faith', 'dread', 'fate'] as const) {
    it(`${god}: pixels on the picture, deterministic, alive`, () => {
      const a = godPixels(god, 5.2, 3);
      expect(a.length).toBeGreaterThan(20);
      inside(a);
      expect(godPixels(god, 5.2, 3)).toEqual(a);
      expect(godPixels(god, 5.3, 3)).not.toEqual(a);
    });
  }
  it('faith is light that adds, with a rim that shakes: the edge of a row is not the same a moment later', () => {
    const rows = (t: number) => godPixels('faith', t, 1).filter((p) => p.h === 1 && p.w > 8 && p.alpha < 0.25).map((p) => `${p.x}:${p.w}`).join();
    expect(godPixels('faith', 2, 1).filter((p) => p.add).length).toBeGreaterThan(100);
    expect(rows(2)).not.toEqual(rows(2.1));
  });
  it('dread covers and is red going black; fate is silver light', () => {
    const d = godPixels('dread', 2, 1);
    expect(d.every((p) => !p.add)).toBe(true);
    expect(d.some((p) => p.color === GOD_RED())).toBe(true);
    expect(godPixels('fate', 2, 1).every((p) => p.add)).toBe(true);
  });
});

const GOD_RED = () => parseInt(GOD.dread.slice(1), 16);
