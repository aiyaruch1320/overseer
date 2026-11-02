// Balance of the character system alone (docs/guide/code-plan.md §7 row "character", god/06-implementation.md §4):
// 20,000 lives with only the character system running, every life taking a common job at 20 (the offer the story would make),
// so the aptitudes of a job grow and the secret jobs have the best chance they can have without the story.
// Slow: run with `npx vitest run tests/balance/character.test.ts`.
import { describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { birth, characterSystem, chooseJob, extOf } from '../../src/core/character';
import { Game, type System } from '../../src/core/game';
import { newGame } from '../../src/core/state';
import type { OriginFile } from '../../src/core/data/types-character';

const LIVES = 20000;
const data = loadGen();
const origin = data.origin.items as OriginFile;

const comingOfAge: System = {
  name: 'character.balance',
  lifeYear(ctx) {
    const l = ctx.state.life!;
    if (l.hAge === 20 && !l.job) chooseJob(ctx);
  },
};

describe('character balance', () => {
  it(
    `${LIVES} lives`,
    () => {
      const race: Record<string, number> = {};
      const secret: Record<string, number> = {};
      let early = 0;
      let halves = 0;
      let secretTotal = 0;
      let jobs = 0;
      let lateNatural = 0;
      for (let i = 0; i < LIVES; i++) {
        const g = new Game(newGame(7919 * i + 13), data, [characterSystem, comingOfAge]);
        birth(g.ctx);
        g.born();
        g.runLife();
        const l = g.state.life!;
        race[l.race] = (race[l.race] ?? 0) + 1;
        if (l.dead!.cause !== 'old') early++;
        else if (l.dead!.hAge > 90) lateNatural++;
        if (extOf(l).second) halves++;
        if (l.job) jobs++;
        if (l.secretJob) {
          secretTotal++;
          secret[l.secretJob] = (secret[l.secretJob] ?? 0) + 1;
        }
      }
      console.log(
        JSON.stringify({
          lives: LIVES,
          untimely: +(early / LIVES).toFixed(4),
          secretTotal: +(secretTotal / LIVES).toFixed(4),
          secret,
          godslayer: (secret.godslayer ?? 0) / LIVES,
          halves: +(halves / LIVES).toFixed(4),
          withJob: +(jobs / LIVES).toFixed(4),
          race: Object.fromEntries(Object.entries(race).map(([k, v]) => [k, +((100 * v) / LIVES).toFixed(2)])),
        }),
      );

      // the secret jobs stay rare (code-plan §7): all together ≤ 3%, godslayer ≤ 0.1%
      expect(secretTotal / LIVES).toBeLessThanOrEqual(0.03);
      expect((secret.godslayer ?? 0) / LIVES).toBeLessThanOrEqual(0.001);

      // the race of the born follows the table of 01-origin §2 (five standard errors and a tenth of a point)
      for (const r of origin.raceShare) {
        const p = r.w / 100;
        const tol = 5 * Math.sqrt((p * (1 - p)) / LIVES) + 0.001;
        expect(Math.abs((race[r.id] ?? 0) / LIVES - p), r.id).toBeLessThanOrEqual(tol);
      }

      // about 21% die before 75: 0.4% a life year from 15 (god/06-implementation.md §4)
      expect(early / LIVES).toBeGreaterThan(0.19);
      expect(early / LIVES).toBeLessThan(0.235);
      expect(lateNatural).toBe(0);

      // half-bloods: the share of the table, race by race (humans 6%, none for slime, mummy ...), summoned humans excluded
      const expected = origin.raceShare.reduce((s, r) => s + (r.w / 100) * ((origin.birthplaces.find((b) => b.race === r.id)?.halfPct ?? 0) / 100), 0);
      expect(Math.abs(halves / LIVES - expected)).toBeLessThan(0.006);
    },
    600_000,
  );
});
