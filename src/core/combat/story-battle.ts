// The `battle` and `battleFor` effects of the story rows (storylines/README.md): the story names the fight, this system fights it.
// A battle with no enemy named ("ศึกสุ่มหนึ่งครั้งต่อปี") is the battle the notes of the node name for the way taken; when the notes name none the
// data holds nothing to fight and the battle does not happen (M1 review S2). An enemy is fought once a life year (launch.ts admit).
import type { Ctx } from '../game';
import { write } from '../log';
import { onEffect, type EffectSource } from '../rules';
import { indexOf } from '../story/data';
import { extOf as storyExt } from '../story/state';
import type { Effect } from '../types';
import { chooseEnemies, foeOf } from './foe';
import { admit, launch } from './launch';
import { lifeOf } from './state';

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

/** The enemies of the notes of the node being played, for the way it took. */
export function enemiesFor(ctx: Ctx, src: EffectSource): string[] {
  const life = ctx.state.life;
  const node = src.id ? indexOf(ctx).nodes.get(src.id) : undefined;
  const cur = life && storyExt(life).cur;
  if (!node || !cur || cur.id !== node.id || cur.choice === '-') return [];
  return [...enemiesOfNotes(node.notes, cur.choice)];
}

/** The story fights now: the result the effect has, `skip` when nothing was fought. */
export function storyBattle(ctx: Ctx, enemiesIn: readonly string[], src: EffectSource, text?: string): BattleResult {
  const life = lifeOf(ctx);
  if (!life) return 'skip';
  let ids = [...enemiesIn];
  if (!ids.length) ids = enemiesFor(ctx, src);
  ids = chooseEnemies(ctx, ids);
  if (!ids.length) {
    write(ctx.state, { sys: 'combat', kind: 'skip', id: src.id, data: { why: 'no enemy named and none in the notes', text: text ?? null }, level: 0 });
    return 'skip';
  }
  const fresh = admit(ctx, ids);
  if (!fresh.length) return 'skip';
  const foe = foeOf(ctx, fresh);
  if (!foe) {
    write(ctx.state, { sys: 'combat', kind: 'skip', id: src.id, data: { why: 'unknown enemy', enemies: fresh.join(',') }, level: 0 });
    return 'skip';
  }
  const r = launch(ctx, fresh, { kind: 'story', node: src.id, text }, foe.named);
  if (r.how !== 'done') return 'skip';
  return r.fought.word === 'win' ? 'win' : r.fought.word === 'lose' ? 'lose' : r.fought.word === 'flee' || r.fought.word === 'draw' ? 'flee' : 'skip';
}

export function registerStoryBattles(): void {
  onEffect('battle', (ctx, e, src) => void storyBattle(ctx, e.enemies, src, e.text));
  onEffect('battleFor', (ctx, e, src) => {
    const l = ctx.state.life;
    const cur = l && storyExt(l).cur;
    if (cur && cur.choice !== '-' && e.choices.includes(cur.choice)) storyBattle(ctx, e.enemies, src, e.role);
  });
}
