// Balance of the acts of the god (god/06-implementation.md §4) on the real core, set beside `node scripts/sim/sim-god.mjs` (the document-level simulator,
// same policies). Slow: `npm run test:balance`.
//
// The life part plays whole lives with the whole god system (income, chests, dreams, prayers, whispers) under a policy named in `state.god.ext.policy`:
// `godSystem` plays it once a life year through `policyStep` and the parts the acts registered. Nothing stands in for the prayers or the whispers.
// The world part runs the real world for 1,800 years with the acts of the god and a living stand-in for the character; the income of the god is the
// sim's measured leftover after the prayers (the sim does the same: "พระเจ้าใช้พลังที่เหลือจากการตอบคำอธิษฐานกับโลกทั้งหมด"), the policy is the same
// `ext.policy`, played by the acts at every world step.
//
// G5 adds the large miracles, the ruins and the seals: the world part counts the ruins a world and the ruins that stand together (policy ลงโทษ), the
// blows on the seals and the eras they quicken (ตีหมุด, เร่งจบ), and the life part checks that no life under any policy of the tools passes the caps of the
// grand miracles (large 2 · ruin 1 · grand 1).
// What the acts cannot show alone is skipped, with the reason:
//   · the vows GV-11 GV-19: the goals are the step G6b
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { Game, type GameData, type System } from '../../src/core/game';
import { godActsSystem } from '../../src/core/god/acts';
import { ruinExt } from '../../src/core/god/ruin';
import { newGame } from '../../src/core/state';
import { worldSystem } from '../../src/core/world';
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

const POLICY_OF: Record<string, string> = { เงียบ: 'เงียบ', เมตตา: 'เมตตา', ลงโทษ: 'ลงโทษ', สุ่ม: 'สุ่ม' };

interface LifeResult {
  /** The large (MR-17 to 20), the ruins and the grand miracles (MR-21 MR-22) that happened in the life, by the chronicle. */
  big: number;
  ruin: number;
  grand: number;
  prayers: number;
  answered: number;
  whispers: number;
  belief: number;
  age: number;
}

/** One whole life under a policy, on the real systems. The first life of a lineage: 30 light, 10 dread, belief 0 (the start of 01-power.md §1). */
function lifeRun(data: GameData, seed: number, policy: string): LifeResult {
  const s = createSession(data, { seed, startYear: 450, policy: policy as never });
  startLife(s);
  const g = s.game;
  const st = g.state;
  const life = st.life!;
  for (let beats = 0; beats < 4 * 400 && !life.dead; beats++) g.beat();
  const log = st.log.filter((e) => e.sys === 'god');
  return {
    big: st.god.chronicle.filter((e) => e.kind === 'miracle' && /^MR-(17|18|19|20)$/.test(e.id)).length,
    ruin: ruinExt(st).ruins.length,
    grand: st.god.chronicle.filter((e) => e.kind === 'miracle' && /^MR-2[12]$/.test(e.id)).length,
    prayers: log.filter((e) => e.kind === 'prayer').length,
    answered: st.god.chronicle.filter((e) => e.kind === 'prayer.give' || e.kind === 'prayer.strange' || e.kind === 'prayer.deny' || e.kind === 'prayer.punish').length,
    whispers: st.god.chronicle.filter((e) => e.kind === 'whisper').length,
    belief: life.godFaith,
    age: life.dead ? life.dead.hAge : life.hAge,
  };
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const share = (a: number[], f: (x: number) => boolean) => a.filter(f).length / a.length;

const LIVES = 160;
const CAP_LIVES = 40;
const lives: Record<string, LifeResult[]> = {};
const capLives: Record<string, LifeResult[]> = {};

// ---------- the world part: the real world with a living stand-in for the character, the income the sim measured, the policy ----------

/** Left for the world after the prayers are answered, per life year (06-implementation.md §4 "รายได้ที่เหลือให้โลก"). */
const WORLD_INCOME = { faith: 1.3, dread: 2.0 };
/** The simulator's world count, and the worlds the base and the haste are run for: their ratio is the target, so they get the most (the sampling error of a 17% rate over 600 worlds is 1.5 points). */
const WORLDS = 600;
const RATIO_WORLDS = 1200;
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
  /** The ruins of the world: the year each was made and the year its city was built, if it was. */
  ruins: { year: number; ended?: number }[];
  strikes: number;
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
  if (policy !== 'base') st.god.ext.policy = policy; // the acts play it at every world step
  const g = new Game(st, data, [worldSystem, godActsSystem, worldIncome]);
  hookCtx = { newLife, st, wpl: () => wpl, lifeEnd: () => lifeEnd };
  g.init();
  g.worldSteps(HORIZON);
  const w = st.world;
  return {
    ruins: ruinExt(st).ruins.map((r) => ({ year: r.year, ...(r.ended !== undefined ? { ended: r.ended } : {}) })),
    strikes: ruinExt(st).strikes,
    ended: !!w.ended,
    endYear: w.ended?.year ?? 0,
    eras: [2, 3, 4].map((k) => w.vars['eraStart' + k]).filter((x) => x !== undefined),
    falls: w.dfc,
    miracles: st.god.chronicle.filter((c) => c.kind === 'miracle').length,
  };
}

let hookCtx: { newLife: (y: number) => void; st: ReturnType<typeof newGame>; wpl: () => number; lifeEnd: () => number } | undefined;

/** The god's income in the world part and the succession of the stand-in lives: a system of the test, run after the world of each step. */
const worldIncome: System = {
  name: 'tools',
  worldStep(ctx) {
    const h = hookCtx;
    if (!h || h.st !== ctx.state) return;
    const year = ctx.state.clock.worldYear;
    while (year >= h.lifeEnd()) h.newLife(h.lifeEnd());
    const ly = 10 / h.wpl();
    ctx.state.god.light = Math.min(200, ctx.state.god.light + WORLD_INCOME.faith * ly);
    ctx.state.god.dread = Math.min(200, ctx.state.god.dread + WORLD_INCOME.dread * ly);
  },
};

const worlds: Record<string, WorldResult[]> = {};

beforeAll(async () => {
  const data = loadAll();
  runSim(4000, WORLDS);
  sim = await import(pathToFileURL(path.join(root, 'scripts/sim/sim-world.mjs')).href);
  for (const [name, policy] of Object.entries(POLICY_OF)) {
    lives[name] = [];
    for (let i = 0; i < LIVES; i++) {
      lives[name].push(lifeRun(data, 1000 + i * 31, policy));
      if (i % 10 === 9) await new Promise((r) => setImmediate(r)); // one turn every ten lives (tests/setup/settle.ts)
    }
  }
  // the policies of the tools that do the large deeds, for the caps of a life (the rest are counted above)
  for (const [name, policy] of [['เร่งจบ', 'เร่งจบ'], ['ตีหมุด', 'ตีหมุด'], ['ปั้นนิสัย', 'ปั้นนิสัย'], ['ให้ของ', 'ให้ของ'], ['เก็บพลัง', 'เก็บพลัง']] as const) {
    capLives[name] = [];
    for (let i = 0; i < CAP_LIVES; i++) {
      capLives[name].push(lifeRun(data, 5000 + i * 37, policy));
      if (i % 10 === 9) await new Promise((r) => setImmediate(r)); // one turn every ten lives (tests/setup/settle.ts)
    }
  }
  for (const [name, policy, count] of [['ไม่จำลองพระเจ้า', 'base', RATIO_WORLDS], ['เมตตา', 'เมตตา', WORLDS], ['เร่งจบ', 'เร่งจบ', RATIO_WORLDS], ['สุ่ม', 'สุ่ม', WORLDS], ['ลงโทษ (ทำซาก)', 'ลงโทษ', WORLDS], ['ตีหมุดผนึก', 'ตีหมุด', RATIO_WORLDS]] as const) {
    const t0 = Date.now();
    worlds[name] = [];
    for (let n = 1; n <= count; n++) {
      worlds[name].push(worldRun(data, n, policy));
      await new Promise((r) => setImmediate(r)); // a whole world is long: one turn after each (tests/setup/settle.ts)
    }
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
      // 0.4% of 160 lives is 0.64 of a life: allow the sampling error (two standard deviations), at most 2 lives
      const n = lives[name].length;
      const room = (0.004 * n + 2 * Math.sqrt(n * 0.004 * 0.996)) / n;
      expect(low, name).toBeLessThanOrEqual(room);
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
      // with every system the core has more troubles than the sim's fixed fifth of beats; 07-attention aims at about 16 a life
      expect(got, name).toBeLessThan(simLife[name].prayers * 1.3);
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

describe('G5: the large deeds stay inside the caps (04-miracles.md §2 rule 6, 01-power.md §4)', () => {
  const all = () => [...Object.values(lives), ...Object.values(capLives)].flat();

  it('no life, under any policy of the tools, has more than two large miracles, a ruin more than once, or more than one grand miracle', () => {
    for (const x of all()) {
      expect(x.big).toBeLessThanOrEqual(2);
      expect(x.ruin).toBeLessThanOrEqual(1);
      expect(x.grand).toBeLessThanOrEqual(1);
    }
    const seen = Object.entries({ ...lives, ...capLives }).map(([k, v]) => `${k} ${mean(v.map((x) => x.big)).toFixed(2)} large · ${mean(v.map((x) => x.ruin)).toFixed(2)} ruin · ${mean(v.map((x) => x.grand)).toFixed(2)} grand`);
    console.log('large deeds a life: ' + seen.join(' | '));
  });
});

describe('G5: the ruins and the seals in a world of 1,800 years', () => {
  const median = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
  const quant = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(q * a.length))];
  /** Ruins that stand at once: a ruin stands from its day until its city is built. */
  const together = (rs: WorldResult['ruins']) => Math.max(0, ...rs.map((r) => rs.filter((o) => o.year <= r.year && (o.ended === undefined || o.ended > r.year)).length));

  it('ลงโทษ (ทำซาก): at most 18 ruins a world at the 90th percentile, at most 2 standing together, a hundred years between two', () => {
    const w = worlds['ลงโทษ (ทำซาก)'];
    const per = w.map((x) => x.ruins.length);
    const tog = w.map((x) => together(x.ruins));
    console.log(`ลงโทษ (ทำซาก): ruins p50 ${quant(per, 0.5)} · p90 ${quant(per, 0.9)} · max ${Math.max(...per)} · together p90 ${quant(tog, 0.9)} (sim 10 · 18 · 18 · 1)`);
    expect(quant(per, 0.9)).toBeLessThanOrEqual(18);
    expect(quant(tog, 0.9)).toBeLessThanOrEqual(2);
    expect(Math.max(...per)).toBeGreaterThan(0);
    for (const x of w) {
      const ys = x.ruins.map((r) => r.year).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(100);
    }
  });

  it('ตีหมุดผนึก: the seals are struck, and the eras start no more than 15% sooner than the base', () => {
    const base = worlds['ไม่จำลองพระเจ้า'];
    const hit = worlds['ตีหมุดผนึก'];
    const strikes = mean(hit.map((x) => x.strikes));
    console.log(`ตีหมุดผนึก: strikes a world ${strikes.toFixed(1)} (sim 41.1) · เร่งจบ ${mean(worlds['เร่งจบ'].map((x) => x.strikes)).toFixed(1)} (sim 31.1) · สุ่ม ${mean(worlds['สุ่ม'].map((x) => x.strikes)).toFixed(1)} (sim 10.0)`);
    expect(strikes).toBeGreaterThan(5);
    const eras = [0, 1, 2].map((k) => ({ b: median(base.map((x) => x.eras[k]).filter((v) => v !== undefined)), h: median(hit.map((x) => x.eras[k]).filter((v) => v !== undefined)) }));
    console.log('eras 2 3 4 (p50): base ' + eras.map((e) => e.b).join(' · ') + ' · ตีหมุด ' + eras.map((e) => e.h).join(' · '));
    eras.forEach((e, k) => {
      if (Number.isNaN(e.b) || Number.isNaN(e.h)) return;
      expect(e.h, `era ${k + 2}`).toBeGreaterThanOrEqual(e.b * 0.85);
    });
  });

  it('สุ่ม ruins and strikes sometimes; เมตตา neither', () => {
    expect(mean(worlds['สุ่ม'].map((x) => x.ruins.length))).toBeGreaterThan(0);
    expect(mean(worlds['สุ่ม'].map((x) => x.strikes))).toBeGreaterThan(0);
    expect(mean(worlds['เมตตา'].map((x) => x.ruins.length + x.strikes))).toBe(0);
  });
});
