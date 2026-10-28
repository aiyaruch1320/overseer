import type { Storylet } from '../sim/types';
import { CHAIN_STORYLETS, CONTEXT_STORYLETS } from './chains';
import { PEOPLE_STORYLETS, REGION_STORYLETS } from './people';
import { DISASTER_STORYLETS } from './disasters';

// Effect DSL (ดู sim/effects.ts): pow+1 hp-10 gold+20 fame+5 belief+5 karma+2 brave+10 +flag:x -flag:x
// skill:random skill:unique apt:random bless:random curse:random rel:+mentor relkill:lover marry child
// move move:far die:สาเหตุ_การตาย job:id kill weapon:holy weapon:cursed country:+golden fate:+nemesis
// Text: {name} {npc} {npc2} {place} {town} {item} {food} {animal} {loc} {lover} {spouse} {mentor} {rival}
// {nemesis} {friend} {child} {god} {job} {race} และ [ตัวเลือก|สุ่ม|ข้อความ]

export const STORYLETS: Storylet[] = [
  // ================= วัยทารก / เด็ก =================
  { id: 'baby_cry', tone: 'comedy', w: 6, c: { stage: ['infant'] }, t: '{name} ร้องไห้ทั้งคืนจน[เพื่อนบ้านเอาไม้กวาดมาเคาะประตู|หมาแถวบ้านหอนตาม|แม่มดข้างบ้านมาขอสูตรเสียงร้องไปทำเวท]', e: 'vit+1' },
  { id: 'baby_firstword', tone: 'warm', w: 5, c: { stage: ['infant'] }, t: 'คำแรกที่ {name} พูดคือ "[แม่|ข้าว|ดาบ|เทพ|หิว]" ทั้งบ้านตื่นเต้นกันใหญ่', e: 'int+1' },
  { id: 'baby_omen', tone: 'dark', w: 2, c: { stage: ['infant'] }, t: 'หมอดูประจำหมู่บ้านจ้องหน้า {name} นานผิดปกติ แล้วรีบเก็บไพ่หนีไปโดยไม่รับเงิน', e: '+flag:marked' },
  { id: 'baby_fever', tone: 'grim', w: 3, c: { stage: ['infant'] }, t: '{name} ป่วยไข้สูงจนตัวร้อนดั่งถ่าน พ่อแม่ได้แต่สวดอ้อนวอน "{god} โปรดเมตตา"', ch: [
    { l: 'อดทนสู้ไข้', tags: ['stay'], chk: ['vit', 11], ok: ['ไข้ลดลงในรุ่งเช้า ร่างกายแข็งแรงขึ้น', 'vit+1'], ng: ['รอดมาได้แต่ร่างกายอ่อนแอลง', 'vit-1 hp-10'] },
    { l: 'พ่อแม่พาไปหาหมอยา', tags: ['safe'], ok: ['หมอยาให้ยาขมปี๋ หายป่วยแต่เกลียดสีเขียวไปตลอดชีวิต', 'gold-5'] },
  ] },
  { id: 'child_friend', tone: 'warm', w: 5, c: { stage: ['child'], noRel: 'friend' }, t: '{name} ได้เพื่อนสนิทคนแรกชื่อ {npc} ทั้งคู่สาบานจะเป็นเพื่อนกันตลอดไป[ใต้ต้นไม้ใหญ่|ด้วยการกรีดนิ้วจิ้มน้ำผึ้ง|หลังขโมยขนมด้วยกัน]', e: 'rel:+friend social+10' },
  { id: 'child_bully', tone: 'grim', w: 4, c: { stage: ['child'] }, t: 'เด็กโตชื่อ {npc} รังแก {name} [เพราะเป็น{race}|เพราะหน้าตาแปลก|โดยไม่มีเหตุผล]', ch: [
    { l: 'สู้กลับ', tags: ['fight', 'defy'], ax: { brave: 1, temper: 1 }, chk: ['pow', 11], ok: ['ต่อยจมูก {npc} จนเลือดกำเดาไหล ไม่มีใครกล้ายุ่งอีก', 'brave+10 fame+2 chain:chain_bully_returns'], ng: ['โดนซ้อมน่วม แต่ไม่ร้องไห้สักแอะ', 'hp-10 brave+5 rel:+rival'] },
    { l: 'วิ่งหนี', tags: ['flee'], ax: { brave: -1 }, chk: ['spd', 9], ok: ['วิ่งเร็วจนลมแทบหวีดหวิว', 'spd+1'], ng: ['สะดุดล้ม โดนหัวเราะเยาะทั้งตลาด', 'brave-5'] },
    { l: 'ฟ้องผู้ใหญ่', tags: ['safe', 'trust'], ax: { honest: 1 }, ok: ['{npc} ถูกตีก้น แต่ก็ผูกใจเจ็บ', 'rel:+rival'] },
  ] },
  { id: 'child_animal', tone: 'warm', w: 4, c: { stage: ['child', 'teen'] }, t: '{name} เจอ{animal}ข้างทาง ท่าทางหิวโซ', ch: [
    { l: 'แบ่งอาหารให้', tags: ['help'], ax: { kind: 1 }, ok: ['มันติดตามเป็นเพื่อนคู่ใจ', 'kind+5 +flag:pet karma+1 chain:chain_pet_grows'] },
    { l: 'เอาไปขาย', tags: ['greed'], ax: { kind: -1, ambition: 1 }, ok: ['ได้เงินมาไม่กี่เหรียญ แต่คืนนั้นฝันไม่ดี', 'gold+8 kind-5'] },
    { l: 'เดินผ่านไป', tags: ['safe'], ok: ['หันกลับไปมองครั้งหนึ่ง แล้วก็ลืมไป', ''] },
  ] },
  { id: 'child_school', tone: 'warm', w: 5, c: { stage: ['child'] }, t: 'นักบวชในหมู่บ้านเปิดสอนหนังสือให้เด็ก ๆ ฟรี', ch: [
    { l: 'ตั้งใจเรียน', tags: ['learn'], ax: { curious: 1, ambition: 1 }, chk: ['int', 10], ok: ['อ่านออกเขียนได้เร็วกว่าใคร', 'int+1 skill:scholar_1'], ng: ['ตัวอักษรเต้นระบำในหัว แต่ก็พยายาม', 'int+0'] },
    { l: 'แอบหนีไปเล่น', tags: ['risk', 'selfish'], ax: { curious: -1, ambition: -1 }, ok: ['เรียนรู้ทุกซอกมุมของหมู่บ้านแทน', 'spd+1'] },
  ] },
  { id: 'child_lost', tone: 'dark', w: 3, c: { stage: ['child'] }, t: '{name} หลงเข้าไปใน{loc}ตอนพลบค่ำ ได้ยินเสียงบางอย่างเรียกชื่อจากความมืด', ch: [
    { l: 'เดินตามเสียง', tags: ['risk', 'learn'], ax: { curious: 1, brave: 1 }, chk: ['luk', 12], ok: ['พบภูตเฒ่าผู้ใจดี มันมอบพรเล็ก ๆ ให้', 'bless:random'], ng: ['สิ่งในความมืดไม่ใช่ภูตใจดี… รอดกลับมาพร้อมรอยข่วน และบางอย่างติดตัวมา', 'hp-15 curse:random'] },
    { l: 'วิ่งกลับบ้าน', tags: ['flee', 'safe'], ax: { brave: -1 }, ok: ['ถึงบ้านทันมื้อเย็น ไม่เคยเล่าให้ใครฟัง', 'brave-5'] },
  ] },
  { id: 'child_talent', tone: 'warm', w: 4, c: { stage: ['child'] }, t: 'ระหว่างเล่นกับเพื่อน {name} แสดงพรสวรรค์บางอย่างออกมาโดยไม่ตั้งใจ ผู้ใหญ่ต่างตะลึง', e: 'skill:random fame+2' },
  { id: 'child_steal', tone: 'comedy', w: 4, c: { stage: ['child'] }, t: '{name} เห็น{food}วางอยู่บนหน้าต่างบ้านป้า{npc}', ch: [
    { l: 'ขโมยกิน', tags: ['greed', 'risk'], ax: { honest: -1 }, chk: ['spd', 10], ok: ['อร่อยที่สุดในชีวิต ไม่มีใครจับได้', 'honest-5 spd+1'], ng: ['โดนจับได้คาหนังคาเขา ถูกบังคับล้างจานทั้งเดือน', 'honest-5 vit+1'] },
    { l: 'เคาะประตูขอดี ๆ', tags: ['trust'], ax: { honest: 1, social: 1 }, ok: ['ป้าใจดีให้มาสองชิ้น', 'social+5'] },
  ] },
  { id: 'child_parent_war', tone: 'dark', w: 2, c: { stage: ['child'], countryFlag: 'war' }, t: 'พ่อของ {name} ถูกเกณฑ์ไปรบ จดหมายฉบับสุดท้ายมาถึงพร้อมรอยเลือด', e: 'brave+10 kind-5 +flag:orphan vit+1' },
  { id: 'child_festival', tone: 'comedy', w: 4, c: { stage: ['child', 'teen'] }, t: 'เทศกาลประจำปีของ{town}! มีการแข่ง[กินพาย|วิ่งแบกหมู|ปาไข่ใส่นักบวช|ร้องเพลงแข่งกับกบ]', ch: [
    { l: 'ลงแข่ง', tags: ['risk'], ax: { social: 1, brave: 1 }, chk: ['luk', 11], ok: ['ชนะเลิศ! ได้ถ้วยรางวัลทองเหลือง', 'fame+3 gold+5'], ng: ['แพ้ยับแต่ทุกคนหัวเราะชอบใจ', 'social+5'] },
    { l: 'ดูอยู่ห่าง ๆ', tags: ['safe'], ax: { social: -1 }, ok: ['สนุกไปกับบรรยากาศเงียบ ๆ', ''] },
  ] },
  { id: 'child_wizard', tone: 'warm', w: 2, c: { stage: ['child'], minStat: { mag: 11 } }, t: 'จอมเวทพเนจรผ่านมา และสังเกตเห็นมานาในตัว {name}', ch: [
    { l: 'ขอเป็นลูกศิษย์', tags: ['learn', 'travel'], ax: { curious: 1, ambition: 1 }, ok: ['จอมเวทหัวเราะ สอนคาถาพื้นฐานให้หนึ่งบท', 'apt:magic skill:random'] },
    { l: 'กลัว แอบหลังแม่', tags: ['safe', 'stay'], ax: { brave: -1 }, ok: ['จอมเวทยักไหล่แล้วจากไป', ''] },
  ] },
  { id: 'child_sibling', tone: 'warm', w: 3, c: { stage: ['child'] }, t: 'ครอบครัวของ {name} มีน้องคนใหม่ บ้านวุ่นวายขึ้นเป็นสองเท่า', e: 'kind+5 +flag:sibling' },
  { id: 'child_famine', tone: 'grim', w: 3, c: { stage: ['child', 'teen'], countryFlag: 'famine' }, t: 'ข้าวยากหมากแพง ครอบครัวของ {name} เหลืออาหารเพียงพอสำหรับอีกไม่กี่วัน', ch: [
    { l: 'แบ่งส่วนของตัวเองให้น้อง', tags: ['help'], ax: { kind: 1 }, ok: ['ผอมลงแต่ใจอิ่ม', 'vit-1 kind+10 karma+2'] },
    { l: 'แอบขโมยจากยุ้งฉางเจ้าเมือง', tags: ['risk', 'defy'], ax: { brave: 1, honest: -1 }, chk: ['spd', 12], ok: ['ได้ข้าวมาเลี้ยงทั้งบ้าน!', 'honest-5 brave+5 spd+1'], ng: ['ถูกจับเฆี่ยนสิบที', 'hp-20 +flag:criminal'] },
  ] },

  // ================= วัยรุ่น =================
  { id: 'teen_crush', tone: 'warm', w: 5, c: { stage: ['teen'], noRel: 'lover' }, t: '{name} แอบชอบ {npc} ลูกของ[ช่างตีเหล็ก|เจ้าของโรงเตี๊ยม|นักบวช|พ่อค้าผ้า]', ch: [
    { l: 'สารภาพรัก', tags: ['love', 'risk'], ax: { brave: 1, social: 1 }, chk: ['luk', 11], bonusTag: ['charm', 'beauty'], ok: ['{npc} หน้าแดงแล้วพยักหน้า!', 'rel:+lover chain:chain_first_love_test'], ng: ['{npc} หัวเราะจนน้ำตาไหล "เธอเนี่ยนะ?"', 'brave-5 fame-2'] },
    { l: 'เก็บไว้ในใจ', tags: ['safe'], ax: { brave: -1, social: -1 }, ok: ['เขียนกลอนรักไว้ในสมุดลับ 37 บท', 'int+1'] },
  ] },
  { id: 'teen_rebel', tone: 'comedy', w: 4, c: { stage: ['teen'] }, t: '{name} ทะเลาะกับพ่อแม่เรื่อง[อนาคต|ทรงผม|เพื่อนที่คบ|การอยากเป็นนักผจญภัย]', ch: [
    { l: 'หนีออกจากบ้าน', tags: ['defy', 'travel'], ax: { temper: 1, curious: 1 }, ok: ['เก็บของใส่ห่อผ้า เดินทางไปยังเมืองถัดไป', 'move brave+5 +flag:runaway'] },
    { l: 'ขอโทษและคืนดี', tags: ['stay', 'love'], ax: { temper: -1, kind: 1 }, ok: ['แม่ทำ{food}ปลอบใจ', 'kind+5'] },
  ] },
  { id: 'teen_guild', tone: 'warm', w: 4, c: { stage: ['teen'], age: [15, 19] }, t: 'กิลด์นักผจญภัยใน{town}เปิดรับสมาชิกใหม่ ระดับ F', ch: [
    { l: 'สมัครทันที', tags: ['risk', 'fight', 'travel'], ax: { brave: 1, curious: 1 }, chk: ['pow', 10], ok: ['ผ่านการทดสอบ! ได้บัตรกิลด์สีทองแดง', '+flag:guild fame+3'], ng: ['สอบตกเพราะทำลูกบอลวัดพลังแตก… ไม่ใช่เพราะเก่ง แต่เพราะทำหล่น', 'fame-1'] },
    { l: 'ยังไม่พร้อม', tags: ['safe', 'stay'], ax: { brave: -1 }, ok: ['ตัดสินใจฝึกฝนต่ออีกสักพัก', 'pow+1'] },
  ] },
  { id: 'teen_training', tone: 'warm', w: 5, c: { stage: ['teen'] }, t: '{name} ฝึกฝน[ทุกเช้าก่อนไก่ขัน|จนมือพอง|ใต้น้ำตกเย็นเฉียบ|โดยใช้ตำราเก่าที่เจอในห้องใต้หลังคา]', ch: [
    { l: 'ฝึกหนักเกินขีดจำกัด', tags: ['risk', 'learn'], ax: { ambition: 1 }, chk: ['vit', 12], ok: ['ทะลวงขีดจำกัด! ได้ทักษะใหม่', 'skill:random'], ng: ['ฝึกหนักจนบาดเจ็บ', 'hp-15'] },
    { l: 'ฝึกตามจังหวะตัวเอง', tags: ['safe', 'learn'], ok: ['ก้าวหน้าช้า ๆ แต่มั่นคง', 'pow+1'] },
  ] },
  { id: 'teen_gamble', tone: 'comedy', w: 3, c: { stage: ['teen', 'adult'] }, t: '{npc} ชวน {name} เล่นลูกเต๋าที่หลังโรงเตี๊ยม', ch: [
    { l: 'ลงเดิมพันหมดตัว', tags: ['greed', 'risk'], ax: { ambition: 1, curious: 1 }, chk: ['luk', 13], bonusTag: ['coin', 'lucky'], ok: ['ได้หกคู่สามครั้งติด! กระเป๋าตุง', 'gold+40'], ng: ['เสียหมดตัวรวมรองเท้า', 'gold-30'] },
    { l: 'ปฏิเสธ', tags: ['safe'], ax: { honest: 1 }, ok: ['{npc} ทำหน้าเบื่อ ๆ', ''] },
  ] },
  { id: 'teen_dungeon_dare', tone: 'dark', w: 3, c: { stage: ['teen'] }, t: 'เพื่อน ๆ ท้าให้ {name} ลงไปในบ่อน้ำร้างที่ว่ากันว่ามีผี', ch: [
    { l: 'ลงไป', tags: ['risk', 'fight'], ax: { brave: 1 }, chk: ['luk', 12], ok: ['เจอ{item}ที่ก้นบ่อ!', 'gold+15 fame+2'], ng: ['เชือกขาด ติดอยู่ทั้งคืนกับเสียงกระซิบ', 'hp-10 +flag:haunted_memory brave-5'] },
    { l: 'ไม่ใช่เรื่องของข้า', tags: ['safe', 'flee'], ax: { brave: -1 }, ok: ['ถูกเรียกว่าไก่อ่อนไปหนึ่งปี', 'fame-1'] },
  ] },
  { id: 'teen_awaken', tone: 'warm', w: 2, c: { stage: ['teen'] }, t: 'ในคืนพระจันทร์สีน้ำเงิน มานาในตัว {name} ตื่นขึ้นอย่างรุนแรง', ch: [
    { l: 'ยอมรับพลัง', tags: ['risk', 'learn'], ax: { curious: 1 }, chk: ['mag', 11], ok: ['ควบคุมพลังได้! ความถนัดใหม่ตื่นขึ้น', 'apt:random mag+1'], ng: ['พลังระเบิดเผาโรงนา', 'hp-15 fame-3 mag+1'] },
    { l: 'กดพลังไว้', tags: ['safe'], ax: { curious: -1 }, ok: ['พลังเงียบลง… แต่ยังอยู่ตรงนั้น', 'vit+1'] },
  ] },
  { id: 'teen_rival', tone: 'grim', w: 3, c: { stage: ['teen', 'adult'], noRel: 'rival' }, t: '{npc} เด็กอัจฉริยะประจำเมืองประกาศว่า {name} คือคู่แข่งตลอดกาล', e: 'rel:+rival ambition+10' },
  { id: 'teen_racism', tone: 'dark', w: 0.6, aff: { minority: 6, human_land: 5 }, c: { stage: ['teen', 'adult'], race: ['demonkin', 'orc', 'vampire', 'darkelf'] }, t: 'ชาวเมืองขว้างก้อนหินใส่ {name} และตะโกนว่า "ไอ้{race}สกปรก!"', ch: [
    { l: 'ตอบโต้', tags: ['fight', 'defy'], ax: { temper: 1 }, chk: ['pow', 12], ok: ['พวกเขาวิ่งหนีกระเจิง แต่ข่าวลือเลวร้ายยิ่งขึ้น', 'fame-3 kind-5'], ng: ['ถูกรุมจนสะบักสะบอม', 'hp-20 kind-10'] },
    { l: 'ก้มหน้าเดินจากไป', tags: ['flee', 'safe'], ax: { temper: -1 }, ok: ['ความแค้นเล็ก ๆ ฝังลงในใจ', 'kind-5 +flag:bitter'] },
    { l: 'ยิ้มและช่วยเหลือพวกเขาในวันต่อมา', tags: ['help'], ax: { kind: 2 }, ok: ['บางคนเริ่มมองเปลี่ยนไป', 'kind+10 fame+3 karma+3'] },
  ] },

  // ================= ผู้ใหญ่ทั่วไป =================
  { id: 'adult_traveler', tone: 'warm', w: 4, c: { stage: ['adult'] }, t: 'นักเดินทางผู้บาดเจ็บนอนอยู่ข้างทาง มีถุงเงินห้อยที่เอว', ch: [
    { l: 'ช่วยรักษา', tags: ['help'], ax: { kind: 1 }, ok: ['เขาคือ {npc} พ่อค้าผู้มั่งคั่ง และตอบแทนอย่างงาม', 'gold+30 karma+3 rel:+friend chain:chain_merchant_return'] },
    { l: 'หยิบถุงเงินแล้วไป', tags: ['greed', 'selfish'], ax: { kind: -1, honest: -1 }, ok: ['ได้เงินมาก้อนหนึ่ง แต่รู้สึกว่ามีคนมอง', 'gold+25 karma-4 kind-10 chain:chain_theft_revenge'] },
    { l: 'ทำเป็นไม่เห็น', tags: ['safe'], ok: ['เดินผ่านไปอย่างรวดเร็ว', 'kind-3'] },
  ] },
  { id: 'adult_tavern_brawl', tone: 'comedy', w: 4, c: { stage: ['adult', 'teen'] }, t: 'ในโรงเตี๊ยม คนแคระขี้เมาคนหนึ่งดูถูกบ้านเกิดของ {name}', ch: [
    { l: 'ท้าดวลดื่ม', tags: ['risk'], ax: { social: 1 }, chk: ['vit', 13], ok: ['คนแคระล้มลงไปก่อน! ทั้งร้านโห่ร้อง', 'fame+4 rel:+friend'], ng: ['ตื่นมาอีกทีอยู่ในคอกหมู ไม่มีกางเกง', 'fame-2 gold-10'] },
    { l: 'ชกหน้าเลย', tags: ['fight'], ax: { temper: 1 }, chk: ['pow', 12], ok: ['ชนะ! แต่ต้องจ่ายค่าโต๊ะที่พัง', 'gold-10 fame+2'], ng: ['คนแคระหมัดหนักกว่าที่คิด', 'hp-15'] },
    { l: 'เพิกเฉย', tags: ['safe'], ax: { temper: -1 }, ok: ['ดื่มต่อเงียบ ๆ', ''] },
  ] },
  { id: 'adult_treasure_map', tone: 'warm', w: 3, c: { stage: ['adult', 'teen'] }, t: '{name} ซื้อ{item}จากตลาดมือสอง ข้างในมีแผนที่ชี้ไปยัง{loc}', ch: [
    { l: 'ออกตามล่าสมบัติ', tags: ['risk', 'travel'], ax: { curious: 1, ambition: 1 }, chk: ['int', 12], bonusTag: ['treasure', 'appraise'], ok: ['พบหีบทองคำจริง ๆ!', 'gold+80 fame+3'], ng: ['เป็นแผนที่ปลอม เสียเวลาสามเดือนเต็ม', 'gold-10'] },
    { l: 'ขายต่อ', tags: ['greed', 'safe'], ax: { ambition: -1 }, ok: ['ขายได้กำไรนิดหน่อย', 'gold+10'] },
  ] },
  { id: 'adult_noble_insult', tone: 'grim', w: 3, c: { stage: ['adult'] }, t: 'ขุนนาง{npc}ขี่ม้าเหยียบแผงลอยของหญิงชรา แล้วหัวเราะ', ch: [
    { l: 'ขวางม้าไว้', tags: ['fight', 'help', 'defy'], ax: { brave: 1, kind: 1 }, chk: ['pow', 13], ok: ['ขุนนางตกม้า! ชาวบ้านโห่ร้องเชียร์', 'fame+6 karma+3 rel:+nemesis'], ng: ['ถูกทหารองครักษ์จับขังสามวัน', 'hp-10 +flag:criminal'] },
    { l: 'ช่วยหญิงชราเก็บของ', tags: ['help', 'safe'], ax: { kind: 1 }, ok: ['หญิงชรากระซิบ "เจ้าจะได้รับพรจากเทพ"', 'karma+2 belief+5'] },
    { l: 'อยู่ห่าง ๆ', tags: ['safe', 'selfish'], ok: ['โลกก็เป็นแบบนี้แหละ', 'kind-3'] },
  ] },
  { id: 'adult_merchant_deal', tone: 'warm', w: 3, c: { stage: ['adult'], gold: 20 }, t: 'พ่อค้าต่างทวีปเสนอให้ {name} ร่วมลงทุนในกองคาราวาน', ch: [
    { l: 'ลงทุน', tags: ['greed', 'risk', 'trust'], ax: { ambition: 1 }, chk: ['int', 12], bonusTag: ['trade'], ok: ['กองคาราวานกลับมาพร้อมเครื่องเทศล้ำค่า!', 'gold+60'], ng: ['พ่อค้าหายตัวไปพร้อมเงิน', 'gold-20 +flag:scammed'] },
    { l: 'ไม่ไว้ใจ', tags: ['distrust', 'safe'], ok: ['เก็บเงินไว้ใต้หมอนเหมือนเดิม', ''] },
  ] },
  { id: 'adult_beggar_god', tone: 'warm', w: 2, c: { stage: ['adult', 'elder'] }, t: 'ขอทานแปลกหน้าขอ{food}จาก {name} ดวงตาของเขาเป็นประกายเหมือนดวงดาว', ch: [
    { l: 'ให้อาหาร', tags: ['help'], ax: { kind: 1 }, ok: ['ขอทานยิ้ม แล้วหายวับไปกับสายลม ทิ้งไว้เพียงขนนกสีทอง', 'bless:random karma+3 belief+10 chain:chain_god_disguised'] },
    { l: 'ไล่ไป', tags: ['selfish'], ax: { kind: -1 }, ok: ['คืนนั้นฝนตกเฉพาะบนหลังคาบ้าน {name}', 'luk-1 karma-2'] },
  ] },
  { id: 'adult_injury', tone: 'grim', w: 3, c: { stage: ['adult'] }, t: '{name} [ตกจากหลังคา|ถูกเกวียนชน|โดนวัวกระทิงขวิด|ลื่นบันไดวิหาร] บาดเจ็บสาหัส', ch: [
    { l: 'ฝืนลุกขึ้นทำงานต่อ', tags: ['stay', 'defy'], ax: { ambition: 1 }, chk: ['vit', 13], ok: ['ร่างกายฟื้นตัวอย่างน่าทึ่ง', 'hp-10 vit+1'], ng: ['แผลอักเสบ ทรุดหนักกว่าเดิม', 'hp-30'] },
    { l: 'พักรักษาตัว', tags: ['safe'], ok: ['นอนติดเตียงหนึ่งฤดู', 'hp-10 gold-10'] },
  ] },
  { id: 'adult_cult', tone: 'dark', w: 2, c: { stage: ['adult'] }, t: 'ลัทธิลึกลับในเมืองชวน {name} เข้าร่วมพิธีกรรมกลางคืน "เพื่อพลังที่แท้จริง"', ch: [
    { l: 'เข้าร่วม', tags: ['risk', 'greed', 'defy'], ax: { piety: -1, ambition: 1 }, chk: ['mag', 13], ok: ['ได้รับพลังมืด… และตราประทับบนแขน', 'apt:dark curse:c_demonmark belief-15 chain:chain_cult_summons'], ng: ['พิธีล้มเหลว ผู้ร่วมพิธีตายสามคน', 'hp-25 curse:random'] },
    { l: 'แจ้งทหาร', tags: ['help', 'trust'], ax: { honest: 1, kind: 1 }, ok: ['ลัทธิถูกกวาดล้าง ได้รางวัลจากเจ้าเมือง', 'gold+20 fame+5 belief+5'] },
    { l: 'ไม่ยุ่งเกี่ยว', tags: ['safe'], ok: ['รีบเดินกลับบ้านไม่หันหลัง', ''] },
  ] },
  { id: 'adult_duel_challenge', tone: 'grim', w: 3, c: { stage: ['adult'], rel: 'rival' }, t: '{rival} คู่แข่งตลอดกาลกลับมาพร้อมคำท้าดวล "ครั้งนี้ข้าจะไม่แพ้!"', ch: [
    { l: 'รับคำท้า', tags: ['fight', 'defy'], ax: { brave: 1, ambition: 1 }, chk: ['pow', 13], ok: ['ชนะขาดลอย {rival} ยอมรับความพ่ายแพ้ด้วยน้ำตา', 'fame+8 pow+1'], ng: ['พ่ายแพ้ต่อหน้าฝูงชน', 'hp-15 fame-5 ambition+10'] },
    { l: 'เสนอเป็นเพื่อนกัน', tags: ['help', 'trust'], ax: { kind: 1, temper: -1 }, chk: ['luk', 12], bonusTag: ['charm', 'peace'], ok: ['{rival} อึ้งไปนานก่อนจะหัวเราะ จากศัตรูกลายเป็นสหาย', 'rel:+friend karma+2'], ng: ['{rival} ถ่มน้ำลาย "ขี้ขลาด!"', 'fame-3'] },
  ] },
  { id: 'adult_found_weapon', tone: 'warm', w: 2, c: { stage: ['adult', 'teen'] }, t: 'ใน{loc} {name} พบอาวุธเก่าปักอยู่บนแท่นหิน มีอักษรสลักว่า "สำหรับผู้คู่ควรเท่านั้น"', ch: [
    { l: 'ดึงออกมา', tags: ['risk', 'greed'], ax: { brave: 1, ambition: 1 }, chk: ['luk', 14], bonusTag: ['hero_luck', 'holy'], ok: ['อาวุธหลุดออกมาง่ายดาย แสงสว่างโอบล้อมร่าง!', 'weapon:holy fame+5'], ng: ['ดึงจนหลังเคล็ด อาวุธไม่ขยับ', 'hp-5'] },
    { l: 'ปล่อยไว้', tags: ['safe'], ok: ['บางสิ่งไม่ใช่ของเรา', ''] },
  ] },
  { id: 'adult_cursed_item', tone: 'dark', w: 2, c: { stage: ['adult'] }, t: 'พ่อค้าเร่ขาย{item}ในราคาถูกผิดปกติ ทุกครั้งที่ {name} มองมัน ได้ยินเสียงกระซิบ', ch: [
    { l: 'ซื้อ', tags: ['greed', 'risk'], ax: { curious: 1 }, ok: ['พลังมืดไหลเข้าสู่ร่าง ข้าวของมันกลายเป็นอาวุธต้องสาป', 'weapon:cursed gold-10 dread+5'] },
    { l: 'ไม่ซื้อ', tags: ['safe', 'distrust'], ok: ['เสียงกระซิบหัวเราะเยาะ', ''] },
  ] },
  { id: 'adult_rescue', tone: 'grim', w: 3, c: { stage: ['adult'] }, t: 'บ้านในหมู่บ้านถูกไฟไหม้ มีเสียงเด็กร้องอยู่ข้างใน', ch: [
    { l: 'กระโจนเข้ากองไฟ', tags: ['help', 'risk'], ax: { brave: 1, kind: 1 }, chk: ['vit', 13], bonusTag: ['fire_res', 'water'], ok: ['พาเด็กออกมาได้! ทั้งหมู่บ้านยกย่อง', 'fame+10 karma+5'], ng: ['ช่วยเด็กได้ แต่แผลไฟไหม้ทั่วตัว', 'hp-35 fame+6 karma+5'] },
    { l: 'ตะโกนเรียกคนช่วย', tags: ['safe', 'help'], ax: { brave: -1 }, ok: ['ชาวบ้านช่วยกันดับไฟทันเวลา', 'karma+1'] },
  ] },
  { id: 'adult_mentor_teaches', tone: 'warm', w: 4, c: { stage: ['teen', 'adult'], rel: 'mentor' }, t: '{mentor} อาจารย์ของ {name} เรียกมาฝึกพิเศษ "วันนี้ข้าจะสอนสิ่งที่ไม่เคยสอนใคร"', ch: [
    { l: 'ตั้งใจเรียน', tags: ['learn'], ax: { ambition: 1 }, chk: ['int', 11], ok: ['ได้วิชาลับ!', 'skill:random skill:random'], ng: ['เรียนไม่ทัน แต่ก็ได้อะไรติดมาบ้าง', 'skill:random'] },
    { l: 'แอบหลับ', tags: ['selfish'], ax: { ambition: -1 }, ok: ['อาจารย์ถอนหายใจยาว', 'int+0'] },
  ] },
  { id: 'adult_mentor_dies', tone: 'dark', w: 2, c: { stage: ['adult'], rel: 'mentor', age: [25, 80] }, t: '{mentor} อาจารย์ผู้เป็นดั่งพ่อแม่คนที่สอง ล้มป่วยหนักและสิ้นใจในอ้อมแขนของ {name}', e: 'relkill:mentor skill:random kind+5' },
  { id: 'adult_friend_help', tone: 'warm', w: 3, c: { stage: ['adult'], rel: 'friend' }, t: '{friend} เพื่อนเก่ามาเคาะประตูกลางดึก "ข้าเดือดร้อน ช่วยข้าด้วย"', ch: [
    { l: 'ช่วยเต็มที่', tags: ['help', 'trust'], ax: { kind: 1 }, ok: ['ช่วยจนเพื่อนรอด มิตรภาพแน่นแฟ้นขึ้น', 'gold-20 karma+3'] },
    { l: 'ปฏิเสธ', tags: ['selfish', 'safe'], ax: { kind: -1 }, ok: ['{friend} จากไปเงียบ ๆ และไม่กลับมาอีก', 'relkill:friend kind-5'] },
  ] },
  { id: 'adult_tax', tone: 'grim', w: 3, c: { stage: ['adult'] }, t: 'เจ้าเมือง{place}ขึ้นภาษี[สามเท่า|เพื่อสร้างรูปปั้นตัวเอง|สำหรับลมหายใจ|สำหรับทุกคนที่ชื่อขึ้นต้นด้วยตัว ส]', ch: [
    { l: 'จ่ายแต่โดยดี', tags: ['safe', 'stay'], ok: ['กระเป๋าแฟบลง', 'gold-20'] },
    { l: 'ร่วมประท้วง', tags: ['defy', 'fight'], ax: { brave: 1, honest: 1 }, chk: ['luk', 12], ok: ['การประท้วงสำเร็จ! ภาษีลดลง', 'fame+5'], ng: ['ถูกจับขังคุก', 'hp-15 +flag:criminal gold-10'] },
    { l: 'หนีภาษี', tags: ['risk', 'selfish'], ax: { honest: -1 }, chk: ['int', 12], ok: ['ซ่อนเงินในหม้อดองผักได้เนียน', ''], ng: ['ถูกจับปรับสองเท่า', 'gold-40'] },
  ] },
  { id: 'adult_relocate', tone: 'warm', w: 2, c: { stage: ['adult'], tag: ['wanderer'] }, t: 'ขอบฟ้าเรียกหา {name} อีกครั้ง', ch: [
    { l: 'ออกเดินทางสู่ดินแดนใหม่', tags: ['travel', 'risk'], ax: { curious: 1 }, ok: ['เก็บของแล้วเดินทางไกล', 'move:far fame+2'] },
    { l: 'อยู่ต่อ', tags: ['stay'], ok: ['ความคิดถึงการเดินทางค่อย ๆ จางไป', ''] },
  ] },
  { id: 'adult_bandit_offer', tone: 'dark', w: 2, c: { stage: ['adult'], gold: -30 }, t: 'ไม่มีเงินแม้แต่ซื้อขนมปัง กลุ่มโจรเสนอให้ {name} เข้าร่วม', ch: [
    { l: 'เข้าร่วม', tags: ['greed', 'selfish', 'risk'], ax: { honest: -1, kind: -1 }, ok: ['ชีวิตใหม่ในฐานะโจร', 'gold+40 karma-5 +flag:outlaw job:thief'] },
    { l: 'ปฏิเสธ', tags: ['safe', 'defy'], ax: { honest: 1 }, ok: ['อดอยากต่อไป แต่ยังมีศักดิ์ศรี', 'vit-1 karma+2'] },
  ] },
  { id: 'adult_dungeon', tone: 'grim', w: 3, c: { stage: ['adult', 'teen'], flag: ['guild'] }, t: 'ปาร์ตี้นักผจญภัยของ {name} รับเควสต์สำรวจดันเจี้ยนชั้น [3|5|7|13]', ch: [
    { l: 'บุกตะลุยเต็มกำลัง', tags: ['fight', 'risk'], ax: { brave: 1 }, chk: ['pow', 13], bonusTag: ['combat', 'magic'], ok: ['เคลียร์ดันเจี้ยนสำเร็จ! เลื่อนยศกิลด์', 'gold+50 fame+8 skill:random kill'], ng: ['สมาชิกบาดเจ็บ ต้องถอยทัพ', 'hp-25 gold+5'] },
    { l: 'สำรวจอย่างระมัดระวัง', tags: ['safe', 'learn'], ax: { brave: -1, curious: 1 }, chk: ['int', 11], ok: ['เจอห้องลับและแผนที่ชั้นล่าง', 'gold+25 int+1'], ng: ['หลงทางสองวัน', 'hp-10'] },
  ] },
  { id: 'adult_slave_market', tone: 'dark', w: 2, c: { stage: ['adult'], gold: 40 }, t: '{name} เดินผ่านตลาดค้าทาสใน{town} เด็กชาว{raceNpc}คนหนึ่งจ้องมาด้วยแววตาว่างเปล่า', ch: [
    { l: 'ซื้อแล้วปล่อยให้เป็นอิสระ', tags: ['help'], ax: { kind: 2 }, ok: ['เด็กคนนั้นร้องไห้ และสาบานจะตอบแทนสักวัน', 'gold-40 karma+6 rel:+friend chain:chain_freed_slave'] },
    { l: 'ปล้นตลาดค้าทาส!', tags: ['fight', 'defy', 'help'], ax: { brave: 2, kind: 1, temper: 1 }, chk: ['pow', 15], ok: ['ปลดปล่อยทาสยี่สิบคน! กลายเป็นตำนานใต้ดิน', 'fame+12 karma+8 +flag:wanted'], ng: ['ถูกจับและถูกล่ามโซ่เสียเอง… หนีรอดมาได้อย่างหวุดหวิด', 'hp-30 +flag:wanted'] },
    { l: 'เดินผ่านไป', tags: ['safe', 'selfish'], ok: ['แววตานั้นยังติดตาไปหลายคืน', 'kind-5'] },
  ] },
  { id: 'adult_isekai_person', tone: 'comedy', w: 2, c: { stage: ['adult', 'teen'] }, t: 'ชายแปลกหน้าในชุด[เสื้อเชิ้ตขาวผูกไท|ชุดนักเรียนญี่ปุ่น|ชุดนอนลายหมี]ตะโกนว่า "นี่มันโลกต่างมิติ! สถานะ! เปิดหน้าต่างสถานะ!"', ch: [
    { l: 'ช่วยเขาปรับตัว', tags: ['help', 'learn'], ax: { kind: 1, curious: 1 }, ok: ['เขาสอนวิธีทำ "มายองเนส" ขายดีจนรวย', 'gold+40 int+1 rel:+friend'] },
    { l: 'แจ้งทหารว่ามีคนบ้า', tags: ['safe', 'distrust'], ok: ['ทหารพาตัวไป… วันต่อมาเขากลายเป็นผู้กล้าของอาณาจักร', 'fame-1'] },
  ] },
  { id: 'adult_storm_harvest', tone: 'grim', w: 3, c: { stage: ['adult'], job: ['farmer'] }, t: 'พายุลูกเห็บถล่มทุ่งนาของ {name} ก่อนเก็บเกี่ยวเพียงสามวัน', ch: [
    { l: 'อธิษฐานต่อเทพ', tags: ['pray'], ax: { piety: 1 }, ok: ['…พายุยังคงตกต่อไป หรือว่าเทพจะไม่ได้ยิน?', 'gold-20 belief+5 faith+3'] },
    { l: 'กู้ผลผลิตเท่าที่ทำได้', tags: ['stay', 'learn'], chk: ['vit', 11], ok: ['เก็บได้ครึ่งหนึ่ง', 'gold-5'], ng: ['เสียหายเกือบหมด', 'gold-25'] },
  ] },
  { id: 'adult_rumor', tone: 'comedy', w: 3, c: { stage: ['adult'] }, t: 'ข่าวลือแพร่สะพัดว่า {name} [เป็นลูกนอกสมรสของกษัตริย์|เคยฆ่ามังกรด้วยช้อน|มีหางซ่อนอยู่|เป็นสายลับของราชาปีศาจ]', ch: [
    { l: 'ปล่อยให้ลือต่อไป', tags: ['risk'], ax: { honest: -1 }, ok: ['ข่าวลือกลายเป็นตำนาน', 'fame+5'] },
    { l: 'ออกมาปฏิเสธ', tags: ['safe'], ax: { honest: 1 }, ok: ['ยิ่งปฏิเสธ คนยิ่งเชื่อ', 'fame+2'] },
  ] },
  { id: 'adult_prayer', tone: 'warm', w: 3, c: { stage: ['adult', 'elder'], axis: { piety: 20 } }, t: '{name} คุกเข่าหน้าแท่นบูชาเล็ก ๆ ในบ้าน "{god} หากท่านได้ยิน… โปรดชี้ทางให้ข้า"', e: 'belief+8 faith+4' },
  { id: 'adult_doubt', tone: 'grim', w: 3, c: { stage: ['adult'], axis: { piety: -20 } }, t: '{name} มองท้องฟ้าแล้วหัวเราะเยาะ "ถ้ามีเทพจริง โลกคงไม่เละขนาดนี้"', e: 'belief-6' },
  { id: 'adult_hero_party', tone: 'warm', w: 2, c: { stage: ['adult'], minStat: { pow: 12 } }, t: 'ผู้กล้าของอาณาจักรผ่านมาและกำลังหาสมาชิกปาร์ตี้เพิ่ม', ch: [
    { l: 'อาสาเข้าร่วม', tags: ['risk', 'fight', 'travel'], ax: { brave: 1, ambition: 1 }, chk: ['pow', 13], ok: ['ได้เข้าร่วม! ผจญภัยปราบอสูรร่วมกันหนึ่งปี', 'fame+10 skill:random gold+30 kill'], ng: ['ผู้กล้ามองหัวจรดเท้าแล้วบอกว่า "ไว้คราวหน้านะ"', 'fame-1'] },
    { l: 'ไม่สนใจ', tags: ['safe', 'stay'], ok: ['อยู่บ้านดีกว่า', ''] },
  ] },
  { id: 'adult_hero_kicked', tone: 'comedy', w: 2, c: { stage: ['adult'], flag: ['guild'] }, t: 'หัวหน้าปาร์ตี้ประกาศไล่ {name} ออกเพราะ "ไร้ประโยชน์"', ch: [
    { l: 'ออกไปตั้งตัวใหม่ (แล้วค่อยแก้แค้น)', tags: ['defy', 'travel'], ax: { ambition: 1 }, ok: ['ทันทีที่ออกมา ทักษะที่ซ่อนอยู่ก็ตื่นขึ้น! …เหมือนในนิยายเลย', 'skill:unique fame+3'] },
    { l: 'อ้อนวอนขออยู่ต่อ', tags: ['stay', 'trust'], ax: { brave: -1 }, ok: ['ได้อยู่ต่อในฐานะคนแบกกระเป๋า', 'vit+1 fame-2'] },
  ] },
  { id: 'adult_slime_pet', tone: 'comedy', w: 2, c: { stage: ['adult', 'teen', 'child'] }, t: 'สไลม์จิ๋วตัวหนึ่งตามติด {name} ไปทุกที่ มันพยายามกลืนรองเท้า', e: '+flag:pet luk+1' },
  { id: 'adult_noble_offer', tone: 'warm', w: 2, c: { stage: ['adult'], minStat: { int: 12 } }, t: 'เจ้าเมือง{place}ประทับใจในสติปัญญาของ {name} และเสนอตำแหน่งที่ปรึกษา', ch: [
    { l: 'รับตำแหน่ง', tags: ['greed', 'stay'], ax: { ambition: 1 }, ok: ['เข้าสู่วังวนการเมือง', 'gold+30 fame+6 +flag:noble'] },
    { l: 'ปฏิเสธ', tags: ['defy'], ax: { ambition: -1 }, ok: ['อิสรภาพมีค่ากว่าทองคำ', ''] },
  ] },
  { id: 'adult_village_defense', tone: 'grim', w: 3, c: { stage: ['adult'] }, t: 'ข่าวว่าฝูงอสูรกำลังมุ่งหน้ามายัง{town} ชาวบ้านมองมาที่ {name}', ch: [
    { l: 'นำชาวบ้านสร้างแนวป้องกัน', tags: ['fight', 'help', 'stay'], ax: { brave: 1, kind: 1 }, chk: ['int', 12], bonusTag: ['leader', 'combat'], ok: ['ต้านอสูรไว้ได้! {name} กลายเป็นผู้นำหมู่บ้าน', 'fame+10 karma+4 skill:leadership_1 kill'], ng: ['ป้องกันไว้ได้แต่สูญเสียหนัก', 'hp-20 fame+3'] },
    { l: 'พาครอบครัวหนี', tags: ['flee', 'safe'], ax: { brave: -1 }, ok: ['รอดชีวิต แต่หมู่บ้านไม่เหมือนเดิมอีกแล้ว', 'move fame-3'] },
  ] },
  { id: 'adult_secret_door', tone: 'warm', w: 2, c: { stage: ['adult', 'teen'], tag: ['seer', 'appraise', 'curious'] }, t: '{name} สังเกตเห็นอักษรเรืองแสงจาง ๆ บนกำแพง{loc} ที่คนอื่นมองไม่เห็น', e: 'skill:random gold+20' },

  // ================= อาชีพ =================
  { id: 'job_soldier_order', tone: 'dark', w: 4, c: { stage: ['adult'], job: ['soldier', 'knight'] }, t: 'ผู้บังคับบัญชาสั่งให้ {name} เผาหมู่บ้านที่ "อาจ" ซ่อนกบฏ', ch: [
    { l: 'ทำตามคำสั่ง', tags: ['selfish', 'stay'], ax: { kind: -1 }, ok: ['เสียงกรีดร้องจะตามหลอกหลอนไปชั่วชีวิต', 'gold+20 karma-8 kind-15 +flag:war_crime'] },
    { l: 'ขัดคำสั่ง', tags: ['defy', 'help'], ax: { kind: 1, brave: 1 }, chk: ['luk', 12], ok: ['แอบปล่อยชาวบ้านหนีได้ทัน', 'karma+6 fame+4'], ng: ['ถูกปลดจากกองทัพและถูกตีตราว่าทรยศ', 'karma+6 fame-5 job:adventurer'] },
  ] },
  { id: 'job_mage_experiment', tone: 'comedy', w: 4, c: { stage: ['adult', 'teen'], job: ['mage', 'scholar', 'warlock'] }, t: 'การทดลองเวทครั้งใหม่ของ {name} [ทำให้แมวพูดได้|เสกกบออกมาสามร้อยตัว|ทำให้ผมกลายเป็นสีชมพู|เปิดประตูมิติไปยังห้องน้ำของกษัตริย์]', ch: [
    { l: 'ทดลองต่อ', tags: ['learn', 'risk'], ax: { curious: 1 }, chk: ['mag', 12], ok: ['ค้นพบทฤษฎีเวทใหม่!', 'skill:random int+1'], ng: ['ระเบิด! คิ้วหายไปข้างหนึ่ง', 'hp-10'] },
    { l: 'หยุดก่อนจะแย่ลง', tags: ['safe'], ok: ['ใช้เวลาทั้งเดือนจับกบ', ''] },
  ] },
  { id: 'job_priest_miracle', tone: 'warm', w: 4, c: { stage: ['adult'], job: ['priest', 'healer', 'monk'] }, t: 'ผู้ป่วยหนักถูกหามมาที่วิหาร ญาติร้องไห้ขอให้ {name} ช่วย', ch: [
    { l: 'อธิษฐานและรักษาสุดกำลัง', tags: ['help', 'pray'], ax: { kind: 1, piety: 1 }, chk: ['mag', 12], bonusTag: ['heal', 'holy'], ok: ['ผู้ป่วยลืมตา! ข่าวปาฏิหาริย์แพร่ไปทั่ว', 'fame+8 belief+8 faith+6 karma+3'], ng: ['ผู้ป่วยจากไปอย่างสงบ', 'belief-3 kind+5'] },
    { l: 'บอกตามจริงว่าช่วยไม่ได้', tags: ['safe'], ax: { honest: 1 }, ok: ['ญาติเข้าใจ และขอบคุณสำหรับความซื่อตรง', 'honest+5'] },
  ] },
  { id: 'job_thief_heist', tone: 'grim', w: 4, c: { stage: ['adult', 'teen'], job: ['thief', 'assassin'] }, t: 'งานใหญ่: ขโมย{item}จากคลังสมบัติของขุนนาง{npc}', ch: [
    { l: 'ลงมือคนเดียว', tags: ['greed', 'risk'], ax: { ambition: 1 }, chk: ['spd', 14], bonusTag: ['stealth'], ok: ['สำเร็จอย่างไร้ร่องรอย!', 'gold+70 fame+3'], ng: ['ถูกจับได้! ต้องหนีออกนอกประเทศ', 'hp-15 move +flag:wanted'] },
    { l: 'ชวนเพื่อนร่วมทีม', tags: ['trust', 'greed'], ax: { social: 1 }, chk: ['luk', 12], ok: ['แบ่งกันคนละครึ่ง ทุกคนพอใจ', 'gold+40 rel:+friend'], ng: ['เพื่อนหักหลัง หนีไปพร้อมของ', 'rel:+nemesis'] },
  ] },
  { id: 'job_merchant_route', tone: 'warm', w: 4, c: { stage: ['adult'], job: ['merchant', 'cook'] }, t: 'ข่าวว่า{food}ในทวีปข้าง ๆ ขายได้ราคาดีกว่าสิบเท่า', ch: [
    { l: 'ส่งสินค้าข้ามทะเล', tags: ['greed', 'risk', 'travel'], ax: { ambition: 1 }, chk: ['int', 12], bonusTag: ['trade', 'sea'], ok: ['ร่ำรวย!', 'gold+90 fame+3'], ng: ['เรือล่ม สินค้าจมทะเล', 'gold-40'] },
    { l: 'ค้าขายในท้องถิ่นต่อ', tags: ['safe', 'stay'], ok: ['รายได้มั่นคง', 'gold+15'] },
  ] },
  { id: 'job_smith_masterpiece', tone: 'warm', w: 4, c: { stage: ['adult'], job: ['smith'] }, t: 'อัศวินคนหนึ่งสั่งทำดาบที่ "แข็งแกร่งที่สุดในโลก" {name} จ้องเตาไฟอยู่นาน', ch: [
    { l: 'ใช้แร่ล้ำค่าที่เก็บสะสมมาทั้งชีวิต', tags: ['risk', 'learn'], ax: { ambition: 1 }, chk: ['pow', 13], bonusTag: ['smith', 'rune'], ok: ['ดาบในตำนานถือกำเนิด! เก็บไว้เองหนึ่งเล่ม', 'weapon:holy fame+10 gold+40'], ng: ['ดาบร้าวระหว่างชุบน้ำ', 'gold-20'] },
    { l: 'ทำดาบดีธรรมดาส่งไป', tags: ['safe'], ok: ['อัศวินพอใจ', 'gold+25'] },
  ] },
  { id: 'job_hunter_beast', tone: 'grim', w: 4, c: { stage: ['adult'], job: ['hunter', 'tamer', 'druid'] }, t: 'รอยเท้าขนาดยักษ์ในป่า เป็นของอสูรที่ไม่มีใครเคยเห็น', ch: [
    { l: 'ตามล่า', tags: ['fight', 'risk'], ax: { brave: 1 }, chk: ['spd', 13], bonusTag: ['ranged', 'survival'], ok: ['ล่าได้! หนังของมันขายได้ราคาสูง', 'gold+50 fame+6 kill'], ng: ['มันล่าเรากลับ', 'hp-25'] },
    { l: 'พยายามฝึกให้เชื่อง', tags: ['help', 'learn'], ax: { kind: 1, curious: 1 }, chk: ['luk', 14], bonusTag: ['beast', 'beast_friend'], ok: ['มันยอมรับ {name} เป็นนาย!', '+flag:beast_companion skill:taming_1 fame+5'], ng: ['ถูกตะปบจนเป็นแผลเป็น', 'hp-20'] },
  ] },
  { id: 'job_bard_song', tone: 'comedy', w: 4, c: { stage: ['adult', 'teen'], job: ['bard'] }, t: '{name} แต่งเพลงเสียดสีกษัตริย์ เพลงดังไปทั่วอาณาจักร', ch: [
    { l: 'ร้องต่อไป', tags: ['defy', 'risk'], ax: { brave: 1 }, chk: ['luk', 13], ok: ['กลายเป็นวีรชนของสามัญชน', 'fame+12'], ng: ['ถูกทหารหลวงตามล่า', 'move +flag:wanted fame+5'] },
    { l: 'แต่งเพลงสรรเสริญกษัตริย์แทน', tags: ['safe', 'greed'], ax: { honest: -1 }, ok: ['ได้รับรางวัลเป็นถุงทอง', 'gold+30 fame-2'] },
  ] },
  { id: 'job_pirate_raid', tone: 'grim', w: 4, c: { stage: ['adult'], job: ['pirate', 'fisher'] }, t: 'เรือสินค้าลำใหญ่แล่นผ่านอย่างไร้การคุ้มกัน', ch: [
    { l: 'ปล้น!', tags: ['greed', 'fight'], ax: { kind: -1, brave: 1 }, chk: ['pow', 12], bonusTag: ['sea'], ok: ['ได้ทองคำเต็มลำ!', 'gold+80 fame+5 karma-3'], ng: ['กองทัพเรือโผล่มา!', 'hp-20'] },
    { l: 'ปล่อยไป', tags: ['safe'], ax: { kind: 1 }, ok: ['ลูกเรือบ่นอุบ', ''] },
  ] },
  { id: 'job_assassin_target', tone: 'dark', w: 4, c: { stage: ['adult'], job: ['assassin', 'thief', 'warlock'] }, t: 'สัญญาจ้างใหม่: เป้าหมายคือ {npc} นักบวชผู้ใจดีที่ทุกคนรัก', ch: [
    { l: 'รับงาน', tags: ['greed', 'selfish'], ax: { kind: -2 }, chk: ['spd', 13], ok: ['งานเสร็จ ค่าตอบแทนก้อนโต… แต่วิญญาณหนักอึ้ง', 'gold+100 karma-10 kill dread+8'], ng: ['พลาด! เป้าหมายรอด และรู้ว่าใครส่งมา', 'hp-20 rel:+nemesis'] },
    { l: 'ปฏิเสธ และเตือนเป้าหมาย', tags: ['help', 'defy'], ax: { kind: 1 }, ok: ['กลายเป็นศัตรูของสมาคมนักฆ่า แต่ช่วยชีวิตคนดีไว้ได้', 'karma+6 +flag:hunted chain:chain_assassin_guild'] },
  ] },
  { id: 'job_farmer_giant_veggie', tone: 'comedy', w: 3, c: { stage: ['adult'], job: ['farmer', 'druid'] }, t: 'หัวผักกาดในไร่ของ {name} โตจนสูงกว่าบ้าน มีคนมาดูจากสามเมือง', e: 'gold+30 fame+5' },
  { id: 'job_scholar_forbidden', tone: 'dark', w: 3, c: { stage: ['adult'], job: ['scholar', 'mage', 'priest'] }, t: '{name} พบตำราต้องห้ามในห้องสมุดใต้ดิน หน้าปกทำจากหนังบางอย่าง', ch: [
    { l: 'อ่าน', tags: ['learn', 'risk'], ax: { curious: 1 }, chk: ['int', 14], ok: ['ความรู้ต้องห้ามไหลเข้าหัว', 'apt:necro skill:random int+1'], ng: ['สติแตกไปชั่วขณะ', 'curse:c_madness'] },
    { l: 'เผาทิ้ง', tags: ['safe', 'help'], ax: { piety: 1 }, ok: ['ควันดำลอยขึ้นพร้อมเสียงกรีดร้อง', 'karma+2 belief+3'] },
  ] },

  // ================= เผ่าพันธุ์ / ภูมิอากาศ =================
  { id: 'race_vampire_sun', tone: 'dark', w: 4, c: { tag: ['weak_sun'], stage: ['child', 'teen', 'adult'] }, t: 'แดดเที่ยงวันส่องผ่านรอยแยกม่าน ผิวของ {name} เริ่มไหม้เป็นควัน', ch: [
    { l: 'กระโจนหลบในเงา', tags: ['flee', 'safe'], chk: ['spd', 11], ok: ['รอดหวุดหวิด', 'hp-5'], ng: ['ไหม้ไปครึ่งแขน', 'hp-25'] },
    { l: 'ทนไว้ (ต้องปกป้องใครบางคน)', tags: ['help', 'defy'], ax: { kind: 1, brave: 1 }, ok: ['ทนได้จนภารกิจสำเร็จ แต่แผลไหม้ลึก', 'hp-30 karma+4'] },
  ] },
  { id: 'race_vampire_thirst', tone: 'dark', w: 4, c: { tag: ['blood_drinker'], stage: ['teen', 'adult'] }, t: 'ความกระหายเลือดรุนแรงจนมือของ {name} สั่น ชาวบ้านคนหนึ่งเดินผ่านมาคนเดียว', ch: [
    { l: 'ข่มใจ ดื่มเลือดสัตว์แทน', tags: ['help', 'safe'], ax: { kind: 1, temper: -1 }, chk: ['vit', 12], ok: ['ข่มใจได้สำเร็จ', 'kind+5 karma+2'], ng: ['ข่มไม่ไหว… แต่หยุดได้ก่อนเขาตาย', 'karma-3 +flag:fed_on_human'] },
    { l: 'ดื่ม', tags: ['selfish', 'greed'], ax: { kind: -1 }, ok: ['พลังเพิ่มขึ้น แต่ชาวบ้านเริ่มตามล่า', 'pow+1 mag+1 karma-6 +flag:wanted'] },
  ] },
  { id: 'race_fae_iron', tone: 'grim', w: 3, c: { tag: ['weak_iron'] }, t: 'เมืองใหม่ที่ {name} ไปถึงตอกตะปูเหล็กไว้ทุกประตูเพื่อกันภูต', ch: [
    { l: 'ฝืนเข้าเมือง', tags: ['risk', 'defy'], chk: ['vit', 10], ok: ['ปวดหัวแต่ก็ทำธุระเสร็จ', 'hp-5'], ng: ['เป็นลมหน้าประตู', 'hp-15'] },
    { l: 'แกล้งพวกเขาด้วยเวทมายาจนถอดตะปูออกเอง', tags: ['risk'], ax: { honest: -1, curious: 1 }, chk: ['mag', 12], ok: ['ทั้งเมืองเชื่อว่าตะปูนำโชคร้าย ฮ่า!', 'fame+3'], ng: ['ถูกจับได้ ถูกขังในกรงเหล็ก', 'hp-20'] },
  ] },
  { id: 'race_slime_absorb', tone: 'comedy', w: 4, c: { race: ['slime'] }, t: '{name} กลืน[ก้อนหินวิเศษ|ดาบที่ใครทำตก|หนังสือเวททั้งเล่ม|รองเท้าบู๊ตของทหาร] โดยไม่ตั้งใจ', ch: [
    { l: 'ย่อยและวิเคราะห์', tags: ['learn'], chk: ['vit', 10], bonusTag: ['absorb', 'predator'], ok: ['ได้รับความสามารถใหม่จากสิ่งที่กลืน!', 'skill:random'], ng: ['ท้องเสียสามวัน (สไลม์ก็ท้องเสียได้)', 'hp-5'] },
    { l: 'คายออกมา', tags: ['safe'], ok: ['ของมีเมือกเปื้อนไปหมด', ''] },
  ] },
  { id: 'race_slime_evolve', tone: 'warm', w: 2, c: { race: ['slime'], age: [20, 80] }, t: '{name} ได้รับการตั้งชื่อจากมังกรที่ถูกผนึก ร่างกายสั่นสะเทือนและเริ่มวิวัฒนาการ!', e: 'skill:u_predator mag+2 vit+2 fame+10' },
  { id: 'race_dwarf_brew', tone: 'comedy', w: 4, c: { race: ['dwarf'] }, t: 'การแข่งขันกลั่นเบียร์ประจำปีของภูเขา {name} มีสูตรลับของปู่', ch: [
    { l: 'ใช้สูตรของปู่', tags: ['stay'], chk: ['luk', 11], ok: ['ชนะเลิศ! ปู่ร้องไห้ในหลุมศพ', 'fame+5 gold+20'], ng: ['เบียร์ระเบิดกลางงาน', 'hp-5 fame-2'] },
    { l: 'ผสมแร่เรืองแสงลงไป', tags: ['risk', 'learn'], ax: { curious: 1 }, chk: ['int', 12], ok: ['เบียร์เรืองแสงกลายเป็นตำนาน!', 'fame+8 gold+30'], ng: ['ทุกคนท้องเสียทั้งภูเขา', 'fame-6'] },
  ] },
  { id: 'race_orc_honor', tone: 'grim', w: 4, c: { race: ['orc'], stage: ['teen', 'adult'] }, t: 'หัวหน้าเผ่าประกาศพิธีประลองเลือด ผู้ชนะจะได้เป็นนักรบระดับสูง', ch: [
    { l: 'ลงประลอง', tags: ['fight', 'risk'], ax: { brave: 1 }, chk: ['pow', 13], bonusTag: ['berserk'], ok: ['ชนะ! เผ่าโห่ร้องชื่อ {name}', 'fame+8 pow+1 kill'], ng: ['พ่ายแพ้ เสียเขี้ยวไปหนึ่งซี่', 'hp-20 fame-2'] },
    { l: 'ปฏิเสธด้วยเหตุผล', tags: ['safe', 'defy'], ax: { brave: -1, curious: 1 }, ok: ['ถูกเรียกว่าออร์คขี้ขลาด แต่ได้เวลาไปเรียนหนังสือ', 'int+1 fame-4'] },
  ] },
  { id: 'race_elf_human', tone: 'dark', w: 3, c: { race: ['elf', 'vampire', 'naga', 'darkelf'], stage: ['adult'] }, t: 'มนุษย์ที่ {name} เคยรู้จักตอนเขายังเป็นเด็ก บัดนี้แก่ชราและกำลังจะตาย ส่วน {name} ยังเหมือนเดิม', e: 'kind+5 int+1' },
  { id: 'race_naga_river', tone: 'warm', w: 3, c: { race: ['naga'] }, t: 'ถึงฤดูพิธีบูชาแม่น้ำ ชาวนาคาลอยกระทงพลอยสู่สายน้ำ', ch: [
    { l: 'ร่วมพิธีด้วยใจศรัทธา', tags: ['pray', 'stay'], ax: { piety: 1 }, ok: ['สายน้ำเปล่งแสงตอบรับ', 'belief+10 faith+5 luk+1'] },
    { l: 'ดำน้ำไปเก็บพลอยมาขาย', tags: ['greed', 'risk'], ax: { piety: -1 }, chk: ['spd', 11], ok: ['รวยเละ! แต่ผู้อาวุโสมองด้วยสายตาเย็นชา', 'gold+40 karma-3'], ng: ['ถูกจับได้และเนรเทศ', 'move fame-6'] },
  ] },
  { id: 'race_merfolk_land', tone: 'grim', w: 3, c: { race: ['merfolk'], climate: ['desert', 'volcanic', 'frozen', 'temperate'] }, t: 'อยู่บนบกนานเกินไป เกล็ดของ {name} เริ่มแห้งแตก', e: 'hp-10 +flag:homesick' },
  { id: 'race_dragonkin_hoard', tone: 'comedy', w: 3, c: { race: ['dragonkin'] }, t: 'สัญชาตญาณมังกรตื่น {name} เริ่มสะสม[เหรียญทอง|ช้อนเงิน|ถ้วยรางวัล|หินแวววาว]ไว้ใต้เตียงแล้วนอนทับ', e: 'gold+15 ambition+5' },
  { id: 'race_demonkin_church', tone: 'dark', w: 3, c: { race: ['demonkin'], stage: ['teen', 'adult'] }, t: 'นักบวชประกาศว่า{race}ทุกคนต้องผ่าน "พิธีชำระบาป" ด้วยน้ำมนต์เดือด', ch: [
    { l: 'หลบหนีออกนอกเมือง', tags: ['flee', 'travel'], ok: ['ใช้ชีวิตในป่าระยะหนึ่ง', 'move vit+1'] },
    { l: 'ต่อต้านอย่างเปิดเผย', tags: ['fight', 'defy'], ax: { brave: 1, temper: 1 }, chk: ['mag', 13], ok: ['พิธีถูกยกเลิก! {race}คนอื่นเริ่มมองเป็นผู้นำ', 'fame+8 belief-5 +flag:rebel'], ng: ['ถูกราดน้ำมนต์ ผิวไหม้', 'hp-25 belief-10'] },
  ] },
  { id: 'race_halfling_meal', tone: 'comedy', w: 4, c: { race: ['halfling'] }, t: 'นี่คือมื้อที่[ห้า|หก|เจ็ด]ของวัน และ {name} ยังหิวอยู่', e: 'vit+1 gold-3' },
  { id: 'race_beast_moon', tone: 'grim', w: 3, c: { race: ['beast'] }, t: 'คืนจันทร์เต็มดวง สัญชาตญาณสัตว์ใน {name} คลุ้มคลั่ง', ch: [
    { l: 'ปล่อยให้สัญชาตญาณนำ', tags: ['risk', 'fight'], ax: { temper: 1 }, ok: ['ตื่นมากลางป่าพร้อมกวางสามตัว', 'pow+1 kind-3'] },
    { l: 'มัดตัวเองไว้กับต้นไม้', tags: ['safe'], ax: { temper: -1 }, chk: ['vit', 11], ok: ['ผ่านคืนนั้นไปได้อย่างปลอดภัย', 'temper-5'], ng: ['เชือกขาด ทำลายแผงลอยในตลาด', 'gold-15 fame-3'] },
  ] },
  { id: 'race_darkelf_politics', tone: 'dark', w: 3, c: { race: ['darkelf'], stage: ['adult'] }, t: 'มารดาแห่งตระกูลส่งยาพิษมาให้ {name} พร้อมจดหมาย "จัดการพี่สาวของเจ้า แล้วตำแหน่งทายาทจะเป็นของเจ้า"', ch: [
    { l: 'ทำตาม', tags: ['greed', 'selfish'], ax: { kind: -1, ambition: 1 }, chk: ['int', 13], ok: ['ได้เป็นทายาทตระกูล', 'gold+60 fame+6 karma-8 +flag:noble'], ng: ['พี่สาวรู้ทัน ตอนนี้เป็นศัตรูกันแล้ว', 'rel:+nemesis hp-10'] },
    { l: 'เตือนพี่สาว', tags: ['help', 'trust'], ax: { kind: 1 }, ok: ['ทั้งคู่ร่วมมือกันหนีออกจากเมือง', 'move rel:+friend karma+4'] },
  ] },
  { id: 'clim_desert_storm', tone: 'grim', w: 4, c: { climate: ['desert'] }, t: 'พายุทรายแดงพัดถล่ม{town} {name} อยู่กลางทางคาราวาน', ch: [
    { l: 'ฝ่าพายุต่อไป', tags: ['risk', 'defy'], ax: { brave: 1 }, chk: ['vit', 13], bonusTag: ['heat_res', 'navigator'], ok: ['ฝ่าไปได้และพบโอเอซิสลับ', 'gold+20 vit+1'], ng: ['หลงทางกลางทะเลทรายสามวัน', 'hp-30'] },
    { l: 'ขุดหลุมหลบรอ', tags: ['safe', 'stay'], chk: ['int', 10], ok: ['รอดมาได้อย่างปลอดภัย', ''], ng: ['ทรายฝังจนเกือบหายใจไม่ออก', 'hp-15'] },
  ] },
  { id: 'clim_frozen_winter', tone: 'grim', w: 4, c: { climate: ['frozen'] }, t: 'ฤดูหนาวยาวนานผิดปกติ ฟืนเริ่มหมด หมาป่าหิวโซเดินวนรอบหมู่บ้าน', ch: [
    { l: 'ออกล่าสัตว์ในพายุหิมะ', tags: ['risk', 'help'], ax: { brave: 1, kind: 1 }, chk: ['vit', 13], bonusTag: ['cold_res'], ok: ['ได้เนื้อกวางมาเลี้ยงทั้งหมู่บ้าน', 'fame+5 karma+3'], ng: ['นิ้วเท้าหลุดไปสองนิ้วเพราะหิมะกัด', 'hp-25 spd-1'] },
    { l: 'เก็บเสบียงไว้ให้ครอบครัวตัวเอง', tags: ['selfish', 'safe'], ax: { kind: -1 }, ok: ['ครอบครัวรอด แต่บ้านข้าง ๆ เงียบไปหลังเดือนนั้น', 'kind-5 karma-2'] },
  ] },
  { id: 'clim_volcano', tone: 'dark', w: 3, c: { climate: ['volcanic'] }, t: 'ภูเขาไฟปะทุ! ลาวาไหลลงสู่{town}', ch: [
    { l: 'ช่วยอพยพชาวบ้าน', tags: ['help', 'risk'], ax: { kind: 1, brave: 1 }, chk: ['spd', 13], bonusTag: ['fire_res'], ok: ['พาชาวบ้านหนีได้หลายสิบคน', 'fame+10 karma+5'], ng: ['ถูกเถ้าร้อนลวก', 'hp-35 karma+3'] },
    { l: 'คว้าของมีค่าแล้ววิ่ง', tags: ['flee', 'greed'], ok: ['รอดพร้อมทรัพย์สิน', 'gold+10 move'] },
  ] },
  { id: 'clim_island_storm', tone: 'grim', w: 4, c: { climate: ['islands'] }, t: 'มรสุมพัดกระหน่ำเกาะ เรือประมงลำหนึ่งยังไม่กลับเข้าฝั่ง', ch: [
    { l: 'ออกเรือไปช่วย', tags: ['help', 'risk'], ax: { brave: 1, kind: 1 }, chk: ['vit', 13], bonusTag: ['sea', 'water_breath'], ok: ['ช่วยลูกเรือได้ครบทุกคน!', 'fame+8 karma+4'], ng: ['เรือคว่ำ ลอยคออยู่สองวัน', 'hp-30'] },
    { l: 'จุดไฟบนหน้าผาเป็นสัญญาณ', tags: ['help', 'safe'], ok: ['เรือเห็นแสงไฟและกลับเข้าฝั่งได้', 'karma+2 fame+2'] },
  ] },
  { id: 'clim_tropical_disease', tone: 'grim', w: 3, c: { climate: ['tropical'] }, t: 'ไข้ป่ากำเริบหลังฤดูฝน {name} ตัวร้อนจนเห็นภาพหลอน', ch: [
    { l: 'กินสมุนไพรตามตำรายาย', tags: ['stay', 'trust'], chk: ['luk', 11], bonusTag: ['heal', 'plague_res'], ok: ['หายเป็นปลิดทิ้ง', 'vit+1'], ng: ['ยายเอาสูตรผิด…', 'hp-20'] },
    { l: 'เดินทางไปหาหมอในเมือง', tags: ['travel', 'safe'], ok: ['หายป่วย แต่หมดเงินไปพอสมควร', 'gold-15'] },
  ] },
  { id: 'clim_dislike', tone: 'grim', w: 3, c: { flag: ['uncomfortable'] }, t: 'ภูมิอากาศที่นี่ไม่เหมาะกับ{race}เลย {name} รู้สึกอ่อนเพลียทุกวัน', ch: [
    { l: 'ย้ายไปที่ที่เหมาะกว่า', tags: ['travel'], ok: ['ออกเดินทางหาบ้านใหม่', 'move'] },
    { l: 'อดทนอยู่ต่อ', tags: ['stay', 'defy'], chk: ['vit', 12], ok: ['ร่างกายเริ่มปรับตัวได้', 'vit+1 -flag:uncomfortable'], ng: ['ป่วยเรื้อรัง', 'hp-15'] },
  ] },

  // ================= คำสาปตลก/เฉพาะแท็ก =================
  { id: 'tag_fart', tone: 'comedy', w: 6, c: { tag: ['fart_lie'], stage: ['teen', 'adult', 'elder'] }, t: 'ต่อหน้าเจ้าเมือง {name} ถูกถามว่า "เจ้าเคยขโมยของหรือไม่?"', ch: [
    { l: 'โกหกว่าไม่เคย', tags: ['risk'], ax: { honest: -1 }, ok: ['ปู้ดดดด… ทั้งห้องเงียบกริบ', 'fame-5 +flag:infamous_fart'] },
    { l: 'สารภาพตามจริง', tags: ['safe'], ax: { honest: 1 }, ok: ['เจ้าเมืองชื่นชมความซื่อสัตย์', 'fame+2 honest+5'] },
  ] },
  { id: 'tag_bird', tone: 'comedy', w: 5, c: { tag: ['bird_target'] }, t: 'วันสำคัญของ {name} [งานแต่งงานของเพื่อน|การสัมภาษณ์เข้ากิลด์|พิธีรับยศ] นกพิราบสิบสองตัวบินผ่าน…', e: 'fame-1 luk+0' },
  { id: 'tag_chicken', tone: 'comedy', w: 5, c: { tag: ['chicken'] }, t: 'วันอาทิตย์อีกแล้ว {name} ในร่างไก่ถูกแม่ครัวจับใส่กรง', ch: [
    { l: 'จิกแล้วหนี', tags: ['fight', 'flee'], chk: ['spd', 11], ok: ['หนีรอดพร้อมขนร่วง', ''], ng: ['เกือบลงหม้อ วันจันทร์ตื่นมาในหม้อซุปเย็นชืด', 'hp-10'] },
    { l: 'ออกไข่เพื่อเอาตัวรอด', tags: ['safe'], ok: ['ได้ไข่ทองคำหนึ่งฟอง?!', 'gold+30'] },
  ] },
  { id: 'tag_rhyme', tone: 'comedy', w: 5, c: { tag: ['rhyme'], stage: ['teen', 'adult'] }, t: '{name} ต้องเจรจาสงบศึกกับเผ่าข้างเคียง แต่พูดได้แค่เป็นกลอน', ch: [
    { l: 'แต่งกลอนสุดฝีมือ', tags: ['risk', 'learn'], chk: ['int', 12], ok: ['ผู้นำเผ่าซึ้งจนน้ำตาไหล สงบศึกสำเร็จ!', 'fame+8 karma+3'], ng: ['สัมผัสผิด กลายเป็นด่าแม่ผู้นำเผ่า', 'hp-15 fame-5'] },
  ] },
  { id: 'tag_dance', tone: 'comedy', w: 4, c: { tag: ['dance'] }, t: 'วงดนตรีเล่นเพลงในงานศพ{npc} และ {name} ห้ามขาตัวเองไม่ได้…', e: 'fame-3 spd+1' },
  { id: 'tag_sneeze', tone: 'comedy', w: 4, c: { tag: ['sneeze_fire'] }, t: 'ฤดูเกสรดอกไม้มาถึง {name} จามแรงจน[โรงนา|ประตูเมือง|หนวดของนายกเทศมนตรี]ลุกเป็นไฟ', e: 'gold-15 fame-2 mag+1' },
  { id: 'tag_haunted', tone: 'dark', w: 4, c: { tag: ['haunted'] }, t: 'เสียงเคาะประตูสามครั้งทุกคืนตอนตีสาม คืนนี้มีเสียงกระซิบชื่อ "{name}" ตามมา', ch: [
    { l: 'เปิดประตู', tags: ['risk', 'learn'], ax: { brave: 1, curious: 1 }, chk: ['luk', 13], ok: ['เป็นวิญญาณบรรพบุรุษมาบอกที่ซ่อนสมบัติ', 'gold+40'], ng: ['มือเย็นเฉียบดึงข้อเท้า', 'hp-20 brave-5'] },
    { l: 'คลุมโปงสวดมนต์', tags: ['pray', 'safe'], ax: { piety: 1 }, ok: ['เสียงเงียบไปตอนรุ่งสาง', 'belief+5'] },
  ] },
  { id: 'tag_lycan', tone: 'dark', w: 5, c: { tag: ['lycan'] }, t: 'คืนจันทร์เต็มดวง กระดูกของ {name} เริ่มบิดเบี้ยว ขนงอกเต็มตัว', ch: [
    { l: 'วิ่งเข้าป่าลึกให้ห่างผู้คน', tags: ['flee', 'help'], ax: { kind: 1 }, chk: ['spd', 12], ok: ['ตื่นมาเปลือยกายกลางป่า แต่ไม่มีใครบาดเจ็บ', 'karma+2'], ng: ['ไม่ทัน… ตื่นมาพบเลือดเต็มมือ', 'karma-8 +flag:wanted kill'] },
    { l: 'ยอมรับพลังหมาป่า', tags: ['fight', 'greed'], ax: { kind: -1 }, ok: ['ล่าในความมืดอย่างมีความสุข', 'pow+1 kind-10 kill'] },
  ] },
  { id: 'tag_madness', tone: 'dark', w: 4, c: { tag: ['madness'] }, t: 'เสียงในหัวของ {name} พูดว่า "[เผาทุกอย่าง|พวกเขากำลังวางแผนฆ่าเจ้า|เทพไม่มีจริง|กินเทียนไขสิ]"', ch: [
    { l: 'ต่อต้านเสียงนั้น', tags: ['defy', 'safe'], chk: ['int', 12], ok: ['สติกลับคืนมาชั่วขณะ', 'int+0'], ng: ['ทำตามเสียงไปครึ่งหนึ่ง…', 'fame-5 hp-10'] },
    { l: 'ฟังเสียงนั้น', tags: ['risk'], ok: ['บางครั้งความบ้าก็นำไปสู่อัจฉริยะ', 'mag+1 int-1'] },
  ] },
  { id: 'tag_wanted', tone: 'grim', w: 4, c: { flag: ['wanted'] }, t: 'นักล่าค่าหัวพบตัว {name} แล้ว! ใบประกาศจับติดอยู่ทั่วเมือง', ch: [
    { l: 'สู้', tags: ['fight'], ax: { brave: 1 }, chk: ['pow', 13], ok: ['นักล่าค่าหัวถอยหนี', 'fame+3 kill'], ng: ['ถูกฟันจนบาดเจ็บสาหัส', 'hp-30'] },
    { l: 'หนีข้ามพรมแดน', tags: ['flee', 'travel'], chk: ['spd', 12], ok: ['หนีพ้นและเริ่มต้นใหม่ในต่างแดน', 'move:far -flag:wanted'], ng: ['ถูกจับได้ที่ด่าน ต้องจ่ายค่าไถ่ตัว', 'gold-50 -flag:wanted'] },
  ] },
  { id: 'tag_love_doom', tone: 'dark', w: 6, c: { tag: ['love_doom'], rel: 'lover' }, t: '{lover} ล้มป่วยด้วยโรคประหลาดที่ไม่มีหมอคนไหนรักษาได้… คำสาปทำงานแล้ว', e: 'relkill:lover kind-10 +flag:widowed' },

  // ================= ครอบครัว / ความรัก =================
  { id: 'love_meet', tone: 'warm', w: 5, c: { stage: ['adult'], noRel: 'lover', married: false }, t: '{name} พบ {npc} ชาว{raceNpc}ที่[ตลาดดอกไม้|สนามประลอง|ห้องสมุด|ใต้ต้นไม้ระหว่างหลบฝน] ทั้งคู่คุยกันจนลืมเวลา', ch: [
    { l: 'ชวนไปเดตครั้งแรก', tags: ['love', 'risk'], ax: { social: 1, brave: 1 }, chk: ['luk', 11], bonusTag: ['charm', 'beauty', 'true_love'], ok: ['เดตครั้งแรกจบลงด้วยรอยยิ้ม', 'rel:+lover'], ng: ['{npc} มีคนรักอยู่แล้ว', 'social-5'] },
    { l: 'ปล่อยให้เป็นความทรงจำ', tags: ['safe', 'stay'], ax: { social: -1 }, ok: ['บางครั้งก็นึกถึงอยู่เหมือนกัน', ''] },
  ] },
  { id: 'love_propose', tone: 'warm', w: 6, c: { stage: ['adult'], rel: 'lover', married: false }, t: '{lover} กับ {name} คบกันมานาน วันนี้ท้องฟ้าสวยเป็นพิเศษ', ch: [
    { l: 'ขอแต่งงาน', tags: ['love', 'stay'], ax: { social: 1 }, chk: ['luk', 9], bonusTag: ['true_love', 'loyal_love'], ok: ['{lover} ร้องไห้แล้วตอบตกลง! งานแต่งจัดอย่างอบอุ่น', 'marry fame+2'], ng: ['{lover} ขอเวลาคิดก่อน', ''] },
    { l: 'ยังไม่พร้อม', tags: ['safe', 'travel'], ax: { social: -1 }, ok: ['ความสัมพันธ์ยังดำเนินต่อไป', ''] },
    { l: 'เลิกรา', tags: ['selfish', 'travel'], ax: { kind: -1 }, ok: ['ต่างคนต่างไป', 'relkill:lover'] },
  ] },
  { id: 'love_flirt', tone: 'comedy', w: 4, c: { stage: ['adult'], tag: ['flirt'], married: true }, t: '{name} แอบส่งจดหมายรักให้ {npc} แต่ส่งผิดไปถึงมือ {spouse}', ch: [
    { l: 'สารภาพผิด', tags: ['trust', 'love'], ax: { honest: 1 }, chk: ['luk', 12], ok: ['{spouse} ให้อภัย… แต่ไม่ลืม', 'honest+5'], ng: ['{spouse} เก็บของออกจากบ้าน', 'relkill:spouse fame-3'] },
    { l: 'แก้ตัวว่าเป็นกลอนฝึกเขียน', tags: ['risk'], ax: { honest: -1 }, chk: ['int', 13], ok: ['{spouse} เชื่อ (หรือแกล้งเชื่อ)', ''], ng: ['ถูกตบจนหูอื้อ', 'hp-5'] },
  ] },
  { id: 'family_child', tone: 'warm', w: 6, c: { stage: ['adult'], married: true, age: [18, 50] }, t: 'ครอบครัวของ {name} และ {spouse} มีสมาชิกใหม่! เสียงร้องไห้ของทารกดังไปทั้งบ้าน', e: 'child kind+5' },
  { id: 'family_child2', tone: 'warm', w: 3, c: { stage: ['adult'], married: true, age: [20, 50], tag: ['fertile'] }, t: 'ฝาแฝด! บ้านของ {name} ไม่เคยเงียบอีกเลย', e: 'child child' },
  { id: 'family_child_trouble', tone: 'comedy', w: 4, c: { stage: ['adult', 'elder'], flag: ['has_child'] }, t: '{child} ลูกของ {name} [แอบเอามังกรน้อยมาเลี้ยงในห้อง|ระเบิดห้องเรียนเวท|หนีไปเป็นโจรสลัดสามวันแล้วกลับมา|ประกาศว่าจะแต่งงานกับเอลฟ์อายุ 400 ปี]', ch: [
    { l: 'ดุอย่างหนัก', tags: ['stay'], ax: { temper: 1 }, ok: ['{child} งอนไปหนึ่งสัปดาห์', ''] },
    { l: 'หัวเราะแล้วสนับสนุน', tags: ['love', 'risk'], ax: { kind: 1 }, ok: ['{child} กอดแน่น "พ่อแม่ที่ดีที่สุด!"', 'kind+5'] },
  ] },
  { id: 'family_spouse_sick', tone: 'dark', w: 2, c: { stage: ['adult', 'elder'], married: true, age: [35, 90] }, t: '{spouse} ป่วยหนัก หมอบอกว่าอาจอยู่ได้อีกไม่นาน', ch: [
    { l: 'ออกตามหายาวิเศษ', tags: ['travel', 'risk', 'love'], ax: { kind: 1, brave: 1 }, chk: ['luk', 14], ok: ['พบยาวิเศษทันเวลา! {spouse} หายดี', 'karma+3 fame+3'], ng: ['กลับมาไม่ทัน… {spouse} จากไปแล้ว', 'relkill:spouse +flag:widowed'] },
    { l: 'อยู่ข้างเตียงจนวาระสุดท้าย', tags: ['stay', 'love'], ok: ['{spouse} จากไปอย่างสงบโดยมีมือของ {name} กุมไว้', 'relkill:spouse kind+10 +flag:widowed'] },
  ] },
  { id: 'family_child_leave', tone: 'warm', w: 3, c: { stage: ['elder', 'adult'], flag: ['has_child'], age: [40, 90] }, t: '{child} โตเป็นผู้ใหญ่และออกเดินทางสร้างชีวิตของตัวเอง', e: 'kind+3' },
  { id: 'nemesis_return', tone: 'dark', w: 4, c: { stage: ['adult', 'elder'], rel: 'nemesis' }, t: '{nemesis} ศัตรูคู่อาฆาตกลับมาแล้ว พร้อมกองกำลังและความแค้นที่สะสมมาหลายปี', ch: [
    { l: 'เผชิญหน้าตรง ๆ', tags: ['fight', 'defy'], ax: { brave: 1 }, chk: ['pow', 14], bonusTag: ['combat', 'leader'], ok: ['ปิดบัญชีแค้นได้สำเร็จ! {nemesis} พ่ายแพ้ไปตลอดกาล', 'relkill:nemesis fame+12 kill'], ng: ['บาดเจ็บสาหัส {nemesis} หัวเราะแล้วจากไป "ครั้งหน้าเจ้าตาย"', 'hp-35'] },
    { l: 'วางกับดัก', tags: ['risk', 'distrust'], ax: { honest: -1 }, chk: ['int', 13], ok: ['{nemesis} ติดกับดักและถูกจับ', 'relkill:nemesis fame+6'], ng: ['กับดักไม่ทำงาน ต้องหนีหัวซุกหัวซุน', 'hp-15 move'] },
    { l: 'เสนอคืนดี', tags: ['help', 'trust'], ax: { kind: 1, temper: -1 }, chk: ['luk', 15], bonusTag: ['peace', 'charm'], ok: ['หลังการพูดคุยทั้งคืน ความแค้นสลายไป', 'relkill:nemesis karma+6 rel:+friend'], ng: ['{nemesis} ใช้โอกาสนั้นแทงข้างหลัง', 'hp-30'] },
  ] },

  // ================= วัยชรา =================
  { id: 'elder_story', tone: 'warm', w: 5, c: { stage: ['elder'] }, t: 'เด็ก ๆ ในหมู่บ้านล้อมวงฟัง {name} เล่าเรื่อง[การผจญภัยในวัยหนุ่มสาว|มังกรที่เคยเห็น|ความรักครั้งแรก|เทพผู้คอยเฝ้ามอง]', e: 'fame+3 kind+3' },
  { id: 'elder_illness', tone: 'grim', w: 5, c: { stage: ['elder'] }, t: 'ข้อเข่าเสื่อม ตาฝ้าฟาง {name} ล้มป่วยบ่อยขึ้นเรื่อย ๆ', e: 'hp-15 vit-1' },
  { id: 'elder_will', tone: 'warm', w: 3, c: { stage: ['elder'], flag: ['has_child'] }, t: '{name} เขียนพินัยกรรมไว้ให้ลูกหลาน พร้อมคำสอนที่สำคัญที่สุดในชีวิต', e: 'karma+2 +flag:will' },
  { id: 'elder_regret', tone: 'dark', w: 3, c: { stage: ['elder'] }, t: 'ในคืนที่นอนไม่หลับ {name} นึกถึงความผิดพลาดในอดีต', ch: [
    { l: 'ออกเดินทางไปขอโทษคนที่เคยทำร้าย', tags: ['travel', 'help'], ax: { kind: 1 }, ok: ['ได้รับการให้อภัย ใจเบาสบาย', 'karma+5 hp-5'] },
    { l: 'ปล่อยวาง', tags: ['stay'], ok: ['อดีตก็คืออดีต', ''] },
  ] },
  { id: 'elder_teach', tone: 'warm', w: 3, c: { stage: ['elder'], minStat: { int: 11 } }, t: 'คนหนุ่มสาวมาขอให้ {name} สอนวิชาที่สั่งสมมาทั้งชีวิต', e: 'fame+5 karma+3' },
  { id: 'elder_last_adventure', tone: 'grim', w: 2, c: { stage: ['elder'], axis: { brave: 20 } }, t: '{name} ในวัยชราได้ยินข่าวมังกรตื่นที่ภูเขาใกล้เมือง ดาบเก่าบนผนังสั่นเบา ๆ', ch: [
    { l: 'ออกผจญภัยครั้งสุดท้าย', tags: ['fight', 'risk'], ax: { brave: 2 }, chk: ['pow', 15], ok: ['ตำนานบทสุดท้าย: ผู้เฒ่าล้มมังกร!', 'fame+25 kill'], ng: ['ร่างกายไม่ไหวเหมือนเดิม…', 'hp-50 fame+5'] },
    { l: 'ปล่อยให้คนรุ่นใหม่จัดการ', tags: ['safe', 'stay'], ok: ['จิบชาดูควันลอยจากภูเขา', ''] },
  ] },
  { id: 'elder_garden', tone: 'warm', w: 4, c: { stage: ['elder'] }, t: '{name} ใช้เวลาว่างปลูก[ดอกกุหลาบ|ผักกาด|สมุนไพร|ต้นไม้ที่จะโตเกินอายุของตัวเอง]', e: 'vit+0 hp+10' },

  // ================= ประเทศ / โลก =================
  { id: 'world_war_draft', tone: 'dark', w: 6, c: { stage: ['adult', 'teen'], countryFlag: 'war', notFlag: ['veteran'] }, t: 'สงครามประกาศแล้ว! ทหารเคาะประตูบ้าน {name} พร้อมหมายเรียก', ch: [
    { l: 'ไปรบ', tags: ['fight', 'stay'], ax: { brave: 1 }, chk: ['pow', 13], bonusTag: ['combat'], ok: ['รอดจากสงครามพร้อมเหรียญกล้าหาญ', 'fame+10 +flag:veteran kill gold+30 chain:chain_war_comrade'], ng: ['บาดเจ็บสาหัสกลับบ้าน', 'hp-40 +flag:veteran'] },
    { l: 'หนีทหาร', tags: ['flee', 'travel'], ax: { brave: -1 }, chk: ['spd', 12], ok: ['หนีพ้นข้ามแดน', 'move:far'], ng: ['ถูกจับได้ ถูกส่งไปแนวหน้าสุด', 'hp-30 +flag:veteran'] },
    { l: 'ช่วยสร้างเสบียงอยู่แนวหลัง', tags: ['help', 'safe'], ax: { kind: 1 }, ok: ['ทำงานหนักเลี้ยงกองทัพ', 'vit+1 +flag:veteran'] },
  ] },
  { id: 'world_plague', tone: 'dark', w: 6, c: { countryFlag: 'plague' }, t: 'โรคระบาดคร่าชีวิตผู้คนใน{place} ศพกองอยู่ตามถนน', ch: [
    { l: 'ช่วยดูแลผู้ป่วย', tags: ['help', 'risk'], ax: { kind: 1 }, chk: ['vit', 13], bonusTag: ['heal', 'plague_res'], ok: ['ช่วยชีวิตผู้คนได้มาก และไม่ติดโรค', 'karma+6 fame+6'], ng: ['ติดโรคและทรุดหนัก', 'hp-35 karma+4'] },
    { l: 'กักตัวอยู่บ้าน', tags: ['safe', 'stay'], chk: ['luk', 10], ok: ['รอดพ้นไปได้', ''], ng: ['โรคเข้ามาถึงบ้านจนได้', 'hp-25'] },
    { l: 'หนีออกจากประเทศ', tags: ['flee', 'travel'], ok: ['เดินทางไปที่ปลอดภัยกว่า', 'move'] },
  ] },
  { id: 'world_golden', tone: 'warm', w: 4, c: { countryFlag: 'golden' }, t: '{place}กำลังรุ่งเรือง ตลาดคึกคัก ทุกคนยิ้มแย้ม', e: 'gold+20 luk+0' },
  { id: 'world_famine', tone: 'grim', w: 5, c: { countryFlag: 'famine', stage: ['adult', 'elder'] }, t: 'ความอดอยากแผ่ไปทั่ว{place} ราคาขนมปังแพงกว่าทองคำ', ch: [
    { l: 'แบ่งเสบียงให้เพื่อนบ้าน', tags: ['help'], ax: { kind: 1 }, ok: ['เพื่อนบ้านไม่มีวันลืมบุญคุณ', 'gold-15 karma+4 fame+3'] },
    { l: 'กักตุนและขายราคาสูง', tags: ['greed', 'selfish'], ax: { kind: -1, ambition: 1 }, ok: ['ร่ำรวยบนความทุกข์ของผู้อื่น', 'gold+50 karma-6 fame-4'] },
  ] },
  { id: 'world_demon_raid', tone: 'dark', w: 3, c: { stage: ['adult'], flag: ['demon_king_awake'] }, t: 'กองทัพปีศาจบุกโจมตี{town}! ไฟลุกโชนทั่วเมือง', ch: [
    { l: 'สู้เพื่อเมือง', tags: ['fight', 'help'], ax: { brave: 1, kind: 1 }, chk: ['pow', 15], bonusTag: ['holy', 'light', 'demon_bane'], ok: ['ขับไล่ปีศาจได้! ชื่อ {name} ถูกจารึกไว้', 'fame+15 kill karma+4'], ng: ['เมืองแตก รอดมาอย่างหวุดหวิด', 'hp-40 move'] },
    { l: 'พาผู้คนหนี', tags: ['flee', 'help'], ax: { kind: 1 }, chk: ['spd', 12], ok: ['พาชาวเมืองร้อยคนหนีรอด', 'karma+5 fame+5 move'], ng: ['หนีรอดแต่ทิ้งหลายคนไว้ข้างหลัง', 'move kind-5'] },
  ] },

  // ================= เกี่ยวกับเทพ =================
  { id: 'god_temple', tone: 'warm', w: 2, c: { stage: ['adult'], belief: 50 }, t: '{name} เสนอให้ชาวบ้านสร้างศาลเล็ก ๆ ถวายแด่ "{god}" ผู้คอยเฝ้ามอง', e: 'faith+10 belief+5 fame+3' },
  { id: 'god_prophet', tone: 'warm', w: 3, c: { stage: ['adult', 'elder'], belief: 80, notFlag: ['prophet'] }, t: '{name} ได้ยินเสียงของ{god}ชัดเจนเป็นครั้งแรก ผู้คนเริ่มมารวมตัวฟังคำเทศนา', ch: [
    { l: 'ประกาศศาสนาใหม่', tags: ['pray', 'risk'], ax: { piety: 1, social: 1 }, ok: ['ศาสนาแห่ง{god}ถือกำเนิด! ศรัทธาไหลเข้ามาไม่ขาดสาย', '+flag:prophet faith+30 fame+15 job:prophet'] },
    { l: 'เก็บเป็นความลับ', tags: ['safe', 'stay'], ok: ['ความศรัทธายังคงอยู่ในใจเงียบ ๆ', 'belief+5'] },
  ] },
  { id: 'god_hunter', tone: 'dark', w: 3, c: { stage: ['adult', 'elder'], belief: -70, wronged: true, notFlag: ['godhunter'] }, t: '{name} สาบานต่อหน้าแท่นบูชาที่ถูกทุบทำลาย "ข้าจะตามล่าเทพที่เล่นตลกกับชีวิตข้า แม้จะต้องปีนขึ้นสวรรค์"', e: '+flag:godhunter dread+15 brave+10 job:godslayer' },
  { id: 'god_rival_demonking', tone: 'dark', w: 2, c: { stage: ['teen', 'adult'], notFlag: ['demon_offer'] }, t: 'ในความฝัน เสียงทุ้มต่ำกระซิบ "ข้าคือราชาปีศาจ เทพของเจ้าไม่สนใจเจ้าหรอก มาเป็นของข้าสิ"', ch: [
    { l: 'ปฏิเสธ', tags: ['pray', 'defy'], ax: { piety: 1 }, ok: ['ตื่นขึ้นพร้อมเหงื่อท่วมตัว', '+flag:demon_offer belief+5'] },
    { l: 'รับข้อเสนอ', tags: ['greed', 'risk'], ax: { piety: -1, ambition: 1 }, ok: ['พลังมืดไหลเข้าร่าง… และความเชื่อในเทพองค์เดิมก็เลือนหาย', '+flag:demon_offer curse:c_demoneye mag+2 belief-25 dread+10'] },
  ] },
  { id: 'god_miracle_seen', tone: 'warm', w: 2, c: { flag: ['saw_miracle'] }, t: 'ชาวบ้านยังพูดถึงปาฏิหาริย์ครั้งก่อน และหันมาถาม {name} ว่ารู้อะไรเกี่ยวกับเทพบ้าง', e: 'belief+5 faith+3 -flag:saw_miracle' },

  // ================= เหตุการณ์ชะตา (Fate) — important =================
  { id: 'fate_mentor', tone: 'warm', w: 0, important: true, t: 'ชายชราผู้มีแผลเป็นยาวพาดหน้า ยืนดูการฝึกของ {name} อยู่สามวัน ก่อนเอ่ยว่า "เจ้ามีแวว อยากเป็นศิษย์ข้าไหม?"', ch: [
    { l: 'คุกเข่าขอเป็นศิษย์', tags: ['learn', 'trust'], ax: { ambition: 1, curious: 1 }, ok: ['{npc} อดีตวีรชนผู้ลืมเลือน รับเป็นศิษย์คนสุดท้าย', 'rel:+mentor skill:random skill:random'] },
    { l: 'สงสัยในเจตนา', tags: ['distrust', 'safe'], ax: { curious: -1 }, ok: ['ชายชราหัวเราะแล้วหายไป ทิ้งตำราไว้หนึ่งเล่ม', 'skill:random'] },
    { l: 'ท้าประลองก่อน', tags: ['fight', 'defy'], ax: { brave: 1, temper: 1 }, chk: ['pow', 16], ok: ['ทำให้เขาถอยได้หนึ่งก้าว! เขาหัวเราะลั่นและรับเป็นศิษย์ทันที', 'rel:+mentor skill:random skill:random pow+1'], ng: ['ถูกทุ่มลงพื้นในพริบตา "ข้าชอบความกล้าของเจ้า"', 'rel:+mentor skill:random hp-10'] },
  ] },
  { id: 'fate_betrayal', tone: 'dark', w: 0, important: true, t: '{friend} เพื่อนที่ไว้ใจที่สุด ถูกพบว่ากำลังขายความลับของ {name} ให้ศัตรู', ch: [
    { l: 'เผชิญหน้าทันที', tags: ['fight', 'defy'], ax: { temper: 1, brave: 1 }, chk: ['spd', 13], ok: ['จับได้คาหนังคาเขา! {friend} ถูกเนรเทศ', 'relkill:friend fame+3'], ng: ['{friend} แทงข้างหลังแล้วหนีไป', 'hp-30 relkill:friend rel:+nemesis'] },
    { l: 'แสร้งไม่รู้แล้ววางแผนซ้อน', tags: ['distrust', 'risk'], ax: { honest: -1 }, chk: ['int', 14], ok: ['ใช้ข้อมูลปลอมย้อนศรศัตรูได้สำเร็จ', 'relkill:friend fame+6 gold+30'], ng: ['แผนรั่ว เสียทุกอย่าง', 'gold-50 relkill:friend'] },
    { l: 'ให้อภัย', tags: ['trust', 'help'], ax: { kind: 2 }, chk: ['luk', 14], ok: ['{friend} ร้องไห้สารภาพว่าถูกขู่ฆ่าครอบครัว ทั้งคู่ร่วมมือกันแก้ปัญหา', 'karma+8'], ng: ['{friend} หักหลังซ้ำสอง', 'gold-40 hp-20 relkill:friend rel:+nemesis'] },
  ] },
  { id: 'fate_love', tone: 'warm', w: 0, important: true, t: 'ในวันฝนพรำ {name} ยื่นร่มให้คนแปลกหน้าชาว{raceNpc}ชื่อ {npc} สายตาที่สบกันทำให้โลกหยุดหมุน', ch: [
    { l: 'ทำตามหัวใจ', tags: ['love', 'risk'], ax: { social: 1 }, ok: ['ความรักครั้งยิ่งใหญ่เริ่มต้นขึ้น', 'rel:+lover +flag:true_love'] },
    { l: 'ยังมีภารกิจที่สำคัญกว่า', tags: ['selfish', 'travel'], ax: { ambition: 1 }, ok: ['เดินจากไปพร้อมความรู้สึกว่าพลาดบางสิ่งไป', 'ambition+10'] },
  ] },
  { id: 'fate_war', tone: 'dark', w: 0, important: true, t: '{place}ประกาศสงครามกับประเทศเพื่อนบ้าน {name} ถูกเกณฑ์ไปแนวหน้า ศัตรูมีจำนวนมากกว่าสามเท่า', ch: [
    { l: 'บุกตะลุยแนวหน้า', tags: ['fight', 'risk'], ax: { brave: 2 }, chk: ['pow', 15], bonusTag: ['combat', 'berserk'], ok: ['ฝ่าแนวข้าศึกจนแตกพ่าย! ได้รับยศและเหรียญกล้าหาญ', 'fame+15 gold+50 kill +flag:veteran'], ng: ['ถูกหอกแทงทะลุไหล่', 'hp-45 +flag:veteran'] },
    { l: 'วางแผนยุทธศาสตร์', tags: ['learn', 'help'], ax: { curious: 1 }, chk: ['int', 14], bonusTag: ['leader'], ok: ['แผนซุ่มโจมตีสำเร็จ ช่วยชีวิตทหารหลายร้อย', 'fame+12 skill:leadership_1 karma+3 +flag:veteran'], ng: ['แผนผิดพลาด หน่วยแตก', 'hp-25 fame-5 +flag:veteran'] },
    { l: 'แอบหนีทัพ', tags: ['flee', 'selfish'], ax: { brave: -2 }, chk: ['spd', 12], ok: ['หนีรอดไปใช้ชีวิตใหม่ใต้ชื่อปลอม', 'move:far fame-5'], ng: ['ถูกจับ ข้อหาหนีทัพ', 'hp-20 +flag:wanted'] },
  ] },
  { id: 'fate_plague', tone: 'dark', w: 0, important: true, t: 'โรคระบาดสีดำแพร่มาถึง{town} คนที่ {name} รักเริ่มล้มป่วยทีละคน', ch: [
    { l: 'ออกตามหาวิธีรักษา', tags: ['learn', 'help', 'travel'], ax: { kind: 1, curious: 1 }, chk: ['int', 14], bonusTag: ['heal', 'alchemy', 'scholar'], ok: ['ค้นพบสูตรยารักษา! ช่วยทั้งเมืองไว้ได้', 'fame+20 karma+8 skill:healing_1'], ng: ['ยาไม่ได้ผล ร่างกายทรุดลงเพราะติดโรค', 'hp-40'] },
    { l: 'ดูแลคนที่รักจนถึงที่สุด', tags: ['love', 'stay'], ax: { kind: 1 }, chk: ['vit', 13], bonusTag: ['plague_res'], ok: ['ผ่านพ้นวิกฤตมาด้วยกัน', 'karma+4'], ng: ['ติดโรคไปด้วย', 'hp-45'] },
    { l: 'หนีเอาตัวรอด', tags: ['flee', 'selfish'], ax: { kind: -1 }, ok: ['รอดชีวิต แต่ไม่มีวันลืมเสียงที่เรียกชื่อตามหลัง', 'move kind-15 karma-4'] },
  ] },
  { id: 'fate_dragon', tone: 'dark', w: 0, important: true, t: 'มังกร[สีแดงเพลิง|สีดำนิล|สีทองอร่าม|สีครามแห่งพายุ]ลงจอดกลางจัตุรัสเมือง ลมหายใจร้อนแรงจนหินละลาย มันจ้องมาที่ {name} เพียงคนเดียว', ch: [
    { l: 'ชักอาวุธเข้าสู้', tags: ['fight', 'risk'], ax: { brave: 2 }, chk: ['pow', 18], bonusTag: ['dragon_bane', 'ice', 'hero_luck'], ok: ['ปาฏิหาริย์! ดาบปักเข้ากลางหัวใจมังกร ผู้ฆ่ามังกรคนใหม่ถือกำเนิด', 'fame+40 gold+150 kill +flag:dragonslayer'], ng: ['เปลวไฟมังกรกลืนกินร่าง…', 'hp-70'] },
    { l: 'พยายามพูดคุยกับมัน', tags: ['trust', 'learn'], ax: { curious: 1, kind: 1 }, chk: ['int', 15], bonusTag: ['polyglot', 'charm', 'dragon_blood'], ok: ['มังกรหัวเราะก้อง "มนุษย์คนแรกที่ไม่วิ่งหนี" มันยอมเป็นพันธมิตร', '+flag:dragon_bond fame+20 skill:taming_2'], ng: ['มังกรไม่เข้าใจ และหงุดหงิด', 'hp-40'] },
    { l: 'วิ่งหนี', tags: ['flee', 'safe'], ax: { brave: -1 }, chk: ['spd', 13], ok: ['รอดชีวิตมาได้ แต่เมืองถูกเผาวอด', 'move fame-3'], ng: ['หางมังกรฟาดกระเด็น', 'hp-45 move'] },
  ] },
  { id: 'fate_treasure', tone: 'warm', w: 0, important: true, t: 'ขณะขุดดินหลังบ้าน จอบของ {name} กระทบกับหีบเหล็กโบราณ ตราประทับบนฝาเป็นของราชวงศ์ที่ล่มสลาย', ch: [
    { l: 'เปิดดูทันที', tags: ['greed', 'risk'], ax: { curious: 1 }, chk: ['luk', 12], bonusTag: ['treasure', 'appraise'], ok: ['ทองคำ อัญมณี และมงกุฎที่ส่องแสง!', 'gold+200 fame+5'], ng: ['กับดักโบราณยังทำงาน! แต่ก็ได้ทองมาบ้าง', 'hp-25 gold+60 curse:random'] },
    { l: 'นำไปมอบให้วิหาร', tags: ['help', 'pray'], ax: { piety: 1, kind: 1 }, ok: ['นักบวชจัดพิธีขอบคุณ ผู้คนเล่าลือถึงความซื่อสัตย์', 'fame+12 karma+6 belief+10 bless:random'] },
  ] },
  { id: 'fate_throne', tone: 'grim', w: 0, important: true, t: 'กษัตริย์แห่ง{place}สิ้นพระชนม์โดยไร้รัชทายาท ขุนนางกลุ่มหนึ่งเสนอให้ {name} ชิงบัลลังก์', ch: [
    { l: 'ชิงบัลลังก์!', tags: ['greed', 'risk', 'fight'], ax: { ambition: 2 }, chk: ['int', 15], bonusTag: ['leader', 'charm', 'noble'], ok: ['ได้รับการสวมมงกุฎ! {name} คือกษัตริย์องค์ใหม่', '+flag:king fame+50 gold+200 job:noble'], ng: ['รัฐประหารล้มเหลว ต้องหนีหัวซุกหัวซุน', 'move:far +flag:wanted hp-20'] },
    { l: 'สนับสนุนผู้ที่เหมาะสมกว่า', tags: ['help', 'safe'], ax: { ambition: -1, kind: 1 }, ok: ['ได้รับแต่งตั้งเป็นขุนนางผู้ซื่อสัตย์', '+flag:noble fame+15 gold+50'] },
    { l: 'ไม่ยุ่งการเมือง', tags: ['safe', 'stay'], ok: ['สงครามกลางเมืองปะทุ แต่ {name} อยู่รอดปลอดภัย', ''] },
  ] },
  { id: 'fate_demon', tone: 'dark', w: 0, important: true, t: 'ปีศาจในรูปเด็กหญิงยิ้มหวานยื่นสัญญาที่เขียนด้วยเลือด "ลงชื่อสิ แล้วความปรารถนาทุกอย่างจะเป็นจริง"', ch: [
    { l: 'ลงชื่อ', tags: ['greed', 'risk'], ax: { ambition: 2, piety: -1 }, ok: ['พลังมหาศาลไหลเข้าร่าง… ราคาที่ต้องจ่ายจะมาทวงในภายหลัง', 'mag+3 pow+2 apt:contract curse:c_souldebt belief-20 dread+15'] },
    { l: 'ฉีกสัญญาทิ้ง', tags: ['defy', 'pray'], ax: { piety: 1, brave: 1 }, chk: ['mag', 13], bonusTag: ['holy', 'mind_ward'], ok: ['ปีศาจกรีดร้องและสลายเป็นควัน', 'belief+15 faith+10 fame+5'], ng: ['ปีศาจโกรธแค้นและสาปใส่', 'curse:random hp-15'] },
    { l: 'ต่อรองเงื่อนไข', tags: ['risk', 'learn'], ax: { honest: -1, curious: 1 }, chk: ['int', 16], ok: ['หลอกปีศาจได้! ได้พลังโดยไม่ต้องจ่าย', 'mag+2 skill:unique fame+5'], ng: ['ปีศาจเหนือกว่า ได้พลังแต่เสียมากกว่า', 'mag+1 curse:random curse:random'] },
  ] },
  { id: 'fate_trial', tone: 'warm', w: 0, important: true, t: 'แสงสีทองส่องลงมาจากฟ้า เสียงก้องกังวาน "บุตรแห่งดิน จงพิสูจน์ใจของเจ้า" เบื้องหน้าคือคนแปลกหน้าที่กำลังจมน้ำ และหีบทองคำที่กำลังจะลอยไป', ch: [
    { l: 'ช่วยคน', tags: ['help', 'risk'], ax: { kind: 2 }, ok: ['ผ่านบททดสอบ! แสงสวรรค์อาบร่าง', 'bless:random bless:random karma+10 belief+15'] },
    { l: 'คว้าหีบทอง', tags: ['greed', 'selfish'], ax: { kind: -2 }, ok: ['หีบนั้นว่างเปล่า… และแสงก็ดับลง', 'curse:random karma-10'] },
    { l: 'หาทางช่วยทั้งสองอย่าง', tags: ['risk', 'learn'], ax: { curious: 1, ambition: 1 }, chk: ['int', 15], ok: ['ใช้ไหวพริบได้ทั้งคู่! เสียงสวรรค์หัวเราะ "ฉลาดนัก"', 'bless:random gold+80 skill:random'], ng: ['สุดท้ายไม่ได้อะไรสักอย่าง คนจมน้ำถูกคนอื่นช่วยไว้', 'fame-3'] },
  ] },
  { id: 'fate_nemesis', tone: 'dark', w: 0, important: true, t: 'ชายสวมหน้ากากเหล็กปรากฏตัว "จำข้าได้ไหม {name}? เจ้าทำลายชีวิตข้า วันนี้ข้ามาทวงคืน"', ch: [
    { l: 'สู้จนตัวตาย', tags: ['fight', 'defy'], ax: { brave: 1 }, chk: ['pow', 15], bonusTag: ['combat'], ok: ['ชนะ! หน้ากากหลุดออก… เป็นคนที่ {name} จำไม่ได้ด้วยซ้ำ', 'fame+10 kill'], ng: ['พ่ายแพ้ ถูกทิ้งไว้ปางตาย', 'hp-50 rel:+nemesis'] },
    { l: 'ขอโทษสำหรับสิ่งที่อาจเคยทำ', tags: ['help', 'trust'], ax: { kind: 1, honest: 1 }, chk: ['luk', 13], bonusTag: ['peace', 'charm'], ok: ['ชายคนนั้นลดดาบลง น้ำตาไหลใต้หน้ากาก', 'karma+8'], ng: ['คำขอโทษยิ่งทำให้เขาเดือดดาล', 'hp-30 rel:+nemesis'] },
  ] },
  { id: 'fate_shipwreck', tone: 'grim', w: 0, important: true, t: 'เรือที่ {name} โดยสารชนหินโสโครกกลางพายุ เรือกำลังจะจม!', ch: [
    { l: 'ว่ายเข้าฝั่ง', tags: ['risk', 'defy'], ax: { brave: 1 }, chk: ['vit', 14], bonusTag: ['water_breath', 'sea'], ok: ['ว่ายถึงเกาะร้างแห่งหนึ่ง… ที่มีวิหารโบราณ', 'move:far skill:random'], ng: ['เกือบจมน้ำ คลื่นซัดมาเกยหาดต่างแดน', 'hp-40 move:far'] },
    { l: 'ช่วยผู้โดยสารคนอื่นก่อน', tags: ['help', 'risk'], ax: { kind: 2 }, chk: ['pow', 14], ok: ['ช่วยเด็กสามคนขึ้นเรือชูชีพได้', 'karma+8 fame+10 move:far'], ng: ['ช่วยได้หนึ่งคน แต่ตัวเองบาดเจ็บสาหัส', 'karma+6 hp-45 move:far'] },
    { l: 'แย่งเรือชูชีพ', tags: ['selfish', 'flee'], ax: { kind: -2 }, ok: ['รอดชีวิตคนเดียว', 'karma-10 move:far'] },
  ] },
  { id: 'fate_exile', tone: 'grim', w: 0, important: true, t: 'ข้อกล่าวหาเท็จทำให้ {name} ถูกตัดสินเนรเทศออกจาก{place}', ch: [
    { l: 'ยอมรับคำตัดสินแล้วจากไป', tags: ['travel', 'safe'], ok: ['เริ่มต้นชีวิตใหม่ในดินแดนห่างไกล', 'move:far'] },
    { l: 'สืบหาคนใส่ร้าย', tags: ['fight', 'learn', 'defy'], ax: { temper: 1, curious: 1 }, chk: ['int', 15], bonusTag: ['truth', 'seer'], ok: ['พิสูจน์ความบริสุทธิ์ได้! คนใส่ร้ายถูกลงโทษแทน', 'fame+12'], ng: ['ถูกเนรเทศและถูกตีตราว่าเป็นอาชญากร', 'move:far +flag:wanted'] },
  ] },
  { id: 'fate_summoned', tone: 'comedy', w: 0, important: true, t: 'วงเวทสีทองปรากฏใต้เท้า! {name} ถูกดูดไปยังห้องโถงใหญ่ เจ้าหญิงคุกเข่า "ท่านผู้กล้า ได้โปรดช่วยโลกของเราด้วย!"', ch: [
    { l: 'รับหน้าที่ผู้กล้า', tags: ['fight', 'help', 'risk'], ax: { brave: 1, kind: 1 }, ok: ['ได้รับดาบศักดิ์สิทธิ์และสถานะผู้ถูกเลือก!', '+flag:chosen weapon:holy skill:unique fame+20'] },
    { l: 'ขอค่าจ้างก่อน', tags: ['greed'], ax: { ambition: 1, honest: 1 }, ok: ['เจ้าหญิงงง แต่ก็จ่าย ได้ดาบด้วย', '+flag:chosen gold+100 weapon:holy'] },
    { l: 'ปฏิเสธ ขอกลับบ้าน', tags: ['safe', 'stay'], ax: { brave: -1 }, ok: ['ถูกส่งกลับ… แต่ลงผิดประเทศ', 'move:far skill:unique'] },
  ] },
  { id: 'fate_pastlife', tone: 'comedy', w: 0, important: true, t: 'จู่ ๆ {name} ก็จำได้ว่าชาติก่อนเคยเป็น[พนักงานออฟฟิศที่ถูกรถบรรทุกชน|นักวิจัยที่ทำงานจนตาย|เด็กมัธยมที่ถูกฟ้าผ่า|คนที่ตายตอนเล่นเกม] จากโลกอีกใบ', ch: [
    { l: 'ใช้ความรู้ชาติก่อนสร้างนวัตกรรม', tags: ['learn', 'greed'], ax: { curious: 1, ambition: 1 }, ok: ['ประดิษฐ์[ปั๊มน้ำ|สบู่|หมากรุก|มายองเนส] ทุกคนทึ่ง!', 'int+3 gold+30 fame+5 +flag:reincarnator'] },
    { l: 'เก็บเป็นความลับและฝึกฝนตั้งแต่เด็ก', tags: ['learn', 'safe'], ax: { ambition: 1 }, ok: ['ฝึกเวทตั้งแต่อายุสามขวบเหมือนพระเอกนิยาย', 'mag+3 skill:random skill:random +flag:reincarnator'] },
  ] },
  { id: 'fate_beast', tone: 'dark', w: 0, important: true, t: 'อสูรร้ายขนาดเท่าภูเขาบุกถล่ม{town} บ้านของ {name} อยู่ในเส้นทางของมัน', ch: [
    { l: 'ล่อมันออกไปจากเมือง', tags: ['fight', 'help', 'risk'], ax: { brave: 2, kind: 1 }, chk: ['spd', 15], ok: ['ล่อสำเร็จ! เมืองรอด และ {name} กลายเป็นวีรชน', 'fame+20 karma+8'], ng: ['ถูกอสูรเหยียบ… แต่เมืองรอด', 'hp-55 fame+15 karma+8'] },
    { l: 'พาครอบครัวหนี', tags: ['flee', 'love'], ok: ['รอดมาพร้อมครอบครัว เมืองพังพินาศ', 'move gold-30'] },
  ] },
  { id: 'fate_heir', tone: 'warm', w: 0, important: true, t: 'คืนที่ลูกของ {name} เกิด ดาวดวงใหม่ส่องสว่างบนฟ้า หมอตำแยตกใจจนทำกะละมังหล่น ทารกมีปานรูปดวงดาวบนหน้าผาก', e: 'child +flag:star_child fame+5' },
  { id: 'fate_dungeon', tone: 'grim', w: 0, important: true, t: 'ดันเจี้ยนใหม่เปิดขึ้นใกล้{town}! นักผจญภัยหลั่งไหลมา ปากทางมีป้ายเขียนว่า "ชั้น 1 จาก 100"', ch: [
    { l: 'ดำดิ่งลงไปให้ลึกที่สุด', tags: ['fight', 'risk', 'greed'], ax: { brave: 1, ambition: 1 }, chk: ['pow', 15], bonusTag: ['combat', 'magic'], ok: ['ถึงชั้น 50! ได้สมบัติระดับตำนาน', 'gold+150 fame+20 skill:unique kill'], ng: ['ติดกับดักชั้น 12 รอดมาได้แต่เจ็บหนัก', 'hp-45 gold+20'] },
    { l: 'เปิดร้านขายของหน้าดันเจี้ยน', tags: ['greed', 'safe'], ax: { ambition: 1 }, chk: ['int', 11], bonusTag: ['trade', 'cook'], ok: ['รวยกว่านักผจญภัยทุกคน!', 'gold+120'], ng: ['ขายไม่ออก ราคาถูกเกินไป', 'gold+10'] },
  ] },
  { id: 'fate_revolution', tone: 'grim', w: 0, important: true, t: 'ประชาชนลุกฮือโค่นล้มชนชั้นปกครองใน{place} ฝูงชนถือคบไฟเดินผ่านหน้าบ้าน {name}', ch: [
    { l: 'ร่วมปฏิวัติ', tags: ['fight', 'defy'], ax: { brave: 1, kind: 1 }, chk: ['luk', 13], ok: ['การปฏิวัติสำเร็จ! {name} ได้ตำแหน่งในสภาประชาชน', 'fame+15 +flag:rebel'], ng: ['ถูกกองทัพปราบปราม', 'hp-35 +flag:wanted'] },
    { l: 'ปกป้องราชวงศ์', tags: ['fight', 'stay'], ax: { honest: 1 }, chk: ['pow', 14], ok: ['ปราบกบฏได้ ได้รับบรรดาศักดิ์', '+flag:noble gold+60 karma-2'], ng: ['ฝ่ายกบฏชนะ ถูกไล่ออกจากประเทศ', 'move:far'] },
    { l: 'อยู่เงียบ ๆ', tags: ['safe'], ok: ['ผ่านพ้นความวุ่นวายไปได้', ''] },
  ] },
  { id: 'fate_demonking', tone: 'dark', w: 0, important: true, t: 'ราชาปีศาจคืนชีพ! ท้องฟ้าทั้งโลกกลายเป็นสีม่วง เสียงประกาศก้องไปทุกทวีป "โลกนี้จะเป็นของข้า"', ch: [
    { l: 'ออกเดินทางปราบราชาปีศาจ', tags: ['fight', 'help', 'travel', 'risk'], ax: { brave: 2, kind: 1 }, chk: ['pow', 19], bonusTag: ['holy', 'demon_bane', 'hero_luck', 'light'], ok: ['ราชาปีศาจพ่ายแพ้! {name} กลายเป็นตำนานที่จะถูกเล่าขานพันปี', 'fame+80 kill +flag:demonking_slayer karma+15'], ng: ['พ่ายแพ้ในศึกสุดท้าย แต่ช่วยซื้อเวลาให้ผู้กล้าคนอื่น', 'hp-80 fame+20 +flag:demon_king_awake'] },
    { l: 'เข้าร่วมกับราชาปีศาจ', tags: ['greed', 'selfish'], ax: { kind: -2, ambition: 2 }, ok: ['ได้รับตำแหน่งแม่ทัพปีศาจ', 'mag+3 pow+2 karma-20 belief-30 dread+25 curse:c_demonmark +flag:demon_king_awake'] },
    { l: 'ปกป้องบ้านเกิดเท่านั้น', tags: ['stay', 'help'], ax: { kind: 1 }, ok: ['สร้างป้อมปราการให้บ้านเกิด ผู้คนรอดชีวิตมากมาย', 'fame+10 karma+5 +flag:demon_king_awake'] },
  ] },
  { id: 'fate_apprentice', tone: 'warm', w: 0, important: true, t: 'เด็กกำพร้า{npc}คุกเข่าขอเป็นศิษย์ของ {name} ดวงตามุ่งมั่นแบบที่ {name} เคยมีเมื่อนานมาแล้ว', ch: [
    { l: 'รับเป็นศิษย์', tags: ['help', 'learn'], ax: { kind: 1 }, ok: ['ถ่ายทอดทุกสิ่งที่รู้ วิชาของ {name} จะไม่สูญหาย', 'rel:+child karma+5 fame+5 +flag:legacy'] },
    { l: 'ปฏิเสธ', tags: ['selfish', 'stay'], ok: ['เด็กเดินจากไป และหลายปีต่อมากลายเป็นคู่แข่งที่น่ากลัว', 'rel:+rival'] },
  ] },
];

STORYLETS.push(...CHAIN_STORYLETS, ...CONTEXT_STORYLETS, ...PEOPLE_STORYLETS, ...REGION_STORYLETS, ...DISASTER_STORYLETS);

export const storyletById = (id: string) => STORYLETS.find((s) => s.id === id);
