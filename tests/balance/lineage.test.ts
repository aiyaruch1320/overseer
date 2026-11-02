// Balance of the lineage and the ending card over many seeds and all the peoples (docs/guide/code-plan.md §11 row M4). Slow: npm run test:balance
import { describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, runToDeath, startLife } from '../../scripts/tools/session';
import { cardOf } from '../../src/core/ending';
import { LIMIT } from '../../src/core/ending/tuning';
import { lx, nextLife, type Origin } from '../../src/core/lineage';

const data = loadAll();
const RACES = ['human', 'elf', 'darkelf', 'dwarf', 'orc', 'halfling', 'beast', 'naga', 'dragonkin', 'vampire', 'fae', 'slime', 'demonkin', 'merfolk', 'winged', 'giant', 'lavakin', 'construct', 'soulmachine', 'mummy', 'ghoul'];

function play(seed: number, lives: number, race?: string) {
  const s = createSession(data, { seed, race });
  startLife(s);
  const origins: Origin[] = [];
  for (let i = 0; i < lives; i++) {
    if (i > 0) {
      const r = nextLife(s.game, { newcomer: true });
      // the only reason a family with a newcomer asked for cannot go on is that the world reached its end (a long-lived people runs into the end of the sim)
      if (!r.ok) {
        expect(r.reason, `seed ${seed} life ${i + 1}`).toBe('world-ended');
        return { s, origins, ended: true };
      }
      origins.push(r.origin);
    }
    runToDeath(s.game);
    const card = cardOf(s.game.state)!;
    expect(card, `seed ${seed} life ${i + 1} has a card`).toBeTruthy();
    const [head, title, question, ...rest] = card.lines;
    expect([...head].length, head).toBeLessThanOrEqual(LIMIT.headLine);
    expect([...title].length, title).toBeLessThanOrEqual(LIMIT.titleLine);
    expect([...question].length, question).toBeLessThanOrEqual(LIMIT.questionLine);
    expect(rest.length).toBeGreaterThanOrEqual(2);
    for (const t of [...card.lines, card.summary.text, ...card.facts.map((f) => f.sentence)]) expect(t, `seed ${seed}`).not.toMatch(/[{}]|undefined|NaN|\[object/);
    expect(card.facts.length).toBeGreaterThanOrEqual(3);
    expect([...card.summary.text].length).toBeLessThanOrEqual(LIMIT.summary);
    expect([...card.epitaph.text].length).toBeLessThanOrEqual(LIMIT.epitaph);
  }
  return { s, origins, ended: false };
}

describe('lineage balance', () => {
  it('thirty seeds of three lives each play to the end with a card for every life; names are not repeated; at most three threads are carried', () => {
    const count: Record<string, number> = {};
    for (let seed = 1; seed <= 30; seed++) {
      const { s, origins } = play(seed, 3);
      const st = s.game.state;
      expect(new Set(st.lineage.lives.map((l) => l.name)).size, `seed ${seed} names`).toBe(st.lineage.lives.length);
      for (const r of lx(st).recs) expect(r.threads.length).toBeLessThanOrEqual(3);
      for (const o of origins) count[o] = (count[o] ?? 0) + 1;
    }
    // the heirs of the bond book carry most of the transitions (children come to about 45% of the lives, the partner and the helped to some more)
    const heirs = (count.heir ?? 0) + (count.successor ?? 0);
    expect(heirs, JSON.stringify(count)).toBeGreaterThanOrEqual(15);
  });

  it('all twenty-one peoples can be a lineage of two lives (the peoples with no children of their own go on with a newcomer)', () => {
    let two = 0;
    RACES.forEach((race, i) => {
      const { s, ended } = play(100 + i, 2, race);
      if (!ended) {
        expect(s.game.state.lineage.lives.length, race).toBe(2);
        two++;
      }
    });
    expect(two).toBeGreaterThanOrEqual(15);
  });
});
