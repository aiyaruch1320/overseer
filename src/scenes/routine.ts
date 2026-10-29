// The daily life of the people of a town. Everyone has a home, a trade tied to a real building (the priest to the temple, the smith to the
// forge, the merchant to a stall), a clock they follow (dawn, work, a meal at noon, the evening, sleep) and needs that send them to other
// buildings: hunger to the tavern or a stall, faith to the temple, sickness to the hospital. Going indoors is real: they walk to the door,
// vanish inside (the window lights at night) and come out again later. CityScene owns the stage; this file decides what each person does next.
import { POSE } from './people';
import type { CityScene, Person } from './CityScene';
import type { BuildingRec, Pt } from '../city/citygen';
import { T } from '../city/citygen';
import type { Place } from '../data/npclife';
import { themeOf } from '../render/characters/themes';
import type { PersonImage } from '../render/characters/sprite';

export const DAY_LEN = 150; // seconds of real time for a full day in town

// ---------- buildings by what people do in them ----------
export type Fn = 'home' | 'worship' | 'market' | 'inn' | 'forge' | 'study' | 'court' | 'heal' | 'barracks' | 'store' | 'port' | 'mine';
const FN: Record<string, Fn> = {
  house: 'home', temple: 'worship', cathedral: 'worship', market: 'market', shops: 'market', tavern: 'inn', smithy: 'forge', guild: 'study', library: 'study',
  palace: 'court', bank: 'court', hospital: 'heal', barracks: 'barracks', fortress: 'barracks', drill: 'barracks', arena: 'barracks', granary: 'store', warehouse: 'store',
  minehead: 'mine', aerie: 'port', skydock: 'port',
};
const NAME: Record<string, string> = {
  house: 'บ้าน', temple: 'วิหาร', cathedral: 'มหาวิหาร', market: 'ตลาด', shops: 'ร้านค้า', tavern: 'โรงเตี๊ยม', smithy: 'โรงตีเหล็ก', guild: 'หอสมาคม', library: 'หอสมุด',
  palace: 'ศาลากลาง', bank: 'ห้องคลัง', hospital: 'โรงพยาบาล', barracks: 'ค่ายทหาร', fortress: 'ป้อมปราการ', drill: 'ลานฝึกทหาร', arena: 'ลานประลอง', granary: 'ยุ้งฉาง',
  warehouse: 'โกดัง', minehead: 'ปากเหมือง', aerie: 'รังนก', skydock: 'ท่าเรือฟ้า',
};

export interface Venue { i: number; b: BuildingRec; fn: Fn; name: string; door: Pt; inside: Person[]; staff: Person[] }

/** everything a person remembers about their own day */
export interface Life {
  homeV?: Venue; workV?: Venue; station?: Pt; stall?: Pt; trade?: Trade;
  doing: string; inside?: Venue; sleeping?: boolean; wakeAt?: number;
  hunger: number; shop: number; piety: number; sick: boolean; nightShift: boolean; lastErrand: string;
}

// ---------- the day ----------
export type Phase = 'night' | 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening';
export const phaseOfDay = (f: number): Phase => (f < 0.02 || f >= 0.82 ? 'night' : f < 0.08 ? 'dawn' : f < 0.38 ? 'morning' : f < 0.5 ? 'noon' : f < 0.72 ? 'afternoon' : 'evening');
/** the town clock: day runs 6:00 to 18:00 across the first three quarters, the night the rest */
export const clockOf = (f: number): string => {
  const h = f < 0.75 ? 6 + (f / 0.75) * 12 : (18 + ((f - 0.75) / 0.25) * 12) % 24;
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
};

// ---------- what the hands do ----------
interface Act { frames: number[]; fps: number; fx?: 'spark' | 'dust' | 'chip' | 'steam' | 'splash' | 'sparkle' | 'note' | 'halo' | 'none' }
const P = POSE;
export const ACT: Record<string, Act> = {
  hammer: { frames: [P.work0, P.work1], fps: 2.4, fx: 'spark' },
  hoe: { frames: [P.work0, P.work1], fps: 1.5, fx: 'dust' },
  chop: { frames: [P.work0, P.work1], fps: 1.8, fx: 'chip' },
  dig: { frames: [P.work0, P.work1], fps: 1.6, fx: 'dust' },
  train: { frames: [P.work1, P.work0, P.work1, P.salute], fps: 2.6, fx: 'spark' },
  sweep: { frames: [P.sweep0, P.sweep1], fps: 1.3, fx: 'dust' },
  cook: { frames: [P.stir0, P.stir1], fps: 1.6, fx: 'steam' },
  brew: { frames: [P.stir0, P.stir1, P.stir0, P.cheer2], fps: 1.2, fx: 'sparkle' },
  herb: { frames: [P.stir0, P.stir1], fps: 1, fx: 'sparkle' },
  sew: { frames: [P.sew0, P.sew1], fps: 1.1, fx: 'none' },
  write: { frames: [P.write, P.sit2], fps: 0.8, fx: 'none' },
  read: { frames: [P.read, P.read, P.idle3], fps: 0.9, fx: 'none' },
  cast: { frames: [P.cast0, P.cast1, P.idle, P.cast0], fps: 1.2, fx: 'sparkle' },
  sing: { frames: [P.cheer2, P.talk0, P.cheer2, P.talk1], fps: 1.6, fx: 'note' },
  pray: { frames: [P.kneel, P.kneel2], fps: 0.8, fx: 'halo' },
  bless: { frames: [P.bless0, P.bless1], fps: 0.8, fx: 'halo' },
  beg: { frames: [P.kneel, P.sit, P.kneel2], fps: 0.5, fx: 'none' },
  wash: { frames: [P.kneel, P.work0], fps: 1.3, fx: 'splash' },
  fish: { frames: [P.fish0, P.fish0, P.fish0, P.fish1], fps: 0.7, fx: 'splash' },
  sell: { frames: [P.hawk0, P.hawk1, P.talk0, P.hawk1], fps: 1.1, fx: 'none' },
  tend: { frames: [P.idle, P.breath, P.idle3], fps: 0.7, fx: 'none' },
  aim: { frames: [P.aim, P.aim, P.idle, P.aim], fps: 0.8, fx: 'none' },
  guard: { frames: [P.salute, P.idle, P.idle2, P.breath], fps: 0.6, fx: 'none' },
  knock: { frames: [P.knock0, P.knock1, P.knock0, P.idle], fps: 2.6, fx: 'none' },
  eat: { frames: [P.eat0, P.eat1], fps: 1.2, fx: 'none' },
  drink: { frames: [P.drink, P.sit, P.drink, P.sit2], fps: 0.9, fx: 'none' },
  bow: { frames: [P.bow, P.idle], fps: 0.9, fx: 'none' },
  talk: { frames: [P.talk0, P.talk1, P.idle, P.talk0], fps: 2, fx: 'none' },
  chat: { frames: [P.idle, P.talk0, P.breath, P.talk1], fps: 1.6, fx: 'none' },
  cough: { frames: [P.cough, P.idle], fps: 1.4, fx: 'none' },
  rest: { frames: [P.sit, P.sit2], fps: 0.8, fx: 'none' },
  bench: { frames: [P.sit, P.sit2, P.sit], fps: 0.6, fx: 'none' },
  play: { frames: [P.cheer, P.idle, P.cheer2, P.wave0], fps: 3, fx: 'none' },
  fest: { frames: [P.cheer, P.idle, P.cheer, P.breath], fps: 3.2, fx: 'note' },
  stand: { frames: [P.idle, P.breath], fps: 1, fx: 'none' },
};

// ---------- trades: where each is practised and what a working day is made of ----------
type Dest = Fn | Place | 'stall' | 'home';
interface Task {
  k: 'work' | 'inside' | 'haul' | 'patrol' | 'serve' | 'visit' | 'roam'; w: number; text: string;
  act?: string; secs?: [number, number]; to?: Dest; say?: string[]; r?: number;
}
export interface Trade { site: Fn[]; at: 'door' | 'stall' | 'place'; place?: Place; tasks: Task[]; late?: boolean; lunch?: boolean }

export const TRADES: Record<string, Trade> = {
  farmer: { site: ['store'], at: 'place', place: 'field', tasks: [
    { k: 'work', w: 6, act: 'hoe', secs: [12, 24], text: 'ไถพรวนที่นา' }, { k: 'haul', w: 2, to: 'store', text: 'ขนผลผลิตไปยุ้งฉาง' }, { k: 'work', w: 1, act: 'rest', secs: [6, 10], text: 'นั่งพักกลางทุ่ง' }] },
  shepherd: { site: [], at: 'place', place: 'field', tasks: [
    { k: 'work', w: 5, act: 'tend', secs: [10, 20], text: 'เฝ้าดูฝูงสัตว์' }, { k: 'roam', w: 3, r: 6, text: 'เดินต้อนฝูง' }] },
  tamer: { site: [], at: 'place', place: 'field', tasks: [
    { k: 'work', w: 5, act: 'tend', secs: [10, 18], text: 'ฝึกสัตว์' }, { k: 'roam', w: 3, r: 6, text: 'พาสัตว์เดินออกกำลัง' }] },
  fisher: { site: ['market'], at: 'place', place: 'dock', lunch: true, tasks: [
    { k: 'work', w: 6, act: 'fish', secs: [14, 28], text: 'ตกปลาที่ท่าน้ำ' }, { k: 'haul', w: 2, to: 'stall', text: 'เอาปลาไปขายที่ตลาด' }] },
  sailor: { site: ['store', 'port'], at: 'place', place: 'dock', tasks: [
    { k: 'haul', w: 6, to: 'store', text: 'ขนสินค้าเข้าโกดัง' }, { k: 'work', w: 2, act: 'hammer', secs: [8, 14], text: 'ซ่อมเชือกและเรือ' }] },
  smith: { site: ['forge'], at: 'door', tasks: [
    { k: 'work', w: 6, act: 'hammer', secs: [12, 24], text: 'ตีเหล็กหน้าโรงตี' }, { k: 'inside', w: 2, secs: [8, 14], text: 'ดูเตาไฟในโรงตี' }, { k: 'haul', w: 1, to: 'stall', text: 'เอาของที่ตีไปขายที่ตลาด' }] },
  carpenter: { site: ['store', 'home'], at: 'door', tasks: [
    { k: 'work', w: 6, act: 'chop', secs: [10, 20], text: 'เลื่อยไสไม้' }, { k: 'visit', w: 2, to: 'home', act: 'knock', text: 'ไปซ่อมบ้านให้ลูกค้า' }] },
  woodcutter: { site: ['store'], at: 'place', place: 'tree', tasks: [
    { k: 'work', w: 7, act: 'chop', secs: [12, 22], text: 'ตัดไม้' }, { k: 'haul', w: 3, to: 'store', text: 'ขนฟืนไปโกดัง' }] },
  miner: { site: ['mine'], at: 'door', tasks: [
    { k: 'inside', w: 4, secs: [14, 26], text: 'ลงไปขุดแร่ในเหมือง' }, { k: 'work', w: 3, act: 'dig', secs: [10, 18], text: 'ทุบหินหน้าปากเหมือง' }, { k: 'haul', w: 2, to: 'store', text: 'ขนแร่ไปเก็บ' }] },
  merchant: { site: ['market'], at: 'stall', lunch: true, tasks: [
    { k: 'work', w: 8, act: 'sell', secs: [14, 26], text: 'ขายของที่แผง', say: ['ของสดจ้า!', 'ลดราคา วันนี้วันเดียว', 'มาดูก่อนได้นะ', 'ของดีราคาถูก'] },
    { k: 'haul', w: 1, to: 'store', text: 'ไปเอาของจากโกดังมาเติมแผง' }] },
  baker: { site: ['market'], at: 'stall', lunch: true, tasks: [
    { k: 'work', w: 4, act: 'cook', secs: [10, 18], text: 'นวดแป้งทำขนมปัง' }, { k: 'inside', w: 3, secs: [10, 18], text: 'อบขนมปังในร้าน' },
    { k: 'work', w: 3, act: 'sell', secs: [10, 18], text: 'ขายขนมปังร้อนๆ', say: ['ขนมปังร้อนๆ จ้า', 'หอมกรุ่นเพิ่งออกเตา'] }] },
  innkeeper: { site: ['inn'], at: 'door', late: true, lunch: true, tasks: [
    { k: 'inside', w: 4, secs: [12, 22], text: 'ดูแลลูกค้าในโรงเตี๊ยม' }, { k: 'serve', w: 3, text: 'ยกเครื่องดื่มไปเสิร์ฟ' }, { k: 'work', w: 1, act: 'cook', secs: [6, 10], text: 'เช็ดโต๊ะและเตรียมอาหาร' }] },
  guard: { site: ['barracks'], at: 'place', place: 'gate', late: true, lunch: true, tasks: [
    { k: 'patrol', w: 3, text: 'เดินตรวจตราเมือง' }, { k: 'work', w: 6, act: 'guard', secs: [14, 26], text: 'ยืนเฝ้าประตูเมือง', say: ['หยุดก่อน!', 'ผ่านไปได้', 'ใครอยู่ตรงนั้น?'] }, { k: 'inside', w: 1, secs: [8, 14], text: 'รายงานตัวในค่าย' }] },
  priest: { site: ['worship'], at: 'door', late: true, lunch: true, tasks: [
    { k: 'work', w: 4, act: 'bless', secs: [10, 18], text: 'ให้พรผู้คนหน้าวิหาร', say: ['ขอพรจงสถิตกับท่าน', 'ขอให้สงบสุข'] }, { k: 'inside', w: 3, secs: [14, 24], text: 'ประกอบพิธีในวิหาร' }, { k: 'work', w: 2, act: 'pray', secs: [8, 14], text: 'สวดมนต์หน้าวิหาร' }] },
  healer: { site: ['heal', 'worship'], at: 'door', lunch: true, tasks: [
    { k: 'inside', w: 4, secs: [12, 22], text: 'ดูแลรักษาผู้ป่วย' }, { k: 'visit', w: 2, to: 'home', act: 'knock', text: 'ไปตรวจอาการที่บ้านคนไข้' }, { k: 'work', w: 2, act: 'herb', secs: [8, 14], text: 'บดสมุนไพร' }] },
  scholar: { site: ['study', 'court'], at: 'door', tasks: [
    { k: 'inside', w: 5, secs: [16, 28], text: 'ค้นคว้าตำราในหอสมุด' }, { k: 'work', w: 2, act: 'write', secs: [10, 18], text: 'จดบันทึกการศึกษา' }, { k: 'roam', w: 1, r: 5, text: 'เดินครุ่นคิด' }] },
  mage: { site: ['study'], at: 'door', tasks: [
    { k: 'work', w: 4, act: 'cast', secs: [10, 18], text: 'ฝึกเวทหน้าสำนัก' }, { k: 'inside', w: 3, secs: [14, 24], text: 'ศึกษาคัมภีร์เวทในสำนัก' }, { k: 'work', w: 1, act: 'read', secs: [8, 14], text: 'อ่านตำราเวท' }] },
  alchemist: { site: ['study'], at: 'door', tasks: [
    { k: 'inside', w: 4, secs: [14, 24], text: 'ปรุงยาในห้องทดลอง' }, { k: 'work', w: 3, act: 'brew', secs: [10, 18], text: 'ต้มยาหน้าสำนัก' }] },
  bard: { site: ['inn'], at: 'door', late: true, tasks: [
    { k: 'work', w: 5, act: 'sing', secs: [14, 26], text: 'ขับร้องหน้าโรงเตี๊ยม' }, { k: 'roam', w: 2, r: 9, text: 'เดินร้องเพลงในเมือง' }, { k: 'inside', w: 2, secs: [12, 20], text: 'เล่นดนตรีในโรงเตี๊ยม' }] },
  tailor: { site: ['market', 'home'], at: 'door', tasks: [
    { k: 'work', w: 6, act: 'sew', secs: [14, 26], text: 'ตัดเย็บเสื้อผ้า' }, { k: 'visit', w: 2, to: 'home', act: 'knock', text: 'ไปส่งเสื้อผ้าให้ลูกค้า' }] },
  washer: { site: [], at: 'place', place: 'water', tasks: [
    { k: 'work', w: 7, act: 'wash', secs: [12, 22], text: 'ซักผ้าริมน้ำ' }, { k: 'haul', w: 2, to: 'home', text: 'ถือผ้าที่ซักแล้วกลับบ้าน' }] },
  hunter: { site: ['market'], at: 'place', place: 'tree', tasks: [
    { k: 'work', w: 4, act: 'aim', secs: [10, 18], text: 'ซุ่มล่าสัตว์' }, { k: 'haul', w: 3, to: 'stall', text: 'เอาเนื้อสัตว์ไปขายที่ตลาด' }, { k: 'roam', w: 1, r: 8, text: 'ตามรอยสัตว์' }] },
  adventurer: { site: ['study', 'barracks'], at: 'door', tasks: [
    { k: 'work', w: 5, act: 'train', secs: [12, 22], text: 'ซ้อมต่อสู้' }, { k: 'inside', w: 2, secs: [8, 14], text: 'ดูกระดานภารกิจ' }, { k: 'visit', w: 2, to: 'inn', text: 'ไปหาข่าวที่โรงเตี๊ยม' }] },
  beggar: { site: ['worship'], at: 'place', place: 'plaza', late: true, lunch: true, tasks: [
    { k: 'work', w: 8, act: 'beg', secs: [14, 28], text: 'นั่งขอทานกลางลาน' }, { k: 'roam', w: 1, r: 8, text: 'เดินหาที่นั่งใหม่' }] },
  noble: { site: ['court'], at: 'place', place: 'plaza', tasks: [
    { k: 'roam', w: 4, r: 8, text: 'เดินตรวจดูความเรียบร้อยของเมือง' }, { k: 'inside', w: 3, secs: [16, 28], text: 'ว่าราชการในศาลากลาง' }, { k: 'visit', w: 1, to: 'stall', text: 'ไปดูสินค้าที่ตลาด' }, { k: 'visit', w: 1, to: 'worship', text: 'ไปทำบุญที่วิหาร' }] },
  gravekeeper: { site: [], at: 'place', place: 'grave', tasks: [
    { k: 'work', w: 6, act: 'dig', secs: [12, 22], text: 'ขุดหลุมและดูแลสุสาน' }, { k: 'work', w: 3, act: 'tend', secs: [8, 14], text: 'ตัดหญ้าและจุดธูปที่หลุมศพ' }] },
  sweeper: { site: [], at: 'place', place: 'road', tasks: [
    { k: 'work', w: 6, act: 'sweep', secs: [12, 22], text: 'กวาดถนน' }, { k: 'roam', w: 3, r: 7, text: 'กวาดไปตามทาง' }] },
  courier: { site: ['court', 'study'], at: 'door', lunch: true, tasks: [
    { k: 'visit', w: 4, to: 'home', act: 'knock', text: 'ส่งจดหมายถึงบ้าน' }, { k: 'visit', w: 2, to: 'market', text: 'ส่งสารถึงร้านค้า' }, { k: 'roam', w: 2, r: 12, text: 'วิ่งส่งสารไปทั่วเมือง' }] },
};
const DEFAULT_TRADE: Trade = { site: [], at: 'place', place: 'plaza', tasks: [{ k: 'roam', w: 1, r: 8, text: 'เดินเล่น' }] };

/** the trade a person of the docs follows, read from what their title and dress say */
export function jobOfLook(role: string, outfit: string, tool: string): string | undefined {
  if (/หมอ|แพทย์|บำบัด|ปรุงยา/.test(role)) return 'healer';
  if (/ธนาคาร|พ่อค้า|นายหน้า|ตลาด/.test(role)) return 'merchant';
  const byOutfit: Record<string, string> = { regal: 'noble', noble: 'noble', priest: 'priest', robe: 'priest', knight: 'guard', armor: 'guard', plate: 'guard', mage: 'mage', scholar: 'scholar', apron: 'smith', vest: 'merchant', sailor: 'sailor', farmer: 'farmer', bard: 'bard', miner: 'miner', cloak: 'adventurer' };
  if (tool === 'bow') return 'hunter';
  if (outfit === 'leather') return 'carpenter';
  return byOutfit[outfit];
}

const BAD_WEATHER = new Set(['rain', 'storm', 'blizzard', 'sandstorm', 'ashfall', 'snow']);
const WORK_WEATHER = new Set(['guard', 'sailor', 'sweeper', 'courier', 'miner', 'smith', 'innkeeper', 'priest', 'healer', 'beggar']);

export class Routine {
  venues: Venue[] = [];
  private by: Record<Fn, Venue[]> = { home: [], worship: [], market: [], inn: [], forge: [], study: [], court: [], heal: [], barracks: [], store: [], port: [], mine: [] };
  private stalls: { pt: Pt; owner?: Person }[] = [];
  private houseAt = new Map<string, Venue>();
  private load = new Map<Venue, number>(); // how many people live in each house

  constructor(private s: CityScene) {
    s.buildings.forEach((b, i) => {
      const fn = FN[b.kind] ?? 'court';
      const v: Venue = { i, b, fn, name: NAME[b.kind] ?? 'อาคาร', door: { x: (b.x + Math.floor(b.w / 2)) * T + T / 2, y: (b.y + b.h) * T + T - 2 }, inside: [], staff: [] };
      this.venues.push(v); this.by[fn].push(v);
      if (fn === 'home') this.houseAt.set(`${v.door.x},${v.door.y}`, v);
    });
    this.stalls = s.plan.stalls.map((st) => ({ pt: { x: st.x + 11, y: st.y + 26 } }));
  }

  // ---------- who lives and works where ----------
  houseDoors(): Pt[] { return this.by.home.map((v) => v.door); }

  private dist(a: Pt, b: Pt) { return Math.hypot(a.x - b.x, a.y - b.y); }

  /** the venue of a kind closest to a point (one of the nearest three, so a district does not all queue at one door) */
  nearest(fn: Fn, from: Pt, not?: Venue): Venue | undefined {
    const list = this.by[fn].filter((v) => v !== not).sort((a, b) => this.dist(a.door, from) - this.dist(b.door, from)).slice(0, 3);
    return list.length ? this.s.rng.pick(list) : undefined;
  }

  private front(v: Venue, k: number): Pt { return { x: v.door.x + ((k % 5) - 2) * 8, y: v.door.y + 3 + Math.floor(k / 5) * 7 }; }

  /** give a new townsperson a home, a place of work and a station at it */
  settle(p: Person) {
    const s = this.s, r = s.rng;
    const L: Life = { doing: '', hunger: r.float(0, 0.6), shop: r.float(0, 0.7), piety: r.float(0.1, 1), sick: false, nightShift: false, lastErrand: '' };
    p.life = L;
    L.homeV = p.home ? this.houseAt.get(`${p.home.x},${p.home.y}`) : undefined;
    const job = p.job;
    if (job && !p.look.child) {
      const tr = TRADES[job.id] ?? DEFAULT_TRADE;
      L.trade = tr;
      const near = p.home ?? { x: p.root.x, y: p.root.y };
      // outdoor trades pick their ground first (a field, a stretch of shore); then the building they belong to and the house they live in are the nearest to it
      let anchor: Pt = near;
      if (tr.at === 'place') {
        const place = tr.place ?? job.place;
        let st = s.spot(place, near);
        for (let k = 0; k < 4; k++) { const q = s.spot(place, near); if (this.dist(q, near) < this.dist(st, near)) st = q; }
        L.station = st; anchor = st;
      }
      let best: Venue | undefined;
      for (const fn of tr.site) {
        const cand = this.by[fn];
        if (!cand.length) continue;
        best = cand.slice().sort((a, b) => (a.staff.length * 60 + this.dist(a.door, anchor)) - (b.staff.length * 60 + this.dist(b.door, anchor)))[0];
        break;
      }
      if (best) { L.workV = best; best.staff.push(p); }
      if (tr.at === 'stall') {
        const free = this.stalls.filter((x) => !x.owner).sort((a, b) => this.dist(a.pt, best?.door ?? near) - this.dist(b.pt, best?.door ?? near))[0];
        if (free) { free.owner = p; L.stall = free.pt; L.station = free.pt; anchor = free.pt; }
      } else if (tr.at === 'door' && best) { L.station = this.front(best, best.staff.length - 1); anchor = L.station; }
      if (!L.station) { L.station = s.spot(tr.place ?? job.place, near); anchor = L.station; }
      // people live near where they work: a day of walking across a whole town would leave no time for the work itself
      if (!p.hero && this.by.home.length) {
        const free = this.by.home.slice().sort((a, b) => ((this.load.get(a) ?? 0) * 50 + this.dist(a.door, anchor)) - ((this.load.get(b) ?? 0) * 50 + this.dist(b.door, anchor)));
        const h = r.pick(free.slice(0, 5));
        L.homeV = h; p.home = h.door; p.root.setPosition(h.door.x + r.int(-8, 8), h.door.y + r.int(2, 6));
      }
      if (job.id === 'guard' && r.chance(0.35)) L.nightShift = true;
      if (job.id === 'innkeeper' || job.id === 'bard') L.nightShift = false;
    }
    if (!p.hero) p.goesHome = !(job?.id === 'beggar' && r.chance(0.6)) && !(job?.id === 'adventurer' && r.chance(0.4));
    if (L.homeV) this.load.set(L.homeV, (this.load.get(L.homeV) ?? 0) + 1);
    if (job?.id === 'priest' || job?.id === 'healer') L.piety = 1;
    if (s.country.flags.includes('plague') && r.chance(0.22)) L.sick = true;
    // some are already indoors when we arrive
    const roll = r.next();
    if (roll < 0.2 && L.workV && !p.hero && L.trade?.tasks.some((t) => t.k === 'inside')) this.hide(p, L.workV, r.float(2, 16), 'ทำงานอยู่ข้างใน');
    else if (roll < 0.28 && L.homeV && !p.hero) this.hide(p, L.homeV, r.float(2, 20), 'อยู่บ้าน');
  }

  // ---------- going in and out of buildings ----------
  private hide(p: Person, v: Venue, secs: number, doing: string, sleeping = false) {
    const L = p.life!;
    L.inside = v; L.sleeping = sleeping; L.doing = doing; v.inside.push(p);
    p.state = 'inside'; p.actT = secs; p.asleep = true; p.carry = false;
    p.root.setAlpha(0);
    if (p.mark) p.mark.setVisible(false);
  }

  /** walk to the door, go in, stay `secs`, come out */
  enter(p: Person, v: Venue, secs: number, doing: string, then?: () => void, sleeping = false, speed = p.speed) {
    const s = this.s, L = p.life!;
    L.doing = doing;
    if (p.hero) { s.go(p, { x: v.door.x + s.rng.int(-6, 6), y: v.door.y + 4 }, speed, () => s.doAct(p, ACT.stand, Math.min(secs, 6))); return; }
    s.go(p, v.door, speed, () => {
      if (this.dist({ x: p.root.x, y: p.root.y }, v.door) > T * 2.5) { p.wait = 1; return; } // no way there: stay out
      (p.img as PersonImage).face(0, -1);
      p.carry = false;
      L.inside = v; L.sleeping = sleeping; v.inside.push(p);
      p.state = 'inside'; p.actT = secs; p.asleep = true;
      s.tweens.add({ targets: p.root, alpha: 0, duration: 240 });
      if (p.mark) p.mark.setVisible(false);
      if (then) p.then = then;
    });
  }

  /** come out of the building they are in */
  leave(p: Person) {
    const L = p.life, v = L?.inside;
    if (!L || !v) { p.state = 'idle'; p.wait = 0.2; p.asleep = false; p.root.setAlpha(1); return; }
    v.inside = v.inside.filter((x) => x !== p);
    L.inside = undefined; L.sleeping = false; L.wakeAt = undefined;
    p.asleep = false; p.state = 'idle'; p.wait = this.s.rng.float(0.2, 1);
    p.root.setPosition(v.door.x + this.s.rng.int(-3, 3), v.door.y + 1);
    (p.img as PersonImage).face(0, 1);
    this.s.tweens.add({ targets: p.root, alpha: 1, duration: 240 });
    if (p.mark) p.mark.setVisible(true);
    const cb = p.then; p.then = undefined; cb?.();
  }

  occupied(i: number): number { return this.venues[i]?.inside.length ?? 0; }

  // ---------- clock and needs ----------
  frac() { return (this.s.dayT % DAY_LEN) / DAY_LEN; }
  phase(): Phase { return phaseOfDay(this.frac()); }

  /** per frame: hunger and the wish to shop grow, sleepers wake with the day, late revellers are sent home */
  tick(dt: number) {
    const s = this.s, ph = this.phase(), night = ph === 'night';
    const k = dt / (DAY_LEN * 0.5);
    for (const p of s.npcs) {
      const L = p.life; if (!L) continue;
      L.hunger = Math.min(1, L.hunger + k * 0.9); L.shop = Math.min(1, L.shop + k * 0.5);
      if (p.state !== 'inside' || !L.inside) continue;
      if (L.sleeping) {
        if (!night) { L.wakeAt ??= s.dayT + s.rng.float(0, 8); if (s.dayT >= L.wakeAt) this.leave(p); }
      } else if (night && p.goesHome && !L.nightShift && L.inside.fn !== 'home' && p.actT > 4) p.actT = s.rng.float(0.5, 4);
    }
  }

  // ---------- deciding what to do next ----------
  think(p: Person) {
    const s = this.s;
    if (!p.life) this.settle(p);
    const L = p.life!, ph = this.phase(), rng = s.rng;
    const here = { x: p.root.x, y: p.root.y };
    const co = s.country;
    const hero = !!p.hero;
    if (s.panic() && !hero) { this.shelter(p, 'หนีภัยเข้าไปหลบในอาคาร', 78); s.emote(p, 'warning'); return; }
    // night: everyone with a home goes to bed, night guards stay at their posts
    if (ph === 'night' && p.goesHome && !hero) {
      if (L.nightShift) { this.work(p, true); return; }
      this.sleep(p); return;
    }
    // storms and snow drive the outdoor workers indoors
    if (BAD_WEATHER.has(co.weather ?? '') && !hero && !WORK_WEATHER.has(p.job?.id ?? '') && rng.chance(0.55)) { this.shelter(p, 'หลบ' + weatherWord(co.weather!), p.speed * 1.3); return; }
    if (s.festival() && rng.chance(0.3)) { s.go(p, s.spot('plaza'), p.speed * 1.2, () => { L.doing = 'ร่วมงานเทศกาลกลางลาน'; s.doAct(p, ACT.fest, rng.float(5, 10)); }); L.doing = 'เดินไปร่วมงานเทศกาล'; return; }
    if (p.look.child) { this.child(p, ph); return; }
    if (L.sick) { this.ill(p); return; }
    const gz = themeOf(p.race).gesture; // a moment of their own people's habit: wings stretched, a hammer swung at nothing
    if (gz && !hero && rng.chance(0.06)) { L.doing = 'ท่าประจำเผ่า'; s.doAct(p, { frames: gz.frames, fps: gz.fps, fx: gz.fx as Act['fx'] }, rng.float(2.5, 4.5)); return; }

    // weigh the options of the hour
    const job = p.job?.id, tr = L.trade;
    const working = !!tr && this.onShift(p, ph);
    const opts: [number, () => void][] = [];
    const add = (w: number, f: () => void) => { if (w > 0) opts.push([w, f]); };
    if (working) add(ph === 'noon' ? 3 : 10, () => this.work(p));
    const noon = ph === 'noon', evening = ph === 'evening', dawn = ph === 'dawn';
    add(noon ? 9 : !working && L.hunger > 0.8 ? 4 : 0, () => this.eat(p));
    add(L.shop > 0.75 && !L.stall && (noon || (!working && !evening)) ? 4 : 0, () => this.buy(p));
    add((dawn || evening ? 2.4 : 0.5) * L.piety * (p.look.elder ? 1.8 : 1), () => this.worship(p));
    add(evening ? 5 : noon ? 1 : 0, () => this.drink(p));
    add(evening ? 3 : 0, () => this.home(p, 'กลับไปพักผ่อนที่บ้าน'));
    add(p.look.elder ? 4 : 0, () => this.sit(p));
    add(!working ? 3 : 0.6, () => this.chat(p));
    add(!working ? 1.2 : 0, () => this.stroll(p));
    add(!working ? 3 : 0.4, () => this.linger(p));
    if (!opts.length) add(1, () => this.stroll(p));
    const pick = rng.weighted(opts, (o) => o[0])!;
    void here; void job;
    pick[1]();
  }

  private onShift(p: Person, ph: Phase): boolean {
    const L = p.life!, tr = L.trade!;
    if (L.nightShift) return ph === 'evening' || ph === 'night';
    if (ph === 'night') return false;
    if (ph === 'evening') return !!tr.late;
    if (ph === 'noon') return !!tr.lunch && this.s.rng.chance(0.6);
    return true;
  }

  // ---------- the trade ----------
  work(p: Person, night = false) {
    const s = this.s, L = p.life!, tr = L.trade, rng = s.rng;
    if (!tr) { this.stroll(p); return; }
    const t = rng.weighted(tr.tasks, (x) => x.w)!;
    const secs = (t.secs ? rng.float(t.secs[0], t.secs[1]) : 8) * 1.4; // a working stretch is long next to the walk to it
    const base = L.station ?? { x: p.root.x, y: p.root.y };
    const at = { x: base.x + rng.int(-2, 2), y: base.y };
    const where = L.workV && t.k !== 'roam' ? ` · ${L.workV.name}` : '';
    const say = (a: string[] | undefined) => { if (a && rng.chance(0.35)) s.bubble(p.root, rng.pick(a), 2200); };
    if (night && p.job?.id === 'guard') { this.patrolOrStand(p, { ...t, k: 'work', act: 'guard', secs: [14, 24] }, at); return; }
    switch (t.k) {
      case 'work': {
        L.doing = t.text + where;
        s.go(p, at, p.speed, () => {
          s.doAct(p, ACT[t.act ?? 'tend'], secs); say(t.say);
          if (p.goal && rng.chance(0.15)) s.bubble(p.root, `อยาก${p.goal.replace(/^อยาก/, '')}`, 2800, '#4a3a6a'); // what they dream of while their hands work
        });
        break;
      }
      case 'inside': {
        if (!L.workV) { L.doing = t.text; s.go(p, at, p.speed, () => s.doAct(p, ACT.tend, secs)); break; }
        this.enter(p, L.workV, secs, t.text + where);
        break;
      }
      case 'haul': this.haul(p, t, at); break;
      case 'patrol': this.patrolOrStand(p, t, at); break;
      case 'serve': this.serve(p, t); break;
      case 'visit': this.visit(p, t); break;
      case 'roam': {
        L.doing = t.text;
        s.go(p, s.nearby(L.station ?? { x: p.root.x, y: p.root.y }, t.r ?? 8), p.speed * 0.7, () => { p.wait = rng.float(2, 5); });
        break;
      }
    }
  }

  /** carry something from the work station to a place and put it down (into a building: step inside for a moment) */
  private haul(p: Person, t: Task, at: Pt) {
    const s = this.s, L = p.life!, rng = s.rng;
    L.doing = t.text;
    const finish = () => { p.carry = false; p.wait = rng.float(0.6, 1.5); };
    const deliver = (target: Pt, v?: Venue) => {
      p.carry = true;
      s.go(p, target, p.speed, () => {
        if (v && !p.hero) { p.carry = false; this.enter(p, v, rng.float(2.5, 5), t.text, finish); } else finish();
      });
    };
    const dest = this.dest(p, t.to ?? 'plaza');
    s.go(p, at, p.speed, () => deliver(dest.pt, dest.v));
  }

  private patrolOrStand(p: Person, t: Task, at: Pt) {
    const s = this.s, L = p.life!, rng = s.rng;
    if (t.k === 'patrol' || !t.act) {
      L.doing = 'เดินตรวจตราเมือง';
      const legs = [s.spot('gate'), s.spot('plaza'), L.workV?.door ?? s.spot('road')];
      const next = (i: number) => {
        if (i >= legs.length) { p.wait = rng.float(0.5, 2); return; }
        s.go(p, legs[i], p.speed * 0.9, () => { if (rng.chance(0.5)) { s.doAct(p, ACT.guard, rng.float(2, 4)); this.after(p, () => next(i + 1)); } else next(i + 1); });
      };
      next(0);
      return;
    }
    L.doing = t.text;
    s.go(p, at, p.speed, () => { s.doAct(p, ACT.guard, rng.float(t.secs?.[0] ?? 8, t.secs?.[1] ?? 16)); if (rng.chance(0.3) && t.say) s.bubble(p.root, rng.pick(t.say), 2200); });
  }

  /** run `f` as soon as the current action (a pause, a stance) ends */
  private after(p: Person, f: () => void) { p.then = f; }

  private serve(p: Person, t: Task) {
    const s = this.s, L = p.life!, rng = s.rng, v = L.workV;
    L.doing = t.text;
    const table = v ? { x: v.door.x + rng.int(-22, 22), y: v.door.y + rng.int(6, 12) } : s.spot('plaza');
    const start = v ? v.door : { x: p.root.x, y: p.root.y };
    s.go(p, start, p.speed, () => {
      p.carry = true;
      s.go(p, table, p.speed, () => { p.carry = false; s.emote(p, 'mug'); s.doAct(p, ACT.bow, 1.6); });
    });
  }

  /** go to a building of a kind (a house, a stall, the temple), knock if asked, step inside */
  private visit(p: Person, t: Task) {
    const s = this.s, L = p.life!, rng = s.rng;
    L.doing = t.text;
    const dest = this.dest(p, t.to ?? 'home', true);
    const secs = rng.float(4, 9);
    s.go(p, dest.pt, p.speed, () => {
      const go = () => { if (dest.v && !p.hero) this.enter(p, dest.v, secs, t.text, () => { p.wait = rng.float(0.5, 1.5); }); else { s.doAct(p, ACT.bow, 1.8); } };
      if (t.act === 'knock' && dest.v) { s.doAct(p, ACT.knock, 1.5); this.after(p, go); } else go();
    });
  }

  // ---------- destinations ----------
  /** where a destination word leads: a spot to walk to and, for buildings, the building */
  private dest(p: Person, d: Dest, anyOther = false): { pt: Pt; v?: Venue } {
    const s = this.s, here = { x: p.root.x, y: p.root.y }, L = p.life!;
    if (d === 'stall') {
      const st = this.stallNear(here);
      return st ? { pt: { x: st.pt.x + s.rng.int(-9, 9), y: st.pt.y + 3 } } : { pt: s.spot('market') };
    }
    if (d === 'home') {
      const list = anyOther ? this.by.home.filter((v) => v !== L.homeV) : L.homeV ? [L.homeV] : this.by.home;
      const v = list.length ? this.nearestOf(list, here) : undefined;
      return v ? { pt: v.door, v } : { pt: s.spot('road') };
    }
    if (d in this.by) {
      const v = this.nearest(d as Fn, here);
      return v ? { pt: v.door, v } : { pt: s.spot('plaza') };
    }
    return { pt: s.spot(d as Place, here) };
  }

  /** one of the stalls nearest to a point */
  private stallNear(from: Pt): { pt: Pt; owner?: Person } | undefined {
    const l = this.stalls.slice().sort((a, b) => this.dist(a.pt, from) - this.dist(b.pt, from)).slice(0, 2);
    return l.length ? this.s.rng.pick(l) : undefined;
  }

  /** an errand is only worth the walk when it is not across the whole town */
  private reach(p: Person, to: Pt | undefined, max: number): boolean { return !!to && this.dist({ x: p.root.x, y: p.root.y }, to) <= max; }

  private nearestOf(list: Venue[], from: Pt): Venue {
    const l = list.slice().sort((a, b) => this.dist(a.door, from) - this.dist(b.door, from)).slice(0, 4);
    return this.s.rng.pick(l);
  }

  // ---------- the needs of a day ----------
  sleep(p: Person) {
    const L = p.life!, v = L.homeV;
    if (v) { this.enter(p, v, 9999, 'นอนหลับพักผ่อน', undefined, true); return; }
    const s = this.s;
    s.go(p, p.home ?? s.spot('home', { x: p.root.x, y: p.root.y }), p.speed, () => { p.asleep = true; L.doing = 'นอนหลับ'; s.tweens.add({ targets: p.root, alpha: 0, duration: 500 }); p.wait = 2; });
  }

  home(p: Person, doing: string) {
    const v = p.life!.homeV;
    if (!v) { this.stroll(p); return; }
    this.enter(p, v, this.s.rng.float(10, 22), doing);
  }

  shelter(p: Person, doing: string, speed: number) {
    const s = this.s, here = { x: p.root.x, y: p.root.y };
    const v = this.nearestOf(this.venues.filter((x) => x.fn !== 'store'), here);
    this.enter(p, v, s.rng.float(14, 26), doing, undefined, false, speed);
  }

  eat(p: Person) {
    const s = this.s, L = p.life!, rng = s.rng, here = { x: p.root.x, y: p.root.y };
    L.hunger = 0.1; L.lastErrand = 'eat';
    const inn = this.nearest('inn', here);
    const r = rng.next();
    if (r < 0.3 && L.station) { // a packed meal eaten at the place of work
      L.doing = 'กินข้าวห่อที่จุดทำงาน';
      s.go(p, L.station, p.speed, () => s.doAct(p, ACT.eat, rng.float(8, 14)));
      return;
    }
    if (inn && r < 0.5 && this.reach(p, inn.door, 520)) { this.enter(p, inn, rng.float(14, 24), 'กินข้าวที่โรงเตี๊ยม'); return; }
    if (r < 0.7 || !L.homeV || !this.reach(p, L.homeV.door, 460)) { // a bite from a stall, eaten on the spot
      const st = this.stallNear(here);
      if (st && this.reach(p, st.pt, 520)) {
        L.shop = 0; L.doing = 'ซื้ออาหารจากแผงขายของ';
        s.go(p, { x: st.pt.x + rng.int(-10, 10), y: st.pt.y + 4 }, p.speed, () => { this.trade(p, st.pt); this.after(p, () => { L.doing = 'กินข้าว'; s.doAct(p, ACT.eat, rng.float(6, 10)); }); });
        return;
      }
    }
    this.home(p, 'กินข้าวกลางวันที่บ้าน');
  }

  /** buy something from the nearest stall: a bow, a coin, goods in hand */
  buy(p: Person) {
    const s = this.s, L = p.life!, rng = s.rng;
    L.shop = 0; L.lastErrand = 'buy';
    const here = { x: p.root.x, y: p.root.y };
    const vendors = s.npcs.filter((x) => x.life?.stall && x.state === 'act' && !x.asleep).sort((a, b) => this.dist(a.life!.stall!, here) - this.dist(b.life!.stall!, here)).slice(0, 3);
    const v = vendors.length ? rng.pick(vendors) : undefined;
    const st = v?.life?.stall ?? this.stallNear(here)?.pt;
    if (!st || !this.reach(p, st, 560)) { L.shop = 0.3; this.stroll(p); return; }
    L.doing = v ? `ซื้อของจาก${v.name}ที่ตลาด` : 'เดินเลือกซื้อของที่ตลาด';
    const side = rng.chance(0.5) ? -13 : 13;
    s.go(p, { x: st.x + side, y: st.y + 4 }, p.speed, () => {
      this.trade(p, st, v);
      this.after(p, () => {
        const hv = L.homeV;
        if (!hv || rng.chance(0.65) || !this.reach(p, hv.door, 420)) { p.wait = rng.float(0.4, 1.2); return; } // the rest drops it off on the way home
        p.carry = true; L.doing = 'ถือของที่ซื้อกลับบ้าน';
        s.go(p, hv.door, p.speed, () => { p.carry = false; this.enter(p, hv, rng.float(6, 12), 'เก็บของที่ซื้อมา'); });
      });
    });
  }

  /** the exchange at a stall: the buyer bows and talks, the seller holds the goods up */
  private trade(p: Person, stall: Pt, seller?: Person) {
    const s = this.s, rng = s.rng;
    p.img.setFlipX(stall.x < p.root.x);
    s.doAct(p, ACT.talk, rng.float(2.4, 3.6));
    s.emote(p, 'gold');
    if (seller && rng.chance(0.5)) s.bubble(seller.root, rng.pick(['ขอบคุณจ้า', 'มาใหม่นะ', 'ของดีทั้งนั้น', 'ได้ราคาเลย']), 1800);
  }

  worship(p: Person) {
    const s = this.s, L = p.life!, rng = s.rng, here = { x: p.root.x, y: p.root.y };
    L.lastErrand = 'pray';
    const v = this.nearest('worship', here);
    if (!v || !this.reach(p, v.door, 800)) { this.stroll(p); return; }
    L.piety = Math.max(0.1, L.piety - 0.25);
    if (rng.chance(0.5)) this.enter(p, v, rng.float(10, 20), 'เข้าไปสวดมนต์ในวิหาร');
    else {
      L.doing = 'สวดมนต์หน้าวิหาร';
      s.go(p, { x: v.door.x + rng.int(-22, 22), y: v.door.y + rng.int(6, 12) }, p.speed, () => s.doAct(p, ACT.pray, rng.float(8, 14)));
    }
  }

  drink(p: Person) {
    const s = this.s, L = p.life!, rng = s.rng;
    const inn = this.nearest('inn', { x: p.root.x, y: p.root.y });
    L.lastErrand = 'drink';
    if (!inn || !this.reach(p, inn.door, 640)) { if (L.homeV) this.home(p, 'พักผ่อนที่บ้าน'); else this.chat(p); return; }
    L.hunger = 0.2;
    this.enter(p, inn, rng.float(16, 32), rng.pick(['ดื่มสังสรรค์ที่โรงเตี๊ยม', 'ฟังเพลงที่โรงเตี๊ยม', 'กินข้าวเย็นที่โรงเตี๊ยม']));
  }

  ill(p: Person) {
    const s = this.s, L = p.life!, rng = s.rng;
    const v = this.nearest('heal', { x: p.root.x, y: p.root.y }) ?? this.nearest('worship', { x: p.root.x, y: p.root.y });
    if (!v || rng.chance(0.3)) { L.doing = 'ป่วย ไอไม่หยุด'; s.doAct(p, ACT.cough, rng.float(3, 6)); s.emote(p, 'warning'); if (rng.chance(0.15)) L.sick = false; return; }
    this.enter(p, v, rng.float(14, 24), `ไปรักษาตัวที่${v.name}`, () => { if (rng.chance(0.7)) { L.sick = false; s.emote(p, 'heal'); } });
  }

  sit(p: Person) {
    const s = this.s, L = p.life!, base = p.home ?? { x: p.root.x, y: p.root.y };
    L.doing = 'นั่งพักชมบรรยากาศ';
    s.go(p, s.nearby(base, 6), p.speed, () => s.doAct(p, ACT.bench, s.rng.float(8, 18)));
  }

  /** stand a while where they are: watching the street, waiting, thinking */
  linger(p: Person) {
    const s = this.s;
    p.life!.doing = s.rng.pick(['ยืนพักชมบรรยากาศ', 'ยืนรอเพื่อน', 'ยืนมองผู้คนผ่านไปมา']);
    s.doAct(p, ACT.stand, s.rng.float(6, 14));
  }

  stroll(p: Person) {
    const s = this.s, L = p.life!, base = p.home ?? { x: p.root.x, y: p.root.y };
    L.doing = 'เดินเล่น';
    s.go(p, s.nearby(base, p.roam), p.speed, () => { p.wait = s.rng.float(3, 9); });
  }

  /** stop and talk with a neighbour */
  chat(p: Person) {
    const s = this.s, L = p.life!, rng = s.rng, here = { x: p.root.x, y: p.root.y };
    const near = s.npcs.filter((x) => x !== p && x.state !== 'locked' && x.state !== 'inside' && !x.asleep && Math.hypot(x.root.x - here.x, x.root.y - here.y) < T * 6);
    const o = near.length ? rng.pick(near) : undefined;
    if (!o) { this.stroll(p); return; }
    L.doing = `คุยกับ${o.name}`;
    s.go(p, { x: o.root.x + (p.root.x < o.root.x ? -12 : 12), y: o.root.y }, p.speed, () => {
      p.img.setFlipX(o.root.x < p.root.x);
      s.doAct(p, ACT.chat, rng.float(3, 6));
      if (rng.chance(0.5)) s.emote(p, 'bubble');
    });
  }

  // ---------- children ----------
  private child(p: Person, ph: Phase) {
    const s = this.s, L = p.life!, rng = s.rng, base = p.home ?? { x: p.root.x, y: p.root.y };
    if (ph === 'morning' && rng.chance(0.4)) {
      const school = this.nearest('study', base) ?? this.nearest('worship', base);
      if (school) { this.enter(p, school, rng.float(24, 40), 'ไปเรียนหนังสือ'); return; }
    }
    if (ph === 'noon' || (ph === 'evening' && rng.chance(0.5))) { this.home(p, 'กลับบ้านไปกินข้าว'); return; }
    if (rng.chance(0.5)) { L.doing = 'วิ่งเล่น'; s.go(p, s.nearby(base, 6), 44, () => s.doAct(p, ACT.play, rng.float(1, 2.5))); }
    else { L.doing = 'เดินเล่นแถวบ้าน'; s.go(p, s.nearby(base, 4), 38, () => { p.wait = rng.float(2, 6); }); }
  }

  /** the building under a point (in plan pixels), if any */
  venueAt(x: number, y: number): Venue | undefined {
    return this.venues.find((v) => x >= v.b.x * T && x < (v.b.x + v.b.w) * T && y >= v.b.y * T && y < (v.b.y + v.b.h) * T);
  }

  /** what the hover card of a building says: its name, who works there, who is inside now */
  describeBuilding(v: Venue): string {
    const bits = [`${v.name}${v.fn === 'home' ? '' : ''}`];
    if (v.fn === 'home') { const live = [...this.s.npcs].filter((n) => n.life?.homeV === v); bits.push(live.length ? `ผู้อยู่อาศัย: ${live.map((n) => n.name).join(', ')}` : 'บ้านว่าง'); }
    else if (v.staff.length) bits.push(`คนทำงาน ${v.staff.length} คน: ${v.staff.slice(0, 3).map((n) => n.name).join(', ')}${v.staff.length > 3 ? '…' : ''}`);
    if (v.inside.length) bits.push(`ตอนนี้มีคนอยู่ข้างใน ${v.inside.length} คน`);
    return bits.join('\n');
  }

  // ---------- what the stranger over the shoulder is doing, for the hover card ----------
  describe(p: Person): string[] {
    const L = p.life;
    if (!L) return [];
    const out: string[] = [];
    if (L.workV && p.job) out.push(`ทำงานที่: ${L.workV.name}`);
    else if (L.trade && p.job) out.push(`ทำงาน: ${p.job.role}`);
    if (L.homeV) out.push('มีบ้านอยู่ในเมือง');
    if (L.doing) out.push(`ตอนนี้: ${L.doing}`);
    if (L.sick) out.push('ไม่สบาย');
    return out;
  }
}

const weatherWord = (w: string) => ({ rain: 'ฝน', storm: 'พายุ', blizzard: 'พายุหิมะ', sandstorm: 'พายุทราย', ashfall: 'เถ้าถ่าน', snow: 'หิมะ' } as Record<string, string>)[w] ?? 'ลมฟ้า';
