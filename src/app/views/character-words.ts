// The words of the chrome of the character screen: names of the sections and of the fixed scales (the six stats and the eight axes are named
// in docs/systems/character/README.md "ค่าพื้นฐาน"). They are labels of the interface, not text of the game: the names of the things themselves
// (traits, gifts, items, jobs, places, the question of the life) come from the data and src/core/text (code-plan §8.1 rule 2).

export const CHAR_WORDS = {
  title: 'ตัวละคร',
  back: 'กลับ',
  none: 'ไม่มี',
  noLife: 'ยังไม่มีชีวิต',
  dead: 'ตายแล้ว',
  // identity
  identity: 'ตัวตน',
  race: 'เผ่า',
  gender: 'เพศ',
  age: 'อายุ',
  ageUnit: 'ปีชีวิต',
  year: 'ศ.ม.',
  where: 'อยู่ที่',
  born: 'เกิดที่',
  cls: 'ชนชั้น',
  job: 'อาชีพ',
  jobYears: (n: number) => `ทำมา ${n} ปี`,
  secret: 'ลับ',
  faith: 'ศาสนา',
  question: 'คำถามของชีวิต',
  // body and stats
  body: 'ร่างกาย',
  hp: 'พลังชีวิต',
  wounds: 'บาดแผลถาวร',
  stats: 'ค่าสถานะ',
  gearBonus: 'จากของที่สวม',
  // axes and traits
  axes: 'แกนนิสัย',
  traits: 'นิสัย',
  // aptitudes and skills
  aptitudes: 'ความถนัด',
  skills: 'skill',
  level: 'ระดับ',
  // gifts
  blessings: 'พร',
  curses: 'คำสาป',
  cure: 'ทางพ้น',
  // gear
  gear: 'ของที่ติดตัว',
  power: 'พลังโจมตี',
  defense: 'ป้องกัน',
  empty: 'ว่าง',
  other: 'ของอื่น',
  spare: 'อาวุธสำรอง',
  // companion
  companion: 'สัตว์คู่หู',
  // standing
  standing: 'ฐานะ',
  gold: 'ทอง',
  debt: 'หนี้',
  fame: 'ชื่อเสียง',
  lastYear: 'ปีล่าสุด',
  income: 'รายได้',
  tax: 'ภาษี',
  living: 'ค่าครองชีพ',
  bondage: 'การผูกตัว',
  free: 'อิสระ',
  owner: 'ผู้ครอบครอง',
  since: 'ตั้งแต่อายุ',
  route: 'เพราะ',
  ransom: 'ราคาไถ่',
  contract: 'เหลือสัญญา',
  years: 'ปี',
  held: 'ผู้ที่ท่านผูกตัวไว้',
  // the god's standing
  god: 'ศรัทธาเทพ',
  godNote: 'ที่ตัวละครมีต่อท่าน',
  // card
  cardHand: 'ในมือ',
  cardGifts: 'พร / คำสาป',
} as const;

/** The six stats, in the order of the docs (กำลัง เวท เร็ว โชค ปัญญา ทน). */
export const STAT_ORDER = ['pow', 'mag', 'spd', 'luk', 'int', 'vit'] as const;
export const STAT_NAMES: Record<string, string> = { pow: 'กำลัง', mag: 'เวท', spd: 'เร็ว', luk: 'โชค', int: 'ปัญญา', vit: 'ทน' };

/** The eight axes (−100 to 100): the pole of each side is the word of the docs for a high number and for a low one. */
export const AXIS_ORDER = ['brave', 'kind', 'ambition', 'piety', 'curious', 'honest', 'temper', 'social'] as const;
export const AXIS_NAMES: Record<string, string> = { brave: 'กล้าหาญ', kind: 'เมตตา', ambition: 'ทะเยอทะยาน', piety: 'ศรัทธา', curious: 'อยากรู้', honest: 'ซื่อสัตย์', temper: 'โทสะ', social: 'เข้าสังคม' };

/** Other numbers a gift can move that the screen names (gold, fame, hit points). */
export const OTHER_NAMES: Record<string, string> = { gold: 'ทอง', fame: 'ชื่อเสียง', hp: 'พลังชีวิตสูงสุด', belief: 'ศรัทธาเทพ' };

export const GENDER_WORDS = { m: 'ชาย', f: 'หญิง', n: '' } as const;
