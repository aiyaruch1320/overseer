import { describe, expect, it } from 'vitest';
import { detached, stream, streamStart } from '../../src/core/rng';

// the generator of scripts/sim/sim-world.mjs, copied here to prove the streams start in the same place
function simRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('seed streams', () => {
  it('world and world.le start where sim-world.mjs starts', () => {
    const st = {};
    const w = stream(st, 1234, 'world');
    const le = stream(st, 1234, 'world.le');
    const a = simRng(1234);
    const b = simRng(1234 ^ 0x9e3779b9);
    for (let i = 0; i < 5; i++) {
      expect(w.next()).toBe(a());
      expect(le.next()).toBe(b());
    }
  });
  it('streams are independent: drawing from one does not move another', () => {
    const s1 = {};
    const x = stream(s1, 7, 'life.story');
    stream(s1, 7, 'god.chest').next();
    const s2 = {};
    const y = stream(s2, 7, 'life.story');
    expect(x.next()).toBe(y.next());
  });
  it('resumes from the saved position', () => {
    const st: Record<string, number> = {};
    const r = stream(st, 99, 'life');
    r.next();
    r.next();
    const copy = JSON.parse(JSON.stringify(st));
    expect(stream(copy, 99, 'life').next()).toBe(r.next());
  });
  it('different names start differently', () => {
    expect(streamStart(5, 'life')).not.toBe(streamStart(5, 'names'));
  });
  it('weighted never picks a zero weight', () => {
    const r = detached(3);
    for (let i = 0; i < 2000; i++) expect(r.weighted([0, 5, 0, 1])).not.toBe(0);
    expect(r.weighted([0, 0])).toBe(-1);
  });
});
