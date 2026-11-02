import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GodFile } from '../../src/core/data/types-god';
import { idIndex } from '../../scripts/codegen/lib/ids';
import { readDoc } from '../../scripts/codegen/lib/table';

const G = (JSON.parse(readFileSync('data/gen/god.json', 'utf8')) as GodFile).items;
const sim = readFileSync('scripts/sim/sim-god.mjs', 'utf8');
const lit = (name: string) => {
  const m = sim.match(new RegExp(`${name} = (\\{[^\\n]*\\}|\\[[^\\]]*\\])`));
  if (!m) throw new Error('sim literal not found: ' + name);
  return new Function(`return (${m[1]})`)();
};

describe('god generator: counts the docs state', () => {
  it('25 miracles MR-01..MR-25, 48 conjure cells, 20 vows, 16 life titles, 6 god titles, 17 prayers', () => {
    expect(G.miracles.list.map((m) => m.id)).toEqual(Array.from({ length: 25 }, (_, i) => `MR-${String(i + 1).padStart(2, '0')}`));
    expect(G.conjure.cells.length).toBe(48);
    expect(new Set(G.conjure.cells.map((c) => c.verb + c.core)).size).toBe(48);
    expect(G.goals.vows.length).toBe(20);
    expect(G.goals.titles.length).toBe(16);
    expect(G.epithets.length).toBe(6);
    expect(G.prayers.kinds.length).toBe(17);
    expect(G.dreams.sources.map((s) => s.id)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']);
    expect(G.dreams.whispers.length).toBe(9);
    expect(G.miracles.ruin.events.length).toBe(8);
  });
  it('conjure cells that map straight to a miracle name one that exists', () => {
    const ids = new Set(G.miracles.list.map((m) => m.id));
    for (const c of G.conjure.cells) for (const m of c.mr) expect(ids.has(m), c.text).toBe(true);
  });
  it('miracle tiers and caps', () => {
    const by = (t: string) => G.miracles.list.filter((m) => m.tier === t).length;
    expect([by('เล็ก'), by('กลาง'), by('ใหญ่'), by('มหา'), by('มังกร'), by('ลิขิต')]).toEqual([8, 8, 4, 2, 2, 1]);
    expect(G.caps.miraclePerLife).toEqual({ mid: 4, big: 2, ruinOfBig: 1, grand: 1, conjure: 3 });
    expect(G.miracles.list.find((m) => m.id === 'MR-17')).toMatchObject({ cost: { dread: 60 }, wait: 50, makesRuin: true });
    expect(G.miracles.list.find((m) => m.id === 'MR-21')).toMatchObject({ oncePerLife: true, cost: { faithMin: 120 } });
  });
});

describe('god generator: the values sim-god.mjs uses are in the JSON and agree with it', () => {
  it('prices per tier match the sim PRICE table', () => {
    const PRICE = lit('PRICE') as Record<string, number[]>;
    const by = (k: string) => G.prices.byTier.find((p) => p.key === k)!.byTier;
    const arr = (k: string, n: number) => ['C', 'U', 'R', 'E', 'L'].slice(0, n).map((t) => (by(k) as Record<string, number>)[t]);
    expect(arr('bless', 5)).toEqual(PRICE.bless);
    expect(arr('curse', 5)).toEqual(PRICE.curse);
    expect(arr('skill', 4)).toEqual(PRICE.skill);
    expect(arr('item', 4)).toEqual(PRICE.item);
    expect(arr('holyWeapon', 4)).toEqual(PRICE.holyW);
    expect(arr('cursedWeapon', 4)).toEqual(PRICE.cursedW);
  });
  it('tier weights, dream price, whisper price, start power', () => {
    expect(Object.values(G.chest.tierWeights)).toEqual(lit('TIER_W'));
    expect([G.prices.dream.first, G.prices.dream.second]).toEqual(lit('DREAM'));
    expect(G.prices.whisper.cheap).toBe(5);
    expect(G.prices.whisper.dear).toBe(8);
    expect({ faith: G.start.faith, dread: G.start.dread }).toEqual(lit('START_POWER'));
  });
  it('tuned RULE values come from the miracle, dream and conjure docs', () => {
    const RULE = lit('RULE') as Record<string, number>;
    for (const k of ['dreamStep', 'anchorCd', 'anchorWorldCd', 'ruinLife', 'ruinCd', 'dragonCd', 'mahaF', 'wrathD', 'burdenRelief', 'burdenAt', 'endFate', 'fallFate'] as const) expect(G.rule[k], k).toBe(RULE[k]);
    expect(G.rule.largeCd).toBe(25);
    expect(G.rule.midCd).toBe(5);
  });
  it('life-part assumptions match the sim constants', () => {
    const a = G.sim.assumptions;
    expect(a.nodesPerLife).toBe(32);
    expect(a.windowShare.rows / a.windowShare.of).toBeCloseTo(123 / 745, 6);
    expect(a.earlyDeath.perYear).toBe(0.004);
    expect(a.trouble).toBe(0.2);
    expect(G.income.base).toEqual({ faith: 1, dread: 0.3 });
    expect(G.income.channelDiv).toBe(25);
    expect(G.income.beliefDiv).toEqual({ faith: 30, dread: 75 });
    // base 0.055 since review M3 (decisions 2026-11-03): the sim's 0.035 gave about 10 prayers a life on the real core, not the 16 attention is built on
    expect(G.prayers.tick).toMatchObject({ base: 0.055, pietyDiv: 2500, oracle: 0.02, maxPending: 2, expiryTicks: 14 });
    expect(G.dreams.obey).toMatchObject({ base: 0.3, beliefDiv: 140, clamp: [0.05, 0.95] });
    expect(G.dreams.luckGuard).toMatchObject({ fails: 2, bonus: 0.15 });
    expect(G.belief.prayer).toMatchObject({ grant: 8, deny: -3, punish: -12, ignore: -2 });
    expect(G.belief.fade).toEqual({ quietYears: 10, perYear: 2 });
  });
});

describe('god generator: references and spot checks', () => {
  const ids = idIndex();
  it('ruin events and miracle ids appear in the events index', () => {
    for (const m of G.miracles.list) expect(ids.events.has(m.id), m.id).toBe(true);
  });
  it('vows are GV-01..GV-20 and the self-judged ones are marked', () => {
    expect(G.goals.vows.map((v) => v.id)).toEqual(Array.from({ length: 20 }, (_, i) => `GV-${String(i + 1).padStart(2, '0')}`));
    expect(G.goals.vows.filter((v) => v.selfJudged).map((v) => v.id)).toEqual(['GV-11', 'GV-12', 'GV-19']);
  });
  it('two rows against the docs: MR-05 and conjure destroy+water', () => {
    const m = G.miracles.list.find((x) => x.id === 'MR-05')!;
    expect(m).toMatchObject({ name: 'สงบศึก', tier: 'เล็ก', cost: { faith: 30 }, wait: 15 });
    expect(readDoc('docs/systems/god/04-miracles.md')).toContain('| **MR-05 สงบศึก** | เล็ก · ประเทศหรือสองประเทศที่รบกัน | 30 แสงศรัทธา · 15 |');
    expect(G.conjure.cells.find((c) => c.verb === 'destroy' && c.core === 'water')!.pureMr).toBeUndefined();
    expect(G.conjure.cells.find((c) => c.verb === 'destroy' && c.core === 'fire')!.pureMr).toBe('MR-13');
    expect(G.conjure.cells.find((c) => c.verb === 'destroy' && c.core === 'wind')!.pureMr).toBe('MR-09');
  });
});
