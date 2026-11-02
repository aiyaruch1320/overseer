// The story system (code-plan §7): walks the nodes of the main character's line by hAge, picks the way at each fork by weight and
// trait, applies it through the rules, and enters convergences. Importing this file registers the story's condition, effect and stat kinds.
import type { System } from '../game';
import { chooseEnding } from './ending';
import './rules';
import { begin, drain, yearStep } from './walk';

export { registerStoryRules } from './rules';
export { openLine, lineOfRace } from './walk';
export { chooseEnding, candidates as endingCandidates } from './ending';
export { MEMORY_LINES } from './tuning';
export type { StoryExt } from './state';

export const storySystem: System = {
  name: 'story',
  birth(ctx) {
    begin(ctx);
    yearStep(ctx);
  },
  beat(ctx) {
    drain(ctx);
  },
  lifeYear(ctx) {
    yearStep(ctx);
  },
  death(ctx) {
    // one ending, chosen now from those the life earned and the way it died (storylines/README.md §1 "ปลายทาง")
    chooseEnding(ctx);
  },
};
