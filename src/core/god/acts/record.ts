// The chronicle of the god's hand (god/06-implementation.md §1: พงศาวดารพระหัตถ์) and the log lines of the acts.
import type { Ctx } from '../../game';
import { write, type LogInput } from '../../log';
import type { LogEntry } from '../../types';

export interface ChronicleInput {
  kind: string;
  id: string;
  target?: string;
  result?: string;
}

/** One line of the chronicle: world year, the character's age, what the hand did, to whom, with what result. */
export function chronicle(ctx: Ctx, e: ChronicleInput): void {
  const l = ctx.state.life;
  ctx.state.god.chronicle.push({ worldYear: ctx.state.clock.worldYear, ...(l && !l.dead ? { hAge: l.hAge } : {}), ...e });
}

/** A log line of the system `god`. */
export function say(ctx: Ctx, e: Omit<LogInput, 'sys'>): LogEntry {
  return write(ctx.state, { sys: 'god', ...e });
}
