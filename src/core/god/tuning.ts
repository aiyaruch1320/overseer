// Numbers the god system needs that data/gen/god.json does not carry (code-plan §2 rule 3: one tuning file per system).
// Every value says where it comes from, so the lead can move it into the documents later.

/** Both powers are held up to 200 (01-power.md §1). */
export const POWER_CAP = 200;

/** Policies that exist as names. Thai names are the ones the test tools pass (`--policy=`); English ones are aliases. */
export const POLICY_ALIAS: Record<string, string> = {
  เงียบ: 'silent', silent: 'silent',
  เมตตา: 'merciful', merciful: 'merciful',
  ลงโทษ: 'punish', punish: 'punish',
  ปั้นนิสัย: 'shaper', shaper: 'shaper',
  ให้ของ: 'giver', giver: 'giver',
  เก็บพลัง: 'saver', saver: 'saver',
  สุ่ม: 'random', random: 'random',
};

/** Ages that stop the game for the god (experience/07-attention.md §2; the same constants sim-god.mjs uses). */
export const AGE_STOPS_DEFAULT = [5, 15, 30, 50, 70];

/** Items that change the price or the effect of an act (01-power.md §2 last three rows). */
export const FREE_ACT_ITEMS = ['wj_sage_e', 'wc_al14'];
export const IMMUNE_ITEMS = ['wj_godslayer_e', 'wk_az_3'];
/** Blessing that reflects a curse back (02-bestow.md §4 "ปฏิเสธพร"): the curse is not applied and the belief drops by this. */
export const CURSE_WARD = { blessing: 'b_curseward', belief: -5 };

/** Tier index in the docs: C 0 · U 1 · R 2 · E 3 · L 4 (01-power.md §3). */
export const TIERS = ['C', 'U', 'R', 'E', 'L'] as const;
export type Tier = (typeof TIERS)[number];
export const tierIndex = (t: string): number => Math.max(0, TIERS.indexOf(t as Tier));

/**
 * The rarity compensator (02-bestow.md §3) has a floor at the start value and rises by `step` per chest without an R or better.
 * The doc fixes the start (−5) and the step (+2) but no top; a cap keeps a long dry run from handing out R every time.
 */
export const COMP_MAX = 10;

/** A chest result changes the belief by half when the character does not know it came from the god (02-bestow.md §4). */
export const KNOWS_GOD_AT = 20;

/** Dream symbols (03-dreams.md §2: 12 symbols; the docs name nine of them, the rest are filled in here). */
export const SYMBOLS = ['งู', 'ไฟ', 'แม่น้ำ', 'ดาบ', 'ดวงตา', 'ดวงจันทร์', 'ดอกไม้', 'อีกา', 'มงกุฎ', 'ประตู', 'ต้นไม้', 'กระจก'];

/**
 * How a way fits the character (03-dreams.md §3 "ความเข้ากัน"). The storyline data has almost no trait conditions (5 of 1,365 ways), so the fit is read from
 * the way's share of its node's weight, which is where the director puts what the character is like: the way he would most likely take (share
 * of 0.45 or more) fits "two traits", a share of 0.35 or more fits "one", a share of 0.25 or less goes against his nature. Assumption.
 */
export const FIT = { two: 0.45, one: 0.35, against: 0.25 };

/** Multiplier of a way when no source gives one (S3 S7 have `null` in the doc): the same as the table's S1. */
export const SOURCE_MUL_DEFAULT = 4;

/** Words that make a way "against morals" (03-dreams.md §3 `ขัดศีลธรรม`: harm to the innocent, betrayal). The way's label is read for them. */
export const IMMORAL_WORDS = ['ทรยศ', 'หักหลัง', 'ฆ่าผู้', 'สังหาร', 'ปล้น', 'ขโมย', 'ข่มขืน', 'วางยา', 'ทิ้งลูก'];

/** Reasons shown with the level of a dream (03-dreams.md §3 "เหตุผลที่แสดง"). */
export const REASONS = {
  against: 'ทางนี้ขัดกับนิสัยของเขา',
  immoral: 'ทางนี้ขัดกับศีลธรรมของเขา',
  fits: 'ทางนี้ตรงกับนิสัยของเขา',
  beliefHigh: 'เขาเชื่อในเสียงของท่าน',
  beliefLow: 'เขาไม่ไว้ใจเสียงของท่าน',
  sharp: 'เขาฟังความฝันออกชัด',
  dull: 'เขาฟังความฝันไม่ค่อยออก',
  oracle: 'เสียงแห่งสวรรค์อยู่กับเขา',
  whisper: 'เขาคุ้นกับเสียงกระซิบของท่าน',
  repeat: 'เขาฝันถึงทางนี้มาแล้ว',
  punished: 'เขายังจำความทุกข์ที่ท่านให้',
  guard: 'เขาเต็มใจมาสองครั้งแล้วและท่านยังไม่ได้อะไร',
} as const;

/** How many dreams can wait at once and how many life years one waits for its node (03-dreams.md §4). */
export const DREAM_PENDING_MAX = 3;
export const DREAM_WAIT_YEARS = 2;

/** The policies spend down to this reserve of light, kept for prayers (06-implementation.md §4, policy table "เมตตา"). */
export const RESERVE = 20;
/** Light a policy wants in hand before it opens a chest (sim-god.mjs `g.faith >= 40`). */
export const CHEST_MIN_LIGHT = 40;
/** Policy "ให้ของ" and "เมตตา" may open this many chests in a year (the cap itself comes from the data). */
export const POLICY_CHESTS_PER_YEAR = 2;

/** Chance that the shaper sends the way against the character's nature (06-implementation.md §4 "ส่งทางที่ขัดนิสัยครึ่งหนึ่ง"). */
export const SHAPER_AGAINST = 0.5;

/** Burden events (03-dreams.md §4): the three results are equally likely; a policy that wants to repair pays this to answer the question. */
export const BURDEN_QUESTION = { belief: -8, answered: 12, cost: 15 };

/** Opposites by tag (02-bestow.md §2 "ขัดกัน": a blessing opposite to a curse the character holds, and the reverse). blessing tag ↔ curse tags. */
export const OPPOSITES: Record<string, string[]> = {
  fire_res: ['weak_fire'],
  heat_res: ['weak_fire'],
  cold_res: ['weak_ice'],
  poison_res: ['weak_poison'],
  plague_res: ['plague_carrier'],
  longevity: ['short_life', 'fast_aging'],
  youth: ['short_life', 'fast_aging'],
  regen: ['sickly', 'slow_heal', 'glass'],
  heal: ['sickly', 'slow_heal'],
  darkvision: ['night_blind', 'fear_dark'],
  swim: ['fear_water', 'seasick'],
  water_breath: ['fear_water', 'fear_deep'],
  fear_height_res: ['fear_height'],
  height_calm: ['fear_height'],
  hero_luck: ['jinx', 'doom', 'ill_omen', 'disaster'],
  gold_luck: ['poverty', 'cursed_gold', 'jinx'],
  pet_luck: ['pet_jinx', 'pet_grief'],
  god_whisper: ['unheard', 'faithless', 'unbelieved'],
  second_chance: ['doom', 'fate_chain'],
  sun_blessed: ['weak_sun', 'weak_light', 'light_burn'],
  holy: ['infernal', 'demon_mark', 'cursed_blood'],
  mind_ward: ['madness', 'evil_eye'],
  curse_ward: ['hex_magnet', 'cursed_blood'],
  beast_friend: ['beast_fear', 'hound_hate', 'cat_hate'],
  true_love: ['love_doom', 'lonely'],
  trusted_trader: ['distrust', 'debt', 'oath_breaker'],
  diplomat: ['distrust', 'outcast'],
  truth: ['truth_bound'],
  steady_hand: ['trembling_hand', 'brittle_wrist'],
  quick_hands: ['trembling_hand'],
  sound_sleep: ['insomnia', 'nightmare'],
  lucid: ['madness', 'insomnia'],
  charm: ['ugly', 'outcast'],
  beauty: ['ugly'],
};

/** Weapon types a body without hands can use (02-bestow.md §2 "เผ่าและกำเนิด"): the amorphous races. */
export const AMORPHOUS_TYPES = ['มวย', 'เวท'];

/** Weapon groups that can come out of a chest: the legend (36 one-offs) and the forge and continent relics have owners (02-bestow.md §2). */
export const CHEST_WEAPON_GROUPS = ['standard', 'job', 'job_secret', 'job_special', 'country', 'material'];
/** Item categories that can come out of a chest: no haunted talismans (24 with a spirit), no paired items, key items or raw materials. */
export const CHEST_ITEM_CATS = ['armor', 'accessory', 'folk', 'consumable', 'tool'];
/** A child gets folk charms or toys instead of weapons and gear (02-bestow.md §2 "วัย"). */
export const CHILD_ITEM_CATS = ['folk'];

/** Belief change the god's acts cause, by cause; the doc rows (01-power.md §3) live in data/gen/god.json `belief`. */
export const POLICY_MOMENTS_PER_YEAR = 2;
