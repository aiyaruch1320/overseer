// Operations on a living character: the numbers it carries, what it has, tags, and giving or taking away traits,
// aptitudes, skills, blessings, curses and flags. Everything here is plain functions over the state (code-plan §2).
import type { Ctx } from '../game';
import type { Axis, Skill, StatKey } from '../data/types-character';
import type { Effect, IdKind, LifeState } from '../types';
import { AXES, clamp, classId, classNum, extOf, idx, STAT_KEYS, type GiftLike } from './data';
import { LONGEVITY, NATURAL_DEATH_AGE, SHORT_LIFE, TRUST_COUNTS_AT } from './tuning';

// ---------- the numbers (stat names the docs use) ----------

/** Every name a document uses for a number of the character, mapped to the one canonical key. */
export const STAT_ALIASES: Record<string, string> = {
  pow: 'pow', mag: 'mag', spd: 'spd', luk: 'luk', int: 'int', vit: 'vit',
  พลัง: 'pow', กำลัง: 'pow', เวท: 'mag', magic: 'mag', ความเร็ว: 'spd', เร็ว: 'spd', โชค: 'luk', ปัญญา: 'int', พลังชีวิต: 'vit', ทน: 'vit',
  gold: 'gold', ทอง: 'gold', ทองเริ่มต้น: 'gold',
  fame: 'fame', ชื่อเสียง: 'fame',
  brave: 'brave', kind: 'kind', ambition: 'ambition', piety: 'piety', curious: 'curious', honest: 'honest', temper: 'temper', social: 'social',
  courage: 'brave',
  godFaith: 'godFaith', ศรัทธาเทพ: 'godFaith', belief: 'godFaith',
  heart: 'heart', ภาระใจ: 'heart',
  class: 'class', ชนชั้น: 'class', ชั้น: 'class',
  hp: 'hp',
  allyLevel: 'allyLevel',
  ความถนัดอาชีพ: 'jobApt', ความถนัดของอาชีพ: 'jobApt',
};

const isStatKey = (k: string): k is StatKey => (STAT_KEYS as readonly string[]).includes(k);
const isAxis = (k: string): k is Axis => (AXES as readonly string[]).includes(k);

/** Reads a canonical number. */
export function readCanon(ctx: Ctx, life: LifeState, key: string): number {
  const e = extOf(life);
  if (isStatKey(key)) return life.stats[key];
  if (isAxis(key)) return e.axes[key];
  switch (key) {
    case 'gold': return life.gold;
    case 'fame': return e.fame;
    case 'godFaith': return life.godFaith;
    case 'heart': return life.heart;
    case 'class': return classNum(life);
    case 'hp': return e.hpBonus;
    case 'allyLevel': return e.allyLevel;
    case 'jobApt': {
      const a = jobAptitude(ctx, life);
      return a ? life.aptitudes[a] ?? 0 : 0;
    }
  }
  return 0;
}

/** Changes a canonical number by a delta (rounded to a whole number); returns the change that happened. */
export function addCanon(ctx: Ctx, life: LifeState, key: string, delta: number): void {
  const e = extOf(life);
  const d = Math.round(delta);
  if (isStatKey(key)) life.stats[key] = Math.max(1, life.stats[key] + d);
  else if (isAxis(key)) e.axes[key] = clamp(e.axes[key] + d, -100, 100);
  else
    switch (key) {
      case 'gold': life.gold = Math.max(0, life.gold + d); break;
      case 'fame': e.fame += d; break;
      case 'godFaith': life.godFaith = clamp(life.godFaith + d, -100, 100); break;
      case 'heart': life.heart = Math.max(0, life.heart + d); break;
      case 'class': life.cls = classId(classNum(life) + d); break;
      case 'hp': e.hpBonus += d; break;
      case 'allyLevel': e.allyLevel = Math.max(0, e.allyLevel + d); break;
      case 'jobApt': if (d > 0) raiseJobAptitude(ctx, life, d); break;
    }
}

/** Trust toward one people (key as the docs write it), or the count of peoples trusted at least `TRUST_COUNTS_AT`. */
export function trustOf(life: LifeState, who?: string): number {
  const t = extOf(life).trust;
  if (who === undefined) return Object.values(t).filter((v) => v >= TRUST_COUNTS_AT).length;
  return t[who] ?? 0;
}

// ---------- tags ----------

const bare = (t: string) => t.replace(/^#/, '');

function fxTags(fx: readonly Effect[] | undefined, out: Set<string>) {
  for (const f of fx ?? []) if (f.k === 'grant' && f.kind === 'tag') out.add(bare(f.id));
}

/** Every tag the character has: race, traits, skills, blessings, curses and tags granted by effects (`necro` `holy` `huge` ...). */
export function tagsOf(ctx: Ctx, life: LifeState): Set<string> {
  const ix = idx(ctx);
  const e = extOf(life);
  const out = new Set<string>(e.raceTags.map(bare));
  for (const t of e.tags) out.add(bare(t));
  for (const id of life.traits) fxTags(ix.traits.get(id)?.fx, out);
  for (const id of life.skills) fxTags(ix.skills.get(id)?.fx, out);
  for (const id of [...life.blessings, ...life.curses]) fxTags(ix.gifts.get(id)?.fx, out);
  if (life.flags.includes('noble')) out.add('noble');
  return out;
}

// ---------- holding things ----------

const ofKind = (life: LifeState, kind: IdKind): string[] | undefined => {
  switch (kind) {
    case 'trait': return life.traits;
    case 'skill': return life.skills;
    case 'blessing': return life.blessings;
    case 'curse': return life.curses;
    case 'story':
    case 'flag': return life.flags;
    case 'weapon':
    case 'gear':
    case 'material': return life.items;
    case 'companion': return extOf(life).companions;
    case 'tag': return extOf(life).tags;
  }
  return undefined;
};

const matches = (list: readonly string[], id: string): boolean => {
  if (id.endsWith('*')) {
    const p = id.slice(0, -1);
    return list.some((x) => x.startsWith(p));
  }
  return list.includes(id);
};

/** Splits `sword_3` / `ns_mediate_2` into [`sword`, 3]; null when the id has no trailing level. */
export function levelId(id: string): [string, number] | null {
  const m = id.match(/^(.*)_([1-9])$/);
  return m ? [m[1], Number(m[2])] : null;
}

export function skillLevel(ctx: Ctx, life: LifeState, base: string): number {
  const apt = life.aptitudes[base];
  if (apt) return apt;
  return extOf(life).skillLevels[base] ?? (life.skills.includes(base) ? 1 : 0);
}

/** `has` in the grammar: any kind of id the character holds (an id ending in `*` is a prefix; `level` for aptitudes and levelled skills). */
export function holds(ctx: Ctx, life: LifeState, kind: IdKind, id: string, level?: number): boolean {
  const e = extOf(life);
  switch (kind) {
    case 'aptitude':
      if (id.endsWith('*')) return Object.keys(life.aptitudes).some((k) => k.startsWith(id.slice(0, -1)));
      return (life.aptitudes[id] ?? 0) >= (level ?? 1);
    case 'skill': {
      if (id.endsWith('*')) return matches(life.skills, id);
      const lv = levelId(id);
      if (level !== undefined) return skillLevel(ctx, life, id) >= level;
      if (lv) return life.skills.includes(id) || skillLevel(ctx, life, lv[0]) >= lv[1];
      return life.skills.includes(id) || (life.aptitudes[id] ?? 0) >= 1;
    }
    case 'job':
      if (id.endsWith('*')) return !!life.job && life.job.startsWith(id.slice(0, -1));
      return life.job === id || life.secretJob === id;
    case 'tag': return matchesTag(tagsOf(ctx, life), id);
    case 'flag':
    case 'story': return matches(life.flags, id) || (kind === 'flag' && (matches(e.tags, id) || e.special === id));
    case 'enemy':
    case 'unknown':
      return matches(life.flags, id) || matchesTag(tagsOf(ctx, life), id) || matches(life.traits, id) || matches(life.blessings, id) || matches(life.curses, id) || matches(life.skills, id) || matches(life.items, id) || life.job === id;
    default: {
      const list = ofKind(life, kind);
      return !!list && matches(list, id);
    }
  }
}

function matchesTag(tags: Set<string>, id: string): boolean {
  const t = bare(id);
  if (t.endsWith('*')) {
    const p = t.slice(0, -1);
    for (const x of tags) if (x.startsWith(p)) return true;
    return false;
  }
  return tags.has(t);
}

// ---------- giving and taking ----------

/** Applies the number changes of a trait, skill or gift (`pow+1`), and the flags it grants; tags are read from the data, not copied. */
function applyFx(ctx: Ctx, life: LifeState, fx: readonly Effect[] | undefined, sign: 1 | -1): void {
  for (const f of fx ?? []) {
    if (f.k === 'stat') {
      const key = STAT_ALIASES[f.stat];
      if (key) addCanon(ctx, life, key, sign * f.delta);
    } else if (f.k === 'grant' && f.kind === 'flag') {
      if (sign > 0 && !life.flags.includes(f.id)) life.flags.push(f.id);
      if (sign < 0) life.flags = life.flags.filter((x) => x !== f.id);
    }
  }
}

/** Gives a trait unless the character has it or holds one that conflicts with it. */
export function grantTrait(ctx: Ctx, life: LifeState, id: string): boolean {
  if (life.traits.includes(id)) return false;
  const ix = idx(ctx);
  const t = ix.traits.get(id);
  if (t) {
    if (t.conflicts.some((c) => life.traits.includes(c))) return false;
    if (life.traits.some((o) => ix.traits.get(o)?.conflicts.includes(id))) return false;
  }
  life.traits.push(id);
  applyFx(ctx, life, t?.fx, 1);
  return true;
}

export function grantGift(ctx: Ctx, life: LifeState, kind: 'blessing' | 'curse', id: string): boolean {
  const list = kind === 'blessing' ? life.blessings : life.curses;
  if (list.includes(id)) return false;
  list.push(id);
  applyFx(ctx, life, idx(ctx).gifts.get(id)?.fx, 1);
  recomputeDeathAge(ctx, life);
  return true;
}

/** Raises an aptitude to `level` (never lowers it); each level adds its skill and the stat bonus of that level. */
export function raiseAptitude(ctx: Ctx, life: LifeState, id: string, level: number): boolean {
  const ix = idx(ctx);
  const cur = life.aptitudes[id] ?? 0;
  const to = Math.min(3, level);
  if (to <= cur) return false;
  const apt = ix.aptitudes.get(id);
  life.aptitudes[id] = to;
  for (let l = cur + 1; l <= to; l++) {
    const sid = `${id}_${l}`;
    if (!life.skills.includes(sid)) life.skills.push(sid);
    if (apt) addCanon(ctx, life, apt.stat, bonusOf(ix.skills.get(sid), l) - bonusOf(ix.skills.get(`${id}_${l - 1}`), l - 1));
  }
  return true;
}

const bonusOf = (s: Skill | undefined, level: number): number => (level <= 0 ? 0 : s?.bonus ?? level);

/** Gives a skill. `sword_2` raises the aptitude; `ns_x` with a level sets the level of a new skill. */
export function grantSkill(ctx: Ctx, life: LifeState, id: string, level?: number): boolean {
  const ix = idx(ctx);
  const lv = levelId(id);
  if (lv && (ix.aptitudes.has(lv[0]) || life.aptitudes[lv[0]] !== undefined)) return raiseAptitude(ctx, life, lv[0], lv[1]);
  if (ix.aptitudes.has(id)) return raiseAptitude(ctx, life, id, level ?? 1);
  const e = extOf(life);
  const base = lv && ix.skills.has(lv[0]) ? lv[0] : id;
  const to = lv && base !== id ? lv[1] : level ?? 1;
  const had = life.skills.includes(base);
  const prev = e.skillLevels[base] ?? (had ? 1 : 0);
  if (had && to <= prev) return false;
  if (!had) {
    life.skills.push(base);
    applyFx(ctx, life, ix.skills.get(base)?.fx, 1);
  }
  e.skillLevels[base] = Math.max(prev, to);
  return true;
}

/** Gives anything by kind. Returns whether the character changed. */
export function giveId(ctx: Ctx, life: LifeState, kind: IdKind, id: string, level?: number): boolean {
  const e = extOf(life);
  switch (kind) {
    case 'trait': return grantTrait(ctx, life, id);
    case 'aptitude': return raiseAptitude(ctx, life, id, level ?? 1);
    case 'skill': return grantSkill(ctx, life, id, level);
    case 'blessing':
    case 'curse': return grantGift(ctx, life, kind, id);
    case 'story':
    case 'flag':
      if (life.flags.includes(id)) return false;
      life.flags.push(id);
      return true;
    case 'tag': {
      const t = bare(id);
      if (e.tags.includes(t)) return false;
      e.tags.push(t);
      recomputeDeathAge(ctx, life);
      return true;
    }
    case 'companion':
      if (e.companions.includes(id)) return false;
      e.companions.push(id);
      return true;
    case 'weapon':
    case 'gear':
    case 'material':
      life.items.push(id);
      return true;
    default:
      return false;
  }
}

/** Takes something away; stat changes of a trait, skill or gift are undone. */
export function takeId(ctx: Ctx, life: LifeState, kind: IdKind, id: string): boolean {
  const ix = idx(ctx);
  const e = extOf(life);
  const drop = (list: string[], pick: (x: string) => boolean): string[] => list.filter((x) => !pick(x));
  const wanted = (x: string) => (id.endsWith('*') ? x.startsWith(id.slice(0, -1)) : x === id);
  switch (kind) {
    case 'trait': {
      const gone = life.traits.filter(wanted);
      if (!gone.length) return false;
      life.traits = drop(life.traits, wanted);
      for (const g of gone) applyFx(ctx, life, ix.traits.get(g)?.fx, -1);
      return true;
    }
    case 'blessing':
    case 'curse': {
      const list = kind === 'blessing' ? life.blessings : life.curses;
      const gone = list.filter(wanted);
      if (!gone.length) return false;
      const rest = drop(list, wanted);
      if (kind === 'blessing') life.blessings = rest;
      else life.curses = rest;
      for (const g of gone) applyFx(ctx, life, ix.gifts.get(g)?.fx, -1);
      recomputeDeathAge(ctx, life);
      return true;
    }
    case 'skill': {
      const gone = life.skills.filter(wanted);
      if (!gone.length) return false;
      life.skills = drop(life.skills, wanted);
      for (const g of gone) {
        applyFx(ctx, life, ix.skills.get(g)?.fx, -1);
        delete e.skillLevels[g];
      }
      return true;
    }
    case 'aptitude': {
      const keys = Object.keys(life.aptitudes).filter(wanted);
      if (!keys.length) return false;
      for (const k of keys) delete life.aptitudes[k];
      return true;
    }
    case 'story':
    case 'flag': {
      const before = life.flags.length;
      life.flags = drop(life.flags, wanted);
      return life.flags.length !== before;
    }
    case 'tag': {
      const t = bare(id);
      const before = e.tags.length;
      e.tags = e.tags.filter((x) => x !== t);
      recomputeDeathAge(ctx, life);
      return e.tags.length !== before;
    }
    case 'companion': {
      const before = e.companions.length;
      e.companions = drop(e.companions, wanted);
      return e.companions.length !== before;
    }
    case 'weapon':
    case 'gear':
    case 'material': {
      const before = life.items.length;
      life.items = drop(life.items, wanted);
      return life.items.length !== before;
    }
    case 'job':
      if (life.job && wanted(life.job)) {
        delete life.job;
        delete life.secretJob;
        delete e.jobSince;
        return true;
      }
      return false;
  }
  return false;
}

// ---------- the natural death age ----------

/** hAge of the natural death: 75, moved by `#longevity` (02-race-affinity.md §ค), `#short_life` and `#fast_aging`; SR-32 and SR-33 cancel pairs. */
export function recomputeDeathAge(ctx: Ctx, life: LifeState): void {
  const e = extOf(life);
  const tags = tagsOf(ctx, life);
  let long = tags.has('longevity');
  let short = tags.has('short_life');
  let fast = tags.has('fast_aging');
  if (long && short) long = short = false; // SR-33
  if (life.blessings.includes('b_youth') && (short || fast)) {
    // SR-32
    long = false;
    short = false;
    fast = false;
  }
  let age = NATURAL_DEATH_AGE;
  if (long) {
    const race = idx(ctx).races.get(life.race);
    const mid = race ? (race.lifespan[0] + race.lifespan[1]) / 2 : 75;
    const pct = mid >= LONGEVITY.highMid ? LONGEVITY.highPct : mid < LONGEVITY.lowMid ? LONGEVITY.lowPct : LONGEVITY.midPct;
    age = Math.round(age * (1 + pct));
  }
  if (short) age -= SHORT_LIFE.shortLife;
  if (fast) age -= SHORT_LIFE.fastAging;
  e.deathAge = age;
}

// ---------- jobs: the aptitude a job grows ----------

/** The aptitude the job grows: the first of the job's aptitudes the character has below level 3, else the first the job names. */
export function jobAptitude(ctx: Ctx, life: LifeState): string | undefined {
  const job = life.job ? idx(ctx).jobs.get(life.job) : undefined;
  if (!job || !job.apts.length) return undefined;
  return job.apts.find((a) => (life.aptitudes[a] ?? 0) > 0 && (life.aptitudes[a] ?? 0) < 3) ?? job.apts.find((a) => (life.aptitudes[a] ?? 0) === 0) ?? job.apts[0];
}

export function raiseJobAptitude(ctx: Ctx, life: LifeState, by: number): boolean {
  const apt = jobAptitude(ctx, life);
  if (!apt) return false;
  return raiseAptitude(ctx, life, apt, (life.aptitudes[apt] ?? 0) + by);
}

export type { GiftLike };
