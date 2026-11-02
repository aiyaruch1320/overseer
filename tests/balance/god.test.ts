// Balance targets of the god system, steps G0 to G2 (docs/systems/god/06-implementation.md §4 "เป้าที่ต้องผ่าน") measured on real lives
// and compared with `node scripts/sim/sim-god.mjs`. A life here is a whole game life: the real world, character and story systems with the god
// system on top, played by one of the policies of the sim (`policyStep`).
//
// What this file stands in for: prayers and whispers are the acts/ files' work. The sim spends most of the light the god earns on them
// (about 15 prayers a life at 6 to 25 light each), so the power budget of dreams and chests only compares when something spends it. `stand-in`
// below does what the sim's `life()` does for prayers and whispers (same rates, same prices, same belief changes) and is registered as a policy
// part. Re-measure with the real parts after acts/ is merged (the targets that need only the real parts are listed as skipped, with the reason).
// Run: npx vitest run tests/balance/god.test.ts   (GOD_LIVES=300 lives per policy by default; about a minute for each policy)
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { extOf } from '../../src/core/character';
import { sortSystems, type Ctx, type GameData } from '../../src/core/game';
import { addBelief, clearPolicyParts, earn, godSystem, noteAnswered, notePunished, pay, priceOf, registerPolicyPart, type PolicyName } from '../../src/core/god';
import { bump, count, gx } from '../../src/core/god/state';

const LIVES = Number(process.env.GOD_LIVES ?? 300);
const POLICIES: PolicyName[] = ['silent', 'merciful', 'shaper', 'giver', 'saver', 'punish', 'random'];
const TH: Record<PolicyName, string> = { silent: 'เงียบ', merciful: 'เมตตา', shaper: 'ปั้นนิสัย', giver: 'ให้ของ', saver: 'เก็บพลัง', punish: 'ลงโทษ', random: 'สุ่ม' };

// ---------- the stand-in for prayers and whispers (sim-god.mjs `life()`: prayerTick, `whisper`) ----------

function standIn(ctx: Ctx, policy: PolicyName): void {
  const life = ctx.state.life;
  if (!life || life.dead) return;
  const rng = ctx.rng('god.stub');
  const st = ((ctx.state.god.ext.stub as { pending: number[] } | undefined) ??= { pending: [] } as never) as { pending: number[] };
  const piety = extOf(life).axes.piety;
  const oracle = life.skills.includes('u_oracle');
  const devout = piety > 30;
  for (let t = 0; t < 4; t++) {
    const tick = life.hAge * 4 + t;
    for (let i = st.pending.length - 1; i >= 0; i--)
      if (st.pending[i] <= tick) {
        st.pending.splice(i, 1);
        addBelief(ctx, -2, 'stub.ignore');
      }
    if (st.pending.length >= 2 || life.godFaith < -70) continue;
    const p = (0.035 + Math.max(0, piety) / 2500 + (oracle ? 0.02 : 0)) * (rng.next() < 0.2 ? 3 : 1);
    if (rng.next() >= p) continue;
    bump(ctx, 'l.stub.prayer');
    const cost = 8 + Math.floor(rng.next() * 18);
    const kinds = ['grant', 'deny', 'punish', 'none'];
    let ans = { silent: 'none', merciful: 'grant', shaper: 'grant', giver: 'grant', saver: 'grant', punish: 'punish', random: kinds[Math.floor(rng.next() * 4)] }[policy];
    const price = priceOf(ctx, 'prayerGrant', { cost })!;
    if (ans === 'grant' && ctx.state.god.light < (price.faith ?? 0)) ans = 'none';
    if (ans === 'none') {
      st.pending.push(tick + 14);
      continue;
    }
    bump(ctx, 'l.stub.decision');
    if (ans === 'grant') {
      pay(ctx, price, 'stub.prayer');
      earn(ctx, { faith: 2 }, 'stub.prayer');
      noteAnswered(ctx);
      addBelief(ctx, 8 * (devout ? 1.5 : 1), 'stub.grant');
      bump(ctx, 'l.stub.answered');
    } else if (ans === 'deny') addBelief(ctx, devout ? -1 : -3, 'stub.deny');
    else {
      earn(ctx, { dread: 6 + Math.floor(rng.next() * 5) }, 'stub.punish');
      addBelief(ctx, -12, 'stub.punish');
      notePunished(ctx);
    }
  }
  // whispers: the merciful and the shaper spend light down to 30 at every moment of the year, three a year at most
  if (policy === 'merciful' || policy === 'shaper') {
    const w = gx(ctx).window;
    const moments = (w && w.age === life.hAge ? w.played : 0) + (w?.stop && w.age === life.hAge ? 1 : 0);
    for (let m = 0; m < moments && count(ctx, 'y.stub.whisper') < 3; m++) {
      const hint = rng.next() < 0.5 ? 'ระวัง' : 'ช่วย';
      const price = priceOf(ctx, 'whisper', { hint })!;
      if (ctx.state.god.light < 30 || ctx.state.god.light < (price.faith ?? 0)) break;
      pay(ctx, price, 'stub.whisper');
      bump(ctx, 'y.stub.whisper');
      bump(ctx, 'l.stub.decision');
    }
  }
}

// ---------- one life ----------

interface Row {
  age: number;
  belief: number;
  beliefMax: number;
  decisions: number;
  dreams: number;
  obeyed: number;
  picks: number;
  gifts: number;
  chests: number;
  burden: number;
  lSeen: number;
  lTaken: number;
  prayers: number;
  answered: number;
  light120: boolean;
  dread150: boolean;
}

let data: GameData;
beforeAll(() => {
  data = loadAll();
  clearPolicyParts();
  registerPolicyPart(standIn);
});

function playLife(seed: number, policy: PolicyName): Row {
  const s = createSession(data, { seed });
  if (!s.game.systems.some((x) => x.name === 'god')) s.game.systems.push(godSystem);
  s.game.systems.splice(0, s.game.systems.length, ...sortSystems(s.game.systems));
  s.game.state.god.ext.policy = TH[policy];
  startLife(s);
  const g = s.game;
  let beliefMax = 0;
  let light120 = false;
  let dread150 = false;
  while (g.state.life && !g.state.life.dead) {
    g.beat();
    beliefMax = Math.max(beliefMax, g.state.life?.godFaith ?? 0);
    light120 ||= g.state.god.light >= 120;
    dread150 ||= g.state.god.dread >= 150;
  }
  const c = (k: string) => count(g.ctx, k);
  return {
    age: g.state.life!.dead!.hAge,
    belief: g.state.life!.godFaith,
    beliefMax,
    decisions: c('l.pick') + c('l.dream') + c('l.stub.decision') + c('l.skip') * 0,
    dreams: c('l.dream'),
    obeyed: c('l.dream.obeyed'),
    picks: c('l.pick'),
    gifts: c('l.gifts'),
    chests: c('l.chest'),
    burden: c('l.burden'),
    lSeen: c('l.lSeen'),
    lTaken: c('l.lTaken'),
    prayers: c('l.stub.prayer'),
    answered: c('l.stub.answered'),
    light120,
    dread150,
  };
}

const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))];
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const share = (a: Row[], f: (r: Row) => boolean) => a.filter(f).length / a.length;

const rows: Partial<Record<PolicyName, Row[]>> = {};
/** The lives of a policy, played once. Yields to the event loop now and then so the test runner can talk to its worker during a long run. */
async function lives(policy: PolicyName): Promise<Row[]> {
  if (!rows[policy]) {
    const out: Row[] = [];
    for (let i = 0; i < LIVES; i++) {
      out.push(playLife(1000 + i, policy));
      if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
    }
    rows[policy] = out;
  }
  return rows[policy]!;
}

const T = 900_000;

describe('god balance G0 to G2 (06-implementation.md §4)', () => {
  it.each(POLICIES)(
    'plays %s: the table of the sim, measured',
    async (policy) => {
      const r = await lives(policy);
      const f = (x: number) => x.toFixed(1);
      // eslint-disable-next-line no-console
      console.log(
        `${TH[policy].padEnd(10)} lives ${r.length} · decisions p10 ${q(r.map((x) => x.decisions), 0.1)} p50 ${q(r.map((x) => x.decisions), 0.5)} p90 ${q(r.map((x) => x.decisions), 0.9)} · dreams ${f(mean(r.map((x) => x.dreams)))} obeyed ${f(mean(r.map((x) => x.obeyed)))} · picks ${f(mean(r.map((x) => x.picks)))} (chests ${f(mean(r.map((x) => x.chests)))}) · prayers ${f(mean(r.map((x) => x.prayers)))} · belief p50 ${f(q(r.map((x) => x.belief), 0.5))} · ≤−70 ${f(100 * share(r, (x) => x.belief <= -70))}% · ever ≥85 ${f(100 * share(r, (x) => x.beliefMax >= 85))}% · L seen ${f(100 * share(r, (x) => x.lSeen > 0))}% taken ${f(100 * share(r, (x) => x.lTaken > 0))}% · burden ${mean(r.map((x) => x.burden)).toFixed(2)} · light ≥120 ${f(100 * share(r, (x) => x.light120))}% · dread ≥150 ${f(100 * share(r, (x) => x.dread150))}%`,
      );
      expect(r.length).toBe(LIVES);
    },
    T,
  );

  it(
    'silent and merciful: belief −70 or lower at death in no more than 0.4% of lives (the sim: 0.0% · 0.0%)',
    async () => {
      for (const p of ['silent', 'merciful'] as const) {
        const r = await lives(p);
        expect(share(r, (x) => x.belief <= -70), p).toBeLessThanOrEqual(0.004);
      }
    },
    T,
  );

  it(
    'merciful: dreams obeyed in a life, 3 to 8 (the sim: 4.4)',
    async () => {
      const m = mean((await lives('merciful')).map((x) => x.obeyed));
      expect(m).toBeGreaterThanOrEqual(3);
      expect(m).toBeLessThanOrEqual(8);
    },
    T,
  );

  it(
    'burden events in a life: the shaper 0.3 to 1, the merciful no more than 0.1 (the sim: 0.48 · 0.00)',
    async () => {
      const shaper = mean((await lives('shaper')).map((x) => x.burden));
      expect(shaper).toBeGreaterThanOrEqual(0.3);
      expect(shaper).toBeLessThanOrEqual(1);
      expect(mean((await lives('merciful')).map((x) => x.burden))).toBeLessThanOrEqual(0.1);
    },
    T,
  );

  it(
    'merciful: decisions in a life, median 25 to 40 (the sim: 26), counting chests, dreams, whispers and prayers answered',
    async () => {
      const d = q((await lives('merciful')).map((x) => x.decisions), 0.5);
      expect(d).toBeGreaterThanOrEqual(25);
      expect(d).toBeLessThanOrEqual(40);
    },
    T,
  );

  it(
    'level L in the chest is rare enough without a cap per life: the merciful see it in under 6% of lives, the giver in under 15% (the sim: 1.4% · 5.3%)',
    async () => {
      expect(share(await lives('merciful'), (x) => x.lSeen > 0)).toBeLessThan(0.06);
      expect(share(await lives('giver'), (x) => x.lSeen > 0)).toBeLessThan(0.15);
    },
    T,
  );

  it(
    'the giver opens many more chests than the merciful, the merciful send dreams and the giver none (the sim: picks 7.5 · 2.1, dreams 0 for the giver)',
    async () => {
      expect(mean((await lives('giver')).map((x) => x.picks))).toBeGreaterThan(mean((await lives('merciful')).map((x) => x.picks)));
      expect(mean((await lives('giver')).map((x) => x.dreams))).toBe(0);
      expect(mean((await lives('merciful')).map((x) => x.dreams))).toBeGreaterThan(2);
    },
    T,
  );

  it(
    'the punisher ends in hatred and the merciful in devotion (the sim: belief p50 −100 and 100; the real prayers are the acts files)',
    async () => {
      expect(q((await lives('punish')).map((x) => x.belief), 0.5)).toBeLessThan(-30);
      expect(q((await lives('merciful')).map((x) => x.belief), 0.5)).toBeGreaterThan(40);
    },
    T,
  );

  it.skip('GV-11 and GV-19 judged by the god system: needs the vows (G6b, 08-goals.md)', () => {});
  it.skip('punish: ruins per world and at once; seal anchors: eras no more than 15% earlier; fast ending: needs miracles and fate (G4 G5, acts/)', () => {});
});
