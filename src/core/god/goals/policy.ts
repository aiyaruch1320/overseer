// The vows in the policies of the god (M4 review M9: no policy picked a vow, so `life` never tried the goals). A part of the life year: when a choice is open the
// policy takes the vow that fits what it is, else the first it is offered or none. Chosen with the stream `god.policy.vow`, so the other streams do not move.
import type { Ctx } from '../../game';
import { say as write } from '../acts/record';
import { registerPolicyPart, type PolicyName } from '../policy';
import { lifeGoals, living } from './state';
import { checkPick, runPick, table, tellOffer } from './vows';

/** The vows each policy would take, the best first (a policy that wants none is `[]`). Assumption: the documents name no vow for a policy; each takes what its way of playing earns. */
const WANTS: Record<PolicyName, string[]> = {
  silent: ['GV-12', 'GV-01', 'GV-02'],
  merciful: ['GV-11', 'GV-01', 'GV-02', 'GV-06', 'GV-05', 'GV-08'],
  shaper: ['GV-11', 'GV-10', 'GV-01', 'GV-05'],
  giver: ['GV-11', 'GV-01', 'GV-06'],
  // the saver keeps its light for large miracles (more than five acts a life), so GV-12 is not a vow it can keep
  saver: ['GV-02', 'GV-01', 'GV-05'],
  // a rival falls only if the life has one (about four lives in ten), so the punisher and the sealer take a long life first and the fall of a rival after it
  punish: ['GV-19', 'GV-16', 'GV-01', 'GV-07'],
  seal: ['GV-19', 'GV-15', 'GV-16', 'GV-01', 'GV-07'],
  hasten: ['GV-19', 'GV-09', 'GV-15', 'GV-01'],
  random: [],
};

export function policyVow(ctx: Ctx, policy: PolicyName): void {
  const life = living(ctx);
  if (!life) return;
  const g = lifeGoals(life);
  const t = table(ctx, life);
  if (t.phase === 'first') tellOffer(ctx, life);
  if (t.phase !== 'first' || g.decided || !t.ids.length) return;
  let n: number;
  if (policy === 'random') {
    // by an equal draw among what is offered and "none"
    n = ctx.rng('god.policy.vow').int(1, t.ids.length + 1);
  } else {
    const want = WANTS[policy].map((id) => t.ids.indexOf(id) + 1).find((i) => i > 0);
    // a policy with no vow of its kind on the table takes none (a player does not swear to what his way cannot earn)
    n = want ?? t.ids.length + 1;
  }
  if (checkPick(ctx, { pick: n })) return;
  runPick(ctx, { pick: n }, (kind, id, data) => void write(ctx, { kind, id, data, level: 1 }));
}

registerPolicyPart((ctx, p) => policyVow(ctx, p), 'first');
