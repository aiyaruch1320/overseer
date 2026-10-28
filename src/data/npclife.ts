// What ordinary people do all day, what they are working toward, what each town is known for,
// and the festivals each land keeps. Used by the town scene (where people go, what they do with their hands)
// and by the yearly NPC simulation (skills grow, goals get reached and change the town).

// work = the animation and place used in the town scene
export type Work = 'hammer' | 'hoe' | 'fish' | 'sell' | 'pray' | 'patrol' | 'read' | 'cast' | 'sing' | 'chop' | 'dig' | 'sweep' | 'beg' | 'wash'
  | 'cook' | 'serve' | 'train' | 'tend' | 'stroll' | 'heal' | 'sew' | 'brew' | 'haul' | 'hunt' | 'run' | 'play';
export type Place = 'field' | 'dock' | 'smithy' | 'temple' | 'tavern' | 'guild' | 'market' | 'plaza' | 'gate' | 'tree' | 'grave' | 'home' | 'road' | 'water';

export interface NpcJob { id: string; role: string; work: Work; place: Place; skill: string; w: number; coast?: boolean; climate?: string[]; races?: string[]; spec?: string[] }

export const NPC_JOBS: NpcJob[] = [
  { id: 'farmer', role: 'ชาวนา', work: 'hoe', place: 'field', skill: 'การเพาะปลูก', w: 5, spec: ['wine', 'grain', 'spice'] },
  { id: 'shepherd', role: 'คนเลี้ยงแกะ', work: 'tend', place: 'field', skill: 'การเลี้ยงสัตว์', w: 2, spec: ['horse'] },
  { id: 'fisher', role: 'ชาวประมง', work: 'fish', place: 'dock', skill: 'การจับปลา', w: 4, coast: true, spec: ['fish'] },
  { id: 'sailor', role: 'ชาวเรือ', work: 'haul', place: 'dock', skill: 'การเดินเรือ', w: 2, coast: true, spec: ['fish', 'trade'] },
  { id: 'smith', role: 'ช่างตีเหล็ก', work: 'hammer', place: 'smithy', skill: 'การตีเหล็ก', w: 2, spec: ['forge'] },
  { id: 'carpenter', role: 'ช่างไม้', work: 'hammer', place: 'home', skill: 'งานไม้', w: 2 },
  { id: 'woodcutter', role: 'คนตัดไม้', work: 'chop', place: 'tree', skill: 'การตัดไม้', w: 2, climate: ['temperate', 'frozen', 'tropical'] },
  { id: 'miner', role: 'คนงานเหมือง', work: 'dig', place: 'gate', skill: 'การขุดแร่', w: 1, climate: ['volcanic', 'frozen'], races: ['dwarf'], spec: ['mine'] },
  { id: 'merchant', role: 'พ่อค้า', work: 'sell', place: 'market', skill: 'การค้า', w: 4, spec: ['trade', 'spice'] },
  { id: 'baker', role: 'คนทำขนมปัง', work: 'cook', place: 'market', skill: 'การทำอาหาร', w: 2, spec: ['grain'] },
  { id: 'innkeeper', role: 'เจ้าของโรงเตี๊ยม', work: 'serve', place: 'tavern', skill: 'การต้อนรับ', w: 1 },
  { id: 'guard', role: 'ทหารยาม', work: 'patrol', place: 'gate', skill: 'การต่อสู้', w: 3, spec: ['arena'] },
  { id: 'priest', role: 'นักบวช', work: 'pray', place: 'temple', skill: 'การสวดมนต์', w: 2, spec: ['pilgrim'] },
  { id: 'healer', role: 'หมอยา', work: 'heal', place: 'temple', skill: 'การรักษา', w: 1, spec: ['herb'] },
  { id: 'scholar', role: 'นักปราชญ์', work: 'read', place: 'guild', skill: 'ความรู้', w: 1, spec: ['scholar'] },
  { id: 'mage', role: 'นักเวท', work: 'cast', place: 'guild', skill: 'เวทมนตร์', w: 1, spec: ['magic', 'scholar'] },
  { id: 'alchemist', role: 'นักเล่นแร่แปรธาตุ', work: 'brew', place: 'guild', skill: 'การปรุงยา', w: 1, spec: ['herb', 'magic'] },
  { id: 'bard', role: 'นักกวีพเนจร', work: 'sing', place: 'plaza', skill: 'ดนตรี', w: 1 },
  { id: 'tailor', role: 'ช่างตัดเสื้อ', work: 'sew', place: 'home', skill: 'การตัดเย็บ', w: 1, spec: ['silk'] },
  { id: 'washer', role: 'คนซักผ้า', work: 'wash', place: 'water', skill: 'งานบ้าน', w: 1 },
  { id: 'hunter', role: 'นายพราน', work: 'hunt', place: 'gate', skill: 'การล่าสัตว์', w: 1, climate: ['frozen', 'tropical', 'temperate'] },
  { id: 'adventurer', role: 'นักผจญภัย', work: 'train', place: 'guild', skill: 'การต่อสู้', w: 2, spec: ['arena'] },
  { id: 'beggar', role: 'ขอทาน', work: 'beg', place: 'plaza', skill: 'การเอาตัวรอด', w: 1 },
  { id: 'noble', role: 'ขุนนาง', work: 'stroll', place: 'plaza', skill: 'การเมือง', w: 0.6 },
  { id: 'gravekeeper', role: 'สัปเหร่อ', work: 'dig', place: 'grave', skill: 'พิธีศพ', w: 0.5 },
  { id: 'sweeper', role: 'คนกวาดถนน', work: 'sweep', place: 'road', skill: 'ความอดทน', w: 1 },
  { id: 'courier', role: 'คนส่งสาร', work: 'run', place: 'road', skill: 'ความเร็ว', w: 1 },
  { id: 'tamer', role: 'ผู้ฝึกสัตว์', work: 'tend', place: 'field', skill: 'การฝึกสัตว์', w: 1, races: ['beast', 'orc'], spec: ['horse'] },
];
export const npcJob = (id: string) => NPC_JOBS.find((j) => j.id === id) || NPC_JOBS[0];
// the notable townsfolk keep their trades
export const NOTABLE_JOB: Record<string, string> = { ผู้ใหญ่บ้าน: 'noble', นักบวชประจำวิหาร: 'priest', เจ้าของโรงเตี๊ยม: 'innkeeper', หัวหน้าทหารยาม: 'guard', พ่อค้าใหญ่: 'merchant', ช่างตีเหล็ก: 'smith', หมอยาประจำเมือง: 'healer', นักกวีพเนจร: 'bard' };

// ---------------- life goals ----------------
// a goal is worked on year after year; skill and luck move it forward; finishing it changes the person (and sometimes the town)
export interface NpcGoal { id: string; text: string; done: string; jobs?: string[]; minAge?: number; years: [number, number]; fx: string; w: number; countryFlag?: string }
export const NPC_GOALS: NpcGoal[] = [
  { id: 'master', text: 'อยากเป็นสุดยอด{skill}แห่ง{town}', done: '{n} ได้รับการยอมรับว่าเป็นยอดฝีมือด้าน{skill}แห่ง{town}', years: [5, 12], fx: 'fame+8 tag:+master', w: 4 },
  { id: 'shop', text: 'เก็บเงินเปิดร้านของตัวเอง', done: '{n} เปิดร้านของตัวเองได้สำเร็จ ลูกค้าแน่นร้านตั้งแต่วันแรก', jobs: ['merchant', 'baker', 'smith', 'tailor', 'alchemist', 'carpenter', 'farmer'], years: [4, 9], fx: 'fame+4 tag:+shop', w: 3 },
  { id: 'knight', text: 'ฝึกฝนจนได้เป็นอัศวิน', done: '{n} ได้รับแต่งตั้งเป็นอัศวินต่อหน้าผู้คนทั้งเมือง', jobs: ['guard', 'adventurer'], minAge: 16, years: [5, 10], fx: 'fame+10 job:knight', w: 2 },
  { id: 'pilgrim', text: 'เดินทางแสวงบุญไปยังวิหารใหญ่', done: '{n} กลับจากการแสวงบุญ ดวงตาสงบนิ่งกว่าเดิม', jobs: ['priest', 'healer', 'beggar'], years: [2, 5], fx: 'fame+3 tag:+pilgrim', w: 2 },
  { id: 'book', text: 'เขียนตำราที่คนจะจำได้ชั่วกาล', done: 'ตำราของ {n} ถูกคัดลอกไปทั่ว{town}', jobs: ['scholar', 'mage', 'alchemist', 'priest'], years: [6, 14], fx: 'fame+12 tag:+author', w: 2 },
  { id: 'song', text: 'แต่งเพลงที่ทั้งทวีปร้องตาม', done: 'เพลงของ {n} ดังไปทุกโรงเตี๊ยม', jobs: ['bard'], years: [3, 8], fx: 'fame+10 tag:+famous', w: 3 },
  { id: 'dragon', text: 'ล่ามังกรให้ได้สักตัว', done: '{n} กลับมาพร้อมเขี้ยวมังกร! ทั้งเมืองฉลองสามวัน', jobs: ['adventurer', 'hunter', 'guard'], minAge: 18, years: [6, 15], fx: 'fame+20 tag:+dragonslayer', w: 1 },
  { id: 'house', text: 'สร้างบ้านหลังใหม่ให้ครอบครัว', done: '{n} สร้างบ้านหลังใหม่เสร็จ เพื่อนบ้านมาช่วยยกเสาเอก', years: [3, 7], fx: 'tag:+settled', w: 3 },
  { id: 'teach', text: 'หาศิษย์มาสืบทอดวิชา{skill}', done: '{n} ได้ศิษย์คนแรก วิชา{skill}จะไม่สูญหายไปจาก{town}', minAge: 40, years: [2, 6], fx: 'fame+5 tag:+mentor', w: 2 },
  { id: 'travel', text: 'ออกเดินทางไปดูโลกกว้าง', done: '{n} เก็บของออกเดินทางไปดูโลกกว้าง', minAge: 16, years: [2, 6], fx: 'move', w: 1.5 },
  { id: 'cure', text: 'คิดค้นยารักษาโรคระบาด', done: '{n} คิดค้นยารักษาโรคระบาดได้สำเร็จ! คนป่วยทั่วเมืองเริ่มหาย', jobs: ['healer', 'alchemist', 'priest', 'mage'], years: [2, 5], fx: 'fame+25 cure', w: 6, countryFlag: 'plague' },
  { id: 'guild', text: 'ตั้งสมาคมการค้าที่ยิ่งใหญ่', done: '{n} ตั้งสมาคมการค้าได้ เงินทองไหลเข้าเมือง', jobs: ['merchant', 'sailor'], years: [6, 12], fx: 'fame+12 golden', w: 1 },
  { id: 'feed', text: 'ปลูกข้าวให้พอเลี้ยงคนทั้งเมืองในปีข้าวยากหมากแพง', done: '{n} เปิดยุ้งฉางแจกข้าว คนทั้งเมืองรอดจากความอดอยาก', jobs: ['farmer', 'baker', 'merchant', 'noble'], years: [1, 3], fx: 'fame+15 feed', w: 6, countryFlag: 'famine' },
  { id: 'defend', text: 'ปกป้องเมืองจากศัตรู', done: '{n} นำกองอาสาขับไล่ศัตรูออกจากประตูเมือง', jobs: ['guard', 'adventurer', 'hunter'], years: [1, 4], fx: 'fame+15 tag:+hero', w: 5, countryFlag: 'war' },
  { id: 'mayor', text: 'ได้รับเลือกเป็นผู้นำชุมชน', done: '{n} ได้รับเลือกเป็นผู้ใหญ่บ้านคนใหม่', minAge: 35, years: [5, 12], fx: 'fame+10 role:ผู้ใหญ่บ้าน', w: 1 },
  { id: 'vein', text: 'ขุดหาสายแร่ในตำนาน', done: '{n} ขุดพบสายแร่ทองคำ! ผู้คนแห่กันมา', jobs: ['miner'], years: [4, 10], fx: 'fame+10 golden', w: 3 },
];

// ---------------- town specialties ----------------
// every town is known for something: it shapes who lives there, what they do, and the sign at the gate
export interface Specialty { id: string; name: string; icon: string; jobs: string[]; climate?: string[]; races?: string[]; coast?: boolean; capital?: boolean; religion?: string[] }
export const SPECIALTIES: Specialty[] = [
  { id: 'fish', name: 'เมืองประมง', icon: 'river', jobs: ['fisher', 'sailor'], coast: true },
  { id: 'trade', name: 'เมืองท่าการค้า', icon: 'gold', jobs: ['merchant', 'sailor'], coast: true, capital: true },
  { id: 'wine', name: 'ไร่องุ่นและเหล้าองุ่น', icon: 'leaf', jobs: ['farmer', 'innkeeper'], climate: ['temperate'] },
  { id: 'grain', name: 'ยุ้งฉางแห่งแคว้น', icon: 'golden', jobs: ['farmer', 'baker'], climate: ['temperate', 'tropical'] },
  { id: 'spice', name: 'ตลาดเครื่องเทศ', icon: 'desert', jobs: ['merchant', 'farmer'], climate: ['desert', 'tropical'] },
  { id: 'forge', name: 'เมืองช่างเหล็ก', icon: 'weapon', jobs: ['smith', 'miner'], climate: ['volcanic'], races: ['dwarf', 'dragonkin'] },
  { id: 'mine', name: 'เมืองเหมือง', icon: 'gold', jobs: ['miner', 'smith'], climate: ['frozen', 'volcanic'], races: ['dwarf'] },
  { id: 'scholar', name: 'เมืองแห่งปราชญ์', icon: 'book', jobs: ['scholar', 'mage'], capital: true, races: ['elf', 'darkelf'] },
  { id: 'magic', name: 'หอเวทแห่งแคว้น', icon: 'orb', jobs: ['mage', 'alchemist'], races: ['elf', 'fae', 'darkelf'] },
  { id: 'herb', name: 'หมู่บ้านสมุนไพร', icon: 'heal', jobs: ['healer', 'alchemist', 'farmer'], climate: ['tropical'], races: ['fae', 'elf'] },
  { id: 'pilgrim', name: 'เมืองแสวงบุญ', icon: 'bless', jobs: ['priest', 'healer', 'beggar'], religion: ['light', 'ancestor', 'moon', 'naga'] },
  { id: 'arena', name: 'เมืองแห่งลานประลอง', icon: 'herosword', jobs: ['guard', 'adventurer'], races: ['orc', 'beast'], religion: ['war'] },
  { id: 'horse', name: 'ทุ่งเลี้ยงม้า', icon: 'paw', jobs: ['shepherd', 'tamer'], climate: ['temperate', 'desert'], races: ['beast', 'human'] },
  { id: 'silk', name: 'เมืองทอผ้าไหม', icon: 'crown', jobs: ['tailor', 'merchant'], climate: ['tropical', 'temperate'] },
];

// ---------------- local festivals ----------------
// each land keeps one or two; they come round every year in their season (anim = the scene shown in town and in the cutscene)
export interface Festival { id: string; name: string; icon: string; season: number; text: string; religion?: string[]; climate?: string[]; races?: string[]; fx: string }
export const FESTIVALS: Festival[] = [
  { id: 'lantern', name: 'ลอยโคมจันทรา', icon: 'moon', season: 2, religion: ['moon'], text: 'คืนนี้ทั้ง{c}ปล่อยโคมลอยขึ้นฟ้านับหมื่นดวง', fx: 'belief+2 social+2' },
  { id: 'dragon_dance', name: 'ระบำมังกรทอง', icon: 'dragon', season: 0, religion: ['dragon'], text: 'ขบวนระบำมังกรทองยาวร้อยศอกแห่ไปทั่ว{c}', fx: 'brave+3 social+2' },
  { id: 'harvest', name: 'เทศกาลเก็บเกี่ยว', icon: 'golden', season: 2, climate: ['temperate', 'tropical'], religion: ['nature'], text: '{c}ฉลองเก็บเกี่ยว ทุกบ้านแบ่งข้าวใหม่ให้กัน', fx: 'gold+5 social+2' },
  { id: 'boat_race', name: 'แข่งเรือยาว', icon: 'river', season: 1, religion: ['sea', 'naga'], climate: ['islands'], text: 'เรือยาวนับร้อยลำแข่งกันกลางแม่น้ำของ{c}', fx: 'spd+1 social+2' },
  { id: 'tournament', name: 'ประลองยุทธ์', icon: 'herosword', season: 1, religion: ['war', 'light'], races: ['orc'], text: 'ลานประลองยุทธ์ของ{c}เปิด อัศวินทั่วทวีปมาประชันฝีมือ', fx: 'brave+3 fame+2' },
  { id: 'ancestor_night', name: 'คืนรำลึกบรรพชน', icon: 'death', season: 3, religion: ['ancestor'], text: 'ดวงไฟวิญญาณนับพันลอยเหนือสุสานทั่ว{c}', fx: 'belief+3 piety+3' },
  { id: 'fire_fest', name: 'เทศกาลไฟ', icon: 'volcanic', season: 1, climate: ['volcanic'], races: ['dragonkin'], text: 'ชาว{c}เต้นรอบกองไฟสูงเท่าหอคอย', fx: 'brave+3 hp+10' },
  { id: 'ice_fest', name: 'เทศกาลแกะสลักน้ำแข็ง', icon: 'frozen', season: 3, climate: ['frozen'], text: 'รูปสลักน้ำแข็งเรืองแสงตั้งเรียงรายทั่ว{c}', fx: 'int+1 social+2' },
  { id: 'sand_race', name: 'แข่งเรือทราย', icon: 'desert', season: 0, climate: ['desert'], text: 'เรือใบทรายนับสิบลำแข่งกันข้ามเนินทรายของ{c}', fx: 'spd+1 brave+2' },
  { id: 'masquerade', name: 'งานเต้นรำหน้ากาก', icon: 'demon', season: 3, religion: ['demon'], races: ['vampire', 'demonkin'], text: 'ทั้ง{c}สวมหน้ากากเต้นรำใต้แสงไฟสีม่วงตลอดคืน', fx: 'social+3 honest-2' },
  { id: 'star_watch', name: 'คืนชมดาวตก', icon: 'omen', season: 2, races: ['elf', 'fae', 'darkelf'], text: 'ชาว{c}ขึ้นเนินเขาชมฝนดาวตกที่มาทุกร้อยปี', fx: 'int+1 belief+2' },
  { id: 'brew_fest', name: 'เทศกาลเบียร์', icon: 'golden', season: 2, races: ['dwarf', 'halfling'], text: 'ถังเบียร์นับพันถูกเปิดพร้อมกันทั่ว{c}', fx: 'social+3 hp+5' },
  { id: 'great_hunt', name: 'การล่าใหญ่', icon: 'paw', season: 3, races: ['beast', 'orc'], religion: ['nature'], text: 'นักล่าทุกเผ่าใน{c}ออกล่าสัตว์ใหญ่ประจำปี', fx: 'pow+1 brave+2' },
  { id: 'flower_fest', name: 'เทศกาลบุปผา', icon: 'leaf', season: 0, races: ['fae', 'elf'], climate: ['tropical'], text: 'กลีบดอกไม้หลากสีโปรยทั่วถนนของ{c}', fx: 'kind+3 social+2' },
  { id: 'light_procession', name: 'แห่เทียนศักดิ์สิทธิ์', icon: 'bless', season: 0, religion: ['light'], text: 'ขบวนแห่เทียนยาวหลายลี้เคลื่อนผ่าน{c}', fx: 'belief+3 piety+2' },
];
export const festivalById = (id: string) => FESTIVALS.find((f) => f.id === id);
