// Numbers the acts of the god need and no document states as a table (code-plan §2.3: one tuning file per system).
// Everything the docs do state (prices, caps, waits, prayer kinds, the miracle table) is read from data/gen/god.json, never repeated here.
// Each constant says where it comes from; "assumption" means the docs are silent and the value can change without a doc change.

/** Quarters between paying for a miracle and the day it happens (04-miracles.md §1 item 3: only the large and above show an omen, a season ahead). The small and mid miracles happen at once; set `mid` to 1 to give them an omen too. */
export const OMEN = { small: 0, mid: 0, big: 1, grand: 1, dragon: 0, refund: 0.5 };

/** A beat is a quarter (a season) of the life year; a prayer tick is a beat (03-dreams.md §7.2). */
export const TICKS_PER_YEAR = 4;

/** Life stages by hAge (assumption: the thresholds of legacy/render/characters/themes.ts, adult 20 and elder 55 as in world-time.md §3). */
export const STAGES = { infant: 4, child: 13, teen: 20, adult: 55 };

/** Prayer fx: a loss of hit points of at least this much wounds the character (assumption, until combat owns the hit points; there is no hit point number before it, a wound stands for it). */
export const HP_WOUND_AT = 15;
/** Prayer fx: a gain of hit points of at least this much closes a wound. */
export const HP_HEAL_AT = 20;

/** A country counts as dangerous (prayer `courage`: danger ≥ 3) when its border posture is one of these or it has the flag `war` (assumption: countries.json has no danger number). */
export const DANGEROUS_WAR = ['frequent', 'total'];

/** The acquaintance (`mc.known`) from which an NPC is "in the character's circle" (assumption). */
export const CIRCLE_KNOWN = 2;

/** Silence of the god (GD-05, world-events.md): no prayer answered for this many world years and at least this many lapsed in that time (assumption: the doc says "หลายทศวรรษ"). */
export const SILENCE = { years: 30, lapsed: 4 };

/** A deed of the god that opens GD-04 keeps it open this many world years (the sim's `year − mr21 < 10`). */
export const GD04_OPEN_YEARS = 10;

/** Whisper effects (03-dreams.md §6): how long they last when the table gives no time (assumption). */
export const WHISPER = {
  decisions: 2, // "สองการตัดสินใจถัดไป" for ระวัง and กล้าเถิด
  goYears: 5, // life years `จงไป` stays in force
  stayYears: 10, // "การย้ายถิ่น ×0.5 สิบปี"
  goMul: 1.5,
  stayMul: 0.5,
  safeMul: 2,
  riskyMul: 2,
  weakMul: 3,
  helpMul: 2,
  liarTrust: -2,
  heirMul: 3,
  resolveYears: 5,
  /** obey roll: base 0.50 and the dream formula without the fit of a path (03-dreams.md §3, §6) */
  obeyBase: 0.5,
  beliefDiv: 140,
  intUnit: 0.02,
  oracle: 0.1,
  godWhisper: 0.2,
  repeat: 0.1,
  repeatYears: 3,
  punished: -0.1,
  punishedYears: 5,
  clamp: [0.05, 0.95] as [number, number],
  willing: 0.7,
  hesitant: 0.4,
  /** belief change by the roll: obeyed / refused (the dream numbers, 01-power.md §3) */
  beliefObey: 3,
  beliefRefuse: -2,
};

/** Flags and modifiers a miracle leaves, in world years, when the table says only "ธง" or gives no time (assumption: the table's own times win). */
export const DURATIONS = {
  golden: 5, // MR-03 "ธง golden ห้าปี"
  plague: 1, // MR-07 "โรคแพร่หนึ่งปี"
  famine: 2, // MR-08 "ธง famine สองปี"
  war: 10, // MR-15 "ธง war จนอสูรตาย": until the combat system can kill the monster
  truce: 5, // MR-05 "ธง war หายห้าปี"
  warWeight: 10, // MR-05 "น้ำหนัก WR … ×0.5 สิบปี"
  moodEffect: 1, // MR-23 MR-24 "ฝันดี / ฝันร้ายหนึ่งปี"
  food03: 5, // MR-03 "อาหาร ×0.8" (no time given: as long as the golden flag)
  wood13: 5, // MR-13 "ไม้ ×2" (no time given: as long as the fire's W loss)
  war03: 10, // MR-03 "ความเสี่ยงสงครามชายแดน +10%" (no time given)
  wCap: 4, // MR-10 "W +1 ถาวร (ไม่เกิน 4)"
};

/** MR-08: chance of a lesser ruin (RU-03 without RU-01). */
export const MR08_RUIN = 0.2;
/** MR-06: chance the target dies, otherwise gravely hurt ("50/50"). */
export const MR06_DEATH = 0.5;
/** Destroying miracles in the character's own country: chance the character is hurt, never killed (iron rule 1, assumption). */
export const MC_HURT = 0.25;

/** Share of the price a destroying miracle returns as dread (01-power.md §1 "ราคา ÷ 3"). */
export const DESTROY_RETURN_DIV = 3;

/** Faith of the target country by the line and tier of the miracle (04-miracles.md §6): [target, neighbours]. */
export const REACTION: Record<string, [number, number]> = {
  createSmall: [5, 0],
  createMid: [10, 3],
  destroySmall: [-5, 0],
  destroyMid: [-10, -3],
};
/** The character's belief when a miracle falls in his country and he sees it (01-power.md §3). */
export const BELIEF_SEEN = { create: 5, destroy: -10 };

/** Cap of the light and the dread (01-power.md). */
export const POWER_CAP = 200;

/** Neighbour kinds of countries.json relations that count as "next to" (assumption: trade, secret and refugee are not borders). */
export const NEIGHBOUR_KINDS = ['liege', 'vassal', 'ally', 'friend', 'tense', 'contact', 'foe', 'kin', 'neutral'];

/** Policies of sim-god.mjs (06-implementation.md §4) as the tools name them. */
export const POLICY = {
  /** The merciful policy spends down to this much light for prayers (sim `g.faith >= 20 + …`). */
  reserve: 20,
  /** A whisper is sent while the light is at least this much (sim `g.faith >= 30`). */
  whisperAt: 30,
  /** The merciful policy soothes the dragon of the lowest mood while it is under this mood (sim `mood[low] < 60`). */
  soothe: { below: 60, light: 40 },
  /** The haste policy provokes while the dread is at least this much (sim `g.dread >= 40`). */
  taunt: 40,
  /** Chance of a whisper at a beat for the merciful: the sim has about 28 moments a life of 300 beats (assumption: one in ten). */
  whisperChance: 0.107,
  /** Chance per world step that the random policy acts (sim `r() < 0.3`). */
  randomAct: 0.3,
  /** Dragons whose omen is near: the fate policies look at those under this mood (sim `mood[k] < 10`). */
  omenMood: 10,
  /** The events a hasty god pushes in era 4 (sim). */
  endEvents: ['WR-15', 'MC-12', 'WR-23'],
  /** Slowing a dragon's fall (sim `sign < 0 ? 0.5`). */
  slowFall: 0.5,
  /** Chance the random policy sends a whisper at a moment of the year (sim: half the moments act, a third of those whisper). */
  randomWhisper: 1 / 6,
};

/** Prayer `wealth` (ขอพ้นความจน) is not prayed by one of the ruling class (class 5: nobles and rulers) whatever his purse holds (M2 review G5). */
export const WEALTH_MAX_CLASS = 4;
