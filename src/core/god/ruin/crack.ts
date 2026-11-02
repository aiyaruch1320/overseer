// A large miracle that falls on a seal (04-miracles.md §5.4): the city does not become a ruin, it cracks. About a third of the buildings fall, seven in ten
// of the people are left, the NPCs roll a gentler die than in a ruin, W −2 for ten years; the events of the country stay; RU-02 and RU-03 open (with scales
// and bits of the seal in place of star iron) and RU-01 and RU-07 do not.
import type { Ctx } from '../../game';
import { addMod, setFlag } from '../acts/mods';
import { godOf } from '../acts/geo';
import { chronicle, say } from '../acts/record';
import { yearOf } from '../acts/state';
import { noteBig } from './gd08';
import { rollPeople } from './people';
import type { SealInfo } from './seal';
import { ruinExt, type CrackRec } from './state';
import { STREAM } from './tuning';

export interface CrackStrike {
  id: string;
  name: string;
}

/** Makes the cracked city. Returns what happened, in words, for the log of the miracle. */
export function crackStep(ctx: Ctx, s: SealInfo, strike: CrackStrike, dragons: number[]): string {
  const g = godOf(ctx).miracles;
  const d = g.seal.crack;
  const c = s.country;
  const e = ruinExt(ctx.state);
  const y = yearOf(ctx);
  addMod(ctx, { subject: 'W', country: c, add: d.w, years: d.wYears, src: 'crack' });
  addMod(ctx, { subject: 'population', country: c, mul: d.pop / 100, src: 'crack' });
  addMod(ctx, { subject: 'buildings', country: c, mul: 1 - d.buildings / 100, src: 'crack' });
  setFlag(ctx, c, 'cracked');
  // the allies roll the share of the ruin's die ("ตายเพียง 25" against 50), so the cracked city takes the same share of it
  const n = g.ruin.numbers;
  const allyDie = Math.round((n.allyDie * d.npc.die) / n.npc.die);
  const fates = rollPeople(ctx, c, d.npc, allyDie, 'เมืองร้าว');
  const rng = ctx.rng(STREAM);
  const rec: CrackRec = { country: c, kind: strike.id, year: y, dragons, fled: fates.fled, died: fates.died, due: {}, done: {}, took: [] };
  for (const ev of g.ruin.events.filter((x) => d.opens.includes(x.id)).sort((a, b) => a.id.localeCompare(b.id))) rec.due[ev.id] = y + rng.int(ev.from, ev.to ?? ev.from);
  e.cracks.push(rec);
  noteBig(ctx, 2, c);
  chronicle(ctx, { kind: 'seal.crack', id: strike.id, target: c, result: `die:${fates.died.length} flee:${fates.fled.length}` });
  say(ctx, { kind: 'seal', id: 'crack', data: { country: c, dragons: dragons.length, died: fates.died.length, fled: fates.fled.length, stayed: fates.stayed.length, left: d.pop, built: d.buildings }, level: 1 });
  return `เมืองร้าว อาคารพังราว ${d.buildings}% คนเหลือ ${d.pop}%`;
}
