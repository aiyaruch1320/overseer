// G5 of the god (god/06-implementation.md §2): the large and grand miracles MR-17 to MR-22, the ruins of the god and their events RU-01 to RU-08, the seals,
// and the way the story nodes `mr` hang on them. Importing this file registers the miracles and the layers; `godActsSystem` calls the steps below.
import type { Ctx } from '../../game';
import { onWorldPhase } from '../../world';
import { gd08Step } from './gd08';
import { ruinStep } from './events';
import { hauntBorn } from './born';
import { syncReach } from './reach';
import './grand';
import './seal';

onWorldPhase('afterDrift', gd08Step);

/** A beat of the living character: the events that are due, then what the story may be told. */
export function ruinBeat(ctx: Ctx): void {
  ruinStep(ctx);
  syncReach(ctx);
}

/** A world step with no character beating: the same events happen. */
export function ruinWorldStep(ctx: Ctx): void {
  ruinStep(ctx);
  syncReach(ctx);
}

/** A character is born: he has heard of nothing yet but what happened in his life; one born in a ruin may carry its curse. */
export function ruinBirth(ctx: Ctx): void {
  syncReach(ctx);
  hauntBorn(ctx);
}

export { sealAt, sealCountries, homesOf, replyFor, sealedMid, wrathOnSeals } from './seal';
export { makeRuin, isRuin, isRainy, wOverride, ruinFacts, eventsOf, localEventsOf, pointsIn } from './ruin';
export { ruinStep, ruinsNow, cultsNow, bringDue } from './events';
export { acceptors, npcsIn, leadersOf } from './people';
export { noteBig, gd08Step } from './gd08';
export { syncReach } from './reach';
export { ruinExt, viewRuin, ruinAt, crackAt, type RuinExt, type RuinRec, type CrackRec, type LandRec, type SealReply } from './state';
