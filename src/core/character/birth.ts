// Birth of the main character, following docs/systems/character/01-origin.md §1 step by step:
// race → special births → half-blood → gender → birth country and parents' cause → class and gold → faith → sign and time →
// lifespan → stats → traits, aptitudes, gifts. Draws come from the streams `life.birth` (who, where, when) and `life.character` (what they are).
// A wish (`BirthOpts.wish`, wish.ts) replaces the draw of the step it names and leaves every other draw where it was (19-wish.md rule 6); what the
// birth could not keep it refuses with a reason and writes both to `life.ext.character.wish`.
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
  WISH_WEIGHT,
  WISH_WORDS,
  SIGN_CLASH,
  SIGN_LIKE,
  START_GOLD_FALLBACK,
  SUMMONED_AGE,
  SUMMONED_CLASS,
  WOKEN_AGE,
  WISH_CITY_SCALE,
} from './tuning';
import { LATE_WAKERS } from '../clock';
import type { WishAsk, WishSheet } from './wish';
import { startWishLife } from './wish-apply';

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
  /** The wish of the player, read by `readWish` (wish.ts): what it asks is applied, the rest is drawn. The fields above stand over it. */
  wish?: WishSheet;
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
function placeOfHalf(ctx: Ctx, ix: Indexes, rng: Rng, o: OriginFile, a: string, b: string, allow?: (id: string) => boolean): Place | null {
  const row = o.meetingPlaces.find((m) => (m.pair[0] === a && m.pair[1] === b) || (m.pair[0] === b && m.pair[1] === a));
  if (!row) return null;
  const places = row.places.filter((p) => ix.countries.has(p.id) && !lost(ctx, p.id) && (!allow || allow(p.id)));
  if (allow && !places.length) return null; // the wish names a land where this pair does not meet
  const meet = (): Place => ({ country: weightedId(rng, places.length ? places : row.places).id, born: 'diaspora', meet: weightedId(rng, row.causes).id });
  if (rng.chance(0.7) || !row.mainOnlyCountries.length || (allow && !row.mainOnlyCountries.some((id) => !lost(ctx, id) && allow(id)))) return meet();
  const allowed = CAUSE_WORDS.filter(([re]) => re.test(row.mainOnly)).map(([, id]) => id);
  const causes = allowed.length ? row.causes.filter((c) => allowed.includes(c.id)) : row.causes;
  const lands = row.mainOnlyCountries.filter((id) => !lost(ctx, id) && (!allow || allow(id)));
  if (!causes.length || !lands.length) return meet();
  return { country: weightedCountry(rng, ix, lands, scaleOf), born: 'main', meet: weightedId(rng, causes).id };
}

/**
 * Where a wish that names a continent, a faith, a kind of land or refuses a continent is born (19-wish.md §2 "ถิ่นเกิด", 01-origin.md §3): the same three kinds of land as
 * `placeOfRace` (the main land, the diaspora, outside) inside what `allow` lets through; `kind` fixes the kind. Null when no land fits, and the birth then draws as it would.
 */
function placeWished(ctx: Ctx, ix: Indexes, rng: Rng, bp: Birthplace | undefined, raceName: string, allow: (id: string) => boolean, kind?: Place['born'] | 'city'): Place | null {
  const roll = rng.next() * 100;
  const main = (bp?.main ?? []).filter((id) => ix.countries.has(id) && !lost(ctx, id) && allow(id));
  const diaAll = bp ? diasporaOf(ctx, ix, bp, raceName) : [];
  const dia = diaAll.filter((d) => allow(d.id));
  const taken = new Set([...(bp?.main ?? []), ...diaAll.map((d) => d.id)]);
  const out = ix.countryList.map((c) => c.id).filter((id) => !taken.has(id) && !lost(ctx, id) && allow(id));
  const natural: Place['born'][] = !bp ? ['outside'] : roll < bp.mainPct ? ['main', 'diaspora', 'outside'] : roll < bp.mainPct + bp.diasporaPct ? ['diaspora', 'main', 'outside'] : ['outside', 'diaspora', 'main'];
  if (kind === 'city') {
    // a city (20-wish-synonyms.md §2.5ข "ในเมือง"): any land drawn as a city (scale WISH_CITY_SCALE up), weighed by its size; the kind of the birth is what the land is to the race
    const diaIds = new Set(diaAll.map((d) => d.id));
    const cities = ix.countryList.filter((c) => c.scale >= WISH_CITY_SCALE && !lost(ctx, c.id) && allow(c.id)).map((c) => c.id);
    if (!cities.length) return null;
    const id = weightedCountry(rng, ix, cities, scaleOf);
    return { country: id, born: bp?.main.includes(id) ? 'main' : diaIds.has(id) ? 'diaspora' : 'outside' };
  }
  for (const k of kind ? [kind] : natural) {
    if (k === 'main' && main.length) return { country: weightedCountry(rng, ix, main, scaleOf), born: 'main' };
    if (k === 'diaspora' && dia.length) return { country: weightedId(rng, dia).id, born: 'diaspora' };
    if (k === 'outside' && out.length) return { country: weightedCountry(rng, ix, out, scaleOf), born: 'outside' };
  }
  return null;
}

// ---------- step 4ก: class and gold ----------

function classPct(ix: Indexes, country: CountryLite | undefined, life: LifeState, cause: string | undefined): number[] {
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
  return pct;
}

/** The class of the birth. The draw is made as ever; a wish refuses classes (the draw skips them) and may name one the land and the race allow (19-wish.md §2 "ฐานะ"). */
function classOf(ix: Indexes, rng: Rng, country: CountryLite | undefined, life: LifeState, cause: string | undefined, wish?: { cls?: number; ban?: number[]; refuse: (reason: string) => void }): number {
  const base = classPct(ix, country, life, cause);
  const ban = wish?.ban ?? [];
  const pct = base.map((v, i) => (ban.includes(i + 1) ? 0 : v));
  if (!pct.some((v) => v > 0)) pct.splice(0, pct.length, ...base); // a refusal that would leave no class is not kept
  const i = rng.weighted(pct);
  const drawn = i < 0 ? 3 : i + 1;
  if (!wish?.cls) return drawn;
  if (base[wish.cls - 1] > 0) return wish.cls;
  wish.refuse(WISH_WORDS.classNotHere);
  return drawn;
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

function drawTraits(ctx: Ctx, rng: Rng, life: LifeState, race: Race, second: Race | undefined, outside: boolean, wish: WishAsk = {}): void {
  const ix = idx(ctx);
  // a wish (19-wish.md §2): the one trait asked for sure is given first and takes a place of the three; the others asked weigh x3; the refused weigh 0
  const sure = wish.traits?.find((t) => t.sure && ix.traits.has(t.id));
  const asked = new Set([...(wish.traits ?? []).filter((t) => !t.sure).map((t) => t.id), ...(wish.story?.includes('travel') ? ['freedom'] : [])]);
  const banned = new Set(wish.ban?.trait ?? []);
  const draw = (plus: readonly string[], minus: readonly string[]): boolean => {
    const pool = ix.traitList.filter((t) => !life.traits.includes(t.id) && !t.conflicts.some((c) => life.traits.includes(c)) && !life.traits.some((o) => ix.traits.get(o)?.conflicts.includes(t.id)));
    const i = rng.weighted(pool.map((t) => (banned.has(t.id) ? 0 : affinity(plus, minus, t.id) * (asked.has(t.id) ? WISH_WEIGHT : 1))));
    return i >= 0 && grantTrait(ctx, life, pool[i].id);
  };
  if (sure) grantTrait(ctx, life, sure.id);
  for (let n = life.traits.length; n < 3; n++) draw(race.traitPlus, race.traitMinus);
  if (second) {
    // a half-blood takes one more trait from the second race's list (01-origin.md §4)
    const pool = second.traitPlus.filter((t) => ix.traits.has(t) && !life.traits.includes(t));
    if (pool.length) grantTrait(ctx, life, pool[rng.int(0, pool.length - 1)]);
  }
  if (outside) grantTrait(ctx, life, rng.chance(0.5) ? 'homebody' : 'freedom'); // 01-origin.md §5
}

function drawAptitudes(ctx: Ctx, rng: Rng, life: LifeState, race: Race, wish: WishAsk = {}): void {
  const ix = idx(ctx);
  const n = APTITUDES_AT_BIRTH.base + (rng.chance(APTITUDES_AT_BIRTH.threeChance) ? 1 : 0);
  if (race.id === 'slime') raiseAptitude(ctx, life, 'absorb', 1);
  // a wish (19-wish.md §2): the first aptitude asked is given for certain at the lowest level, the other weighs x3, the refused weigh 0
  const sure = wish.aptitudes?.find((a) => a.sure && ix.aptitudes.has(a.id) && (a.id !== 'absorb' || race.id === 'slime'));
  if (sure) raiseAptitude(ctx, life, sure.id, 1);
  const asked = new Set((wish.aptitudes ?? []).filter((a) => !a.sure).map((a) => a.id));
  const banned = new Set(wish.ban?.aptitude ?? []);
  while (Object.keys(life.aptitudes).length < n) {
    const pool = ix.aptitudeList.filter((a) => life.aptitudes[a.id] === undefined && a.id !== 'absorb');
    const i = rng.weighted(pool.map((a) => (banned.has(a.id) ? 0 : affinity(race.aptPlus, race.aptMinus, a.id) * (asked.has(a.id) ? WISH_WEIGHT : 1))));
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

function drawGift(ctx: Ctx, rng: Rng, life: LifeState, race: Race, second: Race | undefined, curse: boolean, banned: readonly string[] = []): void {
  const ix = idx(ctx);
  const have = curse ? life.curses : life.blessings;
  const pool = (curse ? ix.curses : ix.blessings).filter((g) => !have.includes(g.id));
  const i = rng.weighted(pool.map((g) => (banned.includes(g.id) ? 0 : giftWeight(ctx, life, race, second, g))));
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

  // the wish: what it asks stands in the place of the draw of that step; the draws are still made, so the steps after it do not move (19-wish.md rule 6)
  const w: WishAsk = opts.wish?.ask ?? {};
  const ban = w.ban ?? {};
  const refused: { key: string; value: string; reason: string }[] = [];
  const refuse = (key: string, value: string, reason: string) => refused.push({ key, value, reason });
  const wantRace = opts.race ?? w.race;
  const wantCountry = opts.country ?? w.country;
  const wantSecond = opts.second !== undefined ? opts.second : w.second;
  const forced = w.specialBirth;

  // step 1: race (drawn even when named, so naming it does not move the later draws)
  const needNeuter = !!w.neuter && !wantRace;
  const raceWeights = origin.raceShare.map((r) => (ban.race?.includes(r.id) || (needNeuter && !((origin.gender[r.id]?.n ?? 0) > 0)) ? 0 : r.w));
  const drawnRace = (origin.raceShare[brng.weighted(raceWeights)] ?? origin.raceShare[0]).id;
  const raceId = wantRace ?? drawnRace;
  const race = required(ix.races.get(raceId), `races (race ${raceId})`);
  const bp = origin.birthplaces.find((b) => b.race === raceId);
  const free = wantRace === undefined && wantCountry === undefined;
  const allowSpecial = free || opts.special === true || w.special === true;

  // step 1ข: special births of humans
  const summonedRoll = allowSpecial && raceId === 'human' && brng.chance(origin.specialBirths.find((s) => s.id === 'summoned')?.chance ?? 0);
  const summoned = forced === 'summoned' ? raceId === 'human' : forced === 'reincarnated' ? false : summonedRoll;
  // step 2: half-blood
  const halfRoll = brng.chance((bp?.halfPct ?? 0) / 100);
  let secondId: string | undefined;
  if (!summoned && !origin.noHalf.includes(raceId)) {
    if (wantSecond === null) secondId = undefined;
    else if (wantSecond) secondId = wantSecond;
    else if (halfRoll) {
      const pair = origin.halfPairs.find((p) => p.main === raceId);
      if (pair) secondId = weightedId(brng, pair.second).id;
      // a half-blood nobody asked for does not take a named land or faith from the wish (T2-1): where this pair does not meet, the life is not a half-blood
      if (secondId && (w.continent || w.faith || ban.continent?.length)) {
        const row = origin.meetingPlaces.find((m) => m.pair.includes(raceId) && m.pair.includes(secondId!));
        const fits = (id: string) =>
          ix.countries.has(id) && !lost(ctx, id) && (!w.continent || id.startsWith(w.continent)) && !(ban.continent ?? []).some((c) => id.startsWith(c)) &&
          (!w.faith || !!ix.countries.get(id)?.religions.some((r) => r.id === w.faith));
        if (!row || !row.places.some((q) => fits(q.id))) secondId = undefined;
      }
    }
  }
  const second = secondId ? ix.races.get(secondId) : undefined;
  if (secondId && !second) throw new Error(`character: unknown second race ${secondId}`);

  // step 3: gender
  const g = origin.gender[raceId] ?? { m: 50, f: 50, n: 0 };
  const gi = brng.weighted([g.m, g.f, g.n]);
  let neuter = gi === 2;
  const drawnGender: 'm' | 'f' = gi === 0 ? 'm' : gi === 1 ? 'f' : brng.chance(0.5) ? 'm' : 'f';
  let gender: 'm' | 'f' = opts.gender ?? drawnGender;
  // a wish: a gender the race has, or none where the race can be without (01-origin.md §7; 20-wish-synonyms.md §9 "เพศไม่มีในเผ่า")
  if (w.neuter) {
    if (g.n > 0) neuter = true;
    else refuse('gender', 'ไร้เพศ', WISH_WORDS.neuterNotInRace);
  }
  if (w.gender && opts.gender === undefined) {
    if ((w.gender === 'm' ? g.m : g.f) > 0) gender = w.gender;
    else refuse('gender', w.gender === 'm' ? 'ชาย' : 'หญิง', WISH_WORDS.genderNotInRace);
  }

  // step 4: country and the cause of the parents' meeting
  let place: Place | undefined;
  // the land of a forced special birth (origin.specialBirths): the summoned appear at AL-02, the reincarnated are born at MH-07
  const forcedLand = summoned ? 'AL-02' : forced === 'reincarnated' && raceId === 'human' ? 'MH-07' : undefined;
  let landCountry = forcedLand ?? wantCountry;
  if (forcedLand && wantCountry && wantCountry !== forcedLand) refuse('country', wantCountry, summoned ? WISH_WORDS.summonedPlace : WISH_WORDS.reincarnatedPlace);
  let kind = w.placeKind;
  if (!forcedLand && landCountry && lost(ctx, landCountry) && !opts.country) {
    // a land the world lost cannot be born in: the diaspora of that land stands in (19-wish.md §6)
    refuse('country', landCountry, WISH_WORDS.lostCountry);
    landCountry = undefined;
    kind = 'diaspora';
  }
  const wishedPlace = !!(w.continent || w.faith || kind || ban.continent?.length);
  const allow = (id: string): boolean => (kind !== 'city' || (ix.countries.get(id)?.scale ?? 0) >= WISH_CITY_SCALE) && (!w.continent || id.startsWith(w.continent)) && !(ban.continent ?? []).some((c) => id.startsWith(c)) && (!w.faith || !!ix.countries.get(id)?.religions.some((r) => r.id === w.faith));
  if (summoned) place = { country: 'AL-02', born: 'diaspora' };
  else if (landCountry) {
    const inMain = bp?.main.includes(landCountry);
    place = { country: landCountry, born: inMain ? 'main' : bp?.diaspora.includes(landCountry) ? 'diaspora' : 'outside' };
    if (second) {
      const row = origin.meetingPlaces.find((m) => m.pair.includes(raceId) && m.pair.includes(secondId!));
      if (row) place.meet = weightedId(brng, row.causes).id;
    }
  } else if (wishedPlace) {
    const found = second ? placeOfHalf(ctx, ix, brng, origin, raceId, secondId!, allow) : placeWished(ctx, ix, brng, bp, race.name, allow, kind);
    if (found) place = found;
    else refuse(w.continent ? 'continent' : w.faith ? 'religion' : 'placeKind', w.continent ?? w.faith ?? kind ?? '', WISH_WORDS.placeNotFound);
  }
  if (!place) {
    if (second) place = placeOfHalf(ctx, ix, brng, origin, raceId, secondId!) ?? (bp ? placeOfRace(ctx, ix, brng, bp, race.name) : { country: weightedCountry(brng, ix, ix.countryList.map((c) => c.id), scaleOf), born: 'outside' });
    else if (bp) place = placeOfRace(ctx, ix, brng, bp, race.name);
    else place = { country: weightedCountry(brng, ix, ix.countryList.map((c) => c.id), scaleOf), born: 'outside' };
  }
  const country = ix.countries.get(place.country);

  // reincarnated: a human born in MH-07 is one half the time
  const reincarnatedRoll = !summoned && allowSpecial && raceId === 'human' && place.country === 'MH-07' && brng.chance(origin.specialBirths.find((s) => s.id === 'reincarnated')?.chance ?? 0);
  const reincarnated = forced === 'reincarnated' ? !summoned && raceId === 'human' : reincarnatedRoll;

  // blood: the sub-lineage
  const blood = pickBlood(ctx, brng, race, place.country, summoned, reincarnated, second ? `${raceId}+${secondId}` : undefined);

  // faith of the land
  let faith = pickFaith(brng, country, ban.faith);
  if (w.faith) {
    if (country?.religions.some((r) => r.id === w.faith)) faith = w.faith;
    else refuse('religion', w.faith, WISH_WORDS.faithNotHere);
  }

  // step 6: sign and time
  const signsAll = origin.birthSignWeights.sign;
  const signs = signsAll.filter((x) => !ban.sign?.includes(x.id)).length ? signsAll.filter((x) => !ban.sign?.includes(x.id)) : signsAll;
  const sign = opts.sign ?? w.sign ?? weightedId(brng, signs).id;
  const timeIds = origin.birthSignWeights.time;
  const timeOk = timeIds.map((t) => (ban.time?.includes(t) ? 0 : BIRTH_TIME_WEIGHT[t] ?? 1));
  const time = opts.time ?? w.time ?? timeIds[brng.weighted(timeOk.some((x) => x > 0) ? timeOk : timeIds.map((t) => BIRTH_TIME_WEIGHT[t] ?? 1))] ?? 'day';

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
  const clsBan = (ban.class ?? []).map(Number);
  let cls = summoned ? SUMMONED_CLASS : classOf(ix, brng, country, life, place.meet, { cls: w.cls, ban: clsBan, refuse: (why) => refuse('class', `ชนชั้น ${w.cls}`, why) });
  if (summoned && w.cls && w.cls !== SUMMONED_CLASS) refuse('class', `ชนชั้น ${w.cls}`, WISH_WORDS.summonedFamily);
  if (summoned && w.family) refuse('family', w.family, WISH_WORDS.familyNone);
  const despised = (origin.halfPairs.find((p) => p.main === raceId)?.despisedCountries ?? []).includes(place.country);
  const classKept = !summoned && !!w.cls && cls === w.cls && !refused.some((r) => r.key === 'class');
  if (second && despised && brng.chance(0.4) && !classKept) cls = Math.max(1, cls - 1); // economy/03-classes.md §2
  life.cls = classId(cls);
  life.gold = summoned ? 0 : startGold(ctx, brng, cls);
  if (cls === 5) life.flags.push('noble');

  // step 8: traits, aptitudes, then the gifts
  drawTraits(ctx, crng, life, race, second, place.born === 'outside' && !summoned, w);
  drawAptitudes(ctx, crng, life, race, w);
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
  // the gifts asked for (19-wish.md §2: one blessing of tier C or U, and a curse for a harder life), before the draws; the draws skip what the life has
  for (const [curse, id] of [[false, w.blessing], [true, w.curse]] as const) {
    if (!id) continue;
    const gift = ix.gifts.get(id);
    const clash = curse ? race.curseClash : race.blessClash;
    if (!gift || gift.curse !== curse) refuse(curse ? 'curse' : 'blessing', id, WISH_WORDS.unknownValue);
    else if (clash.includes(id)) refuse(curse ? 'curse' : 'blessing', gift.name, curse ? WISH_WORDS.curseClash : WISH_WORDS.blessingClash);
    else grantGift(ctx, life, curse ? 'curse' : 'blessing', id);
  }
  if (crng.chance(BIRTH_GIFT.blessing)) drawGift(ctx, crng, life, race, second, false, ban.blessing);
  if (crng.chance(BIRTH_GIFT.curse)) drawGift(ctx, crng, life, race, second, true, ban.curse);
  if (crng.chance(BIRTH_GIFT.uniqueSkill) && ix.uniqueSkills.length) grantSkill(ctx, life, ix.uniqueSkills[crng.int(0, ix.uniqueSkills.length - 1)].id);

  if (place.meet && second) applyMeetCause(ctx, life, crng, place.meet, [raceId, secondId!]);
  if (faith) life.flags.push(faith);
  if (sign !== 'none') life.flags.push(`sign_${sign}`);
  life.flags.push(`sign_${time}`);
  if (secondId) life.flags.push('half');
  recomputeDeathAge(ctx, life);
  if (life.dead) delete life.dead;
  // the class asked for stands over what the gifts of the birth did to it (a curse of poverty): the player asked for this class and reads it on the sheet
  if (classKept && life.cls !== classId(w.cls!)) life.cls = classId(w.cls!);
  if (opts.wish) startWishLife(ctx, life, opts.wish, refused);

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

function pickFaith(rng: Rng, country: CountryLite | undefined, banned: readonly string[] = []): string {
  const all = (country?.religions ?? []).filter((r) => r.id);
  const list = all.filter((r) => !banned.includes(r.id ?? '')).length ? all.filter((r) => !banned.includes(r.id ?? '')) : all;
  if (!list.length) return '';
  const i = rng.weighted(list.map((r) => (r.primary ? PRIMARY_FAITH_WEIGHT : 1)));
  return list[i < 0 ? 0 : i].id ?? '';
}

