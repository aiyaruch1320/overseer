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
  merciful: ['GV-11', 'GV-01', 'GV-02', 'GV-06', 'GV-05'],
  shaper: ['GV-11', 'GV-10', 'GV-01', 'GV-05'],
  giver: ['GV-11', 'GV-01', 'GV-06'],
  saver: ['GV-12', 'GV-02', 'GV-01'],
  punish: ['GV-19', 'GV-07', 'GV-16'],
  seal: ['GV-19', 'GV-15', 'GV-07'],
  hasten: ['GV-19', 'GV-09', 'GV-15'],
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
    // a policy with no vow of its kind on the table takes the first it is offered, except the ones that want none
    n = want ?? (policy === 'silent' || policy === 'saver' ? t.ids.length + 1 : 1);
  }
  if (checkPick(ctx, { pick: n })) return;
  runPick(ctx, { pick: n }, (kind, id, data) => void write(ctx, { kind, id, data, level: 1 }));
}

registerPolicyPart((ctx, p) => policyVow(ctx, p), 'first');
