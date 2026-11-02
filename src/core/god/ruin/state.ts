// What the ruins, the seals and the grand miracles keep in the state: `god.ext.ruin` (plain JSON, saved with the state).
import type { Ctx } from '../../game';
import type { GameState } from '../../types';

export type RuinKind = 'MR-17' | 'MR-18';

/** A country that became a god ruin (04-miracles.md §5): the day, the dice that were rolled, and the events of the ruin with the day each is due. */
export interface RuinRec {
  country: string;
  kind: RuinKind;
  /** World year of the miracle. */
  year: number;
  /** "ซากซอร์เนบ" as the map writes it (the name is the text layer's; this is the form for the log). */
  label: string;
  /** The share of the people that is left (10% to 40%). */
  pop: number;
  /** The holder of the country's first position, if he lives and stays: the leader of the ruin (RU-05 reads him, RU-06 his heir). */
  leader?: string;
  /** The NPCs that fled (they walk to a country that takes them at RU-02), and the ones that stayed. */
  fled: string[];
  stayed: string[];
  died: string[];
  /** Day each event of the ruin is due, by id (world year); and the day each happened. */
  due: Record<string, number>;
  done: Record<string, number>;
  /** The country that took the refugees. */
  took: string[];
  /** The name of the cult (RU-04), the new name of the city (RU-07), and the day the ruin ended. */
  cult?: string;
  city?: string;
  ended?: number;
  /** The pit became a lake (RU-08). */
  lake?: boolean;
  /** Events of the world that were closed by the ruin, and local events (LC) of the country, which the local-event system will not open. */
  closed: string[];
  closedLc: string[];
  /** The convergence points that moved with the survivors (cv id → the country they are now in). */
  moved: Record<string, string>;
}

/** The "cracked city" a large miracle leaves on a seal (§5.4): not a ruin, but it opens RU-02 and RU-03 (with shards in place of star iron). */
export interface CrackRec {
  country: string;
  kind: string;
  year: number;
  /** The dragons whose place it is. */
  dragons: number[];
  fled: string[];
  died: string[];
  due: Record<string, number>;
  done: Record<string, number>;
  took: string[];
}

/** New land (MR-20): it has no row in the country file; settlers come within twenty years and make a country of W 2. */
export interface LandRec {
  id: string;
  beside: string;
  continent: string;
  name: string;
  year: number;
  /** World year the settlers come. */
  due: number;
  /** World year they came. */
  founded?: number;
}

/** What a dragon does within a year after a blow on its place (§5.4): decided by its mood after the blow. */
export interface SealReply {
  country: string;
  /** The dragon that answers; -1 for the key of AL-01 (it has no mood to reply with). */
  dragon: number;
  due: number;
  mood: number;
  kind: 'protect' | 'growl' | 'awake';
}

/** One miracle that happened, kept a while so the story nodes can ask whether it happened near the character. */
export interface Made {
  id: string;
  year: number;
  country?: string;
  continent?: string;
}

export interface RuinExt {
  v: 1;
  ruins: RuinRec[];
  cracks: CrackRec[];
  lands: LandRec[];
  replies: SealReply[];
  /** Country → world year until which no miracle may fall on it (a dragon spread its seal over it). */
  protect: Record<string, number>;
  /** Large destroying miracles in this world (a blow on a seal counts two): from the third, GD-08 wakes (04-miracles.md iron rule 7). */
  bigDestroy: number;
  /** Blows on the seals (a mid miracle or above), for the balance tests and the tools. */
  strikes: number;
  /** The country of the latest ruin or blow, where the movement of the god-hunters has its base. */
  base?: string;
  followers: string[];
  /** Key of the life that called the wrath (the dread income is doubled for the rest of that life). */
  wrath?: string;
  /** Continent → world year until which the war flags stay off (MR-22). */
  peace: Record<string, number>;
  /** Convergence points that left a ruined country: id → country. */
  moved: Record<string, string>;
  made: Made[];
  /** The events the story nodes were told of for the living character: id → world year, and which life. */
  reach: { life: string; seen: Record<string, number>; wrote: string[] };
}

export function fresh(): RuinExt {
  return { v: 1, ruins: [], cracks: [], lands: [], replies: [], protect: {}, bigDestroy: 0, strikes: 0, followers: [], peace: {}, moved: {}, made: [], reach: { life: '', seen: {}, wrote: [] } };
}

export function ruinExt(state: GameState): RuinExt {
  let e = state.god.ext.ruin as RuinExt | undefined;
  if (!e) {
    e = fresh();
    state.god.ext.ruin = e;
  }
  return e;
}

/** The extension for a check or a preview, which must not change the state. */
export const viewRuin = (state: GameState): RuinExt => (state.god.ext.ruin as RuinExt | undefined) ?? fresh();

export const ruinAt = (ctx: Ctx, country: string): RuinRec | undefined => viewRuin(ctx.state).ruins.find((r) => r.country === country && r.ended === undefined);
export const crackAt = (ctx: Ctx, country: string): CrackRec | undefined => viewRuin(ctx.state).cracks.find((r) => r.country === country);
