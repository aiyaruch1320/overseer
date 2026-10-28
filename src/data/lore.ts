import type { Character, ChoiceTag, StatKey } from '../sim/types';
import type { Rarity } from '../sim/fortune';

// ---------- อาชีพ (Jobs) ----------
export interface Job {
  id: string;
  name: string;
  icon: string;
  apts: string[]; // aptitudes that favour this job
  stat: StatKey;
  secret?: boolean;
  desc: string;
  r?: Rarity;
  aff?: Record<string, number>; // story context that makes this job more likely to be offered
  chain?: string; // follow-up event this career can lead to
  req?: (c: Character, tags: Set<string>) => boolean;
}

export const JOBS: Job[] = [
  { id: 'farmer', name: 'ชาวนา', icon: 'wheat', apts: ['farming', 'cooking'], stat: 'vit', desc: 'ชีวิตเรียบง่ายกับผืนดิน' },
  { id: 'hunter', name: 'นายพราน', icon: 'bow', apts: ['bow', 'tracking', 'taming'], stat: 'spd', desc: 'ล่าสัตว์ในป่าลึก' },
  { id: 'soldier', name: 'ทหาร', icon: 'shield', apts: ['sword', 'spear', 'shield', 'axe'], stat: 'pow', desc: 'รับใช้แผ่นดินด้วยคมอาวุธ' },
  { id: 'adventurer', name: 'นักผจญภัย', icon: 'move', apts: ['sword', 'dagger', 'bow', 'tracking', 'stealth'], stat: 'spd', desc: 'สมาชิกกิลด์ รับเควสต์แลกเงิน' },
  { id: 'merchant', name: 'พ่อค้า', icon: 'gold', apts: ['trade', 'charm', 'sailing'], stat: 'int', desc: 'ซื้อถูกขายแพง' },
  { id: 'mage', name: 'นักเวท', icon: 'orb', apts: ['fire', 'water', 'wind', 'earth', 'ice', 'lightning', 'summon', 'rune', 'space'], stat: 'mag', desc: 'ศึกษาความลับแห่งมานา' },
  { id: 'priest', name: 'นักบวช', icon: 'bless', apts: ['light', 'healing', 'divination'], stat: 'mag', desc: 'รับใช้เทพ… ซึ่งก็คือเรา' },
  { id: 'thief', name: 'โจร', icon: 'key', apts: ['dagger', 'stealth', 'whip'], stat: 'spd', desc: 'ทรัพย์สินของผู้อื่นคือโอกาส' },
  { id: 'smith', name: 'ช่างตีเหล็ก', icon: 'hammer', apts: ['smithing', 'mining', 'hammer'], stat: 'pow', desc: 'หลอมเหล็กให้เป็นตำนาน' },
  { id: 'scholar', name: 'นักปราชญ์', icon: 'book', apts: ['scholar', 'rune', 'alchemy', 'divination'], stat: 'int', desc: 'ใฝ่หาความรู้' },
  { id: 'bard', name: 'กวีพเนจร', icon: 'note', apts: ['music', 'charm'], stat: 'luk', desc: 'ร้องเพลงแลกขนมปัง' },
  { id: 'fisher', name: 'ชาวประมง', icon: 'fish', apts: ['sailing', 'water', 'spear'], stat: 'vit', desc: 'ฝากชีวิตไว้กับท้องทะเล' },
  { id: 'healer', name: 'หมอยา', icon: 'leaf', apts: ['healing', 'alchemy', 'nature'], stat: 'int', desc: 'รักษาผู้คนด้วยสมุนไพร' },
  { id: 'knight', name: 'อัศวิน', icon: 'goldshield', apts: ['sword', 'mounted', 'shield', 'leadership'], stat: 'pow', desc: 'ถือคำสาบานแห่งเกียรติ' },
  { id: 'assassin', name: 'นักฆ่า', icon: 'nemesis', apts: ['dagger', 'stealth', 'alchemy'], stat: 'spd', desc: 'รับงานในเงามืด' },
  { id: 'druid', name: 'เดรุยด์', icon: 'leaf', apts: ['nature', 'taming', 'earth'], stat: 'mag', desc: 'ผู้พิทักษ์ผืนป่า' },
  { id: 'pirate', name: 'โจรสลัด', icon: 'jolly', apts: ['sailing', 'sword', 'whip'], stat: 'pow', desc: 'อิสระบนคลื่น' },
  { id: 'cook', name: 'พ่อครัว', icon: 'pot', apts: ['cooking', 'trade'], stat: 'luk', desc: 'ปรุงอาหารเลิศรส' },
  { id: 'warlock', name: 'ผู้ทำสัญญา', icon: 'darkbook', apts: ['contract', 'dark', 'curse', 'blood'], stat: 'mag', desc: 'ยืมพลังจากสิ่งที่ไม่ควรยืม' },
  { id: 'tamer', name: 'ผู้ฝึกอสูร', icon: 'paw', apts: ['taming', 'mounted', 'tracking'], stat: 'luk', desc: 'มีสัตว์อสูรเป็นคู่หู' },
  { id: 'noble', name: 'ขุนนาง', icon: 'crown', apts: ['leadership', 'charm', 'trade'], stat: 'int', desc: 'การเมืองคือสนามรบ', req: (c) => c.flags.includes('noble') },
  { id: 'monk', name: 'นักพรต', icon: 'halo', apts: ['unarmed', 'healing'], stat: 'vit', desc: 'ฝึกกายและใจ' },
  // ชีวิตธรรมดาและงานที่ไม่ต้องจับอาวุธ
  { id: 'scribe', name: 'เสมียน', icon: 'scroll', apts: ['scholar', 'rune'], stat: 'int', desc: 'คัดลอกตำราและจดหมายของขุนนาง' },
  { id: 'shepherd', name: 'คนเลี้ยงแกะ', icon: 'paw', apts: ['taming', 'farming'], stat: 'vit', desc: 'ใช้ชีวิตกลางทุ่งกับฝูงแกะ' },
  { id: 'carpenter', name: 'ช่างไม้', icon: 'hammer', apts: ['smithing', 'mining', 'earth'], stat: 'pow', desc: 'สร้างบ้าน เรือ และเกวียน' },
  { id: 'weaver', name: 'ช่างทอผ้า', icon: 'flower', apts: ['trade', 'charm', 'illusion'], stat: 'luk', desc: 'ทอผ้าลายที่เล่าเรื่องได้' },
  { id: 'servant', name: 'คนรับใช้ในวัง', icon: 'home', apts: ['cooking', 'charm', 'stealth'], stat: 'spd', desc: 'ได้ยินความลับของราชสำนักทุกวัน' },
  { id: 'performer', name: 'นักแสดงละคร', icon: 'tone_comedy', apts: ['music', 'charm', 'illusion'], stat: 'luk', desc: 'เล่นเป็นวีรชนบนเวที' },
  { id: 'teacher', name: 'ครู', icon: 'book', apts: ['scholar', 'leadership'], stat: 'int', desc: 'สอนเด็ก ๆ อ่านเขียน' },
  { id: 'seer', name: 'หมอดู', icon: 'eye', apts: ['divination', 'illusion'], stat: 'int', desc: 'อ่านดวงดาวและเส้นลายมือ' },
  { id: 'archaeologist', name: 'นักสำรวจซากโบราณ', icon: 'scroll', apts: ['scholar', 'rune', 'mining'], stat: 'int', desc: 'ขุดค้นอารยธรรมที่สาบสูญ' },
  { id: 'spy', name: 'สายลับ', icon: 'omen', apts: ['stealth', 'charm', 'illusion'], stat: 'spd', desc: 'ทำงานให้คนที่จ่ายสูงสุด' },
  { id: 'diplomat', name: 'นักการทูต', icon: 'friend', apts: ['charm', 'leadership', 'trade'], stat: 'int', desc: 'หยุดสงครามด้วยคำพูด' },
  { id: 'gravekeeper', name: 'คนเฝ้าสุสาน', icon: 'death', apts: ['necro', 'curse', 'light'], stat: 'vit', desc: 'ดูแลผู้ตาย และกันไม่ให้พวกเขาลุกขึ้น' },
  { id: 'innkeeper', name: 'เจ้าของโรงเตี๊ยม', icon: 'pot', apts: ['cooking', 'trade', 'charm'], stat: 'luk', desc: 'ทุกข่าวลือเริ่มที่โต๊ะของเรา' },
  { id: 'miner', name: 'คนงานเหมือง', icon: 'hammer', apts: ['mining', 'earth'], stat: 'vit', desc: 'ขุดแร่ในความมืด' },
  { id: 'sailor', name: 'ลูกเรือ', icon: 'fish', apts: ['sailing', 'water'], stat: 'vit', desc: 'ชีวิตบนดาดฟ้าเรือ' },
  { id: 'alchemist', name: 'นักเล่นแร่แปรธาตุ', icon: 'orb', apts: ['alchemy', 'fire'], stat: 'int', desc: 'ตามหาศิลานักปราชญ์' },
  { id: 'royal_guard', name: 'ราชองครักษ์', icon: 'goldshield', apts: ['shield', 'sword', 'spear'], stat: 'pow', desc: 'ยืนเฝ้าบัลลังก์', req: (c) => c.flags.includes('noble') || c.fame >= 15 },
  // ผู้ติดตาม — ได้มาเมื่อผู้กล้าหรือจอมมารผ่านเข้ามาในชีวิต
  { id: 'hero_companion', name: 'ผู้ติดตามผู้กล้า', icon: 'herosword', apts: [], stat: 'pow', desc: 'ร่วมเดินทางกับผู้กล้าแห่งยุค', req: (c) => c.flags.includes('follower_hero') },
  { id: 'demon_servant', name: 'สมุนจอมมาร', icon: 'demon', apts: [], stat: 'mag', desc: 'รับใช้จอมมารในกองทัพแห่งความมืด', req: (c) => c.flags.includes('follower_demon') },
  // ----- อาชีพลับ -----
  { id: 'lich', name: 'ลิช', icon: 'lich', apts: [], stat: 'mag', secret: true, desc: 'จอมเวทที่เอาชนะความตายด้วยการละทิ้งชีวิต',
    req: (c, t) => (t.has('necro') || t.has('lich_seed')) && c.stats.int >= 13 && c.stats.mag >= 13 && (t.has('cursed_blood') || t.has('lich_seed') || c.axes.kind < -20) },
  { id: 'demonlord', name: 'ราชาปีศาจ', icon: 'demon', apts: [], stat: 'mag', secret: true, desc: 'ผู้ปกครองแห่งความมืด',
    req: (c, t) => c.axes.kind < -40 && c.axes.ambition > 40 && (t.has('infernal') || t.has('demon_mark')) && c.stats.mag >= 13 },
  { id: 'saint', name: 'นักบุญ', icon: 'halo', apts: [], stat: 'mag', secret: true, desc: 'ผู้เปี่ยมด้วยแสงศักดิ์สิทธิ์',
    req: (c, t) => c.axes.piety > 50 && c.axes.kind > 30 && t.has('holy') && c.belief > 40 },
  { id: 'hero', name: 'ผู้กล้า', icon: 'herosword', apts: [], stat: 'pow', secret: true, desc: 'ผู้ถูกเลือกให้ปราบราชาปีศาจ',
    req: (c, t) => c.flags.includes('chosen') || (c.axes.brave > 50 && c.axes.kind > 20 && c.weapon?.kind === 'holy' && c.fame >= 30) },
  { id: 'swordsaint', name: 'เซียนดาบ', icon: 'weapon', apts: [], stat: 'pow', secret: true, desc: 'ผู้ที่ฟันได้แม้กระทั่งสายลม',
    req: (c) => c.skills.includes('sword_3') && c.stats.pow >= 15 && c.stats.spd >= 12 },
  { id: 'dragonknight', name: 'อัศวินมังกร', icon: 'dragon', apts: [], stat: 'pow', secret: true, desc: 'ขี่มังกรเหนือสนามรบ',
    req: (c, t) => (c.race === 'dragonkin' || c.flags.includes('dragon_bond')) && (c.aptitudes.includes('spear') || c.aptitudes.includes('mounted') || t.has('ride')) },
  { id: 'archmage', name: 'จอมปราชญ์เวท', icon: 'orb', apts: [], stat: 'mag', secret: true, desc: 'ผู้เชี่ยวชาญทุกธาตุ',
    req: (c, t) => c.stats.mag >= 17 && c.stats.int >= 14 && c.skills.filter((s) => /^(fire|water|wind|earth|ice|lightning|light|dark)_/.test(s)).length >= 3 },
  { id: 'beastking', name: 'ราชันย์อสูร', icon: 'beast', apts: [], stat: 'pow', secret: true, desc: 'อสูรทั้งปวงยอมสยบ',
    req: (c, t) => (c.race === 'beast' || t.has('beast_friend')) && (c.aptitudes.includes('taming') || t.has('beast')) && c.stats.pow >= 13 },
  { id: 'piratelord', name: 'ราชาโจรสลัด', icon: 'jolly', apts: [], stat: 'luk', secret: true, desc: 'ผู้ครอบครองเจ็ดคาบสมุทร',
    req: (c) => c.job === 'pirate' && c.fame >= 25 && c.gold >= 150 },
  { id: 'slimeking', name: 'ราชันย์สไลม์', icon: 'amorphous', apts: [], stat: 'vit', secret: true, desc: 'สไลม์ผู้กลืนกินจนกลายเป็นตำนาน',
    req: (c, t) => c.race === 'slime' && (t.has('predator') || c.skills.includes('absorb_3') || c.kills >= 6) },
  { id: 'sage', name: 'มหาปราชญ์', icon: 'goldbook', apts: [], stat: 'int', secret: true, desc: 'ผู้รู้แจ้งความลับของโลก',
    req: (c, t) => c.stats.int >= 18 || (t.has('sage') && c.stats.int >= 14) },
  { id: 'vampirelord', name: 'บรรพบุรุษแวมไพร์', icon: 'fangs', apts: [], stat: 'mag', secret: true, desc: 'ต้นสายเลือดแห่งรัตติกาล',
    req: (c, t) => (c.race === 'vampire' || t.has('vampire_bite')) && t.has('blood') && c.fame >= 15 },
  { id: 'shadowmaster', name: 'เจ้าแห่งเงา', icon: 'omen', apts: [], stat: 'spd', secret: true, desc: 'ผู้ไม่มีตัวตนบนโลก',
    req: (c) => c.skills.includes('stealth_3') || (c.race === 'darkelf' && c.job === 'assassin' && c.kills >= 4) },
  { id: 'godslayer', name: 'ผู้ล่าเทพ', icon: 'nemesis', apts: [], stat: 'pow', secret: true, desc: 'ผู้ที่ปฏิเสธพระเจ้า… และตามล่าพระองค์',
    req: (c) => c.belief <= -70 && c.axes.brave > 30 },
  { id: 'prophet', name: 'ศาสดา', icon: 'faith', apts: [], stat: 'int', secret: true, desc: 'ผู้ได้ยินเสียงพระเจ้าและเผยแผ่ศรัทธา',
    req: (c) => c.belief >= 85 && c.axes.piety > 40 },
];
const JOB_META: Record<string, [Rarity, Record<string, number>, string]> = {
  farmer: ['C', { 'climate:temperate': 1, 'countryflag:famine': 1 }, 'chain_harvest_spirit'],
  hunter: ['C', { 'climate:frozen': 1, 'climate:tropical': 1, 'thread:wild': 1 }, 'chain_light_sword'],
  soldier: ['C', { 'countryflag:war': 2, 'religion:war': 1.5, 'thread:warrior': 1.5 }, 'chain_light_sword'],
  adventurer: ['U', { 'thread:wanderer': 1.5, 'thread:hero': 1 }, 'chain_light_sword'],
  merchant: ['U', { 'climate:desert': 1, 'thread:greed': 1.5 }, 'chain_caravan_fortune'],
  mage: ['R', { 'thread:arcane': 2, 'birthsign:comet': 1.5 }, 'chain_arcane_tome'],
  priest: ['R', { 'religion:light': 2, 'religion:moon': 1, 'thread:faithful': 2, 'belief:devoted': 1.5 }, 'chain_holy_vision'],
  thief: ['C', { 'thread:outlaw': 2, minority: 1 }, 'chain_guild_invite'],
  smith: ['U', { 'race:dwarf': 2, 'climate:volcanic': 1 }, 'chain_master_forge'],
  scholar: ['R', { 'thread:arcane': 1.5, 'trait:bookworm': 2 }, 'chain_arcane_tome'],
  bard: ['U', { 'thread:romance': 1.5, 'race:merfolk': 1 }, 'chain_royal_song'],
  fisher: ['C', { 'climate:islands': 2.5 }, 'chain_sea_treasure'],
  healer: ['U', { 'countryflag:plague': 2, 'thread:hero': 1 }, 'chain_plague_cure'],
  knight: ['R', { 'flag:noble': 2, 'religion:light': 1.5, 'thread:hero': 1.5 }, 'chain_light_sword'],
  assassin: ['R', { 'race:darkelf': 1.5, 'thread:dark': 1.5, 'thread:outlaw': 1 }, 'chain_guild_invite'],
  druid: ['U', { 'religion:nature': 2, 'climate:tropical': 1, 'thread:wild': 1.5 }, 'chain_beast_companion'],
  pirate: ['U', { 'climate:islands': 2, 'thread:outlaw': 1.5 }, 'chain_sea_treasure'],
  cook: ['C', { 'race:halfling': 2 }, 'chain_royal_banquet'],
  warlock: ['R', { 'religion:demon': 2.5, 'thread:dark': 2 }, 'chain_dark_patron'],
  tamer: ['U', { 'thread:wild': 2, 'race:beast': 1 }, 'chain_beast_companion'],
  noble: ['R', { 'flag:noble': 3 }, 'chain_court_intrigue'],
  monk: ['U', { 'thread:faithful': 1.5, 'religion:moon': 1 }, 'chain_enlightenment'],
  scribe: ['C', { 'thread:arcane': 1, 'trait:bookworm': 1.5 }, ''], shepherd: ['C', { 'climate:temperate': 1, 'climate:frozen': 1, 'thread:wild': 1 }, ''],
  carpenter: ['C', { 'race:dwarf': 1 }, ''], weaver: ['C', { 'race:fae': 1, 'race:halfling': 1 }, ''], servant: ['C', { minority: 1 }, ''],
  performer: ['U', { 'thread:romance': 1.5, 'race:fae': 1 }, ''], teacher: ['U', { 'trait:kind': 1, 'trait:bookworm': 1 }, ''],
  seer: ['R', { 'religion:moon': 2.5, 'birthsign:comet': 1.5, 'thread:faithful': 1 }, ''], archaeologist: ['R', { 'thread:wanderer': 1.5, 'thread:arcane': 1 }, ''],
  spy: ['R', { 'thread:outlaw': 1.5, 'race:darkelf': 1.5, 'countryflag:war': 1 }, ''], diplomat: ['R', { 'flag:noble': 1.5, 'countryflag:war': 1.5 }, ''],
  gravekeeper: ['U', { 'religion:ancestor': 2, 'thread:dark': 1 }, ''], innkeeper: ['C', { 'race:halfling': 1.5, 'race:dwarf': 1 }, ''],
  miner: ['C', { 'race:dwarf': 2, 'climate:volcanic': 1.5 }, ''], sailor: ['C', { 'climate:islands': 2 }, ''],
  alchemist: ['R', { 'thread:arcane': 1.5, 'climate:volcanic': 1 }, ''], royal_guard: ['R', { 'flag:noble': 2, 'thread:warrior': 1.5 }, ''],
  hero_companion: ['E', { 'flag:follower_hero': 20 }, ''], demon_servant: ['E', { 'flag:follower_demon': 20 }, ''],
};
for (const j of JOBS) {
  const m = JOB_META[j.id];
  if (m) { j.r = m[0]; j.aff = m[1]; j.chain = m[2] || undefined; } else if (j.secret) j.r = 'L';
}
export const jobById = (id: string) => JOBS.find((j) => j.id === id)!;

// ---------- มอนสเตอร์ ----------
export interface Monster {
  id: string;
  name: string;
  icon: string;
  dc: number;
  climates: string[] | 'any';
  tags: string[];
  weak: string[];
  resist: string[];
  attack: string[]; // what it hits with — matches race weaknesses (e.g. 'iron' vs fae, 'light' vs vampire)
  text: string;
  loot: string;
  minAge?: number;
}

export const MONSTERS: Monster[] = [
  { id: 'goblin', name: 'ฝูงก๊อบลิน', icon: 'humanoid', dc: 9, climates: ['temperate', 'tropical'], tags: ['humanoid'], weak: ['fire', 'leader'], resist: [], attack: ['iron'], text: 'ก๊อบลินห้าตัวโผล่จากพุ่มไม้ ถือมีดขึ้นสนิมและรอยยิ้มไม่ประสงค์ดี', loot: 'gold+10' },
  { id: 'wolf', name: 'หมาป่าเงา', icon: 'beast', dc: 10, climates: ['temperate', 'frozen'], tags: ['beast'], weak: ['fire', 'beast_friend'], resist: [], attack: [], text: 'เสียงหอนดังรอบทิศ ดวงตาสีแดงนับสิบจ้องมาจากความมืด', loot: 'gold+5' },
  { id: 'slime', name: 'สไลม์ป่า', icon: 'amorphous', dc: 6, climates: 'any', tags: ['amorphous'], weak: ['fire', 'ice', 'absorb'], resist: ['blade'], attack: [], text: 'ก้อนเยลลี่สีเขียวกระดึ๊บเข้ามาอย่างมุ่งมั่น', loot: 'gold+2' },
  { id: 'troll', name: 'โทรลล์ภูเขา', icon: 'giant', dc: 15, climates: ['frozen', 'temperate'], tags: ['giant', 'regen'], weak: ['fire', 'light'], resist: ['blunt'], attack: [], text: 'โทรลล์สูงสามเมตรขวางสะพาน มันอยากได้ค่าผ่านทาง… เป็นเนื้อสด', loot: 'gold+30 fame+5' },
  { id: 'skeleton', name: 'กองทัพโครงกระดูก', icon: 'undead', dc: 11, climates: 'any', tags: ['undead'], weak: ['light', 'holy', 'blunt', 'undead_bane'], resist: ['pierce', 'poison'], attack: [], text: 'สุสานเก่าสั่นไหว โครงกระดูกลุกขึ้นมาพร้อมดาบผุ ๆ', loot: 'gold+15' },
  { id: 'vampire', name: 'เคานต์แวมไพร์', icon: 'fangs', dc: 17, climates: ['frozen', 'temperate'], tags: ['undead', 'vampire'], weak: ['light', 'holy', 'fire', 'undead_bane'], resist: ['dark', 'blade'], attack: ['blood', 'charm'], text: 'ชายในชุดดำยิ้มเผยเขี้ยว "แขกของข้า… ช่างหอมหวาน"', loot: 'gold+60 fame+10' },
  { id: 'lich', name: 'ลิชโบราณ', icon: 'lich', dc: 21, climates: 'any', tags: ['undead', 'mage'], weak: ['light', 'holy', 'undead_bane'], resist: ['dark', 'ice', 'magic'], attack: ['dark', 'curse'], text: 'อากาศเย็นเฉียบ จอมเวทผีดิบในมงกุฎแตกลอยออกมาจากหลุมศพ', loot: 'gold+100 fame+25 skill:random', minAge: 20 },
  { id: 'wyvern', name: 'ไวเวิร์น', icon: 'dragon', dc: 15, climates: ['volcanic', 'desert', 'temperate'], tags: ['dragon', 'flying'], weak: ['ranged', 'ice', 'lightning', 'dragon_bane'], resist: [], attack: ['poison'], text: 'เงาปีกใหญ่บดบังดวงอาทิตย์ หางพิษแกว่งไปมา', loot: 'gold+40 fame+8' },
  { id: 'firedragon', name: 'มังกรเพลิง', icon: 'dragon', dc: 24, climates: ['volcanic'], tags: ['dragon'], weak: ['ice', 'water', 'dragon_bane'], resist: ['fire', 'blade'], attack: ['fire'], text: 'ภูเขาไฟคำราม มังกรเพลิงลืมตาจากการหลับใหลพันปี', loot: 'gold+300 fame+50', minAge: 18 },
  { id: 'icedragon', name: 'มังกรน้ำแข็ง', icon: 'icedragon', dc: 23, climates: ['frozen'], tags: ['dragon'], weak: ['fire', 'dragon_bane'], resist: ['ice'], attack: ['ice'], text: 'พายุหิมะหยุดนิ่ง มังกรสีฟ้าครามลดตัวลงตรงหน้า', loot: 'gold+250 fame+45', minAge: 18 },
  { id: 'sandworm', name: 'หนอนทรายยักษ์', icon: 'insect', dc: 16, climates: ['desert'], tags: ['beast', 'giant'], weak: ['lightning', 'water'], resist: ['blunt'], attack: [], text: 'ผืนทรายยุบตัว ปากกลมที่มีฟันนับพันพุ่งขึ้นมา', loot: 'gold+35 fame+6' },
  { id: 'scorpion', name: 'แมงป่องเหล็ก', icon: 'insect', dc: 12, climates: ['desert', 'volcanic'], tags: ['beast'], weak: ['blunt', 'ice'], resist: ['blade'], attack: ['poison'], text: 'แมงป่องขนาดเกวียนกระดกหางเรืองแสง', loot: 'gold+15' },
  { id: 'mummy', name: 'มัมมี่ฟาโรห์', icon: 'undead', dc: 16, climates: ['desert'], tags: ['undead'], weak: ['fire', 'light', 'holy', 'undead_bane'], resist: ['poison'], attack: ['curse'], text: 'สุสานใต้ทรายเปิดออก ผ้าพันแผลคลายตัวอย่างช้า ๆ', loot: 'gold+70 curse:random' },
  { id: 'yeti', name: 'เยติ', icon: 'yeti', dc: 13, climates: ['frozen'], tags: ['beast', 'giant'], weak: ['fire'], resist: ['ice'], attack: ['ice'], text: 'ร่างขาวขนาดยักษ์ทุบอกตัวเองท่ามกลางหิมะ', loot: 'gold+20' },
  { id: 'siren', name: 'ไซเรน', icon: 'fey', dc: 13, climates: ['islands'], tags: ['fey'], weak: ['mind_ward', 'lightning', 'iron'], resist: ['water', 'charm'], attack: ['charm'], text: 'เสียงเพลงหวานลอยมาจากโขดหิน ขาของเราก้าวไปเองโดยไม่รู้ตัว', loot: 'gold+25' },
  { id: 'kraken', name: 'คราเคน', icon: 'sea', dc: 22, climates: ['islands'], tags: ['beast', 'giant', 'sea'], weak: ['lightning', 'fire'], resist: ['water'], attack: [], text: 'หนวดยักษ์โผล่จากทะเลรัดเรือจนไม้ลั่นเอี๊ยด', loot: 'gold+150 fame+35', minAge: 16 },
  { id: 'firedemon', name: 'อสูรเพลิง', icon: 'demon', dc: 18, climates: ['volcanic'], tags: ['demon'], weak: ['water', 'ice', 'holy', 'demon_bane'], resist: ['fire'], attack: ['fire'], text: 'รอยแยกในดินเปิดออก อสูรร่างไฟก้าวออกมาพร้อมเสียงหัวเราะ', loot: 'gold+60 fame+12' },
  { id: 'ent', name: 'เอนท์ผู้คลั่งแค้น', icon: 'plant', dc: 14, climates: ['tropical', 'temperate'], tags: ['plant'], weak: ['fire', 'blade', 'nature'], resist: ['water', 'blunt'], attack: [], text: 'ต้นไม้โบราณขยับรากโกรธเกรี้ยว มีคนมาตัดป่าของมัน', loot: 'gold+10 skill:nature_1' },
  { id: 'griffon', name: 'กริฟฟอน', icon: 'bird', dc: 14, climates: ['temperate', 'desert', 'volcanic'], tags: ['beast', 'flying'], weak: ['ranged', 'beast_friend'], resist: [], attack: [], text: 'สิงโตปีกนกอินทรีโฉบลงมาปกป้องรังของมัน', loot: 'gold+20 fame+5' },
  { id: 'hydra', name: 'ไฮดราเก้าเศียร', icon: 'snake', dc: 20, climates: ['tropical', 'islands'], tags: ['beast', 'regen', 'serpent'], weak: ['fire'], resist: ['blade', 'poison'], attack: ['poison'], text: 'หนองน้ำเดือดพล่าน หัวงูเก้าหัวชูขึ้นพร้อมกัน', loot: 'gold+90 fame+25', minAge: 16 },
  { id: 'golem', name: 'โกเลมหินโบราณ', icon: 'construct', dc: 15, climates: 'any', tags: ['construct'], weak: ['rune', 'blunt', 'lightning'], resist: ['blade', 'pierce', 'poison', 'charm'], attack: [], text: 'ซากปรักหักพังขยับ ผู้พิทักษ์หินลืมตาเรืองแสงสีฟ้า', loot: 'gold+40 skill:rune_1' },
  { id: 'krasue', name: 'ผีกระสือ', icon: 'spirit', dc: 12, climates: ['tropical'], tags: ['undead', 'spirit'], weak: ['light', 'holy', 'undead_bane'], resist: ['blade'], attack: ['curse'], text: 'แสงวูบวาบกลางทุ่งยามดึก หัวผู้หญิงลอยได้พร้อมไส้ห้อยระย้า', loot: 'gold+10' },
  { id: 'pop', name: 'ผีปอบ', icon: 'spirit', dc: 13, climates: ['tropical', 'temperate'], tags: ['spirit'], weak: ['holy', 'light'], resist: [], attack: ['curse'], text: 'ชาวบ้านล้มป่วยทีละคน คนว่ามีปอบเข้าสิงยายข้างบ้าน', loot: 'fame+5' },
  { id: 'werewolf', name: 'มนุษย์หมาป่า', icon: 'beast', dc: 15, climates: ['temperate', 'frozen'], tags: ['beast', 'cursed'], weak: ['silver', 'holy', 'fire'], resist: ['blade'], attack: [], text: 'คืนจันทร์เต็มดวง ชายแปลกหน้าในโรงเตี๊ยมเริ่มบิดตัว', loot: 'gold+20 fame+6' },
  { id: 'mimic', name: 'มิมิค', icon: 'construct', dc: 10, climates: 'any', tags: ['construct'], weak: ['appraise', 'truth', 'blunt'], resist: [], attack: [], text: 'หีบสมบัติวางอยู่กลางห้องอย่างน่าสงสัย… มันเพิ่งกะพริบตาหรือเปล่า?', loot: 'gold+50' },
  { id: 'ogre', name: 'โอเกอร์', icon: 'giant', dc: 13, climates: ['temperate', 'tropical', 'frozen'], tags: ['giant', 'humanoid'], weak: ['int_trick', 'ranged'], resist: ['blunt'], attack: [], text: 'โอเกอร์กำลังต้มซุปในหม้อใหญ่… และมันกำลังมองหาเนื้อเพิ่ม', loot: 'gold+25' },
  { id: 'harpy', name: 'ฮาร์ปี้', icon: 'bird', dc: 11, climates: ['islands', 'desert', 'volcanic'], tags: ['flying'], weak: ['ranged', 'wind'], resist: [], attack: [], text: 'ฝูงหญิงปีกนกกรีดร้องและพุ่งลงมาขโมยของ', loot: 'gold+12' },
  { id: 'manticore', name: 'แมนติคอร์', icon: 'beast', dc: 17, climates: ['desert', 'volcanic'], tags: ['beast'], weak: ['ranged', 'ice'], resist: [], attack: ['poison'], text: 'สิงโตหน้าคนที่มีหางแมงป่องยิ้มให้ "ข้าชอบกินคนฉลาด"', loot: 'gold+45 fame+10' },
  { id: 'wraith', name: 'วิญญาณอาฆาต', icon: 'spirit', dc: 14, climates: 'any', tags: ['undead', 'spirit'], weak: ['light', 'holy', 'undead_bane'], resist: ['blade', 'blunt', 'pierce'], attack: ['dark'], text: 'อุณหภูมิลดฮวบ เงาไร้ร่างกระซิบชื่อของเรา', loot: 'fame+8' },
  { id: 'bandits', name: 'กลุ่มโจรภูเขา', icon: 'bandit', dc: 11, climates: 'any', tags: ['humanoid'], weak: ['leader', 'charm', 'stealth'], resist: [], attack: ['iron'], text: 'กลุ่มโจรถือดาบขวางทาง "ทิ้งของไว้ แล้วเดินต่อไปซะ"', loot: 'gold+30' },
  { id: 'demongeneral', name: 'แม่ทัพปีศาจ', icon: 'demon', dc: 23, climates: 'any', tags: ['demon'], weak: ['holy', 'light', 'demon_bane'], resist: ['dark', 'fire'], attack: ['dark', 'fire'], text: 'กองทัพของราชาปีศาจบุกมา แม่ทัพเขาโค้งชี้ดาบมาที่เรา', loot: 'gold+200 fame+60', minAge: 20 },
  { id: 'kappa', name: 'กัปปะ', icon: 'humanoid', dc: 9, climates: ['islands', 'temperate', 'tropical'], tags: ['fey'], weak: ['humble', 'cook'], resist: ['water'], attack: [], text: 'กัปปะตัวเตี้ยท้าดวลซูโม่ริมแม่น้ำ', loot: 'gold+8' },
];

// ---------- สัญลักษณ์เข้าฝัน ----------
export interface DreamMeaning { text: string; tags: ChoiceTag[] }
export interface DreamSymbol {
  id: string;
  icon: string;
  name: string;
  base: DreamMeaning;
  race?: Record<string, DreamMeaning>;
  climate?: Record<string, DreamMeaning>;
}

export const SYMBOLS: DreamSymbol[] = [
  { id: 'snake', icon: 'snake', name: 'งู', base: { text: 'ระวังคนใกล้ตัว—จะมีผู้ทรยศ', tags: ['distrust', 'safe'] },
    race: { naga: { text: 'การลอกคราบ—ถึงเวลาเปลี่ยนแปลงและเริ่มใหม่', tags: ['travel', 'risk'] }, elf: { text: 'ปัญญาโบราณกำลังเรียกหา', tags: ['learn'] }, demonkin: { text: 'พลังต้องห้ามที่ควรคว้าไว้', tags: ['greed', 'risk'] } } },
  { id: 'fire', icon: 'fire', name: 'ไฟ', base: { text: 'ถึงเวลาต่อสู้! ความกล้าจะนำชัย', tags: ['fight', 'risk'] },
    race: { dwarf: { text: 'เตาหลอมกำลังรอ—ลงมือสร้างสิ่งใหม่', tags: ['learn', 'stay'] }, elf: { text: 'ไฟป่า—หายนะกำลังมา จงหนี', tags: ['flee', 'safe'] }, vampire: { text: 'อันตราย! จงหลบซ่อน', tags: ['flee', 'safe'] } },
    climate: { frozen: { text: 'ไออุ่น—จงช่วยเหลือผู้คนให้รอดฤดูหนาว', tags: ['help'] } } },
  { id: 'river', icon: 'river', name: 'แม่น้ำ', base: { text: 'ปล่อยให้ชีวิตไหลไป—ออกเดินทาง', tags: ['travel'] },
    race: { merfolk: { text: 'บ้านกำลังเรียก—กลับสู่รากเหง้า', tags: ['stay', 'love'] }, naga: { text: 'เทพแห่งสายน้ำอวยพร—จงศรัทธา', tags: ['pray', 'trust'] } },
    climate: { desert: { text: 'ชีวิตและความอุดมสมบูรณ์—แบ่งปันให้ผู้อื่น', tags: ['help', 'greed'] } } },
  { id: 'sword', icon: 'sword', name: 'ดาบ', base: { text: 'ปกป้องผู้อ่อนแอด้วยคมดาบ', tags: ['fight', 'help'] },
    race: { orc: { text: 'เกียรติยศได้มาจากเลือด—จงต่อสู้!', tags: ['fight', 'defy'] }, halfling: { text: 'อาวุธ? ไม่ล่ะ… หนีดีกว่า', tags: ['flee', 'safe'] } } },
  { id: 'eye', icon: 'eye', name: 'ดวงตา', base: { text: 'มีผู้เฝ้ามองอยู่—จงเรียนรู้และระวัง', tags: ['learn', 'distrust'] },
    race: { darkelf: { text: 'สายลับอยู่รอบตัว อย่าไว้ใจใคร', tags: ['distrust', 'selfish'] }, human: { text: 'เทพเฝ้ามองเรา—จงอธิษฐาน', tags: ['pray'] } } },
  { id: 'moon', icon: 'moon', name: 'ดวงจันทร์', base: { text: 'ความลับในยามค่ำคืน—ความรักซ่อนอยู่', tags: ['love', 'risk'] },
    race: { vampire: { text: 'เวลาของเราใกล้มาถึง จงทะเยอทะยาน', tags: ['greed', 'fight'] }, beast: { text: 'สัญชาตญาณ—จงไล่ล่า', tags: ['fight', 'travel'] } } },
  { id: 'flower', icon: 'flower', name: 'ดอกไม้', base: { text: 'ความรักและการเริ่มต้นใหม่', tags: ['love', 'help'] },
    race: { fae: { text: 'ปาร์ตี้! ไปเล่นสนุกกัน', tags: ['risk', 'love'] }, orc: { text: 'ความอ่อนแอ… น่ารังเกียจ', tags: ['defy', 'fight'] } } },
  { id: 'crow', icon: 'crow', name: 'อีกา', base: { text: 'ความตายใกล้เข้ามา—จงระวังตัว', tags: ['safe', 'flee'] },
    race: { dwarf: { text: 'บรรพบุรุษส่งข่าว—เคารพประเพณี', tags: ['stay', 'pray'] }, darkelf: { text: 'ข่าวสารจากเงามืด—มีโอกาสซ่อนอยู่', tags: ['greed', 'risk'] } } },
  { id: 'crown', icon: 'crown', name: 'มงกุฎ', base: { text: 'โชคชะตาแห่งอำนาจ—จงทะเยอทะยาน', tags: ['greed', 'risk'] },
    race: { elf: { text: 'ความหยิ่งจะนำความพินาศ', tags: ['safe', 'help'] }, halfling: { text: 'ความรับผิดชอบ… น่ากลัวจัง', tags: ['stay', 'safe'] } } },
  { id: 'door', icon: 'door', name: 'ประตู', base: { text: 'โอกาสใหม่—ก้าวเข้าไปเถิด', tags: ['risk', 'travel', 'learn'] },
    race: { dwarf: { text: 'ปิดประตูให้แน่น ปกป้องบ้าน', tags: ['stay', 'safe'] } } },
  { id: 'heart', icon: 'heart', name: 'หัวใจ', base: { text: 'จงรักและไว้ใจผู้อื่น', tags: ['love', 'trust', 'help'] },
    race: { vampire: { text: 'เลือดสด… ช่างน่าหิว', tags: ['selfish', 'greed'] }, orc: { text: 'กินหัวใจศัตรูเพื่อพลัง', tags: ['fight'] } } },
  { id: 'mountain', icon: 'mountain', name: 'ภูเขา', base: { text: 'อดทนและยืนหยัด อย่าถอย', tags: ['stay', 'defy'] },
    race: { dwarf: { text: 'บ้าน… และสมบัติใต้ภูผา', tags: ['greed', 'stay'] }, merfolk: { text: 'โลกแห้งแล้งที่ไม่ควรไป', tags: ['flee', 'stay'] } } },
];

// ---------- เส้นชะตา (Fate) ----------
export interface Fate {
  id: string;
  name: string;
  good: boolean;
  age: [number, number];
  omen: string;
  storylet: string; // id of storylet in STORYLETS (fate_*)
}

export const FATES: Fate[] = [
  { id: 'mentor', name: 'พบผู้เป็นอาจารย์', good: true, age: [10, 22], omen: 'นกอินทรีเฒ่าบินวนเหนือบ้านเจ็ดวันติด…', storylet: 'fate_mentor' },
  { id: 'betrayal', name: 'ถูกเพื่อนรักหักหลัง', good: false, age: [22, 45], omen: 'ถ้วยไวน์ในบ้านแตกเองกลางดึก มีงูเลื้อยผ่านธรณีประตู…', storylet: 'fate_betrayal' },
  { id: 'truelove', name: 'พบรักแท้', good: true, age: [16, 35], omen: 'ดอกไม้บานนอกฤดูตรงหน้าต่าง…', storylet: 'fate_love' },
  { id: 'war', name: 'ถูกเกณฑ์เข้าสงคราม', good: false, age: [17, 40], omen: 'ท้องฟ้าทางชายแดนเป็นสีแดงฉานทุกยามเย็น…', storylet: 'fate_war' },
  { id: 'plague', name: 'โรคระบาดมาเยือน', good: false, age: [5, 70], omen: 'หนูตายเกลื่อนตรอก หมอกเหลืองลอยต่ำ…', storylet: 'fate_plague' },
  { id: 'dragon', name: 'เผชิญหน้ามังกร', good: false, age: [18, 50], omen: 'แผ่นดินสั่นเบา ๆ ฝูงแกะหายไปทีละตัว…', storylet: 'fate_dragon' },
  { id: 'treasure', name: 'ค้นพบสมบัติโบราณ', good: true, age: [12, 60], omen: 'ฝันเห็นแสงทองใต้รากไม้เก่าซ้ำ ๆ…', storylet: 'fate_treasure' },
  { id: 'throne', name: 'โอกาสชิงบัลลังก์', good: true, age: [25, 55], omen: 'ดาวหางสีทองปรากฏเหนือราชวัง…', storylet: 'fate_throne' },
  { id: 'demon', name: 'ปีศาจมาล่อลวง', good: false, age: [15, 50], omen: 'เงาของตัวเองยิ้มทั้งที่เราไม่ได้ยิ้ม…', storylet: 'fate_demon' },
  { id: 'trial', name: 'บททดสอบจากสวรรค์', good: true, age: [14, 60], omen: 'ระฆังวัดดังเองโดยไม่มีใครตี…', storylet: 'fate_trial' },
  { id: 'nemesis', name: 'ดวลกับคู่อาฆาต', good: false, age: [20, 60], omen: 'ได้ยินชื่อของตัวเองถูกสาปแช่งในโรงเตี๊ยม…', storylet: 'fate_nemesis' },
  { id: 'shipwreck', name: 'เรืออับปาง', good: false, age: [15, 55], omen: 'ฝันว่าจมน้ำ ตื่นมาเตียงเปียกโชก…', storylet: 'fate_shipwreck' },
  { id: 'exile', name: 'ถูกเนรเทศ', good: false, age: [18, 50], omen: 'เพื่อนบ้านเริ่มกระซิบเมื่อเราเดินผ่าน…', storylet: 'fate_exile' },
  { id: 'summoned', name: 'ถูกอัญเชิญเป็นผู้กล้า', good: true, age: [14, 25], omen: 'วงเวทเรืองแสงปรากฏใต้เท้าเพียงชั่วพริบตา…', storylet: 'fate_summoned' },
  { id: 'pastlife', name: 'ความทรงจำจากชาติก่อน', good: true, age: [3, 12], omen: 'เด็กน้อยพูดคำแปลก ๆ ในภาษาที่ไม่มีใครรู้จัก…', storylet: 'fate_pastlife' },
  { id: 'beast', name: 'อสูรร้ายถล่มบ้านเกิด', good: false, age: [8, 60], omen: 'สัตว์ทุกตัวในหมู่บ้านอพยพหนีไปทางเดียวกัน…', storylet: 'fate_beast' },
  { id: 'heir', name: 'กำเนิดทายาทพิเศษ', good: true, age: [22, 45], omen: 'ดวงดาวดวงใหม่ปรากฏบนฟ้า…', storylet: 'fate_heir' },
  { id: 'dungeon', name: 'ดันเจี้ยนเปิดใหม่', good: true, age: [16, 45], omen: 'มีรอยแยกเรืองแสงปรากฏในป่าใกล้บ้าน…', storylet: 'fate_dungeon' },
  { id: 'revolution', name: 'การปฏิวัติ', good: false, age: [18, 60], omen: 'ใบปลิวลึกลับถูกตอกไว้ทุกประตูในเมือง…', storylet: 'fate_revolution' },
  { id: 'demonking', name: 'ราชาปีศาจคืนชีพ', good: false, age: [25, 65], omen: 'สุริยุปราคาเกิดขึ้นสามวันติด…', storylet: 'fate_demonking' },
  { id: 'apprentice', name: 'ได้ลูกศิษย์', good: true, age: [40, 70], omen: 'เด็กกำพร้าจ้องมองเราจากมุมถนนทุกวัน…', storylet: 'fate_apprentice' },
];
export const fateById = (id: string) => FATES.find((f) => f.id === id)!;

// ---------- คลังคำสำหรับเติม template ----------
export const WORDS = {
  item: ['แหวนเงินสลักอักษรโบราณ', 'ดาบขึ้นสนิมที่ยังคม', 'สมุดบันทึกของจอมเวท', 'ไข่สีทองอุ่น ๆ', 'แผนที่ขาดครึ่งแผ่น', 'ขลุ่ยกระดูก', 'มงกุฎทองแดงบุบ ๆ', 'หินที่กระซิบได้', 'ขวดยาสีม่วง', 'กระจกที่สะท้อนอดีต', 'เข็มทิศที่ชี้หาสิ่งที่ปรารถนา', 'เกล็ดมังกรสีแดง'],
  food: ['สตูว์เนื้อกระต่าย', 'ขนมปังน้ำผึ้ง', 'ซุปเห็ดพิษ (นิดหน่อย)', 'ปลาย่างเกลือ', 'พายเนื้อสไลม์', 'ข้าวต้มปลาไหล', 'เนื้อไวเวิร์นตากแห้ง', 'เบียร์คนแคระ', 'ผลไม้ภูต', 'แกงเผ็ดมังกร'],
  animal: ['แมวดำตาเดียว', 'ลูกหมาป่าบาดเจ็บ', 'นกฮูกพูดได้', 'ลูกมังกรหลงทาง', 'สไลม์จิ๋ว', 'ม้าขาวผอมโซ', 'กาสามขา', 'จิ้งจอกเก้าหาง (หางเดียวก่อน)'],
  place: ['ซากวิหารร้าง', 'หอคอยจอมเวท', 'ถ้ำหลังน้ำตก', 'สุสานเก่า', 'ตลาดกลางคืน', 'โรงเตี๊ยมม้าเมา', 'ทะเลสาบหมอก', 'ป่าต้องห้าม', 'กิลด์นักผจญภัย', 'ห้องสมุดใต้ดิน'],
  title: ['ผู้ไร้พ่ายแห่ง', 'จอมโจรแห่ง', 'วีรชนแห่ง', 'ปีศาจแห่ง', 'ผู้พิทักษ์แห่ง', 'คนบ้าแห่ง'],
};
