// Text system (docs/systems/llm/03-naming.md, 09-library.md, 06-god-templates.md, 07-ending-templates.md; code-plan §7 row "text").
// - the registry of names the world remembers (`state.world.names`), no name twice in a world
// - the main character gets a name in the `birth` hook, from the voice of the people and the land
// - `pickText`: library lines (tier 1) before templates (tier 0), not twice in a life, every slot filled
// - `describe` / `lines`: log entries as readable Thai, for `npm run life`, `npm run play` and the debug page
import type { System } from '../game';
import { write } from '../log';
import { classLabel, calendarYear, placeName, raceName } from './pick';
import { nameCharacter, registerName } from './names';

export const textSystem: System = {
  name: 'text',
  birth(ctx) {
    const life = ctx.state.life;
    if (!life) return;
    life.name = life.name ? registerName(ctx, `char:${life.id}`, life.name) : nameCharacter(ctx, life);
    // lines shown to this life; a new life may see them again
    life.ext.text = { used: [] };
    write(ctx.state, {
      sys: 'text',
      kind: 'named',
      id: life.id,
      level: 1,
      data: {
        name: life.name,
        race: raceName(ctx, life.race),
        home: placeName(ctx, life.home) ?? life.home,
        cls: classLabel(ctx, life.cls),
        year: calendarYear(ctx.state.clock.worldYear),
      },
    });
  },
};

export * from './names';
export * from './pick';
export * from './render';
