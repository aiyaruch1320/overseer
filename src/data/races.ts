import type { Axis, StatKey } from '../sim/types';

export interface Climate {
  id: string;
  name: string;
  icon: string;
  desc: string;
  colors: number[]; // terrain palette (low → high)
  danger: number; // base monster danger 1..5
}

export const CLIMATES: Climate[] = [
  { id: 'temperate', name: 'ทุ่งหญ้าอบอุ่น', icon: 'temperate', desc: 'ฤดูกาลชัดเจน เกษตรอุดม เมืองหนาแน่น', colors: [0x6aa84f, 0x7fbf5a, 0x93c86a, 0x5a8f3c], danger: 1 },
  { id: 'tropical', name: 'ป่าดิบชื้น', icon: 'tropical', desc: 'ร้อนชื้น ฝนชุก สัตว์ป่าและโรคภัยมาก', colors: [0x2f7a3a, 0x3c8f45, 0x2a6b33, 0x4fa052], danger: 3 },
  { id: 'desert', name: 'ทะเลทราย', icon: 'desert', desc: 'แดดแผดเผา โอเอซิส กองคาราวาน', colors: [0xd9c07a, 0xe3cc8a, 0xc9a85f, 0xbf9a52], danger: 3 },
  { id: 'frozen', name: 'ดินแดนน้ำแข็ง', icon: 'frozen', desc: 'หนาวเหน็บ กลางคืนยาวนาน ผู้คนอดทน', colors: [0xdfe9f0, 0xc8d8e4, 0xeef4f8, 0xaabccb], danger: 4 },
  { id: 'volcanic', name: 'ดินแดนภูเขาไฟ', icon: 'volcanic', desc: 'ลาวาและแร่ล้ำค่า มังกรชอบทำรัง', colors: [0x6b4a3a, 0x7d5443, 0x8a3b2a, 0x4f3a32], danger: 5 },
  { id: 'islands', name: 'หมู่เกาะทะเล', icon: 'islands', desc: 'ลมทะเล การค้าทางเรือ โจรสลัด', colors: [0x9ccf6a, 0xb7dd85, 0xe8d9a0, 0x7fbf5a], danger: 2 },
];
export const climateById = (id: string) => CLIMATES.find((c) => c.id === id)!;

export interface Race {
  id: string;
  name: string;
  en: string;
  desc: string;
  lifespan: number; // years
  base: Record<StatKey, number>;
  genders: [string, number][];
  likes: string[]; // climates
  dislikes: string[];
  tags: string[];
  axis: Partial<Record<Axis, number>>;
  traitBias: string[];
  aptBias: string[];
  color: number;
  hair: number;
  syl: [string[], string[], string[]]; // name syllables: start, middle, end
}

const MF: [string, number][] = [['ชาย', 50], ['หญิง', 50]];

export const RACES: Race[] = [
  {
    id: 'human', name: 'มนุษย์', en: 'Human', desc: 'ปรับตัวเก่ง อายุสั้น แต่ทะเยอทะยานที่สุดในโลก',
    lifespan: 75, base: { pow: 10, mag: 9, spd: 10, luk: 10, int: 10, vit: 10 }, genders: MF,
    likes: ['temperate'], dislikes: [], tags: ['adaptable'], axis: { ambition: 15 },
    traitBias: ['ambitious', 'diligent', 'envious', 'family', 'justice'], aptBias: ['sword', 'trade', 'leadership', 'farming', 'scholar'],
    color: 0xe0b48a, hair: 0x5a3a1e,
    syl: [['อา', 'เล', 'มา', 'ริ', 'คา', 'โร', 'เอ็ด', 'ลู', 'ซา', 'ทอ', 'วิล', 'แอน'], ['เร', 'ลิ', 'นา', 'ดา', 'เบิร์', 'โท', 'มิ'], ['ัส', 'อัน', 'ด์', 'ล่า', 'เรีย', 'โด', 'ฟอร์ด', 'มัส', 'ซ่า', 'เน่']],
  },
  {
    id: 'elf', name: 'เอลฟ์', en: 'Elf', desc: 'อายุนับพันปี ใกล้ชิดธรรมชาติ หยิ่งแต่ฉลาด',
    lifespan: 700, base: { pow: 8, mag: 13, spd: 12, luk: 10, int: 12, vit: 8 }, genders: MF,
    likes: ['tropical', 'temperate'], dislikes: ['volcanic', 'desert'], tags: ['nature', 'long_lived', 'keen_eye'], axis: { curious: 10, social: -15 },
    traitBias: ['proud', 'serious', 'bookworm', 'animal_lover', 'loner'], aptBias: ['bow', 'nature', 'wind', 'music', 'healing'],
    color: 0xf2d6b8, hair: 0xe8e0a0,
    syl: [['เอ', 'ลา', 'ไอ', 'ซิล', 'กา', 'ธา', 'เล', 'นิ', 'อา'], ['ราน', 'ลิ', 'เอ', 'ธี', 'วา', 'นี'], ['เอล', 'เดียล', 'ริล', 'เนีย', 'ธาส', 'ลิน', 'โดร์']],
  },
  {
    id: 'darkelf', name: 'ดาร์กเอลฟ์', en: 'Dark Elf', desc: 'เอลฟ์ใต้พิภพ ว่องไว เจ้าเล่ห์ ถูกเนรเทศจากแสงตะวัน',
    lifespan: 600, base: { pow: 9, mag: 12, spd: 13, luk: 9, int: 11, vit: 9 }, genders: MF,
    likes: ['volcanic', 'frozen'], dislikes: ['desert'], tags: ['darkvision', 'shadow', 'long_lived'], axis: { honest: -20, ambition: 15 },
    traitBias: ['cunning', 'paranoid', 'vengeful', 'proud', 'cold'], aptBias: ['dagger', 'dark', 'stealth', 'alchemy', 'whip'],
    color: 0x7a6a8f, hair: 0xe8e8f0,
    syl: [['ดรี', 'วี', 'ซา', 'มัล', 'อีล', 'โน', 'ไค'], ['ซ', 'ริ', 'ธ', 'แร', 'วิ'], ['ซ์', 'ธรา', 'เรน', 'ดีน', 'ลิธ', 'ร่า']],
  },
  {
    id: 'dwarf', name: 'คนแคระ', en: 'Dwarf', desc: 'ช่างตีเหล็กแห่งขุนเขา ดื้อรั้น ทนทาน ดื่มเหล้าเหมือนน้ำ',
    lifespan: 300, base: { pow: 12, mag: 8, spd: 8, luk: 10, int: 10, vit: 14 }, genders: MF,
    likes: ['volcanic', 'frozen'], dislikes: ['islands'], tags: ['fire_res', 'poison_res', 'darkvision'], axis: { honest: 15, social: 5 },
    traitBias: ['stubborn', 'diligent', 'proud', 'glutton', 'vengeful'], aptBias: ['smithing', 'axe', 'hammer', 'mining', 'rune'],
    color: 0xd9a07a, hair: 0x9a3a1a,
    syl: [['ทอ', 'กิม', 'บรู', 'ดา', 'ธอร์', 'บาล', 'ดู'], ['ริ', 'ก', 'ลิน', 'นาร์', 'โด'], ['ริน', 'ลี', 'ดิน', 'ร็อก', 'กาด', 'นาร์']],
  },
  {
    id: 'orc', name: 'ออร์ค', en: 'Orc', desc: 'นักรบผู้แข็งแกร่ง อายุสั้น ยึดถือเกียรติและพลัง',
    lifespan: 60, base: { pow: 15, mag: 7, spd: 10, luk: 9, int: 7, vit: 13 }, genders: MF,
    likes: ['desert', 'volcanic'], dislikes: ['frozen'], tags: ['berserk'], axis: { brave: 25, temper: 25 },
    traitBias: ['reckless', 'bloodlust', 'hot', 'glutton', 'loyal_love'], aptBias: ['axe', 'unarmed', 'taming', 'hammer', 'leadership'],
    color: 0x6f9a4f, hair: 0x2a2a2a,
    syl: [['กรุ', 'อูร์', 'ซาก', 'โกร', 'มอก', 'ธรา'], ['ก', 'ช', 'ร', 'ม'], ['ช', 'กัช', 'นาก', 'ธุก', 'ร่า', 'โกธ']],
  },
  {
    id: 'halfling', name: 'ฮาล์ฟลิง', en: 'Halfling', desc: 'ตัวเล็ก โชคดีจนน่าหมั่นไส้ รักอาหารและบ้าน',
    lifespan: 120, base: { pow: 6, mag: 8, spd: 12, luk: 15, int: 10, vit: 9 }, genders: MF,
    likes: ['temperate'], dislikes: ['volcanic', 'frozen'], tags: ['lucky', 'small'], axis: { social: 20, ambition: -15 },
    traitBias: ['glutton', 'homebody', 'humor', 'optimist', 'lazy'], aptBias: ['cooking', 'stealth', 'sling', 'trade', 'farming'],
    color: 0xf0c49a, hair: 0x7a4a20,
    syl: [['บิล', 'โฟร', 'แซม', 'พิป', 'เมอร์', 'โรซี่', 'ทอม'], ['โบ', 'โด', 'วิ', 'ลี'], ['โบ', 'ดี้', 'วิส', 'ลี่', 'แบ็ก', 'ฟุต']],
  },
  {
    id: 'beast', name: 'เผ่าสัตว์', en: 'Beastfolk', desc: 'หูและหางสัตว์ ประสาทสัมผัสเฉียบคม รักพวกพ้อง',
    lifespan: 70, base: { pow: 12, mag: 7, spd: 14, luk: 10, int: 8, vit: 11 }, genders: MF,
    likes: ['tropical', 'temperate'], dislikes: ['volcanic'], tags: ['keen_senses', 'beast_kin'], axis: { social: 15, temper: 15 },
    traitBias: ['loyal_love', 'reckless', 'animal_lover', 'family', 'freedom'], aptBias: ['unarmed', 'tracking', 'bow', 'taming', 'dagger'],
    color: 0xc98f5a, hair: 0x8a5a2a,
    syl: [['รุ', 'มิ', 'ทา', 'คิ', 'เฟ', 'ลิ', 'ซุ'], ['นะ', 'โระ', 'ยะ', 'มิ'], ['ระ', 'โกะ', 'ทะ', 'มิ', 'เนะ', 'กิ']],
  },
  {
    id: 'naga', name: 'นาคา', en: 'Naga', desc: 'เผ่างูผู้พิทักษ์แม่น้ำ เชื่อเรื่องการลอกคราบและเกิดใหม่',
    lifespan: 400, base: { pow: 10, mag: 13, spd: 10, luk: 10, int: 11, vit: 12 }, genders: MF,
    likes: ['tropical', 'islands'], dislikes: ['frozen', 'desert'], tags: ['water_breath', 'venom', 'serpent'], axis: { piety: 25, temper: -10 },
    traitBias: ['devout', 'calm', 'proud', 'vengeful', 'serious'], aptBias: ['water', 'spear', 'divination', 'alchemy', 'healing'],
    color: 0x4f8f7a, hair: 0x1a3a3a,
    syl: [['นา', 'ศิ', 'วา', 'ภุ', 'อนัน', 'กัล', 'มณี'], ['คะ', 'สุ', 'ริ', 'ระ', 'ยา'], ['ราช', 'นาคี', 'ษา', 'ภา', 'ตา', 'ศร']],
  },
  {
    id: 'dragonkin', name: 'มังกรร่างคน', en: 'Dragonkin', desc: 'สายเลือดมังกร หยิ่งทะนง พ่นไฟได้เมื่อโกรธ',
    lifespan: 200, base: { pow: 14, mag: 11, spd: 8, luk: 8, int: 10, vit: 13 }, genders: MF,
    likes: ['volcanic'], dislikes: ['frozen'], tags: ['fire_res', 'dragon_blood', 'weak_ice', 'scales'], axis: { ambition: 20, brave: 15 },
    traitBias: ['proud', 'hot', 'reckless', 'greedy', 'justice'], aptBias: ['fire', 'spear', 'sword', 'leadership', 'mounted'],
    color: 0xb04a3a, hair: 0xd9a030,
    syl: [['ดรา', 'วาร์', 'ซี', 'อิก', 'ธอร์', 'ไค'], ['กอ', 'ร', 'นิ', 'ธา'], ['ซ์', 'กอน', 'ธรักซ์', 'เรียส', 'นาร์']],
  },
  {
    id: 'vampire', name: 'แวมไพร์', en: 'Vampire', desc: 'อมตะผู้กระหายโลหิต แข็งแกร่งในยามค่ำ แต่แพ้แสงศักดิ์สิทธิ์',
    lifespan: 1000, base: { pow: 12, mag: 13, spd: 13, luk: 7, int: 12, vit: 10 }, genders: MF,
    likes: ['frozen'], dislikes: ['desert', 'tropical'], tags: ['undead', 'weak_light', 'weak_sun', 'blood_drinker', 'darkvision'], axis: { kind: -15, ambition: 10 },
    traitBias: ['proud', 'cold', 'cunning', 'flirt', 'bloodlust'], aptBias: ['blood', 'charm', 'dagger', 'dark', 'illusion'],
    color: 0xe8e0e8, hair: 0x1a1020,
    syl: [['วลา', 'คาร์', 'เซ', 'มอร์', 'ลิ', 'อัล'], ['มิ', 'ลา', 'ดี', 'ซา'], ['ล่า', 'เคียส', 'มีร์', 'ดีน', 'คูล่า', 'เซีย']],
  },
  {
    id: 'fae', name: 'ภูตพราย', en: 'Fae', desc: 'ภูตตัวจิ๋วมีปีก เวทแรง ร่างบาง แพ้เหล็ก ชอบแกล้งคน',
    lifespan: 300, base: { pow: 4, mag: 15, spd: 14, luk: 13, int: 11, vit: 6 }, genders: [['ชาย', 40], ['หญิง', 45], ['ไร้เพศ', 15]],
    likes: ['tropical', 'temperate'], dislikes: ['volcanic', 'desert'], tags: ['weak_iron', 'flight', 'nature', 'small'], axis: { curious: 25, honest: -10 },
    traitBias: ['humor', 'liar', 'curious', 'dreamer', 'moody'], aptBias: ['illusion', 'nature', 'music', 'wind', 'charm'],
    color: 0xf0d0f0, hair: 0x80e0d0,
    syl: [['พิ', 'ทิง', 'ลู', 'ฟิ', 'บลู', 'มิ', 'ซิล'], ['ซี', 'เบล', 'ลี', 'มู'], ['เบล', 'กซี่', 'มิน', 'ฟลอ', 'วิง', 'ซ่า']],
  },
  {
    id: 'slime', name: 'สไลม์', en: 'Slime', desc: 'ก้อนเยลลี่ผู้มีจิตสำนึก กลืนกินแล้วเลียนแบบได้ ใครว่าอ่อนแอ?',
    lifespan: 150, base: { pow: 6, mag: 10, spd: 7, luk: 12, int: 6, vit: 15 }, genders: [['ไร้เพศ', 100]],
    likes: ['tropical', 'islands', 'temperate'], dislikes: ['desert', 'frozen'], tags: ['amorphous', 'weak_ice', 'absorb'], axis: { curious: 30, temper: -20 },
    traitBias: ['optimist', 'glutton', 'gullible', 'humor', 'curious'], aptBias: ['absorb', 'water', 'healing', 'cooking', 'illusion'],
    color: 0x5ab0e8, hair: 0x5ab0e8,
    syl: [['ปุ', 'ริ', 'มุ', 'เจล', 'ปิ', 'บุ'], ['ปุ', 'รุ', 'มุ', 'ลิ'], ['รุ', 'มุ', 'ปิ', 'ลี่', 'โบ']],
  },
  {
    id: 'demonkin', name: 'เผ่าปีศาจ', en: 'Demonkin', desc: 'ลูกหลานปีศาจผู้ถูกรังเกียจ มีเขาและหาง ทรงพลังเวทมืด',
    lifespan: 150, base: { pow: 11, mag: 14, spd: 10, luk: 8, int: 12, vit: 10 }, genders: MF,
    likes: ['volcanic', 'desert'], dislikes: [], tags: ['fire_res', 'weak_light', 'infernal', 'horned'], axis: { ambition: 20, kind: -5 },
    traitBias: ['vengeful', 'ambitious', 'cunning', 'skeptic', 'proud'], aptBias: ['dark', 'contract', 'fire', 'sword', 'curse'],
    color: 0xc06070, hair: 0x2a0a1a,
    syl: [['ซา', 'เบล', 'อัซ', 'มัล', 'ลิล', 'อัส'], ['รา', 'เซ', 'ซิ', 'ฟา'], ['เอล', 'ซาร์', 'โมส', 'ลิธ', 'เกล', 'ธ']],
  },
  {
    id: 'merfolk', name: 'เงือก', en: 'Merfolk', desc: 'ชาวทะเลผู้มีเสียงเพลงสะกดใจ ขึ้นบกได้แต่ไม่ชอบที่แห้งแล้ง',
    lifespan: 250, base: { pow: 9, mag: 12, spd: 13, luk: 11, int: 10, vit: 10 }, genders: MF,
    likes: ['islands'], dislikes: ['desert', 'volcanic'], tags: ['water_breath', 'siren'], axis: { social: 15, curious: 15 },
    traitBias: ['flirt', 'freedom', 'dreamer', 'talkative', 'moody'], aptBias: ['water', 'music', 'spear', 'sailing', 'charm'],
    color: 0x9ad0d0, hair: 0x3a80c0,
    syl: [['มา', 'เน', 'ไอ', 'คอร์', 'ลอ', 'โอ'], ['รี', 'ลา', 'นี', 'เร'], ['น่า', 'เรล', 'ไลน์', 'ไรน์', 'ดีน', 'เชียน']],
  },
];
export const raceById = (id: string) => RACES.find((r) => r.id === id)!;
