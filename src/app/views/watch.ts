// View models of the watch screen (code-plan §8.2 rows "หน้าเฝ้ามอง" "การเรียก" "ตั้งค่า"): pure functions over (data, state).
// No game text is made here: lines come from src/core/text, the reason of a call from `callReason`, the words of the chrome from watch-words.ts.
import { LIFE_YEARS, isStop, liveCards } from '../../core/attention';
import { allCardsOn, canDo, type CanDo } from '../../core/command';
import { rulesOf } from '../../core/attention/tuning';
import type { AttentionData } from '../../core/data/types-attention';
import type { Ctx, GameData } from '../../core/game';
import { bandOf, type BeliefBand } from '../../core/god/belief';
import { POWER_CAP } from '../../core/god/tuning';
import { callReason, lines, plainName, type Line } from '../../core/text';
import { items } from '../../core/text/labels';
import { CARD_KINDS, type GameState, type GodAction, type LogEntry, type Settings } from '../../core/types';
import { W } from './god-words';
import { WATCH_WORDS } from './watch-words';
import { LOG_KEEP } from '../tuning';
import { clockOf, purseOf } from '../view';
import { CANDLE_MIN_FILL, GLOW_OPEN_YEARS, RECAP_MAX } from './watch-tuning';

// ---------- what the screen can ask the god screens to open ----------

export type GodKind = 'chest' | 'dream' | 'whisper' | 'prayer' | 'miracle' | 'decree' | 'chronicle';

/** The event of the watch screen: open this god screen with these arguments (another agent builds the god screens). */
export interface GodOpen {
  kind: GodKind;
  args: Record<string, unknown>;
}

export type Tone = 'light' | 'dread' | 'fate';

// ---------- reading the log ----------

/** The entry with the running number `n` (the log is in order of `n`). */
export function entryAt(state: GameState, n: number): LogEntry | undefined {
  const log = state.log;
  let lo = 0;
  let hi = log.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const x = log[mid].n;
    if (x === n) return log[mid];
    if (x < n) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}

/** The person of a crisis, as the bond system announced it (the reason of the call names them). */
function crisisOf(state: GameState): (n: number) => string | undefined {
  return (n) => {
    const c = entryAt(state, n);
    if (!c || c.sys !== 'bonds' || c.kind !== 'crisis') return undefined;
    const name = String(c.data.name ?? '');
    return name ? `${name}${c.data.line ? ` (${String(c.data.line)})` : ''}` : undefined;
  };
}

/** The name of the person a crisis entry announces (the target of the whisper its card opens), or undefined. */
function personOf(state: GameState, n: number): string | undefined {
  const c = entryAt(state, n);
  const name = c && (c.sys === 'bonds' || c.sys === 'bondage') ? String(c.data.name ?? '') : '';
  return name || undefined;
}

const ageOf = (e: LogEntry): number | null => (e.age === undefined ? null : e.age + (e.quarter ?? 0) / 4);

/** The running number where the life now on the stage begins (its birth entry); earlier entries belong to the world or to a lineage before. */
export function lifeStartN(state: GameState): number {
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (e.sys === 'character' && e.kind === 'birth') return e.n;
  }
  return 0;
}

const linesCache = new WeakMap<GameState, { data: GameData; n: number; all: Line[] }>();

/** Every line of level 1 and up, read once per change of the log. */
export function allLines(data: GameData, state: GameState): Line[] {
  const hit = linesCache.get(state);
  if (hit && hit.data === data && hit.n === state.logN) return hit.all;
  const all = lines(data, state.log, 1);
  linesCache.set(state, { data, n: state.logN, all });
  return all;
}

// ---------- the calls ----------

export type CardKind = 'prayer' | 'omen' | 'battle' | 'crisis' | 'majorOmen';

const CARD_TONE: Record<CardKind, Tone> = { prayer: 'light', omen: 'fate', battle: 'dread', crisis: 'dread', majorOmen: 'light' };

/** What the god can do about a call of this reason: the buttons that open the god screens (20-god-ui.md §2, 07-attention.md §1 rule 1). */
export function optionsOf(why: string, id?: string, who?: string): GodOpen[] {
  const at = id ? { id } : {};
  switch (why) {
    case 'age':
    case 'window':
      return [{ kind: 'chest', args: { why } }, { kind: 'dream', args: { why, ...at } }, { kind: 'whisper', args: { why } }];
    case 'nearDeath':
      return [{ kind: 'dream', args: { why } }];
    case 'prayer':
      return [{ kind: 'prayer', args: { ...at } }];
    case 'omen':
      return [{ kind: 'decree', args: { ...at } }];
    case 'majorOmen':
      return [{ kind: 'miracle', args: { ...at } }, { kind: 'decree', args: { ...at } }];
    case 'battle':
      return [{ kind: 'whisper', args: { why, ...at } }, { kind: 'dream', args: { why } }];
    case 'crisis':
      // the whisper opens on the hint of help with the person in crisis picked, as the allies layer does (M5 review round two R2)
      return [{ kind: 'whisper', args: { why, ...at, hint: W.whisper.helpHint, ...(who ? { target: who } : {}) } }, { kind: 'dream', args: { why, ...at } }];
    default:
      return [];
  }
}

export interface CardView {
  /** Running number of the call entry (or of the entry a folded card stands for). */
  n: number;
  kind: CardKind;
  id: string;
  /** The reason in words (`callReason`). */
  text: string;
  tone: Tone;
  /** Life years left before it runs out; null for a card folded into a stop (the clock is stopped). */
  left: number | null;
  /** Share of the ring that is still full, 0 to 1; 1 for a folded card. */
  frac: number;
  options: GodOpen[];
}

const isKind = (k: string): k is CardKind => k in CARD_TONE;

/** A live card (an `attention/call` of kind card) as the stack shows it. */
export function cardView(data: GameData, state: GameState, e: LogEntry): CardView | null {
  const why = String(e.data.why ?? '');
  if (!isKind(why)) return null;
  const now = clockNow(state);
  const until = typeof e.data.until === 'number' ? e.data.until : null;
  const total = rulesOf(data.attention?.items as AttentionData | undefined).deadlines[why];
  const left = until === null || now === null ? null : Math.max(0, until - now);
  const id = String(e.id ?? '').split(',')[0];
  return {
    n: e.n,
    kind: why,
    id,
    text: callReason(data, e, crisisOf(state), (n) => entryAt(state, n)),
    tone: CARD_TONE[why],
    left,
    frac: left === null || !total ? 1 : Math.min(1, left / total),
    options: optionsOf(why, id, personOf(state, Number(String(e.data.n ?? '').split(',')[0]))),
  };
}

/** The cards folded into a stop: the last entries of its `n` (the first one is the trigger unless the stop is for the age, the near death or the death). */
export function foldedCards(data: GameData, state: GameState, stop: LogEntry): CardView[] {
  const kinds = String(stop.data.cards ?? '').split(',').filter(Boolean);
  if (!kinds.length) return [];
  const ns = String(stop.data.n ?? '').split(',').filter(Boolean).map(Number);
  const out: CardView[] = [];
  kinds.forEach((kind, i) => {
    if (!isKind(kind)) return;
    const from = kinds.length - i;
    const n = ns[ns.length - from] ?? stop.n;
    // the id comes from the entry the card stands for: the `ids` of the stop are joined with commas and a battle has several
    const id = entryAt(state, n)?.id ?? '';
    const entry: LogEntry = { ...stop, data: { call: 'card', why: kind, ids: id, n: String(n), cards: '', until: null, age: null }, id };
    out.push({ n, kind, id, text: callReason(data, entry, crisisOf(state), (n) => entryAt(state, n)), tone: CARD_TONE[kind], left: null, frac: 1, options: optionsOf(kind, id, personOf(state, n)) });
  });
  return out;
}

export interface StopView {
  n: number;
  /** `age` `window` `majorOmen` `nearDeath` `death` ... */
  why: string;
  age: number | null;
  /** The reason, in words: one short sentence, the title of the stop. */
  reason: string;
  /** What else the stop says, in words for the player (an age stop folded into this one). The cards that wait are listed under it, not told here. */
  notes: string[];
  /** What the god can do about the reason itself. */
  options: GodOpen[];
  /** The waiting cards folded into the stop. */
  cards: CardView[];
  /** The lines since the last stop worth telling again (level 2 and up). */
  recap: Line[];
  /** The death stop: nothing to do, the end screen follows. */
  death: boolean;
}

/**
 * The title and the notes of a stop for the player. `callReason` (src/core/text) writes one line for the log: the reason, then ` · รวมจุดหยุดตามอายุ N มาไว้ที่นี่ (…)` when an age
 * stop was folded in, then ` · มีเรื่องรออยู่ด้วย: …` when cards wait. On the screen the first part is the title; the folded age stop is a note in plain words; the waiting
 * cards are drawn under it already, so their names are not said twice (M7 review P1-7: the title read like a raw log line).
 */
export function stopWords(said: string, why: string, age: number | null): { title: string; notes: string[] } {
  const parts = said.split(' · ');
  const title = parts[0] ?? said;
  const notes: string[] = [];
  if (age !== null && why !== 'age' && parts.some((p) => p.startsWith('รวมจุดหยุดตามอายุ'))) notes.push(WATCH_WORDS.stop.ageFolded(age));
  return { title, notes };
}

/** The last stop in the log, or null. */
export function lastStop(state: GameState): LogEntry | null {
  for (let i = state.log.length - 1; i >= 0; i--) if (isStop(state.log[i])) return state.log[i];
  return null;
}

export function stopView(data: GameData, state: GameState, e: LogEntry): StopView {
  const why = String(e.data.why ?? '');
  const first = String(e.id ?? '').split(',')[0];
  let prev = -1;
  for (let i = state.log.length - 1; i >= 0; i--) {
    const x = state.log[i];
    if (x.n < e.n && isStop(x)) {
      prev = x.n;
      break;
    }
  }
  const recap = allLines(data, state)
    .filter((l) => l.entry.n > prev && l.entry.n < e.n && l.level >= 2 && l.sys !== 'attention')
    .slice(-RECAP_MAX);
  const said = callReason(data, e, crisisOf(state), (n) => entryAt(state, n));
  const age = typeof e.data.age === 'number' ? e.data.age : null;
  const { title, notes } = stopWords(said, why, age);
  return {
    n: e.n,
    why,
    age,
    reason: title,
    notes,
    options: optionsOf(why, first),
    cards: foldedCards(data, state, e),
    recap,
    death: why === 'death',
  };
}

// ---------- the life line (20-god-ui.md §2 "เส้นชีวิต") ----------

export interface Peg {
  age: number;
  pos: number;
  passed: boolean;
}

export interface Glow {
  n: number;
  age: number;
  pos: number;
  /** The window is still open (the glow beats). */
  open: boolean;
  title: string;
}

export interface Mark {
  n: number;
  age: number;
  pos: number;
  tone: Tone;
  /** The line of the story the mark stands for, for the tooltip. */
  text: string;
}

export interface StopMark {
  n: number;
  age: number;
  pos: number;
  why: string;
}

export interface LifeLineView {
  span: number;
  /** Age now, in life years with the quarter. */
  now: number;
  pos: number;
  pegs: Peg[];
  glows: Glow[];
  marks: Mark[];
  stops: StopMark[];
}

function clockNow(state: GameState): number | null {
  const life = state.life;
  if (!life) return null;
  return (life.dead ? life.dead.hAge : life.hAge) + (life.dead ? 0 : state.clock.quarter / 4);
}

const posOf = (age: number, span: number): number => Math.max(0, Math.min(1, age / span));

/** How the interventions that were done are told on the line: gold for making, blood-red for breaking, silver for bending. */
export function markTone(data: GameData, e: LogEntry): Tone | null {
  const d = e.data;
  if (e.sys !== 'god') return null;
  switch (e.kind) {
    case 'chest':
      return e.id === 'pick' ? (d.kind === 'curse' ? 'dread' : 'light') : null;
    case 'dream':
      return d.paid !== undefined && !d.outcome ? 'light' : null;
    case 'whisper':
      return 'light';
    case 'decree':
      return 'fate';
    case 'prayer.give':
      return 'light';
    case 'prayer.punish':
      return 'dread';
    case 'miracle': {
      const m = items<{ miracles?: { list: { id: string; cost: { faith?: number; dread?: number }; tier: string }[] } }>(data, 'god')?.miracles?.list.find((x) => x.id === e.id);
      if (m?.tier === 'ลิขิต') return 'fate';
      return m && m.cost.dread && !m.cost.faith ? 'dread' : 'light';
    }
  }
  return null;
}

export function lifeLineOf(data: GameData, state: GameState): LifeLineView {
  const span = (items<AttentionData>(data, 'attention')?.lifeYears ?? LIFE_YEARS) || LIFE_YEARS;
  const now = clockNow(state) ?? 0;
  const ages = rulesOf(items<AttentionData>(data, 'attention')).ageStops;
  const start = lifeStartN(state);
  const text = new Map(allLines(data, state).map((l) => [l.entry.n, l.text]));
  const glows: Glow[] = [];
  const marks: Mark[] = [];
  const stops: StopMark[] = [];
  for (const e of state.log) {
    if (e.n < start) continue;
    const age = ageOf(e);
    if (age === null) continue;
    if (e.sys === 'attention') {
      if (e.kind === 'glow') glows.push({ n: e.n, age, pos: posOf(age, span), open: now - age < GLOW_OPEN_YEARS, title: plainName(data, e.id) });
      else if (isStop(e) && e.data.why !== 'age' && e.data.why !== 'death') stops.push({ n: e.n, age, pos: posOf(age, span), why: String(e.data.why ?? '') });
      continue;
    }
    const tone = markTone(data, e);
    if (tone) marks.push({ n: e.n, age, pos: posOf(age, span), tone, text: text.get(e.n) ?? '' });
  }
  return {
    span,
    now,
    pos: posOf(now, span),
    pegs: ages.map((a) => ({ age: a, pos: posOf(a, span), passed: a <= now })),
    glows,
    marks,
    stops,
  };
}

// ---------- the god panel (20-god-ui.md §2 "แผงพระเจ้า" "ศรัทธาเทพของตัวละคร") ----------

export interface Vial {
  value: number;
  cap: number;
  /** 0 to 1 */
  fill: number;
}

export interface CandleView {
  belief: number;
  /** 0 to 1: the height of the flame */
  fill: number;
  /** Gold when loyal, white when wavering, cold blue when hating (the band names follow 01-power.md §3). */
  tone: 'loyal' | 'wavering' | 'cold';
  band: BeliefBand;
  /** The band in words, from the god data. */
  bandName: string;
  /** The belief as a share of the candle, 0 to 100. */
  pct: number;
}

const bandOfTone = (b: BeliefBand): CandleView['tone'] => (b === 'devoted' || b === 'believer' ? 'loyal' : b === 'wavering' ? 'wavering' : 'cold');

export function candleOf(data: GameData, belief: number): CandleView {
  const b = Math.max(-100, Math.min(100, belief));
  const band = bandOf(b);
  const bands = items<{ belief?: { bands: { name: string; min: number; max: number }[] } }>(data, 'god')?.belief?.bands ?? [];
  const row = bands.find((x) => b >= x.min && b <= x.max);
  const pct = Math.round((b + 100) / 2);
  return {
    belief: b,
    fill: Math.max(CANDLE_MIN_FILL, (b + 100) / 200),
    tone: bandOfTone(band),
    band,
    bandName: (row?.name ?? '').replace(/\s*\(.*\)/, ''),
    pct,
  };
}

/** A button of the god panel that cannot be used now: grey, with the hourglass, the reason and the time left (20-god-ui.md §2). */
export interface GodGate {
  /** The reason the core gave (`canDo`). */
  reason: string;
  why: Exclude<CanDo, { ok: true }>['why'];
  /** World years until it is ready, when the core says. */
  wait?: number;
}

export interface GodPanelView {
  light: Vial;
  dread: Vial;
  /** The five buttons, in order of the panel. */
  buttons: GodKind[];
  /** The chest and the dream have a thin gold edge while a window is open (20-god-ui.md §2 "หน้าต่างที่ไม่หยุด"). */
  windowOpen: boolean;
  /** A life is on the stage (the buttons work). */
  alive: boolean;
  /** The buttons the god may not press now, with the reason. A button not listed may be pressed. */
  gates: Partial<Record<GodKind, GodGate>>;
}

/** The god action whose check says whether the button itself is any use now (the button takes no arguments): a screen that needs a choice first has no gate here. */
export const BUTTON_ACTION: Partial<Record<GodKind, { action: GodAction; args: Record<string, unknown> }>> = {
  chest: { action: 'chest.open', args: {} },
  whisper: { action: 'whisper', args: { hint: 'ระวัง' } },
};

/** The reasons that grey a button: the year's cap, the cost, the wait (a reason that only asks for a choice, like a missing target, does not). */
const GATING: readonly GodGate['why'][] = ['cap', 'cost', 'cooldown'];

/** The buttons of the god panel the core says no to (`canDo`): the screen asks it each time it draws. Pure. */
export function godGates(ctx: Ctx): Partial<Record<GodKind, GodGate>> {
  const out: Partial<Record<GodKind, GodGate>> = {};
  for (const [k, a] of Object.entries(BUTTON_ACTION) as [GodKind, { action: GodAction; args: Record<string, unknown> }][]) {
    const r = canDo(ctx, a.action, a.args);
    if (!r.ok && GATING.includes(r.why)) out[k] = { reason: r.reason, why: r.why, wait: r.wait };
  }
  return out;
}

export const GOD_BUTTONS: GodKind[] = ['chest', 'dream', 'whisper', 'miracle', 'chronicle'];

// ---------- the whole screen ----------

export interface WatchModel {
  name: string | null;
  age: number | null;
  dead: boolean;
  purse: { light: number; dread: number };
  candle: CandleView | null;
  panel: GodPanelView;
  line: LifeLineView;
  log: Line[];
  speed: Settings['speed'];
  /** The clock was brought from fast to normal because a card is up; it goes back to fast when the card is gone (07-attention.md §2, 01-one-life.md §6). */
  slowed: boolean;
  running: boolean;
  stop: StopView | null;
  cards: CardView[];
}

export interface WatchUi {
  running: boolean;
  /** The call that stopped the clock (the store's `stopCall`). */
  stop: LogEntry | null;
  /** The live cards (the store's `cards`). */
  cards: LogEntry[];
  /** The screen slowed the fast speed to normal for the cards. */
  slowed?: boolean;
  /** The buttons of the god the core refuses now (`godGates`); the pure model has no game to ask. */
  gates?: Partial<Record<GodKind, GodGate>>;
}

export function watchModel(data: GameData, state: GameState, ui: WatchUi): WatchModel {
  const c = clockOf(state);
  const p = purseOf(state);
  const line = lifeLineOf(data, state);
  const alive = !!state.life && !state.life.dead;
  const stop = ui.stop ? stopView(data, state, ui.stop) : null;
  return {
    name: c.name,
    age: c.age,
    dead: c.dead,
    purse: { light: p.light, dread: p.dread },
    candle: p.belief === null ? null : candleOf(data, p.belief),
    panel: {
      light: { value: p.light, cap: POWER_CAP, fill: Math.min(1, p.light / POWER_CAP) },
      dread: { value: p.dread, cap: POWER_CAP, fill: Math.min(1, p.dread / POWER_CAP) },
      buttons: GOD_BUTTONS,
      windowOpen: alive && (line.glows.some((g) => g.open) || (!!stop && (stop.why === 'window' || stop.why === 'age'))),
      alive,
      gates: alive ? ui.gates ?? {} : {},
    },
    line,
    log: allLines(data, state).slice(-LOG_KEEP),
    speed: state.settings.speed,
    slowed: !!ui.slowed && ui.cards.length > 0,
    running: ui.running,
    stop,
    cards: ui.cards.map((e) => cardView(data, state, e)).filter((x): x is CardView => !!x),
  };
}

// ---------- the settings (07-attention.md §4, llm/README.md §3) ----------

export type LlmKey = 'setup' | 'director' | 'epitaph';

export interface SettingsView {
  speed: Settings['speed'];
  attention: Settings['attention'];
  /** What the chosen level changes, from the attention data (empty for the normal level). */
  attentionNotes: Record<Settings['attention'], string>;
  master: boolean;
  /** The three points of the LLM; each is on only if the master is on too. */
  llm: Record<LlmKey, boolean>;
  /** The switch of each kind of card (07-attention.md §4); a setting without the switches reads as all on. */
  cards: Record<CardKind, boolean>;
}

export const CARD_SWITCHES: readonly CardKind[] = CARD_KINDS;

const LEVELS: Settings['attention'][] = ['low', 'normal', 'high'];

export function settingsView(data: GameData, s: Settings): SettingsView {
  const text = items<AttentionData>(data, 'attention')?.settingsText ?? [];
  const notes = {} as Record<Settings['attention'], string>;
  LEVELS.forEach((k, i) => {
    const diff = text[i]?.diff ?? '';
    notes[k] = /^ตามหัวข้อ/.test(diff) ? '' : diff;
  });
  const master = s.llm?.master !== false;
  return {
    speed: s.speed,
    attention: s.attention,
    attentionNotes: notes,
    master,
    llm: { setup: s.llm?.setup !== false, director: s.llm?.director !== false, epitaph: s.llm?.epitaph !== false },
    cards: { ...allCardsOn(), ...s.cards },
  };
}

/** The patch that switches one kind of card (the whole `cards` object, so the type holds). */
export function cardsPatch(s: Settings, kind: CardKind, on: boolean): Partial<Settings> {
  return { cards: { ...allCardsOn(), ...s.cards, [kind]: on } };
}

/** The patch that changes one LLM switch (the whole `llm` object, so the type holds). */
export function llmPatch(s: Settings, key: 'master' | LlmKey, on: boolean): Partial<Settings> {
  return { llm: { master: s.llm?.master !== false, setup: s.llm?.setup !== false, director: s.llm?.director !== false, epitaph: s.llm?.epitaph !== false, [key]: on } };
}

// ---------- for the storybook and the tests ----------

/** The calls of a sample state: its live cards, and the last stop when asked (the store keeps these two while the game runs). */
export function uiOfState(state: GameState, opts: { running?: boolean; stop?: boolean } = {}): WatchUi {
  return { running: opts.running ?? false, stop: opts.stop ? lastStop(state) : null, cards: liveCards(state) };
}

/** Why the core would refuse a patch of the settings, or null. */
export { badSettings as refusedSettings } from '../../core/command';
