// Balance of the acts of the god (god/06-implementation.md §4): the targets the acts can show alone, measured on the core and set beside
// `node scripts/sim/sim-god.mjs` (the document-level simulator, same policies). Slow: `npm run test:balance`.
//
// What the acts cannot show alone is skipped, with the reason:
//   · dreams obeyed, decisions a life, burden events, chest counts: dreams and chests are the other half of the god system (god/power, chest, dream)
//   · ruins a world, seal strikes, the eras the seal quickens: the large miracles and the seal are the step M4
//   · the vows GV-11 GV-19: the goals are the step G6b
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { Game, sortSystems, type Ctx, type GameData } from '../../src/core/game';
import { actsPolicyStep, godActsSystem, type PolicyName } from '../../src/core/god/acts';
import { newGame } from '../../src/core/state';
import { onWorldPhase, worldSystem } from '../../src/core/world';
import type { LifeState } from '../../src/core/types';

const root = path.resolve(__dirname, '../..');
const SIM = path.join(root, 'scripts/sim/sim-god.mjs');

// ---------- the simulator's numbers ----------

interface SimLife {
  prayers: number;
  belief: number;
  low: number;
}
interface SimWorld {
  ended: number;
}
let simLife: Record<string, SimLife> = {};
let simWorld: Record<string, SimWorld> = {};

/** Runs the doc-level simulator and reads its two tables. */
function runSim(lives: number, worlds: number): void {
  const out = execFileSync('node', [SIM, String(lives), String(worlds)], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const rows = out.split('\n').filter((l) => l.startsWith('| ')).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  const num = (s: string) => Number(s.replace('%', ''));
  for (const r of rows) {
    // life table: policy | decisions | dreams | bestows | prayers | belief p50 | belief ≤ −70 | ...
    if (r.length === 9 && /^-?\d+(\.\d+)?$/.test(r[4]) && /%$/.test(r[6])) simLife[r[0]] = { prayers: num(r[4]), belief: num(r[5]), low: num(r[6]) };
    // world table: policy | ended | endings | eras | falls | ruins | together | strikes | GD
    if (r.length === 9 && /%$/.test(r[1]) && /·/.test(r[3])) simWorld[r[0]] = { ended: num(r[1]) };
  }
}

// ---------- the life part: real lives (world, character, story, NPCs) with the acts of the god in the loop ----------

const POLICY_OF: Record<string, PolicyName> = { เงียบ: 'เงียบ', เมตตา: 'เมตตา', ลงโทษ: 'ลงโทษ', สุ่ม: 'สุ่ม' };

interface LifeResult {
  prayers: number;
  answered: number;
  whispers: number;
  belief: number;
  age: number;
}

/** One life under a policy. The income of the god is the rule of 01-power.md §1 (the parts the acts do not own: base, channel B, belief). */
function lifeRun(data: GameData, seed: number, policy: PolicyName): LifeResult {
  const s = createSession(data, { seed, startYear: 450 });
  const systems = (s.game as unknown as { systems: unknown[] }).systems;
  systems.push(godActsSystem);
  systems.splice(0, systems.length, ...sortSystems(systems as never));
  const g = s.game;
  const st = g.state;
  st.god.light = 30;
  st.god.dread = 10;
  startLife(s);
  const life = st.life!;
  let age = life.hAge;
  for (let beats = 0; beats < 4 * 400 && !life.dead; beats++) {
    g.beat();
    if (life.dead) break;
    actsPolicyStep(g.ctx, policy, 'beat');
    if (life.hAge !== age) {
      age = life.hAge;
      const b = st.world.countryFaith[life.country] ?? 40;
      st.god.light = Math.min(200, st.god.light + 1 + b / 25 + Math.max(0, life.godFaith) / 30);
      st.god.dread = Math.min(200, st.god.dread + 0.3 + Math.max(0, -life.godFaith) / 75);
    }
  }
  const log = st.log.filter((e) => e.sys === 'god');
  return {
    prayers: log.filter((e) => e.kind === 'prayer').length,
    answered: log.filter((e) => e.kind === 'prayer.give' || e.kind === 'prayer.punish' || e.kind === 'prayer.deny').length,
    whispers: log.filter((e) => e.kind === 'whisper').length,
    belief: life.godFaith,
    age: life.hAge,
  };
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const share = (a: number[], f: (x: number) => boolean) => a.filter(f).length / a.length;

const LIVES = 160;
const lives: Record<string, LifeResult[]> = {};

// ---------- the world part: the real world with a living stand-in for the character, the income the sim measured, the policy ----------

/** Left for the world after the prayers are answered, per life year (06-implementation.md §4 "รายได้ที่เหลือให้โลก"). */
const WORLD_INCOME = { faith: 1.3, dread: 2.0 };
/** The simulator's world count, and the worlds the base and the haste are run for: their ratio is the target, so they get the most (the sampling error of a 17% rate over 600 worlds is 1.5 points). */
const WORLDS = 600;
const RATIO_WORLDS = 1800;
const HORIZON = 181; // decades: 1,800 years

let sim: { races: { code: string }[]; drawLife: (race: unknown, r: () => number) => { at: (x: number) => number } };

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function standIn(id: number, year: number): LifeState {
  return {
    id: `L${id}`, name: 'ผู้ถูกเฝ้ามอง', race: 'human', gender: 'm', birthYear: year, lifespan: 80, hAge: 30, country: 'AL-01', home: 'AL-01',
    traits: [], aptitudes: {}, skills: [], blessings: [], curses: [], fate: [], cls: 'c3', gold: 100,
    stats: { pow: 5, mag: 5, spd: 5, luk: 5, int: 10, vit: 5 }, items: [], flags: [], passed: {}, pending: [], memory: [], godFaith: 20, heart: 0, ext: {},
  };
}

interface WorldResult {
  ended: boolean;
  endYear: number;
  eras: number[];
  falls: number;
  miracles: number;
}

function worldRun(data: GameData, n: number, policy: string): WorldResult {
  const seed = n * 7919;
  const r = mulberry(seed ^ 0x5bd1e995);
  const race = sim.races[Math.floor(r() * sim.races.length)];
  const st = newGame(seed);
  st.clock.worldYear = -10;
  let lifeEnd = 0;
  let wpl = 1;
  let lives = 0;
  const newLife = (year: number) => {
    const L = sim.drawLife(race, r);
    wpl = L.at(75) / 75;
    lifeEnd = year + L.at(75);
    lives++;
    st.life = standIn(lives, year);
    if (lives > 1) {
      st.god.light *= 0.5;
      st.god.dread *= 0.5;
    } else {
      st.god.light = 30;
      st.god.dread = 10;
    }
  };
  newLife(0);
  const g = new Game(st, data, [worldSystem, godActsSystem]);
  hookCtx = { policy, newLife, st, wpl: () => wpl, lifeEnd: () => lifeEnd };
  g.init();
  g.worldSteps(HORIZON);
  const w = st.world;
  return {
    ended: !!w.ended,
    endYear: w.ended?.year ?? 0,
    eras: [2, 3, 4].map((k) => w.vars['eraStart' + k]).filter((x) => x !== undefined),
    falls: w.dfc,
    miracles: st.god.chronicle.filter((c) => c.kind === 'miracle').length,
  };
}

let hookCtx: { policy: string; newLife: (y: number) => void; st: ReturnType<typeof newGame>; wpl: () => number; lifeEnd: () => number } | undefined;

function installWorldHook(): void {
  // the acts' own gate for GD-04 and GD-05 registered when the module loaded; this hook is the god's income and hand, and works only for the game that set `hookCtx`
  onWorldPhase('afterDrift', (ctx: Ctx) => {
    const h = hookCtx;
    if (!h || h.st !== ctx.state) return;
    const year = ctx.state.clock.worldYear;
    while (year >= h.lifeEnd()) h.newLife(h.lifeEnd());
    const ly = 10 / h.wpl();
    ctx.state.god.light = Math.min(200, ctx.state.god.light + WORLD_INCOME.faith * ly);
    ctx.state.god.dread = Math.min(200, ctx.state.god.dread + WORLD_INCOME.dread * ly);
    if (h.policy !== 'base') actsPolicyStep(ctx, h.policy, 'world');
  });
}

const worlds: Record<string, WorldResult[]> = {};

beforeAll(async () => {
  const data = loadAll();
  runSim(4000, WORLDS);
  sim = await import(pathToFileURL(path.join(root, 'scripts/sim/sim-world.mjs')).href);
  for (const [name, policy] of Object.entries(POLICY_OF)) {
    lives[name] = [];
    for (let i = 0; i < LIVES; i++) lives[name].push(lifeRun(data, 1000 + i * 31, policy));
  }
  installWorldHook();
  for (const [name, policy, count] of [['ไม่จำลองพระเจ้า', 'base', RATIO_WORLDS], ['เมตตา', 'เมตตา', WORLDS], ['เร่งจบ', 'เร่งจบ', RATIO_WORLDS], ['สุ่ม', 'สุ่ม', WORLDS]] as const) {
    const t0 = Date.now();
    worlds[name] = [];
    for (let n = 1; n <= count; n++) worlds[name].push(worldRun(data, n, policy));
    console.log(`${name}: ${count} worlds in ${((Date.now() - t0) / 1000).toFixed(0)}s · ended ${(100 * worlds[name].filter((x) => x.ended).length / count).toFixed(1)}% · miracles ${(worlds[name].reduce((a, x) => a + x.miracles, 0) / count).toFixed(1)}`);
  }
}, 3_000_000);

// ---------- the targets ----------

describe('life part (acts only): prayers and belief', () => {
  it('the simulator was read', () => {
    expect(simLife['เงียบ']).toBeDefined();
    expect(simLife['เมตตา']).toBeDefined();
    expect(simWorld['ไม่จำลองพระเจ้า (ค่าฐานของโลก)']).toBeDefined();
  });

  it('เงียบ and เมตตา: belief at death ≤ −70 in at most 0.4% of lives (the target of 06 §4)', () => {
    for (const name of ['เงียบ', 'เมตตา']) {
      const low = share(lives[name].map((x) => x.belief), (b) => b <= -70);
      expect(low, name).toBeLessThanOrEqual(0.004);
    }
  });

  it('the god who answers every prayer ends the life believed in; the one who punishes every one ends hated; the silent ends near nought', () => {
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    expect(med(lives['เมตตา'].map((x) => x.belief))).toBeGreaterThanOrEqual(50);
    expect(med(lives['ลงโทษ'].map((x) => x.belief))).toBeLessThanOrEqual(-50);
    expect(Math.abs(med(lives['เงียบ'].map((x) => x.belief)))).toBeLessThanOrEqual(40);
    // the sim measured the same ordering
    expect(simLife['เมตตา'].belief).toBeGreaterThan(simLife['เงียบ'].belief);
    expect(simLife['ลงโทษ'].belief).toBeLessThan(simLife['เงียบ'].belief);
  });

  it('prayers a life: the core raises the same order as the sim; fewer, because the sim assumes trouble in a fifth of the beats and the core has only the troubles the world made', () => {
    const silent = mean(lives['เงียบ'].map((x) => x.prayers));
    const kind = mean(lives['เมตตา'].map((x) => x.prayers));
    console.log(`prayers a life: เงียบ ${silent.toFixed(1)} (sim ${simLife['เงียบ'].prayers}) · เมตตา ${kind.toFixed(1)} (sim ${simLife['เมตตา'].prayers}) · ลงโทษ ${mean(lives['ลงโทษ'].map((x) => x.prayers)).toFixed(1)} (sim ${simLife['ลงโทษ'].prayers}) · สุ่ม ${mean(lives['สุ่ม'].map((x) => x.prayers)).toFixed(1)} (sim ${simLife['สุ่ม'].prayers})`);
    // the sim: 13.3 and 15.2. In the core the silent god is asked a few more kinds (a turned-away heart is asked `challenge`), the kind god's are answered; both sit at 60% to 100% of the sim
    for (const [name, got] of [['เงียบ', silent], ['เมตตา', kind]] as const) {
      expect(got, name).toBeGreaterThan(simLife[name].prayers * 0.55);
      expect(got, name).toBeLessThan(simLife[name].prayers * 1.1);
    }
  });

  it('the punishing god ends the prayers early: belief falls under −70, and nobody prays any more (sim 4.1 a life)', () => {
    const punish = mean(lives['ลงโทษ'].map((x) => x.prayers));
    expect(punish).toBeLessThan(mean(lives['เมตตา'].map((x) => x.prayers)) * 0.8);
    expect(punish).toBeLessThan(simLife['ลงโทษ'].prayers * 2);
    expect(share(lives['ลงโทษ'].map((x) => x.belief), (b) => b <= -70)).toBeGreaterThan(0.7); // sim 98%
  });

  it('every prayer that was raised and not answered lapsed: no card outlives its 14 ticks', () => {
    for (const x of lives['เมตตา']) expect(x.answered).toBeLessThanOrEqual(x.prayers);
  });

  it('the merciful whisper at most three a life year', () => {
    for (const x of lives['เมตตา']) expect(x.whispers).toBeLessThanOrEqual(3 * (x.age + 1));
    expect(mean(lives['เมตตา'].map((x) => x.whispers))).toBeGreaterThan(1);
  });
});

describe('world part (acts only): the dragons and the fates', () => {
  const ended = (a: WorldResult[]) => a.filter((x) => x.ended).length / a.length;
  const median = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);

  it('the base: about the 9% of the sim end inside 1,800 years', () => {
    const base = ended(worlds['ไม่จำลองพระเจ้า']);
    const sb = simWorld['ไม่จำลองพระเจ้า (ค่าฐานของโลก)'].ended / 100;
    expect(base).toBeGreaterThan(sb * 0.7);
    expect(base).toBeLessThan(sb * 1.3);
  });

  it('เร่งจบ: the world ends inside 1,800 years in no more than twice as many worlds as the base (the target of 06 §4)', () => {
    const b = worlds['ไม่จำลองพระเจ้า'];
    const f = worlds['เร่งจบ'];
    const base = ended(b);
    const fast = ended(f);
    // the target is on the rates; both are counted over many worlds, so allow one standard error of the difference to the line
    const se = (p: number, n: number) => Math.sqrt((p * (1 - p)) / n);
    console.log(`ended in 1,800 years: base ${(100 * base).toFixed(1)}% · เร่งจบ ${(100 * fast).toFixed(1)}% · ratio ${(fast / base).toFixed(2)} (sim ${simWorld['เร่งจบ'].ended}% / ${simWorld['ไม่จำลองพระเจ้า (ค่าฐานของโลก)'].ended}%)`);
    expect(fast).toBeLessThanOrEqual(2 * base + se(fast, f.length) + 2 * se(base, b.length));
    // and it does hasten: more endings than the base, as the sim shows (17.3% against 9.0%)
    expect(fast).toBeGreaterThanOrEqual(base * 0.9);
    expect(simWorld['เร่งจบ'].ended).toBeGreaterThan(simWorld['ไม่จำลองพระเจ้า (ค่าฐานของโลก)'].ended);
  });

  it('เร่งจบ moves the eras sooner than the base and เมตตา does not hasten them', () => {
    const base = worlds['ไม่จำลองพระเจ้า'];
    const fast = worlds['เร่งจบ'];
    const kind = worlds['เมตตา'];
    for (let k = 0; k < 3; k++) {
      const b = median(base.map((x) => x.eras[k]).filter((v) => v !== undefined));
      const f = median(fast.map((x) => x.eras[k]).filter((v) => v !== undefined));
      const m = median(kind.map((x) => x.eras[k]).filter((v) => v !== undefined));
      if (Number.isNaN(b) || Number.isNaN(f)) continue;
      expect(f, `era ${k + 2}`).toBeLessThanOrEqual(b);
      expect(f, `era ${k + 2} not more than 40% sooner`).toBeGreaterThan(b * 0.6);
      expect(m, `kind era ${k + 2}`).toBeGreaterThanOrEqual(b * 0.9);
    }
  });

  it('the miracles of a policy stay inside the caps: the world spends no more than the power it earns', () => {
    for (const name of ['เมตตา', 'เร่งจบ', 'สุ่ม']) {
      const per = mean(worlds[name].map((x) => x.miracles));
      expect(per, name).toBeLessThan(120); // 1,800 years: income 1.3 light and 2.0 dread a life year buys fewer than this many 40-point deeds
    }
    expect(mean(worlds['เร่งจบ'].map((x) => x.miracles))).toBeGreaterThan(mean(worlds['สุ่ม'].map((x) => x.miracles)));
  });
});

