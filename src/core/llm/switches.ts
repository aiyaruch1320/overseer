// The switches (llm/README.md §3): the master and one per point, read from two places. The server side (env, in `LlmClient.config`) can shut the whole
// layer or a point; the player's side is `Settings.llm`. A point works when both are on.
import type { GameState } from '../types';
import type { LlmClient } from './client';
import { SWITCH_OF, type LlmPoint } from './tuning';

/** The player's side alone: the master (`Settings.llm.master`, proposed; missing means on) and the switch of the point. */
export function playerOn(state: GameState, point: LlmPoint): boolean {
  const s = state.settings.llm as GameState['settings']['llm'] & { master?: boolean };
  return s.master !== false && s[SWITCH_OF[point]] === true;
}

/** May the game ask the LLM at this point now? The player's switches, the server's switches, the credit and the breaker. */
export function pointOn(state: GameState, client: LlmClient | null | undefined, point: LlmPoint): boolean {
  return !!client && playerOn(state, point) && client.available(point);
}
