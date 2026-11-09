// What the goals read of a life (god/08-goals.md §2 and §3): the facts the vows and the titles are judged by. Read from the extensions the other
// systems keep on the life, from the log of the life, and from a few counts this file keeps while the life goes on (`track`, state.ts).
// Nothing here changes a system's state: the extensions are read as they are (an extension that does not exist is a blank one), so a reader
// works on a world that lacks a system.
import type { Ctx } from '../../game';
import type { LifeState, LogEntry } from '../../types';
import type { BondageExt } from '../../bondage/state';
import type { BondsExt, Tie } from '../../bonds/state';
import type { CombatExt } from '../../combat/state';
import type { CharacterExt } from '../../character/data';
import type { ItemsExt } from '../../items/state';
import type { StoryExt } from '../../story/state';
import type { TravelExt } from '../../travel/state';
import { bondsIndex } from '../../bonds/data';
import { STAY_YEARS, VOW_NUMBERS } from './tuning';
import { classNumber } from '../../economy/data';
import { slotsOf } from '../../npc/types';
import { nemeses } from '../../npc/status';
import { NEMESIS_GRUDGE } from '../../npc/tuning';
import { tablesOf } from '../../world';
import { birthMark, godData } from '../state';
import { lifeChronicle } from '../stats';
import { ADULT_FROM, BETRAY_WORDS, CLOSE_WORDS, FORGIVE_WORDS, HEAL_JOBS, KILL_WORDS } from './tuning';
import { lifeGoals } from './state';

const ext = <T>(life: LifeState, key: string): T | undefined => life.ext[key] as T | undefined;

export const travelOf = (l: LifeState) => ext<TravelExt>(l, 'travel');
export const bondsOf = (l: LifeState) => ext<BondsExt>(l, 'bonds');
export const combatOf = (l: LifeState) => ext<CombatExt>(l, 'combat');
export const bondageOf = (l: LifeState) => ext<BondageExt>(l, 'bondage');
export const charOf = (l: LifeState) => ext<CharacterExt>(l, 'character');
export const itemsOf = (l: LifeState) => ext<ItemsExt>(l, 'items');
export const storyOf = (l: LifeState) => ext<StoryExt>(l, 'story');

// ---------- the log of the life ----------

/** The entries written since the living (or just dead) character was born. Cached on the arguments of one call. */
export function lifeLog(ctx: Ctx): LogEntry[] {
  const from = birthMark(ctx);
  return ctx.state.log.filter((e) => e.n >= from);
}

const hasWord = (s: unknown, words: readonly string[]): boolean => typeof s === 'string' && words.some((w) => s.includes(w));

/** The ways the story took in this life, as the words of the row (the `label` of each `story/node` entry). */
export const wayLabels = (log: readonly LogEntry[]): string[] => log.filter((e) => e.sys === 'story' && e.kind === 'node').map((e) => String(e.data.label ?? ''));

// ---------- the numbers ----------

export const classOf = (l: LifeState): number => classNumber(l.cls);

/** Countries the character lived in: the birth country and the ones he stood in. */
export function countriesLived(l: LifeState): string[] {
  const t = travelOf(l);
  return [...new Set([t?.born ?? l.home, ...(t?.visited ?? [])])];
}

/** Continents he stood in (the birth continent included). */
export function continentsSeen(l: LifeState): string[] {
  const t = travelOf(l);
  const born = (t?.born ?? l.home).slice(0, 2);
  return [...new Set([born, ...(t?.continents ?? []), ...(t?.visited ?? []).map((c) => c.slice(0, 2))])];
}

export const bornCountry = (l: LifeState): string => travelOf(l)?.born ?? l.home;

/** Battles fought in the life (the combat system counts them by result). */
export function fights(l: LifeState): number {
  const f = combatOf(l)?.fights;
  return f ? f.win + f.lose + f.draw + f.flee : 0;
}

const liveTies = (l: LifeState): Tie[] => Object.values(bondsOf(l)?.ties ?? {}).filter((t) => t.state === 'alive');

/**
 * The highest level a love of the character reached (0 when none): 08-goals.md GV-06 says "มีสายคนรักระดับ 4 ขึ้นไป", not "at the hour of death". A lover who died
 * or faded before him was still loved, so every tie of the line counts whatever its state (a split sets B to zero and a betrayal lowers it, so a broken love falls out
 * by its own B), and a life partner (the tie asked to be one at level 4) counts at least the level the vow asks.
 */
export function loverLevel(ctx: Ctx, l: LifeState): number {
  let lv: (b: number) => number = (b) => Math.floor(b / 20) + 1;
  if (ctx.data.bonds) {
    try {
      const ix = bondsIndex(ctx);
      lv = (b) => ix.levelOf(b);
    } catch {
      /* the bond data is not loaded: the plain reading stands */
    }
  }
  let best = 0;
  for (const t of Object.values(bondsOf(l)?.ties ?? {})) {
    if (t.line !== 'คนรัก' && !t.spouse) continue;
    best = Math.max(best, lv(t.b), t.spouse && t.state !== 'ended' ? VOW_NUMBERS.loverLevel : 0);
  }
  return best;
}

/** A child alive at death (bonds `children`). */
export function heirAlive(l: LifeState): boolean {
  const e = bondsOf(l);
  if (!e) return false;
  return e.children.some((id) => e.ties[id]?.state === 'alive') || liveTies(l).some((t) => t.kin === 'child');
}

/** A student of his is a live tie on the line `ศิษย์`. */
export const hasStudent = (l: LifeState): boolean => liveTies(l).some((t) => t.line === 'ศิษย์');

// ---------- rivals ----------

/** The NPCs who stand against him now: a grudge that reached a nemesis, and the ties of the line `คู่แข่ง`. */
export function rivalsNow(ctx: Ctx, l: LifeState): string[] {
  const ids = new Set<string>(nemeses(ctx));
  // a rival who is not a position of the roster has no NPC id: he is kept under the id of his tie (`tie:` ...), so his fall can be seen later
  for (const t of liveTies(l)) if (t.line === 'คู่แข่ง' || t.grudge >= NEMESIS_GRUDGE) ids.add(t.npc ?? `${TIE_PREFIX}${t.id}`);
  return [...ids].sort();
}

const TIE_PREFIX = 'tie:';

/** Has the NPC fallen or vanished (dead, gone from the roster)? A rival tie without an NPC id (`tie:` ...) has fallen when the person died or faded from the life. */
export function fallen(ctx: Ctx, id: string, life?: LifeState): boolean {
  if (id.startsWith(TIE_PREFIX)) {
    const t = life ? bondsOf(life)?.ties[id.slice(TIE_PREFIX.length)] : undefined;
    return !!t && (t.state === 'dead' || t.state === 'faded');
  }
  const s = slotsOf(ctx.state)[id];
  return !s || s.status !== 'alive';
}

// ---------- the god in the life ----------

/** The interventions of the god in this life (08-goals.md GV-12): gifts picked, dreams sent, whispers, miracles (a conjuring is one). Prayers answered are not counted. */
export function interventions(ctx: Ctx): number {
  let n = 0;
  for (const e of lifeChronicle(ctx)) {
    if (e.kind === 'chest.pick' || e.kind === 'whisper' || e.kind === 'miracle' || e.kind === 'conjure') n++;
    else if (e.kind === 'dream' && ((e.result ?? '').startsWith('sent:') || (e.id ?? '').startsWith('ally:'))) n++;
  }
  return n;
}

/** Gifts received (blessing, skill, item or weapon; a curse is not one): 08-goals.md §6. */
export const giftsReceived = (ctx: Ctx): number => ctx.state.god.counters['l.gifts'] ?? 0;

// ---------- the facts at death ----------

export interface Facts {
  life: LifeState;
  hAge: number;
  cause: string;
  natural: boolean;
  battle: boolean;
  elder: boolean;
  belief: number;
  peak: number;
  curses: number;
  born: string;
  where: string;
  continents: string[];
  countries: string[];
  /** Countries he lived in for at least `STAY_YEARS` life years (the road through a country is not a stay). */
  stayed: number;
  heir: boolean;
  love: number;
  rivalFell: boolean;
  forgave: boolean;
  betrayals: number;
  killedKin: boolean;
  secret: boolean;
  legend: boolean;
  cv: number;
  kind: number;
  interventions: number;
  boundNow: boolean;
  wasBound: boolean;
  freed: boolean;
  dragon: boolean;
  homeLost: boolean;
  built: boolean;
  keySide: boolean;
  badFate: boolean;
}

/** Convergences the character passed (the `cv.` nodes of the walk). */
export const convergences = (l: LifeState): string[] => Object.entries(l.passed).filter(([id, k]) => id.startsWith('cv.') && k !== '-').map(([id]) => id);

/** Legendary weapons in the life: the items system logs `items/legend` the day one is taken. */
export const legendsHeld = (log: readonly LogEntry[]): number => new Set(log.filter((e) => e.sys === 'items' && e.kind === 'legend').map((e) => e.id)).size;

/** Bad fates he carries (`life.fate` holds ids of fates.json); the fate system does not exist yet, so a life has none and GV-13 is not offered. */
export function badFates(ctx: Ctx, l: LifeState): string[] {
  const rows = (ctx.data.fates?.items as { fates?: { id: string; good: boolean }[] } | undefined)?.fates ?? [];
  const bad = new Set(rows.filter((f) => !f.good).map((f) => f.id));
  return l.fate.filter((f) => bad.has(f));
}

/** Where the fates stand at death: a bad fate of his that is still in `life.fate` did happen; the ones that left (`ext.fate.avoided`) did not. */
export const avoidedFates = (l: LifeState): string[] => (l.ext.fate?.avoided ?? []).slice();

export function factsOf(ctx: Ctx, l: LifeState): Facts {
  const d = l.dead;
  const t = lifeGoals(l).track;
  const log = lifeLog(ctx);
  const labels = wayLabels(log);
  const cause = d?.cause ?? '';
  const rivals = t.rivals;
  const story = storyOf(l);
  const bond = bondageOf(l);
  const where = l.country;
  const endsKin = log.filter((e) => e.sys === 'bonds' && e.kind === 'end' && e.data.way === 'death');
  return {
    life: l,
    hAge: d?.hAge ?? l.hAge,
    cause,
    natural: cause === 'old',
    battle: cause.includes('ศึก'),
    elder: (d?.hAge ?? l.hAge) >= godGoals(ctx).elder,
    belief: l.godFaith,
    peak: Math.max(t.peakBelief, l.godFaith),
    curses: l.curses.length,
    born: bornCountry(l),
    where,
    continents: continentsSeen(l),
    countries: countriesLived(l),
    stayed: Object.values(t.stay ?? {}).filter((y) => y >= STAY_YEARS).length,
    heir: heirAlive(l),
    love: loverLevel(ctx, l),
    rivalFell: rivals.length > 0 && rivals.some((id) => fallen(ctx, id, l)),
    forgave: labels.some((x) => hasWord(x, FORGIVE_WORDS)) || log.some((e) => e.sys === 'bonds' && e.kind === 'invite' && e.data.ask === 'reconcile' && e.data.ok === true),
    betrayals: labels.filter((x) => hasWord(x, BETRAY_WORDS)).length,
    killedKin: labels.some((x) => hasWord(x, KILL_WORDS) && hasWord(x, CLOSE_WORDS)) || endsKin.some((e) => hasWord(String(e.data.cause ?? e.data.why ?? ''), KILL_WORDS)),
    secret: !!l.secretJob,
    legend: legendsHeld(log) > 0,
    cv: convergences(l).length,
    kind: charOf(l)?.axes?.kind ?? 0,
    interventions: interventions(ctx),
    boundNow: (bond?.level ?? 0) > 0,
    wasBound: t.boundAtBirth || (bond?.counts?.entered ?? 0) > 0 || (bond?.history?.length ?? 0) > 0,
    freed: !!bond && bond.level === 0 && ((bond.history?.length ?? 0) > 0 || t.boundAtBirth),
    dragon: t.dragon || (story?.seen.events ?? []).some((e) => dragonScene(ctx, e, countriesLived(l), continentsSeen(l))),
    homeLost: t.homeLost,
    built: ['hr.e1', 'hr.a4', 'fm.e1', 'nl.e1'].some((n) => l.passed[n] !== undefined && l.passed[n] !== '-') || hasStudent(l) || selfForged(l),
    keySide: ['a', 'b'].includes(String(l.passed['le.a4'] ?? '')),
    badFate: avoidedFates(l).length > 0,
  };
}

const godGoals = (ctx: Ctx) => ({ elder: Math.max(0, Number((godData(ctx).goals.vows.find((v) => v.id === 'GV-01')?.done.match(/\d+/) ?? [55])[0])) });

/**
 * Is the event the fall of a dragon of legend in a place the character lived (a scene with a dragon, 08-goals.md GV-15)? A fall is a scene for the ones who stand in the
 * countries or the continent it falls in; a dragon that fell on the other side of the world is not a scene of his. (The wild dragons the combat system counts are not dragons of legend.)
 */
function dragonScene(ctx: Ctx, id: string, countries: string[], continents: string[]): boolean {
  try {
    const tb = tablesOf(ctx);
    if (!tb.dragons.some((d) => d.fallEvent === id)) return false;
    const home = tb.byId.get(id)?.home;
    if (!home) return false;
    return home.countries.some((c) => countries.includes(c)) || (home.continents as string[]).some((k) => continents.includes(k));
  } catch {
    return false;
  }
}

/** A weapon he forged himself: the smith's mark on a weapon says it was made at his own forge (items `mods`). */
function selfForged(l: LifeState): boolean {
  const mods = itemsOf(l)?.mods ?? {};
  return Object.values(mods).some((m) => m.by === 'self' || m.by === l.name);
}

export const healJob = (l: LifeState): boolean => !!l.job && HEAL_JOBS.includes(l.job);
export const isAdult = (l: LifeState): boolean => l.hAge >= ADULT_FROM;
