// The view models of the start screen (docs/systems/character/19-wish.md, 20-wish-synonyms.md, docs/systems/experience/04-start-modes.md,
// docs/appearance/20-god-ui.md §10 §11, docs/systems/god/08-goals.md §2 §5). Pure: (data, draft) -> what the screen draws.
//
// The wish is read by the core (src/core/character/wish.ts, over data/gen/synonyms.json and wish.json) and applied at birth (`BirthOpts.wish`): this module is the
// view of it, the draft, the modes, the sheet of birth checked against the life it makes, and the launch.
import { extOf, readWish, type FatePoints, type Row, type SheetItem, type WishRead } from '../../core/character';
import { rhythms } from '../../core/god/goals';
import { peekLife } from '../../core/god/goals/state';
import { modeOf, MODES, collectionView } from '../../core/ending';
import { versions, type GameData } from '../../core/game';
import { newGame } from '../../core/state';
import { command } from '../../core/command';
import { lines } from '../../core/text';
import { placeName, raceName } from '../../core/text/pick';
import type { Command, GameState, LifeState } from '../../core/types';
import { createSession, startLife, type Session, type SessionOpts } from '../../../scripts/tools/session';
import type { GameStore } from '../store';

// ---------- the words of the screen (the sheet and the buttons the documents name) ----------

/** Chrome of the start screen, each from the document named. The sheet's parts come from wish.json `sheet` (see `sheetParts`). */
export const START_LABELS = {
  prompt: 'อยากให้ชีวิตนี้เป็นอย่างไร', // 20-god-ui.md §11 "ช่องคำขอ"
  placeholder: 'เช่น อยากเป็นเด็กกำพร้าเผ่าสัตว์ที่โตมาในเมืองมนุษย์ แล้วอยากให้ชีวิตได้เดินทางไกล', // 19-wish.md opening
  modes: 'แบบเริ่มต้น', // 04-start-modes.md
  random: 'สุ่มทั้งหมด', // 20-god-ui.md §11 "ปุ่มสุ่มทั้งหมด"
  start: 'เริ่มชีวิต', // 20-god-ui.md §11 "ปุ่ม"
  edit: 'แก้ใบคำขอ',
  reroll: 'สุ่มส่วนที่ยังสุ่มใหม่',
  sheet: 'ใบเกิด', // 20-god-ui.md §11 "ใบเกิด"
  fate: 'แต้มชะตา', // 19-wish.md §4
  rhythm: 'จังหวะชะตา', // 08-goals.md §5
  vow: 'คำปฏิญาณ', // 08-goals.md §2
  noVow: 'ไม่ปฏิญาณ', // 20-god-ui.md §10 "แผ่นที่สี่"
  pickByHand: 'เลือกเอง', // 19-wish.md §3 "หน้าเลือกเอง"
  locked: 'ยังไม่เปิด', // 04-start-modes.md "กติกา"
  pending: 'ยังไม่ผูกกับแกน', // the core does not apply this field yet
  chosen: 'เลือกแล้ว',
  maxLen: 'ไม่เกิน',
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

export interface ModeView {
  id: string;
  name: string;
  open: boolean;
  chosen: boolean;
}

/** The modes of 04-start-modes.md with the rule of the collection: `state` is the save whose collection is read (null: a world not yet begun, so only the modes that open from the start). */
export function startModes(data: GameData, state: GameState | null, chosen: string | null): ModeView[] {
  const s = state ?? newGame(1, versions(data));
  const view = collectionView(s, data);
  return view.modes.map((m) => ({ id: m.id, name: m.name, open: m.open && !(m.id === 'heir' && !state), chosen: m.id === chosen }));
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

const sendVow = (s: Session, args: Record<string, unknown>) => command(s.game.ctx, { type: 'god', action: 'vow.pick' as Extract<Command, { type: 'god' }>['action'], args, confirm: false });

/** The sheet of birth: the request checked against the life that would be born, the vows on the stones, the cups of fate. */
export function certificate(data: GameData, draft: StartDraft, read: WishRead = readWish(data, draft)): Certificate {
  const opts = sessionOpts(read, draft.seed);
  const { session, life } = scratchLife(data, opts, JSON.stringify([draft.seed, read.ask]));
  const ctx = session.game.ctx;
  const state = session.game.state;
  const story = lines(data, state.log, 1)
    .map((l) => l.text)
    .filter((t, i, all) => i >= all.length - 4);
  const mode = modeOf(state, life);
  const modeName = MODES.find((m) => m.id === mode)?.name ?? mode;
  const born = { name: life.name, race: life.race, raceName: raceName(ctx, life.race), home: life.country, homeName: placeName(ctx, life.country) ?? life.country, gender: life.gender, mode, modeName };

  // the request against the life: what the birth refused, with its reason (kept in the sheet of the life), and a check of the fixed rows against the life that stands
  const refusedByBirth = extOf(life).wish?.born?.refused ?? [];
  const GENDER_OF: Record<string, string> = { ชาย: 'm', หญิง: 'f' };
  const items = read.items.map((it) => {
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

  const peek = peekLife(life);
  const vows: VowView[] = peek.offers.map((id, i) => {
    const r = sendVow(session, { pick: i + 1 });
    const p = r.ok ? r.preview : undefined;
    return { n: i + 1, id, name: String(p?.name ?? id), done: String(p?.done ?? ''), reward: (p?.reward as VowView['reward']) ?? null };
  });
  vows.push({ n: vows.length + 1, id: null, name: START_LABELS.noVow, done: '', reward: null });

  const rh = rhythms(ctx).map((r) => ({ ...r, chosen: r.id === draft.rhythm }));
  const modeHeld = !read.mode || read.mode === mode || read.mode === 'plain';
  return { story, born, items, points: read.points, vows, rhythms: rh, modeHeld };
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
  if (draft.vow !== null) {
    const r = store.god('vow.pick', { pick: draft.vow }, true);
    if (!r.ok) return { ok: false, reason: r.reason };
  }
  return { ok: true };
}
