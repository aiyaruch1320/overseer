// The acts of the god, G3 to G5 (god/06-implementation.md §2): whispers, prayers, the small and mid miracles, the dragon pair and the
// fate; the large and grand miracles, the ruins and the seals are in ../ruin. `godActsSystem` raises the prayers every beat, brings the omens of the miracles due, ends the flags and modifiers whose time is over,
// and keeps GD-04 and GD-05 open for the world when the god's deeds say so. The commands `whisper` `prayer.answer` `miracle` `decree`
// are registered with the command layer when this module is imported.
import { hasAction, onAction } from '../../command';
import type { Ctx, System } from '../../game';
import { onWorldPhase, openByGod } from '../../world';
import { policyName, registerPolicyPart } from '../policy';
import { checkMiracle, miracleBeat, overdueOmens, previewMiracle, runMiracle } from './miracles';
import { actsPolicyStep } from './policy';
import { checkAnswer, previewAnswer, prayerBeat, runAnswer } from './prayers';
import { checkWhisper, previewWhisper, runWhisper } from './whisper';
import { expire } from './mods';
import { actsOf, yearOf } from './state';
import { SILENCE } from './tuning';
import './set';
import './fate';
import { ruinBeat, ruinBirth, ruinWorldStep } from '../ruin';

/** Has the god let the prayers go unanswered for decades (GD-05, god/04 and world-events.md)? */
export function silent(ctx: Ctx): boolean {
  const a = ctx.state.god.ext.acts ? actsOf(ctx.state) : undefined;
  if (!a) return false;
  const y = yearOf(ctx);
  return y - a.lastAnswer > SILENCE.years && a.lapsed.filter((x) => y - x <= SILENCE.years).length >= SILENCE.lapsed;
}

// the world's own gate: GD-04 and GD-05 open only through the god (world/tuning.ts `godOnly`); the god's deeds are what opens them here
onWorldPhase('afterDrift', (ctx) => {
  if ((ctx.state.world.vars.F ?? 0) > 90) openByGod(ctx, 'GD-04'); // "ศรัทธาโลก > 90"
  if (silent(ctx)) openByGod(ctx, 'GD-05');
});

// The policies of the god (06-implementation.md §4): the prayers and whispers join the policy step of the god system, which plays a life year once;
// the deeds on the dragons and the events are the world's and play at every world step, for the policy named in `god.ext.policy`.
registerPolicyPart((ctx, p) => actsPolicyStep(ctx, p, 'prayers'), 'first');
registerPolicyPart((ctx, p) => actsPolicyStep(ctx, p, 'whispers'), 'last');
onWorldPhase('afterDrift', (ctx) => {
  const policy = ctx.state.god.ext.policy;
  if (typeof policy === 'string' && policyName(policy)) actsPolicyStep(ctx, policy, 'world');
});

/** The omens that are still pending happen when the character dies: the god has paid. */
function flush(ctx: Ctx): void {
  const a = actsOf(ctx.state);
  for (const p of a.pending) p.left = 1;
  miracleBeat(ctx);
}

export const godActsSystem: System = {
  name: 'god.acts',
  birth(ctx) {
    const a = actsOf(ctx.state);
    ctx.state.god.prayers = [];
    a.recent = {};
    a.seen = [];
    a.gone = {};
    a.whisper = { age: -1, used: [], sent: {}, active: [] };
    ruinBirth(ctx);
  },
  beat(ctx) {
    expire(ctx);
    prayerBeat(ctx);
    miracleBeat(ctx);
    ruinBeat(ctx);
  },
  worldStep(ctx) {
    expire(ctx);
    overdueOmens(ctx);
    ruinWorldStep(ctx);
  },
  death(ctx) {
    flush(ctx);
    ctx.state.god.prayers = [];
  },
};

if (!hasAction('whisper')) onAction('whisper', { check: checkWhisper, preview: previewWhisper, run: runWhisper });
if (!hasAction('prayer.answer')) onAction('prayer.answer', { check: checkAnswer, preview: previewAnswer, run: runAnswer });
if (!hasAction('miracle')) onAction('miracle', { check: checkMiracle, preview: previewMiracle, run: runMiracle });
// "ลิขิต": bends the weight of a world event that shows an omen (MR-25). `decree` is the command, `miracle` with id MR-25 does the same
const asFate = (args: Record<string, unknown>) => ({ ...args, id: 'MR-25' });
if (!hasAction('decree')) onAction('decree', { check: (c, a) => checkMiracle(c, asFate(a)), preview: (c, a) => previewMiracle(c, asFate(a)), run: (c, a) => runMiracle(c, asFate(a)) });

export { actsPolicyStep, POLICY_NAMES, type ActsPhase, type PolicyName } from './policy';
export { fateTargets, fateCost } from './fate';
export { registerMiracle, implemented as implementedMiracles, handlerOf, miracleOf, omenQuarters, type Handler, type Outcome } from './miracles';
export { cardsOf, kindOf, holdsKind, raisable, raiseChance, strangeOptions, nameOfKind, answerOf, grantPrice } from './prayers';
export { activeWhispers, choiceWhisperMul, decisionMade, travelMul, moveMul, weakStanceMul, battleDone, whisperBonus, pointedHeir, pointedThread, obeyChance, whisperPrice, hintsOf } from './whisper';
export { activeMods, modMul, modAdd, setFlag, clearFlag, faithAt } from './mods';
export { applyFx } from './fx';
export { actsOf, type ActsExt, type PrayerCard } from './state';
export * from '../ruin';
