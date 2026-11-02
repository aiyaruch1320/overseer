// The world system (code-plan §7): events, dragons, eras, the end of the world. Ported from scripts/sim/sim-world.mjs onto data/gen/world-events.json.
// Importing this module registers the conditions, effects and numbers of the world domain with the shared rules (./conds).
import type { Ctx, System } from '../game';
import './conds';
import { initWorld } from './init';
import { worldDecade } from './step';

export const worldSystem: System = {
  name: 'world',
  init: (ctx: Ctx) => initWorld(ctx),
  worldStep: (ctx: Ctx) => worldDecade(ctx),
};

export * from './api';
export { TUNING } from './tuning';
export { tablesOf } from './data';
