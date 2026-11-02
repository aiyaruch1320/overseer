// The god system (docs/systems/god/, code-plan §7 row "god"), steps G0 to G2: the powers and their prices and income, the bestowal chest,
// and dreams. Whispers, prayers and miracles are in acts/ and join through `registerPolicyPart` and the commands of `command/`.
// Importing this module registers the commands of the chest and the dream and the numbers `god.light` `god.dread`.
//
// Hooks: init gives the start power · birth clears the counters of a life · lifeYear brings the income, lets old feelings fade, settles the dreams and
// plays the policy named in `state.god.ext.policy` (the test tools put it there) · death keeps half of both powers for the heir.
import { write } from '../log';
import type { Ctx, System } from '../game';
import { onStat } from '../rules';
import { registerGodActions } from './actions';
import { fade } from './belief';
import { currentChest } from './chest';
import { settleDreams } from './dream';
import { earn, incomeOf, startPower } from './power';
import { policyStep } from './policy';
import { birthMark, bump, clearCounters, count, godData, gx, scanWindow, touch } from './state';
import { POWER_CAP } from './tuning';

registerGodActions();
registerGodRules();

export * from './power';
export * from './belief';
export { chestLimit, chestsLeft, currentChest, openChest, pickSlot, rerollChest, skipChest, checkOpen, checkPick, checkReroll, slotPrice, tierChances, compOf, effectsOf, type Chest, type ChestSlot } from './chest';
export { pathsNow, offersNow, offerCards, obeyChance, dreamWeight, dreamsOf, sendDream, checkDream, previewDream, settleDreams, armDreams, resolveDream, answerQuestion, questionsOpen, dreamPrice, type DreamPath, type Obey } from './dream';
export { policyStep, policyName, registerPolicyPart, clearPolicyParts, type PolicyName, type PolicyPart } from './policy';
export { registerGodActions } from './actions';
export { bump, count, gx, godData, inWindow, windowNodes, touch, ageStops, type Dream, type GodExt } from './state';
export { upcomingNodes } from './story-view';

/** Numbers the grammar can compare and change: `god.light` `god.dread` (and the Thai names the documents use). */
export function registerGodRules(force = false): void {
  const stat = (key: 'light' | 'dread') => ({
    read: (ctx: Ctx) => ctx.state.god[key],
    add: (ctx: Ctx, _n: string, delta: number) => {
      ctx.state.god[key] = Math.max(0, Math.min(POWER_CAP, ctx.state.god[key] + delta));
    },
  });
  for (const [name, key] of [['god.light', 'light'], ['god.dread', 'dread'], ['แสงศรัทธา', 'light'], ['ความหวาดกลัว', 'dread']] as const) {
    try {
      onStat(name, stat(key));
    } catch (err) {
      if (!force) throw err;
    }
  }
}

export const godSystem: System = {
  name: 'god',

  init(ctx) {
    startPower(ctx);
  },

  birth(ctx) {
    clearCounters(ctx, 'l.');
    clearCounters(ctx, 'y.');
    const e = gx(ctx);
    e.quiet = 0;
    e.lastLine = null;
    e.punishedAge = null;
    e.willFails = 0;
    e.questions = [];
    e.history = [];
    e.answered = 0;
    delete e.weapon;
    e.window = null;
    // an heir feels about the god 60% of what the parent felt (01-power.md §6)
    if (e.heirBelief !== undefined && ctx.state.life) {
      ctx.state.life.godFaith = e.heirBelief;
      delete e.heirBelief;
    }
    ctx.state.god.chest = null;
    ctx.state.god.dreams = [];
    startPower(ctx);
    // the nodes the story played at birth are in the log already: read them as the window of the first year
    e.scan = birthMark(ctx);
    scanWindow(ctx);
  },

  lifeYear(ctx) {
    const life = ctx.state.life;
    if (!life || life.dead || !ctx.data.god) return;
    clearCounters(ctx, 'y.');
    scanWindow(ctx);
    const e = gx(ctx);
    const inc = incomeOf(ctx);
    earn(ctx, { faith: inc.faith, dread: inc.dread }, 'income');
    write(ctx.state, { sys: 'god', kind: 'income', data: { faith: round(inc.faith), dread: round(inc.dread), light: round(ctx.state.god.light), fear: round(ctx.state.god.dread), belief: round(life.godFaith) }, level: 0 });
    // feelings fade after ten quiet life years (01-power.md §3 last row)
    e.quiet += 1;
    if (e.quiet > godData(ctx).belief.fade.quietYears) fade(ctx);
    settleDreams(ctx);
    const policy = ctx.state.god.ext.policy;
    if (typeof policy === 'string') policyStep(ctx, policy);
    if (currentChest(ctx)) ctx.state.god.chest = null;
  },

  death(ctx) {
    const g = ctx.state.god;
    const h = ctx.data.god ? godData(ctx).heirs : undefined;
    g.chest = null;
    g.dreams = [];
    const dead = ctx.state.life;
    if (h && dead) gx(ctx).heirBelief = Math.round(dead.godFaith * h.beliefShare * 100) / 100;
    if (h) {
      // the heir takes half of both powers (01-power.md §6)
      g.light = Math.round(g.light * h.powerShare * 100) / 100;
      g.dread = Math.round(g.dread * h.powerShare * 100) / 100;
    }
    touch(ctx);
    bump(ctx, 'lives');
  },
};

const round = (x: number) => Math.round(x * 100) / 100;

