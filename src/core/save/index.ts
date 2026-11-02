// Save = the whole state plus the data versions it was made with (code-plan §5.3, §6.1).
import { badSettings } from '../command';
import type { DataVersions, GameState } from '../types';

export interface LoadResult {
  state: GameState;
  /** Data files whose version differs from the running game: replays may not match. */
  stale: string[];
}

export function save(state: GameState): string {
  return JSON.stringify(state);
}

export function load(text: string, current: DataVersions): LoadResult {
  const state = JSON.parse(text) as GameState;
  if (state.schema !== 1) throw new Error(`unknown save schema ${String((state as { schema?: unknown }).schema)}`);
  // a save edited by hand must not carry a setting the game cannot run with (review M2 นักหาช่อง H1)
  const bad = badSettings(state.settings ?? {});
  if (bad) throw new Error(`save has bad settings: ${bad}`);
  const stale = Object.keys({ ...state.data, ...current }).filter((f) => state.data[f] !== current[f]);
  return { state, stale };
}

/** Deep copy through JSON; also proves the state holds no functions or classes. */
export function clone(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}
