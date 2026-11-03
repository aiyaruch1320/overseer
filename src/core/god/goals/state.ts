// What the goals keep (god/08-goals.md). Plain JSON in two places, because GameState has no field for them (contract proposals are in the report):
//   `god.ext.goals`  the world's part: the lives lived in this world, and the lineage's `meta` (points, the chronicle of the lives, what was kept and seen),
//                    which is the part that goes with the lineage from world to world (`goalsCarry` / `applyCarry`, carry.ts)
//   `life.ext.goals` the living life's part: the vows offered and taken, and what was counted along the way for the vows and the titles
// `state.god.vows` holds the vow of the living life (empty or one id); `state.lineage` is the lineage system's and is not touched here.
import type { Ctx } from '../../game';
import type { GameState, LifeState } from '../../types';

export interface Milestones {
  /** Convergences passed, a secret job, legendary weapons carried, the end of the world inside the life: +2 each (08-goals.md §4). */
  cv: number;
  secret: number;
  legend: number;
  ending: number;
}

/** One line of the lineage chronicle: the data, one line per life; `text` is a plain reading of it. */
export interface ChronicleLine {
  life: string;
  name: string;
  race: string;
  born: number;
  died: number;
  hAge: number;
  cause: string;
  vow: string | null;
  vowResult: 'kept' | 'broken' | 'none';
  titles: string[];
  milestones: Milestones;
  gain: number;
  total: number;
  text: string;
}

/** The part of the goals that goes with the lineage from world to world. Plain JSON. */
export interface GoalsMeta {
  v: 1;
  /** The running total of the chronicle (only goes up). */
  points: number;
  lines: ChronicleLine[];
  /** Vow ids kept at least once · life titles ever earned · names of the miracles conjured (the world remembers them) · reactions met (ids `<verb>.<core>`) · listed miracles used. */
  vowsKept: string[];
  titlesSeen: string[];
  conjured: { name: string; mix: string; year: number }[];
  reactionsSeen: string[];
  miraclesUsed: string[];
  /** The rhythm of fate the lineage chose for the next world (`natural` `gentle` `sorrow` `irony`). */
  rhythm: string;
}

export interface GoalsWorld {
  v: 1;
  meta: GoalsMeta;
  /** Lives that ended in this world (the first one gets the +1 of "ชีวิตแรกของสายตระกูลในโลกใหม่"). */
  lives: number;
  /** Count of lines of `meta.lines` when this world began: the part before it came with the carry. */
  carried: number;
}

/** What is counted during the life, for the vows and the titles that the tables cannot read at death. */
export interface Track {
  peakBelief: number;
  /** Adult life years, and the ones with belief ≥ 50. */
  adult: number;
  years50: number;
  /** Life years lived in each country (where the character stood at the turn of the year): "อยู่มากกว่าห้าประเทศ" is about the countries he lived in, not those he passed. Absent in a save of before. */
  stay?: Record<string, number>;
  /** Life years at a healing job. */
  heal: number;
  /** Adult life years held in bondage. */
  bound: number;
  /** The class number at birth and the highest and lowest since. */
  cls0: number;
  clsMax: number;
  clsMin: number;
  /** NPCs who held a grudge, or were rivals, seen alive during the life (ids). */
  rivals: string[];
  /** The home country was lost (ruin, fallen) at some time. */
  homeLost: boolean;
  /** A dragon of legend was in the same scene at some time. */
  dragon: boolean;
  /** Survived a large miracle in his country or the fall of a dragon on his continent. */
  skyBorn: boolean;
  /** Chronicle length the sky scan has read up to. */
  scan: number;
  /** The falls of dragons the sky scan has looked at (each is judged once, by where he stood when it fell). */
  falls?: string[];
  /** Bondage at birth, and freed since. */
  boundAtBirth: boolean;
  /** The world ended (`world.ended`) inside this life. */
  ended: boolean;
  /** Gifts counted at the last life year, and the hAge of the last one (for the price of too much help). */
  gifts?: number;
  lastGift?: number;
}

export interface GoalsLife {
  v: 1;
  /** The vows offered at birth; the vows offered again at the age stop of 15 (for the one change). */
  offers: string[];
  /** The line that tells the vows on the table has been written (it waits for the first beat). */
  told?: boolean;
  reoffers: string[];
  /** The vow taken (null for none yet or none at all) and whether the one change was used. */
  vow: string | null;
  decided: boolean;
  changed: boolean;
  /** Set at death. */
  result?: { vow: string | null; result: 'kept' | 'broken' | 'none'; titles: string[]; line: ChronicleLine; /** a broken vow: the conditions it lacked, in words */ missing?: string[] };
  track: Track;
}

export const freshMeta = (): GoalsMeta => ({ v: 1, points: 0, lines: [], vowsKept: [], titlesSeen: [], conjured: [], reactionsSeen: [], miraclesUsed: [], rhythm: 'natural' });
export const freshWorld = (): GoalsWorld => ({ v: 1, meta: freshMeta(), lives: 0, carried: 0 });
export const freshTrack = (): Track => ({
  peakBelief: -100, adult: 0, years50: 0, heal: 0, bound: 0, cls0: 3, clsMax: 3, clsMin: 3, rivals: [], homeLost: false, dragon: false, skyBorn: false, scan: 0, boundAtBirth: false, ended: false,
});
export const freshLife = (): GoalsLife => ({ v: 1, offers: [], reoffers: [], vow: null, decided: false, changed: false, track: freshTrack() });

/** The world's part, created on first use. */
export function goalsOf(state: GameState): GoalsWorld {
  let w = state.god.ext.goals as GoalsWorld | undefined;
  if (!w || typeof w !== 'object') {
    w = freshWorld();
    state.god.ext.goals = w;
  }
  const f = freshMeta();
  for (const k of Object.keys(f) as (keyof GoalsMeta)[]) if ((w.meta as unknown as Record<string, unknown>)[k] === undefined) (w.meta as unknown as Record<string, unknown>)[k] = f[k];
  return w;
}

/** The world's part for a check or a preview, which must not change the state: the real one, or a blank one that is not kept. */
export const peekGoals = (state: GameState): GoalsWorld => (state.god.ext.goals as GoalsWorld | undefined) ?? freshWorld();

export const metaOf = (ctx: Ctx): GoalsMeta => goalsOf(ctx.state).meta;

/** The life's part, created on first use (a life made before the goals existed gets a blank one). */
export function lifeGoals(life: LifeState): GoalsLife {
  let g = life.ext.goals as GoalsLife | undefined;
  if (!g || typeof g !== 'object') {
    g = freshLife();
    life.ext.goals = g;
  }
  if (!g.track) g.track = freshTrack();
  return g;
}

export const peekLife = (life: LifeState): GoalsLife => (life.ext.goals as GoalsLife | undefined) ?? freshLife();

export const living = (ctx: Ctx): LifeState | null => {
  const l = ctx.state.life;
  return l && !l.dead ? l : null;
};
