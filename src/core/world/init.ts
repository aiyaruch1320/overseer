// World creation: the fifteen dragons, the slow variables, the country flags and faith, era 1, and FG-01 already happened.
import type { Ctx } from '../game';
import { NEVER, world, year } from './access';
import { fire } from './core';
import { tablesOf } from './data';
import { TUNING } from './tuning';

export function initWorld(ctx: Ctx): void {
  const t = tablesOf(ctx);
  const w = world(ctx);
  const r = ctx.rng('world');
  w.era = 1;
  w.dfc = 0;
  w.vars = {};
  for (const v of t.vars) if (v.start !== null) w.vars[v.code] = v.start;
  w.vars.tension = TUNING.tension.start;
  w.vars.warUntil = NEVER;
  w.vars.hpBlockUntil = NEVER;
  w.vars['F.A'] = 0;
  for (const z of t.data.disturb) w.vars['Z:' + z.dragon] = z.start;
  w.vars.eraStart1 = year(ctx);
  // the order of the draws is the sim's: the moods of the fifteen dragons first
  w.dragons = t.dragons.map((d) => ({ id: d.name, alive: true, mood: d.initMood + r.gauss() * TUNING.moodStartNoise }));
  w.lastEraKeys = 0;
  w.happened = {};
  w.closed = [];
  w.chains = { 'cap:⭐': NEVER, 'cap:●': NEVER, 'cap:○': NEVER };
  w.ruins = [];
  w.ended = undefined;
  w.countryFlags = {};
  w.countryFaith = {};
  for (const c of Object.keys(t.data.mainFaiths)) {
    w.countryFlags[c] = [];
    w.countryFaith[c] = w.vars.F;
  }
  // the story starts after the rift of the clouds opened (FG-01 is an initial state, world-events.md §0.4 rule 6)
  const now = ctx.state.clock.worldYear;
  ctx.state.clock.worldYear = now - TUNING.startedBefore;
  fire(ctx, 'FG-01');
  ctx.state.clock.worldYear = now;
}
