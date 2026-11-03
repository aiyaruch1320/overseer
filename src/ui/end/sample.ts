// Sample lives for the stories of the ending screens (a seeded life run to its death, with a vow, and the lives that follow it).
// Story-only: it drives the core the way the test tools do, so the screens can be checked without playing to the end.
import { command } from '../../core/command';
import { cardOf } from '../../core/ending';
import type { Ctx, GameData } from '../../core/game';
import { nextLife } from '../../core/lineage';
import type { Command, GameState } from '../../core/types';
import { createSession, runToDeath, startLife } from '../../../scripts/tools/session';

export interface Lived {
  state: GameState;
  ctx: Ctx;
}

const memo = new Map<string, Lived>();

/** `lives` lives of one family in one world, the last one dead. `vow`: take the first vow of the table that ended `kept` or `broken` (or none). */
export function lived(data: GameData, o: { seed: number; lives?: number; vow?: 'kept' | 'broken' | 'none' }): Lived {
  const key = JSON.stringify(o);
  const hit = memo.get(key);
  if (hit) return hit;
  const lives = o.lives ?? 1;
  const picks = o.vow && o.vow !== 'none' ? [1, 2, 3] : [0];
  let out: Lived | null = null;
  for (const pick of picks) {
    const s = createSession(data, { seed: o.seed });
    startLife(s);
    if (pick) command(s.game.ctx, { type: 'god', action: 'vow.pick' as Extract<Command, { type: 'god' }>['action'], args: { pick }, confirm: true });
    for (let i = 0; i < lives; i++) {
      if (i > 0) nextLife(s.game, { newcomer: true });
      runToDeath(s.game);
    }
    out = { state: s.game.state, ctx: s.game.ctx };
    if (!o.vow || o.vow === 'none' || cardOf(out.state)?.vow?.result === o.vow) break;
  }
  memo.set(key, out!);
  return out!;
}
