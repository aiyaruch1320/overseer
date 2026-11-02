// Text system (docs/systems/llm/03-naming.md, 09-library.md, 06-god-templates.md, 07-ending-templates.md; code-plan §7 row "text").
// - the registry of names the world remembers (`state.world.names`), no name twice in a world
// - the main character gets a name in the `birth` hook, from the voice of the people and the land
// - the birth in four lines (docs/systems/experience/01-one-life.md §2 ข้อ 1 2): who, family, the traits that show, the question of the life
// - `pickText`: library lines (tier 1) before templates (tier 0), not twice in a life, every slot filled
// - `describe` / `lines`: log entries as readable Thai, for `npm run life`, `npm run play` and the debug page
import type { System } from '../game';
import { write } from '../log';
import { classLabel, calendarYear, placeName, raceName } from './pick';
import { labels } from './labels';
import { nameCharacter, peopleCode, registerName } from './names';
import { questionOf } from './render';

/** Traits shown at birth: the ones the character system put first. */
const TRAITS_SHOWN = 3;

export const textSystem: System = {
  name: 'text',
  birth(ctx) {
    const life = ctx.state.life;
    if (!life) return;
    life.name = life.name ? registerName(ctx, `char:${life.id}`, life.name) : nameCharacter(ctx, life);
    // lines shown to this life; a new life may see them again
    life.ext.text = { used: [] };
    const L = labels(ctx.data);
    // what the character system wrote at birth: how the parents met, the sign, the special birth
    const born = [...ctx.state.log].reverse().find((e) => e.sys === 'character' && e.kind === 'birth' && e.age !== undefined);
    const bd = born?.data ?? {};
    const ext = (life.ext.character ?? {}) as { meet?: string };
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
        year: calendarYear(ctx.state.clock.worldYear).toLocaleString('en-US'),
        country: life.country,
      },
    });
    write(ctx.state, {
      sys: 'text',
      kind: 'family',
      id: life.id,
      level: 1,
      data: {
        name: life.name,
        gender: life.gender,
        cls: life.cls,
        born: (bd.born as string | undefined) ?? null,
        second: (bd.second as string | undefined) ?? null,
        meet: ext.meet ?? null,
        special: (bd.special as string | undefined) ?? null,
        sign: (bd.sign as string | undefined) ?? null,
      },
    });
    const traits = life.traits.slice(0, TRAITS_SHOWN).map((t) => L.kind.trait.get(t)).filter((t): t is string => !!t);
    if (traits.length) write(ctx.state, { sys: 'text', kind: 'traits', id: life.id, level: 1, data: { traits: traits.join(',') } });
    const question = questionOf(ctx.data, peopleCode(ctx, life.race));
    if (question) write(ctx.state, { sys: 'text', kind: 'question', id: life.id, level: 1, data: { question } });
  },
};

export * from './names';
export * from './pick';
export * from './plain';
export * from './render';
