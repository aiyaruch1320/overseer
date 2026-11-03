// A stand-in main character for the test tools while the real character system is not in the build:
// it places a plain LifeState and lets it die of old age. It is not game content and nothing in src/ imports it.
// Pure TypeScript (no node modules) so the debug page can use it too.
import { dataOf, type Ctx, type System } from '../../src/core/game';
import type { Country, NpcsFile } from '../../src/core/data/types-npcs';
import type { LifeState } from '../../src/core/types';

export interface BirthRequest {
  /** Race id (`human`) or story prefix (`hu`). */
  race?: string;
  /** Country id (`AL-01`); drawn when missing. */
  country?: string;
  /** The wish sheet of the player (`readWish`), for the character system's birth; the toy ignores it. */
  wish?: import('../../src/core/character').WishSheet;
}

interface RaceRow {
  id: string;
  storyPrefix: string;
  name: string;
}

export function resolveRace(ctx: Ctx, race: string | undefined): RaceRow {
  const races = dataOf<{ races: RaceRow[] }>(ctx, 'races').races;
  const hit = races.find((r) => r.id === race || r.storyPrefix === race);
  return hit ?? races[0];
}

/** A country where the people live: the country files name the peoples in a free text field, so match on the race name and fall back to any. */
function pickCountry(ctx: Ctx, race: RaceRow): string {
  const countries = dataOf<Country[]>(ctx, 'countries');
  const rng = ctx.rng('life.toy');
  const home = countries.filter((c) => c.races.includes(race.name));
  return rng.pick(home.length ? home : countries).id;
}

export function toyLife(ctx: Ctx, req: BirthRequest = {}): LifeState {
  const race = resolveRace(ctx, req.race);
  const rng = ctx.rng('life.toy');
  const country = req.country ?? pickCountry(ctx, race);
  const npcs = dataOf<NpcsFile>(ctx, 'npcs');
  const span = npcs.rules.lives.find((l) => l.id === race.storyPrefix);
  const lifespan = span ? Math.round(span.lifeLo + rng.next() * (span.lifeHi - span.lifeLo)) : 75;
  const life: LifeState = {
    id: `L${ctx.state.lineage.lives.length + 1}`,
    name: '',
    race: race.id,
    gender: rng.chance(0.5) ? 'm' : 'f',
    birthYear: ctx.state.clock.worldYear,
    lifespan,
    hAge: 0,
    country,
    home: country,
    traits: [],
    aptitudes: {},
    skills: [],
    blessings: [],
    curses: [],
    fate: [],
    cls: 'c3',
    gold: 0,
    stats: { pow: 8, mag: 8, spd: 8, luk: 8, int: 8, vit: 8 },
    items: [],
    flags: [],
    passed: {},
    pending: [],
    memory: [],
    godFaith: 0,
    heart: 0,
    ext: {},
  };
  return life;
}

/** Places the toy life and runs the birth hooks. */
export function bearToy(ctx: Ctx, req: BirthRequest = {}): LifeState {
  const life = toyLife(ctx, req);
  ctx.state.life = life;
  return life;
}

/** Death of old age: from life year 55 the chance grows each year, certain at 80. */
export const toyDeath: System = {
  name: 'toylife',
  lifeYear(ctx) {
    const life = ctx.state.life;
    if (!life || life.dead) return;
    const p = life.hAge >= 80 ? 1 : life.hAge < 55 ? 0 : 0.03 + (life.hAge - 55) * 0.012;
    if (p > 0 && ctx.rng('life.toy').chance(p)) life.dead = { year: ctx.state.clock.worldYear, hAge: life.hAge, cause: 'ชราภาพ' };
  },
};
