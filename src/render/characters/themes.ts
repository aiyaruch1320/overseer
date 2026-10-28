// A visual theme for each of the 21 peoples in docs/races. A theme is the people's "silhouette language" (what you can read from a
// dark outline at a glance), their palette, the features the painter adds (horns, wings, cracks, wraps...) and how they carry
// themselves. Sub-lines (docs/races/README.md: สายเลือดย่อย) bend the theme: an avian of the night wing is not a white one.
import { IDLE_STANDARD, IDLE_FLUTTER } from './pose';

export type Ears = 'round' | 'long' | 'point' | 'beast' | 'fin' | 'none';
export type Lower = 'legs' | 'serpent' | 'gown' | 'blob';
export type Gait = 'normal' | 'stomp' | 'glide' | 'hop' | 'shamble' | 'float';

export interface Line {
  name: string;
  note: string;
  skins?: number[];
  accent?: number[];
  hair?: number[];
  add?: string[];
  drop?: string[];
  scale?: number;
  outfit?: string;
}

export interface RaceTheme {
  id: string;
  name: string;
  motif: string; // the design idea in a sentence (shown in the gallery and docs/characters)
  scale: number; // height relative to a human
  head: number; // head size
  wide: number; // body width
  skins: number[];
  hairs?: number[]; // a people with its own hair colours (everyone else uses the common set)
  eyes?: number[];
  accent: number[]; // signature colours for trim, glow, horns and jewellery
  ears: Ears;
  lower: Lower;
  gait: Gait;
  feats: string[];
  idle: number[];
  lines: Record<string, Line>;
  hairless?: boolean;
  bearded?: number; // chance of a beard on men
}

export const THEMES: Record<string, RaceTheme> = {
  human: {
    id: 'human', name: 'มนุษย์', motif: 'ไม่มีธาตุประจำตัว จึงแต่งกายตามที่ที่อยู่ ผิวและผมหลากหลายที่สุด เครื่องแต่งกายตามภูมิภาค มีสัญญาและตราประทับเป็นเครื่องหมายของการต่อรอง',
    scale: 1, head: 1, wide: 1, skins: [0xf6d2b0, 0xe8b48a, 0xc98e62, 0xa06a42, 0x7a4a2a, 0xf0c8a0, 0xd8a070], accent: [0xd9a030, 0x8a3a2a, 0x2a5a8a],
    ears: 'round', lower: 'legs', gait: 'normal', feats: [], idle: IDLE_STANDARD, bearded: 0.4,
    lines: {
      plain: { name: 'ชาวทุ่ง', note: 'เสื้อผ้าทอหยาบสีดินและข้าวสาลี ผ้าคาดเอว', accent: [0xb08a3a] },
      mist: { name: 'ชาวหมอก', note: 'ผิวซีด ผ้าคลุมสีเทาควัน ตะเกียงติดเอว', skins: [0xe8e0e8, 0xd8d0d8, 0xf0e8e8], accent: [0x8a94a8], add: ['mistcloak'] },
      sand: { name: 'ชนผืนทราย', note: 'ผ้าคลุมศีรษะ ผ้าพันสีทราย ผิวแดดเผา', skins: [0xc98e62, 0xa06a42, 0xd8a070], accent: [0xd8b060], outfit: 'light' },
      ship: { name: 'มนุษย์เรือ', note: 'ผ้าลายขวางแบบกะลาสี รอยสักเชือกที่แขน', accent: [0x2a5a8a], outfit: 'sailor', add: ['tattoo'] },
      ground: { name: 'ชาวพื้น', note: 'ไร้ปีกบนเกาะลอยฟ้า สวมเชือกนิรภัยผูกเอว ชุดแรงงานเรียบ', accent: [0x8a7a5a], add: ['rope'] },
      reborn: { name: 'ผู้กลับชาติ', note: 'มีเส้นแสงจาง ๆ บนหน้าผาก ตาลึกกว่าอายุ', accent: [0xc8e8ff], add: ['rebirthmark'] },
      summoned: { name: 'ผู้ถูกอัญเชิญ', note: 'ชุดแปลกตาจากต่างโลก (เสื้อสเวตเตอร์/ชุดนักเรียน) มีตราวงเวทจางที่หลังมือ', accent: [0x6ad0ff], add: ['summonsigil'], outfit: 'otherworld' },
    },
  },
  elf: {
    id: 'elf', name: 'เอลฟ์', motif: 'ผู้ดูแลต้นไม้โลก สูงเพรียว หูยาว ลวดลายใบไม้และเถาวัลย์ สีเขียวมรกตกับทองอ่อน ท่วงท่านิ่งและช้าเหมือนมีเวลาเหลือเฟือ',
    scale: 1.08, head: 0.96, wide: 0.86, skins: [0xf6e0c8, 0xf2d6b8, 0xe8c8a8, 0xd8b890], hairs: [0xe8e0a0, 0xd9a030, 0xf0f0f0, 0xc0c0c8, 0x5a3a1e, 0x2a6a4a],
    eyes: [0x3a7a3a, 0x2a8a8a, 0x8a6a2a, 0x2a5a8a], accent: [0x3f9a5a, 0xe0c060, 0x9ad0a0],
    ears: 'long', lower: 'legs', gait: 'glide', feats: ['leafcrest', 'vines'], idle: IDLE_STANDARD,
    lines: {
      tree: { name: 'เอลฟ์ต้นไม้', note: 'มงกุฎใบไม้สด ชุดเขียวมรกตทอจากเปลือกอ่อน', accent: [0x3f9a5a] },
      moon: { name: 'เอลฟ์จันทรา', note: 'ผมเงิน ผิวเย็น ชุดน้ำเงินม่วงปักเสี้ยวจันทร์', hair: [0xf0f0f8, 0xc0c8e8], accent: [0x7a8ae0, 0xe8e8ff], add: ['moonmark'] },
      sky: { name: 'เอลฟ์ฟ้า', note: 'ขนนกเล็ก ๆ ติดผม ชุดฟ้าอ่อนขาว สายลมพลิ้ว', accent: [0x8ac8f0, 0xffffff], add: ['featherhair'] },
      root: { name: 'เอลฟ์ราก', note: 'ผิวคล้ำน้ำตาลเขียว ผมถักเป็นรากไม้ ชุดสีดิน มอสเกาะไหล่', skins: [0xc8a878, 0xb89868], accent: [0x7a5a2a, 0x5a8a3a], add: ['moss'] },
      high: { name: 'เอลฟ์สูง', note: 'สูงที่สุด มงกุฎทองขาว เสื้อคลุมยาวลายพันธุ์ไม้', scale: 1.15, accent: [0xe8d070, 0xfff4c0], add: ['halo'] },
    },
  },
  darkelf: {
    id: 'darkelf', name: 'ดาร์กเอลฟ์', motif: 'ผู้ปฏิเสธคำสาบานต่อต้นไม้ ผิวม่วงเทาคล้ำจากเถ้า ผมขาวเงิน ตาไวแสงน้อย แสงลาวาส้มแดงจากใต้พิภพเป็นแสงเดียว ปกครองโดยมารดา ผู้หญิงสวมมงกุฎใยแมงมุมประดับ',
    scale: 1.04, head: 0.96, wide: 0.86, skins: [0x7a6a8f, 0x6a5a80, 0x8a7aa0, 0x5a4a70], hairs: [0xe8e8f0, 0xc8c8d8, 0xffffff, 0x9aa0c0],
    eyes: [0xd04a3a, 0xe0a030, 0x6ad0ff], accent: [0xe0662a, 0xb0b8d0, 0x4a3a6a], ears: 'long', lower: 'legs', gait: 'glide',
    feats: ['webcrown', 'lavaglow', 'slit'], idle: IDLE_STANDARD,
    lines: {
      mother: { name: 'มารดา', note: 'ผู้ปกครอง มงกุฎใยแมงมุมเงินสูง ชุดดำขลิบเงิน', accent: [0xe0e0f0, 0xe0662a], add: ['matron'] },
      assassin: { name: 'นักฆ่าพเนจร', note: 'ผ้าคลุมหน้า มีดสั้นคู่ ชุดหนังดำ', add: ['mask'], outfit: 'cloak' },
      shadowless: { name: 'ผู้ไร้เงา', note: 'ไม่มีเงาทอดที่พื้น ขอบตัวเลือนเป็นหมอก', add: ['noshadow'] },
    },
  },
  dwarf: {
    id: 'dwarf', name: 'คนแคระ', motif: 'รูปทรงสี่เหลี่ยมหนักแน่น หนวดเคราถักประดับห่วงโลหะ รอยสักรูนบนแขน แสงเตาหลอมสะท้อนหน้า หนึ่งคำพูดคือหนึ่งก้อนเหล็ก',
    scale: 0.8, head: 1.05, wide: 1.28, skins: [0xe0a07a, 0xd08a62, 0xb87050, 0x9a6040], hairs: [0x9a3a1a, 0x5a3a1e, 0x2a1a10, 0xc0c0c8, 0xd9a030],
    eyes: [0x5a3a1e, 0x2a5a8a, 0x3a7a3a], accent: [0xd9a030, 0xe0662a, 0x8a90a0], ears: 'round', lower: 'legs', gait: 'stomp', feats: ['runes', 'beadbeard'],
    idle: IDLE_STANDARD, bearded: 0.97,
    lines: {
      smith: { name: 'ช่างตี', note: 'ผ้ากันเปื้อนหนัง ค้อนใหญ่ เขม่าที่แก้ม', outfit: 'apron' },
      sealed: { name: 'ผู้ปิดรูน', note: 'แถบผ้าปิดรูนสลักสีดำที่แขนและหน้าผาก ปากแน่น', add: ['sealband'] },
      opener: { name: 'ผู้เปิดรูน', note: 'รูนเรืองแสงสีฟ้าเปิดโล่งบนแขน', add: ['glowrunes'], accent: [0x6ad0ff] },
      engineer: { name: 'วิศวกร', note: 'แว่นกันฝุ่นยกบนหมวก เครื่องมือเต็มเข็มขัด ฟันเฟือง', add: ['goggles'], outfit: 'leather' },
      deep: { name: 'คนเหมืองลึก', note: 'ผิวซีดเพราะไม่เห็นแดด ตะเกียงติดหมวก ตาโตไวแสง', skins: [0xe8c8b0, 0xd8b8a0], add: ['lamp'], outfit: 'miner' },
      north: { name: 'คนแคระเหนือ', note: 'ขนสัตว์หนา หมวกขน เกล็ดน้ำแข็งเกาะเครา', outfit: 'fur', add: ['frost'] },
    },
  },
  orc: {
    id: 'orc', name: 'ออร์ค', motif: 'ร่างใหญ่ไหล่กว้างเพราะธาตุสงครามทำให้หิว เขี้ยวล่างงอน ผิวเขียวมะกอกหรือเทาเถ้า เกราะหนังและกระดูก รอยแผลคือเกียรติ ผมเปียหรือจุกกลางหัว',
    scale: 1.12, head: 0.98, wide: 1.3, skins: [0x6f9a4f, 0x5a8a40, 0x7aa860, 0x8a9a5a], hairs: [0x1a1a1a, 0x2a2a2a, 0x5a3a1e, 0x9a2a1a],
    eyes: [0xd0a030, 0xc03a2a, 0x2a2a2a], accent: [0xc8c0a0, 0x8a2a1a, 0x5a3a1e], ears: 'point', lower: 'legs', gait: 'stomp',
    feats: ['tusks', 'warpaint', 'scars'], idle: IDLE_STANDARD, bearded: 0.35,
    lines: {
      ogre: { name: 'โอเกอร์', note: 'ใหญ่กว่าออร์คทั่วไปเกือบเท่าตัว เขี้ยวใหญ่ ถือกระบองไม้', scale: 1.4, add: ['clubbed'] },
      ash: { name: 'ออร์คเถ้า', note: 'ผิวเทาเถ้า รอยเขม่า ตาแดงก่ำ', skins: [0x8a8a80, 0x7a7a74, 0x9a9a90], accent: [0x3a3a3a, 0xe0662a] },
      craft: { name: 'ออร์คช่าง', note: 'ผ้ากันเปื้อนและเครื่องมือแทนอาวุธ', outfit: 'apron', drop: ['warpaint'] },
      sand: { name: 'ออร์คทราย', note: 'ผ้าพันศีรษะสีทราย เกราะหนังเบา', skins: [0x9a9a5a, 0x8a8a4a], outfit: 'light', accent: [0xd8b060] },
      peace: { name: 'ออร์คสันติ', note: 'ไม่ถืออาวุธ ผ้าคาดสีเขียวและดอกไม้ที่ใบหู', add: ['peaceflower'], drop: ['warpaint', 'scars'], outfit: 'tunic' },
    },
  },
  halfling: {
    id: 'halfling', name: 'ฮาล์ฟลิง', motif: 'ตัวเล็กกลมแก้มแดง ผมหยิกฟู เท้าเปล่าขนฟู เสื้อกั๊กสีสดและกระดุมทอง เสียงหัวเราะและกลิ่นขนมปัง โชคดีจนน่าหมั่นไส้ มักมีแอปเปิลในมือ',
    scale: 0.74, head: 1.1, wide: 1.12, skins: [0xf0c49a, 0xe0a878, 0xc88a5a, 0xa87048], hairs: [0x7a4a20, 0x5a3a1e, 0x9a5a2a, 0xd9a030, 0x2a1a10],
    eyes: [0x5a3a1e, 0x3a7a3a], accent: [0x8ac84a, 0xe04848, 0xd9a030], ears: 'point', lower: 'legs', gait: 'hop', feats: ['hairyfeet', 'rosycheeks'],
    idle: IDLE_STANDARD, bearded: 0.1,
    lines: {},
  },
  beast: {
    id: 'beast', name: 'เผ่าสัตว์', motif: 'หูและหางตามสายพันธุ์ ขนบนแก้มและแขน ฝ่ามือมีอุ้งนิ้ว เครื่องประดับลูกปัดและขนนก รักพวกพ้อง หนึ่งฝูงคือหนึ่งชีวิต สวมผ้าสีเดียวกันทั้งฝูง',
    scale: 1.02, head: 1, wide: 1.04, skins: [0xc98f5a, 0xb07a48, 0xe0b080, 0x8a6a4a, 0x6a5a4a, 0xf0e0d0], accent: [0xd9a030, 0x3a8ac0, 0xc04a3a],
    ears: 'beast', lower: 'legs', gait: 'normal', feats: ['fur', 'tail:fluffy', 'pawhands', 'beads'], idle: IDLE_STANDARD,
    lines: {
      wolf: { name: 'หมาป่า', note: 'หูตั้งแหลม หางพวง ขนคอฟู ผ้าคลุมไหล่ขน', skins: [0x8a8a90, 0x6a6a74, 0xb0b0b8], add: ['mane'] },
      cat: { name: 'เสือและแมวใหญ่', note: 'ลายพาดแก้มและแขน หูกลม หางยาว ตาเรียวสีทอง', skins: [0xd9a050, 0xe0b868, 0xf0e0b0], add: ['stripes', 'slit', 'tail:long'], drop: ['tail:fluffy'] },
      deer: { name: 'กวางและวัว', note: 'เขาแตกกิ่งหรือเขางอ จุดขาวบนหลัง หูใหญ่', skins: [0xb08050, 0xc89868], add: ['antlers', 'spots'], drop: ['tail:fluffy', 'tail:short'] },
      bird: { name: 'นก', note: 'ขนบนหัวเป็นหงอน ตาวงกลมใส ปลายแขนมีขนปีกเล็ก', skins: [0xf0e0c8, 0xd8c8a8], add: ['crest', 'wingarms'], drop: ['tail:fluffy', 'fur'] },
      sand: { name: 'อูฐและจิ้งจกทราย', note: 'ผ้าคลุมทะเลทราย หูใหญ่ขนอ่อน เกล็ดทรายตามแขน', skins: [0xc8a070, 0xd8b078], outfit: 'light', add: ['sandscales'] },
    },
  },
  naga: {
    id: 'naga', name: 'นาคา', motif: 'ท่อนล่างเป็นหางงูยาวพันเป็นขด ตัวตรงสง่า ผิวเกล็ดเขียวมรกตเหลือบทอง เครื่องประดับทองและอัญมณี ฮู้ดแผ่หลังศีรษะ เชื่อเรื่องการลอกคราบ ผ้าลอกคราบเก่าพาดไหล่เป็นผ้าสไบ',
    scale: 1.04, head: 1, wide: 0.95, skins: [0x4f8f7a, 0x5a9a6a, 0x3a7a8a, 0x6a8a4a], hairs: [0x1a3a3a, 0x0a2a2a, 0x2a5a4a], eyes: [0xe0c030, 0xd09a20, 0x9ad060],
    accent: [0xe8c050, 0x2a9a8a, 0xb02a4a], ears: 'fin', lower: 'serpent', gait: 'glide', feats: ['scales', 'slit', 'hood', 'goldjewel', 'shedskin'], idle: IDLE_STANDARD,
    lines: {
      river: { name: 'นาคาลำน้ำ', note: 'เขียวมรกต พร้อมไข่มุกประดับ', accent: [0xe8e8f0, 0x2a9a8a] },
      king: { name: 'พญานาคราช', note: 'ฮู้ดหลายหัวทองอร่าม มงกุฎ แสงศักดิ์สิทธิ์', add: ['multihood', 'halo'], skins: [0x2a9a8a, 0x3aaa8a] },
      half: { name: 'นาคาลูกครึ่ง', note: 'ขาคนจริงท่อนล่าง มีเกล็ดเขียวที่แขนและแก้ม ไม่มีฮู้ด', add: ['legs'], drop: ['hood'] },
    },
  },
  dragonkin: {
    id: 'dragonkin', name: 'เผ่ามังกร', motif: 'ลูกหลานสายเลือดมังกร เขาโค้งสองข้าง เกล็ดที่แก้มคอและแขน หางหนา ตาแนวตั้งสีทอง สวมเกราะและผ้าสีธาตุของมังกรอุปถัมภ์ ท่าทางหยิ่งทะนง',
    scale: 1.1, head: 1, wide: 1.12, skins: [0xb04a3a, 0x9a3a2a, 0x3a6aa0, 0x2a8a5a, 0x8a6a2a], hairs: [0xd9a030, 0x2a1a10, 0xe8e0d0, 0x9a2a1a],
    eyes: [0xe8b020, 0xe05a20, 0x6ad0ff], accent: [0xd9a030, 0xe0662a, 0x2a2a3a], ears: 'point', lower: 'legs', gait: 'stomp', feats: ['horns', 'scales', 'tail:lizard', 'slit'],
    idle: IDLE_STANDARD,
    lines: {
      fire: { name: 'สายเพลิง', note: 'แดงทอง เกราะลายเปลวไฟ ควันบาง ๆ ที่ปาก', add: ['smoke'] },
      sea: { name: 'สายสมุทร', note: 'น้ำเงินเขียว เกล็ดมันเหมือนปลา ครีบข้างขมับ', skins: [0x3a6aa0, 0x2a8a8a], accent: [0x6ad0ff, 0xe8e8f0], add: ['finears'] },
      stone: { name: 'สายศิลา', note: 'เกล็ดเทาด้าน เขาตรงหนา ร่างใหญ่', skins: [0x7a7a80, 0x6a6a70], scale: 1.2, accent: [0xa0a0a8] },
      scaled: { name: 'ปีกเกล็ด', note: 'ผสมเผ่าปีก มีปีกคล้ายหนังเกล็ดแดง', add: ['wings:scale'] },
    },
  },
  vampire: {
    id: 'vampire', name: 'แวมไพร์', motif: 'ผิวซีดดั่งกระเบื้อง ตาแดงเรือง เขี้ยวเล็ก ปกเสื้อสูง เสื้อคลุมดำแดงเงิน ใช้สมุดบัญชีหนี้เลือดเป็นเครื่องหมาย ถือขวดเลือดและแหวนตราลูกหนี้ ท่าทางสง่าเย็นชา',
    scale: 1.06, head: 0.96, wide: 0.9, skins: [0xe8e0e8, 0xd8d0e0, 0xf0e8e0], hairs: [0x1a1020, 0xf0f0f0, 0x6a1a2a, 0xc0c0c8], eyes: [0xd02020, 0xe04a4a, 0xe0a020],
    accent: [0x8a1a2a, 0xc0c0d0, 0x2a1a3a], ears: 'point', lower: 'legs', gait: 'glide', feats: ['fangs', 'tallcollar', 'ledger', 'redeyes'], idle: IDLE_STANDARD,
    lines: {
      noble: { name: 'ผู้ดีหมอก', note: 'เสื้อคลุมยาวปกสูง กระดุมเงิน', add: ['cape'] },
      guild: { name: 'กิลด์เงา', note: 'ผ้าคลุมหมวก มีดสั้น ตาแดงใต้เงา', outfit: 'cloak', add: ['hoodshadow'] },
      wanderer: { name: 'พเนจร', note: 'เสื้อโค้ตยับ ไม่มีบ้าน แว่นกรองแสง', add: ['darkglasses'] },
    },
  },
  fae: {
    id: 'fae', name: 'ภูตพราย', motif: 'ตัวจิ๋ว ปีกบางโปร่งแสงสะท้อนรุ้ง ลอยสูงจากพื้นเล็กน้อย แสงฝุ่นระยิบ ชุดทำจากกลีบดอกไม้และใบไม้ แพ้เหล็ก จึงไม่มีโลหะบนตัว รอยยิ้มซุกซน',
    scale: 0.58, head: 1.2, wide: 0.78, skins: [0xf0d0f0, 0xd0f0e0, 0xd0e0ff, 0xfff0c0], hairs: [0x80e0d0, 0xe07a9a, 0xf0e070, 0xa090f0, 0xffffff], eyes: [0x6a3aa0, 0x2a9a8a, 0xd05a9a, 0x3a8ac0],
    accent: [0xffd0f0, 0x9af0d8, 0xfff0a0], ears: 'point', lower: 'legs', gait: 'float', feats: ['wings:insect', 'sparkle', 'antenna', 'petals'], idle: IDLE_FLUTTER,
    lines: {
      light: { name: 'ภูตแสง', note: 'เรืองแสงเหลืองนวล ปีกขาวทอง', accent: [0xfff4a0, 0xffffff], add: ['halo'] },
      wind: { name: 'ภูตลม', note: 'ปีกยาวเหมือนแมลงปอ ริบบิ้นพลิ้ว สีฟ้าขาว', accent: [0xa0d8ff, 0xffffff], add: ['ribbons'] },
      water: { name: 'ภูตน้ำ', note: 'หยดน้ำเกาะตัว ผิวฟ้าใส ปีกคล้ายครีบ', skins: [0xc0e8f8, 0xb0f0e8], accent: [0x6ad0ff, 0xe0ffff], add: ['droplets'] },
      tiny: { name: 'ภูตจิ๋ว', note: 'เล็กเท่านิ้ว ปีกใหญ่เกินตัว', scale: 0.4 },
    },
  },
  slime: {
    id: 'slime', name: 'สไลม์', motif: 'ก้อนเจลโปร่งแสงหยัดเป็นรูปทรงคล้ายคน ตาจุดกลมใหญ่ ในตัวลอยของที่เคยกลืนไว้ (เหรียญ กระดูก ดอกไม้) เลียนแบบหมวกและเครื่องประดับที่กลืนมา ยืดหดตามจังหวะ',
    scale: 0.82, head: 1, wide: 1.2, skins: [0x5ab0e8, 0x7ad070, 0xe07ab0, 0xe0c04a, 0xa070e0], accent: [0xffffff, 0xd9a030], ears: 'none', lower: 'blob', gait: 'hop',
    feats: ['gel', 'swallowed', 'hairless'], idle: IDLE_STANDARD, hairless: true,
    lines: {
      forest: { name: 'สไลม์ป่า', note: 'เขียวใส มีใบไม้และผลไม้ลอยอยู่ในตัว', skins: [0x7ad070, 0x9ae080] },
      sea: { name: 'สไลม์ทะเล', note: 'ฟ้าใส มีเปลือกหอยและมุก', skins: [0x5ab0e8, 0x7ad0e8], accent: [0xe8f0ff] },
      mushroom: { name: 'สไลม์เห็ด', note: 'หมวกเห็ดบนหัว สปอร์ลอยอ่อน ๆ', add: ['mushcap'], skins: [0xc08a5a, 0xe0a07a] },
      king: { name: 'ราชันย์สไลม์', note: 'มงกุฎจากของที่กลืน และตาที่ฉลาดผิดธรรมดา', add: ['crown', 'wisdom'], scale: 1.1 },
    },
  },
  demonkin: {
    id: 'demonkin', name: 'เผ่าปีศาจ', motif: 'ผิวแดงหรือม่วง เขาและหางปลายลูกศร ลายสัญญาที่ผิวเรืองแสงเป็นเส้นบางตามแขนและหน้าผาก ชุดเป็นทางการแบบเสมียนและเจ้าหนี้ ถือม้วนสัญญาและปากกาขนนก ยิ้มที่รู้ราคาของทุกอย่าง',
    scale: 1.04, head: 1, wide: 1, skins: [0xc06070, 0xa04a5a, 0x8a3a6a, 0x6a4a8a], hairs: [0x2a0a1a, 0xe8e0d0, 0x1a1020, 0x6a1a2a], eyes: [0xe0a020, 0xd02a4a, 0x6ad0ff],
    accent: [0xe0a030, 0xd02a4a, 0x2a1a2a], ears: 'point', lower: 'legs', gait: 'normal', feats: ['horns', 'tail:spade', 'contract', 'fangs'], idle: IDLE_STANDARD, bearded: 0.3,
    lines: {
      fire: { name: 'ปีศาจเพลิง', note: 'สายคาซ-ดูรัม ผิวแดงแสบ เขาคล้ำ ประกายเถ้าบนไหล่', skins: [0xc04a3a, 0xa03a2a], add: ['embers'] },
      broker: { name: 'นายหน้าสัญญา', note: 'แว่นเดียว สูทลายตารางหมึก ม้วนสัญญายาวจรดพื้น', add: ['monocle'], outfit: 'noble' },
    },
  },
  merfolk: {
    id: 'merfolk', name: 'เงือก', motif: 'ผิวฟ้าอมเขียวมีเกล็ดมุกที่แขนและขมับ หูเป็นครีบ เหงือกที่คอ เสื้อผ้าบางพลิ้วเหมือนครีบ ประดับเปลือกหอยและไข่มุก ขึ้นบกได้แต่เดินช้าแบบแกว่งเหมือนว่ายน้ำ ผมเหมือนสาหร่ายยาว',
    scale: 1, head: 1, wide: 0.92, skins: [0x9ad0d0, 0x8ac0e0, 0xa0d8c0, 0xc0e0f0], hairs: [0x3a80c0, 0x2aa09a, 0x6a4ac0, 0xe07a9a, 0xe8f0ff], eyes: [0x2a5a8a, 0x2a9a8a, 0x6a3aa0],
    accent: [0xe8e8f0, 0xf0a0b0, 0x4ab0c0], ears: 'fin', lower: 'gown', gait: 'glide', feats: ['gills', 'scales', 'pearls', 'finskirt', 'wet'], idle: IDLE_STANDARD,
    lines: {
      merrow: { name: 'เงือกเมอร์เรีย', note: 'ราชวงศ์ เปลือกหอยมุกเป็นมงกุฎ', add: ['shellcrown'], accent: [0xf0e8f0, 0xf0a0b0] },
      deep: { name: 'เงือกน้ำลึก', note: 'ผิวฟ้าเข้ม จุดเรืองแสงตามตัว ตาโตดำ', skins: [0x3a6a9a, 0x2a5a8a], add: ['biolum'], accent: [0x6af0ff] },
      siren: { name: 'ไซเรน', note: 'โน้ตเพลงลอยรอบตัว ตาหลับหรี่ ผมยาวมาก', add: ['songnotes'], hair: [0xe07a9a, 0xe8f0ff] },
      kappa: { name: 'กัปปะ', note: 'กระดองเขียวบนหลัง จานน้ำบนศีรษะ จะงอยปากเล็ก', skins: [0x6aa84f, 0x5a9a4a], add: ['shell', 'waterplate'], drop: ['gills'] },
    },
  },
  winged: {
    id: 'winged', name: 'เผ่าปีก', motif: 'ปีกขนนกใหญ่เหนือบ่าทั้งสองข้าง ชุดเบาลมพลิ้ว สายรัดอกยึดปีก ใช้ชีวิตบนเกาะลอยฟ้า มีเครื่องประดับทองตามธรรมเนียมบูชามังกร สามสายแยกด้วยสีปีก',
    scale: 1.04, head: 0.98, wide: 0.92, skins: [0xf6e0d0, 0xf0d0b0, 0xe0b890, 0xc89870], hairs: [0xffffff, 0xe8e0a0, 0xd9a030, 0x2a3a6a, 0xc0c8e0], eyes: [0x6ad0ff, 0xe0c030, 0x8a6a2a],
    accent: [0xffffff, 0xd9a030, 0x8ac8f0], ears: 'point', lower: 'legs', gait: 'glide', feats: ['wings:feather', 'sunstrap', 'goldcirclet'], idle: IDLE_STANDARD,
    lines: {
      white: { name: 'อาเวียนขาว', note: 'ปีกขาวบริสุทธิ์ ชุดขาวทอง รัศมีบางเหนือศีรษะ', add: ['halo'], accent: [0xffffff, 0xf2c94c] },
      night: { name: 'ปีกราตรี', note: 'ปีกหนังเหมือนค้างคาวดำม่วง ตาเรืองเหลือง ชุดดำม่วง', drop: ['wings:feather'], add: ['wings:bat'], accent: [0x6a4aa0, 0x2a1a3a, 0xe0c030], skins: [0xd8c8e0, 0xc0b0d0] },
      scale: { name: 'ปีกเกล็ด', note: 'เกล็ดแดงบนปีกและแขน มีเขาเล็ก ผสมเผ่ามังกร', drop: ['wings:feather'], add: ['wings:scale', 'hornsSmall', 'scales'], accent: [0xc03a2a, 0xd9a030], skins: [0xc89870, 0xb08060] },
      short: { name: 'ปีกสั้น', note: 'ปีกสั้นหนาเหมาะบินเตี้ย ร่างหนักบึก เกราะหิน', add: ['wings:stub'], drop: ['wings:feather'], scale: 0.96, accent: [0x8a8a90, 0xd9a030] },
      sky: { name: 'ชาวน้ำฟ้า', note: 'ปีกฟ้าอ่อนเหมือนครีบ ผ้าพลิ้วสีฟ้า', accent: [0x8ac8f0, 0xe0f4ff], add: ['droplets'] },
    },
  },
  giant: {
    id: 'giant', name: 'ยักษ์', motif: 'ตัวใหญ่ที่สุด ผิวหยาบเหมือนหิน มีรอยร้าวและมอสตามไหล่ ผ้าหยาบมัดกับแผ่นหินเป็นเสื้อ ผู้เฝ้าบันไดหมื่นขั้น เคลื่อนช้า หนัก ทุกก้าวสะเทือน ถือหินหรือไม้ท่อนใหญ่',
    scale: 1.3, head: 0.92, wide: 1.4, skins: [0xa09a90, 0x8a8a84, 0xb0a498, 0x9a8a78], hairs: [0x4a4a4a, 0x6a5a4a, 0xc0c0c0, 0x2a2a2a], eyes: [0xd0a030, 0x2a5a8a],
    accent: [0x6a8a4a, 0x7a7a7a, 0xd9a030], ears: 'round', lower: 'legs', gait: 'stomp', feats: ['stone', 'moss', 'heavybrow'], idle: IDLE_STANDARD, bearded: 0.6,
    lines: {
      cyclops: { name: 'ไซคลอปส์', note: 'ตาเดียวกลางหน้าผาก', add: ['cyclops'] },
      jotun: { name: 'จอตุน', note: 'ผิวฟ้าเทาเย็น เกล็ดน้ำแข็งที่เครา ขนสัตว์', skins: [0xa0b0c0, 0x90a0b4], outfit: 'fur', add: ['frost'] },
      smith: { name: 'ยักษ์ช่าง', note: 'ทั่งเหล็กเล็กที่ไหล่ ค้อนหินยักษ์ ผ้ากันเปื้อน', outfit: 'apron' },
      silent: { name: 'ยักษ์ผู้เงียบ', note: 'ปากถูกปิดด้วยแถบหินสลักคำสาบาน นั่งนิ่ง', add: ['sealband', 'stone'], scale: 1.36 },
    },
  },
  lavakin: {
    id: 'lavakin', name: 'เผ่าลาวา', motif: 'ผิวเหมือนหินภูเขาไฟสีดำคล้ำ มีรอยแตกเรืองส้มทองเหมือนลาวาไหลใต้ผิว ผมเป็นเปลวไฟหรือถ่านร้อน ประกายถ่านลอยจากไหล่ เสื้อผ้าสั้นทนความร้อน เกราะทองแดง เดินแล้วพื้นอุ่น',
    scale: 1.1, head: 1, wide: 1.1, skins: [0x3a2a2a, 0x4a2a2a, 0x2a2222, 0x5a3a30], hairs: [0xff8a2a, 0xffc040, 0xe04a1a], eyes: [0xffd040, 0xffa020],
    accent: [0xff6a1a, 0xffc040, 0xb04a1a], ears: 'point', lower: 'legs', gait: 'stomp', feats: ['cracks', 'embers', 'flamehair', 'glow-eyes'], idle: IDLE_STANDARD,
    lines: {
      emperor: { name: 'ราชวงศ์ลาวา', note: 'มงกุฎเหล็กร้อน รอยแตกสว่างทั้งตัว', add: ['crown', 'halo'], scale: 1.18 },
      deep: { name: 'ผู้หลบใต้ดิน', note: 'ผิวเทาหม่นเพราะไฟอ่อนลง รอยแตกริบหรี่', accent: [0xc04a1a, 0x8a3a1a] },
    },
  },
  construct: {
    id: 'construct', name: 'ลูกผสมจักรกล', motif: 'คนที่ถูกต่อชิ้นส่วนเหล็กเข้ากับร่าง แขนหรือขาหรือตาข้างหนึ่งเป็นกลไกทองเหลือง มีนอตและสายไฟ ไอน้ำออกจากข้อต่อ ครึ่งหนึ่งยังเป็นมนุษย์เสมอ ท่าทางระวังตัว',
    scale: 1.06, head: 1, wide: 1.08, skins: [0xe8b48a, 0xc98e62, 0xf0c8a0, 0xa06a42], accent: [0xc08a3a, 0x8a94a4, 0x6ad0ff], ears: 'round', lower: 'legs', gait: 'normal',
    feats: ['plates', 'rivets', 'steam', 'mecheye', 'mecharm'], idle: IDLE_STANDARD,
    lines: {
      installed: { name: 'ผู้ติดตั้ง', note: 'ต่อเองเพราะเลือกเอง เรียบร้อยสะอาด ทองเหลืองขัดเงา', accent: [0xd8b060, 0xe8e8f0] },
      doll: { name: 'ผู้รอดชีวิตตุ๊กตา', note: 'ผิวเหมือนกระเบื้องเซรามิก มีเส้นประกอบ ตากลมแก้ว ผมประดิษฐ์', skins: [0xf6ece0, 0xe8e0d8], add: ['seams', 'glasseye'], drop: ['mecharm'] },
      neon: { name: 'ลูกผสมนีออน', note: 'แถบนีออนสีชมพูฟ้าเรืองตามตัว เสื้อแจ็กเก็ตสะท้อนแสง', accent: [0xff4ad0, 0x4ae8ff], add: ['neon'] },
      chosen: { name: 'ผู้เลือกเอง', note: 'ส่วนที่เป็นเหล็กแกะสลักลาย ภูมิใจโชว์', add: ['engraved'], accent: [0xe0c060, 0x6a4aa0] },
    },
  },
  soulmachine: {
    id: 'soulmachine', name: 'หุ่นวิญญาณ', motif: 'หุ่นที่ตื่นขึ้นพร้อมคำถาม ตัวเป็นข้อต่อทองเหลืองหรือเหล็กขาว มีแก้วเรืองแสงเป็นแกนวิญญาณกลางอก ดวงตาเป็นไฟสองจุด ไม่มีผม มีเสาอากาศหรือฟันเฟืองเหนือหัว ท่าทางเรียนรู้ทุกอย่าง เอียงคอบ่อย',
    scale: 1.08, head: 0.98, wide: 1, skins: [0xc08a3a, 0xa8b0bc, 0xe8e4dc, 0x7a8294, 0xb06a3a], eyes: [0x6ad0ff, 0xffd040, 0x8affc0],
    accent: [0x6ad0ff, 0xffd040, 0xff8aa0], ears: 'none', lower: 'legs', gait: 'normal', feats: ['plates', 'rivets', 'core', 'visor', 'hairless', 'seams', 'steam'], idle: IDLE_STANDARD, hairless: true,
    lines: {
      brass: { name: 'ทองเหลือง', note: 'รุ่นแรกจากโรงซ่อม ขัดเงาน้อย มีรอยสึก', skins: [0xc08a3a, 0xb07a30] },
      white: { name: 'เหล็กขาว', note: 'รุ่นใหม่ผิวเรียบ ไฟสีฟ้า', skins: [0xe8e4dc, 0xd8dce4], accent: [0x6ad0ff] },
      escaped: { name: 'ผู้หนีนาย', note: 'ตราหมายเลขของเจ้านายถูกขูดทิ้ง ผ้าห่มขาด', add: ['scrapedmark'], skins: [0x7a8294, 0x8a8a94] },
      senior: { name: 'หุ่นเก่า', note: 'สนิมและมอสบนข้อต่อ แสงแกนริบหรี่', add: ['rust'], accent: [0xffb040] },
    },
  },
  mummy: {
    id: 'mummy', name: 'มัมมี่', motif: 'ผ้าลินินพันตัวเป็นชั้น ปลายผ้าห้อยลู่ ผิวแห้งสีทรายระหว่างผ้า ปลอกคอทองอัสคห์ เครื่องหมายอายตา ตาเรืองเขียวหรือทองในเงามืด ธุลีทิพย์โรยจากปลายผ้า เดินเนิบช้าสง่า',
    scale: 1.03, head: 0.98, wide: 0.96, skins: [0xc8a878, 0xb89868, 0xd8b888, 0xa88858], eyes: [0x6aff9a, 0xffd040, 0x6ad0ff], accent: [0xe8c050, 0x2a6aa0, 0xd8d0b0],
    ears: 'round', lower: 'legs', gait: 'shamble', feats: ['wraps', 'usekh', 'kohl', 'dust', 'glow-eyes'], idle: IDLE_STANDARD,
    lines: {
      pharaoh: { name: 'ฟาโรห์', note: 'ผ้าคลุมศีรษะลายทาง (เนมส์) หนวดปลอมทอง อัญมณีเต็มอก', add: ['nemes', 'goldbeard'], scale: 1.1 },
      servant: { name: 'ผู้รับใช้', note: 'ผ้าพันสะอาดพื้น ๆ ถือโถบรรจุธุลี', add: ['canopic'] },
      dried: { name: 'มัมมี่แห้ง', note: 'ผ้าพันเก่าขาดวิ่น ผิวเป็นผงทราย ตาริบหรี่', accent: [0xc8b898], add: ['crumble'] },
    },
  },
  ghoul: {
    id: 'ghoul', name: 'กูล', motif: 'ผอมเหมือนโครงกระดูกหุ้มหนังเทาเขียว ตาลึกซีด เล็บยาวแหลม หลังโค้ง แขนยาวเกือบถึงเข่า เศษธงและเกราะทหารที่ขาดวิ่นยังติดตัว ปากขยับเคี้ยวตลอด ทุกตัวจำชื่อตัวเองได้',
    scale: 1.0, head: 0.98, wide: 0.86, skins: [0x8a9a8a, 0x7a8a7a, 0x9aa89a, 0x6a7a6a], hairs: [0x2a2a2a, 0x4a4a4a, 0xc0c0c0, 0x3a3030], eyes: [0xd0d0b0, 0xe0e040, 0xd04a4a],
    accent: [0x6a2a2a, 0x4a4a3a, 0xa09a80], ears: 'point', lower: 'legs', gait: 'shamble', feats: ['gaunt', 'claws', 'ribs', 'hunger', 'sunkeneyes'], idle: IDLE_STANDARD,
    lines: {
      banner: { name: 'ธงหิว', note: 'เศษธงสีแดงเก่าผูกไหล่ เกราะขาด', add: ['bannerscrap'] },
      elder: { name: 'กูลชรา', note: 'หลังค่อมมาก ผมบาง ผ้าห่มมอซอ', add: ['hunched'], accent: [0xa09a80] },
      refuser: { name: 'ผู้ปฏิเสธความหิว', note: 'เสื้อผ้าสะอาดกว่า มีขนมปังในมือเสมอ ตายังมีประกายอ่อน', add: ['bread'], drop: ['claws'], skins: [0xa0aca0, 0x98a498] },
    },
  },
};

/** races the older systems may still hand over under other names */
const ALIAS: Record<string, string> = { avian: 'winged', ogre: 'giant', lava: 'lavakin', golem: 'soulmachine', cyborg: 'construct', undead: 'ghoul' };
export const themeOf = (race: string): RaceTheme => THEMES[race] || THEMES[ALIAS[race]] || THEMES.human;
export const RACE_IDS = Object.keys(THEMES);

/** stage of life by human-equivalent age (docs/storylines/README.md §2: 0-3 infant, 4-12 child, 13-19 teen, 20-54 adult, 55+ elder) */
export type Stage = 'infant' | 'child' | 'teen' | 'adult' | 'elder';
export const STAGES: Stage[] = ['infant', 'child', 'teen', 'adult', 'elder'];
export const STAGE_NAME: Record<Stage, string> = { infant: 'ทารก', child: 'เด็ก', teen: 'วัยรุ่น', adult: 'ผู้ใหญ่', elder: 'ผู้เฒ่า' };
export const STAGE_AGE: Record<Stage, number> = { infant: 1, child: 8, teen: 16, adult: 35, elder: 68 };
export function stageOf(hAge: number): Stage {
  return hAge < 4 ? 'infant' : hAge < 13 ? 'child' : hAge < 20 ? 'teen' : hAge < 55 ? 'adult' : 'elder';
}
