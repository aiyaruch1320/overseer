// The character system (docs/systems/character/, code-plan §7 row "character"):
// birth, the rules of the character in the effect grammar, jobs and secret jobs, and death.
// Importing this module registers its rules (src/core/rules). The extras that LifeState has no field for live in `life.ext.character`.
import type { System } from '../game';
import { yearlyDeath } from './death';
import { ensureJob, growJob, maybeChangeJob, rollSecretJobs } from './jobs';
import { registerCharacterRules } from './rules';
import { ADULT_AGE } from './tuning';
import { lateWish, wishChildYear } from './wish-apply';

registerCharacterRules();

export { birth, type BirthOpts } from './birth';
export { chooseJob, contractWork, ensureJob, grantJob, offerJobs, rollSecretJobs, secretChance, ineligible, evalCond, jobWeight } from './jobs';
export { die, yearlyDeath } from './death';
export { extOf, idx, classNum, classId, type CharacterExt } from './data';
export { holds, onTags, tagsOf, giveId, takeId, trustOf, recomputeDeathAge, setClass, boundLevel, boundBan } from './life';
export { registerCharacterRules } from './rules';
export { readWish, normalize, fieldLabel, chipValues, handFields, sheetParts, HAND_FIELDS, START_MODE_IDS, STORY_IDS } from './wish';
export type { WishAsk, WishSheet, WishRead, WishInput, SheetItem, Segment, Row, Understood, FatePoints, WishKind, StoryId } from './wish';
export { wishOf } from './wish-apply';

export const characterSystem: System = {
  name: 'character',
  /** The first beat of a life that was ordered: the parts of the wish that need the births of the other systems (the family of the infant, the story lines). */
  beat(ctx) {
    const life = ctx.state.life;
    if (life && !life.dead && life.ext.character && (life.ext.character as { wish?: unknown; wishLate?: boolean }).wish) for (const fn of lateWish) fn(ctx, life);
  },
  /** One life year, after the age went up (game/ calls this once the fourth beat is done). */
  lifeYear(ctx) {
    const life = ctx.state.life;
    if (!life || life.dead) return;
    if (yearlyDeath(ctx, life)) return;
    wishChildYear(ctx, life);
    if (life.hAge < ADULT_AGE) return;
    ensureJob(ctx, life);
    growJob(ctx, life);
    maybeChangeJob(ctx, life);
    rollSecretJobs(ctx, life);
  },
};
