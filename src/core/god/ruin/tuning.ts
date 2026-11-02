// Numbers the ruins, the seals and the grand miracles need and no document states as a table (code-plan §2 rule 3: one tuning file per system).
// What the documents state (the dice of the ruin, the windows of RU-01 to 08, the crack of a seal, the replies of the dragons, the caps) is read from
// data/gen/god.json `miracles.ruin` `miracles.seal` `miracles.grand`; here is only what the prose leaves out. "Assumption" means the docs are silent.

/** The seed stream of the ruins and the seals. Everything that rolls here draws from it, so the other streams never move. */
export const STREAM = 'god.ruin';

/** RU-01 (04-miracles.md §5.2): the food of the camp is ×3 for the first year. The doc text, not parsed. */
export const CAMP = { food: 3, years: 1 };
/** RU-02: the country that takes the refugees has food ×1.3 for five years; one that does not has +10% tension on the border (years: assumption, the doc gives none). */
export const REFUGE = { food: 1.3, foodYears: 5, border: 0.1, borderYears: 5 };
/** RU-03: mercenaries of the continent ×1.2 (years: assumption). A cracked city is dug for scales and bits of the seal instead of star iron. */
export const DIGGERS = { mercenary: 1.2, years: 10, ore: 'mt_star_iron', shard: 'dragon_shard' };
/** RU-04: the yearly dread a cult brings (the doc: +0.5). */
export const CULT_DREAD = 0.5;
/** RU-05: the weight of GD-08 (the doc: ×1.2). */
export const AVENGERS_GD08 = 1.2;
/** RU-07: the new city has W 2 (the doc: "ประเทศ W 2"). A ruin has W 1. */
export const CITY_W = { ruin: 1, rebuilt: 2 };
/** RU-08 after MR-17: the doc gives "20 ปีหลัง", and no end; the lake comes within this many years after that (assumption). */
export const LAKE_SPREAD = 10;
/** A country has much rain (RU-08, "ฝนชุก") when its map has one of these (countries.json has no climate field; assumption, a proposal for the docs). */
export const RAINY = { ambient: ['clouds', 'fog', 'leaves', 'motes'], centre: ['rainspire', 'lake', 'fountain', 'sapling', 'worldtree'] };

/** MR-19: the refugees' food ×1.3 lasts as long as the loss of W (the doc gives none; assumption). */
export const FLOOD_REFUGE_YEARS = 5;

/** A mid miracle that falls on a seal has the effect of the small one nearest to it: W −1 for two years and this flag for one year (04-miracles.md §5.4; which flag: assumption, famine for all four). */
export const SEAL_MID = { w: -1, wYears: 2, flag: 'famine', flagYears: 1 };

/** The tools' name for the policy that strikes the seals whenever it can (sim-god.mjs `seal`, "ลงโทษ (ตีหมุดผนึก)"). */
export const SEAL_POLICY = 'seal';
/** The miracles the policies strike a seal with: the large one first (55 dread, as the simulator), the mid one when the large cannot be used (30). */
export const STRIKE = { big: 'MR-18', mid: 'MR-13' };
/** The miracle that makes the ruin of the policies. */
export const RUIN_MIRACLE = 'MR-17';

/** How many occurrences of miracles the ruin state keeps (for the nodes of the story). */
export const MADE_KEEP = 80;

/** The ids that story nodes read as events and that are heard of only near the character (31-divine.md §2 rule 2). */
export const NEAR_IDS = /^(RU-0[1-8]|MR-\d\d)$/;
