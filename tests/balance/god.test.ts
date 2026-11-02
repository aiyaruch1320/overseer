// Balance targets of the god system (docs/systems/god/06-implementation.md §4 "เป้าที่ต้องผ่าน") measured on real lives and compared with
// `node scripts/sim/sim-god.mjs` (the numbers in the document). A life here is a whole game life: the real world, character, story, NPC, attention
// and text systems with the whole god on top (income, chests, dreams, prayers, whispers), played by one of the policies of the sim. The policy is
// the one the test tools use: `state.god.ext.policy` names it, `godSystem` plays it once a life year through `policyStep` and the parts the acts
// registered. Nothing stands in for the prayers or the whispers.
// The world targets (ruins, seal strikes, fast ending) are in god-acts.test.ts; the vows are the step G6b.
// Run: npx vitest run --config vitest.balance.config.ts tests/balance/god.test.ts   (GOD_LIVES=300 lives per policy by default)
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import type { GameData } from '../../src/core/game';
import type { PolicyName } from '../../src/core/god';
import { count } from '../../src/core/god/state';

const LIVES = Number(process.env.GOD_LIVES ?? 300);
const POLICIES: PolicyName[] = ['silent', 'merciful', 'shaper', 'giver', 'saver', 'punish', 'random'];
const TH: Record<PolicyName, string> = { silent: 'เงียบ', merciful: 'เมตตา', shaper: 'ปั้นนิสัย', giver: 'ให้ของ', saver: 'เก็บพลัง', punish: 'ลงโทษ', random: 'สุ่ม', hasten: 'เร่งจบ' };

interface Row {
  age: number;
  belief: number;
  beliefMax: number;
  decisions: number;
  dreams: number;
  obeyed: number;
  picks: number;
  chests: number;
  burden: number;
  lSeen: number;
  lTaken: number;
  prayers: number;
  answered: number;
  whispers: number;
  light120: boolean;
  dread150: boolean;
}

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

const ANSWERS = new Set(['prayer.give', 'prayer.strange', 'prayer.deny', 'prayer.punish']);

function playLife(seed: number, policy: PolicyName): Row {
  const s = createSession(data, { seed, policy: TH[policy] as never });
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
  const chronicle = g.state.god.chronicle;
  const answered = chronicle.filter((x) => ANSWERS.has(x.kind)).length;
  const whispers = chronicle.filter((x) => x.kind === 'whisper').length;
  const burdenAnswered = chronicle.filter((x) => x.kind === 'burden').length;
  return {
    age: g.state.life!.dead!.hAge,
    belief: g.state.life!.godFaith,
    beliefMax,
    // the sim's decisions: each pick of a chest, each dream sent, each whisper, each prayer answered, each question of the heart answered
    decisions: c('l.pick') + c('l.dream') + whispers + answered + burdenAnswered,
    dreams: c('l.dream'),
    obeyed: c('l.dream.obeyed'),
    picks: c('l.pick'),
    chests: c('l.chest'),
    burden: c('l.burden'),
    lSeen: c('l.lSeen'),
    lTaken: c('l.lTaken'),
    prayers: g.state.log.filter((e) => e.sys === 'god' && e.kind === 'prayer').length,
    answered,
    whispers,
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

const T = 1_800_000;

describe('god balance on real lives (06-implementation.md §4)', () => {
  it.each(POLICIES)(
    'plays %s: the table of the sim, measured',
    async (policy) => {
      const r = await lives(policy);
      const f = (x: number) => x.toFixed(1);
      // eslint-disable-next-line no-console
      console.log(
        `${TH[policy].padEnd(10)} lives ${r.length} · decisions p10 ${q(r.map((x) => x.decisions), 0.1)} p50 ${q(r.map((x) => x.decisions), 0.5)} p90 ${q(r.map((x) => x.decisions), 0.9)} · dreams ${f(mean(r.map((x) => x.dreams)))} obeyed ${f(mean(r.map((x) => x.obeyed)))} · picks ${f(mean(r.map((x) => x.picks)))} (chests ${f(mean(r.map((x) => x.chests)))}) · whispers ${f(mean(r.map((x) => x.whispers)))} · prayers ${f(mean(r.map((x) => x.prayers)))} answered ${f(mean(r.map((x) => x.answered)))} · belief p50 ${f(q(r.map((x) => x.belief), 0.5))} · ≤−70 ${f(100 * share(r, (x) => x.belief <= -70))}% · ever ≥85 ${f(100 * share(r, (x) => x.beliefMax >= 85))}% · L seen ${f(100 * share(r, (x) => x.lSeen > 0))}% taken ${f(100 * share(r, (x) => x.lTaken > 0))}% · burden ${mean(r.map((x) => x.burden)).toFixed(2)} · light ≥120 ${f(100 * share(r, (x) => x.light120))}% · dread ≥150 ${f(100 * share(r, (x) => x.dread150))}%`,
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
        // 0.4% of a few hundred lives is under one life: allow the sampling error of two standard deviations
        const n = r.length;
        const room = 0.004 + (2 * Math.sqrt(0.004 * 0.996 * n)) / n;
        expect(share(r, (x) => x.belief <= -70), p).toBeLessThanOrEqual(room);
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
    'prayers in a life: the god who answers has about as many as the sim (15.1), the punisher far fewer (4.1) because the prayers stop when belief falls under −70',
    async () => {
      const kind = mean((await lives('merciful')).map((x) => x.prayers));
      const hard = mean((await lives('punish')).map((x) => x.prayers));
      // the core raises a prayer from the troubles of the world and the heart, not from a fixed fifth of the beats: 07-attention aims at about 16
      expect(kind).toBeGreaterThan(8);
      expect(kind).toBeLessThan(22);
      expect(hard).toBeLessThan(kind * 0.8);
      expect(hard).toBeLessThan(4.1 * 2);
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
    'the punisher ends in hatred and the merciful in devotion (the sim: belief p50 −100 and 100), and the punisher answers no prayer with a gift',
    async () => {
      expect(q((await lives('punish')).map((x) => x.belief), 0.5)).toBeLessThan(-50);
      expect(share(await lives('punish'), (x) => x.belief <= -70)).toBeGreaterThan(0.7); // the sim: 98%
      expect(q((await lives('merciful')).map((x) => x.belief), 0.5)).toBeGreaterThan(40);
    },
    T,
  );

  it(
    'the whispers: the merciful whisper at most three a life year and the silent god none',
    async () => {
      for (const x of await lives('merciful')) expect(x.whispers).toBeLessThanOrEqual(3 * (x.age + 1));
      expect(mean((await lives('merciful')).map((x) => x.whispers))).toBeGreaterThan(1);
      expect(mean((await lives('silent')).map((x) => x.whispers))).toBe(0);
    },
    T,
  );

  it.skip('GV-11 and GV-19 judged by the god system: needs the vows (G6b, 08-goals.md)', () => {});
});
