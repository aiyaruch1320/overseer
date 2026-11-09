// The menu the translator may choose from, read from the game now: the whisper hints the god holds, the places a hint can point at (the nine continents and the
// countries of the continent the character is on) and the people (the allies of the character and the living roster of his country). This is the one file of the
// layer that reads the other systems; everything else works on a `CommandMenu` it is given.
import { alliesOf, type Tie } from '../bonds';
import type { Ctx } from '../game';
import { npcsAt } from '../npc';
import { hintsOf } from '../god/acts/whisper';
import { countriesOf, countryName } from '../god/acts/geo';
import type { CommandMenu, Needs } from './command';

/** Hints that name something (god/03-dreams.md §6, the same table as `NEEDS_TARGET` in the whisper act). */
const NEEDS: Record<string, Needs> = { จงไป: 'place', คนนั้นโกหก: 'npc', ช่วย: 'npc', ชี้ทายาท: 'heir' };

/** The words a sentence uses for a person of the bonds: his line ("ครู" "เพื่อน") and his kin ("พ่อ" "แม่"). */
export function rolesOf(t: Tie): string[] {
  const out: string[] = [];
  if (t.line === 'ครู') out.push('ครู');
  if (t.line === 'สหาย' || t.line === 'คู่หู') out.push('เพื่อน');
  if (t.kin === 'father') out.push('พ่อ');
  if (t.kin === 'mother') out.push('แม่');
  return out;
}

export function commandMenu(ctx: Ctx): CommandMenu {
  const life = ctx.state.life;
  const cont = (ctx.data.continents?.items as { continents?: { id: string; name: string }[] } | undefined)?.continents ?? [];
  const places: CommandMenu['places'] = cont.map((c) => ({ id: c.id, name: c.name }));
  if (life) {
    for (const id of countriesOf(ctx, life.country.slice(0, 2))) places.push({ id, name: countryName(ctx, id) });
    // "บ้าน" is the home country of the character, whether or not he is on its continent now
    const home = places.find((p) => p.id === life.home);
    if (home) home.roles = ['บ้าน'];
    else if (life.home) places.push({ id: life.home, name: countryName(ctx, life.home), roles: ['บ้าน'] });
  }
  const people = new Map<string, { name: string; roles: string[] }>();
  if (life) {
    for (const t of alliesOf(ctx)) people.set(t.id, { name: t.name, roles: rolesOf(t) });
    for (const v of npcsAt(ctx, life.country)) if (!people.has(v.id)) people.set(v.id, { name: v.name, roles: [] });
  }
  const says = (ctx.data.god?.items as { dreams?: { whisperWords?: Record<string, string[]> } } | undefined)?.dreams?.whisperWords;
  return {
    ...(says ? { says } : {}),
    hints: hintsOf(ctx).map((hint) => ({ hint, ...(NEEDS[hint] ? { needs: NEEDS[hint] } : {}) })),
    places,
    people: [...people].map(([id, p]) => ({ id, name: p.name, ...(p.roles.length ? { roles: p.roles } : {}) })),
  };
}
