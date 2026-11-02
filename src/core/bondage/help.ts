// The role of the helper (10-bondage.md §8 "ผู้ช่วยหนี"; 27-bondage.md §5, nodes ab.a1 to ab.a3): a bound person asks, the character hides him,
// pays for him or refuses; takes him over the border or is caught; and the freed one may stay as an ally.
import type { Ctx } from '../game';
import { write } from '../log';
import { apply } from '../rules';
import type { LifeState } from '../types';
import { peopleCode, personName } from '../text';
import { addTie } from '../bonds';
import { allyFrom, ransomPrice } from './engine';
import { bondageIndex, stanceOf, type BondageExt } from './state';
import { SKILL } from './tuning';

const SRC = { sys: 'bondage', stream: 'bondage.help' } as const;

function newHelpee(ctx: Ctx, life: LifeState, e: BondageExt): NonNullable<BondageExt['helpee']> {
  const rng = ctx.rng('bondage.help');
  const h = {
    name: personName(ctx.rng('bondage.names'), { people: peopleCode(ctx, life.race), gender: rng.chance(0.5) ? 'm' : 'f', continent: life.country.slice(0, 2) }),
    level: (rng.chance(0.5) ? 'B2' : 'B3') as 'B2' | 'B3',
    skill: rng.int(SKILL[0], SKILL[1]),
  };
  e.helpee = h;
  return h;
}

/** The nodes ab.a1 to ab.a3: what they do to the person who asked, and to the character. */
export function grantHeldHelp(ctx: Ctx, life: LifeState, e: BondageExt, id: string, key: 'a' | 'b' | 'c' | '-'): void {
  const d = bondageIndex(ctx).data;
  const rng = ctx.rng('bondage.help');
  const stance = stanceOf(ctx, life.country);
  const h = e.helpee;
  switch (`${id}.${key}`) {
    case 'ab.a1.a': {
      const p = newHelpee(ctx, life, e);
      p.hidden = true;
      break;
    }
    case 'ab.a1.b': {
      const p = newHelpee(ctx, life, e);
      const price = Math.min(life.gold, ransomPrice(ctx, p.level === 'B3' ? 3 : 2, life.country, { skill: p.skill, years: 8 }));
      apply(ctx, [{ k: 'stat', stat: 'gold', delta: -price }, { k: 'stat', stat: 'บุญคุณ', delta: d.gratitude.redeem }], SRC);
      p.freed = true;
      e.counts.freed++;
      p.allied = allyFrom(ctx, life, p, d.allyChance.redeemOrFree);
      write(ctx.state, { sys: 'bondage', kind: 'free', id: p.name, data: { name: p.name, how: 'ransom', price }, level: 1 });
      break;
    }
    case 'ab.a2.a':
    case 'ab.a2.b': {
      const p = h ?? newHelpee(ctx, life, e);
      if (p.freed) break;
      p.freed = true;
      e.counts.helped++;
      e.counts.freed++;
      // the helper is trusted by the one who fled (+4) and the one who fled may stay (50%)
      apply(ctx, [{ k: 'trust', toward: p.name, delta: d.gratitude.helperTrust }], SRC);
      p.allied = allyFrom(ctx, life, p, d.allyChance.helper);
      write(ctx.state, { sys: 'bondage', kind: 'free', id: p.name, data: { name: p.name, how: key === 'a' ? 'crossed' : 'bribe' }, level: 1 });
      break;
    }
    case 'ab.a2.c': {
      // caught: the helper may be wanted where he was caught (27 §5: 25%) and the person is taken back
      if (['D', 'L', 'M'].includes(stance) && rng.chance(0.25)) apply(ctx, [{ k: 'grant', kind: 'curse', id: 'c_wanted' }], SRC);
      e.helpee = undefined;
      break;
    }
    case 'ab.a3.a': {
      const p = h ?? newHelpee(ctx, life, e);
      if (!p.allied) p.allied = allyFrom(ctx, life, p, 1);
      apply(ctx, [{ k: 'stat', stat: 'บุญคุณ', delta: 4 }], SRC);
      break;
    }
    case 'ab.a3.b': {
      // he settles at the free land and writes every year (27 §5): a distant tie of low bond
      const p = h ?? newHelpee(ctx, life, e);
      if (!p.allied) {
        addTie(ctx, life, { line: 'สหาย', level: 1, b: 15, from: 'redeem', name: p.name, country: 'AL-19', gratitude: 2 });
        p.allied = true;
        e.counts.allies++;
      }
      apply(ctx, [{ k: 'stat', stat: 'บุญคุณ', delta: 2 }], SRC);
      break;
    }
    default:
  }
}
