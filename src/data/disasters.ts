import type { Storylet } from '../sim/types';
import type { RegionEvent } from './people';

// Great happenings that can strike anywhere in the world, not tied to a land's faith or climate.
// `near` is the news when it hits a neighbouring land; `country` changes the struck land (flags are country flags, ticks).
export interface Disaster extends RegionEvent { near: string; coast?: boolean; country?: [string, number][]; danger?: number; tone: 'dark' | 'grim' | 'warm' }

export const DISASTERS: Disaster[] = [
  { id: 'dragon_raid', name: 'มังกรบุก', icon: 'dragon', flag: 'dragon_raid', dur: [4, 8], w: 3, tone: 'dark', danger: 2, text: 'มังกรเพลิงบินลงมาเผาเมืองต่าง ๆ ของ{c}', near: 'ควันไฟจากเมืองที่ถูกมังกรเผาใน{c}ลอยมาถึงที่นี่ ผู้อพยพเริ่มหลั่งไหลเข้ามา', story: 'disaster_dragon', thread: 'warrior' },
  { id: 'meteor', name: 'อุกกาบาตตก', icon: 'meteor', flag: 'meteor', dur: [8, 16], w: 2.5, tone: 'grim', danger: 1, text: 'อุกกาบาตยักษ์พุ่งตกกลาง{c} แสงสว่างกว่ากลางวัน', near: 'เสียงระเบิดจากอุกกาบาตที่ตกใน{c}ดังมาถึงที่นี่ ฟ้าทางนั้นยังแดงฉาน', story: 'disaster_meteor', thread: 'arcane' },
  { id: 'alien', name: 'ผู้มาเยือนจากดวงดาว', icon: 'ufo', flag: 'alien', dur: [6, 12], w: 1.5, tone: 'grim', danger: 1, text: 'จานโลหะเรืองแสงลอยลงเหนือ{c} สิ่งมีชีวิตจากดวงดาวลักพาผู้คนและสัตว์ขึ้นไป', near: 'ผู้คนเห็นแสงประหลาดลอยวนเหนือ{c} ข่าวลือเรื่องคนหายไปกับลำแสงแพร่มาถึงที่นี่', story: 'disaster_alien', thread: 'arcane' },
  { id: 'titan', name: 'ไททันโบราณตื่น', icon: 'giant', flag: 'titan', dur: [6, 12], w: 1.5, tone: 'dark', danger: 2, text: 'ไททันสูงเท่าภูเขาตื่นจากใต้ดินของ{c} ทุกก้าวคือแผ่นดินไหว', near: 'พื้นดินสั่นทุกครั้งที่ไททันใน{c}ก้าวเดิน', story: 'disaster_titan', thread: 'hero' },
  { id: 'locust', name: 'ฝูงตั๊กแตนมหาภัย', icon: 'insect', flag: 'locust', dur: [4, 8], w: 2.5, tone: 'grim', country: [['famine', 12]], text: 'ฝูงตั๊กแตนนับพันล้านบดบังดวงอาทิตย์ กินไร่นาทั่ว{c}จนเกลี้ยง', near: 'ราคาข้าวพุ่งขึ้นเพราะตั๊กแตนกินไร่นาใน{c}จนหมด', story: 'disaster_locust' },
  { id: 'flood', name: 'น้ำท่วมใหญ่', icon: 'wave', flag: 'flood', dur: [4, 8], w: 2.5, tone: 'grim', text: 'ฝนตกสี่สิบวันสี่สิบคืน น้ำท่วมใหญ่ทั่ว{c}', near: 'ผู้คนจาก{c}ที่น้ำท่วมพายเรือมาขอที่พักพิง', story: 'disaster_flood' },
  { id: 'quake', name: 'แผ่นดินไหวใหญ่', icon: 'quake', flag: 'quake', dur: [3, 6], w: 2, tone: 'dark', danger: 1, text: 'แผ่นดินไหวครั้งใหญ่ในรอบพันปีถล่มเมืองทั่ว{c}', near: 'แรงสั่นจากแผ่นดินไหวใน{c}ทำให้ถ้วยชามที่นี่ตกแตก', story: 'disaster_quake' },
  { id: 'eclipse', name: 'สุริยคราสทมิฬ', icon: 'eclipse', flag: 'eclipse', dur: [3, 6], w: 2, tone: 'dark', danger: 2, text: 'ดวงอาทิตย์เหนือ{c}ดับลงกลางวัน สัตว์ประหลาดออกล่าในความมืด', near: 'ท้องฟ้าทางทิศของ{c}มืดลงกลางวันแสก ๆ', story: 'disaster_eclipse', thread: 'dark' },
  { id: 'magic_storm', name: 'พายุเวทมนตร์', icon: 'orb', flag: 'magic_storm', dur: [3, 6], w: 2, tone: 'grim', text: 'พายุเวทมนตร์สีรุ้งพัดผ่าน{c} สิ่งของลอยได้ สัตว์พูดได้ คนบางคนได้พลังแปลก ๆ', near: 'ลมที่พัดมาจาก{c}มีประกายสีรุ้งปนมา', story: 'disaster_magicstorm', thread: 'arcane' },
  { id: 'sky_whale', name: 'วาฬฟ้าผ่าน', icon: 'whale', flag: 'sky_whale', dur: [2, 4], w: 2, tone: 'warm', text: 'วาฬฟ้าขนาดเท่าเมืองว่ายผ่านเหนือ{c} โปรยละอองแสงนำโชค', near: 'มีคนเห็นวาฬฟ้าว่ายผ่านเหนือ{c} ว่ากันว่าเป็นลางดี', story: 'disaster_whale', thread: 'faithful' },
  { id: 'kraken', name: 'คราเคนโผล่', icon: 'tentacle', flag: 'kraken', dur: [4, 8], w: 2, tone: 'dark', coast: true, danger: 1, text: 'คราเคนยักษ์โผล่จากทะเลลึก ลากเรือทั้งกองของ{c}ลงใต้น้ำ', near: 'เรือจาก{c}ไม่กลับเข้าฝั่ง ชาวประมงเล่าถึงหนวดยักษ์', story: 'disaster_kraken', thread: 'warrior' },
];

const D = (flag: string) => ({ countryFlag: flag });
const ALL = ['child', 'teen', 'adult', 'elder'] as const;
export const DISASTER_STORYLETS: Storylet[] = [
  { id: 'disaster_dragon', tone: 'dark', w: 0, important: true, c: { ...D('dragon_raid'), stage: ['teen', 'adult', 'elder'] }, t: 'เงาปีกมหึมาบดบังดวงอาทิตย์ มังกรเพลิงพ่นไฟลงมาที่{town} หลังคาบ้านลุกเป็นไฟทีละหลัง', ch: [
    { l: 'ช่วยพาคนออกจากบ้านที่ไฟไหม้', tags: ['help', 'risk'], ax: { kind: 1, brave: 1 }, chk: ['spd', 13], bonusTag: ['fire_res', 'water', 'ice'], ok: ['ช่วยชีวิตคนได้หลายสิบคน ชาวเมืองจดจำชื่อ {name}', 'fame+12 karma+6 thread:+hero:2'], ng: ['ถูกไฟลวกขณะพาเด็กคนหนึ่งออกมา แต่ทั้งคู่รอด', 'hp-30 karma+4'] },
    { l: 'คว้าอาวุธขึ้นสู้มังกร', tags: ['fight', 'risk'], ax: { brave: 2 }, chk: ['pow', 18], bonusTag: ['dragon_bane', 'ice', 'hero_luck', 'holy'], ok: ['ฟาดถูกตาข้างหนึ่ง มังกรคำรามแล้วบินหนีไป! ผู้คนเรียก {name} ว่าผู้ขับไล่มังกร', 'fame+25 kill +flag:dragonslayer thread:+warrior:3'], ng: ['เปลวไฟกวาดผ่าน ล้มลงท่ามกลางซากปรักหักพัง', 'hp-50'] },
    { l: 'หนีลงห้องใต้ดิน', tags: ['flee', 'safe'], ok: ['รอดมาได้ แต่บ้านกลายเป็นเถ้า', 'gold-25'] },
  ] },
  { id: 'disaster_meteor', tone: 'grim', w: 0, important: true, c: { ...D('meteor'), stage: [...ALL] }, t: 'แสงขาวกลืนท้องฟ้า เสียงระเบิดดังจนหูอื้อ อุกกาบาตตกห่างจาก{town}ไปไม่กี่ลี้ หลุมยักษ์ยังเรืองแสงสีฟ้า', ch: [
    { l: 'เข้าไปสำรวจหลุมอุกกาบาต', tags: ['learn', 'risk'], ax: { curious: 2 }, chk: ['luk', 14], bonusTag: ['treasure', 'mine', 'arcane'], ok: ['พบแร่ดวงดาวที่ยังอุ่นอยู่ ช่างตีเหล็กตีเป็นอาวุธให้', 'weapon:holy:lightning:R thread:+arcane:2'], ng: ['รังสีแปลกประหลาดทำให้ป่วยหนักไปหลายเดือน', 'hp-25 curse:random'] },
    { l: 'ช่วยดับไฟป่าที่ลามมา', tags: ['help'], ax: { kind: 1 }, chk: ['vit', 12], ok: ['ไฟสงบลงก่อนถึงหมู่บ้าน', 'fame+8 karma+4'], ng: ['สำลักควันจนหมดสติ', 'hp-15'] },
    { l: 'อธิษฐานว่าเป็นลางจากเทพ', tags: ['pray', 'safe'], ax: { piety: 1 }, ok: ['ใจสงบลงอย่างประหลาด', 'belief+8 thread:+faithful:1'] },
  ] },
  { id: 'disaster_alien', tone: 'grim', w: 0, important: true, c: { ...D('alien'), stage: [...ALL] }, t: 'จานโลหะเรืองแสงลอยนิ่งเหนือ{town} ลำแสงสีเขียวส่องลงมาที่ลานกลางเมือง วัวตัวหนึ่งลอยขึ้นไปช้า ๆ', ch: [
    { l: 'เดินเข้าไปในลำแสงด้วยความอยากรู้', tags: ['learn', 'risk', 'trust'], ax: { curious: 2 }, chk: ['luk', 14], bonusTag: ['polyglot', 'arcane', 'charm'], ok: ['หายไปสามวัน กลับมาพร้อมความรู้ที่ไม่มีใครเข้าใจ', 'int+2 mag+1 skill:unique thread:+arcane:3'], ng: ['กลับมาพร้อมรอยแผลเป็นแปลก ๆ และความทรงจำที่ขาดหาย', 'hp-15 int-1 curse:random'] },
    { l: 'ขว้างหินใส่จานบิน', tags: ['fight', 'defy'], ax: { brave: 1 }, chk: ['pow', 15], bonusTag: ['sling', 'bow', 'lightning'], ok: ['หินถูกจุดอ่อน! จานบินโคลงเคลงแล้วบินหนีไป เหลือชิ้นส่วนประหลาดตกไว้', 'fame+15 gold+40'], ng: ['ลำแสงยิงสวนกลับมา', 'hp-25'] },
    { l: 'หลบในบ้านและปิดหน้าต่าง', tags: ['flee', 'safe'], ok: ['รุ่งเช้าจานบินหายไป เหลือรอยวงกลมในทุ่งนา', ''] },
  ] },
  { id: 'disaster_titan', tone: 'dark', w: 0, important: true, c: { ...D('titan'), stage: ['teen', 'adult', 'elder'] }, t: 'ไททันสูงเท่าภูเขาเดินมุ่งหน้ามาทาง{town} ทุกก้าวทำให้กำแพงเมืองร้าว', ch: [
    { l: 'นำคนอพยพไปทางหุบเขา', tags: ['help', 'travel'], ax: { kind: 1 }, chk: ['int', 13], bonusTag: ['leader', 'navigator'], ok: ['พาคนทั้งเมืองรอดได้ทันเวลา', 'fame+15 karma+8 move'], ng: ['หลงทางกลางหุบเขา หลายคนบาดเจ็บ', 'hp-20 move'] },
    { l: 'ปีนขึ้นไปหาจุดอ่อนบนตัวไททัน', tags: ['fight', 'risk'], ax: { brave: 2 }, chk: ['spd', 17], bonusTag: ['climb', 'hero_luck', 'rune'], ok: ['พบรูนโบราณที่หน้าอกและทำลายมัน ไททันหลับใหลอีกครั้ง!', 'fame+30 thread:+hero:3 +flag:titan_sleeper'], ng: ['ตกลงมาจากความสูงหลายสิบศอก', 'hp-55'] },
    { l: 'ขุดหลุมหลบในห้องใต้ดิน', tags: ['safe', 'stay'], ok: ['บ้านพัง แต่ครอบครัวรอด', 'gold-20'] },
  ] },
  { id: 'disaster_locust', tone: 'grim', w: 0, c: { ...D('locust'), stage: [...ALL] }, t: 'เสียงหึ่งดังกลบทุกเสียง ฝูงตั๊กแตนบดบังดวงอาทิตย์และลงกินไร่นารอบ{town}', ch: [
    { l: 'จุดไฟควันไล่ตั๊กแตน', tags: ['help', 'risk'], chk: ['int', 12], bonusTag: ['fire', 'nature', 'farm'], ok: ['ไร่ของหมู่บ้านรอดครึ่งหนึ่ง', 'fame+6 karma+3'], ng: ['ไฟลามไหม้ยุ้งฉางเสียเอง', 'gold-15'] },
    { l: 'จับตั๊กแตนมาทอดขาย', tags: ['greed'], chk: ['int', 11], bonusTag: ['cook', 'trade'], ok: ['ขายดีเกินคาด!', 'gold+35'], ng: ['ไม่มีใครกล้ากิน', 'gold-5'] },
    { l: 'กักตุนข้าวไว้ก่อน', tags: ['selfish', 'safe'], ok: ['ครอบครัวมีกินตลอดหน้าแล้ง', 'gold-10 karma-2'] },
  ] },
  { id: 'disaster_flood', tone: 'grim', w: 0, c: { ...D('flood'), stage: ['teen', 'adult', 'elder'] }, t: 'น้ำท่วมสูงถึงหน้าต่างชั้นสองของ{town} ผู้คนนั่งบนหลังคารอความช่วยเหลือ', ch: [
    { l: 'พายเรือช่วยคนบนหลังคา', tags: ['help', 'risk'], ax: { kind: 1 }, chk: ['vit', 13], bonusTag: ['water', 'swim', 'sea'], ok: ['ช่วยคนได้ทั้งตรอก', 'fame+10 karma+6'], ng: ['เรือล่มกลางกระแสน้ำ ว่ายกลับมาได้อย่างหวุดหวิด', 'hp-25'] },
    { l: 'เก็บของมีค่าที่ลอยมากับน้ำ', tags: ['greed'], ok: ['ได้ของมาไม่น้อย', 'gold+30 karma-3'] },
    { l: 'ขึ้นไปหลบบนเนินเขา', tags: ['flee', 'safe'], ok: ['รอดพร้อมเสื้อผ้าชุดเดียว', 'gold-10'] },
  ] },
  { id: 'disaster_quake', tone: 'dark', w: 0, c: { ...D('quake'), stage: ['teen', 'adult', 'elder'] }, t: 'พื้นดินใต้{town}สั่นสะเทือน หอระฆังโค่นลง เสียงร้องดังมาจากใต้ซากบ้าน', ch: [
    { l: 'ขุดซากช่วยคนที่ติดอยู่', tags: ['help', 'risk'], ax: { kind: 1 }, chk: ['pow', 13], bonusTag: ['earth', 'strong', 'mine'], ok: ['ดึงครอบครัวหนึ่งออกมาได้ทั้งหมด', 'fame+10 karma+7'], ng: ['อาฟเตอร์ช็อกทำให้ซากถล่มทับขา', 'hp-30'] },
    { l: 'วิ่งออกไปที่โล่ง', tags: ['flee', 'safe'], ok: ['รอดมาได้ปลอดภัย', ''] },
  ] },
  { id: 'disaster_eclipse', tone: 'dark', w: 0, c: { ...D('eclipse'), stage: ['teen', 'adult', 'elder'] }, t: 'ดวงอาทิตย์ดับลงกลางวัน ดวงตาสีแดงนับร้อยคู่ปรากฏในความมืดรอบ{town}', ch: [
    { l: 'จุดคบไฟปกป้องเพื่อนบ้าน', tags: ['help', 'fight'], ax: { brave: 1 }, chk: ['pow', 14], bonusTag: ['light', 'holy', 'fire'], ok: ['แสงไฟขับไล่พวกมันกลับไป', 'fame+10 kill thread:+hero:2'], ng: ['ถูกกรงเล็บข่วนกลางความมืด', 'hp-25'] },
    { l: 'สวดภาวนาให้ดวงอาทิตย์กลับมา', tags: ['pray'], ax: { piety: 1 }, ok: ['แสงแรกกลับมาเมื่อสวดจบพอดี', 'belief+10'] },
    { l: 'ออกไปหาที่มาของความมืด', tags: ['learn', 'risk'], ax: { curious: 1 }, chk: ['mag', 15], bonusTag: ['dark', 'darkvision'], ok: ['ได้ยินเสียงกระซิบจากเงา…', 'apt:dark thread:+dark:3'], ng: ['หลงอยู่ในความมืดจนเกือบเสียสติ', 'hp-15 int-1'] },
  ] },
  { id: 'disaster_magicstorm', tone: 'comedy', w: 0, c: { ...D('magic_storm'), stage: [...ALL] }, t: 'พายุเวทมนตร์สีรุ้งพัดผ่าน{town} แมวพูดได้ ไม้กวาดบินได้ และประกายแสงกำลังพุ่งตรงมาที่ {name}', ch: [
    { l: 'อ้าแขนรับประกายแสง', tags: ['risk', 'learn'], ax: { curious: 1 }, chk: ['luk', 13], bonusTag: ['arcane', 'magic'], ok: ['ร่างกายเต็มไปด้วยพลังเวทแปลกใหม่', 'mag+2 bless:random'], ng: ['ผมเปลี่ยนเป็นสีชมพูถาวร และโชคร้ายตามมา', 'curse:random fame+2'] },
    { l: 'จับไม้กวาดบินไปขาย', tags: ['greed'], chk: ['spd', 12], ok: ['ขายให้นักสะสมได้ราคาดี', 'gold+40'], ng: ['ไม้กวาดพาบินไปตกบ่อน้ำ', 'hp-5'] },
    { l: 'หลบใต้โต๊ะ', tags: ['safe'], ok: ['รอจนพายุผ่านไป', ''] },
  ] },
  { id: 'disaster_whale', tone: 'warm', w: 0, c: { ...D('sky_whale'), stage: [...ALL] }, t: 'วาฬฟ้าขนาดเท่าเมืองว่ายผ่านเหนือ{town} ร้องเพลงก้องฟ้า ละอองแสงโปรยลงมาเหมือนหิมะ', ch: [
    { l: 'อธิษฐานขอพรกับวาฬฟ้า', tags: ['pray', 'love'], ax: { piety: 1 }, ok: ['ละอองแสงตกลงบนมือพอดี', 'luk+1 belief+5 bless:random'] },
    { l: 'ร้องเพลงตาม', tags: ['love', 'help'], chk: ['int', 11], bonusTag: ['music', 'charm'], ok: ['วาฬฟ้าหันมามอง แล้วร้องตอบ', 'fame+6 social+5 thread:+romance:1'], ng: ['เสียงเพี้ยนจนเพื่อนบ้านหัวเราะ', 'fame-1'] },
  ] },
  { id: 'disaster_kraken', tone: 'dark', w: 0, important: true, c: { ...D('kraken'), stage: ['teen', 'adult', 'elder'] }, t: 'หนวดยักษ์โผล่จากทะเลหน้า{town} รัดเรือประมงทีละลำลงสู่ก้นทะเล', ch: [
    { l: 'ลงเรือไปฟันหนวดคราเคน', tags: ['fight', 'risk'], ax: { brave: 2 }, chk: ['pow', 16], bonusTag: ['sea', 'lightning', 'hero_luck'], ok: ['ฟันหนวดขาด คราเคนจมหายลงทะเลลึก!', 'fame+20 kill thread:+warrior:3'], ng: ['ถูกหนวดฟาดตกทะเล ชาวประมงลากขึ้นมาได้ทัน', 'hp-40'] },
    { l: 'จุดไฟสัญญาณเตือนเรือที่ยังอยู่กลางทะเล', tags: ['help'], ax: { kind: 1 }, chk: ['int', 12], ok: ['เรือหลายสิบลำหันหัวกลับทัน', 'fame+8 karma+5'], ng: ['ไฟดับกลางลมแรง', ''] },
    { l: 'ถอยห่างจากชายฝั่ง', tags: ['flee', 'safe'], ok: ['ปลอดภัย', ''] },
  ] },
  // a child lives through a disaster differently: {what} is the disaster's name
  { id: 'disaster_child', tone: 'grim', w: 0, c: { stage: ['child'] }, t: 'ผู้ใหญ่ตะโกนให้ทุกคนหนี เพราะ{what} {name} ตัวน้อยยืนตัวสั่นอยู่กลางถนน', ch: [
    { l: 'จับมือพ่อแม่วิ่งหนี', tags: ['flee', 'safe', 'trust'], ok: ['ครอบครัวหนีรอดไปด้วยกัน', 'social+2'] },
    { l: 'อุ้มน้องข้างบ้านที่ร้องไห้ไปด้วย', tags: ['help', 'risk'], ax: { kind: 2, brave: 1 }, chk: ['luk', 11], ok: ['เด็กทั้งสองรอด ผู้ใหญ่ทั้งหมู่บ้านชมไม่ขาดปาก', 'fame+5 karma+5'], ng: ['สะดุดล้มเข่าแตก แต่พาน้องรอดมาได้', 'hp-10 karma+4'] },
    { l: 'แอบมองสิ่งที่เกิดขึ้นจากใต้เกวียน', tags: ['learn', 'risk'], ax: { curious: 2 }, ok: ['ภาพวันนั้นติดตาไปจนโต', 'int+1 brave+5'] },
  ] },
];
