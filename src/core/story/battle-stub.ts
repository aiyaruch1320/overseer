// A stand-in for the combat system (M3): a battle named by a story row is one roll, win or lose or flee, and a log entry of kind
// `battle`. Combat takes over by registering the `battle` effect itself and removing this file's registration.
// A life year holds BATTLES_PER_YEAR battles at most, and an enemy is fought once a year: the battle of a node's notes and the battle of
// the way it chose often name the same enemy (M1 review S2).
import type { Ctx } from '../game';
import { write } from '../log';
import type { EffectSource } from '../rules';
import { extOf, lifeOf, yearOf } from './state';
import { BATTLE_ODDS, BATTLES_PER_YEAR } from './tuning';

export type BattleResult = 'win' | 'lose' | 'flee' | 'skip';

export function battleStub(ctx: Ctx, enemies: readonly string[], src: EffectSource, text?: string): BattleResult {
  const life = lifeOf(ctx);
  if (!life) return 'skip';
  const ex = extOf(life);
  const year = yearOf(ex, life);
  // who is fought: the enemies not yet fought this year; a battle that names none is told apart by its words
  const fresh = enemies.length ? enemies.filter((e) => !year.fought.includes(e)) : text && !year.fought.includes(`text:${text}`) ? [`text:${text}`] : [];
  if ((enemies.length || text) && !fresh.length) return 'skip';
  if (year.battles >= BATTLES_PER_YEAR) return 'skip';
  year.battles++;
  year.fought.push(...fresh);
  const named = enemies.length ? fresh : [];
  // its own stream: swapping this stub for the real combat never shifts the story's choices
  const i = ctx.rng('life.story.battle').weighted([BATTLE_ODDS.win, BATTLE_ODDS.lose, BATTLE_ODDS.flee]);
  const result: BattleResult = i === 0 ? 'win' : i === 1 ? 'lose' : 'flee';
  ex.battles[result]++;
  write(ctx.state, {
    sys: 'story',
    kind: 'battle',
    id: named.join(',') || undefined,
    data: { result, enemies: named.join(','), node: src.id ?? null, text: text ?? null },
    level: 2,
  });
  return result;
}
