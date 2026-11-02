// The bond system (docs/systems/bonds/, code-plan §7 row "bonds"): the people the character is tied to, nine lines of five levels, 24 moods,
// where they come from, the invitations, their stories in five stages, the family, the paired items, the written allies and their successors.
// Importing this module registers its rules (src/core/rules). The state is `life.ext.bonds` (state.ts); screens read the log (`sys: 'bonds'`).
import type { System } from '../game';
import { write } from '../log';
import { decideCrises, expireNudges } from './arcs';
import { birthKin } from './family';
import { registerBondsRules } from './rules';
import { extOf, isLive, levelOf, reindex, tiesOf } from './state';
import { lifeYear } from './year';

registerBondsRules();

export { registerBondsRules, focusTie } from './rules';
export { inviteChance, invite, partyEffects, loverEligible, joinParty, type InviteKind } from './invites';
export { showMood, moodsOf, fitMood } from './moods';
export { addChild, birthKin, closeKin } from './family';
export { meet, addNpcTie, hasRoom } from './sources';
export { grantPair, fullPair, statusOf } from './items';
export { startArc, pickTemplate, crisisAnswer, endingKind, decideCrises } from './arcs';
export { alliesOf, findAlly, crisesWaiting, crisisOf, nudgeCrisis, type NudgeKind, type Waiting } from './allies';
export { addTie, changeB, setB, setLine, endTie, hAgeOf, addGratitude, isPartner, isChild } from './people';
export { freeTie } from './year';
export { extOf, tiesOf, levelOf, closeTies, looseTies, isLive, type BondsExt, type Tie, type ArcState, type PendingCrisis } from './state';
export { bondsIndex, lineName } from './data';

export const bondsSystem: System = {
  name: 'bonds',
  birth(ctx) {
    const life = ctx.state.life;
    if (!life) return;
    life.ext.bonds = undefined;
    extOf(life);
    birthKin(ctx, life);
    reindex(extOf(life));
  },
  beat(ctx) {
    const life = ctx.state.life;
    if (!life || life.dead) return;
    // the crisis the player was called for is answered the beat after the call (arcs.ts)
    decideCrises(ctx, life);
  },
  lifeYear(ctx) {
    const life = ctx.state.life;
    if (!life || life.dead) return;
    expireNudges(extOf(life), life);
    lifeYear(ctx, life);
  },
  death(ctx) {
    const life = ctx.state.life;
    if (!life) return;
    const e = extOf(life);
    // the stories that are not finished are open threads for the heir, three at most (bonds/01 §5, heirs/03)
    const cap = ctx.data.bonds ? (ctx.data.bonds.items as { ties: { heirOpenThreadCap: number } }).ties.heirOpenThreadCap : 3;
    const open = tiesOf(e)
      .filter((t) => isLive(t) && t.arc && !t.arc.end && t.arc.stage >= 2 && t.arc.stage < 5 && levelOf(ctx, t) >= 3)
      .sort((a, b) => b.b - a.b)
      .slice(0, cap);
    for (const t of open) write(ctx.state, { sys: 'bonds', kind: 'thread', id: t.id, data: { name: t.name, line: t.line, code: t.arc!.code, stage: t.arc!.stage }, level: 1 });
    e.threads = open.map((t) => t.id);
    // a crisis not answered when the character dies is not answered
    e.crises = [];
    e.nudges = {};
  },
};
