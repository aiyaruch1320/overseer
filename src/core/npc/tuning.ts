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
