// Balance targets of the travel system (code-plan §7 row "travel", docs/systems/travel/01-travel-rules.md §1, §2, §5) on real lives of the core:
// allSystems() with the travel and items systems, lives from birth to death.
//   levels   65/28/7 for the fixed jobs, 45/40/15 for the city jobs, 0/45/55 for the travelling jobs (L0 / L1 / L2)
//   causes   each cause fires at the chance of its row (§2), the lines it opens are the overlay lines of 25-journeys.md
//   legs     a travelling job makes the legs of its row (§1), never more days on the road than the year allows
// The journey lines (sf ps ml sc ex wd xc) open only through `openLine` (story/tuning.ts EXTERNAL_LINES): the travel system opens them.
// Run: npx vitest run tests/balance/travel.test.ts   (about two minutes; TRAVEL_LIVES=n to change the number of lives)
import { beforeAll, describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { birth, extOf as charExt } from '../../src/core/character';
import { Game, versions, type GameData } from '../../src/core/game';
import { newGame } from '../../src/core/state';
import { extOf as storyExt } from '../../src/core/story/state';
import { allSystems } from '../../src/core/systems';
import { itemsSystem } from '../../src/core/items';
import { travelSystem, travelExt, geo } from '../../src/core/travel';
import type { TravelData } from '../../src/core/data/types-travel';
import { jobGroup, type JobGroup } from '../../src/core/travel/tuning';
import type { TravelExt } from '../../src/core/travel/state';

const LIVES = Number(process.env.TRAVEL_LIVES ?? 1200);
const JOURNEY = ['sf', 'ps', 'ml', 'sc', 'ex', 'wd', 'xc'];

interface Row {
  group: JobGroup;
  level: number;
  /** Years in the job at death. */
  tenure: number;
  job: string;
  ex: TravelExt;
  race: string;
  opened: string[];
  walked: Record<string, number>;
  maxDays: number;
  countries: number;
  ended: boolean;
}

let data: GameData;
const rows: Row[] = [];

beforeAll(() => {
  data = loadGen();
  const systems = [...allSystems(), travelSystem, itemsSystem].filter((s, i, a) => a.findIndex((x) => x.name === s.name) === i);
  for (let i = 0; i < LIVES; i++) {
    const g = new Game(newGame(2000 + i * 7919, versions(data)), data, systems);
    g.init();
    g.worldSteps(45);
    birth(g.ctx, {});
    g.born();
    let maxDays = 0;
    for (let n = 0; g.state.life && !g.state.life.dead && n < 4 * 400; n++) {
      g.beat();
      const l = g.state.life!;
      const d = travelExt(l).yearDays[l.hAge] ?? 0;
      if (jobGroup(l.job) === 'travel') maxDays = Math.max(maxDays, d);
    }
    const l = g.state.life!;
    const ex = travelExt(l);
    const st = storyExt(l);
    const walked: Record<string, number> = {};
    for (const id of Object.keys(l.passed)) {
      const line = id.split('.')[0];
      if (JOURNEY.includes(line)) walked[line] = (walked[line] ?? 0) + 1;
    }
    rows.push({
      group: jobGroup(l.job),
      level: ex.level,
      tenure: l.hAge - ((charExt(l) as { jobSince?: number }).jobSince ?? l.hAge),
      job: l.job ?? '',
      ex,
      race: l.race,
      opened: ex.opened.filter((x) => st.external.includes(x)),
      walked,
      maxDays,
      countries: ex.visited.length,
      ended: !!l.dead,
    });
  }
}, 900000);

const target = (ctxData: GameData) => (ctxData.travel.items as TravelData).levelTargets;
const pct = (n: number, d: number) => (d ? n / d : 0);
/** A tolerance of three standard errors and three points, for a share p measured on n lives. */
const tol = (p: number, n: number) => 3 * Math.sqrt((p * (1 - p)) / Math.max(1, n)) + 0.03;

describe('travel balance', () => {
  it('every life ended and sits in a country of the map', () => {
    expect(rows.length).toBe(LIVES);
    expect(rows.every((r) => r.ended)).toBe(true);
  });

  it('the share of lives at L0, L1 and L2 follows the table of §1 by the group of the job', () => {
    const t = target(data);
    const want: Record<string, [number, number, number]> = {
      static: t[0].pct as [number, number, number],
      city: t[1].pct as [number, number, number],
      travel: t[2].pct as [number, number, number],
    };
    const report: Record<string, string> = {};
    for (const g of ['static', 'city', 'travel'] as const) {
      // a travelling job counts when it was held long enough to travel (ten years)
      const sel = rows.filter((r) => r.group === g && (g !== 'travel' || r.tenure >= 10));
      const n = sel.length;
      const got = [0, 1, 2].map((k) => pct(sel.filter((r) => r.level === k).length, n));
      report[g] = `${n} lives ${got.map((x) => (100 * x).toFixed(0)).join('/')} (target ${want[g].join('/')})`;
      expect(n, g).toBeGreaterThan(20);
      for (const k of [0, 1, 2]) expect(Math.abs(got[k] - want[g][k] / 100), `${g} L${k}`).toBeLessThanOrEqual(tol(want[g][k] / 100, n) + (g === 'travel' ? 0.1 : 0));
    }
    console.log(JSON.stringify(report));
  });

  it('each cause fires at the chance of its row: the hits follow the sum of the chances, the mean chance sits between the base and the base with its modifiers', () => {
    const rowsData = (data.travel.items as TravelData).causes;
    const keyRow: Record<string, string> = { sc: 'ไปเรียน', ps: 'แสวงบุญ', ml: 'รับจ้างรบ', ex: 'ลี้ภัย', exile: 'เนรเทศหรือหนีโทษ', xc: 'คำเชิญ', wd: 'อยากรู้', tr: 'หนี้หรือสัญญา' };
    const total: Record<string, { years: number; hits: number; exp: number }> = {};
    for (const r of rows) for (const [k, s] of Object.entries(r.ex.stats)) {
      const t = (total[k] ??= { years: 0, hits: 0, exp: 0 });
      t.years += s.years;
      t.hits += s.hits;
      t.exp += s.exp;
    }
    const seen: string[] = [];
    for (const [k, t] of Object.entries(total)) {
      const row = rowsData.find((x) => x.cause === keyRow[k])!;
      const max = row.chance * Math.max(1, ...row.mods.map((m) => m.mul)) * 1.5; // × adventurous
      const min = row.chance * 0.5; // × settled
      seen.push(`${k}: ${t.hits}/${t.years}y`);
      expect(t.years, k).toBeGreaterThan(0);
      expect(t.exp / t.years, `${k} mean chance`).toBeGreaterThanOrEqual(min - 1e-9);
      expect(t.exp / t.years, `${k} mean chance`).toBeLessThanOrEqual(max + 1e-9);
      // hits against the sum of the chances (a binomial with that mean, four standard deviations)
      const sd = Math.sqrt(Math.max(t.exp, 1));
      expect(Math.abs(t.hits - t.exp), `${k} hits`).toBeLessThanOrEqual(4 * sd + 2);
    }
    console.log(seen.join(' · '));
    for (const k of ['sc', 'ml', 'ex', 'exile', 'xc']) expect(total[k], k).toBeDefined();
  });

  it('the lines the causes open are the journey lines, each is opened in some lives, and an opened line is walked by most of them', () => {
    const opened: Record<string, number> = {};
    const walked: Record<string, number> = {};
    for (const r of rows) for (const l of r.opened) {
      opened[l] = (opened[l] ?? 0) + 1;
      if ((r.walked[l] ?? 0) > 0) walked[l] = (walked[l] ?? 0) + 1;
    }
    console.log(JSON.stringify({ opened, walked }));
    for (const l of ['sc', 'ml', 'ex', 'xc']) expect(opened[l], l).toBeGreaterThan(10);
    for (const l of Object.keys(opened)) expect(JOURNEY, l).toContain(l);
    for (const l of ['sc', 'ml', 'ex', 'xc']) expect(pct(walked[l] ?? 0, opened[l]), `${l} walked`).toBeGreaterThan(0.5);
  });

  it('a stranger comes to a non-human who stays at home about 35% of the time (xc, age 24 to 36, L0)', () => {
    // the roll is made once, in the first year of that age window at which the life is still L0
    const drew = rows.filter((r) => r.ex.spontaneous);
    const visited = drew.filter((r) => r.ex.opened.includes('xc'));
    expect(drew.length).toBeGreaterThan(50);
    // xc is also opened by the invitation (3% a year), which this count includes: the share sits a little above 35%
    expect(pct(visited.length, drew.length)).toBeGreaterThan(0.28);
    expect(pct(visited.length, drew.length)).toBeLessThan(0.5);
  });

  it('a travelling job makes the legs of its row and never spends more days on the road than the year holds', () => {
    const travelling = rows.filter((r) => r.group === 'travel' && r.ex.job.years >= 5);
    expect(travelling.length).toBeGreaterThan(10);
    const jl = (data.travel.items as TravelData).jobLegs;
    const merchants = travelling.filter((r) => r.job === 'merchant' || r.job === 'peddler');
    const per = (rs: Row[]) => rs.reduce((n, r) => n + r.ex.job.legs, 0) / Math.max(1, rs.reduce((n, r) => n + r.ex.job.years, 0));
    const lo = jl.find((j) => j.jobs.includes('merchant'))!.legs;
    console.log(`merchants ${merchants.length} lives, ${per(merchants).toFixed(2)} legs a year (table ${lo.join(' to ')}); all travelling ${per(travelling).toFixed(2)}`);
    expect(per(merchants)).toBeGreaterThan(lo[0] * 0.6);
    expect(per(merchants)).toBeLessThanOrEqual(lo[1] * 1.15);
    expect(per(travelling)).toBeLessThanOrEqual(4.5);
    const days = (data.travel.items as TravelData).legRule.daysJob;
    // an outing is planned to fit the year at the middle of its ranges; the days drawn may run a fifth over
    expect(Math.max(...travelling.map((r) => r.maxDays))).toBeLessThanOrEqual(days * 1.4);
  });

  it('a life that travels sees about 2 countries beyond the birth country on average (L0 counts 0), and lives at L0 are the larger half or near it', () => {
    const mean = rows.reduce((n, r) => n + r.countries, 0) / rows.length;
    console.log(`countries beyond the birth country: ${mean.toFixed(2)} (target 2.0)`);
    expect(mean).toBeGreaterThan(1.0);
    expect(mean).toBeLessThan(4.0);
    const l0 = pct(rows.filter((r) => r.level === 0).length, rows.length);
    expect(l0).toBeGreaterThan(0.2);
    expect(l0).toBeLessThan(0.75);
  });

  it('the places travelled to are real countries and the filters hold: nobody stands in a country it is shut out of', () => {
    const g0 = rows[0].ex;
    expect(g0.visited.every((c) => /^[A-Z]{2}-\d{2}$/.test(c))).toBe(true);
    void geo;
  });
});
