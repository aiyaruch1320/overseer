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
  // 07 §2.2: the vow page tells last, after the death (base 8)
  ผลคำปฏิญาณ: { base: 8, dir: 'mid', pos: 'after' },
};

/**
 * Turning points that have a short line on the card but no sentence in the summary (assumption: 07 §5.4 lists the kinds of the summary; the doc names no short line
 * for a child, a betrayal or a curse, which 03 §1 asks the moments to show). The base is the score of 07 §2.3 for the kind; the line is the short line of the kind.
 */
export const EXTRA_MOMENT: Record<string, { base: number; line: string }> = {
  ลูกเกิด: { base: 6, line: 'อายุ {age}: ลูกคนแรกเกิด ({child})' },
  หักหลัง: { base: 8, line: 'อายุ {age}: {npc} หักหลัง' },
  คำสาป: { base: 7, line: 'อายุ {age}: ได้รับคำสาป{curse}' },
  คนรักเริ่ม: { base: 6, line: 'อายุ {age}: รักกับ{lover}' },
  คนรักตาย: { base: 8, line: 'อายุ {age}: สูญเสีย{npc} (คนรัก)' },
  ลูกตาย: { base: 8, line: 'อายุ {age}: สูญเสีย{npc} (ลูก)' },
  // a ruin that reached him (R2; 04-miracles.md §5.1: the character in the country, his people in it, the nodes mr.a1 to mr.a4)
  ซากถึงตัว: { base: 9, line: 'อายุ {age}: อยู่ในซาก{ruin}' },
  ซากพรากคน: { base: 8, line: 'อายุ {age}: ซาก{ruin}พราก{npc}' },
  ซากตามมา: { base: 8, line: 'อายุ {age}: {reach}' },
};

/** The story nodes that tell a ruin has come to the character's door: refugees, the news of the star iron, the cult of the pit, the god-hunters (31-divine.md mr.a1 to mr.a4). */
export const RUIN_NODES = ['mr.a1', 'mr.a2', 'mr.a3', 'mr.a4'];

/** What a person of the family or the heart weighs when he dies (07 §2.3 gives no score for who died: assumption, a lover or a child counts as the kinds above). */
export const DEATH_ROLE_BONUS = 2;

/** The word of the kind of a tie that was lost, for the line of the people (the line of the tie in the bond system). */
export const LOVER_LINE = 'คนรัก';

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
export const HAND_KINDS = ['chest.pick', 'dream', 'whisper', 'miracle', 'conjure', 'prayer.give', 'prayer.strange', 'prayer.punish'];
export const SILENT_KINDS = ['prayer.lapse', 'prayer.silent'];

/**
 * An act of the god in the count of power used (the block `ใช้พลัง` of the tools): every line of the chronicle except a prayer that ran out and the outcome of a dream
 * (the chronicle holds a dream twice, when it was sent and when the character reached the crossroads; only the sending is a use of power). One reader for the card, the
 * summary of the world and the block, so the three agree.
 */
export const isHandAct = (c: { kind: string; result?: string }): boolean => !SILENT_KINDS.includes(c.kind) && !(c.kind === 'dream' && !String(c.result ?? '').startsWith('sent:'));
/** Which hand changes a life most: later in the list is more (assumption: a miracle > a dream > a whisper > a gift). */
export const HAND_WEIGHT: Record<string, number> = { 'chest.pick': 1, whisper: 2, 'prayer.give': 2, 'prayer.strange': 2, 'prayer.punish': 3, dream: 3, conjure: 5, miracle: 5 };
export const HAND_WORD: Record<string, string> = {
  'chest.pick': 'ของประทาน',
  'chest.skip': 'ข้ามหีบ',
  dream: 'ความฝัน',
  burden: 'ภาระใจ',
  whisper: 'คำกระซิบ',
  miracle: 'ปาฏิหาริย์',
  'miracle.omen': 'ลางปาฏิหาริย์',
  'miracle.cancel': 'ยกเลิกลาง',
  conjure: 'การเสกตามใจ',
  'conjure.omen': 'ลางการเสก',
  'conjure.cancel': 'ยกเลิกการเสก',
  'conjure.shadow': 'เงาของการเสก',
  'prayer.give': 'คำอธิษฐานที่ตอบ',
  'prayer.strange': 'คำอธิษฐานที่ตอบแปลก',
  'prayer.punish': 'โทษที่ลง',
  'prayer.deny': 'คำอธิษฐานที่ปฏิเสธ',
};

/** The question grade: a life that reached its closing ending after the elder age answered it; one that died before 55 did not (assumption: the story keeps no answer). */
export const ELDER_AGE = 55;

/** Mark of the life on the world (03 §2). Assumption: the docs give the three names, not the rule. */
export const MARK = { eraConverge: 2, eraEvents: 1, localConverge: 1, localFame: 10, labels: { none: 'ไม่ทิ้งรอย', local: 'รอยในถิ่น', era: 'รอยในยุค' } as const };

/** The moments of the card come from these kinds first (07 §5.4 lists the kinds that have a short line). */
export const NOT_MOMENT = ['เกิด', 'ความตาย', 'ทายาท', 'เรื่องค้าง', 'ฉายาชีวิต'];

/**
 * Facts whose short line is only a count or a stretch of time ("1 ประเทศ 1 ทวีป", "รบ 9 ครั้ง", "อยู่ที่…นาน 68 ปีชีวิต", the question that "reached an answer" with no question and no
 * answer beside it): the summary tells them, but they are not turning points, so the card does not fill an empty place with them (M4 review R3; assumption: 07 §5.4 lists their lines
 * for the chronicle of the family, which is not the card).
 */
export const FILLER_MOMENT = ['การเดินทาง', 'ศึก', 'อาชีพ', 'ถิ่นที่อยู่นานที่สุด', 'คำตอบของคำถามชีวิต'];

/**
 * The connectors of time that say how long it was (07 §4.1 lists them by the age group of the next fact; the doc does not say they tell a gap). "ไม่กี่ปีให้หลัง" says a few
 * years and is kept for a gap of five or less; "หลายปีผ่านไป" says many and needs eight or more (assumption: the words are only true then).
 */
export const TIME_WORD: Record<string, { minGap?: number; maxGap?: number; minAge?: number }> = {
  ไม่กี่ปีให้หลัง: { maxGap: 5 },
  หลายปีผ่านไป: { minGap: 8 },
  ในวัยกลางคน: { minAge: 30 },
};

/** Moments of the card (03 §1 "สามถึงห้าเหตุการณ์"; 07 §5.4): the question line is on the card already, so its fact comes last, and a fact the summary tells is a little ahead. */
export const MOMENT = { question: -100, inSummary: 1, heard: -2, heardKinds: ['เหตุการณ์โลก'], lossFamily: ['คนใกล้ตัวตาย', 'คนรักตาย', 'ลูกตาย', 'ซากพรากคน'], ruinFamily: ['ซากและประเทศล่ม', 'ซากถึงตัว', 'ซากพรากคน', 'ซากตามมา'] };

/**
 * Lines of an epitaph that tell the life itself (03 §1 "จารึก" is written from the real data of the life; 07 §6 gives only the voice of the culture and the cause). Used beside
 * the cells of the doc so that two dwarves who died of old age do not read the same stone. Assumption: the doc has no such lines; they claim nothing the log does not hold.
 */
export const LIFE_EPITAPH: { id: string; text: string }[] = [
  { id: 'epitaph.life.job', text: '{name} ผู้เป็น{job} อายุ {age}' },
  { id: 'epitaph.life.kids', text: '{name} ทิ้งลูก {child_count} คนไว้เบื้องหลัง' },
  { id: 'epitaph.life.love', text: '{name} อยู่กับ{lover}จนวันสุดท้าย' },
  { id: 'epitaph.life.far', text: '{name} ตายไกลจาก{home} ที่{place_far}' },
  { id: 'epitaph.life.home', text: '{name} ตายที่{home_death}บ้านของตน' },
];

/** `โอรัน-ซัล ผู้ปฐม`: the name and the title of a dragon in the data, with ผู้ in front of the title unless it has one already (`ผู้อาวุโสศิลา`). */
export const dragonName = (d: { name: string; title?: string }): string => (d.title ? `${d.name} ${d.title.startsWith('ผู้') ? d.title : `ผู้${d.title}`}` : d.name);
