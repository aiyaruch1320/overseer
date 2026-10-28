import type { Game } from '../sim/game';

// ===================== prayers =====================
// The character (or someone close to them) asks the god for something. A card appears without stopping time;
// the player answers: grant (costs faith), refuse, or punish the asker (gains dread). Ignoring it is an answer too.
export interface Prayer {
  id: string;
  w: number;
  icon: string;
  when: (g: Game) => boolean;
  text: string; // what is asked, {name} {npc} {nemesis} {place}
  grant: { cost: number; fx: string; log: string };
  punish: { gain: number; fx: string; log: string };
  npc?: (g: Game) => { name: string; id: number } | undefined; // whose prayer, when not the protagonist's
}

const hpLow = (g: Game) => g.c.hp < g.maxHp() * 0.45;
const flag = (g: Game, f: string) => g.country.flags.includes(f);
const sickKin = (g: Game) => {
  const n = g.s.npcs.find((x) => x.alive && x.tags.includes('sick') && g.c.relations.some((r) => r.npcId === x.id && r.alive));
  return n ? { name: n.name, id: n.id } : undefined;
};

export const PRAYERS: Prayer[] = [
  { id: 'heal', w: 6, icon: 'heal', when: hpLow, text: '{name} นอนซมด้วยบาดแผลและพิษไข้ สวดขอให้หายเจ็บปวด',
    grant: { cost: 12, fx: 'hp+45', log: 'ไข้ลดลงอย่างน่าอัศจรรย์ บาดแผลสมานในคืนเดียว' }, punish: { gain: 6, fx: 'hp-10', log: 'อาการทรุดหนักลงราวกับฟ้าลงโทษ' } },
  { id: 'rain', w: 6, icon: 'rain', when: (g) => flag(g, 'famine') || flag(g, 'sandstorm'), text: '{name} คุกเข่ากลางทุ่งแห้ง ขอให้ฝนตกลงมาเลี้ยงผืนดิน{place}',
    grant: { cost: 18, fx: 'country:-famine country:-sandstorm gold+10', log: 'เมฆดำก่อตัว ฝนห่าใหญ่ตกลงมาทั่วแผ่นดิน ชาวบ้านร้องไห้ด้วยความยินดี' }, punish: { gain: 8, fx: 'gold-15 hp-5', log: 'ฟ้าแล้งหนักกว่าเดิม บ่อสุดท้ายแห้งขอด' } },
  { id: 'plague', w: 6, icon: 'plague', when: (g) => flag(g, 'plague') || flag(g, 'undead_rising'), text: '{name} จุดเทียนหน้าบ้าน ขอให้โรคร้ายผ่านพ้นครอบครัวไป',
    grant: { cost: 18, fx: 'country:-plague country:-undead_rising hp+10', log: 'โรคร้ายถอยห่าง ราวกับมีกำแพงล่องหนล้อมเมือง' }, punish: { gain: 8, fx: 'hp-20', log: 'ไอเป็นเลือดในคืนนั้น' } },
  { id: 'peace', w: 5, icon: 'war', when: (g) => flag(g, 'war') || flag(g, 'demon_raid') || flag(g, 'horde'), text: '{name} สวดขอให้สงครามจบเสียที ลูกชายข้างบ้านยังไม่กลับมา',
    grant: { cost: 25, fx: 'country:-war country:-demon_raid country:-horde', log: 'กองทัพทั้งสองฝ่ายตื่นมาพบว่าแม่น้ำเอ่อท่วมเส้นทาง สงครามจำต้องยุติ' }, punish: { gain: 10, fx: 'hp-15', log: 'ไฟสงครามลามมาถึงหน้าบ้าน' } },
  { id: 'love', w: 3, icon: 'lover', when: (g) => g.stage() === 'adult' && !g.c.relations.some((r) => (r.type === 'lover' || r.type === 'spouse') && r.alive), text: '{name} มองดาวตก และกระซิบขอให้ได้พบคนที่ใช่สักที',
    grant: { cost: 12, fx: 'rel:+lover', log: 'วันรุ่งขึ้น {npc} เดินชนเข้าเต็มแรงที่ตลาด… และเรื่องราวก็เริ่มต้น' }, punish: { gain: 6, fx: 'curse:c_lonely', log: 'ความเหงากัดกินหัวใจ' } },
  { id: 'heir', w: 3, icon: 'child', when: (g) => g.c.relations.some((r) => r.type === 'spouse' && r.alive) && !g.c.children.length && g.c.hAge < 50, text: '{name} กับคู่ชีวิตไปไหว้ศาลขอบุตรทุกเดือน',
    grant: { cost: 15, fx: 'child', log: 'เสียงร้องของทารกดังขึ้นในบ้านในฤดูถัดมา' }, punish: { gain: 6, fx: 'curse:c_barren', log: 'หมอยาส่ายหน้า' } },
  { id: 'wealth', w: 3, icon: 'gold', when: (g) => g.stage() === 'adult' && g.c.gold < 25, text: '{name} นับเหรียญสุดท้ายในกระเป๋า ขอให้พ้นจากความยากจน',
    grant: { cost: 10, fx: 'gold+50', log: 'พบถุงเงินตกอยู่ข้างทาง ไม่มีใครมาตามหา' }, punish: { gain: 6, fx: 'gold-10 curse:c_poverty', log: 'เงินก้อนสุดท้ายหล่นหายลงท่อ' } },
  { id: 'wisdom', w: 3, icon: 'book', when: (g) => g.stage() === 'teen', text: '{name} อ่านตำราจนดึก ขอให้สมองแล่นพอจะสอบผ่าน',
    grant: { cost: 12, fx: 'int+1 skill:random', log: 'ความรู้ไหลเข้าหัวราวสายน้ำ' }, punish: { gain: 5, fx: 'int-1', log: 'ตัวอักษรเต้นระบำจนอ่านไม่ออก' } },
  { id: 'courage', w: 3, icon: 'weapon', when: (g) => g.stage() !== 'infant' && g.stage() !== 'child' && g.country.danger >= 3, text: '{name} ภาวนาขอความกล้า ก่อนออกเดินทางผ่านป่าที่มีอสูรชุกชุม',
    grant: { cost: 8, fx: 'brave+20 hp+15', log: 'หัวใจเต้นแรง ความกลัวมลายหาย' }, punish: { gain: 5, fx: 'brave-15', log: 'ขาสั่นจนเดินแทบไม่ได้' } },
  { id: 'vengeance', w: 3, icon: 'nemesis', when: (g) => g.c.relations.some((r) => r.type === 'nemesis' && r.alive), text: '{name} สาบานต่อฟ้า ขอให้ {nemesis} ได้รับกรรมที่ก่อไว้',
    grant: { cost: 15, fx: 'relkill:nemesis karma-3', log: 'ข่าวร้ายของ {nemesis} มาถึงในฤดูถัดมา… {name} ไม่รู้ว่าควรรู้สึกอย่างไร' }, punish: { gain: 8, fx: 'hp-10 kind+10', log: 'ความแค้นย้อนกลับมาเผาผู้แค้นเอง' } },
  { id: 'uncurse', w: 3, icon: 'curse', when: (g) => g.c.curses.length > 0, text: '{name} ร้องขอให้คำสาปที่ติดตัวมาหายไปเสียที',
    grant: { cost: 20, fx: 'uncurse:random', log: 'เหมือนโซ่ที่พันธนาการมาทั้งชีวิตหลุดออก' }, punish: { gain: 10, fx: 'curse:random', log: 'คำสาปไม่หาย… แต่มีอีกอันเพิ่มมา' } },
  { id: 'fame', w: 2, icon: 'fame', when: (g) => g.stage() === 'adult' && g.c.axes.ambition > 20, text: '{name} ขอให้ชื่อของตนขจรไปทั่วแผ่นดิน',
    grant: { cost: 12, fx: 'fame+15', log: 'กวีพเนจรแต่งเพลงถึง {name} โดยไม่มีใครสั่ง' }, punish: { gain: 6, fx: 'fame-10', log: 'ข่าวลือเสีย ๆ หาย ๆ แพร่สะพัด' } },
  { id: 'harvest', w: 3, icon: 'wheat', when: (g) => ['farmer', 'merchant', 'fisher', 'shepherd', 'innkeeper'].includes(g.c.job || ''), text: '{name} ขอให้ปีนี้ทำมาค้าขึ้น',
    grant: { cost: 8, fx: 'gold+35', log: 'ผลผลิตล้นยุ้ง ลูกค้าแน่นร้าน' }, punish: { gain: 5, fx: 'gold-20', log: 'หนอนลงไร่ทั้งแปลง' } },
  { id: 'grandchild', w: 2, icon: 'birth', when: (g) => g.stage() === 'elder' && g.c.children.length > 0, text: '{name} ในวัยชราขอเพียงได้อุ้มหลานสักครั้งก่อนตาย',
    grant: { cost: 8, fx: 'kind+10 hp+20', log: 'หลานคนแรกเกิดในฤดูนั้น {name} ยิ้มทั้งน้ำตา' }, punish: { gain: 4, fx: 'hp-10', log: 'ลูก ๆ ไม่มีใครกลับมาเยี่ยม' } },
  { id: 'challenge', w: 4, icon: 'rival', when: (g) => g.c.belief < -10 && g.stage() !== 'infant', text: '{name} ตะโกนท้าฟ้า "ถ้ามีเทพจริง ก็แสดงตัวออกมาสิ!"',
    grant: { cost: 15, fx: 'belief+30', log: 'ฟ้าแลบกลางวันแสก ๆ ห่างไปไม่ถึงคืบ {name} คุกเข่าลงตัวสั่น' }, punish: { gain: 10, fx: 'hp-15 belief-10', log: 'สายฟ้าฟาดลงกลางหลัง {name} รอดมาได้… และเกลียดฟ้ายิ่งกว่าเดิม' } },
  { id: 'kin_sick', w: 6, icon: 'friend', when: (g) => !!sickKin(g), npc: sickKin, text: '{npc} คนสำคัญของ {name} ป่วยหนัก {name} เฝ้าข้างเตียงและสวดขอให้หาย',
    grant: { cost: 12, fx: 'npc:heal npc:att+15', log: '{npc} ลืมตาขึ้นและยิ้มให้' }, punish: { gain: 8, fx: 'npc:die', log: '{npc} จากไปในคืนนั้น' } },
  { id: 'mother', w: 4, icon: 'home', when: (g) => g.stage() === 'infant' || g.stage() === 'child', text: 'แม่ของ {name} จุดธูปทุกคืน ขอให้ลูกเติบโตแข็งแรง',
    grant: { cost: 6, fx: 'vit+1 hp+10', log: '{name} โตวันโตคืน ไม่เคยป่วยอีกเลย' }, punish: { gain: 4, fx: 'vit-1', log: '{name} ป่วยกระเสาะกระแสะ' } },
];

// ===================== divine quests =====================
// What the god hopes this life becomes. Progress is shown; finishing pays faith/dread and is remembered in the Codex.
export interface Quest {
  id: string;
  name: string;
  icon: string;
  desc: string;
  progress: (g: Game) => number; // 0..1
  reward: { faith?: number; dread?: number; karma?: number };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const QUESTS: Quest[] = [
  { id: 'prophet', name: 'ศาสดาแห่งเรา', icon: 'faith', desc: 'ทำให้ตัวละครเชื่อในเราจนประกาศศาสนา', progress: (g) => (g.c.flags.includes('prophet') ? 1 : clamp01(g.c.belief / 85) * 0.9), reward: { faith: 80, karma: 10 } },
  { id: 'dragonslayer', name: 'ผู้ฆ่ามังกร', icon: 'dragon', desc: 'นำพาตัวละครไปปราบมังกรให้ได้', progress: (g) => (g.c.flags.includes('dragonslayer') ? 1 : clamp01(g.c.kills / 10) * 0.7), reward: { faith: 60, dread: 20 } },
  { id: 'demonbane', name: 'จุดจบของจอมมาร', icon: 'herosword', desc: 'ให้ตัวละครมีส่วนในการปราบจอมมาร', progress: (g) => (g.c.flags.includes('demonking_slayer') ? 1 : g.c.flags.includes('follower_hero') ? 0.6 : 0.1), reward: { faith: 100, karma: 15 } },
  { id: 'dynasty', name: 'ต้นราชวงศ์', icon: 'crown', desc: 'มีลูกอย่างน้อย 3 คน และตระกูลได้เป็นขุนนาง', progress: (g) => clamp01(g.c.children.length / 3) * 0.6 + (g.c.flags.includes('noble') ? 0.4 : 0), reward: { faith: 50, karma: 5 } },
  { id: 'legend', name: 'ตำนานแห่งยุค', icon: 'fame', desc: 'ชื่อเสียงถึง 80', progress: (g) => clamp01(g.c.fame / 80), reward: { faith: 60 } },
  { id: 'tycoon', name: 'เศรษฐีแห่งแผ่นดิน', icon: 'gold', desc: 'มีทองถึง 400', progress: (g) => clamp01(g.c.gold / 400), reward: { faith: 40, dread: 10 } },
  { id: 'villain', name: 'มารร้ายที่ทุกคนจดจำ', icon: 'demon', desc: 'ทำให้กรรมของตัวละครต่ำถึง -40', progress: (g) => clamp01(-g.s.karmaLife / 40), reward: { dread: 100 } },
  { id: 'secret', name: 'ผู้ปลดผนึก', icon: 'secret', desc: 'ให้ตัวละครได้อาชีพลับสักอาชีพ', progress: (g) => (g.c.secretJob ? 1 : 0.15), reward: { faith: 50, dread: 30 } },
  { id: 'elder', name: 'ร้อยปีไม่สิ้นลม', icon: 'hourglass', desc: 'ประคับประคองให้มีชีวิตถึงวัยชรา (อายุมนุษย์ 80)', progress: (g) => clamp01(g.c.hAge / 80), reward: { faith: 50, karma: 5 } },
  { id: 'warrior', name: 'นักรบร้อยศึก', icon: 'kill', desc: 'สังหารศัตรูให้ได้ 15 ครั้ง', progress: (g) => clamp01(g.c.kills / 15), reward: { faith: 30, dread: 30 } },
  { id: 'saint', name: 'ผู้ไร้มลทิน', icon: 'halo', desc: 'กรรมดีถึง +50', progress: (g) => clamp01(g.s.karmaLife / 50), reward: { faith: 70, karma: 10 } },
  { id: 'companion', name: 'สหายของผู้กล้า', icon: 'friend', desc: 'ให้ตัวละครได้เดินทางร่วมกับผู้กล้า', progress: (g) => (g.c.flags.includes('follower_hero') || g.c.job === 'hero_companion' ? 1 : 0.1), reward: { faith: 50 } },
];

// ===================== powers cast on the map =====================
export interface MapPower {
  id: string;
  name: string;
  icon: string;
  pool: 'faith' | 'dread';
  cost: number;
  desc: string;
  remove?: string[]; // country flags lifted
  add?: [string, number]; // flag set, ticks
  heroFx?: string; // applied if the protagonist lives there
  belief: number; // change if the protagonist lives there and sees it
  news: string; // {c}
}

export const MAP_POWERS: MapPower[] = [
  { id: 'rain', name: 'ฝนชุ่มฉ่ำ', icon: 'rain', pool: 'faith', cost: 15, desc: 'ยุติความอดอยากและพายุทราย', remove: ['famine', 'sandstorm'], heroFx: 'gold+5', belief: 6, news: 'ฝนห่าใหญ่ตกทั่ว{c} ยุติความแห้งแล้ง' },
  { id: 'harvest', name: 'อวยพรแผ่นดิน', icon: 'wheat', pool: 'faith', cost: 25, desc: 'ประเทศเข้าสู่ยุคทอง ผู้คนมั่งคั่ง', add: ['golden', 16], heroFx: 'gold+20', belief: 8, news: 'พืชผลทั่ว{c}งอกงามเป็นประวัติการณ์' },
  { id: 'cure', name: 'ขับไล่โรคร้าย', icon: 'heal', pool: 'faith', cost: 20, desc: 'ยุติโรคระบาด รักษาผู้คน', remove: ['plague'], heroFx: 'hp+30', belief: 8, news: 'โรคระบาดใน{c}หายไปอย่างไร้ร่องรอย' },
  { id: 'holylight', name: 'แสงศักดิ์สิทธิ์', icon: 'bless', pool: 'faith', cost: 30, desc: 'ขับไล่ปีศาจ อันเดด และจันทร์สีเลือด', remove: ['demon_raid', 'demon_gate', 'undead_rising', 'bloodmoon', 'long_night'], belief: 12, news: 'ลำแสงสีทองพุ่งลงกลาง{c} สิ่งชั่วร้ายแตกสลาย' },
  { id: 'peace', name: 'สงบศึก', icon: 'friend', pool: 'faith', cost: 30, desc: 'ยุติสงครามและการรุกราน', remove: ['war', 'horde', 'holy_war', 'pirate_raid'], belief: 6, news: 'แม่ทัพทั้งสองฝ่ายใน{c}ฝันเห็นสิ่งเดียวกัน และวางอาวุธ' },
  { id: 'lightning', name: 'สายฟ้าฟาด', icon: 'rival', pool: 'dread', cost: 10, desc: 'ฟ้าผ่าลงกลางเมือง ผู้คนหวาดกลัว', heroFx: 'hp-8', belief: -3, news: 'สายฟ้าฟาดลงกลางเมืองหลวงของ{c} ผู้คนแตกตื่น' },
  { id: 'plague', name: 'ส่งโรคระบาด', icon: 'plague', pool: 'dread', cost: 20, desc: 'โรคร้ายแพร่ระบาดในประเทศ', add: ['plague', 10], belief: -8, news: 'โรคประหลาดเริ่มระบาดใน{c}' },
  { id: 'quake', name: 'แผ่นดินไหว', icon: 'quake', pool: 'dread', cost: 20, desc: 'บ้านเมืองพังพินาศ ผู้คนอดอยาก', add: ['famine', 8], remove: ['golden'], heroFx: 'hp-15', belief: -6, news: 'แผ่นดินไหวครั้งใหญ่ถล่ม{c}' },
  { id: 'meteor', name: 'อุกกาบาต', icon: 'meteor', pool: 'dread', cost: 35, desc: 'ทำลายกองทัพ ยุติสงครามด้วยความกลัว', remove: ['war', 'horde', 'demon_raid'], heroFx: 'hp-10', belief: -8, news: 'อุกกาบาตตกกลางสนามรบใน{c} สงครามยุติลงด้วยความหวาดกลัว' },
];
