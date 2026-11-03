// The conjuring in the policies of the god (M4 review M9: no policy conjured, so `life` never tried it). A part of the life year: from age 20, every fifth year, a policy
// that spends tries the mixes of its kind in order and does the first the command layer allows (the caps, the waits and the price are the layer's). The draw is on the
// stream `god.policy.conjure`, so the other streams do not move.
import type { Ctx } from '../../game';
import { neighboursOf } from '../acts/geo';
import { livingOf } from '../acts/state';
import { sealAt } from '../ruin';
import { dreadReserve, registerPolicyPart, type PolicyName } from '../policy';
import { checkConjure, previewConjure, runConjure } from './run';

interface Try {
  verb: string;
  core: string;
  scale: 'person' | 'place' | 'country';
  /** The mix falls on a neighbour of the character's country (a deed of ruin), else on his own. */
  away?: boolean;
}

/** The mixes of each policy, the first that works is made. They are all of the first life's circle (create destroy calm · fire water earth life); assumption, the documents name none. */
const MIXES: Partial<Record<PolicyName, Try[]>> = {
  merciful: [{ verb: 'calm', core: 'fire', scale: 'country' }, { verb: 'create', core: 'life', scale: 'place' }, { verb: 'create', core: 'water', scale: 'country' }],
  shaper: [{ verb: 'create', core: 'earth', scale: 'place' }, { verb: 'calm', core: 'water', scale: 'place' }],
  giver: [{ verb: 'create', core: 'life', scale: 'place' }, { verb: 'create', core: 'fire', scale: 'country' }],
  punish: [{ verb: 'destroy', core: 'fire', scale: 'place', away: true }, { verb: 'destroy', core: 'water', scale: 'place', away: true }],
  seal: [{ verb: 'destroy', core: 'earth', scale: 'place', away: true }],
  hasten: [{ verb: 'destroy', core: 'fire', scale: 'country', away: true }, { verb: 'destroy', core: 'water', scale: 'place', away: true }],
  // the god who keeps his light has the light for the dearest thing it buys
  saver: [{ verb: 'create', core: 'life', scale: 'place' }, { verb: 'calm', core: 'fire', scale: 'country' }, { verb: 'create', core: 'water', scale: 'country' }],
  random: [
    { verb: 'create', core: 'fire', scale: 'country' },
    { verb: 'calm', core: 'earth', scale: 'place' },
    { verb: 'create', core: 'life', scale: 'place' },
    { verb: 'destroy', core: 'water', scale: 'place', away: true },
  ],
};

/** The first year and the spacing of a try. */
const FROM = 20;
const EVERY = 5;
export function policyConjure(ctx: Ctx, policy: PolicyName): void {
  const life = livingOf(ctx);
  const list = MIXES[policy];
  if (!life || !list || life.hAge < FROM || (life.hAge - FROM) % EVERY !== 0) return;
  const order = list;
  const rng = ctx.rng('god.policy.conjure');
  const start = policy === 'random' ? rng.int(0, order.length - 1) : 0;
  for (let k = 0; k < order.length; k++) {
    const t = order[(start + k) % order.length];
    const country = t.away ? neighboursOf(ctx, life.country).find((c) => !sealAt(ctx, c)) : life.country;
    if (!country) continue;
    const args = { verb: t.verb, core: t.core, scale: t.scale, country };
    if (checkConjure(ctx, args)) continue;
    // the dread a policy keeps back for a deed of the world (a ruin, a blow on a seal) is not spent on a conjuring
    const keep = dreadReserve(ctx, policy);
    if (keep && ctx.state.god.dread - ((previewConjure(ctx, args).cost as { dread?: number } | undefined)?.dread ?? 0) < keep) continue;
    runConjure(ctx, args);
    return;
  }
}

registerPolicyPart((ctx, p) => policyConjure(ctx, p), 'last');
