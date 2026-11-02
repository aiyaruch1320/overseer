// What the economy keeps for one life, in `life.ext.economy` (LifeState has no field for it; proposal for types.ts in the report).
import type { LifeState } from '../types';

export interface EconomyExt {
  /** Where this life's cost of living sits in the range of its class, 0..1 (drawn at birth). */
  lifestyle: number;
  /** Share a gang takes where there is no state, 0.10..0.25 (04 §4). */
  racket: number;
  /** A noble house: small (60 to 100) or great (100 to 200), and where in that range the land pays (04 §2). */
  rank: 'minor' | 'major';
  landFrac: number;
  /** Changes the story made to the income: a factor (`รายได้ ×0.8`) and a flat sum. */
  inc: number;
  incFlat: number;
  /** One-off numbers that fall back by half every life year: the spread a trade left (percent) and the food price shock of a bad year. */
  spread: number;
  foodMul: number;
  /** Numbers of the trade and investment lines the story changes (`ผลกำไร` `ขาย` `ผลตอบแทน` ...), kept for P3 and P5. */
  x: Record<string, number>;
  /** Fractions of gold not yet paid out (gold is whole). */
  carry: number;
  /** Gold at the end of the last economy year, to see what other systems added since. */
  mark?: number;
  /** Money in and out over the life, by cause, in gold. */
  flows: { years: number; income: number; tax: number; living: number; gain: number; loss: number; fare?: number };
  /** The fares the travel system had taken (`life.ext.travel.spent`) when the last year was counted: its gold is gone already and is not taken again. */
  fareSeen?: number;
  /** The last year's figures. */
  last: { income: number; tax: number; living: number; net: number };
  /** Years in a row gold has stayed under a year of living. */
  tight: number;
  /** Years in a row a class 4 or 5 life has had under half a year of living. */
  ruin: number;
  debt: number;
  /** Class changes the economy made, `<from>><to>` with the age. */
  moves: string[];
  /** Events that already cost this life a class (`DR-01`). */
  fell: string[];
  /** Lines of the 24-economy storylines this life asked the story system to open. */
  opened: string[];
  /** Set when poverty sold the life into bondage: the bondage system picks it up. */
  bondageEntry?: boolean;
  /** What the year now running has taken in besides the formula: shares of a battle or a war paid by the combat system (`payShare`), and the debt at its start. */
  yr: { share: number; shares: number; debt0: number };
}

export function emptyExt(): EconomyExt {
  return {
    lifestyle: 0.5,
    racket: 0.175,
    rank: 'minor',
    landFrac: 0.5,
    inc: 1,
    incFlat: 0,
    spread: 0,
    foodMul: 1,
    x: {},
    carry: 0,
    flows: { years: 0, income: 0, tax: 0, living: 0, gain: 0, loss: 0 },
    last: { income: 0, tax: 0, living: 0, net: 0 },
    tight: 0,
    ruin: 0,
    debt: 0,
    moves: [],
    fell: [],
    opened: [],
    yr: { share: 0, shares: 0, debt0: 0 },
  };
}

/** The economy extras of a life, created on first use. */
export function extOf(life: LifeState): EconomyExt {
  let e = life.ext.economy as EconomyExt | undefined;
  if (!e) {
    e = emptyExt();
    life.ext.economy = e;
  }
  e.yr ??= { share: 0, shares: 0, debt0: e.debt };
  return e;
}
