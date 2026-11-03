// View models of the fight (code-plan §8.2 row "ศึก"): pure functions over (data, state, log entry). The player watches and does not steer:
// the hero takes the stance his character picks, and the god's hand shows only as a dream that named a stance (×3) or a whisper on a weak point.
//
// The entry `combat/battle` is read as the core writes it (src/core/combat/fight.ts): `result end enemies foe node kind beats hpLost hp stances first
// wounds loot`. Fields that make the watching exact are read when the core writes them and left out gracefully when it does not:
//   rolls      ';' between beats, '/' between the fields `stance/d20/bonus/dc/ok/hp/left` (ok is 1 or 0; hp and left are after the beat)
//   dream      the id of the stance a god dream named for this fight        whisper  1 when the whisper on the weak point held
//   max        the hero's most hit points   foeWounds  the wounds of the foe as the fight began   lastStand  1 for a last stand
// Words: names of foes, stances, tiers, wounds and loot come from the generated data and src/core/text; the chrome from battle-words.ts.
import { EXTRA_TIERS, GROUP, LAST_STAND, RANKS, RANK_POINTS } from '../../core/combat/tuning';
import type { FightResult } from '../../core/combat/types';
import type { Clash, ClashesData, CombatData, Enemy, EnemiesData, Mark } from '../../core/data/types-combat';
import type { GameData } from '../../core/game';
import { describe, lines, plainName, scrub } from '../../core/text';
import { items, labels } from '../../core/text/labels';
import { clashStory } from '../../core/text/m3';
import { CLASH_RESULT_TH, RANK_TH, WOUND_TH } from '../../core/text/words';
import type { GameState, LogEntry } from '../../core/types';
import { BATTLE_WORDS as W, WAR_WORDS } from './battle-words';

const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

// ---------- the entries a screen can open ----------

/** Fights the watch screen can open: every `combat/battle` entry (a skipped fight writes none). */
export const isBattle = (e: LogEntry): boolean => e.sys === 'combat' && e.kind === 'battle';

/** The entries to open from the log lines, newest last. */
export function battleEntries(state: GameState, minLevel: LogEntry['level'] = 1): LogEntry[] {
  return state.log.filter((e) => isBattle(e) && e.level >= minLevel);
}

/** The battle entry with the running number `n`, if it is one. */
export function battleAt(state: GameState, n: number): LogEntry | undefined {
  const e = state.log.find((x) => x.n === n);
  return e && isBattle(e) ? e : undefined;
}

// ---------- the model ----------

export type Tone = 'win' | 'lose' | 'draw' | 'quiet';

export interface RollView {
  d20: number;
  bonus: number;
  dc: number;
  total: number;
  /** The natural 20 and the natural 1 decide the roll whatever the sum. */
  crit: boolean;
  fumble: boolean;
}

export interface BeatView {
  /** 1-based. */
  n: number;
  stance: string;
  /** The name of the stance (combat.json). */
  name: string;
  roll: RollView | null;
  /** The roll passed; null when the entry did not keep it. The last beat is read from the end of the fight when the rolls were not kept. */
  ok: boolean | null;
  /** Hit points of the hero and wounds of the foe left after this beat, when the entry kept them. */
  hp: number | null;
  left: number | null;
  /** The stance is the one a god dream named. */
  dream: boolean;
}

export interface ReactionView {
  name: string;
  mark: Mark;
  /** The whisper pointed the hero at this weak point. */
  whispered: boolean;
}

export interface FoeView {
  ids: string[];
  name: string;
  tier: string;
  tierId: string;
  /** The foe is a boss or a legend (a bigger figure, a heavier frame). */
  heavy: boolean;
  named: boolean;
  wounds: number;
  maxBeats: number;
  weak: ReactionView[];
  resist: ReactionView[];
}

export interface GodView {
  /** The stance a dream named, if the fight took it. */
  dream: { id: string; name: string } | null;
  whisper: boolean;
}

export interface ClashView {
  id: string;
  /** The name the clash goes by (the place of the NPC's story). */
  name: string;
  opener: string;
  /** The standard result of the row the fight picked, seen from the character (07-npc-clashes.md §3). */
  result: string;
  /** What happened, as the document tells it. */
  story: string;
  style: string;
}

export interface BattleModel {
  n: number;
  /** The line of the log, as the player reads it (src/core/text). */
  line: string;
  kind: string;
  kindLabel: string;
  /** The story node that asked for the fight, as the player reads it. */
  node: string;
  foe: FoeView;
  hero: { name: string; hpBefore: number; hpAfter: number; max: number };
  first: 'hero' | 'foe' | 'even';
  lastStand: boolean;
  beats: BeatView[];
  /** The rolls were kept for every beat, so hit points and wounds can follow the fight beat by beat. */
  exact: boolean;
  end: FightResult;
  resultLabel: string;
  tone: Tone;
  hpLost: number;
  wounds: string[];
  loot: string[];
  god: GodView;
  clash: ClashView | null;
}

const FIGHT_RESULTS: readonly string[] = ['win', 'flawless', 'talk', 'tame', 'draw', 'flee', 'lose', 'dead'];

const endOf = (d: LogEntry['data']): FightResult => {
  const e = str(d.end);
  if (FIGHT_RESULTS.includes(e)) return e as FightResult;
  const r = str(d.result);
  return (FIGHT_RESULTS.includes(r) ? r : 'draw') as FightResult;
};

const toneOf = (end: FightResult): Tone => {
  switch (end) {
    case 'win':
    case 'flawless':
      return 'win';
    case 'talk':
    case 'tame':
      return 'quiet';
    case 'draw':
    case 'flee':
      return 'draw';
    default:
      return 'lose';
  }
};

/** Parses the `rolls` field: one record per beat, or an empty list when the entry does not keep them. */
export function parseRolls(text: string): { stance: string; d20: number; bonus: number; dc: number; ok: boolean; hp: number | null; left: number | null }[] {
  if (!text) return [];
  return text
    .split(';')
    .filter(Boolean)
    .map((r) => {
      const f = r.split('/');
      const opt = (i: number) => (f[i] === undefined || f[i] === '' ? null : Number(f[i]));
      return { stance: f[0] ?? '', d20: Number(f[1]) || 0, bonus: Number(f[2]) || 0, dc: Number(f[3]) || 0, ok: f[4] === '1', hp: opt(5), left: opt(6) };
    });
}

// ---------- the foe ----------

type TierInfo = { id: string; wounds: number; maxBeats: number };

function tierTable(data: GameData): Map<string, TierInfo> {
  const m = new Map<string, TierInfo>();
  for (const t of items<CombatData>(data, 'combat')?.tiers ?? []) m.set(t.tier, { id: t.id, wounds: t.wounds[0], maxBeats: t.maxBeats });
  for (const [name, x] of Object.entries(EXTRA_TIERS)) if (!m.has(name)) m.set(name, { id: x.id, wounds: x.wounds, maxBeats: x.maxBeats });
  return m;
}

const enemyMap = (data: GameData): Map<string, Enemy> => new Map((items<EnemiesData>(data, 'enemies')?.items ?? []).map((e) => [e.id, e]));

const HEAVY = new Set(['boss', 'legend']);

function reactions(list: readonly { name: string; mark: Mark }[], whisper: boolean): ReactionView[] {
  return list.map((r) => ({ name: r.name, mark: r.mark, whispered: whisper && (r.mark === '★' || r.mark === '▲') }));
}

/** The foe of a fight as the combat system builds it (src/core/combat/foe.ts): the lead is the enemy of the highest DC; a group adds its wounds and beats. */
export function foeView(data: GameData, d: LogEntry['data'], whisper = false): FoeView {
  const tiers = tierTable(data);
  const enemies = enemyMap(data);
  const ids = str(d.enemies).split(',').filter(Boolean);
  const rows = ids.map((id) => enemies.get(id)).filter((e): e is Enemy => !!e);
  const lastStand = !!num(d.lastStand);
  const name = rows.length ? rows.map((e) => e.name).join(' · ') : scrub(data, str(d.foe)) || str(d.foe);
  if (!rows.length) {
    // a dragon of the fifteen (`dragon:<name>`) is not in enemies.json: legend tier
    const t = tiers.get('ตำนาน') ?? { id: 'legend', wounds: 8, maxBeats: 8 };
    return { ids, name, tier: 'ตำนาน', tierId: t.id, heavy: true, named: true, wounds: num(d.foeWounds) || t.wounds, maxBeats: t.maxBeats, weak: [], resist: [] };
  }
  const lead = rows.reduce((a, b) => (b.dc > a.dc ? b : a), rows[0]);
  const info = tiers.get(lead.tier) ?? tiers.get('ปกติ') ?? { id: 'normal', wounds: 2, maxBeats: 3 };
  const woundsOf = (e: Enemy) => e.wounds ?? (tiers.get(e.tier) ?? info).wounds;
  let wounds = Math.min(GROUP.maxWounds, rows.reduce((s, e) => s + woundsOf(e), 0));
  let maxBeats = info.maxBeats + (rows.length - 1);
  if (lastStand) {
    wounds *= LAST_STAND.wounds;
    maxBeats *= LAST_STAND.beats;
  }
  if (num(d.foeWounds)) wounds = num(d.foeWounds);
  const weak = lead.weak;
  const resist = rows.length === 1 ? lead.resist : lead.resist.filter((r) => rows.every((e) => e.resist.some((x) => x.tag === r.tag)));
  return {
    ids,
    name,
    tier: lead.tier,
    tierId: info.id,
    heavy: HEAVY.has(info.id) || lead.group === 'boss',
    named: lead.group === 'npc_named' || lead.group === 'boss' || /^[A-Z]{2}\d{2}-\d+$/.test(lead.id),
    wounds,
    maxBeats,
    weak: reactions(weak, whisper),
    resist: reactions(resist, false),
  };
}

// ---------- aftermath words ----------

const WOUND_NAMES = WOUND_TH;

/** The permanent harm of a fight: `scar` `injury` and the ids of curses, as the player reads them. */
export function woundNames(data: GameData, list: string): string[] {
  const out: string[] = [];
  for (const w of list.split(',').filter(Boolean)) {
    const t = WOUND_NAMES[w] ?? plainName(data, w);
    if (t) out.push(WOUND_NAMES[w] ? t : `${t}ติดตัว`);
  }
  return out;
}

/** The loot of a fight: gold, fame, karma and the like by their words, skills that grew, and things by their names. A code that has no name is left out. */
export function lootNames(data: GameData, list: string): string[] {
  const out: string[] = [];
  const L = labels(data);
  for (const raw of list.split(',').filter(Boolean)) {
    const m = /^([a-z_]+)\+(\d+)$/.exec(raw);
    if (m && W.gain[m[1]]) {
      out.push(`${W.gain[m[1]]} +${m[2]}`);
      continue;
    }
    if (m) {
      // `<aptitude>+1`: the fight taught a level
      const apt = L.kind.aptitude.get(m[1]) ?? plainName(data, m[1]);
      if (apt) out.push(W.skillUp(scrub(data, apt) || apt));
      continue;
    }
    const t = plainName(data, raw);
    if (t) out.push(t);
  }
  return out;
}

// ---------- the clash ----------

function clashView(data: GameData, state: GameState, e: LogEntry, who: string): ClashView | null {
  const d = e.data;
  const node = str(d.node);
  if (str(d.kind) !== 'clash' && str(d.kind) !== 'duel') return null;
  const file = items<ClashesData>(data, 'clashes');
  const c: Clash | undefined = file?.items.find((x) => x.id === node);
  // the entry `combat/clash` follows the fight in the same beat
  const end = state.log.find((x) => x.n > e.n && x.n <= e.n + 6 && x.sys === 'combat' && x.kind === 'clash' && x.id === node);
  const code = str(end?.data.opener) || c?.open.code || '';
  const opener = file?.openers.find((o) => o.code === code)?.name ?? '';
  const kind = str(end?.data.kind);
  return {
    id: node,
    name: c?.name ?? '',
    opener,
    result: (CLASH_RESULT_TH[kind] ?? '').replace('{who}', who),
    story: end ? clashStory(data, str(end.data.text), who) : '',
    style: c ? scrub(data, c.style) : '',
  };
}

// ---------- the whole model ----------

/** The model of the battle entry `e`. `state` gives the name of the hero, the line of the log and the clash entry that follows. */
export function battleModel(data: GameData, state: GameState, e: LogEntry): BattleModel {
  const d = e.data;
  const stances = new Map((items<CombatData>(data, 'combat')?.stances ?? []).map((s) => [s.id, s.name]));
  const whisper = !!num(d.whisper);
  const dreamId = str(d.dream);
  const foe = foeView(data, d, whisper);
  const end = endOf(d);
  const ids = str(d.stances).split(',').filter(Boolean);
  const rolls = parseRolls(str(d.rolls));
  const exact = rolls.length > 0 && rolls.length === ids.length;
  const total = Math.max(num(d.beats), ids.length);
  const hp = num(d.hp);
  const hpLost = num(d.hpLost);
  const beats: BeatView[] = Array.from({ length: total }, (_, i) => {
    const r = exact ? rolls[i] : undefined;
    const stance = ids[i] ?? r?.stance ?? '';
    const last = i === total - 1;
    // without the rolls only the end is known: the last beat won a fight that was won, or lost one that was lost
    const inferred: boolean | null = !last ? null : ['win', 'flawless', 'talk', 'tame', 'flee'].includes(end) ? true : ['lose', 'dead'].includes(end) ? false : null;
    return {
      n: i + 1,
      stance,
      name: stances.get(stance) ?? '',
      roll: r ? { d20: r.d20, bonus: r.bonus, dc: r.dc, total: r.d20 + r.bonus, crit: r.d20 === 20, fumble: r.d20 === 1 } : null,
      ok: r ? r.ok : inferred,
      hp: r ? r.hp : null,
      left: r ? r.left : null,
      dream: !!dreamId && stance === dreamId,
    };
  });
  const who = state.life?.name ?? '';
  const fightLine = describe(data, e) ?? '';
  const kind = str(d.kind) || 'other';
  const hpAfter = end === 'dead' ? 0 : hp;
  return {
    n: e.n,
    line: fightLine,
    kind,
    kindLabel: W.kind[kind] ?? W.kind.other,
    node: str(d.node) ? plainName(data, str(d.node)) : '',
    foe,
    hero: { name: who, hpBefore: hpAfter + hpLost, hpAfter, max: num(d.max) || hpAfter + hpLost },
    first: str(d.first) === 'hero' || str(d.first) === 'foe' ? (str(d.first) as 'hero' | 'foe') : 'even',
    lastStand: !!num(d.lastStand),
    beats,
    exact,
    end,
    resultLabel: W.result[end],
    tone: toneOf(end),
    hpLost,
    wounds: woundNames(data, str(d.wounds)),
    loot: lootNames(data, str(d.loot)),
    god: { dream: dreamId ? { id: dreamId, name: stances.get(dreamId) ?? '' } : null, whisper },
    clash: clashView(data, state, e, who),
  };
}

/** The model of a battle by the running number of its log entry (what the watch screen has when the player clicks a line). */
export function battleModelAt(data: GameData, state: GameState, n: number): BattleModel | undefined {
  const e = battleAt(state, n);
  return e ? battleModel(data, state, e) : undefined;
}

// ---------- the steps of the playback ----------

/** The playback has one step for the meeting, one for each beat, and one for the result: `steps = beats + 2`, the step 0 being the meeting. */
export const stepsOf = (m: BattleModel): number => m.beats.length + 2;

/** The hero's hit points after the step (the fight's own record when the entry kept it, else the start until the result). */
export function hpAt(m: BattleModel, step: number): number {
  if (step >= m.beats.length + 1) return m.hero.hpAfter;
  if (step <= 0) return m.hero.hpBefore;
  return m.exact ? (m.beats[step - 1].hp ?? m.hero.hpBefore) : m.hero.hpBefore;
}

/** The wounds of the foe left after the step, or null when the entry did not keep the count (then only a won fight is known: none left at the result). */
export function leftAt(m: BattleModel, step: number): number | null {
  if (step <= 0) return m.foe.wounds;
  if (m.exact) return m.beats[Math.min(step, m.beats.length) - 1].left ?? m.foe.wounds;
  if (step >= m.beats.length + 1 && (m.end === 'win' || m.end === 'flawless')) return 0;
  return m.foe.wounds;
}

// ---------- the war of a soldier ----------

/** What the war panel needs of a war (the combat system keeps it in `life.ext.combat.war`; a `combat/campaign` entry tells the same). */
export interface WarInput {
  id: string;
  country: string;
  rank: number;
  points: number;
  since: number;
  age: number | null;
  battles: number;
  held: number;
  won: number;
  lost: number;
  pay: number;
  foes: string[];
}

export interface WarModel {
  name: string;
  rank: string;
  rankN: number;
  next: string | null;
  /** Points toward the next rank, and the points it takes. */
  progress: { points: number; need: number } | null;
  battles: number;
  held: number;
  won: number;
  lost: number;
  pay: number;
  foes: string[];
  years: number;
  /** Share of the battles that were held or won, 0 to 1; null before the first battle. */
  rate: number | null;
  /** The last battles of the war as the log tells them, newest last. */
  recent: string[];
}

/** The war the main character is in now, or null (he is not a soldier of a war). */
export function warInput(state: GameState): WarInput | null {
  const life = state.life;
  const c = life?.ext.combat as { rank?: number; war?: Record<string, unknown> } | undefined;
  const w = c?.war as { id: string; foes: string[]; since: number; battles: number; held: number; won: number; lost: number; pay: number; points: number } | undefined;
  if (!life || !w) return null;
  return {
    id: w.id,
    country: life.country,
    rank: c?.rank ?? 0,
    points: w.points,
    since: w.since,
    age: life.hAge,
    battles: w.battles,
    held: w.held,
    won: w.won,
    lost: w.lost,
    pay: w.pay,
    foes: w.foes,
  };
}

/** The war told by a `combat/campaign` entry (the whole war from its first battle when `total`, else the years the line covers). */
export function warFromCampaign(e: LogEntry): WarInput {
  const d = e.data;
  const years = num(d.years);
  return {
    id: str(d.war),
    country: str(d.country),
    rank: num(d.rankN),
    points: 0,
    since: num(d.since),
    age: num(d.since) + years,
    battles: num(d.battles),
    held: num(d.held),
    won: num(d.won),
    lost: num(d.lost),
    pay: num(d.pay),
    foes: str(d.foes).split(',').filter(Boolean),
  };
}

/** The panel of a soldier's war. `state` gives the last battles from the log. */
export function warModel(data: GameData, w: WarInput, state?: GameState): WarModel {
  const enemies = enemyMap(data);
  const rankName = (n: number) => RANK_TH[RANKS[n] ?? RANKS[0]] ?? '';
  const need = RANK_POINTS[w.rank];
  const country = w.country ? plainName(data, w.country) : '';
  const name = w.id ? plainName(data, w.id) : '';
  const recent = state
    ? lines(data, state.log, 0)
        .filter((l) => l.entry.sys === 'combat' && l.entry.kind === 'war' && (str(l.entry.data.war) || '') === (w.id || ''))
        .slice(-4)
        .map((l) => l.text)
    : [];
  return {
    name: name || WAR_WORDS.untitled(country),
    rank: rankName(w.rank),
    rankN: w.rank,
    next: need === undefined ? null : rankName(w.rank + 1),
    progress: need === undefined ? null : { points: w.points, need },
    battles: w.battles,
    held: w.held,
    won: w.won,
    lost: w.lost,
    pay: w.pay,
    foes: w.foes.map((id) => enemies.get(id)?.name ?? '').filter(Boolean),
    years: w.age === null ? 0 : Math.max(0, w.age - w.since),
    rate: w.battles > 0 ? (w.held + w.won) / w.battles : null,
    recent,
  };
}

/** The war of the character now as a model, or null. */
export function currentWar(data: GameData, state: GameState): WarModel | null {
  const w = warInput(state);
  return w ? warModel(data, w, state) : null;
}
