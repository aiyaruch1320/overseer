// A fresh game state (code-plan §6.1). Plain JSON only: systems fill their own parts when they start.
import { newClock } from '../clock';
import type { GameState, Settings } from '../types';

export const START_YEAR = 0; // ศ.ม. at world creation; world-sim.md runs 1,800 years from here

export function defaultSettings(): Settings {
  return { speed: 'normal', attention: 'normal', llm: { master: true, setup: true, director: true, epitaph: true }, cards: { prayer: true, omen: true, battle: true, crisis: true, majorOmen: true }, lang: 'th' };
}

export function newGame(seed: number, data: GameState['data'] = {}): GameState {
  return {
    schema: 1,
    seed: seed >>> 0,
    data,
    rng: {},
    clock: newClock(START_YEAR),
    settings: defaultSettings(),
    world: {
      era: 1,
      dfc: 0,
      vars: {},
      dragons: [],
      countryFlags: {},
      countryFaith: {},
      happened: {},
      closed: [],
      chains: {},
      ruins: [],
      names: {},
      lastEraKeys: 0,
    },
    npcs: { slots: {}, newcomers: [] },
    life: null,
    god: { light: 0, dread: 0, counters: {}, cooldowns: {}, chest: null, dreams: [], prayers: [], chronicle: [], vows: [], ext: {} },
    lineage: { lives: [], open: [], chronicle: [], collection: [] },
    log: [],
    logN: 0,
    llmAnswers: {},
  };
}
