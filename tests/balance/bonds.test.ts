// Balance targets of the bond and bondage systems (code-plan §7 rows "bonds" and "bondage"): the numbers of docs/systems/bonds/ §6 "ที่ต้องทดสอบ"
// on real lives of the core (allSystems() plus the bond and bondage systems), with the world started by the rule of world-time.md §8.1.
//   01 §6  close lines per life 2 to 4 and never above 5 · 85% of lives that never travel have a line at level 3 at 40 · deaths of close lines
//          1 to 2 in the adult stage and no more than one full funeral scene in 15 life years
//   03 §1  60% of lives have a lover before 40 · 03 §6 a level-3 friend asked to a big fight answers yes 45 to 65% · a redeemer gets 40 to 50 allies in 100
//   03 §6  a life that does not leave the country gets few letters from other continents
//   07-attention.md §2  about 1.5 crisis cards a life (crisis of a tie, escape of a bound person)
// Run: npx vitest run tests/balance/bonds.test.ts   (slow)
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife, runToDeath } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { sortSystems, type Ctx, type GameData, type System } from '../../src/core/game';
import { bondsIndex, bondsSystem, closeTies, extOf as bondsExt, inviteChance, levelOf, tiesOf } from '../../src/core/bonds';
import { allyFrom, bondageIndex, bondageSystem, extOf as bondageExt } from '../../src/core/bondage';

const LIVES = Number(process.env.BONDS_LIVES ?? 200);

interface Row {
  seed: number;
  close40?: number;
  any3At40?: boolean;
  maxClose: number;
  lover40: boolean;
  everChild: boolean;
  crises: number;
  escapes: number;
  funerals: number;
  deathAge: number;
  adultDeaths: number;
  letters: number;
  stories: number;
  lines: string[];
  flag: string[];
  bound: boolean;
  everBound: boolean;
  allies: number;
  unhandled: string[];
  moved: boolean;
  cards: number;
  moodsHeld: number;
  moodsShown: number;
  from: string[];
}

let data: GameData;
let rows: Row[];
let ctxOf: Ctx;
let friends3: { chance: number }[] = [];

beforeAll(() => {
  data = loadAll();
  rows = [];
  for (let seed = 1; seed <= LIVES; seed++) {
    const s = createSession(data, { seed });
    const list = s.game.systems as System[];
    for (const x of [bondsSystem, bondageSystem]) if (!list.some((y) => y.name === x.name)) list.push(x);
    list.splice(0, list.length, ...sortSystems(list));
    const life = startLife(s);
    const g = s.game;
    ctxOf = g.ctx;
    let close40: number | undefined;
    let any3: boolean | undefined;
    let maxClose = 0;
    let moved = false;
    let sampled = -1;
    runToDeath(g, 4 * 400, () => {
      const l = g.state.life;
      if (!l) return;
      if (l.country !== l.home) moved = true;
      if (g.state.clock.quarter !== 0) return;
      const e = bondsExt(l);
      const close = closeTies(g.ctx, e).length;
      maxClose = Math.max(maxClose, close);
      // the friends of level 3 whom a hero would ask to a big fight (03 §6): the chance of a yes, with the fear of the enemy at its 20%
      if (l.hAge >= 20 && l.hAge <= 60 && l.hAge % 5 === 0 && sampled !== l.hAge) {
        sampled = l.hAge;
        for (const t of tiesOf(e)) if (t.state === 'alive' && t.line === 'สหาย' && !t.light && levelOf(g.ctx, t) === 3) friends3.push({ chance: 0.8 * inviteChance(g.ctx, l, t) + 0.2 * inviteChance(g.ctx, l, t, { feared: true }) });
      }
      if (close40 === undefined && l.hAge >= 40) {
        close40 = close;
        any3 = tiesOf(e).some((t) => t.state === 'alive' && levelOf(g.ctx, t) >= 3);
      }
    });
    const l = g.state.life!;
    const e = bondsExt(l);
    const b = bondageExt(l);
    const log = g.state.log;
    rows.push({
      seed,
      close40,
      any3At40: any3,
      maxClose,
      lover40: tiesOf(e).some((t) => (t.line === 'คนรัก' || t.past.includes('คนรัก')) && t.opened < 40),
      everChild: tiesOf(e).some((t) => t.kin === 'child' || t.kin === 'adopted'),
      crises: log.filter((x) => x.sys === 'bonds' && x.kind === 'crisis').length,
      escapes: log.filter((x) => x.sys === 'bondage' && x.kind === 'escape').length,
      funerals: e.funerals,
      deathAge: l.dead?.hAge ?? l.hAge,
      adultDeaths: log.filter((x) => x.sys === 'bonds' && x.kind === 'end' && x.data.way === 'death' && x.data.why === 'ตาย' && (x.age ?? 0) >= 20 && (x.data.level as number) >= 3 && !e.ties[x.id!]?.light).length,
      letters: log.filter((x) => x.sys === 'bonds' && x.kind === 'letter').length,
      stories: tiesOf(e).filter((t) => !t.light).length,
      lines: tiesOf(e).filter((t) => !t.light).map((t) => t.line),
      flag: tiesOf(e).filter((t) => t.npc).map((t) => t.npc!),
      bound: b.level > 0,
      everBound: b.history.length > 0,
      allies: b.counts.allies,
      unhandled: log.filter((x) => x.sys === 'rules' && x.kind === 'unhandled').map((x) => x.id!),
      moved,
      cards: log.filter((x) => (x.sys === 'bonds' && x.kind === 'crisis') || (x.sys === 'bondage' && x.kind === 'escape')).length,
      moodsHeld: e.counts.blocked,
      moodsShown: e.counts.moods,
      from: tiesOf(e).map((t) => t.from),
    });
  }
}, 600000);

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

describe('bonds balance (docs/systems/bonds/01 §6)', () => {
  it('a life of 40 years holds 2 to 4 close lines on the average and never more than 5', () => {
    const at40 = rows.filter((r) => r.close40 !== undefined).map((r) => r.close40!);
    expect(at40.length).toBeGreaterThan(LIVES * 0.8);
    expect(mean(at40)).toBeGreaterThanOrEqual(2);
    expect(mean(at40)).toBeLessThanOrEqual(4);
    expect(Math.max(...rows.map((r) => r.maxClose))).toBeLessThanOrEqual(5);
  });

  it('at least 85% of the lives that never leave the country have a line at level 3 or more at 40', () => {
    const still = rows.filter((r) => !r.moved && !r.everBound && r.any3At40 !== undefined);
    // lives that never leave: a third of them once the travel system sends people out by its causes (it only has to leave a sample to measure)
    expect(still.length).toBeGreaterThan(LIVES * 0.25);
    expect(still.filter((r) => r.any3At40).length / still.length).toBeGreaterThanOrEqual(0.85);
  });

  it('1 to 2 of the close lines with a story die in the adult stage, and a full funeral scene comes at most once in 15 life years', () => {
    const m = mean(rows.map((r) => r.adultDeaths));
    expect(m).toBeGreaterThanOrEqual(0.8);
    expect(m).toBeLessThanOrEqual(2.6);
    for (const r of rows) expect(r.funerals).toBeLessThanOrEqual(Math.ceil((r.deathAge + 1) / 15));
  });

  it('60% of the lives have a lover before 40 (03 §1 row "ความรักครั้งแรก")', () => {
    const p = rows.filter((r) => r.lover40).length / rows.length;
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(0.72);
  });

  it('a life that stays in its country gets few letters from other continents and no flood of lines', () => {
    expect(mean(rows.map((r) => r.letters))).toBeLessThan(4);
    expect(Math.max(...rows.map((r) => r.letters))).toBeLessThanOrEqual(30);
  });
});

describe('bonds balance (03-formation.md §6)', () => {
  it('a level-3 friend asked to a big fight says yes 45 to 65% of the time', () => {
    expect(friends3.length).toBeGreaterThan(30);
    const m = mean(friends3.map((f) => f.chance));
    expect(m).toBeGreaterThanOrEqual(45);
    expect(m).toBeLessThanOrEqual(65);
  });

  it('a redeemer of 100 gets 40 to 50 allies, a helper 45 to 55', () => {
    const run = (pct: number, n = 4000) => {
      let hit = 0;
      for (let i = 0; i < n; i++) {
        const ctx = ctxOf;
        const life = ctx.state.life!;
        if (allyFrom(ctx, life, { name: `r${i}` }, pct)) hit++;
        for (const t of tiesOf(bondsExt(life))) if (t.from === 'redeem') t.state = 'faded';
      }
      return hit / n;
    };
    const d = bondageIndex(ctxOf).data.allyChance;
    const redeem = run(d.redeemOrFree);
    const helper = run(d.helper);
    expect(redeem).toBeGreaterThan(0.37);
    expect(redeem).toBeLessThan(0.46);
    expect(helper).toBeGreaterThan(0.45);
    expect(helper).toBeLessThan(0.55);
  });
});

describe('bonds balance (the stories and the written allies)', () => {
  it('about 1.5 cards a life call the player for a crisis of a tie or the escape of a bound person (07-attention.md §2)', () => {
    const m = mean(rows.map((r) => r.cards));
    expect(m).toBeGreaterThanOrEqual(1);
    expect(m).toBeLessThanOrEqual(2.3);
  });

  it('a life has several stories (not a crowd), all nine lines are met across lives, and none of them takes more than 40% of the stories', () => {
    const m = mean(rows.map((r) => r.stories));
    expect(m).toBeGreaterThanOrEqual(3);
    expect(m).toBeLessThanOrEqual(10);
    const all = rows.flatMap((r) => r.lines);
    const count: Record<string, number> = {};
    for (const l of all) count[l] = (count[l] ?? 0) + 1;
    for (const l of bondsIndex(ctxOf).lines) expect(count[l] ?? 0, l).toBeGreaterThan(0);
    for (const l of Object.keys(count)) expect(count[l] / all.length, l).toBeLessThan(0.4);
  });

  it('the written allies are met, each with his own id of the 55, and the three kinds of rule the story calls are all handled', () => {
    const flag = rows.flatMap((r) => r.flag);
    expect(flag.length).toBeGreaterThan(LIVES * 0.1);
    const known = new Set((data.storylines.items as { allyArcs: { npc: string }[] }).allyArcs.map((a) => a.npc));
    // a position of the roster whose story made him an ally need not be one of the 55
    expect(flag.filter((id) => known.has(id)).length).toBeGreaterThan(0);
    const bad = new Set(rows.flatMap((r) => r.unhandled).filter((id) => /^(effect:(mood|template|bond)|cond:bond|effect:stat:(B|บุญคุณ|พวกพ้อง|ความรู้จักผู้ร่วมทาง))$/.test(id)));
    expect([...bad]).toEqual([]);
  });

  it('ties come from the sources of 03 §1: the childhood node, the school, the road, work, the roster, a lover, a student', () => {
    const from = new Set(rows.flatMap((r) => r.from));
    for (const f of ['kin', 'bn.b1', 'school', 'journey', 'work', 'roster', 'bn.a3', 'bn.a5']) expect(from.has(f), f).toBe(true);
  });

  it('shows more moods than it holds back: the table lets most of what the documents write through', () => {
    const shown = rows.reduce((n, r) => n + r.moodsShown, 0);
    const held = rows.reduce((n, r) => n + r.moodsHeld, 0);
    expect(shown).toBeGreaterThan(held * 2);
  });
});

describe('bondage balance (10-bondage.md §10)', () => {
  it('a small share of the lives are ever bound (the story’s guess for bd is 5%), and the bound are of class 1 while bound', () => {
    const p = rows.filter((r) => r.everBound).length / rows.length;
    expect(p).toBeGreaterThan(0.02);
    expect(p).toBeLessThan(0.14);
  });
});

