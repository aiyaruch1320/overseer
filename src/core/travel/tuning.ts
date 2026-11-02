// Numbers the travel system needs that no document states exactly (code-plan §2 rule 3: one tuning file per system).
// Every value says where it comes from. What the documents do state (chances, days, fares, stances) is read from data/gen/travel.json.
import type { ContinentId } from '../types';

export const BEATS = 4;
export const DAYS_PER_QUARTER = 90;
/** Life years before which nobody travels on their own (the sc cause starts at 15; a child never leaves the country). */
export const MIN_AGE = 15;

// ---------- who is who: job groups (01-travel-rules.md §1 table of targets) ----------

/** "อาชีพเดินทาง": the targets 0 / 45 / 55. Ids are the jobs of data/gen/jobs.json. */
export const TRAVEL_JOBS: ReadonlySet<string> = new Set([
  'merchant', 'peddler', 'courier', 'caravan_guard', 'sailor', 'pilgrim', 'mercenary', 'adventurer', 'bard', 'explorer', 'performer', 'jester',
  'airship_pilot', 'navigator', 'pirate', 'caravan_master', 'smuggler', 'guide', 'shipowner', 'bounty_hunter', 'world_walker',
]);

/** "อาชีพเมือง (เสมียน ครู หมอ)": the targets 45 / 40 / 15. */
export const CITY_JOBS: ReadonlySet<string> = new Set([
  'scribe', 'teacher', 'physician', 'healer', 'lawyer', 'accountant', 'banker', 'librarian', 'chronicler', 'cartographer', 'tax_collector', 'apothecary',
  'scholar', 'engineer', 'mechanic', 'diplomat', 'spy', 'archaeologist', 'broker', 'appraiser', 'investor', 'moneylender', 'mayor', 'rail_driver', 'clockmaker',
]);

/** "อาชีพประจำที่ (เกษตร ช่าง ชีวิตช้า นักบวชวัด ขุนนางท้องถิ่น)": the targets 65 / 28 / 7. The craft jobs and the slow-life jobs of data/gen/jobs.json (group) count too. */
export const STATIC_JOBS: ReadonlySet<string> = new Set([
  'farmer', 'shepherd', 'fisher', 'hunter', 'smith', 'cook', 'carpenter', 'weaver', 'servant', 'noble', 'monk', 'priest', 'temple_servant', 'innkeeper', 'gravekeeper', 'miner', 'tamer', 'druid',
  'woodcutter', 'baker', 'tailor', 'potter', 'brewer', 'glassblower', 'jeweler', 'tanner', 'stonemason', 'shipwright', 'rune_carver', 'painter', 'sculptor',
  'farm_owner', 'vegetable_gardener', 'orchardist', 'beekeeper', 'tea_grower', 'flower_grower', 'cheesemaker', 'miller', 'herb_shop', 'tea_house', 'bookshop', 'temple_gardener',
]);

export type JobGroup = 'static' | 'city' | 'travel' | 'other';

export function jobGroup(job: string | undefined): JobGroup {
  if (!job) return 'other';
  if (TRAVEL_JOBS.has(job)) return 'travel';
  if (CITY_JOBS.has(job)) return 'city';
  return STATIC_JOBS.has(job) ? 'static' : 'other';
}

/** Jobs whose employer pays the fare (01-travel-rules.md §1 rule 3). */
export const EMPLOYER_PAYS: ReadonlySet<string> = new Set(['courier', 'caravan_guard', 'sailor', 'mercenary', 'airship_pilot', 'navigator', 'pirate']);

/**
 * Chance per life year that a travelling job crosses into another continent. The documents give the legs per year, not how far they go
 * ("ข้ามทวีปปีละหนึ่งครั้งเมื่อทุนพอ" for a merchant), but the target is 55% of travelling lives at L2, so the rate is tuned to it (balance test; 0.03 before the causes of the table sent the travelling jobs across continents too).
 */
export const JOB = { cross: 0.02, settle: 0.03, abroad: 0.8 };

// ---------- trips caused by §2 ----------

export interface TripShape {
  /** Chance that a success of the cause sends the character abroad at all (the line it opens may do without a trip). */
  go: number;
  /** Chance of one more stop in the same continent before the stay (a journey seldom has one place only). */
  more: number;
  /** Quarters spent at the destination. */
  stay: [number, number];
  /** Chance of staying for good (the destination becomes the base). */
  settle: number;
  /** Share of destinations in the same continent (the rest cross continents). */
  near: number;
}

/**
 * How long each cause keeps the character away. The documents name the cause and the line it opens, not the stay. `go` of sc ex exile was 0.4 0.7 0.2 before every adult had a
 * job: with the causes of the table firing in the lives of the fixed jobs too, the lives of the fixed jobs went abroad in half instead of the third of §1 (M3 wiring).
 */
export const TRIP: Record<string, TripShape> = {
  sc: { go: 0.3, more: 0.35, stay: [8, 16], settle: 0.15, near: 0.9 },
  ps: { go: 1, more: 0.35, stay: [2, 6], settle: 0.05, near: 0.75 },
  ml: { go: 0.15, more: 0.35, stay: [4, 12], settle: 0.15, near: 0.9 },
  ex: { go: 0.5, more: 0.35, stay: [4, 20], settle: 0.6, near: 0.9 },
  exile: { go: 0.1, more: 0.35, stay: [8, 24], settle: 0.5, near: 0.9 },
  xc: { go: 0.4, more: 0.35, stay: [4, 20], settle: 0.25, near: 0.9 },
  wd: { go: 0.6, more: 0.35, stay: [4, 12], settle: 0.1, near: 0.75 },
  tr: { go: 0.3, more: 0.35, stay: [2, 8], settle: 0.1, near: 0.9 },
  // the clerk, the teacher, the doctor who goes to a congress, a post in another city (assumption: the table gives no cause for the city jobs)
  city: { go: 1, more: 0.35, stay: [1, 6], settle: 0.1, near: 0.88 },
};

/** The ages at which the flag of war alone draws a recruit into the mercenary cause (assumption: the table gives none; ml.a1 is at 18 to 28, a2 at 24 to 36). */
export const ML_WAR_AGE: readonly [number, number] = [16, 35];

/** The aptitudes of a fighter: the flag of war draws only those who hold one into the mercenary cause (assumption, with ML_WAR_AGE). */
export const WEAPON_APTS: readonly string[] = ['sword', 'axe', 'spear', 'bow', 'dagger', 'unarmed', 'hammer', 'whip', 'sling', 'mounted'];

/** Road event 6 of the table (a column of soldiers or a war check): the share of them that opens the mercenary line instead of drafting the cart (assumption; the table gives no split). */
export const MERC_ROAD = 0.25;

/**
 * Chance per life year that a city job (clerk, teacher, doctor) takes a post or a course in another country. 0.011 before the wars ended: the flag of war used to stay on
 * for the rest of the world and `warred` (routes.ts) shut the land road between two countries at war, so most roads were shut; now a war flag ends with its timer
 * (world/events.ts expireWarFlags), the roads open again and the city group went from 45/40/15 to 32/48/21 (M3 balance). 0.003 puts it back to about 41/42/17.
 */
export const CITY_TRIP = 0.003;

/** The holy places of the pilgrim line (25-journeys.md §5). */
export const HOLY_PLACES: readonly string[] = ['SH-09', 'AZ-01', 'AL-02', 'SV-01', 'NB-07', 'SH-06'];

/** A job that counts as "ทหาร" for the mercenary cause (§2: "ธงสงคราม war ในประเทศ หรืออาชีพทหาร"). */
export const SOLDIER_JOBS: ReadonlySet<string> = new Set(['soldier', 'mercenary', 'knight']); // the three jobs 25-journeys.md §3 names for ml; the guards of a city or a palace stay at their gates

/** Jobs that open the journey lines by themselves (25-journeys.md §3 column "เปิดเมื่อ"). */
export const LINE_JOBS: Record<string, readonly string[]> = {
  sf: ['sailor', 'navigator', 'pirate', 'shipowner'],
  ps: ['pilgrim'],
  ml: ['mercenary', 'soldier', 'knight'],
  wd: ['bard', 'explorer', 'adventurer', 'performer'],
};

/** `settled` and `adventurous` of the documents are `homebody` and `adventurer` in the trait list. */
export const SETTLED_TRAITS = ['homebody'];
export const ADVENTUROUS_TRAITS = ['adventurer', 'freedom'];

// ---------- the world ----------

/** Continents that have a coast to put a ship into. The island nations of NR all have one; AZ floats and sails nowhere. */
export const SEA_CONTINENTS: ReadonlySet<ContinentId> = new Set(['NR', 'AL', 'MH', 'SV', 'KD', 'SH', 'MK', 'NB']);

/** Years of calm after DR-06 (travel/01-travel-rules.md §3.6 "ลมหยุด"). */
export const WIND_STILL_YEARS = 20;

/** Chance a giant's test is passed at the stair, by stance (§3.6 row บันไดหมื่นขั้น). */
export const STAIR_PASS: Record<number, number> = { 1: 0.7, 0: 0.5, [-1]: 0.3, [-2]: 0 };

/** Gold carried in a fare is never more than this share of the purse for a refugee's cheap way. */
export const MASK_PRICE = 40;

/** Mask of the fog: the item the fog route needs (§3.6 row ทางหมอก). */
export const FOG_MASK = 'cn_fog_filter';

/** Share of the gold a toll or bribe takes when the d12 gives 1 (§4: "ทอง −5% ถึง −15% ของสินค้า"). */
export const TOLL_SHARE: [number, number] = [0.05, 0.15];
/** The goods carried are a part of the purse (the documents say "ของสินค้า"). */
export const GOODS_SHARE = 0.5;

/** Share of the ways of the story that name a place (the `place` effect) that the character follows by moving there (the filters still apply). */
export const FOLLOW_STORY = { same: 0.2, cross: 0.015 };
