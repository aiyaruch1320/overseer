// Balance of the world system (code-plan §7 row world): 2,000 worlds of 1,800 years must end in about 9% and start the eras near
// 620 / 970 / 1,320 (docs/systems/simulation/world-sim.md §3.1, edge ±10%), and must stay near what scripts/sim/sim-world.mjs
// gets from the docs on the same worlds. Slow: `npx vitest run tests/balance`.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { Game, type GameData } from '../../src/core/game';
import { newGame } from '../../src/core/state';
import { worldSystem } from '../../src/core/world';

const WORLDS = 2000;
const root = path.resolve(__dirname, '../..');
const load = (n: string) => JSON.parse(readFileSync(path.join(root, 'data/gen', `${n}.json`), 'utf8'));
const DATA: GameData = { 'world-events': load('world-events'), convergence: load('convergence'), countries: load('countries') };

/** The sim's quantile: sorted, floor(f × n). */
const q = (a: number[], f: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(f * s.length))];
};

interface Result {
  ended: number;
  endYears: number[];
  era: number[][];
  endings: Record<string, number>;
}

let core: Result;
let sim: Result;

beforeAll(async () => {
  // the same worlds as the sim: seed = n × 7919, first decade at year 0, 181 decades
  core = { ended: 0, endYears: [], era: [[], [], []], endings: {} };
  for (let n = 1; n <= WORLDS; n++) {
    const st = newGame(n * 7919);
    st.clock.worldYear = -10;
    const g = new Game(st, DATA, [worldSystem]);
    g.init();
    g.worldSteps(181);
    const w = st.world;
    if (w.ended) {
      core.ended++;
      core.endYears.push(w.ended.year);
      core.endings[w.ended.id] = (core.endings[w.ended.id] ?? 0) + 1;
    }
    for (let k = 2; k <= 4; k++) if (w.vars['eraStart' + k] !== undefined) core.era[k - 2].push(w.vars['eraStart' + k]);
  }
  const s = await import(pathToFileURL(path.join(root, 'scripts/sim/sim-world.mjs')).href);
  const res = s.study(WORLDS);
  sim = { ended: res.arc.length, endYears: res.arc, era: res.era, endings: res.end };
}, 600000);

const near = (got: number, want: number, tol: number) => {
  expect(got, `${got} vs ${want} ±${tol * 100}%`).toBeGreaterThanOrEqual(want * (1 - tol));
  expect(got, `${got} vs ${want} ±${tol * 100}%`).toBeLessThanOrEqual(want * (1 + tol));
};

describe('world balance: the targets of world-sim.md', () => {
  it('ends about 9% of the worlds within 1,800 years', () => {
    near(core.ended / WORLDS, 0.09, 0.1);
  });
  it('starts eras 2, 3 and 4 at about 620, 970 and 1,320 years (median)', () => {
    near(q(core.era[0], 0.5), 620, 0.1);
    near(q(core.era[1], 0.5), 970, 0.1);
    near(q(core.era[2], 0.5), 1320, 0.1);
  });
  it('reaches the eras in about the shares of the docs (98% / 93% / 76% of the worlds)', () => {
    near(core.era[0].length / WORLDS, 0.98, 0.05);
    near(core.era[1].length / WORLDS, 0.93, 0.07);
    near(core.era[2].length / WORLDS, 0.76, 0.1);
  });
  it('ends late: the middle of the endings is far into the last era', () => {
    expect(q(core.endYears, 0.5)).toBeGreaterThan(1400);
    expect(q(core.endYears, 0.1)).toBeGreaterThan(1000);
  });
  it('lets all three endings happen, END-10 the most often (about 5% / 1.7% / 2.7%)', () => {
    const e = core.endings;
    expect(e['END-10'] ?? 0).toBeGreaterThan(0);
    expect(e['END-11'] ?? 0).toBeGreaterThan(0);
    expect(e['END-12'] ?? 0).toBeGreaterThan(0);
    expect(e['END-10']).toBeGreaterThan(e['END-11']);
  });
});

describe('world balance: against scripts/sim/sim-world.mjs on the same data', () => {
  it('ends within two points of the sim', () => {
    expect(Math.abs(core.ended - sim.ended) / WORLDS).toBeLessThan(0.02);
  });
  it('starts the eras within 12% of the sim (the core also reads the effects and the conditions the sim leaves out)', () => {
    for (let k = 0; k < 3; k++) near(q(core.era[k], 0.5), q(sim.era[k], 0.5), 0.12);
  });
  it('has the same order of endings', () => {
    const order = (r: Result) => Object.entries(r.endings).sort((a, b) => b[1] - a[1])[0][0];
    expect(order(core)).toBe(order(sim));
  });
});
