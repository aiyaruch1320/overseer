// The four filters of 01-travel-rules.md §3 for a destination: the route is open (routes.ts), the place's stance toward the character's people (§3.2),
// morals and the job (§3.3), the body and the world flags (§3.5, §3.4). A destination any layer cuts is taken out of the list.
import type { Ctx } from '../game';
import { holds, tagsOf, trustOf } from '../character';
import { world } from '../world/access';
import type { CountryId, LifeState } from '../types';
import { geo, raceCode, type CountryInfo } from './data';
import { extOf } from './state';

export interface Entry {
  /** The stance of the place toward the character, −2..+1 (§3.2). */
  stance: number;
  /** Toll factor and extra checks that go with the stance. */
  tollMul: number;
  checks: number;
  /** The place can be entered by the normal way. */
  open: boolean;
  /** Not open, but a pass (a trusted person there, an envoy, an invitation) lets the character in. */
  pass: boolean;
  /** Closed to the character for good (body, morals): even a smuggler cannot bring the character in. */
  never: boolean;
  why?: string;
}

const own = (life: LifeState) => life.country;

/** Flags that make a country unreachable by the normal ways: swallowed by fog (FG-02 → `fallen`). */
const DEAD_FLAGS = ['fallen'];

export const flagsOf = (ctx: Ctx, c: CountryId): string[] => world(ctx).countryFlags[c] ?? [];

/** The people of the character as a storyline code. */
export const peopleOf = (ctx: Ctx, life: LifeState): string => raceCode(ctx, life.race);

/** §3.2 base stance from the table of races. A place that names "all peoples" (or none known) counts 0. */
function baseStance(ctx: Ctx, life: LifeState, c: CountryInfo): number {
  const mine = peopleOf(ctx, life);
  const g = geo(ctx);
  const faithOfAL02 = g.countries.get('AL-02')?.faiths[0];
  let low: number | undefined;
  let high: number | undefined;
  const take = (v: number) => {
    if (v < 0) low = Math.min(low ?? 0, v);
    else high = Math.max(high ?? 0, v);
  };
  if (c.first && c.first === mine) take(1);
  for (const r of g.travel.raceRelations) {
    const except = r.except?.some((p) => p.race === mine || p.race === c.first);
    if (except) continue;
    const fromHas = (list: typeof r.from, code: string | null) => !!code && list.some((p) => (p.race === code && !p.sub) || (p.race === null && p.name === 'ทุกเผ่า'));
    const toHas = (list: typeof r.to, code: string | null, country: CountryId) => list.some((p) => (!!code && p.race === code && !p.sub) || p.country === country);
    if (r.place) {
      // "ในถิ่นศาสนาแสง": the places that share the light faith of AL-02, or the countries it names
      const here = r.place.countries.includes(c.id) || (!!faithOfAL02 && c.faiths.includes(faithOfAL02));
      if (here && fromHas(r.from, mine)) take(r.value);
      continue;
    }
    if (fromHas(r.from, mine) && toHas(r.to, c.first, c.id)) take(r.value);
    else if (r.mutual && c.first && fromHas(r.from, c.first) && toHas(r.to, mine, c.id)) take(r.value);
  }
  // the lowest bad stance wins over a friendly one: a place that fears you does not welcome you
  return low ?? high ?? 0;
}

/** §3.2: stance with the modifiers (trusted people there +1, invitation or envoy +1, `c_infamous` −1), clamped to −2..+1. */
export function stanceOf(ctx: Ctx, life: LifeState, c: CountryInfo): number {
  if (c.id === own(life) || c.id === extOf(life).base) return 1;
  let s = baseStance(ctx, life, c);
  const ex = extOf(life);
  if (c.firstName && trustOf(life, c.firstName) >= 3) s += 1;
  if (ex.invited.includes(c.id) || life.job === 'diplomat' || life.job === 'nine_delegate') s += 1;
  if (holds(ctx, life, 'curse', 'c_infamous')) s -= 1;
  return Math.max(-2, Math.min(1, s));
}

/** §3.3 and §3.5: the places the character must not enter at all, whatever the stance (a smuggler cannot help). */
function blocked(ctx: Ctx, life: LifeState, c: CountryInfo): string | undefined {
  const ex = extOf(life);
  const tags = tagsOf(ctx, life);
  // deep water scenes: only those who breathe water (§3.5)
  const dw = geo(ctx).travel.deepWater;
  if (dw.countries.includes(c.id) && !tags.has('water_breath') && life.race !== 'merfolk' && life.race !== 'naga' && !(life.race === 'half' && tags.has('amphibian'))) return 'deep water';
  // the body (§3.3): lava folk stop in the cold, slimes need damp ground, mummies need holy dust
  if (life.race === 'lavakin' && c.continent === 'NB') return 'cold';
  if (life.race === 'slime' && c.continent === 'SH' && !c.coast) return 'dry';
  if (life.race === 'mummy' && c.continent !== 'SH' && !life.items.some((i) => /dust/.test(i))) return 'no dust';
  // morals (§3.3): the necromancer and the dead are not let into the places of the light; the one who burned the world tree is hunted in SV
  if ((tags.has('necro') || life.flags.includes('necro')) && c.id === 'AL-02') return 'necro';
  if (life.flags.includes('tree_burner') && c.continent === 'SV') return 'tree burner';
  // wanted in a country: that country and those of the continent that hand over a criminal (justice court, martial, ledger) arrest on the border
  if (ex.wantedIn.length) {
    for (const y of ex.wantedIn) {
      const w = geo(ctx).countries.get(y);
      if (!w) continue;
      if (y === c.id) return 'wanted';
      if (w.continent === c.continent && ['court', 'martial', 'ledger'].includes(w.justice) && ['court', 'martial', 'ledger'].includes(c.justice)) return 'extradition';
    }
  }
  if (life.flags.includes('god_thief') && c.faiths.length) return 'god thief';
  return undefined;
}

/** Does the character have a pass for a closed place: a trusted person there (≥ 3), an envoy or an invitation (§3.2 row −2)? */
function hasPass(ctx: Ctx, life: LifeState, c: CountryInfo): boolean {
  const ex = extOf(life);
  return ex.invited.includes(c.id) || life.job === 'diplomat' || (!!c.firstName && trustOf(life, c.firstName) >= 3);
}

/** All four layers but the route (which depends on the way and the time): can the character be in `c`, and how? */
export function entryOf(ctx: Ctx, life: LifeState, c: CountryInfo): Entry {
  const stance = stanceOf(ctx, life, c);
  const row = geo(ctx).travel.stances.find((s) => s.value === stance)!;
  const why = blocked(ctx, life, c);
  const flags = flagsOf(ctx, c.id);
  if (flags.some((f) => DEAD_FLAGS.includes(f))) return { stance, tollMul: row.tollMul, checks: row.extraChecks, open: false, pass: false, never: false, why: 'fallen' };
  if (why) return { stance, tollMul: row.tollMul, checks: row.extraChecks, open: false, pass: false, never: why !== 'wanted' && why !== 'extradition', why };
  if (!row.enterable) {
    const pass = hasPass(ctx, life, c);
    return { stance, tollMul: row.tollMul, checks: row.extraChecks, open: pass, pass, never: false, why: pass ? undefined : 'closed' };
  }
  return { stance, tollMul: row.tollMul, checks: row.extraChecks, open: true, pass: false, never: false };
}
