// What makes a place itself: is the town on the sea, what is it known for, which festivals does the land keep.
// All deterministic from the world seed, so the same town always has the same character.
import { generateWorld } from './worldgen';
import { hashString, RNG } from './rng';
import type { Country } from './types';
import { SPECIALTIES, FESTIVALS, NPC_JOBS, type Specialty, type Festival, type NpcJob } from '../data/npclife';

const coastCache = new Map<number, boolean>();
export function isCoastTown(townId: number): boolean {
  const hit = coastCache.get(townId);
  if (hit !== undefined) return hit;
  const W = generateWorld();
  const t = W.towns[townId];
  let near = W.countries[t.countryId].climate === 'islands';
  for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = t.x + dx, y = t.y + dy;
    if (x >= 0 && y >= 0 && x < W.w && y < W.h && W.country[y * W.w + x] < 0) { near = true; break; }
  }
  coastCache.set(townId, near);
  return near;
}

const specCache = new Map<number, Specialty>();
export function townSpecialty(townId: number, co: Pick<Country, 'climate' | 'religion' | 'races'>): Specialty {
  const hit = specCache.get(townId);
  if (hit) return hit;
  const t = generateWorld().towns[townId];
  const coast = isCoastTown(townId);
  const major = co.races[0].race;
  // coastal trades need the sea; otherwise any one matching condition (climate, people, faith) is enough
  const fits = SPECIALTIES.filter((s) => {
    if (s.coast && !coast) return false;
    if (!s.climate && !s.races && !s.religion) return true;
    return !!(s.climate?.includes(co.climate) || s.races?.includes(major) || s.religion?.includes(co.religion));
  });
  const r = new RNG(hashString('spec' + townId));
  const pick = r.weighted(fits.length ? fits : SPECIALTIES.filter((s) => s.id === 'grain'), (s) => (s.capital && t.capital ? 3 : 1) * (s.coast && coast ? 3 : 1) * (s.races?.includes(major) ? 2 : 1))!;
  specCache.set(townId, pick);
  return pick;
}

// a job for an ordinary townsperson, leaning toward what the town is known for
export function pickTownJob(r: RNG, townId: number, co: Pick<Country, 'climate' | 'religion' | 'races'>, race: string): NpcJob {
  const spec = townSpecialty(townId, co);
  const coast = isCoastTown(townId);
  const pool = NPC_JOBS.filter((j) => (!j.coast || coast) && (!j.climate || j.climate.includes(co.climate) || j.races?.includes(race)) && (!j.races || j.races.includes(race) || j.climate?.includes(co.climate)));
  return r.weighted(pool, (j) => j.w * (spec.jobs.includes(j.id) ? 4 : 1))!;
}

const festCache = new Map<number, Festival[]>();
export function countryFestivals(co: Pick<Country, 'id' | 'climate' | 'religion' | 'races'>): Festival[] {
  const hit = festCache.get(co.id);
  if (hit) return hit;
  const major = co.races[0].race;
  const fits = FESTIVALS.filter((f) => f.religion?.includes(co.religion) || f.climate?.includes(co.climate) || f.races?.includes(major));
  const r = new RNG(hashString('fest' + co.id));
  const list = r.shuffle(fits.length ? fits : [FESTIVALS.find((f) => f.id === 'harvest')!]).slice(0, 2);
  festCache.set(co.id, list);
  return list;
}
