// Is a country at war? (the one question the encounter, the cap of the year and the war battle all ask; kept apart so that they need not import each other)
import type { Ctx } from '../game';

/**
 * Is the country at war now? The flag `war` of the world, unless its timer has run out: the world system puts a timer (`chains['warflag:<country>']`,
 * `warFlagYears` after the event) on the flag it sets, but nothing takes the flag off when the timer ends, so a country stayed at war for the rest of the
 * world (a soldier fought "the same battle" from 19 to 72, M3 review C2). A flag with no timer (the god's hand) stands.
 */
export function warOn(ctx: Ctx, country: string): boolean {
  const w = ctx.state.world;
  if (!(w.countryFlags[country] ?? []).includes('war')) return false;
  const until = w.chains['warflag:' + country];
  return until === undefined || until > ctx.state.clock.worldYear;
}
