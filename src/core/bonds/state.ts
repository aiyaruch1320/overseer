// What the bond system keeps on the life: `life.ext.bonds` (plain JSON). The god acts read `partner` and `children` from it
// (god/acts/prayers.ts `family`): a truthy `partner`, and `children` as a list.
import type { Ctx } from '../game';
import type { LifeState } from '../types';
import { bondsIndex } from './data';

export type TieState = 'alive' | 'dead' | 'faded' | 'ended';

export interface ArcState {
  /** `FT-03` `KN-02`, or the NPC id of a hand-written story (`MH09-7`). */
  code: string;
  /** Last stage played (1..5). 0 = none yet. */
  stage: number;
  /** hAge of the character when the next stage is due. */
  next: number;
  /** hAge the next stage became due and had to wait for its level. */
  waitedFrom?: number;
  /** The character was in the scene of the crisis (stage 3). */
  involved?: boolean;
  /** The character helped at the crisis. */
  helped?: boolean;
  /** The ending that was drawn. */
  end?: 'a' | 'b' | 'c';
  /** The hand-written story of a flagship person (true) or a template (false). */
  flag?: boolean;
}

export interface Mood {
  mood: string;
  /** hAge the mood ends. */
  until: number;
}

export interface Tie {
  id: string;
  name: string;
  /** NPC id when the person is a position of the roster (flagship ally, a bound person ...). */
  npc?: string;
  /** NPC generation at the time the tie opened (a changed generation means the holder died). */
  gen?: number;
  line: string;
  past: string[];
  /** Bond 0..100 (bonds/01 §2). */
  b: number;
  /** The four axes of the person toward the character (npcs/README §4): gratitude, grudge, how well known, trust. */
  gratitude: number;
  grudge: number;
  known: number;
  trust: number;
  /** B gained since the last point of "known" (every +10 of B the person is known one more; 01 §2.0). */
  acc: number;
  from: string;
  /** Family frame without a story of its own: parents, uncles, grandparents, cousins and siblings who are not close kin (01 §2). */
  light: boolean;
  /** Relation inside the family (`father` `mother` `uncle` `aunt` `grand` `elder_sibling` `younger_sibling` `cousin` `child` `adopted`). */
  kin?: string;
  race: string;
  gender: 'm' | 'f' | 'n';
  country: string;
  /** A person who is not a roster position: age at the time `t0` and how many world years one of his life years takes. */
  age0: number;
  t0: number;
  perYear: number;
  dieAge: number;
  opened: number;
  /** hAge of the character at the last contact (letter, visit, news). */
  last: number;
  state: TieState;
  died?: { age: number; year: number; cause: string };
  arc?: ArcState;
  moods: Mood[];
  /** `B1` `B2` `B3` while another owner holds the person: the level of the bond stops at 3 (03 §2). */
  bound?: string;
  /** Life partner (the lover line only). */
  spouse?: boolean;
  /** hAge the tie joined the party, while in it. */
  party?: number;
  /** hAge the lover/partner line opened (to count "together a year"). */
  workedWith?: number;
  /** Why the tie is only a name now (`ไปจากตัวละคร`). */
  note?: string;
  /** Highest B ever, to bring a split back at half (03 §3 "ขอคืนดี"). */
  peak: number;
  /** The person has a family or dependents (a burden on an invite: 03 §3) and gets on well with the character by nature (a gain on it). */
  family: boolean;
  rapport: boolean;
  /** He asked for a favour first (a refusal of kind 2): the next invite carries no burden. */
  gate?: boolean;
  /** Tie the story node that began the arc (so the alternatives of one node count once). */
  tpl?: string;
  /** Last hAge a mood was shown toward this person. */
  moodCount?: number;
}

export interface PairState {
  code: string;
  tie: string;
  /** The half the character holds (`a` or `b`) and its item id. */
  mine: string;
  /** `full` `single` `memorial`. */
  status: 'full' | 'single' | 'memorial';
}

export interface BondsExt {
  ties: Record<string, Tie>;
  /** Line name → ids of the ties that are alive on it (rebuilt by `reindex`). */
  lines: Record<string, string[]>;
  /** Id of the life partner (the lover of the line that is a life partner or a lover), or null. */
  partner: string | null;
  /** Ids of the children. */
  children: string[];
  /** The tie the effects of the node being played speak of (`stat B`, `mood`, `template`). */
  focus: string | null;
  next: number;
  /** Templates used in this life (a template is not used twice for a life when another fits). */
  used: string[];
  /** Total gratitude earned (บุญคุณ) for acts with no one in particular. */
  favor: number;
  /** Long-term mood of the character toward the people he is bound to (02 §5, the "ผลต่อใจ" sum), −10..10. */
  mind: number;
  /** Persons of blood feud: the name of a person whose mood toward him is แค้น (02 §5). */
  feuds: string[];
  pairs: PairState[];
  /** Tie ids of the party now (at most 4). */
  party: string[];
  /** Years of this life with the pair stories (counts for the balance tests). */
  counts: { ties: number; crises: number; cards: number; ends: number; deaths: number; invites: number; accepted: number; moods: number; blocked: number; news: number };
  /** The year the mood counters belong to. */
  moodYear: { age: number; perLine: Record<string, number> };
  /** Pair stories among the allies (03 §4.1): id, a, b, line, age it was bound at, whether the story rolled. */
  among: { a: string; b: string; line: string; at: number; story: boolean; closed?: boolean }[];
  /** Rules the first-meet sources have run (once per life). */
  done: string[];
  /** A letter or news that waits for its year (far ties). */
  mail: { tie: string; due: number; text: string }[];
  /** An oath of the oath-feather pair has been spent. */
  spent: string[];
  /** hAge of the school years scene (drawn once; 0 = not drawn) and the world year of the last full funeral scene (0 = none). */
  schoolAt: number;
  funeralAt: number;
  funerals: number;
  /** Ids of the ties whose stories were open when the character died (at most 3; the heir takes them as open threads). */
  threads: string[];
}

export function fresh(): BondsExt {
  return {
    ties: {}, lines: {}, partner: null, children: [], focus: null, next: 1, used: [], favor: 0, mind: 0, feuds: [], pairs: [], party: [],
    counts: { ties: 0, crises: 0, cards: 0, ends: 0, deaths: 0, invites: 0, accepted: 0, moods: 0, blocked: 0, news: 0 }, moodYear: { age: -1, perLine: {} }, among: [], done: [], mail: [], spent: [], schoolAt: 0, funeralAt: -99, funerals: 0, threads: [],
  };
}

export function lifeOf(ctx: Ctx): LifeState | null {
  const l = ctx.state.life;
  return l && !l.dead ? l : null;
}

/** The extension of the life, created on first use; repairs a state saved before a field existed. */
export function extOf(life: LifeState): BondsExt {
  let e = life.ext.bonds as BondsExt | undefined;
  if (!e || typeof e !== 'object') {
    e = fresh();
    life.ext.bonds = e;
  }
  const f = fresh();
  for (const k of Object.keys(f) as (keyof BondsExt)[]) if ((e as unknown as Record<string, unknown>)[k] === undefined) (e as unknown as Record<string, unknown>)[k] = f[k];
  return e;
}

export const tiesOf = (e: BondsExt): Tie[] => Object.values(e.ties);
export const isLive = (t: Tie): boolean => t.state === 'alive';

/** Level 1..5 of a tie. */
export function levelOf(ctx: Ctx, t: Tie): number {
  return bondsIndex(ctx).levelOf(t.b);
}

/** Rebuilds the `lines` index and the partner from the ties. */
export function reindex(e: BondsExt): void {
  e.lines = {};
  for (const t of tiesOf(e)) {
    if (!isLive(t)) continue;
    (e.lines[t.line] ??= []).push(t.id);
  }
  const lover = tiesOf(e).find((t) => isLive(t) && t.line === 'คนรัก');
  e.partner = lover ? lover.id : null;
  e.children = tiesOf(e).filter((t) => t.kin === 'child' || t.kin === 'adopted').filter(isLive).map((t) => t.id);
}

/** Ties that count toward the cap of the close lines (level 3 or more, with a story: 01 §2). */
export function closeTies(ctx: Ctx, e: BondsExt): Tie[] {
  return tiesOf(e).filter((t) => isLive(t) && !t.light && levelOf(ctx, t) >= 3);
}

export function looseTies(ctx: Ctx, e: BondsExt): Tie[] {
  return tiesOf(e).filter((t) => isLive(t) && !t.light && levelOf(ctx, t) < 3);
}
