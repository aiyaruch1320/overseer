import type { StatKey } from '../sim/types';

// ---------- นิสัย (Traits) — 48 ----------
// [id, name, effect DSL (axis shifts + tags), short description]
type TraitRow = [string, string, string, string];
const TRAIT_ROWS: TraitRow[] = [
  ['reckless', 'กล้าบ้าบิ่น', 'brave+40 temper+15', 'พุ่งเข้าใส่ก่อนคิด'],
  ['coward', 'ขี้ขลาด', 'brave-40', 'หนีเก่งกว่าใคร'],
  ['kind', 'ใจบุญ', 'kind+40', 'เห็นใครลำบากไม่ได้'],
  ['cold', 'เลือดเย็น', 'kind-35 temper-20', 'ไม่หวั่นไหวต่อน้ำตา'],
  ['ambitious', 'ทะเยอทะยาน', 'ambition+40', 'อยากเป็นที่หนึ่ง'],
  ['loner', 'รักสันโดษ', 'ambition-25 social-30', 'ขออยู่เงียบ ๆ'],
  ['devout', 'เคร่งศาสนา', 'piety+40', 'สวดทุกเช้าเย็น'],
  ['skeptic', 'ไม่เชื่อเทพ', 'piety-40', 'เทพที่ไหนจะมาสนใจ'],
  ['curious', 'ขี้สงสัย', 'curious+40', 'อยากรู้ไปทุกเรื่อง'],
  ['paranoid', 'ขี้ระแวง', 'curious-25 #distrustful', 'ทุกคนอาจเป็นศัตรู'],
  ['honest', 'ซื่อสัตย์', 'honest+40', 'โกหกไม่เป็น'],
  ['cunning', 'เจ้าเล่ห์', 'honest-40', 'มีแผนสำรองเสมอ'],
  ['hot', 'ใจร้อน', 'temper+40', 'ระเบิดง่าย'],
  ['calm', 'สุขุม', 'temper-40', 'ใจเย็นดั่งน้ำนิ่ง'],
  ['charismatic', 'เข้าสังคมเก่ง', 'social+40', 'ใครก็อยากเป็นเพื่อน'],
  ['shy', 'เก็บตัว', 'social-40', 'พูดน้อย คิดมาก'],
  ['greedy', 'โลภ', 'ambition+15 kind-15 #greedy', 'เห็นทองตาลุกวาว'],
  ['generous', 'ใจกว้าง', 'kind+20 #generous', 'แบ่งปันเสมอ'],
  ['glutton', 'ตะกละ', '#glutton', 'คิดถึงมื้อต่อไปตลอดเวลา'],
  ['lazy', 'ขี้เกียจ', 'ambition-30 #lazy', 'พรุ่งนี้ค่อยทำ'],
  ['diligent', 'ขยันขันแข็ง', 'ambition+15 #diligent', 'ฝึกฝนไม่หยุด'],
  ['flirt', 'เจ้าชู้', 'social+25 #flirt', 'หัวใจมีหลายห้อง'],
  ['loyal_love', 'รักเดียวใจเดียว', '#loyal_love', 'รักใครรักจริง'],
  ['vengeful', 'อาฆาตแค้น', 'temper+15 kind-10 #vengeful', 'ไม่เคยลืมความแค้น'],
  ['forgiving', 'ให้อภัยง่าย', 'kind+20 temper-15 #forgiving', 'ช่างมันเถอะ'],
  ['optimist', 'มองโลกในแง่ดี', 'brave+10 #optimist', 'พรุ่งนี้ต้องดีกว่าเดิม'],
  ['pessimist', 'มองโลกในแง่ร้าย', 'brave-10 #pessimist', 'เดี๋ยวก็ซวยอีก'],
  ['dreamer', 'ช่างฝัน', 'curious+15 #dreamer', 'ฝันชัดกว่าคนอื่น'],
  ['pragmatic', 'ติดดิน', 'curious-10 #pragmatic', 'ฝันก็คือฝัน'],
  ['proud', 'หยิ่งผยอง', 'ambition+15 social-10 #proud', 'ไม่ก้มหัวให้ใคร'],
  ['humble', 'ถ่อมตน', 'ambition-10 #humble', 'ข้าก็แค่คนธรรมดา'],
  ['freedom', 'รักอิสระ', '#wanderer', 'ไม่ชอบอยู่ที่เดิมนาน'],
  ['homebody', 'รักบ้านเกิด', '#homebody', 'บ้านคือที่ที่ดีที่สุด'],
  ['adventurer', 'ชอบผจญภัย', 'curious+20 brave+20 #wanderer', 'ขอบฟ้ากำลังเรียก'],
  ['talkative', 'ช่างพูด', 'social+20 #talkative', 'พูดไม่หยุดแม้ในสนามรบ'],
  ['liar', 'ขี้โกหก', 'honest-30 #liar', 'โกหกจนเชื่อเอง'],
  ['animal_lover', 'รักสัตว์', 'kind+10 #beast_friend', 'สัตว์ทุกตัวคือเพื่อน'],
  ['bloodlust', 'กระหายเลือด', 'kind-30 brave+20 #bloodlust', 'การต่อสู้คือความสุข'],
  ['justice', 'รักความยุติธรรม', 'honest+20 kind+10 #justice', 'ทนเห็นความอยุติธรรมไม่ได้'],
  ['envious', 'ขี้อิจฉา', 'kind-10 #envious', 'ทำไมคนอื่นได้ดีกว่า'],
  ['humor', 'มีอารมณ์ขัน', 'social+10 #humor', 'หัวเราะได้แม้ในงานศพ'],
  ['serious', 'จริงจังเกินเหตุ', '#serious', 'ไม่เข้าใจมุกตลก'],
  ['bookworm', 'หนอนหนังสือ', 'curious+20 #bookworm', 'ตำราคือชีวิต'],
  ['clumsy', 'ซุ่มซ่าม', '#clumsy', 'สะดุดแม้บนพื้นเรียบ'],
  ['stubborn', 'ดื้อรั้น', '#stubborn', 'ใครเตือนก็ไม่ฟัง แม้แต่เทพ'],
  ['gullible', 'หูเบา', '#gullible', 'เชื่อทุกอย่างที่ได้ยิน รวมถึงความฝัน'],
  ['moody', 'อารมณ์แปรปรวน', '#moody', 'เช้าดี บ่ายร้าย'],
  ['family', 'ห่วงครอบครัว', 'kind+10 #family', 'ครอบครัวมาก่อนเสมอ'],
];

export interface Trait { id: string; name: string; fx: string; desc: string }
export const TRAITS: Trait[] = TRAIT_ROWS.map(([id, name, fx, desc]) => ({ id, name, fx, desc }));
export const traitById = (id: string) => TRAITS.find((t) => t.id === id)!;

// Opposite traits that can't co-exist
export const TRAIT_CONFLICTS: [string, string][] = [
  ['reckless', 'coward'], ['kind', 'cold'], ['kind', 'bloodlust'], ['ambitious', 'loner'], ['ambitious', 'lazy'],
  ['devout', 'skeptic'], ['honest', 'cunning'], ['honest', 'liar'], ['hot', 'calm'], ['charismatic', 'shy'],
  ['greedy', 'generous'], ['lazy', 'diligent'], ['flirt', 'loyal_love'], ['vengeful', 'forgiving'],
  ['optimist', 'pessimist'], ['dreamer', 'pragmatic'], ['proud', 'humble'], ['freedom', 'homebody'],
  ['talkative', 'shy'], ['serious', 'humor'], ['stubborn', 'gullible'], ['adventurer', 'homebody'], ['paranoid', 'gullible'],
];

// ---------- ความถนัด (Aptitudes) — 42, each unlocking 3 skill tiers = 126 skills ----------
// [id, name, key stat, tags, [tier1, tier2, tier3]]
type AptRow = [string, string, StatKey, string[], [string, string, string]];
const APT_ROWS: AptRow[] = [
  ['sword', 'ดาบ', 'pow', ['combat', 'blade'], ['ฟันพื้นฐาน', 'ดาบสายลมผ่าใบไม้', 'ดาบตัดเหล็กกล้า']],
  ['axe', 'ขวาน', 'pow', ['combat', 'blade'], ['จามขวาน', 'ขวานพายุหมุน', 'ขวานผ่าภูผา']],
  ['spear', 'หอก', 'pow', ['combat', 'pierce'], ['แทงตรง', 'หอกมังกรทะยาน', 'หอกเจาะสวรรค์']],
  ['bow', 'ธนู', 'spd', ['combat', 'ranged'], ['ยิงแม่น', 'ศรสามดอก', 'ศรล่าดวงดาว']],
  ['dagger', 'มีดสั้น', 'spd', ['combat', 'blade', 'stealth'], ['แทงข้างหลัง', 'มีดเงาคู่', 'ร้อยรอยเชือดในพริบตา']],
  ['unarmed', 'มวยมือเปล่า', 'pow', ['combat', 'blunt'], ['หมัดตรง', 'หมัดพยัคฆ์', 'หมัดทลายภูเขา']],
  ['shield', 'โล่', 'vit', ['combat', 'guard'], ['ตั้งโล่', 'กำแพงเหล็ก', 'ป้อมปราการมนุษย์']],
  ['hammer', 'ค้อน', 'pow', ['combat', 'blunt'], ['ทุบหนัก', 'ค้อนสะเทือนพื้น', 'ค้อนฟ้าผ่า']],
  ['whip', 'แส้', 'spd', ['combat'], ['สะบัดแส้', 'แส้พันธนาการ', 'แส้อสรพิษพันตัว']],
  ['sling', 'หนังสติ๊ก', 'luk', ['combat', 'ranged', 'blunt'], ['ยิงก้อนหิน', 'กระสุนเด้งสามทอด', 'หินพิฆาตยักษ์']],
  ['mounted', 'ขี่สัตว์', 'spd', ['combat', 'ride'], ['ขี่ม้าเป็น', 'ทะยานกลางสนามรบ', 'ผู้ควบคุมอาชาสวรรค์']],
  ['fire', 'เวทไฟ', 'mag', ['magic', 'fire'], ['ลูกไฟ', 'กำแพงเพลิง', 'อัคคีล้างโลก']],
  ['water', 'เวทน้ำ', 'mag', ['magic', 'water'], ['ลูกศรน้ำ', 'คลื่นซัด', 'มหาสมุทรคลั่ง']],
  ['wind', 'เวทลม', 'mag', ['magic', 'wind'], ['ใบมีดลม', 'พายุหมุน', 'ไต้ฝุ่นแห่งเทพ']],
  ['earth', 'เวทดิน', 'mag', ['magic', 'earth', 'blunt'], ['ก้อนหินพุ่ง', 'หนามดิน', 'แผ่นดินแยก']],
  ['ice', 'เวทน้ำแข็ง', 'mag', ['magic', 'ice'], ['หอกน้ำแข็ง', 'ทุ่งเยือกแข็ง', 'ยุคน้ำแข็งนิรันดร์']],
  ['lightning', 'เวทสายฟ้า', 'mag', ['magic', 'lightning'], ['ประกายไฟฟ้า', 'โซ่สายฟ้า', 'ทัณฑ์อัสนีบาต']],
  ['light', 'เวทแสง', 'mag', ['magic', 'light', 'holy'], ['แสงส่องทาง', 'ศรแสงศักดิ์สิทธิ์', 'ตะวันพิพากษา']],
  ['dark', 'เวทมืด', 'mag', ['magic', 'dark'], ['ลูกบอลเงา', 'ม่านราตรี', 'สุริยคราสนิรันดร์']],
  ['necro', 'เนโครแมนซี', 'mag', ['magic', 'dark', 'necro'], ['ปลุกโครงกระดูก', 'กองทัพผีดิบ', 'ราชันย์แห่งความตาย']],
  ['blood', 'เวทโลหิต', 'mag', ['magic', 'blood', 'dark'], ['ดูดเลือด', 'หอกโลหิต', 'ทะเลเลือด']],
  ['illusion', 'เวทมายา', 'int', ['magic', 'illusion'], ['ภาพลวงตา', 'ร่างแยกมายา', 'โลกมายาไร้ทางออก']],
  ['summon', 'อัญเชิญ', 'mag', ['magic', 'summon'], ['เรียกภูตน้อย', 'สัญญาภูตธาตุ', 'อัญเชิญเทพอสูร']],
  ['healing', 'เวทรักษา', 'mag', ['magic', 'heal', 'holy'], ['รักษาแผล', 'ฟื้นฟูหมู่', 'ชุบชีวิต']],
  ['rune', 'อักษรรูน', 'int', ['magic', 'rune'], ['สลักรูนพื้นฐาน', 'รูนป้องกัน', 'รูนบรรพกาล']],
  ['nature', 'เวทธรรมชาติ', 'mag', ['magic', 'nature'], ['คุยกับต้นไม้', 'เถาวัลย์พันธนาการ', 'ผืนป่าตื่น']],
  ['space', 'เวทมิติ', 'int', ['magic', 'space'], ['กล่องเก็บของมิติ', 'วาร์ประยะสั้น', 'ประตูข้ามทวีป']],
  ['divination', 'พยากรณ์', 'int', ['magic', 'seer'], ['ดูดวง', 'นิมิตอนาคต', 'อ่านเส้นชะตา']],
  ['alchemy', 'เล่นแร่แปรธาตุ', 'int', ['craft', 'poison'], ['ปรุงยา', 'ยาพิษไร้สี', 'ศิลาอาถรรพ์']],
  ['contract', 'สัญญาปีศาจ', 'mag', ['magic', 'infernal', 'dark'], ['ลงนามเลือด', 'ทาสปีศาจ', 'สัญญากับอสูรใหญ่']],
  ['curse', 'ไสยศาสตร์', 'mag', ['magic', 'dark', 'hex'], ['ตุ๊กตาสาป', 'คุณไสยเข้าตัว', 'มหาคำสาปเจ็ดชั่วโคตร']],
  ['smithing', 'ตีเหล็ก', 'pow', ['craft', 'smith'], ['ตีมีด', 'ดาบชั้นดี', 'อาวุธในตำนาน']],
  ['cooking', 'ทำอาหาร', 'luk', ['craft', 'cook'], ['ต้มซุป', 'อาหารชาววัง', 'อาหารที่ทำให้มังกรร้องไห้']],
  ['farming', 'เกษตรกรรม', 'vit', ['craft', 'farm'], ['ปลูกผัก', 'นาข้าวทองคำ', 'ผืนดินอุดมไม่สิ้นสุด']],
  ['music', 'ดนตรี', 'luk', ['art', 'charm'], ['ร้องเพลง', 'ขลุ่ยสะกดใจ', 'บทเพลงปลุกวีรชน']],
  ['trade', 'ค้าขาย', 'int', ['social', 'trade'], ['ต่อราคา', 'กองคาราวาน', 'เจ้าพ่อการค้าข้ามทวีป']],
  ['stealth', 'ลอบเร้น', 'spd', ['stealth'], ['ย่องเบา', 'หายตัวในเงา', 'ไร้ตัวตน']],
  ['tracking', 'แกะรอย', 'spd', ['survival', 'ranged'], ['ดูรอยเท้า', 'นายพรานป่าลึก', 'ผู้ล่าสัตว์ในตำนาน']],
  ['taming', 'ฝึกสัตว์', 'luk', ['beast'], ['เลี้ยงหมาป่า', 'ขี่ไวเวิร์น', 'สัญญากับสัตว์เทพ']],
  ['sailing', 'เดินเรือ', 'vit', ['survival', 'sea'], ['พายเรือ', 'กัปตันเรือ', 'ผู้พิชิตเจ็ดคาบสมุทร']],
  ['leadership', 'ความเป็นผู้นำ', 'int', ['social', 'leader'], ['หัวหน้ากลุ่ม', 'แม่ทัพ', 'ผู้นำแห่งยุค']],
  ['charm', 'เสน่ห์', 'luk', ['social', 'charm'], ['ยิ้มหวาน', 'ปากหวานละลายใจ', 'เสน่ห์ล่มเมือง']],
  ['scholar', 'วิชาการ', 'int', ['social', 'scholar'], ['อ่านออกเขียนได้', 'นักปราชญ์', 'ผู้รู้แจ้งทุกศาสตร์']],
  ['mining', 'ขุดแร่', 'vit', ['craft', 'mine'], ['ขุดถ่านหิน', 'หาแร่มิธริล', 'ผู้ปลุกหัวใจขุนเขา']],
  ['absorb', 'กลืนกิน', 'vit', ['absorb'], ['กลืนก้อนหิน', 'เลียนแบบร่าง', 'ผู้ล่า (Predator)']],
];

export interface Aptitude { id: string; name: string; stat: StatKey; tags: string[]; skills: string[] }
export const APTITUDES: Aptitude[] = APT_ROWS.map(([id, name, stat, tags, names]) => ({
  id, name, stat, tags, skills: names.map((_, i) => `${id}_${i + 1}`),
}));
export const aptById = (id: string) => APTITUDES.find((a) => a.id === id)!;

export interface Skill { id: string; name: string; apt: string | null; tier: number; fx: string; tags: string[]; unique?: boolean; desc?: string }

const tiered: Skill[] = APT_ROWS.flatMap(([id, , stat, tags, names]) =>
  names.map((name, i) => ({
    id: `${id}_${i + 1}`, name, apt: id, tier: i + 1,
    fx: `${stat}+${i + 1}`, tags,
  })),
);

// Unique Skills (แรงบันดาลใจจากนิยายต่างโลก)
const UNIQUE_ROWS: [string, string, string, string][] = [
  ['u_sage', 'มหาปราชญ์', 'int+5 #sage #seer', 'เสียงในหัวที่ตอบได้ทุกคำถาม'],
  ['u_predator', 'ผู้ล่ากลืนกิน', 'vit+3 mag+2 #absorb #predator', 'กลืนศัตรูแล้วได้พลังของมัน'],
  ['u_appraisal', 'ประเมินค่า', 'int+2 luk+1 #appraise', 'มองเห็นค่าสถานะของทุกสิ่ง'],
  ['u_itembox', 'กล่องเก็บของไร้ขีดจำกัด', 'luk+2 #itembox #trade', 'แบกทั้งโกดังไว้ในอากาศ'],
  ['u_rewind', 'ย้อนคืนเมื่อสิ้นใจ', 'luk+1 #rewind', 'เมื่อตาย จะตื่นขึ้นอีกครั้ง… ครั้งเดียว'],
  ['u_language', 'ภาษาสากล', 'int+2 #polyglot #charm', 'คุยได้กับทุกเผ่าพันธุ์ รวมถึงมังกร'],
  ['u_swordsaint', 'ขอบเขตดาบ', 'pow+3 spd+2 #blade #combat', 'ทุกสิ่งในรัศมีดาบถูกตัดขาด'],
  ['u_ironbody', 'ร่างเหล็กไหล', 'vit+5 #guard #poison_res', 'ฟันไม่เข้า ยิงไม่ออก'],
  ['u_heroluck', 'โชคแห่งผู้กล้า', 'luk+5 #hero_luck', 'ชะตาเข้าข้างอย่างไร้เหตุผล'],
  ['u_gravity', 'ผู้ควบคุมแรงโน้มถ่วง', 'mag+4 #space #earth', 'ทำให้ภูเขาลอยได้'],
  ['u_oracle', 'เสียงแห่งสวรรค์', 'belief+30 #oracle', 'ได้ยินเสียงเทพชัดเจนกว่าใคร'],
  ['u_ruler', 'ราชันย์ (Ruler)', 'int+2 fame+20 #leader #charm', 'ผู้คนก้มหัวโดยไม่รู้ตัว'],
  ['u_copy', 'คัดลอกทักษะ', 'int+3 #copycat', 'เห็นครั้งเดียวก็ทำได้'],
  ['u_mana', 'แหล่งมานาไร้ก้นบึ้ง', 'mag+5 #magic', 'เวทไม่มีวันหมด'],
  ['u_timestop', 'หยุดเวลา 3 วินาที', 'spd+5 #timestop', 'สามวินาทีที่โลกเป็นของคุณ'],
];
const uniques: Skill[] = UNIQUE_ROWS.map(([id, name, fx, desc]) => ({
  id, name, apt: null, tier: 4, fx, unique: true, desc,
  tags: (fx.match(/#(\w+)/g) || []).map((s) => s.slice(1)),
}));

export const SKILLS: Skill[] = [...tiered, ...uniques];
export const UNIQUE_SKILLS = uniques;
export const skillById = (id: string) => SKILLS.find((s) => s.id === id)!;
