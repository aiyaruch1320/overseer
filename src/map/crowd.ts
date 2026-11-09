// The people of a town on the map: a handful of looks of the races that live in the country (the races of its named NPCs, or human when it has none),
// at every age and both sexes, that the crowd of the town repeats. Pure data to looks; the painting is the scene's (src/art/phaser.ts).
import type { Country } from '../core/data/types-npcs';
import type { LooksData } from '../core/data/types-looks';
import type { GameData } from '../core/game';
import type { PersonLook, Stage } from '../art/look';
import { raceLook } from '../art/resolve';

const STAGES: Stage[] = ['adult', 'adult', 'teen', 'adult', 'child', 'elder', 'adult', 'adult', 'child', 'elder', 'adult', 'teen'];

export function crowdOf(data: GameData): (countryId: string) => PersonLook[] {
  const looks = (data.looks?.items as LooksData | undefined) ?? null;
  const countries = new Map(((data.countries?.items as Country[] | undefined) ?? []).map((c) => [c.id, c]));
  const cache = new Map<string, PersonLook[]>();
  return (id) => {
    if (!looks) return [];
    let list = cache.get(id);
    if (list) return list;
    const races = [...new Set((countries.get(id)?.npcs ?? []).map((n) => looks.npcs[n]?.race).filter((r): r is string => !!r && !!looks.races[r]))];
    if (!races.length) races.push('human');
    list = [];
    STAGES.forEach((stage, i) => {
      try {
        list!.push(raceLook(looks, races[i % races.length], { stage, fem: i % 2 === 1, seed: `${id}:${i}` }));
      } catch {
        /* a race the looks do not know is left out */
      }
    });
    cache.set(id, list);
    return list;
  };
}
