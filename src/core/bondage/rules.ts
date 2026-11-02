// The condition and stat kinds the bondage system owns, and its hooks on the nodes of bd bo ab (lore/storylines/27-bondage.md).
//   condition: stance
//   stat:      bondage.level
// The lines bd bo ab are opened here (`openLine` of the story) and no longer by the story's own chance (story/tuning.ts OPEN_RATE).
import type { Ctx } from '../game';
import { write } from '../log';
import { apply, onStat } from '../rules';
import { onNode, openLine } from '../story';
import { EXTERNAL_LINES } from '../story/tuning';
import { grantHeldHelp } from './help';
import { enter, flee, leave, free, sell, buy, ransomPrice } from './engine';
import { bondageIndex, extOf, lifeOf, stanceOf, type BondageExt } from './state';
import type { LifeState, StoryNode } from '../types';

const lastHeld = (e: BondageExt) => [...e.held].reverse().find((h) => !h.gone);

function after(ctx: Ctx, life: LifeState, e: BondageExt, id: string, key: 'a' | 'b' | 'c' | '-'): void {
  const rng = ctx.rng('bondage.node');
  const stance = stanceOf(ctx, life.country);
  switch (`${id}.${key}`) {
    // bd.a2 way a: he sets out to buy his freedom, way b: he flees, way c: another pays for him
    case 'bd.a2.a':
      if (e.level > 0) e.ransoming = true;
      break;
    case 'bd.a2.b':
      if (e.level > 0) flee(ctx, life);
      break;
    case 'bd.a2.c':
      if (e.level > 0) leave(ctx, life, 'freed');
      break;
    case 'bd.a3.c':
      if (!e.opened.includes('ab')) {
        e.opened.push('ab');
        openLine(ctx, 'ab');
      }
      break;
    // bo.a1: a buys a skilled person, c buys to free him at once
    case 'bo.a1.a':
      buy(ctx, life, false);
      break;
    case 'bo.a1.c':
      buy(ctx, life, true);
      break;
    case 'bo.a2.a': {
      const h = lastHeld(e);
      if (h) h.good = true;
      break;
    }
    case 'bo.a2.b': {
      const h = lastHeld(e);
      if (h) h.good = false;
      break;
    }
    case 'bo.a2.c': {
      const h = lastHeld(e);
      if (h) {
        h.gone = 'fled';
        e.counts.escapes++;
        write(ctx.state, { sys: 'bondage', kind: 'escape', id: h.id, data: { ok: true, name: h.name, who: 'held' }, level: 2 });
        if (!e.opened.includes('ab')) {
          e.opened.push('ab');
          openLine(ctx, 'ab');
        }
      }
      break;
    }
    case 'bo.a3.a': {
      const h = lastHeld(e);
      if (h) free(ctx, life, h, 'freed', id);
      break;
    }
    case 'bo.a3.b': {
      const h = lastHeld(e);
      if (h) sell(ctx, life, h);
      break;
    }
    case 'bo.a3.c': {
      const h = lastHeld(e);
      if (h) {
        free(ctx, life, h, 'crossed', id);
        if (['D', 'L', 'M'].includes(stance) && rng.chance(0.2)) apply(ctx, [{ k: 'grant', kind: 'curse', id: 'c_wanted' }], { sys: 'bondage', id });
      }
      break;
    }
    // kn.t1 way c: no kin takes him in; where a debt-bound land lets it be, a keeper holds his contract (10-bondage.md §5 "ถูกทิ้ง")
    case 'kn.t1.c':
      if (['D', 'L', 'M'].includes(stance) && e.level === 0 && rng.chance(0.6)) enter(ctx, life, 'ถูกทิ้ง', 2, { born: false });
      break;
    default:
      grantHeldHelp(ctx, life, e, id, key);
  }
}

/** What the node `id` does to the bondage of the life once the way `key` was taken (the hook below calls this; tests call it directly). */
export function afterNode(ctx: Ctx, id: string, key: 'a' | 'b' | 'c' | '-'): void {
  const life = lifeOf(ctx);
  if (life) after(ctx, life, extOf(life), id, key);
}

const hooks = {
  after(ctx: Ctx, _n: StoryNode, id: string, key: 'a' | 'b' | 'c' | '-') {
    afterNode(ctx, id, key);
  },
};

let remove: (() => void) | undefined;

export function registerBondageRules(): void {
  // the condition `stance` (`ประเทศท่าที D L M`) is read by the world system from its own table (world/conds.ts); the same table as bondage.json byCountry
  onStat('bondage.level', { read: (ctx) => (lifeOf(ctx) ? extOf(lifeOf(ctx)!).level : 0) });
  for (const l of ['bd', 'bo', 'ab']) (EXTERNAL_LINES as Set<string>).add(l);
  remove?.();
  remove = onNode(hooks);
}

export { ransomPrice, bondageIndex };
