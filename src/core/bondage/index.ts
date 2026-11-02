// The bondage system (docs/systems/economy/10-bondage.md, code-plan §7 row "bondage"): the levels B0 to B3 of the main character, the stance of each
// country, the ransom, the way across the border, and the roles of the one who buys, redeems or helps to flee. The state is `life.ext.bondage`.
// Importing this module registers its rules (src/core/rules) and takes the lines `bd` `bo` `ab` from the story's own chance.
import type { System } from '../game';
import { enter, lifeYear } from './engine';
import { registerBondageRules } from './rules';
import { bondageIndex, extOf, stanceOf } from './state';

registerBondageRules();

export { registerBondageRules, afterNode } from './rules';
export { enter, leave, flee, buy, free, sell, allyFrom, ransomPrice, freeLand, heldIncomeBonus, type ExitWay } from './engine';
export { extOf, stanceOf, bondageIndex, type BondageExt, type Held, type Level } from './state';

export const bondageSystem: System = {
  name: 'bondage',
  birth(ctx) {
    const life = ctx.state.life;
    if (!life) return;
    life.ext.bondage = undefined;
    extOf(life);
    // born bound or left (10-bondage.md §5 rows 1 and 2): a life of class 1 in a country where the level is allowed, by the share of the class
    if (life.cls !== 'c1' || !ctx.data.bondage) return;
    const rng = ctx.rng('bondage.birth');
    const share = bondageIndex(ctx).data.class1.find((s) => s.stance === stanceOf(ctx, life.country));
    if (!share) return;
    // a child is not in debt (B1 needs a debt of his own): that share goes to the free born
    const i = rng.weighted([0, share.b2, share.b3, share.b1 + share.rest]);
    if (i === 1 || i === 2) enter(ctx, life, rng.chance(0.65) ? 'เกิดในพันธะ' : 'ถูกทิ้ง', (i + 1) as 2 | 3, { born: true });
  },
  lifeYear(ctx) {
    const life = ctx.state.life;
    if (!life || life.dead) return;
    lifeYear(ctx, life);
  },
};
