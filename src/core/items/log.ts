// What the items system writes to the log (sys `items`). Screens and text read only the log (code-plan §6.3).
import type { Ctx } from '../game';
import { write } from '../log';
import type { LogEntry } from '../types';
import type { ItemsExt } from './state';

export const note = (ctx: Ctx, kind: string, id: string | undefined, data: LogEntry['data'], level: 0 | 1 | 2 = 1) => write(ctx.state, { sys: 'items', kind, id, data, level });

export function logGear(ctx: Ctx, ex: ItemsExt): void {
  note(ctx, 'gear', ex.wield, { wield: ex.wield ?? null, armor: ex.armor ?? null, charm: ex.charm ?? null, acc: ex.acc.join(',') }, 0);
}
