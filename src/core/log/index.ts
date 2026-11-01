// The log (code-plan §6.3): every beat writes typed entries; screens and text read only from here.
import type { GameState, LogEntry, LogLevel } from '../types';

export interface LogInput {
  sys: string;
  kind: string;
  id?: string;
  data?: LogEntry['data'];
  level?: LogLevel;
}

export function write(state: GameState, e: LogInput): LogEntry {
  const entry: LogEntry = {
    n: state.logN++,
    worldYear: state.clock.worldYear,
    sys: e.sys,
    kind: e.kind,
    data: e.data ?? {},
    level: e.level ?? 1,
  };
  if (state.life && !state.life.dead) {
    entry.age = state.life.hAge;
    entry.quarter = state.clock.quarter;
  }
  if (e.id !== undefined) entry.id = e.id;
  state.log.push(entry);
  return entry;
}

/** Entries written after a mark (use `state.logN` before a step as the mark). */
export function since(state: GameState, mark: number): LogEntry[] {
  const out: LogEntry[] = [];
  for (let i = state.log.length - 1; i >= 0 && state.log[i].n >= mark; i--) out.push(state.log[i]);
  return out.reverse();
}
