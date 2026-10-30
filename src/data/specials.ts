// Special NPCs: people of docs/lore/npcs whose look is designed by hand, one by one, instead of generated from their race and job.
// Each has a signature (colours, regalia, a prop, a way of standing) and art for every stage of life. The stages other than the one the docs
// describe are the person as they were or will be: a child in plain clothes with the family colours, a youth, the prime, an elder whose
// hair has gone white. Regalia (crowns, halos, weapons) only come with adulthood.
import { lookFor } from '../scenes/people';
import { POSE } from '../render/characters/pose';
import { STAGES, STAGE_AGE, stageOf, type Stage } from '../render/characters/themes';
import { mix, type Look } from '../render/characters/kit';
import { HALF_SPECIALS } from './specialsHalf';

export interface Special {
  id: string; // the NPC id in docs/lore/npcs (AZ01-1), or a code of its own for people who belong to the lore at large
  name: string;
  title: string;
  race: string;
  line?: string;
  blend?: string; // the people of the other parent of a half-blood
  fem: boolean;
  age: number; // human-equivalent age of the documented person
  design: string; // why they look like this (shown in the gallery and docs/characters/specials.md)
  look: Partial<Look>;
  regalia?: string[]; // extra features that only the grown-up wears
  youth?: Partial<Look>; // what the child and the teen wear instead
  sig?: number[]; // their own way of standing about
  stages: Stage[];
}

const ALL: Stage[] = [...STAGES];
const GRAY = 0xe4e4ee;

export const SPECIALS: Special[] = [
  // ---- Azgar: the sky islands ----
  { id: 'AZ01-1', name: 'ไอรัสวาร์', title: 'ผู้ปรนนิบัติมังกรสูงสุด', race: 'winged', line: 'white', fem: false, age: 70, stages: ALL, regalia: ['halo'],
    design: 'นักบวชเฒ่าผู้รู้ว่าธรรมเนียมสังเวยผิด ปีกขาวสะอาดแต่ค่อมเล็กน้อย ถือกระถางธูปที่ไม่เคยจุดไฟ ชุดขาวทองซีดเพราะซักบ่อย',
    look: { outfit: 'priest', hat: 'mitre', tool: 'censer', cloth: 0xf6f2e8, cloth2: 0xd9a030, hair: GRAY, hairStyle: 13, beard: 3, eye: 0x6ad0ff, skin: 0xf0d8c0, accent: 0xf2c94c, pattern: 0 }, youth: { outfit: 'priest', cloth: 0xe8e0d0 }, sig: [POSE.idle, POSE.idle2, POSE.breath, POSE.kneel] },
  { id: 'AZ01-2', name: 'ธรักซ์มาร์', title: 'ราชาปีก ผู้นำธรักซ์ลีเจียน', race: 'winged', line: 'scale', fem: false, age: 45, stages: ALL, regalia: ['hornsSmall'],
    design: 'ขี่ไวเวิร์นชื่อ "ซาก" เกราะเต็มยศสีแดงเข้มทอง ปีกเกล็ดแดงใหญ่ แผลเป็นข้างตา ท่าทางเหมือนผู้ที่รู้ว่ากองทัพแกร่งเพราะมังกรเท่านั้น',
    look: { outfit: 'plate', hat: 'helmet', tool: 'spear', cloth: 0x8a1a1a, cloth2: 0xd9a030, hair: 0x2a1a10, hairStyle: 0, beard: 2, eye: 0xe0a020, skin: 0xb88060, mark: 2, build: 2, tall: true, accent: 0xc03a2a }, youth: { outfit: 'tunic', cloth: 0x8a1a1a } },
  { id: 'AZ01-3', name: 'เซลีนาซา', title: 'ผู้พิทักษ์รังฟ้า', race: 'winged', line: 'white', fem: true, age: 31, stages: ALL,
    design: 'หญิงสาวที่ได้ยินเสียงพี่น้องของมังกรแผ่ว ๆ จึงเอียงคอฟังตลอด ผมยาวสีทองขาวพลิ้ว ชุดบางสีฟ้าอ่อน ตาเหม่อมองขึ้นฟ้า',
    look: { outfit: 'light', hat: 'circlet', tool: '', cloth: 0xdce8f6, cloth2: 0x8ac8f0, hair: 0xf0e8b0, hairStyle: 13, eye: 0x6ad0ff, skin: 0xf6e0d0, accent: 0x8ac8f0 }, sig: [POSE.idle, POSE.talk1, POSE.idle2, POSE.talk1] },
  { id: 'AZ01-4', name: 'วาสโกร', title: 'คนล้างบันไดรังฟ้า', race: 'human', line: 'ground', fem: false, age: 47, stages: ALL,
    design: 'ล้างบันไดทุกเช้ามายี่สิบปี ชุดแรงงานซีดจาง เชือกนิรภัยรอบเอว ไม้ถูพื้นคู่กาย เห็นทุกอย่างแต่ไม่พูด',
    look: { outfit: 'rags', hat: 'bandana', tool: 'broom', cloth: 0x8a7a5a, cloth2: 0x5a6a7a, hair: 0x5a4a3a, hairStyle: 0, beard: 1, eye: 0x5a3a1e, skin: 0xc89870, accent: 0x8a7a5a }, sig: [POSE.idle, POSE.work2, POSE.idle2] },
  { id: 'AZ03-3', name: 'กาธี', title: 'เด็กส่งไปรษณีย์ลม', race: 'human', line: 'ground', fem: true, age: 11, stages: ALL,
    design: 'เด็กหญิงที่อ่านลมโดยไม่ต้องเรียน ผ้าพันศีรษะสีฟ้าพลิ้ว กระเป๋าจดหมายสะพายข้าง วิ่งเร็ว กางแขนรับลม',
    look: { outfit: 'tunic', hat: 'bandana', tool: '', cloth: 0xf0e0b0, cloth2: 0x5aa0d0, hair: 0x2a1a10, hairStyle: 9, eye: 0x2a8a8a, skin: 0xd8a070, mark: 3, accent: 0x8ac8f0 }, sig: [POSE.cheer2, POSE.idle, POSE.wave0, POSE.idle2] },
  // ---- Morhaven: the war lands ----
  { id: 'MH01-1', name: 'กรอมกาธ', title: 'ประมุขสงคราม', race: 'orc', line: 'ogre', fem: false, age: 44, stages: ALL, regalia: ['scars'],
    design: 'โอเกอร์ร่างใหญ่เกือบสองเท่าของออร์ค ผ้าขนสัตว์และเกราะกระดูกพาดไหล่ เขี้ยวใหญ่ ถือค้อนศึกยักษ์ ไม่เคยรบเพื่อชื่อ รบเพื่อให้ฝูงอิ่ม',
    look: { outfit: 'fur', hat: 'horned', tool: 'hammer', cloth: 0x6a3a2a, cloth2: 0x8a8a7a, hair: 0x1a1a1a, hairStyle: 12, beard: 3, eye: 0xc03a2a, skin: 0x6a8a48, mark: 2, build: 2, accent: 0xc8c0a0 }, youth: { outfit: 'tunic', hat: '' } },
  { id: 'MH02-1', name: 'ดราซาร์โมธ', title: 'จอมมารรุ่นปัจจุบัน', race: 'demonkin', fem: false, age: 60, stages: ALL, regalia: ['contract', 'crown'],
    design: 'ชายปีศาจเสื้อคลุมดำแดงทอง เขาโค้งยาวเหมือนแกะสลัก ม้วนสัญญายาวจรดพื้น ผู้ถือบัญชีหนี้ของทั้งนรก ยิ้มบางเหมือนรู้ราคาทุกอย่าง',
    look: { outfit: 'regal', hat: '', tool: 'scepter', cloth: 0x1a1020, cloth2: 0x8a1a2a, hair: 0xe8e0d0, hairStyle: 13, beard: 4, eye: 0xd02a4a, skin: 0xa04a5a, accent: 0xe0a030, pattern: 2, tall: true }, youth: { outfit: 'tunic', cloth: 0x4a1a2a } },
  { id: 'MH03-1', name: 'อุลโมธกาธ', title: 'ราชันย์กูล', race: 'ghoul', line: 'banner', fem: false, age: 40, stages: ['adult', 'elder'], regalia: ['bannerscrap'],
    design: 'ตายมา 300 ปีแต่ยังจำชื่อตัวเองได้ มงกุฎโลหะบิดเบี้ยวจากเกราะศึก ธงหิวสีแดงเก่าผูกไหล่ ผอมแต่ยืนตรงเหมือนยังเป็นแม่ทัพ',
    look: { outfit: 'knight', hat: 'crown', tool: 'banner', cloth: 0x7a2a2a, cloth2: 0x4a4a3a, hair: 0x3a3030, hairStyle: 3, eye: 0xe0e040, skin: 0x8a9a8a, accent: 0x6a2a2a } },
  { id: 'MH07-1', name: 'ราชาเซนจิ', title: 'ราชาแห่งเทนเซอริส', race: 'human', line: 'reborn', fem: false, age: 22, stages: ALL, regalia: ['rebirthmark'],
    design: 'กษัตริย์หนุ่มผู้กลับชาติ มีเส้นแสงบนหน้าผาก ตาเก่าแก่เกินวัย ชุดราชาเรียบแบบเซนสีครามกับขาว ไม่ถืออาวุธ',
    look: { outfit: 'regal', hat: 'circlet', tool: '', cloth: 0x2a3a6a, cloth2: 0xf0f0f0, hair: 0x1a1a20, hairStyle: 11, eye: 0x6ad0ff, skin: 0xf0d0b0, accent: 0xc8e8ff }, sig: [POSE.idle, POSE.idle2, POSE.breath] },
  // ---- Kaz-Durum: the fire continent ----
  { id: 'KD01-1', name: 'กรอมบาร์ด', title: 'มือทั่ง ราชาช่างตี', race: 'dwarf', line: 'smith', fem: false, age: 70, stages: ALL, regalia: ['runes', 'crown'],
    design: 'ราชาช่างตีผู้เฒ่า เคราหงอกยาวถักห่วงโลหะนับร้อย ผ้ากันเปื้อนหนังไหม้เป็นรู มือใหญ่ถือค้อน มงกุฎเหล็กเรียบ ไม่ประดับ',
    look: { outfit: 'apron', hat: '', tool: 'hammer', cloth: 0x7a3a2a, cloth2: 0xd9a030, hair: GRAY, hairStyle: 3, beard: 3, eye: 0x5a3a1e, skin: 0xd08a62, build: 2, accent: 0xe0662a }, sig: [POSE.idle, POSE.work2, POSE.idle2, POSE.work0] },
  { id: 'KD05-1', name: 'อิรมอร์ไลรา', title: 'มารดาสูงสุด', race: 'darkelf', line: 'mother', fem: true, age: 55, stages: ALL, regalia: ['matron'],
    design: 'มารดาผู้ปกครองนครอิรมอร์ ผิวม่วงเข้ม ผมขาวเงินยาว มงกุฎใยแมงมุมประดับทับทิม ชุดดำขลิบเงิน แสงลาวาส้มสะท้อนใต้คาง',
    look: { outfit: 'regal', hat: '', tool: 'scepter', cloth: 0x1a1426, cloth2: 0xb0b8d0, hair: 0xf0f0f8, hairStyle: 13, eye: 0xd04a3a, skin: 0x6a5a80, accent: 0xe0662a, tall: true }, youth: { outfit: 'tunic', cloth: 0x2a2038 } },
  { id: 'KD06-1', name: 'จักรพรรดิฮัลดัลมอร์', title: 'จักรพรรดิปีที่สามสิบ', race: 'lavakin', line: 'emperor', fem: false, age: 40, stages: ALL, regalia: ['crown', 'halo'],
    design: 'จักรพรรดิเผ่าลาวา ผิวหินดำร้าวสว่างเหมือนเตาหลอม ผมเปลวไฟ มงกุฎเหล็กเผาแดง รอยแตกสว่างทั่วตัวเมื่อโกรธ',
    look: { outfit: 'regal', hat: '', tool: 'greatsword', cloth: 0x6a2a1a, cloth2: 0xff8a2a, hair: 0xff8a2a, hairStyle: 4, eye: 0xffd040, skin: 0x3a2a2a, accent: 0xff6a1a, build: 2 }, youth: { outfit: 'tunic', cloth: 0x4a2a1a } },
  { id: 'KD07-1', name: 'ธรอกาดเพลิง', title: 'ราชาแห่งธรอกาด', race: 'dragonkin', line: 'fire', fem: false, age: 60, stages: ALL,
    design: 'ราชาเผ่ามังกรสายเพลิง เขาโค้งทองสองข้าง เกล็ดแดงทั่วแขน หางหนา ถือดาบใหญ่ ควันบาง ๆ ออกจากปากเมื่อพูด',
    look: { outfit: 'plate', hat: '', tool: 'greatsword', cloth: 0xa02a1a, cloth2: 0xd9a030, hair: 0x2a1a10, hairStyle: 4, beard: 2, eye: 0xe8b020, skin: 0xb04a3a, accent: 0xd9a030, build: 2 }, youth: { outfit: 'tunic', cloth: 0xa02a1a } },
  // ---- Nerea: the seas ----
  { id: 'NR06-1', name: 'ราชินีมาเรลีนา', title: 'ผู้ครองประภาคาร', race: 'merfolk', line: 'merrow', fem: true, age: 60, stages: ALL, regalia: ['shellcrown'],
    design: 'ราชินีเงือกอายุสามร้อยปี ผมยาวสีฟ้าครามเหมือนคลื่น มงกุฎเปลือกหอยมุก ชุดบางสีมุกพลิ้วไหว ถือตรีศูลทองและยืนแกว่งเหมือนว่ายน้ำ',
    look: { outfit: 'dress', hat: '', tool: 'trident', cloth: 0xdcecf0, cloth2: 0xf0a0b0, hair: 0x3a80c0, hairStyle: 13, eye: 0x2a5a8a, skin: 0x9ad0d0, accent: 0xf0a0b0 }, youth: { outfit: 'dress', cloth: 0xc8e0e8 } },
  { id: 'NR04-1', name: 'ราชาไอทอลดีป', title: 'ราชาที่ไม่เคยขึ้นผิวน้ำ', race: 'merfolk', line: 'deep', fem: false, age: 70, stages: ALL,
    design: 'ราชาน้ำลึกผิวน้ำเงินเข้มเรืองแสงเป็นจุด ตาโตดำสนิท ไม่เคยเห็นแสงอาทิตย์ จึงเหยียบบกด้วยท่าลังเลและหรี่ตา',
    look: { outfit: 'cloak', hat: '', tool: 'trident', cloth: 0x1a2a4a, cloth2: 0x4ab0c0, hair: GRAY, hairStyle: 13, beard: 3, eye: 0x6af0ff, skin: 0x3a6a9a, accent: 0x6af0ff } },
  { id: 'NR07-1', name: 'สุวรรณนาคี', title: 'ผู้เฝ้าไข่ รักษาการแทนพญานาคราช', race: 'naga', line: 'king', fem: true, age: 55, stages: ALL, regalia: ['multihood', 'halo'],
    design: 'นาคาผู้พิทักษ์ไข่ ท่อนล่างเป็นงูเขียวมรกตเหลือบทอง ฮู้ดแผ่สามเศียรสวมมงกุฎทอง ผ้าสไบลอกคราบพาดไหล่ เคลื่อนช้าอย่างสง่า',
    look: { outfit: 'robe', hat: '', tool: '', cloth: 0xe8c050, cloth2: 0x2a9a8a, hair: 0x0a2a2a, hairStyle: 1, eye: 0xe0c030, skin: 0x3aaa8a, accent: 0xe8c050 }, youth: { outfit: 'tunic', cloth: 0xe8c050 } },
  // ---- Aldria: the plains ----
  { id: 'AL02-1', name: 'สังฆราชบอนิฟาซิอุสที่ 9', title: 'ผู้อัญเชิญผู้กล้า', race: 'human', fem: false, age: 78, stages: ALL,
    design: 'พระสังฆราชผู้เฒ่าที่อัญเชิญผู้กล้าต่างโลก หมวกทรงสูงสีขาวทอง ไม้เท้าประดับ แว่นตาสั่นด้วยอายุ ถอนหายใจบ่อย',
    look: { outfit: 'priest', hat: 'mitre', tool: 'staff', cloth: 0xf6f2e8, cloth2: 0xd9a030, hair: GRAY, hairStyle: 3, beard: 2, eye: 0x5a7a9a, skin: 0xf0d0b0, accent: 0xf2c94c }, sig: [POSE.idle, POSE.talk0, POSE.idle2, POSE.talk1] },
  { id: 'AL16-1', name: 'ไบรอัน แบ็กกินส์', title: 'นายกเมืองไชร์วิก', race: 'halfling', fem: false, age: 70, stages: ALL,
    design: 'ฮาล์ฟลิงเจ้าเมืองตัวกลมแก้มแดง เสื้อกั๊กเขียวกระดุมทอง เท้าเปล่าขนฟู ถือแก้วเบียร์ ปลูกแอปเปิลหลังบ้านโดยไม่รู้ว่ากำลังเลี้ยงต้นไม้โลก',
    look: { outfit: 'vest', hat: '', tool: 'mug', cloth: 0x4a7a3a, cloth2: 0xd9a030, hair: GRAY, hairStyle: 10, beard: 2, eye: 0x5a3a1e, skin: 0xf0c49a, accent: 0xe04848 }, sig: [POSE.idle, POSE.talk0, POSE.idle2, POSE.cheer2] },
  { id: 'AL22-1', name: 'ซิลวานัส', title: 'ประธานสภาเอลฟ์', race: 'elf', line: 'high', fem: false, age: 60, stages: ALL, regalia: ['halo', 'leafcrest'],
    design: 'เอลฟ์สูงผู้เฒ่าห้าร้อยปี ผมขาวยาวถึงเอว มงกุฎทองขาวและใบไม้ เสื้อคลุมลายพันธุ์ไม้ เคลื่อนช้าเหมือนมีเวลาเหลือเฟือ',
    look: { outfit: 'robe', hat: '', tool: 'staff', cloth: 0xe8f0e0, cloth2: 0x3f9a5a, hair: 0xf0f0f0, hairStyle: 13, eye: 0x3a7a3a, skin: 0xf2d6b8, accent: 0xe8d070, tall: true }, sig: [POSE.idle, POSE.idle2, POSE.breath, POSE.idle3] },
  { id: 'AL24-1', name: 'ราชินีคัลเลน', title: 'ราชินีเร่ร่อน', race: 'human', fem: true, age: 29, stages: ALL,
    design: 'ราชินีที่ไม่มีเมือง เสื้อคลุมเดินทางสีม่วงเก่า มงกุฎเรียบวางบนผมเปียที่ยุ่ง รอยยิ้มเหนื่อย ๆ กล้ามเนื้อนักเดินทาง',
    look: { outfit: 'cloak', hat: 'circlet', tool: 'sword', cloth: 0x5a3a7a, cloth2: 0x8a7a3a, hair: 0x9a5a2a, hairStyle: 5, eye: 0x3a7a3a, skin: 0xe0b08a, accent: 0xf2c94c, mark: 1 } },
  { id: 'AL23-1', name: 'ฟางร้อง', title: 'หัวหน้าสหพันธ์ไวลด์มาร์ก', race: 'beast', line: 'wolf', fem: false, age: 45, stages: ALL,
    design: 'หมาป่าหัวหน้าฝูง หูตั้งแหลม ขนคอฟูสีเทาเงิน หางพวง ผ้าพันแขนสีเดียวกับทั้งฝูง ท่าทางระแวงแต่ปกป้อง',
    look: { outfit: 'leather', hat: '', tool: 'axe', cloth: 0x4a5a6a, cloth2: 0xc04a3a, hair: 0x8a8a90, hairStyle: 11, eye: 0xe0b020, skin: 0x8a8a90, accent: 0xc04a3a, build: 2 } },
  // ---- Mecharia: machines ----
  { id: 'MK02-1', name: 'ครอนซ์ที่สอง', title: 'ร่างล้ำสุด', race: 'construct', line: 'installed', fem: false, age: 45, stages: ALL,
    design: 'ผู้ติดตั้งชิ้นส่วนเหล็กมากที่สุดในโลก แขนขวาและขาซ้ายเป็นทองเหลืองขัดเงา ตาข้างหนึ่งเป็นเลนส์แดง แว่นกันฝุ่นบนหัว ไอน้ำออกจากข้อต่อ',
    look: { outfit: 'leather', hat: 'goggles', tool: 'hammer', cloth: 0x3a3a4a, cloth2: 0xc08a3a, hair: 0x2a2a2a, hairStyle: 4, eye: 0x6ad0ff, skin: 0xe0b08a, accent: 0xc08a3a, build: 2 }, youth: { outfit: 'tunic', hat: '', extra: ['-mecharm', '-mecheye', '-plates', '-rivets', '-steam'] } as Partial<Look> },
  { id: 'MK03-1', name: 'ไวรอน-1', title: 'หุ่นตัวแรกที่ตื่น', race: 'soulmachine', line: 'brass', fem: false, age: 70, stages: ['adult', 'elder'], regalia: ['antennaMech'],
    design: 'หุ่นตัวแรกที่ถามว่า "ข้ามาจากอะไร" ทองเหลืองเก่ามีรอยสึก แกนวิญญาณกลางอกเรืองฟ้าอ่อน เอียงคอบ่อยเหมือนยังเรียนรู้ทุกอย่าง',
    look: { outfit: 'scholar', hat: '', tool: 'book', cloth: 0x4a3a2a, cloth2: 0x6ad0ff, eye: 0x6ad0ff, skin: 0xb07a30, accent: 0x6ad0ff }, sig: [POSE.idle, POSE.talk1, POSE.idle2, POSE.read] },
  { id: 'NB10-1', name: 'ไนน์', title: 'ประธานสภาผู้รอดชีวิตตุ๊กตา', race: 'construct', line: 'doll', fem: true, age: 24, stages: ['child', 'teen', 'adult'],
    design: 'ผู้รอดชีวิตจากโครงการตุ๊กตา ผิวเซรามิกขาวมีเส้นต่อที่ข้อศอกและคอ ตาแก้วกลมนิ่ง ชุดกระโปรงลูกไม้เก่าที่เย็บซ่อมหลายครั้ง',
    look: { outfit: 'dress', hat: '', tool: '', cloth: 0xf0e0e8, cloth2: 0xc06a8a, hair: 0xe8d0b0, hairStyle: 9, eye: 0x6a8ae0, skin: 0xf6ece0, accent: 0xc06a8a } },
  // ---- Saharan: sands and stone ----
  { id: 'SH02-1', name: 'ฟาโรห์อัมเมนรา-เนบ', title: 'ฟาโรห์ผู้ไม่ตาย', race: 'mummy', line: 'pharaoh', fem: false, age: 60, stages: ['adult', 'elder'], regalia: ['goldbeard', 'canopic'],
    design: 'ฟาโรห์อายุสี่พันปี ผ้าพันทอง ปลอกคออัสคห์ ผ้าคลุมเนมส์ลายทางน้ำเงินทอง ตาเรืองเขียวใต้ผ้าพัน ธุลีทิพย์โรยตามทาง',
    look: { outfit: 'regal', hat: 'nemes', tool: 'scepter', cloth: 0xe8d8a8, cloth2: 0x2a6aa0, eye: 0x6aff9a, skin: 0xc8a878, accent: 0xe8c050 } },
  { id: 'SH03-1', name: 'โกรม-ทอร์', title: 'ผู้เฝ้าบันไดหมื่นขั้น', race: 'giant', fem: false, age: 70, stages: ALL,
    design: 'ยักษ์เก้าร้อยปีผิวหินมีมอสและรอยร้าว เคราเป็นก้อนหินสีเทา ถือไม้เท้าท่อนหินยักษ์ ทุกก้าวทำให้ฝุ่นร่วง ตาเหนื่อยแต่ไม่เคยหลับ',
    look: { outfit: 'fur', hat: '', tool: 'staff', cloth: 0x6a5a4a, cloth2: 0x7a7a7a, hair: 0x9a9a9a, hairStyle: 3, beard: 3, eye: 0xd0a030, skin: 0x9a9a90, accent: 0x6a8a4a, build: 2 }, youth: { outfit: 'tunic', beard: 0 } },
  { id: 'SH11-1', name: 'กรัมชาร์', title: 'ขุนศึกออร์ค', race: 'orc', line: 'sand', fem: false, age: 45, stages: ALL,
    design: 'ขุนศึกออร์คทะเลทราย ผ้าพันศีรษะสีทราย เกราะหนังเบา ดาบโค้ง ผิวเขียวมะกอกหม่นเพราะแดด ตาเรียบ ๆ ของคนที่รบเพื่อให้ฝูงอิ่ม',
    look: { outfit: 'light', hat: 'turban', tool: 'sword', cloth: 0xc8a468, cloth2: 0x8a2a1a, hair: 0x1a1a1a, hairStyle: 3, eye: 0xd0a030, skin: 0x8a9a5a, mark: 2, build: 2, accent: 0xd8b060 } },
  { id: 'SH12-1', name: 'ซาเลห์', title: 'ผู้เล่านิทานใหญ่', race: 'human', line: 'sand', fem: false, age: 80, stages: ALL,
    design: 'ผู้เฒ่าเล่านิทานชนใต้ทราย ผ้าโพกหัวสีคราม เคราขาวยาว พิณลูทเก่า มือเปื้อนทราย พูดไปยิ้มไป ท่าทางเหมือนทุกเรื่องที่เล่าเป็นเรื่องจริง',
    look: { outfit: 'light', hat: 'turban', tool: 'lute', cloth: 0x2a5a8a, cloth2: 0xd8b060, hair: GRAY, hairStyle: 3, beard: 3, eye: 0x5a3a1e, skin: 0xb88050, accent: 0xd8b060 }, sig: [POSE.idle, POSE.talk0, POSE.talk1, POSE.idle2] },
  // ---- Silvanel: the forest ----
  { id: 'SV04-1', name: 'ไททาเนีย-เวล', title: 'ราชินีภูต', race: 'fae', fem: true, age: 40, stages: ALL, regalia: ['crown', 'sparkle'],
    design: 'ราชินีภูตตัวจิ๋วลอยเหนือพื้น ปีกใสสะท้อนรุ้งใหญ่เกินตัว ชุดกลีบดอกไม้ ไม่มีโลหะบนตัวเพราะแพ้เหล็ก ยิ้มซุกซนของคนที่รู้ทุกสัญญา',
    look: { outfit: 'dress', hat: '', tool: 'wand', cloth: 0x6a7a5a, cloth2: 0xd8d0a0, hair: 0xb89ab0, hairStyle: 13, eye: 0x6a4a90, skin: 0xe8dcd8, accent: 0xd8d0a0 } },
  { id: 'SV05-1', name: 'สังฆราชจันทรา เซเลเน่', title: 'สังฆราชจันทรา', race: 'elf', line: 'moon', fem: true, age: 55, stages: ALL, regalia: ['halo'],
    design: 'นักบวชหญิงเอลฟ์จันทรา ผมเงินยาว ตราเสี้ยวจันทร์บนหน้าผาก ชุดน้ำเงินม่วงปักดาว ไม้เท้าปลายเป็นพระจันทร์ครึ่งเสี้ยว',
    look: { outfit: 'robe', hat: '', tool: 'orbstaff', cloth: 0x3a3a8a, cloth2: 0xe8e8ff, hair: 0xf0f0f8, hairStyle: 13, eye: 0x7a8ae0, skin: 0xe8e0e8, accent: 0xe8e8ff } },
  { id: 'SV01-1', name: 'เอลเดรียน', title: 'ประธานสภาผู้อาวุโส', race: 'elf', line: 'tree', fem: false, age: 75, stages: ALL, regalia: ['leafcrest', 'moss'],
    design: 'เอลฟ์หนึ่งพันสองร้อยปี ผิวเหมือนเปลือกไม้ มอสเกาะไหล่ มงกุฎใบไม้สดที่ผลัดใบตามฤดู ท่านั่งนิ่งเหมือนต้นไม้ที่ฟังเรื่องของผู้มาเยือน',
    look: { outfit: 'robe', hat: '', tool: 'staff', cloth: 0x4a7a3a, cloth2: 0xe0c060, hair: 0xe0e8d8, hairStyle: 13, beard: 3, eye: 0x3a7a3a, skin: 0xd8b890, accent: 0x3f9a5a }, sig: [POSE.idle, POSE.idle2, POSE.breath, POSE.idle3] },
  { id: 'SV16-1', name: 'รอร์', title: 'หัวหน้าสภาเผ่า (เผ่าสิงโต)', race: 'beast', line: 'cat', fem: false, age: 50, stages: ALL,
    design: 'สิงโตหัวหน้าสภา แผงคอสีทองทองแดงพองฟู ลายพาดข้างแก้ม หางพู่ ผ้าคลุมสีแดงอิฐ หูกลมเล็ก เสียงทุ้มต่ำแต่ใจเย็น',
    look: { outfit: 'cloak', hat: '', tool: 'spear', cloth: 0x9a4a2a, cloth2: 0xd9a030, hair: 0xb87a30, hairStyle: 10, eye: 0xe0a020, skin: 0xd9a050, accent: 0xd9a030, build: 2, extra: ['mane'] } },
  // ---- Nebulia: the mist ----
  { id: 'NB02-1', name: 'วลาดิเมียร์ ซอร์เนบ', title: 'เคานต์ผู้เฒ่า', race: 'vampire', line: 'noble', fem: false, age: 70, stages: ['adult', 'elder'], regalia: ['ledger'],
    design: 'เคานต์แวมไพร์หนึ่งพันแปดร้อยปี ผิวขาวซีดดั่งกระเบื้อง ตาแดงเรือง ปกเสื้อสูง เสื้อคลุมดำแดงเงิน ไม้เท้าหัวสุนัข สมุดบัญชีหนี้เลือดเล่มหนา',
    look: { outfit: 'noble', hat: '', tool: 'cane', cloth: 0x1a1020, cloth2: 0x8a1a2a, hair: 0xf0f0f0, hairStyle: 11, beard: 4, eye: 0xd02020, skin: 0xe8e0e8, accent: 0x8a1a2a, tall: true } },
  { id: 'NB05-1', name: 'นิกซ์', title: 'เจ้าแห่งเงา', race: 'darkelf', line: 'assassin', fem: false, age: 40, stages: ALL,
    design: 'เจ้าแห่งกิลด์เงา ผ้าคลุมหน้าสีดำ มีดสั้นคู่ ไม่มีเงาทอดที่พื้น ขอบตัวเลือนเป็นหมอกม่วง เคลื่อนไหวเงียบ',
    look: { outfit: 'cloak', hat: 'hood', tool: 'sword', cloth: 0x1a1426, cloth2: 0x4a3a6a, hair: 0xc8c8d8, hairStyle: 13, eye: 0xd04a3a, skin: 0x5a4a70, accent: 0x7a6ab0, extra: ['mask', 'noshadow'] } },
  { id: 'NB13-1', name: 'เชด', title: 'ประธานสภาผู้ไร้เงา', race: 'human', line: 'mist', fem: false, age: 60, stages: ALL,
    design: 'ผู้ที่สูญเสียเงา ผิวซีดเทา ชุดคลุมสีควัน ขอบตัวจางเหมือนจะหายไปกับหมอก ตะเกียงเล็กในมือที่ส่องไม่เห็นเงาของตัวเอง',
    look: { outfit: 'cloak', hat: 'hood', tool: 'lantern', cloth: 0x7a8094, cloth2: 0x4a5064, hair: 0x8a94a8, hairStyle: 3, eye: 0x8a94a8, skin: 0xd8d0d8, accent: 0x8a94a8, extra: ['noshadow'] } },
  // ---- the lore at large ----
  { id: 'SL-KING', name: 'ราชันย์สไลม์', title: 'สไลม์ผู้กลืนความรู้', race: 'slime', line: 'king', fem: false, age: 50, stages: ['child', 'teen', 'adult', 'elder'], regalia: ['crown', 'wisdom'],
    design: 'สไลม์ที่กลืนความทรงจำมากพอจะเป็นนักปราชญ์ ตัวเจลฟ้าใสมีหนังสือ แว่นตา และกระดูกลอยในตัว มงกุฎจากของที่กลืน ตาฉลาดผิดธรรมดา',
    look: { outfit: 'tunic', hat: 'crown', tool: 'book', cloth: 0x4a6aa0, cloth2: 0xd9a030, eye: 0x1b1626, skin: 0x5ab0e8, accent: 0xd9a030 }, sig: [POSE.idle, POSE.read, POSE.idle2, POSE.talk0] },
];

SPECIALS.push(...HALF_SPECIALS);
const byId = new Map(SPECIALS.map((s) => [s.id, s]));
export const specialById = (id: string) => byId.get(id);

/** the look of a special person at a stage of their life */
export function specialStageLook(id: string, stage: Stage): Look | undefined {
  const s = byId.get(id);
  if (!s) return undefined;
  const L = lookFor(`special:${s.id}`, s.race, 'ชาวบ้าน', { gender: s.fem ? 'หญิง' : 'ชาย', hAge: STAGE_AGE[stage], line: s.line, blend: s.blend });
  const graft = L.extra || []; // marks of the other parent (src/data/blood.ts)
  Object.assign(L, s.look);
  L.line = s.line; L.special = s.id; L.fem = s.fem;
  L.extra = [...graft, ...(s.look.extra || []), ...(stage === 'adult' || stage === 'elder' ? s.regalia || [] : [])];
  L.sig = s.sig;
  L.stage = stage === 'adult' || stage === 'elder' ? undefined : stage;
  L.child = stage === 'child' || stage === 'infant';
  L.elder = stage === 'elder';
  if (stage === 'child' || stage === 'infant' || stage === 'teen') {
    Object.assign(L, { outfit: 'tunic', hat: '', tool: '', beard: 0, mark: s.look.mark ? 3 : 0, hairStyle: s.fem ? 9 : 0, ...(s.youth || {}) });
    if (s.youth?.extra) L.extra = [...(L.extra || []), ...s.youth.extra];
    if (stage === 'teen' && s.look.tool && ['sword', 'spear', 'bow', 'staff'].includes(s.look.tool)) L.tool = s.look.tool;
  }
  if (stage === 'elder') { L.hair = mix(s.look.hair ?? L.hair, GRAY, 0.75); L.wear = 1; }
  if (stage !== 'elder' && stage !== 'adult' && s.look.beard) L.beard = 0;
  if (stage === 'adult' && s.age >= 55) L.hair = mix(L.hair, 0x2a2018, 0.6);
  return L;
}

/** the look of a special person at the age the docs give them */
export function specialLook(id: string): Look | undefined {
  const s = byId.get(id);
  return s ? specialStageLook(id, stageOf(s.age)) : undefined;
}
