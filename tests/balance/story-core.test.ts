// Nodes per life on the whole core (M3 review N1): lives of `allSystems()` with the tools' world (the start rule of world-time.md §8.1), seeds 1 to LIVES,
// the nodes the story played (`story/node`). The target of the story folder is 31 to 33 for a life that reaches old age (70); the toy-character
// test in story.test.ts holds the same target for the story alone, this one holds it once the overlay lines of the other systems open as they do in the game.
// Run: npx vitest run --config vitest.balance.config.ts tests/balance/story-core.test.ts   (about five minutes for 300 lives)
import { describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, runToDeath, startLife } from '../../scripts/tools/session';

const LIVES = Number(process.env.STORY_CORE_LIVES ?? 300);
const FROM = Number(process.env.STORY_CORE_FROM ?? 1);

describe('nodes per life on the whole core', () => {
  it(
    `${LIVES} lives: 31 to 33 nodes for the lives that reach 70`,
    async () => {
      const data = loadAll();
      let all = 0;
      let elder = 0;
      let elders = 0;
      const lines: Record<string, number> = {};
      for (let seed = FROM; seed < FROM + LIVES; seed++) {
        if ((seed - FROM) % 10 === 9) await new Promise((r) => setImmediate(r)); // one turn of the event loop every ten lives (tests/setup/settle.ts)
        const s = createSession(data, { seed });
        startLife(s);
        runToDeath(s.game);
        let n = 0;
        for (const e of s.game.state.log) {
          if (e.sys !== 'story' || e.kind !== 'node') continue;
          n++;
          const line = String(e.id).split('.')[0];
          lines[line] = (lines[line] ?? 0) + 1;
        }
        all += n;
        if (s.game.state.life!.dead!.hAge >= 70) {
          elder += n;
          elders++;
        }
      }
      const top = Object.entries(lines)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([l, v]) => `${l} ${(v / LIVES).toFixed(2)}`)
        .join(' · ');
      console.log(JSON.stringify({ lives: LIVES, nodesPerLife: +(all / LIVES).toFixed(2), reachOld: elders, nodesPerOldLife: +(elder / Math.max(1, elders)).toFixed(2) }), top);
      expect(elders).toBeGreaterThan(LIVES * 0.6);
      expect(elder / elders).toBeGreaterThanOrEqual(31);
      expect(elder / elders).toBeLessThanOrEqual(33);
    },
    1_200_000,
  );
});
