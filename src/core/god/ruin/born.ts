// A character born in a country that is a ruin of the god (04-miracles.md §5.3): the curse of the homeland with its chance. (The exile origin of the
// race is the character system's: it chooses where he is born; the god system adds the curse only.)
import type { Ctx } from '../../game';
import { apply } from '../../rules';
import { livingOf } from '../acts/state';
import { godOf } from '../acts/geo';
import { ruinAt } from './state';
import { STREAM } from './tuning';

export function hauntBorn(ctx: Ctx): void {
  const life = livingOf(ctx);
  if (!life || !ctx.data.god) return;
  const r = ruinAt(ctx, life.country) ?? ruinAt(ctx, life.home);
  if (!r || r.year > life.birthYear) return;
  const n = godOf(ctx).miracles.ruin.numbers;
  if (life.curses.includes(n.mcCurse.id) || !ctx.rng(STREAM).chance(n.exileCurseChance / 100)) return;
  apply(ctx, [{ k: 'grant', kind: 'curse', id: n.mcCurse.id }], { sys: 'god', id: 'ruin.born', stream: STREAM });
}
