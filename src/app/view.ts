// What the screens read: plain view models made from the state of the store. Every text comes from src/core/text or the tool reports
// (code-plan §8.1 rule 2: no game text in a component). A screen calls these inside a render that read `store.rev.value`, so it is drawn
// again after each beat. The functions are pure over (data, state), so the storybook can feed them a sample state.
import { candidates } from '../core/lineage';
import { cardOf, collectionView, type EndingCard } from '../core/ending';
import type { GameData } from '../core/game';
import { lines, type Line } from '../core/text';
import type { GameState, LogEntry } from '../core/types';
import { statusLines } from '../../scripts/tools/report';
import { callLines } from '../../scripts/tools/god-commands';
import { LOG_KEEP } from './tuning';
import { perLifeLines } from './life-number';

export interface Clock {
  /** Age of the character in life years, or null between lives. */
  age: number | null;
  quarter: number;
  /** The world year (ศ.ม. is worldYear + 10,000 in the text system's words). */
  worldYear: number;
  name: string | null;
  dead: boolean;
}

export function clockOf(state: GameState): Clock {
  const life = state.life;
  return {
    age: life ? life.hAge : null,
    quarter: state.clock.quarter,
    worldYear: state.clock.worldYear,
    name: life?.name ?? null,
    dead: !!life?.dead,
  };
}

/** The story log as the player reads it (level 1 and up by default), the newest `LOG_KEEP` lines. */
export function storyLines(data: GameData, state: GameState, minLevel: LogEntry['level'] = 1): Line[] {
  return perLifeLines(state, lines(data, state.log, minLevel).slice(-LOG_KEEP));
}

/** The god's purse and standing (20-god-ui.md §2 "เทียนศรัทธาเทพ"). */
export interface Purse {
  light: number;
  dread: number;
  /** ศรัทธาเทพ of the character toward the god (−100 to 100), or null between lives. */
  belief: number | null;
}

export function purseOf(state: GameState): Purse {
  return { light: Math.floor(state.god.light), dread: Math.floor(state.god.dread), belief: state.life ? state.life.godFaith : null };
}

/** The words of a call (a stop or a card) as the tools say them. */
export function callText(data: GameData, e: LogEntry): string[] {
  return callLines(data, e);
}

/** The status panel of the character, as text lines (a structured panel replaces this in the character screen). */
export function statusText(data: GameData, state: GameState): string[] {
  return statusLines(data, state);
}

/** The ending card of a life (the last one by default). */
export function endingCardOf(state: GameState, lifeId?: string): EndingCard | undefined {
  return cardOf(state, lifeId);
}

export { candidates as heirCandidates, collectionView };
