// The combat system (docs/systems/combat/, code-plan §7 row "combat"): multi-beat fights with nine stances, a weakness matrix, 200 enemies,
// bosses, wins, defeats, flights, permanent wounds, death in battle, loot, and the fights that come on their own.
//
// How it meets the rest of the core:
//   - the story's `battle` and `battleFor` effects reach it through the seam in story/battle-stub.ts (`setBattleHandler`), set when this module is imported;
//   - the NPC system calls `clash(ctx, clashId, opts)` when the story of an NPC meets the hero's (07-npc-clashes.md);
//   - attention reads the call `combat/prelude` that a fight with a name writes some beats before it is fought (attention/tuning.ts EXTERNAL);
//   - the text system reads the result entry `combat/battle` (data: result enemies node text beats hp stances wounds loot);
//   - hit points, wounds, the enemies met and the titles are kept in `life.ext.combat` (state.ts).
import type { System } from '../game';
import { write } from '../log';
import { onStat } from '../rules';
import { enemiesFor, setBattleHandler } from '../story/battle-stub';
import { atWar, rollEncounter, warBattle } from './encounter';
import { chooseEnemies, foeOf } from './foe';
import { admit, flush, launch } from './launch';
import { addHp, hpOf, maxHpOf } from './hero';
import { extOf, lifeOf } from './state';
import { HP, WAR_BATTLE_PER_YEAR, STREAM } from './tuning';
import { buildHero } from './hero';

export { clash, clashOf, openChance, type ClashOpts, type ClashResult, type Opener } from './clash';
export { resolve as fightFoe, rerollChance, hpNow, damageOf, type Fought } from './fight';
export { foeOf, dragonFoe, isNamedEnemy } from './foe';
export { admit, capOf, hasRoom, launch, flush } from './launch';
export { chanceOf, dangerOf, pickEnemy, poolAt, rollEncounter, raidAt, warBattle, atWar } from './encounter';
export { buildHero, addHp, hpOf, maxHpOf } from './hero';
export { options as stanceOptions, stanceBonuses, weights as stanceWeights } from './stance';
export { markOf, bestHit } from './matrix';
export { lootFor, rollWound, quietReward, countWin } from './reward';
export { extOf as combatOf, type CombatExt } from './state';
export type { FightOpts, FightResult, Foe, Outcome } from './types';
export { indexOf as combatIndex, enemyOf } from './data';

import { resolve } from './fight';
import type { Ctx } from '../game';
import type { FightOpts } from './types';
import type { Fought } from './fight';

/**
 * `fight(ctx, enemies, opts)` of the contract: the fight of the hero against enemy ids of enemies.json, fought now. The places in the life
 * year are the caller's (`admit`); a fight with a name that wants the call before it goes through `launch` or the story effect.
 */
export function fight(ctx: Ctx, enemies: readonly string[], opts: FightOpts = {}): Fought | undefined {
  const foe = foeOf(ctx, enemies);
  return foe ? resolve(ctx, foe, opts) : undefined;
}

/**
 * A god dream before a fight names a stance (03-dreams.md §5 "ก่อนศึก"): the next fight takes it ×3 in its choice. The dream system calls this
 * when the way the god sent is a stance; it lasts until `until` (hAge) or the next fight.
 */
export function dreamStance(ctx: Ctx, stance: string, years = 1): boolean {
  const life = lifeOf(ctx);
  if (!life) return false;
  extOf(life).dream = { stance, until: life.hAge + years };
  return true;
}

// ---------- the story's battles ----------

setBattleHandler((ctx, enemiesIn, src, text) => {
  const life = lifeOf(ctx);
  if (!life) return 'skip';
  let ids = [...enemiesIn];
  // a battle with no enemy named is the battle the node's notes name for the way; with none named it does not happen (M1 review S2)
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
});

// ---------- numbers other rules read ----------

let installed = false;
/** Registers the numbers of the grammar this system owns (`battles.won` ...). Called on import; a test that resets the registry can call it again. */
export function registerCombatRules(force = false): void {
  if (installed && !force) return;
  installed = true;
  const fights = (ctx: Parameters<typeof lifeOf>[0]) => {
    const l = lifeOf(ctx);
    return l ? extOf(l).fights : undefined;
  };
  onStat('battles.won', { read: (ctx) => (fights(ctx)?.win ?? 0) + (fights(ctx)?.talk ?? 0) + (fights(ctx)?.tame ?? 0) });
  onStat('battles.lost', { read: (ctx) => fights(ctx)?.lose ?? 0 });
  onStat('battles.fled', { read: (ctx) => fights(ctx)?.flee ?? 0 });
}
registerCombatRules();

// ---------- the system ----------

export const combatSystem: System = {
  name: 'combat',
  birth(ctx) {
    const life = lifeOf(ctx);
    if (!life) return;
    delete life.ext.combat;
    extOf(life).hp = maxHpOf(ctx, life);
  },
  beat(ctx) {
    const life = lifeOf(ctx);
    if (!life) return;
    const ext = extOf(life);
    ext.tick++;
    // a fight whose call went out some beats ago
    flush(ctx);
    if (!lifeOf(ctx)) return;
    // the body mends a little each season (legacy: +3, +6 with `regen`); a long injury ends with its year
    const hero = buildHero(ctx, life);
    const mend = hero.tags.has('regen') ? HP.regenTag : HP.regenPerBeat;
    const max = maxHpOf(ctx, life);
    const now = hpOf(ctx, life);
    if (now < max) addHp(ctx, life, mend + (hero.companion.heal ? 1 : 0));
    else if (now > max) ext.hp = max;
    if (ext.hurt && life.hAge >= ext.hurt.until) ext.hurt = null;
    // the war calls a soldier; then the roads
    if (atWar(ctx, life) && ctx.rng(STREAM.encounter).chance(WAR_BATTLE_PER_YEAR / 4)) {
      warBattle(ctx);
      return;
    }
    rollEncounter(ctx);
  },
};
