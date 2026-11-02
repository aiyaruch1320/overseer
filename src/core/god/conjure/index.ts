// Conjuring (docs/systems/god/07-conjure.md, step G5b of god/06-implementation.md): the player builds a miracle from a verb, a core and a size; the result comes from the
// table of the game (48 cells), the reactions with the state of the place, and the shadow it casts. A combination that is a listed miracle is that miracle and uses no quota.
// The command is `conjure { verb, core, scale, country | continent | npc }` (the ids or the Thai names), `conjure { cancel: n }` takes an omen back.
//
// Hooks: beat brings the omens due · death lets the pending ones happen (the god has paid).
import { hasAction, onAction } from '../../command';
import type { System } from '../../game';
import { checkConjure, conjureBeat, conjureFlush, previewConjure, runConjure } from './run';

export { allMixes, mixKey, parseMix, plan, priceOf, targetOf, nameFor, shadowChance, type Mix, type Plan, type Target } from './plan';
export { CELLS, type Cell } from './table';
export { REACTIONS, type Reaction } from './reactions';
export { runOps, flatten, scaleOp, type Op } from './ops';
export { checkConjure, previewConjure, runConjure, conjureBeat, conjureFlush, SHADOW_OPS } from './run';
export { conjOf, viewConj, type ConjureExt, type PendingConjure } from './state';

let installed = false;

/** Registers the command `conjure` with `command/` (called when the module is imported; a test that cleared the commands can call it with `force`). */
export function registerConjureActions(force = false): void {
  if (installed && !force) return;
  installed = true;
  if (!hasAction('conjure')) onAction('conjure', { check: checkConjure, preview: previewConjure, run: runConjure });
}
registerConjureActions();

export const godConjureSystem: System = {
  name: 'god.conjure',
  beat(ctx) {
    conjureBeat(ctx);
  },
  death(ctx) {
    conjureFlush(ctx);
  },
};
