// Jobs (docs/systems/character/08 to 11): the requirement and ban check, giving a job, the offer of common jobs,
// the growth of the job's aptitude, and the yearly roll for secret jobs.
import type { Ctx } from '../game';
import { write } from '../log';
import { test, type EffectSource } from '../rules';
import type { Job } from '../data/types-character';
import type { Condition, IdKind, LifeState } from '../types';
import { extOf, idx } from './data';
import { holds, jobAptitude, raiseAptitude, tagsOf } from './life';
import { ADULT_AGE, JOBS, SECRET } from './tuning';

/**
 * Evaluates a job condition. `and` `or` `not` `anyOf` and prose (`text`) are read here; every other kind goes through the rules registry.
 * `want` is the value a prose atom takes (positive polarity): prose the generator could not turn into a rule cannot be checked,
 * so the caller says which way to lean. It flips under `not`.
 */
export function evalCond(ctx: Ctx, c: Condition, want: boolean): boolean {
  switch (c.k) {
    case 'and': return c.of.every((x) => evalCond(ctx, x, want));
    case 'or': return c.of.some((x) => evalCond(ctx, x, want));
    case 'not': return !evalCond(ctx, c.of, !want);
    case 'text': return want;
    case 'anyOf': {
      const life = ctx.state.life;
      if (!life) return false;
      return c.ids.filter((id) => holds(ctx, life, c.kind as IdKind, id)).length >= c.min;
    }
    default: return test(ctx, c);
  }
}

/**
 * Why a character cannot have the job, or null when it can. `lenient`: prose conditions count as met in a requirement and
 * as not triggering in a ban (a story gave the job; the prose is advice). `strict`: the opposite (the yearly roll for secret jobs).
 */
export function ineligible(ctx: Ctx, job: Job, mode: 'lenient' | 'strict'): 'req' | 'ban' | null {
  const lenient = mode === 'lenient';
  if (!job.req.every((c) => evalCond(ctx, c, lenient))) return 'req';
  if (job.ban.some((c) => evalCond(ctx, c, !lenient))) return 'ban';
  return null;
}

const lifeOf = (ctx: Ctx): LifeState | null => (ctx.state.life && !ctx.state.life.dead ? ctx.state.life : null);

/**
 * Gives a job. Checks the requirement and the ban first (a miss is written to the log and nothing is given).
 * A secret job replaces the job; a character with a secret job takes no common job.
 */
export function grantJob(ctx: Ctx, id: string, src: Pick<EffectSource, 'sys' | 'id'>, opts: { force?: boolean } = {}): boolean {
  const life = lifeOf(ctx);
  if (!life) return false;
  const job = idx(ctx).jobs.get(id);
  const fail = (reason: string) => {
    write(ctx.state, { sys: 'character', kind: 'jobFail', id, data: { job: id, reason, from: src.id ?? src.sys }, level: 1 });
    return false;
  };
  if (!job) return fail('unknown');
  if (life.job === id) return false;
  if (!opts.force) {
    const why = ineligible(ctx, job, 'lenient');
    if (why) return fail(why);
  }
  if (job.kind === 'common' && life.secretJob && !opts.force) return fail('secret');
  life.job = id;
  if (job.kind === 'secret') life.secretJob = id;
  extOf(life).jobSince = life.hAge;
  write(ctx.state, { sys: 'character', kind: 'job', id, data: { job: id, type: job.kind, from: src.id ?? src.sys }, level: job.kind === 'common' ? 2 : 3 });
  return true;
}

// ---------- the offer of common jobs (08-jobs-overview.md §1) ----------

/** Weight of a common job for this character; 0 when it cannot be offered. */
export function jobWeight(ctx: Ctx, job: Job): number {
  const life = ctx.state.life!;
  if (job.kind !== 'common') return 0;
  if (ineligible(ctx, job, 'lenient')) return 0;
  const ix = idx(ctx);
  const rules = ix.jobRules;
  const match = job.apts.filter((a) => (life.aptitudes[a] ?? 0) > 0).length;
  const stat = job.mainStat ?? ix.aptitudes.get(job.apts[0])?.stat;
  const statValue = stat ? life.stats[stat] : 0;
  const raceBonus = job.raceBonus.includes(life.race) ? rules?.raceBonus ?? JOBS.raceBonus : 0;
  const root = rules?.rarityRoot?.[job.tier ?? 'C'] ?? JOBS.rarityRoot[job.tier ?? 'C'] ?? 1;
  return (1 + match * (rules?.aptMatchWeight ?? JOBS.aptMatch) + statValue / 6 + raceBonus) * root;
}

/** Three different common jobs, drawn by weight (the player's character then chooses one). */
export function offerJobs(ctx: Ctx, opts: { exclude?: string[]; stream?: string } = {}): string[] {
  const life = lifeOf(ctx);
  if (!life) return [];
  const rng = ctx.rng(opts.stream ?? 'life.character');
  const pool = idx(ctx).jobList.filter((j) => !opts.exclude?.includes(j.id)).map((j) => ({ id: j.id, w: jobWeight(ctx, j) }));
  const out: string[] = [];
  for (let n = 0; n < JOBS.offerCount; n++) {
    const i = rng.weighted(pool.map((p) => p.w));
    if (i < 0) break;
    out.push(pool[i].id);
    pool[i].w = 0;
  }
  return out;
}

/** The character takes one of the offered jobs, by weight (what a coming-of-age or a change of job does when the player is not asked). */
export function chooseJob(ctx: Ctx, opts: { exclude?: string[] } = {}): string | null {
  const life = lifeOf(ctx);
  if (!life) return null;
  const offer = offerJobs(ctx, opts);
  if (!offer.length) return null;
  const rng = ctx.rng('life.character');
  const ix = idx(ctx);
  const pick = offer[rng.weighted(offer.map((id) => jobWeight(ctx, ix.jobs.get(id)!)))] ?? offer[0];
  return grantJob(ctx, pick, { sys: 'character', id: 'offer' }) ? pick : null;
}

// ---------- the yearly work of a job ----------

/** The aptitude of the job grows 30% a year (08-jobs-overview.md §3), 40% with `nb_hard_worker`, 50% after 40 with `nb_late_bloom`. */
export function growJob(ctx: Ctx, life: LifeState): void {
  const job = life.job ? idx(ctx).jobs.get(life.job) : undefined;
  if (!job || !job.apts.length) return;
  const apt = jobAptitude(ctx, life);
  if (!apt || (life.aptitudes[apt] ?? 0) >= JOBS.maxAptitudeLevel) return;
  let p = idx(ctx).jobRules?.yearlyUpgradeChance ?? JOBS.growthChance;
  if (life.blessings.includes('nb_hard_worker')) p = 0.4;
  if (life.blessings.includes('nb_late_bloom')) p = life.hAge < 40 ? p / 2 : 0.5;
  if (ctx.rng('life.character').chance(p)) raiseAptitude(ctx, life, apt, (life.aptitudes[apt] ?? 0) + 1);
}

/** A change of common job: 0.5% a year, 0.2% for slow life, 1.5% with `freedom` (08-jobs-overview.md §3). */
export function maybeChangeJob(ctx: Ctx, life: LifeState): void {
  const job = life.job ? idx(ctx).jobs.get(life.job) : undefined;
  if (!job || job.kind !== 'common' || life.secretJob) return;
  const rules = idx(ctx).jobRules;
  const p = life.traits.includes('freedom') ? rules?.freedomChangeChance ?? JOBS.freedomChangeChance : job.slow ? rules?.slowLifeChangeChance ?? JOBS.slowChangeChance : rules?.jobChangeChancePerYear ?? JOBS.changeChance;
  if (ctx.rng('life.character').chance(p)) chooseJob(ctx, { exclude: [job.id] });
}

// ---------- secret jobs (10-jobs-secret.md §ง) ----------

/** Yearly chance of being offered a secret job, or 0 when its conditions are not met. */
export function secretChance(ctx: Ctx, life: LifeState, job: Job): { chance: number; direct: boolean } {
  if (ineligible(ctx, job, 'strict')) return { chance: 0, direct: false };
  const e = extOf(life);
  const passed = (n: { id: string; choice?: 'a' | 'b' | 'c' }) => (n.choice ? life.passed[n.id] === n.choice : life.passed[n.id] !== undefined);
  const refused = e.refused.includes(job.id);
  if (!refused && (job.direct ?? []).some(passed)) return { chance: 1, direct: true };
  let p = refused ? SECRET.retry : job.baseChance ?? SECRET.base;
  if ((job.assist ?? []).some(passed)) p *= SECRET.assistMul;
  if ((job.linked?.events ?? []).some((ev) => ctx.state.world.happened[ev] !== undefined)) p *= SECRET.eventMul;
  if (life.blessings.includes('b_fateweaver') || life.blessings.includes('b_destiny')) p *= SECRET.destinyMul;
  return { chance: Math.min(p, idx(ctx).jobRules?.secretMaxChance ?? SECRET.max), direct: false };
}

/** Once a life year after coming of age: one roll per secret job whose conditions hold; a pass is an offer the character takes or refuses. */
export function rollSecretJobs(ctx: Ctx, life: LifeState): string | null {
  if (life.secretJob || life.hAge < ADULT_AGE) return null;
  const rng = ctx.rng('life.character');
  const e = extOf(life);
  for (const job of idx(ctx).jobList) {
    if (job.kind !== 'secret') continue;
    const { chance } = secretChance(ctx, life, job);
    if (chance <= 0 || !rng.chance(chance)) continue;
    if (rng.chance(SECRET.accept)) {
      grantJob(ctx, job.id, { sys: 'character', id: 'secret' }, { force: true });
      return job.id;
    }
    if (!e.refused.includes(job.id)) e.refused.push(job.id);
    write(ctx.state, { sys: 'character', kind: 'secretJobRefused', id: job.id, data: { job: job.id }, level: 2 });
  }
  return null;
}

export { tagsOf };
