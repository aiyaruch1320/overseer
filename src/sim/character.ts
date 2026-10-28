import { RNG } from './rng';
import type { Axis, Character, Country, FatePoint, StatKey } from './types';
import { AXES, STATS } from './types';
import { RACES, raceById } from '../data/races';
import { TRAITS, TRAIT_CONFLICTS, APTITUDES, SKILLS, UNIQUE_SKILLS, traitById, skillById } from '../data/traits';
import { BLESSINGS, CURSES, giftById } from '../data/gifts';
import { FATES } from '../data/lore';
import { generateWorld } from './worldgen';
import { RARITY, tagAffinity, type Ctx } from './fortune';
import type { Gift } from '../data/gifts';

export const HUMAN_LIFE = 75;

export function makeName(rng: RNG, raceId: string): string {
  const r = raceById(raceId);
  const [a, b, c] = r.syl;
  return rng.pick(a) + (rng.chance(0.4) ? rng.pick(b) : '') + rng.pick(c);
}

export function tagsOf(c: Character): Set<string> {
  const t = new Set<string>(raceById(c.race).tags);
  const add = (fx: string) => (fx.match(/#(\w+)/g) || []).forEach((m) => t.add(m.slice(1)));
  c.traits.forEach((id) => add(traitById(id).fx));
  c.skills.forEach((id) => skillById(id)?.tags.forEach((x) => t.add(x)));
  c.blessings.forEach((id) => giftById(id)?.tags.forEach((x) => t.add(x)));
  c.curses.forEach((id) => giftById(id)?.tags.forEach((x) => t.add(x)));
  c.weapon?.tags.forEach((x) => t.add(x));
  if (c.flags.includes('noble')) t.add('noble');
  if (c.weapon?.kind === 'holy') t.add('holy');
  return t;
}

export function maxHp(c: Character): number {
  return 40 + c.stats.vit * 4;
}

export function stageOf(hAge: number) {
  if (hAge < 4) return 'infant' as const;
  if (hAge < 13) return 'child' as const;
  if (hAge < 20) return 'teen' as const;
  if (hAge < 55) return 'adult' as const;
  return 'elder' as const;
}

export function realAge(c: Character): number {
  return Math.floor((c.hAge * raceById(c.race).lifespan) / HUMAN_LIFE);
}

export function lifespanH(c: Character, tags = tagsOf(c)): number {
  let l = 68 + (c.stats.vit - 10) * 1.2;
  if (tags.has('longevity')) l += 12;
  if (tags.has('short_life')) l -= 22;
  if (tags.has('fast_aging')) l -= 10;
  if (tags.has('undead')) l += 6;
  return Math.max(30, l);
}

function pickTraits(rng: RNG, raceId: string, n: number): string[] {
  const bias = raceById(raceId).traitBias;
  const out: string[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 100) {
    const t = rng.weighted(TRAITS, (x) => (bias.includes(x.id) ? 5 : 1))!;
    if (out.includes(t.id)) continue;
    if (TRAIT_CONFLICTS.some(([a, b]) => (a === t.id && out.includes(b)) || (b === t.id && out.includes(a)))) continue;
    out.push(t.id);
  }
  return out;
}

export function applyAxisFx(axes: Record<Axis, number>, fx: string) {
  for (const tok of fx.split(/\s+/)) {
    const m = tok.match(/^(\w+)([+-]\d+)$/);
    if (m && (AXES as string[]).includes(m[1])) axes[m[1] as Axis] = clampAxis(axes[m[1] as Axis] + parseInt(m[2], 10));
  }
}
export const clampAxis = (v: number) => Math.max(-100, Math.min(100, v));

export function applyStatFx(stats: Record<StatKey, number>, fx: string) {
  for (const tok of fx.split(/\s+/)) {
    const m = tok.match(/^(\w+)([+-]\d+)$/);
    if (m && (STATS as string[]).includes(m[1])) stats[m[1] as StatKey] = Math.max(1, stats[m[1] as StatKey] + parseInt(m[2], 10));
  }
}

export function rollFate(rng: RNG, fromHAge: number, tags: Set<string>): FatePoint[] {
  const n = rng.int(3, 5);
  const pool = FATES.filter((f) => f.age[1] > fromHAge + 1);
  const chosen = rng.sample(pool, Math.min(n, pool.length));
  const fp = chosen.map((f) => ({
    fateId: f.id,
    hAge: Math.max(fromHAge + 2, rng.int(f.age[0], f.age[1])),
    omenShown: false, done: false,
  }));
  if (tags.has('doom') || tags.has('ill_omen')) {
    const bad = FATES.filter((f) => !f.good && f.age[1] > fromHAge + 2);
    const f = rng.pick(bad);
    fp.push({ fateId: f.id, hAge: Math.max(fromHAge + 2, rng.int(f.age[0], f.age[1])), omenShown: false, done: false });
  }
  // keep fates at least 3 years apart
  fp.sort((a, b) => a.hAge - b.hAge);
  for (let i = 1; i < fp.length; i++) if (fp[i].hAge - fp[i - 1].hAge < 3) fp[i].hAge = fp[i - 1].hAge + 3;
  return fp;
}

export interface BirthOptions {
  karma: number;
  dynastyName?: string;
  generation?: number;
}

export const BIRTH_TIMES: [string, number][] = [['dawn', 20], ['day', 35], ['dusk', 15], ['night', 30]];
export const BIRTH_SIGNS: [string, number][] = [['none', 70], ['comet', 6], ['eclipse', 6], ['fullmoon', 10], ['storm', 8]];

// Story context of a character: who they are, where they live, what they were born under, what they have become
export function buildCtx(c: Character, country: Country, threads: Record<string, number>, tags = tagsOf(c)): Ctx {
  const t = new Set<string>([`race:${c.race}`, `climate:${country.climate}`, `religion:${country.religion}`, `birth:${c.birthTime}`, `birthsign:${c.birthSign}`, `stage:${stageOf(c.hAge)}`]);
  if (c.job) t.add(`job:${c.job}`);
  c.flags.forEach((f) => t.add(`flag:${f}`));
  c.traits.forEach((x) => t.add(`trait:${x}`));
  tags.forEach((x) => t.add(`tag:${x}`));
  country.flags.forEach((f) => t.add(`countryflag:${f}`));
  const total = country.races.reduce((a, r) => a + r.w, 0);
  const share = (country.races.find((r) => r.race === c.race)?.w || 0) / total;
  if (share < 0.12) t.add('minority');
  const human = (country.races.find((r) => r.race === 'human')?.w || 0) / total;
  if (human > 0.45 && c.race !== 'human') t.add('human_land');
  if (c.belief >= 50) t.add('belief:devoted');
  if (c.belief <= -30) t.add('belief:heretic');
  return { tags: t, threads };
}

// Weighted draw of a blessing/curse: rarer is less likely, a good story fit is more likely
export function drawGift(rng: RNG, pool: Gift[], ctx: Ctx, exclude: string[] = []): Gift | undefined {
  return rng.weighted(pool.filter((g) => !exclude.includes(g.id)), (g) => RARITY[g.rarity].w * tagAffinity(g.tags, ctx));
}

export function birth(rng: RNG, countries: Country[], opts: BirthOptions): Character {
  const country = rng.weighted(countries, (c) => c.tiles)!;
  const race = rng.weighted(country.races, (r) => r.w)!.race;
  return createCharacter(rng, race, country, 0, opts);
}

export function createCharacter(rng: RNG, raceId: string, country: Country, hAge: number, opts: BirthOptions, gender?: string): Character {
  const countryId = country.id;
  const race = raceById(raceId);
  const birthTime = rng.weighted(BIRTH_TIMES, (x) => x[1])![0];
  const birthSign = rng.weighted(BIRTH_SIGNS, (x) => x[1])![0];
  const towns = generateWorld().towns;
  const townId = rng.weighted(country.towns, (id) => towns[id].size)!;
  const g = gender || rng.weighted(race.genders, (x) => x[1])![0];
  const stats = { ...race.base };
  for (const k of STATS) stats[k] = Math.max(2, stats[k] + rng.int(-2, 2));
  if (opts.karma > 20) stats.luk += 1;
  if (opts.karma > 60) stats.luk += 1;
  const axes = {} as Record<Axis, number>;
  for (const a of AXES) axes[a] = clampAxis((race.axis[a] || 0) + rng.int(-20, 20));
  const traits = pickTraits(rng, raceId, 3);
  traits.forEach((t) => applyAxisFx(axes, traitById(t).fx));

  const aptitudes: string[] = raceId === 'slime' ? ['absorb'] : [];
  const nApt = rng.chance(0.25) ? 3 : 2;
  while (aptitudes.length < nApt) {
    const a = rng.weighted(APTITUDES, (x) => (x.id === 'absorb' ? 0 : race.aptBias.includes(x.id) ? 6 : 1))!;
    if (!aptitudes.includes(a.id)) aptitudes.push(a.id);
  }
  const skills = [`${aptitudes[0]}_1`];
  const blessings: string[] = [];
  const curses: string[] = [];
  // a provisional character to read the birth context from
  const proto = { race: raceId, traits, skills, blessings, curses, flags: [], job: null, hAge, birthTime, birthSign, belief: 0, weapon: null } as unknown as Character;
  const ctx = buildCtx(proto, country, {}, tagsOf(proto));
  const pBless = 0.3 + Math.max(0, opts.karma) / 300 + (birthSign === 'comet' ? 0.2 : 0) + (birthTime === 'dawn' ? 0.05 : 0);
  const pCurse = 0.25 + Math.max(0, -opts.karma) / 200 + (birthSign === 'eclipse' ? 0.2 : 0);
  if (rng.chance(pBless)) blessings.push(drawGift(rng, BLESSINGS, ctx)!.id);
  if (rng.chance(pCurse)) curses.push(drawGift(rng, CURSES, ctx)!.id);
  if (rng.chance(0.02 + Math.max(0, opts.karma) / 1000 + (birthSign === 'comet' ? 0.03 : 0))) skills.push(rng.pick(UNIQUE_SKILLS).id);
  for (const id of [...blessings, ...curses]) {
    const fx = giftById(id).fx;
    applyStatFx(stats, fx);
    applyAxisFx(axes, fx);
  }
  for (const id of skills) applyStatFx(stats, skillById(id).fx);

  const c: Character = {
    name: makeName(rng, raceId), race: raceId, gender: g, countryId, townId, birthTime, birthSign, birthCountryId: countryId, hAge,
    stats, axes, traits, aptitudes, skills, blessings, curses, job: null, secretJob: false,
    hp: 0, gold: rng.int(0, 15), fame: 0, flags: [], relations: [], children: [], weapon: null, fate: [],
    belief: Math.round(axes.piety / 3), alive: true, revived: false,
    generation: opts.generation || 1, dynastyName: opts.dynastyName || makeName(rng, raceId), kills: 0,
  };
  if (blessings.includes('b_nobleblood')) c.flags.push('noble');
  if (rng.chance(0.06)) c.flags.push('noble');
  c.hp = maxHp(c);
  c.fate = rollFate(rng, hAge, tagsOf(c));
  return c;
}

export function skillName(id: string) {
  return skillById(id)?.name || id;
}

export const allSkillIds = () => SKILLS.map((s) => s.id);
export const randomRace = (rng: RNG) => rng.pick(RACES).id;
