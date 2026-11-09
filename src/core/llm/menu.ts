// The menu the translator may choose from, read from the game now: the whisper hints the god holds, the places a hint can point at (the nine continents and the
// countries of the continent the character is on) and the people (the allies of the character and the living roster of his country). This is the one file of the
// layer that reads the other systems; everything else works on a `CommandMenu` it is given.
import { alliesOf } from '../bonds';
import type { Ctx } from '../game';
import { npcsAt } from '../npc';
import { hintsOf } from '../god/acts/whisper';
import { countriesOf, countryName } from '../god/acts/geo';
import type { CommandMenu, Needs } from './command';

/** Hints that name something (god/03-dreams.md §6, the same table as `NEEDS_TARGET` in the whisper act). */
const NEEDS: Record<string, Needs> = { จงไป: 'place', คนนั้นโกหก: 'npc', ช่วย: 'npc', ชี้ทายาท: 'heir' };

export function commandMenu(ctx: Ctx): CommandMenu {
  const life = ctx.state.life;
  const cont = (ctx.data.continents?.items as { continents?: { id: string; name: string }[] } | undefined)?.continents ?? [];
  const places = cont.map((c) => ({ id: c.id, name: c.name }));
  if (life) for (const id of countriesOf(ctx, life.country.slice(0, 2))) places.push({ id, name: countryName(ctx, id) });
  const people = new Map<string, string>();
  if (life) {
    for (const t of alliesOf(ctx)) people.set(t.id, t.name);
    for (const v of npcsAt(ctx, life.country)) if (!people.has(v.id)) people.set(v.id, v.name);
  }
  const says = (ctx.data.god?.items as { dreams?: { whisperWords?: Record<string, string[]> } } | undefined)?.dreams?.whisperWords;
  return {
    ...(says ? { says } : {}),
    hints: hintsOf(ctx).map((hint) => ({ hint, ...(NEEDS[hint] ? { needs: NEEDS[hint] } : {}) })),
    places,
    people: [...people].map(([id, name]) => ({ id, name })),
  };
}
