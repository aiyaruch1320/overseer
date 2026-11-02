// Choosing where a trip goes: every country other than the one the character is in, weighted by what the cause wants (a big city for a student, a war for
// a sword for hire, a safe place for a refugee, a stranger's land for the guest); the whisper "จงไป" of the god weighs a place ×1.5. The first
// candidate that survives the four filters (reachable) is the destination.
import type { Ctx } from '../game';
import type { Rng } from '../rng';
import type { CountryId, LifeState } from '../types';
import { travelMul } from '../god/acts';
import { flagsOf, peopleOf } from './access';
import { geo, type CountryInfo } from './data';
import { reachable } from './trip';
import { HOLY_PLACES } from './tuning';

const TRIES = 6;

function weightOf(ctx: Ctx, life: LifeState, cause: string, c: CountryInfo, near: boolean): number {
  const flags = flagsOf(ctx, c.id);
  if (flags.includes('fallen')) return 0;
  const size = Math.max(1, c.scale);
  let w = Math.pow(size, 1.5);
  switch (cause) {
    case 'sc':
    case 'tr':
      w = size * size;
      break;
    case 'ps':
      w = HOLY_PLACES.includes(c.id) ? (near === (c.continent === life.country.slice(0, 2)) ? 3 : 1) : 0;
      break;
    case 'ml':
      w *= (flags.includes('war') ? 6 : 1) * (['frequent', 'total'].includes(c.war) ? 3 : c.war === 'feud' ? 2 : 1);
      break;
    case 'ex':
      w *= flags.some((f) => ['war', 'famine', 'plague'].includes(f)) ? 0.2 : 4;
      break;
    case 'xc': {
      const mine = peopleOf(ctx, life);
      w *= c.first && c.first !== mine ? 3 : 0.2;
      break;
    }
    case 'exile':
      w = (['lawless', 'none'].includes(c.justice) ? 3 : 1) * (6 - Math.min(size, 5));
      break;
  }
  return w * travelMul(ctx, c.id);
}

/**
 * A destination that is reachable, or undefined. `near` keeps to the continent the character is in; otherwise to the others. A pilgrim's near/far
 * is whether the holy place is on the same continent.
 */
export function pickDestination(ctx: Ctx, life: LifeState, cause: string, near: boolean, rng: Rng = ctx.rng('life.travel.dest')): CountryId | undefined {
  const g = geo(ctx);
  const here = life.country;
  const cont = here.slice(0, 2);
  const list = g.list.filter((c) => c.id !== here && (cause === 'ps' ? true : near ? c.continent === cont : c.continent !== cont));
  const ws = list.map((c) => weightOf(ctx, life, cause, c, near));
  const smuggle = cause === 'ex' || cause === 'exile';
  for (let i = 0; i < TRIES; i++) {
    const k = rng.weighted(ws);
    if (k < 0) return undefined;
    if (reachable(ctx, life, list[k].id, { smuggle })) return list[k].id;
    ws[k] = 0;
  }
  return undefined;
}
