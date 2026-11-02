import { describe, expect, it } from 'vitest';
import { chooseStart } from '../../src/core/start';
import { worldSystem } from '../../src/core/world';
import { loadGen } from '../../scripts/tools/load-gen';

const data = loadGen(['world-events', 'local-events', 'countries', 'continents', 'origin', 'races']);

describe('start point (world-time.md §8.1)', () => {
  it('is the same for the same seed, and about a quarter of lives start in the first 60 years', () => {
    const ages = { adultAge: 20, elderAge: 55 };
    expect(chooseStart(data, 11, ages, worldSystem)).toEqual(chooseStart(data, 11, ages, worldSystem));
    const starts = Array.from({ length: 80 }, (_, i) => chooseStart(data, 100 + i, ages, worldSystem));
    const early = starts.filter((s) => s.rule === 'early').length / starts.length;
    expect(early).toBeGreaterThan(0.1);
    expect(early).toBeLessThan(0.45);
    for (const s of starts.filter((x) => x.rule === 'anchor')) {
      // born so the character comes of age before the anchor, within 30% of the adult span
      expect(s.anchorYear! - s.worldYear).toBeGreaterThanOrEqual(20 - 1);
      expect(s.anchorYear! - s.worldYear).toBeLessThanOrEqual(20 + 0.3 * 35 + 1);
    }
  }, 120000);
});
