// Numbers the goals need that data/gen/god.json (`goals`) does not carry (code-plan §2 rule 3: one tuning file per system).
// What the document states is read from the data (the vows, titles, points and the thresholds of the unlocks); this file holds the readings of the words
// ("elder", "adult years"), the maps from the life to the vows that fit it, and the multipliers of the rhythms of fate. "assumption" = the document is silent.
import { ADULT_AGE } from '../../character/tuning';

/** Vows offered at birth (08-goals.md §2: "3 ข้อ"). */
export const OFFER = 3;
/** A vow that fits the question, the origin or the birth omen of the life weighs this much more (08-goals.md §2 "×3"). */
export const FIT_MUL = 3;
/** The age stop at which the vow may be changed once (08-goals.md §2). */
export const CHANGE_AT = 15;
/** "อายุเทียบ 55" (08-goals.md GV-01 GV-19): the elder age of the world-time doc. */
export const ELDER_AGE = 55;
/** Adult years count from here for the titles "ผู้ศรัทธา" and "ผู้ถูกผูก" (world-time.md §3). */
export const ADULT_FROM = ADULT_AGE;

/** Life years in a country that make it a place he lived in, for the title "นักเดินทาง" (08-goals.md §3 "อยู่มากกว่าห้าประเทศ"; the document gives no length, assumption). */
export const STAY_YEARS = 2;

/** GV-11 reads the belief at any time; GV-04 needs this many continents; GV-06 this level of the lover line. */
export const VOW_NUMBERS = { belief: 85, hate: -70, continents: 4, loverLevel: 4, interventions: 5, kind: 30, legendCv: 2 };

/** The vows that the first set holds ("GV-01 ถึง GV-12 และ GV-20" before 10 points, the rest after). */
export const SET_ONE_LAST = 12;

/** Unlocks by points (08-goals.md §4): what each threshold opens in code. `at` is checked against the data. */
export const UNLOCKS: { at: number; verbs?: string[]; cores?: string[]; vowSet?: 2; rhythms?: 'all'; startModes?: 'chronicle' }[] = [
  { at: 5, verbs: ['change'], cores: ['wind'] },
  { at: 10, vowSet: 2 },
  { at: 15, verbs: ['wake'], cores: ['light'] },
  { at: 20, rhythms: 'all' },
  { at: 30, verbs: ['reveal'], cores: ['death', 'shadow'] },
  { at: 40, startModes: 'chronicle' },
];

/** Rhythms of fate (08-goals.md §5): the id each name goes by, and the multipliers the document states. */
export const RHYTHM_ID: Record<string, string> = { 'ตามธรรมชาติ (ค่าเริ่มต้น)': 'natural', ชะตาอ่อนโยน: 'gentle', ชะตาโศก: 'sorrow', ชะตาประชด: 'irony' };
export const NATURAL = 'natural';
/** kind of multiplier → rhythm → value. Kinds: `closeDeath` the ways with the death of someone near · `loss` the ways with a loss · `randomBattle` a fight that comes by chance ·
 *  `badFate` the bad fates · `prayerRate` prayers arise · `ironic` a gift that comes the strange way is the opposite of the ask · `misread` a dream misread. */
export const RHYTHM_MUL: Record<string, Record<string, number>> = {
  closeDeath: { gentle: 0.6 },
  randomBattle: { gentle: 0.7 },
  badFate: { gentle: 0.7, sorrow: 1.3 },
  loss: { sorrow: 1.5 },
  prayerRate: { sorrow: 1.3 },
  ironic: { irony: 2 },
  misread: { irony: 1.5 },
};

/** Words of a way (its label) that mean the death of someone near, or a loss (assumption: the rows of the storylines have no field for it). */
export const CLOSE_WORDS = ['พ่อ', 'แม่', 'พี่', 'น้อง', 'ลูก', 'คู่', 'เพื่อน', 'สหาย', 'ครู', 'ญาติ', 'ศิษย์', 'คนรัก', 'พวกพ้อง', 'ครอบครัว'];
export const DEATH_WORDS = ['ตาย', 'เสียชีวิต', 'สิ้น', 'จากไป', 'ถูกฆ่า', 'ถูกสังหาร'];
export const LOSS_WORDS = ['สูญเสีย', 'เสียไป', 'ล่ม', 'พลัดพราก', 'พราก', 'ถูกยึด', 'ล้มละลาย', 'หนี้', 'ถูกขาย', 'ถูกจับ', 'บาดเจ็บ', 'พิการ'];
/** Words of a way that need the character's own effort (08-goals.md §6 "ฝึก ลงทุน เดินทางไกล"). */
export const EFFORT_WORDS = ['ฝึก', 'ลงทุน', 'เดินทางไกล', 'เดินทาง', 'ออกเดินทาง', 'เรียน', 'ไปหา', 'ตามหา'];

/** Words that tell, in a way taken, what the vow tests (assumption). */
export const FORGIVE_WORDS = ['ให้อภัย', 'คืนดี', 'ขอโทษ', 'ความแค้นเก่าลดลง', 'เลิกแค้น', 'ไกล่เกลี่ย'];
export const BETRAY_WORDS = ['ทรยศ', 'หักหลัง'];
export const KILL_WORDS = ['ฆ่า', 'สังหาร'];

/** Jobs that heal (jobs.json): the years in them count for the title "ผู้รักษา" (assumption: one "time" per life year). */
export const HEAL_JOBS = ['healer', 'midwife', 'veterinarian'];

/** Era 4 starts about here (world-sim.md "ยุค 4 เริ่มราว 1,320"): GV-18 is offered to a life that reaches it. */
export const ERA4_FROM = 1320;
/** hAge a "vow for a heir" counts as an heir who is alive: any child alive at death (bonds `children`). */

/** Races whose vow GV-05 speaks of a successor and not of blood (08-goals.md §2 "สายเลือดสืบต่อ สำหรับหุ่นวิญญาณ มัมมี่ กูล สไลม์ที่แยกร่าง ใช้รูปผู้สืบแทน"). */
export const HEIR_FORM_RACES = ['soulmachine', 'mummy', 'ghoul', 'slime'];
export const HEIR_FORM_NAME = 'ให้ผู้สืบต่อ';

/**
 * Vows that fit what the life asks (08-goals.md §2: "×3 ให้ข้อที่ตรงกับคำถามของชีวิต จุดกำเนิด หรือลางตอนเกิด"). The map is an assumption: the question is read
 * for these words, the birth omen and the special start by their own tables.
 */
export const QUESTION_WORDS: [string, string[]][] = [
  ['กลับ', ['GV-03']],
  ['บ้าน', ['GV-03', 'GV-16']],
  ['รัก', ['GV-06']],
  ['แค้น', ['GV-07', 'GV-08']],
  ['ศัตรู', ['GV-07']],
  ['อภัย', ['GV-08']],
  ['ตำนาน', ['GV-09']],
  ['วีรบุรุษ', ['GV-09']],
  ['โลก', ['GV-04']],
  ['เดินทาง', ['GV-04']],
  ['ทายาท', ['GV-05']],
  ['สายเลือด', ['GV-05']],
  ['ลูก', ['GV-05']],
  ['อิสระ', ['GV-12']],
  ['ตัวเอง', ['GV-12']],
  ['เทพ', ['GV-11']],
  ['พระเจ้า', ['GV-11']],
  ['ฟ้า', ['GV-11']],
  ['พันธะ', ['GV-14']],
  ['ทาส', ['GV-14']],
  ['สร้าง', ['GV-17']],
  ['ร้าน', ['GV-17']],
  ['ธรรมดา', ['GV-10']],
  ['มังกร', ['GV-15']],
  ['ชะตา', ['GV-13']],
  ['อายุ', ['GV-01']],
  ['แก่', ['GV-01']],
  ['สงบ', ['GV-02']],
];
export const SIGN_FITS: Record<string, string[]> = {
  comet: ['GV-09', 'GV-15'],
  eclipse: ['GV-19', 'GV-07'],
  fullmoon: ['GV-06', 'GV-05'],
  storm: ['GV-04', 'GV-02'],
};
export const SPECIAL_FITS: Record<string, string[]> = {
  summoned: ['GV-03', 'GV-04'],
  reincarnated: ['GV-13', 'GV-10'],
  woken: ['GV-17', 'GV-04'],
};
/**
 * The vows a story wish puts on the table (19-wish.md §2 "ส่วนเรื่อง": "คำปฏิญาณที่เสนอมี GV-xx"; the 19 doc says the offer HAS the vow, so these are placed
 * in the three first, the others are drawn as ever). The order is the order of the wish; at most WISHED_MAX are placed so the draw keeps a place.
 */
export const STORY_VOWS: Record<string, string[]> = {
  travel: ['GV-04'],
  love: ['GV-06'],
  revenge: ['GV-07', 'GV-08'],
  hero: ['GV-09'],
  plain: ['GV-10'],
  nogod: ['GV-12'],
};
export const WISHED_MAX = 2;
export const BORN_FITS: Record<string, string[]> = { diaspora: ['GV-03'], outside: ['GV-03', 'GV-16'] };
