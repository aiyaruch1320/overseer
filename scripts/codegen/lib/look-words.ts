// The words of the appearance docs that mean a part of the painter (code-plan §9.2: "ตารางคำ ขยายเมื่อพบคำใหม่").
// Every id here must be in src/art/parts/ids.ts (tests/codegen/looks.test.ts checks it). A word that no table knows is
// reported by the looks generator in data/gen/_unparsed/looks.md; the NPC still gets a complete Look from the defaults.
import { BEARD_IDS, HAIR_IDS, HAT_IDS, OUTFIT_IDS, TOOL_IDS, FEAT_IDS } from '../../../src/art/parts/ids';
import type { Ears, Gait, Lower, Stage } from '../../../src/art/look';
import type { LineOverrides } from '../../../src/core/data/types-looks';

export const VOCABULARY = { outfit: OUTFIT_IDS, hair: HAIR_IDS, beard: BEARD_IDS, hat: HAT_IDS, tool: TOOL_IDS, feat: FEAT_IDS } as const;

type Rule<T extends string> = [T, RegExp];
const first = <T extends string>(text: string, rules: Rule<T>[]): T | null => {
  for (const [id, re] of rules) if (re.test(text)) return id;
  return null;
};

// ---------- the words of 02-races.md ค่า UI (docs/appearance/README.md "คำของโค้ดที่ UI ใช้ตอนนี้") ----------

export const EARS_RULES: Rule<Ears>[] = [
  ['none', /ไม่มีหู/], ['fin', /ครีบ/], ['animal', /สัตว์/], ['long', /ยาว/], ['pointed', /แหลม/], ['round', /กลม/],
];
export const LOWER_RULES: Rule<Lower>[] = [
  ['serpent', /หางงู/], ['blob', /เจล/], ['gown', /ชายผ้า/], ['legs', /สองขา/],
];
export const GAIT_RULES: Rule<Gait>[] = [
  ['float', /ลอย/], ['hop', /กระโดด/], ['shuffle', /ลากเท้า/], ['glide', /ลื่น/], ['heavy', /หนัก/], ['normal', /ปกติ/],
];
export const earsOf = (w: string) => first(w, EARS_RULES);
export const lowerOf = (w: string) => first(w, LOWER_RULES);
export const gaitOf = (w: string) => first(w, GAIT_RULES);

// ---------- life stage (the วัย column) ----------

const STAGE_WORDS: [string, Stage][] = [['ทารก', 'infant'], ['วัยรุ่น', 'teen'], ['ผู้เฒ่า', 'elder'], ['ผู้ใหญ่', 'adult'], ['เด็ก', 'child']];
export function stageWord(w: string): Stage | null {
  for (const [k, s] of STAGE_WORDS) if (w.includes(k)) return s;
  return null;
}
/** When the วัย column is `-` (ghosts, the dead): the description says it. */
export function stageFromDescription(d: string): Stage {
  if (/ทารก|เด็กอ่อน/.test(d)) return 'infant';
  if (/เด็ก(ชาย|หญิง)?(อายุ|วัย)?[ก-๙ ]{0,6}ขวบ|^เด็ก|เด็กชาย|เด็กหญิง|ผีเด็ก/.test(d.slice(0, 40))) return 'child';
  if (/วัยรุ่น/.test(d.slice(0, 40))) return 'teen';
  if (/ชรา|เฒ่า|แก่|ผมหงอก/.test(d.slice(0, 60))) return 'elder';
  return 'adult';
}

// ---------- sex ----------

const FEM_RE = /หญิง|สาว|ราชินี|นาง|ยาย|ย่า|แม่|มารดา|ภิกษุณี|เลดี้|เจ้าหญิง|ซิสเตอร์|เธอ/g;
const MALE_RE = /ชาย|หนุ่ม|ลุง|ปู่|พ่อ(?!ค้า|ครัว|มด)|กษัตริย์|ราชา(?!นี)|บิดา|เซอร์|ลอร์ด|เคานต์|จักรพรรดิ|ฟาโรห์|ขุนศึก|เจ้าชาย|สุลต่าน|ทหารเฒ่า/g;
/** true = female, false = male, null = the docs do not say. The earliest word of the first 70 characters wins. */
export function femOf(desc: string, name: string, role: string): boolean | null {
  const at = (re: RegExp, s: string) => { re.lastIndex = 0; const m = re.exec(s); return m ? m.index : Infinity; };
  const head = desc.slice(0, 120);
  const f = at(FEM_RE, head), m = at(MALE_RE, head);
  if (f !== m) return f < m;
  const head2 = `${name} ${role}`;
  const f2 = at(FEM_RE, head2), m2 = at(MALE_RE, head2);
  if (f2 !== m2) return f2 < m2;
  return null;
}

// ---------- colours ----------

export const HEX = /^#[0-9a-f]{6}$/i;
const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const hex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a: string, b: string, t: number) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
export const lum = (h: string) => { const [r, g, b] = rgb(h); return 0.299 * r + 0.587 * g + 0.114 * b; };

/** Colour words (longest first inside a window). Hair and eyes use the same table. */
export const COLOURS: [string, string][] = [
  ['น้ำตาลแดง', '#6a3420'], ['น้ำตาลเทา', '#6a5a4a'], ['น้ำตาลทอง', '#8a6030'], ['ทองแดง', '#a05a30'], ['น้ำตาล', '#5a3a22'],
  ['เทาอมน้ำเงิน', '#6a7488'], ['เทาน้ำเงิน', '#6a7488'], ['เทาเงิน', '#a8acb8'], ['เทาเหล็ก', '#6a6e78'], ['เทาขาว', '#c0c0c4'], ['เทาดำ', '#4a4a50'], ['เทา', '#8a8a90'],
  ['ขาวนวล', '#ece4d0'], ['ขาวเงิน', '#dcdee8'], ['ทองขาว', '#e8dca0'], ['บลอนด์', '#d8b858'], ['ทอง', '#d9a030'], ['อำพัน', '#c88a20'], ['เหลือง', '#d8c030'],
  ['ขาว', '#e8e6e0'], ['เงิน', '#c8ccd8'], ['หงอก', '#c8c8c8'], ['ม่วงดำ', '#3a2a4a'], ['ม่วง', '#6a3a8a'],
  ['แดงเข้ม', '#6a1a1a'], ['แดงคล้ำ', '#7a2a22'], ['แดง', '#9a2a1a'], ['ส้ม', '#d07030'], ['ชมพู', '#e08aa8'],
  ['เขียวมรกต', '#2a9a5a'], ['เขียวเข้ม', '#2a4a2a'], ['เขียว', '#3a7a3a'], ['ฟ้า', '#6a9ad0'], ['น้ำเงิน', '#2a3a7a'], ['ดำ', '#1e1a1c'], ['น้ำทะเล', '#2a6a8a'], ['ทราย', '#c8b080'], ['ถ่าน', '#2a2a2e'], ['ครีม', '#e8dcc0'], ['เข้ม', '#2a1e18'],
];
const DARKER = /เข้ม|คล้ำ|หม่น/, LIGHTER = /อ่อน|จาง/;
/** The first colour word inside `window` with where it ends; "เข้ม" and "อ่อน" right after it darken or lighten it. */
function colourAt(window: string, table: readonly [string, string][] = COLOURS): { hex: string; end: number } | null {
  let best: { at: number; len: number; hex: string; end: number } | null = null;
  for (const [w, h] of table) {
    const at = window.indexOf(w);
    if (at < 0) continue;
    if (!best || at < best.at || (at === best.at && w.length > best.len)) best = { at, len: w.length, hex: h, end: at + w.length };
  }
  if (!best) return null;
  const tail = window.slice(best.end, best.end + 4);
  if (DARKER.test(tail)) return { hex: mix(best.hex, '#000000', 0.3), end: best.end };
  if (LIGHTER.test(tail)) return { hex: mix(best.hex, '#ffffff', 0.35), end: best.end };
  return { hex: best.hex, end: best.end };
}
/** The first colour word inside `window`; "เข้ม" and "อ่อน" right after it darken or lighten it. */
export function colourIn(window: string): string | null { return colourAt(window)?.hex ?? null; }

/** What a race's clothes are made of, when the เครื่องแต่ง gives a material and no colour (leather, iron, soot, earth, leaves). Used only for the races' dress. */
export const MATERIAL_COLOURS: [string, string][] = [
  ['หนัง', '#6a4a30'], ['เหล็ก', '#8a90a0'], ['ไหม้', '#3a3028'], ['สีดิน', '#8a7458'], ['ใบไม้', '#4a8a4a'], ['กลีบดอก', '#e8a0c0'], ['กระดูก', '#d9cfb2'], ['ผ้าดิบ', '#b8a888'],
];
/** The first two different colours a text names, in the order written (colour words, then the materials above); fewer when the text names fewer. */
export function dressColours(text: string): string[] {
  const out: string[] = [];
  let rest = text;
  while (out.length < 2) {
    const c = colourAt(rest, [...COLOURS, ...MATERIAL_COLOURS]);
    if (!c) break;
    if (!out.includes(c.hex)) out.push(c.hex);
    rest = rest.slice(c.end);
  }
  return out;
}
/** The thing a race carries by habit, where the เครื่องแต่ง says it (the dwarves' tools at the waist, the giants' stone tools). */
export const RACE_TOOL_RULES: Rule<(typeof TOOL_IDS)[number]>[] = [
  ['hammer', /เครื่องมือ(?:อยู่ที่เอว|หิน)/],
  ['book', /หนังสือสัญญา/],
];
/** A hat the race text puts on, not one it says is left off (`ไม่ใส่หมวก`). */
export const hatOfRace = (text: string) => hatOf(text.replace(/ไม่(?:ใส่|มี)หมวก[ก-๙]*/g, ''));

/** Hair colour from the hair clause (`ผมสีเงินยาวถักเปีย`), the beard colour is not painted apart from it. */
export function hairColourOf(token: string): string | null {
  const m = token.match(/ผม(?:สี|และเครา)?(.{0,12})/) ?? token.match(/(?:เปีย|เครา|หนวด)(?:สี)?(.{0,10})/);
  return m ? colourIn(m[1]) : null;
}
export function eyeColourOf(desc: string): string | null {
  // `ตา` of `น้ำตาล` (brown) is no eye; `ตาสองดวงเรืองสีม่วง` names its colour after two words
  for (const m of desc.matchAll(/(?<!น้ำ)ตา(?:สี)?([ก-๙]{0,10})/g)) {
    const c = colourIn(m[1]);
    if (c) return c;
  }
  const two = desc.match(/ตา(?:ทั้ง)?สองดวง[ก-๙]{0,6}สี([ก-๙]{1,8})/);
  return two ? colourIn(two[1]) : null;
}

/** The colour a description gives to the skin (`ผิวสีเทาเขียว`), or null. */
export function skinColourOf(desc: string): string | null {
  const m = desc.match(/ผิว(?:สี)?([ก-๙]{1,10})/);
  return m ? colourIn(m[1]) : null;
}

/**
 * Skin tones that are no human or race tone (blue, purple, grey, green, pale blue, dark red): read from the words of the skin phrase, first match wins.
 * A skin of a plain tone (brown, tan, pink, scorched) still goes through the race's own list (`nearest` / `skinHint`). The shade words after the
 * colour (`ซีด` `อ่อน` pale, `เข้ม` dark) move the tone.
 */
export const SKIN_TONES: [RegExp, string][] = [
  [/^(?:สี)?ฟ้าอมเขียว/, '#8ac0b8'], [/^(?:สี)?ฟ้าเทา/, '#8aa4b8'], [/^(?:สี)?(?:ขาว|ซีด)ฟ้า/, '#d4e2f0'], [/^(?:สี)?ฟ้า/, '#8ab8e0'],
  [/^(?:สี)?ม่วง(?:อม)?เทา/, '#8a7a96'], [/^(?:สี)?เทา(?:อม)?ม่วง/, '#8e8498'], [/^(?:สี)?ชมพูอมม่วง/, '#c0889e'], [/^(?:สี)?แดงอมม่วง/, '#9a4a68'],
  [/^(?:สี)?แดงเข้มเกือบม่วง/, '#7a2a48'], [/^(?:สี)?ม่วง/, '#7a5a98'],
  [/^(?:สี)?(?:เทาเขียว|เขียวเทา)/, '#7f9480'], [/^(?:สี)?เขียวเข้มปนเทา/, '#4f6a4a'], [/^(?:สี)?เขียวมะกอก/, '#6f9a4f'],
  [/^(?:สี)?เขียว/, '#6a9a50'], [/^(?:สี)?(?:เทาดำ|ดำเทา|เทาถ่าน)/, '#4a4a4e'], [/^(?:สี)?(?:ขาวเทา|ซีดเทา)/, '#c8c8c4'], [/^(?:สี)?เทา/, '#9a9a9a'],
  [/^(?:สี)?(?:แดงเข้ม|คล้ำแดง|แดงคล้ำ)/, '#8a3a2e'],
];
/** The tone of the skin words (`ผิวฟ้าซีดมีเหงือก` → pale blue), or null for a plain tone. */
export function skinToneOf(desc: string): string | null {
  const m = desc.match(/ผิว(?:ก้าน)?([ก-๙]{1,16})/);
  if (!m) return null;
  const w = m[1];
  for (const [re, tone] of SKIN_TONES) {
    const hit = re.exec(w);
    if (!hit) continue;
    // a shade word right after the colour: `ซีด` `อ่อน` `จาง` lighten it, `เข้ม` darkens it (the tones that already say it are not shaded twice)
    const rest = w.slice(hit[0].length, hit[0].length + 4);
    if (/ซีด|อ่อน|จาง/.test(rest)) return mix(tone, '#ffffff', 0.22);
    if (/เข้ม/.test(rest)) return mix(tone, '#000000', 0.3);
    return tone;
  }
  return null;
}

/**
 * Words that turn a thing away (`ไม่สวมมงกุฎ` `ห้ามใส่` `ทิ้งหมวกไว้` `ถอดหมวก` `ยังไม่ได้สวม` `ยืนห่างมงกุฎ`): the chunk is cut out before the hat, the
 * held thing and the feats are read from the text, so a negated word never gives the thing.
 */
export function stripNegated(text: string): string {
  return text
    .replace(/(?:ยัง)?(?:ไม่|ห้าม)(?:เคย|ได้)?(?:สวม|ใส่|ถือ|พก|ใช้|มี(?=อาวุธ|หมวก|มงกุฎ))[ก-๙]*/g, ' ')
    .replace(/[ก-๙]*(?:ที่|แล้ว)?ทิ้ง(?:ไว้)?[ก-๙]*/g, ' ')
    .replace(/ถอด(?:หมวก|มงกุฎ|หน้ากาก|ผ้า|ตรา)[ก-๙]*/g, ' ')
    .replace(/ห่าง(?:จาก)?(?:มงกุฎ|บัลลังก์|หมวก)[ก-๙]*/g, ' ');
}
/**
 * A skin phrase that begins with a colour word (`ผิวสีขาวนวล`, `ผิวเทาอมน้ำเงิน`): that colour, read before any shade word such as `ซีด` further on
 * (the more specific word first); null when the phrase begins with a shade or a burn (`ผิวซีดเหลือง` `ผิวไหม้`).
 */
export function skinLeadColour(desc: string): string | null {
  const m = desc.match(/ผิว(?:ก้าน)?(?:สี)?([ก-๙]{1,12})/);
  if (!m) return null;
  const c = colourAt(m[1]);
  return c && colourAtStart(m[1]) ? c.hex : null;
}
const colourAtStart = (w: string): boolean => COLOURS.some(([k]) => w.startsWith(k));
/** The entry of the race's skins nearest to a colour. */
export function nearest(skins: readonly string[], c: string): string {
  const d = (a: string) => { const A = rgb(a), B = rgb(c); return (A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2; };
  return [...skins].sort((a, b) => d(a) - d(b))[0];
}
/** The nearest skin of the race, or the colour itself when it is a pale one and the race has none near it (a pale cream on a green slime). */
export function nearestOrOwn(skins: readonly string[], c: string): string {
  const n = nearest(skins, c), A = rgb(n), B = rgb(c);
  return (A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2 > 6000 && lum(c) > 190 ? c : n;
}
/** "ผิวคล้ำ" picks a darker entry of the race's skins, "ผิวซีด" a lighter one; null = the docs say nothing. */
export function skinHint(desc: string): 'dark' | 'light' | null {
  const dark = /ผิว(?:สี)?(?:คล้ำ|ไหม้|แทน|ทองแดง|น้ำตาล|เข้ม|แดงเกรียม|เกรียม|ดำ)/.test(desc);
  const light = /ผิว(?:สี)?(?:ซีด|ขาว|บาง|เผือก)/.test(desc);
  return dark === light ? null : dark ? 'dark' : 'light';
}

// ---------- outfit ----------

export const OUTFIT_RULES: Rule<(typeof OUTFIT_IDS)[number]>[] = [
  ['otherworld', /ต่างภพ|อัญเชิญ|ชุดนักเรียน|เสื้อยืด|กางเกงยีน/],
  ['sailor', /กะลาสี|ลูกเรือ|นักนำร่อง|นายท่า|ชุดกัปตัน|ผ้าใบกันน้ำ|ดำน้ำ|ชุดสาหร่าย|ชุดผ้ากันน้ำ/],
  ['apron', /ผ้ากันเปื้อน/],
  ['miner', /เหมือง|กรรมกร|ชุดคนงาน|เสื้อผ้าคนงาน|คนเฝ้าบ่อ|ชุดขี่หนอน|ชุดช่างไฟ|ชุดคนงานท่อ/],
  ['regal', /ชุด(?:กษัตริย์|สุลต่าน|ราช|ฟาโรห์|จักรพรรดิ|รัชทายาท)|เสื้อคลุม(?:กษัตริย์|ราช)|ฉลองพระองค์|ชุดเต็มยศ/],
  ['priest', /ชุด(?:ซิสเตอร์|ผู้เคร่ง|นักบวช|ภิกษุ|นักพรต|พิธี|ลัทธิ|ผู้ตีระฆัง|ผู้ช่วยตี|มารดา|อธิการ|ผู้ศรัทธา|บูชา|ผู้ฟังวิญญาณ|ผู้ตีความ|ผู้จุดประ)|ผ้านักบวช|เสื้อคลุมนักบวช|ผ้าคลุมนักบวช|ผ้าคลุมพยากรณ์|ผ้าสไบ|ผ้าขาวผู้แสวงบุญ|เสื้อผ้าลัทธิ/],
  ['scholar', /ชุด(?:ผู้ตรวจบัญชี|ผู้เก็บบัญชี|ผู้ฝึกเขียน|ผู้ถอดเสียง|นักปราชญ์|ครู|นักเขียน|บรรณารักษ์|เสมียน|นักวิชาการ|ศาสตราจารย์|นักดาราศาสตร์|นักบันทึก|นักอ่าน|นักถอดรหัส|นักบัญชี|คลุมกวี|หมอ|ผ่าตัด|ผู้ตัดสิน|นักประดิษฐ์|นักเล่นแร่|ผู้ทดสอบ|นักวิทยาศาสตร์|วิศวกร|นักบำบัด|ผู้ทำยา|นักปรุงยา|ผู้ผสม)|เสื้อกาวน์|เสื้อแล็บ|เสื้อคลุมนักเขียน|เสื้อคลุมนัก/],
  ['fur', /เสื้อหนังสัตว์|ขนสัตว์|เสื้อขน|หนังหมี|เสื้อหนังหมี|ผ้าคลุมขน|เสื้อคลุมขน/],
  ['knight', /อัศวิน|เกราะพิธี|เกราะผู้กล้า|ชุดเกราะผู้ก/],
  ['plate', /เกราะ(?:เหล็ก|เต็ม|เงิน|ทอง|ขั|ชุบ)/],
  ['leather', /(?:ชุด|เสื้อ)[ก-๙]{0,8}หนัง|นักล่า|นักฆ่า|นักสำรวจ|ขี่หมาป่า|ขี่ม้า|ขี่หนอน|เกราะ(?:หนัง|กระดูก|ไม้|เกล็ด|ฝึกหัด|เบา)|ชุดเกราะเบา|เสื้อหนัง|ชุดหนัง|แจ็กเก็ตหนัง|เสื้อกั๊กหนัง|ชุดนักบินหนัง|ชุดนักรบหนัง|เสื้อโค้ตหนัง|เสื้อกันหนัง/],
  ['armor', /เกราะ|ชุดทหาร|เครื่องแบบทหาร|เครื่องแบบนายพล|ชุดทหารรับจ้าง|เครื่องแบบ(?:จอม|เก)/],
  ['noble', /เครื่องแบบ|ชุดขุนนาง|ชุดสูท|เสื้อโค้ต|ชุดประธาน|ชุดนายกนคร|ชุดสมาชิกสภา|ชุดสภา|ชุดผู้แทน|ชุดนายธนาคาร|ชุดนายหน้า|ชุดไหม|ชุดผ้าไหม|ชุดทูต|ชุดผู้อำนวยการ|ชุดเลขา|ชุดสหภาพ|ชุดตัวแทน|ชุดผู้นำ|ชุดรัชทายาท|ชุดสุภาพ|ชุดพลเมือง/],
  ['dress', /ชุดเดรส|กระโปรง|ราตรี|ชุดนางรำ|กลีบดอก|ชุดยาวกรอมพื้น|ชุดกลีบ/],
  ['sarong', /ผ้าถุง|โสร่ง|ผ้านุ่ง|ผ้าขาวม้า/],
  ['rags', /ผู้ลี้ภัย|ชุดผ้า(?:ขาด|เก่า)|เสื้อผ้า(?:ขาด|เก่า)|ผ้าขี้ริ้ว|ชุดขาด|ผ้าห่อตัว|ผ้าห่ม|ผ้าห่อหนัง|ผ้าดำบางพัน|ชุดเก่า|ชุดมีคราบ|ผ้าพันขาดเป็นริ้ว|ผ้าพันตัว/],
  ['robe', /นักเวท|เสื้อคลุม|ชุดคลุม|ชุดหลวม|ผ้าคลุมยาว|ชุดทูตบางพลิ้ว/],
  ['cloak', /(?:ชุด|เสื้อผ้า)เดินทาง|ชุดนักเดินทาง|ผ้าคลุม(?:สี|เดินทาง|กันฝน|กันหมอก|หนา|ผืน|เก่า|ดำ|เทา|เขียว|น้ำเงิน|เนมส์)|เสื้อกันฝน|ผ้ากันฝุ่น|ผ้าคลุมสองสี|ผ้าคลุมกัน/],
  ['cape', /ผ้าคลุมไหล่|ผ้าคลุม/],
  ['light', /เสื้อลินิน|ชุดบาง|ชุดเบา|เสื้อผ้าเบา|ชุดผ้าบาง|ชุดผ้าลินิน|ชุดลินิน|เสื้อฝ้าย|ชุดผ้าฝ้าย|เสื้อผ้าฝ้าย|ชุดผ้าเบา|ชุดสีขาวบาง|เสื้อผ้าใบไม้|ชุดสีพิษ/],
];
/** Words that name a garment; one of these with no rule above is reported. */
/** A plain `ชุด…` `เสื้อ…` `กางเกง…` is plain clothing (the tunic); these garment words are not: one with no rule above is reported. */
export const GARMENT_TOKEN = /^(เครื่องแบบ|เกราะ|กระโปรง|ผ้าคลุม|ผ้าห่ม|ผ้ากัน|ผ้าห่อ|แจ็กเก็ต)/;
export const outfitOf = (d: string) => first(d, OUTFIT_RULES);

/** The words that begin what a person holds or carries (not wears): the rest of a phrase from here on is the held thing. */
const HELD_START = /ถือ|แบก|กุม|ห้อยเอว|แขวนเอว|ห้อยข้างเอว|เสียบเอว|ในมือ|หิ้ว|อุ้ม|ประคอง/;
/** A word that makes a phrase a garment phrase (what the person wears). */
const WEAR_HEAD = /ชุด|เสื้อ|ผ้า|เกราะ|เครื่องแบบ|กระโปรง|แจ็กเก็ต|กางเกง|เดรส|โสร่ง|ฮู้ด|ฉลองพระองค์|ราตรี|กลีบ|สวม|ใส่|นุ่ง|ห่ม/;
/**
 * The phrases of a description that say what the person wears: each space-separated phrase is cut where a held thing begins (`ชุดคลุมถือไม้เท้า`
 * keeps `ชุดคลุม`), so a staff, a cloak carried on the arm or a bundle in the hand never sets the outfit.
 */
export function wornPhrases(desc: string): string[] {
  // a phrase ends where the held things begin (what follows `ถือ` is a list of held things, `และ` included); the rest is split at `และ`
  return desc.split(/\s+/).flatMap((t) => { const m = HELD_START.exec(t); return (m ? t.slice(0, m.index) : t).split('และ'); }).filter(Boolean);
}
/** Phrases about the hair and the head, which may name a cloth (`ผมรวบใต้ผ้าคลุมพยาบาล`) that is no outfit. */
const HEAD_PHRASE = /^(?:ผม|หัว|ศีรษะ|เปีย|หมวก|ผ้าโพก|ผ้าคาด(?:หัว|ผม)|ผ้าคลุม(?:หัว|ศีรษะ|หน้า)|ฮู้ด)/;
/**
 * The outfit a description names. The phrases that name a garment (ชุด เสื้อ ผ้า เกราะ …, not the hair, a hat or a thing held) are tried
 * first, as one text, so the rules keep their order of priority; if they give nothing, the job and place words of the rest of the worn text
 * (a miner's pit, a sailor's crew) are tried, never what is held.
 */
/** The phrases of a description that name a garment worn on the body: the veil of a head, the hair and what is held are left out. */
export const garmentPhrases = (desc: string): string[] =>
  wornPhrases(desc).flatMap((t) => {
    if (!HEAD_PHRASE.test(t)) return [t];
    // a run-together phrase (`ศีรษะโล้นชุดนักบวช`): the head part is dropped, what follows from the first garment word stays
    const g = t.slice(2).search(/ชุด|เสื้อ|เกราะ|เครื่องแบบ|กระโปรง|แจ็กเก็ต|กางเกง/);
    return g >= 0 ? [t.slice(g + 2)] : [];
  });
export function outfitFromGarments(desc: string): (typeof OUTFIT_IDS)[number] | null {
  const parts = garmentPhrases(desc);
  return outfitOf(parts.filter((t) => WEAR_HEAD.test(t)).join(' ')) ?? outfitOf(parts.join(' '));
}

// ---------- hair (a hair clause is a token: `ผมสีเงินยาวถักเปีย`) ----------

export const HAIR_RULES: Rule<(typeof HAIR_IDS)[number]>[] = [
  ['cropped', /โกนข้าง/],
  ['bald', /โล้น|ล้าน|โกน|ไม่มีผม|หัวเถิก/],
  ['mohawk', /โมฮอว์ก|ยอดสูง|หงอน|ขนยอด/],
  ['braid', /เปีย|ถักสองข้าง|ถัก/],
  ['bun', /มวย|เกล้า|ห่อใต้|ห่อผ้า|พันศีรษะ/],
  ['ponytail', /หางม้า|รวบหาง|รวบสูง|หางเดียว/],
  ['topknot', /ปมสูง|ปมกลาง/],
  ['curly', /หยิก|หยักศก|ลอน|ฟู/],
  ['tied', /รวบ|มัด|รัด/],
  ['wild', /ยุ่ง|รุงรัง|สยาย|ลอย|หยาบ|ดกหนา/],
  ['cropped', /เกรียน|ตัดสั้น|ตัดเรียบ|ตัดทรงทหาร|ตัดเท่า/],
  ['long', /ยาว|พลิ้ว|ถึงเอว|ถึงบ่า|ถึงสะโพก|ถึงข้อเท้า/],
  ['short', /สั้น|บาง|หวี/],
];
/** Where a hair clause starts inside a description. */
export const HAIR_START = /ผม|เปีย(?!ก)|ศีรษะ(?:โล้น|โกน|ล้าน|มีขน)|หัว(?:โล้น|ล้าน)/;
/** The words that end a clause when the doc runs the clauses together without a space. */
const CLAUSE_END = /สวม|ใส่|ถือ|ตาสี|ตาเ|ตาก|ผิว|มือ|เสื้อ|ชุด|หมวก|ผ้า|เกราะ|เท้า|ร่าง|หน้า|ปีก|เขาโ|หู|แก้ม|แขน|ขา(?!ว)|กาง|ยืน|เดิน|นั่ง|ท่า/;
/** The clause of a description that starts at the first match of `start`: up to the next space or clause word, 24 characters at most. */
export function clauseOf(desc: string, start: RegExp): string {
  const m = start.exec(desc);
  if (!m) return '';
  let t = desc.slice(m.index, m.index + 24).split(/\s/)[0];
  const tail = t.slice(2);
  const e = tail.search(CLAUSE_END);
  if (e >= 0) t = t.slice(0, e + 2);
  return t;
}
export const hairStyleOf = (token: string) => first(token, HAIR_RULES);

// ---------- beard ----------

export const BEARD_RULES: Rule<(typeof BEARD_IDS)[number]>[] = [
  ['braided', /(?:เครา|หนวด)[ก-๙]{0,6}ถัก|เคราเปีย/],
  ['long', /(?:เครา|หนวด)[ก-๙]{0,8}ยาว|เคราหนา|เคราขาวหนา/],
  ['stubble', /ขึ้นรก|เหลือเพียงเงา|ไม่เรียบ|หนวดเคราแห้ง|ตอเครา|ไม่ได้โกน/],
  ['moustache', /หนวด(?:โค้ง|ตกแต่ง|บาง|เรียบ|สั้น|ตัด)|หนวดขาว/],
  ['short', /เครา|หนวด/],
];
export const BEARD_START = /เครา|หนวด(?!สิบ|ยาวสิบ)/;
/** Words that say a person has no beard: a race that has one by default (the dwarves) does not give it to him. */
export const NO_BEARD = /ไม่มี(?:หนวด|เครา)|โกน(?:เกลี้ยง|หนวด|เครา)|หน้าเกลี้ยง|ไร้(?:หนวด|เครา)/;
export function beardOf(desc: string): (typeof BEARD_IDS)[number] | null {
  // tentacles (`หนวดสิบกว่าเส้น`) are not beards
  const d = desc.replace(/หนวด(?:สิบ|ยาวสิบ|ข้าง|แมงมุม|ปลา)[ก-๙]{0,6}เส้น|หนวดสิบ/g, '');
  return first(d, BEARD_RULES);
}

// ---------- hat ----------

export const HAT_RULES: Rule<(typeof HAT_IDS)[number]>[] = [
  ['wizard', /หมวกพ่อมด|หมวกแหลมสูง|หมวกทรงสูงสี/],
  ['mitre', /หมวกนักบวช|หมวกสูงนักบวช|มิเตอร์|หมวกทรงสูง/],
  ['minerhat', /หมวกเหมือง|หมวกไฟ|ไฟติดหน้า|หมวกกันกระแทก/],
  ['goggles', /แว่นนักบิน|แว่นตากัน|แว่นดำน้ำ|หมวกดำน้ำ|แว่นกันลม/],
  ['chef', /หมวกพ่อครัว/],
  ['horned', /หมวกมีเขา|หมวกเขา/],
  ['helmet', /หมวกเหล็ก|หมวกเกราะ|หมวกนักรบ|หมวกทหาร|หมวกศึก/],
  ['wide', /หมวกปีกกว้าง|หมวกคาวบอย|หมวกกว้าง|หมวกฟางปีกกว้าง/],
  ['straw', /หมวกฟาง/],
  ['feather', /หมวกขนนก|หมวกประดับขน/],
  ['furhat', /หมวกขนสัตว์|หมวกทหารบุขน|หมวกขน/],
  ['turban', /ผ้าโพก(?:ศีรษะ|หัว)|ผ้าพันศีรษะ|โพกหัว/],
  ['bandana', /ผ้าคาดหัว|ผ้าคาดผม|ผ้ารัดผม|ผ้าคาดตา|ผ้าปิดตาครึ่ง/],
  ['veil', /ผ้าคลุมหน้า|ผ้าคลุมศีรษะ|ผ้าคลุมหัว/],
  ['hood', /ผ้าคลุม[ก-๙]*ตั้งแต่หัว/],
  ['crown', /มงกุฎ/],
  ['tiara', /เทียรา|ทีอารา/],
  ['circlet', /เทริด|วงแหวนศีรษะ|ห่วงศีรษะ|แถบศีรษะ/],
  ['laurel', /พวงหรีด|ช่อลอเรล|ใบลอเรล/],
  ['hood', /ฮู้ด|หมวกคลุม/],
  ['cowl', /ผ้าคลุมศีรษะ|ผ้าคลุมหัว/],
  ['cap', /หมวกหนัง|หมวกผ้า|หมวกกันแก๊ป|หมวกเหลี่ยม|หมวกสามเหลี่ยม|หมวกทรงเฟือง|หมวกพ่อค้า|หมวกกลม|หมวก/],
];
export const HAT_TOKEN = /(หมวก|ฮู้ด|มงกุฎ|เทริด|ผ้าโพก|ผ้าคลุมศีรษะ|ผ้าคลุมหน้า|ผ้าคลุมหัว|ผ้าคาดหัว|ผ้าพันศีรษะ)/;
export const hatOf = (d: string) => first(stripNegated(d), HAT_RULES);

// ---------- tool (from the ของ list, then the description) ----------

export const TOOL_RULES: Rule<(typeof TOOL_IDS)[number]>[] = [
  ['greatsword', /ดาบใหญ่|ดาบยักษ์|ดาบสองมือ|ดาบมหึมา|ดาบหนัก/],
  ['trident', /ตรีศูล|สามง่าม/],
  ['spear', /หอก|ทวน|หลาว/],
  ['orbstaff', /ไม้เท้า(?:ลูกแก้ว|ผลึก|แก้ว)|คทาผลึก|ไม้เท้าประดับ(?:แก้ว|ผลึก)/],
  ['crook', /ไม้เท้าคนเลี้ยง|ไม้เกี่ยว|ไม้เท้าโค้ง/],
  ['scepter', /คทา|ราชทัณฑ์/],
  ['wand', /ไม้กายสิทธิ์|ไม้ขีด|ไม้เล็ก|ไม้ไผ่ชี้/],
  ['staff', /ไม้เท้า|ไม้พลอง|ไม้ค้ำ|ไม้ยาว|ไม้กระบอง/],
  ['banner', /ธง/],
  ['scythe', /เคียว/],
  ['censer', /กระถางธูป|ธูป|กระถางหอม|ที่เผาธูป/],
  ['sword', /ดาบ|กระบี่|เรเพียร์|ซามูไร/],
  ['dagger', /มีด|กริช|สิ่ว|ดาบสั้น/],
  ['mace', /กระบองหนาม|คทาศึก|ตะบอง/],
  ['club', /กระบอง/],
  // the things of wave 4 (src/art/parts/tools-extra.ts): each has its own look, so the thing the docs name shows and not a generic book or box.
  // They sit before the generic book / scroll / ledger / mug / flask rules so that the named thing wins inside one item.
  ['mallet', /ไม้ตี|ค้อนตี|ค้อนไม้/],
  ['hotiron', /เหล็กร้อน/],
  ['keyring', /กุญแจ/],
  ['basket', /ตะกร้า/],
  ['garland', /พวงมาลัย/],
  ['bellrope', /เชือกระฆัง|กระดิ่ง|ระฆังมือ/],
  ['beads', /ลูกประคำ|ประคำ/],
  ['bucket', /ถัง(?!สี)/],
  ['papyrus', /ปาปิรุส/],
  ['card', /บัตร|ตั๋ว|ป้าย(?:ชื่อ|คนไข้|หมายเลข)/],
  ['pipe', /ขลุ่ย|ปี่|นกหวีด|แตร|ไม้เป่า|หลอดเป่า/],
  ['tank', /ตู้ปลา/],
  ['net', /ตาข่าย|อวน|แหจับ|สวิง/],
  ['crystal', /(?<!แท่ง)ผลึก|ศิลาลอย|ดวงตาศิลา|หินทำนาย|ก้อนแก้ว/],
  ['jar', /โหล|กระปุก|ตลับ|กรอบแก้ว|ไห(?![ก-๙])/],
  ['bottle', /ขวด(?:แก้ว|น้ำหอม|ยา|ความทรงจำ|ตัวอย่าง|ตรวจ|น้ำผึ้ง|วัด)/],
  ['doll', /^(?!แฟ้ม|สมุด|ทะเบียน).*ตุ๊กตา|ของเล่น/],
  ['bag', /ถุง(?!มือ|เท้า)|กระเป๋า|เป้(?![ก-๙])/],
  ['map', /แผนที่/],
  ['letter', /จดหมาย|ซองเงิน|ซองสาร|ซอง(?:ปิด)?ตรา/],
  ['brush', /พู่กัน|แปรง/],
  ['quill', /ปากกา/],
  ['chalk', /ชอล์ก|ดินสอ|ถ่านวาด|ถ่านเขียน|แท่งถ่าน|แท่งดินสอ/],
  ['hammer', /ค้อน/],
  ['axe', /ขวาน/],
  ['pickaxe', /พลั่วเหมือง|ฆ้อน|เสียม|ตะแกรง.*ขุด|ที่ขุด/],
  ['hoe', /จอบ|คราด/],
  ['shovel', /พลั่ว|ที่ตัก/],
  ['broom', /ไม้กวาด|ไม้ถู/],
  ['ladle', /ทัพพี|ตะหลิว/],
  ['bow', /ธนู|หน้าไม้|ศร/],
  ['rod', /คันเบ็ด|เบ็ด|ไม้ตกปลา/],
  ['ledger', /สมุดบัญชี|ม้วนบัญชี|บัญชี/],
  ['book', /หนังสือ|สมุด|ตำรา|คัมภีร์|ไดอารี|แฟ้ม/],
  ['scroll', /ม้วน|กระดาษ|จดหมาย|แผนที่|สัญญา|แผ่นไม้บท|แผ่นหนัง|ใบ(?:ประกาศ|สั่ง)/],
  ['lute', /พิณ|ซอ|กีตาร์|ระฆัง|กลอง|เครื่องดนตรี|ฉาบ/],
  ['mug', /(?<!มงกุฎ)(?<!แหวน)(?<!กล่อง)(?<!ไม้เป่า)(?<!หลอดเป่า)แก้ว|ถ้วยเบียร์|เหยือก|จอก/],
  ['bowl', /ชาม|ถ้วย|กระถาง/],
  ['flask', /ขวด|กระบอกน้ำ|กระติก|หม้อต้ม|หม้อ/],
  ['lantern', /ตะเกียง|โคม|ไฟฉาย|คบเพลิง|เทียน/],
  ['shield', /โล่/],
  // the things of the second set (src/art/parts/tools-extra.ts): guns, instruments, a fan, scissors, a whip, a sling, a fist weapon
  ['rifle', /ไรเฟิล|ปืนกล/],
  ['musket', /มัสเกต|ปืนยาว|ปืนคาบศิลา/],
  ['pistol', /ปืน/],
  ['spyglass', /กล้องส่อง|กล้องดูดาว|กล้องทางไกล|กล้องโทรทรรศน์/],
  ['compass', /เข็มทิศ/],
  ['pocketwatch', /นาฬิกา/],
  ['fan', /พัด/],
  ['scissors', /กรรไกร/],
  ['gauge', /เครื่องวัด|เครื่องมือวัด|เครื่องชั่ง|มาตรวัด|เกจ|สายวัด|กังหันวัดลม|หูฟัง|กล้องบันทึก|ไม้วัดมุม/],
  ['whip', /แส้|สายหวด|โซ่ฟาด/],
  ['sling', /หนังสติ๊ก|สลิง|ที่ขว้าง/],
  ['knuckles', /สนับมือ|สนับเหล็ก|นวมมวย|ถุงมือเหล็ก|ถุงมือมวย|กำปั้นเหล็ก/],
  ['banner', /ว่าว/],
  ['scepter', /แท่งผลึก|แท่งประจำตำแหน่ง/],
  ['book', /แล็ปท็อป|แท็บเล็ต|โน้ตบุ๊ก/],
  // small tools of the trade the painter has no part for: the nearest shape
  ['wand', /ไม้บรรทัด|ไม้วัด|ไม้คาน|ไม้ชั่ง|เข็ม(?!ทิศ)|ที่ปิดปากเหล็ก/],
  ['ledger', /ลูกคิด|ตารางตัวเลข|กราฟ|ใบสมัคร/],
  ['book', /กระดาน|แผ่น(?:รูน|หิน|เหล็ก|รหัส|บันทึก|ตัวเลข|กระดูก)|ภาพวาด|แบบ(?:แปลน|เตา|เครื่อง|ป้อม)/],
  ['crook', /ไม้เลี้ยง|ตะขอ/],
  ['staff', /ไม้พาย|ไม้เหล็ก|ไม้(?:ท่อน|แห้ง)|กิ่งไม้/],
  ['hammer', /ประแจ|สกัด|ไขควง|เกรียง|คีม|เหล็กเคาะ|เกจ|วาล์ว/],
  ['shovel', /ช้อนดิน|ช้อนไม้|ช้อนทราย/],
  ['bowl', /ครก|กระป๋อง/],
    ['wand', /แท่ง/],
];
/** Things in an ของ list that are not held in the hand (a pocket, a mark, a pet): ignored, not reported. */
export const NOT_TOOL = /ม่าน|เสื้อ|เครื่องแบบ|แถบ|ดาวนาย|หางพ่อ|เห็ดงอก|ดวงตา|ตาเลนส์|ใบไม้|เครื่องประดับ|ได้ยินเสียง|เอว|ห่อ|สมบัติ|เตียง|หีบ|หมอน|หมายเลข|ก้อนหิน|ดอกไม้|ดอกเห็ด|ดอกบัว|หมอกสปอร์|สายแบก|สายรัด|สายข้อมูล|กำไล|จี้|กล่อง|กิ่ง|ฟืน|เปลือก|ชุดหมึก|ชิป|ชิ้นส่วน|แกน|อะไหล่|ที่อุดหู|เลข|โซ่|พวงมาลัย|อาน|เป้|แขน|เศษ|ห่วง|ศาล|กระเป๋า|ถุง|ตรา|กุญแจ|เหรียญ|แว่น|เชือก|ผ้า|เกราะ|หน้ากาก|ลูกประคำ|สร้อย|แหวน|ไม่มี|สัตว์|หมาป่า|ปีก|หมวก|มงกุฎ|เข็มขัด|รองเท้า|ตุ๊กตา|ของเล่น|ประคำ|ป้าย|กรง|ตลับ|ตะกร้า|เนื้อ|ขนม|ยา|เครื่องมือ|ถ่าน|ด้าย|ไม้ขีด|เม็ด|เมล็ด|เก้าอี้|โต๊ะ|ตู้|ผง|ธูปที่|โพเดียม|รถเข็น|นกส่งสาร|ท่อปอด|หินทำนาย|รูปสลัก/;
const TOOL_SKIP = /ในกระเป๋า|ในอก|ฝังอก|ในเนื้อ|ซ่อนในรองเท้า|ในถุง|ในเสื้อ|ในฝัก|ในกระเป๋า/;
/** The things carried that give way to any other thing of the ของ list. */
export const WEAK_TOOLS = new Set(['bag', 'card', 'letter', 'chalk', 'jar']);
export interface ToolPick { tool: string | null; miss: string[] }
/** The tool a person holds: the first item of the ของ list a rule knows; the items nothing knows are returned to be reported. */
export function toolOf(items: string[], desc: string): ToolPick {
  const miss: string[] = [];
  const parts = items.flatMap((i) => i.split(/และ|,|\/|แล้ว/).map((s) => s.trim()).filter(Boolean));
  // a small carried thing (a bag, a card, a letter ...) is held only when no other item of the list is a thing in the hand (a sword wins over a purse)
  let weak: string | null = null;
  for (const p of parts) {
    if (TOOL_SKIP.test(p) && !/^(ดาบ|หอก|มีด|ธนู)/.test(p)) continue;
    const t = first(p, TOOL_RULES);
    if (t) {
      if (!WEAK_TOOLS.has(t)) return { tool: t, miss };
      weak = weak ?? t;
      continue;
    }
    if (!weak && !NOT_TOOL.test(p)) miss.push(p);
  }
  if (weak) return { tool: weak, miss };
  // not in the list: a weapon the description puts in the hand or at the belt (what the text turns away, `ไม่ถือเลย` `ไม่มีอาวุธ`, is no weapon)
  desc = stripNegated(desc);
  const held = desc.match(/(?:ถือ|แบก|พาด|ห้อยเอว|แขวนเอว|ห้อยข้างเอว|ในมือ|กุม|เสียบเอว)([ก-๙]{0,12})/g) ?? [];
  for (const h of held) {
    const t = first(h, TOOL_RULES);
    if (t) return { tool: t, miss };
  }
  const w = desc.match(/(?:ดาบ|หอก|ธนู|ขวาน|ค้อน|มีดสั้น|ไม้เท้า|คทา|โล่)/);
  if (w) { const t = first(w[0], TOOL_RULES); if (t) return { tool: t, miss }; }
  return { tool: null, miss };
}

// ---------- personal feats ----------

export const FEAT_RULES: Rule<(typeof FEAT_IDS)[number]>[] = [
  ['eyepatch', /ผ้าปิดตา(?!ครึ่ง)|ปิดตาข้างหนึ่ง|ผ้าปิดตาข้าง/],
  ['missingarm', /แขนขาด|ไร้แขน|แขนข้างหนึ่งหาย|แขนเดียว|ไม่มีแขน|แขนข้างหนึ่งไม่มี|แขนซ้ายขาด|แขนขวาขาด/],
  ['blind', /ตาบอด|ตาขาวขุ่น|ตาขาวโพลน|ตาฟ้าขุ่น/],
  ['halo', /รัศมี|วงแหวนแสง|วงแสงเหนือหัว/],
  ['mask', /หน้ากาก/],
  ['tattoo', /รอยสัก|ลายสัก|สักลาย|สัก(?:เต็ม|ไล่)/],
  ['bandage', /ผ้าพันแผล|ผ้าพันแขน|ผ้าพันมือ|พันผ้าที่(?:มือ|ข้อ)|เฝือก/],
  ['scar', /แผลเป็น|รอยแผล|รอยดาบ|รอยไหม้เป็นทาง|รอยฟัน|รอยกรงเล็บ/],
  ['freckles', /(?:มี|เต็มไปด้วย|ลาย|จุด|รอย|แก้ม|จมูก|หน้า)กระ(?![ก-๙])|กระ(?:บนแก้ม|ที่แก้ม|บนจมูก|แดด|เต็มหน้า)/],
  // the feats of the second set (src/art/parts/feats-extra.ts); a spirit's `ghost` comes from the race text (see SPIRIT), not from here
  ['tentacles', /หนวด(?:สิบ|ยาวสิบ|ในหัว|รอบ)|ตามหนวด|หนวดเรือง|ปลาหมึก/],
  ['cyclops', /ตาเดียว|ตาหนึ่งดวง|ตากลางหน้าผาก|ไซคลอปส์/],
  ['dish', /จานน้ำบนหัว|แอ่งน้ำบนหัว|จานบนหัว/],
  // glasses of the face (a magnifier, goggles and flying glasses are held or worn on a hat, not these)
  ['monocle', /แว่นเลนส์เดียว|แว่นข้างเดียว|โมโนเคิล/],
  ['glasses', /แว่น(?!กัน|บิน|นักบิน|ช่าง|ขยาย|ดู|บัง|เลนส์เดียว|ข้างเดียว)|แว่นตา(?!กัน)/],
  // the marks of wave 4 (animals, the puppets, the extra arms; the painter of the race branch draws them)
  ['fourarms', /สี่แขน|แขนที่สี่|แขนเหล็กที่สี่/],
  ['puppet', /ผิวเซรามิก|เส้นต่อที่ข้อ|ข้อต่อ(?:ไม้|ตุ๊กตา|ลูกกลม)|ร่างตุ๊กตา/],
  ['antlers', /เขากวาง/],
  ['stripes', /ลาย(?:สีส้มดำ|สีดำ|วง)|ลายเสือ/],
  ['spots', /(?<!ห)ลายจุด|จุดขาว|จุดด่าง|ลายด่าง/],
  ['mane', /แผงคอ/],
  ['beak', /จะงอย|ปากนก/],
  ['feathers', /ผิวมีขนนก|ขนนกสี[ก-๙]*ตาม/],
  ['longears', /หูกระต่าย|หูยาวตั้ง/],
  ['crest', /หงอน(?!ใบไม้)/],
  ['muzzle', /ปากยื่น|จมูกยื่น(?!เหมือนจะงอย)/],
  ['horns', /เขา(?:เล็ก|สั้น|หัก|ตุ่ม|โค้ง|ยาว|ทอง|ดำ|เทา|แหลม|สองข้าง|หนึ่งคู่|สองเส้น)/],
  ['tail:fluffy', /หาง(?:สั้น)?ฟู|หางพู่|หางพวง|หางหมาป่า/],
  ['tail:lizard', /หางเรียวยาว|หางจิ้งจก/],
  ['tail:spade', /หางลูกศร|หางปีศาจ|หางยาวพันรอบเอว|หางสั้นพับ/],
  ['glow-eyes', /ตา(?:สอง|ทั้งสอง)?ดวงเรือง|ตาเรือง|ตาแดงเรือง/],
];
/** The personal feats of a text (the description) and of the ของ list (a pair of glasses may be named only there). */
export function featsOf(desc: string, items: readonly string[] = []): string[] {
  const out: string[] = [];
  const text = items.length ? `${desc} ${items.join(' ')}` : desc;
  for (const [id, re] of FEAT_RULES) if (re.test(text)) out.push(id);
  // one of the two face items, not both, and a monocle wins
  return out.includes('monocle') ? out.filter((x) => x !== 'glasses') : out;
}

// ---------- how worn the clothes are (0..1) ----------

const WEAR_RULES: [number, RegExp][] = [
  [0.75, /ขาดวิ่น|ผุพัง|ผุกร่อน|ฉีกขาด|ขาดเป็นริ้ว|ขี้ริ้ว|ชำรุด|เป็นรูหลายรู|เศษผ้า/],
  [0.55, /ขาด|เป็นรู|ไหม้เป็นรู|ปะหลาย|ปะทับ/],
  [0.4, /ปะ|สึก|ซีดจาง|ซีด|เก่า|ซ่อมแล้วซ่อมอีก|ซ้ำ|แห้งกรอบ|ซักบ่อย/],
  [0.25, /เปื้อน|คราบ|เขม่า|ฝุ่น|เปียก|หม่น|เหม็น/],
  [0.1, /ยับ|รุ่ย/],
];
const WEAR_NEW = /สะอาด|ใหม่|เรียบร้อย|เรียบสะอาด|รีดเรียบ|ขัดมัน|เงางาม/;
export function wearOf(text: string): number {
  let w = 0, n = 0;
  for (const [v, re] of WEAR_RULES) {
    const m = text.match(new RegExp(re.source, 'g'));
    if (m) { w = Math.max(w, v); n += m.length; }
  }
  if (n > 1) w += Math.min(0.2, 0.05 * (n - 1));
  if (WEAR_NEW.test(text)) w = Math.max(0, w - 0.2);
  return Math.round(Math.min(1, w) * 100) / 100;
}

// ---------- a stable hash ----------

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export const pickBy = <T>(a: readonly T[], seed: string): T => a[hash(seed) % a.length];

/** A skin of the race: a darker or a lighter half by the hint, else any; always the same for the same seed. */
export function pickSkin(skins: readonly string[], hint: 'dark' | 'light' | null, seed: string): string {
  if (!skins.length) return '#e8b48a';
  if (!hint || skins.length < 3) {
    if (!hint) return pickBy(skins, seed);
    const sorted = [...skins].sort((a, b) => lum(a) - lum(b));
    return hint === 'dark' ? sorted[0] : sorted[sorted.length - 1];
  }
  const sorted = [...skins].sort((a, b) => lum(a) - lum(b));
  const half = Math.max(1, Math.floor(sorted.length / 2));
  return pickBy(hint === 'dark' ? sorted.slice(0, half) : sorted.slice(sorted.length - half), seed);
}

// ---------- races and sub-lines ----------

/** A race named in a free text (a successor row, an NPC whose people code is empty): the first rule that matches. */
export const RACE_BY_WORD: Rule<string>[] = [
  ['darkelf', /ดาร์กเอลฟ์/], ['elf', /เอลฟ์/], ['dwarf', /แคระ/], ['orc', /ออร์ค|โอเกอร์/], ['halfling', /ฮาล์ฟลิง/],
  ['naga', /นาคา/], ['dragonkin', /มังกร/], ['vampire', /แวมไพร์/], ['fae', /ภูต/], ['slime', /สไลม์|เห็ด/], ['demonkin', /ปีศาจ/],
  ['merfolk', /เงือก|ไซเรน|กัปปะ|สัตว์ทะเล|สัตว์ยักษ์ทะเล|คราเคน/], ['winged', /อาเวียน|ปีก/], ['giant', /ยักษ์|ไซคลอปส์|จอตุน/],
  ['lavakin', /ลาวา/], ['construct', /จักรกล|ตุ๊กตา|ผู้ติดตั้ง/], ['soulmachine', /หุ่น/], ['mummy', /มัมมี่/], ['ghoul', /กูล|ผี|วิญญาณ/],
  ['beast', /สัตว์|หมาป่า|เสือ|แมว|กวาง|วัว|นก|อูฐ|จิ้งจก|จิ้งจอก|หมี|สิงโต/], ['human', /มนุษย์|ชาว|ชน/],
];
/** Spirits and the dead drawn as a pale body: the colour word after `โปร่งแสงสี` of the description, else this. */
export const SPIRIT = /^(ผี|วิญญาณ)/;
export const SPIRIT_SKIN = '#8a9aa8';

/** Sub-lines the docs describe that the lore table lists only as a group (`เสือและแมวใหญ่`) or not at all (the underground elves): added to their race. */
export const LINE_EXTRA: Record<string, string[]> = {
  beast: ['เสือ', 'สิงโต', 'แมวใหญ่', 'กวาง', 'วัว', 'อูฐ', 'จิ้งจก', 'หมี', 'กระต่าย'],
  elf: ['เอลฟ์ใต้ดิน'],
};
const NEVER = /(?!)/;
/** Which words of the race text of an NPC mean a sub-line of the lore table (docs/lore/races/README.md). A line with no entry matches its own name. */
export const LINE_MATCH: Record<string, Record<string, RegExp>> = {
  human: { ผู้ถูกอัญเชิญ: /อัญเชิญ|ต่างภพ/, ผู้กลับชาติ: /กลับชาติ/ },
  dwarf: { ช่างตี: /ช่างตี|คนแคระช่าง/, คนแคระเหนือ: /แคระเหนือ/ },
  orc: { ออร์คสันติ: /สันติ/ },
  // the animals: the grouped names of the lore table give way to the animal each NPC is (the cats and the deer split in three and two)
  beast: {
    หมาป่า: /หมาป่า|จิ้งจอก/, เสือและแมวใหญ่: NEVER, กวางและวัว: NEVER, อูฐและจิ้งจกทราย: NEVER, นก: /นก/,
    เสือ: /เสือ(?!ดาว)/, สิงโต: /สิงโต/, แมวใหญ่: /แมว|เสือดาว|ชีตาห์/, กวาง: /กวาง/, วัว: /วัว|ควาย/, อูฐ: /อูฐ/, จิ้งจก: /จิ้งจก/, หมี: /หมี/, กระต่าย: /กระต่าย/,
  },
  merfolk: { เงือก: /^เงือก$/ },
  winged: { ชาวน้ำฟ้า: /ชาวน้ำฟ้า|ปีกฟ้า/, ปีกสั้น: /ปีกสั้น/, ปีกฟ้า: /ปีกฟ้า/ },
  construct: { ผู้รอดชีวิตตุ๊กตา: /ตุ๊กตา/, ลูกผสมนีออน: /นีออน/ },
  slime: { เห็ด: /เห็ด/ },
  elf: { เอลฟ์ใต้ดิน: /ใต้ดิน/ },
};

/**
 * What a sub-line shows over its race: only words the docs write (02-races.md สายเลือดย่อย, the lore table, 01-human หน้าและผิว). `feats` replaces the
 * race's feats; the bird, the lizard and the rabbit take no animal ears of the wolf (`ears`).
 */
export const LINE_OVERRIDES: Record<string, (raceFeats: string[]) => LineOverrides> = {
  'human/ชาวหมอก': () => ({ skin: '#f0e8e4' }),
  'human/ชนผืนทราย': () => ({ skin: '#a06a42' }),
  'human/ชนใต้ทราย': () => ({ skin: '#e8e0c8' }),
  'human/ชาวหิน': () => ({ skin: '#a09a90' }),
  'human/มนุษย์น้ำแข็ง': () => ({ skin: '#d8e4ee' }),
  'human/มนุษย์เรือ': () => ({ skin: '#b0805a' }),
  'elf/เอลฟ์จันทรา': () => ({ skin: '#e6eef6', hairColor: '#d8dce8' }),
  'elf/เอลฟ์สูง': () => ({ scale: 1.17 }),
  'elf/เอลฟ์ราก': () => ({ skin: '#8a6a48' }),
  'elf/เอลฟ์ฟ้า': (f) => ({ skin: '#e4eef2', hairColor: '#b8d8f0', accent: '#bfe3ff', feats: [...f, 'wings:insect'] }),
  'elf/เอลฟ์ใต้ดิน': () => ({ skin: '#8a7a9a', hairColor: '#e0e0e8' }),
  'dwarf/ผู้ปิดรูน': (f) => ({ feats: [...f, 'mask'] }),
  'dwarf/คนเหมืองลึก': () => ({ skin: '#efd8c8' }),
  'dwarf/คนแคระเหนือ': () => ({ skin: '#e8dcd4', hairColor: '#f0f2f6' }),
  'orc/โอเกอร์': () => ({ scale: 1.29 }),
  'orc/ออร์คเถ้า': () => ({ skin: '#8a8a82' }),
  'beast/หมาป่า': (f) => ({ hairColor: '#7a7a80', feats: [...f, 'muzzle'] }),
  'beast/เสือ': (f) => ({ hairColor: '#c8782a', feats: [...f, 'muzzle', 'stripes'] }),
  'beast/สิงโต': (f) => ({ hairColor: '#c89850', feats: [...f, 'muzzle', 'mane'] }),
  'beast/แมวใหญ่': (f) => ({ hairColor: '#c8a050', feats: [...f, 'muzzle', 'spots'] }),
  'beast/กวาง': (f) => ({ hairColor: '#9a6a3a', feats: [...f, 'muzzle', 'antlers', 'spots'] }),
  'beast/วัว': (f) => ({ hairColor: '#6a4a30', feats: [...f, 'muzzle', 'horns'] }),
  'beast/นก': () => ({ hairColor: '#8a7a68', feats: ['feathers', 'beak', 'beads'], ears: 'none' }),
  'beast/อูฐ': (f) => ({ skin: '#d8b888', hairColor: '#c8a878', feats: [...f, 'muzzle'] }),
  'beast/จิ้งจก': () => ({ skin: '#8a9a5a', hairColor: '#6a7a4a', feats: ['crest', 'scales', 'slit', 'tail:lizard', 'beads'], ears: 'none' }),
  'beast/หมี': (f) => ({ hairColor: '#5a3a28', feats: [...f, 'muzzle'] }),
  'beast/กระต่าย': (f) => ({ hairColor: '#b8a898', feats: [...f, 'muzzle', 'longears'], ears: 'none' }),
  'merfolk/เงือกน้ำลึก': (f) => ({ skin: '#2a4a5a', feats: [...f, 'glow-eyes'] }),
  'merfolk/กัปปะ': (f) => ({ skin: '#5a8a4a', feats: [...f, 'wet'] }),
  'winged/ปีกราตรี': (f) => ({ feats: f.map((x) => (x === 'wings:feather' ? 'wings:night' : x)) }),
  'winged/ปีกเกล็ด': (f) => ({ feats: f.map((x) => (x === 'wings:feather' ? 'wings:scale' : x)) }),
  'winged/ปีกสั้น': () => ({ accent: '#c4bcae' }),
  'winged/ชาวน้ำฟ้า': (f) => ({ skin: '#8ab8e0', accent: '#9ad0f0', feats: [...f, 'gills'] }),
  'fae/ภูตแสง': () => ({ skin: '#fff0c0', accent: '#fff0a0' }),
  'fae/ภูตลม': () => ({ skin: '#d0e0ff', accent: '#bfd8ff' }),
  'fae/ภูตน้ำ': () => ({ skin: '#d0f0e0', accent: '#9af0d8' }),
  'fae/ภูตจิ๋ว': () => ({ skin: '#f0d0f0', scale: 0.46 }),
  'giant/ไซคลอปส์': (f) => ({ feats: [...f, 'cyclops'] }),
  'giant/จอตุน': () => ({ skin: '#a8c8d8' }),
  'demonkin/ปีศาจเพลิง': (f) => ({ skin: '#a8382a', feats: [...f, 'embers'] }),
  'construct/ผู้รอดชีวิตตุ๊กตา': (f) => ({ skin: '#ece6dc', feats: [...f, 'tattoo', 'puppet'] }),
  'construct/ลูกผสมนีออน': (f) => ({ accent: '#3a8aff', feats: [...f, 'sparkle'] }),
};

/** Eye colour of a race when the description names none (02-races.md หน้าและผิว). */
export const RACE_EYE: Record<string, string> = {
  dragonkin: '#d9a030', vampire: '#a02030', demonkin: '#d02a4a', lavakin: '#ffc040', naga: '#c8d030', darkelf: '#8a7ac0', beast: '#c8a030',
};
export const DEFAULT_EYE = '#2a2024';
export const DEFAULT_HAIR = '#3a2a20';
export const ELDER_HAIR = '#c0c0c4';

// ---------- marks that sit on one person, not on a line ----------

/** Wing colours of the feather-winged: the words after `ปีก` (`ปีกขนสีน้ำตาลทราย`); the feather wing paints the accent, paled. */
export const WING_COLOURS: [RegExp, string][] = [
  [/^ขาวทอง/, '#f4e6b0'], [/^น้ำตาลเทา/, '#b8a898'], [/^น้ำตาลทราย/, '#d8c090'], [/^น้ำตาล/, '#c8a070'], [/^ขาวหม่น/, '#d0ccc4'],
  [/^ขาวนวล/, '#f0ead8'], [/^เทา/, '#b4b4b8'], [/^ฟ้าเข้ม/, '#5a8ac0'], [/^ฟ้า/, '#9ad0f0'],
];
export function wingAccentOf(text: string): string | null {
  const m = text.match(/ปีก([ก-๙]{1,16})/);
  if (!m) return null;
  const w = m[1].replace(/^(?:ขนนก|ขน)?(?:สี)?/, '');
  return WING_COLOURS.find(([re]) => re.test(w))?.[1] ?? null;
}
/** Animal ears on a person of another race (a half-beast: `หูแหลมมีขนที่ปลาย` `หูหมาป่า`). */
export const ANIMAL_EARS = /หู(?:แหลม)?มีขน|หู(?:สัตว์|หมาป่า|หมา|แมว|เสือ|ขนฟู)/;
/** A crown of a pale or dull metal: the crown part takes the accent when the accent has little colour (silver, iron, bone), else it is gold. */
export const CROWN_ACCENTS: [RegExp, string][] = [
  [/มงกุฎ(?:สี)?เงิน/, '#c8ccd8'], [/มงกุฎกระดูก/, '#d9cfb2'], [/มงกุฎเหล็ก/, '#6a6e78'],
];
export const crownAccentOf = (text: string): string | undefined => CROWN_ACCENTS.find(([re]) => re.test(text))?.[1];
