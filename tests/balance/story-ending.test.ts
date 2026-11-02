// How a whole life ends and how it paces, with every system of the core running (M1 review S1, S2): the world, the character, the
// NPCs, the story. A life is told one ending at most; an ending that is a death in battle comes only after a death in battle; a year
// holds few nodes and few battles; the closing nodes end the life with the cause they say.
// Run: npx vitest run --config vitest.balance.config.ts tests/balance/story-ending.test.ts   (about a minute)
import { describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, runToDeath, startLife } from '../../scripts/tools/session';
import { BATTLES_PER_YEAR, CAUSE, LAST_YEAR_EXTRA, NODES_PER_YEAR, WAR_ENDINGS } from '../../src/core/story/tuning';

const LIVES = Number(process.env.ENDING_LIVES ?? 240);

describe('how lives end and pace', () => {
  it(
    `${LIVES} lives`,
    () => {
      const data = loadAll(['storylines', 'convergence', 'races', 'origin', 'countries', 'continents', 'traits', 'aptitudes', 'skills', 'blessings', 'curses', 'jobs', 'fates', 'clashes', 'economy', 'npcs', 'world-events', 'local-events', 'enemies', 'names', 'synonyms', 'templates-ending', 'weapons', 'items', 'materials', 'companions', 'god', 'combat', 'attention', 'forging', 'wish', 'templates-god']);
      let endings = 0;
      let nodes = 0;
      let nodeYears = 0;
      let overCap = 0;
      let widest = 0;
      let battleYears = 0;
      let repeated = 0;
      let wars = 0;
      const causes: Record<string, number> = {};
      const closed: Record<string, number> = {};
      for (let seed = 1; seed <= LIVES; seed++) {
        const s = createSession(data, { seed: 9000 + seed });
        startLife(s);
        runToDeath(s.game);
        const st = s.game.state;
        const dead = st.life!.dead!;
        causes[dead.cause] = (causes[dead.cause] ?? 0) + 1;
        if (dead.node) closed[dead.node] = (closed[dead.node] ?? 0) + 1;

        const told = st.log.filter((e) => e.sys === 'story' && e.kind === 'ending');
        expect(told.length, `life ${seed}`).toBeLessThanOrEqual(1);
        endings += told.length;
        // none before the death
        const death = st.log.findIndex((e) => e.kind === 'death');
        if (told[0]) expect(st.log.indexOf(told[0]), `life ${seed}`).toBeGreaterThan(death);
        // a death in battle is told only after a death in battle
        if (told[0] && WAR_ENDINGS.has(String(told[0].id))) {
          wars++;
          expect(dead.cause, `life ${seed}`).toBe(CAUSE.battle);
        }

        const perYear = new Map<number, { nodes: number; battles: number; fought: string[] }>();
        for (const e of st.log) {
          if (e.sys !== 'story' || e.age === undefined) continue;
          const y = perYear.get(e.age) ?? { nodes: 0, battles: 0, fought: [] };
          perYear.set(e.age, y);
          if (e.kind === 'node') {
            y.nodes++;
            nodes++;
          }
          if (e.kind === 'battle') {
            y.battles++;
            for (const en of String(e.data.enemies).split(',').filter(Boolean)) {
              if (y.fought.includes(en)) repeated++;
              y.fought.push(en);
            }
          }
        }
        for (const y of perYear.values()) {
          nodeYears++;
          if (y.nodes > NODES_PER_YEAR) overCap++;
          widest = Math.max(widest, y.nodes);
          expect(y.battles, `life ${seed}`).toBeLessThanOrEqual(BATTLES_PER_YEAR);
          if (y.battles) battleYears++;
        }
      }
      console.log(
        JSON.stringify({
          lives: LIVES,
          endingsPerLife: +(endings / LIVES).toFixed(3),
          nodesPerLife: +(nodes / LIVES).toFixed(2),
          warEndings: wars,
          nodeYearsOverCap: `${overCap} of ${nodeYears}`,
          mostNodesInAYear: widest,
          yearsWithBattles: battleYears,
          causes,
          endedAtANode: closed,
        }),
      );
      // an enemy is fought once a year
      expect(repeated).toBe(0);
      // a year goes over the number only where a node cannot wait (the closing nodes), and never by much
      expect(overCap / nodeYears).toBeLessThan(0.01);
      // (the last year holds LAST_YEAR_EXTRA more, and the end of the life, e2, is never kept out)
      expect(widest).toBeLessThanOrEqual(NODES_PER_YEAR + LAST_YEAR_EXTRA + 1);
      // most lives are told an ending
      expect(endings / LIVES).toBeGreaterThan(0.6);
    },
    600_000,
  );
});
