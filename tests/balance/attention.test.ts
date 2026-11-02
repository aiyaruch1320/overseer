// Balance targets of the attention system (07-attention.md §5, code-plan §7 row "attention"): five numbers on whole lives of the core.
//   stops per full life 6 to 10 · cards per full life 12 to 22 · lives with more than 2 calls inside two minutes at most 10% ·
//   the longest silence (p90) at most 6 minutes · cards that ran out (not prayers) at most 3 per life.
// Time is the doc's: real seconds at normal speed, a full life 35 minutes. The lives are the real core's (world, character, npc, story,
// text, and the god system when `allSystems()` has it). Prayers (god) and stage 3 crises (bonds) are triggers of systems that are not
// written yet: until they are, a stand-in writes them at the rates the sim uses (`ATTN` rates in scripts/sim/sim-attention.mjs), and the
// real-core run, which lacks them, is checked on the targets it can reach. `node scripts/sim/sim-attention.mjs` is the other side.
// Run: npx vitest run --config vitest.balance.config.ts tests/balance/attention.test.ts   (ATTENTION_LIVES=300 for more lives)
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, startLife, runToDeath } from '../../scripts/tools/session';
import { SEC_PER_YEAR, attentionSystem, callsOf } from '../../src/core/attention';
import { sortSystems, type GameData, type System } from '../../src/core/game';
import { write } from '../../src/core/log';
import { allSystems } from '../../src/core/systems';
import type { Settings } from '../../src/core/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LIVES = Number(process.env.ATTENTION_LIVES ?? 150);
const S = SEC_PER_YEAR;

const hasGod = allSystems().some((s) => s.name === 'god' || s.name === 'god.acts'); // prayers come from god.acts
const hasBonds = allSystems().some((s) => s.name === 'bonds');

// ---------- stand-ins for the systems that are not written yet (rates of the sim) ----------

/** Prayers: the sim draws 0.196 × 75 of them over life years 4 to 75 (`prayerTick`: four ticks a year, trouble in 20% of them). */
const standInGod: System = {
  name: 'god',
  beat(ctx) {
    const l = ctx.state.life!;
    if (l.hAge >= 4 && ctx.rng('test.attention.prayer').chance((0.196 * 75) / 71 / 4)) write(ctx.state, { sys: 'god', kind: 'prayer', id: `pr.${ctx.state.logN}`, level: 2, data: {} });
  },
};
/** Crises of stage 3 of a bond and bondage escapes: 1.5 a life between 15 and 70 (the doc says the rate is an assumption). */
const standInBonds: System = {
  name: 'bonds',
  beat(ctx) {
    const l = ctx.state.life!;
    if (l.hAge >= 15 && l.hAge < 70 && ctx.rng('test.attention.crisis').chance(1.5 / 55 / 4)) write(ctx.state, { sys: 'bonds', kind: 'crisis', id: `cr.${ctx.state.logN}`, level: 2, data: {} });
  },
};

// ---------- one life ----------

interface Life {
  stops: number;
  cards: number;
  burst: number;
  quiet: number;
  minutes: number;
  lost: number;
  lostPrayers: number;
  lostBy: Record<string, number>;
  glows: number;
  folded: number;
  windows: number;
  deathAge: number;
}

function playLife(data: GameData, seed: number, setting: Settings['attention'], standIns: boolean): Life {
  const s = createSession(data, { seed });
  const g = s.game;
  const extra = [attentionSystem, ...(standIns && !hasGod ? [standInGod] : []), ...(standIns && !hasBonds ? [standInBonds] : [])].filter((x) => !g.systems.some((y) => y.name === x.name));
  g.systems.splice(0, g.systems.length, ...sortSystems([...g.systems, ...extra]));
  g.state.settings.attention = setting;
  const mark = g.state.logN;
  startLife(s);
  const born = g.state.life!.hAge * S; // three peoples wake at life year 17 (world-time.md §5): their life is shorter and starts there
  runToDeath(g);
  const log = g.state.log.filter((e) => e.n >= mark);
  const calls = callsOf(log);
  const death = g.state.life!.dead!.hAge * S;
  const secs = calls.map((c) => c.data.sec as number).sort((a, b) => a - b);
  let burst = 0; // most calls inside any two minutes
  for (let k = 0; k < secs.length; k++) {
    let n = 0;
    for (let j = k; j < secs.length && secs[j] - secs[k] < 120; j++) n++;
    burst = Math.max(burst, n);
  }
  const edges = [born, ...secs, death];
  const quiet = Math.max(...edges.slice(1).map((x, i) => x - edges[i]));
  const missed = log.filter((e) => e.sys === 'attention' && e.kind === 'missed');
  return {
    stops: calls.filter((c) => c.data.call === 'stop').length,
    cards: calls.filter((c) => c.data.call === 'card').length,
    burst,
    quiet,
    minutes: (death - born) / 60,
    lost: missed.filter((e) => e.data.kind !== 'prayer').length,
    lostPrayers: missed.filter((e) => e.data.kind === 'prayer').length,
    lostBy: missed.reduce<Record<string, number>>((a, e) => ({ ...a, [String(e.data.kind)]: (a[String(e.data.kind)] ?? 0) + 1 }), {}),
    glows: log.filter((e) => e.sys === 'attention' && e.kind === 'glow').length,
    folded: calls.reduce((a, c) => a + String(c.data.cards).split(',').filter(Boolean).length * (c.data.call === 'stop' ? 1 : 0), 0),
    windows: log.filter((e) => e.sys === 'story' && e.kind === 'node' && e.level >= 3).length,
    deathAge: g.state.life!.dead!.hAge,
  };
}

const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/** The five numbers as the sim computes them: a life shorter than 30 minutes counts as a typical one for the two count targets. */
function targets(lives: Life[]) {
  return {
    stops: q(lives.map((l) => (l.minutes > 30 ? l.stops : 8)), 0.5),
    cards: q(lives.map((l) => (l.minutes > 30 ? l.cards : 15)), 0.5),
    burst: mean(lives.map((l) => (l.burst > 2 ? 1 : 0))),
    quietP90: q(lives.map((l) => l.quiet), 0.9) / 60,
    lost: mean(lives.map((l) => l.lost)),
    // not targets, for the report
    stopsRaw: mean(lives.map((l) => l.stops)),
    cardsRaw: mean(lives.map((l) => l.cards)),
    glows: mean(lives.map((l) => l.glows)),
    folded: mean(lives.map((l) => l.folded)),
    windows: mean(lives.map((l) => l.windows)),
    lostBy: Object.fromEntries(['omen', 'battle', 'crisis', 'majorOmen', 'prayer'].map((k) => [k, mean(lives.map((l) => l.lostBy[k] ?? 0))])),
    full: mean(lives.map((l) => (l.minutes > 30 ? 1 : 0))),
  };
}
type T = ReturnType<typeof targets>;

const pass = {
  stops: (t: T) => t.stops >= 6 && t.stops <= 10,
  cards: (t: T) => t.cards >= 12 && t.cards <= 22,
  burst: (t: T) => t.burst <= 0.1,
  quiet: (t: T) => t.quietP90 <= 6,
  lost: (t: T) => t.lost <= 3,
};

/** The five target rows the sim prints (`node scripts/sim/sim-attention.mjs`), in the doc's order: stops, cards, busy lives (share), silence p90 (minutes), lost cards. */
function simTargets(): number[] {
  const out = execFileSync('node', ['scripts/sim/sim-attention.mjs', '3000'], { cwd: root, encoding: 'utf8' });
  const at = out.indexOf('**เป้า**');
  const rows = out
    .slice(at)
    .split('\n')
    .filter((l) => /^\| .+ \| .+ \| [\d.]+%? \| (ผ่าน|\*\*ไม่ผ่าน\*\*) \|$/.test(l));
  return rows.map((l) => {
    const cell = l.split('|')[3].trim();
    return cell.endsWith('%') ? Number(cell.slice(0, -1)) / 100 : Number(cell);
  });
}

let data: GameData;
const results: Record<string, Life[]> = {};
const run = (key: string, setting: Settings['attention'], standIns: boolean) => (results[key] ??= Array.from({ length: LIVES }, (_, i) => playLife(data, i + 1, setting, standIns)));

beforeAll(() => {
  data = loadAll();
});

const fmt = (t: T) =>
  `หยุด p50 ${t.stops} (ดิบ ${t.stopsRaw.toFixed(1)}) · การ์ด p50 ${t.cards} (ดิบ ${t.cardsRaw.toFixed(1)}) · เกิน 2 ใน 2 นาที ${(100 * t.burst).toFixed(0)}% · เงียบ p90 ${t.quietP90.toFixed(1)} นาที · ไม่ทันขึ้น ${t.lost.toFixed(2)} · เรือง ${t.glows.toFixed(1)} · พับเข้าหน้าหยุด ${t.folded.toFixed(1)} · หน้าต่าง ${t.windows.toFixed(1)} · ไม่ทันแยกชนิด ${JSON.stringify(Object.fromEntries(Object.entries(t.lostBy).map(([k, v]) => [k, +v.toFixed(2)])))}`;

describe('attention: the five targets on the lives of the core (07-attention.md §5)', () => {
  it('with prayers and crises written at the sim rates, the setting normal passes all five', () => {
    const t = targets(run('normal+', 'normal', true));
    console.log(`[attention] ${LIVES} ชีวิตจริงของแกน + คำอธิษฐาน/วิกฤตแทน (ปกติ): ${fmt(t)}`);
    expect(pass.stops(t), `stops ${t.stops}`).toBe(true);
    expect(pass.cards(t), `cards ${t.cards}`).toBe(true);
    expect(pass.burst(t), `burst ${t.burst}`).toBe(true);
    expect(pass.quiet(t), `quiet ${t.quietP90}`).toBe(true);
    expect(pass.lost(t), `lost ${t.lost}`).toBe(true);
  });

  it('the three settings keep their order on the same lives: low calls least, high most', () => {
    const low = targets(run('low+', 'low', true)), normal = targets(run('normal+', 'normal', true)), high = targets(run('high+', 'high', true));
    console.log(`[attention] น้อย: ${fmt(low)}\n[attention] มาก: ${fmt(high)}`);
    expect(low.stopsRaw).toBeLessThanOrEqual(normal.stopsRaw);
    expect(normal.stopsRaw).toBeLessThanOrEqual(high.stopsRaw);
    expect(low.cardsRaw).toBeLessThan(normal.cardsRaw);
    expect(normal.cardsRaw).toBeLessThan(high.cardsRaw);
    // low is the quiet setting: stops are the age stops and the death scene, the window only glows
    expect(low.stopsRaw).toBeLessThan(7);
    expect(low.burst).toBeLessThanOrEqual(0.1);
    // high is the busy one and says so (the sim: 98% of the lives have a busy two minutes)
    expect(high.burst).toBeGreaterThan(normal.burst);
  });

  it('the real core alone, without prayers and crises: the targets it can reach pass', () => {
    const t = targets(run('normal', 'normal', false));
    console.log(`[attention] ${LIVES} ชีวิตจริงของแกนล้วน ยังไม่มีระบบพระเจ้า/พวกพ้อง (ปกติ): ${fmt(t)}`);
    expect(pass.stops(t), `stops ${t.stops}`).toBe(true);
    expect(pass.burst(t), `burst ${t.burst}`).toBe(true);
    expect(pass.lost(t), `lost ${t.lost}`).toBe(true);
  });

  // The cards and the silence need the triggers that only the god system (16 prayers a life) and the bonds system bring. When `allSystems()`
  // holds the god system this test starts to run on its own and the core has to reach the targets without the stand-ins.
  it.runIf(hasGod)('the real core with the god system: cards and silence pass', () => {
    const t = targets(run('normal', 'normal', false));
    expect(pass.cards(t), `cards ${t.cards}`).toBe(true);
    expect(pass.quiet(t), `quiet ${t.quietP90}`).toBe(true);
  });
  it.skipIf(hasGod)('the real core without the god system is short of cards and silence (waiting for G3 prayers)', () => {
    const t = targets(run('normal', 'normal', false));
    console.log(`[attention] ไม่ผ่านเพราะยังไม่มีระบบพระเจ้า: การ์ด p50 ${t.cards} (เป้า 12 ถึง 22) · เงียบ p90 ${t.quietP90.toFixed(1)} นาที (เป้า ไม่เกิน 6)`);
    expect(pass.cards(t)).toBe(false);
  });
});

describe('attention: the core against the sim', () => {
  it('prints both sides and keeps the stop count within two of the sim', () => {
    const sim = simTargets();
    const t = targets(run('normal+', 'normal', true));
    console.log(`[attention] sim (3000 ชีวิต): หยุด ${sim[0]} การ์ด ${sim[1]} เกิน2 ${(100 * sim[2]).toFixed(0)}% เงียบ ${sim[3]} ไม่ทัน ${sim[4]}\n[attention] แกน (+แทน): หยุด ${t.stops} การ์ด ${t.cards} เกิน2 ${(100 * t.burst).toFixed(0)}% เงียบ ${t.quietP90.toFixed(1)} ไม่ทัน ${t.lost.toFixed(2)}`);
    expect(sim).toHaveLength(5);
    expect(Math.abs(t.stops - sim[0])).toBeLessThanOrEqual(2);
    expect(Math.abs(t.cards - sim[1])).toBeLessThanOrEqual(4);
  });
});
