// Numbers the NPC code needs that the docs give only as prose or as a table the generator does not read
// (docs/guide/code-plan.md §2 rule 3). Everything else comes from data/gen/npcs.json.
import type { PathKey } from '../data/types-npcs';

/** docs/systems/events/branches/04-last-era.md §4.1: stay, moved, dead, vanished per sub-period 4ก 4ข 4ค. */
export type FateClass = 'keeper' | 'leader' | 'other';
export const ERA4_FATE: Record<FateClass, [number, number, number, number][]> = {
  keeper: [[50, 20, 15, 15], [35, 20, 25, 20], [40, 10, 35, 15]],
  leader: [[85, 5, 5, 5], [70, 10, 15, 5], [65, 5, 25, 5]],
  other: [[80, 10, 5, 5], [65, 20, 10, 5], [70, 10, 15, 5]],
};
/** §4: roll again every 100 years when a sub-period lasts longer than 150 years. */
export const ERA4_REROLL_YEARS = 100;
export const ERA4_LONG_PHASE = 150;
/** A row whose role names a key keeper (04-last-era.md §4.3: the post ends with the key, no successor). */
export const KEEPER_RE = /ผู้ถือกุญแจ|ผู้เฝ้ากุญแจ/;

/** succession.md §3.1: what the 20% of successors who differ do. Equal chance. */
export const SUCCESSOR_TWISTS = [
  'ความลับเดิมหมดความสำคัญ',
  'ความลับถูกเปิดเผยแล้ว',
  'ผู้สืบเป็นฝ่ายตรงข้ามกับต้นแบบ',
  'ผู้สืบมีแผนใหม่',
  'ตำแหน่งเปลี่ยนมือด้วยเหตุรุนแรง',
  'ผู้สืบอ่อนกว่าตำแหน่ง',
] as const;
/** "ผู้สืบมีแผนใหม่ ใช้ทางเลือก ค) เป็นเป้าหมายแทน": path ค gets this weight factor. */
export const NEW_PLAN_PATH: PathKey = 'c';
export const NEW_PLAN_MUL = 3;

/** The director memory of a life holds eight lines (llm/04-story.md). */
export const MEMORY_LINES = 8;

/** Path text that moves the holder to a place named in the path (README §2: ย้ายถิ่น) or makes him vanish (หายสาบสูญ). */
export const MOVE_RE = /ย้าย|ลี้ภัย|หนีไป|ไปอยู่|ไปตั้ง|โผล่ที่|ตามไป/;
export const VANISH_RE = /สาบสูญ|หายตัว|หายไป/;

/** A child does not yet meet the stories of its country; from this life age the zone counts. */
export const MEET_AGE = 6;

/** A holder older than the lifespan table of his people lives this share of one more top lifespan (world-time.md §6 exceptions). */
export const OVER_AGE_SHARE: [number, number] = [0.3, 1];

// ---------- the meeting rate (review/m1/triage.md: elves met too many stories) ----------

/**
 * README §2.1 item 2 opens a story for 20% of the holder's lifespan, in world years, while the character lives in life years:
 * one life year of an elf (1,000 years of lifespan) crosses ten times the world time of a human one, so he walked through ten times
 * as many stories. The documents give no rate per life year, so this is the assumption: a character meets every story open in his
 * zone (the old behaviour) as long as one life year does not cross more than this many world years (humans 56–94 years of lifespan
 * make 0.75–1.25, orcs and beast people less); above it, a story he sees is met with the chance FULL ÷ rate, so the stories met per
 * life year stay that of a human whatever the people.
 */
export const MEET_FULL_RATE = 1.3;

// ---------- illness (README §2: nothing is written, the assumptions are here) ----------

/** The last stretch of the natural lifespan an old holder is gravely ill (the prayer `kin_sick` asks for these). */
export const SICK_ONSET = 0.9;
/** A path whose text says the holder falls ill (the story of AL20-2, NR04-4 ...). A death in the same text is handled by the `death` effect, not here. */
export const SICK_PATH_RE = /ล้มป่วย|ป่วยจาก|แล้วป่วย|ติดโรคเสียเอง|ตกลงมาบาดเจ็บ|ป่วยหนักแล้ว|เป็นพาหะ/;
/** An illness (not old age) lasts this many world years, then the holder dies with the chance below or recovers. */
export const ILL_YEARS: [number, number] = [3, 9];
export const ILL_DEATH = 0.3;
/** Per world step (10 years), the chance a holder in a country with the flag `plague` falls ill. */
export const PLAGUE_SICK = 0.12;
/** After a recovery the old age takes this share of the lifespan before it makes the holder ill again. */
export const RECOVER_IMMUNE = 0.05;
/** `healNpc` lets the holder live this share longer (3 years at least). */
export const HEAL_SPAN = 0.1;

// ---------- grudge ----------

/** The grudge (`mc.grudge`, 0..5) from which an NPC is a nemesis of the character (prayer `vengeance`). */
export const NEMESIS_GRUDGE = 2;
/** combat/07 §3: the kin and disciples of an NPC the character killed hold this much grudge. */
export const KIN_GRUDGE = 2;

// ---------- ties between stories (README §2.2) ----------

/** §2.2 item 2(ค): the weight a tied path gets when the other story ended on the same event. */
export const TIE_BOOST = 10;
/** §2.2 item 3: the follow-up story of a tied NPC, as written there. a revenge · b takes over the goal · c lets go. */
export const FOLLOW_WEIGHTS: Record<'a' | 'b' | 'c', number> = { a: 40, b: 35, c: 25 };
/**
 * §2.2 item 2(ข): a path of B that names A and needs him alive is cut when A's holder dies, vanishes or moves. The docs do not mark which
 * paths those are, so the words of the path decide: a path that goes on without A (a successor, a post taken over) is not cut.
 */
export const NEEDS_PARTNER_RE = /ทะเลาะกับ|ขัดแย้งกับ|ความขัดแย้ง|เผชิญหน้า|ปะทะ|แต่งงาน|หนีไปกับ|ไปกับ|ร่วมกับ|ร่วมมือ|ตามหา|เตือน|ช่วย|เปิดโปง|ถอดถอน|ทรยศ|ขายให้|ส่งให้|มอบให้|ติดต่อ/;
export const PARTNER_GOES_ON_RE = /ผู้สืบ|สืบทอด|ขึ้นแทน|รับตำแหน่ง|ต่อจาก|ลงจากเวที|ตายก่อน|หลังตาย|แทน/;

// ---------- clashes (combat/07-npc-clashes.md) ----------

/** What happens to a clash nobody plays (no handler registered with `onClash`): the share of each standard result of combat/07 §3. Not in the docs. */
export const CLASH_DEFAULT: Record<string, number> = { talk: 30, win_spare: 15, win_kill: 12, draw: 13, lose: 22, flee: 8 };
/** combat/07 §2: two clashes per NPC per life of the character, the second only after a draw, a defeat or a flight; one per season. */
export const CLASH_PER_LIFE = 2;
export const CLASH_AGAIN_AFTER = ['draw', 'lose', 'flee'];
