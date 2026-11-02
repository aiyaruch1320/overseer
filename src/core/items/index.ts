// The items system (code-plan §7 row "items", docs/systems/items/): 1,336 weapons, 332 articles, materials, prices, what the character holds and wears,
// forging as a story, the legendary weapons that are one each in the world, the ancient talismans in NPC hands, life tools.
// State: `life.ext.items` (what is held and worn, wear, smith's marks), `god.ext.items` (the world's legends and talismans). What combat reads: `wielded`, `armorOf`,
// `gearStats`, `gearTags`, `afterBattle`.
import type { System } from '../game';
import { fresh, extOf } from './state';
import { jobWeapons, releaseLegends, scan, shop, upkeep } from './gain';
import { forgeBeat, forgeYear } from './forge';
import { initTalismans, talismanStep } from './talisman';
import { equip } from './wield';

export { wielded, armorOf, shieldMult, damageFloor, gearStats, gearTags, engravedBonus, worn, describe, nearAtHand, equip, type Wielded, type Armor } from './wield';
export { afterBattle, grantable, shopMax, scan, jobWeapons, shop, upkeep, releaseLegends } from './gain';
export { priceOf, sellPrice, weaponPrice, pieceFactor } from './price';
export { toolBonus, toolsOf, bonusOf, paybackYears, wantedTool } from './tools';
export { forgeYear, forgeBeat, forgeOutcome, SMITH_KIND, start as startForge } from './forge';
export { initTalismans, talismanYear, talismanStep, activeCount, ancients, CAP as TALISMAN_CAP } from './talisman';
export { catalog, lookup, nameOf, tierOf, RANK, TIERS } from './data';
export { worldOf as itemsWorld } from './world';
export { extOf as itemsExt, type ItemsExt, type WeaponMod, type ForgeState } from './state';
export * as itemsTuning from './tuning';

export const itemsSystem: System = {
  name: 'items',
  init(ctx) {
    initTalismans(ctx);
  },
  worldStep(ctx) {
    initTalismans(ctx);
    talismanStep(ctx);
  },
  birth(ctx) {
    const life = ctx.state.life;
    if (!life) return;
    life.ext.items = fresh();
    jobWeapons(ctx, life);
    scan(ctx, life);
    equip(ctx, life);
  },
  beat(ctx) {
    const life = ctx.state.life;
    if (!life || life.dead) return;
    scan(ctx, life);
    forgeBeat(ctx, life);
  },
  lifeYear(ctx) {
    const life = ctx.state.life;
    if (!life || life.dead) return;
    extOf(life);
    jobWeapons(ctx, life);
    shop(ctx, life);
    forgeYear(ctx, life);
    upkeep(ctx, life);
    scan(ctx, life);
    equip(ctx, life);
  },
  death(ctx) {
    const life = ctx.state.life;
    if (!life) return;
    scan(ctx, life);
    releaseLegends(ctx, life);
  },
};
