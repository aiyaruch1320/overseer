// Birth of the main character, following docs/systems/character/01-origin.md §1 step by step:
// race → special births → half-blood → gender → birth country and parents' cause → class and gold → faith → sign and time →
// lifespan → stats → traits, aptitudes, gifts. Draws come from the streams `life.birth` (who, where, when) and `life.character` (what they are).
import type { Ctx } from '../game';
import { write } from '../log';
import { apply } from '../rules';
import type { Rng } from '../rng';
import type { Axis, Birthplace, OriginFile, Race, StatKey } from '../data/types-character';
import type { Condition, Effect, LifeState } from '../types';
import { AXES, classId, extOf, idx, STAT_KEYS, type CountryLite, type GiftLike, type Indexes } from './data';
import { evalCond } from './jobs';
import { grantGift, grantSkill, grantTrait, raiseAptitude, recomputeDeathAge, tagsOf } from './life';
import {
  AFFINITY,
  APTITUDES_AT_BIRTH,
  AXIS_SPREAD,
  BIG_CITY,
  BIRTH_GIFT,
  BIRTH_TIME_WEIGHT,
  FAVOUR_DEFAULT,
  FAITH_FROM_PIETY,
  PRIMARY_FAITH_WEIGHT,
  RARITY_WEIGHT,
  SIGN_CLASH,
  SIGN_LIKE,
  START_GOLD_FALLBACK,
  SUMMONED_AGE,
  SUMMONED_CLASS,
  WOKEN_AGE,
} from './tuning';
import { LATE_WAKERS } from '../clock';

/** Options for tools and tests; every field left out is drawn. */
export interface BirthOpts {
  race?: string;
  /** Second race of a half-blood; `null` = not a half-blood. */
  second?: string | null;
  country?: string;
  /** World year of the birth; sets the clock. */
  worldYear?: number;
  gender?: 'm' | 'f';
  /** `none` `comet` `eclipse` `fullmoon` `storm`. */
  sign?: string;
  /** `dawn` `day` `dusk` `night`. */
  time?: string;
  /** Allow the special births (summoned, reincarnated) even though race or country was named. */
  special?: boolean;
}

const SUB_HUMAN: Record<string, string> = { NB: 'sub_human_2', AZ: 'sub_human_5', 'SH-01': 'sub_human_3', 'NR-10': 'sub_human_4' };

/** Words in a "only the main land, for children of ..." cell that name the cause of the parents' meeting. */
const CAUSE_WORDS: [RegExp, string][] = [
  [/ทูต/, 'envoy'],
  [/ลี้ภัย/, 'refugee'],
  [/เชลย/, 'captive'],
  [/เนรเทศ/, 'exile'],
  [/สัญญา/, 'contract'],
  [/พ่อค้า/, 'trade'],
  [/ช่าง/, 'craft'],
];

function required<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`character: data/gen/${what}.json is not loaded`);
  return v;
}

const weightedId = <T extends { id: string; w: number }>(rng: Rng, list: readonly T[]): T => list[rng.weighted(list.map((x) => x.w))] ?? list[0];

function weightedCountry(rng: Rng, ix: Indexes, ids: readonly string[], weight: (c: CountryLite) => number): string {
  const list = ids.filter((id) => ix.countries.has(id));
  const pool = list.length ? list : ids;
  if (!pool.length) throw new Error('character: no country to be born in');
  const i = rng.weighted(pool.map((id) => (ix.countries.has(id) ? weight(ix.countries.get(id)!) : 1)));
  return pool[i < 0 ? 0 : i];
}

const scaleOf = (c: CountryLite) => Math.max(1, c.scale);

// ---------- step 4: where ----------

interface Place {
  country: string;
  born: 'main' | 'diaspora' | 'outside';
  meet?: string;
}

/** Countries that cannot be born in any more because the world lost them (events/branches/03 §2): the four-letter AZ lands after DR-01. */
function lost(ctx: Ctx, id: string): boolean {
  return id.startsWith('AZ-') && ctx.state.world.happened['DR-01'] !== undefined;
}

function diasporaOf(ctx: Ctx, ix: Indexes, bp: Birthplace, raceName: string): { id: string; w: number }[] {
  const out = new Map<string, number>();
  for (const id of bp.diaspora) out.set(id, BIG_CITY.listedWeight);
  // 01-origin.md §3 "กติกาเสริม": a country whose file names the race belongs to its diaspora (the dark elf name hides inside the elf name)
  const name = raceName;
  for (const c of ix.countryList) {
    if (bp.main.includes(c.id) || out.has(c.id)) continue;
    const text = name === 'เอลฟ์' ? c.races.replace(/ดาร์กเอลฟ์/g, '') : c.races;
    if (text.includes(name)) out.set(c.id, BIG_CITY.listedWeight);
  }
  if (bp.diasporaBigCity) for (const c of ix.countryList) if (c.scale >= BIG_CITY.scale && !bp.main.includes(c.id) && !out.has(c.id)) out.set(c.id, BIG_CITY.bigWeight);
  return [...out].filter(([id]) => ix.countries.has(id) && !lost(ctx, id)).map(([id, w]) => ({ id, w }));
}

function placeOfRace(ctx: Ctx, ix: Indexes, rng: Rng, bp: Birthplace, raceName: string): Place {
  const roll = rng.next() * 100;
  const main = bp.main.filter((id) => !lost(ctx, id));
  const dia = diasporaOf(ctx, ix, bp, raceName);
  const outside = () => {
    const taken = new Set([...bp.main, ...dia.map((d) => d.id)]);
    const ids = ix.countryList.map((c) => c.id).filter((id) => !taken.has(id) && !lost(ctx, id));
    return weightedCountry(rng, ix, ids, scaleOf);
  };
  if (roll < bp.mainPct && main.length) return { country: weightedCountry(rng, ix, main, scaleOf), born: 'main' };
  if (roll < bp.mainPct + bp.diasporaPct && dia.length) return { country: weightedId(rng, dia).id, born: 'diaspora' };
  return { country: outside(), born: 'outside' };
}

/** 01-origin.md §4 "ถิ่นเกิดและเหตุที่พ่อแม่พบกัน": 70% a meeting land, 30% the main land of one of the two races for children with a special cause. */
function placeOfHalf(ctx: Ctx, ix: Indexes, rng: Rng, o: OriginFile, a: string, b: string): Place | null {
  const row = o.meetingPlaces.find((m) => (m.pair[0] === a && m.pair[1] === b) || (m.pair[0] === b && m.pair[1] === a));
  if (!row) return null;
  const places = row.places.filter((p) => ix.countries.has(p.id) && !lost(ctx, p.id));
  const meet = (): Place => ({ country: weightedId(rng, places.length ? places : row.places).id, born: 'diaspora', meet: weightedId(rng, row.causes).id });
  if (rng.chance(0.7) || !row.mainOnlyCountries.length) return meet();
  const allowed = CAUSE_WORDS.filter(([re]) => re.test(row.mainOnly)).map(([, id]) => id);
  const causes = allowed.length ? row.causes.filter((c) => allowed.includes(c.id)) : row.causes;
  const lands = row.mainOnlyCountries.filter((id) => !lost(ctx, id));
  if (!causes.length || !lands.length) return meet();
  return { country: weightedCountry(rng, ix, lands, scaleOf), born: 'main', meet: weightedId(rng, causes).id };
}

// ---------- step 4ก: class and gold ----------

function classOf(ix: Indexes, rng: Rng, country: CountryLite | undefined, life: LifeState, cause: string | undefined): number {
  const w = country?.w ?? 3;
  const g = country?.g ?? 'กลาง';
  const row = ix.economy?.classByWG.find((r) => r.w === w && r.g === g);
  const pct = row ? [...row.pct] : [5, 25, 45, 20, 5];
  const dragonPrimal = life.race === 'dragonkin' && ['KD-07', 'AZ-02'].includes(life.home);
  if (dragonPrimal) {
    pct[3] *= 2;
    pct[4] *= 2;
  }
  const keep = (...ns: number[]) => pct.forEach((_, i) => { if (!ns.includes(i + 1)) pct[i] = 0; });
  if (life.home === 'NB-13' && life.race === 'human') keep(1); // the shadowless
  if (life.blood === 'sub_winged_1') keep(4, 5); // white aevians rule
  if (['sub_winged_4', 'sub_winged_5', 'sub_winged_6', 'sub_human_5'].includes(life.blood ?? '')) keep(2, 3);
  if ((life.race === 'soulmachine' || life.race === 'construct') && life.home.startsWith('MK-')) keep(1, 2);
  if (cause === 'refugee') keep(1, 2);
  const i = rng.weighted(pct);
  return i < 0 ? 3 : i + 1;
}

function startGold(ctx: Ctx, rng: Rng, cls: number): number {
  const range = idx(ctx).economy?.startGold[cls - 1]?.range ?? START_GOLD_FALLBACK[cls - 1];
  return rng.int(range[0], range[1]);
}

// ---------- step 6: sign and time ----------

function scaleFx(fx: Effect[], mul: number): Effect[] {
  return fx.map((f): Effect => {
    if (f.k === 'favour') return { ...f, mul: (f.mul ?? FAVOUR_DEFAULT) * mul };
    if (f.k === 'grant' && f.chance !== undefined) return { ...f, chance: Math.min(1, f.chance * mul) };
    if (f.k === 'if') return { ...f, then: scaleFx(f.then, mul) };
    return f;
  });
}

function applyBirthSign(ctx: Ctx, life: LifeState, signId: string, timeId: string): void {
  const signs = idx(ctx).origin!.birthSigns;
  for (const id of [signId, timeId]) {
    const s = signs.find((x) => x.id === id);
    if (!s) continue;
    const mul = s.likes.includes(life.race) ? SIGN_LIKE : s.clashes.includes(life.race) ? SIGN_CLASH : 1;
    apply(ctx, mul === 1 ? s.fx : scaleFx(s.fx, mul), { sys: 'character', id: `sign.${id}`, stream: 'life.character' });
  }
}

// ---------- step 8: traits, aptitudes, gifts ----------

const affinity = (plus: readonly string[], minus: readonly string[], id: string) => (plus.includes(id) ? AFFINITY.plus : minus.includes(id) ? AFFINITY.minus : 1);

function drawTraits(ctx: Ctx, rng: Rng, life: LifeState, race: Race, second: Race | undefined, outside: boolean): void {
  const ix = idx(ctx);
  const draw = (plus: readonly string[], minus: readonly string[]): boolean => {
    const pool = ix.traitList.filter((t) => !life.traits.includes(t.id) && !t.conflicts.some((c) => life.traits.includes(c)) && !life.traits.some((o) => ix.traits.get(o)?.conflicts.includes(t.id)));
    const i = rng.weighted(pool.map((t) => affinity(plus, minus, t.id)));
    return i >= 0 && grantTrait(ctx, life, pool[i].id);
  };
  for (let n = 0; n < 3; n++) draw(race.traitPlus, race.traitMinus);
  if (second) {
    // a half-blood takes one more trait from the second race's list (01-origin.md §4)
    const pool = second.traitPlus.filter((t) => ix.traits.has(t) && !life.traits.includes(t));
    if (pool.length) grantTrait(ctx, life, pool[rng.int(0, pool.length - 1)]);
  }
  if (outside) grantTrait(ctx, life, rng.chance(0.5) ? 'homebody' : 'freedom'); // 01-origin.md §5
}

function drawAptitudes(ctx: Ctx, rng: Rng, life: LifeState, race: Race): void {
  const ix = idx(ctx);
  const n = APTITUDES_AT_BIRTH.base + (rng.chance(APTITUDES_AT_BIRTH.threeChance) ? 1 : 0);
  if (race.id === 'slime') raiseAptitude(ctx, life, 'absorb', 1);
  while (Object.keys(life.aptitudes).length < n) {
    const pool = ix.aptitudeList.filter((a) => life.aptitudes[a.id] === undefined && a.id !== 'absorb');
    const i = rng.weighted(pool.map((a) => affinity(race.aptPlus, race.aptMinus, a.id)));
    if (i < 0) break;
    raiseAptitude(ctx, life, pool[i].id, 1);
  }
}

/** Cond kinds a gift's "ได้จาก" cell may hold and still be checked at birth. */
const BIRTH_KINDS = new Set(['continent', 'country', 'race', 'half', 'faith', 'sign', 'has', 'and', 'or', 'not']);
const birthKinds = (c: Condition): boolean => (c.k === 'and' || c.k === 'or' ? c.of.every(birthKinds) : c.k === 'not' ? birthKinds(c.of) : BIRTH_KINDS.has(c.k));

function giftWeight(ctx: Ctx, life: LifeState, race: Race, second: Race | undefined, g: GiftLike): number {
  if (g.race) {
    if (g.race !== race.id && !(second && g.race === second.id && g.tier !== 'L')) return 0;
  } else if (g.from !== '' || g.fromCond.length) {
    if (!g.fromCond.length || !g.fromCond.every(birthKinds) || !g.fromCond.every((c) => evalCond(ctx, c, false))) return 0;
  }
  const plus = g.curse ? race.cursePlus : race.blessPlus;
  const clash = g.curse ? race.curseClash : race.blessClash;
  let w = RARITY_WEIGHT[g.tier] ?? 1;
  if (plus.includes(g.id)) w *= AFFINITY.plus;
  if (clash.includes(g.id)) w *= AFFINITY.clash;
  const f = extOf(life).favour;
  w *= f[`${g.curse ? 'curse' : 'blessing'}:${g.id}`] ?? 1;
  for (const fx of g.fx) if (fx.k === 'grant' && fx.kind === 'tag') w *= f[`tag:${fx.id.replace(/^#/, '')}`] ?? 1;
  return w;
}

function drawGift(ctx: Ctx, rng: Rng, life: LifeState, race: Race, second: Race | undefined, curse: boolean): void {
  const ix = idx(ctx);
  const have = curse ? life.curses : life.blessings;
  const pool = (curse ? ix.curses : ix.blessings).filter((g) => !have.includes(g.id));
  const i = rng.weighted(pool.map((g) => giftWeight(ctx, life, race, second, g)));
  if (i >= 0) grantGift(ctx, life, curse ? 'curse' : 'blessing', pool[i].id);
}

/** Predicates for the conditions the continent gift table writes in words (01-origin.md §6). */
function continentCond(ctx: Ctx, life: LifeState, text: string): boolean {
  if (!text) return true;
  const tags = tagsOf(ctx, life);
  if (text.includes('ไม่ใช่เผ่าปีก')) return life.race !== 'winged';
  if (text.includes('เผ่าไม่ทนไฟ')) return !tags.has('fire_res') && !tags.has('heat_res');
  if (text.includes('เผ่าไม่ใช่สายน้ำ')) return !tags.has('water_breath');
  if (text.includes('ผิวบางไม่ทน')) return !['dry', 'scales', 'stone_blood', 'iron_body', 'lava_body', 'heat_res', 'amorphous', 'mechanical'].some((t) => tags.has(t));
  if (text.includes('ถิ่นสงคราม')) return (ctx.state.world.countryFlags[life.country] ?? []).includes('war');
  const ev = text.match(/[A-Z]{2,3}-\d\d/)?.[0];
  if (ev) return ctx.state.world.happened[ev] !== undefined;
  return false;
}

function drawContinentGifts(ctx: Ctx, rng: Rng, life: LifeState, race: Race): void {
  const row = idx(ctx).origin!.continentGifts.find((c) => c.continent === life.country.slice(0, 2));
  if (!row) return;
  const take = (groups: typeof row.blessings, curse: boolean) => {
    for (const grp of groups) {
      if (grp.chance === null || !continentCond(ctx, life, grp.cond) || !rng.chance(grp.chance)) continue;
      const clash = curse ? race.curseClash : race.blessClash;
      const ids = grp.ids.filter((id) => !clash.includes(id));
      if (ids.length) grantGift(ctx, life, curse ? 'curse' : 'blessing', ids[rng.int(0, ids.length - 1)]);
    }
  };
  take(row.blessings, false);
  take(row.curses, true);
}

// ---------- the parents' cause (01-origin.md §4 table of effects) ----------

function applyMeetCause(ctx: Ctx, life: LifeState, rng: Rng, cause: string, pair: [string, string]): void {
  const ix = idx(ctx);
  const e = extOf(life);
  e.meet = cause;
  life.flags.push(`meet.${cause}`);
  switch (cause) {
    case 'trade': life.gold += 30; break;
    case 'craft': {
      // one related aptitude at level 1: from the lists of the two races
      const ids = [...new Set(pair.flatMap((r) => ix.races.get(r)?.aptPlus ?? []))].filter((a) => ix.aptitudes.has(a) && life.aptitudes[a] === undefined);
      if (ids.length) raiseAptitude(ctx, life, ids[rng.int(0, ids.length - 1)], 1);
      break;
    }
    case 'refugee':
      life.gold = 0;
      e.trust['ผู้ช่วยเหลือ'] = (e.trust['ผู้ช่วยเหลือ'] ?? 0) + 1;
      break;
    case 'captive':
      if (rng.chance(0.05)) grantGift(ctx, life, 'curse', 'c_lonely');
      break;
    case 'contract':
      life.flags.push(pair.includes('fae') ? 'fy_debt' : 'ct_listed');
      break;
    case 'exile': life.flags.push('parents_exiled'); break;
    case 'envoy': e.trust['สองเผ่า'] = (e.trust['สองเผ่า'] ?? 0) + 1; break;
  }
}

// ---------- the whole birth ----------

export function birth(ctx: Ctx, opts: BirthOpts = {}): LifeState {
  const ix = idx(ctx);
  const origin = required(ix.origin, 'origin');
  required(ix.racesFile, 'races');
  const state = ctx.state;
  const brng = ctx.rng('life.birth');
  const crng = ctx.rng('life.character');

  // step 1: race (drawn even when named, so naming it does not move the later draws)
  const drawnRace = weightedId(brng, origin.raceShare).id;
  const raceId = opts.race ?? drawnRace;
  const race = required(ix.races.get(raceId), `races (race ${raceId})`);
  const bp = origin.birthplaces.find((b) => b.race === raceId);
  const free = opts.race === undefined && opts.country === undefined;
  const allowSpecial = free || opts.special === true;

  // step 1ข: special births of humans
  const summoned = allowSpecial && raceId === 'human' && brng.chance(origin.specialBirths.find((s) => s.id === 'summoned')?.chance ?? 0);
  // step 2: half-blood
  const halfRoll = brng.chance((bp?.halfPct ?? 0) / 100);
  let secondId: string | undefined;
  if (!summoned && !origin.noHalf.includes(raceId)) {
    if (opts.second === null) secondId = undefined;
    else if (opts.second) secondId = opts.second;
    else if (halfRoll) {
      const pair = origin.halfPairs.find((p) => p.main === raceId);
      if (pair) secondId = weightedId(brng, pair.second).id;
    }
  }
  const second = secondId ? ix.races.get(secondId) : undefined;
  if (secondId && !second) throw new Error(`character: unknown second race ${secondId}`);

  // step 3: gender
  const g = origin.gender[raceId] ?? { m: 50, f: 50, n: 0 };
  const gi = brng.weighted([g.m, g.f, g.n]);
  const neuter = gi === 2;
  const gender: 'm' | 'f' = opts.gender ?? (gi === 0 ? 'm' : gi === 1 ? 'f' : brng.chance(0.5) ? 'm' : 'f');

  // step 4: country and the cause of the parents' meeting
  let place: Place;
  if (summoned) place = { country: 'AL-02', born: 'diaspora' };
  else if (opts.country) {
    const inMain = bp?.main.includes(opts.country);
    place = { country: opts.country, born: inMain ? 'main' : bp?.diaspora.includes(opts.country) ? 'diaspora' : 'outside' };
    if (second) {
      const row = origin.meetingPlaces.find((m) => m.pair.includes(raceId) && m.pair.includes(secondId!));
      if (row) place.meet = weightedId(brng, row.causes).id;
    }
  } else if (second) {
    place = placeOfHalf(ctx, ix, brng, origin, raceId, secondId!) ?? (bp ? placeOfRace(ctx, ix, brng, bp, race.name) : { country: weightedCountry(brng, ix, ix.countryList.map((c) => c.id), scaleOf), born: 'outside' });
  } else if (bp) place = placeOfRace(ctx, ix, brng, bp, race.name);
  else place = { country: weightedCountry(brng, ix, ix.countryList.map((c) => c.id), scaleOf), born: 'outside' };
  const country = ix.countries.get(place.country);

  // reincarnated: a human born in MH-07 is one half the time
  const reincarnated = !summoned && allowSpecial && raceId === 'human' && place.country === 'MH-07' && brng.chance(origin.specialBirths.find((s) => s.id === 'reincarnated')?.chance ?? 0);

  // blood: the sub-lineage
  const blood = pickBlood(ctx, brng, race, place.country, summoned, reincarnated, second ? `${raceId}+${secondId}` : undefined);

  // faith of the land
  const faith = pickFaith(brng, country);

  // step 6: sign and time
  const signs = origin.birthSignWeights.sign;
  const sign = opts.sign ?? weightedId(brng, signs).id;
  const timeIds = origin.birthSignWeights.time;
  const time = opts.time ?? timeIds[brng.weighted(timeIds.map((t) => BIRTH_TIME_WEIGHT[t] ?? 1))] ?? 'day';

  // lifespan: drawn once, hidden, whole world years (world-time.md §3); a half-blood takes the middle of the two ± 15%
  const lifespan = pickLifespan(brng, race, second, blood, place.country);

  const wakes = LATE_WAKERS.has(raceId);
  const hAge = summoned ? SUMMONED_AGE : wakes ? WOKEN_AGE : 0;
  if (opts.worldYear !== undefined) {
    state.clock.worldYear = opts.worldYear;
    state.clock.worldAcc = 0;
    state.clock.quarter = 0;
  }
  const lineageNo = state.lineage.lives.length + 1;
  const life: LifeState = {
    id: `L${lineageNo}`,
    name: '',
    race: raceId,
    ...(blood ? { blood } : {}),
    gender,
    birthYear: state.clock.worldYear,
    lifespan,
    hAge,
    country: place.country,
    home: place.country,
    traits: [],
    aptitudes: {},
    skills: [],
    blessings: [],
    curses: [],
    fate: [],
    cls: 'c3',
    gold: 0,
    stats: { pow: 1, mag: 1, spd: 1, luk: 1, int: 1, vit: 1 },
    items: [],
    flags: [],
    passed: {},
    pending: [],
    memory: [],
    godFaith: 0,
    heart: 0,
    ext: {},
  };
  const e = extOf(life);
  e.sign = sign;
  e.time = time;
  e.faith = faith;
  e.born = place.born;
  e.neuter = neuter;
  e.startYear = state.clock.worldYear;
  if (secondId) e.second = secondId;
  if (summoned) { e.special = 'summoned'; e.firstNode = 'hu.t2'; life.flags.push('summoned'); }
  else if (reincarnated) { e.special = 'reincarnated'; e.firstNode = 'hu.b1'; life.flags.push('reincarnated'); }
  else if (wakes) e.special = 'woken';
  state.life = life;

  // race tags: all of the main race, each of the second 50% (a weak_* tag always)
  e.raceTags = [...race.tags];
  if (second) for (const t of second.tags) if (!e.raceTags.includes(t) && (t.startsWith('weak_') || crng.chance(ix.origin!.halfStat.secondTagChance))) e.raceTags.push(t);

  // step 7: stats (half-blood: a coin per stat picks the range)
  for (const k of STAT_KEYS) {
    const src = second && crng.chance(origin.halfStat.coin) ? second : race;
    const [lo, hi] = src.stats[k as StatKey];
    life.stats[k] = crng.int(lo, hi);
  }
  for (const [k, v] of Object.entries(race.birthStat ?? {})) life.stats[k as StatKey] += v ?? 0;

  // axes: the race's shift and a spread; traits then move them
  for (const a of AXES) e.axes[a as Axis] = Math.max(-100, Math.min(100, (race.axisShift[a as Axis] ?? 0) + crng.int(-AXIS_SPREAD, AXIS_SPREAD)));

  // step 4ก: class and gold
  let cls = summoned ? SUMMONED_CLASS : classOf(ix, brng, country, life, place.meet);
  const despised = (origin.halfPairs.find((p) => p.main === raceId)?.despisedCountries ?? []).includes(place.country);
  if (second && despised && brng.chance(0.4)) cls = Math.max(1, cls - 1); // economy/03-classes.md §2
  life.cls = classId(cls);
  life.gold = summoned ? 0 : startGold(ctx, brng, cls);
  if (cls === 5) life.flags.push('noble');

  // step 8: traits, aptitudes, then the gifts
  drawTraits(ctx, crng, life, race, second, place.born === 'outside' && !summoned);
  drawAptitudes(ctx, crng, life, race);
  life.skills = [...new Set(life.skills)];
  life.godFaith = Math.round(e.axes.piety / FAITH_FROM_PIETY);

  applyBirthSign(ctx, life, sign, time);
  drawContinentGifts(ctx, crng, life, race);
  if (second && despised) {
    // the land shuns half-bloods (01-origin.md §4): 40% an outcast, 25% alone; an envoy's child 20% and 10%
    const env = place.meet === 'envoy';
    if (crng.chance(env ? 0.2 : 0.4)) grantGift(ctx, life, 'curse', 'c_outcast');
    if (crng.chance(env ? 0.1 : 0.25)) grantGift(ctx, life, 'curse', 'c_lonely');
  }
  if (second && isUnnatural(raceId, secondId!) && crng.chance(0.2)) grantGift(ctx, life, 'blessing', 'nb_both_banks');
  if (place.born !== 'main' && !summoned) {
    life.flags.push('born_outside');
    if (crng.chance(0.3)) grantGift(ctx, life, 'blessing', 'nb_homeland_call');
  }
  if (crng.chance(BIRTH_GIFT.blessing)) drawGift(ctx, crng, life, race, second, false);
  if (crng.chance(BIRTH_GIFT.curse)) drawGift(ctx, crng, life, race, second, true);
  if (crng.chance(BIRTH_GIFT.uniqueSkill) && ix.uniqueSkills.length) grantSkill(ctx, life, ix.uniqueSkills[crng.int(0, ix.uniqueSkills.length - 1)].id);

  if (place.meet && second) applyMeetCause(ctx, life, crng, place.meet, [raceId, secondId!]);
  if (faith) life.flags.push(faith);
  if (sign !== 'none') life.flags.push(`sign_${sign}`);
  life.flags.push(`sign_${time}`);
  if (secondId) life.flags.push('half');
  recomputeDeathAge(ctx, life);
  if (life.dead) delete life.dead;

  write(state, {
    sys: 'character',
    kind: 'birth',
    id: raceId,
    data: {
      race: raceId,
      second: secondId ?? null,
      gender,
      country: place.country,
      born: place.born,
      cls: life.cls,
      sign,
      time,
      hAge,
      special: e.special ?? null,
    },
    level: 3,
  });
  return life;
}

/** Half-bloods of races whose blood clash get the bridge-walker gift (01-origin.md §4 "การผสมที่ผิดธรรมชาติ"). Only the water war pair is written down. */
function isUnnatural(a: string, b: string): boolean {
  return (a === 'naga' && b === 'merfolk') || (a === 'merfolk' && b === 'naga');
}

function pickLifespan(rng: Rng, race: Race, second: Race | undefined, blood: string | undefined, country: string): number {
  if (blood === 'sub_human_2' && country.startsWith('NB-')) return rng.int(70, 120); // mist folk (world-time.md §3)
  if (!second) return rng.int(race.lifespan[0], race.lifespan[1]);
  const mid = (race.lifespan[0] + race.lifespan[1] + second.lifespan[0] + second.lifespan[1]) / 4;
  return Math.round(mid * (1 + (rng.next() * 2 - 1) * 0.15));
}

function pickBlood(ctx: Ctx, rng: Rng, race: Race, country: string, summoned: boolean, reincarnated: boolean, halfPair: string | undefined): string | undefined {
  if (summoned) return 'sub_human_7';
  if (reincarnated) return 'sub_human_6';
  if (halfPair) return halfPair;
  if (race.id === 'human') return SUB_HUMAN[country] ?? SUB_HUMAN[country.slice(0, 2)] ?? 'sub_human_1';
  if (!race.sublines.length) return undefined;
  const bound = race.sublines.filter((s) => s.countries.includes(country));
  if (bound.length && rng.chance(0.8)) return bound[rng.int(0, bound.length - 1)].id;
  const open = race.sublines.filter((s) => s.countries.length === 0);
  const pool = open.length ? open : race.sublines;
  return pool[rng.int(0, pool.length - 1)].id;
}

function pickFaith(rng: Rng, country: CountryLite | undefined): string {
  const list = (country?.religions ?? []).filter((r) => r.id);
  if (!list.length) return '';
  const i = rng.weighted(list.map((r) => (r.primary ? PRIMARY_FAITH_WEIGHT : 1)));
  return list[i < 0 ? 0 : i].id ?? '';
}

