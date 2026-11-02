// Numbers the items system needs that no document states exactly (code-plan §2 rule 3: one tuning file per system).
// What the documents state (prices, the price formula, the stat budget, forging odds, the talisman tables) is read from data/gen/*.json.
import type { Rarity } from '../data/types-items';

/** Life years before which a character holds no more than the articles near at hand (README §4 "เด็กใช้ได้เฉพาะของใช้"). */
export const ADULT_FROM = 15;

/** README §5: a weapon C or U is checked for dullness after this many battles; the chance of going dull; the power it loses. */
export const DULL_AFTER = 10;
export const DULL_CHANCE: Record<Rarity, number> = { ของใช้: 0, C: 0.3, U: 0.3, R: 0.1, E: 0.1, L: 0 };
export const DULL_POWER = 2;

/** 11-item-system.md §4: armour loses 1 point of defence for every three lost fights (E and L do not wear). */
export const ARMOR_LOSSES_PER_POINT = 3;
/** Armour: damage factor (1 − 0.04 N), a shield held in the defensive stance 0.05 more per point, the floor of the whole product. */
export const ARMOR_STEP = 0.04;
export const SHIELD_STEP = 0.05;
export const DAMAGE_FLOOR = 0.35;

/** 19-prices.md §4: what a shop pays. */
export const SELL_SHOP = 0.4;
export const SELL_DIRECT = 0.7;
export const SELL_BLACK = 0.3;
/** 19-prices.md §5: repairs. */
export const REPAIR_ARMOR = 0.2;
export const REPAIR_TOOL = 0.15;
/** A weapon repaired by the character's own smith is dear by this share of its price. */
export const REPAIR_WEAPON = 0.15;

/** The highest tier a shop sells by the size of the town (data `shopTiers`): scale 1 village · 2 small town · 3 town · 4 big city · 5 capital. */
export const SHOP_MAX: Record<number, Rarity> = { 1: 'C', 2: 'U', 3: 'R', 4: 'R', 5: 'E' };
/** A big city at wealth W4 or more sells E too. */
export const SHOP_E_W = 4;

/** Chance per life year that an adult goes shopping for each kind of thing, and how much of the purse the character lays out at most. */
export const SHOP_WEAPON = 0.2;
export const SHOP_ARMOR = 0.15;
export const SHOP_TOOL = 0.3;
export const SHOP_CHARM = 0.05;
export const SHOP_BUDGET = 0.35;
/** A new thing is bought only if it scores this much better than the old one. */
export const SHOP_GAIN = 2;

/** Chance per life year that the work of a job brings the next weapon of its set (README §4: R from "งานของอาชีพ"). */
export const JOB_GROWTH = 0.03;
export const JOB_GROWTH_FROM = 5;

/** Quarters a forging takes, by the tier ordered (10-forging.md §6: a week, a month, a season, a year; a week and a month still take a beat). */
export const FORGE_BEATS: Record<string, number> = { C: 1, U: 1, R: 1, E: 4 };
/** Chance per life year that a fighter feels the need for a new weapon; the others feel it less often. */
/** Lowered from 0.05 / 0.012 when the fights began to dull the weapons (combat calls `afterBattle`), which is a cause of the table of its own: 56% of the lives began a forging against the fifth the first runs showed (M3 wiring). */
export const FORGE_NEED_FIGHTER = 0.03;
export const FORGE_NEED_OTHER = 0.008;
/** Years before the same need may come again (10-forging.md §2: one in three years). */
export const FORGE_EVERY = 3;
export const FORGE_SAVE_YEARS = 5;

/** The score of an article (11-item-system.md §3): tier × 2 + defence × 2 + the stats that fit the job − negatives + a point for each tag that fits the story. */
export const SCORE_TIER = 2;
export const SCORE_DEFENCE = 2;
export const SCORE_UNSKILLED = -2;
export const SCORE_SKILLED = 2;
export const SCORE_POWER = 1;

/** How the character feels about charms: `skeptic` refuses a charm of tier E or more half the time (11-item-system.md §3). */
export const SKEPTIC_REFUSE = 0.5;

/** An engraved weapon is +1 against a kind it has killed (README §3 "สลักชื่อ"). */
export const ENGRAVE_BONUS = 1;

/** Life tools: the share of income a tool adds is its tier bonus; at most four are used, at most +50% (11-item-system.md §6). */
export const TOOL_SLOTS = 4;
export const TOOL_CAP = 0.5;
export const TOOL_BONUS: Record<string, number> = { C: 0.06, U: 0.1, R: 0.2, E: 0.25 };
/** Years of use a tool lasts (E is a family heirloom and never wears out). */
export const TOOL_LIFE: Record<string, number> = { C: 15, U: 25, R: 40 };
/** Years of income the tool must pay back at most for the character to buy it. */
export const TOOL_PAYBACK_MAX = 14;
