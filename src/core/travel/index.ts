// The travel system (code-plan §7 row "travel", docs/systems/travel/): levels L0 to L2, the causes of a journey, the filters of a destination, the routes
// and the road. It opens the journey lines (sf ps ml sc ex wd xc) of the story through `openLine`, moves `life.country`, and follows the ways of the
// story that name a place. State lives in `life.ext.travel`. Importing this file registers its numbers (rules.ts).
import type { System } from '../game';
import { write } from '../log';
import { onNode, setPlaceGate } from '../story';
import type { Effect, LifeState } from '../types';
import { boundBan } from '../character';
import { rollCauses, disasters } from './causes';
import { cityYear, openJobLines, jobYear } from './jobs';
import './rules';
import { beatOf, extOf, fresh, lifeOf } from './state';
import { go, move, plan, queueLine, reachable } from './trip';
import { FOLLOW_STORY, MIN_AGE } from './tuning';
import type { Ctx } from '../game';

export { registerTravelRules } from './rules';
export { go, move, plan, reachable, canSmuggle, fogProof, type Plan, type Leg, type GoResult } from './trip';
export { stanceOf, entryOf, type Entry } from './access';
export { routeState, EDGES, type RouteId } from './routes';
export { CAUSES, disasters, leave } from './causes';
export { pickDestination } from './dest';
export { geo } from './data';
export { extOf as travelExt, type TravelExt } from './state';
export * as travelTuning from './tuning';

/** Can the character get to `to` by a normal way right now (the four filters of §3, no purse test)? Used by the story to weigh a way that names a place. */
export function canGo(ctx: Ctx, to: string): boolean {
  const life = ctx.state.life;
  return !!life && !life.dead && reachable(ctx, life, to, { smuggle: false });
}

/** The level of the life (L0 L1 L2). */
export function levelOf(life: LifeState): 0 | 1 | 2 {
  return extOf(life).level;
}

/**
 * The story says "ย้ายถิ่น": a way of a node names a place (the `place` effect). The character goes there for good (free of fare when still a child),
 * by the ways the filters leave open; a place the filters shut stays shut (logged).
 */
export function relocate(ctx: Ctx, to: string, why: string): boolean {
  const life = lifeOf(ctx);
  if (!life || life.country === to) return false;
  const ex = extOf(life);
  const free = life.hAge < 18;
  let r = go(ctx, to, why, { free, smuggle: true, walk: true });
  if (!r.legs && !free) r = go(ctx, to, why, { free: true, smuggle: true });
  if (!r.legs) return false;
  ex.away = undefined;
  ex.base = life.country;
  return true;
}

function placesOf(effects: readonly Effect[]): string[] {
  const out: string[] = [];
  for (const e of effects) if (e.k === 'place' && Array.isArray((e as { ids?: string[] }).ids)) out.push(...(e as { ids: string[] }).ids);
  return out;
}

/** The way of a node was taken: if it names a place (`place` effect), the character moves there when the filters and the tuning (FOLLOW_STORY) allow. */
export function followStory(ctx: Ctx, node: { id: string; choices: { key: string; effects: readonly Effect[] }[] }, key: string): boolean {
  if (key === '-') return false;
  const life = lifeOf(ctx);
  if (!life) return false;
  const choice = node.choices.find((c) => c.key === key);
  for (const to of placesOf(choice?.effects ?? [])) {
    if (to === life.country || !/^[A-Z]{2}-\d{2}$/.test(to)) continue;
    const p = to.slice(0, 2) === life.country.slice(0, 2) ? FOLLOW_STORY.same : FOLLOW_STORY.cross;
    if (p < 1 && !ctx.rng('life.travel.story').chance(p)) continue;
    if (relocate(ctx, to, `story:${node.id}`)) return true;
  }
  return false;
}

setPlaceGate(canGo);

let hooked = false;
function hookStory(): void {
  if (hooked) return;
  hooked = true;
  onNode({ after: (ctx, node, _id, key) => void followStory(ctx, node, key) });
}
hookStory();

export const travelSystem: System = {
  name: 'travel',
  birth(ctx) {
    const life = lifeOf(ctx);
    if (!life) return;
    life.ext.travel = fresh(life.country);
  },
  beat(ctx) {
    const life = lifeOf(ctx);
    const a = life && extOf(life).away;
    if (!life || !a) return;
    const ex = extOf(life);
    // taken into bondage on a trip: the trip is over, the owner holds him where he is
    if (boundBan(life, 'move')) {
      ex.away = undefined;
      ex.base = life.country;
      return;
    }
    if (ex.delay > 0) {
      a.until += ex.delay;
      ex.delay = 0;
    }
    if (beatOf(ctx, life) < a.until) return;
    ex.away = undefined;
    if (a.settle) {
      ex.base = life.country;
      write(ctx.state, { sys: 'travel', kind: 'settle', id: life.country, data: { why: a.cause }, level: 1 });
      return;
    }
    const r = go(ctx, ex.base, 'return', { free: true, smuggle: true });
    // the way home is shut: the character stays where the road ended
    if (!r.legs) ex.base = life.country;
  },
  lifeYear(ctx) {
    const life = lifeOf(ctx);
    if (!life) return;
    const ex = extOf(life);
    // c_wanted the character carries without a place on record (given by another system): wanted where the character stands
    if (life.curses.includes('c_wanted') && !ex.wantedIn.length) ex.wantedIn.push(life.country);
    else if (!life.curses.includes('c_wanted') && ex.wantedIn.length) ex.wantedIn = [];
    const now = disasters(ctx, life);
    const begins = now.filter((d) => !ex.seen.includes(d));
    ex.seen = now;
    for (const k of Object.keys(ex.yearLegs)) if (Number(k) < life.hAge - 3) delete ex.yearLegs[Number(k)];
    for (const k of Object.keys(ex.yearDays)) if (Number(k) < life.hAge - 3) delete ex.yearDays[Number(k)];
    if (life.hAge < MIN_AGE) return;
    // a life in bondage makes no journey and takes no cause of one (10-bondage.md §2); the lines of travel wait for his freedom
    if (boundBan(life, 'move')) return;
    openJobLines(ctx, life, ex);
    rollCauses(ctx, life, ex, new Set(begins));
    if (!lifeOf(ctx)) return;
    jobYear(ctx, life, ex);
    cityYear(ctx, life, ex);
    // §3 of 25-journeys: a stranger comes to a character who stays home (35%, human-equivalent age 24 to 36, L0, not a human)
    if (!ex.spontaneous && life.race !== 'human' && life.hAge >= 24 && life.hAge <= 36 && ex.level === 0) {
      ex.spontaneous = true;
      const overlay = ctx.data.travel ? (ctx.data.travel.items as { overlays: { id: string; spontaneous?: { chance: number } }[] }).overlays.find((o) => o.id === 'xc') : undefined;
      if (ctx.rng('life.travel').chance(overlay?.spontaneous?.chance ?? 0.35)) queueLine(ctx, 'xc', 'visitor');
    }
  },
};

