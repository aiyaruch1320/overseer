// Numbers the conjuring needs that data/gen/god.json (`conjure`) does not carry (code-plan §2 rule 3: one tuning file per system).
// The table of 48 cells, the caps, the base prices, the shadow chances and the reactions are in the data; the multiplier of each verb, the sizes of the
// effects the cells name in words, and the climate/seal maps are here. "assumption" = the document is silent.

/** Multiplier of the price by verb (07-conjure.md §1 "ราคา"): price = base of the size × this, rounded up. Keys are the ids of `conjure.verbs`. */
export const VERB_MUL: Record<string, number> = { reveal: 0.8, calm: 0.9, create: 1.0, destroy: 1.1, change: 1.2, wake: 1.2 };

/** Cores that pay with dread when the verb is `change` or `wake` (07-conjure.md §1 "แก่น"). */
export const DREAD_CORES = ['death', 'shadow'];

/** How much of the effect of a country a smaller or larger size carries (07-conjure.md §1 "ขนาด"): a place half, a continent 0.6 for each of its countries. */
export const SIZE_FACTOR: Record<string, number> = { person: 1, place: 0.5, country: 1, continent: 0.6 };

/** Cores whose clash with the climate of the place adds to the chance of the shadow (07-conjure.md §4 +15%). The data has no climate zones, so the clashes are read from the continent
 *  (assumption): fire in the fog continent (NB, the nearest to cold), water in the volcano continent (KD), life in a ruin. */
export const CLASH = { fire: ['NB'], water: ['KD'] } as Record<string, string[]>;
export const CLASH_ADD = 0.15;

/** Quarters between paying and the day, by size (07-conjure.md §6 step 4: "ขนาดประเทศขึ้นไปมีลางหนึ่งฤดู"). */
export const OMEN_QUARTERS: Record<string, number> = { person: 0, place: 0, country: 1, continent: 1 };

/** Share of the power given back when an omen is cancelled: the same as the miracles (acts/tuning OMEN.refund). */
export const REFUND = 0.5;

/** Years a flag or a modifier lasts when the cell's words give none (assumption, one place so it can change without a document change). */
export const DEFAULT_YEARS = 10;

/** The multiplier of an event weight stays inside the range of the fate (04-miracles.md §4: 0.2 to 3). */
export const EVENT_RANGE: [number, number] = [0.2, 3];

/** The change of the mood of a dragon whose seal is hit by a conjuring (04-miracles.md §5.4: the mid miracle −10, the large −20, the wrath −15 on every pin of a continent). */
export const SEAL_MOOD = { country: -10, continent: -15 };
/** A pin is hit by a conjuring of mid size or more once in this many world years, and any pin once in this many (04-miracles.md §5.4 "เพดาน"). */
export const SEAL_GAP = { pin: 100, any: 25 };
/** Dragon mood raised by creating life on the pin (07-conjure.md §3 "ให้กำเนิด · ชีวิต · หมุดผนึก +5"). */
export const SEAL_LIFE_MOOD = 5;

/** The homes of the dragons of legend (docs/lore/dragons/README.md "ที่อยู่"): country → dragon indexes. AL-01 (the Concordia) is a pin too, with no dragon (04-miracles.md iron rule 3). */
export const SEAL_HOME: Record<string, number[]> = {
  'AZ-01': [0],
  'AZ-02': [1],
  'AZ-06': [2],
  'NR-04': [2, 9],
  'AZ-03': [3],
  'AZ-04': [4],
  'AZ-05': [5],
  'AZ-07': [6],
  'MH-10': [7],
  'KD-10': [8],
  'AL-14': [10],
  'MK-01': [11],
  'SH-03': [12],
  'SH-17': [12],
  'SV-01': [13],
  'SV-13': [13],
  'NB-08': [14],
  'AL-01': [],
};

/** Countries the reactions of 07-conjure.md §3 name. */
export const UNDEAD_RULED = ['NB-02', 'SH-02'];
export const GIANT_LANDS = ['SH-03', 'SH-06', 'SH-17'];
/** The religion of the Church of Light (religions/README.md #2). */
export const CHURCH_OF_LIGHT = 'faith.02';
/** A flood or DR-05 counts as "just before" for this many world years (assumption: "หลัง DR-05 หรือ MR-19"). */
export const FLOOD_MEMORY = 25;

/** Words for the detail the seed chooses (07-conjure.md §6 step 3: who sees it first, where in the town it falls, the colour of the light). The details change no number. */
export const DETAIL = {
  seen: ['คนเลี้ยงแกะ', 'เด็กริมหน้าต่าง', 'ทหารยาม', 'พ่อค้าเร่', 'นักบวชหนุ่ม', 'แม่ครัว', 'ช่างตีเหล็ก', 'ชาวประมง'],
  spot: ['จัตุรัสกลางเมือง', 'ริมกำแพง', 'ลานหน้าศาล', 'ท่าน้ำ', 'ตลาด', 'ทุ่งนานอกเมือง', 'หอระฆัง', 'ลานบ่อน้ำ'],
  hue: ['ขาว', 'ทอง', 'ฟ้า', 'แดงเรื่อ', 'เขียว', 'ม่วง', 'เงิน', 'อำพัน'],
};

/** The omen of a conjuring in one line, by core (07-conjure.md §6 step 2 "ลางหนึ่งบรรทัด"; assumption: the document gives no text). */
export const OMEN_LINE: Record<string, string> = {
  fire: 'เตาทุกเตาในเมืองลุกวาบพร้อมกันครั้งหนึ่ง',
  water: 'น้ำในบ่อทุกบ่อกระเพื่อมโดยไม่มีลม',
  earth: 'พื้นสั่นเบา ๆ จนถ้วยบนโต๊ะส่งเสียง',
  wind: 'ลมหยุดนิ่งทั้งเมืองก่อนจะพัดกลับทิศ',
  life: 'นกทุกตัวบินกลับมาเกาะหลังคาพร้อมกัน',
  death: 'สุนัขทุกตัวเห่าไปทางสุสานตลอดคืน',
  light: 'เทียนทุกเล่มสว่างขึ้นหนึ่งส่วน ทั้งที่ไม่มีใครจุด',
  shadow: 'เงาของคนทั้งเมืองยาวกว่าตัวเขาอยู่ครู่หนึ่ง',
};
