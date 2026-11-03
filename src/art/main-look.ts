// The Look of the main character, drawn from the life (code-plan §9.2 row "ตัวละครหลัก"): the birth certificate first (race, blood, home, class, job)
// and then what the life changed (the weapon in the hand, the marks that show, the years). Pure and deterministic: no DOM, no chance, the same life
// gives the same figure, so Node tests and the screens agree. `src/core` may not import this file; it reads the core's data and the life only.
//
//   race, sub-line    life.race, life.blood (`sub_<race>_<n>` = the n-th line of the race in 02-races.md; `a+b` = a half-blood: the body of the first
//                     race with the ears of the second)               → raceLook (resolve.ts)
//   build             life.gender (n = no sex: the neutral build, not fem)
//   life stage        life.hAge → stageOf (02-races.md: 0–3 · 4–12 · 13–19 · 20–54 · 55+); a curse or blessing that changes the face moves the age shown
//   clothes           the job (job-looks.ts), colours = the `สีชุด` of the job's weapon set (10-job-weapons.md); the class raises or lowers them
//   hand              the weapon in the hand (life.ext.items.wield, else the first weapon in life.items), else the job's tool; none for an infant or
//                     a child (docs/systems/items/README.md §4: a child uses only everyday things), none for a class-1 or bound life
//   marks that show   see MARKS below, each with the line of the data or the doc that says it shows
import type { LooksData } from '../core/data/types-looks';
import type { Weapon, WeaponsData } from '../core/data/types-items';
import type { GameData } from '../core/game';
import { items } from '../core/text/labels';
import type { LifeState } from '../core/types';
import { RULER_JOBS, JOB_LOOKS } from './job-looks';
import { stageOf, type PersonLook, type Stage } from './look';
import { TOOLS } from './parts';
import { hash, raceLook } from './resolve';

// ---------- what shows ----------

/**
 * The curses and blessings that change what a person looks like, with the painter feat each draws. The data's own line says it shows
 * (data/gen/curses.json and blessings.json `desc`, from docs/_generated/character-catalog); the appearance docs name no list, so a gift whose line says
 * nothing of the body (a luck, a sense, a debt) draws nothing.
 */
export const MARKS: Record<string, { feat: string; why: string }> = {
  c_stoneskin: { feat: 'stone', why: 'ผิวกลายเป็นหิน · "ผิวแข็งขึ้นทุกปี"' },
  c_oneeye: { feat: 'eyepatch', why: 'ตาบอดข้างหนึ่ง' },
  c_ugly: { feat: 'scar', why: 'หน้าตาน่ากลัว · "เด็กเห็นแล้วร้องไห้"' },
  c_wither: { feat: 'gaunt', why: 'ร่างเหี่ยวเฉา · "ชีวิตถูกดูดออกไปทีละนิด"' },
  c_evileye: { feat: 'redeyes', why: 'ตาปีศาจ' },
  c_demoneye: { feat: 'redeyes', why: 'สายตาของราชาปีศาจ' },
  c_demonmark: { feat: 'tattoo', why: 'ตราปีศาจ · a mark on the skin' },
  nc_seal_scar: { feat: 'scar', why: 'แผลผนึก' },
  nc_exile_scar: { feat: 'scar', why: 'แผลผู้พลัดถิ่น' },
  nc_cult_mark: { feat: 'tattoo', why: 'ตราลัทธิหมายหัว' },
  b_wings: { feat: 'wings:feather', why: 'ปีกแห่งเทพ · "งอกปีกขนนกสีขาว"' },
  b_dragonscale: { feat: 'scales', why: 'เกล็ดมังกร · "ผิวงอกเกล็ดแข็ง"' },
  b_saintmark: { feat: 'halo', why: 'ตรานักบุญ · "ตราเรืองแสงกลางหน้าผาก"' },
  b_angel: { feat: 'halo', why: 'ทูตสวรรค์พิทักษ์' },
};
/** A limp walks dragging a foot (`shuffle`, ลากเท้า) . */
const GAIT_CURSES: ReadonlySet<string> = new Set(['c_limp', 'c_cripple']);
/** Years the face is older with `c_fastaging` ("อายุยี่สิบหน้าเหมือนห้าสิบ") and the age `b_youth` keeps it at ("หน้าไม่แก่ไปตามวัย"). */
export const FAST_AGING_YEARS = 30;
export const YOUTH_FACE_MAX = 35;
const GROWN = 18;

// ---------- the indexes of the data ----------

interface Index {
  looks: LooksData;
  /** sub-line id of the character data (`sub_winged_5`) → the name of the line in the looks (02-races.md), when the looks have it */
  lines: Map<string, string>;
  /** job id → [main, second] of the weapon set of the job */
  colors: Map<string, [string, string]>;
  weapons: Map<string, Weapon>;
}
const cache = new WeakMap<GameData, Index | null>();

function indexOf(data: GameData): Index | null {
  if (cache.has(data)) return cache.get(data) ?? null;
  const looks = items<LooksData>(data, 'looks');
  const w = items<WeaponsData>(data, 'weapons');
  const lines = new Map<string, string>();
  for (const r of items<{ races: { id: string; sublines?: { id: string; name: string }[] }[] }>(data, 'races')?.races ?? [])
    for (const sub of r.sublines ?? []) {
      // the docs write 'หมาป่า' where the character data writes 'เผ่าหมาป่า'
      const hit = looks?.races[r.id]?.lines.find((l) => l.name === sub.name || `เผ่า${l.name}` === sub.name);
      if (hit) lines.set(sub.id, hit.name);
    }
  const ix: Index | null = looks
    ? {
        looks,
        lines,
        colors: new Map((w?.jobSets ?? []).filter((s) => s.ui.colors.length >= 2).map((s) => [s.job, [s.ui.colors[0], s.ui.colors[1]] as [string, string]])),
        weapons: new Map((w?.items ?? []).map((x) => [x.id, x])),
      }
    : null;
  cache.set(data, ix);
  return ix;
}

// ---------- colours ----------

const rgb = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number): string => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const GOLD = '#c8a030';
/** The dark jewel colours of the noble (poc-visuals/README.md "ขุนนางสีอัญมณีเข้มกับทอง"). */
const JEWELS = ['#3a2a5a', '#1a3a4a', '#5a1a2a', '#2a4a3a', '#4a2a1a'] as const;
const DRAB = '#6a5a48';
const DRAB2 = '#4a4034';

// ---------- the parts ----------

const HUMANISH = new Set(['human', 'halfling']);
/** Outfits that are dressing up: a low class does not wear them, and a high class keeps them. */
const DRESSY = new Set(['noble', 'regal', 'priest', 'scholar', 'knight']);
/** Outfits a high class does not trade for the noble cut (a soldier's armour, a priest's robe, a mage's gown stay what they are, with gold trim). */
const STAYS = new Set([...DRESSY, 'armor', 'plate', 'robe', 'cape', 'regal']);
/** Plain workwear: the rich buy a cape or a noble coat over it. */
const PLAIN = new Set(['tunic', 'light', 'apron', 'miner', 'leather', 'cloak', 'sailor', 'fur', 'dress', 'rags', 'sarong']);

const FEM_HAIR = ['long', 'braid', 'bun', 'ponytail', 'tied'] as const;
const MALE_HAIR = ['short', 'cropped', 'curly', 'wild', 'short'] as const;
const NATURAL_HAIR = ['#3a2a20', '#241a14', '#5a3a22', '#7a5a30', '#1a1614'] as const;

const known = (id: string): string => (id && TOOLS[id] ? id : '');

/** The tool a weapon is drawn as: the type of the weapons table (README §2) refined by the words of the name; a type the painter has no tool for draws nothing. */
export function toolOfWeapon(name: string, type: string): string {
  const has = (re: RegExp) => re.test(name);
  switch (type) {
    case 'ดาบ':
      return known(has(/ใหญ่|สองมือ|ยักษ์|หนัก/) ? 'greatsword' : 'sword');
    case 'ขวาน':
      return known('axe');
    case 'หอก':
      return known(has(/สามง่าม|ฉมวก|ง่ามคู่/) ? 'trident' : has(/ธง/) ? 'banner' : has(/ไม้กวาด/) ? 'broom' : 'spear');
    case 'ธนู':
      return known('bow');
    case 'มีดสั้น':
      return known('dagger');
    case 'ค้อน':
      return known(has(/พลั่ว|เสียม/) ? 'shovel' : has(/อีเต้อ/) ? 'pickaxe' : has(/หนังสือ|ตำรา|ดัชนี/) ? 'book' : has(/โคม|ตะเกียง/) ? 'lantern' : has(/ไม้เท้า|พลอง/) ? 'staff' : has(/ลูกตุ้ม|หัวเหล็ก|หนาม/) ? 'mace' : has(/กระบอง/) ? 'club' : 'hammer');
    case 'เวท':
      return known(has(/ลูกแก้ว/) ? 'orbstaff' : has(/ตำรา|สัญญา/) ? 'book' : has(/พิณ|ขลุ่ย/) ? 'lute' : has(/ไม้เท้า|คทา/) ? 'staff' : 'wand');
    case 'โล่':
      return known('shield');
    case 'ปืน':
      return known(has(/ไรเฟิล|ยาว|ซุ่ม/) ? 'rifle' : has(/คาบศิลา|มัสเก็ต|ใหญ่/) ? 'musket' : 'pistol');
    case 'แส้':
      return known('whip');
    case 'หนังสติ๊ก':
      return known('sling');
    case 'มวย':
      return known('knuckles');
    default:
      return '';
  }
}

/** The weapon in the hand of the life: the one it wields, else the first weapon of its bag (everyday things, `wi_`, do not count: a stick is not a trade). */
export function heldWeapon(life: LifeState, weapons: ReadonlyMap<string, Weapon>): Weapon | undefined {
  const wield = (life.ext.items as { wield?: string } | undefined)?.wield;
  const w = wield && life.items.includes(wield) ? weapons.get(wield) : undefined;
  if (w) return w;
  for (const id of life.items) {
    const x = weapons.get(id);
    if (x && x.group !== 'everyday') return x;
  }
  return undefined;
}

const classOf = (life: LifeState): number => Number(/\d/.exec(life.cls ?? '')?.[0]) || 3;
const bondLevel = (life: LifeState): number => (life.ext.bondage as { level?: number } | undefined)?.level ?? 0;

export interface MainLookOpts {
  /** The life carries a scar from a fight (the wound `scar` of a lost fight is only in the log: the caller reads it). */
  scarred?: boolean;
  /** Draw another age than the life's (the portrait of the dead, a younger self). */
  hAge?: number;
}

export interface MainLookInfo {
  look: PersonLook;
  /** The shown marks and the line of the data that says each shows (for the characters page and the tests). */
  marks: string[];
}

/** The age the face shows: a curse or a blessing may move it. */
export function shownAge(life: LifeState, hAge = life.hAge): number {
  let a = hAge;
  if (life.curses.includes('c_fastaging') && a >= GROWN) a += FAST_AGING_YEARS;
  if (life.blessings.includes('b_youth') && a > YOUTH_FACE_MAX) a = YOUTH_FACE_MAX;
  return a;
}

/**
 * The sub-line of `life.blood` (`sub_<race>_<n>`, by name: the character data and the looks do not number the lines alike for every race) and the
 * second race of a half-blood (`a+b`).
 */
export function bloodOf(data: GameData, life: LifeState): { line?: string; second?: string } {
  const ix = indexOf(data);
  const b = life.blood ?? '';
  if (!ix) return {};
  if (b.includes('+')) {
    const second = b.split('+')[1];
    return ix.looks.races[second] ? { second } : {};
  }
  const line = ix.lines.get(b);
  return line ? { line } : {};
}

export function mainLookInfo(life: LifeState, data: GameData, opts: MainLookOpts = {}): MainLookInfo {
  const ix = indexOf(data);
  if (!ix) throw new Error('main-look: no looks in the data');
  const { looks } = ix;
  const seed = `${life.id}:${life.name}`;
  const n = classOf(life);
  const bound = bondLevel(life) > 0;
  const stage: Stage = stageOf(shownAge(life, opts.hAge ?? life.hAge));
  const fem = life.gender === 'f';
  const { line, second } = bloodOf(data, life);
  const base = raceLook(looks, life.race, { line, stage, fem, seed });
  const young = stage === 'infant' || stage === 'child';
  const grown = stage === 'adult' || stage === 'elder';

  // ---- the clothes: the job's cut, the class's cloth
  const job = life.job ? JOB_LOOKS[life.job] : undefined;
  let outfit = job?.outfit ?? 'tunic';
  let hat = job?.hat ?? '';
  if (life.blood === 'sub_human_7' && !life.job) outfit = 'otherworld'; // the summoned arrive in the clothes of the other world (02-races.md human line 7)
  const poor = n <= 1 || bound;
  if (young) outfit = poor ? 'rags' : 'tunic'; // a child wears a plain shirt (poc-visuals/README.md "เด็ก")
  else if (poor) outfit = 'rags';
  else if (n === 2 && (outfit === 'noble' || outfit === 'regal')) outfit = 'tunic';
  else if (n === 2 && (outfit === 'priest' || outfit === 'scholar' || outfit === 'knight') && !life.job) outfit = 'tunic';
  else if (n >= 5 && RULER_JOBS.has(life.job ?? '') && (outfit === 'noble' || outfit === 'cape' || PLAIN.has(outfit))) outfit = 'regal';
  else if (n >= 5 && !STAYS.has(outfit)) outfit = 'noble';
  else if (n === 4 && (outfit === 'tunic' || outfit === 'light' || outfit === 'rags')) outfit = 'cape';
  if (fem && !young && n >= 3 && (outfit === 'tunic' || outfit === 'light')) outfit = 'dress';
  if (young || poor) hat = '';
  else if (n >= 5 && !hat && grown) hat = 'circlet';

  // ---- the colours: the job set's two colours, the race's tint on a race that dresses its own, the class's cloth
  const jc = ix.colors.get(life.job ?? '');
  let main = jc ? jc[0] : base.main;
  let sec = jc ? jc[1] : base.second;
  if (!HUMANISH.has(life.race)) {
    main = mix(main, base.main, 0.45);
    sec = mix(sec, base.accent, 0.4);
  }
  if (poor) { main = mix(main, DRAB, 0.75); sec = mix(sec, DRAB2, 0.7); }
  else if (n >= 5) { main = JEWELS[hash(seed) % JEWELS.length]; sec = GOLD; }
  else if (n === 4) sec = mix(sec, GOLD, 0.6);
  if (young && !poor) { main = mix(main, '#8a7a62', 0.5); sec = mix(sec, '#6a5a48', 0.5); }

  // ---- the hand
  let tool = '';
  if ((grown || stage === 'teen') && !poor) {
    const w = heldWeapon(life, ix.weapons);
    tool = w ? toolOfWeapon(w.name, w.type) : known(job?.tool ?? '');
    if (!tool && !w && stage === 'elder') tool = known('cane'); // the old lean on a stick (poc-visuals/README.md "ผู้เฒ่า")
  }

  // ---- hair and beard
  const natural = HUMANISH.has(life.race) || life.race === 'beast' || life.race === 'dwarf';
  const hairless = base.feats.includes('hairless');
  let hair = base.hair;
  if (!hairless) {
    const pool = fem ? FEM_HAIR : MALE_HAIR;
    hair = young ? (fem ? 'ponytail' : 'short') : pool[hash(`${seed}:hair`) % pool.length];
    if (job?.hair && grown) hair = job.hair;
    if (life.curses.includes('c_bald')) hair = 'bald'; // หัวล้านตั้งแต่เด็ก
  }
  let hairColor = base.hairColor;
  if (natural && stage !== 'elder' && !base.feats.includes('flamehair')) hairColor = NATURAL_HAIR[hash(`${seed}:color`) % NATURAL_HAIR.length];
  // a human's hair goes grey at 45 (02-races.md §1 "วัยและเพศ: ผมหงอกที่ 45"), a face made old by a curse with it
  if (life.race === 'human' && stage !== 'elder' && shownAge(life, opts.hAge ?? life.hAge) >= 45) hairColor = mix(hairColor, '#c8c8cc', 0.55);
  let beard = '';
  if (!fem && life.gender === 'm' && !hairless && grown) {
    const b = hash(`${seed}:beard`) % 5;
    if (life.race === 'dwarf') beard = 'braided';
    else if (stage === 'elder') beard = (['short', 'long', 'braided', 'short', ''] as const)[b];
    else beard = (['stubble', 'short', 'moustache', '', ''] as const)[b];
  }

  // ---- ears of the second race of a half-blood
  const body = { ...base.body };
  if (second) {
    const r2 = looks.races[second];
    if (r2 && r2.body.ears !== 'round') body.ears = r2.body.ears;
  }
  if (!young && life.curses.some((c) => GAIT_CURSES.has(c))) body.gait = 'shuffle';

  // ---- the marks that show
  const feats = [...base.feats];
  const marks: string[] = [];
  for (const id of [...life.curses, ...life.blessings]) {
    const m = MARKS[id];
    if (!m || young) continue;
    if (!feats.includes(m.feat)) feats.push(m.feat);
    marks.push(`${id}: ${m.why}`);
  }
  if (opts.scarred && !young && !feats.includes('scar')) { feats.push('scar'); marks.push('scar: แผลเป็นถาวรจากศึก (combat/wound)'); }

  // ---- wear: the class, the years
  const wearBase = poor ? 0.9 : ({ 1: 0.9, 2: 0.5, 3: 0.25, 4: 0.1, 5: 0 } as Record<number, number>)[n] ?? 0.25;
  const wear = Math.min(1, wearBase + (stage === 'elder' ? 0.15 : 0));

  const look: PersonLook = {
    ...base, key: `main:${seed}`, stage, fem, body, main, second: sec, outfit, hat, hair, hairColor, beard, tool, feats, wear,
  };
  return { look, marks };
}

/** The Look of the main character (see the head of this file). */
export function mainLook(life: LifeState, data: GameData, opts: MainLookOpts = {}): PersonLook {
  return mainLookInfo(life, data, opts).look;
}
