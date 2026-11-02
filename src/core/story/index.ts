// The story system (code-plan §7): walks the nodes of the main character's line by hAge, picks the way at each fork by weight and
// trait, applies it through the rules, and enters convergences. Importing this file registers the story's condition, effect and stat kinds.
import type { System } from '../game';
import { write } from '../log';
import { test } from '../rules';
import { indexOf } from './data';
import './rules';
import { extOf } from './state';
import { begin, drain, yearStep } from './walk';

export { registerStoryRules } from './rules';
export { openLine, lineOfRace } from './walk';
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
    // the endings of the lines the life walked whose condition holds (storylines/README.md §1 "ปลายทาง"); the ending system picks one
    const life = ctx.state.life;
    if (!life) return;
    const ex = extOf(life);
    const ix = indexOf(ctx);
    const lines = new Set([ex.line, ...Object.keys(ex.open).filter((l) => ex.open[l])]);
    for (const e of ix.endings) {
      if (!lines.has(e.line) || !e.cond || ex.endings.includes(e.title) || !test(ctx, e.cond)) continue;
      ex.endings.push(e.title);
      write(ctx.state, { sys: 'story', kind: 'ending', id: e.title, data: { line: e.line }, level: 1 });
    }
  },
};

