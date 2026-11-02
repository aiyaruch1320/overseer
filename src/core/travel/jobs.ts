// The journeys of a travelling job (01-travel-rules.md §1): legs per life year by job, never more than the days on the road allow and never more than
// the fares can pay (the employer pays for a courier, a guard, a sailor, a sword for hire). The lines of the jobs (sf ps ml wd) open here too
// (25-journeys.md §3 column "เปิดเมื่อ"). A year's legs are made in the year step, as outings that leave the base and come back; now and then the
// last stop becomes the new base (a merchant who settles where the money is).
import type { Ctx } from '../game';
import { holds } from '../character';
import { write } from '../log';
import type { LifeState } from '../types';
import { geo } from './data';
import { pickDestination } from './dest';
import { addOnce, extOf, type TravelExt } from './state';
import { go, queueLine } from './trip';
import { EMPLOYER_PAYS, JOB_ABROAD_SHARE, JOB_CROSS_RATE, JOB_SETTLE_RATE, LINE_JOBS, MIN_AGE, TRAVEL_JOBS } from './tuning';
import { moveMul } from '../god/acts';

/** Legs per life year for the job: the row of the table that names it, else the row of the wanderers (adventurers) or of the sailors. */
function legsOf(ctx: Ctx, job: string): [number, number] | undefined {
  const rows = geo(ctx).travel.jobLegs;
  const named = rows.find((r) => r.jobs.includes(job));
  if (named) return named.legs;
  if (['sailor', 'navigator', 'pirate', 'shipowner', 'airship_pilot', 'ferryman'].includes(job)) return rows.find((r) => r.jobs.includes('sailor'))?.legs;
  if (['caravan_master', 'smuggler', 'guide', 'bounty_hunter'].includes(job)) return rows.find((r) => r.jobs.includes('merchant'))?.legs;
  return rows.find((r) => r.label.startsWith('นักเร่'))?.legs;
}

/** The days on the road in a life year (§1 rule 2: 240 for a travelling job). */
export const roadDays = (ctx: Ctx): number => geo(ctx).travel.legRule.daysJob;

/** Opens the lines that a job opens by itself (once). `ml` waits for the first country beyond the home one (its open condition). */
export function openJobLines(ctx: Ctx, life: LifeState, ex: TravelExt): void {
  if (!life.job) return;
  for (const [line, jobs] of Object.entries(LINE_JOBS)) {
    if (!jobs.includes(life.job) || ex.opened.includes(line)) continue;
    if (line === 'ml' && ex.visited.length < 1) continue;
    queueLine(ctx, line, `job:${life.job}`);
  }
}

/** One life year of a travelling job: the legs it makes. */
export function jobYear(ctx: Ctx, life: LifeState, ex: TravelExt): void {
  const job = life.job;
  if (!job || !TRAVEL_JOBS.has(job) || life.hAge < MIN_AGE || ex.away) return;
  const rng = ctx.rng('life.travel.job');
  // the pilgrim makes one long journey in a life, not a yearly one (§1: "1 ทริปยาวต่อชีวิต")
  if (job === 'pilgrim') {
    if (ex.pilgrim || !rng.chance(0.08)) return;
    const dest = pickDestination(ctx, life, 'ps', rng.chance(0.6));
    ex.pilgrim = true;
    if (dest) go(ctx, dest, 'pilgrimage', { free: false });
    return;
  }
  const range = legsOf(ctx, job);
  if (!range) return;
  let want = range[0] + rng.next() * (range[1] - range[0]);
  want = Math.floor(want) + (rng.next() < want - Math.floor(want) ? 1 : 0);
  if (job === 'merchant' || job === 'peddler') want = Math.max(want, 2);
  const free = EMPLOYER_PAYS.has(job) || holds(ctx, life, 'job', 'shipowner');
  const cap = roadDays(ctx);
  const base = ex.base;
  let legs = 0;
  // an outing is out and back: two legs inside a continent, more across
  for (let guard = 0; legs < want && guard < 4; guard++) {
    if (!rng.chance(moveMul(ctx))) break;
    const abroad = rng.chance(JOB_ABROAD_SHARE);
    if (!abroad) {
      legs += 2; // a round inside the home country: no border crossed, no leg of the table
      continue;
    }
    const cross = rng.chance(JOB_CROSS_RATE);
    const dest = pickDestination(ctx, life, job, !cross);
    if (!dest) continue;
    if ((ex.yearDays[life.hAge] ?? 0) >= cap) break;
    const out = go(ctx, dest, `job:${job}`, { free });
    if (!out.legs) continue;
    legs += out.legs;
    // migration: the last stop becomes home (or the way back is shut and the character is stranded there)
    if (rng.chance(JOB_SETTLE_RATE * (cross ? 6 : 1))) {
      ex.base = life.country;
      write(ctx.state, { sys: 'travel', kind: 'settle', id: life.country, data: { from: base, why: job }, level: 1 });
      return;
    }
    const back = go(ctx, ex.base, 'return', { free: true });
    if (!back.legs) {
      ex.base = life.country;
      return;
    }
    legs += back.legs;
  }
  void addOnce;
}
