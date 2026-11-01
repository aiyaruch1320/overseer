import type { Storylet } from '../sim/types';

// Follow-up events: an outcome writes `chain:<id>`; years later (delay, in human-equivalent years) the event may
// return with the same NPC. Its chance = p × story affinity (place, birth, threads, the god's gifts), capped at 95%.
export interface ChainDef { delay: [number, number]; p: number; aff?: Record<string, number>; hint: string }

export const CHAINS: Record<string, ChainDef> = {
  // careers
  chain_light_sword: { delay: [0.5, 3], p: 0.12, aff: { 'religion:light': 2, 'birth:day': 1, 'birthsign:comet': 1, 'thread:holy': 2.5, 'tag:light': 1.5, 'belief:devoted': 1, 'thread:hero': 1 }, hint: 'อาจได้รับดาบแห่งแสง' },
  chain_arcane_tome: { delay: [1, 4], p: 0.2, aff: { 'thread:arcane': 2, 'birthsign:comet': 1.5, 'religion:moon': 1, 'trait:bookworm': 1.5 }, hint: 'อาจค้นพบตำราเวทโบราณ' },
  chain_holy_vision: { delay: [2, 6], p: 0.2, aff: { 'religion:light': 2, 'thread:faithful': 2, 'belief:devoted': 2 }, hint: 'อาจเห็นนิมิตศักดิ์สิทธิ์ (เส้นทางนักบุญ)' },
  chain_guild_invite: { delay: [1, 4], p: 0.3, aff: { 'thread:outlaw': 2, 'race:darkelf': 1, minority: 1 }, hint: 'อาจถูกชวนเข้าสมาคมเงา' },
  chain_caravan_fortune: { delay: [2, 5], p: 0.25, aff: { 'thread:greed': 2, 'climate:desert': 1.5 }, hint: 'อาจได้โอกาสค้าขายครั้งใหญ่' },
  chain_master_forge: { delay: [3, 8], p: 0.22, aff: { 'race:dwarf': 2, 'climate:volcanic': 1.5, 'thread:warrior': 1, 'religion:dragon': 1 }, hint: 'อาจตีอาวุธในตำนานได้' },
  chain_royal_song: { delay: [2, 6], p: 0.22, aff: { 'thread:romance': 1.5, 'flag:noble': 1 }, hint: 'อาจได้ร้องเพลงในราชสำนัก' },
  chain_sea_treasure: { delay: [2, 6], p: 0.22, aff: { 'climate:islands': 2, 'religion:sea': 2, 'thread:wanderer': 1 }, hint: 'อาจพบซากเรือสมบัติ' },
  chain_plague_cure: { delay: [2, 6], p: 0.2, aff: { 'countryflag:plague': 3, 'thread:hero': 1.5 }, hint: 'อาจค้นพบยารักษาโรคระบาด' },
  chain_beast_companion: { delay: [1, 4], p: 0.3, aff: { 'thread:wild': 2, 'religion:nature': 1.5 }, hint: 'อาจได้สัตว์อสูรคู่หู' },
  chain_harvest_spirit: { delay: [2, 6], p: 0.2, aff: { 'religion:nature': 1.5, 'countryflag:famine': 1.5, 'religion:ancestor': 1 }, hint: 'อาจพบภูตแห่งผืนนา' },
  chain_royal_banquet: { delay: [2, 6], p: 0.2, aff: { 'race:halfling': 1.5, 'thread:greed': 0.5 }, hint: 'อาจได้ทำอาหารถวายกษัตริย์' },
  chain_dark_patron: { delay: [1, 4], p: 0.35, aff: { 'religion:demon': 2, 'thread:dark': 2 }, hint: 'ผู้อุปถัมภ์ในความมืดอาจมาทวงสัญญา' },
  chain_court_intrigue: { delay: [2, 6], p: 0.3, aff: { 'flag:noble': 2 }, hint: 'อาจเข้าไปพัวพันแผนการในราชสำนัก' },
  chain_enlightenment: { delay: [3, 8], p: 0.2, aff: { 'thread:faithful': 2, 'religion:moon': 1 }, hint: 'อาจบรรลุการรู้แจ้ง' },
  // choices
  chain_merchant_return: { delay: [3, 8], p: 0.55, aff: { 'thread:hero': 1 }, hint: '{npc} อาจกลับมาตอบแทน' },
  chain_theft_revenge: { delay: [2, 6], p: 0.5, aff: { 'thread:dark': 1 }, hint: 'ครอบครัวของ {npc} อาจตามมาแก้แค้น' },
  chain_pet_grows: { delay: [4, 10], p: 0.6, aff: { 'thread:wild': 2 }, hint: 'สัตว์ตัวนี้อาจกลับมาช่วยในยามคับขัน' },
  chain_bully_returns: { delay: [8, 15], p: 0.5, hint: '{npc} อาจกลับมาอีกครั้งตอนโต' },
  chain_freed_slave: { delay: [4, 10], p: 0.6, aff: { 'thread:hero': 1.5 }, hint: 'เด็กที่ได้รับอิสรภาพอาจกลับมาตอบแทน' },
  chain_cult_summons: { delay: [1, 4], p: 0.7, aff: { 'thread:dark': 1 }, hint: 'ลัทธิอาจเรียกตัวไปทำพิธีสังเวย' },
  chain_assassin_guild: { delay: [1, 4], p: 0.7, hint: 'สมาคมนักฆ่าอาจส่งคนมาจัดการ' },
  chain_war_comrade: { delay: [5, 12], p: 0.4, hint: 'สหายร่วมรบอาจกลับมาหา' },
  chain_first_love_test: { delay: [3, 7], p: 0.4, aff: { 'thread:romance': 1.5 }, hint: 'ความรักครั้งนี้อาจถูกทดสอบ' },
  chain_god_disguised: { delay: [5, 15], p: 0.3, aff: { 'thread:faithful': 2, 'belief:devoted': 1 }, hint: 'ขอทานคนนั้นอาจไม่ใช่คนธรรมดา' },
  chain_guild_betrayal: { delay: [3, 8], p: 0.45, aff: { 'thread:outlaw': 1 }, hint: 'สมาคมเงาอาจหักหลัง' },
};

const NOT_YOUNG = { stage: ['teen', 'adult', 'elder'] as ('teen' | 'adult' | 'elder')[] };
const ADULT = { stage: ['adult', 'elder'] as ('adult' | 'elder')[] };

export const CHAIN_STORYLETS: Storylet[] = [
  { id: 'chain_light_sword', tone: 'warm', w: 0, important: true, c: NOT_YOUNG, t: 'ระหว่างฝึกอาวุธยามเที่ยงวัน แสงสีขาวพุ่งลงจากฟ้ากลางลานฝึก เมื่อแสงจางลง อาวุธที่ส่องประกายปักอยู่ตรงหน้า {name} ราวกับรอเจ้าของมานาน', ch: [
    { l: 'คว้าอาวุธทันที', tags: ['fight', 'risk'], ax: { brave: 1, ambition: 1 }, ok: ['อาวุธตอบรับ แสงไหลเข้าสู่แขน ชาวเมืองที่เห็นต่างคุกเข่า', 'weapon:holy:light:R thread:+holy:3 fame+6'] },
    { l: 'คุกเข่าอธิษฐานก่อนแตะต้อง', tags: ['pray', 'safe'], ax: { piety: 1 }, ok: ['แสงอ่อนโยนลง อาวุธลอยมาอยู่ในมือเอง', 'weapon:holy:light:E belief+10 thread:+holy:3'] },
    { l: 'ปฏิเสธ ไม่ใช่ของข้า', tags: ['stay', 'defy'], ax: { ambition: -1 }, ok: ['แสงค่อย ๆ จางหายไปพร้อมอาวุธ', 'belief-5'] },
  ] },
  { id: 'chain_arcane_tome', tone: 'grim', w: 0, important: true, c: NOT_YOUNG, t: 'ในซอกหอสมุดเก่า {name} พบตำราเวทที่ปกขยับได้เองเหมือนหายใจ', ch: [
    { l: 'เปิดอ่านคืนนี้', tags: ['learn', 'risk'], ax: { curious: 1 }, chk: ['int', 13], bonusTag: ['magic', 'scholar', 'sage'], ok: ['อักษรไหลเข้าสู่ความคิด ความถนัดใหม่ตื่นขึ้น', 'apt:magic skill:random thread:+arcane:3'], ng: ['ตำรากัดนิ้วและกลืนความทรงจำไปบางส่วน', 'hp-15 int-1'] },
    { l: 'ส่งให้หอคอยจอมเวท', tags: ['safe', 'help'], ok: ['หอคอยตอบแทนด้วยทองและคำเชิญ', 'gold+40 fame+4'] },
  ] },
  { id: 'chain_holy_vision', tone: 'warm', w: 0, important: true, c: NOT_YOUNG, t: 'ระหว่างสวดยามรุ่ง {name} เห็นนิมิตแสงสีทองกระซิบว่า "{god}มองเห็นเจ้าแล้ว"', ch: [
    { l: 'ยอมรับนิมิตด้วยใจศรัทธา', tags: ['pray', 'trust'], ax: { piety: 1 }, ok: ['ร่างกายเบาสบายราวได้รับพรจากสวรรค์', 'bless:tag=holy belief+15 thread:+holy:3'] },
    { l: 'สงสัยว่าเป็นภาพหลอน', tags: ['distrust'], ax: { piety: -1 }, ok: ['นิมิตเลือนหายไป', 'belief-5'] },
  ] },
  { id: 'chain_guild_invite', tone: 'grim', w: 0, important: true, c: NOT_YOUNG, t: 'จดหมายผนึกขี้ผึ้งดำถูกสอดใต้ประตู "สมาคมเงาเห็นฝีมือเจ้า คืนพรุ่งนี้ที่ใต้สะพาน{town}"', ch: [
    { l: 'ไปตามนัด', tags: ['risk', 'greed'], ax: { honest: -1 }, ok: ['ได้เป็นสมาชิกสมาคมเงา สอนวิชาลอบเร้นให้', 'skill:stealth_2 gold+30 +flag:shadow_guild thread:+outlaw:2 chain:chain_guild_betrayal'] },
    { l: 'เผาจดหมายทิ้ง', tags: ['safe', 'defy'], ax: { honest: 1 }, ok: ['ไม่มีใครมาตามอีก… คงเป็นอย่างนั้น', ''] },
  ] },
  { id: 'chain_guild_betrayal', tone: 'dark', w: 0, important: true, c: { ...NOT_YOUNG, flag: ['shadow_guild'] }, t: 'หัวหน้าสมาคมเงาโยนความผิดคดีปล้นคลังหลวงมาให้ {name} ทหารกำลังมา', ch: [
    { l: 'หนีออกนอกประเทศ', tags: ['flee', 'travel'], chk: ['spd', 13], bonusTag: ['stealth'], ok: ['หนีรอดข้ามพรมแดน', 'move:far -flag:shadow_guild'], ng: ['ถูกจับขังเกือบปี', 'hp-30 gold-50 -flag:shadow_guild'] },
    { l: 'ล้างแค้นหัวหน้าสมาคม', tags: ['fight', 'defy'], ax: { temper: 1 }, chk: ['spd', 15], bonusTag: ['stealth', 'blade'], ok: ['สมาคมเงาตกเป็นของ {name}', 'fame+10 gold+80 kill'], ng: ['พ่ายแพ้ ได้แผลเป็นยาวพาดหน้า', 'hp-40 rel:+nemesis'] },
  ] },
  { id: 'chain_caravan_fortune', tone: 'warm', w: 0, important: true, c: NOT_YOUNG, t: 'กองคาราวานเครื่องเทศจากแดนไกลขาดผู้นำทาง พวกเขาเสนอส่วนแบ่งหนึ่งในสามให้ {name}', ch: [
    { l: 'นำคาราวานข้ามทะเลทราย', tags: ['greed', 'travel', 'risk'], chk: ['int', 13], bonusTag: ['trade', 'navigator', 'heat_res'], ok: ['ถึงปลายทางพร้อมกำไรมหาศาล', 'gold+120 fame+5 thread:+greed:2'], ng: ['พายุทรายกลืนกองคาราวานไปครึ่งหนึ่ง', 'gold-40 hp-20'] },
    { l: 'ขายข้อมูลเส้นทางแทน', tags: ['safe', 'greed'], ok: ['ได้เงินก้อนเล็กแต่ปลอดภัย', 'gold+30'] },
  ] },
  { id: 'chain_master_forge', tone: 'warm', w: 0, important: true, c: ADULT, t: 'แร่สีแดงเรืองแสงตกลงมาจากปล่องภูเขาไฟพร้อมเสียงคำรามของมังกร {name} รู้ทันทีว่ามันคือวัตถุดิบในตำนาน', ch: [
    { l: 'ตีอาวุธทั้งคืนไม่หลับ', tags: ['learn', 'risk'], ax: { ambition: 1 }, chk: ['pow', 13], bonusTag: ['smith', 'rune', 'fire_res'], ok: ['อาวุธเพลิงมังกรถือกำเนิด!', 'weapon:holy:fire:R fame+10'], ng: ['แร่แตกร้าว เหลือเพียงเศษ', 'gold+20 hp-10'] },
    { l: 'ขายแร่ให้ขุนนาง', tags: ['greed', 'safe'], ok: ['ร่ำรวยในชั่วข้ามคืน', 'gold+90'] },
  ] },
  { id: 'chain_royal_song', tone: 'warm', w: 0, important: true, c: NOT_YOUNG, t: 'ราชสำนักส่งคนมาเชิญ {name} ไปร้องเพลงในงานเลี้ยงวันประสูติ', ch: [
    { l: 'ร้องเพลงรักสุดซึ้ง', tags: ['love', 'risk'], chk: ['luk', 12], bonusTag: ['charm', 'music'], ok: ['เจ้าหญิง/เจ้าชายแอบส่งดอกไม้มาให้หลังงาน', 'fame+15 rel:+lover thread:+romance:2'], ng: ['เสียงแตกกลางท่อนฮุก', 'fame-4'] },
    { l: 'ร้องเพลงเสียดสีขุนนางชั่ว', tags: ['defy', 'risk'], ax: { brave: 1 }, chk: ['luk', 13], ok: ['ราชาหัวเราะลั่นและปลดขุนนางคนนั้น', 'fame+20 karma+3'], ng: ['ถูกโยนออกจากวัง', 'hp-10 fame+5'] },
  ] },
  { id: 'chain_sea_treasure', tone: 'grim', w: 0, important: true, c: NOT_YOUNG, t: 'ระหว่างออกทะเล {name} เห็นเงาซากเรือใหญ่ใต้น้ำใส มีประกายทองระยิบ', ch: [
    { l: 'ดำลงไปเอง', tags: ['greed', 'risk'], chk: ['vit', 13], bonusTag: ['water_breath', 'sea'], ok: ['ได้หีบทองโบราณขึ้นมา!', 'gold+110 fame+4'], ng: ['หนวดอะไรบางอย่างพันขาไว้ หลุดมาได้หวุดหวิด', 'hp-30'] },
    { l: 'จดตำแหน่งไว้แล้วกลับมาพร้อมพวก', tags: ['safe', 'trust'], ok: ['แบ่งสมบัติกับลูกเรือ', 'gold+50 rel:+friend'] },
  ] },
  { id: 'chain_plague_cure', tone: 'warm', w: 0, important: true, c: NOT_YOUNG, t: 'หลังทดลองสมุนไพรมาหลายปี {name} ผสมยาที่ทำให้ผู้ป่วยโรคระบาดลืมตาได้เป็นครั้งแรก', ch: [
    { l: 'แจกจ่ายสูตรยาฟรี', tags: ['help'], ax: { kind: 1 }, ok: ['ผู้คนนับพันรอดชีวิต ชื่อ {name} ถูกจารึกในวิหาร', 'fame+20 karma+8 skill:healing_2 thread:+hero:2'] },
    { l: 'ขายสูตรยาราคาแพง', tags: ['greed'], ax: { kind: -1 }, ok: ['ร่ำรวยมหาศาล แต่คนจนยังล้มตาย', 'gold+150 karma-6'] },
  ] },
  { id: 'chain_beast_companion', tone: 'warm', w: 0, important: true, c: NOT_YOUNG, t: 'ลูกสัตว์อสูร[กริฟฟอน|หมาป่าเงิน|เสือดาวหิมะ|ไวเวิร์นน้อย]บาดเจ็บนอนอยู่ในพุ่มไม้ จ้องมาที่ {name} ไม่วางตา', ch: [
    { l: 'รักษาและเลี้ยงดู', tags: ['help', 'love'], ax: { kind: 1 }, ok: ['มันยอมรับ {name} เป็นครอบครัว', '+flag:beast_companion +flag:pet skill:taming_2 thread:+wild:3'] },
    { l: 'ขายให้พ่อค้าสัตว์', tags: ['greed'], ax: { kind: -1 }, ok: ['ได้เงินก้อนโต แต่เสียงร้องของมันยังติดหู', 'gold+60 kind-5'] },
  ] },
  { id: 'chain_harvest_spirit', tone: 'warm', w: 0, important: true, c: NOT_YOUNG, t: 'คืนหนึ่งในทุ่งนา ภูตตัวจิ๋วสวมหมวกฟางนั่งบนรวงข้าว "ถวาย{food}ให้ข้าสิ แล้วปีนี้จะไม่มีวันอดอยาก"', ch: [
    { l: 'ถวายอาหารที่ดีที่สุด', tags: ['pray', 'help'], ok: ['ภูตยิ้มและหายวับ ปีนั้นข้าวเต็มยุ้ง', 'bless:b_harvest gold+30 country:+golden'] },
    { l: 'จับภูตใส่ขวด', tags: ['greed', 'risk'], chk: ['spd', 13], ok: ['ภูตติดขวด! แต่ทุ่งนาเหี่ยวเฉาทั้งหมู่บ้าน', 'gold+40 karma-5 country:+famine'], ng: ['ภูตหัวเราะคิกแล้วสาปส่ง', 'curse:random'] },
  ] },
  { id: 'chain_royal_banquet', tone: 'comedy', w: 0, important: true, c: NOT_YOUNG, t: 'พ่อครัวหลวงป่วย {name} ถูกเรียกไปทำอาหารงานเลี้ยงกษัตริย์ แต่ได้ยินคนแอบวางแผนใส่ยาพิษในซุป', ch: [
    { l: 'เปลี่ยนซุปแล้วแจ้งองครักษ์', tags: ['help', 'risk'], chk: ['int', 13], ok: ['จับคนร้ายได้คาหนังคาเขา ได้รับบรรดาศักดิ์', '+flag:noble fame+15 gold+50'], ng: ['ถูกกล่าวหาเป็นผู้วางยาเสียเอง', 'hp-20 +flag:wanted'] },
    { l: 'ทำอาหารตามปกติ ไม่ยุ่ง', tags: ['safe', 'selfish'], ok: ['ขุนนางคนหนึ่งล้มตายกลางงาน ทุกคนยกย่องรสมือของ {name}… ยกเว้นผู้ตาย', 'gold+30 karma-3'] },
  ] },
  { id: 'chain_dark_patron', tone: 'dark', w: 0, important: true, c: NOT_YOUNG, t: 'เงาสูงสามเมตรปรากฏกลางห้อง "ถึงเวลาจ่ายค่าพลังที่เจ้ายืมไปแล้ว {name}"', ch: [
    { l: 'ยอมจ่ายด้วยวิญญาณบางส่วน', tags: ['greed', 'risk'], ok: ['พลังมืดเพิ่มพูน แต่หัวใจเย็นชาลง', 'mag+2 curse:random thread:+dark:3 kind-10'] },
    { l: 'ขับไล่มันด้วยศรัทธา', tags: ['pray', 'defy'], chk: ['mag', 14], bonusTag: ['holy', 'light', 'mind_ward'], ok: ['เงาหวีดร้องและสลายไป', 'belief+15 thread:+holy:2'], ng: ['เงาฉีกเนื้อไปก่อนหายไป', 'hp-35'] },
  ] },
  { id: 'chain_court_intrigue', tone: 'grim', w: 0, important: true, c: ADULT, t: 'ดยุคแห่ง{place}ชวน {name} ร่วมแผนโค่นอัครมหาเสนาบดี "เจ้าจะได้ครึ่งหนึ่งของทรัพย์สินเขา"', ch: [
    { l: 'ร่วมแผน', tags: ['greed', 'risk'], chk: ['int', 14], bonusTag: ['leader', 'charm'], ok: ['แผนสำเร็จ อำนาจเพิ่มพูน', 'gold+100 fame+8 karma-4'], ng: ['แผนแตก ถูกริบทรัพย์', 'gold-80 +flag:wanted'] },
    { l: 'แจ้งเตือนอัครมหาเสนาบดี', tags: ['help', 'trust'], ok: ['ดยุคถูกจับ {name} ได้รับความไว้วางใจ', 'fame+10 rel:+nemesis'] },
  ] },
  { id: 'chain_enlightenment', tone: 'warm', w: 0, important: true, c: ADULT, t: 'หลังนั่งสมาธิใต้ต้นไม้เก่าสามวันสามคืน โลกรอบตัว {name} เงียบลงจนได้ยินเสียงหัวใจของผืนดิน', ch: [
    { l: 'ปล่อยใจไปกับความว่าง', tags: ['pray', 'learn'], chk: ['int', 13], ok: ['ตื่นรู้! สติปัญญาและร่างกายเปลี่ยนไป', 'int+2 vit+1 skill:unique'], ng: ['เกือบถึงแล้ว… แต่หิวข้าว', 'int+1'] },
    { l: 'กลับไปช่วยผู้คน', tags: ['help'], ok: ['นำความสงบไปสอนชาวบ้าน', 'karma+4 fame+5'] },
  ] },
  // choices that come back
  { id: 'chain_merchant_return', tone: 'warm', w: 0, important: true, c: NOT_YOUNG, t: 'รถม้าหรูจอดหน้าบ้าน {npc} พ่อค้าที่ {name} เคยช่วยไว้ข้างทางก้าวลงมา "ข้าไม่เคยลืมบุญคุณ"', ch: [
    { l: 'รับของตอบแทน', tags: ['greed', 'trust'], ok: ['หีบทองและของล้ำค่าจากต่างแดน', 'gold+80 bless:random'] },
    { l: 'ขอให้ช่วยเหลือหมู่บ้านแทน', tags: ['help'], ax: { kind: 1 }, ok: ['หมู่บ้านได้บ่อน้ำใหม่ ชาวบ้านยกย่อง {name}', 'fame+10 karma+6 rel:+friend'] },
  ] },
  { id: 'chain_theft_revenge', tone: 'dark', w: 0, important: true, c: NOT_YOUNG, t: 'ชายหนุ่มถือดาบยืนขวางทาง "เจ้าคือคนที่ขโมยเงินพ่อข้า {npc} ตอนเขานอนบาดเจ็บข้างทาง!"', ch: [
    { l: 'สู้', tags: ['fight'], chk: ['pow', 13], ok: ['ชนะ แต่ความผิดยังติดค้างในใจ', 'kill karma-3'], ng: ['ถูกฟันจนล้มลง', 'hp-35 rel:+nemesis'] },
    { l: 'ขอโทษและชดใช้', tags: ['help', 'trust'], ax: { honest: 1 }, ok: ['ชายหนุ่มรับเงินแล้วจากไปพร้อมน้ำตา', 'gold-60 karma+5'] },
  ] },
  { id: 'chain_pet_grows', tone: 'warm', w: 0, important: true, c: NOT_YOUNG, t: 'ในวันที่ {name} ถูกหมาป่าล้อม เสียงคำรามคุ้นหูดังมาจากเนินเขา สัตว์ตัวที่เคยแบ่งอาหารให้ตอนเด็ก บัดนี้ตัวใหญ่เท่าม้า!', e: 'hp+30 fame+3 +flag:beast_companion thread:+wild:2' },
  { id: 'chain_bully_returns', tone: 'grim', w: 0, important: true, c: ADULT, t: '{npc} เด็กโตที่เคยรังแก {name} บัดนี้เป็นหัวหน้าทหารรักษาเมือง และจำได้ดี', ch: [
    { l: 'ทักทายเหมือนเพื่อนเก่า', tags: ['trust', 'help'], chk: ['luk', 12], bonusTag: ['charm', 'peace'], ok: ['เขาหัวเราะ "เจ้าคือคนเดียวที่ต่อยข้าได้" กลายเป็นพันธมิตร', 'rel:+friend fame+3'], ng: ['เขายังผูกใจเจ็บ', 'rel:+rival'] },
    { l: 'หลบหน้า', tags: ['safe', 'flee'], ok: ['ใช้ชีวิตในเมืองอย่างระมัดระวังขึ้น', ''] },
  ] },
  { id: 'chain_freed_slave', tone: 'warm', w: 0, important: true, c: NOT_YOUNG, t: 'อัศวินหนุ่มผู้มีรอยตีตราทาสที่ข้อมือคุกเข่าตรงหน้า "ข้าคือเด็กที่ท่านซื้ออิสรภาพให้ ชีวิตนี้ขอรับใช้ท่าน"', e: 'rel:+friend fame+8 karma+3 thread:+hero:2' },
  { id: 'chain_cult_summons', tone: 'dark', w: 0, important: true, c: NOT_YOUNG, t: 'ลัทธิที่ {name} เข้าร่วมเรียกตัวไปพิธีเดือนมืด แท่นบูชามีเด็กถูกมัดอยู่', ch: [
    { l: 'ทำพิธีให้เสร็จ', tags: ['greed', 'selfish'], ax: { kind: -2 }, ok: ['พลังมหาศาลไหลเข้าร่าง และความเป็นมนุษย์ลดลง', 'mag+3 karma-15 thread:+dark:4 curse:random'] },
    { l: 'ช่วยเด็กแล้วหนี', tags: ['help', 'flee', 'defy'], ax: { kind: 1, brave: 1 }, chk: ['spd', 14], ok: ['พาเด็กหนีรอด ลัทธิประกาศล่าตัว', 'karma+10 +flag:hunted thread:+hero:2'], ng: ['ถูกจับได้ระหว่างหนี', 'hp-40 +flag:hunted'] },
  ] },
  { id: 'chain_assassin_guild', tone: 'dark', w: 0, important: true, c: NOT_YOUNG, t: 'กลางดึก หน้าต่างเปิดออกเงียบ ๆ นักฆ่าสามคนจากสมาคมที่ {name} เคยปฏิเสธงาน', ch: [
    { l: 'สู้ในความมืด', tags: ['fight'], chk: ['spd', 14], bonusTag: ['darkvision', 'stealth', 'blade'], ok: ['จัดการได้ทั้งสามคน สมาคมเริ่มเกรงกลัว', 'kill fame+6 -flag:hunted'], ng: ['รอดมาได้ด้วยแผลสามแห่ง', 'hp-45'] },
    { l: 'กระโดดหน้าต่างหนี', tags: ['flee'], chk: ['spd', 12], ok: ['หนีรอด ต้องย้ายเมือง', 'move'], ng: ['ขาหักตอนกระโดด', 'hp-30 spd-1'] },
  ] },
  { id: 'chain_war_comrade', tone: 'warm', w: 0, important: true, c: ADULT, t: '{npc} สหายที่เคยแบ่งขนมปังแข็งกันในสนามรบมาเคาะประตู พร้อมขวดเหล้าและเรื่องเล่าเก่า ๆ', ch: [
    { l: 'ดื่มรำลึกถึงคนที่จากไป', tags: ['love', 'stay'], ok: ['ร้องไห้และหัวเราะจนเช้า', 'rel:+friend kind+5'] },
    { l: 'ออกผจญภัยด้วยกันอีกครั้ง', tags: ['travel', 'fight', 'risk'], chk: ['pow', 13], ok: ['ภารกิจสุดท้ายของทหารผ่านศึกสำเร็จ', 'gold+60 fame+8 kill'], ng: ['สหายบาดเจ็บสาหัสแทนเรา', 'kind+10'] },
  ] },
  { id: 'chain_first_love_test', tone: 'grim', w: 0, important: true, c: { stage: ['teen', 'adult'], rel: 'lover' }, t: 'ครอบครัวของ {lover} ไม่ยอมรับ {name} "เราจะไม่ให้ลูกแต่งกับ{race}!"', ch: [
    { l: 'พาหนีไปด้วยกัน', tags: ['love', 'travel', 'defy'], ok: ['เริ่มต้นชีวิตใหม่ในดินแดนห่างไกล', 'move marry thread:+romance:2'] },
    { l: 'พิสูจน์ตัวเองต่อครอบครัว', tags: ['stay', 'learn'], chk: ['luk', 13], bonusTag: ['charm', 'leader', 'noble'], ok: ['ครอบครัวยอมรับในที่สุด', 'marry fame+3'], ng: ['ถูกปฏิเสธอย่างเด็ดขาด', 'relkill:lover'] },
  ] },
  { id: 'chain_god_disguised', tone: 'warm', w: 0, important: true, c: ADULT, t: 'ขอทานคนเดิมที่ {name} เคยแบ่งอาหารให้ปรากฏตัวอีกครั้ง ร่างของเขาเรืองแสงก่อนเผยปีกสีทอง "ทูตแห่ง{god}ขอตอบแทน"', ch: [
    { l: 'ขอพรเพื่อตัวเอง', tags: ['greed'], ok: ['พรอันทรงพลังหลั่งไหลลงมา', 'bless:random bless:random belief+15'] },
    { l: 'ขอให้บ้านเมืองสงบสุข', tags: ['help', 'pray'], ax: { kind: 1 }, ok: ['ยุคทองมาเยือนบ้านเกิด และ {name} ได้รับแสงศักดิ์สิทธิ์', 'country:+golden bless:tag=holy karma+10 thread:+holy:3'] },
  ] },
];

const R = (key: string) => ({ [`religion:${key}`]: 25 });
// Random-pool events that mostly appear when the story context fits (place, faith, birth, minority, threads)
export const CONTEXT_STORYLETS: Storylet[] = [
  // birth omens
  { id: 'birth_light', tone: 'warm', w: 0.15, r: 'R', c: { stage: ['infant'] }, aff: { 'religion:light': 6, 'birth:day': 4, 'birthsign:comet': 4 }, once: true, t: 'นักบวชประจำโบสถ์สังเกตเห็นแสงอ่อนรอบเปลของ {name} ทุกเที่ยงวัน "เด็กคนนี้เป็นที่รักของสวรรค์"', e: 'bless:tag=light thread:+holy:3 fame+2' },
  { id: 'birth_eclipse', tone: 'dark', w: 0.1, r: 'R', c: { stage: ['infant'] }, aff: { 'birthsign:eclipse': 12, 'religion:demon': 4, 'birth:night': 2 }, once: true, t: 'หมอตำแยกระซิบว่าเด็กที่เกิดใต้สุริยคราสจะนำความมืดมาสู่หมู่บ้าน เพื่อนบ้านเริ่มปิดหน้าต่างเมื่อแม่อุ้ม {name} ผ่าน', e: 'apt:dark thread:+dark:3 fame-2' },
  { id: 'birth_fullmoon', tone: 'comedy', w: 0.12, c: { stage: ['infant'] }, aff: { 'birthsign:fullmoon': 10 }, once: true, t: '{name} หัวเราะคิกคักทุกคืนจันทร์เต็มดวง และหยุดร้องไห้ทันทีเมื่อเห็นแสงจันทร์', e: 'luk+1 thread:+romance:1' },
  { id: 'birth_storm', tone: 'grim', w: 0.12, c: { stage: ['infant', 'child'] }, aff: { 'birthsign:storm': 10, 'religion:war': 2 }, once: true, t: 'ฟ้าผ่าลงต้นไม้หน้าบ้านในคืนที่ {name} ร้องไห้ และผมของเด็กน้อยชี้ตั้งอยู่สามวัน', e: 'skill:lightning_1' },
  // minorities and prejudice
  { id: 'minority_stares', tone: 'grim', w: 0.3, c: { stage: ['child', 'teen'] }, aff: { minority: 6, human_land: 4 }, t: 'เด็ก ๆ ใน{town}ชี้มาที่ {name} แล้วกระซิบกัน "นั่นไง {race}… แม่บอกว่าอย่าเข้าใกล้"', ch: [
    { l: 'เดินเข้าไปทักทาย', tags: ['trust', 'help'], ax: { social: 1, brave: 1 }, chk: ['luk', 12], bonusTag: ['charm'], ok: ['เด็กคนหนึ่งยื่นลูกกวาดให้ มิตรภาพแรกในเมืองนี้', 'rel:+friend social+5'], ng: ['เด็ก ๆ วิ่งหนีกรีดร้อง', 'social-5 temper+5'] },
    { l: 'ก้มหน้าเดินจากไป', tags: ['safe', 'flee'], ax: { social: -1 }, ok: ['ความเหงาเล็ก ๆ ฝังในใจ', 'kind-3 +flag:bitter'] },
  ] },
  { id: 'minority_expelled', tone: 'dark', w: 0.15, r: 'U', c: { stage: ['teen', 'adult'], notRace: ['human'] }, aff: { minority: 5, human_land: 5, 'race:demonkin': 3, 'race:vampire': 3, 'race:orc': 2, 'race:darkelf': 2, 'countryflag:war': 2 }, t: 'สภาเมือง{town}ลงมติขับไล่{race}ทุกคนออกจากเมืองภายในเจ็ดวัน ป้ายประกาศถูกตอกไว้หน้าบ้านของ {name}', ch: [
    { l: 'เก็บของจากไปเงียบ ๆ', tags: ['travel', 'safe'], ok: ['ออกเดินทางหาที่ที่ยอมรับ', 'move thread:+wanderer:2'] },
    { l: 'รวมพวกต่อต้าน', tags: ['fight', 'defy'], ax: { brave: 1, temper: 1 }, chk: ['pow', 14], bonusTag: ['leader', 'combat'], ok: ['มติถูกยกเลิก {name} กลายเป็นผู้นำของคนส่วนน้อย', 'fame+12 thread:+rebel:3'], ng: ['ถูกทหารทุบตีและโยนออกนอกเมือง', 'hp-30 move'] },
    { l: 'ขอความช่วยเหลือจากเพื่อนมนุษย์', tags: ['trust', 'help'], chk: ['luk', 13], bonusTag: ['charm', 'peace', 'noble'], ok: ['เพื่อนบ้านลงชื่อค้านจนมติตกไป', 'karma+3 rel:+friend'], ng: ['ไม่มีใครกล้าช่วย', 'move kind-5'] },
  ] },
  { id: 'minority_blamed', tone: 'dark', w: 0.12, r: 'U', c: { stage: ['adult'], notRace: ['human'] }, aff: { minority: 4, human_land: 4, 'countryflag:plague': 5, 'countryflag:famine': 4 }, t: 'ภัยพิบัติมาเยือน ฝูงชนถือคบไฟมาหน้าบ้าน {name} "{race}นำคำสาปมา!"', ch: [
    { l: 'ออกไปพูดกับฝูงชน', tags: ['trust', 'defy'], ax: { brave: 1 }, chk: ['int', 14], bonusTag: ['charm', 'leader', 'peace'], ok: ['ฝูงชนสงบลงและแยกย้าย', 'fame+6 karma+3'], ng: ['ก้อนหินลอยมาเต็มหน้า', 'hp-30'] },
    { l: 'หนีทางประตูหลัง', tags: ['flee', 'travel'], chk: ['spd', 11], ok: ['หนีรอดไปเมืองอื่น', 'move'], ng: ['บ้านถูกเผา', 'gold-40 move'] },
  ] },
  { id: 'minority_kin', tone: 'warm', w: 0.25, c: { stage: ['teen', 'adult'] }, aff: { minority: 6 }, t: 'ในตลาดที่ไม่มีใครเหมือนตัวเอง {name} ได้ยินคนพูดภาษา{race} {npc} ยิ้มกว้าง "ไม่คิดว่าจะเจอพี่น้องที่นี่"', e: 'rel:+friend social+5' },
  // faiths of the land
  { id: 'rel_light', tone: 'warm', w: 0.12, aff: R('light'), c: { stage: ['child', 'teen', 'adult', 'elder'] }, t: 'ขบวนแห่นักบุญผ่าน{town} ระฆังดังทั่วเมือง นักบวชพรมน้ำมนต์ใส่ผู้คนตามทาง', ch: [
    { l: 'ร่วมขบวนแห่', tags: ['pray', 'stay'], ax: { piety: 1 }, ok: ['รู้สึกถึงแสงอบอุ่นในอก', 'belief+8 thread:+holy:2'] },
    { l: 'หลบไปทางอื่น', tags: ['safe'], ok: ['ได้ยินเสียงสวดแว่วมาตามลม', ''] },
  ], },
  { id: 'rel_dragon', tone: 'grim', w: 0.12, aff: R('dragon'), c: { stage: ['teen', 'adult'] }, t: 'เทศกาลบูชามังกรประจำปี หนุ่มสาวต้องปีนภูเขาไฟไปวางเครื่องบูชาที่ปากปล่อง', ch: [
    { l: 'อาสาปีนขึ้นไป', tags: ['risk', 'pray'], ax: { brave: 1 }, chk: ['vit', 13], bonusTag: ['fire_res', 'dragon_blood'], ok: ['มังกรที่หลับอยู่ลืมตามองแล้วพยักหน้า', 'bless:tag=fire fame+5'], ng: ['ถูกไอร้อนลวกจนต้องหามลงมา', 'hp-25'] },
    { l: 'ดูอยู่ข้างล่าง', tags: ['safe'], ok: ['ร่วมกินเลี้ยงเนื้อย่างไฟลาวา', 'vit+0'] },
  ] },
  { id: 'rel_sea', tone: 'warm', w: 0.12, aff: { ...R('sea'), 'religion:naga': 15 }, c: { stage: ['child', 'teen', 'adult', 'elder'] }, t: 'ชาวเมืองลอยกระทงบูชาเทพแห่งสายน้ำ คลื่นซัดเปลือกหอยสีมุกมาที่เท้า {name}', e: 'luk+1 belief+5 thread:+faithful:1' },
  { id: 'rel_moon', tone: 'grim', w: 0.12, aff: R('moon'), c: { stage: ['teen', 'adult', 'elder'] }, t: 'คืนจันทร์สีเงิน นักบวชแห่งเทพีจันทราสอนวิธีจำความฝันให้ชาวบ้าน', e: '+flag:moon_taught belief+5 thread:+faithful:1' },
  { id: 'rel_war', tone: 'grim', w: 0.12, aff: R('war'), c: { stage: ['teen', 'adult'] }, t: 'การประลองประจำปีถวายเทพแห่งสงคราม ผู้ชนะจะได้รับดาบจากวิหาร', ch: [
    { l: 'ลงประลอง', tags: ['fight', 'risk'], ax: { brave: 1 }, chk: ['pow', 14], bonusTag: ['combat', 'blade', 'berserk'], ok: ['ชนะเลิศ! ได้รับอาวุธจากวิหาร', 'weapon:holy:lightning:U fame+8 thread:+warrior:2'], ng: ['ตกรอบแรกพร้อมฟันหลุดหนึ่งซี่', 'hp-20'] },
    { l: 'เป็นผู้ชม', tags: ['safe'], ok: ['เชียร์จนเสียงแหบ', ''] },
  ] },
  { id: 'rel_demon', tone: 'dark', w: 0.12, aff: R('demon'), c: { stage: ['teen', 'adult'], notFlag: ['demon_offer'] }, t: 'ในดินแดนที่บูชาปีศาจ การถวายเลือดคือเรื่องปกติ นักบวชยื่นมีดพิธีให้ {name}', ch: [
    { l: 'กรีดฝ่ามือถวายเลือด', tags: ['greed', 'pray'], ok: ['พลังมืดตอบรับคำถวาย', 'apt:dark thread:+dark:3 belief-10'] },
    { l: 'ปฏิเสธ', tags: ['defy', 'safe'], ok: ['ถูกมองด้วยสายตาไม่ไว้ใจ', 'fame-3 thread:+rebel:1'] },
  ] },
  { id: 'rel_ancestor', tone: 'grim', w: 0.12, aff: R('ancestor'), c: { stage: ['child', 'teen', 'adult', 'elder'] }, t: 'ในวันไหว้บรรพบุรุษ วิญญาณปู่ทวดของ {name} ปรากฏในควันธูป "ตระกูลเรามีสมบัติซ่อนอยู่ใต้หินก้อนที่สาม…"', e: 'gold+40 +flag:ancestor_blessed' },
  { id: 'rel_nature', tone: 'warm', w: 0.12, aff: R('nature'), c: { stage: ['child', 'teen', 'adult', 'elder'] }, t: 'ต้นไม้ศักดิ์สิทธิ์ใจกลางเมืองผลิดอกนอกฤดู กลีบดอกปลิวลงบนไหล่ของ {name}', e: 'vit+1 thread:+wild:2' },
  { id: 'rel_naga', tone: 'warm', w: 0.12, aff: R('naga'), c: { stage: ['child', 'teen', 'adult'] }, t: 'พญานาคโผล่จากแม่น้ำในวันออกพรรษา ลูกไฟสีแดงลอยขึ้นจากผิวน้ำต่อหน้า {name}', e: 'belief+10 luk+1 thread:+faithful:2' },
  { id: 'rel_none', tone: 'comedy', w: 0.12, aff: R('none'), c: { stage: ['teen', 'adult'] }, t: 'ชาวเมืองที่นี่ไม่นับถืออะไรเลย เมื่อ {name} พูดถึง{god} ทุกคนหัวเราะ', e: 'belief-5 thread:+rebel:1' },
  // momentum
  { id: 'thread_hero', tone: 'warm', w: 0.2, c: { stage: ['teen', 'adult'] }, aff: { 'thread:hero': 12 }, t: 'ชื่อเสียงความมีน้ำใจของ {name} แพร่ไปทั่ว ชาวบ้านจากหมู่บ้านข้างเคียงเดินทางมาขอความช่วยเหลือเรื่อง[หมาป่า|โจร|บ่อน้ำแห้ง|ผีในโรงสี]', ch: [
    { l: 'ช่วยเหลือ', tags: ['help', 'fight'], chk: ['pow', 12], ok: ['ปัญหาคลี่คลาย ชื่อเสียงยิ่งขจรไกล', 'fame+8 karma+3'], ng: ['ช่วยได้ครึ่งเดียว', 'hp-15 fame+3'] },
    { l: 'บอกว่าไม่ว่าง', tags: ['selfish', 'safe'], ok: ['ชาวบ้านผิดหวัง', 'fame-3'] },
  ] },
  { id: 'thread_dark', tone: 'dark', w: 0.2, c: { stage: ['teen', 'adult', 'elder'] }, aff: { 'thread:dark': 12 }, t: 'ความมืดในใจของ {name} เริ่มมีเสียงเป็นของตัวเอง มันเสนอให้แก้แค้นทุกคนที่เคยดูถูก', ch: [
    { l: 'ฟังเสียงนั้น', tags: ['greed', 'defy'], ok: ['ความแค้นกลายเป็นพลัง', 'mag+1 kind-10 thread:+dark:2'] },
    { l: 'ต่อต้าน', tags: ['pray', 'safe'], chk: ['int', 13], bonusTag: ['holy', 'mind_ward'], ok: ['เสียงเงียบลงชั่วคราว', 'belief+5'], ng: ['เสียงหัวเราะดังขึ้นทุกคืน', 'curse:c_whisper'] },
  ] },
  { id: 'thread_romance', tone: 'comedy', w: 0.2, c: { stage: ['teen', 'adult'] }, aff: { 'thread:romance': 10 }, t: 'มีจดหมายรักนิรนามมาวางหน้าประตูบ้าน {name} ทุกเช้าติดต่อกันหนึ่งเดือน', e: 'social+5 luk+1' },
  { id: 'thread_greed', tone: 'grim', w: 0.2, c: { stage: ['adult', 'elder'] }, aff: { 'thread:greed': 10 }, t: 'ข่าวลือว่า {name} ร่ำรวยดึงดูดทั้งพ่อค้าที่อยากร่วมทุน และโจรที่อยากร่วม "แบ่งปัน"', ch: [
    { l: 'จ้างองครักษ์', tags: ['safe'], ok: ['ปลอดภัย แต่กระเป๋าเบาลง', 'gold-30'] },
    { l: 'ลงทุนเพิ่ม', tags: ['greed', 'risk'], chk: ['int', 13], bonusTag: ['trade'], ok: ['เงินงอกเงย', 'gold+70'], ng: ['ถูกปล้นกลางดึก', 'gold-60 hp-15'] },
  ] },
];
