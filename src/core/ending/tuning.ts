// Numbers and tables of the ending system. Everything here is copied from docs/systems/llm/07-ending-templates.md unless it says "assumption".
import type { CauseGroup, FactDir, FactPos } from './types';

/** Kinds of facts: base score, direction and position (07 §2.2). */
export const FACT_KINDS: Record<string, { base: number; dir: FactDir; pos: FactPos }> = {
  เกิด: { base: 0, dir: 'mid', pos: 'start' },
  ความตาย: { base: 100, dir: 'loss', pos: 'end' },
  คำตอบของคำถามชีวิต: { base: 10, dir: 'mid', pos: 'mid' },
  จุดบรรจบ: { base: 8, dir: 'mid', pos: 'mid' },
  อาวุธตำนาน: { base: 8, dir: 'gain', pos: 'mid' },
  อาชีพลับ: { base: 8, dir: 'gain', pos: 'mid' },
  มังกร: { base: 7, dir: 'mid', pos: 'mid' },
  ซากและประเทศล่ม: { base: 7, dir: 'loss', pos: 'mid' },
  คนรัก: { base: 6, dir: 'gain', pos: 'mid' },
  ทายาท: { base: 6, dir: 'gain', pos: 'after' },
  คนใกล้ตัวตาย: { base: 5, dir: 'loss', pos: 'mid' },
  เปลี่ยนชนชั้น: { base: 4, dir: 'gain', pos: 'mid' },
  เหตุการณ์โลก: { base: 4, dir: 'mid', pos: 'mid' },
  พระหัตถ์: { base: 4, dir: 'mid', pos: 'mid' },
  การเดินทาง: { base: 3, dir: 'mid', pos: 'mid' },
  ศึก: { base: 3, dir: 'mid', pos: 'mid' },
  เรื่องค้าง: { base: 3, dir: 'loss', pos: 'after' },
  ฉายาชีวิต: { base: 2, dir: 'mid', pos: 'after' },
  อาชีพ: { base: 2, dir: 'mid', pos: 'mid' },
  ถิ่นที่อยู่นานที่สุด: { base: 1, dir: 'mid', pos: 'mid' },
};

/** Bonuses and penalties of 07 §2.3. */
export const SCORE = { question: 4, bigEvent: 2, godChanged: 2, sameKind: -4, sameStage: -3, lineageFirst: -2 };

/** How many facts a summary tells (the death counts, the birth does not): by the age of death (07 §2.3 step 3). */
export const TARGET = [
  { below: 30, n: 3 },
  { below: 55, n: 4 },
  { below: 999, n: 5 },
];

/** Life stages by human-equivalent age (01-one-life.md §3). */
export const STAGES = [
  { to: 3, id: 'infant' },
  { to: 12, id: 'child' },
  { to: 19, id: 'teen' },
  { to: 54, id: 'adult' },
  { to: 999, id: 'elder' },
];

export const stageOf = (age: number): string => STAGES.find((s) => age <= s.to)!.id;

/** Length limits of 07 §10.2 (characters). */
export const LIMIT = { sentence: 110, summary: 600, headLine: 48, titleLine: 40, questionLine: 70, momentLine: 36, vowLine: 56, epitaph: 40, chronicleLine: 100, world: 700 };

/**
 * The "ใช้เมื่อ" column of 07 §3.2 is kept by the generated data as `Template.when` (`ศึก มี {enemy}`: the word, then a slot it also needs). A
 * fact carries flags in English; this is the word of the doc for each flag.
 */
export const FLAG_WORD: Record<string, string> = {
  wake: 'หุ่นวิญญาณ มัมมี่',
  ghoul: 'กูล',
  good: 'ตอบได้ดี',
  bad: 'ตอบแย่',
  open: 'ยังเปิด',
  early: 'ตายก่อนถึงคำตอบ',
  changed: 'กลายเป็นอย่างอื่น',
  held: 'ถือจนตาย',
  lost: 'ไม่ถือจนตาย',
  fell: 'ล้ม',
  standing: 'ยังไม่ล้ม',
  ruinHome: '{ruin} คือ {home}',
  together: 'อยู่ด้วยกันจนตาย',
  apart: 'แยกกัน',
  noHeir: 'ไม่มีทายาท',
  up: 'ขึ้น',
  down: 'ตก',
  never: 'ไม่เคยออก',
  home: 'กลับบ้าน',
  heir: 'มีผู้สืบ',
  prayer: 'คำอธิษฐานที่ตอบ',
  zero: 'ศูนย์ครั้ง',
  done: 'สำเร็จ',
  fail: 'ไม่สำเร็จ',
};

/** The culture group of a race for the epitaph (07 §6.1). */
export const CULTURE: Record<string, string> = {
  human: 'ก สัญญาและบ้าน',
  halfling: 'ก สัญญาและบ้าน',
  elf: 'ข ป่าและฤดู',
  fae: 'ข ป่าและฤดู',
  beast: 'ข ป่าและฤดู',
  darkelf: 'ค เงาและบัญชี',
  vampire: 'ค เงาและบัญชี',
  demonkin: 'ค เงาและบัญชี',
  dwarf: 'ง หินและไฟ',
  lavakin: 'ง หินและไฟ',
  giant: 'ง หินและไฟ',
  orc: 'จ หิวและศึก',
  ghoul: 'จ หิวและศึก',
  naga: 'ฉ น้ำ',
  merfolk: 'ฉ น้ำ',
  dragonkin: 'ช ฟ้าและมังกร',
  winged: 'ช ฟ้าและมังกร',
  construct: 'ซ เฟืองและวิญญาณ',
  soulmachine: 'ซ เฟืองและวิญญาณ',
  mummy: 'ฌ บัญชีวิญญาณ',
  slime: 'ญ ไร้รูปถาวร',
};

/**
 * The group of a cause of death (07 §2.5). The character system writes `old` `illness` `accident` `violence`; the story writes the Thai words of a death
 * node (`ตายในศึก`). A cause it does not know (a change into stone, a walk into the light) counts as old age: nothing killed the character
 * (assumption). "เสียสละ" needs a log entry of the rescue, which no system writes yet, so no life has it.
 */
export function groupOf(cause: string): CauseGroup {
  if (cause === 'violence' || /ศึก|รบ|ถูกฆ่า|ประหาร/.test(cause)) return 'ศึก';
  if (cause === 'illness' || /โรค|ป่วย|พิษ|คำสาป/.test(cause)) return 'ป่วย';
  if (cause === 'accident' || /อุบัติเหตุ|จม|ตก|ไฟ/.test(cause)) return 'อุบัติเหตุ';
  return 'ชราภาพ';
}

/** The word {cause} prints (07 §2.5). */
export const CAUSE_WORD: Record<CauseGroup, string> = { ชราภาพ: 'ชราภาพ', ศึก: 'ศึก', ป่วย: 'โรค', อุบัติเหตุ: 'อุบัติเหตุ', เสียสละ: 'เสียสละ' };

/** Kinds of the god's chronicle that are a hand laid on the life (07 §2.2 "พระหัตถ์"); the rest of the chronicle is silence or a refusal. */
export const HAND_KINDS = ['chest', 'dream', 'whisper', 'miracle', 'prayer.give', 'prayer.strange', 'prayer.punish'];
export const SILENT_KINDS = ['prayer.lapse', 'prayer.silent', 'prayer.deny'];
/** Which hand changes a life most: later in the list is more (assumption: a miracle > a dream > a whisper > a gift). */
export const HAND_WEIGHT: Record<string, number> = { chest: 1, whisper: 2, 'prayer.give': 2, 'prayer.strange': 2, 'prayer.punish': 3, dream: 3, miracle: 5 };
export const HAND_WORD: Record<string, string> = { chest: 'ของประทาน', dream: 'ความฝัน', whisper: 'คำกระซิบ', miracle: 'ปาฏิหาริย์', 'prayer.give': 'คำอธิษฐานที่ตอบ', 'prayer.strange': 'คำอธิษฐานที่ตอบแปลก', 'prayer.punish': 'โทษที่ลง' };

/** The question grade: a life that reached its closing ending after the elder age answered it; one that died before 55 did not (assumption: the story keeps no answer). */
export const ELDER_AGE = 55;

/** Mark of the life on the world (03 §2). Assumption: the docs give the three names, not the rule. */
export const MARK = { eraConverge: 2, eraEvents: 1, localConverge: 1, localFame: 10, labels: { none: 'ไม่ทิ้งรอย', local: 'รอยในถิ่น', era: 'รอยในยุค' } as const };

/** The moments of the card come from these kinds first (07 §5.4 lists the kinds that have a short line). */
export const NOT_MOMENT = ['เกิด', 'ความตาย', 'ทายาท', 'เรื่องค้าง', 'ฉายาชีวิต'];
