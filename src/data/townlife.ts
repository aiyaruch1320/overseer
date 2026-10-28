// Little things townsfolk do, built from a grammar: who (role) × what × object/place × how it ends,
// plus moments that only happen in some weather, some faiths, some races or some crises.
import type { RNG } from '../sim/rng';

export type LifeKind = 'talk' | 'fight' | 'trade' | 'love' | 'sing' | 'pray' | 'chase' | 'cry' | 'celebrate' | 'work';
export const EMOTE: Record<LifeKind, string> = { talk: 'bubble', fight: 'kill', trade: 'gold', love: 'lover', sing: 'note', pray: 'faith', chase: 'move', cry: 'tone_dark', celebrate: 'golden', work: 'hammer' };

export interface LifeCtx { a: string; b: string; roleA: string; raceA: string; town: string; place: string; weather: string; flags: string[]; religion: string; hero?: string; heroFame?: number; minority?: boolean }

const W = {
  item: ['ผ้าไหมจากต่างแดน', 'หม้อทองแดง', 'ดาบมือสอง', 'ยาสมุนไพร', 'ไข่มังกร (ปลอม)', 'ขนนกกริฟฟอน', 'เกลือสีชมพู', 'แหวนเงิน', 'ผ้าห่มขนแกะ', 'ตะเกียงน้ำมัน', 'แผนที่สมบัติ', 'พริกไทยดำ', 'รองเท้าหนัง', 'ขวดน้ำมนต์', 'ไพ่ทำนาย', 'ไม้กวาดบินได้ (อ้างว่า)', 'เครื่องรางกันผี', 'ลูกแก้วสีรุ้ง', 'หนังสือกลอน', 'ไวน์เอลฟ์'],
  food: ['ขนมปังร้อน ๆ', 'ซุปหัวหอม', 'ปลาย่าง', 'พายเนื้อ', 'เบียร์คนแคระ', 'ผลไม้ภูต', 'ขนมน้ำผึ้ง', 'สตูว์กระต่าย', 'ข้าวต้มปลา', 'ไส้กรอกรมควัน'],
  animal: ['ไก่', 'แพะ', 'หมูป่า', 'แมวดำ', 'ห่านดุ', 'ลูกม้า', 'สไลม์จิ๋ว', 'อีกา', 'กระต่าย', 'ลูกหมา'],
  gossip: ['เจ้าเมืองแอบมีเมียน้อยสามคน', 'มีคนเห็นมังกรบินผ่านเมื่อคืน', 'บ่อน้ำหลังวิหารมีผีสิง', 'ลูกสาวช่างตีเหล็กหนีตามกวี', 'ราคาขนมปังจะขึ้นอีก', 'ผู้กล้าจะผ่านเมืองนี้เร็ว ๆ นี้', 'นักบวชแอบดื่มเหล้าทุกคืน', 'มีขุมทรัพย์ใต้ซากหอคอย', 'แม่มดย้ายมาอยู่ท้ายหมู่บ้าน', 'สงครามกำลังจะมาถึง', 'โรงเตี๊ยมใส่ยาเสน่ห์ในเบียร์', 'แมวของยายข้างบ้านพูดได้'],
  song: ['วีรชนผู้ฆ่ามังกร', 'ความรักที่ไม่สมหวัง', 'ทะเลกว้างและเงือกสาว', 'สงครามร้อยปี', 'จอมมารผู้เศร้าสร้อย', 'ขนมปังของแม่', 'ผู้กล้าที่หลงทาง', 'ดวงจันทร์สีเลือด'],
  tale: ['สมัยที่ยังเป็นทหารรับจ้าง', 'ปีที่หิมะตกสามเดือน', 'ตอนเจอภูตในป่า', 'วันที่เคยเห็นผู้กล้าตัวจริง', 'ศึกกับโทรลล์บนสะพาน', 'รักแรกที่ท่าเรือ'],
  end: ['จนได้ลดครึ่งราคา', 'แต่สุดท้ายซื้อแพงกว่าเดิม', 'และทะเลาะกันเสียงดัง', 'แล้วแถม{food}ให้หนึ่งชิ้น', 'แต่เงินไม่พอเลยต้องเอา{animal}มาแลก'],
};

const T = (kind: LifeKind, w: number, t: string, when?: (c: LifeCtx) => boolean) => ({ kind, w, t, when });
const role = (...r: string[]) => (c: LifeCtx) => r.some((x) => c.roleA.includes(x));
const flag = (f: string) => (c: LifeCtx) => c.flags.includes(f);
const weather = (...w: string[]) => (c: LifeCtx) => w.includes(c.weather);
const race = (...r: string[]) => (c: LifeCtx) => r.includes(c.raceA);

const TEMPLATES = [
  // everyday
  T('trade', 4, '{a} ต่อราคา{item}กับ {b} {end}'), T('talk', 4, '{a} กระซิบกับ {b} ว่า "{gossip}"'), T('talk', 2, '{a} บ่นกับ {b} เรื่อง{weatherTalk}'),
  T('love', 1.5, '{a} แอบยื่น{food}ให้ {b} หน้าแดง'), T('love', 1, '{a} กับ {b} เดินจูงมือกันที่{place}'), T('fight', 1.5, '{a} กับ {b} ท้าต่อยกันหน้า{place} เพราะ{gossipShort}'),
  T('chase', 2, '{a} วิ่งไล่จับ{animal}ที่หลุดออกมาทั่ว{place}'), T('cry', 1, '{a} นั่งร้องไห้ที่{place} เพราะทำ{item}หาย'), T('work', 2, '{a} ขน{item}ไปส่งที่{place}'),
  T('sing', 1.5, '{a} ร้องเพลงเรื่อง"{song}" กลาง{place}'), T('talk', 1.5, '{a} เล่าเรื่อง{tale}ให้ {b} ฟังเป็นรอบที่ร้อย'),
  // roles
  T('fight', 3, '{a} ไล่จับขโมยที่ฉก{item}ไปจากตลาด', role('ทหาร', 'หัวหน้าทหารยาม')), T('talk', 2, '{a} สั่งตรวจเกวียนทุกคันที่เข้า{town}', role('ทหาร')),
  T('trade', 3, '{a} ตะโกนขาย{food}ราคาพิเศษ!', role('พ่อค้า')), T('trade', 2, '{a} แอบชั่ง{item}โกงตาชั่ง', role('พ่อค้า')),
  T('pray', 3, '{a} เทศนาเรื่อง{faith}ที่ลานวิหาร', role('นักบวช')), T('pray', 2, '{a} รดน้ำมนต์ให้เด็ก ๆ หน้าวิหาร', role('นักบวช')),
  T('chase', 3, '{a} เล่นซ่อนหากับ {b} รอบ{place}', role('เด็ก')), T('chase', 2, '{a} ขโมย{food}แล้ววิ่งหนีแม่ค้า', role('เด็ก')),
  T('work', 3, '{a} ตีเหล็กจนประกายไฟกระเด็นไปทั้งร้าน', role('ช่างตีเหล็ก', 'ช่างฝีมือ')), T('work', 3, '{a} แบกผักจากไร่มาขายแต่เช้า', role('ชาวนา')),
  T('sing', 3, '{a} ดีดพิณร้องเพลง"{song}" คนมุงเต็ม{place}', role('นักกวี')), T('talk', 2, '{a} ขอเศษขนมปังจาก {b}', role('ขอทาน')),
  T('talk', 2, '{a} ประกาศกฎใหม่ของ{town} ไม่มีใครฟัง', role('ผู้ใหญ่บ้าน')), T('work', 2, '{a} ต้มยาสมุนไพรกลิ่นฉุนไปทั้งถนน', role('หมอยา')),
  T('celebrate', 2, '{a} เลี้ยงเบียร์ทั้งโรงเตี๊ยมเพราะวันนี้อารมณ์ดี', role('เจ้าของโรงเตี๊ยม')),
  // weather
  T('chase', 4, '{a} วิ่งหลบฝนเข้าชายคา{place}', weather('rain', 'storm')), T('cry', 2, 'ฟ้าผ่าลงต้นไม้ใหญ่ข้าง{place} {a} ตกใจจนทำ{item}หล่น', weather('storm')),
  T('celebrate', 4, 'เด็ก ๆ ปั้นตุ๊กตาหิมะหน้า{place}', weather('snow', 'blizzard')), T('work', 3, '{a} ตักหิมะออกจากหน้าบ้าน', weather('snow', 'blizzard')),
  T('talk', 4, '{a} คลุมหน้าด้วยผ้าเดินฝ่าพายุทราย', weather('sandstorm')), T('cry', 3, '{a} เป็นลมเพราะแดดเผา {b} รีบพัดให้', weather('heat')),
  T('talk', 3, '{a} หลงทางในหมอกจนเดินชน {b}', weather('fog')), T('work', 3, '{a} ปัดเถ้าภูเขาไฟออกจากหลังคา', weather('ashfall')),
  // the land's troubles and joys
  T('cry', 4, '{a} ร้องไห้ส่งลูกชายไปรบที่ชายแดน', flag('war')), T('talk', 3, 'ทหารเดินทัพผ่าน{town} {a} รีบหลบเข้าบ้าน', flag('war')),
  T('cry', 4, '{a} ไอเป็นเลือด ผู้คนถอยห่าง', flag('plague')), T('work', 3, 'หมอสวมหน้ากากนกเดินตรวจบ้าน {a}', flag('plague')),
  T('fight', 3, 'ชาวบ้านรุมแย่งกระสอบข้าวจน {a} กับ {b} ชกกัน', flag('famine')), T('talk', 3, '{a} ขอเศษอาหารจาก {b}', flag('famine')),
  T('celebrate', 4, 'งานรื่นเริงทั่ว{town}! {a} เต้นรำกับ {b}', flag('golden')), T('celebrate', 4, 'เทศกาลร้อยปี {a} ประกวดกินพายแข่งกับ {b}', flag('festival')),
  T('cry', 4, 'ทหารศาลศาสนาลากตัว {a} ไปไต่สวน', flag('inquisition')), T('pray', 3, '{a} จุดเทียนขับไล่จันทร์สีเลือด', flag('bloodmoon')),
  T('fight', 4, 'ปีศาจจากกองทัพจอมมารไล่ฟัน {a} กลางถนน', flag('demon_raid')), T('trade', 3, '{a} ขายจอบให้คนที่จะไปขุดทอง', flag('gold_rush')),
  T('chase', 3, 'ศพเดินได้ไล่ตาม {a} รอบ{place}', flag('undead_rising')), T('talk', 3, '{a} นับวันที่ไม่เห็นดวงอาทิตย์', flag('long_night')),
  // races and faiths
  T('fight', 2, '{a} ท้า {b} งัดข้อ ใครแพ้เลี้ยงเบียร์', race('orc', 'dwarf', 'beast')), T('celebrate', 2, '{a} ดื่มเบียร์ทั้งถังแล้วร้องเพลงบรรพบุรุษ', race('dwarf')),
  T('sing', 2, '{a} ท่องกลอนอายุพันปีให้ต้นไม้ฟัง', race('elf')), T('chase', 2, '{a} แกล้งเปลี่ยนรองเท้าของ {b} เป็นกบ', race('fae')),
  T('work', 2, '{a} กลืน{item}เข้าไปทั้งชิ้นแล้วคายออกมาสะอาดเอี่ยม', race('slime')), T('sing', 2, '{a} ร้องเพลงทะเลจนคนลืมทำงาน', race('merfolk')),
  T('talk', 2, '{a} กางร่มดำเดินหลบแดดตลอดทาง', race('vampire')), T('pray', 2, '{a} ลอยกระทงบูชาพญานาคที่ท่าน้ำ', (c) => c.religion === 'naga'),
  T('pray', 2, '{a} คุกเข่าหน้ารูปปั้นมังกรขอพร', (c) => c.religion === 'dragon'), T('pray', 2, '{a} จุดธูปไหว้บรรพบุรุษหน้าบ้าน', (c) => c.religion === 'ancestor'),
  // the protagonist seen by others
  T('talk', 3, '{a} ชี้มาที่ {hero} "นั่นไงคนที่ทุกคนพูดถึง!"', (c) => !!c.hero && (c.heroFame || 0) > 25),
  T('talk', 3, '{a} มองค้อน {hero} แล้วกระซิบกับ {b}', (c) => !!c.hero && !!c.minority),
  T('love', 1, '{a} แอบมอง {hero} จากหลังแผงผลไม้', (c) => !!c.hero),
];

const weatherTalk: Record<string, string> = { clear: 'ท้องฟ้าใสเกินไปจนน่ากลัว', cloudy: 'เมฆครึ้มแบบนี้ผ้าไม่แห้ง', rain: 'ฝนที่ตกไม่หยุด', storm: 'พายุเมื่อคืนพังรั้ว', snow: 'หิมะที่ทับหลังคา', blizzard: 'พายุหิมะที่ปิดถนน', sandstorm: 'ทรายในซุป', fog: 'หมอกหนาจนมองไม่เห็นหน้าเมีย', heat: 'แดดร้อนจนไข่สุกบนหิน', ashfall: 'เถ้าภูเขาไฟในบ่อน้ำ' };
const faith: Record<string, string> = { light: 'แสงที่ขับไล่ความมืด', dragon: 'ความยิ่งใหญ่ของมังกร', ancestor: 'การเคารพบรรพบุรุษ', nature: 'ต้นไม้โลก', sea: 'เทพแห่งสมุทร', moon: 'เทพีจันทรา', war: 'เกียรติในสนามรบ', demon: 'พลังที่ซ่อนในความมืด', naga: 'พญานาคราช', none: 'การพึ่งตนเอง' };

export function townLifeEvent(rng: RNG, c: LifeCtx): { kind: LifeKind; text: string } {
  const pool = TEMPLATES.filter((t) => !t.when || t.when(c));
  const t = rng.weighted(pool, (x) => x.w)!;
  const pick = (k: keyof typeof W) => rng.pick(W[k]);
  const text = t.t
    .replace('{end}', pick('end'))
    .replace(/\{a\}/g, c.a).replace(/\{b\}/g, c.b).replace(/\{hero\}/g, c.hero || '')
    .replace(/\{town\}/g, c.town).replace(/\{place\}/g, c.place)
    .replace('{item}', pick('item')).replace('{food}', pick('food')).replace('{animal}', pick('animal'))
    .replace('{gossip}', pick('gossip')).replace('{gossipShort}', rng.pick(['เรื่องหนี้ค่าเหล้า', 'แย่งที่นั่งในโรงเตี๊ยม', 'แย่งคนรัก', 'แพะกินผักข้างบ้าน', 'ใครร้องเพลงเพราะกว่า']))
    .replace('{song}', pick('song')).replace('{tale}', pick('tale'))
    .replace('{weatherTalk}', weatherTalk[c.weather] || weatherTalk.clear).replace('{faith}', faith[c.religion] || faith.none);
  return { kind: t.kind, text };
}

// how many different lines the grammar can produce (for checking the "1,000+" goal)
export function townLifeVariety(): number {
  const slots: Record<string, number> = { item: W.item.length, food: W.food.length, animal: W.animal.length, gossip: W.gossip.length, song: W.song.length, tale: W.tale.length, end: W.end.length * 10, gossipShort: 5, weatherTalk: 10, faith: 10 };
  return TEMPLATES.reduce((sum, t) => sum + (t.t.match(/\{(\w+)\}/g) || []).reduce((n, m) => n * (slots[m.slice(1, -1)] || 1), 1), 0);
}

export const TOWN_PLACES = ['ตลาด', 'ลานวิหาร', 'บ่อน้ำกลางเมือง', 'โรงเตี๊ยม', 'ประตูเมือง', 'สะพาน', 'ท่าน้ำ', 'ร้านตีเหล็ก', 'จัตุรัส', 'ลานซักผ้า', 'หน้ากิลด์', 'ตรอกหลังตลาด'];
