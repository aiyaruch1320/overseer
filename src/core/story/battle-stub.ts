// A stand-in for the combat system (M3): a battle named by a story row is one roll, win or lose or flee, and a log entry of kind
// `battle`. Combat takes over by registering the `battle` effect itself and removing this file's registration.
import type { Ctx } from '../game';
import { write } from '../log';
import type { EffectSource } from '../rules';
import { extOf, lifeOf } from './state';
import { BATTLE_ODDS } from './tuning';

export type BattleResult = 'win' | 'lose' | 'flee';

export function battleStub(ctx: Ctx, enemies: readonly string[], src: EffectSource, text?: string): BattleResult {
  // its own stream: swapping this stub for the real combat never shifts the story's choices
  const i = ctx.rng('life.story.battle').weighted([BATTLE_ODDS.win, BATTLE_ODDS.lose, BATTLE_ODDS.flee]);
  const result: BattleResult = i === 0 ? 'win' : i === 1 ? 'lose' : 'flee';
  const life = lifeOf(ctx);
  if (life) extOf(life).battles[result]++;
  write(ctx.state, {
    sys: 'story',
    kind: 'battle',
    id: enemies.join(',') || undefined,
    data: { result, enemies: enemies.join(','), node: src.id ?? null, text: text ?? null },
    level: 2,
  });
  return result;
}
