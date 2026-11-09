// The elder who goes home (docs/systems/travel/01-travel-rules.md §2.1): lives that left the continent of their birth end in the country of it
// far more often than before (0 of 16 in the first measure), and the vow GV-03 can be kept.
import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData } from '../../src/core/game';
import { bornCountry, continentsSeen } from '../../src/core/god/goals/facts';
import { ELDER_HOME } from '../../src/core/travel/tuning';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, runToDeath, startLife } from '../../scripts/tools/session';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

describe('an elder goes home', () => {
  it('of the lives that left their birth continent, a good part die in the birth country', () => {
    let left = 0;
    let home = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const s = createSession(data, { seed });
      const life = startLife(s);
      runToDeath(s.game);
      if (continentsSeen(life).length < 2) continue;
      left++;
      if (life.country === bornCountry(life) && life.hAge >= ELDER_HOME.age) home++;
    }
    expect(left).toBeGreaterThan(8);
    expect(home / left).toBeGreaterThan(0.2);
  });
});
