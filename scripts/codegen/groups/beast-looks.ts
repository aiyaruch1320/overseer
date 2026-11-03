// Beast-looks generator (M6 beasts): the Look of each of the 200 enemies (docs/appearance/04-enemies.md, column ค่า UI) and of the 15 legendary
// dragons (docs/appearance/03-dragons.md, table ค่า UI) as the painters of src/art/beast read it. Writes data/gen/beast-looks.json.
// Nothing is guessed from chance: every field is a value of the row, a word of the row mapped to a painter feature, or (for the few non-human
// bodies that no kind word names) the form table below, which says `guess` in the `planBy` field.
import type {
  AtkKind, BeastLooksData, BeastPlan, DieKind, DragonLook, EnemyLook, MountKind, PersonParts, SizeClass,
} from '../../../src/core/data/types-beast-looks';
import { FEAT_IDS, HAIR_IDS, HAT_IDS, OUTFIT_IDS, TOOL_IDS } from '../../../src/art/parts/ids';
import { finish, Unparsed } from '../helpers-m0b';
import { rel, tables, writeGen } from '../lib/table';
import type { Table } from '../lib/table';

const E = 'docs/appearance/04-enemies.md';
const D = 'docs/appearance/03-dragons.md';
const GEN = 'scripts/codegen/groups/beast-looks.ts';
const un = new Unparsed('beast-looks');

const strip = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const HEX = /#[0-9a-fA-F]{6}/;

// ── the form table: the non-human bodies, by id ─────────────────────────────────────────────────────────────────────────────────────
// [plan, form, extra feature words]. A row not here is a person (humanoid) unless its kinds say otherwise (KIND_PLAN).
type Form = [BeastPlan, string, string[]?];
const FORMS: Record<string, Form> = {
  // ก. the 32 monsters of the code
  wolf: ['quadruped', 'wolf'], slime: ['amorphous', 'slime'], troll: ['giant', 'troll'], skeleton: ['skeleton', 'skeleton'], lich: ['skeleton', 'lich'],
  wyvern: ['dragon', 'wyvern'], firedragon: ['dragon', 'fire'], icedragon: ['dragon', 'ice'], sandworm: ['serpent', 'sandworm'], scorpion: ['insect', 'scorpion'],
  yeti: ['giant', 'ape'], siren: ['sea', 'siren'], kraken: ['sea', 'kraken'], firedemon: ['giant', 'fiend'], ent: ['plant', 'ent'], griffon: ['flyer', 'griffon'],
  hydra: ['serpent', 'hydra'], golem: ['construct', 'golem'], krasue: ['spirit', 'krasue'], pop: ['spirit', 'pop'], mimic: ['construct', 'mimic'], ogre: ['giant', 'ogre'],
  harpy: ['flyer', 'harpy'], manticore: ['quadruped', 'manticore'], wraith: ['spirit', 'wraith'], demongeneral: ['giant', 'demon'], kappa: ['humanoid', 'kappa'],
  werewolf: ['humanoid', 'wolfman'],
  // ข. the 40 monsters tied to the world
  storm_harpy: ['flyer', 'storm'], cloud_serpent: ['serpent', 'cloud'], sky_debris_golem: ['construct', 'debris'], ash_wolf_pack: ['quadruped', 'ashwolf'],
  ghost_legion: ['spirit', 'legion'], crown_wraith: ['spirit', 'crown'], lava_slime: ['amorphous', 'lava'], magma_salamander: ['quadruped', 'salamander'],
  rune_guardian: ['construct', 'guardian'], hellmouth_imps: ['humanoid', 'imp'], ash_drake: ['dragon', 'ashdrake'], reef_serpent: ['serpent', 'reef'],
  abyss_lurker: ['sea', 'angler'], glow_mutant: ['giant', 'mutant'], dream_eater: ['spirit', 'dream'], locust_swarm: ['swarm', 'locust'], war_automaton: ['construct', 'automaton'],
  rust_swarm: ['swarm', 'rats'], reactor_wraith: ['elemental', 'reactor'], mirage_phantom: ['spirit', 'mirage'], dust_djinn: ['elemental', 'djinn'],
  blighted_ent: ['plant', 'blight'], shadow_pack: ['quadruped', 'shadowwolf'], fog_tentacle: ['serpent', 'tentacle'], fog_moth_swarm: ['swarm', 'moth'],
  fog_weaver: ['insect', 'spider'], flesh_flyer: ['flyer', 'flesh'], bell_wraith: ['spirit', 'bell'], titan_shard: ['giant', 'titan'], scale_wyrmling: ['dragon', 'wyrmling'],
  // ง. named fighters that are not a person
  'NR11-2': ['sea', 'kraken', ['temple']], 'NR07-1': ['serpent', 'naga', ['eggs']], 'NR07-2': ['serpent', 'naga'], 'NR04-3': ['sea', 'deepbeast', ['glow']],
  'KD07-1': ['dragon', 'coil'], 'SH03-1': ['giant', 'stone', ['sit']], 'SH03-2': ['giant', 'stone', ['sit']], 'SH03-4': ['giant', 'stone', ['sit']],
  'SH06-4': ['giant', 'stone', ['sit']], 'SH17-1': ['giant', 'stone', ['sit']], 'MH01-1': ['giant', 'orc'], 'MH02-1': ['giant', 'demon'], 'SH11-1': ['giant', 'orc'],
  'SV03-3': ['giant', 'bear'], 'MH12-1': ['humanoid', 'ghost'], 'SV13-2': ['humanoid', 'ghost'], 'MH12-2': ['humanoid', 'ghost'], 'NB08-2': ['humanoid', 'ghost'], 'MH03-1': ['giant', 'ghoul'], 'MK02-1': ['giant', 'brass'], 'SV14-1': ['giant', 'brute'], 'KD08-1': ['giant', 'brute'],
  // จ. the six world bosses
  awakened_titan: ['giant', 'titan'], hellgate_lord: ['elemental', 'gate'], lich_king: ['skeleton', 'lichking'], rift_speaker: ['spirit', 'rift'],
  primordial_engine: ['construct', 'engine'], leviathan: ['sea', 'leviathan'],
};

/** The plan a kind word alone gives (first kind word wins; `บิน` on a row without a kind gives a flyer). */
const KIND_PLAN: Record<string, BeastPlan> = {
  humanoid: 'humanoid', beast: 'quadruped', amorphous: 'amorphous', undead: 'skeleton', construct: 'construct', giant: 'giant', dragon: 'dragon', plant: 'plant',
  elemental: 'elemental', spirit: 'spirit', fog: 'spirit', sea: 'sea', demon: 'giant', fey: 'humanoid',
};
const KIND_WORDS = new Set([...Object.keys(KIND_PLAN), 'regen', 'บิน', 'ฝูง']);

// ── words of a row → painter features ───────────────────────────────────────────────────────────────────────────────────────────────
const FEATURE_WORDS: [string, RegExp][] = [
  ['club', /กระบอง|ท่อนไม้|ไม้ตะปู/], ['axe', /ขวาน/], ['sword', /ดาบ/], ['spear', /หอก|ง้าว|ส้อม/], ['bow', /ธนู/], ['staff', /ไม้เท้า|คทา/], ['hammer', /ค้อน/],
  ['dagger', /มีด/], ['gun', /ปืน/], ['shield', /โล่/], ['horns', /เขา(?!ว)|เขาร้าว/], ['crown', /มงกุฎ/], ['cape', /ผ้าคลุม|เสื้อคลุม/], ['hood', /ฮู้ด/], ['flag', /ธง/],
  ['wings', /ปีก/], ['fangs', /เขี้ยว/], ['tusks', /งา(?!ม)/], ['fire', /ไฟ|เปลว|ลาวา|ถ่านร้อน/], ['ice', /น้ำแข็ง|หิมะ/], ['water', /น้ำ|คลื่น|ฟอง/], ['smoke', /ควัน|ไอ|เถ้า/],
  ['moss', /มอส/], ['mushrooms', /เห็ด|สปอร์/], ['runes', /รูน/], ['gears', /เฟือง/], ['chain', /โซ่/], ['lantern', /โคม|ตะเกียง/], ['book', /คัมภีร์|สมุด/], ['throne', /บัลลังก์/],
  ['tentacles', /หนวด/], ['tail', /หาง/], ['eggs', /ไข่/], ['horse', /บนม้า/], ['bandage', /ผ้าพัน/], ['armor', /เกราะ/], ['sand', /ทราย/], ['coral', /ปะการัง/],
];

/** The mount of a rider: the words of the name cell, the description or the idle pose that put a person on an animal. */
const MOUNT_WORDS: [RegExp, MountKind][] = [[/ขี่ม้า|บนม้า|ม้าศึก/, 'horse'], [/นั่งบนหมาป่า|ขี่หมาป่า/, 'wolf'], [/ขี่หนอน|ผู้ขี่หนอน/, 'worm']];
const mountOf = (text: string): MountKind | null => { for (const [re, m] of MOUNT_WORDS) if (re.test(text)) return m; return null; };

// ── vocabulary of the parts of a person ─────────────────────────────────────────────────────────────────────────────────────────────
const pick = <T extends string>(set: readonly T[], id: string): T | '' => (set as readonly string[]).includes(id) ? (id as T) : '';
const SKINS = ['#e8b48a', '#d9a47a', '#c98e62', '#b87a52', '#f0c8a0'];
const HAIRS = ['#3a2a20', '#2a2420', '#5a3a24', '#7a5a34', '#8a8a86', '#b89050'];
const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

const SKIN_WORDS: [RegExp, string][] = [
  [/ผิวเขียว|ผิวสีเขียว/, '#7a9a4a'], [/ผิวซีด|ผิวขาวซีด|ผิวขาว/, '#e0d6d0'], [/ผิวม่วง/, '#8a7a9a'], [/ผิวส้มแดง|ผิวสีแดง/, '#c8502a'],
  [/ผิวเทา|ผิวสีเทา/, '#8a8e96'], [/ผิวคล้ำ|ผิวดำ|ผิวสีเข้ม/, '#6a4a38'],
];

function personParts(id: string, kinds: string[], form: string, text: string, atk: string, main: string, second: string): PersonParts {
  const first = (re: RegExp): boolean => re.test(atk) || re.test(text);
  // the tool is the weapon the row names for the attack first, then any it names
  const toolOrder: [string, RegExp][] = [
    ['bow', /ธนู/], ['gun', /ปืน/], ['greatsword', /ดาบใหญ่|ดาบหนัก/], ['sword', /ดาบ/], ['spear', /หอก|ง้าว|ตรีศูล|ส้อม/], ['axe', /ขวาน/], ['hammer', /ค้อน/], ['club', /กระบอง|ท่อนไม้|ไม้ตี/],
    ['dagger', /มีด|เข็ม/], ['staff', /ไม้เท้า|คทา/], ['book', /คัมภีร์|สมุด/], ['lantern', /โคม|ตะเกียง/], ['banner', /ธง/],
  ];
  let tool = '';
  for (const [t, re] of toolOrder) if (re.test(atk)) { tool = t; break; }
  if (!tool) for (const [t, re] of toolOrder) if (re.test(text)) { tool = t; break; }
  const hat = /ฮู้ด|ผ้าคลุมหน้า/.test(text) ? 'hood' : /มงกุฎ/.test(text) ? 'crown' : /หมวกเหล็ก|หมวกเกราะ/.test(text) ? 'helmet' : /หมวกปีก|หมวกกัปตัน/.test(text) ? 'wide' : /หมวก/.test(text) ? 'cap' : /ผ้าโพก/.test(text) ? 'turban' : '';
  const outfit = /หนังสัตว์|ขนสัตว์/.test(text) ? 'fur' : /เกราะ/.test(text) ? 'armor' : /เสื้อคลุมยาว|ชุดนักบวช|ชุดยาว|จีวร/.test(text) ? 'robe' : /ผ้าคลุม|เสื้อคลุม|ฮู้ด/.test(text) ? 'cape' : 'tunic';
  const beard = /เครา/.test(text) ? 'short' : '';
  let skin = SKINS[hash(id) % SKINS.length];
  for (const [re, c] of SKIN_WORDS) if (re.test(text)) { skin = c; break; }
  if (kinds.includes('undead') && !SKIN_WORDS.some(([re]) => re.test(text))) skin = '#9aa08c';
  if (form === 'wolfman') skin = '#7a6448';
  const hair = /หัวโล้น|ศีรษะล้าน|ล้านเตียน/.test(text) ? 'bald' : /ผมยาว|ผมสีเงินปล่อยยาว/.test(text) ? 'long' : pick(HAIR_IDS, 'short') as string;
  const goblin = /หูยาว/.test(text) && /เตี้ย/.test(text);
  const ears = goblin ? 'long' : /หูแหลม/.test(text) || /ออร์ค|ผิวเขียว/.test(text) ? 'pointed' : form === 'wolfman' ? 'animal' : 'round';
  const feats: string[] = [];
  if (/งา(?!ม)|เขี้ยวเหนือปาก/.test(text) && /ออร์ค/.test(text)) feats.push('tusks');
  if (/แผลเป็น|รอยแผล/.test(text)) feats.push('scar');
  if (/ผ้าพัน/.test(text) && kinds.includes('undead')) feats.push('bandage');
  void first;
  return {
    skin, hairColor: HAIRS[hash(id + 'h') % HAIRS.length], hair,
    hat: pick(HAT_IDS, hat), beard: pick(['short', 'long', 'braided', 'stubble', 'moustache'] as const, beard), outfit: pick(OUTFIT_IDS, outfit) || 'tunic',
    tool: pick(TOOL_IDS, tool), ears: ears as PersonParts['ears'],
    feats: feats.filter((f) => (FEAT_IDS as readonly string[]).includes(f)),
  };
  void main; void second;
}

// ── poses: the words of idle / atk / die → the motion kinds ────────────────────────────────────────────────────────────────────────
function atkKindOf(t: string): AtkKind {
  if (/พ่น|ยิง|ปล่อย|สาด|ร้อง|เป่า|ลำแสง|ส่งเสียง|สั่ง|ชี้|เรียก|ขว้าง/.test(t)) return 'spit';
  if (/พัน|หนวด|กอด|เหวี่ยง|กวาด|ตวัด|ฟาดหาง|แส้|โซ่|ม้วน/.test(t)) return 'lash';
  if (/พุ่ง|กระโจน|ร่อน|ตะครุบ|กัด|จิก|ตะปบ|เคลื่อนฉับพลัน|ปรากฏ|ก้าว|กรู|ข่วน|ทะลุ/.test(t)) return 'lunge';
  return 'slam';
}
function dieKindOf(t: string): DieKind | null {
  if (/ไม่ตาย/.test(t)) return 'sag';
  if (/จม/.test(t)) return 'sink';
  if (/ละลายเป็น(ไอ|หมอก|ควัน)/.test(t)) return 'dissolve';
  if (/แตกเป็นน้ำ|ละลาย|ซึม|เมือก|น้ำเหนียว/.test(t)) return 'melt';
  if (/ถ่านร้อน|ควันแดง|ระเบิด|หดเป็นดวงไฟ/.test(t)) return 'burst';
  if (/ไอ|หมอก|ควัน|ผง|เถ้า|จาง|สลาย|ระเหย|หายไป|หายเข้า|ฟอง|อากาศร้อน/.test(t)) return 'dissolve';
  if (/กระดูก|ทรุด.*กอง|ร่วงเป็นกอง|พัง|ซาก|แตกเป็น|เศษ|ยุบ|หินร่วง|เป็นกองใหญ่|ผ้าตกลงกอง/.test(t)) return 'crumble';
  return null;
}
const DIE_PLAN: Partial<Record<BeastPlan, DieKind>> = { amorphous: 'melt', skeleton: 'crumble', construct: 'crumble', spirit: 'dissolve', swarm: 'dissolve', elemental: 'burst' };

// ── the table rows ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
interface Raw { id: string; nameCell: string; desc: string; ui: string; group: EnemyLook['group']; line: number; table: Table }

function parseEnemy(r: Raw): EnemyLook {
  const { id, ui } = r;
  const seg = strip(r.nameCell).split(' · ');
  const name = seg[0];
  const tier = (r.group === 'code' || r.group === 'world' ? seg[2] : seg[1]) ?? '';
  const kindWords = r.group === 'code' || r.group === 'world' ? (seg[1] ?? '').split(/\s+/).filter((w) => KIND_WORDS.has(w)) : r.group === 'boss' ? [] : ['humanoid'];
  const kinds = kindWords.filter((w) => w !== 'ฝูง' && w !== 'บิน');
  const flying = kindWords.includes('บิน');
  const sizeM = ui.match(/ขนาด\s+(XXL|XL|L|M|S)\b/);
  if (!sizeM) throw new Error(`beast-looks: no size in ${id}`);
  const size = sizeM[1] as SizeClass;
  const paren = ui.match(/ขนาด\s+(?:XXL|XL|L|M|S)\s*\(([^)]*)\)/)?.[1] ?? '';
  const sc = paren.match(/(\d+(?:\.\d+)?)\s*×/);
  const scale = sc ? Number(sc[1]) : null;
  const scaleNote = paren.replace(/(\d+(?:\.\d+)?)\s*×/, '').trim();
  const sw = ui.match(/(?:ฝูง|ชุด)\s*(\d+)[–-](\d+)/);
  const cloud = /ฝูงเดียว|ฝูงเมฆ|กลุ่มเมฆ/.test(ui);
  const colors = ui.match(/สี\s+(#[0-9a-fA-F]{6})\s+(#[0-9a-fA-F]{6})/);
  if (!colors) throw new Error(`beast-looks: no colours in ${id}`);
  // named third colours: `ตา #x` `แกน #x` …; `ธง 5 สี (#a #b …)` is a list
  const named: { label: string; hex: string }[] = [];
  for (const m of ui.matchAll(/(?:^|\s)((?!สี\b)[฀-๿]+)\s+(#[0-9a-fA-F]{6})(?!\s*#)/g)) named.push({ label: m[1], hex: m[2].toLowerCase() });
  const flagM = ui.match(/ธง\s*\d+\s*สี\s*\(([^)]*)\)/);
  if (flagM) for (const h of flagM[1].match(/#[0-9a-fA-F]{6}/g) ?? []) named.push({ label: 'ธง', hex: h.toLowerCase() });
  const eyeC = named.find((n) => n.label === 'ตา') ?? named.find((n) => n.label !== 'ธง');
  const poses = ui.match(/ท่า\s*idle=(.*?)\s+atk=(.*?)\s+die=(.*?)(?:\s+·\s+|$)/);
  if (!poses) throw new Error(`beast-looks: no poses in ${id}`);
  const text = strip(r.desc + ' ' + ui);
  const atk = poses[2], die = poses[3];
  const kindPlan: BeastPlan | undefined = flying && !kinds.length ? 'flyer' : (KIND_PLAN[kinds[0]] ?? undefined);
  const f = FORMS[id];
  let plan: BeastPlan, form: string, words: string[] = [];
  let planBy: EnemyLook['planBy'];
  if (f) {
    [plan, form] = f;
    words = [...(f[2] ?? [])];
    planBy = kindPlan === plan ? 'kind' : kinds.length || flying ? 'words' : 'guess';
    if (r.group === 'named' || r.group === 'boss') planBy = 'guess';
  } else {
    plan = 'humanoid'; form = 'person';
    planBy = kinds.length === 0 && r.group === 'boss' ? 'guess' : 'kind';
  }
  // a humanoid taller than a person fits in a frame (1.5×) is drawn as a big body, not a person
  if (plan === 'humanoid' && form === 'person' && scale !== null && scale > 1.5) { plan = 'giant'; form = 'brute'; planBy = 'words'; }
  for (const [w, re] of FEATURE_WORDS) if (re.test(text) && !words.includes(w)) words.push(w);
  if (flying && !words.includes('flying')) words.push('flying');
  const parts = plan === 'humanoid' && (form === 'person' || form === 'wolfman' || form === 'ghost') ? personParts(id, kinds, form, text, atk, colors[1], colors[2]) : null;
  const dk = dieKindOf(die) ?? DIE_PLAN[plan] ?? 'topple';
  return {
    kind: 'enemy', id, name, group: r.group, tier, kinds, size, scale, scaleNote, swarm: sw ? [Number(sw[1]), Number(sw[2])] : null, cloud,
    main: colors[1].toLowerCase(), second: colors[2].toLowerCase(), eye: (eyeC?.hex ?? '#1e1a22').toLowerCase(), eyeLabel: eyeC?.label ?? 'ตา', eyeGiven: !!eyeC,
    extra: named.filter((n) => n !== eyeC), plan, form, planBy,
    poses: { idle: poses[1].trim(), atk: atk.trim(), die: die.trim() }, atkKind: atkKindOf(atk), dieKind: dk, words, parts,
    mount: plan === 'humanoid' && form === 'person' ? mountOf(`${r.nameCell} ${r.desc} ${poses[1]}`) : null,
  };
}

function enemies(): EnemyLook[] {
  const out: EnemyLook[] = [];
  const groupOf = (t: Table): EnemyLook['group'] | null => {
    const h = t.headings.join(' ');
    if (t.header[0] === 'ID' && /ก\. มอนสเตอร์/.test(h)) return 'code';
    if (t.header[0] === 'ID' && /ข\. มอนสเตอร์/.test(h)) return 'world';
    if (t.header[0] === 'ID' && /ค\. NPC/.test(h)) return 'npc';
    if (t.header[0] === 'NPC') return 'named';
    if (t.header[0] === 'ID' && /จ\. บอส/.test(h)) return 'boss';
    return null;
  };
  for (const t of tables(E)) {
    const g = groupOf(t);
    if (!g) continue;
    for (const row of t.rows) {
      const c = row.cells;
      if (c.length !== 4) throw new Error(`beast-looks: ${t.file}:${row.line} has ${c.length} cells, not 4`);
      out.push(parseEnemy({ id: c[0], nameCell: c[1], desc: c[2], ui: c[3], group: g, line: row.line, table: t }));
    }
  }
  const ids = new Set<string>();
  for (const e of out) { if (ids.has(e.id)) throw new Error('beast-looks: duplicate id ' + e.id); ids.add(e.id); }
  return out;
}

// ── dragons ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The body shape of each dragon (by its number in the table): what the painter draws first. */
const DRAGON_FORM: Record<number, [string, string[]]> = {
  1: ['serpent', ['wings', 'cloudwings', 'chipped']], 2: ['stout', ['flames']], 3: ['eel', ['water']], 4: ['slender', ['wings', 'silkwings']],
  5: ['turtle', ['moss', 'rock']], 6: ['twohead', ['wings', 'twotone']], 7: ['round', ['soft', 'cloud']], 8: ['skeletal', ['wings', 'ribs', 'fangs']],
  9: ['lava', ['seams', 'shut']], 10: ['serpent', ['translucent', 'manyeyes']], 11: ['sleeper', ['shut', 'grass', 'whiskers']],
  12: ['slender', ['pipes', 'oil']], 13: ['rock', ['swallowed']], 14: ['coil', ['roots', 'moss']], 15: ['mist', ['translucent', 'wingless']],
};

function dragons(): DragonLook[] {
  const t = tables(D).find((x) => x.header[0] === '#' && x.header.includes('สีตา'));
  if (!t) throw new Error('beast-looks: dragon table not found');
  const out: DragonLook[] = [];
  for (const row of t.rows) {
    const c = row.cells;
    if (c.length !== 9) throw new Error(`beast-looks: ${t.file}:${row.line} has ${c.length} cells, not 9`);
    const n = Number(c[0]);
    const hexes = (s: string) => (s.match(/#[0-9a-fA-F]{6}/g) ?? []).map((h) => h.toLowerCase());
    const [m1, m2] = hexes(c[4]), [s1, s2] = hexes(c[5]), [e1, e2] = hexes(c[6]);
    if (!m1 || !s1 || !e1) throw new Error(`beast-looks: colours missing in dragon ${n}`);
    const size = c[2].trim() as DragonLook['size'];
    if (!['M', 'L', 'XL'].includes(size)) throw new Error(`beast-looks: dragon ${n} has size ${size}`);
    const [form, words] = DRAGON_FORM[n] ?? ['stout', []];
    out.push({
      kind: 'dragon', id: `dragon_${String(n).padStart(2, '0')}`, n, name: strip(c[1]), size, shape: strip(c[3]), form, main: m1, second: s1, eye: e1,
      eyeShut: /ปิด/.test(c[6]), alt: m2 && s2 && e2 ? { main: m2, second: s2, eye: e2 } : null, effect: strip(c[7]), ambient: strip(c[8]), words,
    });
  }
  return out;
}

export default function run() {
  const data: BeastLooksData = { enemies: enemies(), dragons: dragons(), counts: { enemies: 0, dragons: 0 } };
  data.counts = { enemies: data.enemies.length, dragons: data.dragons.length };
  writeGen('beast-looks', data, [E, D], GEN);
  void rel;
  return finish('beast-looks', ['beast-looks.json'], un);
}
