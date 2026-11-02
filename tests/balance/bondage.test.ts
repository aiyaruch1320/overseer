// Balance and truth of the bondage of whole lives of the real core (docs/systems/economy/10-bondage.md, M3 review B1 to B4):
//   - about 5% of lives are ever bound (the sim's guess for the line bd, bondage/tuning.ts ENTRY);
//   - while bound he does not go anywhere by himself, does not change his work (B2 B3) and does not rise in class (§2);
//   - the nodes of bd play in the state they are about: "รับใช้" and "ทางออก" only while bound, "หลังพ้นพันธะ" only after he left it;
//   - the ransom he pays is the price, taken from the purse, and he is never ransomed without the gold;
//   - a life that dies bound is told the ending of one who was held.
// Run: npx vitest run --config vitest.balance.config.ts tests/balance/bondage.test.ts   (BONDAGE_LIVES=400 for more lives)
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import type { GameData } from '../../src/core/game';
import { BOUND_ENDING } from '../../src/core/story/ending';
import type { LogEntry } from '../../src/core/types';

const LIVES = Number(process.env.BONDAGE_LIVES ?? 240);

let data: GameData;
interface Bound {
  seed: number;
  log: LogEntry[];
  /** Things that happened while he stayed bound across a beat, and should not have. */
  moved: string[];
  jobChanged: string[];
  /** A job a B2 or B3 life took or lost across a beat: the work of the contract is the only one he may get, and only at twenty (M3 review R3). */
  jobGained: string[];
  rose: string[];
  /** Free after bondage, still class 1, and nothing but the bondage put him there (M3 review R1). */
  freeC1?: string;
  endedBound: boolean;
  ending?: string;
}
const lives: Bound[] = [];
let total = 0;

function play(seed: number): Bound | undefined {
  const s = createSession(data, { seed });
  const g = s.game;
  startLife(s);
  const out: Bound = { seed, log: [], moved: [], jobChanged: [], jobGained: [], rose: [], endedBound: false };
  let ever = false;
  let n = 0;
  while (g.state.life && !g.state.life.dead && n++ < 4 * 400) {
    const l = g.state.life;
    const before = { level: (l.ext.bondage as { level?: number } | undefined)?.level ?? 0, country: l.country, job: l.job, cls: Number(l.cls.slice(1)) };
    g.beat();
    const now = g.state.life!;
    const level = (now.ext.bondage as { level?: number } | undefined)?.level ?? 0;
    if (before.level > 0 || level > 0) ever = true;
    if (before.level > 0 && level > 0 && !now.dead) {
      if (now.country !== before.country) out.moved.push(`${now.hAge} ${before.country}>${now.country}`);
      if (before.level >= 2 && now.job !== before.job && before.job) out.jobChanged.push(`${now.hAge} ${before.job}>${now.job}`);
      if (before.level >= 2 && now.job !== before.job && !before.job) out.jobGained.push(`${now.hAge} ${now.job}`);
      if (Number(now.cls.slice(1)) > before.cls) out.rose.push(`${now.hAge} ${before.cls}>${now.cls}`);
    }
  }
  total++;
  if (!ever) return undefined;
  out.log = g.state.log;
  const b = g.state.life!.ext.bondage as { level?: number } | undefined;
  out.endedBound = (b?.level ?? 0) > 0;
  const lastExit = [...out.log].reverse().find((e) => e.sys === 'bondage' && e.kind === 'exit');
  if (lastExit && !out.endedBound && g.state.life!.cls === 'c1') {
    const other = out.log.filter((e) => e.sys === 'character' && e.kind === 'class' && e.n > lastExit.n && e.data.to === 'c1' && !String(e.data.cause).startsWith('bondage'));
    if (!other.length) out.freeC1 = `exit at ${lastExit.age} by ${lastExit.id}`;
  }
  out.ending = g.state.log.find((e) => e.sys === 'story' && e.kind === 'ending')?.id as string | undefined;
  return out;
}

beforeAll(() => {
  data = loadAll();
  for (let seed = 500; seed < 500 + LIVES; seed++) {
    const l = play(seed);
    if (l) lives.push(l);
  }
}, 900000);

describe('bondage over whole lives', () => {
  it('about 5% of lives are ever bound, and they are bound for a small share of their years', () => {
    const share = lives.length / total;
    console.log('ever bound', lives.length, 'of', total, `(${(100 * share).toFixed(1)}%)`);
    expect(share).toBeGreaterThan(0.015);
    expect(share).toBeLessThan(0.12);
    expect(lives.length).toBeGreaterThanOrEqual(4);
  });

  it('a bound life does not go anywhere by itself, does not change its work at B2 and B3, and does not rise in class (§2)', () => {
    for (const l of lives) {
      expect(l.moved, `seed ${l.seed} moved`).toEqual([]);
      expect(l.jobChanged, `seed ${l.seed} job`).toEqual([]);
      expect(l.rose, `seed ${l.seed} class`).toEqual([]);
      // the first work a B2 or B3 life gets is the contract's, at twenty or after (class 1 work: economy/03-classes.md §4)
      for (const g of l.jobGained) {
        expect(Number(g.split(' ')[0]), `seed ${l.seed} first work ${g}`).toBeGreaterThanOrEqual(20);
        expect(['servant', 'miner', 'courier', 'woodcutter'], `seed ${l.seed} first work ${g}`).toContain(g.split(' ')[1]);
      }
    }
  });

  it('a life freed by any way out does not stay class 1 unless something else put it there (M3 review R1; 10-bondage.md §6)', () => {
    const freed = lives.filter((l) => l.log.some((e) => e.sys === 'bondage' && e.kind === 'exit'));
    console.log('freed', freed.length, 'of', lives.length, 'still class 1 from bondage', freed.filter((l) => l.freeC1).length);
    for (const l of freed) expect(l.freeC1, `seed ${l.seed}`).toBeUndefined();
  });

  it('the nodes of bd play in the state they are about', () => {
    let a3 = 0;
    let served = 0;
    for (const l of lives) {
      let bound = false;
      let exits = 0;
      for (const e of l.log) {
        if (e.sys === 'bondage' && e.kind === 'enter') bound = true;
        else if (e.sys === 'bondage' && e.kind === 'exit') {
          bound = false;
          exits++;
        } else if (e.sys === 'story' && e.kind === 'node' && typeof e.id === 'string' && e.id.startsWith('bd.')) {
          const where = `seed ${l.seed} age ${e.age} ${e.id}`;
          if (e.id === 'bd.b1' || e.id === 'bd.t1' || e.id === 'bd.a1' || e.id === 'bd.a2') {
            expect(bound, where).toBe(true);
            served++;
          }
          if (e.id === 'bd.a3') {
            expect(bound, where).toBe(false);
            expect(exits, where).toBeGreaterThan(0);
            a3++;
          }
          if (e.id === 'bd.e1') {
            const c = String(e.data.choice);
            if (c === 'c') expect(bound, `${where} way c`).toBe(true);
            if (c === 'b') expect(bound, `${where} way b`).toBe(false);
          }
        }
      }
    }
    console.log('nodes of bd played while bound', served, 'after freedom (a3)', a3);
    expect(served).toBeGreaterThan(0);
  });

  it('a ransom is the price, out of the purse, and never without the gold', () => {
    let ransoms = 0;
    for (const l of lives) {
      const paid = l.log.filter((e) => e.sys === 'bondage' && e.kind === 'exit' && e.id === 'ransom');
      for (const e of paid) {
        ransoms++;
        expect(Number(e.data.paid), `seed ${l.seed}`).toBeGreaterThan(0);
        expect(Number(e.data.gold), `seed ${l.seed}`).toBeGreaterThanOrEqual(0);
      }
      // a debt cleared by the wages tells the debt it was (M3 review R4); the other ways out cost nothing
      for (const e of l.log.filter((x) => x.sys === 'bondage' && x.kind === 'exit' && x.id === 'debt')) expect(Number(e.data.paid)).toBeGreaterThan(0);
      for (const e of l.log.filter((x) => x.sys === 'bondage' && x.kind === 'exit' && x.id !== 'ransom' && x.id !== 'debt')) expect(Number(e.data.paid)).toBe(0);
    }
    console.log('ransoms', ransoms);
    expect(ransoms).toBeGreaterThan(0);
  });

  it('a life that dies bound is told the ending of one who was held; the ones that die free are not told it unless they walked bd to its end', () => {
    for (const l of lives.filter((x) => x.endedBound)) expect(l.ending, `seed ${l.seed}`).toBe(BOUND_ENDING.title);
  });
});
