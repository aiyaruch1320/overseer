// Balance targets of the items system (code-plan §7 row "items", `node scripts/sim/sim-items.mjs`):
//   tools     payback of a life tool by tier and wealth W, and the gold it returns over its life (19-prices.md §8)
//   talisman  ancient talismans in NPC hands: how many are in omen or possession at once (20-npc-talisman.md §11)
// then real lives of the core (allSystems() with the travel and items systems): what a character buys, forges and holds.
// Run: npx vitest run tests/balance/items.test.ts   (about a minute; ITEM_LIVES=n to change the number of lives)
import { beforeAll, describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { birth } from '../../src/core/character';
import { Game, versions, type GameData } from '../../src/core/game';
import { detached } from '../../src/core/rng';
import { newGame } from '../../src/core/state';
import { allSystems } from '../../src/core/systems';
import { activeCount, armorOf, bonusOf, catalog, initTalismans, itemsExt, itemsSystem, itemsWorld, itemsTuning, talismanYear, wielded } from '../../src/core/items';
import type { ItemsExt } from '../../src/core/items';
import { travelSystem } from '../../src/core/travel';

const data: GameData = loadGen();
const LIVES = Number(process.env.ITEM_LIVES ?? 400);

// ---------- tools: the model of sim-items.mjs `tools`, with the numbers of the code ----------

/** The rows `node scripts/sim/sim-items.mjs tools` prints: tier, W, median payback (years), p90, return over the life. */
const TOOL_TABLE: [string, number, number, number, number][] = [
  ['C', 1, 10, 11, 1.5], ['C', 2, 9, 9, 1.85], ['C', 3, 8, 8, 2.1], ['C', 4, 7, 7, 2.45], ['C', 5, 6, 7, 2.66],
  ['U', 1, 16, 17, 1.63], ['U', 2, 13, 14, 2.02], ['U', 3, 11, 12, 2.29], ['U', 4, 10, 11, 2.67], ['U', 5, 9, 10, 2.91],
  ['R', 1, 16, 17, 2.57], ['R', 2, 13, 14, 3.18], ['R', 3, 12, 12, 3.6], ['R', 4, 10, 11, 4.2], ['R', 5, 9, 10, 4.56],
];

describe('items balance: life tools (sim-items tools)', () => {
  it('a tool pays back in the years of the table of 19-prices.md §8 and returns what it says over its life', () => {
    const ctx = new Game(newGame(1), data, [itemsSystem]).ctx;
    const c = catalog(ctx);
    const P = c.itemData.prices;
    const rnd = detached(12345);
    const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))];
    const RUNS = 2000;
    const seen: string[] = [];
    for (const [tier, w, med, p90, ret] of TOOL_TABLE) {
      // a tool of the tier that serves farming; its price is the W3 price, its bonus is read from its text by the code
      const tool = c.itemList.find((i) => i.cat === 'tool' && i.apt === 'farming' && i.tier === tier)!;
      const bonus = bonusOf(tool);
      const base = P.incomeBase[tier];
      const price = tool.price! * P.priceIndexW[w - 1];
      const life = itemsTuning.TOOL_LIFE[tier];
      const pays: number[] = [];
      let total = 0;
      for (let r = 0; r < RUNS; r++) {
        let gain = 0;
        let paid: number | null = null;
        for (let y = 1; y <= life; y++) {
          gain += base * P.incomeIndexW[w - 1] * bonus * (0.7 + 0.6 * rnd.next());
          if (paid === null && gain >= price) paid = y;
        }
        pays.push(paid ?? life + 1);
        total += gain / price;
      }
      const got = [pct(pays, 0.5), pct(pays, 0.9), total / RUNS];
      seen.push(`${tier}${w} ${got[0]}/${got[1]}/${got[2].toFixed(2)}`);
      expect(Math.abs(got[0] - med), `${tier} W${w} median`).toBeLessThanOrEqual(1);
      expect(Math.abs(got[1] - p90), `${tier} W${w} p90`).toBeLessThanOrEqual(1);
      expect(Math.abs(got[2] - ret), `${tier} W${w} return`).toBeLessThanOrEqual(0.12);
      // every tool pays back before it wears out, at every W (19-prices.md §8)
      expect(got[0]).toBeLessThan(life);
      expect(got[2]).toBeGreaterThan(1.4);
    }
    console.log(seen.join(' · '));
  });
});

// ---------- talismans ----------

interface Run {
  active: number[];
  found: number;
  sold: number;
  buried: number;
  accepted: number;
}

function talismans(cap: number, runs: number, years: number): Run {
  const out: Run = { active: [], found: 0, sold: 0, buried: 0, accepted: 0 };
  for (let r = 0; r < runs; r++) {
    const g = new Game(newGame(900 + r), data, [itemsSystem]);
    const { ctx } = g;
    initTalismans(ctx);
    const rng = ctx.rng('items.talisman');
    for (let y = 0; y < years; y++) {
      talismanYear(ctx, rng, cap, false);
      out.active.push(activeCount(itemsWorld(ctx).talisman));
    }
    const t = itemsWorld(ctx).talisman;
    out.found += t.found;
    out.sold += t.sold;
    out.buried += t.buried;
    out.accepted += t.accepted;
  }
  return out;
}

const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
const share = (a: number[], over: number) => a.filter((v) => v > over).length / a.length;

describe('items balance: ancient talismans in NPC hands (sim-items talisman)', () => {
  it('without a cap the system measures what the document measured: 5.0 in omen or possession on average, p95 9, 23% of years above 6, 5% above 8, under 1% above 10', () => {
    const RUNS = 300;
    const YEARS = 1000;
    const r = talismans(Infinity, RUNS, YEARS);
    const a = sorted(r.active);
    const mean = r.active.reduce((x, y) => x + y, 0) / r.active.length;
    const per = (n: number) => n / RUNS / (YEARS / 100);
    console.log(`mean ${mean.toFixed(2)} p95 ${a[Math.floor(0.95 * a.length)]} p99 ${a[Math.floor(0.99 * a.length)]} max ${a[a.length - 1]} · over 6 ${(100 * share(a, 6)).toFixed(1)}% over 8 ${(100 * share(a, 8)).toFixed(1)}% over 10 ${(100 * share(a, 10)).toFixed(2)}% · a century: found ${per(r.found).toFixed(1)} sold ${per(r.sold).toFixed(1)} buried ${per(r.buried).toFixed(1)} accepted ${per(r.accepted).toFixed(1)}`);
    expect(mean).toBeGreaterThan(4.6);
    expect(mean).toBeLessThan(5.4);
    expect(a[Math.floor(0.95 * a.length)]).toBeGreaterThanOrEqual(8);
    expect(a[Math.floor(0.95 * a.length)]).toBeLessThanOrEqual(10);
    expect(Math.abs(share(a, 6) - 0.23)).toBeLessThan(0.05);
    expect(Math.abs(share(a, 8) - 0.052)).toBeLessThan(0.03);
    expect(share(a, 10)).toBeLessThan(0.02);
    expect(Math.abs(per(r.found) - 11.5)).toBeLessThan(2);
    expect(Math.abs(per(r.sold) - 39.5)).toBeLessThan(5);
    expect(Math.abs(per(r.buried) - 9.8)).toBeLessThan(2);
    expect(Math.abs(per(r.accepted) - 5.1)).toBeLessThan(1.5);
  });

  it('with the ceiling of 10 (§2) it is never above 10 and the average hardly moves', () => {
    const r = talismans(10, 120, 1000);
    const mean = r.active.reduce((x, y) => x + y, 0) / r.active.length;
    expect(r.active.reduce((m, v) => Math.max(m, v), 0)).toBeLessThanOrEqual(10);
    expect(mean).toBeGreaterThan(4.4);
    expect(mean).toBeLessThan(5.3);
  });
});

// ---------- real lives ----------

interface Life {
  ex: ItemsExt;
  tier: string;
  unskilled: boolean;
  everyday: boolean;
  armor: number;
  gold: number;
  items: number;
  race: string;
  outcomes: string[];
  forgeNeeds: number;
  legend: number;
  adult: boolean;
}

const lives: Life[] = [];

describe('items balance: lives', () => {
  beforeAll(() => {
    const systems = [...allSystems(), travelSystem, itemsSystem].filter((s, i, a) => a.findIndex((x) => x.name === s.name) === i);
    for (let i = 0; i < LIVES; i++) {
      const g = new Game(newGame(7000 + i * 7919, versions(data)), data, systems);
      g.init();
      g.worldSteps(45);
      birth(g.ctx, {});
      g.born();
      for (let n = 0; g.state.life && !g.state.life.dead && n < 4 * 400; n++) g.beat();
      const l = g.state.life!;
      const w = wielded(g.ctx);
      lives.push({
        ex: itemsExt(l),
        tier: w.rarity,
        unskilled: w.unskilled,
        everyday: w.everyday,
        armor: armorOf(g.ctx).defense,
        gold: l.gold,
        items: l.items.length,
        race: l.race,
        outcomes: g.state.log.filter((e) => e.sys === 'items' && e.kind === 'forge' && e.data.step === 'result').map((e) => String(e.data.outcome)),
        forgeNeeds: g.state.log.filter((e) => e.sys === 'items' && e.kind === 'forge' && e.data.step === 'need').length,
        legend: l.items.filter((id) => id.startsWith('wl_')).length,
        adult: l.hAge >= 18,
      });
    }
  }, 900000);

  it('a character buys now and then, never beyond its means, and keeps something to wear', () => {
    const n = lives.length;
    const bought = lives.reduce((s, l) => s + l.ex.stats.bought, 0) / n;
    const spent = lives.reduce((s, l) => s + l.ex.stats.spent, 0) / n;
    const armoured = lives.filter((l) => l.armor > 0).length / n;
    console.log(`bought ${bought.toFixed(1)} a life, spent ${spent.toFixed(0)} gold, ${(100 * armoured).toFixed(0)}% in armour at death`);
    expect(bought).toBeGreaterThan(0.5);
    expect(bought).toBeLessThan(10);
    expect(spent).toBeLessThan(800);
    expect(armoured).toBeGreaterThan(0.25);
    expect(lives.every((l) => l.gold >= 0)).toBe(true);
  });

  it('the weapons in hand follow the tiers: most hold a C, U or an article, E is rare, L comes only from the story or a chest', () => {
    const n = lives.length;
    const by: Record<string, number> = {};
    for (const l of lives) by[l.tier] = (by[l.tier] ?? 0) + 1;
    console.log(JSON.stringify(by));
    expect(((by.C ?? 0) + (by.U ?? 0) + (by['ของใช้'] ?? 0)) / n).toBeGreaterThan(0.5);
    expect((by.E ?? 0) / n).toBeLessThan(0.15);
    expect((by.L ?? 0) / n).toBeLessThan(0.03);
    // a character holds a weapon of a kind it is trained in, in most lives
    const fighters = lives.filter((l) => !l.everyday);
    // every adult has a job now and takes its first weapon, of a kind he may not be trained in: still more than half hold one they are trained in
    expect(fighters.filter((l) => l.unskilled).length / Math.max(1, fighters.length)).toBeLessThan(0.45);
  });

  it('forging is a story that some lives live: a fifth of the lives start it, and the results follow the odds of §8', () => {
    const n = lives.length;
    const forged = lives.filter((l) => l.forgeNeeds > 0).length / n;
    const all = lives.flatMap((l) => l.outcomes);
    const mix = (k: string) => all.filter((o) => o === k).length / Math.max(1, all.length);
    console.log(`forging in ${(100 * forged).toFixed(0)}% of lives; ${all.length} results: fail ${(100 * mix('fail')).toFixed(0)}% flawed ${(100 * mix('flawed')).toFixed(0)}% ordered ${(100 * mix('ordered')).toFixed(0)}% masterpiece ${(100 * mix('masterpiece')).toFixed(0)}%`);
    expect(forged).toBeGreaterThan(0.08);
    expect(forged).toBeLessThan(0.5);
    expect(all.length).toBeGreaterThan(30);
    // the tiers ordered are U, R and E, whose rows of the table run from 5% to 30% failures and 5% to 10% masterpieces
    expect(mix('fail')).toBeGreaterThan(0.04);
    expect(mix('fail')).toBeLessThan(0.35);
    expect(mix('masterpiece')).toBeGreaterThan(0.02);
    expect(mix('masterpiece')).toBeLessThan(0.2);
    expect(mix('ordered')).toBeGreaterThan(0.4);
  });

  it('no legendary weapon is held without the story or a chest giving it', () => {
    // nothing in these lives grants one except the chest of the god, which does not draw L pieces
    expect(lives.reduce((s, l) => s + l.legend, 0)).toBeLessThan(lives.length * 0.02);
  });
});
