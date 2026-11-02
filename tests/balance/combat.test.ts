// Balance targets of the combat system (code-plan §7 row "combat", docs/systems/combat/README.md "ตามเอกสาร combat"), on whole lives of the real core
// (`allSystems()` with the world, character, npc, story, god and attention systems, and `combatSystem` in the loop).
// The combat documents give the rules, not the rates they should make; the targets below are the ones the documents imply, with the source of each:
//   - win rate falls with the tier of the enemy (01-core.md §2: wounds 1 · 2 · 3 · 4–6 · 8 against the same roll) and a boss or a legend is a hard fight;
//   - a life meets about 3 fights with a name (07-attention.md §2 "ก่อนศึกที่มีชื่อ ราว 3", sim-life samples: elf 1.2 … orc 4.6);
//   - a fight is lost by a minority and kills by a few in a hundred lives (god/06-implementation.md §4: about 21% die before 75 of untimely causes,
//     `violence` among them, so the share added by the fight must stay small; the attention target "burst ≤ 10%" (07-attention.md §5) also falls as
//     deaths in battle rise, because a death stop comes with the prayers that wait: about 2 in a hundred lives is what it bears);
//   - the year holds 4 fights, 8 for a soldier in a war and an adventurer (04-encounters.md §1; story/tuning BATTLES_PER_YEAR);
//   - random fights come at the rate of the formula of 04-encounters.md §1 (a life of 75 years at danger 3 and luck 10 meets about 8).
// Run: npx vitest run --config vitest.balance.config.ts tests/balance/combat.test.ts   (COMBAT_LIVES=300 for more lives)
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { capOf, combatSystem } from '../../src/core/combat';
import { sortSystems, type GameData } from '../../src/core/game';
import { allSystems } from '../../src/core/systems';
import { extOf as storyExt, yearOf } from '../../src/core/story/state';
import { CAUSE } from '../../src/core/story/tuning';
import type { Enemy } from '../../src/core/data/types-combat';
import type { LogEntry } from '../../src/core/types';

const LIVES = Number(process.env.COMBAT_LIVES ?? 160);
const WON = ['win', 'flawless', 'talk', 'tame'];

let data: GameData;
let tierOf: Map<string, string>;

interface Life {
  seed: number;
  cause: string;
  battles: LogEntry[];
  preludes: LogEntry[];
  wounds: number;
}

const lives: Life[] = [];

function play(seed: number): Life {
  const s = createSession(data, { seed });
  const g = s.game;
  g.systems.splice(0, g.systems.length, ...sortSystems([...g.systems.filter((x) => x.name !== 'combat'), combatSystem]));
  startLife(s);
  let n = 0;
  // beat by beat so that the cap of the year can be checked as it fills
  while (g.state.life && !g.state.life.dead && n++ < 4 * 400) {
    g.beat();
    const l = g.state.life!;
    if (!l.dead) {
      const y = yearOf(storyExt(l), l);
      if (y.age === l.hAge) expect(y.battles, `seed ${seed} age ${l.hAge}`).toBeLessThanOrEqual(capOf(g.ctx));
    }
  }
  const log = g.state.log;
  return {
    seed,
    cause: g.state.life!.dead?.cause ?? 'alive',
    battles: log.filter((e) => e.sys === 'combat' && e.kind === 'battle'),
    preludes: log.filter((e) => e.sys === 'combat' && e.kind === 'prelude'),
    wounds: log.filter((e) => e.sys === 'combat' && e.kind === 'wound').length,
  };
}

beforeAll(() => {
  data = loadAll();
  tierOf = new Map(((data.enemies.items as { items: Enemy[] }).items).map((e) => [e.id, e.tier]));
  expect(allSystems().length).toBeGreaterThan(0);
  for (let seed = 1; seed <= LIVES; seed++) lives.push(play(seed));
}, 900000);

const tierOfEntry = (e: LogEntry) => tierOf.get(String(e.id).split(',')[0]) ?? '?';
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

describe('combat balance (whole lives of the real core)', () => {
  it('the win rate falls with the tier of the enemy: grunt > normal > chief > boss > legend', () => {
    const by: Record<string, { n: number; won: number }> = {};
    for (const l of lives) {
      for (const e of l.battles) {
        const t = tierOfEntry(e);
        by[t] ??= { n: 0, won: 0 };
        by[t].n++;
        if (WON.includes(String(e.data.end))) by[t].won++;
      }
    }
    const rate = (t: string) => (by[t] ? by[t].won / by[t].n : NaN);
    const row = Object.fromEntries(Object.entries(by).map(([t, v]) => [t, `${(100 * v.won / v.n).toFixed(0)}% of ${v.n}`]));
    console.log('win rate by tier', row);
    expect(by['ลูกกระจ๊อก']?.n).toBeGreaterThan(30);
    expect(by['ปกติ']?.n).toBeGreaterThan(300);
    expect(by['หัวหน้า']?.n).toBeGreaterThan(60);
    expect(by['บอส']?.n).toBeGreaterThan(20);
    expect(rate('ลูกกระจ๊อก')).toBeGreaterThan(0.72);
    expect(rate('ปกติ')).toBeGreaterThan(0.5);
    expect(rate('ปกติ')).toBeLessThan(0.82);
    expect(rate('หัวหน้า')).toBeGreaterThan(0.2);
    expect(rate('หัวหน้า')).toBeLessThan(0.55);
    expect(rate('บอส')).toBeLessThan(0.3);
    expect(rate('ลูกกระจ๊อก')).toBeGreaterThan(rate('ปกติ'));
    expect(rate('ปกติ')).toBeGreaterThan(rate('หัวหน้า'));
    expect(rate('หัวหน้า')).toBeGreaterThan(rate('บอส'));
    if (by['ตำนาน'] && by['ตำนาน'].n >= 5) expect(rate('ตำนาน')).toBeLessThan(0.15);
  });

  it('about 3 fights with a name in a life (07-attention.md §2): the call comes before the story\'s named fights', () => {
    const named = lives.map((l) => l.preludes.filter((e) => e.data.kind === 'story').length);
    const m = mean(named);
    console.log('named story fights per life', m.toFixed(2));
    expect(m).toBeGreaterThan(1.8);
    expect(m).toBeLessThan(4.2);
    // and every call is followed by its battle (unless the life ended first)
    for (const l of lives) {
      const fought = new Set(l.battles.map((e) => e.id));
      const missing = l.preludes.filter((p) => !fought.has(p.id));
      if (l.cause === 'alive') expect(missing.length).toBe(0);
      expect(missing.length).toBeLessThanOrEqual(2);
    }
  });

  it('a few lives in a hundred end in battle, and a lost fight is a minority', () => {
    const inBattle = lives.filter((l) => l.cause === CAUSE.battle).length / lives.length;
    const dead = lives.reduce((s, l) => s + l.battles.filter((e) => e.data.end === 'dead').length, 0) / lives.length;
    const all = lives.flatMap((l) => l.battles);
    const lost = all.filter((e) => e.data.end === 'lose').length / all.length;
    console.log('lives ended in battle', (100 * inBattle).toFixed(1) + '%', 'deaths by the fight per life', dead.toFixed(3), 'lost fights', (100 * lost).toFixed(1) + '%');
    expect(inBattle).toBeGreaterThan(0.005);
    expect(inBattle).toBeLessThan(0.08);
    expect(dead).toBeLessThan(0.08);
    expect(lost).toBeLessThan(0.12);
    expect(lost).toBeGreaterThan(0.005);
  });

  it('a life meets fights at the rate of the formula: about 8 on the road plus the story\'s own', () => {
    const road = mean(lives.map((l) => l.battles.filter((e) => e.data.kind === 'travel' || e.data.kind === 'hunt' || e.data.kind === 'raid').length));
    const story = mean(lives.map((l) => l.battles.filter((e) => e.data.kind === 'story').length));
    console.log('road fights per life', road.toFixed(1), 'story fights per life', story.toFixed(1));
    expect(road).toBeGreaterThan(4);
    expect(road).toBeLessThan(15);
    expect(story).toBeGreaterThan(2);
    expect(story).toBeLessThan(10);
  });

  it('permanent wounds are the exception: under one a life, and the losers of a fight are the ones who carry them', () => {
    const w = mean(lives.map((l) => l.wounds));
    console.log('permanent wounds per life', w.toFixed(2));
    expect(w).toBeLessThan(1);
    const lost = lives.reduce((s, l) => s + l.battles.filter((e) => e.data.end === 'lose').length, 0);
    const carried = lives.reduce((s, l) => s + l.battles.filter((e) => e.data.end === 'lose' && String(e.data.wounds) !== '').length, 0);
    expect(carried).toBeLessThanOrEqual(lost);
    expect(carried / Math.max(1, lost)).toBeLessThan(0.7); // 60% of the rolls leave nothing
  });

  it('the log data is plain', () => {
    for (const l of lives.slice(0, 30)) {
      for (const e of [...l.battles, ...l.preludes]) {
        for (const v of Object.values(e.data)) expect(v === null || ['string', 'number', 'boolean'].includes(typeof v)).toBe(true);
      }
    }
  });
});
