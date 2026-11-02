// The numbers of the lineage that conditions of the storylines read (heirs: `lineage.open` `lineage.successors`, docs/lore/storylines/23-heir.md §2).
import { onStat } from '../rules';
import { hasX, lx } from './state';

let done = false;

export function registerStat(): void {
  if (done) return;
  done = true;
  // the threads the life carries (the heir's open threads), so the nodes hr.a1 to hr.a3 find them
  onStat('lineage.open', { read: (ctx) => (hasX(ctx.state) ? lx(ctx.state).threads.filter((t) => t.state === 'open' && t.holder === ctx.state.life?.id).length : 0) });
  // the people who could take over after the death (the bond book of the dead life): the successors of the doc
  onStat('lineage.successors', { read: (ctx) => (hasX(ctx.state) && ctx.state.lineage.lives.length > 0 ? 1 : 0) });
  onStat('lineage.lives', { read: (ctx) => ctx.state.lineage.lives.length });
}
