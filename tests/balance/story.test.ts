// Balance targets of the story system (code-plan §7 row "story"): about 31 to 33 nodes per life for every race, and the rule-based
// director raises callbacks (a way that ties back to someone or something this life already met) by at least 30%.
// The test life is the one scripts/sim/sim-life.mjs walks: it lives to hAge 75, nothing kills it earlier, every condition of a
// node holds (the sim ignores node conditions), and the journey and bondage lines open at the sim's rates (those lines belong to travel and
// bondage in the core and open only through `openLine`; the test gives them back to the story for the length of this file).
// Run: npx vitest run tests/balance/story.test.ts   (slow: about a minute)
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { Game, type GameData, type System } from '../../src/core/game';
import { onCond, onEffect, onStat, resetRules } from '../../src/core/rules';
import { newGame } from '../../src/core/state';
import { registerStoryRules, storySystem } from '../../src/core/story';
import { EXTERNAL_LINES, OPEN_RATE } from '../../src/core/story/tuning';
import type { LifeState } from '../../src/core/types';

const RACES = ['human', 'elf', 'darkelf', 'dwarf', 'orc', 'halfling', 'beast', 'naga', 'dragonkin', 'vampire', 'fae', 'slime', 'demonkin', 'merfolk', 'winged', 'giant', 'lavakin', 'construct', 'soulmachine', 'mummy', 'ghoul'];
const RACE_CODE: Record<string, string> = { human: 'hu', elf: 'el', darkelf: 'de', dwarf: 'dw', orc: 'or', halfling: 'ha', beast: 'be', naga: 'na', dragonkin: 'dk', vampire: 'va', fae: 'fa', slime: 'sl', demonkin: 'dm', merfolk: 'me', winged: 'wi', giant: 'gi', lavakin: 'la', construct: 'co', soulmachine: 'so', mummy: 'mu', ghoul: 'gh' };
const LIVES = Number(process.env.STORY_LIVES ?? 200);

// ---------- the sim's character: a life to 75 that meets every condition the sim ignores ----------

const toy: System = {
  name: 'character',
  beat(ctx) {
    const l = ctx.state.life!;
    if (l.hAge >= 75) l.dead = { year: ctx.state.clock.worldYear, hAge: l.hAge, cause: 'old' };
  },
};

/** The rates of scripts/sim/sim-life.mjs OVERLAY_RATE and XC_RATE for the lines that other systems own. */
const SIM_RATE: Record<string, number> = { sf: 0.08, ps: 0.06, ml: 0.08, sc: 0.08, ex: 0.1, wd: 0.08, bd: 0.05, bo: 0.04, ab: 0.12, xc: 0.45 };

function mockRules() {
  resetRules();
  registerStoryRules();
  for (const [l, r] of Object.entries(SIM_RATE)) {
    OPEN_RATE[l] = r;
    (EXTERNAL_LINES as Set<string>).delete(l);
  }
  // the effects that belong to combat and bonds: the sim has no battles or bonds
  for (const k of ['battle', 'battleFor', 'mood', 'template', 'bond'] as const) onEffect(k, () => undefined);
  const life = (c: { state: { life: LifeState | null } }) => c.state.life!;
  // the sim opens the journey, craft and trade lines by chance, so every job counts, except the labour jobs of the economy line `wk` that the sim does not walk
  onCond('has', (c, x) => (x.kind === 'job' && !['miner', 'laborer', 'factory_worker'].includes(x.id)) || [...life(c).traits, ...life(c).blessings, ...life(c).curses, ...life(c).skills].includes(x.id));
  // the sim's life lives to 75 whatever a way says (a way that says the character dies is the end, which the toy comes to anyway);
  // the deaths of the ways are measured with the real character system below
  onEffect('death', () => undefined);
  onCond('event', () => true);
  onCond('country', (c, x) => x.ids.includes(life(c).country));
  onCond('continent', (c, x) => x.ids.includes(life(c).country.slice(0, 2) as never));
  onCond('race', (c, x) => x.ids.includes(RACE_CODE[life(c).race]));
  onCond('bond', () => true);
  onCond('age', (c, x) => life(c).hAge >= (x.min ?? 0) && life(c).hAge <= (x.max ?? 999));
  onCond('class', (c, x) => {
    const n = Number(life(c).cls.slice(1));
    return n >= (x.min ?? 0) && n <= (x.max ?? 9);
  });
  onCond('half', () => false);
  onCond('era', (c, x) => c.state.world.era >= x.min);
  onCond('place', () => false);
  onStat('gold', { read: (c) => life(c).gold });
  onStat('int', { read: (c) => life(c).stats.int });
  onStat('travel.countries', { read: () => 1 });
}

let data: GameData;
let origins: Record<string, string>;
beforeAll(() => {
  data = loadGen(['storylines', 'convergence', 'races']);
  const o = (data.storylines.items as { origins: { line: string; places: string[] }[] }).origins;
  origins = {};
  for (const x of o) if (!origins[x.line] && x.places[0]) origins[x.line] = x.places[0];
});

function lifeOf(race: string, line: string): LifeState {
  const home = origins[line] ?? 'AL-01';
  return {
    id: 'L1', name: 't', race, gender: 'm', birthYear: 0, lifespan: 75, hAge: 0, country: home, home, traits: [], aptitudes: {}, skills: [], blessings: [], curses: [],
    fate: [], cls: 'c3', gold: 0, stats: { pow: 0, mag: 0, spd: 0, luk: 0, int: 12, vit: 0 }, items: [], flags: [], passed: {}, pending: [], memory: [], godFaith: 0, heart: 0, ext: {},
  };
}

interface Count {
  nodes: number;
  /** Nodes counted the way the sim counts them (see the test below). */
  simNodes: number;
  chances: number;
  callbacks: number;
}

function live(race: string, seed: number, director: boolean): Count {
  const line = (data.races.items as { races: { id: string; storyPrefix: string }[] }).races.find((r) => r.id === race)!.storyPrefix;
  const g = new Game(newGame(seed), data, [toy, storySystem]);
  g.state.settings.llm.director = director;
  g.state.world.era = 4;
  g.state.life = lifeOf(race, line);
  g.born();
  g.runLife();
  let nodes = 0;
  let extra = 0;
  let chances = 0;
  let callbacks = 0;
  for (const e of g.state.log) {
    if (e.sys !== 'story' || e.kind !== 'node') continue;
    nodes++;
    if (String(e.id).startsWith('cv.')) extra++; // a convergence entered on its own (a link, a way), not in place of a row
    if (e.data.chance) chances++;
    if (e.data.callback) callbacks++;
  }
  // The sim also visits every node of the race line whatever its condition, ignores jumps, and visits a closed `→ cv` row and then its
  // fallback (two nodes). Here the nodes the story skipped (their condition failed, a jump went over them, a fallback replaced the row)
  // count again and the convergences entered on their own do not count (the sim has no links), so the figure is the one
  // scripts/sim/sim-life.mjs prints.
  const ex = g.state.life!.ext.story as { skipped: string[] };
  const lost = ex.skipped.length;
  return { nodes, simNodes: nodes - extra + lost, chances, callbacks };
}

/** The nodes per life the document-level simulator prints for each race, in the order of RACES. */
function simTable(): number[] {
  const out = execFileSync('node', ['scripts/sim/sim-life.mjs', '1500'], { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' });
  const rows = out.split('\n').filter((l) => /^[^|]+ \| \d+\.\d \|/.test(l));
  return rows.map((l) => Number(l.split('|')[1]));
}

describe('story balance', () => {
  beforeAll(mockRules);
  afterAll(() => {
    for (const l of Object.keys(SIM_RATE)) {
      delete OPEN_RATE[l];
      (EXTERNAL_LINES as Set<string>).add(l);
    }
  });

  it('a life meets about 31 to 33 nodes, for every race', () => {
    const rows: string[] = [];
    const bad: string[] = [];
    const sim = simTable();
    expect(sim.length).toBe(RACES.length);
    let all = 0;
    let played = 0;
    for (const [r, race] of RACES.entries()) {
      let sum = 0;
      let simSum = 0;
      for (let i = 0; i < LIVES; i++) {
        const c = live(race, 1000 + i, false);
        sum += c.nodes;
        simSum += c.simNodes;
      }
      const mean = sum / LIVES;
      const simMean = simSum / LIVES;
      rows.push(`${race.padEnd(12)} played ${mean.toFixed(1)} · counted as the sim counts ${simMean.toFixed(1)} · sim-life.mjs ${sim[r].toFixed(1)}`);
      // ±3 since convergences take the character to their place (M1 lead decision): the sim models their openness as a fixed rate
      if (simMean < 30 || simMean > 34 || Math.abs(simMean - sim[r]) > 3) bad.push(`${race} ${simMean.toFixed(1)} against ${sim[r].toFixed(1)}`);
      all += simMean;
      played += mean;
    }
    console.log(`nodes per life (${LIVES} lives per race)\n${rows.join('\n')}`);
    expect(bad).toEqual([]);
    // the 31 to 33 of the docs is what a life meets: the nodes played (the sim-style count drops convergences entered on their own)
    expect(played / RACES.length).toBeGreaterThanOrEqual(31);
    expect(played / RACES.length).toBeLessThanOrEqual(33);
    expect(all / RACES.length).toBeGreaterThanOrEqual(30);
  });

  it('the director raises callbacks by at least 30%', () => {
    const arm = (director: boolean) => {
      const t = { chances: 0, callbacks: 0, n: 0 };
      for (const race of RACES)
        for (let i = 0; i < LIVES; i++) {
          const c = live(race, 5000 + i, director);
          t.chances += c.chances;
          t.callbacks += c.callbacks;
          t.n++;
        }
      return { chances: t.chances / t.n, callbacks: t.callbacks / t.n };
    };
    const off = arm(false);
    const on = arm(true);
    const gain = on.callbacks / off.callbacks - 1;
    console.log(`callbacks per life: off ${off.callbacks.toFixed(3)} (forks that could tie back ${off.chances.toFixed(2)}) · on ${on.callbacks.toFixed(3)} (${on.chances.toFixed(2)}) · gain ${(gain * 100).toFixed(0)}%`);
    expect(gain).toBeGreaterThanOrEqual(0.3);
  });
});
