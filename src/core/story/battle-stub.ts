// The seam between the story and the combat system (M3). The story registers the `battle` and `battleFor` effects and hands them to
// `battleStub`, which calls the handler that is set. Without the combat system (src/core/combat) the handler is the stand-in below: a battle
// named by a story row is one roll, win or lose or flee, and a log entry of kind `battle`. Importing the combat system sets its own handler.
// A life year holds BATTLES_PER_YEAR battles at most, and an enemy is fought once a year: the battle of a node's notes and the battle of
// the way it chose often name the same enemy (M1 review S2).
import type { Ctx } from '../game';
import { write } from '../log';
import type { EffectSource } from '../rules';
import type { Effect } from '../types';
import { indexOf } from './data';
import { extOf, lifeOf, yearOf } from './state';
import { BATTLE_ODDS, BATTLES_PER_YEAR } from './tuning';

export type BattleResult = 'win' | 'lose' | 'flee' | 'skip';

/** Enemies the notes of a node name for a way (`battleFor`) or for every way (`battle`), looking inside the wrappers. */
function enemiesOfNotes(list: readonly Effect[], key: string, out: Set<string> = new Set()): Set<string> {
  for (const e of list) {
    if (e.k === 'battleFor' && e.choices.includes(key as 'a')) e.enemies.forEach((x) => out.add(x));
    else if (e.k === 'battle') e.enemies.forEach((x) => out.add(x));
    else if (e.k === 'if' || e.k === 'only' || e.k === 'chance') enemiesOfNotes(e.then, key, out);
    else if (e.k === 'pick') e.of.forEach((b) => enemiesOfNotes(b.effects, key, out));
  }
  return out;
}

/**
 * A battle with no enemy named ("ศึกสุ่มหนึ่งครั้งต่อปี") is the battle the node's notes name for that way; when the notes name none the
 * data holds nothing to fight (the random enemy by place is the encounter table of the combat system, M3), so the battle does not happen
 * and the log says why (M1 review S2).
 */
export function enemiesFor(ctx: Ctx, src: EffectSource): string[] {
  const life = lifeOf(ctx);
  const node = src.id ? indexOf(ctx).nodes.get(src.id) : undefined;
  const cur = life && extOf(life).cur;
  if (!node || !cur || cur.id !== node.id || cur.choice === '-') return [];
  return [...enemiesOfNotes(node.notes, cur.choice)];
}

export type BattleHandler = (ctx: Ctx, enemies: readonly string[], src: EffectSource, text?: string) => BattleResult;

/** The combat system takes the battles of the story over by setting its handler. */
export function setBattleHandler(fn: BattleHandler | null): void {
  handler = fn ?? stubImpl;
}

/** What the story calls for a `battle` or `battleFor` effect. */
export function battleStub(ctx: Ctx, enemies: readonly string[], src: EffectSource, text?: string): BattleResult {
  return handler(ctx, enemies, src, text);
}

function stubImpl(ctx: Ctx, enemiesIn: readonly string[], src: EffectSource, text?: string): BattleResult {
  const life = lifeOf(ctx);
  if (!life) return 'skip';
  const ex = extOf(life);
  let enemies = enemiesIn;
  if (!enemies.length) {
    enemies = enemiesFor(ctx, src);
    if (!enemies.length) {
      write(ctx.state, { sys: 'story', kind: 'battleSkip', id: src.id, data: { why: 'no enemy named and none in the notes', text: text ?? null }, level: 0 });
      return 'skip';
    }
  }
  const year = yearOf(ex, life);
  // who is fought: the enemies not yet fought this year
  const fresh = enemies.filter((e) => !year.fought.includes(e));
  if (!fresh.length) return 'skip';
  if (year.battles >= BATTLES_PER_YEAR) return 'skip';
  year.battles++;
  year.fought.push(...fresh);
  // its own stream: swapping this stub for the real combat never shifts the story's choices
  const i = ctx.rng('life.story.battle').weighted([BATTLE_ODDS.win, BATTLE_ODDS.lose, BATTLE_ODDS.flee]);
  const result: BattleResult = i === 0 ? 'win' : i === 1 ? 'lose' : 'flee';
  ex.battles[result]++;
  write(ctx.state, {
    sys: 'story',
    kind: 'battle',
    id: fresh.join(','),
    data: { result, enemies: fresh.join(','), node: src.id ?? null, text: text ?? null },
    level: 2,
  });
  return result;
}

let handler: BattleHandler = stubImpl;
