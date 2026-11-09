// Numbers the character system needs and no document states, in one place (code-plan §2.3 principle 3).
// Each constant says where it comes from; "assumption" means the docs are silent and the value can change without a doc change.

/** Natural death at this human-equivalent age (world-time.md §3: lifespan = 75 life years). */
export const NATURAL_DEATH_AGE = 75;

/** Wake races start their life at this hAge (world-time.md §3). */
export const WOKEN_AGE = 17;
/** The summoned hero appears at this age (01-origin.md §1 step 1ข). */
export const SUMMONED_AGE = 16;

/**
 * Untimely death per life year from hAge 15 (god/06-implementation.md §4: assumption). The ways of the story that say the character dies (the
 * elders ml.e1 sc.e1 ..., storyline DEATH_WAYS) add 12% of the lives before 70 once the journey lines open by their causes and every adult has a
 * job; the yearly chance gives the rest of the 21% of lives that do not reach old age (M3 wiring, review/progress.md).
 */
export const UNTIMELY = {
  fromAge: 15,
  perYear: 0.0015,
  /** Cause words for the ending text; assumption, the weights only colour the cause. */
  causes: [
    { id: 'illness', w: 5 },
    { id: 'accident', w: 3 },
    { id: 'violence', w: 2 },
  ],
};

/** hAge at which a character counts as an adult (world-time.md §3: adult = 20, elder = 55). */
export const ADULT_AGE = 20;

/** Birth gifts: assumption, taken from the POC character code (30% a blessing, 25% a curse) because the docs give no base chance. */
export const BIRTH_GIFT = { blessing: 0.3, curse: 0.25, uniqueSkill: 0.02 };

/** Rarity weights of blessings and curses (character/README.md "ระดับความหายาก"). */
export const RARITY_WEIGHT: Record<string, number> = { C: 100, U: 38, R: 11, E: 2.6, L: 0.5 };

/** Time of day at birth (01-origin.md §1 step 6 says "ตามโค้ดเดิม"; weights from the POC birth-time table). */
export const BIRTH_TIME_WEIGHT: Record<string, number> = { dawn: 20, day: 35, dusk: 15, night: 30 };

/** Weights of trait, aptitude and gift choices at birth (02-race-affinity.md "กติกา": เสริม ×2, ต้าน ×0.4). The data's own values win when loaded. */
export const AFFINITY = { plus: 2, minus: 0.4, clash: 0.4 };

/** How many aptitudes a newborn has: two, or three with this chance (assumption from the POC code). */
export const APTITUDES_AT_BIRTH = { base: 2, threeChance: 0.25 };

/** A random shift of each axis at birth, ± this much (assumption from the POC code). */
export const AXIS_SPREAD = 20;

/** Birth belief in the god is the piety axis divided by this (assumption from the POC code). */
export const FAITH_FROM_PIETY = 3;

/** The weight a country's primary religion gets over the others when a child's faith is drawn (assumption). */
export const PRIMARY_FAITH_WEIGHT = 3;

/** Weight of a "diaspora in the big cities" country over a listed one (assumption), and the city scale from which a country counts as big. */
export const BIG_CITY = { scale: 5, listedWeight: 3, bigWeight: 1 };

/** Lifespan shift of `#longevity` by the race's mid lifespan (02-race-affinity.md §ค): ≥230 +5%, <100 +20%; the middle is an assumption. */
export const LONGEVITY = { highMid: 230, highPct: 0.05, lowMid: 100, lowPct: 0.2, midPct: 0.1 };
/** hAge removed by `#short_life` and `#fast_aging` (assumption from the POC lifespan code). */
export const SHORT_LIFE = { shortLife: 22, fastAging: 10 };

/** Default multiplier of a "ได้ง่ายขึ้น" favour that names no number (assumption; the docs use ×3 for the sign tags). */
export const FAVOUR_DEFAULT = 2;

/** A race that likes a birth sign doubles its effect, one that clashes halves it (01-origin.md §8). */
export const SIGN_LIKE = 2;
export const SIGN_CLASH = 0.5;

/** `trust` as a counted number: peoples whose trust is at least this (the data compares "ไว้ใจ ≥ 3 จาก 10 เผ่า"). */
export const TRUST_COUNTS_AT = 3;

/** Class of a character with no family (the summoned): assumption. */
export const SUMMONED_CLASS = 2;

/** Fallback when the economy data is not loaded: starting gold by class 1..5 (economy/03-classes.md §3). */
export const START_GOLD_FALLBACK: [number, number][] = [
  [0, 0],
  [2, 8],
  [5, 25],
  [40, 120],
  [150, 400],
];

/** Secret jobs (10-jobs-secret.md §ง). */
export const SECRET = {
  base: 0.0075,
  retry: 0.004,
  max: 0.6,
  assistMul: 6,
  eventMul: 2,
  destinyMul: 1.3,
  /** The chance a character takes an offered secret job: assumption (the docs say "accept or refuse", the choice is the character's). */
  accept: 0.8,
};

/** Common jobs (08-jobs-overview.md §1 and §3). */
export const JOBS = {
  offerCount: 3,
  aptMatch: 3,
  raceBonus: 2,
  rarityRoot: { C: 10, U: 6.2, R: 3.3, E: 1.6, L: 1 } as Record<string, number>,
  growthChance: 0.3,
  changeChance: 0.005,
  slowChangeChance: 0.002,
  freedomChangeChance: 0.015,
  maxAptitudeLevel: 3,
  /** A job the class favours weighs ×3 in the offer (economy/03-classes.md §4). */
  classBoost: 3,
};

/**
 * What a life in bondage cannot do (docs/systems/economy/10-bondage.md §2 "สิทธิ์ที่เหลือ", M3 review B1), by level: `move` (change country by himself: the owner
 * carries him, he does not go), `job` (change the work he does: B2 lives by the contract and B3 is property), `class` (rise: B1 to B3 are the class 1 together, §2).
 * B1 keeps a say over the work he does for the creditor (assumption: the doc forbids him only to leave).
 */
export const BOUND_BANS: Record<number, readonly ('move' | 'job' | 'class')[]> = { 1: ['move', 'class'], 2: ['move', 'job', 'class'], 3: ['move', 'job', 'class'] };

// ---------- the wish (19-wish.md, 20-wish-synonyms.md) ----------

/** A trait or an aptitude the player asked for as a tendency weighs this much in the draw of it at birth (19-wish.md §2 "ส่วนแนวโน้ม": ×3). */
export const WISH_WEIGHT = 3;

/** The chance of the child's meeting with the companion species asked for: the 2% of 13-companions-overview.md ("เหตุการณ์เด็ก") ×3 (19-wish.md §2), once between these ages. */
export const WISH_CHILD_ANIMAL = { mul: 3, fromAge: 5, toAge: 14 };

/** The overlay story lines a wish of the story part opens from outside (story `openLine`); assumption: the docs name the question of the life, not the line. */
export const WISH_LINES: Record<string, string> = { travel: 'wd', revenge: 'kn' };

/** Years of the adult life in which the travel of a life that asked to see the world weighs more (19-wish.md §2: "การเดินทาง x1.5 สิบปีแรกของวัยผู้ใหญ่"). Kept on the sheet for the travel system. */
export const WISH_TRAVEL = { mul: 1.5, years: 10 };

/** Reasons the wish gives for an ask it cannot keep (the sheet of birth prints them on the row of what cannot be done). */
export const WISH_WORDS = {
  oneCurse: 'ขอคำสาปได้หนึ่งอย่าง เก็บข้อที่พิมพ์ก่อน',
  jobNotCommon: 'อาชีพลับและอาชีพพิเศษขอไม่ได้ ได้จากเส้นเรื่องเท่านั้น',
  specialNeedsRace: 'กำเนิดพิเศษเป็นของมนุษย์ (ตุ๊กตาเป็นของลูกผสมจักรกล) จึงตัดเผ่าที่ขอ',
  noHalf: 'เผ่านี้เกิดเป็นลูกครึ่งไม่ได้',
  summonedNoHalf: 'ผู้ถูกอัญเชิญไม่มีครอบครัวในโลกนี้และไม่เป็นลูกครึ่ง',
  demonNeedsRace: 'เผ่านี้เป็นลูกครึ่งปีศาจไม่ได้ ใช้เผ่าที่ขอต่อไป',
  absorbSlime: 'ความถนัดกลืนกินเป็นของสไลม์เท่านั้น',
  summonedPlace: 'ผู้ถูกอัญเชิญปรากฏที่อัลเดรีย (AL-02) เท่านั้น',
  reincarnatedPlace: 'ผู้กลับชาติเกิดที่มอร์เฮเวน (MH-07) เท่านั้น',
  summonedFamily: 'ผู้ถูกอัญเชิญไม่มีครอบครัวในโลกนี้ เริ่มที่ชนชั้น 2',
  classNotHere: 'ถิ่นหรือเผ่านี้ไม่ให้เกิดชนชั้นที่ขอ ใช้การสุ่ม',
  genderNotInRace: 'เผ่านี้ไม่มีเพศที่ขอ ใช้เพศตามเผ่า',
  neuterNotInRace: 'เผ่านี้ไม่มีเพศไร้เพศ ใช้เพศตามเผ่า',
  lostCountry: 'ประเทศนี้เป็นซากแล้ว ใช้ถิ่นพลัดถิ่นของเผ่าแทน',
  placeNotFound: 'หาถิ่นที่ตรงคำขอไม่ได้ ใช้การสุ่ม',
  faithNotHere: 'ถิ่นที่ขอไม่มีศาสนานี้ ใช้ศาสนาของถิ่น',
  blessingClash: 'พรนี้ขัดกับเผ่า (ตารางความขัดของเผ่า) ไม่ให้',
  curseClash: 'คำสาปนี้ขัดกับเผ่า ไม่ให้',
  jobCannot: 'อาชีพนี้เผ่าหรือชนชั้นนี้ทำไม่ได้ น้ำหนักเป็น 0',
  familyNone: 'ผู้ถูกอัญเชิญไม่มีครอบครัวในโลกนี้',
  unknownValue: 'ไม่มีค่านี้ในข้อมูล',
} as const;
