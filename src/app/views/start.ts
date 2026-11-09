// The view models of the start screen (docs/systems/character/19-wish.md, 20-wish-synonyms.md, docs/systems/experience/04-start-modes.md,
// docs/appearance/20-god-ui.md §10 §11, docs/systems/god/08-goals.md §2 §5). Pure: (data, draft) -> what the screen draws.
//
// The wish is read by the core (src/core/character/wish.ts, over data/gen/synonyms.json and wish.json) and applied at birth (`BirthOpts.wish`): this module is the
// view of it, the draft, the modes, the sheet of birth checked against the life it makes, and the launch.
import { extOf, readWish, type FatePoints, type Row, type SheetItem, type WishRead } from '../../core/character';
import { mainLook } from '../../art/main-look';
import type { PersonLook } from '../../art/look';
import { rhythms, table, vowName, vowRow } from '../../core/god/goals';
import { peekLife } from '../../core/god/goals/state';
import { modeOf, MODES, collectionView } from '../../core/ending';
import { versions, type Ctx, type GameData } from '../../core/game';
import { newGame } from '../../core/state';
import { placeName, raceName } from '../../core/text/pick';
import type { GameState, LifeState } from '../../core/types';
import { createSession, startLife, type Session, type SessionOpts } from '../../../scripts/tools/session';
import type { GameStore } from '../store';
import { playerWords } from './player-words';

// ---------- the words of the screen (the sheet and the buttons the documents name) ----------

/** Chrome of the start screen, each from the document named. The sheet's parts come from wish.json `sheet` (see `sheetParts`). */
export const START_LABELS = {
  prompt: 'อยากให้ชีวิตนี้เป็นอย่างไร', // 20-god-ui.md §11 "ช่องคำขอ"
  placeholder: 'เช่น อยากเป็นเด็กกำพร้าเผ่าสัตว์ที่โตมาในเมืองมนุษย์ แล้วอยากให้ชีวิตได้เดินทางไกล', // 19-wish.md opening
  modes: 'แบบเริ่มต้น', // 04-start-modes.md
  mode: 'แบบเริ่มต้น',
  random: 'สุ่มทั้งหมด', // 20-god-ui.md §11 "ปุ่มสุ่มทั้งหมด"
  start: 'เริ่มชีวิต', // 20-god-ui.md §11 "ปุ่ม"
  edit: 'แก้ใบคำขอ',
  reroll: 'สุ่มส่วนที่ยังสุ่มใหม่',
  sheet: 'ใบเกิด', // 20-god-ui.md §11 "ใบเกิด"
  fate: 'แต้มชะตา', // 19-wish.md §4
  /** A harder life gives points back (19-wish.md §4: an orphan, a curse): said in words, never as "-2/10", which reads as an error. */
  fateGiven: (back: number, total: number) => `แต้มชะตา: ชีวิตที่ยากคืนให้ ${back} (ใช้ 0/${total})`,
  fateOver: (n: number) => `แต้มชะตา: เกินงบ ${n}`,
  rhythm: 'จังหวะชะตา', // 08-goals.md §5
  vow: 'คำปฏิญาณ', // 08-goals.md §2
  vowFirst: 'เลือกคำปฏิญาณของชีวิตนี้',
  vowChange: 'เปลี่ยนคำปฏิญาณได้ครั้งเดียว',
  vowFirstNote: 'เลือกได้จนถึงอายุ 15 ปี คำปฏิญาณไม่ให้พลัง ไม่เปลี่ยนราคา และตัดสินตอนตัวละครตาย',
  vowChangeNote: 'ถ้าเปลี่ยนแล้วจะเปลี่ยนอีกไม่ได้',
  vowKeep: 'คงข้อเดิม',
  vowLater: 'ตัดสินใจทีหลัง',
  vowNow: 'ตอนนี้',
  vowClosed: 'ชีวิตนี้เริ่มเมื่อโตเกิน 15 ปีแล้ว จึงไม่มีคำปฏิญาณให้เลือก',
  vowReward: (kept: number, broken: number) => `แต้มพงศาวดารสายตระกูล +${kept} ถ้าสำเร็จ +${broken} ถ้าไม่`,
  noVow: 'ไม่ปฏิญาณ', // 20-god-ui.md §10 "แผ่นที่สี่"
  pickByHand: 'เลือกเอง', // 19-wish.md §3 "หน้าเลือกเอง"
  locked: 'ยังไม่เปิด', // 04-start-modes.md "กติกา"
  pending: 'ยังไม่ผูกกับแกน', // the core does not apply this field yet
  chosen: 'เลือกแล้ว',
  maxLen: 'ไม่เกิน',
  notUnderstood: 'ไม่เข้าใจ',
} as const;

/** The six tags of the box of the wish (20-god-ui.md §11): the name on the tag and the field of the synonym table it fills from. */
export const WISH_CHIPS: { label: string; field: string }[] = [
  { label: 'เผ่า', field: 'race' },
  { label: 'ถิ่น', field: 'continent' },
  { label: 'ฐานะ', field: 'class' },
  { label: 'นิสัย', field: 'trait' },
  { label: 'อาชีพ', field: 'job' },
  { label: 'โทนชีวิต', field: 'story' },
];

// ---------- the draft ----------

export interface StartDraft {
  /** The wish as typed. */
  text: string;
  /** The start mode chosen (an id of `MODES`) or null. */
  mode: string | null;
  /** The seed of the world; "reroll" draws a new one. */
  seed: number;
  /** The rhythm of fate (`natural` `gentle` `sorrow` `irony`). */
  rhythm: string;
  /** The vow taken: 1..N of the table, N + 1 for none, null while undecided. */
  vow: number | null;
  /** Choices made by hand on the page of choosing: field key → code ('' = random). They stand over what was understood. */
  picks: Record<string, string>;
}

export const emptyDraft = (seed = 1): StartDraft => ({ text: '', mode: null, seed, rhythm: 'natural', vow: null, picks: {} });

// ---------- the start modes ----------

/** The mood line of each start mode, as 04-start-modes.md gives it ("อารมณ์ที่ให้ผู้เล่น"), without the ids of its nodes. */
export const MODE_MOOD: Record<string, string> = {
  summoned: 'มาจากต่างโลกตอนอายุ 16 ไม่มีครอบครัวในโลกนี้ อาจได้ความถนัดพิเศษหนึ่งอย่าง และอาจถูกหักหลัง',
  reincarnated: 'จำชีวิตที่แล้วได้บางส่วน ความทรงจำที่ไม่รู้ว่าเป็นของใคร',
  slime: 'เริ่มจากไม่มีอะไร กลืนความสามารถและสร้างชุมชน',
  soulmachine: 'ถูกสร้างเป็นเครื่องมือ แล้วถามว่า "ข้ามาจากอะไร"',
  demonkin: 'เชื้อสายปีศาจที่ต้องใช้ชีวิตในโลกมนุษย์',
  ghoul: 'กูลที่ต้องสู้กับความหิวของตัวเอง',
  elf: 'เอลฟ์ที่เห็นเพื่อนมนุษย์แก่และตาย',
  orc: 'ออร์คที่ถูกเลี้ยงเป็นนักสู้ แล้วกลับสู่เผ่า',
  dragonkin: 'เด็กเผ่ามังกรที่อาจได้ไวเวิร์นน้อยและไปพิธีผู้ขี่ ได้สัตว์และทางสู่ผู้ขี่ตามโอกาสของเส้นเรื่อง ไม่ได้แน่นอน',
  halfblood: 'ลูกครึ่งที่อยู่ระหว่างสองเผ่า ไม่ใช่ที่ไหนทั้งคู่',
  plain: 'ชีวิตสามัญของคนที่ราคาขนมปังกำหนดอนาคต ทำนา เย็บผ้า ค้าขาย',
  heir: 'เริ่มจากทายาทของชีวิตก่อนหน้า',
};

export interface ModeView {
  id: string;
  name: string;
  /** The mood the mode gives the player (04-start-modes.md). */
  mood: string;
  open: boolean;
  chosen: boolean;
}

/** The modes of 04-start-modes.md with the rule of the collection: `state` is the save whose collection is read (null: a world not yet begun, so only the modes that open from the start). */
export function startModes(data: GameData, state: GameState | null, chosen: string | null): ModeView[] {
  const s = state ?? newGame(1, versions(data));
  const view = collectionView(s, data);
  return view.modes.map((m) => ({ id: m.id, name: m.name, mood: MODE_MOOD[m.id] ?? '', open: m.open && !(m.id === 'heir' && !state), chosen: m.id === chosen }));
}

// ---------- the synonym parser (in the core: 19-wish.md §6 "a save replays the wish") ----------

export { readWish, normalize, fieldLabel, chipValues, handFields, sheetParts, HAND_FIELDS } from '../../core/character/wish';
export type { Segment, Row, SheetItem, Understood, FatePoints, WishRead, WishKind, WishAsk, WishSheet } from '../../core/character/wish';

// ---------- the request -> the options of the birth ----------

/**
 * The options the bridge takes (`store.newLife`): the race and the country for the start rule of the world, and the sheet of the wish, which the session hands to the
 * birth of the character system (`BirthOpts.wish`) and which the world start reads for the era. The core applies the sheet; this module only passes it.
 */
export function sessionOpts(read: WishRead, seed: number): SessionOpts {
  const a = read.ask;
  const opts: SessionOpts = { seed };
  if (a.race) opts.race = a.race;
  if (a.country) opts.country = a.country;
  if (Object.keys(a).length || read.mode) opts.wish = read.sheet;
  return opts;
}

// ---------- the sheet of birth ----------

export interface VowView {
  n: number;
  id: string | null;
  name: string;
  /** "สำเร็จเมื่อ" (08-goals.md §2 table). */
  done: string;
  /** The chronicle points a kept vow and a broken one give. */
  reward: { kept: number; broken: number } | null;
}

export interface RhythmView {
  id: string;
  name: string;
  effect: string;
  open: boolean;
  chosen: boolean;
}

export interface Certificate {
  /** The lines of the birth the text system tells (who, family, the traits that show, the question): the "คำบรรยาย". */
  story: string[];
  /** What the scratch life is, to check the request against (the screen shows it as the verdict of each sure row). */
  born: { name: string; race: string; raceName: string; home: string; homeName: string; gender: string; mode: string; modeName: string };
  /** The rows of the sheet with the requests the birth did not honour moved to `cannot`. */
  items: SheetItem[];
  points: FatePoints;
  vows: VowView[];
  rhythms: RhythmView[];
  /** Can the vow be taken now? A life that begins past the age of 15 (the summoned one, 16) has no vow to choose. */
  vowOpen: boolean;
  /** Did the first life of this world get the mode asked for? */
  modeHeld: boolean;
}

interface Scratch {
  session: Session;
  life: LifeState;
}

const scratches = new Map<string, Scratch>();

/** A copy of the world with the life that would be born: same seed, same options, so the same life as `store.newLife` (the bridge builds it the same way). */
export function scratchLife(data: GameData, opts: SessionOpts, key: string): Scratch {
  const hit = scratches.get(key);
  if (hit) return hit;
  const session = createSession(data, opts);
  const life = startLife(session);
  if (scratches.size > 8) scratches.delete(scratches.keys().next().value as string);
  const out = { session, life };
  scratches.set(key, out);
  return out;
}


/** The Look of the child the sheet would bear (the scratch life, drawn at its birth age): the portrait on the sheet. Null where the data holds no looks. */
export function bornLookOf(data: GameData, draft: StartDraft, read: WishRead = readWish(data, draft)): PersonLook | null {
  const opts = sessionOpts(read, draft.seed);
  const { life } = scratchLife(data, opts, JSON.stringify([draft.seed, read.ask]));
  return data.looks ? mainLook(life, data) : null;
}

/** The reason of a row of what cannot be done, in a player's words. */
function noteOf(data: GameData, it: SheetItem): string {
  if (it.negated) return `ไม่ใช้ค่านี้ เกมสุ่ม${it.field || 'ช่อง'}ต่อจากค่าที่เหลือ`;
  const text = playerWords(data, it.note);
  return it.key === 'impossible' && text ? `ที่ใกล้ที่สุด: ${text}` : text;
}

/**
 * The few words at the top of the sheet. It speaks only of the rows that are granted (sure and lean): the family, the class, the sign of the birth that the scratch
 * life drew are still random until the life starts, and a blurb that told them would say the opposite of the rows below it (M5 review S5).
 */
export function blurb(name: string, items: SheetItem[], mode: string | null): string[] {
  const granted = items.filter((i) => (i.row === 'sure' || i.row === 'lean') && i.value);
  // the values of one field are told together: "นิสัย ขี้ขลาด ใจบุญ"
  const by = new Map<string, string[]>();
  for (const i of granted) by.set(i.field, [...(by.get(i.field) ?? []), i.value]);
  const told = [...by].map(([field, values]) => (field && !values.some((v) => v.includes(field)) ? `${field} ${values.join(' ')}` : values.join(' ')));
  const out = [told.length ? `${name} · ${told.join(' · ')}` : `${name} · ยังไม่มีอะไรถูกกำหนด ที่เหลือทั้งหมดขึ้นกับชะตา`];
  if (mode && MODE_MOOD[mode] && items.some((i) => i.key === 'startMode' && i.row === 'sure')) out.push(MODE_MOOD[mode]);
  return out;
}

/** The sheet of birth: the request checked against the life that would be born, the vows on the stones, the cups of fate. */
export function certificate(data: GameData, draft: StartDraft, read: WishRead = readWish(data, draft)): Certificate {
  const opts = sessionOpts(read, draft.seed);
  const { session, life } = scratchLife(data, opts, JSON.stringify([draft.seed, read.ask]));
  const ctx = session.game.ctx;
  const state = session.game.state;
  const mode = modeOf(state, life);
  const bornMode = MODES.find((m) => m.id === mode)?.name ?? mode;
  const born = { name: life.name, race: life.race, raceName: raceName(ctx, life.race), home: life.country, homeName: placeName(ctx, life.country) ?? life.country, gender: life.gender, mode, modeName: bornMode };

  // the request against the life: what the birth refused, with its reason (kept in the sheet of the life), and a check of the fixed rows against the life that stands
  const refusedByBirth = extOf(life).wish?.born?.refused ?? [];
  const GENDER_OF: Record<string, string> = { ชาย: 'm', หญิง: 'f' };
  const checked = read.items.map((it) => {
    if (it.row === 'cannot' || it.row === 'random') return it;
    const why = refusedByBirth.find((r) => r.key === it.key);
    if (why) return { ...it, row: 'cannot' as Row, note: why.reason, pending: false };
    if (it.row !== 'sure' || it.pending) return it;
    const ok =
      (it.key === 'race' && life.race === it.code) ||
      (it.key === 'specialBirth' && (it.value === 'ตุ๊กตา' ? life.race === 'construct' : mode === (it.value === 'ผู้กลับชาติ' ? 'reincarnated' : 'summoned'))) ||
      (it.key === 'half' && life.flags.includes('half')) ||
      (it.key === 'gender' && (GENDER_OF[it.value] ? life.gender === GENDER_OF[it.value] : it.value === 'ไร้เพศ' ? extOf(life).neuter : true)) ||
      (it.key === 'continent' && life.country.startsWith(it.code)) ||
      (it.key === 'country' && life.country === it.code) ||
      !['race', 'specialBirth', 'half', 'gender', 'continent', 'country'].includes(it.key);
    return ok ? it : { ...it, row: 'cannot' as Row, note: `${born.raceName} ${born.homeName}`, pending: false };
  });
  const modeHeld = !read.mode || read.mode === mode || read.mode === 'plain';

  // what the chosen mode fixes (04-start-modes.md "แบบเริ่มต้นเป็นคำขอแบบหนึ่งที่ตั้งไว้แล้ว"): the mode itself and its race, so the sheet says what is certain
  const askedMode = MODES.find((m) => m.id === read.mode)?.name ?? '';
  const fixed: SheetItem[] = [];
  if (read.mode && askedMode) {
    const row: Row = modeHeld ? 'sure' : 'cannot';
    const plain = (key: string, field: string, value: string, code: string, note = ''): SheetItem => ({ row, field, key, value, code, note, points: 0, pending: false, at: -1 });
    fixed.push(plain('startMode', START_LABELS.mode, askedMode, read.mode, modeHeld ? '' : `ชีวิตนี้ได้แบบ ${born.modeName} แทน`));
    const raceAsk = read.ask.race;
    if (raceAsk && read.mode !== 'halfblood' && !checked.some((i) => i.key === 'race' && i.row !== 'random')) fixed.push(plain('race', 'เผ่า', raceName(ctx, raceAsk), raceAsk));
  }
  // the lines of the reasons are in a player's words: the table of the documents is written for the writer (M5 review S5)
  const items = [
    ...fixed.filter((i) => i.row === 'sure'),
    ...checked.map((it) => (it.row === 'cannot' ? { ...it, note: noteOf(data, it) } : it)),
    ...fixed.filter((i) => i.row === 'cannot'),
  ];
  const story = blurb(born.name, items, read.mode);
  // T3-2: what the parser took for nothing is told, so a part of the wish is never dropped in silence
  if (read.notUnderstood.length) story.push(`${START_LABELS.notUnderstood}: ${read.notUnderstood.join(' · ')}`);

  const peek = peekLife(life);
  const chron = (data.god?.items as { goals?: { chronicle?: { vowDone: number; vowFail: number } } } | undefined)?.goals?.chronicle;
  const vows: VowView[] = peek.offers.map((id, i) => ({
    n: i + 1,
    id,
    name: vowName(ctx, id, life.race),
    done: playerWords(data, vowRow(ctx, id)?.done ?? ''),
    reward: chron ? { kept: chron.vowDone, broken: chron.vowFail } : null,
  }));
  vows.push({ n: vows.length + 1, id: null, name: START_LABELS.noVow, done: '', reward: null });

  const rh = rhythms(ctx).map((r) => ({ ...r, chosen: r.id === draft.rhythm }));
  return { story, born, items, points: read.points, vows, rhythms: rh, vowOpen: table(ctx, life).phase !== null, modeHeld };
}

// ---------- starting the life ----------

export interface Launched {
  ok: boolean;
  reason?: string;
}

/** Starts the life: `store.newLife` with the options of the request, then the rhythm of fate and the vow, confirmed before the first beat is run (the clock runs on the next frame). */
export function launch(store: GameStore, read: WishRead, draft: StartDraft): Launched {
  const opts = sessionOpts(read, draft.seed);
  store.newLife(opts);
  if (draft.rhythm && draft.rhythm !== 'natural') {
    const r = store.god('vow.pick', { rhythm: draft.rhythm }, true);
    if (!r.ok) return { ok: false, reason: r.reason };
  }
  // a life that begins past the age of 15 has no vow on the table: taking one would only be refused
  const life = store.game?.ctx.state.life;
  if (draft.vow !== null && life && table(store.game!.ctx, life).phase) {
    const r = store.god('vow.pick', { pick: draft.vow }, true);
    if (!r.ok) return { ok: false, reason: r.reason };
  }
  return { ok: true };
}

// ---------- the vow on the table of a living life (the choice at birth and the one change at 15: 08-goals.md §2) ----------

export interface VowChoiceView {
  life: string;
  phase: 'first' | 'change';
  /** The vow held now (at the change), or null. */
  current: string | null;
  vows: { n: number; id: string; name: string; done: string }[];
}

/** The vows the player can pick now, or null while no choice is open for the living life. */
export function vowChoiceView(ctx: Ctx): VowChoiceView | null {
  const life = ctx.state.life;
  if (!life || life.dead) return null;
  const t = table(ctx, life);
  if (!t.phase || !t.ids.length) return null;
  const mine = peekLife(life).vow;
  return {
    life: life.id,
    phase: t.phase,
    current: mine ? vowName(ctx, mine, life.race) : null,
    vows: t.ids.map((id, i) => ({ n: i + 1, id, name: vowName(ctx, id, life.race), done: playerWords(ctx.data, vowRow(ctx, id)?.done ?? '') })),
  };
}

/** The vow of the living life for the corner of the screen and the character screen (08-goals.md: "ข้อความเล็กข้อเดียว"), or null when there is none. */
export function vowLineOf(ctx: Ctx): { name: string; done: string } | null {
  const life = ctx.state.life;
  if (!life) return null;
  const id = peekLife(life).vow;
  if (!id || id === 'GV-20') return null;
  return { name: vowName(ctx, id, life.race), done: playerWords(ctx.data, vowRow(ctx, id)?.done ?? '') };
}
