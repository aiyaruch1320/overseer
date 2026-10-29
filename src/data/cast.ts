// Gives every one of the 572 NPCs of docs/npcs a look of their own, derived from what the docs say about them: the people and
// sub-line they belong to, their age (scaled to their race's lifespan), their sex where the title or name tells it, and their role
// (a queen is dressed as a queen, a smith as a smith). The 33 in specials.ts are designed by hand instead.
import { NPC_CAST, type CastRow } from './npcCast';
import { specialById, specialStageLook } from './specials';
import { lookFor } from '../scenes/people';
import { RNG, hashString } from '../sim/rng';
import { stageOf } from '../render/characters/themes';
import { mix, type Look } from '../render/characters/kit';
import { birthOf, climateOfCode, type Birth } from './birth';

export interface Cast { id: string; name: string; people: string; role: string; chance: number; race: string; line?: string; fem: boolean; hAge: number; look: Look; special: boolean; birth: Birth; blend?: string }

// how the docs name a people -> [race, sub-line, extra painter features]
const PEOPLE: [RegExp, string, string?, string[]?][] = [
  [/อาเวียนปีกเกล็ด|ปีกเกล็ด/, 'winged', 'scale'], [/ปีกราตรี/, 'winged', 'night'], [/ปีกสั้น/, 'winged', 'short'], [/ปีกฟ้า|ชาวน้ำฟ้า/, 'winged', 'sky'],
  [/อาเวียน|ลูกหลานปีก|ปีกพลัดถิ่น/, 'winged', 'white'], [/เงือกปีก/, 'merfolk', 'merrow', ['wings:feather']],
  [/ชาวพื้น/, 'human', 'ground'], [/ผู้กลับชาติ/, 'human', 'reborn'], [/ผู้ถูกอัญเชิญ|ต่างภพ/, 'human', 'summoned'], [/ชาวหมอก|มนุษย์เงา/, 'human', 'mist'],
  [/ชนผืนทราย|ชนใต้ทราย/, 'human', 'sand'], [/มนุษย์เรือ/, 'human', 'ship'], [/มนุษย์น้ำแข็ง/, 'human', 'plain'], [/มนุษย์กึ่งจักรกล|มนุษย์ผู้ติดตั้ง/, 'construct', 'installed'],
  [/ผู้ไร้เงา/, 'human', 'mist', ['noshadow']], [/ผีเอลฟ์/, 'elf', 'moon', ['noshadow']], [/ผีเมือง|วิญญาณ|^ผี$/, 'human', 'mist', ['noshadow']],
  [/เอลฟ์สูง|เอลฟ์ผู้เฒ่า/, 'elf', 'high'], [/เอลฟ์จันทรา/, 'elf', 'moon'], [/เอลฟ์ฟ้า/, 'elf', 'sky'], [/เอลฟ์ใต้ดิน/, 'elf', 'root'], [/เอลฟ์ครึ่งเผ่าสัตว์/, 'elf', 'tree', ['tail:fluffy']], [/เอลฟ์/, 'elf', 'tree'],
  [/ดรูอิด/, 'elf', 'root'], [/ดาร์กเอลฟ์/, 'darkelf'],
  [/คนแคระเหนือ/, 'dwarf', 'north'], [/คนแคระช่าง/, 'dwarf', 'smith'], [/คนแคระ/, 'dwarf'],
  [/โอเกอร์/, 'orc', 'ogre'], [/ออร์คเบา/, 'orc', 'peace'], [/ออร์ค/, 'orc'], [/ฮาล์ฟลิง/, 'halfling'],
  [/หมาป่า/, 'beast', 'wolf'], [/เสือ|แมว|สิงโต/, 'beast', 'cat'], [/กวาง|วัว/, 'beast', 'deer'], [/นก/, 'beast', 'bird'], [/อูฐ|จิ้งจก/, 'beast', 'sand'], [/จิ้งจอก|หมี|เผ่าสัตว์/, 'beast', 'wolf'],
  [/นาคาลูกครึ่ง/, 'naga', 'half'], [/นาคา/, 'naga', 'river'], [/เผ่ามังกร/, 'dragonkin', 'fire'], [/แวมไพร์/, 'vampire', 'noble'],
  [/ภูตแสง/, 'fae', 'light'], [/ภูตลม/, 'fae', 'wind'], [/ภูตน้ำ/, 'fae', 'water'], [/ภูตจิ๋ว/, 'fae', 'tiny'], [/ภูต/, 'fae'],
  [/เห็ด/, 'slime', 'mushroom'], [/สไลม์ทะเล/, 'slime', 'sea'], [/สไลม์/, 'slime', 'forest'],
  [/ปีศาจผู้ถูกกักขัง|เผ่าปีศาจ|ปีศาจ/, 'demonkin'], [/เงือกน้ำลึก|สัตว์ทะเลลึก|สัตว์ยักษ์ทะเล|ผู้ดูแลวาฬ/, 'merfolk', 'deep'], [/ไซเรน/, 'merfolk', 'siren'], [/กัปปะ/, 'merfolk', 'kappa'], [/เงือก/, 'merfolk', 'merrow'],
  [/ยักษ์ผู้สละโลก/, 'giant', 'silent'], [/ยักษ์ช่าง/, 'giant', 'smith'], [/ยักษ์|ชาวหิน/, 'giant'], [/เผ่าลาวา/, 'lavakin'],
  [/ตุ๊กตา/, 'construct', 'doll'], [/ลูกผสมจักรกล|มนุษย์เมคาเรีย/, 'construct', 'installed'], [/หุ่น/, 'soulmachine', 'brass'], [/มัมมี่/, 'mummy', 'servant'], [/กูล/, 'ghoul', 'banner'],
  [/มนุษย์ผู้ได้พรไฟ/, 'human', 'plain', ['embers']], [/มนุษย์เร่ร่อน|มนุษย์พเนจร|นักลักลอบ|ผู้ลี้ภัย|ผู้หลงทาง|ผู้ถูกเนรเทศ/, 'human', 'plain'], [/ไม่ทราบ|ไม่เปิดเผย|ผสม/, 'human', 'mist', ['noshadow']], [/มนุษย์/, 'human'],
];
const LIFESPAN: Record<string, number> = { human: 75, elf: 700, darkelf: 600, dwarf: 300, orc: 60, halfling: 120, beast: 70, naga: 400, dragonkin: 200, vampire: 1000, fae: 300, slime: 150, demonkin: 150, merfolk: 250, winged: 120, giant: 400, lavakin: 140, construct: 120, soulmachine: 300, mummy: 500, ghoul: 80 };
const FEM = /ราชินี|นาง|หญิง|มารดา|แม่|ย่า|ป้า|เลดี้|นักบวชหญิง|ธิดา|สตรี|เจ้าหญิง|พระนาง|ดร\.เฮเลน่า|ราชินี/;
const SEXLESS = new Set(['slime', 'soulmachine']);

// what a role wears: [pattern, outfit, hat, tool]
const ROLES: [RegExp, string, string, string][] = [
  [/ราชา|กษัตริย์|จักรพรรดิ|พระเจ้า|ราชินี|สุลต่าน|ฟาโรห์|เจ้าผู้ครอง|ดยุก|เคานต์|ประมุข|เจ้าหญิง|พระราชินี|ราชันย์/, 'regal', 'crown', 'scepter'],
  [/สังฆราช|นักบวช|มหาพิธีกร|ผู้ปรนนิบัติ|ภิกษุ|พระ|สงฆ์|ผู้ไว้อาลัย|มหาสังฆราช|ผู้ตีระฆัง|ผู้ฟังวิญญาณ|ผู้ถือกุญแจ/, 'priest', 'hood', 'staff'],
  [/อัศวิน|จอมพล|ขุนศึก|นายพล|ผู้บัญชาการ|ทหาร|แม่ทัพ|ผู้เฝ้า|ยาม|นายอำเภอ|พลเรือ/, 'knight', 'helmet', 'sword'],
  [/นักเวท|นักเล่นแร่|ผู้ปรุงยา|นักบำบัด|หมอ|แพทย์|เดรุยด์|ดรูอิด|ผู้ฟัง/, 'mage', 'wizard', 'orbstaff'],
  [/นักปราชญ์|บรรณารักษ์|อธิการ|ผู้ตีความ|ครู|นักวิชาการ|นักประดิษฐ์|ผู้อ่านลม|ผู้บันทึก|นักอ่าน/, 'scholar', '', 'book'],
  [/ช่างตี|ช่างเหล็ก|ช่างหิน|มือทั่ง|ช่างอาวุธ|ช่างศึก|ผู้ตีเหล็ก/, 'apron', '', 'hammer'],
  [/วิศวกร|ช่างกล|ช่างซ่อม|ช่างเฒ่า|ช่าง|นายอู่|สภาช่าง/, 'leather', 'goggles', 'hammer'],
  [/พ่อค้า|นายธนาคาร|นายหน้า|ตลาด|ธนาคาร|ผู้ซื้อ|เจ้าของ/, 'vest', 'cap', 'ledger'],
  [/กัปตัน|ชาวเรือ|กะลาสี|เรือ|นายท่า|ประธานสภาตระกูลเรือ|โจรสลัด/, 'sailor', 'bandana', 'rod'],
  [/นายพราน|นักล่า|นักธนู|ผู้ฝึกสัตว์|ผู้ล่า/, 'leather', 'hood', 'bow'],
  [/ชาวนา|ชาวสวน|คนเลี้ยง|เกษตร|ผู้ดูแลวาฬ/, 'farmer', 'straw', 'hoe'],
  [/โจร|นักฆ่า|เงา|สายลับ|ลักลอบ|ผู้ไร้/, 'cloak', 'hood', ''],
  [/กวี|นักดนตรี|ผู้เล่านิทาน|นักร้อง|นักเต้น|ครูใหญ่ไซเรน/, 'bard', 'feather', 'lute'],
  [/สหภาพ|แรงงาน|คนงาน|คนล้าง|คนเหมือง|ประธานสภาแรงงาน/, 'miner', 'minerhat', 'pickaxe'],
  [/นายก|ประธาน|ผู้ว่า|ผู้นำ|หัวหน้า|นายกเมือง|ผู้ปกครอง|ผู้ประสาน|นายกฯ|ท่านประธาน/, 'noble', '', 'scroll'],
  [/เด็ก|ลูก/, 'tunic', '', ''],
];

const humanAge = (row: CastRow, race: string, blend?: string): number => {
  const raw = row[3].replace(/,/g, '');
  const dead = /ตายมา/.test(raw);
  const n = parseFloat(raw.match(/\d+(\.\d+)?/)?.[0] ?? '');
  if (/เด็ก/.test(row[2]) || /เด็ก/.test(row[4])) return 8;
  if (!Number.isFinite(n)) return 35 + (hashString(row[0]) % 30);
  if (dead) return 68;
  // a half-blood lives between the lifespans of the two peoples, and one with a title is never a child
  const span = blend ? ((LIFESPAN[race] || 75) + (LIFESPAN[blend] || 75)) / 2 : LIFESPAN[race] || 75;
  const age = Math.max(1, Math.min(95, (n * 75) / span));
  return blend && age < 13 && !/เด็ก/.test(row[1] + row[4]) && n > 20 ? 22 + (hashString(row[0]) % 20) : age;
};

// the second people of a half-blood: "มนุษย์ครึ่งเงือก" is a human raised among humans with a merfolk parent
const SECOND: [RegExp, string][] = [
  [/ดาร์กเอลฟ์/, 'darkelf'], [/เอลฟ์/, 'elf'], [/มนุษย์/, 'human'], [/คนแคระ/, 'dwarf'], [/ออร์ค/, 'orc'], [/ฮาล์ฟลิง/, 'halfling'], [/เผ่าสัตว์|หมาป่า/, 'beast'], [/นาคา/, 'naga'],
  [/เผ่ามังกร/, 'dragonkin'], [/แวมไพร์/, 'vampire'], [/ภูต/, 'fae'], [/เผ่าปีศาจ/, 'demonkin'], [/เงือก/, 'merfolk'], [/เผ่าปีก/, 'winged'], [/ยักษ์/, 'giant'], [/เผ่าลาวา/, 'lavakin'],
];
const MIXED_POOL = ['elf', 'orc', 'dwarf', 'halfling'];

function parsePeople(people: string, id: string): { race: string; line?: string; extra: string[]; blend?: string } {
  const resolve = (text: string) => { for (const [re, r, l, ex] of PEOPLE) if (re.test(text)) return { race: r, line: l, extra: ex || [] }; return { race: 'human', line: undefined, extra: [] as string[] }; };
  const hy = people.match(/^(.+?)ครึ่ง(.+)$/);
  if (hy) {
    const sec = SECOND.find(([re]) => re.test(hy[2]));
    if (sec) return { ...resolve(hy[1]), blend: sec[1] };
    if (/สองสาย/.test(hy[2])) return { ...resolve(hy[1]), blend: 'dragonkin' };
  }
  if (/^ฮาล์ฟออร์ค/.test(people)) return { race: 'human', extra: [], blend: 'orc' };
  if (/เลือดผสม/.test(people)) return { ...resolve(people.replace('เลือดผสม', '')), blend: 'human' };
  if (people === 'ผสม') return { race: 'human', extra: [], blend: MIXED_POOL[hashString('mixed:' + id) % MIXED_POOL.length] };
  return resolve(people);
}

export function castOf(row: CastRow): Cast {
  const [id, name, people, , role, chance, flag = '', note = ''] = row;
  const sp = specialById(id);
  const parsed = sp ? { race: sp.race, line: sp.line, extra: [] as string[], blend: sp.blend } : parsePeople(people, id);
  const birth = birthOf(id, parsed.race, parsed.blend, flag, note);
  if (sp) {
    const hAge = sp.age;
    return { id, name: sp.name, people, role: sp.title, chance, race: sp.race, line: sp.line, fem: sp.fem, hAge, look: specialStageLook(sp.id, hAge < 13 ? 'child' : hAge < 20 ? 'teen' : hAge < 55 ? 'adult' : 'elder')!, special: true, birth, blend: sp.blend };
  }
  const { race, line, extra, blend } = parsed;
  const hAge = humanAge(row, race, blend);
  const rng = new RNG(hashString('cast:' + id));
  const fem = !SEXLESS.has(race) && (FEM.test(name + ' ' + role + ' ' + people) || (!/ชาย|ราชา|พระเจ้า|จักรพรรดิ|สังฆราช/.test(role + people) && rng.chance(0.42)));
  const look = lookFor('cast:' + id, race, 'ชาวบ้าน', { gender: fem ? 'หญิง' : 'ชาย', hAge, line, climate: climateOfCode(birth.code), blend });
  const r = ROLES.find(([re]) => re.test(role + ' ' + name));
  if (r) {
    look.outfit = r[1]; look.hat = r[2]; look.tool = r[3];
    if (r[1] === 'regal') { look.cloth = mix(look.cloth, 0x6a1a2a, 0.5); look.cloth2 = 0xf2c94c; }
    if (r[1] === 'priest') { look.cloth = 0xf2eee0; look.cloth2 = look.accent ?? 0xd9a030; if (rng.chance(0.5)) look.hat = 'mitre'; }
    if (r[1] === 'knight' && fem) look.hat = '';
    if (r[1] === 'regal' && fem) look.hat = rng.chance(0.5) ? 'tiara' : 'crown';
  }
  if (hAge < 13) { look.outfit = 'tunic'; look.hat = ''; look.tool = ''; }
  look.extra = [...(look.extra || []), ...extra];
  look.special = id; look.role = role;
  look.sig = undefined;
  return { id, name, people, role, chance, race, line, fem, hAge, look, special: false, birth, blend };
}

const CAST = new Map<string, Cast>();
export function castById(id: string): Cast | undefined {
  let c = CAST.get(id);
  if (!c) { const row = NPC_CAST.find((r) => r[0] === id); if (row) { c = castOf(row); CAST.set(id, c); } }
  return c;
}

/** the cast of a country by its code (AZ-01): leaders always, the others by the chance the docs give them */
export function castForCountry(code: string, worldSeed = 0): Cast[] {
  const key = code.replace('-', '');
  const out: Cast[] = [];
  for (const row of NPC_CAST) {
    if (!row[0].startsWith(key + '-')) continue;
    const leader = row[0].endsWith('-1');
    const roll = new RNG(hashString(`appear:${worldSeed}:${row[0]}`)).next() * 100;
    if (leader || roll < row[5]) out.push(castById(row[0])!);
  }
  return out;
}

export const castCount = () => NPC_CAST.length;
