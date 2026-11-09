// Numbers the economy system needs and no document states exactly (code-plan §2 rule 3: one tuning file per system).
// The tables of the documents (income, living, tax, prices, classes) are read from data/gen/economy.json; only what the
// documents leave open is here. "assumption" = the docs are silent; a calibration is marked as such and is the lead's to move into the docs.
import type { RegimeId } from './data';

/** Economy starts at this hAge: 03-classes.md §3 gives the family capital at 17, before that the family pays. */
export const ECONOMY_FROM_AGE = 17;

/**
 * Calibration (assumption, 08-implementation.md §5 P2: "ปรับให้มัธยฐานที่อายุ 30 อยู่ราว 250 ถึง 350"). With the tables as written the median life
 * holds about 55 gold at 30 (the core's story alone pays a median of 17; the legacy median of 219 in RAW_PLAN §3.2 came from event gold the story
 * does not pay). Income is multiplied by this until the faucets 01 §7 lists (battle rewards, deliveries, investments: combat and P3 to P5) are in
 * the core: it gives about 150 at 30, 450 at 45 and 700 at 60 (tests/balance/economy.test.ts). It is the one number to lower when they arrive.
 */
export const INCOME_SCALE = 1.46;
// 1.35 until the M3 balance after the fix branches: the story lines pv/iv/wk/nl closed for a share of lives (story OPEN_SHARE, to keep the nodes at 31 to 33) took the
// median at 60 from 203 to 141 together with the soldiers' wars; the shares were opened again where the nodes pay and this number was raised to 1.46 (median 204).

/** World years of a temporary W change per level it falls back (01-world-economy.md §6: "กลับสู่ค่าเดิม 1 ระดับต่อ 5 ปี"). */
export const W_DECAY_YEARS = 5;
/** Yearly recovery of the trust C when no WR event is running (01 §1: +2 a year). */
export const TRUST_RECOVER = 2;
/** A WR event keeps the trust from recovering for this many world years (assumption: "ไม่มี WR ในทวีปใดเลย" read as no WR in the last decade). */
export const WR_ACTIVE_YEARS = 10;
/** Era 4 trust trends below 50 (01 §5 "C มีแนวโน้มต่ำกว่า 50"): the recovery does not lift it past this in era 4 or later. */
export const TRUST_ERA4_CAP = 50;

/** Years a price shock of an event lasts when its text names none (assumption: it fades away in a decade, one world step). */
export const PRICE_SHOCK_YEARS = 10;
/** Share of the living cost that is food (assumption): a food shock moves the cost of living by this share of itself. */
export const FOOD_SHARE = 0.5;

/** An adult with no job on record earns this share of the average common job (assumption; see `idleBase` in income.ts). */
export const IDLE_INCOME_MUL = 1;
/** Chance a fighting job (soldier, hunter ...) has no paid work in a year, when the income falls to ×0.5 (04 §1 table; the chance is an assumption). */
export const COMBAT_IDLE = 0.3;
/** Fighting jobs that live in the field pay half the common living cost (04 §1 "ค่าครองชีพชั้นสามัญลดเหลือครึ่งเมื่ออยู่นอกเมือง"); the share of the year spent outside is an assumption. */
export const FIELD_LIVING_MUL = 0.75;
/** Pay of the best-paying mercenary countries (04 §1: MK-16 MH-09 pay best): assumption ×1.3. */
export const MERC_BEST = { countries: ['MK-16', 'MH-09'], mul: 1.3 };
/** Outlaw jobs: income swings from 0 to ×3 (04 §1); chance of `c_wanted` a year (assumption). */
export const OUTLAW = { swing: [0, 3] as [number, number], wanted: 0.04 };
/** Yearly salary of special jobs the docs name (04 §1 "ตำแหน่งที่ได้ผูกเงินเดือน"). */
export const SPECIAL_SALARY: Record<string, number> = { nine_delegate: 60 };
/** Half of the formula for these jobs (04 §1: "ทองไม่เกินครึ่งของสูตร"). */
export const HALF_PAY_JOBS = new Set(['pilgrim', 'temple_servant']);
/** Special rates of the service group (04 §1 table). */
export const JOB_MUL: Record<string, number> = { banker: 1.5, tax_collector: 1.2 };
/** Jobs of the fighting group that have no salary and live on work (04 §1 "adventurer bounty_hunter explorer"); they take the fighting income with idle years. */
export const WORK_JOBS = new Set(['adventurer', 'bounty_hunter', 'explorer']);
export const OUTLAW_JOBS = new Set(['pirate', 'smuggler', 'thief']);
export const MERC_JOBS = new Set(['mercenary', 'soldier']);

/**
 * Income group of the jobs the job file lists as "เดิมในโค้ด" (its `group` is only that heading): 04 §1 table, by the nature of the work (assumption).
 * Keys are the groups of the table: craft service tech combat religion art slow.
 */
export const LEGACY_GROUP: Record<string, string> = {
  farmer: 'craft', hunter: 'craft', fisher: 'craft', shepherd: 'craft', miner: 'craft', sailor: 'craft', smith: 'craft', carpenter: 'craft', weaver: 'craft',
  soldier: 'combat', adventurer: 'combat', thief: 'combat', knight: 'combat', assassin: 'combat', pirate: 'combat', tamer: 'combat', royal_guard: 'combat', spy: 'combat',
  merchant: 'service', cook: 'service', scribe: 'service', servant: 'service', innkeeper: 'service', diplomat: 'service', noble: 'service',
  mage: 'tech', scholar: 'tech', healer: 'tech', alchemist: 'tech', archaeologist: 'tech', teacher: 'tech', warlock: 'tech',
  priest: 'religion', monk: 'religion', druid: 'religion', gravekeeper: 'religion', seer: 'religion',
  bard: 'art', performer: 'art',
};
/** Heading of the job file → group of the income table. */
export const GROUP_OF_HEADING: [string, string][] = [
  ['ช่างฝีมือ', 'craft'],
  ['งานบริการ', 'service'],
  ['งานเทคนิค', 'tech'],
  ['งานต่อสู้', 'combat'],
  ['งานศาสนา', 'religion'],
  ['งานศิลปะ', 'art'],
  ['ชีวิตช้า', 'slow'],
  ['ย้ายจากอาชีพลับ', 'service'],
  ['การค้า', 'service'],
];
/** The income table names its groups in Thai; its row order is this one. */
export const GROUP_ROWS = ['craft', 'service', 'tech', 'combat', 'religion', 'art', 'slow'];

/** Share of noble lives that hold a great house (100-200) rather than a small one (60-100): assumption (04 §2). */
export const NOBLE_MAJOR = 0.25;

/** Regimes of the countries by the words of their government (the economy file lists examples only; assumption, first match wins). */
export const REGIME_WORDS: [RegimeId, RegExp][] = [
  ['stateless', /ไม่มีรัฐ/],
  ['theocracy', /เทวาธิปไตย|สังฆราช|รัฐนักบวช|อาราม|นครรัฐศาสนา|ป้อมนักบวช|ลัทธิลับ|ลัทธิ.*เฟือง/],
  ['merchant', /พ่อค้า|การค้า|นายหน้า|ธนาคาร|ท่าเรือ|ด่านการค้า/],
  ['company', /บริษัท|สมาพันธ์/],
  ['military', /จักรวรรดิ|ลัทธิสงคราม|ทหาร|กองทัพ|ภราดรภาพอัศวิน|ป้อม/],
  ['monarchy', /ราช|ฟาโรห์|สุลต่าน|เคานต|ขุนนาง|ตระกูล|จักรพรรดิ|มาตาธิปไตย|ผู้ครอง|อาณานิคม/],
  ['tribal', /เผ่า|ชุมชน|สหกรณ์|ไชร์|หมู่บ้าน|กองเรือ|ขบวนเกวียน|พันธมิตร/],
  ['republic', /สาธารณรัฐ|สหภาพ|สภา|สมาคม|กิลด์|สถาบัน|คณะ|สหพันธ์/],
];
export const REGIME_DEFAULT: RegimeId = 'republic';

/** The cooperatives take a character of the lowest class in (03-classes.md §5 "สหกรณ์รับ (AL-19 MK-12)"); chance a year is an assumption. */
export const CLIMB = {
  cooperatives: ['AL-19', 'MK-12'],
  coopChance: 0.3,
  /** 2→3: gold and years in the same job (03 §5). */
  to3: { gold: 150, jobYears: 5 },
  /** 3→4: gold, or fame with a trade (03 §5). */
  to4: { gold: 600, fame: 30, fameGold: 300 },
  /** 4→5 in a merchant republic: the rank is bought (03 §5: gold ≥ 2,500); the price is an assumption. */
  to5: { gold: 2500, price: 1500 },
  /** A year that the conditions hold, the climb happens with this chance (assumption: the move is not instant). */
  chance: 0.5,
  /** A class 4 or 5 life whose gold stays under half a year of living for this many years falls a class (03 §5 "หนี้เกินทรัพย์", assumption). */
  ruinYears: 3,
};

/** Poverty (04 §5): the yearly chance of a tight year when gold is under a year of living, and the weights of the ways out. */
export const POVERTY = {
  tightChance: 0.2,
  /** Years tight in a row after which `c_poverty` can fall on a life, and its chance (04 §5 "ถ้าติดเกินสามปี 30%"). */
  curseAfter: 3,
  curseChance: 0.3,
  /** Share of the yearly living cost a relative's help covers (assumption). */
  helpShare: [0.5, 1] as [number, number],
  /** Danger work pays this (pv.a2 "ทอง +40 ถึง +120") and may wound (assumption). */
  danger: { gold: [40, 120] as [number, number], wound: 0.15 },
  /** Selling a held thing gets 40% of a tier-U price (04 §7 "ราคารับซื้อ 40%"). */
  sellShare: 0.4,
};

/**
 * Debt (04 §6, simple form until P5): a loan costs the interest of the class and is paid back from the net of the year (`repayShare` of it);
 * a debt over `defaultMul` times the means (the purse and a year's income) takes a class. 03 §5 says twice the property; the property is not
 * kept until P5, and with a purse alone the poor would default on their first loan (assumption).
 */
export const DEBT = { repayShare: 1, defaultMul: 3 };

/**
 * Lines of the 24-economy storylines the economy opens (24-economy.md §2 rule 2). `ec` is for every life, as the document says: it adds its 9
 * nodes to the 31 to 33 of the code-plan target (about 30 without it, about 42 with it, with `pv` for the poor lands); turn it to false, or
 * open it for a share of lives in `startLife`, if the lead wants the target kept.
 */
// Decided again in the overnight A5 round (all M3 systems are in): still closed. The 31 to 33 nodes of a life is a number of the docs too (god/06-implementation.md §2:
// "32 โหนดต่อชีวิตเต็ม", the rhythm of the god's windows) and the sim that gave it does not walk ec. Measured on 120 lives of the whole core (tests/balance/story-core.test.ts,
// old lives): closed 32.8 · open for every life 42.8 (ec 8.6 nodes a life) · open with at most 3 nodes a life 35.4 (ec 3.0). To open it the lead moves the target (docs) or pays
// for it elsewhere (pv wk shares carry the income, so not there).
export const OPEN_EC = false;
/** Countries with W at most this open `pv` (24-economy.md §2 rule 2: "อยู่ประเทศ W 1 ถึง 2"). */
export const PV_MAX_W = 2;
/** Jobs that open `tr` besides the eight trade jobs (24-economy.md §2: "มีอาชีพการค้า"). */
export const TRADE_JOBS = new Set(['merchant', 'caravan_guard']);
/** Jobs that open `wk` (24-economy.md §2: "กรรมกร ช่างฝึกหัด คนงานเหมืองหรือโรงงาน"); the story opens it for a miner already. */
export const WORK_LINE_JOBS = new Set(['miner', 'woodcutter', 'stonemason', 'tanner', 'potter', 'tailor', 'baker', 'brewer', 'carpenter', 'weaver', 'sailor', 'servant']);

/** Base of the spread a trader keeps (percent), the middle of the 20 to 40% of 08 §6 "ความต่างระหว่างประเทศ". */
export const BASE_SPREAD = 30;
/** How fast the pools of one-off changes (spread, food shock) fall back each life year. */
export const POOL_DECAY = 0.5;

// ---------- the year in one line (M3 review T1) ----------

/**
 * The log line of the year, `economy/year` (level 1): written when something in the money moved enough to tell (assumption; the docs set no rule for
 * the line, review/m3 T1 asks for the income, the pay, the profit or loss, the tax and the debt in a line the player reads):
 *  - `gain` / `loss`: gold that came in or went out beside the formula (the story's trade, a gift, a purchase) at least this much;
 *  - `share`: a soldier was paid a share of a battle at least this much in the year;
 *  - every `ledger`th life year the line is written whatever happened, so the reader sees the whole picture (income, tax, living) now and then.
 * A year with none of these writes nothing, and a debt that opened, grew, shrank or was paid always writes.
 */
export const YEAR_NOTE = { gain: 40, loss: 40, share: 25, ledger: 10 };

/** Jobs whose income is a wage from an employer (a pay line, `salary` in `economy/year`); the rest earn from work, trade or the land (assumption). */
export const WAGE_GROUPS = new Set(['combat', 'service', 'tech', 'religion', 'art']);

/**
 * Rank pay of a soldier (M3 review C2): the wage of a soldier job is multiplied by the factor of his rank in the army of the combat system
 * (`life.ext.combat.rank`, 0 to 4); the share of a battle is in combat/tuning (WAR_PAY). Assumption: the docs say "เงินเดือนประจำ + ส่วนแบ่งศึก" and name no rank.
 */
export const RANK_PAY = [1, 1.1, 1.25, 1.5, 2];
export const RANK_JOBS = new Set(['soldier', 'mercenary', 'knight', 'royal_guard', 'city_guard']);
